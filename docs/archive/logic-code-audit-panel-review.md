> ⚠️ **[TÀI LIỆU LỊCH SỬ ĐÃ LƯU TRỮ — KHÔNG DÙNG LÀM CĂN CỨ CODE HIỆN HÀNH]**
> - **Trạng thái**: Đã hoàn thành vai trò lịch sử / Đã bị thay thế bởi tài liệu sống **[`docs/logic-code-audit-v2.md`](../logic-code-audit-v2.md) & [`docs/decisions-registry.md`](../decisions-registry.md)** từ ngày `17/11/2026`.
> - **Cảnh báo cho Kỹ sư & AI Agent**: Các trích dẫn số dòng, tên biến, hằng số (như ngân sách 25s, nhịp nghỉ 2200ms, số lượng key 3/23) trong file này phản ánh thời điểm trước khi hợp nhất và **không còn khớp với mã nguồn hiện hành**. Tuyệt đối đọc tài liệu sống tại thư mục `docs/` gốc và đối chiếu code thật trước khi chẩn đoán hoặc sửa code!

---
# BIÊN BẢN PHẢN BIỆN CHÉO 5 VAI ĐỐI VỚI BẢN RÀ SOÁT LOGIC & CODE V1 (`docs/logic-code-audit-panel-review.md`)

---

## MỤC 0 — TUYÊN BỐ MINH BẠCH VỀ PHƯƠNG PHÁP MÔ PHỎNG & KỶ LUẬT RÀ SOÁT

1. **Bản chất mô phỏng đa vai**:
   - Biên bản này là **MÔ PHỎNG phản biện 5 vai chuyên môn do MỘT phiên mô hình Gemini 4 Argon duy nhất thực hiện**, **KHÔNG PHẢI** 5 chuyên gia con người độc lập tách biệt ngoài đời thực.
   - Mục đích của kỹ thuật đóng vai tuần tự có đối kháng là buộc mô hình tự kiểm tra chéo từng nhận định trong `docs/logic-code-audit-v1.md` (Bản V1) dưới 5 lăng kính xung đột lợi ích tự nhiên:
     - **[Vai 1 — Kiến trúc sư phần mềm (Software Architect)]**: Soi tính toàn vẹn luồng dữ liệu, ranh giới module, hợp đồng kiểu dữ liệu (TypeScript), khóa định danh trạng thái/cache và nguy cơ trùng lặp hoặc phá vỡ cấu trúc khi sửa.
     - **[Vai 2 — Chuyên gia engine Tử Vi (Ziwei Engine Specialist)]**: Soi độ chính xác thuật toán lịch pháp, Chân Thái Dương Thời, an sao, Tứ Hóa các tầng (Bản Mệnh / Đại Hạn / Lưu Niên), hình học Tam Hợp — Xung Chiếu và tính chuẩn xác thuật ngữ trong dữ kiện nạp cho AI.
     - **[Vai 3 — Chuyên gia bảo mật (Security Specialist)]**: Soi lưu trữ khóa AES-256-GCM, vòng đời khóa trong bộ nhớ/log/UI/export, bề mặt tấn công API Express, kiểm soát đầu vào và rò rỉ dữ liệu giữa các phiên.
     - **[Vai 4 — Chuyên gia hiệu năng (Performance Specialist)]**: Soi thời gian phản hồi, băng thông SSE, kích thước bundle client, chi phí quota Gemini API, nhịp nghỉ (pacing) và hành vi xoay vòng/phạt khóa trong Kho Khóa.
     - **[Vai 5 — Kiểm chứng viên độc lập (Independent Verifier)]**: Đối chiếu từng dòng trích dẫn `file:dòng` của Bản V1 với mã nguồn thật trên đĩa; vạch trần các nhận định dương tính giả (false positive), trích dẫn sai số dòng hoặc thổi phồng mức độ nghiêm trọng; đồng thời chỉ ra các lỗi thật bị Bản V1 bỏ sót và thiết kế kịch bản test kiểm chứng.

2. **Kỷ luật tôn trọng các quyết định đã chốt của Chủ dự án**:
   - Panel tôn trọng tuyệt đối các quyết định đã được Chủ dự án phê duyệt và thi công đạt kiểm chứng ở các đợt trước: **`F1–F7`**, **`QĐ-G1..QĐ-G6`**, **`QĐ-1..QĐ-6`**, cấu hình model chính **`gemini-3.5-flash-lite`** / dự phòng **`gemini-3.8-flash`**, ngân sách chuyển khóa **`35s / tối đa 5 khóa`** và cơ chế hậu kiểm 2 lớp **`3A + 3B`**.
   - Không vai nào được phép coi một quyết định thiết kế đã chốt là "lỗi" nếu không có bằng chứng thực nghiệm mới. Mọi kiến nghị đụng chạm tới các quyết định cũ đều được gắn nhãn tường minh **`[Đề xuất MỞ LẠI quyết định ...]`** và đưa vào danh mục **`QĐ-H*`** để Chủ dự án toàn quyền phán quyết.

---

## MỤC 1 — BÁC BỎ DƯƠNG TÍNH GIẢ, ĐÍNH CHÍNH TRÍCH DẪN & HẠ CẤP ĐỘ NGHIÊM TRỌNG TRONG BẢN V1

Qua đối chiếu trực tiếp mã nguồn thật (`src/`, `server/`, `server.ts`), **[Vai 5 — Kiểm chứng viên độc lập]** cùng các vai chuyên môn đã phát hiện **5 điểm trong Bản V1 bị dương tính giả một phần, trích dẫn sai số dòng/code hoặc đánh giá quá mức nghiêm trọng**:

### 1.1. Bác bỏ một phần & hạ cấp `A-01` (Từ `Cao` xuống `Trung bình`)
- **Nhận định của Bản V1**: Cho rằng người dùng đổi quy ước tháng nhuận (`leapMonth`: `'split'` / `'current'` / `'next'`) hoặc đổi giờ phút thực khiến Chân Thái Dương Thời nhảy sang canh giờ khác sẽ làm `buildChartIdentityKey` trả về cùng một khóa và lấy nhầm lá số cũ.
- **Ý kiến phản biện từng vai**:
  - **[Vai 5 — Kiểm chứng viên độc lập]**: Đối chiếu thực tế `src/components/BirthForm.tsx` (toàn bộ dòng `1–512`) và `src/lib/ziwei/share.ts` (`dòng 29–66`):
    1. Giao diện `BirthForm.tsx` và tham số URL trong `share.ts` **hoàn toàn không có trường chọn quy ước tháng nhuận (`leapMonth`)**. Hàm `formToBirthInfo` (`share.ts:52–65`) không bao giờ gán `leapMonth`, nên `calculateChart` (`algorithm.ts:483`) luôn mặc định dùng `'split'`. Do đó kịch bản "người dùng đổi quy ước tháng nhuận trên UI gây va chạm cache" là **dương tính giả (false positive)** trong phạm vi UI hiện hành.
    2. Hơn nữa, nếu người dùng đổi tỉnh/thành hoặc giờ phút đồng hồ làm Chân Thái Dương Thời nhảy sang canh giờ (`hour` 0..11) khác, thì `chart.birthInfo.hour` đã thay đổi (`share.ts:59`), nên `buildChartIdentityKey` (`${b.year}_${b.month}_${b.day}_${b.hour}_${b.gender}`) **tự động đổi khóa khác**!
  - **[Vai 1 — Kiến trúc sư phần mềm]**: Tuy nhiên, `A-01` vẫn chứa **một lỗi thật ở mức `Trung bình`**:
    - `buildChartIdentityKey(chart)` (`src/lib/dossier-chat-ui.ts:63–66`) và `periodContext.cacheKey` (`src/lib/ziwei/yunxian-context.ts:298`) **bỏ qua hoàn toàn tên đương số (`b.name`) và thông tin giờ gốc/kinh độ (`b.origInput`, `b.longitude`)** khi hai lần lập lá số vẫn rơi vào cùng một canh giờ `b.hour`.
    - Hệ quả thực tế: Nếu người dùng lập lá số cho **"Nguyễn Văn An"** (sinh 16/08/1995, Giờ Tỵ 10:30), sinh Hồ Sơ 8 Chương (trong văn bản AI liên tục nhắc tên *"Đương số Nguyễn Văn An..."*), sau đó đổi họ tên trên form thành **"Trần Hoàng Nam"** (cùng ngày giờ sinh để xem cho người khác hoặc sửa tên viết sai) và bấm *"An Sao Lập Lá Số"*:
      - `buildChartIdentityKey` vẫn trả về `1995_8_16_5_male`. Modal Hồ Sơ 8 Chương sẽ nạp nguyên văn 8 chương cũ đang gọi tên **"Nguyễn Văn An"** dưới tiêu đề hồ sơ của **"Trần Hoàng Nam"**!
      - Tương tự, state `aiPeriodCache` trong `src/App.tsx:66` dùng khóa `periodContext.cacheKey` (`1995-8-16-5-male-2026-32-Bính Ngọ`) và hàm `applyFormAndChart` (`src/App.tsx:88–106`) **không xóa `aiPeriodCache`** khi đổi lá số.
- **Kết luận tổng hợp của Điều phối viên**: Bác bỏ kịch bản `leapMonth` trên UI của V1; giữ lại `A-01` với nội dung chính xác là **Thiếu định danh `name` / `origInput` trong khóa cache hồ sơ & không dọn `aiPeriodCache` khi đổi lá số**, đồng thời **hạ mức độ từ `Cao` xuống `Trung bình`**.

---

### 1.2. Đính chính trích dẫn sai & hạ cấp `A-02` (Từ `Trung bình` xuống `Thấp`)
- **Nhận định của Bản V1**: Viết rằng tại `src/lib/dossier-chat-ui.ts:885` có dòng code `const isVietnam = b.city ? !/Bắc Kinh|Thượng Hải.../i.test(b.city) : true;` không khớp với `share.ts:10`.
- **Ý kiến phản biện từng vai**:
  - **[Vai 5 — Kiểm chứng viên độc lập]**: Đọc trực tiếp `src/lib/dossier-chat-ui.ts` dòng `895–915`:
    - Trong code thật **KHÔNG HỀ CÓ** biểu thức regex `/Bắc Kinh|Thượng Hải.../` như V1 trích dẫn!
    - Tại `src/lib/dossier-chat-ui.ts:910`, code thật đã viết:
      ```ts
      const isVietnam = b.province ? b.province.startsWith('Việt Nam') : true;
      ```
      tức là **đã đồng bộ hoàn toàn** với `src/lib/ziwei/share.ts:10` (`province.startsWith('Việt Nam')`).
    - Ngoài ra, `src/components/BirthForm.tsx:91` đã lọc chỉ hiển thị tỉnh/thành bắt đầu bằng `'Việt Nam'`, nên người dùng trên UI không thể chọn thành phố ngoài Việt Nam.
  - **[Vai 2 — Chuyên gia engine Tử Vi]**: Điểm lệch duy nhất còn tồn tại thật sự là ở nhánh dự phòng khi `b.longitude === undefined`:
    - Khi người dùng mở ứng dụng qua đường dẫn chia sẻ URL (`searchParamsToForm` tại `src/lib/ziwei/share.ts:89–109`) mà trên URL không có tham số `p` (tỉnh/thành), `share.ts:104` gán `province: ''`.
    - Lúc đó `formToBirthInfo` (`share.ts:17, 63`) truyền `longitude: undefined` nên không hiệu chỉnh Chân Thái Dương Thời (`corrected: false`).
    - Ngược lại, `buildDossierHeaderMetadata` (`src/lib/dossier-chat-ui.ts:897–898`) lại viết `const lon = b.longitude !== undefined ? b.longitude : 105.0;` rồi luôn gọi `calculateTrueSolarTime(..., 105.0, 7)`. Vì Phương trình thời gian (Equation of Time) khác 0 ở hầu hết các ngày trong năm, `tst.totalCorrectionMinutes !== 0` khiến header Hồ Sơ báo có độ lệch phút Chân Thái Dương Thời dù lá số vừa nạp từ URL không hiệu chỉnh!
- **Kết luận tổng hợp của Điều phối viên**: Bác bỏ trích dẫn sai ở `dossier-chat-ui.ts:885` của V1; đính chính lại mô tả `A-02` đúng theo dòng `897–898` (chỉ xảy ra khi nạp từ URL thiếu tham số tỉnh/thành `p`) và **hạ mức độ từ `Trung bình` xuống `Thấp`**.

---

### 1.3. Bác bỏ nhận định lặp vòng lặp 3 nơi trong `C-01` & cập nhật lỗ hổng thật (`Thấp`)
- **Nhận định của Bản V1**: Cho rằng 3 hàm `buildDossierMarkdownExport`, `buildDossierPlainTextExport`, `buildDossierStandaloneHtmlExport` (`dòng 1044–1356`) lặp lại vòng lặp gọi `stripInternalDossierMetaLines` và `verifyAndEnsureCompletePeriodSiHua`.
- **Ý kiến phản biện từng vai**:
  - **[Vai 5 — Kiểm chứng viên độc lập]**: Kiểm tra `src/lib/dossier-chat-ui.ts` (file có 1874 dòng):
    1. Số dòng V1 nêu (`1044–1356`) là sai; 3 hàm kết xuất nằm ở **`dòng 1685–1829`**.
    2. `buildDossierPlainTextExport` (`dòng 1762–1770`) thực chất **chỉ có 3 dòng code** gọi lại `buildDossierMarkdownExport(chart, chapters, now).replace(/^#{1,6}\s+/gm, '')` — hoàn toàn không có chuyện lặp vòng lặp ở hàm PlainText!
    3. Cả `buildDossierMarkdownExport` (`dòng 1729–1734`) và `buildDossierStandaloneHtmlExport` (`dòng 1795–1800`) đều đã dùng chung 2 hàm thuần `stripInternalExportMetaLines` (`dòng 187–208`) và `sanitizeDossierChapterText` (`dòng 169–180`).
  - **[Vai 1 — Kiến trúc sư phần mềm]**: Tuy nhiên, khi soi kỹ hàm dùng chung `sanitizeDossierChapterText(chapterId, rawContent, chart)` tại `src/lib/dossier-chat-ui.ts:169–180`, tôi phát hiện một thiếu sót thật:
    - Hàm này gọi `sanitizeAiVietnameseOutput(rawContent)` (Lớp 3A) và `enforceCanonicalPalaceGroupHeadings(cleaned, chapterId, chart)` cho 3 chương cung (`palaces_core`, `palaces_family`, `palaces_social_health`), **nhưng lại quên gọi `verifyAndEnsureCompletePeriodSiHua` (Lớp 3B)** cho 2 chương Lưu Niên (`year_2026`, `year_2027`)!
    - Dù luồng UI trong `DetailedDossierModal.tsx:459` đã gọi `verifyAndEnsureCompletePeriodSiHua` trước khi lưu state, nhưng nếu một chương Lưu Niên được nạp từ `aiPeriodCache` cũ hoặc truyền thẳng vào hàm export/cache reader (`readDossierCacheEntry` tại `dòng 685–720` cũng chỉ gọi `sanitizeDossierChapterText`), Lớp 3B sẽ bị bỏ qua.
- **Kết luận tổng hợp của Điều phối viên**: Bác bỏ nhận định "lặp vòng lặp 3 nơi" của V1; cập nhật `C-01` (mức `Thấp`) thành: **Bổ sung Lớp 3B (`verifyAndEnsureCompletePeriodSiHua`) vào bên trong `sanitizeDossierChapterText` (`dossier-chat-ui.ts:169–180`) để mọi đầu ra đọc cache và kết xuất đều đi qua một cổng hậu kiểm 3A + 3B + Canonical Heading duy nhất**.

---

### 1.4. Đính chính một phần trích dẫn tại `C-02` (`Trung bình`)
- **Nhận định của Bản V1**: Viết rằng cả `DetailedDossierModal.tsx:396–415` và `InsightPanel.tsx:172–195` đều khởi tạo `errMsg = 'Chưa cấu hình AI (kho khóa chưa có Gemini API key khả dụng).'`.
- **Ý kiến phản biện từng vai**:
  - **[Vai 5 — Kiểm chứng viên độc lập]**: Kiểm tra `src/components/DetailedDossierModal.tsx` (`dòng 350–381`):
    - `DetailedDossierModal.tsx:351` đã dùng câu thông báo chuẩn hơn: `'Chưa thể gọi Gemini API cho chương này (kho khóa chưa sẵn sàng hoặc đang nguội).'`.
    - Chỉ có `src/components/InsightPanel.tsx:171` là vẫn giữ câu cứng `'Chưa cấu hình AI (kho khóa chưa có Gemini API key khả dụng).'`.
  - **[Vai 1 — Kiến trúc sư phần mềm]**: Điểm lỗi cốt lõi mà `C-02` nêu vẫn **đúng hoàn toàn ở cả 2 file**:
    - Biểu thức `notConfigured: res.status === 503 && errCode !== 'AI_POOL_EXHAUSTED'` (`DetailedDossierModal.tsx:365` và `InsightPanel.tsx:183`) sẽ gán nhầm `notConfigured = true` nếu có lỗi `503` từ proxy/gateway mà body không phải JSON hợp lệ (`errCode === ''`). Khi `notConfigured === true`, `DetailedDossierModal.tsx:669` sẽ `break` dừng toàn bộ chuỗi sinh tuần tự 8 chương!
    - Đồng thời, tại `/api/interpret` (`server.ts:1045–1048`) và `/api/heming` (`server.ts:1132–1135`), khi bắt lỗi `PoolExhaustedError`, server âm thầm trả về văn bản mẫu tĩnh (`generateStaticReading` / `generateStaticHeming`) với HTTP 200 mà không gửi kèm cờ báo cho người dùng biết Kho Khóa đang tạm chạm ngưỡng RPM.
- **Kết luận tổng hợp của Điều phối viên**: Đính chính số dòng và chuỗi khởi tạo của `DetailedDossierModal.tsx`; giữ nguyên mức `Trung bình` cho `C-02` với đề xuất sửa điều kiện thành `errCode === 'AI_NOT_CONFIGURED'`.

---

### 1.5. Phản biện chống tối ưu hóa quá đà ở `D-01` & đính chính số dòng (`Trung bình` → `Thấp / Giữ nguyên F1`)
- **Nhận định của Bản V1**: Trích dẫn `DetailedDossierModal.tsx:546–586` (nhịp nghỉ `1200ms`) và đề xuất mở `concurrency = 2` khi Kho Khóa có `>= 3` khóa `ready` thuộc các project khác nhau.
- **Ý kiến phản biện từng vai**:
  - **[Vai 5 — Kiểm chứng viên độc lập]**: Đính chính số dòng và hằng số thực tế:
    - Vòng lặp sinh tuần tự `handleRunAllSequential` trong `src/components/DetailedDossierModal.tsx` nằm ở **`dòng 657–716`** (không phải `546–586`).
    - Nhịp nghỉ giữa các chương `DOSSIER_INTER_CHAPTER_PACING_MS` tại `src/lib/dossier-chat-ui.ts:569` đang là **`2_200` ms (`2.2s`)**, không phải `1200ms`.
  - **[Vai 1 — Kiến trúc sư phần mềm] (Phản đối `concurrency = 2`)**:
    - Trong `DetailedDossierModal.tsx:140`, component chỉ có **một `abortRef` duy nhất** (`const abortRef = useRef<AbortController | null>(null)`). Đầu hàm `executeSingleChapterStream` (`dòng 312–314`), code gọi `abortRef.current?.abort()` trước khi tạo `AbortController` mới! Nếu chạy `concurrency = 2` mà không đại tu toàn bộ cơ chế hủy stream sang `Map<DossierChapterId, AbortController>`, luồng thứ 2 vừa khởi chạy sẽ **ngay lập tức `abort()` luồng thứ 1**!
    - Ngoài ra, state `activeLoadingChapterId` (`dòng 123`) là biến đơn (`DossierChapterId | null`), toàn bộ thanh tiến độ và nút "Dừng" trên UI được thiết kế cho đúng 1 chương đang sinh tại một thời điểm.
  - **[Vai 4 — Chuyên gia hiệu năng] (Phản đối `concurrency = 2`)**:
    - Theo `server/key-pool/crypto-store.ts:237`, các khóa mới thêm vào Kho Khóa đều có `detectedProjectNumber: null` (chỉ khi nào khóa bị lỗi `429` lần đầu thì Google mới trả project number trong header/error để parser ghi nhận). Do đó server **không thể biết trước** 3 khóa `ready` có thực sự thuộc 3 Google Cloud Project khác nhau hay cùng nằm trong 1 project của người dùng!
    - Nếu bắn 2 stream lớn (~4.000 token prompt + ~3.000 token output mỗi chương) song song vào cùng 1 project trên tier miễn phí, xác suất dính `429 RATE_LIMIT_RPM / TPM` hoặc `503 UNAVAILABLE` tăng vọt, dẫn tới đứt stream giữa chừng.
- **Kết luận tổng hợp của Điều phối viên**: **Bác bỏ đề xuất `concurrency = 2` của Bản V1 vì đây là tối ưu hóa quá đà (over-optimization)** gây rủi ro cao cho cả kiến trúc `abortRef` lẫn hạn mức RPM. Hạ `D-01` xuống mức `Thấp` và khuyến nghị Chủ dự án tại `QĐ-H7`: **Giữ nguyên chế độ sinh tuần tự `concurrency = 1` (`F1/F7`)**, chỉ tùy chọn giảm nhẹ `DOSSIER_INTER_CHAPTER_PACING_MS` từ `2200ms` xuống `1200ms`.

---

## MỤC 2 — CÁC PHÁT HIỆN MỚI BỊ BẢN V1 BỎ SÓT (BỔ SUNG VÀO BẢN V2)

Trong quá trình rà soát chéo mã nguồn thật, Panel đã phát hiện **3 vấn đề có thật kèm bằng chứng `file:dòng` mà Bản V1 hoàn toàn bỏ sót**:

### 2.1. Phát hiện mới `F-04` (Mức độ: **CAO** — `[Đã kiểm chứng bằng code]`): Mất sạch dữ liệu đã sinh của Chương 5 (`year_2026`) và Chương 6 (`year_2027`) trong Hồ Sơ 8 Chương ngay khi bấm `F5` (tải lại trang)
- **Vai phát hiện**: **[Vai 1 — Kiến trúc sư phần mềm]** & **[Vai 5 — Kiểm chứng viên độc lập]**.
- **Bằng chứng `file:dòng` xác thực**:
  1. Tại `src/lib/dossier-chat-ui.ts:670`, kiểu dữ liệu lưu trong `sessionStorage` được khai báo là:
     ```ts
     export interface StoredDossierRecord {
       chartIdentityKey: string;
       updatedAt: number;
       sections: Partial<Record<Exclude<DossierChapterId, 'year_2026' | 'year_2027'>, StoredDossierSection>>;
       chatHistory: DossierChatMessage[];
     }
     ```
     Tức là `StoredDossierRecord` **loại trừ hoàn toàn `'year_2026'` và `'year_2027'`**.
  2. Tại `src/components/DetailedDossierModal.tsx:581–602`, khi một chương sinh xong (`status === 'ready'`), nếu `chapterId === 'year_2026' || chapterId === 'year_2027'`, code chỉ gọi `onSavePeriodCache(periodContext.cacheKey, finalCleanedText)` (cập nhật `aiPeriodCache` bằng `useState` trong RAM tại `src/App.tsx:66`) mà **KHÔNG lưu vào `sessionStorage`**. Ngược lại, 6 chương còn lại (`1, 2, 3, 4, 7, 8`) được gọi `persistCompletedSectionToSession` lưu vào `sessionStorage`.
  3. Khi người dùng sinh đủ `8/8` chương (tốn 4–6 phút và 8 lượt gọi Gemini API), nếu vô tình bấm `F5` (Reload trang trong cùng tab) hoặc trình duyệt tự làm mới tab:
     - State `aiPeriodCache` trong RAM (`src/App.tsx:66`) bị xóa trắng về `{}`.
     - Khi mở lại Modal Hồ Sơ, `initializeChaptersState` (`DetailedDossierModal.tsx:169–215`) khôi phục được 6 chương (`1, 2, 3, 4, 7, 8`) từ `sessionStorage`, nhưng **Chương 5 (Lưu Niên 2026) và Chương 6 (Lưu Niên 2027) biến mất hoàn toàn (`idle`)**, làm tiến độ tụt từ `8/8` xuống `6/8` và buộc người dùng phải tốn quota sinh lại 2 chương dài nhất!
  4. *(Lưu ý đính chính thêm cho `F-03` của Bản V1)*: Bản V1 ở mục `F-03` từng viết rằng *"sessionStorage chỉ sống trong tab hiện tại; nếu lỡ đóng tab thì mất cả 8 chương"*, mà không hề nhận ra rằng ngay cả khi **chưa đóng tab, chỉ bấm `F5` thôi là đã mất đứt Chương 5 và Chương 6**!
- **Hướng khắc phục**: Mở rộng `StoredDossierRecord.sections` (`dossier-chat-ui.ts:670`) thành `Partial<Record<DossierChapterId, StoredDossierSection>>` để lưu cả `year_2026` và `year_2027` vào `sessionStorage`, đồng thời khi `initializeChaptersState` đọc ra từ `sessionStorage` thì đồng bộ ngược lại cho `aiPeriodCache` nếu `aiPeriodCache` đang trống.

---

### 2.2. Phát hiện mới `C-05` (Mức độ: **TRUNG BÌNH** — `[Đã kiểm chứng bằng code]`): ~688 dòng dữ liệu tỉnh/thành Trung Quốc trong `src/lib/ziwei/cities.ts` bị đóng gói thừa vào Client Bundle nhưng không bao giờ được sử dụng
- **Vai phát hiện**: **[Vai 4 — Chuyên gia hiệu năng]** & **[Vai 1 — Kiến trúc sư phần mềm]**.
- **Bằng chứng `file:dòng` xác thực**:
  1. File `src/lib/ziwei/cities.ts` dài `784` dòng, trong đó dòng `14–95` (`82` dòng) là 63 tỉnh/thành Việt Nam (`name: 'Việt Nam - ...'`), còn **dòng `96–783` (`688` dòng, chiếm ~88% dung lượng file, tương đương ~28 KB mã nguồn)** là danh sách các tỉnh/thành/quận của Trung Quốc, Đài Loan, Hồng Kông, Ма Cao.
  2. Tuy nhiên, tại `src/components/BirthForm.tsx:90–93`:
     ```ts
     const vnProvinces = useMemo(
       () => PROVINCES.filter((g) => g.name.startsWith('Việt Nam')),
       []
     );
     ```
     và toàn bộ logic `share.ts:10`, `dossier-chat-ui.ts:910` đều chỉ phục vụ địa danh Việt Nam.
  3. Vì `PROVINCES` là một mảng hằng số lớn được import trực tiếp vào `BirthForm.tsx` và `share.ts`, trình đóng gói Vite (Rollup) **không thể tree-shake** 688 dòng dữ liệu tỉnh/thành Trung Quốc kia, khiến mọi trình duyệt của người dùng đều phải tải và khởi tạo mảng dữ liệu chết này trong bộ nhớ.
- **Hướng khắc phục**: Tách hoặc lược bỏ phần dữ liệu ngoài Việt Nam không dùng tới khỏi bundle chính (hoặc giữ trong file phụ không import vào client bundle nếu chưa có nhu cầu mở rộng quốc tế).

---

### 2.3. Phát hiện mới `B-07` (Mức độ: **THẤP** — `[Đã kiểm chứng bằng code]`): Bất đối xứng hậu kiểm trên Server giữa `/api/interpret-period` và `/api/interpret-dossier-section`
- **Vai phát hiện**: **[Vai 1 — Kiến trúc sư phần mềm]** & **[Vai 2 — Chuyên gia engine Tử Vi]**.
- **Bằng chứng `file:dòng` xác thực**:
  1. Tại `server.ts:704–729`, endpoint `POST /api/interpret-period` thu thập `fullStreamedText`, chạy `sanitizeAiVietnameseOutput` (Lớp 3A) và `verifyAndEnsureCompletePeriodSiHua` (Lớp 3B) ngay trên server, nếu phát hiện phần vá bổ sung thì phát thêm frame SSE trước khi gửi `[DONE]`.
  2. Ngược lại, tại `server.ts:798–824`, endpoint `POST /api/interpret-dossier-section` chỉ bơm thẳng từng `chunk` thô từ `keyPoolManager.executeStream` về client rồi đóng stream, **không chạy `sanitizeAiVietnameseOutput` hay `enforceCanonicalPalaceGroupHeadings` trên server**, mà phó mặc 100% cho client (`DetailedDossierModal.tsx:451, 500–513`).
- **Hướng khắc phục**: Ghi nhận rõ ranh giới trách nhiệm (client统一 hậu kiểm qua `sanitizeDossierChapterText`), hoặc đồng bộ thông qua helper dùng chung ở `C-01`.

---

## MỤC 3 — BIÊN BẢN THẢO LUẬN 5 VAI THEO TỪNG MẢNG (A → F)

### MẢNG A — Luồng dữ liệu & Tính nhất quán giữa các tầng (`A-01` .. `A-06`)
- **[Vai 2 — Chuyên gia engine Tử Vi]**:
  - Xác nhận tầng thuật toán cốt lõi (`src/lib/ziwei/algorithm.ts`, `SI_HUA_TABLE` dòng `174–185`, an 14 chính tinh, phụ tinh, Đại Hạn, Lưu Niên) và việc truyền `origInput` (`src/lib/ziwei/share.ts:43–64`, `src/App.tsx:43`, `src/lib/ziwei/history.ts:10–25`) hoạt động chính xác 100%.
  - Đồng tình với nhận định `A-03` (`Thấp`): hai chỉ số `chart.patterns` và `chart.boneWeight` được tính sẵn trong `calculateChart` (`algorithm.ts:593–594`) nhưng chưa đưa vào `buildChartOverviewFactSummary` (`dossier-context.ts:154–219`). Tuy nhiên, lưu ý rằng Cân Xương Tính Số (Lượng Chỉ Viên Thiên Cương) vốn là thuật toán dân gian phụ trợ, không phải cốt tủy của Tử Vi Tam Hợp hay Tứ Hóa; nếu đưa vào `chapter_overview` thì chỉ nên để ở dòng thông tin tham khảo, tránh làm AI sa đà vào thơ Cân Xương mà loãng phân tích tinh đẩu.
- **[Vai 1 — Kiến trúc sư phần mềm]**:
  - Như đã phân tích ở Mục 1.1 và 1.2, `A-01` được chuẩn hóa lại thành lỗi thiếu `name` / `origInput` trong `buildChartIdentityKey` & `periodContext.cacheKey` (mức `Trung bình`), và `A-02` được chuẩn hóa lại thành lỗi fallback kinh độ `105.0°Đ` khi nạp từ URL thiếu tỉnh/thành (mức `Thấp`).
  - Các mục `A-04` (lọc `chatHistory` lỗi khỏi `sessionStorage`), `A-05` (`parseInt` có `Number.isNaN` trong `share.ts`), `A-06` (giới hạn độ dài `chatHistory` gửi lên `/api/interpret-dossier-chat`) đều là các cải tiến vệ sinh code hợp lý ở mức `Thấp`.

### MẢNG B — Tầng AI, Prompt, Hậu kiểm văn bản & Xử lý lỗi Stream (`B-01` .. `B-07`)
- **[Vai 2 — Chuyên gia engine Tử Vi]** (Trọng tâm **`B-04`** — Mức `Cao`):
  - Hoàn toàn đồng thuận rằng **`B-04` là phát hiện giá trị nhất ở tầng nghiệp vụ Tử Vi**.
  - Kiểm tra `src/lib/ziwei/yunxian-context.ts:174–210` (`buildFactTableMarkdown`): bảng dữ kiện hiện tại mới chỉ liệt kê danh sách 12 cung kèm cột `Vai trò cung trong kỳ hạn` (ví dụ `Lưu Mệnh`, `Lưu Tài Bạch`), nhưng ở phần đầu bảng (`dòng 175–186`) mới chỉ in:
    - `- Cung đóng (Bản Mệnh): Cung Hợi — Phúc Đức (Tài Bạch của kỳ hạn)`
    mà **chưa in tường minh 2 cung Tam Hợp và 1 cung Xung Chiếu kèm vai trò Lưu/Đại Hạn tương ứng**.
  - Vì địa chi Tam Hợp luôn cách nhau 4 vị trí (`(branchIdx + 4) % 12` và `(branchIdx + 8) % 12`) và Xung Chiếu cách 6 vị trí (`(branchIdx + 6) % 12`), việc bắt LLM tự nhẩm xem cung Tam Hợp của cung Mão trong năm Lưu Niên đóng tại Mùi là *Lưu Tài Bạch* hay *Bản Mệnh Tài Bạch* chính là nguyên nhân gốc rễ sinh ra lỗi lẫn nhãn tầng (như lỗi S2 trước đây).
  - Nếu code TypeScript tính sẵn và in thẳng 1 dòng dữ kiện bất biến:
    `- Tam phương tứ chính của kỳ hạn: Mệnh kỳ hạn tại [Cung A] (Bản mệnh: ..., Kỳ hạn: Lưu Mệnh) · Tam hợp tại [Cung B] (Bản mệnh: ..., Kỳ hạn: Lưu Tài Bạch) & [Cung C] (Bản mệnh: ..., Kỳ hạn: Lưu Quan Lộc) · Xung chiếu tại [Cung D] (Bản mệnh: ..., Kỳ hạn: Lưu Thiên Di)`
    thì AI chỉ việc chép đúng dữ kiện, triệt tiêu 100% lỗi nhẩm hình học Tam Hợp mà tốn chưa tới 60 token prompt!
- **[Vai 4 — Chuyên gia hiệu năng] & [Vai 1 — Kiến trúc sư phần mềm]** (Trọng tâm **`B-05` / `NV-01`** — Mức `Cao`):
  - Kiểm chứng dòng `72, 91–94, 146–164, 240–254` của `server/key-pool/executor.ts` và dòng `146–163` của `server/key-pool/allocator.ts`:
    - Biến `let timedOutWaitingFirstChunk = false;` (`executor.ts:72`) được gán `true` trong `setTimeout` (`executor.ts:92`) trước khi gọi `abortController.abort()`.
    - Trong khối `catch (err)` (`executor.ts:146`), biến `timedOutWaitingFirstChunk` **hoàn toàn không được đọc**! Lỗi `AbortError` đi vào `classifyGeminiError(err)` (`allocator.ts:158`): vì `DOMException` trong Node.js có `.code = 20` (khác `'ETIMEDOUT'`) và `.message = 'This operation was aborted'` (không khớp `/timeout|timed out/i`), nó rơi xuống nhánh cuối cùng `NETWORK_OR_5XX`.
    - Đặc biệt nguy hiểm ở lần thử thứ 2..5 trong cùng một request: khi tổng thời gian đã trôi qua `32s` trên ngân sách `35s`, `remainingBudgetMs = 3000ms` khiến `Math.min(firstChunkTimeoutMs, remainingBudgetMs)` chỉ còn `3s`. Nếu khóa thứ 2 (hoàn toàn khỏe mạnh) cần `3.5s` để suy luận và trả chunk đầu tiên, nó sẽ bị `abortController.abort()` ở giây thứ 3 và bị `markFailed('NETWORK_OR_5XX')` phạt oan `-10` điểm sức khỏe + khóa `cooldown 30s`!
  - Lưu ý kỷ luật: Vì quy tắc dự án đang khóa không sửa `server/key-pool/*`, Panel gắn nhãn đây là **`[Đề xuất MỞ LẠI phạm vi sửa nhỏ có kiểm soát tại server/key-pool/executor.ts]`** trong quyết định **`QĐ-H4`**.
- **[Vai 2 — Chuyên gia engine Tử Vi] & [Vai 5 — Kiểm chứng viên độc lập]** (Trọng tâm **`B-02` / `NV-03`** và **`B-03`** — Mức `Trung bình` / `Thấp`):
  - Đối với `B-02` (`src/lib/ziwei/text-sanitizer.ts:302–335`): Hàm `isPeriodSiHuaMentionedInText` hiện cắt cửa sổ `windowRadius = 110` ký tự trước và sau tên sao (`text.slice(start, end)`) mà không dừng ở dấu chấm câu (`.`, `!`, `?`, `\n`). Nếu câu trước nói *"Liêm Trinh Hóa Lộc ở Bản Mệnh rất sáng."* và câu kế tiếp mở đầu bằng *"Bước vào Lưu Niên, cung mệnh gặp nhiều biến động..."*, chữ `"Lưu Niên"` lọt vào bán kính 110 ký tự của `"Liêm Trinh"` và `"Hóa Lộc"`, gây dương tính giả (`NV-03`). Giải pháp rất gọn: chỉ quét trong cùng một câu hoặc cùng một dòng bullet/bảng.
  - Đối với `B-03` (`src/lib/ziwei/text-sanitizer.ts:174–197`): Regex bước 5 hiện chỉ bắt các tiền tố cố định (`ở|tại|vào|...`). Nếu bổ sung một regex tổng quát tách **ký tự chữ thường có dấu tiếng Việt** (các nguyên âm mang dấu thanh/dấu mũ đặc trưng tiếng Việt như `àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ`) dính liền ngay trước chữ IN HOA (`/[àá...ỵđ]([A-ZÀÁ...ỴĐ])/g`), ta sẽ bắt gọn 100% các từ tiếng Việt có dấu bị dính chữ (`"củaThiên"`, `"nhưThiên"`, `"bịHóa"`, `"cóLưu"`) mà **không bao giờ chạm vào các từ tiếng Anh CamelCase** (`iPhone`, `JavaScript`, `YouTube`, `McDonald`) vì tiếng Anh không có nguyên âm mang dấu tiếng Việt!

### MẢNG C — Chất lượng Mã nguồn, Kiểu dữ liệu & Xử lý lỗi (`C-01` .. `C-05`)
- **[Vai 1 — Kiến trúc sư phần mềm]**:
  - Đã đính chính `C-01` (bổ sung Lớp 3B vào `sanitizeDossierChapterText` ở `dossier-chat-ui.ts:169–180`) và `C-02` (sửa điều kiện `errCode === 'AI_NOT_CONFIGURED'` ở `DetailedDossierModal.tsx:365` & `InsightPanel.tsx:183`).
  - Bổ sung phát hiện mới `C-05` (`Trung bình`): 688 dòng tỉnh/thành Trung Quốc không dùng trong `src/lib/ziwei/cities.ts:96–783`.
  - Hai mục `C-03` (trích xuất helper đọc SSE dùng chung) và `C-04` (thay `err: any` bằng `err: unknown` tại `server.ts`) được giữ nguyên với mức `Thấp` và `Trung bình`.

### MẢNG D — Hiệu năng & Chi phí Quota (`D-01` .. `D-03`)
- **[Vai 4 — Chuyên gia hiệu năng]**:
  - Như đã kết luận ở Mục 1.5, Panel bác bỏ đề xuất `concurrency = 2` ở `D-01` để bảo vệ hạn mức RPM và tránh lỗi `abortRef`.
  - Đồng thuận với `D-02` (`Thấp`): truyền `AbortSignal` từ `req.on('close')` của Express (`server.ts:696, 789, 899`) xuống `keyPoolManager.executeStream` để khi client bấm nút "Dừng" hoặc đóng modal giữa chừng, server ngắt ngay kết nối tới Google Gemini thay vì đọc hết stream trong vô ích.
  - Đồng thuận với `D-03` (`Thấp`): tăng `STATUS_POLL_INTERVAL_MS` ở `KeyPoolModal.tsx:31` từ `4000ms` lên `10000ms` và tạm dừng khi `document.hidden === true`.

### MẢNG E — Bảo mật (`E-01` .. `E-03`)
- **[Vai 3 — Chuyên gia bảo mật]**:
  - Xác nhận cơ chế mã hóa `AES-256-GCM` với `PBKDF2 100.000 vòng` (`server/key-pool/crypto-store.ts`), cơ chế che mặt nạ khóa `maskApiKey` (`AIzaSy••••••xxxx`) và việc dọn sạch dòng meta nội bộ khỏi bản kết xuất (`stripInternalExportMetaLines` tại `dossier-chat-ui.ts:187–208`, đã kiểm chứng qua `TEST-10`) đạt mức an toàn rất tốt.
  - Giữ nguyên 3 khuyến nghị phòng thủ chiều sâu:
    - `E-03` (`Trung bình`): Đặt giới hạn kích thước body JSON (`express.json({ limit: '512kb' })` tại `server.ts:436`) và giới hạn độ dài chuỗi cho các endpoint nhận text mở (`/api/heming`, `/api/interpret-dossier-chat`).
    - `E-01` (`Thấp`): Cảnh báo khi chạy `NODE_ENV=production` mà chưa đặt `KEY_POOL_MASTER_SECRET` riêng.
    - `E-02` (`Thấp`): Bổ sung middleware kiểm tra `Origin`/`Referer` hoặc header `X-Requested-With` cho các route `/api/key-pool/*` có tác dụng thay đổi trạng thái.

### MẢNG F — Trải nghiệm người dùng, Giao diện & Luồng SSE (`F-01` .. `F-04`)
- **[Vai 1 — Kiến trúc sư phần mềm]** & **[Vai 5 — Kiểm chứng viên độc lập]**:
  - Xác nhận **`F-01` (Mức `Cao`)** tại `src/components/HemingView.tsx:76–106`: vòng đọc SSE của tính năng Hợp Hôn bị tụt hậu hoàn toàn so với `InsightPanel.tsx` và `DetailedDossierModal.tsx`:
    1. Không có `sseBuffer` (`chunk.split('\n')` trực tiếp sẽ làm rớt chữ nếu frame JSON dài bị cắt qua 2 gói TCP).
    2. Bỏ qua hoàn toàn `parsed.meta`, `parsed.interrupted`, `parsed.error`.
    3. Không gọi `sanitizeAiVietnameseOutput` (Lớp 3A) sau khi stream kết thúc.
  - Bổ sung **`F-04` (Mức `Cao`)**: mất sạch Chương 5 và Chương 6 của Hồ Sơ 8 Chương khi bấm `F5` do `StoredDossierRecord` (`dossier-chat-ui.ts:670`) loại trừ `'year_2026' | 'year_2027'`.
  - Hai mục `F-02` (tự động cuộn theo nút "Thử lại chương này") và `F-03` (tùy chọn lưu sang `localStorage` có TTL hoặc cảnh báo trước khi đóng tab) giữ ở mức `Thấp`.

---

## MỤC 4 — TỔNG HỢP CÁC ĐIỂM ĐỒNG THUẬN & CÁC ĐIỂM TRANH LUẬN TRONG PANEL

### 4.1. Các điểm đồng thuận tuyệt đối (5/5 vai thống nhất)
1. **Tầng Engine Toán học & Lịch pháp (`algorithm.ts`, `true-solar-time.ts`, `SI_HUA_TABLE`) hoàn toàn vững chắc**: Không có bất kỳ lỗi tính toán sao hay Tứ Hóa nào. Tuyệt đối giữ nguyên quy tắc không đụng vào `algorithm.ts` và `SI_HUA_TABLE`.
2. **4 phát hiện mức `Cao` thực sự cần ưu tiên trong Bản V2**:
   - **`B-04`**: In sẵn 2 cung Tam Hợp + 1 cung Xung Chiếu kèm vai trò Lưu/Đại Hạn trong bảng dữ kiện `yunxian-context.ts` để triệt tiêu tận gốc lỗi AI tự nhẩm hình học địa chi.
   - **`F-04` *(Mới bổ sung)***: Lưu cả Chương 5 (`year_2026`) và Chương 6 (`year_2027`) vào `StoredDossierRecord` trong `sessionStorage` để không bị mất trắng 2 chương Lưu Niên khi bấm `F5`.
   - **`F-01`**: Nâng cấp vòng đọc SSE của `HemingView.tsx` (thêm `sseBuffer`, xử lý `interrupted`/`error`, chạy `sanitizeAiVietnameseOutput`).
   - **`B-05` / `NV-01`**: Sửa việc bỏ quên biến `timedOutWaitingFirstChunk` trong khối `catch` của `server/key-pool/executor.ts` để không phạt oan khóa khỏe mạnh khi ngân sách `remainingBudgetMs` cuối kỳ `35s` bị ép ngắn.
3. **Bác bỏ các dương tính giả / trích dẫn sai của Bản V1**: Hạ cấp `A-01` (`Cao` → `Trung bình`), hạ cấp `A-02` (`Trung bình` → `Thấp`), đính chính `C-01` và `C-02`.

### 4.2. Các điểm có tranh luận giữa các vai & Phán quyết điều phối
| Chủ đề tranh luận | Quan điểm ủng hộ thay đổi mạnh | Quan điểm thận trọng / phản đối | Kết luận của Điều phối viên (Đưa vào V2) |
|---|---|---|---|
| **1. Chế độ sinh Hồ Sơ 8 Chương (`D-01` / Quyết định `F1`)**: Có nên mở `concurrency = 2` không? | **[Vai 4 — Hiệu năng]** ban đầu muốn rút ngắn thời gian chờ tổng thể từ ~5 phút xuống ~3 phút bằng cách bắn 2 chương song song. | **[Vai 1 — Kiến trúc]** chỉ ra `abortRef` đơn lẻ sẽ tự hủy luồng 1 khi luồng 2 chạy; **[Vai 5 — Kiểm chứng]** chỉ ra `detectedProjectNumber` ban đầu là `null` nên 2 luồng dễ bắn chung vào 1 project gây lỗi `429`. | **Bác bỏ `concurrency = 2`**. Khuyến nghị tại `QĐ-H7`: Giữ nguyên `concurrency = 1` (`F1`), chỉ giảm nhẹ nhịp nghỉ giữa 2 chương từ `2200ms` xuống `1200ms`. |
| **2. Sửa `server/key-pool/executor.ts` (`B-05` & `B-01`)**: Có nên chạm vào thư mục `server/key-pool/*` đang bị khóa bảo vệ không? | **[Vai 1 — Kiến trúc]** & **[Vai 4 — Hiệu năng]** nhấn mạnh biến `timedOutWaitingFirstChunk` đã được viết sẵn ở dòng 72 & 92 nhưng bị quên đọc ở dòng 146 — đây là lỗi sót code rõ ràng làm khóa tốt bị phạt oan `-10` điểm sức khỏe. | **[Vai 3 — Bảo mật]** & **[Vai 5 — Kiểm chứng]** lưu ý `server/key-pool/*` là vùng nhạy cảm đã qua 17/17 bài test; nếu sửa phải có quyết định mở khóa tường minh của Chủ dự án và bổ sung test thứ 18. | Đưa vào **`QĐ-H4`** dưới dạng đề xuất mở lại có kiểm soát: chỉ sửa đúng nhánh đọc `timedOutWaitingFirstChunk` và bỏ dòng `onChunk` cảnh báo trùng lặp tại `executor.ts`, kèm bài test tự động trong `verify-key-pool.ts`. |
| **3. Lưu trữ Hồ Sơ 8 Chương (`F-03` & `F-04`)**: Nên giữ ở `sessionStorage` (sửa đủ 8 chương) hay chuyển hẳn sang `localStorage`? | **[Vai 1 — Kiến trúc]** đề nghị sửa ngay lỗi mất Chương 5 & 6 trong `sessionStorage` (`F-04`), còn việc chuyển sang `localStorage` (`F-03`) có thể gây đầy bộ nhớ trình duyệt (`5MB` quota) nếu người dùng lập nhiều lá số. | **[Vai 3 — Bảo mật]** đồng tình giữ `sessionStorage` làm mặc định vì dữ liệu luận giải cá nhân tự xóa khi đóng tab sẽ riêng tư hơn trên máy tính dùng chung. | Ưu tiên sửa triệt để **`F-04` (`Cao`)** ngay trong `sessionStorage` để đủ 8/8 chương khi `F5` (`QĐ-H1`); giữ `F-03` ở mức `Thấp`. |
| **4. Đưa `patterns` (Cách cục) & `boneWeight` (Cân xương) vào Chương 1 (`A-03`)**: Có nên nạp cả hai cho AI không? | **[Vai 1 — Kiến trúc]** thấy dữ liệu đã tính sẵn trong `chart` mà không dùng là lãng phí. | **[Vai 2 — Tử Vi]** ủng hộ đưa `chart.patterns` (Cách cục Tử Vi chính thống) vào bảng dữ kiện Chương 1, nhưng khuyến nghị thận trọng với `boneWeight` (Cân xương tính số không thuộc hệ thống Tam Hợp / Tứ Hóa). | Giữ `A-03` ở mức `Thấp`: khuyến nghị chỉ bổ sung `chart.patterns` vào `buildChartOverviewFactSummary` (hoặc ghi chú rõ `boneWeight` chỉ là tham khảo dân gian). |
