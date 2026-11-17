import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { KeyPoolManager } from '../server/key-pool/index.ts';
import {
  classifyGeminiError,
  computeCooldownDurationMs,
  isSupportedGemini35Plus,
  KeyAllocator,
  sanitizeSecretText,
} from '../server/key-pool/allocator.ts';
import { MAX_RECENT_LOGS, type KeyPoolState } from '../server/key-pool/types.ts';
import { maskApiKey, parseBatchKeys } from '../server/key-pool/parser.ts';
import { SerializedWriteQueue } from '../server/key-pool/crypto-store.ts';
import { AiClientFactory, PoolExhaustedError } from '../server/key-pool/executor.ts';
import {
  applyBatchItemToSnapshot,
  buildCooldownProbeQueue,
  canTriggerBatchCooldownProbe,
  hasValidCachedPeriodEntry,
  resolveNextModelSelection,
  runClientBatchCooldownProbe,
  shouldShowCompletedContinuationBadge,
  shouldShowInterruptedContinuationBadge,
  type BatchCooldownItemResult,
  type CooldownProbeKeyShape,
} from '../src/lib/key-pool-ui.ts';

function fakeKey(suffix: string): string {
  const padded = suffix.padStart(35, '0').slice(-35);
  return `AIza${padded}`;
}

async function runTests() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ziwei-key-pool-test-'));
  console.log('=== KIỂM THỬ MODULE KHO KHÓA GEMINI (KEY POOL) ===');
  console.log(`Thư mục tạm cô lập: ${tmpDir}`);

  // Tạm tách GEMINI_API_KEY env để test sạch Pool 0 key trước
  const origEnvKey = process.env.GEMINI_API_KEY;
  const origEnvKeys = process.env.GEMINI_API_KEYS;
  const origMasterSecret = process.env.KEY_POOL_MASTER_SECRET;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEYS;
  delete process.env.KEY_POOL_MASTER_SECRET;

  try {
    // ── BÀI 1: Kiểm thử Parser đa định dạng & 2 bước Preview/Import ─────────
    {
      console.log('\n[1/7] Kiểm thử Parser đa định dạng & Preview/Import...');
      const k1 = fakeKey('AlphaKey00000000000000000000001');
      const k2 = fakeKey('BetaKey000000000000000000000002');
      const k3 = fakeKey('GammaKey00000000000000000000003');
      const k4 = fakeKey('DeltaKey00000000000000000000004');
      const k5 = fakeKey('EpsilonKey00000000000000000005');
      const k6 = fakeKey('ZetaKey000000000000000000000006');
      const k7 = fakeKey('EtaKey0000000000000000000000007');

      const mixedInput = [
        '# Ghi chú đầu file bị bỏ qua',
        '// Comment kiểu C cũng bỏ qua',
        `${k1}, ${k2}; ${k3}`,
        `${k4}\t${k5}   ${k1}`, // k1 trùng trong batch
        `Tài khoản Chính: ${k6}`,
        `GEMINI_API_KEY="${k7}"`,
        `https://generativelanguage.googleapis.com/v1beta/models?key=${k2}`, // k2 trùng lần nữa
        'chuoi_khong_hop_le_123',
        'AIzaNganQua',
      ].join('\n');

      const parsed = parseBatchKeys(mixedInput, new Set(), 'Khóa');
      assert.strictEqual(parsed.recognizedCount, 7, 'Phải nhận diện đúng 7 key hợp lệ');
      assert.strictEqual(parsed.duplicateCount, 2, 'Phải loại đúng 2 bản trùng trong batch');
      assert.strictEqual(parsed.invalidCount, 2, 'Phải báo đúng 2 token không hợp lệ');
      assert.strictEqual(
        parsed.validEntries.find((e) => e.rawKey === k6)?.label,
        'Tài khoản Chính',
        'Phải giữ nhãn tùy chỉnh trước dấu :',
      );

      // Kiểm tra JSON input
      const jsonInput = JSON.stringify([
        { label: 'Dự án A', key: k1 },
        { name: 'Dự án B', apiKey: k2 },
        'bad_token',
      ]);
      const parsedJson = parseBatchKeys(jsonInput, new Set(), 'Khóa');
      assert.strictEqual(parsedJson.recognizedCount, 2, 'JSON input nhận 2 key');
      assert.strictEqual(parsedJson.invalidCount, 1, 'JSON input nhận 1 invalid');
      assert.strictEqual(parsedJson.validEntries[0].label, 'Dự án A');

      // Kiểm tra 2 bước preview -> confirm trên KeyPoolManager
      const manager = new KeyPoolManager(tmpDir);
      const preview = manager.previewBatchImport(mixedInput, 'Khóa');
      assert.strictEqual(preview.recognizedCount, 7);
      assert.strictEqual(preview.duplicateCount, 2);
      assert.strictEqual(preview.invalidCount, 2);
      // Đảm bảo preview JSON không chứa bất kỳ raw key nào
      const previewJson = JSON.stringify(preview);
      for (const raw of [k1, k2, k3, k4, k5, k6, k7]) {
        assert.ok(!previewJson.includes(raw), 'Preview KHÔNG được lộ plaintext key');
      }

      const imported = manager.confirmBatchImport(preview.previewSessionId);
      assert.strictEqual(imported.importedCount, 7, 'Confirm import phải lưu đúng 7 key');
      const snap = manager.getPublicSnapshot({
        isReadOnly: false,
        isSharedOrigin: false,
        adminPinRequired: false,
        hasAdminPinConfigured: false,
      });
      assert.strictEqual(snap.summary.ready, 7, 'QĐ-4: Toàn bộ key vừa import phải ở trạng thái ready');
      assert.ok(snap.keys.every((k) => k.healthScore === 100), 'QĐ-4: Điểm ban đầu phải = 100');

      // Không cho dùng lại previewSessionId đã dùng
      assert.throws(() => manager.confirmBatchImport(preview.previewSessionId));
      console.log(
        `  -> Đạt: nhận diện N=${preview.recognizedCount}, trùng M=${preview.duplicateCount}, lỗi K=${preview.invalidCount}, che khóa (${maskApiKey(k1)}), không lộ plaintext.`,
      );
    }

    // ── BÀI 2: Mã hóa AES-256-GCM độc lập & Pool 0 key / 1 key ───────────
    {
      console.log('\n[2/7] Kiểm thử mã hóa AES-256-GCM độc lập & Pool 0 key / 1 key...');
      const dir2 = fs.mkdtempSync(path.join(tmpDir, 'pool01-'));
      const mgr0 = new KeyPoolManager(dir2);

      // Pool 0 key -> ném PoolExhaustedError(AI_NOT_CONFIGURED)
      let zeroErr: unknown = null;
      try {
        await mgr0.executeStream({
          prompt: 'hello',
          onChunk: () => {},
        });
      } catch (e) {
        zeroErr = e;
      }
      assert.ok(zeroErr instanceof PoolExhaustedError, 'Pool 0 key phải ném PoolExhaustedError');
      assert.strictEqual((zeroErr as PoolExhaustedError).code, 'AI_NOT_CONFIGURED');

      // Pool 1 key -> thành công khi key khỏe
      const kSingle = fakeKey('SingleHealthy000000000000000001');
      const preview1 = mgr0.previewBatchImport(kSingle);
      mgr0.confirmBatchImport(preview1.previewSessionId);
      await mgr0.flushPersistence();

      // Kiểm tra file trên đĩa thực sự đã mã hóa và không chứa plaintext
      const encPath = path.join(dir2, 'gemini-key-pool.enc.json');
      const masterPath = path.join(dir2, '.pool-master.key');
      assert.ok(fs.existsSync(encPath), 'File store phải tồn tại');
      assert.ok(fs.existsSync(masterPath), 'File master key độc lập phải tồn tại');
      const diskContent = fs.readFileSync(encPath, 'utf8');
      assert.ok(!diskContent.includes(kSingle), 'File lưu trữ trên đĩa KHÔNG được chứa plaintext key');

      // Mở lại store từ đĩa -> giải mã chính xác và vẫn chạy bình thường
      const mgrReloaded = new KeyPoolManager(dir2);
      let collected = '';
      const meta = await mgrReloaded.executeStream({
        prompt: 'test',
        onChunk: (t) => {
          collected += t;
        },
        clientFactory: () => ({
          models: {
            async generateContentStream() {
              async function* gen() {
                yield { text: 'Xin chào ' };
                yield { text: 'Tử Vi!' };
              }
              return gen();
            },
            async generateContent() {
              return { text: 'OK' };
            },
          },
        }),
      });
      assert.strictEqual(collected, 'Xin chào Tử Vi!');
      assert.strictEqual(meta.maskedKey, maskApiKey(kSingle));
      assert.strictEqual(meta.modelUsed, 'gemini-3.5-flash-lite');
      console.log('  -> Đạt: Pool 0 key trả AI_NOT_CONFIGURED; Pool 1 key mã hóa AES-256-GCM & tái nạp thành công.');
    }

    // ── BÀI 3: Failover Key A (429) -> Key B thành công trong 1 request ─────
    {
      console.log('\n[3/7] Kiểm thử Failover nội bộ (Key A 429 -> Key B thành công)...');
      const dir3 = fs.mkdtempSync(path.join(tmpDir, 'failover-'));
      const mgr = new KeyPoolManager(dir3);
      const keyA = fakeKey('FailoverKeyA0000000000000000001');
      const keyB = fakeKey('FailoverKeyB0000000000000000002');
      const prev = mgr.previewBatchImport(`${keyA}, ${keyB}`);
      mgr.confirmBatchImport(prev.previewSessionId);

      const calledOrder: string[] = [];
      const mockFactory: AiClientFactory = (rawKey) => ({
        models: {
          async generateContentStream() {
            calledOrder.push(rawKey);
            if (rawKey === keyA) {
              const err = Object.assign(
                new Error('429 RESOURCE_EXHAUSTED quota_limit_value: "0" projects/63415494298'),
                { status: 429 },
              );
              throw err;
            }
            async function* gen() {
              yield { text: 'Luận giải từ Key B.' };
            }
            return gen();
          },
          async generateContent() {
            return { text: 'OK' };
          },
        },
      });

      let output = '';
      const meta = await mgr.executeStream({
        prompt: 'Phân tích kỳ hạn',
        onChunk: (c) => {
          output += c;
        },
        clientFactory: mockFactory,
        disableJitter: true,
      });

      assert.deepStrictEqual(calledOrder, [keyA, keyB]);
      assert.strictEqual(output, 'Luận giải từ Key B.');
      assert.strictEqual(meta.failoverAttempts, 2);
      assert.strictEqual(meta.maskedKey, maskApiKey(keyB));

      const snap = mgr.getPublicSnapshot({
        isReadOnly: false,
        isSharedOrigin: false,
        adminPinRequired: false,
        hasAdminPinConfigured: false,
      });
      const recA = snap.keys.find((k) => k.maskedKey === maskApiKey(keyA))!;
      const recB = snap.keys.find((k) => k.maskedKey === maskApiKey(keyB))!;
      assert.strictEqual(recA.status, 'cooldown', 'Key A phải chuyển cooldown');
      assert.strictEqual(recA.cooldownReason, 'QUOTA_PROJECT_ZERO');
      assert.strictEqual(recA.detectedProjectNumber, '63415494298');
      assert.ok(recA.remainingCooldownSec >= 21500, 'Cooldown QUOTA_PROJECT_ZERO phải 6 giờ (21.600s)');
      assert.strictEqual(recB.status, 'ready');
      assert.strictEqual(recB.stats.successCalls, 1);
      console.log('  -> Đạt: Key A gặp 429 quota=0 -> cooldown 6h, lập tức failover sang Key B thành công.');
    }

    // ── BÀI 4: Phân loại lỗi, Lan truyền theo Project, Hết cooldown -> Probe ─
    {
      console.log('\n[4/7] Kiểm thử Cooldown mọi loại lỗi, lan truyền Project & tự phục hồi...');
      const rpmWithRetry = classifyGeminiError(
        Object.assign(new Error('429 Too Many Requests "retryDelay": "42s"'), { status: 429 }),
      );
      assert.strictEqual(rpmWithRetry.category, 'RATE_LIMIT_RPM');
      assert.strictEqual(rpmWithRetry.retryDelaySec, 42);
      assert.strictEqual(computeCooldownDurationMs('RATE_LIMIT_RPM', 1, 42, 0, true), 44_000);

      // Kiểm tra nested escaped JSON từ @google/genai ApiError
      const nestedQuotaZero = classifyGeminiError(
        new Error(
          JSON.stringify({
            error: {
              message: JSON.stringify({
                error: {
                  code: 429,
                  status: 'RESOURCE_EXHAUSTED',
                  details: [
                    {
                      metadata: {
                        consumer: 'projects/63415494298',
                        quota_limit_value: '0',
                      },
                    },
                  ],
                },
              }),
            },
          }),
        ),
      );
      assert.strictEqual(nestedQuotaZero.category, 'QUOTA_PROJECT_ZERO');
      assert.strictEqual(nestedQuotaZero.projectNumber, '63415494298');

      const rpd = classifyGeminiError(
        Object.assign(new Error('429 GenerateRequestsPerDayPerProjectPerModel exhausted'), { status: 429 }),
      );
      assert.strictEqual(rpd.category, 'QUOTA_DAILY_EXHAUSTED');

      const inv = classifyGeminiError(Object.assign(new Error('403 API_KEY_INVALID'), { status: 403 }));
      assert.strictEqual(inv.category, 'AUTH_INVALID_KEY');
      assert.strictEqual(computeCooldownDurationMs('AUTH_INVALID_KEY', 1, null, 0, true), null);

      const net5xx = classifyGeminiError(Object.assign(new Error('502 Bad Gateway'), { status: 502 }));
      assert.strictEqual(net5xx.category, 'NETWORK_OR_5XX');
      assert.strictEqual(computeCooldownDurationMs('NETWORK_OR_5XX', 1, null, 0, true), 30_000);

      // Lan truyền theo Project & phục hồi khi hết cooldown
      const dir4 = fs.mkdtempSync(path.join(tmpDir, 'prop-'));
      const mgr = new KeyPoolManager(dir4);
      const kP1 = fakeKey('ProjectShareKey1000000000000001');
      const kP2 = fakeKey('ProjectShareKey2000000000000002');
      const kInvalid = fakeKey('InvalidAuthKey30000000000000003');
      const prev = mgr.previewBatchImport(`${kP1}, ${kP2}, ${kInvalid}`);
      mgr.confirmBatchImport(prev.previewSessionId);

      // Gán trước detectedProjectNumber cho kP2 (giả lập đã từng chạm lỗi từ project này)
      const [id1, id2, id3] = mgr._getRawKeyIdsForVerification();
      mgr._findKeyRecord(id2)!.detectedProjectNumber = '999888777';

      const allocator = mgr._getAllocatorForVerification();
      const t0 = 1_700_000_000_000;

      // kP1 báo lỗi QUOTA_PROJECT_ZERO với project_number 999888777
      allocator.recordFailure(
        id1,
        {
          category: 'QUOTA_PROJECT_ZERO',
          projectNumber: '999888777',
          retryDelaySec: null,
          sanitizedSummary: '429 quota_limit_value: "0" projects/999888777',
        },
        t0,
        true,
      );
      assert.strictEqual(mgr._findKeyRecord(id1)!.status, 'cooldown');
      assert.strictEqual(mgr._findKeyRecord(id2)!.status, 'cooldown', 'Key cùng project phải được lan truyền cooldown');

      // kInvalid gặp 401 -> disabled score=0
      allocator.recordFailure(
        id3,
        {
          category: 'AUTH_INVALID_KEY',
          projectNumber: null,
          retryDelaySec: null,
          sanitizedSummary: '401 API_KEY_INVALID',
        },
        t0,
        true,
      );
      assert.strictEqual(mgr._findKeyRecord(id3)!.status, 'disabled');
      assert.strictEqual(mgr._findKeyRecord(id3)!.healthScore, 0);

      // Tua đồng hồ quá 6 giờ + 1 giây -> id1 và id2 phải tự giải phóng sang ready với pendingProbe=true
      const tAfter6h = t0 + 6 * 3600 * 1000 + 1000;
      allocator.sweep(tAfter6h);
      assert.strictEqual(mgr._findKeyRecord(id1)!.status, 'ready');
      assert.strictEqual(mgr._findKeyRecord(id1)!.pendingProbe, true);
      assert.strictEqual(mgr._findKeyRecord(id2)!.status, 'ready');
      assert.strictEqual(mgr._findKeyRecord(id2)!.pendingProbe, true);

      // Probe thành công -> tắt pendingProbe và tăng điểm
      allocator.recordSuccess(id1, 180, tAfter6h + 200);
      assert.strictEqual(mgr._findKeyRecord(id1)!.pendingProbe, false);
      assert.ok(mgr._findKeyRecord(id1)!.healthScore >= 70);
      console.log('  -> Đạt: 429 RPM/RPD/ZERO, 401/403, 5xx, lan truyền cùng GCP project và tự phục hồi probe đều chính xác.');
    }

    // ── BÀI 5: Fallback Model (gemini-3.5-flash-lite -> gemini-3.8-flash) ───
    {
      console.log('\n[5/7] Kiểm thử Fallback Model (3.5-flash-lite -> 3.8-flash, không phạt key)...');
      const dir5 = fs.mkdtempSync(path.join(tmpDir, 'modelfb-'));
      const mgr = new KeyPoolManager(dir5);
      const k1 = fakeKey('ModelFallbackKey000000000000001');
      const prev = mgr.previewBatchImport(k1);
      mgr.confirmBatchImport(prev.previewSessionId);

      // Kiểm tra validate model >= 3.5
      assert.strictEqual(isSupportedGemini35Plus('gemini-3.5-flash-lite'), true);
      assert.strictEqual(isSupportedGemini35Plus('gemini-3.8-flash'), true);
      assert.strictEqual(isSupportedGemini35Plus('gemini-4-hydrogen'), true);
      assert.strictEqual(isSupportedGemini35Plus('gemini-2.5-flash'), false);
      assert.strictEqual(isSupportedGemini35Plus('gemini-3.0-flash'), false);
      assert.throws(() =>
        mgr.updateModelConfig({
          defaultModel: 'gemini-2.5-flash',
          fallbackModel: 'gemini-3.8-flash',
        }),
      );

      const triedModels: string[] = [];
      let textOut = '';
      const meta = await mgr.executeStream({
        prompt: 'test fallback model',
        onChunk: (t) => {
          textOut += t;
        },
        clientFactory: () => ({
          models: {
            async generateContentStream(params) {
              triedModels.push(params.model);
              if (params.model === 'gemini-3.5-flash-lite') {
                throw Object.assign(new Error('404 models/gemini-3.5-flash-lite is not found'), {
                  status: 404,
                });
              }
              async function* gen() {
                yield { text: 'Phản hồi từ 3.8-flash.' };
              }
              return gen();
            },
            async generateContent() {
              return { text: 'OK' };
            },
          },
        }),
      });

      assert.deepStrictEqual(triedModels, ['gemini-3.5-flash-lite', 'gemini-3.8-flash']);
      assert.strictEqual(textOut, 'Phản hồi từ 3.8-flash.');
      assert.strictEqual(meta.modelUsed, 'gemini-3.8-flash');
      assert.strictEqual(meta.usedFallbackModel, true);

      const rec = mgr._findKeyRecord(mgr._getRawKeyIdsForVerification()[0])!;
      assert.strictEqual(rec.status, 'ready', 'Lỗi cấp model KHÔNG được phạt key sang cooldown');
      assert.strictEqual(rec.healthScore, 100);
      console.log('  -> Đạt: 404/overloaded trên gemini-3.5-flash-lite tự đổi sang gemini-3.8-flash ngay trên cùng key, không phạt key.');
    }

    // ── BÀI 6: Ngăn rò rỉ khóa (Sanitize Error / Stack / Cause) ───────────
    {
      console.log('\n[6/7] Kiểm thử chống rò rỉ khóa qua Error/Stack/Cause...');
      const secretKey = fakeKey('TopSecretLeakCheck0000000000001');
      const inner = new Error(`Upstream denied key=${secretKey} at endpoint`);
      const outer = new Error(`Request failed with ${secretKey}`);
      (outer as Error & { cause?: unknown }).cause = inner;
      const cleaned = sanitizeSecretText(outer, [secretKey]);
      assert.ok(!cleaned.includes(secretKey), 'sanitizeSecretText phải xóa mọi plaintext key ở cả cause và stack');
      assert.ok(!/AIza[0-9A-Za-z_-]{20,}/.test(cleaned), 'Regex bảo vệ cũng không được để sót dạng AIza...');
      console.log('  -> Đạt: Không lọt bất kỳ plaintext key nào trong Error, stack hoặc cause.');
    }

    // ── BÀI 7: Hàng đợi ghi tuần tự SerializedWriteQueue ───────────────────
    {
      console.log('\n[7/7] Kiểm thử SerializedWriteQueue đồng thời...');
      const q = new SerializedWriteQueue();
      const trace: number[] = [];
      await Promise.all([
        q.enqueue(async () => {
          await new Promise((r) => setTimeout(r, 20));
          trace.push(1);
        }),
        q.enqueue(async () => {
          trace.push(2);
        }),
        q.enqueue(async () => {
          trace.push(3);
        }),
      ]);
      assert.deepStrictEqual(trace, [1, 2, 3], 'Các tác vụ ghi phải hoàn thành đúng thứ tự tuần tự');
      console.log('  -> Đạt: SerializedWriteQueue bảo đảm tuần tự hóa thao tác ghi.');
    }

    // ── BÀI 8: Phân loại 503 UNAVAILABLE & không phạt oan khi đứt giữa luồng ─
    {
      console.log('\n[8/12] Kiểm thử 503 got status: UNAVAILABLE -> MODEL_UNAVAILABLE (0 phạt điểm)...');
      const gRpc503 = classifyGeminiError(
        Object.assign(
          new Error('{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}'),
          { status: 503 },
        ),
      );
      assert.strictEqual(gRpc503.category, 'MODEL_UNAVAILABLE');

      const gRpcText = classifyGeminiError(
        new Error('ApiError: got status: UNAVAILABLE from backend model gemini-3.5-flash-lite'),
      );
      assert.strictEqual(gRpcText.category, 'MODEL_UNAVAILABLE');

      const dir8 = fs.mkdtempSync(path.join(tmpDir, 'mid503-'));
      const mgr = new KeyPoolManager(dir8);
      const k1 = fakeKey('MidStream503Key000000000000001');
      const prev = mgr.previewBatchImport(k1);
      mgr.confirmBatchImport(prev.previewSessionId);

      let interruptedEvents = 0;
      let streamedOut = '';
      const meta = await mgr.executeStream({
        prompt: 'Phân tích Lưu Niên 2026',
        maxContinuations: 0, // Ép báo interrupted để kiểm tra không phạt key & gửi onInterrupted
        onChunk: (t) => {
          streamedOut += t;
        },
        onInterrupted: () => {
          interruptedEvents += 1;
        },
        clientFactory: () => ({
          models: {
            async generateContentStream() {
              async function* gen() {
                yield { text: '### 1. Chủ Đề Kỳ Hạn\nNội dung phần đầu ' };
                throw Object.assign(new Error('got status: UNAVAILABLE high demand'), { status: 503 });
              }
              return gen();
            },
            async generateContent() {
              return { text: 'OK' };
            },
          },
        }),
        disableJitter: true,
      });

      assert.strictEqual(interruptedEvents, 1, 'Phải gọi onInterrupted khi không nối tiếp');
      assert.strictEqual(meta.interrupted, true);
      assert.ok(streamedOut.includes('### 1. Chủ Đề Kỳ Hạn'));
      const rec = mgr._findKeyRecord(mgr._getRawKeyIdsForVerification()[0])!;
      assert.strictEqual(rec.status, 'ready', 'Đứt giữa luồng do 503 UNAVAILABLE KHÔNG được đưa key vào cooldown');
      assert.strictEqual(rec.healthScore, 100, 'KHÔNG được trừ 10 điểm thành NETWORK_OR_5XX');
      assert.ok((rec.modelCooldowns?.['gemini-3.5-flash-lite'] ?? 0) > Date.now(), 'Chỉ nguội tạm model 3.5-flash-lite 15s');
      console.log('  -> Đạt: 503 got status: UNAVAILABLE được phân loại MODEL_UNAVAILABLE và bảo toàn 100 điểm cho key.');
    }

    // ── BÀI 9: Tự động Tiếp Nối Luồng (Seamless Continuation) ───────────────
    {
      console.log('\n[9/12] Kiểm thử Tự động Tiếp Nối Luồng (3.5-flash-lite -> 3.8-flash)...');
      const dir9 = fs.mkdtempSync(path.join(tmpDir, 'cont-'));
      const mgr = new KeyPoolManager(dir9);
      const k1 = fakeKey('SeamlessContinueKey000000000001');
      const prev = mgr.previewBatchImport(k1);
      mgr.confirmBatchImport(prev.previewSessionId);

      const calls: Array<{ model: string; hasPartialSection: boolean }> = [];
      let interruptedEvents = 0;
      const metaSeen: Array<{ modelUsed: string; continuedFromPartial?: boolean }> = [];
      let fullText = '';

      const finalMeta = await mgr.executeStream({
        prompt: 'Hãy viết 4 mục luận giải cho năm Bính Ngọ 2026.',
        onMeta: (m) => {
          metaSeen.push({ modelUsed: m.modelUsed, continuedFromPartial: m.continuedFromPartial });
        },
        onChunk: (t) => {
          fullText += t;
        },
        onInterrupted: () => {
          interruptedEvents += 1;
        },
        clientFactory: () => ({
          models: {
            async generateContentStream(params) {
              calls.push({
                model: params.model,
                hasPartialSection: params.contents.includes('PHẦN ĐÃ VIẾT TRƯỚC ĐÓ'),
              });
              if (params.model === 'gemini-3.5-flash-lite') {
                async function* genPart1() {
                  yield { text: '### 1. Chủ Đề Kỳ Hạn\nLưu niên Bính Ngọ nhấn mạnh chuyển dịch.\n' };
                  yield { text: '### 2. Điểm Cát\nThiên Cơ Hóa Khoa ' };
                  throw Object.assign(new Error('503 got status: UNAVAILABLE'), { status: 503 });
                }
                return genPart1();
              }
              async function* genPart2() {
                yield { text: 'giúp sáng suốt.\n### 3. Điểm Hung\nCần giữ bình tĩnh.\n### 4. Lời Khuyên\nKiên trì.' };
              }
              return genPart2();
            },
            async generateContent() {
              return { text: 'OK' };
            },
          },
        }),
        disableJitter: true,
      });

      assert.strictEqual(interruptedEvents, 0, 'Nối tiếp thành công thì KHÔNG phát onInterrupted');
      assert.strictEqual(calls.length, 2);
      assert.deepStrictEqual(calls[0], { model: 'gemini-3.5-flash-lite', hasPartialSection: false });
      assert.deepStrictEqual(calls[1], { model: 'gemini-3.8-flash', hasPartialSection: true });
      assert.strictEqual(
        fullText,
        '### 1. Chủ Đề Kỳ Hạn\nLưu niên Bính Ngọ nhấn mạnh chuyển dịch.\n### 2. Điểm Cát\nThiên Cơ Hóa Khoa giúp sáng suốt.\n### 3. Điểm Hung\nCần giữ bình tĩnh.\n### 4. Lời Khuyên\nKiên trì.',
      );
      assert.strictEqual(finalMeta.continuedFromPartial, true);
      assert.strictEqual(finalMeta.continuationCount, 1);
      assert.strictEqual(finalMeta.modelUsed, 'gemini-3.8-flash');
      assert.ok(metaSeen.some((m) => m.continuedFromPartial === true), 'UI phải nhận gói meta cập nhật nối tiếp');

      const rec = mgr._findKeyRecord(mgr._getRawKeyIdsForVerification()[0])!;
      assert.strictEqual(rec.status, 'ready');
      assert.strictEqual(rec.healthScore, 100);
      console.log('  -> Đạt: Luồng bị ngắt giữa mục 2 được nối tiếp mượt sang 3.8-flash thành bài hoàn chỉnh.');
    }

    // ── BÀI 10: Cooldown chi tiết theo (Key, Model) khi gặp RATE_LIMIT_RPM ─
    {
      console.log('\n[10/12] Kiểm thử Cooldown theo cặp (Key, Model) & không lây sang Key B...');
      const dir10 = fs.mkdtempSync(path.join(tmpDir, 'modelcd-'));
      const mgr = new KeyPoolManager(dir10);
      const keyA = fakeKey('ModelCdKeyA00000000000000000001');
      const keyB = fakeKey('ModelCdKeyB00000000000000000002');
      const prev = mgr.previewBatchImport(`${keyA}, ${keyB}`);
      mgr.confirmBatchImport(prev.previewSessionId);

      // Kịch bản 1: Key A dính 429 RPM ở 3.5-flash-lite -> thử ngay 3.8-flash trên Key A và thành công
      const [idA] = mgr._getRawKeyIdsForVerification();
      let req1Text = '';
      await mgr.executeStream({
        prompt: 'Test RPM fallback trên cùng key A',
        onChunk: (t) => {
          req1Text += t;
        },
        clientFactory: () => ({
          models: {
            async generateContentStream(params) {
              if (params.model === 'gemini-3.5-flash-lite') {
                throw Object.assign(new Error('429 RATE_LIMIT_EXCEEDED PerMinute "retryDelay": "15s"'), { status: 429 });
              }
              async function* gen() {
                yield { text: 'OK từ 3.8-flash' };
              }
              return gen();
            },
            async generateContent() {
              return { text: 'OK' };
            },
          },
        }),
        disableJitter: true,
      });
      assert.strictEqual(req1Text, 'OK từ 3.8-flash');
      const recA = mgr._findKeyRecord(idA)!;
      assert.strictEqual(recA.status, 'ready', 'Key A vẫn ready cho 3.8-flash');
      assert.ok((recA.modelCooldowns?.['gemini-3.5-flash-lite'] ?? 0) > Date.now(), 'Model 3.5-flash-lite trên Key A phải nhớ trạng thái nguội');

      // Kịch bản 2: Key A fail cả 3.8-flash -> chuyển Key B, Key B PHẢI thử 3.5-flash-lite trước (không bị lây cờ toàn cục)
      const dir10b = fs.mkdtempSync(path.join(tmpDir, 'modelcd-b-'));
      const mgrB = new KeyPoolManager(dir10b);
      const p2 = mgrB.previewBatchImport(`${keyA}, ${keyB}`);
      mgrB.confirmBatchImport(p2.previewSessionId);

      const traceCalls: Array<{ key: string; model: string }> = [];
      let req2Text = '';
      await mgrB.executeStream({
        prompt: 'Test không lây sang Key B',
        onChunk: (t) => {
          req2Text += t;
        },
        clientFactory: (rawKey) => ({
          models: {
            async generateContentStream(params) {
              traceCalls.push({ key: maskApiKey(rawKey), model: params.model });
              if (rawKey === keyA) {
                throw Object.assign(new Error('429 RATE_LIMIT_EXCEEDED PerMinute'), { status: 429 });
              }
              async function* gen() {
                yield { text: 'Key B 3.5 thành công!' };
              }
              return gen();
            },
            async generateContent() {
              return { text: 'OK' };
            },
          },
        }),
        disableJitter: true,
      });

      assert.strictEqual(req2Text, 'Key B 3.5 thành công!');
      assert.strictEqual(traceCalls[0].model, 'gemini-3.5-flash-lite');
      assert.strictEqual(traceCalls[1].model, 'gemini-3.8-flash');
      assert.strictEqual(traceCalls[2].key, maskApiKey(keyB));
      assert.strictEqual(traceCalls[2].model, 'gemini-3.5-flash-lite', 'Key B KHÔNG được bỏ qua defaultModel');
      console.log('  -> Đạt: modelCooldowns cách ly chuẩn xác theo từng cặp (Key, Model) và không lây sang Key B.');
    }

    // ── BÀI 11: probeFloorScore = 95, latencyPenalty mịn (250ms) & heartbeat ─
    {
      console.log('\n[11/12] Kiểm thử probeFloorScore=95, latencyPenalty 250ms & KeyLease.heartbeat()...');
      const dir11 = fs.mkdtempSync(path.join(tmpDir, 'probe-'));
      const mgr = new KeyPoolManager(dir11);
      const kFast = fakeKey('FastHealthyKey00000000000000001');
      const kSlow = fakeKey('SlowHealthyKey00000000000000002');
      const kProbe = fakeKey('RecoverProbeKey0000000000000003');
      const prev = mgr.previewBatchImport(`${kFast}, ${kSlow}, ${kProbe}`);
      mgr.confirmBatchImport(prev.previewSessionId);

      const [idFast, idSlow, idProbe] = mgr._getRawKeyIdsForVerification();
      const recFast = mgr._findKeyRecord(idFast)!;
      const recSlow = mgr._findKeyRecord(idSlow)!;
      const recProbe = mgr._findKeyRecord(idProbe)!;

      // Key nhanh 200ms (penalty=0, score=100 -> tier 20) vs Key chậm 1100ms (penalty=4, score=96 -> tier 19)
      recFast.stats.avgLatencyMs = 200;
      recSlow.stats.avgLatencyMs = 1100;
      // Key hồi phục sau lỗi 5xx (-10 điểm -> 90, pendingProbe=true -> sàn 95 -> tier 19)
      recProbe.healthScore = 90;
      recProbe.pendingProbe = true;

      const allocator = mgr._getAllocatorForVerification();
      const firstLease = allocator.acquireLease(new Set(), new Set(), Date.now())!;
      assert.strictEqual(firstLease.keyId, idFast, 'Key nhanh 200ms (tier 20) phải thắng key chậm 1100ms (tier 19)');

      // Gọi heartbeat() và verify inFlightCount vẫn được giữ là 1 cho tới release()
      firstLease.heartbeat();
      assert.strictEqual(allocator.getInFlightCount(idFast), 1);
      firstLease.release();
      assert.strictEqual(allocator.getInFlightCount(idFast), 0);

      // Khi loại idFast, recProbe (pendingProbe floor 95 -> tier 19) đứng ngang hàng với recSlow (100 - 4 = 96 -> tier 19)
      // nên đều nằm trong top tier (không bị kẹt mãi sau key chậm!)
      recSlow.stats.avgLatencyMs = 2000; // penalty = 8 -> score 92 -> tier 18
      const probeLease = allocator.acquireLease(new Set([idFast]), new Set(), Date.now())!;
      assert.strictEqual(probeLease.keyId, idProbe, 'probeFloorScore=95 giúp key hồi phục vượt key chậm 2s ở tier 18');
      probeLease.release();
      console.log('  -> Đạt: probeFloorScore=95, latencyPenalty bước 250ms và KeyLease.heartbeat() hoạt động chuẩn.');
    }

    // ── BÀI 12: Chuẩn hóa PoolExhaustedError(AI_POOL_EXHAUSTED) cuối vòng lặp ─
    {
      console.log('\n[12/12] Kiểm thử chuẩn hóa PoolExhaustedError(AI_POOL_EXHAUSTED)...');
      const dir12 = fs.mkdtempSync(path.join(tmpDir, 'exhaust-'));
      const mgr = new KeyPoolManager(dir12);
      const k1 = fakeKey('ExhaustedKey0000000000000000001');
      const prev = mgr.previewBatchImport(k1);
      mgr.confirmBatchImport(prev.previewSessionId);

      let finalErr: unknown = null;
      try {
        await mgr.executeStream({
          prompt: 'test exhausted',
          onChunk: () => {},
          clientFactory: () => ({
            models: {
              async generateContentStream() {
                throw Object.assign(
                  new Error('{"error":{"code":429,"message":"PerMinute limit","details":[{"metadata":{"quota_limit_value":"0","consumer":"projects/111222333"}}]}}'),
                  { status: 429 },
                );
              },
              async generateContent() {
                return { text: 'OK' };
              },
            },
          }),
          disableJitter: true,
        });
      } catch (e) {
        finalErr = e;
      }

      assert.ok(finalErr instanceof PoolExhaustedError, 'Phải ném PoolExhaustedError khi toàn bộ kho kiệt quệ');
      const pe = finalErr as PoolExhaustedError;
      assert.strictEqual(pe.code, 'AI_POOL_EXHAUSTED');
      assert.ok(pe.minRemainingCooldownSec !== null && pe.minRemainingCooldownSec > 0);
      assert.ok(!pe.message.includes('{"error":'), 'Thông điệp lỗi trả về phải gọn gàng bằng tiếng Việt, không chứa JSON ApiError thô');
      console.log('  -> Đạt: PoolExhaustedError(AI_POOL_EXHAUSTED) chuẩn hóa đúng thông điệp và minRemainingCooldownSec.');
    }

    // ── BÀI 13: Đồng bộ chọn Model trong Dashboard & Lưu bền vững xuống đĩa ─
    {
      console.log('\n[13/14] Kiểm thử bảo toàn lựa chọn Model khi refresh snapshot & lưu bền vững...');
      // 1) Snapshot nền không ghi đè lựa chọn combobox đang chỉnh sửa (modelDirty=true)
      const kept = resolveNextModelSelection(
        { defaultModel: 'gemini-3.8-flash', fallbackModel: 'gemini-3.5-flash-lite' },
        { defaultModel: 'gemini-3.5-flash-lite', fallbackModel: 'gemini-3.8-flash' },
        { modelDirty: true },
      );
      assert.strictEqual(kept.defaultModel, 'gemini-3.8-flash', 'Snapshot cũ không được ghi đè model đang chọn');

      // Khi lưu xong (forceSyncFromSave=true) thì cập nhật theo phản hồi server
      const synced = resolveNextModelSelection(
        kept,
        { defaultModel: 'gemini-3.8-flash', fallbackModel: 'gemini-4-hydrogen' },
        { modelDirty: true, forceSyncFromSave: true },
      );
      assert.strictEqual(synced.fallbackModel, 'gemini-4-hydrogen');

      // 2) Lưu thật qua updateModelConfig -> persist xuống đĩa -> tái nạp giữ nguyên
      const dir13 = fs.mkdtempSync(path.join(tmpDir, 'modelcfg-'));
      const mgr13 = new KeyPoolManager(dir13);
      const updated = mgr13.updateModelConfig({
        defaultModel: 'gemini-3.8-flash',
        fallbackModel: 'gemini-3.5-flash-lite',
        customSupportedModels: ['gemini-3.9-pro'],
      });
      assert.strictEqual(updated.defaultModel, 'gemini-3.8-flash');
      assert.strictEqual(updated.fallbackModel, 'gemini-3.5-flash-lite');
      assert.ok(updated.supportedModels.includes('gemini-3.9-pro'));
      await mgr13.flushPersistence();

      const mgr13Reloaded = new KeyPoolManager(dir13);
      const diagReloaded = mgr13Reloaded.getDiagnostics();
      assert.strictEqual(diagReloaded.defaultModel, 'gemini-3.8-flash', 'Sau khởi động lại phải giữ model mặc định đã lưu');
      assert.strictEqual(diagReloaded.fallbackModel, 'gemini-3.5-flash-lite', 'Sau khởi động lại phải giữ model dự phòng đã lưu');
      console.log('  -> Đạt: Combobox không bị snapshot ghi đè; updateModelConfig lưu bền vững xuống đĩa & nạp lại chính xác.');
    }

    // ── BÀI 14: Điều kiện hiển thị huy hiệu "nối tiếp hoàn chỉnh" & cache ─────
    {
      console.log('\n[14/14] Kiểm thử huy hiệu nối tiếp theo trạng thái kết thúc đủ vs ngắt...');
      // Ca 1: Đã từng kích hoạt nối tiếp ở lượt trung gian (continuedFromPartial=true), nhưng bản cuối BỊ NGẮT (incomplete=true, meta.interrupted=true, không cache text)
      const interruptedEntry = {
        incomplete: true,
        incompleteText: '### 1. Chủ Đề\n...\n### 2. Điểm Cát\n...\n### 3. Điểm Hung\nDở dang...',
        meta: {
          continuedFromPartial: true,
          interrupted: true,
        },
      };
      assert.strictEqual(
        shouldShowCompletedContinuationBadge(interruptedEntry, false),
        false,
        'Bản bị ngắt KHÔNG bao giờ được hiện huy hiệu "Đã tự động nối tiếp luồng hoàn chỉnh"',
      );
      assert.strictEqual(
        shouldShowInterruptedContinuationBadge(interruptedEntry, false),
        true,
        'Bản bị ngắt phải hiện đúng huy hiệu đã thử nối tiếp nhưng vẫn bị ngắt',
      );
      assert.strictEqual(
        hasValidCachedPeriodEntry(interruptedEntry),
        false,
        'Bản bị ngắt không được xem là cache hợp lệ',
      );

      // Ca 2: Đang streaming (isLoading=true) chưa kết thúc -> chưa hiện huy hiệu hoàn chỉnh
      assert.strictEqual(
        shouldShowCompletedContinuationBadge(
          { text: 'Đang chạy...', meta: { continuedFromPartial: true } },
          true,
        ),
        false,
      );

      // Ca 3: Kết thúc đầy đủ, đã lưu text cache, không interrupted/incomplete -> hiện huy hiệu hoàn chỉnh
      const completedEntry = {
        text: '### 1. Chủ Đề\n...\n### 2. Điểm Cát\n...\n### 3. Điểm Hung\n...\n### 4. Lời Khuyên\n...',
        incomplete: false,
        meta: {
          continuedFromPartial: true,
          interrupted: false,
        },
      };
      assert.strictEqual(shouldShowCompletedContinuationBadge(completedEntry, false), true);
      assert.strictEqual(shouldShowInterruptedContinuationBadge(completedEntry, false), false);
      assert.strictEqual(hasValidCachedPeriodEntry(completedEntry), true);
      console.log('  -> Đạt: Huy hiệu "nối tiếp luồng hoàn chỉnh" chỉ hiện khi bản cuối hoàn chỉnh & đã lưu cache.');
    }

    // ── BÀI 15: Batch Cooldown Probe — Thứ tự ưu tiên, 4 kỷ luật Short-Circuit & Debounce ─
    {
      console.log('\n[15/16] Kiểm thử Batch Cooldown Probe (thứ tự ưu tiên, 4 kỷ luật Project, debounce, snapshot)...');
      assert.strictEqual(canTriggerBatchCooldownProbe(true, 5, false), false, 'ReadOnly phải khóa nút batch probe');
      assert.strictEqual(canTriggerBatchCooldownProbe(false, 0, false), false, 'N = 0 phải khóa nút batch probe');
      assert.strictEqual(canTriggerBatchCooldownProbe(false, 5, true), false, 'Đang chạy phải khóa nút batch probe');
      assert.strictEqual(canTriggerBatchCooldownProbe(false, 5, false), true, 'Có quyền ghi + N > 0 + chưa chạy -> cho phép');

      const mkKey = (overrides: Partial<CooldownProbeKeyShape> & { id: string }): CooldownProbeKeyShape => ({
        label: overrides.id,
        maskedKey: `AIza...${overrides.id}`,
        status: 'cooldown',
        detectedProjectNumber: null,
        healthScore: 60,
        cooldownUntil: 2_000_000_000_000,
        remainingCooldownSec: 21600,
        cooldownReason: 'QUOTA_PROJECT_ZERO',
        stats: {
          lastErrorType: 'QUOTA_PROJECT_ZERO',
          lastErrorMessage: null,
          lastErrorAt: 1_900_000_000_000,
          lastTestLatencyMs: null,
          lastTestedAt: null,
        },
        ...overrides,
      });

      const poolKeys: CooldownProbeKeyShape[] = [
        mkKey({ id: 'ready_skip', status: 'ready', healthScore: 100, cooldownReason: 'NONE', remainingCooldownSec: 0 }),
        mkKey({ id: 'disabled_skip', status: 'disabled', healthScore: 0, cooldownReason: 'AUTH_INVALID_KEY', remainingCooldownSec: 0 }),
        mkKey({ id: 'pz_1', cooldownReason: 'QUOTA_PROJECT_ZERO', detectedProjectNumber: 'P100' }),
        mkKey({ id: 'pz_2_same_p100', cooldownReason: 'QUOTA_PROJECT_ZERO', detectedProjectNumber: 'P100' }),
        mkKey({ id: 'pz_null_1', cooldownReason: 'QUOTA_PROJECT_ZERO', detectedProjectNumber: null }),
        mkKey({ id: 'pz_null_2', cooldownReason: 'QUOTA_PROJECT_ZERO', detectedProjectNumber: null }),
        mkKey({ id: 'daily_1', cooldownReason: 'QUOTA_DAILY_EXHAUSTED', detectedProjectNumber: 'P200' }),
        mkKey({ id: 'rpm_1', cooldownReason: 'RATE_LIMIT_RPM', detectedProjectNumber: 'P300' }),
        mkKey({ id: 'net_1', cooldownReason: 'NETWORK_OR_5XX', detectedProjectNumber: 'P400' }),
        mkKey({ id: 'net_2_same_p400', cooldownReason: 'NETWORK_OR_5XX', detectedProjectNumber: 'P400' }),
        mkKey({ id: 'debounce_key', cooldownReason: 'RATE_LIMIT_RPM', detectedProjectNumber: 'P500', remainingCooldownSec: 5 }),
      ];

      const queue = buildCooldownProbeQueue(poolKeys);
      assert.strictEqual(queue.length, 9, 'Chỉ giữ 9 key cooldown, loại ready và disabled');
      assert.strictEqual(queue[0].id, 'net_1', 'NETWORK_OR_5XX phải đứng đầu');
      assert.strictEqual(queue[1].id, 'net_2_same_p400', 'NETWORK_OR_5XX đứng trước RPM');
      assert.strictEqual(queue[2].id, 'debounce_key', 'RPM có remainingCooldownSec nhỏ hơn lên trước');
      assert.strictEqual(queue[3].id, 'rpm_1');
      assert.strictEqual(queue[4].id, 'daily_1', 'QUOTA_DAILY_EXHAUSTED đứng sau RPM');
      assert.strictEqual(queue[5].id, 'pz_1', 'QUOTA_PROJECT_ZERO đứng cuối');

      const probedIds: string[] = [];
      const repCooldownUntil = 1_999_999_999_000;
      const controller = new AbortController();
      const progress = await runClientBatchCooldownProbe({
        keys: poolKeys,
        delayBetweenRealProbesMs: 0,
        signal: controller.signal,
        probeSingleKey: async (keyId) => {
          probedIds.push(keyId);
          if (keyId === 'net_1') {
            return {
              kind: 'probed',
              ok: false,
              latencyMs: 320,
              modelUsed: 'gemini-3.5-flash-lite',
              status: 'cooldown',
              healthScore: 80,
              detectedProjectNumber: 'P400',
              errorCategory: 'NETWORK_OR_5XX',
              sanitizedMessage: '503 timeout',
              cooldownUntil: 1_999_900_000_000,
            };
          }
          if (keyId === 'net_2_same_p400') {
            return {
              kind: 'probed',
              ok: true,
              latencyMs: 190,
              modelUsed: 'gemini-3.5-flash-lite',
              status: 'ready',
              healthScore: 95,
              detectedProjectNumber: 'P400',
            };
          }
          if (keyId === 'debounce_key') {
            return {
              kind: 'deferred_debounce',
              message: 'Vui lòng chờ 4 giây giữa 2 lần kiểm tra.',
            };
          }
          if (keyId === 'pz_1') {
            return {
              kind: 'probed',
              ok: false,
              latencyMs: 140,
              modelUsed: 'gemini-3.5-flash-lite',
              status: 'cooldown',
              healthScore: 45,
              detectedProjectNumber: 'P100',
              errorCategory: 'QUOTA_PROJECT_ZERO',
              sanitizedMessage: 'quota_limit_value: 0',
              cooldownUntil: repCooldownUntil,
            };
          }
          if (keyId === 'pz_null_1' || keyId === 'pz_null_2') {
            return {
              kind: 'probed',
              ok: false,
              latencyMs: 150,
              modelUsed: 'gemini-3.5-flash-lite',
              status: 'cooldown',
              healthScore: 40,
              detectedProjectNumber: null,
              errorCategory: 'QUOTA_PROJECT_ZERO',
              sanitizedMessage: 'quota_limit_value: 0 (no project)',
              cooldownUntil: repCooldownUntil,
            };
          }
          return {
            kind: 'probed',
            ok: true,
            latencyMs: 180,
            modelUsed: 'gemini-3.5-flash-lite',
            status: 'ready',
            healthScore: 98,
          };
        },
      });

      // Kỷ luật (a): net_1 lỗi NETWORK_OR_5XX -> net_2_same_p400 KHÔNG bị nhảy cóc và hồi phục thành công!
      assert.ok(probedIds.includes('net_2_same_p400'), 'Kỷ luật (a): TUYỆT ĐỐI KHÔNG nhảy cóc sau NETWORK_OR_5XX');
      // Kỷ luật (b): pz_null_1 & pz_null_2 đều có detectedProjectNumber=null -> cả hai được probe độc lập
      assert.ok(probedIds.includes('pz_null_1') && probedIds.includes('pz_null_2'), 'Kỷ luật (b): key null project luôn probe độc lập');
      // Kỷ luật (c): pz_2_same_p100 bị nhảy cóc do cùng Project P100 gặp QUOTA_PROJECT_ZERO, đồng bộ cooldownUntil từ đại diện
      assert.ok(!probedIds.includes('pz_2_same_p100'), 'pz_2_same_p100 phải được nhảy cóc Same-Project');
      const skippedItem = progress.results.find((r) => r.id === 'pz_2_same_p100')!;
      assert.strictEqual(skippedItem.outcome, 'skipped_same_project');
      assert.strictEqual(skippedItem.isRealProbe, false);
      assert.strictEqual(skippedItem.representativeKeyId, 'pz_1');
      assert.strictEqual(skippedItem.cooldownUntil, repCooldownUntil, 'Kỷ luật (c): cooldownUntil phải đồng bộ theo key đại diện');
      // Bộ đếm debounced không làm sai lệch lỗi
      assert.strictEqual(progress.counts.skippedSameProject, 1, 'Không tính null project vào skippedSameProject');
      assert.strictEqual(progress.counts.deferred, 1, 'Key 429 debounce phải vào deferred');
      assert.strictEqual(progress.counts.recovered, 3, 'net_2_same_p400 + rpm_1 + daily_1 hồi phục');
      assert.strictEqual(progress.counts.stillFailing, 4, 'net_1 + pz_1 + pz_null_1 + pz_null_2');

      // Kiểm tra applyBatchItemToSnapshot cập nhật đơn lẻ không làm mất phần còn lại
      const initSnap = {
        keys: poolKeys,
        summary: { total: poolKeys.length, ready: 1, cooldown: 9, disabled: 1 },
      };
      const recoveredNet2 = progress.results.find((r) => r.id === 'net_2_same_p400') as BatchCooldownItemResult;
      const snapAfter = applyBatchItemToSnapshot(initSnap, recoveredNet2, 1_900_000_000_000);
      assert.strictEqual(snapAfter.summary.ready, 2);
      assert.strictEqual(snapAfter.summary.cooldown, 8);
      assert.strictEqual(snapAfter.keys.find((k) => k.id === 'net_2_same_p400')?.status, 'ready');

      // Kiểm tra stop giữa chừng bảo toàn kết quả đã probe và bỏ phần còn lại
      let stopFlag = false;
      const partialCtrl = new AbortController();
      const partialRes = await runClientBatchCooldownProbe({
        keys: [mkKey({ id: 's1' }), mkKey({ id: 's2' }), mkKey({ id: 's3' })],
        delayBetweenRealProbesMs: 0,
        signal: partialCtrl.signal,
        shouldStop: () => stopFlag,
        probeSingleKey: async (kid) => {
          if (kid === 's1') stopFlag = true;
          return {
            kind: 'probed',
            ok: true,
            latencyMs: 120,
            modelUsed: 'gemini-3.5-flash-lite',
            status: 'ready',
            healthScore: 100,
          };
        },
      });
      assert.strictEqual(partialRes.stoppedEarly, true);
      assert.strictEqual(partialRes.processed, 1, 'Dừng sau key hiện tại, bảo toàn 1 kết quả đã xong');
      console.log('  -> Đạt: Thứ tự ưu tiên, 4 kỷ luật Same-Project, debounce, stop giữa chừng và cập nhật 1 dòng snapshot chuẩn.');
    }

    // ── BÀI 16: Allocator đồng bộ cooldown sang peer ĐÃ cooldown cùng GCP Project ─
    {
      console.log('\n[16/16] Kiểm thử allocator.recordFailure đồng bộ cooldown sang peer đang cooldown cùng Project...');
      const dir16 = fs.mkdtempSync(path.join(tmpDir, 'peer-sync-'));
      const mgr16 = new KeyPoolManager(dir16);
      const kRep = fakeKey('RepKeySameProj00000000000000001');
      const kAlreadyCd = fakeKey('AlreadyCdSameProj00000000000002');
      const prev16 = mgr16.previewBatchImport(`${kRep}, ${kAlreadyCd}`);
      mgr16.confirmBatchImport(prev16.previewSessionId);

      const [repId, cdPeerId] = mgr16._getRawKeyIdsForVerification();
      const cdPeer = mgr16._findKeyRecord(cdPeerId)!;
      cdPeer.detectedProjectNumber = '555666777';
      cdPeer.status = 'cooldown';
      cdPeer.cooldownReason = 'QUOTA_PROJECT_ZERO';
      cdPeer.healthScore = 70;
      cdPeer.cooldownUntil = 1_700_000_010_000;

      const alloc16 = mgr16._getAllocatorForVerification();
      const tProbe = 1_700_500_000_000;
      alloc16.recordFailure(
        repId,
        {
          category: 'QUOTA_PROJECT_ZERO',
          projectNumber: '555666777',
          retryDelaySec: null,
          sanitizedSummary: '429 quota_limit_value: "0" projects/555666777',
        },
        tProbe,
        true,
      );

      const repAfter = mgr16._findKeyRecord(repId)!;
      const peerAfter = mgr16._findKeyRecord(cdPeerId)!;
      assert.strictEqual(peerAfter.cooldownUntil, repAfter.cooldownUntil, 'Peer đang cooldown cùng Project phải đồng bộ cooldownUntil theo key đại diện');
      assert.strictEqual(peerAfter.healthScore, 70, 'KHÔNG phạt trừ thêm healthScore đối với peer đã ở trạng thái cooldown');
      console.log('  -> Đạt: Peer đang cooldown cùng GCP Project được đồng bộ cooldownUntil mà không trừ oan healthScore.');
    }

    // ── BÀI 17: B2 Hồi quy — CALL_SUCCESS ghi recentLogs trên key ready & acquireLease gọi onStateMutated ─
    {
      console.log('\n[17/17] Kiểm thử B2: recordSuccess (wasProbe=false) ghi CALL_SUCCESS & acquireLease persist lastUsedAt...');
      const rawK = fakeKey('B2ReadyCallLogKey00000000000001');
      const keyId = 'k_b2_test';
      let mutatedCalls: boolean[] = [];
      const mockState: KeyPoolState = {
        version: 1,
        roundRobinCursor: 0,
        modelConfig: {
          defaultModel: 'gemini-3.5-flash-lite',
          fallbackModel: 'gemini-3.8-flash',
          supportedModels: ['gemini-3.5-flash-lite', 'gemini-3.8-flash'],
        },
        disabledEnvFingerprints: [],
        keys: [
          {
            id: keyId,
            label: 'Key B2 Test',
            source: 'user_import',
            maskedKey: maskApiKey(rawK),
            fingerprint: 'fp_b2',
            encryptedKey: { iv: '', authTag: '', ciphertext: '' },
            detectedProjectNumber: null,
            status: 'ready',
            pendingProbe: false,
            healthScore: 95,
            consecutiveErrors: 0,
            cooldownUntil: null,
            cooldownReason: 'NONE',
            lastScoreRecoveryAt: 1_700_000_000_000,
            stats: {
              totalCalls: 10,
              successCalls: 8,
              errorCalls: 2,
              lastErrorType: 'NONE',
              lastErrorMessage: null,
              lastErrorAt: null,
              lastUsedAt: null,
              lastSuccessAt: null,
              avgLatencyMs: 250,
              lastTestLatencyMs: null,
              lastTestedAt: null,
            },
            createdAt: 1_700_000_000_000,
            updatedAt: 1_700_000_000_000,
          },
        ],
        recentLogs: [],
      };
      const rawMap = new Map<string, string>([[keyId, rawK]]);
      const allocB2 = new KeyAllocator(
        () => mockState,
        () => rawMap,
        (immediate) => {
          mutatedCalls.push(immediate);
        },
      );

      // 1) acquireLease phải cập nhật lastUsedAt và gọi onStateMutated(false) ngay lập tức
      const tLease = 1_700_600_000_000;
      const lease = allocB2.acquireLease(new Set(), new Set(), tLease);
      assert.ok(lease, 'Phải cấp được lease cho key ready');
      assert.strictEqual(mockState.keys[0].stats.lastUsedAt, tLease, 'acquireLease phải cập nhật lastUsedAt');
      assert.ok(mutatedCalls.includes(false), 'acquireLease phải gọi onStateMutated(false) để persist lastUsedAt');
      lease.release();

      // 2) recordSuccess trên key ready ổn định (wasProbe === false) phải ghi CALL_SUCCESS vào recentLogs và tăng stats
      const tSuccess = tLease + 240;
      allocB2.recordSuccess(keyId, 240, tSuccess, 'gemini-3.5-flash-lite');
      assert.strictEqual(mockState.keys[0].stats.totalCalls, 11);
      assert.strictEqual(mockState.keys[0].stats.successCalls, 9);
      assert.strictEqual(mockState.keys[0].stats.lastSuccessAt, tSuccess);
      assert.strictEqual(mockState.keys[0].status, 'ready');
      assert.strictEqual(mockState.keys[0].cooldownUntil, null);
      assert.strictEqual(mockState.recentLogs.length, 1, 'recordSuccess nhánh else phải ghi 1 dòng vào recentLogs');
      const lastLog = mockState.recentLogs[0];
      assert.strictEqual(lastLog.fromStatus, 'ready');
      assert.strictEqual(lastLog.toStatus, 'ready');
      assert.ok(lastLog.reason.startsWith('CALL_SUCCESS'), `Reason phải bắt đầu bằng CALL_SUCCESS, nhận: ${lastLog.reason}`);
      assert.ok(lastLog.reason.includes('gemini-3.5-flash-lite'));
      assert.ok(lastLog.reason.includes('ttfb=240ms'));

      // 3) Không vượt quá MAX_RECENT_LOGS (100) khi gọi nhiều lần liên tiếp
      for (let i = 0; i < MAX_RECENT_LOGS + 15; i++) {
        allocB2.recordSuccess(keyId, 180 + i, tSuccess + 1000 + i, 'gemini-3.5-flash-lite');
      }
      assert.strictEqual(mockState.recentLogs.length, MAX_RECENT_LOGS, 'recentLogs phải giữ nguyên trần MAX_RECENT_LOGS=100');
      console.log('  -> Đạt: acquireLease persist lastUsedAt ngay; recordSuccess (wasProbe=false) ghi CALL_SUCCESS và giữ trần 100 log.');
    }

    // ── BÀI 18: PHA 0 (NV-01 & H4) — AbortError/FIRST_CHUNK_TIMEOUT không phạt key & khử trùng câu cảnh báo gián đoạn ─
    {
      console.log('\n[18/18] Kiểm thử NV-01 & Hồi quy H4: AbortError/FIRST_CHUNK_TIMEOUT -> MODEL_UNAVAILABLE (0 phạt key) & không bơm trùng cảnh báo vào onChunk...');

      // (18a) Kiểm thử trực tiếp classifyGeminiError với DOMException AbortError (code=20) và Error('FIRST_CHUNK_TIMEOUT')
      const domAbortErr = new DOMException('This operation was aborted', 'AbortError');
      assert.strictEqual(domAbortErr.name, 'AbortError');
      assert.strictEqual((domAbortErr as unknown as { code?: number }).code, 20);
      const classifiedDomAbort = classifyGeminiError(domAbortErr);
      assert.strictEqual(
        classifiedDomAbort.category,
        'MODEL_UNAVAILABLE',
        'DOMException AbortError do AbortController.abort() phải được xếp vào MODEL_UNAVAILABLE để không phạt key',
      );
      assert.strictEqual(
        computeCooldownDurationMs(classifiedDomAbort.category, 1, null, 0, true),
        null,
        'MODEL_UNAVAILABLE không đặt cooldown cấp key',
      );

      const firstChunkTimeoutErr = new Error('FIRST_CHUNK_TIMEOUT');
      const classifiedFirstChunk = classifyGeminiError(firstChunkTimeoutErr);
      assert.strictEqual(
        classifiedFirstChunk.category,
        'MODEL_UNAVAILABLE',
        'Error(FIRST_CHUNK_TIMEOUT) từ bộ hẹn giờ chunk đầu phải xếp vào MODEL_UNAVAILABLE',
      );

      // Đảm bảo lỗi mạng thật & 5xx vẫn giữ nguyên NETWORK_OR_5XX (-10 điểm, 30s cooldown)
      const realNetErr = classifyGeminiError(new Error('fetch failed: ECONNRESET'));
      assert.strictEqual(realNetErr.category, 'NETWORK_OR_5XX');
      assert.strictEqual(computeCooldownDurationMs(realNetErr.category, 1, null, 0, true), 30_000);

      // (18b) Truy vết toàn luồng executeStream khi gemini-3.5-flash-lite bị abort chờ chunk đầu -> fallback sang gemini-3.8-flash, key giữ nguyên 100 điểm & ready
      const dir18 = fs.mkdtempSync(path.join(tmpDir, 'h4-nv01-'));
      const mgr18 = new KeyPoolManager(dir18);
      const kH4 = fakeKey('H4ProactiveAbortKey000000000001');
      const prev18 = mgr18.previewBatchImport(kH4);
      mgr18.confirmBatchImport(prev18.previewSessionId);
      const [idH4] = mgr18._getRawKeyIdsForVerification();

      const attemptedModels18: string[] = [];
      let out18 = '';
      const meta18 = await mgr18.executeStream({
        prompt: 'Kiểm thử NV-01 timeout chunk đầu',
        onChunk: (t) => {
          out18 += t;
        },
        clientFactory: () => ({
          models: {
            async generateContentStream(params) {
              attemptedModels18.push(params.model);
              if (params.model === 'gemini-3.5-flash-lite') {
                throw new DOMException('This operation was aborted', 'AbortError');
              }
              async function* gen() {
                yield { text: 'Phản hồi thành công sau khi abort 3.5-flash-lite.' };
              }
              return gen();
            },
            async generateContent() {
              return { text: 'OK' };
            },
          },
        }),
        disableJitter: true,
      });

      assert.deepStrictEqual(attemptedModels18, ['gemini-3.5-flash-lite', 'gemini-3.8-flash']);
      assert.strictEqual(out18, 'Phản hồi thành công sau khi abort 3.5-flash-lite.');
      assert.strictEqual(meta18.modelUsed, 'gemini-3.8-flash');
      const recH4 = mgr18._findKeyRecord(idH4)!;
      assert.strictEqual(recH4.status, 'ready', 'Key KHÔNG được bị đẩy sang cooldown khi abort chờ chunk đầu');
      assert.strictEqual(recH4.healthScore, 100, 'Key KHÔNG được bị trừ 10 điểm khi abort chờ chunk đầu');

      // (18c) Kiểm thử khử trùng thông báo gián đoạn: khi đứt luồng (cả nhánh !canContinue lẫn nhánh hết lượt nối tiếp),
      // onChunk chỉ chứa văn bản AI thuần, KHÔNG bị bơm thêm câu "*(Luồng kết nối bị gián đoạn giữa chừng..."
      let chunkTextBranch1 = '';
      let interruptedCountBranch1 = 0;
      await mgr18.executeStream({
        prompt: 'Kiểm thử nhánh 1 (!canContinue)',
        maxContinuations: 0,
        onChunk: (t) => {
          chunkTextBranch1 += t;
        },
        onInterrupted: () => {
          interruptedCountBranch1 += 1;
        },
        clientFactory: () => ({
          models: {
            async generateContentStream() {
              async function* gen() {
                yield { text: 'Đoạn văn bản AI đang viết dở.' };
                throw new Error('fetch failed: ECONNRESET');
              }
              return gen();
            },
            async generateContent() {
              return { text: 'OK' };
            },
          },
        }),
        disableJitter: true,
      });

      assert.strictEqual(interruptedCountBranch1, 1, 'onInterrupted phải được gọi đúng 1 lần ở nhánh !canContinue');
      assert.strictEqual(
        chunkTextBranch1,
        'Đoạn văn bản AI đang viết dở.',
        'onChunk KHÔNG được chứa câu cảnh báo gián đoạn trùng lặp ở nhánh !canContinue',
      );
      assert.ok(!chunkTextBranch1.includes('Luồng kết nối bị gián đoạn giữa chừng'));

      // Khôi phục key để kiểm tra nhánh 2 (firstChunkEverSent sau khi hết lượt thử nối tiếp)
      mgr18.reactivateKey(idH4);
      let chunkTextBranch2 = '';
      let interruptedCountBranch2 = 0;
      await mgr18.executeStream({
        prompt: 'Kiểm thử nhánh 2 (hết khóa khi đang nối tiếp)',
        maxContinuations: 2,
        onChunk: (t) => {
          chunkTextBranch2 += t;
        },
        onInterrupted: () => {
          interruptedCountBranch2 += 1;
        },
        clientFactory: () => ({
          models: {
            async generateContentStream(params) {
              if (!params.contents.includes('PHẦN ĐÃ VIẾT TRƯỚC ĐÓ')) {
                async function* genFirst() {
                  yield { text: 'Phần 1 đã gửi thành công.' };
                  throw Object.assign(new Error('503 got status: UNAVAILABLE'), { status: 503 });
                }
                return genFirst();
              }
              throw Object.assign(new Error('503 got status: UNAVAILABLE'), { status: 503 });
            },
            async generateContent() {
              return { text: 'OK' };
            },
          },
        }),
        disableJitter: true,
      });

      assert.strictEqual(interruptedCountBranch2, 1, 'onInterrupted phải được gọi đúng 1 lần ở nhánh cuối hàm');
      assert.strictEqual(
        chunkTextBranch2,
        'Phần 1 đã gửi thành công.',
        'onChunk KHÔNG được chứa câu cảnh báo gián đoạn trùng lặp ở nhánh cuối hàm',
      );
      assert.ok(!chunkTextBranch2.includes('Luồng kết nối bị gián đoạn giữa chừng'));
      console.log('  -> Đạt: AbortError/FIRST_CHUNK_TIMEOUT xếp vào MODEL_UNAVAILABLE (0 phạt key) & khử sạch thông báo gián đoạn trùng lặp.');
    }

    console.log('\n=== TẤT CẢ 18 BÀI KIỂM THỬ KHO KHÓA, BATCH PROBE, B2 & H4 (NV-01) ĐỀU ĐẠT ===');
  } finally {
    if (origEnvKey !== undefined) process.env.GEMINI_API_KEY = origEnvKey;
    if (origEnvKeys !== undefined) process.env.GEMINI_API_KEYS = origEnvKeys;
    if (origMasterSecret !== undefined) process.env.KEY_POOL_MASTER_SECRET = origMasterSecret;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

runTests().catch((err) => {
  console.error('KIỂM THỬ THẤT BẠI:', err);
  process.exit(1);
});
