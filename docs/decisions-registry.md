# SỔ CÁI QUYẾT ĐỊNH KIẾN TRÚC ĐÃ DUYỆT (`docs/decisions-registry.md`)

- **Loại tài liệu**: `[Tài liệu Sống — SSOT Sổ cái Quyết định Kiến trúc]`
- **Trạng thái hiệu lực**: `ĐANG HIỆU LỰC (ACTIVE)`
- **Áp dụng cho phiên bản ứng dụng**: `1.1.0-rc.1` *(đồng bộ với `/VERSION`)*
- **Cập nhật lần cuối**: `17/11/2026`
- **Mã nguồn đối chiếu (Code SSOT)**: Toàn bộ các thay đổi trong `server/`, `server.ts`, `src/`, `package.json`, `VERSION`, `docs/`
- **Quyết định liên quan**: `QĐ-1..QĐ-6`, `F1–F7`, `QĐ-G1..QĐ-G6`, `QĐ-H1..QĐ-H7`, `QĐ-D1..QĐ-D6`

> Sổ cái này tổng hợp toàn bộ 30 quyết định đã được Chủ dự án (**Toàn Đỗ**) phê duyệt và triển khai qua 5 giai đoạn phát triển. Thông số chi tiết của từng mảng được dẫn chiếu về Tài liệu Chủ (SSOT) tương ứng.

---

## Đợt 1 — Kho Khóa Gemini & An Toàn Quản Trị (`QĐ-1` .. `QĐ-6`)

| Mã QĐ | Tên quyết định & Phương án chốt | Trạng thái & Nơi quy chiếu SSOT |
|---|---|---|
| **`QĐ-1`** | Bảo vệ API `/api/key-pool/*` bằng **`KEY_POOL_ADMIN_PIN`** so sánh hằng thời gian; tự động chuyển chế độ Chỉ Đọc trên host chia sẻ (`ais-pre-`) khi chưa cấu hình PIN (Phương án B). | **ĐÃ THI CÔNG (`1.0.0-stable`)** — `server.ts:37–93`, `docs/architecture-overview.md` |
| **`QĐ-2`** | Lưu trữ kho khóa mã hóa **`AES-256-GCM`** tại `.data/gemini-key-pool.enc.json` với `KEY_POOL_MASTER_SECRET` hoặc `.data/.pool-master.key` quyền `0600`, tuần tự ghi qua hàng đợi `SerializedWriteQueue`. | **ĐÃ THI CÔNG (`1.0.0-stable`)** — `server/key-pool/crypto-store.ts`, `docs/key-pool-operations.md` |
| **`QĐ-3`** | Phân loại lỗi `classifyGeminiError` kèm lan truyền cooldown theo `detectedProjectNumber` cho `QUOTA_PROJECT_ZERO`, `QUOTA_DAILY_EXHAUSTED` và cooldown theo model `modelCooldowns` cho `RATE_LIMIT_RPM` / `MODEL_UNAVAILABLE`. | **ĐÃ THI CÔNG (`1.0.0-stable`)** — `server/key-pool/allocator.ts`, `docs/key-pool-operations.md` |
| **`QĐ-4`** | Dùng cặp model khóa cứng của app (`gemini-3.5-flash-lite` chính, `gemini-3.8-flash` dự phòng) + cơ chế tự viết nối tiếp `buildContinuationPrompt` tối đa 2 lần khi đứt luồng giữa chừng. | **ĐÃ THI CÔNG (`1.0.0-stable`)** — `server/key-pool/types.ts`, `executor.ts`, `docs/key-pool-operations.md` |
| **`QĐ-5`** | Thiết lập tổng ngân sách thời gian failover **`35_000 ms` (`35 giây`)**, trần `MAX_KEY_ATTEMPTS = 5` và `FIRST_CHUNK_TIMEOUT_MS = 12_000 ms` *(thay thế mức 25s trong biên bản Panel nháp)*. | **ĐÃ THI CÔNG (`1.0.0-stable`)** — `server/key-pool/types.ts:191–193`, `docs/key-pool-operations.md` |
| **`QĐ-6`** | Phân cấp chọn khóa theo bậc điểm sức khỏe `Math.floor(effectiveScore / 5)`, phục hồi probe với sàn **`95`**, và xoay vòng round-robin giữa các khóa cùng bậc cao nhất. | **ĐÃ THI CÔNG (`1.0.0-stable`)** — `server/key-pool/allocator.ts:436–472`, `docs/key-pool-operations.md` |

---

## Đợt 2 — Bộ 3 Tính Năng Mới (`F1` .. `F7`)

| Mã QĐ | Tên quyết định & Phương án chốt | Trạng thái & Nơi quy chiếu SSOT |
|---|---|---|
| **`F1`** | Hồ Sơ Toàn Diện gồm **8 chương tuần tự (`concurrency = 1`)**: Tổng quan Mệnh cục, 3 nhóm cung (`palaces_core`, `palaces_family`, `palaces_social_health`), Lưu Niên 2026 & 2027 (dùng chung cache với tab Vận Hạn), Chiến lược 5 năm & 10 năm. | **ĐÃ THI CÔNG (`1.0.0-stable`)** — `src/lib/dossier-chat-ui.ts:654–727`, `docs/features-dossier-and-chat.md` |
| **`F2`** | Xuất bản Hồ Sơ chuẩn **Giấy Cổ (`#FBF8F1` / `@media print`)** cho `.html` & in trực tiếp gồm Trang 1 (Header S5, 5 dòng Cốt Tủy `B6`, lá số lưới 4×4 `B2`) và bảng ma trận `B3` cho Ch.7/8; hỗ trợ xuất `.md` và PlainText. | **ĐÃ THI CÔNG (`1.0.0-stable`)** — `src/lib/dossier-chat-ui.ts`, `docs/features-dossier-and-chat.md` |
| **`F3`** | **Tầng Dữ Kiện Vận Hạn Xác Định (`yunxian-context.ts`)**: Mọi Đại Hạn / Lưu Niên luôn có ngay bảng dữ kiện & luận giải nền không tốn quota AI; kết quả AI dùng formatter chung và được hậu kiểm 4/4 Tứ Hóa. | **ĐÃ THI CÔNG (`1.0.0-stable`)** — `src/lib/ziwei/yunxian-context.ts`, `docs/features-dossier-and-chat.md` |
| **`F4`** | Bộ nhớ đệm theo phiên trình duyệt **`window.sessionStorage` với LRU** (tối đa `5` hồ sơ và `10` mạch chat), giữ quyền riêng tư và chống tràn bộ nhớ. | **ĐÃ THI CÔNG (`1.0.0-stable`) & MỞ RỘNG (`QĐ-H1`)** — `src/lib/dossier-chat-ui.ts:88–376` |
| **`F5`** | **Hỏi Đáp Ngữ Cảnh (`ContextualChatDrawer`)** mở được từ 3 ngữ cảnh (Tổng quan/Cung/Vận hạn, Hợp Bàn, từng chương Hồ Sơ), luôn ghim bảng dữ kiện xác định làm chân đế chống AI bịa sao. | **ĐÃ THI CÔNG (`1.0.0-stable`)** — `ContextualChatDrawer.tsx`, `server.ts:856–950` |
| **`F6`** | Quy chuẩn chia nhóm 12 cung theo đúng 3 cụm cốt lõi/gia đạo/quan hệ-thể chất và hỗ trợ dừng/tạm dừng sau chương hiện tại khi sinh Hồ Sơ tuần tự. | **ĐÃ THI CÔNG (`1.0.0-stable`)** — `DetailedDossierModal.tsx` |
| **`F7`** | Hàng rào bảo vệ quota cho Chat: khóa gửi khi Hồ Sơ đang sinh tuần tự, **`8 giây`** chờ giữa 2 câu, trần mềm **`15` lượt** (nhắc từ lượt 10, mở thêm nấc `5` lượt), chặn độ dài câu hỏi/trích đoạn/lịch sử cả Client lẫn Server. | **ĐÃ THI CÔNG (`1.0.0-stable`)** — `dossier-chat-ui.ts:429–548`, `server.ts:215–218` |

---

## Đợt 3 — Sửa Hồ Sơ V2 & Dọn Meta Kết Xuất (`QĐ-G1` .. `QĐ-G6`)

| Mã QĐ | Tên quyết định & Phương án chốt | Trạng thái & Nơi quy chiếu SSOT |
|---|---|---|
| **`QĐ-G1`** | Tách đôi bộ lọc hậu kiểm: **Lớp 3A** (`sanitizeLayer3AOnly`, mặc định tắt song ngữ) an toàn theo chunk và **Lớp 3B** (`sanitizeAiVietnameseOutput`, `verifyAndEnsureCompletePeriodSiHua`, `enforceCanonicalPalaceGroupHeadings`) chạy trên văn bản đầy đủ. | **ĐÃ THI CÔNG (`1.0.0-stable`)** — `src/lib/ziwei/text-sanitizer.ts`, `docs/features-dossier-and-chat.md` |
| **`QĐ-G2`** | Làm sạch tự động dữ liệu cache cũ trong `sessionStorage` ngay khi đọc (`readDossierCacheEntry`) mà giữ nguyên khóa cache và 0 tốn quota. | **ĐÃ THI CÔNG (`1.0.0-stable`)** — `src/lib/dossier-chat-ui.ts:230–259` |
| **`QĐ-G3`** | Chuẩn hóa tiêu đề cung ở Chương 2–4 kèm nhãn `[AN MỆNH]`, `[AN THÂN]`, `[Đại hạn X–Y tuổi]` với cơ chế bảo vệ chống ghi đè tiêu đề gộp nhiều cung. | **ĐÃ THI CÔNG (`1.0.0-stable`)** — `src/lib/ziwei/text-sanitizer.ts:224–289` |
| **`QĐ-G4`** | Thống nhất đường xuất `.html` / `.md` / PlainText / In trực tiếp dùng chung bộ dựng bảng và bộ lọc văn bản sạch. | **ĐÃ THI CÔNG (`1.0.0-stable`)** — `src/lib/dossier-chat-ui.ts:1805–1997` |
| **`QĐ-G5`** | Nối dây **`origInput`** trong `formToBirthInfo` (`src/lib/ziwei/share.ts:61–67`) để `buildDossierHeaderMetadata` (Header S5) hiển thị chính xác giờ đồng hồ gốc & hiệu chỉnh Chân Thái Dương Thời. | **ĐÃ THI CÔNG (`1.0.0-stable`)** — `src/lib/ziwei/share.ts`, `dossier-chat-ui.ts:969–1090` |
| **`QĐ-G6`** | Bổ sung **`stripInternalExportMetaLines`** xóa các dòng vận hành nội bộ (`Nguồn: ... · Model: ... · Khóa: ...`) khỏi mọi bản kết xuất đưa ra ngoài (`.html`, `.md`, PlainText, sao chép, in trực tiếp). | **ĐÃ THI CÔNG (`1.0.0-stable`)** — `src/lib/dossier-chat-ui.ts:204–225` |

---

## Đợt 4 — Thi Công Sau Rà Soát Toàn Diện (`QĐ-H1` .. `QĐ-H7` — Phương án A)

| Mã QĐ | Nội dung quyết định đã chốt & thi công | Trạng thái & Minh chứng kiểm thử |
|---|---|---|
| **`QĐ-H1`** | Mở rộng `StoredDossierRecord.sections` lưu đủ **8/8 chương** (gồm `year_2026`, `year_2027`) vào `sessionStorage`, đồng bộ 2 chiều với `aiPeriodCache` (không mất khi `F5`), và chạy Lớp 3B cho 2 chương lưu niên trong `sanitizeDossierChapterText`. | **ĐÃ THI CÔNG (`1.1.0-rc.1`, chờ live browser test `H1`)** — `dossier-chat-ui.ts:170–197, 264–303, 750–754`; `DetailedDossierModal.tsx`; `TEST-12` ĐẠT |
| **`QĐ-H2`** | Mở rộng `buildChartIdentityKey` (kèm `nameSlug`, `mingGongBranch`, `leapFlag`, `origSig`, `lonSig`), lọc tin nhắn lỗi thuần túy trước khi lưu chat (`filterPersistableChatMessages`), và dùng `safeParseInt` chống `NaN` URL. | **ĐÃ THI CÔNG (`1.1.0-rc.1`)** — `yunxian-context.ts:292–310`, `dossier-chat-ui.ts:569–587`, `share.ts:13–20, 103–135`; `TEST-13` & `TEST-14` ĐẠT |
| **`QĐ-H3`** | In tường minh khối **Tam Phương Tứ Chính kỳ hạn** (`+4`, `+8`, `+6`) và bảng ánh xạ 12 cung trong `yunxian-context.ts`; in Tam Phương Tứ Chính Mệnh & Cách cục `detectPatterns` trong Chương 1 (`dossier-context.ts`). | **ĐÃ THI CÔNG (`1.1.0-rc.1`)** — `yunxian-context.ts:638–665`, `dossier-context.ts:271–333`; `verify-dossier-context` `6/6` ĐẠT |
| **`QĐ-H4`** | *(Pha 0 thu hẹp — đã chẩn đoán thực nghiệm tại `docs/h4-diagnosis.md`)* Chuyển `AbortError`/`FIRST_CHUNK_TIMEOUT` từ `NETWORK_OR_5XX` sang `MODEL_UNAVAILABLE` trong `allocator.ts:110` (0 phạt khóa); bỏ bơm trùng câu cảnh báo gián đoạn vào `onChunk` tại `executor.ts:364–368, 405–409`. | **ĐÃ THI CÔNG (`1.1.0-rc.1`)** — `docs/h4-diagnosis.md`; `verify-key-pool` `TEST 18` (`18/18`) ĐẠT |
| **`QĐ-H5`** | Chuẩn hóa vòng đọc SSE có `sseBuffer` tại `HemingView.tsx`; sửa `notConfigured` thành `errCode === 'AI_NOT_CONFIGURED'` ở `DetailedDossierModal.tsx` & `InsightPanel.tsx`; khớp điều kiện kinh độ Chân Thái Dương Thời trên Header S5; rút gọn ~688 dòng dư ở `cities.ts`; đặt `express.json({ limit: '512kb' })` trong `server.ts`. | **ĐÃ THI CÔNG (`1.1.0-rc.1`)** — `HemingView.tsx:127–199`, `cities.ts:1–97`, `server.ts:460`, `dossier-chat-ui.ts:997` |
| **`QĐ-H6`** | Giới hạn cửa sổ quét `isPeriodSiHuaMentionedInText` theo ranh giới câu/dòng (`/[.!?\n;|]/`) và bổ sung `VIET_DIACRITIC_LOWER_BEFORE_UPPER_RE` tách nguyên âm tiếng Việt có dấu dính chữ IN HOA mà bảo toàn từ tiếng Anh. | **ĐÃ THI CÔNG (`1.1.0-rc.1`)** — `text-sanitizer.ts:46–47, 130–155`; `TEST-11` & `TEST-14` ĐẠT |
| **`QĐ-H7`** | Giữ nguyên sinh tuần tự `concurrency = 1` cho Hồ Sơ 8 Chương, giảm nhịp nghỉ `DOSSIER_INTER_CHAPTER_PACING_MS` xuống **`1_200 ms` (`1.2 giây`)**. | **ĐÃ THI CÔNG (`1.1.0-rc.1`)** — `src/lib/dossier-chat-ui.ts:652` |

---

## Đợt 5 — Chuẩn Hóa & Quản Trị Hệ Thống Tài Liệu (`QĐ-D1` .. `QĐ-D6` — Phương án A, chốt `17/11/2026`)

| Mã QĐ | Quyết định đã duyệt & thi công | Phạm vi áp dụng |
|---|---|---|
| **`QĐ-D1`** | Tổ chức lại tài liệu theo cấu trúc đích: `/README.md`, `/CHANGELOG.md`, `/VERSION`, `/docs/INDEX.md` + 4 Tài liệu Sống (`architecture-overview.md`, `key-pool-operations.md`, `features-dossier-and-chat.md`, `decisions-registry.md`), giữ 2 báo cáo kiểm toán/chẩn đoán đã cập nhật ở `docs/`, và chuyển toàn bộ tài liệu cũ vào `docs/archive/`. | Toàn bộ `/` và `/docs/` |
| **`QĐ-D2`** | Không xóa tài liệu lịch sử; cô lập 14 file lịch sử/trung gian/kế hoạch cũ vào `docs/archive/` với Banner cảnh báo bắt buộc ở dòng 1. | `docs/archive/*` (`14` file) |
| **`QĐ-D3`** | Phạm vi tài liệu tập trung 100% vào Kỹ thuật, Kiến trúc, Học thuật Tử Vi trong Engine và Vận hành nội bộ (không tạo thêm cẩm nang người dùng cuối riêng). | Toàn bộ bộ tài liệu |
| **`QĐ-D4`** | Áp dụng nghiêm kỷ luật **SSOT & Ngôn ngữ**: tiếng Việt chuẩn xác kèm định danh kỹ thuật trong backtick, cấm ghi cứng số lượng key runtime trong Tài liệu Sống, mọi hằng số chỉ định nghĩa tại 1 Tài liệu Chủ kèm `file:line`. | Tất cả Tài liệu Sống |
| **`QĐ-D5`** | Nâng phiên bản lên **`1.1.0-rc.1`** (phản ánh đủ `QĐ-H1..H7` và 100% test offline; chờ kiểm chứng live `H1` trên trình duyệt mới chốt `1.1.0-stable` + backup mới). Giữ nguyên `backup/v1.0.0-stable/` (`87` file). | `/VERSION`, `/CHANGELOG.md`, `/package.json` |
| **`QĐ-D6`** | Đồng bộ `package.json`: đặt `"name": "tu-vi-thien-ky"`, `"version": "1.1.0-rc.1"`, bổ sung các script `verify:key-pool`, `verify:dossier-context`, `verify:dossier-ui`, `verify:yunxian`, `verify:all` (không đổi dependencies). | `/package.json` |
