# MỤC LỤC ĐIỀU HƯỚNG HỆ THỐNG TÀI LIỆU (`docs/INDEX.md`)

- **Loại tài liệu**: `[Tài liệu Sống — Mục lục Điều hướng Trung tâm]`
- **Trạng thái hiệu lực**: `ĐANG HIỆU LỰC (ACTIVE)`
- **Áp dụng cho phiên bản ứng dụng**: `1.1.0-rc.1` *(đồng bộ với `/VERSION`)*
- **Cập nhật lần cuối**: `17/11/2026` *(thực thi `QĐ-D1..QĐ-D6`)*
- **Mã nguồn đối chiếu (Code SSOT)**: Toàn bộ cây mã nguồn `server/`, `server.ts`, `src/`, `scripts/`
- **Quyết định liên quan**: `QĐ-D1`, `QĐ-D2`, `QĐ-D3`, `QĐ-D4`, `QĐ-D5`, `QĐ-D6`

---

## 1. Quy Tắc Đọc & Tra Cứu Tài Liệu (Dành cho Kỹ sư & Phiên AI Mới)

1. **Luôn bắt đầu từ Tài liệu Sống** ở bảng **Mục 2** dưới đây (và `/README.md`, `/VERSION`, `/CHANGELOG.md` ở thư mục gốc).
2. **Không dùng tài liệu trong `docs/archive/` làm căn cứ cho mã nguồn hiện hành**: Các file trong `docs/archive/` là bản nháp thiết kế V1/V2, biên bản phản biện Panel hoặc chẩn đoán lỗi cũ đã giải quyết xong và đã được hợp nhất. Mọi file trong `docs/archive/` đều có Banner cảnh báo ngay dòng 1.
3. **Tuân thủ Một Nguồn Sự Thật (SSOT)**: Mỗi hằng số cấu hình hoặc đặc tả chi tiết chỉ được định nghĩa tại **một Tài liệu Sống duy nhất** (xem cột *Phạm vi SSOT*).

---

## 2. Nhóm A — Tài Liệu Gốc & Tài Liệu Sống Đang Hiệu Lực

| Tài liệu | Đường dẫn | Phạm vi SSOT (Một Nguồn Sự Thật) |
|---|---|---|
| **Cửa ngõ Dự án** | [`/README.md`](../README.md) | Tổng quan hệ thống, tóm tắt 5 tầng, các lệnh chạy/build/test, bản đồ điều hướng |
| **Số Phiên Bản Hiện Hành** | [`/VERSION`](../VERSION) | Số phiên bản ứng dụng (`1.1.0-rc.1`), ngày cập nhật và trạng thái nghiệm thu |
| **Nhật Ký Thay Đổi** | [`/CHANGELOG.md`](../CHANGELOG.md) | Lịch sử các đợt phát hành (`1.0.0-stable` → `1.1.0-rc.1`) |
| **Mục Lục Điều Hướng** | [`docs/INDEX.md`](INDEX.md) | Danh mục phân loại toàn bộ tài liệu sống, kiểm toán hiện hành và lưu trữ |
| **Kiến Trúc Tổng Thể 5 Tầng** | [`docs/architecture-overview.md`](architecture-overview.md) | Sơ đồ 5 tầng (`Engine` → `Context` → `Server/Key Pool` → `Sanitizer` → `UI/Export`), danh sách route `server.ts`, các vùng bất biến |
| **Vận Hành Kho Khóa Gemini** | [`docs/key-pool-operations.md`](key-pool-operations.md) | **SSOT duy nhất** cho hằng số `server/key-pool/types.ts`, thuật toán chấm điểm chọn khóa `allocator.ts`, cơ chế failover & continuation `executor.ts`, mã hóa `AES-256-GCM`, bảo mật PIN & `QĐ-H4` |
| **Đặc Tả Hồ Sơ, Chat & Hợp Bàn** | [`docs/features-dossier-and-chat.md`](features-dossier-and-chat.md) | **SSOT duy nhất** cho 8 chương Hồ Sơ (`DOSSIER_CHAPTER_SPECS`), `sessionStorage` + LRU, khóa định danh lá số `QĐ-H2`, Tam Phương Tứ Chính `QĐ-H3`, hậu kiểm `3A + 3B` `QĐ-H6`, Header S5 `QĐ-G5`, `stripInternalExportMetaLines` `QĐ-G6`, Chat & Hợp Bàn SSE `QĐ-H5` |
| **Sổ Cái Quyết Định Kiến Trúc** | [`docs/decisions-registry.md`](decisions-registry.md) | **SSOT duy nhất** tổng hợp toàn bộ quyết định đã duyệt: `QĐ-1..6`, `F1–F7`, `QĐ-G1..G6`, `QĐ-H1..H7`, `QĐ-D1..D6` |

---

## 3. Nhóm B — Tài Liệu Kiểm Toán & Chẩn Đoán Hiện Hành (Đã Thi Công)

Hai báo cáo kỹ thuật dưới đây được giữ lại tại `docs/` ở trạng thái tham khảo đối chiếu kiểm toán cho nhánh `1.1.0-rc.1`:

| Tài liệu | Trạng thái hiện tại | Ghi chú quan trọng |
|---|---|---|
| [`docs/h4-diagnosis.md`](h4-diagnosis.md) | **ĐÃ THI CÔNG & ĐẠT `TEST 18` (`18/18`)** | Bằng chứng thực nghiệm đính chính trích dẫn biến của `B-05` và ghi nhận bản sửa tối thiểu cho `QĐ-H4` tại `allocator.ts` & `executor.ts`. |
| [`docs/logic-code-audit-v2.md`](logic-code-audit-v2.md) | **ĐÃ THI CÔNG `QĐ-H1..H7` & ĐÍNH CHÍNH `B-05`** | Danh mục 28 phát hiện kiểm toán và 7 quyết định `QĐ-H1..H7` đã vào code; mục `B-05` có hộp đính chính dẫn sang `docs/h4-diagnosis.md`. |

---

## 4. Nhóm C — Kho Lưu Trữ Lịch Sử Bất Biến (`docs/archive/` — 14 tài liệu)

Toàn bộ các tài liệu trung gian, nháp kế hoạch cũ và kế hoạch tổ chức tài liệu đã hoàn thành sứ mệnh được lưu giữ nguyên vẹn nội dung lịch sử (chỉ thêm Banner cảnh báo ở dòng đầu tiên):

| STT | File trong `docs/archive/` | Vai trò lịch sử trước đây | Tài liệu sống thay thế |
|:---:|---|---|---|
| 1 | `archive/key-pool-design-plan.md` | Kế hoạch thiết kế Kho Khóa gốc (`QĐ-1..QĐ-6`) | `docs/key-pool-operations.md` & `docs/decisions-registry.md` |
| 2 | `archive/key-pool-expert-panel-review.md` | Biên bản Panel Kho Khóa *(mang thông số 25s trước khi `QĐ-5` nâng lên 35s)* | `docs/key-pool-operations.md` |
| 3 | `archive/feature-plan-3-tinh-nang.md` | Bản nháp V1 thiết kế 3 tính năng | `docs/features-dossier-and-chat.md` |
| 4 | `archive/feature-plan-panel-review.md` | Biên bản Panel 3 tính năng (chốt `F1–F7`) | `docs/decisions-registry.md` & `docs/features-dossier-and-chat.md` |
| 5 | `archive/feature-plan-3-tinh-nang-v2.md` | Kế hoạch V2 3 tính năng *(thân bài chưa đồng bộ hết mã chương & storage thật)* | `docs/features-dossier-and-chat.md` |
| 6 | `archive/fix-round-diagnosis.md` | Chẩn đoán lỗi cục bộ `B1–B3` trước Pha B *(đã sửa xong)* | `docs/features-dossier-and-chat.md` & `docs/key-pool-operations.md` |
| 7 | `archive/heming-form-reset-diagnosis.md` | Chẩn đoán reset form Hợp Hôn khi chọn Giờ Tý `0` *(đã sửa xong)* | `docs/features-dossier-and-chat.md` |
| 8 | `archive/stream-interruption-diagnosis.md` | Chẩn đoán ngắt luồng trên nền `executor.ts` bản cũ 319 dòng | `docs/key-pool-operations.md` & `docs/h4-diagnosis.md` |
| 9 | `archive/dossier-fix-plan-v1.md` | Bản nháp V1 sửa Hồ Sơ 8 Chương | `docs/features-dossier-and-chat.md` |
| 10 | `archive/dossier-fix-panel-review.md` | Biên bản Panel sửa Hồ Sơ 8 Chương (`QĐ-G1..G4`) | `docs/decisions-registry.md` & `docs/features-dossier-and-chat.md` |
| 11 | `archive/dossier-fix-plan-v2.md` | Kế hoạch V2 sửa Hồ Sơ 8 Chương *(trước `QĐ-G5`, `QĐ-G6` & đợt `H`)* | `docs/features-dossier-and-chat.md` |
| 12 | `archive/logic-code-audit-v1.md` | Bản nháp rà soát toàn diện V1 *(chứa một số trích dẫn chưa phản biện)* | `docs/logic-code-audit-v2.md` & `docs/architecture-overview.md` |
| 13 | `archive/logic-code-audit-panel-review.md` | Biên bản Panel 5 vai rà soát toàn diện | `docs/logic-code-audit-v2.md` & `docs/decisions-registry.md` |
| 14 | `archive/documentation-plan.md` | Kế hoạch chuẩn hóa hệ thống tài liệu (`QĐ-D1..D6`) — đã hiện thực hóa ngày `17/11/2026` | `docs/INDEX.md` & bộ 4 Tài liệu Sống |

---

## 5. Quy Trình Bảo Trì Tài Liệu Khi Có Thay Đổi Mã Nguồn

1. Mỗi đợt sửa đổi tính năng hoặc quyết định kiến trúc mới phải cập nhật đồng bộ **trước khi đóng lượt thi công**:
   - Ghi nhận quyết định mới vào `docs/decisions-registry.md`.
   - Cập nhật thông số/luồng thực thi vào đúng Tài liệu Sống sở hữu (`key-pool-operations.md`, `features-dossier-and-chat.md`, hoặc `architecture-overview.md`).
   - Cập nhật `/CHANGELOG.md` và `/VERSION`; nếu tạo tài liệu nháp/phản biện cho đợt mới, chuyển vào `docs/archive/` kèm Banner sau khi đã hợp nhất.
2. Không tạo thêm thông số trùng lặp giữa các file; luôn dẫn liên kết chéo tới Tài liệu Chủ (SSOT).
