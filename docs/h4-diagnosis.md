# BIÊN BẢN CHẨN ĐOÁN H4 THU HẸP TRÊN CODE HIỆN HÀNH (`docs/h4-diagnosis.md`)

- **Loại tài liệu**: `[Báo cáo Chẩn đoán Kỹ thuật — ĐÃ THI CÔNG & ĐẠT KIỂM CHỨNG]`
- **Trạng thái hiệu lực**: `ĐÃ THI CÔNG & ĐẠT TEST 18 (18/18) — ĐANG HIỆU LỰC (ACTIVE)`
- **Áp dụng cho phiên bản ứng dụng**: `1.1.0-rc.1` *(đồng bộ với `/VERSION`)*
- **Cập nhật lần cuối**: `17/11/2026` *(đã thi công Pha 0 thu hẹp `QĐ-H4`)*
- **Mã nguồn đối chiếu (Code SSOT)**: `server/key-pool/allocator.ts`, `server/key-pool/executor.ts`, `scripts/verify-key-pool.ts`
- **Quyết định liên quan**: `QĐ-H4` *(xem `docs/decisions-registry.md` & `docs/key-pool-operations.md`)*
- **Phạm vi**: Chẩn đoán thực nghiệm trên mã nguồn hiện hành đối với 2 điểm thuộc quyết định **H4 (`B-05 / NV-01` và `B-01`)**, đính chính các trích dẫn sai của Bản rà soát V2 (`docs/logic-code-audit-v2.md`), áp dụng bản sửa tối thiểu cho 2 điểm **CÓ THẬT** và hoàn tất kiểm chứng tự động `TEST 18` (`18/18 ĐẠT`).

---

## 1. ĐÍNH CHÍNH CÁC TRÍCH DẪN SAI CỦA BẢN V2 SO VỚI CODE HIỆN HÀNH

Khi đối chiếu bằng `grep` và đọc trực tiếp toàn bộ `server/key-pool/executor.ts` (`450` dòng) cùng `server/key-pool/allocator.ts` (`897` dòng), xác nhận Bản rà soát V2 (`docs/logic-code-audit-v2.md`, mục `B-05` và `B-01`) đã trích dẫn tên biến và số dòng của cấu trúc cũ không còn tồn tại:

| Chi tiết trích dẫn trong V2 | Thực tế trên code hiện hành (`server/key-pool/*`) |
|---|---|
| Nêu tên biến `timedOutWaitingFirstChunk` tại `executor.ts:72, 92` | **KHÔNG TỒN TẠI** (`grep` toàn cây = 0). Bộ hẹn giờ chunk đầu hiện nằm tại **`server/key-pool/executor.ts:232–241`**, dùng biến `attemptSentAnyChunk` (`dòng 221`) và gọi `attemptAbort.abort(new Error('FIRST_CHUNK_TIMEOUT'))` (`dòng 239`). |
| Nêu tên biến `receivedFirstChunk` tại `executor.ts:157` | **KHÔNG TỒN TẠI** (`grep` toàn cây = 0). Code hiện hành dùng 2 biến: `firstChunkEverSent` (`executor.ts:157`, cấp toàn request) và `attemptSentAnyChunk` (`executor.ts:221`, cấp từng lượt gọi model). |
| Nêu tên hàm `markFailed(selection.keyId, 'NETWORK_OR_5XX')` tại `allocator.ts:227–233` | **KHÔNG TỒN TẠI**. Trên code hiện hành, hàm phạt khóa là **`this.allocator.recordFailure(lease.keyId, classified, nowFn(), options.disableJitter)`** được gọi tại **`executor.ts:336–341`** và định nghĩa tại **`allocator.ts:684–824`**. |
| Cho rằng `AbortError` (`code = 20`) không khớp regex ở `allocator.ts:158` nên rơi xuống nhánh mặc định cuối hàm | **SAI CƠ CHẾ**: Tại **`server/key-pool/allocator.ts:158`** (trước khi sửa ở Pha 0), biểu thức chính quy của nhánh 4 (`NETWORK_OR_5XX`) **đã viết tường minh `...|TimeoutError|AbortError|FIRST_CHUNK_TIMEOUT/i`**, còn nhánh mặc định cuối hàm (`dòng 170–175`) trả về `'UNKNOWN'` chứ không phải `'NETWORK_OR_5XX'`. |

---

## 2. CHẨN ĐOÁN ĐIỂM 1 (`NV-01` / `B-05`): `AbortError` / `FIRST_CHUNK_TIMEOUT` CÓ BỊ XẾP VÀO `NETWORK_OR_5XX` VÀ PHẠT KEY KHÔNG?

### 2.1. Kết luận chẩn đoán Điểm 1
- **Kết luận**: **CÓ THẬT 100%** (dù tên biến trong V2 sai, nhưng **hiện tượng kỹ thuật và hậu quả phạt oan key là CÓ THẬT trên code hiện hành**).

### 2.2. Truy vết đường đi thực tế trên code hiện hành (Trước khi sửa ở Pha 0)
1. **Bộ hẹn giờ chunk đầu & ngân sách 35s (`server/key-pool/executor.ts:228–241`)**:
   - Dòng `232–236`:
     ```ts
     const remainingTotalMs = Math.max(
       1000,
       TOTAL_FAILOVER_TIME_BUDGET_MS - (nowFn() - requestStartMs),
     );
     const firstChunkTimeoutMs = Math.min(FIRST_CHUNK_TIMEOUT_MS, remainingTotalMs);
     ```
   - Dòng `237–241`:
     ```ts
     let timeoutHandle: ReturnType<typeof setTimeout> | null = setTimeout(() => {
       if (!attemptSentAnyChunk) {
         attemptAbort.abort(new Error('FIRST_CHUNK_TIMEOUT'));
       }
     }, firstChunkTimeoutMs);
     ```
   - Khi hết `firstChunkTimeoutMs` (`12.000ms` hoặc bị thu hẹp xuống `remainingTotalMs` từ `1.000ms..12.000ms` ở cuối ngân sách `35s`) mà chưa nhận được chunk đầu tiên, app chủ động gọi `attemptAbort.abort(new Error('FIRST_CHUNK_TIMEOUT'))`.
   - SDK `@google/genai` / `fetch` của Node.js ném ra `DOMException [AbortError]: This operation was aborted` (có `name = 'AbortError'`, `code = 20`) hoặc `Error('FIRST_CHUNK_TIMEOUT')`.
2. **Khối `catch (err)` (`server/key-pool/executor.ts:305–350`)**:
   - Dòng `311–313`: Kiểm tra `if (options.signal?.aborted)` (chỉ đúng khi client/người dùng chủ động hủy request từ bên ngoài). Với timeout chunk đầu nội bộ (`attemptAbort`), `options.signal?.aborted` là `false`.
   - Dòng `315`: Gọi `const classified = classifyGeminiError(err, this.getRawKeysById().values());`.
3. **Hàm phân loại `classifyGeminiError` (`server/key-pool/allocator.ts:63–176`)**:
   - Dòng `27–35` (`collectErrorText`): Biến `DOMException` thành chuỗi `"AbortError: This operation was aborted | code=20 | ..."`.
   - Dòng `83–88`: Đọc `anyErr.code` = `20` (`numericStatus = 20`).
   - Dòng `156–168` (Nhánh 4 — Lỗi 5xx hoặc mạng / timeout):
     ```ts
     /\b(?:500|502|503|504)\b|ECONNRESET|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|fetch failed|TimeoutError|AbortError|FIRST_CHUNK_TIMEOUT/i.test(normalizedText)
     ```
     Vì chuỗi chứa `AbortError` (hoặc `FIRST_CHUNK_TIMEOUT`), hàm trả về **`category: 'NETWORK_OR_5XX'`**.
4. **Phạt điểm và giam khóa (`executor.ts:319–341` → `allocator.ts:684–785`)**:
   - Tại `executor.ts:319–341`: Chỉ có `'MODEL_UNAVAILABLE'` và `'RATE_LIMIT_RPM'` được đi vào `recordModelIssue` (`dòng 320–334`). Vì `classified.category === 'NETWORK_OR_5XX'`, code rơi vào nhánh `else` tại **`executor.ts:335–341`** và gọi `this.allocator.recordFailure(lease.keyId, classified, nowFn(), options.disableJitter)`.
   - Tại `allocator.ts:740–775` (`recordFailure`):
     - `computeCooldownDurationMs('NETWORK_OR_5XX', ...)` (`allocator.ts:262–266`) trả về **`30_000` ms (`30 giây`)**.
     - `scorePenaltyMap['NETWORK_OR_5XX']` (`allocator.ts:751`) = **`10`** → `key.healthScore` bị **trừ `-10` điểm** (`100 -> 90`, sàn `20` tại dòng `761, 771`).
     - `key.status` bị chuyển từ `'ready'` sang **`'cooldown'` suốt 30 giây** (`dòng 772–774`).

### 2.3. Cách sửa tối thiểu đã áp dụng cho Điểm 1
- Tại **`server/key-pool/allocator.ts:107–120` và `155–168`**:
  - Chuyển `\bAbortError\b|FIRST_CHUNK_TIMEOUT|This operation was aborted|The operation was aborted` từ Nhánh 4 (`NETWORK_OR_5XX`, dòng `158`) lên Nhánh 2 (`MODEL_UNAVAILABLE`, dòng `110`).
  - Giữ nguyên toàn bộ xử lý cho `503 MODEL_UNAVAILABLE` (`got status: UNAVAILABLE`, `high demand`, `overloaded`, `404`) và giữ nguyên xử lý `NETWORK_OR_5XX` cho các lỗi mạng/5xx thật (`500`, `502`, `503` khác, `504`, `ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`, `ECONNREFUSED`, `fetch failed`, `TimeoutError`).
- **Hiệu quả**: Khi `attemptAbort.abort(...)` kích hoạt do quá hạn chờ chunk đầu hoặc cạn ngân sách 35s, `classifyGeminiError` trả về `'MODEL_UNAVAILABLE'` (`penalty = 0`, `key cooldown = null`). `executor.ts:320` gọi `recordModelIssue` để chuyển ngay sang model dự phòng (`gemini-3.8-flash`) hoặc khóa kế tiếp mà **bảo toàn `100` điểm sức khỏe và giữ khóa ở trạng thái `'ready'`**.

---

## 3. CHẨN ĐOÁN ĐIỂM 2 (`B-01` / `B-05` PHẦN 2): THÔNG BÁO GIÁN ĐOẠN CÓ BỊ HIỂN THỊ TRÙNG HAI LẦN TRÊN CODE HIỆN HÀNH KHÔNG?

### 3.1. Kết luận chẩn đoán Điểm 2
- **Kết luận**: **CÓ THẬT 100%**.

### 3.2. Bằng chứng `file:dòng` và nguyên văn câu chữ ở cả hai phía (Trước khi sửa ở Pha 0)
1. **Phía Server (`server/key-pool/executor.ts`) — Bơm câu cảnh báo trực tiếp vào luồng văn bản `onChunk` tại 2 vị trí**:
   - **Vị trí 1 (`server/key-pool/executor.ts:364–371` — nhánh `!canContinue` bên trong `catch`)**:
     ```ts
     options.onChunk(
       '\n\n*(Luồng kết nối bị gián đoạn giữa chừng — vui lòng bấm luận giải lại để nhận bản đầy đủ.)*',
     );
     options.onInterrupted?.({
       reason: reasonText,
       errorCategory: classified.category,
       partialLength: streamedTextSoFar.length,
     });
     ```
   - **Vị trí 2 (`server/key-pool/executor.ts:408–415` — nhánh `if (firstChunkEverSent)` ở cuối `executeStream` khi hết lượt thử nối tiếp)**:
     ```ts
     options.onChunk(
       '\n\n*(Luồng kết nối bị gián đoạn giữa chừng — vui lòng bấm luận giải lại để nhận bản đầy đủ.)*',
     );
     options.onInterrupted?.({
       reason: reasonText,
       errorCategory: lastClassifiedError?.category ?? 'UNKNOWN',
       partialLength: streamedTextSoFar.length,
     });
     ```
2. **Phía Client (`src/components/InsightPanel.tsx`, `src/components/DetailedDossierModal.tsx`, `src/components/ContextualChatDrawer.tsx`) — Nối thêm câu cảnh báo thứ hai hoặc hiển thị hộp cảnh báo riêng khi nhận `onInterrupted`**:
   - **Tại `src/components/InsightPanel.tsx:431–436`** (luồng `/api/interpret` cho cung/chủ đề):
     Khi `wasInterrupted === true`, biến `accumulated` đã chứa sẵn câu `\n\n*(Luồng kết nối bị gián đoạn giữa chừng — vui lòng bấm luận giải lại để nhận bản đầy đủ.)*` từ `onChunk`, sau đó dòng `435` lại nối tiếp câu thứ hai:
     ```ts
     [cacheKey]: `${accumulated}\n\n> *Lưu ý: Luồng phản hồi AI bị gián đoạn giữa chừng (chưa lưu bộ nhớ đệm hoàn chỉnh). Bấm "Làm mới" hoặc chọn lại cung để tải lại.*`,
     ```
   - **Tại `src/components/InsightPanel.tsx:577–584`** (luồng hỏi đáp `/api/interpret`):
     Biến `acc` đã chứa câu cảnh báo từ `onChunk`, sau đó dòng `581` lại nối tiếp câu thứ hai:
     ```ts
     ? { q, a: `${acc}\n\n> *(Kết nối bị gián đoạn giữa chừng — vui lòng hỏi lại nếu cần xem đầy đủ)*` }
     ```
   - **Tại `src/components/InsightPanel.tsx:282–295` & `847–901`** (luồng `/api/interpret-period` cho Đại Hạn / Lưu Niên) và **`src/components/DetailedDossierModal.tsx:515–548` & `1213–1266`** (luồng `/api/interpret-dossier-section` cho Hồ Sơ 8 Chương):
     Khi nhận sự kiện `interrupted`, UI đã render hộp cảnh báo màu vàng hiển thị `interruptedReason` (`dòng 847–886` ở `InsightPanel.tsx` và `dòng 1216–1257` ở `DetailedDossierModal.tsx`), nhưng bên trong hộp `"Phần nội dung đã nhận trước khi gián đoạn:"` (`incompleteText` tại `InsightPanel.tsx:900` và `DetailedDossierModal.tsx:1264`) lại bị dính thêm dòng chữ nghiêng `*(Luồng kết nối bị gián đoạn giữa chừng — vui lòng bấm luận giải lại để nhận bản đầy đủ.)*` ở cuối văn bản AI dở dang.

### 3.3. Cách sửa tối thiểu đã áp dụng cho Điểm 2
- Khử trùng tại **một phía duy nhất** (`server/key-pool/executor.ts`):
  - Xóa 2 lệnh `options.onChunk('\n\n*(Luồng kết nối bị gián đoạn giữa chừng — vui lòng bấm luận giải lại để nhận bản đầy đủ.)*');` tại **`server/key-pool/executor.ts:364–366`** và **`server/key-pool/executor.ts:408–410`**.
  - Giữ nguyên 100% lệnh gọi `options.onInterrupted?.(...)` ngay bên dưới để thông báo gián đoạn chỉ đi qua đúng kênh sự kiện `interrupted` duy nhất, giữ cho `onChunk` / `incompleteText` chỉ chứa văn bản AI thuần túy.

---

## 4. KẾT QUẢ THI CÔNG & KIỂM CHỨNG (`NV-01` & HỒI QUY H4 — `1.1.0-rc.1`)

- **Trạng thái**: **ĐÃ THI CÔNG XONG PHA 0 THU HẸP (`QĐ-H4`) & ĐẠT 100% KIỂM THỬ**.

Đã bổ sung **Bài 18 (`[18/18]`)** vào `scripts/verify-key-pool.ts` (`dòng 1149–1286`) và chạy kiểm chứng:
1. **`npx tsc --noEmit`**: **0 lỗi**.
2. **`npx tsx scripts/verify-key-pool.ts`**: **ĐẠT 18/18 bài** (bao gồm bài 18a kiểm thử `DOMException('This operation was aborted', 'AbortError')` & `Error('FIRST_CHUNK_TIMEOUT')` qua `classifyGeminiError` trả về `MODEL_UNAVAILABLE` với 0 điểm phạt; bài 18b kiểm thử `executeStream` tự chuyển sang `gemini-3.8-flash` khi abort chunk đầu mà giữ nguyên `status = 'ready'` và `healthScore = 100`; bài 18c kiểm thử cả 2 nhánh gián đoạn đều chỉ phát `onInterrupted` 1 lần và không bơm câu cảnh báo trùng vào `onChunk`).
