# GHI CHÚ TRIỂN KHAI & NGHIỆM THU — BẢN VÁ RÒ DỮ LIỆU CHÉO CHƯƠNG 5/6 (`docs/chart-library-cross-chart-leak-implementation-notes.md`)

- **Loại tài liệu**: `[Tài liệu Nghiệm thu Bản vá Nghiêm trọng — 1.2.0-rc.2]`
- **Trạng thái hiệu lực**: `ĐÃ HOÀN TẤT & ĐẠT 100% KIỂM THỬ TỰ ĐỘNG (17/17 verify:library)`
- **Áp dụng cho phiên bản ứng dụng**: `1.2.0-rc.2` (`package.json`: `"1.2.0"`, đồng bộ `/VERSION`)
- **Ngày hoàn tất**: `18/11/2026`
- **Tài liệu căn cứ**:
  - [`docs/chart-library-cross-chart-leak-fix-plan.md`](chart-library-cross-chart-leak-fix-plan.md) *(Bản POST-PANEL V2)*
  - [`docs/chart-library-cross-chart-leak-expert-panel-review.md`](chart-library-cross-chart-leak-expert-panel-review.md) *(`LK-01..LK-10`)*
  - [`docs/chart-library-cross-chart-leak-claude-review-v2.md`](chart-library-cross-chart-leak-claude-review-v2.md) *(Chốt `QĐ-L8` Phương án B tăng cường `C1+`, `QĐ-L9` Phương án A có cổng lũy đẳng)*

---

## 1. Danh Sách Tệp Đã Tạo Mới & Sửa Đổi

### 1.1. Tệp mã nguồn đã sửa đổi (Đúng phạm vi 4 tệp ứng dụng + 1 tệp kiểm thử)
1. **`src/lib/chart-library.ts`** *(Mục vá 1 + `QĐ-L8`/`QĐ-L9`/`LK-05`/`LK-10`)*:
   - **`migrateLegacyHistoryAndDossiers`**: Loại bỏ hoàn toàn `fivePartCount`, Bậc 2 (`legacyFivePartKey`) và Bậc 3 (`nameSlug` / `isUniqueFivePart`) ở cả vòng lặp `legacyEntries` lẫn nhánh cứu hộ `currentForm`; chỉ gắn hồ sơ phiên từ `sessionStorage` khi khớp **100% khóa 9 thành phần `chartIdentityKey`** và `rawOrphan.chartIdentityKey` hợp lệ.
   - Bổ sung kiểm tra `deletedTombstones` (`deletedAt >= savedAt`) để chống hồi sinh mục đã xóa còn sót trong `ziwei_history` (`LK-05`); `removeLibraryEntry(..., { deleteMode: 'entry_and_dossier' })` đồng thời xóa mục tương ứng khỏi `localStorage['ziwei_history']` qua `removeKeyFromLegacyHistory`.
   - Bổ sung **Dirty/No-Op Guard** so sánh với bản đã lưu trong `inMemoryDossierMirror` / `hotCache` trước khi gọi `persistDossierToTargets`, và chỉ gọi `writeLibraryIndexStore` khi `migratedEntries > 0 || linkedDossiers > 0 || summaryUpdatedCount > 0`.
   - Bổ sung kiểm tra `parsed.chartIdentityKey === chartIdentityKey` trong `readHotDossierFromLocalStorage`, `getBestKnownDossierSync` và `getDossierReadState`; trong `sanitizeFullDossierRecord`, bỏ qua chương lẻ có `sectionCacheKey` mang tiền tố của lá số khác (`LK-10`).
   - Bổ sung **`removeSingleDossierChapterFromLibrary(chart, chapterId, nowMs)`** phục vụ xóa riêng từng chương ở cả 4 tầng lưu trữ kèm trả về `previousRecord` để hoàn tác trong phiên (`QĐ-L8 C1+`), và cập nhật `appVersion: '1.2.0-rc.2'` trong `buildSingleEntryBundle` & `exportLibraryBundle`.
2. **`src/lib/dossier-chat-ui.ts`** *(Mục vá 2 + `LK-01`/`LK-10`)*:
   - `readDossierCacheEntry`: Từ chối bản ghi từ authoritative bridge hoặc `sessionStorage` nếu `chartIdentityKey` nội bộ khác khóa đang tra cứu (`LK-10`).
   - `resolveDossierChapterFromCaches`: Bắt buộc `rawLocal && rawLocal.sectionCacheKey === sectionCacheKey` cho cả nhánh kỳ hạn (`year_2026`, `year_2027` gồm `'loading'` và `sourceBadge`) lẫn nhánh thường (`LK-01`).
3. **`src/components/DetailedDossierModal.tsx`** *(Mục vá 3A + `QĐ-L8 C1+` + `LK-06`/`LK-09`)*:
   - Di chuyển khai báo `stopAllGeneration` lên trước `useEffect` nạp hồ sơ để tránh lỗi TDZ; bổ sung `isGeneratingRef` tránh re-trigger khi trạng thái stream bật/tắt.
   - Trong `useEffect` nạp hồ sơ (thêm `open` và `stopAllGeneration` vào dependency array): khi `isChartChanged === true`, reset `selectedChapterId`, hủy xác nhận/undo tạm, gọi `stopAllGeneration()` nếu luồng cũ đang chạy, và xóa `localChapters` về `{}` khi chưa có `stored` kể cả lúc `!isHydrated`; chỉ nhận bản ghi có `rawStored.chartIdentityKey === chartIdentityKey` và bỏ qua section lệch `sectionCacheKey` (`ĐC-3`). Khi cùng lá số (`!isChartChanged`), dùng functional update bảo toàn chương `'loading'` / mới hơn và tự dọn sạch nếu storage rỗng sau khi đã hydrated (`LK-09`).
   - Bổ sung nút **"Xóa chương này"** (hiển thị cho chương `'completed'`/`'incomplete'` khi không bận), xác nhận 2 bước tại chỗ và banner **"Hoàn tác"** trong phiên, đồng bộ xóa/khôi phục khóa kỳ hạn trong `aiPeriodCache`.
4. **`src/App.tsx`** *(Mục vá 3B + `LK-09`)*:
   - Bổ sung `handleRemoveLibraryEntry(targetKey, deleteMode)` gọi `removeEntry(targetKey, deleteMode)` và xóa toàn bộ các khóa bắt đầu bằng `${targetKey}__` khỏi `aiPeriodCache`, truyền cho cả `<BirthForm onRemoveHistory={...} />` lẫn `<ChartLibraryModal onRemoveEntry={...} />`.
5. **`src/components/ChartLibraryModal.tsx`**:
   - Cập nhật `appVersion: '1.2.0-rc.2'` trong `handleRedownloadEvictedBackup`.
6. **`scripts/verify-chart-library.ts`** *(Mục vá 4 + `LK-01`/`LK-02`)*:
   - Cập nhật `TEST-L04` kiểm chứng cô lập khóa 5 thành phần cũ (`legacyFivePartDossier` giữ nguyên tại `sessionStorage`, `completedCount === 0`, `idb.get(canonicalKey) === null`).
   - Bổ sung 5 bài kiểm thử mới `TEST-L13..TEST-L17` (tổng **`17/17`** bài kiểm thử).

### 1.2. Tệp tài liệu & phiên bản đã tạo mới / cập nhật
1. `/VERSION` & `/CHANGELOG.md`: Nâng lên `1.2.0-rc.2` (`package.json` giữ nguyên `"version": "1.2.0"`).
2. `docs/decisions-registry.md`, `docs/features-dossier-and-chat.md`, `docs/chart-library-implementation-notes.md`, `docs/INDEX.md`.
3. `docs/chart-library-cross-chart-leak-claude-review-v2.md` & `docs/chart-library-cross-chart-leak-implementation-notes.md` (tệp này).

---

## 2. Kết Quả Kiểm Chứng Thực Tế (Observed Results)

Tất cả các lệnh kiểm tra dưới đây được chạy trực tiếp sau chỉnh sửa mã nguồn `.ts`/`.tsx` cuối cùng:

| Lệnh kiểm tra | Kết quả quan sát | Chi tiết chính |
|---|---|---|
| `npm run verify:key-pool` | **PASS (`18/18`)** | `=== TẤT CẢ 18 BÀI KIỂM THỬ KHO KHÓA, BATCH PROBE, B2 & H4 (NV-01) ĐỀU ĐẠT ===` |
| `npm run verify:dossier-context` | **PASS (`6/6`)** | `=== TẤT CẢ 6 BÀI KIỂM THỬ DOSSIER CONTEXT, HORIZON & PHA 1 ĐỀU ĐẠT ===` |
| `npm run verify:dossier-ui` | **PASS (`18/18`)** | `Kết quả verify-dossier-chat-ui: 18/18 bài kiểm chứng ĐẠT.` |
| `npm run verify:yunxian` | **PASS (exit code `0`)** | Xuất và kiểm tra thành công bảng dữ kiện Vận Hạn 12 cung Tam Phương Tứ Chính |
| `npm run verify:library` (`TEST-L01..L17`) | **PASS (`17/17`)** | `Chart Library verification summary: 17/17 passed.` |
| `compile_applet` (`npm run build`) & `lint_applet` (`npm run lint`) | **PASS (`0` lỗi)** | Đồng thực thi kiểm tra cuối sau khi hoàn tất toàn bộ mã nguồn và tài liệu |
| Ràng buộc phạm vi (`server.ts`, `backup/`, `package.json`) | **CLEAN** | Không chạm `server.ts`, không mở route API mới, giữ `"version": "1.2.0"` trong `package.json`, không tạo `backup/` mới |

---

## 3. Ghi Nhận Điểm Kỹ Thuật Chú Ý Trong Quá Trình Thi Công

1. **Ngưỡng so sánh Dirty/No-Op Guard khi di trú từ `sessionStorage` (`TEST-L03` vs `LK-05`)**:
   - Trong `migrateLegacyHistoryAndDossiers`, đối tượng so sánh thay đổi (`persistedAuthoritative`) dùng `inMemoryDossierMirror.get(chartIdentityKey) ?? readHotDossierFromLocalStorage(chartIdentityKey)` thay vì `getBestKnownDossierSync` (vốn có nhánh fallback sang `sessionStorage`). Nhờ đó, lần di trú đầu tiên từ `sessionStorage` hợp lệ (`TEST-L03`) vẫn ghi đúng vào `IndexedDB`/gương RAM, còn các lần khởi tạo lặp lại khi dữ liệu đã nằm trong `IndexedDB`/RAM sẽ đạt 0 ghi thừa (`LK-05`).
2. **Bảo vệ TDZ & đồng bộ xóa Chương 5/6 với `aiPeriodCache` trong `DetailedDossierModal.tsx`**:
   - Khối `stopAllGeneration` được chuyển lên trước `useEffect` nạp hồ sơ để tránh `ReferenceError` (TDZ) khi đưa `stopAllGeneration` vào dependency array.
   - Khi người dùng bấm *"Xóa chương này"* hoặc *"Hoàn tác"* trên `year_2026` / `year_2027`, `DetailedDossierModal.tsx` cũng cập nhật đồng bộ `aiPeriodCache[buildPeriodCacheKeyForYear(chart, yr)]` qua `onAiPeriodCacheChange` để giao diện và tab Vận Hạn khớp tức thì.
