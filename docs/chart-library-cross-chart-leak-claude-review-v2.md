# BIÊN BẢN KIỂM CHỨNG VÒNG 2 & CHỐT QUYẾT ĐỊNH — VÁ LỖI RÒ DỮ LIỆU CHÉO (`docs/chart-library-cross-chart-leak-claude-review-v2.md`)

- **Loại tài liệu**: `[Tài liệu Kiểm chứng Độc lập Vòng 2 & Chốt Quyết định Thi công — Đã Hoàn tất]`
- **Trạng thái hiệu lực**: `ĐANG HIỆU LỰC (CHỐT & ĐÃ THI CÔNG TẠI 1.2.0-rc.2)`
- **Áp dụng cho phiên bản ứng dụng**: `1.2.0-rc.2` *(đồng bộ với `/VERSION`, `package.json`: `"1.2.0"`)*
- **Ngày lập & thi công**: `18/11/2026`
- **Tài liệu đối chiếu**: [`docs/chart-library-cross-chart-leak-fix-plan.md`](chart-library-cross-chart-leak-fix-plan.md) *(Bản POST-PANEL V2)*, [`docs/chart-library-cross-chart-leak-expert-panel-review.md`](chart-library-cross-chart-leak-expert-panel-review.md) *(`LK-01..LK-10`)*
- **Ghi chú nguyên tắc từ Chủ dự án**:
  > *"Không tự động xóa ngầm bất cứ dữ liệu nào khi khởi động (`QĐ-L8` = Phương án B tăng cường `C1+`); mọi di trú từ `ziwei_history` / `sessionStorage` chỉ được khớp chính xác 100% khóa 9 thành phần `chartIdentityKey` kèm kiểm tra `deletedTombstones` và cổng chống ghi thừa (`QĐ-L9` = Phương án A có cổng bảo vệ lũy đẳng)."*

---

## 1. Căn Cứ Hiện Trạng Đã Kiểm Chứng Trên Mã Nguồn Thật (`1.2.0-rc.1`)

Trước khi viết bản vá `1.2.0-rc.2`, 3 mắt xích gây rò Chương 5 (`year_2026`) và Chương 6 (`year_2027`) cùng 2 lỗ hổng phụ trợ đã được xác minh từng dòng trên mã nguồn `1.2.0-rc.1`:

1. **Thủ phạm chính (`src/lib/chart-library.ts` — `migrateLegacyHistoryAndDossiers`)**:
   - Bậc 2 (khớp `legacyFivePartKey`) và Bậc 3 (khớp `fivePartCount === 1` hoặc `nameSlug`) gắn hồ sơ phiên của người khác (đã rơi khỏi top-10 `ziwei_history`) sang lá số mới cùng ngày/canh giờ/giới tính, rồi `sanitizeFullDossierRecord` + `persistDossierToTargets` lưu cứng xuống cả 4 tầng (`inMemoryDossierMirror`, `localStorage`, `sessionStorage`, `IndexedDB`).
   - Nhánh cứu hộ `currentForm` cũng fallback theo `legacyFivePartKey`.
   - Ngoài ra, `migrateLegacyHistoryAndDossiers` chưa kiểm tra `deletedTombstones` và gọi ghi thừa ngay cả khi không có mục/chương mới (`LK-05`), còn `readHotDossierFromLocalStorage` / `getDossierReadState` chưa kiểm tra `parsed.chartIdentityKey === chartIdentityKey` (`LK-10`).
2. **Thủ phạm tầng Resolver (`src/lib/dossier-chat-ui.ts` — `resolveDossierChapterFromCaches`)**:
   - Không kiểm tra `rawLocal.sectionCacheKey === sectionCacheKey` ở cả nhánh kỳ hạn (`spec.mode === 'period'`) lẫn nhánh thường; `readDossierCacheEntry` cũng thiếu kiểm tra `stored.chartIdentityKey === chartIdentityKey` (`LK-10`).
3. **Thủ phạm tầng React Lifecycle (`src/components/DetailedDossierModal.tsx` & `src/App.tsx`)**:
   - Khi đổi sang lá số mới chưa có hồ sơ lúc `!isHydrated`, `localChapters` của lá số trước không bị xóa ngay; không gọi `stopAllGeneration()` khi `chartIdentityKey` đổi giữa lúc stream SSE (`LK-06`).
   - Khi bấm *"Chỉ xóa Hồ Sơ"* (`deleteMode: 'dossier_only'`) trong `ChartLibraryModal.tsx`, `App.tsx` không xóa `${key}__` khỏi `aiPeriodCache`, và `DetailedDossierModal.tsx` thiếu `open` trong dependency array của `useEffect` (`LK-09`).

---

## 2. Quyết Định Kiến Trúc Đã Chốt & Điều Chỉnh Bắt Buộc (`QĐ-L2`, `QĐ-L8`, `QĐ-L9`, `LK-01..LK-10`)

| Mã | Quyết định đã chốt | Ràng buộc thi công bắt buộc |
|---|---|---|
| **`QĐ-L2` *(cập nhật)*** | Chỉ di trú **exact 9-part `chartIdentityKey`** | Bỏ hoàn toàn Bậc 2 (`legacyFivePartKey`) và Bậc 3 (`nameSlug` / `fivePartCount === 1`) ở cả vòng lặp `legacyEntries` lẫn nhánh `currentForm`. Giữ nguyên mọi hồ sơ phiên chưa liên kết (`Unlinked Session Dossiers`, kể cả khóa 5 thành phần cũ) tại `sessionStorage`, không tự ý xóa và không tạo thẻ thư viện rác (`LK-04`). |
| **`QĐ-L8`** | **Phương án B tăng cường (`C1+`)** — Không xóa tự động ngầm | Bác bỏ tuyệt đối việc tự động quét/gỡ chương trùng văn bản khi khởi động (`LK-03`). Thay bằng 2 công cụ dọn chủ động: (i) *"Chỉ xóa Hồ Sơ"* (`dossier_only`) trong `ChartLibraryModal` kèm vá `LK-09` xóa đồng bộ `aiPeriodCache` và làm mới `localChapters`; (ii) thêm `removeSingleDossierChapterFromLibrary` và nút **"Xóa chương này"** trong `DetailedDossierModal.tsx` (xác nhận 2 bước tại chỗ + **Hoàn tác trong phiên** `undo`, đồng bộ `aiPeriodCache`). |
| **`QĐ-L9`** | **Phương án A có Cổng Bảo Vệ Lũy Đẳng** | Giữ cơ chế quét lũy đẳng khi khởi tạo nhưng bổ sung: (1) kiểm tra `deletedTombstones` để không hồi sinh mục đã xóa còn sót trong `ziwei_history`; (2) `removeLibraryEntry(..., { deleteMode: 'entry_and_dossier' })` đồng thời lọc bỏ khóa tương ứng khỏi `localStorage['ziwei_history']`; (3) Dirty/No-Op Guard chỉ gọi `persistDossierToTargets` và `writeLibraryIndexStore` khi thực sự có mục hoặc chương mới (`LK-05`). |
| **`LK-06` & `ĐC-1`/`ĐC-3`** | Chống race condition & Bảo toàn cổng Hydration | Khi đổi lá số (`isChartChanged`): hủy ngay SSE cũ (`stopAllGeneration()`), xóa `localChapters` về `{}` nếu chưa có `stored` (vẫn khóa nút sinh khi `!isHydrated` theo `ĐC-1`). Khi cùng lá số (`!isChartChanged`): dùng functional update `setLocalChapters((prev) => ...)` bảo toàn chương `'loading'` và chương vừa sinh mới hơn. Chỉ nhận bản ghi có `chartIdentityKey` & `sectionCacheKey` khớp 100% (`ĐC-3`, `LK-10`). |
| **`LK-01` & `LK-02`** | Phủ kiểm thử hồi quy **`17/17`** | Cập nhật `TEST-L04` xác nhận cô lập khóa 5 thành phần cũ; tách bạch 5 bài mới `TEST-L13..TEST-L17` trong `scripts/verify-chart-library.ts`. |

---

## 3. Khẳng Định Phạm Vi An Toàn

- **Không** sửa `server.ts` và không mở route API mới (`QĐ-L7`).
- **Không** sửa `package.json` `"version"` (`"1.2.0"` giữ nguyên); chỉ nâng `/VERSION` lên `1.2.0-rc.2`.
- **Không** tạo thư mục `backup/` mới và không đẩy lên GitHub.
