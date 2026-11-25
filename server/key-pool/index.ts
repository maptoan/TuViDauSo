import crypto from 'crypto';
import {
  DEFAULT_SUPPORTED_MODELS,
  type GeminiKeyPublicView,
  type KeyPoolBackupEnvelope,
  type KeyPoolBackupImportResult,
  type KeyPoolBackupKeyEntry,
  type KeyPoolPublicSnapshot,
  type KeyPoolState,
  MAX_KEYS_IN_POOL,
  MAX_PREVIEW_SESSIONS,
  type ModelProfileConfig,
  type ModelThinkingLevel,
  PREVIEW_SESSION_TTL_MS,
  type PreviewResult,
  type PreviewSessionEntry,
  type StreamExecutionMeta,
  TEST_KEY_DEBOUNCE_MS,
  TEST_KEY_MAX_OUTPUT_TOKENS,
  TEST_KEY_TIMEOUT_MS,
} from './types.ts';
import { computeKeyFingerprint, isValidGeminiApiKey, parseBatchKeys } from './parser.ts';
import {
  decryptPoolBackup,
  encryptPoolBackup,
  KeyPoolCryptoStore,
  mergeModelProfiles,
} from './crypto-store.ts';
import {
  classifyGeminiError,
  isSupportedGemini35Plus,
  KeyAllocator,
  sanitizeSecretText,
} from './allocator.ts';
import {
  type AiClientFactory,
  defaultAiClientFactory,
  type ExecuteStreamOptions,
  GeminiStreamExecutor,
  isGemmaModel,
  PoolExhaustedError,
  type PoolFailureCategory,
  TpmGuardSkipError,
} from './executor.ts';

interface StoredPreviewSession {
  createdAt: number;
  entries: PreviewSessionEntry[];
}

export class KeyPoolManager {
  private readonly store: KeyPoolCryptoStore;
  private state: KeyPoolState;
  private rawKeysById: Map<string, string>;
  private readonly allocator: KeyAllocator;
  private readonly executor: GeminiStreamExecutor;
  private readonly previewSessions = new Map<string, StoredPreviewSession>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(baseDataDir?: string) {
    this.store = new KeyPoolCryptoStore(baseDataDir);
    const loaded = this.store.loadState();
    this.state = loaded.state;
    this.rawKeysById = loaded.rawKeysById;

    this.allocator = new KeyAllocator(
      () => this.state,
      () => this.rawKeysById,
      (immediate) => this.scheduleSave(immediate),
    );
    this.executor = new GeminiStreamExecutor(
      () => this.state,
      () => this.rawKeysById,
      this.allocator,
    );

    this.bootstrapFromEnv();
  }

  private scheduleSave(immediate: boolean): void {
    if (immediate) {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
      void this.store.saveState(this.state);
      return;
    }

    if (this.debounceTimer) return;
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.store.saveState(this.state);
    }, 100);
    if (typeof this.debounceTimer.unref === 'function') {
      this.debounceTimer.unref();
    }
  }

  public async flushPersistence(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    await this.store.saveState(this.state);
  }

  public bootstrapFromEnv(forceSync = false): number {
    if (forceSync) {
      this.state.disabledEnvFingerprints = [];
    }
    const seeds = this.store.collectEnvSeedKeys();
    const existingFingerprints = new Set(this.state.keys.map((k) => k.fingerprint));
    const disabledEnvSet = new Set(this.state.disabledEnvFingerprints);
    let added = 0;

    for (const seed of seeds) {
      if (this.state.keys.length >= MAX_KEYS_IN_POOL) break;
      const fp = computeKeyFingerprint(seed.rawKey);
      if (existingFingerprints.has(fp)) continue;
      if (!forceSync && disabledEnvSet.has(fp)) continue;

      const record = this.store.createKeyRecord({
        rawKey: seed.rawKey,
        label: seed.label,
        source: 'env_secret',
      });
      this.state.keys.push(record);
      this.rawKeysById.set(record.id, seed.rawKey);
      existingFingerprints.add(fp);
      added += 1;

      this.allocator.appendLog({
        timestamp: Date.now(),
        keyId: record.id,
        maskedKey: record.maskedKey,
        fromStatus: 'ready',
        toStatus: 'ready',
        reason: 'ENV_SECRET_BOOTSTRAPPED',
      });
    }

    if (added > 0 || forceSync) {
      this.scheduleSave(true);
    }
    return added;
  }

  public sanitize(raw: unknown): string {
    return sanitizeSecretText(raw, this.rawKeysById.values());
  }

  public classifyError(err: unknown) {
    return classifyGeminiError(err, this.rawKeysById.values());
  }

  public checkPreStreamGate(now = Date.now()):
    | { ok: true }
    | {
        ok: false;
        status: 503;
        error: 'AI_NOT_CONFIGURED' | 'AI_POOL_EXHAUSTED';
        errorCategory: PoolFailureCategory;
        minRemainingCooldownSec: number | null;
        message: string;
      } {
    this.allocator.sweep(now);
    const total = this.state.keys.length;
    if (total === 0) {
      return {
        ok: false,
        status: 503,
        error: 'AI_NOT_CONFIGURED',
        errorCategory: 'AI_NOT_CONFIGURED',
        minRemainingCooldownSec: null,
        message:
          'Chưa cấu hình AI (kho khóa hiện chưa có khóa Gemini nào). Hệ thống giữ nguyên Khung dữ kiện xác định và không giả lập văn bản AI.',
      };
    }

    const ready = this.state.keys.filter((k) => k.status === 'ready').length;
    const cooldown = this.state.keys.filter((k) => k.status === 'cooldown').length;
    const minSec = this.allocator.getMinRemainingCooldownSec(now);

    if (ready === 0 && cooldown === 0) {
      const authDisabled = this.state.keys.find(
        (k) =>
          k.cooldownReason === 'AUTH_INVALID_KEY' ||
          k.cooldownReason === 'AUTH_FORBIDDEN_REPEATED' ||
          k.stats.lastErrorType === 'AUTH_INVALID_KEY' ||
          k.stats.lastErrorType === 'AUTH_FORBIDDEN_REPEATED',
      );
      const errCat: PoolFailureCategory =
        authDisabled?.cooldownReason && authDisabled.cooldownReason !== 'NONE'
          ? authDisabled.cooldownReason
          : authDisabled?.stats.lastErrorType && authDisabled.stats.lastErrorType !== 'NONE'
            ? authDisabled.stats.lastErrorType
            : 'AUTH_INVALID_KEY';
      return {
        ok: false,
        status: 503,
        error: 'AI_POOL_EXHAUSTED',
        errorCategory: errCat,
        minRemainingCooldownSec: null,
        message: 'Tất cả khóa Gemini trong kho hiện đều bị vô hiệu hóa hoặc chưa sẵn sàng.',
      };
    }

    if (ready === 0 && cooldown > 0 && minSec !== null && minSec > 30) {
      const cooling = this.state.keys.find(
        (k) => k.status === 'cooldown' && k.cooldownReason !== 'NONE',
      );
      const errCat: PoolFailureCategory = cooling?.cooldownReason ?? 'RATE_LIMIT_RPM';
      return {
        ok: false,
        status: 503,
        error: 'AI_POOL_EXHAUSTED',
        errorCategory: errCat,
        minRemainingCooldownSec: minSec,
        message: `Tất cả khóa Gemini trong kho đang trong thời gian chờ nguội (khóa kế tiếp sẵn sàng sau khoảng ${minSec} giây).`,
      };
    }

    return { ok: true };
  }

  public getDiagnostics() {
    this.allocator.sweep();
    const totalKeys = this.state.keys.length;
    const readyKeys = this.state.keys.filter((k) => k.status === 'ready').length;
    const cooldownKeys = this.state.keys.filter((k) => k.status === 'cooldown').length;
    const disabledKeys = this.state.keys.filter((k) => k.status === 'disabled').length;
    const envSeeds = this.store.collectEnvSeedKeys();
    const envFingerprints = new Set(envSeeds.map((s) => computeKeyFingerprint(s.rawKey)));
    const envSecretActiveInPool = this.state.keys.some((k) => envFingerprints.has(k.fingerprint));

    return {
      geminiApiKeyPresent: totalKeys > 0,
      geminiApiKeyLength: envSeeds[0]?.rawKey.length ?? 0,
      envSecretPresent: envSeeds.length > 0,
      envSecretActiveInPool,
      model: this.state.modelConfig.defaultModel,
      defaultModel: this.state.modelConfig.defaultModel,
      fallbackModel: this.state.modelConfig.fallbackModel,
      supportedModels: this.state.modelConfig.supportedModels,
      totalKeys,
      readyKeys,
      cooldownKeys,
      disabledKeys,
    };
  }

  public getPublicSnapshot(context: {
    isReadOnly: boolean;
    isSharedOrigin: boolean;
    adminPinRequired: boolean;
    hasAdminPinConfigured: boolean;
  }): KeyPoolPublicSnapshot {
    const now = Date.now();
    this.allocator.sweep(now);

    const projectCounts = new Map<string, number>();
    for (const k of this.state.keys) {
      if (k.detectedProjectNumber) {
        projectCounts.set(
          k.detectedProjectNumber,
          (projectCounts.get(k.detectedProjectNumber) ?? 0) + 1,
        );
      }
    }

    const keys: GeminiKeyPublicView[] = this.state.keys.map((k) => {
      const remainingCooldownSec =
        k.status === 'cooldown' && k.cooldownUntil !== null
          ? Math.max(0, Math.ceil((k.cooldownUntil - now) / 1000))
          : 0;
      return {
        id: k.id,
        label: k.label,
        source: k.source,
        maskedKey: k.maskedKey,
        detectedProjectNumber: k.detectedProjectNumber,
        sameProjectKeyCount: k.detectedProjectNumber
          ? projectCounts.get(k.detectedProjectNumber) ?? 1
          : 0,
        status: k.status,
        pendingProbe: k.pendingProbe,
        healthScore: k.healthScore,
        consecutiveErrors: k.consecutiveErrors,
        cooldownUntil: k.cooldownUntil,
        remainingCooldownSec,
        cooldownReason: k.cooldownReason,
        modelCooldowns: k.modelCooldowns ? { ...k.modelCooldowns } : {},
        stats: { ...k.stats },
        createdAt: k.createdAt,
        updatedAt: k.updatedAt,
      };
    });

    const diag = this.getDiagnostics();

    return {
      serverNow: now,
      isReadOnly: context.isReadOnly,
      isSharedOrigin: context.isSharedOrigin,
      adminPinRequired: context.adminPinRequired,
      hasAdminPinConfigured: context.hasAdminPinConfigured,
      envSecretPresent: diag.envSecretPresent,
      envSecretActiveInPool: diag.envSecretActiveInPool,
      modelConfig: {
        ...this.state.modelConfig,
        profiles: this.mergeProfiles(this.state.modelConfig.profiles),
      },
      summary: {
        total: diag.totalKeys,
        ready: diag.readyKeys,
        cooldown: diag.cooldownKeys,
        disabled: diag.disabledKeys,
      },
      keys,
      recentLogs: [...this.state.recentLogs].reverse(),
    };
  }

  private mergeProfiles(
    existing?: Record<string, ModelProfileConfig>,
    override?: Record<string, ModelProfileConfig>,
  ): Record<string, ModelProfileConfig> {
    return mergeModelProfiles(existing, override);
  }

  private prunePreviewSessions(now = Date.now()): void {
    for (const [sid, session] of this.previewSessions.entries()) {
      if (now - session.createdAt > PREVIEW_SESSION_TTL_MS) {
        this.previewSessions.delete(sid);
      }
    }
    while (this.previewSessions.size >= MAX_PREVIEW_SESSIONS) {
      const oldestKey = this.previewSessions.keys().next().value;
      if (!oldestKey) break;
      this.previewSessions.delete(oldestKey);
    }
  }

  public previewBatchImport(rawInput: string, labelPrefix = 'Khóa'): PreviewResult {
    const now = Date.now();
    this.prunePreviewSessions(now);

    const existingFingerprints = new Set(this.state.keys.map((k) => k.fingerprint));
    const parsed = parseBatchKeys(
      rawInput,
      existingFingerprints,
      labelPrefix,
      this.state.keys.length + 1,
    );

    const availableSlots = Math.max(0, MAX_KEYS_IN_POOL - this.state.keys.length);
    const exceedsPoolLimit = parsed.recognizedCount > availableSlots;

    const previewSessionId = `ps_${crypto.randomUUID().slice(0, 12)}`;
    if (parsed.validEntries.length > 0 && !exceedsPoolLimit) {
      this.previewSessions.set(previewSessionId, {
        createdAt: now,
        entries: parsed.validEntries,
      });
    }

    const message = exceedsPoolLimit
      ? `Đã nhận diện ${parsed.recognizedCount} key hợp lệ, nhưng kho chỉ còn ${availableSlots} chỗ trống (tối đa ${MAX_KEYS_IN_POOL} key).`
      : `Đã nhận diện ${parsed.recognizedCount} key hợp lệ, ${parsed.duplicateCount} key trùng bị loại, ${parsed.invalidCount} key không hợp lệ.`;

    return {
      previewSessionId,
      expiresInSeconds: Math.round(PREVIEW_SESSION_TTL_MS / 1000),
      recognizedCount: parsed.recognizedCount,
      duplicateCount: parsed.duplicateCount,
      invalidCount: parsed.invalidCount,
      exceedsPoolLimit,
      message,
      items: parsed.items,
    };
  }

  public confirmBatchImport(previewSessionId: string): { importedCount: number } {
    const now = Date.now();
    this.prunePreviewSessions(now);

    const session = this.previewSessions.get(previewSessionId);
    if (!session) {
      throw new Error('Phiên xem trước đã hết hạn hoặc không tồn tại. Vui lòng phân tích lại danh sách.');
    }
    this.previewSessions.delete(previewSessionId);

    const existingFingerprints = new Set(this.state.keys.map((k) => k.fingerprint));
    let importedCount = 0;

    // QĐ-4 Phương án A: Lưu ngay trạng thái Sẵn sàng (100 điểm), KHÔNG tự gọi probe hàng loạt
    for (const entry of session.entries) {
      if (this.state.keys.length >= MAX_KEYS_IN_POOL) break;
      if (existingFingerprints.has(entry.fingerprint)) continue;

      const record = this.store.createKeyRecord({
        rawKey: entry.rawKey,
        label: entry.label,
        source: 'user_import',
        now,
      });
      this.state.keys.push(record);
      this.rawKeysById.set(record.id, entry.rawKey);
      existingFingerprints.add(entry.fingerprint);
      importedCount += 1;

      this.allocator.appendLog({
        timestamp: now,
        keyId: record.id,
        maskedKey: record.maskedKey,
        fromStatus: 'ready',
        toStatus: 'ready',
        reason: 'BATCH_IMPORTED (score=100)',
      });
    }

    if (importedCount > 0) {
      this.scheduleSave(true);
    }
    return { importedCount };
  }

  public deleteKey(keyId: string): boolean {
    const idx = this.state.keys.findIndex((k) => k.id === keyId);
    if (idx === -1) return false;

    const [removed] = this.state.keys.splice(idx, 1);
    this.rawKeysById.delete(removed.id);

    if (removed.source === 'env_secret') {
      if (!this.state.disabledEnvFingerprints.includes(removed.fingerprint)) {
        this.state.disabledEnvFingerprints.push(removed.fingerprint);
      }
    }

    if (this.state.keys.length > 0) {
      this.state.roundRobinCursor = this.state.roundRobinCursor % this.state.keys.length;
    } else {
      this.state.roundRobinCursor = 0;
    }

    this.allocator.appendLog({
      timestamp: Date.now(),
      keyId: removed.id,
      maskedKey: removed.maskedKey,
      fromStatus: removed.status,
      toStatus: 'disabled',
      reason: 'DELETED_FROM_POOL',
    });
    this.scheduleSave(true);
    return true;
  }

  public reactivateKey(keyId: string): boolean {
    return this.allocator.reactivateKey(keyId);
  }

  public async testKey(
    keyId: string,
    optionsOrFactory?:
      | { model?: string; customClientFactory?: AiClientFactory; disableJitter?: boolean }
      | AiClientFactory,
    maybeCustomClientFactory?: AiClientFactory,
  ): Promise<{
    ok: boolean;
    inconclusive?: boolean;
    latencyMs: number;
    modelUsed: string;
    isDefaultModel: boolean;
    status: string;
    healthScore: number;
    detectedProjectNumber: string | null;
    errorCategory?: string;
    sanitizedMessage?: string;
    cooldownUntil?: number | null;
  }> {
    const now = Date.now();
    const key = this.state.keys.find((k) => k.id === keyId);
    if (!key) {
      throw new Error('Không tìm thấy khóa yêu cầu trong kho.');
    }

    const opts = typeof optionsOrFactory === 'function' ? undefined : optionsOrFactory;
    const customClientFactory =
      typeof optionsOrFactory === 'function'
        ? optionsOrFactory
        : opts?.customClientFactory ?? maybeCustomClientFactory;

    const requestedModel = opts?.model?.trim();
    if (requestedModel && !isSupportedGemini35Plus(requestedModel)) {
      throw new Error(
        `Model kiểm tra "${requestedModel}" không hợp lệ. Chỉ hỗ trợ Gemini từ 3.5 trở lên hoặc Gemma 4.`,
      );
    }

    const modelToTest = requestedModel || this.state.modelConfig.defaultModel;
    const isDefaultModel = modelToTest === this.state.modelConfig.defaultModel;

    if (
      key.stats.lastTestedAt !== null &&
      now - key.stats.lastTestedAt < TEST_KEY_DEBOUNCE_MS
    ) {
      const waitSec = Math.ceil((TEST_KEY_DEBOUNCE_MS - (now - key.stats.lastTestedAt)) / 1000);
      throw new Error(`Vui lòng đợi thêm ${waitSec} giây trước khi kiểm tra thử lại khóa này.`);
    }

    const rawKey = this.rawKeysById.get(keyId);
    if (!rawKey) {
      throw new Error('Không tìm thấy khóa giải mã trên máy chủ.');
    }

    const mergedProfiles = this.mergeProfiles(this.state.modelConfig.profiles);
    const profile = mergedProfiles[modelToTest];
    const testTimeoutMs = isGemmaModel(modelToTest)
      ? Math.min(profile?.firstChunkTimeoutMs ?? 60_000, 65_000)
      : TEST_KEY_TIMEOUT_MS;
    const factory = customClientFactory ?? defaultAiClientFactory;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('TEST_KEY_TIMEOUT')), testTimeoutMs);
    const startMs = Date.now();

    try {
      const client = factory(rawKey);
      const testConfig: {
        maxOutputTokens: number;
        thinkingConfig?: {
          thinkingLevel?: ModelThinkingLevel;
        };
        abortSignal: AbortSignal;
      } = {
        maxOutputTokens: TEST_KEY_MAX_OUTPUT_TOKENS,
        abortSignal: controller.signal,
      };
      if (profile?.thinkingLevel) {
        testConfig.thinkingConfig = { thinkingLevel: profile.thinkingLevel };
      }

      const res = await client.models.generateContent({
        model: modelToTest,
        contents: 'Trả lời đúng 1 từ: OK',
        config: testConfig,
      });
      const latencyMs = Math.max(1, Date.now() - startMs);
      if (!res || typeof res.text !== 'string' || !res.text.trim()) {
        throw new Error('AI_EMPTY_RESPONSE');
      }
      this.allocator.recordManualTestResult(keyId, true, latencyMs, undefined, Date.now(), {
        modelTested: modelToTest,
        isDefaultModel,
        disableJitter: opts?.disableJitter,
      });
      return {
        ok: true,
        latencyMs,
        modelUsed: modelToTest,
        isDefaultModel,
        status: key.status,
        healthScore: key.healthScore,
        detectedProjectNumber: key.detectedProjectNumber,
      };
    } catch (err) {
      const latencyMs = Math.max(1, Date.now() - startMs);
      const isTimeout =
        controller.signal.aborted ||
        (err instanceof Error && err.message.includes('TEST_KEY_TIMEOUT')) ||
        String(err).includes('TEST_KEY_TIMEOUT');

      if (isTimeout) {
        return {
          ok: false,
          inconclusive: true,
          latencyMs,
          modelUsed: modelToTest,
          isDefaultModel,
          status: key.status,
          healthScore: key.healthScore,
          detectedProjectNumber: key.detectedProjectNumber,
          errorCategory: 'TEST_TIMEOUT_INCONCLUSIVE',
          sanitizedMessage: `Hết thời gian chờ khi thử khóa trên ${modelToTest} (${Math.round(testTimeoutMs / 1000)}s) — chưa kết luận trạng thái khóa.`,
          cooldownUntil: key.cooldownUntil,
        };
      }

      const classified = classifyGeminiError(err, this.rawKeysById.values());
      this.allocator.recordManualTestResult(keyId, false, latencyMs, classified, Date.now(), {
        modelTested: modelToTest,
        isDefaultModel,
        disableJitter: opts?.disableJitter,
      });
      return {
        ok: false,
        latencyMs,
        modelUsed: modelToTest,
        isDefaultModel,
        status: key.status,
        healthScore: key.healthScore,
        detectedProjectNumber: key.detectedProjectNumber,
        errorCategory: classified.category,
        sanitizedMessage: classified.sanitizedSummary,
        cooldownUntil: key.cooldownUntil,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  public updateModelConfig(input: {
    defaultModel: string;
    fallbackModel: string;
    customSupportedModels?: string[];
    profiles?: Record<string, ModelProfileConfig>;
  }) {
    const defaultModel = input.defaultModel?.trim();
    const fallbackModel = input.fallbackModel?.trim();

    if (!defaultModel || !isSupportedGemini35Plus(defaultModel)) {
      throw new Error(
        `Model mặc định "${defaultModel}" không hợp lệ. Chỉ hỗ trợ các model Gemini từ 3.5 trở lên hoặc Gemma 4.`,
      );
    }
    if (!fallbackModel || !isSupportedGemini35Plus(fallbackModel)) {
      throw new Error(
        `Model dự phòng "${fallbackModel}" không hợp lệ. Chỉ hỗ trợ các model Gemini từ 3.5 trở lên hoặc Gemma 4.`,
      );
    }

    const supported = new Set<string>([
      ...DEFAULT_SUPPORTED_MODELS,
      ...this.state.modelConfig.supportedModels,
    ]);
    if (Array.isArray(input.customSupportedModels)) {
      for (const m of input.customSupportedModels) {
        const clean = m.trim();
        if (clean && isSupportedGemini35Plus(clean)) {
          supported.add(clean);
        }
      }
    }
    supported.add(defaultModel);
    supported.add(fallbackModel);

    const mergedProfiles = this.mergeProfiles(this.state.modelConfig.profiles, input.profiles);

    this.state.modelConfig = {
      defaultModel,
      fallbackModel,
      supportedModels: Array.from(supported),
      profiles: mergedProfiles,
    };
    this.scheduleSave(true);
    return {
      ...this.state.modelConfig,
      profiles: this.mergeProfiles(this.state.modelConfig.profiles),
    };
  }

  public executeStream(options: ExecuteStreamOptions): Promise<StreamExecutionMeta> {
    return this.executor.executeStream(options);
  }

  public exportEncryptedBackup(
    passphrase: string,
    nowMs = Date.now(),
  ): KeyPoolBackupEnvelope {
    const keys: KeyPoolBackupKeyEntry[] = [];
    for (const rec of this.state.keys) {
      const rawKey = this.rawKeysById.get(rec.id);
      if (!rawKey || !isValidGeminiApiKey(rawKey)) continue;
      keys.push({
        rawKey,
        label: rec.label,
        detectedProjectNumber: rec.detectedProjectNumber ?? null,
      });
    }

    return encryptPoolBackup(
      {
        keys,
        modelConfig: {
          defaultModel: this.state.modelConfig.defaultModel,
          fallbackModel: this.state.modelConfig.fallbackModel,
          supportedModels: [...this.state.modelConfig.supportedModels],
          profiles: this.mergeProfiles(this.state.modelConfig.profiles),
        },
      },
      passphrase,
      nowMs,
    );
  }

  public importEncryptedBackup(
    rawEnvelope: unknown,
    passphrase: string,
    nowMs = Date.now(),
  ): KeyPoolBackupImportResult {
    const payload = decryptPoolBackup(rawEnvelope, passphrase);

    const existingFingerprints = new Set(this.state.keys.map((k) => k.fingerprint));
    let importedCount = 0;
    let skippedDuplicate = 0;
    let invalid = 0;
    let truncated = 0;

    for (const item of payload.keys) {
      const rawKey = typeof item?.rawKey === 'string' ? item.rawKey.trim() : '';
      if (!rawKey || !isValidGeminiApiKey(rawKey)) {
        invalid += 1;
        continue;
      }

      const fp = computeKeyFingerprint(rawKey);
      if (existingFingerprints.has(fp)) {
        skippedDuplicate += 1;
        continue;
      }

      if (this.state.keys.length >= MAX_KEYS_IN_POOL) {
        truncated += 1;
        continue;
      }

      const cleanLabel =
        typeof item.label === 'string' && item.label.trim().length > 0
          ? item.label.trim().slice(0, 64)
          : `Khóa khôi phục ${importedCount + 1}`;
      const cleanProject =
        typeof item.detectedProjectNumber === 'string' && item.detectedProjectNumber.trim().length > 0
          ? item.detectedProjectNumber.trim().slice(0, 64)
          : null;

      const record = this.store.createKeyRecord({
        rawKey,
        label: cleanLabel,
        source: 'user_import',
        now: nowMs,
      });
      record.detectedProjectNumber = cleanProject;

      this.state.keys.push(record);
      this.rawKeysById.set(record.id, rawKey);
      existingFingerprints.add(fp);
      importedCount += 1;

      this.allocator.appendLog({
        timestamp: nowMs,
        keyId: record.id,
        maskedKey: record.maskedKey,
        fromStatus: 'ready',
        toStatus: 'ready',
        reason: 'BACKUP_IMPORTED (score=100)',
      });
    }

    let modelConfigApplied = false;
    const incomingMc = payload.modelConfig;
    if (incomingMc && typeof incomingMc === 'object') {
      const nextDefault =
        typeof incomingMc.defaultModel === 'string' &&
        isSupportedGemini35Plus(incomingMc.defaultModel.trim())
          ? incomingMc.defaultModel.trim()
          : this.state.modelConfig.defaultModel;
      const nextFallback =
        typeof incomingMc.fallbackModel === 'string' &&
        isSupportedGemini35Plus(incomingMc.fallbackModel.trim())
          ? incomingMc.fallbackModel.trim()
          : this.state.modelConfig.fallbackModel;

      const supported = new Set<string>([
        ...DEFAULT_SUPPORTED_MODELS,
        ...this.state.modelConfig.supportedModels,
        nextDefault,
        nextFallback,
      ]);
      if (Array.isArray(incomingMc.supportedModels)) {
        for (const m of incomingMc.supportedModels) {
          if (typeof m === 'string') {
            const clean = m.trim();
            if (clean && isSupportedGemini35Plus(clean)) {
              supported.add(clean);
            }
          }
        }
      }

      const mergedProfiles = this.mergeProfiles(
        this.state.modelConfig.profiles,
        incomingMc.profiles,
      );

      this.state.modelConfig = {
        defaultModel: nextDefault,
        fallbackModel: nextFallback,
        supportedModels: Array.from(supported),
        profiles: mergedProfiles,
      };
      modelConfigApplied = true;
    }

    if (importedCount > 0 || modelConfigApplied) {
      this.scheduleSave(true);
    }

    return {
      importedCount,
      skippedDuplicate,
      invalid,
      truncated,
      totalAfter: this.state.keys.length,
      modelConfigApplied,
    };
  }

  // Hỗ trợ kiểm thử tự động trong verify-key-pool.ts
  public _getAllocatorForVerification(): KeyAllocator {
    return this.allocator;
  }

  public _getRawKeyIdsForVerification(): string[] {
    return this.state.keys.map((k) => k.id);
  }

  public _findKeyRecord(keyId: string) {
    return this.state.keys.find((k) => k.id === keyId);
  }

  public _addRawKeyForVerification(rawKey: string, label: string): string {
    const record = this.store.createKeyRecord({
      rawKey,
      label,
      source: 'user_import',
    });
    this.state.keys.push(record);
    this.rawKeysById.set(record.id, rawKey);
    return record.id;
  }
}

export const keyPoolManager = new KeyPoolManager();
export { isValidGeminiApiKey, PoolExhaustedError, TpmGuardSkipError };
