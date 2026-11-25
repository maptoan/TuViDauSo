# NHẬT KÝ THAY ĐỔI PHIÊN BẢN (`CHANGELOG.md`)

- **Loại tài liệu**: `[Tài liệu Sống — Nhật ký Phát hành Theo Chuẩn Semantic Versioning]`
- **Trạng thái hiệu lực**: `ĐANG HIỆU LỰC (ACTIVE)`
- **Áp dụng cho phiên bản ứng dụng**: `1.5.5` *(đồng bộ với `/VERSION`)*
- **Cập nhật lần cuối**: `25/11/2026`
- **Mã nguồn đối chiếu (Code SSOT)**: `VERSION`, `package.json`, `server.ts`, `server/key-pool/*`, `server/knowledge-base/*`, `src/lib/ziwei/dossier-context.ts`, `src/lib/ziwei/yunxian-context.ts`, `scripts/kb-*.ts`, `scripts/verify-key-pool.ts`, `scripts/verify-knowledge-base.ts`, `scripts/verify-dossier-context.ts`, `scripts/verify-yunxian.ts`, `src/lib/ziwei/text-sanitizer.ts`, `src/lib/dossier-chat-ui.ts`, `src/lib/key-pool-ui.ts`, `src/components/KeyPoolModal.tsx`, `src/components/DetailedDossierModal.tsx`, `src/components/ContextualChatDrawer.tsx`, `src/components/InsightPanel.tsx`
- **Quyết định liên quan**: `QĐ-1..QĐ-6`, `F1–F7`, `QĐ-G1..QĐ-G6`, `QĐ-H1..QĐ-H7`, `QĐ-D1..QĐ-D6`, `QĐ-L1..QĐ-L9`, `ĐC-1..ĐC-6`, `LK-01..LK-10`, `QĐ-M1..QĐ-M6`, `DM-01..DM-13`, `QĐ-N1..QĐ-N8`, `NK-01..NK-12`, `ĐN-1..ĐN-10`, `QĐ-F1..QĐ-F4`, `FS2-01..FS2-07`, `ĐK-151-01..ĐK-151-18`, `ĐK-152-01..ĐK-152-12`, `BRIEF-1.5.3`, `BRIEF-1.5.4` (`ĐK-154-01..06`), `BRIEF-1.5.5-v2` (`ĐK-155-01..06`, `ĐK-155-P1..P10`)

> Ghi chú định dạng theo chuẩn **Keep a Changelog** và **Semantic Versioning** (`QĐ-D5-A`). Các tài liệu thiết kế, phản biện và chẩn đoán chi tiết của từng đợt trước đây đã được lưu trữ bất biến trong `docs/archive/`.

---

## [1.5.5] — 25/11/2026

### Khắc Phục 20 Lỗi Hồ Sơ (`BRIEF 1.5.5 v2` — Nhóm X / Nhóm Y / Nhóm Z)
- **Nhóm X — Chặn rò rỉ trích dẫn học thuật (`server.ts`, `server/knowledge-base/verifier.ts`, `src/lib/ziwei/text-sanitizer.ts`)**:
  - **X1**: Gỡ tên file `.ts` khỏi 3 tiêu đề mục trích đoạn trong `buildStrictPeriodAiPrompt` (`[Cách cục nhận diện từ lá số]:`, `[Tính chất tinh diệu]:`, `[Nguyên lý Tứ Hóa & Tinh hệ]:`).
  - **X2 (`P1–P3`)**: Mở rộng `CITATION_TAG_M3_REGEX` và `CITATION_TAG_SCAN_RE` thành `/\[Nguồn:\s*([^\]]*)\]/giu`; thêm parser dùng chung `parseCitationTagInner` (cắt hậu tố chú thích sau `·`/`|` trước khi tách ID theo `,`/`;`/`/`, chuẩn hóa `.trim().toUpperCase()`, kiểm `^[A-Z0-9_-]{4,24}$`, bắt thẻ rỗng/dấu phân cách là V1 và scrub sạch). Đồng bộ `scrubInvalidCitationTags` phía client để tách thẻ đa ID thành thẻ đơn `[Nguồn: ID1] [Nguồn: ID2]`.
  - **X3**: Loại khỏi `validCitationIds` / `usedValidEntries` / mục tài liệu tham chiếu mọi ID nằm trong `scrubbedInvalidIds` để danh mục tham chiếu khớp 100% với thân bài sau scrub.
- **Nhóm Y — Sửa định dạng gây hiểu sai (`src/lib/ziwei/yunxian-context.ts`, `src/lib/ziwei/dossier-context.ts`, `server.ts`)**:
  - **Y1 (`P4`)**: Di chuyển `[Bản mệnh Hóa X]` lên ngay sau `[Độ sáng]` bên trong cụm in đậm đầu dòng của `formatPeriodSiHuaFactLine`, giữ nguyên `${layerTag} ${prefix}` và cụm đối cung xung chiếu.
  - **Y2 (`P5`)**: Bổ sung `Kích hoạt cung Bản Mệnh gốc {Tên} ({Can Chi}) — nơi Cung Lưu Mệnh Cung tọa thủ` cho `periodTitleVi` nhánh Lưu Niên (giữ nguyên nhánh Đại Hạn) và hậu tố `— nơi Cung ${prefix} Mệnh Cung tọa thủ` trên dòng `Cung bản mệnh được kích hoạt`.
  - **Y3**: Đổi nhãn `• **Bộ Kình Đà (Dương Đà giáp Lộc)**:` thành `• **Bộ Kình Đà lưu niên (kẹp hai bên cung Lưu Lộc Tồn)**:`.
  - **Y4**: Ánh xạ `pat.level` sang tiếng Việt (`Thượng cách`, `Cát cách`, `Trung bình`, `Hung cách`) trong `buildNatalOverviewFactSheetVi`.
  - **Y5**: Chuẩn hóa tiêu đề cung Mệnh trong `formatCanonicalPalaceHeading` thành `### Cung Mệnh ({Can Chi}) {badges}` thay vì `### Cung Mệnh Cung`.
  - **Y6 (`P6`, `P7`)**: Trong `detailLines` của `buildMultiYearHorizonContext`, cập nhật nhãn Đại Hạn sang chuẩn `[Tứ Hóa Đại Hạn HIỆN TẠI ...]` / `[Tứ Hóa Đại Hạn Kỳ ...]`, cập nhật `periodCtxLabelDynStars` sang đủ Can Chi `({TênCung} - {Can Chi})`, gắn chú thích năm Lưu Mệnh trùng Mệnh gốc tại `chart.mingGongBranch`, và bổ sung quy tắc bắt buộc mẫu đối cung xung chiếu `(xung Cung Lưu ...)` vào prompt horizon. Giữ nguyên `dynamicStarsSummaryVi` dạng chi-only và `compactMatrixMarkdown` để bảo vệ trần bảng chat `<= 13,100` ký tự; trần mới `horizon_5y <= 14,200`, `horizon_10y <= 37,800`.
- **Nhóm Z — Prompt & Sanitizer (`server.ts`, `src/lib/ziwei/text-sanitizer.ts`, `server/knowledge-base/verifier.ts`)**:
  - **Z1**: Bắt buộc phân tích dòng `[Tứ Hóa Đại Hạn Kỳ X–Y]` bên cạnh `[Phi Tinh Can Cung ...]` cho mỗi cung Chương 2/3/4 trong `buildStrictDossierSectionPrompt`.
  - **Z2 (`P10`)**: Bổ sung sàn độ dài **900–1.300 từ** cho chương Lưu Niên, phân tích Tam Phương Tứ Chính và giao thoa Đại Hạn gốc chi phối hiện hành (dạng tổng quát, không hardcode lá số mẫu), yêu cầu đủ tên Hóa + tên sao + độ sáng và tên cung gốc của sao lưu, cấm câu dẫn nhập đầu bài.
  - **Z3 (`P8`)**: Bổ sung bộ lọc từ điển hẹp (số thứ tự trượt đặt dạng dài trước dạng ngắn, lỗi Telex `Thân Cuv`/`Venh Khúc`/`Venh Xương`, nhãn enum dự phòng, `khiâm đau`, 7 cặp từ sai ngữ cảnh có rào `bảo ninh` chữ thường để bảo vệ địa danh `"Bảo Ninh"`, `HOÁ` chỉ sửa trước 4 tên Tứ Hóa, `trục thế Mạnh`, `### Cung Mệnh Cung`).
  - **Z4**: Bổ sung quy tắc `"Không Kiếp"` (chỉ cặp Địa Không + Địa Kiếp) vào cả `buildStrictDossierSectionPrompt` và `buildStrictPeriodAiPrompt`.
  - **Z5 (`P9`, `P10`)**: Chuyển kiểm V2 trong `verifyAcademicCitationsAndClaims` từ mức khối sang mức câu trên block thô qua `splitRawBlockIntoSentences` (bảo toàn số thập phân, `.ts`, số thứ tự đầu dòng và cặp `[...]`), đồng bộ hướng dẫn vị trí gắn thẻ sang `"ngay cuối câu có viện dẫn hoặc trích dẫn đó"`, và bổ sung kỷ luật trích dẫn + tiêu đề thống nhất `### 1.`..`### 4.` / cấm dẫn nhập cho chương horizon (`C-06.3`).

---

## [1.5.4] — 25/11/2026

### Tầng Nội Dung & Hậu Kiểm (`BRIEF 1.5.4` — Gói A/B/C/D)
- **Gói A — KP-1 (Ngữ cảnh Tứ Hóa theo kỳ, sao lưu, mượn sao hai chiều & giới tính)**:
  - **A1**: Bổ sung dòng `[Tứ Hóa Đại Hạn Kỳ {startAge}–{endAge} (đóng tại {TênCungVi} · Can {CanVi})]` riêng cho từng cung trong `buildPalaceGroupFactSheetVi` (`src/lib/ziwei/dossier-context.ts`) bằng `getSiHuaByStem`, tách biệt hoàn toàn với `[Phi Tinh Can Cung ...]`; giữ nguyên không chèn vào tổng quan, bảng chat hay `buildMultiYearHorizonContext`.
  - **A2**: Đổi tiền tố Tứ Hóa Đại Hạn hiện tại trong `getAllSiHuaTagsForChart` thành `[Tứ Hóa Đại Hạn HIỆN TẠI ({startAge}–{endAge} · Can {X})]` đồng bộ cho tổng quan, nhóm cung và bảng chat.
  - **A3 & A6 (`server.ts`)**: Bổ sung quy tắc dùng đúng Can/bộ sao theo dòng `[Tứ Hóa Đại Hạn Kỳ ...]` trong `buildStrictDossierSectionPrompt`; bổ sung dòng `• Đương số: {Âm|Dương} {Nam|Nữ}` ở đầu 3 fact sheet nhóm cung và quy tắc không dùng khuôn nữ cho đương số nam (và ngược lại) khi luận cung `Phu Thê` ở `palaces_family`.
  - **A4 (`src/lib/ziwei/yunxian-context.ts`)**: Thêm `natalGanZhiVi` vào `PeriodDynamicStarItem` và đổi `formatDynamicStar` sang `*(trùng cung Bản Mệnh gốc {natalPalaceNameVi} - {natalGanZhiVi})*`.
  - **A5 (`src/lib/ziwei/dossier-context.ts`)**: Theo chốt của chủ dự án, gắn ghi chú mượn sao hai chiều **chỉ trên dòng `Chính tinh` của cung cho mượn trong `buildPalaceGroupFactSheetVi`** (không gắn vào `formatPalaceMajorsList` / `formatChartSummaryVi`, không lặp lại trong Tam Phương Tứ Chính).
  - **A7**: Áp dụng trần nới đã duyệt cho lá số mẫu (`palaces_core <= 5,100`, `palaces_family <= 4,550`, `palaces_social_health <= 4,580`, `chapter_overview <= 3,650`, `chat <= 13,100`); giữ nguyên `### Cung ...`, `[Đại hạn ...]`, `SI_HUA_TABLE` và `buildMultiYearHorizonContext`.
- **Gói B — KP-4 (Chuẩn hóa điểm nối continuation seam)**:
  - Thêm `normalizeContinuationSeam` trong `server/key-pool/executor.ts` áp dụng duy nhất cho chunk đầu tiên phát ra của mỗi lượt nối tiếp (`continuationCount > 0`) và cập nhật hướng dẫn nối mạch trong `buildContinuationPrompt`; giữ nguyên các pattern của `text-sanitizer.ts`.
- **Gói C — KP-3-lite (`PALACE_GANZHI_MISMATCH`)**:
  - Thêm `verifyPalaceGanZhiMentions` (`server/knowledge-base/verifier.ts`) và `PalaceGanZhiMismatch` (`server/knowledge-base/types.ts`) bắt sai lệch Can Chi cho `Cung {TênCung} ({Can} {Chi})` / `Cung {TênCung} tại {Can} {Chi}` (bỏ qua `Cung Lưu ...`, `Cung Đại Hạn ...` và Can Chi độc lập); nối vào 3 điểm gọi trong `server.ts` và gộp vào payload `citationAudit` hiện hữu.
- **Gói D — KP-7 Parser Patch**:
  - Cập nhật `parseBatchKeys` (`server/key-pool/parser.ts`) tách theo dấu `,` khi 1 dòng không chứa `{}` có `> 1` khóa `AIza...` / `AQ....`, bảo toàn nhãn khi dùng chuỗi 1 dòng `P…:Khóa` trong UI import lẫn `GEMINI_API_KEYS`.

---

## [1.5.3] — 24/11/2026

### Chốt Gemma 31B Làm Model Dự Phòng Mặc Định (`Pha 3, Bước 4` — `BRIEF 1.5.3`)
- **Đổi hằng số model dự phòng mặc định (`server/key-pool/types.ts`, `src/components/KeyPoolModal.tsx`)**:
  - Cập nhật `FALLBACK_MODEL = 'gemma-4-31b-it'` (thay `'gemini-3.8-flash'`) theo quyết định ngày `24/11/2026` (Pha 3, Bước 4 — Kế hoạch thử nghiệm model v3, Mục 6.3).
  - Cập nhật giá trị khởi tạo state `fallbackModel` trong `src/components/KeyPoolModal.tsx` thành `'gemma-4-31b-it'`.
  - Giữ nguyên `DEFAULT_MODEL = 'gemini-3.5-flash-lite'`, giữ nguyên `DEFAULT_SUPPORTED_MODELS` và danh sách lựa chọn dropdown (vẫn hỗ trợ chọn tay `gemini-3.8-flash`), và giữ nguyên ưu tiên cấu hình đã lưu trong kho mã hóa (`parsed.modelConfig?.fallbackModel || FALLBACK_MODEL`).
  - Giữ nguyên toàn bộ cơ chế ngân sách 1.5.2, prompt, `SI_HUA_TABLE`, retriever và CSDL tri thức.
- **Cấu hình hoàn nguyên khi chạm kill-switch**:
  - Cấu hình cũ (`DEFAULT_MODEL = 'gemini-3.5-flash-lite'`, `FALLBACK_MODEL = 'gemini-3.8-flash'`) là cấu hình hoàn nguyên chính thức (cùng gói nguồn `1.5.2` / `1.5.0` stable) khi chạm một trong các ngưỡng trigger kill-switch:
    1. Quota model chính = `0`;
    2. Cạn RPD trước `18:00` ở `>= 2` ngày;
    3. Tỷ lệ lỗi thật `> 10%/ngày` trong `7` ngày thử thách.

---

## [1.5.2] — 23/11/2026

### Ngân Sách Riêng Cho Chân Dự Phòng & Đường Truyền Gemma (`BRIEF 1.5.2 v2` — `H1–H4`, `ĐK-152-01..12`)
- **H1 (`ĐK-152-03` merge, `ĐK-152-09`) — `firstChunkTimeoutMs` theo profile model & gộp cấp trường**:
  - Bổ sung `firstChunkTimeoutMs?: number` vào `ModelProfileConfig` (`server/key-pool/types.ts`) cùng giá trị mặc định trong `DEFAULT_MODEL_PROFILES`: `gemma-4-31b-it = 60_000`, `gemma-4-26b-a4b-it = 60_000`, `gemini-4-hydrogen = 30_000`; các model khác giữ toàn cục `FIRST_CHUNK_TIMEOUT_MS = 12_000`.
  - Đổi `cloneProfiles` thành `mergeModelProfiles` (`server/key-pool/crypto-store.ts`) và cập nhật `mergeProfiles` / `updateModelConfig` (`server/key-pool/index.ts`) sang gộp cấp trường để profile lưu cũ không ghi đè mất trường mặc định mới; kẹp `firstChunkTimeoutMs` trong `[5_000, 120_000]` kèm `console.warn` và lùi về mặc định model nếu ngoài khoảng hoặc không phải số hữu hạn.
  - Công thức timeout chunk đầu trong `server/key-pool/executor.ts` lấy `min(profileTimeout, ngân sách còn lại của chân đang chạy, ngân sách còn lại tới trần 200s)` (sàn an toàn `1_000ms` cho phép kết nối).
- **H2 (`ĐK-152-01, 06, 10, 11`) — Ngân sách riêng `150s / 5 lượt` cho chân dự phòng**:
  - Tách bộ đếm và đồng hồ chân dự phòng trong `server/key-pool/types.ts` & `server/key-pool/executor.ts`: `FALLBACK_LEG_TIME_BUDGET_MS = 150_000` tính từ lần đầu mở chân dự phòng (`fallbackLegStartMs`), `MAX_FALLBACK_KEY_ATTEMPTS = 5`, và trần mềm toàn request `ABSOLUTE_REQUEST_BUDGET_MS = 200_000` (không cắt luồng đang stream vượt 200s, chỉ chặn mở lượt thử lại hoặc nối tiếp mới).
  - Giữ nguyên ngân sách chân chính `35_000ms / 5` lượt và không áp quy tắc đơn điệu (chân chính vẫn có thể chạy lại trên khóa mới chừng nào chưa cạn; chỉ khóa chân dự phòng sau khi chân chính cạn hẳn). Giữ quy tắc không mở chân dự phòng sau fast-sweep thuần (`primaryKeyAttemptsUsed === 0 && fallbackKeyAttemptsUsed === 0 && fastEliminatedSweeps > 0`).
  - Bổ sung guard `ĐK-152-10` vô hiệu hóa H2/H3 khi không có `fallbackModel` tách biệt (`fallback === ''`, `fallback === default`, hoặc `preferredModel === fallback`). Bổ sung `fallbackLegUsed: boolean` và `fallbackLegLatencyMs?: number` vào `StreamExecutionMeta` & `AiExecutionMeta`.
- **H3 (`ĐK-152-02, 05`) — Chờ cooldown có nắp `≤ 30s` trước khi cạn kiệt**:
  - Thêm `getMinFallbackWaitInfo` và `hasPendingProbeBlockForModel` vào `server/key-pool/allocator.ts` (giữ nguyên `getMinRemainingCooldownSec`).
  - Khi sẵn sàng sử dụng bằng `0` (trước vòng lặp hoặc khi `acquireLease` trả `null`) và đã bật H2/H3, nếu có khóa không thuộc `excludedProjectNumbers`, không mang cooldown dài quá `30_000ms` cho `fallbackModel` và không vướng `keyId::fallbackModel`, executor chờ `minWaitMs + 500` qua `sleepFn` có tôn trọng `AbortSignal`, giải phóng có chọn lọc khóa đã hết hạn và chạy `fallbackModel`; nếu đụng `pendingProbe` thử chờ thêm đúng `1 × 500ms`. Sau khi chờ H3, chỉ xét `fallbackModel` ở các lượt hồi phục kế tiếp.
- **H4 (`ĐK-152-07`) — Meta cuối và `partialLength` khi ngắt luồng (`interrupted`)**:
  - Bổ sung `partialLength?: number` vào `StreamExecutionMeta` (`server/key-pool/types.ts`) và `AiExecutionMeta` (`src/lib/dossier-chat-ui.ts`), điền đầy đủ tại mọi nhánh `return` của `executeStream`.
  - Bỏ cổng chặn phát khung `sendSseJson(res, { meta: finalMeta, done: true })` trước `data: [DONE]` tại cả 5 endpoint AI trong `server.ts` (`/api/interpret-period`, `/api/interpret-dossier-section`, `/api/interpret-chat`, `/api/interpret`, `/api/heming`) mà vẫn giữ guard `!wasInterrupted` cho hậu kiểm Tứ Hóa và `citationAudit`.
- **Hạ tầng kèm theo (`ĐK-152-03` lease, `ĐK-152-04, 08, 12`)**:
  - Nâng `LEASE_MAX_TTL_MS = 65_000` và `LEASE_ABSOLUTE_MAX_TTL_MS = 210_000` (`server/key-pool/types.ts`).
  - Thêm `onSseKeepAliveRequired` kích hoạt sau `15_000ms` chờ chunk đầu hoặc trước khi ngủ H3, nối vào `ensureSseStarted` tại `/api/interpret-period`, `/api/interpret-dossier-section`, `/api/interpret-chat` (`server.ts`).
  - Cập nhật `testKey` cho họ Gemma (`server/key-pool/index.ts`) dùng `min(profile.firstChunkTimeoutMs ?? 60_000, 65_000)` và chú thích giao diện trong `src/components/KeyPoolModal.tsx`.
  - Khi nối luồng gặp `TPM_GUARD_SKIP` (`ĐK-152-12`), kiểm tra TPM trước khi đánh dấu mở chân dự phòng để thoát sạch mà không kích hoạt H3.
- **Kiểm thử (`scripts/verify-key-pool.ts`)**:
  - Mở rộng từ `24` lên `31` bài (`BÀI 25–31`, phủ `B1, B2, B2a, B2b, B3, B4, B5` kèm SSE HTTP thật trên `/api/interpret-chat`, `B6, B7`, merge cấp trường, validate `[5s..120s]` và `testKey` Gemma 25s).

---

## [1.5.1] — 21/11/2026

### Nâng cấp Kho Khóa, Phân Loại Lỗi & Đường Ống Cấu Hình Model (Bước 2 — 6 Hạng Mục)
- **B1 (`ĐK-151-01, 02`) — Hỗ trợ khóa định dạng `AQ.` trong parser & che log**:
  - Mở rộng `GEMINI_KEY_REGEX` trong `server/key-pool/parser.ts` nhận cả `AIza[A-Za-z0-9_-]{31,41}` lẫn `AQ\.[A-Za-z0-9_-]{48,54}` và cập nhật thông điệp lỗi định dạng; `loadState` ghi `console.warn` nếu bỏ qua bản ghi giải mã sai định dạng.
  - Bổ sung pattern `/\bAQ\.[0-9A-Za-z_-]{12,64}/g` → `AQ.••••[REDACTED]` trong `sanitizeSecretText` (`server/key-pool/allocator.ts`), tách biệt với `AIza••••[REDACTED]`.
- **B2 + HT-02 (`ĐK-151-03..06`) — Sửa phép thử khóa (`testKey`) & giao diện thử theo model**:
  - Tăng `TEST_KEY_TIMEOUT_MS` từ `8_000ms` lên `20_000ms`; khi quá giờ (`TEST_TIMEOUT_INCONCLUSIVE`) trả `ok: false, inconclusive: true` và bảo toàn nguyên trạng thái `status`, `healthScore`, `consecutiveErrors`, `cooldownUntil` của khóa.
  - Hỗ trợ `POST /api/key-pool/:id/test { model?: string }` để thử từng model mỗi lượt; thử model phụ thành công không "rửa" khóa đang nguội về `ready` / `100` điểm; lỗi model-scoped chỉ ghi `modelCooldowns[model]`.
  - Áp dụng `thinkingConfig` từ profile của model và `TEST_KEY_MAX_OUTPUT_TOKENS = 256` (>= 64), kiểm tra `res.text.trim()` khác rỗng; UI `KeyPoolModal.tsx` & `src/lib/key-pool-ui.ts` hiển thị tên model đang thử, nút thử dự phòng, nhãn lỗi mới và trạng thái `inconclusive` cảnh báo vàng trong batch probe.
- **C2 (`ĐK-151-18`) — Dọn rác triển khai trong `public/assets/aistudio/`**:
  - Đối chiếu 0 tham chiếu mã nguồn và xóa 14 tệp snapshot KB cũ (`*.kb_*.json`) cùng brief cũ (`load-rc1-brief_215595ab.md`), giữ nguyên tệp mới đính kèm và toàn vẹn 100% SHA-256 của 7 tệp KB chính thức trong `server/knowledge-base/data/`.
- **HT-01 (`ĐK-151-07..10`) — Tách lỗi 403 & nhận diện `API_NOT_ENABLED`**:
  - Chỉ xếp `AUTH_INVALID_KEY` cho HTTP `401` (`UNAUTHENTICATED`) hoặc marker chết key tường minh (`API_KEY_INVALID`, `API key not valid`, `reported as leaked`, `API key expired`, `key_invalid`, `API_KEY_EXPIRED`).
  - Thêm `API_NOT_ENABLED` (`SERVICE_DISABLED` / `has not been used in project` / `it is disabled`, trích project qua `in project NNN` và `?project=NNN`), cooldown `1 giờ`, hỗ trợ Fast-Sweep và lan truyền cùng GCP project.
  - Thêm `AUTH_FORBIDDEN_AMBIGUOUS` cho các lỗi `403` còn lại với bộ đếm `consecutiveForbiddenErrors`, thang cooldown leo thang `[30s, 60s, 120s, 300s]`, chỉ vô hiệu hóa (`AUTH_FORBIDDEN_REPEATED`) khi lặp đủ 5 lần liên tiếp, không lan truyền sang peer cùng project và reset bộ đếm khi thành công / kích hoạt lại / thử mặc định đạt.
- **HT-04 (`ĐK-151-11..13`) — Cổng TPM 15K cho họ Gemma**:
  - Thêm ngưỡng `GEMMA_TPM_GUARD_THRESHOLD = 15_000`, `GEMMA_TPM_CHARS_PER_TOKEN_VI = 2.4`, `GEMMA_TPM_DEFAULT_OUTPUT_ESTIMATE = 3_000` và `estimateRequestInputTokens(prompt, systemInstruction?)` đo trước khi gọi SDK.
  - Khi ước lượng vượt 15.000 token đối với họ `/^(?:models\/)?gemma-/i`, bỏ qua model cho toàn bộ các khóa còn lại trong request đó mà không phạt khóa hay tăng `keyAttemptsUsed`; nếu cả model mặc định lẫn dự phòng đều bị bỏ qua thì thoát ngay với thông báo `TPM_GUARD_SKIP` (không ném `PoolExhaustedError`).
- **HT-05 (`ĐK-151-14..16`) — Đường ống cấu hình theo model (`maxOutputTokens`, `thinkingConfig`, `profiles`) & phát hiện `MAX_TOKENS`**:
  - Mở rộng `isSupportedGemini35Plus` nhận `^gemma-4-[a-z0-9.-]+$`, thêm `gemma-4-31b-it` và `gemma-4-26b-a4b-it` vào `DEFAULT_SUPPORTED_MODELS`, và thêm `DEFAULT_MODEL_PROFILES` (`gemini-4-hydrogen`: `LOW` / `32_768`, `gemma-4-*`: `MINIMAL` / `32_768` / `3_000`), tự động merge khi nạp store legacy hoặc cập nhật `updateModelConfig`.
  - Truyền `maxOutputTokens` và `thinkingConfig` vào SDK khi model có profile hoặc caller chỉ định (giữ nguyên hành vi model mặc định `gemini-3.5-flash-lite` không có profile).
  - Đọc `chunk?.candidates?.[0]?.finishReason` trước khi bỏ qua chunk rỗng text để ghi `finishReason` và `truncatedByMaxTokens` vào `StreamExecutionMeta`, đồng thời phát frame SSE `{ meta: finalMeta, done: true }` trước `data: [DONE]` tại 5 endpoint AI trong `server.ts`.

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
