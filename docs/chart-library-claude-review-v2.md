# BIÊN BẢN KIỂM CHỨNG VÒNG 2 & ĐIỀU CHỈNH BẮT BUỘC — THƯ VIỆN LÁ SỐ (`docs/chart-library-claude-review-v2.md`)

- **Loại tài liệu**: `[Tài liệu Phản biện Kỹ thuật Vòng 2 — Đã Chốt & Đã Thi Công]`
- **Trạng thái hiệu lực**: `ĐANG HIỆU LỰC (CHỐT ĐỢT 6)`
- **Áp dụng cho phiên bản ứng dụng**: `1.2.0-rc.1` *(đồng bộ với `/VERSION`)*
- **Ngày lập & chốt**: `17/11/2026`
- **Tài liệu đối chiếu**: [`docs/chart-library-design-plan.md`](chart-library-design-plan.md) *(Bản POST-PANEL V2)*, [`docs/chart-library-expert-panel-review.md`](chart-library-expert-panel-review.md)
- **Nguyên tắc hiệu lực**: 6 điều chỉnh bắt buộc **`ĐC-1` .. `ĐC-6`** trong tài liệu này **thắng thế (override)** bất kỳ chi tiết nào còn mâu thuẫn trong bản Panel trước đó.

---

## 1. Căn Cứ Hiện Trạng Đã Kiểm Chứng Trên Mã Nguồn Thật

Trước khi thi công tính năng **Thư Viện Lá Số**, các điểm sau đã được đối chiếu trực tiếp trên cây mã nguồn hiện hành:

1. **Lịch sử cũ (`backup/v1.0.0-stable/src/lib/ziwei/history.ts:4–5, 39–52`)**:
   - Dùng `STORAGE_KEY = 'ziwei_history'` với trần cứng `MAX_ENTRIES = 10` trong `window.localStorage`.
   - Bộ lọc chống trùng trước đây chỉ so `year`, `month`, `day`, `gender`, `clockHour`, `clockMinute` — bỏ qua `name`, `city`/`province`, `longitude` và `unknownTime`, khiến 2 người khác nhau trùng ngày giờ sinh và giới tính ghi đè mất nhau.
2. **Kho Hồ Sơ 8 Chương & Khóa Định Danh (`src/lib/dossier-chat-ui.ts` & `src/lib/ziwei/yunxian-context.ts`)**:
   - `buildDossierStorageKey` (`src/lib/dossier-chat-ui.ts:84–86`) lưu hồ sơ theo tiền tố `ziwei_dossier_v1::${chartIdentityKey}` trong `window.sessionStorage` (`getBrowserSessionStorage`, `src/lib/dossier-chat-ui.ts:106–115`) với trần LRU `MAX_DOSSIERS_IN_SESSION = 5` (`src/lib/dossier-chat-ui.ts:91`).
   - Kiểu dữ liệu `StoredDossierRecord` (`src/lib/dossier-chat-ui.ts:760–764`, trước đó dòng `:750`) và pipeline hậu kiểm `sanitizeDossierChapterText` (`src/lib/dossier-chat-ui.ts:170–197`).
   - Tiến hóa khóa định danh: bản `1.0.0-stable` dùng khóa 5 thành phần `${year}_${month}_${day}_${hour}_${gender}` (`backup/v1.0.0-stable/src/lib/ziwei/yunxian-context.ts:298`); bản hiện tại `1.1.0+` dùng khóa 9 thành phần (`src/lib/ziwei/yunxian-context.ts:292–310`) gồm `nameSlug`, `mingGongBranch`, `leapFlag`, `origSig`, `lonSig` — đòi hỏi bộ di trú 3 bậc để không bỏ mồ côi hồ sơ cũ.
3. **Ràng buộc Server (`server.ts:460`)**:
   - Middleware JSON đặt giới hạn `app.use(express.json({ limit: '512kb' }))`, phù hợp mô hình hoàn toàn phía client (Phương án A), không mở thêm route `/api/library/*`.

---

## 2. Chốt Quyết Định Kiến Trúc `QĐ-L1` .. `QĐ-L7`

- **`QĐ-L1`**: Chọn **Phương án A** (lưu trữ client 2 tầng `localStorage` index + `IndexedDB` & gương RAM SSOT, xuất/nhập file `.JSON` di động có hợp nhất đơn điệu từng chương & `deletedTombstones`). **Loại hoàn toàn Phương án B** (trạm trung chuyển server) khỏi phạm vi — không tạo stub hay đường ống API thử nghiệm.
- **`QĐ-L2` .. `QĐ-L7`**: Thi công theo đúng **Phương án A** đã chi tiết hóa trong `docs/chart-library-design-plan.md` *(Bản POST-PANEL V2)* kết hợp 6 điều chỉnh bắt buộc dưới đây.

---

## 3. Sáu Điều Chỉnh Bắt Buộc Vòng 2 (`ĐC-1` .. `ĐC-6`)

| Mã ĐC | Tiêu đề | Quy tắc bắt buộc & Ràng buộc kiểm chứng |
|---|---|---|
| **`ĐC-1`** | **Cổng nạp dữ liệu (Hydration Gate)** | Đường đọc hồ sơ (`getDossierReadState`) phải phân biệt rõ `'chưa nạp xong IndexedDB'` (`idle`/`hydrating`) với `'không có hồ sơ'` (`ready`/`degraded` mà `record === null`). Trước khi hydration xong: `DetailedDossierModal` báo đang nạp từ IndexedDB, **cấm** kết luận `0/8`, **cấm** cho sinh chương ghi đè; mọi thao tác ghi phát sinh trong lúc hydration phải xếp hàng (`pendingDossierMutations`) để hợp nhất sau khi nạp xong, tuyệt đối không ghi đè dữ liệu sẵn có trong IndexedDB bằng bản ghi phiên thiếu. Kèm **`TEST-L11`** mô phỏng IndexedDB mở chậm. |
| **`ĐC-2`** | **Thu hồi an toàn (Safe Eviction Backup)** | Nấc 3–4 của thang thu hồi (hoặc bất kỳ mục nào CÓ chương hoàn tất) chỉ được xóa **SAU KHI** tự động tải xuống file `.JSON` sao lưu riêng của đúng mục đó (`entry + dossier`), cộng banner thông báo & nút hoàn tác (`undoLastEviction`) trong phiên. Nếu tự động tải xuống thất bại hoặc bị chặn, hủy thu hồi để bảo toàn dữ liệu — không đường nào được xóa lặng lẽ mục có hồ sơ. |
| **`ĐC-3`** | **Nguồn Sự Thật Duy Nhất (SSOT)** | `IndexedDB` (`ziwei_thien_ky_library_db_v1`) + gương RAM (`inMemoryDossierMirror`) là nguồn chuẩn duy nhất. Khóa `sessionStorage` `'ziwei_dossier_v1::*'` **chỉ là gương ghi-thông (write-through mirror)**; khi xảy ra sai lệch giữa `sessionStorage` và `IndexedDB`/gương RAM, `IndexedDB`/gương RAM luôn thắng. Ghi rõ quy tắc này bằng comment trực tiếp trong `src/lib/dossier-chat-ui.ts` và `src/lib/chart-library.ts`. |
| **`ĐC-4`** | **IndexedDB bị chặn / Chế độ suy giảm** | Thực hiện feature-detect `IndexedDB` (`isAvailable()`) ngay lúc khởi động. Nếu không dùng được, chuyển `storageHealth.mode = 'degraded_no_idb'`, `ChartLibraryModal` và `DetailedDossierModal` hiện cảnh báo cố định, hệ thống chạy suy giảm qua hot cache `localStorage` (tối đa 3 hồ sơ) + `sessionStorage` và nhắc người dùng xuất `.JSON` sao lưu. Kèm **`TEST-L12`** mô phỏng trình duyệt không có/chặn IndexedDB. |
| **`ĐC-5`** | **Chuẩn hóa không đổi danh tính** | `normalizeBirthFormForLibrary` **không cắt `form.name`** (bỏ hoàn toàn `.slice(0, 32)`) và không sửa bất kỳ trường nào ảnh hưởng khóa định danh khác với cách `buildChartIdentityKey(generateChart(formToBirthInfo(form)))` tự chuẩn hóa. Việc cắt ngắn chỉ thực hiện ở lớp hiển thị UI. |
| **`ĐC-6`** | **Phiên bản & Đồng bộ Tài liệu** | Sau khi triển khai đạt `lint` + `build` + `verify:all`: đặt `VERSION = '1.2.0-rc.1'`, `package.json` `"version": "1.2.0"`, ghi mục `CHANGELOG.md`, cập nhật `docs/INDEX.md`, `docs/features-dossier-and-chat.md`, `docs/decisions-registry.md` (ghi đủ `QĐ-L1..L7` + `ĐC-1..ĐC-6`), tạo `docs/chart-library-implementation-notes.md`. Không tạo thư mục `backup/` mới trong đợt này. |
