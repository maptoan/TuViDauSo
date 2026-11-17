import React, { useMemo, useState } from 'react';
import { ZiweiChart } from '../lib/ziwei/types';
import { detectPatterns, Pattern } from '../lib/ziwei/patterns';
import { localizePattern, LocalizedPattern } from '../lib/ziwei/vi-i18n';
import { Award, ChevronDown, ChevronUp, AlertTriangle, Sparkles, Languages } from 'lucide-react';

interface PatternsCardProps {
  chart: ZiweiChart;
}

const LEVEL_STYLES: Record<
  Pattern['level'],
  { labelVi: string; bg: string; border: string; badge: string }
> = {
  excellent: {
    labelVi: 'Thượng Cách (Đại Quý)',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/40',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-400/50',
  },
  good: {
    labelVi: 'Cát Cách (Phú Quý)',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/35',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50',
  },
  neutral: {
    labelVi: 'Trung Cách (Bình Hòa)',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/35',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-400/50',
  },
  caution: {
    labelVi: 'Cách Cục Cần Tu Dưỡng',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/35',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-400/50',
  },
};

export default function PatternsCard({ chart }: PatternsCardProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);
  const [showHanzi, setShowHanzi] = useState<boolean>(false);

  const patterns = useMemo<LocalizedPattern[]>(() => {
    const raw = detectPatterns(chart);
    return raw.map(localizePattern);
  }, [chart]);

  return (
    <div className="rounded-xl p-4 border bg-[var(--t-card)] border-[var(--t-border)] space-y-3">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--t-border)] flex-wrap">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-[var(--t-gold)] shrink-0" />
          <h3 className="text-sm font-semibold text-[var(--t-text)]">
            Thẩm Định Cách Cục Cổ Phú ({patterns.length} cách cục)
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--t-faint)] hidden sm:inline">
            Tử Vi Đẩu Số Toàn Thư · Thiên Kỷ
          </span>
          <button
            type="button"
            onClick={() => setShowHanzi((v) => !v)}
            className={`px-2 py-0.5 rounded border text-[11px] flex items-center gap-1 transition-colors cursor-pointer ${
              showHanzi
                ? 'bg-[var(--t-gold)]/15 border-[var(--t-gold)] text-[var(--t-gold)] font-medium'
                : 'border-[var(--t-border)] text-[var(--t-text2)] hover:text-[var(--t-text)]'
            }`}
            title="Bật/tắt hiển thị chữ Hán nguyên bản kèm theo bản dịch tiếng Việt"
          >
            <Languages className="w-3 h-3" />
            <span>Hán tự</span>
          </button>
        </div>
      </div>

      {patterns.length === 0 ? (
        <div className="rounded-lg p-3.5 border border-[var(--t-border)] bg-[var(--t-surface)] text-xs text-[var(--t-text2)] leading-relaxed">
          Lá số này mang cấu trúc <strong className="text-[var(--t-gold)]">Bình Hòa Chính Cách</strong> — không rơi vào các cách cục cực đoan. Theo hệ thống Thiên Kỷ của Nghê Hải Hạ, lá số bình hòa trọng ở sự phối hợp Tam Phương Tứ Chính của Mệnh – Tài – Quan và sự vận chuyển của Đại Hạn 10 năm.
        </div>
      ) : (
        <div className="space-y-2">
          {patterns.map((pat, idx) => {
            const st = LEVEL_STYLES[pat.level] || LEVEL_STYLES.neutral;
            const isExpanded = expandedIdx === idx;
            return (
              <div
                key={idx}
                className={`rounded-lg border transition-colors ${st.bg} ${st.border}`}
              >
                <button
                  type="button"
                  onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] px-2 py-0.5 rounded border font-semibold ${st.badge}`}>
                      {st.labelVi}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-[var(--t-text)]">
                      {pat.name}
                      {showHanzi && pat.hanziName ? ` (${pat.hanziName})` : ''}
                    </span>
                    {pat.palaces.length > 0 && (
                      <span className="text-[11px] text-[var(--t-faint)]">
                        ({pat.palaces.join(' · ')})
                      </span>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-[var(--t-faint)] shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[var(--t-faint)] shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-3.5 pb-3 pt-1 border-t border-[var(--t-border)]/50 space-y-2 text-xs">
                    <p className="text-[var(--t-text)] leading-relaxed">
                      {pat.description}
                    </p>

                    {showHanzi && pat.rawNote && (
                      <p className="text-[11px] text-[var(--t-faint)] italic">
                        Nguyên văn chữ Hán: 「{pat.rawNote}」
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {pat.conditions?.required && pat.conditions.required.length > 0 && (
                        <span className="px-2 py-0.5 rounded bg-[var(--t-card)] border border-[var(--t-border)] text-[var(--t-text2)]">
                          <strong>Điều kiện thành cách:</strong> {pat.conditions.required.join('; ')}
                        </span>
                      )}
                      {pat.source && (
                        <span className="px-2 py-0.5 rounded bg-[var(--t-card)] border border-[var(--t-border)] text-[var(--t-faint)]">
                          Nguồn: {pat.source}
                          {showHanzi && pat.rawSource ? ` (${pat.rawSource})` : ''}
                        </span>
                      )}
                    </div>

                    {pat.conditions?.bonus && pat.conditions.bonus.length > 0 && (
                      <div className="flex items-start gap-1.5 text-emerald-300 bg-emerald-950/30 border border-emerald-500/30 rounded px-2.5 py-1.5">
                        <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>
                          <strong>Điểm cộng cát hóa:</strong> {pat.conditions.bonus.join('; ')}
                        </span>
                      </div>
                    )}

                    {pat.conditions?.breaking && pat.conditions.breaking.length > 0 && (
                      <div className="flex items-start gap-1.5 text-amber-300 bg-amber-950/30 border border-amber-500/30 rounded px-2.5 py-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>
                          <strong>Lưu ý phá cách:</strong> {pat.conditions.breaking.join('; ')}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
