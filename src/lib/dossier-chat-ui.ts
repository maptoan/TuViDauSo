import type { Palace, SiHua, ZiweiChart } from './ziwei/types';
import {
  buildDossierSectionFactSheetVi,
  buildMultiYearHorizonContext,
  type DossierSectionId,
} from './ziwei/dossier-context';
import {
  buildChartIdentityKey as buildCanonicalChartIdentityKey,
  buildYunxianPeriodContext,
  formatPeriodSiHuaFactLine,
  getDaXianYears,
  resolveEffectiveDaXianIndex,
  type YunxianPeriodContext,
} from './ziwei/yunxian-context';
import {
  detectSelfSihua,
  getDaXianSiHua,
  getSiHuaByStem,
} from './ziwei/sihua';
import {
  calculateTrueSolarTime,
  formatTrueSolarClock,
} from './ziwei/true-solar-time';
import {
  enforceCanonicalPalaceGroupHeadings,
  sanitizeAiVietnameseOutput,
  scrubInvalidCitationTags,
  verifyAndEnsureCompletePeriodSiHua,
} from './ziwei/text-sanitizer';
import {
  VI_BRANCHES,
  VI_STEMS,
  translateBrightness,
  translatePalaceName,
  translateProvinceName,
  translateSiHua,
  translateStarName,
  translateWuxingJu,
  translateYinYang,
} from './ziwei/vi-i18n';
import { hasValidCachedPeriodEntry } from './key-pool-ui';
import { APP_VERSION } from './app-version';

export { APP_VERSION };

// ─── 1. KIỂU DỮ LIỆU CHIA SẺ (Period Cache & AI Meta) ──────────────────────

export interface AiExecutionMeta {
  keyId: string;
  maskedKey: string;
  label: string;
  modelUsed: string;
  usedFallbackModel: boolean;
  failoverAttempts: number;
  latencyMs: number;
  continuedFromPartial?: boolean;
  continuationCount?: number;
  interrupted?: boolean;
  partialLength?: number;
  finishReason?: string;
  truncatedByMaxTokens?: boolean;
  fallbackLegUsed?: boolean;
  fallbackLegLatencyMs?: number;
}

export type Kp3AuditFlagSeverity = 'critical' | 'medium';

export type Kp3AuditFlagCode =
  | 'PALACE_GANZHI_MISMATCH'
  | 'DAXIAN_STEM_MISMATCH'
  | 'ILLEGAL_STAR_PAIR_KHONG_KIEP'
  | 'ZERO_CITATIONS_IN_CHAPTER';

export interface Kp3AuditFlag {
  code: Kp3AuditFlagCode;
  severity: Kp3AuditFlagSeverity;
  palaceVi?: string;
  ageRange?: string;
  excerpt?: string;
  messageVi: string;
}

export interface DeterministicRepairRecord {
  code: Kp3AuditFlagCode;
  palaceVi: string;
  beforeSentence: string;
  afterSentence: string;
}

export interface AiPeriodEntry {
  text?: string;
  incompleteText?: string;
  incomplete?: boolean;
  interruptedReason?: string;
  meta?: AiExecutionMeta;
  auditFlags?: Kp3AuditFlag[];
  deterministicRepairs?: DeterministicRepairRecord[];
  reauditedForVersion?: string;
  reauditedAt?: number;
  error?: string;
  errorCode?: string;
  errorCategory?: string;
  minRemainingCooldownSec?: number | null;
  notConfigured?: boolean;
}

// ─── 2. KHÓA ĐỊNH DANH & KHÓA CACHE XÁC ĐỊNH ────────────────────────────────

export function buildChartIdentityKey(chart: ZiweiChart): string {
  return buildCanonicalChartIdentityKey(chart);
}

export function buildPeriodCacheKeyForYear(chart: ZiweiChart, year: number): string {
  return `${buildChartIdentityKey(chart)}__liunian__liunian_${year}`;
}

export function buildDossierChapterCacheKey(
  chartIdentityKey: string,
  sectionKey: DossierChapterId,
): string {
  return `${chartIdentityKey}::${sectionKey}`;
}

export function buildChatStorageKey(chartIdentityKey: string, contextKey: string): string {
  return `ziwei_chat_v1::${chartIdentityKey}::${contextKey}`;
}

export function buildDossierStorageKey(chartIdentityKey: string): string {
  return `ziwei_dossier_v1::${chartIdentityKey}`;
}

// ─── 3. SESSION STORAGE + LRU AN TOÀN (F4: 10 MẠCH CHAT / 5 HỒ SƠ) ──────────

export const MAX_CHAT_THREADS_IN_SESSION = 10;
export const MAX_DOSSIERS_IN_SESSION = 5;
export const CHAT_LRU_INDEX_KEY = 'ziwei_chat_lru_index_v1';
export const DOSSIER_LRU_INDEX_KEY = 'ziwei_dossier_lru_index_v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface LruIndexItem {
  key: string;
  updatedAt: number;
}

export function getBrowserSessionStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
  } catch {
    // ignore restricted storage access
  }
  return null;
}

function readLruIndex(storage: StorageLike, indexKey: string): LruIndexItem[] {
  try {
    const raw = storage.getItem(indexKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is LruIndexItem =>
          Boolean(item) &&
          typeof item.key === 'string' &&
          typeof item.updatedAt === 'number',
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function writeLruIndex(
  storage: StorageLike,
  indexKey: string,
  list: LruIndexItem[],
): boolean {
  try {
    storage.setItem(indexKey, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function readLruSessionEntry<T>(
  storage: StorageLike | null,
  _indexKey: string,
  entryKey: string,
): T | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(entryKey);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const PALACE_GROUP_CHAPTER_IDS = new Set<DossierChapterId>([
  'palaces_core',
  'palaces_family',
  'palaces_social_health',
]);

export function normalizeKnownBareCitationTags(
  text: string,
  allowedBareIds: readonly string[],
): string {
  if (!text || !allowedBareIds || allowedBareIds.length === 0) return text;
  const allowedSet = new Set(
    allowedBareIds.map((id) => id.trim().toUpperCase()).filter(Boolean),
  );
  if (allowedSet.size === 0) return text;

  const lines = text.split('\n');
  let inMetaBlock = false;
  const converted = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('> 📚') || trimmed.startsWith('> ⚠️') || trimmed.startsWith('> 📌')) {
      inMetaBlock = true;
      return line;
    }
    if (inMetaBlock) {
      if (trimmed.startsWith('>')) return line;
      inMetaBlock = false;
    }
    return line.replace(
      /(?<!\[)(?<!`)\[([A-Za-z0-9_-]{4,24})\](?!\()(?!`)(?!\])/g,
      (fullMatch, rawInner: string, offset: number, fullStr: string) => {
        const before = fullStr.slice(Math.max(0, offset - 12), offset);
        if (/\[Nguồn:\s*$/iu.test(before)) return fullMatch;
        const idUpper = rawInner.trim().toUpperCase();
        if (!allowedSet.has(idUpper)) return fullMatch;
        return `[Nguồn: ${idUpper}]`;
      },
    );
  });
  return converted.join('\n');
}

export function sanitizeDossierChapterText(
  text: string | undefined,
  chapterId: DossierChapterId,
  chart?: ZiweiChart,
  options?: { skipPeriodSiHuaCheck?: boolean; invalidCitationIds?: readonly string[] },
): string | undefined {
  if (typeof text !== 'string') return text;
  let cleaned = sanitizeAiVietnameseOutput(text);
  if (options?.invalidCitationIds && options.invalidCitationIds.length > 0) {
    cleaned = scrubInvalidCitationTags(cleaned, { invalidIds: options.invalidCitationIds });
  }
  if (
    !options?.skipPeriodSiHuaCheck &&
    chart &&
    (chapterId === 'year_2026' || chapterId === 'year_2027') &&
    cleaned.trim()
  ) {
    const periodYear = chapterId === 'year_2026' ? 2026 : 2027;
    const periodCtx = buildYunxianPeriodContext(chart, {
      mode: 'liunian',
      year: periodYear,
    });
    if (periodCtx) {
      cleaned = verifyAndEnsureCompletePeriodSiHua(cleaned, periodCtx).patchedText;
    }
  }
  if (chart && PALACE_GROUP_CHAPTER_IDS.has(chapterId)) {
    cleaned = enforceCanonicalPalaceGroupHeadings(cleaned, chart);
  }
  return cleaned;
}

/**
 * Loại bỏ dòng meta vận hành nội bộ ("Nguồn: ... · Model: ... · Khóa: ...") khỏi văn bản
 * khi kết xuất (.HTML / .MD / PlainText / In trực tiếp). Bắt buộc dòng phải mở đầu bằng "Nguồn:"
 * và chứa đủ cả "Model:" lẫn "Khóa:" trên cùng 1 dòng để tránh đụng nhầm văn bản luận giải.
 */
export function stripInternalExportMetaLines(text: string | undefined): string | undefined {
  if (typeof text !== 'string') return text;
  const lines = text.split(/\r?\n/);
  const filtered = lines.filter((line) => {
    const normalized = line
      .trim()
      .replace(/^(?:>\s*)?(?:\*{1,3}|_{1,3})\s*/, '')
      .trim();
    const isInternalMetaLine =
      /^Nguồn\s*:/.test(normalized) &&
      /Model\s*:/.test(normalized) &&
      /Khóa\s*:/.test(normalized);
    return !isInternalMetaLine;
  });
  if (filtered.length === lines.length) {
    return text;
  }
  return filtered
    .join('\n')
    .replace(/^\n+|\n+$/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

export interface ExtractedReferenceItem {
  id: string;
  citationText: string;
  chapterOrders: number[];
}

function splitMarkdownTableRow(line: string): string[] {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return inner.split('|').map((cell) => cell.trim());
}

function isMarkdownTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return false;
  const cells = splitMarkdownTableRow(trimmed);
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

function cleanupPunctuationAndSpacesPreserveLines(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      if (!line.trim()) return '';
      let out = line;
      out = out.replace(/\(\s*\)/g, '');
      out = out.replace(/[ \t]{2,}/g, ' ');
      out = out.replace(/[ \t]+([,.;:!?…])/g, '$1');
      out = out.replace(/([(\[“"'])[ \t]+/g, '$1');
      out = out.replace(/[ \t]+([)\]”"'])/g, '$1');
      out = out.replace(/([•\-*])\s{2,}/g, '$1 ');
      out = out.replace(/[ \t]+$/g, '');
      return out;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * X3 (ĐK-158): Tách khối tham chiếu `> 📚 **[Tư Liệu Học Thuật Tham Chiếu Trong Chương]**`
 * TRƯỚC khi gỡ thẻ `[Nguồn: ...]`, trả về văn bản thân bài sạch + danh sách mục tham chiếu để gom về Phụ lục C.1.
 */
export function extractReferenceBlocksFromChapter(
  text: string | undefined,
  chapterOrder: number,
): { cleanedText: string; refs: ExtractedReferenceItem[] } {
  if (typeof text !== 'string' || !text.trim()) {
    return { cleanedText: typeof text === 'string' ? text : '', refs: [] };
  }
  const lines = text.split(/\r?\n/);
  const keptLines: string[] = [];
  const refs: ExtractedReferenceItem[] = [];
  let inRefBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^>\s*📚\s*/u.test(trimmed)) {
      inRefBlock = true;
      continue;
    }
    if (inRefBlock) {
      if (trimmed.startsWith('>')) {
        const body = trimmed.replace(/^>\s?/, '').trim();
        const itemMatch = body.match(/^(?:[-*•]\s*)?`?\[([A-Za-z0-9_-]{3,32})\]`?\s*(.+)$/);
        if (itemMatch) {
          refs.push({
            id: itemMatch[1].trim().toUpperCase(),
            citationText: itemMatch[2].trim(),
            chapterOrders: [chapterOrder],
          });
        }
        continue;
      }
      inRefBlock = false;
    }
    keptLines.push(line);
  }

  return {
    cleanedText: keptLines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    refs,
  };
}

/**
 * X2: Gỡ khối cảnh báo kiểm chứng `> ⚠️ **[Ghi Chú Kiểm Chứng Nguồn Học Thuật]**` khi xuất bản
 * (không đụng khối blockquote bình thường khác).
 */
export function stripWarningBlockForExport(text: string | undefined): string {
  if (typeof text !== 'string') return '';
  if (!text.trim()) return text;
  const lines = text.split(/\r?\n/);
  const keptLines: string[] = [];
  let inWarnBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^>\s*⚠️\s*\*\*\[Ghi Chú Kiểm Chứng/iu.test(trimmed)) {
      inWarnBlock = true;
      continue;
    }
    if (inWarnBlock) {
      if (trimmed.startsWith('>')) {
        continue;
      }
      inWarnBlock = false;
    }
    keptLines.push(line);
  }

  return keptLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * X1b: Gỡ khối bổ sung Tứ Hóa kỳ hạn (`> 📌 **[Tổng Hợp Đầy Đủ Tứ Hóa Kỳ Hạn Theo Lá Số]**`)
 * và mọi nhãn nội bộ `[Tứ Hóa...]`, `[Tự Hóa...]`, `[Phi Tinh...]` còn sót trong văn bản AI khi xuất bản.
 */
export function stripSiHuaAddendumAndTagsForExport(text: string | undefined): string {
  if (typeof text !== 'string') return '';
  if (!text.trim()) return text;
  const lines = text.split(/\r?\n/);
  const keptLines: string[] = [];
  let inPinBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^>\s*📌\s*\*\*\[Tổng Hợp Đầy Đủ Tứ Hóa Kỳ Hạn/iu.test(trimmed)) {
      inPinBlock = true;
      continue;
    }
    if (inPinBlock) {
      if (trimmed.startsWith('>')) {
        continue;
      }
      inPinBlock = false;
    }
    keptLines.push(line);
  }

  const withoutPin = keptLines.join('\n');
  const withoutTags = withoutPin.replace(
    /\[(?:Tứ Hóa|Tự Hóa|Phi Tinh)[^\]]*\]/giu,
    '',
  );
  return cleanupPunctuationAndSpacesPreserveLines(withoutTags);
}

/**
 * X1: Gỡ toàn bộ thẻ neo `[Nguồn: ...]` khi kết xuất (.MD / .HTML / PlainText).
 * TUYỆT ĐỐI KHÔNG gọi trong đường hiển thị/cache nội bộ (`sanitizeDossierChapterText`). Lũy đẳng 100%.
 */
export function stripCitationTagsForExport(text: string | undefined): string {
  if (typeof text !== 'string') return '';
  if (!text.trim()) return text;

  let out = text.replace(/`(\[Nguồn:[^\]]*\])`/giu, '$1');
  // Xử lý cụm "Chiếu theo [Nguồn: ...], <chữ>" ở đầu câu / đầu dòng -> viết hoa chữ tiếp theo
  out = out.replace(
    /(^|[.!?…]\s+|\n\s*|^[•\-*]\s+)Chiếu theo\s*(?:\[Nguồn:[^\]]*\]\s*)+(?:[,:]\s*)?(\p{L})/gmu,
    (_m, prefix: string, firstChar: string) => `${prefix}${firstChar.toUpperCase()}`,
  );
  // Xử lý "chiếu theo [Nguồn: ...]," ở giữa câu
  out = out.replace(/\bchiếu theo\s*(?:\[Nguồn:[^\]]*\]\s*)+[,:]?\s*/giu, '');
  // Xử lý cụm ngoặc đơn chỉ chứa thẻ nguồn: ([Nguồn: ...]) hoặc ([Nguồn: A]; [Nguồn: B])
  out = out.replace(/\(\s*(?:\[Nguồn:[^\]]*\]\s*[;,]?\s*)+\)/giu, '');
  // Gỡ mọi thẻ [Nguồn: ...] còn lại (kể cả chuỗi đa thẻ)
  out = out.replace(/\[Nguồn:[^\]]*\]/giu, '');

  return cleanupPunctuationAndSpacesPreserveLines(out);
}

/**
 * X4: Gỡ câu lưu ý lặp cuối từng chương để chỉ giữ 1 câu lưu ý duy nhất ở cuối toàn hồ sơ.
 */
export function stripChapterDisclaimersForExport(text: string | undefined): string {
  if (typeof text !== 'string') return '';
  if (!text.trim()) return text;
  const lines = text.split(/\r?\n/);
  const filtered = lines.filter(
    (line) =>
      !/^\s*\*?Lưu ý:\s*Nội dung tham khảo phục vụ nghiên cứu mệnh lý Tử Vi Đẩu Số\.?\*?\s*$/iu.test(
        line.trim(),
      ),
  );
  return filtered.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * X5: Đếm số từ UTF-8 (whitespace split, chuẩn hóa tương đương Python `split()`)
 * và tính thời gian đọc (làm tròn số từ / 220, tối thiểu 1 phút).
 */
export function countWordsUtf8(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function computeReadingMinutes(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / 220));
}

export function cleanChapterTextForExport(
  rawText: string | undefined,
  chapterId: DossierChapterId,
  chapterOrder: number,
  chart: ZiweiChart,
  isIncomplete = false,
): { cleanedText: string; refs: ExtractedReferenceItem[] } {
  const sanitized = stripInternalExportMetaLines(
    sanitizeDossierChapterText(rawText, chapterId, chart, {
      skipPeriodSiHuaCheck: isIncomplete,
    }),
  );
  // X3 (trích tham chiếu TRƯỚC khi gỡ thẻ nguồn)
  const afterX3 = extractReferenceBlocksFromChapter(sanitized, chapterOrder);
  // X2 -> X1b -> X1 -> X4
  const afterX2 = stripWarningBlockForExport(afterX3.cleanedText);
  const afterX1b = stripSiHuaAddendumAndTagsForExport(afterX2);
  const afterX1 = stripCitationTagsForExport(afterX1b);
  const afterX4 = stripChapterDisclaimersForExport(afterX1);
  return {
    cleanedText: afterX4,
    refs: afterX3.refs,
  };
}

/**
 * ĐC-3 (Cổng Nguồn Sự Thật Duy Nhất - SSOT):
 * - Kho lưu trữ bền vững IndexedDB + gương RAM (do chart-library.ts quản lý) là NGUỒN SỰ THẬT DUY NHẤT (SSOT).
 * - Khóa sessionStorage ('ziwei_dossier_v1::*') chỉ là gương ghi-thông (write-through mirror) cho phiên hiện tại.
 * - Khi đọc hồ sơ, nếu có bản ghi từ IndexedDB/gương RAM thì bản ghi đó LUÔN THẮNG khi lệch với sessionStorage.
 */
export interface AuthoritativeDossierBridge {
  readAuthoritativeDossier(chartIdentityKey: string): StoredDossierRecord | null;
  writeThroughDossierSection(
    chart: ZiweiChart,
    chapterId: DossierChapterId,
    chapterState: DossierChapterState,
  ): void;
}

let authoritativeDossierBridge: AuthoritativeDossierBridge | null = null;

export function registerAuthoritativeDossierBridge(
  bridge: AuthoritativeDossierBridge | null,
): void {
  authoritativeDossierBridge = bridge;
}

function extractChartIdentityKeyFromStorageKey(dossierStorageKey: string): string {
  const prefix = 'ziwei_dossier_v1::';
  return dossierStorageKey.startsWith(prefix)
    ? dossierStorageKey.slice(prefix.length)
    : dossierStorageKey;
}

function sanitizeStoredDossierRecord(
  stored: StoredDossierRecord | null,
  chart?: ZiweiChart,
): StoredDossierRecord | null {
  if (!stored || !stored.sections) return stored;

  const cleanedSections: StoredDossierRecord['sections'] = {};
  for (const [rawKey, val] of Object.entries(stored.sections)) {
    if (!val) continue;
    const chapterId = rawKey as DossierChapterId;
    cleanedSections[chapterId] = {
      ...val,
      text: sanitizeDossierChapterText(val.text, chapterId, chart),
      incompleteText: sanitizeDossierChapterText(val.incompleteText, chapterId, chart, {
        skipPeriodSiHuaCheck: true,
      }),
    };
  }

  return {
    ...stored,
    sections: cleanedSections,
  };
}

/**
 * QĐ-G2/T2 + ĐC-3: Tự động làm sạch cache cũ khi đọc hồ sơ (0 tốn quota).
 * Ưu tiên đọc từ IndexedDB + gương RAM (SSOT) trước; chỉ fallback sang sessionStorage nếu SSOT chưa có.
 */
export function readDossierCacheEntry(
  storage: StorageLike | null,
  dossierStorageKey: string,
  chart?: ZiweiChart,
): StoredDossierRecord | null {
  const chartIdentityKey = chart
    ? buildChartIdentityKey(chart)
    : extractChartIdentityKeyFromStorageKey(dossierStorageKey);
  const fromAuthoritative =
    authoritativeDossierBridge?.readAuthoritativeDossier(chartIdentityKey) ?? null;

  if (fromAuthoritative && fromAuthoritative.sections) {
    // LK-10: Từ chối bản ghi lệch khóa định danh lá số
    if (
      fromAuthoritative.chartIdentityKey &&
      fromAuthoritative.chartIdentityKey !== chartIdentityKey
    ) {
      return null;
    }
    return sanitizeStoredDossierRecord(fromAuthoritative, chart);
  }

  const stored = readLruSessionEntry<StoredDossierRecord>(
    storage,
    DOSSIER_LRU_INDEX_KEY,
    dossierStorageKey,
  );
  // LK-10: Từ chối bản ghi sessionStorage có chartIdentityKey nội bộ lệch khóa
  if (stored && stored.chartIdentityKey && stored.chartIdentityKey !== chartIdentityKey) {
    return null;
  }
  return sanitizeStoredDossierRecord(stored, chart);
}

/**
 * QĐ-H1 (F-04) + ĐC-3: Lưu 1 chương (hoàn tất hoặc dở dang) vào gương ghi-thông sessionStorage
 * ĐỒNG THỜI ghi thẳng vào Nguồn Sự Thật Duy Nhất (IndexedDB + gương RAM + hot cache qua bridge).
 */
export function saveDossierSectionToCache(
  storage: StorageLike | null,
  chart: ZiweiChart,
  chapterId: DossierChapterId,
  chapterState: DossierChapterState,
): boolean {
  const isCompleted = chapterState.status === 'completed' && Boolean(chapterState.text?.trim());
  const isIncomplete =
    chapterState.status === 'incomplete' && Boolean(chapterState.incompleteText?.trim());
  if (!isCompleted && !isIncomplete) {
    return false;
  }

  const chartIdentityKey = buildChartIdentityKey(chart);
  const dossierStorageKey = buildDossierStorageKey(chartIdentityKey);
  const sanitizedText = isCompleted
    ? sanitizeDossierChapterText(chapterState.text, chapterId, chart) ?? chapterState.text
    : undefined;
  const sanitizedIncomplete = isIncomplete
    ? sanitizeDossierChapterText(chapterState.incompleteText, chapterId, chart, {
        skipPeriodSiHuaCheck: true,
      }) ?? chapterState.incompleteText
    : undefined;

  const normalizedChapterState: DossierChapterState = {
    ...chapterState,
    chapterId,
    text: sanitizedText,
    incompleteText: sanitizedIncomplete,
    updatedAt: chapterState.updatedAt ?? Date.now(),
  };

  // ĐC-3: Ghi vào SSOT (IndexedDB + gương RAM) qua cầu nối nếu có
  authoritativeDossierBridge?.writeThroughDossierSection(
    chart,
    chapterId,
    normalizedChapterState,
  );

  // Ghi-thông (write-through) vào gương sessionStorage cho các chương hoàn tất
  if (!storage || !isCompleted) {
    return Boolean(authoritativeDossierBridge);
  }

  const existing = readLruSessionEntry<StoredDossierRecord>(
    storage,
    DOSSIER_LRU_INDEX_KEY,
    dossierStorageKey,
  );
  const nextSections: StoredDossierRecord['sections'] = {
    ...(existing?.sections ?? {}),
    [chapterId]: normalizedChapterState,
  };
  const record: StoredDossierRecord = {
    chartIdentityKey,
    updatedAt: Date.now(),
    sections: nextSections,
  };
  return upsertLruSessionEntry(
    storage,
    DOSSIER_LRU_INDEX_KEY,
    dossierStorageKey,
    record,
    MAX_DOSSIERS_IN_SESSION,
  ).ok;
}

export function upsertLruSessionEntry<T>(
  storage: StorageLike | null,
  indexKey: string,
  entryKey: string,
  value: T,
  maxEntries: number,
  nowMs = Date.now(),
): { ok: boolean; evictedKeys: string[]; listKeys: string[] } {
  if (!storage) return { ok: false, evictedKeys: [], listKeys: [] };

  const evictedKeys: string[] = [];
  const existing = readLruIndex(storage, indexKey).filter((x) => x.key !== entryKey);
  const nextList: LruIndexItem[] = [{ key: entryKey, updatedAt: nowMs }, ...existing];

  while (nextList.length > maxEntries) {
    const popped = nextList.pop();
    if (popped) {
      evictedKeys.push(popped.key);
      try {
        storage.removeItem(popped.key);
      } catch {
        // ignore removal errors
      }
    }
  }

  const serialized = JSON.stringify(value);
  let saved = false;

  // Thử ghi; nếu gặp QuotaExceededError thì đẩy bớt mục cũ nhất cho tới khi đủ chỗ hoặc rỗng
  while (!saved) {
    try {
      storage.setItem(entryKey, serialized);
      saved = true;
    } catch {
      if (nextList.length <= 1) {
        break;
      }
      const oldest = nextList.pop();
      if (!oldest || oldest.key === entryKey) break;
      evictedKeys.push(oldest.key);
      try {
        storage.removeItem(oldest.key);
      } catch {
        // ignore
      }
    }
  }

  if (saved) {
    if (!writeLruIndex(storage, indexKey, nextList)) {
      while (nextList.length > 1) {
        const oldest = nextList.pop();
        if (oldest) {
          evictedKeys.push(oldest.key);
          try {
            storage.removeItem(oldest.key);
          } catch {
            // ignore
          }
        }
        if (writeLruIndex(storage, indexKey, nextList)) break;
      }
    }
  }

  return {
    ok: saved,
    evictedKeys,
    listKeys: nextList.map((x) => x.key),
  };
}

export function removeLruSessionEntry(
  storage: StorageLike | null,
  indexKey: string,
  entryKey: string,
): void {
  if (!storage) return;
  try {
    storage.removeItem(entryKey);
  } catch {
    // ignore
  }
  const existing = readLruIndex(storage, indexKey).filter((x) => x.key !== entryKey);
  writeLruIndex(storage, indexKey, existing);
}

export function listLruSessionKeys(
  storage: StorageLike | null,
  indexKey: string,
): string[] {
  if (!storage) return [];
  return readLruIndex(storage, indexKey).map((x) => x.key);
}

// ─── 4. TRẠNG THÁI CHIA SẺ KHÓA TUẦN TỰ HỒ SƠ ↔ CHAT (F7) ──────────────────

let sharedDossierGenerating = false;
const dossierGenListeners = new Set<(generating: boolean) => void>();

export function setSharedDossierGenerating(generating: boolean): void {
  if (sharedDossierGenerating === generating) return;
  sharedDossierGenerating = generating;
  for (const listener of dossierGenListeners) {
    listener(generating);
  }
}

export function getSharedDossierGenerating(): boolean {
  return sharedDossierGenerating;
}

export function subscribeSharedDossierGenerating(
  listener: (generating: boolean) => void,
): () => void {
  dossierGenListeners.add(listener);
  return () => {
    dossierGenListeners.delete(listener);
  };
}

// ─── 5. HÀNG RÀO QUOTA CHAT F7 (8 GIÂY + TRẦN MỀM 15 + MỞ THÊM 5) ─────────────

export const CHAT_COOLDOWN_SECONDS = 8;
export const CHAT_SOFT_CAP_BASE = 15;
export const CHAT_SOFT_CAP_AMBER_AT = 10;
export const CHAT_SOFT_CAP_UNLOCK_STEP = 5;
export const CHAT_MAX_QUESTION_CHARS = 400;
export const CHAT_MAX_EXCERPT_CHARS = 6_000;
export const CHAT_MAX_HISTORY_MESSAGES = 6;
export const CHAT_MAX_HISTORY_MSG_CHARS = 1_200;

export interface ChatQuotaState {
  usedCount: number;
  capLimit: number;
  lastSentAtMs: number | null;
}

export interface ChatQuotaEvaluation {
  usedCount: number;
  capLimit: number;
  cooldownRemainingSec: number;
  showAmberReminder: boolean;
  isCapReached: boolean;
  isBlockedByDossier: boolean;
  canSend: boolean;
  sendButtonLabel: string;
  lockReason: string | null;
}

export function createInitialChatQuotaState(
  usedCount = 0,
  capLimit = CHAT_SOFT_CAP_BASE,
  lastSentAtMs: number | null = null,
): ChatQuotaState {
  return {
    usedCount: Math.max(0, usedCount),
    capLimit: Math.max(CHAT_SOFT_CAP_BASE, capLimit),
    lastSentAtMs,
  };
}

export function getChatCooldownRemainingSec(
  lastSentAtMs: number | null,
  nowMs = Date.now(),
): number {
  if (lastSentAtMs === null) return 0;
  const elapsedMs = nowMs - lastSentAtMs;
  if (elapsedMs < 0) return CHAT_COOLDOWN_SECONDS;
  const remainingMs = CHAT_COOLDOWN_SECONDS * 1000 - elapsedMs;
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / 1000);
}

export function unlockExtraChatTurns(
  state: ChatQuotaState,
  step = CHAT_SOFT_CAP_UNLOCK_STEP,
): ChatQuotaState {
  return {
    ...state,
    capLimit: state.capLimit + step,
  };
}

export function recordChatQuestionSent(
  state: ChatQuotaState,
  sentAtMs = Date.now(),
): ChatQuotaState {
  return {
    ...state,
    usedCount: state.usedCount + 1,
    lastSentAtMs: sentAtMs,
  };
}

export function evaluateChatQuotaStatus(
  state: ChatQuotaState,
  options: {
    nowMs?: number;
    isDossierGenerating?: boolean;
    isChatStreaming?: boolean;
  } = {},
): ChatQuotaEvaluation {
  const nowMs = options.nowMs ?? Date.now();
  const isBlockedByDossier = Boolean(options.isDossierGenerating);
  const cooldownRemainingSec = getChatCooldownRemainingSec(state.lastSentAtMs, nowMs);
  const isCapReached = state.usedCount >= state.capLimit;
  const showAmberReminder =
    !isCapReached && state.usedCount >= CHAT_SOFT_CAP_AMBER_AT;

  let lockReason: string | null = null;
  if (isBlockedByDossier) {
    lockReason = 'Đang sinh chương hồ sơ, vui lòng đợi…';
  } else if (isCapReached) {
    lockReason = `Đã đạt mốc ${state.usedCount}/${state.capLimit} lượt hỏi trong phiên này.`;
  } else if (cooldownRemainingSec > 0) {
    lockReason = `Vui lòng chờ ${cooldownRemainingSec}s giữa 2 câu hỏi để bảo vệ quota khóa API.`;
  }

  const canSend =
    !isBlockedByDossier &&
    !options.isChatStreaming &&
    !isCapReached &&
    cooldownRemainingSec === 0;

  const sendButtonLabel = options.isChatStreaming
    ? 'Đang trả lời...'
    : cooldownRemainingSec > 0
      ? `Gửi (${cooldownRemainingSec}s)`
      : 'Gửi câu hỏi';

  return {
    usedCount: state.usedCount,
    capLimit: state.capLimit,
    cooldownRemainingSec,
    showAmberReminder,
    isCapReached,
    isBlockedByDossier,
    canSend,
    sendButtonLabel,
    lockReason,
  };
}

export function trimChatExcerpt(
  text: string,
  maxLen = CHAT_MAX_EXCERPT_CHARS,
): string {
  const cleaned = text.trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen);
}

export interface StoredChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  meta?: AiExecutionMeta;
  interrupted?: boolean;
  error?: string;
}

export function filterPersistableChatMessages(
  messages: readonly StoredChatMessage[],
): StoredChatMessage[] {
  const kept: StoredChatMessage[] = [];
  for (const msg of messages) {
    if (msg.role === 'assistant') {
      const hasContent = Boolean(msg.content && msg.content.trim());
      const isPureErrorOrEmpty = !hasContent || (Boolean(msg.error) && !msg.interrupted);
      if (isPureErrorOrEmpty) {
        if (kept.length > 0 && kept[kept.length - 1].role === 'user') {
          kept.pop();
        }
        continue;
      }
    }
    kept.push(msg);
  }
  return kept;
}

export function trimChatHistoryForRequest(
  messages: readonly StoredChatMessage[],
  maxMessages = CHAT_MAX_HISTORY_MESSAGES,
  maxMsgLen = CHAT_MAX_HISTORY_MSG_CHARS,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages
    .filter((m) => Boolean(m.content && m.content.trim()) && !m.error)
    .slice(-maxMessages)
    .map((m) => ({
      role: m.role,
      content:
        m.content.trim().length > maxMsgLen
          ? m.content.trim().slice(0, maxMsgLen)
          : m.content.trim(),
    }));
}

export interface ContextualChatContextPayload {
  chart: ZiweiChart;
  chartB?: ZiweiChart | null;
  contextMode: 'natal' | 'period' | 'heming';
  contextKey: string;
  sectionTitle: string;
  periodContext?: YunxianPeriodContext | null;
  factSheetVi: string;
  excerptVi: string;
  starterQuestions: string[];
  chapterId?: DossierChapterId;
  isFallbackFactSheet?: boolean;
}

export interface StoredChatThread {
  storageKey: string;
  chartIdentityKey: string;
  contextKey: string;
  sectionTitle: string;
  messages: StoredChatMessage[];
  updatedAt: number;
}

// ─── 6. ĐẶC TẢ 8 CHƯƠNG HỒ SƠ TOÀN DIỆN (F1, F2, F6) ─────────────────────────

export type DossierChapterId =
  | 'chapter_overview'
  | 'palaces_core'
  | 'palaces_family'
  | 'palaces_social_health'
  | 'year_2026'
  | 'year_2027'
  | 'horizon_5y'
  | 'horizon_10y';

export type DossierSourceBadge = 'Kế thừa từ bộ nhớ đệm' | 'Sinh mới trong hồ sơ';

export interface DossierChapterSpec {
  order: number;
  id: DossierChapterId;
  shortLabelVi: string;
  titleVi: string;
  descriptionVi: string;
  mode: 'dossier_section' | 'period';
  sectionId?: DossierSectionId;
  year?: number;
}

export const DOSSIER_INTER_CHAPTER_PACING_MS = 1_200;

export const DOSSIER_CHAPTER_SPECS: readonly DossierChapterSpec[] = [
  {
    order: 1,
    id: 'chapter_overview',
    shortLabelVi: '1. Tổng quan Mệnh cục',
    titleVi: 'Chương 1 — Tổng Quan Mệnh Cục & Cách Cục Tiên Thiên',
    descriptionVi: 'Ngũ Hành Cục, Âm Dương, Mệnh Thân, Cách cục & Dòng Tứ Hóa Tiên Thiên.',
    mode: 'dossier_section',
    sectionId: 'chapter_overview',
  },
  {
    order: 2,
    id: 'palaces_core',
    shortLabelVi: '2. Trục Mệnh · Quan · Tài · Di',
    titleVi: 'Chương 2 — Nhóm Cung Cốt Lõi: Mệnh · Quan Lộc · Tài Bạch · Thiên Di',
    descriptionVi: 'Phân tích chuyên sâu 4 cung trụ cột bản ngã, công danh, tài chính & xuất hành.',
    mode: 'dossier_section',
    sectionId: 'palaces_core',
  },
  {
    order: 3,
    id: 'palaces_family',
    shortLabelVi: '3. Trục Phu · Tử · Điền · Phúc',
    titleVi: 'Chương 3 — Nhóm Cung Gia Đạo & Nội Lực: Phu Thê · Tử Nữ · Điền Trạch · Phúc Đức',
    descriptionVi: 'Hôn nhân phối ngẫu, con cái hậu duệ, điền sản tích lũy và phúc phần tinh thần.',
    mode: 'dossier_section',
    sectionId: 'palaces_family',
  },
  {
    order: 4,
    id: 'palaces_social_health',
    shortLabelVi: '4. Trục Phụ · Huynh · Hữu · Tật',
    titleVi: 'Chương 4 — Nhóm Cung Quan Hệ & Thể Chất: Phụ Mẫu · Huynh Đệ · Giao Hữu · Tật Ách',
    descriptionVi: 'Trưởng bối, anh em đồng trang lứa, đội ngũ giao hữu và cơ địa sức khỏe.',
    mode: 'dossier_section',
    sectionId: 'palaces_social_health',
  },
  {
    order: 5,
    id: 'year_2026',
    shortLabelVi: '5. Lưu Niên 2026',
    titleVi: 'Chương 5 — Vận Hạn Lưu Niên Năm Hiện Tại (2026)',
    descriptionVi: 'Dùng chung bộ nhớ đệm 2 chiều với tab Vận Hạn cho năm Bính Ngọ 2026.',
    mode: 'period',
    year: 2026,
  },
  {
    order: 6,
    id: 'year_2027',
    shortLabelVi: '6. Lưu Niên 2027',
    titleVi: 'Chương 6 — Vận Hạn Lưu Niên Năm Sau (2027)',
    descriptionVi: 'Dùng chung bộ nhớ đệm 2 chiều với tab Vận Hạn cho năm Đinh Mùi 2027.',
    mode: 'period',
    year: 2027,
  },
  {
    order: 7,
    id: 'horizon_5y',
    shortLabelVi: '7. Mốc 5 Năm (2026–2030)',
    titleVi: 'Chương 7 — Chiến Lược Trung Hạn 5 Năm (2026–2030)',
    descriptionVi: 'Ma trận 5 năm xác định đủ 4 Lưu Hóa & Đại Hạn chủ quản từng năm.',
    mode: 'dossier_section',
    sectionId: 'horizon_5y',
  },
  {
    order: 8,
    id: 'horizon_10y',
    shortLabelVi: '8. Mốc 10 Năm (2026–2035)',
    titleVi: 'Chương 8 — Đại Cục Tầm Nhìn 10 Năm (2026–2035)',
    descriptionVi: 'Toàn cảnh 10 năm kèm mốc chuyển giao Đại Hạn và điểm rơi cơ hội/rủi ro.',
    mode: 'dossier_section',
    sectionId: 'horizon_10y',
  },
];

export const VALID_DOSSIER_CHAPTER_IDS: readonly DossierChapterId[] = [
  'chapter_overview',
  'palaces_core',
  'palaces_family',
  'palaces_social_health',
  'year_2026',
  'year_2027',
  'horizon_5y',
  'horizon_10y',
];

export function isValidDossierChapterId(value: unknown): value is DossierChapterId {
  return (
    typeof value === 'string' &&
    (VALID_DOSSIER_CHAPTER_IDS as readonly string[]).includes(value)
  );
}

const ALL_TWELVE_PALACES_VI: readonly string[] = [
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

/**
 * Ánh xạ tĩnh 8 chương -> phạm vi cung chuẩn hóa phục vụ kiểm KP-3 gợi ý (§3.4(b), ĐK-HD2-01).
 */
export const DOSSIER_CHAPTER_SCOPE_PALACES_VI: Record<
  DossierChapterId,
  readonly string[]
> = {
  chapter_overview: ALL_TWELVE_PALACES_VI,
  palaces_core: ['Mệnh Cung', 'Quan Lộc', 'Tài Bạch', 'Thiên Di'],
  palaces_family: ['Phu Thê', 'Tử Nữ', 'Điền Trạch', 'Phúc Đức'],
  palaces_social_health: ['Phụ Mẫu', 'Huynh Đệ', 'Giao Hữu', 'Tật Ách'],
  year_2026: ALL_TWELVE_PALACES_VI,
  year_2027: ALL_TWELVE_PALACES_VI,
  horizon_5y: ALL_TWELVE_PALACES_VI,
  horizon_10y: ALL_TWELVE_PALACES_VI,
};

export function buildChatSuggestionCacheKey(
  chartIdentityKey: string,
  contextKey: string,
  excerpt: string,
): string {
  const safeExcerpt = typeof excerpt === 'string' ? excerpt : '';
  const head = safeExcerpt.slice(0, 64);
  const tail = safeExcerpt.slice(-64);
  const excerptSignature = `${safeExcerpt.length}_${head}_${tail}`;
  return `${chartIdentityKey}::${contextKey}::${excerptSignature}`;
}

export class ChatSuggestionsMemoryCache {
  private readonly store = new Map<string, string[]>();

  get(key: string): string[] | null {
    const found = this.store.get(key);
    return found ? [...found] : null;
  }

  set(key: string, suggestions: readonly string[]): void {
    this.store.set(key, [...suggestions]);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

export const chatSuggestionsCache = new ChatSuggestionsMemoryCache();

export function getSuggestionRefreshCooldownRemainingSec(
  lastRefreshAtMs: number | null,
  nowMs = Date.now(),
): number {
  return getChatCooldownRemainingSec(lastRefreshAtMs, nowMs);
}

export type DossierChapterStatus =
  | 'idle'
  | 'loading'
  | 'completed'
  | 'incomplete'
  | 'error';

export interface DossierChapterState {
  chapterId: DossierChapterId;
  sectionCacheKey: string;
  status: DossierChapterStatus;
  text?: string;
  incompleteText?: string;
  interruptedReason?: string;
  error?: string;
  errorCode?: string;
  errorCategory?: string;
  minRemainingCooldownSec?: number | null;
  restoredFromLongerPartial?: boolean;
  restoredNoticeVi?: string;
  meta?: AiExecutionMeta;
  auditFlags?: Kp3AuditFlag[];
  deterministicRepairs?: DeterministicRepairRecord[];
  reauditedForVersion?: string;
  reauditedAt?: number;
  sourceBadge?: DossierSourceBadge;
  updatedAt?: number;
}

export function shouldAutoReauditChapter(params: {
  status?: DossierChapterStatus;
  text?: string | null;
  reauditedForVersion?: string | null;
  currentVersion?: string;
}): boolean {
  const version = params.currentVersion ?? APP_VERSION;
  return (
    params.status === 'completed' &&
    Boolean(params.text?.trim()) &&
    params.reauditedForVersion !== version
  );
}

export function formatReauditTimestampVi(timestampMs?: number): string {
  if (!timestampMs || !Number.isFinite(timestampMs)) return '';
  const d = new Date(timestampMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type DossierFailureKind = 'transient' | 'fatal';

export interface ParsedAiFailureInfo {
  kind: DossierFailureKind;
  errorCode: string;
  errorCategory: string;
  minRemainingCooldownSec: number | null;
  notConfigured: boolean;
  userMessageVi: string;
}

const INTERNAL_ERROR_TOKEN_REGEX =
  /\b(?:FIRST_CHUNK_TIMEOUT|AI_POOL_EXHAUSTED|TPM_GUARD_SKIP|AUTH_INVALID_KEY|AUTH_FORBIDDEN_REPEATED|NETWORK_OR_5XX|RATE_LIMIT_RPM|QUOTA_DAILY_EXHAUSTED|QUOTA_PROJECT_ZERO|API_NOT_ENABLED|MODEL_UNAVAILABLE|AI_NOT_CONFIGURED|AI_CALL_FAILED|ABORTED)\b/g;

export function sanitizeClientErrorDisplayText(rawMessage?: string | null): string {
  if (!rawMessage || typeof rawMessage !== 'string') return '';
  return rawMessage
    .replace(/^Error:\s*/i, '')
    .replace(/\[?(?:FIRST_CHUNK_TIMEOUT|AI_POOL_EXHAUSTED|TPM_GUARD_SKIP|AUTH_INVALID_KEY|AUTH_FORBIDDEN_REPEATED|NETWORK_OR_5XX|RATE_LIMIT_RPM|QUOTA_DAILY_EXHAUSTED|QUOTA_PROJECT_ZERO|API_NOT_ENABLED|MODEL_UNAVAILABLE|AI_NOT_CONFIGURED|AI_CALL_FAILED)\]?:?\s*/g, '')
    .replace(INTERNAL_ERROR_TOKEN_REGEX, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s·:\-—]+|[\s·:\-—]+$/g, '')
    .trim();
}

export interface ClassifyDossierFailureInput {
  httpStatus?: number;
  error?: string | null;
  errorCategory?: string | null;
  minRemainingCooldownSec?: number | null;
  message?: string | null;
  interrupted?: boolean;
  aborted?: boolean;
}

const FATAL_AUTH_OR_CONFIG_CATEGORIES = new Set([
  'AI_NOT_CONFIGURED',
  'AUTH_INVALID_KEY',
  'AUTH_FORBIDDEN_REPEATED',
]);

const QUOTA_OR_PROJECT_CATEGORIES = new Set([
  'QUOTA_PROJECT_ZERO',
  'QUOTA_DAILY_EXHAUSTED',
  'API_NOT_ENABLED',
]);

const TRANSIENT_CATEGORIES = new Set([
  'FIRST_CHUNK_TIMEOUT',
  'NETWORK_OR_5XX',
  'MODEL_UNAVAILABLE',
  'RATE_LIMIT_RPM',
  'TPM_GUARD_SKIP',
]);

export function classifyDossierFailure(
  input: ClassifyDossierFailureInput,
): ParsedAiFailureInfo {
  if (input.aborted) {
    return {
      kind: 'fatal',
      errorCode: 'ABORTED',
      errorCategory: 'ABORTED',
      minRemainingCooldownSec: null,
      notConfigured: false,
      userMessageVi: 'Người dùng đã dừng thao tác sinh nội dung.',
    };
  }

  const rawMsg = typeof input.message === 'string' ? input.message : '';
  const rawErr = typeof input.error === 'string' ? input.error.trim() : '';
  const rawCat = typeof input.errorCategory === 'string' ? input.errorCategory.trim() : '';

  const errorCode =
    rawErr ||
    (rawCat === 'AI_NOT_CONFIGURED'
      ? 'AI_NOT_CONFIGURED'
      : rawCat === 'TPM_GUARD_SKIP'
        ? 'TPM_GUARD_SKIP'
        : 'AI_CALL_FAILED');

  let errorCategory = rawCat;
  if (!errorCategory) {
    if (errorCode === 'AI_NOT_CONFIGURED') {
      errorCategory = 'AI_NOT_CONFIGURED';
    } else if (errorCode === 'TPM_GUARD_SKIP' || rawMsg.includes('TPM_GUARD_SKIP')) {
      errorCategory = 'TPM_GUARD_SKIP';
    } else if (rawMsg.includes('FIRST_CHUNK_TIMEOUT')) {
      errorCategory = 'FIRST_CHUNK_TIMEOUT';
    } else if (input.httpStatus === 429) {
      errorCategory = 'RATE_LIMIT_RPM';
    } else if (errorCode === 'AI_POOL_EXHAUSTED') {
      errorCategory = 'AI_POOL_EXHAUSTED';
    } else {
      errorCategory = 'NETWORK_OR_5XX';
    }
  }

  const cooldown =
    typeof input.minRemainingCooldownSec === 'number' &&
    Number.isFinite(input.minRemainingCooldownSec)
      ? Math.max(0, Math.ceil(input.minRemainingCooldownSec))
      : null;

  const notConfigured =
    errorCode === 'AI_NOT_CONFIGURED' || errorCategory === 'AI_NOT_CONFIGURED';

  let kind: DossierFailureKind = 'transient';

  if (
    notConfigured ||
    FATAL_AUTH_OR_CONFIG_CATEGORIES.has(errorCategory) ||
    FATAL_AUTH_OR_CONFIG_CATEGORIES.has(errorCode)
  ) {
    kind = 'fatal';
  } else if (
    errorCode === 'AI_POOL_EXHAUSTED' ||
    errorCategory === 'AI_POOL_EXHAUSTED'
  ) {
    // Pool đang cạn: chỉ cho phép coi là tạm thời nếu đang nguội <= 60s
    kind = cooldown !== null && cooldown >= 1 && cooldown <= 60 ? 'transient' : 'fatal';
  } else if (QUOTA_OR_PROJECT_CATEGORIES.has(errorCategory)) {
    kind = cooldown !== null && cooldown >= 1 && cooldown <= 60 ? 'transient' : 'fatal';
  } else if (TRANSIENT_CATEGORIES.has(errorCategory)) {
    kind = 'transient';
  } else {
    kind = 'transient';
  }

  const sanitizedMsg = sanitizeClientErrorDisplayText(rawMsg);

  let userMessageVi = '';
  if (notConfigured) {
    userMessageVi =
      'Chưa có khóa Gemini API nào được cấu hình trong Kho Khóa.';
  } else if (
    errorCategory === 'AUTH_INVALID_KEY' ||
    errorCategory === 'AUTH_FORBIDDEN_REPEATED'
  ) {
    userMessageVi =
      'Khóa Gemini API không hợp lệ hoặc bị từ chối quyền truy cập. Vui lòng kiểm tra lại Kho Khóa.';
  } else if (errorCode === 'AI_POOL_EXHAUSTED') {
    if (cooldown !== null && cooldown >= 1 && cooldown <= 60) {
      userMessageVi = `Kho khóa đang quá tải tạm thời (còn khoảng ${cooldown}s hồi nguội). Hệ thống có thể tự thử lại.`;
    } else if (cooldown !== null && cooldown > 60) {
      userMessageVi = `Toàn bộ khóa trong Kho đang hồi nguội lâu (${cooldown}s). Vui lòng đợi hoặc bổ sung khóa khác.`;
    } else {
      userMessageVi =
        'Toàn bộ khóa trong Kho đang bận hoặc bị vô hiệu hóa. Vui lòng kiểm tra Kho Khóa.';
    }
  } else if (errorCategory === 'TPM_GUARD_SKIP') {
    userMessageVi =
      cooldown !== null && cooldown > 0
        ? `Hàng rào bảo vệ hạn mức token vừa tạm hoãn yêu cầu (hồi sau khoảng ${cooldown}s).`
        : 'Hàng rào bảo vệ hạn mức token vừa tạm hoãn yêu cầu để tránh nghẽn luồng.';
  } else if (errorCategory === 'FIRST_CHUNK_TIMEOUT') {
    userMessageVi =
      'Máy chủ AI phản hồi chậm quá thời gian chờ ở tín hiệu đầu tiên.';
  } else if (errorCategory === 'RATE_LIMIT_RPM') {
    userMessageVi =
      cooldown !== null && cooldown > 0
        ? `Khóa API vừa chạm ngưỡng tốc độ tạm thời (hồi sau khoảng ${cooldown}s).`
        : 'Khóa API vừa chạm ngưỡng tốc độ tạm thời.';
  } else if (QUOTA_OR_PROJECT_CATEGORIES.has(errorCategory)) {
    userMessageVi =
      sanitizedMsg ||
      'Dự án hoặc khóa Gemini API đã hết hạn mức sử dụng trong ngày / chưa bật dịch vụ.';
  } else if (input.interrupted) {
    userMessageVi =
      sanitizedMsg ||
      'Luồng kết nối AI bị gián đoạn giữa chừng.';
  } else {
    userMessageVi =
      sanitizedMsg ||
      'Kết nối tới dịch vụ AI tạm thời gián đoạn. Vui lòng thử lại.';
  }

  return {
    kind,
    errorCode,
    errorCategory,
    minRemainingCooldownSec: cooldown,
    notConfigured,
    userMessageVi,
  };
}

export function getDossierChapterContentLength(
  state?: Partial<DossierChapterState> | null,
): number {
  if (!state) return 0;
  if (state.status === 'completed') {
    return state.text?.trim().length ?? 0;
  }
  return (
    state.incompleteText?.trim().length ||
    state.text?.trim().length ||
    0
  );
}

export function createBestPartialSnapshot(
  state?: DossierChapterState | null,
): DossierChapterState | null {
  if (!state) return null;
  if (state.status === 'completed' && state.text?.trim()) {
    return { ...state };
  }
  if (state.status === 'incomplete' && state.incompleteText?.trim()) {
    return { ...state };
  }
  return null;
}

export function resolveChapterWithBestPartial(
  bestSnapshot: DossierChapterState | null,
  incoming: DossierChapterState,
): { resolvedState: DossierChapterState; restoredFromBest: boolean } {
  if (incoming.status === 'completed' && incoming.text?.trim()) {
    return { resolvedState: incoming, restoredFromBest: false };
  }
  const bestLen = getDossierChapterContentLength(bestSnapshot);
  const incomingLen = getDossierChapterContentLength(incoming);
  if (bestSnapshot && bestLen > 0 && incomingLen < bestLen) {
    return {
      resolvedState: {
        ...bestSnapshot,
        error: incoming.error ?? bestSnapshot.error,
        errorCode: incoming.errorCode ?? bestSnapshot.errorCode,
        errorCategory: incoming.errorCategory ?? bestSnapshot.errorCategory,
        minRemainingCooldownSec:
          incoming.minRemainingCooldownSec ?? bestSnapshot.minRemainingCooldownSec,
        interruptedReason:
          incoming.interruptedReason ??
          incoming.error ??
          bestSnapshot.interruptedReason,
        restoredFromLongerPartial: true,
        restoredNoticeVi: `Đã giữ lại bản dài hơn trước đó (${bestLen.toLocaleString('vi-VN')} ký tự) vì lần thử lại chỉ nhận được ${incomingLen.toLocaleString('vi-VN')} ký tự.`,
        updatedAt: Date.now(),
      },
      restoredFromBest: true,
    };
  }
  return { resolvedState: incoming, restoredFromBest: false };
}

export interface DualFuseChapterResult {
  status: 'completed' | 'incomplete' | 'error' | 'aborted';
  failure?: ParsedAiFailureInfo;
}

export interface DualFuseRunOptions {
  specsToRun: readonly DossierChapterSpec[];
  runChapter: (spec: DossierChapterSpec, pass: 1 | 2) => Promise<DualFuseChapterResult>;
  shouldStop: () => boolean;
  shouldPause?: () => boolean;
  pacingMs?: number;
  waitBetweenChapters?: (ms: number) => Promise<void>;
  onPassChange?: (pass: 1 | 2, queuedIds: DossierChapterId[]) => void;
}

export interface DualFuseSummary {
  completedInPass1: DossierChapterId[];
  retriedInPass2: DossierChapterId[];
  recoveredInPass2: DossierChapterId[];
  remainingIncompleteOrError: DossierChapterId[];
  haltedReason: 'none' | 'aborted' | 'paused' | 'fatal_error';
  fatalFailure?: ParsedAiFailureInfo;
}

export async function runDossierSequentialWithDualFuse(
  options: DualFuseRunOptions,
): Promise<DualFuseSummary> {
  const {
    specsToRun,
    runChapter,
    shouldStop,
    shouldPause,
    pacingMs = DOSSIER_INTER_CHAPTER_PACING_MS,
    waitBetweenChapters,
    onPassChange,
  } = options;

  const waitFn =
    waitBetweenChapters ??
    ((ms: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      }));

  const completedInPass1: DossierChapterId[] = [];
  const retriedInPass2: DossierChapterId[] = [];
  const recoveredInPass2: DossierChapterId[] = [];
  const remainingIncompleteOrError: DossierChapterId[] = [];
  const retryQueue: DossierChapterSpec[] = [];
  let haltedReason: DualFuseSummary['haltedReason'] = 'none';
  let fatalFailure: ParsedAiFailureInfo | undefined;

  onPassChange?.(1, []);

  for (let i = 0; i < specsToRun.length; i += 1) {
    if (shouldStop()) {
      haltedReason = 'aborted';
      break;
    }
    if (shouldPause?.()) {
      haltedReason = 'paused';
      break;
    }

    const spec = specsToRun[i];
    const result = await runChapter(spec, 1);

    if (result.status === 'aborted' || shouldStop()) {
      haltedReason = 'aborted';
      break;
    }

    if (result.status === 'completed') {
      completedInPass1.push(spec.id);
    } else if (result.failure?.kind === 'fatal') {
      haltedReason = 'fatal_error';
      fatalFailure = result.failure;
      remainingIncompleteOrError.push(spec.id);
      break;
    } else {
      retryQueue.push(spec);
    }

    if (shouldPause?.()) {
      haltedReason = 'paused';
      break;
    }

    if (i < specsToRun.length - 1 && pacingMs > 0) {
      await waitFn(pacingMs);
    }
  }

  if (haltedReason !== 'none') {
    for (const queued of retryQueue) {
      if (!remainingIncompleteOrError.includes(queued.id)) {
        remainingIncompleteOrError.push(queued.id);
      }
    }
    return {
      completedInPass1,
      retriedInPass2,
      recoveredInPass2,
      remainingIncompleteOrError,
      haltedReason,
      fatalFailure,
    };
  }

  if (retryQueue.length > 0) {
    onPassChange?.(
      2,
      retryQueue.map((s) => s.id),
    );
    if (pacingMs > 0) {
      await waitFn(pacingMs);
    }

    for (let j = 0; j < retryQueue.length; j += 1) {
      if (shouldStop()) {
        haltedReason = 'aborted';
        for (let k = j; k < retryQueue.length; k += 1) {
          remainingIncompleteOrError.push(retryQueue[k].id);
        }
        break;
      }
      if (shouldPause?.()) {
        haltedReason = 'paused';
        for (let k = j; k < retryQueue.length; k += 1) {
          remainingIncompleteOrError.push(retryQueue[k].id);
        }
        break;
      }

      const spec = retryQueue[j];
      retriedInPass2.push(spec.id);
      const retryResult = await runChapter(spec, 2);

      if (retryResult.status === 'aborted' || shouldStop()) {
        haltedReason = 'aborted';
        for (let k = j; k < retryQueue.length; k += 1) {
          if (!remainingIncompleteOrError.includes(retryQueue[k].id)) {
            remainingIncompleteOrError.push(retryQueue[k].id);
          }
        }
        break;
      }

      if (retryResult.status === 'completed') {
        recoveredInPass2.push(spec.id);
      } else {
        remainingIncompleteOrError.push(spec.id);
        if (retryResult.failure?.kind === 'fatal') {
          haltedReason = 'fatal_error';
          fatalFailure = retryResult.failure;
          for (let k = j + 1; k < retryQueue.length; k += 1) {
            remainingIncompleteOrError.push(retryQueue[k].id);
          }
          break;
        }
      }

      if (shouldPause?.()) {
        haltedReason = 'paused';
        for (let k = j + 1; k < retryQueue.length; k += 1) {
          remainingIncompleteOrError.push(retryQueue[k].id);
        }
        break;
      }

      if (j < retryQueue.length - 1 && pacingMs > 0) {
        await waitFn(pacingMs);
      }
    }
  }

  return {
    completedInPass1,
    retriedInPass2,
    recoveredInPass2,
    remainingIncompleteOrError,
    haltedReason,
    fatalFailure,
  };
}

export interface StoredDossierRecord {
  chartIdentityKey: string;
  updatedAt: number;
  sections: Partial<Record<DossierChapterId, DossierChapterState>>;
}

export function formatDossierSourceBadge(
  origin: 'cache' | 'generated',
): DossierSourceBadge {
  return origin === 'cache'
    ? 'Kế thừa từ bộ nhớ đệm'
    : 'Sinh mới trong hồ sơ';
}

export function resolveChapterDeterministicFactSheet(
  chart: ZiweiChart,
  spec: DossierChapterSpec,
): { factSheetMarkdown: string; periodContext: YunxianPeriodContext | null } {
  if (spec.mode === 'period' && typeof spec.year === 'number') {
    const pCtx = buildYunxianPeriodContext(chart, {
      mode: 'liunian',
      year: spec.year,
    });
    return {
      factSheetMarkdown: pCtx?.factTableMarkdown ?? '',
      periodContext: pCtx,
    };
  }
  if (spec.sectionId) {
    const res = buildDossierSectionFactSheetVi(chart, spec.sectionId);
    return {
      factSheetMarkdown: res.factSheetMarkdown,
      periodContext: null,
    };
  }
  return { factSheetMarkdown: '', periodContext: null };
}

export function resolveDossierChapterFromCaches(
  chart: ZiweiChart,
  spec: DossierChapterSpec,
  aiPeriodCache: Record<string, AiPeriodEntry>,
  localChapters: Partial<Record<DossierChapterId, DossierChapterState>>,
): DossierChapterState {
  const chartIdentityKey = buildChartIdentityKey(chart);
  const sectionCacheKey = buildDossierChapterCacheKey(chartIdentityKey, spec.id);
  const rawLocal = localChapters[spec.id];
  // Chốt chặn rò dữ liệu chéo (Mục vá 2): Bỏ qua hoàn toàn mọi mục trong localChapters không khớp sectionCacheKey của lá số hiện tại
  const matchingLocal =
    rawLocal && rawLocal.sectionCacheKey === sectionCacheKey ? rawLocal : undefined;

  if (spec.mode === 'period' && typeof spec.year === 'number') {
    const pKey = buildPeriodCacheKeyForYear(chart, spec.year);
    const periodEntry = aiPeriodCache[pKey];

    if (matchingLocal?.status === 'loading') {
      return matchingLocal;
    }
    if (periodEntry && hasValidCachedPeriodEntry(periodEntry)) {
      return {
        chapterId: spec.id,
        sectionCacheKey,
        status: 'completed',
        text: sanitizeDossierChapterText(periodEntry.text, spec.id, chart),
        meta: periodEntry.meta,
        auditFlags:
          periodEntry.auditFlags !== undefined
            ? periodEntry.auditFlags
            : matchingLocal?.auditFlags,
        deterministicRepairs:
          periodEntry.deterministicRepairs ?? matchingLocal?.deterministicRepairs,
        reauditedForVersion:
          periodEntry.reauditedForVersion ?? matchingLocal?.reauditedForVersion,
        reauditedAt: periodEntry.reauditedAt ?? matchingLocal?.reauditedAt,
        restoredFromLongerPartial: matchingLocal?.restoredFromLongerPartial,
        restoredNoticeVi: matchingLocal?.restoredNoticeVi,
        sourceBadge:
          matchingLocal?.sourceBadge ?? formatDossierSourceBadge('cache'),
      };
    }
    if (periodEntry?.incomplete) {
      return {
        chapterId: spec.id,
        sectionCacheKey,
        status: 'incomplete',
        incompleteText: sanitizeDossierChapterText(periodEntry.incompleteText, spec.id, chart, {
          skipPeriodSiHuaCheck: true,
        }),
        interruptedReason: periodEntry.interruptedReason || periodEntry.error,
        error: periodEntry.error,
        errorCode: periodEntry.errorCode,
        errorCategory: periodEntry.errorCategory,
        minRemainingCooldownSec: periodEntry.minRemainingCooldownSec,
        restoredFromLongerPartial: matchingLocal?.restoredFromLongerPartial,
        restoredNoticeVi: matchingLocal?.restoredNoticeVi,
        meta: periodEntry.meta,
        auditFlags:
          periodEntry.auditFlags !== undefined
            ? periodEntry.auditFlags
            : matchingLocal?.auditFlags,
        reauditedForVersion:
          periodEntry.reauditedForVersion ?? matchingLocal?.reauditedForVersion,
        reauditedAt: periodEntry.reauditedAt ?? matchingLocal?.reauditedAt,
        sourceBadge: matchingLocal?.sourceBadge,
      };
    }
    if (periodEntry?.error) {
      return {
        chapterId: spec.id,
        sectionCacheKey,
        status: 'error',
        error: periodEntry.error,
        errorCode: periodEntry.errorCode,
        errorCategory: periodEntry.errorCategory,
        minRemainingCooldownSec: periodEntry.minRemainingCooldownSec,
        meta: periodEntry.meta,
        auditFlags:
          periodEntry.auditFlags !== undefined
            ? periodEntry.auditFlags
            : matchingLocal?.auditFlags,
        reauditedForVersion:
          periodEntry.reauditedForVersion ?? matchingLocal?.reauditedForVersion,
        reauditedAt: periodEntry.reauditedAt ?? matchingLocal?.reauditedAt,
      };
    }
  }

  if (matchingLocal) {
    return {
      ...matchingLocal,
      text: sanitizeDossierChapterText(matchingLocal.text, spec.id, chart),
      incompleteText: sanitizeDossierChapterText(matchingLocal.incompleteText, spec.id, chart, {
        skipPeriodSiHuaCheck: true,
      }),
    };
  }

  return {
    chapterId: spec.id,
    sectionCacheKey,
    status: 'idle',
  };
}

// ─── 7. XUẤT BẢN HỒ SƠ THEO F1 (.HTML GIẤY CỔ / .MD / PLAIN TEXT) ────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inlineMarkdownToHtml(raw: string): string {
  const escaped = escapeHtml(raw);
  return escaped
    .replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
    .replace(/`([^`\n]+?)`/g, '<code>$1</code>');
}

export function simpleMarkdownToHtml(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      out.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      out.push('</ol>');
      inOl = false;
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) {
      closeLists();
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      closeLists();
      out.push('<hr />');
      continue;
    }
    // Blockquote block
    if (trimmed.startsWith('>')) {
      closeLists();
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(inlineMarkdownToHtml(lines[i].trim().replace(/^>\s?/, '')));
        i += 1;
      }
      i -= 1;
      out.push(`<blockquote>${quoteLines.join('<br />')}</blockquote>`);
      continue;
    }
    // Markdown pipe table (header + separator + body rows)
    if (
      trimmed.startsWith('|') &&
      i + 1 < lines.length &&
      isMarkdownTableSeparatorLine(lines[i + 1])
    ) {
      closeLists();
      const headers = splitMarkdownTableRow(trimmed);
      i += 2; // skip header & separator
      const bodyRows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        bodyRows.push(splitMarkdownTableRow(lines[i]));
        i += 1;
      }
      i -= 1;
      const thead = `<thead><tr>${headers.map((h) => `<th>${inlineMarkdownToHtml(h)}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${bodyRows
        .map(
          (row) =>
            `<tr>${headers.map((_, idx) => `<td>${inlineMarkdownToHtml(row[idx] ?? '')}</td>`).join('')}</tr>`,
        )
        .join('')}</tbody>`;
      out.push(`<table class="appendix-table">${thead}${tbody}</table>`);
      continue;
    }
    const hMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (hMatch) {
      closeLists();
      const level = Math.min(4, Math.max(2, hMatch[1].length + 1));
      out.push(`<h${level}>${inlineMarkdownToHtml(hMatch[2])}</h${level}>`);
      continue;
    }
    if (/^([•\-*])\s+/.test(trimmed)) {
      if (inOl) {
        out.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        out.push('<ul>');
        inUl = true;
      }
      out.push(`<li>${inlineMarkdownToHtml(trimmed.replace(/^([•\-*])\s+/, ''))}</li>`);
      continue;
    }
    if (/^\d+\.\s+/.test(trimmed)) {
      if (inUl) {
        out.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        out.push('<ol>');
        inOl = true;
      }
      out.push(`<li>${inlineMarkdownToHtml(trimmed.replace(/^\d+\.\s+/, ''))}</li>`);
      continue;
    }
    closeLists();
    out.push(`<p>${inlineMarkdownToHtml(trimmed)}</p>`);
  }
  closeLists();
  return out.join('\n');
}

export interface DossierHeaderMetadata {
  name: string;
  solar: string;
  lunar: string;
  yinYang: string;
  ju: string;
  mingBranch: string;
  mingMajors: string;
  mingZhuVi: string;
  shenZhuVi: string;
  hourBranchNameVi: string;
  hasExactBirthTime: boolean;
  clockTimeVi: string;
  trueSolarTimeHHMM: string | null;
  trueSolarCorrectionMin: number | null;
  trueSolarTimeVi: string;
  birthTimeFullSummaryVi: string;
  locationVi: string;
  longitude: number;
}

/**
 * QĐ-G5 — Nguồn duy nhất (Single Source of Truth) cho Header S5 (HTML / .MD / Copy / In trực tiếp / Modal UI).
 */
export function buildDossierHeaderMetadata(chart: ZiweiChart): DossierHeaderMetadata {
  const b = chart.birthInfo;
  const name = b.name || 'Ẩn danh';
  const solar = `${String(b.day).padStart(2, '0')}/${String(b.month).padStart(2, '0')}/${b.year}`;
  const lunar = `${chart.lunarInfo.lunarDay}/${chart.lunarInfo.lunarMonth}/${chart.lunarInfo.lunarYear} (${VI_STEMS[chart.lunarInfo.yearStem]} ${VI_BRANCHES[chart.lunarInfo.yearBranch]})`;
  const ming = chart.palaces.find((p) => p.branch === chart.mingGongBranch);
  const mingMajors =
    ming?.stars
      .filter((s) => s.type === 'major')
      .map((s) => translateStarName(s.name))
      .join(', ') || 'Vô chính diệu';
  const mingZhuVi = chart.mingZhu ? translateStarName(chart.mingZhu) : 'Không rõ';
  const shenZhuVi = chart.shenZhu ? translateStarName(chart.shenZhu) : 'Không rõ';

  const hourBranchNameVi = VI_BRANCHES[b.hour] ?? 'Tý';
  const hasValidLongitude =
    typeof b.longitude === 'number' && Number.isFinite(b.longitude);
  const longitude = hasValidLongitude ? b.longitude! : 105.0;
  const provinceVi = b.province ? translateProvinceName(b.province) : '';
  const placeParts = [b.city, provinceVi].filter((x): x is string => Boolean(x && x.trim()));
  const locationVi = hasValidLongitude
    ? placeParts.length > 0
      ? `${placeParts.join(', ')} (${longitude.toFixed(2)}°Đ)`
      : `Việt Nam (Kinh tuyến chuẩn ${longitude.toFixed(2)}°Đ)`
    : placeParts.length > 0
      ? `${placeParts.join(', ')} (chưa có kinh độ, giữ giờ chuẩn)`
      : 'Chưa chọn địa phương (không hiệu chỉnh kinh độ)';

  if (b.origInput && hasValidLongitude) {
    const clockTimeVi = `${String(b.origInput.clockHour).padStart(2, '0')}:${String(
      b.origInput.clockMinute,
    ).padStart(2, '0')}`;
    const isVietnam = b.province ? b.province.startsWith('Việt Nam') : true;
    const tst = calculateTrueSolarTime({
      year: b.origInput.year,
      month: b.origInput.month,
      day: b.origInput.day,
      clockHour: b.origInput.clockHour,
      clockMinute: b.origInput.clockMinute,
      longitude,
      utcOffsetMinutes: isVietnam ? 420 : 480,
    });
    const trueSolarTimeHHMM = formatTrueSolarClock(tst);
    const trueSolarCorrectionMin = Math.round(tst.totalCorrectionMinutes);
    const diffSign =
      trueSolarCorrectionMin >= 0 ? `+${trueSolarCorrectionMin}` : `${trueSolarCorrectionMin}`;
    const solarBranchVi = VI_BRANCHES[tst.branch] ?? hourBranchNameVi;
    const trueSolarTimeVi = `${trueSolarTimeHHMM} (Giờ ${solarBranchVi}, hiệu chỉnh ${diffSign} phút)`;
    const birthTimeFullSummaryVi = `Giờ đồng hồ: ${clockTimeVi} → Giờ Mặt Trời thật: ${trueSolarTimeHHMM} (Giờ ${solarBranchVi}, hiệu chỉnh ${diffSign} phút)`;

    return {
      name,
      solar,
      lunar,
      yinYang: translateYinYang(chart.yinYangGender),
      ju: translateWuxingJu(chart.wuxingJuName),
      mingBranch: VI_BRANCHES[chart.mingGongBranch],
      mingMajors,
      mingZhuVi,
      shenZhuVi,
      hourBranchNameVi,
      hasExactBirthTime: true,
      clockTimeVi,
      trueSolarTimeHHMM,
      trueSolarCorrectionMin,
      trueSolarTimeVi,
      birthTimeFullSummaryVi,
      locationVi,
      longitude,
    };
  }

  if (b.origInput) {
    const clockTimeVi = `${String(b.origInput.clockHour).padStart(2, '0')}:${String(
      b.origInput.clockMinute,
    ).padStart(2, '0')}`;
    const trueSolarTimeVi = `Giờ ${hourBranchNameVi} (chưa chọn địa phương, giữ nguyên giờ chuẩn)`;
    const birthTimeFullSummaryVi = `Giờ đồng hồ: ${clockTimeVi} (Giờ ${hourBranchNameVi}, chưa chọn địa phương nên giữ giờ chuẩn không hiệu chỉnh kinh độ)`;

    return {
      name,
      solar,
      lunar,
      yinYang: translateYinYang(chart.yinYangGender),
      ju: translateWuxingJu(chart.wuxingJuName),
      mingBranch: VI_BRANCHES[chart.mingGongBranch],
      mingMajors,
      mingZhuVi,
      shenZhuVi,
      hourBranchNameVi,
      hasExactBirthTime: true,
      clockTimeVi,
      trueSolarTimeHHMM: null,
      trueSolarCorrectionMin: null,
      trueSolarTimeVi,
      birthTimeFullSummaryVi,
      locationVi,
      longitude,
    };
  }

  return {
    name,
    solar,
    lunar,
    yinYang: translateYinYang(chart.yinYangGender),
    ju: translateWuxingJu(chart.wuxingJuName),
    mingBranch: VI_BRANCHES[chart.mingGongBranch],
    mingMajors,
    mingZhuVi,
    shenZhuVi,
    hourBranchNameVi,
    hasExactBirthTime: false,
    clockTimeVi: 'Chưa rõ giờ đồng hồ',
    trueSolarTimeHHMM: null,
    trueSolarCorrectionMin: null,
    trueSolarTimeVi: `Giờ ${hourBranchNameVi} (mặc định khi chưa rõ giờ sinh)`,
    birthTimeFullSummaryVi: `Chưa rõ giờ đồng hồ gốc (lập lá số mặc định theo Giờ ${hourBranchNameVi}).`,
    locationVi,
    longitude,
  };
}

function formatPalaceMajorsSummaryPlain(palace: Palace): string {
  const majors = palace.stars.filter((s) => s.type === 'major');
  if (majors.length > 0) {
    return majors
      .map((s) => `${translateStarName(s.name)}${s.brightnessRaw ? ` [${translateBrightness(s.brightnessRaw)}]` : ''}`)
      .join(', ');
  }
  if (palace.borrowedStars?.length) {
    const fromVi = palace.borrowedFromName ? ` từ ${translatePalaceName(palace.borrowedFromName)}` : '';
    return `Vô chính diệu (mượn ${palace.borrowedStars.map((s) => translateStarName(s)).join(', ')}${fromVi})`;
  }
  return 'Vô chính diệu';
}

function getShenPalaceMeaningSentenceVi(shenPalaceNameCn: string, shenPalaceNameVi: string): string {
  const cleanKey = shenPalaceNameCn.replace(/宫$/u, '');
  switch (cleanKey) {
    case '命':
      return 'Mệnh Thân đồng cung nghĩa là bản thân đương số tự làm chủ định hướng cuộc đời, ít bị hoàn cảnh bên ngoài chi phối.';
    case '福德':
      return 'Thân cư Phúc Đức nghĩa là đời sống tinh thần, tâm thế và phúc phần gia đạo là chỗ dựa cốt lõi của đương số.';
    case '官禄':
      return 'Thân cư Quan Lộc nghĩa là sự nghiệp, công danh và năng lực hành động là trọng tâm cả đời đương số.';
    case '迁移':
      return 'Thân cư Thiên Di nghĩa là môi trường bên ngoài, sự dịch chuyển và các mối quan hệ xã hội định hình mạnh cuộc đời đương số.';
    case '财帛':
      return 'Thân cư Tài Bạch nghĩa là tài chính, khả năng tạo lập và quản lý nguồn lực giữ vai trò quyết định với đương số.';
    case '夫妻':
      return 'Thân cư Phu Thê nghĩa là gia đình và hôn nhân là trọng tâm cả đời đương số.';
    default:
      return `Thân cư ${shenPalaceNameVi} nghĩa là các vấn đề thuộc cung này giữ vai trò trọng tâm trong hậu vận của đương số.`;
  }
}

export function buildDossierQuickHeaderLines(chart: ZiweiChart): {
  mingLine: string;
  shenLine: string;
  daXianLine: string;
} {
  const mingPal = chart.palaces.find((p) => p.branch === chart.mingGongBranch) ?? chart.palaces[0];
  const shenPal = chart.palaces.find((p) => p.branch === chart.shenGongBranch) ?? chart.palaces[0];
  const mingMajors = formatPalaceMajorsSummaryPlain(mingPal);
  const mingLine = `Mệnh: ${mingMajors} tại ${VI_BRANCHES[mingPal.branch]} (${VI_STEMS[mingPal.stem]} ${VI_BRANCHES[mingPal.branch]}).`;
  const shenLine =
    mingPal.branch === shenPal.branch
      ? `Thân: Thân đồng cung tại Mệnh (${VI_BRANCHES[shenPal.branch]}).`
      : `Thân: Thân cư ${translatePalaceName(shenPal.name)} tại ${VI_BRANCHES[shenPal.branch]}.`;

  const curDxIdx =
    typeof chart.currentDaXianIndex === 'number' &&
    chart.currentDaXianIndex >= 0 &&
    chart.currentDaXianIndex < chart.daXians.length
      ? chart.currentDaXianIndex
      : -1;
  const curDx = curDxIdx >= 0 ? chart.daXians[curDxIdx] : null;
  const daXianLine = curDx
    ? `Đại hạn hiện tại: ${curDx.startAge}–${curDx.endAge} tuổi tại cung ${translatePalaceName(curDx.palaceName)} (${VI_BRANCHES[curDx.palaceBranch]}).`
    : 'Đại hạn hiện tại: Chưa vào Đại Hạn.';

  return { mingLine, shenLine, daXianLine };
}

/**
 * P10 (Nhánh B 1.5.8): Khối Kết Luận Nhanh — Cốt Tủy Lá Số (5 Câu tự nhiên).
 * Dùng ngôi xưng "đương số" (0 lần "bạn"), chỉ chứa dữ kiện xác định từ engine.
 */
export function buildDeterministicExecutiveSummaryVi(
  chart: ZiweiChart,
  baseYear?: number,
): string[] {
  const focusYear =
    typeof baseYear === 'number' && Number.isFinite(baseYear)
      ? baseYear
      : (DOSSIER_CHAPTER_SPECS.find((s) => s.id === 'year_2026')?.year ?? 2026);
  const nextYear = focusYear + 1;

  const info = buildDossierHeaderMetadata(chart);
  const mingPal = chart.palaces.find((p) => p.branch === chart.mingGongBranch) ?? chart.palaces[0];
  const shenPal = chart.palaces.find((p) => p.branch === chart.shenGongBranch) ?? chart.palaces[0];
  const mingMajorsDesc = formatPalaceMajorsSummaryPlain(mingPal);
  const shenPalaceNameVi = translatePalaceName(shenPal.name);

  const timeClause = info.hasExactBirthTime
    ? info.trueSolarTimeHHMM
      ? `lúc ${info.clockTimeVi} (giờ Mặt Trời thật ${info.trueSolarTimeHHMM}, giờ ${info.hourBranchNameVi})`
      : `lúc ${info.clockTimeVi} (giờ ${info.hourBranchNameVi})`
    : `trong trường hợp chưa rõ giờ đồng hồ gốc (tạm an giờ ${info.hourBranchNameVi})`;

  const sentence1 =
    mingPal.branch === shenPal.branch
      ? `Đương số (${info.yinYang}, ${info.ju}) sinh ngày ${info.solar} ${timeClause}, có cung Mệnh và cung Thân đồng cung tại ${VI_BRANCHES[mingPal.branch]} (${VI_STEMS[mingPal.stem]} ${VI_BRANCHES[mingPal.branch]}) với chính tinh ${mingMajorsDesc}.`
      : `Đương số (${info.yinYang}, ${info.ju}) sinh ngày ${info.solar} ${timeClause}, có cung Mệnh đóng tại ${VI_BRANCHES[mingPal.branch]} (${VI_STEMS[mingPal.stem]} ${VI_BRANCHES[mingPal.branch]}) với chính tinh ${mingMajorsDesc}, còn cung Thân của đương số đóng tại cung ${shenPalaceNameVi} ở ${VI_BRANCHES[shenPal.branch]}.`;

  const sentence2 = getShenPalaceMeaningSentenceVi(shenPal.name, shenPalaceNameVi);

  const natalStemIdx = chart.lunarInfo.yearStem;
  const natalStemVi = VI_STEMS[natalStemIdx] ?? '';
  const natalGanZhiVi = `${natalStemVi} ${VI_BRANCHES[chart.lunarInfo.yearBranch] ?? ''}`;
  const natalTransforms = getSiHuaByStem(natalStemIdx);
  const describeNatalTransform = (key: SiHua): string => {
    const starCn = natalTransforms[key];
    const starVi = starCn ? translateStarName(starCn) : 'Không rõ';
    const pal = starCn ? chart.palaces.find((p) => p.stars.some((s) => s.name === starCn)) : undefined;
    const palVi = pal ? translatePalaceName(pal.name) : 'chưa rõ cung';
    return `${starVi} Hóa ${translateSiHua(key)} tại ${palVi}`;
  };
  const sentence3 = `Bốn sao Tứ Hóa bản mệnh (Can ${natalStemVi} năm ${natalGanZhiVi}) của đương số gồm ${describeNatalTransform('禄')}, ${describeNatalTransform('权')}, ${describeNatalTransform('科')}, và ${describeNatalTransform('忌')}.`;

  const nominalAgeFocus = focusYear - chart.lunarInfo.lunarYear + 1;
  const dxIdxFocus = resolveEffectiveDaXianIndex(chart, 'liunian', focusYear);
  const pCtxFocus = buildYunxianPeriodContext(chart, { mode: 'liunian', year: focusYear });
  const dxFocusLabel =
    dxIdxFocus >= 0 && chart.daXians[dxIdxFocus]
      ? `đại hạn ${chart.daXians[dxIdxFocus].startAge}–${chart.daXians[dxIdxFocus].endAge} tuổi tại cung ${translatePalaceName(chart.daXians[dxIdxFocus].palaceName)}`
      : 'trạng thái chưa vào Đại Hạn';
  const sentence4 = `Năm ${focusYear} (${nominalAgeFocus} tuổi âm${pCtxFocus ? `, năm ${pCtxFocus.ganZhiVi}` : ''}), đương số đang ở ${dxFocusLabel}${pCtxFocus ? ` với Lưu Mệnh đóng tại ${VI_BRANCHES[pCtxFocus.branchIndex]} kích hoạt trực tiếp cung gốc ${pCtxFocus.activatedPalace.natalPalaceNameVi}` : ''}.`;

  const nominalAgeNext = nextYear - chart.lunarInfo.lunarYear + 1;
  const dxIdxNext = resolveEffectiveDaXianIndex(chart, 'liunian', nextYear);
  const pCtxNext = buildYunxianPeriodContext(chart, { mode: 'liunian', year: nextYear });
  const lnLoc = pCtxNext?.periodSiHua.find((s) => s.mutagenKey === '禄');
  const lnKy = pCtxNext?.periodSiHua.find((s) => s.mutagenKey === '忌');
  const dxNextNote =
    dxIdxNext < 0
      ? ' (chưa vào Đại Hạn)'
      : dxIdxNext !== dxIdxFocus && chart.daXians[dxIdxNext]
        ? ` (chuyển sang đại hạn ${chart.daXians[dxIdxNext].startAge}–${chart.daXians[dxIdxNext].endAge} tuổi tại cung ${translatePalaceName(chart.daXians[dxIdxNext].palaceName)})`
        : '';
  const locText = lnLoc
    ? `${lnLoc.starNameVi} tại Cung ${lnLoc.periodPalaceRoleVi} (trùng ${lnLoc.natalPalaceNameVi})`
    : 'trục thuận lợi của Lưu Niên';
  const kyText = lnKy
    ? `${lnKy.starNameVi} tại Cung ${lnKy.periodPalaceRoleVi} (trùng ${lnKy.natalPalaceNameVi})`
    : 'trục cần đề phòng';
  const sentence5 = `Sang năm ${nextYear} (${nominalAgeNext} tuổi âm${pCtxNext ? `, năm ${pCtxNext.ganZhiVi}` : ''})${dxNextNote}, Lưu Lộc rơi vào ${locText} nhưng Lưu Kỵ rơi vào ${kyText}, nên đương số cần thận trọng và kiểm soát rủi ro kỹ lưỡng.`;

  return [sentence1, sentence2, sentence3, sentence4, sentence5];
}

interface GlossaryEntrySpec {
  term: string;
  bodyText: string;
}

function buildCoreElevenGlossaryEntries(chart: ZiweiChart): GlossaryEntrySpec[] {
  const mingPal = chart.palaces.find((p) => p.branch === chart.mingGongBranch) ?? chart.palaces[0];
  const shenPal = chart.palaces.find((p) => p.branch === chart.shenGongBranch) ?? chart.palaces[0];
  const curDxIdx =
    typeof chart.currentDaXianIndex === 'number' &&
    chart.currentDaXianIndex >= 0 &&
    chart.currentDaXianIndex < chart.daXians.length
      ? chart.currentDaXianIndex
      : -1;
  const curDx = curDxIdx >= 0 ? chart.daXians[curDxIdx] : null;
  const focusYear = DOSSIER_CHAPTER_SPECS.find((s) => s.id === 'year_2026')?.year ?? 2026;
  const pCtxFocus = buildYunxianPeriodContext(chart, { mode: 'liunian', year: focusYear });
  const vcdPalace = chart.palaces.find((p) => p.isEmpty && p.borrowedFromName);
  const mingMajorsWithBrightness = mingPal.stars
    .filter((s) => s.type === 'major')
    .slice(0, 2)
    .map((s) => `${translateStarName(s.name)}${s.brightnessRaw ? ` [${translateBrightness(s.brightnessRaw)}]` : ''}`)
    .join(', ');
  const mingOpp = chart.palaces.find((p) => p.branch === (mingPal.branch + 6) % 12);
  const mingThA = chart.palaces.find((p) => p.branch === (mingPal.branch + 4) % 12);
  const mingThB = chart.palaces.find((p) => p.branch === (mingPal.branch + 8) % 12);

  const natalTransforms = getSiHuaByStem(chart.lunarInfo.yearStem);
  const locStarCn = natalTransforms['禄'];
  const locPal = chart.palaces.find((p) => p.stars.some((s) => s.name === locStarCn));

  const mingShenExample =
    mingPal.branch === shenPal.branch
      ? ` Ví dụ trên lá số của đương số, Mệnh và Thân đồng cung tại ${VI_BRANCHES[mingPal.branch]}.`
      : ` Ví dụ trên lá số của đương số, Mệnh đóng tại ${VI_BRANCHES[mingPal.branch]} còn Thân cư ${translatePalaceName(shenPal.name)} tại ${VI_BRANCHES[shenPal.branch]}.`;

  const daXianExample = curDx
    ? ` Hiện đương số đang ở Đại Hạn ${curDx.startAge}–${curDx.endAge} tuổi tại cung ${translatePalaceName(curDx.palaceName)}.`
    : '';

  const liuNianExample = pCtxFocus
    ? ` Ví dụ năm ${focusYear} (${pCtxFocus.ganZhiVi}), Lưu Mệnh đóng tại ${VI_BRANCHES[pCtxFocus.branchIndex]} kích hoạt cung gốc ${pCtxFocus.activatedPalace.natalPalaceNameVi}.`
    : '';

  const siHuaExample =
    locStarCn && locPal
      ? ` Ví dụ Tứ Hóa Bản Mệnh của đương số có ${translateStarName(locStarCn)} Hóa Lộc tại cung ${translatePalaceName(locPal.name)}.`
      : '';

  const tamPhuongExample =
    mingOpp && mingThA && mingThB
      ? ` Với cung Mệnh của đương số tại ${VI_BRANCHES[mingPal.branch]}, trục này gồm Mệnh, đối cung ${translatePalaceName(mingOpp.name)} (${VI_BRANCHES[mingOpp.branch]}) và hai cung Tam Hợp là ${translatePalaceName(mingThA.name)} (${VI_BRANCHES[mingThA.branch]}), ${translatePalaceName(mingThB.name)} (${VI_BRANCHES[mingThB.branch]}).`
      : '';

  const brightnessExample = mingMajorsWithBrightness
    ? ` Ví dụ tại cung Mệnh của đương số có ${mingMajorsWithBrightness}.`
    : '';

  const vcdExample = vcdPalace
    ? ` Ví dụ trên lá số này, cung ${translatePalaceName(vcdPalace.name)} (${VI_BRANCHES[vcdPalace.branch]}) là cung Vô chính diệu.`
    : '';

  const xungExample = mingOpp
    ? ` Ví dụ cung ${translatePalaceName(mingOpp.name)} (${VI_BRANCHES[mingOpp.branch]}) xung chiếu trực tiếp vào cung Mệnh của đương số.`
    : '';

  const borrowExample =
    vcdPalace && vcdPalace.borrowedStars?.length
      ? ` Ví dụ cung ${translatePalaceName(vcdPalace.name)} mượn Chính tinh ${vcdPalace.borrowedStars.map((s) => translateStarName(s)).join(', ')} từ đối cung ${translatePalaceName(vcdPalace.borrowedFromName)}.`
      : '';

  return [
    {
      term: 'Mệnh/Thân',
      bodyText: `Cung Mệnh phản ánh bản chất tiên thiên và cốt cách gốc của đương số; cung Thân phản ánh xu hướng hành động, môi trường trọng tâm và kết quả ở hậu vận.${mingShenExample}`,
    },
    {
      term: 'Đại Hạn',
      bodyText: `Chu kỳ vận trình 10 năm liên tiếp đi qua lần lượt 12 cung trên lá số, định hình bối cảnh nền tảng cho từng giai đoạn cuộc đời đương số.${daXianExample}`,
    },
    {
      term: 'Lưu Niên',
      bodyText: `Vận trình từng năm dương lịch xoay quanh Thiên Can và Địa Chi của năm đó, làm nổi bật các sự kiện cụ thể trong khung Đại Hạn.${liuNianExample}`,
    },
    {
      term: 'Tứ Hóa',
      bodyText: `Bốn trạng thái biến hóa của sao gồm Hóa Lộc (tài lộc, hanh thông), Hóa Quyền (quyền lực, chủ động), Hóa Khoa (danh tiếng, quý nhân, hóa giải) và Hóa Kỵ (trở ngại, áp lực, nút thắt).${siHuaExample}`,
    },
    {
      term: 'Tam Phương Tứ Chính',
      bodyText: `Hệ quy chiếu 4 cung liên kết chặt chẽ khi luận giải một cung bất kỳ, gồm bản cung, đối cung xung chiếu (+6) và hai cung Tam Hợp (+4 và +8).${tamPhuongExample}`,
    },
    {
      term: 'Tam Hợp',
      bodyText: `Hai cung cách bản cung đúng 4 vị trí theo chiều thuận (+4) và nghịch (+8) trên vòng Địa Chi, tạo thành thế chân kiềng hỗ trợ trực tiếp cho bản cung.`,
    },
    {
      term: 'Độ sáng sao',
      bodyText: `Mức độ phát huy lực lượng của sao theo vị trí Địa Chi: Miếu (mạnh nhất), Vượng (mạnh), Đắc (khá), Lợi (tốt), Bình (trung bình), Hãm (yếu).${brightnessExample}`,
    },
    {
      term: 'Vô chính diệu',
      bodyText: `Cung không có Chính tinh nào tọa thủ trực tiếp bên trong, thường linh hoạt theo hoàn cảnh và chịu ảnh hưởng mạnh từ đối cung lẫn các sao trợ tinh.${vcdExample}`,
    },
    {
      term: 'xung chiếu',
      bodyText: `Tác động trực diện từ cung đối diện cách bản cung 6 vị trí Địa Chi (+6), có sức chi phối trực tiếp về cơ hội lẫn áp lực lên bản cung.${xungExample}`,
    },
    {
      term: 'mượn sao',
      bodyText: `Quy ước lấy bộ Chính tinh ở đối cung sang tham chiếu cho cung Vô chính diệu; chiều ngược lại cung có Chính tinh không mượn sao của cung Vô chính diệu.${borrowExample}`,
    },
    {
      term: 'cách cục',
      bodyText: `Tổ hợp sao đặc trưng hình thành từ vị trí Mệnh Thân, Tam Phương Tứ Chính và Tứ Hóa trên lá số, phản ánh khuynh hướng nổi bật về tài năng, sự nghiệp và biến động của đương số.`,
    },
  ];
}

/**
 * X6: Bảng Thuật Ngữ 11 mục đứng ngay sau Kết Luận Nhanh trong bản xuất (.MD & .HTML).
 */
export function buildBodyGlossaryMarkdown(chart: ZiweiChart): string {
  const entries = buildCoreElevenGlossaryEntries(chart);
  const lines = ['## Bảng Thuật Ngữ'];
  for (const item of entries) {
    lines.push(`- **${item.term}**: ${item.bodyText}`);
  }
  return lines.join('\n');
}

function formatChapterReadingGuideLines(focusYear: number, nextYear: number): string[] {
  return [
    'Đọc Kết Luận Nhanh trước để nắm cốt tủy lá số.',
    `Chương 1 cho bức tranh tổng quan; chương 2–4 luận từng cung; chương 5–6 luận vận hạn năm ${focusYear} và ${nextYear}; chương 7–8 luận chiến lược 5 năm và tầm nhìn 10 năm.`,
    'Phụ lục dùng để tra cứu: bảng theo cung, bảng theo năm và nguồn tham khảo.',
  ];
}

/**
 * X7: Dựng 3 Phụ lục A/B/C hoàn toàn xác định từ `chart` + `refs` (tách từ X3).
 * Không bao giờ lấy văn bản do AI sinh làm nguồn; an toàn với lá số 0 VCD / 0 Tự Hóa / chưa vào Đại Hạn.
 */
export function buildDossierAppendicesMarkdown(
  chart: ZiweiChart,
  refs: readonly ExtractedReferenceItem[],
): string {
  const lines: string[] = [];
  const info = buildDossierHeaderMetadata(chart);
  const curDxIdx =
    typeof chart.currentDaXianIndex === 'number' &&
    chart.currentDaXianIndex >= 0 &&
    chart.currentDaXianIndex < chart.daXians.length
      ? chart.currentDaXianIndex
      : -1;
  const nextDxIdx =
    curDxIdx >= 0 && curDxIdx + 1 < chart.daXians.length
      ? curDxIdx + 1
      : curDxIdx < 0 && chart.daXians.length > 0
        ? 0
        : -1;

  // ── Phụ lục A ────────────────────────────────────────────────────────────────
  lines.push('## Phụ lục A — Bảng Tra Cứu Theo Cung');
  lines.push('');
  lines.push('### A.1. Bảng Đại Hạn 12 Cung');
  lines.push('| Cung | Can Chi | Tuổi Đại Hạn | Giai đoạn năm | Ghi chú |');
  lines.push('| :--- | :--- | :--- | :--- | :--- |');
  for (let i = 0; i < chart.daXians.length; i += 1) {
    const dx = chart.daXians[i];
    const pal = chart.palaces.find((p) => p.branch === dx.palaceBranch);
    const palNameVi = pal ? translatePalaceName(pal.name) : translatePalaceName(dx.palaceName);
    const ganZhiVi = pal ? `${VI_STEMS[pal.stem]} ${VI_BRANCHES[pal.branch]}` : VI_BRANCHES[dx.palaceBranch];
    const yrs = getDaXianYears(chart, i);
    const yrsStr = yrs.length > 0 ? `${yrs[0]}–${yrs[yrs.length - 1]}` : '—';
    const note = i === curDxIdx ? 'Đại hạn hiện tại' : i === nextDxIdx ? 'Đại hạn kế tiếp' : '—';
    lines.push(`| ${palNameVi} | ${ganZhiVi} | ${dx.startAge}–${dx.endAge} tuổi | ${yrsStr} | ${note} |`);
  }

  lines.push('');
  lines.push('### A.2. Bảng Mượn Sao (Cung Vô Chính Diệu)');
  const emptyPalaces = chart.palaces.filter((p) => p.isEmpty);
  if (emptyPalaces.length === 0) {
    lines.push('Lá số này không có cung Vô chính diệu (cả 12 cung đều có Chính tinh tọa thủ).');
  } else {
    lines.push('| Cung Vô chính diệu | Can Chi | Mượn sao từ đối cung | Chính tinh được mượn |');
    lines.push('| :--- | :--- | :--- | :--- |');
    for (const p of emptyPalaces) {
      const fromVi = p.borrowedFromName ? translatePalaceName(p.borrowedFromName) : 'Đối cung';
      const borrowedVi =
        p.borrowedStars && p.borrowedStars.length > 0
          ? p.borrowedStars.map((s) => translateStarName(s)).join(', ')
          : 'Không có';
      lines.push(
        `| ${translatePalaceName(p.name)} | ${VI_STEMS[p.stem]} ${VI_BRANCHES[p.branch]} | ${fromVi} | ${borrowedVi} |`,
      );
    }
  }

  lines.push('');
  lines.push('### A.3. Bảng Tam Phương Tứ Chính Theo Từng Cung');
  lines.push('| Bản cung | Chính tinh bản cung | Đối cung xung chiếu (+6) | Hai cung Tam Hợp (+4, +8) |');
  lines.push('| :--- | :--- | :--- | :--- |');
  const formatPalMajorsCompact = (pal?: Palace): string => {
    if (!pal) return 'Không rõ';
    const majors = pal.stars.filter((s) => s.type === 'major');
    if (majors.length === 0) return 'Vô chính diệu';
    return majors
      .map((s) => `${translateStarName(s.name)}${s.brightnessRaw ? ` [${translateBrightness(s.brightnessRaw)}]` : ''}`)
      .join(', ');
  };
  const orderedPalaces = [...chart.palaces].sort((a, b) => a.branch - b.branch);
  for (const p of orderedPalaces) {
    const opp = chart.palaces.find((x) => x.branch === (p.branch + 6) % 12);
    const thA = chart.palaces.find((x) => x.branch === (p.branch + 4) % 12);
    const thB = chart.palaces.find((x) => x.branch === (p.branch + 8) % 12);
    lines.push(
      `| ${translatePalaceName(p.name)} (${VI_STEMS[p.stem]} ${VI_BRANCHES[p.branch]}) | ${formatPalMajorsCompact(p)} | ${opp ? `${translatePalaceName(opp.name)} (${VI_BRANCHES[opp.branch]})` : '—'} | ${thA ? `${translatePalaceName(thA.name)} (${VI_BRANCHES[thA.branch]})` : '—'}, ${thB ? `${translatePalaceName(thB.name)} (${VI_BRANCHES[thB.branch]})` : '—'} |`,
    );
  }

  lines.push('');
  lines.push('### A.4. Thông Số An Sao & Thời Gian Sinh');
  lines.push(`- **Đương số**: ${info.name} (${info.yinYang})`);
  lines.push(`- **Giờ sinh**: ${info.birthTimeFullSummaryVi}`);
  lines.push(`- **Nơi sinh & Kinh độ**: ${info.locationVi}`);
  lines.push(`- **Cục số**: ${info.ju} · **Mệnh Chủ**: ${info.mingZhuVi} · **Thân Chủ**: ${info.shenZhuVi}`);

  // ── Phụ lục B ────────────────────────────────────────────────────────────────
  const focusYear = DOSSIER_CHAPTER_SPECS.find((s) => s.id === 'year_2026')?.year ?? 2026;
  const h5End = focusYear + 4;
  const h10End = focusYear + 9;
  const horizon10 = buildMultiYearHorizonContext(chart, focusYear, h10End);

  lines.push('');
  lines.push('## Phụ lục B — Bảng Tra Cứu Theo Năm');
  lines.push('');
  lines.push(`### B.1. Bảng Thiên Can Địa Chi & Đại Hạn Các Năm (${focusYear}–${h10End})`);
  lines.push('| Năm | Can Chi | Tuổi âm | Đại Hạn chủ quản | Lưu Mệnh kích hoạt |');
  lines.push('| :--- | :--- | :--- | :--- | :--- |');
  for (const row of horizon10.rows) {
    const dxCol = row.governingDaXian.isPreDaXian
      ? 'Chưa vào Đại Hạn'
      : `${row.governingDaXian.palaceNameVi} (${row.governingDaXian.ageRangeVi})`;
    lines.push(
      `| ${row.year} | ${row.lunarGanZhiVi} | ${row.nominalAge} tuổi | ${dxCol} | ${row.activatedPalace.branchVi} (trùng ${row.activatedPalace.natalPalaceNameVi}) |`,
    );
  }

  const pushHorizonSiHuaRows = (title: string, rows: typeof horizon10.rows) => {
    lines.push('');
    lines.push(title);
    for (const row of rows) {
      lines.push(`- **Năm ${row.year} (${row.lunarGanZhiVi} · ${row.nominalAge} tuổi âm)**:`);
      for (const sh of row.liuNianSiHua.allFour) {
        lines.push(`  - ${formatPeriodSiHuaFactLine(sh, 'Lưu').replace(/^•\s*/, '')}`);
      }
    }
  };

  pushHorizonSiHuaRows(`### B.2. Bảng Lưu Tứ Hóa Giai Đoạn ${focusYear}–${h5End}`, horizon10.rows.slice(0, 5));
  pushHorizonSiHuaRows(`### B.3. Bảng Lưu Tứ Hóa Giai Đoạn ${h5End + 1}–${h10End}`, horizon10.rows.slice(5));

  lines.push('');
  lines.push(`### B.4. Vị Trí Sao Lưu Động (${focusYear}–${h10End})`);
  for (const row of horizon10.rows) {
    const dynDetail = row.dynamicStars
      .map(
        (d) =>
          `${d.starLabelVi} tại Cung ${d.periodPalaceRoleVi} (${d.natalPalaceNameVi} - ${d.natalGanZhiVi})`,
      )
      .join(' · ');
    lines.push(`- **${row.year} (${row.lunarGanZhiVi})**: ${dynDetail}`);
  }

  lines.push('');
  lines.push('### B.5. Danh Sách Tứ Hóa Đại Hạn Hiện Tại & Kế Tiếp');
  const formatDaXianSiHuaLines = (dxIdx: number, tag: string) => {
    const dx = chart.daXians[dxIdx];
    const pal = chart.palaces.find((p) => p.branch === dx.palaceBranch);
    const palNameVi = pal ? translatePalaceName(pal.name) : translatePalaceName(dx.palaceName);
    const stemIdx = pal ? pal.stem : 0;
    const stemVi = VI_STEMS[stemIdx] ?? '';
    const transforms = getDaXianSiHua(chart, dxIdx)?.transforms ?? getSiHuaByStem(stemIdx);
    const parts = (['禄', '权', '科', '忌'] as SiHua[]).map((sh) => {
      const starCn = transforms[sh];
      const targetPal = chart.palaces.find((x) => x.stars.some((s) => s.name === starCn));
      const targetVi = targetPal ? translatePalaceName(targetPal.name) : 'Không xác định';
      return `${translateStarName(starCn)} Hóa ${translateSiHua(sh)} → ${targetVi}`;
    });
    lines.push(
      `- **${tag} (${dx.startAge}–${dx.endAge} tuổi · đóng tại ${palNameVi} · Can ${stemVi})**: ${parts.join('; ')}`,
    );
  };
  if (curDxIdx >= 0) {
    formatDaXianSiHuaLines(curDxIdx, 'Đại hạn hiện tại');
  } else {
    lines.push('- **Đại hạn hiện tại**: Chưa vào Đại Hạn.');
  }
  if (nextDxIdx >= 0) {
    formatDaXianSiHuaLines(nextDxIdx, curDxIdx >= 0 ? 'Đại hạn kế tiếp' : 'Đại hạn đầu tiên');
  }

  lines.push('');
  lines.push('### B.6. Bảng Tứ Hóa Đại Hạn Kỳ Theo Cung (Trừ Kỳ Kế Tiếp)');
  let b6Count = 0;
  for (let i = 0; i < chart.daXians.length; i += 1) {
    if (i === nextDxIdx) continue;
    const dx = chart.daXians[i];
    const pal = chart.palaces.find((p) => p.branch === dx.palaceBranch);
    const palNameVi = pal ? translatePalaceName(pal.name) : translatePalaceName(dx.palaceName);
    const stemIdx = pal ? pal.stem : 0;
    const stemVi = VI_STEMS[stemIdx] ?? '';
    const transforms = getSiHuaByStem(stemIdx);
    const parts = (['禄', '权', '科', '忌'] as SiHua[]).map((sh) => {
      const starCn = transforms[sh];
      const targetPal = chart.palaces.find((x) => x.stars.some((s) => s.name === starCn));
      const targetVi = targetPal ? translatePalaceName(targetPal.name) : 'Không xác định';
      return `${translateStarName(starCn)} Hóa ${translateSiHua(sh)} → ${targetVi}`;
    });
    lines.push(
      `- [Tứ Hóa Đại Hạn Kỳ ${dx.startAge}–${dx.endAge} (đóng tại ${palNameVi} · Can ${stemVi})] ${parts.join('; ')}`,
    );
    b6Count += 1;
  }
  if (b6Count === 0) {
    lines.push('- Chưa có dữ liệu kỳ Đại Hạn bổ sung.');
  }

  lines.push('');
  lines.push('### B.7. Bảng Tự Hóa Can Cung');
  const selfSiHuaClauses: string[] = [];
  for (const p of orderedPalaces) {
    const ganZhiVi = `${VI_STEMS[p.stem]} ${VI_BRANCHES[p.branch]}`;
    const palNameVi = translatePalaceName(p.name);
    for (const sh of detectSelfSihua(p)) {
      selfSiHuaClauses.push(
        `- [Tự Hóa Can Cung ${ganZhiVi} · ${palNameVi}] ${translateStarName(sh.starName)} Tự Hóa ${translateSiHua(sh.siHua)}`,
      );
    }
  }
  if (selfSiHuaClauses.length === 0) {
    lines.push('Lá số này không có cung Tự Hóa (0 dòng Tự Hóa Can Cung).');
  } else {
    lines.push(...selfSiHuaClauses);
  }

  // ── Phụ lục C ────────────────────────────────────────────────────────────────
  lines.push('');
  lines.push('## Phụ lục C — Nguồn Tham Khảo');
  lines.push('');
  lines.push('### C.1. Danh Mục Tư Liệu Học Thuật Tham Chiếu');
  lines.push(
    'Các mã nguồn dưới đây được tổng hợp và khử trùng từ phần luận giải của hồ sơ (`CL-...` là cổ thư Public Domain; `NH-...` là bài giảng Thiên Kỷ của Nghê Hải Hạ), kèm số thứ tự chương đã viện dẫn.',
  );

  const dedupedRefs: ExtractedReferenceItem[] = [];
  const refById = new Map<string, ExtractedReferenceItem>();
  for (const r of refs) {
    const existing = refById.get(r.id);
    if (existing) {
      for (const ord of r.chapterOrders) {
        if (!existing.chapterOrders.includes(ord)) {
          existing.chapterOrders.push(ord);
        }
      }
    } else {
      const clone: ExtractedReferenceItem = {
        id: r.id,
        citationText: r.citationText,
        chapterOrders: [...r.chapterOrders],
      };
      refById.set(r.id, clone);
      dedupedRefs.push(clone);
    }
  }
  if (dedupedRefs.length === 0) {
    lines.push('- Chưa ghi nhận mã tư liệu tham chiếu trích xuất từ các chương hiện có.');
  } else {
    for (const r of dedupedRefs) {
      const chList = [...r.chapterOrders].sort((a, b) => a - b).join(', ');
      lines.push(`- \`[${r.id}]\` ${r.citationText} (Chương ${chList})`);
    }
  }

  lines.push('');
  lines.push('### C.2. Bảng Thuật Ngữ Đầy Đủ (15 Mục)');
  lines.push(
    'Bảng dưới đây giữ nguyên thứ tự 11 mục thuật ngữ cốt lõi ở phần thân bài (1–11) và bổ sung 4 thuật ngữ chuyên sâu ở cuối (12–15: Phi Tinh, Tự Hóa, cung phụ trợ, cát tinh / sát tinh):',
  );
  const fullGlossary: GlossaryEntrySpec[] = [
    ...buildCoreElevenGlossaryEntries(chart),
    {
      term: 'Phi Tinh',
      bodyText:
        'Kỹ thuật lấy Thiên Can của một cung phát động 4 hóa (Lộc, Quyền, Khoa, Kỵ) bay sang các cung có 4 sao đó tọa thủ để xem sự tương tác nhân quả liên cung.',
    },
    {
      term: 'Tự Hóa',
      bodyText:
        'Hiện tượng sao do chính Thiên Can của một cung hóa ra lại nằm ngay tại bản cung đó, biểu thị sự tự phát động, tự biến đổi hoặc hao tán tại chỗ.',
    },
    {
      term: 'cung phụ trợ (của Đại Hạn)',
      bodyText:
        'Các cung chức năng thứ yếu xoay quanh Lưu Mệnh hoặc Đại Hạn dùng để kiểm tra mối liên kết bổ trợ giữa tầng vận hạn với lá số Bản Mệnh gốc.',
    },
    {
      term: 'cát tinh / sát tinh',
      bodyText:
        'Hai nhóm trợ tinh đối lập lực tác động trong Tử Vi: cát tinh (sao tốt như Tả Phù, Hữu Bật, Văn Xương, Văn Khúc, Thiên Khôi, Thiên Việt) hỗ trợ thuận lợi; sát tinh (sao xấu như Kình Dương, Đà La, Hỏa Tinh, Linh Tinh, Địa Không, Địa Kiếp) tạo thử thách và xung đột.',
    },
  ];
  fullGlossary.forEach((item, idx) => {
    lines.push(`${idx + 1}. **${item.term}**: ${item.bodyText}`);
  });

  return lines.join('\n');
}

/**
 * B2: Bảng tọa độ CSS Grid 4×4 bất di bất dịch cho 12 Địa Chi (0=Tý .. 11=Hợi).
 * Bắt đầu từ Tỵ (row 1, col 1) đi thuận chiều kim đồng hồ quanh ô Thiên Bàn (2..3, 2..3).
 */
export const BRANCH_GRID_POS: Record<number, { row: number; col: number }> = {
  5: { row: 1, col: 1 }, // Tỵ (góc trên trái)
  6: { row: 1, col: 2 }, // Ngọ
  7: { row: 1, col: 3 }, // Mùi
  8: { row: 1, col: 4 }, // Thân (góc trên phải)
  9: { row: 2, col: 4 }, // Dậu
  10: { row: 3, col: 4 }, // Tuất
  11: { row: 4, col: 4 }, // Hợi (góc dưới phải)
  0: { row: 4, col: 3 }, // Tý
  1: { row: 4, col: 2 }, // Sửu
  2: { row: 4, col: 1 }, // Dần (góc dưới trái)
  3: { row: 3, col: 1 }, // Mão
  4: { row: 2, col: 1 }, // Thìn
};

function renderGridSiHuaBadgeHtml(sh: SiHua): string {
  const label = translateSiHua(sh);
  const cls = sh === '忌' ? 'sihua-tag sihua-ji' : 'sihua-tag sihua-auspicious';
  return `<span class="${cls}">[${escapeHtml(label)}]</span>`;
}

/**
 * B2: Render Sơ đồ lưới 12 cung 4×4 truyền thống xác định 100% từ chart.palaces.
 */
export function buildDeterministicChartGridHtml(chart: ZiweiChart): string {
  const info = buildDossierHeaderMetadata(chart);
  const sortedPalaces = [...chart.palaces].sort((a, b) => a.branch - b.branch);

  const cellsHtml = sortedPalaces
    .map((p) => {
      const pos = BRANCH_GRID_POS[p.branch] ?? { row: 1, col: 1 };
      const palaceNameVi = translatePalaceName(p.name);
      const ganZhiVi = `${VI_STEMS[p.stem]} ${VI_BRANCHES[p.branch]}`;
      const dxLabel = p.daXianAge ? `${p.daXianAge[0]}–${p.daXianAge[1]}` : '';

      const badges: string[] = [];
      if (p.isMingGong) badges.push('<span class="cell-badge cell-badge-ming">[MỆNH]</span>');
      if (p.isShenGong) badges.push('<span class="cell-badge cell-badge-shen">[THÂN]</span>');

      const majors = p.stars.filter((s) => s.type === 'major');
      const majorsHtml =
        majors.length > 0
          ? majors
              .map((s) => {
                const br = s.brightnessRaw ? ` [${translateBrightness(s.brightnessRaw)}]` : '';
                const sh = s.siHua ? ` ${renderGridSiHuaBadgeHtml(s.siHua)}` : '';
                return `<div class="cell-major-star"><strong>${escapeHtml(translateStarName(s.name))}</strong>${escapeHtml(br)}${sh}</div>`;
              })
              .join('')
          : `<div class="cell-empty-star">Vô chính diệu${
              p.borrowedStars?.length
                ? ` (mượn ${escapeHtml(p.borrowedStars.map((s) => translateStarName(s)).join(', '))})`
                : ''
            }</div>`;

      const auxStars = p.stars
        .filter((s) => s.type !== 'major')
        .slice(0, 7)
        .map((s) => {
          const sh = s.siHua ? ` ${renderGridSiHuaBadgeHtml(s.siHua)}` : '';
          return `<span class="cell-aux-item">${escapeHtml(translateStarName(s.name))}${sh}</span>`;
        })
        .join(', ');

      return `<div class="ziwei-grid-cell" data-branch="${p.branch}" data-branch-vi="${escapeHtml(
        VI_BRANCHES[p.branch],
      )}" style="grid-row: ${pos.row}; grid-column: ${pos.col};">
        <div class="cell-top">
          <span class="cell-palace-name">${escapeHtml(palaceNameVi)}</span>
          <span class="cell-badges">${badges.join(' ')}</span>
        </div>
        <div class="cell-stars">
          ${majorsHtml}
          ${auxStars ? `<div class="cell-aux">${auxStars}</div>` : ''}
        </div>
        <div class="cell-foot">
          <span class="cell-ganzhi">${escapeHtml(ganZhiVi)}</span>
          ${dxLabel ? `<span class="cell-daxian">ĐH ${escapeHtml(dxLabel)}</span>` : ''}
        </div>
      </div>`;
    })
    .join('\n');

  const centerHtml = `<div class="ziwei-grid-center" style="grid-row: 2 / span 2; grid-column: 2 / span 2;">
    <div class="center-title">TINH BÀN TỬ VI ĐẨU SỐ</div>
    <div class="center-name">${escapeHtml(info.name)}</div>
    <div class="center-meta">${escapeHtml(info.yinYang)} · ${escapeHtml(info.ju)}</div>
    <div class="center-meta">Dương lịch: ${escapeHtml(info.solar)}</div>
    <div class="center-meta">Âm lịch: ${escapeHtml(info.lunar)}</div>
    <div class="center-meta">${escapeHtml(info.birthTimeFullSummaryVi)}</div>
    <div class="center-meta">Nơi sinh: ${escapeHtml(info.locationVi)}</div>
    <div class="center-meta">Mệnh Chủ: <strong>${escapeHtml(info.mingZhuVi)}</strong> · Thân Chủ: <strong>${escapeHtml(info.shenZhuVi)}</strong></div>
  </div>`;

  return `<div class="ziwei-chart-grid" aria-label="Tinh bàn 12 cung Tử Vi">
    ${cellsHtml}
    ${centerHtml}
  </div>`;
}

/**
 * B1 + B6 + B2: Trang 1 Tích Hợp ("Mệnh Thư Tổng Lược & Tinh Bàn"),
 * dùng chung cho .HTML độc lập, bản in trực tiếp printSheetPortal và Modal UI.
 */
export function buildDossierPageOneHtml(
  chart: ZiweiChart,
  completedCount: number,
  exportedAt = new Date(),
): string {
  const info = buildDossierHeaderMetadata(chart);
  const quickHeader = buildDossierQuickHeaderLines(chart);
  const summaryLines = buildDeterministicExecutiveSummaryVi(chart);
  const gridHtml = buildDeterministicChartGridHtml(chart);

  const summaryHtml = summaryLines
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join('\n');

  return `<section class="dossier-page-one" aria-label="Trang 1 — Mệnh Thư Tổng Lược & Tinh Bàn">
    <header class="dossier-head">
      <div class="dossier-kicker">MỆNH THƯ TỔNG LƯỢC · TỬ VI THIÊN KỶ</div>
      <h1>Hồ Sơ Luận Giải Tử Vi Thiên Kỷ — ${escapeHtml(info.name)}</h1>
      <div class="meta-grid">
        <div><strong>Đương số:</strong> ${escapeHtml(info.name)} (${escapeHtml(info.yinYang)}) · <strong>Cục số:</strong> ${escapeHtml(info.ju)} · <strong>An Mệnh tại ${escapeHtml(info.mingBranch)}:</strong> ${escapeHtml(info.mingMajors)}</div>
        <div><strong>Dương lịch:</strong> ${escapeHtml(info.solar)} · <strong>Âm lịch:</strong> ${escapeHtml(info.lunar)}</div>
        <div><strong>Giờ sinh &amp; Chân Thái Dương Thời:</strong> ${escapeHtml(info.birthTimeFullSummaryVi)}</div>
        <div><strong>Nơi sinh &amp; Kinh độ:</strong> ${escapeHtml(info.locationVi)} · <strong>Mệnh Chủ:</strong> ${escapeHtml(info.mingZhuVi)} · <strong>Thân Chủ:</strong> ${escapeHtml(info.shenZhuVi)}</div>
        <div>${escapeHtml(quickHeader.mingLine)} ${escapeHtml(quickHeader.shenLine)} ${escapeHtml(quickHeader.daXianLine)}</div>
        <div><strong>Tiến độ hoàn thiện:</strong> ${completedCount}/8 chương · <strong>Thời điểm xuất:</strong> ${escapeHtml(exportedAt.toLocaleString('vi-VN'))}</div>
      </div>
    </header>

    <div class="executive-summary-box">
      <h2>Kết Luận Nhanh — Cốt Tủy Lá Số (5 Câu)</h2>
      <ol class="executive-summary-list">
        ${summaryHtml}
      </ol>
    </div>

    <div class="chart-grid-wrap">
      <div class="chart-grid-caption">Tinh Bàn 12 Cung Truyền Thống (Tỵ → Thìn theo chiều kim đồng hồ)</div>
      ${gridHtml}
    </div>
  </section>`;
}

/**
 * B3: Bảng Ma Trận Năm 5 Cột Cân Đối (12% | 18% | 16% | 34% | 20%) cho Chương 7 (5 năm) & Chương 8 (10 năm).
 * CHỈ render trong .HTML, bản in trực tiếp và Modal UI (tuyệt đối KHÔNG đưa vào .MD).
 */
export function buildMultiYearMatrixTableHtml(
  chart: ZiweiChart,
  span: 5 | 10,
): string {
  const endYear = span === 5 ? 2030 : 2035;
  const horizon = buildMultiYearHorizonContext(chart, 2026, endYear);

  const rowsHtml = horizon.rows
    .map((r) => {
      const dxText = r.governingDaXian.isPreDaXian
        ? 'Chưa vào Đại Hạn'
        : `${r.governingDaXian.palaceNameVi} (${r.governingDaXian.ageRangeVi})`;
      const axisText = [
        `<div><strong>Lưu Mệnh:</strong> ${escapeHtml(r.activatedPalace.branchVi)} (trùng ${escapeHtml(
          r.activatedPalace.natalPalaceNameVi,
        )})</div>`,
        `<div class="matrix-sub">Lưu Tài: ${escapeHtml(r.activatedPalace.caiBoSummaryVi.split(':')[0] ?? '')}</div>`,
        `<div class="matrix-sub">Lưu Quan: ${escapeHtml(r.activatedPalace.guanLuSummaryVi.split(':')[0] ?? '')}</div>`,
        `<div class="matrix-sub">Lưu Phối: ${escapeHtml(r.activatedPalace.fuQiSummaryVi.split(':')[0] ?? '')}</div>`,
      ].join('');

      const sihuaHtml = r.liuNianSiHua.allFour
        .map((s) => {
          const shortLbl = translateSiHua(s.mutagenKey);
          const tagCls = s.mutagenKey === '忌' ? 'sihua-tag sihua-ji' : 'sihua-tag sihua-auspicious';
          return `<div class="matrix-sihua-line"><span class="${tagCls}">[${escapeHtml(
            shortLbl,
          )}]</span> <strong>${escapeHtml(s.starNameVi)}</strong> tại <strong>Cung ${escapeHtml(
            s.periodPalaceRoleVi,
          )}</strong> <em>(trùng ${escapeHtml(s.natalPalaceNameVi)})</em></div>`;
        })
        .join('');

      const dynTop = r.dynamicStars
        .filter((d) =>
          ['Lộc Tồn', 'Thiên Mã', 'Kình Dương', 'Đà La'].some((tag) => d.starLabelVi.endsWith(tag)),
        )
        .map((d) => `${d.starLabelVi} (${d.natalPalaceNameVi})`)
        .join(', ');
      const flagsHtml =
        r.highlightFlags.length > 0
          ? `<div class="matrix-flags">${r.highlightFlags.map((f) => `• ${escapeHtml(f)}`).join('<br />')}</div>`
          : '';

      return `<tr>
        <td><strong>${r.year}</strong><br /><span>${escapeHtml(r.lunarGanZhiVi)}</span><br /><span class="matrix-sub">${r.nominalAge} tuổi</span></td>
        <td><strong>${escapeHtml(dxText)}</strong><div class="matrix-sub">${escapeHtml(r.daXianLiuNianRelationVi)}</div></td>
        <td>${axisText}</td>
        <td>${sihuaHtml}</td>
        <td><div>${escapeHtml(dynTop)}</div>${flagsHtml}</td>
      </tr>`;
    })
    .join('\n');

  return `<div class="matrix-section-wrap">
    <div class="matrix-caption">Bảng Ma Trận Năm Tầm Nhìn ${horizon.startYear}–${horizon.endYear} (${span} Năm · Xác Định Từ Engine)</div>
    <table class="matrix-table">
      <colgroup>
        <col style="width: 12%;" />
        <col style="width: 18%;" />
        <col style="width: 16%;" />
        <col style="width: 34%;" />
        <col style="width: 20%;" />
      </colgroup>
      <thead>
        <tr>
          <th>Năm &amp; Tuổi</th>
          <th>Đại Hạn &amp; Quan Hệ</th>
          <th>Trục Lưu Niên</th>
          <th>4 Sao Lưu Tứ Hóa (Đủ Lộc · Quyền · Khoa · Kỵ)</th>
          <th>Sao Lưu &amp; Cờ Xung Hợp</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </div>`;
}

/**
 * B4 & B5: Hệ CSS chế bản Giấy Cổ + an toàn in đen trắng (@media print),
 * phạm vi hóa dưới `.ziwei-editorial-root` để không rò CSS ra ngoài giao diện chính của app.
 */
export const DOSSIER_EDITORIAL_PRINT_CSS = `
  .ziwei-editorial-root {
    --paper-bg: #FBF8F1;
    --paper-surface: #F4EBD9;
    --ink-main: #231B15;
    --ink-sub: #3F4554;
    --gold-ink: #854D0E;
    --vermilion-ink: #991B1B;
    --border-soft: rgba(120, 53, 15, 0.30);
    --border-print: #44403C;
    color: var(--ink-main);
    font-family: 'Noto Serif', 'Merriweather', Georgia, 'Times New Roman', serif;
    line-height: 1.7;
    counter-reset: dossier-chapter;
  }
  .ziwei-editorial-root .dossier-page-one {
    page-break-after: always;
    break-after: page;
    padding-bottom: 12px;
  }
  .ziwei-editorial-root .dossier-head {
    border-bottom: 2px solid #78350F;
    padding-bottom: 14px;
    margin-bottom: 16px;
  }
  .ziwei-editorial-root .dossier-kicker {
    font-size: 11px;
    letter-spacing: 0.14em;
    font-weight: 700;
    color: #854D0E;
    margin-bottom: 4px;
  }
  .ziwei-editorial-root .dossier-head h1 {
    margin: 0 0 8px;
    font-size: 22px;
    color: #5C3804;
    letter-spacing: 0.01em;
  }
  .ziwei-editorial-root .meta-grid {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 12.5px;
    color: var(--ink-sub);
    display: grid;
    gap: 3px;
  }
  .ziwei-editorial-root .executive-summary-box {
    background: var(--paper-surface);
    border: 1px solid #78350F;
    border-radius: 6px;
    padding: 12px 16px;
    margin-bottom: 16px;
  }
  .ziwei-editorial-root .executive-summary-box h2 {
    margin: 0 0 6px;
    font-size: 14px;
    color: #7C2D12;
  }
  .ziwei-editorial-root .executive-summary-list {
    margin: 0;
    padding-left: 18px;
    font-size: 12px;
    line-height: 1.5;
  }
  .ziwei-editorial-root .executive-summary-list li {
    margin: 3px 0;
  }
  .ziwei-editorial-root .chart-grid-caption,
  .ziwei-editorial-root .matrix-caption {
    font-size: 12.5px;
    font-weight: 700;
    color: #78350F;
    margin-bottom: 6px;
  }
  .ziwei-editorial-root .ziwei-chart-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    grid-template-rows: repeat(4, minmax(92px, auto));
    border: 1.5px solid #78350F;
    background: #FFFDF8;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .ziwei-editorial-root .ziwei-grid-cell {
    border: 1px solid #78350F;
    padding: 5px 6px;
    font-size: 10.5px;
    line-height: 1.32;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 4px;
    min-width: 0;
  }
  .ziwei-editorial-root .cell-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 4px;
    border-bottom: 1px dotted rgba(120, 53, 15, 0.35);
    padding-bottom: 2px;
  }
  .ziwei-editorial-root .cell-palace-name {
    font-weight: 700;
    color: #5C3804;
    font-size: 11px;
  }
  .ziwei-editorial-root .cell-badge {
    display: inline-block;
    font-size: 9px;
    font-weight: 700;
    border: 1px solid #44403C;
    padding: 0 3px;
  }
  .ziwei-editorial-root .cell-major-star {
    font-size: 10.5px;
    color: #1C1917;
  }
  .ziwei-editorial-root .cell-empty-star {
    font-size: 10px;
    font-style: italic;
    color: #57534E;
  }
  .ziwei-editorial-root .cell-aux {
    font-size: 9.5px;
    color: #44403C;
    margin-top: 2px;
  }
  .ziwei-editorial-root .cell-foot {
    display: flex;
    justify-content: space-between;
    font-size: 9.5px;
    font-weight: 600;
    color: #57534E;
    border-top: 1px dotted rgba(120, 53, 15, 0.25);
    padding-top: 2px;
  }
  .ziwei-editorial-root .ziwei-grid-center {
    border: 1px solid #78350F;
    padding: 10px 12px;
    background: #FBF7EF;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    gap: 3px;
    font-size: 11px;
  }
  .ziwei-editorial-root .center-title {
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.08em;
    color: #7C2D12;
  }
  .ziwei-editorial-root .center-name {
    font-weight: 700;
    font-size: 15px;
    color: #231B15;
  }
  .ziwei-editorial-root .center-meta {
    font-size: 10.5px;
    color: #3F4554;
  }
  .ziwei-editorial-root .sihua-tag {
    display: inline-block;
    font-size: 9.5px;
    font-weight: 700;
    padding: 0 3px;
    line-height: 1.25;
  }
  .ziwei-editorial-root .sihua-auspicious {
    border: 1px solid #44403C;
    color: #854D0E;
  }
  .ziwei-editorial-root .sihua-ji {
    border: 1px dashed #44403C;
    color: #991B1B;
  }
  .ziwei-editorial-root .matrix-section-wrap {
    margin: 12px 0 18px;
  }
  .ziwei-editorial-root .matrix-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    font-size: 11px;
    line-height: 1.38;
    background: #FFFDF8;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .ziwei-editorial-root .matrix-table th,
  .ziwei-editorial-root .matrix-table td {
    border: 1px solid #44403C;
    padding: 5px 6px;
    vertical-align: top;
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }
  .ziwei-editorial-root .matrix-table th {
    background: var(--paper-surface);
    color: #5C3804;
    font-weight: 700;
    text-align: left;
  }
  .ziwei-editorial-root .matrix-table thead {
    display: table-header-group;
  }
  .ziwei-editorial-root .matrix-table tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .ziwei-editorial-root .matrix-sub {
    font-size: 10px;
    color: #57534E;
  }
  .ziwei-editorial-root .matrix-sihua-line {
    margin: 2px 0;
  }
  .ziwei-editorial-root .matrix-flags {
    margin-top: 3px;
    font-size: 10px;
    color: #991B1B;
    font-weight: 600;
  }
  .ziwei-editorial-root .toc {
    background: var(--paper-surface);
    border: 1px solid var(--border-soft);
    padding: 16px 20px;
    border-radius: 6px;
    margin-bottom: 24px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
  }
  .ziwei-editorial-root .toc h2 {
    margin: 0 0 10px;
    font-size: 15px;
    color: #5C3804;
  }
  .ziwei-editorial-root .toc ul { margin: 0; padding-left: 18px; }
  .ziwei-editorial-root .toc li { margin: 4px 0; }
  .ziwei-editorial-root .toc a { color: var(--ink-main); text-decoration: none; font-weight: 600; }
  .ziwei-editorial-root .toc a:hover { text-decoration: underline; color: var(--gold-ink); }
  .ziwei-editorial-root .toc-status { font-size: 12px; margin-left: 6px; }
  .ziwei-editorial-root .toc-status.done { color: #166534; }
  .ziwei-editorial-root .toc-status.pending { color: #9A3412; font-weight: 600; }
  .ziwei-editorial-root section.chapter {
    padding-top: 18px;
    margin-top: 20px;
    border-top: 1px solid var(--border-soft);
    counter-increment: dossier-chapter;
  }
  .ziwei-editorial-root section.chapter h2 {
    margin: 0 0 8px;
    font-size: 19px;
    color: #5C3804;
    break-after: avoid;
    page-break-after: avoid;
  }
  .ziwei-editorial-root section.chapter h3,
  .ziwei-editorial-root section.chapter h4 {
    color: #854D0E;
    margin: 16px 0 6px;
    font-size: 15px;
    break-after: avoid;
    page-break-after: avoid;
  }
  .ziwei-editorial-root .chapter-meta {
    font-family: "Courier New", monospace;
    font-size: 12px;
    color: #57534E;
    margin-bottom: 12px;
  }
  .ziwei-editorial-root .incomplete-banner {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: #9A3412;
    background: #FEF3C7;
    border: 1px solid #F59E0B;
    padding: 10px 14px;
    border-radius: 6px;
    margin-bottom: 12px;
  }
  .ziwei-editorial-root .chapter-body p { margin: 8px 0; }
  .ziwei-editorial-root .chapter-body > p:first-of-type::first-letter {
    font-size: 2.5em;
    font-weight: 700;
    float: left;
    line-height: 1;
    padding-right: 8px;
    color: #7C2D12;
  }
  .ziwei-editorial-root .chapter-body ul,
  .ziwei-editorial-root .chapter-body ol { margin: 8px 0 12px; padding-left: 22px; }
  .ziwei-editorial-root .chapter-body li { margin: 4px 0; }
  .ziwei-editorial-root .chapter-body blockquote {
    border-left: 3px solid #78350F;
    background: var(--paper-surface);
    padding: 8px 12px;
    margin: 10px 0;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .ziwei-editorial-root .appendix-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11.5px;
    line-height: 1.4;
    background: #FFFDF8;
    margin: 10px 0 16px;
  }
  .ziwei-editorial-root .appendix-table th,
  .ziwei-editorial-root .appendix-table td {
    border: 1px solid #78350F;
    padding: 5px 8px;
    vertical-align: top;
    text-align: left;
  }
  .ziwei-editorial-root .appendix-table th {
    background: var(--paper-surface);
    color: #5C3804;
    font-weight: 700;
  }
  .ziwei-editorial-root .glossary-section,
  .ziwei-editorial-root .appendices-section {
    margin: 20px 0;
    padding-top: 14px;
    border-top: 1px solid var(--border-soft);
  }
  .ziwei-editorial-root .toc-reading-guide {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px dashed var(--border-soft);
    font-size: 12px;
    color: var(--ink-sub);
  }
  .ziwei-editorial-root .toc-reading-guide p { margin: 3px 0; }
  .ziwei-editorial-root footer.dossier-foot {
    margin-top: 32px;
    padding-top: 12px;
    border-top: 1px solid var(--border-soft);
    font-size: 12px;
    color: #57534E;
    text-align: center;
  }
  @page {
    size: A4 portrait;
    margin: 15mm 14mm;
    @bottom-right {
      content: "Trang " counter(page) " / " counter(pages);
      font-size: 9pt;
      color: #44403C;
    }
  }
  @media print {
    body {
      background: #FFFFFF !important;
      color: #000000 !important;
      padding: 0 !important;
    }
    .sheet,
    .ziwei-editorial-root,
    .ziwei-editorial-root .executive-summary-box,
    .ziwei-editorial-root .ziwei-chart-grid,
    .ziwei-editorial-root .ziwei-grid-center,
    .ziwei-editorial-root .matrix-table,
    .ziwei-editorial-root .matrix-table th,
    .ziwei-editorial-root .toc,
    .ziwei-editorial-root .chapter-body blockquote {
      background: #FFFFFF !important;
      color: #000000 !important;
    }
    .sheet {
      max-width: 100% !important;
      border: none !important;
      padding: 0 !important;
    }
    .ziwei-editorial-root .dossier-page-one {
      page-break-after: always !important;
      break-after: page !important;
    }
    .ziwei-editorial-root section.chapter {
      page-break-before: always !important;
      break-before: page !important;
      border-top: none !important;
      padding-top: 0 !important;
      margin-top: 0 !important;
      break-inside: auto;
    }
    .ziwei-editorial-root h2,
    .ziwei-editorial-root h3,
    .ziwei-editorial-root h4 {
      color: #000000 !important;
      break-after: avoid !important;
      page-break-after: avoid !important;
    }
    .ziwei-editorial-root .ziwei-chart-grid,
    .ziwei-editorial-root .ziwei-grid-cell,
    .ziwei-editorial-root .ziwei-grid-center,
    .ziwei-editorial-root .matrix-table,
    .ziwei-editorial-root .matrix-table th,
    .ziwei-editorial-root .matrix-table td,
    .ziwei-editorial-root .executive-summary-box,
    .ziwei-editorial-root .sihua-auspicious {
      border-color: #44403C !important;
      color: #000000 !important;
    }
    .ziwei-editorial-root .sihua-ji {
      border: 1px dashed #44403C !important;
      color: #000000 !important;
      font-weight: 700 !important;
    }
    .ziwei-editorial-root .matrix-table {
      font-size: 9pt !important;
      line-height: 1.32 !important;
    }
    .ziwei-editorial-root .matrix-flags,
    .ziwei-editorial-root .cell-palace-name,
    .ziwei-editorial-root .center-title {
      color: #000000 !important;
    }
  }
`;

export interface CriticalExportChapterInfo {
  chapterId: DossierChapterId;
  order: number;
  shortLabelVi: string;
  titleVi: string;
  criticalFlags: Kp3AuditFlag[];
}

export interface DossierExportOptions {
  includeManualFlagWarningsForChapters?:
    | ReadonlySet<DossierChapterId>
    | readonly DossierChapterId[];
}

export function collectCriticalChaptersForExport(
  states: Record<DossierChapterId, DossierChapterState>,
): CriticalExportChapterInfo[] {
  const result: CriticalExportChapterInfo[] = [];
  for (const spec of DOSSIER_CHAPTER_SPECS) {
    const st = states[spec.id];
    const criticalFlags = (st?.auditFlags ?? []).filter(
      (flag) => flag.severity === 'critical',
    );
    if (criticalFlags.length > 0) {
      result.push({
        chapterId: spec.id,
        order: spec.order,
        shortLabelVi: spec.shortLabelVi,
        titleVi: spec.titleVi,
        criticalFlags,
      });
    }
  }
  return result;
}

export function formatChapterCriticalFlagsWarningMarkdown(
  criticalFlags: readonly Kp3AuditFlag[],
): string {
  if (!criticalFlags || criticalFlags.length === 0) return '';
  const lines = [
    '> ⚠️ **[Cảnh Báo Xuất Thủ Công — Chương Còn Cờ Lỗi Nghiêm Trọng Chưa Xử Lý]**',
    '> Người dùng đã xác nhận xuất thủ công chương này dù vẫn còn các cờ đối chiếu mức nghiêm trọng:',
  ];
  for (const flag of criticalFlags) {
    const locParts = [
      flag.code,
      flag.palaceVi ? `Cung ${flag.palaceVi}` : '',
      flag.ageRange ? `Đại Hạn ${flag.ageRange}` : '',
    ].filter(Boolean);
    lines.push(`> - \`[${locParts.join(' · ')}]\` ${flag.messageVi}`);
  }
  return lines.join('\n');
}

interface PreparedChapterExportItem {
  spec: DossierChapterSpec;
  isDone: boolean;
  bodyMarkdown: string;
  readingMinutes: number;
  refs: ExtractedReferenceItem[];
}

function prepareAllChaptersForExport(
  chart: ZiweiChart,
  states: Record<DossierChapterId, DossierChapterState>,
  options?: DossierExportOptions,
): { items: PreparedChapterExportItem[]; allRefs: ExtractedReferenceItem[] } {
  const items: PreparedChapterExportItem[] = [];
  const allRefs: ExtractedReferenceItem[] = [];
  const manualWarningSet = options?.includeManualFlagWarningsForChapters
    ? new Set<DossierChapterId>(options.includeManualFlagWarningsForChapters)
    : null;

  for (const spec of DOSSIER_CHAPTER_SPECS) {
    const st = states[spec.id];
    const cleanDone = cleanChapterTextForExport(st?.text, spec.id, spec.order, chart, false);
    const cleanInc = cleanChapterTextForExport(
      st?.incompleteText,
      spec.id,
      spec.order,
      chart,
      true,
    );
    const isDone = st?.status === 'completed' && Boolean(cleanDone.cleanedText);
    const refs = isDone ? cleanDone.refs : cleanInc.refs;
    allRefs.push(...refs);

    let bodyMarkdown = '';
    if (isDone) {
      bodyMarkdown = cleanDone.cleanedText;
    } else if (cleanInc.cleanedText) {
      bodyMarkdown = [
        '> **[CHƯA HOÀN TẤT — Chưa có luận giải AI hoàn chỉnh cho chương này]**',
        '',
        '*Phần văn bản đã nhận trước khi gián đoạn:*',
        '',
        cleanInc.cleanedText,
      ].join('\n');
    } else {
      const { factSheetMarkdown } = resolveChapterDeterministicFactSheet(chart, spec);
      bodyMarkdown = [
        '> **[CHƯA HOÀN TẤT — Chưa có luận giải AI hoàn chỉnh cho chương này]**',
        ...(factSheetMarkdown
          ? ['', '*Bảng dữ kiện xác định của chương:*', '', factSheetMarkdown]
          : []),
      ].join('\n');
    }

    if (manualWarningSet?.has(spec.id)) {
      const criticalFlags = (st?.auditFlags ?? []).filter(
        (flag) => flag.severity === 'critical',
      );
      if (criticalFlags.length > 0) {
        const warningBlock = formatChapterCriticalFlagsWarningMarkdown(criticalFlags);
        if (warningBlock) {
          bodyMarkdown = bodyMarkdown
            ? `${bodyMarkdown.trimEnd()}\n\n${warningBlock}`
            : warningBlock;
        }
      }
    }

    // X5 (ĐK-158-P10): Đếm trên toàn bộ span chương (tính cả tiêu đề & `---` cuối span, trừ dòng `Đọc trong N phút`)
    const spanForCount = `## ${spec.titleVi}\n\n${bodyMarkdown}\n\n---`;
    const readingMinutes = computeReadingMinutes(countWordsUtf8(spanForCount));

    items.push({
      spec,
      isDone,
      bodyMarkdown,
      readingMinutes,
      refs,
    });
  }

  return { items, allRefs };
}

/**
 * F1 + S5 + B6 + Nhánh B (1.5.8 X1–X8): Xuất bản .MD chuẩn người đọc
 * (Header + 3 dòng tóm tắt + Kết Luận Nhanh 5 Câu + Bảng Thuật Ngữ 11 mục + Mục Lục có phút đọc & hướng dẫn + 8 Chương sạch thẻ/cảnh báo/tham chiếu/bổ sung/disclaimer + Phụ lục A/B/C + 1 câu lưu ý cuối file).
 */
export function buildDossierMarkdownExport(
  chart: ZiweiChart,
  states: Record<DossierChapterId, DossierChapterState>,
  exportedAt = new Date(),
  options?: DossierExportOptions,
): string {
  const info = buildDossierHeaderMetadata(chart);
  const quickHeader = buildDossierQuickHeaderLines(chart);
  const summaryLines = buildDeterministicExecutiveSummaryVi(chart);
  const { items, allRefs } = prepareAllChaptersForExport(chart, states, options);
  const completedCount = items.filter((item) => item.isDone).length;
  const focusYear = DOSSIER_CHAPTER_SPECS.find((s) => s.id === 'year_2026')?.year ?? 2026;
  const nextYear = focusYear + 1;

  const lines: string[] = [];
  lines.push(`# HỒ SƠ LUẬN GIẢI TỬ VI THIÊN KỶ — ${info.name.toUpperCase()}`);
  lines.push(`- **Đương số**: ${info.name} (${info.yinYang}) · **Cục số**: ${info.ju}`);
  lines.push(
    `- **Dương lịch**: ${info.solar} · **Âm lịch**: ${info.lunar} · **An Mệnh tại ${info.mingBranch}**: ${info.mingMajors}`,
  );
  lines.push(`- **Giờ sinh & Chân Thái Dương Thời**: ${info.birthTimeFullSummaryVi}`);
  lines.push(
    `- **Nơi sinh / Kinh độ**: ${info.locationVi} · **Mệnh Chủ**: ${info.mingZhuVi} · **Thân Chủ**: ${info.shenZhuVi}`,
  );
  lines.push(`- ${quickHeader.mingLine}`);
  lines.push(`- ${quickHeader.shenLine}`);
  lines.push(`- ${quickHeader.daXianLine}`);
  lines.push(
    `- **Tiến độ hoàn thiện**: ${completedCount}/8 chương · **Xuất lúc**: ${exportedAt.toLocaleString('vi-VN')}`,
  );

  lines.push('\n## Kết Luận Nhanh — Cốt Tủy Lá Số (5 Câu)');
  for (const sLine of summaryLines) {
    lines.push(`- ${sLine}`);
  }

  lines.push('\n' + buildBodyGlossaryMarkdown(chart));

  lines.push('\n## Mục Lục');
  for (const item of items) {
    const statusLabel = item.isDone ? 'Hoàn tất' : 'Chưa hoàn tất';
    lines.push(
      `- **${item.spec.titleVi}** — *${statusLabel}* · Đọc trong khoảng ${item.readingMinutes} phút`,
    );
  }
  lines.push('');
  for (const guideLine of formatChapterReadingGuideLines(focusYear, nextYear)) {
    lines.push(`- ${guideLine}`);
  }

  for (const item of items) {
    lines.push(`\n---\n\n## ${item.spec.titleVi}`);
    lines.push(`Đọc trong ${item.readingMinutes} phút`);
    lines.push('');
    lines.push(item.bodyMarkdown);
  }

  lines.push('\n---\n\n' + buildDossierAppendicesMarkdown(chart, allRefs));

  lines.push(
    '\n---\n*Lưu ý: Hồ sơ phục vụ tham khảo nghiên cứu mệnh lý Tử Vi Đẩu Số theo hệ thống Thiên Kỷ.*',
  );
  return lines.join('\n');
}

export function buildDossierPlainTextExport(
  chart: ZiweiChart,
  states: Record<DossierChapterId, DossierChapterState>,
  exportedAt = new Date(),
): string {
  return buildDossierMarkdownExport(chart, states, exportedAt)
    .replace(/^#{1,4}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1');
}

/**
 * F1 + QĐ-G5 + X9: Xuất file .html độc lập chuẩn in, khớp đủ nội dung X1–X8 như bản .md
 * đồng thời giữ Trang 1 (B1+B6+B2), bảng ma trận B3 trước Ch.7/Ch.8 và CSS Giấy Cổ + @media print.
 */
export function buildDossierStandaloneHtmlExport(
  chart: ZiweiChart,
  states: Record<DossierChapterId, DossierChapterState>,
  exportedAt = new Date(),
  options?: DossierExportOptions,
): string {
  const info = buildDossierHeaderMetadata(chart);
  const { items, allRefs } = prepareAllChaptersForExport(chart, states, options);
  const completedCount = items.filter((item) => item.isDone).length;
  const focusYear = DOSSIER_CHAPTER_SPECS.find((s) => s.id === 'year_2026')?.year ?? 2026;
  const nextYear = focusYear + 1;

  const pageOneHtml = buildDossierPageOneHtml(chart, completedCount, exportedAt);
  const glossaryHtml = `<section class="glossary-section">${simpleMarkdownToHtml(buildBodyGlossaryMarkdown(chart))}</section>`;

  const tocHtml = items
    .map((item) => {
      return `<li><a href="#sec-${item.spec.id}">${escapeHtml(item.spec.titleVi)}</a> <span class="toc-status ${item.isDone ? 'done' : 'pending'}">${item.isDone ? 'Hoàn tất' : 'Chưa hoàn tất'}</span> · Đọc trong khoảng ${item.readingMinutes} phút</li>`;
    })
    .join('\n');

  const guideHtml = `<div class="toc-reading-guide">${formatChapterReadingGuideLines(focusYear, nextYear)
    .map((l) => `<p>${escapeHtml(l)}</p>`)
    .join('')}</div>`;

  const chaptersHtml = items
    .map((item) => {
      const matrixPrefixHtml =
        item.spec.sectionId === 'horizon_5y'
          ? buildMultiYearMatrixTableHtml(chart, 5)
          : item.spec.sectionId === 'horizon_10y'
            ? buildMultiYearMatrixTableHtml(chart, 10)
            : '';

      if (item.isDone) {
        return `<section id="sec-${item.spec.id}" class="chapter">
        <h2>${escapeHtml(item.spec.titleVi)}</h2>
        <div class="chapter-meta">Đọc trong ${item.readingMinutes} phút</div>
        ${matrixPrefixHtml}
        <div class="chapter-body">${simpleMarkdownToHtml(item.bodyMarkdown)}</div>
      </section>`;
      }

      return `<section id="sec-${item.spec.id}" class="chapter chapter-incomplete">
      <h2>${escapeHtml(item.spec.titleVi)}</h2>
      <div class="chapter-meta">Đọc trong ${item.readingMinutes} phút</div>
      <div class="incomplete-banner">CHƯA HOÀN TẤT — Chương này chưa có bài luận giải AI đầy đủ.</div>
      ${matrixPrefixHtml}
      <div class="chapter-body">${simpleMarkdownToHtml(item.bodyMarkdown)}</div>
    </section>`;
    })
    .join('\n');

  const appendicesHtml = `<section class="appendices-section">${simpleMarkdownToHtml(buildDossierAppendicesMarkdown(chart, allRefs))}</section>`;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Hồ Sơ Luận Giải Tử Vi Thiên Kỷ — ${escapeHtml(info.name)}</title>
  <style>
    :root {
      color-scheme: light;
      --paper-bg: #FBF8F1;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px 16px 48px;
      background: #FBF8F1;
      color: #231B15;
    }
    .sheet {
      max-width: 860px;
      margin: 0 auto;
      background: #FFFDF8;
      border: 1px solid rgba(120, 53, 15, 0.25);
      padding: 32px 36px;
      border-radius: 8px;
    }
    ${DOSSIER_EDITORIAL_PRINT_CSS}
  </style>
</head>
<body>
  <article class="sheet ziwei-editorial-root">
    ${pageOneHtml}
    ${glossaryHtml}
    <nav class="toc">
      <h2>Mục Lục Hồ Sơ</h2>
      <ul>${tocHtml}</ul>
      ${guideHtml}
    </nav>
    ${chaptersHtml}
    ${appendicesHtml}
    <footer class="dossier-foot">
      Lưu ý: Hồ sơ phục vụ tham khảo nghiên cứu mệnh lý Tử Vi Đẩu Số theo hệ thống Thiên Kỷ.
    </footer>
  </article>
</body>
</html>`;
}
