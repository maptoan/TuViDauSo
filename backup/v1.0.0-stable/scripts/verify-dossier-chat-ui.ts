import assert from 'node:assert/strict';
import { generateChart } from '../src/lib/ziwei/algorithm';
import { buildYunxianPeriodContext, formatPeriodSiHuaFactLine } from '../src/lib/ziwei/yunxian-context';
import { formatCanonicalPalaceHeading } from '../src/lib/ziwei/dossier-context';
import {
  enforceCanonicalPalaceGroupHeadings,
  sanitizeAiVietnameseOutput,
  sanitizeLayer3AOnly,
  verifyAndEnsureCompletePeriodSiHua,
} from '../src/lib/ziwei/text-sanitizer';
import { formatChartSummaryVi } from '../src/lib/ziwei/vi-i18n';
import { formToBirthInfo } from '../src/lib/ziwei/share';
import type { BirthFormState } from '../src/lib/ziwei/types';
import { shouldRefreshKeyPoolSnapshot } from '../src/lib/key-pool-ui';
import {
  buildStrictDossierSectionPrompt,
  buildStrictExplanationChatPrompt,
  buildStrictPeriodAiPrompt,
} from '../server';
import {
  BRANCH_GRID_POS,
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
  buildDeterministicChartGridHtml,
  buildDeterministicExecutiveSummaryVi,
  buildDossierChapterCacheKey,
  buildDossierHeaderMetadata,
  buildDossierMarkdownExport,
  buildDossierPageOneHtml,
  buildDossierPlainTextExport,
  buildDossierStandaloneHtmlExport,
  buildDossierStorageKey,
  buildMultiYearMatrixTableHtml,
  buildPeriodCacheKeyForYear,
  createInitialChatQuotaState,
  evaluateChatQuotaStatus,
  formatDossierSourceBadge,
  getChatCooldownRemainingSec,
  getSharedDossierGenerating,
  listLruSessionKeys,
  readDossierCacheEntry,
  readLruSessionEntry,
  recordChatQuestionSent,
  removeLruSessionEntry,
  resolveChapterDeterministicFactSheet,
  resolveDossierChapterFromCaches,
  setSharedDossierGenerating,
  stripInternalExportMetaLines,
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
  assert.equal(html.includes('Sinh mới trong hồ sơ'), false);
  assert.equal(html.includes('gemini-3.5-flash-lite'), false);
  assert.equal(html.includes('AIzaSyAb...1234'), false);
  assert.equal(html.includes('Khóa:'), false);
  assert.ok(html.includes('CHƯA HOÀN TẤT'));
  assert.ok(html.includes('Đoạn dở đang viết giữa chừng...'));
  assert.equal(/AIza[0-9A-Za-z_-]{20,}/.test(html), false);

  const md = buildDossierMarkdownExport(chart, states);
  assert.ok(md.includes('Hoàn tất'));
  assert.ok(md.includes('CHƯA HOÀN TẤT'));
  assert.ok(md.includes('1/8 chương'));
  assert.equal(md.includes('Sinh mới trong hồ sơ'), false);
  assert.equal(md.includes('gemini-3.5-flash-lite'), false);
  assert.equal(md.includes('Khóa:'), false);

  const plain = buildDossierPlainTextExport(chart, states);
  assert.ok(plain.includes('HỒ SƠ LUẬN GIẢI TỬ VI THIÊN KỶ'));
  assert.equal(plain.includes('Khóa:'), false);
  assert.equal(states.chapter_overview.sourceBadge, 'Sinh mới trong hồ sơ');
  assert.equal(states.chapter_overview.meta?.modelUsed, 'gemini-3.5-flash-lite');
});

runTest('B1 Làm mới snapshot KeyPoolModal khi trở thành lớp phủ trên cùng + Việc 1 siết chống bịa tên sao Chat', () => {
  // Đang đóng -> không fetch
  assert.equal(
    shouldRefreshKeyPoolSnapshot({
      open: false,
      wasOpen: false,
      hadOtherOverlayOpen: false,
      hasOtherOverlayOpen: false,
    }),
    false,
  );

  // Vừa mở (false -> true) -> fetch 1 lần
  assert.equal(
    shouldRefreshKeyPoolSnapshot({
      open: true,
      wasOpen: false,
      hadOtherOverlayOpen: true,
      hasOtherOverlayOpen: true,
    }),
    true,
  );

  // Vẫn đang mở sẵn và không có chuyển đổi -> KHÔNG polling liên tục
  assert.equal(
    shouldRefreshKeyPoolSnapshot({
      open: true,
      wasOpen: true,
      hadOtherOverlayOpen: false,
      hasOtherOverlayOpen: false,
    }),
    false,
  );

  // Vẫn đang mở sẵn nhưng modal/drawer khác (DetailedDossierModal / ContextualChatDrawer) vừa đóng -> trở lại trên cùng -> fetch 1 lần
  assert.equal(
    shouldRefreshKeyPoolSnapshot({
      open: true,
      wasOpen: true,
      hadOtherOverlayOpen: true,
      hasOtherOverlayOpen: false,
    }),
    true,
  );

  // Cửa sổ lấy lại focus khi đang mở trên cùng -> fetch 1 lần; nhưng nếu đang batch probe hoặc đang bị modal khác che -> bỏ qua
  assert.equal(
    shouldRefreshKeyPoolSnapshot({
      open: true,
      wasOpen: true,
      hadOtherOverlayOpen: false,
      hasOtherOverlayOpen: false,
      regainedWindowFocus: true,
    }),
    true,
  );
  assert.equal(
    shouldRefreshKeyPoolSnapshot({
      open: true,
      wasOpen: true,
      hadOtherOverlayOpen: true,
      hasOtherOverlayOpen: false,
      isBatchProbing: true,
    }),
    false,
  );

  // Kiểm tra Việc 1: buildStrictExplanationChatPrompt chứa đủ 3 luật chống bịa mới & giữ giới hạn 150–350 từ
  const chart = buildFemale1992Chart();
  const built = buildStrictExplanationChatPrompt({
    chart,
    contextMode: 'natal',
    sectionTitle: 'Tổng Quan Bản Mệnh',
    excerpt: 'Luận giải mẫu...',
    history: [],
    question: 'Cung Mệnh có sao Giải Thần hay Niên Giải không?',
  });
  assert.ok(built.systemInstruction.includes('KHÔNG CÓ trong lá số/dữ kiện hiện có'));
  assert.ok(built.systemInstruction.includes('TUYỆT ĐỐI KHÔNG tự gán sao đó sang cung khác'));
  assert.ok(built.systemInstruction.includes('Giải Thần, Niên Giải và Thiên Giải'));
  assert.ok(built.systemInstruction.includes('150–350 từ'));
});

function buildNguyenVanAn1995Chart() {
  return generateChart({
    name: 'Nguyễn Văn An',
    year: 1995,
    month: 8,
    day: 16,
    hour: 5, // Giờ Tỵ (10:30 tại Hà Nội)
    gender: 'male',
    longitude: 105.85,
  });
}

runTest('[PHA 1 · TEST-1] sanitizeAiVietnameseOutput & sanitizeLayer3AOnly (S3/S4 — P1/T3)', () => {
  const f2a =
    'Trong cácφ cung hạn hiện tại, mức căngđộ công việc tăng cao, kho lứa dồi dào nhưng tính cách hơi bảo Thủ.';
  const expected2a =
    'Trong các cung hạn hiện tại, mức căng độ công việc tăng cao, kho lúa dồi dào nhưng tính cách hơi bảo thủ.';
  const cleaned2a = sanitizeAiVietnameseOutput(f2a);
  assert.equal(cleaned2a, expected2a);
  assert.equal(sanitizeAiVietnameseOutput(cleaned2a), cleaned2a, 'Phải lũy đẳng');

  const f2b = 'Tỷ lệ 85% • Cung Mệnh ↔ Thiên Di – Tử Vi (紫微)';
  const cleanedNoHan = sanitizeAiVietnameseOutput(f2b, { allowHan: false });
  assert.equal(cleanedNoHan, 'Tỷ lệ 85% • Cung Mệnh ↔ Thiên Di – Tử Vi');
  assert.equal(sanitizeAiVietnameseOutput(cleanedNoHan, { allowHan: false }), cleanedNoHan);

  const cleanedWithHan = sanitizeAiVietnameseOutput(f2b, { allowHan: true });
  assert.equal(cleanedWithHan, f2b);

  // Chống dương tính giả với Canh Thìn, Canh Dần, tên sao & tên cung
  const f2c = 'Sao Vũ Khúc đóng tại cung Tài Bạch, tuổi Canh Thìn và Canh Dần; Kho lứa ở quê.';
  const cleaned2c = sanitizeAiVietnameseOutput(f2c);
  assert.equal(
    cleaned2c,
    'Sao Vũ Khúc đóng tại cung Tài Bạch, tuổi Canh Thìn và Canh Dần; Kho lúa ở quê.',
  );

  // sanitizeLayer3AOnly an toàn cho chunk SSE đơn lẻ: xóa φ, KHÔNG tách "căngđộ"
  const sseChunk = 'mức căngđộ và cácφ điểm (紫微)';
  assert.equal(sanitizeLayer3AOnly(sseChunk), 'mức căngđộ và các điểm ()');
  assert.equal(sanitizeLayer3AOnly(sseChunk, true), 'mức căngđộ và các điểm (紫微)');
});

runTest('[PHA 1 · TEST-2] verifyAndEnsureCompletePeriodSiHua cho Chương 5 thiếu 2 hóa (S1 / QĐ-G1)', () => {
  const anChart = buildNguyenVanAn1995Chart();
  const ctx2026 = buildYunxianPeriodContext(anChart, { mode: 'liunian', year: 2026 });
  assert.ok(ctx2026);

  const quyen = ctx2026.periodSiHua.find((s) => s.mutagenKey === '权')!;
  const ky = ctx2026.periodSiHua.find((s) => s.mutagenKey === '忌')!;
  const loc = ctx2026.periodSiHua.find((s) => s.mutagenKey === '禄')!;
  const khoa = ctx2026.periodSiHua.find((s) => s.mutagenKey === '科')!;

  // Cố tình nhắc tên sao Thiên Đồng (của Hóa Lộc) ở mục 1 (bản mệnh, không có Hóa Lộc)
  // và nhắc "(Lộc · Quyền · Khoa · Kỵ)" ở tiêu đề mục 2 để kiểm chứng không khớp giả.
  const incompleteChapter5 = [
    `### 1. Bức Tranh Lưu Niên 2026`,
    `Tại cung bản mệnh có ${loc.starNameVi} tọa thủ nhưng năm nay chịu áp lực thay đổi.`,
    ``,
    `### 2. Tổ Hợp Sao Kích Hoạt & Tứ Hóa Kỳ Hạn (Lộc · Quyền · Khoa · Kỵ)`,
    `- **${quyen.starNameVi} ${quyen.mutagenVi}** tại Cung ${quyen.periodPalaceRoleVi} thúc đẩy quyền tự chủ.`,
    `- **${ky.starNameVi} ${ky.mutagenVi}** tại Cung ${ky.periodPalaceRoleVi} xung chiếu Cung ${ky.oppositePeriodPalaceRoleVi}.`,
    ``,
    `### 4. Lời Khuyên Thực Tiễn`,
    `Hành sự điềm tĩnh, giữ kỷ luật tài chính.`,
  ].join('\n');

  const res1 = verifyAndEnsureCompletePeriodSiHua(incompleteChapter5, ctx2026.periodSiHua, {
    prefix: 'Lưu',
  });
  assert.equal(res1.isComplete, false);
  assert.deepEqual(
    res1.missingEntries.map((m) => m.mutagenVi),
    [loc.mutagenVi, khoa.mutagenVi],
  );

  const adviceIdx = res1.patchedText.indexOf('Hành sự điềm tĩnh, giữ kỷ luật tài chính.');
  const addendumHeader = '> 📌 **[Tổng Hợp Đầy Đủ Tứ Hóa Kỳ Hạn Theo Lá Số]**';
  const addendumIdx = res1.patchedText.indexOf(addendumHeader);
  assert.ok(adviceIdx >= 0 && addendumIdx > adviceIdx, 'Khối bổ khuyết phải nối ở CUỐI CHƯƠNG (sau mục Lời Khuyên)');
  assert.ok(res1.patchedText.includes('(Can Bính)'), 'Phải ghi rõ Thiên Can năm Lưu Niên');

  for (const sh of ctx2026.periodSiHua) {
    assert.ok(
      res1.patchedText.includes(formatPeriodSiHuaFactLine(sh, 'Lưu')),
      `Phải dùng chung formatPeriodSiHuaFactLine cho ${sh.mutagenVi}`,
    );
  }

  // Lũy đẳng khi kiểm tra lại patchedText
  const res2 = verifyAndEnsureCompletePeriodSiHua(res1.patchedText, ctx2026.periodSiHua, {
    prefix: 'Lưu',
  });
  assert.equal(res2.isComplete, true);
  assert.equal(res2.missingEntries.length, 0);
  assert.equal(res2.patchedText, res1.patchedText);

  // Văn bản đã đủ 4 hóa thì không thêm gì
  const completeText = [
    `### 2. Tứ Hóa`,
    `${loc.starNameVi} ${loc.mutagenVi}, ${quyen.starNameVi} ${quyen.mutagenVi}, ${khoa.starNameVi} ${khoa.mutagenVi}, ${ky.starNameVi} ${ky.mutagenVi}.`,
  ].join('\n');
  const res3 = verifyAndEnsureCompletePeriodSiHua(completeText, ctx2026.periodSiHua, {
    prefix: 'Lưu',
  });
  assert.equal(res3.isComplete, true);
  assert.equal(res3.missingEntries.length, 0);
  assert.equal(res3.patchedText, completeText);
});

runTest('[PHA 1 · TEST-4] enforceCanonicalPalaceGroupHeadings cho Chương 2/3/4 (S4 / QĐ-G4)', () => {
  const anChart = buildNguyenVanAn1995Chart();
  const mingPalace = anChart.palaces.find((p) => p.isMingGong)!;
  const phuMauPalace = anChart.palaces.find((p) => p.name.includes('父母'))!;
  const ziNvPalace = anChart.palaces.find((p) => p.name.includes('子女'))!;

  const expectedMing = formatCanonicalPalaceHeading(mingPalace);
  const expectedPhuMau = formatCanonicalPalaceHeading(phuMauPalace);
  const expectedZiNv = formatCanonicalPalaceHeading(ziNvPalace);

  assert.ok(expectedMing.includes('[AN MỆNH]'));
  assert.ok(expectedPhuMau.includes('[Đại hạn '));

  const sampleText = [
    `### Cung Mệnh (Ất Mão)`,
    `Nội dung luận giải cung Mệnh.`,
    ``,
    `### 2. Cung Tử Tức (Canh Tuất)`,
    `Nội dung luận giải cung Tử Nữ.`,
    ``,
    `### Cung Phụ Mẫu (Quý Mùi)`,
    `Nội dung luận giải cung Phụ Mẫu thiếu Đại hạn.`,
    ``,
    `### Cung Mệnh và Quan Lộc`,
    `Tiêu đề gộp nhiều cung phải giữ nguyên.`,
    ``,
    `### Cung Lạ Hoắc`,
    `Tiêu đề lạ phải giữ nguyên.`,
    ``,
    `### Lời Khuyên Thực Tiễn`,
    `Tiêu đề không phải cung phải giữ nguyên.`,
  ].join('\n');

  const normalized = enforceCanonicalPalaceGroupHeadings(sampleText, anChart);
  assert.ok(normalized.includes(expectedMing), `Phải chuẩn hóa Mệnh thành ${expectedMing}`);
  assert.ok(normalized.includes(expectedZiNv), `Phải chuẩn hóa alias Tử Tức thành ${expectedZiNv}`);
  assert.ok(normalized.includes(expectedPhuMau), `Phải chuẩn hóa Phụ Mẫu thành ${expectedPhuMau}`);
  assert.ok(normalized.includes('### Cung Mệnh và Quan Lộc'), 'Không được đè tiêu đề gộp nhiều cung');
  assert.ok(normalized.includes('### Cung Lạ Hoắc'), 'Phải giữ nguyên tiêu đề không xác định');
  assert.ok(normalized.includes('### Lời Khuyên Thực Tiễn'), 'Phải giữ nguyên tiêu đề không phải cung');
  assert.equal(
    enforceCanonicalPalaceGroupHeadings(normalized, anChart),
    normalized,
    'enforceCanonicalPalaceGroupHeadings phải lũy đẳng',
  );
});

runTest('[PHA 2 · TEST-5] QĐ-G5 S5 (giờ chưa rõ) + Làm sạch cache cũ T2 + Trang 1 (B1+B6+B2) + B3/B4/B5', () => {
  // 1) Trường hợp chưa rõ giờ sinh (!origInput) -> phải báo đúng chuỗi chuẩn QĐ-G5 trên mọi kênh xuất
  const unknownTimeChart = generateChart({
    name: 'Khách Ẩn Giờ Sinh',
    year: 1990,
    month: 5,
    day: 12,
    hour: 0, // mặc định Giờ Tý
    gender: 'female',
    longitude: 105.0,
  });
  const unknownHeader = buildDossierHeaderMetadata(unknownTimeChart);
  assert.equal(unknownHeader.hasExactBirthTime, false);
  assert.equal(
    unknownHeader.birthTimeFullSummaryVi,
    'Chưa rõ giờ đồng hồ gốc (lập lá số mặc định theo Giờ Tý).',
  );

  const emptyStates = {} as Record<DossierChapterId, DossierChapterState>;
  const unknownId = buildChartIdentityKey(unknownTimeChart);
  for (const spec of DOSSIER_CHAPTER_SPECS) {
    emptyStates[spec.id] = {
      chapterId: spec.id,
      sectionCacheKey: buildDossierChapterCacheKey(unknownId, spec.id),
      status: 'idle',
    };
  }
  const unknownHtml = buildDossierStandaloneHtmlExport(unknownTimeChart, emptyStates);
  const unknownMd = buildDossierMarkdownExport(unknownTimeChart, emptyStates);
  const unknownPlain = buildDossierPlainTextExport(unknownTimeChart, emptyStates);
  assert.ok(unknownHtml.includes(unknownHeader.birthTimeFullSummaryVi));
  assert.ok(unknownMd.includes(unknownHeader.birthTimeFullSummaryVi));
  assert.ok(unknownPlain.includes(unknownHeader.birthTimeFullSummaryVi));

  // 2) Tự làm sạch cache cũ khi đọc (readDossierCacheEntry) — không xóa cache, không đổi key
  const anChart = buildNguyenVanAn1995Chart();
  const anId = buildChartIdentityKey(anChart);
  const anStorageKey = buildDossierStorageKey(anId);
  const phuMauPalace = anChart.palaces.find((p) => p.name.includes('父母'))!;
  const expectedPhuMauHeading = formatCanonicalPalaceHeading(phuMauPalace);

  const store = new MemoryStorage();
  upsertLruSessionEntry(
    store,
    DOSSIER_LRU_INDEX_KEY,
    anStorageKey,
    {
      chartIdentityKey: anId,
      updatedAt: 1700000000000,
      sections: {
        chapter_overview: {
          chapterId: 'chapter_overview',
          sectionCacheKey: buildDossierChapterCacheKey(anId, 'chapter_overview'),
          status: 'completed',
          text: 'Trong cácφ vận trình, mức căngđộ công việc tăng, kho lứa dồi dào nhưng tính hơi bảo Thủ.',
          sourceBadge: 'Sinh mới trong hồ sơ',
        },
        palaces_social_health: {
          chapterId: 'palaces_social_health',
          sectionCacheKey: buildDossierChapterCacheKey(anId, 'palaces_social_health'),
          status: 'completed',
          text: '### Cung Phụ Mẫu (Quý Mùi)\nBố mẹ có phần nghiêm khắc và cóφ uy tín.',
          sourceBadge: 'Sinh mới trong hồ sơ',
        },
      },
    },
    MAX_DOSSIERS_IN_SESSION,
  );

  assert.ok(store.getItem(anStorageKey), 'Khóa cache cũ phải giữ nguyên trong storage');
  const hydrated = readDossierCacheEntry(store, anStorageKey, anChart);
  assert.ok(hydrated);
  assert.equal(
    hydrated.sections.chapter_overview?.text,
    'Trong các vận trình, mức căng độ công việc tăng, kho lúa dồi dào nhưng tính hơi bảo thủ.',
  );
  assert.ok(hydrated.sections.palaces_social_health?.text?.includes(expectedPhuMauHeading));
  assert.equal(hydrated.sections.palaces_social_health?.text?.includes('φ'), false);

  // 3) Trang 1 tích hợp (B1+B6+B2): 5 dòng Cốt Tủy + lưới 12 cung 4x4 chuẩn Địa Chi
  const execSummary = buildDeterministicExecutiveSummaryVi(anChart);
  assert.equal(execSummary.length, 5);
  assert.ok(execSummary[0].includes('Căn cơ Bản Mệnh & Cục:'));
  assert.ok(execSummary[1].includes('Trục Mệnh – Thân & Chính tinh:'));
  assert.ok(execSummary[2].includes('Tứ Hóa Bản Mệnh'));
  assert.ok(execSummary[3].includes('2026'));
  assert.ok(execSummary[4].includes('2027'));

  assert.deepEqual(BRANCH_GRID_POS[5], { row: 1, col: 1 }); // Tỵ góc trên trái
  assert.deepEqual(BRANCH_GRID_POS[8], { row: 1, col: 4 }); // Thân góc trên phải
  assert.deepEqual(BRANCH_GRID_POS[11], { row: 4, col: 4 }); // Hợi góc dưới phải
  assert.deepEqual(BRANCH_GRID_POS[2], { row: 4, col: 1 }); // Dần góc dưới trái

  const gridHtml = buildDeterministicChartGridHtml(anChart);
  for (let b = 0; b < 12; b++) {
    assert.ok(gridHtml.includes(`data-branch="${b}"`), `Thiếu cung Địa Chi index=${b}`);
  }
  assert.ok(gridHtml.includes('[MỆNH]'));
  assert.ok(gridHtml.includes('[THÂN]'));
  assert.ok(gridHtml.includes('grid-row: 2 / span 2; grid-column: 2 / span 2;'));

  const pageOneHtml = buildDossierPageOneHtml(anChart, 2, new Date('2026-11-17T09:00:00Z'));
  assert.ok(pageOneHtml.includes('MỆNH THƯ TỔNG LƯỢC'));
  assert.ok(pageOneHtml.includes('Kết Luận Nhanh — Cốt Tủy Lá Số'));
  assert.ok(pageOneHtml.includes('ziwei-chart-grid'));

  // 4) B3 Bảng Ma Trận 5 cột CHỈ ở .HTML (không đưa vào .MD / PlainText) + B4/B5 CSS in ấn
  const anStates = {} as Record<DossierChapterId, DossierChapterState>;
  for (const spec of DOSSIER_CHAPTER_SPECS) {
    anStates[spec.id] = {
      chapterId: spec.id,
      sectionCacheKey: buildDossierChapterCacheKey(anId, spec.id),
      status: 'idle',
    };
  }
  const fullHtml = buildDossierStandaloneHtmlExport(anChart, anStates, new Date('2026-11-17T09:00:00Z'));
  const fullMd = buildDossierMarkdownExport(anChart, anStates, new Date('2026-11-17T09:00:00Z'));
  const fullPlain = buildDossierPlainTextExport(anChart, anStates, new Date('2026-11-17T09:00:00Z'));

  const matrix5 = buildMultiYearMatrixTableHtml(anChart, 5);
  const matrix10 = buildMultiYearMatrixTableHtml(anChart, 10);
  assert.ok(matrix5.includes('2026–2030'));
  assert.ok(matrix10.includes('2026–2035'));
  assert.ok(matrix5.includes('4 Sao Lưu Tứ Hóa'));

  assert.ok(fullHtml.includes('<table class="matrix-table">'));
  assert.ok(fullHtml.includes('<col style="width: 12%;" />'));
  assert.ok(fullHtml.includes('<col style="width: 34%;" />'));
  assert.ok(fullHtml.includes('counter(page)'));
  assert.ok(fullHtml.includes('page-break-before: always'));
  assert.ok(fullHtml.includes('font-size: 9pt !important;'));
  assert.ok(fullHtml.includes('1px dashed #44403C'));

  assert.equal(fullMd.includes('<table class="matrix-table">'), false);
  assert.equal(fullMd.includes('ziwei-chart-grid'), false);
  assert.equal(fullMd.includes('| Năm & Tuổi |'), false);
  assert.equal(fullPlain.includes('<table class="matrix-table">'), false);
  assert.ok(fullMd.includes(execSummary[0]));
  assert.ok(fullPlain.includes(execSummary[2].replace(/\*\*/g, '')));
});

runTest('[PHA 2 · TEST-6] Fixture chuẩn V2 (Nguyễn Văn An 16/08/1995 14:30 kinh độ 105.85°Đ Hà Nội)', () => {
  const chart = generateChart({
    name: 'Nguyễn Văn An',
    year: 1995,
    month: 8,
    day: 16,
    hour: 7, // Giờ Mùi
    gender: 'male',
    province: 'Việt Nam — Miền Bắc',
    city: 'Hà Nội',
    longitude: 105.85,
    origInput: {
      year: 1995,
      month: 8,
      day: 16,
      clockHour: 14,
      clockMinute: 30,
    },
  });

  const meta = buildDossierHeaderMetadata(chart);
  assert.equal(meta.hasExactBirthTime, true);
  assert.equal(meta.clockTimeVi, '14:30');
  assert.equal(meta.trueSolarTimeHHMM, '14:28');
  assert.equal(meta.trueSolarCorrectionMin, -1);
  assert.equal(
    meta.birthTimeFullSummaryVi,
    'Giờ đồng hồ: 14:30 → Giờ Mặt Trời thật: 14:28 (Giờ Mùi, hiệu chỉnh -1 phút)',
  );
  assert.ok(meta.locationVi.includes('Hà Nội'));
  assert.ok(meta.locationVi.includes('105.85°Đ'));

  const chartId = buildChartIdentityKey(chart);
  const states = {} as Record<DossierChapterId, DossierChapterState>;
  for (const spec of DOSSIER_CHAPTER_SPECS) {
    states[spec.id] = {
      chapterId: spec.id,
      sectionCacheKey: buildDossierChapterCacheKey(chartId, spec.id),
      status: 'idle',
    };
  }

  const html = buildDossierStandaloneHtmlExport(chart, states, new Date('2026-11-17T09:00:00Z'));
  const md = buildDossierMarkdownExport(chart, states, new Date('2026-11-17T09:00:00Z'));
  const plain = buildDossierPlainTextExport(chart, states, new Date('2026-11-17T09:00:00Z'));

  assert.ok(html.includes(meta.birthTimeFullSummaryVi));
  assert.ok(md.includes(meta.birthTimeFullSummaryVi));
  assert.ok(plain.includes(meta.birthTimeFullSummaryVi));
  assert.ok(html.includes('105.85°Đ'));
  assert.ok(md.includes('105.85°Đ'));
  assert.ok(plain.includes('105.85°Đ'));
});

runTest('[PHA 3 · TEST-7] Chặn SSE từng chunk (sanitizeLayer3AOnly) + Pipeline chốt 3 bước đầy đủ (idempotent, 0 gọi AI)', () => {
  const anChart = buildNguyenVanAn1995Chart();
  const ctx2026 = buildYunxianPeriodContext(anChart, { mode: 'liunian', year: 2026 });
  assert.ok(ctx2026);
  const phuMauPalace = anChart.palaces.find((p) => p.name.includes('父母'))!;
  const expectedPhuMauHeading = formatCanonicalPalaceHeading(phuMauPalace);

  // (a) sanitizeLayer3AOnly trên chunk rời: xóa "φ", KHÔNG cắt từ giữa ranh giới và KHÔNG đụng "Canh Thìn" / "Canh Dần"
  const chunkA = 'Trong cácφ cung tuổi Canh Thìn và Canh Dần, mức căng';
  const chunkB = 'độ công việc rất cao, kho lứa ở quê và tính bảo Thủ.';
  const safeChunkA = sanitizeLayer3AOnly(chunkA);
  const safeChunkB = sanitizeLayer3AOnly(chunkB);
  assert.equal(safeChunkA, 'Trong các cung tuổi Canh Thìn và Canh Dần, mức căng');
  assert.equal(safeChunkB, chunkB, 'Lớp 3A không tự tách/đổi từ qua biên chunk');

  // (b) Pipeline chốt đầy đủ: sanitizeAiVietnameseOutput -> verifyAndEnsureCompletePeriodSiHua -> enforceCanonicalPalaceGroupHeadings
  const quyen = ctx2026.periodSiHua.find((s) => s.mutagenKey === '权')!;
  const ky = ctx2026.periodSiHua.find((s) => s.mutagenKey === '忌')!;
  const compositeDirtyText = [
    `### Cung Phụ Mẫu (Quý Mùi)`,
    `${safeChunkA}${safeChunkB}`,
    `### 2. Điểm Cát & Động Lực Thuận Lợi`,
    `- **${quyen.starNameVi} ${quyen.mutagenVi}** tại **Cung ${quyen.periodPalaceRoleVi}**.`,
    `### 3. Điểm Hung & Trục Xung Chiếu Cần Lưu Ý`,
    `- **${ky.starNameVi} ${ky.mutagenVi}** tại **Cung ${ky.periodPalaceRoleVi}**.`,
    `### 4. Lời Khuyên Hành Động`,
    `Giữ tâm thế bình hòa trước biến động (紫微).`,
  ].join('\n');

  const runClosingPipeline = (raw: string) => {
    const step1 = sanitizeAiVietnameseOutput(raw);
    const step2 = verifyAndEnsureCompletePeriodSiHua(step1, ctx2026).patchedText;
    return enforceCanonicalPalaceGroupHeadings(step2, anChart);
  };

  const finalText = runClosingPipeline(compositeDirtyText);
  assert.equal(finalText.includes('φ'), false);
  assert.equal(finalText.includes('紫微'), false);
  assert.ok(finalText.includes('mức căng độ'));
  assert.ok(finalText.includes('kho lúa'));
  assert.ok(finalText.includes('bảo thủ'));
  assert.ok(finalText.includes('Canh Thìn') && finalText.includes('Canh Dần'));
  assert.ok(finalText.includes(expectedPhuMauHeading), 'Tiêu đề cung phải chuẩn có [Đại hạn ...]');
  assert.ok(expectedPhuMauHeading.includes('[Đại hạn '));

  const marker = '> 📌 **[Tổng Hợp Đầy Đủ Tứ Hóa Kỳ Hạn Theo Lá Số]**';
  const markerIdx = finalText.indexOf(marker);
  const adviceIdx = finalText.indexOf('Giữ tâm thế bình hòa trước biến động.');
  assert.ok(adviceIdx >= 0 && markerIdx > adviceIdx, 'Khối 4 Tứ Hóa phải nối ở CUỐI chương sau Lời Khuyên');
  for (const sh of ctx2026.periodSiHua) {
    assert.ok(finalText.includes(formatPeriodSiHuaFactLine(sh, 'Lưu')));
  }
  assert.equal(runClosingPipeline(finalText), finalText, 'Pipeline chốt phải lũy đẳng 100%');
});

runTest('[PHA 3 · TEST-8] Server Prompt Builders chứa luật Cung Lưu, đủ 4 Tứ Hóa và thuật ngữ Canh Thìn/Canh Dần', () => {
  const anChart = buildNguyenVanAn1995Chart();
  const ctx2026 = buildYunxianPeriodContext(anChart, { mode: 'liunian', year: 2026 });
  assert.ok(ctx2026);
  const chartSummary = formatChartSummaryVi(anChart);

  const periodBuilt = buildStrictPeriodAiPrompt(ctx2026, chartSummary);
  assert.ok(periodBuilt.systemInstruction.includes('[Tứ Hóa Bản Mệnh]'));
  assert.ok(periodBuilt.systemInstruction.includes('[Tứ Hóa Đại Hạn]'));
  assert.ok(periodBuilt.systemInstruction.includes('[Tứ Hóa Lưu Niên'));
  assert.ok(periodBuilt.systemInstruction.includes('[Tự Hóa Can Cung'));
  assert.ok(periodBuilt.systemInstruction.includes('Cung Lưu <Tên Cung>'));
  assert.ok(periodBuilt.systemInstruction.includes('TUYỆT ĐỐI CẤM lược bỏ chữ "Lưu"'));
  assert.ok(periodBuilt.systemInstruction.includes('ĐỦ CẢ 4 SAO TỨ HÓA CỦA KỲ HẠN'));
  assert.ok(periodBuilt.prompt.includes('[Bảng Ánh Xạ Đầy Đủ 12 Cung Kỳ Hạn'));

  const dossierGroupBuilt = buildStrictDossierSectionPrompt(anChart, 'palaces_social_health');
  assert.ok(dossierGroupBuilt.systemInstruction.includes('### Cung <Tên Cung> (<Can Chi>)'));
  assert.ok(dossierGroupBuilt.systemInstruction.includes('chuẩn hóa hậu kiểm'));
  assert.ok(dossierGroupBuilt.systemInstruction.includes('Canh Thìn'));
  assert.ok(dossierGroupBuilt.systemInstruction.includes('Canh Dần'));
  assert.ok(dossierGroupBuilt.systemInstruction.includes('TUYỆT ĐỐI KHÔNG viết dạng thường hóa sai quy chuẩn'));

  const horizonBuilt = buildStrictDossierSectionPrompt(anChart, 'horizon_5y');
  assert.ok(horizonBuilt.systemInstruction.includes('Cung Lưu <Tên Cung>'));
  assert.ok(horizonBuilt.systemInstruction.includes('đủ cả 4 sao Lưu Tứ Hóa'));
});

runTest('[BỔ SUNG QĐ-G5 · TEST-9] Nối dây origInput trong formToBirthInfo (10:30, unknownTime, Tý muộn 23:30)', () => {
  // (a) Nguyễn Văn An 16/08/1995 10:30 Hà Nội (unknownTime = false)
  const formKnown: BirthFormState = {
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
  };
  const infoKnown = formToBirthInfo(formKnown);
  assert.deepEqual(infoKnown.origInput, {
    year: 1995,
    month: 8,
    day: 16,
    clockHour: 10,
    clockMinute: 30,
  });
  const chartKnown = generateChart(infoKnown);
  const headerKnown = buildDossierHeaderMetadata(chartKnown);
  assert.equal(headerKnown.hasExactBirthTime, true);
  assert.equal(
    headerKnown.birthTimeFullSummaryVi,
    'Giờ đồng hồ: 10:30 → Giờ Mặt Trời thật: 10:28 (Giờ Tỵ, hiệu chỉnh -1 phút)',
  );

  // (b) unknownTime = true -> origInput undefined -> câu mặc định V2
  const formUnknown: BirthFormState = {
    ...formKnown,
    unknownTime: true,
  };
  const infoUnknown = formToBirthInfo(formUnknown);
  assert.equal(infoUnknown.origInput, undefined);
  const chartUnknown = generateChart(infoUnknown);
  const headerUnknown = buildDossierHeaderMetadata(chartUnknown);
  assert.equal(headerUnknown.hasExactBirthTime, false);
  assert.equal(
    headerUnknown.birthTimeFullSummaryVi,
    'Chưa rõ giờ đồng hồ gốc (lập lá số mặc định theo Giờ Tý).',
  );

  // (c) Giờ Tý muộn 23:30 -> birthInfo.day sang ngày hôm sau (17/08) nhưng origInput giữ nguyên ngày gốc (16/08)
  const formLateZi: BirthFormState = {
    ...formKnown,
    clockHour: '23',
    clockMinute: '30',
  };
  const infoLateZi = formToBirthInfo(formLateZi);
  assert.equal(infoLateZi.year, 1995);
  assert.equal(infoLateZi.month, 8);
  assert.equal(infoLateZi.day, 17);
  assert.equal(infoLateZi.hour, 0);
  assert.deepEqual(infoLateZi.origInput, {
    year: 1995,
    month: 8,
    day: 16,
    clockHour: 23,
    clockMinute: 30,
  });
  const chartLateZi = generateChart(infoLateZi);
  const headerLateZi = buildDossierHeaderMetadata(chartLateZi);
  assert.equal(headerLateZi.hasExactBirthTime, true);
  assert.ok(headerLateZi.birthTimeFullSummaryVi.includes('Giờ đồng hồ: 23:30 → Giờ Mặt Trời thật:'));
});

runTest('[SỬA NHỎ · TEST-10] Gỡ dòng meta nội bộ khỏi bản kết xuất (HTML/.MD/PlainText), giữ nguyên meta tầng dữ liệu & không đụng dòng Nguồn hợp lệ', () => {
  const chart = buildNguyenVanAn1995Chart();
  const chartId = buildChartIdentityKey(chart);
  const states = {} as Record<DossierChapterId, DossierChapterState>;
  for (const spec of DOSSIER_CHAPTER_SPECS) {
    states[spec.id] = {
      chapterId: spec.id,
      sectionCacheKey: buildDossierChapterCacheKey(chartId, spec.id),
      status: 'idle',
    };
  }

  // Chương mẫu mô phỏng cache cũ chứa sẵn dòng meta ở đầu bài (cả khóa che lẫn khóa dạng đầy đủ)
  // kèm một dòng hợp lệ "Nguồn: Tử Vi Đẩu Số Toàn Thư" không phải dòng meta vận hành.
  states.chapter_overview = {
    chapterId: 'chapter_overview',
    sectionCacheKey: buildDossierChapterCacheKey(chartId, 'chapter_overview'),
    status: 'completed',
    text: [
      'Nguồn: Sinh mới trong hồ sơ · Model: gemini-3.5-flash-lite · Khóa: AIzaSy••••••GyWQ',
      '',
      '### 1. Tổng Quan Cách Cục',
      'Nguồn: Tử Vi Đẩu Số Toàn Thư — ghi nhận sao Thái Dương chiếu sáng.',
      'Luận giải chi tiết bản mệnh vững vàng.',
    ].join('\n'),
    sourceBadge: 'Sinh mới trong hồ sơ',
    meta: {
      keyId: 'k_gywq',
      maskedKey: 'AIzaSy••••••GyWQ',
      label: 'Key Test',
      modelUsed: 'gemini-3.5-flash-lite',
      usedFallbackModel: false,
      failoverAttempts: 1,
      latencyMs: 950,
    },
  };

  states.palaces_core = {
    chapterId: 'palaces_core',
    sectionCacheKey: buildDossierChapterCacheKey(chartId, 'palaces_core'),
    status: 'completed',
    text: [
      '*Nguồn: Kế thừa từ bộ nhớ đệm · Model: gemini-3.8-flash · Khóa: AIzaSyFakeLegacyTestKeyValue1234567890*',
      '',
      '### Cung Mệnh (Ất Mão)',
      'Nội dung luận giải cung Mệnh giữ nguyên 100%.',
    ].join('\n'),
    sourceBadge: 'Kế thừa từ bộ nhớ đệm',
    meta: {
      keyId: 'k_legacy',
      maskedKey: 'AIzaSy••••••7890',
      label: 'Key Legacy',
      modelUsed: 'gemini-3.8-flash',
      usedFallbackModel: true,
      failoverAttempts: 2,
      latencyMs: 1400,
    },
  };

  const html = buildDossierStandaloneHtmlExport(chart, states, new Date('2026-11-17T10:39:00Z'));
  const md = buildDossierMarkdownExport(chart, states, new Date('2026-11-17T10:39:00Z'));
  const plain = buildDossierPlainTextExport(chart, states, new Date('2026-11-17T10:39:00Z'));

  for (const out of [html, md, plain]) {
    assert.equal(out.includes('Khóa:'), false);
    assert.equal(out.includes('Nguồn: Sinh'), false);
    assert.equal(out.includes('Nguồn: Kế thừa'), false);
    assert.equal(out.includes('Model: gemini'), false);
    assert.equal(out.includes('AIzaSy••••••GyWQ'), false);
    assert.equal(out.includes('AIzaSyFakeLegacyTestKeyValue1234567890'), false);
    // Dòng nội dung hợp lệ phải được giữ nguyên
    assert.ok(out.includes('Nguồn: Tử Vi Đẩu Số Toàn Thư'));
    assert.ok(out.includes('Luận giải chi tiết bản mệnh vững vàng.'));
    assert.ok(out.includes('Nội dung luận giải cung Mệnh giữ nguyên 100%.'));
  }

  // Kiểm chứng trực tiếp stripInternalExportMetaLines không xóa dòng chỉ có "Nguồn:"
  const safeProse = 'Nguồn: Tử Vi Đẩu Số Toàn Thư\nNội dung thuần túy.';
  assert.equal(stripInternalExportMetaLines(safeProse), safeProse);

  // Tầng dữ liệu phục vụ hiển thị trong modal app vẫn giữ nguyên sourceBadge & meta
  assert.equal(states.chapter_overview.sourceBadge, 'Sinh mới trong hồ sơ');
  assert.equal(states.chapter_overview.meta?.modelUsed, 'gemini-3.5-flash-lite');
  assert.equal(states.chapter_overview.meta?.maskedKey, 'AIzaSy••••••GyWQ');
  assert.equal(states.palaces_core.sourceBadge, 'Kế thừa từ bộ nhớ đệm');
  assert.equal(states.palaces_core.meta?.modelUsed, 'gemini-3.8-flash');
});

console.log(`\nKết quả verify-dossier-chat-ui: ${passed}/${total} bài kiểm chứng ĐẠT.`);
