export interface AiPeriodBadgeCheckInput {
  text?: string;
  incomplete?: boolean;
  meta?: {
    continuedFromPartial?: boolean;
    interrupted?: boolean;
  };
}

/**
 * Huy hiệu "Đã tự động nối tiếp luồng hoàn chỉnh" CHỈ được hiển thị khi:
 * 1. Quá trình streaming đã kết thúc (!isLoading)
 * 2. Có nội dung hoàn chỉnh đã lưu cache (Boolean(entry.text?.trim()))
 * 3. Không bị đánh dấu ngắt giữa chừng (!entry.incomplete && !entry.meta?.interrupted)
 * 4. Thực sự đã từng kích hoạt tiếp nối (Boolean(entry.meta?.continuedFromPartial))
 */
export function shouldShowCompletedContinuationBadge(
  entry: AiPeriodBadgeCheckInput | undefined,
  isLoading: boolean,
): boolean {
  if (!entry || isLoading) return false;
  if (!entry.meta?.continuedFromPartial) return false;
  if (entry.incomplete || entry.meta.interrupted) return false;
  return Boolean(entry.text && entry.text.trim().length > 0);
}

/**
 * Huy hiệu cảnh báo đã thử tiếp nối nhưng bản cuối vẫn bị ngắt giữa chừng.
 */
export function shouldShowInterruptedContinuationBadge(
  entry: AiPeriodBadgeCheckInput | undefined,
  isLoading: boolean,
): boolean {
  if (!entry || isLoading) return false;
  if (!entry.meta?.continuedFromPartial) return false;
  return Boolean(entry.incomplete || entry.meta.interrupted || !entry.text?.trim());
}

/**
 * Quyết định có được dùng lại bộ nhớ đệm kỳ hạn hay phải gọi lại API:
 * Bản bị ngắt (incomplete === true) tuyệt đối không được xem là cache hợp lệ.
 */
export function hasValidCachedPeriodEntry(entry: AiPeriodBadgeCheckInput | undefined): boolean {
  if (!entry || entry.incomplete || entry.meta?.interrupted) return false;
  return Boolean(entry.text && entry.text.trim().length > 0);
}

/**
 * Khi nhận snapshot mới từ server trong lúc người dùng đang chỉnh sửa hoặc đang lưu model,
 * giữ nguyên giá trị combobox cục bộ nếu modelDirty === true để không ghi đè lựa chọn đang sửa.
 */
export function resolveNextModelSelection(
  currentSelection: { defaultModel: string; fallbackModel: string },
  snapshotConfig: { defaultModel: string; fallbackModel: string },
  options: { modelDirty: boolean; forceSyncFromSave?: boolean },
): { defaultModel: string; fallbackModel: string } {
  if (options.modelDirty && !options.forceSyncFromSave) {
    return currentSelection;
  }
  return {
    defaultModel: snapshotConfig.defaultModel,
    fallbackModel: snapshotConfig.fallbackModel,
  };
}

export interface KeyPoolSnapshotRefreshInput {
  open: boolean;
  wasOpen: boolean;
  hadOtherOverlayOpen: boolean;
  hasOtherOverlayOpen: boolean;
  regainedWindowFocus?: boolean;
  isBatchProbing?: boolean;
}

/**
 * Quyết định tải lại GET /api/key-pool một lần (không polling liên tục):
 * - Khi modal vừa mở (false -> true)
 * - Khi modal vẫn mở sẵn (open === true) và lớp phủ khác (DetailedDossierModal / ContextualChatDrawer) vừa đóng
 * - Khi cửa sổ/tab lấy lại focus trong lúc modal đang mở trên cùng (và không đang chạy batch probe)
 */
export function shouldRefreshKeyPoolSnapshot(input: KeyPoolSnapshotRefreshInput): boolean {
  if (!input.open) return false;
  if (input.isBatchProbing) return false;
  if (!input.wasOpen) return true;
  if (input.hadOtherOverlayOpen && !input.hasOtherOverlayOpen) return true;
  if (input.regainedWindowFocus && !input.hasOtherOverlayOpen) return true;
  return false;
}

// ─── TÍNH NĂNG 1 (F3): Client-Orchestrated Batch Cooldown Probe ─────────────

export const BATCH_COOLDOWN_PROBE_DELAY_MS = 1_200;

/**
 * Kỷ luật (a): Chỉ nhảy cóc khi lỗi thuộc 3 loại Quota cấp GCP Project.
 * TUYỆT ĐỐI KHÔNG nhảy cóc với NETWORK_OR_5XX, MODEL_UNAVAILABLE, AUTH_INVALID_KEY.
 */
export const PROJECT_SCOPED_QUOTA_CATEGORIES: ReadonlySet<string> = new Set([
  'QUOTA_PROJECT_ZERO',
  'QUOTA_DAILY_EXHAUSTED',
  'RATE_LIMIT_RPM',
]);

export interface CooldownProbeKeyShape {
  id: string;
  label: string;
  maskedKey: string;
  status: string;
  detectedProjectNumber: string | null;
  healthScore: number;
  cooldownUntil: number | null;
  remainingCooldownSec: number;
  cooldownReason: string;
  stats: {
    lastErrorType: string;
    lastErrorMessage: string | null;
    lastErrorAt: number | null;
    lastTestLatencyMs: number | null;
    lastTestedAt: number | null;
  };
}

export type BatchCooldownOutcome =
  | 'recovered'
  | 'still_failing'
  | 'inconclusive'
  | 'skipped_same_project'
  | 'disabled'
  | 'deferred_debounce';

export type BatchSingleProbeResponse =
  | {
      kind: 'probed';
      ok: boolean;
      inconclusive?: boolean;
      latencyMs: number;
      modelUsed: string;
      status: 'ready' | 'cooldown' | 'disabled' | string;
      healthScore: number;
      detectedProjectNumber?: string | null;
      errorCategory?: string;
      sanitizedMessage?: string;
      cooldownUntil?: number | null;
    }
  | {
      kind: 'deferred_debounce';
      message: string;
    }
  | {
      kind: 'auth_blocked';
      message: string;
    };

export interface BatchCooldownItemResult {
  id: string;
  maskedKey: string;
  label: string;
  outcome: BatchCooldownOutcome;
  isRealProbe: boolean; // true = probe thật qua HTTP; false = nhảy cóc đồng bộ theo key đại diện hoặc chưa thử
  representativeKeyId?: string;
  representativeMaskedKey?: string;
  detectedProjectNumber: string | null;
  newStatus: 'ready' | 'cooldown' | 'disabled';
  healthScore: number;
  latencyMs: number | null;
  modelUsed: string | null;
  errorCategory: string | null;
  sanitizedMessage: string | null;
  cooldownUntil: number | null;
}

export interface BatchCooldownCounts {
  recovered: number;
  stillFailing: number;
  inconclusive: number;
  skippedSameProject: number;
  disabled: number;
  deferred: number;
  probedReal: number;
  errorsByCategory: Record<string, number>;
}

export interface BatchCooldownProgress {
  running: boolean;
  stoppedEarly: boolean;
  total: number;
  processed: number;
  currentKeyId: string | null;
  currentMaskedKey: string | null;
  currentLabel: string | null;
  counts: BatchCooldownCounts;
  results: BatchCooldownItemResult[];
  abortReason: string | null;
}

export function canTriggerBatchCooldownProbe(
  isReadOnly: boolean,
  cooldownCount: number,
  isRunning: boolean,
): boolean {
  return !isReadOnly && cooldownCount > 0 && !isRunning;
}

function cooldownPriorityRank(reason: string): number {
  switch (reason) {
    case 'NETWORK_OR_5XX':
      return 0;
    case 'RATE_LIMIT_RPM':
      return 1;
    case 'QUOTA_DAILY_EXHAUSTED':
      return 2;
    case 'QUOTA_PROJECT_ZERO':
      return 3;
    default:
      return 4;
  }
}

/**
 * Lọc chỉ lấy các key đang cooldown (status === 'cooldown'; loại trừ disabled và ready)
 * và sắp xếp theo thứ tự ưu tiên lý do nguội:
 * NETWORK_OR_5XX -> RATE_LIMIT_RPM -> QUOTA_DAILY_EXHAUSTED -> QUOTA_PROJECT_ZERO -> khác.
 */
export function buildCooldownProbeQueue<T extends CooldownProbeKeyShape>(keys: readonly T[]): T[] {
  return keys
    .filter((k) => k.status === 'cooldown')
    .slice()
    .sort((a, b) => {
      const reasonA = a.cooldownReason !== 'NONE' ? a.cooldownReason : a.stats.lastErrorType;
      const reasonB = b.cooldownReason !== 'NONE' ? b.cooldownReason : b.stats.lastErrorType;
      const rankDiff = cooldownPriorityRank(reasonA) - cooldownPriorityRank(reasonB);
      if (rankDiff !== 0) return rankDiff;
      const remDiff = a.remainingCooldownSec - b.remainingCooldownSec;
      if (remDiff !== 0) return remDiff;
      return b.healthScore - a.healthScore;
    });
}

function defaultAbortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      resolve();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function emptyBatchCounts(): BatchCooldownCounts {
  return {
    recovered: 0,
    stillFailing: 0,
    inconclusive: 0,
    skippedSameProject: 0,
    disabled: 0,
    deferred: 0,
    probedReal: 0,
    errorsByCategory: {},
  };
}

/**
 * Điều phối probe tuần tự phía client theo Quyết định F3 & 4 kỷ luật Same-Project Short-Circuit.
 */
export async function runClientBatchCooldownProbe<T extends CooldownProbeKeyShape>(params: {
  keys: readonly T[];
  probeSingleKey: (keyId: string, signal: AbortSignal) => Promise<BatchSingleProbeResponse>;
  delayBetweenRealProbesMs?: number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  shouldStop?: () => boolean;
  signal: AbortSignal;
  onProgress?: (progress: BatchCooldownProgress) => void;
  onItemCompleted?: (item: BatchCooldownItemResult) => void;
}): Promise<BatchCooldownProgress> {
  const queue = buildCooldownProbeQueue(params.keys);
  const delayMs = params.delayBetweenRealProbesMs ?? BATCH_COOLDOWN_PROBE_DELAY_MS;
  const sleepFn = params.sleep ?? defaultAbortableSleep;
  const counts = emptyBatchCounts();
  const results: BatchCooldownItemResult[] = [];

  const failedProjects = new Map<
    string,
    {
      errorCategory: string;
      cooldownUntil: number | null;
      representativeKeyId: string;
      representativeMaskedKey: string;
      sanitizedMessage: string;
    }
  >();

  let realNetworkRequestsSent = 0;
  let stoppedEarly = false;
  let abortReason: string | null = null;

  const emitProgress = (currentKey: T | null, running: boolean) => {
    params.onProgress?.({
      running,
      stoppedEarly,
      total: queue.length,
      processed: results.length,
      currentKeyId: currentKey?.id ?? null,
      currentMaskedKey: currentKey?.maskedKey ?? null,
      currentLabel: currentKey?.label ?? null,
      counts: {
        ...counts,
        errorsByCategory: { ...counts.errorsByCategory },
      },
      results: [...results],
      abortReason,
    });
  };

  for (const key of queue) {
    if (params.signal.aborted || params.shouldStop?.()) {
      stoppedEarly = true;
      break;
    }

    // Kỷ luật (b): Chỉ nhảy cóc khi detectedProjectNumber là chuỗi non-empty hợp lệ;
    // key có detectedProjectNumber === null/undefined LUÔN được probe độc lập và không tính vào Bỏ qua.
    const proj =
      typeof key.detectedProjectNumber === 'string' && key.detectedProjectNumber.trim().length > 0
        ? key.detectedProjectNumber.trim()
        : null;

    if (proj && failedProjects.has(proj)) {
      const rep = failedProjects.get(proj)!;
      const skippedItem: BatchCooldownItemResult = {
        id: key.id,
        maskedKey: key.maskedKey,
        label: key.label,
        outcome: 'skipped_same_project',
        isRealProbe: false,
        representativeKeyId: rep.representativeKeyId,
        representativeMaskedKey: rep.representativeMaskedKey,
        detectedProjectNumber: proj,
        newStatus: 'cooldown',
        healthScore: key.healthScore,
        latencyMs: null,
        modelUsed: null,
        errorCategory: rep.errorCategory,
        sanitizedMessage: `Bỏ qua probe — đồng bộ cooldown theo key đại diện ${rep.representativeMaskedKey} (cùng Project #${proj}, ${rep.errorCategory})`,
        cooldownUntil: rep.cooldownUntil,
      };
      counts.skippedSameProject += 1;
      results.push(skippedItem);
      params.onItemCompleted?.(skippedItem);
      emitProgress(key, true);
      continue;
    }

    // Giãn cách 1,2s giữa 2 lần gọi mạng thật liên tiếp
    if (realNetworkRequestsSent > 0 && delayMs > 0) {
      emitProgress(key, true);
      await sleepFn(delayMs, params.signal);
      if (params.signal.aborted || params.shouldStop?.()) {
        stoppedEarly = true;
        break;
      }
    }

    emitProgress(key, true);
    let resp: BatchSingleProbeResponse;
    try {
      realNetworkRequestsSent += 1;
      resp = await params.probeSingleKey(key.id, params.signal);
    } catch (err) {
      if (params.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
        stoppedEarly = true;
        break;
      }
      // Lỗi kết nối không rõ từ fetch -> ghi nhận lỗi mạng cho key này và không nhảy cóc
      const netErrItem: BatchCooldownItemResult = {
        id: key.id,
        maskedKey: key.maskedKey,
        label: key.label,
        outcome: 'still_failing',
        isRealProbe: true,
        detectedProjectNumber: proj,
        newStatus: 'cooldown',
        healthScore: key.healthScore,
        latencyMs: null,
        modelUsed: null,
        errorCategory: 'NETWORK_OR_5XX',
        sanitizedMessage: err instanceof Error ? err.message : 'Lỗi kết nối khi kiểm tra khóa.',
        cooldownUntil: key.cooldownUntil,
      };
      counts.probedReal += 1;
      counts.stillFailing += 1;
      counts.errorsByCategory.NETWORK_OR_5XX = (counts.errorsByCategory.NETWORK_OR_5XX ?? 0) + 1;
      results.push(netErrItem);
      params.onItemCompleted?.(netErrItem);
      emitProgress(null, true);
      continue;
    }

    if (resp.kind === 'auth_blocked') {
      stoppedEarly = true;
      abortReason = resp.message;
      break;
    }

    if (resp.kind === 'deferred_debounce') {
      const deferredItem: BatchCooldownItemResult = {
        id: key.id,
        maskedKey: key.maskedKey,
        label: key.label,
        outcome: 'deferred_debounce',
        isRealProbe: false,
        detectedProjectNumber: proj,
        newStatus: 'cooldown',
        healthScore: key.healthScore,
        latencyMs: null,
        modelUsed: null,
        errorCategory: null,
        sanitizedMessage: resp.message || 'Chưa thử (đang chờ hết khoảng đệm chống spam)',
        cooldownUntil: key.cooldownUntil,
      };
      counts.deferred += 1;
      results.push(deferredItem);
      params.onItemCompleted?.(deferredItem);
      emitProgress(null, true);
      continue;
    }

    // resp.kind === 'probed'
    counts.probedReal += 1;
    const resolvedProj =
      typeof resp.detectedProjectNumber === 'string' && resp.detectedProjectNumber.trim().length > 0
        ? resp.detectedProjectNumber.trim()
        : proj;

    if (resp.ok) {
      const okItem: BatchCooldownItemResult = {
        id: key.id,
        maskedKey: key.maskedKey,
        label: key.label,
        outcome: 'recovered',
        isRealProbe: true,
        detectedProjectNumber: resolvedProj,
        newStatus: 'ready',
        healthScore: resp.healthScore,
        latencyMs: resp.latencyMs,
        modelUsed: resp.modelUsed,
        errorCategory: 'NONE',
        sanitizedMessage: null,
        cooldownUntil: null,
      };
      counts.recovered += 1;
      results.push(okItem);
      params.onItemCompleted?.(okItem);
      emitProgress(null, true);
      continue;
    }

    if (resp.inconclusive || resp.errorCategory === 'TEST_TIMEOUT_INCONCLUSIVE') {
      const preservedStatus: 'ready' | 'cooldown' | 'disabled' =
        key.status === 'ready' || key.status === 'cooldown' || key.status === 'disabled'
          ? key.status
          : 'cooldown';
      const inconclusiveItem: BatchCooldownItemResult = {
        id: key.id,
        maskedKey: key.maskedKey,
        label: key.label,
        outcome: 'inconclusive',
        isRealProbe: true,
        detectedProjectNumber: resolvedProj,
        newStatus: preservedStatus,
        healthScore: key.healthScore,
        latencyMs: resp.latencyMs,
        modelUsed: resp.modelUsed,
        errorCategory: 'TEST_TIMEOUT_INCONCLUSIVE',
        sanitizedMessage:
          resp.sanitizedMessage ||
          'Hết thời gian chờ khi thử khóa — chưa kết luận trạng thái khóa.',
        cooldownUntil: key.cooldownUntil,
      };
      counts.inconclusive += 1;
      results.push(inconclusiveItem);
      params.onItemCompleted?.(inconclusiveItem);
      emitProgress(null, true);
      continue;
    }

    const errCat = resp.errorCategory || 'UNKNOWN';
    if (
      resp.status === 'disabled' ||
      errCat === 'AUTH_INVALID_KEY' ||
      errCat === 'AUTH_FORBIDDEN_REPEATED'
    ) {
      const disabledItem: BatchCooldownItemResult = {
        id: key.id,
        maskedKey: key.maskedKey,
        label: key.label,
        outcome: 'disabled',
        isRealProbe: true,
        detectedProjectNumber: resolvedProj,
        newStatus: 'disabled',
        healthScore: resp.healthScore,
        latencyMs: resp.latencyMs,
        modelUsed: resp.modelUsed,
        errorCategory: errCat,
        sanitizedMessage: resp.sanitizedMessage || `Khóa bị vô hiệu hóa (${errCat})`,
        cooldownUntil: null,
      };
      counts.disabled += 1;
      counts.errorsByCategory[errCat] = (counts.errorsByCategory[errCat] ?? 0) + 1;
      results.push(disabledItem);
      params.onItemCompleted?.(disabledItem);
      emitProgress(null, true);
      // Kỷ luật (a): TUYỆT ĐỐI KHÔNG nhảy cóc với AUTH_INVALID_KEY
      continue;
    }

    const failItem: BatchCooldownItemResult = {
      id: key.id,
      maskedKey: key.maskedKey,
      label: key.label,
      outcome: 'still_failing',
      isRealProbe: true,
      detectedProjectNumber: resolvedProj,
      newStatus: 'cooldown',
      healthScore: resp.healthScore,
      latencyMs: resp.latencyMs,
      modelUsed: resp.modelUsed,
      errorCategory: errCat,
      sanitizedMessage: resp.sanitizedMessage || 'Khóa vẫn đang gặp lỗi',
      cooldownUntil: resp.cooldownUntil ?? key.cooldownUntil,
    };
    counts.stillFailing += 1;
    counts.errorsByCategory[errCat] = (counts.errorsByCategory[errCat] ?? 0) + 1;
    results.push(failItem);
    params.onItemCompleted?.(failItem);

    // Kỷ luật (a): CHỈ lưu vào failedProjects để nhảy cóc nếu thuộc 3 lỗi quota cấp Project
    if (resolvedProj && PROJECT_SCOPED_QUOTA_CATEGORIES.has(errCat)) {
      failedProjects.set(resolvedProj, {
        errorCategory: errCat,
        cooldownUntil: failItem.cooldownUntil,
        representativeKeyId: key.id,
        representativeMaskedKey: key.maskedKey,
        sanitizedMessage: failItem.sanitizedMessage || errCat,
      });
    }

    emitProgress(null, true);
  }

  if (params.shouldStop?.() && results.length < queue.length) {
    stoppedEarly = true;
  }

  const finalProgress: BatchCooldownProgress = {
    running: false,
    stoppedEarly,
    total: queue.length,
    processed: results.length,
    currentKeyId: null,
    currentMaskedKey: null,
    currentLabel: null,
    counts: {
      ...counts,
      errorsByCategory: { ...counts.errorsByCategory },
    },
    results: [...results],
    abortReason,
  };
  emitProgress(null, false);
  return finalProgress;
}

/**
 * Cập nhật duy nhất dòng key bị tác động trong snapshot cục bộ (và tính lại summary),
 * KHÔNG cần tải lại toàn bộ snapshot từ máy chủ sau mỗi lượt probe.
 */
export function applyBatchItemToSnapshot<
  K extends CooldownProbeKeyShape,
  S extends {
    keys: K[];
    summary: { total: number; ready: number; cooldown: number; disabled: number };
  },
>(snapshot: S, item: BatchCooldownItemResult, nowMs = Date.now()): S {
  if (item.outcome === 'deferred_debounce' || item.outcome === 'inconclusive') {
    return snapshot;
  }

  const projectCounts = new Map<string, number>();
  const nextKeys = snapshot.keys.map((k) => {
    if (k.id !== item.id) return k;
    const nextCooldownUntil = item.newStatus === 'cooldown' ? item.cooldownUntil : null;
    const nextRemainingSec =
      nextCooldownUntil !== null ? Math.max(0, Math.ceil((nextCooldownUntil - nowMs) / 1000)) : 0;

    return {
      ...k,
      status: item.newStatus,
      healthScore: item.healthScore,
      detectedProjectNumber: item.detectedProjectNumber ?? k.detectedProjectNumber,
      cooldownUntil: nextCooldownUntil,
      remainingCooldownSec: nextRemainingSec,
      cooldownReason:
        item.outcome === 'recovered'
          ? 'NONE'
          : item.errorCategory || k.cooldownReason,
      ...(Object.prototype.hasOwnProperty.call(k, 'pendingProbe') ? { pendingProbe: false } : {}),
      stats: {
        ...k.stats,
        lastErrorType:
          item.outcome === 'recovered' ? 'NONE' : item.errorCategory || k.stats.lastErrorType,
        lastErrorMessage:
          item.outcome === 'recovered'
            ? null
            : item.sanitizedMessage || k.stats.lastErrorMessage,
        lastErrorAt: item.outcome === 'recovered' ? k.stats.lastErrorAt : nowMs,
        lastTestLatencyMs: item.isRealProbe ? item.latencyMs : k.stats.lastTestLatencyMs,
        lastTestedAt: item.isRealProbe ? nowMs : k.stats.lastTestedAt,
      },
    };
  });

  for (const k of nextKeys) {
    if (k.detectedProjectNumber) {
      projectCounts.set(k.detectedProjectNumber, (projectCounts.get(k.detectedProjectNumber) ?? 0) + 1);
    }
  }

  const finalKeys = nextKeys.map((k) =>
    Object.prototype.hasOwnProperty.call(k, 'sameProjectKeyCount')
      ? {
          ...k,
          sameProjectKeyCount: k.detectedProjectNumber
            ? projectCounts.get(k.detectedProjectNumber) ?? 1
            : 0,
        }
      : k,
  );

  let ready = 0;
  let cooldown = 0;
  let disabled = 0;
  for (const k of finalKeys) {
    if (k.status === 'ready') ready += 1;
    else if (k.status === 'cooldown') cooldown += 1;
    else if (k.status === 'disabled') disabled += 1;
  }

  return {
    ...snapshot,
    keys: finalKeys,
    summary: {
      total: finalKeys.length,
      ready,
      cooldown,
      disabled,
    },
  };
}

export interface PoolReadinessBanner {
  severity: 'critical' | 'warn';
  code: 'LOW_TOTAL_KEYS' | 'LOW_READY_KEYS';
  title: string;
  message: string;
}

/**
 * KP-7 Tầng 2 (Y1): Cảnh báo trạng thái sẵn sàng của Kho Khóa khi số khóa sẵn sàng < 3,
 * phân biệt rõ "kho có ít hơn 3 khóa" (total < 3) vs "chỉ còn X/Y khóa sẵn sàng" (total >= 3 && ready < 3).
 */
export function evaluatePoolReadinessBanner(summary: {
  total: number;
  ready: number;
  cooldown?: number;
  disabled?: number;
}): PoolReadinessBanner | null {
  if (summary.ready >= 3) return null;

  if (summary.total < 3) {
    return {
      severity: summary.total === 0 ? 'critical' : 'warn',
      code: 'LOW_TOTAL_KEYS',
      title: 'Kho có ít hơn 3 khóa',
      message:
        summary.total === 0
          ? 'Kho hiện chưa có khóa Gemini nào (kho có ít hơn 3 khóa). Hãy dán danh sách khóa hoặc khôi phục từ gói sao lưu để sử dụng AI.'
          : `Kho có ít hơn 3 khóa (hiện có ${summary.total} khóa, ${summary.ready} sẵn sàng). Nên nạp tối thiểu 3 khóa để luân chuyển ổn định khi sinh hồ sơ nhiều chương.`,
    };
  }

  return {
    severity: summary.ready === 0 ? 'critical' : 'warn',
    code: 'LOW_READY_KEYS',
    title: `Chỉ còn ${summary.ready}/${summary.total} khóa sẵn sàng`,
    message: `Chỉ còn ${summary.ready}/${summary.total} khóa sẵn sàng (các khóa còn lại đang chờ nguội hoặc bị vô hiệu hóa). Bạn có thể chờ nguội, bấm kiểm tra lại khóa đang nguội hoặc bổ sung khóa mới.`,
  };
}

