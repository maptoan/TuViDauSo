# PHẢN BIỆN VÒNG 2 (Muse) — Kế hoạch Fast-Sweep xử lý lỗi 0..3 khi sinh tự động hồ sơ

Kết luận: ĐẠT CÓ ĐIỀU KIỆN — thi công sau khi Saint chốt QĐ-F1..F4 (Saint đã duyệt cả 4 ngày 19/11/2026).

## A. Phần panel nói đúng (đã kiểm chứng trên code Current 1.4.0-rc.1)
- Chuỗi domino 7 bước khớp code: executor.ts vòng ngoài theo MAX_KEY_ATTEMPTS=5; cuối executeStream chỉ ném PoolExhaustedError khi remainingUsable===0, còn lại throw Error thường; server.ts (834/960/1086) trượt nhánh 503 → console.warn stderr + SSE 200 AI_CALL_FAILED; DetailedDossierModal xếp 'incomplete' kể cả khi accumulated rỗng; handleRunAllSequential chỉ break khi 'aborted'.
- Phân loại 3 lỗi cố định đủ đặc hiệu: QUOTA_PROJECT_ZERO đòi mẫu quota_limit_value=0; QUOTA_DAILY_EXHAUSTED đòi dấu PerDay/RPD; AUTH_INVALID_KEY đòi dấu API_KEY_INVALID/PERMISSION_DENIED/leaked/expired.
- Trần quét 50 = MAX_KEYS_IN_POOL có sẵn (types.ts:190) = quét toàn kho.
- verify-key-pool.ts hiện có đúng 18 bài, baseline 18/18 đạt.

## B. Phát hiện vòng 2
- FS2-01 (Cao): Chuẩn hóa PoolExhaustedError vô điều kiện sẽ nuốt lỗi UNKNOWN phía request (vd 400) thành 503 sai bản chất. Siết: chỉ chuẩn hóa khi remainingUsable===0, hoặc ngân sách 35s đã cạn, hoặc category lỗi cuối thuộc {QUOTA_PROJECT_ZERO, QUOTA_DAILY_EXHAUSTED, RATE_LIMIT_RPM, AUTH_INVALID_KEY, MODEL_UNAVAILABLE, NETWORK_OR_5XX}; UNKNOWN giữ throw Error thường.
- FS2-02 (Cao): Đếm lượt quét theo LƯỢT GỌI API, không theo số khóa bị cooldown, vì recordFailure lan truyền cooldown sang khóa cùng project (E3-01) — 1 lượt gọi có thể dọn nhiều khóa.
- FS2-03 (TB): Cầu chì run-all break khi 'error'/'aborted'; các chương chưa chạy giữ nguyên trạng thái; 'incomplete' (có chữ dở) không break.
- FS2-04 (TB): Cổng hồi quy phủ cả 5 route dùng chung executor; Bài 19 thêm nhánh khóa chết phản hồi chậm để chứng minh trần 35s thắng trần 50 khóa.
- FS2-05 (Thấp): Ghi kế hoạch thành file trước khi thi công (Bước 0 của prompt này); phân loại quét chỉ theo category, không theo thời gian phản hồi.
- FS2-06 (Thấp): Saint gỡ ràng buộc "không đụng server/key-pool/*" cho executor.ts + allocator.ts; giữ nguyên 4 hằng số types.ts (MAX_KEY_ATTEMPTS=5, ngân sách 35.000ms, FIRST_CHUNK 12.000ms, MAX_KEYS_IN_POOL=50).
- FS2-07 (Ghi nhận, ngoài phạm vi): gốc rễ import khóa không dò quota — không làm đợt này.

## C. Quyết định đã duyệt
QĐ-F1 Fast-Sweep + siết FS2-01/FS2-02; QĐ-F2 gỡ ràng buộc 2 file key-pool; QĐ-F3 ghi docs + lên 1.4.0-rc.2; QĐ-F4 cổng nghiệm thu Bài 19 mở rộng + verify:all.
