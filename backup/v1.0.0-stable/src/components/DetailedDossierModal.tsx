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
  DOSSIER_LRU_INDEX_KEY,
  DossierChapterId,
  DossierChapterSpec,
  DossierChapterState,
  MAX_DOSSIERS_IN_SESSION,
  StoredDossierRecord,
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
  formatDossierSourceBadge,
  getBrowserSessionStorage,
  readDossierCacheEntry,
  readLruSessionEntry,
  resolveChapterDeterministicFactSheet,
  resolveDossierChapterFromCaches,
  setSharedDossierGenerating,
  simpleMarkdownToHtml,
  stripInternalExportMetaLines,
  upsertLruSessionEntry,
} from '../lib/dossier-chat-ui';
import {
  enforceCanonicalPalaceGroupHeadings,
  sanitizeAiVietnameseOutput,
  verifyAndEnsureCompletePeriodSiHua,
} from '../lib/ziwei/text-sanitizer';
import { hasValidCachedPeriodEntry } from '../lib/key-pool-ui';
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
  onDossierGeneratingChange?: (generating: boolean) => void;
}

type NonPeriodChapterId = Exclude<DossierChapterId, 'year_2026' | 'year_2027'>;

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
  onDossierGeneratingChange,
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

  const abortRef = useRef<AbortController | null>(null);
  const cancelAutoRef = useRef(false);
  const pauseAfterCurrentRef = useRef(false);
  const aiPeriodCacheRef = useRef(aiPeriodCache);
  aiPeriodCacheRef.current = aiPeriodCache;

  const localChaptersRef = useRef(localChapters);
  localChaptersRef.current = localChapters;

  const chartIdentityKey = useMemo(() => buildChartIdentityKey(chart), [chart]);
  const dossierStorageKey = useMemo(
    () => buildDossierStorageKey(chartIdentityKey),
    [chartIdentityKey],
  );

  // Nạp & tự làm sạch (QĐ-G2/T2) các chương non-period đã lưu trong sessionStorage khi đổi lá số hoặc mở modal
  useEffect(() => {
    const storage = getBrowserSessionStorage();
    const stored = readDossierCacheEntry(storage, dossierStorageKey, chart);
    if (stored && stored.sections) {
      const next: Partial<Record<DossierChapterId, DossierChapterState>> = {};
      for (const [k, val] of Object.entries(stored.sections)) {
        if (val && val.status === 'completed' && val.text?.trim()) {
          next[k as DossierChapterId] = {
            ...val,
            sourceBadge: formatDossierSourceBadge('cache'),
          };
        }
      }
      setLocalChapters(next);
    } else {
      setLocalChapters({});
    }
    setSelectedChapterId('chapter_overview');
  }, [dossierStorageKey, chart]);

  // Lưu các chương non-period hoàn tất vào sessionStorage LRU (tối đa 5 hồ sơ)
  const persistCompletedSectionToSession = useCallback(
    (chapterId: NonPeriodChapterId, chapterState: DossierChapterState) => {
      if (chapterState.status !== 'completed' || !chapterState.text?.trim()) return;
      const storage = getBrowserSessionStorage();
      const existing = readLruSessionEntry<StoredDossierRecord>(
        storage,
        DOSSIER_LRU_INDEX_KEY,
        dossierStorageKey,
      );
      const nextSections: StoredDossierRecord['sections'] = {
        ...(existing?.sections ?? {}),
        [chapterId]: {
          ...chapterState,
          sourceBadge: chapterState.sourceBadge,
        },
      };
      const record: StoredDossierRecord = {
        chartIdentityKey,
        updatedAt: Date.now(),
        sections: nextSections,
      };
      upsertLruSessionEntry(
        storage,
        DOSSIER_LRU_INDEX_KEY,
        dossierStorageKey,
        record,
        MAX_DOSSIERS_IN_SESSION,
      );
    },
    [chartIdentityKey, dossierStorageKey],
  );

  // Dọn dẹp khi đóng modal hoặc unmount
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
    async (spec: DossierChapterSpec): Promise<'completed' | 'incomplete' | 'error' | 'aborted'> => {
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

      if (isPeriod && !periodCtx) {
        const msg = `Không thể tạo ngữ cảnh Lưu Niên cho năm ${spec.year}.`;
        setLocalChapters((prev) => ({
          ...prev,
          [spec.id]: {
            chapterId: spec.id,
            sectionCacheKey,
            status: 'error',
            error: msg,
          },
        }));
        return 'error';
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
          let errMsg =
            'Chưa thể gọi Gemini API cho chương này (kho khóa chưa sẵn sàng hoặc đang nguội).';
          let errCode = '';
          try {
            const errJson = await res.json();
            if (errJson?.message) errMsg = errJson.message;
            if (errJson?.error) errCode = errJson.error;
          } catch {
            // ignore
          }
          if (isPeriod && periodKey) {
            onAiPeriodCacheChange((prev) => ({
              ...prev,
              [periodKey]: {
                notConfigured: res.status === 503 && errCode !== 'AI_POOL_EXHAUSTED',
                errorCode: errCode,
                error: errMsg,
              },
            }));
          }
          setLocalChapters((prev) => ({
            ...prev,
            [spec.id]: {
              chapterId: spec.id,
              sectionCacheKey,
              status: 'error',
              errorCode: errCode,
              error: errMsg,
            },
          }));
          return 'error';
        }

        if (!res.body) {
          const errMsg = 'Không nhận được luồng phản hồi SSE từ máy chủ.';
          setLocalChapters((prev) => ({
            ...prev,
            [spec.id]: {
              chapterId: spec.id,
              sectionCacheKey,
              status: 'error',
              error: errMsg,
            },
          }));
          return 'error';
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '';
        let accumulated = '';
        let receivedMeta: AiExecutionMeta | undefined;
        let streamError: string | null = null;
        let wasInterrupted = false;
        let interruptedMsg = '';

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
            if (parsed?.interrupted) {
              wasInterrupted = true;
              interruptedMsg =
                parsed.message || 'Luồng kết nối Gemini bị gián đoạn giữa chừng.';
              return false;
            }
            if (parsed?.error) {
              streamError = parsed.message || 'Lời gọi Gemini API gặp lỗi.';
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
        // 1) sanitizeAiVietnameseOutput -> 2) verifyAndEnsureCompletePeriodSiHua (chương 5/6) -> 3) enforceCanonicalPalaceGroupHeadings (chương 2/3/4)
        accumulated = sanitizeAiVietnameseOutput(accumulated);
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

        if (wasInterrupted || streamError) {
          const reason =
            interruptedMsg ||
            streamError ||
            'Kết nối bị gián đoạn giữa chừng. Nội dung dở không được lưu làm bản hoàn tất.';
          const partialMeta = receivedMeta
            ? { ...receivedMeta, interrupted: true }
            : undefined;
          if (isPeriod && periodKey) {
            onAiPeriodCacheChange((prev) => ({
              ...prev,
              [periodKey]: {
                incomplete: true,
                incompleteText: accumulated.trim() ? accumulated : undefined,
                interruptedReason: reason,
                meta: partialMeta,
                error: reason,
              },
            }));
          }
          setLocalChapters((prev) => ({
            ...prev,
            [spec.id]: {
              chapterId: spec.id,
              sectionCacheKey,
              status: 'incomplete',
              incompleteText: accumulated.trim() ? accumulated : undefined,
              interruptedReason: reason,
              error: reason,
              meta: partialMeta,
              sourceBadge: formatDossierSourceBadge('generated'),
            },
          }));
          return 'incomplete';
        }

        if (!accumulated.trim()) {
          const emptyMsg = 'Phản hồi từ AI trống. Vui lòng thử lại chương này.';
          if (isPeriod && periodKey) {
            onAiPeriodCacheChange((prev) => ({
              ...prev,
              [periodKey]: { error: emptyMsg },
            }));
          }
          setLocalChapters((prev) => ({
            ...prev,
            [spec.id]: {
              chapterId: spec.id,
              sectionCacheKey,
              status: 'error',
              error: emptyMsg,
            },
          }));
          return 'error';
        }

        const completedState: DossierChapterState = {
          chapterId: spec.id,
          sectionCacheKey,
          status: 'completed',
          text: accumulated,
          meta: receivedMeta,
          sourceBadge: formatDossierSourceBadge('generated'),
          updatedAt: Date.now(),
        };

        if (isPeriod && periodKey) {
          onAiPeriodCacheChange((prev) => ({
            ...prev,
            [periodKey]: {
              text: accumulated,
              meta: receivedMeta,
            },
          }));
          setLocalChapters((prev) => ({
            ...prev,
            [spec.id]: completedState,
          }));
        } else {
          setLocalChapters((prev) => ({
            ...prev,
            [spec.id]: completedState,
          }));
          persistCompletedSectionToSession(
            spec.id as NonPeriodChapterId,
            completedState,
          );
        }

        return 'completed';
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return 'aborted';
        }
        const errMsg =
          'Mất kết nối trong lúc sinh chương hồ sơ. Vui lòng thử lại.';
        if (isPeriod && periodKey) {
          onAiPeriodCacheChange((prev) => ({
            ...prev,
            [periodKey]: { error: errMsg },
          }));
        }
        setLocalChapters((prev) => ({
          ...prev,
          [spec.id]: {
            chapterId: spec.id,
            sectionCacheKey,
            status: 'error',
            error: errMsg,
          },
        }));
        return 'error';
      } finally {
        setActiveGeneratingId((curr) => (curr === spec.id ? null : curr));
      }
    },
    [
      chart,
      chartIdentityKey,
      onAiPeriodCacheChange,
      persistCompletedSectionToSession,
    ],
  );

  // Sinh đơn lẻ 1 chương
  const handleGenerateSingleChapter = async (chapterId: DossierChapterId) => {
    if (autoRunning || activeGeneratingId !== null) return;
    const spec = DOSSIER_CHAPTER_SPECS.find((s) => s.id === chapterId);
    if (!spec) return;

    setSelectedChapterId(spec.id);
    setSharedDossierGenerating(true);
    onDossierGeneratingChange?.(true);
    try {
      await executeSingleChapterStream(spec);
    } finally {
      setSharedDossierGenerating(false);
      onDossierGeneratingChange?.(false);
    }
  };

  // F6: Chạy tự động tuần tự toàn bộ các chương chưa hoàn tất với giãn nhịp 2,200ms
  const handleRunAllSequential = async () => {
    if (autoRunning || activeGeneratingId !== null) return;

    const specsToRun = DOSSIER_CHAPTER_SPECS.filter((spec) => {
      const current = resolveDossierChapterFromCaches(
        chart,
        spec,
        aiPeriodCacheRef.current,
        localChaptersRef.current,
      );
      if (isPeriodChapter(spec)) {
        const pKey = buildPeriodCacheKeyForYear(chart, spec.year);
        return !hasValidCachedPeriodEntry(aiPeriodCacheRef.current[pKey]);
      }
      return !(current.status === 'completed' && current.text?.trim());
    });

    if (specsToRun.length === 0) return;

    cancelAutoRef.current = false;
    pauseAfterCurrentRef.current = false;
    setAutoRunning(true);
    setPauseRequested(false);
    setSharedDossierGenerating(true);
    onDossierGeneratingChange?.(true);

    try {
      for (let idx = 0; idx < specsToRun.length; idx += 1) {
        if (cancelAutoRef.current || pauseAfterCurrentRef.current) break;

        const spec = specsToRun[idx];
        setSelectedChapterId(spec.id);
        const outcome = await executeSingleChapterStream(spec);
        if (outcome === 'aborted' || cancelAutoRef.current) break;
        if (pauseAfterCurrentRef.current) break;

        if (idx < specsToRun.length - 1) {
          await new Promise<void>((resolve) => {
            const timer = window.setTimeout(
              resolve,
              DOSSIER_INTER_CHAPTER_PACING_MS,
            );
            const checkInterval = window.setInterval(() => {
              if (cancelAutoRef.current || pauseAfterCurrentRef.current) {
                window.clearTimeout(timer);
                window.clearInterval(checkInterval);
                resolve();
              }
            }, 150);
          });
        }
      }
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
                      Hoàn tất: <strong className="text-[var(--t-gold)]">{completedCount}/8</strong> chương
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

            {/* Progress bar + F6 orchestration + F1 exports */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                {!autoRunning ? (
                  <button
                    type="button"
                    onClick={handleRunAllSequential}
                    disabled={isAnyBusy || completedCount === DOSSIER_CHAPTER_SPECS.length}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[var(--t-gold)] text-slate-950 hover:opacity-95 disabled:opacity-45 disabled:cursor-not-allowed transition-all cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>
                      {completedCount === DOSSIER_CHAPTER_SPECS.length
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

                    <div className="shrink-0 pt-0.5">
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
                      disabled={isAnyBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--t-gold)] text-slate-950 hover:opacity-95 disabled:opacity-45 disabled:cursor-not-allowed transition-all cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Sparkles
                        className={`w-3.5 h-3.5 ${isSelectedBusy ? 'animate-spin' : ''}`}
                      />
                      <span>
                        {isSelectedBusy
                          ? 'Đang sinh chương...'
                          : selectedState.status === 'completed'
                            ? 'Tạo lại chương này'
                            : selectedState.status === 'incomplete' ||
                                selectedState.status === 'error'
                              ? 'Thử lại chương này'
                              : 'Sinh chương này'}
                      </span>
                    </button>
                  </div>
                </div>

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
                        <div className="font-mono text-[11px] break-words">
                          {selectedState.interruptedReason || selectedState.error}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleGenerateSingleChapter(selectedSpec.id)}
                        disabled={isAnyBusy}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--t-gold)] text-slate-950 hover:opacity-95 disabled:opacity-45 cursor-pointer"
                      >
                        Tiếp tục sinh phần còn thiếu
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGenerateSingleChapter(selectedSpec.id)}
                        disabled={isAnyBusy}
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
                      Chương này chưa được sinh luận giải AI
                    </div>
                    <p className="text-xs text-[var(--t-text2)] leading-relaxed">
                      Nhấn <strong className="text-[var(--t-gold)]">"Sinh chương này"</strong> để luận giải riêng chương này, hoặc nhấn{' '}
                      <strong className="text-[var(--t-gold)]">"Tự động tạo trọn bộ (8 chương)"</strong> ở thanh trên để hệ thống sinh tuần tự từng chương an toàn (giãn nhịp 2,2 giây/chương).
                      {isPeriodChapter(selectedSpec) &&
                        ' Kết quả Lưu Niên 2026 & 2027 được đồng bộ bộ nhớ đệm 2 chiều trực tiếp với tab Vận Hạn.'}
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
