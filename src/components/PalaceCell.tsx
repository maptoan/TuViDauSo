import React from 'react';
import { Palace, Star, SiHua } from '../lib/ziwei/types';
import { ActiveSihua, SIHUA_BADGE_STYLES } from './TimeNav';
import { STEMS, BRANCHES } from '../lib/ziwei/constants';
import {
  VI_STEMS,
  VI_BRANCHES,
  VI_PALACE_ROLES,
  translatePalaceName,
  translateStarName,
  translateBrightness,
  translateSiHua,
} from '../lib/ziwei/vi-i18n';

interface PalaceCellProps {
  palace: Palace;
  isSelected: boolean;
  activeSihua?: ActiveSihua;
  sanfangRole?: 'selected' | 'opposite' | 'triad' | null;
  showHanzi?: boolean;
  onClick: () => void;
  onStarClick?: (starName: string) => void;
  onMutagenClick?: (starName: string, mutagen: string, palaceName: string) => void;
}

const BRIGHTNESS_COLOR: Record<string, string> = {
  '庙': 'text-amber-400 font-semibold',
  '旺': 'text-amber-300',
  '得': 'text-emerald-400',
  '利': 'text-sky-400',
  '平': 'text-slate-400',
  '不': 'text-orange-400',
  '闲': 'text-slate-400',
  '陷': 'text-rose-400',
};

function getOverlayMutagen(starName: string, sihua?: ActiveSihua): SiHua | undefined {
  if (!sihua || sihua.mode === 'natal') return undefined;
  if (sihua.lu === starName) return '禄';
  if (sihua.quan === starName) return '权';
  if (sihua.ke === starName) return '科';
  if (sihua.ji === starName) return '忌';
  return undefined;
}

function MutagenBadge({
  mutagen,
  isOverlay = false,
  onClick,
}: {
  mutagen?: SiHua;
  isOverlay?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}) {
  if (!mutagen || !(mutagen in SIHUA_BADGE_STYLES)) return null;
  const c = SIHUA_BADGE_STYLES[mutagen];
  const viMut = translateSiHua(mutagen);
  return (
    <span
      onClick={onClick}
      title={`Nhấn để xem luận giải Hóa ${viMut}`}
      className={`text-[10px] px-1 py-0 rounded border leading-tight font-semibold whitespace-nowrap shrink-0 ${c.bg} ${c.text} ${c.border} ${
        isOverlay ? 'ring-1 ring-white/30' : ''
      } ${onClick ? 'cursor-pointer hover:brightness-125' : ''}`}
    >
      {isOverlay ? `Lưu ${viMut}` : viMut}
    </span>
  );
}

function MajorStarItem({
  star,
  activeSihua,
  palaceName,
  showHanzi,
  onStarClick,
  onMutagenClick,
}: {
  star: Star;
  activeSihua?: ActiveSihua;
  palaceName: string;
  showHanzi?: boolean;
  onStarClick?: (name: string) => void;
  onMutagenClick?: (starName: string, mutagen: string, palaceName: string) => void;
}) {
  const overlayMutagen = getOverlayMutagen(star.name, activeSihua);
  const bColor = star.brightnessRaw
    ? BRIGHTNESS_COLOR[star.brightnessRaw] ?? 'text-slate-400'
    : 'text-slate-400';
  const viStarName = translateStarName(star.name);
  const viBrightness = translateBrightness(star.brightnessRaw);

  return (
    <span className="inline-flex items-center gap-1 leading-snug flex-wrap">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onStarClick?.(star.name);
        }}
        className={`text-xs sm:text-[13px] font-semibold ${bColor} hover:underline cursor-pointer text-left`}
        title={`${viStarName}${showHanzi ? ` (${star.name})` : ''} — Nhấn để xem chi tiết tinh diệu`}
      >
        {viStarName}
        {showHanzi ? ` (${star.name})` : ''}
      </button>
      {viBrightness && (
        <span className="text-[10px] text-[var(--t-faint)] font-normal">
          [{viBrightness}]
        </span>
      )}
      <MutagenBadge
        mutagen={star.siHua}
        onClick={
          onMutagenClick && star.siHua
            ? (e) => {
                e.stopPropagation();
                onMutagenClick(star.name, star.siHua!, palaceName);
              }
            : undefined
        }
      />
      {overlayMutagen && (
        <MutagenBadge
          mutagen={overlayMutagen}
          isOverlay
          onClick={
            onMutagenClick
              ? (e) => {
                  e.stopPropagation();
                  onMutagenClick(star.name, overlayMutagen, palaceName);
                }
              : undefined
          }
        />
      )}
    </span>
  );
}

export default function PalaceCell({
  palace,
  isSelected,
  activeSihua,
  sanfangRole,
  showHanzi = false,
  onClick,
  onStarClick,
  onMutagenClick,
}: PalaceCellProps) {
  const isSoul = palace.isMingGong;
  const isBody = palace.isShenGong;
  const isCurrentDecadal = palace.isCurrentDaXian;
  const isActiveDahan = activeSihua?.mode === 'dahan' && activeSihua.activeBranch === palace.branch;
  const isLiunianMing = activeSihua?.mode === 'liunian' && activeSihua.mingBranch === palace.branch;

  const majorStars = palace.stars.filter((s) => s.type === 'major');
  const luckyStars = palace.stars.filter((s) => s.type === 'lucky');
  const shaStars = palace.stars.filter((s) => s.type === 'sha');
  const minorStars = palace.stars.filter((s) => s.type === 'minor');

  const isEmpty = majorStars.length === 0;
  const hasBorrowed = isEmpty && palace.borrowedStars && palace.borrowedStars.length > 0;

  let borderStyle = 'border-[var(--t-border)] hover:border-[var(--t-gold)]/50';
  if (isSelected) {
    borderStyle = 'border-[var(--t-gold)] ring-1 ring-[var(--t-gold)]/60';
  } else if (sanfangRole === 'opposite') {
    borderStyle = 'border-amber-400/70 ring-1 ring-amber-400/30';
  } else if (sanfangRole === 'triad') {
    borderStyle = 'border-sky-400/60 ring-1 ring-sky-400/20';
  } else if (isActiveDahan) {
    borderStyle = 'border-sky-500/70';
  } else if (isLiunianMing) {
    borderStyle = 'border-emerald-500/70';
  } else if (isSoul) {
    borderStyle = 'border-[var(--t-gold)]/60';
  }

  let bgColor = 'var(--t-card)';
  if (isSelected) bgColor = 'var(--t-surface)';
  else if (isSoul) bgColor = 'var(--t-soul-bg)';

  const viPalaceName = translatePalaceName(palace.name);
  const viStem = VI_STEMS[palace.stem] ?? '';
  const viBranch = VI_BRANCHES[palace.branch] ?? '';
  const zhStem = STEMS[palace.stem] ?? '';
  const zhBranch = BRANCHES[palace.branch] ?? '';

  return (
    <div
      onClick={onClick}
      style={{ backgroundColor: bgColor }}
      className={`relative flex flex-col justify-between p-2 sm:p-2.5 border rounded-lg cursor-pointer transition-all duration-150 select-none min-h-[128px] sm:min-h-[146px] ${borderStyle}`}
    >
      {/* Top Row: Palace Name + Role Badges + Stem/Branch */}
      <div className="flex items-start justify-between gap-1 border-b border-[var(--t-border)]/60 pb-1">
        <div className="flex items-center gap-1 flex-wrap">
          <span
            title={VI_PALACE_ROLES[palace.name] ?? viPalaceName}
            className={`text-xs font-bold tracking-tight ${
              isSoul ? 'text-[var(--t-gold)]' : 'text-[var(--t-text)]'
            }`}
          >
            {viPalaceName.replace(' Cung', '')}
            {showHanzi ? ` (${palace.name})` : ''}
          </span>
          {isSoul && (
            <span className="text-[10px] px-1 py-0 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 font-semibold leading-tight">
              Mệnh
            </span>
          )}
          {isBody && (
            <span className="text-[10px] px-1 py-0 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold leading-tight">
              Thân
            </span>
          )}
          {isActiveDahan && (
            <span className="text-[10px] px-1 py-0 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold leading-tight">
              Đại Hạn
            </span>
          )}
          {isLiunianMing && (
            <span className="text-[10px] px-1 py-0 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold leading-tight">
              Lưu Mệnh
            </span>
          )}
          {sanfangRole === 'opposite' && (
            <span className="text-[10px] px-1 py-0 rounded bg-amber-500/15 text-amber-300 border border-amber-400/40 leading-tight">
              Xung Chiếu
            </span>
          )}
          {sanfangRole === 'triad' && (
            <span className="text-[10px] px-1 py-0 rounded bg-sky-500/15 text-sky-300 border border-sky-400/40 leading-tight">
              Tam Hợp
            </span>
          )}
        </div>

        <span className="text-[11px] font-mono text-[var(--t-faint)] whitespace-nowrap shrink-0">
          {viStem} {viBranch}
          {showHanzi ? ` ${zhStem}${zhBranch}` : ''}
        </span>
      </div>

      {/* Middle Row: Major Stars (Chính Tinh) */}
      <div className="my-1.5 flex flex-col gap-0.5 flex-1">
        {majorStars.length > 0 ? (
          majorStars.map((s, i) => (
            <MajorStarItem
              key={i}
              star={s}
              activeSihua={activeSihua}
              palaceName={palace.name}
              showHanzi={showHanzi}
              onStarClick={onStarClick}
              onMutagenClick={onMutagenClick}
            />
          ))
        ) : hasBorrowed ? (
          <div className="space-y-0.5">
            <span className="text-[10px] text-[var(--t-faint)] italic block">
              Vô chính diệu · Mượn {translatePalaceName(palace.borrowedFromName).replace(' Cung', '')}:
            </span>
            <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 opacity-80">
              {palace.borrowedStars!.map((sName, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStarClick?.(sName);
                  }}
                  className="text-[11px] text-amber-400/90 hover:underline cursor-pointer"
                >
                  {translateStarName(sName)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <span className="text-[11px] italic text-[var(--t-faint)]">Vô chính diệu</span>
        )}
      </div>

      {/* Bottom Row: Phụ Tinh (Cát Tinh, Sát Tinh, Tạp Diệu) + Đại Hạn Age */}
      <div className="space-y-1 pt-1 border-t border-[var(--t-border)]/40">
        {(luckyStars.length > 0 || shaStars.length > 0) && (
          <div className="flex flex-wrap gap-x-1.5 gap-y-0.5">
            {luckyStars.map((s, i) => {
              const overlay = getOverlayMutagen(s.name, activeSihua);
              return (
                <span
                  key={`lk-${i}`}
                  className="text-[11px] text-emerald-400 leading-tight inline-flex items-center gap-0.5"
                >
                  {translateStarName(s.name)}
                  <MutagenBadge mutagen={s.siHua} />
                  {overlay && <MutagenBadge mutagen={overlay} isOverlay />}
                </span>
              );
            })}
            {shaStars.map((s, i) => (
              <span key={`sh-${i}`} className="text-[11px] text-rose-400 leading-tight">
                {translateStarName(s.name)}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-end justify-between gap-1">
          <div className="flex flex-wrap gap-x-1 max-w-[75%]">
            {minorStars.slice(0, 4).map((s, i) => (
              <span key={i} className="text-[10px] leading-tight text-[var(--t-faint)]">
                {translateStarName(s.name)}
              </span>
            ))}
          </div>

          {palace.daXianAge && (
            <span
              className={`text-[10px] font-mono leading-tight whitespace-nowrap shrink-0 tabular-nums px-1 py-0.5 rounded ${
                isActiveDahan
                  ? 'text-sky-300 bg-sky-500/15 font-semibold'
                  : isCurrentDecadal
                  ? 'text-[var(--t-gold)] bg-[var(--t-gold)]/10 font-semibold'
                  : 'text-[var(--t-faint)]'
              }`}
            >
              {palace.daXianAge[0]}–{palace.daXianAge[1]}t
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
