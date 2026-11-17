import React, { useState } from 'react';
import { ZiweiChart, Palace } from '../lib/ziwei/types';
import PalaceCell from './PalaceCell';
import { ActiveSihua } from './TimeNav';
import {
  VI_BRANCHES,
  VI_STEMS,
  VI_SHICHEN,
  translateWuxingJu,
  translateStarName,
  translatePalaceName,
  translateYinYang,
  translateGanZhi,
  translateProvinceName,
} from '../lib/ziwei/vi-i18n';
import { Languages, Eye, EyeOff } from 'lucide-react';

// Branch indices: 0=子, 1=丑, 2=寅, 3=卯, 4=辰, 5=巳, 6=午, 7=未, 8=申, 9=酉, 10=戌, 11=亥
const BRANCH_GRID: (number | null)[][] = [
  [5, 6, 7, 8],
  [4, null, null, 9],
  [3, null, null, 10],
  [2, 1, 0, 11],
];

const BRANCH_POS: Record<number, [number, number]> = {
  5: [0, 0], 6: [0, 1], 7: [0, 2], 8: [0, 3],
  4: [1, 0],                        9: [1, 3],
  3: [2, 0],                       10: [2, 3],
  2: [3, 0], 1: [3, 1], 0: [3, 2], 11: [3, 3],
};

function getSanfangBranches(branch: number): { opposite: number; triad: [number, number] } {
  const opposite = (branch + 6) % 12;
  const t1 = (branch + 4) % 12;
  const t2 = (branch + 8) % 12;
  return { opposite, triad: [t1, t2] };
}

function cellCenter(row: number, col: number): { x: number; y: number } {
  return { x: (col + 0.5) * 25, y: (row + 0.5) * 25 };
}

interface ChartBoardProps {
  chart: ZiweiChart;
  activeSihua?: ActiveSihua;
  selectedPalace: Palace | null;
  onSelectPalace: (palace: Palace | null) => void;
  onStarClick?: (starName: string) => void;
  onMutagenClick?: (starName: string, mutagen: string, palaceName: string) => void;
}

export default function ChartBoard({
  chart,
  activeSihua,
  selectedPalace,
  onSelectPalace,
  onStarClick,
  onMutagenClick,
}: ChartBoardProps) {
  const [showHanzi, setShowHanzi] = useState(false);
  const [showSanfangLines, setShowSanfangLines] = useState(true);

  const byBranch: Record<number, Palace> = {};
  for (const p of chart.palaces) {
    byBranch[p.branch] = p;
  }

  const selectedBranch = selectedPalace !== null ? selectedPalace.branch : null;
  const sanfang = selectedBranch !== null ? getSanfangBranches(selectedBranch) : null;

  const getSanfangRole = (branch: number): 'selected' | 'opposite' | 'triad' | null => {
    if (selectedBranch === null || !sanfang) return null;
    if (branch === selectedBranch) return 'selected';
    if (branch === sanfang.opposite) return 'opposite';
    if (sanfang.triad.includes(branch)) return 'triad';
    return null;
  };

  const handleClick = (branch: number) => {
    const p = byBranch[branch];
    if (!p) return;
    const next = selectedPalace?.branch === branch ? null : p;
    onSelectPalace(next);
  };

  const svgLines = (() => {
    if (!showSanfangLines || selectedBranch === null || !sanfang) return null;
    const selPos = BRANCH_POS[selectedBranch];
    const oppPos = BRANCH_POS[sanfang.opposite];
    const t1Pos = BRANCH_POS[sanfang.triad[0]];
    const t2Pos = BRANCH_POS[sanfang.triad[1]];
    if (!selPos) return null;

    const sel = cellCenter(...selPos);
    const opp = oppPos ? cellCenter(...oppPos) : null;
    const t1 = t1Pos ? cellCenter(...t1Pos) : null;
    const t2 = t2Pos ? cellCenter(...t2Pos) : null;

    return (
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
      >
        {t1 && t2 && (
          <polygon
            points={`${sel.x},${sel.y} ${t1.x},${t1.y} ${t2.x},${t2.y}`}
            fill="rgba(56,189,248,0.04)"
            stroke="rgba(56,189,248,0.45)"
            strokeWidth="0.35"
            strokeDasharray="1.5,1"
          />
        )}
        {opp && (
          <line
            x1={sel.x}
            y1={sel.y}
            x2={opp.x}
            y2={opp.y}
            stroke="rgba(212,175,55,0.65)"
            strokeWidth="0.4"
            strokeDasharray="1.2,0.8"
          />
        )}
        {[sel, opp, t1, t2].filter(Boolean).map((pt, i) => (
          <circle
            key={i}
            cx={pt!.x}
            cy={pt!.y}
            r="0.9"
            fill={
              i === 0
                ? 'rgba(212,175,55,0.95)'
                : i === 1
                ? 'rgba(251,191,36,0.8)'
                : 'rgba(56,189,248,0.8)'
            }
          />
        ))}
      </svg>
    );
  })();

  const baziText = chart.lunarInfo.fourPillars
    ? chart.lunarInfo.fourPillars.map(translateGanZhi).join(' · ')
    : `Năm ${VI_STEMS[chart.lunarInfo.yearStem]} ${VI_BRANCHES[chart.lunarInfo.yearBranch]}`;

  const shichenLabel = VI_SHICHEN[chart.birthInfo.hour]?.name ?? '';
  const placeLabel = [
    chart.birthInfo.province ? translateProvinceName(chart.birthInfo.province) : '',
    chart.birthInfo.city || '',
  ]
    .filter(Boolean)
    .join(' · ');

  const cells: React.ReactNode[] = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (row === 1 && col === 1) {
        cells.push(
          <div
            key="center"
            style={{ gridColumn: '2 / 4', gridRow: '2 / 4' }}
            className="flex flex-col justify-between p-3 sm:p-4 border rounded-lg bg-[var(--t-surface)] border-[var(--t-border)]"
          >
            {/* Top Bar inside Thiên Bàn */}
            <div className="flex items-center justify-between gap-2 border-b border-[var(--t-border)] pb-2">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[var(--t-gold)] font-semibold">
                  Thiên Bàn Tử Vi Đẩu Số
                </div>
                {chart.birthInfo.name && (
                  <div className="text-sm sm:text-base font-bold text-[var(--t-text)]">
                    {chart.birthInfo.name}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowSanfangLines((v) => !v)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] border border-[var(--t-border)] bg-[var(--t-card)] text-[var(--t-text2)] hover:text-[var(--t-gold)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  title="Bật/Tắt đường kẻ Tam Phương Tứ Chính"
                >
                  {showSanfangLines ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  <span className="hidden sm:inline">Tam Phương</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowHanzi((v) => !v)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    showHanzi
                      ? 'border-[var(--t-gold)] text-[var(--t-gold)] bg-[var(--t-gold)]/10'
                      : 'border-[var(--t-border)] bg-[var(--t-card)] text-[var(--t-text2)] hover:text-[var(--t-gold)]'
                  }`}
                  title="Hiển thị song ngữ Hán-Việt"
                >
                  <Languages className="w-3 h-3" />
                  <span>Hán tự</span>
                </button>
              </div>
            </div>

            {/* Core Natal Metadata Grid */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 my-2 text-xs">
              <div className="col-span-2 flex items-center justify-between py-1 px-2 rounded bg-[var(--t-card)] border border-[var(--t-border)]/60">
                <span className="text-[var(--t-text2)]">Bát Tự Tứ Trụ:</span>
                <span className="font-mono font-semibold text-[var(--t-gold)]">
                  {baziText}
                </span>
              </div>

              <div className="flex justify-between py-0.5">
                <span className="text-[var(--t-faint)]">Bản Mệnh:</span>
                <span className="font-medium text-[var(--t-text)]">
                  {translateYinYang(chart.yinYangGender)}
                </span>
              </div>

              <div className="flex justify-between py-0.5">
                <span className="text-[var(--t-faint)]">Cục số:</span>
                <span className="font-semibold text-amber-400">
                  {translateWuxingJu(chart.wuxingJuName)}
                </span>
              </div>

              <div className="flex justify-between py-0.5">
                <span className="text-[var(--t-faint)]">Mệnh Chủ:</span>
                <span className="font-medium text-[var(--t-text)]">
                  {translateStarName(chart.mingZhu)}
                </span>
              </div>

              <div className="flex justify-between py-0.5">
                <span className="text-[var(--t-faint)]">Thân Chủ:</span>
                <span className="font-medium text-[var(--t-text)]">
                  {translateStarName(chart.shenZhu)}
                </span>
              </div>

              <div className="col-span-2 flex justify-between py-0.5 border-t border-[var(--t-border)]/50 pt-1">
                <span className="text-[var(--t-faint)]">Dương lịch / Âm lịch:</span>
                <span className="font-mono text-[11px] text-[var(--t-text2)] tabular-nums">
                  {chart.birthInfo.day}/{chart.birthInfo.month}/{chart.birthInfo.year} ({shichenLabel}) · ÂL {chart.lunarInfo.lunarDay}/{chart.lunarInfo.lunarMonth}/{chart.lunarInfo.lunarYear}
                </span>
              </div>

              {placeLabel && (
                <div className="col-span-2 flex justify-between py-0.5">
                  <span className="text-[var(--t-faint)]">Nơi sinh:</span>
                  <span className="text-[11px] text-[var(--t-text2)] truncate max-w-[230px]">
                    {placeLabel}
                  </span>
                </div>
              )}
            </div>

            {/* Footer hint / Tam Phương Tứ Chính status */}
            <div className="pt-1.5 border-t border-[var(--t-border)] text-[11px] flex items-center justify-between text-[var(--t-faint)]">
              {selectedBranch !== null && sanfang ? (
                <span className="text-[var(--t-text2)]">
                  Đang chọn <strong className="text-[var(--t-gold)]">{translatePalaceName(selectedPalace?.name)}</strong> ·
                  Đối cung: <strong className="text-amber-300">{VI_BRANCHES[sanfang.opposite]}</strong> ·
                  Tam hợp: <strong className="text-sky-300">{sanfang.triad.map((b) => VI_BRANCHES[b]).join('·')}</strong>
                </span>
              ) : (
                <span>Nhấn vào cung bất kỳ để xem Tam Phương Tứ Chính & Luận giải</span>
              )}
              <span className="font-mono tabular-nums text-[var(--t-gold)]">
                {chart.currentAge} tuổi
              </span>
            </div>
          </div>
        );
        continue;
      }
      if ((row === 1 && col === 2) || (row === 2 && col === 1) || (row === 2 && col === 2)) {
        continue;
      }

      const branch = BRANCH_GRID[row][col]!;
      const palace = byBranch[branch];

      cells.push(
        palace ? (
          <PalaceCell
            key={branch}
            palace={palace}
            isSelected={selectedPalace?.branch === branch}
            activeSihua={activeSihua}
            sanfangRole={getSanfangRole(branch)}
            showHanzi={showHanzi}
            onClick={() => handleClick(branch)}
            onStarClick={onStarClick}
            onMutagenClick={onMutagenClick}
          />
        ) : (
          <div key={branch} className="border border-[var(--t-border)] rounded-lg p-2 min-h-[128px]" />
        )
      );
    }
  }

  return (
    <div className="w-full">
      <div className="relative grid grid-cols-4 gap-1.5 sm:gap-2">
        {svgLines}
        {cells}
      </div>
    </div>
  );
}
