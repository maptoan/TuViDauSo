# Phản biện vòng 2 — Hồ sơ sinh lại toàn bộ 1.5.4 (25/11/2026)

Hồ sơ: `your_files/la-so-do-vu-toan/Ho-So-Tu-Vi-Do-Vu-Toan-8-8-sinh-lai-toan-bo-1.5.4.md` (98.220 byte, 8/8 chương, sinh 11:14–11:16 25/11/2026, toàn bộ bằng gemini-3.5-flash-lite).
Vòng 1: Argon tại AI Studio, 5m58s, 20 mã phát hiện (7 nghiêm trọng / 9 trung bình / 4 nhỏ).
Vòng 2 (bản này): Muse kiểm chứng độc lập từng phát hiện của vòng 1 trên file hồ sơ thật + code src-v23.

## Kết luận vòng 2
- **Đồng ý 19/20 mã** của vòng 1 (đúng thực chất; xem bảng dưới).
- **Bác 0 mã**, nhưng **hạ mức 1 mã**: A-05 từ "nhỏ" giữ nguyên nhỏ — không hạ. Thực tế: không mã nào bị bác; chỉ có chi tiết phụ trong 4 mã bị sai (xem "Lỗi của chính vòng 1").
- **Bổ sung 0 mã mới** ngoài vòng 1 (mọi lỗi ngôn ngữ vòng 2 tự tìm trước đó đều đã nằm trong vòng 1).
- Engine an sao/Tứ Hóa: **0 lỗi** — mọi tứ hóa theo can (Đinh/Canh/Kỷ/Bính/Đinh/Mậu/Kỷ/Canh/Tân/Nhâm/Quý/Giáp/Ất) đối chiếu tay đều đúng; "Canh Ngọ" 0 lần; cả 8 mã trích dẫn có thật trong CSDL.

## Bảng kiểm chứng vòng 1 (mã — vòng 2)

| Mã | Nội dung | Vòng 2 |
|---|---|---|
| A-01 | Ch.5 §1 nhầm Lưu Quan Lộc thay Lưu Mệnh (trùng Tài Bạch thay Quan Lộc Bính Ngọ) | ĐỒNG Ý — trích dẫn khớp file dòng 203; mâu thuẫn với §2 và Kết Luận Nhanh. Cơ chế: titleVi yunxian-context.ts:370 (vòng 1 ghi :390, sai số dòng) "Kích hoạt cung ${...}" mơ hồ |
| A-02 | Ch.5 §2 đảo [Bản mệnh Hóa Quyền/Khoa] sang đối cung xung chiếu | ĐỒNG Ý — trích dẫn khớp file. Cơ chế ĐÚNG 100%: formatPeriodSiHuaFactLine (yunxian-context.ts:171–177) đặt `· [natalMutagen]` SAU cụm đối cung xung chiếu |
| A-03 | Ch.5 dòng Lưu Hóa Khoa thiếu tên Văn Xương; lẫn Văn Xương bản mệnh/Lưu Văn Xương | ĐỒNG Ý — trích dẫn khớp file dòng 210/212. Vị trí Lưu Văn Xương 2026 tại Thân chưa kiểm chứng độc lập (cần engine), nhưng điểm lẫn lộn là thật |
| A-04 | Gọi Địa Không + Thiên Không là "Bộ Không Kiếp" | ĐỒNG Ý — 3 vị trí (dòng 75, 79, 218; vòng 1 ghi 219, lệch 1). Địa Kiếp ở Phúc Đức, không đồng cung/tam hợp với Quan Lộc |
| A-05 | "Dương Đà giáp Lộc"/"Kình Dương đơn thủ" tại Lưu Mệnh 2027 | ĐỒNG Ý về bản chất — cơ chế: nhãn tĩnh yunxian-context.ts:637 (vòng 1 ghi :624). Lưu ý: vòng 1 viết "Liêm Trinh [Bình]" là SAI, đúng là [Lợi] |
| A-06 | Bỏ sót dòng Tứ Hóa Đại Hạn kỳ riêng ở 6/8 cung ch.2–3 | ĐỒNG Ý — kiểm đếm trên file: ch.2 Mệnh + Tài Bạch thiếu; ch.3 cả 4 thiếu; ch.2 Quan/Di và ch.4 cả 4 có đủ. Cơ chế: quy tắc server.ts:429 chỉ dặn dạng điều kiện (vòng 1 ghi :397) |
| B-01 | Thẻ [Nguồn: school-data.ts / constants.ts] lọt ra hồ sơ | ĐỒNG Ý — trích dẫn khớp file dòng 206. Cơ chế ĐÚNG 100%: prompt server.ts:237/240/243 chứa tên file .ts; regex CITATION_TAG_SCAN_RE (text-sanitizer.ts:103) và CITATION_TAG_M3_REGEX (verifier.ts:21, vòng 1 ghi :23) không khớp dấu `.` và `/` nên thẻ lọt |
| B-02 | Thẻ gộp [Nguồn: CL-TT-015, CL-CTP-013], CL-CTP-013 mất khỏi mục 📚 | ĐỒNG Ý về cơ chế — regex chỉ capture ID đầu, phần `, CL-CTP-013` bị nuốt vào nhóm `(?:\s*[·,|]\s*[^\]]+)?`. NHƯNG chi tiết "mục 📚 còn liệt kê [NH-PAT-001]" là SAI: NH-PAT-001 xuất hiện 0 lần trong file; mục 📚 ch.1 chỉ có CL-TT-015 |
| B-03 | Ch.4 thân bài 0 thẻ [Nguồn:] nhưng cuối chương vẫn in 📚 [NH-PAL-014-GEN] | ĐỒNG Ý — đếm trên file: thân bài ch.4 có 0 thẻ thật (1 lần chữ "Nguồn:" duy nhất nằm trong chính câu cảnh báo ⚠️). Cơ chế ĐÚNG: verifier.ts:378–490 — validIdsInOrder giữ ID, scrubbedInvalidIds = V1 ∪ V3, scrub xóa toàn cục nhưng reference block vẫn in validIdsInOrder; modal gọi scrub tại DetailedDossierModal.tsx:654 (vòng 1 ghi :669) |
| B-04 | Câu phú không thẻ; NH-SIHUA-006 gán lệch ngữ cảnh ch.8 | ĐỒNG Ý về hiện tượng. Cơ chế: V2 chỉ kích hoạt khi khối 0 thẻ hợp lệ (verifier.ts:436 `if ((hasM1 \|\| hasM2) && validTagsInBlock === 0)`) — đúng nguyên tắc vòng 1 mô tả, NHƯNG tên hàm `checkParagraphV2UncitedAcademicClaim` không tồn tại trong code và số dòng :132 sai; M2 regex thực tế là 12..120 ký tự (verifier.ts:19), không phải 24..220 như vòng 1 ghi |
| C-01 | "Thứ secondNumber" | ĐỒNG Ý — dòng 48 |
| C-02 | Tiêu đề "Thân Cuv" | ĐỒNG Ý — dòng 28 |
| C-03 | [excellent] ×3 | ĐỒNG Ý — cơ chế ĐÚNG 100%: dossier-context.ts:327 nối trực tiếp `pat.level` chưa dịch |
| C-04 | "Venh Khúc", "khiâm đau" | ĐỒNG Ý — dòng 185, 189 |
| C-05 | Từ sai: "đồng điệu mật khẩu", "tránh dùng tôi tớ", "hoa tụ", "bề vững", "thế Mạnh", "danh uy uy tín", "bảo ninh" | ĐỒNG Ý — cả 7 vị trí khớp file (vòng 1 liệt kê 5+2; thực tế đếm được 7 chỗ) |
| C-06 | "### Cung Mệnh Cung"; câu dẫn nhập ch.5; lặp tiêu đề ch.7/8; "HOÁ Quyền" | ĐỒNG Ý — cơ chế "Cung Mệnh Cung" ĐÚNG: formatCanonicalPalaceHeading (dossier-context.ts:577, vòng 1 ghi :569) ghép cứng `### Cung ${name}` trong khi tên cung Mệnh đã là "Mệnh Cung" |
| D-01 | Khối > 📌 lặp bảng Tứ Hóa cuối ch.5 | ĐỒNG Ý — cơ chế ĐÚNG: verifyAndEnsureCompletePeriodSiHua (text-sanitizer.ts:212, vòng 1 ghi :304) tự chèn đủ 4 dòng khi thiếu tên sao Văn Xương; các dòng chèn dùng formatPeriodSiHuaFactLine nên mang luôn lỗi A-02 |
| D-02 | Ch.5/6 quá mỏng (~610–670 từ thân bài) | ĐỒNG Ý về số đo (ký tự: ch.5 6.587, ch.6 4.845 so với ch.2–4 ~9.400–10.400). Cơ chế ĐÚNG: buildStrictPeriodAiPrompt (server.ts:213–233) không có sàn độ dài, trong khi section prompt có sàn (server.ts:427: 250–350 từ/cung; :432/:438: 750–1.100 từ/chương). Lưu ý: chi tiết "DetailedDossierModal.tsx:100–116" vòng 1 ghi là SAI (đó là hàm downloadBlob); và "endpoint không truyền ngữ cảnh Đại Hạn" CHƯA kiểm chứng đủ (yunxian-context.ts:385+ có tính parentDaXian) |
| D-03 | Ch.7 thiếu đối cung xung chiếu; nhãn cũ [Tứ Hóa Đại Hạn - Can ...]; sao lưu thiếu Can | ĐỒNG Ý — cơ chế ĐÚNG: buildMultiYearHorizonContext giữ format cũ; nhãn cũ tại dossier-context.ts:705; sao lưu chỉ in `${natalPalaceNameVi} - ${branchVi}` (thiếu Can) tại :808–826 |
| D-04 | Năm 2034 trùng tên 12/12 cung không giải thích | ĐỒNG Ý — dữ kiện đúng, chỉ thiếu câu giải thích hiện tượng |

## Lỗi của chính vòng 1 (Argon) — cần ghi nhận
1. Tóm tắt đầu báo cáo viết "Phụ Mẫu 14–23 Can Quý" và "Huynh Đệ 114–123 Can Tân" — CẢ HAI ĐỀU SAI. Đúng: Phụ Mẫu 114–123 Can Quý; Huynh Đệ 14–23 Can Quý. (Tân Sửu không tồn tại trên lá số này.)
2. A-05: "Liêm Trinh [Bình]" — sai, đúng là Liêm Trinh [Lợi] tại Đinh Mùi.
3. A-01: thêm chi tiết "(có Thiên Lương [Miếu], Lộc Tồn, Điếu Khách)" — "Điếu Khách" xuất hiện 0 lần trong hồ sơ, chưa kiểm chứng.
4. B-02: "mục 📚 còn liệt kê [NH-PAL-014-GEN]... [NH-PAT-001]" — NH-PAT-001 xuất hiện 0 lần trong file.
5. Số dòng code vòng 1 trích dẫn lệch hệ thống (2–20 dòng) ở 10/20 mã: verifier :23→:21, :132→không tồn tại, :289–349→:378–490, sanitizer :304→:212, dossier :569→:577, yunxian :390→:370, :624→:637, server :397→:429, modal :669→:654, :100–116→sai hẳn. Thực chất cơ chế đúng ở mọi điểm đã kiểm tra — nhưng brief 1.5.5 PHẢI trích theo tên hàm, không trích số dòng, hoặc đo lại số dòng trên src-v23 trước khi viết brief.
6. Số học tổng kết mâu thuẫn nội bộ: mở đầu ghi "26 lỗi", phần II ghi "20 mã (32 vị trí)". Đúng theo đếm của vòng 2: 20 mã, 32 vị trí lỗi đơn lẻ (C-05: 7 chỗ, C-06: 4 chỗ, còn lại mỗi mã 1–3 chỗ).

## Phương án khắc phục hợp nhất (đề xuất trình Saint)
Gói 1.5.5 — chia 3 nhóm, ưu tiên theo vòng 1:
- **Nhóm X — Chặn rò rỉ trích dẫn (B-01, B-02, B-03)**: xóa tên file .ts khỏi prompt kỳ hạn (server.ts:237/240/243); regex quét thẻ [Nguồn:...] bắt mọi nội dung trong ngoặc + tách thẻ đa ID thành thẻ đơn (verifier.ts:21 + text-sanitizer.ts:103); đồng bộ validIdsInOrder với scrubbedInvalidIds (verifier.ts:378–490).
- **Nhóm Y — Sửa định dạng gây hiểu sai (A-01, A-02, A-05, C-03, C-06.1, D-03, D-04)**: formatPeriodSiHuaFactLine đưa [Bản mệnh Hóa ...] lên sát tên sao; titleVi kỳ hạn ghi rõ cung Bản Mệnh gốc + nơi Lưu Mệnh tọa thủ (yunxian-context.ts:370); nhãn "Bộ Kình Đà" bỏ cụm (Dương Đà giáp Lộc); pat.level dịch sang tiếng Việt (dossier-context.ts:327); formatCanonicalPalaceHeading xử lý riêng cung Mệnh; horizon đồng bộ nhãn mới + đủ Can Chi sao lưu + đối cung xung chiếu (dossier-context.ts:705, 808–826); gắn chú thích khi Lưu Mệnh trùng Mệnh gốc.
- **Nhóm Z — Prompt + sanitizer (A-06, D-01, D-02, C-01/C-02/C-04/C-05, B-04)**: bắt buộc mỗi cung luận dòng [Tứ Hóa Đại Hạn Kỳ ...] của chính kỳ đó (server.ts:429); sàn độ dài ch.5/6 900–1.300 từ + ép giữ tên sao trên dòng Lưu Tứ Hóa + cấm câu dẫn nhập (buildStrictPeriodAiPrompt); bổ sung bộ lọc sanitizer: Thứ secondNumber/first/third, Thân Cuv, Venh Khúc/Venh Xương, [excellent]/[good]/[neutral]/[bad], từ điển tên 14 chính tinh + các cặp từ sai đã liệt kê; quy tắc không gọi "Không Kiếp" khi Địa Kiếp không hội chiếu; V2 kiểm tra theo câu thay vì theo khối (hoặc tối thiểu: không bỏ qua cả khối chỉ vì có 1 thẻ hợp lệ).
- **Ngoài phạm vi 1.5.5**: sửa trực tiếp file hồ sơ đã xuất (các lỗi C-01..C-06, A-01..A-05 trong bản này) — chỉ làm khi Saint yêu cầu riêng, vì hồ sơ sẽ sinh lại sau khi sửa code.

## Việc tiếp theo
Chờ Saint quyết: (1) duyệt phương án trên để soạn brief 1.5.5 + chạy panel trước thi công; (2) chỉ sửa tay file hồ sơ hiện tại; (3) để sau.
