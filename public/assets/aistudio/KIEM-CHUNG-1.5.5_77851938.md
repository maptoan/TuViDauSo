# Kiểm chứng độc lập 1.5.5 — ĐẠT (25/11/2026)

- Nguồn: `~/workspace/ziwei-app-src-v24.zip` (8.639.519 byte, file ZIP do chính Saint gửi 13:23 25/11/2026) → giải nén `~/workspace/ziwei-app-src-v24/`, đã xóa `.data`. VERSION = **1.5.5**.
- Nền so sánh: src-v23 (1.5.4). Phương pháp: diff + lint/build/verify:all chạy thật + đo kích thước bằng cùng script trên cả hai bản + 25 spot check tự viết.

## Diff vs 1.5.4 — đúng phạm vi
Đúng 10 file code/tài liệu đổi: VERSION, CHANGELOG.md, scripts/verify-dossier-chat-ui.ts, scripts/verify-dossier-context.ts, scripts/verify-knowledge-base.ts, server.ts, server/knowledge-base/verifier.ts, src/lib/ziwei/dossier-context.ts, src/lib/ziwei/text-sanitizer.ts, src/lib/ziwei/yunxian-context.ts. Thêm 5 file `public/assets/aistudio/` (brief v1/v2, 2 báo cáo vòng 2, file hồ sơ 1.5.4 — tài liệu đính kèm trong phiên AI Studio, không phải code).
**0 dòng nào bị xóa trong cả 3 file verify** — chỉ thêm ca kiểm mới; không assertion cũ nào bị sửa (kể cả các mục trong danh sách trắng).

## Cổng chạy thật trên src-v24
- `bun run lint`: exit 0 (0 lỗi).
- `bun run build`: đạt (2,21s).
- `bun run verify:all`: exit 0 — key-pool 33/33; dossier-context 8/8 (gồm bài 8 mới BRIEF 1.5.5); dossier-ui 19/19; yunxian 4/4 kỳ hạn tách biệt; library 22/22; kb 100% (K1 32/32, K2 15/15, K3 24/24 + khối [BRIEF 1.5.5] X1/X2a–X2h/X3/Z4/Z5a–Z5d đạt 100%).

## Đo kích thước (script /tmp/check155.ts, cùng phương pháp trên cả hai bản)
| Fact sheet | 1.5.4 | 1.5.5 | Trần | Kết luận |
|---|---|---|---|---|
| chapter_overview | 3.604 | 3.624 | ≤ 3.650 | ĐẠT (dư 26) |
| palaces_core | 4.964 | 4.959 | ≤ 5.100 | ĐẠT |
| palaces_family | 4.430 | 4.430 | ≤ 4.550 | ĐẠT |
| palaces_social_health | 4.449 | 4.449 | ≤ 4.580 | ĐẠT |
| horizon_5y | 13.214 | 13.625 | ≤ 14.200 | ĐẠT |
| horizon_10y | 35.753 | 36.723 | ≤ 37.800 | ĐẠT |
| chat | 12.832 | 12.832 | ≤ 13.100 | ĐẠT (không tăng) |

Số đo khớp từng ký tự với báo cáo của Assistant. Lưu ý đối chiếu vòng 2: horizon_10y đo được 36.723 (không phải 36.979 như Argon ước tính) — chênh đúng 256 ký tự, tức là Can Chi KHÔNG được thêm vào `compactMatrixMarkdown` (đúng hiệu chỉnh P7 nhánh thay thế); chat không tăng ký tự nào, trần 13.100 giữ nguyên vẹn.

## Spot check tự viết — 25/25 PASS
- X2 parser (`parseCitationTagInner`): đa ID → 2 ứng viên; `.ts` → 0 ứng viên hợp lệ; hậu tố `·` được giữ, dấu phẩy trong chú thích không tạo ứng viên; thẻ rỗng → `isEmptyTag`; chữ thường → chuẩn hóa hoa; scrub client giữ CL-TT-015, xóa FAKE-999.
- Y1 (không rỗng): dòng thật "Lưu Hóa Lộc → Sao Thiên Đồng [Bình] · [Bản mệnh Hóa Quyền]" — ghi chú nằm sát sau độ sáng, trước cụm đối cung.
- Y2: tiêu đề "Lưu Niên 2026 — Năm Bính Ngọ (50 tuổi) · Kích hoạt cung Bản Mệnh gốc Quan Lộc (Bính Ngọ) — nơi Cung Lưu Mệnh Cung tọa thủ".
- Y5: `### Cung Mệnh (Nhâm Dần) [AN MỆNH] [Đại hạn 4–13 tuổi]`.
- Y4: overview có `[Thượng cách]`, không còn `[excellent]`; H5 có `Điền Trạch - Ất Tỵ`, chat không có (compact matrix giữ chi-only).
- Z3: `Thứ secondNumber` → `Thứ hai` (không `haiNumber`); `Thân Cuv` → `Thân Cư`; `bảo ninh` → `bảo toàn`, `Bảo Ninh` giữ nguyên; `HOÁ Quyền` → `Hóa Quyền`.
- Z5: bộ tách câu không cắt tại `mục 1.2`.
- X1/Z1/Z2/Z5/Y6a/C-06.3: prompt kỳ hạn không còn tên file `.ts`; có sàn 900–1.300 từ; không hardcode "44–53 tuổi tại Tài Bạch"; hướng dẫn gắn thẻ "ngay cuối câu có viện dẫn"; prompt nhóm cung có quy tắc bắt buộc dòng `[Tứ Hóa Đại Hạn Kỳ ...]`; prompt horizon có quy tắc `(xung Cung Lưu ...)` và cấm lặp tiêu đề.
- X3: `finalValidIdsInOrder` lọc bỏ ID trong `scrubbedInvalidIds` (verifier.ts:591); marker `'(EMPTY)'` có mặt (:475); `caution` → `Hung cách` trong `PATTERN_LEVEL_VI_MAP`.

## Kết luận kiểm chứng code: ĐẠT toàn bộ (ĐK-155-01..05)
Còn lại ĐK-155-06: nghiệm thu live trên Preview (sinh lại ch.1, ch.3, ch.5, ch.6).

## Nghiệm thu live ĐK-155-06 — CHƯA ĐẠT TRỌN: 6/7 lỗi nghiêm trọng đã hết, A-04 CÒN (13:28–13:53 25/11/2026)
- Chạy trên Preview 1.5.5: Kho Khóa 24/24 sẵn sàng, modelConfig flash-lite / gemma-4-31b-it. Lá số cũ không có trong Thư Viện của profile trình duyệt này nên đã lập MỚI lá số cùng dữ liệu (điểm cố định khớp: Mệnh Nhâm Dần, Âm Nam, Đại Hạn 44–53 tại Tài Bạch). Hồ sơ mới chỉ có 4/8 chương (1, 3, 5, 6); bản 8/8 1.5.4 vẫn lưu trên máy.
- Sinh: ch.1 thử 2 lần (lần 1 lặp tiêu đề chương 6 lần — họ C-06, lần 2 sạch), ch.3/ch.5/ch.6 mỗi chương 1 lần; tất cả bằng flash-lite, Gemma không phải dùng. File xuất: `~/workspace/your_files/la-so-do-vu-toan/Ho-So-Tu-Vi-Do-Vu-Toan-4-8-sinh-lai-1.5.5.md` (122.141 byte) + `.html` (184.822 byte). **Mọi kết luận dưới đây đã đối chiếu trực tiếp trên file .MD, không chỉ theo báo cáo trình duyệt.**
- ĐÃ HẾT (6/7 nghiêm trọng): A-01, A-02, B-01, B-02, C-01, C-02, D-01 + A-03, A-05, A-06 (đủ 4 cung ch.3), C-03, C-04, C-05. "### Cung Mệnh Cung" 0 lần; "secondNumber/Thân Cuv/Venh Khúc/[excellent]" 0 lần; không thẻ .ts nào.
- **A-04 CÒN (dạng biến thể)**: ch.5 §1, dòng 211 file: "Sự hiện diện của bộ đôi Không - Kiếp/Không bộc lộ rõ tính chất biến động…" — cung Lưu Mệnh chỉ có Địa Không + Thiên Không, không có Địa Kiếp. §3 cùng chương viết đúng tên hai sao.
- Sàn độ dài ĐẠT: ch.5 ≈ 1.394 từ, ch.6 ≈ 1.419 từ (đếm trên giao diện; đếm lại trên file: 1.421/1.448 — chênh ~2%, cùng kết luận). Lưu ý: cả hai đều vượt trần mục tiêu 900–1.300 của prompt Z2.
- Lỗi mới phát hiện (đã kiểm chứng trên file): (1) ch.3 tiêu đề mỗi cung lặp 2 lần liên tiếp (4 cung, dòng 108/110, 120/122, 132/134, 144/146); (2) ch.5 "sao Thiên Lương thủ mì" (dòng 222); (3) ch.6 "Cung Lưu Mệnh Cung đóng nhờ trên cung Bản Mệnh gốc Giao Hữu" (dòng 250); (4) ch.6 "trinhtrạng trì hoãn" — dính chữ, thiếu khoảng trắng (dòng 269); (5) ch.3 trích dẫn hoàn toàn dạng [ID] trần (8 thẻ: NH-STAR-054 ×4, NH-SIHUA-002 ×3, CL-TT-009 ×1), không còn dạng [Nguồn: ...], không có khối tham chiếu — bản 1.5.4 ch.3 có 4 thẻ [Nguồn:] + khối tham chiếu; (6) ch.6 hoàn toàn không có trích dẫn nào và không có khối tham chiếu — NHƯNG bản 1.5.4 ch.6 cũng vậy (0 thẻ, không khối), nên đây là hành vi có sẵn, không phải hồi quy do 1.5.5. Đính chính báo cáo trình duyệt: file ghi "quấy phá ngầm" (đúng), không phải "quấy phá ngấm".
- Hệ quả: ĐK-155-06 chưa đạt trọn. A-04 + các lỗi mới là ứng viên đưa vào brief 1.5.6 (đã có sẵn KP-3 đầy đủ + KP-6 + KP-7 tầng 2) — chờ Saint quyết có mở rộng phạm vi 1.5.6 hay không; theo quy tắc, brief mới phải qua panel trước khi thi công.
