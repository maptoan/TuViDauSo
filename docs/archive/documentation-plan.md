> ⚠️ **[TÀI LIỆU LỊCH SỬ ĐÃ LƯU TRỮ — KHÔNG DÙNG LÀM CĂN CỨ CODE HIỆN HÀNH]**
> - **Trạng thái**: Đã hoàn thành vai trò lịch sử / Đã bị thay thế bởi tài liệu sống **[`docs/INDEX.md`](../INDEX.md) & bộ 4 Tài liệu Sống (`architecture-overview.md`, `key-pool-operations.md`, `features-dossier-and-chat.md`, `decisions-registry.md`)** từ ngày `17/11/2026`.
> - **Cảnh báo cho Kỹ sư & AI Agent**: Các trích dẫn số dòng, tên biến, hằng số (như ngân sách 25s, nhịp nghỉ 2200ms, số lượng key 3/23) trong file này phản ánh thời điểm trước khi hợp nhất và **không còn khớp với mã nguồn hiện hành**. Tuyệt đối đọc tài liệu sống tại thư mục `docs/` gốc và đối chiếu code thật trước khi chẩn đoán hoặc sửa code!

---
# KẾ HOẠCH TỔNG THỂ QUẢN TRỊ, CHUẨN HÓA & ĐỒNG BỘ HỆ THỐNG TÀI LIỆU (`docs/documentation-plan.md`)

- **Dự án**: Tử Vi Thiên Kỷ (`Tử Vi Đẩu Số — Hệ Thống Thiên Kỷ Nghê Hải Hạ`)
- **Chủ dự án**: Toàn Đỗ (`toanmapct@gmail.com` — PRO)
- **Model phiên lập kế hoạch**: **Gemini 4 Argon** (`models/gemini-4-argon`)
- **Ngày lập kế hoạch**: `17/11/2026`
- **Trạng thái tài liệu**: **KẾ HOẠCH TRÌNH DUYỆT (CHƯA SỬA BẤT KỲ TÀI LIỆU HAY CODE NÀO KHÁC)**
- **Mốc đối chiếu thực tế của mã nguồn hiện hành** *(đã tự kiểm chứng trực tiếp trên cây thư mục dự án)*:
  - Bản chụp đóng băng gần nhất: `backup/v1.0.0-stable/` (chốt lúc `17/11/2026 12:10:55 +07`, gồm `86` file mã nguồn + `1` file `BACKUP-MANIFEST.md` = `87` file).
  - Sau mốc `1.0.0-stable`, đợt thi công **`QĐ-H1 .. QĐ-H7`** đã hoàn tất trên nhánh làm việc chính:
    - **Pha 0 (`QĐ-H4` thu hẹp)**: Đã chẩn đoán độc lập tại `docs/h4-diagnosis.md` và sửa tối thiểu tại `server/key-pool/allocator.ts:107–120`, `server/key-pool/executor.ts:359–383, 402–424`, `scripts/verify-key-pool.ts`.
    - **Pha 1–3 (`QĐ-H1, H2, H3, H5, H6, H7`)**: Đã thi công vào code trên `13` file (`src/lib/dossier-chat-ui.ts`, `src/components/DetailedDossierModal.tsx`, `src/lib/ziwei/yunxian-context.ts`, `src/lib/ziwei/share.ts`, `src/App.tsx`, `src/lib/ziwei/dossier-context.ts`, `src/components/HemingView.tsx`, `src/components/InsightPanel.tsx`, `src/lib/ziwei/cities.ts`, `server.ts`, `src/lib/ziwei/text-sanitizer.ts`, `scripts/verify-dossier-context.ts`, `scripts/verify-dossier-chat-ui.ts`).
  - **Kết quả kiểm thử tự động hiện hành**:
    - `npx tsc --noEmit`: **0 lỗi**
    - `vite build` (`compile_applet`): **ĐẠT**
    - `npx tsx scripts/verify-key-pool.ts`: **18/18 ĐẠT** (tăng từ `17/17` ở `1.0.0-stable` nhờ thêm `TEST 18` cho `QĐ-H4`)
    - `npx tsx scripts/verify-dossier-context.ts`: **6/6 ĐẠT** (đã mở rộng kiểm tra Tam Phương Tứ Chính và `chart.patterns` cho `QĐ-H3`)
    - `npx tsx scripts/verify-dossier-chat-ui.ts`: **18/18 ĐẠT** (tăng từ `14/14` ở `1.0.0-stable` nhờ thêm `TEST-11..TEST-14` cho `QĐ-H1, H2, H5, H6, H7`)
    - `npx tsx scripts/verify-yunxian.ts`: **ĐẠT**
    - Quét `dist/` tìm chuỗi khóa nguyên văn: **0 kết quả**
    - Kiểm chứng live `H1` trên trình duyệt: **CHƯA KIỂM CHỨNG LIVE** (tạm hoãn do hạn mức quota các khóa trong kho đang nguội/cạn).

---

## PHẦN 1 — KIỂM KÊ TOÀN BỘ TÀI LIỆU HIỆN CÓ (DOCUMENTATION INVENTORY & AUDIT)

### 1.1. Bảng tổng hợp kiểm kê theo nhóm trạng thái

Qua kiểm tra trực tiếp thư mục gốc `/`, thư mục `/docs/` (`15` file `.md`) và thư mục `/backup/v1.0.0-stable/`, hệ thống hiện có **17 tài liệu/siêu dữ liệu hiện hữu** và **2 tài liệu gốc bị khuyết**:

| STT | Đường dẫn file | Số dòng | Nhóm trạng thái | Phân loại vai trò hiện tại | Tóm tắt mức độ khớp với code sau đợt `QĐ-H1..H7` |
|:---:|---|---:|---|---|---|
| 1 | `README.md` *(thư mục gốc)* | — | **THIẾU / CHƯA TỒN TẠI** | Tài liệu cửa ngõ dự án | **Chưa tồn tại** ở cả `/` lẫn `/backup/v1.0.0-stable/`. Người đọc mới hoặc phiên AI mới không có bản đồ tổng quan để biết đọc file nào trước. |
| 2 | `CHANGELOG.md` *(thư mục gốc)* | — | **THIẾU / CHƯA TỒN TẠI** | Nhật ký phiên bản | **Chưa tồn tại**. Lịch sử các đợt `QĐ-1..6`, `F1–F7`, `QĐ-G1..G6`, `1.0.0-stable`, `QĐ-H1..H7` đang nằm rải rác trong 15 file ở `docs/`. |
| 3 | `VERSION` *(thư mục gốc)* | 4 | **LỖI THỜI** | Định danh phiên bản hiện hành | Đang ghi cứng `1.0.0-stable` (`VERSION:1–3`), mới liệt kê tới `F1–F7`, `G1–G6`, dọn meta và 3 file rà soát; **chưa phản ánh đợt thi công `QĐ-H1..H7`** và bộ test mới (`18/18` key-pool, `18/18` dossier-chat-ui). |
| 4 | `package.json` & `metadata.json` | 43 / 7 | **LỖI THỜI MỘT PHẦN** | Siêu dữ liệu ứng dụng | `metadata.json:1–6` chuẩn xác. Tuy nhiên `package.json:2,4,6–14` vẫn để `"name": "react-example"`, `"version": "1.0.0"`, và mục `scripts` mới có `verify:engine`, thiếu lệnh chạy nhanh cho `verify-key-pool`, `verify-dossier-context`, `verify-dossier-chat-ui`, `verify-yunxian`. |
| 5 | `backup/v1.0.0-stable/BACKUP-MANIFEST.md` | 71 | **TÀI LIỆU LỊCH SỬ (ĐÓNG BĂNG)** | Biên bản chụp nhanh bản `1.0.0-stable` | **Chính xác tuyệt đối cho mốc lịch sử `1.0.0-stable`** (`17/11/2026 12:10:55 +07`, `87` file, `17/17` & `14/14` test). Thuộc thư mục `backup/` bất biến — **tuyệt đối không sửa**, nhưng không còn đại diện cho nhánh code hiện hành sau đợt `H`. |
| 6 | `docs/h4-diagnosis.md` | 127 | **HIỆN HÀNH (NHƯNG VIẾT Ở THÌ TRƯỚC KHI SỬA)** | Biên bản chẩn đoán `QĐ-H4` thu hẹp | Khớp `100%` với code thực tế của `executor.ts` và `allocator.ts` hiện hành; giải thích rõ sự cố `B-05` trích dẫn biến ảo. Tuy nhiên tiêu đề/mục 4 (`dòng 5, 114–126`) vẫn ghi ở trạng thái *"Chỉ chẩn đoán — Đề xuất trình duyệt"*, cần ghi chú đã thi công xong + đạt `TEST 18` (`18/18`). |
| 7 | `docs/logic-code-audit-v2.md` | 632 | **LỖI THỜI MỘT PHẦN & CÓ SAI SÓT KỸ THUẬT Ở `B-05`** | Báo cáo rà soát V2 & Danh mục `QĐ-H1..H7` | Mục `QĐ-H1, H2, H3, H5, H6, H7` mô tả đúng các điểm vừa thi công, nhưng: (1) Vẫn viết ở trạng thái *"chờ Chủ dự án chốt"* (`dòng 134–200` phần cuối); (2) **Mục `B-05` (`dòng 155–188`) trích dẫn các biến không tồn tại trong code thật** (`timedOutWaitingFirstChunk`, `receivedFirstChunk`, `markFailed`) — đã bị `docs/h4-diagnosis.md:8–18` bác bỏ. |
| 8 | `docs/logic-code-audit-panel-review.md` | 234 | **TÀI LIỆU LỊCH SỬ / CHỒNG LẤN** | Biên bản Panel 5 vai giữa V1 và V2 | Đã hoàn thành sứ mệnh trung gian để sinh ra `logic-code-audit-v2.md`. Đặc biệt tại Mục 3 (`dòng 176–179`), Panel cũng bị cuốn theo giả định sai về biến `timedOutWaitingFirstChunk` ở `executor.ts:72, 92, 146`. |
| 9 | `docs/logic-code-audit-v1.md` | 783 | **TÀI LIỆU LỊCH SỬ / ĐÃ BỊ THAY THẾ** | Bản nháp rà soát V1 (trước Panel) | Đã bị thay thế bởi `logic-code-audit-v2.md`. Chứa 5 nhận định bị Panel bác bỏ/hạ cấp (`A-01` kịch bản `leapMonth`, `A-02` trích dẫn sai regex `/Bắc Kinh|Thượng Hải/` tại `dossier-chat-ui.ts:885`, `C-01` số dòng sai, `D-01` đề xuất `concurrency = 2`, và `B-05` biến ảo `timedOutWaitingFirstChunk`). |
| 10 | `docs/dossier-fix-plan-v2.md` | 367 | **LỖI THỜI MỘT PHẦN** | Kế hoạch sửa Hồ Sơ 8 Chương V2 (`QĐ-G1..G4`) | Đã thi công xong từ trước mốc `1.0.0-stable`, nhưng: (1) Dòng 9 vẫn ghi *"Kế hoạch V2 hoàn chỉnh — chờ chủ dự án duyệt mới thi công"*; (2) Chưa cập nhật bổ sung `QĐ-G5` (nối dây `origInput` tại `share.ts`), `QĐ-G6` (`stripInternalExportMetaLines`), và các nâng cấp đợt `H` (`QĐ-H1` lưu đủ 8 chương vào `sessionStorage`, `QĐ-H3` in Tam Hợp kỳ hạn, `QĐ-H6` giới hạn câu cho Lớp 3B). |
| 11 | `docs/dossier-fix-panel-review.md` | 261 | **TÀI LIỆU LỊCH SỬ / CHỒNG LẤN** | Biên bản Panel phản biện kế hoạch sửa Hồ Sơ | Tài liệu trung gian giữa `dossier-fix-plan-v1.md` và `v2.md`. Mọi kết luận đã được hợp nhất vào `dossier-fix-plan-v2.md`. |
| 12 | `docs/dossier-fix-plan-v1.md` | 330 | **TÀI LIỆU LỊCH SỬ / ĐÃ BỊ THAY THẾ** | Bản nháp V1 kế hoạch sửa Hồ Sơ | Đã bị thay thế hoàn toàn bởi `dossier-fix-plan-v2.md` (chứa các đề xuất ban đầu đã bị Panel sửa đổi như tách từ mọi chữ cái đầu âm tiết hoặc nâng cấp toàn bộ hồ sơ lên `gemini-3.8-flash`). |
| 13 | `docs/feature-plan-3-tinh-nang-v2.md` | 579 | **LỖI THỜI NGHIÊM TRỌNG & TỰ MÂU THUẪN NỘI BỘ** | Kế hoạch thiết kế 3 tính năng (`F1–F7`) | Dù đã thi công xong, tài liệu này vẫn ghi *"Sẵn sàng thi công"* (`dòng 7`), đồng thời **phần thân bài (`§2.1–2.3`, `§3.1–3.3`) không được sửa theo phần Đầu bài (`F1–F7`)**, dẫn tới hàng loạt tên hàm, kiểu dữ liệu, ID chương, cơ chế lưu trữ (`localStorage + IndexedDB`) và con số kho key (`23 key`, `7 key lỗi`) sai lệch hoàn toàn so với code thật! |
| 14 | `docs/feature-plan-panel-review.md` | 268 | **TÀI LIỆU LỊCH SỬ / CHỒNG LẤN** | Biên bản Panel phản biện 3 tính năng | Tài liệu trung gian giữa `feature-plan-3-tinh-nang.md` và `v2.md` (nơi chốt các quyết định `F1–F7`). |
| 15 | `docs/feature-plan-3-tinh-nang.md` | 428 | **TÀI LIỆU LỊCH SỬ / ĐÃ BỊ THAY THẾ** | Bản nháp V1 thiết kế 3 tính năng | Đã bị thay thế bởi `feature-plan-3-tinh-nang-v2.md`. Ghi cứng *"Chỉ lập kế hoạch thiết kế — tuyệt đối chưa triển khai code"* (`dòng 5`), đề xuất `concurrency = 2`, `localStorage + IndexedDB`, và chép cứng trạng thái kho key `3/23`. |
| 16 | `docs/key-pool-design-plan.md` | 347 | **LỖI THỜI MỘT PHẦN** | Thiết kế gốc Kho Khóa Gemini (`QĐ-1..QĐ-6`) | Kiến trúc nền tảng (`AES-256-GCM`, `PBKDF2`, `KeyPoolState`, `QĐ-1..QĐ-6`, ngân sách `35s / 5 key`) vẫn đúng, nhưng: (1) Dòng 6 vẫn ghi *"tuyệt đối chưa triển khai code"*; (2) Tự mâu thuẫn nội bộ về `probeFloorScore` (`85` ở `dòng 19` vs `95` ở `dòng 243` — code thật tại `allocator.ts:392` dùng `95`); (3) Chưa cập nhật cơ chế `modelCooldowns` theo từng cặp `(key, model)`, cơ chế viết nối tiếp `buildContinuationPrompt` (`executor.ts:93–106`), nhật ký `CALL_SUCCESS` (`allocator.ts:590–598`), và bản vá `QĐ-H4`. |
| 17 | `docs/key-pool-expert-panel-review.md` | 234 | **TÀI LIỆU LỊCH SỬ / CHỒNG LẤN (LỆCH NGÂN SÁCH 25s vs 35s)** | Biên bản Panel chuyên gia Kho Khóa | Tài liệu trung gian trước khi chốt `QĐ-5`. Tại `dòng 204, 221` ghi ngân sách failover là **`25_000 (25 giây)`**, trong khi quyết định chốt `QĐ-5` (`key-pool-design-plan.md:17, 69, 85`) và code thật (`server/key-pool/types.ts:193`) là **`35_000 (35 giây)`**. |
| 18 | `docs/stream-interruption-diagnosis.md` | 242 | **LỖI THỜI NGHIÊM TRỌNG (GÂY NHIỄU KHI ĐỌC CODE)** | Chẩn đoán ngắt luồng `503` (trước Pha B) | Viết trên nền code cũ trước khi thi công Pha B (`executor.ts` lúc đó 319 dòng, chưa có `buildContinuationPrompt`, chưa có `modelCooldowns`). **Chính sự tồn tại không gắn nhãn lịch sử của tài liệu này đã góp phần làm lệch hướng chẩn đoán `B-05` trong đợt rà soát vừa qua.** |
| 19 | `docs/fix-round-diagnosis.md` & `docs/heming-form-reset-diagnosis.md` | 230 / 211 | **TÀI LIỆU LỊCH SỬ (ĐÃ GIẢI QUYẾT XONG)** | Biên bản chẩn đoán lỗi cục bộ trước Pha B | Cả 2 đều ghi *"Chỉ chẩn đoán — tuyệt đối chưa sửa code"* (`fix-round-diagnosis.md:6`, `heming-form-reset-diagnosis.md:6`), trong khi tất cả các lỗi nêu trong đó (`B1` reset form Hợp Hôn khi chọn Giờ Tý `0`, `B2` ghi log `CALL_SUCCESS`, `B3` nút Dừng & chọn chương Hồ Sơ) đều đã được sửa xong từ Pha B. |

---

### 1.2. Phân tích chuyên sâu 5 điểm lệch & mâu thuẫn trọng yếu bắt buộc kiểm chứng (`a` → `e`)

#### (a) Mâu thuẫn ngân sách thời gian Failover: `25 giây` vs `35 giây`
- **Bằng chứng đối chiếu trực tiếp**:
  1. Trong `docs/key-pool-expert-panel-review.md:204` và `dòng 221` (Mục *Điểm đồng thuận #6* của Panel):
     > *"Giới hạn tối đa `MAX_KEY_ATTEMPTS = 5` key cho mỗi request và ngân sách thời gian chờ chunk đầu tiên `FIRST_CHUNK_TIMEOUT_MS = 12_000` (12s), tổng thời gian chờ failover không quá `TOTAL_FAILOVER_TIME_BUDGET_MS = 25_000` (25s)."*
  2. Trong `docs/key-pool-design-plan.md:17, 69, 85, 312, 345` (Quyết định `QĐ-5` được Chủ dự án chốt sau Panel):
     > *"Nâng tổng ngân sách thời gian failover mỗi request (`TOTAL_FAILOVER_TIME_BUDGET_MS`) từ `25 giây` lên **`35 giây`**, giữ nguyên trần tối đa `MAX_KEY_ATTEMPTS = 5` key và `FIRST_CHUNK_TIMEOUT_MS = 12 giây`."*
  3. Trong **mã nguồn thực tế hiện hành** tại `server/key-pool/types.ts:191–193`:
     ```ts
     export const MAX_KEY_ATTEMPTS = 5;
     export const FIRST_CHUNK_TIMEOUT_MS = 12_000;
     export const TOTAL_FAILOVER_TIME_BUDGET_MS = 35_000;
     ```
     Và được thực thi tại `server/key-pool/executor.ts:169, 191, 234, 356`.
- **Kết luận kiểm chứng**: Giá trị thật trong code và quyết định đã chốt là **`35_000 ms` (`35 giây`)**. Việc giữ `docs/key-pool-expert-panel-review.md` ngang hàng trong `docs/` mà không có cảnh báo *"Đã bị thay thế bởi QĐ-5 (35s)"* rất dễ khiến người đọc hoặc AI lấy nhầm mốc `25s`.
- **Phụ lục phát hiện thêm trong cùng cặp file**: Tại `docs/key-pool-design-plan.md:19` (Mục Tóm tắt #6) ghi `probeFloorScore = 85`, nhưng tại `dòng 243` (Mục 5.1) lại ghi `healthScore = 95`, còn code thật tại `server/key-pool/allocator.ts:392` (`sweep`) và `allocator.ts:624` (`recordManualTestResult`) gán cứng **`key.healthScore = 95`**.

---

#### (b) Sai lệch số liệu Kho Khóa (`3/23` vs `4/7` vs thực tế `7/17`) và tên hàm/kiểu dữ liệu ảo trong `docs/feature-plan-3-tinh-nang-v2.md`
- **Bằng chứng đối chiếu trực tiếp**:
  1. **Về con số khóa trong kho**:
     - `docs/feature-plan-3-tinh-nang.md:29` và `docs/feature-plan-3-tinh-nang-v2.md:47` ghi cứng:
       > *"Kho khóa hiện có tổng **23 key**, trong đó **3 key khỏe (`ready`)** và **20 key đang `cooldown` (`QUOTA_PROJECT_ZERO`)**."*
     - Nhưng ngay trong cùng file `docs/feature-plan-3-tinh-nang-v2.md:114` và `dòng 182–185`, tác giả lại viết:
       > *"Ví dụ 7 key lỗi hiện tại chỉ thuộc 4 `project_number`... `Probed: 4 · Recovered: 0 · Still Failing: 4 · Skipped (Same Project): 3`"* (tức tổng 10 key gồm 3 khỏe + 7 lỗi!).
     - Trong khi đó, kiểm tra trạng thái runtime thực tế của Kho Khóa hiện hành qua API nội bộ `GET /api/key-pool` (`summary` — không truy xuất key nguyên văn):
       ```json
       {"total":17,"ready":7,"cooldown":10,"disabled":0}
       ```
       (tức hiện có **17 khóa tổng cộng: 7 khóa `ready`, 10 khóa `cooldown`, 0 khóa `disabled`** — con số này biến động liên tục theo thời gian thực khi người dùng thêm/xóa khóa hoặc khi hết hạn `cooldownUntil`).
  2. **Về mâu thuẫn nội bộ nghiêm trọng giữa Đầu bài (`F1–F7`) và Thân bài (`§2, §3, §4`) trong `docs/feature-plan-3-tinh-nang-v2.md`**:
     - Ở đầu file (`dòng 15–22`), tài liệu tuyên bố áp dụng các quyết định `F1–F7` (ghi đè lên các mục `§2.3`, `§3.2`, `§4.4`), nhưng toàn bộ phần thân bài bên dưới (`dòng 86–340`) **vẫn giữ nguyên văn bản của bản nháp cũ chưa sửa**, dẫn tới mô tả sai hàng loạt thực thể code:
       - `dòng 94–96`: Ghi `KeyStatus = 'active' | 'cooldown' | 'disabled_invalid'` → Code thật (`server/key-pool/types.ts:1`) là `'ready' | 'cooldown' | 'disabled'`.
       - `dòng 120–160`: Ghi hàm `testSingleKey(id)`, `markProbeSuccess`, `markFailure` và route `POST /api/key-pool/test-cooldown` → Code thật dùng `testKey(id)` (`server/key-pool/index.ts:192`), `recordManualTestResult` (`allocator.ts:615`), `probeCooldownKeys` (`index.ts:251`) và route `POST /api/key-pool/probe-cooldown` (`server.ts:619`).
       - `dòng 199, 220`: Ghi lưu Hồ Sơ 8 Chương vào `localStorage + IndexedDB` → Code thật (`src/lib/dossier-chat-ui.ts:685–748`) lưu vào `window.sessionStorage` với tiền tố `ziwei_dossier_v1::`.
       - `dòng 205–215`: Ghi mã 8 chương là `chapter_palaces_core`, `chapter_palaces_relations`, `chapter_palaces_foundation`, `chapter_year_2026`, `chapter_plan_5y_2026_2030` → Code thật (`src/lib/dossier-chat-ui.ts:546–555`) là `chapter_overview`, `palaces_core`, `palaces_family`, `palaces_social_health`, `year_2026`, `year_2027`, `horizon_5y`, `horizon_10y`.
       - `dòng 16`: Ghi nhịp nghỉ giữa 2 chương là `2000–2500ms` (code cũ `2200ms`) → Sau `QĐ-H7`, code thật tại `src/lib/dossier-chat-ui.ts:569` là `DOSSIER_INTER_CHAPTER_PACING_MS = 1_200` (`1200ms`).

---

#### (c) Bài học thực tế từ `docs/stream-interruption-diagnosis.md` và sự cố dẫn lệch Panel ở mục `B-05`
- **Bằng chứng đối chiếu trực tiếp**:
  1. File `docs/stream-interruption-diagnosis.md` (`dòng 5–10`) được lập trước Pha B, mô tả `server/key-pool/executor.ts` lúc chỉ có `319` dòng (chưa có cơ chế tự động viết nối tiếp `buildContinuationPrompt`, chưa có `modelCooldowns` theo từng model, và ở `§6 dòng 218–240` đặt giả thuyết mở về lỗi `AbortError: This operation was aborted | code=20`).
  2. Trong đợt rà soát toàn diện vừa qua (`docs/logic-code-audit-v1.md:320–360`, `docs/logic-code-audit-panel-review.md:175–180`, `docs/logic-code-audit-v2.md:155–188`), vì hệ thống tài liệu cũ vẫn để `stream-interruption-diagnosis.md` nằm chung với các tài liệu hiện hành mà không có tài liệu kiến trúc sống của `executor.ts` (444 dòng), báo cáo rà soát đã **trích dẫn nhầm một cấu trúc code không tồn tại trong thực tế**:
     - `logic-code-audit-v2.md:159–177` khẳng định chắc chắn (`[Đã kiểm chứng bằng code]`) rằng tại `executor.ts:72, 91–94, 146–164` có biến `let timedOutWaitingFirstChunk = false;` và `receivedFirstChunk`, và rằng tại `allocator.ts:158` chuỗi `'AbortError'` không khớp regex nên bị rơi xuống `'NETWORK_OR_5XX'` rồi bị `markFailed` trừ `-10` điểm!
     - Khi Chủ dự án yêu cầu thực hiện **Pha 0 (`docs/h4-diagnosis.md:8–55`)** kiểm tra lại trên code thật:
       - Kết quả `grep` toàn bộ dự án cho `timedOutWaitingFirstChunk`, `receivedFirstChunk` và `markFailed` đều bằng **`0`**!
       - Trong `server/key-pool/executor.ts` thật, dòng `72` là `nowFn?: () => number;` trong `ExecuteStreamOptions`, còn bộ hẹn giờ chunk đầu nằm ở **`dòng 236–241`** dùng cờ `attemptSentAnyChunk`.
       - Trong `server/key-pool/allocator.ts` thật (trước khi sửa H4), dòng `158` **có chứa sẵn** `\bAbortError\b|FIRST_CHUNK_TIMEOUT` ngay trong biểu thức regex của nhánh `4. Lỗi 5xx hoặc mạng / timeout` (chứ không phải bị trượt regex xuống default như V2 mô tả!).
  3. Tương tự đối với luồng đọc SSE trên Frontend:
     - Các tài liệu chẩn đoán cũ chỉ mô tả `InsightPanel.tsx` và `DetailedDossierModal.tsx`, bỏ quên `src/components/HemingView.tsx`. Đến đợt `QĐ-H5` (`F-01`), `src/components/HemingView.tsx:118–190` đã được nâng cấp toàn diện với `sseBuffer`, xả phần dư cuối luồng (`if (sseBuffer.trim().startsWith('data:'))`), bắt `parsed.interrupted` / `parsed.error`, gọi `sanitizeAiVietnameseOutput` và hiển thị `streamNotice`. Hiện chưa có tài liệu kiến trúc hiện hành nào ghi nhận trạng thái đồng bộ cả 4 luồng SSE này.

---

#### (d) Hiện tượng "Tài liệu kế hoạch viết ở thì tương lai dù code đã thi công xong"
- **Bằng chứng đối chiếu trực tiếp**:
  Cả **8/8 file kế hoạch & chẩn đoán** trong `docs/` đều giữ nguyên nhãn trạng thái lúc mới xin duyệt:
  1. `docs/key-pool-design-plan.md:6` → *"Trạng thái: Chỉ lập kế hoạch thiết kế — tuyệt đối chưa triển khai code."* (Thực tế: Đã thi công 100% + nâng cấp qua Pha B và `QĐ-H4`).
  2. `docs/feature-plan-3-tinh-nang.md:5` → *"Trạng thái: Chỉ lập kế hoạch thiết kế — tuyệt đối chưa triển khai code."* (Thực tế: Bản V1 đã bị thay thế bởi V2 và đã thi công xong).
  3. `docs/feature-plan-3-tinh-nang-v2.md:7` → *"Trạng thái: Sẵn sàng thi công Phần A & Phần B"* (Thực tế: Đã thi công xong cả Phần A, Phần B, sau đó còn trải qua đại tu ở `dossier-fix-plan-v2` và `QĐ-H1..H7`).
  4. `docs/fix-round-diagnosis.md:6` → *"Trạng thái: Chỉ chẩn đoán — tuyệt đối chưa sửa code."* (Thực tế: Đã sửa xong toàn bộ `B1, B2, B3`).
  5. `docs/heming-form-reset-diagnosis.md:6` → *"Trạng thái: Chỉ chẩn đoán — tuyệt đối chưa sửa code."* (Thực tế: Đã sửa xong lỗi `0 || 6` cho Giờ Tý ở `HemingView.tsx`).
  6. `docs/dossier-fix-plan-v1.md:7` & `docs/dossier-fix-plan-v2.md:9` → *"chờ chủ dự án duyệt mới thi công."* (Thực tế: Đã thi công xong cả Pha 1–4 + `QĐ-G5` + `QĐ-G6`).
  7. `docs/logic-code-audit-v2.md:136` → *"Panel kính trình Chủ dự án phê duyệt 7 quyết định (`QĐ-H1` .. `QĐ-H7`)."* (Thực tế: Đã thi công xong cả 7 quyết định `QĐ-H1..H7`).
  8. `docs/h4-diagnosis.md:5` → *"Trạng thái: Chỉ chẩn đoán — Đề xuất trình Chủ dự án duyệt"* (Thực tế: Đã thi công xong cả 2 điểm sửa tối thiểu và đạt `verify-key-pool` `18/18`).

---

#### (e) Khoảng trống tài liệu sau đợt thi công `QĐ-H1 .. QĐ-H7`
Hiện tại, **chưa có bất kỳ tài liệu hiện hành nào** trong `docs/` hoặc `VERSION` ghi nhận trạng thái **ĐÃ THI CÔNG & ĐÃ KIỂM CHỨNG** của đợt `QĐ-H1 .. QĐ-H7` trên 13 file mã nguồn:
1. **`QĐ-H1` (`F-04` + `C-01`)**:
   - `src/lib/dossier-chat-ui.ts:667–673`: `StoredDossierRecord.sections` đã mở rộng thành `Partial<Record<DossierChapterId, StoredDossierSection>>` (lưu đủ cả 8 chương gồm `year_2026`, `year_2027` vào `sessionStorage`).
   - `src/components/DetailedDossierModal.tsx:167–207, 576–592`: Đồng bộ 2 chiều giữa `sessionStorage` và `aiPeriodCache` khi khởi tạo và khi sinh xong Chương 5, 6.
   - `src/lib/dossier-chat-ui.ts:169–196`: `sanitizeDossierChapterText` đã tích hợp Lớp 3B (`verifyAndEnsureCompletePeriodSiHua`) cho `year_2026` và `year_2027`.
2. **`QĐ-H2` (`A-01` + `A-04` + `A-05`)**:
   - `src/lib/dossier-chat-ui.ts:63–81` & `src/lib/ziwei/yunxian-context.ts:292–310`: `buildChartIdentityKey` và `periodContext.cacheKey` đã ghép thêm `nameSlug`, `mingGongBranch`, `leapMonth`, `origClock` (`hh:mm`), `lonPart` (`lo=...` hoặc `no_lon`).
   - `src/App.tsx:96`: `applyFormAndChart` đã gọi `setAiPeriodCache({})` khi lập lá số mới.
   - `src/lib/dossier-chat-ui.ts:750–775`: `saveDossierChatHistory` đã lọc bỏ các tin nhắn lỗi (`!m.isError`).
   - `src/lib/ziwei/share.ts:89–124`: `searchParamsToForm` đã dùng `safeParseInt` chống `NaN` từ URL.
3. **`QĐ-H3` (`B-04` + `A-03`)**:
   - `src/lib/ziwei/yunxian-context.ts:181–215`: `buildFactTableMarkdown` đã tính sẵn và in tường minh khối *"Tam phương tứ chính của kỳ hạn (BẮT BUỘC dùng đúng tên & vai trò này, KHÔNG tự nhẩm địa chi)"* gồm Cung Mệnh kỳ hạn, Hội chiếu Tam Hợp 1 (`+4`), Hội chiếu Tam Hợp 2 (`+8`) và Xung chiếu (`+6`).
   - `src/lib/ziwei/dossier-context.ts:182–218`: `buildChartOverviewFactSummary` (Chương 1) đã in sẵn Tam Phương Tứ Chính Bản Mệnh và danh sách Cách cục nhận diện (`chart.patterns`).
4. **`QĐ-H4` (`B-05` + `B-01` thu hẹp)**:
   - `server/key-pool/allocator.ts:107–120, 155–168`: Chuyển `\bAbortError\b|FIRST_CHUNK_TIMEOUT|This operation was aborted|The operation was aborted` từ nhánh `NETWORK_OR_5XX` sang nhánh `MODEL_UNAVAILABLE` (không trừ `-10` điểm và không phạt `cooldown` cả khóa).
   - `server/key-pool/executor.ts:359–383, 402–424`: Bỏ gọi `options.onChunk('\n\n*(Luồng kết nối bị gián đoạn...)*')` trùng lặp, chỉ phát sự kiện cấu trúc `options.onInterrupted`.
5. **`QĐ-H5` (`F-01` + `C-02` + `A-02` + `C-05` + `E-03`)**:
   - `src/components/HemingView.tsx:118–190`: Vòng đọc SSE có `sseBuffer`, xử lý `interrupted`/`error`, chạy `sanitizeAiVietnameseOutput`.
   - `src/components/DetailedDossierModal.tsx:365` & `src/components/InsightPanel.tsx:171, 183`: Sửa điều kiện thành `errCode === 'AI_NOT_CONFIGURED'`.
   - `src/lib/dossier-chat-ui.ts:914`: Chỉ tính hiệu chỉnh Chân Thái Dương Thời trên Header S5 khi `orig && b.longitude !== undefined`.
   - `src/lib/ziwei/cities.ts:1–96`: Đã dọn ~688 dòng tỉnh/thành Trung Quốc không sử dụng khỏi client bundle.
   - `server.ts:436, 914`: Đặt `express.json({ limit: '512kb' })` và cắt giới hạn `question`/`chatHistory`.
6. **`QĐ-H6` (`B-02` + `B-03`)**:
   - `src/lib/ziwei/text-sanitizer.ts:174–205, 302–348`: Thu hẹp cửa sổ quét `isPeriodSiHuaMentionedInText` theo ranh giới câu (`/[.!?\n;|]/`) và thêm regex tách nguyên âm có dấu tiếng Việt đứng liền trước chữ IN HOA.
7. **`QĐ-H7` (`D-01`)**:
   - `src/lib/dossier-chat-ui.ts:586`: Giữ nguyên `concurrency = 1`, giảm `DOSSIER_INTER_CHAPTER_PACING_MS` từ `2_200` xuống `1_200` ms (`1.2 giây`).

---

## PHẦN 2 — CẤU TRÚC BỘ TÀI LIỆU ĐÍCH & QUY TẮC MỘT NGUỒN SỰ THẬT (SINGLE SOURCE OF TRUTH)

### 2.1. Sơ đồ cây thư mục tài liệu đích (4 nhóm chức năng rõ ràng)

Để chấm dứt tình trạng 15 file kế hoạch/phản biện/chẩn đoán nằm phẳng trong `docs/` ngang hàng nhau, cấu trúc đích được tổ chức thành **Tài liệu gốc ở Root + 4 phân khu trong `docs/`**:

```text
/ (Thư mục gốc dự án)
├── README.md                             # [MỚI - CỬA NGÕ DỰ ÁN] Tổng quan hệ thống, kiến trúc 4 tầng, lệnh chạy & kiểm thử, bản đồ điều hướng tài liệu
├── VERSION                               # [CẬP NHẬT] Nguồn sự thật duy nhất về số phiên bản hiện hành, ngày chốt & trạng thái bộ test
├── CHANGELOG.md                          # [MỚI] Nhật ký thay đổi theo chuẩn Keep a Changelog (v1.0.0-stable -> v1.1.0-rc.1 / v1.1.0-stable)
│
└── docs/
    ├── INDEX.md                          # [MỚI] Mục lục điều hướng toàn bộ tài liệu (phân biệt rõ Tài liệu Sống vs Tài liệu Lưu trữ)
    │
    ├── 1. KIẾN TRÚC & VẬN HÀNH HIỆN HÀNH (Living Architecture & Operations)
    │   ├── architecture-overview.md      # [MỚI - TÀI LIỆU SỐNG] Kiến trúc tổng thể: Engine Tử Vi -> Context Builder -> Key Pool & AI SSE -> Sanitizer -> UI/Export
    │   └── key-pool-operations.md        # [HỢP NHẤT & CẬP NHẬT TỪ key-pool-design-plan + h4-diagnosis] Đặc tả hiện hành của server/key-pool/* (AES-256-GCM, 35s/5 keys, modelCooldowns, continuation, H4)
    │
    ├── 2. ĐẶC TẢ TÍNH NĂNG HIỆN HÀNH (Living Feature Specifications)
    │   └── features-dossier-and-chat.md  # [HỢP NHẤT & CẬP NHẬT TỪ feature-plan-v2 + dossier-fix-v2 + QĐ-H1..H7] Đặc tả Hồ Sơ 8 Chương, Hỏi Đáp Ngữ Cảnh, Hợp Hôn SSE, Bộ lọc 3A/3B & Kết xuất S5
    │
    ├── 3. SỔ CÁI QUYẾT ĐỊNH & KIỂM TOÁN (Decision Registry & Current Audit)
    │   ├── decisions-registry.md         # [MỚI - SỔ CÁI DUY NHẤT] Bảng tra cứu toàn bộ các quyết định đã chốt: QĐ-1..6, F1–F7, QĐ-G1..G6, QĐ-H1..H7, QĐ-D1..D6
    │   ├── h4-diagnosis.md               # [CẬP NHẬT NHÃN TRẠNG THÁI] Biên bản chẩn đoán kỹ thuật H4 (gắn nhãn: ĐÃ THI CÔNG & ĐẠT TEST 18)
    │   └── logic-code-audit-v2.md        # [CẬP NHẬT NHÃN & ĐÍNH CHÍNH B-05] Báo cáo kiểm toán V2 (cập nhật bảng kết quả đã thi công QĐ-H1..H7 & chú thích đính chính B-05 dẫn sang h4-diagnosis.md)
    │
    └── archive/                          # [MỚI - KHU LƯU TRỮ LỊCH SỬ BẤT BIẾN (CÓ BANNER CẢNH BÁO ĐẦU TRANG)]
        ├── key-pool-design-plan.md               # Kế hoạch thiết kế Kho Khóa gốc (đã hợp nhất vào docs/key-pool-operations.md)
        ├── key-pool-expert-panel-review.md       # Biên bản Panel Kho Khóa (lịch sử trước khi nâng 25s -> 35s ở QĐ-5)
        ├── feature-plan-3-tinh-nang.md           # Bản nháp V1 3 tính năng
        ├── feature-plan-panel-review.md          # Biên bản Panel 3 tính năng
        ├── feature-plan-3-tinh-nang-v2.md        # Kế hoạch V2 3 tính năng (đã hợp nhất vào docs/features-dossier-and-chat.md)
        ├── fix-round-diagnosis.md                # Chẩn đoán lỗi B1–B3 trước Pha B (đã giải quyết xong)
        ├── heming-form-reset-diagnosis.md        # Chẩn đoán lỗi reset giờ Tý Hợp Hôn (đã giải quyết xong)
        ├── stream-interruption-diagnosis.md      # Chẩn đoán ngắt luồng 503 trước Pha B (đã giải quyết xong)
        ├── dossier-fix-plan-v1.md                # Bản nháp V1 sửa Hồ Sơ 8 Chương
        ├── dossier-fix-panel-review.md           # Biên bản Panel sửa Hồ Sơ 8 Chương
        ├── dossier-fix-plan-v2.md                # Kế hoạch V2 sửa Hồ Sơ 8 Chương (đã hợp nhất vào docs/features-dossier-and-chat.md)
        ├── logic-code-audit-v1.md                # Bản nháp V1 rà soát toàn diện (trước Panel)
        └── logic-code-audit-panel-review.md      # Biên bản Panel 5 vai rà soát toàn diện
```

---

### 2.2. Quy tắc "Một Nguồn Sự Thật" (Single Source of Truth — SSOT)

Để không bao giờ lặp lại cảnh một thông số (như ngân sách `25s` vs `35s`, số lượng khóa `3/23` vs `7/17`, hay nhịp nghỉ `2200ms` vs `1200ms`) bị ghi khác nhau ở nhiều file, mỗi nhóm thông tin chỉ được phép định nghĩa tại **ĐÚNG MỘT NGUỒN CHỦ DUY NHẤT**:

| Nhóm thông tin / Thông số | Nguồn Sự Thật trong Code (Code SSOT) | Tài liệu Chủ Duy Nhất (Doc SSOT) | Quy tắc cho các tài liệu khác |
|---|---|---|---|
| **1. Số phiên bản hiện hành & trạng thái bộ test** | `package.json:4` + các script `scripts/verify-*.ts` | `/VERSION` & `/CHANGELOG.md` | Chỉ dẫn link tới `/VERSION`, **cấm chép cứng** số lượng test (`14/14`, `17/17`) vào các file thiết kế tính năng. |
| **2. Cấu hình Model AI & Ngân sách Failover (`35s / 5 keys / 12s TTFB`)** | `server/key-pool/types.ts:179–200` (`DEFAULT_MODEL`, `FALLBACK_MODEL`, `TOTAL_FAILOVER_TIME_BUDGET_MS = 35_000`, `MAX_KEY_ATTEMPTS = 5`, `FIRST_CHUNK_TIMEOUT_MS = 12_000`) | `docs/key-pool-operations.md` (Mục *Hằng số Vận hành*) | Mọi tài liệu khác chỉ dẫn link tới `docs/key-pool-operations.md#hang-so-van-hanh` hoặc `server/key-pool/types.ts:179–200`. |
| **3. Số lượng khóa & trạng thái Kho Khóa (`total / ready / cooldown / disabled`)** | Dữ liệu động tại `.data/gemini-key-pool.enc.json` & API `GET /api/key-pool` (`summary`) | **KHÔNG GHI CỨNG TRONG BẤT KỲ TÀI LIỆU SỐNG NÀO** | Tài liệu chỉ mô tả cơ chế trạng thái (`ready`, `cooldown`, `disabled`) và cách xem qua UI Quản lý Kho Khóa hoặc `GET /api/key-pool`. Nếu nêu trong biên bản lịch sử phải ghi rõ *"Ảnh chụp tại thời điểm HH:MM ngày DD/MM/YYYY"*. |
| **4. Danh sách 8 chương Hồ Sơ, `StoredDossierRecord` & Nhịp nghỉ `1200ms`** | `src/lib/dossier-chat-ui.ts:546–590, 667–673` | `docs/features-dossier-and-chat.md` | Các tài liệu khác dẫn link tới `docs/features-dossier-and-chat.md`, không tự liệt kê lại tên mã chương cũ. |
| **5. Quy tắc Hậu kiểm văn bản AI (Lớp 3A + Lớp 3B + Canonical Heading + Strip Meta)** | `src/lib/ziwei/text-sanitizer.ts` & `src/lib/dossier-chat-ui.ts:169–208` | `docs/features-dossier-and-chat.md` (Mục *Pipeline Hậu kiểm Văn bản*) | Mọi nơi tham chiếu dẫn link về mục này. |
| **6. Các quyết định kiến trúc của Chủ dự án (`QĐ-1..6`, `F1–F7`, `QĐ-G1..G6`, `QĐ-H1..H7`, `QĐ-D1..D6`)** | Các commit/chỉnh sửa tương ứng trong code | `docs/decisions-registry.md` | Mọi tài liệu thiết kế chỉ ghi mã quyết định (ví dụ `[Theo QĐ-H3]`) kèm link tới `docs/decisions-registry.md`. |

---

## PHẦN 3 — CHÍNH SÁCH VÒNG ĐỜI TÀI LIỆU, ĐÁNH SỐ PHIÊN BẢN & BACKUP

### 3.1. Chính sách Lưu trữ Lịch sử (`docs/archive/`) & Banner Cảnh báo Bắt buộc

1. **Nguyên tắc Không Xóa Lịch Sử nhưng Cách Ly Khỏi Luồng Đọc Chính**:
   - Toàn bộ các bản kế hoạch V1 (`*-v1.md`, `feature-plan-3-tinh-nang.md`), các biên bản phản biện Panel trung gian (`*-panel-review.md`), các biên bản chẩn đoán lỗi cục bộ đã đóng (`fix-round-diagnosis.md`, `heming-form-reset-diagnosis.md`, `stream-interruption-diagnosis.md`), và các bản kế hoạch V2 đã được hợp nhất vào Tài liệu Sống (`key-pool-design-plan.md`, `feature-plan-3-tinh-nang-v2.md`, `dossier-fix-plan-v2.md`) sẽ được chuyển vào **`docs/archive/`**.
2. **Mẫu Banner Cảnh báo Bắt buộc ở dòng đầu tiên của mọi file trong `docs/archive/`**:
   Ngay dòng đầu tiên của mỗi file khi chuyển vào `docs/archive/`, bắt buộc chèn khối cảnh báo chuẩn sau:
   ```markdown
   > ⚠️ **[TÀI LIỆU LỊCH SỬ ĐÃ LƯU TRỮ — KHÔNG DÙNG LÀM CĂN CỨ CODE HIỆN HÀNH]**
   > - **Trạng thái**: Đã hoàn thành vai trò lịch sử / Đã bị thay thế bởi tài liệu sống **[`<Tên tài liệu đích>`](../<duong-dan-tai-lieu-dich>.md)** từ ngày `17/11/2026`.
   > - **Cảnh báo cho Kỹ sư & AI Agent**: Các trích dẫn số dòng, tên biến, hằng số (như ngân sách 25s, nhịp nghỉ 2200ms, số lượng key 3/23) trong file này phản ánh thời điểm trước khi hợp nhất và **không còn khớp với mã nguồn hiện hành**. Tuyệt đối đọc tài liệu sống tại thư mục `docs/` gốc và đối chiếu code thật trước khi chẩn đoán hoặc sửa code!
   ```
   *Ý nghĩa thực tiễn*: Chặn đứng 100% nguy cơ một phiên AI trong tương lai quét trúng file chẩn đoán cũ (như vụ `stream-interruption-diagnosis.md` dẫn tới nhận định sai `B-05`) rồi tưởng đó là code hiện hành.

---

### 3.2. Tiêu chuẩn Khối Siêu dữ liệu Đầu trang (Header Standard) cho mọi Tài liệu Sống

Mọi tài liệu nằm ngoài `docs/archive/` (tức các tài liệu sống trong `/` và `/docs/`) bắt buộc phải mở đầu bằng khối Header chuẩn 6 trường sau:

```markdown
# <TÊN TÀI LIỆU>

- **Loại tài liệu**: `[Tài liệu Sống — Kiến trúc / Đặc tả / Sổ cái Quyết định]` *(hoặc `[Báo cáo Kiểm toán đã thi công]`)*
- **Trạng thái hiệu lực**: `ĐANG HIỆU LỰC (ACTIVE)`
- **Áp dụng cho phiên bản ứng dụng**: `1.1.0-rc.1` *(đồng bộ với file `/VERSION`)*
- **Cập nhật lần cuối**: `17/11/2026` (sau đợt thi công `QĐ-H1..H7`)
- **Mã nguồn đối chiếu (Code SSOT)**: `<Danh sách đường dẫn file code chính liên quan>`
- **Quyết định liên quan**: `<Danh sách mã QĐ trong docs/decisions-registry.md>`
```

---

### 3.3. Quy trình 5 bước gắn kết Vòng đời Code & Vòng đời Tài liệu

Mỗi đợt phát triển hoặc sửa lỗi lớn trong dự án tuân thủ nghiêm ngặt chu trình 5 bước, trong đó **Bước 5 là điều kiện bắt buộc để đóng lượt thi công**:

1. **Bước 1 — Chẩn đoán / Lập Kế hoạch V1**: Đọc `docs/INDEX.md`, Tài liệu Sống liên quan và **code thật**; lập file nháp tạm thời.
2. **Bước 2 — Phản biện Panel & Hợp nhất V2**: Kiểm chứng độc lập từng `file:dòng`, loại bỏ dương tính giả, trình danh mục `QĐ-*`.
3. **Bước 3 — Chủ dự án Phê duyệt**: Chốt phương án cho từng `QĐ-*`.
4. **Bước 4 — Thi công Code & Kiểm thử Tự động**: Sửa code, chạy `tsc`, `vite build`, bộ script `verify-*`, quét `dist/` 0 lộ key.
5. **Bước 5 — Đồng bộ Tài liệu Sống & Đóng gói Phiên bản (BẮT BUỘC)**:
   - Cập nhật quyết định vừa thi công vào `docs/decisions-registry.md`.
   - Cập nhật thay đổi kiến trúc/tính năng vào `docs/key-pool-operations.md` hoặc `docs/features-dossier-and-chat.md`.
   - Chuyển các file nháp V1 / biên bản Panel của đợt đó vào `docs/archive/` kèm Banner cảnh báo.
   - Cập nhật `/VERSION` và `/CHANGELOG.md`.

---

### 3.4. Chính sách Đánh số Phiên bản (Semantic Versioning) & Backup cho trạng thái hiện tại (sau đợt `QĐ-H1..H7`)

1. **Quy ước đánh số phiên bản (`MAJOR.MINOR.PATCH-<tag>`)**:
   - `1.0.0-stable`: Mốc chuẩn đã sao lưu tại `backup/v1.0.0-stable/` (gồm `QĐ-1..6`, `F1–F7`, `QĐ-G1..G6`, dọn dòng meta kết xuất).
   - Khi có một đợt nâng cấp/hiệu chỉnh lớn đa mảng như đợt **`QĐ-H1..H7`** (mở rộng cache 8 chương `sessionStorage`, mở rộng khóa định danh lá số, bổ sung Tam Phương Tứ Chính vào bảng dữ kiện AI, tinh chỉnh phân loại lỗi `AbortError` sang `MODEL_UNAVAILABLE`, chuẩn hóa SSE Hợp Hôn, rút gọn `cities.ts` ~28KB, tinh chỉnh Lớp 3A/3B và giảm nhịp nghỉ xuống `1200ms`), số phiên bản tăng **MINOR** từ `1.0.0` lên **`1.1.0`**.
2. **Xử lý trạng thái hiện tại (khi toàn bộ test offline `18/18`, `6/6`, `18/18` đã ĐẠT nhưng kiểm chứng live `H1` trên trình duyệt đang chờ quota)**:
   - **Giai đoạn hiện tại (Ngay khi thực thi cập nhật tài liệu)**: Đánh dấu phiên bản trong `/VERSION` và `CHANGELOG.md` là **`1.1.0-rc.1`** (*Release Candidate 1 — Đã hoàn tất thi công `QĐ-H1..H7` và đạt 100% kiểm thử tự động offline; chờ kiểm chứng live `H1` khi kho khóa hồi quota*). Giữ nguyên `backup/v1.0.0-stable/` làm mốc khôi phục an toàn.
   - **Ngay sau khi Chủ dự án kiểm chứng live `H1` đạt trên trình duyệt**: Nâng `/VERSION` và `package.json` lên **`1.1.0-stable`** và tạo bản sao lưu đóng băng mới tại **`backup/v1.1.0-stable/`** kèm `BACKUP-MANIFEST.md` mới (hoặc nếu Chủ dự án quyết định chốt thẳng `1.1.0-stable` ngay trong lượt thi công tài liệu sắp tới dựa trên bài test tự động `TEST-12` đã kiểm chứng lưu/đọc đủ 8 chương trong `sessionStorage`, có thể chọn tại **`QĐ-D5`**).

---

## PHẦN 4 — KẾ HOẠCH THỰC THI CẬP NHẬT TÀI LIỆU (STEP-BY-STEP EXECUTION PLAN)

> **Lưu ý**: Phần này là kế hoạch chi tiết để thực thi ở **lượt tiếp theo sau khi Chủ dự án phê duyệt**. Trong lượt hiện tại, tuyệt đối chưa thực hiện bất kỳ thao tác nào dưới đây.

### 4.1. Thứ tự thực thi chi tiết (7 Bước tuần tự)

| Bước | Nhiệm vụ cụ thể | Các file mã nguồn BẮT BUỘC đọc đối chiếu khi viết | Các file tài liệu được Tạo mới / Cập nhật / Di chuyển | Ước lượng công sức |
|:---:|---|---|---|:---:|
| **Bước 1** | **Tạo thư mục lưu trữ `docs/archive/` và di chuyển 13 tài liệu lịch sử/trung gian vào `docs/archive/` kèm gắn Banner cảnh báo đầu trang** | Không cần đọc lại code; đối chiếu danh sách 13 file ở Mục 2.1 | Di chuyển vào `docs/archive/` và chèn Banner đầu trang cho: `key-pool-design-plan.md`, `key-pool-expert-panel-review.md`, `feature-plan-3-tinh-nang.md`, `feature-plan-panel-review.md`, `feature-plan-3-tinh-nang-v2.md`, `fix-round-diagnosis.md`, `heming-form-reset-diagnosis.md`, `stream-interruption-diagnosis.md`, `dossier-fix-plan-v1.md`, `dossier-fix-panel-review.md`, `dossier-fix-plan-v2.md`, `logic-code-audit-v1.md`, `logic-code-audit-panel-review.md` | **M** *(~15 phút)* |
| **Bước 2** | **Cập nhật nhãn trạng thái và chú thích đính chính cho 2 tài liệu kiểm toán giữ lại ở `docs/` (`h4-diagnosis.md` & `logic-code-audit-v2.md`)** | `server/key-pool/executor.ts:220–425`, `server/key-pool/allocator.ts:105–170`, `scripts/verify-key-pool.ts` | - `docs/h4-diagnosis.md`: Cập nhật Header thành `ĐÃ THI CÔNG & ĐẠT KIỂM CHỨNG (TEST 18 — 18/18)`.<br>- `docs/logic-code-audit-v2.md`: Cập nhật Header + Bảng kết quả đã thi công `QĐ-H1..H7`; thêm hộp chú thích đính chính ngay đầu mục `B-05` dẫn link sang `docs/h4-diagnosis.md` để cảnh báo các biến ảo `timedOutWaitingFirstChunk` / `receivedFirstChunk`. | **S** *(~10 phút)* |
| **Bước 3** | **Soạn thảo Sổ cái Quyết định Kiến trúc (`docs/decisions-registry.md`)** | Đối chiếu kết quả thực thi trong `server/key-pool/*`, `src/lib/dossier-chat-ui.ts`, `src/lib/ziwei/text-sanitizer.ts` | Tạo mới `docs/decisions-registry.md` tổng hợp đầy đủ 4 đợt quyết định: `QĐ-1..QĐ-6` (Kho Khóa), `F1–F7` (3 Tính năng), `QĐ-G1..QĐ-G6` (Sửa Hồ Sơ & Dọn Meta), `QĐ-H1..QĐ-H7` (Rà soát Logic & Code), và `QĐ-D1..QĐ-D6` (Tài liệu). | **M** *(~15 phút)* |
| **Bước 4** | **Soạn thảo 2 Tài liệu Đặc tả Sống (`docs/key-pool-operations.md` & `docs/features-dossier-and-chat.md`)** | - Đọc `server/key-pool/types.ts`, `allocator.ts`, `executor.ts`, `crypto-store.ts`, `index.ts`<br>- Đọc `src/lib/dossier-chat-ui.ts`, `src/lib/ziwei/text-sanitizer.ts`, `src/lib/ziwei/yunxian-context.ts`, `src/lib/ziwei/dossier-context.ts`, `src/components/DetailedDossierModal.tsx`, `src/components/ContextualChatDrawer.tsx`, `src/components/HemingView.tsx` | - Tạo mới `docs/key-pool-operations.md` (thay thế hoàn toàn `key-pool-design-plan.md` với số liệu thật `35s/5 keys/12s`, `probeFloorScore = 95`, `modelCooldowns`, `buildContinuationPrompt`, `CALL_SUCCESS`, và `QĐ-H4`).<br>- Tạo mới `docs/features-dossier-and-chat.md` (thay thế `feature-plan-3-tinh-nang-v2.md` & `dossier-fix-plan-v2.md` với đúng 8 mã chương thật, `sessionStorage` đủ 8 chương, nhịp nghỉ `1200ms`, khóa định danh mở rộng, Tam Phương Tứ Chính tường minh, Lớp 3A/3B, Header S5 & Strip Meta). | **L** *(~25 phút)* |
| **Bước 5** | **Soạn thảo Tài liệu Kiến trúc Tổng thể (`docs/architecture-overview.md`) & Mục lục Điều hướng (`docs/INDEX.md`)** | `src/lib/ziwei/algorithm.ts`, `src/lib/ziwei/true-solar-time.ts`, `src/lib/ziwei/share.ts`, `server.ts`, `src/App.tsx` | - Tạo mới `docs/architecture-overview.md` (Sơ đồ luồng dữ liệu 5 tầng, danh sách API endpoints trong `server.ts`, danh sách các vùng bất biến cấm tự ý sửa như `algorithm.ts`, `SI_HUA_TABLE`, `backup/`).<br>- Tạo mới `docs/INDEX.md`. | **M** *(~15 phút)* |
| **Bước 6** | **Soạn thảo `README.md`, `CHANGELOG.md` và cập nhật `/VERSION` ở thư mục gốc (cùng `package.json` nếu được duyệt)** | `/VERSION`, `/package.json`, `/metadata.json`, `scripts/verify-*.ts` | - Tạo mới `/README.md` (Cửa ngõ dự án, hướng dẫn chạy dev/build/test, liên kết tới `docs/INDEX.md`).<br>- Tạo mới `/CHANGELOG.md` (Ghi nhận đầy đủ `v1.0.0-stable` và `v1.1.0-rc.1` / `v1.1.0-stable`).<br>- Cập nhật `/VERSION`. | **M** *(~15 phút)* |
| **Bước 7** | **Chạy Bộ Kiểm Chứng Chéo Tài Liệu (Cross-Check Verification Suite)** | Toàn bộ `/README.md`, `/VERSION`, `/CHANGELOG.md`, `/docs/**/*.md` | Chạy các lệnh kiểm tra tự động ở Mục 4.2 bên dưới để đảm bảo 0 thông số lỗi thời ở tài liệu sống, 0 đường dẫn đứt, 0 khóa API nguyên văn. | **S** *(~5 phút)* |

---

### 4.2. Danh sách kiểm tra tự động (Verification Checklist) sau khi cập nhật tài liệu

Sau khi hoàn tất 6 bước biên tập ở lượt thi công tài liệu, phải chạy đủ **5 phép kiểm chứng tự động** sau:

1. **Kiểm chứng 0 khóa API nguyên văn trên toàn bộ tài liệu & mã nguồn**:
   - Lệnh: `grep -rnE "AIzaSy[A-Za-z0-9_-]{10,}" README.md VERSION CHANGELOG.md docs/ src/ server/`
   - Kỳ vọng: **0 kết quả** (chỉ cho phép chuỗi che mặt nạ mẫu kiểu `AIzaSy••••••xxxx`).
2. **Kiểm chứng 0 thông số lỗi thời trong nhóm Tài liệu Sống (`docs/*.md` ngoài `docs/archive/`)**:
   - Quét các cụm từ lỗi thời từng gây nhầm lẫn:
     - `TOTAL_FAILOVER_TIME_BUDGET_MS = 25_000` (phải là `35_000`)
     - `DOSSIER_INTER_CHAPTER_PACING_MS = 2_200` (phải là `1_200`)
     - `chapter_palaces_core` / `chapter_year_2026` / `localStorage + IndexedDB` (không được mô tả như kiến trúc hiện hành)
     - `timedOutWaitingFirstChunk` / `receivedFirstChunk` (chỉ được xuất hiện trong hộp cảnh báo bác bỏ dương tính giả, không được mô tả như biến có thật trong code).
3. **Kiểm chứng 100% file trong `docs/archive/` có Banner cảnh báo đầu trang**:
   - Lệnh: Kiểm tra dòng 1 của tất cả các file trong `docs/archive/*.md` đều bắt đầu bằng `> ⚠️ **[TÀI LIỆU LỊCH SỬ ĐÃ LƯU TRỮ`.
4. **Kiểm chứng 100% Tài liệu Sống có Header chuẩn 6 trường**:
   - Kiểm tra `docs/INDEX.md`, `docs/architecture-overview.md`, `docs/key-pool-operations.md`, `docs/features-dossier-and-chat.md`, `docs/decisions-registry.md` đều có đủ `Trạng thái hiệu lực`, `Áp dụng cho phiên bản ứng dụng`, `Cập nhật lần cuối`, `Mã nguồn đối chiếu`.
5. **Kiểm chứng tính toàn vẹn của thư mục `backup/v1.0.0-stable/` và bộ test code**:
   - Xác nhận `backup/v1.0.0-stable/` giữ nguyên `87` file không thay đổi.
   - Nếu có cập nhật `package.json` (thêm scripts `verify:*`), chạy lại `npx tsc --noEmit` và `compile_applet` để đảm bảo build sạch 100%.

---

## PHẦN 5 — DANH SÁCH QUYẾT ĐỊNH TRÌNH CHỦ DỰ ÁN DUYỆT (`QĐ-D1` .. `QĐ-D6`)

Kính trình Chủ dự án xem xét và phê duyệt **6 quyết định (`QĐ-D1` .. `QĐ-D6`)** dưới đây trước khi bước vào lượt thi công tài liệu:

---

### `QĐ-D1` — Cấu trúc thư mục tài liệu đích (`README.md`, `CHANGELOG.md`, `docs/` + `docs/archive/`)
- **Bối cảnh**: Dự án hiện chưa có `README.md` và `CHANGELOG.md` ở thư mục gốc; trong `docs/` đang có 15 file (và thêm file kế hoạch này là 16 file) nằm phẳng ngang hàng nhau, trộn lẫn giữa bản nháp V1, biên bản Panel, chẩn đoán cũ và bản V2.
- **Các phương án**:
  - **Phương án A (Khuyến nghị)**: Tạo mới `/README.md`, `/CHANGELOG.md`, `/docs/INDEX.md` và **4 Tài liệu Sống cốt lõi** tại `/docs/` (`architecture-overview.md`, `key-pool-operations.md`, `features-dossier-and-chat.md`, `decisions-registry.md`), giữ lại `h4-diagnosis.md` & `logic-code-audit-v2.md` (đã cập nhật nhãn trạng thái & đính chính `B-05`) tại `/docs/`, đồng thời di chuyển 13 file lịch sử/bản nháp cũ vào `/docs/archive/`.
  - **Phương án B**: Không tạo các file tổng hợp mới (`architecture-overview.md`, `key-pool-operations.md`, `features-dossier-and-chat.md`), chỉ sửa trực tiếp trên `key-pool-design-plan.md`, `feature-plan-3-tinh-nang-v2.md`, `dossier-fix-plan-v2.md` và chuyển các bản V1/Panel vào `docs/archive/`.
  - **Phương án C**: Giữ nguyên toàn bộ 15 file nằm phẳng trong `docs/`, chỉ thêm `README.md` và gắn nhãn đầu trang cho từng file.
- **Lý do khuyến nghị Phương án A**: Phương án A tách bạch hoàn toàn *"Đặc tả kiến trúc & tính năng hiện hành"* khỏi *"Kế hoạch thi công từng đợt"*, giúp mọi kỹ sư hoặc phiên AI sau này chỉ cần đọc 4 file Tài liệu Sống ngắn gọn, chính xác tuyệt đối mà không phải đọc ghép nối qua lại giữa `feature-plan-v2` + `dossier-fix-v2` + `logic-code-audit-v2`.

---

### `QĐ-D2` — Chính sách xử lý 13 tài liệu lịch sử (bản nháp V1, biên bản Panel, chẩn đoán cũ): Di chuyển vào `docs/archive/` kèm Banner hay Xóa hẳn?
- **Bối cảnh**: Các file như `stream-interruption-diagnosis.md`, `key-pool-expert-panel-review.md` (`25s`), `feature-plan-3-tinh-nang.md` (V1), `dossier-fix-plan-v1.md`, `logic-code-audit-v1.md` chứa nhiều thông số và giả định đã bị thay thế, từng gây nhiễu cho việc chẩn đoán code.
- **Các phương án**:
  - **Phương án A (Khuyến nghị)**: **Không xóa file nào**; di chuyển toàn bộ 13 file lịch sử/trung gian vào thư mục `docs/archive/` và chèn **Banner cảnh báo bắt buộc** ngay dòng đầu tiên của mỗi file (ghi rõ đã bị thay thế bởi tài liệu sống nào và cảnh báo không dùng làm căn cứ đọc/sửa code hiện hành).
  - **Phương án B**: Xóa hẳn các bản nháp V1 (`*-v1.md`, `feature-plan-3-tinh-nang.md`) vì đã có trong lịch sử/backup, chỉ giữ các biên bản Panel và V2 trong `docs/archive/`.
- **Lý do khuyến nghị Phương án A**: Bảo toàn 100% dấu vết lịch sử tư duy và phản biện của dự án để tra cứu khi cần, đồng thời cách ly hoàn toàn khỏi thư mục `docs/` chính và có Banner chặn ngay ở dòng 1 nên không bao giờ gây nhầm lẫn nữa.

---

### `QĐ-D3` — Phạm vi đối tượng của bộ tài liệu: Thuần Kỹ thuật & Vận hành nội bộ hay có thêm Cẩm nang Người dùng cuối?
- **Bối cảnh**: Cần xác định rõ đối tượng độc giả của `README.md` và `docs/*` để phân bổ dung lượng hợp lý.
- **Các phương án**:
  - **Phương án A (Khuyến nghị)**: Tập trung **100% vào Tài liệu Kỹ thuật, Kiến trúc, Học thuật Tử Vi trong Engine & Quy trình Vận hành nội bộ** dành cho Chủ dự án và các phiên AI kỹ sư (bao gồm hướng dẫn vận hành Kho Khóa Gemini, cấu trúc 8 chương Hồ Sơ, quy tắc bất biến của Engine và cách chạy bộ test `verify-*`).
  - **Phương án B**: Viết thêm một tài liệu hướng dẫn sử dụng giao diện riêng (`docs/user-guide.md`) dành cho người dùng phổ thông.
- **Lý do khuyến nghị Phương án A**: Giao diện ứng dụng Tử Vi Thiên Kỷ đã trực quan bằng tiếng Việt; nhu cầu cấp thiết nhất hiện nay là tài liệu chuẩn xác cho Chủ dự án quản trị và cho các phiên AI tiếp theo không đọc lệch kiến trúc.

---

### `QĐ-D4` — Quy tắc "Một Nguồn Sự Thật" (SSOT) đối với số liệu biến động (như trạng thái Kho Khóa `7/17`) và ngôn ngữ trình bày
- **Bối cảnh**: Việc chép cứng số lượng key (`23 key: 3 ready, 20 cooldown` hay `7 key lỗi`) vào tài liệu thiết kế khiến tài liệu lập tức lỗi thời ngay khi Kho Khóa thay đổi (hiện tại là `17 key: 7 ready, 10 cooldown`).
- **Các phương án**:
  - **Phương án A (Khuyến nghị)**:
    1. Toàn bộ tài liệu viết bằng **tiếng Việt** chuẩn xác, giữ nguyên tên định danh kỹ thuật (`function`, `interface`, `const`, đường dẫn file) trong cặp dấu backtick.
    2. **Cấm ghi cứng số lượng khóa runtime (`ready`/`cooldown`) trong mọi Tài liệu Sống**; chỉ mô tả cơ chế và dẫn chiếu tới API `GET /api/key-pool` (`summary`).
    3. Mọi hằng số cấu hình (`35_000ms`, `5 keys`, `12_000ms`, `1_200ms`) chỉ định nghĩa ở Tài liệu Chủ duy nhất của mảng đó kèm trích dẫn `file:dòng`, các tài liệu khác chỉ dẫn link.
  - **Phương án B**: Vẫn ghi con số `17 key (7 ready, 10 cooldown)` vào Tài liệu Sống kèm ngày chụp.
- **Lý do khuyến nghị Phương án A**: Đảm bảo Tài liệu Sống không bao giờ bị lỗi thời khi Chủ dự án thêm/xóa key hoặc khi hết thời gian `cooldown`.

---

### `QĐ-D5` — Chính sách đánh số phiên bản cho nhánh hiện tại sau đợt thi công `QĐ-H1..H7` (`1.1.0-rc.1` hay chốt thẳng `1.1.0-stable` + tạo `backup/v1.1.0-stable/`?)
- **Bối cảnh**:File `/VERSION` hiện vẫn ghi `1.0.0-stable` (trước đợt `QĐ-H1..H7`). Hiện tại toàn bộ `QĐ-H1..H7` đã vào code và đạt 100% bộ kiểm thử tự động offline (`tsc` 0 lỗi, `build` đạt, `verify-key-pool` `18/18`, `verify-dossier-context` `6/6`, `verify-dossier-chat-ui` `18/18` — trong đó `TEST-12` đã kiểm chứng lưu/đọc đủ 8 chương trong `sessionStorage` cho `H1`), chỉ còn bước kiểm chứng live `H1` trên trình duyệt đang tạm hoãn vì chờ quota.
- **Các phương án**:
  - **Phương án A (Khuyến nghị — Thận trọng theo đúng kỷ luật kiểm chứng live)**:
    - Trong lượt cập nhật tài liệu tới, nâng `/VERSION` và `/CHANGELOG.md` lên **`1.1.0-rc.1`** (ghi rõ đã hoàn tất code `QĐ-H1..H7` + đạt 100% test offline `18/18`, `6/6`, `18/18`; chờ kiểm chứng live `H1`).
    - Giữ nguyên `backup/v1.0.0-stable/`, chưa tạo thư mục backup mới cho tới khi Chủ dự án xác nhận kiểm chứng live `H1` đạt thì mới nâng lên **`1.1.0-stable`** và sao lưu `backup/v1.1.0-stable/`.
  - **Phương án B (Chốt thẳng `1.1.0-stable` kèm Backup mới)**:
    - Công nhận kết quả `TEST-12` trong `verify-dossier-chat-ui` (`18/18`) đã đủ điều kiện nghiệm thu `H1`, nâng thẳng `/VERSION` và `package.json` lên **`1.1.0-stable`** và tạo bản sao lưu `backup/v1.1.0-stable/` ngay sau khi đồng bộ xong bộ tài liệu mới.
  - **Phương án C**: Giữ nguyên `/VERSION` là `1.0.0-stable + post-release H1..H7`.
- **Lý do khuyến nghị Phương án A**: Tuân thủ đúng nguyên tắc kỹ thuật đã áp dụng ở các đợt trước (chỉ gắn nhãn `-stable` và đóng băng backup khi cả kiểm thử offline lẫn kiểm chứng live đều hoàn tất), đồng thời nhãn `1.1.0-rc.1` phản ánh trung thực 100% trạng thái tiến bộ của code so với `1.0.0-stable`.

---

### `QĐ-D6` — Đồng bộ siêu dữ liệu `package.json` (Tên gói, Phiên bản & Scripts chạy bộ kiểm thử `verify:*`)
- **Bối cảnh**: Kiểm tra `/package.json:2–14` thấy `"name"` vẫn là `"react-example"`, `"version"` là `"1.0.0"`, và mục `"scripts"` mới chỉ có `"verify:engine": "tsx scripts/verify-engine.ts"`, chưa khai báo script cho 4 bộ test cốt lõi đang dùng hàng ngày (`verify-key-pool.ts`, `verify-dossier-context.ts`, `verify-dossier-chat-ui.ts`, `verify-yunxian.ts`).
- **Các phương án**:
  - **Phương án A (Khuyến nghị)**: Trong lượt cập nhật tài liệu tới, cho phép cập nhật nhẹ `package.json` (bằng `replace_file_content`, tuyệt đối không thêm/bớt dependency): đổi `"name"` thành `"tu-vi-thien-ky"`, đồng bộ `"version"` với `/VERSION`, và thêm các script tiện ích `"verify:key-pool"`, `"verify:dossier-context"`, `"verify:dossier-ui"`, `"verify:yunxian"`, `"verify:all"` để khớp với tài liệu hướng dẫn trong `README.md`.
  - **Phương án B**: Giữ nguyên `package.json` 100%, trong `README.md` chỉ hướng dẫn chạy bằng lệnh trực tiếp `npx tsx scripts/verify-*.ts`.
- **Lý do khuyến nghị Phương án A**: Giúp `package.json` đồng bộ hoàn toàn với `metadata.json`, `/VERSION` và `README.md`, cho phép chạy toàn bộ 4 bộ kiểm thử tự động chỉ bằng một lệnh `npm run verify:all`.
