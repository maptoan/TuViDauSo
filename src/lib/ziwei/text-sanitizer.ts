import type { ZiweiChart } from './types.ts';
import {
  formatPeriodSiHuaFactLine,
  type PeriodSiHuaImpact,
  type YunxianPeriodContext,
} from './yunxian-context.ts';
import { formatCanonicalPalaceHeading } from './dossier-context.ts';
import { VI_STEMS, translatePalaceName } from './vi-i18n.ts';

/**
 * Hệ chữ ngoại lai không bao giờ hợp lệ trong văn bản luận giải tiếng Việt.
 * Bảo toàn 100% chữ Latin/tiếng Việt có dấu, chữ số, dấu câu chuẩn và các ký hiệu
 * chuyên dụng (↔, →, ←, •, –, —, …, %, ±, ×, °, 📌, ⚠️).
 */
const FOREIGN_SCRIPTS_NO_HAN_RE =
  /[\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Thai}\p{Script=Devanagari}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\uFFFD\u200B-\u200D\uFEFF]/gu;

const FOREIGN_SCRIPTS_WITH_HAN_RE =
  /[\p{Script=Han}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Thai}\p{Script=Devanagari}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\uFFFD\u200B-\u200D\uFEFF]/gu;

const EMPTY_FOREIGN_PARENS_WITH_HAN_RE =
  /[ \t]*\([ \t\p{Script=Han}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Thai}\p{Script=Devanagari}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\uFFFD\u200B-\u200D\uFEFF,;·•–—-]*[\p{Script=Han}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Thai}\p{Script=Devanagari}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\uFFFD][ \t\p{Script=Han}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Thai}\p{Script=Devanagari}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\uFFFD\u200B-\u200D\uFEFF,;·•–—-]*\)/gu;

const EMPTY_FOREIGN_BRACKETS_WITH_HAN_RE =
  /[ \t]*\[[ \t\p{Script=Han}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Thai}\p{Script=Devanagari}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\uFFFD\u200B-\u200D\uFEFF,;·•–—-]*[\p{Script=Han}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Thai}\p{Script=Devanagari}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\uFFFD][ \t\p{Script=Han}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Thai}\p{Script=Devanagari}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\uFFFD\u200B-\u200D\uFEFF,;·•–—-]*\]/gu;

const EMPTY_FOREIGN_PARENS_NO_HAN_RE =
  /[ \t]*\([ \t\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Thai}\p{Script=Devanagari}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\uFFFD\u200B-\u200D\uFEFF,;·•–—-]*[\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Thai}\p{Script=Devanagari}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\uFFFD][ \t\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Thai}\p{Script=Devanagari}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\uFFFD\u200B-\u200D\uFEFF,;·•–—-]*\)/gu;

const EMPTY_FOREIGN_BRACKETS_NO_HAN_RE =
  /[ \t]*\[[ \t\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Thai}\p{Script=Devanagari}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\uFFFD\u200B-\u200D\uFEFF,;·•–—-]*[\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Thai}\p{Script=Devanagari}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\uFFFD][ \t\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Thai}\p{Script=Devanagari}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\uFFFD\u200B-\u200D\uFEFF,;·•–—-]*\]/gu;

/**
 * Quy tắc âm vị học hẹp cho chữ 'đ' thường (U+0111) đứng đầu âm tiết thứ hai bị dính vào âm tiết trước
 * (ví dụ: "căngđộ" -> "căng độ", "mứcđộ" -> "mức độ").
 * Không dùng regex \p{L} rộng để tránh tách nhầm từ mượn/ký hiệu kỹ thuật.
 */
const VIET_SYLLABLE_END_BEFORE_D_RE =
  /(?<=[aăâeêioôơuưyáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵptcmnhg])(?=đ[aăâeêioôơuưyáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ])/gu;

/**
 * QĐ-H6 (B-03): Tách nguyên âm tiếng Việt có dấu hoặc 'đ' thường đứng liền trước chữ IN HOA
 * (ví dụ: "nhưThiên Cơ" -> "như Thiên Cơ", "cóVũ Khúc" -> "có Vũ Khúc").
 * Tuyệt đối không khớp các ký tự ASCII thường (bảo vệ an toàn iPhone, iPad, eBay, macOS, JavaScript, TypeScript, YouTube, McDonald).
 */
const VIET_DIACRITIC_LOWER_BEFORE_UPPER_RE =
  /(?<=[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựýỳỷỹỵđ])(?=[A-ZÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ])/gu;

/**
 * Bộ lọc Lớp 3A đơn thuần (an toàn cho từng chunk SSE đơn lẻ):
 * Chỉ xóa ký tự thuộc các hệ chữ ngoại lai không hợp lệ; không tách từ dính qua biên chunk.
 * Chế độ song ngữ mặc định TẮT (`allowHan = false` -> lọc cả chữ Hán \p{Script=Han}).
 */
export function sanitizeLayer3AOnly(text: string, allowHan = false): string {
  if (!text) return text;
  const re = allowHan ? FOREIGN_SCRIPTS_NO_HAN_RE : FOREIGN_SCRIPTS_WITH_HAN_RE;
  return text.replace(re, '');
}

/**
 * Hàm làm sạch văn bản tiếng Việt dùng chung duy nhất (Lớp 3A + Lớp 3B) cho cả luồng SSE tích lũy,
 * bộ nhớ đệm cũ và bản xuất hồ sơ.
 * Chế độ song ngữ mặc định TẮT (`allowHan = false`). Bắt buộc lũy đẳng: f(f(x)) === f(x).
 */
export function sanitizeAiVietnameseOutput(
  text: string,
  opts?: { allowHan?: boolean },
): string {
  if (!text) return text;
  const allowHan = opts?.allowHan ?? false;
  let out = text.normalize('NFC');

  // Lớp 3A: Dọn cặp ngoặc chỉ chứa ký tự bị xóa (VD: "Tử Vi (紫微)" -> "Tử Vi"), rồi lọc ký tự ngoại lai.
  out = out
    .replace(allowHan ? EMPTY_FOREIGN_PARENS_NO_HAN_RE : EMPTY_FOREIGN_PARENS_WITH_HAN_RE, '')
    .replace(allowHan ? EMPTY_FOREIGN_BRACKETS_NO_HAN_RE : EMPTY_FOREIGN_BRACKETS_WITH_HAN_RE, '');
  out = sanitizeLayer3AOnly(out, allowHan);

  // Lớp 3B (i): Tách từ dính ngay trước âm tiết bắt đầu bằng 'đ' thường hoặc từ viết hoa sau chữ Việt có dấu.
  out = out
    .replace(VIET_SYLLABLE_END_BEFORE_D_RE, ' ')
    .replace(VIET_DIACRITIC_LOWER_BEFORE_UPPER_RE, ' ');

  // Lớp 3B (ii): Sửa từ điển cố định cực hẹp với biên chữ Unicode (?<!\p{L})...(?!\p{L}).
  // Tuyệt đối không dùng regex tổng quát và không đụng tới "Canh Thìn", "Canh Dần", tên sao hay tên cung.
  out = out
    .replace(/(?<!\p{L})kho[ \t]+lứa(?!\p{L})/gu, 'kho lúa')
    .replace(/(?<!\p{L})Kho[ \t]+lứa(?!\p{L})/gu, 'Kho lúa')
    .replace(/(?<!\p{L})bảo[ \t]+Thủ(?!\p{L})/gu, 'bảo thủ');

  // Thu gọn khoảng trắng ngang bị đúp sau chữ mà vẫn giữ nguyên thụt đầu dòng, bảng Markdown và xuống dòng.
  out = out
    .split('\n')
    .map((line) => {
      if (/^\s*\|/.test(line)) return line;
      return line.replace(/(\S)[ \t]{2,}/g, '$1 ');
    })
    .join('\n');

  return out;
}

const CITATION_TAG_SCAN_RE = /\[Nguồn:\s*([A-Z0-9_-]{4,24})(?:\s*[·,|]\s*[^\]]+)?\]/giu;

/**
 * ĐN-6 (Bậc 1 — Safe Tag Scrubbing): Gỡ bỏ an toàn các token thẻ `[Nguồn: ID]` nằm trong danh sách lỗi `V1`/`V3`
 * (hoặc mọi thẻ ngoài `allowedIds` nếu truyền vào) mà KHÔNG sửa đổi chữ/ngữ pháp trong câu văn tiếng Việt.
 * Đảm bảo tính lũy đẳng: f(f(x)) === f(x).
 */
export function scrubInvalidCitationTags(
  text: string,
  options?: { invalidIds?: ReadonlySet<string> | readonly string[]; allowedIds?: ReadonlySet<string> | readonly string[] },
): string {
  if (!text) return text;
  const invalidSet = options?.invalidIds
    ? new Set(Array.from(options.invalidIds, (x) => x.trim().toUpperCase()))
    : null;
  const allowedSet = options?.allowedIds
    ? new Set(Array.from(options.allowedIds, (x) => x.trim().toUpperCase()))
    : null;

  if (!invalidSet && !allowedSet) return text;
  if (invalidSet && invalidSet.size === 0 && !allowedSet) return text;

  let changed = false;
  const replaced = text.replace(CITATION_TAG_SCAN_RE, (fullMatch, rawId: string) => {
    const idUpper = rawId.trim().toUpperCase();
    const isInvalid =
      (invalidSet ? invalidSet.has(idUpper) : false) ||
      (allowedSet ? !allowedSet.has(idUpper) : false);
    if (!isInvalid) return fullMatch;
    changed = true;
    return '';
  });

  if (!changed) return text;

  return replaced
    .split('\n')
    .map((line) => {
      if (/^\s*\|/.test(line)) return line;
      return line
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/[ \t]+([.,;:!?])/g, '$1')
        .replace(/[ \t]+$/g, '');
    })
    .join('\n');
}

export interface PeriodSiHuaCheckResult {
  isComplete: boolean;
  missingEntries: PeriodSiHuaImpact[];
  patchedText: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isPeriodSiHuaMentionedInText(normText: string, sh: PeriodSiHuaImpact): boolean {
  const starLower = sh.starNameVi.normalize('NFC').toLowerCase().trim();
  const mutagenLower = sh.mutagenVi.normalize('NFC').toLowerCase().trim(); // e.g. "hóa lộc"
  if (!starLower || !mutagenLower) return true;

  const shortToken = mutagenLower.replace(/^hóa\s+/u, '').trim(); // "lộc" | "quyền" | "khoa" | "kỵ"
  const mutagenPatterns = [
    mutagenLower,
    `lưu ${shortToken}`,
    `đại hạn ${shortToken}`,
    `song ${shortToken}`,
    `(${shortToken})`,
  ];

  // Tách theo các mục tiêu đề Markdown và ranh giới câu/dòng để tránh ghép nhầm sao giữa 2 câu khác nhau.
  const sections = normText.split(/(?=^#{1,6}\s)/m);
  const starRe = new RegExp(`(?<!\\p{L})${escapeRegExp(starLower)}(?!\\p{L})`, 'gu');
  const sentenceBoundaryRe = /[.!?\n;|]/;

  for (const section of sections) {
    // Bỏ qua chính dòng tiêu đề mục (nơi có thể liệt kê chung "(Lộc · Quyền · Khoa · Kỵ)").
    const bodyWithoutHeading = section.replace(/^#{1,6}\s[^\n]*(?:\n|$)/, '');
    starRe.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = starRe.exec(bodyWithoutHeading)) !== null) {
      const minStart = Math.max(0, match.index - 140);
      let start = match.index;
      while (start > minStart && !sentenceBoundaryRe.test(bodyWithoutHeading[start - 1])) {
        start -= 1;
      }

      const maxEnd = Math.min(bodyWithoutHeading.length, match.index + match[0].length + 140);
      let end = match.index + match[0].length;
      while (end < maxEnd && !sentenceBoundaryRe.test(bodyWithoutHeading[end])) {
        end += 1;
      }

      const windowText = bodyWithoutHeading.slice(start, end);
      if (mutagenPatterns.some((pat) => windowText.includes(pat))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Hậu kiểm xác định (0 tốn quota) đảm bảo văn bản kỳ hạn (Lưu Niên / Đại Hạn) luôn có đủ 4/4 Tứ Hóa.
 * Nếu thiếu >= 1 hóa, NỐI Ở CUỐI CHƯƠNG (sau toàn bộ nội dung) khối tổng hợp đầy đủ 4/4 Tứ Hóa
 * dùng chung formatter `formatPeriodSiHuaFactLine` từ `yunxian-context.ts`.
 */
export function verifyAndEnsureCompletePeriodSiHua(
  text: string,
  periodInput:
    | PeriodSiHuaImpact[]
    | Pick<YunxianPeriodContext, 'mode' | 'periodSiHua' | 'stemIndex'>,
  opts?: { periodStemVi?: string; prefix?: 'Đại Hạn' | 'Lưu' },
): PeriodSiHuaCheckResult {
  const periodSiHuas = Array.isArray(periodInput) ? periodInput : periodInput.periodSiHua;
  if (!periodSiHuas || periodSiHuas.length === 0) {
    return { isComplete: true, missingEntries: [], patchedText: text };
  }

  const prefix: 'Đại Hạn' | 'Lưu' =
    opts?.prefix ??
    (Array.isArray(periodInput)
      ? 'Lưu'
      : periodInput.mode === 'dahan'
        ? 'Đại Hạn'
        : 'Lưu');

  const periodStemVi =
    opts?.periodStemVi ??
    periodSiHuas[0]?.periodStemVi ??
    (!Array.isArray(periodInput) ? VI_STEMS[periodInput.stemIndex] : '') ??
    '';

  const normText = text.normalize('NFC').toLowerCase();
  const missingEntries = periodSiHuas.filter((sh) => !isPeriodSiHuaMentionedInText(normText, sh));

  if (missingEntries.length === 0) {
    return {
      isComplete: true,
      missingEntries: [],
      patchedText: text,
    };
  }

  const stemLabel = periodStemVi ? ` (Can ${periodStemVi})` : '';
  const periodTypeLabel = prefix === 'Đại Hạn' ? 'Đại Hạn' : 'Lưu Niên';
  const addendumLines = [
    `> 📌 **[Tổng Hợp Đầy Đủ Tứ Hóa Kỳ Hạn Theo Lá Số]**`,
    `> Bảng đối chiếu đủ 4/4 sao Tứ Hóa ${periodTypeLabel}${stemLabel} từ dữ kiện lá số gốc:`,
    ...periodSiHuas.map((sh) => `> ${formatPeriodSiHuaFactLine(sh, prefix)}`),
  ];
  const addendumBlock = addendumLines.join('\n');
  const patchedText = text.trim().length > 0 ? `${text.trimEnd()}\n\n${addendumBlock}` : addendumBlock;

  return {
    isComplete: false,
    missingEntries,
    patchedText,
  };
}

/**
 * Chuẩn hóa các dòng tiêu đề cung Markdown (`### Cung ...`) ở Chương 2, 3, 4 theo đúng chuỗi chuẩn
 * từ `formatCanonicalPalaceHeading(p)` (có `[AN MỆNH]`, `[AN THÂN]`, `[Đại hạn X–Y tuổi]`).
 * Bỏ qua tiêu đề gộp nhiều cung, tiêu đề lạ hoặc tiêu đề không phải cung. Lũy đẳng 100%.
 */
export function enforceCanonicalPalaceGroupHeadings(text: string, chart: ZiweiChart): string {
  if (!text || !chart?.palaces?.length) return text;

  const aliasEntries: Array<{ label: string; canonicalNameVi: string }> = [];
  for (const p of chart.palaces) {
    const canonicalNameVi = translatePalaceName(p.name);
    if (!canonicalNameVi) continue;
    aliasEntries.push({ label: canonicalNameVi, canonicalNameVi });
  }
  aliasEntries.push(
    { label: 'Mệnh', canonicalNameVi: 'Mệnh Cung' },
    { label: 'Tử Tức', canonicalNameVi: 'Tử Nữ' },
    { label: 'Nô Bộc', canonicalNameVi: 'Giao Hữu' },
    { label: 'Bộc Dịch', canonicalNameVi: 'Giao Hữu' },
  );

  // Ưu tiên khớp tên dài trước (ví dụ "Mệnh Cung" trước "Mệnh").
  const sortedAliases = [...aliasEntries].sort((a, b) => b.label.length - a.label.length);
  const canonicalByNameLower = new Map<string, string>();
  for (const p of chart.palaces) {
    const canonicalNameVi = translatePalaceName(p.name);
    if (canonicalNameVi) {
      canonicalByNameLower.set(canonicalNameVi.normalize('NFC').toLowerCase(), formatCanonicalPalaceHeading(p));
    }
  }

  const lines = text.split('\n');
  const updatedLines = lines.map((line) => {
    const headingMatch = line.match(/^\s*#{2,4}\s+(?:\d+[.)]\s*)?Cung\s+(.+)$/iu);
    if (!headingMatch) return line;

    const rest = headingMatch[1].normalize('NFC').trim();
    const titleBeforeBadges = rest.split(/[([\n]/u)[0]?.trim() ?? '';
    const titleLower = titleBeforeBadges.toLowerCase();

    let matchedCanonical: string | null = null;
    let matchedLabelLen = 0;
    for (const entry of sortedAliases) {
      const labelLower = entry.label.normalize('NFC').toLowerCase();
      const startRe = new RegExp(`^${escapeRegExp(labelLower)}(?=$|[\\s(\\[,:–—-])`, 'u');
      if (startRe.test(titleLower)) {
        matchedCanonical = entry.canonicalNameVi.normalize('NFC').toLowerCase();
        matchedLabelLen = entry.label.length;
        break;
      }
    }

    if (!matchedCanonical) return line;

    // Từ chối tiêu đề gộp nhiều cung (ví dụ: "### Cung Mệnh và Quan Lộc").
    const remainderTitle = titleLower.slice(matchedLabelLen).trim();
    if (remainderTitle.length > 0) {
      const hasAnotherPalace = sortedAliases.some((entry) => {
        const entryCanon = entry.canonicalNameVi.normalize('NFC').toLowerCase();
        if (entryCanon === matchedCanonical) return false;
        const otherRe = new RegExp(`(?<!\\p{L})${escapeRegExp(entry.label.toLowerCase())}(?!\\p{L})`, 'u');
        return otherRe.test(remainderTitle);
      });
      if (hasAnotherPalace) return line;
    }

    return canonicalByNameLower.get(matchedCanonical) ?? line;
  });

  return updatedLines.join('\n');
}
