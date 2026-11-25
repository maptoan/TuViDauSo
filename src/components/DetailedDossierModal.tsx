import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import { ZiweiChart } from '../lib/ziwei/types';
import {
  AiExecutionMeta,
  AiPeriodEntry,
  ContextualChatContextPayload,
  DOSSIER_CHAPTER_SPECS,
  DOSSIER_EDITORIAL_PRINT_CSS,
  DOSSIER_INTER_CHAPTER_PACING_MS,
  DossierChapterId,
  DossierChapterSpec,
  DossierChapterState,
  DualFuseChapterResult,
  DualFuseSummary,
  Kp3AuditFlag,
  ParsedAiFailureInfo,
  buildChartIdentityKey,
  buildDossierChapterCacheKey,
  buildDossierHeaderMetadata,
  buildDossierMarkdownExport,
  buildDossierPageOneHtml,
  buildDossierPlainTextExport,
  buildDossierStandaloneHtmlExport,
  buildDossierStorageKey,
  buildMultiYearMatrixTableHtml,
  buildPeriodCacheKeyForYear,
  classifyDossierFailure,
  createBestPartialSnapshot,
  formatDossierSourceBadge,
  getBrowserSessionStorage,
  getDossierChapterContentLength,
  normalizeKnownBareCitationTags,
  readDossierCacheEntry,
  resolveChapterDeterministicFactSheet,
  resolveChapterWithBestPartial,
  resolveDossierChapterFromCaches,
  runDossierSequentialWithDualFuse,
  saveDossierSectionToCache,
  setSharedDossierGenerating,
  simpleMarkdownToHtml,
  stripInternalExportMetaLines,
} from '../lib/dossier-chat-ui';
import {
  enforceCanonicalPalaceGroupHeadings,
  sanitizeAiVietnameseOutput,
  scrubInvalidCitationTags,
  verifyAndEnsureCompletePeriodSiHua,
} from '../lib/ziwei/text-sanitizer';
import { hasValidCachedPeriodEntry } from '../lib/key-pool-ui';
import {
  getDossierReadState,
  removeSingleDossierChapterFromLibrary,
  type LibraryHydrationStatus,
  type LibraryStorageHealth,
} from '../lib/chart-library';
import MarkdownContent from './MarkdownContent';
import {
  X,
  BookOpen,
  Sparkles,
  Play,
  Pause,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Download,
  FileText,
  Copy,
  Check,
  Printer,
  MessageSquareText,
  Layers,
  KeyRound,
  Library,
  Trash2,
  RotateCcw,
} from 'lucide-react';

interface DetailedDossierModalProps {
  open: boolean;
  onClose: () => void;
  chart: ZiweiChart;
  aiPeriodCache: Record<string, AiPeriodEntry>;
  onAiPeriodCacheChange: React.Dispatch<
    React.SetStateAction<Record<string, AiPeriodEntry>>
  >;
  onOpenContextualChat: (context: ContextualChatContextPayload) => void;
  onOpenKeyPool?: () => void;
  onOpenLibrary?: () => void;
  onDossierGeneratingChange?: (generating: boolean) => void;
  hydrationStatus?: LibraryHydrationStatus;
  storageHealth?: LibraryStorageHealth;
}

function isPeriodChapter(
  spec: DossierChapterSpec,
): spec is DossierChapterSpec & { year: number } {
  return spec.mode === 'period' && typeof spec.year === 'number';
}

function triggerFileDownload(
  filename: string,
  content: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slugifyName(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'la-so'
  );
}

export default function DetailedDossierModal({
  open,
  onClose,
  chart,
  aiPeriodCache,
  onAiPeriodCacheChange,
  onOpenContextualChat,
  onOpenKeyPool,
  onOpenLibrary,
  onDossierGeneratingChange,
  hydrationStatus = 'ready',
  storageHealth,
}: DetailedDossierModalProps) {
  const [selectedChapterId, setSelectedChapterId] =
    useState<DossierChapterId>('chapter_overview');
  const [localChapters, setLocalChapters] = useState<
    Partial<Record<DossierChapterId, DossierChapterState>>
  >({});
  const [autoRunning, setAutoRunning] = useState(false);
  const [pauseRequested, setPauseRequested] = useState(false);
  const [activeGeneratingId, setActiveGeneratingId] =
    useState<DossierChapterId | null>(null);
  const [showFactSheet, setShowFactSheet] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [confirmDeleteChapterId, setConfirmDeleteChapterId] =
    useState<DossierChapterId | null>(null);
  const [deletedChapterUndo, setDeletedChapterUndo] = useState<{
    chartIdentityKey: string;
    chapterId: DossierChapterId;
    chapterLabelVi: string;
    chapterState: DossierChapterState;
    periodEntryBackup?: AiPeriodEntry;
  } | null>(null);
  const [autoRunPass, setAutoRunPass] = useState<1 | 2>(1);
  const [autoRunSummary, setAutoRunSummary] = useState<DualFuseSummary | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const cancelAutoRef = useRef(false);
  const pauseAfterCurrentRef = useRef(false);
  const bestPartialMapRef = useRef<Map<string, DossierChapterState>>(new Map());
  const aiPeriodCacheRef = useRef(aiPeriodCache);
  aiPeriodCacheRef.current = aiPeriodCache;

  const localChaptersRef = useRef(localChapters);
  localChaptersRef.current = localChapters;

  const isGeneratingRef = useRef(false);
  isGeneratingRef.current = autoRunning || activeGeneratingId !== null;

  const chartIdentityKey = useMemo(() => buildChartIdentityKey(chart), [chart]);
  const dossierStorageKey = useMemo(
    () => buildDossierStorageKey(chartIdentityKey),
    [chartIdentityKey],
  );
  const isHydrated = hydrationStatus === 'ready' || hydrationStatus === 'degraded';
  const prevChartKeyRef = useRef<string>(chartIdentityKey);

  // Dọn dẹp khi đóng modal, đổi lá số hoặc unmount (khai báo trước useEffect nạp hồ sơ để tránh TDZ)
  const stopAllGeneration = useCallback(() => {
    cancelAutoRef.current = true;
    pauseAfterCurrentRef.current = false;
    abortRef.current?.abort();
    setAutoRunning(false);
    setPauseRequested(false);
    setActiveGeneratingId(null);
    setSharedDossierGenerating(false);
    onDossierGeneratingChange?.(false);
  }, [onDossierGeneratingChange]);

  // ĐC-1 + ĐC-3 + Mục vá 3A (LK-06 & LK-09):
  // - Đổi lá số -> dừng stream cũ (nếu có) & xóa ngay localChapters cũ kể cả khi !isHydrated.
  // - Cùng lá số -> bảo vệ chương đang 'loading' hoặc vừa sinh mới hơn trong phiên, từ chối section lệch khóa.
  // - Theo dõi cả `open` để cập nhật sạch nếu người dùng vừa xóa hồ sơ ở ChartLibraryModal.
  useEffect(() => {
    const isChartChanged = prevChartKeyRef.current !== chartIdentityKey;
    if (isChartChanged) {
      prevChartKeyRef.current = chartIdentityKey;
      setSelectedChapterId('chapter_overview');
      setConfirmDeleteChapterId(null);
      setDeletedChapterUndo(null);
      setAutoRunSummary(null);
      if (isGeneratingRef.current) {
        stopAllGeneration();
      }
    }

    const readState = getDossierReadState(chartIdentityKey, chart);
    const rawStored =
      readState.record ??
      readDossierCacheEntry(getBrowserSessionStorage(), dossierStorageKey, chart);
    const stored =
      rawStored && rawStored.chartIdentityKey === chartIdentityKey ? rawStored : null;

    if (stored && stored.sections) {
      const fromStorage: Partial<Record<DossierChapterId, DossierChapterState>> = {};
      const periodPatches: Array<{
        periodKey: string;
        text?: string;
        incomplete?: boolean;
        incompleteText?: string;
        interruptedReason?: string;
        error?: string;
        meta?: AiExecutionMeta;
        auditFlags?: Kp3AuditFlag[];
      }> = [];

      for (const [k, val] of Object.entries(stored.sections)) {
        if (!val) continue;
        const chId = k as DossierChapterId;
        const expectedSectionKey = buildDossierChapterCacheKey(chartIdentityKey, chId);
        // LK-06 & ĐC-3: Từ chối mọi chương có sectionCacheKey thuộc về lá số khác
        if (val.sectionCacheKey && val.sectionCacheKey !== expectedSectionKey) {
          continue;
        }
        if (val.status === 'completed' && val.text?.trim()) {
          fromStorage[chId] = {
            ...val,
            sectionCacheKey: expectedSectionKey,
            sourceBadge: formatDossierSourceBadge('cache'),
          };
          if (chId === 'year_2026' || chId === 'year_2027') {
            const yr = chId === 'year_2026' ? 2026 : 2027;
            periodPatches.push({
              periodKey: buildPeriodCacheKeyForYear(chart, yr),
              text: val.text,
              meta: val.meta,
              auditFlags: val.auditFlags,
            });
          }
        } else if (val.status === 'incomplete' && val.incompleteText?.trim()) {
          fromStorage[chId] = {
            ...val,
            sectionCacheKey: expectedSectionKey,
            sourceBadge: formatDossierSourceBadge('cache'),
          };
          if (chId === 'year_2026' || chId === 'year_2027') {
            const yr = chId === 'year_2026' ? 2026 : 2027;
            periodPatches.push({
              periodKey: buildPeriodCacheKeyForYear(chart, yr),
              incomplete: true,
              incompleteText: val.incompleteText,
              interruptedReason: val.interruptedReason,
              error: val.error,
              meta: val.meta,
              auditFlags: val.auditFlags,
            });
          }
        }
      }

      setLocalChapters((prev) => {
        if (isChartChanged) {
          return fromStorage;
        }
        // LK-06: Khi trên cùng lá số, bảo vệ chương đang 'loading' hoặc vừa sinh mới hơn trong phiên
        const merged: Partial<Record<DossierChapterId, DossierChapterState>> = {
          ...fromStorage,
        };
        for (const spec of DOSSIER_CHAPTER_SPECS) {
          const chId = spec.id;
          const expectedKey = buildDossierChapterCacheKey(chartIdentityKey, chId);
          const prevCh = prev[chId];
          if (!prevCh || prevCh.sectionCacheKey !== expectedKey) continue;
          if (prevCh.status === 'loading') {
            merged[chId] = prevCh;
          } else if (
            prevCh.status === 'completed' &&
            prevCh.text?.trim() &&
            (!merged[chId] || (prevCh.updatedAt ?? 0) > (merged[chId]?.updatedAt ?? 0))
          ) {
            merged[chId] = prevCh;
          }
        }
        return merged;
      });

      if (periodPatches.length > 0) {
        onAiPeriodCacheChange((prev) => {
          let changed = false;
          const updated = { ...prev };
          for (const patch of periodPatches) {
            if (patch.text && !hasValidCachedPeriodEntry(updated[patch.periodKey])) {
              updated[patch.periodKey] = {
                text: patch.text,
                meta: patch.meta,
                ...(patch.auditFlags?.length ? { auditFlags: patch.auditFlags } : {}),
              };
              changed = true;
            } else if (
              patch.incomplete &&
              patch.incompleteText &&
              !hasValidCachedPeriodEntry(updated[patch.periodKey]) &&
              !updated[patch.periodKey]?.incomplete
            ) {
              updated[patch.periodKey] = {
                incomplete: true,
                incompleteText: patch.incompleteText,
                interruptedReason: patch.interruptedReason,
                error: patch.error,
                meta: patch.meta,
                ...(patch.auditFlags?.length ? { auditFlags: patch.auditFlags } : {}),
              };
              changed = true;
            }
          }
          return changed ? updated : prev;
        });
      }
    } else if (isChartChanged) {
      // Mục vá 3A: Khi đổi sang lá số khác chưa có hồ sơ, xóa ngay localChapters cũ kể cả khi !isHydrated
      setLocalChapters({});
    } else if (isHydrated) {
      // LK-06 & LK-09: Khi đã hydrated trên cùng lá số mà storage rỗng (vd vừa xóa dossier_only),
      // chỉ giữ lại chương đang 'loading' (nếu có) của đúng lá số hiện tại
      setLocalChapters((prev) => {
        const keptLoading: Partial<Record<DossierChapterId, DossierChapterState>> = {};
        for (const spec of DOSSIER_CHAPTER_SPECS) {
          const ch = prev[spec.id];
          const expectedKey = buildDossierChapterCacheKey(chartIdentityKey, spec.id);
          if (ch && ch.sectionCacheKey === expectedKey && ch.status === 'loading') {
            keptLoading[spec.id] = ch;
          }
        }
        return keptLoading;
      });
    }
  }, [
    open,
    chartIdentityKey,
    dossierStorageKey,
    chart,
    hydrationStatus,
    isHydrated,
    stopAllGeneration,
    onAiPeriodCacheChange,
  ]);

  // Lưu bất kỳ chương hoàn tất hoặc dở dang có nội dung vào SSOT IndexedDB/gương RAM (+ write-through sessionStorage)
  const persistSectionToStorage = useCallback(
    (chapterId: DossierChapterId, chapterState: DossierChapterState) => {
      saveDossierSectionToCache(
        getBrowserSessionStorage(),
        chart,
        chapterId,
        chapterState,
      );
    },
    [chart],
  );

  useEffect(() => {
    if (!open && (autoRunning || activeGeneratingId !== null)) {
      stopAllGeneration();
    }
  }, [open, autoRunning, activeGeneratingId, stopAllGeneration]);

  useEffect(() => {
    return () => {
      cancelAutoRef.current = true;
      abortRef.current?.abort();
      setSharedDossierGenerating(false);
    };
  }, []);

  // Hợp nhất trạng thái hiện tại của cả 8 chương
  const resolvedStatesMap = useMemo(() => {
    const map = {} as Record<DossierChapterId, DossierChapterState>;
    for (const spec of DOSSIER_CHAPTER_SPECS) {
      map[spec.id] = resolveDossierChapterFromCaches(
        chart,
        spec,
        aiPeriodCache,
        localChapters,
      );
    }
    return map;
  }, [chart, aiPeriodCache, localChapters]);

  const completedCount = useMemo(
    () =>
      DOSSIER_CHAPTER_SPECS.filter(
        (s) =>
          resolvedStatesMap[s.id]?.status === 'completed' &&
          Boolean(resolvedStatesMap[s.id]?.text?.trim()),
      ).length,
    [resolvedStatesMap],
  );

  const selectedSpec =
    DOSSIER_CHAPTER_SPECS.find((s) => s.id === selectedChapterId) ??
    DOSSIER_CHAPTER_SPECS[0];
  const selectedState = resolvedStatesMap[selectedSpec.id];

  const selectedDeterministic = useMemo(
    () => resolveChapterDeterministicFactSheet(chart, selectedSpec),
    [chart, selectedSpec],
  );

  const headerMeta = useMemo(() => buildDossierHeaderMetadata(chart), [chart]);
  const pageOneHtml = useMemo(
    () => buildDossierPageOneHtml(chart, completedCount),
    [chart, completedCount],
  );
  const matrix5yHtml = useMemo(
    () => buildMultiYearMatrixTableHtml(chart, 5),
    [chart],
  );
  const matrix10yHtml = useMemo(
    () => buildMultiYearMatrixTableHtml(chart, 10),
    [chart],
  );

  // Thực thi sinh 1 chương qua SSE (dùng lại /api/interpret-period hoặc /api/interpret-dossier-section)
  const executeSingleChapterStream = useCallback(
    async (spec: DossierChapterSpec): Promise<DualFuseChapterResult> => {
      const sectionCacheKey = buildDossierChapterCacheKey(
        chartIdentityKey,
        spec.id,
      );
      const isPeriod = isPeriodChapter(spec);
      const periodCtx = isPeriod
        ? resolveChapterDeterministicFactSheet(chart, spec).periodContext
        : null;
      const periodKey = isPeriod
        ? buildPeriodCacheKeyForYear(chart, spec.year)
        : '';

      const existingSnapshot = bestPartialMapRef.current.get(sectionCacheKey) ?? null;
      const currentBeforeRun = resolveDossierChapterFromCaches(
        chart,
        spec,
        aiPeriodCacheRef.current,
        localChaptersRef.current,
      );
      const candidateSnapshot = createBestPartialSnapshot(currentBeforeRun);
      const bestSnapshot =
        candidateSnapshot &&
        getDossierChapterContentLength(candidateSnapshot) >=
          getDossierChapterContentLength(existingSnapshot)
          ? candidateSnapshot
          : existingSnapshot;
      if (bestSnapshot) {
        bestPartialMapRef.current.set(sectionCacheKey, bestSnapshot);
      }

      const applyFailureWithBestPartial = (
        incomingState: DossierChapterState,
        failure: ParsedAiFailureInfo,
      ): DualFuseChapterResult => {
        const { resolvedState } = resolveChapterWithBestPartial(bestSnapshot, incomingState);
        if (
          resolvedState.status === 'completed' ||
          (resolvedState.status === 'incomplete' && resolvedState.incompleteText?.trim())
        ) {
          bestPartialMapRef.current.set(sectionCacheKey, resolvedState);
          persistSectionToStorage(spec.id, resolvedState);
        }

        if (isPeriod && periodKey) {
          onAiPeriodCacheChange((prev) => {
            if (resolvedState.status === 'completed' && resolvedState.text?.trim()) {
              return {
                ...prev,
                [periodKey]: {
                  text: resolvedState.text,
                  meta: resolvedState.meta,
                  ...(resolvedState.auditFlags?.length
                    ? { auditFlags: resolvedState.auditFlags }
                    : {}),
                },
              };
            }
            if (
              resolvedState.status === 'incomplete' &&
              resolvedState.incompleteText?.trim()
            ) {
              return {
                ...prev,
                [periodKey]: {
                  incomplete: true,
                  incompleteText: resolvedState.incompleteText,
                  interruptedReason: resolvedState.interruptedReason,
                  error: resolvedState.error,
                  errorCode: resolvedState.errorCode,
                  errorCategory: resolvedState.errorCategory,
                  minRemainingCooldownSec: resolvedState.minRemainingCooldownSec,
                  meta: resolvedState.meta,
                  ...(resolvedState.auditFlags?.length
                    ? { auditFlags: resolvedState.auditFlags }
                    : {}),
                },
              };
            }
            return {
              ...prev,
              [periodKey]: {
                notConfigured: failure.notConfigured,
                errorCode: failure.errorCode,
                errorCategory: failure.errorCategory,
                minRemainingCooldownSec: failure.minRemainingCooldownSec,
                error: resolvedState.error || failure.userMessageVi,
              },
            };
          });
        }

        setLocalChapters((prev) => ({
          ...prev,
          [spec.id]: resolvedState,
        }));

        return {
          status: incomingState.status === 'incomplete' ? 'incomplete' : 'error',
          failure,
        };
      };

      if (isPeriod && !periodCtx) {
        const msg = `Không thể tạo ngữ cảnh Lưu Niên cho năm ${spec.year}.`;
        const failure = classifyDossierFailure({
          error: 'AI_CALL_FAILED',
          errorCategory: 'NETWORK_OR_5XX',
          message: msg,
        });
        return applyFailureWithBestPartial(
          {
            chapterId: spec.id,
            sectionCacheKey,
            status: 'error',
            error: msg,
            errorCode: failure.errorCode,
            errorCategory: failure.errorCategory,
            updatedAt: Date.now(),
          },
          failure,
        );
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setActiveGeneratingId(spec.id);
      setLocalChapters((prev) => ({
        ...prev,
        [spec.id]: {
          chapterId: spec.id,
          sectionCacheKey,
          status: 'loading',
          sourceBadge: formatDossierSourceBadge('generated'),
        },
      }));

      if (isPeriod && periodKey) {
        onAiPeriodCacheChange((prev) => {
          const next = { ...prev };
          delete next[periodKey];
          return next;
        });
      }

      try {
        const endpoint = isPeriod
          ? '/api/interpret-period'
          : '/api/interpret-dossier-section';
        const bodyPayload = isPeriod
          ? { chart, periodContext: periodCtx }
          : { chart, sectionId: spec.sectionId };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
          signal: controller.signal,
        });

        if (!res.ok) {
          let errJson: {
            error?: string;
            errorCategory?: string;
            minRemainingCooldownSec?: number | null;
            message?: string;
          } | null = null;
          try {
            errJson = await res.json();
          } catch {
            // ignore
          }
          const failure = classifyDossierFailure({
            httpStatus: res.status,
            error: errJson?.error,
            errorCategory: errJson?.errorCategory,
            minRemainingCooldownSec: errJson?.minRemainingCooldownSec ?? null,
            message:
              errJson?.message ||
              'Chưa thể gọi Gemini API cho chương này (kho khóa chưa sẵn sàng hoặc đang nguội).',
          });
          return applyFailureWithBestPartial(
            {
              chapterId: spec.id,
              sectionCacheKey,
              status: 'error',
              errorCode: failure.errorCode,
              errorCategory: failure.errorCategory,
              minRemainingCooldownSec: failure.minRemainingCooldownSec,
              error: failure.userMessageVi,
              updatedAt: Date.now(),
            },
            failure,
          );
        }

        if (!res.body) {
          const failure = classifyDossierFailure({
            error: 'AI_CALL_FAILED',
            errorCategory: 'NETWORK_OR_5XX',
            message: 'Không nhận được luồng phản hồi SSE từ máy chủ.',
          });
          return applyFailureWithBestPartial(
            {
              chapterId: spec.id,
              sectionCacheKey,
              status: 'error',
              errorCode: failure.errorCode,
              errorCategory: failure.errorCategory,
              error: failure.userMessageVi,
              updatedAt: Date.now(),
            },
            failure,
          );
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '';
        let accumulated = '';
        let receivedMeta: AiExecutionMeta | undefined;
        let streamError: string | null = null;
        let streamErrorCode: string | null = null;
        let streamErrorCategory: string | null = null;
        let streamCooldownSec: number | null = null;
        let wasInterrupted = false;
        let interruptedMsg = '';
        let interruptedCategory: string | null = null;
        let interruptedCooldownSec: number | null = null;
        let scrubbedInvalidCitationIds: string[] = [];
        let normalizedBareCitationIds: string[] = [];
        let receivedAuditFlags: Kp3AuditFlag[] = [];

        const processLine = (line: string): boolean => {
          if (!line.startsWith('data: ')) return false;
          const data = line.slice(6).trim();
          if (data === '[DONE]') return true;
          try {
            const parsed = JSON.parse(data);
            if (parsed?.meta) {
              receivedMeta = parsed.meta as AiExecutionMeta;
              if (isPeriod && periodKey) {
                onAiPeriodCacheChange((prev) => ({
                  ...prev,
                  [periodKey]: {
                    ...(prev[periodKey] || {}),
                    meta: receivedMeta,
                  },
                }));
              } else {
                setLocalChapters((prev) => ({
                  ...prev,
                  [spec.id]: {
                    ...(prev[spec.id] || {
                      chapterId: spec.id,
                      sectionCacheKey,
                      status: 'loading',
                    }),
                    status: 'loading',
                    meta: receivedMeta,
                  },
                }));
              }
              return false;
            }
            if (parsed?.citationAudit) {
              if (Array.isArray(parsed.citationAudit.scrubbedInvalidIds)) {
                scrubbedInvalidCitationIds = parsed.citationAudit.scrubbedInvalidIds.filter(
                  (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0,
                );
              }
              if (Array.isArray(parsed.citationAudit.normalizedBareIds)) {
                normalizedBareCitationIds = parsed.citationAudit.normalizedBareIds.filter(
                  (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0,
                );
              }
              if (Array.isArray(parsed.citationAudit.auditFlags)) {
                receivedAuditFlags = parsed.citationAudit.auditFlags.filter(
                  (f: unknown): f is Kp3AuditFlag =>
                    Boolean(f) &&
                    typeof f === 'object' &&
                    typeof (f as Kp3AuditFlag).code === 'string' &&
                    typeof (f as Kp3AuditFlag).messageVi === 'string',
                );
              }
              return false;
            }
            if (parsed?.interrupted) {
              wasInterrupted = true;
              interruptedMsg =
                parsed.message || 'Luồng kết nối Gemini bị gián đoạn giữa chừng.';
              if (typeof parsed.errorCategory === 'string') {
                interruptedCategory = parsed.errorCategory;
              }
              if (typeof parsed.minRemainingCooldownSec === 'number') {
                interruptedCooldownSec = parsed.minRemainingCooldownSec;
              }
              return false;
            }
            if (parsed?.error) {
              streamError = parsed.message || 'Lời gọi Gemini API gặp lỗi.';
              if (typeof parsed.error === 'string') {
                streamErrorCode = parsed.error;
              }
              if (typeof parsed.errorCategory === 'string') {
                streamErrorCategory = parsed.errorCategory;
              }
              if (typeof parsed.minRemainingCooldownSec === 'number') {
                streamCooldownSec = parsed.minRemainingCooldownSec;
              }
              return false;
            }
            const deltaText = parsed?.delta?.text ?? '';
            if (deltaText) {
              accumulated = sanitizeAiVietnameseOutput(accumulated + deltaText);
              if (isPeriod && periodKey) {
                onAiPeriodCacheChange((prev) => ({
                  ...prev,
                  [periodKey]: {
                    text: accumulated,
                    meta: receivedMeta,
                  },
                }));
              } else {
                setLocalChapters((prev) => ({
                  ...prev,
                  [spec.id]: {
                    chapterId: spec.id,
                    sectionCacheKey,
                    status: 'loading',
                    text: accumulated,
                    meta: receivedMeta,
                    sourceBadge: formatDossierSourceBadge('generated'),
                  },
                }));
              }
            }
          } catch {
            // ignore partial JSON
          }
          return false;
        };

        let doneSignal = false;
        while (!doneSignal) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split('\n');
          sseBuffer = lines.pop() ?? '';
          for (const line of lines) {
            if (processLine(line)) {
              doneSignal = true;
              break;
            }
          }
        }
        if (!doneSignal && sseBuffer.trim()) {
          processLine(sseBuffer.trim());
        }

        // Pipeline chốt lớp 2 (idempotent) ngay sau vòng lặp SSE, trước cả nhánh đứt luồng lẫn nhánh hoàn tất:
        // 1) sanitizeAiVietnameseOutput -> 2) Z3 normalizeKnownBareCitationTags -> 3) scrubInvalidCitationTags -> 4) verifyAndEnsureCompletePeriodSiHua -> 5) enforceCanonicalPalaceGroupHeadings
        accumulated = sanitizeAiVietnameseOutput(accumulated);
        if (normalizedBareCitationIds.length > 0 && accumulated) {
          accumulated = normalizeKnownBareCitationTags(
            accumulated,
            normalizedBareCitationIds,
          );
        }
        if (scrubbedInvalidCitationIds.length > 0) {
          accumulated = scrubInvalidCitationTags(accumulated, {
            invalidIds: scrubbedInvalidCitationIds,
          });
        }
        if (isPeriod && periodCtx && !wasInterrupted && !streamError && accumulated.trim()) {
          accumulated = verifyAndEnsureCompletePeriodSiHua(
            accumulated,
            periodCtx,
          ).patchedText;
        }
        if (
          spec.id === 'palaces_core' ||
          spec.id === 'palaces_family' ||
          spec.id === 'palaces_social_health'
        ) {
          accumulated = enforceCanonicalPalaceGroupHeadings(accumulated, chart);
        }

        const persistedAuditFlags =
          receivedAuditFlags.length > 0 ? receivedAuditFlags : undefined;

        if (wasInterrupted || streamError) {
          const failure = classifyDossierFailure({
            error: streamErrorCode,
            errorCategory: streamErrorCategory ?? interruptedCategory,
            minRemainingCooldownSec: streamCooldownSec ?? interruptedCooldownSec,
            message: interruptedMsg || streamError,
            interrupted: wasInterrupted,
          });
          const hasPartialText = accumulated.trim().length > 0;
          if (!hasPartialText) {
            return applyFailureWithBestPartial(
              {
                chapterId: spec.id,
                sectionCacheKey,
                status: 'error',
                error: failure.userMessageVi,
                errorCode: failure.errorCode,
                errorCategory: failure.errorCategory,
                minRemainingCooldownSec: failure.minRemainingCooldownSec,
                updatedAt: Date.now(),
              },
              failure,
            );
          }

          const partialMeta = receivedMeta
            ? { ...receivedMeta, interrupted: true }
            : undefined;
          return applyFailureWithBestPartial(
            {
              chapterId: spec.id,
              sectionCacheKey,
              status: 'incomplete',
              incompleteText: accumulated,
              interruptedReason: failure.userMessageVi,
              error: failure.userMessageVi,
              errorCode: failure.errorCode,
              errorCategory: failure.errorCategory,
              minRemainingCooldownSec: failure.minRemainingCooldownSec,
              meta: partialMeta,
              ...(persistedAuditFlags ? { auditFlags: persistedAuditFlags } : {}),
              sourceBadge: formatDossierSourceBadge('generated'),
              updatedAt: Date.now(),
            },
            failure,
          );
        }

        if (!accumulated.trim()) {
          const failure = classifyDossierFailure({
            error: 'AI_CALL_FAILED',
            errorCategory: 'NETWORK_OR_5XX',
            message: 'Phản hồi từ AI trống. Vui lòng thử lại chương này.',
          });
          return applyFailureWithBestPartial(
            {
              chapterId: spec.id,
              sectionCacheKey,
              status: 'error',
              error: failure.userMessageVi,
              errorCode: failure.errorCode,
              errorCategory: failure.errorCategory,
              updatedAt: Date.now(),
            },
            failure,
          );
        }

        const completedState: DossierChapterState = {
          chapterId: spec.id,
          sectionCacheKey,
          status: 'completed',
          text: accumulated,
          meta: receivedMeta,
          ...(persistedAuditFlags ? { auditFlags: persistedAuditFlags } : {}),
          sourceBadge: formatDossierSourceBadge('generated'),
          updatedAt: Date.now(),
        };

        bestPartialMapRef.current.set(sectionCacheKey, completedState);
        if (isPeriod && periodKey) {
          onAiPeriodCacheChange((prev) => ({
            ...prev,
            [periodKey]: {
              text: accumulated,
              meta: receivedMeta,
              ...(persistedAuditFlags ? { auditFlags: persistedAuditFlags } : {}),
            },
          }));
        }
        setLocalChapters((prev) => ({
          ...prev,
          [spec.id]: completedState,
        }));
        persistSectionToStorage(spec.id, completedState);

        return { status: 'completed' };
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          const failure = classifyDossierFailure({ aborted: true });
          if (bestSnapshot) {
            const { resolvedState } = resolveChapterWithBestPartial(bestSnapshot, {
              chapterId: spec.id,
              sectionCacheKey,
              status: 'error',
              error: failure.userMessageVi,
              errorCode: failure.errorCode,
              errorCategory: failure.errorCategory,
            });
            setLocalChapters((prev) => ({
              ...prev,
              [spec.id]: resolvedState,
            }));
          }
          return { status: 'aborted', failure };
        }
        const failure = classifyDossierFailure({
          error: 'AI_CALL_FAILED',
          errorCategory: 'NETWORK_OR_5XX',
          message: 'Mất kết nối trong lúc sinh chương hồ sơ. Vui lòng thử lại.',
        });
        return applyFailureWithBestPartial(
          {
            chapterId: spec.id,
            sectionCacheKey,
            status: 'error',
            error: failure.userMessageVi,
            errorCode: failure.errorCode,
            errorCategory: failure.errorCategory,
            updatedAt: Date.now(),
          },
          failure,
        );
      } finally {
        setActiveGeneratingId((curr) => (curr === spec.id ? null : curr));
      }
    },
    [
      chart,
      chartIdentityKey,
      onAiPeriodCacheChange,
      persistSectionToStorage,
    ],
  );

  // Sinh đơn lẻ 1 chương (ĐC-1: chờ nạp xong IndexedDB trước khi cho phép sinh đè)
  const handleGenerateSingleChapter = async (chapterId: DossierChapterId) => {
    if (!isHydrated || autoRunning || activeGeneratingId !== null) return;
    const spec = DOSSIER_CHAPTER_SPECS.find((s) => s.id === chapterId);
    if (!spec) return;

    setSelectedChapterId(spec.id);
    setAutoRunSummary(null);
    setSharedDossierGenerating(true);
    onDossierGeneratingChange?.(true);
    try {
      await executeSingleChapterStream(spec);
    } finally {
      setSharedDossierGenerating(false);
      onDossierGeneratingChange?.(false);
    }
  };

  // F6 + KP-6: Bộ điều phối tuần tự 2 cầu chì (Pass 1 chạy hết bỏ qua lỗi tạm thời -> Pass 2 thử lại đúng 1 vòng)
  const handleRunAllSequential = async () => {
    if (!isHydrated || autoRunning || activeGeneratingId !== null) return;

    const specsToRun = DOSSIER_CHAPTER_SPECS.filter((spec) => {
      const current = resolveDossierChapterFromCaches(
        chart,
        spec,
        aiPeriodCacheRef.current,
        localChaptersRef.current,
      );
      if (isPeriodChapter(spec)) {
        const pKey = buildPeriodCacheKeyForYear(chart, spec.year);
        return (
          !hasValidCachedPeriodEntry(aiPeriodCacheRef.current[pKey]) &&
          !(current.status === 'completed' && current.text?.trim())
        );
      }
      return !(current.status === 'completed' && current.text?.trim());
    });

    if (specsToRun.length === 0) return;

    cancelAutoRef.current = false;
    pauseAfterCurrentRef.current = false;
    setAutoRunning(true);
    setPauseRequested(false);
    setAutoRunPass(1);
    setAutoRunSummary(null);
    setSharedDossierGenerating(true);
    onDossierGeneratingChange?.(true);

    try {
      const summary = await runDossierSequentialWithDualFuse({
        specsToRun,
        pacingMs: DOSSIER_INTER_CHAPTER_PACING_MS,
        shouldStop: () => cancelAutoRef.current,
        shouldPause: () => pauseAfterCurrentRef.current,
        onPassChange: (pass) => {
          setAutoRunPass(pass);
        },
        runChapter: async (spec) => {
          setSelectedChapterId(spec.id);
          return executeSingleChapterStream(spec);
        },
        waitBetweenChapters: (ms) =>
          new Promise<void>((resolve) => {
            const timer = window.setTimeout(() => {
              window.clearInterval(checkInterval);
              resolve();
            }, ms);
            const checkInterval = window.setInterval(() => {
              if (cancelAutoRef.current || pauseAfterCurrentRef.current) {
                window.clearTimeout(timer);
                window.clearInterval(checkInterval);
                resolve();
              }
            }, 150);
          }),
      });
      setAutoRunSummary(summary);
    } finally {
      setAutoRunning(false);
      setPauseRequested(false);
      pauseAfterCurrentRef.current = false;
      setSharedDossierGenerating(false);
      onDossierGeneratingChange?.(false);
    }
  };

  const handlePauseAfterCurrent = () => {
    pauseAfterCurrentRef.current = true;
    setPauseRequested(true);
  };

  const fileSlug = slugifyName(chart.birthInfo.name || 'duong-so');

  const handleDownloadHtml = () => {
    const html = buildDossierStandaloneHtmlExport(chart, resolvedStatesMap);
    triggerFileDownload(
      `ho-so-tu-vi-${fileSlug}.html`,
      html,
      'text/html;charset=utf-8',
    );
  };

  const handleDownloadMd = () => {
    const md = buildDossierMarkdownExport(chart, resolvedStatesMap);
    triggerFileDownload(
      `ho-so-tu-vi-${fileSlug}.md`,
      md,
      'text/markdown;charset=utf-8',
    );
  };

  const handleCopyAll = async () => {
    try {
      const plain = buildDossierPlainTextExport(chart, resolvedStatesMap);
      await navigator.clipboard.writeText(plain);
      setCopiedAll(true);
      window.setTimeout(() => setCopiedAll(false), 2200);
    } catch {
      // ignore clipboard errors
    }
  };

  const handlePrintDirect = () => {
    window.print();
  };

  const handleOpenChatForSelectedChapter = () => {
    const excerpt =
      selectedState.text?.trim() ||
      selectedState.incompleteText?.trim() ||
      selectedDeterministic.factSheetMarkdown;
    onOpenContextualChat({
      chart,
      contextMode: isPeriodChapter(selectedSpec) ? 'period' : 'natal',
      contextKey: `dossier_${selectedSpec.id}`,
      sectionTitle: selectedSpec.titleVi,
      periodContext: selectedDeterministic.periodContext,
      factSheetVi: selectedDeterministic.factSheetMarkdown,
      excerptVi: excerpt,
      starterQuestions: [
        `Điểm mấu chốt cần hành động ngay trong ${selectedSpec.shortLabelVi}?`,
        `Tứ Hóa nào tác động mạnh nhất ở chương này và cần lưu ý rủi ro gì?`,
        `Nếu muốn cải thiện vận thế của phần này, đương số nên ưu tiên điều gì?`,
      ],
    });
  };

  // QĐ-L8 (Phương án B tăng cường C1+): Xóa riêng 1 chương đang chọn (có xác nhận tại chỗ & hoàn tác trong phiên)
  const handleConfirmDeleteSelectedChapter = () => {
    if (!isHydrated || isAnyBusy) return;
    if (selectedState.status !== 'completed' && selectedState.status !== 'incomplete') return;

    const snapshotState: DossierChapterState = {
      ...selectedState,
      sectionCacheKey: buildDossierChapterCacheKey(chartIdentityKey, selectedSpec.id),
    };
    const pKey = isPeriodChapter(selectedSpec)
      ? buildPeriodCacheKeyForYear(chart, selectedSpec.year)
      : null;
    const periodEntryBackup = pKey ? aiPeriodCacheRef.current[pKey] : undefined;

    const sectionCacheKey = buildDossierChapterCacheKey(chartIdentityKey, selectedSpec.id);
    bestPartialMapRef.current.delete(sectionCacheKey);
    removeSingleDossierChapterFromLibrary(chart, selectedSpec.id);
    setLocalChapters((prev) => {
      const next = { ...prev };
      delete next[selectedSpec.id];
      return next;
    });
    if (pKey) {
      onAiPeriodCacheChange((prev) => {
        if (!(pKey in prev)) return prev;
        const next = { ...prev };
        delete next[pKey];
        return next;
      });
    }

    setConfirmDeleteChapterId(null);
    setDeletedChapterUndo({
      chartIdentityKey,
      chapterId: selectedSpec.id,
      chapterLabelVi: selectedSpec.shortLabelVi,
      chapterState: snapshotState,
      periodEntryBackup,
    });
  };

  const handleUndoDeleteChapter = () => {
    if (!deletedChapterUndo || deletedChapterUndo.chartIdentityKey !== chartIdentityKey) {
      return;
    }
    const { chapterId, chapterState, periodEntryBackup } = deletedChapterUndo;
    const restoredSpec = DOSSIER_CHAPTER_SPECS.find((s) => s.id === chapterId);
    const snapshot = createBestPartialSnapshot(chapterState);
    if (snapshot) {
      bestPartialMapRef.current.set(chapterState.sectionCacheKey, snapshot);
    }
    saveDossierSectionToCache(
      getBrowserSessionStorage(),
      chart,
      chapterId,
      chapterState,
    );
    setLocalChapters((prev) => ({
      ...prev,
      [chapterId]: chapterState,
    }));
    if (restoredSpec && isPeriodChapter(restoredSpec)) {
      const pKey = buildPeriodCacheKeyForYear(chart, restoredSpec.year);
      const restoredEntry: AiPeriodEntry | undefined =
        periodEntryBackup ??
        (chapterState.status === 'completed' && chapterState.text?.trim()
          ? { text: chapterState.text, meta: chapterState.meta }
          : chapterState.status === 'incomplete' && chapterState.incompleteText?.trim()
            ? {
                incomplete: true,
                incompleteText: chapterState.incompleteText,
                interruptedReason: chapterState.interruptedReason,
                error: chapterState.error,
                meta: chapterState.meta,
              }
            : undefined);
      if (restoredEntry) {
        onAiPeriodCacheChange((prev) => ({
          ...prev,
          [pKey]: restoredEntry,
        }));
      }
    }
    setSelectedChapterId(chapterId);
    setDeletedChapterUndo(null);
  };

  if (!open) return null;

  const isSelectedBusy = activeGeneratingId === selectedSpec.id;
  const isAnyBusy = autoRunning || activeGeneratingId !== null;
  const selectedMatrixHtml =
    selectedSpec.sectionId === 'horizon_5y'
      ? matrix5yHtml
      : selectedSpec.sectionId === 'horizon_10y'
        ? matrix10yHtml
        : '';

  const printSheetPortal =
    typeof document !== 'undefined'
      ? createPortal(
          <div className="ziwei-print-dossier-sheet ziwei-editorial-root p-6 space-y-6 text-[#181A20] bg-white">
            <style>{DOSSIER_EDITORIAL_PRINT_CSS}</style>
            <div dangerouslySetInnerHTML={{ __html: pageOneHtml }} />

            {DOSSIER_CHAPTER_SPECS.map((spec) => {
              const st = resolvedStatesMap[spec.id];
              const isDone = st.status === 'completed' && Boolean(st.text?.trim());
              const fallbackMd =
                st.incompleteText?.trim() ||
                resolveChapterDeterministicFactSheet(chart, spec).factSheetMarkdown;
              const chapterMatrixHtml =
                spec.sectionId === 'horizon_5y'
                  ? matrix5yHtml
                  : spec.sectionId === 'horizon_10y'
                    ? matrix10yHtml
                    : '';
              const exportChapterText =
                stripInternalExportMetaLines(isDone ? st.text ?? '' : fallbackMd) ?? '';

              return (
                <section
                  key={spec.id}
                  className={`chapter ${isDone ? '' : 'chapter-incomplete'}`}
                >
                  <h2>{spec.titleVi}</h2>
                  {!isDone && (
                    <div className="incomplete-banner">
                      CHƯA HOÀN TẤT — Chương này chưa có bài luận giải AI đầy đủ.
                    </div>
                  )}
                  {chapterMatrixHtml && (
                    <div dangerouslySetInnerHTML={{ __html: chapterMatrixHtml }} />
                  )}
                  <div
                    className="chapter-body"
                    dangerouslySetInnerHTML={{
                      __html: simpleMarkdownToHtml(exportChapterText),
                    }}
                  />
                </section>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="Hồ Sơ Luận Giải Chi Tiết (8 Chương)"
      >
        <div className="w-full max-w-6xl h-[92vh] rounded-2xl border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text)] shadow-2xl flex flex-col overflow-hidden">
          {/* Top Header + F6 Action + F1 Export Toolbar */}
          <header className="px-4 sm:px-5 py-3.5 border-b border-[var(--t-border)] bg-[var(--t-card)] space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[var(--t-gold)] font-bold text-sm sm:text-base">
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <span>Hồ Sơ Luận Giải Chi Tiết (8 Chương)</span>
                </div>
                <div className="text-xs text-[var(--t-text2)] space-y-0.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span>
                      Đương số: <strong className="text-[var(--t-text)]">{headerMeta.name}</strong>
                    </span>
                    <span>·</span>
                    <span>{headerMeta.yinYang}</span>
                    <span>·</span>
                    <span>{headerMeta.ju}</span>
                    <span>·</span>
                    <span>Dương lịch: {headerMeta.solar}</span>
                    <span>·</span>
                    <span>Âm lịch: {headerMeta.lunar}</span>
                    <span>·</span>
                    <span className="font-mono-tabular">
                      {isHydrated ? (
                        <>
                          Hoàn tất: <strong className="text-[var(--t-gold)]">{completedCount}/8</strong> chương
                        </>
                      ) : (
                        <strong className="text-amber-300">Đang nạp từ IndexedDB...</strong>
                      )}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--t-faint)]">
                    <span>{headerMeta.birthTimeFullSummaryVi}</span>
                    <span>·</span>
                    <span>Nơi sinh: {headerMeta.locationVi}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {onOpenLibrary && (
                  <button
                    type="button"
                    onClick={onOpenLibrary}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)] hover:text-[var(--t-gold)] cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Library className="w-3.5 h-3.5" />
                    <span>Thư Viện</span>
                  </button>
                )}

                {onOpenKeyPool && (
                  <button
                    type="button"
                    onClick={onOpenKeyPool}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)] hover:text-[var(--t-gold)] cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Kho Khóa</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    stopAllGeneration();
                    onClose();
                  }}
                  className="p-2 rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)] hover:text-[var(--t-gold)] cursor-pointer"
                  title="Đóng Hồ Sơ"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!isHydrated && (
              <div className="rounded-lg border border-sky-500/40 bg-sky-950/35 px-3 py-2 text-xs text-sky-200 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0 text-sky-400" />
                <span>
                  Đang nạp dữ liệu Hồ Sơ 8 Chương từ bộ nhớ bền vững IndexedDB — tạm khóa thao tác sinh mới để bảo vệ các chương đã lưu.
                </span>
              </div>
            )}

            {isHydrated && storageHealth && !storageHealth.indexedDbAvailable && (
              <div className="rounded-lg border border-amber-500/45 bg-amber-950/35 px-3 py-2 text-xs text-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span>
                  IndexedDB đang bị chặn — Hồ sơ chỉ lưu tạm tối đa 3 bản nóng cục bộ. Hãy mở Thư Viện và Xuất .JSON để sao lưu.
                </span>
              </div>
            )}

            {/* Progress bar + F6 orchestration + F1 exports */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                {!autoRunning ? (
                  <button
                    type="button"
                    onClick={handleRunAllSequential}
                    disabled={!isHydrated || isAnyBusy || completedCount === DOSSIER_CHAPTER_SPECS.length}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[var(--t-gold)] text-slate-950 hover:opacity-95 disabled:opacity-45 disabled:cursor-not-allowed transition-all cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>
                      {!isHydrated
                        ? 'Đang nạp bộ nhớ bền vững...'
                        : completedCount === DOSSIER_CHAPTER_SPECS.length
                          ? 'Đã hoàn tất trọn bộ 8/8 chương'
                          : completedCount > 0
                            ? `Tự động tạo tiếp (${DOSSIER_CHAPTER_SPECS.length - completedCount} chương thiếu)`
                            : 'Tự động tạo trọn bộ (8 chương)'}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePauseAfterCurrent}
                    disabled={pauseRequested}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-500/20 border border-amber-400/60 text-amber-200 hover:bg-amber-500/30 disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>
                      {pauseRequested
                        ? 'Sẽ dừng sau khi xong chương đang chạy...'
                        : 'Tạm dừng sau chương này'}
                    </span>
                  </button>
                )}

                <div className="w-28 h-2 rounded-full bg-[var(--t-surface)] border border-[var(--t-border)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--t-gold)] transition-all duration-300"
                    style={{
                      width: `${Math.round((completedCount / DOSSIER_CHAPTER_SPECS.length) * 100)}%`,
                    }}
                  />
                </div>

                {autoRunning && autoRunPass === 2 && (
                  <span className="text-[11px] font-semibold text-amber-300">
                    Vòng 2/2: Đang thử lại các chương lỗi tạm thời...
                  </span>
                )}
              </div>

              {/* F1 Export Toolbar */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleDownloadHtml}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text)] hover:border-[var(--t-gold)] hover:text-[var(--t-gold)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  title="Tải file HTML chuẩn in nền Giấy Cổ đọc offline"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải .HTML (Giấy Cổ)</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadMd}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)] hover:border-[var(--t-gold)] hover:text-[var(--t-gold)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Tải .MD</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyAll}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)] hover:border-[var(--t-gold)] hover:text-[var(--t-gold)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {copiedAll ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Đã chép toàn bộ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handlePrintDirect}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)] hover:border-[var(--t-gold)] hover:text-[var(--t-gold)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In trực tiếp</span>
                </button>
              </div>
            </div>

            {autoRunSummary &&
              !autoRunning &&
              (autoRunSummary.haltedReason === 'fatal_error' ||
                autoRunSummary.retriedInPass2.length > 0 ||
                autoRunSummary.remainingIncompleteOrError.length > 0) && (
                <div
                  className={`rounded-lg border px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2 ${
                    autoRunSummary.haltedReason === 'fatal_error' ||
                    autoRunSummary.remainingIncompleteOrError.length > 0
                      ? 'border-amber-500/45 bg-amber-950/35 text-amber-200'
                      : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-300" />
                    <span>
                      {autoRunSummary.haltedReason === 'fatal_error'
                        ? `Đã dừng sớm vì lỗi hệ thống nghiêm trọng: ${autoRunSummary.fatalFailure?.userMessageVi || 'Không thể tiếp tục gọi AI.'}`
                        : `Tổng kết tự động tạo: Vòng 1 xong ${autoRunSummary.completedInPass1.length} chương · Vòng 2 thử lại ${autoRunSummary.retriedInPass2.length} chương (khôi phục ${autoRunSummary.recoveredInPass2.length})${
                            autoRunSummary.remainingIncompleteOrError.length > 0
                              ? ` · Còn ${autoRunSummary.remainingIncompleteOrError.length} chương chưa hoàn tất.`
                              : '.'
                          }`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoRunSummary(null)}
                    className="text-[11px] opacity-80 hover:opacity-100 cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
              )}
          </header>

          {/* Two-column Workspace */}
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12">
            {/* Left Sidebar: 8 Chapters Nav */}
            <aside className="lg:col-span-4 xl:col-span-3 border-b lg:border-b-0 lg:border-r border-[var(--t-border)] bg-[var(--t-surface)] overflow-y-auto p-3 space-y-1.5 max-h-56 lg:max-h-none">
              <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--t-faint)]">
                Mục Lục 8 Chương Hồ Sơ
              </div>
              {DOSSIER_CHAPTER_SPECS.map((spec) => {
                const st = resolvedStatesMap[spec.id];
                const isSelected = spec.id === selectedChapterId;
                const isLoading = st.status === 'loading';
                const isDone = st.status === 'completed' && Boolean(st.text?.trim());
                const isIncomplete = st.status === 'incomplete' || st.status === 'error';

                return (
                  <button
                    key={spec.id}
                    type="button"
                    onClick={() => setSelectedChapterId(spec.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'bg-[var(--t-gold)]/12 border-[var(--t-gold)] text-[var(--t-text)]'
                        : 'bg-[var(--t-card)]/70 border-[var(--t-border)] text-[var(--t-text2)] hover:border-[var(--t-gold)]/50'
                    }`}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-xs font-semibold truncate">
                        {spec.shortLabelVi}
                      </div>
                      <div className="text-[11px] text-[var(--t-faint)] truncate">
                        {isLoading
                          ? 'Đang luận giải...'
                          : isDone
                            ? st.sourceBadge ?? 'Hoàn tất'
                            : isIncomplete
                              ? 'Chưa hoàn tất'
                              : isPeriodChapter(spec)
                                ? 'Đồng bộ tab Vận Hạn'
                                : 'Chưa sinh'}
                      </div>
                    </div>

                    <div className="shrink-0 pt-0.5 flex items-center gap-1.5">
                      {st.auditFlags && st.auditFlags.length > 0 && (
                        <span
                          className={`text-[10px] font-mono px-1 py-0.5 rounded border ${
                            st.auditFlags.some((f) => f.severity === 'critical')
                              ? 'border-rose-500/50 bg-rose-950/50 text-rose-300'
                              : 'border-amber-500/50 bg-amber-950/50 text-amber-300'
                          }`}
                          title={`Kiểm chứng KP-3: ${st.auditFlags.length} cờ`}
                        >
                          {st.auditFlags.length} cờ
                        </span>
                      )}
                      {isLoading ? (
                        <RefreshCw className="w-3.5 h-3.5 text-[var(--t-gold)] animate-spin" />
                      ) : isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : isIncomplete ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <span className="inline-block w-2 h-2 rounded-full bg-[var(--t-border)] mt-1 mr-1" />
                      )}
                    </div>
                  </button>
                );
              })}
            </aside>

            {/* Right Workspace: Selected Chapter Reader */}
            <section className="lg:col-span-8 xl:col-span-9 flex flex-col min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* Chapter Header & Controls */}
              <div className="pb-3 border-b border-[var(--t-border)] space-y-2.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-bold text-[var(--t-gold)]">
                      {selectedSpec.titleVi}
                    </h3>
                    <p className="text-xs text-[var(--t-text2)]">
                      {selectedSpec.descriptionVi}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* F5 Entry Point #3: Contextual Q&A for active chapter */}
                    <button
                      type="button"
                      onClick={handleOpenChatForSelectedChapter}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--t-gold)]/50 bg-[var(--t-gold)]/10 text-[var(--t-gold)] hover:bg-[var(--t-gold)]/20 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <MessageSquareText className="w-3.5 h-3.5" />
                      <span>Hỏi đáp về chương này</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleGenerateSingleChapter(selectedSpec.id)}
                      disabled={!isHydrated || isAnyBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--t-gold)] text-slate-950 hover:opacity-95 disabled:opacity-45 disabled:cursor-not-allowed transition-all cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Sparkles
                        className={`w-3.5 h-3.5 ${isSelectedBusy || !isHydrated ? 'animate-spin' : ''}`}
                      />
                      <span>
                        {!isHydrated
                          ? 'Đang nạp...'
                          : isSelectedBusy
                            ? 'Đang sinh chương...'
                            : selectedState.status === 'completed'
                              ? 'Sinh lại chương này'
                              : selectedState.status === 'incomplete' ||
                                  selectedState.status === 'error'
                                ? 'Thử lại chương này'
                                : 'Sinh chương này'}
                      </span>
                    </button>

                    {(selectedState.status === 'completed' ||
                      selectedState.status === 'incomplete') && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDeleteChapterId((curr) =>
                            curr === selectedSpec.id ? null : selectedSpec.id,
                          )
                        }
                        disabled={!isHydrated || isAnyBusy}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)] hover:text-rose-400 hover:border-rose-500/50 disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        title="Xóa riêng nội dung chương này khỏi Hồ Sơ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa chương này</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Xác nhận xóa chương tại chỗ (QĐ-L8 C1+) */}
                {confirmDeleteChapterId === selectedSpec.id && (
                  <div className="rounded-xl p-3 border border-rose-500/50 bg-rose-950/35 text-xs text-rose-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>
                        Xác nhận xóa nội dung <strong>{selectedSpec.shortLabelVi}</strong> khỏi Hồ Sơ của lá số này? (Bạn có thể hoàn tác ngay trong phiên).
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteChapterId(null)}
                        className="px-2.5 py-1 rounded-md border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)] hover:text-[var(--t-text)] cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmDeleteSelectedChapter}
                        className="px-2.5 py-1 rounded-md font-semibold bg-rose-600 text-white hover:bg-rose-500 cursor-pointer"
                      >
                        Xác nhận xóa
                      </button>
                    </div>
                  </div>
                )}

                {/* Banner hoàn tác xóa chương trong phiên (LK-08 / QĐ-L8 C1+) */}
                {deletedChapterUndo &&
                  deletedChapterUndo.chartIdentityKey === chartIdentityKey && (
                    <div className="rounded-xl p-3 border border-amber-500/45 bg-amber-950/30 text-xs text-amber-100 flex flex-wrap items-center justify-between gap-2">
                      <span>
                        Đã xóa nội dung <strong>{deletedChapterUndo.chapterLabelVi}</strong> khỏi Hồ Sơ lá số này.
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={handleUndoDeleteChapter}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold bg-[var(--t-gold)] text-slate-950 hover:opacity-95 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Hoàn tác</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletedChapterUndo(null)}
                          className="p-1 text-amber-300/70 hover:text-amber-100 cursor-pointer"
                          title="Ẩn thông báo"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                {/* Unboxed quiet provenance line (SourceBadge + Model + MaskedKey) */}
                {(selectedState.sourceBadge || selectedState.meta) && (
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--t-text2)]">
                    {selectedState.sourceBadge && (
                      <span
                        className={
                          selectedState.sourceBadge === 'Kế thừa từ bộ nhớ đệm'
                            ? 'text-emerald-400 font-semibold'
                            : 'text-sky-300 font-semibold'
                        }
                      >
                        {selectedState.sourceBadge}
                      </span>
                    )}
                    {selectedState.meta && (
                      <>
                        {selectedState.sourceBadge && <span>·</span>}
                        <span>
                          Model:{' '}
                          <strong className="text-[var(--t-gold)]">
                            {selectedState.meta.modelUsed}
                          </strong>
                          {selectedState.meta.usedFallbackModel && ' (dự phòng)'}
                        </span>
                        <span>·</span>
                        <span className="font-mono-tabular">
                          Khóa: {selectedState.meta.maskedKey}
                        </span>
                        {selectedState.meta.failoverAttempts > 1 && (
                          <>
                            <span>·</span>
                            <span className="text-amber-300">
                              Chuyển qua {selectedState.meta.failoverAttempts - 1}{' '}
                              khóa lỗi
                            </span>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Deterministic Fact Sheet Collapsible Drawer */}
              <div className="rounded-xl border border-sky-500/35 bg-sky-950/15 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowFactSheet((v) => !v)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-sky-300 hover:bg-sky-950/25 transition-colors cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" />
                    <span>
                      Bảng dữ kiện xác định của chương (từ engine · luôn sẵn sàng không cần key)
                    </span>
                  </span>
                  <span>{showFactSheet ? 'Thu gọn' : 'Mở xem dữ kiện'}</span>
                </button>
                {showFactSheet && (
                  <div className="p-3.5 border-t border-sky-500/25 bg-[var(--t-surface)] text-xs leading-relaxed">
                    <MarkdownContent content={selectedDeterministic.factSheetMarkdown} />
                  </div>
                )}
              </div>

              {/* Trang 1 Tích Hợp (B1+B6+B2) cho Chương 1 & Ma Trận Năm 5 cột (B3) cho Chương 7/8 */}
              {selectedSpec.id === 'chapter_overview' && (
                <div className="ziwei-editorial-root rounded-xl p-4 sm:p-5 bg-[#FFFDF8] border border-amber-900/30 shadow-sm overflow-x-auto">
                  <style>{DOSSIER_EDITORIAL_PRINT_CSS}</style>
                  <div dangerouslySetInnerHTML={{ __html: pageOneHtml }} />
                </div>
              )}

              {selectedMatrixHtml && (
                <div className="ziwei-editorial-root rounded-xl p-4 bg-[#FFFDF8] border border-amber-900/30 shadow-sm overflow-x-auto">
                  <style>{DOSSIER_EDITORIAL_PRINT_CSS}</style>
                  <div dangerouslySetInnerHTML={{ __html: selectedMatrixHtml }} />
                </div>
              )}

              {selectedState.auditFlags &&
                selectedState.auditFlags.length > 0 &&
                selectedState.status !== 'loading' && (
                  <div className="rounded-xl p-3.5 border border-amber-500/45 bg-amber-950/20 text-xs space-y-2">
                    <div className="flex items-center justify-between gap-2 font-semibold text-amber-300">
                      <span className="inline-flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Kiểm Chứng KP-3 ({selectedState.auditFlags.length} cờ đối chiếu · chỉ hiển thị trên màn hình)
                        </span>
                      </span>
                    </div>
                    <ul className="space-y-1.5 text-[11px] leading-relaxed">
                      {selectedState.auditFlags.map((flag, idx) => (
                        <li
                          key={`${flag.code}-${idx}`}
                          className={`rounded-lg px-2.5 py-1.5 border ${
                            flag.severity === 'critical'
                              ? 'border-rose-500/40 bg-rose-950/30 text-rose-100'
                              : 'border-amber-500/35 bg-amber-950/30 text-amber-100'
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] mb-0.5">
                            <span
                              className={
                                flag.severity === 'critical'
                                  ? 'text-rose-300 font-bold'
                                  : 'text-amber-300 font-bold'
                              }
                            >
                              {flag.severity === 'critical' ? 'NGHIÊM TRỌNG' : 'TRUNG BÌNH'}
                            </span>
                            <span>·</span>
                            <span>{flag.code}</span>
                            {flag.palaceVi && (
                              <>
                                <span>·</span>
                                <span>Cung {flag.palaceVi}</span>
                              </>
                            )}
                            {flag.ageRange && (
                              <>
                                <span>·</span>
                                <span>Đại Hạn {flag.ageRange}</span>
                              </>
                            )}
                          </div>
                          <div>{flag.messageVi}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* Chapter Main Body by State */}
              {selectedState.status === 'loading' && (
                <div className="space-y-3">
                  {selectedState.text ? (
                    <div className="rounded-xl p-4 sm:p-5 border border-[var(--t-border)] bg-[var(--t-surface)] text-xs sm:text-sm leading-relaxed">
                      <MarkdownContent content={selectedState.text} />
                      <span className="inline-block w-1.5 h-4 bg-[var(--t-gold)] animate-pulse ml-1" />
                    </div>
                  ) : (
                    <div className="rounded-xl p-8 border border-[var(--t-border)] bg-[var(--t-surface)] flex flex-col items-center justify-center gap-2 text-xs text-[var(--t-gold)]">
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>
                        Đang gửi dữ kiện xác định của {selectedSpec.shortLabelVi} lên Gemini AI...
                      </span>
                    </div>
                  )}
                </div>
              )}

              {selectedState.status === 'completed' && selectedState.text && (
                <div className="rounded-xl p-4 sm:p-5 border border-[var(--t-border)] bg-[var(--t-surface)] text-xs sm:text-sm leading-relaxed">
                  <MarkdownContent content={selectedState.text} />
                </div>
              )}

              {(selectedState.status === 'incomplete' ||
                selectedState.status === 'error') && (
                <div className="space-y-4">
                  <div className="rounded-xl p-4 border border-amber-500/45 bg-amber-950/30 text-xs text-amber-200 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-bold text-amber-300">
                          CHƯA HOÀN TẤT —{' '}
                          {selectedState.status === 'incomplete'
                            ? 'Luồng sinh chương bị ngắt giữa chừng (không lưu cache hoàn chỉnh)'
                            : 'Không thể hoàn tất chương này'}
                        </div>
                        <div className="text-[11px] leading-relaxed break-words">
                          {selectedState.interruptedReason || selectedState.error}
                        </div>
                        {selectedState.restoredNoticeVi && (
                          <div className="text-[11px] text-sky-300">
                            {selectedState.restoredNoticeVi}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleGenerateSingleChapter(selectedSpec.id)}
                        disabled={!isHydrated || isAnyBusy}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--t-gold)] text-slate-950 hover:opacity-95 disabled:opacity-45 cursor-pointer"
                      >
                        Tiếp tục sinh phần còn thiếu
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGenerateSingleChapter(selectedSpec.id)}
                        disabled={!isHydrated || isAnyBusy}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-400/50 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 disabled:opacity-45 cursor-pointer"
                      >
                        Thử lại chương này
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadHtml}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text)] hover:border-[var(--t-gold)] cursor-pointer"
                      >
                        Xuất ngay bản hiện có
                      </button>
                    </div>
                  </div>

                  {selectedState.incompleteText?.trim() && (
                    <div className="rounded-xl p-4 border border-amber-500/35 bg-[var(--t-surface)] space-y-2 text-xs sm:text-sm">
                      <div className="text-[11px] font-semibold text-amber-300">
                        Phần nội dung đã nhận trước khi gián đoạn:
                      </div>
                      <MarkdownContent content={selectedState.incompleteText} />
                    </div>
                  )}

                  <div className="rounded-xl p-4 border border-[var(--t-border)] bg-[var(--t-surface)] space-y-2 text-xs">
                    <div className="text-[11px] font-semibold text-sky-300">
                      Bảng dữ kiện xác định của chương (đảm bảo luôn đủ thông số):
                    </div>
                    <MarkdownContent content={selectedDeterministic.factSheetMarkdown} />
                  </div>
                </div>
              )}

              {selectedState.status === 'idle' && (
                <div className="rounded-xl p-5 border border-[var(--t-border)] bg-[var(--t-surface)] space-y-4">
                  <div className="space-y-1.5">
                    <div className="text-sm font-semibold text-[var(--t-text)]">
                      {!isHydrated
                        ? 'Đang kiểm tra bộ nhớ bền vững IndexedDB...'
                        : 'Chương này chưa được sinh luận giải AI'}
                    </div>
                    <p className="text-xs text-[var(--t-text2)] leading-relaxed">
                      {!isHydrated ? (
                        'Hệ thống đang đọc lại các chương đã lưu từ IndexedDB để tránh kết luận nhầm 0/8 hoặc ghi đè.'
                      ) : (
                        <>
                          Nhấn <strong className="text-[var(--t-gold)]">"Sinh chương này"</strong> để luận giải riêng chương này, hoặc nhấn{' '}
                          <strong className="text-[var(--t-gold)]">"Tự động tạo trọn bộ (8 chương)"</strong> ở thanh trên để hệ thống sinh tuần tự từng chương an toàn (giãn nhịp 1,2 giây/chương).
                          {isPeriodChapter(selectedSpec) &&
                            ' Kết quả Lưu Niên 2026 & 2027 được đồng bộ bộ nhớ đệm 2 chiều trực tiếp với tab Vận Hạn.'}
                        </>
                      )}
                    </p>
                  </div>

                  <div className="rounded-lg p-3.5 border border-[var(--t-border)] bg-[var(--t-bg)] text-xs leading-relaxed">
                    <div className="text-[11px] font-semibold text-sky-300 mb-2">
                      Xem trước bảng dữ kiện xác định sẽ gửi cho AI:
                    </div>
                    <MarkdownContent content={selectedDeterministic.factSheetMarkdown} />
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {printSheetPortal}
    </>
  );
}
