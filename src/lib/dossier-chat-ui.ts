import type { ZiweiChart } from './ziwei/types';
import {
  buildDossierSectionFactSheetVi,
  type DossierSectionId,
} from './ziwei/dossier-context';
import {
  buildYunxianPeriodContext,
  type YunxianPeriodContext,
} from './ziwei/yunxian-context';
import {
  VI_BRANCHES,
  VI_STEMS,
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
  const b = chart.birthInfo;
  return `${b.year}_${b.month}_${b.day}_${b.hour}_${b.gender}`;
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

export const DOSSIER_INTER_CHAPTER_PACING_MS = 2_200;

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
  sections: Partial<Record<Exclude<DossierChapterId, 'year_2026' | 'year_2027'>, DossierChapterState>>;
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
        text: periodEntry.text,
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
        incompleteText: periodEntry.incompleteText,
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
    return stored;
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

function buildDossierHeaderMetadata(chart: ZiweiChart) {
  const name = chart.birthInfo.name || 'Ẩn danh';
  const solar = `${String(chart.birthInfo.day).padStart(2, '0')}/${String(chart.birthInfo.month).padStart(2, '0')}/${chart.birthInfo.year}`;
  const lunar = `${chart.lunarInfo.lunarDay}/${chart.lunarInfo.lunarMonth}/${chart.lunarInfo.lunarYear} (${VI_STEMS[chart.lunarInfo.yearStem]} ${VI_BRANCHES[chart.lunarInfo.yearBranch]})`;
  const ming = chart.palaces.find((p) => p.branch === chart.mingGongBranch);
  const mingMajors =
    ming?.stars
      .filter((s) => s.type === 'major')
      .map((s) => translateStarName(s.name))
      .join(', ') || 'Vô chính diệu';
  return {
    name,
    solar,
    lunar,
    yinYang: translateYinYang(chart.yinYangGender),
    ju: translateWuxingJu(chart.wuxingJuName),
    mingBranch: VI_BRANCHES[chart.mingGongBranch],
    mingMajors,
  };
}

export function buildDossierMarkdownExport(
  chart: ZiweiChart,
  states: Record<DossierChapterId, DossierChapterState>,
  exportedAt = new Date(),
): string {
  const info = buildDossierHeaderMetadata(chart);
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
  lines.push(
    `- **Tiến độ hoàn thiện**: ${completedCount}/8 chương · **Xuất lúc**: ${exportedAt.toLocaleString('vi-VN')}`,
  );
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
    lines.push(`\n---\n\n## ${spec.titleVi}`);
    if (st?.status === 'completed' && st.text?.trim()) {
      const metaParts = [
        st.sourceBadge ? `Nguồn: ${st.sourceBadge}` : null,
        st.meta?.modelUsed ? `Model: ${st.meta.modelUsed}` : null,
        st.meta?.maskedKey ? `Khóa: ${st.meta.maskedKey}` : null,
      ].filter(Boolean);
      if (metaParts.length > 0) {
        lines.push(`*${metaParts.join(' · ')}*\n`);
      }
      lines.push(st.text.trim());
    } else {
      lines.push(
        `> **[CHƯA HOÀN TẤT — Chưa có luận giải AI hoàn chỉnh cho chương này]**`,
      );
      if (st?.incompleteText?.trim()) {
        lines.push('\n*Phần văn bản đã nhận trước khi gián đoạn:*\n');
        lines.push(st.incompleteText.trim());
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
 * F1: Xuất file .html độc lập chuẩn in (bảng màu Giấy Cổ cố định, mở offline được, @media print).
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

  const tocHtml = DOSSIER_CHAPTER_SPECS.map((spec) => {
    const st = states[spec.id];
    const isDone = st?.status === 'completed' && Boolean(st.text?.trim());
    return `<li><a href="#sec-${spec.id}">${escapeHtml(spec.titleVi)}</a> <span class="toc-status ${isDone ? 'done' : 'pending'}">${isDone ? 'Hoàn tất' : 'Chưa hoàn tất'}</span></li>`;
  }).join('\n');

  const chaptersHtml = DOSSIER_CHAPTER_SPECS.map((spec) => {
    const st = states[spec.id];
    const isDone = st?.status === 'completed' && Boolean(st.text?.trim());
    const metaLine = [
      st?.sourceBadge ? `Nguồn: ${st.sourceBadge}` : null,
      st?.meta?.modelUsed ? `Model: ${st.meta.modelUsed}` : null,
      st?.meta?.maskedKey ? `Khóa: ${st.meta.maskedKey}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    if (isDone && st.text) {
      return `<section id="sec-${spec.id}" class="chapter">
        <h2>${escapeHtml(spec.titleVi)}</h2>
        ${metaLine ? `<div class="chapter-meta">${escapeHtml(metaLine)}</div>` : ''}
        <div class="chapter-body">${simpleMarkdownToHtml(st.text)}</div>
      </section>`;
    }

    const fallbackMd = st?.incompleteText?.trim()
      ? st.incompleteText.trim()
      : resolveChapterDeterministicFactSheet(chart, spec).factSheetMarkdown;

    return `<section id="sec-${spec.id}" class="chapter chapter-incomplete">
      <h2>${escapeHtml(spec.titleVi)}</h2>
      <div class="incomplete-banner">CHƯA HOÀN TẤT — Chương này chưa có bài luận giải AI đầy đủ${st?.incompleteText?.trim() ? ' (hiển thị phần đã nhận trước khi gián đoạn)' : ' (hiển thị bảng dữ kiện xác định)'}.</div>
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
      --paper-surface: #F3EDE0;
      --ink-main: #181A20;
      --ink-sub: #3F4554;
      --gold-ink: #8C5E14;
      --border-soft: rgba(140, 94, 20, 0.25);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px 16px 48px;
      background: var(--paper-bg);
      color: var(--ink-main);
      font-family: Georgia, "Times New Roman", serif;
      line-height: 1.7;
    }
    .sheet {
      max-width: 860px;
      margin: 0 auto;
      background: #FFFDF8;
      border: 1px solid var(--border-soft);
      padding: 36px 40px;
      border-radius: 8px;
    }
    header.dossier-head {
      border-bottom: 2px solid var(--gold-ink);
      padding-bottom: 18px;
      margin-bottom: 24px;
    }
    header.dossier-head h1 {
      margin: 0 0 10px;
      font-size: 24px;
      color: #5C3804;
      letter-spacing: 0.02em;
    }
    .meta-grid {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      color: var(--ink-sub);
      display: grid;
      gap: 4px;
    }
    .toc {
      background: var(--paper-surface);
      border: 1px solid var(--border-soft);
      padding: 16px 20px;
      border-radius: 6px;
      margin-bottom: 28px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
    }
    .toc h2 {
      margin: 0 0 10px;
      font-size: 15px;
      color: #5C3804;
    }
    .toc ul { margin: 0; padding-left: 18px; }
    .toc li { margin: 4px 0; }
    .toc a { color: var(--ink-main); text-decoration: none; font-weight: 600; }
    .toc a:hover { text-decoration: underline; color: var(--gold-ink); }
    .toc-status { font-size: 12px; margin-left: 6px; }
    .toc-status.done { color: #166534; }
    .toc-status.pending { color: #9A3412; font-weight: 600; }
    section.chapter {
      padding-top: 20px;
      margin-top: 24px;
      border-top: 1px solid var(--border-soft);
    }
    section.chapter h2 {
      margin: 0 0 8px;
      font-size: 19px;
      color: #5C3804;
    }
    section.chapter h3, section.chapter h4 {
      color: #8C5E14;
      margin: 16px 0 6px;
      font-size: 15px;
    }
    .chapter-meta {
      font-family: "Courier New", monospace;
      font-size: 12px;
      color: #6E7687;
      margin-bottom: 12px;
    }
    .incomplete-banner {
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
    .chapter-body p { margin: 8px 0; }
    .chapter-body ul, .chapter-body ol { margin: 8px 0 12px; padding-left: 22px; }
    .chapter-body li { margin: 4px 0; }
    footer.dossier-foot {
      margin-top: 36px;
      padding-top: 14px;
      border-top: 1px solid var(--border-soft);
      font-size: 12px;
      color: #6E7687;
      text-align: center;
    }
    @media print {
      body { background: #FFFFFF; padding: 0; }
      .sheet { max-width: 100%; border: none; padding: 0; background: #FFFFFF; }
      section.chapter { break-inside: auto; }
      section.chapter h2 { break-after: avoid; }
    }
  </style>
</head>
<body>
  <article class="sheet">
    <header class="dossier-head">
      <h1>Hồ Sơ Luận Giải Tử Vi Thiên Kỷ — ${escapeHtml(info.name)}</h1>
      <div class="meta-grid">
        <div><strong>Đương số:</strong> ${escapeHtml(info.name)} (${escapeHtml(info.yinYang)}) · <strong>Cục số:</strong> ${escapeHtml(info.ju)} · <strong>An Mệnh tại ${escapeHtml(info.mingBranch)}:</strong> ${escapeHtml(info.mingMajors)}</div>
        <div><strong>Dương lịch:</strong> ${escapeHtml(info.solar)} · <strong>Âm lịch:</strong> ${escapeHtml(info.lunar)}</div>
        <div><strong>Tiến độ hoàn thiện:</strong> ${completedCount}/8 chương · <strong>Thời điểm xuất:</strong> ${escapeHtml(exportedAt.toLocaleString('vi-VN'))}</div>
      </div>
    </header>
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
