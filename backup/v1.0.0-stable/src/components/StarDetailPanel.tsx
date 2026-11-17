import React, { useState } from 'react';
import { VI_STAR_DETAILS, translateStarName } from '../lib/ziwei/vi-i18n';
import { BookOpen, X, Briefcase, Heart, Coins, Activity, Compass, Sparkles, Languages } from 'lucide-react';

interface StarDetailPanelProps {
  starNameZh: string | null;
  onClose: () => void;
}

export default function StarDetailPanel({ starNameZh, onClose }: StarDetailPanelProps) {
  const [showHanzi, setShowHanzi] = useState(false);

  if (!starNameZh) return null;

  const detail = VI_STAR_DETAILS[starNameZh];
  const viName = translateStarName(starNameZh);

  return (
    <div className="rounded-xl p-4 sm:p-5 border bg-[var(--t-card)] border-[var(--t-gold)]/50 space-y-4 shadow-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-[var(--t-border)]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[var(--t-gold)]/15 border border-[var(--t-gold)]/40 flex items-center justify-center text-[var(--t-gold)] font-serif font-bold text-base shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-[var(--t-gold)]">
                Sao {viName}
                {showHanzi ? ` (${starNameZh})` : ''}
              </h3>
              {detail && (
                <span className="text-xs px-2 py-0.5 rounded bg-[var(--t-surface)] border border-[var(--t-border)] text-[var(--t-text2)]">
                  {detail.element} · {detail.nature}
                </span>
              )}
            </div>
            {detail && (
              <p className="text-xs text-[var(--t-faint)] mt-0.5">
                Đặc tính: {detail.keywords.join(' · ')}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowHanzi((v) => !v)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
              showHanzi
                ? 'bg-[var(--t-gold)]/15 border-[var(--t-gold)] text-[var(--t-gold)]'
                : 'border-[var(--t-border)] text-[var(--t-text2)] hover:text-[var(--t-gold)]'
            }`}
            title="Bật/tắt hiển thị chữ Hán nguyên bản"
          >
            <Languages className="w-3.5 h-3.5" />
            <span>{showHanzi ? 'Ẩn Hán tự' : 'Hán tự'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-[var(--t-border)] text-[var(--t-text2)] hover:text-[var(--t-gold)] cursor-pointer"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!detail ? (
        <div className="text-xs text-[var(--t-text2)] leading-relaxed">
          Sao <strong>{viName}{showHanzi ? ` (${starNameZh})` : ''}</strong> là phụ tinh / tạp diệu trong hệ thống Tử Vi Đẩu Số, đóng vai trò bổ trợ cát hung cho Chính Tinh tọa thủ cùng cung và hội chiếu trong Tam Phương Tứ Chính.
        </div>
      ) : (
        <div className="space-y-3 text-xs">
          {/* Classical Verse */}
          <div className="rounded-lg p-3 border border-[var(--t-gold)]/30 bg-[var(--t-surface)]">
            <div className="text-[11px] font-semibold text-[var(--t-gold)] mb-1 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Cổ Quyết Tử Vi Đẩu Số Toàn Thư</span>
            </div>
            <p className="italic text-[var(--t-text)] leading-relaxed">
              “{detail.classical}”
            </p>
          </div>

          {/* Master Ni Haixia's Tian Ji Insight */}
          <div className="rounded-lg p-3 border border-[var(--t-border)] bg-[var(--t-bg)] space-y-1">
            <div className="text-[11px] font-semibold text-amber-400 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              <span>Tâm Pháp Thiên Kỷ — Nghê Hải Hạ</span>
            </div>
            <p className="text-[var(--t-text)] leading-relaxed">
              {detail.niHaixia}
            </p>
          </div>

          {/* 4 Domains Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="p-2.5 rounded-lg border border-[var(--t-border)] bg-[var(--t-surface)] space-y-1">
              <div className="font-semibold text-sky-400 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                <span>Sự Nghiệp & Quan Lộc</span>
              </div>
              <p className="text-[var(--t-text2)] leading-relaxed">{detail.career}</p>
            </div>

            <div className="p-2.5 rounded-lg border border-[var(--t-border)] bg-[var(--t-surface)] space-y-1">
              <div className="font-semibold text-rose-400 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5" />
                <span>Tình Duyên & Phu Thê</span>
              </div>
              <p className="text-[var(--t-text2)] leading-relaxed">{detail.relationship}</p>
            </div>

            <div className="p-2.5 rounded-lg border border-[var(--t-border)] bg-[var(--t-surface)] space-y-1">
              <div className="font-semibold text-amber-400 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5" />
                <span>Tài Bạch & Điền Trạch</span>
              </div>
              <p className="text-[var(--t-text2)] leading-relaxed">{detail.wealth}</p>
            </div>

            <div className="p-2.5 rounded-lg border border-[var(--t-border)] bg-[var(--t-surface)] space-y-1">
              <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                <span>Tật Ách & Đông Y</span>
              </div>
              <p className="text-[var(--t-text2)] leading-relaxed">{detail.health}</p>
            </div>
          </div>

          {/* Best & Caution Palaces */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--t-border)] text-[11px]">
            <span className="text-emerald-400">
              <strong>Cung đắc cách:</strong> {detail.bestPalace}
            </span>
            <span className="text-amber-400">
              <strong>Lưu ý:</strong> {detail.worstPalace}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
