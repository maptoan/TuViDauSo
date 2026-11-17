# NHẬT KÝ THAY ĐỔI PHIÊN BẢN (`CHANGELOG.md`)

- **Loại tài liệu**: `[Tài liệu Sống — Nhật ký Phát hành Theo Chuẩn Semantic Versioning]`
- **Trạng thái hiệu lực**: `ĐANG HIỆU LỰC (ACTIVE)`
- **Áp dụng cho phiên bản ứng dụng**: `1.1.0-rc.1` *(đồng bộ với `/VERSION`)*
- **Cập nhật lần cuối**: `17/11/2026`
- **Mã nguồn đối chiếu (Code SSOT)**: `VERSION`, `package.json`, `backup/v1.0.0-stable/BACKUP-MANIFEST.md`
- **Quyết định liên quan**: `QĐ-1..QĐ-6`, `F1–F7`, `QĐ-G1..QĐ-G6`, `QĐ-H1..QĐ-H7`, `QĐ-D1..QĐ-D6`

> Ghi chú định dạng theo chuẩn **Keep a Changelog** và **Semantic Versioning** (`QĐ-D5-A`). Các tài liệu thiết kế, phản biện và chẩn đoán chi tiết của từng đợt trước đây đã được lưu trữ bất biến trong `docs/archive/`.

---

## `[1.1.0-rc.1]` — `17/11/2026` *(Release Candidate 1 — Chờ kiểm chứng live `H1` trên trình duyệt)*

### Thêm mới (Added)
- **`QĐ-H3` (`B-04` + `A-03`)**:
  - `src/lib/ziwei/yunxian-context.ts`: Bổ sung trường cấu trúc `sanFangSiZheng` và in tường minh khối *"Tam Phương Tứ Chính & Điểm Xung Chiếu Của Kỳ Hạn"* (`benGong`, `tamHopTai +4`, `tamHopQuan +8`, `xungChieu +6`) kèm chính/cát/sát tinh, Tứ Hóa kỳ hạn và bảng ánh xạ 12 cung kỳ hạn ↔ Bản Mệnh trong `factTableMarkdown`.
  - `src/lib/ziwei/dossier-context.ts`: Bổ sung khối `[TAM PHƯƠNG TỨ CHÍNH CUNG MỆNH]` và danh sách `[CÁCH CỤC NHẬN DIỆN TỪ ENGINE]` từ `detectPatterns(chart)` vào Chương 1 (`buildNatalOverviewFactSheetVi`).
- **Kiểm thử hồi quy mở rộng**:
  - Bổ sung `TEST 18` trong `scripts/verify-key-pool.ts` (`18/18 ĐẠT`) kiểm chứng phân loại `AbortError`/`FIRST_CHUNK_TIMEOUT` và khử lặp `onInterrupted`.
  - Bổ sung `TEST-11`..`TEST-14` trong `scripts/verify-dossier-chat-ui.ts` (`18/18 ĐẠT`) kiểm chứng Lớp 3B giới hạn ranh giới câu, bảo toàn tên riêng tiếng Anh, lưu/đọc đủ 8 chương trong `sessionStorage`, `buildChartIdentityKey` mở rộng và `searchParamsToForm` chống `NaN`.
  - Mở rộng `scripts/verify-dossier-context.ts` (`6/6 ĐẠT`) xác nhận Tam Phương Tứ Chính và cách cục Chương 1.
- **Chuẩn hóa Hệ thống Tài liệu (`QĐ-D1..QĐ-D6`)**:
  - Khởi tạo `/README.md`, `/CHANGELOG.md`, `/docs/INDEX.md` cùng 4 Tài liệu Sống (`architecture-overview.md`, `key-pool-operations.md`, `features-dossier-and-chat.md`, `decisions-registry.md`).
  - Cách ly toàn bộ 14 tài liệu lịch sử/nháp/phản biện vào `docs/archive/` kèm Banner cảnh báo dòng 1; cập nhật trạng thái & đính chính `B-05` trong `docs/logic-code-audit-v2.md` và `docs/h4-diagnosis.md`.
  - Đồng bộ `/package.json` (`"name": "tu-vi-thien-ky"`, `"version": "1.1.0-rc.1"`, thêm scripts `verify:key-pool`, `verify:dossier-context`, `verify:dossier-ui`, `verify:yunxian`, `verify:all`).

### Thay đổi & Cải thiện (Changed & Fixed)
- **`QĐ-H1` (`F-04` + `C-01`)**:
  - Mở rộng `StoredDossierRecord.sections` trong `src/lib/dossier-chat-ui.ts` để lưu đủ **8/8 chương** (gồm `year_2026` và `year_2027`) vào `window.sessionStorage`, đồng bộ 2 chiều với `aiPeriodCache` trong `src/components/DetailedDossierModal.tsx` khi khởi tạo và sau khi sinh xong Chương 5, 6 (không mất dữ liệu Lưu Niên khi bấm `F5`).
  - Tích hợp Lớp 3B (`verifyAndEnsureCompletePeriodSiHua`) vào `sanitizeDossierChapterText` cho `year_2026` và `year_2027`.
- **`QĐ-H2` (`A-01` + `A-04` + `A-05`)**:
  - Nâng cấp `buildCanonicalChartIdentityKey` (`buildChartIdentityKey`) trong `src/lib/ziwei/yunxian-context.ts` ghép đầy đủ `nameSlug`, `mingGongBranch`, `leapFlag`, `origSig` và `lonSig` để chống va chạm cache giữa các lá số cùng ngày giờ sinh.
  - Bổ sung `filterPersistableChatMessages` (`src/lib/dossier-chat-ui.ts`) loại bỏ tin nhắn lỗi thuần túy trước khi ghi `sessionStorage`; bổ sung `safeParseInt` trong `src/lib/ziwei/share.ts` chống `NaN` từ URL.
- **`QĐ-H4` (`B-05` + `B-01` thu hẹp — đã chẩn đoán tại `docs/h4-diagnosis.md`)**:
  - Chuyển mẫu `AbortError` / `FIRST_CHUNK_TIMEOUT` / `This operation was aborted` / `The operation was aborted` trong `classifyGeminiError` (`server/key-pool/allocator.ts`) sang nhánh `MODEL_UNAVAILABLE` (0 phạt điểm sức khỏe, không khóa cả key).
  - Bỏ gọi `options.onChunk` chèn câu cảnh báo trùng tại 2 nhánh gián đoạn trong `server/key-pool/executor.ts`, chỉ giữ kênh sự kiện cấu trúc `options.onInterrupted`.
- **`QĐ-H5` (`F-01` + `C-02` + `A-02` + `C-05` + `E-03`)**:
  - Nâng cấp vòng đọc SSE trong `src/components/HemingView.tsx` dùng `sseBuffer`, xả phần dư cuối luồng, xử lý `interrupted`/`error`, chạy `sanitizeAiVietnameseOutput`.
  - Sửa điều kiện nhận diện `notConfigured` tại `DetailedDossierModal.tsx` và `InsightPanel.tsx` thành `res.status === 503 && errCode === 'AI_NOT_CONFIGURED'`.
  - Đồng bộ điều kiện hiệu chỉnh Chân Thái Dương Thời trên Header S5 (`src/lib/dossier-chat-ui.ts`) chỉ áp dụng khi `b.origInput && hasValidLongitude`.
  - Tinh gọn `src/lib/ziwei/cities.ts` giữ 63 tỉnh/thành Việt Nam (loại bỏ ~688 dòng tỉnh/thành Trung Quốc không dùng trên client bundle).
  - Đặt `express.json({ limit: '512kb' })` và chuẩn hóa kiểm tra kích thước dữ liệu chat trong `server.ts`.
- **`QĐ-H6` (`B-02` + `B-03`)**:
  - Thu hẹp cửa sổ quét `isPeriodSiHuaMentionedInText` (`src/lib/ziwei/text-sanitizer.ts`) theo ranh giới câu/dòng (`/[.!?\n;|]/`) và bổ sung `VIET_DIACRITIC_LOWER_BEFORE_UPPER_RE` tách nguyên âm có dấu tiếng Việt đứng liền trước chữ IN HOA mà vẫn bảo toàn các từ tiếng Anh dạng CamelCase (`iPhone`, `JavaScript`, `TypeScript`).
- **`QĐ-H7` (`D-01`)**:
  - Giữ nguyên sinh tuần tự `concurrency = 1` cho Hồ Sơ 8 Chương và giảm hằng số nhịp nghỉ `DOSSIER_INTER_CHAPTER_PACING_MS` trong `src/lib/dossier-chat-ui.ts` từ `2_200` xuống `1_200` ms (`1.2 giây`).

---

## `[1.0.0-stable]` — `17/11/2026` *(Đã đóng băng sao lưu tại `backup/v1.0.0-stable/` gồm 87 file)*

### Tổng hợp các cột mốc trước và tại mốc `1.0.0-stable`
- **Kho Khóa Gemini (`QĐ-1..QĐ-6` & Pha B)**: Xây dựng kho lưu trữ khóa mã hóa `AES-256-GCM` tại `.data/gemini-key-pool.enc.json`, bảo vệ PIN qua so sánh hằng thời gian `KEY_POOL_ADMIN_PIN` trên origin chia sẻ (`ais-pre-`), thuật toán chọn khóa theo ngưỡng sức khỏe (`healthScore`, `probeFloorScore = 95`), `modelCooldowns` theo từng cặp `(key, model)`, cơ chế tự nối tiếp stream bị đứt giữa chừng (`buildContinuationPrompt`), ghi nhận `CALL_SUCCESS` / `PROBE_SUCCESS`, và làm mới dữ liệu theo sự kiện trong `KeyPoolModal.tsx`.
- **Bộ 3 Tính Năng Mới (`F1–F7`)**: Triển khai **Hồ Sơ Toàn Diện 8 Chương** (`DetailedDossierModal.tsx`), **Hỏi Đáp Ngữ Cảnh** (`ContextualChatDrawer.tsx` với hàng rào quota `8 giây` + trần mềm `15+5` lượt + bộ nhớ phiên `sessionStorage` LRU), và **Bảng Dữ Kiện Vận Hạn Xác Định** (`yunxian-context.ts`).
- **Đại Tu Hồ Sơ V2 (`QĐ-G1..QĐ-G6`) & Dọn Meta**:
  - `QĐ-G1`: Tách Lớp 3A (`sanitizeLayer3AOnly` cho stream) và Lớp 3B (`sanitizeAiVietnameseOutput`, `verifyAndEnsureCompletePeriodSiHua`, `enforceCanonicalPalaceGroupHeadings`).
  - `QĐ-G2..G4`: Làm sạch tự động cache cũ không tốn quota, xuất `.html` Giấy Cổ + `@media print` + lưới 4×4 (`B2`) + ma trận 5/10 năm (`B3`) + 5 dòng Cốt Tủy (`B6`), đồng bộ `.md` và PlainText.
  - `QĐ-G5`: Nối dây `origInput` trong `src/lib/ziwei/share.ts` (`formToBirthInfo`) để Header S5 hiển thị chính xác giờ đồng hồ gốc và Chân Thái Dương Thời.
  - `QĐ-G6`: Thêm `stripInternalExportMetaLines` loại bỏ dòng vận hành nội bộ (`Nguồn: ... · Model: ... · Khóa: ...`) khỏi toàn bộ bản kết xuất đưa ra ngoài (`.html`, `.md`, PlainText, sao chép, in trực tiếp).
- **Rà soát Toàn diện Trước Nâng Cấp**: Hoàn tất bộ 3 tài liệu `logic-code-audit-v1.md`, `logic-code-audit-panel-review.md`, `logic-code-audit-v2.md` và chụp bản sao lưu `backup/v1.0.0-stable/` (`87` file; đạt `17/17` key-pool, `6/6` dossier-context, `14/14` dossier-chat-ui, quét `dist/` 0 key nguyên văn).
