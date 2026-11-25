# Phản biện vòng 2 — Brief 1.5.5 v1 (25/11/2026)

Vòng 1: Argon tại AI Studio, 10m01s, cả 3 nhóm X/Y/Z ĐỒNG Ý CÓ ĐIỀU KIỆN, 10 điều kiện ĐK-155-P1..P10, 3 rủi ro.
Vòng 2 (bản này): Muse kiểm chứng độc lập từng điểm của vòng 1 trên code src-v23, rồi chốt brief v2.

## Kết luận vòng 2: ĐỒNG Ý toàn bộ 10 điều kiện, với 3 hiệu chỉnh
1. **P7 — chọn nhánh thay thế, KHÔNG nới trần chat.** Argon đề xuất nới trần chat 13.100 → 13.450 (hoặc khóa không tăng compactMatrixMarkdown). Vòng 2 chọn nhánh thứ hai: trần chat giữ nguyên ≤ 13.100 (khóa cứng Saint chốt ở 1.5.4, panel không có quyền đổi). Căn cứ code: `dynamicStarsSummaryVi` chỉ dùng trong `compactMatrixMarkdown`, mà `compactMatrixMarkdown` được nhúng vào bảng chat (`buildChatFactTableForContextVi`); còn `periodCtxLabelDynStars` chỉ dùng trong `detailLines` (dòng (7), cả chương 7 và 8). Vì vậy Y6b chỉ sửa `periodCtxLabelDynStars`, giữ `dynamicStarsSummaryVi` dạng chi-only. Dossier xuất ra (dùng `factSheetMarkdown` = compactMatrix + detailLines) vẫn được đủ Can Chi ở dòng (7); bảng chat không tăng ký tự nào.
2. **Y6a — chuyển từ sửa code sang quy tắc prompt.** Vòng 2 kiểm chứng: dòng (6) Bộ Lưu Tứ Hóa trong `detailLines` ĐÃ CÓ SẴN đối cung xung chiếu cho cả 4 hóa (dossier-context.ts, hàm dựng `detailLines`). Lỗi chương 7 là model bỏ sót khi viết (chương 8 viết đủ vì được nạp thêm `compactMatrixMarkdown` làm mẫu). Vì vậy Y6a thành quy tắc trong prompt horizon (bắt buộc mẫu `(xung Cung Lưu ...)` cho 4 hóa từng năm), không sửa code dòng (6).
3. **Z5 — ngữ nghĩa nghiêm ngặt theo câu, không "thẻ cuối đoạn bao cả đoạn".** Vòng 2 sửa lại ca kiểm Z5c của v1 (v1 viết mâu thuẫn: vừa muốn V2 theo câu vừa muốn thẻ cuối đoạn bao được câu trước — như vậy lỗ hổng B-04 sẽ không bao giờ bị bắt). Ngữ nghĩa chốt: câu có M1/M2 phải có thẻ `[Nguồn: ID]` hợp lệ trong chính câu đó; P10 đổi hướng dẫn prompt sang "ngay cuối câu có viện dẫn hoặc trích dẫn đó" để model sinh đúng từ đầu. Các ca K1/K2/K3 hiện tại có khối 2 câu với 1 thẻ cuối đoạn được phép cập nhật kỳ vọng (danh sách trắng mục 8).

## Bảng kiểm chứng các điểm của vòng 1

| Điểm | Vòng 1 nói | Vòng 2 kiểm chứng |
|---|---|---|
| X1 khớp code 100% | 3 tiêu đề `.ts` trong buildStrictPeriodAiPrompt | ĐỒNG Ý — đã kiểm chứng ở vòng trước (server.ts, 3 dòng) |
| X2 gãy X2d/K3-A[5] nếu cắt `,` trước `·`/`\|` | Hậu tố chú thích + dấu phẩy trong chú thích | ĐỒNG Ý — K3-A[5] `[Nguồn: NH-WRONG-1 \| video 2]` có thật (verify-knowledge-base.ts); regex hiện tại nuốt phần sau `·` vào nhóm chú thích |
| X2 scrub client lệch server | Client gọi scrubInvalidCitationTags độc lập sau SSE | ĐỒNG Ý — modal gọi scrub tại :654, không dùng audit.scrubbedText |
| X3 xóa oan tham chiếu hợp lệ | ID vừa pass V3 ở đoạn A vừa fail V3 ở đoạn B | ĐỒNG Ý về cơ chế; ĐỒNG Ý giữ X3 như brief v1 (đơn giản, nhất quán thân bài ↔ mục 📚), panel cũng kết luận vậy |
| Y1 giữ `${layerTag} ${prefix}` | formatPeriodSiHuaFactLine dùng chung Lưu/Đại Hạn | ĐỒNG Ý — đã kiểm chứng code |
| Y2 chỉ sửa nhánh Lưu Niên | periodTitleVi có 2 nhánh dahan/liunian | ĐỒNG Ý — 2 lệnh gán riêng biệt đã kiểm chứng |
| Y4/Y5 an toàn | alias 'Mệnh' đã có sẵn trong chuẩn hóa tiêu đề | ĐỒNG Ý (không kiểm chứng sâu thêm; rủi ro thấp, có test hồi quy) |
| Y6 thiếu periodCtxLabelDynStars | Helper dùng cho dòng (7) cả ch.7 và ch.8 | ĐỒNG Ý — hàm tồn tại, dùng `(${natalPalaceNameVi} - ${branchVi})` thiếu Can |
| Y6 trần horizon hợp lý | Đo thực nghiệm: 5y 13.214→13.625; 10y 35.753→36.979 | ĐỒNG Ý về hướng; số đo tuyệt đối chưa chạy lại độc lập (sẽ đo ở ĐK-155-04 lúc thi công) |
| Y6 chat +256 → 13.088/13.100 | buildChatFactTableForContextVi nhúng compactMatrixMarkdown | ĐỒNG Ý về cơ chế (đã kiểm chứng dòng nhúng); số +256 chưa chạy lại độc lập — nhưng v2 tránh hẳn rủi ro bằng cách không đụng compactMatrix |
| Z2 hardcode 1977 | System prompt dùng chung mọi lá số | ĐỒNG Ý — v2 viết tổng quát + ghi rõ chuỗi mẫu chỉ là giá trị ví dụ |
| Z3 12/14 cặp an toàn | Bảo Ninh (địa danh), HOÁ trong tiêu đề in hoa, thứ tự alternation | ĐỒNG Ý — cả 3 đều là cạm bẫy thật |
| Z3 đủ 100% lỗi vòng 2 | 7 từ C-05, 2 từ C-04, 1 từ C-01/C-02, 4 nhãn C-03, 2 lỗi C-06 | ĐỒNG Ý |
| Z5 FP#1 xung đột prompt | Prompt dặn "gắn thẻ ở cuối đoạn" | ĐỒNG Ý — wording có thật ở server.ts (period + dossier, 2 chỗ) |
| Z5 FP#2 tách câu thô | Dấu chấm trong 1. / 1.2 / school-data.ts | ĐỒNG Ý — V2 hiện chạy trên blockWithoutTags (đã xóa thẻ); tách câu phải làm trên block thô |
| Z5 FP#3 câu bối cảnh M1 | AUTHORITY_M1_REGEX khớp mọi câu nhắc tên trường phái | ĐỒNG Ý về cơ chế; mức độ FP không tệ hơn thiết kế V2 hiện tại (cũng bắt ở mức khối) |
| C-06.3 bị v1 bỏ sót | Lặp tiêu đề ch.7/8 + lệch cấp #### | ĐỒNG Ý — v1 đúng là chỉ xử lý 3/4 mục của C-06; v2 bổ sung |
| ĐK-155 đo được | Cả 6 điều kiện rõ ràng | ĐỒNG Ý, với ĐK-155-04 giữ trần chat 13.100 (hiệu chỉnh P7) |

## Phán quyết vòng 2 theo nhóm
- Nhóm X: ĐỒNG Ý CÓ ĐIỀU KIỆN (P1, P2, P3) — đã đưa vào v2.
- Nhóm Y: ĐỒNG Ý CÓ ĐIỀU KIỆN (P4, P5, P6, P7-theo-nhánh-thay-thế) — đã đưa vào v2.
- Nhóm Z: ĐỒNG Ý CÓ ĐIỀU KIỆN (P8, P9, P10) — đã đưa vào v2.

## Brief v2
File: `~/workspace/ziwei-kb-distill/work/BRIEF-1.5.5-v2.md` — v1 + toàn bộ P1..P10 + 3 hiệu chỉnh vòng 2 (P7 nhánh thay thế; Y6a prompt-level; Z5 nghiêm ngặt theo câu) + ca kiểm mới X2e–X2h, Y6d, Z5a–Z5d + danh sách trắng mở rộng (mục 8–10).
