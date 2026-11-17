import type { SiHua, ZiweiChart } from './ziwei/types';
import {
  buildDossierSectionFactSheetVi,
  buildMultiYearHorizonContext,
  type DossierSectionId,
} from './ziwei/dossier-context';
import {
  buildChartIdentityKey as buildCanonicalChartIdentityKey,
  buildYunxianPeriodContext,
  getDaXianYears,
  resolveEffectiveDaXianIndex,
  type YunxianPeriodContext,
} from './ziwei/yunxian-context';
import { getSiHuaByStem } from './ziwei/sihua';
import {
  calculateTrueSolarTime,
  formatTrueSolarClock,
} from './ziwei/true-solar-time';
import {
  enforceCanonicalPalaceGroupHeadings,
  sanitizeAiVietnameseOutput,
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
}

export interface AiPeriodEntry {
  text?: string;
  incompleteText?: string;
  incomplete?: boolean;
  interruptedReason?: string;
  meta?: AiExecutionMeta;
  error?: string;
  errorCode?: string;
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

export function sanitizeDossierChapterText(
  text: string | undefined,
  chapterId: DossierChapterId,
  chart?: ZiweiChart,
  options?: { skipPeriodSiHuaCheck?: boolean },
): string | undefined {
  if (typeof text !== 'string') return text;
  let cleaned = sanitizeAiVietnameseOutput(text);
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

/**
 * QĐ-G2/T2: Tự động làm sạch cache cũ khi đọc hồ sơ từ sessionStorage (0 tốn quota, giữ nguyên khóa cache).
 */
export function readDossierCacheEntry(
  storage: StorageLike | null,
  dossierStorageKey: string,
  chart?: ZiweiChart,
): StoredDossierRecord | null {
  const stored = readLruSessionEntry<StoredDossierRecord>(
    storage,
    DOSSIER_LRU_INDEX_KEY,
    dossierStorageKey,
  );
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
 * QĐ-H1 (F-04): Lưu 1 chương hoàn tất (kể cả Lưu Niên 2026/2027) vào sessionStorage LRU hồ sơ.
 */
export function saveDossierSectionToCache(
  storage: StorageLike | null,
  chart: ZiweiChart,
  chapterId: DossierChapterId,
  chapterState: DossierChapterState,
): boolean {
  if (!storage || chapterState.status !== 'completed' || !chapterState.text?.trim()) {
    return false;
  }
  const chartIdentityKey = buildChartIdentityKey(chart);
  const dossierStorageKey = buildDossierStorageKey(chartIdentityKey);
  const existing = readLruSessionEntry<StoredDossierRecord>(
    storage,
    DOSSIER_LRU_INDEX_KEY,
    dossierStorageKey,
  );
  const sanitizedText =
    sanitizeDossierChapterText(chapterState.text, chapterId, chart) ?? chapterState.text;
  const nextSections: StoredDossierRecord['sections'] = {
    ...(existing?.sections ?? {}),
    [chapterId]: {
      ...chapterState,
      chapterId,
      text: sanitizedText,
      sourceBadge: chapterState.sourceBadge,
    },
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
  meta?: AiExecutionMeta;
  sourceBadge?: DossierSourceBadge;
  updatedAt?: number;
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

  if (spec.mode === 'period' && typeof spec.year === 'number') {
    const pKey = buildPeriodCacheKeyForYear(chart, spec.year);
    const periodEntry = aiPeriodCache[pKey];
    const localExisting = localChapters[spec.id];

    if (localExisting?.status === 'loading') {
      return localExisting;
    }
    if (periodEntry && hasValidCachedPeriodEntry(periodEntry)) {
      return {
        chapterId: spec.id,
        sectionCacheKey,
        status: 'completed',
        text: sanitizeDossierChapterText(periodEntry.text, spec.id, chart),
        meta: periodEntry.meta,
        sourceBadge:
          localExisting?.sourceBadge ?? formatDossierSourceBadge('cache'),
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
        meta: periodEntry.meta,
        sourceBadge: localExisting?.sourceBadge,
      };
    }
    if (periodEntry?.error) {
      return {
        chapterId: spec.id,
        sectionCacheKey,
        status: 'error',
        error: periodEntry.error,
        errorCode: periodEntry.errorCode,
        meta: periodEntry.meta,
      };
    }
  }

  const stored = localChapters[spec.id];
  if (stored) {
    return {
      ...stored,
      text: sanitizeDossierChapterText(stored.text, spec.id, chart),
      incompleteText: sanitizeDossierChapterText(stored.incompleteText, spec.id, chart, {
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

  for (const rawLine of lines) {
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

/**
 * B6: Khối Kết Luận Nhanh — Cốt Tủy Lá Số (5 Dòng Xác Định 100%, 0 gọi AI).
 * Chỉ chứa tọa độ sao/cung xác định từ engine, không bình giải chủ quan.
 */
export function buildDeterministicExecutiveSummaryVi(chart: ZiweiChart): string[] {
  const yinYang = translateYinYang(chart.yinYangGender);
  const ju = translateWuxingJu(chart.wuxingJuName);
  const mingZhuVi = chart.mingZhu ? translateStarName(chart.mingZhu) : 'Không rõ';
  const shenZhuVi = chart.shenZhu ? translateStarName(chart.shenZhu) : 'Không rõ';

  const formatMajorSummary = (palaceBranch: number): { palaceNameVi: string; branchVi: string; ganZhiVi: string; majorsVi: string } => {
    const pal = chart.palaces.find((p) => p.branch === palaceBranch) ?? chart.palaces[0];
    const majors = pal.stars.filter((s) => s.type === 'major');
    const majorsVi =
      majors.length > 0
        ? majors.map((s) => `${translateStarName(s.name)}${s.brightnessRaw ? ` [${translateBrightness(s.brightnessRaw)}]` : ''}`).join(', ')
        : pal.borrowedStars?.length
          ? `Vô chính diệu (mượn ${pal.borrowedStars.map((s) => translateStarName(s)).join(', ')})`
          : 'Vô chính diệu';
    return {
      palaceNameVi: translatePalaceName(pal.name),
      branchVi: VI_BRANCHES[pal.branch],
      ganZhiVi: `${VI_STEMS[pal.stem]} ${VI_BRANCHES[pal.branch]}`,
      majorsVi,
    };
  };

  const mingInfo = formatMajorSummary(chart.mingGongBranch);
  const shenInfo = formatMajorSummary(chart.shenGongBranch);

  const birthStemIdx = chart.lunarInfo.yearStem;
  const birthStemVi = VI_STEMS[birthStemIdx] ?? '';
  const birthGanZhiVi = `${birthStemVi} ${VI_BRANCHES[chart.lunarInfo.yearBranch] ?? ''}`;
  const natalTransforms = getSiHuaByStem(birthStemIdx);
  const findStarPalace = (starCn: string): string => {
    const pal = chart.palaces.find((p) => p.stars.some((s) => s.name === starCn));
    return pal ? `${translatePalaceName(pal.name)} - ${VI_BRANCHES[pal.branch]}` : 'Không xác định';
  };

  const line1 = `Căn cơ Bản Mệnh & Cục: ${yinYang} · Cục ${ju} · Mệnh Chủ: ${mingZhuVi} · Thân Chủ: ${shenZhuVi}.`;
  const line2 = `Trục Mệnh – Thân & Chính tinh: Mệnh tại ${mingInfo.branchVi} (${mingInfo.ganZhiVi}) [${mingInfo.majorsVi}]; Thân cư ${shenInfo.palaceNameVi} tại ${shenInfo.branchVi} (${shenInfo.ganZhiVi}) [${shenInfo.majorsVi}].`;
  const line3 = `Tứ Hóa Bản Mệnh (Can ${birthStemVi} · năm ${birthGanZhiVi}): Hóa Lộc: ${translateStarName(natalTransforms['禄'])} (${findStarPalace(natalTransforms['禄'])}) · Hóa Quyền: ${translateStarName(natalTransforms['权'])} (${findStarPalace(natalTransforms['权'])}) · Hóa Khoa: ${translateStarName(natalTransforms['科'])} (${findStarPalace(natalTransforms['科'])}) · Hóa Kỵ: ${translateStarName(natalTransforms['忌'])} (${findStarPalace(natalTransforms['忌'])}).`;

  const summarizeYearLine = (year: number, labelPrefix: string): string => {
    const nominalAge = year - chart.lunarInfo.lunarYear + 1;
    const dxIdx = resolveEffectiveDaXianIndex(chart, 'liunian', year);
    let dxLabel = 'chưa vào Đại Hạn';
    if (dxIdx >= 0 && chart.daXians[dxIdx]) {
      const dx = chart.daXians[dxIdx];
      const yrs = getDaXianYears(chart, dxIdx);
      const yrsStr = yrs.length > 0 ? `${yrs[0]}–${yrs[yrs.length - 1]}` : '';
      dxLabel = `${translatePalaceName(dx.palaceName)} (${dx.startAge}–${dx.endAge} tuổi${yrsStr ? `, ${yrsStr}` : ''})`;
    }
    const pCtx = buildYunxianPeriodContext(chart, { mode: 'liunian', year });
    if (!pCtx) {
      return `${labelPrefix} ${year} (${nominalAge} tuổi âm): Đại hạn ${dxLabel}.`;
    }
    const lnLoc = pCtx.periodSiHua.find((s) => s.mutagenKey === '禄');
    const lnKy = pCtx.periodSiHua.find((s) => s.mutagenKey === '忌');
    const locText = lnLoc
      ? `${lnLoc.starNameVi} tại Cung ${lnLoc.periodPalaceRoleVi} (trùng ${lnLoc.natalPalaceNameVi})`
      : 'Không rõ';
    const kyText = lnKy
      ? `${lnKy.starNameVi} tại Cung ${lnKy.periodPalaceRoleVi} (trùng ${lnKy.natalPalaceNameVi})`
      : 'Không rõ';
    return `${labelPrefix} ${year} (${pCtx.ganZhiVi} · ${nominalAge} tuổi âm): Đại hạn ${dxLabel} · Lưu Mệnh tại ${VI_BRANCHES[pCtx.branchIndex]} (trùng ${pCtx.activatedPalace.natalPalaceNameVi}) · Lưu Lộc: ${locText} / Lưu Kỵ: ${kyText}.`;
  };

  const line4 = summarizeYearLine(2026, 'Tiêu điểm Lưu Niên');
  const line5 = summarizeYearLine(2027, 'Chuyển dịch Lưu Niên');

  return [line1, line2, line3, line4, line5];
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
  const summaryLines = buildDeterministicExecutiveSummaryVi(chart);
  const gridHtml = buildDeterministicChartGridHtml(chart);

  const summaryHtml = summaryLines
    .map((line) => {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const lead = line.slice(0, colonIdx + 1);
        const tail = line.slice(colonIdx + 1);
        return `<li><strong>${escapeHtml(lead)}</strong>${escapeHtml(tail)}</li>`;
      }
      return `<li>${escapeHtml(line)}</li>`;
    })
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
        <div><strong>Tiến độ hoàn thiện:</strong> ${completedCount}/8 chương · <strong>Thời điểm xuất:</strong> ${escapeHtml(exportedAt.toLocaleString('vi-VN'))}</div>
      </div>
    </header>

    <div class="executive-summary-box">
      <h2>Kết Luận Nhanh — Cốt Tủy Lá Số (5 Dòng Xác Định)</h2>
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

/**
 * F1 + S5 + B6: Xuất bản .MD (chỉ giữ Header S5 đầy đủ + 5 dòng Cốt Tủy B6 + văn bản chương thuần,
 * tuyệt đối KHÔNG chèn lưới 4×4 hay bảng ma trận B3 vào .MD).
 */
export function buildDossierMarkdownExport(
  chart: ZiweiChart,
  states: Record<DossierChapterId, DossierChapterState>,
  exportedAt = new Date(),
): string {
  const info = buildDossierHeaderMetadata(chart);
  const summaryLines = buildDeterministicExecutiveSummaryVi(chart);
  const completedCount = DOSSIER_CHAPTER_SPECS.filter(
    (s) => states[s.id]?.status === 'completed' && Boolean(states[s.id]?.text?.trim()),
  ).length;

  const lines: string[] = [];
  lines.push(`# HỒ SƠ LUẬN GIẢI TỬ VI THIÊN KỶ — ${info.name.toUpperCase()}`);
  lines.push(
    `- **Đương số**: ${info.name} (${info.yinYang}) · **Cục số**: ${info.ju}`,
  );
  lines.push(
    `- **Dương lịch**: ${info.solar} · **Âm lịch**: ${info.lunar} · **An Mệnh tại ${info.mingBranch}**: ${info.mingMajors}`,
  );
  lines.push(`- **Giờ sinh & Chân Thái Dương Thời**: ${info.birthTimeFullSummaryVi}`);
  lines.push(
    `- **Nơi sinh / Kinh độ**: ${info.locationVi} · **Mệnh Chủ**: ${info.mingZhuVi} · **Thân Chủ**: ${info.shenZhuVi}`,
  );
  lines.push(
    `- **Tiến độ hoàn thiện**: ${completedCount}/8 chương · **Xuất lúc**: ${exportedAt.toLocaleString('vi-VN')}`,
  );

  lines.push('\n## Kết Luận Nhanh — Cốt Tủy Lá Số (5 Dòng Xác Định)');
  for (const sLine of summaryLines) {
    lines.push(`- ${sLine}`);
  }

  lines.push('\n## Mục Lục');
  for (const spec of DOSSIER_CHAPTER_SPECS) {
    const st = states[spec.id];
    const statusLabel =
      st?.status === 'completed' && st.text?.trim()
        ? 'Hoàn tất'
        : 'Chưa hoàn tất';
    lines.push(`- **${spec.titleVi}** — *${statusLabel}*`);
  }

  for (const spec of DOSSIER_CHAPTER_SPECS) {
    const st = states[spec.id];
    const cleanText = stripInternalExportMetaLines(
      sanitizeDossierChapterText(st?.text, spec.id, chart),
    )?.trim();
    const cleanIncomplete = stripInternalExportMetaLines(
      sanitizeDossierChapterText(st?.incompleteText, spec.id, chart, {
        skipPeriodSiHuaCheck: true,
      }),
    )?.trim();

    lines.push(`\n---\n\n## ${spec.titleVi}`);
    if (st?.status === 'completed' && cleanText) {
      lines.push(cleanText);
    } else {
      lines.push(
        `> **[CHƯA HOÀN TẤT — Chưa có luận giải AI hoàn chỉnh cho chương này]**`,
      );
      if (cleanIncomplete) {
        lines.push('\n*Phần văn bản đã nhận trước khi gián đoạn:*\n');
        lines.push(cleanIncomplete);
      } else {
        const { factSheetMarkdown } = resolveChapterDeterministicFactSheet(chart, spec);
        if (factSheetMarkdown) {
          lines.push('\n*Bảng dữ kiện xác định của chương:*\n');
          lines.push(factSheetMarkdown);
        }
      }
    }
  }

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
 * F1 + QĐ-G5: Xuất file .html độc lập chuẩn in (Trang 1 B1+B6+B2, bảng B3 ở Ch.7/8, theme Giấy Cổ + @media print).
 */
export function buildDossierStandaloneHtmlExport(
  chart: ZiweiChart,
  states: Record<DossierChapterId, DossierChapterState>,
  exportedAt = new Date(),
): string {
  const info = buildDossierHeaderMetadata(chart);
  const completedCount = DOSSIER_CHAPTER_SPECS.filter(
    (s) => states[s.id]?.status === 'completed' && Boolean(states[s.id]?.text?.trim()),
  ).length;

  const pageOneHtml = buildDossierPageOneHtml(chart, completedCount, exportedAt);

  const tocHtml = DOSSIER_CHAPTER_SPECS.map((spec) => {
    const st = states[spec.id];
    const isDone = st?.status === 'completed' && Boolean(st.text?.trim());
    return `<li><a href="#sec-${spec.id}">${escapeHtml(spec.titleVi)}</a> <span class="toc-status ${isDone ? 'done' : 'pending'}">${isDone ? 'Hoàn tất' : 'Chưa hoàn tất'}</span></li>`;
  }).join('\n');

  const chaptersHtml = DOSSIER_CHAPTER_SPECS.map((spec) => {
    const st = states[spec.id];
    const cleanText = stripInternalExportMetaLines(
      sanitizeDossierChapterText(st?.text, spec.id, chart),
    )?.trim();
    const cleanIncomplete = stripInternalExportMetaLines(
      sanitizeDossierChapterText(st?.incompleteText, spec.id, chart, {
        skipPeriodSiHuaCheck: true,
      }),
    )?.trim();
    const isDone = st?.status === 'completed' && Boolean(cleanText);

    const matrixPrefixHtml =
      spec.sectionId === 'horizon_5y'
        ? buildMultiYearMatrixTableHtml(chart, 5)
        : spec.sectionId === 'horizon_10y'
          ? buildMultiYearMatrixTableHtml(chart, 10)
          : '';

    if (isDone && cleanText) {
      return `<section id="sec-${spec.id}" class="chapter">
        <h2>${escapeHtml(spec.titleVi)}</h2>
        ${matrixPrefixHtml}
        <div class="chapter-body">${simpleMarkdownToHtml(cleanText)}</div>
      </section>`;
    }

    const fallbackMd = cleanIncomplete
      ? cleanIncomplete
      : resolveChapterDeterministicFactSheet(chart, spec).factSheetMarkdown;

    return `<section id="sec-${spec.id}" class="chapter chapter-incomplete">
      <h2>${escapeHtml(spec.titleVi)}</h2>
      <div class="incomplete-banner">CHƯA HOÀN TẤT — Chương này chưa có bài luận giải AI đầy đủ${cleanIncomplete ? ' (hiển thị phần đã nhận trước khi gián đoạn)' : ' (hiển thị bảng dữ kiện xác định)'}.</div>
      ${matrixPrefixHtml}
      <div class="chapter-body">${simpleMarkdownToHtml(fallbackMd)}</div>
    </section>`;
  }).join('\n');

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
    <nav class="toc">
      <h2>Mục Lục Hồ Sơ</h2>
      <ul>${tocHtml}</ul>
    </nav>
    ${chaptersHtml}
    <footer class="dossier-foot">
      Tử Vi Thiên Kỷ — Nội dung phục vụ nghiên cứu mệnh lý Tử Vi Đẩu Số.
    </footer>
  </article>
</body>
</html>`;
}
