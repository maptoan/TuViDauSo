import type { ZiweiChart } from '../src/lib/ziwei/types.ts';
import type { YunxianPeriodContext } from '../src/lib/ziwei/yunxian-context.ts';
import { buildChatFactTableForContextVi } from '../src/lib/ziwei/dossier-context.ts';
import {
  CHAT_MAX_EXCERPT_CHARS,
  DOSSIER_CHAPTER_SCOPE_PALACES_VI,
  isValidDossierChapterId,
  trimChatExcerpt,
  type DossierChapterId,
} from '../src/lib/dossier-chat-ui.ts';
import {
  sanitizeAiVietnameseOutput,
  sanitizeLayer3AOnly,
} from '../src/lib/ziwei/text-sanitizer.ts';
import {
  KHONG_KIEP_NEGATION_RE,
  KHONG_KIEP_PAIR_RE,
  chapterScopeHasKhongKiepPair,
  verifyIllegalKhongKiepMentions,
} from './knowledge-base/verifier.ts';

export const SUGGESTION_COUNT = 3;
export const SUGGESTION_MAX_CHARS = 200;
export const SUGGESTION_EXCLUSION_MAX_ITEMS = 6;
export const SUGGESTION_EXCLUSION_MAX_CHARS = 400;

/**
 * §3.4(a) (ĐK-HD1-03): Chặn ngôi xưng bị cấm, miễn trừ "bạn bè", "kết bạn", "bạn đời", "bạn đồng hành".
 */
export const FORBIDDEN_PRONOUN_RE =
  /(?<!kết\s)\b(bạn(?!\s+(?:bè|đời|đồng\s+hành))|thân\s+chủ|mệnh\s+chủ|quý\s+khách|anh\s*\/\s*chị|tôi)\b/iu;

/**
 * §3.4(a) (ĐK-HD1-03): Chặn cấu trúc câu hỏi xin lời khuyên / nhét lời khuyên.
 */
export const FORBIDDEN_ADVICE_QUESTION_RE =
  /(?:đương\s+số\s+)?(?:có\s+nên\b|nên\s+(?:làm\s+gì|ưu\s+tiên|đầu\s+tư|chọn|hoãn|giữ|rà\s+soát|hạn\s+chế|chuẩn\s+bị|tập\s+trung|hành\s+động|thay\s+đổi|tránh|theo\s+hướng)|cần\s+(?:chuẩn\s+bị|làm\s+gì|ưu\s+tiên|thay\s+đổi)|làm\s+gì)/iu;

/**
 * Phụ lục B: 36 câu hỏi mẫu v2 theo chương (chỉ câu hỏi, làm few-shot theo chương).
 */
export const FEW_SHOT_QUESTIONS_BY_CHAPTER: Record<
  DossierChapterId,
  readonly string[]
> = {
  chapter_overview: [
    'Thiên Cơ [Đắc] đi cùng Hóa Khoa và Thái Âm [Vượng] đi cùng Hóa Lộc cùng nhập Mệnh, nhưng Thiên Hình và Phó Triệt cũng đồng cung Mệnh. Khi nào cặp sao này phát huy hết mức (tư duy nhạy bén, uyển chuyển, tài lộc dồi dào), và dấu hiệu nào cho thấy Thiên Hình, Phó Triệt đang kìm hãm chúng?',
    'Thiên Lương [Miếu] ở Quan Lộc và Thiên Đồng [Bình] mang Bản Mệnh Hóa Quyền ở Tài Bạch cùng hội về Mệnh — dấu hiệu nào cho thấy trục này đang nghiêng về công danh, và dấu hiệu nào cho thấy nó đang nghiêng về tài lộc?',
    'Thiên Đồng Hóa Kỵ nhập Tài Bạch đòi hỏi quản lý tài chính chặt chẽ, nhưng Thái Âm Hóa Khoa vẫn phò trợ tại bản mệnh — khi nào uy tín nhờ Hóa Khoa giữ được dòng tiền, và khi nào Hóa Kỵ lấn át?',
    'Thân cư Phu Thê với Thái Dương [Hãm], cuộc đời chịu ảnh hưởng sâu sắc từ gia đạo và nhân duyên — dấu hiệu nào cho thấy ảnh hưởng này đang nâng đỡ Mệnh, và dấu hiệu nào cho thấy nó đang kéo Mệnh xuống?',
    'Cự Môn Hóa Kỵ tại Phúc Đức cùng Thiên Hình, Địa Không, Thiên Không báo hiệu áp lực tinh thần trong các quyết định lớn — dấu hiệu nào cho thấy một quyết định lớn đang bị áp lực đó chi phối, và dấu hiệu nào cho thấy nó vẫn giữ được sự sáng suốt?',
  ],
  palaces_core: [
    'Thiên Hình, Phó Triệt khiến đương số đôi khi nguyên tắc cứng nhắc, đường đời sớm trải qua trắc trở, tự lực gầy dựng — dấu hiệu nào cho thấy sự cứng nhắc này đang giữ vững nguyên tắc, và dấu hiệu nào cho thấy nó đã thành cố chấp gây thêm trắc trở?',
    'Ở cung Quan Lộc, Thiên Lương [Miếu] cùng Lộc Tồn, Thiên Quý mang quý nhân che chở, nhưng Địa Không, Thiên Không khiến "ý tưởng táo bạo vượt trước thời đại dẫn đến tiêu tán hư danh nếu thiếu thực tế". Đương số phân biệt một ý tưởng "vượt trước thời đại" với một ý tưởng "thiếu thực tế" bằng dấu hiệu nào?',
    'Thiên Đồng vừa Tự Hóa Kỵ tại bản cung, vừa nhận Hóa Kỵ từ đại hạn Canh Tuất nhập bản cung — dấu hiệu nào cho thấy tiền đang hao do Tự Hóa Kỵ, và dấu hiệu nào cho thấy tiền đang hao do Hóa Kỵ từ đại hạn?',
    'Thái Dương Hóa Lộc nhập Phu Thê cho thấy tài sản liên quan đến gia đình, nhưng Thiên Đồng Hóa Kỵ nhập chính cung Tài Bạch nhắc không mạo hiểm vay mượn lớn — mốc nào cho thấy một khoản vay vì gia đình vẫn nằm trong vòng an toàn, và mốc nào cho thấy nó đã chạm ngưỡng mạo hiểm?',
    'Thiên Đồng Hóa Lộc nhập Tài Bạch từ nỗ lực sự nghiệp, nhưng Liêm Trinh Hóa Kỵ nhập Giao Hữu cảnh báo tranh chấp với đồng nghiệp — dấu hiệu nào cho thấy tài lộc đang sinh ra mà quan hệ vẫn giữ được, và dấu hiệu nào cho thấy tranh chấp đã bắt đầu ăn mòn tài lộc đó?',
  ],
  palaces_family: [
    '"Buổi đầu" bất lợi do Thái Dương [Hãm] tọa thủ Phu Thê, vợ chồng dễ khắc khẩu, bất đồng quan điểm sống — dấu hiệu nào cho thấy giai đoạn "buổi đầu" này đã qua, và dấu hiệu nào cho thấy nó vẫn còn tiếp diễn?',
    'Vũ Khúc cứng cỏi và Phá Quân biến động tạo tính cách mạnh mẽ, đôi phần nghịch ngợm ở thế hệ sau — dấu hiệu nào cho thấy định hướng kiên nhẫn đang phát huy, và dấu hiệu nào cho thấy nó đã trượt sang áp đặt khiến khoảng cách thế hệ gia tăng?',
    'Đà La gây chút trì trễ hoặc tranh chấp nhỏ ở quyết định mua bán bất động sản, nhưng Phượng Các, Thiên Thọ, Hữu Bật vẫn giữ gia đạo yên bình — mốc nào cho thấy một tranh chấp vẫn còn ở mức "nhỏ" do Đà La, và mốc nào cho thấy nó đã vượt qua mức đó?',
    'Cự Môn hãm địa hóa Kỵ cùng Địa Kiếp, Quả Tú khiến đương số suy nghĩ nhiều, đa nghi, cô độc trong cảm xúc, nhưng Thiên Hỷ vẫn mang lại chút niềm vui nhỏ — dấu hiệu nào cho thấy tâm trí đang được thanh thản, và dấu hiệu nào cho thấy bất an nội tại vẫn đang chi phối?',
  ],
  palaces_social_health: [
    'Tử Vi [Vượng] kết hợp Tham Lang [Lợi] nhưng gặp Linh Tinh và Triệt Không, tạo sự bất định trong quan hệ với bề trên — dấu hiệu nào cho thấy quan hệ với người có thẩm quyền vẫn giữ được sự tôn trọng, và dấu hiệu nào cho thấy bất định đã thành bất đồng?',
    'Thiên Phủ là kho tàng, tượng trưng cho sự vững vàng và bảo thủ, giúp quan hệ xã giao ở mức độ an toàn, không quá phô trương — dấu hiệu nào cho thấy một mối quan hệ đang an toàn thật, và dấu hiệu nào cho thấy nó chỉ an toàn ở bề nổi?',
    'Ở cung Giao Hữu, hùn hạp hay kết giao sâu dễ biến đối tác thành đối thủ nếu thiếu minh bạch về tài chính — dấu hiệu nào cho thấy một mối hùn hạp vẫn đang minh bạch, và dấu hiệu nào cho thấy nó đã bắt đầu biến đối tác thành đối thủ?',
    'Văn Khúc tự hóa Kỵ và phi tinh Văn Khúc Hóa Kỵ cùng nhập Tật Ách, dễ gây bệnh tiêu hóa, gan mật hoặc căng thẳng thần kinh do suy nghĩ nhiều — mốc nào cho thấy áp lực nội tâm vẫn chỉ dừng ở mức suy nghĩ nhiều, và mốc nào cho thấy nó đã chuyển thành bệnh thực thể?',
  ],
  year_2026: [
    'Địa Không và Thiên Không tề tựu tại Lưu Mệnh 2026, cùng Lưu Kình Dương kẹp tại Mệnh và Lưu Đà La tại Lưu Phu Thê — dấu hiệu nào cho thấy biến động bất ngờ đang dừng ở tâm tư, và dấu hiệu nào cho thấy nó đã lan sang sự nghiệp?',
    'Lưu Văn Khúc tại Lưu Mệnh cùng Lưu Văn Xương tại Lưu Phúc Đức giúp gia tăng danh tiếng, rất thuận lợi cho việc học tập, thi cử hoặc mở rộng quan hệ xã hội — dấu hiệu nào cho thấy danh tiếng đang tăng nhờ học tập, thi cử, và dấu hiệu nào cho thấy nó đang tăng nhờ mở rộng quan hệ xã hội?',
    'Lưu Hóa Kỵ nhập Liêm Trinh tại Lưu Phụ Mẫu, đối cung là Lưu Tật Ách, cảnh báo rắc rối về quan hệ xã giao, giấy tờ pháp lý hoặc sức khỏe — dấu hiệu nào cho thấy rắc rối sắp tới thuộc về giấy tờ pháp lý, và dấu hiệu nào cho thấy nó thuộc về sức khỏe?',
    'Thái Dương [Hãm] và Lưu Tuế Phá tại Lưu Thiên Di khiến việc đi lại, giao dịch bên ngoài dễ sinh tranh chấp, tiểu nhân quấy phá — dấu hiệu nào cho thấy một chuyến đi vẫn an toàn, và dấu hiệu nào cho thấy tranh chấp đã bắt đầu?',
  ],
  year_2027: [
    'Kình Dương cùng Lưu Kình Dương và Lưu Tuế Kiến tại Lưu Mệnh 2027 tạo áp lực cạnh tranh gay gắt và nguy cơ tranh chấp — dấu hiệu nào cho thấy áp lực này vẫn chỉ là cạnh tranh lành mạnh, và dấu hiệu nào cho thấy nó đã thành tranh chấp thật sự?',
    'Lưu Hóa Khoa (Thiên Cơ) và Lưu Hóa Lộc (Thái Âm) cùng tọa thủ tại Lưu Tật Ách đem lại trí tuệ sáng suốt — dấu hiệu nào cho thấy nguồn năng lượng này đang phát huy ở bài toán chuyên môn, và dấu hiệu nào cho thấy nó đang phát huy ở tài khí?',
    'Lưu Hóa Kỵ (Cự Môn [Hãm]) tại Lưu Tử Nữ xung sang Lưu Điền Trạch, nơi có Lưu Bạch Hổ, Lưu Tướng Tinh và Đại Hao — dấu hiệu nào cho thấy nguy cơ đang dừng ở thị phi khẩu thiệt, và dấu hiệu nào cho thấy nó đã thành hao hụt tài lộc thật sự?',
    'Lưu Thiên Khôi tại Lưu Quan Lộc cùng Lưu Thiên Việt, Lưu Văn Xương tại Lưu Phúc Đức mang lại quý nhân phù trợ và sự công nhận về danh tiếng — dấu hiệu nào cho thấy sự công nhận này đến từ hoạt động sự nghiệp, và dấu hiệu nào cho thấy nó đến từ hoạt động xã hội?',
  ],
  horizon_5y: [
    'Năm 2026 và năm 2030 cùng là điểm rơi cơ hội tại trục Mệnh – Tài – Quan — dấu hiệu nào cho thấy cơ hội của năm 2026 đã đến, và dấu hiệu nào cho thấy cơ hội của năm 2030 vẫn còn đang hội tụ?',
    'Song Kỵ trùng phùng tại Phúc Đức gây áp lực lớn, nhưng Song Lộc trùng phùng trên Thái Âm tại Mệnh Cung vẫn giữ được tài lộc ổn định, hóa giải phần nào rủi ro thị phi — dấu hiệu nào cho thấy phần thị phi đã được hóa giải, và dấu hiệu nào cho thấy phần còn lại vẫn đang bủa vây?',
    'Lưu Thiên Mã chiếu hội khiến di chuyển, ngoại giao, công tác xa diễn ra thường xuyên trong năm 2028, nhưng Thiên Cơ Hóa Kỵ tại Lưu Thiên Di đòi hỏi cẩn trọng với thủ tục xuất nhập cảnh, hợp đồng dịch vụ, giao dịch đi lại — dấu hiệu nào cho thấy một giao dịch đi lại vẫn an toàn, và dấu hiệu nào cho thấy nó đã tiềm ẩn tranh chấp pháp lý?',
    'Văn Khúc Hóa Kỵ nhập Lưu Mệnh (Tật Ách) năm 2029 dễ gây vấn đề sức khỏe về thần kinh hoặc tiêu hóa do áp lực tích tụ, nhưng Thiên Lương Hóa Khoa hội chiếu từ Quan Lộc giúp nhận hỗ trợ từ cấp trên hoặc y bác sĩ uy tín — dấu hiệu nào cho thấy sức khỏe vẫn đang tự giữ được, và dấu hiệu nào cho thấy đã đến lúc tìm đến sự hỗ trợ đó?',
    'Năm 2030 chuyển sang Đại Hạn 54–63 tuổi tại Tật Ách, trọng tâm chuyển từ tiền bạc sang sức khỏe — dấu hiệu nào cho thấy uy tín cá nhân đang được giữ vững qua giai đoạn chuyển giao, và dấu hiệu nào cho thấy áp lực trung vận đã bắt đầu ảnh hưởng đến huyết áp, tiêu hóa?',
  ],
  horizon_10y: [
    'Cự Môn Hóa Lộc tại Lưu Giao Hữu mang lợi nhuận từ thương thảo, nhưng Văn Xương Hóa Kỵ tại Lưu Thiên Di cảnh báo thủ tục pháp lý về bất động sản hoặc hợp đồng — dấu hiệu nào cho thấy một hợp đồng đang mang lợi, và dấu hiệu nào cho thấy nó đã tiềm ẩn rủi ro pháp lý?',
    'Thái Dương [Hãm] tại Lưu Mệnh 2032 khiến tinh thần dễ lâm vào áp lực do công việc và gia đình đan xen — dấu hiệu nào cho thấy áp lực đang đến từ công việc, và dấu hiệu nào cho thấy nó đang đến từ gia đình?',
    'Phá Quân Hóa Lộc tại Lưu Phu Thê thúc đẩy cải cách mạnh mẽ, nhưng Tham Lang Hóa Kỵ tại Lưu Phúc Đức dễ sinh tâm lý ham muốn đầu tư mạo hiểm — dấu hiệu nào cho thấy một quyết định đang là cải cách, và dấu hiệu nào cho thấy nó đã trượt sang đầu tư mạo hiểm?',
    'Lưu niên 2034 trùng phùng bản mệnh gốc tại Dần, quy tụ Thiên Cơ [Đắc] và Thái Âm [Vượng] — dấu hiệu nào cho thấy bố cục sáng sủa này đang thể hiện qua trí tuệ minh mẫn, và dấu hiệu nào cho thấy nó đang thể hiện qua uy tín cá nhân?',
    'Tử Vi Hóa Khoa tọa thủ tại Lưu Mệnh 2035 giúp khẳng định vị thế, danh tiếng và phẩm chất đạo đức, nhưng Thái Âm Hóa Kỵ đồng cung tại Lưu Huynh Đệ cảnh báo suy giảm năng lượng hoặc áp lực tài chính từ các khoản đầu tư chung — dấu hiệu nào cho thấy danh tiếng đang được khẳng định, và dấu hiệu nào cho thấy áp lực tài chính đã bắt đầu làm mờ danh tiếng đó?',
  ],
};

export interface ChatQuestionSuggestionsBody {
  chart?: ZiweiChart;
  chartB?: ZiweiChart | null;
  contextMode?: 'natal' | 'period' | 'heming';
  contextKey?: string;
  sectionTitle?: string;
  periodContext?: YunxianPeriodContext | null;
  excerpt?: string;
  chapterId?: string;
  isFallbackFactSheet?: boolean;
  askedQuestions?: unknown;
  previousSuggestions?: unknown;
}

export interface ValidatedChatQuestionSuggestionsInput {
  ok: true;
  chart: ZiweiChart;
  chartB: ZiweiChart | null;
  contextMode: 'natal' | 'period' | 'heming';
  sectionTitle: string;
  periodContext: YunxianPeriodContext | null;
  excerpt: string;
  chapterId: DossierChapterId;
  isFallbackFactSheet: boolean;
  askedQuestions: string[];
  previousSuggestions: string[];
}

function validateExclusionArray(
  raw: unknown,
  fieldName: string,
): { ok: true; items: string[] } | { ok: false; message: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, items: [] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, message: `${fieldName} phải là một mảng chuỗi.` };
  }
  const items: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string') {
      return {
        ok: false,
        message: `Mỗi mục trong ${fieldName} phải là chuỗi ký tự.`,
      };
    }
    const trimmed = entry.trim();
    if (!trimmed) continue;
    if (trimmed.length > SUGGESTION_EXCLUSION_MAX_CHARS) {
      return {
        ok: false,
        message: `Mỗi mục trong ${fieldName} không được vượt quá ${SUGGESTION_EXCLUSION_MAX_CHARS} ký tự.`,
      };
    }
    items.push(trimmed);
  }
  return { ok: true, items: items.slice(-SUGGESTION_EXCLUSION_MAX_ITEMS) };
}

export function validateChatQuestionSuggestionsInput(
  body: ChatQuestionSuggestionsBody | undefined,
): ValidatedChatQuestionSuggestionsInput | { ok: false; message: string } {
  if (
    !body ||
    !body.chart ||
    !Array.isArray(body.chart.palaces) ||
    body.chart.palaces.length !== 12
  ) {
    return { ok: false, message: 'Thiếu dữ liệu lá số Tử Vi 12 cung hợp lệ.' };
  }

  if (body.excerpt !== undefined && typeof body.excerpt !== 'string') {
    return { ok: false, message: 'Trường excerpt phải là chuỗi ký tự.' };
  }

  if (body.chapterId !== undefined && !isValidDossierChapterId(body.chapterId)) {
    return {
      ok: false,
      message: 'chapterId không hợp lệ cho gợi ý câu hỏi chương hồ sơ.',
    };
  }

  if (
    typeof body.contextKey === 'string' &&
    body.contextKey.startsWith('dossier_') &&
    !isValidDossierChapterId(body.chapterId)
  ) {
    return {
      ok: false,
      message: 'Thiếu chapterId hợp lệ khi ngữ cảnh thuộc chương hồ sơ.',
    };
  }

  const contextMode: 'natal' | 'period' | 'heming' =
    body.contextMode === 'period' || body.contextMode === 'heming'
      ? body.contextMode
      : 'natal';

  const resolvedChapterId: DossierChapterId = isValidDossierChapterId(body.chapterId)
    ? body.chapterId
    : contextMode === 'period'
      ? 'year_2026'
      : 'chapter_overview';

  const askedRes = validateExclusionArray(body.askedQuestions, 'askedQuestions');
  if (!askedRes.ok) return askedRes;

  const prevRes = validateExclusionArray(
    body.previousSuggestions,
    'previousSuggestions',
  );
  if (!prevRes.ok) return prevRes;

  const excerpt =
    typeof body.excerpt === 'string'
      ? trimChatExcerpt(body.excerpt, CHAT_MAX_EXCERPT_CHARS)
      : '';

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
    chapterId: resolvedChapterId,
    isFallbackFactSheet: Boolean(body.isFallbackFactSheet),
    askedQuestions: askedRes.items,
    previousSuggestions: prevRes.items,
  };
}

export function buildChatQuestionSuggestionsPrompt(params: {
  chart: ZiweiChart;
  chartB?: ZiweiChart | null;
  contextMode: 'natal' | 'period' | 'heming';
  sectionTitle: string;
  periodContext?: YunxianPeriodContext | null;
  excerpt: string;
  chapterId: DossierChapterId;
  isFallbackFactSheet?: boolean;
  askedQuestions?: readonly string[];
  previousSuggestions?: readonly string[];
  retryReason?: string;
}): { systemInstruction: string; prompt: string } {
  const factTable = buildChatFactTableForContextVi(params.chart, {
    contextMode: params.contextMode,
    periodContext: params.periodContext,
    chartB: params.chartB,
    includeHorizonStart: 2026,
    includeHorizonEnd: 2035,
  });

  const fewShotQuestions =
    FEW_SHOT_QUESTIONS_BY_CHAPTER[params.chapterId] ??
    FEW_SHOT_QUESTIONS_BY_CHAPTER.chapter_overview;
  const fewShotBlock = fewShotQuestions
    .map((q, idx) => `${idx + 1}. ${q}`)
    .join('\n');

  const asked = (params.askedQuestions ?? []).filter((q) => q.trim().length > 0);
  const previous = (params.previousSuggestions ?? []).filter(
    (q) => q.trim().length > 0,
  );
  const exclusionLines: string[] = [];
  if (asked.length > 0) {
    exclusionLines.push('Các câu đương số đã hỏi trong mạch này:');
    for (const q of asked) exclusionLines.push(`- ${q}`);
  }
  if (previous.length > 0) {
    exclusionLines.push('Bộ gợi ý đang hiển thị trước đó (bắt buộc đổi khác hẳn):');
    for (const q of previous) exclusionLines.push(`- ${q}`);
  }

  const thinChapterHint =
    params.chapterId === 'year_2026'
      ? '\n- Riêng chương Lưu Niên 2026 thường gọn dữ kiện liệt kê sao: hãy tập trung vào điểm căng giữa cát và hung trong cùng một cung, tránh hỏi lặp lại danh sách sao.'
      : '';

  const retryDirective = params.retryReason
    ? `\n\n[CHỈ THỊ SINH LẠI BẮT BUỘC — LẦN 2]: Lần sinh trước vi phạm quy chuẩn (${params.retryReason}). Bắt buộc trả về JSON thuần đúng 3 câu hỏi KHÁC NHAU, mỗi câu NGẮN GỌN 110–170 ký tự (TUYỆT ĐỐI ≤ ${SUGGESTION_MAX_CHARS} ký tự), xưng hô "đương số", không dùng cấu trúc xin lời khuyên, không trùng danh sách loại trừ và TUYỆT ĐỐI KHÔNG gọi tên bộ sao đôi (như "Không Kiếp") khi cung không có đủ cặp Địa Không + Địa Kiếp trong Tam Phương Tứ Chính.`
    : '';

  const systemInstruction = `Bạn là trợ lý biên tập câu hỏi nghiên cứu Tử Vi Đẩu Số theo hệ thống Thiên Kỷ.
Nhiệm vụ duy nhất: sinh đúng 3 gợi ý câu hỏi mẫu KHÁC NHAU để người đọc bấm chọn hoặc tham khảo cách đặt câu hỏi đúng cho chương đang xem.

QUY TẮC BẮT BUỘC 100%:
1. ĐÚNG 3 CÂU, 3 GÓC KHÁC NHAU trong 4 dạng điểm căng sau (không lặp góc, không lặp ý):
   - Góc (1): Điều kiện nào làm kết luận đổi chiều.
   - Góc (2): Dấu hiệu nào phân biệt hai trạng thái đối lập.
   - Góc (3): Mốc nào cho thấy đã vượt ngưỡng.
   - Góc (4): Việc nào làm trước (gắn thứ tự ưu tiên với dấu hiệu sao/cung cụ thể).
2. BÁM ĐÚNG NỘI DUNG CHƯƠNG + BẢNG DỮ KIỆN: Mỗi gợi ý phải hỏi về một điểm cụ thể (sao, cung, Tứ Hóa, năm/hạn) có thật trong [TOÀN VĂN CHƯƠNG ĐANG XEM] hoặc [BẢNG DỮ KIỆN LÁ SỐ XÁC ĐỊNH]. Không thêm sao, cung, năm, cách cục hay con số ngoài hai nguồn này. Không hỏi lại điều chương đã trả lời rõ ràng.${thinChapterHint}
3. CẤM XIN LỜI KHUYÊN CHUNG CHUNG: Tuyệt đối KHÔNG dùng "có nên...?", "nên làm gì / ưu tiên / đầu tư / chọn / hoãn / giữ / rà soát / hạn chế / chuẩn bị...", "cần chuẩn bị / làm gì...", "làm gì...".
4. TUÂN THỦ Z4: Không gọi tên bộ sao đôi ("Không Kiếp", "Địa Không - Địa Kiếp", ...) trừ khi cả Địa Không và Địa Kiếp thực sự hiện diện trong Tam Phương Tứ Chính của cung được hỏi.
5. XƯNG HÔ & ĐỘ DÀI: Chỉ xưng hô "đương số" (CẤM "bạn", "thân chủ", "mệnh chủ", "quý khách", "anh/chị", "tôi", "chúng tôi"; chỉ dùng "bạn bè"/"bạn đời"/"bạn đồng hành" nếu thật sự nói về đối tượng). Mỗi gợi ý NGẮN GỌN (khuyến nghị 110–175 ký tự, TUYỆT ĐỐI ≤ ${SUGGESTION_MAX_CHARS} ký tự kể cả khoảng trắng; viết cô đọng, không kéo dài mệnh đề như văn mẫu), tiếng Việt tự nhiên, không chữ Hán, không định dạng markdown đậm/nghiêng.
6. ĐỊNH DẠNG ĐẦU RA: Chỉ trả về JSON thuần hợp lệ đúng mẫu {"suggestions":["...","...","..."]}, không thêm lời dẫn, không giải thích, không bọc markdown nếu không cần.${retryDirective}`;

  const excerptHeader = params.isFallbackFactSheet
    ? '[ĐOẠN TRÍCH CHƯƠNG (CHƯƠNG CHƯA SINH — DÙNG BẢNG DỮ KIỆN LÀM NEO)]'
    : '[TOÀN VĂN CHƯƠNG ĐANG XEM]';

  const prompt = `Chương đang mở: **${params.sectionTitle}** (${params.chapterId})

=== 1. BẢNG DỮ KIỆN LÁ SỐ XÁC ĐỊNH ===
${factTable}

=== 2. ${excerptHeader} ===
${params.excerpt || '(Chương chưa có văn bản, hãy bám sát Bảng Dữ Kiện Lá Số Xác Định ở mục 1.)'}

=== 3. CÂU HỎI MẪU THAM KHẢO PHONG CÁCH CHO CHƯƠNG NÀY (FEW-SHOT — CHỈ HỌC CẤU TRÚC ĐIỂM CĂNG, KHÔNG SAO CHÉP NGUYÊN VĂN NẾU KHÁC LÁ SỐ VÀ BẮT BUỘC VIẾT CÔ ĐỌNG ≤ 175 KÝ TỰ/CÂU) ===
${fewShotBlock}

=== 4. DANH SÁCH LOẠI TRỪ (KHÔNG SINH TRÙNG HOẶC GẦN TRÙNG) ===
${exclusionLines.length > 0 ? exclusionLines.join('\n') : '(Chưa có câu hỏi loại trừ.)'}

Hãy trả về đúng JSON thuần {"suggestions": ["...", "...", "..."]}.`;

  return { systemInstruction, prompt };
}

export function normalizeSuggestionForCompare(text: string): string {
  return text
    .normalize('NFC')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function parseAndSanitizeSuggestionsResponse(
  rawText: string,
): { ok: true; suggestions: string[] } | { ok: false; reason: string } {
  if (!rawText || typeof rawText !== 'string') {
    return { ok: false, reason: 'Phản hồi rỗng từ model.' };
  }

  // ĐK-HD1-03: lọc ký tự ngoại lai trước khi parse và gỡ markdown fence
  const layer3a = sanitizeLayer3AOnly(rawText).trim();
  const unfenced = layer3a
    .replace(/^```(?:json)?\s*/iu, '')
    .replace(/\s*```$/iu, '')
    .trim();

  const firstBrace = unfenced.indexOf('{');
  const lastBrace = unfenced.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    return { ok: false, reason: 'Không tìm thấy khối JSON hợp lệ trong phản hồi.' };
  }

  const jsonCandidate = unfenced.slice(firstBrace, lastBrace + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch {
    return { ok: false, reason: 'JSON.parse thất bại trên phản hồi của model.' };
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as { suggestions?: unknown }).suggestions)
  ) {
    return { ok: false, reason: 'JSON thiếu mảng suggestions.' };
  }

  const rawSuggestions = (parsed as { suggestions: unknown[] }).suggestions;
  const cleaned: string[] = [];
  for (const item of rawSuggestions) {
    if (typeof item !== 'string') {
      return { ok: false, reason: 'Mục trong suggestions không phải chuỗi.' };
    }
    const sanitized = sanitizeAiVietnameseOutput(item)
      .replace(/\*\*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    cleaned.push(sanitized);
  }

  return { ok: true, suggestions: cleaned };
}

export interface VerifyQuestionSuggestionsGateOptions {
  chart: ZiweiChart;
  chapterId: DossierChapterId;
  periodContext?: YunxianPeriodContext | null;
  askedQuestions?: readonly string[];
  previousSuggestions?: readonly string[];
}

export function verifyQuestionSuggestionsGate(
  suggestions: readonly string[],
  options: VerifyQuestionSuggestionsGateOptions,
):
  | { ok: true; suggestions: string[] }
  | { ok: false; failedAt: 'gate_a' | 'gate_b'; reason: string } {
  // ─── Bước (a): Cổng định dạng + văn phong + exclusion (BẮT BUỘC CHẠY TRƯỚC) ───
  if (!Array.isArray(suggestions) || suggestions.length !== SUGGESTION_COUNT) {
    return {
      ok: false,
      failedAt: 'gate_a',
      reason: `Số lượng gợi ý phải đúng ${SUGGESTION_COUNT} (nhận ${Array.isArray(suggestions) ? suggestions.length : 0}).`,
    };
  }

  const exclusionSet = new Set<string>();
  for (const item of [
    ...(options.askedQuestions ?? []),
    ...(options.previousSuggestions ?? []),
  ]) {
    const norm = normalizeSuggestionForCompare(item);
    if (norm) exclusionSet.add(norm);
  }

  const seenNormalized = new Set<string>();
  const normalizedList: string[] = [];

  for (let i = 0; i < suggestions.length; i += 1) {
    const raw = typeof suggestions[i] === 'string' ? suggestions[i] : '';
    const trimmed = raw.replace(/\s+/g, ' ').trim();
    if (!trimmed) {
      return {
        ok: false,
        failedAt: 'gate_a',
        reason: `Gợi ý #${i + 1} bị rỗng.`,
      };
    }
    if (trimmed.length > SUGGESTION_MAX_CHARS) {
      return {
        ok: false,
        failedAt: 'gate_a',
        reason: `Gợi ý #${i + 1} vượt quá ${SUGGESTION_MAX_CHARS} ký tự (${trimmed.length}).`,
      };
    }

    const norm = normalizeSuggestionForCompare(trimmed);
    if (seenNormalized.has(norm)) {
      return {
        ok: false,
        failedAt: 'gate_a',
        reason: `Gợi ý #${i + 1} bị trùng lặp với gợi ý khác trong bộ.`,
      };
    }
    if (exclusionSet.has(norm)) {
      return {
        ok: false,
        failedAt: 'gate_a',
        reason: `Gợi ý #${i + 1} trùng với câu đã hỏi hoặc bộ gợi ý trước đó.`,
      };
    }
    seenNormalized.add(norm);

    if (FORBIDDEN_PRONOUN_RE.test(trimmed)) {
      return {
        ok: false,
        failedAt: 'gate_a',
        reason: `Gợi ý #${i + 1} vi phạm ngôi xưng (chỉ dùng "đương số").`,
      };
    }
    if (FORBIDDEN_ADVICE_QUESTION_RE.test(trimmed)) {
      return {
        ok: false,
        failedAt: 'gate_a',
        reason: `Gợi ý #${i + 1} dùng cấu trúc xin lời khuyên bị cấm.`,
      };
    }
    normalizedList.push(trimmed);
  }

  // ─── Bước (b): Cổng KP-3 tên bộ sao đôi từng gợi ý độc lập (ĐK-HD1-02, ĐK-HD2-01) ───
  const scopePalaces = DOSSIER_CHAPTER_SCOPE_PALACES_VI[options.chapterId];
  for (let i = 0; i < normalizedList.length; i += 1) {
    const suggestion = normalizedList[i];
    const flags = verifyIllegalKhongKiepMentions(suggestion, options.chart, {
      periodContext: options.periodContext,
      sectionId: options.chapterId,
    });
    if (flags.length > 0) {
      return {
        ok: false,
        failedAt: 'gate_b',
        reason: `Gợi ý #${i + 1} vi phạm KP-3 (${flags[0].messageVi}).`,
      };
    }

    KHONG_KIEP_PAIR_RE.lastIndex = 0;
    const mentionsPair = KHONG_KIEP_PAIR_RE.test(suggestion);
    if (mentionsPair && !KHONG_KIEP_NEGATION_RE.test(suggestion)) {
      const scopeHasPair = chapterScopeHasKhongKiepPair(
        options.chart,
        scopePalaces,
      );
      if (!scopeHasPair) {
        return {
          ok: false,
          failedAt: 'gate_b',
          reason: `Gợi ý #${i + 1} nhắc bộ sao "Không Kiếp" nhưng phạm vi chương (${options.chapterId}) không có cung nào đủ cả Địa Không lẫn Địa Kiếp trong Tam Phương Tứ Chính.`,
        };
      }
    }
  }

  return { ok: true, suggestions: normalizedList };
}
