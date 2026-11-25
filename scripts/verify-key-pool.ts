process.env.ZIWEI_DISABLE_AUTO_LISTEN = '1';
import assert from 'assert';
import express from 'express';
import fs from 'fs';
import type { AddressInfo } from 'net';
import os from 'os';
import path from 'path';
import { KeyPoolManager, keyPoolManager as globalKeyPoolManager } from '../server/key-pool/index.ts';
import {
  classifyGeminiError,
  computeCooldownDurationMs,
  formatHumanReadableErrorVi,
  isSupportedGemini35Plus,
  KeyAllocator,
  sanitizeSecretText,
} from '../server/key-pool/allocator.ts';
import {
  DEFAULT_MODEL,
  DEFAULT_MODEL_PROFILES,
  FALLBACK_LEG_TIME_BUDGET_MS,
  FALLBACK_MODEL,
  FIRST_CHUNK_TIMEOUT_MS,
  GEMMA_TPM_CHARS_PER_TOKEN_VI,
  GEMMA_TPM_GUARD_THRESHOLD,
  LEASE_ABSOLUTE_MAX_TTL_MS,
  LEASE_MAX_TTL_MS,
  MAX_RECENT_LOGS,
  TEST_KEY_MAX_OUTPUT_TOKENS,
  TEST_KEY_TIMEOUT_MS,
  type KeyPoolState,
  type StreamExecutionMeta,
} from '../server/key-pool/types.ts';
import { maskApiKey, parseBatchKeys } from '../server/key-pool/parser.ts';
import { KeyPoolCryptoStore, SerializedWriteQueue } from '../server/key-pool/crypto-store.ts';
import {
  AiClientFactory,
  buildContinuationPrompt,
  estimateRequestInputTokens,
  isGemmaModel,
  normalizeContinuationSeam,
  PoolExhaustedError,
} from '../server/key-pool/executor.ts';
import { registerApiRoutes } from '../server.ts';
import { generateChart } from '../src/lib/ziwei/algorithm.ts';
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

function fakeAqKey(suffix: string): string {
  const padded = suffix.padStart(50, 'A').slice(-50);
  return `AQ.${padded}`;
}

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
      mgr.updateModelConfig({ defaultModel: 'gemini-3.5-flash-lite', fallbackModel: 'gemini-3.8-flash' });
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
      mgr.updateModelConfig({ defaultModel: 'gemini-3.5-flash-lite', fallbackModel: 'gemini-3.8-flash' });
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
      mgr.updateModelConfig({ defaultModel: 'gemini-3.5-flash-lite', fallbackModel: 'gemini-3.8-flash' });
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
      mgrB.updateModelConfig({ defaultModel: 'gemini-3.5-flash-lite', fallbackModel: 'gemini-3.8-flash' });
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
      mgr18.updateModelConfig({ defaultModel: 'gemini-3.5-flash-lite', fallbackModel: 'gemini-3.8-flash' });
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

    // ── BÀI 19: Fast-Sweep (QĐ-F1..F4 & siết FS2-01..FS2-05) ───────────────────
    {
      console.log('\n[19/19] Kiểm thử Fast-Sweep (8 khóa quota=0, cả kho quota=0, FS2-01 UNKNOWN, FS2-02 đồng bộ project, FS2-04 chậm quá 35s)...');

      // (19a) 8 khóa QUOTA_PROJECT_ZERO đứng trước 1 khóa sống #9 -> thành công từ khóa #9 ngay trong 1 request
      {
        const dir19a = fs.mkdtempSync(path.join(tmpDir, 'fs-19a-'));
        const mgr19a = new KeyPoolManager(dir19a);
        const zeroKeys = Array.from({ length: 8 }, (_, idx) =>
          fakeKey(`FsZeroKey${String(idx + 1).padStart(26, '0')}`),
        );
        const liveKey = fakeKey('FsLiveKeyNine000000000000000009');
        const prev19a = mgr19a.previewBatchImport([...zeroKeys, liveKey].join('\n'));
        mgr19a.confirmBatchImport(prev19a.previewSessionId);

        const callLog19a: string[] = [];
        let out19a = '';
        const meta19a = await mgr19a.executeStream({
          prompt: 'Fast-Sweep 8 zero keys + 1 live key',
          onChunk: (t) => {
            out19a += t;
          },
          clientFactory: (rawKey) => ({
            models: {
              async generateContentStream() {
                callLog19a.push(rawKey);
                const zeroIdx = zeroKeys.indexOf(rawKey);
                if (zeroIdx !== -1) {
                  const proj = `76510398407${zeroIdx}`;
                  throw Object.assign(
                    new Error(`429 RESOURCE_EXHAUSTED projects/${proj} quota_limit_value: "0"`),
                    { status: 429 },
                  );
                }
                async function* gen() {
                  yield { text: 'Thành công từ khóa thứ 9!' };
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

        assert.strictEqual(callLog19a.length, 9, 'Phải quét đủ 8 khóa quota=0 và gọi khóa sống #9 trong 1 request');
        assert.strictEqual(out19a, 'Thành công từ khóa thứ 9!');
        assert.strictEqual(meta19a.maskedKey, maskApiKey(liveKey));
        const snap19a = mgr19a.getPublicSnapshot({
          isReadOnly: false,
          isSharedOrigin: false,
          adminPinRequired: false,
          hasAdminPinConfigured: false,
        });
        assert.strictEqual(snap19a.summary.cooldown, 8, 'Cả 8 khóa quota=0 phải vào cooldown 6h');
        assert.strictEqual(snap19a.summary.ready, 1, 'Chỉ còn 1 khóa sống ready');
        const cdKeys = snap19a.keys.filter((k) => k.status === 'cooldown');
        assert.ok(
          cdKeys.every((k) => k.cooldownReason === 'QUOTA_PROJECT_ZERO' && k.remainingCooldownSec >= 21500),
          'Mỗi khóa quota=0 phải có cooldown 6h',
        );
      }

      // (19b) Cả kho 8 khóa đều QUOTA_PROJECT_ZERO -> PoolExhaustedError ngay trong 1 request
      {
        const dir19b = fs.mkdtempSync(path.join(tmpDir, 'fs-19b-'));
        const mgr19b = new KeyPoolManager(dir19b);
        const allZero = Array.from({ length: 8 }, (_, idx) =>
          fakeKey(`FsAllZero${String(idx + 1).padStart(26, '0')}`),
        );
        const prev19b = mgr19b.previewBatchImport(allZero.join('\n'));
        mgr19b.confirmBatchImport(prev19b.previewSessionId);

        let err19b: unknown = null;
        let calls19b = 0;
        try {
          await mgr19b.executeStream({
            prompt: 'All 8 keys quota=0',
            onChunk: () => {},
            clientFactory: (rawKey) => ({
              models: {
                async generateContentStream() {
                  calls19b += 1;
                  const idx = allZero.indexOf(rawKey);
                  throw Object.assign(
                    new Error(`429 RESOURCE_EXHAUSTED projects/88800010${idx} quota_limit_value: "0"`),
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
          err19b = e;
        }
        assert.strictEqual(calls19b, 8, 'Phải quét sạch cả 8 khóa quota=0 ngay trong 1 request');
        assert.ok(err19b instanceof PoolExhaustedError, 'Phải ném PoolExhaustedError ngay trong 1 request');
        const pe19b = err19b as PoolExhaustedError;
        assert.strictEqual(pe19b.code, 'AI_POOL_EXHAUSTED');
        assert.ok(pe19b.minRemainingCooldownSec !== null && pe19b.minRemainingCooldownSec > 21000);
        // Kiểm tra collectErrorText không tạo chuỗi lặp Error: ... | Error: ...
        const sanitizedErrText = sanitizeSecretText(pe19b, []);
        const errPrefixCount = (sanitizedErrText.match(/PoolExhaustedError:/g) ?? []).length;
        assert.strictEqual(errPrefixCount, 1, 'collectErrorText không được nhân đôi dòng đầu Error: ... | Error: ...');
      }

      // (19c) FS2-01: 7 khóa đều gặp lỗi UNKNOWN (dạng 400 INVALID_ARGUMENT) -> dừng ở 5 lượt, giữ Error thường (KHÔNG ép PoolExhaustedError)
      {
        const dir19c = fs.mkdtempSync(path.join(tmpDir, 'fs-19c-'));
        const mgr19c = new KeyPoolManager(dir19c);
        const sevenKeys = Array.from({ length: 7 }, (_, idx) =>
          fakeKey(`FsUnknown${String(idx + 1).padStart(26, '0')}`),
        );
        const prev19c = mgr19c.previewBatchImport(sevenKeys.join('\n'));
        mgr19c.confirmBatchImport(prev19c.previewSessionId);

        let err19c: unknown = null;
        let calls19c = 0;
        try {
          await mgr19c.executeStream({
            prompt: '400 INVALID_ARGUMENT unknown error',
            onChunk: () => {},
            clientFactory: () => ({
              models: {
                async generateContentStream() {
                  calls19c += 1;
                  throw Object.assign(new Error('400 INVALID_ARGUMENT: prompt exceeds limit'), {
                    status: 400,
                  });
                },
                async generateContent() {
                  return { text: 'OK' };
                },
              },
            }),
            disableJitter: true,
          });
        } catch (e) {
          err19c = e;
        }
        assert.strictEqual(calls19c, 5, 'Lỗi UNKNOWN không được Fast-Sweep quá MAX_KEY_ATTEMPTS=5');
        assert.ok(err19c instanceof Error, 'Phải ném Error');
        assert.ok(!(err19c instanceof PoolExhaustedError), 'FS2-01: Lỗi UNKNOWN khi kho còn khóa ready KHÔNG được ép thành PoolExhaustedError');
      }

      // (19d) FS2-02: 2 khóa cùng project đã biết project_number đứng trước khóa sống -> chỉ 1 lượt gọi dọn cả 2
      {
        const dir19d = fs.mkdtempSync(path.join(tmpDir, 'fs-19d-'));
        const mgr19d = new KeyPoolManager(dir19d);
        const kProjA = fakeKey('FsSameProjA00000000000000000001');
        const kProjB = fakeKey('FsSameProjB00000000000000000002');
        const kHealthy = fakeKey('FsSameProjLive00000000000000003');
        const prev19d = mgr19d.previewBatchImport(`${kProjA}\n${kProjB}\n${kHealthy}`);
        mgr19d.confirmBatchImport(prev19d.previewSessionId);

        const [idProjA, idProjB] = mgr19d._getRawKeyIdsForVerification();
        mgr19d._findKeyRecord(idProjA)!.detectedProjectNumber = '777888999';
        mgr19d._findKeyRecord(idProjB)!.detectedProjectNumber = '777888999';

        const called19d: string[] = [];
        let out19d = '';
        const meta19d = await mgr19d.executeStream({
          prompt: 'Same project FS2-02',
          onChunk: (t) => {
            out19d += t;
          },
          clientFactory: (rawKey) => ({
            models: {
              async generateContentStream() {
                called19d.push(rawKey);
                if (rawKey === kProjA || rawKey === kProjB) {
                  throw Object.assign(
                    new Error('429 RESOURCE_EXHAUSTED projects/777888999 quota_limit_value: "0"'),
                    { status: 429 },
                  );
                }
                async function* gen() {
                  yield { text: 'OK sau 1 lượt dọn cả 2 khóa cùng project.' };
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

        assert.strictEqual(called19d.length, 2, 'FS2-02: Chỉ tốn đúng 1 lượt gọi cho cặp khóa cùng project + 1 lượt cho khóa sống');
        assert.strictEqual(out19d, 'OK sau 1 lượt dọn cả 2 khóa cùng project.');
        assert.strictEqual(meta19d.maskedKey, maskApiKey(kHealthy));
        assert.strictEqual(mgr19d._findKeyRecord(idProjA)!.status, 'cooldown');
        assert.strictEqual(mgr19d._findKeyRecord(idProjB)!.status, 'cooldown');
      }

      // (19e) FS2-04: Khóa chết phản hồi chậm -> trần ngân sách 35s thắng trần 50 khóa & vẫn trả PoolExhaustedError sạch
      {
        const dir19e = fs.mkdtempSync(path.join(tmpDir, 'fs-19e-'));
        const mgr19e = new KeyPoolManager(dir19e);
        const slowKeys = Array.from({ length: 10 }, (_, idx) =>
          fakeKey(`FsSlowDead${String(idx + 1).padStart(25, '0')}`),
        );
        const prev19e = mgr19e.previewBatchImport(slowKeys.join('\n'));
        mgr19e.confirmBatchImport(prev19e.previewSessionId);

        let simNow = 1_800_000_000_000;
        let slowCalls = 0;
        let err19e: unknown = null;
        try {
          await mgr19e.executeStream({
            prompt: 'Slow dead keys exceed 35s budget',
            nowFn: () => simNow,
            onChunk: () => {},
            clientFactory: (rawKey) => ({
              models: {
                async generateContentStream() {
                  slowCalls += 1;
                  simNow += 12_000; // mỗi lượt tốn 12 giây -> sau 3 lượt là 36s > 35s
                  const idx = slowKeys.indexOf(rawKey);
                  throw Object.assign(
                    new Error(`429 RESOURCE_EXHAUSTED projects/99900010${idx} quota_limit_value: "0"`),
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
          err19e = e;
        }

        assert.strictEqual(slowCalls, 3, 'FS2-04: Phải dừng đúng ở 3 lượt (36s >= 35s), không chạy hết 10/50 khóa');
        assert.ok(err19e instanceof PoolExhaustedError, 'FS2-04: Khi cạn ngân sách 35s phải trả PoolExhaustedError sạch');
        assert.strictEqual((err19e as PoolExhaustedError).code, 'AI_POOL_EXHAUSTED');
      }

      console.log('  -> Đạt: Fast-Sweep 19a–19e đạt (8 khóa quota=0 -> #9, cả kho hết -> 503, FS2-01 UNKNOWN giữ Error thường, FS2-02 1 lượt dọn cùng project, FS2-04 trần 35s thắng).');
    }

    // ── BÀI 20: B1 (ĐK-151-01, 02) — Parser, che log & round-trip cho khóa AQ. ─
    {
      console.log('\n[20/24] Kiểm thử B1: Khóa AQ. (parser đa định dạng, ENV, sanitizeSecretText, loadState)...');
      const aq50 = fakeAqKey('TestSampleAQKey00000000000000000000000000001'); // AQ. + 50 = 53
      const aq48 = `AQ.${'B'.repeat(48)}`; // biên dưới 48+3=51
      const aq54 = `AQ.${'C'.repeat(54)}`; // biên trên 54+3=57
      const aqJson = fakeAqKey('JsonAQKey00000000000000000000000000000000002');
      const aqUrl = fakeAqKey('UrlAQKey000000000000000000000000000000000003');
      const aqLabel = fakeAqKey('LabeledAQKey00000000000000000000000000000004');
      const aizaMixed = fakeKey('MixedAizaWithAq0000000000000001');

      const aqBadShort = `AQ.${'S'.repeat(47)}`; // quá ngắn
      const aqBadLong = `AQ.${'L'.repeat(55)}`; // quá dài
      const aqNoDot = `AQ${'D'.repeat(50)}`; // thiếu dấu chấm
      const badPrefix = `AB.${'X'.repeat(50)}`; // sai tiền tố

      const batchText = [
        `${aq50}, ${aq48}; ${aq54}`,
        `Project AQ Riêng: ${aqLabel}`,
        `https://generativelanguage.googleapis.com/v1beta/models?key=${aqUrl}`,
        aizaMixed,
        aqBadShort,
        aqBadLong,
        aqNoDot,
        badPrefix,
      ].join('\n');

      const parsedAq = parseBatchKeys(batchText, new Set(), 'AQTest');
      assert.strictEqual(parsedAq.recognizedCount, 6, 'Phải nhận đủ 5 khóa AQ. (48..54) + 1 khóa AIza');
      assert.strictEqual(parsedAq.invalidCount, 4, 'Phải loại 4 token AQ/AB sai định dạng');
      const invalidReason = parsedAq.items.find((it) => it.status === 'invalid_format')?.reason ?? '';
      assert.ok(
        invalidReason.includes('AIza') && invalidReason.includes('AQ.'),
        'Thông điệp lỗi parser phải nêu cả định dạng AIza lẫn AQ.',
      );

      // JSON input chứa AQ.
      const parsedAqJson = parseBatchKeys(
        JSON.stringify([{ label: 'JSON AQ', apiKey: aqJson }]),
        new Set(),
        'Khóa',
      );
      assert.strictEqual(parsedAqJson.recognizedCount, 1);
      assert.strictEqual(parsedAqJson.validEntries[0].rawKey, aqJson);

      // ENV seed keys (GEMINI_API_KEY & GEMINI_API_KEYS) nhận khóa AQ.
      const dirEnv = fs.mkdtempSync(path.join(tmpDir, 'b1-env-'));
      process.env.GEMINI_API_KEY = aq50;
      process.env.GEMINI_API_KEYS = `${aqJson}, ${aqUrl}`;
      try {
        const envMgr = new KeyPoolManager(dirEnv);
        const envSnap = envMgr.getPublicSnapshot({
          isReadOnly: false,
          isSharedOrigin: false,
          adminPinRequired: false,
          hasAdminPinConfigured: false,
        });
        assert.strictEqual(envSnap.summary.total, 3, 'bootstrapFromEnv phải nhận đủ 3 khóa AQ. từ env');
        assert.ok(envSnap.keys.every((k) => k.maskedKey.startsWith('AQ.')));
      } finally {
        delete process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_API_KEYS;
      }

      // sanitizeSecretText che khóa AQ. không nằm trong rawKeys & chuỗi cắt cụt >=12 ký tự
      const unknownAq = fakeAqKey('UnknownLeakAQ0000000000000000000000000000009');
      const truncatedAq = `AQ.${'Z'.repeat(16)}`;
      const leakErr = new Error(`Failed auth key=${unknownAq} prefix=${truncatedAq} aiza=${aizaMixed}`);
      const scrubbed = sanitizeSecretText(leakErr, []);
      assert.ok(!scrubbed.includes(unknownAq), 'Không được lộ khóa AQ. không nằm trong rawKeys');
      assert.ok(!scrubbed.includes(truncatedAq), 'Không được lộ đoạn AQ. cắt cụt >= 12 ký tự');
      assert.ok(scrubbed.includes('AQ.••••[REDACTED]'), 'Phải che bằng AQ.••••[REDACTED]');
      assert.ok(scrubbed.includes('AIza••••[REDACTED]'), 'AIza vẫn che tách biệt bằng AIza••••[REDACTED]');

      // Round-trip persist/reload giữ nguyên AQ., và loadState log console.warn khi gặp bản ghi sai format
      const dirRt = fs.mkdtempSync(path.join(tmpDir, 'b1-rt-'));
      const mgrRt = new KeyPoolManager(dirRt);
      const pRt = mgrRt.previewBatchImport(`${aq50}\n${aizaMixed}`);
      mgrRt.confirmBatchImport(pRt.previewSessionId);
      await mgrRt.flushPersistence();

      const mgrRt2 = new KeyPoolManager(dirRt);
      assert.strictEqual(mgrRt2._getRawKeyIdsForVerification().length, 2, 'Reload từ đĩa phải giữ cả khóa AQ. lẫn AIza');

      // Tiêm bản ghi có ciphertext giải mã ra format sai -> loadState phải log warn và bỏ qua
      const storeBad = new KeyPoolCryptoStore(dirRt);
      const loadedBefore = storeBad.loadState();
      loadedBefore.state.keys.push({
        ...loadedBefore.state.keys[0],
        id: 'k_bad_fmt',
        maskedKey: 'BAD•••123',
        encryptedKey: storeBad.encryptKey('NOT_A_VALID_GEMINI_KEY_FORMAT'),
      });
      await storeBad.saveState(loadedBefore.state);

      const warnings: string[] = [];
      const origWarn = console.warn;
      console.warn = (...args: unknown[]) => {
        warnings.push(args.map(String).join(' '));
      };
      try {
        const afterBad = storeBad.loadState();
        assert.strictEqual(afterBad.state.keys.length, 2, 'Bản ghi sai format phải bị bỏ qua');
        assert.ok(
          warnings.some((w) => w.includes('Skipped invalid key format record k_bad_fmt')),
          'loadState phải console.warn khi bỏ qua key sai format',
        );
      } finally {
        console.warn = origWarn;
      }
      console.log('  -> Đạt: Parser/ENV/Round-trip nhận chuẩn AQ. (48–54 ký tự), sanitizeSecretText tách biệt AQ./AIza và loadState cảnh báo khi bỏ qua.');
    }

    // ── BÀI 21: B2 + HT-02 (ĐK-151-03..06) — testKey timeout 20s inconclusive, per-model, thinkingConfig & batch UI ─
    {
      console.log('\n[21/24] Kiểm thử B2 + HT-02: testKey timeout 20s inconclusive, test chậm 12s đạt, thử model phụ không rửa key, thinkingConfig & batch UI...');
      assert.strictEqual(TEST_KEY_TIMEOUT_MS, 20_000, 'TEST_KEY_TIMEOUT_MS phải đúng 20_000ms');
      assert.strictEqual(TEST_KEY_MAX_OUTPUT_TOKENS, 256, 'TEST_KEY_MAX_OUTPUT_TOKENS phải = 256 (>=64)');

      const dir21 = fs.mkdtempSync(path.join(tmpDir, 'b2-ht02-'));
      const mgr21 = new KeyPoolManager(dir21);
      const kReadyHang = fakeAqKey('ReadyHangKey00000000000000000000000000000001');
      const kCdHang = fakeAqKey('CooldownHangKey00000000000000000000000000002');
      const kSlow12s = fakeAqKey('Slow12sPassKey000000000000000000000000000003');
      const prev21 = mgr21.previewBatchImport(`${kReadyHang}\n${kCdHang}\n${kSlow12s}`);
      mgr21.confirmBatchImport(prev21.previewSessionId);

      const [idReadyHang, idCdHang, idSlow12s] = mgr21._getRawKeyIdsForVerification();
      const recCdHang = mgr21._findKeyRecord(idCdHang)!;
      const fixedCooldownUntil = Date.now() + 3600_000;
      recCdHang.status = 'cooldown';
      recCdHang.healthScore = 45;
      recCdHang.consecutiveErrors = 2;
      recCdHang.cooldownUntil = fixedCooldownUntil;
      recCdHang.cooldownReason = 'RATE_LIMIT_RPM';

      // Chạy song song 3 ca thực tế (treo 25s -> abort đúng 20s trên 2 key; phản hồi chậm 12s -> ok trên key 3)
      const [resReadyHang, resCdHang, resSlowPass] = await Promise.all([
        mgr21.testKey(idReadyHang, {
          customClientFactory: () => ({
            models: {
              async generateContentStream() {
                throw new Error('not used');
              },
              generateContent({ config }) {
                return new Promise((_resolve, reject) => {
                  const t = setTimeout(() => _resolve({ text: 'OK' }), 25_000);
                  config?.abortSignal?.addEventListener(
                    'abort',
                    () => {
                      clearTimeout(t);
                      reject(new DOMException('The operation was aborted', 'AbortError'));
                    },
                    { once: true },
                  );
                });
              },
            },
          }),
        }),
        mgr21.testKey(idCdHang, {
          customClientFactory: () => ({
            models: {
              async generateContentStream() {
                throw new Error('not used');
              },
              generateContent({ config }) {
                return new Promise((_resolve, reject) => {
                  const t = setTimeout(() => _resolve({ text: 'OK' }), 25_000);
                  config?.abortSignal?.addEventListener(
                    'abort',
                    () => {
                      clearTimeout(t);
                      reject(new DOMException('The operation was aborted', 'AbortError'));
                    },
                    { once: true },
                  );
                });
              },
            },
          }),
        }),
        mgr21.testKey(idSlow12s, {
          customClientFactory: () => ({
            models: {
              async generateContentStream() {
                throw new Error('not used');
              },
              generateContent() {
                return new Promise((resolve) => {
                  setTimeout(() => resolve({ text: 'OK' }), 12_000);
                });
              },
            },
          }),
        }),
      ]);

      // Kiểm chứng Test 1: timeout 20s -> inconclusive, bảo toàn trạng thái
      assert.strictEqual(resReadyHang.ok, false);
      assert.strictEqual(resReadyHang.inconclusive, true);
      assert.strictEqual(resReadyHang.errorCategory, 'TEST_TIMEOUT_INCONCLUSIVE');
      assert.ok(resReadyHang.latencyMs >= 19_500, `Phải abort gần mốc 20s (nhận ${resReadyHang.latencyMs}ms)`);
      assert.strictEqual(mgr21._findKeyRecord(idReadyHang)!.status, 'ready');
      assert.strictEqual(mgr21._findKeyRecord(idReadyHang)!.healthScore, 100);
      assert.strictEqual(mgr21._findKeyRecord(idReadyHang)!.consecutiveErrors, 0);

      assert.strictEqual(resCdHang.ok, false);
      assert.strictEqual(resCdHang.inconclusive, true);
      assert.strictEqual(resCdHang.errorCategory, 'TEST_TIMEOUT_INCONCLUSIVE');
      assert.strictEqual(mgr21._findKeyRecord(idCdHang)!.status, 'cooldown');
      assert.strictEqual(mgr21._findKeyRecord(idCdHang)!.healthScore, 45);
      assert.strictEqual(mgr21._findKeyRecord(idCdHang)!.cooldownUntil, fixedCooldownUntil);

      // Kiểm chứng Test 2: phản hồi chậm 12s -> thành công
      assert.strictEqual(resSlowPass.ok, true);
      assert.ok(resSlowPass.latencyMs >= 11_800, `Phải chờ đủ ~12s và đạt (nhận ${resSlowPass.latencyMs}ms)`);

      // Kiểm chứng Test 3: Thử model phụ (fallbackModel) KHÔNG rửa key đang cooldown
      const recCdForFallback = mgr21._findKeyRecord(idCdHang)!;
      recCdForFallback.stats.lastTestedAt = null; // bỏ qua debounce 5s để test tiếp
      const fbPass = await mgr21.testKey(idCdHang, {
        model: FALLBACK_MODEL,
        customClientFactory: () => ({
          models: {
            async generateContentStream() {
              throw new Error('not used');
            },
            async generateContent() {
              return { text: 'OK' };
            },
          },
        }),
      });
      assert.strictEqual(fbPass.ok, true);
      assert.strictEqual(fbPass.isDefaultModel, false);
      assert.strictEqual(fbPass.modelUsed, FALLBACK_MODEL);
      assert.strictEqual(recCdForFallback.status, 'cooldown', 'Thử model phụ ĐẠT tuyệt đối không rửa key về ready');
      assert.strictEqual(recCdForFallback.healthScore, 45, 'Thử model phụ ĐẠT tuyệt đối không rửa điểm lên 100');
      assert.strictEqual(recCdForFallback.cooldownUntil, fixedCooldownUntil);

      // Thử model phụ gặp 503 UNAVAILABLE -> chỉ modelCooldowns[fallbackModel], không hạ điểm key
      recCdForFallback.stats.lastTestedAt = null;
      const fb503 = await mgr21.testKey(idCdHang, {
        model: FALLBACK_MODEL,
        customClientFactory: () => ({
          models: {
            async generateContentStream() {
              throw new Error('not used');
            },
            async generateContent() {
              throw Object.assign(new Error('503 got status: UNAVAILABLE'), { status: 503 });
            },
          },
        }),
      });
      assert.strictEqual(fb503.ok, false);
      assert.strictEqual(fb503.errorCategory, 'MODEL_UNAVAILABLE');
      assert.ok((recCdForFallback.modelCooldowns?.[FALLBACK_MODEL] ?? 0) > Date.now());
      assert.strictEqual(recCdForFallback.healthScore, 45, '503 model phụ không được trừ healthScore tổng');

      // Thử model phụ gặp 401 -> vẫn disable key
      recCdForFallback.stats.lastTestedAt = null;
      const fb401 = await mgr21.testKey(idCdHang, {
        model: FALLBACK_MODEL,
        customClientFactory: () => ({
          models: {
            async generateContentStream() {
              throw new Error('not used');
            },
            async generateContent() {
              throw Object.assign(new Error('401 API_KEY_INVALID'), { status: 401 });
            },
          },
        }),
      });
      assert.strictEqual(fb401.ok, false);
      assert.strictEqual(fb401.errorCategory, 'AUTH_INVALID_KEY');
      assert.strictEqual(recCdForFallback.status, 'disabled', 'AUTH_INVALID_KEY trên model phụ vẫn phải vô hiệu khóa');

      // Kiểm chứng Test 4: testKey trên gemini-4-hydrogen truyền thinkingLevel='LOW' & maxOutputTokens >= 64
      let capturedTestConfig: Record<string, unknown> | undefined;
      const hydrogenKeyRec = mgr21._findKeyRecord(idReadyHang)!;
      hydrogenKeyRec.stats.lastTestedAt = null;
      const hPass = await mgr21.testKey(idReadyHang, {
        model: 'gemini-4-hydrogen',
        customClientFactory: () => ({
          models: {
            async generateContentStream() {
              throw new Error('not used');
            },
            async generateContent(params) {
              capturedTestConfig = params.config as Record<string, unknown>;
              return { text: 'OK' };
            },
          },
        }),
      });
      assert.strictEqual(hPass.ok, true);
      assert.deepStrictEqual(capturedTestConfig?.thinkingConfig, { thinkingLevel: 'LOW' });
      assert.ok(
        typeof capturedTestConfig?.maxOutputTokens === 'number' &&
          capturedTestConfig.maxOutputTokens >= 64,
        'maxOutputTokens của testKey phải >= 64',
      );

      // Model không hợp lệ bị từ chối rõ ràng
      await assert.rejects(
        () => mgr21.testKey(idReadyHang, { model: 'gemini-2.0-flash' }),
        /không hợp lệ/,
      );

      // Kiểm chứng Test 5: Batch UI xử lý inconclusive tách biệt khỏi stillFailing & bảo toàn snapshot
      const cdSnapKey: CooldownProbeKeyShape = {
        id: 'cd_inc_1',
        label: 'TimeoutKey',
        maskedKey: 'AQ.AAA••••••0001',
        status: 'cooldown',
        detectedProjectNumber: '444555666',
        healthScore: 60,
        cooldownUntil: 1_900_005_000_000,
        remainingCooldownSec: 500,
        cooldownReason: 'NETWORK_OR_5XX',
        stats: {
          lastErrorType: 'NETWORK_OR_5XX',
          lastErrorMessage: null,
          lastErrorAt: null,
          lastTestLatencyMs: null,
          lastTestedAt: null,
        },
      };
      const batchResInc = await runClientBatchCooldownProbe({
        keys: [cdSnapKey],
        delayBetweenRealProbesMs: 0,
        signal: new AbortController().signal,
        probeSingleKey: async () => ({
          kind: 'probed',
          ok: false,
          inconclusive: true,
          latencyMs: 20_000,
          modelUsed: DEFAULT_MODEL,
          status: 'cooldown',
          healthScore: 60,
          detectedProjectNumber: '444555666',
          errorCategory: 'TEST_TIMEOUT_INCONCLUSIVE',
          sanitizedMessage: 'Hết giờ 20s',
          cooldownUntil: 1_900_005_000_000,
        }),
      });
      assert.strictEqual(batchResInc.counts.inconclusive, 1);
      assert.strictEqual(batchResInc.counts.stillFailing, 0, 'Timeout inconclusive KHÔNG được tính vào stillFailing');
      assert.strictEqual(batchResInc.results[0].outcome, 'inconclusive');

      const snapBeforeInc = {
        keys: [cdSnapKey],
        summary: { total: 1, ready: 0, cooldown: 1, disabled: 0 },
      };
      const snapAfterInc = applyBatchItemToSnapshot(snapBeforeInc, batchResInc.results[0]);
      assert.strictEqual(snapAfterInc.keys[0].status, 'cooldown');
      assert.strictEqual(snapAfterInc.keys[0].healthScore, 60);
      assert.strictEqual(snapAfterInc.keys[0].cooldownUntil, 1_900_005_000_000);

      console.log('  -> Đạt: Timeout 20s inconclusive bảo toàn trạng thái, chậm 12s pass, model phụ không rửa key, thinkingConfig & batch inconclusive đạt.');
    }

    // ── BÀI 22: HT-01 (ĐK-151-07..10) — Tách lỗi 403 & API_NOT_ENABLED ──────
    {
      console.log('\n[22/24] Kiểm thử HT-01: Tách lỗi 403 (AUTH_FORBIDDEN_AMBIGUOUS vs AUTH_INVALID_KEY) & API_NOT_ENABLED...');

      // 1) Phân loại chính xác 403 + API key not valid vs 403 PERMISSION_DENIED vs SERVICE_DISABLED
      const clsInvalid403 = classifyGeminiError(
        Object.assign(new Error('403 PERMISSION_DENIED: API key not valid. Please pass a valid API key.'), { status: 403 }),
      );
      assert.strictEqual(clsInvalid403.category, 'AUTH_INVALID_KEY');

      const clsAmb403 = classifyGeminiError(
        Object.assign(new Error('403 PERMISSION_DENIED: Caller does not have permission for this resource.'), { status: 403 }),
      );
      assert.strictEqual(clsAmb403.category, 'AUTH_FORBIDDEN_AMBIGUOUS');

      const clsApiDisabled = classifyGeminiError(
        Object.assign(
          new Error(
            '403 SERVICE_DISABLED: Generative Language API has not been used in project 63415494298 before or it is disabled. https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview?project=63415494298',
          ),
          { status: 403 },
        ),
      );
      assert.strictEqual(clsApiDisabled.category, 'API_NOT_ENABLED');
      assert.strictEqual(clsApiDisabled.projectNumber, '63415494298');
      assert.ok(
        formatHumanReadableErrorVi(clsApiDisabled).includes('Project chưa bật Generative Language API'),
        'Thông điệp tiếng Việt của API_NOT_ENABLED phải rõ ràng',
      );
      assert.strictEqual(computeCooldownDurationMs('API_NOT_ENABLED', 1, null, 0, true), 3600_000);

      // Thang cooldown AUTH_FORBIDDEN_AMBIGUOUS: 30s -> 60s -> 120s -> 300s
      assert.strictEqual(computeCooldownDurationMs('AUTH_FORBIDDEN_AMBIGUOUS', 1, null, 0, true), 30_000);
      assert.strictEqual(computeCooldownDurationMs('AUTH_FORBIDDEN_AMBIGUOUS', 2, null, 0, true), 60_000);
      assert.strictEqual(computeCooldownDurationMs('AUTH_FORBIDDEN_AMBIGUOUS', 3, null, 0, true), 120_000);
      assert.strictEqual(computeCooldownDurationMs('AUTH_FORBIDDEN_AMBIGUOUS', 4, null, 0, true), 300_000);

      const dir22 = fs.mkdtempSync(path.join(tmpDir, 'ht01-'));
      const mgr22 = new KeyPoolManager(dir22);
      const k403Main = fakeAqKey('Ht01ForbiddenMain0000000000000000000000000001');
      const k403Peer = fakeAqKey('Ht01ForbiddenPeer0000000000000000000000000002');
      const kMixed = fakeAqKey('Ht01Mixed5xxThen4030000000000000000000000003');
      const kApiDis1 = fakeAqKey('Ht01ApiDisabledOne00000000000000000000000004');
      const kApiDis2 = fakeAqKey('Ht01ApiDisabledPeer0000000000000000000000005');
      const prev22 = mgr22.previewBatchImport(`${k403Main}\n${k403Peer}\n${kMixed}\n${kApiDis1}\n${kApiDis2}`);
      mgr22.confirmBatchImport(prev22.previewSessionId);

      const [idMain, idPeer, idMixed, idDis1, idDis2] = mgr22._getRawKeyIdsForVerification();
      mgr22._findKeyRecord(idMain)!.detectedProjectNumber = '111222333';
      mgr22._findKeyRecord(idPeer)!.detectedProjectNumber = '111222333';
      mgr22._findKeyRecord(idDis2)!.detectedProjectNumber = '63415494298';

      const alloc22 = mgr22._getAllocatorForVerification();
      const baseT = 1_750_000_000_000;

      // Lần 1 AUTH_FORBIDDEN_AMBIGUOUS -> cooldown 30s, -10 điểm (=90), KHÔNG disabled, KHÔNG lan truyền peer
      alloc22.recordFailure(idMain, { ...clsAmb403, projectNumber: '111222333' }, baseT, true);
      const recMain1 = mgr22._findKeyRecord(idMain)!;
      assert.strictEqual(recMain1.status, 'cooldown');
      assert.strictEqual(recMain1.healthScore, 90);
      assert.strictEqual(recMain1.cooldownUntil, baseT + 30_000);
      assert.strictEqual(recMain1.consecutiveForbiddenErrors, 1);
      assert.strictEqual(mgr22._findKeyRecord(idPeer)!.status, 'ready', 'AUTH_FORBIDDEN_AMBIGUOUS KHÔNG được lan truyền cùng project');

      // Lần 2..4 trước khi reset -> kiểm tra cooldown leo thang
      alloc22.recordFailure(idMain, clsAmb403, baseT + 40_000, true);
      assert.strictEqual(recMain1.cooldownUntil, baseT + 40_000 + 60_000);
      alloc22.recordFailure(idMain, clsAmb403, baseT + 110_000, true);
      assert.strictEqual(recMain1.cooldownUntil, baseT + 110_000 + 120_000);
      alloc22.recordFailure(idMain, clsAmb403, baseT + 250_000, true);
      assert.strictEqual(recMain1.cooldownUntil, baseT + 250_000 + 300_000);
      assert.strictEqual(recMain1.status, 'cooldown', 'Mới 4 lần 403 chưa được disable');

      // recordSuccess ở giữa -> reset consecutiveForbiddenErrors = 0
      alloc22.recordSuccess(idMain, 120, baseT + 600_000);
      assert.strictEqual(recMain1.consecutiveForbiddenErrors, 0);

      // Phải cần đủ 5 lần 403 liên tiếp mới chuyển disabled + AUTH_FORBIDDEN_REPEATED
      for (let i = 1; i <= 4; i++) {
        alloc22.recordFailure(idMain, clsAmb403, baseT + 700_000 + i * 1000, true);
        assert.strictEqual(recMain1.status, 'cooldown', `Lần 403 thứ ${i}/5 sau reset vẫn ở cooldown`);
      }
      alloc22.recordFailure(idMain, clsAmb403, baseT + 705_000, true);
      assert.strictEqual(recMain1.status, 'disabled', 'Đủ 5 lần 403 liên tiếp phải chuyển disabled');
      assert.strictEqual(recMain1.cooldownReason, 'AUTH_FORBIDDEN_REPEATED');
      assert.strictEqual(recMain1.healthScore, 0);

      // 4 lần NETWORK_OR_5XX + 1 lần AUTH_FORBIDDEN_AMBIGUOUS -> KHÔNG disabled
      const cls5xx = classifyGeminiError(Object.assign(new Error('502 Bad Gateway'), { status: 502 }));
      for (let i = 0; i < 4; i++) {
        alloc22.recordFailure(idMixed, cls5xx, baseT + i * 1000, true);
      }
      alloc22.recordFailure(idMixed, clsAmb403, baseT + 5000, true);
      assert.strictEqual(mgr22._findKeyRecord(idMixed)!.status, 'cooldown', '4x5xx + 1x403 không được disabled');
      assert.strictEqual(mgr22._findKeyRecord(idMixed)!.consecutiveForbiddenErrors, 1);

      // API_NOT_ENABLED -> cooldown 1h & lan truyền sang peer cùng project
      alloc22.recordFailure(idDis1, clsApiDisabled, baseT + 10_000, true);
      assert.strictEqual(mgr22._findKeyRecord(idDis1)!.status, 'cooldown');
      assert.strictEqual(mgr22._findKeyRecord(idDis1)!.cooldownReason, 'API_NOT_ENABLED');
      assert.strictEqual(mgr22._findKeyRecord(idDis1)!.cooldownUntil, baseT + 10_000 + 3600_000);
      assert.strictEqual(mgr22._findKeyRecord(idDis2)!.status, 'cooldown', 'API_NOT_ENABLED phải lan truyền sang key cùng project');
      assert.strictEqual(mgr22._findKeyRecord(idDis2)!.cooldownReason, 'API_NOT_ENABLED');
      assert.strictEqual(mgr22._findKeyRecord(idDis2)!.cooldownUntil, baseT + 10_000 + 3600_000);

      console.log('  -> Đạt: 403 phân tách chuẩn xác (chết thật vs mơ hồ 5 lần/reset + không lan truyền) & API_NOT_ENABLED cooldown 1h + lan truyền project.');
    }

    // ── BÀI 23: HT-04 (ĐK-151-11..13) — Cổng chặn TPM 15K cho họ Gemma ───────
    {
      console.log('\n[23/24] Kiểm thử HT-04: Cổng TPM 15K Gemma, hiệu chuẩn 2.4 & thoát tức thì khi cả 2 model đều vượt...');
      assert.strictEqual(GEMMA_TPM_GUARD_THRESHOLD, 15_000);
      assert.strictEqual(GEMMA_TPM_CHARS_PER_TOKEN_VI, 2.4);
      assert.strictEqual(isGemmaModel('gemma-4-31b-it'), true);
      assert.strictEqual(isGemmaModel('models/gemma-4-26b-a4b-it'), true);
      assert.strictEqual(isGemmaModel('gemini-4-hydrogen'), false);

      // Kiểm chứng công thức hiệu chuẩn 2.4 đối với 6 điểm đo Pha 0 (section 4023..4832, T2 7992, chat 7048..8724)
      // Dựa trên bảng quy chiếu thực tế Pha 0 (tỉ lệ thực 2.44–2.62 ký tự/token) -> công thức /2.4 lệch +1,6% đến +9,2% (<= +15%)
      const pha0Benchmarks = [
        { chars: 10_540, actualTokens: 4023 },
        { chars: 12_273, actualTokens: 4832 },
        { chars: 19_980, actualTokens: 7992 },
        { chars: 17_480, actualTokens: 7048 },
        { chars: 21_461, actualTokens: 8724 },
      ];
      for (const b of pha0Benchmarks) {
        const est = estimateRequestInputTokens('x'.repeat(b.chars));
        const relErr = (est - b.actualTokens) / b.actualTokens;
        assert.ok(
          relErr >= 0 && relErr <= 0.15,
          `Hiệu chuẩn 2.4 phải nghiêng an toàn trong [0%, +15%] (nhận ${(relErr * 100).toFixed(2)}% cho ${b.chars} ký tự)`,
        );
      }

      const dir23 = fs.mkdtempSync(path.join(tmpDir, 'ht04-tpm-'));
      const mgr23 = new KeyPoolManager(dir23);
      const tpmKeys = Array.from({ length: 5 }, (_, idx) =>
        fakeAqKey(`Ht04TpmKey${String(idx + 1).padStart(40, '0')}`),
      );
      const prev23 = mgr23.previewBatchImport(tpmKeys.join('\n'));
      mgr23.confirmBatchImport(prev23.previewSessionId);

      // Ca 1: defaultModel=gemma-4-31b-it, fallback=gemini-3.5-flash-lite; prompt ~12.100 est tokens (+3.000 = 15.100 > 15.000) -> bỏ qua Gemma, gọi flash-lite!
      mgr23.updateModelConfig({
        defaultModel: 'gemma-4-31b-it',
        fallbackModel: DEFAULT_MODEL,
      });
      const ca1Models: string[] = [];
      let ca1Out = '';
      const prompt12100 = 'a'.repeat(12_100 * 2.4); // est = 12_100 -> +3_000 = 15_100 > 15_000
      const ca1Meta = await mgr23.executeStream({
        prompt: prompt12100,
        onChunk: (t) => {
          ca1Out += t;
        },
        clientFactory: () => ({
          models: {
            async generateContentStream(params) {
              ca1Models.push(params.model);
              async function* gen() {
                yield { text: 'Chuyển sang flash-lite an toàn.' };
              }
              return gen();
            },
            async generateContent() {
              return { text: 'OK' };
            },
          },
        }),
      });
      assert.deepStrictEqual(ca1Models, [DEFAULT_MODEL], 'Gemma vượt 15K phải bị bỏ qua, đi thẳng fallback');
      assert.strictEqual(ca1Meta.modelUsed, DEFAULT_MODEL);
      assert.strictEqual(ca1Out, 'Chuyển sang flash-lite an toàn.');

      // Ca 2: Input est = 8.000 (+3.000 = 11.000 <= 15.000) -> gọi Gemma bình thường
      const ca2Models: string[] = [];
      const prompt8000 = 'b'.repeat(8_000 * 2.4);
      const ca2Meta = await mgr23.executeStream({
        prompt: prompt8000,
        onChunk: () => {},
        clientFactory: () => ({
          models: {
            async generateContentStream(params) {
              ca2Models.push(params.model);
              async function* gen() {
                yield { text: 'Gemma chạy tốt dưới ngưỡng 15K.' };
              }
              return gen();
            },
            async generateContent() {
              return { text: 'OK' };
            },
          },
        }),
      });
      assert.deepStrictEqual(ca2Models, ['gemma-4-31b-it']);
      assert.strictEqual(ca2Meta.modelUsed, 'gemma-4-31b-it');

      // Ca 3: flash-lite input = 20.000 token -> KHÔNG chặn
      mgr23.updateModelConfig({
        defaultModel: DEFAULT_MODEL,
        fallbackModel: FALLBACK_MODEL,
      });
      const ca3Models: string[] = [];
      const prompt20000 = 'c'.repeat(20_000 * 2.4);
      await mgr23.executeStream({
        prompt: prompt20000,
        onChunk: () => {},
        clientFactory: () => ({
          models: {
            async generateContentStream(params) {
              ca3Models.push(params.model);
              async function* gen() {
                yield { text: 'Flash-lite không bị giới hạn bởi cổng TPM Gemma.' };
              }
              return gen();
            },
            async generateContent() {
              return { text: 'OK' };
            },
          },
        }),
      });
      assert.deepStrictEqual(ca3Models, [DEFAULT_MODEL]);

      // Ca 4: Cả defaultModel và fallbackModel đều thuộc họ Gemma và đều vượt 15K trên pool 5 key -> 0 API call, không quét 5 key, lỗi không phải PoolExhaustedError
      mgr23.updateModelConfig({
        defaultModel: 'gemma-4-31b-it',
        fallbackModel: 'gemma-4-26b-a4b-it',
      });
      let ca4Calls = 0;
      let ca4Err: unknown = null;
      try {
        await mgr23.executeStream({
          prompt: prompt12100,
          onChunk: () => {},
          clientFactory: () => ({
            models: {
              async generateContentStream() {
                ca4Calls += 1;
                throw new Error('Must not call SDK');
              },
              async generateContent() {
                return { text: 'OK' };
              },
            },
          }),
        });
      } catch (e) {
        ca4Err = e;
      }
      assert.strictEqual(ca4Calls, 0, 'Không được gọi SDK khi cả 2 model Gemma vượt 15K');
      assert.ok(ca4Err instanceof Error);
      assert.ok(!(ca4Err instanceof PoolExhaustedError), 'Không được ngụy trang TPM_GUARD_SKIP thành PoolExhaustedError');
      assert.ok((ca4Err as Error).message.includes('TPM_GUARD_SKIP'));
      // Tất cả 5 key phải giữ nguyên 100 điểm và ready
      const snap23 = mgr23.getPublicSnapshot({
        isReadOnly: false,
        isSharedOrigin: false,
        adminPinRequired: false,
        hasAdminPinConfigured: false,
      });
      assert.strictEqual(snap23.summary.ready, 5);
      assert.ok(snap23.keys.every((k) => k.healthScore === 100));

      console.log('  -> Đạt: Cổng TPM 15K Gemma chặn đúng ngưỡng, giữ nguyên 5 key 100đ, thoát ngay với 0 API calls và flash-lite không bị ảnh hưởng.');
    }

    // ── BÀI 24: HT-05 (ĐK-151-14..16) — Đường ống maxOutputTokens, thinkingConfig, profiles & MAX_TOKENS ─
    {
      console.log('\n[24/24] Kiểm thử HT-05: Profile model, truyền tham số SDK, legacy migration, MAX_TOKENS & giữ nguyên default/fallback 1.5.0...');
      // Xác nhận DEFAULT_MODEL / FALLBACK_MODEL theo cấu hình chốt 1.5.3
      assert.strictEqual(DEFAULT_MODEL, 'gemini-3.5-flash-lite');
      assert.strictEqual(FALLBACK_MODEL, 'gemma-4-31b-it');

      const dir24 = fs.mkdtempSync(path.join(tmpDir, 'ht05-pipe-'));
      const mgr24 = new KeyPoolManager(dir24);
      const k24 = fakeAqKey('Ht05PipelineKey00000000000000000000000000001');
      const prev24 = mgr24.previewBatchImport(k24);
      mgr24.confirmBatchImport(prev24.previewSessionId);

      // 1) Kiểm tra gemini-4-hydrogen nhận thinkingLevel: 'LOW' & maxOutputTokens: 32_768
      mgr24.updateModelConfig({
        defaultModel: 'gemini-4-hydrogen',
        fallbackModel: DEFAULT_MODEL,
      });
      let hydroConfig: Record<string, unknown> | undefined;
      await mgr24.executeStream({
        prompt: 'Test hydrogen profile',
        onChunk: () => {},
        clientFactory: () => ({
          models: {
            async generateContentStream(params) {
              hydroConfig = params.config as Record<string, unknown>;
              async function* gen() {
                yield { text: 'Hydrogen OK' };
              }
              return gen();
            },
            async generateContent() {
              return { text: 'OK' };
            },
          },
        }),
      });
      assert.deepStrictEqual(hydroConfig?.thinkingConfig, { thinkingLevel: 'LOW' });
      assert.strictEqual(hydroConfig?.maxOutputTokens, 32_768);

      // 2) Kiểm tra gemma-4-31b-it nhận thinkingLevel: 'MINIMAL' & maxOutputTokens: 32_768
      mgr24.updateModelConfig({
        defaultModel: 'gemma-4-31b-it',
        fallbackModel: DEFAULT_MODEL,
      });
      let gemmaConfig: Record<string, unknown> | undefined;
      await mgr24.executeStream({
        prompt: 'Test gemma profile',
        onChunk: () => {},
        clientFactory: () => ({
          models: {
            async generateContentStream(params) {
              gemmaConfig = params.config as Record<string, unknown>;
              async function* gen() {
                yield { text: 'Gemma OK' };
              }
              return gen();
            },
            async generateContent() {
              return { text: 'OK' };
            },
          },
        }),
      });
      assert.deepStrictEqual(gemmaConfig?.thinkingConfig, { thinkingLevel: 'MINIMAL' });
      assert.strictEqual(gemmaConfig?.maxOutputTokens, 32_768);

      // 3) Kiểm tra gemini-3.5-flash-lite (không có profile) KHÔNG truyền maxOutputTokens và KHÔNG truyền thinkingConfig
      mgr24.updateModelConfig({
        defaultModel: DEFAULT_MODEL,
        fallbackModel: FALLBACK_MODEL,
      });
      let flashLiteConfig: Record<string, unknown> | undefined;
      const maxTokensMeta = await mgr24.executeStream({
        prompt: 'Test flash-lite legacy behavior + MAX_TOKENS detection',
        onChunk: () => {},
        clientFactory: () => ({
          models: {
            async generateContentStream(params) {
              flashLiteConfig = params.config as Record<string, unknown>;
              async function* gen() {
                yield { text: 'Nội dung bị cắt giữa chừng ' };
                // Chunk cuối chỉ mang candidates[0].finishReason === 'MAX_TOKENS' và text rỗng
                yield { text: '', candidates: [{ finishReason: 'MAX_TOKENS' }] };
              }
              return gen();
            },
            async generateContent() {
              return { text: 'OK' };
            },
          },
        }),
      });
      assert.strictEqual('maxOutputTokens' in (flashLiteConfig ?? {}), false, 'flash-lite KHÔNG được gửi maxOutputTokens');
      assert.strictEqual('thinkingConfig' in (flashLiteConfig ?? {}), false, 'flash-lite KHÔNG được gửi thinkingConfig');
      assert.strictEqual(maxTokensMeta.finishReason, 'MAX_TOKENS', 'Phải đọc finishReason cả khi chunk cuối text rỗng');
      assert.strictEqual(maxTokensMeta.truncatedByMaxTokens, true);

      // 4) Lưu & restart giữ profiles + migrate file legacy 1.5.0 thiếu profiles và thiếu gemma-4-*
      await mgr24.flushPersistence();
      const mgr24Restarted = new KeyPoolManager(dir24);
      const snap24 = mgr24Restarted.getPublicSnapshot({
        isReadOnly: false,
        isSharedOrigin: false,
        adminPinRequired: false,
        hasAdminPinConfigured: false,
      });
      assert.deepStrictEqual(snap24.modelConfig.profiles?.['gemini-4-hydrogen'], DEFAULT_MODEL_PROFILES['gemini-4-hydrogen']);
      assert.deepStrictEqual(snap24.modelConfig.profiles?.['gemma-4-31b-it'], DEFAULT_MODEL_PROFILES['gemma-4-31b-it']);

      const dirLegacy = fs.mkdtempSync(path.join(tmpDir, 'ht05-legacy-'));
      const storeLegacy = new KeyPoolCryptoStore(dirLegacy);
      const legacyState: KeyPoolState = {
        version: 1,
        modelConfig: {
          defaultModel: 'gemini-3.5-flash-lite',
          fallbackModel: 'gemini-3.8-flash',
          supportedModels: ['gemini-3.5-flash-lite', 'gemini-3.8-flash'],
        },
        keys: [storeLegacy.createKeyRecord({ rawKey: k24, label: 'Legacy', source: 'user_import' })],
        recentLogs: [],
        roundRobinCursor: 0,
        disabledEnvFingerprints: [],
      };
      await storeLegacy.saveState(legacyState);
      const mgrLegacy = new KeyPoolManager(dirLegacy);
      const legacySnap = mgrLegacy.getPublicSnapshot({
        isReadOnly: false,
        isSharedOrigin: false,
        adminPinRequired: false,
        hasAdminPinConfigured: false,
      });
      assert.ok(legacySnap.modelConfig.supportedModels.includes('gemma-4-31b-it'));
      assert.ok(legacySnap.modelConfig.supportedModels.includes('gemma-4-26b-a4b-it'));
      assert.strictEqual(legacySnap.modelConfig.profiles?.['gemini-4-hydrogen']?.thinkingLevel, 'LOW');
      assert.strictEqual(legacySnap.modelConfig.defaultModel, 'gemini-3.5-flash-lite');
      assert.strictEqual(legacySnap.modelConfig.fallbackModel, 'gemini-3.8-flash');

      console.log('  -> Đạt: Đường ống profiles/thinkingConfig/maxOutputTokens, đọc MAX_TOKENS trên chunk rỗng text & legacy migration 1.5.0 hoạt động chuẩn.');
    }

    // ── BÀI 25: B1 (H1, ĐK-152-03, ĐK-152-04, ĐK-152-08, ĐK-152-09) — Timeout chunk đầu theo profile, field merge & Gemma testKey 60s ─
    {
      console.log('\n[25/31] Kiểm thử B1: firstChunkTimeoutMs theo profile (timer thật), merge cấp trường, validate [5s..120s] & Gemma testKey 60s...');
      assert.strictEqual(FIRST_CHUNK_TIMEOUT_MS, 12_000);
      assert.strictEqual(DEFAULT_MODEL_PROFILES['gemma-4-31b-it']?.firstChunkTimeoutMs, 60_000);
      assert.strictEqual(DEFAULT_MODEL_PROFILES['gemma-4-26b-a4b-it']?.firstChunkTimeoutMs, 60_000);
      assert.strictEqual(DEFAULT_MODEL_PROFILES['gemini-4-hydrogen']?.firstChunkTimeoutMs, 30_000);
      assert.strictEqual(LEASE_MAX_TTL_MS, 65_000);
      assert.strictEqual(LEASE_ABSOLUTE_MAX_TTL_MS, 210_000);

      // ĐK-152-03: Merge cấp trường khi store trên đĩa chỉ có profile cũ (thiếu firstChunkTimeoutMs / thinkingLevel)
      const dirMerge = fs.mkdtempSync(path.join(tmpDir, 'b1-merge-'));
      const storeMerge = new KeyPoolCryptoStore(dirMerge);
      const kMerge = fakeAqKey('B1FieldMergeKey00000000000000000000000000001');
      await storeMerge.saveState({
        version: 2,
        modelConfig: {
          defaultModel: 'gemini-3.5-flash-lite',
          fallbackModel: 'gemma-4-31b-it',
          supportedModels: ['gemini-3.5-flash-lite', 'gemma-4-31b-it'],
          profiles: {
            'gemma-4-31b-it': {
              maxOutputTokens: 16_384, // override cũ thiếu thinkingLevel, estimatedOutputTokensForTpmGuard & firstChunkTimeoutMs
            },
          },
        },
        keys: [storeMerge.createKeyRecord({ rawKey: kMerge, label: 'M1', source: 'user_import' })],
        recentLogs: [],
        roundRobinCursor: 0,
        disabledEnvFingerprints: [],
      });
      const mgrMerge = new KeyPoolManager(dirMerge);
      const snapMerge = mgrMerge.getPublicSnapshot({
        isReadOnly: false,
        isSharedOrigin: false,
        adminPinRequired: false,
        hasAdminPinConfigured: false,
      });
      const mergedGemma = snapMerge.modelConfig.profiles?.['gemma-4-31b-it'];
      assert.strictEqual(mergedGemma?.maxOutputTokens, 16_384, 'Phải giữ override của người dùng');
      assert.strictEqual(mergedGemma?.thinkingLevel, 'MINIMAL', 'Field-level merge phải giữ thinkingLevel mặc định');
      assert.strictEqual(mergedGemma?.estimatedOutputTokensForTpmGuard, 3_000, 'Field-level merge phải giữ estimatedOutputTokensForTpmGuard mặc định');
      assert.strictEqual(mergedGemma?.firstChunkTimeoutMs, 60_000, 'Field-level merge phải bổ sung firstChunkTimeoutMs=60_000');

      // ĐK-152-09: Validate [5_000, 120_000], ngoài khoảng log cảnh báo và dùng mặc định theo model
      const profileWarnings: string[] = [];
      const origWarn25 = console.warn;
      console.warn = (...args: unknown[]) => {
        profileWarnings.push(args.map(String).join(' '));
      };
      try {
        const outOfRange = mgrMerge.updateModelConfig({
          defaultModel: 'gemini-3.5-flash-lite',
          fallbackModel: 'gemma-4-31b-it',
          profiles: {
            'gemma-4-31b-it': { maxOutputTokens: 32_768, firstChunkTimeoutMs: 200_000 },
            'gemini-4-hydrogen': { maxOutputTokens: 32_768, firstChunkTimeoutMs: 1_000 },
            'gemma-4-26b-a4b-it': { maxOutputTokens: 32_768, firstChunkTimeoutMs: 45_000 },
          },
        });
        assert.strictEqual(outOfRange.profiles?.['gemma-4-31b-it']?.firstChunkTimeoutMs, 60_000);
        assert.strictEqual(outOfRange.profiles?.['gemini-4-hydrogen']?.firstChunkTimeoutMs, 30_000);
        assert.strictEqual(outOfRange.profiles?.['gemma-4-26b-a4b-it']?.firstChunkTimeoutMs, 45_000);
        assert.ok(profileWarnings.length >= 2, 'Phải log cảnh báo khi firstChunkTimeoutMs ngoài [5_000, 120_000]');
      } finally {
        console.warn = origWarn25;
      }

      // Timer thật song song (~25s):
      // (a) Gemma chunk 1 phát sau 20s -> thành công (KHÔNG bị abort ở 12s) + onSseKeepAliveRequired >15s
      // (b) Default flash-lite treo 15s -> abort đúng ở ~12s (FIRST_CHUNK_TIMEOUT) -> sang fallback
      // (c) testKey trên gemma-4-31b-it mất 25s -> PASS (nhờ ngưỡng 60s), không bị timeout ở 20s!
      const dirB1a = fs.mkdtempSync(path.join(tmpDir, 'b1-gemma-'));
      const dirB1b = fs.mkdtempSync(path.join(tmpDir, 'b1-def-'));
      const dirB1c = fs.mkdtempSync(path.join(tmpDir, 'b1-testkey-'));
      const mgrB1a = new KeyPoolManager(dirB1a);
      const mgrB1b = new KeyPoolManager(dirB1b);
      const mgrB1c = new KeyPoolManager(dirB1c);
      mgrB1a.confirmBatchImport(mgrB1a.previewBatchImport(fakeAqKey('B1GemmaReal0000000000000000000000000000001')).previewSessionId);
      mgrB1b.confirmBatchImport(mgrB1b.previewBatchImport(fakeAqKey('B1DefaultReal00000000000000000000000000002')).previewSessionId);
      mgrB1c.confirmBatchImport(mgrB1c.previewBatchImport(fakeAqKey('B1TestKeyGemma0000000000000000000000000003')).previewSessionId);

      mgrB1a.updateModelConfig({ defaultModel: 'gemma-4-31b-it', fallbackModel: 'gemini-3.5-flash-lite' });
      mgrB1b.updateModelConfig({ defaultModel: 'gemini-3.5-flash-lite', fallbackModel: 'gemma-4-31b-it' });

      let gemmaKeepAliveCalls = 0;
      let gemmaOut = '';
      const defModelsCalled: string[] = [];
      let defOut = '';
      let defFirstAttemptMs = 0;
      const [idB1c] = mgrB1c._getRawKeyIdsForVerification();

      const [resB1a, resB1b, resB1c] = await Promise.all([
        mgrB1a.executeStream({
          prompt: 'Gemma slow first chunk 20s',
          onChunk: (t) => {
            gemmaOut += t;
          },
          onSseKeepAliveRequired: () => {
            gemmaKeepAliveCalls += 1;
          },
          clientFactory: () => ({
            models: {
              async generateContentStream(params) {
                async function* gen() {
                  await new Promise<void>((resolve, reject) => {
                    const t = setTimeout(resolve, 20_000);
                    params.config?.abortSignal?.addEventListener(
                      'abort',
                      () => {
                        clearTimeout(t);
                        reject(new DOMException('The operation was aborted', 'AbortError'));
                      },
                      { once: true },
                    );
                  });
                  yield { text: 'Gemma phản hồi sau 20 giây!' };
                }
                return gen();
              },
              async generateContent() {
                return { text: 'OK' };
              },
            },
          }),
        }),
        mgrB1b.executeStream({
          prompt: 'Default flash-lite stalls past 12s -> fallback',
          onChunk: (t) => {
            defOut += t;
          },
          clientFactory: () => ({
            models: {
              async generateContentStream(params) {
                defModelsCalled.push(params.model);
                const tStart = Date.now();
                if (params.model === 'gemini-3.5-flash-lite') {
                  await new Promise<void>((_resolve, reject) => {
                    const t = setTimeout(() => reject(new Error('should have aborted at 12s')), 15_000);
                    params.config?.abortSignal?.addEventListener(
                      'abort',
                      () => {
                        defFirstAttemptMs = Date.now() - tStart;
                        clearTimeout(t);
                        reject(new DOMException('The operation was aborted', 'AbortError'));
                      },
                      { once: true },
                    );
                  });
                }
                async function* gen() {
                  yield { text: 'Fallback OK sau abort 12s.' };
                }
                return gen();
              },
              async generateContent() {
                return { text: 'OK' };
              },
            },
          }),
        }),
        mgrB1c.testKey(idB1c, {
          model: 'gemma-4-31b-it',
          customClientFactory: () => ({
            models: {
              async generateContentStream() {
                throw new Error('not used');
              },
              generateContent({ config }) {
                return new Promise((resolve, reject) => {
                  const t = setTimeout(() => resolve({ text: 'OK' }), 25_000);
                  config?.abortSignal?.addEventListener(
                    'abort',
                    () => {
                      clearTimeout(t);
                      reject(new DOMException('The operation was aborted', 'AbortError'));
                    },
                    { once: true },
                  );
                });
              },
            },
          }),
        }),
      ]);

      assert.strictEqual(resB1a.modelUsed, 'gemma-4-31b-it');
      assert.strictEqual(gemmaOut, 'Gemma phản hồi sau 20 giây!');
      assert.ok(resB1a.latencyMs >= 19_500, `Gemma phải nhận chunk ở ~20s (nhận ${resB1a.latencyMs}ms)`);
      assert.ok(gemmaKeepAliveCalls >= 1, 'Chờ > 15s chưa có chunk đầu phải gọi onSseKeepAliveRequired');

      assert.deepStrictEqual(defModelsCalled, ['gemini-3.5-flash-lite', 'gemma-4-31b-it']);
      assert.strictEqual(defOut, 'Fallback OK sau abort 12s.');
      assert.ok(defFirstAttemptMs >= 11_500 && defFirstAttemptMs <= 13_500, `Default model phải bị abort ở ~12s (nhận ${defFirstAttemptMs}ms)`);

      assert.strictEqual(resB1c.ok, true, 'testKey trên Gemma 25s phải PASS (không timeout ở 20s)');
      assert.ok(resB1c.latencyMs >= 24_500);
      console.log('  -> Đạt: H1 timer thật (Gemma 20s OK, Default abort ~12s), field-level merge, validate [5s..120s] & Gemma testKey 25s OK.');
    }

    // ── BÀI 26: B2, B2a & B2b (H2, ĐK-152-01) — Ngân sách 150s riêng chân dự phòng, Fast-Sweep thuần & Không đơn điệu ─
    {
      console.log('\n[26/31] Kiểm thử B2 / B2a / B2b: Ngân sách 150s chân dự phòng, hồi quy fast-sweep thuần & non-monotonic...');

      // B2: Chân chính đốt hết 36s (>= 35s) -> mở chân dự phòng với cửa sổ 150s riêng (3 lượt x 30s + 20s = 110s < 150s) -> PASS
      {
        const dirB2 = fs.mkdtempSync(path.join(tmpDir, 'b2-budget-'));
        const mgrB2 = new KeyPoolManager(dirB2);
        const b2Keys = Array.from({ length: 7 }, (_, i) =>
          fakeAqKey(`B2DualLegKey${String(i + 1).padStart(38, '0')}`),
        );
        mgrB2.confirmBatchImport(mgrB2.previewBatchImport(b2Keys.join('\n')).previewSessionId);
        mgrB2.updateModelConfig({ defaultModel: 'gemini-3.5-flash-lite', fallbackModel: 'gemma-4-31b-it' });

        let simNow = 1_850_000_000_000;
        const callTrace: string[] = [];
        let outB2 = '';
        const metaB2 = await mgrB2.executeStream({
          prompt: 'Test 150s separate fallback budget',
          nowFn: () => simNow,
          disableJitter: true,
          onChunk: (t) => {
            outB2 += t;
          },
          clientFactory: () => ({
            models: {
              async generateContentStream(params) {
                callTrace.push(params.model);
                if (params.model === 'gemini-3.5-flash-lite') {
                  simNow += 12_000; // 3 lượt x 12s = 36s (>= 35s), lỗi NETWORK_OR_5XX đẩy key cooldown để buộc qua chân chính 3 lần
                  throw Object.assign(new Error('502 Bad Gateway'), { status: 502 });
                }
                const fbCalls = callTrace.filter((m) => m === 'gemma-4-31b-it').length;
                if (fbCalls <= 3) {
                  simNow += 30_000; // 3 lượt dự phòng fail x 30s = 90s (< 150s)
                  throw Object.assign(new Error('503 got status: UNAVAILABLE'), { status: 503 });
                }
                simNow += 20_000; // Lượt 4 dự phòng thành công ở giây thứ 110 của chân dự phòng (< 150s), tổng 146s (< 200s)
                async function* gen() {
                  yield { text: 'Gemma thành công trong cửa sổ 150s!' };
                }
                return gen();
              },
              async generateContent() {
                return { text: 'OK' };
              },
            },
          }),
        });

        assert.strictEqual(FALLBACK_LEG_TIME_BUDGET_MS, 150_000);
        assert.strictEqual(outB2, 'Gemma thành công trong cửa sổ 150s!');
        assert.strictEqual(metaB2.modelUsed, 'gemma-4-31b-it');
        assert.strictEqual(metaB2.usedFallbackModel, true);
        assert.strictEqual(metaB2.fallbackLegUsed, true);
        assert.strictEqual(metaB2.fallbackLegLatencyMs, 110_000);
        assert.strictEqual(callTrace.filter((m) => m === 'gemini-3.5-flash-lite').length, 3);
        assert.strictEqual(callTrace.filter((m) => m === 'gemma-4-31b-it').length, 4);
      }

      // B2a: 10 khóa chết phản hồi chậm (QUOTA_PROJECT_ZERO, mỗi lượt 12s) -> dừng ở 3 lượt, KHÔNG mở chân dự phòng
      {
        const dirB2a = fs.mkdtempSync(path.join(tmpDir, 'b2a-fastsweep-'));
        const mgrB2a = new KeyPoolManager(dirB2a);
        const dead10 = Array.from({ length: 10 }, (_, i) =>
          fakeAqKey(`B2aPureSweep${String(i + 1).padStart(38, '0')}`),
        );
        mgrB2a.confirmBatchImport(mgrB2a.previewBatchImport(dead10.join('\n')).previewSessionId);
        mgrB2a.updateModelConfig({ defaultModel: 'gemini-3.5-flash-lite', fallbackModel: 'gemma-4-31b-it' });

        let simNow = 1_860_000_000_000;
        const calledModelsB2a: string[] = [];
        let errB2a: unknown = null;
        try {
          await mgrB2a.executeStream({
            prompt: 'Pure fast-sweep regression',
            nowFn: () => simNow,
            disableJitter: true,
            onChunk: () => {},
            clientFactory: (rawKey) => ({
              models: {
                async generateContentStream(params) {
                  calledModelsB2a.push(params.model);
                  simNow += 12_000;
                  const idx = dead10.indexOf(rawKey);
                  throw Object.assign(
                    new Error(`429 RESOURCE_EXHAUSTED projects/55500010${idx} quota_limit_value: "0"`),
                    { status: 429 },
                  );
                },
                async generateContent() {
                  return { text: 'OK' };
                },
              },
            }),
          });
        } catch (e) {
          errB2a = e;
        }
        assert.strictEqual(calledModelsB2a.length, 3, 'B2a: Phải dừng đúng ở 3 lượt');
        assert.ok(calledModelsB2a.every((m) => m === 'gemini-3.5-flash-lite'), 'B2a: Tuyệt đối không mở chân dự phòng sau fast-sweep thuần');
        assert.ok(errB2a instanceof PoolExhaustedError);
        assert.strictEqual((errB2a as PoolExhaustedError).code, 'AI_POOL_EXHAUSTED');
      }

      // B2b: Không áp quy tắc đơn điệu: Key1::default (503) -> Key1::fallback (503) -> Key2::default (thành công!)
      {
        const dirB2b = fs.mkdtempSync(path.join(tmpDir, 'b2b-nonmono-'));
        const mgrB2b = new KeyPoolManager(dirB2b);
        const k1 = fakeAqKey('B2bKeyOne000000000000000000000000000000001');
        const k2 = fakeAqKey('B2bKeyTwo000000000000000000000000000000002');
        mgrB2b.confirmBatchImport(mgrB2b.previewBatchImport(`${k1}\n${k2}`).previewSessionId);
        mgrB2b.updateModelConfig({ defaultModel: 'gemini-3.5-flash-lite', fallbackModel: 'gemma-4-31b-it' });

        let simNow = 1_870_000_000_000;
        const traceB2b: Array<{ key: string; model: string }> = [];
        const metaB2b = await mgrB2b.executeStream({
          prompt: 'Non-monotonic fallback->default check',
          nowFn: () => simNow,
          disableJitter: true,
          onChunk: () => {},
          clientFactory: (rawKey) => ({
            models: {
              async generateContentStream(params) {
                traceB2b.push({ key: rawKey, model: params.model });
                simNow += 2_000;
                if (rawKey === k1) {
                  throw Object.assign(new Error('503 got status: UNAVAILABLE'), { status: 503 });
                }
                async function* gen() {
                  yield { text: 'Key 2 quay lại model chính thành công!' };
                }
                return gen();
              },
              async generateContent() {
                return { text: 'OK' };
              },
            },
          }),
        });

        assert.deepStrictEqual(traceB2b, [
          { key: k1, model: 'gemini-3.5-flash-lite' },
          { key: k1, model: 'gemma-4-31b-it' },
          { key: k2, model: 'gemini-3.5-flash-lite' },
        ]);
        assert.strictEqual(metaB2b.modelUsed, 'gemini-3.5-flash-lite');
        assert.strictEqual(metaB2b.usedFallbackModel, false);
        assert.strictEqual(metaB2b.fallbackLegUsed, true, 'Đã từng mở chân dự phòng ở Key1 nên fallbackLegUsed phải là true');
        assert.strictEqual(typeof metaB2b.fallbackLegLatencyMs, 'number');
      }

      console.log('  -> Đạt: Ngân sách 150s chân dự phòng (B2), fast-sweep thuần 3 lượt (B2a) & chuyển không đơn điệu (B2b).');
    }

    // ── BÀI 27: B3 (H3, ĐK-152-02, ĐK-152-04) — Chờ cooldown có nắp <= 30s, pendingProbe retry 500ms & abort giữa chừng ─
    {
      console.log('\n[27/31] Kiểm thử B3: H3 chờ cooldown có nắp (3s đạt, 45s không chờ, pendingProbe 500ms retry, hủy giữa sleep)...');

      // Ca 1: usableReadyCount === 0, cooldown còn 3s -> sleep 3.5s -> sweep -> chạy fallbackModel thành công
      {
        const dirB3a = fs.mkdtempSync(path.join(tmpDir, 'b3-wait3s-'));
        const mgrB3a = new KeyPoolManager(dirB3a);
        const kB3a = fakeAqKey('B3WaitThreeSec0000000000000000000000000001');
        mgrB3a.confirmBatchImport(mgrB3a.previewBatchImport(kB3a).previewSessionId);
        mgrB3a.updateModelConfig({ defaultModel: 'gemini-4-hydrogen', fallbackModel: 'gemma-4-31b-it' });

        let simNow = 1_880_000_000_000;
        const [idB3a] = mgrB3a._getRawKeyIdsForVerification();
        const recB3a = mgrB3a._findKeyRecord(idB3a)!;
        recB3a.status = 'cooldown';
        recB3a.cooldownReason = 'NETWORK_OR_5XX';
        recB3a.cooldownUntil = simNow + 3_000;

        const sleepLog: number[] = [];
        const eventsOrder: string[] = [];
        const modelsTried: string[] = [];
        const metaB3a = await mgrB3a.executeStream({
          prompt: 'H3 wait 3s success',
          nowFn: () => simNow,
          disableJitter: true,
          onSseKeepAliveRequired: () => {
            eventsOrder.push('keepalive');
          },
          sleepFn: async (ms) => {
            eventsOrder.push('sleep');
            sleepLog.push(ms);
            simNow += ms;
          },
          onChunk: () => {},
          clientFactory: () => ({
            models: {
              async generateContentStream(params) {
                eventsOrder.push(`sdk:${params.model}`);
                modelsTried.push(params.model);
                simNow += 500;
                async function* gen() {
                  yield { text: 'Đạt sau khi chờ 3.5s!' };
                }
                return gen();
              },
              async generateContent() {
                return { text: 'OK' };
              },
            },
          }),
        });

        assert.deepStrictEqual(sleepLog, [3_500]);
        assert.strictEqual(eventsOrder[0], 'keepalive', 'onSseKeepAliveRequired phải gọi TRƯỚC sleep H3');
        assert.strictEqual(eventsOrder[1], 'sleep');
        assert.deepStrictEqual(modelsTried, ['gemma-4-31b-it'], 'Sau khi chờ H3 phải chạy fallbackModel');
        assert.strictEqual(metaB3a.fallbackLegUsed, true);
        assert.ok((metaB3a.fallbackLegLatencyMs ?? 0) >= 4_000);
      }

      // Ca 2: Từ lease === null bên trong vòng lặp -> giải phóng có chọn lọc & retry 1 lần 500ms khi vướng pendingProbe
      {
        const dirB3b = fs.mkdtempSync(path.join(tmpDir, 'b3-probe-'));
        const mgrB3b = new KeyPoolManager(dirB3b);
        const kWait = fakeAqKey('B3WaitSelective000000000000000000000000001');
        const kProjExcl = fakeAqKey('B3ProjectExcluded0000000000000000000000002');
        mgrB3b.confirmBatchImport(mgrB3b.previewBatchImport(`${kWait}\n${kProjExcl}`).previewSessionId);
        mgrB3b.updateModelConfig({ defaultModel: 'gemini-3.5-flash-lite', fallbackModel: 'gemma-4-31b-it' });

        let simNow = 1_885_000_000_000;
        const [idWait, idExcl] = mgrB3b._getRawKeyIdsForVerification();
        const allocB3b = mgrB3b._getAllocatorForVerification();
        let probeHolderLease: { release: () => void } | null = null;
        const sleepsB3b: number[] = [];
        const callKeysB3b: Array<{ key: string; model: string }> = [];

        const metaB3b = await mgrB3b.executeStream({
          prompt: 'H3 selective un-exclude + pendingProbe 500ms retry',
          nowFn: () => simNow,
          disableJitter: true,
          sleepFn: async (ms) => {
            sleepsB3b.push(ms);
            simNow += ms;
            if (sleepsB3b.length === 1) {
              // Mô phỏng key hết cooldown bị 1 probe song song giữ chỗ (inFlight=1, pendingProbe=true) ngay lúc thức dậy
              allocB3b.sweep(simNow);
              probeHolderLease = allocB3b.acquireLease(new Set(), new Set(), simNow);
              assert.ok(probeHolderLease, 'Probe song song giữ lease trước khi executeStream gọi lại acquireLease');
            } else if (sleepsB3b.length === 2) {
              // Trong lần retry 500ms -> probe song song giải phóng key và dọn pendingProbe
              probeHolderLease?.release();
              const recWait = mgrB3b._findKeyRecord(idWait)!;
              recWait.pendingProbe = false;
            }
          },
          onChunk: () => {},
          clientFactory: (rawKey) => ({
            models: {
              async generateContentStream(params) {
                callKeysB3b.push({ key: rawKey, model: params.model });
                if (rawKey === kWait && params.model === 'gemini-3.5-flash-lite') {
                  // Key1 dính RPM 2s (+2s buffer = 4s cooldown) -> modelCooldowns[3.5]=+4s; nếu đẩy cả key cooldown 4s:
                  // Dùng modelCooldowns? Ở đây giả lập key1 bị 429 RPM và trên k1 cũng tạm cooldown key để vào H3
                  const recWait = mgrB3b._findKeyRecord(idWait)!;
                  recWait.modelCooldowns = { ...(recWait.modelCooldowns ?? {}), 'gemma-4-31b-it': simNow + 4_000 };
                  throw Object.assign(new Error('429 RATE_LIMIT_EXCEEDED PerMinute "retryDelay": "2s"'), { status: 429 });
                }
                if (rawKey === kProjExcl) {
                  throw Object.assign(new Error('429 RESOURCE_EXHAUSTED projects/888999000 quota_limit_value: "0"'), { status: 429 });
                }
                async function* gen() {
                  yield { text: 'Thoát pendingProbe và thành công ở kWait!' };
                }
                return gen();
              },
              async generateContent() {
                return { text: 'OK' };
              },
            },
          }),
        });

        assert.deepStrictEqual(sleepsB3b, [5_500, 500], 'Phải sleep 5.5s H3 rồi retry đúng 1 lần 500ms khi vướng pendingProbe');
        assert.strictEqual(metaB3b.modelUsed, 'gemma-4-31b-it');
        assert.strictEqual(mgrB3b._findKeyRecord(idExcl)!.status, 'cooldown', 'Khóa thuộc project bị loại không được giải phóng');
        assert.ok(callKeysB3b.some((c) => c.key === kWait && c.model === 'gemma-4-31b-it'));
      }

      // Ca 3: waitMs = 45s (> 30s) -> KHÔNG chờ, ném PoolExhaustedError ngay
      {
        const dirB3c = fs.mkdtempSync(path.join(tmpDir, 'b3-cap45s-'));
        const mgrB3c = new KeyPoolManager(dirB3c);
        mgrB3c.confirmBatchImport(mgrB3c.previewBatchImport(fakeAqKey('B3CapOver30Sec0000000000000000000000000001')).previewSessionId);
        const simNow = 1_890_000_000_000;
        const [idB3c] = mgrB3c._getRawKeyIdsForVerification();
        const recB3c = mgrB3c._findKeyRecord(idB3c)!;
        recB3c.status = 'cooldown';
        recB3c.cooldownReason = 'NETWORK_OR_5XX';
        recB3c.cooldownUntil = simNow + 45_000;

        let sleepCalled = 0;
        let keepAliveCalled = 0;
        let errB3c: unknown = null;
        try {
          await mgrB3c.executeStream({
            prompt: 'Cooldown 45s > 30s cap',
            nowFn: () => simNow,
            disableJitter: true,
            sleepFn: async () => {
              sleepCalled += 1;
            },
            onSseKeepAliveRequired: () => {
              keepAliveCalled += 1;
            },
            onChunk: () => {},
          });
        } catch (e) {
          errB3c = e;
        }
        assert.strictEqual(sleepCalled, 0, 'Cooldown 45s vượt nắp 30s tuyệt đối không sleep');
        assert.strictEqual(keepAliveCalled, 0);
        assert.ok(errB3c instanceof PoolExhaustedError);
        assert.strictEqual((errB3c as PoolExhaustedError).code, 'AI_POOL_EXHAUSTED');
      }

      // Ca 4: AbortSignal kích hoạt giữa sleepFn -> thoát ngay lập tức
      {
        const dirB3d = fs.mkdtempSync(path.join(tmpDir, 'b3-abort-'));
        const mgrB3d = new KeyPoolManager(dirB3d);
        mgrB3d.confirmBatchImport(mgrB3d.previewBatchImport(fakeAqKey('B3AbortMidSleep000000000000000000000000001')).previewSessionId);
        const simNow = 1_895_000_000_000;
        const [idB3d] = mgrB3d._getRawKeyIdsForVerification();
        const recB3d = mgrB3d._findKeyRecord(idB3d)!;
        recB3d.status = 'cooldown';
        recB3d.cooldownReason = 'NETWORK_OR_5XX';
        recB3d.cooldownUntil = simNow + 5_000;

        const ctrl = new AbortController();
        let sdkCalls = 0;
        let errB3d: unknown = null;
        try {
          await mgrB3d.executeStream({
            prompt: 'Abort mid sleep',
            nowFn: () => simNow,
            signal: ctrl.signal,
            disableJitter: true,
            sleepFn: async (_ms, signal) => {
              ctrl.abort();
              if (signal?.aborted) {
                throw new Error('Yêu cầu đã bị hủy bởi người dùng.');
              }
            },
            onChunk: () => {},
            clientFactory: () => ({
              models: {
                async generateContentStream() {
                  sdkCalls += 1;
                  throw new Error('Must not call SDK');
                },
                async generateContent() {
                  return { text: 'OK' };
                },
              },
            }),
          });
        } catch (e) {
          errB3d = e;
        }
        assert.strictEqual(sdkCalls, 0);
        assert.ok(errB3d instanceof Error);
        assert.ok(!(errB3d instanceof PoolExhaustedError));
      }

      console.log('  -> Đạt: H3 chờ cooldown <= 30s, giải phóng có chọn lọc + retry pendingProbe 500ms, bỏ qua 45s và hủy tức thì khi abort.');
    }

    // ── BÀI 28: B4 (ĐK-152-11) — Trần tuyệt đối 200s mềm: không cắt luồng đang stream, chặn thử lại/nối tiếp mới ─
    {
      console.log('\n[28/31] Kiểm thử B4: Trần tuyệt đối 200s mềm (không cắt luồng đang chạy, chặn continuation mới)...');

      // Ca 1: Đang stream qua mốc 200s -> hoàn tất trọn vẹn, không bị abort giữa chừng
      {
        const dirB4a = fs.mkdtempSync(path.join(tmpDir, 'b4-soft-'));
        const mgrB4a = new KeyPoolManager(dirB4a);
        mgrB4a.confirmBatchImport(mgrB4a.previewBatchImport(fakeAqKey('B4SoftCeilingOne00000000000000000000000001')).previewSessionId);
        mgrB4a.updateModelConfig({ defaultModel: 'gemini-3.5-flash-lite', fallbackModel: 'gemma-4-31b-it' });

        let simNow = 1_900_000_000_000;
        let outB4a = '';
        const metaB4a = await mgrB4a.executeStream({
          prompt: 'Active stream crosses 200s',
          nowFn: () => simNow,
          onChunk: (t) => {
            outB4a += t;
          },
          clientFactory: () => ({
            models: {
              async generateContentStream(params) {
                if (params.model === 'gemini-3.5-flash-lite') {
                  simNow += 195_000; // Vào chân dự phòng ở mốc 195s (< 200s)
                  throw Object.assign(new Error('503 got status: UNAVAILABLE'), { status: 503 });
                }
                async function* gen() {
                  yield { text: 'Phần đầu ở 196s. ' };
                  simNow += 20_000; // Tổng thời gian nhảy tới 215s (> 200s) TRONG KHI ĐANG STREAM
                  yield { text: 'Phần kết ở 215s.' };
                }
                return gen();
              },
              async generateContent() {
                return { text: 'OK' };
              },
            },
          }),
        });

        assert.strictEqual(outB4a, 'Phần đầu ở 196s. Phần kết ở 215s.');
        assert.strictEqual(metaB4a.interrupted, undefined, 'Luồng đang stream vượt 200s KHÔNG được bị cắt');
        assert.strictEqual(metaB4a.fallbackLegUsed, true);
      }

      // Ca 2: Đứt luồng ở mốc 205s (> 200s) -> không được mở continuation mới
      {
        const dirB4b = fs.mkdtempSync(path.join(tmpDir, 'b4-nocont-'));
        const mgrB4b = new KeyPoolManager(dirB4b);
        mgrB4b.confirmBatchImport(mgrB4b.previewBatchImport(fakeAqKey('B4NoContAfter200s0000000000000000000000001')).previewSessionId);

        let simNow = 1_905_000_000_000;
        let callsB4b = 0;
        const metaB4b = await mgrB4b.executeStream({
          prompt: 'Interrupted past 200s',
          maxContinuations: 2,
          nowFn: () => simNow,
          onChunk: () => {},
          clientFactory: () => ({
            models: {
              async generateContentStream() {
                callsB4b += 1;
                async function* gen() {
                  yield { text: 'Đoạn đầu ' };
                  simNow += 205_000; // Vượt 200s trước khi đứt luồng
                  throw Object.assign(new Error('503 got status: UNAVAILABLE'), { status: 503 });
                }
                return gen();
              },
              async generateContent() {
                return { text: 'OK' };
              },
            },
          }),
        });

        assert.strictEqual(callsB4b, 1, 'Khi đã quá 200s trước lượt nối tiếp -> không mở continuation mới');
        assert.strictEqual(metaB4b.interrupted, true);
        assert.strictEqual(metaB4b.partialLength, 'Đoạn đầu '.length);
      }

      console.log('  -> Đạt: Trần tuyệt đối 200s bảo vệ luồng đang stream và chặn nối tiếp/thử lại mới.');
    }

    // ── BÀI 29: B5 (H4, ĐK-152-06, ĐK-152-07) — Meta cuối khi interrupted & SSE server.ts ─────
    {
      console.log('\n[29/31] Kiểm thử B5: partialLength + fallbackLegUsed trên 3 nhánh return & SSE { meta: finalMeta, done: true } khi interrupted...');

      // 1) Kiểm tra nhánh 1 (!canContinue) và nhánh 2 (hết khóa khi nối tiếp) của executeStream
      const dirB5 = fs.mkdtempSync(path.join(tmpDir, 'b5-meta-'));
      const mgrB5 = new KeyPoolManager(dirB5);
      mgrB5.confirmBatchImport(mgrB5.previewBatchImport(fakeAqKey('B5MetaInterruptedKey0000000000000000000001')).previewSessionId);

      const metaPostLoop = await mgrB5.executeStream({
        prompt: 'B5 post-loop interrupted',
        maxContinuations: 2,
        disableJitter: true,
        onChunk: () => {},
        clientFactory: () => ({
          models: {
            async generateContentStream(params) {
              if (params.model === 'gemini-3.5-flash-lite') {
                async function* gen() {
                  yield { text: 'Đoạn partial 22 ký tự!!' };
                  throw Object.assign(new Error('503 got status: UNAVAILABLE'), { status: 503 });
                }
                return gen();
              }
              throw Object.assign(new Error('503 got status: UNAVAILABLE'), { status: 503 });
            },
            async generateContent() {
              return { text: 'OK' };
            },
          },
        }),
      });
      assert.strictEqual(metaPostLoop.interrupted, true);
      assert.strictEqual(metaPostLoop.partialLength, 'Đoạn partial 22 ký tự!!'.length);
      assert.strictEqual(metaPostLoop.fallbackLegUsed, true);
      assert.strictEqual(typeof metaPostLoop.fallbackLegLatencyMs, 'number');

      // 2) Kiểm tra thực tế route SSE trong server.ts (/api/interpret-chat) qua HTTP thật trên cổng tạm
      const appB5 = express();
      registerApiRoutes(appB5);
      const serverB5 = await new Promise<import('http').Server>((resolve) => {
        const s = appB5.listen(0, '127.0.0.1', () => resolve(s));
      });
      const origExecuteStream = globalKeyPoolManager.executeStream.bind(globalKeyPoolManager);
      try {
        const port = (serverB5.address() as AddressInfo).port;
        globalKeyPoolManager.executeStream = async (opts) => {
          opts.onSseKeepAliveRequired?.();
          const firstMeta: StreamExecutionMeta = {
            keyId: 'k_test_b5',
            maskedKey: 'AQ.test••••b5',
            label: 'Test B5',
            modelUsed: 'gemini-3.5-flash-lite',
            usedFallbackModel: false,
            failoverAttempts: 1,
            latencyMs: 120,
            continuedFromPartial: false,
            continuationCount: 0,
            fallbackLegUsed: false,
          };
          opts.onMeta?.(firstMeta);
          opts.onChunk('Nội dung bị ngắt giữa chừng');
          opts.onInterrupted?.({
            reason: 'Kết nối gián đoạn',
            errorCategory: 'NETWORK_OR_5XX',
            partialLength: 27,
          });
          return {
            ...firstMeta,
            modelUsed: 'gemma-4-31b-it',
            usedFallbackModel: true,
            failoverAttempts: 2,
            continuedFromPartial: true,
            continuationCount: 1,
            interrupted: true,
            partialLength: 27,
            fallbackLegUsed: true,
            fallbackLegLatencyMs: 840,
          };
        };

        const realChartB5 = generateChart({
          name: 'Test B5',
          year: 1990,
          month: 5,
          day: 15,
          hour: 2,
          gender: 'male',
        });

        const resp = await fetch(`http://127.0.0.1:${port}/api/interpret-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chart: realChartB5,
            contextMode: 'natal',
            question: 'Kiểm tra frame meta cuối khi ngắt luồng?',
          }),
        });
        assert.strictEqual(resp.status, 200);
        const sseBody = await resp.text();
        const frames = sseBody
          .split('\n\n')
          .map((block) => block.trim())
          .filter(Boolean)
          .filter((block) => !block.startsWith(':'))
          .map((block) => block.replace(/^data:\s*/, ''));

        assert.strictEqual(frames[frames.length - 1], '[DONE]', 'Frame cuối phải là [DONE]');
        const doneJson = JSON.parse(frames[frames.length - 2]) as {
          meta?: StreamExecutionMeta;
          done?: boolean;
        };
        assert.strictEqual(doneJson.done, true, 'Endpoint SSE phải phát { meta: finalMeta, done: true } dù interrupted=true');
        assert.strictEqual(doneJson.meta?.interrupted, true);
        assert.strictEqual(doneJson.meta?.partialLength, 27);
        assert.strictEqual(doneJson.meta?.fallbackLegUsed, true);
        assert.strictEqual(doneJson.meta?.fallbackLegLatencyMs, 840);
        assert.ok(
          !frames.some((f) => f.includes('"citationAudit"')),
          'Khi interrupted=true tuyệt đối không chạy citationAudit',
        );
      } finally {
        globalKeyPoolManager.executeStream = origExecuteStream;
        await new Promise<void>((resolve) => serverB5.close(() => resolve()));
      }

      console.log('  -> Đạt: H4 phát đầy đủ { meta: finalMeta, done: true } trước [DONE] khi interrupted & giữ đúng guard citationAudit.');
    }

    // ── BÀI 30: B6 (ĐK-152-10) — Guard 1-model (fallback===default & preferredModel===fallback) ─
    {
      console.log('\n[30/31] Kiểm thử B6: Guard 1-model vô hiệu hóa H2/H3 khi không có chân dự phòng tách biệt...');

      // Ca 1: fallbackModel === defaultModel
      const dirB6a = fs.mkdtempSync(path.join(tmpDir, 'b6-same-'));
      const mgrB6a = new KeyPoolManager(dirB6a);
      mgrB6a.confirmBatchImport(mgrB6a.previewBatchImport(fakeAqKey('B6SameModelKey0000000000000000000000000001')).previewSessionId);
      mgrB6a.updateModelConfig({ defaultModel: 'gemini-3.5-flash-lite', fallbackModel: 'gemini-3.5-flash-lite' });

      const callsB6a: string[] = [];
      let sleepsB6a = 0;
      let errB6a: unknown = null;
      try {
        await mgrB6a.executeStream({
          prompt: '1-model same default & fallback',
          sleepFn: async () => {
            sleepsB6a += 1;
          },
          onChunk: () => {},
          clientFactory: () => ({
            models: {
              async generateContentStream(params) {
                callsB6a.push(params.model);
                throw Object.assign(new Error('503 got status: UNAVAILABLE'), { status: 503 });
              },
              async generateContent() {
                return { text: 'OK' };
              },
            },
          }),
        });
      } catch (e) {
        errB6a = e;
      }
      assert.strictEqual(callsB6a.length, 1);
      assert.strictEqual(sleepsB6a, 0);
      assert.ok(errB6a instanceof PoolExhaustedError);

      // Ca 2: preferredModel === fallbackModel -> vô hiệu hóa H2/H3
      const dirB6b = fs.mkdtempSync(path.join(tmpDir, 'b6-pref-'));
      const mgrB6b = new KeyPoolManager(dirB6b);
      mgrB6b.confirmBatchImport(mgrB6b.previewBatchImport(fakeAqKey('B6PreferredEqFallback000000000000000000001')).previewSessionId);
      mgrB6b.updateModelConfig({ defaultModel: 'gemini-3.5-flash-lite', fallbackModel: 'gemma-4-31b-it' });

      const callsB6b: string[] = [];
      let sleepsB6b = 0;
      let errB6b: unknown = null;
      try {
        await mgrB6b.executeStream({
          prompt: 'preferredModel === fallbackModel',
          preferredModel: 'gemma-4-31b-it',
          sleepFn: async () => {
            sleepsB6b += 1;
          },
          onChunk: () => {},
          clientFactory: () => ({
            models: {
              async generateContentStream(params) {
                callsB6b.push(params.model);
                throw Object.assign(new Error('502 Bad Gateway'), { status: 502 });
              },
              async generateContent() {
                return { text: 'OK' };
              },
            },
          }),
        });
      } catch (e) {
        errB6b = e;
      }
      assert.deepStrictEqual(callsB6b, ['gemma-4-31b-it']);
      assert.strictEqual(sleepsB6b, 0, 'preferredModel===fallbackModel không được chờ H3');
      assert.ok(errB6b instanceof PoolExhaustedError);

      console.log('  -> Đạt: Guard ĐK-152-10 chặn chuẩn xác H2/H3 trong cả hai cấu hình 1-model.');
    }

    // ── BÀI 31: B7 (ĐK-152-12) — TPM-skip ở nối luồng không mở H3/đốt chân dự phòng ─
    {
      console.log('\n[31/31] Kiểm thử B7: TPM-skip khi nối luồng với fallbackModel họ Gemma thoát sạch, không mở H3/chân dự phòng...');
      const dirB7 = fs.mkdtempSync(path.join(tmpDir, 'b7-tpm-cont-'));
      const mgrB7 = new KeyPoolManager(dirB7);
      mgrB7.confirmBatchImport(mgrB7.previewBatchImport(fakeAqKey('B7TpmContSkip00000000000000000000000000001')).previewSessionId);
      mgrB7.updateModelConfig({ defaultModel: 'gemini-3.5-flash-lite', fallbackModel: 'gemma-4-31b-it' });

      // Prompt 11.500 token (<15K ban đầu) + partial 1.200 token + wrapper continuation prompt -> >12.000 + 3.000 = >15.000 -> Gemma bị TPM skip ở continuation!
      const prompt11500 = 'x'.repeat(Math.ceil(11_500 * GEMMA_TPM_CHARS_PER_TOKEN_VI));
      const partialChunk = 'y'.repeat(Math.ceil(1_200 * GEMMA_TPM_CHARS_PER_TOKEN_VI));
      let sleepCallsB7 = 0;
      const sdkModelsB7: string[] = [];

      const metaB7 = await mgrB7.executeStream({
        prompt: prompt11500,
        maxContinuations: 2,
        disableJitter: true,
        sleepFn: async () => {
          sleepCallsB7 += 1;
        },
        onChunk: () => {},
        clientFactory: () => ({
          models: {
            async generateContentStream(params) {
              sdkModelsB7.push(params.model);
              async function* gen() {
                yield { text: partialChunk };
                throw Object.assign(new Error('503 got status: UNAVAILABLE'), { status: 503 });
              }
              return gen();
            },
            async generateContent() {
              return { text: 'OK' };
            },
          },
        }),
      });

      assert.deepStrictEqual(sdkModelsB7, ['gemini-3.5-flash-lite'], 'Gemma phải bị TPM-skip trước khi gọi SDK ở continuation');
      assert.strictEqual(sleepCallsB7, 0, 'TPM-skip không được kích hoạt sleep H3');
      assert.strictEqual(metaB7.interrupted, true);
      assert.strictEqual(metaB7.partialLength, partialChunk.length);
      assert.strictEqual(metaB7.fallbackLegUsed, false, 'TPM-skip trước khi gọi SDK không được đánh dấu fallbackLegUsed=true');
      assert.strictEqual(metaB7.fallbackLegLatencyMs, undefined);
      console.log('  -> Đạt: B7 TPM-skip trong continuation thoát sạch với partialLength đúng và không đốt chân dự phòng.');
    }

    // ── BÀI 32: Gói B (KP-4) — Chuẩn hóa khoảng trắng điểm nối continuation seam ─
    {
      console.log('\n[32/33] Kiểm thử Gói B (KP-4): normalizeContinuationSeam, prompt & executeStream continuation...');
      // Positive cases
      assert.strictEqual(normalizeContinuationSeam('xung', 'quanh'), ' quanh');
      assert.strictEqual(normalizeContinuationSeam('hội', 'cùng'), ' cùng');
      assert.strictEqual(normalizeContinuationSeam('[Vượng]', 'và'), ' và');
      assert.strictEqual(normalizeContinuationSeam('từ', 'đối'), ' đối');

      // Negative cases
      assert.strictEqual(normalizeContinuationSeam('Mệnh', ', Tài'), ', Tài');
      assert.strictEqual(normalizeContinuationSeam('đoạn 1.\n', '### 2.'), '### 2.');
      assert.strictEqual(normalizeContinuationSeam('**', 'từ'), 'từ');
      assert.strictEqual(normalizeContinuationSeam('từ', '**'), '**');
      assert.strictEqual(normalizeContinuationSeam('từ ', 'đối'), 'đối');
      assert.strictEqual(normalizeContinuationSeam('từ', ' đối'), ' đối');

      // Prompt wording check
      const contPrompt = buildContinuationPrompt('Đề bài gốc', 'Văn bản đang dở');
      assert.ok(
        contPrompt.includes('hệ thống tự xử lý khoảng trắng tại điểm nối nên không cần bắt đầu bằng khoảng trắng'),
        'buildContinuationPrompt phải hướng dẫn rõ hệ thống tự xử lý khoảng trắng điểm nối',
      );
      assert.ok(!contPrompt.includes('NGAY TỪ CHỮ CUỐI CÙNG ĐANG DỞ'));

      // Integration test qua executeStream: ngắt sau "xung", continuation trả về ["quanh", "và"] (không có space ở chunk đầu continuation)
      const dirSeam = fs.mkdtempSync(path.join(tmpDir, 'kp4-seam-'));
      const mgrSeam = new KeyPoolManager(dirSeam);
      mgrSeam.confirmBatchImport(mgrSeam.previewBatchImport(fakeAqKey('SeamKey00000000000000000000000000000001')).previewSessionId);
      mgrSeam.updateModelConfig({ defaultModel: 'gemini-3.5-flash-lite', fallbackModel: 'gemma-4-31b-it' });

      let callNum = 0;
      const emittedChunks: string[] = [];
      const metaSeam = await mgrSeam.executeStream({
        prompt: 'Kiểm thử điểm nối',
        disableJitter: true,
        sleepFn: async () => {},
        onChunk: (t) => {
          emittedChunks.push(t);
        },
        clientFactory: () => ({
          models: {
            async generateContentStream() {
              callNum += 1;
              if (callNum === 1) {
                async function* gen1() {
                  yield { text: 'Cung Mệnh chiếu xung' };
                  throw Object.assign(new Error('503 got status: UNAVAILABLE'), { status: 503 });
                }
                return gen1();
              }
              async function* gen2() {
                yield { text: 'quanh' };
                yield { text: ' và hội chiếu.' };
              }
              return gen2();
            },
            async generateContent() {
              return { text: 'OK' };
            },
          },
        }),
      });

      assert.strictEqual(metaSeam.continuedFromPartial, true);
      assert.strictEqual(metaSeam.continuationCount, 1);
      assert.strictEqual(
        emittedChunks.join(''),
        'Cung Mệnh chiếu xung quanh và hội chiếu.',
        'Điểm nối giữa "xung" và "quanh" phải có đúng 1 khoảng trắng',
      );
      console.log('  -> Đạt: Gói B (KP-4) normalizeContinuationSeam + continuation stream ghép đúng.');
    }

    // ── BÀI 33: Gói D (KP-7) — parseBatchKeys & collectEnvSeedKeys trên 1 dòng ngăn cách dấu phẩy ─
    {
      console.log('\n[33/33] Kiểm thử Gói D (KP-7): 23 cặp "P…:Khóa" & 2 khóa trần trên 1 dòng + collectEnvSeedKeys...');
      const items23 = Array.from({ length: 23 }, (_, idx) => {
        const num = String(idx + 1).padStart(2, '0');
        const key = idx % 2 === 0
          ? fakeKey(`SingleLine23_${num}_00000000000000000`)
          : fakeAqKey(`SingleLine23_${num}_000000000000000000000000000`);
        return { label: `P${num}`, key };
      });
      const singleLine23 = items23.map((x) => `${x.label}:${x.key}`).join(',');
      const parsed23 = parseBatchKeys(singleLine23, new Set(), 'Khóa');
      assert.strictEqual(parsed23.recognizedCount, 23, 'Phải nhận đủ 23 khóa trên 1 dòng ngăn cách dấu phẩy');
      assert.strictEqual(parsed23.invalidCount, 0);
      assert.strictEqual(parsed23.duplicateCount, 0);
      assert.deepStrictEqual(
        parsed23.validEntries.map((e) => e.label),
        items23.map((x) => x.label),
        'Phải giữ nguyên toàn bộ 23 nhãn P01..P23',
      );

      // 2 khóa trần trên 1 dòng ngăn cách dấu phẩy
      const bare1 = fakeKey('BareCommaOne00000000000000000001');
      const bare2 = fakeKey('BareCommaTwo00000000000000000002');
      const parsedBare2 = parseBatchKeys(`${bare1},${bare2}`, new Set(), 'Khóa');
      assert.strictEqual(parsedBare2.recognizedCount, 2);
      assert.strictEqual(parsedBare2.invalidCount, 0);

      // collectEnvSeedKeys với GEMINI_API_KEYS là 1 dòng 23 cặp P…:Khóa
      const dirEnv23 = fs.mkdtempSync(path.join(tmpDir, 'kp7-env23-'));
      process.env.GEMINI_API_KEYS = singleLine23;
      try {
        const storeEnv23 = new KeyPoolCryptoStore(dirEnv23);
        const seeds = storeEnv23.collectEnvSeedKeys();
        assert.strictEqual(seeds.length, 23, 'collectEnvSeedKeys phải trả về đúng 23 seed');
        assert.deepStrictEqual(
          seeds.map((s) => s.label),
          items23.map((x) => x.label),
          'collectEnvSeedKeys phải giữ nguyên toàn bộ 23 nhãn',
        );
      } finally {
        delete process.env.GEMINI_API_KEYS;
      }
      console.log('  -> Đạt: Gói D (KP-7) tách chuẩn 23 "P…:Khóa", 2 khóa trần & collectEnvSeedKeys.');
    }

    console.log('\n=== TẤT CẢ 33 BÀI KIỂM THỬ KHO KHÓA ĐỀU ĐẠT ===');
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
