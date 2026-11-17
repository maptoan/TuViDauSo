# ĐẶC TẢ VẬN HÀNH KHO KHÓA GEMINI (`docs/key-pool-operations.md`)

- **Loại tài liệu**: `[Tài liệu Sống — SSOT Vận hành Kho Khóa & Failover]`
- **Trạng thái hiệu lực**: `ĐANG HIỆU LỰC (ACTIVE)`
- **Áp dụng cho phiên bản ứng dụng**: `1.1.0-rc.1` *(đồng bộ với `/VERSION`)*
- **Cập nhật lần cuối**: `17/11/2026` *(đã tích hợp `QĐ-H4` theo `docs/h4-diagnosis.md`)*
- **Mã nguồn đối chiếu (Code SSOT)**: `server/key-pool/types.ts`, `server/key-pool/allocator.ts`, `server/key-pool/executor.ts`, `server/key-pool/crypto-store.ts`, `server/key-pool/index.ts`, `src/lib/key-pool-ui.ts`
- **Quyết định liên quan**: `QĐ-1..QĐ-6`, `QĐ-H4` *(chi tiết tại `docs/decisions-registry.md`)*

---

## 1. Phạm Vi SSOT & Quy Tắc Dữ Liệu Động

- File này là **Nguồn Sự Thật Duy Nhất (Doc SSOT)** cho mọi hằng số cấu hình, trạng thái khóa, công thức chấm điểm, thuật toán phân loại lỗi, cơ chế failover/continuation và mã hóa của Kho Khóa Gemini.
- **Tuyệt đối không ghi cứng số lượng khóa runtime** (`ready`, `cooldown`, `disabled`, `total`) trong tài liệu này. Trạng thái kho thay đổi theo thời gian thực khi người dùng thêm/xóa khóa hoặc hết thời gian chờ; để xem số liệu thực tế hãy mở **Quản lý Kho Khóa Gemini** trên giao diện hoặc gọi `GET /api/key-pool` (`summary`) / `GET /api/ai-diagnostics`.

---

## 2. Hằng Số Vận Hành Chính Thức (`#hang-so-van-hanh`)

Mọi hằng số dưới đây được trích xuất trực tiếp từ `server/key-pool/types.ts:179–200` (trừ khi ghi rõ file khác):

| Tên hằng số | Giá trị thực tế | Vị trí trong Code SSOT | Ý nghĩa vận hành |
|---|---|---|---|
| `DEFAULT_MODEL` | `'gemini-3.5-flash-lite'` | `server/key-pool/types.ts:179` | Model chính mặc định cho mọi luồng AI |
| `FALLBACK_MODEL` | `'gemini-3.8-flash'` | `server/key-pool/types.ts:180` | Model dự phòng khi `DEFAULT_MODEL` quá tải/lỗi |
| `DEFAULT_SUPPORTED_MODELS` | 5 model chuẩn (`3.5-flash-lite`, `3.5-flash`, `3.8-flash`, `4-hydrogen`, `4-argon`) | `server/key-pool/types.ts:181–187` | Danh sách model được phép chọn trong `PUT /api/key-pool/models` |
| `MAX_RAW_INPUT_CHARS` | `65_536` | `server/key-pool/types.ts:189` | Giới hạn chuỗi văn bản đầu vào khi dán khóa nhập kho |
| `MAX_KEYS_IN_POOL` | `50` | `server/key-pool/types.ts:190` | Trần số lượng khóa tối đa lưu trong 1 kho |
| `MAX_KEY_ATTEMPTS` | `5` | `server/key-pool/types.ts:191` | Số lần thử đổi khóa tối đa cho một yêu cầu |
| `FIRST_CHUNK_TIMEOUT_MS` | `12_000` (`12 giây`) | `server/key-pool/types.ts:192` | Thời gian chờ tối đa cho mảnh phản hồi đầu tiên ở mỗi lượt |
| `TOTAL_FAILOVER_TIME_BUDGET_MS` | `35_000` (`35 giây`) | `server/key-pool/types.ts:193` | Tổng ngân sách thời gian failover cho một yêu cầu (`QĐ-5`) |
| `TEST_KEY_TIMEOUT_MS` | `8_000` (`8 giây`) | `server/key-pool/types.ts:194` | Timeout khi bấm kiểm thử thủ công 1 khóa |
| `TEST_KEY_DEBOUNCE_MS` | `5_000` (`5 giây`) | `server/key-pool/types.ts:195` | Khoảng chống nhấn kiểm thử liên tiếp trên cùng khóa |
| `LEASE_MAX_TTL_MS` | `45_000` (`45 giây`) | `server/key-pool/types.ts:196` | Thời hạn giữ chỗ thực thi thông thường của một lease |
| `LEASE_ABSOLUTE_MAX_TTL_MS` | `120_000` (`120 giây`) | `server/key-pool/types.ts:197` | Thời hạn cưỡng chế thu hồi lease treo tối đa |
| `PREVIEW_SESSION_TTL_MS` | `300_000` (`5 phút`) | `server/key-pool/types.ts:198` | Thời hạn token xem trước trước khi xác nhận nhập khóa |
| `MAX_PREVIEW_SESSIONS` | `20` | `server/key-pool/types.ts:199` | Số phiên xem trước tối đa giữ trong bộ nhớ |
| `MAX_RECENT_LOGS` | `100` | `server/key-pool/types.ts:200` | Độ dài nhật ký sự kiện gần nhất không chứa khóa thô |
| `BATCH_COOLDOWN_PROBE_DELAY_MS` | `1_200` (`1.2 giây`) | `src/lib/key-pool-ui.ts:92` | Giãn nhịp client khi dò tuần tự các khóa `cooldown` |

---

## 3. Mô Hình Trạng Thái & Phân Loại Lỗi (`allocator.ts`)

### 3.1. Tập giá trị trạng thái (`KeyStatus` & `KeyErrorCategory`)
- **`KeyStatus`** (`server/key-pool/types.ts:1`): `'ready' | 'cooldown' | 'disabled'`.
- **`KeyErrorCategory`** (`server/key-pool/types.ts:3–11`): `'NONE' | 'RATE_LIMIT_RPM' | 'QUOTA_PROJECT_ZERO' | 'QUOTA_DAILY_EXHAUSTED' | 'AUTH_INVALID_KEY' | 'NETWORK_OR_5XX' | 'MODEL_UNAVAILABLE' | 'UNKNOWN'`.

### 3.2. Phân loại lỗi `classifyGeminiError` (`server/key-pool/allocator.ts:63–176`) & Bản vá `QĐ-H4`
Hàm `classifyGeminiError` duyệt theo thứ tự ưu tiên từ nghiêm trọng/cố định đến tạm thời:
1. **`AUTH_INVALID_KEY`** (`allocator.ts:96–105`): Mã `401`/`403` hoặc chuỗi khóa không hợp lệ (`API_KEY_INVALID`, `PERMISSION_DENIED`) → khóa bị chuyển sang `'disabled'`, `healthScore = 0`.
2. **`MODEL_UNAVAILABLE`** (`allocator.ts:107–120`): Khớp `503` quá tải/bảo trì (`UNAVAILABLE`, `high demand`, `overloaded`, `model not found`, `404`) **và từ `QĐ-H4` đã gộp mẫu `\bAbortError\b|FIRST_CHUNK_TIMEOUT|This operation was aborted|The operation was aborted` (`allocator.ts:110`)**.
   - **Ý nghĩa `QĐ-H4`**: Khi hết hạn chờ chunk đầu tiên (`FIRST_CHUNK_TIMEOUT_MS` hoặc bị co lại theo phần còn lại của ngân sách `35 giây`), `attemptAbort.abort(...)` ném `AbortError` sẽ được phân loại là `'MODEL_UNAVAILABLE'` (`0` điểm phạt, không khóa cả key), giúp `executor.ts` chuyển ngay sang model dự phòng (`FALLBACK_MODEL`) hoặc khóa khác mà không phạt oan khóa khỏe mạnh.
3. **`QUOTA_PROJECT_ZERO` & `QUOTA_DAILY_EXHAUSTED`** (`allocator.ts:122–147`): Lỗi `429` kèm `limit: 0` (chỉ định `QUOTA_PROJECT_ZERO`) hoặc `PerDay` / `daily` (`QUOTA_DAILY_EXHAUSTED`).
4. **`RATE_LIMIT_RPM`** (`allocator.ts:149–154`): Lỗi `429` giới hạn tốc độ theo phút (`RESOURCE_EXHAUSTED`, `Too Many Requests`).
5. **`NETWORK_OR_5XX`** (`allocator.ts:156–168`): Lỗi mạng/máy chủ thực sự (`500`, `502`, `503` không phải quá tải model, `504`, `ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`, `ECONNREFUSED`, `fetch failed`, `TimeoutError`).
6. **`UNKNOWN`** (`allocator.ts:170–175`): Các ngoại lệ chưa rõ nguyên nhân.

### 3.3. Thời gian Cooldown & Phạt Điểm Sức Khỏe
- **`computeCooldownDurationMs`** (`allocator.ts:238–272`):
  - `QUOTA_PROJECT_ZERO`: `6 giờ` (`21_600_000 ms`, `allocator.ts:256`).
  - `QUOTA_DAILY_EXHAUSTED`: Tự tính tới nửa đêm giờ Thái Bình Dương (`America/Los_Angeles`) cộng `5 phút`, kẹp trong `[15 phút .. 12 giờ]` (`allocator.ts:213–236, 257–261`).
  - `RATE_LIMIT_RPM`: Theo `retryDelay` từ Gemini kẹp `[5s .. 60s]`, hoặc bậc thang `[10s, 20s, 30s]` cộng jitter `±15%` (`allocator.ts:246–254`).
  - `NETWORK_OR_5XX` / `UNKNOWN`: `30_000 ms` (`30 giây`) cộng jitter `±15%` (`allocator.ts:262–266`).
- **Cooldown theo từng Model (`modelCooldowns` & `recordModelIssue`)** (`allocator.ts:590–682`):
  - Với `MODEL_UNAVAILABLE`: Chỉ đưa riêng `modelName` trên khóa đó vào `modelCooldowns` trong `15_000 ms` (`15 giây`, `allocator.ts:617`); **0 điểm phạt cho khóa**.
  - Với `RATE_LIMIT_RPM`: Đưa riêng model đó (và lan truyền cùng model cho các khóa chia sẻ `detectedProjectNumber` tại `allocator.ts:641–650`) vào `modelCooldowns` trước khi thử sang `FALLBACK_MODEL`; chỉ gọi `recordFailure` phạt cả khóa nếu mọi model đều chạm trần (`allocator.ts:657`).
- **Lan truyền theo Google Cloud Project (`detectedProjectNumber`)**: Khi gặp `QUOTA_PROJECT_ZERO` hoặc `QUOTA_DAILY_EXHAUSTED`, toàn bộ khóa đã biết dùng chung `detectedProjectNumber` được đồng bộ trạng thái `cooldown` (`allocator.ts:788–821`), tránh lãng phí lượt thử trên cùng một project hết hạn mức.

---

## 4. Thuật Toán Chọn Khóa (`acquireLease`) & Phục Hồi (`sweep`)

### 4.1. Quét phục hồi định kỳ (`sweep` — `allocator.ts:342–397`)
1. Giải phóng các khóa vượt `LEASE_ABSOLUTE_MAX_TTL_MS` hoặc xóa các mục `modelCooldowns` đã hết hạn.
2. Khóa ở trạng thái `'cooldown'` khi qua mốc `cooldownUntil` sẽ tự chuyển về `'ready'`, bật cờ `pendingProbe = true`, và đặt **`healthScore = Math.max(key.healthScore, 95)`** (`probeFloorScore = 95`, `allocator.ts:379, 436–440`).
3. Phục hồi thụ động: Khóa đang `'ready'` cứ sau `10 phút` ổn định được cộng `+5` điểm tới tối đa `95` (`allocator.ts:386–390`).

### 4.2. Công thức xếp hạng chọn khóa (`acquireLease` — `allocator.ts:399–531`)
Với mỗi khóa `'ready'` có ít nhất 1 model không nằm trong `modelCooldowns`:
- `baseScore = key.pendingProbe ? Math.max(key.healthScore, 95) : key.healthScore` (`allocator.ts:440`)
- `latencyPenalty = key.avgLatencyMs ? Math.min(10, Math.floor(key.avgLatencyMs / 250)) : 0` (`allocator.ts:441–443`)
- `inFlightPenalty = inFlight * 6` (`allocator.ts:444`)
- `modelBonus = +8` nếu `defaultModel` sẵn sàng (`allocator.ts:448`)
- `effectiveScore = baseScore - latencyPenalty - inFlightPenalty + modelBonus`
- `healthTier = Math.floor(effectiveScore / 5)` (`allocator.ts:450`)
- Nhóm các ứng viên thuộc bậc `healthTier` cao nhất và **xoay vòng round-robin** bằng `roundRobinCursor` (`allocator.ts:458–472`) để phân tải đều các khóa khỏe.

### 4.3. Ghi nhận thành công (`recordSuccess` — `allocator.ts:533–588`)
- Nếu khóa vừa hồi phục (`pendingProbe`), ghi sự kiện **`PROBE_SUCCESS`** (cộng `+25` điểm, sàn `70`, trần `100`, `allocator.ts:565–574`).
- Nếu gọi bình thường thành công, ghi sự kiện **`CALL_SUCCESS`** (cộng `+5` điểm, trần `100`, `allocator.ts:575–585`) vào `recentLogs` (`MAX_RECENT_LOGS = 100`).

---

## 5. Vòng Thực Thi Stream, Failover & Tự Động Viết Nối Tiếp (`executor.ts`)

1. **Vòng failover có ngân sách (`executeStream` — `server/key-pool/executor.ts:115–442`)**:
   - Giới hạn tối đa `MAX_KEY_ATTEMPTS = 5` lần thuê khóa và tổng thời gian không vượt `TOTAL_FAILOVER_TIME_BUDGET_MS = 35_000 ms`.
   - Trước mỗi lượt gọi Gemini, bộ hẹn giờ đặt mức `firstChunkTimeoutMs = Math.min(FIRST_CHUNK_TIMEOUT_MS, remainingTotalMs)` (`executor.ts:236`) theo dõi cờ `attemptSentAnyChunk` (`executor.ts:221`).
   - Khi có lỗi trước khi gửi bất kỳ chunk nào (`!attemptSentAnyChunk`), `executor.ts` quay vòng đổi model dự phòng hoặc thuê khóa kế tiếp trong ngân sách `35 giây`.
2. **Tự động viết nối tiếp khi đứt luồng giữa chừng (`buildContinuationPrompt` — `executor.ts:93–106`)**:
   - Nếu stream bị ngắt sau khi đã nhận một phần nội dung (`streamedTextSoFar`), cho phép tối đa `maxContinuations = 2` lần viết nối tiếp (`executor.ts:160`), ưu tiên model dự phòng (`FALLBACK_MODEL`) khi nối tiếp (`executor.ts:208–213`) kèm đuôi văn bản đã nhận để AI viết tiếp liền mạch không lặp lại.
3. **Thông báo gián đoạn một kênh (`QĐ-H4` — `executor.ts:364–368, 405–409`)**:
   - Nếu hết ngân sách hoặc hết lượt nối tiếp sau khi đã gửi dữ liệu, `executor.ts` **chỉ phát sự kiện cấu trúc `options.onInterrupted`** (không bơm câu cảnh báo lặp vào `options.onChunk`), để tầng endpoint/client hiển thị thông báo sạch một lần.

---

## 6. Bảo Mật Mã Hóa Lưu Trữ & Giao Diện Quản Trị

- **Mã hóa đĩa (`server/key-pool/crypto-store.ts`)**: Toàn bộ tệp `.data/gemini-key-pool.enc.json` (`crypto-store.ts:21`) được mã hóa bằng **`AES-256-GCM`** (`crypto-store.ts:97–119`). Khóa chủ lấy từ biến môi trường `KEY_POOL_MASTER_SECRET` qua `HKDF-SHA256`, hoặc tự sinh khóa 32-byte lưu quyền `0600` tại `.data/.pool-master.key` (`crypto-store.ts:59–95`). Mọi thao tác ghi đều tuần tự hóa qua `SerializedWriteQueue` (`crypto-store.ts:24–32`) tránh tranh chấp file.
- **Che mặt nạ khóa**: Mọi phản hồi API và nhật ký lỗi chỉ trả dạng che mặt nạ (`AIzaSy••••••xxxx`), tuyệt đối không lộ khóa nguyên văn.
- **Giao diện `KeyPoolModal.tsx` & `src/lib/key-pool-ui.ts`**: Refresh dữ liệu theo sự kiện mở modal / thao tác (`shouldRefreshKeyPoolSnapshot` tại `key-pool-ui.ts:81–88`), không chạy timer thăm dò liên tục ở nền.
