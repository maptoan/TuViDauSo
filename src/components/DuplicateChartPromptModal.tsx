import React from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  BookOpen,
  FileText,
  Pin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  ChartLibraryEntry,
  LibraryHydrationStatus,
  NearMatchLibraryCandidate,
} from '../lib/chart-library';
import type { DossierChapterId } from '../lib/dossier-chat-ui';
import type { BirthFormState, ZiweiChart } from '../lib/ziwei/types';
import { VI_BRANCHES, VI_SHICHEN } from '../lib/ziwei/vi-i18n';

interface DuplicateChartPromptModalProps {
  open: boolean;
  candidates: NearMatchLibraryCandidate[];
  totalCandidateCount: number;
  incomingForm: BirthFormState;
  incomingChart: ZiweiChart;
  hydrationStatus: LibraryHydrationStatus;
  editingSourceEntryKey?: string | null;
  onChooseExisting: (entry: ChartLibraryEntry) => void;
  onChooseCreateNew: () => void;
  onBackToEdit: () => void;
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

function formatCandidateTitle(entry: ChartLibraryEntry): string {
  const alias = entry.customAlias.trim();
  const name = (entry.form.name || '').trim();
  if (alias && name) return `${alias} (${name})`;
  if (alias) return alias;
  if (name) return name;
  const place = (entry.form.city || entry.form.province || 'Chưa rõ nơi sinh').trim();
  return `Đương số chưa đặt tên · ${place} · Sinh ${entry.deterministicBadge.clockTimeLabelVi} (${entry.deterministicBadge.shichenLabelVi})`;
}

export default function DuplicateChartPromptModal({
  open,
  candidates,
  totalCandidateCount,
  incomingForm,
  incomingChart,
  hydrationStatus,
  editingSourceEntryKey = null,
  onChooseExisting,
  onChooseCreateNew,
  onBackToEdit,
}: DuplicateChartPromptModalProps) {
  if (!open || candidates.length === 0) return null;

  const singleCandidate = candidates.length === 1 ? candidates[0] : null;
  const incomingMingVi = VI_BRANCHES[incomingChart.mingGongBranch] ?? 'Tý';
  const incomingShichenObj = VI_SHICHEN[incomingChart.birthInfo.hour] ?? VI_SHICHEN[0];
  const incomingShichenVi = incomingForm.unknownTime
    ? `Chưa rõ giờ (tạm ${incomingShichenObj.name})`
    : incomingShichenObj.name;
  const incomingClockVi = incomingForm.unknownTime
    ? 'Chưa rõ giờ'
    : `${String(incomingForm.clockHour).padStart(2, '0')}:${String(incomingForm.clockMinute).padStart(2, '0')}`;
  const incomingSolarDate = `${String(incomingForm.day).padStart(2, '0')}/${String(
    incomingForm.month,
  ).padStart(2, '0')}/${incomingForm.year}`;
  const isHydrating = hydrationStatus === 'hydrating' || hydrationStatus === 'idle';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-chart-modal-title"
    >
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl border border-[var(--t-gold)]/55 bg-[var(--t-card)] shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-[var(--t-border)] bg-[var(--t-surface)] flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[var(--t-gold)]">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <h2
                id="duplicate-chart-modal-title"
                className="text-sm sm:text-base font-bold text-[var(--t-text)]"
              >
                {singleCandidate
                  ? 'Phát Hiện Lá Số Gần Giống Trong Thư Viện'
                  : `Phát Hiện ${candidates.length} Lá Số Gần Giống Trong Thư Viện`}
              </h2>
            </div>
            <p className="text-xs text-[var(--t-text2)] leading-relaxed">
              {singleCandidate
                ? 'Thông tin khai sinh bạn vừa nhập gần giống với một lá số đã lưu trong Thư Viện, nhưng có các điểm khác biệt tạo nên mã định danh khác nhau:'
                : `Thông tin bạn vừa nhập gần giống với ${candidates.length} lá số đã lưu trong Thư Viện. Vui lòng đối chiếu các điểm khác biệt bên dưới để chọn mở lại đúng lá số cũ hoặc lập lá số mới độc lập:`}
            </p>
            {totalCandidateCount > candidates.length && (
              <p className="text-[11px] text-[var(--t-gold)] font-medium tabular-nums">
                Đang hiển thị {candidates.length}/{totalCandidateCount} lá số gần giống nhất theo thứ tự ưu tiên.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onBackToEdit}
            className="p-1.5 rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)] hover:text-[var(--t-gold)] cursor-pointer shrink-0"
            title="Quay lại sửa thông tin"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          {/* Incoming preview strip */}
          <div className="rounded-xl px-3.5 py-2.5 border border-[var(--t-border)] bg-[var(--t-surface)] text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="text-[var(--t-text2)]">
              <span className="font-semibold text-[var(--t-text)]">Dữ kiện bạn vừa nhập: </span>
              <span>
                {incomingForm.name.trim() || '(Để trống / Ẩn danh)'} · {incomingSolarDate} ·{' '}
                {incomingClockVi} ({incomingShichenVi}) · {incomingForm.city || incomingForm.province || 'Chưa chọn nơi sinh'}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-[var(--t-bg)] border border-[var(--t-border)] text-[11px] font-medium text-[var(--t-gold)] whitespace-nowrap">
              Mệnh tại {incomingMingVi}
            </span>
          </div>

          {/* Candidate list */}
          <div className="space-y-3.5">
            {candidates.map((candidate, idx) => {
              const { entry, diffs, hasStructuralChartDiff } = candidate;
              const badge = entry.deterministicBadge;
              const isEditingSource =
                Boolean(editingSourceEntryKey) &&
                entry.chartIdentityKey === editingSourceEntryKey;
              const completedChaptersShort = entry.dossierSummary.completedChapterIds
                .map((id) => CHAPTER_SHORT_NUMBER[id] ?? id)
                .join(', ');
              const trimmedNotes = entry.notes.trim();
              const notesExcerpt =
                trimmedNotes.length > 80
                  ? `${trimmedNotes.slice(0, 80)}...`
                  : trimmedNotes;

              return (
                <div
                  key={entry.chartIdentityKey}
                  className="rounded-xl border border-[var(--t-border)] bg-[var(--t-bg)] p-3.5 sm:p-4 space-y-3"
                >
                  {/* Candidate Identity Header */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {candidates.length >= 2 && (
                          <span className="text-xs font-bold text-[var(--t-gold)] tabular-nums">
                            #{idx + 1} ·
                          </span>
                        )}
                        <h3 className="text-sm font-bold text-[var(--t-text)] break-words">
                          {formatCandidateTitle(entry)}
                        </h3>
                        {entry.pinned && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--t-gold)]/15 text-[var(--t-gold)] border border-[var(--t-gold)]/40">
                            <Pin className="w-2.5 h-2.5" />
                            <span>Đã ghim</span>
                          </span>
                        )}
                        {isEditingSource && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
                            <span>Lá số gốc vừa nạp để chỉnh sửa</span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-[var(--t-text2)] space-y-0.5 tabular-nums">
                        <p>
                          {badge.solarDateStr} · {badge.clockTimeLabelVi} ({badge.shichenLabelVi}) ·{' '}
                          {badge.locationLabelVi} · {badge.yinYangGenderVi}
                        </p>
                        <p className="text-[var(--t-faint)]">
                          Mệnh tại <strong className="text-[var(--t-text)]">{badge.mingGongBranchVi}</strong> ({badge.mingMajorStarsVi}) · {badge.wuxingJuVi}
                        </p>
                      </div>
                    </div>

                    {/* Dossier Status Badge (DM-11 + ĐC-1) */}
                    <div className="shrink-0">
                      {candidate.effectiveCompletedCount > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[var(--t-gold)]/15 text-[var(--t-gold)] border border-[var(--t-gold)]/45 tabular-nums">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>
                            Đã luận giải {candidate.effectiveCompletedCount}/8 chương
                            {completedChaptersShort ? ` (${completedChaptersShort})` : ''}
                          </span>
                        </span>
                      ) : isHydrating ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-sky-950/40 text-sky-200 border border-sky-500/45">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Đang đồng bộ từ IndexedDB...</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--t-surface)] text-[var(--t-text2)] border border-[var(--t-border)] tabular-nums">
                          <span>Chưa có chương luận giải (0/8 chương)</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Notes excerpt for identification (DM-13) */}
                  {notesExcerpt && (
                    <div className="rounded-lg px-3 py-1.5 bg-[var(--t-surface)] border border-[var(--t-border)] text-xs text-[var(--t-text2)] flex items-start gap-2">
                      <FileText className="w-3.5 h-3.5 text-[var(--t-gold)] shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-[var(--t-text)]">Ghi chú:</strong> &ldquo;{notesExcerpt}&rdquo;
                      </span>
                    </div>
                  )}

                  {/* Amber Structural Divergence Warning (DM-05) */}
                  {hasStructuralChartDiff && (
                    <div className="rounded-lg px-3 py-2.5 border border-amber-500/60 bg-amber-950/40 text-xs text-amber-100 flex items-start gap-2 leading-relaxed">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-amber-300">
                          CẢNH BÁO KHÁC GIỜ AN SAO / KHÁC CẤU TRÚC 12 CUNG:
                        </strong>{' '}
                        Lá số đã lưu an Mệnh tại cung <strong>{badge.mingGongBranchVi}</strong> ({badge.shichenLabelVi}),
                        còn thông tin vừa nhập an Mệnh tại cung <strong>{incomingMingVi}</strong> ({incomingShichenVi}).
                        Hai lá số này có cấu trúc 12 cung <strong>KHÁC NHAU</strong>. Nếu bạn vừa tìm được giờ sinh mới
                        chính xác hơn, hãy chọn <strong>&ldquo;Lập lá số mới theo thông tin vừa nhập&rdquo;</strong>.
                      </div>
                    </div>
                  )}

                  {/* Field-by-field Diff Table */}
                  <div className="rounded-lg border border-[var(--t-border)] bg-[var(--t-surface)] overflow-hidden">
                    <div className="px-3 py-1.5 border-b border-[var(--t-border)] bg-[var(--t-card)] text-[11px] font-semibold text-[var(--t-text2)] flex items-center gap-1.5">
                      <ArrowLeftRight className="w-3.5 h-3.5 text-[var(--t-gold)]" />
                      <span>Đối chiếu từng điểm sai khác (Đã lưu ↔ Vừa nhập)</span>
                    </div>
                    <div className="divide-y divide-[var(--t-border)]">
                      {diffs.map((diff) => (
                        <div
                          key={`${entry.chartIdentityKey}_${diff.field}`}
                          className="px-3 py-2 text-xs grid grid-cols-1 sm:grid-cols-12 gap-1.5 sm:gap-3 items-start"
                        >
                          <div className="sm:col-span-4 flex flex-wrap items-center gap-1.5 font-medium text-[var(--t-text)]">
                            <span>{diff.labelVi}</span>
                            {diff.affectsChartStructure && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/40">
                                Đổi cấu trúc 12 cung
                              </span>
                            )}
                          </div>
                          <div className="sm:col-span-8 flex flex-wrap items-center gap-1.5 text-[var(--t-text2)] tabular-nums">
                            <span className="px-2 py-0.5 rounded bg-[var(--t-bg)] border border-[var(--t-border)] text-[var(--t-text)]">
                              <span className="text-[var(--t-faint)]">Đã lưu: </span>
                              {diff.savedValueVi}
                            </span>
                            <span className="text-[var(--t-gold)] font-bold">↔</span>
                            <span className="px-2 py-0.5 rounded bg-[var(--t-gold)]/10 border border-[var(--t-gold)]/40 text-[var(--t-text)]">
                              <span className="text-[var(--t-gold)]">Vừa nhập: </span>
                              {diff.incomingValueVi}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Per-card action when multiple candidates (Case 2B) */}
                  {candidates.length >= 2 && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => onChooseExisting(entry)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[var(--t-gold)] text-slate-950 hover:opacity-95 transition-opacity cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>
                          {hasStructuralChartDiff
                            ? `Mở lá số cũ đã lưu này (${badge.shichenLabelVi} · Mệnh ${badge.mingGongBranchVi})`
                            : 'Mở lá số đã lưu này'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Zero Cross-Key Contamination Notice */}
          <div className="rounded-xl px-3.5 py-2.5 border border-emerald-500/40 bg-emerald-950/25 text-xs text-emerald-200 flex items-start gap-2 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong>Lưu ý bảo vệ dữ liệu:</strong> Nếu chọn &ldquo;Mở lá số đã lưu&rdquo;, hệ thống sẽ nạp
              nguyên vẹn lá số đã lưu cùng hồ sơ của lá số đó. Nếu chọn &ldquo;Lập lá số mới theo thông tin vừa
              nhập&rdquo;, hệ thống sẽ tạo một lá số độc lập mới (0/8 chương), tuyệt đối không trộn lẫn hồ sơ
              giữa hai lá số.
            </span>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-[var(--t-border)] bg-[var(--t-surface)] flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onBackToEdit}
            className="px-3.5 py-2 rounded-lg text-xs font-medium border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)] hover:text-[var(--t-text)] hover:border-[var(--t-gold)]/50 transition-colors cursor-pointer"
          >
            Quay lại sửa thông tin
          </button>

          <button
            type="button"
            onClick={onChooseCreateNew}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              singleCandidate
                ? 'border-[var(--t-gold)]/60 bg-[var(--t-bg)] text-[var(--t-gold)] hover:bg-[var(--t-gold)]/10'
                : 'border-[var(--t-gold)] bg-[var(--t-gold)] text-slate-950 hover:opacity-95'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Lập lá số mới theo thông tin vừa nhập</span>
          </button>

          {singleCandidate && (
            <button
              type="button"
              onClick={() => onChooseExisting(singleCandidate.entry)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--t-gold)] text-slate-950 hover:opacity-95 transition-opacity cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>
                {singleCandidate.hasStructuralChartDiff
                  ? `Mở lá số cũ đã lưu (${singleCandidate.entry.deterministicBadge.shichenLabelVi} · Mệnh ${singleCandidate.entry.deterministicBadge.mingGongBranchVi})`
                  : 'Mở lá số đã lưu'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
