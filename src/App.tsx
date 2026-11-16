import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider, useTheme } from './components/ThemeProvider';
import BirthForm, { DEFAULT_BIRTH_FORM } from './components/BirthForm';
import ChartBoard from './components/ChartBoard';
import TimeNav, { ActiveSihua, buildNatalActiveSihua } from './components/TimeNav';
import PatternsCard from './components/PatternsCard';
import StarDetailPanel from './components/StarDetailPanel';
import InsightPanel from './components/InsightPanel';
import HemingView from './components/HemingView';
import KnowledgeView from './components/KnowledgeView';
import KeyPoolModal from './components/KeyPoolModal';
import DetailedDossierModal from './components/DetailedDossierModal';
import ContextualChatDrawer from './components/ContextualChatDrawer';
import type {
  AiPeriodEntry,
  ContextualChatContextPayload,
} from './lib/dossier-chat-ui';
import { ZiweiChart, Palace, BirthFormState } from './lib/ziwei/types';
import {
  formToBirthInfo,
  formToSearchParams,
  searchParamsToForm,
} from './lib/ziwei/share';
import { generateChart } from './lib/ziwei/algorithm';
import { useHistory } from './lib/ziwei/history';
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

  const { history: historyItems, save: addHistory, remove: removeHistory } = useHistory();

  const applyFormAndChart = useCallback(
    (newChart: ZiweiChart, form: BirthFormState, saveHistory = true) => {
      setChart(newChart);
      setCurrentForm(form);
      setActiveSihua(buildNatalActiveSihua(newChart));
      setSelectedPalace(null);
      setSelectedStarZh(null);
      setSelectedMutagen(null);
      if (saveHistory) {
        addHistory(form);
      }
      try {
        const qs = formToSearchParams(form).toString();
        window.history.replaceState(null, '', `?${qs}`);
      } catch {
        // ignore URL update issues in restricted frames
      }
    },
    [addHistory]
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
    applyFormAndChart(c, presetForm, true);
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
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 border bg-[var(--t-card)] border-[var(--t-border)]">
              <div className="flex items-center gap-2.5 flex-wrap">
                <Compass className="w-4 h-4 text-[var(--t-gold)] shrink-0" />
                <span className="text-xs sm:text-sm font-semibold text-[var(--t-text)]">
                  Đương số: <strong className="text-[var(--t-gold)]">{chart.birthInfo.name || 'Ẩn danh'}</strong>
                </span>
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
                  onClick={() => setShowDossierModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--t-gold)]/55 bg-[var(--t-gold)]/12 text-[var(--t-gold)] hover:bg-[var(--t-gold)]/20 transition-all cursor-pointer whitespace-nowrap shrink-0"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Hồ Sơ Chi Tiết (8 Chương)</span>
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

            {/* Collapsible BirthForm Drawer */}
            {showFormDrawer && (
              <div className="max-w-2xl mx-auto">
                <BirthForm
                  initialState={currentForm}
                  historyItems={historyItems}
                  onSelectHistory={(form) => {
                    const c = buildChartFromForm(form);
                    applyFormAndChart(c, form, false);
                    setShowFormDrawer(false);
                  }}
                  onRemoveHistory={removeHistory}
                  onChartGenerated={(c, f) => {
                    applyFormAndChart(c, f, true);
                    setShowFormDrawer(false);
                  }}
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
                      applyFormAndChart(c, form, false);
                    }}
                    onRemoveHistory={removeHistory}
                    onChartGenerated={(c, f) => applyFormAndChart(c, f, true)}
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

      <KeyPoolModal
        open={showKeyPool}
        onClose={() => setShowKeyPool(false)}
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

      <DetailedDossierModal
        open={showDossierModal}
        onClose={() => setShowDossierModal(false)}
        chart={chart}
        aiPeriodCache={aiPeriodCache}
        onAiPeriodCacheChange={setAiPeriodCache}
        onOpenContextualChat={(ctx) => setChatDrawerContext(ctx)}
        onOpenKeyPool={() => setShowKeyPool(true)}
        onDossierGeneratingChange={setIsDossierGenerating}
      />

      <ContextualChatDrawer
        open={chatDrawerContext !== null}
        context={chatDrawerContext}
        onClose={() => setChatDrawerContext(null)}
        isDossierGenerating={isDossierGenerating}
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
