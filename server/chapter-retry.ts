import type {
  CitationAuditResult,
  DeterministicRepairRecord,
  DistilledKnowledgeEntry,
  Kp3AuditFlag,
} from './knowledge-base/types.ts';
import {
  applyDeterministicCriticalFlagRepairs,
  buildCriticalFlagRetryAddendum,
  chooseBetterAudit,
  countAuditWords,
  hasDeterministicRepairHandler,
  shouldRetryForCriticalFlags,
  shouldRetryForZeroCitations,
  type UnrepairableCriticalCase,
  type VerifyCitationAuditOptions,
  verifyAcademicCitationsAndClaims,
} from './knowledge-base/verifier.ts';

export type ChapterRetryReason =
  | 'citations'
  | 'critical_flags'
  | 'citations+critical_flags';

export interface ChapterAttemptResult<TMeta = unknown> {
  rawText: string;
  meta?: TMeta;
  wasInterrupted: boolean;
  error?: unknown;
}

export interface TransformedChapterAttempt {
  bodyText: string;
  pendingAddendumToStream: string;
}

export interface GenerateWithRetryParams<TMeta = unknown> {
  basePrompt: string;
  citationRetryAddendum: string;
  allowedEntries: readonly DistilledKnowledgeEntry[];
  verifyOptions: VerifyCitationAuditOptions;
  chapterMode: 'overview' | 'palace_group' | 'period' | 'horizon' | 'chat';
  maxRetries?: number;
  initialAttempt?: ChapterAttemptResult<TMeta>;
  executeAttempt: (args: {
    prompt: string;
    attemptIndex: number;
    reason: ChapterRetryReason | null;
  }) => Promise<ChapterAttemptResult<TMeta>>;
  transformTextBeforeAudit?: (rawText: string) => TransformedChapterAttempt;
  onRetrying?: (info: {
    attemptIndex: number;
    reason: ChapterRetryReason;
    retryingForCitations: boolean;
    retryingForFlags: boolean;
    message: string;
  }) => void;
  isAborted?: () => boolean;
}

export interface GenerateWithRetryResult<TMeta = unknown> {
  chosenBodyText: string;
  chosenMeta?: TMeta;
  chosenAudit: CitationAuditResult | null;
  initialAuditFlags: Kp3AuditFlag[];
  pendingAddendumToStream: string;
  replacedFromInitial: boolean;
  wasInterrupted: boolean;
  retryCount: number;
  retryReasons: ChapterRetryReason[];
  deterministicRepairs: DeterministicRepairRecord[];
  unrepairableCases: UnrepairableCriticalCase[];
  wordCounts: {
    initial: number;
    chosen: number;
    attempts: number[];
  };
}

function defaultTransform(rawText: string): TransformedChapterAttempt {
  return { bodyText: rawText, pendingAddendumToStream: '' };
}

function buildRetryNoticeMessage(
  retryingForCitations: boolean,
  retryingForFlags: boolean,
): string {
  if (retryingForCitations && retryingForFlags) {
    return 'Đang sinh lại để sửa lỗi nghiêm trọng và bổ sung trích dẫn học thuật hợp lệ...';
  }
  if (retryingForFlags) {
    return 'Đang sinh lại để sửa lỗi nghiêm trọng theo dữ kiện lá số...';
  }
  return 'Đang sinh lại để bổ sung trích dẫn học thuật hợp lệ...';
}

/**
 * 1.5.9 (§3.1): Vòng lặp sinh lại thống nhất cho A2 (0 trích dẫn) + cờ critical (tối đa maxRetries = 2 lượt),
 * chọn bản theo `chooseBetterAudit` (§3.3) và sửa xác định `ILLEGAL_STAR_PAIR_KHONG_KIEP` sau vòng retry (§3.4).
 */
export async function generateWithRetry<TMeta = unknown>(
  params: GenerateWithRetryParams<TMeta>,
): Promise<GenerateWithRetryResult<TMeta>> {
  const maxRetries =
    typeof params.maxRetries === 'number' && params.maxRetries >= 0
      ? Math.floor(params.maxRetries)
      : 2;
  const transform = params.transformTextBeforeAudit ?? defaultTransform;

  const initialAttempt =
    params.initialAttempt ??
    (await params.executeAttempt({
      prompt: params.basePrompt,
      attemptIndex: 0,
      reason: null,
    }));

  if (initialAttempt.wasInterrupted || !initialAttempt.rawText.trim()) {
    return {
      chosenBodyText: initialAttempt.rawText,
      chosenMeta: initialAttempt.meta,
      chosenAudit: null,
      initialAuditFlags: [],
      pendingAddendumToStream: '',
      replacedFromInitial: false,
      wasInterrupted: initialAttempt.wasInterrupted,
      retryCount: 0,
      retryReasons: [],
      deterministicRepairs: [],
      unrepairableCases: [],
      wordCounts: {
        initial: countAuditWords(initialAttempt.rawText),
        chosen: countAuditWords(initialAttempt.rawText),
        attempts: [countAuditWords(initialAttempt.rawText)],
      },
    };
  }

  const initialTransformed = transform(initialAttempt.rawText);
  const initialAudit = verifyAcademicCitationsAndClaims(
    initialTransformed.bodyText,
    params.allowedEntries,
    params.verifyOptions,
  );
  const initialAuditFlags = initialAudit.auditFlags.filter(
    (f) => f.severity === 'critical',
  );
  const initialWordCount = countAuditWords(initialTransformed.bodyText);

  let chosenBodyText = initialTransformed.bodyText;
  let chosenMeta = initialAttempt.meta;
  let chosenAudit = initialAudit;
  let pendingAddendumToStream = initialTransformed.pendingAddendumToStream;
  let replacedFromInitial = false;
  let chosenWordCount = initialWordCount;
  const attemptWordCounts = [initialWordCount];

  let retryCount = 0;
  const retryReasons: ChapterRetryReason[] = [];
  let usedCitationRetry = false;
  let usedCriticalFlagRetry = false;

  while (retryCount < maxRetries && !(params.isAborted?.() ?? false)) {
    const needCitationRetry = shouldRetryForZeroCitations({
      validCitationIds: chosenAudit.validCitationIds,
      allowedEntriesCount: params.allowedEntries.length,
      chapterMode: params.chapterMode,
      wasInterrupted: false,
      alreadyRetried: usedCitationRetry,
    });
    const needFlagRetry = shouldRetryForCriticalFlags({
      auditFlags: chosenAudit.auditFlags,
      chapterMode: params.chapterMode,
      wasInterrupted: false,
      alreadyRetried: usedCriticalFlagRetry,
    });

    if (!needCitationRetry && !needFlagRetry) {
      break;
    }

    const criticalAddendum =
      needFlagRetry && params.verifyOptions.chart
        ? buildCriticalFlagRetryAddendum(
            chosenAudit.auditFlags,
            params.verifyOptions.chart,
          )
        : '';

    // Nếu cần retry cờ critical nhưng không có chỉ thị đặc hiệu (cờ chưa có handler) vẫn giữ nguyên trigger generic
    const reason: ChapterRetryReason =
      needCitationRetry && needFlagRetry
        ? 'citations+critical_flags'
        : needFlagRetry
          ? 'critical_flags'
          : 'citations';

    if (needCitationRetry) usedCitationRetry = true;
    if (needFlagRetry) usedCriticalFlagRetry = true;

    retryCount += 1;
    retryReasons.push(reason);

    const retryPromptParts = [params.basePrompt];
    if (criticalAddendum) {
      retryPromptParts.push(criticalAddendum);
    }
    if (needCitationRetry) {
      retryPromptParts.push(params.citationRetryAddendum);
    }
    const retryPrompt = retryPromptParts.join('');

    params.onRetrying?.({
      attemptIndex: retryCount,
      reason,
      retryingForCitations: needCitationRetry,
      retryingForFlags: needFlagRetry,
      message: buildRetryNoticeMessage(needCitationRetry, needFlagRetry),
    });

    let retryAttempt: ChapterAttemptResult<TMeta>;
    try {
      retryAttempt = await params.executeAttempt({
        prompt: retryPrompt,
        attemptIndex: retryCount,
        reason,
      });
    } catch (err) {
      retryAttempt = {
        rawText: '',
        wasInterrupted: true,
        error: err,
      };
    }

    // Dừng ngay nếu lượt sinh lại bị ngắt hoặc rỗng, bảo toàn bản tốt nhất đã có
    if (
      retryAttempt.wasInterrupted ||
      retryAttempt.error !== undefined ||
      !retryAttempt.rawText.trim() ||
      (params.isAborted?.() ?? false)
    ) {
      break;
    }

    const retryTransformed = transform(retryAttempt.rawText);
    const retryAudit = verifyAcademicCitationsAndClaims(
      retryTransformed.bodyText,
      params.allowedEntries,
      params.verifyOptions,
    );
    const retryWordCount = countAuditWords(retryTransformed.bodyText);
    attemptWordCounts.push(retryWordCount);

    const decision = chooseBetterAudit(
      chosenAudit,
      retryAudit,
      chosenBodyText,
      retryTransformed.bodyText,
    );

    if (decision.winner === 'retry') {
      chosenBodyText = retryTransformed.bodyText;
      chosenMeta = retryAttempt.meta ?? chosenMeta;
      chosenAudit = retryAudit;
      pendingAddendumToStream = '';
      replacedFromInitial = true;
      chosenWordCount = retryWordCount;
    }
  }

  let deterministicRepairs: DeterministicRepairRecord[] = [];
  let unrepairableCases: UnrepairableCriticalCase[] = [];

  if (
    params.verifyOptions.chart &&
    chosenAudit.auditFlags.some(
      (f) => f.severity === 'critical' && hasDeterministicRepairHandler(f.code),
    )
  ) {
    const repairOutcome = applyDeterministicCriticalFlagRepairs(
      chosenBodyText,
      chosenAudit.auditFlags,
      params.verifyOptions.chart,
      {
        ...params.verifyOptions,
        validCitationIdsSetUpper: new Set(
          chosenAudit.validCitationIds.map((id) => id.toUpperCase()),
        ),
      },
    );

    deterministicRepairs = repairOutcome.repairs;
    unrepairableCases = repairOutcome.unrepairableCases;

    if (
      repairOutcome.repairs.length > 0 &&
      repairOutcome.repairedText !== chosenBodyText
    ) {
      chosenBodyText = repairOutcome.repairedText;
      chosenAudit = verifyAcademicCitationsAndClaims(
        chosenBodyText,
        params.allowedEntries,
        params.verifyOptions,
      );
      chosenWordCount = countAuditWords(chosenBodyText);
      pendingAddendumToStream = '';
      replacedFromInitial = true;
    }
  }

  return {
    chosenBodyText,
    chosenMeta,
    chosenAudit,
    initialAuditFlags,
    pendingAddendumToStream,
    replacedFromInitial,
    wasInterrupted: false,
    retryCount,
    retryReasons,
    deterministicRepairs,
    unrepairableCases,
    wordCounts: {
      initial: initialWordCount,
      chosen: chosenWordCount,
      attempts: attemptWordCounts,
    },
  };
}
