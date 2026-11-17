import type { Palace, SiHua, ZiweiChart } from './types';
import { LUCUN_TABLE, PALACE_NAMES_ORDER, STAR_DESCRIPTIONS, TIANMA_TABLE } from './constants';
import { SCHOOL_AX } from './school-tables.generated';
import {
  getDaXianSiHua,
  getLiuNianSiHua,
  getYearBranchIndex,
  getYearStemIndex,
} from './sihua';
import { jiangQianShenName, jiangXingBranch, suiQianShenName } from './shier-shen';
import { detectPatterns } from './patterns';
import { SIHUA_IN_FUQI_GU, STAR_IN_FUQI_GU } from './heming-knowledge';
import {
  VI_BRANCHES,
  VI_PALACE_ROLES,
  VI_STEMS,
  localizePattern,
  translateBrightness,
  translatePalaceName,
  translateSiHua,
  translateStarName,
} from './vi-i18n';

export type YunxianView = 'mingpan' | 'daxian' | 'liunian' | 'xiaoxian' | 'liuyue' | 'liuri' | 'liushi';

/** 独立童限选择的专用 sentinel；-1 保留给“没有所属实际大限”。 */
export const CHILDHOOD_DAXIAN_INDEX = -2;

// 小限与流年一样按所选流年（虚岁）定所属大限，故同归 FLOW_VIEWS。
const FLOW_VIEWS = new Set<YunxianView>(['liunian', 'xiaoxian', 'liuyue', 'liuri', 'liushi']);

function isValidDaXianIndex(chart: ZiweiChart, index: number | null | undefined): index is number {
  return typeof index === 'number'
    && Number.isInteger(index)
    && index >= 0
    && index < chart.daXians.length;
}

/** 按虚岁查所属大限。大限年龄区间按首尾均包含处理。 */
export function getDaXianIndexForAge(chart: ZiweiChart, age: number): number {
  if (!Number.isFinite(age)) return -1;
  const safeAge = Math.trunc(age);
  return chart.daXians.findIndex(dx => safeAge >= dx.startAge && safeAge <= dx.endAge);
}

/** 农历流年换算虚岁后查所属大限。 */
export function getDaXianIndexForYear(chart: ZiweiChart, year: number): number {
  if (!Number.isFinite(year)) return -1;
  // UI 的 liunianYear 是农历流年。春节前出生者的农历生年可能比公历小 1，
  // 虚岁必须用农历年差，否则整组大限边界会晚一年。
  return getDaXianIndexForAge(chart, Math.trunc(year) - chart.lunarInfo.lunarYear + 1);
}

/** 大限起始虚岁换算为对应农历流年。 */
export function getDaXianStartYear(chart: ZiweiChart, index: number): number | null {
  if (!isValidDaXianIndex(chart, index)) return null;
  return chart.lunarInfo.lunarYear + chart.daXians[index].startAge - 1;
}

/** 返回该大限完整对应的公历流年；正常大限恰好十年。 */
export function getDaXianYears(chart: ZiweiChart, index: number): number[] {
  if (!isValidDaXianIndex(chart, index)) return [];
  const dx = chart.daXians[index];
  const startYear = getDaXianStartYear(chart, index);
  if (startYear === null) return [];
  return Array.from({ length: dx.endAge - dx.startAge + 1 }, (_, offset) => startYear + offset);
}

/** 主流排盘口径把第一实际大限之前的 1..起限-1 虚岁作为独立童限。 */
export function getChildhoodYears(chart: ZiweiChart): number[] {
  const firstStartAge = chart.daXians[0]?.startAge;
  if (!Number.isFinite(firstStartAge) || firstStartAge <= 1) return [];
  return Array.from({ length: firstStartAge - 1 }, (_, offset) => chart.lunarInfo.lunarYear + offset);
}

export function isChildhoodYear(chart: ZiweiChart, year: number): boolean {
  const age = Math.trunc(year) - chart.lunarInfo.lunarYear + 1;
  const firstStartAge = chart.daXians[0]?.startAge;
  return Number.isFinite(firstStartAge) && age >= 1 && age < firstStartAge;
}

/**
 * 童限大命相对本命命宫的地支偏移（虚岁 1–5）。
 * 与四张金标准盘逐年宫底「大命」同一套：虚岁1=本命命宫，其后 −4/−1/+3/+4。
 * 阳男亥→未→午→酉；阴男亥→未；阳女亥→未→午→酉→丑；立春阴女未→卯→寅→巳→酉。
 */
const CHILDHOOD_MING_OFFSET: Record<number, number> = {
  1: 0,
  2: -4,
  3: -5,
  4: -2,
  5: 2,
};

/**
 * 童限大命所在本命宫（用来取宫干，再走 getSiHuaByStem / 大昌大曲）。
 * 有农历流年且虚岁 1–5：按 CHILDHOOD_MING_OFFSET 走宫。
 * 无年或表外年：阴女回退命宫−2（保住已锁 2026=巳），其余取本命命宫。
 */
export function getChildhoodDaXianPalace(chart: ZiweiChart, year?: number): Palace | null {
  if (getChildhoodYears(chart).length === 0) return null;
  if (year != null) {
    const age = Math.trunc(year) - chart.lunarInfo.lunarYear + 1;
    if (age in CHILDHOOD_MING_OFFSET) {
      const branch = ((chart.mingGongBranch + CHILDHOOD_MING_OFFSET[age]) % 12 + 12) % 12;
      return chart.palaces.find((p) => p.branch === branch) ?? null;
    }
  }
  const yinFemale = chart.yinYangGender === '阴女'
    || (chart.birthInfo.gender === 'female' && chart.lunarInfo.yearStem % 2 === 1);
  const branch = yinFemale
    ? ((chart.mingGongBranch - 2) % 12 + 12) % 12
    : chart.mingGongBranch;
  return chart.palaces.find((p) => p.branch === branch) ?? null;
}

/**
 * 所有运限界面共用的大限来源：
 * - 大限视图使用用户点选的大限；
 * - 流年、流月、流日、流时使用所选流年实际所属的大限；
 * - 本命或异常输入回退现实当前大限。
 */
export function resolveEffectiveDaXianIndex(
  chart: ZiweiChart,
  view: YunxianView,
  liunianYear: number,
  selectedDaXianIndex?: number | null,
): number {
  if (view === 'daxian' && isValidDaXianIndex(chart, selectedDaXianIndex)) {
    return selectedDaXianIndex;
  }
  if (view === 'daxian' && selectedDaXianIndex === CHILDHOOD_DAXIAN_INDEX && getChildhoodYears(chart).length > 0) {
    return CHILDHOOD_DAXIAN_INDEX;
  }

  if (FLOW_VIEWS.has(view)) {
    const yearIndex = getDaXianIndexForYear(chart, liunianYear);
    // -1 表示童限或超出已生成的大限范围；不能错误回退到现实当前大限。
    return isValidDaXianIndex(chart, yearIndex) ? yearIndex : -1;
  }

  if (isValidDaXianIndex(chart, chart.currentDaXianIndex)) return chart.currentDaXianIndex;
  // 真实童限时 currentDaXianIndex=-1；不能为了有值而误套第一个实际大限。
  return -1;
}

// ─── TẦNG KHUNG XÁC ĐỊNH VẬN HẠN (Deterministic Period Context Layer) ─────────

export interface PeriodSiHuaImpact {
  mutagenKey: SiHua;
  mutagenVi: string;
  starNameCn: string;
  starNameVi: string;
  brightnessVi: string;
  natalPalaceNameVi: string;
  natalPalaceBranch: number;
  natalPalaceGanZhiVi: string;
  periodPalaceRoleVi: string;
  oppositePalaceNameVi: string;
  oppositePalaceGanZhiVi: string;
  oppositePeriodPalaceRoleVi: string;
  natalMutagenVi?: string;
  resonanceNoteVi: string;
  periodStemVi?: string;
}

/**
 * Hàm render CHUẨN MỰC DUY NHẤT cho một dòng Tứ Hóa kỳ hạn trong bảng dữ kiện & khối hậu kiểm S1.
 * Dùng chung giữa `buildYunxianPeriodContext` và `verifyAndEnsureCompletePeriodSiHua`.
 */
export function formatPeriodSiHuaFactLine(
  sh: PeriodSiHuaImpact,
  prefix: 'Đại Hạn' | 'Lưu' = 'Lưu',
): string {
  const layerTag = prefix === 'Lưu' ? '[Tứ Hóa Lưu Niên]' : '[Tứ Hóa Đại Hạn]';
  return `• **${layerTag} ${prefix} ${sh.mutagenVi} → Sao ${sh.starNameVi} [${sh.brightnessVi}]**: tọa thủ tại **Cung ${sh.periodPalaceRoleVi}** *(trùng Bản Mệnh gốc: ${sh.natalPalaceNameVi} - ${sh.natalPalaceGanZhiVi})* — đối cung xung chiếu: **Cung ${sh.oppositePeriodPalaceRoleVi}** *(trùng Bản Mệnh gốc: ${sh.oppositePalaceNameVi} - ${sh.oppositePalaceGanZhiVi})*${sh.natalMutagenVi ? ` · [${sh.natalMutagenVi}]` : ''}.`;
}

export interface PeriodDynamicStarItem {
  starLabelVi: string;
  category: 'loc_ma' | 'sat_tinh' | 'cat_tinh' | 'dao_hoa' | 'tue_tuong';
  branch: number;
  branchVi: string;
  natalPalaceNameVi: string;
  periodPalaceRoleVi: string;
}

export interface PeriodPalaceSummary {
  roleVi: string;
  branch: number;
  ganZhiVi: string;
  natalPalaceNameVi: string;
  majorStarsVi: string[];
  isEmpty: boolean;
  borrowedFromVi?: string;
  luckyStarsVi: string[];
  shaStarsVi: string[];
  periodSiHuaHere: string[];
  dynamicStarsHere: string[];
  shierShenVi: {
    suiQian: string;
    jiangQian: string;
  };
}

export interface YunxianPeriodContext {
  mode: 'dahan' | 'liunian';
  cacheKey: string;
  periodId: string;
  periodTitleVi: string;
  periodScopeNoteVi: string;
  stemIndex: number;
  branchIndex: number;
  ganZhiVi: string;
  ageRangeOrYearVi: string;
  activatedPalace: {
    natalPalaceNameVi: string;
    natalPalaceRoleDescVi: string;
    branch: number;
    ganZhiVi: string;
    majorStarsSummaryVi: string;
    luckyStarsVi: string[];
    shaStarsVi: string[];
  };
  parentDaXian?: {
    index: number;
    ageRangeVi: string;
    yearsRangeVi: string;
    natalPalaceNameVi: string;
    ganZhiVi: string;
    relationWithLiuNianVi: string;
  };
  periodSiHua: PeriodSiHuaImpact[];
  dynamicStars: PeriodDynamicStarItem[];
  sanFangSiZheng: {
    benGong: PeriodPalaceSummary;
    xungChieu: PeriodPalaceSummary;
    tamHopTai: PeriodPalaceSummary;
    tamHopQuan: PeriodPalaceSummary;
  };
  knowledgeExcerpts: {
    patterns: string[];
    starPrinciples: string[];
    fuqiAndSihua: string[];
  };
  factTableMarkdown: string;
  deterministicInterpretationMarkdown: string;
}

export interface YunxianSelectionInput {
  mode: 'natal' | 'dahan' | 'liunian';
  daXianIndex?: number;
  activeBranch?: number;
  mingBranch?: number;
  year?: number;
}

function formatPalaceMajorsVi(palace: Palace): {
  list: string[];
  summary: string;
  rawMajorNames: string[];
} {
  const majors = palace.stars.filter((s) => s.type === 'major');
  if (majors.length > 0) {
    const list = majors.map((s) => {
      const b = s.brightnessRaw ? ` [${translateBrightness(s.brightnessRaw)}]` : '';
      const sh = s.siHua ? ` (Bản mệnh Hóa ${translateSiHua(s.siHua)})` : '';
      return `${translateStarName(s.name)}${b}${sh}`;
    });
    return {
      list,
      summary: list.join(', '),
      rawMajorNames: majors.map((s) => s.name),
    };
  }
  const borrowed = (palace.borrowedStars ?? []).map((s) => translateStarName(s));
  const fromPalace = translatePalaceName(palace.borrowedFromName);
  const summary = borrowed.length > 0
    ? `Vô chính diệu (mượn ${borrowed.join(', ')} từ đối cung ${fromPalace})`
    : 'Vô chính diệu';
  return {
    list: [summary],
    summary,
    rawMajorNames: palace.borrowedStars ?? [],
  };
}

/**
 * QĐ-H2 (A-01): Nguồn chuẩn duy nhất cho khóa định danh lá số, chống va chạm cache khi đổi tên,
 * đổi giờ/phút gốc trong cùng canh giờ, đổi tháng nhuận hoặc kinh độ nơi sinh.
 */
export function buildChartIdentityKey(chart: ZiweiChart): string {
  const b = chart.birthInfo;
  const nameSlug =
    (b.name || '')
      .trim()
      .normalize('NFC')
      .toLowerCase()
      .replace(/[^a-z0-9\p{L}]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'anon';
  const leapFlag = chart.lunarInfo?.isLeapMonth ? 'leap1' : 'leap0';
  const origSig = b.origInput
    ? `${b.origInput.year}-${b.origInput.month}-${b.origInput.day}@${b.origInput.clockHour}:${b.origInput.clockMinute}`
    : 'no_clock';
  const lonSig =
    typeof b.longitude === 'number' && Number.isFinite(b.longitude)
      ? b.longitude.toFixed(2)
      : 'no_lon';
  return `${b.year}_${b.month}_${b.day}_${b.hour}_${b.gender}__${nameSlug}__mg${chart.mingGongBranch}__${leapFlag}__${origSig}__${lonSig}`;
}

/**
 * Xây dựng ngữ cảnh kỳ hạn xác định (Deterministic Period Context)
 * Dùng thuần túy dữ liệu và bảng tra sẵn có của engine (yunxian-context, sihua, constants, school-tables, shier-shen).
 */
export function buildYunxianPeriodContext(
  chart: ZiweiChart,
  input: YunxianSelectionInput,
): YunxianPeriodContext | null {
  if (input.mode === 'natal') return null;

  const chartIdentityKey = buildChartIdentityKey(chart);
  const prefix = input.mode === 'dahan' ? 'Đại Hạn' : 'Lưu';

  let stemIndex = 0;
  let branchIndex = 0;
  let periodId = '';
  let periodTitleVi = '';
  let ageRangeOrYearVi = '';
  let periodScopeNoteVi = '';
  let parentDaXian: YunxianPeriodContext['parentDaXian'] | undefined;

  if (input.mode === 'dahan') {
    let dxIdx = typeof input.daXianIndex === 'number' && isValidDaXianIndex(chart, input.daXianIndex)
      ? input.daXianIndex
      : -1;
    if (dxIdx < 0 && typeof input.activeBranch === 'number') {
      dxIdx = chart.daXians.findIndex((d) => d.palaceBranch === input.activeBranch);
    }
    if (dxIdx < 0) {
      dxIdx = resolveEffectiveDaXianIndex(chart, 'daxian', new Date().getFullYear(), null);
    }
    if (dxIdx < 0) dxIdx = 0;

    const dx = chart.daXians[dxIdx] ?? chart.daXians[0];
    const dxSihua = getDaXianSiHua(chart, dxIdx);
    const years = getDaXianYears(chart, dxIdx);
    const yearsStr = years.length > 0 ? `${years[0]}–${years[years.length - 1]}` : '';
    const activePalace = chart.palaces.find((p) => p.branch === dx.palaceBranch) ?? chart.palaces[0];

    stemIndex = dxSihua?.stemIndex ?? activePalace.stem;
    branchIndex = dx.palaceBranch;
    const ganZhi = `${VI_STEMS[stemIndex]} ${VI_BRANCHES[branchIndex]}`;
    periodId = `dahan_${dxIdx}_${dx.startAge}_${dx.endAge}`;
    ageRangeOrYearVi = `${dx.startAge}–${dx.endAge} tuổi (Dương lịch ${yearsStr})`;
    periodTitleVi = `Đại Hạn ${dx.startAge}–${dx.endAge} tuổi (${yearsStr}) · Cung ${translatePalaceName(dx.palaceName)} (${ganZhi})`;
    periodScopeNoteVi = 'Đại Hạn (10 năm) định hình môi trường lớn, xu thế nền tảng và trọng tâm chuyển dịch vận trình trong suốt một thập kỷ.';
  } else {
    const year = input.year ?? new Date().getFullYear();
    const lnSihua = getLiuNianSiHua(year);
    stemIndex = lnSihua.stemIndex;
    branchIndex = input.mingBranch ?? getYearBranchIndex(year);
    const nominalAge = year - chart.lunarInfo.lunarYear + 1;
    const activePalace = chart.palaces.find((p) => p.branch === branchIndex) ?? chart.palaces[0];
    const ganZhi = `${VI_STEMS[stemIndex]} ${VI_BRANCHES[branchIndex]}`;

    periodId = `liunian_${year}`;
    ageRangeOrYearVi = `Năm ${year} (${ganZhi} · ${nominalAge} tuổi âm lịch)`;
    periodTitleVi = `Lưu Niên ${year} — Năm ${ganZhi} (${nominalAge} tuổi) · Kích hoạt cung ${translatePalaceName(activePalace.name)}`;
    periodScopeNoteVi = 'Lưu Niên (1 năm) phản ánh biến chuyển cụ thể, sự kiện kích hoạt và điểm ứng kỳ trong năm đó, vận hành bên trong khung Đại Hạn 10 năm.';

    const effDxIdx = resolveEffectiveDaXianIndex(chart, 'liunian', year);
    if (effDxIdx >= 0 && chart.daXians[effDxIdx]) {
      const pDx = chart.daXians[effDxIdx];
      const pYears = getDaXianYears(chart, effDxIdx);
      const pPalace = chart.palaces.find((p) => p.branch === pDx.palaceBranch) ?? chart.palaces[0];
      const diff = ((branchIndex - pDx.palaceBranch) % 12 + 12) % 12;
      let relationVi = 'Lưu Niên đi qua cung chức năng phụ trợ của Đại Hạn';
      if (diff === 0) {
        relationVi = 'Lưu Niên trùng phùng chính cung Đại Hạn (năng lượng kỳ hạn hội tụ cực đại tại cùng một cung)';
      } else if (diff === 6) {
        relationVi = 'Lưu Niên xung chiếu trực tiếp cung Đại Hạn (trục đối xung kích hoạt mạnh giữa nội lực và hoàn cảnh)';
      } else if (diff === 4 || diff === 8) {
        relationVi = 'Lưu Niên nằm trong Tam Hợp (Mệnh - Tài - Quan) của Đại Hạn (cộng hưởng thuận chiều với xu thế 10 năm)';
      }
      parentDaXian = {
        index: effDxIdx,
        ageRangeVi: `${pDx.startAge}–${pDx.endAge} tuổi`,
        yearsRangeVi: pYears.length > 0 ? `${pYears[0]}–${pYears[pYears.length - 1]}` : '',
        natalPalaceNameVi: translatePalaceName(pPalace.name),
        ganZhiVi: `${VI_STEMS[pPalace.stem]} ${VI_BRANCHES[pPalace.branch]}`,
        relationWithLiuNianVi: relationVi,
      };
    }
  }

  const ganZhiVi = `${VI_STEMS[stemIndex]} ${VI_BRANCHES[branchIndex]}`;
  const getPeriodPalaceRoleVi = (targetBranch: number): string => {
    const offset = ((branchIndex - targetBranch) % 12 + 12) % 12;
    const roleCn = PALACE_NAMES_ORDER[offset] ?? '命宫';
    return `${prefix} ${translatePalaceName(roleCn)}`;
  };

  // 1. Cung Bản Mệnh được kỳ hạn kích hoạt
  const activePalace = chart.palaces.find((p) => p.branch === branchIndex) ?? chart.palaces[0];
  const activeMajors = formatPalaceMajorsVi(activePalace);
  const activeLuckys = activePalace.stars.filter((s) => s.type === 'lucky').map((s) => translateStarName(s.name));
  const activeShas = activePalace.stars.filter((s) => s.type === 'sha').map((s) => translateStarName(s.name));
  const natalRoleDesc = VI_PALACE_ROLES[activePalace.name] ?? 'Trọng tâm vận hạn kích hoạt';

  // 2. Tứ Hóa Lưu / Đại Hạn theo Thiên Can kỳ hạn (sihua.ts)
  const siHuaTransforms = input.mode === 'dahan'
    ? (getDaXianSiHua(chart, chart.daXians.findIndex((d) => d.palaceBranch === branchIndex))?.transforms
      ?? getLiuNianSiHua(2024 + stemIndex).transforms)
    : getLiuNianSiHua(input.year ?? new Date().getFullYear()).transforms;

  const periodStemVi = VI_STEMS[stemIndex] ?? '';
  const periodSiHua: PeriodSiHuaImpact[] = (['禄', '权', '科', '忌'] as SiHua[]).map((sh) => {
    const starCn = siHuaTransforms[sh] ?? '';
    const starVi = translateStarName(starCn);
    const mutagenVi = `Hóa ${translateSiHua(sh)}`;
    const targetPalace = chart.palaces.find((p) => p.stars.some((s) => s.name === starCn)) ?? activePalace;
    const targetStar = targetPalace.stars.find((s) => s.name === starCn);
    const oppBranch = (targetPalace.branch + 6) % 12;
    const oppPalace = chart.palaces.find((p) => p.branch === oppBranch) ?? activePalace;
    const natalPalaceNameVi = translatePalaceName(targetPalace.name);
    const oppositePalaceNameVi = translatePalaceName(oppPalace.name);
    const periodPalaceRoleVi = getPeriodPalaceRoleVi(targetPalace.branch);
    const oppositePeriodPalaceRoleVi = getPeriodPalaceRoleVi(oppBranch);
    const natalMutagenVi = targetStar?.siHua ? `Bản mệnh Hóa ${translateSiHua(targetStar.siHua)}` : undefined;

    let resonanceNoteVi = '';
    if (targetStar?.siHua === sh) {
      resonanceNoteVi = `Song ${translateSiHua(sh)} trùng phùng (${prefix} ${mutagenVi} trùng Bản mệnh Hóa ${translateSiHua(targetStar.siHua)}) tại Cung ${periodPalaceRoleVi} (trùng ${natalPalaceNameVi}), xung chiếu Cung ${oppositePeriodPalaceRoleVi} (trùng ${oppositePalaceNameVi})`;
    } else if (targetStar?.siHua) {
      resonanceNoteVi = `Giao hội Tứ Hóa: ${prefix} ${mutagenVi} gặp Bản mệnh Hóa ${translateSiHua(targetStar.siHua)} trên sao ${starVi} tại Cung ${periodPalaceRoleVi} (trùng ${natalPalaceNameVi}), xung chiếu Cung ${oppositePeriodPalaceRoleVi}`;
    } else if (sh === '忌') {
      resonanceNoteVi = `${prefix} Hóa Kỵ nhập Cung ${periodPalaceRoleVi} (trùng bản mệnh ${natalPalaceNameVi}), xung chiếu trực tiếp Cung ${oppositePeriodPalaceRoleVi} (trùng ${oppositePalaceNameVi} - ${VI_BRANCHES[oppBranch]})`;
    } else {
      resonanceNoteVi = `${prefix} ${mutagenVi} kích hoạt sao ${starVi} tại Cung ${periodPalaceRoleVi} (trùng bản mệnh ${natalPalaceNameVi}), xung chiếu sang Cung ${oppositePeriodPalaceRoleVi} (trùng ${oppositePalaceNameVi})`;
    }

    return {
      mutagenKey: sh,
      mutagenVi,
      starNameCn: starCn,
      starNameVi: starVi,
      brightnessVi: targetStar?.brightnessRaw ? translateBrightness(targetStar.brightnessRaw) : 'Bình',
      natalPalaceNameVi,
      natalPalaceBranch: targetPalace.branch,
      natalPalaceGanZhiVi: `${VI_STEMS[targetPalace.stem]} ${VI_BRANCHES[targetPalace.branch]}`,
      periodPalaceRoleVi,
      oppositePalaceNameVi,
      oppositePalaceGanZhiVi: `${VI_STEMS[oppPalace.stem]} ${VI_BRANCHES[oppPalace.branch]}`,
      oppositePeriodPalaceRoleVi,
      natalMutagenVi,
      resonanceNoteVi,
      periodStemVi,
    };
  });

  // 3. Các Sao Lưu / Vận Hạn theo bảng tra sẵn có của Engine (constants.ts, school-tables.generated.ts, shier-shen.ts)
  const luCunBranch = LUCUN_TABLE[stemIndex] ?? 0;
  const qingYangBranch = (luCunBranch + 1) % 12;
  const tuoLuoBranch = (luCunBranch + 11) % 12;
  const tianMaBranch = TIANMA_TABLE[branchIndex] ?? 2;
  const kuiYueRow = SCHOOL_AX.KY_ARR1[stemIndex + 1] ?? [2, 8];
  const tianKuiBranch = ((kuiYueRow[0] - 1) % 12 + 12) % 12;
  const tianYueBranch = ((kuiYueRow[1] - 1) % 12 + 12) % 12;
  const liuChangBranch = (((SCHOOL_AX.LIUCHANG[stemIndex + 1] ?? 1) - 1) % 12 + 12) % 12;
  const liuQuBranch = (((SCHOOL_AX.LIUQU[stemIndex + 1] ?? 1) - 1) % 12 + 12) % 12;
  const hongLuanBranch = ((3 - branchIndex) % 12 + 12) % 12;
  const tianXiBranch = (hongLuanBranch + 6) % 12;
  const suiJianBranch = branchIndex;
  const suiPoBranch = (branchIndex + 6) % 12;
  const sangMenBranch = (branchIndex + 2) % 12;
  const baiHuBranch = (branchIndex + 8) % 12;
  const jiangXingBranchIdx = jiangXingBranch(branchIndex);

  const rawDynamicSpecs: { label: string; category: PeriodDynamicStarItem['category']; branch: number }[] = [
    { label: `${prefix} Lộc Tồn`, category: 'loc_ma', branch: luCunBranch },
    { label: `${prefix} Thiên Mã`, category: 'loc_ma', branch: tianMaBranch },
    { label: `${prefix} Kình Dương`, category: 'sat_tinh', branch: qingYangBranch },
    { label: `${prefix} Đà La`, category: 'sat_tinh', branch: tuoLuoBranch },
    { label: `${prefix} Thiên Khôi`, category: 'cat_tinh', branch: tianKuiBranch },
    { label: `${prefix} Thiên Việt`, category: 'cat_tinh', branch: tianYueBranch },
    { label: `${prefix} Văn Xương`, category: 'cat_tinh', branch: liuChangBranch },
    { label: `${prefix} Văn Khúc`, category: 'cat_tinh', branch: liuQuBranch },
    { label: `${prefix} Hồng Loan`, category: 'dao_hoa', branch: hongLuanBranch },
    { label: `${prefix} Thiên Hỷ`, category: 'dao_hoa', branch: tianXiBranch },
    { label: `${prefix} Tuế Kiến`, category: 'tue_tuong', branch: suiJianBranch },
    { label: `${prefix} Tuế Phá`, category: 'tue_tuong', branch: suiPoBranch },
    { label: `${prefix} Tang Môn`, category: 'tue_tuong', branch: sangMenBranch },
    { label: `${prefix} Bạch Hổ`, category: 'tue_tuong', branch: baiHuBranch },
    { label: `${prefix} Tướng Tinh`, category: 'tue_tuong', branch: jiangXingBranchIdx },
  ];

  const dynamicStars: PeriodDynamicStarItem[] = rawDynamicSpecs.map((spec) => {
    const p = chart.palaces.find((pal) => pal.branch === spec.branch) ?? activePalace;
    return {
      starLabelVi: spec.label,
      category: spec.category,
      branch: spec.branch,
      branchVi: VI_BRANCHES[spec.branch],
      natalPalaceNameVi: translatePalaceName(p.name),
      periodPalaceRoleVi: getPeriodPalaceRoleVi(spec.branch),
    };
  });

  // 4. Tam Phương Tứ Chính & Điểm Xung Chiếu của cung kỳ hạn
  const buildPalaceSummary = (b: number, roleVi: string): PeriodPalaceSummary => {
    const normB = ((b % 12) + 12) % 12;
    const p = chart.palaces.find((pal) => pal.branch === normB) ?? activePalace;
    const majorsInfo = formatPalaceMajorsVi(p);
    const sihuaHere = periodSiHua
      .filter((item) => item.natalPalaceBranch === normB)
      .map((item) => `${prefix} ${item.mutagenVi} (${item.starNameVi})`);
    const oppSihuaClash = periodSiHua
      .filter((item) => (item.natalPalaceBranch + 6) % 12 === normB && item.mutagenKey === '忌')
      .map((item) => `Bị ${prefix} Hóa Kỵ (${item.starNameVi}) từ đối cung xung chiếu`);
    const dynHere = dynamicStars
      .filter((d) => d.branch === normB)
      .map((d) => d.starLabelVi);

    return {
      roleVi,
      branch: normB,
      ganZhiVi: `${VI_STEMS[p.stem]} ${VI_BRANCHES[normB]}`,
      natalPalaceNameVi: translatePalaceName(p.name),
      majorStarsVi: majorsInfo.list,
      isEmpty: Boolean(p.isEmpty),
      borrowedFromVi: p.isEmpty ? translatePalaceName(p.borrowedFromName) : undefined,
      luckyStarsVi: p.stars.filter((s) => s.type === 'lucky').map((s) => translateStarName(s.name)),
      shaStarsVi: p.stars.filter((s) => s.type === 'sha').map((s) => translateStarName(s.name)),
      periodSiHuaHere: [...sihuaHere, ...oppSihuaClash],
      dynamicStarsHere: dynHere,
      shierShenVi: {
        suiQian: translateStarName(suiQianShenName(branchIndex, normB)),
        jiangQian: translateStarName(jiangQianShenName(branchIndex, normB)),
      },
    };
  };

  const sanFangSiZheng = {
    benGong: buildPalaceSummary(branchIndex, `Cung ${prefix} Mệnh Cung (Bản cung kỳ hạn)`),
    xungChieu: buildPalaceSummary((branchIndex + 6) % 12, `Cung ${prefix} Thiên Di (Đối cung xung chiếu)`),
    tamHopTai: buildPalaceSummary((branchIndex + 8) % 12, `Cung ${prefix} Tài Bạch (Tam hợp Tài Bạch kỳ hạn)`),
    tamHopQuan: buildPalaceSummary((branchIndex + 4) % 12, `Cung ${prefix} Quan Lộc (Tam hợp Quan Lộc kỳ hạn)`),
  };

  // 5. Trích đoạn kiến thức liên quan từ patterns.ts, heming-knowledge.ts, school-data.ts/constants.ts
  const allPatterns = detectPatterns(chart).map(localizePattern);
  const patternExcerpts = allPatterns.slice(0, 6).map(
    (p) => `${p.name} (${p.palaces.join(', ')}): ${p.description}`,
  );

  const starPrinciples: string[] = [];
  const relevantMajorNames = new Set<string>([
    ...activeMajors.rawMajorNames,
    ...periodSiHua.map((s) => s.starNameCn),
  ]);
  for (const starCn of relevantMajorNames) {
    const desc = STAR_DESCRIPTIONS[starCn];
    if (desc) {
      starPrinciples.push(
        `${translateStarName(starCn)} (Hành ${desc.element}, ${desc.nature}): ${desc.keywords}`,
      );
    }
  }

  const fuqiAndSihua: string[] = [];
  for (const starCn of activeMajors.rawMajorNames) {
    const fqEntry = STAR_IN_FUQI_GU[starCn];
    if (fqEntry) {
      fuqiAndSihua.push(`${translateStarName(starCn)}: ${fqEntry.summary}`);
    }
  }
  for (const item of periodSiHua) {
    const shEntry = SIHUA_IN_FUQI_GU[item.mutagenKey];
    if (shEntry) {
      fuqiAndSihua.push(`${item.mutagenVi} (${item.starNameVi}): ${shEntry}`);
    }
  }

  // 6. Bảng dữ kiện kỳ hạn dạng Markdown có cấu trúc
  const factLines: string[] = [];
  factLines.push(`**[Bảng Dữ Kiện Kỳ Hạn Xác Định — ${periodTitleVi}]**`);
  factLines.push(`• **Loại kỳ hạn**: ${input.mode === 'dahan' ? 'Đại Hạn 10 năm (Xu thế thập kỷ)' : 'Lưu Niên 1 năm (Biến chuyển trong năm)'}`);
  factLines.push(`• **Thiên Can · Địa Chi kỳ hạn**: **${ganZhiVi}** (${ageRangeOrYearVi})`);
  if (parentDaXian) {
    factLines.push(
      `• **Đại Hạn gốc chi phối**: Đại Hạn **${parentDaXian.ageRangeVi}** (${parentDaXian.yearsRangeVi}) tại cung **${parentDaXian.natalPalaceNameVi} (${parentDaXian.ganZhiVi})** — *${parentDaXian.relationWithLiuNianVi}*`,
    );
  }
  factLines.push(
    `• **Cung bản mệnh được kích hoạt**: Cung **${translatePalaceName(activePalace.name)} (${activePalace.stem >= 0 ? VI_STEMS[activePalace.stem] : ''} ${VI_BRANCHES[activePalace.branch]})** — ${natalRoleDesc}`,
  );
  factLines.push(
    `• **Tinh hệ bản mệnh tại cung kích hoạt**: Chính tinh: **${activeMajors.summary}** | Cát tinh: ${activeLuckys.join(', ') || 'Không'} | Sát tinh: ${activeShas.join(', ') || 'Không'}`,
  );

  factLines.push(`\n**[Tứ Hóa Kỳ Hạn (Can ${VI_STEMS[stemIndex]}) Tác Động Lên Sao Bản Mệnh]**`);
  for (const sh of periodSiHua) {
    factLines.push(formatPeriodSiHuaFactLine(sh, prefix));
  }

  factLines.push(`\n**[Các Sao Lưu / Vận Hạn Theo Engine (Can ${VI_STEMS[stemIndex]} · Chi ${VI_BRANCHES[branchIndex]})]**`);
  const formatDynamicStar = (d: PeriodDynamicStarItem): string =>
    `**${d.starLabelVi}** tại **Cung ${d.periodPalaceRoleVi}** *(trùng ${d.natalPalaceNameVi} - ${d.branchVi})*`;

  const locMaStr = dynamicStars
    .filter((d) => d.category === 'loc_ma')
    .map(formatDynamicStar)
    .join(' · ');
  const catTinhStr = dynamicStars
    .filter((d) => d.category === 'cat_tinh')
    .map(formatDynamicStar)
    .join(' · ');
  const daoHoaStr = dynamicStars
    .filter((d) => d.category === 'dao_hoa')
    .map(formatDynamicStar)
    .join(' · ');
  const satTinhStr = dynamicStars
    .filter((d) => d.category === 'sat_tinh')
    .map(formatDynamicStar)
    .join(' · ');
  const tueTuongStr = dynamicStars
    .filter((d) => d.category === 'tue_tuong')
    .map(formatDynamicStar)
    .join(' · ');

  factLines.push(`• **Bộ Lộc Mã**: ${locMaStr}`);
  factLines.push(`• **Bộ Khôi Việt · Xương Khúc**: ${catTinhStr}`);
  factLines.push(`• **Bộ Đào Hồng Hỷ**: ${daoHoaStr}`);
  factLines.push(`• **Bộ Kình Đà (Dương Đà giáp Lộc)**: ${satTinhStr}`);
  factLines.push(`• **Vòng Tuế Tiền · Tướng Tiền**: ${tueTuongStr}`);

  factLines.push(`\n**[Tam Phương Tứ Chính & Điểm Xung Chiếu Của Kỳ Hạn (Tra Cứu Cố Định — Không Tự Nhẩm Địa Chi)]**`);
  for (const node of [
    sanFangSiZheng.benGong,
    sanFangSiZheng.xungChieu,
    sanFangSiZheng.tamHopTai,
    sanFangSiZheng.tamHopQuan,
  ]) {
    const shText = node.periodSiHuaHere.length > 0 ? ` | Tứ Hóa kỳ hạn: **${node.periodSiHuaHere.join(', ')}**` : '';
    const dynText = node.dynamicStarsHere.length > 0 ? ` | Sao vận hạn: ${node.dynamicStarsHere.join(', ')}` : '';
    const luckyText = node.luckyStarsVi.length > 0 ? node.luckyStarsVi.join(', ') : 'Không';
    const shaText = node.shaStarsVi.length > 0 ? node.shaStarsVi.join(', ') : 'Không';
    factLines.push(
      `• **${node.roleVi}** → Đóng nhờ trên cung Bản Mệnh gốc **${node.natalPalaceNameVi} (${node.ganZhiVi})**: Chính tinh **${node.majorStarsVi.join(', ')}** | Cát tinh: ${luckyText} | Sát tinh: ${shaText}${shText}${dynText} *(Tuế/Tướng: ${node.shierShenVi.suiQian} · ${node.shierShenVi.jiangQian})*`,
    );
  }

  factLines.push(`\n**[Bảng Ánh Xạ Đầy Đủ 12 Cung Kỳ Hạn ↔ 12 Cung Bản Mệnh Gốc (Tra Cứu Bắt Buộc)]**`);
  for (let offset = 0; offset < 12; offset += 1) {
    const targetBranch = ((branchIndex - offset) % 12 + 12) % 12;
    const roleVi = getPeriodPalaceRoleVi(targetBranch);
    const pal = chart.palaces.find((p) => p.branch === targetBranch) ?? activePalace;
    const majorsInfo = formatPalaceMajorsVi(pal);
    const ganZhi = `${VI_STEMS[pal.stem]} ${VI_BRANCHES[pal.branch]}`;
    factLines.push(
      `• **Cung ${roleVi}** tại **${ganZhi}** → trùng cung Bản Mệnh gốc **${translatePalaceName(pal.name)}** (Chính tinh: ${majorsInfo.summary})`,
    );
  }

  const factTableMarkdown = factLines.join('\n');

  // 7. Đoạn luận giải nền dạng mẫu câu xác định (Deterministic Template Interpretation)
  const luItem = periodSiHua.find((x) => x.mutagenKey === '禄')!;
  const quanItem = periodSiHua.find((x) => x.mutagenKey === '权')!;
  const keItem = periodSiHua.find((x) => x.mutagenKey === '科')!;
  const jiItem = periodSiHua.find((x) => x.mutagenKey === '忌')!;
  const locTonItem = dynamicStars.find((x) => x.starLabelVi.endsWith('Lộc Tồn'))!;
  const tianMaItem = dynamicStars.find((x) => x.starLabelVi.endsWith('Thiên Mã'))!;
  const qingYangItem = dynamicStars.find((x) => x.starLabelVi.endsWith('Kình Dương'))!;
  const tuoLuoItem = dynamicStars.find((x) => x.starLabelVi.endsWith('Đà La'))!;
  const hongLuanItem = dynamicStars.find((x) => x.starLabelVi.endsWith('Hồng Loan'))!;
  const tianXiItem = dynamicStars.find((x) => x.starLabelVi.endsWith('Thiên Hỷ'))!;

  const interpLines: string[] = [];
  interpLines.push(`**[Luận Giải Nền Xác Định — ${periodTitleVi}]**`);
  interpLines.push(
    `1. **Trọng Tâm Dịch Chuyển (${input.mode === 'dahan' ? 'Xu thế 10 năm' : 'Ứng kỳ trong năm'})**: ${periodScopeNoteVi} Khi trọng tâm vận hạn đặt tại cung bản mệnh **${translatePalaceName(activePalace.name)} (${ganZhiVi})** với tinh hệ **${activeMajors.summary}**, các vấn đề thuộc về *${natalRoleDesc.toLowerCase()}* trở thành trục xoay chính của đương số.${parentDaXian ? ` Đặt trong bối cảnh Đại Hạn gốc tại **${parentDaXian.natalPalaceNameVi} (${parentDaXian.ganZhiVi})**, năm này có đặc điểm: **${parentDaXian.relationWithLiuNianVi}**.` : ''}`,
  );
  interpLines.push(
    `2. **Điểm Cát & Động Lực Phát Triển (Lộc · Quyền · Khoa & Cát Diệu)**: Can **${VI_STEMS[stemIndex]}** dẫn động **${luItem.starNameVi} Hóa Lộc** nhập cung bản mệnh **${luItem.natalPalaceNameVi}** (${luItem.periodPalaceRoleVi}), mở ra nguồn sinh khí và cơ hội thuận lợi tại lĩnh vực này; đồng thời **${quanItem.starNameVi} Hóa Quyền** tại **${quanItem.natalPalaceNameVi}** (${quanItem.periodPalaceRoleVi}) tăng cường sức chủ động, quyền quyết định và khả năng đột phá. Sao **${keItem.starNameVi} Hóa Khoa** tại **${keItem.natalPalaceNameVi}** (${keItem.periodPalaceRoleVi}) đóng vai trò quý nhân giải ách, nâng đỡ về uy tín và tri thức. Kết hợp thêm **${locTonItem.starLabelVi}** tại **${locTonItem.natalPalaceNameVi} (${locTonItem.branchVi})**, **${tianMaItem.starLabelVi}** tại **${tianMaItem.natalPalaceNameVi} (${tianMaItem.branchVi})** và bộ **${hongLuanItem.starLabelVi} (${hongLuanItem.branchVi}) · ${tianXiItem.starLabelVi} (${tianXiItem.branchVi})**, nếu biết nắm bắt thời cơ dịch chuyển và hợp tác ở trục Tam Phương (**${sanFangSiZheng.benGong.natalPalaceNameVi} – ${sanFangSiZheng.tamHopTai.natalPalaceNameVi} – ${sanFangSiZheng.tamHopQuan.natalPalaceNameVi}**) sẽ gặt hái thành quả thực chất.`,
  );
  interpLines.push(
    `3. **Điểm Hung & Trục Xung Chiếu Cần Phòng Ngừa (Hóa Kỵ & Kình Đà)**: Cần đặc biệt lưu tâm **${jiItem.starNameVi} Hóa Kỵ** tọa tại bản mệnh **${jiItem.natalPalaceNameVi} (${jiItem.natalPalaceGanZhiVi})** *(thuộc ${jiItem.periodPalaceRoleVi})* và xung chiếu trực tiếp sang cung **${jiItem.oppositePalaceNameVi} (${jiItem.oppositePalaceGanZhiVi})**. Theo tâm pháp Thiên Kỷ, cung có Hóa Kỵ tọa hoặc bị Hóa Kỵ xung chiếu là nơi dễ phát sinh áp lực, hao tâm tổn sức hoặc biến số ngoài dự kiến. Ngoài ra, cặp sát tinh **${qingYangItem.starLabelVi}** tại **${qingYangItem.natalPalaceNameVi} (${qingYangItem.branchVi})** (dễ va chạm, nóng vội) và **${tuoLuoItem.starLabelVi}** tại **${tuoLuoItem.natalPalaceNameVi} (${tuoLuoItem.branchVi})** (dễ dây dưa, trì trệ), cùng trục đối cung **${sanFangSiZheng.xungChieu.natalPalaceNameVi} (${sanFangSiZheng.xungChieu.ganZhiVi})** có chính tinh **${sanFangSiZheng.xungChieu.majorStarsVi.join(', ')}** xung chiếu về cung hạn, đòi hỏi sự tỉnh táo và quản trị rủi ro chặt chẽ.`,
  );
  interpLines.push(
    `4. **Phương Châm Ứng Xử Trong Kỳ Hạn**: Lấy cung có **Hóa Khoa (${keItem.natalPalaceNameVi})** và **Hóa Lộc (${luItem.natalPalaceNameVi})** làm điểm tựa hóa giải áp lực tại trục **${jiItem.natalPalaceNameVi} ↔ ${jiItem.oppositePalaceNameVi}**; hành sự thận trọng tại các cung có **${qingYangItem.starLabelVi} (${qingYangItem.branchVi})** và **${tuoLuoItem.starLabelVi} (${tuoLuoItem.branchVi})**.`,
  );

  const deterministicInterpretationMarkdown = interpLines.join('\n\n');

  return {
    mode: input.mode,
    cacheKey: `${chartIdentityKey}__${input.mode}__${periodId}`,
    periodId,
    periodTitleVi,
    periodScopeNoteVi,
    stemIndex,
    branchIndex,
    ganZhiVi,
    ageRangeOrYearVi,
    activatedPalace: {
      natalPalaceNameVi: translatePalaceName(activePalace.name),
      natalPalaceRoleDescVi: natalRoleDesc,
      branch: activePalace.branch,
      ganZhiVi: `${VI_STEMS[activePalace.stem]} ${VI_BRANCHES[activePalace.branch]}`,
      majorStarsSummaryVi: activeMajors.summary,
      luckyStarsVi: activeLuckys,
      shaStarsVi: activeShas,
    },
    parentDaXian,
    periodSiHua,
    dynamicStars,
    sanFangSiZheng,
    knowledgeExcerpts: {
      patterns: patternExcerpts,
      starPrinciples,
      fuqiAndSihua,
    },
    factTableMarkdown,
    deterministicInterpretationMarkdown,
  };
}

