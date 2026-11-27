import {
  CN_TO_VI_PALACE,
  CN_TO_VI_STAR,
  VI_BRANCHES,
  VI_STEMS,
  translatePalaceName,
  translateStarName,
} from '../../src/lib/ziwei/vi-i18n.ts';
import type { ZiweiChart } from '../../src/lib/ziwei/types.ts';
import { buildMultiYearHorizonContext } from '../../src/lib/ziwei/dossier-context.ts';
import {
  buildYunxianPeriodContext,
  type YunxianPeriodContext,
} from '../../src/lib/ziwei/yunxian-context.ts';
import {
  CITATION_ID_SYNTAX_RE,
  enforceCanonicalPalaceGroupHeadings,
  parseCitationTagInner,
  scrubInvalidCitationTags,
} from '../../src/lib/ziwei/text-sanitizer.ts';
import {
  getKnowledgeBaseSnapshot,
  loadKnowledgeBase,
} from './loader.ts';
import type {
  CitationAuditResult,
  CitationViolation,
  DeterministicRepairRecord,
  DistilledKnowledgeEntry,
  Kp3AuditFlag,
  Kp3AuditFlagCode,
  PalaceGanZhiMismatch,
} from './types.ts';

export const AUTHORITY_M1_REGEX =
  /(?<!\p{L})(?:nghê\s+hải\s+hạ|nghê\s+sư|thầy\s+nghê|ni\s+haixia|hệ\s+thống\s+thiên\s+kỷ|bài\s+giảng\s+thiên\s+kỷ|tử\s+vi\s+đẩu\s+số\s+toàn\s+thư|tử\s+vi\s+toàn\s+tập|cốt\s+tủy\s+phú|thái\s+vi\s+phú|cổ\s+quyết|cổ\s+phú|cổ\s+nhân\s+dạy|sách\s+xưa\s+chép|khẩu\s+quyết\s+thiên\s+kỷ)(?!\p{L})/giu;

const M2_INTRO_REGEX =
  /(?<!\p{L})(?:có\s+câu|quyết\s+viết|phú\s+viết|khẩu\s+quyết|luận\s+rằng|cổ\s+nhân\s+viết|sách\s+viết|tương\s+truyền|kinh\s+viết)(?!\p{L})/iu;

const M2_QUOTED_TEXT_REGEX = /["""'«„]([^"""'»]{12,120})["""'»]/gu;

export const CITATION_TAG_M3_REGEX = /\[Nguồn:\s*([^\]]*)\]/giu;

const MAX_SEMANTIC_BLOCK_CHARS = 800;

const CANONICAL_STAR_AND_PALACE_TERMS: readonly string[] = Array.from(
  new Set([
    ...Object.values(CN_TO_VI_STAR),
    ...Object.values(CN_TO_VI_PALACE),
    'Mệnh',
    'Thân',
    'Tử Tức',
    'Nô Bộc',
  ]),
).map((t) => t.normalize('NFC').toLowerCase());

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function includesWholeTerm(haystackLower: string, termLower: string): boolean {
  if (!termLower) return false;
  const re = new RegExp(
    `(?<!\\p{L})${escapeRegExp(termLower)}(?!\\p{L})`,
    'u',
  );
  return re.test(haystackLower);
}

function isGeneratedMetaOrNoticeBlock(block: string): boolean {
  const trimmed = block.trim();
  return (
    trimmed.startsWith('> 📚') ||
    trimmed.startsWith('> ⚠️') ||
    trimmed.startsWith('> 📌') ||
    trimmed.startsWith('---') ||
    /^\*?Lưu ý:\s*Nội dung tham khảo phục vụ nghiên cứu mệnh lý Tử Vi Đẩu Số\.?\*?$/iu.test(
      trimmed,
    ) ||
    /^\*📚\s*Nguồn đối chiếu:/iu.test(trimmed)
  );
}

function splitLongParagraphToMaxChars(
  paragraph: string,
  maxChars = MAX_SEMANTIC_BLOCK_CHARS,
): string[] {
  if (paragraph.length <= maxChars) return [paragraph];
  const sentences = paragraph.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (!sentence) continue;
    if (current.length === 0) {
      if (sentence.length <= maxChars) {
        current = sentence;
      } else {
        for (let i = 0; i < sentence.length; i += maxChars) {
          chunks.push(sentence.slice(i, i + maxChars));
        }
      }
      continue;
    }
    if (current.length + 1 + sentence.length <= maxChars) {
      current = `${current} ${sentence}`;
    } else {
      chunks.push(current);
      if (sentence.length <= maxChars) {
        current = sentence;
      } else {
        for (let i = 0; i < sentence.length; i += maxChars) {
          chunks.push(sentence.slice(i, i + maxChars));
        }
        current = '';
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * ĐN-4: Tách văn bản Markdown thành các Khối Ngữ Nghĩa (`Semantic Blocks`):
 * - Đoạn văn phân tách bởi dòng trống (`\n\n+`)
 * - Tiêu đề Markdown (`^#{1,6}\s`)
 * - Từng mục danh sách bullet/số (`^\s*(?:[-*•]|\d+[.)])\s+`)
 * - Giới hạn mỗi khối tối đa `800` ký tự để tránh mất ranh giới cục bộ.
 */
export function splitMarkdownSemanticBlocks(text: string): string[] {
  if (!text || !text.trim()) return [];
  const lines = text.normalize('NFC').split(/\r?\n/);
  const rawBlocks: string[] = [];
  let buffer: string[] = [];

  const flushBuffer = () => {
    if (buffer.length > 0) {
      const joined = buffer.join('\n').trim();
      if (joined) rawBlocks.push(joined);
      buffer = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushBuffer();
      continue;
    }
    if (/^#{1,6}\s+/.test(trimmed)) {
      flushBuffer();
      rawBlocks.push(trimmed);
      continue;
    }
    if (/^(?:[-*•]|\d+[.)])\s+/.test(trimmed)) {
      flushBuffer();
      buffer.push(line);
      continue;
    }
    if (/^>\s*/.test(trimmed)) {
      if (buffer.length > 0 && !buffer[0].trim().startsWith('>')) {
        flushBuffer();
      }
      buffer.push(line);
      continue;
    }
    buffer.push(line);
  }
  flushBuffer();

  const finalBlocks: string[] = [];
  for (const block of rawBlocks) {
    finalBlocks.push(...splitLongParagraphToMaxChars(block, MAX_SEMANTIC_BLOCK_CHARS));
  }
  return finalBlocks;
}

function hasM2QuotedFormulaClaim(block: string): boolean {
  if (!M2_INTRO_REGEX.test(block)) return false;
  M2_QUOTED_TEXT_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = M2_QUOTED_TEXT_REGEX.exec(block)) !== null) {
    const quoted = (m[1] ?? '').normalize('NFC').toLowerCase();
    if (
      CANONICAL_STAR_AND_PALACE_TERMS.some((term) =>
        includesWholeTerm(quoted, term),
      )
    ) {
      return true;
    }
  }
  return false;
}

function collectEntryCheckTerms(entry: DistilledKnowledgeEntry): string[] {
  const terms = new Set<string>();
  const rk = entry.retrievalKeys;
  for (const star of rk.starsVi ?? []) {
    terms.add(star);
  }
  for (const palace of rk.palacesVi ?? []) {
    terms.add(palace);
    if (palace === 'Mệnh Cung') terms.add('Mệnh');
    if (palace === 'Thân Cung') terms.add('Thân');
    if (palace === 'Tử Nữ') terms.add('Tử Tức');
    if (palace === 'Giao Hữu') terms.add('Nô Bộc');
  }
  for (const pat of rk.patternsVi ?? []) {
    terms.add(pat);
  }
  for (const sh of rk.sihuaCombos ?? []) {
    if (sh.starVi) terms.add(sh.starVi);
    terms.add(sh.mutagenVi);
  }
  for (const br of rk.branchesVi ?? []) {
    if (br.length >= 2) terms.add(br);
  }
  return Array.from(terms)
    .map((t) => t.normalize('NFC').toLowerCase().trim())
    .filter((t) => t.length >= 2);
}

function hasConcreteEntityAnchor(entry: DistilledKnowledgeEntry): boolean {
  if (entry.category === '07-methodology') return false;
  const rk = entry.retrievalKeys;
  if ((rk.starsVi ?? []).some((s) => Boolean(s && s.trim()))) return true;
  if ((rk.patternsVi ?? []).some((p) => Boolean(p && p.trim()))) return true;
  if ((rk.sihuaCombos ?? []).some((sh) => Boolean(sh.starVi && sh.starVi.trim()))) return true;
  return false;
}

function hasEntityOverlapWithEntry(
  blockTextWithoutTags: string,
  entry: DistilledKnowledgeEntry,
): boolean {
  // W3: Mục phương pháp luận tổng quát (07-methodology) hoặc mục không có neo thực thể cụ thể được miễn V3.
  if (!hasConcreteEntityAnchor(entry)) return true;
  const lower = blockTextWithoutTags.normalize('NFC').toLowerCase();
  const terms = collectEntryCheckTerms(entry);
  if (terms.length === 0) return true;
  return terms.some((term) => includesWholeTerm(lower, term));
}

export function buildReferenceAddendumBlock(
  usedValidEntries: readonly DistilledKnowledgeEntry[],
): string {
  if (usedValidEntries.length === 0) return '';
  const lines = ['> 📚 **[Tư Liệu Học Thuật Tham Chiếu Trong Chương]**'];
  for (const entry of usedValidEntries) {
    const sr = entry.sourceRef;
    const videoMeta =
      sr.bvids.length > 0
        ? ` · Video ${sr.bvids[0]}${sr.timeRangeHms ? ` (${sr.timeRangeHms})` : ''}`
        : sr.timeRangeHms
          ? ` (${sr.timeRangeHms})`
          : '';
    const licenseLabel =
      sr.sourceLicense === 'CC-BY-NC-SA-4.0'
        ? 'CC-BY-NC-SA-4.0'
        : 'Cổ thư Public Domain';
    lines.push(
      `> - \`[${entry.id}]\` ${sr.workTitleVi} · **${sr.groupTitleVi}**${videoMeta} *(${licenseLabel})*`,
    );
  }
  return lines.join('\n');
}

export function buildVerificationWarningBlock(hasIssues: boolean): string {
  if (!hasIssues) return '';
  return `> ⚠️ **[Ghi Chú Kiểm Chứng Nguồn Học Thuật]**: Trong bài có một số nhận định mở rộng chưa gắn mã thẻ đối chiếu trực tiếp từ kho trích đoạn của lượt sinh này. Người đọc lưu ý: chỉ những luận điểm có gắn thẻ \`[Nguồn: ...]\` thuộc mục *Tư liệu học thuật tham chiếu* bên trên mới được truy vết nguyên văn từ bài giảng Thiên Kỷ / cổ thư đã nạp; các phần còn lại là phân tích suy diễn theo cấu trúc tinh đẩu trên lá số.`;
}

export function buildChatCitationFooter(params: {
  usedValidEntries: readonly DistilledKnowledgeEntry[];
  hasAuditIssues: boolean;
}): string {
  const parts: string[] = [];
  if (params.usedValidEntries.length > 0) {
    const items = params.usedValidEntries.slice(0, 3).map((e) => {
      const time = e.sourceRef.timeRangeHms ? ` (${e.sourceRef.timeRangeHms})` : '';
      return `[${e.id}] ${e.sourceRef.workTitleVi}${time} — ${e.sourceRef.groupTitleVi}`;
    });
    parts.push(`---\n*📚 Nguồn đối chiếu: ${items.join(' · ')}*`);
  }
  if (params.hasAuditIssues) {
    parts.push(
      `> *⚠️ Lưu ý kiểm chứng: Nhận định trên được tổng hợp từ cấu trúc tinh đẩu của lá số; kho trích đoạn nạp cho lượt hỏi này không chứa nguyên văn khẩu quyết cho chi tiết không gắn mã nguồn hợp lệ.*`,
    );
  }
  return parts.join('\n\n');
}

const PERIOD_ROLE_CANONICAL_BY_LOWER = new Map<string, string>([
  ['mệnh cung', 'Mệnh Cung'],
  ['mệnh', 'Mệnh Cung'],
  ['huynh đệ', 'Huynh Đệ'],
  ['phu thê', 'Phu Thê'],
  ['tử nữ', 'Tử Nữ'],
  ['tử tức', 'Tử Nữ'],
  ['tài bạch', 'Tài Bạch'],
  ['tật ách', 'Tật Ách'],
  ['thiên di', 'Thiên Di'],
  ['giao hữu', 'Giao Hữu'],
  ['nô bộc', 'Giao Hữu'],
  ['quan lộc', 'Quan Lộc'],
  ['điền trạch', 'Điền Trạch'],
  ['phúc đức', 'Phúc Đức'],
  ['phụ mẫu', 'Phụ Mẫu'],
]);

const NATAL_PALACE_CANONICAL_BY_LOWER = PERIOD_ROLE_CANONICAL_BY_LOWER;

const STEM_CANONICAL_BY_LOWER = new Map<string, string>(
  VI_STEMS.map((s) => [s.toLowerCase(), s]),
);

const BRANCH_CANONICAL_BY_LOWER = new Map<string, string>([
  ...VI_BRANCHES.map((b) => [b.toLowerCase(), b] as [string, string]),
  ['tị', 'Tỵ'],
]);

function splitRawBlockIntoSentences(block: string): string[] {
  if (!block || !block.trim()) return [];
  const lines = block.normalize('NFC').split(/\r?\n/);
  const sentences: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/(?<=(?<!\d)[.!?])\s+/u);
    for (const part of parts) {
      const s = part.trim();
      if (s) sentences.push(s);
    }
  }
  return sentences;
}

const STEM_NAMES_PATTERN = 'Giáp|Ất|Bính|Đinh|Mậu|Kỷ|Canh|Tân|Nhâm|Quý';
const BRANCH_NAMES_PATTERN = 'Tý|Sửu|Dần|Mão|Thìn|Tỵ|Tị|Ngọ|Mùi|Thân|Dậu|Tuất|Hợi';
const PALACE_NAMES_PATTERN =
  'Mệnh\\s+Cung|Mệnh|Huynh\\s+Đệ|Phu\\s+Thê|Tử\\s+Nữ|Tử\\s+Tức|Tài\\s+Bạch|Tật\\s+Ách|Thiên\\s+Di|Giao\\s+Hữu|Nô\\s+Bộc|Quan\\s+Lộc|Điền\\s+Trạch|Phúc\\s+Đức|Phụ\\s+Mẫu';

const PALACE_GANZHI_MENTION_RE = new RegExp(
  `(?<!\\p{L})Cung\\s+(?!Lưu\\b|Đại\\s+Hạn\\b|Tiểu\\s+Hạn\\b)(${PALACE_NAMES_PATTERN})\\s*(?:\\(\\s*(${STEM_NAMES_PATTERN})\\s+(${BRANCH_NAMES_PATTERN})\\s*\\)|(?:tại|ở|đóng\\s+(?:tại|ở))\\s+(${STEM_NAMES_PATTERN})\\s+(${BRANCH_NAMES_PATTERN})(?!\\p{L}))`,
  'giu',
);

export function verifyPalaceGanZhiMentions(
  text: string,
  palaceGanZhiMap: Record<string, string>,
): PalaceGanZhiMismatch[] {
  if (!text || !palaceGanZhiMap) return [];
  const blocks = splitNonMetaBodyBlocks(text);
  const mismatches: PalaceGanZhiMismatch[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    PALACE_GANZHI_MENTION_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = PALACE_GANZHI_MENTION_RE.exec(block)) !== null) {
      const rawPalace = (m[1] ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
      const palaceVi = NATAL_PALACE_CANONICAL_BY_LOWER.get(rawPalace);
      if (!palaceVi) continue;

      const expectedGanZhi = palaceGanZhiMap[palaceVi];
      if (!expectedGanZhi) continue;

      const rawStem = (m[2] ?? m[4] ?? '').trim().toLowerCase();
      const rawBranch = (m[3] ?? m[5] ?? '').trim().toLowerCase();
      const foundStem = STEM_CANONICAL_BY_LOWER.get(rawStem);
      const foundBranch = BRANCH_CANONICAL_BY_LOWER.get(rawBranch);
      if (!foundStem || !foundBranch) continue;

      const foundGanZhi = `${foundStem} ${foundBranch}`;
      if (foundGanZhi.toLowerCase() !== expectedGanZhi.trim().toLowerCase()) {
        const dedup = `${palaceVi}::${foundGanZhi}::${expectedGanZhi}`;
        if (seen.has(dedup)) continue;
        seen.add(dedup);
        mismatches.push({
          type: 'PALACE_GANZHI_MISMATCH',
          palaceVi,
          foundGanZhi,
          expectedGanZhi,
        });
      }
    }
  }

  return mismatches;
}

const CANONICAL_PALACE_HEADING_RE = new RegExp(
  `^\\s*#{2,4}\\s+(?:\\d+[.)]\\s*)?Cung\\s+(${PALACE_NAMES_PATTERN})(?=$|[\\s(\\[,:–—-])`,
  'iu',
);

const BARE_CITATION_ID_RE = /(?<!\[)(?<!`)\[([A-Za-z0-9_-]{4,24})\](?!\()(?!`)(?!\])/g;

function getLoadedKnowledgeBaseIdSetUpper(): Set<string> {
  const ids = new Set<string>();
  try {
    const snap = getKnowledgeBaseSnapshot();
    const resolved = snap.loaded ? snap : loadKnowledgeBase();
    for (const key of resolved.indices.byId.keys()) {
      const upper = key.trim().toUpperCase();
      if (upper) ids.add(upper);
    }
  } catch {
    // Bỏ qua nếu không đọc được thư mục KB trên đĩa
  }
  return ids;
}

/**
 * Z3 (P16): Chuẩn hóa thẻ `[ID]` trần thành `[Nguồn: ID]` trên thân bài TRƯỚC bước V1/V3/W5.
 * Chỉ chuyển đổi nếu nằm ngoài khối meta/tham chiếu, không đứng sau `[Nguồn:`, không phải Markdown link `[text](url)`,
 * khớp `CITATION_ID_SYNTAX_RE` và tồn tại trong `allowedById` HOẶC kho KB đã nạp.
 */
export function normalizeBareCitationTagsInBody(
  text: string,
  knownIdsUpper: ReadonlySet<string>,
): { text: string; normalizedBareIds: string[] } {
  if (!text || knownIdsUpper.size === 0) {
    return { text, normalizedBareIds: [] };
  }

  const lines = text.split(/\r?\n/);
  const normalizedIdsSet = new Set<string>();
  let inMetaBlock = false;

  const updatedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (
      trimmed.startsWith('> 📚') ||
      trimmed.startsWith('> ⚠️') ||
      trimmed.startsWith('> 📌')
    ) {
      inMetaBlock = true;
      return line;
    }
    if (inMetaBlock) {
      if (trimmed.startsWith('>')) return line;
      inMetaBlock = false;
    }
    if (/^\*?📚\s*Nguồn đối chiếu:/iu.test(trimmed)) {
      return line;
    }

    return line.replace(
      BARE_CITATION_ID_RE,
      (fullMatch, rawInner: string, offset: number, fullLine: string) => {
        const before = fullLine.slice(Math.max(0, offset - 12), offset);
        if (/\[Nguồn:\s*$/iu.test(before)) return fullMatch;
        const idUpper = rawInner.trim().toUpperCase();
        if (!CITATION_ID_SYNTAX_RE.test(idUpper)) return fullMatch;
        if (!knownIdsUpper.has(idUpper)) return fullMatch;
        normalizedIdsSet.add(idUpper);
        return `[Nguồn: ${idUpper}]`;
      },
    );
  });

  return {
    text: updatedLines.join('\n'),
    normalizedBareIds: Array.from(normalizedIdsSet),
  };
}

function derivePalaceGanZhiMapFromChart(chart: ZiweiChart): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of chart.palaces) {
    const palaceVi = translatePalaceName(p.name);
    const stemVi = VI_STEMS[p.stem] ?? '';
    const branchVi = VI_BRANCHES[p.branch] ?? '';
    if (palaceVi && stemVi && branchVi) {
      map[palaceVi] = `${stemVi} ${branchVi}`;
    }
  }
  return map;
}

function splitNonMetaBodyBlocks(text: string): string[] {
  if (!text || !text.trim()) return [];
  const lines = text.normalize('NFC').split(/\r?\n/);
  const rawBlocks: string[] = [];
  let buffer: string[] = [];

  const flushBuffer = () => {
    if (buffer.length > 0) {
      const joined = buffer.join('\n').trim();
      if (joined && !isGeneratedMetaOrNoticeBlock(joined)) {
        rawBlocks.push(joined);
      }
      buffer = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushBuffer();
      continue;
    }
    if (/^#{1,6}\s+/.test(trimmed)) {
      flushBuffer();
      rawBlocks.push(trimmed);
      continue;
    }
    if (/^(?:[-*•]|\d+[.)])\s+/.test(trimmed)) {
      flushBuffer();
      buffer.push(line);
      continue;
    }
    if (/^>\s*/.test(trimmed)) {
      if (buffer.length > 0 && !buffer[0].trim().startsWith('>')) {
        flushBuffer();
      }
      buffer.push(line);
      continue;
    }
    buffer.push(line);
  }
  flushBuffer();

  const finalBlocks: string[] = [];
  for (const raw of rawBlocks) {
    if (isGeneratedMetaOrNoticeBlock(raw)) continue;
    finalBlocks.push(...splitLongParagraphToMaxChars(raw, MAX_SEMANTIC_BLOCK_CHARS));
  }
  return finalBlocks;
}

interface PalaceBlockSegment {
  palaceVi: string | null;
  text: string;
}

function segmentTextByCanonicalPalaceHeadings(
  text: string,
  chart?: ZiweiChart,
): PalaceBlockSegment[] {
  const workingText = chart ? enforceCanonicalPalaceGroupHeadings(text, chart) : text;
  const lines = workingText.normalize('NFC').split(/\r?\n/);
  const segments: PalaceBlockSegment[] = [];
  let currentPalace: string | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    const joined = currentLines.join('\n').trim();
    if (joined) {
      segments.push({ palaceVi: currentPalace, text: joined });
    }
    currentLines = [];
  };

  for (const line of lines) {
    const m = line.match(CANONICAL_PALACE_HEADING_RE);
    if (m) {
      flush();
      const rawPal = m[1].replace(/\s+/g, ' ').trim().toLowerCase();
      currentPalace = NATAL_PALACE_CANONICAL_BY_LOWER.get(rawPal) ?? null;
      currentLines.push(line);
    } else {
      currentLines.push(line);
    }
  }
  flush();

  return segments;
}

interface DaXianPeriodRuleInfo {
  ageKey: string;
  ageLabel: string;
  stemVi: string;
  palaceVi: string;
}

function buildDaXianPeriodLookup(chart: ZiweiChart): {
  byAgeKey: Map<string, DaXianPeriodRuleInfo>;
  currentPeriod: DaXianPeriodRuleInfo | null;
} {
  const byAgeKey = new Map<string, DaXianPeriodRuleInfo>();
  let currentPeriod: DaXianPeriodRuleInfo | null = null;

  for (let i = 0; i < (chart.daXians?.length ?? 0); i++) {
    const dx = chart.daXians[i];
    const pal = chart.palaces.find((p) => p.branch === dx.palaceBranch);
    if (!pal) continue;
    const stemVi = VI_STEMS[pal.stem] ?? '';
    const palaceVi = translatePalaceName(pal.name);
    if (!stemVi) continue;
    const ageKey = `${dx.startAge}-${dx.endAge}`;
    const info: DaXianPeriodRuleInfo = {
      ageKey,
      ageLabel: `${dx.startAge}–${dx.endAge}`,
      stemVi,
      palaceVi,
    };
    byAgeKey.set(ageKey, info);
    if (i === chart.currentDaXianIndex) {
      currentPeriod = info;
    }
  }

  return { byAgeKey, currentPeriod };
}

const AGE_RANGE_WITH_PREFIX_RE =
  /(?:từ\s+)?(\d{1,3})\s*(?:[-–—~]|đến|tới)\s*(\d{1,3})(?:\s*tuổi)?/giu;

const EXPLICIT_DAXIAN_BRACKET_RE = new RegExp(
  `\\[Tứ\\s+Hóa\\s+Đại\\s+Hạn[^\\]]*?(?:Kỳ\\s*)?(?:(\\d{1,3})\\s*(?:[-–—~]|đến|tới)\\s*(\\d{1,3})[^\\]]*?)?Can\\s+(${STEM_NAMES_PATTERN})(?!\\p{L})[^\\]]*?\\]`,
  'giu',
);

const EXPLICIT_DAXIAN_PARENS_RE = new RegExp(
  `Đại\\s+Hạn(?:\\s+hiện\\s+tại)?(?:\\s+Kỳ)?\\s*(?:từ\\s+)?(\\d{1,3})\\s*(?:[-–—~]|đến|tới)\\s*(\\d{1,3})(?:\\s*tuổi)?[^.!?\n;]{0,65}?\\(\\s*(?:[^()]*?[·,;]\\s*)?(?:Can\\s+)?(${STEM_NAMES_PATTERN})(?:\\s+(?:${BRANCH_NAMES_PATTERN}))?\\s*\\)`,
  'giu',
);

const DAXIAN_CONTEXT_RE = /Đại\s+Hạn|Tứ\s+Hóa\s+Đại\s+Hạn/iu;
const DAXIAN_CAN_STEM_RE = new RegExp(`(?<!\\p{L})Can\\s+(${STEM_NAMES_PATTERN})(?!\\p{L})`, 'giu');

function stripMatchedSpans(sentence: string, ranges: Array<[number, number]>): string {
  if (ranges.length === 0) return sentence;
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  let out = '';
  let cursor = 0;
  for (const [s, e] of sorted) {
    if (s > cursor) out += sentence.slice(cursor, s);
    out += ' '.repeat(Math.max(1, e - s));
    cursor = Math.max(cursor, e);
  }
  if (cursor < sentence.length) out += sentence.slice(cursor);
  return out;
}

/**
 * W2 (P04): Soát lỗi gán sai Thiên Can Đại Hạn theo cặp (khoảng tuổi, can) ở cấp CÂU/MỆNH ĐỀ.
 * - Phân đoạn theo block `### Cung ...` sau chuẩn hóa tiêu đề.
 * - Horizon: tập can hợp lệ = tập governingDaXian trong cửa sổ năm.
 */
export function verifyDaXianStemsInText(
  text: string,
  chart: ZiweiChart,
  options?: {
    isHorizon?: boolean;
    horizonYears?: number;
  },
): Kp3AuditFlag[] {
  if (!text || !chart?.daXians?.length) return [];

  const { byAgeKey, currentPeriod } = buildDaXianPeriodLookup(chart);
  const flags: Kp3AuditFlag[] = [];
  const seen = new Set<string>();

  const validHorizonStems = new Set<string>();
  if (options?.isHorizon) {
    const yearsCount = options.horizonYears ?? 10;
    const hCtx = buildMultiYearHorizonContext(chart, 2026, 2026 + yearsCount - 1);
    for (const row of hCtx.rows) {
      if (row.governingDaXian && !row.governingDaXian.isPreDaXian) {
        const dx = chart.daXians[row.governingDaXian.daXianIndex];
        const dxPalace = dx
          ? chart.palaces.find((p) => p.branch === dx.palaceBranch)
          : undefined;
        const stem =
          (dxPalace ? VI_STEMS[dxPalace.stem] : '') ||
          row.governingDaXian.ganZhiVi.trim().split(/\s+/)[0] ||
          '';
        if (stem && STEM_CANONICAL_BY_LOWER.has(stem.toLowerCase())) {
          validHorizonStems.add(stem.toLowerCase());
        }
      }
    }
  }

  const pushFlag = (
    ageLabel: string,
    foundStem: string,
    expectedDesc: string,
    palaceVi: string | null,
    excerpt: string,
  ) => {
    const dedup = `${ageLabel}::${foundStem.toLowerCase()}::${expectedDesc}::${palaceVi ?? ''}`;
    if (seen.has(dedup)) return;
    seen.add(dedup);
    flags.push({
      code: 'DAXIAN_STEM_MISMATCH',
      severity: 'critical',
      ...(palaceVi ? { palaceVi } : {}),
      ...(ageLabel ? { ageRange: ageLabel } : {}),
      excerpt: excerpt.slice(0, 140),
      messageVi: ageLabel
        ? `Đại Hạn ${ageLabel} ghi Thiên Can "${foundStem}" không khớp lá số (đúng là Can ${expectedDesc}).`
        : `Ngữ cảnh Đại Hạn ghi Thiên Can "${foundStem}" nằm ngoài kỳ Đại Hạn hợp lệ (${expectedDesc}).`,
    });
  };

  const segments = segmentTextByCanonicalPalaceHeadings(text, chart);

  for (const seg of segments) {
    const blocks = splitNonMetaBodyBlocks(seg.text);
    for (const block of blocks) {
      const sentences = splitRawBlockIntoSentences(block);
      for (const sentence of sentences) {
        const matchedSpans: Array<[number, number]> = [];

        // 1) Bắt các thẻ tường minh dạng `[Tứ Hóa Đại Hạn ... (X–Y · Can Z)]`
        EXPLICIT_DAXIAN_BRACKET_RE.lastIndex = 0;
        let bMatch: RegExpExecArray | null;
        while ((bMatch = EXPLICIT_DAXIAN_BRACKET_RE.exec(sentence)) !== null) {
          matchedSpans.push([bMatch.index, bMatch.index + bMatch[0].length]);
          const foundStem = STEM_CANONICAL_BY_LOWER.get((bMatch[3] ?? '').toLowerCase());
          if (!foundStem) continue;
          if (bMatch[1] && bMatch[2]) {
            const ageKey = `${Number(bMatch[1])}-${Number(bMatch[2])}`;
            const periodInfo = byAgeKey.get(ageKey);
            if (periodInfo && periodInfo.stemVi.toLowerCase() !== foundStem.toLowerCase()) {
              pushFlag(
                periodInfo.ageLabel,
                foundStem,
                periodInfo.stemVi,
                seg.palaceVi ?? periodInfo.palaceVi,
                sentence,
              );
            }
          } else if (options?.isHorizon && validHorizonStems.size > 0) {
            if (!validHorizonStems.has(foundStem.toLowerCase())) {
              const expectedList = Array.from(validHorizonStems)
                .map((s) => STEM_CANONICAL_BY_LOWER.get(s) ?? s)
                .join('/');
              pushFlag('', foundStem, expectedList, seg.palaceVi, sentence);
            }
          }
        }

        // 2) Bắt mẫu `Đại Hạn X–Y tuổi (Can Z)` / `Đại Hạn X–Y tuổi (Z Chi)`
        EXPLICIT_DAXIAN_PARENS_RE.lastIndex = 0;
        let pMatch: RegExpExecArray | null;
        while ((pMatch = EXPLICIT_DAXIAN_PARENS_RE.exec(sentence)) !== null) {
          matchedSpans.push([pMatch.index, pMatch.index + pMatch[0].length]);
          const ageKey = `${Number(pMatch[1])}-${Number(pMatch[2])}`;
          const foundStem = STEM_CANONICAL_BY_LOWER.get((pMatch[3] ?? '').toLowerCase());
          if (!foundStem) continue;
          const periodInfo = byAgeKey.get(ageKey);
          if (periodInfo && periodInfo.stemVi.toLowerCase() !== foundStem.toLowerCase()) {
            pushFlag(
              periodInfo.ageLabel,
              foundStem,
              periodInfo.stemVi,
              seg.palaceVi ?? periodInfo.palaceVi,
              sentence,
            );
          }
        }

        // 3) Quét cấp mệnh đề trong phần còn lại của câu (chỉ bắt Can đi kèm ngữ cảnh Đại Hạn)
        const remainder = stripMatchedSpans(sentence, matchedSpans);
        if (!DAXIAN_CONTEXT_RE.test(remainder)) continue;

        const clauses = remainder.split(
          /(?:\s*;\s*|\s+[—–]\s+|\s+(?:chuyển\s+sang|bước\s+sang|sang\s+đến|trong\s+khi)\s+)/iu,
        );

        let lastAgeInSentence: DaXianPeriodRuleInfo | null = null;
        for (const clause of clauses) {
          if (!clause.trim()) continue;
          const ageMatches: Array<{ idx: number; info: DaXianPeriodRuleInfo }> = [];
          AGE_RANGE_WITH_PREFIX_RE.lastIndex = 0;
          let am: RegExpExecArray | null;
          while ((am = AGE_RANGE_WITH_PREFIX_RE.exec(clause)) !== null) {
            const ageKey = `${Number(am[1])}-${Number(am[2])}`;
            const info = byAgeKey.get(ageKey);
            if (info) {
              ageMatches.push({ idx: am.index, info });
              lastAgeInSentence = info;
            }
          }

          if (!DAXIAN_CONTEXT_RE.test(clause) && ageMatches.length === 0) {
            continue;
          }

          DAXIAN_CAN_STEM_RE.lastIndex = 0;
          let cm: RegExpExecArray | null;
          while ((cm = DAXIAN_CAN_STEM_RE.exec(clause)) !== null) {
            const beforeCtx = clause.slice(Math.max(0, cm.index - 28), cm.index);
            // Bỏ qua nếu đây là Thiên Can Bản Mệnh / Lưu Niên / Phi Tinh / Tự Hóa / Can Cung
            if (/(?:Bản\s+Mệnh|Lưu\s+Niên|năm\s+sinh|Phi\s+Tinh|Tự\s+Hóa|Can\s+Cung|cung\s+gốc)[^.]{0,12}$/iu.test(beforeCtx)) {
              continue;
            }
            const foundStem = STEM_CANONICAL_BY_LOWER.get((cm[1] ?? '').toLowerCase());
            if (!foundStem) continue;

            // Chọn khoảng tuổi gần nhất trong mệnh đề (ưu tiên đứng trước vị trí Can)
            let pairedAge: DaXianPeriodRuleInfo | null = null;
            if (ageMatches.length > 0) {
              const beforeAges = ageMatches.filter((a) => a.idx <= cm!.index);
              pairedAge =
                beforeAges.length > 0
                  ? beforeAges[beforeAges.length - 1].info
                  : ageMatches[0].info;
            } else if (lastAgeInSentence) {
              pairedAge = lastAgeInSentence;
            }

            if (pairedAge) {
              if (pairedAge.stemVi.toLowerCase() !== foundStem.toLowerCase()) {
                pushFlag(
                  pairedAge.ageLabel,
                  foundStem,
                  pairedAge.stemVi,
                  seg.palaceVi ?? pairedAge.palaceVi,
                  sentence,
                );
              }
            } else if (options?.isHorizon && validHorizonStems.size > 0) {
              if (!validHorizonStems.has(foundStem.toLowerCase())) {
                const expectedList = Array.from(validHorizonStems)
                  .map((s) => STEM_CANONICAL_BY_LOWER.get(s) ?? s)
                  .join('/');
                pushFlag('', foundStem, expectedList, seg.palaceVi, sentence);
              }
            } else if (
              /Đại\s+Hạn\s+hiện\s+tại/iu.test(clause) &&
              currentPeriod &&
              currentPeriod.stemVi.toLowerCase() !== foundStem.toLowerCase()
            ) {
              pushFlag(
                currentPeriod.ageLabel,
                foundStem,
                currentPeriod.stemVi,
                seg.palaceVi ?? currentPeriod.palaceVi,
                sentence,
              );
            }
          }
        }
      }
    }
  }

  return flags;
}

export const KHONG_KIEP_PAIR_RE =
  /(?<!\p{L})(?:(?:bộ\s+đôi|bộ|cặp)\s+)?(?:(?:địa\s+)?không(?:\s*[-/–—]\s*|\s+và\s+|\s+)(?:địa\s+)?kiếp(?:\s*\/\s*(?:địa\s+)?không)?|(?:địa\s+)?kiếp(?:\s*[-/–—]\s*|\s+và\s+|\s+)(?:địa\s+)?không(?:\s*\/\s*(?:địa\s+)?kiếp)?)(?!\p{L})/giu;

export const KHONG_KIEP_NEGATION_RE =
  /(?:không\s+(?:phải(?:\s+là)?|tạo(?:\s+thành)?|kết\s+hợp(?:\s+thành)?|gọi(?:\s+là)?|xem\s+là|coi\s+là|hình\s+thành)\s+(?:bộ\s+đôi\s+|bộ\s+|cặp\s+|cách\s+)?(?:địa\s+)?(?:không[\s\-/–—]+kiếp|kiếp[\s\-/–—]+không)|tránh\s+gọi(?:\s+là)?\s+[^.!?\n]{0,20}?(?:không[\s\-/–—]+kiếp|kiếp[\s\-/–—]+không)|không\s+được\s+gọi\s+(?:là\s+)?['"\u201C\u2018]?(?:bộ\s+|cặp\s+)?(?:địa\s+)?(?:không[\s\-/–—]+kiếp|kiếp[\s\-/–—]+không))/iu;

const QUOTED_SPAN_RE = /["\u201C\u201D'\u2018\u2019«„]([^"\u201C\u201D'\u2018\u2019»\n]{2,200})["\u201C\u201D'\u2018\u2019»]/gu;

const EXPLICIT_NATAL_TRUNG_RE = new RegExp(
  `trùng\\s+(?:cung\\s+)?(?:Bản\\s+Mệnh\\s+gốc\\s*:?\\s*)?(${PALACE_NAMES_PATTERN})(?!\\p{L})`,
  'giu',
);

const EXPLICIT_NATAL_PALACE_RE = new RegExp(
  `(?<!\\p{L})(?:Cung\\s+(?!Lưu\\b|Đại\\s+Hạn\\b)|tại\\s+(?:cung\\s+)?(?:Bản\\s+Mệnh\\s+gốc\\s*:?\\s*)?)(${PALACE_NAMES_PATTERN})(?!\\p{L})`,
  'giu',
);

const PERIOD_ROLE_PALACE_RE = new RegExp(
  `(?<!\\p{L})Cung\\s+(?:Lưu|Đại\\s+Hạn)\\s+(${PALACE_NAMES_PATTERN})(?!\\p{L})`,
  'giu',
);

function buildKhongKiepSanFangMap(chart: ZiweiChart): Map<string, boolean> {
  const byBranch = new Map<number, Set<string>>();
  for (const p of chart.palaces) {
    const names = new Set<string>();
    for (const s of p.stars) {
      names.add(translateStarName(s.name));
    }
    byBranch.set(p.branch, names);
  }

  const result = new Map<string, boolean>();
  for (const p of chart.palaces) {
    const natalName = translatePalaceName(p.name);
    if (!natalName) continue;
    const branches = [
      p.branch,
      (p.branch + 4) % 12,
      (p.branch + 8) % 12,
      (p.branch + 6) % 12,
    ];
    let hasDiaKhong = false;
    let hasDiaKiep = false;
    for (const b of branches) {
      const stars = byBranch.get(b);
      if (!stars) continue;
      if (stars.has('Địa Không')) hasDiaKhong = true;
      if (stars.has('Địa Kiếp')) hasDiaKiep = true;
    }
    result.set(natalName, hasDiaKhong && hasDiaKiep);
  }
  return result;
}

/**
 * ĐK-HD2-01 (1.7.0): Kiểm tra phạm vi các cung của chương hiện tại có ít nhất 1 cung
 * hội đủ cả Địa Không lẫn Địa Kiếp trong Bản cung ∪ Tam Phương Tứ Chính hay không.
 */
export function chapterScopeHasKhongKiepPair(
  chart: ZiweiChart,
  palaceNamesVi: readonly string[],
): boolean {
  if (!chart?.palaces?.length || !Array.isArray(palaceNamesVi) || palaceNamesVi.length === 0) {
    return false;
  }
  const sanFangMap = buildKhongKiepSanFangMap(chart);
  for (const name of palaceNamesVi) {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) continue;
    const canon = PERIOD_ROLE_CANONICAL_BY_LOWER.get(trimmed.toLowerCase()) ?? trimmed;
    if (sanFangMap.get(canon) === true) {
      return true;
    }
  }
  return false;
}

function resolvePeriodRoleToNatalMap(
  chart: ZiweiChart,
  periodContext?: YunxianPeriodContext | null,
  sectionId?: string,
): { roleMap: Map<string, string>; activatedNatalPalace: string | null } {
  const roleMap = new Map<string, string>();
  let ctx = periodContext ?? null;
  if (!ctx && (sectionId === 'year_2026' || sectionId === 'year_2027')) {
    const year = sectionId === 'year_2026' ? 2026 : 2027;
    ctx = buildYunxianPeriodContext(chart, { mode: 'liunian', year });
  }
  if (!ctx) {
    return { roleMap, activatedNatalPalace: null };
  }

  const branchIndex = ctx.branchIndex;
  const roleOrder = [
    'Mệnh Cung',
    'Huynh Đệ',
    'Phu Thê',
    'Tử Nữ',
    'Tài Bạch',
    'Tật Ách',
    'Thiên Di',
    'Giao Hữu',
    'Quan Lộc',
    'Điền Trạch',
    'Phúc Đức',
    'Phụ Mẫu',
  ];
  for (let offset = 0; offset < 12; offset++) {
    const targetBranch = ((branchIndex - offset) % 12 + 12) % 12;
    const pal = chart.palaces.find((p) => p.branch === targetBranch);
    if (!pal) continue;
    const natalName = translatePalaceName(pal.name);
    const roleCanonical = PERIOD_ROLE_CANONICAL_BY_LOWER.get(roleOrder[offset].toLowerCase());
    if (natalName && roleCanonical) {
      roleMap.set(roleCanonical, natalName);
    }
  }
  return {
    roleMap,
    activatedNatalPalace: ctx.activatedPalace?.natalPalaceNameVi ?? null,
  };
}

function resolveSentenceTargetPalace(
  sentence: string,
  matchIndex: number,
  roleMap: Map<string, string>,
): string | null {
  const candidates: Array<{ idx: number; palaceVi: string }> = [];

  EXPLICIT_NATAL_TRUNG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = EXPLICIT_NATAL_TRUNG_RE.exec(sentence)) !== null) {
    const raw = (m[1] ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    const canon = PERIOD_ROLE_CANONICAL_BY_LOWER.get(raw);
    if (canon) candidates.push({ idx: m.index, palaceVi: canon });
  }

  EXPLICIT_NATAL_PALACE_RE.lastIndex = 0;
  while ((m = EXPLICIT_NATAL_PALACE_RE.exec(sentence)) !== null) {
    const raw = (m[1] ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    const canon = PERIOD_ROLE_CANONICAL_BY_LOWER.get(raw);
    if (canon) candidates.push({ idx: m.index, palaceVi: canon });
  }

  if (roleMap.size > 0) {
    PERIOD_ROLE_PALACE_RE.lastIndex = 0;
    while ((m = PERIOD_ROLE_PALACE_RE.exec(sentence)) !== null) {
      const rawRole = (m[1] ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
      const roleCanon = PERIOD_ROLE_CANONICAL_BY_LOWER.get(rawRole);
      const natal = roleCanon ? roleMap.get(roleCanon) : undefined;
      if (natal) candidates.push({ idx: m.index, palaceVi: natal });
    }
  }

  if (candidates.length === 0) return null;
  const before = candidates.filter((c) => c.idx <= matchIndex);
  if (before.length > 0) {
    before.sort((a, b) => a.idx - b.idx);
    return before[before.length - 1].palaceVi;
  }
  candidates.sort((a, b) => a.idx - b.idx);
  return candidates[0].palaceVi;
}

function isMatchInsideQuotes(sentence: string, matchStart: number, matchEnd: number): boolean {
  QUOTED_SPAN_RE.lastIndex = 0;
  let qm: RegExpExecArray | null;
  while ((qm = QUOTED_SPAN_RE.exec(sentence)) !== null) {
    const qStart = qm.index;
    const qEnd = qm.index + qm[0].length;
    if (matchStart >= qStart && matchEnd <= qEnd) {
      return true;
    }
  }
  return false;
}

/**
 * W4 (P01+P02): Phát hiện mọi cách gọi họ "Không Kiếp" khi thiếu Địa Không hoặc Địa Kiếp trong Bản cung ∪ Tam Phương Tứ Chính.
 */
export function verifyIllegalKhongKiepMentions(
  text: string,
  chart: ZiweiChart,
  options?: {
    validCitationIdsSetUpper?: ReadonlySet<string>;
    periodContext?: YunxianPeriodContext | null;
    sectionId?: string;
  },
): Kp3AuditFlag[] {
  if (!text || !chart?.palaces?.length) return [];

  const sanFangMap = buildKhongKiepSanFangMap(chart);
  const { roleMap, activatedNatalPalace } = resolvePeriodRoleToNatalMap(
    chart,
    options?.periodContext,
    options?.sectionId,
  );
  const validIdsUpper = options?.validCitationIdsSetUpper ?? new Set<string>();

  const flags: Kp3AuditFlag[] = [];
  const seen = new Set<string>();
  const segments = segmentTextByCanonicalPalaceHeadings(text, chart);

  for (const seg of segments) {
    let lastSectionPalace: string | null = seg.palaceVi ?? null;
    const blocks = splitNonMetaBodyBlocks(seg.text);

    for (const block of blocks) {
      if (/^#{1,3}\s+/.test(block) && !CANONICAL_PALACE_HEADING_RE.test(block)) {
        lastSectionPalace = seg.palaceVi ?? null;
      }

      const sentences = splitRawBlockIntoSentences(block);
      for (const sentence of sentences) {
        const sentenceWithoutTags = sentence.replace(CITATION_TAG_M3_REGEX, ' ');

        // Kiểm tra xem câu này có thẻ `[Nguồn: ...]` hợp lệ (V1 & V3) không
        let sentenceHasValidCitation = false;
        if (validIdsUpper.size > 0) {
          CITATION_TAG_M3_REGEX.lastIndex = 0;
          let tm: RegExpExecArray | null;
          while ((tm = CITATION_TAG_M3_REGEX.exec(sentence)) !== null) {
            const parsed = parseCitationTagInner(tm[1] ?? '');
            if (
              !parsed.isEmptyTag &&
              parsed.candidates.some((c) => c.isValidFormat && validIdsUpper.has(c.idUpper))
            ) {
              sentenceHasValidCitation = true;
              break;
            }
          }
        }

        // Cập nhật ngữ cảnh cung gần nhất trong section nếu câu nhắc đích danh cung
        const mentionedInSentence = resolveSentenceTargetPalace(
          sentenceWithoutTags,
          sentenceWithoutTags.length,
          roleMap,
        );
        if (!seg.palaceVi && mentionedInSentence) {
          lastSectionPalace = mentionedInSentence;
        }

        KHONG_KIEP_PAIR_RE.lastIndex = 0;
        let km: RegExpExecArray | null;
        while ((km = KHONG_KIEP_PAIR_RE.exec(sentenceWithoutTags)) !== null) {
          // Miễn trừ (i): câu phủ định tuân thủ prompt
          if (KHONG_KIEP_NEGATION_RE.test(sentenceWithoutTags)) {
            continue;
          }

          // Miễn trừ (ii): trích dẫn nguyên văn trong ngoặc kép KÈM thẻ [Nguồn: ...] hợp lệ
          if (
            sentenceHasValidCitation &&
            isMatchInsideQuotes(sentenceWithoutTags, km.index, km.index + km[0].length)
          ) {
            continue;
          }

          const resolvedPalace =
            resolveSentenceTargetPalace(sentenceWithoutTags, km.index, roleMap) ??
            seg.palaceVi ??
            lastSectionPalace ??
            activatedNatalPalace;

          if (!resolvedPalace) continue;

          const hasBoth = sanFangMap.get(resolvedPalace) ?? false;
          if (!hasBoth) {
            const dedup = resolvedPalace;
            if (seen.has(dedup)) continue;
            seen.add(dedup);
            flags.push({
              code: 'ILLEGAL_STAR_PAIR_KHONG_KIEP',
              severity: 'critical',
              palaceVi: resolvedPalace,
              excerpt: sentenceWithoutTags.trim().slice(0, 140),
              messageVi: `Cung ${resolvedPalace} gọi "${km[0]}" nhưng Bản cung và Tam Phương Tứ Chính không có đủ cả Địa Không lẫn Địa Kiếp.`,
            });
          }
        }
      }
    }
  }

  return flags;
}

export interface VerifyCitationAuditOptions {
  palaceGanZhiMap?: Record<string, string>;
  chart?: ZiweiChart;
  sectionId?: string;
  chapterMode?: 'overview' | 'palace_group' | 'period' | 'horizon' | 'chat';
  periodContext?: YunxianPeriodContext | null;
  allKnownEntryIds?: ReadonlySet<string> | readonly string[];
}

/**
 * ĐN-4 & ĐN-6 & X2/X3/Z5 + KP-3 đầy đủ (W1–W5) & Z3:
 * - Z3: Chuẩn hóa thẻ `[ID]` trần thành `[Nguồn: ID]` trên thân bài trước V1/V3/W5.
 * - V1/V2/V3: Hậu kiểm chống bịa 3 lớp (W3 miễn mục 07-methodology / không có neo thực thể cụ thể).
 * - KP-3 đầy đủ: W1 (Can Chi cung), W2 (Thiên Can Đại Hạn theo kỳ/Horizon), W4 (Không Kiếp), W5 (chương 0 trích dẫn).
 */
export function verifyAcademicCitationsAndClaims(
  text: string,
  allowedEntries: readonly DistilledKnowledgeEntry[],
  options?: VerifyCitationAuditOptions,
): CitationAuditResult {
  const rawNormalized = (text || '').normalize('NFC');
  const allowedById = new Map<string, DistilledKnowledgeEntry>();
  for (const entry of allowedEntries) {
    allowedById.set(entry.id.trim().toUpperCase(), entry);
  }

  // Z3 (P16): Tập ID nhận diện thẻ trần = allowedById ∪ kho KB đã nạp (hoặc danh sách chỉ định)
  const knownIdsUpper = new Set<string>(allowedById.keys());
  if (options?.allKnownEntryIds) {
    for (const id of options.allKnownEntryIds) {
      const upper = id.trim().toUpperCase();
      if (upper) knownIdsUpper.add(upper);
    }
  } else {
    for (const idUpper of getLoadedKnowledgeBaseIdSetUpper()) {
      knownIdsUpper.add(idUpper);
    }
  }

  const bareNormalized = normalizeBareCitationTagsInBody(rawNormalized, knownIdsUpper);
  const normalized = bareNormalized.text;

  const blocks = splitNonMetaBodyBlocks(normalized);
  const violations: CitationViolation[] = [];
  const v1InvalidIdsSet = new Set<string>();
  const v3MismatchIdsSet = new Set<string>();
  const v2UncitedBlocks: number[] = [];
  const validIdsInOrder: string[] = [];
  const validIdsSeen = new Set<string>();

  for (let idx = 0; idx < blocks.length; idx++) {
    const block = blocks[idx];
    if (!block || isGeneratedMetaOrNoticeBlock(block)) continue;

    CITATION_TAG_M3_REGEX.lastIndex = 0;
    const foundRawInners: string[] = [];
    let tagMatch: RegExpExecArray | null;
    while ((tagMatch = CITATION_TAG_M3_REGEX.exec(block)) !== null) {
      foundRawInners.push(tagMatch[1] ?? '');
    }

    const blockWithoutTags = block.replace(CITATION_TAG_M3_REGEX, ' ');
    const validIdsInBlockSet = new Set<string>();

    for (const rawInner of foundRawInners) {
      const parsed = parseCitationTagInner(rawInner);
      if (parsed.isEmptyTag || parsed.candidates.length === 0) {
        const emptyMarker = '(EMPTY)';
        v1InvalidIdsSet.add(emptyMarker);
        violations.push({
          rule: 'V1',
          citationId: emptyMarker,
          blockIndex: idx,
          blockExcerpt: block.slice(0, 140),
          reasonVi: 'Thẻ [Nguồn: ...] rỗng hoặc chỉ chứa dấu phân cách.',
        });
        continue;
      }

      for (const cand of parsed.candidates) {
        if (!cand.isValidFormat) {
          v1InvalidIdsSet.add(cand.idUpper);
          violations.push({
            rule: 'V1',
            citationId: cand.idUpper,
            blockIndex: idx,
            blockExcerpt: block.slice(0, 140),
            reasonVi: `Mã nguồn "${cand.idUpper}" trong thẻ [Nguồn: ...] không đúng định dạng cho phép.`,
          });
          continue;
        }

        const matchedEntry = allowedById.get(cand.idUpper);
        if (!matchedEntry) {
          v1InvalidIdsSet.add(cand.idUpper);
          violations.push({
            rule: 'V1',
            citationId: cand.idUpper,
            blockIndex: idx,
            blockExcerpt: block.slice(0, 140),
            reasonVi: `Thẻ [Nguồn: ${cand.idUpper}] không nằm trong danh sách mục tri thức đã nạp cho lượt sinh này.`,
          });
          continue;
        }

        if (!hasEntityOverlapWithEntry(blockWithoutTags, matchedEntry)) {
          v3MismatchIdsSet.add(cand.idUpper);
          violations.push({
            rule: 'V3',
            citationId: matchedEntry.id,
            blockIndex: idx,
            blockExcerpt: block.slice(0, 140),
            reasonVi: `Thẻ [Nguồn: ${matchedEntry.id}] được gắn vào khối không nhắc tới sao/cung/cách cục nào của mục nguồn.`,
          });
          continue;
        }

        validIdsInBlockSet.add(cand.idUpper);
        if (!validIdsSeen.has(matchedEntry.id)) {
          validIdsSeen.add(matchedEntry.id);
          validIdsInOrder.push(matchedEntry.id);
        }
      }
    }

    // Z5 (P9): Kiểm V2 nghiêm ngặt theo TỪNG CÂU trên block THÔ trước khi xóa thẻ.
    const sentences = splitRawBlockIntoSentences(block);
    let blockHasV2Violation = false;
    for (const sentence of sentences) {
      const sentenceWithoutTags = sentence.replace(CITATION_TAG_M3_REGEX, ' ');
      AUTHORITY_M1_REGEX.lastIndex = 0;
      const hasM1 = AUTHORITY_M1_REGEX.test(sentenceWithoutTags);
      const hasM2 = hasM2QuotedFormulaClaim(sentenceWithoutTags);

      if (!hasM1 && !hasM2) continue;

      CITATION_TAG_M3_REGEX.lastIndex = 0;
      let sentenceHasValidTag = false;
      let sTagMatch: RegExpExecArray | null;
      while ((sTagMatch = CITATION_TAG_M3_REGEX.exec(sentence)) !== null) {
        const parsedSentenceTag = parseCitationTagInner(sTagMatch[1] ?? '');
        if (
          !parsedSentenceTag.isEmptyTag &&
          parsedSentenceTag.candidates.some(
            (c) => c.isValidFormat && validIdsInBlockSet.has(c.idUpper),
          )
        ) {
          sentenceHasValidTag = true;
          break;
        }
      }

      if (!sentenceHasValidTag) {
        if (!blockHasV2Violation) {
          v2UncitedBlocks.push(idx);
          blockHasV2Violation = true;
        }
        violations.push({
          rule: 'V2',
          blockIndex: idx,
          blockExcerpt: sentence.slice(0, 140),
          reasonVi:
            'Câu có viện dẫn tác giả/trường phái/cổ thư hoặc trích khẩu quyết nhưng không gắn thẻ [Nguồn: ...] hợp lệ ngay trong câu.',
        });
      }
    }
  }

  const v1InvalidIds = Array.from(v1InvalidIdsSet);
  const v3MismatchIds = Array.from(v3MismatchIdsSet);
  const scrubbedInvalidIds = Array.from(
    new Set([...v1InvalidIds, ...v3MismatchIds]),
  );

  const scrubbedText = scrubInvalidCitationTags(normalized, {
    invalidIds: scrubbedInvalidIds,
  });

  // X3: Loại khỏi danh mục tham chiếu mọi ID nằm trong scrubbedInvalidIds
  const scrubbedSetUpper = new Set(
    scrubbedInvalidIds.map((id) => id.trim().toUpperCase()),
  );
  const finalValidIdsInOrder = validIdsInOrder.filter(
    (id) => !scrubbedSetUpper.has(id.trim().toUpperCase()),
  );
  const finalValidSetUpper = new Set(
    finalValidIdsInOrder.map((id) => id.trim().toUpperCase()),
  );

  const usedValidEntries = finalValidIdsInOrder
    .map((id) => allowedById.get(id.toUpperCase()))
    .filter((e): e is DistilledKnowledgeEntry => Boolean(e));

  const hasUncitedClaims =
    v2UncitedBlocks.length > 0 || v3MismatchIds.length > 0 || v1InvalidIds.length > 0;

  // W1: Kiểm tra Can Chi 12 cung Bản Mệnh
  const effectivePalaceGanZhiMap =
    options?.palaceGanZhiMap ??
    (options?.chart ? derivePalaceGanZhiMapFromChart(options.chart) : undefined);

  const palaceGanZhiMismatches = effectivePalaceGanZhiMap
    ? verifyPalaceGanZhiMentions(normalized, effectivePalaceGanZhiMap)
    : [];

  const auditFlags: Kp3AuditFlag[] = [];
  for (const mm of palaceGanZhiMismatches) {
    auditFlags.push({
      code: 'PALACE_GANZHI_MISMATCH',
      severity: 'critical',
      palaceVi: mm.palaceVi,
      messageVi: `Cung ${mm.palaceVi} ghi Can Chi "${mm.foundGanZhi}" không khớp lá số (đúng là "${mm.expectedGanZhi}").`,
    });
  }

  const resolvedChapterMode =
    options?.chapterMode ??
    (options?.sectionId === 'horizon_5y' || options?.sectionId === 'horizon_10y'
      ? 'horizon'
      : options?.sectionId === 'palaces_core' ||
          options?.sectionId === 'palaces_family' ||
          options?.sectionId === 'palaces_social_health'
        ? 'palace_group'
        : options?.sectionId === 'year_2026' || options?.sectionId === 'year_2027'
          ? 'period'
          : options?.periodContext
            ? 'period'
            : undefined);

  // W2: Kiểm tra Thiên Can Đại Hạn theo kỳ / Horizon
  if (options?.chart) {
    const isHorizon = resolvedChapterMode === 'horizon';
    const horizonYears = options?.sectionId === 'horizon_5y' ? 5 : 10;
    auditFlags.push(
      ...verifyDaXianStemsInText(normalized, options.chart, {
        isHorizon,
        horizonYears,
      }),
    );

    // W4: Kiểm tra gọi sai họ Không Kiếp
    auditFlags.push(
      ...verifyIllegalKhongKiepMentions(normalized, options.chart, {
        validCitationIdsSetUpper: finalValidSetUpper,
        periodContext: options.periodContext,
        sectionId: options.sectionId,
      }),
    );
  }

  // W5: Chương nhóm cung hoặc kỳ hạn (ch.2–6) có 0 thẻ [Nguồn: ...] hợp lệ (chỉ khi allowedEntries > 0)
  const isChapter2To6 =
    resolvedChapterMode === 'palace_group' || resolvedChapterMode === 'period';
  if (isChapter2To6 && allowedEntries.length > 0 && finalValidIdsInOrder.length === 0) {
    auditFlags.push({
      code: 'ZERO_CITATIONS_IN_CHAPTER',
      severity: 'medium',
      messageVi: 'Chương không có trích dẫn [Nguồn: ...] hợp lệ nào từ kho tri thức đã nạp.',
    });
  }

  const referenceBlockMarkdown = buildReferenceAddendumBlock(usedValidEntries);
  const warningBlockMarkdown = buildVerificationWarningBlock(hasUncitedClaims);
  const chatFooterMarkdown = buildChatCitationFooter({
    usedValidEntries,
    hasAuditIssues: hasUncitedClaims,
  });

  return {
    validCitationIds: finalValidIdsInOrder,
    usedValidEntries,
    v1InvalidIds,
    v2UncitedBlocks,
    v3MismatchIds,
    scrubbedInvalidIds,
    normalizedBareIds: bareNormalized.normalizedBareIds.filter((id) =>
      finalValidSetUpper.has(id.toUpperCase()),
    ),
    hasUncitedClaims,
    violations,
    palaceGanZhiMismatches,
    auditFlags,
    scrubbedText,
    referenceBlockMarkdown,
    warningBlockMarkdown,
    chatFooterMarkdown,
  };
}

/**
 * A2 (ĐK-157-P04): Chỉ sinh lại tối đa 1 lần khi chương 2–6 hoàn tất (không bị ngắt),
 * có nạp mục KB (allowedEntriesCount > 0), nhưng 0 thẻ [Nguồn: ...] hợp lệ.
 */
export function shouldRetryForZeroCitations(params: {
  validCitationIds: readonly string[];
  allowedEntriesCount: number;
  chapterMode: 'overview' | 'palace_group' | 'period' | 'horizon' | 'chat';
  wasInterrupted: boolean;
  alreadyRetried: boolean;
}): boolean {
  if (params.wasInterrupted || params.alreadyRetried) return false;
  if (params.allowedEntriesCount <= 0) return false;
  if (params.chapterMode !== 'palace_group' && params.chapterMode !== 'period') {
    return false;
  }
  return params.validCitationIds.length === 0;
}

export const RETRY_MIN_LENGTH_RATIO = 0.8;

/**
 * 1.5.9 (A): Quyết định sinh lại khi chương 2–6 hoàn tất (không bị ngắt) nhưng vẫn còn
 * ít nhất 1 cờ `severity: 'critical'` (cơ chế chung theo severity, không hardcode riêng tên cờ).
 */
export function shouldRetryForCriticalFlags(params: {
  auditFlags: readonly Kp3AuditFlag[];
  chapterMode: 'overview' | 'palace_group' | 'period' | 'horizon' | 'chat';
  wasInterrupted: boolean;
  alreadyRetried: boolean;
}): boolean {
  if (params.wasInterrupted || params.alreadyRetried) return false;
  if (params.chapterMode !== 'palace_group' && params.chapterMode !== 'period') {
    return false;
  }
  return params.auditFlags.some((flag) => flag.severity === 'critical');
}

export function countAuditWords(text: string): number {
  const trimmed = (text || '').trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/u).length;
}

export interface AuditComparisonDecision {
  winner: 'first' | 'retry';
  reason:
    | 'new_critical_flag_code'
    | 'fewer_critical_flags'
    | 'more_critical_flags'
    | 'retry_too_short'
    | 'more_valid_citations'
    | 'tied';
  firstCriticalCount: number;
  retryCriticalCount: number;
  firstWordCount: number;
  retryWordCount: number;
  newCriticalCodes: Kp3AuditFlagCode[];
}

/**
 * 1.5.9 (§3.3): Hàm thuần túy chọn bản tốt hơn giữa lần 1 và lần sinh lại theo thứ tự ưu tiên tuyệt đối:
 * (0) Cấm sinh thêm mã cờ critical mới chưa có ở lần 1
 * (1) Giảm số lượng cờ critical
 * (1b) Nếu số cờ critical hòa và bản retry hụt > 20% số từ (tỷ lệ < RETRY_MIN_LENGTH_RATIO) -> giữ bản 1
 * (2) Tăng số thẻ [Nguồn: ...] hợp lệ
 * (3) Hòa toàn bộ -> giữ bản 1
 */
export function chooseBetterAudit(
  firstAudit: Pick<CitationAuditResult, 'auditFlags' | 'validCitationIds'>,
  retryAudit: Pick<CitationAuditResult, 'auditFlags' | 'validCitationIds'>,
  firstText?: string,
  retryText?: string,
): AuditComparisonDecision {
  const firstCriticalFlags = firstAudit.auditFlags.filter(
    (f) => f.severity === 'critical',
  );
  const retryCriticalFlags = retryAudit.auditFlags.filter(
    (f) => f.severity === 'critical',
  );
  const firstCriticalCodes = new Set<Kp3AuditFlagCode>(
    firstCriticalFlags.map((f) => f.code),
  );
  const newCriticalCodes = Array.from(
    new Set<Kp3AuditFlagCode>(
      retryCriticalFlags
        .map((f) => f.code)
        .filter((code) => !firstCriticalCodes.has(code)),
    ),
  );

  const firstWordCount = typeof firstText === 'string' ? countAuditWords(firstText) : 0;
  const retryWordCount = typeof retryText === 'string' ? countAuditWords(retryText) : 0;

  if (newCriticalCodes.length > 0) {
    return {
      winner: 'first',
      reason: 'new_critical_flag_code',
      firstCriticalCount: firstCriticalFlags.length,
      retryCriticalCount: retryCriticalFlags.length,
      firstWordCount,
      retryWordCount,
      newCriticalCodes,
    };
  }

  if (retryCriticalFlags.length < firstCriticalFlags.length) {
    return {
      winner: 'retry',
      reason: 'fewer_critical_flags',
      firstCriticalCount: firstCriticalFlags.length,
      retryCriticalCount: retryCriticalFlags.length,
      firstWordCount,
      retryWordCount,
      newCriticalCodes,
    };
  }

  if (retryCriticalFlags.length > firstCriticalFlags.length) {
    return {
      winner: 'first',
      reason: 'more_critical_flags',
      firstCriticalCount: firstCriticalFlags.length,
      retryCriticalCount: retryCriticalFlags.length,
      firstWordCount,
      retryWordCount,
      newCriticalCodes,
    };
  }

  if (
    typeof firstText === 'string' &&
    typeof retryText === 'string' &&
    firstWordCount > 0 &&
    retryWordCount < firstWordCount * RETRY_MIN_LENGTH_RATIO
  ) {
    return {
      winner: 'first',
      reason: 'retry_too_short',
      firstCriticalCount: firstCriticalFlags.length,
      retryCriticalCount: retryCriticalFlags.length,
      firstWordCount,
      retryWordCount,
      newCriticalCodes,
    };
  }

  if (retryAudit.validCitationIds.length > firstAudit.validCitationIds.length) {
    return {
      winner: 'retry',
      reason: 'more_valid_citations',
      firstCriticalCount: firstCriticalFlags.length,
      retryCriticalCount: retryCriticalFlags.length,
      firstWordCount,
      retryWordCount,
      newCriticalCodes,
    };
  }

  return {
    winner: 'first',
    reason: 'tied',
    firstCriticalCount: firstCriticalFlags.length,
    retryCriticalCount: retryCriticalFlags.length,
    firstWordCount,
    retryWordCount,
    newCriticalCodes,
  };
}

export interface SanFangStarsSummary {
  palaceVi: string;
  ganZhiVi: string;
  allStarsVi: string[];
  khongKiepFamilyPresentVi: string[];
  hasDiaKhong: boolean;
  hasDiaKiep: boolean;
  missingPairStarsVi: string[];
}

const KHONG_KIEP_FAMILY_STARS = ['Địa Không', 'Địa Kiếp', 'Thiên Không'] as const;

/**
 * 1.5.9 (§3.2): Liệt kê tên sao hiện diện trong 4 chi của cung (bản cung + tam hợp + đối cung)
 * từ `chart.palaces` qua `translateStarName`, và đối chiếu với cặp Địa Không + Địa Kiếp.
 */
export function listSanFangStarsVi(
  chart: ZiweiChart,
  palaceVi: string,
): SanFangStarsSummary | null {
  if (!chart?.palaces?.length || !palaceVi) return null;
  const canonicalPalace =
    NATAL_PALACE_CANONICAL_BY_LOWER.get(palaceVi.trim().toLowerCase()) ?? palaceVi.trim();
  const targetPalace = chart.palaces.find(
    (p) => translatePalaceName(p.name) === canonicalPalace,
  );
  if (!targetPalace) return null;

  const branches = new Set<number>([
    targetPalace.branch,
    (targetPalace.branch + 4) % 12,
    (targetPalace.branch + 8) % 12,
    (targetPalace.branch + 6) % 12,
  ]);

  const allStarsSet = new Set<string>();
  for (const p of chart.palaces) {
    if (!branches.has(p.branch)) continue;
    for (const s of p.stars) {
      const starVi = translateStarName(s.name);
      if (starVi) allStarsSet.add(starVi);
    }
  }

  const allStarsVi = Array.from(allStarsSet);
  const hasDiaKhong = allStarsSet.has('Địa Không');
  const hasDiaKiep = allStarsSet.has('Địa Kiếp');
  const missingPairStarsVi = (['Địa Không', 'Địa Kiếp'] as const).filter(
    (star) => !allStarsSet.has(star),
  );
  const khongKiepFamilyPresentVi = KHONG_KIEP_FAMILY_STARS.filter((star) =>
    allStarsSet.has(star),
  );
  const stemVi = VI_STEMS[targetPalace.stem] ?? '';
  const branchVi = VI_BRANCHES[targetPalace.branch] ?? '';
  const ganZhiVi = stemVi && branchVi ? `${stemVi} ${branchVi}` : '';

  return {
    palaceVi: canonicalPalace,
    ganZhiVi,
    allStarsVi,
    khongKiepFamilyPresentVi,
    hasDiaKhong,
    hasDiaKiep,
    missingPairStarsVi,
  };
}

export interface UnrepairableCriticalCase {
  palaceVi: string;
  sentence: string;
  reason: string;
}

export interface DeterministicRepairResult {
  repairedText: string;
  repairs: DeterministicRepairRecord[];
  unrepairableCases: UnrepairableCriticalCase[];
}

interface CriticalFlagHandler {
  buildRetryInstruction: (
    flags: readonly Kp3AuditFlag[],
    chart: ZiweiChart,
  ) => string;
  applyDeterministicRepair?: (
    text: string,
    flags: readonly Kp3AuditFlag[],
    chart: ZiweiChart,
    options?: VerifyCitationAuditOptions & {
      validCitationIdsSetUpper?: ReadonlySet<string>;
    },
  ) => DeterministicRepairResult;
}

const KHONG_KIEP_PAIR_VERB_RE =
  /(?<!\p{L})(?:hội\s+hợp|đồng\s+hành|đồng\s+cung|kết\s+hợp|cặp\s+với|hợp\s+với|hội)(?!\p{L})/iu;

const SAFE_KHONG_KIEP_NOUN_RE =
  /^(?:(?:bộ\s+đôi|cặp\s+đôi|bộ|cặp)\s+)?(?:không(?:\s*[-/–—]\s*|\s+)kiếp(?:\s*\/\s*không)?|kiếp(?:\s*[-/–—]\s*|\s+)không(?:\s*\/\s*kiếp)?)$/iu;

function buildKhongKiepRetryInstructions(
  flags: readonly Kp3AuditFlag[],
  chart: ZiweiChart,
): string {
  const seenPalaces = new Set<string>();
  const directives: string[] = [];

  for (const flag of flags) {
    if (flag.code !== 'ILLEGAL_STAR_PAIR_KHONG_KIEP' || flag.severity !== 'critical') {
      continue;
    }
    const rawPalace = flag.palaceVi?.trim();
    if (!rawPalace || seenPalaces.has(rawPalace)) continue;
    seenPalaces.add(rawPalace);

    const sanFang = listSanFangStarsVi(chart, rawPalace);
    if (!sanFang) {
      directives.push(
        `Lần sinh trước gọi 'Không Kiếp' ở cung ${rawPalace} nhưng Bản cung và Tam Phương Tứ Chính không đủ cả Địa Không lẫn Địa Kiếp. Lần này tuyệt đối không gọi 'Không Kiếp' ở cung ${rawPalace}; chỉ gọi đúng tên sao thực sự có mặt trong lá số.`,
      );
      continue;
    }

    const palaceWithGanZhi = sanFang.ganZhiVi
      ? `${sanFang.palaceVi} (${sanFang.ganZhiVi})`
      : sanFang.palaceVi;
    const missingLabel =
      sanFang.missingPairStarsVi.length > 0
        ? sanFang.missingPairStarsVi.join(' và ')
        : 'đủ cặp Địa Không + Địa Kiếp';

    if (sanFang.khongKiepFamilyPresentVi.length > 0) {
      const presentLabel = sanFang.khongKiepFamilyPresentVi.join(', ');
      directives.push(
        `Lần sinh trước gọi 'Không Kiếp' ở cung ${palaceWithGanZhi}, nhưng cung này và Tam Phương Tứ Chính chỉ có ${presentLabel} — không có ${missingLabel}. Lần này tuyệt đối không gọi 'Không Kiếp' ở cung ${sanFang.palaceVi}; chỉ gọi đúng tên sao có mặt: '${presentLabel}'.`,
      );
    } else {
      directives.push(
        `Lần sinh trước gọi 'Không Kiếp' ở cung ${palaceWithGanZhi}, nhưng cung này và Tam Phương Tứ Chính không có Địa Không và không có Địa Kiếp. Lần này tuyệt đối không gọi 'Không Kiếp' ở cung ${sanFang.palaceVi}.`,
      );
    }
  }

  return directives.join('\n');
}

function resolveCanonicalHeadingPalaceFromLine(
  line: string,
  chart: ZiweiChart,
): string | null {
  if (!CANONICAL_PALACE_HEADING_RE.test(line)) return null;
  const normalizedHeading = enforceCanonicalPalaceGroupHeadings(line, chart);
  const m = normalizedHeading.match(CANONICAL_PALACE_HEADING_RE);
  if (!m) return null;
  const rawPal = m[1].replace(/\s+/g, ' ').trim().toLowerCase();
  return NATAL_PALACE_CANONICAL_BY_LOWER.get(rawPal) ?? null;
}

function repairIllegalKhongKiepInText(
  text: string,
  flags: readonly Kp3AuditFlag[],
  chart: ZiweiChart,
  options?: VerifyCitationAuditOptions & {
    validCitationIdsSetUpper?: ReadonlySet<string>;
  },
): DeterministicRepairResult {
  const emptyResult: DeterministicRepairResult = {
    repairedText: text,
    repairs: [],
    unrepairableCases: [],
  };
  if (!text || !chart?.palaces?.length) return emptyResult;

  const targetPalaces = new Set<string>(
    flags
      .filter(
        (f) =>
          f.code === 'ILLEGAL_STAR_PAIR_KHONG_KIEP' &&
          f.severity === 'critical' &&
          Boolean(f.palaceVi),
      )
      .map((f) => f.palaceVi!.trim()),
  );
  if (targetPalaces.size === 0) return emptyResult;

  const sanFangMap = buildKhongKiepSanFangMap(chart);
  const { roleMap, activatedNatalPalace } = resolvePeriodRoleToNatalMap(
    chart,
    options?.periodContext,
    options?.sectionId,
  );
  const validIdsUpper = options?.validCitationIdsSetUpper ?? new Set<string>();

  const repairs: DeterministicRepairRecord[] = [];
  const unrepairableCases: UnrepairableCriticalCase[] = [];

  const lines = text.normalize('NFC').split('\n');
  let inMetaBlock = false;
  let currentHeadingPalace: string | null = null;
  let lastSectionPalace: string | null = null;

  const updatedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inMetaBlock) inMetaBlock = false;
      return line;
    }

    if (
      trimmed.startsWith('> 📚') ||
      trimmed.startsWith('> ⚠️') ||
      trimmed.startsWith('> 📌')
    ) {
      inMetaBlock = true;
      return line;
    }
    if (inMetaBlock) {
      if (trimmed.startsWith('>')) return line;
      inMetaBlock = false;
    }
    if (isGeneratedMetaOrNoticeBlock(trimmed)) {
      return line;
    }

    if (/^#{1,6}\s+/.test(trimmed)) {
      const headingPalace = resolveCanonicalHeadingPalaceFromLine(trimmed, chart);
      if (headingPalace) {
        currentHeadingPalace = headingPalace;
        lastSectionPalace = headingPalace;
      } else if (/^#{1,3}\s+/.test(trimmed)) {
        lastSectionPalace = currentHeadingPalace;
      }
      return line;
    }

    // Bảo toàn khoảng trắng đầu dòng và dấu tách câu trong khi quét từng câu trên dòng
    const tokens = line.split(/(?<=(?<!\d)[.!?])(\s+)/u);
    let lineChanged = false;

    for (let i = 0; i < tokens.length; i += 2) {
      const sentence = tokens[i];
      if (!sentence || !sentence.trim()) continue;

      const sentenceWithoutTagsSameLen = sentence.replace(
        CITATION_TAG_M3_REGEX,
        (match) => ' '.repeat(match.length),
      );
      const sentenceWithoutTags = sentence.replace(CITATION_TAG_M3_REGEX, ' ');

      let sentenceHasValidCitation = false;
      if (validIdsUpper.size > 0) {
        CITATION_TAG_M3_REGEX.lastIndex = 0;
        let tm: RegExpExecArray | null;
        while ((tm = CITATION_TAG_M3_REGEX.exec(sentence)) !== null) {
          const parsed = parseCitationTagInner(tm[1] ?? '');
          if (
            !parsed.isEmptyTag &&
            parsed.candidates.some(
              (c) => c.isValidFormat && validIdsUpper.has(c.idUpper),
            )
          ) {
            sentenceHasValidCitation = true;
            break;
          }
        }
      }

      const mentionedInSentence = resolveSentenceTargetPalace(
        sentenceWithoutTags,
        sentenceWithoutTags.length,
        roleMap,
      );
      if (!currentHeadingPalace && mentionedInSentence) {
        lastSectionPalace = mentionedInSentence;
      }

      if (KHONG_KIEP_NEGATION_RE.test(sentenceWithoutTags)) {
        continue;
      }

      KHONG_KIEP_PAIR_RE.lastIndex = 0;
      const replacements: Array<{
        start: number;
        end: number;
        replacement: string;
        palaceVi: string;
      }> = [];

      let km: RegExpExecArray | null;
      while ((km = KHONG_KIEP_PAIR_RE.exec(sentenceWithoutTagsSameLen)) !== null) {
        const kmStart = km.index;
        const kmEnd = km.index + km[0].length;

        if (
          sentenceHasValidCitation &&
          isMatchInsideQuotes(sentenceWithoutTagsSameLen, kmStart, kmEnd)
        ) {
          continue;
        }

        const resolvedPalace =
          resolveSentenceTargetPalace(
            sentenceWithoutTagsSameLen,
            kmStart,
            roleMap,
          ) ??
          currentHeadingPalace ??
          lastSectionPalace ??
          activatedNatalPalace;

        if (!resolvedPalace) continue;
        if (sanFangMap.get(resolvedPalace)) continue;
        if (!targetPalaces.has(resolvedPalace)) continue;

        if (KHONG_KIEP_PAIR_VERB_RE.test(sentenceWithoutTags)) {
          unrepairableCases.push({
            palaceVi: resolvedPalace,
            sentence: sentence.trim(),
            reason: 'pair_relationship_verb',
          });
          continue;
        }

        const sanFangSummary = listSanFangStarsVi(chart, resolvedPalace);
        if (
          !sanFangSummary ||
          sanFangSummary.khongKiepFamilyPresentVi.length === 0
        ) {
          unrepairableCases.push({
            palaceVi: resolvedPalace,
            sentence: sentence.trim(),
            reason: 'no_replacement_star_present',
          });
          continue;
        }

        // Mở rộng sang trái nếu có "cặp đôi " đứng ngay trước cụm khớp mà KHONG_KIEP_PAIR_RE chưa nuốt
        let spanStart = kmStart;
        const prefixSlice = sentenceWithoutTagsSameLen.slice(0, kmStart);
        const capDoiMatch = prefixSlice.match(/(?<!\p{L})cặp\s+đôi\s+$/iu);
        if (capDoiMatch && typeof capDoiMatch.index === 'number') {
          spanStart = capDoiMatch.index;
        }
        const candidatePhrase = sentenceWithoutTagsSameLen
          .slice(spanStart, kmEnd)
          .trim();

        if (!SAFE_KHONG_KIEP_NOUN_RE.test(candidatePhrase)) {
          unrepairableCases.push({
            palaceVi: resolvedPalace,
            sentence: sentence.trim(),
            reason: 'unsafe_phrase_form',
          });
          continue;
        }

        replacements.push({
          start: spanStart,
          end: kmEnd,
          replacement: sanFangSummary.khongKiepFamilyPresentVi.join(', '),
          palaceVi: resolvedPalace,
        });
      }

      if (replacements.length > 0) {
        replacements.sort((a, b) => a.start - b.start);
        let repairedSentence = '';
        let cursor = 0;
        let lastPalace = replacements[0].palaceVi;
        for (const rep of replacements) {
          if (rep.start < cursor) continue;
          repairedSentence += sentence.slice(cursor, rep.start) + rep.replacement;
          cursor = rep.end;
          lastPalace = rep.palaceVi;
        }
        repairedSentence += sentence.slice(cursor);

        if (repairedSentence !== sentence) {
          repairs.push({
            code: 'ILLEGAL_STAR_PAIR_KHONG_KIEP',
            palaceVi: lastPalace,
            beforeSentence: sentence.trim(),
            afterSentence: repairedSentence.trim(),
          });
          tokens[i] = repairedSentence;
          lineChanged = true;
        }
      }
    }

    return lineChanged ? tokens.join('') : line;
  });

  return {
    repairedText: updatedLines.join('\n'),
    repairs,
    unrepairableCases,
  };
}

/**
 * 1.5.9 (§3.6): Registry mở rộng theo mã cờ critical.
 * Bản 1.5.9 chỉ cài handler cho ILLEGAL_STAR_PAIR_KHONG_KIEP; các mã khác giữ mở cho các bản sau.
 */
const CRITICAL_FLAG_HANDLERS: Partial<
  Record<Kp3AuditFlagCode, CriticalFlagHandler>
> = {
  ILLEGAL_STAR_PAIR_KHONG_KIEP: {
    buildRetryInstruction: buildKhongKiepRetryInstructions,
    applyDeterministicRepair: repairIllegalKhongKiepInText,
  },
};

/**
 * 1.5.9 (§3.2): Tạo chỉ thị sinh lại riêng theo các cờ critical thực sự phát sinh từ verifier & lá số.
 */
export function buildCriticalFlagRetryAddendum(
  auditFlags: readonly Kp3AuditFlag[],
  chart: ZiweiChart,
): string {
  const criticalByCode = new Map<Kp3AuditFlagCode, Kp3AuditFlag[]>();
  for (const flag of auditFlags) {
    if (flag.severity !== 'critical') continue;
    const list = criticalByCode.get(flag.code) ?? [];
    list.push(flag);
    criticalByCode.set(flag.code, list);
  }

  const sections: string[] = [];
  for (const [code, flags] of criticalByCode.entries()) {
    const handler = CRITICAL_FLAG_HANDLERS[code];
    if (!handler) continue;
    const instruction = handler.buildRetryInstruction(flags, chart).trim();
    if (instruction) {
      sections.push(instruction);
    }
  }

  if (sections.length === 0) return '';
  return `\n\n[CHỈ THỊ SỬA LỖI NGHIÊM TRỌNG BẮT BUỘC — LẦN SINH LẠI]:\n${sections.join('\n')}`;
}

/**
 * 1.5.9 (§3.4): Sửa xác định sau vòng sinh lại cho các cờ critical có handler sửa xác định.
 */
export function applyDeterministicCriticalFlagRepairs(
  text: string,
  auditFlags: readonly Kp3AuditFlag[],
  chart: ZiweiChart,
  options?: VerifyCitationAuditOptions & {
    validCitationIdsSetUpper?: ReadonlySet<string>;
  },
): DeterministicRepairResult {
  const criticalByCode = new Map<Kp3AuditFlagCode, Kp3AuditFlag[]>();
  for (const flag of auditFlags) {
    if (flag.severity !== 'critical') continue;
    const list = criticalByCode.get(flag.code) ?? [];
    list.push(flag);
    criticalByCode.set(flag.code, list);
  }

  let workingText = text;
  const allRepairs: DeterministicRepairRecord[] = [];
  const allUnrepairable: UnrepairableCriticalCase[] = [];

  for (const [code, flags] of criticalByCode.entries()) {
    const handler = CRITICAL_FLAG_HANDLERS[code];
    if (!handler?.applyDeterministicRepair) continue;
    const res = handler.applyDeterministicRepair(workingText, flags, chart, options);
    workingText = res.repairedText;
    allRepairs.push(...res.repairs);
    allUnrepairable.push(...res.unrepairableCases);
  }

  return {
    repairedText: workingText,
    repairs: allRepairs,
    unrepairableCases: allUnrepairable,
  };
}

