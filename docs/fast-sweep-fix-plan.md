# KẾ HOẠCH TRIỂN KHAI FAST-SWEEP XỬ LÝ LỖI 0..3 KHI SINH TỰ ĐỘNG HỒ SƠ (`docs/fast-sweep-fix-plan.md`)

- **Loại tài liệu**: `[Kế hoạch Thi công Sau Phản biện Panel — 1.4.0-rc.2]`
- **Trạng thái**: `ĐÃ PHÊ DUYỆT (QĐ-F1..QĐ-F4, 19/11/2026)` — Siết chặt theo [`docs/fast-sweep-claude-review-v2.md`](fast-sweep-claude-review-v2.md)
- **Phạm vi**: `server/key-pool/executor.ts`, `server/key-pool/allocator.ts`, `server.ts`, `src/components/DetailedDossierModal.tsx`, `scripts/verify-key-pool.ts`

---

## PHẦN 1. DỰNG LẠI HIỆN TRƯỜNG CHÍNH XÁC TỪ DỮ LIỆU LOG (`error 0..3`)

Từ thông số thời gian chờ nguội giảm dần từng giây trong 4 lỗi runtime ghi nhận trên `/api/interpret-dossier-section`:
- `error 0`: `Project #765103984073` — `Khóa kế tiếp sẵn sàng sau khoảng 21600 giây` ($t = 0\text{s}$, Chương 1: `chapter_overview`)
- `error 1`: `Project #262584337602` — `Khóa kế tiếp sẵn sàng sau khoảng 21599 giây` ($t \approx +1\text{s}$, Chương 2: `palaces_core`)
- `error 2`: `Project #203367919063` — `Khóa kế tiếp sẵn sàng sau khoảng 21597 giây` ($t \approx +3\text{s}$, Chương 3: `palaces_family`)
- `error 3`: `Project #769513876547` — `Khóa kế tiếp sẵn sàng sau khoảng 21596 giây` ($t \approx +4\text{s}$, Chương 4: `palaces_social_health`)

**Chuỗi domino thực tế đã xảy ra (7 bước):**
1. Kho khóa đang có $\ge 20$ khóa `ready` mới nhập (chưa biết trước `detectedProjectNumber`), trong đó tối thiểu 20 khóa đầu thuộc các Google Cloud Project có `quota_limit_value = "0"`.
2. Khi người dùng bấm **"Sinh tự động toàn bộ hồ sơ"** (`handleRunAllSequential` tại `src/components/DetailedDossierModal.tsx:811`), Chương 1 gọi `POST /api/interpret-dossier-section`.
3. `executeStream` (`server/key-pool/executor.ts:172`) chỉ thử đúng `MAX_KEY_ATTEMPTS = 5` khóa đầu tiên (thời gian tổng 5 lượt gọi không đo trực tiếp theo mili-giây trong log; suy luận qua chênh lệch cooldown giữa 4 lỗi liên tiếp trừ `1.2s` pacing cho thấy 5 lượt lỗi `429` hoàn tất trong khoảng $< 1\text{–}2$ giây). Cả 5 khóa đều dính `429 QUOTA_PROJECT_ZERO` và chuyển sang `cooldown` 6 giờ (`21.600s`).
4. Lúc thoát vòng `while (keyAttemptsUsed < MAX_KEY_ATTEMPTS)`, ngân sách `35.000 ms` vẫn còn dư phần lớn (thời gian dư chính xác không đo trực tiếp trong log, ước lượng $> 30$ giây) và trong kho vẫn còn $\ge 15$ khóa `ready` (`remainingUsable > 0`). Vì `remainingUsable > 0`, `executor.ts:445` **không** ném `PoolExhaustedError`, mà rơi xuống dòng 449: `throw new Error(cleanMsg)`.
5. `server.ts:960` kiểm tra `if (err instanceof PoolExhaustedError && !sseStarted)` $\rightarrow$ **SAI** (vì là `Error` thường). Request rơi xuống dòng 969–972:
   - `keyPoolManager.sanitize(err)` gọi `collectErrorText(err)` (`allocator.ts:27–35`), nối `${raw.name}: ${raw.message}` với `raw.stack` (vốn cũng mở đầu bằng `Error: <message>`), tạo ra chuỗi nhân đôi `Error: ... | Error: ...` kèm stack trace.
   - `console.warn` ghi chuỗi này ra **`process.stderr`** $\rightarrow$ trình giám sát AI Studio bắt thành `error 0`.
   - Server mở luồng SSE HTTP 200 trả `{ error: 'AI_CALL_FAILED', message }` rồi đóng.
6. Phía Client (`DetailedDossierModal.tsx:672`): dù `accumulated` hoàn toàn rỗng (`""`), nhánh `if (wasInterrupted || streamError)` vẫn gán chương 1 thành `status: 'incomplete'`, trả về `'incomplete'`.
7. Vòng lặp `handleRunAllSequential` (`DetailedDossierModal.tsx:847`) chỉ dừng khi `outcome === 'aborted'`, nên sau `1.200ms` (`DOSSIER_INTER_CHAPTER_PACING_MS`) nó tự động bắn tiếp Chương 2 (quét khóa #6..10 $\rightarrow$ `error 1`), rồi Chương 3 (quét khóa #11..15 $\rightarrow$ `error 2`), rồi Chương 4 (quét khóa #16..20 $\rightarrow$ `error 3`).

---

## PHẦN 2. PHẢN BIỆN CHÉO CỦA TỔ CHUYÊN GIA

### 1. Chuyên gia Kiến trúc KeyPool & Failover (`server/key-pool/executor.ts`, `allocator.ts`)
- **Phản biện**: Nếu chỉ bỏ đếm `keyAttemptsUsed` vô điều kiện cho `QUOTA_PROJECT_ZERO`, chuyện gì xảy ra nếu kho có tới 50 khóa lỗi và mạng chậm? Ngoài ra cần giữ nguyên 4 hằng số trong `server/key-pool/types.ts` (`MAX_KEY_ATTEMPTS = 5`, `TOTAL_FAILOVER_TIME_BUDGET_MS = 35_000`, `FIRST_CHUNK_TIMEOUT_MS = 12_000`, `MAX_KEYS_IN_POOL = 50`).
- **Tối ưu hóa (kèm siết chặt vòng 2 `FS2-01`, `FS2-02`, `FS2-05`, `FS2-06`)**:
  - Tách bạch **Lượt thử lỗi tạm thời (`keyAttemptsUsed`, trần `MAX_KEY_ATTEMPTS = 5`)** và **Lượt quét nhanh khóa cố định (`fastEliminatedSweeps`, trần `MAX_KEYS_IN_POOL = 50` lượt gọi API)**:
    - Phân loại quét **chỉ dựa theo `classified.category`** (không dựa vào thời gian phản hồi lượt gọi — `FS2-05`), khi và chỉ khi chưa phát chunk nào (`!attemptSentAnyChunk`) và `classified.category` thuộc nhóm loại bỏ khóa cố định `{ 'QUOTA_PROJECT_ZERO', 'QUOTA_DAILY_EXHAUSTED', 'AUTH_INVALID_KEY' }`: tăng `fastEliminatedSweeps += 1` (theo từng lượt gọi API — `FS2-02`) và **không tăng `keyAttemptsUsed`**.
    - Các lỗi tạm thời/cấp model (`MODEL_UNAVAILABLE`, `RATE_LIMIT_RPM`, `NETWORK_OR_5XX`, `UNKNOWN`) chỉ tăng `keyAttemptsUsed` khi khóa chuyển khỏi vòng thử (`MAX_KEY_ATTEMPTS = 5`), đồng thời luôn kiểm tra ngân sách thời gian `nowFn() - requestStartMs >= TOTAL_FAILOVER_TIME_BUDGET_MS` (`35.000 ms`) trước mỗi lượt thuê khóa / gọi model.
  - **Chuẩn hóa `PoolExhaustedError` có điều kiện (`FS2-01`)**:
    - Cuối `executeStream` (khi `!firstChunkEverSent`), chỉ ném `new PoolExhaustedError('AI_POOL_EXHAUSTED', cleanMsg, minSec)` nếu:
      1. `remainingUsable === 0`, **HOẶC**
      2. Ngân sách `TOTAL_FAILOVER_TIME_BUDGET_MS` đã cạn, **HOẶC**
      3. `lastClassifiedError?.category` thuộc `{ 'QUOTA_PROJECT_ZERO', 'QUOTA_DAILY_EXHAUSTED', 'RATE_LIMIT_RPM', 'AUTH_INVALID_KEY', 'MODEL_UNAVAILABLE', 'NETWORK_OR_5XX' }`.
    - Nếu lỗi cuối là `UNKNOWN` (ví dụ lỗi request `400` phía đầu vào) và còn khóa `ready` + chưa cạn ngân sách, **giữ `throw new Error(cleanMsg)`** để không nuốt lỗi `400` thành `503`.

### 2. Chuyên gia Runtime & Log Hygiene (`server/key-pool/allocator.ts`, `server.ts`)
- **Phản biện**: Chuỗi log bị lặp `Error: <msg> | Error: <msg>` do trong V8/Node.js, `raw.stack` luôn mở đầu bằng `${raw.name}: ${raw.message}`. Việc push cả `${raw.name}: ${raw.message}` lẫn `raw.stack` gây nhân đôi chuỗi và `console.warn` ghi ra `stderr`.
- **Tối ưu hóa**:
  - Trong `collectErrorText` (`server/key-pool/allocator.ts`): Khi trích `raw.stack`, cắt bỏ dòng tiêu đề đầu tiên nếu nó trùng với `${raw.name}: ${raw.message}` để khử triệt để chuỗi lặp `Error: ... | Error: ...`.
  - Trong `server.ts` (3 endpoint `/api/interpret-period`, `/api/interpret-dossier-section`, `/api/interpret-chat`): Thay `console.warn(... safeDetail)` trên `stderr` bằng `console.log` gọn trên `stdout` chỉ in `clientMessage` một lần, không xuất tiền tố `Error:` hoặc stack trace ra `stderr`. *(Hai endpoint `/api/interpret` và `/api/heming` dùng chung `keyPoolManager.executeStream` cũng được hưởng lợi từ Fast-Sweep và fallback cục bộ sạch không ghi `stderr`.)*

### 3. Chuyên gia Frontend & Điều phối Hồ Sơ Toàn Diện (`src/components/DetailedDossierModal.tsx`)
- **Phản biện**: Có 2 điểm nghẽn UX trong `DetailedDossierModal.tsx` khi chạy sinh tự động 8 chương (`handleRunAllSequential`):
  1. Khi server trả `{ error: 'AI_CALL_FAILED', message }` mà `accumulated.trim()` rỗng (`0` ký tự), nhánh `if (wasInterrupted || streamError)` gán `status: 'incomplete'` và trả về `'incomplete'`.
  2. `handleRunAllSequential` chỉ `break` khi `outcome === 'aborted'`, nên tiếp tục bắn các chương còn lại sau khi Chương 1 đã thất bại hoàn toàn.
- **Tối ưu hóa (`FS2-03`)**:
  - Trong `executeSingleChapterStream` (`DetailedDossierModal.tsx`): Khi `wasInterrupted || streamError`, kiểm tra `accumulated.trim().length > 0`:
    - Nếu **đã có chữ dở** (`accumulated.trim().length > 0`): giữ trạng thái `'incomplete'` và trả về `'incomplete'` (không ngắt chuỗi `run-all`).
    - Nếu **rỗng (`0` ký tự)**: đặt trạng thái chương là `status: 'error'` (cả trong `localChapters` và `aiPeriodCache` nếu là chương lưu niên) và trả về `'error'`.
  - Trong `handleRunAllSequential`: Thêm cầu chì `if (outcome === 'error' || outcome === 'aborted' || cancelAutoRef.current) break;` để dừng ngay tại chương lỗi mà **không thay đổi trạng thái các chương chưa chạy**.

---

## PHẦN 3. BẢNG KẾ HOẠCH THI CÔNG CHI TIẾT

| STT | File | Phạm vi dòng dự kiến | Nội dung thay đổi chi tiết (đã tích hợp siết chặt vòng 2) |
|---|---|---|---|
| **1** | `server/key-pool/allocator.ts` | `27–40` | Trong `collectErrorText`: Khi trích `raw.stack`, cắt bỏ dòng đầu tiên nếu nó trùng `${raw.name}: ${raw.message}` để khử triệt để chuỗi lặp `Error: ... \| Error: ...`. |
| **2** | `server/key-pool/executor.ts` | `159–205`, `318–360`, `434–455` | • Tách `keyAttemptsUsed` (trần `MAX_KEY_ATTEMPTS = 5`) và `fastEliminatedSweeps` (trần `MAX_KEYS_IN_POOL = 50` lượt gọi API — `FS2-02`).<br>• Điều kiện vòng ngoài kiểm tra `TOTAL_FAILOVER_TIME_BUDGET_MS` (`35_000 ms`) trước mỗi lượt.<br>• Sau mỗi lượt gọi thất bại khi `!attemptSentAnyChunk`, nếu `classified.category` thuộc `{ 'QUOTA_PROJECT_ZERO', 'QUOTA_DAILY_EXHAUSTED', 'AUTH_INVALID_KEY' }`, tăng `fastEliminatedSweeps += 1` (không tăng `keyAttemptsUsed`); các lỗi còn lại mới tăng `keyAttemptsUsed += 1` (`FS2-05`).<br>• Cuối `executeStream` (khi `!firstChunkEverSent`), chuẩn hóa `PoolExhaustedError('AI_POOL_EXHAUSTED', cleanMsg, minSec)` theo điều kiện `FS2-01`; riêng `UNKNOWN` khi còn khóa `ready` & chưa hết 35s vẫn ném `new Error(cleanMsg)`. |
| **3** | `server.ts` | `843–847`, `969–973`, `1095–1099` | Tại 3 endpoint (`/api/interpret-period`, `/api/interpret-dossier-section`, `/api/interpret-chat`): Thay `console.warn(... safeDetail)` trên `stderr` bằng `console.log` gọn trên `stdout` chỉ chứa `clientMessage` một lần, không xuất `Error:`/stack ra `stderr`. |
| **4** | `src/components/DetailedDossierModal.tsx` | `672–720`, `844–852` | • Nhánh `wasInterrupted \|\| streamError`: chỉ chuyển `'incomplete'` khi `accumulated.trim().length > 0`; nếu rỗng (`0` ký tự), gán `status: 'error'` và trả về `'error'`.<br>• Trong `handleRunAllSequential`: `break` ngay khi `outcome === 'error' \|\| outcome === 'aborted'`, giữ nguyên trạng thái các chương chưa chạy (`FS2-03`). |
| **5** | `scripts/verify-key-pool.ts` | Cuối file (`BÀI 19`) | Bổ sung **Bài 19** phủ đủ 5 ca (`FS2-04`): (a) 8 khóa `QUOTA_PROJECT_ZERO` trước 1 khóa sống $\rightarrow$ thành công khóa thứ 9 trong 1 request; (b) cả kho `QUOTA_PROJECT_ZERO` $\rightarrow$ `PoolExhaustedError` trong 1 request; (c) `FS2-01` toàn bộ lỗi `UNKNOWN` (dạng 400) $\rightarrow$ ném `Error` thường (không phải `PoolExhaustedError`); (d) `FS2-02` 2 khóa cùng project trước khóa sống $\rightarrow$ chỉ 1 lượt gọi dọn cả 2; (e) `FS2-04` khóa chết phản hồi chậm $\rightarrow$ dừng đúng ngân sách `35s` và trả `PoolExhaustedError` sạch. |
