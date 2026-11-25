import { GoogleGenAI } from '@google/genai';
import {
  ABSOLUTE_REQUEST_BUDGET_MS,
  FALLBACK_COOLDOWN_WAIT_CAP_MS,
  FALLBACK_LEG_TIME_BUDGET_MS,
  FIRST_CHUNK_TIMEOUT_MS,
  GEMMA_TPM_CHARS_PER_TOKEN_VI,
  GEMMA_TPM_DEFAULT_OUTPUT_ESTIMATE,
  GEMMA_TPM_GUARD_THRESHOLD,
  type KeyErrorCategory,
  type KeyPoolState,
  MAX_FALLBACK_KEY_ATTEMPTS,
  MAX_KEYS_IN_POOL,
  MAX_KEY_ATTEMPTS,
  type ModelThinkingLevel,
  SSE_KEEPALIVE_EARLY_TRIGGER_MS,
  type StreamExecutionMeta,
  type StreamInterruptedEvent,
  TOTAL_FAILOVER_TIME_BUDGET_MS,
} from './types.ts';
import { mergeModelProfiles } from './crypto-store.ts';
import {
  type ClassifiedGeminiError,
  classifyGeminiError,
  formatHumanReadableErrorVi,
  KeyAllocator,
} from './allocator.ts';

const FAST_SWEEP_CATEGORIES = new Set<KeyErrorCategory>([
  'QUOTA_PROJECT_ZERO',
  'QUOTA_DAILY_EXHAUSTED',
  'AUTH_INVALID_KEY',
  'API_NOT_ENABLED',
]);

const POOL_EXHAUSTION_ELIGIBLE_CATEGORIES = new Set<KeyErrorCategory>([
  'QUOTA_PROJECT_ZERO',
  'QUOTA_DAILY_EXHAUSTED',
  'RATE_LIMIT_RPM',
  'AUTH_INVALID_KEY',
  'AUTH_FORBIDDEN_AMBIGUOUS',
  'API_NOT_ENABLED',
  'MODEL_UNAVAILABLE',
  'NETWORK_OR_5XX',
]);

export function isGemmaModel(modelName: string): boolean {
  return /^(?:models\/)?gemma-/i.test(modelName.trim());
}

export function estimateRequestInputTokens(prompt: string, systemInstruction?: string): number {
  const totalChars = (prompt?.length ?? 0) + (systemInstruction?.length ?? 0);
  if (totalChars === 0) return 0;
  return Math.ceil(totalChars / GEMMA_TPM_CHARS_PER_TOKEN_VI);
}

export interface AiStreamChunk {
  text?: string;
  candidates?: Array<{
    finishReason?: string;
  }>;
}

export interface AiClientLike {
  models: {
    generateContentStream(params: {
      model: string;
      contents: string;
      config?: {
        systemInstruction?: string;
        maxOutputTokens?: number;
        thinkingConfig?: {
          thinkingLevel?: ModelThinkingLevel;
        };
        abortSignal?: AbortSignal;
      };
    }): Promise<AsyncIterable<AiStreamChunk>>;
    generateContent(params: {
      model: string;
      contents: string;
      config?: {
        maxOutputTokens?: number;
        thinkingConfig?: {
          thinkingLevel?: ModelThinkingLevel;
        };
        abortSignal?: AbortSignal;
      };
    }): Promise<{ text?: string }>;
  };
}

export type AiClientFactory = (rawKey: string) => AiClientLike;

export function defaultAiClientFactory(rawKey: string): AiClientLike {
  const client = new GoogleGenAI({
    apiKey: rawKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return {
    models: {
      generateContentStream: (params) =>
        client.models.generateContentStream(params as Parameters<typeof client.models.generateContentStream>[0]),
      generateContent: (params) =>
        client.models.generateContent(params as Parameters<typeof client.models.generateContent>[0]),
    },
  };
}

function defaultSleepFn(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new Error('Yêu cầu đã bị hủy bởi người dùng.'));
  }
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Yêu cầu đã bị hủy bởi người dùng.'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export interface ExecuteStreamOptions {
  prompt: string;
  systemInstruction?: string;
  preferredModel?: string;
  maxOutputTokens?: number;
  thinkingConfig?: {
    thinkingLevel?: ModelThinkingLevel;
  };
  onMeta?: (meta: StreamExecutionMeta) => void;
  onChunk: (text: string) => void;
  onInterrupted?: (event: StreamInterruptedEvent) => void;
  onSseKeepAliveRequired?: () => void;
  signal?: AbortSignal;
  clientFactory?: AiClientFactory;
  nowFn?: () => number;
  sleepFn?: (ms: number, signal?: AbortSignal) => Promise<void>;
  disableJitter?: boolean;
  maxContinuations?: number;
}

export type PoolFailureCategory =
  | KeyErrorCategory
  | 'TPM_GUARD_SKIP'
  | 'AI_NOT_CONFIGURED'
  | 'AI_POOL_EXHAUSTED';

export class PoolExhaustedError extends Error {
  public readonly code: 'AI_NOT_CONFIGURED' | 'AI_POOL_EXHAUSTED';
  public readonly minRemainingCooldownSec: number | null;
  public readonly errorCategory: PoolFailureCategory;

  constructor(
    code: 'AI_NOT_CONFIGURED' | 'AI_POOL_EXHAUSTED',
    message: string,
    minRemainingCooldownSec: number | null = null,
    errorCategory?: PoolFailureCategory,
  ) {
    super(message);
    this.name = 'PoolExhaustedError';
    this.code = code;
    this.minRemainingCooldownSec = minRemainingCooldownSec;
    this.errorCategory =
      errorCategory ?? (code === 'AI_NOT_CONFIGURED' ? 'AI_NOT_CONFIGURED' : 'AI_POOL_EXHAUSTED');
  }
}

export class TpmGuardSkipError extends Error {
  public readonly code = 'TPM_GUARD_SKIP' as const;
  public readonly errorCategory = 'TPM_GUARD_SKIP' as const;
  public readonly minRemainingCooldownSec: number | null;

  constructor(message: string, minRemainingCooldownSec: number | null = null) {
    super(message);
    this.name = 'TpmGuardSkipError';
    this.minRemainingCooldownSec = minRemainingCooldownSec;
  }
}

function inferPoolExhaustedCategory(
  keys: KeyPoolState['keys'],
  lastClassified: ClassifiedGeminiError | null,
  minRemainingCooldownSec: number | null,
): PoolFailureCategory {
  if (lastClassified && lastClassified.category !== 'NONE' && lastClassified.category !== 'UNKNOWN') {
    return lastClassified.category;
  }
  if (keys.length === 0) {
    return 'AI_NOT_CONFIGURED';
  }
  if (keys.every((k) => k.status === 'disabled')) {
    const authDisabled = keys.find(
      (k) =>
        k.cooldownReason === 'AUTH_INVALID_KEY' ||
        k.cooldownReason === 'AUTH_FORBIDDEN_REPEATED' ||
        k.stats.lastErrorType === 'AUTH_INVALID_KEY' ||
        k.stats.lastErrorType === 'AUTH_FORBIDDEN_REPEATED',
    );
    return authDisabled?.cooldownReason && authDisabled.cooldownReason !== 'NONE'
      ? authDisabled.cooldownReason
      : authDisabled?.stats.lastErrorType && authDisabled.stats.lastErrorType !== 'NONE'
        ? authDisabled.stats.lastErrorType
        : 'AUTH_INVALID_KEY';
  }
  if (minRemainingCooldownSec !== null) {
    const coolingKey = keys.find(
      (k) => k.status === 'cooldown' && k.cooldownReason !== 'NONE',
    );
    if (coolingKey) return coolingKey.cooldownReason;
    return 'RATE_LIMIT_RPM';
  }
  return 'AI_POOL_EXHAUSTED';
}

const PREV_SEAM_NO_SPACE_RE = /[\s(\[{"'“‘«*]$/u;
const NEXT_SEAM_NO_SPACE_RE = /^[\s.,;:!?%)\]}"'”’»*]/u;

export function normalizeContinuationSeam(prevText: string, nextChunk: string): string {
  if (!prevText || !nextChunk) return nextChunk;
  if (PREV_SEAM_NO_SPACE_RE.test(prevText)) return nextChunk;
  if (NEXT_SEAM_NO_SPACE_RE.test(nextChunk)) return nextChunk;
  return ` ${nextChunk}`;
}

export function buildContinuationPrompt(originalPrompt: string, partialTextSoFar: string): string {
  const tail =
    partialTextSoFar.length > 2600 ? `...${partialTextSoFar.slice(-2600)}` : partialTextSoFar;
  return `${originalPrompt}

=== PHẦN ĐÃ VIẾT TRƯỚC ĐÓ (BỊ NGẮT KẾT NỐI GIỮA CHỪNG) ===
${tail}
=== HẾT PHẦN ĐÃ VIẾT ===

YÊU CẦU VIẾT TIẾP NỐI LIỀN MẠCH (QUAN TRỌNG):
1. Luồng kết nối trước đó vừa bị ngắt đột ngột ngay tại dòng cuối cùng ở trên.
2. Hãy viết tiếp mạch văn đang dở, không lặp lại phần đã có; hệ thống tự xử lý khoảng trắng tại điểm nối nên không cần bắt đầu bằng khoảng trắng. Hoàn thành nốt các đề mục còn thiếu cho đến hết bài (bao gồm cả dòng lưu ý cuối bài nếu chưa viết).
3. TUYỆT ĐỐI KHÔNG lặp lại tiêu đề hoặc bất kỳ câu nào đã có trong [PHẦN ĐÃ VIẾT TRƯỚC ĐÓ]. Không viết câu mở đầu kiểu "Tiếp theo phần trước...".`;
}

export class GeminiStreamExecutor {
  private readonly getState: () => KeyPoolState;
  private readonly getRawKeysById: () => Map<string, string>;
  private readonly allocator: KeyAllocator;

  constructor(
    getState: () => KeyPoolState,
    getRawKeysById: () => Map<string, string>,
    allocator: KeyAllocator,
  ) {
    this.getState = getState;
    this.getRawKeysById = getRawKeysById;
    this.allocator = allocator;
  }

  public async executeStream(options: ExecuteStreamOptions): Promise<StreamExecutionMeta> {
    const nowFn = options.nowFn ?? Date.now;
    const sleepFn = options.sleepFn ?? defaultSleepFn;
    const clientFactory = options.clientFactory ?? defaultAiClientFactory;
    const state = this.getState();
    const requestStartMs = nowFn();

    this.allocator.sweep(requestStartMs);

    if (state.keys.length === 0) {
      throw new PoolExhaustedError(
        'AI_NOT_CONFIGURED',
        'Chưa cấu hình AI (kho khóa hiện chưa có khóa Gemini nào). Hệ thống giữ nguyên Khung dữ kiện xác định và không giả lập văn bản AI.',
        null,
        'AI_NOT_CONFIGURED',
      );
    }

    const mergedProfiles = mergeModelProfiles(state.modelConfig.profiles);
    const defaultModel = options.preferredModel || state.modelConfig.defaultModel;
    const configuredFallbackModel = state.modelConfig.fallbackModel;
    // ĐK-152-10: Vô hiệu hóa H2/H3 khi không có chân dự phòng tách biệt
    const hasDistinctFallback = Boolean(
      configuredFallbackModel &&
        configuredFallbackModel.trim().length > 0 &&
        configuredFallbackModel !== defaultModel &&
        options.preferredModel !== configuredFallbackModel,
    );
    const effectiveFallbackModel = hasDistinctFallback ? configuredFallbackModel : undefined;

    const excludedKeyIds = new Set<string>();
    const excludedProjectNumbers = new Set<string>();
    const attemptedPairs = new Set<string>();
    const tpmSkippedModels = new Set<string>();
    let lastTpmSkipReason: string | null = null;
    const configuredTargets = effectiveFallbackModel
      ? [defaultModel, effectiveFallbackModel]
      : [defaultModel];

    let primaryKeyAttemptsUsed = 0;
    let primaryBudgetUsedMs = 0;
    let fallbackLegStartMs: number | null = null;
    let fallbackKeyAttemptsUsed = 0;
    let fallbackEverActivated = false;
    let fallbackWaitUsed = false;
    let pendingProbeRetried = false;
    let fastEliminatedSweeps = 0;
    let seenFallbackEligibleError = false;
    let totalCallsMade = 0;
    let firstChunkEverSent = false;
    let streamedTextSoFar = '';
    let continuationCount = 0;
    const maxContinuations = options.maxContinuations ?? 2;
    let lastClassifiedError: ClassifiedGeminiError | null = null;
    let lastMeta: StreamExecutionMeta | null = null;
    let earlyKeepAliveFired = false;

    const getAbsRemainingMs = (now: number) => ABSOLUTE_REQUEST_BUDGET_MS - (now - requestStartMs);
    const getFallbackRemainingMs = (now: number) =>
      fallbackLegStartMs === null
        ? FALLBACK_LEG_TIME_BUDGET_MS
        : FALLBACK_LEG_TIME_BUDGET_MS - (now - fallbackLegStartMs);

    const isPureFastSweepBlocked = () =>
      primaryKeyAttemptsUsed === 0 &&
      fallbackKeyAttemptsUsed === 0 &&
      fastEliminatedSweeps > 0 &&
      !firstChunkEverSent;

    const isUnknownOnlyPrimaryBlocked = () =>
      primaryKeyAttemptsUsed >= MAX_KEY_ATTEMPTS &&
      !seenFallbackEligibleError &&
      lastClassifiedError?.category === 'UNKNOWN';

    const isPrimaryLegAvailable = (now: number) =>
      !fallbackWaitUsed &&
      !tpmSkippedModels.has(defaultModel) &&
      primaryKeyAttemptsUsed < MAX_KEY_ATTEMPTS &&
      primaryBudgetUsedMs < TOTAL_FAILOVER_TIME_BUDGET_MS &&
      getAbsRemainingMs(now) > 0;

    const isFallbackLegAvailable = (now: number) =>
      hasDistinctFallback &&
      effectiveFallbackModel !== undefined &&
      !tpmSkippedModels.has(effectiveFallbackModel) &&
      !isPureFastSweepBlocked() &&
      !isUnknownOnlyPrimaryBlocked() &&
      fallbackKeyAttemptsUsed < MAX_FALLBACK_KEY_ATTEMPTS &&
      getFallbackRemainingMs(now) > 0 &&
      getAbsRemainingMs(now) > 0;

    const computeFallbackLatency = (now: number): number | undefined =>
      fallbackEverActivated && fallbackLegStartMs !== null
        ? Math.max(0, now - fallbackLegStartMs)
        : undefined;

    const tryWaitForFallbackCooldown = async (): Promise<boolean> => {
      if (fallbackWaitUsed) return false;
      if (!hasDistinctFallback || !effectiveFallbackModel) return false;
      if (tpmSkippedModels.has(effectiveFallbackModel)) return false;
      if (isPureFastSweepBlocked()) return false;
      if (
        !firstChunkEverSent &&
        primaryKeyAttemptsUsed > 0 &&
        !seenFallbackEligibleError &&
        lastClassifiedError?.category === 'UNKNOWN'
      ) {
        return false;
      }
      if (fallbackKeyAttemptsUsed >= MAX_FALLBACK_KEY_ATTEMPTS) return false;
      if (options.signal?.aborted) {
        throw new Error('Yêu cầu đã bị hủy bởi người dùng.');
      }

      const nowBeforeWait = nowFn();
      const waitInfo = this.allocator.getMinFallbackWaitInfo(
        nowBeforeWait,
        effectiveFallbackModel,
        attemptedPairs,
        excludedProjectNumbers,
      );
      if (!waitInfo) return false;
      if (waitInfo.waitMs > FALLBACK_COOLDOWN_WAIT_CAP_MS) return false;

      const jitterMs = options.disableJitter ? 0 : Math.floor(Math.random() * 501);
      const sleepMs = waitInfo.waitMs + 500 + jitterMs;

      const prospectiveFallbackRemaining =
        fallbackLegStartMs === null
          ? FALLBACK_LEG_TIME_BUDGET_MS
          : FALLBACK_LEG_TIME_BUDGET_MS - (nowBeforeWait - fallbackLegStartMs);
      if (prospectiveFallbackRemaining <= sleepMs) return false;
      if (getAbsRemainingMs(nowBeforeWait) <= sleepMs) return false;

      fallbackWaitUsed = true;
      if (fallbackLegStartMs === null) {
        fallbackLegStartMs = nowBeforeWait;
      }
      fallbackEverActivated = true;
      options.onSseKeepAliveRequired?.();

      await sleepFn(sleepMs, options.signal);
      if (options.signal?.aborted) {
        throw new Error('Yêu cầu đã bị hủy bởi người dùng.');
      }

      const nowAfterSleep = nowFn();
      this.allocator.sweep(nowAfterSleep);

      for (const candidateKeyId of waitInfo.candidateKeyIds) {
        if (attemptedPairs.has(`${candidateKeyId}::${effectiveFallbackModel}`)) continue;
        const rec = state.keys.find((k) => k.id === candidateKeyId);
        if (!rec || rec.status !== 'ready') continue;
        if (this.allocator.isModelCoolingDown(rec, effectiveFallbackModel, nowAfterSleep)) {
          continue;
        }
        excludedKeyIds.delete(candidateKeyId);
      }

      return true;
    };

    const usableReadyCount = state.keys.filter(
      (k) =>
        k.status === 'ready' &&
        this.allocator.getUsableModelsForKey(
          k,
          defaultModel,
          effectiveFallbackModel,
          undefined,
          requestStartMs,
        ).length > 0,
    ).length;

    if (usableReadyCount === 0) {
      const waited = await tryWaitForFallbackCooldown();
      if (!waited) {
        const minSec = this.allocator.getMinRemainingCooldownSec(nowFn());
        const inferredCategory = inferPoolExhaustedCategory(
          state.keys,
          lastClassifiedError,
          minSec,
        );
        throw new PoolExhaustedError(
          'AI_POOL_EXHAUSTED',
          minSec !== null
            ? `Tất cả khóa Gemini trong kho đang trong thời gian chờ nguội (khóa kế tiếp sẵn sàng sau khoảng ${minSec} giây) hoặc đã bị vô hiệu hóa.`
            : 'Tất cả khóa Gemini trong kho hiện đều bị vô hiệu hóa hoặc chưa sẵn sàng.',
          minSec,
          inferredCategory,
        );
      }
    }

    let earlyKeepAliveTimer: ReturnType<typeof setTimeout> | null = options.onSseKeepAliveRequired
      ? setTimeout(() => {
          if (!firstChunkEverSent && !earlyKeepAliveFired) {
            earlyKeepAliveFired = true;
            options.onSseKeepAliveRequired?.();
          }
        }, SSE_KEEPALIVE_EARLY_TRIGGER_MS)
      : null;
    if (earlyKeepAliveTimer && typeof earlyKeepAliveTimer.unref === 'function') {
      earlyKeepAliveTimer.unref();
    }

    try {
      while (fastEliminatedSweeps < MAX_KEYS_IN_POOL) {
        if (options.signal?.aborted) {
          throw new Error('Yêu cầu đã bị hủy bởi người dùng.');
        }

        const loopNow = nowFn();
        if (
          !firstChunkEverSent &&
          !earlyKeepAliveFired &&
          loopNow - requestStartMs > SSE_KEEPALIVE_EARLY_TRIGGER_MS
        ) {
          earlyKeepAliveFired = true;
          options.onSseKeepAliveRequired?.();
        }

        if (!firstChunkEverSent && configuredTargets.every((m) => tpmSkippedModels.has(m))) {
          break;
        }

        const primaryAvail = isPrimaryLegAvailable(loopNow);
        const fallbackAvail = isFallbackLegAvailable(loopNow);
        if (!primaryAvail && !fallbackAvail) {
          break;
        }

        const acquirePrimaryModel = primaryAvail ? defaultModel : effectiveFallbackModel!;
        const acquireFallbackModel =
          primaryAvail && fallbackAvail ? effectiveFallbackModel : undefined;

        const lease = this.allocator.acquireLease(
          excludedKeyIds,
          excludedProjectNumbers,
          loopNow,
          {
            defaultModel: acquirePrimaryModel,
            fallbackModel: acquireFallbackModel,
            attemptedPairs,
          },
        );

        if (!lease) {
          if (!fallbackWaitUsed && hasDistinctFallback && effectiveFallbackModel) {
            const waited = await tryWaitForFallbackCooldown();
            if (waited) {
              continue;
            }
          }
          if (
            fallbackWaitUsed &&
            !pendingProbeRetried &&
            effectiveFallbackModel &&
            isFallbackLegAvailable(nowFn()) &&
            this.allocator.hasPendingProbeBlockForModel(
              effectiveFallbackModel,
              nowFn(),
              excludedKeyIds,
              excludedProjectNumbers,
              attemptedPairs,
            ) &&
            getAbsRemainingMs(nowFn()) > 500 &&
            getFallbackRemainingMs(nowFn()) > 500
          ) {
            pendingProbeRetried = true;
            await sleepFn(500, options.signal);
            if (options.signal?.aborted) {
              throw new Error('Yêu cầu đã bị hủy bởi người dùng.');
            }
            this.allocator.sweep(nowFn());
            continue;
          }
          break;
        }

        excludedKeyIds.add(lease.keyId);
        let leaseTriedPrimaryTransient = false;
        let leaseTriedFallbackTransient = false;

        try {
          while (fastEliminatedSweeps < MAX_KEYS_IN_POOL) {
            if (options.signal?.aborted) {
              throw new Error('Yêu cầu đã bị hủy bởi người dùng.');
            }

            const innerNow = nowFn();
            if (
              !firstChunkEverSent &&
              !earlyKeepAliveFired &&
              innerNow - requestStartMs > SSE_KEEPALIVE_EARLY_TRIGGER_MS
            ) {
              earlyKeepAliveFired = true;
              options.onSseKeepAliveRequired?.();
            }

            const keyRec = state.keys.find((k) => k.id === lease.keyId);
            if (!keyRec || keyRec.status !== 'ready') break;

            const allowPrimaryHere = isPrimaryLegAvailable(innerNow);
            const allowFallbackHere = isFallbackLegAvailable(innerNow);
            if (!allowPrimaryHere && !allowFallbackHere) break;

            let usableModels = this.allocator
              .getUsableModelsForKey(
                keyRec,
                defaultModel,
                effectiveFallbackModel,
                attemptedPairs,
                innerNow,
              )
              .filter((m) => {
                if (tpmSkippedModels.has(m)) return false;
                if (m === defaultModel) return allowPrimaryHere;
                if (m === effectiveFallbackModel) return allowFallbackHere;
                return false;
              });
            if (usableModels.length === 0) break;

            // Khi đang nối tiếp phần bị cắt giữa chừng, ưu tiên model dự phòng trước
            if (
              firstChunkEverSent &&
              effectiveFallbackModel &&
              usableModels.includes(effectiveFallbackModel)
            ) {
              usableModels = [
                effectiveFallbackModel,
                ...usableModels.filter((m) => m !== effectiveFallbackModel),
              ];
            }

            const modelToUse = usableModels[0];
            const pairKey = `${lease.keyId}::${modelToUse}`;
            attemptedPairs.add(pairKey);

            const activePrompt = firstChunkEverSent
              ? buildContinuationPrompt(options.prompt, streamedTextSoFar)
              : options.prompt;

            const profile = mergedProfiles[modelToUse];

            // Cổng chặn TPM 15K cho họ Gemma (HT-04) — đo trên activePrompt + systemInstruction trước khi gọi SDK
            // Đặt trước khi đánh dấu mở chân dự phòng (ĐK-152-12) để B7 không đốt oan ngân sách/cờ fallback
            if (isGemmaModel(modelToUse)) {
              const estIn = estimateRequestInputTokens(activePrompt, options.systemInstruction);
              const estOut =
                profile?.estimatedOutputTokensForTpmGuard ?? GEMMA_TPM_DEFAULT_OUTPUT_ESTIMATE;
              const estTotal = estIn + estOut;
              if (estTotal > GEMMA_TPM_GUARD_THRESHOLD) {
                tpmSkippedModels.add(modelToUse);
                lastTpmSkipReason = `TPM_GUARD_SKIP: Đã bỏ qua model ${modelToUse} vì ước lượng đầu vào+đầu ra (${estIn} + ${estOut} = ${estTotal} token) vượt ngưỡng an toàn ${GEMMA_TPM_GUARD_THRESHOLD.toLocaleString('vi-VN')} token/phút của họ Gemma.`;
                console.log(
                  `[KeyPool][TPM_GUARD_SKIP] key=${lease.keyId} model=${modelToUse} estIn=${estIn} estOut=${estOut} total=${estTotal} limit=${GEMMA_TPM_GUARD_THRESHOLD}`,
                );
                continue;
              }
            }

            const isFallbackAttempt =
              effectiveFallbackModel !== undefined && modelToUse === effectiveFallbackModel;
            if (isFallbackAttempt) {
              if (fallbackLegStartMs === null) {
                fallbackLegStartMs = innerNow;
              }
              if (!fallbackEverActivated) {
                fallbackEverActivated = true;
              }
              options.onSseKeepAliveRequired?.();
            }

            totalCallsMade += 1;
            const attemptStartMs = nowFn();
            let attemptSentAnyChunk = false;
            let ttfbMs = 0;
            let lastFinishReason: string | undefined;

            const attemptAbort = new AbortController();
            const onParentAbort = () => attemptAbort.abort();
            options.signal?.addEventListener('abort', onParentAbort, { once: true });

            const timeoutBaseNow = nowFn();
            const profileFirstChunkTimeout = profile?.firstChunkTimeoutMs ?? FIRST_CHUNK_TIMEOUT_MS;
            const legRemainingRaw = isFallbackAttempt
              ? getFallbackRemainingMs(timeoutBaseNow)
              : TOTAL_FAILOVER_TIME_BUDGET_MS - primaryBudgetUsedMs;
            const absRemainingRaw = getAbsRemainingMs(timeoutBaseNow);
            const remainingLegBudgetMs = Math.max(
              1000,
              Math.min(legRemainingRaw, absRemainingRaw),
            );
            const firstChunkTimeoutMs = Math.min(profileFirstChunkTimeout, remainingLegBudgetMs);
            let timeoutHandle: ReturnType<typeof setTimeout> | null = setTimeout(() => {
              if (!attemptSentAnyChunk) {
                attemptAbort.abort(new Error('FIRST_CHUNK_TIMEOUT'));
              }
            }, firstChunkTimeoutMs);

            const resolvedMaxOutputTokens = options.maxOutputTokens ?? profile?.maxOutputTokens;
            const resolvedThinkingConfig =
              options.thinkingConfig ??
              (profile?.thinkingLevel ? { thinkingLevel: profile.thinkingLevel } : undefined);

            const streamConfig: {
              systemInstruction?: string;
              maxOutputTokens?: number;
              thinkingConfig?: {
                thinkingLevel?: ModelThinkingLevel;
              };
              abortSignal: AbortSignal;
            } = {
              abortSignal: attemptAbort.signal,
            };
            if (options.systemInstruction) {
              streamConfig.systemInstruction = options.systemInstruction;
            }
            if (resolvedMaxOutputTokens !== undefined) {
              streamConfig.maxOutputTokens = resolvedMaxOutputTokens;
            }
            if (resolvedThinkingConfig !== undefined) {
              streamConfig.thinkingConfig = resolvedThinkingConfig;
            }

            try {
              const client = clientFactory(lease.rawKey);
              const stream = await client.models.generateContentStream({
                model: modelToUse,
                contents: activePrompt,
                config: streamConfig,
              });

              for await (const chunk of stream) {
                const chunkFinishReason = chunk?.candidates?.[0]?.finishReason;
                if (typeof chunkFinishReason === 'string' && chunkFinishReason.trim()) {
                  lastFinishReason = chunkFinishReason.trim();
                }

                const text = chunk?.text;
                if (!text) continue;

                lease.heartbeat();
                const isFirstChunkOfAttempt = !attemptSentAnyChunk;

                if (!attemptSentAnyChunk) {
                  attemptSentAnyChunk = true;
                  firstChunkEverSent = true;
                  if (earlyKeepAliveTimer) {
                    clearTimeout(earlyKeepAliveTimer);
                    earlyKeepAliveTimer = null;
                  }
                  if (timeoutHandle) {
                    clearTimeout(timeoutHandle);
                    timeoutHandle = null;
                  }
                  const chunk1Now = nowFn();
                  ttfbMs = Math.max(1, chunk1Now - attemptStartMs);
                  const fbLat = computeFallbackLatency(chunk1Now);
                  const meta: StreamExecutionMeta = {
                    keyId: lease.keyId,
                    maskedKey: lease.maskedKey,
                    label: lease.label,
                    modelUsed: modelToUse,
                    usedFallbackModel: modelToUse !== defaultModel,
                    failoverAttempts: totalCallsMade,
                    latencyMs: ttfbMs,
                    continuedFromPartial: continuationCount > 0,
                    continuationCount,
                    fallbackLegUsed: fallbackEverActivated,
                    ...(fbLat !== undefined ? { fallbackLegLatencyMs: fbLat } : {}),
                  };
                  lastMeta = meta;
                  options.onMeta?.(meta);
                }

                const emittedText =
                  isFirstChunkOfAttempt && continuationCount > 0
                    ? normalizeContinuationSeam(streamedTextSoFar, text)
                    : text;
                streamedTextSoFar += emittedText;
                options.onChunk(emittedText);
              }

              if (!attemptSentAnyChunk) {
                throw new Error('AI_EMPTY_RESPONSE');
              }

              const doneNow = nowFn();
              if (!isFallbackAttempt) {
                primaryBudgetUsedMs += Math.max(0, doneNow - attemptStartMs);
              }
              this.allocator.recordSuccess(lease.keyId, ttfbMs, doneNow, modelToUse);
              const fbLat = computeFallbackLatency(doneNow);
              return {
                keyId: lease.keyId,
                maskedKey: lease.maskedKey,
                label: lease.label,
                modelUsed: modelToUse,
                usedFallbackModel: modelToUse !== defaultModel,
                failoverAttempts: totalCallsMade,
                latencyMs: ttfbMs,
                continuedFromPartial: continuationCount > 0,
                continuationCount,
                fallbackLegUsed: fallbackEverActivated,
                ...(fbLat !== undefined ? { fallbackLegLatencyMs: fbLat } : {}),
                ...(lastFinishReason ? { finishReason: lastFinishReason } : {}),
                ...(lastFinishReason === 'MAX_TOKENS' ? { truncatedByMaxTokens: true } : {}),
              };
            } catch (err) {
              if (timeoutHandle) {
                clearTimeout(timeoutHandle);
                timeoutHandle = null;
              }

              if (options.signal?.aborted) {
                throw new Error('Yêu cầu đã bị hủy bởi người dùng.');
              }

              const errNow = nowFn();
              if (!isFallbackAttempt) {
                primaryBudgetUsedMs += Math.max(0, errNow - attemptStartMs);
              }

              const classified = classifyGeminiError(err, this.getRawKeysById().values());
              lastClassifiedError = classified;
              if (classified.category !== 'UNKNOWN') {
                seenFallbackEligibleError = true;
              }

              // Fast-Sweep (QĐ-F1 / FS2-02 / FS2-05): Đếm theo lượt gọi API bị loại cố định trước chunk đầu
              if (!attemptSentAnyChunk && FAST_SWEEP_CATEGORIES.has(classified.category)) {
                fastEliminatedSweeps += 1;
              } else if (isFallbackAttempt) {
                leaseTriedFallbackTransient = true;
              } else {
                leaseTriedPrimaryTransient = true;
              }

              // Ghi nhận lỗi đúng bản chất — KHÔNG ép MODEL_UNAVAILABLE sang NETWORK_OR_5XX
              if (
                classified.category === 'MODEL_UNAVAILABLE' ||
                classified.category === 'RATE_LIMIT_RPM'
              ) {
                const { keyEscalatedToCooldown } = this.allocator.recordModelIssue(
                  lease.keyId,
                  modelToUse,
                  classified,
                  errNow,
                  options.disableJitter,
                  defaultModel,
                  effectiveFallbackModel ?? configuredFallbackModel,
                );
                if (keyEscalatedToCooldown && classified.projectNumber) {
                  excludedProjectNumbers.add(classified.projectNumber);
                }
              } else {
                this.allocator.recordFailure(
                  lease.keyId,
                  classified,
                  errNow,
                  options.disableJitter,
                );
                if (
                  classified.projectNumber &&
                  (classified.category === 'QUOTA_PROJECT_ZERO' ||
                    classified.category === 'API_NOT_ENABLED' ||
                    classified.category === 'QUOTA_DAILY_EXHAUSTED')
                ) {
                  excludedProjectNumbers.add(classified.projectNumber);
                }
              }

              // Nếu đã gửi chunk trước đó (bị đứt giữa luồng) -> kiểm tra quyền tự động tiếp nối
              if (attemptSentAnyChunk) {
                const hasLegForContinuation =
                  isFallbackLegAvailable(errNow) || isPrimaryLegAvailable(errNow);
                const canContinue =
                  !options.signal?.aborted &&
                  continuationCount < maxContinuations &&
                  hasLegForContinuation &&
                  classified.category !== 'AUTH_INVALID_KEY';

                if (!canContinue) {
                  const interruptMinSec = this.allocator.getMinRemainingCooldownSec(errNow);
                  const reasonText = formatHumanReadableErrorVi(
                    classified,
                    interruptMinSec,
                  );
                  options.onInterrupted?.({
                    reason: reasonText,
                    errorCategory: classified.category,
                    partialLength: streamedTextSoFar.length,
                    minRemainingCooldownSec: interruptMinSec,
                  });
                  const fbLat = computeFallbackLatency(errNow);
                  return {
                    ...(lastMeta ?? {
                      keyId: lease.keyId,
                      maskedKey: lease.maskedKey,
                      label: lease.label,
                      modelUsed: modelToUse,
                      usedFallbackModel: modelToUse !== defaultModel,
                      failoverAttempts: totalCallsMade,
                      latencyMs: Math.max(1, errNow - attemptStartMs),
                    }),
                    continuedFromPartial: continuationCount > 0,
                    continuationCount,
                    interrupted: true,
                    partialLength: streamedTextSoFar.length,
                    fallbackLegUsed: fallbackEverActivated,
                    ...(fbLat !== undefined ? { fallbackLegLatencyMs: fbLat } : {}),
                    ...(lastFinishReason ? { finishReason: lastFinishReason } : {}),
                    ...(lastFinishReason === 'MAX_TOKENS' ? { truncatedByMaxTokens: true } : {}),
                  };
                }

                continuationCount += 1;
              }
            } finally {
              options.signal?.removeEventListener('abort', onParentAbort);
              if (timeoutHandle) {
                clearTimeout(timeoutHandle);
              }
            }
          }
        } finally {
          if (leaseTriedPrimaryTransient) {
            primaryKeyAttemptsUsed += 1;
          }
          if (leaseTriedFallbackTransient) {
            fallbackKeyAttemptsUsed += 1;
          }
          lease.release();
        }
      }
    } finally {
      if (earlyKeepAliveTimer) {
        clearTimeout(earlyKeepAliveTimer);
        earlyKeepAliveTimer = null;
      }
    }

    // Trường hợp đã gửi một phần văn bản (đang cố nối tiếp) nhưng hết ngân sách hoặc hết khóa/model để nối tiếp
    if (firstChunkEverSent) {
      const endNow = nowFn();
      const minSec = this.allocator.getMinRemainingCooldownSec(endNow);
      const reasonText = formatHumanReadableErrorVi(lastClassifiedError, minSec);
      options.onInterrupted?.({
        reason: reasonText,
        errorCategory: lastClassifiedError?.category ?? 'UNKNOWN',
        partialLength: streamedTextSoFar.length,
        minRemainingCooldownSec: minSec,
      });
      const fbLat = computeFallbackLatency(endNow);
      return {
        ...(lastMeta ?? {
          keyId: '',
          maskedKey: '',
          label: '',
          modelUsed: defaultModel,
          usedFallbackModel: false,
          failoverAttempts: totalCallsMade,
          latencyMs: Math.max(1, endNow - requestStartMs),
        }),
        continuedFromPartial: continuationCount > 0,
        continuationCount,
        interrupted: true,
        partialLength: streamedTextSoFar.length,
        fallbackLegUsed: fallbackEverActivated,
        ...(fbLat !== undefined ? { fallbackLegLatencyMs: fbLat } : {}),
      };
    }

    // Nếu toàn bộ model cấu hình đều bị cổng TPM họ Gemma từ chối trước khi gọi API -> thoát sạch không ném PoolExhaustedError
    const allTargetsTpmSkipped =
      lastTpmSkipReason !== null && configuredTargets.every((m) => tpmSkippedModels.has(m));
    if (
      lastTpmSkipReason !== null &&
      (allTargetsTpmSkipped || (lastClassifiedError === null && totalCallsMade === 0))
    ) {
      throw new TpmGuardSkipError(
        lastTpmSkipReason,
        this.allocator.getMinRemainingCooldownSec(nowFn()),
      );
    }

    // Chuẩn hóa lỗi cuối vòng lặp thành PoolExhaustedError theo điều kiện FS2-01
    const finalNowMs = nowFn();
    this.allocator.sweep(finalNowMs);
    const minSec = this.allocator.getMinRemainingCooldownSec(finalNowMs);
    const cleanMsg = formatHumanReadableErrorVi(lastClassifiedError, minSec);
    const remainingUsable = state.keys.filter(
      (k) =>
        k.status === 'ready' &&
        this.allocator.getUsableModelsForKey(
          k,
          defaultModel,
          effectiveFallbackModel,
          undefined,
          finalNowMs,
        ).length > 0,
    ).length;

    const absExhausted = finalNowMs - requestStartMs >= ABSOLUTE_REQUEST_BUDGET_MS;
    const primaryExhausted =
      primaryBudgetUsedMs >= TOTAL_FAILOVER_TIME_BUDGET_MS ||
      primaryKeyAttemptsUsed >= MAX_KEY_ATTEMPTS;
    const fallbackExhausted =
      !hasDistinctFallback ||
      (fallbackLegStartMs !== null &&
        (finalNowMs - fallbackLegStartMs >= FALLBACK_LEG_TIME_BUDGET_MS ||
          fallbackKeyAttemptsUsed >= MAX_FALLBACK_KEY_ATTEMPTS));
    const budgetExhausted =
      absExhausted ||
      (primaryExhausted && (!fallbackEverActivated || fallbackExhausted) && !isUnknownOnlyPrimaryBlocked());

    const shouldThrowPoolExhausted =
      remainingUsable === 0 ||
      budgetExhausted ||
      (lastClassifiedError !== null &&
        POOL_EXHAUSTION_ELIGIBLE_CATEGORIES.has(lastClassifiedError.category));

    if (shouldThrowPoolExhausted) {
      const errorCategory = inferPoolExhaustedCategory(
        state.keys,
        lastClassifiedError,
        minSec,
      );
      throw new PoolExhaustedError('AI_POOL_EXHAUSTED', cleanMsg, minSec, errorCategory);
    }

    throw new Error(cleanMsg);
  }
}
