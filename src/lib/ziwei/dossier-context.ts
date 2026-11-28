import type { Palace, SiHua, ZiweiChart } from './types.ts';
import { PALACE_NAMES_ORDER, STAR_DESCRIPTIONS } from './constants.ts';
import {
  detectSelfSihua,
  getDaXianSiHua,
  getLiuNianSiHua,
  getSiHuaByStem,
  getYearBranchIndex,
  getYearStemIndex,
} from './sihua.ts';
import {
  buildYunxianPeriodContext,
  getDaXianYears,
  isChildhoodYear,
  resolveEffectiveDaXianIndex,
  type PeriodDynamicStarItem,
  type PeriodSiHuaImpact,
  type YunxianPeriodContext,
} from './yunxian-context.ts';
import { detectPatterns } from './patterns.ts';
import {
  VI_BRANCHES,
  VI_PALACE_ROLES,
  VI_STEMS,
  formatChartSummaryVi,
  localizePattern,
  translateBrightness,
  translateGanZhi,
  translatePalaceName,
  translateSiHua,
  translateStarName,
  translateWuxingJu,
  translateYinYang,
} from './vi-i18n.ts';

export type DossierSectionId =
  | 'chapter_overview'
  | 'palaces_core'
  | 'palaces_family'
  | 'palaces_social_health'
  | 'horizon_5y'
  | 'horizon_10y';

export const VALID_DOSSIER_SECTION_IDS: readonly DossierSectionId[] = [
  'chapter_overview',
  'palaces_core',
  'palaces_family',
  'palaces_social_health',
  'horizon_5y',
  'horizon_10y',
];

export type PalaceGroupKey = 'core' | 'family' | 'social_health';

export interface DossierPalaceGroupSpec {
  key: PalaceGroupKey;
  sectionId: DossierSectionId;
  titleVi: string;
  subtitleVi: string;
  /** Canonical Chinese stem keys (matching Palace.name without trailing '宫') */
  palaceKeys: readonly string[];
  aliases: Record<string, readonly string[]>;
}

/**
 * Quyết định F2 (thắng v2 §3.2): Gom nhóm 12 cung theo đúng cấu trúc v1:
 * - core: Mệnh, Quan Lộc, Tài Bạch, Thiên Di
 * - family: Phu Thê, Tử Nữ, Điền Trạch, Phúc Đức
 * - social_health: Phụ Mẫu, Huynh Đệ, Giao Hữu, Tật Ách
 */
export const DOSSIER_PALACE_GROUPS: Record<PalaceGroupKey, DossierPalaceGroupSpec> = {
  core: {
    key: 'core',
    sectionId: 'palaces_core',
    titleVi: 'Nhóm 1 — Trục Cốt Lõi: Mệnh · Quan Lộc · Tài Bạch · Thiên Di',
    subtitleVi: 'Bốn cung Tam Phương Tứ Chính quyết định bản ngã, sự nghiệp, tài chính và môi trường phát triển bên ngoài.',
    palaceKeys: ['命', '官禄', '财帛', '迁移'],
    aliases: {
      '命': ['命宫', '命'],
      '官禄': ['官禄宫', '官禄'],
      '财帛': ['财帛宫', '财帛'],
      '迁移': ['迁移宫', '迁移'],
    },
  },
  family: {
    key: 'family',
    sectionId: 'palaces_family',
    titleVi: 'Nhóm 2 — Trục Gia Đạo & Nội Lực: Phu Thê · Tử Nữ · Điền Trạch · Phúc Đức',
    subtitleVi: 'Bốn cung nền tảng hôn nhân, con cái hậu duệ, tài sản tích lũy và phúc phần tinh thần.',
    palaceKeys: ['夫妻', '子女', '田宅', '福德'],
    aliases: {
      '夫妻': ['夫妻宫', '夫妻'],
      '子女': ['子女宫', '子女'],
      '田宅': ['田宅宫', '田宅'],
      '福德': ['福德宫', '福德'],
    },
  },
  social_health: {
    key: 'social_health',
    sectionId: 'palaces_social_health',
    titleVi: 'Nhóm 3 — Trục Quan Hệ & Thể Chất: Phụ Mẫu · Huynh Đệ · Giao Hữu · Tật Ách',
    subtitleVi: 'Bốn cung trưởng bối/học vấn, anh em đồng trang lứa, bằng hữu/đội ngũ và sức khỏe tạng phủ.',
    palaceKeys: ['父母', '兄弟', '交友', '疾厄'],
    aliases: {
      '父母': ['父母宫', '父母'],
      '兄弟': ['兄弟宫', '兄弟'],
      '交友': ['交友宫', '交友', '仆役宫', '仆役', '奴仆宫', '奴仆'],
      '疾厄': ['疾厄宫', '疾厄'],
    },
  },
};

export function isValidDossierSectionId(value: unknown): value is DossierSectionId {
  return (
    typeof value === 'string' &&
    (VALID_DOSSIER_SECTION_IDS as readonly string[]).includes(value)
  );
}

function findPalaceByCanonicalKey(
  chart: ZiweiChart,
  key: string,
  aliases: readonly string[],
): Palace | undefined {
  return chart.palaces.find((p) => {
    const clean = p.name.replace(/宫$/u, '');
    return aliases.includes(p.name) || aliases.includes(clean) || clean === key;
  });
}

function formatPalaceMajorsList(palace: Palace): {
  starsVi: string[];
  summaryVi: string;
  rawMajorNames: string[];
} {
  const majors = palace.stars.filter((s) => s.type === 'major');
  if (majors.length > 0) {
    const starsVi = majors.map((s) => {
      const br = s.brightnessRaw ? ` [${translateBrightness(s.brightnessRaw)}]` : '';
      const sh = s.siHua ? ` (Bản Mệnh Hóa ${translateSiHua(s.siHua)})` : '';
      return `${translateStarName(s.name)}${br}${sh}`;
    });
    return {
      starsVi,
      summaryVi: starsVi.join(', '),
      rawMajorNames: majors.map((s) => s.name),
    };
  }
  const borrowed = (palace.borrowedStars ?? []).map((s) => translateStarName(s));
  const fromName = translatePalaceName(palace.borrowedFromName);
  const summaryVi =
    borrowed.length > 0
      ? `Vô chính diệu (mượn ${borrowed.join(', ')} từ đối cung ${fromName})`
      : 'Vô chính diệu';
  return {
    starsVi: [summaryVi],
    summaryVi,
    rawMajorNames: palace.borrowedStars ?? [],
  };
}

function getAllSiHuaTagsForChart(
  chart: ZiweiChart,
): {
  natalPrefix: string;
  natalByStar: Record<string, SiHua>;
  natalTags: string[];
  currentDaXianIndex: number;
  currentDaXianLabelVi: string;
  daXianPrefix: string | null;
  daXianByStar: Record<string, SiHua>;
  daXianTags: string[];
} {
  const natalStem = chart.lunarInfo.yearStem;
  const natalStemVi = VI_STEMS[natalStem] ?? '';
  const natalPrefix = `[Tứ Hóa Bản Mệnh - Can ${natalStemVi}]`;
  const natalTransforms = getSiHuaByStem(natalStem);
  const natalByStar: Record<string, SiHua> = {};
  const natalTags: string[] = [];

  for (const sh of ['禄', '权', '科', '忌'] as SiHua[]) {
    const starCn = natalTransforms[sh];
    if (!starCn) continue;
    natalByStar[starCn] = sh;
    const targetPalace = chart.palaces.find((p) => p.stars.some((s) => s.name === starCn));
    const palaceLabel = targetPalace
      ? `${translatePalaceName(targetPalace.name)} (${VI_STEMS[targetPalace.stem]} ${VI_BRANCHES[targetPalace.branch]})`
      : 'Không xác định';
    natalTags.push(
      `${natalPrefix} ${translateStarName(starCn)} Hóa ${translateSiHua(sh)} → ${palaceLabel}`,
    );
  }

  const dxIdx =
    typeof chart.currentDaXianIndex === 'number' &&
    chart.currentDaXianIndex >= 0 &&
    chart.currentDaXianIndex < chart.daXians.length
      ? chart.currentDaXianIndex
      : -1;

  if (dxIdx < 0) {
    return {
      natalPrefix,
      natalByStar,
      natalTags,
      currentDaXianIndex: -1,
      currentDaXianLabelVi: 'Chưa vào Đại Hạn (giai đoạn trước tuổi khởi vận)',
      daXianPrefix: null,
      daXianByStar: {},
      daXianTags: [],
    };
  }

  const dx = chart.daXians[dxIdx];
  const dxYears = getDaXianYears(chart, dxIdx);
  const dxYearsText = dxYears.length > 0 ? `${dxYears[0]}–${dxYears[dxYears.length - 1]}` : '';
  const dxSiHua = getDaXianSiHua(chart, dxIdx);
  const dxStem = dxSiHua?.stemIndex ?? 0;
  const dxStemVi = VI_STEMS[dxStem] ?? '';
  const daXianPrefix = `[Tứ Hóa Đại Hạn HIỆN TẠI (${dx.startAge}–${dx.endAge} · Can ${dxStemVi})]`;
  const daXianByStar: Record<string, SiHua> = {};
  const daXianTags: string[] = [];

  if (dxSiHua) {
    for (const sh of ['禄', '权', '科', '忌'] as SiHua[]) {
      const starCn = dxSiHua.transforms[sh];
      if (!starCn) continue;
      daXianByStar[starCn] = sh;
      const targetPalace = chart.palaces.find((p) => p.stars.some((s) => s.name === starCn));
      const palaceLabel = targetPalace
        ? `${translatePalaceName(targetPalace.name)} (${VI_BRANCHES[targetPalace.branch]})`
        : 'Không xác định';
      daXianTags.push(
        `${daXianPrefix} ${translateStarName(starCn)} Hóa ${translateSiHua(sh)} → ${palaceLabel}`,
      );
    }
  }

  return {
    natalPrefix,
    natalByStar,
    natalTags,
    currentDaXianIndex: dxIdx,
    currentDaXianLabelVi: `Đại Hạn ${dx.startAge}–${dx.endAge} tuổi (${dxYearsText}) tại ${translatePalaceName(dx.palaceName)} (${VI_STEMS[dxStem]} ${VI_BRANCHES[dx.palaceBranch]})`,
    daXianPrefix,
    daXianByStar,
    daXianTags,
  };
}

const PATTERN_LEVEL_VI_MAP: Record<string, string> = {
  excellent: 'Thượng cách',
  good: 'Cát cách',
  neutral: 'Trung bình',
  bad: 'Hung cách',
  caution: 'Hung cách',
};

function translatePatternLevelVi(level: string): string {
  return PATTERN_LEVEL_VI_MAP[level] ?? level;
}

export interface NatalOverviewFactSheet {
  titleVi: string;
  natalSiHuaTags: string[];
  currentDaXianLabelVi: string;
  patternsVi: Array<{ name: string; level: string; description: string; palaces: string[] }>;
  factSheetMarkdown: string;
}

export function buildNatalOverviewFactSheetVi(chart: ZiweiChart): NatalOverviewFactSheet {
  const ming = chart.palaces.find((p) => p.branch === chart.mingGongBranch) ?? chart.palaces[0];
  const shen = chart.palaces.find((p) => p.branch === chart.shenGongBranch) ?? ming;
  const mingMajors = formatPalaceMajorsList(ming);
  const shenMajors = formatPalaceMajorsList(shen);
  const sihuaInfo = getAllSiHuaTagsForChart(chart);
  const patternsVi = detectPatterns(chart).map(localizePattern);

  const fourPillarsVi = chart.lunarInfo.fourPillars
    ? chart.lunarInfo.fourPillars.map(translateGanZhi).join(' · ')
    : 'Không có';

  const mingTamHopSpecs: Array<{ roleLabel: string; palace: Palace | undefined }> = [
    { roleLabel: 'Bản cung', palace: ming },
    { roleLabel: 'Tam hợp (+4)', palace: chart.palaces.find((p) => p.branch === (ming.branch + 4) % 12) },
    { roleLabel: 'Tam hợp (+8)', palace: chart.palaces.find((p) => p.branch === (ming.branch + 8) % 12) },
    { roleLabel: 'Xung chiếu (+6)', palace: chart.palaces.find((p) => p.branch === (ming.branch + 6) % 12) },
  ];

  const lines: string[] = [];
  lines.push(`**[CHƯƠNG 1 — TỔNG QUAN MỆNH CỤC & CÁCH CỤC TIÊN THIÊN]**`);
  lines.push(
    `• **Đương số**: ${chart.birthInfo.name || 'Ẩn danh'} | **Âm Dương Giới Tính**: ${translateYinYang(chart.yinYangGender)} | **Tuổi âm lịch hiện tại**: ${chart.currentAge} tuổi`,
  );
  lines.push(
    `• **Dương lịch**: ${chart.birthInfo.year}-${String(chart.birthInfo.month).padStart(2, '0')}-${String(chart.birthInfo.day).padStart(2, '0')} (${VI_BRANCHES[chart.birthInfo.hour]}) | **Âm lịch**: Năm ${VI_STEMS[chart.lunarInfo.yearStem]} ${VI_BRANCHES[chart.lunarInfo.yearBranch]} (${chart.lunarInfo.lunarYear}), tháng ${chart.lunarInfo.isLeapMonth ? 'nhuận ' : ''}${chart.lunarInfo.lunarMonth}, ngày ${chart.lunarInfo.lunarDay}`,
  );
  lines.push(`• **Tứ Trụ Bát Tự**: ${fourPillarsVi}`);
  lines.push(
    `• **Ngũ Hành Cục**: ${translateWuxingJu(chart.wuxingJuName)} | **Mệnh Chủ**: ${translateStarName(chart.mingZhu)} | **Thân Chủ**: ${translateStarName(chart.shenZhu)}`,
  );
  lines.push(
    `• **Cung An Mệnh**: ${translatePalaceName(ming.name)} (${VI_STEMS[ming.stem]} ${VI_BRANCHES[ming.branch]}) — Chính tinh: **${mingMajors.summaryVi}**`,
  );
  lines.push(
    `• **Cung An Thân**: cư tại **${translatePalaceName(shen.name)} (${VI_STEMS[shen.stem]} ${VI_BRANCHES[shen.branch]})** — Chính tinh: **${shenMajors.summaryVi}**`,
  );
  lines.push(`• **Đại Hạn hiện tại**: ${sihuaInfo.currentDaXianLabelVi}`);

  lines.push(`\n**[TAM PHƯƠNG TỨ CHÍNH CUNG MỆNH]**`);
  for (const item of mingTamHopSpecs) {
    const p = item.palace;
    if (!p) continue;
    const pm = formatPalaceMajorsList(p);
    const luckys = p.stars.filter((s) => s.type === 'lucky').map((s) => translateStarName(s.name));
    const shas = p.stars.filter((s) => s.type === 'sha').map((s) => translateStarName(s.name));
    lines.push(
      `• **[${item.roleLabel}] ${translatePalaceName(p.name)} (${VI_STEMS[p.stem]} ${VI_BRANCHES[p.branch]})**: Chính tinh ${pm.summaryVi} | Cát tinh: ${luckys.join(', ') || 'Không'} | Sát tinh: ${shas.join(', ') || 'Không'}`,
    );
  }

  lines.push(`\n**[HỆ THỐNG TỨ HÓA TIÊN THIÊN (CÓ TIỀN TỐ TẦNG TƯỜNG MINH)]**`);
  for (const tag of sihuaInfo.natalTags) {
    lines.push(`• ${tag}`);
  }
  if (sihuaInfo.daXianTags.length > 0) {
    lines.push(`\n**[TỨ HÓA ĐẠI HẠN HIỆN TẠI]**`);
    for (const tag of sihuaInfo.daXianTags) {
      lines.push(`• ${tag}`);
    }
  } else {
    lines.push(`\n**[TỨ HÓA ĐẠI HẠN HIỆN TẠI]**: Chưa vào Đại Hạn chính thức.`);
  }

  lines.push(`\n**[CÁCH CỤC NHẬN DIỆN TỪ ENGINE (patterns.ts)]**`);
  if (patternsVi.length > 0) {
    for (const pat of patternsVi.slice(0, 10)) {
      lines.push(
        `• **${pat.name}** [${translatePatternLevelVi(pat.level)}] (${pat.palaces.join(', ')}): ${pat.description}`,
      );
    }
  } else {
    lines.push('• Không có cách cục đặc biệt nổi trội ngoài cấu trúc chính tinh bản cung.');
  }

  return {
    titleVi: 'Chương 1 — Tổng Quan Mệnh Cục & Cách Cục Tiên Thiên',
    natalSiHuaTags: sihuaInfo.natalTags,
    currentDaXianLabelVi: sihuaInfo.currentDaXianLabelVi,
    patternsVi: patternsVi.map((p) => ({
      name: p.name,
      level: p.level,
      description: p.description,
      palaces: p.palaces,
    })),
    factSheetMarkdown: lines.join('\n'),
  };
}

export interface DossierPalaceDetailVi {
  canonicalKey: string;
  natalPalaceNameVi: string;
  branch: number;
  branchVi: string;
  ganZhiVi: string;
  roleDescVi: string;
  daXianAgeRangeVi: string | null;
  isMingGong: boolean;
  isShenGong: boolean;
  isEmpty: boolean;
  borrowedFromVi?: string;
  majorStarsVi: string[];
  luckyStarsVi: string[];
  shaStarsVi: string[];
  minorStarsVi: string[];
  tamPhuongTuChinh: {
    xungChieu: string;
    tamHopA: string;
    tamHopB: string;
  };
  siHuaTags: string[];
}

export interface PalaceGroupFactSheet {
  groupKey: PalaceGroupKey;
  sectionId: DossierSectionId;
  groupTitleVi: string;
  palaces: DossierPalaceDetailVi[];
  factSheetMarkdown: string;
}

export function buildPalaceGroupFactSheetVi(
  chart: ZiweiChart,
  groupKey: PalaceGroupKey,
): PalaceGroupFactSheet {
  const spec = DOSSIER_PALACE_GROUPS[groupKey];
  const sihuaInfo = getAllSiHuaTagsForChart(chart);
  const palaces: DossierPalaceDetailVi[] = [];
  const lines: string[] = [];

  const genderLabelVi =
    translateYinYang(chart.yinYangGender) ||
    (chart.birthInfo.gender === 'female' ? 'Nữ' : 'Nam');

  lines.push(`**[${spec.titleVi.toUpperCase()}]**`);
  lines.push(`*${spec.subtitleVi}*`);
  lines.push(`• Đương số: ${genderLabelVi}`);
  lines.push(`• **Ngữ cảnh Đại Hạn hiện tại**: ${sihuaInfo.currentDaXianLabelVi}`);

  const curDaXianIdx =
    typeof chart.currentDaXianIndex === 'number' ? chart.currentDaXianIndex : -1;
  const allowedDaXianBranches = new Set<number>();
  if (curDaXianIdx >= 0 && curDaXianIdx < chart.daXians.length) {
    allowedDaXianBranches.add(chart.daXians[curDaXianIdx].palaceBranch);
    if (curDaXianIdx + 1 < chart.daXians.length) {
      allowedDaXianBranches.add(chart.daXians[curDaXianIdx + 1].palaceBranch);
    }
  } else if (chart.daXians.length > 0) {
    allowedDaXianBranches.add(chart.daXians[0].palaceBranch);
  }

  for (const canonicalKey of spec.palaceKeys) {
    const aliases = spec.aliases[canonicalKey] ?? [canonicalKey];
    const p = findPalaceByCanonicalKey(chart, canonicalKey, aliases);
    if (!p) {
      throw new Error(`Không tìm thấy cung '${canonicalKey}' trong lá số.`);
    }

    const natalPalaceNameVi = translatePalaceName(p.name);
    const ganZhiVi = `${VI_STEMS[p.stem]} ${VI_BRANCHES[p.branch]}`;
    const roleDescVi =
      VI_PALACE_ROLES[p.name] ?? VI_PALACE_ROLES[canonicalKey] ?? 'Cung chức năng bản mệnh';
    const majorsInfo = formatPalaceMajorsList(p);
    const luckyStarsVi = p.stars
      .filter((s) => s.type === 'lucky')
      .map((s) => {
        const sh = s.siHua ? ` (Bản Mệnh Hóa ${translateSiHua(s.siHua)})` : '';
        return `${translateStarName(s.name)}${sh}`;
      });
    const shaStarsVi = p.stars.filter((s) => s.type === 'sha').map((s) => translateStarName(s.name));
    const minorStarsVi = p.stars
      .filter((s) => s.type === 'minor')
      .map((s) => translateStarName(s.name));

    const oppPalace = chart.palaces.find((x) => x.branch === (p.branch + 6) % 12);
    const thA = chart.palaces.find((x) => x.branch === (p.branch + 4) % 12);
    const thB = chart.palaces.find((x) => x.branch === (p.branch + 8) % 12);

    const fmtNeighbor = (np?: Palace): string => {
      if (!np) return 'Không rõ';
      const nm = formatPalaceMajorsList(np);
      return `${translatePalaceName(np.name)} (${VI_STEMS[np.stem]} ${VI_BRANCHES[np.branch]}): ${nm.summaryVi}`;
    };

    const siHuaTags: string[] = [];
    // 1. Tứ Hóa Bản Mệnh chạm cung này
    for (const s of p.stars) {
      const natalSh = sihuaInfo.natalByStar[s.name] ?? s.siHua;
      if (natalSh) {
        siHuaTags.push(
          `${sihuaInfo.natalPrefix} ${translateStarName(s.name)} Hóa ${translateSiHua(natalSh)} tọa thủ bản cung`,
        );
      }
      const dxSh = sihuaInfo.daXianByStar[s.name];
      if (dxSh && sihuaInfo.daXianPrefix) {
        siHuaTags.push(
          `${sihuaInfo.daXianPrefix} ${translateStarName(s.name)} Hóa ${translateSiHua(dxSh)} nhập bản cung`,
        );
      }
    }
    if (oppPalace) {
      for (const s of oppPalace.stars) {
        const natalSh = sihuaInfo.natalByStar[s.name] ?? s.siHua;
        if (natalSh === '忌') {
          siHuaTags.push(
            `${sihuaInfo.natalPrefix} ${translateStarName(s.name)} Hóa Kỵ từ đối cung ${translatePalaceName(oppPalace.name)} xung chiếu`,
          );
        }
        const dxSh = sihuaInfo.daXianByStar[s.name];
        if (dxSh === '忌' && sihuaInfo.daXianPrefix) {
          siHuaTags.push(
            `${sihuaInfo.daXianPrefix} ${translateStarName(s.name)} Hóa Kỵ từ đối cung ${translatePalaceName(oppPalace.name)} xung chiếu`,
          );
        }
      }
    }

    // 2. Tự Hóa Can Cung (Self-SiHua)
    const selfSihuas = detectSelfSihua(p);
    for (const sh of selfSihuas) {
      siHuaTags.push(
        `[Tự Hóa Can Cung ${ganZhiVi}] ${translateStarName(sh.starName)} Tự Hóa ${translateSiHua(sh.siHua)}`,
      );
    }

    if (sihuaInfo.currentDaXianIndex < 0) {
      siHuaTags.push('[Tứ Hóa Đại Hạn] Chưa vào Đại Hạn nên không kích hoạt Tứ Hóa Đại Hạn.');
    }

    // 3. Tham khảo phi hóa từ can cung hiện tại sang các cung khác (A1: chỉ nạp cho cung Mệnh)
    const flyNotes: string[] = [];
    if (p.isMingGong) {
      const palaceFlyTransforms = getSiHuaByStem(p.stem);
      for (const sh of ['禄', '忌'] as SiHua[]) {
        const targetStarCn = palaceFlyTransforms[sh];
        const targetPal = chart.palaces.find((x) => x.stars.some((st) => st.name === targetStarCn));
        if (targetPal) {
          flyNotes.push(
            `[Phi Tinh Can Cung ${natalPalaceNameVi} (${VI_STEMS[p.stem]})] ${translateStarName(targetStarCn)} Hóa ${translateSiHua(sh)} nhập ${translatePalaceName(targetPal.name)} (${VI_BRANCHES[targetPal.branch]})`,
          );
        }
      }
    }

    const detail: DossierPalaceDetailVi = {
      canonicalKey,
      natalPalaceNameVi,
      branch: p.branch,
      branchVi: VI_BRANCHES[p.branch],
      ganZhiVi,
      roleDescVi,
      daXianAgeRangeVi: p.daXianAge ? `${p.daXianAge[0]}–${p.daXianAge[1]} tuổi` : null,
      isMingGong: Boolean(p.isMingGong),
      isShenGong: Boolean(p.isShenGong),
      isEmpty: Boolean(p.isEmpty),
      borrowedFromVi: p.isEmpty ? translatePalaceName(p.borrowedFromName) : undefined,
      majorStarsVi: majorsInfo.starsVi,
      luckyStarsVi,
      shaStarsVi,
      minorStarsVi,
      tamPhuongTuChinh: {
        xungChieu: fmtNeighbor(oppPalace),
        tamHopA: fmtNeighbor(thA),
        tamHopB: fmtNeighbor(thB),
      },
      siHuaTags: [...siHuaTags, ...flyNotes],
    };
    palaces.push(detail);

    const lendingNoteVi =
      !p.isEmpty && oppPalace?.isEmpty
        ? ` (Chính tinh tại cung này được đối cung ${translatePalaceName(oppPalace.name)} vô chính diệu mượn để tham chiếu; cung này KHÔNG mượn sao của ${translatePalaceName(oppPalace.name)}.)`
        : '';

    const daXianRange = p.daXianAge ?? (() => {
      const dx = chart.daXians.find((d) => d.palaceBranch === p.branch);
      return dx ? ([dx.startAge, dx.endAge] as [number, number]) : null;
    })();
    let daXianPeriodSiHuaLine = '';
    if (daXianRange && allowedDaXianBranches.has(p.branch)) {
      const dxStemVi = VI_STEMS[p.stem] ?? '';
      const periodTransforms = getSiHuaByStem(p.stem);
      const periodSiHuaParts = (['禄', '权', '科', '忌'] as SiHua[])
        .map((sh) => {
          const starCn = periodTransforms[sh];
          if (!starCn) return null;
          const targetPal = chart.palaces.find((x) => x.stars.some((st) => st.name === starCn));
          const targetPalName = targetPal ? translatePalaceName(targetPal.name) : 'Không xác định';
          return `${translateStarName(starCn)} Hóa ${translateSiHua(sh)} → ${targetPalName}`;
        })
        .filter((x): x is string => Boolean(x));
      if (periodSiHuaParts.length > 0) {
        daXianPeriodSiHuaLine = `• [Tứ Hóa Đại Hạn Kỳ ${daXianRange[0]}–${daXianRange[1]} (đóng tại ${natalPalaceNameVi} · Can ${dxStemVi})] ${periodSiHuaParts.join('; ')}`;
      }
    }

    lines.push(`\n${formatCanonicalPalaceHeading(p)}`);
    lines.push(`• **Chức năng**: ${roleDescVi}`);
    lines.push(`• **Chính tinh**: **${majorsInfo.summaryVi}**${lendingNoteVi}`);
    lines.push(
      `• **Cát tinh / Trợ tinh**: ${luckyStarsVi.join(', ') || 'Không'} | **Sát tinh**: ${shaStarsVi.join(', ') || 'Không'} | **Tạp diệu**: ${minorStarsVi.join(', ') || 'Không'}`,
    );
    lines.push(
      `• **Tam Phương Tứ Chính**: Đối cung **${detail.tamPhuongTuChinh.xungChieu}** | Tam hợp **${detail.tamPhuongTuChinh.tamHopA}** & **${detail.tamPhuongTuChinh.tamHopB}**`,
    );
    lines.push(
      `• **Tứ Hóa & Phi Tinh liên hệ**: ${detail.siHuaTags.length > 0 ? detail.siHuaTags.join(' ; ') : 'Không có Tứ Hóa trực tiếp trên bản cung.'}`,
    );
    if (daXianPeriodSiHuaLine) {
      lines.push(daXianPeriodSiHuaLine);
    }

    const starNotes = majorsInfo.rawMajorNames
      .map((cn) => {
        const d = STAR_DESCRIPTIONS[cn];
        return d ? `${translateStarName(cn)} (${d.element}, ${d.nature}): ${d.keywords}` : null;
      })
      .filter((x): x is string => Boolean(x));
    if (starNotes.length > 0) {
      lines.push(`• **Tính chất chính tinh**: ${starNotes.join(' | ')}`);
    }
  }

  return {
    groupKey,
    sectionId: spec.sectionId,
    groupTitleVi: spec.titleVi,
    palaces,
    factSheetMarkdown: lines.join('\n'),
  };
}

export function formatCanonicalPalaceHeading(
  p: Palace,
  options?: { chart?: ZiweiChart; onlyCurrentAndNextDaXian?: boolean },
): string {
  const natalPalaceNameVi = translatePalaceName(p.name);
  const headingPalaceLabel =
    natalPalaceNameVi === 'Mệnh Cung' ? 'Cung Mệnh' : `Cung ${natalPalaceNameVi}`;
  const ganZhiVi = `${VI_STEMS[p.stem]} ${VI_BRANCHES[p.branch]}`;
  let includeDaXianBadge = true;
  if (options?.onlyCurrentAndNextDaXian && options.chart) {
    const curIdx =
      typeof options.chart.currentDaXianIndex === 'number'
        ? options.chart.currentDaXianIndex
        : -1;
    const allowedBranches = new Set<number>();
    if (curIdx >= 0 && curIdx < options.chart.daXians.length) {
      allowedBranches.add(options.chart.daXians[curIdx].palaceBranch);
      if (curIdx + 1 < options.chart.daXians.length) {
        allowedBranches.add(options.chart.daXians[curIdx + 1].palaceBranch);
      }
    } else if (options.chart.daXians.length > 0) {
      allowedBranches.add(options.chart.daXians[0].palaceBranch);
    }
    includeDaXianBadge = allowedBranches.has(p.branch);
  }
  const daXianAgeRangeVi =
    includeDaXianBadge && p.daXianAge ? `${p.daXianAge[0]}–${p.daXianAge[1]} tuổi` : null;
  const badges = [
    p.isMingGong ? '[AN MỆNH]' : '',
    p.isShenGong ? '[AN THÂN]' : '',
    daXianAgeRangeVi ? `[Đại hạn ${daXianAgeRangeVi}]` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return `### ${headingPalaceLabel} (${ganZhiVi}) ${badges}`.trim();
}

export interface MultiYearSiHuaEntry extends PeriodSiHuaImpact {
  layerPrefix: string;
}

export interface MultiYearHorizonRow {
  // (1) Năm + Can Chi
  year: number;
  lunarStemVi: string;
  lunarBranchVi: string;
  lunarGanZhiVi: string;
  // (2) Tuổi danh nghĩa
  nominalAge: number;
  // (3) Đại Hạn chủ quản
  governingDaXian: {
    daXianIndex: number;
    isPreDaXian: boolean;
    labelVi: string;
    ageRangeVi: string;
    yearRangeVi: string;
    palaceNameVi: string;
    ganZhiVi: string;
    siHuaPrefixTag: string | null;
    siHuaSummaryVi: string;
  };
  isDaXianTransitionYear: boolean;
  // (4) Quan hệ Đại Hạn - Lưu Niên
  daXianLiuNianRelationVi: string;
  // (5) Cung Bản Mệnh kích hoạt
  activatedPalace: {
    branch: number;
    branchVi: string;
    natalPalaceNameVi: string;
    ganZhiVi: string;
    majorStarsVi: string[];
    majorStarsSummaryVi: string;
    luckyStarsVi: string[];
    shaStarsVi: string[];
    oppositeSummaryVi: string;
    caiBoSummaryVi: string;
    guanLuSummaryVi: string;
    fuQiSummaryVi: string;
  };
  // (6) Bộ Lưu Tứ Hóa đầy đủ cả 4
  liuNianSiHua: {
    loc: MultiYearSiHuaEntry;
    quyen: MultiYearSiHuaEntry;
    khoa: MultiYearSiHuaEntry;
    ky: MultiYearSiHuaEntry;
    allFour: MultiYearSiHuaEntry[];
  };
  // (7) Sao lưu động chính
  dynamicStars: PeriodDynamicStarItem[];
  dynamicStarsSummaryVi: string;
  // (8) Cờ xung hợp nổi bật (chỉ xuất hiện khi dữ kiện xác định có)
  highlightFlags: string[];
}

export interface MultiYearHorizonContext {
  startYear: number;
  endYear: number;
  rows: MultiYearHorizonRow[];
  daXianTransitions: Array<{ year: number; descriptionVi: string }>;
  compactMatrixMarkdown: string;
  factSheetMarkdown: string;
}

export function buildMultiYearHorizonContext(
  chart: ZiweiChart,
  startYear: number,
  endYear: number,
): MultiYearHorizonContext {
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear < startYear) {
    throw new Error(`Khoảng năm không hợp lệ: ${startYear}–${endYear}`);
  }

  const rows: MultiYearHorizonRow[] = [];
  const daXianTransitions: Array<{ year: number; descriptionVi: string }> = [];

  let prevDxIdx = resolveEffectiveDaXianIndex(chart, 'liunian', startYear - 1);

  for (let year = startYear; year <= endYear; year += 1) {
    const stemIdx = getYearStemIndex(year);
    const branchIdx = getYearBranchIndex(year);
    const lunarStemVi = VI_STEMS[stemIdx] ?? '';
    const lunarBranchVi = VI_BRANCHES[branchIdx] ?? '';
    const lunarGanZhiVi = `${lunarStemVi} ${lunarBranchVi}`;
    const nominalAge = year - chart.lunarInfo.lunarYear + 1;

    const effDxIdx = resolveEffectiveDaXianIndex(chart, 'liunian', year);
    const isDaXianTransitionYear =
      effDxIdx >= 0 && effDxIdx !== prevDxIdx && year > chart.lunarInfo.lunarYear;
    prevDxIdx = effDxIdx;

    const periodCtx = buildYunxianPeriodContext(chart, {
      mode: 'liunian',
      year,
    });
    if (!periodCtx) {
      throw new Error(`Không thể tính ngữ cảnh Lưu Niên cho năm ${year}.`);
    }

    let governingDaXian: MultiYearHorizonRow['governingDaXian'];
    let daXianLiuNianRelationVi: string;
    const dxSiHuaMap: Record<string, SiHua> = {};

    if (effDxIdx >= 0 && chart.daXians[effDxIdx]) {
      const dx = chart.daXians[effDxIdx];
      const dxYears = getDaXianYears(chart, effDxIdx);
      const dxYearsStr = dxYears.length > 0 ? `${dxYears[0]}–${dxYears[dxYears.length - 1]}` : '';
      const dxPalace = chart.palaces.find((p) => p.branch === dx.palaceBranch) ?? chart.palaces[0];
      const dxPalaceNameVi = translatePalaceName(dxPalace.name);
      const dxGanZhiVi = `${VI_STEMS[dxPalace.stem]} ${VI_BRANCHES[dxPalace.branch]}`;
      const dxSiHua = getDaXianSiHua(chart, effDxIdx, year);
      const isCurrentDaXian = effDxIdx === chart.currentDaXianIndex;
      const dxPrefix = isCurrentDaXian
        ? `[Tứ Hóa Đại Hạn HIỆN TẠI (${dx.startAge}–${dx.endAge} · Can ${VI_STEMS[dxPalace.stem]})]`
        : `[Tứ Hóa Đại Hạn Kỳ ${dx.startAge}–${dx.endAge} (đóng tại ${dxPalaceNameVi} · Can ${VI_STEMS[dxPalace.stem]})]`;
      let dxSiHuaSummaryVi = `${dxPrefix} Không xác định`;
      if (dxSiHua) {
        const parts: string[] = [];
        for (const sh of ['禄', '权', '科', '忌'] as SiHua[]) {
          const starCn = dxSiHua.transforms[sh];
          if (starCn) {
            dxSiHuaMap[starCn] = sh;
            parts.push(`${translateStarName(starCn)} Hóa ${translateSiHua(sh)}`);
          }
        }
        dxSiHuaSummaryVi = `${dxPrefix} ${parts.join(' · ')}`;
      }
      governingDaXian = {
        daXianIndex: effDxIdx,
        isPreDaXian: false,
        labelVi: `Đại Hạn ${dx.startAge}–${dx.endAge} tuổi (${dxYearsStr}) tại ${dxPalaceNameVi} (${dxGanZhiVi})`,
        ageRangeVi: `${dx.startAge}–${dx.endAge} tuổi`,
        yearRangeVi: dxYearsStr,
        palaceNameVi: dxPalaceNameVi,
        ganZhiVi: dxGanZhiVi,
        siHuaPrefixTag: dxPrefix,
        siHuaSummaryVi: dxSiHuaSummaryVi,
      };
      daXianLiuNianRelationVi =
        periodCtx.parentDaXian?.relationWithLiuNianVi ??
        'Lưu Niên vận hành trong khung Đại Hạn hiện hành';

      if (isDaXianTransitionYear) {
        daXianTransitions.push({
          year,
          descriptionVi: `Năm ${year} (${lunarGanZhiVi}, ${nominalAge} tuổi): chuyển sang ${governingDaXian.labelVi}`,
        });
      }
    } else {
      const childNote = isChildhoodYear(chart, year)
        ? 'chưa vào Đại Hạn (giai đoạn Đồng Hạn trước tuổi khởi vận)'
        : 'chưa vào Đại Hạn';
      governingDaXian = {
        daXianIndex: -1,
        isPreDaXian: true,
        labelVi: childNote,
        ageRangeVi: 'chưa vào Đại Hạn',
        yearRangeVi: 'chưa vào Đại Hạn',
        palaceNameVi: 'chưa vào Đại Hạn',
        ganZhiVi: 'chưa vào Đại Hạn',
        siHuaPrefixTag: null,
        siHuaSummaryVi: 'chưa vào Đại Hạn',
      };
      daXianLiuNianRelationVi = 'chưa vào Đại Hạn — luận trực tiếp Lưu Niên lên Bản Mệnh';
    }

    // Cung Lưu Niên Mệnh / Thiên Di / Tài Bạch / Quan Lộc / Phu Thê
    const lnPalaceByOffset = (offset: number): string => {
      const targetBranch = (branchIdx + offset) % 12;
      const np = chart.palaces.find((p) => p.branch === targetBranch) ?? chart.palaces[0];
      const mj = formatPalaceMajorsList(np);
      return `${translatePalaceName(np.name)} (${VI_STEMS[np.stem]} ${VI_BRANCHES[np.branch]}): ${mj.summaryVi}`;
    };

    const lnMingPalace = chart.palaces.find((p) => p.branch === branchIdx) ?? chart.palaces[0];
    const lnMingMajors = formatPalaceMajorsList(lnMingPalace);

    const lnPrefix = `[Tứ Hóa Lưu Niên ${year} - Can ${lunarStemVi}]`;
    const getFallbackRoleVi = (targetBranch: number): string => {
      const offset = ((branchIdx - targetBranch) % 12 + 12) % 12;
      return `Lưu ${translatePalaceName(PALACE_NAMES_ORDER[offset] ?? '命宫')}`;
    };

    const mapSiHuaEntry = (key: SiHua): MultiYearSiHuaEntry => {
      const item = periodCtx.periodSiHua.find((x) => x.mutagenKey === key);
      if (!item) {
        const fallbackTransforms = getLiuNianSiHua(year).transforms;
        const starCn = fallbackTransforms[key] ?? '';
        const starVi = translateStarName(starCn);
        const targetPal = chart.palaces.find((p) => p.stars.some((s) => s.name === starCn)) ?? lnMingPalace;
        const targetStar = targetPal.stars.find((s) => s.name === starCn);
        const oppBranch = (targetPal.branch + 6) % 12;
        const oppPal = chart.palaces.find((p) => p.branch === oppBranch) ?? lnMingPalace;
        const periodPalaceRoleVi = getFallbackRoleVi(targetPal.branch);
        const oppositePeriodPalaceRoleVi = getFallbackRoleVi(oppBranch);
        const natalPalaceNameVi = translatePalaceName(targetPal.name);
        const oppositePalaceNameVi = translatePalaceName(oppPal.name);
        const mutagenVi = `Hóa ${translateSiHua(key)}`;
        return {
          mutagenKey: key,
          mutagenVi,
          layerPrefix: lnPrefix,
          starNameCn: starCn,
          starNameVi: starVi,
          brightnessVi: targetStar?.brightnessRaw ? translateBrightness(targetStar.brightnessRaw) : 'Bình',
          natalPalaceNameVi,
          natalPalaceBranch: targetPal.branch,
          natalPalaceGanZhiVi: `${VI_STEMS[targetPal.stem]} ${VI_BRANCHES[targetPal.branch]}`,
          periodPalaceRoleVi,
          oppositePalaceNameVi,
          oppositePalaceGanZhiVi: `${VI_STEMS[oppPal.stem]} ${VI_BRANCHES[oppPal.branch]}`,
          oppositePeriodPalaceRoleVi,
          natalMutagenVi: targetStar?.siHua ? `Bản mệnh Hóa ${translateSiHua(targetStar.siHua)}` : undefined,
          resonanceNoteVi: `Lưu ${mutagenVi} kích hoạt sao ${starVi} tại Cung ${periodPalaceRoleVi} (trùng ${natalPalaceNameVi}), xung chiếu Cung ${oppositePeriodPalaceRoleVi} (trùng ${oppositePalaceNameVi})`,
          periodStemVi: lunarStemVi,
        };
      }
      return {
        ...item,
        layerPrefix: lnPrefix,
      };
    };

    const loc = mapSiHuaEntry('禄');
    const quyen = mapSiHuaEntry('权');
    const khoa = mapSiHuaEntry('科');
    const ky = mapSiHuaEntry('忌');
    const allFour = [loc, quyen, khoa, ky];

    const dynamicStarsSummaryVi = periodCtx.dynamicStars
      .filter((d) =>
        ['Lộc Tồn', 'Thiên Mã', 'Kình Dương', 'Đà La', 'Hồng Loan', 'Thiên Hỷ'].some((tag) =>
          d.starLabelVi.endsWith(tag),
        ),
      )
      .map((d) => `${d.starLabelVi} tại Cung ${d.periodPalaceRoleVi} (${d.natalPalaceNameVi} - ${d.branchVi})`)
      .join(' · ');

    // (8) Cờ xung hợp nổi bật — CHỈ phát sinh khi dữ kiện xác định thỏa mãn
    const highlightFlags: string[] = [];
    if (isDaXianTransitionYear) {
      highlightFlags.push(`Năm chuyển giao Đại Hạn mới (${governingDaXian.labelVi})`);
    }
    if (effDxIdx >= 0 && chart.daXians[effDxIdx]) {
      const dxBranch = chart.daXians[effDxIdx].palaceBranch;
      const diff = ((branchIdx - dxBranch) % 12 + 12) % 12;
      if (diff === 0) {
        highlightFlags.push(`Lưu Niên trùng phùng cung Đại Hạn (${governingDaXian.palaceNameVi})`);
      } else if (diff === 6) {
        highlightFlags.push(`Lưu Niên xung chiếu trực tiếp Đại Hạn (${governingDaXian.palaceNameVi})`);
      }
    }

    // Kiểm tra Song Lộc / Song Kỵ giữa Lưu Niên với Bản Mệnh & Đại Hạn
    const lnTransforms = getLiuNianSiHua(year).transforms;
    const locStarCn = lnTransforms['禄'];
    const kyStarCn = lnTransforms['忌'];

    if (loc.natalMutagenVi === 'Bản mệnh Hóa Lộc') {
      highlightFlags.push(
        `Song Lộc trùng phùng (Lưu Lộc + Bản Mệnh Lộc trên ${loc.starNameVi} tại ${loc.natalPalaceNameVi})`,
      );
    } else if (dxSiHuaMap[locStarCn] === '禄') {
      highlightFlags.push(
        `Song Lộc Đại Hạn – Lưu Niên (cùng Hóa Lộc ${loc.starNameVi} tại ${loc.natalPalaceNameVi})`,
      );
    }

    if (ky.natalMutagenVi === 'Bản mệnh Hóa Kỵ') {
      highlightFlags.push(
        `Song Kỵ trùng phùng (Lưu Kỵ + Bản Mệnh Kỵ trên ${ky.starNameVi} tại ${ky.natalPalaceNameVi}, xung ${ky.oppositePalaceNameVi})`,
      );
    } else if (dxSiHuaMap[kyStarCn] === '忌') {
      highlightFlags.push(
        `Song Kỵ Đại Hạn – Lưu Niên (cùng Hóa Kỵ ${ky.starNameVi} tại ${ky.natalPalaceNameVi}, xung ${ky.oppositePalaceNameVi})`,
      );
    }

    const locTonItem = periodCtx.dynamicStars.find((d) => d.starLabelVi.endsWith('Lộc Tồn'));
    const tianMaItem = periodCtx.dynamicStars.find((d) => d.starLabelVi.endsWith('Thiên Mã'));
    if (locTonItem && tianMaItem) {
      const dist = ((locTonItem.branch - tianMaItem.branch) % 12 + 12) % 12;
      if (dist === 0) {
        highlightFlags.push(
          `Lộc Mã giao trì đồng cung (${locTonItem.natalPalaceNameVi} · ${locTonItem.branchVi})`,
        );
      } else if (dist === 6) {
        highlightFlags.push(
          `Lộc Mã đối chiếu (${locTonItem.natalPalaceNameVi} ↔ ${tianMaItem.natalPalaceNameVi})`,
        );
      }
    }

    rows.push({
      year,
      lunarStemVi,
      lunarBranchVi,
      lunarGanZhiVi,
      nominalAge,
      governingDaXian,
      isDaXianTransitionYear,
      daXianLiuNianRelationVi,
      activatedPalace: {
        branch: branchIdx,
        branchVi: lunarBranchVi,
        natalPalaceNameVi: periodCtx.activatedPalace.natalPalaceNameVi,
        ganZhiVi: periodCtx.activatedPalace.ganZhiVi,
        majorStarsVi: lnMingMajors.starsVi,
        majorStarsSummaryVi: periodCtx.activatedPalace.majorStarsSummaryVi,
        luckyStarsVi: periodCtx.activatedPalace.luckyStarsVi,
        shaStarsVi: periodCtx.activatedPalace.shaStarsVi,
        oppositeSummaryVi: lnPalaceByOffset(6),
        caiBoSummaryVi: lnPalaceByOffset(8),
        guanLuSummaryVi: lnPalaceByOffset(4),
        fuQiSummaryVi: lnPalaceByOffset(10),
      },
      liuNianSiHua: {
        loc,
        quyen,
        khoa,
        ky,
        allFour,
      },
      dynamicStars: periodCtx.dynamicStars,
      dynamicStarsSummaryVi,
      highlightFlags,
    });
  }

  const compactLines: string[] = [];
  compactLines.push(`**[MA TRẬN DỮ KIỆN RÚT GỌN ${startYear}–${endYear} (ĐỦ 4 HÓA + NHÃN LƯU NIÊN + ĐẠI HẠN CHỦ QUẢN)]**`);
  for (const r of rows) {
    const shLine = r.liuNianSiHua.allFour
      .map(
        (s) =>
          `${s.mutagenVi}: ${s.starNameVi} tại Cung ${s.periodPalaceRoleVi} [trùng ${s.natalPalaceNameVi}] (xung Cung ${s.oppositePeriodPalaceRoleVi} [trùng ${s.oppositePalaceNameVi}])`,
      )
      .join(' | ');
    const flagStr = r.highlightFlags.length > 0 ? ` | Cờ: ${r.highlightFlags.join('; ')}` : '';
    compactLines.push(
      `• **${r.year} (${r.lunarGanZhiVi} · ${r.nominalAge}t)** | ĐH: ${r.governingDaXian.labelVi} | Cung Lưu Mệnh Cung kích hoạt Bản Mệnh: ${r.activatedPalace.natalPalaceNameVi} (${r.activatedPalace.majorStarsSummaryVi}) | ${r.liuNianSiHua.loc.layerPrefix} ${shLine} | Sao lưu: ${r.dynamicStarsSummaryVi}${flagStr}`,
    );
  }

  const detailLines: string[] = [];
  detailLines.push(
    `**[MA TRẬN TẦM NHÌN ${startYear}–${endYear} (${rows.length} NĂM XÁC ĐỊNH TỪ ENGINE)]**`,
  );
  if (daXianTransitions.length > 0) {
    detailLines.push(`• **Mốc chuyển giao Đại Hạn phát hiện được**:`);
    for (const tr of daXianTransitions) {
      detailLines.push(`  - ${tr.descriptionVi}`);
    }
  } else {
    detailLines.push(`• **Mốc chuyển giao Đại Hạn**: Không có chuyển Đại Hạn trong khoảng ${startYear}–${endYear}.`);
  }

  for (const r of rows) {
    detailLines.push(`\n### Năm ${r.year} — ${r.lunarGanZhiVi} (${r.nominalAge} tuổi âm lịch)`);
    if (r.activatedPalace.branch === chart.mingGongBranch) {
      detailLines.push(
        `*(Lưu Mệnh trùng Mệnh gốc tại ${r.activatedPalace.branchVi} nên cả 12 cung Lưu Niên năm này trùng tên với 12 cung Bản Mệnh)*`,
      );
    }
    detailLines.push(`• **(1–2) Năm & Tuổi**: ${r.year} (${r.lunarGanZhiVi}) · ${r.nominalAge} tuổi`);
    detailLines.push(
      `• **(3) Đại Hạn chủ quản**: ${r.governingDaXian.labelVi}${r.governingDaXian.isPreDaXian ? '' : ` · ${r.governingDaXian.siHuaSummaryVi}`}`,
    );
    detailLines.push(`• **(4) Quan hệ Đại Hạn – Lưu Niên**: ${r.daXianLiuNianRelationVi}`);
    detailLines.push(
      `• **(5) Trục Lưu Niên & Cung Bản Mệnh kích hoạt (Cung Lưu Mệnh Cung tại ${r.activatedPalace.branchVi})**: Trùng bản mệnh **${r.activatedPalace.natalPalaceNameVi} (${r.activatedPalace.ganZhiVi})** — Chính tinh: **${r.activatedPalace.majorStarsSummaryVi}** | Cát: ${r.activatedPalace.luckyStarsVi.join(', ') || 'Không'} | Sát: ${r.activatedPalace.shaStarsVi.join(', ') || 'Không'} | Đối cung (Cung Lưu Thiên Di): ${r.activatedPalace.oppositeSummaryVi} | Cung Lưu Quan Lộc: ${r.activatedPalace.guanLuSummaryVi} | Cung Lưu Tài Bạch: ${r.activatedPalace.caiBoSummaryVi} | Cung Lưu Phu Thê: ${r.activatedPalace.fuQiSummaryVi}`,
    );
    detailLines.push(
      `• **(6) Bộ Lưu Tứ Hóa (${r.liuNianSiHua.loc.layerPrefix})**: ${r.liuNianSiHua.allFour
        .map(
          (s) =>
            `**${s.starNameVi} [${s.brightnessVi}] ${s.mutagenVi}** tại **Cung ${s.periodPalaceRoleVi}** [trùng bản mệnh **${s.natalPalaceNameVi} (${s.natalPalaceGanZhiVi})**] (xung **Cung ${s.oppositePeriodPalaceRoleVi}** [trùng **${s.oppositePalaceNameVi} (${s.oppositePalaceGanZhiVi})**])${s.natalMutagenVi ? ` [${s.natalMutagenVi}]` : ''}`,
        )
        .join(' ; ')}`,
    );
    detailLines.push(
      `• **(7) Sao lưu động chính**: ${periodCtxLabelDynStars(r.dynamicStars)}`,
    );
    detailLines.push(
      `• **(8) Cờ xung hợp nổi bật**: ${r.highlightFlags.length > 0 ? r.highlightFlags.join(' ; ') : 'Không có cờ trùng điệp đặc biệt.'}`,
    );
  }

  return {
    startYear,
    endYear,
    rows,
    daXianTransitions,
    compactMatrixMarkdown: compactLines.join('\n'),
    factSheetMarkdown: detailLines.join('\n'),
  };
}

export function periodCtxLabelDynStars(dynamicStars: PeriodDynamicStarItem[]): string {
  return dynamicStars
    .map((d) => `${d.starLabelVi} tại Cung ${d.periodPalaceRoleVi} (${d.natalPalaceNameVi} - ${d.natalGanZhiVi})`)
    .join(' · ');
}

export interface DossierSectionContextResult {
  sectionId: DossierSectionId;
  titleVi: string;
  factSheetMarkdown: string;
  expectedMinWords: number;
  expectedMaxWords: number;
  palaceNamesVi?: string[];
  horizon?: MultiYearHorizonContext;
}

export function buildDossierSectionFactSheetVi(
  chart: ZiweiChart,
  sectionId: DossierSectionId,
): DossierSectionContextResult {
  switch (sectionId) {
    case 'chapter_overview': {
      const overview = buildNatalOverviewFactSheetVi(chart);
      return {
        sectionId,
        titleVi: overview.titleVi,
        factSheetMarkdown: overview.factSheetMarkdown,
        expectedMinWords: 750,
        expectedMaxWords: 1100,
      };
    }
    case 'palaces_core': {
      const grp = buildPalaceGroupFactSheetVi(chart, 'core');
      return {
        sectionId,
        titleVi: grp.groupTitleVi,
        factSheetMarkdown: grp.factSheetMarkdown,
        expectedMinWords: 800,
        expectedMaxWords: 1100,
        palaceNamesVi: grp.palaces.map((p) => p.natalPalaceNameVi),
      };
    }
    case 'palaces_family': {
      const grp = buildPalaceGroupFactSheetVi(chart, 'family');
      return {
        sectionId,
        titleVi: grp.groupTitleVi,
        factSheetMarkdown: grp.factSheetMarkdown,
        expectedMinWords: 800,
        expectedMaxWords: 1100,
        palaceNamesVi: grp.palaces.map((p) => p.natalPalaceNameVi),
      };
    }
    case 'palaces_social_health': {
      const grp = buildPalaceGroupFactSheetVi(chart, 'social_health');
      return {
        sectionId,
        titleVi: grp.groupTitleVi,
        factSheetMarkdown: grp.factSheetMarkdown,
        expectedMinWords: 800,
        expectedMaxWords: 1100,
        palaceNamesVi: grp.palaces.map((p) => p.natalPalaceNameVi),
      };
    }
    case 'horizon_5y': {
      const horizon = buildMultiYearHorizonContext(chart, 2026, 2030);
      return {
        sectionId,
        titleVi: 'Chiến Lược Trung Hạn 5 Năm (2026–2030)',
        factSheetMarkdown: horizon.factSheetMarkdown,
        expectedMinWords: 1600,
        expectedMaxWords: 1900,
        horizon,
      };
    }
    case 'horizon_10y': {
      const horizon = buildMultiYearHorizonContext(chart, 2026, 2035);
      return {
        sectionId,
        titleVi: 'Đại Cục Tầm Nhìn 10 Năm (2026–2035)',
        factSheetMarkdown: `${horizon.compactMatrixMarkdown}\n\n${horizon.factSheetMarkdown}`,
        expectedMinWords: 1500,
        expectedMaxWords: 1700,
        horizon,
      };
    }
  }
}

export function buildChatFactTableForContextVi(
  chart: ZiweiChart,
  options?: {
    contextMode?: 'natal' | 'period' | 'heming';
    periodContext?: YunxianPeriodContext | null;
    chartB?: ZiweiChart | null;
    includeHorizonStart?: number;
    includeHorizonEnd?: number;
  },
): string {
  const sections: string[] = [];
  const sihuaInfo = getAllSiHuaTagsForChart(chart);

  sections.push('=== TÓM TẮT LÁ SỐ BẢN MỆNH ===');
  sections.push(formatChartSummaryVi(chart));
  sections.push('\n=== TỨ HÓA CÓ TIỀN TỐ TẦNG ===');
  sections.push(sihuaInfo.natalTags.join('\n'));
  sections.push(`Đại Hạn hiện tại: ${sihuaInfo.currentDaXianLabelVi}`);
  if (sihuaInfo.daXianTags.length > 0) {
    sections.push(sihuaInfo.daXianTags.join('\n'));
  }

  if (options?.periodContext) {
    sections.push('\n=== NGỮ CẢNH KỲ HẠN ĐANG XEM ===');
    sections.push(options.periodContext.factTableMarkdown);
  }

  if (options?.chartB) {
    const sihuaB = getAllSiHuaTagsForChart(options.chartB);
    sections.push('\n=== LÁ SỐ ĐƯƠNG SỐ B (HỢP BÀN) ===');
    sections.push(formatChartSummaryVi(options.chartB));
    sections.push(sihuaB.natalTags.join('\n'));
  }

  const hStart = options?.includeHorizonStart ?? 2026;
  const hEnd = options?.includeHorizonEnd ?? 2035;
  if (hEnd >= hStart) {
    const horizon = buildMultiYearHorizonContext(chart, hStart, hEnd);
    sections.push(`\n=== ${horizon.compactMatrixMarkdown}`);
  }

  return sections.join('\n');
}
