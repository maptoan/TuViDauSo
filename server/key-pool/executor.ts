import { GoogleGenAI } from '@google/genai';
import {
  FIRST_CHUNK_TIMEOUT_MS,
  KeyPoolState,
  MAX_KEY_ATTEMPTS,
  StreamExecutionMeta,
  StreamInterruptedEvent,
  TOTAL_FAILOVER_TIME_BUDGET_MS,
} from './types.ts';
import {
  ClassifiedGeminiError,
  classifyGeminiError,
  formatHumanReadableErrorVi,
  KeyAllocator,
} from './allocator.ts';

export interface AiStreamChunk {
  text?: string;
}

export interface AiClientLike {
  models: {
    generateContentStream(params: {
      model: string;
      contents: string;
      config?: {
        systemInstruction?: string;
        abortSignal?: AbortSignal;
      };
    }): Promise<AsyncIterable<AiStreamChunk>>;
    generateContent(params: {
      model: string;
      contents: string;
      config?: {
        maxOutputTokens?: number;
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

export interface ExecuteStreamOptions {
  prompt: string;
  systemInstruction?: string;
  preferredModel?: string;
  onMeta?: (meta: StreamExecutionMeta) => void;
  onChunk: (text: string) => void;
  onInterrupted?: (event: StreamInterruptedEvent) => void;
  signal?: AbortSignal;
  clientFactory?: AiClientFactory;
  nowFn?: () => number;
  disableJitter?: boolean;
  maxContinuations?: number;
}

export class PoolExhaustedError extends Error {
  public readonly code: 'AI_NOT_CONFIGURED' | 'AI_POOL_EXHAUSTED';
  public readonly minRemainingCooldownSec: number | null;

  constructor(
    code: 'AI_NOT_CONFIGURED' | 'AI_POOL_EXHAUSTED',
    message: string,
    minRemainingCooldownSec: number | null = null,
  ) {
    super(message);
    this.name = 'PoolExhaustedError';
    this.code = code;
    this.minRemainingCooldownSec = minRemainingCooldownSec;
  }
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
2. Hãy viết TIẾP NỐI NGAY TỪ CHỮ CUỐI CÙNG ĐANG DỞ để hoàn thành nốt các đề mục còn thiếu cho đến hết bài (bao gồm cả dòng lưu ý cuối bài nếu chưa viết).
3. TUYỆT ĐỐI KHÔNG lặp lại tiêu đề hoặc bất kỳ câu nào đã có trong [PHẦN ĐÃ VIẾT TRƯỚC ĐÓ]. Không viết câu mở đầu kiểu "Tiếp theo phần trước...".`;
}

export class GeminiStreamExecutor {
  constructor(
    private readonly getState: () => KeyPoolState,
    private readonly getRawKeysById: () => Map<string, string>,
    private readonly allocator: KeyAllocator,
  ) {}

  public async executeStream(options: ExecuteStreamOptions): Promise<StreamExecutionMeta> {
    const nowFn = options.nowFn ?? Date.now;
    const clientFactory = options.clientFactory ?? defaultAiClientFactory;
    const state = this.getState();
    const requestStartMs = nowFn();

    this.allocator.sweep(requestStartMs);

    if (state.keys.length === 0) {
      throw new PoolExhaustedError(
        'AI_NOT_CONFIGURED',
        'Chưa cấu hình AI (kho khóa hiện chưa có khóa Gemini nào). Hệ thống giữ nguyên Khung dữ kiện xác định và không giả lập văn bản AI.',
      );
    }

    const defaultModel = options.preferredModel || state.modelConfig.defaultModel;
    const fallbackModel = state.modelConfig.fallbackModel;

    const usableReadyCount = state.keys.filter(
      (k) =>
        k.status === 'ready' &&
        this.allocator.getUsableModelsForKey(k, defaultModel, fallbackModel, undefined, requestStartMs)
          .length > 0,
    ).length;

    if (usableReadyCount === 0) {
      const minSec = this.allocator.getMinRemainingCooldownSec(requestStartMs);
      throw new PoolExhaustedError(
        'AI_POOL_EXHAUSTED',
        minSec !== null
          ? `Tất cả khóa Gemini trong kho đang trong thời gian chờ nguội (khóa kế tiếp sẵn sàng sau khoảng ${minSec} giây) hoặc đã bị vô hiệu hóa.`
          : 'Tất cả khóa Gemini trong kho hiện đều bị vô hiệu hóa hoặc chưa sẵn sàng.',
        minSec,
      );
    }

    const excludedKeyIds = new Set<string>();
    const excludedProjectNumbers = new Set<string>();
    const attemptedPairs = new Set<string>();

    let keyAttemptsUsed = 0;
    let totalCallsMade = 0;
    let firstChunkEverSent = false;
    let streamedTextSoFar = '';
    let continuationCount = 0;
    const maxContinuations = options.maxContinuations ?? 2;
    let lastClassifiedError: ClassifiedGeminiError | null = null;
    let lastMeta: StreamExecutionMeta | null = null;

    while (keyAttemptsUsed < MAX_KEY_ATTEMPTS) {
      if (options.signal?.aborted) {
        throw new Error('Yêu cầu đã bị hủy bởi người dùng.');
      }

      if (nowFn() - requestStartMs >= TOTAL_FAILOVER_TIME_BUDGET_MS) {
        break;
      }

      const lease = this.allocator.acquireLease(
        excludedKeyIds,
        excludedProjectNumbers,
        nowFn(),
        { defaultModel, fallbackModel, attemptedPairs },
      );
      if (!lease) {
        break;
      }

      keyAttemptsUsed += 1;
      excludedKeyIds.add(lease.keyId);

      try {
        while (true) {
          if (options.signal?.aborted) {
            throw new Error('Yêu cầu đã bị hủy bởi người dùng.');
          }
          if (nowFn() - requestStartMs >= TOTAL_FAILOVER_TIME_BUDGET_MS) {
            break;
          }

          const keyRec = state.keys.find((k) => k.id === lease.keyId);
          if (!keyRec || keyRec.status !== 'ready') break;

          let usableModels = this.allocator.getUsableModelsForKey(
            keyRec,
            defaultModel,
            fallbackModel,
            attemptedPairs,
            nowFn(),
          );
          if (usableModels.length === 0) break;

          // Khi đang nối tiếp phần bị cắt giữa chừng, ưu tiên model dự phòng (gemini-3.8-flash) trước
          if (firstChunkEverSent && fallbackModel && usableModels.includes(fallbackModel)) {
            usableModels = [
              fallbackModel,
              ...usableModels.filter((m) => m !== fallbackModel),
            ];
          }

          const modelToUse = usableModels[0];
          const pairKey = `${lease.keyId}::${modelToUse}`;
          attemptedPairs.add(pairKey);

          totalCallsMade += 1;
          const attemptStartMs = nowFn();
          let attemptSentAnyChunk = false;
          let ttfbMs = 0;

          const activePrompt = firstChunkEverSent
            ? buildContinuationPrompt(options.prompt, streamedTextSoFar)
            : options.prompt;

          const attemptAbort = new AbortController();
          const onParentAbort = () => attemptAbort.abort();
          options.signal?.addEventListener('abort', onParentAbort, { once: true });

          const remainingTotalMs = Math.max(
            1000,
            TOTAL_FAILOVER_TIME_BUDGET_MS - (nowFn() - requestStartMs),
          );
          const firstChunkTimeoutMs = Math.min(FIRST_CHUNK_TIMEOUT_MS, remainingTotalMs);
          let timeoutHandle: ReturnType<typeof setTimeout> | null = setTimeout(() => {
            if (!attemptSentAnyChunk) {
              attemptAbort.abort(new Error('FIRST_CHUNK_TIMEOUT'));
            }
          }, firstChunkTimeoutMs);

          try {
            const client = clientFactory(lease.rawKey);
            const stream = await client.models.generateContentStream({
              model: modelToUse,
              contents: activePrompt,
              config: {
                ...(options.systemInstruction
                  ? { systemInstruction: options.systemInstruction }
                  : {}),
                abortSignal: attemptAbort.signal,
              },
            });

            for await (const chunk of stream) {
              const text = chunk?.text;
              if (!text) continue;

              lease.heartbeat();

              if (!attemptSentAnyChunk) {
                attemptSentAnyChunk = true;
                firstChunkEverSent = true;
                if (timeoutHandle) {
                  clearTimeout(timeoutHandle);
                  timeoutHandle = null;
                }
                ttfbMs = Math.max(1, nowFn() - attemptStartMs);
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
                };
                lastMeta = meta;
                options.onMeta?.(meta);
              }

              streamedTextSoFar += text;
              options.onChunk(text);
            }

            if (!attemptSentAnyChunk) {
              throw new Error('AI_EMPTY_RESPONSE');
            }

            this.allocator.recordSuccess(lease.keyId, ttfbMs, nowFn(), modelToUse);
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
            };
          } catch (err) {
            if (timeoutHandle) {
              clearTimeout(timeoutHandle);
              timeoutHandle = null;
            }

            if (options.signal?.aborted) {
              throw new Error('Yêu cầu đã bị hủy bởi người dùng.');
            }

            const classified = classifyGeminiError(err, this.getRawKeysById().values());
            lastClassifiedError = classified;

            // Ghi nhận lỗi đúng bản chất — KHÔNG ép MODEL_UNAVAILABLE sang NETWORK_OR_5XX
            if (
              classified.category === 'MODEL_UNAVAILABLE' ||
              classified.category === 'RATE_LIMIT_RPM'
            ) {
              const { keyEscalatedToCooldown } = this.allocator.recordModelIssue(
                lease.keyId,
                modelToUse,
                classified,
                nowFn(),
                options.disableJitter,
                defaultModel,
                fallbackModel,
              );
              if (keyEscalatedToCooldown && classified.projectNumber) {
                excludedProjectNumbers.add(classified.projectNumber);
              }
            } else {
              this.allocator.recordFailure(
                lease.keyId,
                classified,
                nowFn(),
                options.disableJitter,
              );
              if (
                classified.projectNumber &&
                (classified.category === 'QUOTA_PROJECT_ZERO' ||
                  classified.category === 'QUOTA_DAILY_EXHAUSTED')
              ) {
                excludedProjectNumbers.add(classified.projectNumber);
              }
            }

            // Nếu đã gửi chunk trước đó (bị đứt giữa luồng) -> kiểm tra quyền tự động tiếp nối
            if (attemptSentAnyChunk) {
              const canContinue =
                !options.signal?.aborted &&
                continuationCount < maxContinuations &&
                nowFn() - requestStartMs < TOTAL_FAILOVER_TIME_BUDGET_MS &&
                classified.category !== 'AUTH_INVALID_KEY';

              if (!canContinue) {
                const reasonText = formatHumanReadableErrorVi(
                  classified,
                  this.allocator.getMinRemainingCooldownSec(nowFn()),
                );
                options.onInterrupted?.({
                  reason: reasonText,
                  errorCategory: classified.category,
                  partialLength: streamedTextSoFar.length,
                });
                return {
                  ...(lastMeta ?? {
                    keyId: lease.keyId,
                    maskedKey: lease.maskedKey,
                    label: lease.label,
                    modelUsed: modelToUse,
                    usedFallbackModel: modelToUse !== defaultModel,
                    failoverAttempts: totalCallsMade,
                    latencyMs: Math.max(1, nowFn() - attemptStartMs),
                  }),
                  continuedFromPartial: continuationCount > 0,
                  continuationCount,
                  interrupted: true,
                };
              }

              continuationCount += 1;
              // Nếu trên chính khóa này vẫn còn model khả dụng (vd gemini-3.8-flash), vòng while trong sẽ chạy nối tiếp ngay!
              // Ngược lại vòng while trong kết thúc và vòng while ngoài lấy khóa khỏe tiếp theo.
            }
          } finally {
            options.signal?.removeEventListener('abort', onParentAbort);
            if (timeoutHandle) {
              clearTimeout(timeoutHandle);
            }
          }
        }
      } finally {
        lease.release();
      }
    }

    // Trường hợp đã gửi một phần văn bản (đang cố nối tiếp) nhưng hết ngân sách hoặc hết khóa/model để nối tiếp
    if (firstChunkEverSent) {
      const minSec = this.allocator.getMinRemainingCooldownSec(nowFn());
      const reasonText = formatHumanReadableErrorVi(lastClassifiedError, minSec);
      options.onInterrupted?.({
        reason: reasonText,
        errorCategory: lastClassifiedError?.category ?? 'UNKNOWN',
        partialLength: streamedTextSoFar.length,
      });
      return {
        ...(lastMeta ?? {
          keyId: '',
          maskedKey: '',
          label: '',
          modelUsed: defaultModel,
          usedFallbackModel: false,
          failoverAttempts: totalCallsMade,
          latencyMs: Math.max(1, nowFn() - requestStartMs),
        }),
        continuedFromPartial: continuationCount > 0,
        continuationCount,
        interrupted: true,
      };
    }

    // Chuẩn hóa lỗi cuối vòng lặp thành PoolExhaustedError khi không còn khóa/model khả dụng (Tối ưu #4)
    this.allocator.sweep(nowFn());
    const minSec = this.allocator.getMinRemainingCooldownSec(nowFn());
    const cleanMsg = formatHumanReadableErrorVi(lastClassifiedError, minSec);
    const remainingUsable = state.keys.filter(
      (k) =>
        k.status === 'ready' &&
        this.allocator.getUsableModelsForKey(k, defaultModel, fallbackModel, undefined, nowFn())
          .length > 0,
    ).length;

    if (remainingUsable === 0) {
      throw new PoolExhaustedError('AI_POOL_EXHAUSTED', cleanMsg, minSec);
    }

    throw new Error(cleanMsg);
  }
}
