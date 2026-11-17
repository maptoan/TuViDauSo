> ⚠️ **[TÀI LIỆU LỊCH SỬ ĐÃ LƯU TRỮ — KHÔNG DÙNG LÀM CĂN CỨ CODE HIỆN HÀNH]**
> - **Trạng thái**: Đã hoàn thành vai trò lịch sử / Đã bị thay thế bởi tài liệu sống **[`docs/features-dossier-and-chat.md`](../features-dossier-and-chat.md)** từ ngày `17/11/2026`.
> - **Cảnh báo cho Kỹ sư & AI Agent**: Các trích dẫn số dòng, tên biến, hằng số (như ngân sách 25s, nhịp nghỉ 2200ms, số lượng key 3/23) trong file này phản ánh thời điểm trước khi hợp nhất và **không còn khớp với mã nguồn hiện hành**. Tuyệt đối đọc tài liệu sống tại thư mục `docs/` gốc và đối chiếu code thật trước khi chẩn đoán hoặc sửa code!

---
# KẾ HOẠCH KHẮC PHỤC 5 KHIẾM KHUYẾT VĂN BẢN/TRÌNH BÀY & NÂNG CẤP THẨM MỸ HỒ SƠ LUẬN GIẢI TOÀN DIỆN (V2 — BẢN CHỐT SAU PANEL PHẢN BIỆN)

- **Dự án:** Tử Vi Thiên Kỷ (Tử Vi Đẩu Số)
- **Tài liệu:** `docs/dossier-fix-plan-v2.md`
- **Bản kế hoạch gốc đối chiếu:** `docs/dossier-fix-plan-v1.md`
- **Biên bản phản biện của Panel:** `docs/dossier-fix-panel-review.md`
- **Ngày lập & cập nhật:** 17/11/2026
- **Model lập kế hoạch & phản biện:** Gemini 4 Argon (`models/gemini-4-argon`)
- **Trạng thái:** **Kế hoạch V2 — đã qua panel phản biện, chờ chủ dự án duyệt mới thi công**

---

## 0. NGUYÊN TẮC MINH BẠCH & TÓM TẮT CÁC THAY ĐỔI SO VỚI BẢN V1

### 0.1. Nguyên tắc minh bạch
1. **Về Panel chuyên gia:** Vòng phản biện tạo ra bản V2 này là **tổ chuyên gia MÔ PHỎNG đa vai (5 vai: Kiến trúc sư hệ thống, Chuyên gia Prompt/NLP, Chuyên gia Tử Vi, Chuyên gia Thiết kế in ấn, Kỹ sư kiểm chứng) vận hành trong MỘT phiên Gemini 4 Argon duy nhất**, không phải nhiều chuyên gia thật tách biệt.
2. **Về bằng chứng code thật:** Toàn bộ đường dẫn file, tên hàm và số dòng trong bản V2 đều dựa trên bằng chứng đọc code thật ở Bước 1; tuyệt đối không suy diễn vị trí code không tồn tại, không in khóa API nguyên văn.

### 0.2. Bảng tổng hợp 9 thay đổi cốt lõi của Kế hoạch V2 so với Bản nháp V1

| STT | Hạng mục | Nội dung trong Bản V1 | Nội dung đã hiệu chỉnh trong Bản V2 (sau Panel phản biện) |
| :-: | :--- | :--- | :--- |
| **1** | **Đính chính nhận định về Ma trận Ch.7/8 & `server.ts:356` (`P4, T1`)** | V1 mục 1.1 & 2.1a viết `server.ts:356` ép đủ 4 hóa và ma trận Ch.7/8 "đã làm đúng". | Đính chính theo bằng chứng Bước 1: `server.ts:356` chỉ là câu giới hạn nguồn trích dẫn; còn ma trận Ch.7/8 (`dossier-context.ts:733–765`) tuy ghi đủ 4 hóa nhưng **đang lược bỏ mất `periodPalaceRoleVi` (thiếu nhãn vai trò cung Lưu Niên)**. V2 sửa cả dữ kiện lẫn prompt của Ch.5, 6, 7, 8. |
| **2** | **Hạ mức khẳng định & Siết chặt biên regex tách từ dính chữ `đ` (`P1`)** | V1 mục 2.3a dùng regex rộng `/(?<=\p{L})(?=[đĐ]\p{L})/gu` và khẳng định giải quyết chung lỗi dính từ. | Hạ mức khẳng định: thừa nhận quy tắc âm vị chữ `đ` **chỉ bắt được các cặp dính mà âm tiết thứ hai bắt đầu bằng chữ `đ` thường (`U+0111`)** (như `"căngđộ"`, `"mứcđộ"`, `"tốcđộ"`, `"giaiđoạn"`), không bắt được từ dính tổng quát. Siết regex chỉ khớp chữ cái kết thúc âm tiết tiếng Việt + `đ` thường + nguyên âm tiếng Việt (an toàn 100%, 0 dương tính giả với từ tiếng Anh/Latin). |
| **3** | **Loại bỏ nguy cơ Dương tính giả khi sửa `"bảo Thủ"` & `"canh Thìn/Dần"` (`T3`)** | V1 mục 2.4c đề xuất quy tắc tổng quát hạ chữ hoa âm tiết thứ 2 và chuẩn hóa tự động `"canh <Địa Chi>"`. | **Bác bỏ regex tổng quát:** Chỉ thay thế theo danh sách từ lẻ cố định cực hẹp (`"kho lứa"` $\rightarrow$ `"kho lúa"`, `"bảo Thủ"` $\rightarrow$ `"bảo thủ"`). Cấm dùng regex sửa `"canh Thìn"` (vì `Canh Thìn`, `Canh Dần` là trụ Can Chi hợp lệ trong 60 Hoa Giáp); lỗi viết `"canh Thìn/Dần"` được sửa bằng quy tắc thuật ngữ trong Prompt (`server.ts:371–375`). |
| **4** | **Tự động làm sạch cả dữ liệu Cache cũ trong `sessionStorage` (`P2, T2`)** | V1 mục 2.3b chỉ gắn `sanitizeAiVietnameseOutput` ở luồng nhận SSE khi sinh mới. | Bọc thêm `sanitizeAiVietnameseOutput` + `enforceCanonicalPalaceGroupHeadings` ngay trong **`readDossierCacheEntry` (`dossier-chat-ui.ts:403`)** và các hàm xuất bản $\rightarrow$ các chương đã lưu sẵn trong `sessionStorage` có `"cácφ"`, `"căngđộ"` hoặc thiếu `[Đại hạn ...]` **tự động sạch ngay khi mở lên mà tốn 0 quota!** |
| **5** | **Chốt Cách P5-A cho tiêu đề 4 cung ở Chương 2, 3, 4 (`P5`)** | V1 mục 2.4b liệt kê cả Cách P5-A (hậu xử lý) và Cách P5-B (tách UI render). | **Chốt duy nhất Cách P5-A (`enforceCanonicalPalaceGroupHeadings`)** để bảo toàn 100% cấu trúc `DossierChapterState.text`, tương thích ngược hoàn toàn với `sessionStorage` (`ziwei_dossier_v1`), bộ xuất HTML/MD và ngữ cảnh Chat. |
| **6** | **Bổ sung bảng tọa độ CSS Grid 4×4 cho 12 Địa Chi ở Lưới 12 Cung (`B2, T4`)** | V1 mục 3 (B2) chưa ghi tọa độ dòng/cột của từng Địa Chi trên lưới 4×4. | Quy định cứng tọa độ `grid-row` / `grid-column` cho đủ 12 Địa Chi (`Tỵ=5` tại `(1,1)` đi thuận chiều kim đồng hồ quanh ô Thiên Bàn `(2..3, 2..3)`). |
| **7** | **Tích hợp Trang 1 (`B1 + B6 + B2`) để chống lãng phí giấy in (`B1, B2, B6, T4`)** | V1 mục 3 (B1) ngắt trang ngay sau khung tên đương số, tốn riêng 1 tờ A4. | Gộp **Khung Tiêu đề & Khai sinh đầy đủ (B1 + S5)** + **Khối Cốt Tủy 5 dòng xác định 100% (B6)** + **Lưới 12 Cung 4×4 (B2)** vào vừa khít **Trang 1 A4** ("Trang Đầu Mệnh Thư Tổng Lược"), từ Trang 2 mới bắt đầu Chương 1. |
| **8** | **Thu gọn Bảng Ma Trận Năm (`B3`) từ 8 cột xuống 5 cột & Tách khỏi `.MD` (`B3, T5`)** | V1 mục 3 (B3) thiết kế bảng 8 cột và áp dụng cho cả `.MD`. | Thu gọn bảng HTML/In xuống **5 cột cân đối (`12% | 18% | 16% | 34% | 20%`)**, cỡ chữ `9pt` khi in để không tràn khổ A4 dọc; bỏ bảng B3 khỏi `.MD` để tránh tràn dòng văn bản thuần. |
| **9** | **An toàn in đen trắng (`@media print`) cho đường kẻ & ký hiệu Tứ Hóa (`B4, B5`)** | V1 mục 3 dùng đường kẻ `#a8a29e` (quá nhạt khi in) và phân biệt Cát/Hung bằng màu vàng/đỏ. | Trong `@media print`, ép đường kẻ bảng/lưới về `#44403c` (`1pt solid`), chữ đen `#000000` trên nền trắng `#ffffff`, và bắt buộc kèm ký hiệu văn bản `[Lộc]`, `[Quyền]`, `[Khoa]`, `[Kỵ]` + kiểu đường viền (`solid` vs `dashed`) để đọc rõ 100% trên bản in đen trắng / photocopy. |

---

## 1. BỐI CẢNH KIỂM CHỨNG & BẰNG CHỨNG CODE THẬT ĐÃ XÁC NHẬN (BƯỚC 1)

### 1.1. Hiện trạng từ hồ sơ kiểm chứng độc lập (Nguyễn Văn An — sinh 16/08/1995)
- **Tầng toán học & an sao của Engine chính xác tuyệt đối:** 14/14 chính tinh, 100% Tứ Hóa mọi tầng (Bản Mệnh, Đại Hạn, Lưu Niên, Tự Hóa), ~35 phụ tinh khớp hoàn toàn.
- **5 khiếm khuyết cần khắc phục (`S1`–`S5`) đều thuộc tầng chuỗi dữ kiện ngữ cảnh, prompt, hậu xử lý văn bản và template xuất bản:**
  1. **`(S1)` Chương Lưu Niên năm hiện tại (Chương 5 — `year_2026`)** khi kể điểm cát đã bỏ sót **Lưu Hóa Lộc** và **Lưu Hóa Khoa** (chỉ nhắc Hóa Quyền + Hóa Kỵ), trong khi bảng dữ kiện ma trận năm ở Chương 7 (`horizon_5y`) có ghi đủ 4 hóa.
  2. **`(S2)` Chương Lưu Niên năm sau (Chương 6 — `year_2027`)** lẫn nhãn tầng trong văn xuôi: viết *"tam hợp Tài Bạch (trùng Mệnh Cung)"* — cung Mão năm đó đóng vai **Lưu Tài Bạch**, không phải Tài Bạch gốc của Bản Mệnh (ở Hợi). *(Lưu ý: ngay cả ma trận năm ở Chương 7/8 hiện cũng mới ghi tên cung Bản Mệnh mà thiếu nhãn vai trò cung Lưu Niên).*
  3. **`(S3)` Hai lỗi chuỗi lọt vào văn bản cache:** **`"cácφ"`** (dính ký tự Hy Lạp phi `φ` — `U+03C6`) và **`"căngđộ"`** (hai âm tiết tiếng Việt dính liền mất dấu cách).
  4. **`(S4)` Lỗi chữ lẻ & không đồng nhất tiêu đề:** `"kho lứa"` thay vì `"kho lúa"`, `"bảo Thủ"` thừa chữ hoa; Chương 4 dùng `"canh Thìn/Dần..."` lệch chuẩn thuật ngữ; tiêu đề mục cung ở Chương 4 (`palaces_social_health`) thiếu ngoặc **`[Đại hạn X–Y tuổi]`** mà Chương 2 và Chương 3 đều có.
  5. **`(S5)` Header bản xuất hồ sơ (`.HTML`, `.MD`, Sao chép/In)** chỉ có ngày sinh Dương lịch/Âm lịch, **thiếu giờ sinh** (giờ đồng hồ gốc & Địa Chi giờ) và **thiếu giờ Mặt Trời thật (Chân Thái Dương Thời)** đã áp hiệu chỉnh.

### 1.2. Bảng bằng chứng vị trí code thật (đã xác nhận ở Bước 1)

| Thành phần | File | Tên hàm / Biến | Số dòng | Bằng chứng xác nhận từ code thật |
| :--- | :--- | :--- | :--- | :--- |
| **Prompt Lưu Niên / Đại Hạn** | `server.ts` | `buildStrictPeriodAiPrompt` (route `POST /api/interpret-period`) | `152–202` (`623–713`) | Quy tắc 1–2 (`dòng 161–163`) cấm bịa sao/Tứ Hóa; Quy tắc 3 (`dòng 164–166`) nhắc phân biệt cung kỳ hạn và cung bản mệnh nhưng chưa cấm viết tắt `"tam hợp Tài Bạch"`; chưa ép phân tích đủ 4 sao Lưu Tứ Hóa; chưa có quy tắc tiền tố 4 tầng `[Tứ Hóa ...]`; không có hậu kiểm tại `dòng 660–685`. |
| **Prompt Hồ Sơ 8 Chương** | `server.ts` | `buildStrictDossierSectionPrompt` (route `POST /api/interpret-dossier-section`) | `335–388` (`716–804`) | Dòng `350` viết cứng mẫu tiêu đề là ``### Cung <Tên Cung> (<Can Chi>)`` (thiếu `[Đại hạn X–Y tuổi]`). Dòng `355–357` giới hạn nguồn trích dẫn cho `horizon_5y`/`10y`. Dòng `372` quy định tiền tố 4 tầng Tứ Hóa. Không có hậu kiểm tại `dòng 750–776`. |
| **Ngữ cảnh Kỳ hạn (Lưu Niên / Đại Hạn)** | `src/lib/ziwei/yunxian-context.ts` | `buildYunxianPeriodContext`, `getPeriodPalaceRoleVi`, `YunxianSiHuaTarget` | `30–42`, `278–671` (`360–364`) | `getPeriodPalaceRoleVi` tính được vai trò Lưu, nhưng `factTableMarkdown` (`dòng 544–609`) khuyết ở 3 chỗ: (1) Mục Tam Phương Tứ Chính (`dòng 502–507, 595–607`) chỉ in 4 cung, thiếu 8 cung Lưu còn lại và viết nhãn `Tam hợp Tài Bạch (Lưu Tài Bạch)` dễ làm AI cắt mất chữ Lưu; (2) Mục Tứ Hóa Kỳ Hạn (`dòng 560–565`) thiếu vai trò Lưu cho đối cung xung chiếu; (3) Mục Sao Lưu (`dòng 568–587`) không in `d.periodPalaceRoleVi`. |
| **Ngữ cảnh Hồ Sơ & Ma trận 5/10 năm** | `src/lib/ziwei/dossier-context.ts` | `buildNatalOverviewFactSheetVi`, `buildPalaceGroupFactSheetVi`, `buildMultiYearHorizonContext`, `mapSiHuaEntry` | `275–338`, `492–523`, `547–558`, `622–935` (`733–765`) | - `buildPalaceGroupFactSheetVi` (`dòng 506–514`) đã tạo tiêu đề chuẩn `### Cung ${natalPalaceNameVi} (${ganZhiVi}) ${badges}`.<br>- `mapSiHuaEntry` (`dòng 733–765`) lược bỏ `periodPalaceRoleVi`, khiến `compactMatrixMarkdown` (`dòng 876–880`) và mục `(6) Bộ Lưu Tứ Hóa` (`dòng 911–918`) thiếu vai trò cung Lưu Niên. |
| **Builder Xuất bản & Cache `sessionStorage`** | `src/lib/dossier-chat-ui.ts` | `readDossierCacheEntry`, `writeDossierCacheEntry`, `buildDossierHeaderMetadata`, `buildDossierMarkdownExport`, `buildDossierPlainTextExport`, `buildDossierStandaloneHtmlExport` | `403–463`, `759–1050` | `buildDossierHeaderMetadata` (`dòng 759–778`) chỉ trả về `{ name, solar, lunar, yinYang, ju, mingBranch, mingMajors }` — thiếu giờ sinh, thiếu giờ Mặt Trời thật, thiếu nơi sinh. |
| **Dữ kiện Giờ sinh & Chân Thái Dương Thời** | `src/lib/ziwei/types.ts` & `src/lib/ziwei/true-solar-time.ts` | `BirthInfo`, `ZiweiChart`, `toTrueSolarTime` | `types.ts:15–38, 115–135`; `true-solar-time.ts:59–99` | `chart.birthInfo.hour` (`0..11`), `chart.birthInfo.origInput` (`{ year, month, day, clockHour, clockMinute }`), `province`, `city`, `longitude` đã có sẵn. `toTrueSolarTime` tính được ngay giờ Mặt Trời thật `HH:MM` và `totalDiffMinutes`. |
| **Luồng SSE & Ghi Cache 2 chiều** | `server.ts`, `src/App.tsx`, `src/components/DetailedDossierModal.tsx`, `src/components/InsightPanel.tsx`, `src/components/ContextualChatDrawer.tsx` | `sendSseText`; `aiPeriodCache`; `executeSingleChapterStream`, `printSheetPortal`; `requestPeriodAiInterpretation`, `fetchInsight` | `server.ts:123–125`; `App.tsx:66`; `Modal:416–570, 755–843`; `Insight:215–293, 360–425`; `Chat:325, 360` | Chưa có bộ lọc ký tự lạ hay hậu kiểm Tứ Hóa trước khi ghi vào `aiPeriodCache`, `localChapters`, `sessionStorage`. |

---

## 2. KẾ HOẠCH KỸ THUẬT CHI TIẾT CHO 5 ĐIỂM S1–S5 (BẢN CHỐT V2)

### 2.1. Khắc phục (S1): Đảm bảo Chương Lưu Niên / Đại Hạn luôn có đủ 4 sao Tứ Hóa Kỳ Hạn
> **[Tuân thủ P3, P7, P8, QĐ-G1]**

1. **Tầng Prompt (`server.ts` — hàm `buildStrictPeriodAiPrompt`, dòng `152–202`):**
   - Bổ sung vào danh sách Quy tắc bắt buộc (`dòng 161–186`):
     - **Quy tắc điểm danh đủ 4 Tứ Hóa Kỳ Hạn:** Trong mục `### 2. Tổ Hợp Sao Kích Hoạt & Tứ Hóa Kỳ Hạn`, AI **BẮT BUỘC phải phân tích đủ cả 4 sao Tứ Hóa của kỳ hạn (`Hóa Lộc`, `Hóa Quyền`, `Hóa Khoa`, `Hóa Kỵ`)** theo đúng bảng dữ kiện: nêu rõ từng sao đóng tại cung kỳ hạn nào (`Lưu ...` / `Đại hạn ...`), trùng cung Bản Mệnh gốc nào, và xung chiếu cung nào; **tuyệt đối không được bỏ sót bất kỳ hóa nào trong 4 hóa**.
     - **Quy tắc giữ tiền tố 4 tầng Tứ Hóa:** Đồng bộ quy tắc từ `server.ts:372` sang `buildStrictPeriodAiPrompt` (`[Tứ Hóa Bản Mệnh]`, `[Tứ Hóa Đại Hạn]`, `[Tứ Hóa Lưu Niên ...]`, `[Tự Hóa Can Cung ...]`).
   - Đồng thời tại `buildStrictDossierSectionPrompt` (`server.ts:355–362` cho `horizon_5y` / `horizon_10y`), bổ sung câu yêu cầu khi tổng hợp điểm cát/hung các năm trọng điểm phải xét đủ cả 4 sao Lưu Tứ Hóa (`Lộc, Quyền, Khoa, Kỵ`).

2. **Tầng Hậu kiểm xác định (`src/lib/ziwei/text-sanitizer.ts` — hàm `verifyAndEnsureCompletePeriodSiHua`):**
   - Chữ ký hàm:
     ```ts
     export interface PeriodSiHuaCheckResult {
       isComplete: boolean;
       missingEntries: YunxianSiHuaTarget[];
       patchedText: string;
     }
     export function verifyAndEnsureCompletePeriodSiHua(
       text: string,
       periodContext: YunxianPeriodContext
     ): PeriodSiHuaCheckResult;
     ```
   - **Thuật toán kiểm tra xác định (0 tốn quota):**
     - Duyệt qua 4 phần tử `sh` (`Hóa Lộc`, `Hóa Quyền`, `Hóa Khoa`, `Hóa Kỵ`) trong `periodContext.periodSiHua` (`yunxian-context.ts:440–454`).
     - Với mỗi `sh`, kiểm tra xem văn bản `text` (sau khi chuẩn hóa NFC, không phân biệt hoa/thường) có chứa tên sao `sh.starNameVi` **VÀ** có nhắc đến loại hóa `sh.mutagenVi` (hoặc dạng rút gọn `"Lộc"`, `"Quyền"`, `"Khoa"`, `"Kỵ"` trong bán kính 120 ký tự quanh tên sao đó) hay không.
     - Nếu thiếu ít nhất 1 phần tử (`missingEntries.length > 0`), tự động dựng khối dữ kiện xác định chuẩn mực:
       ```markdown
       > 📌 **[Tổng Hợp Đầy Đủ Tứ Hóa Kỳ Hạn (Can <periodStemVi>) Theo Lá Số]**
       > Để đảm bảo hồ sơ lưu trữ đầy đủ 4/4 sao Tứ Hóa của kỳ hạn, hệ thống ghi nhận chi tiết các sao Tứ Hóa kỳ hạn sau từ bảng dữ kiện gốc:
       > - **[Tứ Hóa <Kỳ Hạn> — <sh.mutagenVi>]**: Sao **<sh.starNameVi>** [<sh.brightnessVi>] tọa thủ tại **<sh.periodPalaceRoleVi>** *(trùng Bản Mệnh: <sh.natalPalaceNameVi> - <sh.natalPalaceGanZhiVi>)*, xung chiếu **<sh.oppositePeriodPalaceRoleVi>** *(trùng Bản Mệnh: <sh.oppositePalaceNameVi> - <sh.oppositePalaceGanZhiVi>)*.
       ```
     - Chèn khối này vào ngay cuối mục `### 2.` (hoặc trước mục `### 3.` / cuối bài nếu không tìm thấy mốc mục 3) để tạo ra `patchedText`.
   - **Điểm kích hoạt:** Gọi ngay tại điểm chốt kết thúc luồng SSE của kỳ hạn trong `DetailedDossierModal.tsx` (dòng `481`, khi `chapter.periodYear !== null`) và trong `InsightPanel.tsx` (dòng `268`, cuối `requestPeriodAiInterpretation`) trước khi lưu vào `aiPeriodCache`.

---

### 2.2. Khắc phục (S2): Bổ sung nhãn vai trò Lưu Niên tiền-tính vào Bảng Dữ Kiện Kỳ Hạn & Ma Trận Năm
> **[Tuân thủ P4, P7, QĐ-G3]**

1. **Tầng Dữ kiện Kỳ hạn (`src/lib/ziwei/yunxian-context.ts` — hàm `buildYunxianPeriodContext`, dòng `278–671`):**
   - **Mở rộng interface `YunxianSiHuaTarget` (`dòng 30–42`):**
     - Thêm trường `oppositePeriodPalaceRoleVi: string;` và tính giá trị tại `dòng 451`: `oppositePeriodPalaceRoleVi: getPeriodPalaceRoleVi(oppositeBranch)`.
   - **Sửa Chỗ khuyết 1 — Bổ sung Bảng Ánh Xạ Đầy Đủ 12 Cung Kỳ Hạn ↔ 12 Cung Bản Mệnh Gốc (`factTableMarkdown`, dòng `595–608`):**
     - Sửa nhãn của 4 cung Tam Phương Tứ Chính (`dòng 502–507`) thành nhãn tường minh luôn bắt đầu bằng chữ `Cung Lưu ...` / `Cung Đại Hạn ...`:
       - `Cung Lưu Mệnh (Bản cung Lưu Niên)` / `Cung Đại Hạn Mệnh (Bản cung Đại Hạn)`
       - `Cung Lưu Thiên Di (Đối cung xung chiếu Lưu Mệnh)`
       - `Cung Lưu Tài Bạch (Tam hợp của Lưu Mệnh)`
       - `Cung Lưu Quan Lộc (Tam hợp của Lưu Mệnh)`
     - Ngay dưới mục Tam Phương Tứ Chính, in thêm mục **`[Bảng Ánh Xạ Đầy Đủ 12 Cung Kỳ Hạn ↔ 12 Cung Bản Mệnh Gốc (Tra Cứu Bắt Buộc)]`** liệt kê đủ 12 cung theo thứ tự 12 chức năng kỳ hạn (`Lưu Mệnh`, `Lưu Phụ Mẫu`, `Lưu Phúc Đức`, `Lưu Điền Trạch`, `Lưu Quan Lộc`, `Lưu Giao Hữu`, `Lưu Thiên Di`, `Lưu Tật Ách`, `Lưu Tài Bạch`, `Lưu Tử Nữ`, `Lưu Phu Thê`, `Lưu Huynh Đệ`), mỗi dòng ghi rõ:
       `• **Cung ${periodRoleVi}** đóng tại **${ganZhiVi}** → trùng cung Bản Mệnh gốc: **${natalPalaceNameVi}** (Chính tinh: ${majorStarsSummary})`.
   - **Sửa Chỗ khuyết 2 — In vai trò cung Lưu Niên cho đối cung xung chiếu của Tứ Hóa Kỳ Hạn (`dòng 560–565`):**
     ```ts
     factLines.push(
       `• **${sh.mutagenVi}**: Sao **${sh.starNameVi}** [${sh.brightnessVi}] tọa thủ tại **Cung ${sh.periodPalaceRoleVi}** *(trùng Bản Mệnh gốc: ${sh.natalPalaceNameVi} - ${sh.natalPalaceGanZhiVi})* — đối cung xung chiếu: **Cung ${sh.oppositePeriodPalaceRoleVi}** *(trùng Bản Mệnh gốc: ${sh.oppositePalaceNameVi} - ${sh.oppositePalaceGanZhiVi})*.`
     );
     ```
   - **Sửa Chỗ khuyết 3 — In vai trò cung Lưu Niên cho toàn bộ các Sao Lưu (`dòng 568–587`):**
     - Sửa các biểu thức format Sao Lưu để luôn in kèm `*(vai trò: Cung ${d.periodPalaceRoleVi}, trùng Bản Mệnh ${d.natalPalaceNameVi} - ${d.branchVi})*`.

2. **Tầng Dữ kiện Ma trận 5 năm / 10 năm (`src/lib/ziwei/dossier-context.ts` — hàm `buildMultiYearHorizonContext`, dòng `547–558`, `733–765`, `876–880`, `911–918`):**
   - Bổ sung `periodPalaceRoleVi: string` và `oppositePeriodPalaceRoleVi: string` vào interface `MultiYearSiHuaEntry` (`dòng 547–558`) và truyền từ `periodCtx.periodSiHua` sang trong hàm `mapSiHuaEntry` (`dòng 733–765`).
   - Trong `compactMatrixMarkdown` (`dòng 876–880`):
     ```ts
     `${s.mutagenVi}: ${s.starNameVi} tại ${s.periodPalaceRoleVi} [trùng ${s.natalPalaceNameVi}] (xung ${s.oppositePeriodPalaceRoleVi} [trùng ${s.oppositePalaceNameVi}])`
     ```
   - Trong mục `(6) Bộ Lưu Tứ Hóa` của `factSheetMarkdown` (`dòng 911–918`):
     ```ts
     `**${s.starNameVi} [${s.brightnessVi}] ${s.mutagenVi}** tại **Cung ${s.periodPalaceRoleVi}** [trùng bản mệnh **${s.natalPalaceNameVi} (${s.natalPalaceGanZhiVi})**] (xung **Cung ${s.oppositePeriodPalaceRoleVi}** [trùng ${s.oppositePalaceNameVi}])${s.natalMutagenVi ? ` [${s.natalMutagenVi}]` : ''}`
     ```

3. **Tầng Prompt (`server.ts` — `buildStrictPeriodAiPrompt`, dòng `164–166`):**
   - Cập nhật Quy tắc 3:
     `3. KỶ LUẬT GỌI TÊN TẦNG CUNG VỊ: Khi gọi tên bất kỳ cung nào theo chức năng của kỳ hạn (đặc biệt là 2 cung tam hợp Tài Bạch, Quan Lộc và đối cung Thiên Di của kỳ hạn), BẮT BUỘC phải viết rõ tiền tố "Cung Lưu <Tên Cung>" (ví dụ: "Cung Lưu Tài Bạch (đóng nhờ trên Mệnh Cung gốc tại Mão)"). TUYỆT ĐỐI CẤM lược bỏ chữ "Lưu" thành "tam hợp Tài Bạch (trùng Mệnh Cung)" vì sẽ gây nhầm lẫn nghiêm trọng với cung Tài Bạch gốc của Bản Mệnh.`

---

### 2.3. Khắc phục (S3) & Phần lỗi chữ lẻ của (S4): Bộ lọc Ký tự Ngoại lai & Chuẩn hóa Dính từ / Chính tả An toàn
> **[Tuân thủ P1, P2, P7, P8, T2, T3, QĐ-G2]**

1. **Thiết kế module dùng chung `src/lib/ziwei/text-sanitizer.ts`:**
   - **Lớp 3A — Hàm `stripInvalidForeignScripts(text: string, allowHanzi = false): string`:**
     - **Nguyên tắc P1:** Cấm xóa mù quáng ký tự ngoài ASCII. Chỉ loại bỏ các ký tự thuộc danh sách hệ chữ (Unicode Script) **không bao giờ hợp lệ** trong văn bản luận giải tiếng Việt:
       - Hệ chữ ngoại lai cố định: `/[\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Thai}\p{Script=Devanagari}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\uFFFD\u200B-\u200D\uFEFF]/gu` $\rightarrow$ xóa bỏ (`"cácφ"` $\rightarrow$ `"các"`).
       - Hệ chữ Hán (`\p{Script=Han}`): chỉ lọc bỏ khi `allowHanzi === false` (mặc định `false` cho văn bản luận giải tiếng Việt; truyền `allowHanzi: true` nếu ở chế độ cho phép Hán tự). Nếu sau khi xóa Hán tự còn lại cặp ngoặc rỗng `(\s*)` hoặc `\[\s*\]` thì dọn sạch.
       - **Bảo toàn 100%:** Mọi chữ cái Latin/tiếng Việt có dấu, chữ số, dấu câu chuẩn và các ký hiệu chuyên dụng `↔`, `→`, `←`, `•`, `–`, `—`, `…`, `%`, `±`, `×`, `°`, `📌`, `⚠️`.
   - **Lớp 3B — Hàm `normalizeVietnameseMergedWordsAndTypos(text: string): string`:**
     - **Quy tắc âm vị học hẹp cho chữ `đ` thường (`U+0111`):**
       - *Ghi chú phạm vi (đã điều chỉnh theo phản biện P1):* Quy tắc này chỉ xử lý các lỗi dính từ mà âm tiết thứ hai bắt đầu bằng chữ `đ` thường tiếng Việt (`U+0111`) đi kèm nguyên âm tiếng Việt (như `"căngđộ"`, `"mứcđộ"`, `"tốcđộ"`, `"chếđộ"`, `"biếnđộng"`, `"giaiđoạn"`). Các lỗi dính từ tổng quát không bắt đầu bằng `đ` không thể tách tự động bằng regex mà không có nguy cơ cắt nhầm từ mượn/tên riêng, nên được giảm thiểu qua Prompt + từ điển cặp dính cụ thể.
       - Regex chính xác:
         ```ts
         const VIET_SYLLABLE_END_BEFORE_D_RE =
           /(?<=[aăâeêioôơuưyáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵptcmnhg])(?=đ[aăâeêioôơuưyáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ])/gu;
         ```
         Thay bằng `' '` (một dấu cách): `"căngđộ"` $\rightarrow$ `"căng độ"`.
     - **Danh sách từ điển cố định cực hẹp cho lỗi chữ lẻ đã xác nhận (`T3` — 0 dương tính giả):**
       - `/\bkho\s+lứa\b/gu` $\rightarrow$ `"kho lúa"`, `/\bKho\s+lứa\b/gu` $\rightarrow$ `"Kho lúa"`.
       - `/\bbảo\s+Thủ\b/gu` $\rightarrow$ `"bảo thủ"`.
       - *(Tuyệt đối không dùng regex hạ chữ hoa tổng quát và không dùng regex tự động sửa `"canh Thìn"`).*
   - **Hàm hợp nhất `sanitizeAiVietnameseOutput(rawText: string, options?: { allowHanzi?: boolean }): string`:**
     - Chạy tuần tự `stripInvalidForeignScripts` $\rightarrow$ `normalizeVietnameseMergedWordsAndTypos` $\rightarrow$ thu gọn khoảng trắng ngang bị đúp (`/[ \t]{2,}/g` trên các dòng không phải code/table).

2. **Điểm chặn trong Pipeline (Tuân thủ P2 & T2 — Đồng bộ 100% mọi Cache & Tự làm sạch Cache cũ):**
   - **Tại Server (`server.ts:123–125` — hàm `sendSseText`):**
     - Áp dụng `stripInvalidForeignScripts(text, false)` (Lớp 3A — cấp độ từng ký tự đơn lẻ, không bị ảnh hưởng bởi biên cắt chunk SSE) ngay trước khi `res.write(...)`.
   - **Tại Client — Điểm chốt chuỗi tích lũy `accumulated` TRƯỚC KHI ghi vào bất kỳ cache nào (`aiPeriodCache`, `localChapters`, `sessionStorage`, `InsightPanel.cache`):**
     1. **`src/components/DetailedDossierModal.tsx`** (`executeSingleChapterStream`):
        - Dòng `435` (trong `processLine`): `accumulated = sanitizeAiVietnameseOutput(accumulated + deltaText);`
        - Dòng `481` (ngay khi vòng lặp `while (!doneSignal)` kết thúc đọc SSE, trước cả nhánh `if (wasInterrupted || streamError)` ở dòng `482` và nhánh `completedState` ở dòng `538`):
          - Gọi `accumulated = sanitizeAiVietnameseOutput(accumulated);`
          - Nếu là chương nhóm cung (`palaces_core`, `palaces_family`, `palaces_social_health`), gọi tiếp `accumulated = enforceCanonicalPalaceGroupHeadings(accumulated, chart, chapter.sectionId);`
          - Nếu là chương Lưu Niên (`year_2026`, `year_2027`) và luồng hoàn tất (`!wasInterrupted && !streamError`), gọi tiếp `verifyAndEnsureCompletePeriodSiHua(accumulated, periodContext).patchedText`.
     2. **`src/components/InsightPanel.tsx`**:
        - Trong `requestPeriodAiInterpretation` (dòng `235` & điểm chốt dòng `268` sau `while (!doneSignal)`): chạy `sanitizeAiVietnameseOutput` + `verifyAndEnsureCompletePeriodSiHua` trước khi chốt `setAiPeriodCache`.
        - Trong `fetchInsight` (dòng `395` & điểm chốt dòng `407`): chạy `sanitizeAiVietnameseOutput` trước khi gọi `setCache`.
     3. **`src/components/ContextualChatDrawer.tsx`** (dòng `325` & `360`): chạy `sanitizeAiVietnameseOutput` trên câu trả lời của trợ lý trước khi gọi `persistThread`.
   - **Tự động làm sạch Cache cũ đã lưu trong `sessionStorage` (`src/lib/dossier-chat-ui.ts:403` — hàm `readDossierCacheEntry`):**
     - Khi đọc các chương từ `sessionStorage` (`ziwei_dossier_v1::...`), chạy `sanitizeAiVietnameseOutput` trên `sec.text` (và `enforceCanonicalPalaceGroupHeadings` khi khởi tạo/đọc chương nhóm cung trong `DetailedDossierModal.tsx:160` và trong các hàm xuất bản `.HTML`/`.MD`), giúp **mọi văn bản cũ đã lưu trong trình duyệt tự động sạch `"cácφ"`, `"căngđộ"`, `"kho lứa"`, `"bảo Thủ"` ngay lập tức với 0 lượt gọi AI**.

---

### 2.4. Khắc phục phần còn lại của (S4): Đồng bộ Tiêu đề 4 Cung ở Chương 2, 3, 4 & Chuẩn hóa Thuật ngữ Can Chi
> **[Tuân thủ P5, P7, T3, QĐ-G4]**

1. **Tầng Hậu xử lý Chuẩn hóa Tiêu đề 4 Cung — Cách P5-A (`src/lib/ziwei/text-sanitizer.ts` — hàm `enforceCanonicalPalaceGroupHeadings`):**
   - Với 3 chương `palaces_core`, `palaces_family`, `palaces_social_health`, lấy danh sách 4 cung thuộc nhóm từ `chart.palaces` (theo đúng ánh xạ tại `dossier-context.ts:461–476`).
   - Với mỗi cung `p` trong 4 cung, dựng dòng tiêu đề chuẩn mực xác định 100% (giống hệt `dossier-context.ts:506–514`):
     ```ts
     const badges = [
       p.isMingGong ? '[AN MỆNH]' : '',
       p.isShenGong ? '[AN THÂN]' : '',
       daXianAgeRangeVi ? `[Đại hạn ${daXianAgeRangeVi}]` : '',
     ].filter(Boolean).join(' ');
     const canonicalHeading = `### Cung ${palaceNameVi} (${ganZhiVi})${badges ? ` ${badges}` : ''}`;
     ```
   - Quét trong `markdownText` các dòng tiêu đề Markdown cấp 2–4 khớp tên cung đó (`^#{2,4}\s*(?:\d+[\.\)]\s*)?(?:Cung\s+)?${escapedPalaceName}\b[^\n]*$` với cờ `imu`) và thay thế dòng tiêu đề đó bằng `canonicalHeading`.
   - **Hệ quả đối với Cache hiện có:**
     - Không làm thay đổi kiểu dữ liệu `DossierChapterState.text: string`, không phá vỡ `sessionStorage` (`ziwei_dossier_v1`) hay `aiPeriodCache`.
     - Khi kết hợp gọi ở `DetailedDossierModal.tsx` lúc đọc dữ liệu từ `sessionStorage` và trong builder xuất bản (`dossier-chat-ui.ts`), **Chương 4 đã lưu sẵn trong cache sẽ lập tức có đủ `[Đại hạn X–Y tuổi]` giống hệt Chương 2 và Chương 3 mà không cần sinh lại**.

2. **Tầng Prompt (`server.ts` — hàm `buildStrictDossierSectionPrompt`, dòng `350` & `371–375`):**
   - **Sửa dòng `350`:** Đổi mẫu tiêu đề từ ``### Cung <Tên Cung> (<Can Chi>)`` thành:
     ``- Phải giữ NGUYÊN VẸN từng chữ dòng tiêu đề Markdown của cả 4 cung đúng như trong Bảng dữ kiện: `### Cung <Tên Cung> (<Can Chi>) [AN MỆNH/AN THÂN nếu có] [Đại hạn X–Y tuổi]` cho cả 4 cung: ${(sectionCtx.palaceNamesVi ?? []).join(', ')}. Tuyệt đối KHÔNG được cắt bỏ cụm `[Đại hạn X–Y tuổi]`.``
   - **Bổ sung vào Quy tắc 4 (`dòng 373–375`):**
     `- Kỷ luật chính tả & thuật ngữ Can Chi: Viết đúng khoảng cách từ tiếng Việt (tuyệt đối không viết dính chữ như "căngđộ", viết đúng "kho lúa", không viết hoa giữa từ ghép thông thường như "bảo Thủ"). Khi nhắc đến Thiên Can hoặc Địa Chi của cung, phải gọi rõ "Thiên Can <Can>" (Giáp, Ất, Bính, Đinh, Mậu, Kỷ, Canh, Tân, Nhâm, Quý) hoặc "cung <Tên Cung> (<Can Chi đầy đủ>)"; TUYỆT ĐỐI CẤM viết lập lờ "canh Thìn", "canh Dần" hay gọi Địa Chi (Tý, Sửu, Dần, Mão, Thìn...) là "can".`

---

### 2.5. Khắc phục (S5): Bổ sung Giờ Sinh Đồng Hồ & Giờ Mặt Trời Thật (Chân Thái Dương Thời) vào Header Xuất Bản
> **[Tuân thủ P6, P7, QĐ-G5]**

1. **Mở rộng hàm `buildDossierHeaderMetadata(chart: ZiweiChart)` (`src/lib/dossier-chat-ui.ts`, dòng `759–778`):**
   - Export interface `DossierHeaderMetadata` và hàm `buildDossierHeaderMetadata(chart: ZiweiChart)` để dùng chung cho cả `dossier-chat-ui.ts` và `DetailedDossierModal.tsx`.
   - Trích xuất từ `const b = chart.birthInfo`:
     - `hourBranchNameVi`: `VI_BRANCHES[b.hour] ?? ''` (`Tý`..`Hợi`).
     - `locationVi`: ghép `[b.city, b.province].filter(Boolean).join(', ')` (nếu có `b.longitude`, kèm `(${b.longitude.toFixed(2)}°Đ)`), mặc định `'Việt Nam (Kinh tuyến chuẩn 105°Đ)'` nếu trống.
     - **Kiểm tra `b.origInput` (`types.ts:31–37`):**
       - **Trường hợp 1 — Người dùng có nhập giờ sinh (`b.origInput` tồn tại):**
         - `clockTimeVi`: `${String(b.origInput.clockHour).padStart(2, '0')}:${String(b.origInput.clockMinute).padStart(2, '0')}`.
         - Gọi hàm thuần `toTrueSolarTime(b.origInput.year, b.origInput.month, b.origInput.day, b.origInput.clockHour, b.origInput.clockMinute, b.longitude ?? 105.0)` (`src/lib/ziwei/true-solar-time.ts:59–99`).
         - `trueSolarTimeHHMM`: `${String(tst.hour).padStart(2, '0')}:${String(tst.minute).padStart(2, '0')}`.
         - `diffSign`: `tst.totalDiffMinutes >= 0 ? `+${tst.totalDiffMinutes}` : `${tst.totalDiffMinutes}``.
         - `trueSolarTimeVi`: `${trueSolarTimeHHMM} (Giờ ${hourBranchNameVi}, hiệu chỉnh ${diffSign} phút)`.
         - `birthTimeFullSummaryVi`: `Giờ đồng hồ: ${clockTimeVi} → Giờ Mặt Trời thật: ${trueSolarTimeHHMM} (Giờ ${hourBranchNameVi}, hiệu chỉnh ${diffSign} phút theo kinh độ ${(b.longitude ?? 105).toFixed(2)}°Đ)`.
       - **Trường hợp 2 — Người dùng chọn "Không rõ giờ sinh" (`!b.origInput`):**
         - `clockTimeVi`: `'Chưa rõ giờ đồng hồ'`.
         - `trueSolarTimeVi`: `Giờ ${hourBranchNameVi} (mặc định khi chưa rõ giờ sinh)`.
         - `birthTimeFullSummaryVi`: `Chưa rõ giờ đồng hồ gốc (lập lá số mặc định theo Giờ ${hourBranchNameVi})`.

2. **Áp dụng đồng nhất trên cả 4 kênh hiển thị/xuất bản (P6):**
   - **Kênh 1 — File `.MD` (`buildDossierMarkdownExport`, `dossier-chat-ui.ts:787–803`):**
     - Thêm 2 dòng ngay dưới dòng Âm lịch:
       - `- **Giờ sinh & Chân Thái Dương Thời:** ${meta.birthTimeFullSummaryVi}`
       - `- **Nơi sinh / Kinh độ:** ${meta.locationVi}`
   - **Kênh 2 — Sao chép văn bản thuần (`buildDossierPlainTextExport`, `dossier-chat-ui.ts:847–855`):**
     - Tự động kế thừa đầy đủ từ `buildDossierMarkdownExport`.
   - **Kênh 3 — File `.HTML` độc lập (`buildDossierStandaloneHtmlExport`, `dossier-chat-ui.ts:1007–1021`):**
     - Hiển thị đầy đủ các ô `Giờ sinh (Đồng hồ gốc)`, `Giờ Mặt Trời thật (Chân Thái Dương)` và `Nơi sinh & Kinh độ` trong khung thông tin khai sinh Trang 1.
   - **Kênh 4 — Bản In trực tiếp (`printSheetPortal`, `DetailedDossierModal.tsx:763–769`) & Header của Modal (`dòng 836–841`):**
     - Gọi `buildDossierHeaderMetadata(chart)` để hiển thị đồng bộ `meta.birthTimeFullSummaryVi` và `meta.locationVi`.
   - Đồng thời bổ sung `birthTimeFullSummaryVi` vào dòng đầu của `buildNatalOverviewFactSheetVi` (`src/lib/ziwei/dossier-context.ts:281–285`).

---

## 3. MẢNG B — NÂNG CẤP THẨM MỸ HỒ SƠ XUẤT BẢN THEME "GIẤY CỔ" (BẢN CHỐT V2)
> **[Chi phí Quota AI = 0 tuyệt đối; Tuân thủ an toàn in đen trắng `@media print` & ranh giới định dạng `.MD`]**

### 3.1. Ma trận phạm vi áp dụng của 6 hạng mục `B1`–`B6`

| Mã | Tên hạng mục | `.HTML` độc lập | Bản In trực tiếp (`printSheetPortal`) | Giao diện Modal UI | File `.MD` / `PlainText` | Chi phí Quota AI |
| :-: | :--- | :-: | :-: | :-: | :-: | :-: |
| **B1** | **Khung Bìa Mở Đầu Cổ Điển ("Mệnh Thư Tổng Lược")** kèm đầy đủ Ngày/Giờ sinh, Chân Thái Dương Thời (S5), Nơi sinh, Mệnh/Thân/Cục | **Có** (Đầu Trang 1) | **Có** (Đầu Trang 1) | **Có** (Header Modal mở rộng) | Chỉ xuất dạng danh sách text (Header S5) | **0** |
| **B6** | **Khối "Kết Luận Nhanh — Cốt Tủy Lá Số (5 Dòng Xác Định)"** | **Có** (Trang 1, ngay dưới B1) | **Có** (Trang 1, ngay dưới B1) | **Có** (Khối mở đầu Chương 1) | **Có** (5 dòng bullet Markdown đầu hồ sơ) | **0** |
| **B2** | **Sơ Đồ Lưới 12 Cung 4×4 Truyền Thống** (render xác định từ `chart.palaces`) | **Có** (Trang 1, dưới B6; ngắt trang sau B2) | **Có** (Trang 1, dưới B6; ngắt trang sau B2) | **Có** (Đầu Chương 1) | *Không* (`.MD` không mang lưới CSS 4×4) | **0** |
| **B3** | **Bảng Ma Trận Năm 5 Cột Cân Đối** ở đầu Chương 7 (2026–2030) & Chương 8 (2026–2035) | **Có** (Đầu Ch.7 & Ch.8) | **Có** (Đầu Ch.7 & Ch.8) | **Có** (Đầu Ch.7 & Ch.8) | *Không* (tránh tràn dòng `.MD` hẹp) | **0** |
| **B4** | **Chế bản In Ấn Chuyên Nghiệp:** Font Serif tiếng Việt, Drop-cap đầu chương, Header/Footer trang in, ngắt trang theo chương | **Có** | **Có** | Áp dụng font Serif cho tiêu đề & thân bài | *Không* | **0** |
| **B5** | **Bảng màu "Giấy Cổ" & Chế độ In Đen Trắng Sắc Nét (`@media print`)** | **Có** | **Có** | **Có** | *Không* | **0** |

### 3.2. Đặc tả kỹ thuật chi tiết cho từng hạng mục Mảng B

#### (B1) + (B6) + (B2): Thiết kế "Trang 1 Tích Hợp — Mệnh Thư Tổng Lược & Tinh Bàn"
- **Mục tiêu chế bản (`T4`):** Tránh lãng phí 1 tờ giấy A4 chỉ cho vài dòng tên đương số. Trên bản `.HTML` và `printSheetPortal`, **Trang 1 A4** chứa trọn vẹn 3 phần xác định (`B1` + `B6` + `B2`), sau khối `B2` mới đặt `page-break-after: always` để sang Trang 2 bắt đầu Chương 1.
- **Đặc tả (B6) — Hàm `buildDeterministicExecutiveSummaryVi(chart: ZiweiChart): string[]` (`src/lib/dossier-chat-ui.ts`):**
  - Trả về đúng **5 dòng dữ kiện xác định 100%** (tuyệt đối không có văn xuôi suy diễn chủ quan, thời gian chạy $< 2\text{ms}$):
    1. **Căn Cơ Bản Mệnh & Cục:** `${chart.yinYangGenderVi} · Bản mệnh ${chart.nayinVi} · Cục ${chart.fiveElementsClassVi} (${mingJuRelationLabel}) · Mệnh Chủ: ${chart.mingZhuVi} · Thân Chủ: ${chart.shenZhuVi}.`
    2. **Trục Mệnh – Thân & Chính Tinh:** `Mệnh đóng tại ${mingPalace.branchVi} (${mingPalace.ganZhiVi}) [${mingMajors}]; Thân cư ${shenPalace.nameVi} tại ${shenPalace.branchVi} (${shenPalace.ganZhiVi}) [${shenMajors}].`
    3. **Tứ Hóa Bản Mệnh (Can ${birthStemVi} năm ${chart.yearGanZhiVi}):** `Hóa Lộc: ${locStar} (${locPalace}) · Hóa Quyền: ${quyenStar} (${quyenPalace}) · Hóa Khoa: ${khoaStar} (${khoaPalace}) · Hóa Kỵ: ${kyStar} (${kyPalace}).`
    4. **Tiêu Điểm Vận Hạn Năm 2026 (Bính Ngọ — ${age2026} tuổi âm):** `Đại hạn tại ${daXian2026} · Lưu Mệnh tại Ngọ (trùng ${natalNgo}) · Lưu Tứ Hóa: ${siHua2026Compact}.`
    5. **Chuyển Dịch Lưu Niên Năm 2027 (Đinh Mùi — ${age2027} tuổi âm):** `Đại hạn tại ${daXian2027} · Lưu Mệnh sang Mùi (trùng ${natalMui}) · Lưu Tứ Hóa: ${siHua2027Compact}.`
- **Đặc tả (B2) — Hàm `buildDeterministicChartGridHtml(chart: ZiweiChart): string` (`src/lib/dossier-chat-ui.ts`):**
  - **Bảng tọa độ CSS Grid 4×4 bắt buộc cho 12 Địa Chi (`0=Tý .. 11=Hợi`):**
    ```ts
    const BRANCH_GRID_POS: Record<number, { row: number; col: number }> = {
      5:  { row: 1, col: 1 }, // Tỵ (góc trên trái)
      6:  { row: 1, col: 2 }, // Ngọ
      7:  { row: 1, col: 3 }, // Mùi
      8:  { row: 1, col: 4 }, // Thân (góc trên phải)
      9:  { row: 2, col: 4 }, // Dậu
      10: { row: 3, col: 4 }, // Tuất
      11: { row: 4, col: 4 }, // Hợi (góc dưới phải)
      0:  { row: 4, col: 3 }, // Tý
      1:  { row: 4, col: 2 }, // Sửu
      2:  { row: 4, col: 1 }, // Dần (góc dưới trái)
      3:  { row: 3, col: 1 }, // Mão
      4:  { row: 2, col: 1 }, // Thìn
    };
    ```
  - **Ô Trung tâm (Thiên Bàn):** `grid-row: 2 / 4; grid-column: 2 / 4` — hiển thị tiêu đề `"TINH BÀN TỬ VI ĐẨU SỐ"`, Họ tên, Ngày giờ sinh Dương/Âm lịch, Giờ Mặt Trời thật, Âm Dương – Bản Mệnh – Cục, Mệnh Chủ / Thân Chủ.
  - **Nội dung mỗi ô trong 12 cung:**
    - Dòng đầu: **Tên Cung** + nhãn **`[MỆNH]`** / **`[THÂN]`** (viền đậm) + **Đại hạn `X–Y`**.
    - Giữa: **Chính tinh** (`font-weight: 700`) + `[Độ sáng]` + ký hiệu Tứ Hóa gốc **`[Lộc]` / `[Quyền]` / `[Khoa]`** (viền nét liền `1px solid`) hoặc **`[Kỵ]`** (viền nét đứt `1px dashed` + chữ đậm để phân biệt rõ khi in đen trắng).
    - Dưới: Các phụ tinh trọng yếu (Lộc Tồn, Kình/Đà, Không/Kiếp, Khôi/Việt, Xương/Khúc, Tả/Hữu, Đào/Hồng/Mã) và chân ô ghi **Can Chi cung** + **Trường Sinh**.

#### (B3): Bảng Ma Trận Năm 5 Cột Cân Đối ở Đầu Chương 7 (`horizon_5y`) & Chương 8 (`horizon_10y`)
- Viết hàm **`buildMultiYearMatrixTableHtml(chart: ZiweiChart, span: 5 | 10): string`** trong `src/lib/dossier-chat-ui.ts` (lấy dữ liệu từ `buildMultiYearHorizonContext(chart, 2026, span).rows`):
  - Thiết kế **5 cột với `<colgroup>` cố định** để vừa khít khổ A4 dọc (`182mm`):
    1. **Cột 1 (`12%`) — Năm & Tuổi:** `2026 (Bính Ngọ) · 32 tuổi`
    2. **Cột 2 (`18%`) — Đại Hạn & Quan Hệ:** Cung Đại Hạn (`X–Y tuổi`) + nhãn quan hệ ĐH–LN (`Trùng cung / Xung chiếu / Tam hợp / Lục hợp / Bình thường`).
    3. **Cột 3 (`16%`) — Trục Lưu Niên:** `Lưu Mệnh tại <Chi> (trùng <Bản Mệnh>)`, `Lưu Tài`, `Lưu Quan`, `Lưu Phối`.
    4. **Cột 4 (`34%`) — 4 Sao Lưu Tứ Hóa (Đủ Lộc · Quyền · Khoa · Kỵ):** Mỗi hóa 1 dòng gọn: **`[Lộc]` / `[Quyền]` / `[Khoa]` / `[Kỵ]`**: `<Tên Sao>` tại **`<Vai trò Lưu>`** *(trùng `<Bản Mệnh>`)*.
    5. **Cột 5 (`20%`) — Sao Lưu & Cờ Xung Hợp:** Lưu Lộc Tồn, Lưu Kình/Đà, Lưu Mã + các cờ cảnh báo (`Kỵ trùng Kỵ`, `Lộc gặp Không Kiếp`...).
  - Tự động gắn bảng này vào đầu phần hiển thị của Chương 7 (`horizon_5y`) và Chương 8 (`horizon_10y`) trong `.HTML`, `printSheetPortal` và trên giao diện đọc của `DetailedDossierModal.tsx`.

#### (B4) & (B5): Tinh chỉnh Typography, Bảng màu "Giấy Cổ" & Quy chuẩn In Đen Trắng (`@media print`)
- **Trên màn hình (`.HTML` & Modal):**
  - Font chữ: `'Noto Serif', 'Merriweather', 'Times New Roman', Georgia, serif`.
  - Bảng màu Giấy Cổ: nền trang `#fbf7ef`, nền hộp dữ kiện `#f4ebd9`, mực chính `#231b15` (tương phản `15.8:1`), khung viền `#78350f`, tiêu đề nhấn `#854d0e`, điểm nhấn chu sa `#991b1b`.
  - Drop-cap chữ cái đầu tiên của đoạn văn đầu mỗi chương (`.chapter-body > p:first-of-type::first-letter`): `font-size: 2.5em; font-weight: 700; float: left; line-height: 1; padding-right: 8px; color: #7c2d12;`.
- **Khi In Ấn (`@media print`) — An toàn 100% cho máy in Laser Đen Trắng & Photocopy:**
  - Khai báo `@page { size: A4 portrait; margin: 15mm 14mm; }`.
  - Ép nền toàn bộ trang, thẻ, ô bảng về trắng tinh (`background: #ffffff !important;`) và chữ chính về đen tuyền (`color: #000000 !important;`).
  - Ép toàn bộ đường kẻ bảng (`.matrix-table th, .matrix-table td`) và khung lưới 12 cung (`.ziwei-grid-cell`) về nét đậm rõ **`1px solid #44403c !important`** (tuyệt đối không dùng màu xám nhạt `#a8a29e`).
  - Quy tắc chống cắt dòng khi qua trang: `h2, h3, h4 { break-after: avoid; page-break-after: avoid; }`, `table, tr, blockquote, .ziwei-chart-grid { break-inside: avoid; page-break-inside: avoid; }`, `thead { display: table-header-group; }`.

---

## 4. PHẠM VI KỸ THUẬT & CÁC ĐIỀU CẤM TUYỆT ĐỐI (RÀNG BUỘC P7)

1. **TUYỆT ĐỐI KHÔNG đụng vào Engine lập lá số cốt lõi** (`src/lib/ziwei/engine.ts`).
2. **TUYỆT ĐỐI KHÔNG sửa bảng `SI_HUA_TABLE`** (`src/lib/ziwei/constants.ts` / `yunxian-context.ts`).
3. **TUYỆT ĐỐI KHÔNG đụng vào Kho Khóa Gemini (`server/key-pool/*`), KHÔNG đổi cấu hình model (`gemini-3.5-flash-lite` / `gemini-3.8-flash`), KHÔNG sửa `KeyPoolModal.tsx`.**
4. **Thứ tự ưu tiên thi công 4 Pha (sau khi Chủ dự án duyệt):**
   - **Pha 1 (Tầng Dữ kiện & Hậu xử lý thuần — 0 tốn quota):**
     - Tạo `src/lib/ziwei/text-sanitizer.ts` (`stripInvalidForeignScripts`, `normalizeVietnameseMergedWordsAndTypos`, `sanitizeAiVietnameseOutput`, `enforceCanonicalPalaceGroupHeadings`, `verifyAndEnsureCompletePeriodSiHua`).
     - Cập nhật `src/lib/ziwei/yunxian-context.ts` (thêm `oppositePeriodPalaceRoleVi`, bảng 12 cung Lưu Niên, vai trò Lưu của Sao Lưu).
     - Cập nhật `src/lib/ziwei/dossier-context.ts` (giữ `periodPalaceRoleVi` + `oppositePeriodPalaceRoleVi` trong `MultiYearSiHuaEntry` / `mapSiHuaEntry`, bổ sung giờ Mặt Trời thật vào bảng dữ kiện Chương 1).
   - **Pha 2 (Tầng Xuất bản, Cache Hydration & Mảng B — 0 tốn quota):**
     - Cập nhật `src/lib/dossier-chat-ui.ts` (`buildDossierHeaderMetadata` kèm `toTrueSolarTime`, `readDossierCacheEntry` tự làm sạch cache cũ, `buildDeterministicExecutiveSummaryVi`, `buildDeterministicChartGridHtml`, `buildMultiYearMatrixTableHtml`, CSS chế bản `B1`–`B6`).
   - **Pha 3 (Tầng Tích hợp UI & Prompt Server — 0 tốn quota):**
     - Cập nhật `src/components/DetailedDossierModal.tsx`, `src/components/InsightPanel.tsx`, `src/components/ContextualChatDrawer.tsx` và `server.ts` (`sendSseText`, `buildStrictPeriodAiPrompt`, `buildStrictDossierSectionPrompt`).
   - **Pha 4 (Kiểm chứng tự động tiết kiệm Quota):**
     - Chạy toàn bộ test đơn vị Offline với các fixture thật.

---

## 5. KẾ HOẠCH KIỂM CHỨNG TIẾT KIỆM QUOTA & TIÊU CHÍ ĐẠT/KHÔNG-ĐẠT (RÀNG BUỘC P8)

### 5.1. Danh sách 6 bài kiểm chứng Offline bắt buộc (Chi phí Quota AI = 0)

| Mã Test | File Script Kiểm Chứng | Nội dung & Fixture đầu vào | Tiêu chí ĐẠT (Pass Criteria) |
| :-: | :--- | :--- | :--- |
| **TEST-1** | `tsc --noEmit` & `vite build` (`compile_applet` + `lint_applet`) | Toàn bộ mã nguồn TypeScript Client & Server. | `0` lỗi kiểu tĩnh, `0` lỗi lint, bundle production build thành công, quét `dist/` không lộ khóa API (`0`). |
| **TEST-2** | `scripts/verify-dossier-chat-ui.ts` (Bộ lọc S3 & S4 — Ràng buộc P1, P8) | - **Fixture 2A (lỗi thật):** `"Trong cácφ cung hạn hiện tại, mức căngđộ công việc tăng cao, kho lứa dồi dào nhưng tính cách hơi bảo Thủ."`<br>- **Fixture 2B (song ngữ & ký hiệu):** `"Tỷ lệ 85% • Cung Mệnh ↔ Thiên Di – Tử Vi (紫微)"` với `allowHanzi: false` và `allowHanzi: true`.<br>- **Fixture 2C (chống dương tính giả T3):** `"Sao Vũ Khúc đóng tại cung Tài Bạch, tuổi Canh Thìn và Canh Dần."` | - 2A trở thành: `"Trong các cung hạn hiện tại, mức căng độ công việc tăng cao, kho lúa dồi dào nhưng tính cách hơi bảo thủ."`<br>- 2B giữ nguyên `85%`, `•`, `↔`, `–`; xóa `(紫微)` khi `allowHanzi: false` và giữ nguyên `(紫微)` khi `allowHanzi: true`.<br>- 2C giữ nguyên 100% `"Vũ Khúc"`, `"Tài Bạch"`, `"Canh Thìn"`, `"Canh Dần"`. |
| **TEST-3** | `scripts/verify-dossier-chat-ui.ts` (Hậu kiểm S1 — Ràng buộc P3, P8) | **Fixture 3 (văn bản Chương 5 thật bị thiếu 2 hóa):** Văn bản Lưu Niên chỉ nhắc tên sao đi với `Hóa Quyền` và `Hóa Kỵ`, bỏ sót 2 sao đi với `Hóa Lộc` và `Hóa Khoa` trên lá số Nguyễn Văn An (16/08/1995). | - `verifyAndEnsureCompletePeriodSiHua` trả về `isComplete === false` và `missingEntries.length === 2` (đúng `Hóa Lộc` và `Hóa Khoa`).<br>- Chuỗi `patchedText` sau khi tự động nối khối bổ khuyết xác định đi qua `verifyAndEnsureCompletePeriodSiHua` lần 2 trả về `isComplete === true` và chứa đủ 4/4 sao Lưu Tứ Hóa kèm vai trò cung Lưu Niên. |
| **TEST-4** | `scripts/verify-dossier-context.ts` (Dữ kiện Lưu Niên S2 — Ràng buộc P4) | Lá số Nguyễn Văn An (sinh 16/08/1995), gọi `buildYunxianPeriodContext` cho năm 2027 (Đinh Mùi) và `buildMultiYearHorizonContext` cho 2026–2035. | - `factTableMarkdown` năm 2027 có đủ **12 dòng** trong `[Bảng Ánh Xạ Đầy Đủ 12 Cung Kỳ Hạn ↔ 12 Cung Bản Mệnh Gốc]`, trong đó cung Mão ghi rõ **`Cung Lưu Tài Bạch`** trùng **`Mệnh Cung`**.<br>- Cả 4 phần tử `periodSiHua` có đủ `periodPalaceRoleVi` và `oppositePeriodPalaceRoleVi` khác rỗng.<br>- `MultiYearSiHuaEntry` của Chương 7 & 8 có đủ `periodPalaceRoleVi` và `oppositePeriodPalaceRoleVi`. |
| **TEST-5** | `scripts/verify-dossier-chat-ui.ts` (Tiêu đề 4 cung Chương 4 S4 & Làm sạch Cache cũ T2 — Ràng buộc P5) | Văn bản Chương 4 (`palaces_social_health`) có tiêu đề thiếu ngoặc `### Cung Phụ Mẫu (Quý Mùi)` và chứa `"cácφ"`, `"căngđộ"` được lưu trong mock `sessionStorage` (`ziwei_dossier_v1::...`). | Khi đọc qua `readDossierCacheEntry` và `enforceCanonicalPalaceGroupHeadings`, văn bản trả về có đủ 4 tiêu đề chuẩn chứa `[Đại hạn X–Y tuổi]` và sạch hoàn toàn `"cácφ"`, `"căngđộ"`. |
| **TEST-6** | `scripts/verify-dossier-chat-ui.ts` (Header Giờ Mặt Trời thật S5 & Mảng B `B1–B6` — Ràng buộc P6) | Lá số Nguyễn Văn An (sinh 16/08/1995, giờ đồng hồ `14:30`, kinh độ `105.85°Đ` Hà Nội) và 1 lá số chọn `unknownTime` (`!origInput`). | - Cả `.HTML`, `.MD`, `PlainText` của lá số có giờ sinh đều chứa chuỗi `14:30`, chuỗi `Giờ Mặt Trời thật:`, độ lệch phút và Địa Chi giờ sinh.<br>- Lá số `!origInput` hiển thị đúng câu mặc định không lỗi.<br>- Bản xuất `.HTML` chứa đủ: Khung Bìa B1, 5 dòng Cốt Tủy B6, Lưới 12 cung 4×4 B2 (đúng 12 tọa độ `grid-row`/`grid-column`), Bảng Ma Trận 5 cột B3 ở Chương 7/8, và quy tắc `@media print` `#44403c`. |

### 5.2. Kỷ luật Kiểm chứng Live (Bảo vệ tuyệt đối 3 key khỏe)
- Script kiểm chứng tự động **KHÔNG gọi API Gemini thật** (tiêu tốn 0 quota).
- Nếu cần kiểm chứng Live trên giao diện sau khi thi công, **chỉ bấm sinh đơn lẻ tối đa 2 chương Lưu Niên** (`Chương 5 — Lưu Niên 2026` và `Chương 6 — Lưu Niên 2027`) trên 1 lá số; **tuyệt đối không bấm "Sinh Toàn Bộ 8 Chương"**.

---

## 6. DANH SÁCH QUYẾT ĐỊNH TRÌNH CHỦ DỰ ÁN PHÊ DUYỆT (`QĐ-G1` .. `QĐ-G6`)

*(Trích xuất từ Biên bản Panel phản biện `docs/dossier-fix-panel-review.md` mục 5 — chờ Chủ dự án chốt để bắt đầu thi công)*:

| Mã QĐ | Vấn đề cần quyết định | Khuyến nghị chốt của Panel (Phương án A) | Phương án thay thế (nếu Chủ dự án muốn đổi) |
| :-: | :--- | :--- | :--- |
| **`QĐ-G1`** | **Cơ chế Hậu kiểm xác định (S1 / P3)** khi văn bản Lưu Niên thiếu $\ge 1$ trong 4 sao Lưu Tứ Hóa | **Phương án A:** Tự động nối khối dữ kiện xác định `> 📌 **[Tổng Hợp Đầy Đủ Tứ Hóa Kỳ Hạn Theo Lá Số]**` ghi rõ sao bị sót + cung Bản Mệnh + vai trò cung Lưu Niên + đối cung xung chiếu trước khi lưu vào `aiPeriodCache` (**0 tốn quota AI**, bản xuất luôn đủ 4/4 hóa). | *Phương án B:* Chỉ gắn nhãn cảnh báo trên UI để người dùng tự bấm sinh lại.<br>*(Phương án C tự động gọi AI sinh lại bị Panel bác bỏ vì tốn 200% quota và dễ gặp lỗi 503).* |
| **`QĐ-G2`** | **Phạm vi & Vị trí Bộ lọc văn bản (S3, S4 / P1, P2, T2, T3)** | **Phương án A:** Tách Lớp 3A (lọc glyph thuộc Script ngoại lai `Greek/Cyrillic/Hebrew/Arabic/Thai/Devanagari/Hangul/Kana/\uFFFD` + `Han` khi tắt song ngữ; giữ `↔, •, %`) và Lớp 3B (tách chữ `đ` thường `U+0111` sau âm tiết tiếng Việt + từ điển hẹp `"kho lúa"`, `"bảo thủ"`). Chặn Lớp 3A tại `sendSseText` (`server.ts`), chặn trọn bộ Lớp 3A+3B trên `accumulated` ở Client trước mọi điểm ghi cache **VÀ bọc trong `readDossierCacheEntry`** để tự làm sạch cache cũ với 0 quota. | *Phương án B:* Chỉ lọc trên `accumulated` ở Client khi sinh chương mới, không tự làm sạch cache cũ trong `sessionStorage`. |
| **`QĐ-G3`** | **Bổ sung nhãn vai trò Lưu Niên tiền-tính cho (S2 / P4)** | **Phương án A:** Sửa tận gốc ở tầng dữ kiện (`yunxian-context.ts` và `dossier-context.ts`): thêm Bảng Ánh Xạ Đầy Đủ 12 Cung Kỳ Hạn ↔ 12 Cung Bản Mệnh, thêm `oppositePeriodPalaceRoleVi`, in vai trò Lưu cho Sao Lưu và cho cả ma trận Chương 7/8; kết hợp siết câu chữ ở prompt `server.ts`. | *Phương án B:* Chỉ sửa câu chữ trong prompt `server.ts`, không sửa bảng dữ kiện. |
| **`QĐ-G4`** | **Đồng bộ tiêu đề 4 cung Chương 2, 3, 4 cho (S4 / P5)** | **Phương án A (Cách P5-A):** Dùng hàm hậu xử lý `enforceCanonicalPalaceGroupHeadings` ép các dòng `### Cung ...` theo đúng khung chuẩn từ `chart.palaces` (có `[AN MỆNH/THÂN]` + `[Đại hạn X–Y tuổi]`) cả trước khi ghi cache và khi đọc cache cũ từ `sessionStorage`, kèm sửa mẫu ở `server.ts:350`. | *Phương án B (Cách P5-B):* Đổi cấu trúc state tách 4 cung rời khỏi chuỗi Markdown (làm gãy cache `sessionStorage` hiện có). |
| **`QĐ-G5`** | **Định dạng Header Giờ sinh / Giờ Mặt Trời thật (S5 / P6) & Chế bản المảng B (`B1`–`B6`)** | **Phương án A:**<br>• Header S5 hiển thị đồng nhất trên HTML/MD/Copy/Print/Modal: `Giờ đồng hồ: HH:MM → Giờ Mặt Trời thật: HH:MM (Giờ <Chi>, hiệu chỉnh ±X phút theo kinh độ Y°Đ — <Nơi sinh>)` (và câu mặc định rõ ràng khi không rõ giờ sinh).<br>• Trang 1 tích hợp (`B1` + `B6` 5 dòng xác định + `B2` lưới 12 cung 4×4 đúng tọa độ Địa Chi); Bảng ma trận `B3` 5 cột vừa khổ A4 dọc ở đầu Ch.7/8 (không chèn bảng rộng vào `.MD`); `@media print` nền trắng, đường kẻ đậm `#44403c` và ký hiệu `[Lộc]/[Quyền]/[Khoa]/[Kỵ]` an toàn in đen trắng. | *Phương án B:* Tách B1 thành trang bìa rời tốn thêm 1 tờ giấy A4 hoặc lược bớt một số mục trong `B1`–`B6`. |
| **`QĐ-G6`** | **Quy trình Kiểm chứng Tiết kiệm Quota (P8)** | **Phương án A:** Chạy tự động 100% 6 bài test Offline (`TEST-1`..`TEST-6`) với đúng các fixture thật (**0 lượt gọi AI**). Không tự động bắn request AI trong script test; dành việc bấm sinh Live (tối đa 2 chương Lưu Niên trên 1 lá số) cho người dùng nghiệm thu trực tiếp. | *Phương án B:* Cho script test tự động gọi API Gemini thật để sinh lại Chương 5 & 6. |
