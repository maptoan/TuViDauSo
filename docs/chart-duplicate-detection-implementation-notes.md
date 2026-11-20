# GHI CHÚ TRIỂN KHAI & NGHIỆM THU — PHÁT HIỆN LÁ SỐ TRÙNG KHI LẬP LÁ SỐ (`docs/chart-duplicate-detection-implementation-notes.md`)

- **Loại tài liệu**: `[Tài liệu Nghiệm thu Triển khai Đợt 7]`
- **Trạng thái hiệu lực**: `ĐÃ HOÀN TẤT & ĐẠT 100% KIỂM THỬ TỰ ĐỘNG (22/22 verify:library)`
- **Áp dụng cho phiên bản ứng dụng**: `1.3.0-rc.1` (`package.json`: `"1.3.0"`, đồng bộ `/VERSION`)
- **Ngày hoàn tất**: `18/11/2026`
- **Tài liệu căn cứ**:
  - [`docs/chart-duplicate-detection-design-plan.md`](chart-duplicate-detection-design-plan.md) *(Bản POST-PANEL V2)*
  - [`docs/chart-duplicate-detection-expert-panel-review.md`](chart-duplicate-detection-expert-panel-review.md) *(`DM-01..DM-13`)*
  - [`docs/chart-duplicate-detection-claude-review-v2.md`](chart-duplicate-detection-claude-review-v2.md) *(Chốt `QĐ-M1..QĐ-M6` ngày `18/11/2026`)*

---

## 1. Danh Sách Tệp Đã Tạo Mới & Sửa Đổi

### 1.1. Tệp mã nguồn tạo mới
1. **`src/components/DuplicateChartPromptModal.tsx`**:
   - Modal **Trường hợp 2 (`near_match`)** hiển thị tối đa `5` ứng viên gần trùng kèm ghi chú `"5/{total}"` khi danh sách vượt trần (`DM-06`).
   - Hỗ trợ đầy đủ: nhãn `[Đã ghim]`, nhãn `[Lá số gốc vừa nạp để chỉnh sửa]` khi đi từ luồng `onLoadIntoFormToEditNew` (`QĐ-M2` / Mục 3.5), tiêu đề gọn kèm nơi sinh + giờ sinh + trích đoạn `80` ký tự `notes` khi lá số ẩn danh (`anon`, `DM-13`), badge tiến độ hồ sơ thời gian thực (`X/8 Chương` hoặc `"Đang đồng bộ từ IndexedDB..."` theo `ĐC-1`).
   - Khung cảnh báo màu **Hổ phách** khi lá số ứng viên khác cấu trúc 12 cung so với form vừa nhập (`DM-05`), bảng đối chiếu từng trường đẩy các trường `affectsChartStructure = true` lên đầu có nhãn `Đổi cấu trúc 12 cung`, nút hành động động `"Mở lá số cũ đã lưu ({Giờ} · Mệnh {Cung})"` khi khác cấu trúc 12 cung, nút `"Lập lá số mới theo thông tin vừa nhập"`, nút `"Quay lại sửa thông tin"`, và ghi chú bảo toàn cô lập khóa (**Zero Cross-Key Contamination**).

### 1.2. Tệp mã nguồn & kiểm thử sửa đổi
1. **`src/lib/chart-library.ts`** *(Mục 10B + `initChartLibrary` `DM-01`)*:
   - **`initChartLibrary(currentForm)`**: Thiết lập `hydrationStatus = 'hydrating'` và gọi đồng bộ `migrateLegacyHistoryAndDossiers(currentForm)` ngay trước `notifyLibraryListeners()` và IIFE `async` mở `IndexedDB`, bảo đảm hồ sơ trong `ziwei_history` / `sessionStorage` sẵn sàng kiểm tra trùng ngay từ lần bấm lập lá số đầu tiên (`DM-01`, `QĐ-M3`).
   - **`resolveEffectiveDossierSummaryForEntry(entry, hydrationStatus)`**: Hợp nhất số chương thực từ `getDossierReadState(entry.chartIdentityKey)` khi `readState.record !== null` (`computeDossierSummary(readState.record)`) cho cả `exact_match` và `near_match` (`DM-01`, `QĐ-M3`).
   - **`diffBirthFormsForDuplicateModal(candidateForm, incomingForm, incomingChart)`**: So sánh 11 trường giữ liệu sinh, dùng `formToBirthInfo` + `formToTrueSolarTime` tính kinh độ hiệu lực để tách riêng `location` và `longitude` (`DM-05`), có chốt fallback qua `buildChartIdentityKey` khi không tìm thấy field diff, và sắp xếp ổn định các trường có `affectsChartStructure = true` lên đầu bảng.
   - **`computeNearMatchSimilarityScore(input)`**: Chấm điểm đa tầng `1000` (trùng tiền tố 5 thành phần) + `300` (trùng tên chuẩn hóa khác `'anon'` dài $\ge 2$) / `150` (trùng `customAlias` chuẩn hóa khác `'anon'` dài $\ge 2$) + `50` (`pinned`) + `completedCount * 5` (`DM-06`).
   - **`detectChartDuplicateInLibrary(form, chart, nowMs)`**: Hàm thuần chỉ đọc **100%** (không gọi `recordChartEntry`, không sửa `updatedAt`, không đụng `deletedTombstones`), trả về `'exact_match'` / `'near_match'` (tối đa `MAX_NEAR_MATCH_CANDIDATES = 5`) / `'none'`.
   - Cập nhật `appVersion: '1.3.0-rc.1'` trong `buildSingleEntryBundle` và `exportLibraryBundle`.
2. **`src/components/BirthForm.tsx`** *(`QĐ-M4`, `QĐ-M5`)*:
   - Export kiểu `ChartGenerationSource = 'user_form_submit' | 'famous_preset'` và `BirthFormInlineDuplicateNotice`.
   - Mở rộng `onChartGenerated(chart, form, source?)`: `handleSubmit` truyền `'user_form_submit'`; `handleFamousLoad` truyền `'famous_preset'`.
   - Hiển thị hộp thông báo nội tuyến `inlineDuplicateNotice` ngay phía trên nút submit khi `exact_match` (`DM-07`, `DM-12`).
3. **`src/components/ChartLibraryModal.tsx`**:
   - Cập nhật `appVersion: '1.3.0-rc.1'` trong `handleRedownloadEvictedBackup`.
4. **`src/App.tsx`** *(`QĐ-M1..QĐ-M5`)*:
   - Tích hợp `handleBirthFormChartGenerated(generatedChart, generatedForm, source)` xử lý đủ 3 nhánh `exact_match`, `near_match` (chỉ khi `source === 'user_form_submit'`) và `none`.
   - Khi `exact_match`: tái tạo `savedChart = buildChartFromForm(entry.form)` (`DM-02`), cập nhật banner tự ẩn sau `15 giây` (chỉ đếm khi `hydrationStatus === 'ready' | 'degraded'`, tạm dừng khi `hover`/`focus`/`touch`), cuộn mượt tới banner (`summaryBannerRef`), giữ thông báo nội tuyến ở `BirthForm`, và cập nhật live số chương `X/8` qua `resolvedExactMatchNotice` (`DM-07`, `DM-12`).
   - Xử lý `DuplicateChartPromptModal` với **`Stale Entry Guard` (`DM-08`)** trong `handleDuplicateChooseExisting`, nạp độc lập `entry.form` với `entry.chartIdentityKey` mà tuyệt đối không sao chép chương (**Zero Cross-Key Contamination**), và truyền `hasOtherOverlayOpen={pendingDuplicatePrompt !== null || ...}` cho `KeyPoolModal`.
   - Nối `editingSourceEntryKey` từ `ChartLibraryModal.onLoadIntoFormToEditNew` để gắn nhãn `[Lá số gốc vừa nạp để chỉnh sửa]`, và truyền `'famous_preset'` cho `handleFamousSelect` ở tab Danh nhân.
5. **`scripts/verify-chart-library.ts`**:
   - Bổ sung 5 bài kiểm thử mới **`TEST-L18..TEST-L22`** (tổng **`22/22`** bài đạt).

### 1.3. Tệp phiên bản & tài liệu đã tạo mới / cập nhật
1. `/VERSION` (`1.3.0-rc.1`), `/package.json` (`"version": "1.3.0"`), `/CHANGELOG.md` (`[1.3.0-rc.1]`).
2. `docs/decisions-registry.md` (bổ sung **Đợt 7 — `QĐ-M1..QĐ-M6`**), `docs/features-dossier-and-chat.md` (bổ sung **Mục 6.4**), `docs/INDEX.md`.
3. `docs/chart-duplicate-detection-claude-review-v2.md` & `docs/chart-duplicate-detection-implementation-notes.md` (tệp này).

---

## 2. Kết Quả Kiểm Chứng Thực Tế (Observed Results)

Tất cả các lệnh kiểm tra dưới đây đều được chạy trực tiếp sau các chỉnh sửa mã nguồn và cấu hình phiên bản cuối cùng:

| Lệnh kiểm tra | Kết quả quan sát | Chi tiết chính |
|---|---|---|
| `npm run lint` (`tsc --noEmit`) | **PASS (`0` lỗi)** | `Linting completed successfully` |
| `npm run build` (`vite build`) | **PASS** | `Build succeeded - the applet is compiled` |
| `npm run verify:key-pool` | **PASS (`18/18`)** | `=== TẤT CẢ 18 BÀI KIỂM THỬ KHO KHÓA, BATCH PROBE, B2 & H4 (NV-01) ĐỀU ĐẠT ===` |
| `npm run verify:dossier-context` | **PASS (`6/6`)** | `=== TẤT CẢ 6 BÀI KIỂM THỬ DOSSIER CONTEXT, HORIZON & PHA 1 ĐỀU ĐẠT ===` |
| `npm run verify:dossier-ui` | **PASS (`18/18`)** | `Kết quả verify-dossier-chat-ui: 18/18 bài kiểm chứng ĐẠT.` |
| `npm run verify:yunxian` | **PASS (exit code `0`)** | Hoàn tất xuất & kiểm tra bảng dữ kiện Vận Hạn 12 cung Tam Phương Tứ Chính |
| `npm run verify:library` (`TEST-L01..L22`) | **PASS (`22/22`)** | `Chart Library verification summary: 22/22 passed.` |
| Rà soát runtime & ràng buộc phạm vi | **CLEAN** | 0 `window.alert`/`window.confirm`/`window.open` trong `src/`, không chỉnh sửa `server.ts`, không mở route API mới, không tạo `backup/` mới |

---

## 3. Đối Chiếu Tuân Thủ `QĐ-M1..QĐ-M6` & Ghi Nhận Điểm Sai Khác Nhỏ So Với V2

1. **Đối chiếu quyết định chốt (`QĐ-M1..QĐ-M6`)**:
   - `QĐ-M1` (`Phương án A`): Trường hợp 1 (`exact_match`) chỉ hiện thông báo và tự động nạp lại, không đặt nút xóa hồ sơ trên banner.
   - `QĐ-M2` (`Phương án B siết chặt DM-05 + DM-13`): Đủ cả Nhánh 1 và Nhánh 2 (khớp tên/`customAlias` khác `'anon'` dài $\ge 2$ + cùng ngày/tháng/năm Dương lịch + cùng giới tính + lệch giờ/phút/`unknownTime`/kinh độ), cảnh báo Hổ phách khi khác cấu trúc 12 cung, nhãn nút động theo giờ & Mệnh cung, tách riêng `location`/`longitude`, tiêu đề gọn kèm 80 ký tự `notes` cho `anon`, badge `[Lá số gốc vừa nạp để chỉnh sửa]`.
   - `QĐ-M3` (`Phương án A chuẩn hóa DM-01 + DM-11`): `migrateLegacyHistoryAndDossiers` chạy đồng bộ ngay đầu `initChartLibrary` khi `hydrationStatus = 'hydrating'`; `detectChartDuplicateInLibrary` thuần 100%; dùng `resolveEffectiveDossierSummaryForEntry` cho cả `exact_match` và `near_match`.
   - `QĐ-M4` (`Phương án A DM-04`): Tách nguồn `'user_form_submit'` và `'famous_preset'`, lá số mẫu nổi tiếng không bật `DuplicateChartPromptModal`.
   - `QĐ-M5` (`Phương án A mở rộng DM-07 + DM-12`): Phản hồi kép (banner dưới Quick Summary Bar + hộp thông báo nội tuyến trong `BirthForm.tsx` + cuộn mượt), đếm ngược `15s` tạm dừng khi tương tác và chỉ chạy sau khi hydration kết thúc, phân biệt câu chữ `isAlreadyActiveOnBoard`.
   - `QĐ-M6` (`Phương án A DM-10`): `/VERSION = 1.3.0-rc.1`, `package.json` `"version": "1.3.0"`.
2. **Điểm tinh chỉnh nhỏ so với tên kiểu trong tài liệu V2**:
   - **Tên kiểu `LibraryDossierSummary`**: Phần mô tả trong bản POST-PANEL V2 có chỗ nhắc tên `ChartLibraryDossierSummary`, trong khi kiểu thật đã xuất khẩu sẵn trong `src/lib/chart-library.ts` là `LibraryDossierSummary`. Mã nguồn triển khai thống nhất dùng kiểu thật `LibraryDossierSummary` để giữ đồng bộ 100% với codebase hiện hữu.
   - **Thứ tự khởi tạo `hydrationStatus` trong `initChartLibrary` (`DM-01`)**: Đặt `hydrationStatus = 'hydrating'` trước khi gọi đồng bộ `migrateLegacyHistoryAndDossiers(currentForm)` giúp `persistDossierToTargets` xếp hàng các bản ghi hồ sơ legacy vào `pendingDossierMutations` thay vì gọi `runtimeIdbAdapter.put` sớm trước khi `IndexedDB` hoàn tất mở kết nối.

---

> **Đính chính hậu kiểm (`18/11/2026`)**: Bản ghi ban đầu liệt kê `src/components/ChartLibraryModal.tsx` trong danh sách tệp của lượt chính `1.3.0-rc.1` là không chính xác; thực tế tệp chỉ được sửa ở lượt vá bổ sung sau đó (đổi chuỗi `appVersion` từ `'1.2.0-rc.2'` → `'1.3.0-rc.1'` trong `handleRedownloadEvictedBackup`), còn danh sách tệp thực sửa/tạo ở lượt chính giữ nguyên `13` tệp như Action history đã ghi nhận.
