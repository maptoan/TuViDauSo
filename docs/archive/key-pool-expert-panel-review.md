> ⚠️ **[TÀI LIỆU LỊCH SỬ ĐÃ LƯU TRỮ — KHÔNG DÙNG LÀM CĂN CỨ CODE HIỆN HÀNH]**
> - **Trạng thái**: Đã hoàn thành vai trò lịch sử / Đã bị thay thế bởi tài liệu sống **[`docs/key-pool-operations.md`](../key-pool-operations.md)** từ ngày `17/11/2026`.
> - **Cảnh báo cho Kỹ sư & AI Agent**: Các trích dẫn số dòng, tên biến, hằng số (như ngân sách 25s, nhịp nghỉ 2200ms, số lượng key 3/23) trong file này phản ánh thời điểm trước khi hợp nhất và **không còn khớp với mã nguồn hiện hành**. Tuyệt đối đọc tài liệu sống tại thư mục `docs/` gốc và đối chiếu code thật trước khi chẩn đoán hoặc sửa code!

---
# Biên Bản Họp Tổ Chuyên Gia Phản Biện & Tối Ưu Kế Hoạch Gemini Key Pool (v1 → v2)

- **Ngày họp**: `2026-11-16`
- **Tài liệu được rà soát**: `docs/key-pool-design-plan.md` (Bản nháp v1)
- **Tài liệu đầu ra**: `docs/key-pool-design-plan.md` (Bản kế hoạch chi tiết hóa v2)
- **Hình thức họp Panel**: **Mô phỏng đa vai độc lập theo 2 vòng (Role-Based Multi-Expert Panel Simulation) ngay trong phiên làm việc của AI Studio**. Do môi trường thực thi AI Studio vận hành trên một phiên tác nhân (single-session agent execution), tổ chuyên gia được tổ chức thành 5 vai độc lập (1 Điều phối viên + 4 Chuyên gia chuyên sâu), tách biệt rõ ràng từng luận điểm phản biện ở Vòng 1, tranh biện chéo ở Vòng 2 và quyết định tổng hợp của Điều phối viên.
- **Giới hạn**: Chỉ thảo luận, phản biện và cập nhật tài liệu thiết kế — **tuyệt đối chưa triển khai bất kỳ dòng code nào**.

---

## 1. Thành Phần Tổ Chuyên Gia (Panel Roster)

1. **Điều phối viên (Moderator — Principal Systems Architect)**: Điều hành 2 vòng họp, phân xử các xung đột thiết kế giữa bảo mật, hiệu năng, hạn mức thực tế và trải nghiệm người dùng, tổng hợp thành đặc tả kỹ thuật v2.
2. **Chuyên gia 1 (CG1 — Kiến trúc Backend & Độ tin cậy)**: Chuyên trách thuật toán cấp phát key, điều khiển đồng thời (concurrency/locking), failover trong cùng request SSE, và ma trận kết hợp giữa xoay key với fallback model (`gemini-3.5-flash-lite` → `gemini-3.8-flash`).
3. **Chuyên gia 2 (CG2 — Bảo mật Khóa API & An toàn Thông tin)**: Chuyên trách cơ chế lưu trữ phía server trên AI Studio, dẫn xuất khóa mã hóa `AES-256-GCM`, chống rò rỉ key qua log / stack trace / API / client bundle, và kiểm soát truy cập Dashboard.
4. **Chuyên gia 3 (CG3 — Hành vi Quota Gemini Thực tế & SRE)**: Chuyên trách cơ chế tính quota của `generativelanguage.googleapis.com` theo cấp Google Cloud Project (`project_number`), phân loại lỗi `429` (RPM/TPM, RPD theo giờ PT, và `quota_limit_value = "0"` như Project `63415494298` tại `asia-southeast1`), Jitter chống bầy đàn cùng nguội, và phục hồi điểm sức khỏe.
5. **Chuyên gia 4 (CG4 — Trải nghiệm Quản trị & Vận hành UX/DX)**: Chuyên trách bộ parser nhập nhiều key đa định dạng, quy trình xem trước 2 bước, giao diện Dashboard, các thao tác kiểm tra/kích hoạt lại/xóa key, và hành vi suy giảm êm dịu (graceful degradation).

---

## 2. Thống Kê Tổng Quan Các Vấn Đề Phát Hiện Ở Vòng 1

Tổng cộng **18 vấn đề kỹ thuật** đã được 4 chuyên gia phát hiện độc lập trên bản nháp v1:

| Mức độ nghiêm trọng | Số lượng | Mã định danh vấn đề |
| :--- | :---: | :--- |
| **Nghiêm trọng (Critical)** | **3** | `E1-01`, `E2-01`, `E3-01` |
| **Cao (High)** | **6** | `E1-02`, `E1-03`, `E2-02`, `E3-02`, `E3-03`, `E4-01` |
| **Trung bình (Medium)** | **6** | `E1-04`, `E2-03`, `E3-04`, `E4-02`, `E4-03`, `E4-04` |
| **Thấp (Low)** | **3** | `E2-04`, `E3-05`, `E4-05` |
| **Tổng cộng** | **18** | Toàn bộ 18/18 vấn đề được xử lý và đưa vào Bản kế hoạch v2 |

---

## 3. VÒNG 1 — Phản Biện Độc Lập Của Từng Chuyên Gia

### 3.1. Chuyên gia 1 — Kiến trúc Backend & Độ tin cậy (CG1)

#### `E1-01` [Mức độ: NGHIÊM TRỌNG] — Race Condition khi cấp phát đồng thời & Ghi đè trạng thái file (Lost Update & Concurrent Over-Allocation)
- **Phân tích điểm yếu trong bản v1**:
  - Bản v1 dùng `roundRobinCursor` và cập nhật `stats`/`healthScore` rồi ghi xuống `.data/gemini-key-pool.enc.json`, nhưng chưa định nghĩa cơ chế đồng bộ hóa trong tiến trình Node.js khi có nhiều request chạy song song (ví dụ người dùng mở 2 tab hoặc vừa bấm luận giải kỳ hạn vừa bấm luận giải tổng quan).
  - Ngoài ra, `KeyAllocator` trong v1 chỉ xét `lastUsedAt` mà không đếm **`activeInFlightCount` (số request đang thực thi chưa xong trên key đó)**. Nếu 3 request đến trong cùng 5ms khi `K1` đang có điểm cao nhất, cả 3 có thể cùng nhảy vào `K1` nếu `roundRobinCursor` chưa kịp kết hợp với tải tức thời, hoặc 2 luồng ghi file `.tmp -> rename` chồng lấn nhau gây lỗi `ENOENT` trên Linux.
- **Đề xuất sửa đổi**:
  1. Bổ sung trường runtime `inFlightCount: number` cho mỗi key; cộng nhẹ điểm phạt tải tức thời `inFlightPenalty = inFlightCount * 6` vào `effectiveScore` để các request đồng thời tự động tản ra các key khác nhau.
  2. Mọi thao tác ghi xuống `.data/gemini-key-pool.enc.json` phải đi qua một **hàng đợi ghi tuần tự bất đồng bộ (`AsyncMutex / SerializedWriteQueue`)** có gộp ghi (coalesced debounce 100ms cho các cập nhật thống kê thông thường, ghi tức thì cho thao tác thêm/xóa/đổi trạng thái key).

#### `E1-02` [Mức độ: CAO] — Ma trận tương tác giữa Xoay Key (Key Failover) và Chuyển Model Dự phòng (Model Fallback) + Lỗi đứt gãy giữa luồng (Mid-Stream Drop)
- **Phân tích điểm yếu trong bản v1**:
  - Bản v1 viết: *"tối đa 3 lần đổi key + 1 lần chuyển fallback model"*, nhưng chưa trả lời rõ trường hợp biên:
    - **Trường hợp biên A**: Key 1 gọi `gemini-3.5-flash-lite` bị lỗi `404/503 MODEL_UNAVAILABLE` → chuyển sang `gemini-3.8-flash` trên Key 1. Nhưng nếu Key 1 ngay sau đó lại trả về `429 QUOTA_PROJECT_ZERO` trên `gemini-3.8-flash`, thì khi chuyển sang Key 2, hệ thống dùng lại `gemini-3.5-flash-lite` hay giữ `gemini-3.8-flash`?
    - **Trường hợp biên B (Mid-Stream Error)**: Nếu Key 1 đã stream được 300 chữ về trình duyệt rồi mới bị đứt kết nối (`ECONNRESET`), nếu tự động failover sang Key 2 và stream tiếp từ đầu, giao diện sẽ bị ghép 2 bài văn lặp nhau!
- **Đề xuất sửa đổi**:
  1. **Quy tắc Pre-First-Chunk vs Mid-Stream**: Chỉ cho phép tự động failover sang key khác hoặc model khác **TRƯỚC khi chunk văn bản đầu tiên được gửi xuống client (`firstChunkSent === false`)**. Nếu lỗi xảy ra sau khi đã gửi một phần văn bản (`firstChunkSent === true`), server cập nhật trạng thái lỗi nhẹ cho key, gửi một dòng cảnh báo Markdown cuối luồng `"\n\n*(Luồng kết nối bị gián đoạn giữa chừng — vui lòng bấm luận giải lại để nhận bản đầy đủ)*"` rồi kết thúc `[DONE]`, tuyệt đối không ghép đè luồng mới.
  2. **Quy tắc nhớ trạng thái Model trong phạm vi Request**: Nếu lỗi trên `defaultModel` là `404 Model Not Found` (model chưa mở ở cấp API/vùng), đánh dấu `defaultModelUnavailableInRegion = true` cho toàn bộ các lần thử tiếp theo trong request đó (dùng luôn `gemini-3.8-flash` khi sang Key 2). Ngược lại, nếu lỗi chỉ là `503 Overloaded` tạm thời, chỉ áp dụng cho lần thử hiện tại.

#### `E1-03` [Mức độ: CAO] — Nguy cơ kẹt vĩnh viễn cờ thăm dò `inFlightProbingIds` khi Request bị hủy (Abort / Timeout Leak)
- **Phân tích điểm yếu trong bản v1**:
  - Bản v1 dùng tập `inFlightProbingIds` để khóa không cho 2 request cùng probe 1 key vừa hết nguội. Tuy nhiên với SSE stream, nếu người dùng chuyển sang kỳ hạn khác trên `TimeNav` (`AbortController.abort()` phía client), vòng lặp `for await (const chunk of responseStream)` có thể kết thúc đột ngột. Nếu việc giải phóng `inFlightProbingIds.delete(key.id)` không được đặt trong khối `try ... finally` bao trùm toàn bộ hàm `acquire -> stream`, key đó sẽ bị khóa probe vĩnh viễn.
- **Đề xuất sửa đổi**:
  - Gói cơ chế cấp phát thành mẫu `acquireKeyLease()` trả về đối tượng `KeyLease` có phương thức `release(outcome)` bắt buộc gọi trong `finally`, kèm thời gian tự hết hạn khóa `LEASE_MAX_TTL_MS = 45_000` (45 giây) phòng hờ mọi trường hợp treo luồng.

#### `E1-04` [Mức độ: TRUNG BÌNH] — Thiếu thông số Timeout cứng cho từng lần thử trước chunk đầu tiên (`FIRST_CHUNK_TIMEOUT_MS`)
- **Phân tích điểm yếu trong bản v1**:
  - Bản v1 ước lượng "~20 giây" cho mỗi lần thử. Nếu thử 3 key + 1 fallback = 4 lần × 20 giây = 80 giây, kết nối HTTP qua proxy của AI Studio sẽ bị cắt (504 Gateway Timeout) trước khi key thứ 4 kịp trả lời.
- **Đề xuất sửa đổi**:
  - Quy định số liệu cụ thể:
    - `FIRST_CHUNK_TIMEOUT_MS = 12_000` (12 giây tối đa để nhận chunk đầu tiên cho mỗi lần thử trong `interpret*`).
    - `TEST_KEY_TIMEOUT_MS = 8_000` (8 giây cho nút "Kiểm tra thử 1 key").
    - `TOTAL_REQUEST_FAILOVER_BUDGET_MS = 35_000` (35 giây tổng ngân sách failover cho 1 request).

---

### 3.2. Chuyên gia 2 — Bảo mật Khóa API & An toàn Thông tin (CG2)

#### `E2-01` [Mức độ: NGHIÊM TRỌNG] — Lỗi thiết kế dẫn xuất khóa chủ (`masterKey`) phụ thuộc vào `process.env.GEMINI_API_KEY` gây mất toàn bộ kho khóa khi đổi Secret
- **Phân tích điểm yếu trong bản v1**:
  - Tại Mục 6.1.2, bản v1 viết: *"Khóa chủ (`masterKey` 32 byte) được dẫn xuất bằng `crypto.hkdfSync` từ biến môi trường `KEY_POOL_MASTER_SECRET`, kết hợp với `process.env.GEMINI_API_KEY`..."*.
  - **Rủi ro nghiêm trọng**: Nếu người dùng vào bảng Secrets của AI Studio để xóa hoặc thay đổi giá trị của `GEMINI_API_KEY` (hoặc thêm sau), đầu vào của hàm HKDF sẽ thay đổi → `masterKey` thay đổi → toàn bộ các key do người dùng nhập trước đó trong `.data/gemini-key-pool.enc.json` sẽ **không thể giải mã được nữa** (`GCM authentication tag mismatch`)!
- **Đề xuất sửa đổi**:
  - **Tuyệt đối KHÔNG dùng `process.env.GEMINI_API_KEY` làm nguyên liệu dẫn xuất khóa mã hóa `masterKey`**.
  - Thứ tự ưu tiên sinh `masterKey` độc lập:
    1. Nếu có `process.env.KEY_POOL_MASTER_SECRET` (khuyến nghị tùy chọn): dẫn xuất HKDF-SHA256 từ biến này.
    2. Nếu không có: tự động sinh 32 byte ngẫu nhiên mật mã học (`crypto.randomBytes(32)`) lưu vào `.data/.pool-master.key` (quyền `0600`). Miễn là thư mục `.data/` còn tồn tại thì `.pool-master.key` và `gemini-key-pool.enc.json` luôn khớp nhau 100%, bất chấp `GEMINI_API_KEY` trong Secrets có thay đổi hay không.
    3. Nếu một bản ghi lẻ trong file bị lỗi giải mã (corrupted record), chỉ bỏ qua bản ghi đó và ghi cảnh báo an toàn, không làm sập toàn bộ `KeyPoolStore`.

#### `E2-02` [Mức độ: CAO] — Nguy cơ lạm dụng API quản trị (`/api/key-pool/*`) khi ứng dụng được mở qua `Shared App URL`
- **Phân tích điểm yếu trong bản v1**:
  - Bản v1 đưa việc bảo vệ `/api/key-pool/*` vào "Quyết định còn mở". Tuy nhiên, dưới góc độ bảo mật, nếu người dùng chia sẻ `Shared App URL` (`ais-pre-...run.app`) cho bạn bè xem lá số Tử Vi mà quên đặt `KEY_POOL_ADMIN_PIN`, người xem có thể mở Dashboard xóa sạch key hoặc spam nút `POST /api/key-pool/:id/test`.
- **Đề xuất sửa đổi**:
  - Thiết kế cơ chế **Bảo vệ 2 lớp theo ngữ cảnh (Context-Aware Admin Guard)**:
    1. Nếu `process.env.KEY_POOL_ADMIN_PIN` được cấu hình: bắt buộc gửi header `x-key-pool-pin` khớp với PIN (so sánh bằng `crypto.timingSafeEqual`) cho mọi thao tác ghi (`POST /preview`, `POST /import`, `DELETE /:id`, `POST /:id/reactivate`, `POST /:id/test`, `PUT /models`).
    2. Ngay cả khi chưa đặt `KEY_POOL_ADMIN_PIN`: kiểm tra header `Origin` / `Referer` — nếu request đến từ tên miền `ais-pre-*.run.app` (`Shared App URL` công khai) chứ không phải `ais-dev-*.run.app` (môi trường chủ sở hữu đang phát triển), mặc định khóa chế độ chỉnh sửa (Read-Only Summary) trừ khi có `KEY_POOL_ADMIN_PIN`.

#### `E2-03` [Mức độ: TRUNG BÌNH] — Rò rỉ Key qua `err.stack` / `err.cause` và thiếu giới hạn kích thước payload ở `/api/key-pool/preview`
- **Phân tích điểm yếu trong bản v1**:
  - Hàm `sanitizeErrorText` hiện tại trong `server.ts` chỉ lấy `raw.message`. Một số lỗi tầng HTTP/fetch hoặc SDK có thể đính kèm URL chứa `?key=AIza...` bên trong `err.stack` hoặc `err.cause`.
  - Endpoint `POST /api/key-pool/preview` chưa giới hạn độ dài `rawInput` và số lượng key tối đa trong một lần dán.
- **Đề xuất sửa đổi**:
  - Giới hạn cứng: `MAX_RAW_INPUT_CHARS = 65_536` (64 KB) và `MAX_KEYS_IN_POOL = 50` key.
  - Hàm `sanitizeSecretText(input)` phải xử lý đệ quy `message`, `stack`, `cause`, đồng thời áp dụng **2 lớp lọc**: (1) thay thế chính xác mọi `rawKey` trong pool bằng `[REDACTED_KEY]`, và (2) quét regex `/AIza[0-9A-Za-z_-]{20,50}/g` thay bằng `AIza••••[REDACTED]` để chặn cả những key vừa dán thử chưa lưu vào pool.

#### `E2-04` [Mức độ: THẤP] — So sánh mã bảo vệ và tạo ID phiên Preview
- **Đề xuất sửa đổi**:
  - Dùng `crypto.randomUUID()` cho `previewSessionId` và `key.id`; dùng `crypto.timingSafeEqual` khi kiểm tra PIN quản trị.

---

### 3.3. Chuyên gia 3 — Hành vi Quota Gemini Thực tế & SRE (CG3)

#### `E3-01` [Mức độ: NGHIÊM TRỌNG] — Bẫy "Nhiều Key Cùng Thuộc 1 Google Cloud Project" (`project_number` Collision) làm vô hiệu hóa Failover
- **Phân tích điểm yếu trong bản v1**:
  - Đây là lỗi thực tế quan trọng nhất với Google Gemini API: hạn mức (`GenerateContentRequestsPerMinutePerProjectPerRegion`, `RPD`, và đặc biệt là `quota_limit_value: "0"` như chúng ta đã bắt được trên `projects/63415494298`) được Google áp dụng ở **cấp Google Cloud Project (`project_number`)**, **KHÔNG phải cấp từng API key**!
  - Nhiều người dùng lầm tưởng rằng tạo 5 API key trong cùng 1 project Google Cloud sẽ có 5 lần quota. Khi 1 key trong project đó trả về `429` (trong payload lỗi của Google luôn có trường `"consumer": "projects/63415494298"` hoặc `"project_number:63415494298"`), bản v1 chỉ làm nguội đúng 1 key đó rồi chọn tiếp key thứ 2 (cũng thuộc `projects/63415494298`), dẫn tới đốt hết cả 3 lượt thử `MAX_KEY_ATTEMPTS = 3` vào cùng 1 project đang hết quota!
- **Đề xuất sửa đổi**:
  1. **Trích xuất tự động `projectNumber` từ lỗi 429**: Trong `classifyGeminiError`, dùng regex `/project[s_\/:]+(\d{6,20})/i` để bóc tách mã số project (ví dụ `"63415494298"`) và lưu vào trường `detectedProjectNumber: string | null` của `GeminiKeyRecord`.
  2. **Lan truyền trạng thái nguội theo Project (Project-Scoped Cooldown Propagation)**:
     - Khi một key gặp lỗi `429` có kèm `detectedProjectNumber = P`, bất kỳ key nào khác trong kho đã biết cùng thuộc project `P` cũng được tự động đánh dấu tạm thời cùng `cooldownUntil` (hoặc ít nhất bị đưa vào `excludedProjectNumbers` trong suốt request hiện tại).
     - Trên Dashboard, hiển thị cảnh báo thông minh nếu phát hiện 2 key trở lên có cùng `detectedProjectNumber`: *"Cảnh báo: Khóa này dùng chung Google Cloud Project (#63415494298) với khóa khác — các khóa cùng Project sẽ dùng chung hạn mức Quota."*

#### `E3-02` [Mức độ: CAO] — Hiện tượng "Cả bầy key cùng thức dậy" (Thundering Herd) và lệch mốc làm mới Quota Ngày (Daily Reset Time)
- **Phân tích điểm yếu trong bản v1**:
  - Bản v1 đặt thời gian nguội cố định tròn trịa: `60s`, `90s`, `120s`, `6h`, `12h`. Nếu một đợt cao điểm làm 3 key cùng dính `429 RPM` trong cùng 1 giây, đúng 60 giây sau cả 3 key cùng chuyển về `ready` một lượt.
  - Ngoài ra, hạn mức theo ngày (`RequestsPerDay` — RPD) của Google Gemini API làm mới vào **00:00 giờ Thái Bình Dương (America/Los_Angeles — PT, tức 14:00 hoặc 15:00 giờ Việt Nam tùy mùa DST)**, chứ không phải 12 giờ cố định kể từ lúc lỗi. Nếu người dùng hết quota ngày lúc 13:30 giờ Việt Nam, thực tế chỉ 30 phút sau (14:00) quota đã được làm mới, nhưng bản v1 lại khóa cứng tới 12 giờ!
- **Đề xuất sửa đổi**:
  1. **Thêm Jitter ngẫu nhiên $\pm 15\%$** vào mọi thời gian nguội ngắn/trung bình: `actualCooldownMs = baseCooldownMs * (0.85 + Math.random() * 0.30)`.
  2. **Tính thời gian nguội cho `QUOTA_DAILY_EXHAUSTED` theo mốc 00:05 giờ PT (America/Los_Angeles)**:
     - Tính khoảng thời gian từ `now` đến `00:05 AM America/Los_Angeles` tiếp theo; lấy `Math.min(khoảng_tới_00h05_PT, 12 * 3600 * 1000)` (tối thiểu 15 phút) để nếu sắp qua nửa đêm giờ PT thì key hồi lại ngay sau mốc reset!

#### `E3-03` [Mức độ: CAO] — Bỏ sót thông tin `RetryInfo.retryDelay` do chính máy chủ Google trả về trong lỗi `429`
- **Phân tích điểm yếu trong bản v1**:
  - Khi lỗi là `429 RATE_LIMIT_RPM`, Google thường trả kèm mảng `details` chứa `{"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "42s"}`. Bản v1 chưa đọc trường này.
- **Đề xuất sửa đổi**:
  - Trong `classifyGeminiError`, nếu bóc tách được `retryDelay` (ví dụ `"42s"` hoặc `"15.5s"`), lấy `cooldownSec = Math.clamp(Math.ceil(parsedRetryDelaySec) + 3, 15, 300)` (cộng đệm 3 giây an toàn, nằm trong khoảng 15s–300s). Nếu Google không trả `retryDelay`, mới dùng thang bậc `60s → 90s → 120s` (+ jitter).

#### `E3-04` [Mức độ: TRUNG BÌNH] — Hiện tượng "Đói vĩnh viễn" (Score Starvation) đối với Key từng bị phạt nặng sau khi hết Cool Down
- **Phân tích điểm yếu trong bản v1**:
  - Trong bản v1 (Mục 5.1 bước 3 & 4), `KeyAllocator` chỉ chọn trong nhóm `maxHealthTier` (`Math.floor(effectiveScore / 5)`).
  - Hãy xét kịch bản: Key A ban đầu `100` điểm, gặp 1 đợt mạng chập chờn hoặc `429` bị trừ xuống `60` điểm (`healthTier = 12`). Key B đang ở `100` điểm (`healthTier = 20`). Khi Key A hết thời gian nguội và quay lại `ready`, vì `12 < 20`, `KeyAllocator` sẽ **chỉ gọi mãi Key B (100 điểm)** cho đến khi chính Key B cũng bị lỗi! Key A không bao giờ được gọi thăm dò để cộng điểm quay lại `100`.
- **Đề xuất sửa đổi**:
  - **Cơ chế Hồi phục Điểm theo Thời gian Nghỉ (Passive Health Decay-Recovery) + Ưu tiên Probe định kỳ**:
    1. Khi một key hết thời gian `cooldown` và chuyển về `ready` (`pendingProbe = true`), đặt điểm sàn thăm dò tối thiểu `probeFloorScore = 85` khi xét phân bậc, HOẶC cứ mỗi **10 phút** key ở trạng thái `ready` không gặp lỗi thì tự động hồi phục `+5 điểm` (tối đa lên `95` điểm).
    2. Nhờ vậy, key sau khi nghỉ phạt xong sẽ sớm được cấp phát 1 request thăm dò; nếu thành công sẽ nhảy vọt lên nhóm `healthScore >= 90` để cùng chia tải với các key khỏe khác.

#### `E3-05` [Mức độ: THẤP] — Độ trễ của lệnh `test` (1 token) làm sai lệch `avgLatencyMs` của lệnh luận giải thực tế
- **Đề xuất sửa đổi**:
  - Lưu riêng `lastTestLatencyMs` (độ trễ lần bấm nút "Kiểm tra thử") và chỉ cập nhật `avgLatencyMs` (dùng cho `latencyPenalty` của bộ chọn key) từ các lần gọi luận giải thực tế (`executeStream`), hoặc chuẩn hóa theo thời gian nhận chunk đầu tiên (**TTFB — Time To First Byte/Chunk**). Việc đo `avgLatencyMs` bằng **TTFB (thời gian từ lúc gửi request tới lúc nhận chunk text đầu tiên)** giúp con số công bằng giữa bài luận giải ngắn và bài luận giải dài!

---

### 3.4. Chuyên gia 4 — Trải nghiệm Quản trị & Vận hành (CG4)

#### `E4-01` [Mức độ: CAO] — Quy tắc bóc nhãn bằng dấu `:` hoặc `=` trong Parser có thể làm hỏng khi người dùng dán JSON, URL hoặc lệnh cURL
- **Phân tích điểm yếu trong bản v1**:
  - Bản v1 (Mục 2.1 bước 3) tách phần trước dấu `=` hoặc `:` làm nhãn trước khi tách token. Nếu người dùng dán:
    - Một đoạn JSON: `[{"name": "k1", "key": "AIzaSyA111..."}, {"name": "k2", "key": "AIzaSyB222..."}]`
    - Hoặc danh sách URL: `https://generativelanguage.googleapis.com/...?key=AIzaSyA111...`
    - Cách cắt theo dấu `:` đầu tiên của dòng sẽ làm sai lệch hoàn toàn việc tách token!
- **Đề xuất sửa đổi**:
  - Thay đổi thuật toán `BatchKeyParser` sang chiến lược **2 chế độ song song (Dual-Pass Token & Pattern Extraction)**:
    1. **Bỏ dòng chú thích**: Bỏ các dòng bắt đầu bằng `#` hoặc `//`.
    2. **Chuẩn hóa dấu phân cách**: Thay thế mọi ký tự phân cách `,`, `;`, `\t`, `\n`, khoảng trắng, dấu ngoặc kép `"`, dấu nháy đơn `'`, ngoặc vuông `[`, `]`, ngoặc nhọn `{`, `}` và tiền tố `key=` / `GEMINI_API_KEY=` thành khoảng trắng chuẩn, đồng thời nhận diện nhãn tùy chọn nếu dòng có định dạng chuẩn `Ten_Nhan = AIza...` hoặc `Ten_Nhan: AIza...`.
    3. Nhờ đó, dù người dùng dán **danh sách cách nhau bởi dấu phẩy, khoảng trắng, tab, chấm phẩy, xuống dòng, file `.env`, hay mảng JSON**, parser đều lọc chính xác số lượng `N` key hợp lệ, `M` key trùng và `K` token rác!

#### `E4-02` [Mức độ: TRUNG BÌNH] — Thiếu thông tin minh bạch về Key & Model đã thực thi trên giao diện luận giải (`InsightPanel`)
- **Phân tích điểm yếu trong bản v1**:
  - Khi người dùng bấm **"Luận giải AI cho kỳ này"** và nhận được bài luận giải, họ không biết hệ thống vừa dùng key nào (ví dụ `Khóa #2 · AIzaSy••••2dEf`) và model nào (`gemini-3.5-flash-lite` hay đã fallback sang `gemini-3.8-flash`), hay đã phải tự động vượt qua mấy key lỗi trong hậu trường.
- **Đề xuất sửa đổi**:
  - Trong luồng SSE của `/api/interpret-period`, gửi kèm một gói metadata nhỏ ở đầu hoặc cuối luồng:
    `data: {"meta": {"keyId": "k_...", "maskedKey": "AIzaSy••••2dEf", "label": "Khóa #2", "modelUsed": "gemini-3.5-flash-lite", "usedFallbackModel": false, "failoverAttempts": 2}}\n\n`
  - Trên `InsightPanel.tsx`, hiển thị một huy hiệu nhỏ gọn bên cạnh nhãn **"AI diễn giải"**: `Model: gemini-3.5-flash-lite · Khóa: AIzaSy••••2dEf (tự chuyển qua 1 khóa nguội)`.

#### `E4-03` [Mức độ: TRUNG BÌNH] — Cơ chế Xóa / Khôi phục đối với khóa hạt giống `env_secret` (`GEMINI_API_KEY`)
- **Phân tích điểm yếu trong bản v1**:
  - Nếu người dùng lỡ bấm "Xóa" vào dòng `Secret hệ thống (GEMINI_API_KEY)` (và fingerprint bị đưa vào `removedEnvFingerprints`), sau đó họ muốn lấy lại khóa từ biến môi trường mà không nhớ giá trị khóa gốc thì không có nút khôi phục.
- **Đề xuất sửa đổi**:
  - Với key có `source === 'env_secret'`, thay vì xóa mất vĩnh viễn không lấy lại được, cung cấp nút **"Tắt / Bỏ qua khóa hệ thống"** (hoặc nếu đã xóa thì trên Dashboard có nút nhỏ **"Đồng bộ lại từ biến môi trường GEMINI_API_KEY"** gọi `POST /api/key-pool/sync-env`).

#### `E4-04` [Mức độ: TRUNG BÌNH] — Chống bấm liên tục nút "Kiểm tra thử 1 key" gây tự bắn vào chân (Self-Inflicted 429)
- **Đề xuất sửa đổi**:
  - Áp dụng debounce / khóa nút **"Kiểm tra thử"** tối thiểu **5 giây** giữa 2 lần bấm trên cùng 1 key.

#### `E4-05` [Mức độ: THẤP] — Đồng bộ thời gian đếm ngược Cool Down giữa Server và Client
- **Đề xuất sửa đổi**:
  - API `GET /api/key-pool` trả thêm trường `serverNow: number` và `remainingCooldownSec: number` trên từng key để đồng hồ đếm ngược trên trình duyệt luôn chính xác tuyệt đối, không phụ thuộc đồng hồ máy tính của người dùng nhanh hay chậm.

---

## 4. VÒNG 2 — Phản Biện Chéo Giữa Các Chuyên Gia (Cross-Examination)

### Chủ đề tranh luận 1: Khi phát hiện `429` có cùng `project_number`, nên làm nguội cả các key cùng Project hay chỉ bỏ qua trong Request hiện tại?
- **Ý kiến CG3 (Quota Expert)**: Đề nghị khi Key A bị `429 QUOTA_PROJECT_ZERO` và trả về `consumer: "projects/63415494298"`, hệ thống lập tức chuyển **tất cả** các key khác trong kho có cùng `detectedProjectNumber === "63415494298"` sang trạng thái `cooldown` 6 giờ luôn, vì hạn mức nằm ở cấp Project.
- **Phản biện của CG4 (UX Expert) & CG1 (Backend Expert)**:
  - Khi người dùng mới dán 10 key vào kho, ban đầu hệ thống **chưa biết `project_number` của từng key** (vì Google API key `AIza...` là chuỗi opaque, chỉ khi Google trả lỗi 429 có kèm `ErrorInfo.metadata.consumer` thì ta mới biết chắc chắn `project_number` của key đó!).
  - Hơn nữa, nếu một key đã biết `detectedProjectNumber` từ lần lỗi trước, việc tự động làm nguội đồng loạt các key đã biết cùng `project_number` khi 1 key trong nhóm dính `QUOTA_PROJECT_ZERO` hoặc `QUOTA_DAILY_EXHAUSTED` là hoàn toàn chính xác, NHƯNG trên bảng Dashboard phải ghi rõ lý do: `"Đang nguội theo Project #63415494298 (dùng chung hạn mức với khóa AIzaSy••••xxxx)"` để người dùng không hoang mang vì sao một key chưa gọi lại tự chuyển sang đang nguội!
- **Kết luận chốt của Điều phối viên**: **Đồng thuận kết hợp**. Lưu `detectedProjectNumber` khi bóc tách được từ lỗi Google RPC; nếu lỗi là cấp Project (`QUOTA_PROJECT_ZERO`, `QUOTA_DAILY_EXHAUSTED`, `RATE_LIMIT_RPM`), áp dụng cool down cho các key đã xác định cùng `detectedProjectNumber` và hiển thị rõ nhãn `"Cùng Project #..."` trên Dashboard.

### Chủ đề tranh luận 2: Giới hạn số lần thử tối đa (`MAX_KEY_ATTEMPTS`) khi người dùng có nhiều key hỏng trong kho
- **Ý kiến CG4 (UX Expert)**: Nếu người dùng dán 10 key miễn phí, trong đó 4 key đầu hết quota ngày, còn key thứ 5 mới sống. Nếu giới hạn `MAX_KEY_ATTEMPTS = 3` thì request đầu tiên chỉ thử Key 1, Key 2, Key 3 rồi báo lỗi cho người dùng; người dùng phải bấm lần thứ 2 mới tới Key 4, Key 5!
- **Phản biện của CG1 (Backend Expert)**:
  - Nếu cho thử cả 10 key tuần tự mà mỗi key mạng chậm 10 giây thì request sẽ treo hơn 100 giây.
  - Tuy nhiên, các lỗi `429` hoặc `401/403` từ Google thường phản hồi cực nhanh (chỉ mất **150ms – 400ms**)!
- **Giải pháp tổng hợp của CG1 + CG4 (Đồng thuận cao)**:
  - Thay vì giới hạn cứng chỉ 3 key bất kể nhanh hay chậm, sử dụng **Ngân sách kép (Dual Failover Budget)**:
    - Cho phép thử tối đa **`MAX_KEY_ATTEMPTS = 5` key** trong 1 request, **MIỄN LÀ** tổng thời gian đã trôi qua chưa vượt quá **`TOTAL_FAILOVER_TIME_BUDGET_MS = 25_000` (25 giây)** (và mỗi lần thử đơn lẻ có timeout chunk đầu tiên `12_000ms`).
    - Nhờ vậy, nếu 4 key đầu trả lỗi `429` nhanh trong 300ms/key (tổng mất 1,2 giây), request đó lập tức nhảy tới **Key thứ 5** và trả kết quả thành công ngay trong lần bấm đầu tiên!

### Chủ đề tranh luận 3: Cách xử lý với `429 quota_limit_value = "0"` — Cooldown 6 giờ hay Vô hiệu hóa (`disabled`)?
- **Ý kiến CG3 (Quota Expert)**: Lỗi `quota_limit_value: "0"` tại `asia-southeast1` (như Project `63415494298`) là cấu hình hạn mức cứng của Google Cloud Project đó (project chưa bật billing hoặc bị khóa free tier ở vùng đó), hiếm khi tự thay đổi sau vài phút. Nếu để cooldown ngắn sẽ tốn công probe lại.
- **Ý kiến CG4 (UX Expert)**: Nhưng nếu đưa vào `disabled` vĩnh viễn giống như key sai `401/403`, người dùng vừa vào Google Cloud Console bật Billing xong quay lại app sẽ thấy key vẫn chết nếu quên bấm "Kích hoạt lại".
- **Kết luận của Điều phối viên**:
  - Đặt mặc định là **Cool down dài hạn `6 giờ (21.600 giây)`** với phân loại riêng biệt `QUOTA_PROJECT_ZERO` (tách biệt hẳn với `AUTH_INVALID_KEY`), kèm nút **"Kích hoạt lại"** và **"Kiểm tra thử"** ngay trên dòng đó. Đồng thời giữ mục này trong bảng "Quyết định chờ người dùng chốt" nếu người dùng muốn đổi sang `disabled` hẳn.

---

## 5. Tổng Hợp Các Điểm Đồng Thuận & Điểm Chờ Người Dùng Quyết

### 5.1. Các điểm Tổ Chuyên Gia đã đồng thuận 100% (Đưa thẳng vào Kế hoạch v2)
1. **Bảo mật khóa chủ (`masterKey`) độc lập**: Dẫn xuất từ `KEY_POOL_MASTER_SECRET` hoặc `.data/.pool-master.key` ngẫu nhiên 32 byte, **tuyệt đối không phụ thuộc vào `process.env.GEMINI_API_KEY`** để tránh mất dữ liệu khi xoay secret.
2. **An toàn đồng thời (Concurrency)**: Bổ sung bộ đếm `inFlightCount`, đối tượng `KeyLease` giải phóng trong `finally` (TTL 45s), và hàng đợi ghi file tuần tự `SerializedWriteQueue`.
3. **Đo độ trễ bằng TTFB (Time-To-First-Byte/Chunk)**: Tính `avgLatencyMs` theo thời gian từ lúc gọi SDK đến khi nhận chunk đầu tiên, tách riêng với `lastTestLatencyMs`.
4. **Ngân sách Failover thông minh**: Tối đa `Math.min(5, số key sẵn sàng)` lần đổi key trong tổng ngân sách thời gian `25 giây` (timeout mỗi lần thử `12 giây`), chỉ failover khi `firstChunkSent === false`.
5. **Chính sách Quota & Cool Down thông minh**:
   - Đọc `RetryInfo.retryDelay` từ Google RPC nếu có; nếu không dùng bậc `60s → 90s → 120s` kèm **Jitter $\pm 15\%$**.
   - Tính thời gian nguội của `QUOTA_DAILY_EXHAUSTED` theo mốc **00:05 giờ Thái Bình Dương (`America/Los_Angeles`)** (tối đa 12 giờ).
   - Bóc tách `detectedProjectNumber` từ lỗi 429 để cảnh báo và tránh chọn lặp các key thuộc cùng một Google Cloud Project đang cạn quota.
   - Chống "đói điểm" (`Score Starvation`) bằng cơ chế hồi phục thụ động `+5 điểm / 10 phút` khi ở trạng thái `ready` và đặt điểm sàn thăm dò `probeFloorScore = 85` ngay sau khi hết hạn nguội.
6. **Minh bạch vận hành trên UI**: Luồng SSE trả kèm metadata `{ maskedKey, label, modelUsed, usedFallbackModel, failoverAttempts }` để hiển thị rõ trên `InsightPanel`.

### 5.2. Các quyết định còn mở — Chờ người dùng quyết (User Decisions Needed)
1. **Quyết định 1 [Chờ người dùng quyết]**: Cơ chế bảo vệ các thao tác chỉnh sửa Kho Khóa (`/api/key-pool/*`) khi truy cập qua `Shared App URL` (Khuyến nghị: Bảo vệ tự động theo ngữ cảnh `Shared App URL` + mã PIN tùy chọn qua `KEY_POOL_ADMIN_PIN`).
2. **Quyết định 2 [Chờ người dùng quyết]**: Phạm vi áp dụng Kho Khóa & Model `gemini-3.5-flash-lite` / `gemini-3.8-flash` (Khuyến nghị: Áp dụng đồng bộ cho cả 3 endpoint `/api/interpret-period`, `/api/interpret`, `/api/heming`).
3. **Quyết định 3 [Chờ người dùng quyết]**: Hành vi đối với lỗi `429 quota_limit_value = "0"` (`QUOTA_PROJECT_ZERO`) — để **Cool down dài hạn 6 giờ** (tự probe lại sau 6h) hay chuyển thẳng sang **Vô hiệu hóa (`disabled`)** chờ bấm kích hoạt thủ công (Khuyến nghị: Cool down 6 giờ kèm cảnh báo rõ mã Project).
4. **Quyết định 4 [Chờ người dùng quyết]**: Có tự động gọi kiểm tra thử (`auto-probe`) toàn bộ key ngay khi bấm "Xác nhận lưu" hay lưu ở trạng thái `Sẵn sàng (100 điểm)` để tiết kiệm hạn mức RPM (Khuyến nghị: Không auto-probe hàng loạt khi lưu; cung cấp nút "Kiểm tra thử" từng key và nút "Kiểm tra tất cả key đang chờ").
