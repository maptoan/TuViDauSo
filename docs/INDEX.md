# MỤC LỤC ĐIỀU HƯỚNG HỆ THỐNG TÀI LIỆU (`docs/INDEX.md`)

- **Loại tài liệu**: `[Tài liệu Sống — Mục lục Điều hướng Trung tâm]`
- **Trạng thái hiệu lực**: `ĐANG HIỆU LỰC (ACTIVE)`
- **Áp dụng cho phiên bản ứng dụng**: `1.4.0-rc.2` *(đồng bộ với `/VERSION`)*
- **Cập nhật lần cuối**: `19/11/2026` *(cập nhật bản vá Fast-Sweep `1.4.0-rc.2`: `QĐ-F1..QĐ-F4`, `FS2-01..FS2-07`)*
- **Mã nguồn đối chiếu (Code SSOT)**: Toàn bộ cây mã nguồn `server/`, `server.ts`, `src/`, `scripts/`
- **Quyết định liên quan**: `QĐ-D1..QĐ-D6`, `QĐ-L1..QĐ-L9`, `ĐC-1..ĐC-6`, `LK-01..LK-10`, `DM-01..DM-13`, `QĐ-M1..QĐ-M6`, `NK-01..NK-12`, `QĐ-N1..QĐ-N8`, `QĐ-F1..QĐ-F4`

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
| **Số Phiên Bản Hiện Hành** | [`/VERSION`](../VERSION) | Số phiên bản ứng dụng (`1.4.0-rc.2`), ngày cập nhật và trạng thái nghiệm thu |
| **Nhật Ký Thay Đổi** | [`/CHANGELOG.md`](../CHANGELOG.md) | Lịch sử các đợt phát hành (`1.0.0-stable` → `1.1.0-rc.1` → `1.2.0-rc.1` → `1.2.0-rc.2` → `1.3.0-rc.1` → `1.4.0-rc.1` → `1.4.0-rc.2`) |
| **Mục Lục Điều Hướng** | [`docs/INDEX.md`](INDEX.md) | Danh mục phân loại toàn bộ tài liệu sống, kiểm toán hiện hành và lưu trữ |
| **Kiến Trúc Tổng Thể 5 Tầng** | [`docs/architecture-overview.md`](architecture-overview.md) | Sơ đồ 5 tầng (`Engine` → `Context & KB` → `Server/Key Pool` → `Sanitizer & Verifier` → `UI/Export`), danh sách route `server.ts`, các vùng bất biến |
| **Vận Hành Kho Khóa Gemini** | [`docs/key-pool-operations.md`](key-pool-operations.md) | **SSOT duy nhất** cho hằng số `server/key-pool/types.ts`, thuật toán chấm điểm chọn khóa `allocator.ts`, cơ chế failover & continuation `executor.ts`, mã hóa `AES-256-GCM`, bảo mật PIN & `QĐ-H4` |
| **Đặc Tả Hồ Sơ, Chat, Thư Viện & KB** | [`docs/features-dossier-and-chat.md`](features-dossier-and-chat.md) | **SSOT duy nhất** cho 8 chương Hồ Sơ (`DOSSIER_CHAPTER_SPECS`), Thư Viện Lá Số & IndexedDB SSOT (`QĐ-L1..L9`, `ĐC-1..ĐC-5`, `LK-01..LK-10`), Phát Hiện Lá Số Trùng (`QĐ-M1..QĐ-M6`, `DM-01..DM-13`), Nền Tri Thức AI Đợt 1A (`QĐ-N1..QĐ-N8`, `ĐN-1..ĐN-10`), `sessionStorage` + LRU, khóa định danh lá số `QĐ-H2`, Tam Phương Tứ Chính `QĐ-H3`, hậu kiểm `3A + 3B` `QĐ-H6`, Chat & Hợp Bàn SSE `QĐ-H5` |
| **Sổ Cái Quyết Định Kiến Trúc** | [`docs/decisions-registry.md`](decisions-registry.md) | **SSOT duy nhất** tổng hợp toàn bộ quyết định đã duyệt: `QĐ-1..6`, `F1–F7`, `QĐ-G1..G6`, `QĐ-H1..H7`, `QĐ-D1..D6`, `QĐ-L1..L9`, `ĐC-1..ĐC-6`, `QĐ-M1..QĐ-M6`, `QĐ-N1..QĐ-N8`, `QĐ-F1..QĐ-F4` |

---

## 3. Nhóm B — Tài Liệu Thiết Kế, Kiểm Toán & Chẩn Đoán Hiện Hành (Đã Thi Công)

Các báo cáo thiết kế, phản biện và chẩn đoán dưới đây được giữ lại tại `docs/` ở trạng thái tham khảo đối chiếu cho nhánh `1.1.0-rc.1`, `1.2.0-rc.1`, `1.2.0-rc.2`, `1.3.0-rc.1` và `1.4.0-rc.1`:

| Tài liệu | Trạng thái hiện tại | Ghi chú quan trọng |
|---|---|---|
| [`docs/h4-diagnosis.md`](h4-diagnosis.md) | **ĐÃ THI CÔNG & ĐẠT `TEST 18` (`18/18`)** | Bằng chứng thực nghiệm đính chính trích dẫn biến của `B-05` và ghi nhận bản sửa tối thiểu cho `QĐ-H4` tại `allocator.ts` & `executor.ts`. |
| [`docs/logic-code-audit-v2.md`](logic-code-audit-v2.md) | **ĐÃ THI CÔNG `QĐ-H1..H7` & ĐÍNH CHÍNH `B-05`** | Danh mục 28 phát hiện kiểm toán và 7 quyết định `QĐ-H1..H7` đã vào code; mục `B-05` có hộp đính chính dẫn sang `docs/h4-diagnosis.md`. |
| [`docs/chart-library-design-plan.md`](chart-library-design-plan.md) | **ĐÃ THI CÔNG (`1.2.0-rc.1`, `POST-PANEL V2`)** | Thiết kế chi tiết Thư Viện Lá Số (`localStorage` index + `IndexedDB` + gương RAM SSOT + `.JSON` di động, 4 nấc thu hồi). Lưu ý `QĐ-L2` cập nhật (chỉ exact 9-part) và `ĐC-1..ĐC-6` thắng khi mâu thuẫn. |
| [`docs/chart-library-expert-panel-review.md`](chart-library-expert-panel-review.md) | **BIÊN BẢN PANEL 5 VAI (`PL-01..PL-12`)** | Phản biện chuyên sâu 12 điểm & 10 mục agenda bắt buộc cho Thư Viện Lá Số (loại bỏ trạm server Phương án B, chốt Phương án A + tombstones). |
| [`docs/chart-library-claude-review-v2.md`](chart-library-claude-review-v2.md) | **ĐÃ THI CÔNG `ĐC-1..ĐC-6` (`1.2.0-rc.1`)** | Kiểm chứng vòng 2 trên code thật và chốt bắt buộc `ĐC-1..ĐC-6` cùng `QĐ-L1..L7`. |
| [`docs/chart-library-implementation-notes.md`](chart-library-implementation-notes.md) | **HOÀN TẤT NGHIỆM THU (`1.2.0-rc.2`)** | Tổng hợp tệp tạo/sửa, kết quả chạy thực tế `verify:all` (`verify:library` 17/17, `lint`, `build`) cập nhật sau bản vá `1.2.0-rc.2`. |
| [`docs/chart-library-cross-chart-leak-fix-plan.md`](chart-library-cross-chart-leak-fix-plan.md) | **ĐÃ THI CÔNG (`1.2.0-rc.2`, `POST-PANEL V2`)** | Chẩn đoán 3 nghi phạm + `LK-01..LK-10` gây rò Chương 5/6 giữa các lá số và đặc tả bản vá đầy đủ cho `chart-library.ts`, `dossier-chat-ui.ts`, `DetailedDossierModal.tsx`, `App.tsx`, `verify-chart-library.ts`. |
| [`docs/chart-library-cross-chart-leak-expert-panel-review.md`](chart-library-cross-chart-leak-expert-panel-review.md) | **BIÊN BẢN PANEL 5 VAI (`LK-01..LK-10`)** | Phản biện 8 điểm agenda + 2 phát hiện mới (`LK-09`, `LK-10`), bác bỏ xóa tự động ngầm (`QĐ-L8 C1+`) và chốt cổng bảo vệ lũy đẳng (`QĐ-L9`). |
| [`docs/chart-library-cross-chart-leak-claude-review-v2.md`](chart-library-cross-chart-leak-claude-review-v2.md) | **ĐÃ CHỐT & THI CÔNG (`1.2.0-rc.2`)** | Biên bản kiểm chứng độc lập trên code thật & chốt quyết định cuối `QĐ-L8` (`C1+`), `QĐ-L9` (`Phương án A` có cổng lũy đẳng). |
| [`docs/chart-library-cross-chart-leak-implementation-notes.md`](chart-library-cross-chart-leak-implementation-notes.md) | **HOÀN TẤT NGHIỆM THU (`1.2.0-rc.2`)** | Hồ sơ nghiệm thu chi tiết bản vá `1.2.0-rc.2`, đối chiếu `LK-01..LK-10`, kết quả thực thi thực tế `lint`, `build`, `verify:all` (`17/17`). |
| [`docs/chart-duplicate-detection-design-plan.md`](chart-duplicate-detection-design-plan.md) | **ĐÃ THI CÔNG (`1.3.0-rc.1`, `POST-PANEL V2`)** | Kế hoạch thiết kế tính năng Phát Hiện Lá Số Trùng Khi Lập Lá Số (`exact_match`, `near_match`, phân tầng `DM-06`, siết Nhánh 2 `DM-05`, `Stale Entry Guard` `DM-08`, tách nguồn `DM-04`, `TEST-L18..L22`). |
| [`docs/chart-duplicate-detection-expert-panel-review.md`](chart-duplicate-detection-expert-panel-review.md) | **BIÊN BẢN PANEL 5 VAI (`DM-01..DM-13`)** | Phản biện chuyên sâu 10 điểm agenda (`ĐP-1..ĐP-10`) + 3 phát hiện mới (`DM-11..DM-13`) cho tính năng phát hiện lá số trùng. |
| [`docs/chart-duplicate-detection-claude-review-v2.md`](chart-duplicate-detection-claude-review-v2.md) | **ĐÃ CHỐT & THI CÔNG (`1.3.0-rc.1`)** | Phản biện vòng 2 của Muse xác nhận bản POST-PANEL V2 đạt chuẩn thi công & lệnh triển khai `QĐ-M1..QĐ-M6` ngày `18/11/2026`. |
| [`docs/chart-duplicate-detection-implementation-notes.md`](chart-duplicate-detection-implementation-notes.md) | **HOÀN TẤT NGHIỆM THU (`1.3.0-rc.1`)** | Hồ sơ nghiệm thu chi tiết tính năng phát hiện lá số trùng, điểm đối chiếu với bản V2, kết quả chạy thực tế `lint`, `build`, `verify:all` (`22/22`). |
| [`docs/knowledge-base-design-plan.md`](knowledge-base-design-plan.md) | **ĐÃ THI CÔNG ĐỢT PILOT 1A (`1.4.0-rc.1`, `POST-PANEL V2`)** | Kiến trúc Nền Tri Thức AI: chưng cất ngoại tuyến theo nhóm `(book, h2, h3)`, truy hồi tất định theo ngân sách Bảng 4.2, `ĐN-8` Tam Phương Tứ Chính, hậu kiểm chống bịa 3 lớp (`V1/V2/V3`) & bộ test `K1/K2/K3`. |
| [`docs/knowledge-base-expert-panel-review.md`](knowledge-base-expert-panel-review.md) | **BIÊN BẢN PANEL 5 VAI (`NK-01..NK-12`)** | Phản biện 10 kết luận `ĐN-1..ĐN-10` (chuyển sang đơn vị nhóm `(book, h2, h3)`, kéo ngữ cảnh bài giảng, bỏ regex sửa chữ, nâng chuẩn `ĐN-8`, chia Đợt 1A/1B/2). |
| [`docs/knowledge-base-claude-review-v2.md`](knowledge-base-claude-review-v2.md) | **ĐÃ CHỐT & THI CÔNG (`1.4.0-rc.1`)** | Phản biện vòng 2 của Muse xác nhận bản POST-PANEL V2 đạt chuẩn thi công & lệnh triển khai Đợt Pilot 1A `QĐ-N1..QĐ-N8` ngày `19/11/2026`. |
| [`docs/knowledge-base-implementation-notes.md`](knowledge-base-implementation-notes.md) | **HOÀN TẤT NGHIỆM THU ĐỢT 1A (`1.4.0-rc.1`)** | Hồ sơ nghiệm thu chi tiết Đợt Pilot 1A (`server/knowledge-base/*`, `scripts/kb-*`, 3 route `server.ts`, client `citationAudit`), trạng thái dữ liệu mẫu `sample: true` và kết quả chạy thực tế `verify:all` (`verify:kb`). |
| [`docs/fast-sweep-fix-plan.md`](fast-sweep-fix-plan.md) | **ĐÃ DUYỆT THI CÔNG (`1.4.0-rc.2`, `QĐ-F1..QĐ-F4`)** | Kế hoạch tái dựng hiện trường, phản biện Panel & chi tiết sửa Fast-Sweep (`executor.ts`, `allocator.ts`, `server.ts`, `DetailedDossierModal.tsx`, `verify-key-pool.ts`). |
| [`docs/fast-sweep-claude-review-v2.md`](fast-sweep-claude-review-v2.md) | **BIÊN BẢN PHẢN BIỆN VÒNG 2 (`FS2-01..FS2-07`)** | Phản biện vòng 2 của Muse xác nhận & siết chặt `FS2-01` (`UNKNOWN` không ép 503), `FS2-02` (đếm theo lượt gọi), `FS2-03..FS2-06` cho lệnh `QĐ-F1..QĐ-F4`. |

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
