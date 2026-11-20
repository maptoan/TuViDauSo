import crypto from 'crypto';
import {
  DEFAULT_SUPPORTED_MODELS,
  type GeminiKeyPublicView,
  type KeyPoolPublicSnapshot,
  type KeyPoolState,
  MAX_KEYS_IN_POOL,
  MAX_PREVIEW_SESSIONS,
  PREVIEW_SESSION_TTL_MS,
  type PreviewResult,
  type PreviewSessionEntry,
  type StreamExecutionMeta,
  TEST_KEY_DEBOUNCE_MS,
  TEST_KEY_TIMEOUT_MS,
} from './types.ts';
import { computeKeyFingerprint, isValidGeminiApiKey, parseBatchKeys } from './parser.ts';
import { KeyPoolCryptoStore } from './crypto-store.ts';
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
      modelConfig: { ...this.state.modelConfig },
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
    customClientFactory?: AiClientFactory,
  ): Promise<{
    ok: boolean;
    latencyMs: number;
    modelUsed: string;
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

    const modelToTest = this.state.modelConfig.defaultModel;
    const factory = customClientFactory ?? defaultAiClientFactory;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('TEST_KEY_TIMEOUT')), TEST_KEY_TIMEOUT_MS);
    const startMs = Date.now();

    try {
      const client = factory(rawKey);
      const res = await client.models.generateContent({
        model: modelToTest,
        contents: 'Trả lời đúng 1 từ: OK',
        config: {
          maxOutputTokens: 8,
          abortSignal: controller.signal,
        },
      });
      const latencyMs = Math.max(1, Date.now() - startMs);
      if (!res || typeof res.text !== 'string') {
        throw new Error('AI_EMPTY_RESPONSE');
      }
      this.allocator.recordManualTestResult(keyId, true, latencyMs, undefined, Date.now());
      return {
        ok: true,
        latencyMs,
        modelUsed: modelToTest,
        status: key.status,
        healthScore: key.healthScore,
        detectedProjectNumber: key.detectedProjectNumber,
      };
    } catch (err) {
      const latencyMs = Math.max(1, Date.now() - startMs);
      const classified = classifyGeminiError(err, this.rawKeysById.values());
      this.allocator.recordManualTestResult(keyId, false, latencyMs, classified, Date.now());
      return {
        ok: false,
        latencyMs,
        modelUsed: modelToTest,
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
  }) {
    const defaultModel = input.defaultModel?.trim();
    const fallbackModel = input.fallbackModel?.trim();

    if (!defaultModel || !isSupportedGemini35Plus(defaultModel)) {
      throw new Error(
        `Model mặc định "${defaultModel}" không hợp lệ. Chỉ hỗ trợ các model Gemini từ 3.5 trở lên.`,
      );
    }
    if (!fallbackModel || !isSupportedGemini35Plus(fallbackModel)) {
      throw new Error(
        `Model dự phòng "${fallbackModel}" không hợp lệ. Chỉ hỗ trợ các model Gemini từ 3.5 trở lên.`,
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

    this.state.modelConfig = {
      defaultModel,
      fallbackModel,
      supportedModels: Array.from(supported),
    };
    this.scheduleSave(true);
    return { ...this.state.modelConfig };
  }

  public executeStream(options: ExecuteStreamOptions): Promise<StreamExecutionMeta> {
    return this.executor.executeStream(options);
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
export { isValidGeminiApiKey };
