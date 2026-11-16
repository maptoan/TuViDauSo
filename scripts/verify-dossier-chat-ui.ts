import assert from 'node:assert/strict';
import { generateChart } from '../src/lib/ziwei/algorithm';
import { buildYunxianPeriodContext } from '../src/lib/ziwei/yunxian-context';
import {
  CHAT_COOLDOWN_SECONDS,
  CHAT_LRU_INDEX_KEY,
  CHAT_MAX_EXCERPT_CHARS,
  CHAT_MAX_HISTORY_MESSAGES,
  CHAT_MAX_HISTORY_MSG_CHARS,
  CHAT_SOFT_CAP_AMBER_AT,
  CHAT_SOFT_CAP_BASE,
  CHAT_SOFT_CAP_UNLOCK_STEP,
  DOSSIER_CHAPTER_SPECS,
  DOSSIER_INTER_CHAPTER_PACING_MS,
  DOSSIER_LRU_INDEX_KEY,
  DossierChapterId,
  DossierChapterState,
  MAX_CHAT_THREADS_IN_SESSION,
  MAX_DOSSIERS_IN_SESSION,
  StorageLike,
  buildChartIdentityKey,
  buildChatStorageKey,
  buildDossierChapterCacheKey,
  buildDossierMarkdownExport,
  buildDossierPlainTextExport,
  buildDossierStandaloneHtmlExport,
  buildDossierStorageKey,
  buildPeriodCacheKeyForYear,
  createInitialChatQuotaState,
  evaluateChatQuotaStatus,
  formatDossierSourceBadge,
  getChatCooldownRemainingSec,
  getSharedDossierGenerating,
  listLruSessionKeys,
  readLruSessionEntry,
  recordChatQuestionSent,
  removeLruSessionEntry,
  resolveChapterDeterministicFactSheet,
  resolveDossierChapterFromCaches,
  setSharedDossierGenerating,
  subscribeSharedDossierGenerating,
  trimChatExcerpt,
  trimChatHistoryForRequest,
  unlockExtraChatTurns,
  upsertLruSessionEntry,
} from '../src/lib/dossier-chat-ui';

class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  constructor(private readonly maxKeysBeforeQuotaError = Infinity) {}

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    const isNew = !this.map.has(key);
    if (isNew && this.map.size >= this.maxKeysBeforeQuotaError) {
      throw new Error('QuotaExceededError');
    }
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

function buildFemale1992Chart() {
  return generateChart({
    name: 'Nữ Mệnh Test 1992',
    year: 1992,
    month: 8,
    day: 20,
    hour: 8, // Giờ Thân
    gender: 'female',
    longitude: 105.85,
  });
}

let passed = 0;
let total = 0;

function runTest(name: string, fn: () => void) {
  total += 1;
  try {
    fn();
    passed += 1;
    console.log(`PASS [${total}]: ${name}`);
  } catch (err) {
    console.error(`FAIL [${total}]: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

runTest('LRU sessionStorage cho Chat (tối đa 10 mạch) & Hồ Sơ (tối đa 5 hồ sơ) + xử lý QuotaExceededError', () => {
  assert.equal(MAX_CHAT_THREADS_IN_SESSION, 10);
  assert.equal(MAX_DOSSIERS_IN_SESSION, 5);

  const chatStore = new MemoryStorage();
  for (let i = 1; i <= 12; i++) {
    const key = buildChatStorageKey('chart_a', `ctx_${i}`);
    const res = upsertLruSessionEntry(
      chatStore,
      CHAT_LRU_INDEX_KEY,
      key,
      { i },
      MAX_CHAT_THREADS_IN_SESSION,
      1000 + i * 10,
    );
    assert.equal(res.ok, true);
  }

  const chatKeys = listLruSessionKeys(chatStore, CHAT_LRU_INDEX_KEY);
  assert.equal(chatKeys.length, 10);
  assert.equal(readLruSessionEntry(chatStore, CHAT_LRU_INDEX_KEY, buildChatStorageKey('chart_a', 'ctx_1')), null);
  assert.equal(readLruSessionEntry(chatStore, CHAT_LRU_INDEX_KEY, buildChatStorageKey('chart_a', 'ctx_2')), null);
  assert.deepEqual(readLruSessionEntry(chatStore, CHAT_LRU_INDEX_KEY, buildChatStorageKey('chart_a', 'ctx_12')), { i: 12 });

  // Chạm lại ctx_3 lên đầu LRU, thêm ctx_13 -> ctx_4 bị đẩy thay vì ctx_3
  upsertLruSessionEntry(
    chatStore,
    CHAT_LRU_INDEX_KEY,
    buildChatStorageKey('chart_a', 'ctx_3'),
    { i: 3, refreshed: true },
    MAX_CHAT_THREADS_IN_SESSION,
    2000,
  );
  upsertLruSessionEntry(
    chatStore,
    CHAT_LRU_INDEX_KEY,
    buildChatStorageKey('chart_a', 'ctx_13'),
    { i: 13 },
    MAX_CHAT_THREADS_IN_SESSION,
    2010,
  );
  assert.ok(readLruSessionEntry(chatStore, CHAT_LRU_INDEX_KEY, buildChatStorageKey('chart_a', 'ctx_3')));
  assert.equal(readLruSessionEntry(chatStore, CHAT_LRU_INDEX_KEY, buildChatStorageKey('chart_a', 'ctx_4')), null);

  removeLruSessionEntry(chatStore, CHAT_LRU_INDEX_KEY, buildChatStorageKey('chart_a', 'ctx_13'));
  assert.equal(listLruSessionKeys(chatStore, CHAT_LRU_INDEX_KEY).length, 9);

  // Dossier LRU max 5
  const dossierStore = new MemoryStorage();
  for (let i = 1; i <= 7; i++) {
    const k = buildDossierStorageKey(`chart_${i}`);
    upsertLruSessionEntry(dossierStore, DOSSIER_LRU_INDEX_KEY, k, { i }, MAX_DOSSIERS_IN_SESSION, 3000 + i);
  }
  assert.equal(listLruSessionKeys(dossierStore, DOSSIER_LRU_INDEX_KEY).length, 5);
  assert.equal(readLruSessionEntry(dossierStore, DOSSIER_LRU_INDEX_KEY, buildDossierStorageKey('chart_1')), null);
  assert.equal(readLruSessionEntry(dossierStore, DOSSIER_LRU_INDEX_KEY, buildDossierStorageKey('chart_2')), null);

  // Mô phỏng QuotaExceededError: giới hạn tối đa 4 key (3 entries + 1 index)
  const tightStore = new MemoryStorage(4);
  for (let i = 1; i <= 3; i++) {
    upsertLruSessionEntry(tightStore, DOSSIER_LRU_INDEX_KEY, `k${i}`, { i }, 5, 4000 + i);
  }
  const quotaRes = upsertLruSessionEntry(tightStore, DOSSIER_LRU_INDEX_KEY, 'k4', { i: 4 }, 5, 4010);
  assert.equal(quotaRes.ok, true);
  assert.ok(quotaRes.evictedKeys.includes('k1'));
  assert.deepEqual(readLruSessionEntry(tightStore, DOSSIER_LRU_INDEX_KEY, 'k4'), { i: 4 });
});

runTest('F7 Hàng rào Chat (8s cooldown + trần mềm 15 + mở thêm 5 + khóa tuần tự + trim 6000/6x1200)', () => {
  assert.equal(CHAT_COOLDOWN_SECONDS, 8);
  assert.equal(CHAT_SOFT_CAP_BASE, 15);
  assert.equal(CHAT_SOFT_CAP_AMBER_AT, 10);
  assert.equal(CHAT_SOFT_CAP_UNLOCK_STEP, 5);

  let q = createInitialChatQuotaState();
  const baseMs = 1_000_000;
  let ev = evaluateChatQuotaStatus(q, { nowMs: baseMs });
  assert.equal(ev.canSend, true);
  assert.equal(ev.sendButtonLabel, 'Gửi câu hỏi');

  q = recordChatQuestionSent(q, baseMs);
  assert.equal(q.usedCount, 1);
  assert.equal(getChatCooldownRemainingSec(q.lastSentAtMs, baseMs + 100), 8);
  assert.equal(getChatCooldownRemainingSec(q.lastSentAtMs, baseMs + 4500), 4);
  assert.equal(getChatCooldownRemainingSec(q.lastSentAtMs, baseMs + 8000), 0);

  const duringCooldown = evaluateChatQuotaStatus(q, { nowMs: baseMs + 2500 });
  assert.equal(duringCooldown.canSend, false);
  assert.equal(duringCooldown.cooldownRemainingSec, 6);
  assert.equal(duringCooldown.sendButtonLabel, 'Gửi (6s)');

  // Mốc nhắc hổ phách từ câu 10
  const tenth = createInitialChatQuotaState(10, 15, baseMs - 10_000);
  const tenthEv = evaluateChatQuotaStatus(tenth, { nowMs: baseMs });
  assert.equal(tenthEv.showAmberReminder, true);
  assert.equal(tenthEv.isCapReached, false);
  assert.equal(tenthEv.canSend, true);

  // Chạm trần 15 -> khóa & mở thêm 5
  const capped = createInitialChatQuotaState(15, 15, baseMs - 10_000);
  const cappedEv = evaluateChatQuotaStatus(capped, { nowMs: baseMs });
  assert.equal(cappedEv.isCapReached, true);
  assert.equal(cappedEv.canSend, false);

  const unlocked = unlockExtraChatTurns(capped);
  assert.equal(unlocked.capLimit, 20);
  const unlockedEv = evaluateChatQuotaStatus(unlocked, { nowMs: baseMs });
  assert.equal(unlockedEv.isCapReached, false);
  assert.equal(unlockedEv.canSend, true);

  // Khóa tuần tự shared state khi Hồ Sơ đang sinh
  const observed: boolean[] = [];
  const unsub = subscribeSharedDossierGenerating((val) => observed.push(val));
  setSharedDossierGenerating(true);
  assert.equal(getSharedDossierGenerating(), true);
  const blockedEv = evaluateChatQuotaStatus(unlocked, {
    nowMs: baseMs,
    isDossierGenerating: getSharedDossierGenerating(),
  });
  assert.equal(blockedEv.isBlockedByDossier, true);
  assert.equal(blockedEv.canSend, false);
  assert.equal(blockedEv.lockReason, 'Đang sinh chương hồ sơ, vui lòng đợi…');
  setSharedDossierGenerating(false);
  unsub();
  assert.deepEqual(observed, [true, false]);

  // Kiểm tra trim excerpt 6000 & history 6x1200
  const longExcerpt = 'A'.repeat(CHAT_MAX_EXCERPT_CHARS + 500);
  assert.equal(trimChatExcerpt(longExcerpt).length, CHAT_MAX_EXCERPT_CHARS);

  const manyMsgs = Array.from({ length: 10 }, (_, idx) => ({
    id: `m${idx}`,
    role: (idx % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `${idx}_` + 'B'.repeat(CHAT_MAX_HISTORY_MSG_CHARS + 200),
    timestamp: idx,
  }));
  const trimmedHistory = trimChatHistoryForRequest(manyMsgs);
  assert.equal(trimmedHistory.length, CHAT_MAX_HISTORY_MESSAGES);
  assert.ok(trimmedHistory[0].content.startsWith('4_'));
  assert.equal(trimmedHistory[0].content.length, CHAT_MAX_HISTORY_MSG_CHARS);
});

runTest('Danh sách 8 chương hồ sơ đúng thứ tự + khóa cache + sourceBadge kế thừa/sinh mới', () => {
  assert.equal(DOSSIER_INTER_CHAPTER_PACING_MS, 2200);
  assert.equal(DOSSIER_CHAPTER_SPECS.length, 8);
  assert.deepEqual(
    DOSSIER_CHAPTER_SPECS.map((s) => s.id),
    [
      'chapter_overview',
      'palaces_core',
      'palaces_family',
      'palaces_social_health',
      'year_2026',
      'year_2027',
      'horizon_5y',
      'horizon_10y',
    ],
  );
  assert.equal(DOSSIER_CHAPTER_SPECS[0].sectionId, 'chapter_overview');
  assert.equal(DOSSIER_CHAPTER_SPECS[1].sectionId, 'palaces_core');
  assert.equal(DOSSIER_CHAPTER_SPECS[2].sectionId, 'palaces_family');
  assert.equal(DOSSIER_CHAPTER_SPECS[3].sectionId, 'palaces_social_health');
  assert.equal(DOSSIER_CHAPTER_SPECS[4].year, 2026);
  assert.equal(DOSSIER_CHAPTER_SPECS[5].year, 2027);
  assert.equal(DOSSIER_CHAPTER_SPECS[6].sectionId, 'horizon_5y');
  assert.equal(DOSSIER_CHAPTER_SPECS[7].sectionId, 'horizon_10y');

  const chart = buildFemale1992Chart();
  const chartId = buildChartIdentityKey(chart);
  assert.equal(chartId, '1992_8_20_8_female');
  assert.equal(buildDossierChapterCacheKey(chartId, 'palaces_core'), '1992_8_20_8_female::palaces_core');

  const pCtx2026 = buildYunxianPeriodContext(chart, { mode: 'liunian', year: 2026 });
  assert.ok(pCtx2026);
  assert.equal(buildPeriodCacheKeyForYear(chart, 2026), pCtx2026.cacheKey);

  // Kiểm tra sourceBadge kế thừa từ aiPeriodCache (đồng bộ 2 chiều với Vận Hạn)
  const spec2026 = DOSSIER_CHAPTER_SPECS[4];
  const resolvedCached = resolveDossierChapterFromCaches(
    chart,
    spec2026,
    {
      [pCtx2026.cacheKey]: {
        text: 'Luận giải Lưu Niên 2026 đầy đủ từ Vận Hạn.',
        meta: {
          keyId: 'k1',
          maskedKey: 'AIza...test',
          label: 'Key 1',
          modelUsed: 'gemini-3.5-flash-lite',
          usedFallbackModel: false,
          failoverAttempts: 1,
          latencyMs: 900,
        },
      },
    },
    {},
  );
  assert.equal(resolvedCached.status, 'completed');
  assert.equal(resolvedCached.sourceBadge, 'Kế thừa từ bộ nhớ đệm');

  // Kiểm tra sinh mới trong hồ sơ
  const resolvedGenerated = resolveDossierChapterFromCaches(
    chart,
    spec2026,
    {
      [pCtx2026.cacheKey]: {
        text: 'Luận giải Lưu Niên 2026 mới sinh trong hồ sơ.',
      },
    },
    {
      year_2026: {
        chapterId: 'year_2026',
        sectionCacheKey: buildDossierChapterCacheKey(chartId, 'year_2026'),
        status: 'completed',
        text: 'Luận giải Lưu Niên 2026 mới sinh trong hồ sơ.',
        sourceBadge: formatDossierSourceBadge('generated'),
      },
    },
  );
  assert.equal(resolvedGenerated.sourceBadge, 'Sinh mới trong hồ sơ');

  // Nếu cache kỳ 2026 bị ngắt giữa chừng -> incomplete (không phải completed)
  const resolvedIncomplete = resolveDossierChapterFromCaches(
    chart,
    spec2026,
    {
      [pCtx2026.cacheKey]: {
        incomplete: true,
        incompleteText: 'Đoạn dở...',
        interruptedReason: 'Ngắt luồng',
      },
    },
    {},
  );
  assert.equal(resolvedIncomplete.status, 'incomplete');

  // Kiểm tra dữ kiện xác định của chương horizon_5y sẵn sàng không cần API key
  const horizon5Fact = resolveChapterDeterministicFactSheet(chart, DOSSIER_CHAPTER_SPECS[6]);
  assert.ok(horizon5Fact.factSheetMarkdown.includes('2026'));
  assert.ok(horizon5Fact.factSheetMarkdown.includes('2030'));
});

runTest('F1 Xuất bản .HTML Giấy Cổ (offline + @media print + CHƯA HOÀN TẤT) & .MD / Plain Text', () => {
  const chart = buildFemale1992Chart();
  const chartId = buildChartIdentityKey(chart);
  const states = {} as Record<DossierChapterId, DossierChapterState>;

  for (const spec of DOSSIER_CHAPTER_SPECS) {
    states[spec.id] = {
      chapterId: spec.id,
      sectionCacheKey: buildDossierChapterCacheKey(chartId, spec.id),
      status: 'idle',
    };
  }

  states.chapter_overview = {
    chapterId: 'chapter_overview',
    sectionCacheKey: buildDossierChapterCacheKey(chartId, 'chapter_overview'),
    status: 'completed',
    text: '### 1. Bức Tranh Bản Mệnh\nNội dung luận giải **Thái Dương** chuẩn xác.',
    sourceBadge: 'Sinh mới trong hồ sơ',
    meta: {
      keyId: 'k1',
      maskedKey: 'AIzaSyAb...1234',
      label: 'Key 1',
      modelUsed: 'gemini-3.5-flash-lite',
      usedFallbackModel: false,
      failoverAttempts: 1,
      latencyMs: 1200,
    },
  };

  states.palaces_core = {
    chapterId: 'palaces_core',
    sectionCacheKey: buildDossierChapterCacheKey(chartId, 'palaces_core'),
    status: 'incomplete',
    incompleteText: '### Cung Mệnh\nĐoạn dở đang viết giữa chừng...',
    interruptedReason: 'STREAM_TIMEOUT',
  };

  const html = buildDossierStandaloneHtmlExport(chart, states, new Date('2026-11-17T02:00:00Z'));
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.ok(html.includes('--paper-bg: #FBF8F1'));
  assert.ok(html.includes('color-scheme: light'));
  assert.ok(html.includes('@media print'));
  assert.ok(html.includes('Sinh mới trong hồ sơ'));
  assert.ok(html.includes('gemini-3.5-flash-lite'));
  assert.ok(html.includes('AIzaSyAb...1234'));
  assert.ok(html.includes('CHƯA HOÀN TẤT'));
  assert.ok(html.includes('Đoạn dở đang viết giữa chừng...'));
  assert.equal(/AIza[0-9A-Za-z_-]{20,}/.test(html), false);

  const md = buildDossierMarkdownExport(chart, states);
  assert.ok(md.includes('Hoàn tất'));
  assert.ok(md.includes('CHƯA HOÀN TẤT'));
  assert.ok(md.includes('1/8 chương'));

  const plain = buildDossierPlainTextExport(chart, states);
  assert.ok(plain.includes('HỒ SƠ LUẬN GIẢI TỬ VI THIÊN KỶ'));
});

console.log(`\nKết quả verify-dossier-chat-ui: ${passed}/${total} bài kiểm chứng ĐẠT.`);
