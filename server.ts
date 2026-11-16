import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  formatChartSummaryVi,
  generateLocalInterpretationVi,
  translateStarName,
  translateWuxingJu,
  VI_BRANCHES,
} from './src/lib/ziwei/vi-i18n.ts';
import { ZiweiChart } from './src/lib/ziwei/types.ts';
import type { YunxianPeriodContext } from './src/lib/ziwei/yunxian-context.ts';
import { keyPoolManager } from './server/key-pool/index.ts';
import { PoolExhaustedError } from './server/key-pool/executor.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

function timingSafePinMatches(provided: string, expected: string): boolean {
  const hashA = crypto.createHash('sha256').update(provided, 'utf8').digest();
  const hashB = crypto.createHash('sha256').update(expected, 'utf8').digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function getRequestSecurityContext(req: express.Request) {
  const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  const originHeader = String(req.headers.origin || req.headers.referer || '').toLowerCase();
  const isSharedOrigin = hostHeader.includes('ais-pre-') || originHeader.includes('ais-pre-');

  const configuredPin = process.env.KEY_POOL_ADMIN_PIN?.trim() || '';
  const hasAdminPinConfigured = configuredPin.length > 0;
  const providedPin = String(req.headers['x-key-pool-pin'] || '').trim();
  const pinVerified =
    hasAdminPinConfigured && providedPin.length > 0
      ? timingSafePinMatches(providedPin, configuredPin)
      : false;

  // QĐ-1 Phương án B:
  // - Trên Shared App URL: chỉ cho phép sửa khi đã cấu hình KEY_POOL_ADMIN_PIN và nhập đúng PIN; ngược lại ở chế độ Chỉ xem (Read-Only)
  // - Trên Development URL / localhost: toàn quyền nếu không đặt PIN; nếu có đặt PIN thì cần đúng PIN
  const isReadOnly = isSharedOrigin
    ? !(hasAdminPinConfigured && pinVerified)
    : hasAdminPinConfigured && !pinVerified;

  const adminPinRequired = hasAdminPinConfigured && !pinVerified;

  return {
    isSharedOrigin,
    hasAdminPinConfigured,
    pinVerified,
    isReadOnly,
    adminPinRequired,
  };
}

function requireKeyPoolWriteAccess(
  req: express.Request,
  res: express.Response,
): boolean {
  const sec = getRequestSecurityContext(req);
  if (!sec.isReadOnly) return true;

  const message = sec.isSharedOrigin && !sec.hasAdminPinConfigured
    ? 'Chế độ Chỉ xem (Read-Only) trên Shared App URL: không thể thêm, sửa hoặc xóa khóa khi chưa thiết lập KEY_POOL_ADMIN_PIN trong Secrets.'
    : 'Vui lòng nhập đúng mã PIN quản trị (KEY_POOL_ADMIN_PIN) để thực hiện thao tác thay đổi Kho Khóa.';

  res.status(403).json({
    error: 'ADMIN_READ_ONLY',
    message,
    isSharedOrigin: sec.isSharedOrigin,
    adminPinRequired: sec.adminPinRequired,
    hasAdminPinConfigured: sec.hasAdminPinConfigured,
  });
  return false;
}

type FlushableResponse = express.Response & { flush?: () => void };

function applySseHeaders(res: express.Response) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  (res as FlushableResponse).flushHeaders?.();
}

function sendSseJson(res: express.Response, payload: unknown) {
  if (res.writableEnded) return;
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
  (res as FlushableResponse).flush?.();
}

function sendSseText(res: express.Response, text: string) {
  sendSseJson(res, { delta: { text } });
}

function startSseHeartbeat(res: express.Response): () => void {
  const timer = setInterval(() => {
    if (res.writableEnded) return;
    res.write(': keepalive\n\n');
    (res as FlushableResponse).flush?.();
  }, 18_000);
  timer.unref?.();

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
  };
}

function buildLocalHemingServerFallback(chartA: ZiweiChart, chartB: ZiweiChart): string {
  const mingA = chartA.palaces.find((p) => p.isMingGong);
  const mingB = chartB.palaces.find((p) => p.isMingGong);
  const getMajors = (p?: typeof mingA) => {
    const majors = p?.stars.filter((s) => s.type === 'major') ?? [];
    if (majors.length > 0) return majors.map((s) => translateStarName(s.name)).join(', ');
    if (p?.borrowedStars?.length) {
      return `Vô chính diệu (mượn ${p.borrowedStars.map((s) => translateStarName(s)).join(', ')})`;
    }
    return 'Vô chính diệu';
  };

  return `## Luận Giải Hợp Bàn Tử Vi (${chartA.birthInfo.name || 'Bên A'} & ${chartB.birthInfo.name || 'Bên B'})

### 1. Tổng Quan Tương Hợp Bản Mệnh
- **Đương số A (${chartA.birthInfo.name || 'Bên A'}):** ${translateWuxingJu(chartA.wuxingJuName)}, Mệnh tọa cung **${VI_BRANCHES[mingA?.branch ?? 0]}** (${getMajors(mingA)}).
- **Đương số B (${chartB.birthInfo.name || 'Bên B'}):** ${translateWuxingJu(chartB.wuxingJuName)}, Mệnh tọa cung **${VI_BRANCHES[mingB?.branch ?? 0]}** (${getMajors(mingB)}).

${generateLocalInterpretationVi(chartA, 'tình duyên Phu Thê')}

---
### 2. Đối Chiếu Lá Số Thứ Hai
${generateLocalInterpretationVi(chartB, 'tình duyên Phu Thê')}`;
}

export function buildStrictPeriodAiPrompt(
  periodContext: YunxianPeriodContext,
  chartSummary: string,
): { systemInstruction: string; prompt: string } {
  const isDahan = periodContext.mode === 'dahan';
  const periodTypeLabel = isDahan
    ? 'ĐẠI HẠN (Xu thế vận trình 10 năm)'
    : 'LƯU NIÊN (Biến chuyển & sự kiện trong 1 năm)';

  const systemInstruction = `Bạn là chuyên gia luận giải Tử Vi Đẩu Số theo hệ thống Thiên Kỷ (Nghê Hải Hạ) và Tử Vi Đẩu Số Toàn Thư.
QUY TẮC RÀO CHỐNG BỊA (BẮT BUỘC TUÂN THỦ 100%):
1. CHỈ ĐƯỢC phép luận giải dựa trên các dữ kiện có trong [BẢNG DỮ KIỆN KỲ HẠN XÁC ĐỊNH], [TRÍCH ĐOẠN TRI THỨC LIÊN QUAN] và [TÓM TẮT LÁ SỐ BẢN MỆNH] được gửi kèm.
2. TUYỆT ĐỐI CẤM tự bịa thêm sao, cấm tự đổi cung vị của sao, cấm tự gán Tứ Hóa (Hóa Lộc, Hóa Quyền, Hóa Khoa, Hóa Kỵ) hoặc Sao Lưu không có trong Bảng dữ kiện.
3. Mọi nhận định phải nêu đích danh tên sao, tên cung bản mệnh, can chi và sao lưu khớp với Bảng dữ kiện.
4. Phân biệt rõ tính chất kỳ hạn:
   - Nếu là ĐẠI HẠN (10 năm): luận giải như xu thế nền tảng, môi trường phát triển và trọng tâm chuyển dịch trong suốt thập kỷ.
   - Nếu là LƯU NIÊN (1 năm): luận giải như sự kiện cụ thể, biến chuyển và điểm ứng kỳ trong năm đó (đặt trong bối cảnh Đại Hạn gốc).
5. Viết hoàn toàn bằng tiếng Việt chuẩn mực (không dùng chữ Hán), trình bày bằng Markdown theo đúng 4 đề mục:
   ### 1. Chủ Đề Kỳ Hạn (${isDahan ? 'Xu Thế 10 Năm' : 'Sự Kiện Trong Năm'})
   ### 2. Điểm Cát & Động Lực Thuận Lợi
   ### 3. Điểm Hung & Trục Xung Chiếu Cần Lưu Ý
   ### 4. Lời Khuyên Hành Động
6. Cuối bài BẮT BUỘC ghi rõ dòng chữ: "*Lưu ý: Nội dung tham khảo phục vụ nghiên cứu mệnh lý Tử Vi Đẩu Số.*"`;

  const excerpts = [
    ...(periodContext.knowledgeExcerpts.patterns.length > 0
      ? ['[Cách cục nhận diện từ patterns.ts]:', ...periodContext.knowledgeExcerpts.patterns.map((x) => `- ${x}`)]
      : []),
    ...(periodContext.knowledgeExcerpts.starPrinciples.length > 0
      ? ['[Tính chất tinh diệu từ school-data.ts / constants.ts]:', ...periodContext.knowledgeExcerpts.starPrinciples.map((x) => `- ${x}`)]
      : []),
    ...(periodContext.knowledgeExcerpts.fuqiAndSihua.length > 0
      ? ['[Nguyên lý Tứ Hóa & Tinh hệ từ heming-knowledge.ts]:', ...periodContext.knowledgeExcerpts.fuqiAndSihua.map((x) => `- ${x}`)]
      : []),
  ].join('\n');

  const prompt = `Hãy diễn giải kỳ hạn **${periodContext.periodTitleVi}** thuộc loại **${periodTypeLabel}** dựa tuyệt đối vào bảng dữ kiện xác định dưới đây:

=== 1. BẢNG DỮ KIỆN KỲ HẠN XÁC ĐỊNH ===
${periodContext.factTableMarkdown}

=== 2. TRÍCH ĐOẠN TRI THỨC LIÊN QUAN ===
${excerpts || 'Áp dụng nguyên lý Tam Phương Tứ Chính và Tứ Hóa kỳ hạn.'}

=== 3. TÓM TẮT LÁ SỐ BẢN MỆNH ===
${chartSummary}

Hãy trình bày bài luận giải tiếng Việt theo đúng 4 mục quy định và kết thúc bằng dòng lưu ý nội dung tham khảo.`;

  return { systemInstruction, prompt };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // GET /api/ai-diagnostics — Chẩn đoán an toàn toàn pool (KHÔNG bao giờ lộ giá trị key)
  app.get('/api/ai-diagnostics', (_req, res) => {
    res.json(keyPoolManager.getDiagnostics());
  });

  // ─── NHÓM ROUTE QUẢN LÝ KHO KHÓA GEMINI (/api/key-pool/*) ───────────────────

  app.get('/api/key-pool', (req, res) => {
    const sec = getRequestSecurityContext(req);
    res.json(
      keyPoolManager.getPublicSnapshot({
        isReadOnly: sec.isReadOnly,
        isSharedOrigin: sec.isSharedOrigin,
        adminPinRequired: sec.adminPinRequired,
        hasAdminPinConfigured: sec.hasAdminPinConfigured,
      }),
    );
  });

  app.post('/api/key-pool/preview', (req, res) => {
    if (!requireKeyPoolWriteAccess(req, res)) return;
    try {
      const { rawInput, labelPrefix } = req.body as {
        rawInput?: string;
        labelPrefix?: string;
      };
      if (typeof rawInput !== 'string') {
        res.status(400).json({ error: 'INVALID_INPUT', message: 'Thiếu nội dung danh sách khóa.' });
        return;
      }
      const preview = keyPoolManager.previewBatchImport(rawInput, labelPrefix || 'Khóa');
      res.json(preview);
    } catch (err) {
      res.status(400).json({
        error: 'PREVIEW_FAILED',
        message: keyPoolManager.sanitize(err),
      });
    }
  });

  app.post('/api/key-pool/import', (req, res) => {
    if (!requireKeyPoolWriteAccess(req, res)) return;
    try {
      const { previewSessionId } = req.body as { previewSessionId?: string };
      if (!previewSessionId) {
        res.status(400).json({ error: 'INVALID_INPUT', message: 'Thiếu previewSessionId.' });
        return;
      }
      const result = keyPoolManager.confirmBatchImport(previewSessionId);
      const sec = getRequestSecurityContext(req);
      res.json({
        ...result,
        pool: keyPoolManager.getPublicSnapshot({
          isReadOnly: sec.isReadOnly,
          isSharedOrigin: sec.isSharedOrigin,
          adminPinRequired: sec.adminPinRequired,
          hasAdminPinConfigured: sec.hasAdminPinConfigured,
        }),
      });
    } catch (err) {
      res.status(400).json({
        error: 'IMPORT_FAILED',
        message: keyPoolManager.sanitize(err),
      });
    }
  });

  app.post('/api/key-pool/sync-env', (req, res) => {
    if (!requireKeyPoolWriteAccess(req, res)) return;
    const added = keyPoolManager.bootstrapFromEnv(true);
    const sec = getRequestSecurityContext(req);
    res.json({
      added,
      pool: keyPoolManager.getPublicSnapshot({
        isReadOnly: sec.isReadOnly,
        isSharedOrigin: sec.isSharedOrigin,
        adminPinRequired: sec.adminPinRequired,
        hasAdminPinConfigured: sec.hasAdminPinConfigured,
      }),
    });
  });

  app.delete('/api/key-pool/:id', (req, res) => {
    if (!requireKeyPoolWriteAccess(req, res)) return;
    const deleted = keyPoolManager.deleteKey(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Không tìm thấy khóa cần xóa.' });
      return;
    }
    const sec = getRequestSecurityContext(req);
    res.json({
      deleted: true,
      pool: keyPoolManager.getPublicSnapshot({
        isReadOnly: sec.isReadOnly,
        isSharedOrigin: sec.isSharedOrigin,
        adminPinRequired: sec.adminPinRequired,
        hasAdminPinConfigured: sec.hasAdminPinConfigured,
      }),
    });
  });

  app.post('/api/key-pool/:id/reactivate', (req, res) => {
    if (!requireKeyPoolWriteAccess(req, res)) return;
    const ok = keyPoolManager.reactivateKey(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Không tìm thấy khóa cần kích hoạt lại.' });
      return;
    }
    const sec = getRequestSecurityContext(req);
    res.json({
      reactivated: true,
      pool: keyPoolManager.getPublicSnapshot({
        isReadOnly: sec.isReadOnly,
        isSharedOrigin: sec.isSharedOrigin,
        adminPinRequired: sec.adminPinRequired,
        hasAdminPinConfigured: sec.hasAdminPinConfigured,
      }),
    });
  });

  app.post('/api/key-pool/:id/test', async (req, res) => {
    if (!requireKeyPoolWriteAccess(req, res)) return;
    try {
      const result = await keyPoolManager.testKey(req.params.id);
      const sec = getRequestSecurityContext(req);
      res.json({
        ...result,
        pool: keyPoolManager.getPublicSnapshot({
          isReadOnly: sec.isReadOnly,
          isSharedOrigin: sec.isSharedOrigin,
          adminPinRequired: sec.adminPinRequired,
          hasAdminPinConfigured: sec.hasAdminPinConfigured,
        }),
      });
    } catch (err) {
      const msg = keyPoolManager.sanitize(err);
      const status = msg.includes('Không tìm thấy') ? 404 : 429;
      res.status(status).json({ error: 'TEST_FAILED', message: msg });
    }
  });

  app.put('/api/key-pool/models', (req, res) => {
    if (!requireKeyPoolWriteAccess(req, res)) return;
    try {
      const { defaultModel, fallbackModel, customSupportedModels } = req.body as {
        defaultModel?: string;
        fallbackModel?: string;
        customSupportedModels?: string[];
      };
      const updated = keyPoolManager.updateModelConfig({
        defaultModel: defaultModel || '',
        fallbackModel: fallbackModel || '',
        customSupportedModels,
      });
      const sec = getRequestSecurityContext(req);
      res.json({
        modelConfig: updated,
        pool: keyPoolManager.getPublicSnapshot({
          isReadOnly: sec.isReadOnly,
          isSharedOrigin: sec.isSharedOrigin,
          adminPinRequired: sec.adminPinRequired,
          hasAdminPinConfigured: sec.hasAdminPinConfigured,
        }),
      });
    } catch (err) {
      res.status(400).json({
        error: 'INVALID_MODEL_CONFIG',
        message: keyPoolManager.sanitize(err),
      });
    }
  });

  // ─── CÁC ENDPOINT AI SỬ DỤNG CHUNG KEY POOL & MODEL CONFIG (QĐ-2) ────────────

  // POST /api/interpret-period — Gemini AI interpretation strictly grounded on deterministic YunxianPeriodContext
  app.post('/api/interpret-period', async (req, res) => {
    const { chart, periodContext } = req.body as {
      chart?: ZiweiChart;
      periodContext?: YunxianPeriodContext;
    };

    if (!chart || !chart.palaces || !periodContext) {
      res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'Thiếu dữ liệu lá số hoặc bảng dữ kiện kỳ hạn xác định.',
      });
      return;
    }

    const chartSummary = formatChartSummaryVi(chart);
    const { systemInstruction, prompt } = buildStrictPeriodAiPrompt(periodContext, chartSummary);

    const abortController = new AbortController();
    let sseStarted = false;
    let stopHeartbeat: () => void = () => {};

    res.on('close', () => {
      stopHeartbeat();
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    const ensureSseStarted = () => {
      if (!sseStarted) {
        sseStarted = true;
        applySseHeaders(res);
        stopHeartbeat = startSseHeartbeat(res);
      }
    };

    try {
      await keyPoolManager.executeStream({
        prompt,
        systemInstruction,
        signal: abortController.signal,
        onMeta: (meta) => {
          ensureSseStarted();
          sendSseJson(res, { meta });
        },
        onChunk: (text) => {
          ensureSseStarted();
          sendSseText(res, text);
        },
        onInterrupted: (ev) => {
          ensureSseStarted();
          sendSseJson(res, {
            interrupted: true,
            message: ev.reason,
            errorCategory: ev.errorCategory,
            partialLength: ev.partialLength,
          });
        },
      });
      if (sseStarted && !res.writableEnded) {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } catch (err) {
      if (err instanceof PoolExhaustedError && !sseStarted) {
        res.status(503).json({
          error: err.code,
          message: err.message,
          minRemainingCooldownSec: err.minRemainingCooldownSec,
        });
        return;
      }

      const safeDetail = keyPoolManager.sanitize(err);
      const clientMessage =
        err instanceof Error ? keyPoolManager.sanitize(err.message) : safeDetail;
      console.error(`[interpret-period] KeyPool execution failed: ${safeDetail}`);
      ensureSseStarted();
      sendSseJson(res, {
        error: 'AI_CALL_FAILED',
        message: clientMessage,
        detail: clientMessage,
      });
      if (!res.writableEnded) {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } finally {
      stopHeartbeat();
    }
  });

  // POST /api/interpret — SSE streaming Zi Wei Dou Shu interpretation in Vietnamese
  app.post('/api/interpret', async (req, res) => {
    applySseHeaders(res);

    const { chart, topic = 'overall', question } = req.body as {
      chart?: ZiweiChart;
      topic?: string;
      question?: string;
    };

    if (!chart || !chart.palaces) {
      sendSseText(res, 'Không tìm thấy dữ liệu lá số hợp lệ.');
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const topicHintMap: Record<string, string> = {
      overall: 'Tổng quan mệnh cục',
      career: 'sự nghiệp Quan Lộc',
      wealth: 'tài lộc Tài Bạch',
      love: 'tình duyên Phu Thê',
      health: 'sức khỏe Tật Ách',
      character: 'tính cách Phúc Đức',
    };
    const fallbackPrompt = question || topicHintMap[topic] || topic;

    const chartSummary = formatChartSummaryVi(chart);
    const topicNames: Record<string, string> = {
      overall: 'Tổng quan Mệnh Cục, Tam Phương Tứ Chính (Mệnh - Tài - Quan - Di) và Đại Hạn hiện tại',
      career: 'Sự nghiệp, Quan Lộc, hướng phát triển công danh và năng lực lãnh đạo/chuyên môn',
      wealth: 'Tài Bạch, Điền Trạch, khả năng tích lũy tài sản và quản trị rủi ro tài chính',
      love: 'Tình duyên, Cung Phu Thê, nhân duyên hôn nhân và cách giữ gìn gia đạo',
      health: 'Cung Tật Ách, sức khỏe theo Đông Y - Hoàng Đế Nội Kinh và cách dưỡng sinh',
      character: 'Tính cách cốt lõi, Cung Phúc Đức, ưu nhược điểm nội tâm và lời khuyên tu dưỡng',
    };

    const prompt = question
      ? `Bạn là Đại sư Tử Vi Đẩu Số tinh thông hệ thống Thiên Kỷ của Nghê Hải Hạ (Ni Haixia) và Tử Vi Đẩu Số Toàn Thư.
Dưới đây là toàn bộ cấu trúc lá số Tử Vi của đương số:

${chartSummary}

Câu hỏi/Yêu cầu cụ thể của đương số: "${question}"

Hãy luận giải bằng tiếng Việt chuẩn thuật ngữ Tử Vi Hán-Việt, sâu sắc, mạch lạc, thực tế:
1. Phân tích trực tiếp các Chính Tinh (kèm độ sáng Miếu/Vượng/Đắc/Hãm), Phụ Tinh, Tứ Hóa (Lộc, Quyền, Khoa, Kỵ) và Tam Phương Tứ Chính liên quan đến câu hỏi.
2. Kết hợp góc nhìn thực chiến của Thiên Kỷ (Nghê Hải Hạ): chỉ rõ cơ hội, điểm cần đề phòng và lời khuyên hành động cụ thể.`
      : `Bạn là Đại sư Tử Vi Đẩu Số tinh thông hệ thống Thiên Kỷ của Nghê Hải Hạ (Ni Haixia) và Tử Vi Đẩu Số Toàn Thư.
Dưới đây là toàn bộ cấu trúc lá số Tử Vi của đương số:

${chartSummary}

Chủ đề cần luận giải chuyên sâu: **${topicNames[topic] || topicNames.overall}**

Hãy trình bày bài luận giải bằng tiếng Việt chuẩn mực, rõ ràng theo từng mục:
1. **Cấu Trúc Chính Tinh & Tam Phương Tứ Chính**: Phân tích cường độ Miếu/Vượng/Hãm và sự hội hợp của Cát Tinh, Sát Tinh.
2. **Động Lực Tứ Hóa (Lộc · Quyền · Khoa · Kỵ)**: Chỉ rõ dòng chảy năng lượng của lá số trong lĩnh vực này.
3. **Điểm Mạnh Thiên Phú & Thử Thách Cần Vượt Qua**: Góc nhìn thẳng thắn, thực tế theo phong cách Nghê Hải Hạ.
4. **Phương Pháp Cải Vận & Hành Động Thực Tiễn**: Lời khuyên thiết thực phù hợp với vận hạn hiện tại.`;

    const abortController = new AbortController();
    const stopHeartbeat = startSseHeartbeat(res);
    res.on('close', () => {
      stopHeartbeat();
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    let anyChunkSent = false;
    let interruptedEmitted = false;

    try {
      await keyPoolManager.executeStream({
        prompt,
        signal: abortController.signal,
        onMeta: (meta) => {
          sendSseJson(res, { meta });
        },
        onChunk: (text) => {
          anyChunkSent = true;
          sendSseText(res, text);
        },
        onInterrupted: (ev) => {
          interruptedEmitted = true;
          sendSseJson(res, {
            interrupted: true,
            message: ev.reason,
            errorCategory: ev.errorCategory,
            partialLength: ev.partialLength,
          });
        },
      });
    } catch (err) {
      if (!anyChunkSent) {
        sendSseText(res, generateLocalInterpretationVi(chart, fallbackPrompt));
      } else if (!interruptedEmitted) {
        sendSseJson(res, {
          interrupted: true,
          message: err instanceof Error ? keyPoolManager.sanitize(err.message) : keyPoolManager.sanitize(err),
          errorCategory: 'NETWORK_OR_5XX',
        });
      }
    } finally {
      stopHeartbeat();
      if (!res.writableEnded) {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    }
  });

  // POST /api/heming — SSE streaming Synastry / Compatibility interpretation in Vietnamese
  app.post('/api/heming', async (req, res) => {
    applySseHeaders(res);

    const { chartA, chartB } = req.body as {
      chartA?: ZiweiChart;
      chartB?: ZiweiChart;
    };

    if (!chartA || !chartB) {
      sendSseText(res, 'Vui lòng cung cấp đầy đủ hai lá số để tiến hành Hợp Bàn.');
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const summaryA = formatChartSummaryVi(chartA);
    const summaryB = formatChartSummaryVi(chartB);

    const prompt = `Bạn là Đại sư Tử Vi Đẩu Số tinh thông pháp môn Hợp Bàn thuộc hệ thống Thiên Kỷ của Nghê Hải Hạ.
Hãy phân tích mức độ tương hợp (nhân duyên vợ chồng / đối tác đồng hành) giữa hai lá số sau:

=== LÁ SỐ ĐƯƠNG SỐ A ===
${summaryA}

=== LÁ SỐ ĐƯƠNG SỐ B ===
${summaryB}

Hãy luận giải chi tiết bằng tiếng Việt theo 5 bước chuẩn mực:
1. **Tương Hợp Khí Chất Mệnh Cung & Ngũ Hành Cục**: So sánh tính cách cốt lõi, sự bù trừ giữa nhóm sao của A và B.
2. **Giao Thoa Cung Phu Thê**: Chính tinh cung Phu Thê của người này có tương ứng với Mệnh/Thân của người kia không?
3. **Đồng Điệu Cung Phúc Đức & Tài Bạch**: Quan điểm sống, cách chi tiêu và nền tảng phúc khí khi gắn kết lâu dài.
4. **Tương Tác Tứ Hóa (Hóa Lộc · Hóa Quyền · Hóa Khoa · Hóa Kỵ)**: Ai là quý nhân trợ lực cho ai, điểm nào dễ nảy sinh hiểu lầm cần hóa giải?
5. **Lời Khuyên Đồng Hành Bền Vững**: Nguyên tắc ứng xử và phân công vai trò trong gia đình / sự nghiệp.`;

    const abortController = new AbortController();
    const stopHeartbeat = startSseHeartbeat(res);
    res.on('close', () => {
      stopHeartbeat();
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    let anyChunkSent = false;
    let interruptedEmitted = false;

    try {
      await keyPoolManager.executeStream({
        prompt,
        signal: abortController.signal,
        onMeta: (meta) => {
          sendSseJson(res, { meta });
        },
        onChunk: (text) => {
          anyChunkSent = true;
          sendSseText(res, text);
        },
        onInterrupted: (ev) => {
          interruptedEmitted = true;
          sendSseJson(res, {
            interrupted: true,
            message: ev.reason,
            errorCategory: ev.errorCategory,
            partialLength: ev.partialLength,
          });
        },
      });
    } catch (err) {
      if (!anyChunkSent) {
        sendSseText(res, buildLocalHemingServerFallback(chartA, chartB));
      } else if (!interruptedEmitted) {
        sendSseJson(res, {
          interrupted: true,
          message: err instanceof Error ? keyPoolManager.sanitize(err.message) : keyPoolManager.sanitize(err),
          errorCategory: 'NETWORK_OR_5XX',
        });
      }
    } finally {
      stopHeartbeat();
      if (!res.writableEnded) {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    const diag = keyPoolManager.getDiagnostics();
    console.log(
      `[Startup Diagnostic] GEMINI_API_KEY present: ${diag.envSecretPresent} (length: ${diag.geminiApiKeyLength}) | KeyPool total=${diag.totalKeys} ready=${diag.readyKeys} defaultModel=${diag.defaultModel} fallbackModel=${diag.fallbackModel}`,
    );
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
