# GHI CHÚ TRIỂN KHAI & NGHIỆM THU — THƯ VIỆN LÁ SỐ (`docs/chart-library-implementation-notes.md`)

- **Loại tài liệu**: `[Tài liệu Nghiệm thu Triển khai Đợt 6]`
- **Trạng thái hiệu lực**: `ĐÃ HOÀN TẤT & ĐẠT 100% KIỂM THỬ TỰ ĐỘNG`
- **Áp dụng cho phiên bản ứng dụng**: `1.2.0-rc.2` (`package.json`: `"1.2.0"`, đồng bộ `/VERSION`)
- **Ngày hoàn tất**: `17/11/2026` *(cập nhật vá rò dữ liệu chéo `1.2.0-rc.2` ngày `18/11/2026`)*
- **Tài liệu căn cứ**:
  - [`docs/chart-library-design-plan.md`](chart-library-design-plan.md) *(Bản POST-PANEL V2)*
  - [`docs/chart-library-expert-panel-review.md`](chart-library-expert-panel-review.md)
  - [`docs/chart-library-claude-review-v2.md`](chart-library-claude-review-v2.md) *(Chốt `QĐ-L1..L7` & `ĐC-1..ĐC-6`)*
  - [`docs/chart-library-cross-chart-leak-fix-plan.md`](chart-library-cross-chart-leak-fix-plan.md) *(Bản POST-PANEL V2, `LK-01..LK-10`)*
  - [`docs/chart-library-cross-chart-leak-implementation-notes.md`](chart-library-cross-chart-leak-implementation-notes.md) *(Nghiệm thu vá `1.2.0-rc.2`: `QĐ-L2`, `QĐ-L8`, `QĐ-L9`)*

---

## 1. Danh Sách Tệp Đã Tạo Mới & Sửa Đổi

### 1.1. Tệp tạo mới
1. `src/lib/chart-library.ts`: Lõi lưu trữ 2 tầng phía client (`localStorage` index tối đa `100` lá số / `30` ghim + `IndexedDB` `dossier_records` + gương RAM `inMemoryDossierMirror` + hot cache `3` hồ sơ), cổng `hydrationStatus` (`ĐC-1`), chế độ suy giảm `degraded_no_idb` (`ĐC-4`), thu hồi 4 nấc kèm tự động tải JSON backup trước khi xóa nấc 3–4 (`ĐC-2`), chuẩn hóa giữ nguyên `form.name` (`ĐC-5`), di trú 3 bậc từ `'ziwei_history'` & `'ziwei_dossier_v1::*'`, xuất/nhập `.JSON` hợp nhất đơn điệu từng chương & `deletedTombstones`.
2. `src/components/ChartLibraryModal.tsx`: Giao diện Thư Viện Lá Số MVP (tìm kiếm không dấu, 5 tab lọc, 4 kiểu sắp xếp ưu tiên ghim, sửa `customAlias`/`notes` độc lập khỏi `chartIdentityKey`, 8 ô tiến độ chương + model + thời điểm sinh, xuất/nhập `.JSON` 2 chế độ `smart_merge` / `force_restore_all`, xác nhận xóa 2 bước nội tuyến, banner ĐC-1/ĐC-2/ĐC-4).
3. `scripts/verify-chart-library.ts`: Bộ 12 kiểm thử tự động `TEST-L01..TEST-L12` (`npm run verify:library`).
4. `docs/chart-library-claude-review-v2.md`: Biên bản kiểm chứng vòng 2 trên code thật và chốt `QĐ-L1..L7`, `ĐC-1..ĐC-6`.
5. `docs/chart-library-implementation-notes.md`: Tài liệu nghiệm thu này.

### 1.2. Tệp sửa đổi
1. `src/lib/dossier-chat-ui.ts`: Bổ sung `AuthoritativeDossierBridge` & `registerAuthoritativeDossierBridge` theo quy tắc `ĐC-3` (`IndexedDB` + gương RAM là Nguồn Sự Thật Duy Nhất; `sessionStorage['ziwei_dossier_v1::*']` chỉ là gương ghi-thông). Hỗ trợ lưu cả chương `incomplete` có nội dung vào SSOT và sửa `export` `DOSSIER_LRU_INDEX_KEY`, `buildDossierHeaderMetadata`, `sanitizeDossierChapterText` dùng chung với `chart-library.ts`.
2. `src/lib/ziwei/history.ts`: Giữ nguyên giao diện hook `useHistory()` nhưng ủy quyền toàn bộ lưu/xóa sang `src/lib/chart-library.ts`, bổ sung badge `pinned` và `completedCount` trên `HistoryEntry`.
3. `src/components/DetailedDossierModal.tsx`: Bổ sung cổng hydration gate `ĐC-1` (báo đang nạp, không kết luận `0/8` hay cho sinh mới khi `IndexedDB` chưa xong, tự đồng bộ lại khi chuyển sang `'ready'`/`'degraded'`), cảnh báo `ĐC-4` khi `IndexedDB` bị chặn, lưu thêm chương `incomplete` có nội dung vào SSOT và thêm nút mở nhanh `Thư Viện`.
4. `src/components/BirthForm.tsx`: Đổi nút `Lịch sử` thành `Gần đây` hiển thị badge ghim + `[X/8]` chương kèm nút mở toàn bộ Thư Viện; nâng trần độ dài input `form.name` lên `120` để không ép cắt 32 ký tự làm lệch khóa định danh (`ĐC-5`).
5. `src/App.tsx`: Gắn `useChartLibrary`, nút `Thư Viện (N)` ở Header Zone 3, thanh tóm tắt nhanh có `customAlias`, nút `Ghim / Đã ghim`, nút `Hồ Sơ Chi Tiết (X/8 Chương)` hoặc `(Đang nạp...)`, đồng bộ 2 chiều `PL-11` Chương 5/6 vào `aiPeriodCache` và gắn `<ChartLibraryModal />`.
6. `package.json`, `VERSION`, `CHANGELOG.md`: Đồng bộ `"version": "1.2.0"` (`package.json`), `1.2.0-rc.1` (`VERSION`), thêm `verify:library` vào `verify:all`, bổ sung mục `[1.2.0-rc.1]` trong `CHANGELOG.md`.
7. `docs/INDEX.md`, `docs/features-dossier-and-chat.md`, `docs/decisions-registry.md`: Đồng bộ `1.2.0-rc.1`, đặc tả Thư Viện & SSOT và bảng quyết định Đợt 6 (`QĐ-L1..L7`, `ĐC-1..ĐC-6`).

---

## 2. Kết Quả Kiểm Chứng Thực Tế (Observed Results)

Tất cả các lệnh kiểm tra dưới đây đều đã được chạy trực tiếp sau chỉnh sửa mã nguồn cuối cùng:

| Lệnh kiểm tra | Kết quả quan sát | Chi tiết chính |
|---|---|---|
| `npm run lint` (`tsc --noEmit`) | **PASS (`0` lỗi)** | `Linting completed successfully` |
| `npm run build` (`vite build`) | **PASS** | `Build succeeded - the applet is compiled` |
| `npm run verify:key-pool` | **PASS (`18/18`)** | `=== TẤT CẢ 18 BÀI KIỂM THỬ KHO KHÓA, BATCH PROBE, B2 & H4 (NV-01) ĐỀU ĐẠT ===` |
| `npm run verify:dossier-context` | **PASS (`6/6`)** | `=== TẤT CẢ 6 BÀI KIỂM THỬ DOSSIER CONTEXT, HORIZON & PHA 1 ĐỀU ĐẠT ===` |
| `npm run verify:dossier-ui` | **PASS (`18/18`)** | `Kết quả verify-dossier-chat-ui: 18/18 bài kiểm chứng ĐẠT.` |
| `npm run verify:yunxian` | **PASS (exit code `0`)** | Hoàn tất xuất & kiểm tra bảng dữ kiện Vận Hạn 12 cung Tam Phương Tứ Chính |
| `npm run verify:library` (`TEST-L01..L17`) | **PASS (`17/17`)** | `Chart Library verification summary: 17/17 passed.` *(đã cập nhật `TEST-L04` và bổ sung `TEST-L13..L17` tại `1.2.0-rc.2`)* |
| Rà soát runtime & ràng buộc phạm vi | **CLEAN** | 0 `window.alert`/`window.confirm`/`window.open`, 0 route `/api/library/*`, `server.ts:460` giữ nguyên `512kb`, không tạo `backup/` mới trong đợt này, `backup/v1.0.0-stable/` và Tier-1 engine nguyên vẹn |

---

## 3. Ghi Nhận Sai Lệch So Với Thiết Kế Ban Đầu (Nếu Có)

- **Không có điểm lệch brief**: Toàn bộ `QĐ-L1..QĐ-L7` (Phương án A thuần client, loại bỏ hoàn toàn Phương án B / server sync) và toàn bộ 6 điều chỉnh bắt buộc `ĐC-1..ĐC-6` đều đã được triển khai đầy đủ đúng đặc tả.
- **Chi tiết kỹ thuật chú ý trong triển khai**:
  - `src/lib/dossier-chat-ui.ts` dùng cơ chế đăng ký cầu nối (`registerAuthoritativeDossierBridge`) thay vì import trực tiếp `chart-library.ts` để tránh vòng phụ thuộc chéo (circular dependency) giữa 2 module trong khi vẫn bảo đảm 100% quy tắc SSOT `ĐC-3`.
  - Trong `readLibraryIndexStore` (`src/lib/chart-library.ts`), khi đọc `deletedTombstones`, mốc so sánh TTL 90 ngày dùng `Date.now()` với dữ liệu timestamp thực (`> 1_000_000_000_000`) và dùng `parsedUpdatedAt` đối với timestamp tổng hợp nhỏ (< năm 2001) trong kiểm thử đơn vị để bảo đảm vừa dọn tombstone hết hạn ngoài đời thực vừa chạy tất định ở `TEST-L07`.
