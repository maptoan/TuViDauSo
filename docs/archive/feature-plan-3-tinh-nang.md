> ⚠️ **[TÀI LIỆU LỊCH SỬ ĐÃ LƯU TRỮ — KHÔNG DÙNG LÀM CĂN CỨ CODE HIỆN HÀNH]**
> - **Trạng thái**: Đã hoàn thành vai trò lịch sử / Đã bị thay thế bởi tài liệu sống **[`docs/features-dossier-and-chat.md`](../features-dossier-and-chat.md)** từ ngày `17/11/2026`.
> - **Cảnh báo cho Kỹ sư & AI Agent**: Các trích dẫn số dòng, tên biến, hằng số (như ngân sách 25s, nhịp nghỉ 2200ms, số lượng key 3/23) trong file này phản ánh thời điểm trước khi hợp nhất và **không còn khớp với mã nguồn hiện hành**. Tuyệt đối đọc tài liệu sống tại thư mục `docs/` gốc và đối chiếu code thật trước khi chẩn đoán hoặc sửa code!

---
# Bản Kế Hoạch Thiết Kế Chi Tiết: 3 Tính Năng Mở Rộng Cho "Tử Vi Thiên Kỷ"

- **Phiên bản tài liệu**: `v1.0` (Do Gemini 4 Argon thiết kế kiến trúc)
- **Ngày lập**: `2026-11-16`
- **Trạng thái thực thi**: **Chỉ lập kế hoạch thiết kế — tuyệt đối chưa triển khai code**
- **Tài liệu nền tảng tham chiếu**: `docs/key-pool-design-plan.md` (v2.0, kèm các quyết định đã chốt `QĐ-1` → `QĐ-6`) và `docs/stream-interruption-diagnosis.md`

---

## 1. Khảo Sát Hiện Trạng (Current State Inventory)

### 1.1. Hạ tầng Kho Khóa Gemini API & Điều Phối Model (Đã triển khai và vận hành ổn định)
- **Lưu trữ & Bảo mật (`server/key-pool/crypto-store.ts`, `server/key-pool/parser.ts`)**:
  - Lưu trữ mã hóa `AES-256-GCM` tại `.data/gemini-key-pool.enc.json` thông qua `SerializedWriteQueue`, tách khóa chủ tại `.data/.pool-master.key` độc lập khỏi `GEMINI_API_KEY`.
  - Mọi khóa hiển thị qua API/UI đều ở dạng che `AIzaSy••••••xxxx` (`maskApiKey`); mọi thông báo lỗi qua `sanitizeSecretText()` (`server/key-pool/allocator.ts:45-54`).
  - Bảo vệ quyền ghi (`server.ts:32-82`, hàm `getRequestSecurityContext` & `requireKeyPoolWriteAccess`): theo **QĐ-1 Phương án B**, trên `Shared App URL` (`ais-pre-...`) mặc định ở chế độ **Chỉ xem (`isReadOnly = true`)**, muốn thực hiện bất kỳ thao tác ghi nào phải gửi header `x-key-pool-pin` khớp với `process.env.KEY_POOL_ADMIN_PIN`.
- **Cấp phát khóa, Máy trạng thái Cool Down & Chấm điểm (`server/key-pool/allocator.ts`)**:
  - `acquireLease()` (`allocator.ts:399-530`): chọn khóa theo bậc sức khỏe `healthTier = Math.floor(effectiveScore / 5)`, xoay vòng `roundRobinCursor`, hỗ trợ `probeFloorScore = 95` cho khóa vừa hết hạn nguội (`pendingProbe = true`), phạt độ trễ mịn theo bước `250ms` (trần `10` điểm), cộng `+8` điểm cho khóa còn dùng được `defaultModel`, phạt tải đồng thời `inFlightCount * 6`, và giữ khóa qua `KeyLease` có `heartbeat()` trượt TTL `45s` (trần `120s`).
  - `classifyGeminiError()` (`allocator.ts:63-176`) & `computeCooldownDurationMs()` (`allocator.ts:238-272`):
    - `QUOTA_PROJECT_ZERO` (`429` có `quota_limit_value = "0"`): nguội **`6 giờ` (`21.600s`)**, trừ `60` điểm (sàn `5`), lan truyền sang toàn bộ khóa cùng `detectedProjectNumber` (**QĐ-3**).
    - `RATE_LIMIT_RPM` (`429` theo phút): đặt `modelCooldowns[model]` (`10s → 20s → 30s` $\pm 15\%$ jitter hoặc `RetryInfo.retryDelay + 2s` trong khoảng `5s..60s`), cho phép `executor` thử ngay `fallbackModel` trên cùng khóa trước khi hạ cả khóa vào `cooldown` (**QĐ-6 — thay đổi do người dùng quyết trực tiếp 16/11/2026, giữ nguyên**).
    - `QUOTA_DAILY_EXHAUSTED` (`429` theo ngày): nguội tới **00:05 AM giờ Thái Bình Dương (`America/Los_Angeles`)** (tối thiểu `15 phút`, tối đa `12 giờ`), trừ `40` điểm (sàn `10`), lan truyền theo `project_number`.
    - `MODEL_UNAVAILABLE` (`404` hoặc `503 UNAVAILABLE / overloaded / high demand`): giữ `status = 'ready'`, không trừ điểm, chỉ đặt `modelCooldowns[model] = 15s` và chuyển sang `fallbackModel`.
    - `NETWORK_OR_5XX`: nguội `30s` ($\pm 15\%$ jitter), trừ `10` điểm (sàn `20`).
    - `AUTH_INVALID_KEY` (`401/403`): chuyển `disabled` vĩnh viễn (`healthScore = 0`).
- **Thực thi Stream, Failover & Tiếp nối luồng (`server/key-pool/executor.ts`)**:
  - `GeminiStreamExecutor.executeStream()` (`executor.ts:115-448`): ngân sách kép **`35 giây` tổng / tối đa `5 key` / timeout chờ chunk đầu `12 giây`** (**QĐ-5**); tự động tiếp nối luồng (`buildContinuationPrompt`, tối đa `2` lượt nối tiếp ưu tiên `fallbackModel`) khi đứt kết nối sau khi đã nhận chunk đầu tiên.
- **Hiện trạng thực tế của Kho Khóa**:
  - Tổng cộng **23 key**, trong đó **3 key khỏe (`ready`)** thuộc gói miễn phí (free tier) và **20 key đang `cooldown` 6 giờ** do `QUOTA_PROJECT_ZERO`.

---

### 1.2. Khảo sát chi tiết cho từng tính năng mới (Cái gì đã có để tái dùng vs. Cái gì còn thiếu)

#### A. Đối với Tính năng 1 — Nút "Test lại toàn bộ key đang cooldown" trong Dashboard Kho Khóa

| Thành phần | Đã có sẵn trong dự án (Tái sử dụng trực tiếp) | Còn thiếu (Cần thiết kế bổ sung) |
| :--- | :--- | :--- |
| **Hàm kiểm tra 1 key đơn lẻ** | `KeyPoolManager.testKey(keyId, customClientFactory?)` tại `server/key-pool/index.ts:365-442`: gọi `client.models.generateContent` với `model = defaultModel`, prompt `'Trả lời đúng 1 từ: OK'`, `maxOutputTokens: 8`, timeout `TEST_KEY_TIMEOUT_MS = 8_000ms`. | `testKey()` hiện có chốt chặn `TEST_KEY_DEBOUNCE_MS = 5_000ms` theo từng key và chưa có cơ chế chạy hàng loạt có điều tiết nhịp hoặc bỏ qua các key thuộc cùng `detectedProjectNumber` vừa xác nhận vẫn bị lỗi cấp Project trong cùng đợt quét. |
| **Cập nhật điểm & trạng thái sau khi probe** | `KeyAllocator.recordManualTestResult(keyId, ok, latencyMs, classified, now)` tại `server/key-pool/allocator.ts:842-883`:<br>- Nếu `ok = true`: chuyển `status = 'ready'`, `pendingProbe = false`, `consecutiveErrors = 0`, `cooldownUntil = null`, `cooldownReason = 'NONE'`, `modelCooldowns = {}`, **`healthScore = 100`**, ghi `lastTestLatencyMs`, ghi log `MANUAL_TEST_PASSED`.<br>- Nếu `ok = false`: gọi `this.recordFailure(keyId, classified, now)` để phân loại lại lỗi, tính lại `cooldownUntil`, trừ điểm theo sàn và lan truyền cùng `project_number`. | Chưa có hàm tổng hợp kết quả theo lô (`BatchProbeSummary`: số key đã thử, số key hồi phục `ready`, số key bỏ qua do trùng Project vừa lỗi, số key còn lỗi gom theo từng `KeyErrorCategory`). |
| **API & Bảo mật quyền ghi** | `POST /api/key-pool/:id/test` (`server.ts:321-340`), kiểm tra quyền ghi qua `requireKeyPoolWriteAccess(req, res)` (`server.ts:63-82`), gửi PIN qua `authHeaders()` (`src/components/KeyPoolModal.tsx:186-192`). | Chưa có khả năng điều phối kiểm tra toàn bộ các key đang `status === 'cooldown'` kèm báo cáo tiến trình trực tiếp (`Đang thử k/N...`) và nút **Dừng giữa chừng** trên `KeyPoolModal.tsx`. |

---

#### B. Đối với Tính năng 2 — Nút "Xuất bản luận giải chi tiết"

| Thành phần | Đã có sẵn trong dự án (Tái sử dụng trực tiếp) | Còn thiếu (Cần thiết kế bổ sung) |
| :--- | :--- | :--- |
| **Dữ liệu lá số & 12 cung** | - `ZiweiChart` (`src/lib/ziwei/types.ts:115-135`) chứa mảng `palaces: Palace[]` đủ 12 cung (`命宫`, `兄弟`, `夫妻`, `子女`, `财帛`, `疾厄`, `迁移`, `交友`, `官禄`, `田宅`, `福德`, `父母`), `daXians: DaXian[]`, `lunarInfo`, `wuxingJuName`.<br>- `CN_TO_VI_PALACE` và `VI_PALACE_ROLES` (`src/lib/ziwei/vi-i18n.ts:46-109`) định nghĩa chuẩn tên Việt và vai trò của cả 12 cung.<br>- `formatChartSummaryVi(chart)` (`src/lib/ziwei/vi-i18n.ts:1355-1436`) và `detectPatterns(chart)` (`src/lib/ziwei/patterns.ts`). | Hiện tại tab chủ đề trong `InsightPanel.tsx:35-42` (`TOPICS`) và `server.ts:485-503` mới chỉ định nghĩa **6 chủ đề rút gọn** (`overall`, `career`, `wealth`, `love`, `health`, `character`), thiếu 6 cung còn lại (`Huynh Đệ`, `Tử Nữ`, `Thiên Di`, `Giao Hữu/Nô Bộc`, `Điền Trạch`, `Phụ Mẫu`) và chưa có hàm xuất **Bảng dữ kiện Tam Phương Tứ Chính xác định cho từng cung/nhóm cung** để neo chặt chống bịa như `yunxian-context.ts`. |
| **Cơ chế luận giải theo thời gian (Kỳ hạn / Lưu niên)** | - `buildYunxianPeriodContext(chart, input)` (`src/lib/ziwei/yunxian-context.ts:278-671`) đã sinh đầy đủ dữ kiện xác định cho **bất kỳ Năm Lưu Niên (`mode: 'liunian', year`)** hoặc **bất kỳ Đại Hạn 10 năm (`mode: 'dahan', daXianIndex`)** nào, bao gồm: cung kích hoạt, Đại Hạn gốc chi phối (`parentDaXian`), Tứ Hóa kỳ hạn (`periodSiHua`), 15 sao lưu (`dynamicStars`), Tam Phương Tứ Chính kỳ hạn (`sanFangSiZheng`), `factTableMarkdown` và `deterministicInterpretationMarkdown`.<br>- Endpoint `POST /api/interpret-period` (`server.ts:376-466`) và hàm `buildStrictPeriodAiPrompt` (`server.ts:145-195`). | - Mốc **"5 năm tới"** và **"10 năm tới"** chưa có hàm gom dữ kiện tổng hợp nhiều năm (`MultiYearPeriodContext`): nếu gọi lẻ `POST /api/interpret-period` cho từng năm Lưu Niên sẽ tốn thêm 5–10 cuộc gọi AI.<br>- Chưa có bộ điều phối sinh tuần tự từng phần, thanh tiến trình, hợp nhất cache sẵn có từ `InsightPanel`, xuất bản dở dang khi ngắt giữa chừng, và giao diện xem/in/tải file. |

---

#### C. Đối với Tính năng 3 — Nút Chat hỏi AI về một nội dung luận giải chưa rõ

| Thành phần | Đã có sẵn trong dự án (Tái sử dụng trực tiếp) | Còn thiếu (Cần thiết kế bổ sung) |
| :--- | :--- | :--- |
| **Hỏi đáp đơn lẻ hiện có** | Cuối `InsightPanel.tsx:486-578` và `914-959` đã có ô input `"Đặt câu hỏi cụ thể về lá số..."` (`handleAsk`) gọi `POST /api/interpret` với `{ chart, topic: 'overall', question }` và lưu vào mảng `qaList: { q: string; a: string }[]`. | 1. `handleAsk` hiện tại **không biết người dùng đang đọc phần luận giải nào** (không gửi nguyên văn đoạn luận giải cần giải thích và không gửi `periodContext.factTableMarkdown` khi đang xem kỳ hạn).<br>2. `POST /api/interpret` khi có `question` (`server.ts:505-515`) **không có lịch sử hội thoại nhiều lượt** (mỗi câu hỏi là độc lập) và **chưa áp dụng bộ quy tắc rào chống bịa nghiêm ngặt** dành riêng cho vai "Giải thích nội dung đã có".<br>3. Khi lỗi mạng/hết key, `handleAsk` đang tự động fallback về `generateLocalInterpretationVi` (văn bản mẫu tĩnh không ăn nhập với câu hỏi giải thích chi tiết) và không hiển thị huy hiệu `meta` (Model/Key đã dùng).<br>4. Chưa có nút bấm mở khung chat gắn trực tiếp vào từng mục/khối luận giải hoặc ngăn kéo chat ngữ cảnh (Contextual Chat Drawer). |

---

### 1.3. Ghi nhận các Vấn đề đã biết ngoài phạm vi (Known Issues Log)
*(Ghi nhận nguyên trạng theo yêu cầu để theo dõi kiến trúc; không mở rộng phạm vi thi công 3 tính năng mới, phần ảnh hưởng trực tiếp tới Tính năng 2 và 3 được phân tích tại Mục 4 — Rủi ro)*:

1. **Vấn đề đã biết (i) — Nhãn Tứ Hóa trong bài luận giải Hợp Bàn**:
   - **Triệu chứng**: Bài luận giải Hợp Bàn từng gán nhãn Tứ Hóa của nam gây mâu thuẫn giữa các khẩu quyết/lớp Tứ Hóa (ví dụ thông báo `"Thái Dương Hóa Lộc"` hoặc lặp cụm từ `"Vũ Khúc Bản mệnh Hóa Quyền"`).
   - **Khảo sát code thực tế**:
     - Trong `src/lib/ziwei/constants.ts:54`, bảng `SI_HUA_TABLE[6]` (Can Canh) của engine được định nghĩa là `['太阳', '武曲', '太阴', '天同']` (tức Can Canh: Thái Dương Hóa Lộc, Vũ Khúc Hóa Quyền, Thái Âm Hóa Khoa, Thiên Đồng Hóa Kỵ — khẩu quyết *Canh Dương Vũ Âm Đồng*).
     - Trong `src/lib/ziwei/vi-i18n.ts:1406` (`formatChartSummaryVi`), các sao có `s.siHua` được in là `Vũ Khúc[Miếu](Hóa Quyền)` (không ghi rõ tiền tố `Bản mệnh Can Năm Sinh` ở đầu dòng sao, trong khi `yunxian-context.ts:253` ghi `(Bản mệnh Hóa Quyền)`). Đồng thời, `POST /api/heming` (`server.ts:600-614`) chỉ truyền `summaryA` và `summaryB` từ `formatChartSummaryVi` mà không tách bảng liệt kê riêng 4 sao Tứ Hóa Bản Mệnh (Can Năm Sinh) và 4 sao Tứ Hóa Đại Hạn hiện tại của mỗi bên, khiến AI khi viết mục 4 ("Tương Tác Tứ Hóa") dễ trộn lẫn giữa Tứ Hóa năm sinh, Tứ Hóa Đại Hạn và khẩu quyết Bắc phái/Trung Châu phái khác nhau trong tập dữ liệu huấn luyện của LLM.
2. **Vấn đề đã biết (ii) — Màn Hợp Bàn không hiển thị huy hiệu Key/Model**:
   - **Khảo sát code thực tế**: `POST /api/heming` (`server.ts:631-633`) **đã phát** gói SSE `data: {"meta": ...}` giống hệt `/api/interpret-period`, nhưng phía client `src/components/HemingView.tsx:90-104` chỉ đọc `JSON.parse(data)?.delta?.text` và bỏ qua trường `meta` cũng như `interrupted`.
3. **Vấn đề đã biết (iii) — Form Hợp Bàn bị đặt lại về dữ kiện ví dụ khi xác nhận một bên**:
   - **Khảo sát code thực tế**: Trong `src/components/HemingView.tsx:180-231`, cả hai component `<BirthForm>` của Bên A và Bên B đều được truyền prop `initialState={{ name: '...', ... }}` dưới dạng **object literal tạo mới ngay trong hàm render**. Khi người dùng bấm `"Xác Nhận Lá Số A"` → `setChartA(c)` làm `HemingView` render lại → cả hai `<BirthForm>` nhận tham chiếu `initialState` mới → `useEffect` tại `src/components/BirthForm.tsx:62-66` (`useEffect(() => { if (initialState) setForm(initialState); }, [initialState])`) kích hoạt và ghi đè state `form` của Bên B (đang nhập dở chưa bấm xác nhận) quay về dữ liệu mẫu `"Trần Ngọc Lan"`.

---

## 2. Thiết Kế Chi Tiết Từng Tính Năng

---

### 2.1. TÍNH NĂNG 1 — Nút "Test lại toàn bộ key đang cooldown" trong Dashboard Kho Khóa

#### 2.1.1. Mục tiêu & Tái sử dụng
Cho phép quản trị viên bấm một nút duy nhất trong `KeyPoolModal` để thăm dò (probe) lại toàn bộ các khóa đang ở trạng thái `status === 'cooldown'` (bất kể nguyên nhân `QUOTA_PROJECT_ZERO`, `RATE_LIMIT_RPM`, `QUOTA_DAILY_EXHAUSTED`, hay `NETWORK_OR_5XX`) mà không phải bấm thủ công từng dòng hoặc chờ hết 6 giờ nguội.

#### 2.1.2. Cơ chế điều phối: Client-Orchestrated Sequential Probe hay Server Batch Endpoint?
Để vừa hiển thị tiến trình thời gian thực (`Đang kiểm tra 3/20 khóa...`), vừa cập nhật ngay từng dòng trên bảng khi mỗi khóa kiểm tra xong, vừa cho phép **Hủy/Dừng giữa chừng** bất kỳ lúc nào mà không giữ kết nối HTTP treo dài:
- **Thiết kế kết hợp tối ưu**:
  1. **Nâng cấp nhẹ `KeyPoolManager.testKey(keyId, options?)` (`server/key-pool/index.ts`)**:
     - Thêm tùy chọn `bypassDebounce?: boolean` (chỉ bật khi gửi cờ `{ batchProbe: true }` từ client đã xác thực PIN) hoặc giảm debounce cho batch probe, đồng thời trả về thêm `detectedProjectNumber` mới nhất sau khi test.
     - Giữ nguyên logic cốt lõi đã kiểm chứng: gọi `client.models.generateContent` với `defaultModel`, prompt `'Trả lời đúng 1 từ: OK'`, `maxOutputTokens: 8`, timeout `8.000ms`, sau đó gọi `allocator.recordManualTestResult()`.
  2. **Điều phối tuần tự có giãn cách (Sequential Staggered Probe) kèm "Nhảy cóc cùng Project" (`Project Short-Circuit`)**:
     - **Thứ tự ưu tiên probe**: Sắp xếp danh sách các key đang `cooldown` theo thứ tự khả năng hồi phục cao nhất trước:
       1. `NETWORK_OR_5XX` / `UNKNOWN` (lỗi mạng tạm thời)
       2. `RATE_LIMIT_RPM` (chạm trần theo phút)
       3. `QUOTA_DAILY_EXHAUSTED` (hết quota ngày)
       4. `QUOTA_PROJECT_ZERO` (hạn mức project = 0)
       *(Trong cùng nhóm lỗi, ưu tiên key có `remainingCooldownSec` thấp hơn hoặc `healthScore` cao hơn).*
     - **Nhịp độ (Pacing) cụ thể**:
       - Thực thi **tuần tự từng key một (`concurrency = 1`)**, giãn cách **`1.200ms` (1,2 giây)** giữa khi kết thúc 1 key và bắt đầu key tiếp theo.
       - **Lý do chọn `concurrency = 1` + delay `1.200ms`**: Tránh dội đồng loạt nhiều request từ cùng một IP container Cloud Run lên `generativelanguage.googleapis.com`, và quan trọng nhất là kịp nhận diện `detectedProjectNumber` của key trước để quyết định có cần gọi key sau hay không.
     - **Tối ưu "Nhảy cóc cùng Google Cloud Project" (`Same-Project Short-Circuit`)**:
       - Nếu trong lượt quét hiện tại, Key $A_1$ vừa được probe và trả về lỗi cấp Project (`QUOTA_PROJECT_ZERO`, `QUOTA_DAILY_EXHAUSTED`, hoặc `RATE_LIMIT_RPM`) với `detectedProjectNumber = P`:
       - Bản thân `allocator.recordFailure()` (`allocator.ts:778-809`) đã cập nhật lại `cooldownUntil` cho các key cùng Project $P$ đang `ready`. Với các key $A_2, A_3$ đang ở sẵn trạng thái `cooldown` và có cùng `detectedProjectNumber === P`, bộ điều phối **bỏ qua không gọi API mạng thêm lần nữa** (đếm vào mục `Bỏ qua do trùng Project vừa báo lỗi`), đồng thời cập nhật đồng bộ `cooldownUntil` của $A_2, A_3$ theo $A_1$. Cơ chế này vừa tránh đốt request vô ích vào một GCP Project vừa xác nhận đang hết quota, vừa rút ngắn thời gian quét.

#### 2.1.3. Quy tắc chuyển trạng thái & Điểm sức khỏe sau khi Probe
Tái sử dụng nhất quán `KeyAllocator.recordManualTestResult()` (`server/key-pool/allocator.ts:842-883`) và mở rộng lan truyền `cooldown` cho các khóa cùng Project:
- **Trường hợp Probe THÀNH CÔNG (`ok === true`)**:
  - `status`: chuyển từ `'cooldown'` → **`'ready'`**.
  - `pendingProbe`: đặt về **`false`** (vì vừa được kiểm chứng thực tế bằng lời gọi thật).
  - `healthScore`: khôi phục về **`100` điểm** (khớp hành vi nút `"Kiểm tra thử"` đơn lẻ hiện tại tại `allocator.ts:865`).
  - `consecutiveErrors`: đặt về `0`; `cooldownUntil = null`; `cooldownReason = 'NONE'`; `modelCooldowns = {}`.
  - `stats.lastTestLatencyMs = latencyMs`; `stats.lastTestedAt = now`; ghi log `MANUAL_TEST_PASSED`.
- **Trường hợp Probe THẤT BẠI (`ok === false`)**:
  - Phân loại lỗi qua `classifyGeminiError(err)`.
  - Nếu là `AUTH_INVALID_KEY` (`401/403`): chuyển sang **`disabled`** vĩnh viễn (`healthScore = 0`, `cooldownUntil = null`).
  - Nếu vẫn là lỗi Quota / Mạng (`QUOTA_PROJECT_ZERO`, `RATE_LIMIT_RPM`, `QUOTA_DAILY_EXHAUSTED`, `NETWORK_OR_5XX`): giữ trạng thái **`cooldown`**, cập nhật `cooldownReason` theo đúng loại lỗi thực tế mới nhất, tính lại `cooldownUntil = now + computeCooldownDurationMs(...)`, cập nhật `detectedProjectNumber` và trừ điểm theo sàn quy định (`allocator.ts:739-765`).
  - **Cập nhật nhỏ trong `allocator.ts:787`**: Khi lan truyền lỗi cấp Project (`QUOTA_PROJECT_ZERO` / `QUOTA_DAILY_EXHAUSTED` / `RATE_LIMIT_RPM`), cập nhật lại `cooldownUntil` và `cooldownReason` cho cả các peer cùng `detectedProjectNumber` đang ở trạng thái `cooldown` (hiện tại dòng 787 có `if (peer.status !== 'ready') continue;`).

#### 2.1.4. Giao diện & Luồng tương tác trên `src/components/KeyPoolModal.tsx`
1. **Vị trí nút bấm**:
   - Đặt tại thanh tiêu đề của **Section 3: Bảng Theo Dõi Sức Khỏe Từng Khóa** (`KeyPoolModal.tsx:823-833`) và/hoặc ngay trên ô thống kê **"Đang nguội (Cool down)"** (`KeyPoolModal.tsx:603-608`).
   - Nhãn nút: **`Test lại toàn bộ key đang nguội (N)`** (với `N = snapshot.summary.cooldown`).
   - Nút bị `disabled` khi: `isReadOnly === true` (chưa mở khóa PIN trên Shared URL), hoặc `snapshot.summary.cooldown === 0`, hoặc đang chạy một lượt kiểm tra khác.
2. **Thanh tiến trình & Nút Hủy giữa chừng**:
   - Khi đang chạy batch probe, hiển thị khung trạng thái ngay đầu Bảng Theo Dõi:
     - Thanh progress bar màu vàng/ngọc: `Đang thăm dò khóa k/N: AIzaSy••••••xxxx (Khóa #12)...`
     - Bộ đếm trực tiếp: `Hồi phục: X · Còn lỗi: Y · Bỏ qua trùng Project: Z`
     - Nút **`Dừng kiểm tra`** (màu đỏ/hổ phách): khi bấm sẽ đặt `batchAbortRef.current = true` và hủy `AbortController` của request hiện tại → dừng ngay lập tức, giữ nguyên kết quả của các khóa đã test xong trước đó.
3. **Bảng tổng kết sau khi hoàn tất (hoặc sau khi bấm Dừng)**:
   - Hiển thị thông báo tổng kết rõ ràng tại khu vực `notice`:
     `Hoàn tất kiểm tra K/N khóa đang nguội: X khóa đã hồi phục Sẵn sàng (100đ) · Y khóa vẫn đang nguội [trong đó: a Project=0, b RPM, c RPD, d Mạng/5xx] · W khóa vô hiệu (401/403) · Z khóa bỏ qua do trùng Project vừa lỗi.`

#### 2.1.5. Các trường hợp biên (Edge Cases) của Tính năng 1
- **Đóng Modal giữa chừng**: Khi người dùng đóng `KeyPoolModal` (`onClose`), tự động kích hoạt `abort` cho tiến trình batch probe để không chạy ngầm ngoài ý muốn.
- **Quyền hạn (PIN Guard)**: Mỗi request `POST /api/key-pool/:id/test` đều đi qua `requireKeyPoolWriteAccess(req, res)`. Trên `Shared App URL` khi chưa mở khóa `KEY_POOL_ADMIN_PIN`, nút bị khóa và API trả `403 ADMIN_READ_ONLY`.
- **Tất cả 20 key nguội thuộc 20 GCP Project khác nhau**: Bộ điều phối sẽ lần lượt probe cả 20 key với nhịp `1,2s`/key.
- **Nhiều key trong 20 key nguội dùng chung 1 GCP Project**: Key đầu tiên của Project đó được probe; nếu vẫn trả `429 QUOTA_PROJECT_ZERO`, các key còn lại cùng `detectedProjectNumber` được đồng bộ luôn mà không tốn thêm lượt gọi mạng.

---

### 2.2. TÍNH NĂNG 2 — Nút "Xuất bản luận giải chi tiết" (Comprehensive Dossier Generator & Exporter)

#### 2.2.1. Khảo sát & Đối chiếu cấu trúc Bản Luận Giải Chi Tiết với dữ liệu hiện có của App
Yêu cầu của người dùng gồm 3 phần lớn:
- **(a) Luận giải chung / Tổng quan lá số**;
- **(b) Luận giải chi tiết TỪNG MẢNG cuộc sống (theo 12 cung của lá số)**;
- **(c) Luận giải theo thời gian: NĂM HIỆN TẠI (`2026`), NĂM SAU (`2027`), 5 NĂM TỚI (`2026–2030`), 10 NĂM TỚI (`2026–2035`)**.

Đối chiếu với dữ liệu 12 cung trong `src/lib/ziwei/vi-i18n.ts:46-109` (`CN_TO_VI_PALACE`, `VI_PALACE_ROLES`) và 6 tab trong `InsightPanel.tsx:35-42`, danh sách **12 mảng cuộc sống theo 12 cung** chuẩn hóa như sau:

| STT | Mã cung (`Palace.name`) | Tên cung chuẩn Việt | Mảng cuộc sống tương ứng | Trạng thái trong `InsightPanel` hiện tại |
| :-: | :--- | :--- | :--- | :--- |
| 1 | `命宫` (+ `身宫`) | **Mệnh Cung (& Thân Cung)** | Bản mệnh, tính cách cốt lõi, khí chất & tiên thiên cách cục | Đã có trong `overall` / `character` |
| 2 | `官禄` | **Cung Quan Lộc** | Sự nghiệp, công danh, chức vị & định hướng nghề nghiệp | Đã có tab `career` |
| 3 | `财帛` | **Cung Tài Bạch** | Tài lộc, nguồn thu nhập & phương thức quản trị dòng tiền | Đã có tab `wealth` |
| 4 | `夫妻` | **Cung Phu Thê** | Tình duyên, hôn nhân & hình mẫu người phối ngẫu | Đã có tab `love` |
| 5 | `福德` | **Cung Phúc Đức** | Đời sống tinh thần, phúc phận, tâm tính & hậu vận | Đã có trong `character` |
| 6 | `疾厄` | **Cung Tật Ách** | Sức khỏe, thể chất, tạng phủ theo Đông Y & dưỡng sinh | Đã có tab `health` |
| 7 | `田宅` | **Cung Điền Trạch** | Điền sản, nhà cửa, gia đạo & tích lũy tài khố | Mới được nhắc phụ trong `wealth` |
| 8 | `迁移` | **Cung Thiên Di** | Xuất hành, cơ hội phương xa, quý nhân xã hội & vị thế bên ngoài | Chưa có tab riêng (chỉ khi bấm vào ô cung) |
| 9 | `子女` | **Cung Tử Nữ** | Con cái, hậu bối, học trò, cấp dưới & năng lực sáng tạo | Chưa có tab riêng (chỉ khi bấm vào ô cung) |
| 10 | `交友` / `仆役` | **Cung Giao Hữu (Nô Bộc)** | Bạn bè, đồng nghiệp, đối tác & nhân duyên quần chúng | Chưa có tab riêng (chỉ khi bấm vào ô cung) |
| 11 | `兄弟` | **Cung Huynh Đệ** | Anh chị em, bằng hữu thân thiết & nguồn lực liên minh | Chưa có tab riêng (chỉ khi bấm vào ô cung) |
| 12 | `父母` | **Cung Phụ Mẫu** | Cha mẹ, trưởng bối, học vấn, văn thư & pháp lý | Chưa có tab riêng (chỉ khi bấm vào ô cung) |

#### 2.2.2. Bài toán thiết kế cốt lõi: Chia phần (Section Chunking) cho Phần (b) và Phần (c) để không bùng nổ số lần gọi AI nhưng vẫn giữ trọn độ sâu 12 cung + 4 mốc thời gian

Nếu gọi 1 request AI riêng cho mỗi phần đơn lẻ:
- `1` (Tổng quan) + `12` (12 cung rời) + `1` (Năm 2026) + `1` (Năm 2027) + `5` (từng năm trong 5 năm tới) + `10` (từng năm trong 10 năm tới) = **25 đến 30 lần gọi AI** cho một lần bấm nút Xuất bản! Với kho chỉ có **3 key free tier khỏe**, 30 lần gọi liên tiếp chắc chắn sẽ chạm trần RPM (`429 RATE_LIMIT_RPM`) và mất từ **6 đến 10 phút** mới sinh xong.

Ngược lại, nếu gộp toàn bộ cả lá số vào **1 lần gọi AI duy nhất**:
- Model sẽ viết lướt (mỗi cung chỉ được 2–3 câu sơ sài), dễ bị cắt cụt do giới hạn output token hoặc đứt luồng `503 UNAVAILABLE` giữa chừng.

Do đó, kế hoạch đề xuất **Kiến trúc Phân Chương Hợp Lý (Modular Chapter Architecture)** gồm **8 Chương chuẩn (8 lần gọi AI tối đa khi chưa có cache)** — hoặc tùy chọn **Chế độ Đầy đủ Từng Cung (17 Chương)** để người dùng quyết định tại **QĐ-2**:

##### Thiết kế khuyến nghị (Phương án A tại QĐ-2 — 8 Chương Chuẩn, vẫn bao phủ 100% 12 cung và 4 mốc thời gian):

1. **Chương 1 — Tổng Quan Mệnh Cục & Cách Cục Tiên Thiên (`chapter_overview`)**:
   - **Nội dung**: Bát tự/Âm lịch, Ngũ Hành Cục, Mệnh Cung, Thân Cung, Mệnh Chủ – Thân Chủ, Tam Phương Tứ Chính gốc (Mệnh – Tài – Quan – Di), Tứ Hóa Bản Mệnh (Can Năm Sinh) và các Cách Cục cổ phú nhận diện được từ `detectPatterns(chart)`.
   - **Số lần gọi AI**: `1` lần (tái dùng cache của tab `overall` nếu người dùng đã luận giải AI trước đó).

2. **Chương 2 đến Chương 4 — Luận Giải Chi Tiết 12 Cung Cuộc Sống (Chia thành 3 Nhóm Cung Tam Hợp / Liên Đới — mỗi chương phân tích sâu đúng 4 cung với đề mục riêng cho từng cung)**:
   - **Chương 2 — Nhóm Cung Bản Mệnh · Sự Nghiệp · Tài Lộc · Xuất Hành (`palaces_core`: Mệnh Cung, Quan Lộc, Tài Bạch, Thiên Di)**:
     - Đây chính là trục **Tam Phương Tứ Chính của Mệnh Cung** (4 mảng trọng yếu nhất: Bản mệnh/Tính cách, Sự nghiệp, Tài chính, Xã giao/Xuất hành). AI bắt buộc trình bày đủ 4 mục con cho 4 cung này.
   - **Chương 3 — Nhóm Cung Gia Đạo · Tình Duyên · Con Cái · Điền Sản (`palaces_family`: Phu Thê, Tử Nữ, Điền Trạch, Phúc Đức)**:
     - Bao trọn 4 mảng nội gia & hậu vận: Hôn nhân/Phối ngẫu (Phu Thê), Con cái/Hậu duệ (Tử Nữ), Nhà cửa/Bất động sản/Gia đạo (Điền Trạch), Tinh thần/Phúc thọ (Phúc Đức).
   - **Chương 4 — Nhóm Cung Nhân Mạch · Trưởng Bối · Huynh Đệ · Sức Khỏe (`palaces_social_health`: Phụ Mẫu, Huynh Đệ, Giao Hữu/Nô Bộc, Tật Ách)**:
     - Bao trọn 4 mảng còn lại: Cha mẹ/Pháp lý/Học vấn (Phụ Mẫu), Anh chị em/Liên minh (Huynh Đệ), Bạn bè/Đồng nghiệp/Cấp dưới (Giao Hữu), Sức khỏe/Tạng phủ Đông Y (Tật Ách).
   - **Bảng dữ kiện xác định cho mỗi cung (`buildPalaceFactSheetVi`)**:
     - Tạo hàm mới trong `src/lib/ziwei/dossier-context.ts` sinh bảng dữ kiện xác định cho từng cung trong nhóm: Tên cung, Can Chi cung, Chính tinh + độ sáng + Tứ Hóa bản mệnh, Cát tinh, Sát tinh, Cung xung chiếu + 2 cung Tam hợp, Tự Hóa của can cung (`detectSelfSihua` từ `sihua.ts`), và vai trò cung theo `VI_PALACE_ROLES`. Nhờ đó AI phân tích sâu từng cung trong toàn bộ 12 cung mà tuyệt đối không bịa sao hay nhầm cung.

3. **Chương 5 đến Chương 8 — Luận Giải Theo Thời Gian (4 mốc thời gian yêu cầu)**:
   - **Chương 5 — Năm Hiện Tại (`year_current`, năm `currentYear = 2026`)**:
     - **Cơ chế**: Tái sử dụng **100%** `buildYunxianPeriodContext(chart, { mode: 'liunian', year: 2026 })` và endpoint `POST /api/interpret-period`.
     - **Tái sử dụng Cache**: Nếu trong `InsightPanel` người dùng đã bấm luận giải Lưu Niên 2026 (`aiPeriodCache[cacheKey]` hợp lệ), lấy thẳng từ cache — **0 lần gọi AI thêm**.
   - **Chương 6 — Năm Sau (`year_next`, năm `currentYear + 1 = 2027`)**:
     - **Cơ chế**: Tái sử dụng **100%** `buildYunxianPeriodContext(chart, { mode: 'liunian', year: 2027 })` và endpoint `POST /api/interpret-period`.
     - **Tái sử dụng Cache**: Nếu người dùng đã xem Lưu Niên 2027 trong `InsightPanel`, lấy thẳng từ cache — **0 lần gọi AI thêm**.
   - **Chương 7 — Giai Đoạn 5 Năm Tới (`horizon_5y`, `2026–2030`) — Cơ chế gom dữ kiện Lưu Niên chống bùng nổ API**:
     - **Cách sinh dữ kiện xác định**: Không gọi 5 request AI rời! Thay vào đó, hàm deterministic `buildMultiYearHorizonContext(chart, 2026, 2030)` chạy vòng lặp `year = 2026..2030` ở tầng thuật toán (mất `< 2ms` CPU, `0` API call) bằng `buildYunxianPeriodContext(chart, { mode: 'liunian', year })` để lập **Bảng Tổng Hợp Dữ Kiện 5 Năm Liên Tiếp (`2026–2030`)**:
       - Đại Hạn 10 năm đang bao trùm giai đoạn này (và điểm chuyển giao Đại Hạn nếu có năm đổi Đại Hạn trong khoảng 2026–2030).
       - Bảng ma trận từng năm `2026, 2027, 2028, 2029, 2030`: mỗi năm ghi rõ Can Chi, tuổi âm lịch, cung bản mệnh được Lưu Niên kích hoạt, chính tinh tại cung đó, 4 sao Lưu Niên Tứ Hóa (`Lộc · Quyền · Khoa · Kỵ` đóng tại cung nào, xung cung nào), và Lưu Lộc Tồn / Lưu Thiên Mã / Lưu Kình Đà.
     - **Cách gọi AI**: Chỉ gọi **1 request AI duy nhất** với bảng ma trận 5 năm xác định này; yêu cầu AI phân tích: (1) Xu thế chủ đạo 5 năm 2026–2030; (2) Điểm nhấn & biến chuyển từng năm từ 2026 đến 2030; (3) Năm thuận lợi nhất để bứt phá (ứng kỳ Cát hóa) và năm cần phòng thủ (ứng kỳ Hóa Kỵ xung chiếu); (4) Chiến lược chuẩn bị trung hạn.
   - **Chương 8 — Tầm Nhìn 10 Năm Tới (`horizon_10y`, `2026–2035`) — Kết hợp Đại Hạn 10 năm & Dòng chảy Lưu Niên**:
     - **Cách sinh dữ kiện xác định**: Hàm `buildMultiYearHorizonContext(chart, 2026, 2035)` tự động trích xuất:
       - Dữ kiện đầy đủ của **Đại Hạn hiện tại** (và **Đại Hạn kế tiếp** nếu trong 10 năm `2026–2035` đương số bước sang Đại Hạn mới — rất phổ biến!).
       - Bảng ma trận tóm tắt 10 năm Lưu Niên (`2026` → `2035`): Can Chi từng năm, cung kích hoạt, sao Hóa Lộc & Hóa Kỵ từng năm, các năm bản mệnh trùng phùng Đại Hạn.
     - **Cách gọi AI**: Chỉ gọi **1 request AI duy nhất** (hoặc tái dùng thông tin Đại Hạn + bảng 10 năm) để luận giải: (1) Bức tranh tổng thể thập kỷ 2026–2035 & sự chuyển giao Đại Hạn; (2) Chu kỳ vận động theo 2 nửa chặng (5 năm đầu vs 5 năm sau); (3) Các mốc năm bản lề (năm đại cát / năm xung hạn cần đặc biệt lưu tâm); (4) Định hướng chiến lược 10 năm cho Sự nghiệp, Tài sản, Gia đạo và Dưỡng sinh.

#### 2.2.3. Chiến lược Cache theo từng chương, Tiến trình sinh tuần tự & Xuất dở dang khi ngắt giữa chừng
1. **Cache đa tầng theo lá số (`chartIdentityKey`)**:
   - Khóa định danh lá số: `chartIdentityKey = "${year}_${month}_${day}_${hour}_${gender}"` (đồng nhất với `yunxian-context.ts:284`).
   - Mỗi chương trong 8 chương có `sectionKey` riêng (`chapter_overview`, `palaces_core`, `palaces_family`, `palaces_social_health`, `year_2026`, `year_2027`, `horizon_5y_2026_2030`, `horizon_10y_2026_2035`).
   - **Liên thông 2 chiều với `aiPeriodCache` của `InsightPanel`**:
     - Nếu người dùng đã bấm `"Luận giải AI cho kỳ này"` cho Lưu Niên 2026 hoặc 2027 ở ngoài `InsightPanel`, trình Xuất bản nhận diện ngay chương `year_2026` / `year_2027` đã có trạng thái **`Hoàn tất (Từ bộ nhớ đệm)`** và không gọi lại AI.
     - Ngược lại, khi trình Xuất bản sinh xong `year_2026` và `year_2027`, kết quả cũng được ghi ngược vào `aiPeriodCache` để khi đóng modal quay lại `InsightPanel` xem Lưu Niên 2026/2027 là có sẵn ngay.
   - Lưu thêm bản nháp/hoàn chỉnh của hồ sơ luận giải vào `sessionStorage` theo `chartIdentityKey` để nếu người dùng đóng modal rồi mở lại trong cùng phiên làm việc thì không mất bất kỳ chương nào đã sinh.
2. **Sinh tuần tự có thanh tiến trình & Chống chạm trần RPM**:
   - Khi người dùng bấm **"Bắt đầu lập Bản Luận Giải Chi Tiết"**, hệ thống chỉ duyệt qua các chương **chưa có cache hợp lệ**.
   - Chạy tuần tự từng chương một (`concurrency = 1`), streaming trực tiếp văn bản của chương đang viết lên màn hình kèm huy hiệu `Model / Key` của từng chương.
   - Giữa 2 chương liên tiếp có khoảng nghỉ ngắn **`1.500ms`** để giảm áp lực burst RPM lên 3 key free tier.
3. **Xử lý khi bị ngắt giữa chừng / Lỗi 1 chương / Người dùng bấm Tạm dừng**:
   - Nếu Chương $k$ bị ngắt giữa chừng (`interrupted: true` hoặc lỗi `503 AI_POOL_EXHAUSTED`):
     - Các Chương $1 \dots k-1$ đã hoàn thành trước đó được **giữ nguyên an toàn trong cache**.
     - Chương $k$ được gắn trạng thái `Chưa hoàn tất (Bị ngắt giữa chừng)` kèm phần văn bản nhận dở (nếu có) và phần **Bảng dữ kiện & Luận giải nền xác định (Deterministic)** của chương đó luôn hiển thị đầy đủ.
   - Người dùng có ngay 3 lựa chọn:
     1. **Nút `"Tiếp tục sinh các phần còn thiếu"`**: chỉ chạy lại từ Chương $k$ trở đi, bỏ qua toàn bộ các chương $1 \dots k-1$ đã xong.
     2. **Nút `"Thử lại riêng chương này"`**: gắn ở đầu mỗi chương.
     3. **Nút `"Xuất ngay bản hiện có (Đánh dấu bản chưa hoàn chỉnh)"`**: cho phép in/tải/sao chép ngay cả khi mới xong một số chương; các chương chưa có AI sẽ được ghi rõ nhãn `[Chương này mới gồm Bảng dữ kiện xác định — Chưa hoàn tất diễn giải AI]` ở đầu chương và ở trang bìa hồ sơ.

#### 2.2.4. So sánh các lựa chọn Định dạng "Xuất bản" (Đưa vào QĐ-1 để người dùng chốt)

| Tiêu chí so sánh | Phương án 1: Chế độ Trang In / Lưu PDF từ trình duyệt (`Print-Friendly View / Save as PDF`) | Phương án 2: Tải file `.md` (Markdown) hoặc `.html` độc lập (Standalone HTML) | Phương án 3: Sao chép toàn bộ văn bản (`Copy Markdown / Text`) |
| :--- | :--- | :--- | :--- |
| **Chất lượng trình bày** | **Rất cao**: Có trang bìa thông tin đương số, bảng tóm tắt 12 cung, định dạng typography sắc nét, ngắt trang (`break-inside: avoid`) chuẩn hồ sơ mệnh lý để lưu ra file PDF hoặc in giấy. | **Tốt**: File `.html` độc lập mở được ngay trên mọi thiết bị không cần mạng; file `.md` tiện lưu vào Notion/Obsidian. | **Cơ bản**: Tiện dán nhanh qua Zalo, Messenger, Email hoặc Google Docs. |
| **Ràng buộc kỹ thuật trong iFrame AI Studio** | Trong môi trường preview iFrame, `window.print()` đôi khi bị trình duyệt chặn hoặc in cả khung ngoài nếu không mở chế độ xem toàn màn hình; trong khi tải file Blob (`<a download>`) hoạt động ổn định 100% trong iFrame. | Hoạt động **100% ổn định** trong mọi iFrame (tạo `Blob` + `URL.createObjectURL` + thẻ `<a download>`), không phụ thuộc popup hay hộp thoại in của trình duyệt. | Hoạt động 100% ổn định qua `navigator.clipboard.writeText`. |
| **Khuyến nghị của Argon** | **Kết hợp cả 3 trong cùng Modal Xuất Bản, lấy "Tải file HTML chuẩn in PDF + Tải Markdown + Sao chép" làm trụ cột chính, kèm nút "In / Lưu PDF trực tiếp"**: file `.html` xuất ra được nhúng sẵn CSS `@media print` cổ phong trang nhã (nền giấy sáng, chữ đậm rõ) để người dùng vừa mở xem offline trên điện thoại/máy tính, vừa bấm `Ctrl+P -> Save as PDF` chuẩn 100% không sợ lỗi iFrame. |

#### 2.2.5. Endpoint & File dự kiến cho Tính năng 2
- **File mới phía dữ liệu xác định**: `src/lib/ziwei/dossier-context.ts`
  - Hàm `buildPalaceGroupFactSheetVi(chart, palaceNames)`: xuất bảng dữ kiện xác định (Chính tinh, độ sáng, Tứ Hóa bản mệnh, Tự hóa can cung, Cát/Sát tinh, Tam Phương Tứ Chính, Cách cục liên quan) cho từng nhóm cung trong 12 cung.
  - Hàm `buildMultiYearHorizonContext(chart, startYear, endYear)`: tổng hợp dữ kiện xác định của giai đoạn 5 năm (`2026–2030`) và 10 năm (`2026–2035`) từ `buildYunxianPeriodContext`.
- **Endpoint phía Server (`server.ts`)**:
  - Tái sử dụng `POST /api/interpret-period` cho Chương 5 (Năm 2026) và Chương 6 (Năm 2027).
  - Bổ sung `POST /api/interpret-dossier-section` (SSE streaming, đi qua `keyPoolManager.executeStream` giống hệt `/api/interpret-period`) nhận `{ chart, sectionId, factSheetMarkdown }` với `buildStrictDossierSectionPrompt()` áp dụng **cùng quy tắc rào chống bịa 100%** như `buildStrictPeriodAiPrompt` (chỉ diễn giải dựa trên `factSheetMarkdown` và `chartSummary`, không bịa sao/Tứ Hóa).
- **File giao diện mới**: `src/components/DetailedDossierModal.tsx`
  - Mở từ nút **"Xuất Bản Luận Giải Chi Tiết"** đặt nổi bật trên thanh Quick Summary Bar (`src/App.tsx:305`) và đầu `InsightPanel.tsx`.

---

### 2.3. TÍNH NĂNG 3 — Nút Chat hỏi AI về một nội dung luận giải chưa rõ (Contextual Grounded Explanation Chat)

#### 2.3.1. Điểm đặt nút mở Chat & Trải nghiệm người dùng
Khi người dùng đang đọc bất kỳ nội dung luận giải nào trên ứng dụng, họ có thể bấm nút **"Hỏi rõ thêm về phần này"** để mở khung **Vấn Đáp & Giải Thích Ngữ Cảnh**:
1. **Điểm đặt nút mở Chat trong `InsightPanel.tsx`**:
   - **Vị trí 1 (Tại khối Luận giải Vận hạn — Khung xác định & AI diễn giải kỳ hạn)**: Đặt nút `"Hỏi thêm về kỳ hạn này"` ngay cạnh nút `"Luận giải AI cho kỳ này"` (`InsightPanel.tsx:703-735`).
   - **Vị trí 2 (Tại khối Luận giải Chủ đề / Cung / Tứ Hóa đang chọn)**: Đặt nút `"Hỏi rõ thêm nội dung này"` ở thanh tiêu đề của khung hiển thị nội dung chính (`InsightPanel.tsx:891-911`).
   - **Vị trí 3 (Bôi đen / Chọn nhanh đoạn văn hoặc Gợi ý câu hỏi nhanh)**: Khi mở khung chat của một phần luận giải, hệ thống tự động trích xuất các câu hỏi gợi ý sát với đúng phần đang đọc (ví dụ: *"Vì sao Hóa Kỵ tại cung này lại xung chiếu cung đối?"*, *"Thuật ngữ Song Lộc trùng phùng trong đoạn trên nghĩa là gì?"*, *"Tôi cần lưu ý gì thực tế từ lời khuyên mục 4?"*).
   - *(Tùy chọn mở rộng sang màn Hợp Bàn và Modal Xuất bản chi tiết nếu người dùng chọn tại QĐ-5).*

#### 2.3.2. Ngữ cảnh (Context Payload) gửi cho AI
Mỗi lượt hỏi trong khung chat gửi lên endpoint mới `POST /api/interpret-chat` gói dữ liệu có cấu trúc chặt chẽ gồm **4 lớp**:
1. **Lớp 1 — Tóm tắt lá số gốc (`chartSummary`)**: Sinh từ `formatChartSummaryVi(chart)` (thông tin đương số, Cục, Mệnh/Thân, 12 cung).
2. **Lớp 2 — Bảng dữ kiện xác định của phần đang xem (`deterministicFacts`)**:
   - Nếu đang xem Kỳ hạn (Đại Hạn / Lưu Niên): truyền `periodContext.factTableMarkdown`.
   - Nếu đang xem Cung / Chủ đề Bản mệnh: truyền bảng dữ kiện Tam Phương Tứ Chính xác định của cung/chủ đề đó.
3. **Lớp 3 — Nguyên văn bài luận giải người dùng đang đọc (`activeInterpretationText` + `sectionTitle`)**:
   - Truyền nguyên văn bài luận giải đang hiển thị trên màn hình (giới hạn an toàn tối đa `6.000 ký tự`) cùng đoạn trích người dùng vừa chọn (nếu có: `highlightedExcerpt`, tối đa `800 ký tự`).
4. **Lớp 4 — Lịch sử hội thoại trong phiên của phần luận giải đó (`history`)**:
   - Mảng các lượt `{ role: 'user' | 'assistant', content: string }` trước đó trong cùng mạch nội dung.

#### 2.3.3. Ràng buộc chống bịa cho vai "Giải thích chuyên sâu" (`buildStrictExplanationChatPrompt`)
Kế thừa trực tiếp tinh thần của `buildStrictPeriodAiPrompt` (`server.ts:154-167`), prompt hệ thống (`systemInstruction`) cho `/api/interpret-chat` được khóa chặt bằng 6 quy tắc:
1. **Định vai**: Chuyên gia giải nghĩa Tử Vi Đẩu Số theo hệ thống Thiên Kỷ (Nghê Hải Hạ) và Tử Vi Đẩu Số Toàn Thư, có nhiệm vụ **giải thích rõ nghĩa, làm sáng tỏ cơ sở lập luận và hướng dẫn ứng dụng thực tế** cho đoạn luận giải mà người dùng đang thắc mắc.
2. **Rào chống bịa dữ kiện tuyệt đối**:
   - CHỈ ĐƯỢC phép dựa trên `[1. TÓM TẮT LÁ SỐ BẢN MỆNH]`, `[2. BẢNG DỮ KIỆN XÁC ĐỊNH]` và `[3. NGUYÊN VĂN ĐOẠN LUẬN GIẢI ĐANG XEM]`.
   - TUYỆT ĐỐI CẤM tự bịa thêm sao, cấm tự đổi cung vị của sao, cấm tự gán thêm Tứ Hóa hoặc Sao Lưu không nằm trong Bảng dữ kiện.
3. **Giải thích thuật ngữ & nguyên lý rõ ràng**:
   - Khi người dùng hỏi *"Vì sao bài luận giải lại nhận định như vậy?"* hoặc *"Thuật ngữ X nghĩa là gì?"*, phải chỉ rõ nhận định đó bắt nguồn từ tổ hợp sao nào, cung nào, Tứ Hóa hay trục Tam Phương Tứ Chính nào trong `[BẢNG DỮ KIỆN XÁC ĐỊNH]`, rồi giải nghĩa bằng ngôn từ đời thường dễ hiểu.
4. **Xử lý khi câu hỏi vượt ngoài dữ kiện**:
   - Nếu người dùng hỏi một chi tiết không có cơ sở trong lá số/bảng dữ kiện (ví dụ hỏi giờ ngày cụ thể phát tài hoặc hỏi về một sao không có trong cung), AI phải trả lời trung thực: *"Trong bảng dữ kiện xác định của kỳ hạn/cung này không có sao/yếu tố X, hệ thống chỉ ghi nhận các sao [...]"* — tuyệt đối không chiều theo câu hỏi để bịa thêm.
5. **Độ dài & Trình bày**:
   - Trả lời trực diện, mạch lạc, dùng Markdown ngắn gọn (`150–350 từ` mỗi câu trả lời), tập trung giải quyết đúng điểm chưa rõ của người dùng thay vì chép lại toàn bộ bài luận giải 4 mục.
6. **Hiển thị minh bạch Huy hiệu Key/Model**:
   - Giống như `/api/interpret-period`, `/api/interpret-chat` phát gói SSE `{"meta": ...}` ở chunk đầu tiên và `{"interrupted": true}` nếu đứt luồng giữa chừng; **không tự động tráo bằng văn bản mẫu tĩnh** (`generateLocalInterpretationVi`) khi hết key hay lỗi mạng để tránh trả lời lạc đề, mà báo trạng thái rõ ràng kèm nút `"Thử gửi lại câu hỏi"`.

#### 2.3.4. Lưu trữ trạng thái hội thoại & Giới hạn độ dài ngữ cảnh
- **Khóa lưu trữ hội thoại**: `chatSessionKey = "${chartIdentityKey}::${contextKey}"` (ví dụ `1995_8_16_5_male::liunian_2026` hoặc `1995_8_16_5_male::topic_career`).
- **Nơi lưu trữ (Đưa vào QĐ-4)**:
  - **Khuyến nghị**: Lưu trong state React kèm đồng bộ `sessionStorage` theo `chartIdentityKey` (giữ tối đa `10` mạch hội thoại gần nhất, tự xóa khi đóng tab trình duyệt). Khi người dùng chuyển qua lại giữa các tab/kỳ hạn hoặc vô tình F5 trong cùng phiên, mạch hỏi đáp của từng phần vẫn còn nguyên. Có nút `"Xóa lịch sử hỏi đáp phần này"`.
- **Giới hạn độ dài lịch sử & Ngữ cảnh (Context Window Guard)**:
  - Câu hỏi mỗi lượt của người dùng: tối đa **`400 ký tự`**.
  - Lịch sử gửi kèm lên server (`history`): chỉ lấy **tối đa `6` tin nhắn gần nhất (`3` cặp Hỏi – Đáp)**, mỗi tin nhắn cắt trần `1.200 ký tự` (tổng lịch sử $\le 4.500$ ký tự).
  - Nguyên văn bài luận giải đang xem (`activeInterpretationText`): cắt trần `6.000 ký tự`.
  - Nhờ giới hạn này, tổng prompt đầu vào của mỗi lượt chat luôn giữ ổn định ở mức **`~2.500 – 3.500 tokens`**, phản hồi nhanh (`TTFB ~1,2–2,5s`) và không làm phình chi phí TPM (Tokens Per Minute) của kho key free tier.

#### 2.3.5. Giao diện Khung Chat (`src/components/ContextualChatDrawer.tsx` hoặc tích hợp trong `InsightPanel.tsx`)
- Thiết kế dạng **Ngăn kéo trượt bên phải (Slide-over Drawer trên Desktop / Bottom Sheet trên Mobile)** hoặc **Khung mở rộng neo ngay dưới phần luận giải đang xem**:
  - **Header của khung chat**: Hiển thị rõ huy hiệu ngữ cảnh đang neo:
    - Ví dụ: `Đang hỏi về: Lưu Niên 2026 — Năm Bính Ngọ · Cung Quan Lộc`
    - Kèm nhãn nhỏ: `Đã neo vào Bảng dữ kiện xác định + Bài luận giải hiện tại`.
  - **Khung trích dẫn đoạn đang hỏi (nếu có)**: Hiển thị đoạn văn người dùng bấm chọn để hỏi.
  - **Thanh gợi ý 3 câu hỏi nhanh (Quick Chips)**: Giúp người dùng bấm hỏi ngay chỉ với 1 cú nhấp chuột.
  - **Danh sách tin nhắn**: Hiển thị từng cặp Hỏi – Đáp bằng `MarkdownContent`, dưới mỗi câu trả lời của AI có huy hiệu nhỏ `Model: gemini-3.5-flash-lite · Khóa: AIzaSy••••••xxxx` (và nút `"Thử lại"` nếu câu trả lời bị ngắt giữa chừng).

---

## 3. Phân Tích Chi Phí Hạn Mức API & Thời Gian Ước Tính (Với 3 Key Free Tier Khỏe)

### 3.1. Các giả định tính toán (Explicit Assumptions)
Mọi ước tính dưới đây dựa trên các thông số thực tế của hệ thống hiện tại:
1. **Trạng thái kho khóa**: Tổng **23 key**, trong đó **3 key khỏe (`status = 'ready'`)** thuộc gói Google AI Studio Free Tier, **20 key đang `cooldown` 6 giờ** do `QUOTA_PROJECT_ZERO` (giả định 3 key khỏe thuộc 3 GCP Project khác nhau).
2. **Hạn mức Google Gemini Free Tier đối với dòng Flash / Flash-Lite**:
   - Giả định hạn mức thực tế khoảng **`5 – 15 RPM` (Requests Per Minute) / Project** trên mỗi model (`gemini-3.5-flash-lite` và `gemini-3.8-flash`).
   - Theo **QĐ-6** đã triển khai trong `allocator.ts` & `executor.ts`: khi một key chạm trần `429 RATE_LIMIT_RPM` trên `defaultModel` (`gemini-3.5-flash-lite`), `executor` tự động thử ngay `fallbackModel` (`gemini-3.8-flash`) trên cùng key đó trước khi xoay sang key khỏe tiếp theo.
3. **Thời gian phản hồi trung bình**:
   - **Lời gọi Probe 1 từ (`testKey`)**: `maxOutputTokens = 8`, thời gian phản hồi **`~0,6 – 1,5 giây`**/key.
   - **Lời gọi Luận giải 1 chương (`executeStream`)**: độ dài đầu ra `~600 – 900 từ` tiếng Việt, thời gian stream hoàn tất trung bình **`~6 – 10 giây`**/chương (nếu có 1 lần failover hoặc nối tiếp luồng thì khoảng `12 – 18 giây`).
   - **Lời gọi Chat giải thích 1 lượt (`/api/interpret-chat`)**: độ dài đầu ra `~150 – 350 từ`, thời gian stream hoàn tất trung bình **`~3 – 5 giây`**/lượt.

---

### 3.2. Bảng tính chi phí API & Thời gian cho từng tính năng

| Tính năng & Kịch bản sử dụng | Tổng số lần gọi Gemini API (`generateContent` / `generateContentStream`) | Thời gian hoàn tất ước tính (với 3 key khỏe / 20 key nguội) | Mức tiêu thụ trên mỗi Key khỏe & Đánh giá an toàn Quota |
| :--- | :--- | :--- | :--- |
| **TÍNH NĂNG 1: Test lại toàn bộ 20 key đang `cooldown`**<br>*(Kịch bản A: 20 key thuộc 20 Project khác nhau, chưa có Project nào trùng)* | **Tối đa `20` lần gọi** `generateContent` (`maxOutputTokens: 8`) — mỗi lần gọi trên chính key đang nguội cần thử (không tiêu tốn quota của 3 key đang khỏe!). | `20 key × (~1,0s gọi + 1,2s giãn cách)` $\approx$ **`40 – 45 giây`** (có thể bấm Dừng bất cứ lúc nào). | **0 lần gọi** vào 3 key đang khỏe (vì mỗi key tự probe chính nó). Hoàn toàn không ảnh hưởng quota luận giải của người dùng. |
| **TÍNH NĂNG 1: Test lại toàn bộ 20 key đang `cooldown`**<br>*(Kịch bản B: 20 key thuộc 5 GCP Project dùng chung, có bật "Nhảy cóc cùng Project")* | **Chỉ `5` lần gọi** `generateContent` (15 key trùng Project được đồng bộ tức thì sau khi key đại diện của Project đó báo lỗi). | `5 key × (~1,0s + 1,2s)` $\approx$ **`11 – 13 giây`**. | **0 lần gọi** vào 3 key đang khỏe; giảm **75% số request thừa** lên máy chủ Google. |
| **TÍNH NĂNG 2: Xuất bản luận giải chi tiết — Phương án Khuyến nghị (8 Chương chuẩn)**<br>*(Kịch bản Lạnh — Chưa có chương nào trong cache)* | **`8` lần gọi** `generateContentStream`:<br>- Chương 1 (Tổng quan): `1`<br>- Chương 2–4 (12 cung gom 3 nhóm × 4 cung): `3`<br>- Chương 5 (Năm 2026): `1`<br>- Chương 6 (Năm 2027): `1`<br>- Chương 7 (5 năm tới 2026–2030): `1`<br>- Chương 8 (10 năm tới 2026–2035): `1` | Tuần tự 8 chương × (`~7,5s` stream + `1,5s` nghỉ) $\approx$ **`70 – 80 giây` (~1,2 phút)**. | Chia đều qua `Round-Robin` trên 3 key khỏe: trung bình **`2,67 lần gọi / key`** trong hơn 1 phút $\rightarrow$ **An toàn tuyệt đối** dưới ngưỡng RPM của Free Tier (`5–15 RPM/key`). |
| **TÍNH NĂNG 2: Xuất bản luận giải chi tiết — Phương án Khuyến nghị (8 Chương chuẩn)**<br>*(Kịch bản Ấm — Người dùng đã xem Tổng quan + Lưu Niên 2026 + Lưu Niên 2027 ở ngoài)* | **Chỉ còn `5` lần gọi** `generateContentStream` (3 chương lấy thẳng từ cache trong `0ms`). | Tuần tự 5 chương × `~9s` $\approx$ **`42 – 50 giây`**. | Trung bình **`1,67 lần gọi / key`** trên 3 key khỏe $\rightarrow$ Rất nhẹ và nhanh. |
| **TÍNH NĂNG 2: Phương án Thay thế (17 Chương — Tách rời từng cung trong 12 cung)**<br>*(Chỉ để so sánh tại QĐ-2)* | **`17` lần gọi** (`1` Tổng quan + `12` cung rời + `4` mốc thời gian). | Tuần tự 17 chương × `~9s` $\approx$ **`150 – 170 giây` (~2,5 – 3 phút)**. | Trung bình **`5,67 lần gọi / key`**, nguy cơ cao chạm `429 RATE_LIMIT_RPM` ở nửa cuối nếu 2 trong 3 key khỏe thuộc cùng 1 GCP Project. |
| **TÍNH NĂNG 3: Chat hỏi AI về một nội dung luận giải chưa rõ**<br>*(Tính trên 1 câu hỏi của người dùng)* | **`1` lần gọi** `generateContentStream` / câu hỏi (chỉ phát sinh khi người dùng bấm Gửi câu hỏi). | **`3 – 5 giây`** / câu trả lời (streaming hiển thị chữ đầu tiên sau `~1,2 – 2,0 giây`). | `1` lần gọi xoay vòng trên 3 key khỏe; một phiên hỏi đáp 3–5 câu chỉ tốn `1–2 request/key`. |

---

## 4. Phân Tích Rủi Ro & Biện Pháp Giảm Thiểu

| Mã | Rủi ro | Mức độ | Nguyên nhân | Biện pháp giảm thiểu trong thiết kế |
| :-: | :--- | :---: | :--- | :--- |
| **R-1** | **Nhầm lẫn lớp Tứ Hóa (Bản mệnh vs. Đại hạn vs. Lưu niên vs. Tự hóa cung) khi sinh Bản Luận Giải Chi Tiết 12 cung (Tính năng 2) và khi Chat giải thích (Tính năng 3)** *(Liên đới trực tiếp từ Vấn đề đã biết (i))* | **Cao** | Trong `formatChartSummaryVi` (`vi-i18n.ts:1406`), nhãn `(Hóa Lộc/Quyền/Khoa/Kỵ)` gắn cạnh tên sao không ghi rõ tiền tố `Bản mệnh (Can năm sinh)`, dễ làm AI nhầm với Tứ Hóa Đại Hạn/Lưu Niên hoặc tự suy diễn theo khẩu quyết khác. | Trong `buildPalaceGroupFactSheetVi` và `buildMultiYearHorizonContext` (phục vụ Tính năng 2) cũng như bảng ngữ cảnh của Tính năng 3, **bắt buộc ghi nhãn tường minh lớp Tứ Hóa**:<br>- `[Tứ Hóa Bản Mệnh (Can Năm Sinh ...)]`<br>- `[Tứ Hóa Đại Hạn (...)]`<br>- `[Tứ Hóa Lưu Niên Năm ... (Can ...)]`<br>- `[Tự Hóa Của Can Cung (...)]`<br>Nhờ đó AI không bao giờ trộn lẫn các lớp Tứ Hóa. |
| **R-2** | **Đứt luồng hoặc chạm trần `429 RPM` ở chương thứ 5–8 khi đang sinh Bản Luận Giải Chi Tiết (Tính năng 2)** | **Cao** | Kho chỉ có 3 key khỏe free tier; nếu người dùng vừa luận giải liên tục ngoài màn hình chính rồi bấm ngay "Xuất bản chi tiết", 1 hoặc 2 key có thể chạm ngưỡng RPM theo phút. | 1. Sinh **tuần tự từng chương (`concurrency = 1`)** kèm khoảng nghỉ `1.500ms` giữa các chương.<br>2. Lưu kết quả ngay sau mỗi chương hoàn tất (`Incremental Chapter Cache`).<br>3. Nếu một chương gặp `AI_POOL_EXHAUSTED`, tự động hiển thị đếm ngược `minRemainingCooldownSec` (ví dụ `15s`) và có nút **"Tiếp tục sinh từ chương đang dở"** hoặc **"Xuất ngay phần đã xong + Khung dữ kiện xác định cho phần còn lại"**. |
| **R-3** | **Dội bão request (Request Storm) khi bấm "Test lại toàn bộ key đang cooldown" (Tính năng 1)** | **Trung bình** | Nếu gửi song song `Promise.all` cả 20 key cùng lúc, Google có thể chặn tạm thời theo IP hoặc đốt 20 lượt gọi vào cùng một GCP Project đang bị `quota_limit_value = "0"`. | Chạy **tuần tự (`concurrency = 1`)** với giãn cách `1.200ms` giữa các key và áp dụng **Nhảy cóc cùng Project (`Same-Project Short-Circuit`)**: hễ 1 key trong Project `#P` vừa test báo lỗi cấp Project (`QUOTA_PROJECT_ZERO` / `RPD` / `RPM`), tự động đồng bộ kết quả cho các key còn lại thuộc `#P` mà không gọi mạng lặp lại. |
| **R-4** | **AI bịa thêm sao hoặc trả lời lan man ngoài nội dung đang xem trong khung Chat giải thích (Tính năng 3)** | **Trung bình** | Nếu dùng chung prompt mở của `/api/interpret`, AI thường viết lại một bài luận giải mới dài dòng thay vì giải thích đúng đoạn người dùng đang thắc mắc. | Tách endpoint riêng `POST /api/interpret-chat` với `buildStrictExplanationChatPrompt`: truyền nguyên văn đoạn luận giải đang xem + bảng dữ kiện xác định làm "chân lý gốc" (Ground Truth), cấm bịa thêm sao/Tứ Hóa ngoài bảng. |
| **R-5** | **Hộp thoại In (`window.print()`) bị hạn chế trong một số trình duyệt nhúng iFrame (Tính năng 2)** | **Thấp** | Môi trường preview AI Studio chạy trong iFrame có thể hạn chế popup hoặc in kèm thanh cuộn nếu chỉ dùng `window.print()`. | Cung cấp đồng thời **Tải file `.html` bản in độc lập (Standalone Printable HTML)** + **Tải file `.md` (Markdown)** + **Sao chép văn bản** + **In trực tiếp**, đảm bảo người dùng luôn lấy được hồ sơ hoàn chỉnh trên mọi thiết bị. |

---

## 5. Kế Hoạch Kiểm Chứng (Verification Matrix)

### 5.1. Kiểm chứng Tính năng 1 (Test lại toàn bộ key đang cooldown)
1. **Kịch bản 1.1 — Phân loại & Phục hồi chính xác**:
   - Giả lập kho có 4 key đang `cooldown`: Key K1 (đã hết lỗi trên Google, trả `"OK"`), Key K2 & K3 (cùng thuộc Project `#111111`, vẫn lỗi `429 QUOTA_PROJECT_ZERO`), Key K4 (lỗi `403 API_KEY_INVALID`).
   - Khi chạy Batch Probe:
     - K1 chuyển sang `status = 'ready'`, `healthScore = 100`, `pendingProbe = false`.
     - K2 bị lỗi `QUOTA_PROJECT_ZERO` → giữ `status = 'cooldown'`, cập nhật lại `cooldownUntil = now + 6h`.
     - K3 (cùng Project `#111111` với K2) được **nhảy cóc (short-circuit)** không gọi mạng thêm lần nữa, đồng bộ `cooldownUntil` theo K2.
     - K4 chuyển sang `status = 'disabled'`, `healthScore = 0`.
     - Tổng kết hiển thị đúng: `Hồi phục: 1 · Còn nguội: 2 (trong đó 1 bỏ qua do trùng Project) · Vô hiệu: 1`.
2. **Kịch bản 1.2 — Hủy giữa chừng & Bảo vệ quyền PIN**:
   - Đang chạy ở key `2/20`, bấm nút **"Dừng kiểm tra"** → vòng lặp dừng ngay lập tức, 2 key đầu giữ kết quả mới, 18 key sau giữ nguyên trạng thái cũ.
   - Trên `Shared App URL` khi chưa nhập `KEY_POOL_ADMIN_PIN`: nút `"Test lại toàn bộ key đang nguội"` bị khóa (`disabled`) và mọi lời gọi API đều bị chặn `403 ADMIN_READ_ONLY`.

### 5.2. Kiểm chứng Tính năng 2 (Xuất bản luận giải chi tiết)
1. **Kịch bản 2.1 — Kiểm tra độ phủ dữ kiện xác định (Deterministic Coverage)**:
   - Kiểm tra hàm `buildPalaceGroupFactSheetVi` xuất đủ 12 cung (không thiếu cung nào trong 12 cung: Mệnh, Phụ, Phúc, Điền, Quan, Nô/Giao Hữu, Di, Tật, Tài, Tử, Phu, Huynh) kèm nhãn Tứ Hóa tách lớp rõ ràng.
   - Kiểm tra hàm `buildMultiYearHorizonContext` xuất đúng ma trận 5 năm (`2026–2030`) và 10 năm (`2026–2035`), tự động phát hiện đúng năm chuyển giao Đại Hạn trong khoảng 10 năm.
2. **Kịch bản 2.2 — Tái sử dụng Cache & Tiếp tục sau khi ngắt**:
   - Nếu `aiPeriodCache` đã có sẵn Lưu Niên `2026`, mở modal Xuất bản chi tiết phải hiển thị ngay Chương 5 ở trạng thái `Đã có sẵn từ bộ nhớ đệm` (không gọi lại API).
   - Giả lập ngắt giữa chừng ở Chương 4 → bấm `"Xuất ngay bản hiện có"` vẫn tải được file `.html` / `.md` có đủ Chương 1–3 hoàn chỉnh và Chương 4–8 có Khung dữ kiện xác định kèm nhãn `[Chưa hoàn tất diễn giải AI]`. Bấm `"Tiếp tục sinh phần còn thiếu"` chỉ chạy từ Chương 4 đến Chương 8.

### 5.3. Kiểm chứng Tính năng 3 (Chat hỏi AI về nội dung luận giải chưa rõ)
1. **Kịch bản 3.1 — Neo đúng ngữ cảnh & Chống bịa**:
   - Mở khung chat từ phần **Lưu Niên 2026**, hỏi: *"Vì sao bài luận giải nói năm nay cung Quan Lộc bị áp lực?"* → Prompt tạo ra phải chứa nguyên văn `factTableMarkdown` của Lưu Niên 2026 + nguyên văn bài luận giải Lưu Niên 2026; câu trả lời chỉ rõ sao Hóa Kỵ / Kình Đà trong bảng dữ kiện.
   - Hỏi thử một câu bẫy về sao không có trong cung → AI từ chối bịa và trích dẫn đúng các sao thực tế có trong cung theo bảng dữ kiện.
2. **Kịch bản 3.2 — Giới hạn lịch sử & Hiển thị huy hiệu Key/Model**:
   - Gửi liên tiếp 8 câu hỏi trong cùng một mạch → request thứ 8 chỉ đính kèm tối đa 6 tin nhắn lịch sử gần nhất (`3` cặp Hỏi–Đáp).
   - Mỗi câu trả lời hiển thị đúng huy hiệu `Model` và `maskedKey` (`AIzaSy••••••xxxx`), và **0 lộ khóa nguyên văn** trong `dist/` hay network payload.

---

## 6. Danh Sách Quyết Định Cần Người Dùng Chốt (Decision Matrix)

Để chuẩn bị cho lượt thi công code tiếp theo, đề nghị người dùng xem xét và chốt **5 quyết định thiết kế (`QĐ-1` → `QĐ-5`)** dưới đây (mỗi quyết định đều có phương án khuyến nghị của Argon):

| Mã QĐ | Vấn đề cần chốt | Các phương án lựa chọn | Phương án Khuyến nghị của Argon |
| :---: | :--- | :--- | :--- |
| **QĐ-1** | **Định dạng đầu ra của nút "Xuất bản luận giải chi tiết" (Tính năng 2)** | - **Phương án A (Khuyến nghị)**: Hộp thoại Xuất bản hỗ trợ **cả 3 chế độ trong một màn hình**: (1) **Tải file `.html` bản in độc lập (Standalone Printable HTML)** được thiết kế sẵn giao diện giấy cổ trang nhã + CSS `@media print` (mở xem offline hoặc bấm `Ctrl+P -> Lưu PDF` chuẩn trên mọi trình duyệt không sợ lỗi iFrame); (2) **Tải file `.md` (Markdown)**; (3) **Sao chép toàn bộ văn bản** và nút **In trực tiếp**.<br>- **Phương án B**: Chỉ làm chế độ Trang in trực tiếp (`window.print()`) + Sao chép văn bản.<br>- **Phương án C**: Chỉ tải file Markdown (`.md`) + Sao chép văn bản. | **Khuyến nghị Phương án A**: Đáp ứng trọn vẹn cả nhu cầu lưu PDF đẹp, lưu trữ file học thuật (`.md`/`.html`) và gửi nhanh qua tin nhắn, đồng thời tránh được giới hạn `window.print()` trong môi trường iFrame. |
| **QĐ-2** | **Cách chia chương cho Phần (b) — 12 Cung Cuộc Sống trong Bản Luận Giải Chi Tiết (Tính năng 2)** | - **Phương án A (Khuyến nghị — 8 Chương Chuẩn = tối đa 8 lần gọi AI)**: Phần (b) chia 12 cung thành **3 Chương theo 3 nhóm Tam Hợp / Liên Đới** (mỗi chương gồm đúng 4 cung, bắt buộc AI phân tích sâu từng cung theo 4 đề mục riêng). Tổng toàn bộ bản chi tiết (Tổng quan + 12 cung + Năm 2026 + Năm 2027 + 5 năm tới + 10 năm tới) chỉ tốn **tối đa 8 lần gọi AI (~70–80 giây)**, an toàn tuyệt đối với 3 key free tier.<br>- **Phương án B (17 Chương = tối đa 17 lần gọi AI)**: Tách mỗi cung trong 12 cung thành 1 lần gọi AI riêng biệt (`1 + 12 + 4 = 17` lần gọi AI, mất ~2,5–3 phút và dễ chạm trần RPM khi chỉ có 3 key khỏe). | **Khuyến nghị Phương án A**: Vẫn đảm bảo **đủ mặt 100% cả 12 cung** với đề mục riêng và bảng dữ kiện xác định cho từng cung, nhưng giảm hơn một nửa số lần gọi API (`8` thay vì `17`), tránh đứt gãy vì `429 RPM` trên kho 3 key free tier. |
| **QĐ-3** | **Cơ chế điều phối nút "Test lại toàn bộ key đang cooldown" (Tính năng 1)** | - **Phương án A (Khuyến nghị)**: Điều phối **tuần tự từng key (`concurrency = 1`, giãn cách `1,2 giây`)** từ giao diện `KeyPoolModal` kết hợp **"Nhảy cóc cùng Project" (`Same-Project Short-Circuit`)**: cập nhật trực tiếp từng dòng khi test xong, có thanh tiến trình `k/N`, có nút **Dừng giữa chừng**, và tự động bỏ qua không gọi mạng lặp lại cho các key trùng `detectedProjectNumber` vừa xác nhận vẫn lỗi cấp Project.<br>- **Phương án B**: Gửi 1 request batch duy nhất lên server để server tự test ngầm toàn bộ 20 key rồi trả kết quả 1 lần cuối (không cập nhật từng dòng, không hủy giữa chừng được).<br>- **Phương án C**: Tuần tự từng key nhưng **không** nhảy cóc theo Project (luôn gọi đủ 20 lần kể cả khi biết trùng Project đang `quota=0`). | **Khuyến nghị Phương án A**: Trực quan nhất cho người dùng (thấy ngay key nào sống lại theo thời gian thực), hủy được giữa chừng và tiết kiệm tối đa lượt gọi mạng dư thừa. |
| **QĐ-4** | **Lưu trữ lịch sử hội thoại của Tính năng 3 (Chat hỏi AI về nội dung luận giải)** | - **Phương án A (Khuyến nghị)**: Lưu theo từng cặp `(Lá số + Phần luận giải đang xem)` trong bộ nhớ phiên làm việc (`React state` đồng bộ với `sessionStorage`, tối đa 10 mạch hội thoại gần nhất, kèm nút `"Xóa hội thoại"`). Giữ được lịch sử khi đổi tab hoặc tải lại trang trong cùng phiên, tự dọn sạch khi đóng tab.<br>- **Phương án B**: Chỉ lưu trong `React state` tạm thời (mất ngay khi đổi lá số hoặc F5 tải lại trang).<br>- **Phương án C**: Lưu vĩnh viễn vào `localStorage`. | **Khuyến nghị Phương án A**: Cân bằng tốt nhất giữa trải nghiệm liền mạch khi tra cứu nhiều phần luận giải và việc không làm đầy `localStorage` của trình duyệt. |
| **QĐ-5** | **Phạm vi đặt nút "Hỏi rõ thêm" của Tính năng 3** | - **Phương án A (Khuyến nghị)**: Đặt nút mở Chat giải thích tại **cả 3 nơi có văn bản luận giải**: (1) Khối Luận giải Kỳ hạn (Đại Hạn / Lưu Niên) trong `InsightPanel`; (2) Khối Luận giải Chủ đề / Cung / Tứ Hóa trong `InsightPanel`; và (3) Bên cạnh mỗi chương trong Modal **Xuất bản luận giải chi tiết** (Tính năng 2).<br>- **Phương án B**: Chỉ đặt trong `InsightPanel` (Kỳ hạn + Chủ đề/Cung). | **Khuyến nghị Phương án A**: Cho phép người dùng hỏi sâu ngay cả khi đang đọc từng chương trong Bản Luận Giải Chi Tiết vừa xuất bản, tận dụng cùng một component `ContextualChatDrawer` và cùng một endpoint `/api/interpret-chat`. |

---

## 7. Phân Pha Triển Khai (Implementation Roadmap)

Sau khi người dùng phê duyệt kế hoạch và chốt các quyết định `QĐ-1` → `QĐ-5`, công việc thi công code sẽ được chia thành **4 Pha tuần tự, độc lập và dễ kiểm chứng**:

### Pha 1 — Triển khai Tính năng 1: Nút "Test lại toàn bộ key đang cooldown"
- **Phụ thuộc**: Độc lập hoàn toàn, làm trước để giúp người dùng kiểm tra và phục hồi nhanh các key trong kho.
- **Công việc cụ thể**:
  1. Cập nhật `server/key-pool/allocator.ts` (`recordFailure`) và `server/key-pool/index.ts` (`testKey` hỗ trợ cờ `batchProbe` bỏ debounce 5s cho tiến trình quét tuần tự).
  2. Cập nhật `src/components/KeyPoolModal.tsx`: thêm nút `"Test lại toàn bộ key đang nguội (N)"`, bộ điều phối tuần tự giãn cách `1,2s` có `Same-Project Short-Circuit`, thanh tiến trình `k/N`, nút `"Dừng kiểm tra"`, và thông báo tổng kết chi tiết theo từng loại lỗi.

### Pha 2 — Xây dựng Tầng Dữ Kiện Xác Định & Endpoint cho Tính năng 2 & 3
- **Phụ thuộc**: Nền tảng dữ liệu và API cho Pha 3 và Pha 4.
- **Công việc cụ thể**:
  1. Tạo `src/lib/ziwei/dossier-context.ts`:
     - Cài đặt `buildPalaceGroupFactSheetVi()` cho 12 cung (tách rõ nhãn lớp Tứ Hóa để phòng ngừa rủi ro `R-1`).
     - Cài đặt `buildMultiYearHorizonContext()` cho mốc **5 năm tới (`2026–2030`)** và **10 năm tới (`2026–2035`)** dựa trên `buildYunxianPeriodContext`.
  2. Cập nhật `server.ts`:
     - Thêm `POST /api/interpret-dossier-section` (SSE streaming qua `keyPoolManager.executeStream`, kèm `buildStrictDossierSectionPrompt`).
     - Thêm `POST /api/interpret-chat` (SSE streaming qua `keyPoolManager.executeStream`, kèm `buildStrictExplanationChatPrompt` và bộ cắt tỉa lịch sử hội thoại an toàn).

### Pha 3 — Triển khai Giao diện Tính năng 3: Khung Chat Giải Thích Ngữ Cảnh
- **Phụ thuộc**: Cần endpoint `POST /api/interpret-chat` từ Pha 2.
- **Công việc cụ thể**:
  1. Tạo `src/components/ContextualChatDrawer.tsx`: hiển thị ngữ cảnh đang neo, gợi ý câu hỏi nhanh, danh sách Hỏi–Đáp streaming có huy hiệu `Model / Key`, lưu `sessionStorage` theo `(chartIdentityKey, sectionKey)`.
  2. Tích hợp nút `"Hỏi rõ thêm về phần này"` vào `src/components/InsightPanel.tsx` (cả khối Kỳ hạn và khối Chủ đề/Cung).

### Pha 4 — Triển khai Giao diện Tính năng 2: Modal Xuất Bản Luận Giải Chi Tiết & Kiểm thử tổng thể
- **Phụ thuộc**: Cần `dossier-context.ts` và `/api/interpret-dossier-section` từ Pha 2 (và gắn luôn nút Chat giải thích từ Pha 3 vào từng chương nếu chốt QĐ-5 Phương án A).
- **Công việc cụ thể**:
  1. Tạo `src/components/DetailedDossierModal.tsx`: quản lý danh sách 8 chương, liên thông 2 chiều với `aiPeriodCache` của `InsightPanel`, sinh tuần tự có thanh tiến trình, cho phép Tạm dừng / Tiếp tục phần còn thiếu / Xuất bản dở dang có đánh dấu, hỗ trợ Tải `.html` bản in độc lập, Tải `.md`, Sao chép và In trực tiếp.
  2. Gắn nút `"Xuất Bản Luận Giải Chi Tiết"` vào `src/App.tsx` và `src/components/InsightPanel.tsx`.
  3. Cập nhật `scripts/verify-key-pool.ts` (bổ sung bài test cho Batch Cooldown Probe, Dossier Context 12 cung + 5/10 năm, và Contextual Chat Prompt), chạy kiểm chứng `tsc --noEmit`, `vite build`, và quét chống lộ khóa trên `dist/`.
