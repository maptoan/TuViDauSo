import { useEffect, useState, useCallback } from 'react';
import { generateChart } from './ziwei/algorithm';
import { formToBirthInfo, formToTrueSolarTime } from './ziwei/share';
import { isValidGregorianDate } from './ziwei/true-solar-time';
import { buildChartIdentityKey } from './ziwei/yunxian-context';
import { VI_BRANCHES, VI_SHICHEN, VI_STEMS, translateStarName, translateWuxingJu, translateYinYang, translateProvinceName } from './ziwei/vi-i18n';
import type { BirthFormState, ZiweiChart } from './ziwei/types';
import {
  DOSSIER_CHAPTER_SPECS,
  DOSSIER_LRU_INDEX_KEY,
  buildDossierHeaderMetadata,
  buildDossierStorageKey,
  buildPeriodCacheKeyForYear,
  getBrowserSessionStorage,
  listLruSessionKeys,
  registerAuthoritativeDossierBridge,
  removeLruSessionEntry,
  sanitizeDossierChapterText,
  upsertLruSessionEntry,
  type AiPeriodEntry,
  type DossierChapterId,
  type DossierChapterState,
  type StorageLike,
  type StoredDossierRecord,
} from './dossier-chat-ui';

// ─── 1. HẰNG SỐ & KHÓA LƯU TRỮ (POST-PANEL V2 + ĐC-1..ĐC-5) ─────────────────

export const CHART_LIBRARY_SCHEMA_VERSION = 1 as const;

export const LEGACY_HISTORY_STORAGE_KEY = 'ziwei_history';
export const LIBRARY_INDEX_STORAGE_KEY = 'ziwei_chart_library_v1';
export const LIBRARY_MIGRATED_FLAG_KEY = 'ziwei_chart_library_migrated_v1';
export const HOT_DOSSIER_STORAGE_PREFIX = 'ziwei_dossier_hot_v1::';
export const HOT_DOSSIER_LRU_INDEX_KEY = 'ziwei_dossier_hot_lru_v1';

export const LIBRARY_IDB_NAME = 'ziwei_thien_ky_library_db_v1';
export const LIBRARY_IDB_VERSION = 1;
export const LIBRARY_IDB_DOSSIER_STORE = 'dossier_records';

export const MAX_LIBRARY_ENTRIES = 100;
export const MAX_PINNED_ENTRIES = 30;
export const MAX_DELETED_TOMBSTONES = 200;
export const TOMBSTONE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
export const MAX_HOT_DOSSIERS_LOCALSTORAGE = 3;
export const LIBRARY_MAX_ALIAS_CHARS = 80;
export const LIBRARY_MAX_NOTE_CHARS = 2_000;

// ─── 2. KIỂU DỮ LIỆU THƯ VIỆN LÁ SỐ [MỚI] ────────────────────────────────────

export interface LibraryChapterStatusMeta {
  chapterId: DossierChapterId;
  status: 'completed' | 'incomplete';
  updatedAt: number;
  modelUsed: string | null;
  charCount: number;
}

export interface LibraryDossierSummary {
  totalChapters: 8;
  completedCount: number;
  incompleteCount: number;
  completedChapterIds: DossierChapterId[];
  incompleteChapterIds: DossierChapterId[];
  lastGeneratedAt: number | null;
  modelsUsed: string[];
  totalCharCount: number;
  chapterMetaMap: Partial<Record<DossierChapterId, LibraryChapterStatusMeta>>;
}

export interface LibraryDeterministicBadge {
  solarDateStr: string;
  lunarDateStr: string;
  yearCanZhiVi: string;
  shichenLabelVi: string;
  clockTimeLabelVi: string;
  trueSolarTimeLabelVi: string | null;
  locationLabelVi: string;
  yinYangGenderVi: string;
  wuxingJuVi: string;
  mingGongBranchVi: string;
  mingMajorStarsVi: string;
  mingZhuVi: string;
  shenZhuVi: string;
}

export interface ChartLibraryEntry {
  chartIdentityKey: string;
  legacyFivePartKey: string;
  form: Readonly<BirthFormState>;
  customAlias: string;
  notes: string;
  pinned: boolean;
  pinnedAt: number | null;
  deterministicBadge: LibraryDeterministicBadge;
  dossierSummary: LibraryDossierSummary;
  createdAt: number;
  updatedAt: number;
  notesUpdatedAt: number;
  lastOpenedAt: number;
}

export interface DeletedChartTombstone {
  chartIdentityKey: string;
  deletedAt: number;
}

export interface ChartLibraryIndexStore {
  schemaVersion: 1;
  updatedAt: number;
  entries: ChartLibraryEntry[];
  deletedTombstones: DeletedChartTombstone[];
}

export interface ChartLibraryExportBundle {
  bundleType: 'tu-vi-thien-ky-chart-library';
  schemaVersion: 1;
  appVersion: string;
  exportedAt: number;
  exportedAtIso: string;
  entries: ChartLibraryEntry[];
  dossiers: Record<string, StoredDossierRecord>;
  deletedTombstones: DeletedChartTombstone[];
}

export type LibraryHydrationStatus = 'idle' | 'hydrating' | 'ready' | 'degraded';

export interface LibraryStorageHealth {
  indexedDbAvailable: boolean;
  mode: 'full_indexeddb' | 'degraded_no_idb';
  reason: string | null;
}

export interface EvictedBackupItem {
  entry: ChartLibraryEntry;
  dossier: StoredDossierRecord | null;
  evictedAt: number;
  tier: 1 | 2 | 3 | 4;
  autoBackupTriggered: boolean;
  autoBackupFilename: string | null;
}

export interface DossierReadState {
  hydrationStatus: LibraryHydrationStatus;
  isHydrated: boolean;
  record: StoredDossierRecord | null;
  source: 'ram_ssot' | 'hot_fallback' | 'session_fallback' | 'none';
}

export interface ImportMergeResult {
  ok: boolean;
  error?: string;
  addedEntries: number;
  updatedEntries: number;
  mergedCompletedChapters: number;
  skippedInvalidCount: number;
  skippedTombstonedCount: number;
}

export interface DossierPersistenceAdapter {
  isAvailable(): Promise<{ ok: boolean; reason: string | null }>;
  get(chartIdentityKey: string): Promise<StoredDossierRecord | null>;
  getAll(): Promise<StoredDossierRecord[]>;
  put(record: StoredDossierRecord): Promise<void>;
  delete(chartIdentityKey: string): Promise<void>;
}

// ─── 3. HẠ TẦNG INDEXEDDB & ADAPTER LƯU TRỮ BỀN VỮNG (ĐC-3 & ĐC-4) ────────────

function sanitizeFilenameSlug(input: string): string {
  return (
    (input || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'la-so'
  );
}

export function triggerJsonFileDownload(filename: string, jsonText: string): boolean {
  try {
    if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') {
      return false;
    }
    const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    } else {
      URL.revokeObjectURL(url);
    }
    return true;
  } catch {
    return false;
  }
}

export function createBrowserIndexedDbAdapter(
  idbFactory?: IDBFactory | null,
): DossierPersistenceAdapter {
  const resolveFactory = (): IDBFactory | null => {
    if (idbFactory !== undefined) return idbFactory;
    try {
      if (typeof window !== 'undefined' && window.indexedDB) {
        return window.indexedDB;
      }
      if (typeof globalThis !== 'undefined' && 'indexedDB' in globalThis) {
        return (globalThis as { indexedDB?: IDBFactory }).indexedDB ?? null;
      }
    } catch {
      return null;
    }
    return null;
  };

  let openPromise: Promise<IDBDatabase> | null = null;

  const openDb = (): Promise<IDBDatabase> => {
    if (openPromise) return openPromise;
    const factory = resolveFactory();
    if (!factory) {
      return Promise.reject(new Error('IndexedDB không khả dụng trên môi trường này.'));
    }

    openPromise = new Promise<IDBDatabase>((resolve, reject) => {
      try {
        const req = factory.open(LIBRARY_IDB_NAME, LIBRARY_IDB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(LIBRARY_IDB_DOSSIER_STORE)) {
            db.createObjectStore(LIBRARY_IDB_DOSSIER_STORE, {
              keyPath: 'chartIdentityKey',
            });
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          db.onversionchange = () => {
            db.close();
            openPromise = null;
          };
          resolve(db);
        };
        req.onerror = () => {
          openPromise = null;
          reject(req.error ?? new Error('Không thể mở IndexedDB.'));
        };
        req.onblocked = () => {
          openPromise = null;
          reject(new Error('IndexedDB đang bị chặn bởi phiên khác.'));
        };
      } catch (err) {
        openPromise = null;
        reject(err instanceof Error ? err : new Error('IndexedDB bị chặn.'));
      }
    });

    return openPromise;
  };

  return {
    async isAvailable() {
      const factory = resolveFactory();
      if (!factory) {
        return {
          ok: false,
          reason: 'Trình duyệt không hỗ trợ hoặc đang tắt IndexedDB.',
        };
      }
      try {
        await openDb();
        return { ok: true, reason: null };
      } catch (err) {
        return {
          ok: false,
          reason:
            err instanceof Error
              ? err.message
              : 'IndexedDB bị chặn bởi cài đặt quyền riêng tư/ẩn danh.',
        };
      }
    },

    async get(chartIdentityKey: string) {
      const db = await openDb();
      return new Promise<StoredDossierRecord | null>((resolve, reject) => {
        const tx = db.transaction(LIBRARY_IDB_DOSSIER_STORE, 'readonly');
        const store = tx.objectStore(LIBRARY_IDB_DOSSIER_STORE);
        const req = store.get(chartIdentityKey);
        req.onsuccess = () => resolve((req.result as StoredDossierRecord | undefined) ?? null);
        req.onerror = () => reject(req.error ?? new Error('Lỗi đọc IndexedDB'));
      });
    },

    async getAll() {
      const db = await openDb();
      return new Promise<StoredDossierRecord[]>((resolve, reject) => {
        const tx = db.transaction(LIBRARY_IDB_DOSSIER_STORE, 'readonly');
        const store = tx.objectStore(LIBRARY_IDB_DOSSIER_STORE);
        const req = store.getAll();
        req.onsuccess = () => {
          const res = req.result;
          resolve(Array.isArray(res) ? (res as StoredDossierRecord[]) : []);
        };
        req.onerror = () => reject(req.error ?? new Error('Lỗi liệt kê IndexedDB'));
      });
    },

    async put(record: StoredDossierRecord) {
      const db = await openDb();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(LIBRARY_IDB_DOSSIER_STORE, 'readwrite');
        const store = tx.objectStore(LIBRARY_IDB_DOSSIER_STORE);
        store.put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Lỗi ghi IndexedDB'));
        tx.onabort = () => reject(tx.error ?? new Error('Giao dịch ghi IndexedDB bị hủy'));
      });
    },

    async delete(chartIdentityKey: string) {
      const db = await openDb();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(LIBRARY_IDB_DOSSIER_STORE, 'readwrite');
        const store = tx.objectStore(LIBRARY_IDB_DOSSIER_STORE);
        store.delete(chartIdentityKey);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Lỗi xóa IndexedDB'));
      });
    },
  };
}

// ─── 4. RUNTIME STATE (NGUỒN SỰ THẬT DUY NHẤT & HÀNG ĐỢI HYDRATION) ───────────

export interface StorageWithOptionalKeys extends StorageLike {
  length?: number;
  key?(index: number): string | null;
  keys?(): string[];
}

function getBrowserLocalStorage(): StorageWithOptionalKeys | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // ignore restricted storage
  }
  return null;
}

type AutoBackupEvictionHook = (
  bundle: ChartLibraryExportBundle,
  entry: ChartLibraryEntry,
  filename: string,
) => boolean;

let runtimeLocalStorageOverride: StorageWithOptionalKeys | null | undefined = undefined;
let runtimeSessionStorageOverride: StorageWithOptionalKeys | null | undefined = undefined;
let runtimeIdbAdapter: DossierPersistenceAdapter = createBrowserIndexedDbAdapter();
let runtimeAutoBackupHook: AutoBackupEvictionHook | null = null;

/**
 * ĐC-3: Nguồn Sự Thật Duy Nhất (Single Source of Truth — SSOT) cho Hồ Sơ 8 Chương:
 * - `inMemoryDossierMirror` phản chiếu trực tiếp dữ liệu từ IndexedDB (`ziwei_thien_ky_library_db_v1`).
 * - Khóa sessionStorage `'ziwei_dossier_v1::*'` CHỈ là gương ghi-thông (write-through mirror).
 * - Khi có sai lệch giữa sessionStorage và IndexedDB/inMemoryDossierMirror, IndexedDB/gương RAM LUÔN THẮNG.
 */
const inMemoryDossierMirror = new Map<string, StoredDossierRecord>();

// ĐC-1: Hàng đợi thay đổi phát sinh trong lúc IndexedDB đang mở chậm để hợp nhất (merge) sau hydration,
// TUYỆT ĐỐI KHÔNG ghi đè mất dữ liệu cũ nằm trong IndexedDB.
const pendingDossierMutations = new Map<string, StoredDossierRecord>();
const pendingDossierDeletes = new Set<string>();

let hydrationStatus: LibraryHydrationStatus = 'idle';
let hydrationPromise: Promise<void> | null = null;
let storageHealth: LibraryStorageHealth = {
  indexedDbAvailable: true,
  mode: 'full_indexeddb',
  reason: null,
};
let lastEvictedBackupItem: EvictedBackupItem | null = null;
const libraryListeners = new Set<() => void>();

function notifyLibraryListeners(): void {
  for (const listener of libraryListeners) {
    try {
      listener();
    } catch {
      // ignore listener errors
    }
  }
}

export function subscribeChartLibrary(listener: () => void): () => void {
  libraryListeners.add(listener);
  return () => {
    libraryListeners.delete(listener);
  };
}

function resolveLocalStorage(): StorageWithOptionalKeys | null {
  if (runtimeLocalStorageOverride !== undefined) return runtimeLocalStorageOverride;
  return getBrowserLocalStorage();
}

function resolveSessionStorage(): StorageWithOptionalKeys | null {
  if (runtimeSessionStorageOverride !== undefined) return runtimeSessionStorageOverride;
  return getBrowserSessionStorage() as StorageWithOptionalKeys | null;
}

/**
 * Dùng cho kiểm thử tự động (scripts/verify-chart-library.ts) để tiêm MockStorage,
 * giả lập IndexedDB chậm (TEST-L11) hoặc bị chặn (TEST-L12).
 */
export function configureChartLibraryRuntimeForTest(options: {
  localStorage?: StorageWithOptionalKeys | null;
  sessionStorage?: StorageWithOptionalKeys | null;
  idbAdapter?: DossierPersistenceAdapter;
  autoBackupHook?: AutoBackupEvictionHook | null;
  resetState?: boolean;
}): void {
  if (options.localStorage !== undefined) {
    runtimeLocalStorageOverride = options.localStorage;
  }
  if (options.sessionStorage !== undefined) {
    runtimeSessionStorageOverride = options.sessionStorage;
  }
  if (options.idbAdapter !== undefined) {
    runtimeIdbAdapter = options.idbAdapter;
  }
  if (options.autoBackupHook !== undefined) {
    runtimeAutoBackupHook = options.autoBackupHook;
  }
  if (options.resetState !== false) {
    inMemoryDossierMirror.clear();
    pendingDossierMutations.clear();
    pendingDossierDeletes.clear();
    hydrationStatus = 'idle';
    hydrationPromise = null;
    storageHealth = {
      indexedDbAvailable: true,
      mode: 'full_indexeddb',
      reason: null,
    };
    lastEvictedBackupItem = null;
  }
  registerAuthoritativeDossierBridge(chartLibraryDossierBridge);
}

// ─── 5. CÁC HÀM CHUẨN HÓA, TÍNH KHÓA & DỮ KIỆN XÁC ĐỊNH (ĐC-5) ──────────────

/**
 * ĐC-5: KHÔNG cắt form.name (bỏ slice(0,32)) và KHÔNG sửa trường nào làm thay đổi
 * khóa định danh so với đúng form app dùng để lập lá số qua generateChart(formToBirthInfo(form)).
 * Việc rút gọn hiển thị tên dài chỉ thực hiện ở lớp giao diện UI.
 */
export function normalizeBirthFormForLibrary(form: BirthFormState): BirthFormState {
  return { ...form };
}

export function buildLegacyFivePartKey(chart: ZiweiChart): string {
  const b = chart.birthInfo;
  return `${b.year}_${b.month}_${b.day}_${b.hour}_${b.gender}`;
}

export function computeNameSlugForKey(name: string | undefined): string {
  return (
    (name || '')
      .trim()
      .normalize('NFC')
      .toLowerCase()
      .replace(/[^a-z0-9\p{L}]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'anon'
  );
}

export function buildLibraryDeterministicBadge(chart: ZiweiChart): LibraryDeterministicBadge {
  const meta = buildDossierHeaderMetadata(chart);
  const b = chart.birthInfo;
  const shichenObj = VI_SHICHEN[b.hour] ?? VI_SHICHEN[0];
  const shichenLabelVi = b.origInput
    ? shichenObj.name
    : `Chưa rõ giờ (tạm ${shichenObj.name})`;
  const clockTimeLabelVi = b.origInput ? meta.clockTimeVi : 'Chưa rõ giờ';
  const trueSolarTimeLabelVi =
    meta.trueSolarTimeHHMM && meta.trueSolarCorrectionMin !== null
      ? `${meta.trueSolarTimeHHMM} (${meta.trueSolarCorrectionMin >= 0 ? '+' : ''}${meta.trueSolarCorrectionMin}p)`
      : null;

  const yearCanZhiVi = `${VI_STEMS[chart.lunarInfo.yearStem] ?? ''} ${VI_BRANCHES[chart.lunarInfo.yearBranch] ?? ''}`.trim();
  const provinceShort = b.province
    ? translateProvinceName(b.province).replace(/^Việt Nam\s*[—-]\s*/i, '')
    : '';
  const hasLon = typeof b.longitude === 'number' && Number.isFinite(b.longitude);
  const locationParts = [b.city, provinceShort].filter(Boolean);
  const locationLabelVi =
    locationParts.length > 0
      ? hasLon
        ? `${locationParts[0]} (${b.longitude!.toFixed(2)}°Đ)`
        : locationParts[0]!
      : hasLon
        ? `Kinh độ ${b.longitude!.toFixed(2)}°Đ`
        : 'Chưa chọn địa phương';

  const mingPalace = chart.palaces.find((p) => p.branch === chart.mingGongBranch);
  const mingMajors =
    mingPalace?.stars
      .filter((s) => s.type === 'major')
      .map((s) => translateStarName(s.name))
      .join(', ') ||
    (mingPalace?.borrowedStars?.length
      ? `Vô chính diệu (mượn ${mingPalace.borrowedStars.map((s) => translateStarName(s)).join(', ')})`
      : 'Vô chính diệu');

  return {
    solarDateStr: meta.solar,
    lunarDateStr: meta.lunar,
    yearCanZhiVi,
    shichenLabelVi,
    clockTimeLabelVi,
    trueSolarTimeLabelVi,
    locationLabelVi,
    yinYangGenderVi: translateYinYang(chart.yinYangGender),
    wuxingJuVi: translateWuxingJu(chart.wuxingJuName),
    mingGongBranchVi: VI_BRANCHES[chart.mingGongBranch] ?? 'Tý',
    mingMajorStarsVi: mingMajors,
    mingZhuVi: chart.mingZhu ? translateStarName(chart.mingZhu) : 'Không rõ',
    shenZhuVi: chart.shenZhu ? translateStarName(chart.shenZhu) : 'Không rõ',
  };
}

export function createEmptyDossierSummary(): LibraryDossierSummary {
  return {
    totalChapters: 8,
    completedCount: 0,
    incompleteCount: 0,
    completedChapterIds: [],
    incompleteChapterIds: [],
    lastGeneratedAt: null,
    modelsUsed: [],
    totalCharCount: 0,
    chapterMetaMap: {},
  };
}

export function computeDossierSummary(
  record: StoredDossierRecord | null | undefined,
): LibraryDossierSummary {
  if (!record || !record.sections) return createEmptyDossierSummary();

  const completedChapterIds: DossierChapterId[] = [];
  const incompleteChapterIds: DossierChapterId[] = [];
  const modelsSet = new Set<string>();
  const chapterMetaMap: Partial<Record<DossierChapterId, LibraryChapterStatusMeta>> = {};
  let lastGeneratedAt: number | null = null;
  let totalCharCount = 0;

  for (const spec of DOSSIER_CHAPTER_SPECS) {
    const sec = record.sections[spec.id];
    if (!sec) continue;
    const isCompleted = sec.status === 'completed' && Boolean(sec.text?.trim());
    const isIncomplete =
      !isCompleted &&
      sec.status === 'incomplete' &&
      Boolean(sec.incompleteText?.trim());
    if (!isCompleted && !isIncomplete) continue;

    const textLen = isCompleted
      ? (sec.text ?? '').length
      : (sec.incompleteText ?? '').length;
    const ts = sec.updatedAt ?? record.updatedAt ?? Date.now();
    const modelUsed = sec.meta?.modelUsed ?? null;
    if (modelUsed) modelsSet.add(modelUsed);

    if (isCompleted) {
      completedChapterIds.push(spec.id);
    } else {
      incompleteChapterIds.push(spec.id);
    }
    totalCharCount += textLen;
    if (lastGeneratedAt === null || ts > lastGeneratedAt) {
      lastGeneratedAt = ts;
    }

    chapterMetaMap[spec.id] = {
      chapterId: spec.id,
      status: isCompleted ? 'completed' : 'incomplete',
      updatedAt: ts,
      modelUsed,
      charCount: textLen,
    };
  }

  return {
    totalChapters: 8,
    completedCount: completedChapterIds.length,
    incompleteCount: incompleteChapterIds.length,
    completedChapterIds,
    incompleteChapterIds,
    lastGeneratedAt,
    modelsUsed: Array.from(modelsSet),
    totalCharCount,
    chapterMetaMap,
  };
}

export function resolveChartAndIdentityFromForm(form: BirthFormState): {
  normalizedForm: BirthFormState;
  chart: ZiweiChart;
  chartIdentityKey: string;
  legacyFivePartKey: string;
} {
  const normalizedForm = normalizeBirthFormForLibrary(form);
  const birthInfo = formToBirthInfo(normalizedForm);
  const chart = generateChart(birthInfo);
  const chartIdentityKey = buildChartIdentityKey(chart);
  const legacyFivePartKey = buildLegacyFivePartKey(chart);
  return {
    normalizedForm,
    chart,
    chartIdentityKey,
    legacyFivePartKey,
  };
}

// ─── 6. ĐỌC / GHI CHỈ MỤC LOCALSTORAGE & HOT CACHE (ĐC-2 & PL-08) ───────────

function createEmptyIndexStore(now = Date.now()): ChartLibraryIndexStore {
  return {
    schemaVersion: CHART_LIBRARY_SCHEMA_VERSION,
    updatedAt: now,
    entries: [],
    deletedTombstones: [],
  };
}

function pruneTombstones(
  list: DeletedChartTombstone[],
  nowMs = Date.now(),
): DeletedChartTombstone[] {
  const map = new Map<string, number>();
  for (const item of list) {
    if (!item || typeof item.chartIdentityKey !== 'string' || typeof item.deletedAt !== 'number') {
      continue;
    }
    if (nowMs - item.deletedAt > TOMBSTONE_RETENTION_MS) continue;
    const prev = map.get(item.chartIdentityKey) ?? 0;
    if (item.deletedAt > prev) map.set(item.chartIdentityKey, item.deletedAt);
  }
  return Array.from(map.entries())
    .map(([chartIdentityKey, deletedAt]) => ({ chartIdentityKey, deletedAt }))
    .sort((a, b) => b.deletedAt - a.deletedAt)
    .slice(0, MAX_DELETED_TOMBSTONES);
}

export function readLibraryIndexStore(): ChartLibraryIndexStore {
  const ls = resolveLocalStorage();
  if (!ls) return createEmptyIndexStore();
  try {
    const raw = ls.getItem(LIBRARY_INDEX_STORAGE_KEY);
    if (!raw) return createEmptyIndexStore();
    const parsed = JSON.parse(raw) as Partial<ChartLibraryIndexStore>;
    const entries = Array.isArray(parsed.entries)
      ? parsed.entries.filter(
          (e): e is ChartLibraryEntry =>
            Boolean(e) &&
            typeof e.chartIdentityKey === 'string' &&
            Boolean(e.form) &&
            typeof e.form.year === 'string',
        )
      : [];
    const parsedUpdatedAt =
      typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now();
    // Dùng Date.now() cho dữ liệu thật; giữ nguyên mốc tương đối nếu test dùng epoch nhỏ (< 2001)
    const pruneRefNow =
      parsedUpdatedAt > 1_000_000_000_000 ? Date.now() : parsedUpdatedAt;
    const tombstones = Array.isArray(parsed.deletedTombstones)
      ? pruneTombstones(parsed.deletedTombstones, pruneRefNow)
      : [];
    return {
      schemaVersion: CHART_LIBRARY_SCHEMA_VERSION,
      updatedAt: parsedUpdatedAt,
      entries,
      deletedTombstones: tombstones,
    };
  } catch {
    return createEmptyIndexStore();
  }
}

function clearAllHotDossiersFromLocalStorage(ls: StorageWithOptionalKeys | null): void {
  if (!ls) return;
  const hotKeys = listLruSessionKeys(ls, HOT_DOSSIER_LRU_INDEX_KEY);
  for (const k of hotKeys) {
    try {
      ls.removeItem(k);
    } catch {
      // ignore
    }
  }
  try {
    ls.removeItem(HOT_DOSSIER_LRU_INDEX_KEY);
  } catch {
    // ignore
  }
}

function writeLibraryIndexStore(
  store: ChartLibraryIndexStore,
  nowMs?: number,
): boolean {
  const ls = resolveLocalStorage();
  if (!ls) return false;
  const refNow = nowMs ?? Date.now();
  const normalized: ChartLibraryIndexStore = {
    schemaVersion: CHART_LIBRARY_SCHEMA_VERSION,
    updatedAt: refNow,
    entries: store.entries.slice(0, MAX_LIBRARY_ENTRIES),
    deletedTombstones: pruneTombstones(store.deletedTombstones, refNow),
  };
  const serialized = JSON.stringify(normalized);
  try {
    ls.setItem(LIBRARY_INDEX_STORAGE_KEY, serialized);
    return true;
  } catch {
    // PL-08: Khi localStorage gặp QuotaExceededError, dọn sạch hot dossiers trước để bảo toàn 100% chỉ mục thư viện
    clearAllHotDossiersFromLocalStorage(ls);
    try {
      ls.setItem(LIBRARY_INDEX_STORAGE_KEY, serialized);
      return true;
    } catch {
      return false;
    }
  }
}

export function buildHotDossierStorageKey(chartIdentityKey: string): string {
  return `${HOT_DOSSIER_STORAGE_PREFIX}${chartIdentityKey}`;
}

function writeHotDossierToLocalStorage(record: StoredDossierRecord): boolean {
  const ls = resolveLocalStorage();
  if (!ls) return false;
  const key = buildHotDossierStorageKey(record.chartIdentityKey);
  const res = upsertLruSessionEntry(
    ls,
    HOT_DOSSIER_LRU_INDEX_KEY,
    key,
    record,
    MAX_HOT_DOSSIERS_LOCALSTORAGE,
  );
  if (!res.ok) {
    // PL-08: Không bao giờ để hot dossier tranh chấp làm tràn chỉ mục thư viện
    clearAllHotDossiersFromLocalStorage(ls);
  }
  return res.ok;
}

function readHotDossierFromLocalStorage(chartIdentityKey: string): StoredDossierRecord | null {
  const ls = resolveLocalStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(buildHotDossierStorageKey(chartIdentityKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDossierRecord;
    if (!parsed || !parsed.sections) return null;
    // LK-10: Từ chối bản ghi hot cache có chartIdentityKey nội bộ lệch khóa tra cứu
    if (parsed.chartIdentityKey && parsed.chartIdentityKey !== chartIdentityKey) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function removeHotDossierFromLocalStorage(chartIdentityKey: string): void {
  const ls = resolveLocalStorage();
  if (!ls) return;
  removeLruSessionEntry(ls, HOT_DOSSIER_LRU_INDEX_KEY, buildHotDossierStorageKey(chartIdentityKey));
}

function removeSessionMirrorDossier(chartIdentityKey: string): void {
  const ss = resolveSessionStorage();
  if (!ss) return;
  removeLruSessionEntry(ss, DOSSIER_LRU_INDEX_KEY, buildDossierStorageKey(chartIdentityKey));
}

function writeSessionMirrorDossier(record: StoredDossierRecord): void {
  const ss = resolveSessionStorage();
  if (!ss) return;
  // ĐC-3: Chỉ ghi các chương đã completed xuống gương ghi-thông sessionStorage
  const completedSections: StoredDossierRecord['sections'] = {};
  for (const [k, v] of Object.entries(record.sections || {})) {
    if (v && v.status === 'completed' && v.text?.trim()) {
      completedSections[k as DossierChapterId] = v;
    }
  }
  const key = buildDossierStorageKey(record.chartIdentityKey);
  if (Object.keys(completedSections).length === 0) {
    removeLruSessionEntry(ss, DOSSIER_LRU_INDEX_KEY, key);
    return;
  }
  upsertLruSessionEntry(
    ss,
    DOSSIER_LRU_INDEX_KEY,
    key,
    {
      chartIdentityKey: record.chartIdentityKey,
      updatedAt: record.updatedAt,
      sections: completedSections,
    } satisfies StoredDossierRecord,
    5,
  );
}

// ─── 7. THUẬT TOÁN HỢP NHẤT ĐƠN ĐIỆU TỪNG CHƯƠNG (PL-02) ─────────────────────

export function sanitizeFullDossierRecord(
  record: StoredDossierRecord,
  canonicalKey: string,
  chart?: ZiweiChart,
): StoredDossierRecord {
  const cleanedSections: StoredDossierRecord['sections'] = {};
  for (const spec of DOSSIER_CHAPTER_SPECS) {
    const val = record.sections?.[spec.id];
    if (!val) continue;
    // LK-10 / Mục vá 1: Bỏ qua section có sectionCacheKey thuộc khóa khác khi record.chartIdentityKey khớp khóa đích
    if (record.chartIdentityKey === canonicalKey && val.sectionCacheKey) {
      const sepIdx = val.sectionCacheKey.lastIndexOf('::');
      const sectionOwnerKey = sepIdx >= 0 ? val.sectionCacheKey.slice(0, sepIdx) : '';
      if (sectionOwnerKey && sectionOwnerKey !== canonicalKey) {
        continue;
      }
    }
    const isCompleted = val.status === 'completed' && Boolean(val.text?.trim());
    const isIncomplete =
      !isCompleted && val.status === 'incomplete' && Boolean(val.incompleteText?.trim());
    if (!isCompleted && !isIncomplete) continue;

    cleanedSections[spec.id] = {
      ...val,
      chapterId: spec.id,
      sectionCacheKey: `${canonicalKey}::${spec.id}`,
      text: isCompleted
        ? sanitizeDossierChapterText(val.text, spec.id, chart)
        : undefined,
      incompleteText: isIncomplete
        ? sanitizeDossierChapterText(val.incompleteText, spec.id, chart, {
            skipPeriodSiHuaCheck: true,
          })
        : undefined,
      updatedAt: val.updatedAt ?? record.updatedAt ?? Date.now(),
    };
  }

  return {
    chartIdentityKey: canonicalKey,
    updatedAt: record.updatedAt || Date.now(),
    sections: cleanedSections,
  };
}

export function mergeDossierRecords(
  chartIdentityKey: string,
  localRecord: StoredDossierRecord | null | undefined,
  incomingRecord: StoredDossierRecord | null | undefined,
  chart?: ZiweiChart,
): StoredDossierRecord | null {
  if (!localRecord && !incomingRecord) return null;
  if (!localRecord) {
    return incomingRecord ? sanitizeFullDossierRecord(incomingRecord, chartIdentityKey, chart) : null;
  }
  if (!incomingRecord) {
    return sanitizeFullDossierRecord(localRecord, chartIdentityKey, chart);
  }

  const mergedSections: Partial<Record<DossierChapterId, DossierChapterState>> = {};
  let maxUpdatedAt = Math.max(localRecord.updatedAt || 0, incomingRecord.updatedAt || 0);

  for (const spec of DOSSIER_CHAPTER_SPECS) {
    const chId = spec.id;
    const locSec = localRecord.sections?.[chId];
    const incSec = incomingRecord.sections?.[chId];

    if (!locSec && !incSec) continue;
    if (!locSec) {
      mergedSections[chId] = incSec;
      continue;
    }
    if (!incSec) {
      mergedSections[chId] = locSec;
      continue;
    }

    const locCompleted = locSec.status === 'completed' && Boolean(locSec.text?.trim());
    const incCompleted = incSec.status === 'completed' && Boolean(incSec.text?.trim());

    if (locCompleted && !incCompleted) {
      mergedSections[chId] = locSec;
    } else if (!locCompleted && incCompleted) {
      mergedSections[chId] = incSec;
    } else {
      const locTime = locSec.updatedAt ?? localRecord.updatedAt ?? 0;
      const incTime = incSec.updatedAt ?? incomingRecord.updatedAt ?? 0;
      if (incTime > locTime) {
        mergedSections[chId] = incSec;
      } else if (locTime > incTime) {
        mergedSections[chId] = locSec;
      } else {
        const locLen = (locSec.text || locSec.incompleteText || '').length;
        const incLen = (incSec.text || incSec.incompleteText || '').length;
        mergedSections[chId] = incLen >= locLen ? incSec : locSec;
      }
    }

    const chosenTime = mergedSections[chId]?.updatedAt ?? 0;
    if (chosenTime > maxUpdatedAt) maxUpdatedAt = chosenTime;
  }

  return sanitizeFullDossierRecord(
    {
      chartIdentityKey,
      updatedAt: maxUpdatedAt,
      sections: mergedSections,
    },
    chartIdentityKey,
    chart,
  );
}

// ─── 8. THANG THU HỒI 4 NẤC & BẢO VỆ TỰ ĐỘNG TẢI BACKUP (ĐC-2 & PL-09) ───────

export function selectEvictionCandidate(
  entries: ChartLibraryEntry[],
): { candidate: ChartLibraryEntry; tier: 1 | 2 | 3 | 4 } | null {
  const unpinned = entries.filter((e) => !e.pinned);
  if (unpinned.length === 0) return null;

  const sortByOldestOpened = (a: ChartLibraryEntry, b: ChartLibraryEntry) =>
    a.lastOpenedAt - b.lastOpenedAt || a.createdAt - b.createdAt;

  // Nấc 1: Không ghim, 0 chương hồ sơ, không ghi chú
  const tier1 = unpinned
    .filter(
      (e) =>
        e.dossierSummary.completedCount === 0 &&
        e.dossierSummary.incompleteCount === 0 &&
        e.notes.trim().length === 0,
    )
    .sort(sortByOldestOpened);
  if (tier1.length > 0) return { candidate: tier1[0], tier: 1 };

  // Nấc 2: Không ghim, 0 chương hồ sơ, có ghi chú
  const tier2 = unpinned
    .filter(
      (e) =>
        e.dossierSummary.completedCount === 0 &&
        e.dossierSummary.incompleteCount === 0,
    )
    .sort(sortByOldestOpened);
  if (tier2.length > 0) return { candidate: tier2[0], tier: 2 };

  // Nấc 3: Không ghim, có ít chương hoàn tất nhất (chưa đủ 8/8 hoặc ít nhất)
  const tier3 = unpinned
    .filter((e) => e.dossierSummary.completedCount < 8)
    .sort(
      (a, b) =>
        a.dossierSummary.completedCount - b.dossierSummary.completedCount ||
        a.dossierSummary.incompleteCount - b.dossierSummary.incompleteCount ||
        sortByOldestOpened(a, b),
    );
  if (tier3.length > 0) return { candidate: tier3[0], tier: 3 };

  // Nấc 4: Toàn bộ mục không ghim đều đủ 8/8 chương -> chọn mở lâu nhất
  const tier4 = [...unpinned].sort(sortByOldestOpened);
  return { candidate: tier4[0], tier: 4 };
}

function buildSingleEntryBundle(
  entry: ChartLibraryEntry,
  dossier: StoredDossierRecord | null,
): ChartLibraryExportBundle {
  const now = Date.now();
  return {
    bundleType: 'tu-vi-thien-ky-chart-library',
    schemaVersion: CHART_LIBRARY_SCHEMA_VERSION,
    appVersion: '1.2.0-rc.2',
    exportedAt: now,
    exportedAtIso: new Date(now).toISOString(),
    entries: [entry],
    dossiers: dossier ? { [entry.chartIdentityKey]: dossier } : {},
    deletedTombstones: [],
  };
}

function autoDownloadEvictedEntryWithDossier(
  entry: ChartLibraryEntry,
  dossier: StoredDossierRecord | null,
): { ok: boolean; filename: string | null } {
  const slug = sanitizeFilenameSlug(entry.customAlias || entry.form.name || 'la-so');
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `sao-luu-tu-dong-${slug}-${dateStamp}.json`;
  const bundle = buildSingleEntryBundle(entry, dossier);
  const jsonText = JSON.stringify(bundle, null, 2);

  if (runtimeAutoBackupHook) {
    const hookOk = runtimeAutoBackupHook(bundle, entry, filename);
    return { ok: hookOk, filename: hookOk ? filename : null };
  }

  const ok = triggerJsonFileDownload(filename, jsonText);
  return { ok, filename: ok ? filename : null };
}

function getBestKnownDossierSync(chartIdentityKey: string): StoredDossierRecord | null {
  // ĐC-3: Ưu tiên gương RAM (SSOT từ IndexedDB) -> Hot cache localStorage -> gương sessionStorage
  const fromRam = inMemoryDossierMirror.get(chartIdentityKey);
  if (fromRam) return fromRam;

  const fromHot = readHotDossierFromLocalStorage(chartIdentityKey);
  if (fromHot) return fromHot;

  const ss = resolveSessionStorage();
  if (ss) {
    try {
      const raw = ss.getItem(buildDossierStorageKey(chartIdentityKey));
      if (raw) {
        const parsed = JSON.parse(raw) as StoredDossierRecord;
        if (
          parsed &&
          parsed.sections &&
          (!parsed.chartIdentityKey || parsed.chartIdentityKey === chartIdentityKey)
        ) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
  }
  return null;
}

function evictOneIfNeeded(
  store: ChartLibraryIndexStore,
  incomingKey: string,
): {
  ok: boolean;
  store: ChartLibraryIndexStore;
  evicted: EvictedBackupItem | null;
  blockedReason?: string;
} {
  if (store.entries.some((e) => e.chartIdentityKey === incomingKey)) {
    return { ok: true, store, evicted: null };
  }
  if (store.entries.length < MAX_LIBRARY_ENTRIES) {
    return { ok: true, store, evicted: null };
  }

  const picked = selectEvictionCandidate(store.entries);
  if (!picked) {
    return {
      ok: false,
      store,
      evicted: null,
      blockedReason: 'Không có mục chưa ghim hợp lệ để thu hồi.',
    };
  }

  const { candidate, tier } = picked;
  const candidateDossier = getBestKnownDossierSync(candidate.chartIdentityKey);
  const candidateSummary = candidateDossier
    ? computeDossierSummary(candidateDossier)
    : candidate.dossierSummary;
  const hasCompletedChapters = candidateSummary.completedCount > 0;

  let autoBackupTriggered = false;
  let autoBackupFilename: string | null = null;

  // ĐC-2: Nấc 3-4 hoặc bất kỳ mục nào CÓ chương hoàn tất chỉ được xóa SAU KHI
  // tự động tải xuống file JSON sao lưu riêng của đúng mục đó (entry + dossier).
  if (tier >= 3 || hasCompletedChapters) {
    const dl = autoDownloadEvictedEntryWithDossier(candidate, candidateDossier);
    if (!dl.ok) {
      return {
        ok: false,
        store,
        evicted: null,
        blockedReason:
          'Không thể tự động tải xuống file sao lưu JSON cho lá số có hồ sơ; đã hủy thu hồi để bảo vệ dữ liệu.',
      };
    }
    autoBackupTriggered = true;
    autoBackupFilename = dl.filename;
  }

  // Thực hiện xóa sau khi đã bảo toàn sao lưu
  const nextEntries = store.entries.filter(
    (e) => e.chartIdentityKey !== candidate.chartIdentityKey,
  );
  inMemoryDossierMirror.delete(candidate.chartIdentityKey);
  removeHotDossierFromLocalStorage(candidate.chartIdentityKey);
  removeSessionMirrorDossier(candidate.chartIdentityKey);

  if (hydrationStatus === 'hydrating') {
    pendingDossierMutations.delete(candidate.chartIdentityKey);
    pendingDossierDeletes.add(candidate.chartIdentityKey);
  } else if (storageHealth.indexedDbAvailable) {
    void runtimeIdbAdapter.delete(candidate.chartIdentityKey).catch(() => {});
  }

  const evictedItem: EvictedBackupItem = {
    entry: candidate,
    dossier: candidateDossier,
    evictedAt: Date.now(),
    tier,
    autoBackupTriggered,
    autoBackupFilename,
  };
  lastEvictedBackupItem = evictedItem;

  return {
    ok: true,
    store: {
      ...store,
      entries: nextEntries,
    },
    evicted: evictedItem,
  };
}

// ─── 9. DI TRÚ DỮ LIỆU CŨ 3 BẬC (PL-04) & HYDRATION GATE (ĐC-1 & ĐC-4) ───────

function listAllKeysFromStorage(storage: StorageWithOptionalKeys | null): string[] {
  if (!storage) return [];
  const keys = new Set<string>();
  try {
    if (typeof storage.keys === 'function') {
      for (const k of storage.keys()) keys.add(k);
    } else if (typeof storage.length === 'number' && typeof storage.key === 'function') {
      for (let i = 0; i < storage.length; i += 1) {
        const k = storage.key(i);
        if (k) keys.add(k);
      }
    } else {
      for (const k of Object.keys(storage)) keys.add(k);
    }
  } catch {
    // ignore enumeration failures
  }
  for (const k of listLruSessionKeys(storage, DOSSIER_LRU_INDEX_KEY)) {
    keys.add(k);
  }
  return Array.from(keys);
}

function collectLegacyDossierMapFromStorage(
  storage: StorageWithOptionalKeys | null,
): Map<string, StoredDossierRecord> {
  const out = new Map<string, StoredDossierRecord>();
  if (!storage) return out;
  const prefix = 'ziwei_dossier_v1::';
  for (const fullKey of listAllKeysFromStorage(storage)) {
    if (!fullKey.startsWith(prefix)) continue;
    const rawKey = fullKey.slice(prefix.length);
    try {
      const raw = storage.getItem(fullKey);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as StoredDossierRecord;
      if (parsed && parsed.sections) {
        out.set(rawKey, parsed);
      }
    } catch {
      // ignore corrupted entry
    }
  }
  return out;
}

export interface LegacyHistoryEntryShape {
  id: string;
  label: string;
  form: BirthFormState;
  savedAt: number;
}

function isReasonableBirthForm(form: unknown): form is BirthFormState {
  if (!form || typeof form !== 'object') return false;
  const f = form as Partial<BirthFormState>;
  const y = Number(f.year);
  const m = Number(f.month);
  const d = Number(f.day);
  if (!Number.isInteger(y) || y < 1900 || y > 2100) return false;
  if (!Number.isInteger(m) || m < 1 || m > 12) return false;
  if (!Number.isInteger(d) || d < 1 || d > 31) return false;
  if (!isValidGregorianDate(y, m, d)) return false;
  if (f.gender !== 'male' && f.gender !== 'female') return false;
  if (!f.unknownTime) {
    const hh = Number(f.clockHour);
    const mm = Number(f.clockMinute);
    if (!Number.isInteger(hh) || hh < 0 || hh > 23) return false;
    if (!Number.isInteger(mm) || mm < 0 || mm > 59) return false;
  }
  return true;
}

function persistDossierToTargets(record: StoredDossierRecord, chart?: ZiweiChart): void {
  const normalized = sanitizeFullDossierRecord(record, record.chartIdentityKey, chart);
  inMemoryDossierMirror.set(normalized.chartIdentityKey, normalized);
  writeHotDossierToLocalStorage(normalized);
  writeSessionMirrorDossier(normalized);

  if (hydrationStatus === 'hydrating') {
    // ĐC-1: Xếp hàng bản ghi phát sinh trong lúc IDB đang mở chậm để hợp nhất sau hydration
    const existingPending = pendingDossierMutations.get(normalized.chartIdentityKey);
    const mergedPending = mergeDossierRecords(
      normalized.chartIdentityKey,
      existingPending,
      normalized,
      chart,
    );
    if (mergedPending) {
      pendingDossierMutations.set(normalized.chartIdentityKey, mergedPending);
      pendingDossierDeletes.delete(normalized.chartIdentityKey);
    }
    return;
  }

  if (storageHealth.indexedDbAvailable) {
    void runtimeIdbAdapter.put(normalized).catch(() => {
      // ignore transient async IDB failure (already safe in RAM & hot cache)
    });
  }
}

/**
 * Tự động di trú 'ziwei_history' và liên kết CHỈ KHỚP CHÍNH XÁC khóa 9 thành phần 'ziwei_dossier_v1::*' (lũy đẳng).
 * Tuyệt đối không đoán mò theo khóa 5 thành phần / nameSlug, không hồi sinh mục trong deletedTombstones,
 * và không xóa 'ziwei_history'.
 */
export function migrateLegacyHistoryAndDossiers(currentForm?: BirthFormState | null): {
  migratedEntries: number;
  linkedDossiers: number;
} {
  const ls = resolveLocalStorage();
  const ss = resolveSessionStorage();
  if (!ls) return { migratedEntries: 0, linkedDossiers: 0 };

  let store = readLibraryIndexStore();
  const orphanDossiers = collectLegacyDossierMapFromStorage(ss);
  const matchedOrphanKeys = new Set<string>();

  const tombstoneMap = new Map<string, number>();
  for (const t of store.deletedTombstones) {
    if (t && typeof t.chartIdentityKey === 'string' && typeof t.deletedAt === 'number') {
      tombstoneMap.set(t.chartIdentityKey, t.deletedAt);
    }
  }

  let legacyEntries: LegacyHistoryEntryShape[] = [];
  try {
    const rawHistory = ls.getItem(LEGACY_HISTORY_STORAGE_KEY);
    if (rawHistory) {
      const parsed = JSON.parse(rawHistory);
      if (Array.isArray(parsed)) {
        legacyEntries = parsed.filter(
          (item): item is LegacyHistoryEntryShape =>
            Boolean(item) && isReasonableBirthForm((item as LegacyHistoryEntryShape).form),
        );
      }
    }
  } catch {
    legacyEntries = [];
  }

  const resolvedItems = legacyEntries.map((item) => ({
    item,
    resolved: resolveChartAndIdentityFromForm(item.form),
  }));

  let migratedEntries = 0;
  let linkedDossiers = 0;
  let summaryUpdatedCount = 0;
  const entryMap = new Map<string, ChartLibraryEntry>(
    store.entries.map((e) => [e.chartIdentityKey, e]),
  );

  for (const { item, resolved } of resolvedItems) {
    const { normalizedForm, chart, chartIdentityKey, legacyFivePartKey } = resolved;
    const savedAt =
      typeof item.savedAt === 'number' && Number.isFinite(item.savedAt)
        ? item.savedAt
        : Date.now();

    // LK-05: Không hồi sinh mục đã bị xóa vĩnh viễn nhưng còn sót trong ziwei_history
    const deletedAt = tombstoneMap.get(chartIdentityKey);
    if (deletedAt !== undefined && deletedAt >= savedAt && !entryMap.has(chartIdentityKey)) {
      continue;
    }

    // Mục vá 1: CHỈ gắn hồ sơ khi khớp chính xác 100% khóa định danh 9 thành phần (chartIdentityKey).
    // Hồ sơ phiên không khớp (kể cả khóa 5 thành phần cũ) giữ nguyên tại sessionStorage, tuyệt đối không gắn chéo.
    const rawOrphan = orphanDossiers.get(chartIdentityKey) ?? null;
    const exactOrphan =
      rawOrphan && (!rawOrphan.chartIdentityKey || rawOrphan.chartIdentityKey === chartIdentityKey)
        ? rawOrphan
        : null;
    if (exactOrphan) {
      matchedOrphanKeys.add(chartIdentityKey);
    }

    const persistedAuthoritative =
      inMemoryDossierMirror.get(chartIdentityKey) ??
      readHotDossierFromLocalStorage(chartIdentityKey);
    const existingRecord = getBestKnownDossierSync(chartIdentityKey);
    const mergedRecord = exactOrphan
      ? mergeDossierRecords(chartIdentityKey, existingRecord, exactOrphan, chart)
      : existingRecord;

    if (mergedRecord && exactOrphan) {
      const prevSummary = computeDossierSummary(persistedAuthoritative);
      const nextSummary = computeDossierSummary(mergedRecord);
      const hasNewerOrMoreContent =
        !persistedAuthoritative ||
        nextSummary.completedCount > prevSummary.completedCount ||
        nextSummary.incompleteCount > prevSummary.incompleteCount ||
        (mergedRecord.updatedAt ?? 0) > (persistedAuthoritative.updatedAt ?? 0);

      if (hasNewerOrMoreContent) {
        persistDossierToTargets(mergedRecord, chart);
        linkedDossiers += 1;
      }
    }

    const existing = entryMap.get(chartIdentityKey);
    const summary = computeDossierSummary(mergedRecord);
    if (!existing) {
      const nextEntry: ChartLibraryEntry = {
        chartIdentityKey,
        legacyFivePartKey,
        form: normalizedForm,
        customAlias: '',
        notes: '',
        pinned: false,
        pinnedAt: null,
        deterministicBadge: buildLibraryDeterministicBadge(chart),
        dossierSummary: summary,
        createdAt: savedAt,
        updatedAt: Math.max(savedAt, summary.lastGeneratedAt ?? 0),
        notesUpdatedAt: 0,
        lastOpenedAt: savedAt,
      };
      entryMap.set(chartIdentityKey, nextEntry);
      migratedEntries += 1;
    } else if (
      summary.completedCount > existing.dossierSummary.completedCount ||
      (summary.incompleteCount > existing.dossierSummary.incompleteCount &&
        existing.dossierSummary.completedCount === 0)
    ) {
      entryMap.set(chartIdentityKey, {
        ...existing,
        dossierSummary: summary,
      });
      summaryUpdatedCount += 1;
    }
  }

  // Cứu hộ hồ sơ của lá số đang mở hiện tại (CHỈ khớp chính xác khóa 9 thành phần)
  if (currentForm && isReasonableBirthForm(currentForm)) {
    const resolved = resolveChartAndIdentityFromForm(currentForm);
    const { chartIdentityKey, legacyFivePartKey, chart, normalizedForm } = resolved;
    const rawCurrentOrphan = !matchedOrphanKeys.has(chartIdentityKey)
      ? (orphanDossiers.get(chartIdentityKey) ?? null)
      : null;
    const orphanCurrent =
      rawCurrentOrphan &&
      (!rawCurrentOrphan.chartIdentityKey || rawCurrentOrphan.chartIdentityKey === chartIdentityKey)
        ? rawCurrentOrphan
        : null;
    const curDeletedAt = tombstoneMap.get(chartIdentityKey);
    const isTombstonedCurrent =
      curDeletedAt !== undefined &&
      !entryMap.has(chartIdentityKey) &&
      curDeletedAt >= (orphanCurrent?.updatedAt ?? 0);

    if (orphanCurrent && !isTombstonedCurrent) {
      const persistedAuthoritative =
        inMemoryDossierMirror.get(chartIdentityKey) ??
        readHotDossierFromLocalStorage(chartIdentityKey);
      const merged = mergeDossierRecords(
        chartIdentityKey,
        getBestKnownDossierSync(chartIdentityKey),
        orphanCurrent,
        chart,
      );
      if (merged) {
        const prevSummary = computeDossierSummary(persistedAuthoritative);
        const nextSummary = computeDossierSummary(merged);
        const hasNewerOrMoreContent =
          !persistedAuthoritative ||
          nextSummary.completedCount > prevSummary.completedCount ||
          nextSummary.incompleteCount > prevSummary.incompleteCount ||
          (merged.updatedAt ?? 0) > (persistedAuthoritative.updatedAt ?? 0);

        if (hasNewerOrMoreContent) {
          persistDossierToTargets(merged, chart);
          linkedDossiers += 1;
        }
        if (!entryMap.has(chartIdentityKey)) {
          const now = Date.now();
          const summary = computeDossierSummary(merged);
          entryMap.set(chartIdentityKey, {
            chartIdentityKey,
            legacyFivePartKey,
            form: normalizedForm,
            customAlias: '',
            notes: '',
            pinned: false,
            pinnedAt: null,
            deterministicBadge: buildLibraryDeterministicBadge(chart),
            dossierSummary: summary,
            createdAt: now,
            updatedAt: now,
            notesUpdatedAt: 0,
            lastOpenedAt: now,
          });
          migratedEntries += 1;
        }
      }
    }
  }

  // Dirty guard (LK-05): Chỉ ghi lại chỉ mục khi thực sự có mục mới hoặc chương hồ sơ mới
  if (migratedEntries > 0 || linkedDossiers > 0 || summaryUpdatedCount > 0) {
    const combinedEntries = Array.from(entryMap.values())
      .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
      .slice(0, MAX_LIBRARY_ENTRIES);

    store = {
      ...store,
      entries: combinedEntries,
    };
    writeLibraryIndexStore(store);
  }

  try {
    if (ls.getItem(LIBRARY_MIGRATED_FLAG_KEY) !== '1') {
      ls.setItem(LIBRARY_MIGRATED_FLAG_KEY, '1');
    }
  } catch {
    // ignore
  }

  return { migratedEntries, linkedDossiers };
}

/**
 * ĐC-1 & ĐC-4: Khởi tạo Thư Viện, kiểm tra khả dụng IndexedDB (feature-detect)
 * và nạp toàn bộ hồ sơ từ IndexedDB vào gương RAM (inMemoryDossierMirror).
 * Trong lúc hydrationStatus === 'hydrating', mọi ghi nhận mới được đưa vào
 * pendingDossierMutations và hợp nhất (merge) sau khi IDB nạp xong — cấm ghi đè thiếu.
 */
export function initChartLibrary(currentForm?: BirthFormState | null): Promise<{
  hydrationStatus: LibraryHydrationStatus;
  storageHealth: LibraryStorageHealth;
}> {
  registerAuthoritativeDossierBridge(chartLibraryDossierBridge);

  if (hydrationPromise) {
    return hydrationPromise.then(() => ({ hydrationStatus, storageHealth }));
  }

  hydrationStatus = 'hydrating';
  // DM-01 (ĐP-1): Di trú đồng bộ ngay ở đầu initChartLibrary (trước IIFE async chờ IndexedDB)
  // trong trạng thái 'hydrating' để chỉ mục localStorage đầy đủ ở 0ms và giữ detectChartDuplicateInLibrary thuần khiết 100%.
  migrateLegacyHistoryAndDossiers(currentForm);
  notifyLibraryListeners();

  hydrationPromise = (async () => {
    try {
      const probe = await runtimeIdbAdapter.isAvailable();
      if (!probe.ok) {
        // ĐC-4: IndexedDB bị chặn hoặc không hỗ trợ -> chế độ suy giảm
        storageHealth = {
          indexedDbAvailable: false,
          mode: 'degraded_no_idb',
          reason:
            probe.reason ||
            'IndexedDB không khả dụng; hệ thống đang chạy chế độ suy giảm (hot cache localStorage + session).',
        };
        migrateLegacyHistoryAndDossiers(currentForm);

        // Nạp hot cache & session vào gương RAM
        const indexStore = readLibraryIndexStore();
        for (const entry of indexStore.entries) {
          const hot = readHotDossierFromLocalStorage(entry.chartIdentityKey);
          const pending = pendingDossierMutations.get(entry.chartIdentityKey);
          const merged = mergeDossierRecords(entry.chartIdentityKey, hot, pending);
          if (merged && !pendingDossierDeletes.has(entry.chartIdentityKey)) {
            inMemoryDossierMirror.set(entry.chartIdentityKey, merged);
          }
        }
        pendingDossierMutations.clear();
        pendingDossierDeletes.clear();
        hydrationStatus = 'degraded';
        notifyLibraryListeners();
        return;
      }

      storageHealth = {
        indexedDbAvailable: true,
        mode: 'full_indexeddb',
        reason: null,
      };

      // 1) Đọc toàn bộ bản ghi bền vững hiện có từ IndexedDB (SSOT)
      const idbRecords = await runtimeIdbAdapter.getAll();
      const idbMap = new Map<string, StoredDossierRecord>();
      for (const rec of idbRecords) {
        if (rec && typeof rec.chartIdentityKey === 'string' && rec.sections) {
          idbMap.set(rec.chartIdentityKey, rec);
        }
      }

      // 2) Đưa toàn bộ dữ liệu từ IndexedDB vào gương RAM (SSOT) trước, đồng thời hợp nhất mọi thao tác phát sinh trong lúc chờ hydration (ĐC-1)
      let store = readLibraryIndexStore();
      const entryMap = new Map(store.entries.map((e) => [e.chartIdentityKey, e]));

      for (const [key, idbRec] of idbMap.entries()) {
        if (pendingDossierDeletes.has(key)) {
          await runtimeIdbAdapter.delete(key).catch(() => {});
          continue;
        }
        const entry = entryMap.get(key);
        const chart = entry ? generateChart(formToBirthInfo(entry.form)) : undefined;
        const pendingRec = pendingDossierMutations.get(key);
        const merged = mergeDossierRecords(key, idbRec, pendingRec, chart);
        if (merged) {
          inMemoryDossierMirror.set(key, merged);
          if (pendingRec) {
            await runtimeIdbAdapter.put(merged).catch(() => {});
          }
          // ĐC-3: Đồng bộ lại hot cache & session mirror theo SSOT IndexedDB (SSOT luôn thắng)
          writeSessionMirrorDossier(merged);
          if (entry) {
            entryMap.set(key, {
              ...entry,
              dossierSummary: computeDossierSummary(merged),
            });
          }
        }
        pendingDossierMutations.delete(key);
      }

      // 3) Ghi các bản ghi hoàn toàn mới phát sinh trong lúc chờ hydration (chưa từng có trong IDB)
      for (const [key, pendingRec] of pendingDossierMutations.entries()) {
        if (pendingDossierDeletes.has(key)) continue;
        const entry = entryMap.get(key);
        const chart = entry ? generateChart(formToBirthInfo(entry.form)) : undefined;
        const sanitized = sanitizeFullDossierRecord(pendingRec, key, chart);
        inMemoryDossierMirror.set(key, sanitized);
        await runtimeIdbAdapter.put(sanitized).catch(() => {});
        writeHotDossierToLocalStorage(sanitized);
        writeSessionMirrorDossier(sanitized);
        if (entry) {
          entryMap.set(key, {
            ...entry,
            dossierSummary: computeDossierSummary(sanitized),
          });
        }
      }
      pendingDossierMutations.clear();
      pendingDossierDeletes.clear();

      // Lưu lại summary đã đồng bộ từ IDB trước khi chạy di trú legacy
      store = {
        ...store,
        entries: Array.from(entryMap.values()),
      };
      writeLibraryIndexStore(store);

      // 4) Chạy di trú an toàn từ 'ziwei_history' + 'ziwei_dossier_v1::*' (idempotent)
      migrateLegacyHistoryAndDossiers(currentForm);

      // 5) Đảm bảo mọi hồ sơ di trú hoặc hot cache mới đều đã vào IDB nếu IDB chưa có
      for (const [key, ramRec] of inMemoryDossierMirror.entries()) {
        if (!idbMap.has(key)) {
          await runtimeIdbAdapter.put(ramRec).catch(() => {});
        }
      }

      hydrationStatus = 'ready';
      notifyLibraryListeners();
    } catch (err) {
      storageHealth = {
        indexedDbAvailable: false,
        mode: 'degraded_no_idb',
        reason: err instanceof Error ? err.message : 'Lỗi khởi tạo IndexedDB.',
      };
      migrateLegacyHistoryAndDossiers(currentForm);
      hydrationStatus = 'degraded';
      notifyLibraryListeners();
    }
  })();

  return hydrationPromise.then(() => ({ hydrationStatus, storageHealth }));
}

export function getLibraryHydrationStatus(): LibraryHydrationStatus {
  return hydrationStatus;
}

export function getLibraryStorageHealth(): LibraryStorageHealth {
  return storageHealth;
}

export function getLastEvictedBackupItem(): EvictedBackupItem | null {
  return lastEvictedBackupItem;
}

export function dismissEvictionBackupBanner(): void {
  lastEvictedBackupItem = null;
  notifyLibraryListeners();
}

export function undoLastEviction(): { ok: boolean; reason?: string } {
  if (!lastEvictedBackupItem) {
    return { ok: false, reason: 'Không có mục nào vừa bị thu hồi trong phiên này.' };
  }
  const backup = lastEvictedBackupItem;
  let store = readLibraryIndexStore();

  // Nếu thư viện đang đầy 100 thì giải phóng 1 mục không ghim rỗng nhất
  if (store.entries.length >= MAX_LIBRARY_ENTRIES) {
    const evRes = evictOneIfNeeded(store, backup.entry.chartIdentityKey);
    if (!evRes.ok) {
      return { ok: false, reason: evRes.blockedReason };
    }
    store = evRes.store;
  }

  const now = Date.now();
  const restoredEntry: ChartLibraryEntry = {
    ...backup.entry,
    lastOpenedAt: now,
    updatedAt: now,
  };
  const nextEntries = [
    restoredEntry,
    ...store.entries.filter((e) => e.chartIdentityKey !== restoredEntry.chartIdentityKey),
  ];
  writeLibraryIndexStore({ ...store, entries: nextEntries });

  if (backup.dossier) {
    const chart = generateChart(formToBirthInfo(restoredEntry.form));
    persistDossierToTargets(backup.dossier, chart);
  }
  lastEvictedBackupItem = null;
  notifyLibraryListeners();
  return { ok: true };
}

// ─── 10. CÁC THAO TÁC CRUD THƯ VIỆN LÁ SỐ & CẦU NỐI SSOT ─────────────────────

function syncLegacyHistoryMirror(form: BirthFormState): void {
  const ls = resolveLocalStorage();
  if (!ls) return;
  try {
    const raw = ls.getItem(LEGACY_HISTORY_STORAGE_KEY);
    const prev: LegacyHistoryEntryShape[] = raw ? JSON.parse(raw) : [];
    const safePrev = Array.isArray(prev) ? prev : [];
    const label = [
      form.name,
      `${form.day}/${form.month}/${form.year}`,
      form.city || form.province || '',
      form.gender === 'male' ? 'Nam' : 'Nữ',
    ]
      .filter(Boolean)
      .join(' · ');
    const entry: LegacyHistoryEntryShape = {
      id: Date.now().toString(),
      label,
      form,
      savedAt: Date.now(),
    };
    const deduped = safePrev.filter(
      (e) =>
        !(
          e.form?.year === form.year &&
          e.form?.month === form.month &&
          e.form?.day === form.day &&
          e.form?.gender === form.gender &&
          e.form?.clockHour === form.clockHour &&
          e.form?.clockMinute === form.clockMinute &&
          (e.form?.name || '') === (form.name || '')
        ),
    );
    ls.setItem(LEGACY_HISTORY_STORAGE_KEY, JSON.stringify([entry, ...deduped].slice(0, 10)));
  } catch {
    // ignore legacy mirror failure
  }
}

// ─── 10B. PHÁT HIỆN LÁ SỐ TRÙNG & ĐỐI CHIẾU SAI KHÁC (THUẦN KHIẾT — V2) ─────

export const MAX_NEAR_MATCH_CANDIDATES = 5;

export type DuplicateDiffFieldKey =
  | 'name'
  | 'birthDateSolar'
  | 'clockTime'
  | 'unknownTime'
  | 'shichenBranch'
  | 'gender'
  | 'location'
  | 'longitude'
  | 'trueSolarTime'
  | 'mingGongBranch'
  | 'lunarLeapMonth';

export interface BirthFormFieldDiff {
  field: DuplicateDiffFieldKey;
  labelVi: string;
  savedValueVi: string;
  incomingValueVi: string;
  /** Đánh dấu trường trực tiếp làm thay đổi cấu trúc 12 cung / bàn sao */
  affectsChartStructure: boolean;
}

export interface NearMatchLibraryCandidate {
  entry: ChartLibraryEntry;
  matchReason: 'same_five_part_key' | 'same_name_and_solar_date';
  matchReasonLabelVi: string;
  diffs: BirthFormFieldDiff[];
  hasStructuralChartDiff: boolean;
  effectiveCompletedCount: number;
  effectiveIncompleteCount: number;
  similarityScore: number;
}

export type ChartDuplicateDetectionResult =
  | {
      kind: 'none';
      incomingForm: BirthFormState;
      incomingChart: ZiweiChart;
      incomingChartIdentityKey: string;
      incomingFivePartKey: string;
      hydrationStatus: LibraryHydrationStatus;
    }
  | {
      kind: 'exact_match';
      incomingForm: BirthFormState;
      incomingChart: ZiweiChart;
      incomingChartIdentityKey: string;
      incomingFivePartKey: string;
      existingEntry: ChartLibraryEntry;
      completedCount: number;
      incompleteCount: number;
      hydrationStatus: LibraryHydrationStatus;
    }
  | {
      kind: 'near_match';
      incomingForm: BirthFormState;
      incomingChart: ZiweiChart;
      incomingChartIdentityKey: string;
      incomingFivePartKey: string;
      candidates: NearMatchLibraryCandidate[];
      totalCandidateCount: number;
      hydrationStatus: LibraryHydrationStatus;
    };

export function resolveEffectiveDossierSummaryForEntry(
  entry: ChartLibraryEntry,
  chart?: ZiweiChart,
): LibraryDossierSummary {
  const readState = getDossierReadState(entry.chartIdentityKey, chart);
  if (readState.record) {
    return computeDossierSummary(readState.record);
  }
  return entry.dossierSummary;
}

function pad2Digits(value: number | string | undefined): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value ?? '00').padStart(2, '0');
  return String(Math.trunc(num)).padStart(2, '0');
}

function formatSolarDateViForDiff(form: Readonly<BirthFormState>): string {
  return `${pad2Digits(form.day)}/${pad2Digits(form.month)}/${String(form.year || '').trim()}`;
}

function formatLocationViForDiff(form: Readonly<BirthFormState>): string {
  const city = (form.city || '').trim();
  const provinceRaw = (form.province || '').trim();
  const provinceVi = provinceRaw ? translateProvinceName(provinceRaw) : '';
  if (city && provinceVi) return `${city} (${provinceVi})`;
  if (city) return city;
  if (provinceVi) return provinceVi;
  return '(Chưa chọn địa phương)';
}

function formatLongitudeViForDiff(form: Readonly<BirthFormState>): string {
  if (!form.province || typeof form.longitude !== 'number' || !Number.isFinite(form.longitude)) {
    return 'Chưa áp dụng kinh độ';
  }
  const absLon = Math.abs(form.longitude).toFixed(2);
  return form.longitude >= 0 ? `${absLon}°Đ` : `${absLon}°T`;
}

function formatShichenViForDiff(chart: ZiweiChart, form: Readonly<BirthFormState>): string {
  const shichenObj = VI_SHICHEN[chart.birthInfo.hour] ?? VI_SHICHEN[0];
  const base = `${shichenObj.name} (${shichenObj.range})`;
  return form.unknownTime ? `${base} — tạm lấy do chưa rõ giờ` : base;
}

export function diffBirthFormsForDuplicateModal(
  savedForm: Readonly<BirthFormState>,
  incomingForm: Readonly<BirthFormState>,
  savedChart?: ZiweiChart,
  incomingChart?: ZiweiChart,
  savedEntryMeta?: { customAlias?: string; notes?: string },
): BirthFormFieldDiff[] {
  const sChart = savedChart ?? generateChart(formToBirthInfo(savedForm));
  const iChart = incomingChart ?? generateChart(formToBirthInfo(incomingForm));
  const diffs: BirthFormFieldDiff[] = [];

  const savedNameTrimmed = (savedForm.name || '').trim();
  const incomingNameTrimmed = (incomingForm.name || '').trim();
  const aliasTrimmed = (savedEntryMeta?.customAlias || '').trim();
  if (savedNameTrimmed !== incomingNameTrimmed) {
    const baseSavedName = savedNameTrimmed ? `"${savedNameTrimmed}"` : '(Để trống / Ẩn danh)';
    const savedNameWithAlias = aliasTrimmed
      ? `${baseSavedName} (Biệt danh: "${aliasTrimmed}")`
      : baseSavedName;
    const incomingNameLabel = incomingNameTrimmed
      ? `"${incomingNameTrimmed}"`
      : '(Để trống / Ẩn danh)';
    diffs.push({
      field: 'name',
      labelVi: 'Họ tên đương số',
      savedValueVi: savedNameWithAlias,
      incomingValueVi: incomingNameLabel,
      affectsChartStructure: false,
    });
  }

  if (
    Number(savedForm.year) !== Number(incomingForm.year) ||
    Number(savedForm.month) !== Number(incomingForm.month) ||
    Number(savedForm.day) !== Number(incomingForm.day)
  ) {
    diffs.push({
      field: 'birthDateSolar',
      labelVi: 'Ngày sinh Dương lịch',
      savedValueVi: formatSolarDateViForDiff(savedForm),
      incomingValueVi: formatSolarDateViForDiff(incomingForm),
      affectsChartStructure: true,
    });
  }

  const savedUnknown = Boolean(savedForm.unknownTime);
  const incomingUnknown = Boolean(incomingForm.unknownTime);
  if (savedUnknown !== incomingUnknown) {
    diffs.push({
      field: 'unknownTime',
      labelVi: 'Chế độ giờ sinh',
      savedValueVi: savedUnknown
        ? 'Chưa rõ giờ sinh (tạm lấy Giờ Tý 00:00)'
        : 'Đã biết giờ sinh',
      incomingValueVi: incomingUnknown
        ? 'Chưa rõ giờ sinh (tạm lấy Giờ Tý 00:00)'
        : 'Đã biết giờ sinh',
      affectsChartStructure: true,
    });
  }

  const sameShichenBranch = sChart.birthInfo.hour === iChart.birthInfo.hour;
  if (
    !savedUnknown &&
    !incomingUnknown &&
    (Number(savedForm.clockHour) !== Number(incomingForm.clockHour) ||
      Number(savedForm.clockMinute) !== Number(incomingForm.clockMinute))
  ) {
    diffs.push({
      field: 'clockTime',
      labelVi: 'Giờ · Phút đồng hồ',
      savedValueVi: `${pad2Digits(savedForm.clockHour)}:${pad2Digits(savedForm.clockMinute)}`,
      incomingValueVi: `${pad2Digits(incomingForm.clockHour)}:${pad2Digits(incomingForm.clockMinute)}`,
      affectsChartStructure: !sameShichenBranch,
    });
  }

  if (
    (savedForm.province || '').trim() !== (incomingForm.province || '').trim() ||
    (savedForm.city || '').trim() !== (incomingForm.city || '').trim()
  ) {
    diffs.push({
      field: 'location',
      labelVi: 'Nơi sinh (Tỉnh/Thành)',
      savedValueVi: formatLocationViForDiff(savedForm),
      incomingValueVi: formatLocationViForDiff(incomingForm),
      affectsChartStructure: false,
    });
  }

  const savedLon = savedForm.province ? (savedForm.longitude ?? 0) : 0;
  const incomingLon = incomingForm.province ? (incomingForm.longitude ?? 0) : 0;
  if (
    Boolean(savedForm.province) !== Boolean(incomingForm.province) ||
    Math.abs(savedLon - incomingLon) >= 0.005
  ) {
    diffs.push({
      field: 'longitude',
      labelVi: 'Kinh độ hiệu chỉnh',
      savedValueVi: formatLongitudeViForDiff(savedForm),
      incomingValueVi: formatLongitudeViForDiff(incomingForm),
      affectsChartStructure: false,
    });
  }

  if (!savedUnknown && !incomingUnknown) {
    const sSolar = formToTrueSolarTime(savedForm);
    const iSolar = formToTrueSolarTime(incomingForm);
    if (
      sSolar.hour !== iSolar.hour ||
      sSolar.minute !== iSolar.minute ||
      sSolar.branch !== iSolar.branch
    ) {
      const sShichen = VI_SHICHEN[sSolar.branch]?.name ?? 'Giờ Tý';
      const iShichen = VI_SHICHEN[iSolar.branch]?.name ?? 'Giờ Tý';
      diffs.push({
        field: 'trueSolarTime',
        labelVi: 'Chân Thái Dương Thời',
        savedValueVi: `${pad2Digits(sSolar.hour)}:${pad2Digits(sSolar.minute)} (${sShichen})`,
        incomingValueVi: `${pad2Digits(iSolar.hour)}:${pad2Digits(iSolar.minute)} (${iShichen})`,
        affectsChartStructure: !sameShichenBranch,
      });
    }
  }

  if (!sameShichenBranch) {
    diffs.push({
      field: 'shichenBranch',
      labelVi: 'Canh giờ an sao',
      savedValueVi: formatShichenViForDiff(sChart, savedForm),
      incomingValueVi: formatShichenViForDiff(iChart, incomingForm),
      affectsChartStructure: true,
    });
  }

  if (sChart.mingGongBranch !== iChart.mingGongBranch) {
    diffs.push({
      field: 'mingGongBranch',
      labelVi: 'Cung Mệnh an tại',
      savedValueVi: `Cung Mệnh tại ${VI_BRANCHES[sChart.mingGongBranch] ?? 'Tý'}`,
      incomingValueVi: `Cung Mệnh tại ${VI_BRANCHES[iChart.mingGongBranch] ?? 'Tý'}`,
      affectsChartStructure: true,
    });
  }

  if (Boolean(sChart.lunarInfo?.isLeapMonth) !== Boolean(iChart.lunarInfo?.isLeapMonth)) {
    diffs.push({
      field: 'lunarLeapMonth',
      labelVi: 'Tháng nhuận Âm lịch',
      savedValueVi: sChart.lunarInfo?.isLeapMonth ? 'Tháng nhuận (leap1)' : 'Tháng thường (leap0)',
      incomingValueVi: iChart.lunarInfo?.isLeapMonth ? 'Tháng nhuận (leap1)' : 'Tháng thường (leap0)',
      affectsChartStructure: true,
    });
  }

  if (savedForm.gender !== incomingForm.gender) {
    diffs.push({
      field: 'gender',
      labelVi: 'Giới tính',
      savedValueVi: savedForm.gender === 'male' ? 'Nam Mệnh' : 'Nữ Mệnh',
      incomingValueVi: incomingForm.gender === 'male' ? 'Nam Mệnh' : 'Nữ Mệnh',
      affectsChartStructure: true,
    });
  }

  // Bảo hiểm không rỗng khi hai khóa định danh 9 thành phần khác nhau
  const sKey = buildChartIdentityKey(sChart);
  const iKey = buildChartIdentityKey(iChart);
  if (diffs.length === 0 && sKey !== iKey) {
    const sParts = sKey.split('__');
    const iParts = iKey.split('__');
    const tokenDiffs: string[] = [];
    const maxLen = Math.max(sParts.length, iParts.length);
    for (let idx = 0; idx < maxLen; idx += 1) {
      if (sParts[idx] !== iParts[idx]) {
        tokenDiffs.push(`#${idx + 1}: ${sParts[idx] ?? '∅'} ↔ ${iParts[idx] ?? '∅'}`);
      }
    }
    diffs.push({
      field: 'name',
      labelVi: 'Khác biệt mã định danh',
      savedValueVi: tokenDiffs.length > 0 ? sParts.filter((_, i) => sParts[i] !== iParts[i]).join(' · ') : sKey,
      incomingValueVi: tokenDiffs.length > 0 ? iParts.filter((_, i) => sParts[i] !== iParts[i]).join(' · ') : iKey,
      affectsChartStructure: false,
    });
  }

  // DM-05: Đẩy các trường làm thay đổi cấu trúc 12 cung lên đầu bảng (ổn định theo thứ tự gốc)
  return diffs
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => {
      if (a.item.affectsChartStructure !== b.item.affectsChartStructure) {
        return a.item.affectsChartStructure ? -1 : 1;
      }
      return a.idx - b.idx;
    })
    .map((wrapped) => wrapped.item);
}

export function computeNearMatchSimilarityScore(
  entry: ChartLibraryEntry,
  incomingForm: Readonly<BirthFormState>,
  incomingFivePartKey: string,
  effectiveCompletedCount: number,
): number {
  const tier1SameFivePart = entry.legacyFivePartKey === incomingFivePartKey ? 1000 : 0;

  const foldedIncoming = foldVietnameseSearchText(incomingForm.name || '');
  const foldedSavedName = foldVietnameseSearchText(entry.form.name || '');
  const foldedSavedAlias = foldVietnameseSearchText(entry.customAlias || '');

  let tier2Identity = 0;
  if (
    foldedIncoming !== '' &&
    (foldedIncoming === foldedSavedName ||
      (foldedSavedAlias !== '' && foldedIncoming === foldedSavedAlias))
  ) {
    tier2Identity = 300;
  } else if (
    foldedIncoming === '' &&
    foldedSavedName === '' &&
    foldedSavedAlias === ''
  ) {
    tier2Identity = 150;
  }

  const tier3Pinned = entry.pinned ? 50 : 0;
  const clampedCompleted = Math.max(0, Math.min(8, Math.trunc(effectiveCompletedCount)));
  const tier4Chapters = clampedCompleted * 5;

  return tier1SameFivePart + tier2Identity + tier3Pinned + tier4Chapters;
}

export function detectChartDuplicateInLibrary(
  incomingRawForm: BirthFormState,
  options?: {
    entries?: readonly ChartLibraryEntry[];
    maxCandidates?: number;
    includeSameNameAndDate?: boolean;
  },
): ChartDuplicateDetectionResult {
  const { normalizedForm, chart, chartIdentityKey, legacyFivePartKey } =
    resolveChartAndIdentityFromForm(incomingRawForm);
  const entries = options?.entries ?? readLibraryIndexStore().entries;
  const currentHydration = hydrationStatus;

  const exactEntry = entries.find((e) => e.chartIdentityKey === chartIdentityKey);
  if (exactEntry) {
    const effectiveSummary = resolveEffectiveDossierSummaryForEntry(exactEntry, chart);
    return {
      kind: 'exact_match',
      incomingForm: normalizedForm,
      incomingChart: chart,
      incomingChartIdentityKey: chartIdentityKey,
      incomingFivePartKey: legacyFivePartKey,
      existingEntry: exactEntry,
      completedCount: effectiveSummary.completedCount,
      incompleteCount: effectiveSummary.incompleteCount,
      hydrationStatus: currentHydration,
    };
  }

  const includeSameNameAndDate = options?.includeSameNameAndDate !== false;
  const foldedIncomingName = foldVietnameseSearchText(normalizedForm.name || '');
  const allCandidates: NearMatchLibraryCandidate[] = [];

  for (const entry of entries) {
    if (entry.chartIdentityKey === chartIdentityKey) continue;

    const isSameFivePart = entry.legacyFivePartKey === legacyFivePartKey;
    const foldedSavedName = foldVietnameseSearchText(entry.form.name || '');
    const foldedSavedAlias = foldVietnameseSearchText(entry.customAlias || '');

    let matchReason: NearMatchLibraryCandidate['matchReason'] | null = null;
    if (isSameFivePart) {
      matchReason = 'same_five_part_key';
    } else if (includeSameNameAndDate) {
      const hasMeaningfulName =
        foldedIncomingName.length >= 2 && foldedIncomingName !== 'anon';
      const isNameOrAliasMatched =
        hasMeaningfulName &&
        (foldedIncomingName === foldedSavedName ||
          (foldedSavedAlias.length >= 2 && foldedIncomingName === foldedSavedAlias));
      const isSameSolarDate =
        Number(entry.form.year) === Number(normalizedForm.year) &&
        Number(entry.form.month) === Number(normalizedForm.month) &&
        Number(entry.form.day) === Number(normalizedForm.day);
      const isSameGender = entry.form.gender === normalizedForm.gender;
      const savedLon = entry.form.province ? (entry.form.longitude ?? 0) : 0;
      const incomingLon = normalizedForm.province ? (normalizedForm.longitude ?? 0) : 0;
      const hasTimeOrLongitudeVariation =
        Boolean(entry.form.unknownTime) !== Boolean(normalizedForm.unknownTime) ||
        Number(entry.form.clockHour) !== Number(normalizedForm.clockHour) ||
        Number(entry.form.clockMinute) !== Number(normalizedForm.clockMinute) ||
        Boolean(entry.form.province) !== Boolean(normalizedForm.province) ||
        Math.abs(savedLon - incomingLon) >= 0.005;

      if (
        isNameOrAliasMatched &&
        isSameSolarDate &&
        isSameGender &&
        hasTimeOrLongitudeVariation
      ) {
        matchReason = 'same_name_and_solar_date';
      }
    }

    if (!matchReason) continue;

    const savedChart = generateChart(formToBirthInfo(entry.form));
    const diffs = diffBirthFormsForDuplicateModal(
      entry.form,
      normalizedForm,
      savedChart,
      chart,
      { customAlias: entry.customAlias, notes: entry.notes },
    );
    const hasStructuralChartDiff = diffs.some((d) => d.affectsChartStructure);
    const effectiveSummary = resolveEffectiveDossierSummaryForEntry(entry, savedChart);
    const similarityScore = computeNearMatchSimilarityScore(
      entry,
      normalizedForm,
      legacyFivePartKey,
      effectiveSummary.completedCount,
    );

    allCandidates.push({
      entry,
      matchReason,
      matchReasonLabelVi:
        matchReason === 'same_five_part_key'
          ? 'Cùng Ngày · Canh giờ · Giới tính (cùng cấu trúc 12 cung)'
          : 'Cùng Họ tên/Biệt danh · Ngày sinh · Giới tính (khác giờ an sao)',
      diffs,
      hasStructuralChartDiff,
      effectiveCompletedCount: effectiveSummary.completedCount,
      effectiveIncompleteCount: effectiveSummary.incompleteCount,
      similarityScore,
    });
  }

  if (allCandidates.length === 0) {
    return {
      kind: 'none',
      incomingForm: normalizedForm,
      incomingChart: chart,
      incomingChartIdentityKey: chartIdentityKey,
      incomingFivePartKey: legacyFivePartKey,
      hydrationStatus: currentHydration,
    };
  }

  allCandidates.sort((a, b) => {
    if (a.similarityScore !== b.similarityScore) {
      return b.similarityScore - a.similarityScore;
    }
    if (a.entry.lastOpenedAt !== b.entry.lastOpenedAt) {
      return b.entry.lastOpenedAt - a.entry.lastOpenedAt;
    }
    return a.entry.chartIdentityKey.localeCompare(b.entry.chartIdentityKey);
  });

  const maxCandidates = Math.max(
    1,
    options?.maxCandidates ?? MAX_NEAR_MATCH_CANDIDATES,
  );
  return {
    kind: 'near_match',
    incomingForm: normalizedForm,
    incomingChart: chart,
    incomingChartIdentityKey: chartIdentityKey,
    incomingFivePartKey: legacyFivePartKey,
    candidates: allCandidates.slice(0, maxCandidates),
    totalCandidateCount: allCandidates.length,
    hydrationStatus: currentHydration,
  };
}

export function upsertChartToLibrary(
  form: BirthFormState,
  options: { nowMs?: number; syncLegacyMirror?: boolean } = {},
): {
  ok: boolean;
  entry: ChartLibraryEntry | null;
  evicted: EvictedBackupItem | null;
  error?: string;
} {
  const now = options.nowMs ?? Date.now();
  const { normalizedForm, chart, chartIdentityKey, legacyFivePartKey } =
    resolveChartAndIdentityFromForm(form);
  let store = readLibraryIndexStore();

  // Nếu trước đó có tombstone xóa vĩnh viễn và nay người dùng chủ động lập lại -> gỡ tombstone
  const nextTombstones = store.deletedTombstones.filter(
    (t) => t.chartIdentityKey !== chartIdentityKey,
  );
  store = { ...store, deletedTombstones: nextTombstones };

  const existing = store.entries.find((e) => e.chartIdentityKey === chartIdentityKey);
  const knownDossier = getBestKnownDossierSync(chartIdentityKey);
  const badge = buildLibraryDeterministicBadge(chart);

  if (existing) {
    const summary = knownDossier
      ? computeDossierSummary(knownDossier)
      : existing.dossierSummary;
    const updatedEntry: ChartLibraryEntry = {
      ...existing,
      deterministicBadge: badge,
      dossierSummary: summary,
      lastOpenedAt: now,
      updatedAt: Math.max(existing.updatedAt, summary.lastGeneratedAt ?? 0),
    };
    const nextEntries = [
      updatedEntry,
      ...store.entries.filter((e) => e.chartIdentityKey !== chartIdentityKey),
    ];
    writeLibraryIndexStore({ ...store, entries: nextEntries }, now);
    if (options.syncLegacyMirror !== false) syncLegacyHistoryMirror(normalizedForm);
    notifyLibraryListeners();
    return { ok: true, entry: updatedEntry, evicted: null };
  }

  const evRes = evictOneIfNeeded(store, chartIdentityKey);
  if (!evRes.ok) {
    return {
      ok: false,
      entry: null,
      evicted: null,
      error: evRes.blockedReason,
    };
  }
  store = evRes.store;

  const summary = computeDossierSummary(knownDossier);
  const createdEntry: ChartLibraryEntry = {
    chartIdentityKey,
    legacyFivePartKey,
    form: normalizedForm,
    customAlias: '',
    notes: '',
    pinned: false,
    pinnedAt: null,
    deterministicBadge: badge,
    dossierSummary: summary,
    createdAt: now,
    updatedAt: now,
    notesUpdatedAt: 0,
    lastOpenedAt: now,
  };

  writeLibraryIndexStore(
    {
      ...store,
      entries: [createdEntry, ...store.entries],
    },
    now,
  );
  if (options.syncLegacyMirror !== false) syncLegacyHistoryMirror(normalizedForm);
  notifyLibraryListeners();
  return { ok: true, entry: createdEntry, evicted: evRes.evicted };
}

export function markLibraryEntryOpened(chartIdentityKey: string, nowMs = Date.now()): void {
  const store = readLibraryIndexStore();
  const idx = store.entries.findIndex((e) => e.chartIdentityKey === chartIdentityKey);
  if (idx < 0) return;
  const updated = {
    ...store.entries[idx],
    lastOpenedAt: nowMs,
  };
  const nextEntries = [...store.entries];
  nextEntries[idx] = updated;
  writeLibraryIndexStore({ ...store, entries: nextEntries });
  notifyLibraryListeners();
}

export function togglePinLibraryEntry(
  chartIdentityKey: string,
  nowMs = Date.now(),
): { ok: boolean; pinned?: boolean; reason?: 'NOT_FOUND' | 'MAX_PINNED_REACHED' } {
  const store = readLibraryIndexStore();
  const idx = store.entries.findIndex((e) => e.chartIdentityKey === chartIdentityKey);
  if (idx < 0) return { ok: false, reason: 'NOT_FOUND' };

  const target = store.entries[idx];
  const nextPinned = !target.pinned;
  if (nextPinned) {
    const pinnedCount = store.entries.filter((e) => e.pinned).length;
    if (pinnedCount >= MAX_PINNED_ENTRIES) {
      return { ok: false, reason: 'MAX_PINNED_REACHED' };
    }
  }

  const nextEntries = [...store.entries];
  nextEntries[idx] = {
    ...target,
    pinned: nextPinned,
    pinnedAt: nextPinned ? nowMs : null,
    updatedAt: nowMs,
  };
  writeLibraryIndexStore({ ...store, entries: nextEntries });
  notifyLibraryListeners();
  return { ok: true, pinned: nextPinned };
}

export function updateLibraryEntryMeta(
  chartIdentityKey: string,
  patch: { customAlias?: string; notes?: string },
  nowMs = Date.now(),
): { ok: boolean; entry?: ChartLibraryEntry } {
  const store = readLibraryIndexStore();
  const idx = store.entries.findIndex((e) => e.chartIdentityKey === chartIdentityKey);
  if (idx < 0) return { ok: false };

  const target = store.entries[idx];
  const nextAlias =
    patch.customAlias !== undefined
      ? patch.customAlias.trim().slice(0, LIBRARY_MAX_ALIAS_CHARS)
      : target.customAlias;
  const nextNotes =
    patch.notes !== undefined
      ? patch.notes.slice(0, LIBRARY_MAX_NOTE_CHARS)
      : target.notes;

  const updated: ChartLibraryEntry = {
    ...target,
    customAlias: nextAlias,
    notes: nextNotes,
    updatedAt: nowMs,
    notesUpdatedAt: nowMs,
  };
  const nextEntries = [...store.entries];
  nextEntries[idx] = updated;
  writeLibraryIndexStore({ ...store, entries: nextEntries });
  notifyLibraryListeners();
  return { ok: true, entry: updated };
}

function removeKeyFromLegacyHistory(chartIdentityKey: string): void {
  const ls = resolveLocalStorage();
  if (!ls) return;
  try {
    const raw = ls.getItem(LEGACY_HISTORY_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    const filtered = parsed.filter((item) => {
      if (!item || !isReasonableBirthForm((item as LegacyHistoryEntryShape).form)) {
        return true;
      }
      try {
        return (
          resolveChartAndIdentityFromForm((item as LegacyHistoryEntryShape).form)
            .chartIdentityKey !== chartIdentityKey
        );
      } catch {
        return true;
      }
    });
    if (filtered.length !== parsed.length) {
      ls.setItem(LEGACY_HISTORY_STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch {
    // ignore legacy history cleanup error
  }
}

export function removeLibraryEntry(
  chartIdentityKey: string,
  options: { deleteMode: 'dossier_only' | 'entry_and_dossier'; nowMs?: number } = {
    deleteMode: 'entry_and_dossier',
  },
): { ok: boolean } {
  const now = options.nowMs ?? Date.now();
  const store = readLibraryIndexStore();
  const idx = store.entries.findIndex((e) => e.chartIdentityKey === chartIdentityKey);

  // Xóa dữ liệu hồ sơ ở mọi tầng
  inMemoryDossierMirror.delete(chartIdentityKey);
  removeHotDossierFromLocalStorage(chartIdentityKey);
  removeSessionMirrorDossier(chartIdentityKey);

  if (hydrationStatus === 'hydrating') {
    pendingDossierMutations.delete(chartIdentityKey);
    pendingDossierDeletes.add(chartIdentityKey);
  } else if (storageHealth.indexedDbAvailable) {
    void runtimeIdbAdapter.delete(chartIdentityKey).catch(() => {});
  }

  if (options.deleteMode === 'dossier_only') {
    if (idx < 0) return { ok: false };
    const nextEntries = [...store.entries];
    nextEntries[idx] = {
      ...nextEntries[idx],
      dossierSummary: createEmptyDossierSummary(),
      updatedAt: now,
    };
    writeLibraryIndexStore({ ...store, entries: nextEntries }, now);
    notifyLibraryListeners();
    return { ok: true };
  }

  // entry_and_dossier: xóa thẻ + dọn khỏi ziwei_history (LK-05) + ghi nhận tombstone chống hồi sinh
  removeKeyFromLegacyHistory(chartIdentityKey);
  const nextEntries = store.entries.filter(
    (e) => e.chartIdentityKey !== chartIdentityKey,
  );
  const nextTombstones = pruneTombstones(
    [{ chartIdentityKey, deletedAt: now }, ...store.deletedTombstones],
    now,
  );
  writeLibraryIndexStore(
    {
      ...store,
      entries: nextEntries,
      deletedTombstones: nextTombstones,
    },
    now,
  );
  notifyLibraryListeners();
  return { ok: true };
}

/**
 * QĐ-L8 (Phương án B tăng cường C1+): Xóa riêng 1 chương đơn lẻ khỏi cả 4 tầng lưu trữ
 * và cập nhật dossierSummary; trả về previousRecord để giao diện hoàn tác trong phiên.
 */
export function removeSingleDossierChapterFromLibrary(
  chart: ZiweiChart,
  chapterId: DossierChapterId,
  nowMs = Date.now(),
): { ok: boolean; previousRecord: StoredDossierRecord | null } {
  const chartIdentityKey = buildChartIdentityKey(chart);
  const existingRecord = getBestKnownDossierSync(chartIdentityKey);
  if (!existingRecord || !existingRecord.sections || !existingRecord.sections[chapterId]) {
    return { ok: false, previousRecord: null };
  }

  const previousRecord = JSON.parse(JSON.stringify(existingRecord)) as StoredDossierRecord;
  const nextSections: StoredDossierRecord['sections'] = { ...existingRecord.sections };
  delete nextSections[chapterId];

  const hasRemaining = Object.keys(nextSections).length > 0;
  const nextRecord: StoredDossierRecord | null = hasRemaining
    ? {
        chartIdentityKey,
        updatedAt: nowMs,
        sections: nextSections,
      }
    : null;

  if (!nextRecord) {
    inMemoryDossierMirror.delete(chartIdentityKey);
    removeHotDossierFromLocalStorage(chartIdentityKey);
    removeSessionMirrorDossier(chartIdentityKey);
    if (hydrationStatus === 'hydrating') {
      pendingDossierMutations.delete(chartIdentityKey);
      pendingDossierDeletes.add(chartIdentityKey);
    } else if (storageHealth.indexedDbAvailable) {
      void runtimeIdbAdapter.delete(chartIdentityKey).catch(() => {});
    }
  } else {
    persistDossierToTargets(nextRecord, chart);
  }

  const store = readLibraryIndexStore();
  const idx = store.entries.findIndex((e) => e.chartIdentityKey === chartIdentityKey);
  if (idx >= 0) {
    const nextEntries = [...store.entries];
    nextEntries[idx] = {
      ...nextEntries[idx],
      dossierSummary: computeDossierSummary(nextRecord),
      updatedAt: Math.max(nextEntries[idx].updatedAt, nowMs),
    };
    writeLibraryIndexStore({ ...store, entries: nextEntries }, nowMs);
  }

  notifyLibraryListeners();
  return { ok: true, previousRecord };
}

/**
 * ĐC-1 + ĐC-3: Đọc trạng thái hồ sơ có phân biệt rõ 'đang nạp IndexedDB' vs 'không có hồ sơ'.
 */
export function getDossierReadState(
  chartIdentityKey: string,
  chart?: ZiweiChart,
): DossierReadState {
  const isHydrated = hydrationStatus === 'ready' || hydrationStatus === 'degraded';

  // ĐC-3: Gương RAM (phản chiếu IndexedDB) là Nguồn Sự Thật Duy Nhất (SSOT)
  const fromRam = inMemoryDossierMirror.get(chartIdentityKey);
  if (fromRam) {
    return {
      hydrationStatus,
      isHydrated,
      record: sanitizeFullDossierRecord(fromRam, chartIdentityKey, chart),
      source: 'ram_ssot',
    };
  }

  const fromHot = readHotDossierFromLocalStorage(chartIdentityKey);
  if (fromHot) {
    return {
      hydrationStatus,
      isHydrated,
      record: sanitizeFullDossierRecord(fromHot, chartIdentityKey, chart),
      source: 'hot_fallback',
    };
  }

  const ss = resolveSessionStorage();
  if (ss) {
    try {
      const raw = ss.getItem(buildDossierStorageKey(chartIdentityKey));
      if (raw) {
        const parsed = JSON.parse(raw) as StoredDossierRecord;
        if (
          parsed &&
          parsed.sections &&
          (!parsed.chartIdentityKey || parsed.chartIdentityKey === chartIdentityKey)
        ) {
          return {
            hydrationStatus,
            isHydrated,
            record: sanitizeFullDossierRecord(parsed, chartIdentityKey, chart),
            source: 'session_fallback',
          };
        }
      }
    } catch {
      // ignore
    }
  }

  return {
    hydrationStatus,
    isHydrated,
    record: null,
    source: 'none',
  };
}

export function saveDossierSectionToLibrary(
  chart: ZiweiChart,
  chapterId: DossierChapterId,
  chapterState: DossierChapterState,
): boolean {
  const isCompleted =
    chapterState.status === 'completed' && Boolean(chapterState.text?.trim());
  const isIncomplete =
    chapterState.status === 'incomplete' &&
    Boolean(chapterState.incompleteText?.trim());
  if (!isCompleted && !isIncomplete) return false;

  const chartIdentityKey = buildChartIdentityKey(chart);
  const existingRecord =
    inMemoryDossierMirror.get(chartIdentityKey) ??
    pendingDossierMutations.get(chartIdentityKey) ??
    readHotDossierFromLocalStorage(chartIdentityKey);

  const sanitizedText = isCompleted
    ? sanitizeDossierChapterText(chapterState.text, chapterId, chart) ??
      chapterState.text
    : undefined;
  const sanitizedIncomplete = isIncomplete
    ? sanitizeDossierChapterText(chapterState.incompleteText, chapterId, chart, {
        skipPeriodSiHuaCheck: true,
      }) ?? chapterState.incompleteText
    : undefined;

  const now = chapterState.updatedAt ?? Date.now();
  const nextChapter: DossierChapterState = {
    ...chapterState,
    chapterId,
    sectionCacheKey: `${chartIdentityKey}::${chapterId}`,
    text: sanitizedText,
    incompleteText: sanitizedIncomplete,
    updatedAt: now,
  };

  const nextRecord: StoredDossierRecord = {
    chartIdentityKey,
    updatedAt: now,
    sections: {
      ...(existingRecord?.sections ?? {}),
      [chapterId]: nextChapter,
    },
  };

  persistDossierToTargets(nextRecord, chart);

  // Cập nhật dossierSummary trong chỉ mục Thư Viện nếu đã tồn tại mục tương ứng
  const store = readLibraryIndexStore();
  const idx = store.entries.findIndex((e) => e.chartIdentityKey === chartIdentityKey);
  if (idx >= 0) {
    const updatedSummary = computeDossierSummary(nextRecord);
    const nextEntries = [...store.entries];
    nextEntries[idx] = {
      ...nextEntries[idx],
      dossierSummary: updatedSummary,
      updatedAt: Math.max(nextEntries[idx].updatedAt, now),
    };
    writeLibraryIndexStore({ ...store, entries: nextEntries });
  }

  notifyLibraryListeners();
  return true;
}

const chartLibraryDossierBridge = {
  readAuthoritativeDossier(chartIdentityKey: string): StoredDossierRecord | null {
    // ĐC-3: IndexedDB / gương RAM là SSOT; nếu chưa có trong RAM thì fallback sang hot cache
    const fromRam = inMemoryDossierMirror.get(chartIdentityKey);
    if (fromRam) return fromRam;
    return readHotDossierFromLocalStorage(chartIdentityKey);
  },
  writeThroughDossierSection(
    chart: ZiweiChart,
    chapterId: DossierChapterId,
    chapterState: DossierChapterState,
  ): void {
    saveDossierSectionToLibrary(chart, chapterId, chapterState);
  },
};

// Đăng ký bridge ngay khi module được nạp
registerAuthoritativeDossierBridge(chartLibraryDossierBridge);

/**
 * PL-11: Tự động nạp Chương 5 (year_2026) & Chương 6 (year_2027) từ Hồ Sơ bền vững
 * vào state aiPeriodCache của App khi người dùng mở lá số.
 */
export function buildPeriodCachePatchesFromLibrary(
  chart: ZiweiChart,
): Record<string, AiPeriodEntry> {
  const key = buildChartIdentityKey(chart);
  const readState = getDossierReadState(key, chart);
  const record = readState.record;
  if (!record || !record.sections) return {};

  const patches: Record<string, AiPeriodEntry> = {};
  for (const [chapterId, yr] of [
    ['year_2026', 2026],
    ['year_2027', 2027],
  ] as const) {
    const sec = record.sections[chapterId];
    if (!sec) continue;
    const periodKey = buildPeriodCacheKeyForYear(chart, yr);
    if (sec.status === 'completed' && sec.text?.trim()) {
      patches[periodKey] = {
        text: sec.text,
        meta: sec.meta,
        ...(sec.auditFlags?.length ? { auditFlags: sec.auditFlags } : {}),
      };
    } else if (sec.status === 'incomplete' && sec.incompleteText?.trim()) {
      patches[periodKey] = {
        incomplete: true,
        incompleteText: sec.incompleteText,
        interruptedReason: sec.interruptedReason,
        meta: sec.meta,
        error: sec.error,
        ...(sec.auditFlags?.length ? { auditFlags: sec.auditFlags } : {}),
      };
    }
  }
  return patches;
}

// ─── 11. XUẤT / NHẬP FILE .JSON & THUẬT TOÁN HỢP NHẤT (PL-02 & PL-12) ────────

export async function exportLibraryBundle(options?: {
  onlyChartIdentityKey?: string;
  appVersion?: string;
}): Promise<ChartLibraryExportBundle> {
  if (hydrationStatus === 'idle' || hydrationStatus === 'hydrating') {
    await initChartLibrary();
  }
  const store = readLibraryIndexStore();
  const targetEntries = options?.onlyChartIdentityKey
    ? store.entries.filter((e) => e.chartIdentityKey === options.onlyChartIdentityKey)
    : store.entries;

  const dossiers: Record<string, StoredDossierRecord> = {};
  for (const entry of targetEntries) {
    let rec = getBestKnownDossierSync(entry.chartIdentityKey);
    if (!rec && storageHealth.indexedDbAvailable) {
      rec = await runtimeIdbAdapter.get(entry.chartIdentityKey).catch(() => null);
    }
    if (rec) {
      dossiers[entry.chartIdentityKey] = rec;
    }
  }

  const now = Date.now();
  return {
    bundleType: 'tu-vi-thien-ky-chart-library',
    schemaVersion: CHART_LIBRARY_SCHEMA_VERSION,
    appVersion: options?.appVersion ?? '1.2.0-rc.2',
    exportedAt: now,
    exportedAtIso: new Date(now).toISOString(),
    entries: targetEntries,
    dossiers,
    deletedTombstones: options?.onlyChartIdentityKey ? [] : store.deletedTombstones,
  };
}

function mergeLibraryEntryFields(
  localEntry: ChartLibraryEntry,
  incomingEntry: ChartLibraryEntry,
  mergedDossier: StoredDossierRecord | null,
): ChartLibraryEntry {
  const localNoteTime = localEntry.notesUpdatedAt || 0;
  const incNoteTime = incomingEntry.notesUpdatedAt || 0;

  let mergedAlias = localEntry.customAlias;
  if (incNoteTime > localNoteTime && incomingEntry.customAlias.trim()) {
    mergedAlias = incomingEntry.customAlias;
  } else if (!mergedAlias.trim() && incomingEntry.customAlias.trim()) {
    mergedAlias = incomingEntry.customAlias;
  }

  let mergedNotes = localEntry.notes;
  const locTrim = localEntry.notes.trim();
  const incTrim = incomingEntry.notes.trim();
  if (locTrim === incTrim) {
    mergedNotes = localEntry.notes;
  } else if (!locTrim) {
    mergedNotes = incomingEntry.notes;
  } else if (!incTrim) {
    mergedNotes = localEntry.notes;
  } else if (incNoteTime > localNoteTime) {
    mergedNotes = incomingEntry.notes;
  } else if (localNoteTime > incNoteTime) {
    mergedNotes = localEntry.notes;
  } else {
    mergedNotes = `${localEntry.notes}\n---\n${incomingEntry.notes}`.slice(
      0,
      LIBRARY_MAX_NOTE_CHARS,
    );
  }

  const summary = mergedDossier
    ? computeDossierSummary(mergedDossier)
    : localEntry.dossierSummary.completedCount >= incomingEntry.dossierSummary.completedCount
      ? localEntry.dossierSummary
      : incomingEntry.dossierSummary;

  return {
    ...localEntry,
    customAlias: mergedAlias.slice(0, LIBRARY_MAX_ALIAS_CHARS),
    notes: mergedNotes.slice(0, LIBRARY_MAX_NOTE_CHARS),
    pinned: localEntry.pinned || incomingEntry.pinned,
    pinnedAt: localEntry.pinned
      ? localEntry.pinnedAt
      : incomingEntry.pinned
        ? incomingEntry.pinnedAt
        : null,
    dossierSummary: summary,
    createdAt: Math.min(localEntry.createdAt, incomingEntry.createdAt),
    updatedAt: Math.max(localEntry.updatedAt, incomingEntry.updatedAt, summary.lastGeneratedAt ?? 0),
    notesUpdatedAt: Math.max(localNoteTime, incNoteTime),
    lastOpenedAt: Math.max(localEntry.lastOpenedAt, incomingEntry.lastOpenedAt),
  };
}

export async function importLibraryBundleWithMerge(
  rawBundle: unknown,
  options: { mode: 'smart_merge' | 'force_restore_all'; nowMs?: number } = {
    mode: 'smart_merge',
  },
): Promise<ImportMergeResult> {
  if (hydrationStatus === 'idle' || hydrationStatus === 'hydrating') {
    await initChartLibrary();
  }

  if (!rawBundle || typeof rawBundle !== 'object') {
    return {
      ok: false,
      error: 'Tệp JSON không đúng định dạng đối tượng.',
      addedEntries: 0,
      updatedEntries: 0,
      mergedCompletedChapters: 0,
      skippedInvalidCount: 0,
      skippedTombstonedCount: 0,
    };
  }

  const bundle = rawBundle as Partial<ChartLibraryExportBundle>;
  if (
    bundle.bundleType !== 'tu-vi-thien-ky-chart-library' ||
    !Array.isArray(bundle.entries)
  ) {
    return {
      ok: false,
      error: 'Tệp JSON không phải gói sao lưu Thư Viện Tử Vi Thiên Kỷ hợp lệ.',
      addedEntries: 0,
      updatedEntries: 0,
      mergedCompletedChapters: 0,
      skippedInvalidCount: 0,
      skippedTombstonedCount: 0,
    };
  }

  const now = options.nowMs ?? Date.now();
  let store = readLibraryIndexStore();
  let addedEntries = 0;
  let updatedEntries = 0;
  let mergedCompletedChapters = 0;
  let skippedInvalidCount = 0;
  let skippedTombstonedCount = 0;

  // Bước 2: Hợp nhất Sổ cái Xóa (deletedTombstones)
  const tombstoneMap = new Map<string, number>();
  for (const t of store.deletedTombstones) {
    if (t && typeof t.chartIdentityKey === 'string' && typeof t.deletedAt === 'number') {
      tombstoneMap.set(t.chartIdentityKey, t.deletedAt);
    }
  }

  if (options.mode === 'smart_merge' && Array.isArray(bundle.deletedTombstones)) {
    for (const t of bundle.deletedTombstones) {
      if (!t || typeof t.chartIdentityKey !== 'string' || typeof t.deletedAt !== 'number') {
        continue;
      }
      const prev = tombstoneMap.get(t.chartIdentityKey) ?? 0;
      if (t.deletedAt > prev) tombstoneMap.set(t.chartIdentityKey, t.deletedAt);
    }
  }

  const entryMap = new Map<string, ChartLibraryEntry>(
    store.entries.map((e) => [e.chartIdentityKey, e]),
  );

  // Áp dụng tombstone cho mục đang có tại máy nếu chế độ là smart_merge
  if (options.mode === 'smart_merge') {
    for (const [key, delAt] of tombstoneMap.entries()) {
      const loc = entryMap.get(key);
      if (loc && delAt >= loc.updatedAt) {
        entryMap.delete(key);
        inMemoryDossierMirror.delete(key);
        removeHotDossierFromLocalStorage(key);
        removeSessionMirrorDossier(key);
        if (storageHealth.indexedDbAvailable) {
          void runtimeIdbAdapter.delete(key).catch(() => {});
        }
      }
    }
  }

  for (const rawEntry of bundle.entries) {
    if (!rawEntry || !isReasonableBirthForm(rawEntry.form)) {
      skippedInvalidCount += 1;
      continue;
    }

    const { normalizedForm, chart, chartIdentityKey, legacyFivePartKey } =
      resolveChartAndIdentityFromForm(rawEntry.form);

    if (options.mode === 'force_restore_all') {
      tombstoneMap.delete(chartIdentityKey);
    }

    const tombAt = tombstoneMap.get(chartIdentityKey);
    const incUpdatedAt =
      typeof rawEntry.updatedAt === 'number' && Number.isFinite(rawEntry.updatedAt)
        ? rawEntry.updatedAt
        : now;

    // Bước 3: Chặn hồi sinh nếu tombstone mới hơn bản ghi nhập vào
    if (options.mode === 'smart_merge' && tombAt !== undefined && tombAt >= incUpdatedAt) {
      skippedTombstonedCount += 1;
      continue;
    }

    const rawDossier =
      bundle.dossiers?.[rawEntry.chartIdentityKey] ??
      bundle.dossiers?.[chartIdentityKey] ??
      null;

    const existingEntry = entryMap.get(chartIdentityKey);
    const existingDossier = getBestKnownDossierSync(chartIdentityKey);
    const prevCompletedCount = existingDossier
      ? computeDossierSummary(existingDossier).completedCount
      : 0;

    // Bước 4: Hợp nhất đơn điệu từng chương & làm sạch lớp 3A + 3B (PL-12)
    const mergedDossier = mergeDossierRecords(
      chartIdentityKey,
      existingDossier,
      rawDossier,
      chart,
    );

    if (mergedDossier) {
      persistDossierToTargets(mergedDossier, chart);
      const nextCompletedCount = computeDossierSummary(mergedDossier).completedCount;
      if (nextCompletedCount > prevCompletedCount) {
        mergedCompletedChapters += nextCompletedCount - prevCompletedCount;
      }
    }

    const sanitizedIncoming: ChartLibraryEntry = {
      chartIdentityKey,
      legacyFivePartKey,
      form: normalizedForm,
      customAlias:
        typeof rawEntry.customAlias === 'string'
          ? rawEntry.customAlias.trim().slice(0, LIBRARY_MAX_ALIAS_CHARS)
          : '',
      notes:
        typeof rawEntry.notes === 'string'
          ? rawEntry.notes.slice(0, LIBRARY_MAX_NOTE_CHARS)
          : '',
      pinned: Boolean(rawEntry.pinned),
      pinnedAt: rawEntry.pinned
        ? typeof rawEntry.pinnedAt === 'number'
          ? rawEntry.pinnedAt
          : now
        : null,
      deterministicBadge: buildLibraryDeterministicBadge(chart),
      dossierSummary: computeDossierSummary(mergedDossier),
      createdAt:
        typeof rawEntry.createdAt === 'number' ? rawEntry.createdAt : now,
      updatedAt: incUpdatedAt,
      notesUpdatedAt:
        typeof rawEntry.notesUpdatedAt === 'number' ? rawEntry.notesUpdatedAt : 0,
      lastOpenedAt:
        typeof rawEntry.lastOpenedAt === 'number' ? rawEntry.lastOpenedAt : now,
    };

    if (existingEntry) {
      entryMap.set(
        chartIdentityKey,
        mergeLibraryEntryFields(existingEntry, sanitizedIncoming, mergedDossier),
      );
      updatedEntries += 1;
    } else {
      // Bảo đảm trần 30 ghim khi nhập
      const currentPinnedCount = Array.from(entryMap.values()).filter((e) => e.pinned).length;
      if (sanitizedIncoming.pinned && currentPinnedCount >= MAX_PINNED_ENTRIES) {
        sanitizedIncoming.pinned = false;
        sanitizedIncoming.pinnedAt = null;
      }
      entryMap.set(chartIdentityKey, sanitizedIncoming);
      addedEntries += 1;
    }
  }

  // Giới hạn lại ở MAX_LIBRARY_ENTRIES bằng thang thu hồi an toàn nếu tổng sau gộp > 100
  let finalStore: ChartLibraryIndexStore = {
    schemaVersion: CHART_LIBRARY_SCHEMA_VERSION,
    updatedAt: now,
    entries: Array.from(entryMap.values()),
    deletedTombstones: pruneTombstones(
      Array.from(tombstoneMap.entries()).map(([chartIdentityKey, deletedAt]) => ({
        chartIdentityKey,
        deletedAt,
      })),
      now,
    ),
  };

  while (finalStore.entries.length > MAX_LIBRARY_ENTRIES) {
    const picked = selectEvictionCandidate(finalStore.entries);
    if (!picked) break;
    const { candidate, tier } = picked;
    const candidateDossier = getBestKnownDossierSync(candidate.chartIdentityKey);
    const candidateSummary = candidateDossier
      ? computeDossierSummary(candidateDossier)
      : candidate.dossierSummary;
    if (tier >= 3 || candidateSummary.completedCount > 0) {
      const dl = autoDownloadEvictedEntryWithDossier(candidate, candidateDossier);
      if (!dl.ok) break;
      lastEvictedBackupItem = {
        entry: candidate,
        dossier: candidateDossier,
        evictedAt: Date.now(),
        tier,
        autoBackupTriggered: true,
        autoBackupFilename: dl.filename,
      };
    }
    inMemoryDossierMirror.delete(candidate.chartIdentityKey);
    removeHotDossierFromLocalStorage(candidate.chartIdentityKey);
    removeSessionMirrorDossier(candidate.chartIdentityKey);
    if (storageHealth.indexedDbAvailable) {
      void runtimeIdbAdapter.delete(candidate.chartIdentityKey).catch(() => {});
    }
    finalStore = {
      ...finalStore,
      entries: finalStore.entries.filter(
        (e) => e.chartIdentityKey !== candidate.chartIdentityKey,
      ),
    };
  }

  writeLibraryIndexStore(finalStore, now);
  notifyLibraryListeners();

  return {
    ok: true,
    addedEntries,
    updatedEntries,
    mergedCompletedChapters,
    skippedInvalidCount,
    skippedTombstonedCount,
  };
}

// ─── 12. TÌM KIẾM, LỌC & SẮP XẾP THƯ VIỆN ────────────────────────────────────

export type LibraryFilterMode =
  | 'all'
  | 'pinned'
  | 'has_dossier'
  | 'complete_dossier'
  | 'has_notes';

export type LibrarySortMode =
  | 'last_opened'
  | 'dossier_updated'
  | 'created'
  | 'name_asc';

export function foldVietnameseSearchText(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function filterAndSortLibraryEntries(
  entries: readonly ChartLibraryEntry[],
  options: {
    query?: string;
    filter?: LibraryFilterMode;
    sort?: LibrarySortMode;
  } = {},
): ChartLibraryEntry[] {
  const q = foldVietnameseSearchText(options.query ?? '');
  const filter = options.filter ?? 'all';
  const sort = options.sort ?? 'last_opened';

  const filtered = entries.filter((entry) => {
    if (filter === 'pinned' && !entry.pinned) return false;
    if (filter === 'has_dossier' && entry.dossierSummary.completedCount === 0) return false;
    if (filter === 'complete_dossier' && entry.dossierSummary.completedCount < 8) return false;
    if (filter === 'has_notes' && !entry.notes.trim()) return false;

    if (!q) return true;
    const haystack = foldVietnameseSearchText(
      [
        entry.form.name,
        entry.customAlias,
        entry.notes,
        entry.form.year,
        entry.form.city,
        entry.form.province,
        entry.deterministicBadge.solarDateStr,
        entry.deterministicBadge.yearCanZhiVi,
        entry.deterministicBadge.mingMajorStarsVi,
        entry.deterministicBadge.wuxingJuVi,
      ].join(' '),
    );
    return haystack.includes(q);
  });

  return [...filtered].sort((a, b) => {
    // Luôn ưu tiên nhóm Đã ghim lên đầu
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

    switch (sort) {
      case 'dossier_updated': {
        const ta = a.dossierSummary.lastGeneratedAt ?? 0;
        const tb = b.dossierSummary.lastGeneratedAt ?? 0;
        if (tb !== ta) return tb - ta;
        return b.lastOpenedAt - a.lastOpenedAt;
      }
      case 'created':
        return b.createdAt - a.createdAt;
      case 'name_asc': {
        const na = (a.customAlias || a.form.name || '').trim();
        const nb = (b.customAlias || b.form.name || '').trim();
        return na.localeCompare(nb, 'vi');
      }
      case 'last_opened':
      default:
        return b.lastOpenedAt - a.lastOpenedAt;
    }
  });
}

// ─── 13. REACT HOOK CHÍNH CHO GIAO DIỆN (useChartLibrary) ──────────────────────

export function useChartLibrary(currentForm?: BirthFormState | null) {
  const [entries, setEntries] = useState<ChartLibraryEntry[]>(
    () => readLibraryIndexStore().entries,
  );
  const [hStatus, setHStatus] = useState<LibraryHydrationStatus>(
    () => getLibraryHydrationStatus(),
  );
  const [health, setHealth] = useState<LibraryStorageHealth>(
    () => getLibraryStorageHealth(),
  );
  const [evictedBanner, setEvictedBanner] = useState<EvictedBackupItem | null>(
    () => getLastEvictedBackupItem(),
  );

  const syncSnapshot = useCallback(() => {
    setEntries(readLibraryIndexStore().entries);
    setHStatus(getLibraryHydrationStatus());
    setHealth(getLibraryStorageHealth());
    setEvictedBanner(getLastEvictedBackupItem());
  }, []);

  useEffect(() => {
    const unsub = subscribeChartLibrary(syncSnapshot);
    void initChartLibrary(currentForm).then(() => {
      syncSnapshot();
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncSnapshot]);

  const saveChart = useCallback((form: BirthFormState) => {
    return upsertChartToLibrary(form);
  }, []);

  const togglePin = useCallback((chartIdentityKey: string) => {
    return togglePinLibraryEntry(chartIdentityKey);
  }, []);

  const updateMeta = useCallback(
    (chartIdentityKey: string, patch: { customAlias?: string; notes?: string }) => {
      return updateLibraryEntryMeta(chartIdentityKey, patch);
    },
    [],
  );

  const removeEntry = useCallback(
    (
      chartIdentityKey: string,
      deleteMode: 'dossier_only' | 'entry_and_dossier' = 'entry_and_dossier',
    ) => {
      return removeLibraryEntry(chartIdentityKey, { deleteMode });
    },
    [],
  );

  const undoEviction = useCallback(() => {
    return undoLastEviction();
  }, []);

  const dismissEviction = useCallback(() => {
    dismissEvictionBackupBanner();
  }, []);

  return {
    entries,
    hydrationStatus: hStatus,
    storageHealth: health,
    lastEvictedBackup: evictedBanner,
    saveChart,
    togglePin,
    updateMeta,
    removeEntry,
    undoEviction,
    dismissEviction,
    refreshFromStore: syncSnapshot,
  };
}
