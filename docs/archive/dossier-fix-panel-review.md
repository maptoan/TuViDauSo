> ⚠️ **[TÀI LIỆU LỊCH SỬ ĐÃ LƯU TRỮ — KHÔNG DÙNG LÀM CĂN CỨ CODE HIỆN HÀNH]**
> - **Trạng thái**: Đã hoàn thành vai trò lịch sử / Đã bị thay thế bởi tài liệu sống **[`docs/decisions-registry.md`](../decisions-registry.md) & [`docs/features-dossier-and-chat.md`](../features-dossier-and-chat.md)** từ ngày `17/11/2026`.
> - **Cảnh báo cho Kỹ sư & AI Agent**: Các trích dẫn số dòng, tên biến, hằng số (như ngân sách 25s, nhịp nghỉ 2200ms, số lượng key 3/23) trong file này phản ánh thời điểm trước khi hợp nhất và **không còn khớp với mã nguồn hiện hành**. Tuyệt đối đọc tài liệu sống tại thư mục `docs/` gốc và đối chiếu code thật trước khi chẩn đoán hoặc sửa code!

---
# BIÊN BẢN PHẢN BIỆN CỦA TỔ CHUYÊN GIA (MÔ PHỎNG ĐA VAI) ĐỐI VỚI KẾ HOẠCH V1

- **Dự án:** Tử Vi Thiên Kỷ (Tử Vi Đẩu Số)
- **Tài liệu biên bản:** `docs/dossier-fix-panel-review.md`
- **Tài liệu được thẩm định:** `docs/dossier-fix-plan-v1.md` (giữ nguyên bản gốc V1 để đối chiếu)
- **Tài liệu đầu ra kế tiếp:** `docs/dossier-fix-plan-v2.md`
- **Ngày họp phản biện:** 17/11/2026
- **Model vận hành:** Gemini 4 Argon (`models/gemini-4-argon`)

---

## 0. TUYÊN BỐ MINH BẠCH VỀ CƠ CHẾ PANEL MÔ PHỎNG

> **Nguyên tắc minh bạch bắt buộc:**
> Trong môi trường Google AI Studio, không tồn tại nhiều tiến trình chuyên gia độc lập chạy tách biệt. Toàn bộ biên bản phản biện dưới đây là **kết quả MÔ PHỎNG ĐA VAI trong MỘT phiên Gemini 4 Argon duy nhất**.
> Để đảm bảo tính khách quan và chiều sâu phản biện, phiên Argon lần lượt nhập vai độc lập theo 5 góc nhìn chuyên môn có lợi ích/tiêu chuẩn kiểm định đối lập nhau:
> 1. **Vai 1 — Kiến trúc sư Hệ thống (System Architect):** Kiểm soát luồng dữ liệu SSE, tính nhất quán của các tầng cache (`aiPeriodCache`, `localChapters`, `sessionStorage`), độ rộng bố cục và hiệu năng.
> 2. **Vai 2 — Chuyên gia Prompt & Ngôn ngữ học (Prompt & NLP Engineer):** Kiểm soát cơ chế sinh văn bản của `gemini-3.5-flash-lite`, giới hạn của prompt và nguy cơ dương tính giả (false positive) khi hậu xử lý ngôn ngữ tự nhiên.
> 3. **Vai 3 — Chuyên gia Tử Vi Đẩu Số (Ziwei Domain Expert):** Kiểm soát tính chuẩn xác mệnh lý của nhãn vai trò cung Lưu Niên, quy tắc Can Chi, lưới 12 cung 4×4 truyền thống và khối kết luận nhanh 5 dòng.
> 4. **Vai 4 — Chuyên gia Thiết kế In ấn & Chế bản (Print & Editorial Designer):** Kiểm soát độ tương phản khi in laser đen trắng / photocopy, định dạng `.MD` so với `.HTML`/In, ngắt trang A4 và tiêu chuẩn thẩm mỹ "Giấy Cổ".
> 5. **Vai 5 — Kỹ sư Kiểm chứng & Đảm bảo chất lượng (Verification & QA Engineer):** Kiểm soát phản chứng toán học/ngôn ngữ, độ phủ unit test bằng fixture thật và kỷ luật tiết kiệm quota (trong bối cảnh kho key chỉ có 3 key khỏe và Google hay trả lỗi 503).
>
> Sau phần phát biểu độc lập của 5 vai, **Điều phối viên Panel** tổng hợp các điểm đồng thuận, các điểm còn tranh cãi và đóng gói thành bộ quyết định **`QĐ-G1`..`QĐ-G6`** trình Chủ dự án phê duyệt.

---

## 1. Ý KIẾN PHẢN BIỆN ĐỘC LẬP CỦA 5 VAI CHUYÊN GIA THEO TỪNG HẠNG MỤC (S1–S5 & B1–B6)

### 1.1. Vai 1 — Kiến trúc sư Hệ thống (System Architect)

- **Về (S1) & Ràng buộc (P3):**
  - Đồng ý với V1 mục 2.1 về việc **bác bỏ Phương án (c) tự động sinh lại** vì kho key chỉ có 3 key khỏe và rủi ro lỗi 503 cao.
  - Tuy nhiên, V1 mục 2.1c viết vị trí đặt hàm hậu kiểm `verifyAndEnsureCompletePeriodSiHua` là *"tại `src/lib/ziwei/yunxian-context.ts` hoặc `src/lib/dossier-chat-ui.ts` + điểm chốt luồng"* — còn lấp lửng giữa 2 nơi gọi `POST /api/interpret-period` là `DetailedDossierModal.tsx` (`executeSingleChapterStream`, dòng `298–580`) và `InsightPanel.tsx` (`requestPeriodAiInterpretation`, dòng `146–303`).
  - **Đề xuất kiến trúc:** Vì cả `DetailedDossierModal.tsx` (dòng `320`) và `InsightPanel.tsx` (dòng `167`) đều đã có sẵn object `periodContext: YunxianPeriodContext` ngay trước khi gọi `/api/interpret-period`, hoặc bản thân route `POST /api/interpret-period` (`server.ts:623–713`) đã nhận `periodContext` trong `req.body`, ta có thể thực thi hậu kiểm xác định ngay ở điểm kết thúc luồng để đảm bảo `aiPeriodCache` nhận văn bản đã được bổ khuyết đủ 4 hóa dù người dùng bấm sinh từ Tab Vận Hạn hay từ Modal Hồ Sơ.
- **Về (S2) & Ràng buộc (P4):**
  - Đồng thuận hoàn toàn việc bổ sung `oppositePeriodPalaceRoleVi` vào `YunxianSiHuaTarget` (`yunxian-context.ts:30–42`) và giữ lại cả `periodPalaceRoleVi` + `oppositePeriodPalaceRoleVi` trong `MultiYearSiHuaEntry` (`dossier-context.ts:547–558`). Việc này không làm thay đổi chữ ký hàm public nào của Engine.
- **Về (S3) & Ràng buộc (P2 — Vị trí bộ lọc duy nhất):**
  - Phân tích kỹ 2 điểm chèn trong code thật:
    1. Nếu chèn ở Server (`sendSseText` tại `server.ts:123–125` hoặc `executor.ts:234–245`): chỉ lọc được ký tự đơn lẻ theo Script Unicode (như `φ`), **không sửa được** từ dính `"căngđộ"`, `"kho lứa"` hay tiêu đề `### Cung ...` khi một từ bị cắt làm 2 mảnh SSE chunk (`"căng"` + `"độ"`).
    2. Hơn nữa, nếu người dùng đã có dữ liệu lưu trong `sessionStorage` (`ziwei_dossier_v1::...` đọc qua `readDossierCacheEntry` tại `dossier-chat-ui.ts:403`) từ phiên trước khi vá code, bộ lọc chỉ đặt ở luồng SSE sẽ **không làm sạch được dữ liệu cache cũ đang nằm trong trình duyệt**!
  - **Kiến trúc chốt:** Đặt hàm gốc `sanitizeAiVietnameseOutput` tại module dùng chung `src/lib/ziwei/text-sanitizer.ts`, gọi ở **điểm chốt chuỗi tích lũy `accumulated` trước mọi lệnh ghi cache** (`DetailedDossierModal.tsx:481`, `InsightPanel.tsx:268 & 407`, `ContextualChatDrawer.tsx:360`), **ĐỒNG THỜI** bọc luôn trong `readDossierCacheEntry` (`dossier-chat-ui.ts:403`) để tự động làm sạch cache cũ ngay khi đọc lên mà tốn 0 quota!
- **Về (S4) & Ràng buộc (P5 — Tiêu đề mục cung):**
  - Bác bỏ **Cách P5-B** (đổi cấu trúc `DossierChapterState.text` từ chuỗi Markdown sang mảng 4 cung rời): nếu sửa cấu trúc state sẽ làm gãy toàn bộ `sessionStorage` hiện có, gãy `simpleMarkdownToHtml` (`dossier-chat-ui.ts:891`) và gãy `sectionExcerpt` gửi vào `/api/interpret-chat`.
  - Chọn **Cách P5-A** (`enforceCanonicalPalaceGroupHeadings`): giữ nguyên kiểu `text: string`, ép dòng tiêu đề `### Cung ...` theo dữ kiện chuẩn từ `chart.palaces` ngay trước khi ghi cache và khi đọc cache `sessionStorage`.
- **Về Mảng B — Điểm nghẽn bố cục ở (B3) Bảng Ma Trận 8 Cột:**
  - **Phản biện V1 mục 3 (B3):** V1 đề xuất bảng HTML/In gồm **8 cột ngang** (`Năm | Tuổi | Đại Hạn | Quan Hệ ĐH-LN | Lưu Mệnh | Lưu Tứ Hóa | Sao Lưu Trọng Yếu | Cảnh Báo Xung Hợp`). Trên khổ giấy A4 dọc (210mm trừ lề 28mm còn **182mm**), bảng 8 cột chứa chuỗi Lưu Tứ Hóa dài sẽ khiến mỗi cột chỉ rộng trung bình ~22mm — chữ tiếng Việt sẽ bị gãy dòng từng từ một (1 chữ/dòng), kéo dài bảng qua nhiều trang và làm vỡ khung in!
  - **Yêu cầu sửa trong V2:** Gộp bảng hiển thị ở B3 xuống còn **5 cột cân đối** (`Năm & Tuổi (12%) | Đại Hạn & Tương Quan (18%) | Trục Lưu Mệnh (16%) | 4 Sao Lưu Tứ Hóa & Vai Trò Lưu (34%) | Sao Lưu & Xung Hợp (20%)`) với `<colgroup>` cố định.

---

### 1.2. Vai 2 — Chuyên gia Prompt & Ngôn ngữ học (Prompt & NLP Engineer)

- **Phát hiện sai số trích dẫn trong V1 mục 2.1a (Vấn đề mới T1):**
  - V1 mục 2.1a viết: *"Khác với `buildStrictDossierSectionPrompt` (`server.ts:356` ghi rõ '4 sao Lưu Tứ Hóa (Lộc, Quyền, Khoa, Kỵ)')"*.
  - Đối chiếu bằng chứng Bước 1 (`server.ts:355–357`): Câu ở dòng 356 thực chất là câu **giới hạn nguồn trích dẫn** (*"BẠN CHỈ ĐƯỢC PHÉP trích dẫn Năm, Tuổi, ..., 4 sao Lưu Tứ Hóa..."*), chứ không phải mệnh lệnh bắt buộc phân tích đủ 4 hóa! Sở dĩ Chương 7 có đủ 4 hóa trong bảng là nhờ hàm dữ kiện `dossier-context.ts:876–884` đã in sẵn cả 4 hóa trên 1 dòng. V2 phải sửa lại nhận định này cho chính xác.
- **Về (S3) & Ràng buộc (P1 — Tách 2 lớp lỗi `"cácφ"` và `"căngđộ"`):**
  - Hoàn toàn đồng ý phải tách **Lớp 3A (Ký tự hệ chữ ngoại lai)** và **Lớp 3B (Dính từ tiếng Việt)**.
  - Với Lớp 3A: Danh sách đen theo Unicode Script (`Greek`, `Cyrillic`, `Hebrew`, `Arabic`, `Thai`, `Devanagari`, `Hangul`, `Hiragana`, `Katakana`, `\uFFFD`) cộng với `\p{Script=Han}` khi `allowHanzi = false` là chuẩn xác, giữ an toàn tuyệt đối cho `↔`, `→`, `•`, `%`, `–`, `—`, `°`.
- **Phản biện gay gắt đối với V1 mục 2.4c về sửa tự động `"bảo Thủ"` và `"canh Thìn/Dần"` (Vấn đề mới T3 — Nguy cơ dương tính giả):**
  - Trong V1 mục 2.4c có câu: *"(và quy tắc tổng quát cho các tính từ ghép tiếng Việt thông dụng bị viết hoa âm tiết thứ hai sau chữ thường mà không phải tên sao/tên cung/tên riêng)"* và đề xuất chuẩn hóa tự động `"canh <Địa Chi>"`.
  - **BÁC BỎ quy tắc viết thường tổng quát bằng regex!** Trong văn bản Tử Vi, sau một từ viết thường có hàng trăm thuật ngữ chuyên ngành viết hoa chữ cái đầu ngay kế tiếp, ví dụ: `"sao Phá Quân"`, `"cung Tài Bạch"`, `"cách Tử Phủ Vũ Tướng"`, `"gặp Hóa Lộc"`, `"đóng tại Mệnh"`. Một regex tổng quát hạ chữ hoa âm tiết thứ hai sẽ phá hỏng tên sao và tên cung! Chỉ được phép thay thế theo **danh sách từ ghép sai hoa/thường hoặc sai dấu cố định cực hẹp** đã kiểm chứng không trùng tên sao/cung (`"kho lứa"` $\rightarrow$ `"kho lúa"`, `"bảo Thủ"` $\rightarrow$ `"bảo thủ"`).
  - Tương tự, với `"canh Thìn/Dần"`: **CẤM dùng regex tự động đổi `"canh Thìn"` thành `"can Thìn"`**, vì `"can Thìn"` là sai ngữ pháp Tử Vi (Thìn là Địa Chi, không phải Thiên Can!). Lỗi này phải xử lý ở **Prompt (`server.ts:371–375`)**: cấm viết `"can <Địa Chi>"` hoặc `"canh <Địa Chi>"` chữ thường; bắt buộc viết đúng `"cung <Địa Chi> (<Can Chi đầy đủ>)"` (ví dụ: `"cung Thìn (Mậu Thìn)"`).

---

### 1.3. Vai 3 — Chuyên gia Tử Vi Đẩu Số (Ziwei Domain Expert)

- **Kiểm tra khẳng định âm vị học ở (P1) và thuật ngữ Tử Vi:**
  - Trong toàn bộ hệ thống thuật ngữ Tử Vi Đẩu Số tiếng Việt (14 chính tinh, >95 phụ tinh, 12 cung, 10 Thiên Can, 12 Địa Chi, 12 vòng Trường Sinh, 12 Bác Sỹ, 12 Thái Tuế), các từ có chữ `đ`/`Đ` đều đặt `đ` ở đầu âm tiết (`Đế Vượng`, `Đào Hoa`, `Đà La`, `Đường Phù`, `Địa Không`, `Địa Kiếp`, `Điền Trạch`, `Đẩu Quân`, `Đại Hạn`, `Đại Hao`, `Đinh`, `Độ`). Không có bất kỳ thuật ngữ Tử Vi nào có chữ `đ` nằm giữa hoặc cuối âm tiết. Tuy nhiên, tôi đồng ý với Kỹ sư kiểm chứng (Vai 5) là cần rào kỹ biên regex để không cắt nhầm trường hợp đặc biệt ngoài dự kiến.
- **Về (S2) & Ràng buộc (P4 — Bản chất mệnh lý của nhãn Lưu Niên):**
  - **Phát hiện lỗi diễn đạt trong V1 mục 1.1:** V1 mục 1.1 ghi *"ma trận năm ở Chương 7 (`horizon_5y`) ghi đủ cả 4 hóa"*, và mục P4 gợi ý *"như ma trận chương 7/8 đã làm đúng"*. Thực tế bằng chứng Bước 1 (`dossier-context.ts:733–765`) cho thấy ma trận Chương 7/8 tuy ghi đủ 4 hóa nhưng **ĐANG THIẾU nhãn vai trò cung Lưu Niên (`periodPalaceRoleVi`)** của cả 4 hóa đó!
  - Trong Tử Vi, khi xem Lưu Niên (hoặc Đại Hạn), một sao Lưu Tứ Hóa rơi vào cung nào thì phải luận đồng thời **"Khung sự việc của năm đó (Cung Lưu Niên)"** chồng lên **"Nền tảng gốc của cuộc đời (Cung Bản Mệnh)"**. Ví dụ năm 2027 (Đinh Mùi) của lá số Nguyễn Văn An: Lưu Mệnh tại Mùi, tam hợp là **Lưu Tài Bạch tại Mão (trùng Mệnh Cung gốc)** và **Lưu Quan Lộc tại Hợi (trùng Tài Bạch gốc)**. Nếu bảng dữ kiện không in sẵn bảng 12 cung Lưu Niên và không gắn chữ **`Lưu ...`** vào cả cung tọa thủ lẫn đối cung xung chiếu của Tứ Hóa / Sao Lưu, AI sẽ lấy tên cung Bản Mệnh gốc ghép bừa vào chữ "tam hợp".
  - Do đó, việc thêm **Bảng Ánh Xạ Đầy Đủ 12 Cung Kỳ Hạn ↔ 12 Cung Bản Mệnh Gốc** vào `factTableMarkdown` (`yunxian-context.ts`) và bổ sung `periodPalaceRoleVi` + `oppositePeriodPalaceRoleVi` vào cả `yunxian-context.ts` lẫn `dossier-context.ts` là **bắt buộc về mặt học thuật Tử Vi**.
- **Kiểm tra (B2) — Sơ đồ lưới 12 cung 4×4 truyền thống:**
  - **Phát hiện thiếu sót nghiêm trọng trong V1 mục 3 (B2):** V1 chỉ viết *"Dựng lưới CSS Grid 4×4 truyền thống (12 cung xung quanh theo đúng vị trí Địa Chi Tý..Hợi, ô Thiên Bàn 2×2 ở giữa)"* nhưng **chưa chỉ định tọa độ dòng/cột (`grid-row`, `grid-column`) cho từng Địa Chi**!
  - Trong lá số Tử Vi truyền thống chuẩn, vị trí 12 Địa Chi trên lưới 4×4 là **BẤT DI BẤT DỊCH** (chiều kim đồng hồ bắt đầu từ Tỵ ở góc trên bên trái):
    - **Hàng 1 (trên cùng, trái qua phải):** `Tỵ (branch=5): row 1, col 1` | `Ngọ (branch=6): row 1, col 2` | `Mùi (branch=7): row 1, col 3` | `Thân (branch=8): row 1, col 4`
    - **Cột 4 (bên phải, trên xuống dưới):** `Thân (8): row 1, col 4` | `Dậu (branch=9): row 2, col 4` | `Tuất (branch=10): row 3, col 4` | `Hợi (branch=11): row 4, col 4`
    - **Hàng 4 (dưới cùng, trái qua phải):** `Dần (branch=2): row 4, col 1` | `Sửu (branch=1): row 4, col 2` | `Tý (branch=0): row 4, col 3` | `Hợi (branch=11): row 4, col 4`
    - **Cột 1 (bên trái, dưới lên trên):** `Dần (2): row 4, col 1` | `Mão (branch=3): row 3, col 1` | `Thìn (branch=4): row 2, col 1` | `Tỵ (5): row 1, col 1`
    - **Ô Trung tâm (Thiên Bàn):** `grid-row: 2 / span 2; grid-column: 2 / span 2`.
  - V2 **BẮT BUỘC** phải ghi cứng bảng tọa độ này vào đặc tả kỹ thuật của B2 để khi thi công không xếp nhầm thứ tự mảng `0..11`.
- **Kiểm tra (B6) — Khối "Kết Luận Nhanh 5 Dòng":**
  - Rà soát 5 dòng của B6 trong V1 mục 3:
    - Dòng 3 trong V1 viết: *"Nơi đóng của Hóa Lộc – Hóa Quyền – Hóa Khoa (nguồn lực) và Hóa Kỵ (điểm nghẽn cần tu dưỡng)"*.
    - Dòng 4 & 5 trong V1 viết: *"Đại hạn đang đi qua cung nào, Lưu Niên 2026 (Bính Ngọ) kích hoạt trục nào"* và *"Lưu Niên 2027 (Đinh Mùi) dịch chuyển trọng tâm sang cung nào"*.
  - **Xác nhận tính xác định 100%:** Tất cả 5 dòng này **HOÀN TOÀN suy ra xác định 100% từ dữ kiện toán học của `chart` và `buildYunxianPeriodContext` (chi phí AI = 0)**, với điều kiện:
    1. Không đưa nhận xét chủ quan (như khen/chê tốt xấu) vào template, mà chỉ in **tọa độ sao và cung xác định**:
       - Dòng 1 (**Căn cơ Mệnh – Cục**): `${chart.yinYangGenderVi} · Bản mệnh ${chart.nayinVi} · Cục ${chart.fiveElementsClassVi} (${relationLabelVi}) · Mệnh Chủ: ${chart.mingZhuVi} · Thân Chủ: ${chart.shenZhuVi}`.
       - Dòng 2 (**Trục Mệnh – Thân**): `Mệnh đóng tại ${mingPalace.branchVi} (${mingPalace.ganZhiVi}) [${mingMajors}]; Thân cư ${shenPalace.nameVi} tại ${shenPalace.branchVi} (${shenPalace.ganZhiVi}) [${shenMajors}]`.
       - Dòng 3 (**Tứ Hóa Năm Sinh — Can ${birthStemVi}**): `Hóa Lộc: ${locStar} (${locPalace}) · Hóa Quyền: ${quyenStar} (${quyenPalace}) · Hóa Khoa: ${khoaStar} (${khoaPalace}) · Hóa Kỵ: ${kyStar} (${kyPalace})`.
       - Dòng 4 (**Tiêu điểm Vận hạn 2026 — Bính Ngọ, ${age2026} tuổi**): `Đại hạn ${daXian2026} · Lưu Mệnh tại Ngọ (trùng ${natalAtNgo}) · Lưu Lộc tại ${loc2026Palace} / Lưu Kỵ tại ${ky2026Palace}`.
       - Dòng 5 (**Chuyển dịch Lưu Niên 2027 — Đinh Mùi, ${age2027} tuổi**): `Lưu Mệnh sang Mùi (trùng ${natalAtMui}) · Lưu Lộc tại ${loc2027Palace} / Lưu Kỵ tại ${ky2027Palace}`.
    2. Như vậy cả 5 dòng đều là dữ kiện thuần túy 100%, không cần gọi AI và thời gian tính toán $< 2\text{ms}$.

---

### 1.4. Vai 4 — Chuyên gia Thiết kế In ấn & Chế bản (Print & Editorial Designer)

- **Kiểm tra an toàn in đen trắng (B&W / Photocopy Safety) trên từng màu của V1 mục 3:**
  - Trong V1 mục 3:
    1. Màu nền màn hình `#fbf7ef` (ngà ấm) và `#f4ebd9` (thẻ phụ): V1 đã quy định chuyển về `#ffffff` trong `@media print` — **ĐẠT** (tránh hiện tượng nền xám hạt tram khi in laser đen trắng hoặc photocopy).
    2. Màu chữ chính `#231b15` (mực nâu đen): Độ tương phản trên nền trắng là `15.8:1` — **ĐẠT**. Khi in `@media print` nên ép về `#000000` để máy in dùng mực đen nguyên chất (K=100%) thay vì pha halftone.
    3. **CẢNH BÁO MÀU KHÔNG AN TOÀN KHI IN B&W TRONG V1:**
       - V1 mục 3 (B3) dùng đường kẻ ô bảng `#a8a29e` (Stone-400, độ sáng tương đối quá cao, tương phản với nền trắng chỉ `2.4:1`). Khi in trên máy in laser ở chế độ Eco/Draft hoặc photocopy, đường kẻ `#a8a29e` **sẽ bị đứt nét hoặc biến mất hoàn toàn**! **Sửa trong V2:** Trong `@media print`, toàn bộ đường kẻ bảng và khung lưới 12 cung phải dùng màu tối `#44403c` (Stone-700, tương phản `9.6:1`) hoặc `#1c1917` với độ dày tối thiểu `1pt` (`1px solid #44403c`).
       - V1 mục 3 (B5) dùng màu vàng đồng `#854d0e` cho điểm nhấn tiêu đề và đỏ chu sa `#991b1b` cho Hóa Kỵ / cảnh báo. Trên bản in đen trắng, `#854d0e` và `#991b1b` đều biến thành hai sắc xám trung bình gần giống hệt nhau (luminance ~`0.08` và `0.06`), người đọc **không thể phân biệt bằng màu sắc**! **Sửa trong V2:** Mọi thông tin phân loại (Chính tinh, Tứ Hóa Lộc/Quyền/Khoa/Kỵ, nhãn `[MỆNH]`/`[THÂN]`) trên lưới 12 cung (B2) và bảng ma trận (B3) **BẮT BUỘC phải phân biệt bằng hình học và ký hiệu văn bản** (chữ in đậm, ngoặc vuông `[Lộc]`, `[Quyền]`, `[Khoa]`, `[Kỵ]`, viền nét liền `solid` cho Cát hóa vs viền nét đứt `dashed` cho Hóa Kỵ), tuyệt đối không dựa vào màu sắc đơn thuần.
- **Kiểm tra ranh giới định dạng `.MD` so với `.HTML` / Bản In:**
  - Trong V1 mục 3, bảng tổng hợp ghi **B3 (Bảng ma trận năm)** và **B6 (Kết luận nhanh 5 dòng)** áp dụng cho *"`.HTML` độc lập, Bản In, Modal UI, **và cả `.MD`**"*.
  - **Phản biện:**
    - Với **B6 (5 dòng bullet điểm cốt tủy)**: Đưa vào đầu file `.MD` (dưới dạng danh sách bullet Markdown thuần) là hợp lý, sạch đẹp và dễ đọc trong mọi trình soạn thảo văn bản.
    - Với **B3 (Bảng ma trận năm)**: File `.MD` và nút `Sao chép toàn bộ` (`PlainText`) thường được người dùng dán vào Zalo, Messenger, Notes hoặc trình đọc Markdown hẹp. Một bảng Markdown nhiều cột dài hàng trăm ký tự trên 1 dòng sẽ bị tràn ngang không đọc nổi trong `.MD` và `PlainText`! Hơn nữa, đề bài đã lưu ý rõ: *"định dạng .md không mang được trình bày (thẩm mỹ chỉ áp cho HTML/in và modal trong app)"*.
    - **Chốt sửa trong V2:** Bỏ `.MD` khỏi phạm vi của **B3** (chỉ render bảng ma trận trực quan ở `.HTML`, Bản In `printSheetPortal` và trên giao diện Modal UI; còn `.MD` giữ nguyên văn bản chương thuần túy, chỉ kèm Header đầy đủ S5 và 5 dòng tóm tắt B6).
- **Về (B1) Trang bìa riêng & Vấn đề lãng phí giấy in (Vấn đề mới T4):**
  - Nếu B1 tạo 1 trang bìa riêng có `page-break-after: always`, rồi mỗi chương lại `break-before: page`, thì chỉ riêng phần mở đầu + Chương 1 đã tốn 2–3 tờ giấy A4.
  - **Đề xuất tối ưu chế bản A4 ("Trang Đầu Tích Hợp — Mệnh Thư Tổng Lược"):** Thiết kế Trang 1 của bản in / HTML gồm trọn vẹn 3 khối xác định: **(B1) Khung Quốc Huy/Triện Cổ & Thông Tin Khai Sinh Đầy Đủ (kèm Giờ Mặt Trời thật S5)** + **(B6) Khối Cốt Tủy Lá Số 5 Dòng** + **(B2) Sơ Đồ Lưới 12 Cung 4×4 Truyền Thống**, vừa khít đúng **1 trang A4 đầu tiên** (`page-break-after: always` đặt sau lưới 12 cung B2), rồi từ Trang 2 mới bắt đầu Chương 1! Cách này vừa trang trọng như một tờ "Mệnh Thư" cổ điển hoàn chỉnh ở Trang 1, vừa không lãng phí 1 trang giấy trắng chỉ để in vài dòng tên.

---

### 1.5. Vai 5 — Kỹ sư Kiểm chứng & Đảm bảo chất lượng (Verification & QA Engineer)

- **Kiểm định phản chứng cho khẳng định âm vị học ở (P1) — V1 mục 2.3a:**
  - Đề bài yêu cầu: *"Kiểm tra kỹ khẳng định trong V1 mục 2.3 về quy tắc âm vị 'đ không bao giờ đứng ở coda' — vai Tử Vi + kỹ sư kiểm chứng phải xác nhận hay hạ mức chắc chắn, nêu ví dụ phản chứng nếu có."*
  - **Kết quả kiểm định âm vị học & biểu thức chính quy:**
    1. **Về mặt âm vị học tiếng Việt thuần:** Khẳng định *"chữ `đ` (`U+0111`/`U+0110`) không bao giờ đứng ở vị trí phụ âm cuối (coda) hay đứng thứ hai trong cụm phụ âm đầu"* là **ĐÚNG** đối với âm tiết tiếng Việt chuẩn (coda tiếng Việt chỉ có `p, t, c, ch, m, n, ng, nh` và bán nguyên âm `i, y, u, o`; cụm phụ âm đầu chỉ có `ch, gh, gi, kh, nh, ng, ngh, ph, qu, th, tr`).
    2. **TUY NHIÊN, biểu thức chính quy trong V1 mục 2.3a là `/(?<=\p{L})(?=[đĐ]\p{L})/gu` có PHẢN CHỨNG thực tế nếu áp dụng rộng trên mọi `\p{L}`:**
       - **Phản chứng 1 (Từ mượn tiếng Anh / tên riêng nước ngoài có gõ nhầm hoặc phiên âm đặc biệt, hoặc chuỗi mã):** Ví dụ người dùng đặt tên đương số hoặc văn bản có từ ghép viết tắt/tên riêng, hoặc nếu chữ `Đ` viết hoa đứng sau chữ cái trong mã định danh.
       - **Phản chứng 2 (Giới hạn độ phủ của quy tắc `đ`):** Quy tắc này **chỉ bắt được các từ dính mà âm tiết thứ hai bắt đầu bằng `đ`/`Đ`** (như `"căngđộ"`, `"mứcđộ"`, `"tốcđộ"`, `"chếđộ"`, `"biếnđộng"`, `"giaiđoạn"`). Nó **HOÀN TOÀN KHÔNG bắt được** các lỗi dính từ mà âm tiết thứ hai bắt đầu bằng các phụ âm khác (ví dụ: `"pháttriển"`, `"tàibạch"`, `"quanlộc"`).
    3. **Kết luận điều chỉnh trong V2 (Hạ mức khẳng định & Siết chặt điều kiện biên):**
       - **Hạ mức khẳng định trong V2:** Không tuyên bố quy tắc chữ `đ` giải quyết được bài toán dính từ tiếng Việt nói chung; thừa nhận rõ đối với lỗi dính từ tổng quát (không bắt đầu bằng `đ`), bộ lọc regex không thể tự động cắt mà không gây nguy cơ cắt nhầm từ mượn/tên riêng, nên phải kết hợp giảm thiểu qua Prompt.
       - **Siết chặt regex tách chữ `đ` thường (`U+0111`):** Chỉ tách khi phía trước là **chữ cái tiếng Việt thường hợp lệ ở cuối âm tiết** (`[aăâeêioôơuưyáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵptcmnhg]`) và theo sau là **chữ `đ` thường (`đ`) cộng với nguyên âm tiếng Việt** (`/(?<=[aăâeêioôơuưyáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵptcmnhg])(?=đ[aăâeêioôơuưyáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ])/gu`). Nhờ chỉ khớp chữ `đ` thường tiếng Việt đứng trước nguyên âm tiếng Việt, độ an toàn đạt 100% (0 dương tính giả với từ tiếng Anh/Latin vì tiếng Anh chỉ có `d`, không có `đ` U+0111!).
- **Về (P8) — Kỷ luật Kiểm chứng Tiết kiệm Quota:**
  - Chốt bộ 6 bài kiểm chứng Offline (0 tốn quota) trong `scripts/verify-dossier-chat-ui.ts` và `scripts/verify-dossier-context.ts`, với tiêu chí Đạt/Không-đạt định lượng rõ ràng.
  - Với kiểm chứng Live: Do kho key chỉ có 3 key khỏe và Google hay trả 503, đề xuất trong V2 rằng **sau khi thi công chỉ chạy 100% bộ test Offline tự động**; việc bấm sinh Live 2 chương Lưu Niên (Chương 5 & Chương 6) sẽ do người dùng chủ động bấm trên UI khi muốn nghiệm thu trực tiếp (hoặc chỉ chạy khi người dùng yêu cầu rõ), để bảo toàn tuyệt đối 3 key khỏe cho người dùng.

---

## 2. XỬ LÝ CHÍNH THỨC 8 ĐIỂM PHẢN BIỆN CỦA BÊN ĐẶT HÀNG (`P1`–`P8`)

| Mã | Nội dung ràng buộc của bên đặt hàng | Quyết định của Panel | Lý do kỹ thuật & Bằng chứng code từ Bước 1 |
| :--- | :--- | :--- | :--- |
| **P1** | **Bộ lọc ký tự lạ (S3):** Cấm lọc mù "xóa mọi ký tự không phải tiếng Việt". Chỉ lọc theo danh sách hệ chữ không bao giờ hợp lệ (Hy Lạp, Cyrillic, Hebrew, Thái...) và Hán tự khi song ngữ tắt; giữ `↔, •, %`. Tách riêng lỗi dính từ `"căngđộ"`, kiểm tra kỹ khẳng định âm vị `"đ không đứng ở coda"`. | **CHẤP NHẬN & ĐIỀU CHỈNH CHẶT HƠN** | - **Bằng chứng Bước 1:** `server.ts:169` và `373` cấm chữ Hán trong bài luận tiếng Việt, nhưng UI có công tắc song ngữ và dùng rộng rãi `↔, →, •, %, –`.<br>- **Điều chỉnh so với V1:** (1) Tách rõ Lớp 3A (lọc glyph thuộc Script ngoại lai `Greek/Cyrillic/Hebrew/Arabic/Thai/Devanagari/Hangul/Kana/\uFFFD` + `Han` khi `allowHanzi=false`) và Lớp 3B (tách từ dính). (2) Hạ mức khẳng định của V1 mục 2.3: quy tắc âm vị chữ `đ` thường (`U+0111`) chỉ bắt được các cặp dính mà từ thứ hai bắt đầu bằng `đ` + nguyên âm tiếng Việt (như `"căngđộ"`, `"mứcđộ"`, `"tốcđộ"`, `"giaiđoạn"`), không giải quyết được mọi từ dính tiếng Việt bất kỳ; các từ dính khác chỉ giảm thiểu qua prompt + từ điển nhỏ đã biết. |
| **P2** | **Vị trí bộ lọc:** Đặt tại MỘT điểm duy nhất ngay khi nhận xong văn bản AI, TRƯỚC khi ghi bất kỳ cache nào để cache Hồ Sơ và cache Tab Luận Giải không lệch nhau. Cân nhắc Server chunk vs Client `accumulated`. | **CHẤP NHẬN (Chốt Phương án chính + Dự phòng)** | - **Bằng chứng Bước 1:** Luồng SSE đi qua `executor.ts:234–245` $\rightarrow$ `sendSseText` (`server.ts:123–125`) $\rightarrow$ client cộng dồn `accumulated` rồi ghi vào `aiPeriodCache` (`App.tsx:66`), `localChapters` (`DetailedDossierModal.tsx:124`) và `sessionStorage` (`DetailedDossierModal.tsx:175`).<br>- **Lý do chọn điểm chốt `accumulated` trước khi ghi cache (kèm bọc ở `readDossierCacheEntry`):** Lọc theo từng chunk rời rạc ở `sendSseText` sẽ bị trượt nếu từ `"căngđộ"` hoặc `"kho lứa"` bị cắt ngang giữa 2 chunk SSE. Do đó: **Phương án chính** là gọi hàm dùng chung `sanitizeAiVietnameseOutput` trên toàn bộ chuỗi `accumulated` ngay trước mọi lệnh ghi cache ở client (`DetailedDossierModal.tsx:435, 481`; `InsightPanel.tsx:235, 268, 395, 407`; `ContextualChatDrawer.tsx:325, 360`) **kết hợp** lọc Lớp 3A (ký tự đơn lẻ `Greek/Cyrillic...`) ngay tại `sendSseText` (`server.ts:123–125`) và bọc khi đọc `readDossierCacheEntry` (`dossier-chat-ui.ts:403`). |
| **P3** | **Hậu kiểm S1 (Lưu Niên thiếu Tứ Hóa):** Chỉ thêm prompt là yếu. Kiểm tra xác định văn bản có nhắc đủ 4 sao Lưu Tứ Hóa không; chọn giữa (a) tự chèn câu dữ kiện xác định, (b) gắn cờ UI, (c) sinh lại tự động — ưu tiên không tốn thêm lời gọi AI. | **CHẤP NHẬN PHƯƠNG ÁN (a) KẾT HỢP NHÃN MINH BẠCH; BÁC BỎ (c)** | - **Bằng chứng Bước 1:** `buildStrictPeriodAiPrompt` (`server.ts:152–202`) chưa ép điểm danh đủ 4 hóa và không có hậu kiểm tại `server.ts:660–685`. Trong khi `periodContext.periodSiHua` (`yunxian-context.ts:440–454`) đã có sẵn đủ 4 sao Tứ Hóa xác định 100%.<br>- **Phân tích Quota:** Phương án (c) tốn gấp đôi quota và dễ kích hoạt lỗi 503 khi kho key chỉ còn 3 key khỏe $\rightarrow$ **Bác bỏ tuyệt đối**. **Chốt Phương án (a):** Hàm `verifyAndEnsureCompletePeriodSiHua` kiểm tra đủ 4 cặp `(starNameVi, mutagenVi)`; nếu AI bỏ sót hóa nào thì tự động nối khối `> 📌 **[Bổ Khuyết Dữ Kiện Tứ Hóa Kỳ Hạn]**` chứa đầy đủ tọa độ Bản Mệnh + vai trò Lưu Niên + đối cung xung chiếu của sao bị thiếu vào văn bản trước khi lưu cache (**0 tốn quota AI**). |
| **P4** | **Nguyên nhân gốc S2 (lẫn nhãn tầng Lưu Tài Bạch):** Gốc ở tầng DỮ KIỆN (`dossier-context` / `yunxian-context`), không chỉ prompt. Sửa lại diễn đạt của V1 mục 1.1 về ma trận chương 7/8. | **CHẤP NHẬN & SỬA DIỄN ĐẠT V1 MỤC 1.1** | - **Bằng chứng Bước 1:** `getPeriodPalaceRoleVi` (`yunxian-context.ts:360–364`) đã tính vai trò Lưu, nhưng `factTableMarkdown` (`dòng 544–609`) chỉ in 4 cung Tam Phương Tứ Chính (khuyết 8 cung Lưu), bỏ sót vai trò Lưu ở đối cung xung chiếu (`dòng 560–565`) và bỏ sót vai trò Lưu ở danh sách Sao Lưu (`dòng 568–587`). Đồng thời `mapSiHuaEntry` (`dossier-context.ts:733–765`) đã lược bỏ `periodPalaceRoleVi`, nên **ma trận Chương 7/8 tuy ghi đủ 4 hóa nhưng CŨNG THIẾU nhãn vai trò cung Lưu Niên** (V2 đã đính chính điểm này).<br>- **Cách sửa:** Tiền-tính và in đầy đủ Bảng Ánh Xạ 12 Cung Kỳ Hạn ↔ 12 Cung Bản Mệnh, thêm `oppositePeriodPalaceRoleVi`, in vai trò Lưu vào Sao Lưu và vào cả ma trận Chương 7/8. |
| **P5** | **Tiêu đề mục cung Chương 4 (S4):** Chuẩn hóa bằng prompt không đáng tin. Đánh giá P5-A (hậu xử lý thay dòng tiêu đề) và P5-B (tách UI render), chọn MỘT hướng và nêu rõ hệ quả với các cache hiện có. | **CHẤP NHẬN & CHỐT CÁCH P5-A** | - **Bằng chứng Bước 1:** `buildPalaceGroupFactSheetVi` (`dossier-context.ts:506–514`) đã có sẵn công thức dựng tiêu đề chuẩn `### Cung ${natalPalaceNameVi} (${ganZhiVi}) ${badges}`, nhưng `server.ts:350` lại viết mẫu thiếu `[Đại hạn X–Y tuổi]`.<br>- **Lý do chọn P5-A thay vì P5-B:** P5-B đòi hỏi đổi kiểu dữ liệu `DossierChapterState.text` từ chuỗi sang mảng 4 cung, làm gãy cache `sessionStorage` (`ziwei_dossier_v1`), gãy bộ xuất HTML/MD và ngữ cảnh Chat. Ngược lại, **P5-A (`enforceCanonicalPalaceGroupHeadings`)** quét và thay thế dòng heading `### Cung ...` bằng chuỗi tiêu đề chuẩn từ `chart.palaces` ngay trước khi ghi cache **và khi đọc `readDossierCacheEntry`** $\rightarrow$ **nâng cấp tức thì cả các bản cache cũ trong `sessionStorage` mà không cần xóa cache hay gọi lại AI!** |
| **P6** | **Header xuất bản (S5):** Lấy giờ sinh và giờ Mặt Trời thật đã áp hiệu chỉnh, áp dụng đồng nhất cho cả 3 định dạng xuất (HTML, MD, Sao chép/In). Chốt định dạng hiển thị và trường hợp "không rõ giờ sinh". | **CHẤP NHẬN & CHỐT ĐỊNH DẠNG CHUẨN** | - **Bằng chứng Bước 1:** `buildDossierHeaderMetadata` (`dossier-chat-ui.ts:759–778`) và `printSheetPortal` (`DetailedDossierModal.tsx:763–769`) hiện thiếu giờ sinh. Trong khi `chart.birthInfo.hour` (`types.ts:19`), `origInput` (`types.ts:31–37`), `longitude` (`types.ts:24`) đã có sẵn và `toTrueSolarTime` (`true-solar-time.ts:59–99`) tính được ngay giờ Mặt Trời thật.<br>- **Định dạng chốt:**<br>  • *Khi biết giờ sinh (`origInput` có):* `Giờ đồng hồ: HH:MM → Giờ Mặt Trời thật: HH:MM (Giờ <Địa Chi>, hiệu chỉnh ±X phút theo kinh độ Y°Đ — <Nơi sinh>)`.<br>  • *Khi chọn "Không rõ giờ sinh" (`!origInput`):* `Chưa rõ giờ đồng hồ gốc (lập lá số mặc định theo Giờ <Địa Chi>)`. |
| **P7** | **Phạm vi cấm:** KHÔNG đụng engine lập lá số, KHÔNG sửa `SI_HUA_TABLE`, KHÔNG đụng kho key/model. Rà soát toàn bộ V1 xem có mục nào vượt phạm vi không. | **CHẤP NHẬN (ĐÃ RÀ SOÁT 100% V1)** | - Đã rà soát toàn bộ V1: Không có bất kỳ đề xuất nào chạm vào `src/lib/ziwei/engine.ts`, `SI_HUA_TABLE` (`constants.ts`) hay `server/key-pool/*`. Mọi thay đổi chỉ nằm ở tầng chuỗi ngữ cảnh (`yunxian-context.ts`, `dossier-context.ts`), hậu xử lý văn bản (`text-sanitizer.ts`), giao diện/xuất bản (`dossier-chat-ui.ts`, `DetailedDossierModal.tsx`, `InsightPanel.tsx`, `ContextualChatDrawer.tsx`) và câu chữ prompt (`server.ts`). |
| **P8** | **Kiểm chứng tiết kiệm quota:** Dùng đúng `"cácφ"`, `"căngđộ"`, và văn bản Chương 5 thật (thiếu 2 hóa) làm fixture test đơn vị; kiểm chứng live tối đa 2 chương trên 1 lá số. Chốt danh sách test và tiêu chí đạt/không-đạt. | **CHẤP NHẬN & CHỐT BẢNG TIÊU CHÍ TEST** | - Toàn bộ logic S1–S5 và B1–B6 đều là hàm thuần xác định (deterministic functions), kiểm chứng được 100% bằng script Offline (`verify-dossier-context.ts` & `verify-dossier-chat-ui.ts`) với **0 lượt gọi AI**. Kiểm chứng live (nếu chạy) giới hạn nghiêm ngặt ở tối đa 2 chương (`year_2026`, `year_2027`) trên 1 lá số. |

---

## 3. CÁC VẤN ĐỀ MỚI DO PANEL CHỦ ĐỘNG PHÁT HIỆN NGOÀI 8 ĐIỂM P (`T1`–`T6`)

Ngoài 8 ràng buộc `P1`–`P8`, Tổ chuyên gia đã rà soát chéo toàn bộ V1 và phát hiện **6 vấn đề kỹ thuật bổ sung (`T1`–`T6`)** cần sửa ngay trong Kế hoạch V2:

1. **`(T1)` Hiệu chỉnh nhận định về `server.ts:356` và Ma trận Chương 7/8 trong V1 mục 1.1 & 2.1a:**
   - V1 mục 2.1a cho rằng Chương 7 có đủ 4 hóa là nhờ câu prompt ở `server.ts:356`. Thực tế, `server.ts:356` chỉ là câu giới hạn phạm vi trích dẫn, còn việc Chương 7 có đủ 4 hóa là nhờ bảng dữ kiện `compactMatrixMarkdown` / `factSheetMarkdown` (`dossier-context.ts:876–884, 911–918`) đã in sẵn 4 hóa. Đồng thời, ngay cả trong Chương 7/8, phần văn xuôi của AI vẫn có thể chỉ bình luận sâu 1–2 hóa nếu không có bảng ma trận B3 đi kèm, và bản thân dữ kiện Chương 7/8 đang thiếu `periodPalaceRoleVi`. V2 đã sửa lại chính xác nhận định này và bổ sung luôn quy tắc nhắc đủ 4 hóa cho cả prompt Chương 7/8 (`server.ts:355–362`).
2. **`(T2)` Làm sạch tự động các bản Cache cũ đã bị nhiễm lỗi (`"cácφ"`, `"căngđộ"`, thiếu tiêu đề `[Đại hạn ...]`) mà không tốn Quota sinh lại:**
   - Trong V1 mục 2.3b, bộ lọc `sanitizeAiVietnameseOutput` mới chỉ dự kiến gắn vào luồng nhận SSE (`executeSingleChapterStream` / `requestPeriodAiInterpretation`). Nếu trình duyệt của người dùng đang lưu sẵn hồ sơ Nguyễn Văn An trong `sessionStorage` (`ziwei_dossier_v1::...`), mở lại trang sẽ vẫn thấy `"cácφ"` và `"căngđộ"` nếu không bấm sinh lại!
   - **Giải pháp trong V2:** Áp dụng `sanitizeAiVietnameseOutput` + `enforceCanonicalPalaceGroupHeadings` ngay bên trong hàm đọc cache **`readDossierCacheEntry`** (`src/lib/dossier-chat-ui.ts:403`) và bên trong các hàm xuất bản (`buildDossierMarkdownExport`, `buildDossierStandaloneHtmlExport`). Nhờ đó, **mọi hồ sơ đã lưu trong `sessionStorage` từ trước sẽ tự động được tẩy sạch `"cácφ"`, tách `"căng độ"`, sửa `"kho lúa"`, `"bảo thủ"` và gắn đủ `[Đại hạn X–Y tuổi]` ngay khi mở lên với chi phí Quota = 0!**
3. **`(T3)` Ngăn chặn nguy cơ Dương tính giả (False Positive) khi sửa lỗi chữ lẻ `"bảo Thủ"` và `"canh Thìn/Dần"` (V1 mục 2.4c):**
   - V1 mục 2.4c đề xuất quy tắc tổng quát hạ chữ hoa âm tiết thứ hai của tính từ ghép và chuẩn hóa tự động `"canh Thìn/Dần"`.
   - Panel **BÁC BỎ** việc dùng regex tổng quát cho hai trường hợp này vì:
     - Hạ chữ hoa âm tiết thứ hai một cách tổng quát có nguy cơ làm hỏng tên Sao/Cung đứng sau động từ/danh từ thường (`"gặp Vũ Khúc"`, `"cung Tài Bạch"`).
     - Trong Lục Thập Hoa Giáp, **Canh Thìn** và **Canh Dần** là hai trụ Can Chi hoàn toàn hợp lệ (Can Canh dương đi với Chi Thìn dương và Chi Dần dương). Nếu dùng regex đổi `"canh Thìn"` thành `"can Thìn"`, vừa tạo ra thuật ngữ sai (`Thìn` là Địa Chi, không phải Thiên Can), vừa làm hỏng trường hợp nói về tuổi/năm/cung Canh Thìn thật!
   - **Giải pháp trong V2:** Trong `text-sanitizer.ts`, chỉ dùng **danh sách từ điển cố định cực hẹp, không đa nghĩa** (`"kho lứa"` $\rightarrow$ `"kho lúa"`, `"bảo Thủ"` $\rightarrow$ `"bảo thủ"`). Còn lỗi diễn đạt `"canh Thìn/Dần"` (gọi nhầm Địa Chi thành can/canh) được xử lý bằng quy tắc tường minh trong Prompt (`server.ts:371–375`): bắt buộc viết `"cung <Tên Cung> (<Can Chi đầy đủ>)"` hoặc `"Thiên Can <Can>"`, cấm viết `"can <Địa Chi>"` hoặc `"canh <Địa Chi>"` chữ thường.
4. **`(T4)` Bố cục Trang Bìa (B1) + Kết Luận Nhanh (B6) + Sơ Đồ Lá Số 12 Cung (B2) trên Trang 1 để chống lãng phí giấy in & Thiếu tọa độ Địa Chi trong B2:**
   - V1 mục 3 (B1) đặt `page-break-after: always` ngay sau khung bìa tên đương số, làm tốn đứt 1 tờ A4 chỉ cho vài dòng thông tin, và V1 mục 3 (B2) quên quy định tọa độ dòng/cột cho 12 Địa Chi trên lưới 4×4.
   - **Giải pháp trong V2:**
     - Gộp **B1 (Khung Quốc Sắc Thiên Thư & Metadata Khai Sinh/Giờ Mặt Trời thật)** + **B6 (5 Dòng Cốt Tủy Lá Số)** + **B2 (Lưới 12 Cung 4×4)** thành **"Trang 1 — Mệnh Thư Tổng Lược & Tinh Bàn"** vừa khít trên trang A4 đầu tiên, sau đó mới ngắt trang (`page-break-after: always`) để sang Trang 2 vào Chương 1.
     - Quy định cứng bảng tọa độ CSS Grid 4×4 cho 12 Địa Chi (`Tỵ` tại `(1,1)` đi thuận chiều kim đồng hồ tới `Thìn` tại `(2,1)`, ô Thiên Bàn ở `(2..3, 2..3)`).
5. **`(T5)` Bảng Ma Trận Năm (B3) 8 cột trong V1 bị tràn khổ A4 dọc và không phù hợp với định dạng `.MD`:**
   - **Giải pháp trong V2:** Thu gọn bảng HTML/In của B3 từ 8 cột xuống **5 cột có tỷ lệ phần trăm cố định (`12% | 18% | 16% | 34% | 20%`)**, cỡ chữ `9pt` khi in, đường kẻ `#44403c` rõ nét trên máy in đen trắng; và không chèn bảng HTML/Markdown quá rộng vào file `.MD` (trong `.MD` chỉ giữ Header S5 + 5 dòng B6 + nội dung chương).
6. **`(T6)` Thứ tự ưu tiên thi công (Execution Phasing) để bảo vệ tuyệt đối 3 key khỏe:**
   - Chốt thứ tự thi công 4 bước tuần tự: **Pha 1** (Module dữ kiện & bộ lọc thuần `text-sanitizer.ts`, `yunxian-context.ts`, `dossier-context.ts` — 0 quota) $\rightarrow$ **Pha 2** (Header S5, Chế bản Mảng B `B1–B6` & làm sạch cache trong `dossier-chat-ui.ts` — 0 quota) $\rightarrow$ **Pha 3** (Tích hợp điểm chặn vào `DetailedDossierModal.tsx`, `InsightPanel.tsx`, `ContextualChatDrawer.tsx` & cập nhật prompt `server.ts` — 0 quota) $\rightarrow$ **Pha 4** (Chạy toàn bộ Unit Test Offline đạt 100% trước; không tự ý gọi AI đốt quota).

---

## 4. TỔNG HỢP: ĐIỂM ĐỒNG THUẬN TUYỆT ĐỐI & ĐIỂM CÒN TRANH CÃI GIỮA CÁC VAI

### 4.1. Các điểm ĐỒNG THUẬN tuyệt đối (5/5 vai thống nhất)
1. **Về phạm vi (P7):** Tuyệt đối không chạm vào `engine.ts`, `SI_HUA_TABLE`, hay `server/key-pool/*` và cấu hình model.
2. **Về nguyên nhân gốc và cách sửa S2 (P4):** Sửa ở tầng dữ kiện (`yunxian-context.ts` và `dossier-context.ts`) bằng cách thêm bảng ánh xạ đầy đủ 12 cung Kỳ Hạn ↔ 12 cung Bản Mệnh, thêm `oppositePeriodPalaceRoleVi`, in vai trò Lưu cho các Sao Lưu và cho cả ma trận Chương 7/8; kết hợp siết câu chữ ở prompt `buildStrictPeriodAiPrompt`.
3. **Về bộ lọc ký tự ngoại lai Lớp 3A (P1):** Chỉ lọc danh sách đen các hệ chữ không bao giờ hợp lệ (`Greek`, `Cyrillic`, `Hebrew`, `Arabic`, `Thai`, `Devanagari`, `Hangul`, `Hiragana`, `Katakana`, `\uFFFD`) và `\p{Script=Han}` khi `allowHanzi = false`; bảo toàn 100% `↔, →, •, %, –` và Hán tự khi song ngữ bật.
4. **Về tách từ dính Lớp 3B & lỗi chữ lẻ (P1, T3):** Hạ mức khẳng định của quy tắc âm vị chữ `đ` (chỉ tách chữ `đ` thường `U+0111` đứng giữa chữ cái kết thúc âm tiết tiếng Việt và nguyên âm tiếng Việt); chỉ sửa từ lẻ theo danh sách cố định hẹp (`"kho lứa"` $\rightarrow$ `"kho lúa"`, `"bảo Thủ"` $\rightarrow$ `"bảo thủ"`), cấm dùng regex hạ chữ hoa tổng quát hay regex đổi `"canh Thìn"`.
5. **Về đồng bộ tiêu đề 4 cung ở Chương 2, 3, 4 (P5):** Chọn **Cách P5-A** (`enforceCanonicalPalaceGroupHeadings`) thay dòng `### Cung ...` bằng tiêu đề chuẩn từ `chart.palaces` cả trước khi ghi cache lẫn khi đọc `readDossierCacheEntry` (nâng cấp tự động cache cũ, tốn 0 quota).
6. **Về Header xuất bản (S5 / P6):** Mở rộng `buildDossierHeaderMetadata` dùng `toTrueSolarTime` (`true-solar-time.ts:59–99`) và áp dụng đồng nhất cho `.HTML`, `.MD`, `Sao chép`, `printSheetPortal` và Header Modal.
7. **Về Mảng B (`B1`–`B6`):** Mọi phần tử thẩm mỹ đều render xác định 100% từ dữ kiện (`chi phí AI = 0`); bảng ma trận B3 thu gọn còn 5 cột vừa khổ A4 dọc; lưới 12 cung B2 tuân thủ tuyệt đối tọa độ Địa Chi truyền thống; màu in `@media print` dùng đường kẻ đậm `#44403c` và ký hiệu văn bản `[Lộc]/[Quyền]/[Khoa]/[Kỵ]` để đọc rõ trên bản in đen trắng.

### 4.2. Các điểm CÒN TRANH CÃI nhẹ giữa các vai (cần Chủ dự án chốt trong mục 5)
1. **Tranh cãi 1 — Cách trình bày khối bổ khuyết khi Hậu kiểm S1 phát hiện thiếu Lưu Tứ Hóa (`QĐ-G1`):**
   - **Vai 1 (Kiến trúc sư) & Vai 5 (QA):** Muốn tự động nối khối `> 📌 **[Bổ Khuyết Dữ Kiện Tứ Hóa Kỳ Hạn]**` vào cuối mục 2 (hoặc cuối bài) một cách liền mạch, không cần hiện cảnh báo gây hoang mang cho người đọc.
   - **Vai 2 (Chuyên gia Prompt) & Vai 3 (Tử Vi):** Đồng ý tự động nối khối dữ kiện xác định (Phương án a) để bài lưu cache và bản in luôn đủ 4/4 hóa mà tốn 0 quota, nhưng đề xuất gắn thêm dòng tiêu đề nhỏ minh bạch `> 📌 **[Tổng Hợp Đầy Đủ Tứ Hóa Kỳ Hạn Theo Lá Số]**` để người đọc phân biệt đâu là đoạn bình giải tự nhiên của AI, đâu là dữ kiện tổng hợp từ Engine.
2. **Tranh cãi 2 — Điểm đặt bộ lọc S3: Chỉ ở Client (`accumulated` + `readDossierCacheEntry`) hay đặt kép ở cả Server (`sendSseText`) + Client (`QĐ-G2`):**
   - **Vai 1 (Kiến trúc sư):** Ưu tiên đặt hàm chính `sanitizeAiVietnameseOutput` (Lớp 3A + 3B) ở Client ngay tại điểm chốt `accumulated` trước khi ghi mọi cache + trong `readDossierCacheEntry`, **và** gọi thêm Lớp 3A (lọc glyph đơn lẻ `Greek/Cyrillic...`) ngay tại `sendSseText` (`server.ts:123–125`) để luồng SSE phát ra khỏi server đã sạch ngay từ gốc.
   - **Vai 2 (Chuyên gia Prompt):** Cho rằng chỉ cần đặt ở Client (`accumulated` + `readDossierCacheEntry`) là đã đủ 100% vì `accumulated` được lọc trên từng bước nhận chunk (`processLine`) và khi kết thúc luồng, tránh gọi lặp 2 lần.
3. **Tranh cãi 3 — Trang bìa B1: Tích hợp chung Trang 1 (`B1 + B6 + B2`) hay tách Trang bìa B1 đứng riêng 1 tờ A4 (`QĐ-G5`):**
   - **Vai 4 (Thiết kế in ấn) & Vai 1 (Kiến trúc sư):** Khuyến nghị **Tích hợp trên Trang 1** (Khung tiêu đề cổ điển & thông tin khai sinh B1 + 5 dòng cốt tủy B6 + Lưới 12 cung B2 nằm gọn trên Trang 1 A4, rồi ngắt trang sang Chương 1) để tiết kiệm giấy in và nhìn như một tờ "Mệnh Thư" truyền thống.
   - **Vai 3 (Tử Vi):** Nêu phương án thay thế là nếu người dùng muốn phong cách sách đóng gáy dày thì để B1 + B6 ở Trang 1, B2 ở đầu Chương 1 (Trang 2).

---

## 5. DANH SÁCH QUYẾT ĐỊNH CẦN CHỦ DỰ ÁN PHÊ DUYỆT (`QĐ-G1` .. `QĐ-G6`)

Trước khi chuyển sang lượt thi công code, kính đề nghị Chủ dự án xem xét và phê duyệt **6 quyết định (`QĐ-G1` đến `QĐ-G6`)** dưới đây:

### `QĐ-G1` — Cơ chế hậu kiểm xác định cho (S1) khi văn bản AI thiếu Lưu Tứ Hóa (Ràng buộc P3)
- **Nội dung:** Khi hàm hậu kiểm xác định `verifyAndEnsureCompletePeriodSiHua` phát hiện văn bản chương Lưu Niên / Đại Hạn bỏ sót $\ge 1$ sao trong 4 sao Tứ Hóa kỳ hạn (`Hóa Lộc`, `Hóa Quyền`, `Hóa Khoa`, `Hóa Kỵ`), hệ thống sẽ xử lý như thế nào?
- **Các phương án:**
  - **Phương án A (Khuyến nghị của Panel):** Tự động bổ sung khối dữ kiện chuẩn mực `> 📌 **[Tổng Hợp Đầy Đủ Tứ Hóa Kỳ Hạn (Can ...)]**` ghi rõ các sao Tứ Hóa bị sót kèm cung Bản Mệnh, vai trò cung Lưu Niên và đối cung xung chiếu vào văn bản trước khi lưu vào `aiPeriodCache` (**Chi phí Quota AI = 0**, bản xuất HTML/MD luôn đủ 4/4 hóa).
  - **Phương án B:** Không sửa văn bản, chỉ hiện nhãn cảnh báo *"Chương chưa nhắc đủ 4 Tứ Hóa"* trên giao diện để người dùng tự bấm sinh lại.
  - **Phương án C:** Tự động gọi AI sinh lại ngầm (tốn 200% quota, rủi ro cao dính lỗi 503 khi chỉ có 3 key khỏe — *Panel kiến nghị bác bỏ*).
- **Hệ quả nếu chọn phương án khác:** Nếu chọn B, khi người dùng xuất file HTML/MD ngay mà không bấm sinh lại (hoặc khi hết quota không sinh lại được), hồ sơ xuất ra vẫn bị thiếu Lưu Hóa Lộc / Lưu Hóa Khoa.

### `QĐ-G2` — Thiết kế & Vị trí đặt bộ lọc văn bản cho (S3) và (S4) (Ràng buộc P1, P2, T2, T3)
- **Nội dung:** Chốt phạm vi bộ lọc `sanitizeAiVietnameseOutput` (`src/lib/ziwei/text-sanitizer.ts`) và điểm chặn trong pipeline.
- **Các phương án:**
  - **Phương án A (Khuyến nghị của Panel — Chặn kép toàn diện + Tự làm sạch cache cũ):**
    1. **Lớp 3A (Ký tự ngoại lai):** Loại bỏ chính xác các glyph thuộc hệ chữ `Greek` (bắt `"cácφ"` $\rightarrow$ `"các"`), `Cyrillic`, `Hebrew`, `Arabic`, `Thai`, `Devanagari`, `Hangul`, `Hiragana`, `Katakana`, `\uFFFD`, và `\p{Script=Han}` khi `allowHanzi = false` (giữ nguyên `↔, →, •, %, –` và giữ Hán tự khi song ngữ bật).
    2. **Lớp 3B (Tách từ dính & chữ lẻ an toàn):** Tách dấu cách trước chữ `đ` thường tiếng Việt (`U+0111`) khi đứng ngay sau chữ cái kết thúc âm tiết tiếng Việt và trước nguyên âm tiếng Việt (bắt `"căngđộ"` $\rightarrow$ `"căng độ"`), cộng với danh sách từ lẻ cố định hẹp (`"kho lứa"` $\rightarrow$ `"kho lúa"`, `"bảo Thủ"` $\rightarrow$ `"bảo thủ"`). **Không** dùng regex hạ chữ hoa tổng quát hay regex sửa `"canh Thìn"`.
    3. **Vị trí chặn:** Chạy Lớp 3A ngay tại `sendSseText` (`server.ts:123–125`), chạy trọn bộ `sanitizeAiVietnameseOutput` (Lớp 3A + 3B) trên chuỗi tích lũy `accumulated` ở Client **ngay trước mọi điểm ghi cache** (`DetailedDossierModal.tsx:435, 481`; `InsightPanel.tsx:235, 268, 395, 407`; `ContextualChatDrawer.tsx:325, 360`) **VÀ chạy khi đọc cache `readDossierCacheEntry`** (`dossier-chat-ui.ts:403`) để tự động làm sạch cả dữ liệu cache cũ mà không tốn quota.
  - **Phương án B:** Chỉ chạy bộ lọc ở phía Client trên `accumulated` khi sinh mới, không lọc trong `sendSseText` và không lọc khi đọc cache cũ từ `sessionStorage`.
- **Hệ quả nếu chọn phương án khác:** Nếu chọn B, các chương đã lưu sẵn trong `sessionStorage` từ phiên trước sẽ vẫn còn `"cácφ"` và `"căngđộ"` cho đến khi người dùng xóa cache và tốn quota sinh lại.

### `QĐ-G3` — Bổ sung nhãn vai trò Lưu Niên tiền-tính ở tầng dữ kiện cho (S2) (Ràng buộc P4)
- **Nội dung:** Cách khắc phục triệt để hiện tượng AI gọi lẫn `"tam hợp Tài Bạch (trùng Mệnh Cung)"` thay vì `"Lưu Tài Bạch"`.
- **Các phương án:**
  - **Phương án A (Khuyến nghị của Panel):** Sửa trực tiếp ở tầng dữ kiện (`src/lib/ziwei/yunxian-context.ts` và `src/lib/ziwei/dossier-context.ts`):
    1. Thêm **Bảng Ánh Xạ Đầy Đủ 12 Cung Kỳ Hạn ↔ 12 Cung Bản Mệnh Gốc** vào `factTableMarkdown`.
    2. Thêm `oppositePeriodPalaceRoleVi` vào `YunxianSiHuaTarget`, in rõ vai trò Lưu cho cả cung tọa thủ lẫn đối cung xung chiếu của 4 sao Tứ Hóa kỳ hạn, và in `periodPalaceRoleVi` cho toàn bộ danh sách Sao Lưu.
    3. Giữ lại `periodPalaceRoleVi` và `oppositePeriodPalaceRoleVi` trong `MultiYearSiHuaEntry` / `mapSiHuaEntry` cho cả Chương 7 và Chương 8.
    4. Kết hợp siết quy tắc gọi tên `"Cung Lưu <Tên Cung>"` trong `buildStrictPeriodAiPrompt` (`server.ts:164–166`).
  - **Phương án B:** Chỉ sửa câu chữ trong prompt `server.ts`, giữ nguyên bảng dữ kiện hiện tại.
- **Hệ quả nếu chọn phương án khác:** Nếu chọn B, dữ kiện của 8 cung Lưu Niên ngoài Tam Phương Tứ Chính và vai trò Lưu của đối cung xung chiếu vẫn bị khuyết, khiến model `flash-lite` tiếp tục phải tự suy hình học và tái diễn lỗi gọi nhầm tên tầng.

### `QĐ-G4` — Phương thức đồng bộ tiêu đề 4 cung ở Chương 2, 3, 4 cho (S4) (Ràng buộc P5)
- **Nội dung:** Đảm bảo 100% tiêu đề mục cung ở Chương 2 (`palaces_core`), Chương 3 (`palaces_family`) và Chương 4 (`palaces_social_health`) luôn có định dạng chuẩn `### Cung <Tên Cung> (<Can Chi>) [AN MỆNH/THÂN] [Đại hạn X–Y tuổi]`.
- **Các phương án:**
  - **Phương án A (Khuyến nghị của Panel — Cách P5-A):** Dùng hàm hậu xử lý xác định `enforceCanonicalPalaceGroupHeadings` thay thế các dòng tiêu đề `### Cung ...` trong văn bản Markdown bằng khung tiêu đề chuẩn trích từ `chart.palaces` (áp dụng cả trước khi ghi cache và khi đọc `readDossierCacheEntry`), đồng thời cập nhật mẫu tiêu đề trong prompt `server.ts:350`.
  - **Phương án B (Cách P5-B):** Đổi cấu trúc dữ liệu `DossierChapterState` để tách 4 cung thành 4 trường riêng biệt và để React tự render thẻ `<h3>` ngoài Markdown.
- **Hệ quả nếu chọn phương án khác:** Nếu chọn B, toàn bộ cache `sessionStorage` (`ziwei_dossier_v1`) hiện tại sẽ không tương thích, làm phức tạp hóa luồng stream SSE và hàm xuất file `.HTML`/`.MD`.

### `QĐ-G5` — Định dạng Header Giờ sinh / Giờ Mặt Trời thật (S5) & Chế bản Thẩm mỹ Mảng B (`B1`–`B6`) (Ràng buộc P6, T4, T5)
- **Nội dung:** Chốt quy cách hiển thị giờ sinh (S5) và bố cục 6 hạng mục thẩm mỹ `B1`–`B6` (chi phí AI = 0).
- **Các phương án:**
  - **Phương án A (Khuyến nghị của Panel):**
    1. **Header S5 (`buildDossierHeaderMetadata` + `printSheetPortal` + Modal Header):** Hiển thị đồng nhất trên cả `.HTML`, `.MD`, `Sao chép`, `In trực tiếp` và `Modal`:
       - Khi biết giờ sinh: `Giờ đồng hồ: HH:MM → Giờ Mặt Trời thật: HH:MM (Giờ <Chi>, hiệu chỉnh ±X phút theo kinh độ Y°Đ — <Nơi sinh>)`.
       - Khi không rõ giờ sinh: `Chưa rõ giờ đồng hồ gốc (lập lá số mặc định theo Giờ <Chi>)`.
    2. **Trang 1 Tích hợp (`B1` + `B6` + `B2`):** Thiết kế Trang 1 của bản `.HTML` và Bản In gồm: **Khung tiêu đề cổ điển & thông tin khai sinh đầy đủ (B1)** + **Khối Kết Luận Nhanh 5 dòng xác định 100% (B6)** + **Sơ đồ lưới 12 cung 4×4 đúng tọa độ Địa Chi truyền thống (B2)** gói gọn trên Trang 1, giúp tiết kiệm giấy in mà vẫn trang trọng. (Trên Modal UI: hiển thị khối B6 ở đầu hồ sơ và lưới 12 cung B2 ở đầu Chương 1; trong file `.MD`: thêm Header S5 + 5 dòng B6).
    3. **Bảng Ma Trận Năm (B3) & Chế bản In đen trắng (B4, B5):** Render bảng ma trận **5 cột cân đối** (`12% | 18% | 16% | 34% | 20%`) ở đầu Chương 7 & Chương 8 trên `.HTML`, Bản In và Modal UI; dùng font Serif tiếng Việt, drop-cap đầu chương, nền trắng `#ffffff` và đường kẻ đậm `#44403c` kèm ký hiệu `[Lộc]/[Quyền]/[Khoa]/[Kỵ]` khi in `@media print` để máy in đen trắng đọc rõ 100%.
  - **Phương án B:** Tách B1 thành 1 trang bìa rời chỉ có chữ (tốn thêm 1 tờ giấy A4 khi in) hoặc giữ bảng B3 8 cột như V1.
- **Hệ quả nếu chọn phương án khác:** Nếu chọn B, bảng 8 cột sẽ bị tràn/gãy chữ trên khổ giấy A4 dọc và tốn thêm giấy in cho trang bìa rỗng.

### `QĐ-G6` — Quy trình Kiểm chứng Tiết kiệm Quota sau khi thi công (Ràng buộc P8)
- **Nội dung:** Cách thức chạy kiểm chứng ở lượt thi công tiếp theo khi kho key chỉ có 3 key khỏe.
- **Các phương án:**
  - **Phương án A (Khuyến nghị của Panel):** Thực thi đầy đủ 100% bộ kiểm chứng Offline tự động (`tsc --noEmit`, `vite build`, `lint_applet`, `verify-key-pool.ts`, `verify-dossier-context.ts`, `verify-dossier-chat-ui.ts` với đúng các fixture thật `"cácφ"`, `"căngđộ"`, văn bản Chương 5 thiếu 2 hóa, kiểm tra đủ 12 cung Lưu Niên năm 2027, Header giờ Mặt Trời thật và Mảng B — **tốn 0 lượt gọi AI**). Không tự động bắn request AI ngầm trong script test; việc bấm sinh Live (tối đa 2 chương Lưu Niên: Chương 5 & Chương 6 trên 1 lá số) dành cho người dùng nghiệm thu trực tiếp trên giao diện (hoặc chỉ gọi khi người dùng ra lệnh rõ).
  - **Phương án B:** Cho phép script kiểm chứng tự động gọi API Gemini thật để sinh lại Chương 5 và Chương 6 trong lúc chạy test.
- **Hệ quả nếu chọn phương án khác:** Nếu chọn B, script test tự động sẽ tiêu tốn quota của 3 key khỏe và có thể gặp lỗi 503 làm gián đoạn lượt build.
