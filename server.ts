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
  translatePalaceName,
  translateStarName,
  translateWuxingJu,
  VI_BRANCHES,
  VI_STEMS,
} from './src/lib/ziwei/vi-i18n.ts';
import type { ZiweiChart } from './src/lib/ziwei/types.ts';
import {
  buildYunxianPeriodContext,
  type YunxianPeriodContext,
} from './src/lib/ziwei/yunxian-context.ts';
import {
  buildChatFactTableForContextVi,
  buildDossierSectionFactSheetVi,
  isValidDossierSectionId,
  VALID_DOSSIER_SECTION_IDS,
  type DossierSectionId,
} from './src/lib/ziwei/dossier-context.ts';
import {
  sanitizeLayer3AOnly,
  verifyAndEnsureCompletePeriodSiHua,
} from './src/lib/ziwei/text-sanitizer.ts';
import { keyPoolManager } from './server/key-pool/index.ts';
import {
  PoolExhaustedError,
  type PoolFailureCategory,
  TpmGuardSkipError,
} from './server/key-pool/executor.ts';
import { KEY_POOL_BACKUP_MAX_BYTES } from './server/key-pool/types.ts';
import { initKnowledgeBase } from './server/knowledge-base/loader.ts';
import {
  retrieveKnowledgeForChat,
  retrieveKnowledgeForDossierSection,
  retrieveKnowledgeForPeriod,
} from './server/knowledge-base/retriever.ts';
import {
  shouldRetryForZeroCitations,
  verifyAcademicCitationsAndClaims,
} from './server/knowledge-base/verifier.ts';
import type {
  CitationAuditResult,
  KnowledgeRetrievalResult,
} from './server/knowledge-base/types.ts';
import { APP_VERSION } from './src/lib/app-version.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

const AUDIT_MAX_TEXT_LEN = 60_000;

const CITATION_RETRY_PROMPT_ADDENDUM =
  '\n\n[CHỈ THỊ SIẾT TRÍCH DẪN BẮT BUỘC — LẦN SINH LẠI]: Lần sinh trước chưa có mã `[Nguồn: <ID>]` hợp lệ nào từ [TƯ LIỆU HỌC THUẬT ĐỐI CHIẾU]. Lần này BẮT BUỘC toàn chương có ít nhất 1 thẻ `[Nguồn: <ID>]` hợp lệ nằm trong danh sách đã nạp ngay cuối câu viện dẫn (ưu tiên mỗi cung có mục khớp điều kiện); không gắn gượng khi điều kiện không khớp lá số, chỉ miễn nếu thật sự 0 mục nào khớp và ghi rõ luận thuần túy từ dữ kiện tinh đẩu.';

function resolvePeriodSectionId(
  periodContext?: YunxianPeriodContext | null,
): 'year_2026' | 'year_2027' | undefined {
  if (!periodContext || periodContext.mode !== 'liunian') return undefined;
  if (
    periodContext.periodId === 'liunian_2026' ||
    periodContext.cacheKey?.endsWith('__liunian_2026') ||
    periodContext.cacheKey === 'liunian_2026'
  ) {
    return 'year_2026';
  }
  if (
    periodContext.periodId === 'liunian_2027' ||
    periodContext.cacheKey?.endsWith('__liunian_2027') ||
    periodContext.cacheKey === 'liunian_2027'
  ) {
    return 'year_2027';
  }
  return undefined;
}

function computePeriodSiHuaAddendum(
  text: string,
  periodContext: YunxianPeriodContext,
): { addendumText: string; textWithSiHua: string } {
  if (!Array.isArray(periodContext.periodSiHua) || periodContext.periodSiHua.length === 0) {
    return { addendumText: '', textWithSiHua: text };
  }
  const siHuaCheck = verifyAndEnsureCompletePeriodSiHua(text, periodContext);
  if (siHuaCheck.isComplete) {
    return { addendumText: '', textWithSiHua: text };
  }
  const marker = '> 📌 **[Tổng Hợp Đầy Đủ Tứ Hóa Kỳ Hạn Theo Lá Số]**';
  const markerIdx = siHuaCheck.patchedText.indexOf(marker);
  if (markerIdx < 0) {
    return { addendumText: '', textWithSiHua: text };
  }
  const addendumBlock = siHuaCheck.patchedText.slice(markerIdx);
  const leadingSep = text.endsWith('\n\n') ? '' : text.endsWith('\n') ? '\n' : '\n\n';
  const addendumText = `${leadingSep}${addendumBlock}`;
  return { addendumText, textWithSiHua: `${text}${addendumText}` };
}

function logScrubbedCitationWarn(
  endpointTag: string,
  sectionIdLabel: string,
  audit: CitationAuditResult,
  rawLength: number,
): void {
  if (audit.scrubbedInvalidIds.length === 0) return;
  console.warn(
    `[${endpointTag}] Scrubbed invalid/mismatched citations:`,
    JSON.stringify({
      sectionId: sectionIdLabel,
      scrubbedInvalidIds: audit.scrubbedInvalidIds,
      rawLength,
      validCitationCount: audit.validCitationIds.length,
    }),
  );
}

function buildPalaceGanZhiMap(chart: ZiweiChart): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of chart.palaces) {
    const palaceVi = translatePalaceName(p.name);
    const stemVi = VI_STEMS[p.stem] ?? '';
    const branchVi = VI_BRANCHES[p.branch] ?? '';
    if (palaceVi && stemVi && branchVi) {
      map[palaceVi] = `${stemVi} ${branchVi}`;
    }
  }
  return map;
}

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
  const safeText = sanitizeLayer3AOnly(text);
  if (!safeText) return;
  sendSseJson(res, { delta: { text: safeText } });
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

export interface StructuredStreamErrorPayload {
  httpStatus: number;
  error: 'AI_NOT_CONFIGURED' | 'AI_POOL_EXHAUSTED' | 'TPM_GUARD_SKIP' | 'AI_CALL_FAILED';
  errorCategory: PoolFailureCategory | 'FIRST_CHUNK_TIMEOUT';
  minRemainingCooldownSec: number | null;
  message: string;
}

export function buildStructuredStreamErrorPayload(
  err: unknown,
): StructuredStreamErrorPayload {
  if (err instanceof PoolExhaustedError) {
    return {
      httpStatus: 503,
      error: err.code,
      errorCategory: err.errorCategory,
      minRemainingCooldownSec: err.minRemainingCooldownSec,
      message: keyPoolManager.sanitize(err.message).replace(/^Error:\s*/i, ''),
    };
  }
  if (err instanceof TpmGuardSkipError) {
    return {
      httpStatus: 429,
      error: err.code,
      errorCategory: err.errorCategory,
      minRemainingCooldownSec: err.minRemainingCooldownSec,
      message: keyPoolManager.sanitize(err.message).replace(/^Error:\s*/i, ''),
    };
  }

  const safeDetail = keyPoolManager.sanitize(err);
  const rawClientMsg =
    err instanceof Error ? keyPoolManager.sanitize(err.message) : safeDetail;
  const clientMessage = rawClientMsg.replace(/^Error:\s*/i, '');

  if (clientMessage.includes('TPM_GUARD_SKIP')) {
    return {
      httpStatus: 429,
      error: 'TPM_GUARD_SKIP',
      errorCategory: 'TPM_GUARD_SKIP',
      minRemainingCooldownSec: null,
      message: clientMessage,
    };
  }
  if (clientMessage.includes('FIRST_CHUNK_TIMEOUT')) {
    return {
      httpStatus: 503,
      error: 'AI_CALL_FAILED',
      errorCategory: 'FIRST_CHUNK_TIMEOUT',
      minRemainingCooldownSec: null,
      message: clientMessage,
    };
  }

  const classified = keyPoolManager.classifyError(err);
  return {
    httpStatus: 503,
    error: 'AI_CALL_FAILED',
    errorCategory: classified.category,
    minRemainingCooldownSec: classified.retryDelaySec,
    message: clientMessage,
  };
}

function formatKnowledgeInjectionBlock(kb: KnowledgeRetrievalResult): string {
  const parts: string[] = [];
  if (kb.sanFangNoteVi) {
    parts.push(`Ghi chú vị trí sao theo Tam Phương Tứ Chính: ${kb.sanFangNoteVi}`);
  }
  if (kb.promptBlockMarkdown.trim()) {
    parts.push(
      `Danh sách mã thẻ nguồn được phép trích dẫn (nếu viện dẫn Nghê Hải Hạ / Thiên Kỷ / cổ thư, BẮT BUỘC gắn đúng mã \`[Nguồn: <ID>]\` tương ứng trong danh sách này; KHÔNG tự bịa ID ngoài danh sách):`,
    );
    parts.push(kb.promptBlockMarkdown.trim());
  } else {
    parts.push(
      'Không có mục trích đoạn học thuật cụ thể nào được nạp cho lượt này; tuyệt đối không gắn thẻ `[Nguồn: ...]` và không tự dẫn nguyên văn khẩu quyết hay gán cho Nghê Hải Hạ / cổ thư.',
    );
  }
  if (kb.coverageBoundaryNoteVi) {
    parts.push(`Ranh giới dữ liệu (Lớp 3): ${kb.coverageBoundaryNoteVi}`);
  }
  return parts.join('\n');
}

export function buildStrictPeriodAiPrompt(
  periodContext: YunxianPeriodContext,
  chartSummary: string,
  chart?: ZiweiChart | null,
): { systemInstruction: string; prompt: string; knowledgeResult: KnowledgeRetrievalResult } {
  const isDahan = periodContext.mode === 'dahan';
  const periodTypeLabel = isDahan
    ? 'ĐẠI HẠN (Xu thế vận trình 10 năm)'
    : 'LƯU NIÊN (Biến chuyển & sự kiện trong 1 năm)';
  const knowledgeResult = retrieveKnowledgeForPeriod(chart ?? null, periodContext);

  const systemInstruction = `Bạn là chuyên gia luận giải Tử Vi Đẩu Số theo hệ thống Thiên Kỷ (Nghê Hải Hạ) và Tử Vi Đẩu Số Toàn Thư.
QUY TẮC RÀO CHỐNG BỊA & CHUẨN MỰC THUẬT NGỮ (BẮT BUỘC TUÂN THỦ 100%):
1. CHỈ ĐƯỢC phép luận giải dựa trên các dữ kiện có trong [BẢNG DỮ KIỆN KỲ HẠN XÁC ĐỊNH], [TRÍCH ĐOẠN TRI THỨC LIÊN QUAN], [TƯ LIỆU HỌC THUẬT ĐỐI CHIẾU] và [TÓM TẮT LÁ SỐ BẢN MỆNH] được gửi kèm.
2. TUYỆT ĐỐI CẤM tự bịa thêm sao, cấm tự đổi cung vị của sao, cấm tự gán Tứ Hóa (Hóa Lộc, Hóa Quyền, Hóa Khoa, Hóa Kỵ) hoặc Sao Lưu không có trong Bảng dữ kiện.
3. KỶ LUẬT PHÂN TẦNG TỨ HÓA & NHÃN CUNG KỲ HẠN:
   - Giữ NGUYÊN tiền tố 4 tầng Tứ Hóa đúng như Bảng dữ kiện: [Tứ Hóa Bản Mệnh], [Tứ Hóa Đại Hạn], [Tứ Hóa Lưu Niên ...], [Tự Hóa Can Cung ...]. Tuyệt đối không trộn lẫn tầng với nhau.
   - Khi bàn về bất kỳ cung nào có Lưu Tứ Hóa (hoặc Đại Hạn Tứ Hóa) tọa thủ HAY đối cung xung chiếu, BẮT BUỘC phải gọi đúng nhãn vai trò kỳ hạn từ Bảng dữ kiện ("Cung Lưu <Tên Cung>" đối với Lưu Niên, hoặc "Cung Đại Hạn <Tên Cung>" đối với Đại Hạn) cho CẢ cung tọa thủ lẫn đối cung xung chiếu, kèm tên cung Bản Mệnh gốc trùng vào đó; tuyệt đối không tự suy vai trò và TUYỆT ĐỐI CẤM lược bỏ chữ "Lưu" (như viết "tam hợp Tài Bạch (trùng Mệnh Cung)" gây nhầm với Tài Bạch gốc).
   - Đọc trực tiếp tọa độ sao, Cát/Sát tinh và vai trò Lưu/Đại Hạn từ mục [Tam Phương Tứ Chính & Điểm Xung Chiếu Của Kỳ Hạn (Tra Cứu Cố Định — Không Tự Nhẩm Địa Chi)], không tự nhẩm lại cung tam hợp hay đối cung.
   - BẮT BUỘC phải nhắc và phân tích ĐỦ CẢ 4 SAO TỨ HÓA CỦA KỲ HẠN (Hóa Lộc, Hóa Quyền, Hóa Khoa, Hóa Kỵ — nêu rõ tên sao + loại hóa + cung kỳ hạn tọa thủ + đối cung xung chiếu), tuyệt đối không được bỏ sót bất kỳ hóa nào.
4. Phân biệt rõ tính chất kỳ hạn:
    - Nếu là ĐẠI HẠN (10 năm): luận giải như xu thế nền tảng, môi trường phát triển và trọng tâm chuyển dịch trong suốt thập kỷ.
    - Nếu là LƯU NIÊN (1 năm): luận giải như sự kiện cụ thể, biến chuyển và điểm ứng kỳ trong năm đó (đặt trong bối cảnh Đại Hạn gốc).
    - Chương LƯU NIÊN: viết 900–1.300 từ cho thân bài (không tính tiêu đề, dòng dữ kiện Tứ Hóa, khối tham chiếu); dừng luận giải khi đủ ý, không kéo dài thêm; phân tích đủ Tam Phương Tứ Chính của Lưu Mệnh và Đại Hạn gốc hiện hành.
    - Mỗi dòng Lưu Tứ Hóa BẮT BUỘC nêu đủ **tên Hóa + tên sao + độ sáng** (ví dụ: "Lưu Hóa Khoa → Sao Văn Xương [Miếu]"); mỗi lần nêu sao lưu (Lưu Lộc Tồn, Lưu Thiên Mã, Lưu Văn Xương, Lưu Văn Khúc…) BẮT BUỘC kèm tên cung Bản Mệnh gốc trong ngoặc.
    - Không tự gọi riêng lẻ Địa Không, hoặc cặp Địa Không + Thiên Không, là 'Không Kiếp' nếu Địa Kiếp không đồng cung hoặc không nằm trong Tam Phương Tứ Chính của cung đang luận — 'Không Kiếp' chỉ cặp Địa Không + Địa Kiếp.
5. KỶ LUẬT TRÍCH DẪN NGUỒN HỌC THUẬT (LỚP 1 & LỚP 3):
   - Khi sử dụng luận điểm từ [TƯ LIỆU HỌC THUẬT ĐỐI CHIẾU] hoặc nhắc tới Nghê Hải Hạ / Thiên Kỷ / cổ thư, BẮT BUỘC gắn đúng mã \`[Nguồn: <ID>]\` có trong danh sách đã nạp ngay cuối câu có viện dẫn hoặc trích dẫn đó (ví dụ: \`[Nguồn: NH-SIHUA-001]\`).
   - TUYỆT ĐỐI KHÔNG tự bịa mã thẻ nguồn hoặc gán khẩu quyết ngoài danh sách.
   - Khi bảng đối chiếu không rỗng, BẮT BUỘC toàn chương ≥ 1 thẻ \`[Nguồn: <ID>]\` hợp lệ (ưu tiên từng mục có dữ kiện khớp); chỉ gắn khi khớp điều kiện lá số (không gán Nữ mệnh cho Nam hay Hóa Kỵ xung Mệnh khi thiếu), nếu 0 mục khớp thì ghi rõ luận thuần túy từ dữ kiện tinh đẩu.
6. Viết hoàn toàn bằng tiếng Việt chuẩn mực (không dùng chữ Hán, giữ khoảng cách từ đúng chính tả như "căng độ", "kho lúa", "bảo thủ"; giữ nguyên trụ Can Chi hợp lệ như "Canh Thìn", "Canh Dần"), tuyệt đối không mở đầu chương bằng câu dẫn nhập kiểu "Dưới đây là phần luận giải chi tiết cho kỳ hạn …" — vào thẳng đề mục \`### 1. …\`, trình bày bằng Markdown theo đúng 4 đề mục:
   ### 1. Chủ Đề Kỳ Hạn (${isDahan ? 'Xu Thế 10 Năm' : 'Sự Kiện Trong Năm'})
   ### 2. Điểm Cát & Động Lực Thuận Lợi
   ### 3. Điểm Hung & Trục Xung Chiếu Cần Lưu Ý
   ### 4. Lời Khuyên Hành Động
7. Cuối bài BẮT BUỘC ghi rõ dòng chữ: "*Lưu ý: Nội dung tham khảo phục vụ nghiên cứu mệnh lý Tử Vi Đẩu Số.*"`;

  const excerpts = [
    ...(periodContext.knowledgeExcerpts.patterns.length > 0
      ? ['[Cách cục nhận diện từ lá số]:', ...periodContext.knowledgeExcerpts.patterns.map((x) => `- ${x}`)]
      : []),
    ...(periodContext.knowledgeExcerpts.starPrinciples.length > 0
      ? ['[Tính chất tinh diệu]:', ...periodContext.knowledgeExcerpts.starPrinciples.map((x) => `- ${x}`)]
      : []),
    ...(periodContext.knowledgeExcerpts.fuqiAndSihua.length > 0
      ? ['[Nguyên lý Tứ Hóa & Tinh hệ]:', ...periodContext.knowledgeExcerpts.fuqiAndSihua.map((x) => `- ${x}`)]
      : []),
  ].join('\n');

  const kbBlock = formatKnowledgeInjectionBlock(knowledgeResult);

  const prompt = `Hãy diễn giải kỳ hạn **${periodContext.periodTitleVi}** thuộc loại **${periodTypeLabel}** dựa tuyệt đối vào bảng dữ kiện xác định dưới đây:

=== 1. BẢNG DỮ KIỆN KỲ HẠN XÁC ĐỊNH ===
${periodContext.factTableMarkdown}

=== 2. TRÍCH ĐOẠN TRI THỨC LIÊN QUAN ===
${excerpts || 'Áp dụng nguyên lý Tam Phương Tứ Chính và Tứ Hóa kỳ hạn.'}

=== 3. TƯ LIỆU HỌC THUẬT ĐỐI CHIẾU ===
${kbBlock}

=== 4. TÓM TẮT LÁ SỐ BẢN MỆNH ===
${chartSummary}

Hãy trình bày bài luận giải tiếng Việt theo đúng 4 mục quy định và kết thúc bằng dòng lưu ý nội dung tham khảo.`;

  return { systemInstruction, prompt, knowledgeResult };
}

export const CHAT_MAX_QUESTION_LEN = 400;
export const CHAT_MAX_EXCERPT_LEN = 6_000;
export const CHAT_MAX_HISTORY_MESSAGES = 6;
export const CHAT_MAX_HISTORY_MSG_LEN = 1_200;

export interface ExplanationChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface InterpretDossierSectionBody {
  chart?: ZiweiChart;
  sectionId?: string;
}

export interface InterpretChatBody {
  chart?: ZiweiChart;
  chartB?: ZiweiChart | null;
  contextMode?: 'natal' | 'period' | 'heming';
  sectionTitle?: string;
  periodContext?: YunxianPeriodContext | null;
  excerpt?: string;
  history?: unknown[];
  question?: string;
}

export function validateDossierSectionInput(body: InterpretDossierSectionBody | undefined):
  | { ok: true; chart: ZiweiChart; sectionId: DossierSectionId }
  | { ok: false; message: string } {
  if (!body || !body.chart || !Array.isArray(body.chart.palaces) || body.chart.palaces.length !== 12) {
    return { ok: false, message: 'Thiếu dữ liệu lá số Tử Vi 12 cung hợp lệ.' };
  }
  if (!isValidDossierSectionId(body.sectionId)) {
    return {
      ok: false,
      message: `sectionId không hợp lệ. Chỉ chấp nhận: ${VALID_DOSSIER_SECTION_IDS.join(', ')}.`,
    };
  }
  return { ok: true, chart: body.chart, sectionId: body.sectionId };
}

export function sanitizeChatHistoryAndExcerpt(raw: {
  excerpt?: unknown;
  history?: unknown[];
}): {
  excerpt: string;
  history: ExplanationChatHistoryItem[];
} {
  const rawExcerpt = typeof raw.excerpt === 'string' ? raw.excerpt.trim() : '';
  const excerpt =
    rawExcerpt.length > CHAT_MAX_EXCERPT_LEN
      ? rawExcerpt.slice(0, CHAT_MAX_EXCERPT_LEN)
      : rawExcerpt;

  const rawHistory = Array.isArray(raw.history) ? raw.history : [];
  const normalized: ExplanationChatHistoryItem[] = [];
  for (const item of rawHistory) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as { role?: unknown; content?: unknown };
    const role = obj.role === 'assistant' ? 'assistant' : obj.role === 'user' ? 'user' : null;
    if (!role || typeof obj.content !== 'string') continue;
    const trimmed = obj.content.trim();
    if (!trimmed) continue;
    normalized.push({
      role,
      content:
        trimmed.length > CHAT_MAX_HISTORY_MSG_LEN
          ? trimmed.slice(0, CHAT_MAX_HISTORY_MSG_LEN)
          : trimmed,
    });
  }

  return {
    excerpt,
    history: normalized.slice(-CHAT_MAX_HISTORY_MESSAGES),
  };
}

export function validateExplanationChatInput(body: InterpretChatBody | undefined):
  | {
      ok: true;
      chart: ZiweiChart;
      chartB: ZiweiChart | null;
      contextMode: 'natal' | 'period' | 'heming';
      sectionTitle: string;
      periodContext: YunxianPeriodContext | null;
      excerpt: string;
      history: ExplanationChatHistoryItem[];
      question: string;
    }
  | { ok: false; message: string } {
  if (!body || !body.chart || !Array.isArray(body.chart.palaces) || body.chart.palaces.length !== 12) {
    return { ok: false, message: 'Thiếu dữ liệu lá số Tử Vi 12 cung hợp lệ.' };
  }
  if (typeof body.question !== 'string') {
    return { ok: false, message: 'Thiếu nội dung câu hỏi.' };
  }
  const trimmedQuestion = body.question.trim();
  if (!trimmedQuestion) {
    return { ok: false, message: 'Câu hỏi không được để trống.' };
  }
  if (trimmedQuestion.length > CHAT_MAX_QUESTION_LEN) {
    return {
      ok: false,
      message: `Câu hỏi vượt quá giới hạn tối đa ${CHAT_MAX_QUESTION_LEN} ký tự (${trimmedQuestion.length}/${CHAT_MAX_QUESTION_LEN}).`,
    };
  }

  const contextMode: 'natal' | 'period' | 'heming' =
    body.contextMode === 'period' || body.contextMode === 'heming' ? body.contextMode : 'natal';
  const { excerpt, history } = sanitizeChatHistoryAndExcerpt({
    excerpt: body.excerpt,
    history: body.history,
  });

  return {
    ok: true,
    chart: body.chart,
    chartB: body.chartB && Array.isArray(body.chartB.palaces) ? body.chartB : null,
    contextMode,
    sectionTitle:
      typeof body.sectionTitle === 'string' && body.sectionTitle.trim()
        ? body.sectionTitle.trim().slice(0, 200)
        : 'Luận giải lá số Tử Vi',
    periodContext: body.periodContext ?? null,
    excerpt,
    history,
    question: trimmedQuestion,
  };
}

export function buildStrictDossierSectionPrompt(
  chart: ZiweiChart,
  sectionId: DossierSectionId,
): {
  systemInstruction: string;
  prompt: string;
  titleVi: string;
  knowledgeResult: KnowledgeRetrievalResult;
} {
  const sectionCtx = buildDossierSectionFactSheetVi(chart, sectionId);
  const chartSummary = formatChartSummaryVi(chart);
  const knowledgeResult = retrieveKnowledgeForDossierSection(chart, sectionId);

  const isPalaceGroup =
    sectionId === 'palaces_core' ||
    sectionId === 'palaces_family' ||
    sectionId === 'palaces_social_health';
  const isHorizon = sectionId === 'horizon_5y' || sectionId === 'horizon_10y';

  const familyGenderRule =
    sectionId === 'palaces_family'
      ? `\n   - Khi luận cung Phu Thê và các sao phối ngẫu, căn cứ trường Đương số trong Bảng dữ kiện: đương số nam thì không dùng khuôn diễn đạt dành cho nữ và ngược lại.`
      : '';

  const sectionRules = isPalaceGroup
    ? `4. ĐỊNH DẠNG & SÀN ĐỘ DÀI BẮT BUỘC CHO NHÓM 4 CUNG:
   - Phải viết đầy đủ 4 đề mục Markdown \`### Cung <Tên Cung> (<Can Chi>)\` tách biệt cho cả 4 cung: ${(sectionCtx.palaceNamesVi ?? []).join(', ')}. KHÔNG được gộp sơ sài hay bỏ sót bất kỳ cung nào.
   - Lưu ý: tiêu đề mục cung (gồm cả nhãn [AN MỆNH]/[AN THÂN]/[Đại hạn X–Y tuổi]) sẽ được app chuẩn hóa hậu kiểm tự động theo dữ kiện lá số; AI giữ đúng mẫu \`### Cung <Tên Cung> (<Can Chi>)\` và tập trung viết thân bài thật sâu sắc cho từng cung.
   - Mỗi cung BẮT BUỘC đạt độ sâu phân tích **250–350 từ MỖI cung** (tổng toàn chương **1,000–1,400 từ**).
   - Trong mỗi cung: phân tích Chính tinh + độ sáng (hoặc Vô chính diệu mượn đối cung), Cát tinh/Sát tinh đi kèm, Tam Phương Tứ Chính (đối cung + 2 cung tam hợp), Tứ Hóa theo đúng tiền tố tầng và Tự Hóa/Phi Tinh (nếu có), cùng lời khuyên thực tiễn.
    - Khi nhắc Tứ Hóa Đại Hạn của một kỳ tuổi, chỉ dùng Can và bộ sao của đúng kỳ đó theo dòng [Tứ Hóa Đại Hạn Kỳ ...] của cung tương ứng. Thẻ [Tứ Hóa Đại Hạn HIỆN TẠI ...] chỉ áp dụng cho kỳ hiện tại; không gán Can của kỳ hiện tại cho các kỳ quá khứ hay tương lai.
    - Trong mỗi cung thuộc Chương 2, 3, 4, BẮT BUỘC phân tích dòng \`[Tứ Hóa Đại Hạn Kỳ X–Y]\` gắn với đại hạn đóng tại cung đó (nêu rõ kỳ tuổi, Thiên Can và đủ 4 hóa Lộc/Quyền/Khoa/Kỵ), bên cạnh \`[Phi Tinh Can Cung ...]\`.${familyGenderRule}`
    : isHorizon
      ? `4. QUY TẮC TỐI THƯỢNG CHO PHÂN TÍCH ĐA NĂM & ĐỘ DÀI (BẮT BUỘC):
   - Độ dài mục tiêu toàn chương: **750–1,100 từ**.
   - Với mỗi năm trong Ma Trận, BẠN CHỈ ĐƯỢC PHÉP trích dẫn Năm, Tuổi, Can Chi, Đại Hạn chủ quản, Quan hệ Đại Hạn–Lưu Niên, Cung Bản Mệnh kích hoạt, đủ cả 4 sao Lưu Tứ Hóa (Hóa Lộc, Hóa Quyền, Hóa Khoa, Hóa Kỵ) kèm nhãn "Cung Lưu <Tên Cung>" (cả tọa thủ lẫn đối cung xung chiếu), các Sao Lưu và Cờ xung hợp đã in TRỰC TIẾP trong bảng Ma Trận.
   - Khi liệt kê 4 sao Lưu Tứ Hóa của từng năm, BẮT BUỘC theo đúng mẫu: \`{Sao} Hóa {X} tại Cung Lưu {A} [trùng {B}] (xung Cung Lưu {C} [trùng {D}])\` — không được lược đối cung xung chiếu.
   - TUYỆT ĐỐI CẤM tự tính nhẩm hoặc bịa thêm bất kỳ sao lưu niên, cung hạn hay năm nào nằm ngoài bảng Ma Trận.
   - Nếu một năm được ghi **"chưa vào Đại Hạn"**, PHẢI nêu rõ đương số chưa vào Đại Hạn ở năm đó và tuyệt đối không tự bịa cung Đại Hạn hay Tứ Hóa Đại Hạn.
   - Chỉ gắn thẻ \`[Nguồn: ...]\` vào đoạn bình giải lý thuyết tương ứng với chủ đề của thẻ; không gắn thẻ Tứ Hóa chuyên đề đơn lẻ vào câu liệt kê danh sách 4 sao Tứ Hóa Đại Hạn.
   - Tuyệt đối không mở đầu bằng câu dẫn nhập và không lặp lại tên chương ở đầu bài; sử dụng thống nhất cấp tiêu đề \`### 1.\`, \`### 2.\`, \`### 3.\`, \`### 4.\` cho các phần chính.
   - Trình bày rõ: Tổng quan chuyển dịch & mốc chuyển Đại Hạn → Phân tích nhịp từng năm dựa trên Ma Trận (xét đủ 4 Lưu Tứ Hóa) → Điểm rơi cơ hội/rủi ro nổi bật → Chiến lược hành động.`
      : `4. ĐỊNH DẠNG & ĐỘ DÀI BẮT BUỘC CHO CHƯƠNG TỔNG QUAN:
   - Độ dài mục tiêu toàn chương: **750–1,100 từ**.
   - Trình bày theo 4 đề mục Markdown rõ ràng:
     ### 1. Bức Tranh Bản Mệnh & Thân Cư (Ngũ Hành Cục · Âm Dương · Chính Tinh)
     ### 2. Cách Cục Tiên Thiên & Trục Tam Phương Tứ Chính (Mệnh – Tài – Quan – Di)
     ### 3. Dòng Chảy Tứ Hóa Bản Mệnh & Ngữ Cảnh Đại Hạn Hiện Tại
     ### 4. Trục Thế Mạnh Cốt Lõi & Nguyên Tắc Tu Dưỡng Dài Hạn`;

  const systemInstruction = `Bạn là chuyên gia luận giải Tử Vi Đẩu Số theo hệ thống Thiên Kỷ (Nghê Hải Hạ) và Tử Vi Đẩu Số Toàn Thư.
QUY TẮC RÀO CHỐNG BỊA (BẮT BUỘC TUÂN THỦ 100%):
1. CHỈ ĐƯỢC phép luận giải dựa trên [DỮ KIỆN CHUYÊN BIỆT CỦA CHƯƠNG], [TƯ LIỆU HỌC THUẬT ĐỐI CHIẾU] và [TÓM TẮT LÁ SỐ BẢN MỆNH] được cung cấp.
2. TUYỆT ĐỐI CẤM tự bịa thêm sao, cấm đổi cung vị của sao, cấm tự gán Tứ Hóa không có trong dữ kiện. Không tự gọi riêng lẻ Địa Không, hoặc cặp Địa Không + Thiên Không, là 'Không Kiếp' nếu Địa Kiếp không đồng cung hoặc không nằm trong Tam Phương Tứ Chính của cung đang luận — 'Không Kiếp' chỉ cặp Địa Không + Địa Kiếp.
3. Khi nhắc đến Tứ Hóa, PHẢI giữ rõ tầng theo đúng tiền tố: [Tứ Hóa Bản Mệnh], [Tứ Hóa Đại Hạn], [Tứ Hóa Lưu Niên ...], [Tự Hóa Can Cung ...]. Tuyệt đối không trộn lẫn tầng với nhau.
${sectionRules}
5. KỶ LUẬT TRÍCH DẪN NGUỒN HỌC THUẬT (LỚP 1 & LỚP 3):
   - Khi áp dụng luận điểm từ [TƯ LIỆU HỌC THUẬT ĐỐI CHIẾU] hoặc nhắc tên trường phái / tác giả / cổ thư, BẮT BUỘC gắn đúng mã \`[Nguồn: <ID>]\` nằm trong danh sách đã nạp ngay cuối câu có viện dẫn hoặc trích dẫn đó.
   - TUYỆT ĐỐI KHÔNG tự bịa mã thẻ nguồn hoặc trích nguyên văn khẩu quyết ngoài danh sách.
   - Khi bảng đối chiếu không rỗng, BẮT BUỘC toàn chương ≥ 1 thẻ \`[Nguồn: <ID>]\` hợp lệ (ưu tiên mỗi cung có mục khớp); chỉ gắn khi khớp điều kiện (không gán Nữ mệnh cho Nam hay Hóa Kỵ xung Mệnh khi thiếu), nếu 0 mục khớp thì ghi rõ luận thuần túy từ dữ kiện tinh đẩu.
6. Viết hoàn toàn bằng tiếng Việt chuẩn mực (không dùng chữ Hán, giữ khoảng cách từ đúng chính tả như "căng độ", viết "kho lúa", "bảo thủ"). Tuân thủ thuật ngữ Can Chi: "Canh Thìn", "Canh Dần" là trụ Can Chi hợp lệ — viết hoa chuẩn xác, TUYỆT ĐỐI KHÔNG viết dạng thường hóa sai quy chuẩn như "canh Thìn" / "canh Dần" hay gọi Địa Chi (Tý, Sửu, Dần, Mão, Thìn...) là "can"; dùng đúng "Thiên Can <Can>" hoặc "cung <Tên Cung> (<Can Chi đầy đủ>)".
7. Cuối bài BẮT BUỘC ghi dòng: "*Lưu ý: Nội dung tham khảo phục vụ nghiên cứu mệnh lý Tử Vi Đẩu Số.*"`;

  const kbBlock = formatKnowledgeInjectionBlock(knowledgeResult);

  const prompt = `Hãy viết chuyên sâu phần **${sectionCtx.titleVi}** cho lá số sau, tuân thủ tuyệt đối bảng dữ kiện xác định và sàn độ dài đã quy định:

=== 1. DỮ KIỆN CHUYÊN BIỆT CỦA CHƯƠNG (${sectionId}) ===
${sectionCtx.factSheetMarkdown}

=== 2. TƯ LIỆU HỌC THUẬT ĐỐI CHIẾU ===
${kbBlock}

=== 3. TÓM TẮT TOÀN LÁ SỐ BẢN MỆNH ===
${chartSummary}

Hãy triển khai bài luận giải đầy đủ, đúng đề mục, chuẩn xác tinh đẩu và kết thúc bằng dòng lưu ý tham khảo.`;

  return { systemInstruction, prompt, titleVi: sectionCtx.titleVi, knowledgeResult };
}

export function buildStrictExplanationChatPrompt(params: {
  chart: ZiweiChart;
  chartB?: ZiweiChart | null;
  contextMode: 'natal' | 'period' | 'heming';
  sectionTitle: string;
  periodContext?: YunxianPeriodContext | null;
  excerpt: string;
  history: ExplanationChatHistoryItem[];
  question: string;
}): { systemInstruction: string; prompt: string; knowledgeResult: KnowledgeRetrievalResult } {
  const factTable = buildChatFactTableForContextVi(params.chart, {
    contextMode: params.contextMode,
    periodContext: params.periodContext,
    chartB: params.chartB,
    includeHorizonStart: 2026,
    includeHorizonEnd: 2035,
  });
  const knowledgeResult = retrieveKnowledgeForChat({
    chart: params.chart,
    chartB: params.chartB,
    contextMode: params.contextMode,
    sectionTitle: params.sectionTitle,
    periodContext: params.periodContext,
    question: params.question,
  });

  const systemInstruction = `Bạn là chuyên gia Tử Vi Đẩu Số hệ thống Thiên Kỷ (Nghê Hải Hạ), đang giải đáp trực tiếp thắc mắc của đương số dựa trên phần luận giải đang mở.
QUY TẮC CHỐNG ẢO GIÁC & GIỚI HẠN TRẢ LỜI (BẮT BUỘC 100%):
1. CHỈ ĐƯỢC phép trả lời dựa trên [BẢNG DỮ KIỆN LÁ SỐ XÁC ĐỊNH], [TƯ LIỆU HỌC THUẬT ĐỐI CHIẾU], [ĐOẠN TRÍCH LUẬN GIẢI ĐANG XEM] và [LỊCH SỬ HỎI ĐÁP GẦN NHẤT] được gửi kèm.
2. TUYỆT ĐỐI CẤM bịa thêm sao, cấm tự tính nhẩm sao Lưu Niên của năm ngoài phạm vi Ma Trận 2026–2035, cấm thay đổi cung vị hoặc tự gán Tứ Hóa không có trong dữ kiện.
3. Đối chiếu tên sao theo ĐÚNG NGUYÊN VĂN trong [BẢNG DỮ KIỆN LÁ SỐ XÁC ĐỊNH], cảnh giác các sao gần giống tên nhau (ví dụ: Giải Thần, Niên Giải và Thiên Giải là 3 sao hoàn toàn khác nhau — chỉ được nói về sao có tên khớp chính xác trong dữ kiện).
4. Nếu người dùng nêu một sao hoặc tổ hợp sao KHÔNG xuất hiện trong [BẢNG DỮ KIỆN LÁ SỐ XÁC ĐỊNH] (kể cả sao mượn Vô Chính Diệu và Tam Phương Tứ Chính), PHẢI nói rõ sao đó KHÔNG CÓ trong lá số/dữ kiện hiện có và DỪNG Ở ĐÓ; TUYỆT ĐỐI KHÔNG tự gán sao đó sang cung khác hay khẳng định vị trí thay thế.
5. Khi trích dẫn Tứ Hóa, LUÔN nêu rõ tầng ([Tứ Hóa Bản Mệnh], [Tứ Hóa Đại Hạn], hay [Tứ Hóa Lưu Niên YYYY]).
6. Nếu câu hỏi đề cập tới thông tin KHÔNG CÓ CƠ SỞ trong dữ kiện lá số, tư liệu đối chiếu hoặc đoạn luận giải (ví dụ dữ kiện đời tư ngoài lá số, chủ đề phong thủy/bói dịch/đơn thuốc ngoài Tử Vi, hoặc năm ngoài bảng Ma Trận đã truyền), phải trả lời TRUNG THỰC rằng dữ kiện hiện có không đủ căn cứ cho chi tiết đó, chỉ phân tích trong phạm vi tinh đẩu đã xác định.
7. KỶ LUẬT TRÍCH DẪN NGUỒN (LỚP 1): Nếu áp dụng luận điểm từ [TƯ LIỆU HỌC THUẬT ĐỐI CHIẾU] hoặc nhắc tên tác giả/cổ thư, gắn đúng mã \`[Nguồn: <ID>]\` có trong danh sách đã nạp; không tự bịa mã thẻ nguồn hoặc gán khẩu quyết ngoài danh sách.
8. Đi thẳng vào trọng tâm câu hỏi, độ dài mục tiêu **150–350 từ** bằng tiếng Việt chuẩn mực (không chữ Hán), theo 3 ý ngắn gọn (nếu sao được hỏi không có trong dữ kiện theo mục 4 thì chỉ cần xác nhận rõ không có và dừng ngay phần đó, không suy diễn kéo dài):
   - **Căn cứ tinh đẩu & Tứ Hóa**: (nêu đích danh cung, sao, Tứ Hóa liên quan)
   - **Giải đáp trực diện**: (trả lời thẳng câu hỏi)
   - **Gợi ý ứng xử thực tế**: (1–2 hành động cụ thể)`;

  const historyBlock =
    params.history.length > 0
      ? params.history
          .map((m) => `- ${m.role === 'user' ? 'Người hỏi' : 'Chuyên gia'}: ${m.content}`)
          .join('\n')
      : 'Chưa có lượt hỏi trước đó trong mạch này.';

  const kbBlock = formatKnowledgeInjectionBlock(knowledgeResult);

  const prompt = `Ngữ cảnh đang mở: **${params.sectionTitle}** (Chế độ: ${params.contextMode}).

=== 1. BẢNG DỮ KIỆN LÁ SỐ XÁC ĐỊNH ===
${factTable}

=== 2. TƯ LIỆU HỌC THUẬT ĐỐI CHIẾU ===
${kbBlock}

=== 3. ĐOẠN TRÍCH LUẬN GIẢI ĐANG XEM ===
${params.excerpt || '(Người dùng đang hỏi trực tiếp trên dữ kiện lá số.)'}

=== 4. LỊCH SỬ HỎI ĐÁP GẦN NHẤT ===
${historyBlock}

=== 5. CÂU HỎI MỚI CỦA NGƯỜI DÙNG ===
"${params.question}"

Hãy trả lời trực diện, chuẩn xác theo đúng dữ kiện xác định và trong khoảng 150–350 từ.`;

  return { systemInstruction, prompt, knowledgeResult };
}

export function registerApiRoutes(app: express.Express) {
  app.use(express.json({ limit: '512kb' }));

  // GET /api/ai-diagnostics — Chẩn đoán an toàn toàn pool (KHÔNG bao giờ lộ giá trị key)
  app.get('/api/ai-diagnostics', (_req, res) => {
    res.json(keyPoolManager.getDiagnostics());
  });

  // ─── NHÓM ROUTE QUẢN LÝ KHO KHÓA GEMINI (/api/key-pool/*) ───────────────────

  app.get('/api/key-pool', (req, res) => {
    const sec = getRequestSecurityContext(req);
    res.setHeader('Cache-Control', 'no-store');
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
      const requestedModel =
        typeof req.body?.model === 'string' && req.body.model.trim()
          ? req.body.model.trim()
          : undefined;
      const result = await keyPoolManager.testKey(
        req.params.id,
        requestedModel ? { model: requestedModel } : undefined,
      );
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
      const status = msg.includes('Không tìm thấy')
        ? 404
        : msg.includes('không hợp lệ')
          ? 400
          : 429;
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

  app.post('/api/key-pool/backup/export', (req, res) => {
    if (!requireKeyPoolWriteAccess(req, res)) return;
    res.setHeader('Cache-Control', 'no-store');
    try {
      const { passphrase } = (req.body ?? {}) as { passphrase?: unknown };
      const envelope = keyPoolManager.exportEncryptedBackup(passphrase as string);
      res.json({
        backup: envelope,
        exportedAt: envelope.exportedAt,
      });
    } catch (err) {
      res.status(400).json({
        error: 'BACKUP_EXPORT_FAILED',
        message: keyPoolManager.sanitize(err),
      });
    }
  });

  app.post('/api/key-pool/backup/import', (req, res) => {
    if (!requireKeyPoolWriteAccess(req, res)) return;
    res.setHeader('Cache-Control', 'no-store');
    try {
      const { backup, passphrase } = (req.body ?? {}) as {
        backup?: unknown;
        passphrase?: unknown;
      };
      if (backup === undefined || backup === null) {
        res.status(400).json({
          error: 'INVALID_INPUT',
          message: 'Thiếu dữ liệu tệp sao lưu Kho Khóa.',
        });
        return;
      }
      const backupBytes = Buffer.byteLength(JSON.stringify(backup), 'utf8');
      if (backupBytes > KEY_POOL_BACKUP_MAX_BYTES) {
        res.status(413).json({
          error: 'PAYLOAD_TOO_LARGE',
          message: 'Gói sao lưu vượt quá giới hạn tối đa 256 KB.',
        });
        return;
      }

      const result = keyPoolManager.importEncryptedBackup(backup, passphrase as string);
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
      const status = msg.includes('256 KB') ? 413 : 400;
      res.status(status).json({
        error: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BACKUP_IMPORT_FAILED',
        message: msg,
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
    const { systemInstruction, prompt, knowledgeResult } = buildStrictPeriodAiPrompt(
      periodContext,
      chartSummary,
      chart,
    );

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

    let accumulatedText = '';
    let wasInterrupted = false;

    try {
      const finalMeta = await keyPoolManager.executeStream({
        prompt,
        systemInstruction,
        signal: abortController.signal,
        onSseKeepAliveRequired: ensureSseStarted,
        onMeta: (meta) => {
          ensureSseStarted();
          sendSseJson(res, { meta });
        },
        onChunk: (text) => {
          ensureSseStarted();
          const safeChunk = sanitizeLayer3AOnly(text);
          if (safeChunk) {
            accumulatedText += safeChunk;
          }
          sendSseText(res, text);
        },
        onInterrupted: (ev) => {
          wasInterrupted = true;
          ensureSseStarted();
          sendSseJson(res, {
            interrupted: true,
            message: ev.reason,
            errorCategory: ev.errorCategory,
            partialLength: ev.partialLength,
            minRemainingCooldownSec: ev.minRemainingCooldownSec ?? null,
          });
        },
      });
      let chosenMeta = finalMeta;
      if (!wasInterrupted && accumulatedText.trim() && sseStarted && !res.writableEnded) {
        const palaceGanZhiMap = buildPalaceGanZhiMap(chart);
        const periodSectionId = resolvePeriodSectionId(periodContext);
        const sectionLogLabel = periodSectionId ?? periodContext.periodId ?? 'period';
        const { addendumText: pass1Addendum, textWithSiHua: pass1TextWithSiHua } =
          computePeriodSiHuaAddendum(accumulatedText, periodContext);

        const firstAudit = verifyAcademicCitationsAndClaims(
          pass1TextWithSiHua,
          knowledgeResult.entries,
          {
            chart,
            sectionId: periodSectionId,
            chapterMode: 'period',
            periodContext,
            palaceGanZhiMap,
          },
        );

        let chosenAudit = firstAudit;
        let chosenBodyForSep = pass1TextWithSiHua;
        let pendingAddendumToStream = pass1Addendum;

        if (
          shouldRetryForZeroCitations({
            validCitationIds: firstAudit.validCitationIds,
            allowedEntriesCount: knowledgeResult.entries.length,
            chapterMode: 'period',
            wasInterrupted,
            alreadyRetried: false,
          }) &&
          !abortController.signal.aborted &&
          !res.writableEnded
        ) {
          sendSseJson(res, {
            retryingForCitations: true,
            message: 'Đang sinh lại 1 lần để bổ sung trích dẫn học thuật hợp lệ...',
          });

          let retryAccumulated = '';
          let retryInterrupted = false;
          let retryMeta = finalMeta;

          try {
            retryMeta = await keyPoolManager.executeStream({
              prompt: `${prompt}${CITATION_RETRY_PROMPT_ADDENDUM}`,
              systemInstruction,
              signal: abortController.signal,
              onMeta: (m) => {
                retryMeta = m;
              },
              onChunk: (text) => {
                const safeChunk = sanitizeLayer3AOnly(text);
                if (safeChunk) {
                  retryAccumulated += safeChunk;
                }
              },
              onInterrupted: () => {
                retryInterrupted = true;
              },
            });
          } catch (retryErr) {
            retryInterrupted = true;
            console.warn(
              `[interpret-period] Citation retry failed (${sectionLogLabel}):`,
              keyPoolManager.sanitize(retryErr instanceof Error ? retryErr.message : String(retryErr)).split(/\r?\n/)[0],
            );
          }

          let replacedWithRetry = false;
          if (!retryInterrupted && retryAccumulated.trim() && !res.writableEnded) {
            const { textWithSiHua: retryTextWithSiHua } = computePeriodSiHuaAddendum(
              retryAccumulated,
              periodContext,
            );
            const retryAudit = verifyAcademicCitationsAndClaims(
              retryTextWithSiHua,
              knowledgeResult.entries,
              {
                chart,
                sectionId: periodSectionId,
                chapterMode: 'period',
                periodContext,
                palaceGanZhiMap,
              },
            );
            if (retryAudit.validCitationIds.length > firstAudit.validCitationIds.length) {
              replacedWithRetry = true;
              chosenAudit = retryAudit;
              chosenMeta = retryMeta ?? finalMeta;
              chosenBodyForSep = retryTextWithSiHua;
              pendingAddendumToStream = '';
              sendSseJson(res, {
                replaceChapterText: retryTextWithSiHua,
                meta: chosenMeta,
                retryingForCitations: false,
              });
            }
          }

          if (!replacedWithRetry && !res.writableEnded) {
            sendSseJson(res, { retryingForCitations: false });
          }
        }

        if (pendingAddendumToStream && !res.writableEnded) {
          sendSseText(res, pendingAddendumToStream);
        }

        logScrubbedCitationWarn(
          'interpret-period',
          sectionLogLabel,
          chosenAudit,
          chosenBodyForSep.length,
        );

        const criticalFlags = chosenAudit.auditFlags.filter(
          (f) => f.severity === 'critical',
        );
        if (criticalFlags.length > 0) {
          console.warn(
            `[interpret-period] KP-3 critical flags (${criticalFlags.length}):`,
            JSON.stringify(criticalFlags),
          );
        }
        sendSseJson(res, {
          citationAudit: {
            validIds: chosenAudit.validCitationIds,
            scrubbedInvalidIds: chosenAudit.scrubbedInvalidIds,
            normalizedBareIds: chosenAudit.normalizedBareIds,
            hasUncitedClaims: chosenAudit.hasUncitedClaims,
            palaceGanZhiMismatches: chosenAudit.palaceGanZhiMismatches,
            auditFlags: chosenAudit.auditFlags,
          },
        });
        const tailBlock = [
          chosenAudit.referenceBlockMarkdown,
          chosenAudit.warningBlockMarkdown,
        ]
          .filter(Boolean)
          .join('\n\n');
        if (tailBlock && !res.writableEnded) {
          const leadingSep = chosenBodyForSep.endsWith('\n\n')
            ? ''
            : chosenBodyForSep.endsWith('\n')
              ? '\n'
              : '\n\n';
          sendSseText(res, `${leadingSep}${tailBlock}`);
        }
      }
      if (sseStarted && !res.writableEnded) {
        sendSseJson(res, { meta: chosenMeta, done: true });
      }
      if (sseStarted && !res.writableEnded) {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } catch (err) {
      const payload = buildStructuredStreamErrorPayload(err);
      if (!sseStarted) {
        res.status(payload.httpStatus).json({
          error: payload.error,
          errorCategory: payload.errorCategory,
          minRemainingCooldownSec: payload.minRemainingCooldownSec,
          message: payload.message,
        });
        return;
      }

      console.log(`[interpret-period] KeyPool notice: ${payload.message.split(/\r?\n/)[0]}`);
      ensureSseStarted();
      sendSseJson(res, {
        error: payload.error,
        errorCategory: payload.errorCategory,
        minRemainingCooldownSec: payload.minRemainingCooldownSec,
        message: payload.message,
        detail: payload.message,
      });
      if (!res.writableEnded) {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } finally {
      stopHeartbeat();
    }
  });

  // POST /api/interpret-dossier-section — Sinh từng chương Hồ Sơ Toàn Diện qua KeyPool & SSE
  app.post('/api/interpret-dossier-section', async (req, res) => {
    const validated = validateDossierSectionInput(req.body as InterpretDossierSectionBody);
    if (!validated.ok) {
      res.status(400).json({
        error: 'INVALID_INPUT',
        message: validated.message,
      });
      return;
    }

    const { systemInstruction, prompt, knowledgeResult } = buildStrictDossierSectionPrompt(
      validated.chart,
      validated.sectionId,
    );

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

    let accumulatedText = '';
    let wasInterrupted = false;

    try {
      const finalMeta = await keyPoolManager.executeStream({
        prompt,
        systemInstruction,
        signal: abortController.signal,
        onSseKeepAliveRequired: ensureSseStarted,
        onMeta: (meta) => {
          ensureSseStarted();
          sendSseJson(res, { meta });
        },
        onChunk: (text) => {
          ensureSseStarted();
          const safeChunk = sanitizeLayer3AOnly(text);
          if (safeChunk) {
            accumulatedText += safeChunk;
          }
          sendSseText(res, text);
        },
        onInterrupted: (ev) => {
          wasInterrupted = true;
          ensureSseStarted();
          sendSseJson(res, {
            interrupted: true,
            message: ev.reason,
            errorCategory: ev.errorCategory,
            partialLength: ev.partialLength,
            minRemainingCooldownSec: ev.minRemainingCooldownSec ?? null,
          });
        },
      });
      let chosenMeta = finalMeta;
      if (!wasInterrupted && accumulatedText.trim() && sseStarted && !res.writableEnded) {
        const chapterMode =
          validated.sectionId === 'palaces_core' ||
          validated.sectionId === 'palaces_family' ||
          validated.sectionId === 'palaces_social_health'
            ? 'palace_group'
            : validated.sectionId === 'horizon_5y' ||
                validated.sectionId === 'horizon_10y'
              ? 'horizon'
              : 'overview';
        const palaceGanZhiMap = buildPalaceGanZhiMap(validated.chart);
        const firstAudit = verifyAcademicCitationsAndClaims(
          accumulatedText,
          knowledgeResult.entries,
          {
            chart: validated.chart,
            sectionId: validated.sectionId,
            chapterMode,
            palaceGanZhiMap,
          },
        );

        let chosenAudit = firstAudit;
        let chosenBodyForSep = accumulatedText;

        if (
          shouldRetryForZeroCitations({
            validCitationIds: firstAudit.validCitationIds,
            allowedEntriesCount: knowledgeResult.entries.length,
            chapterMode,
            wasInterrupted,
            alreadyRetried: false,
          }) &&
          !abortController.signal.aborted &&
          !res.writableEnded
        ) {
          sendSseJson(res, {
            retryingForCitations: true,
            message: 'Đang sinh lại 1 lần để bổ sung trích dẫn học thuật hợp lệ...',
          });

          let retryAccumulated = '';
          let retryInterrupted = false;
          let retryMeta = finalMeta;

          try {
            retryMeta = await keyPoolManager.executeStream({
              prompt: `${prompt}${CITATION_RETRY_PROMPT_ADDENDUM}`,
              systemInstruction,
              signal: abortController.signal,
              onMeta: (m) => {
                retryMeta = m;
              },
              onChunk: (text) => {
                const safeChunk = sanitizeLayer3AOnly(text);
                if (safeChunk) {
                  retryAccumulated += safeChunk;
                }
              },
              onInterrupted: () => {
                retryInterrupted = true;
              },
            });
          } catch (retryErr) {
            retryInterrupted = true;
            console.warn(
              `[interpret-dossier-section] Citation retry failed (${validated.sectionId}):`,
              keyPoolManager.sanitize(retryErr instanceof Error ? retryErr.message : String(retryErr)).split(/\r?\n/)[0],
            );
          }

          let replacedWithRetry = false;
          if (!retryInterrupted && retryAccumulated.trim() && !res.writableEnded) {
            const retryAudit = verifyAcademicCitationsAndClaims(
              retryAccumulated,
              knowledgeResult.entries,
              {
                chart: validated.chart,
                sectionId: validated.sectionId,
                chapterMode,
                palaceGanZhiMap,
              },
            );
            if (retryAudit.validCitationIds.length > firstAudit.validCitationIds.length) {
              replacedWithRetry = true;
              chosenAudit = retryAudit;
              chosenMeta = retryMeta ?? finalMeta;
              chosenBodyForSep = retryAccumulated;
              sendSseJson(res, {
                replaceChapterText: retryAccumulated,
                meta: chosenMeta,
                retryingForCitations: false,
              });
            }
          }

          if (!replacedWithRetry && !res.writableEnded) {
            sendSseJson(res, { retryingForCitations: false });
          }
        }

        logScrubbedCitationWarn(
          'interpret-dossier-section',
          validated.sectionId,
          chosenAudit,
          chosenBodyForSep.length,
        );

        const criticalFlags = chosenAudit.auditFlags.filter(
          (f) => f.severity === 'critical',
        );
        if (criticalFlags.length > 0) {
          console.warn(
            `[interpret-dossier-section] KP-3 critical flags (${criticalFlags.length}):`,
            JSON.stringify(criticalFlags),
          );
        }
        sendSseJson(res, {
          citationAudit: {
            validIds: chosenAudit.validCitationIds,
            scrubbedInvalidIds: chosenAudit.scrubbedInvalidIds,
            normalizedBareIds: chosenAudit.normalizedBareIds,
            hasUncitedClaims: chosenAudit.hasUncitedClaims,
            palaceGanZhiMismatches: chosenAudit.palaceGanZhiMismatches,
            auditFlags: chosenAudit.auditFlags,
          },
        });
        const tailBlock = [
          chosenAudit.referenceBlockMarkdown,
          chosenAudit.warningBlockMarkdown,
        ]
          .filter(Boolean)
          .join('\n\n');
        if (tailBlock && !res.writableEnded) {
          const leadingSep = chosenBodyForSep.endsWith('\n\n')
            ? ''
            : chosenBodyForSep.endsWith('\n')
              ? '\n'
              : '\n\n';
          sendSseText(res, `${leadingSep}${tailBlock}`);
        }
      }
      if (sseStarted && !res.writableEnded) {
        sendSseJson(res, { meta: chosenMeta, done: true });
      }
      if (sseStarted && !res.writableEnded) {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } catch (err) {
      const payload = buildStructuredStreamErrorPayload(err);
      if (!sseStarted) {
        res.status(payload.httpStatus).json({
          error: payload.error,
          errorCategory: payload.errorCategory,
          minRemainingCooldownSec: payload.minRemainingCooldownSec,
          message: payload.message,
        });
        return;
      }

      console.log(`[interpret-dossier-section] KeyPool notice: ${payload.message.split(/\r?\n/)[0]}`);
      ensureSseStarted();
      sendSseJson(res, {
        error: payload.error,
        errorCategory: payload.errorCategory,
        minRemainingCooldownSec: payload.minRemainingCooldownSec,
        message: payload.message,
        detail: payload.message,
      });
      if (!res.writableEnded) {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } finally {
      stopHeartbeat();
    }
  });

  // POST /api/audit-dossier-section — Kiểm chứng lại nội dung chương/kỳ hạn đã lưu đệm (read-only, 0 token AI)
  app.post('/api/audit-dossier-section', (req, res) => {
    const body = req.body as {
      chart?: ZiweiChart;
      sectionId?: string;
      periodContext?: YunxianPeriodContext | null;
      text?: unknown;
    } | undefined;

    if (!body || !body.chart || !Array.isArray(body.chart.palaces) || body.chart.palaces.length !== 12) {
      res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'Thiếu dữ liệu lá số Tử Vi 12 cung hợp lệ.',
      });
      return;
    }

    if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > AUDIT_MAX_TEXT_LEN) {
      res.status(400).json({
        error: 'INVALID_INPUT',
        message: `Nội dung cần kiểm chứng phải là chuỗi không rỗng và tối đa ${AUDIT_MAX_TEXT_LEN.toLocaleString('vi-VN')} ký tự.`,
      });
      return;
    }

    const chart = body.chart;
    const palaceGanZhiMap = buildPalaceGanZhiMap(chart);
    const hasPeriodContext = body.periodContext !== undefined && body.periodContext !== null;

    if (hasPeriodContext) {
      const pCtx = body.periodContext;
      const validMode = pCtx && (pCtx.mode === 'dahan' || pCtx.mode === 'liunian');
      const validBranch =
        pCtx &&
        typeof pCtx.branchIndex === 'number' &&
        Number.isInteger(pCtx.branchIndex) &&
        pCtx.branchIndex >= 0 &&
        pCtx.branchIndex <= 11;
      const validStem =
        pCtx &&
        typeof pCtx.stemIndex === 'number' &&
        Number.isInteger(pCtx.stemIndex) &&
        pCtx.stemIndex >= 0 &&
        pCtx.stemIndex <= 9;
      if (!pCtx || typeof pCtx !== 'object' || !validMode || !validBranch || !validStem) {
        res.status(400).json({
          error: 'INVALID_INPUT',
          message: 'periodContext không hợp lệ.',
        });
        return;
      }
      if (
        body.sectionId !== undefined &&
        body.sectionId !== null &&
        body.sectionId !== 'year_2026' &&
        body.sectionId !== 'year_2027'
      ) {
        res.status(400).json({
          error: 'INVALID_INPUT',
          message: 'sectionId đi kèm periodContext không hợp lệ.',
        });
        return;
      }

      const resolvedSectionId =
        resolvePeriodSectionId(pCtx) ??
        (body.sectionId === 'year_2026' || body.sectionId === 'year_2027'
          ? body.sectionId
          : undefined);
      const knowledgeResult = retrieveKnowledgeForPeriod(chart, pCtx);
      const audit = verifyAcademicCitationsAndClaims(body.text, knowledgeResult.entries, {
        chart,
        sectionId: resolvedSectionId,
        chapterMode: 'period',
        periodContext: pCtx,
        palaceGanZhiMap,
      });

      res.setHeader('Cache-Control', 'no-store');
      res.json({
        auditFlags: audit.auditFlags,
        validCitationIds: audit.validCitationIds,
        scrubbedInvalidIds: audit.scrubbedInvalidIds,
        normalizedBareIds: audit.normalizedBareIds,
        reauditedForVersion: APP_VERSION,
        reauditedAt: Date.now(),
      });
      return;
    }

    if (body.sectionId === 'year_2026' || body.sectionId === 'year_2027') {
      const year = body.sectionId === 'year_2026' ? 2026 : 2027;
      const derivedCtx = buildYunxianPeriodContext(chart, { mode: 'liunian', year });
      if (!derivedCtx) {
        res.status(400).json({
          error: 'INVALID_INPUT',
          message: `Không thể dựng ngữ cảnh Lưu Niên cho ${body.sectionId}.`,
        });
        return;
      }
      const knowledgeResult = retrieveKnowledgeForPeriod(chart, derivedCtx);
      const audit = verifyAcademicCitationsAndClaims(body.text, knowledgeResult.entries, {
        chart,
        sectionId: body.sectionId,
        chapterMode: 'period',
        periodContext: derivedCtx,
        palaceGanZhiMap,
      });

      res.setHeader('Cache-Control', 'no-store');
      res.json({
        auditFlags: audit.auditFlags,
        validCitationIds: audit.validCitationIds,
        scrubbedInvalidIds: audit.scrubbedInvalidIds,
        normalizedBareIds: audit.normalizedBareIds,
        reauditedForVersion: APP_VERSION,
        reauditedAt: Date.now(),
      });
      return;
    }

    if (!isValidDossierSectionId(body.sectionId)) {
      res.status(400).json({
        error: 'INVALID_INPUT',
        message: `sectionId không hợp lệ. Chỉ chấp nhận: ${VALID_DOSSIER_SECTION_IDS.join(', ')}, year_2026, year_2027 hoặc truyền periodContext.`,
      });
      return;
    }

    const sectionId = body.sectionId;
    const chapterMode =
      sectionId === 'palaces_core' ||
      sectionId === 'palaces_family' ||
      sectionId === 'palaces_social_health'
        ? 'palace_group'
        : sectionId === 'horizon_5y' || sectionId === 'horizon_10y'
          ? 'horizon'
          : 'overview';
    const knowledgeResult = retrieveKnowledgeForDossierSection(chart, sectionId);
    const audit = verifyAcademicCitationsAndClaims(body.text, knowledgeResult.entries, {
      chart,
      sectionId,
      chapterMode,
      palaceGanZhiMap,
    });

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      auditFlags: audit.auditFlags,
      validCitationIds: audit.validCitationIds,
      scrubbedInvalidIds: audit.scrubbedInvalidIds,
      normalizedBareIds: audit.normalizedBareIds,
      reauditedForVersion: APP_VERSION,
      reauditedAt: Date.now(),
    });
  });

  // POST /api/interpret-chat — Chat Hỏi Đáp Chuyên Sâu (Stateless server, ghim dữ kiện lá số)
  app.post('/api/interpret-chat', async (req, res) => {
    const validated = validateExplanationChatInput(req.body as InterpretChatBody);
    if (!validated.ok) {
      res.status(400).json({
        error: 'INVALID_INPUT',
        message: validated.message,
      });
      return;
    }

    const { systemInstruction, prompt, knowledgeResult } = buildStrictExplanationChatPrompt({
      chart: validated.chart,
      chartB: validated.chartB,
      contextMode: validated.contextMode,
      sectionTitle: validated.sectionTitle,
      periodContext: validated.periodContext,
      excerpt: validated.excerpt,
      history: validated.history,
      question: validated.question,
    });

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

    let accumulatedText = '';
    let wasInterrupted = false;

    try {
      const finalMeta = await keyPoolManager.executeStream({
        prompt,
        systemInstruction,
        signal: abortController.signal,
        onSseKeepAliveRequired: ensureSseStarted,
        onMeta: (meta) => {
          ensureSseStarted();
          sendSseJson(res, { meta });
        },
        onChunk: (text) => {
          ensureSseStarted();
          const safeChunk = sanitizeLayer3AOnly(text);
          if (safeChunk) {
            accumulatedText += safeChunk;
          }
          sendSseText(res, text);
        },
        onInterrupted: (ev) => {
          wasInterrupted = true;
          ensureSseStarted();
          sendSseJson(res, {
            interrupted: true,
            message: ev.reason,
            errorCategory: ev.errorCategory,
            partialLength: ev.partialLength,
            minRemainingCooldownSec: ev.minRemainingCooldownSec ?? null,
          });
        },
      });
      if (!wasInterrupted && accumulatedText.trim() && sseStarted && !res.writableEnded) {
        const citationAudit = verifyAcademicCitationsAndClaims(
          accumulatedText,
          knowledgeResult.entries,
          {
            chart: validated.chart,
            chapterMode: 'chat',
            periodContext: validated.periodContext,
            palaceGanZhiMap: buildPalaceGanZhiMap(validated.chart),
          },
        );
        const criticalFlags = citationAudit.auditFlags.filter(
          (f) => f.severity === 'critical',
        );
        if (criticalFlags.length > 0) {
          console.warn(
            `[interpret-chat] KP-3 critical flags (${criticalFlags.length}):`,
            JSON.stringify(criticalFlags),
          );
        }
        sendSseJson(res, {
          citationAudit: {
            validIds: citationAudit.validCitationIds,
            scrubbedInvalidIds: citationAudit.scrubbedInvalidIds,
            normalizedBareIds: citationAudit.normalizedBareIds,
            hasUncitedClaims: citationAudit.hasUncitedClaims,
            palaceGanZhiMismatches: citationAudit.palaceGanZhiMismatches,
            auditFlags: citationAudit.auditFlags,
          },
        });
        if (citationAudit.chatFooterMarkdown) {
          const leadingSep = accumulatedText.endsWith('\n\n')
            ? ''
            : accumulatedText.endsWith('\n')
              ? '\n'
              : '\n\n';
          sendSseText(res, `${leadingSep}${citationAudit.chatFooterMarkdown}`);
        }
      }
      if (sseStarted && !res.writableEnded) {
        sendSseJson(res, { meta: finalMeta, done: true });
      }
      if (sseStarted && !res.writableEnded) {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } catch (err) {
      const payload = buildStructuredStreamErrorPayload(err);
      if (!sseStarted) {
        res.status(payload.httpStatus).json({
          error: payload.error,
          errorCategory: payload.errorCategory,
          minRemainingCooldownSec: payload.minRemainingCooldownSec,
          message: payload.message,
        });
        return;
      }

      console.log(`[interpret-chat] KeyPool notice: ${payload.message.split(/\r?\n/)[0]}`);
      ensureSseStarted();
      sendSseJson(res, {
        error: payload.error,
        errorCategory: payload.errorCategory,
        minRemainingCooldownSec: payload.minRemainingCooldownSec,
        message: payload.message,
        detail: payload.message,
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
      const finalMeta = await keyPoolManager.executeStream({
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
      if (!res.writableEnded) {
        sendSseJson(res, { meta: finalMeta, done: true });
      }
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
    const { chartA, chartB } = req.body as {
      chartA?: ZiweiChart;
      chartB?: ZiweiChart;
    };

    if (!chartA || !chartB) {
      res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'Vui lòng cung cấp đầy đủ hai lá số để tiến hành Hợp Bàn.',
      });
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

    let anyChunkSent = false;
    let interruptedEmitted = false;

    try {
      const finalMeta = await keyPoolManager.executeStream({
        prompt,
        signal: abortController.signal,
        onSseKeepAliveRequired: ensureSseStarted,
        onMeta: (meta) => {
          ensureSseStarted();
          sendSseJson(res, { meta });
        },
        onChunk: (text) => {
          anyChunkSent = true;
          ensureSseStarted();
          sendSseText(res, text);
        },
        onInterrupted: (ev) => {
          interruptedEmitted = true;
          ensureSseStarted();
          sendSseJson(res, {
            interrupted: true,
            message: ev.reason,
            errorCategory: ev.errorCategory,
            partialLength: ev.partialLength,
            minRemainingCooldownSec: ev.minRemainingCooldownSec ?? null,
          });
        },
      });
      if (sseStarted && !res.writableEnded) {
        sendSseJson(res, { meta: finalMeta, done: true });
      }
      if (sseStarted && !res.writableEnded) {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } catch (err) {
      const payload = buildStructuredStreamErrorPayload(err);
      if (!sseStarted) {
        res.status(payload.httpStatus).json({
          error: payload.error,
          errorCategory: payload.errorCategory,
          minRemainingCooldownSec: payload.minRemainingCooldownSec,
          message: payload.message,
        });
        return;
      }

      if (!anyChunkSent) {
        sendSseJson(res, {
          error: payload.error,
          errorCategory: payload.errorCategory,
          minRemainingCooldownSec: payload.minRemainingCooldownSec,
          message: payload.message,
          detail: payload.message,
        });
      } else if (!interruptedEmitted) {
        sendSseJson(res, {
          interrupted: true,
          message: payload.message,
          errorCategory: payload.errorCategory,
          minRemainingCooldownSec: payload.minRemainingCooldownSec,
        });
      }
      if (!res.writableEnded) {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } finally {
      stopHeartbeat();
    }
  });
}

async function startServer() {
  const kbSnapshot = initKnowledgeBase();
  console.log(
    `[Knowledge Base] Đã nạp ${kbSnapshot.totalEntries} mục (${kbSnapshot.realEntries} thật / ${kbSnapshot.sampleEntries} mẫu) từ ${kbSnapshot.filesLoaded.join(', ') || '(trống)'}`,
  );
  const app = express();
  registerApiRoutes(app);

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

const entryBase = process.argv[1] ? path.basename(process.argv[1]) : '';
if (
  (entryBase === 'server.ts' || entryBase === 'server.js') &&
  process.env.ZIWEI_DISABLE_AUTO_LISTEN !== '1'
) {
  startServer();
}
