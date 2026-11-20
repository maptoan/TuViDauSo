# NHẬT KÝ THAY ĐỔI PHIÊN BẢN (`CHANGELOG.md`)

- **Loại tài liệu**: `[Tài liệu Sống — Nhật ký Phát hành Theo Chuẩn Semantic Versioning]`
- **Trạng thái hiệu lực**: `ĐANG HIỆU LỰC (ACTIVE)`
- **Áp dụng cho phiên bản ứng dụng**: `1.5.0` *(đồng bộ với `/VERSION`)*
- **Cập nhật lần cuối**: `20/11/2026`
- **Mã nguồn đối chiếu (Code SSOT)**: `VERSION`, `package.json`, `server.ts`, `server/key-pool/*`, `server/knowledge-base/*`, `scripts/kb-*.ts`, `scripts/verify-key-pool.ts`, `scripts/verify-knowledge-base.ts`, `src/lib/ziwei/text-sanitizer.ts`, `src/lib/dossier-chat-ui.ts`, `src/components/DetailedDossierModal.tsx`, `src/components/ContextualChatDrawer.tsx`, `src/components/InsightPanel.tsx`
- **Quyết định liên quan**: `QĐ-1..QĐ-6`, `F1–F7`, `QĐ-G1..QĐ-G6`, `QĐ-H1..QĐ-H7`, `QĐ-D1..QĐ-D6`, `QĐ-L1..QĐ-L9`, `ĐC-1..ĐC-6`, `LK-01..LK-10`, `QĐ-M1..QĐ-M6`, `DM-01..DM-13`, `QĐ-N1..QĐ-N8`, `NK-01..NK-12`, `ĐN-1..ĐN-10`, `QĐ-F1..QĐ-F4`, `FS2-01..FS2-07`

> Ghi chú định dạng theo chuẩn **Keep a Changelog** và **Semantic Versioning** (`QĐ-D5-A`). Các tài liệu thiết kế, phản biện và chẩn đoán chi tiết của từng đợt trước đây đã được lưu trữ bất biến trong `docs/archive/`.

---

## [1.5.0] — 20/11/2026

### Phát hành ổn định (Stable Release)
- Phát hành bản ổn định `1.5.0` từ `1.5.0-rc.1`: giữ nguyên hoàn toàn dữ liệu và mã nguồn so với `1.5.0-rc.1`, chỉ cập nhật `VERSION` và `CHANGELOG.md`.
- CSDL Nền Tri Thức `300` mục đã kiểm toán hoàn thiện và đã nạp; kiểm chứng live tầng AI đạt ở model chính `gemini-3.5-flash-lite` (sinh hồ sơ, vận hạn, lưu niên, cơ chế failover giữa các key đều đạt).
- **Ghi chú chân dự phòng**: `gemini-3.8-flash` chưa kiểm chứng live được vì model này không khả dụng ở free tier tại thời điểm kiểm chứng (lỗi `503` phía Google); sẽ kiểm chứng bổ sung khi model khả dụng trở lại.

---

## `[1.5.0-rc.1]` — `20/11/2026` *(Nạp Chu Kỳ 2 Hoàn Tất CSDL Nền Tri Thức 300 Mục — `05-illness` & `07-methodology`)*

### Thay đổi dữ liệu & kiểm định (Changed)
- **Nạp chu kỳ 2 hai tệp `.kb.json` mới vào `server/knowledge-base/data/` (nâng tổng CSDL lên `300` mục đã kiểm toán qua `7` tệp)**:
  - `methodology.kb.json` (`41` mục `NH-METH-001..041`, `07-methodology`, `843.732` byte) và `illness.kb.json` (`21` mục `NH-ILL-001..021`, `05-illness`, `115.074` byte), giữ nguyên bản kiểm toán 100%, không chỉnh sửa retriever (`Phương Án A`).
- **Ngoại lệ sàn độ dài `fullTranslationVi` (`scripts/kb-audit-quality.ts`)**:
  - Thêm `FULL_TRANSLATION_MIN_EXCEPTIONS` cho 4 mục mảnh đơn câu ca quyết Tý Ngọ Lưu Chú (`NH-ILL-004`, `NH-ILL-007`, `NH-ILL-012`, `NH-ILL-013`, dài `15–19` ký tự) nhằm giữ nguyên bản dịch toàn văn trung thành mà không hạ sàn `20` ký tự chung.
- **Mở rộng bộ kiểm thử `scripts/verify-knowledge-base.ts`**:
  - Bổ sung tham số tùy chọn `category` và `scopeTier` cho `makeEntry`, khẳng định loader nạp đủ `7` tệp / `300` mục kèm 2 ca khói ghi điểm trên dữ liệu thật (`palaces_social_health`, `horizon_5y`), bổ sung `6` fixture Tầng 2 (`NH-ILL-014`, `NH-METH-025`, `NH-METH-040`, `NH-ILL-001`, `NH-METH-024`, `NH-METH-001`) và `7` ca kiểm thử `K1-26..32` (gồm ca âm tính `expectAbsent` tại `K1-31` và nâng tổng K1 lên `32/32`).
- **Khóa cứng pipeline Gemini đã ngừng dùng & cập nhật tài liệu schema**:
  - Đổi hàm `main()` cũ trong `scripts/kb-distill.ts` thành `mainDisabled()` và thay `main()` mới ném lỗi dừng ngay theo quyết định ngừng dùng pipeline Gemini (19/11/2026).
  - Cập nhật chú thích mô tả `citationId` trong `server/knowledge-base/types.ts` cho `05-illness` (`NH-ILL-001..021`) và `07-methodology` (`NH-METH-001..041`).

---

## `[1.4.0-rc.5]` — `20/11/2026` *(Nạp Tầng 1 Hoàn Chỉnh Nền Tri Thức — 238 Mục & Trần `summaryVi` Theo Bậc Số Quote)*

### Thay đổi dữ liệu & kiểm định (Changed)
- **Nạp đầy đủ 5 tệp `.kb.json` Tầng 1 vào `server/knowledge-base/data/` (tổng `238` mục đã kiểm toán)**:
  - `stars.kb.json` (`83` mục, `01-stars`), `sihua.kb.json` (`19` mục, `04-sihua` — giữ nguyên bản vá metadata `NH-SIHUA-009` với `sourceRef.timeRangeHms = "Phần 5: 00:06:19; Phần 21: 00:04:22–00:16:37"`), `classics.kb.json` (`75` mục, `classics-fu`), thêm mới `palaces.kb.json` (`41` mục, `02-palaces`) và `patterns.kb.json` (`20` mục, `03-patterns`).
- **Áp dụng trần độ dài `summaryVi` theo bậc số quote (`scripts/kb-audit-quality.ts`)**:
  - `nihai_entry`: `≤6` quotes → `≤450` ký tự; `7–14` quotes → `≤800` ký tự; `15–20` quotes → `≤1100` ký tự; `>20` quotes → `≤1500` ký tự; giữ nguyên `≤350` ký tự cho `classic_verse` và tối thiểu `120` ký tự cho toàn bộ mục. Khai báo rõ 2 ngoại lệ kiểm toán Pilot (`NH-STAR-037` ở `475` ký tự / `2` quotes; `NH-SIHUA-009` ở `511` ký tự / `4` quotes).

---

## `[1.4.0-rc.4]` — `19/11/2026` *(Chuẩn Hóa Metadata Kho Tri Thức & Cập Nhật Ngưỡng Kiểm Toán `summaryVi`)*

### Thay đổi dữ liệu & kiểm định (Changed)
- **Chuẩn hóa metadata 3 tệp `.kb.json` (`server/knowledge-base/data/`)**:
  - Thay lại `stars.kb.json` (`83` mục), `sihua.kb.json` (`19` mục), `classics.kb.json` (`75` mục) với metadata đã chuẩn hóa (`workTitleVi` của `75` mục cổ thư bỏ phần chữ Hán; `patternsVi` loại các tên ngoài `PATTERN_NAME_VI` và đổi `'Vũ Khúc Thất Sát'` thành `'Vũ Khúc Thất Sát (Tướng Tài Cách)'`). Giữ nguyên nguyên văn nội dung `summaryVi`, `fullTranslationVi` và `conditionsVi`.
- **Cập nhật ngưỡng kiểm toán `summaryVi` (`scripts/kb-audit-quality.ts`, `docs/knowledge-base-implementation-notes.md`)**:
  - Nâng giới hạn tối đa `summaryVi` từ `350` lên `800` ký tự (giữ nguyên tối thiểu `120` ký tự; các quy tắc kiểm toán khác giữ nguyên) kèm ghi chú khung độ dài chưng cất thực tế đã duyệt (`≤600` ký tự cho bài giảng, `≤350` ký tự cho cổ thư, cộng ngoại lệ `754` ký tự tại `NH-SIHUA-005` đã đạt kiểm toán NotebookLM `17/17`).

---

## `[1.4.0-rc.3]` — `19/11/2026` *(Nạp Dữ Liệu Tri Thức Thật Pilot 1A — 177 Mục)*

### Thay đổi dữ liệu (Changed)
- **Kho Tri Thức Server (`server/knowledge-base/data/`)**:
  - Thay thế toàn bộ dữ liệu mẫu khởi tạo framework (`9` mục mang cờ mẫu `isSampleData: true` / `qaMeta.sample: true`) bằng dữ liệu tri thức thật **Pilot 1A** gồm **177 mục** đã đạt kiểm toán **NotebookLM `17/17`** ở vòng tiếp quản:
    - `server/knowledge-base/data/stars.kb.json`: `83` mục (`isSampleData: false`, `0` mục mẫu).
    - `server/knowledge-base/data/sihua.kb.json`: `19` mục (`isSampleData: false`, `0` mục mẫu).
    - `server/knowledge-base/data/classics.kb.json`: `75` mục (`isSampleData: false`, `0` mục mẫu).
  - Giữ nguyên `100%` mã nguồn hệ thống (`server/knowledge-base/*.ts`, `server.ts`, `src/*`, `scripts/*`).

---

## `[1.4.0-rc.2]` — `19/11/2026` *(Bản Vá Fast-Sweep Kho Khóa, Khử Lặp Log & Cầu Chì Sinh Hồ Sơ)*

### Sửa lỗi & Cải tiến (Fixed & Improved)
- **`QĐ-F1` + `QĐ-F2` (`FS2-01`, `FS2-02`, `FS2-05`, `FS2-06`) — Fast-Sweep trong `server/key-pool/executor.ts` & `allocator.ts`**:
  - Tách bộ đếm **`fastEliminatedSweeps`** (tăng `1` cho mỗi **lượt gọi API** thất bại trước chunk đầu thuộc nhóm lỗi cố định `{QUOTA_PROJECT_ZERO, QUOTA_DAILY_EXHAUSTED, AUTH_INVALID_KEY}`, trần `MAX_KEYS_IN_POOL = 50` lượt gọi — `FS2-02`, chỉ phân loại theo `category` — `FS2-05`) khỏi bộ đếm **`keyAttemptsUsed`** (giữ trần `MAX_KEY_ATTEMPTS = 5` cho lỗi tạm thời/cấp model). Luôn kiểm tra ngân sách `TOTAL_FAILOVER_TIME_BUDGET_MS = 35_000 ms` trước mỗi lượt gọi (`FS2-04`) và giữ nguyên toàn bộ 4 hằng số trong `server/key-pool/types.ts` (`FS2-06`).
  - Áp dụng điều kiện chuẩn hóa cuối vòng **`executeStream`** theo `FS2-01`: chỉ ném `PoolExhaustedError('AI_POOL_EXHAUSTED')` khi `remainingUsable === 0`, hoặc đã cạn ngân sách `35 giây`, hoặc `lastClassifiedError.category` thuộc 6 nhóm lỗi tài nguyên/kết nối/xác thực; giữ nguyên ném `Error` thường cho `UNKNOWN` (ví dụ lỗi request `400`) khi kho vẫn còn khóa `ready` và chưa hết ngân sách.
  - Cập nhật `collectErrorText` trong `server/key-pool/allocator.ts` cắt bỏ dòng tiêu đề trùng với `${raw.name}: ${raw.message}` ở đầu `raw.stack`, khử hoàn toàn chuỗi nhân đôi `Error: ... | Error: ...`.
- **Vệ sinh Log Runtime (`server.ts`)**:
  - Tại 3 endpoint SSE (`/api/interpret-period`, `/api/interpret-dossier-section`, `/api/interpret-chat`), thay `console.warn(... safeDetail)` trên `stderr` bằng `console.log` gọn một dòng trên `stdout` chỉ mang `clientMessage`, không xuất tiền tố `Error:` hay stack trace ra `stderr`.
- **Phân biệt `error` vs `incomplete` & Cầu chì `run-all` (`src/components/DetailedDossierModal.tsx`, `FS2-03`)**:
  - Khi luồng SSE kết thúc với `streamError` hoặc `wasInterrupted` mà `accumulated.trim()` rỗng (`0` ký tự), đặt trạng thái chương là `'error'` và trả về `'error'` (chỉ đặt `'incomplete'` khi đã có văn bản dở).
  - Bổ sung cầu chì trong `handleRunAllSequential`: dừng ngay (`break`) khi `outcome === 'error'` hoặc `'aborted'`, giữ nguyên trạng thái các chương chưa chạy; chương `'incomplete'` (có chữ dở) vẫn cho phép chạy tiếp.
- **Tài liệu & Kiểm thử (`QĐ-F3`, `QĐ-F4`, `FS2-07`)**:
  - Khởi tạo `docs/fast-sweep-fix-plan.md` và `docs/fast-sweep-claude-review-v2.md`; đồng bộ `docs/INDEX.md`, `docs/decisions-registry.md`, `docs/key-pool-operations.md`. Ghi nhận `FS2-07` (dò quota khi import khóa) nằm ngoài phạm vi đợt này.
  - Mở rộng `scripts/verify-key-pool.ts` với **Bài 19 (`19a–19e`)** (tổng `19/19` bài đạt).

---

## `[1.4.0-rc.1]` — `19/11/2026` *(Đợt Pilot 1A — Nền Tri Thức AI Tử Vi Đẩu Số)*

### Thêm mới (Added)
- **Kiến trúc Kho Tri Thức Server (`/server/knowledge-base/` — `QĐ-N1..QĐ-N8`)**:
  - `server/knowledge-base/types.ts`: Chuẩn hóa schema `DistilledKnowledgeEntry` cấp nhóm chủ đề `(book, h2, h3)` với `citationId` (`NH-STAR-*`, `NH-SIHUA-*`, `CL-CTP-*`), `hanziAnchor.quotes` lưu mảng câu Hán gốc kèm `(bvid, t_hms, sourceLineNumber)`, phân tách `sourceLicense` (`CC-BY-NC-SA-4.0` vs `PUBLIC_DOMAIN_TEXT_WITH_CC_BY_NC_SA_ADAPTATION` theo `NK-12`), và cờ `qaMeta.sample` cho dữ liệu mẫu khởi tạo framework.
  - `server/knowledge-base/loader.ts`: Nạp tĩnh các file `*.kb.json` vào bộ nhớ kèm inverted indices theo Sao, Cung, Địa chi, Cách cục, Tứ Hóa, Chương Hồ Sơ và Chủ đề.
  - `server/knowledge-base/retriever.ts`: Thuật toán truy hồi tất định 100% (`W_combo + W_pattern + W_sihua + W_branch + W_single + W_tier`, phá hòa theo `id`), chia đều quota 4 cung cho Chương 2–4, tuân thủ trần ký tự Bảng 4.2 (`1.500–3.200` ký tự/lượt), nhận diện bẫy Tầng 3 (`out_of_scope`) và kiểm tra `starAbsentInQueriedPalace` xét đủ `Stars(b) ∪ BorrowedStars(b) ∪ Stars(+4/+8/+6)` (`ĐN-8`).
  - `server/knowledge-base/verifier.ts` & `src/lib/ziwei/text-sanitizer.ts`: Hậu kiểm chống bịa 3 lớp (`V1` mã bịa, `V2` viện dẫn không thẻ, `V3` gắn thẻ lệch thực thể sao/cung) theo **Khối Đoạn văn / Bullet Markdown** ($\le 800$ ký tự); gỡ sạch token `[Nguồn: ID_SAI]` bằng `scrubInvalidCitationTags` mà không sửa chữ bên trong câu văn tiếng Việt (`ĐN-6`), đồng thời đính kèm khối `📚 Tư Liệu Học Thuật Tham Chiếu` và `⚠️ Ghi Chú Kiểm Chứng Nguồn Học Thuật`.
  - `server/knowledge-base/data/`: Tạo sẵn 3 file mẫu khởi tạo framework (`stars.kb.json`, `sihua.kb.json`, `classics.kb.json` — đánh dấu `qaMeta.sample: true`) và `LICENSE-CC-BY-NC-SA-4.0.md` (chờ chạy ngoại tuyến `npm run kb:distill` khi nạp `/knowledge-source/` để thay bằng `~162` mục thật).
- **Tích hợp Runtime đúng 3 luồng cốt lõi (`server.ts` & Client SSE — `ĐN-5`, `ĐN-9`)**:
  - Bơm `[TƯ LIỆU HỌC THUẬT ĐỐI CHIẾU]` và hậu kiểm cuối luồng SSE (phát `{ citationAudit }`) cho `/api/interpret-dossier-section`, `/api/interpret-period` (chạy ngay sau `verifyAndEnsureCompletePeriodSiHua`), và `/api/interpret-chat`; giữ nguyên `/api/interpret` và `/api/heming` cho Đợt 1B.
  - Đồng bộ xử lý `citationAudit.scrubbedInvalidIds` ở client trong `DetailedDossierModal.tsx`, `InsightPanel.tsx` và `ContextualChatDrawer.tsx` trước khi lưu cache / SSOT `IndexedDB`.
- **Bộ công cụ Pipeline Ngoại tuyến & Kiểm thử (`scripts/kb-*.ts`, `scripts/verify-knowledge-base.ts`)**:
  - Bổ sung `kb:verify-source`, `kb:group`, `kb:distill` (`@google/genai` JSON `responseSchema`, dò danh sách model ứng viên, khóa cứng từ điển `src/lib/ziwei/vi-i18n.ts`, checkpoint JSONL), `kb:audit`, `kb:export-audit-sheet` (phiếu mẫu phân tầng 25 mục cho NotebookLM).
  - Bổ sung `npm run verify:kb` (tích hợp vào `verify:all`): kiểm chứng nhóm `K1` (`25/25` ca truy hồi tất định), `K2` (`15/15` ca bẫy & `ĐN-8`), `K3` (`24` mẫu `K3-A`/`K3-B`/`K3-C` đạt chuẩn `ĐN-4`), và tích hợp 3 prompt builders.

---

## `[1.3.0-rc.1]` — `18/11/2026` *(Phát hiện Lá số Trùng & Lá số Gần Trùng Khi Lập Lá Số)*

### Thêm mới (Added)
- **`QĐ-M1..QĐ-M6` & `DM-01..DM-13` (Phát hiện trùng 2 nhánh trong Thư Viện Lá Số)**:
  - `src/lib/chart-library.ts`: Bổ sung `detectChartDuplicateInLibrary` (hàm thuần chỉ đọc 100%, không tạo entry, không chạm `updatedAt`), `diffBirthFormsForDuplicateModal` (tách riêng chênh lệch `Nơi sinh` và `Kinh độ thực tế`, ổn định thứ tự đưa các trường có `affectsChartStructure = true` lên đầu), `computeNearMatchSimilarityScore` (`1000 / 300 / 150 / 50 / completedCount * 5`, giới hạn tối đa `5` ứng viên), và `resolveEffectiveDossierSummaryForEntry` (lấy số chương thực thời gian thực kể cả khi IndexedDB vừa nạp xong hoặc mới xóa/tạo chương).
  - Bổ sung nhánh **Trường hợp 1 (`exact_match`)** khi khớp 100% `chartIdentityKey` (`buildChartIdentityKey`): Tự động nạp lại lá số và hồ sơ chuẩn đã lưu, thông báo 2 điểm chạm (banner dưới Quick Summary Bar kèm đếm ngược `15s` tạm dừng khi di chuột/focus/chạm chỉ chạy sau khi hydration kết thúc + thông báo nội tuyến phía trên nút *Lập Lá Số* + cuộn mượt tới banner), giữ nguyên `customAlias`, `notes`, `pinned` và hồ sơ.
  - Bổ sung nhánh **Trường hợp 2 (`near_match`)** qua `src/components/DuplicateChartPromptModal.tsx`: Khớp **Nhánh 1** (`legacyFivePartKey`) hoặc **Nhánh 2 siết chặt** (`DM-05` + `DM-13`: trùng tên/`customAlias` chuẩn hóa khác `'anon'` dài $\ge 2$ ký tự + trùng ngày/tháng/năm Dương lịch + cùng giới tính + có khác giờ/phút/`unknownTime`/kinh độ). Hiển thị cảnh báo **Hổ phách** khi khác cấu trúc 12 cung, nhãn `[Lá số gốc vừa nạp để chỉnh sửa]`, tiêu đề gọn kèm trích đoạn `notes` cho hồ sơ ẩn danh (`anon`), nút động `"Mở lá số cũ đã lưu ({Giờ} · Mệnh {Cung})"` khi khác cấu trúc 12 cung, và nút `"Lập lá số mới theo thông tin vừa nhập"` / `"Quay lại sửa thông tin"`.
  - **`QĐ-M4` (`DM-04`) — Phân biệt nguồn lập (`src/components/BirthForm.tsx`)**: Thêm `source?: 'user_form_submit' | 'famous_preset'` cho `onChartGenerated`; chọn lá số mẫu nổi tiếng chỉ tự động nạp lại âm thầm khi `exact_match`, không bật modal gần trùng.
- **Bảo toàn dữ liệu & Đồng bộ Hydration (`DM-01`, `DM-08`, `QĐ-M3`)**:
  - `initChartLibrary` chạy đồng bộ `migrateLegacyHistoryAndDossiers(currentForm)` ngay khi `hydrationStatus = 'hydrating'` trước khi mở IndexedDB bất đồng bộ.
  - `handleDuplicateChooseExisting` có chốt `Stale Entry Guard` kiểm tra lại `readLibraryIndexStore().entries` phòng trường hợp entry vừa bị xóa trước khi xác nhận, đồng thời bảo đảm **Zero Cross-Key Contamination** (không bao giờ sao chép/trộn chương sang khóa mới).
- **Mở rộng bộ kiểm thử hồi quy (`scripts/verify-chart-library.ts`, `npm run verify:library`)**:
  - Bổ sung `TEST-L18..TEST-L22` kiểm chứng khớp chính xác (`0/8 -> 3/8 -> 2/8`), gần trùng Nhánh 1 & Nhánh 2 (`customAlias`, tách `location`/`longitude`, ưu tiên cấu trúc 12 cung), chấm điểm đa tầng & giới hạn 5, Zero Cross-Chart Contamination + `Stale Entry Guard`, tombstones & kiểm tra thuần trong lúc `IDB gate` đang treo (`22/22` bài đạt).

---

## `[1.2.0-rc.2]` — `18/11/2026` *(Bản Vá Lỗi Rò Dữ Liệu Chéo Chương 5/6 Trong Thư Viện Lá Số)*

### Sửa lỗi & Bảo vệ An toàn Dữ liệu (Fixed & Security)
- **`QĐ-L2` (cập nhật) & `QĐ-L9` (`Phương án A` có Cổng Bảo Vệ Lũy Đẳng — `src/lib/chart-library.ts`)**:
  - Loại bỏ hoàn toàn cơ chế ánh xạ phỏng đoán **Bậc 2** (khóa 5 thành phần `legacyFivePartKey`) và **Bậc 3** (khớp `nameSlug` / `fivePartCount === 1`) trong `migrateLegacyHistoryAndDossiers` — nguyên nhân gốc làm hồ sơ `year_2026` / `year_2027` của người khác bị gắn vĩnh viễn sang lá số mới.
  - Chỉ gắn hồ sơ phiên từ `sessionStorage` khi khớp **100% khóa 9 thành phần (`chartIdentityKey`)** và `rec.chartIdentityKey === chartIdentityKey`; hồ sơ phiên cũ chưa liên kết được giữ nguyên tại `sessionStorage`.
  - Bổ sung kiểm tra `deletedTombstones` khi di trú (không hồi sinh lá số đã xóa vĩnh viễn còn sót trong `ziwei_history`), dọn đồng bộ `ziwei_history` khi xóa `entry_and_dossier`, và bổ sung **Dirty/No-Op Guard** tránh ghi thừa làm trôi `updatedAt`.
  - Bổ sung chốt chặn `LK-10` kiểm tra `parsed.chartIdentityKey === chartIdentityKey` và `val.sectionCacheKey` nội bộ tại `readHotDossierFromLocalStorage`, `getBestKnownDossierSync`, `getDossierReadState`, `sanitizeFullDossierRecord`, và `readDossierCacheEntry`.
- **Chặn rò dữ liệu tầng Resolver & React Lifecycle (`src/lib/dossier-chat-ui.ts`, `src/components/DetailedDossierModal.tsx`, `src/App.tsx`)**:
  - `resolveDossierChapterFromCaches`: Bắt buộc kiểm tra `rawLocal.sectionCacheKey === sectionCacheKey` ở **cả nhánh kỳ hạn (`year_2026`, `year_2027`) lẫn nhánh thường** (`LK-01`).
  - `DetailedDossierModal.tsx` (`LK-06`, `LK-09`): Khi đổi lá số (`isChartChanged`), hủy ngay luồng SSE cũ (`stopAllGeneration()`), xóa `localChapters` về `{}` ngay cả khi `!isHydrated`; khi cùng lá số, bảo vệ chương đang `'loading'` hoặc vừa sinh mới; thêm `open` vào dependency array của `useEffect` nạp hồ sơ.
  - `src/App.tsx` (`LK-09`): Bổ sung `handleRemoveLibraryEntry` xóa đồng bộ các khóa `${targetKey}__` trong `aiPeriodCache` khi người dùng chọn *"Chỉ xóa Hồ Sơ"* hoặc xóa vĩnh viễn.
- **`QĐ-L8` (`Phương án B tăng cường C1+`) — Dọn chủ động có Hoàn tác (`LK-03`, `LK-08`)**:
  - Không tự động xóa ngầm văn bản trùng khi khởi động. Bổ sung `removeSingleDossierChapterFromLibrary` trong `src/lib/chart-library.ts` và nút **"Xóa chương này"** (xác nhận 2 bước tại chỗ + banner **Hoàn tác** trong phiên, đồng bộ `aiPeriodCache`) trong `DetailedDossierModal.tsx`.
- **Mở rộng bộ kiểm thử hồi quy (`scripts/verify-chart-library.ts`, `npm run verify:library`)**:
  - Cập nhật `TEST-L04` (`LK-02`) kiểm chứng cô lập khóa 5 thành phần cũ và bổ sung `TEST-L13..TEST-L17` (`17/17` bài đạt).

---

## `[1.2.0-rc.1]` — `17/11/2026` *(Thư Viện Lá Số & Lưu Trữ Bền Vững 8 Chương Hồ Sơ)*

### Thêm mới (Added)
- **`QĐ-L1`..`QĐ-L7` (Phương án A — Lưu trữ Client 2 tầng & Xuất/Nhập `.JSON` di động)**:
  - `src/lib/chart-library.ts`: Khởi tạo hạt nhân Thư Viện Lá Số (`localStorage` index `'ziwei_chart_library_v1'` tối đa `100` lá số / `30` ghim + `IndexedDB` `'ziwei_thien_ky_library_db_v1'` + gương RAM `inMemoryDossierMirror` + hot cache tối đa 3 hồ sơ). Không mở bất kỳ endpoint/stub đồng bộ server `/api/library/*` nào (loại bỏ hoàn toàn Phương án B theo `QĐ-L1`).
  - Hỗ trợ tên gợi nhớ (`customAlias`, tối đa `80` ký tự) và ghi chú riêng (`notes`, tối đa `2.000` ký tự) mà giữ nguyên bất biến `chartIdentityKey`; di trú lũy đẳng 3 bậc từ `'ziwei_history'` và `'ziwei_dossier_v1::*'` mà giữ nguyên `'ziwei_history'`.
  - Hợp nhất đơn điệu từng chương (`mergeDossierRecords`) kèm sổ cái xóa `deletedTombstones` (chặn hồi sinh ở chế độ `smart_merge`, cho phép khôi phục ở chế độ `force_restore_all`), tìm kiếm không dấu tiếng Việt, lọc và sắp xếp theo nhóm ghim.
- **`ĐC-1`..`ĐC-6` (Điều chỉnh bắt buộc vòng 2)**:
  - `ĐC-1` Cổng nạp dữ liệu (`getDossierReadState`, `hydrationStatus`): phân biệt `'idle'/'hydrating'` với `'ready'/'degraded'`; `DetailedDossierModal.tsx` khóa nút sinh mới cho tới khi `IndexedDB` nạp xong và xếp hàng hợp nhất các bản ghi phát sinh giữa chừng.
  - `ĐC-2` Thu hồi an toàn 4 nấc: nấc 3–4 (hoặc mục có chương hoàn tất) chỉ xóa **sau khi** tự động tải file JSON sao lưu riêng (`sao-luu-tu-dong-*.json`), kèm banner hoàn tác (`undoLastEviction`) trong phiên.
  - `ĐC-3` Nguồn sự thật duy nhất (`SSOT`): `IndexedDB` + `inMemoryDossierMirror` là chuẩn qua cầu nối `registerAuthoritativeDossierBridge` trong `src/lib/dossier-chat-ui.ts`; `'ziwei_dossier_v1::*'` trong `sessionStorage` chỉ là gương ghi-thông (write-through).
  - `ĐC-4` Tự kiểm tra `IndexedDB` lúc khởi động (`isAvailable`); nếu bị chặn, `ChartLibraryModal.tsx` và `DetailedDossierModal.tsx` hiện cảnh báo cố định, chuyển sang chế độ suy giảm `degraded_no_idb` và nhắc xuất `.JSON`.
  - `ĐC-5` `normalizeBirthFormForLibrary` giữ nguyên toàn vẹn `form.name` (không cắt `.slice(0,32)`) và mọi trường ảnh hưởng `buildChartIdentityKey`.
- **Giao diện Thư Viện & Điểm chạm (`src/components/ChartLibraryModal.tsx`, `App.tsx`, `BirthForm.tsx`)**:
  - Nút `Thư Viện (N)` trên Header Zone 3, nút `Ghim / Đã ghim` và badge `Hồ Sơ Chi Tiết (X/8 Chương)` trên Quick Summary Bar, nâng cấp menu `Gần đây` trong `BirthForm.tsx`, tự động đồng bộ Chương 5/6 từ thư viện vào `aiPeriodCache` (`PL-11`), xác nhận xóa 2 bước nội tuyến (không dùng `window.alert`/`window.confirm`).
- **Bộ kiểm thử hồi quy mới (`scripts/verify-chart-library.ts`, `npm run verify:library`)**:
  - Bổ sung `TEST-L01..TEST-L12` kiểm chứng chống trùng tên/nơi sinh/giờ, di trú 3 bậc, SSOT ĐC-3, merge `.JSON`, tombstones, trần 30 ghim & tự động tải backup ĐC-2, `QuotaExceededError`, làm sạch JSON bẩn, cổng hydration chậm ĐC-1 (`TEST-L11`) và chế độ suy giảm ĐC-4 (`TEST-L12`).

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
