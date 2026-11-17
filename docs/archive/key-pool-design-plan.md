> ⚠️ **[TÀI LIỆU LỊCH SỬ ĐÃ LƯU TRỮ — KHÔNG DÙNG LÀM CĂN CỨ CODE HIỆN HÀNH]**
> - **Trạng thái**: Đã hoàn thành vai trò lịch sử / Đã bị thay thế bởi tài liệu sống **[`docs/key-pool-operations.md`](../key-pool-operations.md) & [`docs/decisions-registry.md`](../decisions-registry.md)** từ ngày `17/11/2026`.
> - **Cảnh báo cho Kỹ sư & AI Agent**: Các trích dẫn số dòng, tên biến, hằng số (như ngân sách 25s, nhịp nghỉ 2200ms, số lượng key 3/23) trong file này phản ánh thời điểm trước khi hợp nhất và **không còn khớp với mã nguồn hiện hành**. Tuyệt đối đọc tài liệu sống tại thư mục `docs/` gốc và đối chiếu code thật trước khi chẩn đoán hoặc sửa code!

---
# Kế Hoạch Thiết Kế Chi Tiết Hoá (v2): Module Quản Lý Kho Khóa Gemini API (Gemini Key Pool)

- **Phiên bản tài liệu**: **v2.0 (Bản Kế Hoạch Chi Tiết Hoá sau Phản Biện Tổ Chuyên Gia)**
- **Ngày cập nhật**: `2026-11-16`
- **Biên bản phản biện đi kèm**: Xem chi tiết 2 vòng họp của 4 chuyên gia tại `docs/key-pool-expert-panel-review.md`
- **Trạng thái thực thi**: **Chỉ lập kế hoạch thiết kế — tuyệt đối chưa triển khai code**

---

## Tóm Tắt Những Điểm Thay Đổi & Nâng Cấp Từ Bản Nháp v1 Lên Bản Chi Tiết Hoá v2

| Hạng mục | Bản nháp v1 | Bản chi tiết hoá v2 (Sau phản biện Tổ Chuyên Gia) |
| :--- | :--- | :--- |
| **1. Dẫn xuất khóa mã hóa (`masterKey`)** | Dẫn xuất HKDF có kết hợp `process.env.GEMINI_API_KEY` (nguy cơ mất toàn bộ kho khóa nếu người dùng đổi/xóa `GEMINI_API_KEY` trong Secrets — `E2-01`). | **Tách độc lập hoàn toàn khỏi `GEMINI_API_KEY`**: chỉ dẫn xuất từ `KEY_POOL_MASTER_SECRET` hoặc khóa ngẫu nhiên 32 byte lưu tại `.data/.pool-master.key` (`0600`). |
| **2. Nhận diện trùng Google Cloud Project (`project_number`)** | Chưa phân biệt nhiều key thuộc cùng 1 GCP Project; dễ đốt sạch lượt thử vào các key dùng chung project đang bị `quota_limit_value = "0"` (`E3-01`). | Tự động trích xuất `detectedProjectNumber` từ lỗi `429` (`projects/63415494298`), **lan truyền trạng thái nguội cho các key đã biết cùng Project** và cảnh báo trùng Project trên Dashboard. |
| **3. An toàn đồng thời (Concurrency & Locking)** | Chưa có bộ đếm request đang chạy và chưa có hàng đợi ghi file tuần tự (`E1-01`, `E1-03`). | Bổ sung `inFlightCount`, cơ chế `KeyLease` giải phóng trong `finally` (TTL `45s`) và hàng đợi ghi tuần tự `SerializedWriteQueue` chống ghi đè file. |
| **4. Ngân sách Failover trong cùng Request** | Giới hạn cứng `MAX_KEY_ATTEMPTS = 3` và ước lượng timeout ~20s/lần thử (`E1-04`, Tranh luận Vòng 2). | **Ngân sách kép (Dual Failover Budget)**: cho phép thử tối đa **`5 key`** trong tổng ngân sách thời gian **`35 giây`** (`FIRST_CHUNK_TIMEOUT_MS = 12.000ms`/lần thử), chỉ failover khi `firstChunkSent === false` (`E1-02`). |
| **5. Chính sách Cool Down, Jitter & Giờ Reset Quota Ngày** | Cố định `60s/90s/120s` và `12h` cứng; bỏ qua `RetryInfo` của Google (`E3-02`, `E3-03`). | Ưu tiên đọc `RetryInfo.retryDelay` từ Google RPC; áp dụng **Jitter $\pm 15\%$** chống bầy đàn cùng thức dậy; tính `QUOTA_DAILY_EXHAUSTED` theo mốc **00:05 AM giờ Thái Bình Dương (`America/Los_Angeles`)**. |
| **6. Chống "Đói điểm sức khỏe" (`Score Starvation`)** | Key bị trừ xuống 40–60 điểm không bao giờ được chọn lại nếu còn key 100 điểm (`E3-04`). | Bổ sung **Hồi phục điểm thụ động** (`+5 điểm / 10 phút` khi ở trạng thái `ready`) và đặt điểm sàn thăm dò `probeFloorScore = 85` cho lần gọi đầu sau khi hết nguội. |
| **7. Đo độ trễ (`avgLatencyMs`) & Metadata SSE** | Gộp chung độ trễ test 1 từ với luận giải dài; không báo cho UI biết đã dùng key/model nào (`E3-05`, `E4-02`). | Đo `avgLatencyMs` bằng **TTFB (Time-To-First-Chunk)**, tách riêng `lastTestLatencyMs`; gửi gói SSE `meta` (`maskedKey`, `modelUsed`, `failoverAttempts`) về `InsightPanel`. |
| **8. Parser đa định dạng & Bảo vệ Admin** | Cắt theo dấu `:` / `=` dễ lỗi khi dán JSON/URL (`E4-01`); chưa có chế độ Read-Only tự động trên `Shared App URL` (`E2-02`). | Parser 2 pha an toàn với cả CSV, khoảng trắng, tab, chấm phẩy, xuống dòng, `.env` và JSON; giới hạn input `64KB`; tự khóa chỉnh sửa trên `Shared App URL` nếu không có mã PIN. |

---

## 0. Bối Cảnh Thực Tế & Mục Tiêu Thiết Kế

### 0.1. Bối cảnh kỹ thuật đã kiểm chứng
1. **Cơ chế đơn khóa hiện tại**: Trong `server.ts` (dòng 21–48), hàm `getAiClient()` chỉ đọc **một khóa duy nhất** từ biến môi trường `process.env.GEMINI_API_KEY`.
2. **Model đang hard-code**: Cả 4 điểm trong `server.ts` gồm `GET /api/ai-diagnostics` (dòng 120), `POST /api/interpret-period` (dòng 159), `POST /api/interpret` (dòng 264) và `POST /api/heming` (dòng 349) đều đang đặt cứng model `'gemini-4-hydrogen'`.
3. **Nguyên nhân lỗi `429` đã xác minh bằng bằng chứng**:
   - Tiến trình server nhìn thấy `GEMINI_API_KEY` (`present: true, length: 39`).
   - Tuy nhiên, khóa này thuộc Google Cloud Project `projects/63415494298` đang có **`quota_limit_value: "0"`** tại vùng triển khai `asia-southeast1` cho metric `generativelanguage.googleapis.com/generate_content_requests` (`GenerateContentRequestsPerMinutePerProjectPerRegion`).
   - Do hạn mức cấp project bằng `0`, mọi lời gọi từ khóa đơn lẻ này đều lập tức trả về `429 RESOURCE_EXHAUSTED / RATE_LIMIT_EXCEEDED`.
4. **Tính độc lập của Tầng Khung Xác Định**: Tầng tính toán vận hạn xác định (`src/lib/ziwei/yunxian-context.ts`) chạy hoàn toàn độc lập với AI. Khi AI lỗi hoặc chưa cấu hình, giao diện vẫn hiển thị đầy đủ **Bảng dữ kiện kỳ hạn** và bản luận giải xác định.

---

## 1. Kiến Trúc Tổng Thể & Luồng Dữ Liệu (v2)

### 1.1. Sơ đồ kiến trúc thành phần (Component Architecture)

```text
+---------------------------------------------------------------------------------------+
|                                   CLIENT (React SPA)                                  |
|                                                                                       |
|  +--------------------------------+       +----------------------------------------+  |
|  | InsightPanel / HemingView      |       | KeyPoolModal (Dashboard Quản Trị)      |  |
|  | - POST /api/interpret-period   |       | - Ô dán hàng loạt nhiều key (<= 64KB)  |  |
|  | - POST /api/interpret          |       | - Bước xác nhận Preview (N, M, K)      |  |
|  | - POST /api/heming             |       | - Bảng key dạng che + Health + TTFB    |  |
|  | - Hiển thị huy hiệu Model/Key  |       | - Cảnh báo nếu trùng GCP Project #     |  |
|  |   đã dùng & nút mở Kho Khóa    |       | - Nút: Thêm / Xóa / Kích hoạt lại /    |  |
|  +---------------+----------------+       |   Kiểm tra thử / Đồng bộ lại Env       |  |
|                  |                        +--------------------+-------------------+  |
+------------------|---------------------------------------------|----------------------+
                   | SSE Stream (Meta + Text / Error)            | REST JSON (/api/key-pool/*)
                   v                                             v
+---------------------------------------------------------------------------------------+
|                                SERVER (Express - server.ts)                           |
|                                                                                       |
|  +--------------------------------+       +----------------------------------------+  |
|  | AI Streaming Endpoints         |       | Key Pool Management Endpoints          |  |
|  | - POST /api/interpret-period   |       | - GET    /api/key-pool                 |  |
|  | - POST /api/interpret          |       | - POST   /api/key-pool/preview         |  |
|  | - POST /api/heming             |       | - POST   /api/key-pool/import          |  |
|  | - GET  /api/ai-diagnostics     |       | - POST   /api/key-pool/sync-env        |  |
|  +---------------+----------------+       | - DELETE /api/key-pool/:id             |  |
|                  |                        | - POST   /api/key-pool/:id/reactivate  |  |
|                  |                        | - POST   /api/key-pool/:id/test        |  |
|                  |                        | - PUT    /api/key-pool/models          |  |
|                  v                        +--------------------+-------------------+  |
|  +-------------------------------------------------------------+-------------------+  |
|  |                          KeyPoolManager (Singleton)                             |  |
|  |                                                                                 |  |
|  |  +----------------------+  +-----------------------+  +----------------------+  |  |
|  |  | BatchKeyParser       |  | ModelRegistry         |  | KeyAllocator & Lease |  |  |
|  |  | - Dual-pass tokenizer|  | - Gemini >= 3.5 only  |  | - EffectiveScore     |  |  |
|  |  | - Validate AIza...   |  | - Default: 3.5-lite   |  | - Round-Robin cursor |  |  |
|  |  | - SHA-256 Dedupe     |  | - Fallback: 3.8-flash |  | - inFlightCount &    |  |  |
|  |  | - Safe Masking       |  | - Regex version guard |  |   KeyLease (TTL 45s) |  |  |
|  |  +----------------------+  +-----------------------+  +----------------------+  |  |
|  |  +---------------------------------------+  +--------------------------------+  |  |
|  |  | CooldownStateMachine                  |  | GeminiStreamExecutor           |  |  |
|  |  | - Parse RetryInfo & project_number    |  | - Pre-first-chunk failover     |  |  |
|  |  | - Project-level cooldown propagation  |  | - Budget: <= 5 keys / <= 35s   |  |  |
|  |  | - Jitter +-15% & PT Midnight reset    |  | - Per-attempt timeout: 12s     |  |  |
|  |  | - Passive score recovery (+5 / 10m)   |  | - Recursive SecretSanitizer    |  |  |
|  |  +---------------------------------------+  +--------------------------------+  |  |
|  +---------------------------------------+-----------------------------------------+  |
|                                          |                                            |
|                                          v                                            |
|  +---------------------------------------------------------------------------------+  |
|  |       KeyPoolStore (AES-256-GCM + SerializedWriteQueue + .pool-master.key)      |  |
|  |  - Độc lập với GEMINI_API_KEY để không mất kho khi xoay biến môi trường         |  |
|  +---------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------+
```

---

## 2. Thiết Kế Parser Nhập Nhiều Key, Xem Trước & Quy Tắc Che (v2)

### 2.1. Quy trình Parser 2 Pha (`server/key-pool/parser.ts`) — Xử lý `E4-01`, `E2-03`
1. **Kiểm tra giới hạn an toàn đầu vào**:
   - Từ chối ngay nếu `rawInput.length > 65_536` (64 KB) hoặc tổng số key trong kho sau khi thêm vượt quá `MAX_KEYS_IN_POOL = 50`.
2. **Pha 1 — Tiền xử lý theo dòng (Line-level Pre-processing)**:
   - Chuẩn hóa `\r\n` và `\r` → `\n`.
   - Bỏ qua các dòng trống hoặc dòng chú thích bắt đầu bằng `#` hoặc `//`.
   - Nếu dòng là cấu trúc gán nhãn đơn giản `^[A-Za-z0-9_.\-\s]{1,32}\s*[:=]\s*(AIza[A-Za-z0-9_-]+)$` (không phải URL `http:` và không phải chuỗi JSON phức tạp), ghi nhận phần trước dấu `:`/`=` làm `suggestedLabel` cho key đó.
3. **Pha 2 — Tách đa dấu phân cách (Multi-Delimiter Tokenization)**:
   - Tách chuỗi bằng biểu thức chính quy bao phủ toàn bộ các dấu phân cách yêu cầu:
     - Dấu phẩy `,` (`"key1,key2,key3"`)
     - Khoảng trắng đơn hoặc nhiều dấu cách liên tiếp (`"key1 key2   key3"`)
     - Ký tự Tab `\t` (`"key1\tkey2\tkey3"`)
     - Dấu chấm phẩy `;` (`"key1;key2;key3"`)
     - Xuống dòng `\n` (mỗi key một hàng)
   - Bóc bỏ các ký tự bao ngoài nếu người dùng dán từ `.env` hoặc JSON (`"`, `'`, `[`, `]`, `{`, `}`, tiền tố `GEMINI_API_KEY=`, `?key=`).
   - Loại bỏ các token rỗng và chuỗi mẫu `MY_GEMINI_API_KEY`.
4. **Kiểm tra định dạng Gemini API Key hợp lệ**:
   - Tiền tố bắt buộc: `AIza` (phân biệt hoa thường).
   - Độ dài chuẩn: **35 đến 45 ký tự** (khóa chuẩn của Google dài **39 ký tự**).
   - Biểu thức chính quy kiểm tra: `/^AIza[A-Za-z0-9_-]{31,41}$/`.
5. **Khử trùng lặp bằng `SHA-256` Fingerprint**:
   - `fingerprint = sha256(rawKey)`.
   - So khớp với tập `existingFingerprints` (đang có trong pool) và `seenInBatch` (trong chính văn bản vừa dán) → tính chính xác:
     - `N` (`recognizedCount`): số key hợp lệ mới,
     - `M` (`duplicateCount` = `duplicateInBatchCount + duplicateInPoolCount`): số key trùng bị loại,
     - `K` (`invalidCount`): số token sai định dạng.

### 2.2. Quy tắc che khóa tuyệt đối (`maskApiKey` & `maskInvalidToken`)
- **Key hợp lệ**: Hiển thị đúng **6 ký tự đầu + `••••••` + 4 ký tự cuối** (ví dụ `AIzaSy••••••9xQp`). Không bao giờ trả nguyên văn key qua bất kỳ API nào sau khi gửi lên server.
- **Token không hợp lệ ở bảng Xem trước**: Che phần giữa `3 ký tự đầu + "•••" + 2 ký tự cuối (độ dài L ký tự)` để tránh lộ nội dung nếu người dùng dán nhầm mật khẩu hay secret khác.

---

## 3. Cấu Hình Model (Gemini 3.5+ & Cơ Chế Dự Phòng)

### 3.1. Quản lý tập trung tại `ModelRegistry`
- **Model mặc định (`defaultModel`)**: **`gemini-3.5-flash-lite`**
- **Model dự phòng (`fallbackModel`)**: **`gemini-3.8-flash`**
- **Danh sách hỗ trợ khởi tạo (`supportedModels`)**:
  - `gemini-3.5-flash-lite` *(Mặc định)*
  - `gemini-3.5-flash`
  - `gemini-3.8-flash` *(Dự phòng mặc định)*
  - `gemini-4-hydrogen`
  - `gemini-4-argon`
- **Ràng buộc phiên bản `>= 3.5`**: Hàm `isSupportedGemini35Plus(model)` kiểm tra regex `/^gemini-(3\.[5-9]|[4-9](?:\.\d+)?|[1-9]\d+(?:\.\d+)?)-[a-z0-9.-]+$/`, chặn mọi model `< 3.5`.

### 3.2. Ma trận tương tác giữa Xoay Key (Key Failover) và Chuyển Model Dự phòng (`E1-02`)

| Tình huống lỗi khi gọi `(Key K_i, defaultModel = gemini-3.5-flash-lite)` | Hành động đối với `Key K_i` | Hành động tiếp theo trong cùng Request |
| :--- | :--- | :--- |
| **Lỗi thuộc nhóm Model (`404 Not Found` hoặc `503 UNAVAILABLE / overloaded`)** | **Không phạt điểm hay đưa key vào cooldown** (`status` giữ nguyên `ready`, `healthScore` giữ nguyên); chỉ ghi `modelCooldowns[defaultModel] = now + 15s` trên `K_i`. | Gọi lại ngay trên **cùng `Key K_i`** với **`fallbackModel` (`gemini-3.8-flash`)**. Không làm lây cờ sang `Key K_{i+1}`: khi đổi khóa, `K_{i+1}` vẫn bắt đầu từ `defaultModel` nếu khỏe. |
| **Lỗi thuộc nhóm Quota theo phút (`429 RATE_LIMIT_RPM`)** | Ghi `modelCooldowns[defaultModel]` (`10s–30s` hoặc `RetryInfo`) trên `K_i` (và nhóm cùng Project) mà **chưa hạ cả key** nếu `fallbackModel` còn dùng được *(thay đổi do người dùng quyết trực tiếp 16/11/2026)*. | Thử ngay **`fallbackModel` (`gemini-3.8-flash`)** trên **cùng `Key K_i`**; nếu thất bại tiếp thì mới đưa cả `K_i` vào `cooldown` và chuyển sang **`Key K_{i+1}`** (vẫn bắt đầu bằng `defaultModel`). |
| **Lỗi thuộc nhóm Quota ngày / Project=0 (`429 RPD / QUOTA_PROJECT_ZERO`)** | Đưa `Key K_i` (và các key đã biết cùng `project_number`) vào **`cooldown`** theo bảng chính sách Mục 5.2. | Chuyển sang **`Key K_{i+1}`** (key khỏe tiếp theo thuộc project khác) và giữ nguyên **`defaultModel` (`gemini-3.5-flash-lite`)**. |
| **Lỗi xác thực Key (`401 / 403 API_KEY_INVALID`)** | Chuyển `Key K_i` sang **`disabled`** vĩnh viễn (`healthScore = 0`). | Chuyển ngay sang **`Key K_{i+1}`** với **`defaultModel`**. |
| **Lỗi mạng / `500 / 502 / 504` trước chunk đầu tiên** | Đưa `Key K_i` vào **`cooldown` ngắn 30 giây** (`-10` điểm). | Chuyển ngay sang **`Key K_{i+1}`** với **`defaultModel`**. |
| **Lỗi đứt gãy SAU KHI đã gửi >= 1 chunk (`firstChunkSent === true`)** | Phân loại đúng nguyên nhân gốc (nếu là `503 UNAVAILABLE / high demand` giữ nguyên `MODEL_UNAVAILABLE`, **không phạt điểm**, chỉ tạm né model vừa nghẽn 15s). | **Tự động Tiếp Nối Luồng (`Seamless Continuation`)**: gửi prompt nối tiếp phần đang viết dở qua **`fallbackModel` (`gemini-3.8-flash`)** (trên cùng key khỏe hoặc key tiếp theo trong ngân sách 35s) để viết nốt phần thiếu mà không lặp lại đoạn đầu. Nếu nối tiếp vẫn thất bại, phát sự kiện SSE `{"interrupted": true}` để UI không đóng băng văn bản dở vào cache. |

---

## 4. Mô Hình Dữ Liệu Chi Tiết (v2)

```typescript
export type KeyStatus = 'ready' | 'cooldown' | 'disabled';

export type KeyErrorCategory =
  | 'NONE'
  | 'RATE_LIMIT_RPM'          // 429 vượt hạn mức theo phút (RPM/TPM, quota_limit_value != "0")
  | 'QUOTA_PROJECT_ZERO'      // 429 hạn mức project = 0 (vd: Project 63415494298 tại asia-southeast1)
  | 'QUOTA_DAILY_EXHAUSTED'   // 429 hết quota ngày (RPD — làm mới lúc 00:00 PT)
  | 'AUTH_INVALID_KEY'        // 401/403 key không hợp lệ, hết hạn hoặc bị thu hồi
  | 'NETWORK_OR_5XX'          // 500/502/503/504 hoặc timeout / lỗi mạng
  | 'MODEL_UNAVAILABLE'       // 404/overloaded cấp model (kích hoạt fallback gemini-3.8-flash)
  | 'UNKNOWN';

export interface EncryptedPayload {
  iv: string;                 // Base64 12-byte IV (AES-256-GCM)
  authTag: string;            // Base64 16-byte GCM Auth Tag
  ciphertext: string;         // Base64 bản mã của rawKey
}

export interface GeminiKeyStats {
  totalCalls: number;                 // Tổng số lần gọi thực tế
  successCalls: number;               // Số lần gọi thành công
  errorCalls: number;                 // Số lần gọi lỗi
  lastErrorType: KeyErrorCategory;    // Phân loại lỗi gần nhất
  lastErrorMessage: string | null;    // Thông báo lỗi đã qua SecretSanitizer (không chứa key)
  lastErrorAt: number | null;         // Thời điểm lỗi gần nhất (epoch ms)
  lastUsedAt: number | null;          // Thời điểm cấp phát gần nhất (epoch ms)
  lastSuccessAt: number | null;       // Thời điểm thành công gần nhất (epoch ms)
  avgLatencyMs: number | null;        // Độ trễ TTFB trung bình trượt (EMA alpha=0.3, đơn vị ms)
  lastTestLatencyMs: number | null;   // Độ trễ riêng của lần bấm "Kiểm tra thử 1 key" gần nhất (ms)
  lastTestedAt: number | null;        // Thời điểm bấm "Kiểm tra thử" gần nhất (epoch ms)
}

export interface GeminiKeyRecord {
  id: string;                         // UUID ngắn: "k_..."
  label: string;                      // Nhãn gợi nhớ
  source: 'user_import' | 'env_secret';
  fingerprint: string;                // SHA-256(rawKey) hex
  maskedKey: string;                  // Chuỗi che: "AIzaSy••••••9xQp"
  encryptedKey: EncryptedPayload;     // Chỉ lưu trên server

  // Thông tin Project phát hiện tự động từ Google RPC ErrorInfo (E3-01)
  detectedProjectNumber: string | null; // Vd: "63415494298" (giúp phát hiện nhiều key trùng Project)

  // Trạng thái & Điểm sức khỏe
  status: KeyStatus;                  // 'ready' | 'cooldown' | 'disabled'
  pendingProbe: boolean;              // true khi vừa hết hạn nguội và chờ 1 lần gọi thăm dò
  healthScore: number;                // 0 .. 100 (khởi tạo = 100)
  lastScoreRecoveryAt: number;        // Mốc tính hồi phục điểm thụ động (+5 điểm / 10 phút)
  consecutiveErrors: number;          // Số lần lỗi liên tiếp
  cooldownUntil: number | null;       // Epoch ms thời điểm hết nguội
  cooldownReason: KeyErrorCategory;   // Lý do đang nguội / vô hiệu

  stats: GeminiKeyStats;
  createdAt: number;
  updatedAt: number;
}
```

---

## 5. Thuật Toán Cấp Phát Key & Máy Trạng Thái Cool Down (v2)

### 5.1. Thuật toán chọn Key khỏe nhất (`acquireKeyLease`) — Đã xử lý `E1-01`, `E1-03`, `E3-01`, `E3-04`
Khi một request yêu cầu key thông qua `acquireKeyLease(excludedKeyIds, excludedProjectNumbers, now)`:

1. **Bước 1 — Giải phóng các key hết hạn nguội & Hồi phục điểm thụ động**:
   - Với mọi key đang `status === 'cooldown'` mà `cooldownUntil !== null && now >= cooldownUntil`:
     - Chuyển `status = 'ready'`, `pendingProbe = true`, `cooldownUntil = null`.
     - Ghi log chuyển trạng thái `COOLDOWN -> READY (expired, awaiting probe)`.
   - Với mọi key đang `status === 'ready'` không có lỗi mới: cứ mỗi chu kỳ `10 phút` kể từ `lastScoreRecoveryAt`, cộng hồi phục thụ động `+5 điểm` (tối đa lên `95` điểm) để chống hiện tượng "đói điểm vĩnh viễn" (`E3-04`).

2. **Bước 2 — Lọc ứng viên khả dụng**:
   - Bỏ qua các key có `status !== 'ready'`.
   - Bỏ qua các key có `id` nằm trong `excludedKeyIds` (đã thử trong request này).
   - Bỏ qua các key có `detectedProjectNumber` nằm trong `excludedProjectNumbers` (tránh chọn tiếp một key khác thuộc cùng Google Cloud Project vừa trả lỗi `429` trong request này — `E3-01`).
   - Nếu key có `pendingProbe === true` và `inFlightCount > 0` (đang được một request khác thăm dò), tạm bỏ qua cho các request song song.

3. **Bước 3 — Tính điểm hiệu dụng (`effectiveScore`) và bậc sức khỏe (`healthTier`)**:
   - Nếu key đang có `pendingProbe === true`, áp dụng điểm sàn thăm dò `baseScore = Math.max(key.healthScore, 95)` để khóa vừa hết nguội có cơ hội được chọn thăm dò sớm (`Tier 19`, tránh `Probe Starvation`).
   - Nếu key vẫn dùng được `defaultModel` (chưa bị khóa trong `modelCooldowns`), cộng ưu tiên `+8` điểm so với key chỉ còn `fallbackModel`.
   - Trừ điểm phạt độ trễ mịn theo bước `250ms`: `latencyPenalty = key.stats.avgLatencyMs ? Math.min(10, Math.floor(key.stats.avgLatencyMs / 250)) : 0`.
   - Trừ điểm phạt tải đồng thời: `inFlightPenalty = inFlightCount * 6` (`E1-01`).
   - `effectiveScore = Math.max(0, baseScore + modelBonus - latencyPenalty - inFlightPenalty)`.
   - `healthTier = Math.floor(effectiveScore / 5)`.

4. **Bước 4 — Xoay vòng Round-Robin trong bậc sức khỏe cao nhất & Cấp `KeyLease`**:
   - Lấy tập ứng viên thuộc `maxHealthTier` (loại bỏ các khóa mà cả `defaultModel` lẫn `fallbackModel` đều đang nằm trong `modelCooldowns`).
   - Duyệt theo con trỏ vòng tròn `roundRobinCursor` để chọn key tiếp theo trong `maxHealthTier`, sau đó tăng `roundRobinCursor = (selectedIndex + 1) % keys.length`.
   - Tăng `inFlightCount[selectedKey.id]++` và trả về đối tượng `KeyLease` có phương thức `heartbeat()` gia hạn TTL trượt `45 giây` theo mỗi chunk nhận được (trần bảo hiểm tối đa `120 giây`), tự động giảm `inFlightCount--` trong `finally`.

### 5.2. Bảng chính sách phân loại lỗi & Số liệu Cool Down cụ thể (v2)

| Phân loại lỗi (`KeyErrorCategory`) | Dấu hiệu nhận diện từ `@google/genai` Error | Trạng thái mới | Thời gian Cool Down cụ thể (kèm Jitter) | Thay đổi `healthScore` | Lan truyền cùng Project (`E3-01`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`RATE_LIMIT_RPM`** | HTTP `429` (`RATE_LIMIT_EXCEEDED`), metric theo phút (`PerMinute` / `RPM` / `TPM`) và `quota_limit_value !== "0"` | Đặt `modelCooldowns[model]`; thử `fallbackModel` trên cùng key trước; nếu hết model khả dụng → `cooldown` | - Nếu Google trả `RetryInfo.retryDelay`: lấy **`ceil(retryDelay) + 2s`** (giới hạn **`5s..60s`**).<br>- Nếu không có: bậc **`10s` → `20s` → `30s`** (tùy `consecutiveErrors`), nhân **Jitter $\pm 15\%$** *(thay đổi do người dùng quyết trực tiếp 16/11/2026)*. | **`-15` điểm** (chỉ khi hạ cả key) | Có (lan `modelCooldowns` / cooldown cho các key cùng `project_number`) |
| **`QUOTA_PROJECT_ZERO`** | HTTP `429` có **`"quota_limit_value": "0"`** (như Project `63415494298` tại `asia-southeast1`) | `cooldown` *(theo QĐ-3)* | **`6 giờ (21.600 giây)`** | **`-60` điểm** (sàn `5`) | **Có** (đánh dấu toàn bộ key đã biết cùng `project_number` nguội 6h) |
| **`QUOTA_DAILY_EXHAUSTED`** | HTTP `429` có metric/message chứa `PerDay` / `RPD` / `Daily` | `cooldown` | Tính tới **00:05 AM giờ Thái Bình Dương (`America/Los_Angeles`)** tiếp theo (tối thiểu `15 phút`, tối đa **`12 giờ / 43.200 giây`**) + Jitter `0..120s` (`E3-02`). | **`-40` điểm** (sàn `10`) | **Có** (hạn mức ngày tính theo Project) |
| **`AUTH_INVALID_KEY`** | HTTP `401` / `403`, `API_KEY_INVALID`, `PERMISSION_DENIED`, key hết hạn hoặc bị thu hồi | **`disabled`** | **Vô hiệu hẳn (`cooldownUntil = null`) — không tự hồi** | Về **`0` điểm** | Không (lỗi riêng của từng key) |
| **`NETWORK_OR_5XX`** | HTTP `500`, `502`, `503` (không thuộc mẫu `UNAVAILABLE` / quá tải model), `504`, `ETIMEDOUT`, `ECONNRESET` | `cooldown` | **`30 giây`** ($\pm 15\%$ Jitter: `25s..35s`) | **`-10` điểm** (sàn `20`) | Không |
| **`MODEL_UNAVAILABLE`** | HTTP `404` (`model not found`) hoặc `503` (`got status: UNAVAILABLE` / `"status":"UNAVAILABLE"` / `high demand` / `model is overloaded`) | Giữ `ready` | **`0 giây`** cho key (tạm đặt `modelCooldowns[model] = 15s` để né model nghẽn) | **`0` điểm** | Không — Chuyển ngay sang `fallbackModel` (`gemini-3.8-flash`) |

---

## 6. Bảo Mật & Lưu Trữ Phía Server (v2)

1. **Lưu trữ mã hóa `AES-256-GCM` độc lập với `GEMINI_API_KEY` (`E2-01`)**:
   - File kho khóa: `.data/gemini-key-pool.enc.json` (thêm `.data/` vào `.gitignore`).
   - Khóa mã hóa `masterKey` (32 byte) được lấy từ `KEY_POOL_MASTER_SECRET` (nếu có) hoặc sinh tự động bằng `crypto.randomBytes(32)` lưu tại `.data/.pool-master.key` (quyền `0600`). Việc thay đổi hay xóa `GEMINI_API_KEY` trong bảng Secrets sẽ **không bao giờ làm hỏng khả năng giải mã** của các key khác trong kho.
2. **Hàng đợi ghi tuần tự (`SerializedWriteQueue` — `E1-01`)**:
   - Mọi thao tác ghi `.data/gemini-key-pool.enc.json` đi qua một `Promise` chain duy nhất trong tiến trình server, ghi ra file tạm `.data/gemini-key-pool.enc.json.tmp` rồi `fs.promises.rename` nguyên tử.
3. **Bộ lọc chống lộ khóa đệ quy (`sanitizeSecretText` — `E2-03`)**:
   - Quét cả `error.message`, `error.stack`, `error.cause` để thay thế mọi `rawKey` trong kho VÀ mọi chuỗi khớp regex `/AIza[0-9A-Za-z_-]{20,50}/g` thành `[REDACTED_KEY]` trước khi ghi log console hoặc trả về API.
4. **Tự động nạp hạt giống ban đầu từ `GEMINI_API_KEY` (`bootstrapFromEnv`)**:
   - Khi khởi động, nếu `process.env.GEMINI_API_KEY` hợp lệ và chưa có trong kho (cũng như chưa bị người dùng chủ động tắt), tự động thêm vào kho với `source: 'env_secret'`. Hỗ trợ thêm nút **"Đồng bộ lại từ biến môi trường"** (`POST /api/key-pool/sync-env` — `E4-03`).

---

## 7. Hợp Đồng API (API Contracts) & Tích Hợp Với Code Hiện Tại

### 7.1. Danh sách REST Endpoints Quản trị Kho Khóa (`/api/key-pool/*`)
1. `GET /api/key-pool` — Trả về `serverNow`, `modelConfig` (`defaultModel: 'gemini-3.5-flash-lite'`, `fallbackModel: 'gemini-3.8-flash'`, `supportedModels`), `summary` (`total`, `ready`, `cooldown`, `disabled`), danh sách `keys` (dạng che kèm `remainingCooldownSec`, `detectedProjectNumber`, `stats`), và `recentLogs`.
2. `POST /api/key-pool/preview` — Nhận `{ rawInput, labelPrefix? }` (`<= 64KB`), chạy `BatchKeyParser`, lưu phiên tạm vào RAM (`previewSessionId`, TTL 5 phút), trả về `{ previewSessionId, recognizedCount, duplicateCount, invalidCount, items }` (tất cả đều ở dạng che).
3. `POST /api/key-pool/import` — Nhận `{ previewSessionId }`, mã hóa và lưu các key hợp lệ từ phiên RAM vào store, trả về trạng thái kho khóa mới nhất.
4. `POST /api/key-pool/sync-env` — Khôi phục / đồng bộ lại key từ `process.env.GEMINI_API_KEY` (và `process.env.GEMINI_API_KEYS` nếu có) vào kho khóa.
5. `DELETE /api/key-pool/:id` — Xóa 1 key khỏi kho khóa.
6. `POST /api/key-pool/:id/reactivate` — Đưa key đang `cooldown` hoặc `disabled` về ngay trạng thái `ready` (`pendingProbe = true`, `cooldownUntil = null`).
7. `POST /api/key-pool/:id/test` — Kiểm tra thử 1 key với timeout `8 giây` và giới hạn tần suất tối thiểu `5 giây / lần / key` (`E4-04`), cập nhật `lastTestLatencyMs` và trạng thái thực tế của key.
8. `PUT /api/key-pool/models` — Cập nhật `defaultModel` và `fallbackModel` (bắt buộc thuộc dòng Gemini `>= 3.5`).

### 7.2. Tích hợp với các Endpoint AI hiện có trong `server.ts`
- Thay thế toàn bộ 4 chỗ đang gọi `getAiClient()` và đặt cứng `gemini-4-hydrogen` (`GET /api/ai-diagnostics`, `POST /api/interpret-period`, `POST /api/interpret`, `POST /api/heming`) bằng `keyPoolManager`.
- Trong `POST /api/interpret-period`:
  - Khi nhận được chunk văn bản đầu tiên thành công từ `(selectedKey, modelUsed)`, gửi kèm sự kiện SSE metadata:
    `data: {"meta":{"keyId":"...","maskedKey":"AIzaSy••••••9xQp","label":"...","modelUsed":"gemini-3.5-flash-lite","usedFallbackModel":false,"failoverAttempts":1}}\n\n`
  - Nếu kho khóa rỗng (`total === 0`): trả HTTP `503 AI_NOT_CONFIGURED`.
  - Nếu toàn bộ key trong kho đang `cooldown` hoặc `disabled` (`ready === 0`): trả HTTP `503 AI_POOL_EXHAUSTED` kèm `minRemainingCooldownSec` để giao diện hiển thị rõ thời gian chờ hoặc nút mở **Kho Khóa AI** để thêm key mới.
  - **Khi kho chỉ có 1 key**: `maxKeyAttempts = Math.min(5, 1) = 1`, thử đúng 1 lần trên key đó, giữ nguyên hành vi gọn nhẹ như thiết kế ban đầu.

---

## 8. Danh Sách File Dự Kiến Tạo Mới & Sửa Đổi (Khi Triển Khai)

### File tạo mới
1. `server/key-pool/types.ts` — Kiểu dữ liệu `GeminiKeyRecord`, `KeyStatus`, `KeyErrorCategory`, `PoolModelConfig`, `KeyLease`, `GeminiKeyPublicView`.
2. `server/key-pool/parser.ts` — Bộ tách chuỗi đa định dạng 2 pha, kiểm tra `AIza...`, băm `SHA-256`, che khóa `maskApiKey()`.
3. `server/key-pool/crypto-store.ts` — Mã hóa `AES-256-GCM` với `.data/.pool-master.key`, `SerializedWriteQueue`, và `bootstrapFromEnv()`.
4. `server/key-pool/allocator.ts` — Bộ cấp phát `acquireKeyLease()`, tính `effectiveScore`, `roundRobinCursor`, phân loại lỗi `classifyGeminiError()` (bóc tách `RetryInfo` + `project_number`), tính mốc reset 00:05 PT và Jitter $\pm 15\%$.
5. `server/key-pool/executor.ts` — `GeminiStreamExecutor` thực thi pre-first-chunk failover (tối đa 5 key / tổng ngân sách 35 giây, timeout chờ chunk đầu 12s/lần), tự chuyển fallback model `gemini-3.5-flash-lite` → `gemini-3.8-flash`, và `sanitizeSecretText()` đệ quy.
6. `server/key-pool/index.ts` — Singleton `KeyPoolManager` điều phối toàn bộ kho khóa.
7. `src/components/KeyPoolModal.tsx` — Giao diện Dashboard quản lý kho khóa, nhập nhiều key + xem trước, cấu hình model và thao tác trên từng key.
8. `scripts/verify-key-pool.ts` — Script kiểm thử tự động toàn bộ các kịch bản của Key Pool.

### File sửa đổi
9. `server.ts` — Nối dây `keyPoolManager` vào `/api/interpret-period`, `/api/interpret`, `/api/heming`, `/api/ai-diagnostics` và thêm các route `/api/key-pool/*`.
10. `src/App.tsx` — Thêm nút mở **Kho Khóa AI** trên thanh Header kèm trạng thái số key sẵn sàng.
11. `src/components/InsightPanel.tsx` — Hiển thị huy hiệu Model/Key đã dùng, xử lý mã `AI_POOL_EXHAUSTED` và thêm nút mở nhanh **Kho Khóa AI**.
12. `.gitignore` — Thêm `.data/` vào danh sách loại trừ của Git.

---

## 9. Kịch Bản Kiểm Chứng Sau Khi Triển Khai (Verification Matrix)

1. **Kịch bản 1 (Parser đa định dạng & Preview)**: Dán chuỗi kết hợp dấu phẩy, khoảng trắng, tab, chấm phẩy, xuống dòng, `.env`, key trùng và chuỗi sai định dạng → kiểm tra đúng số lượng `N`, `M`, `K` và 100% chuỗi hiển thị đều ở dạng che.
2. **Kịch bản 2 (Failover `429` + Phát hiện trùng Project)**: Kho có Key A1, Key A2 (cùng thuộc Project `63415494298` có `quota_limit_value = "0"`) và Key B1 (thuộc Project khác, khỏe). Khi gọi luận giải: Key A1 lỗi `429` → hệ thống bóc tách được `project_number = 63415494298`, làm nguội cả nhóm Project `63415494298`, nhảy thẳng sang Key B1 trong **cùng request** và trả về bài luận giải thành công.
3. **Kịch bản 3 (Model Fallback `gemini-3.5-flash-lite` → `gemini-3.8-flash`)**: Giả lập lỗi `404` hoặc `503 model overloaded` trên `gemini-3.5-flash-lite` → hệ thống giữ nguyên key khỏe và tự chuyển sang `gemini-3.8-flash` trong cùng request.
4. **Kịch bản 4 (Máy trạng thái Cool Down, Jitter & Vô hiệu hóa)**: Kiểm tra `429 RPM` (đọc `RetryInfo` hoặc 60–120s + Jitter), `429 RPD` (tính theo mốc 00:05 PT), `401/403` (vào `disabled`, không tự hồi), `5xx` (nguội 30s).
5. **Kịch bản 5 (Hết thời gian nguội tự phục hồi & Chống đói điểm)**: Khi `now >= cooldownUntil`, key tự về `ready` (`pendingProbe = true`, điểm sàn xét chọn `85`) và phục hồi điểm khi gọi thành công.
6. **Kịch bản 6 (An toàn đồng thời & Giữ nguyên Khung xác định khi 0 key)**: Gửi 5 request song song không gây lỗi ghi file; khi tất cả key đều nguội hoặc kho rỗng, `InsightPanel` vẫn hiển thị nguyên vẹn **Khung dữ kiện xác định**.
7. **Kịch bản 7 (Zero Key Leakage)**: Quét toàn bộ API responses, SSE stream, server logs và thư mục build `dist/` đảm bảo **0 lần** xuất hiện chuỗi API key nguyên văn.

---

## 10. Các Quyết Định Đã Chốt

| Mã | Nội dung quyết định | Phương án đã chốt | Trạng thái quyết định |
| :---: | :--- | :--- | :--- |
| **QĐ-1** | **Kiểm soát quyền chỉnh sửa Kho Khóa khi truy cập qua `Shared App URL`** (`E2-02`) | **Phương án B**: Cho phép toàn quyền trên `Development App URL`; tự động chuyển sang chế độ **Chỉ xem (Read-Only)** trên `Shared App URL` công khai; muốn thêm/sửa/xóa phải nhập đúng `KEY_POOL_ADMIN_PIN`. | **Đã quyết 16/11/2026 theo phương án khuyến nghị của panel, do Muse quyết thay theo ủy quyền của người dùng** |
| **QĐ-2** | **Phạm vi áp dụng Kho Khóa & Model mặc định mới (`gemini-3.5-flash-lite` / `gemini-3.8-flash`)** | **Phương án B**: Áp dụng đồng bộ cho cả 3 endpoint AI (`/api/interpret-period`, `/api/interpret`, `/api/heming`). | **Đã quyết 16/11/2026 theo phương án khuyến nghị của panel, do Muse quyết thay theo ủy quyền của người dùng** |
| **QĐ-3** | **Chính sách đối với lỗi `429 quota_limit_value = "0"` (`QUOTA_PROJECT_ZERO`)** | **Phương án A**: Phân loại riêng `QUOTA_PROJECT_ZERO`, đưa vào **`cooldown` dài hạn 6 giờ**, hết hạn tự probe lại 1 lần; hỗ trợ Kích hoạt lại / Kiểm tra thử thủ công bất cứ lúc nào (không `disabled` vĩnh viễn). | **Đã quyết 16/11/2026 theo phương án khuyến nghị của panel, do Muse quyết thay theo ủy quyền của người dùng** |
| **QĐ-4** | **Kiểm tra thử tự động (`auto-probe`) khi người dùng bấm "Xác nhận lưu" nhiều key mới** | **Phương án A**: Lưu ngay ở trạng thái **`Sẵn sàng` (`100` điểm)**, **KHÔNG** tự động gọi API kiểm tra hàng loạt lúc lưu để tiết kiệm quota RPM. | **Đã quyết 16/11/2026 theo phương án khuyến nghị của panel, do Muse quyết thay theo ủy quyền của người dùng** |
| **QĐ-5** | **Ngân sách thời gian Failover tối đa cho 1 request** | **Chốt 35 giây** tổng ngân sách cho một request (tối đa **5 key**, mỗi lần thử timeout chờ chunk đầu tiên **12 giây**). | **Đã quyết 16/11/2026 theo phương án khuyến nghị của panel, do Muse quyết thay theo ủy quyền của người dùng** |
| **QĐ-6** | **Rút ngắn Cooldown `RATE_LIMIT_RPM` & Thử `fallbackModel` trên cùng key khi dính RPM** | `RATE_LIMIT_RPM` nguội **`10–30 giây`** (bậc `10s → 20s → 30s` $\pm 15\%$ jitter, hoặc **`5–60 giây`** theo `RetryInfo.retryDelay + 2s`); `executor` thử ngay model dự phòng `gemini-3.8-flash` trên cùng key khi gặp `RATE_LIMIT_RPM` hoặc `MODEL_UNAVAILABLE`. | **Thay đổi do người dùng quyết trực tiếp 16/11/2026 (giữ nguyên, không hoàn tác)** |
