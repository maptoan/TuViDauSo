import type { Palace, SiHua, ZiweiChart } from '../../src/lib/ziwei/types.ts';
import type { DossierSectionId } from '../../src/lib/ziwei/dossier-context.ts';
import { DOSSIER_PALACE_GROUPS } from '../../src/lib/ziwei/dossier-context.ts';
import { detectPatterns } from '../../src/lib/ziwei/patterns.ts';
import { getDaXianSiHua, getSiHuaByStem } from '../../src/lib/ziwei/sihua.ts';
import {
  CN_TO_VI_PALACE,
  CN_TO_VI_STAR,
  PATTERN_NAME_VI,
  VI_BRANCHES,
  localizePattern,
  translatePalaceName,
  translateSiHua,
  translateStarName,
} from '../../src/lib/ziwei/vi-i18n.ts';
import type { YunxianPeriodContext } from '../../src/lib/ziwei/yunxian-context.ts';
import { getKnowledgeBaseSnapshot } from './loader.ts';
import type {
  DistilledKnowledgeEntry,
  KnowledgeCoverageStatus,
  KnowledgeDossierTargetSection,
  KnowledgeRetrievalResult,
  KnowledgeScoredEntry,
  KnowledgeSiHuaMutagenVi,
} from './types.ts';

export const KB_BUDGET_LIMITS = {
  chapter_overview: { maxEntries: 8, maxChars: 2400 },
  palaces_core: { maxEntries: 12, maxChars: 3200 },
  palaces_family: { maxEntries: 12, maxChars: 3200 },
  palaces_social_health: { maxEntries: 12, maxChars: 3200 },
  horizon_5y: { maxEntries: 6, maxChars: 1800 },
  horizon_10y: { maxEntries: 6, maxChars: 1800 },
  period: { maxEntries: 7, maxChars: 2100 },
  chat: { maxEntries: 5, maxChars: 1500 },
} as const;

export const CHAT_TOPIC_TO_PALACE_KEYWORDS: ReadonlyArray<{
  palaceVi: string;
  keywords: readonly string[];
  topicTag: string;
}> = [
  {
    palaceVi: 'Quan Lộc',
    topicTag: 'su-nghiep',
    keywords: [
      'công việc',
      'sự nghiệp',
      'công danh',
      'thăng tiến',
      'nghề nghiệp',
      'chức vụ',
      'nhảy việc',
      'khởi nghiệp',
      'kinh doanh',
      'làm chủ',
      'chuyển việc',
    ],
  },
  {
    palaceVi: 'Tài Bạch',
    topicTag: 'tai-chinh',
    keywords: [
      'tiền bạc',
      'tài chính',
      'tài lộc',
      'thu nhập',
      'đầu tư',
      'kiếm tiền',
      'giàu có',
      'nợ nần',
      'hao tài',
      'tích lũy',
    ],
  },
  {
    palaceVi: 'Phu Thê',
    topicTag: 'hon-nhan',
    keywords: [
      'tình duyên',
      'hôn nhân',
      'vợ chồng',
      'kết hôn',
      'ly hôn',
      'người yêu',
      'phối ngẫu',
      'bạn đời',
      'tình cảm',
    ],
  },
  {
    palaceVi: 'Tử Nữ',
    topicTag: 'con-cai',
    keywords: ['con cái', 'sinh con', 'hậu duệ', 'tử tức', 'con đầu'],
  },
  {
    palaceVi: 'Điền Trạch',
    topicTag: 'dien-san',
    keywords: ['nhà cửa', 'đất đai', 'bất động sản', 'mua nhà', 'gia trạch', 'chuyển nhà'],
  },
  {
    palaceVi: 'Tật Ách',
    topicTag: 'suc-khoe',
    keywords: [
      'sức khỏe',
      'bệnh tật',
      'tai nạn',
      'phẫu thuật',
      'dưỡng sinh',
      'ốm đau',
      'tạng phủ',
    ],
  },
  {
    palaceVi: 'Thiên Di',
    topicTag: 'xuat-ngoai',
    keywords: ['xuất ngoại', 'đi xa', 'du học', 'định cư', 'xã giao', 'ra ngoài'],
  },
  {
    palaceVi: 'Giao Hữu',
    topicTag: 'giao-huu',
    keywords: ['bạn bè', 'đồng nghiệp', 'đối tác', 'cấp dưới', 'nhân sự'],
  },
  {
    palaceVi: 'Phúc Đức',
    topicTag: 'phuc-duc',
    keywords: ['tinh thần', 'tâm tính', 'phúc phận', 'tổ tiên', 'tâm lý', 'an hưởng'],
  },
  {
    palaceVi: 'Phụ Mẫu',
    topicTag: 'phu-mau',
    keywords: ['cha mẹ', 'bố mẹ', 'trưởng bối', 'học vấn', 'thi cử', 'bằng cấp', 'pháp lý'],
  },
  {
    palaceVi: 'Huynh Đệ',
    topicTag: 'huynh-de',
    keywords: ['anh em', 'chị em', 'huynh đệ'],
  },
  {
    palaceVi: 'Mệnh Cung',
    topicTag: 'ban-menh',
    keywords: ['bản mệnh', 'tính cách', 'mệnh chủ', 'thân cư', 'tổng quan'],
  },
];

const OUT_OF_SCOPE_TIER3_KEYWORDS: ReadonlyArray<{
  labelVi: string;
  patterns: readonly RegExp[];
}> = [
  {
    labelVi: 'Phong thủy Dương/Âm trạch & hướng nhà',
    patterns: [
      /phong\s+thủy/iu,
      /hướng\s+nhà/iu,
      /hướng\s+bàn\s+thờ/iu,
      /mộ\s+phần/iu,
      /âm\s+trạch/iu,
      /dương\s+trạch/iu,
      /bát\s+trạch/iu,
    ],
  },
  {
    labelVi: 'Bói Dịch / Quẻ Kinh Dịch / Tứ Trụ Bát Tự',
    patterns: [
      /gieo\s+quẻ/iu,
      /bói\s+dịch/iu,
      /kinh\s+dịch/iu,
      /mai\s+hoa\s+dịch/iu,
      /lục\s+hào/iu,
      /tứ\s+trụ/iu,
      /bát\s+tự/iu,
    ],
  },
  {
    labelVi: 'Đơn thuốc Đông y / Châm cứu lâm sàng',
    patterns: [
      /kê\s+đơn/iu,
      /bốc\s+thuốc/iu,
      /thang\s+thuốc/iu,
      /hoàng\s+đế\s+nội\s+kinh/iu,
      /châm\s+cứu/iu,
    ],
  },
];

interface QueryExtractionContext {
  starsVi: Set<string>;
  palacesVi: Set<string>;
  branchesVi: Set<string>;
  patternsVi: Set<string>;
  sihuaCombos: Array<{ starVi?: string; mutagenVi: KnowledgeSiHuaMutagenVi }>;
  topicTags: Set<string>;
  /** Cặp (Sao -> Cung) thực sự đồng tọa hoặc sao mượn tại cung đó */
  starToPalaces: Map<string, Set<string>>;
  dossierSectionId?: KnowledgeDossierTargetSection;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function includesWholeTerm(haystackLower: string, termLower: string): boolean {
  if (!termLower) return false;
  const re = new RegExp(`(?<!\\p{L})${escapeRegExp(termLower)}(?!\\p{L})`, 'u');
  return re.test(haystackLower);
}

function normalizeMutagenVi(sh: SiHua): KnowledgeSiHuaMutagenVi {
  return `Hóa ${translateSiHua(sh)}` as KnowledgeSiHuaMutagenVi;
}

function addStarPalaceLink(
  map: Map<string, Set<string>>,
  starVi: string,
  palaceVi: string,
) {
  if (!starVi || !palaceVi) return;
  let set = map.get(starVi);
  if (!set) {
    set = new Set<string>();
    map.set(starVi, set);
  }
  set.add(palaceVi);
}

function collectChartNatalSiHuaCombos(chart: ZiweiChart): Array<{
  starVi?: string;
  mutagenVi: KnowledgeSiHuaMutagenVi;
}> {
  const combos: Array<{ starVi?: string; mutagenVi: KnowledgeSiHuaMutagenVi }> = [];
  const transforms = getSiHuaByStem(chart.lunarInfo.yearStem);
  for (const sh of ['禄', '权', '科', '忌'] as SiHua[]) {
    const starCn = transforms[sh];
    if (starCn) {
      combos.push({
        starVi: translateStarName(starCn),
        mutagenVi: normalizeMutagenVi(sh),
      });
    }
  }
  if (chart.currentDaXianIndex >= 0 && chart.currentDaXianIndex < chart.daXians.length) {
    const dxSiHua = getDaXianSiHua(chart, chart.currentDaXianIndex);
    if (dxSiHua) {
      for (const sh of ['禄', '权', '科', '忌'] as SiHua[]) {
        const starCn = dxSiHua.transforms[sh];
        if (starCn) {
          combos.push({
            starVi: translateStarName(starCn),
            mutagenVi: normalizeMutagenVi(sh),
          });
        }
      }
    }
  }
  return combos;
}

function extractPalaceStarsAndBranch(
  palace: Palace,
  ctx: QueryExtractionContext,
) {
  const palaceVi = translatePalaceName(palace.name);
  const branchVi = VI_BRANCHES[palace.branch];
  if (palaceVi) ctx.palacesVi.add(palaceVi);
  if (branchVi) ctx.branchesVi.add(branchVi);

  for (const s of palace.stars) {
    const starVi = translateStarName(s.name);
    if (starVi) {
      ctx.starsVi.add(starVi);
      if (palaceVi) addStarPalaceLink(ctx.starToPalaces, starVi, palaceVi);
    }
    if (s.siHua && starVi) {
      ctx.sihuaCombos.push({
        starVi,
        mutagenVi: normalizeMutagenVi(s.siHua),
      });
    }
  }
  for (const bs of palace.borrowedStars ?? []) {
    const starVi = translateStarName(bs);
    if (starVi) {
      ctx.starsVi.add(starVi);
      if (palaceVi) addStarPalaceLink(ctx.starToPalaces, starVi, palaceVi);
    }
  }
}

export function scoreKnowledgeEntry(
  entry: DistilledKnowledgeEntry,
  ctx: QueryExtractionContext,
): KnowledgeScoredEntry {
  const rk = entry.retrievalKeys;
  const reasons: string[] = [];
  let score = 0;

  const matchedStars = (rk.starsVi ?? []).filter((s) => ctx.starsVi.has(s));
  const matchedPalaces = (rk.palacesVi ?? []).filter((p) => ctx.palacesVi.has(p));

  // W_combo = +1000: khớp đồng thời sao + cung tương ứng (hoặc cùng trong ngữ cảnh)
  let comboPalace: string | undefined;
  for (const s of matchedStars) {
    const linkedPalaces = ctx.starToPalaces.get(s);
    if (linkedPalaces) {
      for (const p of matchedPalaces) {
        if (linkedPalaces.has(p)) {
          comboPalace = p;
          break;
        }
      }
    }
    if (comboPalace) break;
  }
  if (!comboPalace && matchedStars.length > 0 && matchedPalaces.length > 0 && ctx.starToPalaces.size === 0) {
    comboPalace = matchedPalaces[0];
  }

  if (comboPalace) {
    score += 1000;
    reasons.push(`combo:${matchedStars[0]}+${comboPalace}`);
  }

  // W_pattern = +850
  const matchedPatterns = (rk.patternsVi ?? []).filter((pat) =>
    ctx.patternsVi.has(pat),
  );
  if (matchedPatterns.length > 0) {
    score += 850;
    reasons.push(`pattern:${matchedPatterns[0]}`);
  }

  // W_sihua = +700
  let sihuaMatched = false;
  for (const entryCombo of rk.sihuaCombos ?? []) {
    const hit = ctx.sihuaCombos.some((q) => {
      if (q.mutagenVi !== entryCombo.mutagenVi) return false;
      if (!entryCombo.starVi) return true;
      return q.starVi === entryCombo.starVi;
    });
    if (hit) {
      sihuaMatched = true;
      reasons.push(
        `sihua:${entryCombo.starVi ? `${entryCombo.starVi} ` : ''}${entryCombo.mutagenVi}`,
      );
      break;
    }
  }
  if (sihuaMatched) {
    score += 700;
    if (ctx.topicTags.has('van-han')) {
      score += 350;
      reasons.push('van-han-sihua');
    }
  }

  // W_branch = +300
  const matchedBranches = (rk.branchesVi ?? []).filter((b) =>
    ctx.branchesVi.has(b),
  );
  if (matchedBranches.length > 0 && (matchedStars.length > 0 || matchedPalaces.length > 0)) {
    score += 300;
    reasons.push(`branch:${matchedBranches[0]}`);
  }

  // W_single = +250 (star match) or +200 (topic / palace / section match)
  if (matchedStars.length > 0) {
    score += 250 + Math.min(40, (matchedStars.length - 1) * 20);
    reasons.push(`star:${matchedStars[0]}`);
  } else if (matchedPalaces.length > 0) {
    score += 200;
    reasons.push(`palace:${matchedPalaces[0]}`);
  }

  const matchedTopics = (rk.topicTags ?? []).filter((t) => ctx.topicTags.has(t));
  if (matchedTopics.length > 0) {
    score += 200;
    reasons.push(`topic:${matchedTopics[0]}`);
  }

  if (
    ctx.dossierSectionId &&
    (rk.targetDossierSections ?? []).includes(ctx.dossierSectionId) &&
    score > 0
  ) {
    const sectionBonus =
      ctx.dossierSectionId === 'horizon_5y' ||
      ctx.dossierSectionId === 'horizon_10y' ||
      ctx.dossierSectionId === 'year_2026' ||
      ctx.dossierSectionId === 'year_2027'
        ? 350
        : 40;
    score += sectionBonus;
    reasons.push(`section:${ctx.dossierSectionId}`);
  }

  if (score > 0) {
    if (entry.priorityTier === 1) score += 50;
    else if (entry.priorityTier === 2) score += 25;
  }

  return {
    entry,
    score,
    matchedReasons: reasons,
    matchedPalaceVi: comboPalace ?? matchedPalaces[0],
  };
}

export const TIER2_RESERVATION_MIN_SCORE = 575;
const MAX_CONDITIONS_PROMPT_CHARS = 200;

function truncateConditionsForPrompt(conditionsVi: string | undefined): string {
  const trimmed = conditionsVi?.trim();
  if (!trimmed) return '';
  if (trimmed.length <= MAX_CONDITIONS_PROMPT_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_CONDITIONS_PROMPT_CHARS - 1).trimEnd()}…`;
}

export function isEntryGenderMismatch(
  entry: Pick<DistilledKnowledgeEntry, 'conditionsVi'>,
  chartGender?: 'male' | 'female' | null,
): boolean {
  if (chartGender !== 'male' && chartGender !== 'female') return false;
  const rawConditions = entry.conditionsVi;
  if (!rawConditions) return false;

  // Step 1: Only trigger when original conditionsVi has capitalized "Nam mệnh" or "Nữ mệnh"
  const hasCapitalMale = rawConditions.includes('Nam mệnh');
  const hasCapitalFemale = rawConditions.includes('Nữ mệnh');
  if (!hasCapitalMale && !hasCapitalFemale) return false;

  // Step 2: Once triggered, check both genders case-insensitively so dual-gender entries are preserved
  const lowerConditions = rawConditions.normalize('NFC').toLowerCase();
  const mentionsMale = lowerConditions.includes('nam mệnh');
  const mentionsFemale = lowerConditions.includes('nữ mệnh');
  if (mentionsMale && mentionsFemale) return false;

  if (mentionsFemale && !mentionsMale) return chartGender === 'male';
  if (mentionsMale && !mentionsFemale) return chartGender === 'female';
  return false;
}

function formatEntryForPrompt(entry: DistilledKnowledgeEntry): string {
  const tierLabel = `T${entry.priorityTier}`;
  const truncatedConditions = truncateConditionsForPrompt(entry.conditionsVi);
  const condPart = truncatedConditions ? ` Điều kiện: ${truncatedConditions}` : '';
  return `- [${entry.id}] **${entry.sourceRef.groupTitleVi}** (${entry.sourceRef.workTitleVi} · ${tierLabel}): ${entry.summaryVi}${condPart}`;
}

function packEntriesWithinBudget(
  candidates: readonly KnowledgeScoredEntry[],
  maxEntries: number,
  maxChars: number,
  perPalaceQuota?: { palacesVi: readonly string[]; minPerPalace: number; maxPerPalace: number },
  tier2Reservation?: { minScore: number },
): {
  selected: KnowledgeScoredEntry[];
  promptBlockMarkdown: string;
  charCount: number;
} {
  const positive = candidates
    .filter((c) => c.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.entry.id.localeCompare(b.entry.id, 'en');
    });

  const chosen: KnowledgeScoredEntry[] = [];
  const chosenIds = new Set<string>();
  let totalChars = 0;

  const tryAdd = (item: KnowledgeScoredEntry): boolean => {
    if (chosen.length >= maxEntries || chosenIds.has(item.entry.id)) return false;
    const formatted = formatEntryForPrompt(item.entry);
    const sep = chosen.length > 0 ? 1 : 0;
    if (totalChars + sep + formatted.length > maxChars) return false;
    chosen.push(item);
    chosenIds.add(item.entry.id);
    totalChars += sep + formatted.length;
    return true;
  };

  const hasQualifyingTier2Selected = (): boolean =>
    tier2Reservation
      ? chosen.some(
          (c) =>
            c.entry.scopeTier === 'tier2_extended' &&
            c.score >= tier2Reservation.minScore,
        )
      : true;

  const tryReserveTier2 = (): boolean => {
    if (!tier2Reservation || hasQualifyingTier2Selected()) return false;
    for (const candidate of positive) {
      if (
        candidate.entry.scopeTier === 'tier2_extended' &&
        candidate.score >= tier2Reservation.minScore &&
        !chosenIds.has(candidate.entry.id)
      ) {
        if (tryAdd(candidate)) return true;
      }
    }
    return false;
  };

  if (perPalaceQuota && perPalaceQuota.palacesVi.length > 0) {
    // Round-robin phân bổ đều quota cho từng cung trong nhóm 4 cung (ĐN / QĐ-N6)
    const countByPalace = new Map<string, number>();
    for (const p of perPalaceQuota.palacesVi) {
      countByPalace.set(p, 0);
    }

    for (let round = 0; round < perPalaceQuota.maxPerPalace; round++) {
      let roundHasSurplus = false;
      for (const palaceVi of perPalaceQuota.palacesVi) {
        if (chosen.length >= maxEntries) break;
        const currCount = countByPalace.get(palaceVi) ?? 0;
        if (currCount >= perPalaceQuota.maxPerPalace) continue;

        const match = positive.find(
          (c) =>
            !chosenIds.has(c.entry.id) &&
            (c.matchedPalaceVi === palaceVi ||
              c.entry.retrievalKeys.palacesVi.includes(palaceVi)),
        );
        if (match && tryAdd(match)) {
          countByPalace.set(palaceVi, currCount + 1);
        } else {
          roundHasSurplus = true;
        }
      }

      if (roundHasSurplus && tier2Reservation && !hasQualifyingTier2Selected()) {
        tryReserveTier2();
      }
    }
  }

  if (tier2Reservation && !hasQualifyingTier2Selected()) {
    tryReserveTier2();
  }

  for (const item of positive) {
    if (chosen.length >= maxEntries) break;
    tryAdd(item);
  }

  const promptBlockMarkdown = chosen
    .map((c) => formatEntryForPrompt(c.entry))
    .join('\n');

  return {
    selected: chosen,
    promptBlockMarkdown,
    charCount: promptBlockMarkdown.length,
  };
}

function buildMatchedEntitiesSummary(ctx: QueryExtractionContext) {
  return {
    starsVi: Array.from(ctx.starsVi).sort((a, b) => a.localeCompare(b, 'vi')),
    palacesVi: Array.from(ctx.palacesVi).sort((a, b) => a.localeCompare(b, 'vi')),
    branchesVi: Array.from(ctx.branchesVi),
    patternsVi: Array.from(ctx.patternsVi).sort((a, b) => a.localeCompare(b, 'vi')),
    sihuaCombos: ctx.sihuaCombos,
    topicTags: Array.from(ctx.topicTags).sort((a, b) => a.localeCompare(b, 'en')),
  };
}

function buildEmptyResult(
  flow: 'dossier' | 'period' | 'chat',
  limits: { maxEntries: number; maxChars: number },
  ctx: QueryExtractionContext,
  coverageStatus: KnowledgeCoverageStatus,
  coverageBoundaryNoteVi: string,
  extra?: Partial<KnowledgeRetrievalResult>,
): KnowledgeRetrievalResult {
  return {
    flow,
    entries: [],
    scoredEntries: [],
    promptBlockMarkdown: '',
    charCount: 0,
    maxEntries: limits.maxEntries,
    maxChars: limits.maxChars,
    coverageStatus,
    hasCoverageGap: coverageStatus !== 'covered',
    coverageBoundaryNoteVi,
    starAbsentInQueriedPalace: false,
    matchedEntities: buildMatchedEntitiesSummary(ctx),
    ...extra,
  };
}

export function retrieveKnowledgeForDossierSection(
  chart: ZiweiChart,
  sectionId: DossierSectionId,
  options?: {
    entries?: readonly DistilledKnowledgeEntry[];
    maxEntries?: number;
    maxChars?: number;
  },
): KnowledgeRetrievalResult {
  const defaults = KB_BUDGET_LIMITS[sectionId];
  const maxEntries = options?.maxEntries ?? defaults.maxEntries;
  const maxChars = options?.maxChars ?? defaults.maxChars;
  const corpus = options?.entries ?? getKnowledgeBaseSnapshot().entries;

  const ctx: QueryExtractionContext = {
    starsVi: new Set(),
    palacesVi: new Set(),
    branchesVi: new Set(),
    patternsVi: new Set(),
    sihuaCombos: [],
    topicTags: new Set(),
    starToPalaces: new Map(),
    dossierSectionId: sectionId,
  };

  let perPalaceQuota:
    | { palacesVi: readonly string[]; minPerPalace: number; maxPerPalace: number }
    | undefined;

  if (sectionId === 'chapter_overview') {
    const ming = chart.palaces.find((p) => p.branch === chart.mingGongBranch);
    const shen = chart.palaces.find((p) => p.branch === chart.shenGongBranch);
    if (ming) extractPalaceStarsAndBranch(ming, ctx);
    if (shen && shen.branch !== ming?.branch) extractPalaceStarsAndBranch(shen, ctx);
    ctx.sihuaCombos.push(...collectChartNatalSiHuaCombos(chart));
    for (const pat of detectPatterns(chart)) {
      ctx.patternsVi.add(localizePattern(pat).name);
    }
    ctx.topicTags.add('ban-menh');
  } else if (
    sectionId === 'palaces_core' ||
    sectionId === 'palaces_family' ||
    sectionId === 'palaces_social_health'
  ) {
    const groupKey =
      sectionId === 'palaces_core'
        ? 'core'
        : sectionId === 'palaces_family'
          ? 'family'
          : 'social_health';
    const spec = DOSSIER_PALACE_GROUPS[groupKey];
    const targetPalacesVi: string[] = [];

    for (const rawKey of spec.palaceKeys) {
      const aliases = spec.aliases[rawKey] ?? [rawKey];
      const pal = chart.palaces.find((p) => {
        const clean = p.name.replace(/宫$/u, '');
        return aliases.includes(p.name) || aliases.includes(clean) || clean === rawKey;
      });
      if (pal) {
        extractPalaceStarsAndBranch(pal, ctx);
        const pVi = translatePalaceName(pal.name);
        if (pVi) targetPalacesVi.push(pVi);
      }
    }
    ctx.sihuaCombos.push(...collectChartNatalSiHuaCombos(chart));
    perPalaceQuota = {
      palacesVi: targetPalacesVi,
      minPerPalace: 2,
      maxPerPalace: 3,
    };
  } else {
    // horizon_5y / horizon_10y
    const ming = chart.palaces.find((p) => p.branch === chart.mingGongBranch);
    if (ming) extractPalaceStarsAndBranch(ming, ctx);
    if (
      chart.currentDaXianIndex >= 0 &&
      chart.currentDaXianIndex < chart.daXians.length
    ) {
      const dx = chart.daXians[chart.currentDaXianIndex];
      const dxPal = chart.palaces.find((p) => p.branch === dx.palaceBranch);
      if (dxPal) extractPalaceStarsAndBranch(dxPal, ctx);
    }
    ctx.sihuaCombos.push(...collectChartNatalSiHuaCombos(chart));
    ctx.topicTags.add('van-han');
  }

  if (corpus.length === 0) {
    return buildEmptyResult(
      'dossier',
      { maxEntries, maxChars },
      ctx,
      'empty_kb',
      'Kho tri thức học thuật chưa được nạp dữ liệu chưng cất; chỉ phân tích dựa trên bảng dữ kiện tinh đẩu xác định của lá số.',
    );
  }

  const filteredCorpus = corpus.filter(
    (entry) => !isEntryGenderMismatch(entry, chart.birthInfo?.gender),
  );
  const scored = filteredCorpus.map((entry) => scoreKnowledgeEntry(entry, ctx));
  const packed = packEntriesWithinBudget(scored, maxEntries, maxChars, perPalaceQuota, {
    minScore: TIER2_RESERVATION_MIN_SCORE,
  });

  if (packed.selected.length === 0) {
    return buildEmptyResult(
      'dossier',
      { maxEntries, maxChars },
      ctx,
      'uncovered',
      'Kho trích đoạn hiện nạp không có mục đối chiếu trực tiếp cho tổ hợp sao/cung này; chỉ phân tích dựa trên dữ kiện tinh đẩu xác định của lá số.',
    );
  }

  const coverageStatus: KnowledgeCoverageStatus =
    packed.selected.length >= Math.min(2, maxEntries) ? 'covered' : 'partial';

  return {
    flow: 'dossier',
    entries: packed.selected.map((s) => s.entry),
    scoredEntries: packed.selected,
    promptBlockMarkdown: packed.promptBlockMarkdown,
    charCount: packed.charCount,
    maxEntries,
    maxChars,
    coverageStatus,
    hasCoverageGap: coverageStatus !== 'covered',
    coverageBoundaryNoteVi:
      coverageStatus === 'partial'
        ? 'Kho trích đoạn chỉ phủ một phần tinh hệ trong chương; những điểm không có trích đoạn đi kèm phải phân tích thuần túy theo dữ kiện lá số và không được gán thẻ nguồn.'
        : '',
    starAbsentInQueriedPalace: false,
    matchedEntities: buildMatchedEntitiesSummary(ctx),
  };
}

export function retrieveKnowledgeForPeriod(
  chart: ZiweiChart | null | undefined,
  periodContext: YunxianPeriodContext,
  options?: {
    entries?: readonly DistilledKnowledgeEntry[];
    maxEntries?: number;
    maxChars?: number;
  },
): KnowledgeRetrievalResult {
  const maxEntries = options?.maxEntries ?? KB_BUDGET_LIMITS.period.maxEntries;
  const maxChars = options?.maxChars ?? KB_BUDGET_LIMITS.period.maxChars;
  const corpus = options?.entries ?? getKnowledgeBaseSnapshot().entries;

  const ctx: QueryExtractionContext = {
    starsVi: new Set(),
    palacesVi: new Set(),
    branchesVi: new Set(),
    patternsVi: new Set(),
    sihuaCombos: [],
    topicTags: new Set(['van-han']),
    starToPalaces: new Map(),
    dossierSectionId:
      periodContext.periodId === 'liunian_2026'
        ? 'year_2026'
        : periodContext.periodId === 'liunian_2027'
          ? 'year_2027'
          : undefined,
  };

  if (periodContext.activatedPalace?.natalPalaceNameVi) {
    ctx.palacesVi.add(periodContext.activatedPalace.natalPalaceNameVi);
  }
  const activeBranchVi = VI_BRANCHES[periodContext.branchIndex];
  if (activeBranchVi) ctx.branchesVi.add(activeBranchVi);

  if (chart) {
    const actPal = chart.palaces.find((p) => p.branch === periodContext.branchIndex);
    if (actPal) extractPalaceStarsAndBranch(actPal, ctx);
    for (const pat of detectPatterns(chart)) {
      ctx.patternsVi.add(localizePattern(pat).name);
    }
  } else if (periodContext.sanFangSiZheng?.benGong) {
    for (const rawStar of periodContext.sanFangSiZheng.benGong.majorStarsVi) {
      const cleanStar = rawStar.replace(/\s*[\[(].*$/, '').trim();
      if (cleanStar && cleanStar !== 'Vô chính diệu') {
        ctx.starsVi.add(cleanStar);
        addStarPalaceLink(
          ctx.starToPalaces,
          cleanStar,
          periodContext.activatedPalace.natalPalaceNameVi,
        );
      }
    }
  }

  for (const sh of periodContext.periodSiHua ?? []) {
    const mutagenVi = `Hóa ${sh.mutagenVi.replace(/^Hóa\s+/u, '')}` as KnowledgeSiHuaMutagenVi;
    if (sh.starNameVi) {
      ctx.starsVi.add(sh.starNameVi);
      ctx.sihuaCombos.push({ starVi: sh.starNameVi, mutagenVi });
      if (sh.natalPalaceNameVi) {
        ctx.palacesVi.add(sh.natalPalaceNameVi);
        addStarPalaceLink(ctx.starToPalaces, sh.starNameVi, sh.natalPalaceNameVi);
      }
    }
  }

  if (corpus.length === 0) {
    return buildEmptyResult(
      'period',
      { maxEntries, maxChars },
      ctx,
      'empty_kb',
      'Kho tri thức học thuật chưa được nạp dữ liệu; luận giải kỳ hạn dựa hoàn toàn trên Bảng Dữ Kiện Kỳ Hạn Xác Định.',
    );
  }

  const filteredCorpus = corpus.filter(
    (entry) => !isEntryGenderMismatch(entry, chart?.birthInfo?.gender),
  );
  const scored = filteredCorpus.map((entry) => scoreKnowledgeEntry(entry, ctx));
  const packed = packEntriesWithinBudget(scored, maxEntries, maxChars, undefined, {
    minScore: TIER2_RESERVATION_MIN_SCORE,
  });

  if (packed.selected.length === 0) {
    return buildEmptyResult(
      'period',
      { maxEntries, maxChars },
      ctx,
      'uncovered',
      'Kho trích đoạn hiện nạp chưa có mục trùng khớp trực tiếp với tinh hệ & Tứ Hóa kỳ hạn này.',
    );
  }

  return {
    flow: 'period',
    entries: packed.selected.map((s) => s.entry),
    scoredEntries: packed.selected,
    promptBlockMarkdown: packed.promptBlockMarkdown,
    charCount: packed.charCount,
    maxEntries,
    maxChars,
    coverageStatus: packed.selected.length >= 2 ? 'covered' : 'partial',
    hasCoverageGap: packed.selected.length < 2,
    coverageBoundaryNoteVi:
      packed.selected.length < 2
        ? 'Kho trích đoạn chỉ phủ một phần các sao kích hoạt trong kỳ hạn; các sao không có thẻ nguồn phải luận theo dữ kiện bảng.'
        : '',
    starAbsentInQueriedPalace: false,
    matchedEntities: buildMatchedEntitiesSummary(ctx),
  };
}

// Tập từ điển sao & cung chuẩn từ vi-i18n.ts (sắp theo độ dài giảm dần để tránh bắt nhầm tiền tố ngắn)
const VI_STAR_CANDIDATES = Array.from(new Set(Object.values(CN_TO_VI_STAR))).sort(
  (a, b) => b.length - a.length,
);

const VI_PALACE_CANDIDATES: Array<{ label: string; canonical: string }> = [
  ...Array.from(new Set(Object.values(CN_TO_VI_PALACE))).map((p) => ({
    label: p,
    canonical: p,
  })),
  { label: 'Mệnh', canonical: 'Mệnh Cung' },
  { label: 'Thân', canonical: 'Thân Cung' },
  { label: 'Tử Tức', canonical: 'Tử Nữ' },
  { label: 'Nô Bộc', canonical: 'Giao Hữu' },
].sort((a, b) => b.label.length - a.label.length);

const VI_PATTERN_CANDIDATES = Array.from(new Set(Object.values(PATTERN_NAME_VI))).sort(
  (a, b) => b.length - a.length,
);

const VI_MUTAGEN_KEYWORDS: Array<{
  keyword: string;
  mutagenVi: KnowledgeSiHuaMutagenVi;
}> = [
  { keyword: 'hóa lộc', mutagenVi: 'Hóa Lộc' },
  { keyword: 'hóa quyền', mutagenVi: 'Hóa Quyền' },
  { keyword: 'hóa khoa', mutagenVi: 'Hóa Khoa' },
  { keyword: 'hóa kỵ', mutagenVi: 'Hóa Kỵ' },
  { keyword: 'lưu lộc', mutagenVi: 'Hóa Lộc' },
  { keyword: 'lưu quyền', mutagenVi: 'Hóa Quyền' },
  { keyword: 'lưu khoa', mutagenVi: 'Hóa Khoa' },
  { keyword: 'lưu kỵ', mutagenVi: 'Hóa Kỵ' },
];

export function checkEffectiveStarInPalace(
  chart: ZiweiChart,
  starVi: string,
  palaceVi: string,
): {
  mode: 'present_in_palace' | 'present_in_sanfang_or_borrowed' | 'absent';
  detailNoteVi?: string;
} {
  const targetPalace = chart.palaces.find(
    (p) => translatePalaceName(p.name) === palaceVi,
  );
  if (!targetPalace) {
    return { mode: 'absent' };
  }

  const b = targetPalace.branch;
  const directStars = targetPalace.stars.map((s) => translateStarName(s.name));
  if (directStars.includes(starVi)) {
    return {
      mode: 'present_in_palace',
      detailNoteVi: `Sao ${starVi} tọa thủ trực tiếp tại ${palaceVi} (${VI_BRANCHES[b]}).`,
    };
  }

  const borrowedStars = (targetPalace.borrowedStars ?? []).map((s) =>
    translateStarName(s),
  );
  if (borrowedStars.includes(starVi)) {
    const fromName = translatePalaceName(targetPalace.borrowedFromName);
    return {
      mode: 'present_in_sanfang_or_borrowed',
      detailNoteVi: `Sao ${starVi} là sao mượn Vô Chính Diệu của ${palaceVi} từ đối cung ${fromName}.`,
    };
  }

  const relatedBranches = [(b + 4) % 12, (b + 8) % 12, (b + 6) % 12];
  for (const relBranch of relatedBranches) {
    const relPalace = chart.palaces.find((p) => p.branch === relBranch);
    if (!relPalace) continue;
    const relStars = relPalace.stars.map((s) => translateStarName(s.name));
    if (relStars.includes(starVi)) {
      const relPalaceVi = translatePalaceName(relPalace.name);
      const relRole =
        relBranch === (b + 6) % 12 ? 'xung chiếu từ đối cung' : 'hội chiếu từ tam hợp';
      return {
        mode: 'present_in_sanfang_or_borrowed',
        detailNoteVi: `Sao ${starVi} ${relRole} ${relPalaceVi} (${VI_BRANCHES[relBranch]}) về ${palaceVi}.`,
      };
    }
  }

  return { mode: 'absent' };
}

export function retrieveKnowledgeForChat(
  params: {
    chart: ZiweiChart;
    chartB?: ZiweiChart | null;
    contextMode: 'natal' | 'period' | 'heming';
    sectionTitle: string;
    periodContext?: YunxianPeriodContext | null;
    question: string;
  },
  options?: {
    entries?: readonly DistilledKnowledgeEntry[];
    maxEntries?: number;
    maxChars?: number;
  },
): KnowledgeRetrievalResult {
  const maxEntries = options?.maxEntries ?? KB_BUDGET_LIMITS.chat.maxEntries;
  const maxChars = options?.maxChars ?? KB_BUDGET_LIMITS.chat.maxChars;
  const corpus = options?.entries ?? getKnowledgeBaseSnapshot().entries;

  const ctx: QueryExtractionContext = {
    starsVi: new Set(),
    palacesVi: new Set(),
    branchesVi: new Set(),
    patternsVi: new Set(),
    sihuaCombos: [],
    topicTags: new Set(),
    starToPalaces: new Map(),
  };

  const questionLower = params.question.normalize('NFC').toLowerCase();
  const titleLower = (params.sectionTitle || '').normalize('NFC').toLowerCase();

  // Kiểm tra bẫy Tầng 3 (ngoài phạm vi Tử Vi Đẩu Số) trước
  for (const trap of OUT_OF_SCOPE_TIER3_KEYWORDS) {
    if (trap.patterns.some((re) => re.test(params.question))) {
      return buildEmptyResult(
        'chat',
        { maxEntries, maxChars },
        ctx,
        'out_of_scope',
        `Câu hỏi chạm tới chủ đề ngoài phạm vi luận giải Tử Vi Đẩu Số (${trap.labelVi}). Kho tri thức đã loại bỏ chủ đề này khỏi runtime; hãy trả lời trung thực giới hạn dữ liệu và không suy diễn ngoài lá số.`,
        { outOfScopeTopicVi: trap.labelVi },
      );
    }
  }

  // Bước 1: Quét thực thể tường minh trong câu hỏi
  const explicitStarsInQuestion: string[] = [];
  for (const starVi of VI_STAR_CANDIDATES) {
    if (includesWholeTerm(questionLower, starVi.toLowerCase())) {
      explicitStarsInQuestion.push(starVi);
      ctx.starsVi.add(starVi);
    }
  }

  const explicitPalacesInQuestion: string[] = [];
  for (const item of VI_PALACE_CANDIDATES) {
    if (item.label === 'Mệnh' || item.label === 'Thân') {
      const explicitRe = new RegExp(
        `(?<!\\p{L})(?:cung\\s+${escapeRegExp(item.label.toLowerCase())}|tại\\s+${escapeRegExp(item.label.toLowerCase())}|ở\\s+${escapeRegExp(item.label.toLowerCase())})(?!\\p{L})`,
        'u',
      );
      if (explicitRe.test(questionLower)) {
        if (!explicitPalacesInQuestion.includes(item.canonical)) {
          explicitPalacesInQuestion.push(item.canonical);
          ctx.palacesVi.add(item.canonical);
        }
      }
      continue;
    }
    if (includesWholeTerm(questionLower, item.label.toLowerCase())) {
      if (!explicitPalacesInQuestion.includes(item.canonical)) {
        explicitPalacesInQuestion.push(item.canonical);
        ctx.palacesVi.add(item.canonical);
      }
    }
  }

  for (const patVi of VI_PATTERN_CANDIDATES) {
    if (includesWholeTerm(questionLower, patVi.toLowerCase())) {
      ctx.patternsVi.add(patVi);
    }
  }

  for (const mut of VI_MUTAGEN_KEYWORDS) {
    if (includesWholeTerm(questionLower, mut.keyword)) {
      if (explicitStarsInQuestion.length > 0) {
        for (const s of explicitStarsInQuestion) {
          ctx.sihuaCombos.push({ starVi: s, mutagenVi: mut.mutagenVi });
        }
      } else {
        ctx.sihuaCombos.push({ mutagenVi: mut.mutagenVi });
      }
    }
  }

  // Bước 2: Nếu câu hỏi không nêu tên cung tường minh, ánh xạ qua bảng từ khóa chủ đề đời sống
  if (explicitPalacesInQuestion.length === 0) {
    for (const topic of CHAT_TOPIC_TO_PALACE_KEYWORDS) {
      if (
        topic.keywords.some((kw) => includesWholeTerm(questionLower, kw.toLowerCase()))
      ) {
        ctx.palacesVi.add(topic.palaceVi);
        ctx.topicTags.add(topic.topicTag);
      }
    }
  }

  // Kiểm tra ĐN-8: starAbsentInQueriedPalace xét đủ Bản cung + BorrowedStars + Tam Phương Tứ Chính (+4, +8, +6)
  let starAbsentInQueriedPalace = false;
  let absentStarDetail: { starVi: string; palaceVi: string } | undefined;
  let starPresenceMode:
    | 'present_in_palace'
    | 'present_in_sanfang_or_borrowed'
    | 'absent'
    | undefined;
  const sanFangNotes: string[] = [];

  if (explicitStarsInQuestion.length > 0) {
    const targetPalaces =
      explicitPalacesInQuestion.length > 0
        ? explicitPalacesInQuestion
        : Array.from(ctx.palacesVi);

    if (targetPalaces.length > 0) {
      const queriedPalace = targetPalaces[0];
      const queriedStar = explicitStarsInQuestion[0];
      const check = checkEffectiveStarInPalace(params.chart, queriedStar, queriedPalace);
      starPresenceMode = check.mode;
      if (check.mode === 'absent') {
        starAbsentInQueriedPalace = true;
        absentStarDetail = { starVi: queriedStar, palaceVi: queriedPalace };
      } else {
        addStarPalaceLink(ctx.starToPalaces, queriedStar, queriedPalace);
        if (check.detailNoteVi) sanFangNotes.push(check.detailNoteVi);
      }
    }
  }

  if (starAbsentInQueriedPalace && absentStarDetail) {
    return buildEmptyResult(
      'chat',
      { maxEntries, maxChars },
      ctx,
      'absent_star',
      `Theo Bảng dữ kiện lá số, sao ${absentStarDetail.starVi} KHÔNG tọa thủ, KHÔNG phải sao mượn và KHÔNG hội chiếu từ Tam Phương Tứ Chính về ${absentStarDetail.palaceVi}. Tuyệt đối xác nhận sao này không có trong phạm vi cung đang hỏi và DỪNG Ở ĐÓ.`,
      {
        starAbsentInQueriedPalace: true,
        absentStarDetail,
        starPresenceMode: 'absent',
      },
    );
  }

  // Bước 3: Fallback nếu không khớp từ khóa nào ở Bước 1 & 2
  const usedFallbackContext =
    ctx.starsVi.size === 0 &&
    ctx.palacesVi.size === 0 &&
    ctx.patternsVi.size === 0 &&
    ctx.sihuaCombos.length === 0 &&
    ctx.topicTags.size === 0;

  if (usedFallbackContext) {
    for (const item of VI_PALACE_CANDIDATES) {
      if (
        item.label.length >= 4 &&
        includesWholeTerm(titleLower, item.label.toLowerCase())
      ) {
        ctx.palacesVi.add(item.canonical);
      }
    }
    if (params.periodContext?.activatedPalace?.natalPalaceNameVi) {
      ctx.palacesVi.add(params.periodContext.activatedPalace.natalPalaceNameVi);
    }
    if (ctx.palacesVi.size === 0) {
      ctx.palacesVi.add('Mệnh Cung');
    }
    for (const pVi of Array.from(ctx.palacesVi)) {
      const pal = params.chart.palaces.find(
        (p) => translatePalaceName(p.name) === pVi,
      );
      if (pal) extractPalaceStarsAndBranch(pal, ctx);
    }
  } else {
    for (const pVi of Array.from(ctx.palacesVi)) {
      const pal = params.chart.palaces.find(
        (p) => translatePalaceName(p.name) === pVi,
      );
      if (pal) {
        const branchVi = VI_BRANCHES[pal.branch];
        if (branchVi) ctx.branchesVi.add(branchVi);
        for (const s of pal.stars) {
          const sVi = translateStarName(s.name);
          if (sVi && (ctx.starsVi.size === 0 || ctx.starsVi.has(sVi))) {
            ctx.starsVi.add(sVi);
            addStarPalaceLink(ctx.starToPalaces, sVi, pVi);
          }
        }
      }
    }
  }

  if (corpus.length === 0) {
    return buildEmptyResult(
      'chat',
      { maxEntries, maxChars },
      ctx,
      'empty_kb',
      'Kho tri thức học thuật chưa có dữ liệu chưng cất; hãy trả lời hoàn toàn dựa trên Bảng Dữ Kiện Lá Số Xác Định.',
      { starPresenceMode, sanFangNoteVi: sanFangNotes.join(' ') || undefined },
    );
  }

  const chartAGender = params.chart.birthInfo?.gender;
  const chartBGender = params.chartB?.birthInfo?.gender;
  const effectiveChatGender =
    params.contextMode === 'heming' && chartBGender && chartBGender !== chartAGender
      ? undefined
      : chartAGender;
  const filteredCorpus = corpus.filter(
    (entry) => !isEntryGenderMismatch(entry, effectiveChatGender),
  );
  const scored = filteredCorpus.map((entry) => scoreKnowledgeEntry(entry, ctx));
  const packed = packEntriesWithinBudget(scored, maxEntries, maxChars);

  if (packed.selected.length === 0) {
    return buildEmptyResult(
      'chat',
      { maxEntries, maxChars },
      ctx,
      'uncovered',
      'Kho trích đoạn hiện nạp không có mục đối chiếu trực tiếp cho câu hỏi này; chỉ trả lời dựa trên dữ kiện tinh đẩu xác định trong lá số và khai báo rõ nếu thiếu căn cứ.',
      { starPresenceMode, sanFangNoteVi: sanFangNotes.join(' ') || undefined },
    );
  }

  const coverageStatus: KnowledgeCoverageStatus = usedFallbackContext
    ? 'partial'
    : 'covered';

  return {
    flow: 'chat',
    entries: packed.selected.map((s) => s.entry),
    scoredEntries: packed.selected,
    promptBlockMarkdown: packed.promptBlockMarkdown,
    charCount: packed.charCount,
    maxEntries,
    maxChars,
    coverageStatus,
    hasCoverageGap: coverageStatus !== 'covered',
    coverageBoundaryNoteVi: usedFallbackContext
      ? 'Câu hỏi không nhắc đích danh sao/cung cụ thể nên hệ thống chỉ nạp trích đoạn theo ngữ cảnh cung đang mở; không gán ghép khẩu quyết ngoài phạm vi đã nạp.'
      : '',
    starAbsentInQueriedPalace: false,
    starPresenceMode,
    sanFangNoteVi: sanFangNotes.join(' ') || undefined,
    matchedEntities: buildMatchedEntitiesSummary(ctx),
  };
}
