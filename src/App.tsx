import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ThemeProvider, useTheme } from './components/ThemeProvider';
import BirthForm, {
  DEFAULT_BIRTH_FORM,
  type BirthFormInlineDuplicateNotice,
  type ChartGenerationSource,
} from './components/BirthForm';
import ChartBoard from './components/ChartBoard';
import TimeNav, { ActiveSihua, buildNatalActiveSihua } from './components/TimeNav';
import PatternsCard from './components/PatternsCard';
import StarDetailPanel from './components/StarDetailPanel';
import InsightPanel from './components/InsightPanel';
import HemingView from './components/HemingView';
import KnowledgeView from './components/KnowledgeView';
import KeyPoolModal from './components/KeyPoolModal';
import DetailedDossierModal from './components/DetailedDossierModal';
import ChartLibraryModal from './components/ChartLibraryModal';
import DuplicateChartPromptModal from './components/DuplicateChartPromptModal';
import ContextualChatDrawer from './components/ContextualChatDrawer';
import type {
  AiPeriodEntry,
  ContextualChatContextPayload,
} from './lib/dossier-chat-ui';
import {
  buildPeriodCachePatchesFromLibrary,
  detectChartDuplicateInLibrary,
  markLibraryEntryOpened,
  readLibraryIndexStore,
  resolveEffectiveDossierSummaryForEntry,
  upsertChartToLibrary,
  useChartLibrary,
  type ChartDuplicateDetectionResult,
  type ChartLibraryEntry,
} from './lib/chart-library';
import { buildChartIdentityKey } from './lib/ziwei/yunxian-context';
import { ZiweiChart, Palace, BirthFormState } from './lib/ziwei/types';
import {
  formToBirthInfo,
  formToSearchParams,
  searchParamsToForm,
} from './lib/ziwei/share';
import { generateChart } from './lib/ziwei/algorithm';
import { HistoryEntry } from './lib/ziwei/history';
import { VI_FAMOUS_PERSONS, VI_SHICHEN } from './lib/ziwei/vi-i18n';
import {
  Compass,
  Sun,
  Moon,
  Share2,
  Check,
  Sparkles,
  UserCheck,
  RotateCcw,
  KeyRound,
  BookOpen,
  Library,
  Pin,
  PinOff,
  X,
} from 'lucide-react';

type ActiveTab = 'chart' | 'heming' | 'knowledge' | 'famous';

function buildChartFromForm(form: BirthFormState): ZiweiChart {
  const birthInfo = formToBirthInfo(form);
  return generateChart(birthInfo);
}

function AppContent() {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<ActiveTab>('chart');
  const [currentForm, setCurrentForm] = useState<BirthFormState>(DEFAULT_BIRTH_FORM);
  const [chart, setChart] = useState<ZiweiChart>(() => buildChartFromForm(DEFAULT_BIRTH_FORM));
  const [activeSihua, setActiveSihua] = useState<ActiveSihua>(() =>
    buildNatalActiveSihua(buildChartFromForm(DEFAULT_BIRTH_FORM))
  );
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);
  const [selectedStarZh, setSelectedStarZh] = useState<string | null>(null);
  const [selectedMutagen, setSelectedMutagen] = useState<{
    starName: string;
    mutagen: string;
    palaceName: string;
  } | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);
  const [showFormDrawer, setShowFormDrawer] = useState(false);
  const [aiRequestTick, setAiRequestTick] = useState(0);
  const [aiPeriodLoading, setAiPeriodLoading] = useState(false);
  const [aiPeriodCache, setAiPeriodCache] = useState<Record<string, AiPeriodEntry>>({});
  const [showKeyPool, setShowKeyPool] = useState(false);
  const [showDossierModal, setShowDossierModal] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [pinNotice, setPinNotice] = useState<string | null>(null);
  const [exactMatchBanner, setExactMatchBanner] = useState<{
    chartIdentityKey: string;
    displayName: string;
    summaryMeta: string;
    pinned: boolean;
    completedCount: number;
    incompleteCount: number;
    isAlreadyActiveOnBoard: boolean;
  } | null>(null);
  const [exactMatchBannerPaused, setExactMatchBannerPaused] = useState(false);
  const [pendingDuplicatePrompt, setPendingDuplicatePrompt] = useState<{
    result: Extract<ChartDuplicateDetectionResult, { kind: 'near_match' }>;
    fromDrawer: boolean;
  } | null>(null);
  const [editingSourceEntryKey, setEditingSourceEntryKey] = useState<string | null>(null);
  const summaryBannerRef = useRef<HTMLDivElement | null>(null);
  const [isDossierGenerating, setIsDossierGenerating] = useState(false);
  const [chatDrawerContext, setChatDrawerContext] =
    useState<ContextualChatContextPayload | null>(null);
  const [poolSummary, setPoolSummary] = useState<{ ready: number; total: number } | null>(null);

  useEffect(() => {
    fetch('/api/ai-diagnostics')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.readyKeys === 'number' && typeof data.totalKeys === 'number') {
          setPoolSummary({ ready: data.readyKeys, total: data.totalKeys });
        }
      })
      .catch(() => {});
  }, [showKeyPool]);

  const {
    entries: libraryEntries,
    hydrationStatus,
    storageHealth,
    lastEvictedBackup,
    saveChart,
    togglePin,
    updateMeta,
    removeEntry,
    undoEviction,
    dismissEviction,
    refreshFromStore,
  } = useChartLibrary(currentForm);

  const activeChartIdentityKey = useMemo(() => buildChartIdentityKey(chart), [chart]);
  const activeLibraryEntry = useMemo(
    () =>
      libraryEntries.find((e) => e.chartIdentityKey === activeChartIdentityKey) ?? null,
    [libraryEntries, activeChartIdentityKey],
  );

  const historyItems = useMemo<HistoryEntry[]>(
    () =>
      libraryEntries.map((entry) => {
        const displayName = entry.customAlias || entry.form.name;
        return {
          id: entry.chartIdentityKey,
          label: [
            displayName,
            `${entry.form.day}/${entry.form.month}/${entry.form.year}`,
            entry.form.city || entry.form.province || '',
            entry.form.gender === 'male' ? 'Nam' : 'Nữ',
          ]
            .filter(Boolean)
            .join(' · '),
          form: entry.form,
          savedAt: entry.lastOpenedAt,
          pinned: entry.pinned,
          completedCount: entry.dossierSummary.completedCount,
        };
      }),
    [libraryEntries],
  );

  const hydratePeriodCacheFromLibrary = useCallback((targetChart: ZiweiChart) => {
    const patches = buildPeriodCachePatchesFromLibrary(targetChart);
    const patchKeys = Object.keys(patches);
    if (patchKeys.length === 0) return;
    setAiPeriodCache((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const pKey of patchKeys) {
        const existing = next[pKey];
        const incoming = patches[pKey];
        if (!existing || (!existing.text?.trim() && incoming.text?.trim())) {
          next[pKey] = incoming;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  // PL-11 + ĐC-1: Đồng bộ Chương 5/6 từ IndexedDB/gương RAM vào aiPeriodCache ngay khi hydration hoàn tất
  useEffect(() => {
    if (hydrationStatus === 'ready' || hydrationStatus === 'degraded') {
      hydratePeriodCacheFromLibrary(chart);
    }
  }, [chart, hydrationStatus, hydratePeriodCacheFromLibrary]);

  // LK-09: Xóa đồng bộ aiPeriodCache của lá số bị xóa hồ sơ hoặc xóa thẻ khỏi Thư Viện
  const handleRemoveLibraryEntry = useCallback(
    (
      targetKey: string,
      deleteMode: 'dossier_only' | 'entry_and_dossier' = 'entry_and_dossier',
    ) => {
      removeEntry(targetKey, deleteMode);
      setAiPeriodCache((prev) => {
        const prefix = `${targetKey}__`;
        let changed = false;
        const next: Record<string, AiPeriodEntry> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (k.startsWith(prefix)) {
            changed = true;
          } else {
            next[k] = v;
          }
        }
        return changed ? next : prev;
      });
    },
    [removeEntry],
  );

  const applyFormAndChart = useCallback(
    (newChart: ZiweiChart, form: BirthFormState, saveToLibrary = true) => {
      setChart(newChart);
      setCurrentForm(form);
      setActiveSihua(buildNatalActiveSihua(newChart));
      setSelectedPalace(null);
      setSelectedStarZh(null);
      setSelectedMutagen(null);
      if (saveToLibrary) {
        saveChart(form);
      }
      hydratePeriodCacheFromLibrary(newChart);
      try {
        const qs = formToSearchParams(form).toString();
        window.history.replaceState(null, '', `?${qs}`);
      } catch {
        // ignore URL update issues in restricted frames
      }
    },
    [saveChart, hydratePeriodCacheFromLibrary]
  );

  // Restore chart from URL query params if present
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const partial = searchParamsToForm(searchParams);
      if (partial && partial.year && partial.month && partial.day) {
        const merged: BirthFormState = {
          ...DEFAULT_BIRTH_FORM,
          ...partial,
        };
        const restoredChart = buildChartFromForm(merged);
        applyFormAndChart(restoredChart, merged, false);
      }
    } catch {
      // ignore invalid URL params
    }
  }, [applyFormAndChart]);

  const handleCopyShareLink = async () => {
    try {
      const qs = formToSearchParams(currentForm).toString();
      const url = `${window.location.origin}${window.location.pathname}?${qs}`;
      await navigator.clipboard.writeText(url);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2200);
    } catch {
      // ignore clipboard errors
    }
  };

  const resolvedExactMatchNotice = useMemo(() => {
    if (!exactMatchBanner) return null;
    const liveEntry = libraryEntries.find(
      (e) => e.chartIdentityKey === exactMatchBanner.chartIdentityKey,
    );
    const liveSummary = liveEntry
      ? resolveEffectiveDossierSummaryForEntry(
          liveEntry,
          liveEntry.chartIdentityKey === activeChartIdentityKey ? chart : undefined,
        )
      : null;
    const completedCount = liveSummary
      ? liveSummary.completedCount
      : exactMatchBanner.completedCount;
    const incompleteCount = liveSummary
      ? liveSummary.incompleteCount
      : exactMatchBanner.incompleteCount;
    const pinned = liveEntry ? liveEntry.pinned : exactMatchBanner.pinned;

    const title = exactMatchBanner.isAlreadyActiveOnBoard
      ? 'Lá số này đã từng lập và đang hiển thị trên Thiên Bàn'
      : 'Lá số này đã từng lập trong Thư Viện';

    let message: string;
    if (completedCount > 0) {
      message = exactMatchBanner.isAlreadyActiveOnBoard
        ? `Đã làm mới lá số đã lưu của "${exactMatchBanner.displayName}" (${exactMatchBanner.summaryMeta}). Trạng thái hồ sơ hiện tại: Đã luận giải ${completedCount}/8 chương hoàn tất${
            incompleteCount > 0 ? ` (kèm ${incompleteCount} chương đang lưu dở dang)` : ''
          }.`
        : `Đã tự động nạp lại lá số của "${exactMatchBanner.displayName}" (${exactMatchBanner.summaryMeta}) cùng Hồ sơ luận giải đã lưu (${completedCount}/8 chương hoàn tất${
            incompleteCount > 0 ? `, kèm ${incompleteCount} chương đang lưu dở dang` : ''
          }).`;
    } else if (hydrationStatus === 'hydrating' || hydrationStatus === 'idle') {
      message = `Đã tự động nạp lại lá số đã lưu của "${exactMatchBanner.displayName}" (${exactMatchBanner.summaryMeta}). Đang đồng bộ trạng thái Hồ sơ từ IndexedDB...`;
    } else {
      message = exactMatchBanner.isAlreadyActiveOnBoard
        ? `Đã làm mới lá số đã lưu của "${exactMatchBanner.displayName}" (${exactMatchBanner.summaryMeta}). Trạng thái hồ sơ: Chưa có chương luận giải nào (0/8 chương).`
        : `Đã tự động nạp lại lá số đã lưu của "${exactMatchBanner.displayName}" (${exactMatchBanner.summaryMeta}). Trạng thái hồ sơ: Chưa có chương luận giải nào (0/8 chương).`;
    }

    return {
      chartIdentityKey: exactMatchBanner.chartIdentityKey,
      pinned,
      title,
      message,
      completedCount,
      hydrationStatus,
    };
  }, [exactMatchBanner, libraryEntries, activeChartIdentityKey, chart, hydrationStatus]);

  // DM-07: Banner Trường hợp 1 tự ẩn sau 15 giây, tạm dừng khi hover/focus/touch và chỉ đếm sau khi hydration sẵn sàng
  useEffect(() => {
    if (!exactMatchBanner || exactMatchBannerPaused) return;
    if (hydrationStatus !== 'ready' && hydrationStatus !== 'degraded') return;
    const timer = window.setTimeout(() => {
      setExactMatchBanner(null);
    }, 15_000);
    return () => window.clearTimeout(timer);
  }, [exactMatchBanner, exactMatchBannerPaused, hydrationStatus]);

  const liveDuplicateCandidates = useMemo(() => {
    if (!pendingDuplicatePrompt) return [];
    return pendingDuplicatePrompt.result.candidates.map((candidate) => {
      const liveEntry = libraryEntries.find(
        (e) => e.chartIdentityKey === candidate.entry.chartIdentityKey,
      );
      if (!liveEntry) return candidate;
      const summary = resolveEffectiveDossierSummaryForEntry(liveEntry);
      return {
        ...candidate,
        entry: liveEntry,
        effectiveCompletedCount: summary.completedCount,
        effectiveIncompleteCount: summary.incompleteCount,
      };
    });
  }, [pendingDuplicatePrompt, libraryEntries]);

  const showExactMatchConfirmationForEntry = useCallback(
    (
      entry: ChartLibraryEntry,
      completedCount: number,
      incompleteCount: number,
      isAlreadyActiveOnBoard: boolean,
    ) => {
      const displayName =
        entry.customAlias.trim() || entry.form.name.trim() || 'Đương số chưa đặt tên';
      const badge = entry.deterministicBadge;
      const summaryMeta = [
        badge.solarDateStr,
        `${badge.clockTimeLabelVi} (${badge.shichenLabelVi})`,
        badge.locationLabelVi,
      ]
        .filter(Boolean)
        .join(' · ');

      setExactMatchBannerPaused(false);
      setExactMatchBanner({
        chartIdentityKey: entry.chartIdentityKey,
        displayName,
        summaryMeta,
        pinned: entry.pinned,
        completedCount,
        incompleteCount,
        isAlreadyActiveOnBoard,
      });
      setPinNotice(null);

      window.requestAnimationFrame(() => {
        summaryBannerRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      });
    },
    [],
  );

  const handleBirthFormChartGenerated = useCallback(
    (
      newChart: ZiweiChart,
      submittedForm: BirthFormState,
      source: ChartGenerationSource = 'user_form_submit',
      fromDrawer = false,
    ) => {
      const detection = detectChartDuplicateInLibrary(submittedForm);

      if (source === 'famous_preset') {
        // DM-04 & QĐ-M4 Phương án A: Nạp danh nhân chỉ nạp êm khi exact_match, không bật modal Trường hợp 2
        setExactMatchBanner(null);
        setEditingSourceEntryKey(null);
        if (detection.kind === 'exact_match') {
          const savedChart = buildChartFromForm(detection.existingEntry.form);
          applyFormAndChart(savedChart, detection.existingEntry.form, false);
          upsertChartToLibrary(detection.existingEntry.form);
        } else {
          applyFormAndChart(newChart, submittedForm, true);
        }
        if (fromDrawer) setShowFormDrawer(false);
        return;
      }

      if (detection.kind === 'exact_match') {
        // DM-02 & QĐ-M1 & QĐ-M5: Tái tạo chart từ existingEntry.form để nhất quán tuyệt đối 100%
        const entry = detection.existingEntry;
        const isAlreadyActiveOnBoard =
          activeChartIdentityKey === entry.chartIdentityKey;
        const savedChart = buildChartFromForm(entry.form);
        applyFormAndChart(savedChart, entry.form, false);
        upsertChartToLibrary(entry.form);
        setEditingSourceEntryKey(null);
        showExactMatchConfirmationForEntry(
          entry,
          detection.completedCount,
          detection.incompleteCount,
          isAlreadyActiveOnBoard,
        );
        if (fromDrawer) setShowFormDrawer(false);
        return;
      }

      if (detection.kind === 'near_match') {
        setExactMatchBanner(null);
        setPendingDuplicatePrompt({
          result: detection,
          fromDrawer,
        });
        return;
      }

      // Trường hợp không trùng (none)
      setExactMatchBanner(null);
      setEditingSourceEntryKey(null);
      applyFormAndChart(newChart, submittedForm, true);
      if (fromDrawer) setShowFormDrawer(false);
    },
    [
      activeChartIdentityKey,
      applyFormAndChart,
      showExactMatchConfirmationForEntry,
    ],
  );

  const handleDuplicateChooseExisting = useCallback(
    (chosenEntry: ChartLibraryEntry) => {
      const wasFromDrawer = pendingDuplicatePrompt?.fromDrawer ?? false;
      // DM-08 (Stale Entry Guard): Kiểm tra lại mục đã lưu trong chỉ mục trước khi thực thi mở
      const freshEntry = readLibraryIndexStore().entries.find(
        (e) => e.chartIdentityKey === chosenEntry.chartIdentityKey,
      );
      setPendingDuplicatePrompt(null);

      if (!freshEntry) {
        setPinNotice(
          'Lá số đã lưu bạn vừa chọn không còn tồn tại trong Thư Viện (có thể đã bị xóa). Dữ kiện bạn vừa nhập vẫn được giữ nguyên trên biểu mẫu — hãy bấm "An Sao Lập Lá Số" lần nữa nếu muốn lập mới.',
        );
        return;
      }

      const isAlreadyActiveOnBoard =
        activeChartIdentityKey === freshEntry.chartIdentityKey;
      const savedChart = buildChartFromForm(freshEntry.form);
      const effectiveSummary = resolveEffectiveDossierSummaryForEntry(
        freshEntry,
        savedChart,
      );
      setEditingSourceEntryKey(null);
      markLibraryEntryOpened(freshEntry.chartIdentityKey);
      applyFormAndChart(savedChart, freshEntry.form, false);
      showExactMatchConfirmationForEntry(
        freshEntry,
        effectiveSummary.completedCount,
        effectiveSummary.incompleteCount,
        isAlreadyActiveOnBoard,
      );
      if (wasFromDrawer) {
        setShowFormDrawer(false);
      }
    },
    [
      pendingDuplicatePrompt,
      activeChartIdentityKey,
      applyFormAndChart,
      showExactMatchConfirmationForEntry,
    ],
  );

  const handleDuplicateChooseCreateNew = useCallback(() => {
    if (!pendingDuplicatePrompt) return;
    const { incomingChart, incomingForm } = pendingDuplicatePrompt.result;
    const wasFromDrawer = pendingDuplicatePrompt.fromDrawer;
    setPendingDuplicatePrompt(null);
    setEditingSourceEntryKey(null);
    setExactMatchBanner(null);
    applyFormAndChart(incomingChart, incomingForm, true);
    if (wasFromDrawer) {
      setShowFormDrawer(false);
    }
  }, [pendingDuplicatePrompt, applyFormAndChart]);

  const handleDuplicateBackToEdit = useCallback(() => {
    setPendingDuplicatePrompt(null);
  }, []);

  const inlineDuplicateNoticeForBirthForm =
    useMemo<BirthFormInlineDuplicateNotice | null>(() => {
      if (!resolvedExactMatchNotice) return null;
      return {
        title: resolvedExactMatchNotice.title,
        message: resolvedExactMatchNotice.message,
        completedCount: resolvedExactMatchNotice.completedCount,
        hydrationStatus: resolvedExactMatchNotice.hydrationStatus,
        onOpenDossier: () => {
          setExactMatchBanner(null);
          setShowDossierModal(true);
        },
        onDismiss: () => setExactMatchBanner(null),
      };
    }, [resolvedExactMatchNotice]);

  const handleFamousSelect = (personId: string) => {
    const p = VI_FAMOUS_PERSONS.find((item) => item.id === personId);
    if (!p) return;
    const clockHour = p.hour === 0 ? 0 : p.hour * 2 - 1;
    const presetForm: BirthFormState = {
      name: p.name,
      year: String(p.year),
      month: String(p.month),
      day: String(p.day),
      clockHour: String(clockHour),
      clockMinute: '30',
      unknownTime: false,
      gender: p.gender,
      province: 'Việt Nam — Miền Bắc',
      city: 'Hà Nội',
      longitude: 105.85,
    };
    const c = buildChartFromForm(presetForm);
    handleBirthFormChartGenerated(c, presetForm, 'famous_preset', false);
    setActiveTab('chart');
  };

  const shichenText = VI_SHICHEN[chart.birthInfo.hour]?.name ?? '';

  return (
    <div className="min-h-screen flex flex-col bg-[var(--t-bg)] text-[var(--t-text)]">
      {/* Top Bar Contract: Single-row 3-zone header */}
      <header
        className="sticky top-0 z-30 border-b border-[var(--t-border)] backdrop-blur-md"
        style={{ backgroundColor: 'var(--t-header)' }}
      >
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('chart')}
            className="flex items-center gap-2.5 text-left cursor-pointer shrink-0"
          >
            <div className="w-9 h-9 rounded-lg bg-[var(--t-gold)]/15 border border-[var(--t-gold)]/50 flex items-center justify-center text-[var(--t-gold)] font-serif font-bold text-lg">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm sm:text-base font-bold tracking-tight text-[var(--t-text)] leading-none">
                Tử Vi Thiên Kỷ
              </div>
              <div className="text-[11px] text-[var(--t-gold)] font-medium mt-0.5">
                Hệ Thống Nghê Hải Hạ
              </div>
            </div>
          </button>

          {/* Zone 2: Primary Navigation (4 items) */}
          <nav className="hidden md:flex items-center gap-2">
            {(
              [
                { id: 'chart', label: 'Lá Số Tử Vi' },
                { id: 'heming', label: 'Hợp Bàn Đôi Lứa' },
                { id: 'knowledge', label: 'Tinh Diệu & Cổ Thư' },
                { id: 'famous', label: 'Lá Số Danh Nhân' },
              ] as const
            ).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[var(--t-gold)]/15 text-[var(--t-gold)] border border-[var(--t-gold)]/50'
                      : 'text-[var(--t-text2)] hover:text-[var(--t-text)] border border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Primary Action & Theme Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowLibraryModal(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold border border-[var(--t-border)] bg-[var(--t-card)] text-[var(--t-text2)] hover:text-[var(--t-gold)] hover:border-[var(--t-gold)]/50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Mở Thư Viện Lá Số & Hồ Sơ Luận Giải"
            >
              <Library className="w-3.5 h-3.5 text-[var(--t-gold)]" />
              <span className="hidden sm:inline">Thư Viện</span>
              <span className="font-mono-tabular text-[11px] text-[var(--t-gold)]">
                ({libraryEntries.length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowKeyPool(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold border border-[var(--t-border)] bg-[var(--t-card)] text-[var(--t-text2)] hover:text-[var(--t-gold)] hover:border-[var(--t-gold)]/50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Quản lý Kho Khóa Gemini API"
            >
              <KeyRound className="w-3.5 h-3.5 text-[var(--t-gold)]" />
              <span className="hidden sm:inline">Kho Khóa</span>
              {poolSummary && (
                <span
                  className={`font-mono-tabular text-[11px] ${
                    poolSummary.ready > 0 ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {poolSummary.ready}/{poolSummary.total}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-[var(--t-border)] bg-[var(--t-card)] text-[var(--t-text2)] hover:text-[var(--t-gold)] transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Chuyển sang nền Giấy Cổ (Sáng)' : 'Chuyển sang nền Huyền Không (Tối)'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handleCopyShareLink}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-[var(--t-gold)]/50 bg-[var(--t-gold)]/10 text-[var(--t-gold)] hover:bg-[var(--t-gold)]/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedShare ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Đã sao chép link</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Chia Sẻ Lá Số</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Nav Bar */}
        <div className="md:hidden flex items-center gap-1 px-4 pb-2.5 overflow-x-auto">
          {(
            [
              { id: 'chart', label: 'Lá Số Tử Vi' },
              { id: 'heming', label: 'Hợp Bàn' },
              { id: 'knowledge', label: 'Tinh Diệu' },
              { id: 'famous', label: 'Danh Nhân' },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[var(--t-gold)]/15 text-[var(--t-gold)] border border-[var(--t-gold)]/50 font-semibold'
                    : 'text-[var(--t-text2)] border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5 sm:py-6">
        {activeTab === 'chart' && (
          <div className="space-y-6">
            {/* Quick Summary Bar + Toggle Birth Form on Mobile/Desktop */}
            <div ref={summaryBannerRef} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 border bg-[var(--t-card)] border-[var(--t-border)]">
                <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                  <Compass className="w-4 h-4 text-[var(--t-gold)] shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold text-[var(--t-text)]">
                    Đương số: <strong className="text-[var(--t-gold)]">{chart.birthInfo.name || 'Ẩn danh'}</strong>
                  </span>
                  {activeLibraryEntry?.customAlias && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-[var(--t-gold)]/15 border border-[var(--t-gold)]/40 text-[var(--t-gold)] font-medium truncate max-w-[200px]">
                      {activeLibraryEntry.customAlias}
                    </span>
                  )}
                  <span className="text-xs text-[var(--t-text2)] font-mono tabular-nums">
                    · Dương lịch: {chart.birthInfo.day}/{chart.birthInfo.month}/{chart.birthInfo.year} ({shichenText})
                  </span>
                  {chart.birthInfo.city && (
                    <span className="text-xs text-[var(--t-faint)] hidden sm:inline">
                      · Nơi sinh: {chart.birthInfo.city}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeLibraryEntry) {
                        saveChart(currentForm);
                      }
                      const res = togglePin(activeChartIdentityKey);
                      if (!res.ok && res.reason === 'MAX_PINNED_REACHED') {
                        setPinNotice('Đã đạt giới hạn tối đa 30 lá số ghim. Hãy bỏ ghim một mục trong Thư Viện trước.');
                        window.setTimeout(() => setPinNotice(null), 3500);
                      } else {
                        setPinNotice(null);
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      activeLibraryEntry?.pinned
                        ? 'border-[var(--t-gold)] bg-[var(--t-gold)]/20 text-[var(--t-gold)]'
                        : 'border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)] hover:text-[var(--t-gold)] hover:border-[var(--t-gold)]/50'
                    }`}
                    title={activeLibraryEntry?.pinned ? 'Bỏ ghim lá số này' : 'Lưu & ghim lá số này lên đầu Thư Viện'}
                  >
                    {activeLibraryEntry?.pinned ? (
                      <>
                        <PinOff className="w-3.5 h-3.5" />
                        <span>Đã ghim</span>
                      </>
                    ) : (
                      <>
                        <Pin className="w-3.5 h-3.5" />
                        <span>Ghim</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowDossierModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--t-gold)]/55 bg-[var(--t-gold)]/12 text-[var(--t-gold)] hover:bg-[var(--t-gold)]/20 transition-all cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>
                      {hydrationStatus === 'idle' || hydrationStatus === 'hydrating'
                        ? 'Hồ Sơ Chi Tiết (Đang nạp...)'
                        : (activeLibraryEntry?.dossierSummary.completedCount ?? 0) > 0
                          ? `Hồ Sơ Chi Tiết (${activeLibraryEntry!.dossierSummary.completedCount}/8 Chương)`
                          : 'Hồ Sơ Chi Tiết (8 Chương)'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFormDrawer((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--t-gold)] text-slate-950 hover:opacity-95 transition-all cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{showFormDrawer ? 'Thu Gọn Khung Nhập' : 'Đổi Ngày Giờ Sinh / Lập Lá Số Mới'}</span>
                  </button>
                </div>
              </div>

              {resolvedExactMatchNotice && (
                <div
                  onMouseEnter={() => setExactMatchBannerPaused(true)}
                  onMouseLeave={() => setExactMatchBannerPaused(false)}
                  onFocus={() => setExactMatchBannerPaused(true)}
                  onBlur={() => setExactMatchBannerPaused(false)}
                  onTouchStart={() => setExactMatchBannerPaused(true)}
                  className="rounded-xl px-3.5 py-2.5 border border-[var(--t-gold)]/55 bg-[var(--t-gold)]/10 text-xs flex flex-wrap items-center justify-between gap-2.5"
                >
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 font-semibold text-[var(--t-gold)]">
                      <span>📌 {resolvedExactMatchNotice.title}</span>
                      {resolvedExactMatchNotice.pinned && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-[var(--t-gold)]/20 border border-[var(--t-gold)]/45">
                          <Pin className="w-2.5 h-2.5" />
                          <span>Đã ghim</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[var(--t-text2)] leading-relaxed">
                      {resolvedExactMatchNotice.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setExactMatchBanner(null);
                        setShowDossierModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--t-gold)] text-slate-950 hover:opacity-95 cursor-pointer whitespace-nowrap"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>
                        {resolvedExactMatchNotice.completedCount > 0
                          ? `Mở Hồ Sơ (${resolvedExactMatchNotice.completedCount}/8 Chương)`
                          : resolvedExactMatchNotice.hydrationStatus === 'hydrating' ||
                              resolvedExactMatchNotice.hydrationStatus === 'idle'
                            ? 'Mở Hồ Sơ (Đang nạp...)'
                            : 'Mở Hồ Sơ 8 Chương'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExactMatchBanner(null)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)] hover:text-[var(--t-text)] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Đóng</span>
                    </button>
                  </div>
                </div>
              )}

              {pinNotice && (
                <div className="rounded-lg px-3 py-2 border border-amber-500/45 bg-amber-950/35 text-xs text-amber-200 flex items-center justify-between gap-2">
                  <span>{pinNotice}</span>
                  <button
                    type="button"
                    onClick={() => setPinNotice(null)}
                    className="p-0.5 text-amber-300/75 hover:text-amber-100 cursor-pointer shrink-0"
                    title="Đóng"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Collapsible BirthForm Drawer */}
            {showFormDrawer && (
              <div className="max-w-2xl mx-auto">
                <BirthForm
                  initialState={currentForm}
                  historyItems={historyItems}
                  onSelectHistory={(form) => {
                    const c = buildChartFromForm(form);
                    setExactMatchBanner(null);
                    setEditingSourceEntryKey(null);
                    applyFormAndChart(c, form, false);
                    markLibraryEntryOpened(buildChartIdentityKey(c));
                    setShowFormDrawer(false);
                  }}
                  onRemoveHistory={(id) => handleRemoveLibraryEntry(id, 'entry_and_dossier')}
                  onOpenLibrary={() => {
                    setShowFormDrawer(false);
                    setShowLibraryModal(true);
                  }}
                  inlineDuplicateNotice={inlineDuplicateNoticeForBirthForm}
                  onChartGenerated={(c, f, source) =>
                    handleBirthFormChartGenerated(c, f, source ?? 'user_form_submit', true)
                  }
                />
              </div>
            )}

            {/* Main 12-Column Responsive Split Workspace */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Left 7 Columns: TimeNav + 12-Palace ChartBoard + StarDetailPanel */}
              <div className="xl:col-span-7 space-y-4">
                <TimeNav
                  chart={chart}
                  activeSihua={activeSihua}
                  onChange={setActiveSihua}
                  onRequestAiPeriod={() => setAiRequestTick((t) => t + 1)}
                  aiLoading={aiPeriodLoading}
                />

                <ChartBoard
                  chart={chart}
                  activeSihua={activeSihua}
                  selectedPalace={selectedPalace}
                  onSelectPalace={(p) => {
                    setSelectedPalace(p);
                    setSelectedMutagen(null);
                  }}
                  onStarClick={(starName) => setSelectedStarZh(starName)}
                  onMutagenClick={(starName, mutagen, palaceName) => {
                    setSelectedMutagen({ starName, mutagen, palaceName });
                  }}
                />

                {selectedStarZh && (
                  <StarDetailPanel
                    starNameZh={selectedStarZh}
                    onClose={() => setSelectedStarZh(null)}
                  />
                )}
              </div>

              {/* Right 5 Columns: BirthForm + Classical Patterns + AI Insight */}
              <div className="xl:col-span-5 space-y-5">
                {!showFormDrawer && (
                  <BirthForm
                    initialState={currentForm}
                    historyItems={historyItems}
                    onSelectHistory={(form) => {
                      const c = buildChartFromForm(form);
                      setExactMatchBanner(null);
                      setEditingSourceEntryKey(null);
                      applyFormAndChart(c, form, false);
                      markLibraryEntryOpened(buildChartIdentityKey(c));
                    }}
                    onRemoveHistory={(id) => handleRemoveLibraryEntry(id, 'entry_and_dossier')}
                    onOpenLibrary={() => setShowLibraryModal(true)}
                    inlineDuplicateNotice={inlineDuplicateNoticeForBirthForm}
                    onChartGenerated={(c, f, source) =>
                      handleBirthFormChartGenerated(c, f, source ?? 'user_form_submit', false)
                    }
                  />
                )}

                <PatternsCard chart={chart} />

                <InsightPanel
                  chart={chart}
                  activeSihua={activeSihua}
                  selectedPalace={selectedPalace}
                  selectedMutagen={selectedMutagen}
                  externalAiRequestTick={aiRequestTick}
                  onAiLoadingChange={setAiPeriodLoading}
                  onOpenKeyPool={() => setShowKeyPool(true)}
                  aiPeriodCache={aiPeriodCache}
                  onAiPeriodCacheChange={setAiPeriodCache}
                  onOpenDossierModal={() => setShowDossierModal(true)}
                  onOpenContextualChat={(ctx) => setChatDrawerContext(ctx)}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'heming' && (
          <HemingView onOpenContextualChat={(ctx) => setChatDrawerContext(ctx)} />
        )}

        {activeTab === 'knowledge' && <KnowledgeView />}

        {activeTab === 'famous' && (
          <div className="space-y-5">
            <div className="rounded-xl p-5 border bg-[var(--t-card)] border-[var(--t-border)] space-y-1">
              <div className="flex items-center gap-2 text-[var(--t-gold)] font-bold text-sm sm:text-base">
                <UserCheck className="w-4 h-4" />
                <span>Thư Viện Lá Số Danh Nhân Lịch Sử — Nghiệm Lý Tử Vi Đẩu Số</span>
              </div>
              <p className="text-xs text-[var(--t-text2)] leading-relaxed">
                Khảo cứu các lá số kinh điển để kiểm chứng quy luật <strong>Tam Phương Tứ Chính</strong>, <strong>Cách Cục Cổ Phú</strong> và <strong>Đại Hạn 10 Năm</strong> trong thực tế lịch sử. Nhấn vào bất kỳ danh nhân nào để nạp trực tiếp lên Thiên Bàn.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {VI_FAMOUS_PERSONS.map((person) => (
                <div
                  key={person.id}
                  className="rounded-xl p-4 border bg-[var(--t-card)] border-[var(--t-border)] hover:border-[var(--t-gold)]/60 transition-all flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-[var(--t-text)]">
                          {person.name}
                        </h3>
                        <p className="text-xs text-[var(--t-gold)] font-medium">
                          {person.category} · {person.description}
                        </p>
                      </div>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--t-surface)] border border-[var(--t-border)] text-[var(--t-text2)] tabular-nums">
                        {person.year}.{person.month}.{person.day}
                      </span>
                    </div>

                    <p className="text-xs text-[var(--t-text2)] leading-relaxed">
                      {person.notable}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleFamousSelect(person.id)}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold border border-[var(--t-gold)]/50 bg-[var(--t-gold)]/10 text-[var(--t-gold)] hover:bg-[var(--t-gold)] hover:text-slate-950 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Nạp Lá Số Lên Thiên Bàn</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--t-border)] py-4 px-4 sm:px-6 text-center text-xs text-[var(--t-faint)]">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Tử Vi Thiên Kỷ — Hệ thống an sao Tử Vi Đẩu Số theo Chân Thái Dương Thời & Cổ Phú Toàn Thư
          </span>
          <span>
            Tri mệnh để dưỡng tâm, thuận thiên thời mà hành đạo
          </span>
        </div>
      </footer>

      <DetailedDossierModal
        open={showDossierModal}
        onClose={() => setShowDossierModal(false)}
        chart={chart}
        aiPeriodCache={aiPeriodCache}
        onAiPeriodCacheChange={setAiPeriodCache}
        onOpenContextualChat={(ctx) => setChatDrawerContext(ctx)}
        onOpenKeyPool={() => setShowKeyPool(true)}
        onOpenLibrary={() => {
          setShowDossierModal(false);
          setShowLibraryModal(true);
        }}
        onDossierGeneratingChange={setIsDossierGenerating}
        hydrationStatus={hydrationStatus}
        storageHealth={storageHealth}
      />

      <ChartLibraryModal
        open={showLibraryModal}
        onClose={() => setShowLibraryModal(false)}
        entries={libraryEntries}
        activeChartIdentityKey={activeChartIdentityKey}
        hydrationStatus={hydrationStatus}
        storageHealth={storageHealth}
        lastEvictedBackup={lastEvictedBackup}
        onSelectChart={(entry: ChartLibraryEntry, openDossierAfter = false) => {
          setExactMatchBanner(null);
          setEditingSourceEntryKey(null);
          markLibraryEntryOpened(entry.chartIdentityKey);
          const nextChart = buildChartFromForm(entry.form);
          applyFormAndChart(nextChart, entry.form, false);
          setActiveTab('chart');
          setShowLibraryModal(false);
          if (openDossierAfter) {
            setShowDossierModal(true);
          }
        }}
        onLoadIntoFormToEditNew={(entry: ChartLibraryEntry) => {
          setExactMatchBanner(null);
          setEditingSourceEntryKey(entry.chartIdentityKey);
          setCurrentForm(entry.form);
          setShowFormDrawer(true);
          setActiveTab('chart');
          setShowLibraryModal(false);
        }}
        onTogglePin={togglePin}
        onUpdateMeta={updateMeta}
        onRemoveEntry={handleRemoveLibraryEntry}
        onUndoEviction={undoEviction}
        onDismissEviction={dismissEviction}
        onLibraryImported={() => {
          refreshFromStore();
          hydratePeriodCacheFromLibrary(chart);
        }}
      />

      {pendingDuplicatePrompt && (
        <DuplicateChartPromptModal
          open={true}
          candidates={liveDuplicateCandidates}
          totalCandidateCount={pendingDuplicatePrompt.result.totalCandidateCount}
          incomingForm={pendingDuplicatePrompt.result.incomingForm}
          incomingChart={pendingDuplicatePrompt.result.incomingChart}
          hydrationStatus={hydrationStatus}
          editingSourceEntryKey={editingSourceEntryKey}
          onChooseExisting={handleDuplicateChooseExisting}
          onChooseCreateNew={handleDuplicateChooseCreateNew}
          onBackToEdit={handleDuplicateBackToEdit}
        />
      )}

      <ContextualChatDrawer
        open={chatDrawerContext !== null}
        context={chatDrawerContext}
        onClose={() => setChatDrawerContext(null)}
        isDossierGenerating={isDossierGenerating}
      />

      <KeyPoolModal
        open={showKeyPool}
        onClose={() => setShowKeyPool(false)}
        hasOtherOverlayOpen={
          showDossierModal ||
          chatDrawerContext !== null ||
          showLibraryModal ||
          pendingDuplicatePrompt !== null
        }
        onPoolUpdated={(snap) =>
          setPoolSummary((prev) =>
            prev &&
            prev.ready === snap.summary.ready &&
            prev.total === snap.summary.total
              ? prev
              : { ready: snap.summary.ready, total: snap.summary.total },
          )
        }
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
