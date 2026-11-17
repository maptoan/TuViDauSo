> ⚠️ **[TÀI LIỆU LỊCH SỬ ĐÃ LƯU TRỮ — KHÔNG DÙNG LÀM CĂN CỨ CODE HIỆN HÀNH]**
> - **Trạng thái**: Đã hoàn thành vai trò lịch sử / Đã bị thay thế bởi tài liệu sống **[`docs/features-dossier-and-chat.md`](../features-dossier-and-chat.md)** từ ngày `17/11/2026`.
> - **Cảnh báo cho Kỹ sư & AI Agent**: Các trích dẫn số dòng, tên biến, hằng số (như ngân sách 25s, nhịp nghỉ 2200ms, số lượng key 3/23) trong file này phản ánh thời điểm trước khi hợp nhất và **không còn khớp với mã nguồn hiện hành**. Tuyệt đối đọc tài liệu sống tại thư mục `docs/` gốc và đối chiếu code thật trước khi chẩn đoán hoặc sửa code!

---
# KẾ HOẠCH KHẮC PHỤC 5 KHIẾM KHUYẾT VĂN BẢN/TRÌNH BÀY & NÂNG CẤP THẨM MỸ HỒ SƠ LUẬN GIẢI TOÀN DIỆN (V1)

- **Dự án:** Tử Vi Thiên Kỷ (Tử Vi Đẩu Số)
- **Tài liệu:** `docs/dossier-fix-plan-v1.md`
- **Ngày lập:** 17/11/2026
- **Model lập kế hoạch:** Gemini 4 Argon (`models/gemini-4-argon`)
- **Trạng thái:** **Bản nháp V1 — chờ panel phản biện**

---

## 0. NGUYÊN TẮC MINH BẠCH & RÀNG BUỘC KỶ LUẬT

1. **Nguyên tắc minh bạch về Panel chuyên gia:**
   - Trong môi trường AI Studio, vòng phản biện ở Bước 3 là **tổ chuyên gia MÔ PHỎNG đa vai trong MỘT phiên Gemini 4 Argon duy nhất**, **không phải** nhiều chuyên gia thật chạy trên các phiên độc lập tách biệt. Mọi biên bản phản biện ở bước tiếp theo phải ghi rõ tính chất mô phỏng đa vai này, phân tách rõ ý kiến từng vai chuyên gia và kết luận tổng hợp của điều phối viên.
2. **Kỷ luật bằng chứng:**
   - Toàn bộ vị trí file, tên hàm và số dòng trong bản kế hoạch V1 này đều trích xuất trực tiếp từ báo cáo đọc code thật ở Bước 1; tuyệt đối không suy diễn vị trí code không tồn tại, không in khóa API nguyên văn.
3. **Kỷ luật 8 ràng buộc của bên đặt hàng (`P1`–`P8`):**
   - Bản V1 tích hợp đầy đủ 8 ràng buộc `P1`–`P8` vào đúng các hạng mục kỹ thuật tương ứng (ghi rõ nhãn `[Áp dụng P1]`..`[Áp dụng P8]`), làm cơ sở để Panel ở Bước 3 xem xét chấp thuận, điều chỉnh hoặc bác bỏ từng điểm kèm lý do kỹ thuật.

---

## 1. BỐI CẢNH KIỂM CHỨNG THỰC TẾ & BẰNG CHỨNG CODE ĐÃ ĐỌC (BƯỚC 1)

### 1.1. Bối cảnh kiểm chứng hồ sơ thật
Qua kiểm chứng độc lập bằng chạy lại engine trên hồ sơ thật của đương số **Nguyễn Văn An (sinh ngày 16/08/1995)**:
- **Tầng dữ kiện toán học / an sao của Engine hoàn toàn chuẩn xác:** 14 chính tinh khớp 14/14, Tứ Hóa mọi tầng (Bản Mệnh, Đại Hạn, Lưu Niên, Tự Hóa) đúng 100%, ~35 phụ tinh khớp tuyệt đối.
- **5 khiếm khuyết phát hiện (`S1`–`S5`) đều nằm ở tầng văn bản AI, tiền-tính nhãn vai trò lưu trong bảng dữ kiện Markdown, hậu xử lý chuỗi và khuôn mẫu xuất bản (template):**
  - **(S1)** Chương Lưu Niên năm hiện tại (Chương 5 — `year_2026`) khi kể điểm cát đã **bỏ sót Lưu Hóa Lộc và Lưu Hóa Khoa** (chỉ nhắc Hóa Quyền + Hóa Kỵ), trong khi ma trận năm ở Chương 7 (`horizon_5y`) ghi đủ cả 4 hóa.
  - **(S2)** Chương Lưu Niên năm sau (Chương 6 — `year_2027`) **lẫn nhãn tầng trong văn xuôi**: viết *"tam hợp Tài Bạch (trùng Mệnh Cung)"* — cung Mão năm đó đóng vai **Lưu Tài Bạch**, không phải cung Tài Bạch gốc của Bản Mệnh (vốn ở Hợi); hình học Tam Hợp đúng nhưng gọi tên lẫn hai tầng Bản Mệnh và Lưu Niên.
  - **(S3)** Hai lỗi chuỗi lọt vào văn bản đã lưu cache: **`"cácφ"`** (dính ký tự Hy Lạp phi `φ` — U+03C6) và **`"căngđộ"`** (hai từ tiếng Việt bị dính liền, mất dấu cách).
  - **(S4)** Lỗi chữ lẻ & không đồng nhất hình thức:
    - Chữ lẻ do AI sinh: `"kho lứa"` thay vì `"kho lúa"`, `"bảo Thủ"` thừa chữ hoa giữa câu.
    - Thuật ngữ Thiên Can không đồng nhất: Chương 4 (`palaces_social_health`) dùng `"canh Thìn/Dần..."` thay vì `"can"` (hoặc Can Chi chuẩn) như các chương khác.
    - Tiêu đề mục cung không đồng nhất: Chương 4 thiếu cụm ngoặc **`[Đại hạn X–Y tuổi]`** trên các dòng tiêu đề `### Cung ...`, trong khi Chương 2 (`palaces_core`) và Chương 3 (`palaces_family`) đều có.
  - **(S5)** Header của bản xuất hồ sơ (`.HTML`, `.MD`, Sao chép / In trực tiếp) chỉ có ngày sinh Dương lịch và Âm lịch, **thiếu giờ sinh** (giờ:phút đồng hồ gốc & Địa Chi giờ sinh) và **thiếu giờ Mặt Trời thật (Chân Thái Dương Thời)** khi lá số đã áp hiệu chỉnh kinh độ/phương trình thời gian.

### 1.2. Tóm tắt bằng chứng code thật đã xác nhận ở Bước 1

| Hạng mục | File & Hàm xác nhận | Số dòng | Hiện trạng trong code |
| :--- | :--- | :--- | :--- |
| **Prompt Lưu Niên (Ch.5, Ch.6 & Tab Vận Hạn)** | `server.ts` — `buildStrictPeriodAiPrompt` (gọi bởi `POST /api/interpret-period`) | `152–202` (`623–713`) | Quy tắc 1–2 (`dòng 161–163`) cấm bịa sao/Tứ Hóa; quy tắc 5 (`dòng 169`) cấm chữ Hán. **Chưa có** quy tắc bắt buộc liệt kê đủ 4 sao Lưu Tứ Hóa (Lộc, Quyền, Khoa, Kỵ); **chưa có** quy tắc tiền tố 4 tầng `[Tứ Hóa ...]`; **chưa có** hậu kiểm sau khi sinh (`dòng 660–685`). |
| **Prompt Hồ Sơ (Ch.1–4, Ch.7–8)** | `server.ts` — `buildStrictDossierSectionPrompt` (gọi bởi `POST /api/interpret-dossier-section`) | `335–388` (`716–804`) | Có quy tắc tiền tố 4 tầng Tứ Hóa (`dòng 372`). Tuy nhiên ở `dòng 350`, mẫu tiêu đề nhóm 4 cung viết cứng là ``### Cung <Tên Cung> (<Can Chi>)`` — **thiếu `[Đại hạn X–Y tuổi]`**. Không có hậu kiểm sau khi sinh (`dòng 750–776`). |
| **Bảng dữ kiện Lưu Niên (`factTableMarkdown`)** | `src/lib/ziwei/yunxian-context.ts` — `buildYunxianPeriodContext` & `getPeriodPalaceRoleVi` | `278–671` (`360–364`) | `getPeriodPalaceRoleVi` đã tính được vai trò cung kỳ hạn, nhưng `factTableMarkdown` (`dòng 544–609`) **bỏ sót nhãn vai trò Lưu ở 3 chỗ**: (1) mục Tam Phương Tứ Chính (`dòng 502–507, 595–607`) chỉ in 4 cung Lưu, khuyết 8 cung Lưu còn lại; (2) mục Tứ Hóa Kỳ Hạn (`dòng 560–565`) chỉ in vai trò Lưu ở cung tọa thủ, **bỏ trống vai trò Lưu ở đối cung xung chiếu** (`YunxianSiHuaTarget` dòng `30–42` chưa có `oppositePeriodPalaceRoleVi`); (3) mục Sao Lưu (`dòng 568–587`) không in `d.periodPalaceRoleVi` dù `dynamicStars` (`dòng 456–466`) đã tính sẵn. |
| **Ma trận năm Ch.7 & Ch.8** | `src/lib/ziwei/dossier-context.ts` — `buildMultiYearHorizonContext` & `mapSiHuaEntry` | `622–935` (`733–765`) | `mapSiHuaEntry` (`dòng 733–765`) và `MultiYearSiHuaEntry` (`dòng 547–558`) **lược bỏ `periodPalaceRoleVi`**. Cả `compactMatrixMarkdown` (`dòng 873–886`) lẫn mục `(6) Bộ Lưu Tứ Hóa` (`dòng 911–918`) chỉ ghi tên cung Bản Mệnh, không ghi vai trò cung Lưu Niên. |
| **Tiêu đề 4 cung trong dữ kiện Ch.2, 3, 4** | `src/lib/ziwei/dossier-context.ts` — `buildPalaceGroupFactSheetVi` & `buildDossierSectionContext` | `492–523`, `970–1003` | `buildPalaceGroupFactSheetVi` (`dòng 506–514`) đã tạo sẵn tiêu đề chuẩn `### Cung ${natalPalaceNameVi} (${ganZhiVi}) ${badges}` (có `[AN MỆNH]`, `[AN THÂN]`, `[Đại hạn X–Y tuổi]`). Nhưng bài hiển thị lại lấy từ `selectedState.text` do AI tự viết (`DetailedDossierModal.tsx:1209`). |
| **Builder xuất bản & dữ kiện giờ sinh** | `src/lib/dossier-chat-ui.ts` — `buildDossierHeaderMetadata`, `buildDossierMarkdownExport`, `buildDossierPlainTextExport`, `buildDossierStandaloneHtmlExport`; `DetailedDossierModal.tsx` — `printSheetPortal` | `759–1050` (`dossier-chat-ui.ts`); `755–812`, `831–843` (`Modal`) | `buildDossierHeaderMetadata` (`dòng 759–778`) chỉ có `name, solar, lunar, yinYang, ju, mingBranch, mingMajors` — **không có giờ sinh, không có giờ Mặt Trời thật, không có nơi sinh**. Trong khi `chart.birthInfo.hour` (`types.ts:19`), `chart.birthInfo.origInput` (`types.ts:31–37`), `longitude` (`types.ts:24`) đã có sẵn và `toTrueSolarTime` (`src/lib/ziwei/true-solar-time.ts:59–99`) tính được ngay giờ Mặt Trời thật `HH:MM` + độ lệch phút. |
| **Pipeline SSE & Cache 2 chiều** | `server/key-pool/executor.ts` (`executeStream`); `server.ts` (`sendSseText`); `src/App.tsx` (`aiPeriodCache`); `DetailedDossierModal.tsx` (`executeSingleChapterStream`); `InsightPanel.tsx` (`requestPeriodAiInterpretation`, `fetchInsight`) | `executor.ts:234–245`; `server.ts:123–125`; `App.tsx:66`; `Modal:416–570`; `Insight:215–293, 360–425` | Chưa có bộ lọc ở cả server lẫn client. Văn bản AI đi từ `executor.ts` → `sendSseText` → vòng lặp đọc SSE ở client (`accumulated`) → ghi vào `aiPeriodCache` (App state), `localChapters` (Modal state) và `sessionStorage` (`ziwei_dossier_v1::...`). |

---

## 2. KẾ HOẠCH KHẮC PHỤC CHI TIẾT CHO 5 ĐIỂM S1–S5

### 2.1. Điểm (S1): Chương Lưu Niên bỏ sót Lưu Hóa Lộc / Lưu Hóa Khoa (trong khi ma trận 5 năm có đủ 4 hóa)
> **[Áp dụng ràng buộc P3 & P7 & P8]**

#### a) Nguyên nhân gốc theo code
1. **Ở tầng Prompt (`server.ts:152–202`, hàm `buildStrictPeriodAiPrompt`):**
   - Khác với `buildStrictDossierSectionPrompt` (`server.ts:356` ghi rõ *"4 sao Lưu Tứ Hóa (Lộc, Quyền, Khoa, Kỵ)"*), hàm `buildStrictPeriodAiPrompt` tại `dòng 161` chỉ nhắc chung *"Tứ Hóa kỳ hạn (Lộc, Quyền, Khoa, Kỵ)"* như một nguồn dữ kiện, **không có mệnh lệnh bắt buộc AI phải điểm danh đủ cả 4 sao Tứ Hóa kỳ hạn (Hóa Lộc, Hóa Quyền, Hóa Khoa, Hóa Kỵ)** trong nội dung phân tích. Khi chạy model `gemini-3.5-flash-lite`, model thường chỉ chọn 1–2 sao nổi bật (như Hóa Quyền, Hóa Kỵ) ở cung Mệnh/Quan và bỏ quên Hóa Lộc, Hóa Khoa nằm ở các cung khác.
2. **Ở tầng Hậu kiểm (`server.ts:660–685` & `DetailedDossierModal.tsx:481–570`):**
   - Hoàn toàn chưa có cơ chế kiểm tra xác định xem văn bản sinh ra đã nhắc đủ 4 sao Lưu Tứ Hóa (hoặc Đại Hạn Tứ Hóa) có trong `periodContext.periodSiHua` hay chưa.

#### b) Phân tích 3 phương án hậu kiểm theo ràng buộc (P3) & chi phí Quota
Server và Client đều nắm sẵn mảng xác định `periodContext.periodSiHua` (4 phần tử ứng với `Hóa Lộc`, `Hóa Quyền`, `Hóa Khoa`, `Hóa Kỵ` tại `src/lib/ziwei/yunxian-context.ts:440–454`). Khi văn bản hoàn tất mà phát hiện thiếu ít nhất 1 trong 4 cặp `(starNameVi, mutagenVi)`:

| Phương án hậu kiểm (P3) | Cơ chế hoạt động | Chi phí Quota AI | Rủi ro khi Google 503 / chỉ có 3 key khỏe | Đánh giá đề xuất |
| :--- | :--- | :--- | :--- | :--- |
| **(a) Tự động chèn/bổ sung khối dữ kiện xác định (Deterministic Fact Addendum)** | Nếu văn bản AI bỏ sót $k \ge 1$ hóa trong 4 Tứ Hóa kỳ hạn, hệ thống tự động nối thêm một tiểu mục chuẩn mực vào cuối mục `### 2. Tổ Hợp Sao Kích Hoạt & Tứ Hóa Kỳ Hạn` (hoặc cuối bài): ghi rõ các sao Tứ Hóa kỳ hạn còn thiếu kèm cung Bản Mệnh, vai trò cung Lưu Niên, đối cung xung chiếu từ `periodContext.periodSiHua`. | **0 lượt gọi AI thêm** (tiết kiệm 100% quota). | **Không có rủi ro 503.** Luôn đảm bảo bài lưu vào cache đủ 4/4 Tứ Hóa. | **KHUYẾN NGHỊ CHÍNH (Phương án A)** |
| **(b) Gắn cờ cảnh báo "Chương chưa điểm đủ 4 Tứ Hóa" trên UI** | Giữ nguyên văn bản, gắn badge cảnh báo kèm danh sách sao bị thiếu để người dùng tự quyết định xem tiếp hoặc bấm "Phân tích lại". | **0 lượt gọi tự động** (chỉ tốn 1 lượt nếu người dùng chủ động bấm sinh lại). | An toàn quota, nhưng bản xuất HTML/MD nếu người dùng không sinh lại sẽ vẫn thiếu sao trong văn xuôi. | **KHUYẾN NGHỊ KẾT HỢP NHẸ (Phương án A + thông báo minh bạch)** |
| **(c) Tự động gọi AI sinh lại (Auto-Regenerate)** | Hủy kết quả vừa sinh và gọi lại `executeStream` lần 2 với prompt nhắc nhở gắt hơn. | **Tăng gấp đôi (200%) chi phí quota** cho chương đó. | **RẤT NGUY HIỂM:** Kho key hiện chỉ có 3 key khỏe và Google thường trả 503; gọi lại tự động dễ làm cạn kiệt nốt key khỏe hoặc rơi vào lỗi 503 liên hoàn. | **BÁC BỎ** |

#### c) Tầng sửa, File & Hàm cụ thể
1. **Tầng Prompt (`server.ts` — hàm `buildStrictPeriodAiPrompt`, dòng `152–202`):**
   - Bổ sung vào Quy tắc bắt buộc (`dòng 161–186`):
     - Yêu cầu trong mục `### 2. Tổ Hợp Sao Kích Hoạt & Tứ Hóa Kỳ Hạn`, AI **BẮT BUỘC phải phân tích đủ cả 4 sao Tứ Hóa của kỳ hạn (`Hóa Lộc`, `Hóa Quyền`, `Hóa Khoa`, `Hóa Kỵ`)** đã liệt kê trong `periodContext.factTableMarkdown`, nêu rõ từng sao đóng tại cung Bản Mệnh nào, giữ vai trò cung kỳ hạn (`Lưu ...` / `Đại hạn ...`) nào và xung chiếu cung nào; tuyệt đối không được bỏ sót bất kỳ hóa nào trong 4 hóa.
     - Đồng bộ quy tắc tiền tố 4 tầng Tứ Hóa từ `buildStrictDossierSectionPrompt` (`dòng 372`) sang `buildStrictPeriodAiPrompt`.
2. **Tầng Hậu kiểm xác định (`src/lib/ziwei/yunxian-context.ts` hoặc `src/lib/dossier-chat-ui.ts` + điểm chốt luồng):**
   - Viết hàm thuần **`verifyAndEnsureCompletePeriodSiHua(text: string, periodContext: YunxianPeriodContext): { isComplete: boolean; missingEntries: YunxianSiHuaTarget[]; patchedText: string }`**:
     - Kiểm tra từng phần tử `sh` trong `periodContext.periodSiHua` (4 hóa): văn bản đã sinh có nhắc tới tên sao `sh.starNameVi` (hoặc biến thể chuẩn tiếng Việt) cùng với loại hóa `sh.mutagenVi` hay chưa.
     - Nếu thiếu (`missingEntries.length > 0`), tự động dựng khối **`> 📌 **[Bổ Khuyết Dữ Kiện Tứ Hóa Kỳ Hạn (Can ${periodContext.periodStemVi})]**`** trình bày đầy đủ tọa độ Bản Mệnh + vai trò cung Lưu Niên + đối cung xung chiếu của(các) sao bị AI bỏ sót và chèn vào ngay cuối mục 2 (hoặc cuối bài trước mục Lời khuyên) trước khi ghi vào `aiPeriodCache`.

#### d) Cách kiểm chứng
- Dùng nguyên văn văn bản Chương 5 thật của lá số Nguyễn Văn An (đang chỉ nhắc Hóa Quyền + Hóa Kỵ, thiếu Hóa Lộc + Hóa Khoa) làm fixture trong unit test: khẳng định hàm `verifyAndEnsureCompletePeriodSiHua` phát hiện đúng `isComplete === false`, `missingEntries` chứa đúng 2 sao `Hóa Lộc` và `Hóa Khoa`, và `patchedText` sau khi vá đạt `isComplete === true` mà tốn 0 lượt gọi AI.

---

### 2.2. Điểm (S2): Chương Lưu Niên lẫn nhãn tầng trong văn xuôi ("tam hợp Tài Bạch (trùng Mệnh Cung)" thay vì "Lưu Tài Bạch")
> **[Áp dụng ràng buộc P4 & P7]**

#### a) Nguyên nhân gốc theo code
Bằng chứng Bước 1 xác nhận nguyên nhân gốc nằm ở **tầng DỮ KIỆN (`factTableMarkdown` trong `src/lib/ziwei/yunxian-context.ts` và `dossier-context.ts`)**, còn prompt chỉ là nguyên nhân thứ yếu:
1. Trong `src/lib/ziwei/yunxian-context.ts` (`buildYunxianPeriodContext`, dòng `278–671`):
   - Hàm `getPeriodPalaceRoleVi(targetBranch)` (`dòng 360–364`) chỉ trả về chuỗi kiểu `"Lưu Tài Bạch"`, `"Lưu Mệnh"`...
   - **Chỗ khuyết 1 (`dòng 502–507` & `595–607`):** Mục `[Tam Phương Tứ Chính & Điểm Xung Chiếu Của Kỳ Hạn]` chỉ in 4 cung (`Lưu Mệnh Cung`, `Lưu Thiên Di`, `Lưu Tài Bạch`, `Lưu Quan Lộc`) với câu:
     `• **Tam hợp Tài Bạch (Lưu Tài Bạch)**: Trùng bản mệnh **Mệnh Cung (Ất Mão)**...`
     Cách viết nhãn đầu dòng là `**Tam hợp Tài Bạch (Lưu Tài Bạch)**` khiến AI đọc lướt dễ rút gọn thành `"tam hợp Tài Bạch (trùng Mệnh Cung)"` mà đánh rơi chữ **"Lưu"**! Hơn nữa, **8 cung Lưu Niên còn lại** không hề có dòng ánh xạ nào trong bảng dữ kiện.
   - **Chỗ khuyết 2 (`dòng 560–565` & interface `YunxianSiHuaTarget` dòng `30–42`):** Trong mục `[Tứ Hóa Kỳ Hạn ...]`, đối cung xung chiếu chỉ in `đối cung xung chiếu: ${sh.oppositePalaceNameVi} (${sh.oppositePalaceGanZhiVi})`, **không có vai trò cung Lưu Niên của đối cung đó**.
   - **Chỗ khuyết 3 (`dòng 568–587`):** Mục `[Các Sao Lưu / Vận Hạn Theo Engine]` chỉ in `tại ${d.natalPalaceNameVi} (${d.branchVi})`, **bỏ quên không in `d.periodPalaceRoleVi`** dù ở `dòng 463` đã tính sẵn.
2. Trong `src/lib/ziwei/dossier-context.ts` (`buildMultiYearHorizonContext`, dòng `622–935`):
   - `MultiYearSiHuaEntry` (`dòng 547–558`) và `mapSiHuaEntry` (`dòng 733–765`) **lược bỏ mất `periodPalaceRoleVi`**, khiến cả `compactMatrixMarkdown` (`dòng 876–880`) lẫn mục `(6) Bộ Lưu Tứ Hóa` (`dòng 911–918`) của Chương 7 & 8 chỉ có tên cung Bản Mệnh mà không có vai trò cung Lưu Niên.

#### b) Tầng sửa, File & Hàm cụ thể
1. **Tầng Dữ kiện Kỳ hạn (`src/lib/ziwei/yunxian-context.ts`):**
   - **Bổ sung trường `oppositePeriodPalaceRoleVi: string`** vào interface `YunxianSiHuaTarget` (`dòng 30–42`) và gán giá trị `getPeriodPalaceRoleVi(oppositeBranch)` tại `dòng 451`.
   - **Tại mục `[Tứ Hóa Kỳ Hạn ...]` (`dòng 560–565`):** In rõ cả 2 tầng cho cả bản cung lẫn đối cung:
     ```ts
     • **${sh.mutagenVi}**: Sao **${sh.starNameVi}** [${sh.brightnessVi}] tọa thủ tại **[Vai trò kỳ hạn: ${sh.periodPalaceRoleVi}] — trùng [Cung Bản Mệnh gốc: ${sh.natalPalaceNameVi} (${sh.natalPalaceGanZhiVi})]** — xung chiếu **[Vai trò kỳ hạn: ${sh.oppositePeriodPalaceRoleVi}] — trùng [Cung Bản Mệnh gốc: ${sh.oppositePalaceNameVi} (${sh.oppositePalaceGanZhiVi})]**.
     ```
   - **Tại mục `[Các Sao Lưu / Vận Hạn Theo Engine]` (`dòng 568–587`):** Bổ sung `*(vai trò kỳ hạn: ${d.periodPalaceRoleVi})*` bên cạnh tên cung Bản Mệnh cho mọi Sao Lưu (`Lưu Thái Tuế`, `Lưu Lộc Tồn`, `Lưu Kình Dương`, `Lưu Đà La`, `Lưu Thiên Mã`, `Lưu Khốc/Hư`, `Lưu Tang/Hổ`, `Lưu Đào/Hồng/Hỷ`).
   - **Tại mục `[Tam Phương Tứ Chính & Điểm Xung Chiếu Của Kỳ Hạn]` (`dòng 502–507, 595–607`):**
     - Đổi nhãn đầu dòng từ `Tam hợp Tài Bạch (Lưu Tài Bạch)` thành nhãn tường minh tuyệt đối: **`Cung Lưu Tài Bạch (Tam hợp của Lưu Mệnh)`** / **`Cung Đại Hạn Tài Bạch (Tam hợp của Đại Hạn Mệnh)`** `→ đóng nhờ trên Cung Bản Mệnh gốc: ${node.natalPalaceNameVi} (${node.ganZhiVi})`.
     - Thêm **Bảng Ánh Xạ Đầy Đủ 12 Cung Kỳ Hạn ↔ 12 Cung Bản Mệnh Gốc** (12 dòng ngắn gọn tiền-tính sẵn bằng `getPeriodPalaceRoleVi(b)` cho đủ 12 Địa Chi `0..11`), để AI tra cứu trực tiếp 100% mà không bao giờ phải tự đếm nghịch/thuận trên bàn tay.
2. **Tầng Dữ kiện Ma trận 5 năm / 10 năm (`src/lib/ziwei/dossier-context.ts`):**
   - Thêm `periodPalaceRoleVi: string` và `oppositePeriodPalaceRoleVi: string` vào `MultiYearSiHuaEntry` (`dòng 547–558`) và giữ lại trong `mapSiHuaEntry` (`dòng 733–765`).
   - Cập nhật `compactMatrixMarkdown` (`dòng 876–880`) và mục `(6) Bộ Lưu Tứ Hóa` (`dòng 911–918`) để ghi rõ: `tại ${s.periodPalaceRoleVi} [trùng bản mệnh ${s.natalPalaceNameVi}] (xung ${s.oppositePeriodPalaceRoleVi} [trùng bản mệnh ${s.oppositePalaceNameVi}])`.
3. **Tầng Prompt phụ trợ (`server.ts` — `buildStrictPeriodAiPrompt`, dòng `164–166`):**
   - Siết chặt Quy tắc 3: Khi gọi tên một cung thuộc tam hợp/xung chiếu của Lưu Niên (hoặc Đại Hạn), **BẮT BUỘC phải có chữ `"Lưu "` (hoặc `"Đại hạn "`) đứng trước tên chức năng cung** (ví dụ: phải viết **`"cung Lưu Tài Bạch (đóng tại Mệnh Cung gốc ở Mão)"`**, TUYỆT ĐỐI CẤM viết tắt thành `"tam hợp Tài Bạch (trùng Mệnh Cung)"` gây nhầm với cung Tài Bạch gốc của Bản Mệnh).

#### c) Cách kiểm chứng
- Trong `scripts/verify-dossier-context.ts`, dựng `YunxianPeriodContext` cho năm 2027 (Đinh Mùi) của lá số Nguyễn Văn An (16/08/1995): kiểm tra `factTableMarkdown` có bảng ánh xạ đủ 12 cung Lưu Niên, cung Mão được gắn nhãn tường minh `Cung Lưu Tài Bạch (Tam hợp của Lưu Mệnh) → đóng nhờ trên Cung Bản Mệnh gốc: Mệnh Cung`, đối cung xung chiếu của 4 sao Lưu Tứ Hóa có đủ `oppositePeriodPalaceRoleVi`, và mục Sao Lưu có in vai trò cung Lưu Niên.

---

### 2.3. Điểm (S3): Ký tự lạ `"cácφ"` và lỗi dính từ `"căngđộ"` lọt vào văn bản cache
> **[Áp dụng ràng buộc P1 & P2 & P8]**

#### a) Nguyên nhân gốc & Phân tách 2 lớp lỗi theo ràng buộc (P1)
1. **Lớp lỗi 3A — Ký tự ngoại lai từ nhiễu token của LLM (`"cácφ"`):**
   - Đôi khi bộ giải mã token của model `flash-lite` phát sinh một glyph thuộc bảng mã ngoại lai (như chữ Hy Lạp `φ` U+03C6, Cyrillic, Hebrew, Ả Rập, Thái, Devanagari...) dính sát vào từ tiếng Việt (`"cácφ"`).
   - **Tuân thủ nghiêm ngặt P1:** **TUYỆT ĐỐI CẤM** dùng regex kiểu `[^\p{ASCII}...]` hay xóa mù quáng mọi ký tự ngoài bảng chữ cái Latin, bởi vì trong văn bản luận giải có:
     - Các ký hiệu toán học/hình học và dấu câu hợp lệ: `↔`, `→`, `←`, `•`, `–`, `—`, `…`, `%`, `±`, `×`, `°`, `「`, `」`, ngoặc kép cong `“”‘’`, các ký hiệu Markdown/callout.
     - Chữ Hán (CJK Unified Ideographs `\p{Script=Han}`) **HỢP LỆ** khi chế độ song ngữ bật (hoặc trong một số thuật ngữ nếu có cấu hình cho phép), nhưng **KHÔNG HỢP LỆ** trong văn bản luận giải tiếng Việt thuần khi chế độ song ngữ tắt (như quy tắc 5 tại `server.ts:169` và quy tắc 4 tại `server.ts:373` đều ghi *"Viết hoàn toàn bằng tiếng Việt chuẩn mực, không dùng chữ Hán"*).
   - **Thiết kế bộ lọc danh sách đen theo Script Unicode (`sanitizeVietnameseAiText`):**
     - Chỉ loại bỏ chính xác các ký tự thuộc những hệ chữ (Unicode Scripts) **không bao giờ hợp lệ** trong văn bản luận giải tiếng Việt:
       - `Greek` (`\p{Script=Greek}` — bắt trúng `φ` trong `"cácφ"` $\rightarrow$ `"các"`),
       - `Cyrillic` (`\p{Script=Cyrillic}`),
       - `Hebrew` (`\p{Script=Hebrew}`),
       - `Arabic` (`\p{Script=Arabic}`),
       - `Thai` (`\p{Script=Thai}`),
       - `Devanagari` (`\p{Script=Devanagari}`),
       - `Hangul` (`\p{Script=Hangul}`), `Hiragana` (`\p{Script=Hiragana}`), `Katakana` (`\p{Script=Katakana}`),
       - Ký tự điều khiển vô hình / lỗi giải mã (`\uFFFD` replacement char, zero-width junk `\u200B-\u200D\uFEFF` ngoại trừ newline/tab chuẩn).
     - Với hệ chữ Hán (`\p{Script=Han}`): điều khiển bằng cờ tham số `allowHanzi: boolean` (mặc định `false` cho văn bản luận giải AI tiếng Việt; nếu truyền `allowHanzi: true` khi bật chế độ song ngữ thì giữ nguyên Hán tự). Nếu có cụm ngoặc rỗng `()` hoặc `[]` còn sót lại sau khi gỡ Hán tự/ký tự lạ thì dọn sạch khoảng trắng thừa.

2. **Lớp lỗi 3B — Lỗi dính từ tiếng Việt mất dấu cách (`"căngđộ"`, và chuẩn hóa chữ lẻ ở S4):**
   - **Tuân thủ P1:** `"căngđộ"` gồm toàn các ký tự tiếng Việt hợp lệ (`c-ă-n-g-đ-ộ`), nên **bộ lọc glyph ngoại lai (Lớp 3A) KHÔNG THỂ và KHÔNG ĐƯỢC tự ý cắt bừa mọi chuỗi tiếng Việt**.
   - Cần tách thành **Lớp chuẩn hóa từ vựng & tách dính âm tiết tiếng Việt an toàn (`normalizeVietnameseMergedWordsAndTypos`)** dựa trên 2 quy tắc xác định (không gây dương tính giả):
     1. **Quy tắc âm vị học tiếng Việt (Phonotactic Boundary Rule):** Trong tiếng Việt chuẩn, phụ âm **`đ` (`đ`/`Đ`) KHÔNG BAO GIỜ đứng ở vị trí phụ âm cuối (coda) hay giữa âm tiết** — chữ `đ` chỉ có thể là **phụ âm đầu (onset) của một âm tiết mới**! Do đó, bất kỳ mẫu nào có dạng `[chữ cái tiếng Việt thường/hoa][đ|Đ][nguyên âm tiếng Việt]` (ví dụ: `"căngđộ"`, `"mứcđộ"`, `"tốcđộ"`, `"chếđộ"`, `" tháiđộ"`, `"biếnđộng"`, `"giaiđoạn"`, `"cungđiền"`) đều **chắc chắn 100% là lỗi mất dấu cách trước chữ `đ`** và có thể tách an toàn tuyệt đối bằng regex: `/(?<=\p{L})(?=[đĐ]\p{L})/gu` $\rightarrow$ chèn 1 dấu cách (`"căngđộ"` $\rightarrow$ `"căng độ"`).
     2. **Quy tắc ranh giới dấu thanh điệu kép & từ điển cặp dính phổ biến:** Một âm tiết tiếng Việt chỉ có tối đa 1 nguyên âm mang dấu thanh (sắc, huyền, hỏi, ngã, nặng). Ngoài ra, kèm một bảng từ điển nhỏ các lỗi dính từ / lỗi chữ lẻ đã ghi nhận thực tế (như `"kho lứa"` $\rightarrow$ `"kho lúa"`, `"bảo Thủ"` giữa câu $\rightarrow$ `"bảo thủ"`, v.v. — xem chi tiết ở mục 2.4).

#### b) Điểm chèn DUY NHẤT trong pipeline theo ràng buộc (P2)
- **Phân tích so sánh Server-side Chunk vs. Client-side Pre-Cache Choke Point (P2):**
  1. **Nếu lọc tại Server theo từng mảnh `chunk` rời rạc (`sendSseText` tại `server.ts:123–125` hoặc `executor.ts:234–245`):**
     - **Ưu điểm:** Tập trung ở 1 hàm trên server.
     - **Nhược điểm kỹ thuật (đã nêu trong P2):** Luồng SSE chia văn bản thành các chunk nhỏ bất kỳ. Nếu từ `"căngđộ"` bị tách làm 2 chunk (`"căng"` ở chunk $i$ và `"độ"` ở chunk $i+1$), hoặc cụm `"kho "` + `"lứa"`, hoặc cụm ngoặc chữ Hán `(命` + `宮)` bị cắt ngang giữa 2 chunk, bộ lọc chạy trên từng chunk đơn lẻ sẽ **không nhìn thấy ranh giới ghép giữa 2 chunk**!
     - **Giải pháp nếu muốn giữ tại Server:** Trong `GeminiStreamExecutor.executeStream` (`server/key-pool/executor.ts:234–245`), chỉ lọc **Lớp 3A (ký tự đơn lẻ theo Script Unicode: Greek `φ`, Cyrillic...)** ngay trên từng chunk vì kiểm tra Unicode Script là cấp độ từng code point (không phụ thuộc biên từ); **ĐỒNG THỜI** ở tầng Client dùng một hàm helper chung duy nhất bọc luồng đọc SSE trước khi ghi bất kỳ cache nào.
  2. **Thiết kế Điểm Chặn Duy Nhất Trước Khi Ghi Mọi Cache (Unified Stream Sanitizer):**
     - Đặt hàm thuần **`sanitizeAiVietnameseOutput(rawText: string, options?: { allowHanzi?: boolean }): string`** (kết hợp cả Lớp 3A + Lớp 3B + chuẩn hóa S4) tại module dùng chung **`src/lib/ziwei/text-sanitizer.ts`** (có thể import từ cả `server.ts` lẫn `src/`).
     - **Chặn ngay khi cộng dồn `accumulated` từ luồng SSE, TRƯỚC KHI ghi vào bất kỳ cache nào (`aiPeriodCache`, `localChapters`, `sessionStorage`, `InsightPanel.cache`):**
       - Tại **`src/components/DetailedDossierModal.tsx`** (`executeSingleChapterStream`):
         - Dòng `435` (trong `processLine`): `accumulated = sanitizeAiVietnameseOutput(accumulated + deltaText);`
         - Dòng `481` (ngay sau `while (!doneSignal)` kết thúc đọc SSE, trước mọi lệnh ghi `onAiPeriodCacheChange` ở dòng `491, 549`, `setLocalChapters` ở dòng `502, 556` và `persistCompletedSectionToSession` ở dòng `565`): `accumulated = sanitizeAiVietnameseOutput(accumulated);`
       - Tại **`src/components/InsightPanel.tsx`** (`requestPeriodAiInterpretation` dòng `235` & `268`, và `fetchInsight` dòng `395` & `407`): gọi cùng hàm `sanitizeAiVietnameseOutput(accumulated)` ngay trước khi gọi `setAiPeriodCache` / `setCache`.
       - Tại **`src/components/ContextualChatDrawer.tsx`** (`dòng 325` & `360`): gọi cùng hàm `sanitizeAiVietnameseOutput(accumulated)` trước khi gọi `persistThread`.
     - Nhờ áp dụng `accumulated = sanitizeAiVietnameseOutput(accumulated + deltaText)` trên toàn bộ chuỗi tích lũy trước mọi lệnh `setAiPeriodCache` / `setLocalChapters` / `writeDossierCacheEntry`, **cả lỗi cắt ngang chunk lẫn sự đồng bộ 100% giữa cache Hồ Sơ và cache Tab Luận Giải đều được giải quyết triệt để**.

#### c) Cách kiểm chứng
- Viết unit test với đúng 2 fixture thật từ hồ sơ Nguyễn Văn An (`"cácφ"` và `"căngđộ"`), cùng các test case bảo toàn ký tự hợp lệ (`↔`, `•`, `%`, `–`, và chữ Hán khi `allowHanzi: true`).

---

### 2.4. Điểm (S4): Lỗi chữ lẻ ("kho lứa", "bảo Thủ", "canh Thìn/Dần") & Tiêu đề mục cung Chương 4 thiếu `[Đại hạn X–Y tuổi]`
> **[Áp dụng ràng buộc P5 & P7]**

#### a) Nguyên nhân gốc theo code
1. **Về tiêu đề mục cung Chương 4 thiếu `[Đại hạn X–Y tuổi]` (P5):**
   - Bằng chứng Bước 1 chỉ rõ: Trong `src/lib/ziwei/dossier-context.ts` (`buildPalaceGroupFactSheetVi`, dòng `506–514`), bảng dữ kiện đã dựng sẵn tiêu đề chuẩn cho cả 12 cung:
     `### Cung ${natalPalaceNameVi} (${ganZhiVi}) ${badges}` (với `badges` gồm `[AN MỆNH]`, `[AN THÂN]`, `[Đại hạn X–Y tuổi]`).
   - Thế nhưng ở `server.ts:350` (`buildStrictDossierSectionPrompt`), mẫu tiêu đề yêu cầu AI viết lại chỉ là:
     ``- Phải viết đầy đủ 4 đề mục Markdown `### Cung <Tên Cung> (<Can Chi>)` tách biệt cho cả 4 cung...``
   - Vì để AI tự gõ lại dòng tiêu đề `### Cung ...`, nên ở Chương 2 và 3 AI tình cờ chép theo dòng tiêu đề của `factSheetMarkdown` (có `[Đại hạn X–Y tuổi]`), còn sang Chương 4 AI lại chép theo mẫu rút gọn của prompt ở `server.ts:350` (bỏ mất `[Đại hạn X–Y tuổi]`).
2. **Về lỗi chữ lẻ (`"kho lứa"`, `"bảo Thủ"`, `"canh Thìn/Dần..."`):**
   - Trong Tử Vi, Thiên Cơ / Thiên Lương hoặc Tài Bạch / Điền Trạch hay dùng hình ảnh `"kho lúa"` (lương thực tích trữ), nhưng model `flash-lite` đôi khi trượt dấu thành `"kho lứa"`.
   - Từ ghép `"bảo Thủ"` bị viết hoa chữ `T` ở giữa câu do nhiễu viết hoa tên riêng của LLM.
   - Ở Chương 4, khi nói về Thiên Can của cung (ví dụ Can Canh của cung Canh Thìn / Canh Dần, hoặc từ chung `"can Thìn/Dần"` — vốn Thìn/Dần là Địa Chi chứ không phải Thiên Can, hoặc AI gõ nhầm chữ `"can"` thành `"canh"` trước Địa Chi không đi với Can Canh), AI viết `"canh Thìn/Dần..."` gây khó hiểu và lệch chuẩn thuật ngữ giữa các chương.

#### b) Giải pháp cho tiêu đề mục cung theo ràng buộc (P5) & Hệ quả với Cache hiện có
Theo gợi ý của **(P5)**, không thể tin cậy hoàn toàn vào việc chỉ sửa prompt để AI tự viết tiêu đề. Có 2 cách tiếp cận xác định:
- **Cách P5-A (Hậu xử lý chuẩn hóa dòng tiêu đề `### Cung ...` bằng dữ kiện Engine — Canonical Palace Heading Enforcer):**
  - Với 3 chương nhóm cung (`palaces_core`, `palaces_family`, `palaces_social_health`), app đã có sẵn danh sách 4 cung thuộc chương đó trong `chart.palaces` (cùng `ganZhiVi`, `isMingGong`, `isShenGong`, `daXianAgeRangeVi`).
  - Viết hàm xác định **`enforceCanonicalPalaceGroupHeadings(markdownText: string, chart: ZiweiChart, sectionId: DossierSectionId): string`**:
    - Quét các dòng heading cấp 2/3 (`^#{2,4}\s*(?:Cung\s+)?(<Tên Cung>)\b.*$` theo 4 cung của nhóm).
    - **Thay thế hoàn toàn dòng tiêu đề do AI viết** bằng dòng tiêu đề chuẩn mực được render xác định 100% từ `chart.palaces`:
      `### Cung ${palaceNameVi} (${ganZhiVi}) ${badges}` (ví dụ: `### Cung Phụ Mẫu (Quý Mùi) [Đại hạn 16–25 tuổi]`).
  - Đồng thời sửa luôn `server.ts:350` để prompt cũng in đúng mẫu có `[Đại hạn X–Y tuổi]`.
- **Cách P5-B (Tách UI render khung tiêu đề cố định, AI chỉ trả về thân bài 4 cung):**
  - Đòi hỏi tách văn bản chương thành 4 mảnh hoặc đổi cấu trúc lưu trữ trong `DossierChapterState.text`.
- **So sánh & Hệ quả đối với Cache hiện có (`localChapters` + `sessionStorage ziwei_dossier_v1` + `aiPeriodCache`):**
  - `aiPeriodCache` chỉ lưu các kỳ hạn Đại Hạn / Lưu Niên (Chương 5 & 6), **không lưu** Chương 2, 3, 4 nên `aiPeriodCache` không bị ảnh hưởng bởi tiêu đề 12 cung.
  - Chương 2, 3, 4 được lưu dưới dạng chuỗi `text` Markdown nguyên khối trong `localChapters` (`DetailedDossierModal.tsx:124`) và `sessionStorage` (`ziwei_dossier_v1::${chartIdentityKey}` tại `dossier-chat-ui.ts:403–463`).
  - Nếu chọn **Cách P5-A (Hậu xử lý thay dòng tiêu đề bằng khung dữ kiện chuẩn)** và gọi hàm này:
    1. Ngay tại điểm chặn trước khi ghi cache (`DetailedDossierModal.tsx:481`), **VÀ**
    2. Khi đọc từ `sessionStorage` lên (`readDossierCacheEntry` tại `dossier-chat-ui.ts:403` hoặc khi khởi tạo `localChapters` tại `DetailedDossierModal.tsx:160`),
    thì **mọi văn bản Chương 2, 3, 4 đã lưu sẵn trong `sessionStorage` từ trước sẽ tự động được nâng cấp lên tiêu đề chuẩn có `[Đại hạn X–Y tuổi]` ngay lập tức mà KHÔNG cần xóa cache hay bắt người dùng tốn quota sinh lại!**

#### c) Giải pháp cho lỗi chữ lẻ (`"kho lứa"`, `"bảo Thủ"`, `"canh Thìn/Dần"`)
1. **Trong bộ lọc chuẩn hóa `sanitizeAiVietnameseOutput` (`src/lib/ziwei/text-sanitizer.ts`):**
   - Sửa các cụm từ sai chính tả cố định theo ngữ cảnh Tử Vi:
     - `/\bkho\s+lứa\b/giu` $\rightarrow$ giữ hoa/thường tương ứng thành `"kho lúa"`.
     - `/\bbảo\s+Thủ\b/gu` $\rightarrow$ `"bảo thủ"` (và quy tắc tổng quát cho các tính từ ghép tiếng Việt thông dụng bị viết hoa âm tiết thứ hai sau chữ thường mà không phải tên sao/tên cung/tên riêng).
     - Chuẩn hóa thuật ngữ Can/Chi khi viết nhầm `"canh <Địa Chi không thuộc阳Canh>"` hoặc nhắc nhở trong prompt `server.ts:371–375`: quy định rõ Thiên Can phải viết hoa chữ cái đầu (`Can Giáp, Can Ất, Can Bính, Can Đinh, Can Mậu, Can Kỷ, Can Canh, Can Tân, Can Nhâm, Can Quý`), Địa Chi đi kèm phải đúng âm dương (Can Canh chỉ đi với Thân, Ngọ, Thìn, Dần, Tý, Tuất; không viết `"canh Thìn/Dần"` chữ thường lập lờ giữa danh từ `"can"` và Thiên Can `"Canh"`).

#### d) Cách kiểm chứng
- Unit test truyền văn bản Chương 4 có dòng `### Cung Phụ Mẫu (Quý Mùi)` (thiếu `[Đại hạn ...]`), có chữ `"kho lứa"` và `"bảo Thủ"` qua `sanitizeAiVietnameseOutput` + `enforceCanonicalPalaceGroupHeadings`: khẳng định đầu ra đổi thành `### Cung Phụ Mẫu (Quý Mùi) [Đại hạn ...]` và sửa sạch `"kho lúa"`, `"bảo thủ"`.

---

### 2.5. Điểm (S5): Header bản xuất hồ sơ (HTML / MD / Sao chép / In) thiếu Giờ sinh và Giờ Mặt Trời thật
> **[Áp dụng ràng buộc P6 & P7]**

#### a) Nguyên nhân gốc theo code
Bằng chứng Bước 1 xác nhận:
- Hàm gốc **`buildDossierHeaderMetadata(chart)`** tại `src/lib/dossier-chat-ui.ts:759–778` chỉ trả về `{ name, solar, lunar, yinYang, ju, mingBranch, mingMajors }`.
- Cả 3 hàm xuất bản trong `src/lib/dossier-chat-ui.ts` (`buildDossierMarkdownExport` dòng `780–845`, `buildDossierPlainTextExport` dòng `847–855`, `buildDossierStandaloneHtmlExport` dòng `860–1050`) và `printSheetPortal` trong `src/components/DetailedDossierModal.tsx:763–769` (cùng header Modal dòng `831–843`) đều **không hiển thị giờ sinh và giờ Mặt Trời thật**.
- Trong khi đó, dữ liệu đầu vào `chart.birthInfo` (`src/lib/ziwei/types.ts:15–38`) **đã có đủ 100% thông tin cần thiết**:
  - `chart.birthInfo.hour` (`0..11`): chỉ số Địa Chi giờ sinh đã áp hiệu chỉnh.
  - `chart.birthInfo.origInput` (`{ year, month, day, clockHour, clockMinute }`): giờ đồng hồ gốc người dùng nhập (khi biết giờ sinh).
  - `chart.birthInfo.province`, `chart.birthInfo.city`, `chart.birthInfo.longitude`: nơi sinh và kinh độ.
  - Hàm `toTrueSolarTime(year, month, day, clockHour, clockMinute, longitude)` tại `src/lib/ziwei/true-solar-time.ts:59–99` tính được ngay giờ Mặt Trời thật `HH:MM` và tổng độ lệch phút `totalDiffMinutes` (kinh độ + phương trình thời gian).

#### b) Tầng sửa, File & Hàm cụ thể
1. **Tầng Template / Metadata (`src/lib/dossier-chat-ui.ts` — hàm `buildDossierHeaderMetadata`, dòng `759–778`):**
   - Mở rộng `buildDossierHeaderMetadata(chart: ZiweiChart)` (và export hàm này để `DetailedDossierModal.tsx` dùng chung cho `printSheetPortal` và header Modal):
     - **`birthHourBranchVi`**: `Giờ ${VI_BRANCHES[b.hour]}` (hoặc `"Chưa rõ giờ sinh — mặc định Giờ Tý"` nếu `!b.origInput`).
     - **`clockTimeVi`**: Nếu có `b.origInput`, format `HH:MM` (ví dụ: `"14:30"`).
     - **`trueSolarTimeVi`**: Nếu có `b.origInput` và `typeof b.longitude === 'number'`, gọi `toTrueSolarTime(b.origInput.year, b.origInput.month, b.origInput.day, b.origInput.clockHour, b.origInput.clockMinute, b.longitude)` từ `src/lib/ziwei/true-solar-time.ts:59`:
       - Format chuỗi hiển thị: `${HH}:${MM} (Giờ ${VI_BRANCHES[b.hour]}, hiệu chỉnh ${totalDiffMinutes >= 0 ? '+' : ''}${totalDiffMinutes} phút theo kinh độ ${b.longitude.toFixed(2)}°Đ${locationLabel ? ` — ${locationLabel}` : ''})`.
     - **`birthTimeSummaryVi`** (dòng tổng hợp gọn cho Header):
       - Khi có `origInput`: `Giờ đồng hồ: ${clockTimeVi} → Giờ Mặt Trời thật: ${tstHHMM} (Giờ ${VI_BRANCHES[b.hour]}, ${diffStr})`.
       - Khi không có `origInput`: `Giờ ${VI_BRANCHES[b.hour]} (Chưa rõ phút đồng hồ gốc)`.
2. **Đồng bộ trên cả 4 kênh xuất bản (P6):**
   - `buildDossierMarkdownExport` (`src/lib/dossier-chat-ui.ts:787–803`): Thêm dòng `- **Giờ sinh & Chân Thái Dương Thời:** ${meta.birthTimeSummaryVi}` và `- **Nơi sinh:** ${meta.locationVi}` ngay dưới dòng Âm lịch.
   - `buildDossierPlainTextExport` (`src/lib/dossier-chat-ui.ts:847–855`): Tự động kế thừa từ `buildDossierMarkdownExport`.
   - `buildDossierStandaloneHtmlExport` (`src/lib/dossier-chat-ui.ts:1007–1021`): Thêm ô thông tin `Giờ sinh (Đồng hồ)` và `Giờ Mặt Trời thật (Chân Thái Dương)` vào khung `.meta-grid` trên trang đầu.
   - `printSheetPortal` (`src/components/DetailedDossierModal.tsx:763–769`) và thanh subtitle của Modal (`dòng 836–841`): Hiển thị đầy đủ giờ sinh đồng hồ + giờ Mặt Trời thật đồng bộ với bản xuất HTML/MD.
   - Bổ sung luôn thông tin giờ đồng hồ gốc + giờ Mặt Trời thật vào dòng đầu của `buildNatalOverviewFactSheetVi` (`src/lib/ziwei/dossier-context.ts:281–285`).

#### c) Cách kiểm chứng
- Trong `scripts/verify-dossier-chat-ui.ts`, truyền `ZiweiChart` có `origInput: { year: 1995, month: 8, day: 16, clockHour: 14, clockMinute: 30 }`, `longitude: 105.85` (Hà Nội): kiểm tra cả 3 đầu ra (`buildDossierMarkdownExport`, `buildDossierPlainTextExport`, `buildDossierStandaloneHtmlExport`) đều chứa chuỗi giờ đồng hồ `14:30`, giờ Mặt Trời thật đã hiệu chỉnh, và Địa Chi giờ sinh.

---

## 3. MẢNG B — NÂNG CẤP THẨM MỸ HỒ SƠ XUẤT BẢN (THEME "GIẤY CỔ")

Toàn bộ các hạng mục Mảng B đều thực hiện ở **tầng Template / Render xác định từ dữ kiện Engine (`src/lib/dossier-chat-ui.ts` và `src/components/DetailedDossierModal.tsx`)**, **chi phí Quota AI = 0 tuyệt đối**.

> **Lưu ý định dạng:** File `.MD` (Markdown thuần) và `Sao chép văn bản` chỉ mang cấu trúc văn bản/bảng Markdown, **không mang được CSS/bố cục trang bìa/màu sắc**; do đó các hiệu ứng trình bày thị giác áp dụng cho **Bản xuất `.HTML` độc lập**, **Bản In trực tiếp (`printSheetPortal` / `@media print`)**, và **Giao diện đọc trong Modal**. Riêng cấu trúc bảng Markdown (B3) và khối Kết luận nhanh (B6) áp dụng được cho cả `.MD`.

### Bảng tổng hợp 6 hướng nâng cấp thẩm mỹ (B1–B6)

| Mã | Hạng mục thẩm mỹ | Định dạng áp dụng | Tầng thực hiện (File / Hàm) | Chi tiết thiết kế & Giải pháp chống rủi ro in ấn đen trắng (B&W Print Safety) |
| :--- | :--- | :--- | :--- | :--- |
| **B1** | **Trang bìa riêng (Dedicated Cover Page)** có khung viền cổ điển kép, tên đương số cỡ lớn, ngày giờ sinh + Chân Thái Dương Thời, Nơi sinh, Âm Dương/Mệnh/Cục, Mệnh Chủ/Thân Chủ. | `.HTML` độc lập & Bản In (`printSheetPortal`) | Template trong `buildDossierStandaloneHtmlExport` (`dossier-chat-ui.ts:900–1025`) & `printSheetPortal` (`DetailedDossierModal.tsx:755–775`). Chi phí AI = 0. | Dùng khung viền kép `border: 3px double #78350f` kèm góc trang trí bằng đường nét vector/CSS thuần. Khi in (`@media print`), đặt `page-break-after: always` (hoặc khung đầu trang trang trọng) và dùng độ tương phản nét viền đậm `#1c1917` để máy in laser đen trắng vẫn lên khung sắc nét, không phụ thuộc mảng màu nền. |
| **B2** | **Sơ đồ lưới 12 cung của lá số (4×4 Traditional Grid)** chèn ngay đầu Chương 1 (`chapter_overview`), render xác định 100% từ `chart.palaces`. | `.HTML` độc lập, Bản In (`printSheetPortal`), và đầu Chương 1 trên Modal | Hàm mới `buildDeterministicChartGridHtml(chart: ZiweiChart): string` trong `src/lib/dossier-chat-ui.ts`. Chi phí AI = 0. | Dựng lưới CSS Grid 4×4 truyền thống (12 cung xung quanh theo đúng vị trí Địa Chi Tý..Hợi, ô Thiên Bàn 2×2 ở giữa ghi Họ tên, Ngày giờ sinh, Mệnh/Thân/Cục, Tứ Hóa năm sinh). Mỗi ô cung hiển thị: Tên cung (`[MỆNH]`/`[THÂN]`), Can Chi cung, Đại hạn `X–Y`, Chính tinh + độ sáng + Tứ Hóa gốc, và các Phụ tinh trọng yếu. **Rủi ro in ấn:** Tuyệt đối không dùng nền màu đậm; phân biệt Chính tinh (chữ đậm `font-weight: 700`), Hóa Lộc/Quyền/Khoa (viền gạch chân nét liền), Hóa Kỵ (khung viền nét đứt hoặc ký hiệu `[Kỵ]`) để in đen trắng phân biệt được ngay. |
| **B3** | **Ma trận năm ở Chương 7 (5 năm) & Chương 8 (10 năm) trình bày dạng Bảng (Structured Table)** thay vì đoạn văn liệt kê rời rạc. | `.HTML` độc lập, Bản In, Modal UI, **và cả `.MD`** | Hàm mới `buildMultiYearMatrixTableMarkdown` & `buildMultiYearMatrixTableHtml` từ dữ liệu `buildMultiYearHorizonContext` (`dossier-context.ts` & `dossier-chat-ui.ts`). Chi phí AI = 0. | Đính kèm bảng tổng hợp 8 cột chuẩn mực ngay đầu Chương 7 (2026–2030) và Chương 8 (2026–2035): `Năm (Can Chi) \| Tuổi \| Đại Hạn \| Quan Hệ ĐH-LN \| Lưu Mệnh (Trùng Bản Mệnh) \| Lưu Tứ Hóa (Lộc/Quyền/Khoa/Kỵ + Vai trò Lưu) \| Sao Lưu Trọng Yếu \| Cảnh Báo Xung Hợp`. Trong HTML/In, dùng `border-collapse: collapse`, kẻ ô mảnh `#a8a29e`, lặp lại `thead { display: table-header-group; }` khi sang trang in mới. |
| **B4** | **Typography & Chế bản in ấn chuyên nghiệp:** Font serif tiếng Việt (`Noto Serif` / `Merriweather` / `Georgia` fallback), Drop-cap chữ cái đầu chương, Header/Footer chạy dọc trang in, ngắt trang theo chương (`page-break-before`). | `.HTML` độc lập & Bản In (`@media print`) | CSS trong `buildDossierStandaloneHtmlExport` (`dossier-chat-ui.ts:903–995`) & `printSheetPortal` (`DetailedDossierModal.tsx`). Chi phí AI = 0. | - Khai báo `@page { size: A4; margin: 16mm 14mm; }`.<br>- Mỗi chương `.chapter` có `break-before: page` (trừ Chương 1 nối sau phần tóm tắt hoặc sau trang bìa) và `h2, h3 { break-after: avoid; }`, `table, blockquote { break-inside: avoid; }`.<br>- Drop-cap (`.chapter-body > p:first-of-type::first-letter`) cỡ `2.6em`, `font-weight: 700`, màu nâu son `#7c2d12` (khi in đen trắng vẫn là chữ đậm rõ ràng). |
| **B5** | **Tinh chỉnh bảng màu "Giấy Cổ" (Imperial Parchment Palette)** hài hòa giữa màn hình và máy in. | `.HTML` độc lập, Modal UI & Bản In | CSS biến màu trong `dossier-chat-ui.ts:903–995`. Chi phí AI = 0. | - **Trên màn hình:** Nền giấy cổ ngà ấm (`#fbf7ef`), nền thẻ phụ (`#f4ebd9`), mực chính nâu đen sâu (`#231b15` — độ tương phản AAA > 13:1), điểm nhấn tiêu đề vàng đồng sẫm (`#854d0e`) và đỏ chu sa cổ (`#991b1b`).<br>- **Khi in (`@media print`):** Tự động chuyển nền trang về trắng tinh (`#ffffff`) để **không tốn mực nền máy in** và không bị xám nền khi photocopy; giữ nguyên mực đen đậm (`#000000` / `#1c1917`) và đường kẻ viền thanh mảnh. |
| **B6** | **Khối "Kết Luận Nhanh — Cốt Tủy Lá Số (5 Dòng)"** ở ngay đầu hồ sơ (dưới trang bìa / đầu Chương 1). | `.HTML` độc lập, Bản In, Modal UI, **và cả `.MD`** | Hàm xác định `buildDeterministicExecutiveSummaryVi(chart: ZiweiChart): string[]` trong `src/lib/dossier-chat-ui.ts`. Chi phí AI = 0. | Trích xuất xác định 100% từ `chart` thành đúng 5 dòng cô đọng:<br>1. **Căn cơ Bản Mệnh & Cục:** Âm dương, Ngũ Hành Cục, quan hệ Sinh/Khắc giữa Mệnh và Cục.<br>2. **Cách cục Mệnh – Thân:** Chính tinh tọa Mệnh, cung An Thân và bộ sao hội họp Tam Phương Tứ Chính.<br>3. **Trục Tứ Hóa Bản Mệnh (Can năm sinh):** Nơi đóng của Hóa Lộc – Hóa Quyền – Hóa Khoa (nguồn lực) và Hóa Kỵ (điểm nghẽn cần tu dưỡng).<br>4. **Vận trình hiện tại (Đại Hạn & Lưu Niên 2026):** Đại hạn đang đi qua cung nào, Lưu Niên 2026 (Bính Ngọ) kích hoạt trục nào.<br>5. **Chuyển dịch năm kế tiếp (Lưu Niên 2027):** Lưu Niên 2027 (Đinh Mùi) dịch chuyển trọng tâm sang cung nào. |

---

## 4. PHẠM VI KỸ THUẬT & CÁC ĐIỀU CẤM TUYỆT ĐỐI (RÀNG BUỘC P7)

Để bảo vệ sự ổn định của hệ thống đã được kiểm chứng thực tế, kế hoạch này **TUYỆT ĐỐI TUÂN THỦ P7**:

1. **KHÔNG đụng vào Engine lập lá số cốt lõi** (`src/lib/ziwei/engine.ts` hoặc thuật toán an 14 chính tinh, phụ tinh, tính Đại Hạn, tính Can Chi).
2. **KHÔNG sửa bảng `SI_HUA_TABLE`** (trong `src/lib/ziwei/constants.ts` / `yunxian-context.ts`) — tầng dữ kiện Tứ Hóa mọi tầng đã được kiểm chứng đúng 100%.
3. **KHÔNG đụng vào Kho Khóa Gemini (`server/key-pool/*`), KHÔNG đổi cấu hình model (`gemini-3.5-flash-lite` / `gemini-3.8-flash`), KHÔNG sửa cơ chế failover hay giao diện `KeyPoolModal.tsx`.**
4. **Danh sách các file nằm trong phạm vi được phép chỉnh sửa khi thi công (sau khi Panel chốt V2 và người dùng duyệt):**
   - `src/lib/ziwei/text-sanitizer.ts` *(file mới hoặc hàm trong module sẵn có)*: Bộ lọc ký tự ngoại lai theo Unicode Script (Lớp 3A), bộ tách từ dính âm vị học `đ` & sửa chữ lẻ Tử Vi (Lớp 3B), hàm chuẩn hóa tiêu đề 4 cung (`enforceCanonicalPalaceGroupHeadings`), và hàm hậu kiểm/bổ khuyết đủ 4 Tứ Hóa kỳ hạn (`verifyAndEnsureCompletePeriodSiHua`).
   - `src/lib/ziwei/yunxian-context.ts`: Bổ sung `oppositePeriodPalaceRoleVi`, in vai trò cung Lưu Niên cho đối cung xung chiếu và cho các Sao Lưu, thêm bảng ánh xạ đầy đủ 12 cung Kỳ Hạn ↔ 12 cung Bản Mệnh gốc trong `factTableMarkdown`.
   - `src/lib/ziwei/dossier-context.ts`: Giữ lại `periodPalaceRoleVi` và `oppositePeriodPalaceRoleVi` trong `MultiYearSiHuaEntry` / `mapSiHuaEntry` cho Chương 7 & 8; bổ sung giờ đồng hồ + giờ Mặt Trời thật vào đầu bảng dữ kiện Chương 1.
   - `src/lib/dossier-chat-ui.ts`: Mở rộng `buildDossierHeaderMetadata` (thêm giờ sinh đồng hồ + giờ Mặt Trời thật qua `toTrueSolarTime` + nơi sinh); nâng cấp template xuất bản Mảng B (`B1`–`B6`); nâng cấp tiêu đề cung cho cache cũ khi đọc `readDossierCacheEntry`.
   - `src/components/DetailedDossierModal.tsx` & `src/components/InsightPanel.tsx` (& `ContextualChatDrawer.tsx`): Chèn điểm chặn `sanitizeAiVietnameseOutput` + hậu kiểm S1/S4 ngay trước khi ghi vào bất kỳ cache nào; cập nhật `printSheetPortal` và UI Mảng B.
   - `server.ts`: Cập nhật quy tắc prompt trong `buildStrictPeriodAiPrompt` (`dòng 152–202`) và sửa mẫu tiêu đề có `[Đại hạn X–Y tuổi]` trong `buildStrictDossierSectionPrompt` (`dòng 350`).

---

## 5. KẾ HOẠCH KIỂM CHỨNG TIẾT KIỆM QUOTA (RÀNG BUỘC P8)

Do kho key hiện tại chỉ có **3 key khỏe** và máy chủ Google đôi lúc trả lỗi 503, quy trình kiểm chứng sau khi thi công phải **ưu tiên kiểm chứng xác định Offline (0 tốn quota)** và **giới hạn tối thiểu kiểm chứng Live**:

### 5.1. Kiểm chứng Offline (0 lượt gọi AI — bắt buộc đạt 100%)
1. **Kiểm tra biên dịch & kiểu tĩnh:**
   - `npx tsc --noEmit` (0 lỗi) và `vite build` (`compile_applet` + `lint_applet` thành công).
2. **Unit Test Bộ lọc S3 & S4 (dùng đúng chuỗi lỗi thật làm fixture):**
   - Fixture 1: `"Trong cácφ cung hạn hiện tại, mức căngđộ công việc tăng cao, kho lứa dồi dào nhưng tính cách hơi bảo Thủ."`
     - Kỳ vọng sau `sanitizeAiVietnameseOutput`: `"Trong các cung hạn hiện tại, mức căng độ công việc tăng cao, kho lúa dồi dào nhưng tính cách hơi bảo thủ."`
   - Fixture 2 (Bảo toàn ký tự hợp lệ & công tắc song ngữ):
     - Chuỗi chứa `↔`, `•`, `85%`, `–`, và chữ Hán `紫微` khi `allowHanzi: true` $\rightarrow$ giữ nguyên 100%; khi `allowHanzi: false` $\rightarrow$ chỉ lọc bỏ `紫微`, giữ nguyên `↔`, `•`, `85%`, `–`.
   - Fixture 3 (Chuẩn hóa tiêu đề mục cung Chương 4 — S4/P5):
     - Đầu vào có `### Cung Phụ Mẫu (Quý Mùi)` (thiếu `[Đại hạn ...]`) trên lá số Nguyễn Văn An $\rightarrow$ qua `enforceCanonicalPalaceGroupHeadings` tự động thành `### Cung Phụ Mẫu (Quý Mùi) [Đại hạn ...]`.
3. **Unit Test Hậu kiểm S1 (dùng văn bản Chương 5 thật đang thiếu 2 hóa làm fixture):**
   - Truyền văn bản Chương 5 thật (chỉ có Hóa Quyền và Hóa Kỵ, thiếu Hóa Lộc và Hóa Khoa) vào `verifyAndEnsureCompletePeriodSiHua`:
     - Khẳng định `isComplete === false` và `missingEntries` trả về đúng 2 mục (`Hóa Lộc`, `Hóa Khoa`).
     - Khẳng định `patchedText` tự động chèn khối bổ khuyết xác định có đủ cả tên sao, loại hóa, cung Bản Mệnh, vai trò cung Lưu Niên và đối cung xung chiếu; chạy kiểm tra lại trên `patchedText` đạt `isComplete === true`.
4. **Unit Test Dữ kiện S2 & Header S5 + Mảng B:**
   - Khẳng định `buildYunxianPeriodContext` (năm 2027, Nguyễn Văn An) in đủ bảng 12 cung Lưu Niên, nhãn `Cung Lưu Tài Bạch` tường minh, `oppositePeriodPalaceRoleVi` và vai trò Lưu của các Sao Lưu.
   - Khẳng định `buildDossierHeaderMetadata`, `.HTML`, `.MD`, `PlainText` có đủ Giờ sinh đồng hồ + Giờ Mặt Trời thật (`toTrueSolarTime`), Sơ đồ lưới 12 cung (B2), Bảng ma trận năm (B3) và Khối kết luận nhanh 5 dòng (B6).

### 5.2. Kiểm chứng Live tối thiểu (nếu cần chạy thực nghiệm — tối đa 2 chương trên 1 lá số)
- **TUYỆT ĐỐI KHÔNG bấm "Sinh Toàn Bộ 8 Chương"** để tránh đốt 8 lượt gọi AI.
- Chỉ bấm sinh đơn lẻ **đúng 2 chương bị ảnh hưởng trực tiếp bởi S1 và S2**:
  1. **Chương 5 (`year_2026` — Lưu Niên năm hiện tại)** trên 1 lá số: kiểm tra đủ 4 Lưu Tứ Hóa.
  2. **Chương 6 (`year_2027` — Lưu Niên năm kế tiếp)** trên cùng lá số: kiểm tra gọi đúng nhãn `"Lưu Tài Bạch"` / `"Lưu ..."`, không lẫn sang tên cung Bản Mệnh gốc.

---

## 6. RỦI RO & CÁC ĐIỂM CẦN CHỦ DỰ ÁN QUYẾT ĐỊNH (CHỜ PANEL BƯỚC 3 ĐIỀN MÃ `QĐ-G...`)

*(Phần này để trống mã quyết định chính thức theo yêu cầu của Bước 2; dưới đây là danh sách các vấn đề kỹ thuật gợi ý để Tổ chuyên gia mô phỏng ở Bước 3 thảo luận, phản biện và trình Chủ dự án chốt thành bộ quyết định `QĐ-G1`, `QĐ-G2`...)*:

1. **[Chờ Panel điền QĐ-G...] Cơ chế xử lý khi Hậu kiểm S1 phát hiện AI bỏ sót Lưu Tứ Hóa (Ràng buộc P3):**
   - Chọn Phương án (a) Tự động nối khối bổ khuyết dữ kiện xác định (0 tốn quota), Phương án (b) Chỉ gắn cờ cảnh báo trên UI để người dùng tự bấm sinh lại, hay kết hợp cả (a) + thông báo nhỏ minh bạch?
2. **[Chờ Panel điền QĐ-G...] Vị trí thực thi Bộ lọc ký tự lạ & tách từ dính S3 (Ràng buộc P1, P2):**
   - Chốt đặt bộ lọc `sanitizeAiVietnameseOutput` trên chuỗi tích lũy `accumulated` ở Client ngay trước mọi điểm ghi cache (`DetailedDossierModal.tsx:481`, `InsightPanel.tsx:268`) kết hợp lọc Unicode Script từng chunk ở Server, hay chỉ đặt tại một phía? Quy tắc tách từ dính theo âm vị học chữ `đ` + từ điển nhỏ đã đủ an toàn hay cần giới hạn thêm?
3. **[Chờ Panel điền QĐ-G...] Phương thức đồng bộ Tiêu đề 4 cung ở Chương 2, 3, 4 (Ràng buộc P5):**
   - Chọn Cách P5-A (Hậu xử lý thay dòng `### Cung ...` trong chuỗi Markdown bằng khung tiêu đề chuẩn từ Engine, đồng thời tự động nâng cấp luôn các bản cache đang lưu trong `sessionStorage`) hay Cách P5-B (Đổi cấu trúc lưu trữ/UI tách rời tiêu đề khỏi thân bài Markdown)?
4. **[Chờ Panel điền QĐ-G...] Phạm vi áp dụng các hạng mục Thẩm mỹ Mảng B (`B1`–`B6`):**
   - Triển khai trọn bộ cả 6 hướng `B1`–`B6` (Trang bìa `B1`, Lưới 12 cung `B2`, Bảng ma trận năm `B3`, Typography/In ấn `B4`, Bảng màu Giấy Cổ an toàn in đen trắng `B5`, Kết luận nhanh 5 dòng `B6`), hay lược bớt hạng mục nào để giữ bố cục gọn nhẹ?
