import React from 'react';
import { ZiweiChart, SiHua } from '../lib/ziwei/types';
import {
  getSiHuaByStem,
  getDaXianSiHua,
  getLiuNianSiHua,
  getYearBranchIndex,
} from '../lib/ziwei/sihua';
import {
  VI_STEMS,
  VI_BRANCHES,
  translatePalaceName,
  translateStarName,
} from '../lib/ziwei/vi-i18n';
import { Calendar, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

export type TimeMode = 'natal' | 'dahan' | 'liunian';

export const SIHUA_BADGE_STYLES: Record<
  SiHua,
  { bg: string; text: string; border: string }
> = {
  '禄': {
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-300',
    border: 'border-emerald-500/50',
  },
  '权': {
    bg: 'bg-amber-500/20',
    text: 'text-amber-300',
    border: 'border-amber-500/50',
  },
  '科': {
    bg: 'bg-sky-500/20',
    text: 'text-sky-300',
    border: 'border-sky-500/50',
  },
  '忌': {
    bg: 'bg-rose-500/20',
    text: 'text-rose-300',
    border: 'border-rose-500/50',
  },
};

export interface ActiveSihua {
  mode: TimeMode;
  stemIndex: number;
  label: string;
  lu: string;
  quan: string;
  ke: string;
  ji: string;
  activeBranch?: number;
  mingBranch?: number;
  year?: number;
  daXianIndex?: number;
}

export function buildNatalActiveSihua(chart: ZiweiChart): ActiveSihua {
  const stemIndex = chart.lunarInfo.yearStem;
  const transforms = getSiHuaByStem(stemIndex);
  return {
    mode: 'natal',
    stemIndex,
    label: `Tứ Hóa Bản Mệnh (Can ${VI_STEMS[stemIndex]} năm sinh)`,
    lu: transforms['禄'],
    quan: transforms['权'],
    ke: transforms['科'],
    ji: transforms['忌'],
  };
}

interface TimeNavProps {
  chart: ZiweiChart;
  activeSihua: ActiveSihua;
  onChange: (sihua: ActiveSihua) => void;
  onRequestAiPeriod?: () => void;
  aiLoading?: boolean;
}

const currentYear = new Date().getFullYear();

export default function TimeNav({
  chart,
  activeSihua,
  onChange,
  onRequestAiPeriod,
  aiLoading = false,
}: TimeNavProps) {
  const birthYear = chart.birthInfo.year;

  const setNatal = () => {
    onChange(buildNatalActiveSihua(chart));
  };

  const setDahan = (dxIndex: number) => {
    const dx = chart.daXians[dxIndex];
    const info = getDaXianSiHua(chart, dxIndex);
    if (!dx || !info) return;
    onChange({
      mode: 'dahan',
      stemIndex: info.stemIndex,
      label: `Đại Hạn ${dx.startAge}–${dx.endAge} tuổi · ${translatePalaceName(dx.palaceName)} (${VI_STEMS[info.stemIndex]} ${VI_BRANCHES[dx.palaceBranch]})`,
      lu: info.transforms['禄'],
      quan: info.transforms['权'],
      ke: info.transforms['科'],
      ji: info.transforms['忌'],
      activeBranch: dx.palaceBranch,
      daXianIndex: dxIndex,
    });
  };

  const setLiunian = (year: number) => {
    const info = getLiuNianSiHua(year);
    const branchIdx = getYearBranchIndex(year);
    const age = year - birthYear + 1;
    onChange({
      mode: 'liunian',
      stemIndex: info.stemIndex,
      label: `Lưu Niên ${year} (Năm ${VI_STEMS[info.stemIndex]} ${VI_BRANCHES[branchIdx]} · ${age} tuổi)`,
      lu: info.transforms['禄'],
      quan: info.transforms['权'],
      ke: info.transforms['科'],
      ji: info.transforms['忌'],
      mingBranch: branchIdx,
      year,
    });
  };

  const selectedYear = activeSihua.year ?? currentYear;

  return (
    <div className="rounded-xl p-3.5 border space-y-3 bg-[var(--t-card)] border-[var(--t-border)]">
      {/* Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Calendar className="w-4 h-4 text-[var(--t-gold)] shrink-0" />
          <span className="text-xs font-semibold text-[var(--t-text2)] mr-1">Chế độ Vận Hạn:</span>
          {(
            [
              { key: 'natal', label: 'Bản Mệnh (Gốc)' },
              { key: 'dahan', label: 'Đại Hạn (10 Năm)' },
              { key: 'liunian', label: 'Lưu Niên (Từng Năm)' },
            ] as const
          ).map(({ key, label }) => {
            const active = activeSihua.mode === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (key === 'natal') setNatal();
                  else if (key === 'dahan') {
                    const idx = chart.currentDaXianIndex >= 0 ? chart.currentDaXianIndex : 0;
                    setDahan(idx);
                  } else {
                    setLiunian(currentYear);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[var(--t-gold)]/15 border-[var(--t-gold)] text-[var(--t-gold)] font-semibold'
                    : 'bg-[var(--t-bg)] border-[var(--t-border)] text-[var(--t-text2)] hover:border-[var(--t-gold)]/40'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-[var(--t-gold)] tabular-nums">
            {activeSihua.label}
          </span>
          {(activeSihua.mode === 'dahan' || activeSihua.mode === 'liunian') && onRequestAiPeriod && (
            <button
              type="button"
              onClick={onRequestAiPeriod}
              disabled={aiLoading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--t-gold)] text-slate-950 hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{aiLoading ? 'Đang gọi AI...' : 'Luận giải AI cho kỳ này'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Decadal Selector */}
      {activeSihua.mode === 'dahan' && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {chart.daXians.map((dx, idx) => {
            const isCurrent = idx === chart.currentDaXianIndex;
            const isSelected = activeSihua.activeBranch === dx.palaceBranch;
            const palace = chart.palaces.find((p) => p.branch === dx.palaceBranch);
            const stemName = palace ? VI_STEMS[palace.stem] : '';
            const branchName = VI_BRANCHES[dx.palaceBranch];
            return (
              <button
                key={dx.palaceBranch}
                type="button"
                onClick={() => setDahan(idx)}
                className={`py-1.5 px-2 rounded-lg text-xs border transition-all cursor-pointer text-center ${
                  isSelected
                    ? 'bg-sky-500/15 border-sky-400 text-sky-300 font-semibold'
                    : isCurrent
                    ? 'bg-[var(--t-gold)]/10 border-[var(--t-gold)]/50 text-[var(--t-gold)]'
                    : 'bg-[var(--t-bg)] border-[var(--t-border)] text-[var(--t-text2)] hover:border-sky-400/50'
                }`}
              >
                <div className="font-mono font-semibold tabular-nums">
                  {dx.startAge}–{dx.endAge}t
                </div>
                <div className="text-[11px] truncate opacity-85">
                  {translatePalaceName(dx.palaceName).replace(' Cung', '')} ({stemName} {branchName})
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Liunian Year Selector */}
      {activeSihua.mode === 'liunian' && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setLiunian(selectedYear - 1)}
              className="p-1.5 rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)] hover:text-[var(--t-gold)] cursor-pointer"
              title="Năm trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 rounded-lg font-mono text-xs font-semibold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 tabular-nums">
              Năm {selectedYear} ({selectedYear - birthYear + 1} tuổi)
            </span>
            <button
              type="button"
              onClick={() => setLiunian(selectedYear + 1)}
              className="p-1.5 rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)] hover:text-[var(--t-gold)] cursor-pointer"
              title="Năm sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1">
            {Array.from({ length: 8 }, (_, i) => currentYear - 2 + i).map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setLiunian(yr)}
                className={`px-2 py-1 rounded text-xs font-mono border transition-colors tabular-nums cursor-pointer ${
                  selectedYear === yr
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-semibold'
                    : 'bg-[var(--t-bg)] border-[var(--t-border)] text-[var(--t-text2)] hover:border-emerald-500/40'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tứ Hóa Summary Strip */}
      {activeSihua.lu && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 border-t border-[var(--t-border)] text-xs">
          <span className="text-[var(--t-faint)] font-medium">
            Tứ Hóa Can {VI_STEMS[activeSihua.stemIndex]}:
          </span>
          {(
            [
              { type: '禄' as const, viLabel: 'Hóa Lộc', star: activeSihua.lu },
              { type: '权' as const, viLabel: 'Hóa Quyền', star: activeSihua.quan },
              { type: '科' as const, viLabel: 'Hóa Khoa', star: activeSihua.ke },
              { type: '忌' as const, viLabel: 'Hóa Kỵ', star: activeSihua.ji },
            ]
          ).map(({ type, viLabel, star }) => {
            const c = SIHUA_BADGE_STYLES[type];
            return (
              <span key={type} className="inline-flex items-center gap-1.5">
                <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold border ${c.bg} ${c.text} ${c.border}`}>
                  {viLabel}
                </span>
                <span className="font-medium text-[var(--t-text)]">{translateStarName(star)}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
