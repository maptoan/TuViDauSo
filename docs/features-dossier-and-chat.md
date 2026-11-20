# ĐẶC TẢ HỒ SƠ 8 CHƯƠNG, HỎI ĐÁP NGỮ CẢNH, HỢP BÀN & HẬU KIỂM (`docs/features-dossier-and-chat.md`)

- **Loại tài liệu**: `[Tài liệu Sống — SSOT Tính năng Nghiệp vụ & Giao diện AI]`
- **Trạng thái hiệu lực**: `ĐANG HIỆU LỰC (ACTIVE)`
- **Áp dụng cho phiên bản ứng dụng**: `1.4.0-rc.1` *(đồng bộ với `/VERSION`)*
- **Cập nhật lần cuối**: `19/11/2026` *(cập nhật Nền Tri Thức AI Đợt Pilot 1A `QĐ-N1..QĐ-N8`)*
- **Mã nguồn đối chiếu (Code SSOT)**: `server/knowledge-base/*`, `server.ts`, `src/lib/chart-library.ts`, `src/lib/dossier-chat-ui.ts`, `src/lib/ziwei/history.ts`, `src/lib/ziwei/text-sanitizer.ts`, `src/lib/ziwei/yunxian-context.ts`, `src/lib/ziwei/dossier-context.ts`, `src/lib/ziwei/share.ts`, `src/components/ChartLibraryModal.tsx`, `src/components/DuplicateChartPromptModal.tsx`, `src/components/BirthForm.tsx`, `src/components/DetailedDossierModal.tsx`, `src/components/ContextualChatDrawer.tsx`, `src/components/InsightPanel.tsx`, `src/components/HemingView.tsx`
- **Quyết định liên quan**: `F1–F7`, `QĐ-G1..QĐ-G6`, `QĐ-H1..H3`, `QĐ-H5..H7`, `QĐ-L1..QĐ-L9`, `ĐC-1..ĐC-6`, `QĐ-M1..QĐ-M6`, `QĐ-N1..QĐ-N8` *(chi tiết tại `docs/decisions-registry.md`)*

---

## 1. Hồ Sơ Toàn Diện 8 Chương (`DetailedDossierModal.tsx` & `dossier-chat-ui.ts`)

### 1.1. Danh sách chính thức 8 chương (`DOSSIER_CHAPTER_SPECS`)
Định nghĩa chuẩn tại `src/lib/dossier-chat-ui.ts:654–727`:

| STT | Mã chương (`DossierChapterId`) | Tên chương (`titleVi`) | Nguồn dữ kiện & Chế độ |
|:---:|---|---|---|
| 1 | `chapter_overview` | Chương 1 — Tổng Quan Mệnh Cục & Cách Cục Tiên Thiên | `dossier-context.ts` (`dossier_section`) — gồm Tam Phương Tứ Chính Mệnh & `detectPatterns` (`QĐ-H3`) |
| 2 | `palaces_core` | Chương 2 — Nhóm Cung Cốt Lõi: Mệnh · Quan Lộc · Tài Bạch · Thiên Di | `dossier-context.ts` (`dossier_section`) |
| 3 | `palaces_family` | Chương 3 — Nhóm Cung Gia Đạo & Nội Lực: Phu Thê · Tử Nữ · Điền Trạch · Phúc Đức | `dossier-context.ts` (`dossier_section`) |
| 4 | `palaces_social_health` | Chương 4 — Nhóm Cung Quan Hệ & Thể Chất: Phụ Mẫu · Huynh Đệ · Giao Hữu · Tật Ách | `dossier-context.ts` (`dossier_section`) |
| 5 | `year_2026` | Chương 5 — Vận Hạn Lưu Niên Năm Hiện Tại (2026) | `yunxian-context.ts` (`period`, `year: 2026`) — đồng bộ 2 chiều với `aiPeriodCache` |
| 6 | `year_2027` | Chương 6 — Vận Hạn Lưu Niên Năm Sau (2027) | `yunxian-context.ts` (`period`, `year: 2027`) — đồng bộ 2 chiều với `aiPeriodCache` |
| 7 | `horizon_5y` | Chương 7 — Chiến Lược Trung Hạn 5 Năm (2026–2030) | `dossier-context.ts` (`dossier_section`, `buildMultiYearHorizonContext`) |
| 8 | `horizon_10y` | Chương 8 — Đại Cục Tầm Nhìn 10 Năm (2026–2035) | `dossier-context.ts` (`dossier_section`, `compactMatrixMarkdown` + chi tiết 10 năm) |

### 1.2. Cơ chế sinh tuần tự & Nhịp nghỉ bảo vệ Kho Khóa (`QĐ-H7`)
- **`concurrency = 1`**: `handleRunAllSequential` (`src/components/DetailedDossierModal.tsx:651–713`) chạy tuần tự từng chương chưa hoàn tất để không xung đột `abortRef` đơn lẻ và tránh chạm trần RPM.
- **`DOSSIER_INTER_CHAPTER_PACING_MS = 1_200`** (`src/lib/dossier-chat-ui.ts:652`): Nghỉ **`1.200 ms` (`1.2 giây`)** giữa 2 chương liên tiếp (cập nhật từ `QĐ-H7`), tự động bỏ qua nếu người dùng bấm Dừng hoặc Tạm dừng sau chương hiện tại.
- Nếu API trả về `res.status === 503 && errCode === 'AI_NOT_CONFIGURED'` (`DetailedDossierModal.tsx:367`, `InsightPanel.tsx:183` — sửa theo `QĐ-H5`), vòng chạy dừng sớm với thông báo kho chưa cấu hình khóa.

### 1.3. Lưu trữ phiên `window.sessionStorage` & Đồng bộ 8/8 Chương (`QĐ-H1` + `QĐ-H2`)
- **Khóa định danh lá số (`buildChartIdentityKey`)**: Định nghĩa duy nhất tại `src/lib/ziwei/yunxian-context.ts:292–310` (`${year}_${month}_${day}_${hour}_${gender}__${nameSlug}__mg${mingGongBranch}__${leapFlag}__${origSig}__${lonSig}`). Chống hoàn toàn lỗi nạp nhầm văn bản cũ khi đổi tên đương số, đổi phút sinh trong cùng canh giờ hoặc đổi kinh độ nơi sinh.
- **Lưu đủ 8 chương vào `sessionStorage` (`QĐ-H1`)**:
  - `StoredDossierRecord` (`src/lib/dossier-chat-ui.ts:750–754`) cho phép `sections` lưu `Partial<Record<DossierChapterId, DossierChapterState>>` — **bao gồm cả `year_2026` và `year_2027`**.
  - Lưu bằng khóa `ziwei_dossier_v1::<chartIdentityKey>` với chính sách **LRU tối đa `MAX_DOSSIERS_IN_SESSION = 5` hồ sơ** (`dossier-chat-ui.ts:91, 264–303`).
  - `DetailedDossierModal.tsx` đồng bộ 2 chiều giữa `sessionStorage` và state `aiPeriodCache` khi mở Modal và sau khi hoàn tất Chương 5, 6 (`DetailedDossierModal.tsx:583–597`), bảo đảm **bấm `F5` (tải lại trang trong cùng tab) không mất bất kỳ chương nào trong 8 chương**.
  - Khi đọc cache cũ (`readDossierCacheEntry`, `dossier-chat-ui.ts:230–259`), hệ thống tự động chạy `sanitizeDossierChapterText` làm sạch không tốn quota AI.

---

## 2. Kết Xuất Hồ Sơ, Header S5 & Lọc Dòng Meta Nội Bộ

### 2.1. Header S5 Nguồn Duy Nhất (`buildDossierHeaderMetadata` — `QĐ-G5` & `QĐ-H5`)
- Định nghĩa tại `src/lib/dossier-chat-ui.ts:969–1090`, dùng chung cho Modal UI, trang 1 `.html`, bản in trực tiếp, `.md` và PlainText.
- **Nối dây `origInput` (`QĐ-G5`)**: `formToBirthInfo` trong `src/lib/ziwei/share.ts:61–67` luôn lưu giờ phút đồng hồ gốc khi không chọn *"Không rõ giờ sinh"*.
- **Khớp điều kiện Chân Thái Dương Thời (`QĐ-H5` / `A-02`)**: `buildDossierHeaderMetadata` (`dossier-chat-ui.ts:984–1047`) chỉ tính và hiển thị hiệu chỉnh Chân Thái Dương Thời khi **`b.origInput && hasValidLongitude`** (khớp 100% với `algorithm.ts`), tránh tự áp mặc định `105.0°Đ` khi mở từ link chia sẻ thiếu tham số tỉnh/thành (`p`).

### 2.2. Định dạng Kết Xuất & Lọc Meta (`QĐ-G3`, `QĐ-G4`, `QĐ-G6`)
- **`buildDossierStandaloneHtmlExport` (`dossier-chat-ui.ts:1897–1997`) & In trực tiếp**: Phong cách biên tập **Giấy Cổ** (`#FBF8F1` / `#FFFDF8`) + `@media print` (`DOSSIER_EDITORIAL_PRINT_CSS`, `dossier-chat-ui.ts:1410–1799`); Trang 1 gồm Header S5 (`B1`), 5 dòng Cốt Tủy Xác Định (`B6`), lá số lưới **4×4 HTML (`B2`)**; Chương 7 & 8 nhúng bảng ma trận 5 cột xác định (**`B3`**).
- **`buildDossierMarkdownExport` & `buildDossierPlainTextExport` (`dossier-chat-ui.ts:1805–1892`)**: Xuất Header S5, 5 dòng Cốt Tủy và văn bản 8 chương thuần túy (không chèn lưới HTML 4×4 hay bảng ma trận vào file `.md`/text).
- **Loại bỏ dòng meta vận hành nội bộ (`stripInternalExportMetaLines` — `QĐ-G6`, `dossier-chat-ui.ts:204–225`)**: Tự động lọc sạch các dòng mở đầu bằng `Nguồn:` và chứa cả `Model:` lẫn `Khóa:` (ví dụ nguồn sinh, tên model, mã khóa che mặt nạ) khỏi **toàn bộ** bản kết xuất `.html`, `.md`, PlainText, sao chép và in trực tiếp, chỉ giữ dòng meta vận hành bên trong giao diện Modal khi đang soạn.

---

## 3. Pipeline Hậu Kiểm Văn Bản 2 Lớp (`text-sanitizer.ts` & `dossier-chat-ui.ts`)

Mọi đầu ra văn bản AI đều phải đảm bảo tính lũy đẳng **`f(f(x)) === f(x)`**:

1. **Lớp 3A (`sanitizeLayer3AOnly` — `src/lib/ziwei/text-sanitizer.ts:54–58`)**:
   - Chạy an toàn trên từng mảnh chunk SSE ngay ở server (`sendSseText` tại `server.ts:112`) và trên client.
   - Khi `allowHan = false` (mặc định tắt song ngữ), xóa ký tự Hán (`\p{Script=Han}`) và toàn bộ hệ chữ ngoại lai không hợp lệ (`Greek`, `Cyrillic`, `Arabic`, `Hangul`, `Kana`, ký tự lỗi `\uFFFD`, ký tự rỗng độ rộng); dọn cặp ngoặc `()` / `[]` rỗng còn sót sau khi xóa chữ ngoại lai.
2. **Lớp 3B (`sanitizeAiVietnameseOutput` — `text-sanitizer.ts:65–101`, `QĐ-H6`)**:
   - Chỉ chạy trên văn bản tích lũy đầy đủ hoặc khi đọc cache/kết xuất (tránh cắt nhầm qua biên chunk).
   - Chuẩn hóa Unicode `NFC`; chạy `VIET_SYLLABLE_END_BEFORE_D_RE` tách chữ `'đ'` thường bị dính; bổ sung `VIET_DIACRITIC_LOWER_BEFORE_UPPER_RE` (`text-sanitizer.ts:46–47`) tách nguyên âm có dấu tiếng Việt hoặc `'đ'` đứng liền trước chữ IN HOA (ví dụ *"nhưThiên Cơ"* → *"như Thiên Cơ"*) mà **tuyệt đối không đụng các từ CamelCase ASCII tiếng Anh** (`iPhone`, `iPad`, `JavaScript`, `TypeScript`, `eBay`, `macOS`, `YouTube`, `McDonald`).
   - Sửa tập từ điển siêu hẹp biên chữ Unicode (`kho lứa` → `kho lúa`, `bảo Thủ` → `bảo thủ`), không chạm tới tên Can Chi hay danh từ Tử Vi; thu gọn khoảng trắng ngang đúp mà giữ nguyên thụt đầu dòng và bảng Markdown.
3. **Hậu kiểm đủ 4/4 Tứ Hóa Kỳ Hạn (`verifyAndEnsureCompletePeriodSiHua` — `text-sanitizer.ts:113–217`, `QĐ-H6`)**:
   - Hàm `isPeriodSiHuaMentionedInText` tách theo đề mục Markdown và **giới hạn cửa sổ quét trong ranh giới câu/dòng (`/[.!?\n;|]/`)** (`text-sanitizer.ts:130–150`) — chấm dứt dương tính giả khi câu trước nhắc sao Bản Mệnh và câu sau nhắc từ khóa *"Lưu Niên"*.
   - Nếu văn bản kỳ hạn thiếu bất kỳ hóa nào trong 4 hóa (Lộc, Quyền, Khoa, Kỵ), nối khối tổng hợp đủ `4/4 Tứ Hóa` theo formatter chuẩn ở cuối bài (0 tốn quota).
4. **Chuẩn hóa Tiêu đề Nhóm Cung (`enforceCanonicalPalaceGroupHeadings` — `text-sanitizer.ts:224–289`)**:
   - Áp dụng cho Chương 2, 3, 4; chuẩn hóa tiêu đề `### Cung ...` kèm `[AN MỆNH]`, `[AN THÂN]`, `[Đại hạn X–Y tuổi]`; bỏ qua tiêu đề gộp nhiều cung.
5. **Hợp nhất qua `sanitizeDossierChapterText` (`src/lib/dossier-chat-ui.ts:170–197`, `QĐ-H1`)**:
   - Thực thi thống nhất Lớp 3A + Lớp 3B + kiểm tra 4/4 Tứ Hóa cho `year_2026`/`year_2027` + chuẩn hóa tiêu đề cho `palaces_*`.

---

## 4. Tầng Dữ Kiện Kỳ Hạn (`yunxian-context.ts`) & Tam Phương Tứ Chính (`QĐ-H3`)

- **`sanFangSiZheng` (`src/lib/ziwei/yunxian-context.ts:235–240, 638–652`)**: Bảng dữ kiện `factTableMarkdown` luôn in sẵn chính xác 4 điểm: **Cung Mệnh kỳ hạn** (`benGong`), **Xung chiếu** (`+6`), **Hội chiếu Tam Hợp 1** (`+4`) và **Hội chiếu Tam Hợp 2** (`+8`), kèm vai trò kỳ hạn ↔ cung Bản Mệnh gốc, chính/cát/sát tinh, Tứ Hóa và Tuế/Tướng Tiền, plus bảng ánh xạ đủ 12 cung (`yunxian-context.ts:654–664`), triệt tiêu việc AI tự nhẩm địa chi.
- **Tổng quan Chương 1 (`src/lib/ziwei/dossier-context.ts:271–333`)**: Bổ sung Tam Phương Tứ Chính Bản Mệnh và tối đa 10 Cách cục nhận diện từ `detectPatterns(chart)`.

---

## 5. Hỏi Đáp Ngữ Cảnh (`ContextualChatDrawer.tsx`) & Hợp Bàn SSE (`HemingView.tsx`)

### 5.1. Hỏi Đáp Ngữ Cảnh (`F4`, `F7`, `QĐ-H2`, `QĐ-H5`)
- **3 điểm mở**: Từ `InsightPanel` (Tổng quan / Cung / Vận hạn), `HemingView` (Hợp Bàn 2 lá số), và từng chương trong `DetailedDossierModal`.
- **Hàng rào Quota Client (`src/lib/dossier-chat-ui.ts:429–548`)**:
  - `CHAT_COOLDOWN_SECONDS = 8` (`8 giây` chờ giữa 2 câu hỏi).
  - `CHAT_SOFT_CAP_BASE = 15`, nhắc màu hổ phách từ lượt `CHAT_SOFT_CAP_AMBER_AT = 10`, bấm mở khóa thêm từng nấc `CHAT_SOFT_CAP_UNLOCK_STEP = 5` lượt.
  - Tự động khóa gửi khi Hồ Sơ 8 Chương đang chạy (`isBlockedByDossier`).
- **Giới hạn payload Client ↔ Server (`dossier-chat-ui.ts:433–436` & `server.ts:215–218`)**:
  - `CHAT_MAX_QUESTION_LEN = 400` ký tự; `CHAT_MAX_EXCERPT_LEN = 6_000` ký tự; `CHAT_MAX_HISTORY_MESSAGES = 6` tin nhắn; `CHAT_MAX_HISTORY_MSG_LEN = 1_200` ký tự.
- **Lưu trữ LRU**: Tối đa `MAX_CHAT_THREADS_IN_SESSION = 10` mạch chat trong `sessionStorage` (`ziwei_chat_v1::<chartIdentityKey>::<contextKey>`). Hàm `filterPersistableChatMessages` (`dossier-chat-ui.ts:569–587`) lọc bỏ cặp hỏi-đáp có `error` thuần túy trước khi ghi lưu (`QĐ-H2` / `A-04`).

### 5.2. Luồng Hợp Bàn / Hợp Hôn SSE (`src/components/HemingView.tsx:101–212`, `QĐ-H5`)
- Chuẩn hóa toàn bộ vòng đọc SSE theo đúng mẫu 3 bước chung:
  1. Tích lũy qua `sseBuffer`, tách dòng bằng `\n` và giữ lại phần chưa hoàn chỉnh sang lần `reader.read()` tiếp theo (`HemingView.tsx:164–176`).
  2. Xả nốt `sseBuffer.trim()` nếu stream đóng mà không có dòng mới cuối (`HemingView.tsx:177–179`).
  3. Xử lý `parsed.meta`, `parsed.interrupted`, `parsed.error`, chạy `sanitizeAiVietnameseOutput` trên nội dung tích lũy và fallback về `buildLocalHemingFallback` kèm `streamNotice` nếu kết nối đứt hoàn toàn mà chưa có chữ nào.

---

## 6. Thư Viện Lá Số & Lưu Trữ Bền Vững 8 Chương (`QĐ-L1..L9` & `ĐC-1..ĐC-5`)

### 6.1. Nguồn Sự Thật Duy Nhất (SSOT) 2 Tầng Client & Chốt Chặn Khóa Kép (`ĐC-3`, `LK-01`, `LK-10`)
- **Kho chỉ mục nhẹ (`window.localStorage['ziwei_chart_library_v1']`)**: Lưu tối đa `MAX_LIBRARY_ENTRIES = 100` mục `ChartLibraryEntry` (trần ghim `MAX_PINNED_ENTRIES = 30`) kèm `deletedTombstones` (tối đa `200` mục trong `90` ngày), huy hiệu xác định (`LibraryDeterministicBadge`), tóm tắt 8 chương (`LibraryDossierSummary`), `customAlias` (tối đa `80` ký tự) và `notes` (tối đa `2.000` ký tự). Khóa `buildChartIdentityKey` luôn bất biến khi sửa alias/notes; hàm `normalizeBirthFormForLibrary` (`src/lib/chart-library.ts`) giữ nguyên toàn vẹn `form.name` (`ĐC-5`).
- **Kho văn bản bền vững (`IndexedDB` `ziwei_thien_ky_library_db_v1` / store `dossier_records`) + gương RAM (`inMemoryDossierMirror`)**: Là **Nguồn Sự Thật Duy Nhất (SSOT)** cho nội dung 8 chương Hồ Sơ (`StoredDossierRecord`). Khóa `ziwei_dossier_v1::<chartIdentityKey>` trong `sessionStorage` chỉ là **gương ghi-thông (write-through mirror)** phục vụ tương thích; qua cầu nối `registerAuthoritativeDossierBridge` (`src/lib/dossier-chat-ui.ts`), khi lệch dữ liệu thì `IndexedDB` + `inMemoryDossierMirror` luôn thắng.
- **Chốt chặn rò dữ liệu chéo (`LK-01`, `LK-06`, `LK-10`)**:
  - `readHotDossierFromLocalStorage`, `getBestKnownDossierSync`, `getDossierReadState`, `sanitizeFullDossierRecord` và `readDossierCacheEntry` đều từ chối mọi bản ghi có `chartIdentityKey` hoặc `val.sectionCacheKey` không khớp với khóa lá số đang truy vấn.
  - `resolveDossierChapterFromCaches` (`src/lib/dossier-chat-ui.ts`) chỉ chấp nhận `localChapters[spec.id]` khi `rawLocal.sectionCacheKey === "${chartIdentityKey}::${spec.id}"` ở **cả nhánh kỳ hạn (`year_2026`, `year_2027`) lẫn nhánh thường**.
  - Trong `DetailedDossierModal.tsx`, khi `chartIdentityKey` đổi (`isChartChanged`), luồng sinh cũ lập tức bị hủy (`stopAllGeneration()`) và `localChapters` bị xóa ngay kể cả khi `IndexedDB` chưa hydrated xong; `useEffect` nạp hồ sơ theo dõi cả `open` để không hiện dữ liệu đã xóa (`LK-09`).
- **Hot cache dự phòng**: `localStorage['ziwei_dossier_hot_v1::*']` giữ tối đa `MAX_HOT_DOSSIERS_LOCALSTORAGE = 3` hồ sơ mở gần nhất và tự xóa sạch nếu `writeLibraryIndexStore` gặp `QuotaExceededError` (`PL-08`, không bao giờ để hot dossier tranh chấp làm hỏng chỉ mục thư viện).

### 6.2. Cổng Hydration Gate (`ĐC-1`) & Chế Độ Suy Giảm (`ĐC-4`)
- `initChartLibrary` chạy feature-detect `IndexedDB` (`isAvailable()`) lúc khởi động và chuyển trạng thái `hydrationStatus`: `'idle' → 'hydrating' → 'ready' | 'degraded'`.
- `getDossierReadState(chartIdentityKey, chart)` phân biệt rõ ràng chưa nạp xong (`isHydrated === false`) với thực sự chưa có hồ sơ (`isHydrated === true && record === null`). Trong lúc `'hydrating'`, `DetailedDossierModal.tsx` khóa nút sinh mới/chạy tự động và mọi thao tác ghi phát sinh giữa chừng được xếp hàng `pendingDossierMutations` để hợp nhất đơn điệu với dữ liệu `IndexedDB` sau khi nạp xong (`ĐC-1`).
- Nếu trình duyệt chặn hoặc không có `IndexedDB` (`ĐC-4`), hệ thống chuyển sang `mode: 'degraded_no_idb'`, hiển thị cảnh báo cố định trong `ChartLibraryModal.tsx` & `DetailedDossierModal.tsx` và nhắc người dùng xuất file `.JSON`.

### 6.3. Di Trú Chính Xác 9 Thành Phần (`QĐ-L2`, `QĐ-L9`), Dọn Chủ Động Có Hoàn Tác (`QĐ-L8`), Thu Hồi An Toàn (`ĐC-2`) & Xuất/Nhập `.JSON`
- **Di trú exact 9-part kèm Cổng Bảo Vệ Lũy Đẳng (`migrateLegacyHistoryAndDossiers` — `QĐ-L2` & `QĐ-L9`)**: Chỉ gắn hồ sơ phiên `'ziwei_dossier_v1::*'` vào mục `'ziwei_history'` (hoặc `currentForm`) khi **khớp chính xác 100% khóa 9 thành phần (`chartIdentityKey`)** và `rec.chartIdentityKey === chartIdentityKey`; bỏ hoàn toàn phỏng đoán Bậc 2 (`legacyFivePartKey`) và Bậc 3 (`nameSlug` / `fivePartCount === 1`). Hồ sơ phiên chưa liên kết (khóa 5 thành phần cũ hoặc khóa 9 thành phần của người ngoài top-10 `ziwei_history`) được giữ nguyên trong `sessionStorage`. Hàm kiểm tra `deletedTombstones` (không hồi sinh mục đã xóa còn sót trong `ziwei_history`) và áp dụng **No-Op/Dirty Guard** chỉ ghi khi thực sự có mục/chương mới (`LK-05`). `src/lib/ziwei/history.ts` ủy quyền toàn bộ sang `chart-library.ts`.
- **Dọn chủ động cấp Hồ Sơ & cấp Chương lẻ kèm Hoàn tác (`QĐ-L8` — Phương án B tăng cường `C1+`)**: Không tự động xóa ngầm văn bản khi khởi động (`LK-03`). Người dùng có thể (i) dùng *"Chỉ xóa Hồ Sơ"* (`deleteMode: 'dossier_only'`) trong `ChartLibraryModal.tsx` (được `App.tsx` xóa đồng bộ `aiPeriodCache` theo tiền tố `${targetKey}__`, `LK-09`), hoặc (ii) xóa riêng 1 chương (`removeSingleDossierChapterFromLibrary`) qua nút **"Xóa chương này"** ngay trong `DetailedDossierModal.tsx` (xác nhận 2 bước nội tuyến + hoàn tác trong phiên, đồng bộ `aiPeriodCache`). Khi xóa `entry_and_dossier`, mục tương ứng cũng được dọn khỏi `'ziwei_history'` và ghi tombstone chống hồi sinh.
- **Thang thu hồi 4 nấc + ĐC-2**: Khi vượt `100` mục, chọn mục chưa ghim theo 4 nấc ưu tiên (`0 chương & rỗng ghi chú` → `0 chương & có ghi chú` → `ít chương nhất < 8` → `đủ 8/8 mở lâu nhất`). **Mục Nấc 3–4 (hoặc có chương hoàn tất) chỉ được xóa sau khi tự động tải file `sao-luu-tu-dong-*.json`** (nếu trình duyệt/hook từ chối tải thì hủy thu hồi), kèm banner hoàn tác (`undoLastEviction`) trong phiên.
- **Xuất/Nhập `.JSON` (`exportLibraryBundle` / `importLibraryBundleWithMerge`)**: Cho phép sao lưu di động giữa nhiều máy/trình duyệt (không dựng trạm đồng bộ server theo `QĐ-L1`), hỗ trợ hợp nhất đơn điệu từng chương (`mergeDossierRecords` — giữ chương hoàn tất thắng chương dở dang, mới hơn thắng cũ hơn theo từng chương độc lập) và `deletedTombstones` chống hồi sinh ở chế độ `smart_merge` (hoặc bỏ qua tombstone khi chọn `force_restore_all`).

### 6.4. Phát Hiện Lá Số Trùng Khi Lập Lá Số (`QĐ-M1..QĐ-M6`, `DM-01..DM-13`)
- **Hàm thuần phát hiện & di trú đồng bộ (`src/lib/chart-library.ts`)**:
  - `initChartLibrary` gọi đồng bộ `migrateLegacyHistoryAndDossiers(currentForm)` ngay khi đặt trạng thái `'hydrating'` (trước IIFE `async` chờ `IndexedDB` — `DM-01`), giữ cho `detectChartDuplicateInLibrary` và `diffBirthFormsForDuplicateModal` thuần khiết 100% (chỉ đọc, không tác dụng phụ ghi storage).
  - Số chương hiệu dụng của ứng viên dùng `resolveEffectiveDossierSummaryForEntry` (ưu tiên `computeDossierSummary(readState.record)` khi `readState.record !== null` — `DM-11`).
- **Phân nhánh hành vi theo nguồn gọi `BirthForm.onChartGenerated` (`QĐ-M4`, `DM-04`)**:
  - Tham số `source?: 'user_form_submit' | 'famous_preset'` tách biệt thao tác nộp biểu mẫu (`handleSubmit`) với bấm chọn nhanh danh nhân (`handleFamousLoad` & `handleFamousSelect`): nguồn `'famous_preset'` chỉ tự nạp êm khi `exact_match`, bỏ qua hộp thoại Trường hợp 2.
  - Nguồn `'user_form_submit'` xử lý đủ 3 nhánh:
    1. **Trường hợp 1 (`exact_match` — `QĐ-M1`, `QĐ-M5`, `DM-02`, `DM-07`, `DM-12`)**: Tái tạo `savedChart = buildChartFromForm(existingEntry.form)` và nạp lại nguyên vẹn lá số + hồ sơ đã lưu; **không** đặt nút xóa hồ sơ trên banner; hiển thị phản hồi kép (banner dưới Quick Summary Bar + hộp thông báo nội tuyến ngay trên nút submit trong `BirthForm.tsx` + cuộn mượt lên banner), phân biệt trạng thái `isAlreadyActiveOnBoard`, tự ẩn sau `15 giây` (tạm dừng khi `hover`/`focus`/`touch`, chỉ bắt đầu đếm sau khi hydration `'ready'`/`'degraded'`).
    2. **Trường hợp 2 (`near_match` — `QĐ-M2`, `DM-05`, `DM-06`, `DM-08`, `DM-13`)**: Tìm ứng viên theo **Nhánh 1** (`same_five_part_key`) và **Nhánh 2 siết chặt** (`same_name_and_solar_date`: trùng tên/`customAlias` chuẩn hóa dài $\ge 2$ khác `'anon'` + cùng ngày/tháng/năm Dương lịch + cùng giới tính + có lệch giờ/phút/`unknownTime`/kinh độ). Sắp xếp tối đa `MAX_NEAR_MATCH_CANDIDATES = 5` ứng viên theo công thức phân tầng không chồng lấn (`1000 / 300 / 150 / 50 / completedCount*5`, phá hòa `lastOpenedAt` rồi `chartIdentityKey`).
    3. **An toàn chéo khóa & Đồng bộ trực tiếp (`DuplicateChartPromptModal.tsx`, `DM-05`, `DM-08`, `DM-13`)**: Đẩy diff `affectsChartStructure === true` lên đầu bảng (tách riêng `location` và `longitude`), hiện khung cảnh báo Hổ phách và đổi nhãn nút thành `"Mở lá số cũ đã lưu ({Giờ} · Mệnh {Cung})"` khi khác cấu trúc 12 cung; gắn nhãn `[Lá số gốc vừa nạp để chỉnh sửa]` khi đi từ `onLoadIntoFormToEditNew`; định danh lá số ẩn danh kèm trích 80 ký tự ghi chú; áp dụng `Stale Entry Guard` kiểm tra lại `readLibraryIndexStore().entries` trước khi mở lá số đã lưu; bảo toàn nguyên tắc **Zero Cross-Key Contamination** ở mọi nhánh.

---

## 7. Nền Tri Thức AI & Hậu Kiểm Trích Dẫn Học Thuật (`QĐ-N1..QĐ-N8`, Đợt Pilot 1A)

### 7.1. Đơn vị Tri thức Gộp Nhóm `(book, h2, h3)` & Bản quyền Phân tách (`QĐ-N1`, `QĐ-N2`, `QĐ-N7`)
- **Kho nguồn & Chưng cất ngoại tuyến (`scripts/kb-*.ts`)**: Kho nguồn đặt tại `/knowledge-source/` (kiểm tra bằng `npm run kb:verify-source`: `1.848` dòng `entries.jsonl`, `16` file `tianji-ziwei/*.md`, `classics/`). Hàm gom nhóm tất định `scripts/kb-group-entries.ts` gộp theo `(book, h2, h3)` theo thứ tự `(part ASC, t_hms ASC)`, kéo ngữ cảnh bài giảng khớp `(bvid, t_hms)`, loại trừ hoàn toàn Tầng 3 (`08-yili`, `10-divination`, `11-fengshui`), và chưng cất ngoại tuyến bằng `@google/genai` (`scripts/kb-distill.ts` + checkpoint JSONL + `--dry-run`).
- **Schema & Mã thẻ nhóm (`server/knowledge-base/types.ts`)**: Mỗi mục tri thức dùng chung mã định danh cấp nhóm `id === citationId` dạng `NH-STAR-###`, `NH-SIHUA-###`, `CL-CTP-###`, `CL-TVP-###`, kèm mảng `hanziAnchor` (`quote`, `bvid`, `t_hms`, `part`), `summaryVi` (`120–350` ký tự tiếng Việt chuẩn `vi-i18n.ts`, 0 chữ Hán) và phân tách bản quyền `sourceRef.sourceLicense` (`CC-BY-NC-SA-4.0` cho Thiên Kỷ của Nghê Hải Hạ; `PUBLIC_DOMAIN_TEXT_WITH_CC_BY_NC_SA_ADAPTATION` cho cổ phú).
- **Trạng thái dữ liệu Pilot 1A**: Bộ 3 tệp `server/knowledge-base/data/{stars,sihua,classics}.kb.json` hiện chứa **9 mục khung mẫu** (`qaMeta.sample: true`) để vận hành trọn vẹn khung truy hồi, hậu kiểm và kiểm thử `verify:kb` trong môi trường chưa có `/knowledge-source/`, sẵn sàng thay thế bằng `~162` mục thật khi chạy `npm run kb:distill` ngoại tuyến.

### 7.2. Truy hồi Tất định & Ngân sách Bảng 4.2 (`server/knowledge-base/retriever.ts`, `QĐ-N6`, `ĐN-8`)
- **0 gọi API embedding**: `loader.ts` nạp dữ liệu vào RAM một lần khi khởi động server và dựng chỉ mục đảo (`byStar`, `bySiHua`, `byPalace`, `byPattern`, `bySource`).
- **Ngân sách & Chia vòng 4 cung (`KB_BUDGET_LIMITS`)**:
  - `chapter_overview`: tối đa `8` mục / `2.400` ký tự.
  - `palaces_core`, `palaces_family`, `palaces_social_health`: tối đa `12` mục / `3.200` ký tự, phân bổ round-robin qua 4 cung (tối đa `3` mục/cung) để không bị 1 cung chi phối toàn bộ ngân sách.
  - `period` (Đại Hạn / Lưu Niên & Chương 5, 6): tối đa `7` mục / `2.100` ký tự.
  - `horizon_5y`, `horizon_10y`: tối đa `6` mục / `1.800` ký tự.
  - `chat` (Hỏi đáp ngữ cảnh): tối đa `5` mục / `1.500` ký tự, áp dụng cơ chế best-effort từ từ khóa cung/sao trong câu hỏi.
- **Kiểm tra vắng mặt sao theo Tam Phương Tứ Chính (`checkEffectiveStarInPalace`, `ĐN-8`)**: Một sao chỉ bị coi là vắng mặt (`starAbsentInQueriedPalace = true`) khi không hiện diện trên **Bản cung + Sao mượn Vô Chính Diệu + 2 cung Tam Hợp (`+4`, `+8`) + Đối cung (`+6`)**; lúc này retriever chèn cảnh báo `coverageBoundaryNoteVi` yêu cầu AI xác nhận không có và không gán nhầm tri thức.

### 7.3. Hậu kiểm Chống Bịa 3 Lớp (`verifier.ts`), Gỡ Thẻ An Toàn (`ĐN-6`) & Phạm vi Đợt 1A (`QĐ-N4`, `QĐ-N5`, `QĐ-N8`)
- **3 lớp hậu kiểm trên luồng SSE hoàn tất (`!wasInterrupted`)**:
  1. **`V1` (`INVALID_CITATION_ID`)**: Mọi thẻ `[Nguồn: <ID>]` không nằm trong whitelist các mục đã nạp cho lượt đó bị liệt vào `scrubbedInvalidIds`.
  2. **`V2` (`UNGROUNDED_ATTRIBUTION`)**: Phát hiện khối đoạn văn / bullet Markdown ($\le 800$ ký tự/khối) viện dẫn *"Nghê Hải Hạ / Nghê Sư / Thiên Kỷ / cổ thư / Tử Vi Đẩu Số Toàn Thư / Cốt Tủy Phú / Thái Vi Phú"* nhưng không mang `[Nguồn: <ID>]` hợp lệ ở đoạn đó.
  3. **`V3` (`UNSUPPORTED_QUOTE_CLAIM`)**: Phát hiện khối văn bản chứa ngoặc kép `“...”` / `"..."` dài $\ge 15$ ký tự kèm động từ trích dẫn (*"viết rằng", "giảng rằng", "nói rằng", "nguyên văn", "câu phú"*...) mà không có mã thẻ hợp lệ.
- **Gỡ thẻ an toàn qua `citationAudit` & `scrubInvalidCitationTags` (`ĐN-6`)**: Server không dùng regex sửa chữ giữa câu văn; chỉ phát frame JSON `{ citationAudit: { validIds, scrubbedInvalidIds, hasUncitedClaims } }`, nối khối `> 📚 **[Tư Liệu Học Thuật Tham Chiếu]**` (`bvid` + `t_hms`) và/hoặc hộp `⚠️` lưu ý kiểm chứng trước `data: [DONE]`. Client (`DetailedDossierModal.tsx`, `InsightPanel.tsx`, `ContextualChatDrawer.tsx`) gọi hàm lũy đẳng `scrubInvalidCitationTags` trước khi lưu vào `IndexedDB` / `aiPeriodCache` / `sessionStorage`.
- **Phạm vi tuyến API Đợt 1A (`QĐ-N8`)**: Tích hợp vào 3 luồng chính `/api/interpret-dossier-section`, `/api/interpret-period`, `/api/interpret-chat`; giữ nguyên `/api/interpret` và `/api/heming` cho Đợt 1B (`1.4.0-rc.2`).
