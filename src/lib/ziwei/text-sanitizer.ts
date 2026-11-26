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
  // Tuyệt đối không dùng regex tổng quát và không đụng tới "Canh Thìn", "Canh Dần", tên sao, tên cung hay địa danh "Bảo Ninh".
  out = out
    .replace(/(?<!\p{L})kho[ \t]+lứa(?!\p{L})/gu, 'kho lúa')
    .replace(/(?<!\p{L})Kho[ \t]+lứa(?!\p{L})/gu, 'Kho lúa')
    .replace(/(?<!\p{L})bảo[ \t]+Thủ(?!\p{L})/gu, 'bảo thủ')
    // Z3 (C-01): Số thứ tự trượt tiếng Anh (dạng dài trước dạng ngắn để không sót đuôi Number)
    .replace(/(?<!\p{L})(T|t)hứ[ \t]+(?:secondNumber|second)(?!\p{L})/gu, '$1hứ hai')
    .replace(/(?<!\p{L})(T|t)hứ[ \t]+(?:firstNumber|first)(?!\p{L})/gu, '$1hứ nhất')
    .replace(/(?<!\p{L})(T|t)hứ[ \t]+(?:thirdNumber|third)(?!\p{L})/gu, '$1hứ ba')
    // Z3 (C-02, C-04): Lỗi bộ gõ Telex
    .replace(/(?<!\p{L})Thân[ \t]+Cuv(?!\p{L})/gu, 'Thân Cư')
    .replace(/(?<!\p{L})thân[ \t]+cuv(?!\p{L})/gu, 'thân cư')
    .replace(/(?<!\p{L})Venh[ \t]+Khúc(?!\p{L})/gu, 'Văn Khúc')
    .replace(/(?<!\p{L})Venh[ \t]+Xương(?!\p{L})/gu, 'Văn Xương')
    // Z3 (C-03): Nhãn enum lọt từ patterns
    .replace(/\[excellent\]/gu, '[Thượng cách]')
    .replace(/\[good\]/gu, '[Cát cách]')
    .replace(/\[neutral\]/gu, '[Trung bình]')
    .replace(/\[bad\]/gu, '[Hung cách]')
    // Z3 (C-04): Dính chữ thường gặp
    .replace(/(?<!\p{L})khiâm[ \t]+đau(?!\p{L})/gu, 'khi ốm đau')
    .replace(/(?<!\p{L})Khiâm[ \t]+đau(?!\p{L})/gu, 'Khi ốm đau')
    // Z3 (C-05): Từ sai ngữ cảnh cố định (bảo ninh chỉ khớp chữ thường, không đụng địa danh "Bảo Ninh")
    .replace(/(?<!\p{L})đồng[ \t]+điệu[ \t]+mật[ \t]+khẩu(?!\p{L})/gu, 'đồng điệu mật thiết')
    .replace(/(?<!\p{L})tránh[ \t]+dùng[ \t]+tôi[ \t]+tớ(?!\p{L})/gu, 'tránh sự tự ái')
    .replace(/(?<!\p{L})hoa[ \t]+tụ(?!\p{L})/gu, 'hội tụ')
    .replace(/(?<!\p{L})Hoa[ \t]+tụ(?!\p{L})/gu, 'Hội tụ')
    .replace(/(?<!\p{L})bề[ \t]+vững(?!\p{L})/gu, 'bền vững')
    .replace(/(?<!\p{L})bảo[ \t]+ninh(?!\p{L})/gu, 'bảo toàn')
    .replace(/(?<!\p{L})danh[ \t]+uy[ \t]+uy[ \t]+tín(?!\p{L})/gu, 'danh tiếng và uy tín')
    // Z3 (C-06): Viết hoa thất thường ("HOÁ" chỉ sửa trước tên Tứ Hóa; "thế Mạnh" chỉ sửa sau "trục")
    .replace(/(?<!\p{L})(?:HOÁ|Hoá|HÓA)[ \t]+(Lộc|Quyền|Khoa|Kỵ)(?!\p{L})/gu, 'Hóa $1')
    .replace(/(?<!\p{L})(trục[ \t]+)thế[ \t]+Mạnh(?!\p{L})/gu, '$1thế mạnh')
    // Z3 (Y5 fallback): Tiêu đề lặp "### Cung Mệnh Cung"
    .replace(/(^\s*#{2,4}[ \t]+)Cung[ \t]+Mệnh[ \t]+Cung(?=$|[\s(\[–—-])/gmu, '$1Cung Mệnh')
    // Z2 (1.5.6): Lỗi chính tả ngữ cảnh & dịch máy cố định với biên chữ Unicode
    .replace(/(?<!\p{L})thủ[ \t]+mì(?!\p{L})/gu, 'thủ Mệnh')
    .replace(/(?<!\p{L})Thủ[ \t]+mì(?!\p{L})/gu, 'Thủ Mệnh')
    .replace(/(?<!\p{L})đóng[ \t]+nhờ[ \t]+trên(?!\p{L})/gu, 'đóng tại')
    .replace(/(?<!\p{L})Đóng[ \t]+nhờ[ \t]+trên(?!\p{L})/gu, 'Đóng tại')
    .replace(/(?<!\p{L})trinhtrạng(?!\p{L})/gu, 'tình trạng')
    .replace(/(?<!\p{L})Trinhtrạng(?!\p{L})/gu, 'Tình trạng')
    .replace(/(?<!\p{L})trinh[ \t]+trạng(?!\p{L})/gu, 'tình trạng')
    .replace(/(?<!\p{L})Trinh[ \t]+trạng(?!\p{L})/gu, 'Tình trạng');

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

export const CITATION_ID_SYNTAX_RE = /^[A-Z0-9_-]{4,24}$/;

export const CITATION_TAG_SCAN_RE = /\[Nguồn:\s*([^\]]*)\]/giu;

export interface ParsedCitationCandidate {
  idUpper: string;
  isValidFormat: boolean;
}

export interface ParsedCitationTag {
  rawInner: string;
  noteSuffix: string;
  candidates: ParsedCitationCandidate[];
  isEmptyTag: boolean;
}

/**
 * X2 (P1/P2/P3): Parser dùng chung duy nhất cho nội dung thẻ `[Nguồn: ...]`.
 * 1. Cắt hậu tố chú thích sau dấu `·` hoặc `|` đầu tiên TRƯỚC khi tách ID
 *    (dấu phẩy trong chú thích không tạo ứng viên ID mới).
 * 2. Tách phần ID theo `,` / `;` / `/`, chuẩn hóa `.trim().toUpperCase()`, kiểm `^[A-Z0-9_-]{4,24}$`.
 * 3. Thẻ rỗng hoặc chỉ có dấu phân cách trả về `isEmptyTag = true` để đánh V1 và xóa sạch vỏ thẻ.
 */
export function parseCitationTagInner(rawInner: string): ParsedCitationTag {
  const safeInner = (rawInner ?? '').normalize('NFC');
  const noteMatch = safeInner.match(/[·|]/u);
  const noteIdx = noteMatch?.index ?? -1;
  const idPart = (noteIdx >= 0 ? safeInner.slice(0, noteIdx) : safeInner).trim();
  const noteSuffix = noteIdx >= 0 ? safeInner.slice(noteIdx).trim() : '';

  const segments = idPart
    .split(/[,;/]/u)
    .map((seg) => seg.trim())
    .filter((seg) => seg.length > 0);

  if (segments.length === 0) {
    return {
      rawInner: safeInner,
      noteSuffix,
      candidates: [],
      isEmptyTag: true,
    };
  }

  const candidates: ParsedCitationCandidate[] = segments.map((seg) => {
    const idUpper = seg.toUpperCase();
    return {
      idUpper,
      isValidFormat: CITATION_ID_SYNTAX_RE.test(idUpper),
    };
  });

  return {
    rawInner: safeInner,
    noteSuffix,
    candidates,
    isEmptyTag: false,
  };
}

/**
 * ĐN-6 + X2 (P2/P3): Gỡ bỏ an toàn các token thẻ `[Nguồn: ...]` không hợp lệ, tách thẻ đa ID
 * và giữ lại các ID hợp lệ ở dạng thẻ đơn `[Nguồn: ID1] [Nguồn: ID2]` (hoặc giữ nguyên
 * thẻ đơn kèm hậu tố `· ...` nếu hợp lệ). Đảm bảo tính lũy đẳng: f(f(x)) === f(x).
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

  let changed = false;
  const replaced = text.replace(CITATION_TAG_SCAN_RE, (fullMatch, rawInner: string) => {
    const parsed = parseCitationTagInner(rawInner);
    if (parsed.isEmptyTag || parsed.candidates.length === 0) {
      changed = true;
      return '';
    }

    const survivingIds: string[] = [];
    let removedAny = false;

    for (const cand of parsed.candidates) {
      const isInvalid =
        !cand.isValidFormat ||
        (invalidSet ? invalidSet.has(cand.idUpper) : false) ||
        (allowedSet ? !allowedSet.has(cand.idUpper) : false);
      if (isInvalid) {
        removedAny = true;
      } else {
        survivingIds.push(cand.idUpper);
      }
    }

    if (survivingIds.length === 0) {
      changed = true;
      return '';
    }

    // Thẻ đơn hợp lệ: giữ nguyên dạng gốc (bao gồm hậu tố chú thích sau `·` nếu có)
    // trừ khi mã ID viết thường cần chuẩn hóa hoa.
    if (parsed.candidates.length === 1 && !removedAny) {
      const idUpper = parsed.candidates[0].idUpper;
      if (parsed.noteSuffix) {
        const rawIdPart = rawInner.slice(0, rawInner.search(/[·|]/u)).trim();
        if (rawIdPart === idUpper) {
          return fullMatch;
        }
        changed = true;
        return `[Nguồn: ${idUpper} ${parsed.noteSuffix}]`;
      }
      if (rawInner.trim() !== idUpper) {
        changed = true;
        return `[Nguồn: ${idUpper}]`;
      }
      return fullMatch;
    }

    // Thẻ đa ID (hoặc vừa loại bớt ID sai khỏi thẻ đa ID): xuất thành các thẻ đơn `[Nguồn: ID1] [Nguồn: ID2]`.
    changed = true;
    return survivingIds.map((id) => `[Nguồn: ${id}]`).join(' ');
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
      canonicalByNameLower.set(
        canonicalNameVi.normalize('NFC').toLowerCase(),
        formatCanonicalPalaceHeading(p, { chart, onlyCurrentAndNextDaXian: true }),
      );
    }
  }

  const lines = text.split('\n');
  const dedupedLines: string[] = [];
  let lastEmittedCanonicalHeading: string | null = null;
  let pendingBlanks: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^\s*#{2,4}\s+(?:\d+[.)]\s*)?Cung\s+(.+)$/iu);
    let canonicalLine: string | null = null;

    if (headingMatch) {
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

      if (matchedCanonical) {
        // Từ chối tiêu đề gộp nhiều cung (ví dụ: "### Cung Mệnh và Quan Lộc").
        const remainderTitle = titleLower.slice(matchedLabelLen).trim();
        let hasAnotherPalace = false;
        if (remainderTitle.length > 0) {
          hasAnotherPalace = sortedAliases.some((entry) => {
            const entryCanon = entry.canonicalNameVi.normalize('NFC').toLowerCase();
            if (entryCanon === matchedCanonical) return false;
            const otherRe = new RegExp(`(?<!\\p{L})${escapeRegExp(entry.label.toLowerCase())}(?!\\p{L})`, 'u');
            return otherRe.test(remainderTitle);
          });
        }
        if (!hasAnotherPalace) {
          canonicalLine = canonicalByNameLower.get(matchedCanonical) ?? null;
        }
      }
    }

    if (canonicalLine !== null) {
      if (canonicalLine === lastEmittedCanonicalHeading) {
        // Z1: Thu gọn các dòng tiêu đề cung chuẩn hóa giống hệt nhau liên tiếp thành 1.
        pendingBlanks = [];
        continue;
      }
      if (pendingBlanks.length > 0) {
        dedupedLines.push(...pendingBlanks);
        pendingBlanks = [];
      }
      dedupedLines.push(canonicalLine);
      lastEmittedCanonicalHeading = canonicalLine;
      continue;
    }

    if (/^\s*$/.test(line)) {
      if (lastEmittedCanonicalHeading !== null) {
        pendingBlanks.push(line);
      } else {
        dedupedLines.push(line);
      }
      continue;
    }

    if (pendingBlanks.length > 0) {
      dedupedLines.push(...pendingBlanks);
      pendingBlanks = [];
    }
    lastEmittedCanonicalHeading = null;
    dedupedLines.push(line);
  }

  if (pendingBlanks.length > 0) {
    dedupedLines.push(...pendingBlanks);
  }

  return dedupedLines.join('\n');
}
