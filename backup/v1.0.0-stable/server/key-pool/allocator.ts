import {
  GeminiKeyRecord,
  KeyErrorCategory,
  KeyLease,
  KeyPoolLogEntry,
  KeyPoolState,
  KeyStatus,
  LEASE_ABSOLUTE_MAX_TTL_MS,
  LEASE_MAX_TTL_MS,
  MAX_RECENT_LOGS,
} from './types.ts';

const GEMINI_35_PLUS_REGEX =
  /^gemini-(?:3\.[5-9]|[4-9](?:\.\d+)?|[1-9]\d+(?:\.\d+)?)-[a-z0-9.-]+$/i;

export function isSupportedGemini35Plus(modelName: string): boolean {
  return GEMINI_35_PLUS_REGEX.test(modelName.trim());
}

function collectErrorText(raw: unknown, depth = 0, visited = new Set<unknown>()): string {
  if (raw === null || raw === undefined || depth > 4) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  if (visited.has(raw)) return '';
  visited.add(raw);

  if (raw instanceof Error) {
    const parts: string[] = [`${raw.name}: ${raw.message}`];
    const anyErr = raw as Error & { status?: unknown; code?: unknown; cause?: unknown; details?: unknown };
    if (anyErr.status !== undefined) parts.push(`status=${String(anyErr.status)}`);
    if (anyErr.code !== undefined) parts.push(`code=${String(anyErr.code)}`);
    if (raw.stack) parts.push(raw.stack);
    if (anyErr.cause) parts.push(`cause=${collectErrorText(anyErr.cause, depth + 1, visited)}`);
    if (anyErr.details) parts.push(`details=${collectErrorText(anyErr.details, depth + 1, visited)}`);
    return parts.join(' | ');
  }

  try {
    return JSON.stringify(raw);
  } catch {
    return String(raw);
  }
}

export function sanitizeSecretText(raw: unknown, rawKeys: Iterable<string>): string {
  let text = collectErrorText(raw) || 'Unknown error';
  for (const key of rawKeys) {
    if (key && key.length > 6 && text.includes(key)) {
      text = text.split(key).join('[REDACTED_KEY]');
    }
  }
  text = text.replace(/AIza[0-9A-Za-z_-]{20,50}/g, 'AIza••••[REDACTED]');
  return text;
}

export interface ClassifiedGeminiError {
  category: KeyErrorCategory;
  projectNumber: string | null;
  retryDelaySec: number | null;
  sanitizedSummary: string;
}

export function classifyGeminiError(
  err: unknown,
  rawKeys: Iterable<string> = [],
): ClassifiedGeminiError {
  const sanitizedFull = sanitizeSecretText(err, rawKeys);
  const normalizedText = sanitizedFull
    .replace(/\\+"/g, '"')
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ');
  const summary = normalizedText.slice(0, 420);

  const projectMatch = normalizedText.match(/project(?:s\/|_number[:\s"]+)(\d{6,20})/i);
  const projectNumber = projectMatch?.[1] ?? null;

  const retryJsonMatch = normalizedText.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i);
  const retryTextMatch = normalizedText.match(/retry(?:\s+after|\s+in)?\s+(\d+(?:\.\d+)?)s/i);
  const retryDelayRaw = retryJsonMatch?.[1] ?? retryTextMatch?.[1];
  const retryDelaySec = retryDelayRaw ? Number(retryDelayRaw) : null;

  const anyErr = err as { status?: unknown; code?: unknown } | undefined;
  const numericStatus =
    typeof anyErr?.status === 'number'
      ? anyErr.status
      : typeof anyErr?.code === 'number'
        ? anyErr.code
        : null;

  // 1. Lỗi xác thực key (401 / 403 / Key bị thu hồi / hết hạn) -> vô hiệu hẳn
  if (
    numericStatus === 401 ||
    numericStatus === 403 ||
    /\b(?:401|403)\b/.test(normalizedText) ||
    /API_KEY_INVALID|API key not valid|PERMISSION_DENIED|reported as leaked|API key expired/i.test(
      normalizedText,
    )
  ) {
    return {
      category: 'AUTH_INVALID_KEY',
      projectNumber,
      retryDelaySec,
      sanitizedSummary: summary,
    };
  }

  // 2. Lỗi cấp model (404 not found / not supported, hoặc 503 UNAVAILABLE / high demand / overloaded) -> fallback model, không phạt key
  if (
    numericStatus === 404 ||
    /models\/[a-z0-9.-]+\s+is not found|not supported for generateContent|model is overloaded|currently unavailable|high demand|got status:\s*UNAVAILABLE|"status"\s*:\s*"UNAVAILABLE"|overloaded/i.test(
      normalizedText,
    )
  ) {
    return {
      category: 'MODEL_UNAVAILABLE',
      projectNumber,
      retryDelaySec,
      sanitizedSummary: summary,
    };
  }

  // 3. Lỗi 429 Quota / Rate limit
  if (
    numericStatus === 429 ||
    /\b429\b|RESOURCE_EXHAUSTED|RATE_LIMIT_EXCEEDED|Too Many Requests|quota/i.test(normalizedText)
  ) {
    // Kiểm tra đặc hiệu quota_limit_value = "0"
    if (/"?quota_limit_value"?\s*[:=]\s*["']?0\b/i.test(normalizedText)) {
      return {
        category: 'QUOTA_PROJECT_ZERO',
        projectNumber,
        retryDelaySec,
        sanitizedSummary: summary,
      };
    }

    // Kiểm tra giới hạn ngày (RPD)
    if (/PerDay|RequestsPerDay|\bRPD\b|daily quota|per day/i.test(normalizedText)) {
      return {
        category: 'QUOTA_DAILY_EXHAUSTED',
        projectNumber,
        retryDelaySec,
        sanitizedSummary: summary,
      };
    }

    return {
      category: 'RATE_LIMIT_RPM',
      projectNumber,
      retryDelaySec,
      sanitizedSummary: summary,
    };
  }

  // 4. Lỗi 5xx hoặc mạng / timeout
  if (
    (numericStatus !== null && numericStatus >= 500 && numericStatus < 600) ||
    /\b(?:500|502|503|504)\b|ECONNRESET|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|fetch failed|TimeoutError|AbortError|FIRST_CHUNK_TIMEOUT/i.test(
      normalizedText,
    )
  ) {
    return {
      category: 'NETWORK_OR_5XX',
      projectNumber,
      retryDelaySec,
      sanitizedSummary: summary,
    };
  }

  return {
    category: 'UNKNOWN',
    projectNumber,
    retryDelaySec,
    sanitizedSummary: summary,
  };
}

export function formatHumanReadableErrorVi(
  classified: ClassifiedGeminiError | null,
  minRemainingCooldownSec?: number | null,
): string {
  const projSuffix = classified?.projectNumber ? ` (Project #${classified.projectNumber})` : '';
  const waitSuffix =
    typeof minRemainingCooldownSec === 'number' && minRemainingCooldownSec > 0
      ? ` Khóa kế tiếp sẵn sàng sau khoảng ${minRemainingCooldownSec} giây.`
      : '';

  switch (classified?.category) {
    case 'RATE_LIMIT_RPM':
      return `Chạm giới hạn tần suất gọi mỗi phút (429 RPM)${projSuffix}.${waitSuffix}`.trim();
    case 'QUOTA_PROJECT_ZERO':
      return `Google Cloud Project${projSuffix} hiện có hạn mức Gemini = 0 tại vùng triển khai (429 RESOURCE_EXHAUSTED).${waitSuffix}`.trim();
    case 'QUOTA_DAILY_EXHAUSTED':
      return `Đã sử dụng hết hạn mức yêu cầu trong ngày (429 RPD)${projSuffix}.${waitSuffix}`.trim();
    case 'AUTH_INVALID_KEY':
      return 'Khóa Gemini API không hợp lệ, đã hết hạn hoặc bị thu hồi quyền (401/403).';
    case 'MODEL_UNAVAILABLE':
      return `Model Gemini đang quá tải hoặc tạm thời không khả dụng (503/404).${waitSuffix}`.trim();
    case 'NETWORK_OR_5XX':
      return `Kết nối tới Gemini API bị gián đoạn hoặc phản hồi chậm (5xx/Timeout).${waitSuffix}`.trim();
    default:
      return classified?.sanitizedSummary
        ? `Không thể hoàn tất yêu cầu tới Gemini API: ${classified.sanitizedSummary.slice(0, 220)}`
        : 'Tất cả khóa Gemini trong kho hiện không khả dụng.';
  }
}

function applyJitter(ms: number, factor = 0.15): number {
  const multiplier = 1 - factor + Math.random() * (factor * 2);
  return Math.max(1000, Math.round(ms * multiplier));
}

export function computeMsUntilNextPTMidnightPlus5Min(now: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(now));

  const getPart = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const hour = getPart('hour') % 24;
  const minute = getPart('minute');
  const second = getPart('second');

  const elapsedSecTodayPT = hour * 3600 + minute * 60 + second;
  const targetSecPT = 24 * 3600 + 5 * 60; // 00:05 ngày kế tiếp theo giờ PT
  let remainingMs = (targetSecPT - elapsedSecTodayPT) * 1000;
  if (remainingMs < 15 * 60_000) {
    remainingMs += 24 * 3600 * 1000;
  }
  const minMs = 15 * 60_000;
  const maxMs = 12 * 3600 * 1000;
  return Math.min(maxMs, Math.max(minMs, remainingMs));
}

export function computeCooldownDurationMs(
  category: KeyErrorCategory,
  consecutiveErrors: number,
  retryDelaySec: number | null,
  now = Date.now(),
  disableJitter = false,
): number | null {
  switch (category) {
    case 'RATE_LIMIT_RPM': {
      if (retryDelaySec !== null && Number.isFinite(retryDelaySec)) {
        const clampedSec = Math.min(60, Math.max(5, Math.ceil(retryDelaySec) + 2));
        return clampedSec * 1000;
      }
      const ladderSec = [10, 20, 30][Math.min(Math.max(0, consecutiveErrors - 1), 2)];
      const baseMs = ladderSec * 1000;
      return disableJitter ? baseMs : applyJitter(baseMs, 0.15);
    }
    case 'QUOTA_PROJECT_ZERO':
      return 6 * 3600 * 1000; // 6 giờ (21.600 giây) theo QĐ-3 Phương án A
    case 'QUOTA_DAILY_EXHAUSTED': {
      const untilReset = computeMsUntilNextPTMidnightPlus5Min(now);
      const jitterMs = disableJitter ? 0 : Math.floor(Math.random() * 120_000);
      return Math.min(12 * 3600 * 1000, untilReset + jitterMs);
    }
    case 'NETWORK_OR_5XX':
    case 'UNKNOWN': {
      const baseMs = 30_000;
      return disableJitter ? baseMs : applyJitter(baseMs, 0.15);
    }
    case 'AUTH_INVALID_KEY':
    case 'MODEL_UNAVAILABLE':
    case 'NONE':
      return null;
  }
}

export class KeyAllocator {
  private readonly inFlightCounts = new Map<string, number>();
  private readonly leaseTimers = new Map<string, number[]>();

  constructor(
    private readonly getState: () => KeyPoolState,
    private readonly getRawKeysById: () => Map<string, string>,
    private readonly onStateMutated: (immediatePersist: boolean) => void,
  ) {}

  public getInFlightCount(keyId: string): number {
    return this.inFlightCounts.get(keyId) ?? 0;
  }

  public appendLog(entry: KeyPoolLogEntry): void {
    const state = this.getState();
    state.recentLogs.push(entry);
    if (state.recentLogs.length > MAX_RECENT_LOGS) {
      state.recentLogs.splice(0, state.recentLogs.length - MAX_RECENT_LOGS);
    }
    const cdInfo =
      entry.cooldownSeconds !== undefined ? ` cooldownSec=${entry.cooldownSeconds}` : '';
    console.log(
      `[KeyPool][${new Date(entry.timestamp).toISOString()}] key=${entry.keyId} (${entry.maskedKey}) transition=${entry.fromStatus}->${entry.toStatus} reason=${entry.reason}${cdInfo}`,
    );
  }

  public isModelCoolingDown(key: GeminiKeyRecord, modelName: string, now = Date.now()): boolean {
    const expiry = key.modelCooldowns?.[modelName];
    return typeof expiry === 'number' && expiry > now;
  }

  public getUsableModelsForKey(
    key: GeminiKeyRecord,
    defaultModel: string,
    fallbackModel?: string,
    attemptedPairs?: Set<string>,
    now = Date.now(),
  ): string[] {
    const models = [defaultModel];
    if (fallbackModel && fallbackModel !== defaultModel) {
      models.push(fallbackModel);
    }
    return models.filter((m) => {
      if (attemptedPairs?.has(`${key.id}::${m}`)) return false;
      if (this.isModelCoolingDown(key, m, now)) return false;
      return true;
    });
  }

  public getMinRemainingCooldownSec(now = Date.now()): number | null {
    const state = this.getState();
    const candidates: number[] = [];
    for (const k of state.keys) {
      if (k.status === 'cooldown' && k.cooldownUntil !== null) {
        candidates.push(Math.max(1, Math.ceil((k.cooldownUntil - now) / 1000)));
      }
      if (k.modelCooldowns) {
        for (const exp of Object.values(k.modelCooldowns)) {
          if (typeof exp === 'number' && exp > now) {
            candidates.push(Math.max(1, Math.ceil((exp - now) / 1000)));
          }
        }
      }
    }
    return candidates.length > 0 ? Math.min(...candidates) : null;
  }

  public sweep(now = Date.now()): boolean {
    const state = this.getState();
    let changed = false;

    for (const key of state.keys) {
      // 0. Dọn dẹp modelCooldowns đã hết hạn
      if (key.modelCooldowns) {
        for (const [modelName, expiry] of Object.entries(key.modelCooldowns)) {
          if (typeof expiry !== 'number' || now >= expiry) {
            delete key.modelCooldowns[modelName];
            changed = true;
          }
        }
      }

      // 1. Giải phóng key đã hết thời gian cool down
      if (key.status === 'cooldown' && key.cooldownUntil !== null && now >= key.cooldownUntil) {
        const prevStatus = key.status;
        key.status = 'ready';
        key.pendingProbe = true;
        key.cooldownUntil = null;
        key.modelCooldowns = {};
        key.updatedAt = now;
        changed = true;
        this.appendLog({
          timestamp: now,
          keyId: key.id,
          maskedKey: key.maskedKey,
          fromStatus: prevStatus,
          toStatus: 'ready',
          reason: 'COOLDOWN_EXPIRED_AWAITING_PROBE',
        });
      }

      // 2. Hồi phục điểm thụ động (+5 điểm mỗi 10 phút khi đang ready & không bị lỗi mới)
      if (key.status === 'ready' && !key.pendingProbe && key.healthScore < 95) {
        const recoveryStepMs = 10 * 60_000;
        const elapsed = now - (key.lastScoreRecoveryAt || key.updatedAt || now);
        if (elapsed >= recoveryStepMs) {
          const steps = Math.floor(elapsed / recoveryStepMs);
          const nextScore = Math.min(95, key.healthScore + steps * 5);
          if (nextScore > key.healthScore) {
            key.healthScore = nextScore;
            key.lastScoreRecoveryAt = now;
            key.updatedAt = now;
            changed = true;
          }
        }
      }
    }

    if (changed) {
      this.onStateMutated(false);
    }
    return changed;
  }

  public acquireLease(
    excludedKeyIds: Set<string>,
    excludedProjectNumbers: Set<string>,
    now = Date.now(),
    options?: {
      defaultModel?: string;
      fallbackModel?: string;
      attemptedPairs?: Set<string>;
    },
  ): KeyLease | null {
    this.sweep(now);
    const state = this.getState();
    const rawKeysById = this.getRawKeysById();
    const defaultModel = options?.defaultModel;
    const fallbackModel = options?.fallbackModel;
    const attemptedPairs = options?.attemptedPairs;

    const candidates = state.keys.filter((key) => {
      if (key.status !== 'ready') return false;
      if (excludedKeyIds.has(key.id)) return false;
      if (key.detectedProjectNumber && excludedProjectNumbers.has(key.detectedProjectNumber)) {
        return false;
      }
      const inFlight = this.getInFlightCount(key.id);
      // Nếu key đang chờ probe sau cooldown và đã có request khác đang probe nó, tạm nhường
      if (key.pendingProbe && inFlight > 0) return false;
      if (!rawKeysById.has(key.id)) return false;
      if (defaultModel) {
        const usable = this.getUsableModelsForKey(key, defaultModel, fallbackModel, attemptedPairs, now);
        if (usable.length === 0) return false;
      }
      return true;
    });

    if (candidates.length === 0) return null;

    // Tính effectiveScore và bậc sức khỏe (mỗi bậc rộng 5 điểm):
    // - probeFloorScore = 95 để key vừa hết cooldown không bị bỏ đói dưới bóng key 100đ
    // - latencyPenalty bước mịn 250ms (trần 10đ)
    // - ưu tiên nhẹ (+8đ) cho key vẫn chạy được defaultModel so với key chỉ còn fallbackModel
    const scored = candidates.map((key) => {
      const baseScore = key.pendingProbe ? Math.max(key.healthScore, 95) : key.healthScore;
      const latencyPenalty = key.stats.avgLatencyMs
        ? Math.min(10, Math.floor(key.stats.avgLatencyMs / 250))
        : 0;
      const inFlightPenalty = this.getInFlightCount(key.id) * 6;
      const defaultModelAvailable = defaultModel
        ? !this.isModelCoolingDown(key, defaultModel, now) && !attemptedPairs?.has(`${key.id}::${defaultModel}`)
        : true;
      const modelBonus = defaultModel && defaultModelAvailable ? 8 : 0;
      const effectiveScore = Math.max(0, baseScore + modelBonus - latencyPenalty - inFlightPenalty);
      const healthTier = Math.floor(effectiveScore / 5);
      return { key, effectiveScore, healthTier };
    });

    const maxTier = Math.max(...scored.map((s) => s.healthTier));
    const topTierIds = new Set(scored.filter((s) => s.healthTier === maxTier).map((s) => s.key.id));

    // Chọn theo con trỏ vòng tròn roundRobinCursor trong nhóm topTier
    const total = state.keys.length;
    const startCursor = total > 0 ? state.roundRobinCursor % total : 0;
    let chosenIndex = -1;
    for (let offset = 0; offset < total; offset++) {
      const idx = (startCursor + offset) % total;
      if (topTierIds.has(state.keys[idx].id)) {
        chosenIndex = idx;
        break;
      }
    }

    if (chosenIndex === -1) return null;

    const chosen = state.keys[chosenIndex];
    state.roundRobinCursor = (chosenIndex + 1) % total;
    chosen.stats.lastUsedAt = now;
    chosen.updatedAt = now;
    this.onStateMutated(false);

    const currentInFlight = this.getInFlightCount(chosen.id);
    this.inFlightCounts.set(chosen.id, currentInFlight + 1);

    let released = false;
    let ttlTimer: ReturnType<typeof setTimeout> | null = null;
    const realLeaseStartMs = Date.now();

    const release = () => {
      if (released) return;
      released = true;
      const cur = this.getInFlightCount(chosen.id);
      if (cur <= 1) {
        this.inFlightCounts.delete(chosen.id);
      } else {
        this.inFlightCounts.set(chosen.id, cur - 1);
      }
      if (ttlTimer) {
        clearTimeout(ttlTimer);
        ttlTimer = null;
      }
    };

    const scheduleTtl = () => {
      if (released) return;
      const elapsedReal = Date.now() - realLeaseStartMs;
      const remainingCap = LEASE_ABSOLUTE_MAX_TTL_MS - elapsedReal;
      if (remainingCap <= 0) {
        release();
        return;
      }
      const nextTtlMs = Math.min(LEASE_MAX_TTL_MS, remainingCap);
      if (ttlTimer) {
        clearTimeout(ttlTimer);
      }
      ttlTimer = setTimeout(() => {
        release();
      }, nextTtlMs);
      if (typeof ttlTimer.unref === 'function') {
        ttlTimer.unref();
      }
    };

    scheduleTtl();

    return {
      keyId: chosen.id,
      maskedKey: chosen.maskedKey,
      label: chosen.label,
      rawKey: rawKeysById.get(chosen.id)!,
      isProbe: chosen.pendingProbe,
      detectedProjectNumber: chosen.detectedProjectNumber,
      heartbeat: scheduleTtl,
      release,
    };
  }

  public recordSuccess(
    keyId: string,
    ttfbLatencyMs: number,
    now = Date.now(),
    modelUsed?: string,
  ): void {
    const state = this.getState();
    const key = state.keys.find((k) => k.id === keyId);
    if (!key) return;

    const prevStatus = key.status;
    const wasProbe = key.pendingProbe;

    key.stats.totalCalls += 1;
    key.stats.successCalls += 1;
    key.stats.lastSuccessAt = now;
    key.stats.avgLatencyMs =
      key.stats.avgLatencyMs === null
        ? Math.round(ttfbLatencyMs)
        : Math.round(key.stats.avgLatencyMs * 0.7 + ttfbLatencyMs * 0.3);

    key.consecutiveErrors = 0;
    key.cooldownUntil = null;
    key.cooldownReason = 'NONE';
    key.pendingProbe = false;
    key.status = 'ready';
    if (modelUsed && key.modelCooldowns?.[modelUsed]) {
      delete key.modelCooldowns[modelUsed];
    }
    key.lastScoreRecoveryAt = now;
    key.updatedAt = now;

    if (wasProbe) {
      key.healthScore = Math.min(100, Math.max(70, key.healthScore + 25));
      this.appendLog({
        timestamp: now,
        keyId: key.id,
        maskedKey: key.maskedKey,
        fromStatus: prevStatus,
        toStatus: 'ready',
        reason: `PROBE_SUCCESS (score=${key.healthScore}, ttfb=${Math.round(ttfbLatencyMs)}ms)`,
      });
    } else {
      key.healthScore = Math.min(100, key.healthScore + 5);
      this.appendLog({
        timestamp: now,
        keyId: key.id,
        maskedKey: key.maskedKey,
        fromStatus: prevStatus,
        toStatus: 'ready',
        reason: `CALL_SUCCESS (${modelUsed ? `model=${modelUsed}, ` : ''}health=${key.healthScore}, ttfb=${Math.round(ttfbLatencyMs)}ms)`,
      });
    }

    this.onStateMutated(false);
  }

  public recordModelIssue(
    keyId: string,
    modelName: string,
    classified: ClassifiedGeminiError,
    now = Date.now(),
    disableJitter = false,
    defaultModel?: string,
    fallbackModel?: string,
  ): { keyEscalatedToCooldown: boolean } {
    const state = this.getState();
    const key = state.keys.find((k) => k.id === keyId);
    if (!key) return { keyEscalatedToCooldown: false };

    if (!key.modelCooldowns) {
      key.modelCooldowns = {};
    }

    if (classified.category === 'MODEL_UNAVAILABLE') {
      key.stats.totalCalls += 1;
      key.stats.errorCalls += 1;
      key.stats.lastErrorType = 'MODEL_UNAVAILABLE';
      key.stats.lastErrorMessage = classified.sanitizedSummary;
      key.stats.lastErrorAt = now;
      key.updatedAt = now;
      if (classified.projectNumber) {
        key.detectedProjectNumber = classified.projectNumber;
      }
      key.modelCooldowns[modelName] = now + 15_000;
      this.appendLog({
        timestamp: now,
        keyId: key.id,
        maskedKey: key.maskedKey,
        fromStatus: key.status,
        toStatus: key.status,
        reason: `MODEL_UNAVAILABLE (${modelName}, 15s model-cooldown, no key penalty)`,
      });
      this.onStateMutated(false);
      return { keyEscalatedToCooldown: false };
    }

    if (classified.category === 'RATE_LIMIT_RPM') {
      const cooldownMs =
        computeCooldownDurationMs(
          'RATE_LIMIT_RPM',
          key.consecutiveErrors + 1,
          classified.retryDelaySec,
          now,
          disableJitter,
        ) ?? 15_000;
      const expiry = now + cooldownMs;
      key.modelCooldowns[modelName] = expiry;
      if (classified.projectNumber) {
        key.detectedProjectNumber = classified.projectNumber;
        for (const peer of state.keys) {
          if (peer.id === key.id) continue;
          if (peer.detectedProjectNumber === classified.projectNumber) {
            if (!peer.modelCooldowns) peer.modelCooldowns = {};
            peer.modelCooldowns[modelName] = expiry;
          }
        }
      }

      const dModel = defaultModel || state.modelConfig.defaultModel;
      const fModel = fallbackModel ?? state.modelConfig.fallbackModel;
      const remainingUsable = this.getUsableModelsForKey(key, dModel, fModel, undefined, now);

      if (remainingUsable.length === 0) {
        this.recordFailure(keyId, classified, now, disableJitter);
        return { keyEscalatedToCooldown: true };
      }

      key.stats.totalCalls += 1;
      key.stats.errorCalls += 1;
      key.stats.lastErrorType = 'RATE_LIMIT_RPM';
      key.stats.lastErrorMessage = classified.sanitizedSummary;
      key.stats.lastErrorAt = now;
      key.updatedAt = now;
      this.appendLog({
        timestamp: now,
        keyId: key.id,
        maskedKey: key.maskedKey,
        fromStatus: key.status,
        toStatus: key.status,
        reason: `MODEL_RPM_COOLDOWN (${modelName}, fallback=${remainingUsable[0]} ready)`,
        cooldownSeconds: Math.round(cooldownMs / 1000),
      });
      this.onStateMutated(false);
      return { keyEscalatedToCooldown: false };
    }

    this.recordFailure(keyId, classified, now, disableJitter);
    return { keyEscalatedToCooldown: key.status !== 'ready' };
  }

  public recordFailure(
    keyId: string,
    classified: ClassifiedGeminiError,
    now = Date.now(),
    disableJitter = false,
  ): void {
    const state = this.getState();
    const key = state.keys.find((k) => k.id === keyId);
    if (!key) return;

    key.stats.totalCalls += 1;
    key.stats.errorCalls += 1;
    key.stats.lastErrorType = classified.category;
    key.stats.lastErrorMessage = classified.sanitizedSummary;
    key.stats.lastErrorAt = now;
    key.updatedAt = now;

    if (classified.projectNumber) {
      key.detectedProjectNumber = classified.projectNumber;
    }

    // Lỗi cấp model (404 / 503 model overloaded) -> không phạt key
    if (classified.category === 'MODEL_UNAVAILABLE') {
      this.appendLog({
        timestamp: now,
        keyId: key.id,
        maskedKey: key.maskedKey,
        fromStatus: key.status,
        toStatus: key.status,
        reason: `MODEL_UNAVAILABLE_FALLBACK (${classified.sanitizedSummary.slice(0, 120)})`,
      });
      this.onStateMutated(false);
      return;
    }

    const prevStatus = key.status;
    key.consecutiveErrors += 1;
    key.pendingProbe = false;

    if (classified.category === 'AUTH_INVALID_KEY') {
      key.status = 'disabled';
      key.healthScore = 0;
      key.cooldownUntil = null;
      key.cooldownReason = 'AUTH_INVALID_KEY';
      this.appendLog({
        timestamp: now,
        keyId: key.id,
        maskedKey: key.maskedKey,
        fromStatus: prevStatus,
        toStatus: 'disabled',
        reason: 'AUTH_INVALID_KEY (401/403)',
      });
      this.onStateMutated(true);
      return;
    }

    const cooldownMs = computeCooldownDurationMs(
      classified.category,
      key.consecutiveErrors,
      classified.retryDelaySec,
      now,
      disableJitter,
    );

    const scorePenaltyMap: Record<KeyErrorCategory, number> = {
      NONE: 0,
      MODEL_UNAVAILABLE: 0,
      NETWORK_OR_5XX: 10,
      UNKNOWN: 10,
      RATE_LIMIT_RPM: 15,
      QUOTA_DAILY_EXHAUSTED: 40,
      QUOTA_PROJECT_ZERO: 60,
      AUTH_INVALID_KEY: 100,
    };
    const scoreFloorMap: Record<KeyErrorCategory, number> = {
      NONE: 0,
      MODEL_UNAVAILABLE: 0,
      NETWORK_OR_5XX: 20,
      UNKNOWN: 20,
      RATE_LIMIT_RPM: 15,
      QUOTA_DAILY_EXHAUSTED: 10,
      QUOTA_PROJECT_ZERO: 5,
      AUTH_INVALID_KEY: 0,
    };

    const penalty = scorePenaltyMap[classified.category] ?? 10;
    const floor = scoreFloorMap[classified.category] ?? 10;
    key.healthScore = Math.max(floor, key.healthScore - penalty);
    key.status = 'cooldown';
    key.cooldownUntil = cooldownMs !== null ? now + cooldownMs : now + 30_000;
    key.cooldownReason = classified.category;

    const cooldownSeconds = Math.round(((key.cooldownUntil - now) / 1000));
    this.appendLog({
      timestamp: now,
      keyId: key.id,
      maskedKey: key.maskedKey,
      fromStatus: prevStatus,
      toStatus: 'cooldown',
      reason: `${classified.category}${classified.projectNumber ? ` (project #${classified.projectNumber})` : ''}`,
      cooldownSeconds,
    });

    // Lan truyền cool down tới các key đã biết cùng GCP project_number (E3-01)
    if (
      classified.projectNumber &&
      (classified.category === 'QUOTA_PROJECT_ZERO' ||
        classified.category === 'QUOTA_DAILY_EXHAUSTED' ||
        classified.category === 'RATE_LIMIT_RPM')
    ) {
      for (const peer of state.keys) {
        if (peer.id === key.id) continue;
        if (peer.status === 'disabled') continue;
        if (peer.detectedProjectNumber === classified.projectNumber) {
          const peerPrev = peer.status;
          peer.status = 'cooldown';
          peer.pendingProbe = false;
          peer.cooldownUntil = key.cooldownUntil;
          peer.cooldownReason = classified.category;
          peer.stats.lastErrorType = classified.category;
          peer.stats.lastErrorMessage = `Dùng chung Project #${classified.projectNumber} với ${key.maskedKey}: ${classified.sanitizedSummary}`;
          peer.stats.lastErrorAt = now;
          peer.updatedAt = now;
          this.appendLog({
            timestamp: now,
            keyId: peer.id,
            maskedKey: peer.maskedKey,
            fromStatus: peerPrev,
            toStatus: 'cooldown',
            reason:
              peerPrev === 'cooldown'
                ? `PROJECT_SYNC_COOLDOWN_${classified.category} (project #${classified.projectNumber} từ ${key.maskedKey})`
                : `PROJECT_PROPAGATED_${classified.category} (project #${classified.projectNumber} từ ${key.maskedKey})`,
            cooldownSeconds,
          });
        }
      }
    }

    this.onStateMutated(true);
  }

  public reactivateKey(keyId: string, now = Date.now()): boolean {
    const state = this.getState();
    const key = state.keys.find((k) => k.id === keyId);
    if (!key) return false;

    const prevStatus: KeyStatus = key.status;
    key.status = 'ready';
    key.pendingProbe = true;
    key.cooldownUntil = null;
    key.cooldownReason = 'NONE';
    key.modelCooldowns = {};
    key.consecutiveErrors = 0;
    key.healthScore = Math.max(key.healthScore, 75);
    key.lastScoreRecoveryAt = now;
    key.updatedAt = now;

    this.appendLog({
      timestamp: now,
      keyId: key.id,
      maskedKey: key.maskedKey,
      fromStatus: prevStatus,
      toStatus: 'ready',
      reason: 'MANUAL_REACTIVATE',
    });
    this.onStateMutated(true);
    return true;
  }

  public recordManualTestResult(
    keyId: string,
    ok: boolean,
    latencyMs: number,
    classified?: ClassifiedGeminiError,
    now = Date.now(),
  ): void {
    const state = this.getState();
    const key = state.keys.find((k) => k.id === keyId);
    if (!key) return;

    key.stats.lastTestLatencyMs = Math.round(latencyMs);
    key.stats.lastTestedAt = now;
    key.stats.lastUsedAt = now;

    if (ok) {
      const prevStatus = key.status;
      key.status = 'ready';
      key.pendingProbe = false;
      key.consecutiveErrors = 0;
      key.cooldownUntil = null;
      key.cooldownReason = 'NONE';
      key.modelCooldowns = {};
      key.healthScore = 100;
      key.lastScoreRecoveryAt = now;
      key.updatedAt = now;
      this.appendLog({
        timestamp: now,
        keyId: key.id,
        maskedKey: key.maskedKey,
        fromStatus: prevStatus,
        toStatus: 'ready',
        reason: `MANUAL_TEST_PASSED (${Math.round(latencyMs)}ms)`,
      });
      this.onStateMutated(true);
      return;
    }

    if (classified) {
      this.recordFailure(keyId, classified, now);
    }
  }
}
