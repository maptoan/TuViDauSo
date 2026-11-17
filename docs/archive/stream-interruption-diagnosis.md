> ⚠️ **[TÀI LIỆU LỊCH SỬ ĐÃ LƯU TRỮ — KHÔNG DÙNG LÀM CĂN CỨ CODE HIỆN HÀNH]**
> - **Trạng thái**: Đã hoàn thành vai trò lịch sử / Đã bị thay thế bởi tài liệu sống **[`docs/key-pool-operations.md`](../key-pool-operations.md) & [`docs/h4-diagnosis.md`](../h4-diagnosis.md)** từ ngày `17/11/2026`.
> - **Cảnh báo cho Kỹ sư & AI Agent**: Các trích dẫn số dòng, tên biến, hằng số (như ngân sách 25s, nhịp nghỉ 2200ms, số lượng key 3/23) trong file này phản ánh thời điểm trước khi hợp nhất và **không còn khớp với mã nguồn hiện hành**. Tuyệt đối đọc tài liệu sống tại thư mục `docs/` gốc và đối chiếu code thật trước khi chẩn đoán hoặc sửa code!

---
# Báo Cáo Chẩn Đoán Kỹ Thuật (Pha A): Lỗi Ngắt Luồng Giữa Chừng (`503 UNAVAILABLE`) & Phán Quyết Tối Ưu Giải Thuật Kho Khóa

- **Ngày thực hiện**: `2026-11-16`
- **Cổng rà soát**: **Chẩn đoán Argon (Pha A — Chỉ đọc code thực tế, phân tích & lập kế hoạch Pha B, chưa sửa code triển khai)**
- **Các file code thực tế đã đối chiếu**:
  - `server/key-pool/allocator.ts` (656 dòng)
  - `server/key-pool/executor.ts` (319 dòng)
  - `server.ts` (602 dòng)
  - `src/components/InsightPanel.tsx` (812 dòng)
  - `scripts/verify-key-pool.ts` (454 dòng)

---

## 1. Tổng Hợp Nguyên Nhân Gốc Rễ Gây Ngắt Luồng Giữa Chừng (Root-Cause Analysis)

Từ số đo thực nghiệm trên cùng lá số (Lưu Niên 2026, 4 mục luận giải) qua 3 khóa `#21` (`AIzaSy••••••Tm0k`), `#22` (`AIzaSy••••••qRpQ`), `#23` (`AIzaSy••••••GyWQ`) đều bị cắt ngang ở mục `1,5` – `3,5` với cùng lỗi:
> `ApiError: got status: UNAVAILABLE. {"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}} | status=503 |`

trong khi cả 3 khóa đều đậu kiểm tra ngắn (`MANUAL_TEST_PASSED` trong `718ms` – `2007ms`), nguyên nhân đến từ **tổ hợp 1 nguyên nhân ngoại sinh từ upstream + 3 lỗi thiết kế nội tại trong code hiện hành**:

1. **Nguyên nhân chính (Ngoại sinh từ model mặc định + Thiếu cơ chế tiếp nối giữa luồng)**:
   - Bài luận giải kỳ hạn 4 mục (`buildStrictPeriodAiPrompt` tại `server.ts:122–163`) yêu cầu sinh chuỗi Markdown dài (~`1.500–2.500` output tokens, giữ kết nối streaming mở liên tục `12–25 giây`), khác hẳn lệnh test ngắn 8 token (`server/key-pool/index.ts:408`).
   - Khi model mặc định `gemini-3.5-flash-lite` gặp đỉnh tải tạm thời (`503 UNAVAILABLE / high demand`), Google ngắt kết nối gRPC ngay **giữa luồng streaming** (sau khi đã gửi được 1,5 đến 3,5 mục).
   - Tại `server/key-pool/executor.ts:252–276` (`if (firstChunkSent)`), hệ thống **từ bỏ ngay lập tức**: không thực hiện gọi nối tiếp phần còn thiếu (continuation) sang `fallbackModel` (`gemini-3.8-flash`) hay sang khóa khác, mà gắn cứng dòng chữ cảnh báo gián đoạn rồi đóng luồng như một kết quả hoàn chỉnh.
2. **Yếu tố phụ #1 (Lỗi ép kiểu phân loại tại `executor.ts:259` làm phạt oan khóa khỏe)**:
   - Dù `classifyGeminiError` nhận diện đúng lỗi trên là `MODEL_UNAVAILABLE`, dòng `executor.ts:259` lại **cưỡng bức ghi đè** `category: classified.category === 'MODEL_UNAVAILABLE' ? 'NETWORK_OR_5XX' : classified.category` khi `firstChunkSent === true`. Hệ quả là cả 3 khóa `#21`, `#22`, `#23` đều bị phạt oan `-10` điểm và bị nhốt vào `cooldown` `26–33 giây` (`NETWORK_OR_5XX`).
3. **Yếu tố phụ #2 (Lỗi đóng băng kết quả cụt vào bộ nhớ đệm tại `InsightPanel.tsx:231–262`)**:
   - `executor.ts:264–275` gửi dòng gián đoạn như một chunk văn bản thường (`delta.text`) và kết thúc bằng `data: [DONE]` mà không phát tín hiệu lỗi cấu trúc. `InsightPanel.tsx` tưởng bài luận đã hoàn thành trọn vẹn nên **lưu vĩnh viễn bài viết bị cụt vào `aiPeriodCache[pKey]`** và hiện nhãn xanh *"Đã lưu bộ nhớ đệm kỳ này"*.

---

## 2. Phán Quyết Chi Tiết Cho 3 Điểm Chẩn Đoán `(i)`, `(ii)`, `(iii)`

### Điểm (i): Phân loại lỗi `503 got status: UNAVAILABLE` (`MODEL_UNAVAILABLE` vs `NETWORK_OR_5XX`)

- **Phán quyết**: **XÁC NHẬN CÓ LỖI (gồm 1 lỗi cưỡng bức ghi đè trực tiếp tại `executor.ts:259` + 1 lỗ hổng regex tiềm ẩn tại `allocator.ts:108`)**.
- **Bằng chứng & vị trí code chính xác**:
  1. **Tại `server/key-pool/allocator.ts:106–118`**:
     ```ts
     if (
       numericStatus === 404 ||
       /models\/[a-z0-9.-]+\s+is not found|not supported for generateContent|model is overloaded|currently unavailable|high demand/i.test(
         normalizedText,
       )
     ) {
       return { category: 'MODEL_UNAVAILABLE', ... };
     }
     ```
     - Với chuỗi lỗi thực nghiệm có cụm `"currently experiencing high demand"`, hàm `classifyGeminiError()` ở `allocator.ts:108` **CÓ khớp** nhánh `high demand` và trả về `category = 'MODEL_UNAVAILABLE'`.
     - **Tuy nhiên (lỗ hổng regex ở `allocator.ts:108`)**: Regex hiện tại **bỏ sót** các mẫu gRPC `503 UNAVAILABLE` của Google không chứa chữ `"high demand"` hoặc `"model is overloaded"`, ví dụ: `got status: UNAVAILABLE`, `"status": "UNAVAILABLE"` đi kèm thông điệp ngắn hoặc `"The model is overloaded"` (có từ `The` xen giữa hay chỉ báo `UNAVAILABLE` cấp model/service), hoặc `503 Service Unavailable` khi nghẽn model. Khi đó lỗi sẽ rơi xuống nhánh 4 (`allocator.ts:154–166`: `numericStatus >= 500 && numericStatus < 600`) và bị xếp nhầm vào `NETWORK_OR_5XX`.
  2. **Thủ phạm trực tiếp gây ra 3 dòng log `NETWORK_OR_5XX (31s / 26s / 33s), -10 điểm` trong thực nghiệm nằm ở `server/key-pool/executor.ts:252–263`**:
     ```ts
     if (firstChunkSent) {
       // Đã gửi một phần văn bản xuống client -> không ghép đè luồng mới (E1-02)
       const classified = classifyGeminiError(err, this.getRawKeysById().values());
       this.allocator.recordFailure(
         lease.keyId,
         {
           ...classified,
           category: classified.category === 'MODEL_UNAVAILABLE' ? 'NETWORK_OR_5XX' : classified.category,
         },
         nowFn(),
         options.disableJitter,
       );
     ```
     - **Giải thích**: Ngay tại dòng **`executor.ts:259`**, khi lỗi xảy ra giữa luồng (`firstChunkSent === true`), code chủ động **biến đổi `MODEL_UNAVAILABLE` thành `NETWORK_OR_5XX`** trước khi truyền vào `this.allocator.recordFailure()`.
     - Tại `allocator.ts:470`, vì `classified.category` đã bị đổi thành `'NETWORK_OR_5XX'`, nó **vượt qua** cổng miễn phạt `if (classified.category === 'MODEL_UNAVAILABLE') return;` và chạy thẳng xuống `allocator.ts:515–538`: trừ `-10` điểm (`scorePenaltyMap['NETWORK_OR_5XX'] = 10`) và áp `computeCooldownDurationMs('NETWORK_OR_5XX')` = `30_000ms ± 15% jitter` (`25,5s .. 34,5s` — khớp tuyệt đối với 3 số đo `31s`, `26s`, `33s` của người dùng!).

---

### Điểm (ii): Cơ chế xử lý lỗi SAU chunk đầu tiên (`executor.ts` → `server.ts` → `InsightPanel.tsx`)

- **Phán quyết**: **XÁC NHẬN** hệ thống hiện tại **không có cơ chế tiếp nối (continuation) hay fallback giữa luồng**, mà nuốt ngoại lệ, gửi thông báo gián đoạn như văn bản thường và làm hỏng bộ nhớ đệm phía client.
- **Chuỗi hành vi & vị trí code chính xác**:
  1. **`server/key-pool/executor.ts`**:
     - `executor.ts:175`: Khởi tạo `let firstChunkSent = false;` ở đầu mỗi lượt thử `(key, model)`.
     - `executor.ts:210–229`: Khi nhận chunk có text đầu tiên từ `stream`, gán `firstChunkSent = true`, xóa `timeoutHandle` (`12s`), phát `options.onMeta?.(meta)` và `options.onChunk(text)`.
     - `executor.ts:246–276`: Khi vòng `for await (const chunk of stream)` ném lỗi sau khi `firstChunkSent === true`:
       - Nhảy vào khối `if (firstChunkSent)` (`dòng 252`).
       - Gọi `options.onChunk('\n\n*(Luồng kết nối bị gián đoạn giữa chừng — vui lòng bấm luận giải lại để nhận bản đầy đủ.)*')` (`dòng 264–266`).
       - **Dòng `267–275`**: Thực hiện `return { keyId, maskedKey, ... }` (trả về thành công thay vì `throw` hay `continue` vòng lặp `while (keyAttemptsUsed < MAX_KEY_ATTEMPTS)` ở `dòng 139`). Do `return` thẳng ra khỏi `executeStream()`, toàn bộ phần còn lại của bài luận bị bỏ rơi.
  2. **`server.ts`**:
     - Tại `POST /api/interpret-period` (`server.ts:379–395`), `POST /api/interpret` (`server.ts:494–509`) và `POST /api/heming` (`server.ts:556–572`):
       - Khi `options.onChunk` được gọi ở `executor.ts:264`, `server.ts:389` thực thi `sendSseText(res, text)` (`server.ts:84–86`), gói câu thông báo gián đoạn vào `data: {"delta":{"text":"..."}}`.
       - Vì `executeStream()` resolve bình thường (không ném lỗi), `server.ts` chạy tiếp xuống `dòng 392–395`: ghi `data: [DONE]\n\n` và `res.end()`, **không hề đi vào `catch (err)` (`dòng 396–418`)**.
  3. **`src/components/InsightPanel.tsx`**:
     - Tại `requestPeriodAiInterpretation` (`InsightPanel.tsx:200–243`): vòng đọc SSE nối mọi `parsed?.delta?.text` vào biến `accumulated` (`dòng 230`) và cập nhật `aiPeriodCache[pKey] = { text: accumulated, meta: receivedMeta }` (`dòng 231–237`).
     - **Không phân biệt luồng bị đứt với luồng hoàn tất**: Tại `dòng 245–262`, vì không có sự kiện `parsed.error` (`streamError === null`) và `accumulated.trim()` khác rỗng, `InsightPanel.tsx`:
       - Giữ nguyên văn bản bị cắt ngang trong `aiPeriodCache[pKey].text`.
       - Hiển thị huy hiệu xanh `<CheckCircle2 /> "Đã lưu bộ nhớ đệm kỳ này"` (`dòng 587–592`).
       - Nếu người dùng bấm nút luận giải từ thanh `TimeNav` (`externalAiRequestTick` tại `dòng 282–287` gọi `requestPeriodAiInterpretation(false)`), điều kiện `if (!forceRefresh && aiPeriodCache[pKey]?.text) return;` ở **`dòng 135`** sẽ chặn gọi lại API và trả mãi bản văn bản bị cụt.
       - Tương tự, tại `fetchInsight` (`dòng 320–345` cho 6 tab chủ đề) và `handleAsk` (`dòng 435–461` cho Vấn Đáp), văn bản bị ngắt giữa chừng cũng được lưu thẳng vào `cache[cacheKey]` và `qaList`.

---

### Điểm (iii): Tác động của `KeyLease` TTL 45 giây (`allocator.ts:389`) đối với luồng dài 45–70 giây

- **Phán quyết**: **BÁC BỎ** giả thuyết `LEASE_MAX_TTL_MS = 45_000` là nguyên nhân gây cắt luồng đang chạy; **XÁC NHẬN** đây là lỗi quản lý trạng thái đồng thời (`inFlightCount` bị giải phóng sớm khi stream kéo dài `> 45s`).
- **Kiểm chứng từng câu hỏi trên code thực tế (`server/key-pool/allocator.ts:369–395` & `executor.ts:177–311`)**:
  1. **Khi `ttlTimer` kích hoạt ở giây thứ 45 giữa lúc stream đang chảy thì chuyện gì xảy ra?**
     - Tại `allocator.ts:389–391`: `const ttlTimer = setTimeout(() => { release(); }, LEASE_MAX_TTL_MS);` (`45_000ms` định nghĩa ở `types.ts:184`).
     - Hàm `release()` (`allocator.ts:373–387`) chỉ đặt `released = true` và giảm `this.inFlightCounts.get(chosen.id)` đi `1` (hoặc xóa khỏi `Map` nếu về `0`).
  2. **`inFlightCount` có bị giải phóng sớm không? Request khác có thể lấy cùng key không?**
     - **CÓ.** Ngay từ giây thứ `45,001`, dù stream của Request 1 vẫn đang nhận token ở giây 46..70, `getInFlightCount(chosen.id)` trả về `0`.
     - Khi Request 2 đến ở giây 46:
       - Tại `allocator.ts:345`, `inFlightPenalty = this.getInFlightCount(key.id) * 6` bằng `0` (thay vì `6`), nên Request 2 có thể chọn trùng chính key đang bận.
       - Nguy hiểm hơn: tại `allocator.ts:328`, rào chắn `if (key.pendingProbe && inFlight > 0) return false;` bị vô hiệu hóa sau giây 45 (vì `inFlight` đã về `0` trong khi `pendingProbe` chưa được tắt cho tới khi `recordSuccess` chạy ở cuối stream).
  3. **Stream đang chạy có bị hủy hay mất ghi nhận thành công (`recordSuccess`) không?**
     - **KHÔNG.** `ttlTimer` hoàn toàn không giữ tham chiếu nào tới `attemptAbort` (`executor.ts:177`). Bộ hẹn giờ duy nhất có thể gọi `attemptAbort.abort()` là `timeoutHandle` (`FIRST_CHUNK_TIMEOUT_MS = 12_000ms` tại `executor.ts:186–190`), và bộ hẹn giờ này **đã bị `clearTimeout(timeoutHandle)` ngay khi chunk đầu tiên về tới ở `executor.ts:212–215`**.
     - Khi stream hoàn tất ở giây 60, `executor.ts:236` gọi `this.allocator.recordSuccess(lease.keyId, ttfbMs, nowFn())` truyền trực tiếp `lease.keyId` (không kiểm tra cờ `released`), nên khóa vẫn được cộng điểm và thống kê thành công đầy đủ; sau đó `lease.release()` trong `finally` (`executor.ts:310`) thoát êm qua dòng `if (released) return;` (`allocator.ts:374`).
  4. **Kết luận dứt khoát cho (iii)**: `LEASE_MAX_TTL_MS = 45s` **không cắt luồng**, nhưng làm sai lệch bộ đếm `inFlightCount` và làm rò rỉ khóa `pendingProbe` nếu luồng kéo dài quá 45 giây. Cần sửa bằng cơ chế gia hạn trượt (`lease.heartbeat()`) mỗi khi nhận chunk.

---

## 3. Phán Quyết Từng Đề Xuất Tối Ưu 1 → 7 Của Panel Hydrogen (Và Bổ Sung Cấp Thiết Từ Pha A)

| Đề xuất | Phán quyết | Thứ tự ưu tiên | Lý do kỹ thuật & Điều kiện triển khai |
| :--- | :---: | :---: | :--- |
| **Đề xuất 0 (Bổ sung bắt buộc từ chẩn đoán Pha A): Giữ nguyên không phạt key khi `MODEL_UNAVAILABLE` giữa luồng + Tự động gọi tiếp nối (Seamless Continuation) sang `fallbackModel`** | **LÀM NGAY (Bắt buộc)** | **Ưu tiên #1 (P0)** | Giải quyết trực tiếp lỗi cắt ngang ở mục 1,5–3,5: <br>1) Xóa bỏ lệnh ép `MODEL_UNAVAILABLE -> NETWORK_OR_5XX` tại `executor.ts:259` và mở rộng regex `allocator.ts:108` bắt trọn `got status: UNAVAILABLE` / `"status":"UNAVAILABLE"`.<br>2) Khi stream bị ngắt sau chunk đầu (`firstChunkSent === true`) mà vẫn còn ngân sách `< 35s`, tự động gửi yêu cầu **tiếp nối (continuation prompt)** kèm phần văn bản đã sinh lên `fallbackModel` (`gemini-3.8-flash`) trên cùng khóa (hoặc khóa kế tiếp nếu lỗi thuộc về key/mạng) để viết nốt các mục còn thiếu trong cùng 1 luồng SSE.<br>3) Nếu cả lượt tiếp nối cũng thất bại, gửi cờ SSE `{"interrupted": true}` để `InsightPanel.tsx` không lưu bản cụt vào cache hoàn chỉnh. |
| **Đề xuất 1: Cooldown chi tiết theo cặp `(Key, Model)` (`modelCooldowns`)** | **LÀM** | **Ưu tiên #2 (P0)** | Khắc phục triệt để xung đột của biến toàn cục `defaultModelUnavailable` trong `executor.ts:134, 290`: khi `(Key A, gemini-3.5-flash-lite)` bị `429 RATE_LIMIT_RPM` hoặc `503 MODEL_UNAVAILABLE`, hệ thống ghi nhận `key.modelCooldowns['gemini-3.5-flash-lite'] = now + cooldownMs`. Nhờ đó: (a) Key A chuyển sang `gemini-3.8-flash` thành công mà không quên rằng `3.5-flash-lite` trên Key A đang nghẽn trong 10–30s tới; (b) không làm lây cờ `defaultModelUnavailable` sang Key B thuộc project khác. |
| **Đề xuất 2: Ưu tiên đổi Key trước khi hạ Model khi gặp `RATE_LIMIT_RPM`** | **LÀM CÓ ĐIỀU KIỆN (Khớp Quyết định #1 của người dùng)** | **Ưu tiên #3 (P1)** | **Điều kiện bắt buộc**: Phải tuân thủ tuyệt đối Quyết định #1 của người dùng (*"executor thử ngay model dự phòng gemini-3.8-flash trên cùng key khi gặp RATE_LIMIT_RPM hoặc MODEL_UNAVAILABLE"*). Do đó: khi `(Key A, defaultModel)` gặp `RATE_LIMIT_RPM` hoặc `MODEL_UNAVAILABLE`, **vẫn thử ngay `fallbackModel` (`gemini-3.8-flash`) trên chính Key A trước**; NHƯNG nhờ kết hợp với **Đề xuất 1** (không dùng cờ `defaultModelUnavailable` toàn cục mà chỉ đánh dấu trên Key A), nếu `fallbackModel` trên Key A cũng thất bại và vòng lặp chuyển sang **Key B** (thuộc project khác), **Key B sẽ được thử lại từ đầu với `defaultModel` (`gemini-3.5-flash-lite`)** rồi mới đến `fallbackModel`! Như vậy vừa giữ 100% hành vi người dùng chỉ đạo trên Key A, vừa không làm hỏng model của Key B. |
| **Đề xuất 3: Bỏ nghẽn `Probe Starvation` (`probeFloorScore = 95`) + Độ mịn `latencyPenalty` (`floor(avgLatencyMs / 250)`, trần `10`)** | **LÀM** | **Ưu tiên #4 (P1)** | Tại `allocator.ts:341–343`, nâng sàn điểm khi `pendingProbe === true` từ `85` lên `95` (để khóa vừa hết nguội sau lỗi `-10` điểm đạt `tier = 19`, có cơ hội được chọn thăm dò sớm thay vì bị khóa `100` điểm ở `tier 20` chèn ép vĩnh viễn) và đổi `Math.min(8, Math.floor(avgLatencyMs / 1000))` thành `Math.min(10, Math.floor(avgLatencyMs / 250))` để phân biệt rõ khóa nhanh (`300ms`) với khóa chậm (`950ms`). |
| **Đề xuất 4: Chuẩn hóa lỗi cuối vòng lặp thành `PoolExhaustedError('AI_POOL_EXHAUSTED')`** | **LÀM** | **Ưu tiên #5 (P1)** | Tại `executor.ts:314–316`, khi vòng `while` kết thúc mà toàn bộ khóa trong kho đều đã chuyển sang `cooldown` hoặc `disabled` (`ready === 0`), ném `PoolExhaustedError('AI_POOL_EXHAUSTED', ..., minSec)` kèm thông điệp tiếng Việt tường minh thay vì trả chuỗi JSON `ApiError` thô dài lê thê. |
| **Đề xuất 5: Làm mới `KeyLease` theo chunk (`lease.heartbeat()`) + Tăng trần bảo hiểm lên `90s`** | **LÀM** | **Ưu tiên #6 (P2)** | Thêm phương thức `heartbeat()` vào `KeyLease` (`allocator.ts:385–400`, `types.ts:147–155`) và gọi `lease.heartbeat()` mỗi lần nhận được chunk trong `executor.ts:207`. Đặt TTL mỗi nhịp là `45s` (tính từ chunk gần nhất, tổng trần bảo hiểm `120s`), triệt tiêu hoàn toàn lỗi giải phóng sớm `inFlightCount` ở Điểm `(iii)`. |
| **Đề xuất 6: Nhận diện chéo GCP Project cho key mới (`projectHint`)** | **KHÔNG LÀM** | — | Thêm trường `projectHint` thủ công trên giao diện nhập key làm phức tạp UX không cần thiết (người dùng dán hàng loạt key thường không tra cứu sẵn `project_number` 12 chữ số của từng key), và cũng không nằm trong phạm vi nhóm 1→5 đã duyệt. |
| **Đề xuất 7: Gộp ghi đĩa (`Write Coalescing`)** | **KHÔNG LÀM (Hoặc chỉ giữ mức debounce 100ms hiện có)** | — | `KeyPoolManager.scheduleSave` (`server/key-pool/index.ts:65–83`) đã có sẵn cơ chế debounce `100ms` cho các cập nhật thường và `SerializedWriteQueue` cho các bản ghi quan trọng; với quy mô tối đa 50 khóa (< 40 KB JSON), chi phí ghi tuần tự dưới 1ms, không cần thêm độ phức tạp. |

---

## 4. Rà Soát Thay Đổi Cooldown RPM Của Người Dùng (Mục 1) & Cách Khắc Phục Tác Dụng Phụ Ở Pha B

### 4.1. Đánh giá thay đổi hiện tại trong code (`allocator.ts:214–222` & `executor.ts:282–302`)
1. **Điểm đúng đắn & hợp lý (GIỮ NGUYÊN 100%)**:
   - **Rút ngắn cooldown `RATE_LIMIT_RPM` xuống `10s → 20s → 30s` (hoặc `ceil(retryDelay) + 2s` trong khoảng `5s..60s`)**: Rất phù hợp với cơ chế cửa sổ trượt theo phút (sliding window RPM) của Gemini API; giúp người dùng không bị khóa oan cả phút khi chỉ vượt ngưỡng trong vài giây.
   - **Cho phép thử ngay `fallbackModel` (`gemini-3.8-flash`) trên cùng một khóa khi gặp `RATE_LIMIT_RPM`**: Rất hiệu quả trong thực tế vì hạn mức RPM của Google tách riêng cho từng model (`gemini-3.5-flash-lite` và `gemini-3.8-flash` có bộ đếm RPM độc lập trên cùng một GCP Project).

### 4.2. Hai rủi ro kỹ thuật trong cách cài đặt hiện tại ở `executor.ts:282–302`
Đoạn code hiện tại:
```ts
const canTryFallback =
  (classified.category === 'MODEL_UNAVAILABLE' || classified.category === 'RATE_LIMIT_RPM') &&
  !defaultModelUnavailable &&
  fallbackModel &&
  fallbackModel !== modelToUse &&
  nowFn() - requestStartMs < TOTAL_FAILOVER_TIME_BUDGET_MS;

if (canTryFallback) {
  defaultModelUnavailable = true;
  retrySameKeyWithFallback = true;
} else {
  this.allocator.recordFailure(lease.keyId, classified, nowFn(), options.disableJitter);
  if (classified.projectNumber) excludedProjectNumbers.add(classified.projectNumber);
}
```
Có **2 lỗ hổng logic** cần khắc phục ở Pha B (mà vẫn giữ nguyên 100% hành vi thử `fallbackModel` trên cùng key):
1. **Rủi ro 1 — Mất ghi nhận lỗi khi cả 2 model trên cùng Key A đều thất bại**:
   - Giả sử trên Key A: lượt 1 gọi `gemini-3.5-flash-lite` gặp `RATE_LIMIT_RPM` → nhánh `if (canTryFallback)` chạy, **bỏ qua `recordFailure`**, đặt `retrySameKeyWithFallback = true`.
   - Lượt 2 trên cùng Key A gọi `gemini-3.8-flash`:
     - Nếu lượt 2 **thành công**: `recordSuccess` chạy, nhưng Key A **không hề lưu vết** rằng model `gemini-3.5-flash-lite` của nó vừa chạm trần RPM! Hệ quả là request kế tiếp đến sau 1 giây lại chọn Key A và lại đâm đầu vào `gemini-3.5-flash-lite` (lặp lại lỗi 429 ở mọi request).
     - Ngược lại, nếu lượt 2 trên `gemini-3.8-flash` gặp `MODEL_UNAVAILABLE` (`503 high demand`), lúc này `canTryFallback` là `false` nên nó gọi `recordFailure(lease.keyId, MODEL_UNAVAILABLE)` → hàm `recordFailure` thấy `MODEL_UNAVAILABLE` nên **không phạt cooldown Key A**, khiến Key A thoát vòng lặp mà vẫn ở trạng thái `ready` dù đã hỏng cả 2 model!
2. **Rủi ro 2 — Cờ `defaultModelUnavailable` toàn cục làm "lây bệnh" sang Key B**:
   - Khi Key A dính `RATE_LIMIT_RPM` ở `gemini-3.5-flash-lite`, biến `defaultModelUnavailable` bị bật thành `true` cho toàn bộ request. Nếu sau đó `gemini-3.8-flash` trên Key A cũng lỗi và vòng lặp chuyển sang **Key B** (thuộc một GCP Project khác hoàn toàn khỏe mạnh), Key B bị ép bỏ qua `gemini-3.5-flash-lite` và chỉ được gọi `gemini-3.8-flash`.

### 4.3. Phương án khắc phục sạch ở Pha B (Không hoàn tác quyết định của người dùng)
- Thay biến `defaultModelUnavailable` toàn cục bằng:
  1. **Trạng thái cooldown theo từng model trên từng key (`key.modelCooldowns?: Record<string, number>`)**: Khi `(Key A, gemini-3.5-flash-lite)` gặp `RATE_LIMIT_RPM` (hoặc `MODEL_UNAVAILABLE`), ghi nhận `allocator.recordModelScopedCooldown(lease.keyId, modelToUse, classified, nowFn())` để tạm khóa riêng model `gemini-3.5-flash-lite` trên Key A (ví dụ `10–30s` với RPM, hoặc `15s` với `MODEL_UNAVAILABLE`), trong khi bản thân Key A vẫn giữ `status = 'ready'` để thử ngay `fallbackModel` (`gemini-3.8-flash`)!
  2. **Trong vòng lặp của mỗi Key `lease`**: Thử theo danh sách model khả dụng của riêng key đó `[defaultModel, fallbackModel]` (bỏ qua model nào đang nằm trong `key.modelCooldowns` chưa hết hạn). Nếu **cả 2 model** trên Key A đều thất bại vì lỗi quota/mạng, lúc đó mới hạ trạng thái của toàn bộ Key A xuống `cooldown`! Khi chuyển sang Key B (project khác), Key B vẫn bắt đầu từ `defaultModel` (`gemini-3.5-flash-lite`).

---

## 5. Danh Sách Công Việc Pha B Phải Thực Hiện (Theo Đúng Thứ Tự Thi Công)

1. **Bước 1 — Mở rộng kiểu dữ liệu (`server/key-pool/types.ts`)**:
   - Thêm trường tùy chọn `modelCooldowns?: Record<string, number>` vào `GeminiKeyRecord` để lưu mốc hết hạn nguội riêng theo tên model trên từng khóa.
   - Thêm phương thức `heartbeat: () => void` vào giao diện `KeyLease`.
   - Thêm cờ `continuedFromPartial?: boolean` vào `StreamExecutionMeta` để UI nhận biết khi bài luận đã được tự động nối tiếp hoàn chỉnh.
   - Tăng `LEASE_MAX_TTL_MS` cơ sở giữ `45_000ms` mỗi nhịp heartbeat, kèm trần tuyệt đối `LEASE_ABSOLUTE_MAX_TTL_MS = 120_000ms`.

2. **Bước 2 — Nâng cấp bộ phân loại lỗi, Cooldown theo Model & chấm điểm (`server/key-pool/allocator.ts`)**:
   - **Sửa Điểm (i)**: Tại `classifyGeminiError` (`allocator.ts:106–118`), bổ sung regex nhận diện đầy đủ lỗi `503 UNAVAILABLE` cấp model/gRPC: `/models\/[a-z0-9.-]+\s+is not found|not supported for generateContent|model is overloaded|currently unavailable|high demand|got status:\s*UNAVAILABLE|"status"\s*:\s*"UNAVAILABLE"|overloaded/i`.
   - **Tối ưu #1 (Cooldown theo cặp `Key, Model`)**: Bổ sung hàm `recordModelIssue(keyId, modelName, classified, now, disableJitter)`:
     - Nếu `classified.category === 'RATE_LIMIT_RPM'`: đặt `key.modelCooldowns[modelName] = now + cooldownMs` (`10–30s` hoặc `RetryInfo`), và lan truyền `modelCooldowns[modelName]` cho các key cùng `detectedProjectNumber` mà vẫn giữ `key.status = 'ready'` nếu `fallbackModel` trên key đó chưa bị khóa.
     - Nếu `classified.category === 'MODEL_UNAVAILABLE'`: không trừ `healthScore`, chỉ đặt `key.modelCooldowns[modelName] = now + 15_000` (15s) để các request kế tiếp trong 15s ưu tiên model/khóa không bị nghẽn.
   - **Tối ưu #3 (Chống `Probe Starvation` & làm mịn TTFB)**: Tại `acquireLease` (`allocator.ts:340–349`):
     - Nâng sàn điểm thăm dò `pendingProbe` từ `85` lên `95`: `const baseScore = key.pendingProbe ? Math.max(key.healthScore, 95) : key.healthScore;`.
     - Làm mịn phạt độ trễ: `const latencyPenalty = key.stats.avgLatencyMs ? Math.min(10, Math.floor(key.stats.avgLatencyMs / 250)) : 0;`.
     - Cho phép truyền `preferredModel` và `fallbackModel` vào `acquireLease`: ưu tiên khóa có `defaultModel` không nằm trong `modelCooldowns` (+8 điểm ưu tiên so với khóa chỉ còn `fallbackModel`), và loại bỏ khóa nếu **cả** `defaultModel` lẫn `fallbackModel` đều đang trong `modelCooldowns`.
   - **Tối ưu #5 (`KeyLease.heartbeat()`)**: Trong `acquireLease` (`allocator.ts:372–404`), cài đặt hàm `heartbeat()` làm mới `ttlTimer` thêm `45s` mỗi khi nhận chunk (không vượt quá `120s` kể từ lúc cấp lease).

3. **Bước 3 — Sửa lỗi cắt luồng giữa chừng & Tự động tiếp nối (Seamless Continuation) (`server/key-pool/executor.ts`)**:
   - **Xóa bỏ dòng cưỡng bức ghi đè lỗi** tại `executor.ts:259` (`category: classified.category === 'MODEL_UNAVAILABLE' ? 'NETWORK_OR_5XX' : classified.category`).
   - **Gọi `lease.heartbeat()`** mỗi khi nhận được chunk trong vòng lặp `for await (const chunk of stream)`.
   - **Cơ chế Tự động Tiếp Nối Luồng (`Seamless Stream Continuation`) khi lỗi xảy ra sau chunk đầu (`firstChunkSent === true`)**:
     - Lưu toàn bộ văn bản đã gửi xuống client trong biến `streamedTextSoFar`.
     - Nếu luồng bị ngắt giữa chừng (ví dụ ở mục 1,5 hoặc 2,5 do `503 MODEL_UNAVAILABLE`, `RATE_LIMIT_RPM` hoặc `NETWORK_OR_5XX`), chưa bị người dùng hủy (`!options.signal?.aborted`), số lần tiếp nối `continuationCount < 2` và tổng thời gian đã chạy `< TOTAL_FAILOVER_TIME_BUDGET_MS` (`35s`):
       - Ghi nhận lỗi đúng bản chất cho `(lease.keyId, modelToUse)` (không phạt oan key nếu là `MODEL_UNAVAILABLE`).
       - Tạo prompt tiếp nối (`buildContinuationPrompt(options.prompt, streamedTextSoFar)`) yêu cầu model viết **tiếp nối chính xác từ chữ cuối cùng đang viết dở** cho tới hết bài, tuyệt đối không lặp lại phần đầu.
       - Thử ngay với `fallbackModel` (`gemini-3.8-flash`) trên cùng `lease.keyId` (nếu khóa vẫn `ready`), hoặc lấy khóa khỏe tiếp theo từ `allocator.acquireLease()` để hoàn tất phần còn lại của bài luận trong cùng kết nối SSE!
   - **Nếu không thể tiếp nối (hết ngân sách 35s hoặc hết sạch khóa)**:
     - Không gửi thông báo gián đoạn giả dạng văn bản hoàn chỉnh mà gọi callback `options.onInterrupted?.(safeReason)` (hoặc ném lỗi có gắn cờ `partialTextSent = true`) để `server.ts` gửi sự kiện SSE tường minh `data: {"interrupted":true,"message":"..."}\n\n` kèm đoạn cảnh báo cuối luồng.
   - **Tối ưu #4 (Chuẩn hóa `PoolExhaustedError` cuối vòng lặp)**: Khi thất bại ngay từ trước chunk đầu tiên và sau vòng lặp không còn khóa nào `ready`, ném `PoolExhaustedError('AI_POOL_EXHAUSTED', ...)` kèm `minRemainingCooldownSec`.

4. **Bước 4 — Đồng bộ giao thức SSE gián đoạn tại `server.ts` & `src/components/InsightPanel.tsx`**:
   - Tại `server.ts` (`/api/interpret-period`, `/api/interpret`, `/api/heming`): khi luồng bị ngắt mà không thể tiếp nối hết bài, phát sự kiện `data: {"interrupted":true,"message":"..."}\n\n` trước `data: [DONE]\n\n`.
   - Tại `src/components/InsightPanel.tsx`:
     - Bắt cờ `parsed?.interrupted`: nếu `interrupted === true`, đánh dấu `incomplete: true` trong trạng thái hiển thị, **không hiện huy hiệu xanh "Đã lưu bộ nhớ đệm kỳ này"**, hiện cảnh báo rõ ràng để người dùng bấm thử lại, và không chặn các lần gọi lại tự động (`if (!forceRefresh && aiPeriodCache[pKey]?.text && !aiPeriodCache[pKey]?.incomplete)`).

5. **Bước 5 — Bổ sung kịch bản kiểm thử hồi quy (`scripts/verify-key-pool.ts`) & Kiểm chứng toàn diện**:
   - Thêm test kiểm chứng:
     1. Lỗi `503 got status: UNAVAILABLE` được phân loại đúng `MODEL_UNAVAILABLE` và **không** phạt điểm / **không** đưa key vào cooldown `NETWORK_OR_5XX`.
     2. Khi `gemini-3.5-flash-lite` bị ngắt giữa luồng (`firstChunkSent === true`) sau khi đã gửi 2 mục đầu, `executor` tự động chuyển sang `gemini-3.8-flash` gọi tiếp nối phần còn lại và ghép thành bài luận hoàn chỉnh trong cùng 1 request mà không lặp chữ và không phạt key.
     3. Cooldown theo cặp `(Key, Model)` khi gặp `RATE_LIMIT_RPM`: thử `fallbackModel` trên cùng Key A, nhớ trạng thái nghẽn của `defaultModel` trên Key A nhưng vẫn giữ `defaultModel` cho Key B.
     4. `KeyLease.heartbeat()` giữ đúng `inFlightCount` khi luồng kéo dài và `probeFloorScore = 95` + `latencyPenalty` mịn.
   - Chạy `npx tsx scripts/verify-key-pool.ts`, `compile_applet`, `lint_applet` và kiểm tra trực tiếp trên server.

---

## 6. ĐIỂM CÒN MỞ — `AbortError (code=20)` *(Chưa kết luận nguyên nhân gốc, chưa sửa `executor.ts` / `allocator.ts`)*

### 6.1. Bằng chứng ghi nhận qua kiểm chứng thực tế
- **Thông báo lỗi nguyên văn**: `"AbortError: This operation was aborted | code=20"`
- **Stack trace từ SDK**:
  - `node:internal/deps/undici/undici:15157`
  - → `runFetch` (`@google/genai/src/_api_client.ts:883`)
  - → `Models.generateContentStreamWithContinuation` (`@google/genai/src/models.ts:122`)
- **Các phiên xuất hiện**:
  1. **Đại Hạn 25–34 — Lần 1 (`23:36–23:37`)**: Sau một sự kiện `MODEL_UNAVAILABLE` trên `gemini-3.5-flash-lite` lúc `23:37:02`, **4 lượt thử liên tiếp** trên các khóa `#22`, `#23`, `#21`, `#22` (dạng che như `AIzaSy••••••qRpQ`) đều rơi vào `AbortError`.
  2. **Steve Jobs (Lưu Niên 2026) — Lần 2 (`23:50`)**: Gặp 2× `MODEL_UNAVAILABLE` (khóa `#22`, cả 2 model) rồi ngay sau đó 2× `AbortError` (khóa `#23`, `#21`).
  - Trong cả 2 trường hợp trên, cơ chế tiếp nối không cứu được luồng; các lần chạy thành công (`Đại Hạn lần 2`, `Lưu Niên 2027`) không xuất hiện `AbortError`.
- **Phân loại hiện tại**:
  - Trong `server/key-pool/allocator.ts:158`, chuỗi chứa `AbortError` bị phân loại vào `NETWORK_OR_5XX`, dẫn tới trừ `−10` điểm sức khỏe và làm nguội **`26–33 giây`** (`30s ± 15% jitter`).

### 6.2. Các giả thuyết chưa loại trừ
1. **Dùng lại / lan truyền `AbortController` hoặc timeout nội bộ trong `executor.ts`**: Khi `TOTAL_FAILOVER_TIME_BUDGET_MS` (`35s`) thu hẹp ở các lượt thử sau hoặc khi `attemptAbort.abort(...)` kích hoạt lúc `firstChunkTimeoutMs` cạn dần, `undici` ném `DOMException('This operation was aborted', 'AbortError')` (`code=20`); cần xác minh thêm liệu có trường hợp tín hiệu hủy ảnh hưởng giữa các lượt thử/tiếp nối hay không.
2. **SDK `@google/genai` tự hủy trong `generateContentStreamWithContinuation` / `createAttemptSignal`**: Lớp xử lý đa chặng (`StreamContinuation`) hoặc tín hiệu nội bộ của SDK tự hủy hop/stream khi luồng khựng hoặc mất nhịp phản hồi.
3. **Mạng thực tế / phía Google đóng kết nối hoặc timeout** làm `undici` hủy tác vụ dưới dạng `AbortError`.

### 6.3. Trạng thái xử lý
- **Kết luận hiện tại**: Nguyên nhân gốc **CHƯA được kết luận chắc chắn** (lượt chẩn đoán cho Việc D(b) dừng trước khi kịp tổng hợp kết luận).
- **Nguyên tắc thi công**: **KHÔNG sửa mò** vào `server/key-pool/executor.ts` hay `server/key-pool/allocator.ts`; giữ nguyên code hiện tại để chẩn đoán đầy đủ ở một lượt riêng có bằng chứng xác thực.

