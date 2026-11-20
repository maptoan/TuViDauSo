import React, { useMemo, useRef, useState } from 'react';
import {
  DOSSIER_CHAPTER_SPECS,
  type DossierChapterId,
} from '../lib/dossier-chat-ui';
import {
  LIBRARY_MAX_ALIAS_CHARS,
  LIBRARY_MAX_NOTE_CHARS,
  MAX_LIBRARY_ENTRIES,
  MAX_PINNED_ENTRIES,
  exportLibraryBundle,
  filterAndSortLibraryEntries,
  importLibraryBundleWithMerge,
  triggerJsonFileDownload,
  type ChartLibraryEntry,
  type EvictedBackupItem,
  type ImportMergeResult,
  type LibraryFilterMode,
  type LibraryHydrationStatus,
  type LibrarySortMode,
  type LibraryStorageHealth,
} from '../lib/chart-library';
import {
  X,
  Library,
  Search,
  Pin,
  PinOff,
  BookOpen,
  Download,
  Upload,
  Trash2,
  Edit3,
  Check,
  AlertTriangle,
  RefreshCw,
  RotateCcw,
  Sparkles,
  FileJson,
  Clock,
  Cpu,
} from 'lucide-react';

interface ChartLibraryModalProps {
  open: boolean;
  onClose: () => void;
  entries: ChartLibraryEntry[];
  activeChartIdentityKey: string;
  hydrationStatus: LibraryHydrationStatus;
  storageHealth: LibraryStorageHealth;
  lastEvictedBackup: EvictedBackupItem | null;
  onSelectChart: (entry: ChartLibraryEntry, openDossierAfter?: boolean) => void;
  onLoadIntoFormToEditNew: (entry: ChartLibraryEntry) => void;
  onTogglePin: (chartIdentityKey: string) => {
    ok: boolean;
    pinned?: boolean;
    reason?: string;
  };
  onUpdateMeta: (
    chartIdentityKey: string,
    patch: { customAlias?: string; notes?: string },
  ) => void;
  onRemoveEntry: (
    chartIdentityKey: string,
    deleteMode: 'dossier_only' | 'entry_and_dossier',
  ) => void;
  onUndoEviction: () => void;
  onDismissEviction: () => void;
  onLibraryImported: () => void;
}

const CHAPTER_SHORT_NUMBER: Record<DossierChapterId, string> = {
  chapter_overview: 'Ch.1',
  palaces_core: 'Ch.2',
  palaces_family: 'Ch.3',
  palaces_social_health: 'Ch.4',
  year_2026: 'Ch.5',
  year_2027: 'Ch.6',
  horizon_5y: 'Ch.7',
  horizon_10y: 'Ch.8',
};

function formatTimestampVi(ts: number | null | undefined): string {
  if (!ts || !Number.isFinite(ts)) return '—';
  try {
    return new Date(ts).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function ChartLibraryModal({
  open,
  onClose,
  entries,
  activeChartIdentityKey,
  hydrationStatus,
  storageHealth,
  lastEvictedBackup,
  onSelectChart,
  onLoadIntoFormToEditNew,
  onTogglePin,
  onUpdateMeta,
  onRemoveEntry,
  onUndoEviction,
  onDismissEviction,
  onLibraryImported,
}: ChartLibraryModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<LibraryFilterMode>('all');
  const [sortMode, setSortMode] = useState<LibrarySortMode>('last_opened');
  const [importMode, setImportMode] = useState<'smart_merge' | 'force_restore_all'>(
    'smart_merge',
  );
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftAlias, setDraftAlias] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);
  const [busyExport, setBusyExport] = useState(false);
  const [busyImport, setBusyImport] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stats = useMemo(() => {
    const pinnedCount = entries.filter((e) => e.pinned).length;
    const withDossierCount = entries.filter(
      (e) => e.dossierSummary.completedCount > 0,
    ).length;
    const complete8Count = entries.filter(
      (e) => e.dossierSummary.completedCount >= 8,
    ).length;
    const withNotesCount = entries.filter((e) => e.notes.trim().length > 0).length;
    const totalChapters = entries.reduce(
      (acc, e) => acc + e.dossierSummary.completedCount,
      0,
    );
    return {
      pinnedCount,
      withDossierCount,
      complete8Count,
      withNotesCount,
      totalChapters,
    };
  }, [entries]);

  const visibleEntries = useMemo(
    () =>
      filterAndSortLibraryEntries(entries, {
        query: searchQuery,
        filter: filterMode,
        sort: sortMode,
      }),
    [entries, searchQuery, filterMode, sortMode],
  );

  if (!open) return null;

  const handleExportAll = async () => {
    setBusyExport(true);
    try {
      const bundle = await exportLibraryBundle();
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `tu-vi-thien-ky-library-${dateStr}.json`;
      const ok = triggerJsonFileDownload(filename, JSON.stringify(bundle, null, 2));
      setStatusNotice(
        ok
          ? {
              type: 'success',
              text: `Đã xuất ${bundle.entries.length} lá số và ${Object.keys(bundle.dossiers).length} bộ Hồ Sơ ra tệp ${filename}.`,
            }
          : {
              type: 'error',
              text: 'Trình duyệt không cho phép tải tệp xuống tự động.',
            },
      );
    } finally {
      setBusyExport(false);
    }
  };

  const handleExportSingle = async (entry: ChartLibraryEntry) => {
    setBusyExport(true);
    try {
      const bundle = await exportLibraryBundle({
        onlyChartIdentityKey: entry.chartIdentityKey,
      });
      const rawName = (entry.customAlias || entry.form.name || 'la-so')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `tu-vi-${rawName || 'la-so'}-${dateStr}.json`;
      const ok = triggerJsonFileDownload(filename, JSON.stringify(bundle, null, 2));
      if (ok) {
        setStatusNotice({
          type: 'success',
          text: `Đã xuất lá số "${entry.customAlias || entry.form.name || 'Ẩn danh'}" ra tệp ${filename}.`,
        });
      }
    } finally {
      setBusyExport(false);
    }
  };

  const handleImportFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setStatusNotice({
        type: 'error',
        text: 'Tệp JSON vượt quá giới hạn tối đa 25 MB.',
      });
      return;
    }

    setBusyImport(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result: ImportMergeResult = await importLibraryBundleWithMerge(parsed, {
        mode: importMode,
      });
      if (!result.ok) {
        setStatusNotice({
          type: 'error',
          text: result.error ?? 'Không thể nhập tệp JSON.',
        });
        return;
      }
      onLibraryImported();
      setStatusNotice({
        type: 'success',
        text:
          `Đã nhập thành công: +${result.addedEntries} lá số mới, ` +
          `cập nhật ${result.updatedEntries} lá số, gộp thêm ${result.mergedCompletedChapters} chương hồ sơ` +
          (result.skippedTombstonedCount > 0
            ? `, giữ nguyên không hồi sinh ${result.skippedTombstonedCount} mục đã xóa`
            : '') +
          (result.skippedInvalidCount > 0
            ? `, bỏ qua ${result.skippedInvalidCount} bản ghi lỗi`
            : '') +
          '.',
      });
    } catch {
      setStatusNotice({
        type: 'error',
        text: 'Tệp JSON không hợp lệ hoặc bị hỏng cấu trúc.',
      });
    } finally {
      setBusyImport(false);
    }
  };

  const handleOpenEdit = (entry: ChartLibraryEntry) => {
    setConfirmDeleteKey(null);
    if (editingKey === entry.chartIdentityKey) {
      setEditingKey(null);
      return;
    }
    setEditingKey(entry.chartIdentityKey);
    setDraftAlias(entry.customAlias);
    setDraftNotes(entry.notes);
  };

  const handleSaveEdit = (chartIdentityKey: string) => {
    onUpdateMeta(chartIdentityKey, {
      customAlias: draftAlias,
      notes: draftNotes,
    });
    setEditingKey(null);
    setStatusNotice({
      type: 'success',
      text: 'Đã lưu tên gợi nhớ và ghi chú vào Thư Viện.',
    });
  };

  const handlePinClick = (chartIdentityKey: string) => {
    const res = onTogglePin(chartIdentityKey);
    if (!res.ok && res.reason === 'MAX_PINNED_REACHED') {
      setStatusNotice({
        type: 'warning',
        text: `Thư viện cho phép ghim tối đa ${MAX_PINNED_ENTRIES} lá số. Hãy bỏ ghim một lá số khác trước khi ghim thêm.`,
      });
    }
  };

  const handleRedownloadEvictedBackup = () => {
    if (!lastEvictedBackup) return;
    const bundle = {
      bundleType: 'tu-vi-thien-ky-chart-library' as const,
      schemaVersion: 1 as const,
      appVersion: '1.3.0-rc.1',
      exportedAt: Date.now(),
      exportedAtIso: new Date().toISOString(),
      entries: [lastEvictedBackup.entry],
      dossiers: lastEvictedBackup.dossier
        ? { [lastEvictedBackup.entry.chartIdentityKey]: lastEvictedBackup.dossier }
        : {},
      deletedTombstones: [],
    };
    triggerJsonFileDownload(
      lastEvictedBackup.autoBackupFilename ?? 'sao-luu-la-so-thu-hoi.json',
      JSON.stringify(bundle, null, 2),
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Thư Viện Lá Số & Hồ Sơ Luận Giải"
    >
      <div className="w-full max-w-5xl h-[92vh] rounded-2xl border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text)] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <header className="px-4 sm:px-5 py-3.5 border-b border-[var(--t-border)] bg-[var(--t-card)] space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[var(--t-gold)] font-bold text-sm sm:text-base">
                <Library className="w-4 h-4 shrink-0" />
                <span>Thư Viện Lá Số & Hồ Sơ Luận Giải</span>
              </div>
              <div className="text-xs text-[var(--t-text2)] flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono-tabular">
                <span>
                  Đang lưu: <strong className="text-[var(--t-text)]">{entries.length}/{MAX_LIBRARY_ENTRIES}</strong> lá số
                </span>
                <span>·</span>
                <span>
                  Đã ghim: <strong className="text-[var(--t-gold)]">{stats.pinnedCount}/{MAX_PINNED_ENTRIES}</strong>
                </span>
                <span>·</span>
                <span>
                  Hồ Sơ: <strong className="text-emerald-400">{stats.withDossierCount}</strong> bộ ({stats.totalChapters} chương)
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportAll}
                disabled={busyExport || entries.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--t-gold)]/55 bg-[var(--t-gold)]/12 text-[var(--t-gold)] hover:bg-[var(--t-gold)]/20 disabled:opacity-45 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất Thư Viện (.JSON)</span>
              </button>

              <div className="inline-flex items-center rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] overflow-hidden">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busyImport}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--t-text)] hover:text-[var(--t-gold)] disabled:opacity-45 cursor-pointer whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{busyImport ? 'Đang nhập...' : 'Nhập (.JSON)'}</span>
                </button>
                <select
                  value={importMode}
                  onChange={(e) =>
                    setImportMode(
                      e.target.value as 'smart_merge' | 'force_restore_all',
                    )
                  }
                  className="px-2 py-1.5 text-[11px] border-l border-[var(--t-border)] bg-[var(--t-surface)] text-[var(--t-text2)] focus:outline-none cursor-pointer"
                  title="Chế độ gộp khi nhập tệp JSON"
                >
                  <option value="smart_merge">Gộp thông minh</option>
                  <option value="force_restore_all">Khôi phục cả mục đã xóa</option>
                </select>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportFileChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)] hover:text-[var(--t-gold)] cursor-pointer"
                title="Đóng Thư Viện"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ĐC-4: Cảnh báo cố định khi IndexedDB bị chặn hoặc không khả dụng */}
          {!storageHealth.indexedDbAvailable && (
            <div className="rounded-xl px-3.5 py-2.5 border border-amber-500/60 bg-amber-950/40 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Cảnh báo lưu trữ suy giảm (IndexedDB bị chặn hoặc không hỗ trợ):</strong>{' '}
                  Trình duyệt chỉ giữ tối đa 3 hồ sơ gần nhất trong bộ nhớ cục bộ. Hãy thường xuyên bấm{' '}
                  <strong>Xuất Thư Viện (.JSON)</strong> để bảo toàn dữ liệu khi đóng trình duyệt.
                </span>
              </div>
              <button
                type="button"
                onClick={handleExportAll}
                className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-400 text-slate-950 hover:opacity-90 cursor-pointer whitespace-nowrap"
              >
                Sao lưu ngay (.JSON)
              </button>
            </div>
          )}

          {/* ĐC-1: Trạng thái đang nạp IndexedDB */}
          {hydrationStatus === 'hydrating' && (
            <div className="rounded-xl px-3.5 py-2 border border-sky-500/45 bg-sky-950/30 text-xs text-sky-200 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-sky-300 animate-spin shrink-0" />
              <span>Đang nạp dữ liệu Hồ Sơ 8 Chương từ bộ nhớ bền vững IndexedDB...</span>
            </div>
          )}

          {/* ĐC-2: Banner khôi phục khi vừa tự động thu hồi mục khi đạt trần 100 lá số */}
          {lastEvictedBackup && (
            <div className="rounded-xl px-3.5 py-2.5 border border-amber-500/50 bg-amber-950/35 text-xs text-amber-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-start gap-2">
                <FileJson className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <span>
                  Thư viện đã đạt trần {MAX_LIBRARY_ENTRIES}/{MAX_LIBRARY_ENTRIES} nên đã tự động dọn lá số cũ:{' '}
                  <strong>
                    {lastEvictedBackup.entry.customAlias ||
                      lastEvictedBackup.entry.form.name ||
                      'Ẩn danh'}
                  </strong>
                  {lastEvictedBackup.autoBackupTriggered &&
                    lastEvictedBackup.autoBackupFilename &&
                    ` (đã tải file sao lưu ${lastEvictedBackup.autoBackupFilename})`}
                  .
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onUndoEviction}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[var(--t-gold)] text-slate-950 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Hoàn tác</span>
                </button>
                <button
                  type="button"
                  onClick={handleRedownloadEvictedBackup}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border border-amber-400/50 text-amber-200 hover:bg-amber-500/20 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>Tải lại .JSON</span>
                </button>
                <button
                  type="button"
                  onClick={onDismissEviction}
                  className="p-1 text-amber-300/70 hover:text-amber-100 cursor-pointer"
                  title="Ẩn thông báo"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {statusNotice && (
            <div
              className={`rounded-xl px-3.5 py-2 border text-xs flex items-center justify-between gap-2 ${
                statusNotice.type === 'success'
                  ? 'border-emerald-500/45 bg-emerald-950/30 text-emerald-200'
                  : statusNotice.type === 'warning'
                    ? 'border-amber-500/45 bg-amber-950/30 text-amber-200'
                    : 'border-rose-500/50 bg-rose-950/40 text-rose-200'
              }`}
            >
              <span>{statusNotice.text}</span>
              <button
                type="button"
                onClick={() => setStatusNotice(null)}
                className="p-0.5 opacity-75 hover:opacity-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Search, Filter & Sort Controls */}
          <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-[var(--t-faint)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên, biệt danh, năm sinh, chính tinh, nơi sinh, ghi chú..."
                className="w-full pl-8 pr-3 py-2 rounded-lg text-xs border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text)] focus:outline-none focus:border-[var(--t-gold)]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: `Tất cả (${entries.length})` },
                  { id: 'pinned', label: `Đã ghim (${stats.pinnedCount})` },
                  { id: 'has_dossier', label: `Có Hồ Sơ (${stats.withDossierCount})` },
                  { id: 'complete_dossier', label: `Đủ 8/8 (${stats.complete8Count})` },
                  { id: 'has_notes', label: `Ghi chú (${stats.withNotesCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterMode(tab.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                    filterMode === tab.id
                      ? 'bg-[var(--t-gold)]/15 border-[var(--t-gold)] text-[var(--t-gold)] font-semibold'
                      : 'bg-[var(--t-bg)] border-[var(--t-border)] text-[var(--t-text2)] hover:border-[var(--t-gold)]/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}

              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as LibrarySortMode)}
                className="px-2.5 py-1.5 rounded-lg text-[11px] border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)] focus:outline-none focus:border-[var(--t-gold)] cursor-pointer"
                title="Sắp xếp danh sách"
              >
                <option value="last_opened">Mở gần nhất</option>
                <option value="dossier_updated">Sinh Hồ Sơ gần nhất</option>
                <option value="created">Mới tạo gần nhất</option>
                <option value="name_asc">Tên A → Z</option>
              </select>
            </div>
          </div>
        </header>

        {/* Entries List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3">
          {visibleEntries.length === 0 ? (
            <div className="rounded-xl p-8 border border-[var(--t-border)] bg-[var(--t-surface)] text-center space-y-2">
              <div className="text-sm font-semibold text-[var(--t-text)]">
                {entries.length === 0
                  ? 'Thư viện lá số hiện đang trống'
                  : 'Không tìm thấy lá số nào phù hợp với bộ lọc'}
              </div>
              <p className="text-xs text-[var(--t-text2)]">
                {entries.length === 0
                  ? 'Hãy lập một lá số mới ở màn hình chính hoặc bấm "Nhập (.JSON)" để khôi phục thư viện từ máy khác.'
                  : 'Thử xóa từ khóa tìm kiếm hoặc chuyển bộ lọc về "Tất cả".'}
              </p>
            </div>
          ) : (
            visibleEntries.map((entry) => {
              const isCurrent = entry.chartIdentityKey === activeChartIdentityKey;
              const isEditing = editingKey === entry.chartIdentityKey;
              const isConfirmingDelete = confirmDeleteKey === entry.chartIdentityKey;
              const displayName = entry.customAlias.trim() || entry.form.name.trim() || 'Ẩn danh';
              const hasBirthNameDiff =
                Boolean(entry.customAlias.trim()) &&
                entry.customAlias.trim() !== entry.form.name.trim();
              const summary = entry.dossierSummary;
              const hasDossierOrNotes =
                summary.completedCount > 0 ||
                summary.incompleteCount > 0 ||
                entry.notes.trim().length > 0;

              return (
                <article
                  key={entry.chartIdentityKey}
                  className={`rounded-xl p-4 border transition-all space-y-3 ${
                    isCurrent
                      ? 'border-[var(--t-gold)] bg-[var(--t-gold)]/5'
                      : 'border-[var(--t-border)] bg-[var(--t-card)] hover:border-[var(--t-gold)]/45'
                  }`}
                >
                  {/* Row 1: Identity & Deterministic Badge */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        {entry.pinned && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--t-gold)]/15 border border-[var(--t-gold)]/50 text-[var(--t-gold)] shrink-0">
                            <Pin className="w-3 h-3" />
                            <span>Đã ghim</span>
                          </span>
                        )}
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 border border-emerald-500/45 text-emerald-300 shrink-0">
                            Đang mở trên Thiên Bàn
                          </span>
                        )}
                        <h3
                          className="text-sm sm:text-base font-bold text-[var(--t-text)] truncate max-w-full"
                          title={displayName}
                        >
                          {displayName}
                        </h3>
                        {hasBirthNameDiff && (
                          <span
                            className="text-[11px] text-[var(--t-faint)] truncate max-w-[260px]"
                            title={`Họ tên khai sinh trên lá số: ${entry.form.name}`}
                          >
                            (Khai sinh: {entry.form.name || 'Ẩn danh'})
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-[var(--t-text2)] flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-semibold text-[var(--t-gold)]">
                          {entry.deterministicBadge.yinYangGenderVi} · {entry.deterministicBadge.wuxingJuVi}
                        </span>
                        <span>·</span>
                        <span>
                          Mệnh tại <strong>{entry.deterministicBadge.mingGongBranchVi}</strong> [
                          {entry.deterministicBadge.mingMajorStarsVi}]
                        </span>
                      </div>

                      <div className="text-[11px] text-[var(--t-faint)] flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>
                          Dương lịch: {entry.deterministicBadge.solarDateStr} ·{' '}
                          {entry.deterministicBadge.clockTimeLabelVi} ({entry.deterministicBadge.shichenLabelVi})
                          {entry.deterministicBadge.trueSolarTimeLabelVi &&
                            ` → Chân Thái Dương: ${entry.deterministicBadge.trueSolarTimeLabelVi}`}
                        </span>
                        <span>·</span>
                        <span>Âm lịch: {entry.deterministicBadge.lunarDateStr}</span>
                        <span>·</span>
                        <span>{entry.deterministicBadge.locationLabelVi}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handlePinClick(entry.chartIdentityKey)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          entry.pinned
                            ? 'border-[var(--t-gold)] bg-[var(--t-gold)]/15 text-[var(--t-gold)]'
                            : 'border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)] hover:text-[var(--t-gold)]'
                        }`}
                        title={entry.pinned ? 'Bỏ ghim lá số' : 'Ghim cố định lên đầu'}
                      >
                        {entry.pinned ? (
                          <PinOff className="w-3.5 h-3.5" />
                        ) : (
                          <Pin className="w-3.5 h-3.5" />
                        )}
                        <span className="hidden sm:inline">
                          {entry.pinned ? 'Bỏ ghim' : 'Ghim'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(entry)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)] hover:text-[var(--t-gold)] cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Tên gợi nhớ / Ghi chú</span>
                      </button>
                    </div>
                  </div>

                  {/* Row 2: 8-Chapter Dossier Status */}
                  <div className="rounded-lg px-3 py-2.5 border border-[var(--t-border)] bg-[var(--t-surface)] space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-[var(--t-text)]">
                        <BookOpen className="w-3.5 h-3.5 text-[var(--t-gold)]" />
                        <span>
                          Hồ Sơ 8 Chương:{' '}
                          {hydrationStatus === 'hydrating' && summary.completedCount === 0 ? (
                            <span className="text-sky-300">Đang nạp từ IndexedDB...</span>
                          ) : summary.completedCount > 0 ? (
                            <span className="text-emerald-400">
                              {summary.completedCount}/8 chương hoàn tất
                            </span>
                          ) : summary.incompleteCount > 0 ? (
                            <span className="text-amber-300">
                              {summary.incompleteCount} chương đang dở dang
                            </span>
                          ) : (
                            <span className="text-[var(--t-faint)]">Chưa sinh luận giải</span>
                          )}
                        </span>
                      </div>

                      {summary.lastGeneratedAt && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--t-text2)]">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[var(--t-faint)]" />
                            <span>Sinh lần cuối: {formatTimestampVi(summary.lastGeneratedAt)}</span>
                          </span>
                          {summary.modelsUsed.length > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Cpu className="w-3 h-3 text-[var(--t-faint)]" />
                              <span className="font-mono">{summary.modelsUsed.join(', ')}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                      {DOSSIER_CHAPTER_SPECS.map((spec) => {
                        const meta = summary.chapterMetaMap[spec.id];
                        const isDone = meta?.status === 'completed';
                        const isInc = meta?.status === 'incomplete';
                        return (
                          <div
                            key={spec.id}
                            title={`${spec.titleVi}${meta?.modelUsed ? ` · Model: ${meta.modelUsed}` : ''}${meta?.updatedAt ? ` · Lúc: ${formatTimestampVi(meta.updatedAt)}` : ''}`}
                            className={`px-2 py-1 rounded text-[10px] font-medium text-center border truncate ${
                              isDone
                                ? 'bg-emerald-500/15 border-emerald-500/45 text-emerald-300'
                                : isInc
                                  ? 'bg-amber-500/15 border-amber-500/45 text-amber-300'
                                  : 'bg-[var(--t-bg)] border-[var(--t-border)] text-[var(--t-faint)]'
                            }`}
                          >
                            {CHAPTER_SHORT_NUMBER[spec.id]}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Notes Display */}
                  {!isEditing && entry.notes.trim() && (
                    <div className="rounded-lg px-3 py-2 border border-[var(--t-border)] bg-[var(--t-bg)] text-xs text-[var(--t-text2)] whitespace-pre-wrap break-words">
                      <span className="font-semibold text-[var(--t-gold)]">Ghi chú: </span>
                      {entry.notes}
                    </div>
                  )}

                  {/* Inline Edit Panel (ĐC-5 & PL-04: customAlias + notes; form.name immutable) */}
                  {isEditing && (
                    <div className="rounded-xl p-3.5 border border-[var(--t-gold)]/45 bg-[var(--t-surface)] space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-[var(--t-text2)]">
                          <label className="font-semibold">
                            Tên gợi nhớ hiển thị trong Thư Viện (không đổi khóa hồ sơ)
                          </label>
                          <span>
                            {draftAlias.length}/{LIBRARY_MAX_ALIAS_CHARS}
                          </span>
                        </div>
                        <input
                          type="text"
                          value={draftAlias}
                          maxLength={LIBRARY_MAX_ALIAS_CHARS}
                          onChange={(e) => setDraftAlias(e.target.value)}
                          placeholder={`VD: Anh An - Khách Hà Nội (Mặc định: ${entry.form.name || 'Ẩn danh'})`}
                          className="w-full px-3 py-1.5 rounded-lg text-xs border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text)] focus:outline-none focus:border-[var(--t-gold)]"
                        />
                        <div className="text-[11px] text-[var(--t-faint)] flex flex-wrap items-center justify-between gap-2">
                          <span>
                            Họ tên khai sinh trên lá số giữ cố định: <strong>{entry.form.name || 'Ẩn danh'}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              onLoadIntoFormToEditNew(entry);
                              onClose();
                            }}
                            className="text-[var(--t-gold)] hover:underline cursor-pointer"
                          >
                            Nạp dữ kiện lên Form để sửa & lập lá số mới →
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-[var(--t-text2)]">
                          <label className="font-semibold">Ghi chú nghiệm lý cá nhân</label>
                          <span>
                            {draftNotes.length}/{LIBRARY_MAX_NOTE_CHARS}
                          </span>
                        </div>
                        <textarea
                          rows={3}
                          value={draftNotes}
                          maxLength={LIBRARY_MAX_NOTE_CHARS}
                          onChange={(e) => setDraftNotes(e.target.value)}
                          placeholder="Ghi chú sự kiện nghiệm lý, đại hạn, lưu ý riêng..."
                          className="w-full px-3 py-2 rounded-lg text-xs border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text)] focus:outline-none focus:border-[var(--t-gold)]"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingKey(null)}
                          className="px-3 py-1.5 rounded-lg text-xs border border-[var(--t-border)] text-[var(--t-text2)] hover:text-[var(--t-text)] cursor-pointer"
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(entry.chartIdentityKey)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--t-gold)] text-slate-950 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Lưu thay đổi</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Delete Confirmation (2-Step Safe Warning) */}
                  {isConfirmingDelete && (
                    <div className="rounded-xl p-3.5 border border-rose-500/55 bg-rose-950/35 space-y-2.5 text-xs">
                      <div className="flex items-start gap-2 text-rose-200">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          {hasDossierOrNotes ? (
                            <>
                              <strong>Cảnh báo mất dữ liệu:</strong> Lá số{' '}
                              <strong>{displayName}</strong> hiện đang lưu{' '}
                              <strong>{summary.completedCount}/8 chương Hồ Sơ</strong>
                              {summary.lastGeneratedAt
                                ? ` (sinh lúc ${formatTimestampVi(summary.lastGeneratedAt)})`
                                : ''}
                              {entry.notes.trim() ? ' và ghi chú cá nhân' : ''}. Bạn muốn thực hiện thao tác nào?
                            </>
                          ) : (
                            <>
                              Xác nhận xóa lá số <strong>{displayName}</strong> khỏi Thư Viện?
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteKey(null)}
                          className="px-3 py-1.5 rounded-lg text-xs border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)] cursor-pointer"
                        >
                          Hủy bỏ
                        </button>
                        {summary.completedCount > 0 || summary.incompleteCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              onRemoveEntry(entry.chartIdentityKey, 'dossier_only');
                              setConfirmDeleteKey(null);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-400/55 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 cursor-pointer"
                          >
                            Chỉ xóa Hồ Sơ (giữ Lá Số & Ghi chú)
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            onRemoveEntry(entry.chartIdentityKey, 'entry_and_dossier');
                            setConfirmDeleteKey(null);
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-500 cursor-pointer"
                        >
                          Xóa vĩnh viễn cả Lá Số & Hồ Sơ
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Row 3: Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectChart(entry, false);
                          onClose();
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--t-gold)] text-slate-950 hover:opacity-95 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Mở Lá Số Lên Thiên Bàn</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onSelectChart(entry, true);
                          onClose();
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--t-gold)]/55 bg-[var(--t-gold)]/12 text-[var(--t-gold)] hover:bg-[var(--t-gold)]/20 cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>
                          Mở Lá Số + Hồ Sơ ({summary.completedCount}/8)
                        </span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleExportSingle(entry)}
                        disabled={busyExport}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)] hover:text-[var(--t-gold)] cursor-pointer"
                        title="Xuất riêng lá số này và hồ sơ thành file .JSON"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Xuất .JSON</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingKey(null);
                          setConfirmDeleteKey(
                            isConfirmingDelete ? null : entry.chartIdentityKey,
                          );
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)] hover:text-rose-400 hover:border-rose-500/50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
