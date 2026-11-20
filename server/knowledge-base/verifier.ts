import {
  CN_TO_VI_PALACE,
  CN_TO_VI_STAR,
} from '../../src/lib/ziwei/vi-i18n.ts';
import { scrubInvalidCitationTags } from '../../src/lib/ziwei/text-sanitizer.ts';
import type {
  CitationAuditResult,
  CitationViolation,
  DistilledKnowledgeEntry,
} from './types.ts';

export const AUTHORITY_M1_REGEX =
  /(?<!\p{L})(?:nghê\s+hải\s+hạ|nghê\s+sư|thầy\s+nghê|ni\s+haixia|hệ\s+thống\s+thiên\s+kỷ|bài\s+giảng\s+thiên\s+kỷ|tử\s+vi\s+đẩu\s+số\s+toàn\s+thư|tử\s+vi\s+toàn\s+tập|cốt\s+tủy\s+phú|thái\s+vi\s+phú|cổ\s+quyết|cổ\s+phú|cổ\s+nhân\s+dạy|sách\s+xưa\s+chép|khẩu\s+quyết\s+thiên\s+kỷ)(?!\p{L})/giu;

const M2_INTRO_REGEX =
  /(?<!\p{L})(?:có\s+câu|quyết\s+viết|phú\s+viết|khẩu\s+quyết|luận\s+rằng|cổ\s+nhân\s+viết|sách\s+viết|tương\s+truyền|kinh\s+viết)(?!\p{L})/iu;

const M2_QUOTED_TEXT_REGEX = /["""'«„]([^"""'»]{12,120})["""'»]/gu;

export const CITATION_TAG_M3_REGEX =
  /\[Nguồn:\s*([A-Z0-9_-]{4,24})(?:\s*[·,|]\s*[^\]]+)?\]/giu;

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

function hasEntityOverlapWithEntry(
  blockTextWithoutTags: string,
  entry: DistilledKnowledgeEntry,
): boolean {
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

/**
 * ĐN-4 & ĐN-6: Hậu kiểm chống bịa 3 lớp (V1, V2, V3) theo Khối Đoạn văn / Bullet (<= 800 ký tự).
 * - TUYỆT ĐỐI không sửa/viết lại chữ trong câu văn tiếng Việt của AI.
 * - Chỉ gỡ bỏ token `[Nguồn: ID]` sai (`V1` hoặc `V3`) và nối khối tham chiếu / ghi chú kiểm chứng.
 */
export function verifyAcademicCitationsAndClaims(
  text: string,
  allowedEntries: readonly DistilledKnowledgeEntry[],
): CitationAuditResult {
  const normalized = (text || '').normalize('NFC');
  const allowedById = new Map<string, DistilledKnowledgeEntry>();
  for (const entry of allowedEntries) {
    allowedById.set(entry.id.trim().toUpperCase(), entry);
  }

  const blocks = splitMarkdownSemanticBlocks(normalized);
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
    const foundTags: Array<{ rawTag: string; idUpper: string }> = [];
    let tagMatch: RegExpExecArray | null;
    while ((tagMatch = CITATION_TAG_M3_REGEX.exec(block)) !== null) {
      foundTags.push({
        rawTag: tagMatch[0],
        idUpper: (tagMatch[1] ?? '').trim().toUpperCase(),
      });
    }

    const blockWithoutTags = block.replace(CITATION_TAG_M3_REGEX, ' ');
    let validTagsInBlock = 0;

    for (const tag of foundTags) {
      const matchedEntry = allowedById.get(tag.idUpper);
      if (!matchedEntry) {
        v1InvalidIdsSet.add(tag.idUpper);
        violations.push({
          rule: 'V1',
          citationId: tag.idUpper,
          blockIndex: idx,
          blockExcerpt: block.slice(0, 140),
          reasonVi: `Thẻ [Nguồn: ${tag.idUpper}] không nằm trong danh sách mục tri thức đã nạp cho lượt sinh này.`,
        });
        continue;
      }

      if (!hasEntityOverlapWithEntry(blockWithoutTags, matchedEntry)) {
        v3MismatchIdsSet.add(tag.idUpper);
        violations.push({
          rule: 'V3',
          citationId: matchedEntry.id,
          blockIndex: idx,
          blockExcerpt: block.slice(0, 140),
          reasonVi: `Thẻ [Nguồn: ${matchedEntry.id}] được gắn vào khối không nhắc tới sao/cung/cách cục nào của mục nguồn.`,
        });
        continue;
      }

      validTagsInBlock += 1;
      if (!validIdsSeen.has(matchedEntry.id)) {
        validIdsSeen.add(matchedEntry.id);
        validIdsInOrder.push(matchedEntry.id);
      }
    }

    AUTHORITY_M1_REGEX.lastIndex = 0;
    const hasM1 = AUTHORITY_M1_REGEX.test(blockWithoutTags);
    const hasM2 = hasM2QuotedFormulaClaim(blockWithoutTags);

    if ((hasM1 || hasM2) && validTagsInBlock === 0) {
      v2UncitedBlocks.push(idx);
      violations.push({
        rule: 'V2',
        blockIndex: idx,
        blockExcerpt: block.slice(0, 140),
        reasonVi:
          'Khối có viện dẫn tác giả/trường phái/cổ thư hoặc trích khẩu quyết nhưng không gắn thẻ [Nguồn: ...] hợp lệ.',
      });
    }
  }

  const v1InvalidIds = Array.from(v1InvalidIdsSet);
  const v3MismatchIds = Array.from(v3MismatchIdsSet);
  const scrubbedInvalidIds = Array.from(
    new Set([...v1InvalidIds, ...v3MismatchIds]),
  );

  const scrubbedText =
    scrubbedInvalidIds.length > 0
      ? scrubInvalidCitationTags(normalized, { invalidIds: scrubbedInvalidIds })
      : normalized;

  const usedValidEntries = validIdsInOrder
    .map((id) => allowedById.get(id.toUpperCase()))
    .filter((e): e is DistilledKnowledgeEntry => Boolean(e));

  const hasUncitedClaims =
    v2UncitedBlocks.length > 0 || v3MismatchIds.length > 0 || v1InvalidIds.length > 0;

  const referenceBlockMarkdown = buildReferenceAddendumBlock(usedValidEntries);
  const warningBlockMarkdown = buildVerificationWarningBlock(hasUncitedClaims);
  const chatFooterMarkdown = buildChatCitationFooter({
    usedValidEntries,
    hasAuditIssues: hasUncitedClaims,
  });

  return {
    validCitationIds: validIdsInOrder,
    usedValidEntries,
    v1InvalidIds,
    v2UncitedBlocks,
    v3MismatchIds,
    scrubbedInvalidIds,
    hasUncitedClaims,
    violations,
    scrubbedText,
    referenceBlockMarkdown,
    warningBlockMarkdown,
    chatFooterMarkdown,
  };
}
