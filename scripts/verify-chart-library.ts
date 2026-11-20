import assert from 'node:assert/strict';
import { generateChart } from '../src/lib/ziwei/algorithm';
import { formToBirthInfo } from '../src/lib/ziwei/share';
import type { BirthFormState } from '../src/lib/ziwei/types';
import {
  DOSSIER_CHAPTER_SPECS,
  buildChartIdentityKey,
  buildDossierStorageKey,
  readDossierCacheEntry,
  resolveDossierChapterFromCaches,
  saveDossierSectionToCache,
  type DossierChapterId,
  type DossierChapterState,
  type StoredDossierRecord,
} from '../src/lib/dossier-chat-ui';
import {
  CHART_LIBRARY_SCHEMA_VERSION,
  HOT_DOSSIER_STORAGE_PREFIX,
  LEGACY_HISTORY_STORAGE_KEY,
  LIBRARY_INDEX_STORAGE_KEY,
  MAX_HOT_DOSSIERS_LOCALSTORAGE,
  MAX_LIBRARY_ENTRIES,
  MAX_NEAR_MATCH_CANDIDATES,
  MAX_PINNED_ENTRIES,
  buildPeriodCachePatchesFromLibrary,
  computeNearMatchSimilarityScore,
  configureChartLibraryRuntimeForTest,
  detectChartDuplicateInLibrary,
  diffBirthFormsForDuplicateModal,
  exportLibraryBundle,
  filterAndSortLibraryEntries,
  getDossierReadState,
  getLastEvictedBackupItem,
  getLibraryHydrationStatus,
  getLibraryStorageHealth,
  importLibraryBundleWithMerge,
  initChartLibrary,
  markLibraryEntryOpened,
  migrateLegacyHistoryAndDossiers,
  normalizeBirthFormForLibrary,
  readLibraryIndexStore,
  removeLibraryEntry,
  removeSingleDossierChapterFromLibrary,
  resolveEffectiveDossierSummaryForEntry,
  saveDossierSectionToLibrary,
  togglePinLibraryEntry,
  undoLastEviction,
  updateLibraryEntryMeta,
  upsertChartToLibrary,
  type ChartLibraryEntry,
  type ChartLibraryExportBundle,
  type DossierPersistenceAdapter,
  type StorageWithOptionalKeys,
} from '../src/lib/chart-library';

class MockStorage implements StorageWithOptionalKeys {
  private map = new Map<string, string>();
  constructor(private readonly maxTotalChars = Infinity) {}

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    let nextChars = value.length;
    for (const [k, v] of this.map.entries()) {
      if (k !== key) nextChars += v.length;
    }
    if (nextChars > this.maxTotalChars) {
      throw new Error('QuotaExceededError');
    }
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  keys(): string[] {
    return Array.from(this.map.keys());
  }

  getTotalChars(): number {
    let sum = 0;
    for (const v of this.map.values()) sum += v.length;
    return sum;
  }
}

class MockIndexedDbAdapter implements DossierPersistenceAdapter {
  public records = new Map<string, StoredDossierRecord>();
  public available = true;
  public unavailableReason: string | null = null;
  public gatePromise: Promise<void> | null = null;

  async isAvailable(): Promise<{ ok: boolean; reason: string | null }> {
    if (!this.available) {
      return {
        ok: false,
        reason: this.unavailableReason ?? 'SecurityError: IndexedDB bị chặn',
      };
    }
    return { ok: true, reason: null };
  }

  async get(chartIdentityKey: string): Promise<StoredDossierRecord | null> {
    if (!this.available) throw new Error('IndexedDB unavailable');
    if (this.gatePromise) await this.gatePromise;
    return this.records.get(chartIdentityKey) ?? null;
  }

  async getAll(): Promise<StoredDossierRecord[]> {
    if (!this.available) throw new Error('IndexedDB unavailable');
    if (this.gatePromise) await this.gatePromise;
    return Array.from(this.records.values());
  }

  async put(record: StoredDossierRecord): Promise<void> {
    if (!this.available) throw new Error('IndexedDB unavailable');
    if (this.gatePromise) await this.gatePromise;
    this.records.set(record.chartIdentityKey, JSON.parse(JSON.stringify(record)));
  }

  async delete(chartIdentityKey: string): Promise<void> {
    if (!this.available) throw new Error('IndexedDB unavailable');
    this.records.delete(chartIdentityKey);
  }
}

function makeForm(overrides: Partial<BirthFormState> = {}): BirthFormState {
  return {
    name: 'Nguyễn Văn An',
    year: '1995',
    month: '8',
    day: '16',
    clockHour: '10',
    clockMinute: '30',
    unknownTime: false,
    province: 'Việt Nam — Miền Bắc',
    city: 'Hà Nội',
    longitude: 105.85,
    gender: 'male',
    ...overrides,
  };
}

function makeChapter(
  chartIdentityKey: string,
  chapterId: DossierChapterId,
  text: string,
  updatedAt: number,
  modelUsed = 'gemini-3.5-flash-lite',
): DossierChapterState {
  return {
    chapterId,
    sectionCacheKey: `${chartIdentityKey}::${chapterId}`,
    status: 'completed',
    text,
    sourceBadge: 'Sinh mới trong hồ sơ',
    updatedAt,
    meta: {
      keyId: 'k_test',
      maskedKey: 'AIzaSy••••••1234',
      label: 'Test Key',
      modelUsed,
      usedFallbackModel: false,
      failoverAttempts: 1,
      latencyMs: 900,
    },
  };
}

function setupFreshTestEnv(options: {
  lsMaxChars?: number;
  idbAvailable?: boolean;
  autoBackupHook?: ((bundle: ChartLibraryExportBundle, entry: ChartLibraryEntry, filename: string) => boolean) | null;
} = {}) {
  const ls = new MockStorage(options.lsMaxChars ?? Infinity);
  const ss = new MockStorage();
  const idb = new MockIndexedDbAdapter();
  if (options.idbAvailable === false) {
    idb.available = false;
  }
  configureChartLibraryRuntimeForTest({
    localStorage: ls,
    sessionStorage: ss,
    idbAdapter: idb,
    autoBackupHook: options.autoBackupHook ?? null,
    resetState: true,
  });
  return { ls, ss, idb };
}

let passed = 0;
let total = 0;

async function runTest(name: string, fn: () => void | Promise<void>) {
  total += 1;
  try {
    await fn();
    passed += 1;
    console.log(`PASS [${total}]: ${name}`);
  } catch (err) {
    console.error(`FAIL [${total}]: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function main() {
  // TEST-L01: Chống trùng đúng + ĐC-5 không cắt tên > 32 ký tự
  await runTest('TEST-L01: Anti-dedup for same date/time/gender with different name/place/unknownTime + DC-5 no slice', async () => {
    setupFreshTestEnv();
    await initChartLibrary();

    const longName = 'Nguyễn Hoàng Công Tôn Nữ Tường Vi Phương Anh';
    assert.ok(longName.length > 32);

    const formA = makeForm({ name: longName });
    const formB = makeForm({ name: 'Trần Quốc Bảo' });
    const formC = makeForm({
      name: longName,
      province: 'Việt Nam — Tây Bắc',
      city: 'Điện Biên Phủ',
      longitude: 103.02,
    });
    const formD = makeForm({ name: longName, unknownTime: true });

    // ĐC-5: normalizeBirthFormForLibrary không cắt tên
    const normA = normalizeBirthFormForLibrary(formA);
    assert.equal(normA.name, longName);
    const chartA = generateChart(formToBirthInfo(formA));
    const expectedKeyA = buildChartIdentityKey(chartA);

    const resA = upsertChartToLibrary(formA);
    upsertChartToLibrary(formB);
    upsertChartToLibrary(formC);
    upsertChartToLibrary(formD);

    assert.equal(resA.entry?.chartIdentityKey, expectedKeyA);
    assert.equal(resA.entry?.form.name, longName);

    const store = readLibraryIndexStore();
    assert.equal(store.entries.length, 4);
    const uniqueKeys = new Set(store.entries.map((e) => e.chartIdentityKey));
    assert.equal(uniqueKeys.size, 4);
  });

  // TEST-L02: Upsert bảo toàn dữ liệu khi lập lại đúng 1 lá số
  await runTest('TEST-L02: Safe Upsert preserves pinned, alias, notes, and dossierSummary', async () => {
    setupFreshTestEnv();
    await initChartLibrary();

    const formA = makeForm();
    const res1 = upsertChartToLibrary(formA, { nowMs: 1000 });
    const key = res1.entry!.chartIdentityKey;

    togglePinLibraryEntry(key, 1100);
    updateLibraryEntryMeta(key, {
      customAlias: 'Anh An - Đối tác',
      notes: 'Nghiệm lý 2024 chuyển việc',
    }, 1200);

    const chart = generateChart(formToBirthInfo(formA));
    saveDossierSectionToLibrary(
      chart,
      'chapter_overview',
      makeChapter(key, 'chapter_overview', 'Nội dung chương 1 sạch.', 1300),
    );

    const res2 = upsertChartToLibrary(formA, { nowMs: 5000 });
    assert.equal(res2.entry?.lastOpenedAt, 5000);
    assert.equal(res2.entry?.createdAt, 1000);
    assert.equal(res2.entry?.pinned, true);
    assert.equal(res2.entry?.customAlias, 'Anh An - Đối tác');
    assert.equal(res2.entry?.notes, 'Nghiệm lý 2024 chuyển việc');
    assert.equal(res2.entry?.dossierSummary.completedCount, 1);

    const store = readLibraryIndexStore();
    assert.equal(store.entries.length, 1);
  });

  // TEST-L03: Di trú từ hình dạng thật của 'ziwei_history' + khóa hồ sơ 9 thành phần (1.1.0-rc.1)
  await runTest('TEST-L03: Idempotent migration from real ziwei_history + 9-part sessionStorage dossier', async () => {
    const { ls, ss } = setupFreshTestEnv();
    const form1 = makeForm({ name: 'Lê Minh Tuấn', year: '1990', month: '5', day: '12' });
    const form2 = makeForm({ name: 'Phạm Thu Hà', year: '1994', month: '11', day: '3', gender: 'female' });
    const chart1 = generateChart(formToBirthInfo(form1));
    const key1 = buildChartIdentityKey(chart1);

    const legacyHistory = [
      { id: '1700000000001', label: 'Lê Minh Tuấn · 12/5/1990 · Hà Nội · Nam', form: form1, savedAt: 1700000000001 },
      { id: '1700000000002', label: 'Phạm Thu Hà · 3/11/1994 · Hà Nội · Nữ', form: form2, savedAt: 1700000000002 },
    ];
    ls.setItem(LEGACY_HISTORY_STORAGE_KEY, JSON.stringify(legacyHistory));

    const storedRecord: StoredDossierRecord = {
      chartIdentityKey: key1,
      updatedAt: 1700000100000,
      sections: {
        chapter_overview: makeChapter(key1, 'chapter_overview', 'Tổng quan Mệnh cục chuẩn.', 1700000050000),
        palaces_core: makeChapter(key1, 'palaces_core', '### Cung Mệnh\nNội dung cốt lõi.', 1700000080000),
        year_2026: makeChapter(
          key1,
          'year_2026',
          'Lưu Niên 2026 đủ Lưu Hóa Lộc, Lưu Hóa Quyền, Lưu Hóa Khoa, Lưu Hóa Kỵ.',
          1700000100000,
        ),
      },
    };
    ss.setItem(buildDossierStorageKey(key1), JSON.stringify(storedRecord));

    await initChartLibrary();

    const store = readLibraryIndexStore();
    assert.equal(store.entries.length, 2);
    const entry1 = store.entries.find((e) => e.chartIdentityKey === key1);
    assert.ok(entry1);
    assert.equal(entry1.dossierSummary.completedCount, 3);
    assert.deepEqual(entry1.dossierSummary.completedChapterIds, [
      'chapter_overview',
      'palaces_core',
      'year_2026',
    ]);
    assert.deepEqual(entry1.dossierSummary.modelsUsed, ['gemini-3.5-flash-lite']);

    // Khóa cũ 'ziwei_history' vẫn nguyên vẹn
    assert.ok(ls.getItem(LEGACY_HISTORY_STORAGE_KEY));

    // Chạy lại di trú lần 2: lũy đẳng, không nhân đôi
    migrateLegacyHistoryAndDossiers();
    assert.equal(readLibraryIndexStore().entries.length, 2);

    // PL-11: buildPeriodCachePatchesFromLibrary nạp sẵn năm 2026
    const periodPatches = buildPeriodCachePatchesFromLibrary(chart1);
    assert.ok(Object.keys(periodPatches).some((k) => k.endsWith('liunian_2026')));
  });

  // TEST-L04 (LK-02): Không gắn mù khóa cũ 5 thành phần (1.0.0-stable) vào lá số 9 thành phần để chống rò dữ liệu chéo
  await runTest('TEST-L04 (LK-02): Legacy 5-part key (Y_M_D_H_G) is NOT cross-linked to 9-part chart and remains preserved in sessionStorage', async () => {
    const { ls, ss, idb } = setupFreshTestEnv();
    const form = makeForm({ name: 'Đỗ Hoàng Nam', year: '1988', month: '7', day: '19', clockHour: '14', clockMinute: '00' });
    const chart = generateChart(formToBirthInfo(form));
    const canonicalKey = buildChartIdentityKey(chart);
    const fivePartKey = `${chart.birthInfo.year}_${chart.birthInfo.month}_${chart.birthInfo.day}_${chart.birthInfo.hour}_${chart.birthInfo.gender}`;

    ls.setItem(
      LEGACY_HISTORY_STORAGE_KEY,
      JSON.stringify([{ id: '1', label: 'Đỗ Hoàng Nam', form, savedAt: 1000 }]),
    );

    const legacy5PartDossier: StoredDossierRecord = {
      chartIdentityKey: fivePartKey,
      updatedAt: 2000,
      sections: {
        chapter_overview: makeChapter(fivePartKey, 'chapter_overview', 'Hồ sơ 5-part cũ chương 1.', 1500),
        horizon_5y: makeChapter(fivePartKey, 'horizon_5y', 'Hồ sơ 5-part cũ chương 7.', 2000),
      },
    };
    ss.setItem(buildDossierStorageKey(fivePartKey), JSON.stringify(legacy5PartDossier));

    await initChartLibrary();

    const store = readLibraryIndexStore();
    assert.equal(store.entries.length, 1);
    assert.equal(store.entries[0].chartIdentityKey, canonicalKey);
    assert.equal(store.entries[0].dossierSummary.completedCount, 0);
    assert.deepEqual(store.entries[0].dossierSummary.completedChapterIds, []);
    assert.equal(await idb.get(canonicalKey), null);
    assert.ok(ss.getItem(buildDossierStorageKey(fivePartKey)));
  });

  // TEST-L05: Đổi customAlias & notes giữ nguyên khóa + ĐC-3 IndexedDB/RAM thắng sessionStorage khi lệch
  await runTest('TEST-L05: Alias/notes keep identity key immutable + DC-3 RAM/IDB SSOT beats divergent sessionStorage', async () => {
    const { ss } = setupFreshTestEnv();
    await initChartLibrary();

    const form = makeForm({ name: 'Trần Minh Khôi' });
    const chart = generateChart(formToBirthInfo(form));
    const key = buildChartIdentityKey(chart);
    upsertChartToLibrary(form);

    for (const chId of ['chapter_overview', 'palaces_core', 'palaces_family', 'palaces_social_health'] as const) {
      saveDossierSectionToCache(
        ss,
        chart,
        chId,
        makeChapter(key, chId, `Nội dung chuẩn SSOT ${chId}`, 5000),
      );
    }

    const metaRes = updateLibraryEntryMeta(key, {
      customAlias: 'Anh Khôi - Sài Gòn',
      notes: 'Nghiệm lý 2026',
    });
    assert.equal(metaRes.ok, true);
    assert.equal(metaRes.entry?.chartIdentityKey, key);
    assert.equal(metaRes.entry?.form.name, 'Trần Minh Khôi');

    // Tạo sai lệch giả trong sessionStorage (bị cũ/thiếu chương) -> ĐC-3: IndexedDB/RAM SSOT phải thắng!
    ss.setItem(
      buildDossierStorageKey(key),
      JSON.stringify({
        chartIdentityKey: key,
        updatedAt: 100,
        sections: {
          chapter_overview: makeChapter(key, 'chapter_overview', 'Bản session cũ bị lệch', 100),
        },
      }),
    );

    const readBack = readDossierCacheEntry(ss, buildDossierStorageKey(key), chart);
    assert.ok(readBack);
    assert.equal(Object.keys(readBack.sections).length, 4);
    assert.equal(readBack.sections.chapter_overview?.text, 'Nội dung chuẩn SSOT chapter_overview');
  });

  // TEST-L06: Xuất / Nhập .JSON hợp nhất đơn điệu từng chương (Per-Chapter Merge)
  await runTest('TEST-L06: Export/Import JSON performs monotonic per-chapter merge without losing any chapter', async () => {
    // Máy A
    setupFreshTestEnv();
    await initChartLibrary();
    const formX = makeForm({ name: 'Võ Thị Mai', gender: 'female' });
    const chartX = generateChart(formToBirthInfo(formX));
    const keyX = buildChartIdentityKey(chartX);
    upsertChartToLibrary(formX, { nowMs: 1000 });

    saveDossierSectionToLibrary(chartX, 'chapter_overview', makeChapter(keyX, 'chapter_overview', 'Ch1 Máy A (mới)', 3000));
    saveDossierSectionToLibrary(chartX, 'palaces_core', makeChapter(keyX, 'palaces_core', 'Ch2 Máy A', 2000));
    saveDossierSectionToLibrary(chartX, 'palaces_family', makeChapter(keyX, 'palaces_family', 'Ch3 Máy A', 2000));
    saveDossierSectionToLibrary(chartX, 'palaces_social_health', {
      chapterId: 'palaces_social_health',
      sectionCacheKey: `${keyX}::palaces_social_health`,
      status: 'incomplete',
      incompleteText: 'Ch4 Máy A dở dang',
      updatedAt: 9000,
    });

    const bundleA = await exportLibraryBundle();

    // Máy B (môi trường trình duyệt khác)
    setupFreshTestEnv();
    await initChartLibrary();
    upsertChartToLibrary(formX, { nowMs: 1000 });
    saveDossierSectionToLibrary(chartX, 'chapter_overview', makeChapter(keyX, 'chapter_overview', 'Ch1 Máy B (cũ)', 1500));
    saveDossierSectionToLibrary(chartX, 'palaces_social_health', makeChapter(keyX, 'palaces_social_health', 'Ch4 Máy B (hoàn chỉnh)', 2500));
    saveDossierSectionToLibrary(chartX, 'year_2026', makeChapter(keyX, 'year_2026', 'Ch5 Máy B', 2500));

    const mergeRes = await importLibraryBundleWithMerge(bundleA, { mode: 'smart_merge' });
    assert.equal(mergeRes.ok, true);

    const readMerged = getDossierReadState(keyX, chartX);
    assert.ok(readMerged.record);
    assert.equal(readMerged.record.sections.chapter_overview?.text, 'Ch1 Máy A (mới)');
    assert.equal(readMerged.record.sections.palaces_core?.text, 'Ch2 Máy A');
    assert.equal(readMerged.record.sections.palaces_family?.text, 'Ch3 Máy A');
    assert.equal(readMerged.record.sections.palaces_social_health?.text, 'Ch4 Máy B (hoàn chỉnh)');
    assert.ok(readMerged.record.sections.year_2026?.text?.startsWith('Ch5 Máy B'));
    assert.ok(readMerged.record.sections.year_2026?.text?.includes('Tổng Hợp Đầy Đủ Tứ Hóa Kỳ Hạn'));

    const entryB = readLibraryIndexStore().entries.find((e) => e.chartIdentityKey === keyX);
    assert.equal(entryB?.dossierSummary.completedCount, 5);
  });

  // TEST-L07: Tombstone chống hồi sinh khi nhập file JSON cũ
  await runTest('TEST-L07: deletedTombstones prevent resurrection in smart_merge and allow force_restore_all', async () => {
    setupFreshTestEnv();
    await initChartLibrary();

    const formX = makeForm({ name: 'Lá Số Sẽ Xóa' });
    const formY = makeForm({ name: 'Lá Số Giữ Lại', day: '20' });
    const keyX = upsertChartToLibrary(formX, { nowMs: 1000 }).entry!.chartIdentityKey;
    upsertChartToLibrary(formY, { nowMs: 1000 });

    const oldBundle = await exportLibraryBundle();

    // Xóa vĩnh viễn X ở thời điểm 2000
    removeLibraryEntry(keyX, { deleteMode: 'entry_and_dossier', nowMs: 2000 });
    assert.equal(readLibraryIndexStore().entries.length, 1);

    // Nhập lại file cũ (updatedAt = 1000) ở chế độ smart_merge -> X KHÔNG được hồi sinh
    const smartRes = await importLibraryBundleWithMerge(oldBundle, {
      mode: 'smart_merge',
      nowMs: 3000,
    });
    assert.equal(smartRes.skippedTombstonedCount, 1);
    assert.equal(readLibraryIndexStore().entries.length, 1);
    assert.equal(
      readLibraryIndexStore().entries.some((e) => e.chartIdentityKey === keyX),
      false,
    );

    // Nhập ở chế độ force_restore_all -> X được khôi phục
    const forceRes = await importLibraryBundleWithMerge(oldBundle, {
      mode: 'force_restore_all',
      nowMs: 4000,
    });
    assert.equal(forceRes.addedEntries, 1);
    assert.equal(readLibraryIndexStore().entries.length, 2);
  });

  // TEST-L08: Trần 30 ghim + Thang thu hồi 4 nấc + ĐC-2 bắt buộc tải JSON backup trước khi xóa mục có hồ sơ
  await runTest('TEST-L08: Pin cap 30 + 4-tier eviction + DC-2 auto-backup before evicting entry with completed dossier', async () => {
    const autoBackedUpItems: Array<{ filename: string; key: string; chapters: number }> = [];
    let allowAutoBackup = true;

    setupFreshTestEnv({
      autoBackupHook: (bundle, entry, filename) => {
        if (!allowAutoBackup) return false;
        const dossier = bundle.dossiers[entry.chartIdentityKey];
        autoBackedUpItems.push({
          filename,
          key: entry.chartIdentityKey,
          chapters: Object.keys(dossier?.sections ?? {}).length,
        });
        return true;
      },
    });
    await initChartLibrary();

    // Tạo 100 lá số: 30 ghim, 69 có 2/8 chương hồ sơ, 1 không ghim chỉ có ghi chú (Nấc 2)
    for (let i = 1; i <= MAX_LIBRARY_ENTRIES; i += 1) {
      const f = makeForm({
        name: `Đương Số ${i}`,
        year: String(1950 + (i % 50)),
        day: String(1 + (i % 28)),
      });
      const res = upsertChartToLibrary(f, { nowMs: 1000 + i, syncLegacyMirror: false });
      const key = res.entry!.chartIdentityKey;
      if (i <= MAX_PINNED_ENTRIES) {
        togglePinLibraryEntry(key, 2000 + i);
      } else if (i === MAX_PINNED_ENTRIES + 1) {
        // Nấc 2 (cũ nhất trong nhóm 0/8 có ghi chú)
        updateLibraryEntryMeta(key, { notes: 'Ghi chú riêng cần bảo toàn' }, 2000 + i);
      } else {
        const ch = generateChart(formToBirthInfo(f));
        saveDossierSectionToLibrary(ch, 'chapter_overview', makeChapter(key, 'chapter_overview', 'Ch1', 2000 + i));
        saveDossierSectionToLibrary(ch, 'palaces_core', makeChapter(key, 'palaces_core', 'Ch2', 2000 + i));
      }
    }

    // Thử ghim mục thứ 31 -> từ chối
    const store100 = readLibraryIndexStore();
    assert.equal(store100.entries.length, MAX_LIBRARY_ENTRIES);
    const unpinnedCandidate = store100.entries.find((e) => !e.pinned)!;
    const pinFail = togglePinLibraryEntry(unpinnedCandidate.chartIdentityKey);
    assert.equal(pinFail.ok, false);
    assert.equal(pinFail.reason, 'MAX_PINNED_REACHED');

    // Thêm lá số 101 -> thu hồi đúng mục Nấc 2 (chưa có hồ sơ, chỉ có ghi chú)
    const form101 = makeForm({ name: 'Đương Số 101', year: '2001', day: '15' });
    const add101 = upsertChartToLibrary(form101, { nowMs: 9000, syncLegacyMirror: false });
    assert.equal(add101.ok, true);
    assert.equal(add101.evicted?.tier, 2);
    assert.equal(readLibraryIndexStore().entries.length, MAX_LIBRARY_ENTRIES);
    assert.equal(readLibraryIndexStore().entries.filter((e) => e.pinned).length, MAX_PINNED_ENTRIES);

    // Gán hồ sơ 2/8 cho mục 101 rồi thêm mục 102 để ép thu hồi Nấc 3 (mục CÓ chương hoàn tất) -> ĐC-2 phải tải backup JSON
    const ch101 = generateChart(formToBirthInfo(form101));
    const key101 = buildChartIdentityKey(ch101);
    saveDossierSectionToLibrary(ch101, 'chapter_overview', makeChapter(key101, 'chapter_overview', 'Ch1 101', 9100));
    saveDossierSectionToLibrary(ch101, 'palaces_core', makeChapter(key101, 'palaces_core', 'Ch2 101', 9100));

    // Đổi mục vừa thu hồi? Không, lúc này 70 mục không ghim đều có >= 2 chương!
    // ĐC-2: Nếu autoBackupHook trả false -> CẤM xóa lặng mục có hồ sơ!
    allowAutoBackup = false;
    const form102Fail = makeForm({ name: 'Đương Số 102 Bị Chặn', year: '2002', day: '16' });
    const blockedRes = upsertChartToLibrary(form102Fail, { nowMs: 9500, syncLegacyMirror: false });
    assert.equal(blockedRes.ok, false);
    assert.equal(readLibraryIndexStore().entries.length, MAX_LIBRARY_ENTRIES);

    // Cho phép autoBackupHook -> Nấc 3 tải xong file JSON chứa đủ entry + dossier rồi mới xóa & giữ banner hoàn tác
    allowAutoBackup = true;
    const form102 = makeForm({ name: 'Đương Số 102 Thành Công', year: '2002', day: '17' });
    const okRes = upsertChartToLibrary(form102, { nowMs: 9600, syncLegacyMirror: false });
    assert.equal(okRes.ok, true);
    assert.equal(okRes.evicted?.tier, 3);
    assert.equal(okRes.evicted?.autoBackupTriggered, true);
    assert.equal(autoBackedUpItems.length, 1);
    assert.equal(autoBackedUpItems[0].chapters, 2);
    assert.ok(getLastEvictedBackupItem());

    // Undo thu hồi khôi phục lại mục vừa bị đẩy
    const undoRes = undoLastEviction();
    assert.equal(undoRes.ok, true);
    assert.equal(getLastEvictedBackupItem(), null);
  });

  // TEST-L09: Xử lý tràn dung lượng localStorage (QuotaExceededError) & ngân sách 3 hot dossiers
  await runTest('TEST-L09: QuotaExceededError clears localStorage hot dossiers while preserving index and IndexedDB', async () => {
    const { ls, idb } = setupFreshTestEnv({ lsMaxChars: 450_000 });
    await initChartLibrary();

    const bigText = 'Luận giải chi tiết Tử Vi Đẩu Số Thiên Kỷ. '.repeat(2800); // ~112 KB/chương
    const keys: string[] = [];
    for (let i = 1; i <= 6; i += 1) {
      const f = makeForm({ name: `Hồ Sơ Lớn ${i}`, day: String(i) });
      const ch = generateChart(formToBirthInfo(f));
      const key = upsertChartToLibrary(f, { syncLegacyMirror: false }).entry!.chartIdentityKey;
      keys.push(key);
      saveDossierSectionToLibrary(ch, 'chapter_overview', makeChapter(key, 'chapter_overview', bigText, 1000 + i));
    }

    // Chỉ mục vẫn giữ đủ cả 6 lá số và IndexedDB giữ đủ cả 6 hồ sơ
    assert.equal(readLibraryIndexStore().entries.length, 6);
    assert.equal(idb.records.size, 6);

    // Số lượng hot dossier trong localStorage không vượt quá 3 (và nếu tràn thì dọn sạch nhường chỗ cho index)
    const hotKeysInLs = ls.keys().filter((k) => k.startsWith(HOT_DOSSIER_STORAGE_PREFIX));
    assert.ok(hotKeysInLs.length <= MAX_HOT_DOSSIERS_LOCALSTORAGE);
    assert.ok(ls.getItem(LIBRARY_INDEX_STORAGE_KEY));
  });

  // TEST-L10: Kiểm tra schema & hậu kiểm văn bản khi nhập JSON bẩn + tìm kiếm tiếng Việt
  await runTest('TEST-L10: Schema validation & text sanitization on dirty JSON import + diacritics-insensitive search', async () => {
    setupFreshTestEnv();
    await initChartLibrary();

    const validForm = makeForm({ name: 'Nguyễn Ánh Tuyết', gender: 'female', city: 'Đà Nẵng', longitude: 108.22 });
    const validChart = generateChart(formToBirthInfo(validForm));
    const validKey = buildChartIdentityKey(validChart);

    const dirtyBundle = {
      bundleType: 'tu-vi-thien-ky-chart-library',
      schemaVersion: CHART_LIBRARY_SCHEMA_VERSION,
      appVersion: '1.2.0-rc.1',
      exportedAt: Date.now(),
      exportedAtIso: new Date().toISOString(),
      entries: [
        {
          chartIdentityKey: 'invalid_date_key',
          legacyFivePartKey: '1995_2_31_5_male',
          form: makeForm({ year: '1995', month: '2', day: '31' }), // Ngày sai 31/02
          customAlias: '',
          notes: '',
          pinned: false,
          pinnedAt: null,
          deterministicBadge: {} as never,
          dossierSummary: {} as never,
          createdAt: 1000,
          updatedAt: 1000,
          notesUpdatedAt: 0,
          lastOpenedAt: 1000,
        },
        {
          chartIdentityKey: validKey,
          legacyFivePartKey: 'x',
          form: validForm,
          customAlias: 'Cô Tuyết Đà Nẵng',
          notes: 'Ghi chú kiểm tra tìm kiếm không dấu',
          pinned: false,
          pinnedAt: null,
          deterministicBadge: {} as never,
          dossierSummary: {} as never,
          createdAt: 2000,
          updatedAt: 2000,
          notesUpdatedAt: 2000,
          lastOpenedAt: 2000,
        },
      ],
      dossiers: {
        [validKey]: {
          chartIdentityKey: validKey,
          updatedAt: 2000,
          sections: {
            chapter_overview: makeChapter(
              validKey,
              'chapter_overview',
              'Mệnh Thủy 命宫テスト bản mệnh sáng sủa.',
              2000,
            ),
          },
        },
      },
      deletedTombstones: [],
    };

    const res = await importLibraryBundleWithMerge(dirtyBundle, { mode: 'smart_merge' });
    assert.equal(res.ok, true);
    assert.equal(res.skippedInvalidCount, 1);
    assert.equal(res.addedEntries, 1);

    const readState = getDossierReadState(validKey, validChart);
    const cleanedText = readState.record?.sections.chapter_overview?.text ?? '';
    assert.equal(/[\u4e00-\u9fff\u3040-\u30ff]/.test(cleanedText), false);
    assert.ok(cleanedText.includes('Mệnh Thủy'));

    // Tìm kiếm không dấu
    const found = filterAndSortLibraryEntries(readLibraryIndexStore().entries, {
      query: 'tuyet da nang',
    });
    assert.equal(found.length, 1);
    assert.equal(found[0].customAlias, 'Cô Tuyết Đà Nẵng');
  });

  // TEST-L11 (ĐC-1): Mô phỏng IndexedDB mở chậm (hydration gate + queue merge)
  await runTest('TEST-L11 (DC-1): Slow IndexedDB hydration gate prevents premature 0/8 conclusion and merges queued writes', async () => {
    const { idb } = setupFreshTestEnv();
    const form = makeForm({ name: 'Hồ Sơ Chậm IDB' });
    const chart = generateChart(formToBirthInfo(form));
    const key = buildChartIdentityKey(chart);

    // Cài sẵn 3 chương trong IndexedDB trước khi mở app
    const persistedIdbRecord: StoredDossierRecord = {
      chartIdentityKey: key,
      updatedAt: 5000,
      sections: {
        chapter_overview: makeChapter(key, 'chapter_overview', 'IDB Chương 1', 3000),
        palaces_core: makeChapter(key, 'palaces_core', 'IDB Chương 2', 4000),
        year_2026: makeChapter(key, 'year_2026', 'IDB Chương 5 Lưu Niên 2026', 5000),
      },
    };
    idb.records.set(key, persistedIdbRecord);

    let releaseIdbGate!: () => void;
    idb.gatePromise = new Promise<void>((resolve) => {
      releaseIdbGate = resolve;
    });

    // Khởi tạo thư viện trong lúc IDB bị chậm
    upsertChartToLibrary(form, { syncLegacyMirror: false });
    const initPromise = initChartLibrary(form);

    // Đợi 1 microtask để isAvailable() xong và kẹt tại getAll()
    await new Promise((r) => setTimeout(r, 10));

    assert.equal(getLibraryHydrationStatus(), 'hydrating');
    const preHydrationRead = getDossierReadState(key, chart);
    assert.equal(preHydrationRead.isHydrated, false);
    assert.equal(preHydrationRead.hydrationStatus, 'hydrating');

    // Giả lập có thao tác ghi 1 chương mới (year_2027) ngay trong lúc IndexedDB đang mở chậm
    saveDossierSectionToLibrary(
      chart,
      'year_2027',
      makeChapter(key, 'year_2027', 'Ghi mới Chương 6 khi đang hydrating', 6000),
    );

    // Nhả cổng IndexedDB chậm
    releaseIdbGate();
    await initPromise;

    assert.equal(getLibraryHydrationStatus(), 'ready');
    const postHydrationRead = getDossierReadState(key, chart);
    assert.equal(postHydrationRead.isHydrated, true);
    assert.ok(postHydrationRead.record);
    // Cả 3 chương từ IDB lẫn chương mới ghi đều phải còn nguyên vẹn (tổng 4/8)
    assert.equal(postHydrationRead.record.sections.chapter_overview?.text, 'IDB Chương 1');
    assert.equal(postHydrationRead.record.sections.palaces_core?.text, 'IDB Chương 2');
    assert.ok(
      postHydrationRead.record.sections.year_2026?.text?.startsWith('IDB Chương 5 Lưu Niên 2026'),
    );
    assert.ok(
      postHydrationRead.record.sections.year_2027?.text?.startsWith('Ghi mới Chương 6 khi đang hydrating'),
    );

    const entry = readLibraryIndexStore().entries.find((e) => e.chartIdentityKey === key);
    assert.equal(entry?.dossierSummary.completedCount, 4);
  });

  // TEST-L12 (ĐC-4): Mô phỏng trình duyệt chặn/không có IndexedDB
  await runTest('TEST-L12 (DC-4): Degraded mode when IndexedDB is unavailable or blocked', async () => {
    setupFreshTestEnv({ idbAvailable: false });
    const initRes = await initChartLibrary();

    assert.equal(initRes.hydrationStatus, 'degraded');
    assert.equal(initRes.storageHealth.indexedDbAvailable, false);
    assert.equal(initRes.storageHealth.mode, 'degraded_no_idb');
    assert.equal(getLibraryStorageHealth().mode, 'degraded_no_idb');

    const form = makeForm({ name: 'Chế Độ Suy Giảm' });
    const chart = generateChart(formToBirthInfo(form));
    const key = upsertChartToLibrary(form).entry!.chartIdentityKey;

    const saved = saveDossierSectionToLibrary(
      chart,
      'chapter_overview',
      makeChapter(key, 'chapter_overview', 'Lưu thành công vào hot cache khi không có IDB', 7000),
    );
    assert.equal(saved, true);

    const readState = getDossierReadState(key, chart);
    assert.equal(readState.isHydrated, true);
    assert.equal(readState.hydrationStatus, 'degraded');
    assert.equal(
      readState.record?.sections.chapter_overview?.text,
      'Lưu thành công vào hot cache khi không có IDB',
    );
  });

  // TEST-L13 (LK-01): Di trú trùng khóa 5 thành phần với nhóm duy nhất trong lịch sử (fivePartCount === 1)
  await runTest('TEST-L13: Migration does NOT leak chapters when orphan 9-part/5-part dossier shares 5-part prefix with a unique ziwei_history entry', async () => {
    const { ls, ss } = setupFreshTestEnv();

    const formA = makeForm({
      name: 'Nguyễn Văn A',
      year: '1995',
      month: '8',
      day: '16',
      clockHour: '10',
      clockMinute: '30',
      city: 'Hà Nội',
      longitude: 105.85,
      gender: 'male',
    });
    const chartA = generateChart(formToBirthInfo(formA));
    const keyA = buildChartIdentityKey(chartA);
    const sharedFivePart = `${chartA.birthInfo.year}_${chartA.birthInfo.month}_${chartA.birthInfo.day}_${chartA.birthInfo.hour}_${chartA.birthInfo.gender}`;

    // Người A có Chương 5 & 6 trong sessionStorage dưới cả khóa 9 thành phần lẫn khóa 5 thành phần, nhưng KHÔNG có trong ziwei_history
    const recordA: StoredDossierRecord = {
      chartIdentityKey: keyA,
      updatedAt: 5000,
      sections: {
        year_2026: makeChapter(keyA, 'year_2026', 'Luận giải Lưu Niên 2026 của riêng Nguyễn Văn A.', 5000),
        year_2027: makeChapter(keyA, 'year_2027', 'Luận giải Lưu Niên 2027 của riêng Nguyễn Văn A.', 5000),
      },
    };
    ss.setItem(buildDossierStorageKey(keyA), JSON.stringify(recordA));
    ss.setItem(
      buildDossierStorageKey(sharedFivePart),
      JSON.stringify({ ...recordA, chartIdentityKey: sharedFivePart }),
    );

    // Người B là mục duy nhất trong ziwei_history có cùng 5 thành phần (fivePartCount === 1)
    const formB = makeForm({
      name: 'Trần Văn B',
      year: '1995',
      month: '8',
      day: '16',
      clockHour: '10',
      clockMinute: '35',
      province: 'Việt Nam — Miền Nam',
      city: 'TP. Hồ Chí Minh',
      longitude: 106.7,
      gender: 'male',
    });
    const chartB = generateChart(formToBirthInfo(formB));
    const keyB = buildChartIdentityKey(chartB);
    assert.notEqual(keyA, keyB);

    ls.setItem(
      LEGACY_HISTORY_STORAGE_KEY,
      JSON.stringify([{ id: 'b1', label: 'Trần Văn B', form: formB, savedAt: 6000 }]),
    );

    await initChartLibrary(formB);

    const entryB = readLibraryIndexStore().entries.find((e) => e.chartIdentityKey === keyB);
    assert.ok(entryB);
    assert.equal(entryB.dossierSummary.completedCount, 0);
    assert.equal(getDossierReadState(keyB, chartB).record, null);
    assert.deepEqual(buildPeriodCachePatchesFromLibrary(chartB), {});

    // Bản ghi gốc của Người A trong sessionStorage vẫn nguyên vẹn, không bị đổi khóa sang keyB
    const rawA = ss.getItem(buildDossierStorageKey(keyA));
    assert.ok(rawA);
    const parsedA = JSON.parse(rawA) as StoredDossierRecord;
    assert.equal(parsedA.chartIdentityKey, keyA);
  });

  // TEST-L14 (LK-01): Di trú trùng nameSlug (chuỗi con & tên rỗng 'anon')
  await runTest('TEST-L14: Migration does NOT leak chapters across matching/substring nameSlug or empty name ("anon")', async () => {
    const { ls, ss } = setupFreshTestEnv();

    // Ca A: Trùng nameSlug ('An' vs 'An' / 'Lan An' khác phút & kinh độ)
    const formC1 = makeForm({
      name: 'An',
      year: '1992',
      month: '10',
      day: '20',
      clockHour: '8',
      clockMinute: '15',
      city: 'Hà Nội',
      longitude: 105.85,
      gender: 'female',
    });
    const formC2 = makeForm({
      name: 'An',
      year: '1992',
      month: '10',
      day: '20',
      clockHour: '8',
      clockMinute: '45',
      province: 'Việt Nam — Miền Trung',
      city: 'Đà Nẵng',
      longitude: 108.22,
      gender: 'female',
    });
    const chartC1 = generateChart(formToBirthInfo(formC1));
    const chartC2 = generateChart(formToBirthInfo(formC2));
    const keyC1 = buildChartIdentityKey(chartC1);
    const keyC2 = buildChartIdentityKey(chartC2);
    assert.notEqual(keyC1, keyC2);

    // Ca B: Tên rỗng 'anon'
    const formD1 = makeForm({
      name: '',
      year: '1993',
      month: '4',
      day: '9',
      clockHour: '8',
      clockMinute: '15',
      city: 'Hà Nội',
      longitude: 105.85,
      gender: 'male',
    });
    const formD2 = makeForm({
      name: '',
      year: '1993',
      month: '4',
      day: '9',
      clockHour: '8',
      clockMinute: '45',
      province: 'Việt Nam — Miền Trung',
      city: 'Đà Nẵng',
      longitude: 108.22,
      gender: 'male',
    });
    const chartD1 = generateChart(formToBirthInfo(formD1));
    const chartD2 = generateChart(formToBirthInfo(formD2));
    const keyD1 = buildChartIdentityKey(chartD1);
    const keyD2 = buildChartIdentityKey(chartD2);
    assert.notEqual(keyD1, keyD2);

    ss.setItem(
      buildDossierStorageKey(keyC1),
      JSON.stringify({
        chartIdentityKey: keyC1,
        updatedAt: 3000,
        sections: {
          year_2026: makeChapter(keyC1, 'year_2026', 'Chương 5 của C1.', 3000),
          year_2027: makeChapter(keyC1, 'year_2027', 'Chương 6 của C1.', 3000),
        },
      }),
    );
    ss.setItem(
      buildDossierStorageKey(keyD1),
      JSON.stringify({
        chartIdentityKey: keyD1,
        updatedAt: 3000,
        sections: {
          year_2026: makeChapter(keyD1, 'year_2026', 'Chương 5 của D1.', 3000),
          year_2027: makeChapter(keyD1, 'year_2027', 'Chương 6 của D1.', 3000),
        },
      }),
    );

    ls.setItem(
      LEGACY_HISTORY_STORAGE_KEY,
      JSON.stringify([
        { id: 'c2', label: 'An Đà Nẵng', form: formC2, savedAt: 4000 },
        { id: 'd2', label: 'Ẩn danh Đà Nẵng', form: formD2, savedAt: 4100 },
      ]),
    );

    await initChartLibrary(formD2);
    migrateLegacyHistoryAndDossiers(formD2);

    const store = readLibraryIndexStore();
    const entryC2 = store.entries.find((e) => e.chartIdentityKey === keyC2);
    const entryD2 = store.entries.find((e) => e.chartIdentityKey === keyD2);
    assert.ok(entryC2);
    assert.ok(entryD2);
    assert.equal(entryC2.dossierSummary.completedCount, 0);
    assert.equal(entryD2.dossierSummary.completedCount, 0);
    assert.equal(getDossierReadState(keyC2, chartC2).record, null);
    assert.equal(getDossierReadState(keyD2, chartD2).record, null);

    // Hồ sơ gốc keyC1 và keyD1 trong sessionStorage giữ nguyên khóa gốc
    assert.equal(
      (JSON.parse(ss.getItem(buildDossierStorageKey(keyC1))!) as StoredDossierRecord).chartIdentityKey,
      keyC1,
    );
    assert.equal(
      (JSON.parse(ss.getItem(buildDossierStorageKey(keyD1))!) as StoredDossierRecord).chartIdentityKey,
      keyD1,
    );
  });

  // TEST-L15 (LK-01 & LK-06): Đổi lá số lúc IndexedDB chưa hydrated ('hydrating') không rò chương cũ
  await runTest('TEST-L15: Switching to new chart while IndexedDB is hydrating leaks zero chapters before or after hydration resolves', async () => {
    const { idb } = setupFreshTestEnv();
    const formA = makeForm({ name: 'Đương Số A Cũ', year: '1991', month: '3', day: '14' });
    const formB = makeForm({ name: 'Đương Số B Mới', year: '1999', month: '9', day: '22', gender: 'female' });
    const chartA = generateChart(formToBirthInfo(formA));
    const chartB = generateChart(formToBirthInfo(formB));
    const keyA = buildChartIdentityKey(chartA);
    const keyB = buildChartIdentityKey(chartB);

    // Cài sẵn Chương 5 & 6 cho lá số A trong IndexedDB
    idb.records.set(keyA, {
      chartIdentityKey: keyA,
      updatedAt: 5000,
      sections: {
        year_2026: makeChapter(keyA, 'year_2026', 'Chương 5 của A.', 5000),
        year_2027: makeChapter(keyA, 'year_2027', 'Chương 6 của A.', 5000),
      },
    });

    let releaseIdbGate!: () => void;
    idb.gatePromise = new Promise<void>((resolve) => {
      releaseIdbGate = resolve;
    });

    upsertChartToLibrary(formA, { syncLegacyMirror: false });
    upsertChartToLibrary(formB, { syncLegacyMirror: false });
    const initPromise = initChartLibrary(formB);

    await new Promise((r) => setTimeout(r, 10));
    assert.equal(getLibraryHydrationStatus(), 'hydrating');

    // Trước khi nhả cổng: đọc B phải báo isHydrated=false, record=null, không rò A
    const preReadB = getDossierReadState(keyB, chartB);
    assert.equal(preReadB.isHydrated, false);
    assert.equal(preReadB.hydrationStatus, 'hydrating');
    assert.equal(preReadB.record, null);
    assert.deepEqual(buildPeriodCachePatchesFromLibrary(chartB), {});

    const staleLocalChaptersOfA: Partial<Record<DossierChapterId, DossierChapterState>> = {
      chapter_overview: makeChapter(keyA, 'chapter_overview', 'Ch1 của A', 4000),
      year_2026: makeChapter(keyA, 'year_2026', 'Ch5 của A', 5000),
      year_2027: makeChapter(keyA, 'year_2027', 'Ch6 của A', 5000),
    };
    for (const spec of DOSSIER_CHAPTER_SPECS) {
      const resolvedB = resolveDossierChapterFromCaches(chartB, spec, {}, staleLocalChaptersOfA);
      assert.equal(resolvedB.status, 'idle');
      assert.equal(resolvedB.sectionCacheKey, `${keyB}::${spec.id}`);
    }

    releaseIdbGate();
    await initPromise;

    // Sau khi nhả cổng: B vẫn 0/8 sạch sẽ, A giữ nguyên Chương 5 & 6
    const postReadB = getDossierReadState(keyB, chartB);
    assert.equal(postReadB.isHydrated, true);
    assert.equal(postReadB.record, null);
    const postReadA = getDossierReadState(keyA, chartA);
    assert.ok(postReadA.record?.sections.year_2026?.text?.startsWith('Chương 5 của A.'));
    assert.ok(postReadA.record?.sections.year_2027?.text?.startsWith('Chương 6 của A.'));
  });

  // TEST-L16 (LK-01 & LK-10): resolveDossierChapterFromCaches & readDossierCacheEntry từ chối sectionCacheKey / chartIdentityKey ngoại lai
  await runTest('TEST-L16: resolveDossierChapterFromCaches rejects mismatched sectionCacheKey in BOTH period & normal branches + LK-10 internal key guard', async () => {
    const { ss } = setupFreshTestEnv();
    await initChartLibrary();

    const formA = makeForm({ name: 'Lá Số A Nguồn', year: '1989', month: '1', day: '10' });
    const formB = makeForm({ name: 'Lá Số B Đích', year: '1997', month: '12', day: '25', gender: 'female' });
    const chartA = generateChart(formToBirthInfo(formA));
    const chartB = generateChart(formToBirthInfo(formB));
    const keyA = buildChartIdentityKey(chartA);
    const keyB = buildChartIdentityKey(chartB);

    const foreignLocalChapters: Partial<Record<DossierChapterId, DossierChapterState>> = {
      chapter_overview: makeChapter(keyA, 'chapter_overview', 'Tổng quan của A', 1000),
      palaces_core: {
        chapterId: 'palaces_core',
        sectionCacheKey: `${keyA}::palaces_core`,
        status: 'incomplete',
        incompleteText: 'Dang dở Ch2 của A',
        updatedAt: 1000,
      },
      palaces_family: {
        chapterId: 'palaces_family',
        sectionCacheKey: `${keyA}::palaces_family`,
        status: 'loading',
        updatedAt: 1000,
      },
      palaces_social_health: makeChapter(keyA, 'palaces_social_health', 'Ch4 của A', 1000),
      year_2026: {
        chapterId: 'year_2026',
        sectionCacheKey: `${keyA}::year_2026`,
        status: 'loading',
        sourceBadge: 'Sinh mới trong hồ sơ',
        updatedAt: 1000,
      },
      year_2027: makeChapter(keyA, 'year_2027', 'Lưu Niên 2027 đủ Lưu Hóa Lộc, Lưu Hóa Quyền, Lưu Hóa Khoa, Lưu Hóa Kỵ của A.', 1000),
      horizon_5y: makeChapter(keyA, 'horizon_5y', 'Ch7 của A', 1000),
      horizon_10y: makeChapter(keyA, 'horizon_10y', 'Ch8 của A', 1000),
    };

    // Toàn bộ 8/8 chương khi truyền chartB phải trả về 'idle' & sectionCacheKey của B
    for (const spec of DOSSIER_CHAPTER_SPECS) {
      const resB = resolveDossierChapterFromCaches(chartB, spec, {}, foreignLocalChapters);
      assert.equal(resB.status, 'idle', `Expected idle for ${spec.id}`);
      assert.equal(resB.text, undefined);
      assert.equal(resB.incompleteText, undefined);
      assert.equal(resB.sectionCacheKey, `${keyB}::${spec.id}`);
    }

    // Khi gọi đúng chartA thì trả về đúng trạng thái của A
    assert.equal(
      resolveDossierChapterFromCaches(chartA, DOSSIER_CHAPTER_SPECS[0], {}, foreignLocalChapters).status,
      'completed',
    );
    assert.equal(
      resolveDossierChapterFromCaches(chartA, DOSSIER_CHAPTER_SPECS[1], {}, foreignLocalChapters).status,
      'incomplete',
    );
    assert.equal(
      resolveDossierChapterFromCaches(chartA, DOSSIER_CHAPTER_SPECS[4], {}, foreignLocalChapters).status,
      'loading',
    );

    // LK-10: Giả lập bản ghi trong sessionStorage bị gán nhầm chartIdentityKey của A dưới key của B
    ss.setItem(
      buildDossierStorageKey(keyB),
      JSON.stringify({
        chartIdentityKey: keyA,
        updatedAt: 2000,
        sections: {
          year_2026: makeChapter(keyA, 'year_2026', 'Dữ liệu A lọt vào slot B', 2000),
        },
      }),
    );
    assert.equal(getDossierReadState(keyB, chartB).record, null);
    assert.equal(readDossierCacheEntry(ss, buildDossierStorageKey(keyB), chartB), null);
  });

  // TEST-L17 (LK-05, LK-08, LK-09): Xóa chương lẻ, xóa dossier_only, chống hồi sinh từ ziwei_history & No-Op Guard
  await runTest('TEST-L17: Single-chapter delete, dossier_only cleanup, tombstone anti-resurrection from ziwei_history, and migration No-Op guard', async () => {
    const { ls, ss, idb } = setupFreshTestEnv();
    await initChartLibrary();

    const formX = makeForm({ name: 'Nguyễn Thử Nghiệm X', year: '1996', month: '6', day: '18' });
    const chartX = generateChart(formToBirthInfo(formX));
    const keyX = upsertChartToLibrary(formX, { nowMs: 1000 }).entry!.chartIdentityKey;

    saveDossierSectionToLibrary(chartX, 'chapter_overview', makeChapter(keyX, 'chapter_overview', 'Ch1 X sạch.', 2000));
    saveDossierSectionToLibrary(chartX, 'year_2026', makeChapter(keyX, 'year_2026', 'Ch5 X Lưu Niên 2026.', 2100));
    saveDossierSectionToLibrary(chartX, 'year_2027', makeChapter(keyX, 'year_2027', 'Ch6 X Lưu Niên 2027.', 2200));

    // B1: Xóa riêng Chương 5 (year_2026) -> còn 2 chương trên cả 4 tầng
    const singleDel = removeSingleDossierChapterFromLibrary(chartX, 'year_2026', 2500);
    assert.equal(singleDel.ok, true);
    assert.ok(singleDel.previousRecord?.sections.year_2026);
    const afterB1 = getDossierReadState(keyX, chartX);
    assert.equal(afterB1.record?.sections.year_2026, undefined);
    assert.ok(afterB1.record?.sections.chapter_overview);
    assert.ok(afterB1.record?.sections.year_2027);
    const entryAfterB1 = readLibraryIndexStore().entries.find((e) => e.chartIdentityKey === keyX);
    assert.equal(entryAfterB1?.dossierSummary.completedCount, 2);
    const patchesAfterB1 = buildPeriodCachePatchesFromLibrary(chartX);
    assert.equal(Object.keys(patchesAfterB1).some((k) => k.endsWith('liunian_2026')), false);
    assert.equal(Object.keys(patchesAfterB1).some((k) => k.endsWith('liunian_2027')), true);

    // B2: Xóa toàn bộ Hồ Sơ (dossier_only) -> giữ thẻ, xóa sạch 4 tầng & buildPeriodCachePatchesFromLibrary rỗng
    const dossierOnlyDel = removeLibraryEntry(keyX, { deleteMode: 'dossier_only', nowMs: 3000 });
    assert.equal(dossierOnlyDel.ok, true);
    const entryAfterB2 = readLibraryIndexStore().entries.find((e) => e.chartIdentityKey === keyX);
    assert.ok(entryAfterB2);
    assert.equal(entryAfterB2.dossierSummary.completedCount, 0);
    assert.equal(getDossierReadState(keyX, chartX).record, null);
    assert.equal(ss.getItem(buildDossierStorageKey(keyX)), null);
    assert.equal(await idb.get(keyX), null);
    assert.deepEqual(buildPeriodCachePatchesFromLibrary(chartX), {});

    // B3: Xóa vĩnh viễn (entry_and_dossier) + kiểm tra chống hồi sinh kể cả khi ziwei_history còn sót bản cũ (savedAt <= deletedAt)
    removeLibraryEntry(keyX, { deleteMode: 'entry_and_dossier', nowMs: 4000 });
    assert.equal(readLibraryIndexStore().entries.some((e) => e.chartIdentityKey === keyX), false);
    // Giả lập bản ghi cũ sót lại trong ziwei_history với savedAt < deletedAt
    ls.setItem(
      LEGACY_HISTORY_STORAGE_KEY,
      JSON.stringify([{ id: 'x_old', label: 'Nguyễn Thử Nghiệm X', form: formX, savedAt: 1000 }]),
    );
    migrateLegacyHistoryAndDossiers(formX);
    assert.equal(readLibraryIndexStore().entries.some((e) => e.chartIdentityKey === keyX), false);

    // No-Op Guard (LK-05): chạy lại migrateLegacyHistoryAndDossiers() khi không có gì mới không làm trôi updatedAt
    const updatedAtBeforeNoOp = readLibraryIndexStore().updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    migrateLegacyHistoryAndDossiers(formX);
    assert.equal(readLibraryIndexStore().updatedAt, updatedAtBeforeNoOp);
  });

  // TEST-L18 (QĐ-M1, DM-02, DM-11): Trường hợp 1 (exact_match) 0/8, X/8, xóa 1 chương, và nhất quán form gốc
  await runTest('TEST-L18: Exact match detection preserves canonical saved form, pin/alias/notes, and tracks live chapter counts (0/8 -> 3/8 -> 2/8)', async () => {
    setupFreshTestEnv();
    await initChartLibrary();

    const formA = makeForm({ name: 'Nguyễn Văn An', year: '1995', month: '8', day: '16', clockHour: '10', clockMinute: '30' });
    const chartA = generateChart(formToBirthInfo(formA));
    const keyA = upsertChartToLibrary(formA, { nowMs: 1000 }).entry!.chartIdentityKey;
    togglePinLibraryEntry(keyA, 1100);
    updateLibraryEntryMeta(keyA, { customAlias: 'Anh An', notes: 'Ghi chú gốc' }, 1200);

    // 1A: 0/8 chương, nhập khác hoa/thường vẫn cùng nameSlug & chartIdentityKey
    const res1A = detectChartDuplicateInLibrary({ ...formA, name: 'nguyễn văn an' });
    assert.equal(res1A.kind, 'exact_match');
    if (res1A.kind === 'exact_match') {
      assert.equal(res1A.existingEntry.chartIdentityKey, keyA);
      assert.equal(res1A.completedCount, 0);
      assert.equal(res1A.existingEntry.form.name, 'Nguyễn Văn An');
    }

    // 1B: Lưu 3 chương -> completedCount === 3
    saveDossierSectionToLibrary(chartA, 'chapter_overview', makeChapter(keyA, 'chapter_overview', 'Ch1 A', 2000));
    saveDossierSectionToLibrary(chartA, 'year_2026', makeChapter(keyA, 'year_2026', 'Ch5 A Lưu Niên 2026', 2100));
    saveDossierSectionToLibrary(chartA, 'year_2027', makeChapter(keyA, 'year_2027', 'Ch6 A Lưu Niên 2027', 2200));

    const res1B = detectChartDuplicateInLibrary(formA);
    assert.equal(res1B.kind, 'exact_match');
    if (res1B.kind === 'exact_match') {
      assert.equal(res1B.completedCount, 3);
    }

    // 1C: Xóa 1 chương lẻ -> DM-11 cập nhật chính xác 2/8 (không kẹt ở 3/8)
    removeSingleDossierChapterFromLibrary(chartA, 'year_2026', 2500);
    const res1C = detectChartDuplicateInLibrary(formA);
    assert.equal(res1C.kind, 'exact_match');
    if (res1C.kind === 'exact_match') {
      assert.equal(res1C.completedCount, 2);
      const effective = resolveEffectiveDossierSummaryForEntry(res1C.existingEntry, chartA);
      assert.equal(effective.completedCount, 2);

      // Nạp lại qua upsertChartToLibrary(existingEntry.form) không tạo mục trùng, giữ nguyên pin/alias/notes
      upsertChartToLibrary(res1C.existingEntry.form, { nowMs: 3000 });
      const entries = readLibraryIndexStore().entries;
      assert.equal(entries.length, 1);
      assert.equal(entries[0].pinned, true);
      assert.equal(entries[0].customAlias, 'Anh An');
      assert.equal(entries[0].notes, 'Ghi chú gốc');
    }
  });

  // TEST-L19 (QĐ-M2, DM-04, DM-05, DM-13): Near-match Nhánh 1 & Nhánh 2 siết chặt, diff đủ trường + tách location/longitude + customAlias
  await runTest('TEST-L19: Near-match Branch 1 & hardened Branch 2 (customAlias, structural diffs prioritized, separate location/longitude)', async () => {
    setupFreshTestEnv();
    await initChartLibrary();

    const formSaved = makeForm({
      name: 'Nguyễn Văn An',
      year: '1995',
      month: '8',
      day: '16',
      clockHour: '10',
      clockMinute: '15',
      province: 'Việt Nam — Miền Bắc',
      city: 'Hà Nội',
      longitude: 105.85,
      gender: 'male',
    });
    const keySaved = upsertChartToLibrary(formSaved, { nowMs: 1000 }).entry!.chartIdentityKey;
    updateLibraryEntryMeta(keySaved, { customAlias: 'Anh An Đối Tác' }, 1100);

    // Ca 19A (Nhánh 1 — cùng 5 thành phần, khác tên, phút, nơi sinh, kinh độ)
    const formIncoming1 = makeForm({
      name: 'Trần Văn An',
      year: '1995',
      month: '8',
      day: '16',
      clockHour: '10',
      clockMinute: '45',
      province: 'Việt Nam — Miền Trung',
      city: 'Đà Nẵng',
      longitude: 108.22,
      gender: 'male',
    });
    const res19A = detectChartDuplicateInLibrary(formIncoming1);
    assert.equal(res19A.kind, 'near_match');
    if (res19A.kind === 'near_match') {
      assert.equal(res19A.candidates.length, 1);
      const cand = res19A.candidates[0];
      assert.equal(cand.matchReason, 'same_five_part_key');
      assert.equal(cand.hasStructuralChartDiff, false);
      const fields = cand.diffs.map((d) => d.field);
      assert.ok(fields.includes('name'));
      assert.ok(fields.includes('clockTime'));
      assert.ok(fields.includes('location'));
      assert.ok(fields.includes('longitude'));
      const nameDiff = cand.diffs.find((d) => d.field === 'name')!;
      assert.ok(nameDiff.savedValueVi.includes('Anh An Đối Tác'));
    }

    // Ca 19B (Nhánh 2 — khớp qua customAlias + cùng ngày sinh + cùng giới tính nhưng khác canh giờ 14:30)
    const formIncoming2 = makeForm({
      name: 'Anh An Đối Tác',
      year: '1995',
      month: '8',
      day: '16',
      clockHour: '14',
      clockMinute: '30',
      province: 'Việt Nam — Miền Bắc',
      city: 'Hà Nội',
      longitude: 105.85,
      gender: 'male',
    });
    const res19B = detectChartDuplicateInLibrary(formIncoming2);
    assert.equal(res19B.kind, 'near_match');
    if (res19B.kind === 'near_match') {
      assert.equal(res19B.candidates.length, 1);
      const cand = res19B.candidates[0];
      assert.equal(cand.matchReason, 'same_name_and_solar_date');
      assert.equal(cand.hasStructuralChartDiff, true);
      assert.equal(cand.diffs[0].affectsChartStructure, true);
      assert.ok(cand.diffs.some((d) => d.field === 'shichenBranch'));
      assert.ok(cand.diffs.some((d) => d.field === 'mingGongBranch'));
    }

    // Ca 19C (Chống báo nhiễu Nhánh 2 — DM-05): tên 1 ký tự hoặc ẩn danh hoặc khác ngày sinh -> none
    const resNoiseEmpty = detectChartDuplicateInLibrary(
      makeForm({ name: '', year: '1995', month: '8', day: '16', clockHour: '14', clockMinute: '30' }),
    );
    assert.equal(resNoiseEmpty.kind, 'none');

    const resNoiseDiffDay = detectChartDuplicateInLibrary(
      makeForm({ name: 'Nguyễn Văn An', year: '1995', month: '8', day: '17', clockHour: '14', clockMinute: '30' }),
    );
    assert.equal(resNoiseDiffDay.kind, 'none');

    // Kiểm tra bảo hiểm không rỗng của diffBirthFormsForDuplicateModal
    const directDiffs = diffBirthFormsForDuplicateModal(formSaved, formIncoming2);
    assert.ok(directDiffs.length > 0);
  });

  // TEST-L20 (DM-06 & ĐP-9): Sắp xếp 4 ứng viên theo Công thức Phân Tầng Không Chồng Lấn (1300 / 1090 / 1020 / 380) + giới hạn MAX 5
  await runTest('TEST-L20: Multi-tier near-match ranking places same-name 0/8 (1300) above diff-name pinned 8/8 (1090) and caps at 5', async () => {
    setupFreshTestEnv();
    await initChartLibrary();

    // 1) entry1: cùng 5-part, TRÙNG tên "Nguyễn Văn An", không ghim, 0/8 chương -> 1000 + 300 + 0 + 0 = 1300
    const f1 = makeForm({ name: 'Nguyễn Văn An', clockHour: '10', clockMinute: '05' });
    const k1 = upsertChartToLibrary(f1, { nowMs: 1000 }).entry!.chartIdentityKey;

    // 2) entry2: cùng 5-part, KHÁC tên "Trần Quốc Bảo", ĐÃ GHIM, 8/8 chương -> 1000 + 0 + 50 + 40 = 1090
    const f2 = makeForm({ name: 'Trần Quốc Bảo', clockHour: '10', clockMinute: '15' });
    const c2 = generateChart(formToBirthInfo(f2));
    const k2 = upsertChartToLibrary(f2, { nowMs: 2000 }).entry!.chartIdentityKey;
    togglePinLibraryEntry(k2, 2100);
    for (const spec of DOSSIER_CHAPTER_SPECS) {
      saveDossierSectionToLibrary(
        c2,
        spec.id,
        makeChapter(
          k2,
          spec.id,
          `Nội dung ${spec.id} đủ Lưu Hóa Lộc, Lưu Hóa Quyền, Lưu Hóa Khoa, Lưu Hóa Kỵ.`,
          2200,
        ),
      );
    }

    // 3) entry3: cùng 5-part, KHÁC tên "Lê Văn Hưu", không ghim, 4/8 chương -> 1000 + 0 + 0 + 20 = 1020
    const f3 = makeForm({ name: 'Lê Văn Hưu', clockHour: '10', clockMinute: '25' });
    const c3 = generateChart(formToBirthInfo(f3));
    const k3 = upsertChartToLibrary(f3, { nowMs: 3000 }).entry!.chartIdentityKey;
    for (const cid of ['chapter_overview', 'palaces_core', 'palaces_family', 'horizon_5y'] as DossierChapterId[]) {
      saveDossierSectionToLibrary(c3, cid, makeChapter(k3, cid, `Ch ${cid}`, 3100));
    }

    // 4) entry4: Nhánh 2 (khác canh giờ 14:30), TRÙNG tên "Nguyễn Văn An", ĐÃ GHIM, 6/8 chương -> 0 + 300 + 50 + 30 = 380
    const f4 = makeForm({ name: 'Nguyễn Văn An', clockHour: '14', clockMinute: '30' });
    const c4 = generateChart(formToBirthInfo(f4));
    const k4 = upsertChartToLibrary(f4, { nowMs: 4000 }).entry!.chartIdentityKey;
    togglePinLibraryEntry(k4, 4100);
    for (const cid of [
      'chapter_overview',
      'palaces_core',
      'palaces_family',
      'palaces_social_health',
      'horizon_5y',
      'horizon_10y',
    ] as DossierChapterId[]) {
      saveDossierSectionToLibrary(c4, cid, makeChapter(k4, cid, `Ch ${cid}`, 4200));
    }

    const incomingForm = makeForm({ name: 'Nguyễn Văn An', clockHour: '10', clockMinute: '45' });
    const res = detectChartDuplicateInLibrary(incomingForm);
    assert.equal(res.kind, 'near_match');
    if (res.kind === 'near_match') {
      assert.equal(res.candidates.length, 4);
      assert.deepEqual(
        res.candidates.map((c) => c.similarityScore),
        [1300, 1090, 1020, 380],
      );
      assert.deepEqual(
        res.candidates.map((c) => c.entry.chartIdentityKey),
        [k1, k2, k3, k4],
      );
      // Xác minh trực tiếp computeNearMatchSimilarityScore
      assert.equal(
        computeNearMatchSimilarityScore(
          res.candidates[0].entry,
          incomingForm,
          res.incomingFivePartKey,
          0,
        ),
        1300,
      );
    }

    // Thêm 2 ứng viên nữa để kiểm tra cắt trần MAX_NEAR_MATCH_CANDIDATES = 5
    upsertChartToLibrary(makeForm({ name: 'Phạm Ngũ Lão', clockHour: '10', clockMinute: '35' }), { nowMs: 5000 });
    upsertChartToLibrary(makeForm({ name: 'Võ Tắc Thiên', clockHour: '10', clockMinute: '40' }), { nowMs: 6000 });
    const resCapped = detectChartDuplicateInLibrary(incomingForm);
    assert.equal(resCapped.kind, 'near_match');
    if (resCapped.kind === 'near_match') {
      assert.equal(resCapped.totalCandidateCount, 6);
      assert.equal(resCapped.candidates.length, MAX_NEAR_MATCH_CANDIDATES);
    }
  });

  // TEST-L21 (Zero Cross-Chart Contamination + DM-08 Stale Entry Guard)
  await runTest('TEST-L21: Zero cross-chart dossier/period contamination across both near-match choices + Stale Entry Guard', async () => {
    setupFreshTestEnv();
    await initChartLibrary();

    const formSaved = makeForm({ name: 'Người Đã Lưu', clockHour: '10', clockMinute: '15' });
    const chartSaved = generateChart(formToBirthInfo(formSaved));
    const keySaved = upsertChartToLibrary(formSaved, { nowMs: 1000 }).entry!.chartIdentityKey;
    saveDossierSectionToLibrary(chartSaved, 'year_2026', makeChapter(keySaved, 'year_2026', 'Lưu niên 2026 của Người Đã Lưu.', 1100));
    saveDossierSectionToLibrary(chartSaved, 'year_2027', makeChapter(keySaved, 'year_2027', 'Lưu niên 2027 của Người Đã Lưu.', 1200));

    const formIncoming = makeForm({
      name: 'Người Nhập Mới',
      clockHour: '10',
      clockMinute: '45',
      province: 'Việt Nam — Miền Nam',
      city: 'TP. Hồ Chí Minh',
      longitude: 106.7,
    });
    const chartIncoming = generateChart(formToBirthInfo(formIncoming));
    const keyIncoming = buildChartIdentityKey(chartIncoming);
    assert.notEqual(keyIncoming, keySaved);

    const detected = detectChartDuplicateInLibrary(formIncoming);
    assert.equal(detected.kind, 'near_match');
    if (detected.kind !== 'near_match') return;

    // Nhánh A: Chọn "Mở lá số đã lưu" -> chỉ cập nhật lastOpenedAt của keySaved, không tạo keyIncoming
    markLibraryEntryOpened(detected.candidates[0].entry.chartIdentityKey, 2000);
    assert.equal(
      readLibraryIndexStore().entries.some((e) => e.chartIdentityKey === keyIncoming),
      false,
    );
    assert.equal(getDossierReadState(keyIncoming, chartIncoming).record, null);
    assert.deepEqual(buildPeriodCachePatchesFromLibrary(chartIncoming), {});

    // Nhánh B: Chọn "Lập lá số mới theo thông tin vừa nhập" -> keyIncoming độc lập 0/8 chương
    const createdRes = upsertChartToLibrary(formIncoming, { nowMs: 3000 });
    assert.equal(createdRes.ok, true);
    assert.equal(createdRes.entry?.chartIdentityKey, keyIncoming);
    assert.equal(createdRes.entry?.dossierSummary.completedCount, 0);
    assert.equal(getDossierReadState(keyIncoming, chartIncoming).record, null);
    assert.deepEqual(buildPeriodCachePatchesFromLibrary(chartIncoming), {});

    const savedRead = getDossierReadState(keySaved, chartSaved);
    assert.ok(savedRead.record?.sections.year_2026);
    assert.ok(savedRead.record?.sections.year_2027);

    // Nhánh C (DM-08 Stale Entry Guard): Xóa keySaved trong lúc modal đang giữ danh sách candidates
    removeLibraryEntry(keySaved, { deleteMode: 'entry_and_dossier', nowMs: 4000 });
    const freshEntryAfterDelete = readLibraryIndexStore().entries.find(
      (e) => e.chartIdentityKey === detected.candidates[0].entry.chartIdentityKey,
    );
    assert.equal(freshEntryAfterDelete, undefined);
    assert.equal(getDossierReadState(keyIncoming, chartIncoming).record, null);
    assert.deepEqual(buildPeriodCachePatchesFromLibrary(chartIncoming), {});
  });

  // TEST-L22 (Edge Cases + DM-01 + TEST-L11 Gate Pattern): Tombstones & Pure Read-Only During Slow Hydration Gate
  await runTest('TEST-L22: Tombstoned chart returns none & pure duplicate check works during slow IDB hydration gate without mutating store', async () => {
    const { ls, idb } = setupFreshTestEnv();

    // Ca 1: Xóa vĩnh viễn (entry_and_dossier) -> không báo trùng
    await initChartLibrary();
    const formX = makeForm({ name: 'Lá Số Đã Xóa X', year: '1994', month: '5', day: '12' });
    const keyX = upsertChartToLibrary(formX, { nowMs: 1000 }).entry!.chartIdentityKey;
    removeLibraryEntry(keyX, { deleteMode: 'entry_and_dossier', nowMs: 2000 });
    assert.equal(detectChartDuplicateInLibrary(formX).kind, 'none');

    // Ca 2 (DM-01 + mẫu cổng gatePromise của TEST-L11):
    // Bố trí sẵn 1 mục trong ziwei_history + 2 chương trong IndexedDB trước khi mở app
    const env2 = setupFreshTestEnv();
    const formLegacy = makeForm({ name: 'Hồ Sơ Di Trú Chậm', year: '1993', month: '7', day: '21' });
    const chartLegacy = generateChart(formToBirthInfo(formLegacy));
    const keyLegacy = buildChartIdentityKey(chartLegacy);

    env2.ls.setItem(
      LEGACY_HISTORY_STORAGE_KEY,
      JSON.stringify([{ id: 'leg_1', label: 'Hồ Sơ Di Trú Chậm', form: formLegacy, savedAt: 1500 }]),
    );
    env2.idb.records.set(keyLegacy, {
      chartIdentityKey: keyLegacy,
      updatedAt: 5000,
      sections: {
        chapter_overview: makeChapter(keyLegacy, 'chapter_overview', 'IDB Tổng Quan Chậm', 4000),
        year_2026: makeChapter(keyLegacy, 'year_2026', 'IDB Lưu Niên 2026 Chậm', 5000),
      },
    });

    let releaseIdbGate!: () => void;
    env2.idb.gatePromise = new Promise<void>((resolve) => {
      releaseIdbGate = resolve;
    });

    const initPromise = initChartLibrary(formLegacy);
    await new Promise((r) => setTimeout(r, 10));

    assert.equal(getLibraryHydrationStatus(), 'hydrating');
    const updatedAtBeforeDetect = readLibraryIndexStore().updatedAt;

    // Gọi detectChartDuplicateInLibrary 2 lần liên tiếp trong lúc IndexedDB chưa hydrated
    const res1 = detectChartDuplicateInLibrary(formLegacy);
    const res2 = detectChartDuplicateInLibrary(formLegacy);

    assert.equal(res1.kind, 'exact_match');
    assert.equal(res2.kind, 'exact_match');
    assert.equal(res1.hydrationStatus, 'hydrating');
    assert.equal(res2.hydrationStatus, 'hydrating');
    // Chứng minh detectChartDuplicateInLibrary thuần khiết 100%, không tự ghi xuống localStorage
    assert.equal(readLibraryIndexStore().updatedAt, updatedAtBeforeDetect);

    // Nhả cổng IndexedDB chậm
    releaseIdbGate();
    await initPromise;

    assert.equal(getLibraryHydrationStatus(), 'ready');
    const postDetect = detectChartDuplicateInLibrary(formLegacy);
    assert.equal(postDetect.kind, 'exact_match');
    if (postDetect.kind === 'exact_match') {
      assert.equal(postDetect.completedCount, 2);
      assert.equal(postDetect.hydrationStatus, 'ready');
    }
    const postRead = getDossierReadState(keyLegacy, chartLegacy);
    assert.equal(postRead.record?.sections.chapter_overview?.text, 'IDB Tổng Quan Chậm');
    assert.ok(postRead.record?.sections.year_2026?.text?.startsWith('IDB Lưu Niên 2026 Chậm'));
    void ls;
    void idb;
  });

  console.log(`\nChart Library verification summary: ${passed}/${total} passed.`);
  if (passed !== total) {
    process.exitCode = 1;
  }
}

void main();
