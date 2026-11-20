# SỔ CÁI QUYẾT ĐỊNH KIẾN TRÚC ĐÃ DUYỆT (`docs/decisions-registry.md`)

- **Loại tài liệu**: `[Tài liệu Sống — SSOT Sổ cái Quyết định Kiến trúc]`
- **Trạng thái hiệu lực**: `ĐANG HIỆU LỰC (ACTIVE)`
- **Áp dụng cho phiên bản ứng dụng**: `1.4.0-rc.2` *(đồng bộ với `/VERSION`)*
- **Cập nhật lần cuối**: `19/11/2026`
- **Mã nguồn đối chiếu (Code SSOT)**: Toàn bộ các thay đổi trong `server/`, `server.ts`, `src/`, `scripts/`, `package.json`, `VERSION`, `docs/`
- **Quyết định liên quan**: `QĐ-1..QĐ-6`, `F1–F7`, `QĐ-G1..QĐ-G6`, `QĐ-H1..QĐ-H7`, `QĐ-D1..QĐ-D6`, `QĐ-L1..QĐ-L9`, `ĐC-1..ĐC-6`, `LK-01..LK-10`, `DM-01..DM-13`, `QĐ-M1..QĐ-M6`, `NK-01..NK-12`, `ĐN-1..ĐN-10`, `QĐ-N1..QĐ-N8`, `QĐ-F1..QĐ-F4`

> Sổ cái này tổng hợp toàn bộ các quyết định kiến trúc đã được Chủ dự án (**Toàn Đỗ**) phê duyệt và triển khai qua 9 giai đoạn phát triển. Thông số chi tiết của từng mảng được dẫn chiếu về Tài liệu Chủ (SSOT) tương ứng.

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

---

## Đợt 6 — Thư Viện Lá Số & Lưu Trữ Bền Vững (`QĐ-L1`..`QĐ-L7` + `ĐC-1`..`ĐC-6` — Phương án A, chốt `17/11/2026`)

| Mã QĐ | Quyết định & Điều chỉnh bắt buộc đã chốt | Trạng thái & Nơi quy chiếu SSOT |
|---|---|---|
| **`QĐ-L1`** | Chọn **Phương án A** (client 2 tầng `localStorage` index + `IndexedDB` + gương RAM SSOT + xuất/nhập `.JSON` di động có hợp nhất đơn điệu từng chương & `deletedTombstones`). **Loại hoàn toàn Phương án B** (trạm trung chuyển server, không tạo stub/móng). | **ĐÃ THI CÔNG (`1.2.0-rc.1`)** — `src/lib/chart-library.ts`, `docs/chart-library-design-plan.md` |
| **`QĐ-L2`** | Chống trùng định danh bằng `buildChartIdentityKey` (9 thành phần, phân biệt tên, nơi sinh, giờ/chưa rõ giờ). *(Cập nhật tại `1.2.0-rc.2`)*: Bỏ hoàn toàn ánh xạ phỏng đoán Bậc 2 (`legacyFivePartKey`) & Bậc 3 (`nameSlug`/`fivePartCount === 1`); `migrateLegacyHistoryAndDossiers` **chỉ khớp exact 9-part `chartIdentityKey`**, giữ nguyên `ziwei_history` và giữ hồ sơ phiên cũ chưa liên kết trong `sessionStorage`. | **ĐÃ THI CÔNG (`1.2.0-rc.2`)** — `src/lib/chart-library.ts:1244–1400`; `TEST-L01..L04, L13..L14` ĐẠT |
| **`QĐ-L3`** | Trần **100 lá số**, tối đa **30 lá số ghim**, hot cache tối đa **3 hồ sơ**, tự xả hot dossiers khi gặp `QuotaExceededError` (`PL-08`), thang thu hồi **4 nấc**. | **ĐÃ THI CÔNG (`1.2.0-rc.1`)** — `src/lib/chart-library.ts:41–45, 713–758, 922–1113`; `TEST-L08..L09` ĐẠT |
| **`QĐ-L4`** | Bất biến `form.name` & `chartIdentityKey` khi đổi tên gợi nhớ (`customAlias`) hoặc ghi chú (`notes`); sửa dữ kiện gốc đi qua nút *"Nạp dữ kiện lên Form để sửa & lập lá số mới"*. | **ĐÃ THI CÔNG (`1.2.0-rc.1`)** — `src/lib/chart-library.ts:1771–1802`, `ChartLibraryModal.tsx`; `TEST-L05` ĐẠT |
| **`QĐ-L5`** | Phạm vi UI `1.2.0-rc.1` gồm Thư Viện MVP (tìm kiếm không dấu, lọc, sắp xếp, ghim, sửa alias/ghi chú, xem tiến độ 8 chương, xuất/nhập `.JSON`) + nút Header/Summary Bar/`BirthForm`. Không gộp `HemingView` hay `tags[]`. | **ĐÃ THI CÔNG (`1.2.0-rc.1`)** — `src/components/ChartLibraryModal.tsx`, `src/App.tsx`, `src/components/BirthForm.tsx` |
| **`QĐ-L6`** | Xác nhận xóa **2 bước nội tuyến** (tách `dossier_only` và `entry_and_dossier`), cấm `window.alert`/`window.confirm`. | **ĐÃ THI CÔNG (`1.2.0-rc.1`)** — `src/components/ChartLibraryModal.tsx` |
| **`QĐ-L7`** | Không mở endpoint `/api/library/*`; giữ nguyên `express.json({ limit: '512kb' })` trong `server.ts`. | **ĐÃ THI CÔNG (`1.2.0-rc.1`)** — `server.ts:460` |
| **`ĐC-1`** | **Cổng nạp dữ liệu (Hydration Gate)**: `getDossierReadState` phân biệt `'idle'/'hydrating'` với `'ready'/'degraded'`; `DetailedDossierModal.tsx` báo đang nạp, khóa sinh mới và xếp hàng hợp nhất ghi trong lúc IDB mở chậm. | **ĐÃ THI CÔNG (`1.2.0-rc.1`)** — `src/lib/chart-library.ts:1408–1550, 1859–1912`, `DetailedDossierModal.tsx`; `TEST-L11` ĐẠT |
| **`ĐC-2`** | **Thu hồi an toàn**: Nấc 3–4 (hoặc mục có chương hoàn tất) chỉ được xóa SAU KHI tự động tải xuống file `sao-luu-tu-dong-*.json` (`entry + dossier`), kèm banner + hoàn tác trong phiên (`undoLastEviction`). | **ĐÃ THI CÔNG (`1.2.0-rc.1`)** — `src/lib/chart-library.ts:985–1113, 1568–1603`, `ChartLibraryModal.tsx`; `TEST-L08` ĐẠT |
| **`ĐC-3`** | **Nguồn Sự Thật Duy Nhất (SSOT)**: `IndexedDB` + `inMemoryDossierMirror` là chuẩn qua cầu nối `registerAuthoritativeDossierBridge`; `sessionStorage['ziwei_dossier_v1::*']` chỉ là gương ghi-thông (lệch thì SSOT thắng). | **ĐÃ THI CÔNG (`1.2.0-rc.1`)** — `src/lib/dossier-chat-ui.ts:227–355`, `src/lib/chart-library.ts:371–377, 1981–1998`; `TEST-L05` ĐẠT |
| **`ĐC-4`** | **IndexedDB bị chặn**: Feature-detect khi khởi động; chuyển sang chế độ suy giảm `degraded_no_idb` (hot cache 3 + session), hiện cảnh báo cố định ở `ChartLibraryModal.tsx` & `DetailedDossierModal.tsx` nhắc xuất `.JSON`. | **ĐÃ THI CÔNG (`1.2.0-rc.1`)** — `src/lib/chart-library.ts:269–290, 1423–1450`; `TEST-L12` ĐẠT |
| **`ĐC-5`** | **Chuẩn hóa không đổi danh tính**: `normalizeBirthFormForLibrary` bỏ `.slice(0,32)` và không sửa bất kỳ trường nào làm lệch `buildChartIdentityKey` so với `generateChart(formToBirthInfo(form))`. | **ĐÃ THI CÔNG (`1.2.0-rc.1`)** — `src/lib/chart-library.ts:462–469`; `TEST-L01` ĐẠT |
| **`ĐC-6`** | **Phiên bản & Tài liệu**: `VERSION = '1.2.0-rc.2'` (`1.2.0-rc.1` ở đợt trước), `package.json` `"version": "1.2.0"`, cập nhật `CHANGELOG.md`, `INDEX.md`, `features-dossier-and-chat.md`, `decisions-registry.md`, kèm biên bản & ghi chú nghiệm thu. Không tạo `backup/` mới đợt này. | **ĐÃ THI CÔNG (`1.2.0-rc.2`)** — `/VERSION`, `/package.json`, `/CHANGELOG.md`, `docs/*` |
| **`QĐ-L8`** | **Xử lý dữ liệu đã nhiễm theo Phương án B tăng cường (`C1+`)**: Cấm tự động xóa ngầm văn bản trùng khi khởi động (`LK-03`). Cung cấp 2 công cụ dọn chủ động an toàn: (i) *"Chỉ xóa Hồ Sơ"* (`deleteMode: 'dossier_only'`) trong `ChartLibraryModal.tsx` đã vá xóa đồng bộ `aiPeriodCache` & làm mới `localChapters` (`LK-09`); (ii) `removeSingleDossierChapterFromLibrary` + nút *"Xóa chương này"* ngay trong `DetailedDossierModal.tsx` kèm xác nhận 2 bước tại chỗ và **Hoàn tác trong phiên** (`LK-08`). | **ĐÃ THI CÔNG (`1.2.0-rc.2`)** — `src/lib/chart-library.ts`, `src/components/DetailedDossierModal.tsx`, `src/App.tsx`; `TEST-L17` ĐẠT |
| **`QĐ-L9`** | **Cơ chế chạy `migrateLegacyHistoryAndDossiers` (Phương án A có Cổng Bảo Vệ Lũy Đẳng)**: Giữ cơ chế quét khi khởi tạo nhưng chỉ khớp exact 9-part `chartIdentityKey`, kiểm tra `deletedTombstones` để không hồi sinh lá số đã xóa vĩnh viễn còn sót trong `ziwei_history` (đồng thời lọc bỏ khỏi `ziwei_history` khi xóa `entry_and_dossier`), và áp dụng **Dirty/No-Op Guard** chỉ ghi xuống storage khi thực sự có mục/chương mới (`LK-05`). | **ĐÃ THI CÔNG (`1.2.0-rc.2`)** — `src/lib/chart-library.ts:1244–1400, 1873–1955`; `TEST-L03, L04, L17` ĐẠT |

---

## Đợt 7 — Phát Hiện Lá Số Trùng Khi Lập Lá Số (`QĐ-M1`..`QĐ-M6` + `DM-01`..`DM-13` — Chốt ngày `18/11/2026`)

| Mã QĐ | Quyết định đã duyệt & chốt thi công | Trạng thái & Nơi quy chiếu SSOT |
|---|---|---|
| **`QĐ-M1`** | **Phương án A (Trường hợp 1 `exact_match`)**: Chỉ hiện thông báo + tự động tái tạo & nạp lại lá số (`savedChart = buildChartFromForm(existingEntry.form)`) cùng hồ sơ đã lưu (`DM-02`), **KHÔNG** đặt nút xóa hồ sơ / lập lại từ đầu trên banner để tránh mất dữ liệu oan. | **ĐÃ THI CÔNG (`1.3.0-rc.1`)** — `src/App.tsx`, `src/lib/chart-library.ts`; `TEST-L18` ĐẠT |
| **`QĐ-M2`** | **Phương án B siết chặt (`DM-05`, `DM-13`)**: Kết hợp **Nhánh 1** (trùng tiền tố 5 thành phần `legacyFivePartKey`) và **Nhánh 2** (trùng tên hoặc `customAlias` chuẩn hóa khác `'anon'` độ dài $\ge 2$ + cùng ngày/tháng/năm Dương lịch + cùng giới tính + lệch giờ/phút/`unknownTime`/kinh độ). Tách riêng `location` và `longitude`; đẩy diff `affectsChartStructure` lên đầu bảng kèm cảnh báo Hổ phách và nhãn nút động `"Mở lá số cũ đã lưu ({Giờ} · Mệnh {Cung})"`; định danh ẩn danh kèm trích 80 ký tự ghi chú; gắn nhãn `[Lá số gốc vừa nạp để chỉnh sửa]` khi đi từ `onLoadIntoFormToEditNew`. | **ĐÃ THI CÔNG (`1.3.0-rc.1`)** — `src/lib/chart-library.ts`, `src/components/DuplicateChartPromptModal.tsx`; `TEST-L19, L20, L21` ĐẠT |
| **`QĐ-M3`** | **Phương án A chuẩn hóa (`DM-01`, `DM-11`)**: Gọi đồng bộ `migrateLegacyHistoryAndDossiers(currentForm)` ngay đầu `initChartLibrary` (trước IIFE `async` chờ `IndexedDB`); giữ `detectChartDuplicateInLibrary` thuần khiết 100% (chỉ đọc); dùng `resolveEffectiveDossierSummaryForEntry` cho cả `exact_match` và `near_match`; hiển thị *"Đang đồng bộ từ IndexedDB..."* theo `ĐC-1` khi `completedCount === 0 && hydrationStatus === 'hydrating'`. | **ĐÃ THI CÔNG (`1.3.0-rc.1`)** — `src/lib/chart-library.ts`; `TEST-L18, L22` ĐẠT |
| **`QĐ-M4`** | **Phương án A (`DM-04`)**: Mở rộng `onChartGenerated` trong `BirthForm.tsx` với tham số `source?: 'user_form_submit' | 'famous_preset'` (`handleSubmit` truyền `'user_form_submit'`, `handleFamousLoad` truyền `'famous_preset'`). Nguồn `famous_preset` (gồm cả tab Danh nhân `handleFamousSelect`) chỉ nạp êm khi `exact_match`, không bật `DuplicateChartPromptModal`. | **ĐÃ THI CÔNG (`1.3.0-rc.1`)** — `src/components/BirthForm.tsx`, `src/App.tsx` |
| **`QĐ-M5`** | **Phương án A mở rộng (`DM-07`, `DM-12`)**: Luôn hiện thông báo Trường hợp 1 với **phản hồi kép** (banner dưới Quick Summary Bar + hộp thông báo nội tuyến ngay trên nút submit trong `BirthForm.tsx` + cuộn mượt lên banner); phân biệt câu chữ `isAlreadyActiveOnBoard`; banner tự ẩn sau `15 giây`, tạm dừng khi `hover`/`focus`/`touch`, và chỉ đếm sau khi hydration `'ready'`/`'degraded'`. | **ĐÃ THI CÔNG (`1.3.0-rc.1`)** — `src/App.tsx`, `src/components/BirthForm.tsx` |
| **`QĐ-M6`** | **Phương án A (`DM-10`)**: Nâng `/VERSION` lên **`1.3.0-rc.1`** và nâng `package.json` `"version"` lên **`"1.3.0"`**; đồng bộ `CHANGELOG.md`, Tài liệu Sống và biên bản nghiệm thu. | **ĐÃ THI CÔNG (`1.3.0-rc.1`)** — `/VERSION`, `/package.json`, `/CHANGELOG.md`, `docs/*` |

---

## Đợt 8 — Nền Tri Thức AI Tử Vi Đẩu Số — Đợt Pilot 1A (`QĐ-N1`..`QĐ-N8` + `NK-01`..`NK-12` + `ĐN-1`..`ĐN-10` — Chốt ngày `19/11/2026`)

| Mã QĐ | Quyết định đã duyệt & chốt thi công | Trạng thái & Nơi quy chiếu SSOT |
|---|---|---|
| **`QĐ-N1`** | **Nạp kho nguồn & cổng kiểm tra toàn vẹn `kb:verify-source` (Phương án A — hiệu chỉnh số đo `[B]`)**: Sẵn sàng kiểm tra `entries.jsonl` (`1.848` dòng, `134.435` ký tự `quote`, trung vị `61`, max `353`, `68` cặp `(book, h2)`, `208` nhóm `h3`, `138` nhóm Tầng 1), `tianji-ziwei/` (`16` file `.md`, `342.785` ký tự, `150.726` Hán, `~685.749` byte), `classics/`, và `MANIFEST.sha256.json`; bỏ qua an toàn khi `/knowledge-source/` chưa được nạp trong workspace. | **ĐÃ THI CÔNG (`1.4.0-rc.1`)** — `scripts/kb-verify-source.ts` |
| **`QĐ-N2`** | **Đơn vị chưng cất cấp nhóm `(book, h2, h3)` + Kéo ngữ cảnh bài giảng `(bvid, t_hms)` + Tách tiểu mục có điều kiện cho `02-palaces` (`ĐN-1`, `ĐN-2`, `NK-11`)**: Hợp nhất `quote` theo `(part ASC, t_hms ASC)`, tìm đoạn bài giảng $\pm 550$ ký tự làm ngữ cảnh bổ trợ khi chưng cất, tách `02-palaces` có $> 12$ quote theo sao/`section`, và neo cứng `hanziAnchor.quotes` vào nguyên văn `entries.jsonl`/cổ thư. | **ĐÃ THI CÔNG (`1.4.0-rc.1`)** — `scripts/kb-group-entries.ts`, `server/knowledge-base/types.ts` |
| **`QĐ-N3`** | **Pipeline chưng cất ngoại tuyến (`Offline Local Build-and-Commit`) (`ĐN-3`)**: `scripts/kb-distill.ts` dùng `@google/genai` JSON `responseSchema`, dò danh sách model ứng viên (`KB_DISTILL_MODEL` / `gemini-2.5-pro` / `gemini-3.8-flash`...), khóa cứng từ điển `src/lib/ziwei/vi-i18n.ts`, ghi checkpoint JSONL tại `server/knowledge-base/checkpoints/distill-progress.jsonl`; tạo sẵn 3 file mẫu khung (`sample: true`) tại `server/knowledge-base/data/*.kb.json`. | **ĐÃ THI CÔNG (`1.4.0-rc.1`)** — `scripts/kb-distill.ts`, `scripts/kb-audit-quality.ts`, `server/knowledge-base/data/*` |
| **`QĐ-N4`** | **Thẻ nguồn cấp nhóm & Khối Tham Chiếu Cuối Bài (`ĐN-10`)**: Giữ mã thẻ ngắn `[Nguồn: NH-STAR-001]` / `[Nguồn: NH-SIHUA-001]` / `[Nguồn: CL-CTP-001]` trong thân bài và tự động nối khối `> 📚 **[Tư Liệu Học Thuật Tham Chiếu Trong Chương]**` (hoặc chân trang Chat) kèm `workTitleVi`, `groupTitleVi`, `bvid`, `timeRangeHms`. | **ĐÃ THI CÔNG (`1.4.0-rc.1`)** — `server/knowledge-base/verifier.ts` |
| **`QĐ-N5`** | **Hậu kiểm chống bịa 3 lớp theo Khối Đoạn văn / Bullet & Không sửa chữ trong câu (`ĐN-4`, `ĐN-5`, `ĐN-6`)**: Kiểm tra `V1/V2/V3` theo đoạn/bullet ($\le 800$ ký tự); gỡ token thẻ sai `V1/V3` qua `scrubInvalidCitationTags` mà giữ nguyên ngữ pháp câu văn và nối hộp `⚠️ [Ghi Chú Kiểm Chứng Nguồn Học Thuật]`; chạy cuối luồng SSE trước `[DONE]` ở cả 3 luồng và gỡ lại ở client qua `{ citationAudit }`. | **ĐÃ THI CÔNG (`1.4.0-rc.1`)** — `server/knowledge-base/verifier.ts`, `src/lib/ziwei/text-sanitizer.ts`, `server.ts`, `verify:kb` `K3` ĐẠT |
| **`QĐ-N6`** | **Truy hồi tất định, Ngân sách Bảng 4.2 & Quy tắc `ĐN-8`**: Chấm điểm tất định (`1000/850/700/300/250/50`), chia đều quota 4 cung cho Chương 2–4, áp trần `1.500–3.200` ký tự/lượt; Chat áp dụng Best-Effort + từ điển ~45 từ khóa 12 cung, và cờ `starAbsentInQueriedPalace = true` chỉ bật khi sao vắng mặt ở cả `Stars(b) ∪ BorrowedStars(b) ∪ Stars(+4/+8/+6)`. | **ĐÃ THI CÔNG (`1.4.0-rc.1`)** — `server/knowledge-base/retriever.ts`; `verify:kb` `K1` (`25/25`) & `K2` (`15/15`) ĐẠT |
| **`QĐ-N7`** | **Loại hoàn toàn Tầng 3 khỏi runtime & Phân tách `sourceLicense` (`NK-12`)**: Loại `08-yili`, `10-divination`, `11-fengshui` và phát hiện bẫy phong thủy/bói dịch/đơn thuốc Đông y (`out_of_scope`); gắn riêng `CC-BY-NC-SA-4.0` vs `PUBLIC_DOMAIN_TEXT_WITH_CC_BY_NC_SA_ADAPTATION` kèm file `LICENSE-CC-BY-NC-SA-4.0.md`. | **ĐÃ THI CÔNG (`1.4.0-rc.1`)** — `server/knowledge-base/retriever.ts`, `scripts/kb-group-entries.ts`, `server/knowledge-base/data/LICENSE-CC-BY-NC-SA-4.0.md` |
| **`QĐ-N8`** | **Phạm vi Pilot 1A tích hợp 3 luồng chính & Phiên bản `1.4.0-rc.1` (`ĐN-7`, `ĐN-9`, `ĐN-10`)**: Chỉ tích hợp KB vào `/api/interpret-dossier-section`, `/api/interpret-period`, `/api/interpret-chat` (hoãn `/api/interpret` và `/api/heming` sang Đợt 1B); cung cấp `scripts/kb-export-audit-sheet.ts` xuất phiếu mẫu phân tầng 25 mục cho NotebookLM; nâng `VERSION = '1.4.0-rc.1'`, `package.json = "1.4.0"`. | **ĐÃ THI CÔNG (`1.4.0-rc.1`)** — `server.ts`, `scripts/kb-export-audit-sheet.ts`, `scripts/verify-knowledge-base.ts`, `/VERSION`, `/package.json` |

---

## Đợt 9 — Bản Vá Fast-Sweep Kho Khóa, Khử Lặp Log & Cầu Chì Sinh Hồ Sơ (`QĐ-F1`..`QĐ-F4` + `FS2-01`..`FS2-07` — Chốt ngày `19/11/2026`)

| Mã QĐ | Quyết định đã duyệt & chốt thi công | Trạng thái & Nơi quy chiếu SSOT |
|---|---|---|
| **`QĐ-F1`** | **Fast-Sweep có siết chặt `FS2-01`, `FS2-02`, `FS2-03`, `FS2-05`**: Tách bộ đếm `fastEliminatedSweeps` (đếm theo **lượt gọi API** gặp 3 lỗi cố định `{QUOTA_PROJECT_ZERO, QUOTA_DAILY_EXHAUSTED, AUTH_INVALID_KEY}` khi `!attemptSentAnyChunk`, phân loại chỉ theo `category`, trần `MAX_KEYS_IN_POOL = 50` trong ngân sách `35.000 ms`) tách khỏi `MAX_KEY_ATTEMPTS = 5`; chuẩn hóa cuối hàm `executeStream` thành `PoolExhaustedError` theo điều kiện `FS2-01` (giữ `Error` thường cho `UNKNOWN` khi còn khóa `ready` và chưa hết 35s); khử trùng `raw.stack` trong `collectErrorText`; chuyển log lỗi KeyPool tại 3 endpoint SSE sang `console.log` gọn trên `stdout`; sửa `DetailedDossierModal.tsx` trả `'error'` khi `accumulated` rỗng và ngắt chuỗi `handleRunAllSequential` khi `'error'`/`'aborted'` (`FS2-03`). | **ĐÃ THI CÔNG (`1.4.0-rc.2`)** — `server/key-pool/executor.ts`, `server/key-pool/allocator.ts`, `server.ts`, `src/components/DetailedDossierModal.tsx` |
| **`QĐ-F2`** | **Gỡ ràng buộc tạm thời cho `executor.ts` & `allocator.ts` (`FS2-06`)**: Cho phép sửa 2 tệp điều phối trên nhưng giữ nguyên tuyệt đối 4 hằng số trong `server/key-pool/types.ts` (`MAX_KEY_ATTEMPTS = 5`, `TOTAL_FAILOVER_TIME_BUDGET_MS = 35_000`, `FIRST_CHUNK_TIMEOUT_MS = 12_000`, `MAX_KEYS_IN_POOL = 50`) và vùng bất biến engine/KB. | **ĐÃ THI CÔNG (`1.4.0-rc.2`)** — `server/key-pool/types.ts` (bất biến) |
| **`QĐ-F3`** | **Ghi tài liệu kế hoạch/phản biện trước khi sửa code & Đóng gói `1.4.0-rc.2`**: Lập `docs/fast-sweep-fix-plan.md` và `docs/fast-sweep-claude-review-v2.md`, cập nhật `docs/INDEX.md`, `/VERSION` (`1.4.0-rc.2`), `/CHANGELOG.md`, `docs/decisions-registry.md`, `docs/key-pool-operations.md`. *(Ghi nhận `FS2-07` ngoài phạm vi đợt này).* | **ĐÃ THI CÔNG (`1.4.0-rc.2`)** — `docs/*`, `/VERSION`, `/CHANGELOG.md` |
| **`QĐ-F4`** | **Cổng nghiệm thu `Bài 19 (19a–19e)` + `verify:all`**: Bao phủ 8 khóa `quota=0` trước khóa sống, cả kho `quota=0`, `FS2-01` (`UNKNOWN` giữ `Error` thường), `FS2-02` (2 khóa cùng project dọn trong 1 lượt), `FS2-04` (khóa chậm dừng đúng trần 35s), cùng toàn bộ bộ kiểm thử `verify:all`, `lint`, `build`. | **ĐÃ THI CÔNG (`1.4.0-rc.2`)** — `scripts/verify-key-pool.ts` (`19/19`) |



