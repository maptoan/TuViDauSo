# BIÊN BẢN PHẢN BIỆN TỔ CHUYÊN GIA: KẾ HOẠCH THIẾT KẾ PHÁT HIỆN LÁ SỐ TRÙNG KHI LẬP LÁ SỐ (`docs/chart-duplicate-detection-expert-panel-review.md`)

- **Loại tài liệu**: `[Biên bản Phản biện & Tối ưu hóa Kỹ thuật — Tổ Chuyên Gia 5 Vai]`
- **Hình thức thực hiện**: **Mô phỏng đa vai trong một phiên làm việc duy nhất (Single-Session Simulated Multi-Role Expert Panel)**
- **Ngày thực hiện**: `18/11/2026`
- **Tài liệu đầu vào được thẩm định**: `docs/chart-duplicate-detection-design-plan.md` (Bản V1)
- **Tài liệu đầu ra sau thẩm định**: `docs/chart-duplicate-detection-design-plan.md` (**Bản POST-PANEL V2**)
- **Phiên bản mã nguồn đối chiếu (Code SSOT)**: `1.2.0-rc.2` (`package.json`: `"1.2.0"`, chưa sửa code trong lượt này)
  - `src/components/BirthForm.tsx` (`dòng 14–23, 35–63, 75–90, 152–204, 268–275, 516–543`)
  - `src/App.tsx` (`dòng 53–56, 98–166, 169–230, 244–264, 492–532, 570–601, 693–726`)
  - `src/lib/chart-library.ts` (`dòng 87–113, 471–540, 556–634, 666–699, 1251–1466, 1474–1623, 1712–1809, 1916–2076, 2558–2707`)
  - `src/lib/ziwei/yunxian-context.ts` (`dòng 292–310`)
  - `src/lib/ziwei/share.ts` (`dòng 23–80, 83–135`)
  - `scripts/verify-chart-library.ts` (`dòng 1–1178`)

---

## 1. Thành Phần Tổ Chuyên Gia Mô Phỏng (Trong Cùng Một Phiên)

1. **Vai 1 — Kiến trúc sư Lưu trữ & Khóa định danh (`Storage & Identity Key Architect`)**: Phụ trách tính thuần khiết của hàm phát hiện trùng, cấu trúc khóa 9 thành phần (`chartIdentityKey`) và tiền tố 5 thành phần (`legacyFivePartKey`), vòng đời hydration `ĐC-1`, và thứ tự ưu tiên ứng viên.
2. **Vai 2 — Chuyên gia UX Biểu mẫu (`Form & Interaction UX Specialist`)**: Phụ trách luồng nộp `BirthForm`, phân biệt nguồn gọi (`handleSubmit` vs `handleFamousLoad`), cơ chế đồng bộ ngược `lastSyncedInitialKeyRef`, tương tác ngăn kéo `showFormDrawer` trên Desktop/Mobile, và hành vi hiển thị Banner/Modal.
3. **Vai 3 — Kỹ sư Kiểm thử Hồi quy (`Regression QA Engineer`)**: Phụ trách rà soát trích dẫn `file:dòng`, tính tất định của thuật toán chấm điểm/sắp xếp, và đặc tả kiểm thử tự động `TEST-L18..TEST-L22` trong `scripts/verify-chart-library.ts`.
4. **Vai 4 — Chuyên gia An toàn Dữ liệu Chéo Khóa (`Cross-Key Data Safety Specialist`)**: Phụ trách bảo vệ nguyên tắc **Zero Cross-Key Contamination** (kế thừa từ bản vá `1.2.0-rc.2`), ngăn chặn mọi nguy cơ gắn nhầm `incomingForm` vào hồ sơ cũ hoặc bấm nhầm mở lá số khác cấu trúc 12 cung.
5. **Vai 5 — Đại diện Người dùng cuối (`End-User Advocate`)**: Bảo vệ tính rõ ràng của thông báo tiếng Việt, khả năng phân biệt các lá số ẩn danh/biệt danh (`customAlias`), và chống mất mát thao tác khi dữ liệu thay đổi giữa chừng.

---

## 2. Bảng Tổng Hợp Các Phát Hiện Phản Biện (`DM-01` .. `DM-13`)

| Mã phát hiện | Nguồn Agenda | Vai nêu chính | Mức độ | Tóm tắt phát hiện | Kết luận xử lý |
|---|---|---|---|---|---|
| **`DM-01`** | `ĐP-1` | Vai 1 & Vai 3 | **CAO** | Mục 4.1 của V1 cho `detectChartDuplicateInLibrary` tự gọi `migrateLegacyHistoryAndDossiers()` khi `hydrationStatus === 'idle'`, làm phá vỡ tính thuần khiết (pure function) và gây ghi xuống storage ngay từ tầng đọc/phát hiện. | **CHẤP NHẬN PHƯƠNG ÁN (b) CỦA MUSE**: Giữ `detectChartDuplicateInLibrary` thuần khiết 100% (chỉ đọc); chuyển việc gọi đồng bộ `migrateLegacyHistoryAndDossiers` về đầu `initChartLibrary` / `useChartLibrary`. |
| **`DM-02`** | `ĐP-2` | Vai 4 & Vai 1 | **CAO** | Mục 3.3 của V1 (hàng Trường hợp 1) đặt `setChart(incomingChart)` nhưng `setCurrentForm(existingEntry.form)`. Hai form cùng `chartIdentityKey` vẫn có thể lệch hoa/thường ở tên hoặc lệch kinh độ `< 0.005°`, gây bất nhất giữa tiêu đề Thiên Bàn và ô input Form. | **CHẤP NHẬN & SỬA TRONG V2**: Khi `exact_match`, luôn tái tạo `savedChart = buildChartFromForm(existingEntry.form)` từ `existingEntry.form` để nhất quán tuyệt đối 100%. |
| **`DM-03`** | `ĐP-3` | Vai 3 | **THẤP** | Mục 1.1 của V1 (`dòng 53`) ghi nhầm `upsertChartToLibrary` tại `chart-library.ts:1857–1949`, trong khi thực tế hàm nằm ở `dòng 1712–1795` (Mục 1.4 ghi đúng). | **CHẤP NHẬN & ĐÍNH CHÍNH TRONG V2** (`dòng 1712–1795`). |
| **`DM-04`** | `ĐP-4` | Vai 2 & Vai 3 | **CAO** | `BirthForm.handleSubmit` (`dòng 165`) và `handleFamousLoad` (`dòng 200`) dùng chung prop `onChartGenerated(chart, form)` không có tham số phân biệt nguồn gọi, trong khi `QĐ-M4` Phương án A đòi hỏi hành vi khác nhau giữa hai nguồn. | **CHẤP NHẬN & ĐẶC TẢ TRONG V2**: Thêm tham số `source?: 'user_form_submit' | 'famous_preset'` vào `onChartGenerated` và bổ sung kiểm thử cho cả hai nguồn. |
| **`DM-05`** | `ĐP-5` | Vai 4 & Vai 5 | **CAO** | Nhánh 2 của `QĐ-M2` (trùng tên + ngày sinh dương lịch + giới tính nhưng khác canh giờ) có nguy cơ báo nhiễu với tên ngắn hoặc khiến người dùng bấm nhầm `"Mở lá số đã lưu"` khi 2 bàn sao khác hẳn cung Mệnh. | **CHẤP NHẬN & SIẾT ĐIỀU KIỆN TRONG V2**: Bắt buộc tên chuẩn hóa khác `'anon'` (độ dài $\ge 2$) VÀ có lệch giờ/phút đồng hồ, `unknownTime` hoặc kinh độ; đồng thời hiển thị **Hộp cảnh báo màu Hổ phách** và đẩy các diff `affectsChartStructure = true` lên đầu bảng. |
| **`DM-06`** | `ĐP-6` | Vai 1 & Vai 3 | **CAO** | Công thức `similarityScore` tuyến tính ở Mục 2.3 của V1 cộng `completedCount * 10` (tối đa `+80`), khiến ứng viên **khác tên** có `8/8` chương (`180` điểm) xếp trên ứng viên **trùng tên** có `0/8` chương (`150` điểm) trong cùng nhóm tiền tố 5 thành phần. | **CHẤP NHẬN & ĐỔI SANG SẮP XẾP PHÂN TẦNG KHÔNG CHỒNG LẤN TRONG V2**: Tầng 1 (`same_five_part_key`: `+1000`) $\rightarrow$ Tầng 2 (`trùng tên/biệt danh`: `+300`, cùng `'anon'`: `+150`) $\rightarrow$ Tầng 3 (`pinned`: `+50`) $\rightarrow$ Tầng 4 (`completedCount * 5`: tối đa `+40` $< 50$) $\rightarrow$ Tầng 5 (`lastOpenedAt`). |
| **`DM-07`** | `ĐP-7` | Vai 2 & Vai 5 | **TRUNG BÌNH** | Mục 3.1 của V1 cho Banner Trường hợp 1 tự ẩn sau `8 giây`, quá ngắn khi trên Banner có nút hành động quan trọng `[Mở Hồ Sơ (X/8 Chương)]`. | **CHẤP NHẬN & SỬA TRONG V2**: Tăng thời gian tự ẩn lên **`15 giây` (`15_000 ms`)**, tạm dừng đếm khi di chuột/chạm (`hover`/`focus`/`touch`), và chỉ bắt đầu đếm sau khi `hydrationStatus` đã `'ready'`/`'degraded'`. |
| **`DM-08`** | `ĐP-8` | Vai 1 & Vai 2 | **CAO** | V1 chưa đặc tả trường hợp khi hộp thoại Trường hợp 2 đang mở mà danh sách `entries` thay đổi (do hydration hoàn tất hoặc mục bị xóa), dẫn tới nguy cơ bấm `"Mở lá số đã lưu"` trên một mục không còn tồn tại. | **CHẤP NHẬN & ĐẶC TẢ TRONG V2**: Tự động làm mới danh sách ứng viên theo `libraryEntries` khi đang mở modal; trước khi thực thi `"Mở lá số đã lưu"`, kiểm tra lại `readLibraryIndexStore().entries` theo `chartIdentityKey` (`Stale Entry Guard`). |
| **`DM-09`** | `ĐP-9` | Vai 3 | **CAO** | Đặc tả `TEST-L20` và `TEST-L22` Ca 2 trong V1 cần được cập nhật để phản ánh chính xác công thức sắp xếp phân tầng mới của `ĐP-6` và tính thuần khiết của `detectChartDuplicateInLibrary` theo `ĐP-1`. | **CHẤP NHẬN & CẬP NHẬT TRONG V2**: Viết lại assertions chi tiết cho `TEST-L20` (4 ứng viên chứng minh trùng tên `0/8` thắng khác tên `8/8`) và `TEST-L22` Ca 2 (gọi `detect` 2 lần liên tiếp không ghi storage). |
| **`DM-10`** | `ĐP-10` | Vai 1 | **THẤP** | Trong `QĐ-M6`, V1 còn để ngỏ việc giữ `package.json` `"version": "1.2.0"` khi nâng `/VERSION` lên `1.3.0-rc.1`. | **XÁC NHẬN KHUYẾN NGHỊ CỦA MUSE**: Chốt khuyến nghị `QĐ-M6` Phương án A là `/VERSION = 1.3.0-rc.1` kèm `package.json` `"version": "1.3.0"` (nhất quán tiền lệ bản `1.2.0-rc.1`). |
| **`DM-11`** | *Phát hiện mới của Panel* | Vai 1 & Vai 4 | **TRUNG BÌNH** | Trong V1 Mục 2.3 (`dòng 241`), việc dùng `Math.max(exactEntry.dossierSummary.completedCount, liveSummary.completedCount)` có thể báo sai nếu người dùng vừa xóa bớt chương (`liveSummary < dossierSummary`); đồng thời nhánh `near_match` chưa dùng `getDossierReadState`. | **CHẤP NHẬN & SỬA TRONG V2**: Thiết kế helper `resolveEffectiveDossierSummaryForEntry(entry, chart?)` dùng chung cho cả `exact_match` và `near_match`, ưu tiên `computeDossierSummary(readState.record)` khi `readState.record !== null`. |
| **`DM-12`** | *Phát hiện mới của Panel* | Vai 2 & Vai 5 | **TRUNG BÌNH** | Khi người dùng bấm lập lại đúng lá số **đang mở sẵn trên Thiên Bàn** (`activeChartIdentityKey === existingEntry.chartIdentityKey`) hoặc bấm từ `BirthForm` ở cuối trang mobile (`< 1280px`), họ có thể không thấy Banner ở đầu trang và thông báo chưa phân biệt trạng thái "đang mở sẵn". | **CHẤP NHẬN & BỔ SUNG TRONG V2**: Tinh chỉnh câu thông báo khi `isAlreadyActiveOnBoard === true`, kết hợp phản hồi nội tuyến ngay trên nút submit của `BirthForm` + tự cuộn mượt lên Banner nếu khuất tầm nhìn. |
| **`DM-13`** | *Giải quyết Mục 8 của V1* | Toàn bộ 5 vai | **TRUNG BÌNH** | 5 câu hỏi mở ở Mục 8 của V1 (`customAlias`, tách/gộp dòng diff Kinh độ, luồng sửa từ Thư Viện `onLoadIntoFormToEditNew`, vị trí hiển thị Banner, và định danh lá số ẩn danh `'anon'`) cần được chốt thành quy tắc kỹ thuật cụ thể. | **CHẤP NHẬN & TÍCH HỢP TRỌN VẸN VÀO V2** (xem chi tiết tại Mục 3.13 bên dưới). |

---

## 3. Chi Tiết Thảo Luận, Phân Tích Kỹ Thuật & Kết Luận Từng Điểm (`DM-01` → `DM-13`)

### 3.1. `DM-01` (`ĐP-1`): Bảo Toàn Tính Thuần Khiết (Pure Function) Của `detectChartDuplicateInLibrary` & Trách Nhiệm Di Trú Đồng Bộ
- **Vai nêu**: Kiến trúc sư Lưu trữ & Khóa định danh (`Vai 1`) và Kỹ sư Kiểm thử Hồi quy (`Vai 3`).
- **Mức độ**: **CAO**.
- **Bằng chứng trên code & tài liệu V1**:
  - Tại Mục 2 của V1 (`dòng 114`), tài liệu tuyên bố `detectChartDuplicateInLibrary` là *"hàm thuần (pure/deterministic function)"*. Tuy nhiên, tại Mục 4.1 (`dòng 350`), V1 lại thiết kế: *"Trong `detectChartDuplicateInLibrary`, nếu `getLibraryHydrationStatus() === 'idle'`, gọi nhẹ `migrateLegacyHistoryAndDossiers()` đồng bộ trước khi đọc `readLibraryIndexStore().entries`"*.
  - Kiểm tra thực tế `migrateLegacyHistoryAndDossiers` tại `src/lib/chart-library.ts:1251–1466`:
    - Hàm này gọi `persistDossierToTargets(sanitized)` (`dòng 1433`) và `writeLibraryIndexStore(...)` (`dòng 1462`), tức là **ghi trực tiếp xuống `localStorage`, `sessionStorage`, `inMemoryDossierMirror` và hàng đợi `IndexedDB`**.
    - Nếu nhét lệnh gọi này vào bên trong `detectChartDuplicateInLibrary`, hàm phát hiện sẽ gây tác dụng phụ (side-effect) lên bộ nhớ lưu trữ mỗi khi được gọi ở trạng thái `'idle'`, làm hỏng tính chất chỉ-đọc (read-only inspector) và gây bất ngờ khi unit test truyền `options.entries` tùy chỉnh.
  - Mặt khác, khảo sát `initChartLibrary` tại `src/lib/chart-library.ts:1474–1615` cho thấy:
    - Ở nhánh bình thường (`IndexedDB` khả dụng), `migrateLegacyHistoryAndDossiers(currentForm)` chỉ được gọi tại **dòng `1591`** — tức là **SAU KHI** `await runtimeIdbAdapter.isAvailable()` (`dòng 1489`) và `await runtimeIdbAdapter.getAll()` (`dòng 1525`) đã chạy xong.
    - Điều này có nghĩa là trong suốt khoảng thời gian `hydrationStatus === 'hydrating'` (ví dụ khi `IndexedDB` mở chậm như trong `TEST-L11`), các mục lịch sử cũ trong `localStorage['ziwei_history']` chưa từng được di trú vào `localStorage['ziwei_chart_library_v1']` nếu chỉ đợi đến dòng `1591`!
- **Kết luận xử lý (Đồng thuận 5/5 — Chốt Phương án (b) của Muse kèm nâng cấp vị trí gọi di trú đồng bộ trong `initChartLibrary`)**:
  1. **Giữ `detectChartDuplicateInLibrary` và `diffBirthFormsForDuplicateModal` thuần khiết 100% (Read-Only)**:
     - Tuyệt đối **KHÔNG** gọi `migrateLegacyHistoryAndDossiers()`, **KHÔNG** gọi `writeLibraryIndexStore()`, và **KHÔNG** biến đổi bất kỳ biến trạng thái cấp module nào bên trong `detectChartDuplicateInLibrary`.
     - Hai lần gọi `detectChartDuplicateInLibrary(form)` liên tiếp trên cùng trạng thái lưu trữ luôn trả về kết quả tương đương 100% mà không làm thay đổi `store.updatedAt`.
  2. **Trách nhiệm đảm bảo di trú đồng bộ thuộc về tầng khởi tạo (`initChartLibrary`)**:
     - Tại `src/lib/chart-library.ts:1483` (ngay đầu hàm `initChartLibrary(currentForm)`, **trước khi** bước vào IIFE `async` chờ `IndexedDB`), gọi đồng bộ `migrateLegacyHistoryAndDossiers(currentForm)` một lần ngay lập tức.
     - Nhờ bản vá `LK-05` (`1.2.0-rc.2`), hàm `migrateLegacyHistoryAndDossiers` (`dòng 1251–1466`) đã có cờ `storeChanged` (`dòng 1277, 1461`) và `hasNewOrNewerChapters` (`dòng 1423–1431`), đảm bảo **tính lũy đẳng tuyệt đối (100% idempotent)**: khi chạy lần 1 ở đầu `initChartLibrary` (lúc `hydrationStatus` vừa chuyển sang `'hydrating'`), toàn bộ mục trong `ziwei_history` và hồ sơ khớp chính xác 9 thành phần trong `sessionStorage` được đưa ngay vào `ziwei_chart_library_v1` trong `0 ms`; đến khi `IndexedDB` nạp xong và dòng `1591` gọi lại `migrateLegacyHistoryAndDossiers(currentForm)` lần 2, vì không có dữ liệu mới nên `storeChanged === false`, hàm không ghi đè hay làm trôi `updatedAt`.

---

### 3.2. `DM-02` (`ĐP-2`): Nhất Quán Tuyệt Đối Giữa `chart` Và `currentForm` Khi Khớp Chính Xác (`exact_match`)
- **Vai nêu**: Chuyên gia An toàn Dữ liệu Chéo Khóa (`Vai 4`) & Kiến trúc sư Lưu trữ (`Vai 1`).
- **Mức độ**: **CAO**.
- **Bằng chứng trên code & tài liệu V1**:
  - Tại Mục 3.3 của V1 (`dòng 334`), cột thứ hai ghi: `setChart(incomingChart)`, `setCurrentForm(existingEntry.form)`.
  - Đối chiếu hàm tạo khóa `buildChartIdentityKey` tại `src/lib/ziwei/yunxian-context.ts:292–310`:
    - Thành phần `nameSlug` (`dòng 294–300`) chuyển tên về chữ thường `.toLowerCase()`. Nếu `existingEntry.form.name` là `"Nguyễn Văn An"` còn `incomingForm.name` là `"nguyễn văn an"` (hoặc `"NGUYỄN VĂN AN"`), cả hai sinh ra **cùng một `chartIdentityKey`**, nhưng `incomingChart.birthInfo.name` là `"nguyễn văn an"` trong khi `existingEntry.form.name` là `"Nguyễn Văn An"`.
    - Tương tự, `lonSig` (`dòng 305–308`) làm tròn `b.longitude.toFixed(2)`. Nếu hai form lệch kinh độ `< 0.005°` (hoặc khác chuỗi hiển thị `province`/`city` nhưng cùng kinh độ), `incomingChart` và `existingEntry.form` sẽ lệch siêu dữ liệu.
- **Kết luận xử lý (Đồng thuận 5/5)**:
  - Khi `detectChartDuplicateInLibrary` trả về `kind === 'exact_match'`, hệ thống **luôn tái tạo `savedChart = buildChartFromForm(existingEntry.form)` từ chính `existingEntry.form`** rồi mới gọi `applyFormAndChart(savedChart, existingEntry.form, false)` + `upsertChartToLibrary(existingEntry.form)` (hoặc `markLibraryEntryOpened(existingEntry.chartIdentityKey)`).
  - **Lý do & Hệ quả với `hydratePeriodCacheFromLibrary`**:
    1. Đảm bảo bất biến `chart === buildChartFromForm(currentForm)` luôn đúng 100% ở mọi thời điểm.
    2. Vì `buildChartIdentityKey(savedChart) === existingEntry.chartIdentityKey`, hàm `hydratePeriodCacheFromLibrary(savedChart)` (`src/App.tsx:142–159`) sẽ tạo đúng các khóa `${existingEntry.chartIdentityKey}__annual_2026_...` và nạp chuẩn xác Chương 5/6 của lá số đã lưu vào `aiPeriodCache`.

---

### 3.3. `DM-03` (`ĐP-3`): Đính Chính Trích Dẫn Số Dòng Của `upsertChartToLibrary`
- **Vai nêu**: Kỹ sư Kiểm thử Hồi quy (`Vai 3`).
- **Mức độ**: **THẤP**.
- **Bằng chứng trên code (`src/lib/chart-library.ts`)**:
  - Trong V1 Mục 1.1 (`dòng 53`), tài liệu viết `upsertChartToLibrary` tại `src/lib/chart-library.ts:1857–1949`.
  - Kiểm tra trực tiếp trên `src/lib/chart-library.ts` (bản `1.2.0-rc.2`):
    - `upsertChartToLibrary` nằm chính xác tại **`dòng 1712–1795`**.
    - `markLibraryEntryOpened` nằm tại **`dòng 1797–1809`**.
    - `saveChart` trong hook `useChartLibrary` nằm tại **`dòng 2661–2663`**.
- **Kết luận xử lý (Đồng thuận 5/5)**: Sửa lại trích dẫn tại Mục 0.1 và Mục 1.1 trong bản POST-PANEL V2 thành `src/lib/chart-library.ts:1712–1795`.

---

### 3.4. `DM-04` (`ĐP-4`): Cơ Chế Phân Biệt Nguồn Gọi `onChartGenerated` Giữa `handleSubmit` Và `handleFamousLoad` Trong `BirthForm.tsx`
- **Vai nêu**: Chuyên gia UX Biểu mẫu (`Vai 2`) & Kỹ sư Kiểm thử Hồi quy (`Vai 3`).
- **Mức độ**: **CAO**.
- **Bằng chứng trên code (`src/components/BirthForm.tsx:14–23, 152–204` & `src/App.tsx:526–529, 581`)**:
  - Trong `src/components/BirthForm.tsx`:
    - `BirthFormProps` (`dòng 15`) khai báo: `onChartGenerated: (chart: ZiweiChart, form: BirthFormState) => void;`.
    - `handleSubmit` (`dòng 165`) gọi `onChartGenerated(chart, normalizedForm);`.
    - `handleFamousLoad` (`dòng 200`, khi bấm một trong 5 nút danh nhân gợi ý ở cuối `BirthForm` tại `dòng 516–526`) gọi `onChartGenerated(chart, presetForm);`.
  - Nếu không truyền tham số nguồn gọi, `App.tsx` (`dòng 526, 581`) không thể biết lời gọi `onChartGenerated` đến từ nút submit chính hay từ nút chọn nhanh Danh nhân để thực thi `QĐ-M4` Phương án A.
- **Kết luận xử lý (Đồng thuận 5/5)**:
  1. **Định nghĩa kiểu nguồn kích hoạt (`ChartGenerationSource`) tại `src/components/BirthForm.tsx`**:
     ```ts
     export type ChartGenerationSource = 'user_form_submit' | 'famous_preset';

     interface BirthFormProps {
       onChartGenerated: (
         chart: ZiweiChart,
         form: BirthFormState,
         source?: ChartGenerationSource,
       ) => void;
       ...
     }
     ```
  2. **Truyền rõ nguồn tại 2 điểm gọi trong `BirthForm.tsx`**:
     - Trong `handleSubmit` (`dòng 165`): `onChartGenerated(chart, normalizedForm, 'user_form_submit');`
     - Trong `handleFamousLoad` (`dòng 200`): `onChartGenerated(chart, presetForm, 'famous_preset');`
  3. **Xử lý thống nhất tại `App.tsx`**:
     - Cả `handleFamousLoad` (từ `BirthForm`) và `handleFamousSelect` (`src/App.tsx:244–264`, từ tab `'famous'`) đều đi qua nhánh `source === 'famous_preset'`:
       - Gọi `detectChartDuplicateInLibrary(presetForm)`.
       - Nếu `kind === 'exact_match'`: nạp lại `existingEntry.form` (bảo toàn `pinned`, `customAlias`, `notes`, `dossierSummary` nếu người dùng từng lưu danh nhân đó) mà không tạo mục trùng.
       - Nếu `kind === 'near_match'` hoặc `'none'`: gọi thẳng `applyFormAndChart(c, presetForm, true)` — **tuyệt đối không bật `DuplicateChartPromptModal`** chặn thao tác khảo cứu danh nhân.
     - Ngược lại, khi `source === 'user_form_submit'`: chạy đầy đủ cả 3 nhánh (`exact_match` $\rightarrow$ tự nạp + hiện Banner; `near_match` $\rightarrow$ mở `DuplicateChartPromptModal`; `none` $\rightarrow$ lập mới).
  4. **Kiểm thử**: Bổ sung kiểm chứng phân nhánh nguồn gọi vào đặc tả `TEST-L19`.

---

### 3.5. `DM-05` (`ĐP-5`): Siết Điều Kiện Nhánh 2 Của `QĐ-M2` Và Thiết Kế Cảnh Báo Khác Cấu Trúc 12 Cung Trên Modal
- **Vai nêu**: Chuyên gia An toàn Dữ liệu Chéo Khóa (`Vai 4`) & Đại diện Người dùng cuối (`Vai 5`).
- **Mức độ**: **CAO**.
- **Phân tích kỹ thuật**:
  - Nhánh 2 của `QĐ-M2` (`matchReason: 'same_name_and_solar_date'`) dùng để bắt trường hợp người dùng lập lại lá số của cùng một đương số (cùng tên + cùng ngày/tháng/năm Dương lịch + cùng giới tính), nhưng lần trước để *"Chưa rõ giờ sinh"* (`unknownTime = true`, `b.hour = 0`) còn lần này nhập giờ sinh thật (`unknownTime = false`, `b.hour = 5`), hoặc chỉnh phút sinh/kinh độ làm Chân Thái Dương Thời nhảy sang canh giờ kế cận (`entry.legacyFivePartKey !== incomingFivePartKey`).
  - Tuy nhiên, vì `entry.legacyFivePartKey !== incomingFivePartKey`, **cấu trúc 12 cung, vị trí Cung Mệnh, Cung Thân và Cục số của hai lá số này khác nhau**. Nếu điều kiện lọc quá lỏng hoặc giao diện không cảnh báo nổi bật, người dùng có thể:
    1. Gặp cảnh báo nhiễu khi hai người khác nhau tình cờ trùng tên ngắn và sinh cùng ngày.
    2. Bấm nhầm nút vàng **`[Mở lá số đã lưu]`**, dẫn tới việc xem bàn sao của giờ sinh cũ (sai giờ) thay vì bàn sao của giờ sinh mới vừa cập nhật!
- **Kết luận xử lý (Đồng thuận 5/5)**:
  1. **Siết chặt 4 điều kiện cần và đủ cho Nhánh 2 (`same_name_and_solar_date`)**:
     Một `entry` (với `entry.legacyFivePartKey !== incomingFivePartKey`) chỉ được đưa vào Nhánh 2 khi thỏa mãn **đồng thời cả 4 điều kiện**:
     - **Điều kiện 1 (Tên có nghĩa & khớp chính xác sau chuẩn hóa)**:
       Chuỗi tên vừa nhập `foldedIncoming = foldVietnameseSearchText(normalizedForm.name)` phải **khác rỗng**, khác `'anon'`, có **độ dài $\ge 2$ ký tự** (và ưu tiên chứa ít nhất 1 khoảng trắng hoặc khớp họ tên/biệt danh đầy đủ), đồng thời trùng khớp chính xác (`===`) với `foldVietnameseSearchText(entry.form.name)` **hoặc** `foldVietnameseSearchText(entry.customAlias)`.
     - **Điều kiện 2 (Trùng tuyệt đối Ngày · Tháng · Năm Dương lịch gốc trên Form)**:
       `Number(entry.form.year) === Number(normalizedForm.year) && Number(entry.form.month) === Number(normalizedForm.month) && Number(entry.form.day) === Number(normalizedForm.day)`.
     - **Điều kiện 3 (Trùng Giới tính)**:
       `entry.form.gender === normalizedForm.gender`.
     - **Điều kiện 4 (Có sự biến thiên hợp lý giải thích việc lệch `legacyFivePartKey`)**:
       Phải có sự khác biệt ở ít nhất một trong các yếu tố thời gian/không gian: `Boolean(entry.form.unknownTime) !== Boolean(normalizedForm.unknownTime)`, hoặc khác `clockHour`/`clockMinute`, hoặc khác `longitude` làm đổi canh giờ Chân Thái Dương Thời.
  2. **Thiết kế UX chống bấm nhầm trên `DuplicateChartPromptModal` cho ứng viên Nhánh 2 (hoặc bất kỳ ứng viên nào có diff `affectsChartStructure === true`)**:
     - **Sắp xếp dòng diff**: Trong `diffBirthFormsForDuplicateModal`, mọi trường có `affectsChartStructure === true` (`unknownTime`, `shichenBranch`, `mingGongBranch`, `birthDateSolar`, `lunarLeapMonth`, `clockTime` khi đổi canh giờ) được **đẩy lên đầu bảng đối chiếu** và gắn huy hiệu cảnh báo màu cam/đỏ **`[Đổi cấu trúc 12 cung]`**.
     - **Hộp cảnh báo nổi bật (Structural Divergence Callout)**: Khi ứng viên có `matchReason === 'same_name_and_solar_date'` (hoặc `sChart.mingGongBranch !== iChart.mingGongBranch`), hiển thị khung cảnh báo viền Hổ phách đậm ngay trên bảng diff:
       > `⚠️ LƯU Ý QUAN TRỌNG VỀ GIỜ AN SAO: Lá số đã lưu an Mệnh tại cung {savedMing} ({savedShichen}), trong khi thông tin vừa nhập an Mệnh tại cung {incomingMing} ({incomingShichen}). Nếu bạn vừa tìm được giờ sinh chính xác hơn để lập bàn sao mới, hãy chọn "Lập lá số mới theo thông tin vừa nhập".`
     - **Đổi nhãn nút khi khác cấu trúc bàn sao**: Khi chỉ có 1 ứng viên mà ứng viên đó **khác cấu trúc 12 cung (`mingGongBranch` hoặc `shichenBranch` khác nhau)**, nút `"Mở lá số đã lưu"` ghi rõ: **`Mở lá số cũ đã lưu ({savedShichen} · Mệnh {savedMing})`** để người dùng không bao giờ nhầm rằng nút đó sẽ áp dụng giờ sinh mới.

---

### 3.6. `DM-06` (`ĐP-6`): Sắp Xếp Phân Tầng Từ Điển (`Multi-Tier Score`) Thay Cho Trọng Số Tuyến Tính Bị Chồng Lấn
- **Vai nêu**: Kiến trúc sư Lưu trữ & Khóa định danh (`Vai 1`) & Kỹ sư Kiểm thử Hồi quy (`Vai 3`).
- **Mức độ**: **CAO**.
- **Bằng chứng lỗi trọng số trong V1 Mục 2.3 (`dòng 249–254`)**:
  - Công thức cũ trong V1:
    `score = (sameFivePartKey ? 100 : 0) + (sameName ? 50 : 0) + (pinned ? 20 : 0) + (completedCount * 10)`.
  - Với công thức này, `completedCount * 10` có biên độ `0..80`, lớn hơn cả trọng số `sameName` (`50`) và `pinned` (`20`) cộng lại (`70`)!
  - Hậu quả: Nếu trong Thư Viện có 2 lá số cùng tiền tố 5 thành phần `1995_8_16_5_male`:
    - Lá số 1: **Trùng tên `"Nguyễn Văn An"`** (chỉ lệch 5 phút sinh), mới lập nên có `0/8` chương $\rightarrow$ `score = 100 + 50 + 0 + 0 = 150`.
    - Lá số 2: **Khác tên hoàn toàn (`"Lê Quốc Bảo"`)**, đã luận giải `8/8` chương $\rightarrow$ `score = 100 + 0 + 0 + 80 = 180`.
    - Lá số của `"Lê Quốc Bảo"` (`180`) sẽ bị xếp đè lên trên lá số của chính `"Nguyễn Văn An"` (`150`)!
- **Kết luận xử lý (Đồng thuận 5/5 — Thiết lập Công thức Điểm Phân Tầng Không Chồng Lấn + Comparator Từ Điển)**:
  - Thiết kế hàm `computeNearMatchSimilarityScore(entry, incomingForm, incomingFivePartKey, effectiveCompletedCount)` với **4 tầng trọng số tách biệt hoàn toàn** (mỗi tầng cấp thấp có tổng điểm tối đa nhỏ hơn bước nhảy nhỏ nhất của tầng cấp trên):
    1. **Tầng 1 — Cùng tiền tố 5 thành phần (`legacyFivePartKey`, cùng cấu trúc 12 cung)**:
       - `+1000` điểm nếu `entry.legacyFivePartKey === incomingFivePartKey` (`matchReason === 'same_five_part_key'`).
       - `+0` điểm nếu chỉ khớp Nhánh 2 (`matchReason === 'same_name_and_solar_date'`).
    2. **Tầng 2 — Độ khớp Danh tính / Họ tên (`Name & Alias Affinity`)**:
       - `+300` điểm nếu tên chuẩn hóa vừa nhập (`foldedIncoming !== ''`) trùng khớp với `foldVietnameseSearchText(entry.form.name)` **hoặc** `foldVietnameseSearchText(entry.customAlias)`.
       - `+150` điểm nếu cả lá số vừa nhập và lá số đã lưu đều để trống tên (`foldedIncoming === ''` và `foldVietnameseSearchText(entry.form.name) === ''` và `foldVietnameseSearchText(entry.customAlias) === ''`).
       - `+0` điểm nếu hai bên có tên khác nhau.
    3. **Tầng 3 — Trạng thái Ghim ưu tiên (`Pinned Status`)**:
       - `+50` điểm nếu `entry.pinned === true`, ngược lại `+0` điểm.
    4. **Tầng 4 — Số chương Hồ sơ đã hoàn tất (`effectiveCompletedCount`)**:
       - `+ (effectiveCompletedCount * 5)` điểm (với `effectiveCompletedCount` từ `0..8` $\rightarrow$ biên độ `0..40` điểm, luôn nhỏ hơn `< 50` điểm của Tầng 3, nhỏ hơn `< 150` điểm của Tầng 2, và nhỏ hơn `< 1000` điểm của Tầng 1!).
    5. **Tầng 5 — Tiêu chí phá hòa (`Tie-breaker`)**:
       - Nếu `a.similarityScore !== b.similarityScore`: sắp xếp `b.similarityScore - a.similarityScore`.
       - Nếu `a.similarityScore === b.similarityScore`: ưu tiên `b.entry.lastOpenedAt - a.entry.lastOpenedAt` (mở gần nhất đứng trước), sau đó đến `a.entry.chartIdentityKey.localeCompare(b.entry.chartIdentityKey)` để tất định 100%.

---

### 3.7. `DM-07` (`ĐP-7`): Thời Gian Tự Ẩn Và Điều Kiện Tạm Dừng Của Banner Trường Hợp 1 (`exact_match`)
- **Vai nêu**: Chuyên gia UX Biểu mẫu (`Vai 2`) & Đại diện Người dùng cuối (`Vai 5`).
- **Mức độ**: **TRUNG BÌNH**.
- **Phân tích**:
  - Trên Banner Trường hợp 1 có chứa thông tin định danh lá số, trạng thái hồ sơ `X/8 chương` và nút hành động trực tiếp **`[Mở Hồ Sơ (X/8 Chương)]`**. Thời gian tự ẩn `8 giây` trong V1 là quá ngắn, đặc biệt khi người dùng vừa lập lá số xong thường nhìn lướt qua Thiên Bàn 12 cung hoặc đọc dòng tóm tắt trên Quick Summary Bar trước khi bấm mở Hồ Sơ.
- **Kết luận xử lý (Đồng thuận 5/5)**:
  1. **Thời gian tự ẩn tiêu chuẩn**: **`15 giây` (`15_000 ms`)** tính từ thời điểm hiển thị (hoặc từ thời điểm `hydrationStatus` chuyển sang `'ready'`/`'degraded'` nếu ban đầu đang `'hydrating'`).
  2. **Tạm dừng đếm khi tương tác (`Pause on Hover / Focus / Touch`)**:
     - Khi con trỏ chuột đang di vào vùng Banner (`onMouseEnter` / `onMouseLeave`), hoặc phần tử nút bên trong Banner đang nhận focus bàn phím (`onFocus` / `onBlur`), hoặc người dùng chạm giữ trên thiết bị cảm ứng (`onTouchStart`), bộ đếm tự ẩn sẽ **tạm dừng** và chỉ đếm tiếp khi rời chuột.
  3. **Đóng tức thì khi có thao tác mới**:
     - Banner đóng ngay lập tức khi người dùng: (a) bấm nút `[Mở Hồ Sơ]`, (b) bấm nút `[Đóng] (×)`, hoặc (c) chọn/lập một lá số khác.

---

### 3.8. `DM-08` (`ĐP-8`): Chốt Chặn Kiểm Tra Lại Mục Đã Lưu (`Stale Entry Guard`) Khi Hộp Thoại Trường Hợp 2 Đang Mở
- **Vai nêu**: Kiến trúc sư Lưu trữ (`Vai 1`) & Chuyên gia UX Biểu mẫu (`Vai 2`).
- **Mức độ**: **CAO**.
- **Phân tích kịch bản**:
  - Giả sử `DuplicateChartPromptModal` (Trường hợp 2) đang hiển thị danh sách ứng viên `candidates`. Trong lúc người dùng đang đọc bảng diff:
    - Kịch bản A: `initChartLibrary` hoàn tất hydration từ `IndexedDB`, làm cập nhật `dossierSummary.completedCount` của ứng viên từ `0/8` lên `4/8`.
    - Kịch bản B: Ứng viên đó vừa bị xóa khỏi `ziwei_chart_library_v1` (ví dụ từ một tab khác hoặc thao tác dọn dẹp).
- **Kết luận xử lý (Đồng thuận 5/5)**:
  1. **Cập nhật phản ứng trực tiếp trên Modal (`Live Candidate Sync`)**:
     - Trong `DuplicateChartPromptModal`, mỗi ứng viên hiển thị `dossierSummary`, `customAlias`, `pinned` bằng cách đối chiếu `libraryEntries` mới nhất từ hook `useChartLibrary` (hoặc gọi `resolveEffectiveDossierSummaryForEntry`). Ngay khi `hydrationStatus` chuyển từ `'hydrating'` sang `'ready'`, badge *"Đang đồng bộ từ IndexedDB..."* trên thẻ ứng viên lập tức chuyển thành con số thực tế `X/8 chương`.
  2. **Kiểm tra tồn tại trước khi thực thi `[Mở lá số đã lưu]` (`Stale Entry Guard`)**:
     - Khi người dùng bấm nút **`[Mở lá số đã lưu]`** cho ứng viên `chosenCandidate`:
       - Bước 1: Đọc đồng bộ chỉ mục hiện hành:
         `const freshEntry = readLibraryIndexStore().entries.find((e) => e.chartIdentityKey === chosenCandidate.entry.chartIdentityKey);`
       - Bước 2 (Nhánh bình thường — `freshEntry` tồn tại):
         - Đóng hộp thoại (`setPendingDuplicatePrompt(null)`).
         - Tái tạo `const savedChart = buildChartFromForm(freshEntry.form);`.
         - Gọi `markLibraryEntryOpened(freshEntry.chartIdentityKey)` và `applyFormAndChart(savedChart, freshEntry.form, false)`.
         - Hiển thị Banner xác nhận đã nạp lá số `freshEntry`.
       - Bước 3 (Nhánh phòng vệ — `freshEntry` không còn tồn tại trong Thư Viện):
         - Đóng hộp thoại (`setPendingDuplicatePrompt(null)`).
         - **TUYỆT ĐỐI KHÔNG** tự ý nạp hay trộn `incomingForm`.
         - Giữ nguyên dữ liệu đang nhập trên `BirthForm` và hiển thị thông báo cảnh báo rõ ràng trên Banner:
           *"Lá số đã lưu bạn vừa chọn không còn tồn tại trong Thư Viện (có thể đã bị xóa). Dữ kiện bạn vừa nhập vẫn được giữ nguyên trên biểu mẫu — hãy bấm 'An Sao Lập Lá Số' lần nữa nếu muốn lập mới."*

---

### 3.9. `DM-09` (`ĐP-9`): Cập Nhật Đặc Tả `TEST-L20` Và `TEST-L22` Khớp Tuyệt Đối Với `ĐP-6` Và `ĐP-1`
- **Vai nêu**: Kỹ sư Kiểm thử Hồi quy (`Vai 3`).
- **Mức độ**: **CAO**.
- **Kết luận xử lý (Đồng thuận 5/5)**:
  - **`TEST-L20` (Sắp xếp nhiều ứng viên theo công thức phân tầng `ĐP-6`)**:
    - Thiết lập 4 lá số trong Thư Viện và nhập `formIncoming` (`"Nguyễn Văn An"`, `16/08/1995`, `10:45`, Hà Nội, Nam — tiền tố `1995_8_16_5_male`):
      1. `entrySameNameZeroChapters`: Tên `"Nguyễn Văn An"` (trùng `nameSlug`), cùng tiền tố `1995_8_16_5_male` (`10:05`), `pinned: false`, **`0/8` chương** $\rightarrow$ `similarityScore = 1000 + 300 + 0 + 0 = 1300`.
      2. `entryDiffNameFullChaptersPinned`: Tên `"Trần Quốc Tuấn"` (khác tên), cùng tiền tố `1995_8_16_5_male` (`10:15`), `pinned: true`, **`8/8` chương** $\rightarrow$ `similarityScore = 1000 + 0 + 50 + 40 = 1090`.
      3. `entryDiffNameFourChapters`: Tên `"Lê Văn Hưu"` (khác tên), cùng tiền tố `1995_8_16_5_male` (`10:25`), `pinned: false`, **`4/8` chương** $\rightarrow$ `similarityScore = 1000 + 0 + 0 + 20 = 1020`.
      4. `entrySameNameDiffHour`: Tên `"Nguyễn Văn An"` (trùng `nameSlug`), cùng ngày `16/08/1995` nhưng sinh lúc `14:30` (**Giờ Mùi**, khác tiền tố 5 thành phần — thuộc Nhánh 2 `same_name_and_solar_date`), `pinned: true`, **`6/8` chương** $\rightarrow$ `similarityScore = 0 + 300 + 50 + 30 = 380`.
    - Khẳng định bắt buộc: `res.candidates.map(c => c.entry.chartIdentityKey)` khớp chính xác thứ tự `[key1, key2, key3, key4]`.
  - **`TEST-L22` Ca 2 (Kiểm tra trùng trong lúc `hydrationStatus === 'hydrating'` và tính thuần khiết theo `ĐP-1`)**:
    - Đưa 1 mục vào `ziwei_history`, bật cổng chặn `idb.enableSlowHydrationGate()`, gọi `const initP = initChartLibrary()` (không `await`, lúc này `hydrationStatus === 'hydrating'`, nhưng bước di trú đồng bộ đầu `initChartLibrary` đã đưa mục đó vào `ziwei_chart_library_v1`).
    - Đọc `const updatedAtBefore = readLibraryIndexStore().updatedAt`.
    - Gọi `detectChartDuplicateInLibrary(form)` **2 lần liên tiếp** (`res1`, `res2`).
    - Khẳng định:
      - `res1.kind === 'exact_match'` và `res2.kind === 'exact_match'`.
      - `res1.hydrationStatus === 'hydrating'`.
      - `readLibraryIndexStore().updatedAt === updatedAtBefore` (chứng minh `detectChartDuplicateInLibrary` thuần khiết 100%, không tự ghi xuống storage).
      - Sau khi gọi `idb.releaseHydrationGate()` và `await initP`, `getLibraryHydrationStatus() === 'ready'` và dữ liệu `IndexedDB` toàn vẹn 100%.

---

### 3.10. `DM-10` (`ĐP-10`): Xác Nhận Phiên Bản Đích `1.3.0-rc.1` Và Đồng Bộ `package.json` (`QĐ-M6`)
- **Vai nêu**: Kiến trúc sư Lưu trữ (`Vai 1`).
- **Mức độ**: **THẤP**.
- **Kết luận xử lý (Đồng thuận 5/5)**:
  - Xác nhận khuyến nghị của Muse: Khi thi công tính năng mới này, nâng `/VERSION` lên **`1.3.0-rc.1`** và nâng `package.json` `"version"` lên **`"1.3.0"`** (theo đúng tiền lệ khi phát hành tính năng Thư Viện Lá Số `1.2.0-rc.1` $\rightarrow$ `package.json` `"1.2.0"`).

---

### 3.11. `DM-11` (Phát Hiện Mới Của Panel): Chuẩn Hóa Nguồn Đọc Số Chương `completedCount` (`resolveEffectiveDossierSummaryForEntry`)
- **Vai nêu**: Kiến trúc sư Lưu trữ (`Vai 1`) & Chuyên gia An toàn Dữ liệu Chéo Khóa (`Vai 4`).
- **Mức độ**: **TRUNG BÌNH**.
- **Bằng chứng trên code (`src/lib/chart-library.ts:556–615, 1985–2014, 2019–2076`)**:
  - Trong V1 Mục 2.3 (`dòng 241`), số chương hoàn tất của `exact_match` được tính bằng `Math.max(exactEntry.dossierSummary.completedCount, liveSummary.completedCount)`.
  - Nếu `readState = getDossierReadState(entry.chartIdentityKey, chart)` trả về `readState.record !== null` (tức đã đọc được bản ghi thật từ `ram_ssot`, `hot_fallback`, hoặc `session_fallback`), thì `computeDossierSummary(readState.record)` chính là **nguồn sự thật chuẩn xác nhất** (kể cả khi người dùng vừa xóa bớt 1 chương làm số chương giảm xuống). Việc lấy `Math.max` có thể làm số chương bị kẹt ở mức cao cũ nếu `entry.dossierSummary` chưa kịp đồng bộ.
  - Ngoài ra, ở nhánh `near_match` (`dòng 253` của V1), V1 chưa gọi `getDossierReadState` cho các ứng viên gần khớp.
- **Kết luận xử lý (Đồng thuận 5/5)**:
  - Thiết kế hàm phụ trợ thuần khiết `resolveEffectiveDossierSummaryForEntry(entry: ChartLibraryEntry, chart?: ZiweiChart)` dùng chung cho cả `exact_match` và từng ứng viên của `near_match`:
    ```ts
    export function resolveEffectiveDossierSummaryForEntry(
      entry: ChartLibraryEntry,
      chart?: ZiweiChart,
    ): ChartLibraryDossierSummary {
      const readState = getDossierReadState(entry.chartIdentityKey, chart);
      if (readState.record) {
        return computeDossierSummary(readState.record);
      }
      return entry.dossierSummary;
    }
    ```
  - Nhờ đó, cả `exact_match` lẫn `near_match` luôn phản ánh đúng số chương thực tế tại mọi thời điểm.

---

### 3.12. `DM-12` (Phát Hiện Mới Của Panel): Xử Lý Khi Lá Số Khớp Chính Xác Đang Mở Sẵn Trên Thiên Bàn & Tương Tác Ngăn Kéo Mobile/Desktop
- **Vai nêu**: Chuyên gia UX Biểu mẫu (`Vai 2`) & Đại diện Người dùng cuối (`Vai 5`).
- **Mức độ**: **TRUNG BÌNH**.
- **Bằng chứng trên code (`src/App.tsx:112, 510–532, 570–583`)**:
  - Trong `src/App.tsx:112`, ứng dụng luôn có `activeChartIdentityKey = useMemo(() => buildChartIdentityKey(chart), [chart])`.
  - Nếu người dùng mở ngăn kéo `showFormDrawer` (hoặc nhìn vào cột phải `BirthForm` trên Desktop) và bấm **"An Sao Lập Lá Số"** mà chưa thay đổi dữ kiện nào của lá số đang xem (đã lưu trong Thư Viện), `detectChartDuplicateInLibrary` trả về `kind === 'exact_match'` với `existingEntry.chartIdentityKey === activeChartIdentityKey`.
  - Ngoài ra, trên màn hình nhỏ (`< 1280px`), khi `showFormDrawer === false`, `BirthForm` ở cột phải (`src/App.tsx:570`) nằm ở phía dưới `ChartBoard`. Nếu người dùng cuộn xuống đó bấm submit và kết quả là `exact_match`, Banner ở dưới Quick Summary Bar (đầu trang) có thể nằm ngoài vùng nhìn thấy (viewport).
- **Kết luận xử lý (Đồng thuận 5/5)**:
  1. Bổ sung trường boolean `isAlreadyActiveOnBoard: boolean` vào state thông báo Trường hợp 1 tại `App.tsx` (`activeChartIdentityKey === res.existingEntry.chartIdentityKey`).
     - Nếu `isAlreadyActiveOnBoard === true`: Văn bản Banner ghi rõ: *"Lá số của '{Tên/Biệt danh}' đã được lập và đang hiển thị sẵn trên Thiên Bàn ({Trạng thái X/8 chương hồ sơ})."*
     - Nếu `isAlreadyActiveOnBoard === false`: Văn bản Banner ghi: *"Lá số này đã từng lập trong Thư Viện — Đã tự động nạp lại lá số của '{Tên/Biệt danh}' ({Trạng thái X/8 chương hồ sơ})."*
  2. Hiển thị thông báo xác nhận ở **cả 2 vị trí (Dual Feedback)**:
     - Vị trí 1: Thanh Banner nổi bật ngay dưới Quick Summary Bar (`src/App.tsx:502–506`) kèm nút `[Mở Hồ Sơ (X/8 Chương)]`.
     - Vị trí 2: Một hộp thông báo xác nhận gọn ngay phía trên nút submit *"An Sao Lập Lá Số"* bên trong `BirthForm.tsx` (khi `BirthForm` không bị đóng bởi `showFormDrawer`), đồng thời tự động cuộn mượt lên vùng Quick Summary Bar nếu người dùng bấm từ dưới trang trên mobile.

---

### 3.13. `DM-13`: Giải Quyết Dứt Điểm 5 Câu Hỏi Mở Ở Mục 8 Của Bản V1
- **Vai nêu**: Toàn bộ 5 vai trong Tổ Chuyên Gia.
- **Mức độ**: **TRUNG BÌNH**.
- **Kết luận chốt cho từng câu hỏi mở**:
  1. **Câu hỏi mở 1 (So khớp và hiển thị `customAlias` — Tên gợi nhớ)**:
     - Trong `detectChartDuplicateInLibrary`, khi kiểm tra trùng tên ở Tầng 2 của `similarityScore` và ở Nhánh 2 (`same_name_and_solar_date`), hệ thống so khớp `foldVietnameseSearchText(incomingForm.name)` với **CẢ `foldVietnameseSearchText(entry.form.name)` LẪN `foldVietnameseSearchText(entry.customAlias)`**.
     - Trong `diffBirthFormsForDuplicateModal`, hàm nhận thêm tham số tùy chọn `savedEntryMeta?: { customAlias?: string; notes?: string }`: nếu `savedEntryMeta?.customAlias` khác rỗng, giá trị đã lưu của trường `name` hiển thị `"Nguyễn Văn An" (Biệt danh: "Anh An - Đối tác")`. Nếu người dùng gõ đúng biệt danh vào ô Họ tên của `BirthForm`, dòng diff ghi rõ: `Đã lưu: "Nguyễn Văn An" (trùng Biệt danh: "Anh An - Đối tác") ↔ Vừa nhập: "Anh An - Đối tác"`.
  2. **Câu hỏi mở 2 (Tách hay gộp dòng diff `Nơi sinh` và `Kinh độ`)**:
     - **Giữ tách bạch 2 dòng diff riêng (`location` và `longitude`)** trong kết quả của `diffBirthFormsForDuplicateModal` để đảm bảo liệt kê chính xác từng trường cấu thành khóa định danh (`province`/`city` trên form vs `lonSig` trong khóa 9 thành phần). Trên giao diện `DuplicateChartPromptModal`, hai dòng này được đặt liền kề nhau.
  3. **Câu hỏi mở 3 (Luồng bấm *"Nạp dữ kiện lên Form để sửa & lập lá số mới"* từ `ChartLibraryModal` tại `src/App.tsx:711–716`)**:
     - Khi người dùng bấm `onLoadIntoFormToEditNew(entry)`, `App.tsx` lưu thêm `editingSourceEntryKey = entry.chartIdentityKey`. Khi người dùng sửa 1–2 trường (ví dụ đổi phút sinh từ `10:30` sang `10:35`) rồi bấm *"An Sao Lập Lá Số"*, hệ thống **vẫn mở `DuplicateChartPromptModal` (Trường hợp 2)** để họ đối chiếu tường minh điểm vừa sửa (`10:30 ↔ 10:35`), đồng thời trên thẻ của `entry` đó gắn thêm nhãn màu xanh ngọc: **`[Lá số gốc vừa nạp để chỉnh sửa]`**.
  4. **Câu hỏi mở 4 (Vị trí hiển thị thông báo Trường hợp 1)**:
     - Đã giải quyết tại `DM-12` bằng cơ chế **Dual Feedback** (Banner dưới Quick Summary Bar + thông báo nội tuyến ngay trên nút submit của `BirthForm`).
  5. **Câu hỏi mở 5 (Định danh lá số ẩn danh khi `form.name === ''`, `nameSlug === 'anon'`)**:
     - Khi cả `entry.form.name.trim()` và `entry.customAlias.trim()` đều rỗng, tiêu đề thẻ ứng viên trong `DuplicateChartPromptModal` được định dạng tự động:
       `Đương số chưa đặt tên · {entry.form.city || entry.form.province} · Sinh {clockTimeVi} ({shichenVi})`
     - Nếu `entry.notes.trim() !== ''`, hiển thị thêm dòng trích dẫn ghi chú (`📝 Ghi chú: "{trích 80 ký tự đầu}"`) ngay trên thẻ ứng viên để người dùng nhận diện ngay lá số của khách hàng nào.

---

## 4. Tổng Hợp Kết Luận Cuối Cùng Của Phiên Panel

### 4.1. Bảng đối chiếu 10 điểm Agenda bắt buộc (`ĐP-1` .. `ĐP-10`) → Kết luận Panel

| Mã Agenda | Vấn đề trọng tâm | Mã phát hiện Panel | Kết luận cuối cùng của Tổ Chuyên Gia |
|:---:|---|:---:|---|
| **`ĐP-1`** | `detectChartDuplicateInLibrary` gọi `migrateLegacyHistoryAndDossiers()` khi `'idle'` làm mất tính thuần khiết | **`DM-01`** | **Chốt Phương án (b) của Muse**: `detectChartDuplicateInLibrary` giữ thuần khiết 100% (chỉ đọc); chuyển lệnh gọi đồng bộ `migrateLegacyHistoryAndDossiers(currentForm)` về đầu `initChartLibrary` (trước khối `async` chờ `IndexedDB`). |
| **`ĐP-2`** | Trong Trường hợp 1 (`exact_match`), dùng `incomingChart` hay tái tạo từ `existingEntry.form`? | **`DM-02`** | **Tái tạo `savedChart = buildChartFromForm(existingEntry.form)`** từ `existingEntry.form` để `chart` và `currentForm` nhất quán tuyệt đối 100%, đồng thời `hydratePeriodCacheFromLibrary(savedChart)` nạp chuẩn xác Chương 5/6. |
| **`ĐP-3`** | Lỗi trích dẫn số dòng `upsertChartToLibrary` ở Mục 1.1 của V1 (`1857–1949` vs `1712`) | **`DM-03`** | **Đính chính thành `src/lib/chart-library.ts:1712–1795`** tại Mục 0.1 và Mục 1.1 của bản V2. |
| **`ĐP-4`** | `BirthForm.handleSubmit` và `handleFamousLoad` dùng chung prop `onChartGenerated` | **`DM-04`** | **Thêm tham số `source?: 'user_form_submit' | 'famous_preset'`** vào `onChartGenerated`; chỉ bật popup Trường hợp 2 khi `source === 'user_form_submit'`, và bổ sung test cho cả hai nguồn. |
| **`ĐP-5`** | Nguy cơ báo nhiễu và bấm nhầm ở Nhánh 2 của `QĐ-M2` (cùng tên + ngày sinh nhưng khác canh giờ) | **`DM-05`** | **Siết chặt 4 điều kiện kích hoạt Nhánh 2** (tên chuẩn hóa khác `'anon'`, độ dài $\ge 2$, cùng ngày Dương lịch + giới tính, có lệch giờ/phút/`unknownTime`/kinh độ) + **Hiện khung cảnh báo Hổ phách khác cấu trúc 12 cung** và đẩy diff `affectsChartStructure = true` lên đầu bảng. |
| **`ĐP-6`** | Công thức `similarityScore` cộng `completedCount * 10` làm lá số khác tên `8/8` chương vượt mặt lá số trùng tên `0/8` chương | **`DM-06`** | **Đổi sang Công thức Điểm Phân Tầng Không Chồng Lấn**: Tầng 1 (`same_five_part_key`: `+1000`) $\rightarrow$ Tầng 2 (`trùng tên/biệt danh`: `+300`, cùng `'anon'`: `+150`) $\rightarrow$ Tầng 3 (`pinned`: `+50`) $\rightarrow$ Tầng 4 (`completedCount * 5`: tối đa `+40` $< 50$) $\rightarrow$ Tầng 5 (`lastOpenedAt`). |
| **`ĐP-7`** | Banner Trường hợp 1 tự ẩn sau `8 giây` quá nhanh khi có nút `[Mở Hồ Sơ]` | **`DM-07`** | **Nâng thời gian tự ẩn lên `15 giây` (`15_000 ms`)**, tạm dừng bộ đếm khi `hover`/`focus`/`touch`, và chỉ bắt đầu đếm sau khi `hydrationStatus` đã `'ready'`/`'degraded'`. |
| **`ĐP-8`** | Xử lý khi danh sách `entries` thay đổi lúc hộp thoại Trường hợp 2 đang mở | **`DM-08`** | **Tự động đồng bộ ứng viên theo `libraryEntries` mới nhất**, và trước khi thực thi `[Mở lá số đã lưu]`, kiểm tra lại `readLibraryIndexStore().entries` theo `chartIdentityKey` (`Stale Entry Guard`); nếu mục đã bị xóa thì đóng modal, giữ nguyên form và báo rõ trên Banner. |
| **`ĐP-9`** | Đồng bộ đặc tả `TEST-L20` và `TEST-L22` Ca 2 theo kết luận `ĐP-6` và `ĐP-1` | **`DM-09`** | **Cập nhật đầy đủ `TEST-L20`** (4 ứng viên kiểm chứng trùng tên `0/8` xếp trên khác tên `8/8`) và **`TEST-L22` Ca 2** (kiểm chứng `detectChartDuplicateInLibrary` gọi 2 lần liên tiếp lúc `'hydrating'` không ghi xuống storage). |
| **`ĐP-10`** | Chốt khuyến nghị phiên bản đích `QĐ-M6` | **`DM-10`** | **Xác nhận khuyến nghị `/VERSION = 1.3.0-rc.1` kèm `package.json` `"version": "1.3.0"`** (nhất quán tiền lệ bản `1.2.0-rc.1`). |

---

### 4.2. Bảng tổng hợp khuyến nghị cuối cùng của Panel cho `QĐ-M1` .. `QĐ-M6` (Trình Chủ Dự Án Chốt)

| Mã Quyết định | Nội dung quyết định | Khuyến nghị cuối cùng của Panel (Sau Phản Biện V2) |
|:---:|---|---|
| **`QĐ-M1`** | Trong Trường hợp 1 (`exact_match`), có đặt nút *"Xóa hồ sơ để lập lại từ đầu"* trên Banner không? | **Khuyến nghị Phương án A**: **KHÔNG** đặt nút xóa/lập lại từ đầu trên Banner thông báo lập lá số; chỉ hiện thông báo xác nhận và tự động nạp lại lá số + hồ sơ đã lưu (`existingEntry.form`), tránh bẫy xóa nhầm hồ sơ tốn quota AI. |
| **`QĐ-M2`** | Tiêu chí phát hiện "Gần khớp" (Trường hợp 2) | **Khuyến nghị Phương án B (đã siết chặt theo `DM-05`)**: Kết hợp **Nhánh 1** (trùng tiền tố 5 thành phần `legacyFivePartKey`) và **Nhánh 2 có điều kiện nghiêm ngặt** (trùng tên/biệt danh chuẩn hóa khác `'anon'` độ dài $\ge 2$ + cùng ngày/tháng/năm Dương lịch + cùng giới tính + có lệch giờ/phút/`unknownTime`/kinh độ), kèm khung cảnh báo nổi bật khi khác cấu trúc 12 cung. |
| **`QĐ-M3`** | Xử lý khi nộp Form lúc `hydrationStatus === 'idle' \| 'hydrating'` (`ĐC-1`) | **Khuyến nghị Phương án A (đã chuẩn hóa theo `DM-01` & `DM-11`)**: `initChartLibrary` chạy `migrateLegacyHistoryAndDossiers` đồng bộ ngay từ mili-giây đầu tiên; `detectChartDuplicateInLibrary` đọc đồng bộ chỉ mục (thuần khiết 100%, không chặn UI); nếu `completedCount === 0 && hydrationStatus === 'hydrating'` thì hiển thị nhãn *"Đang đồng bộ từ IndexedDB..."* và tự cập nhật khi `'ready'`. |
| **`QĐ-M4`** | Hành vi khi bấm nút *"Mẫu lá số kinh điển (Danh nhân)"* | **Khuyến nghị Phương án A (đã đặc tả tham số `source` theo `DM-04`)**: Phân biệt qua `source: 'user_form_submit' \| 'famous_preset'`. Với `'famous_preset'`, nếu đã có trong Thư Viện (`exact_match`) thì nạp lại êm, **bỏ qua** hộp thoại chặn Trường hợp 2. |
| **`QĐ-M5`** | Hành vi khi lá số `exact_match` chính là lá số đang mở trên Thiên Bàn (`activeChartIdentityKey === incomingChartIdentityKey`) | **Khuyến nghị Phương án A (đã tinh chỉnh theo `DM-12`)**: Vẫn hiện thông báo xác nhận rõ ràng (với câu chữ phân biệt *"đang hiển thị sẵn trên Thiên Bàn"*) ở cả Banner dưới Quick Summary Bar và nội tuyến trong `BirthForm`, đồng thời đóng `showFormDrawer` (nếu đang mở). |
| **`QĐ-M6`** | Số hiệu phiên bản đích sau khi triển khai | **Khuyến nghị Phương án A (theo `DM-10`)**: Nâng `/VERSION` lên **`1.3.0-rc.1`** và nâng `package.json` `"version"` lên **`"1.3.0"`**. |

---

### 4.3. Danh sách thay đổi chính từ Bản V1 → Bản POST-PANEL V2 (`docs/chart-duplicate-detection-design-plan.md`)

1. **Header & Trạng thái tài liệu**: Nâng lên **BẢN POST-PANEL V2**, ghi rõ ngày cập nhật sau phiên phản biện Tổ Chuyên Gia 5 vai và liên kết sang biên bản `docs/chart-duplicate-detection-expert-panel-review.md`.
2. **Mục 1.1 & 1.3**: Sửa trích dẫn số dòng `upsertChartToLibrary` thành `src/lib/chart-library.ts:1712–1795` (`DM-03`); làm rõ thời điểm gọi `migrateLegacyHistoryAndDossiers` trong `initChartLibrary` (`DM-01`).
3. **Mục 2.1, 2.2 & 2.3**:
   - Bổ sung helper `resolveEffectiveDossierSummaryForEntry` (`DM-11`).
   - Mở rộng `diffBirthFormsForDuplicateModal` nhận `savedEntryMeta?: { customAlias?: string; notes?: string }` và sắp xếp các dòng diff có `affectsChartStructure === true` lên đầu bảng (`DM-05`, `DM-13`).
   - Thay thế công thức cộng điểm tuyến tính bằng hàm `computeNearMatchSimilarityScore` phân tầng 4 bậc không chồng lấn (`+1000` / `+300`..`+150` / `+50` / `+completedCount * 5`) (`DM-06`).
   - Siết chặt 4 điều kiện của Nhánh 2 (`same_name_and_solar_date`) và giữ `detectChartDuplicateInLibrary` thuần khiết 100% không tác dụng phụ (`DM-01`, `DM-05`).
4. **Mục 3.1, 3.2 & 3.3**:
   - Nâng thời gian tự ẩn của Banner Trường hợp 1 lên `15 giây` có tạm dừng khi `hover`/`focus`/`touch`, bổ sung thông báo nội tuyến kép (`Dual Feedback`) và phân biệt câu chữ khi `isAlreadyActiveOnBoard === true` (`DM-07`, `DM-12`).
   - Trong Trường hợp 1 (`exact_match`), tái tạo `savedChart = buildChartFromForm(existingEntry.form)` để nhất quán tuyệt đối với `existingEntry.form` (`DM-02`).
   - Bổ sung khung cảnh báo Hổ phách cho ứng viên khác cấu trúc 12 cung (`DM-05`), định danh tự động kèm trích đoạn `notes` cho lá số ẩn danh (`DM-13`), nhãn `[Lá số gốc vừa nạp để chỉnh sửa]` (`DM-13`), và chốt chặn `Stale Entry Guard` trước khi mở lá số đã lưu (`DM-08`).
5. **Mục 4.1 & 4.3**: Cập nhật luồng di trú đồng bộ ở đầu `initChartLibrary` (`DM-01`) và đặc tả tham số `source?: 'user_form_submit' | 'famous_preset'` trên `BirthForm.onChartGenerated` (`DM-04`).
6. **Mục 5 (`QĐ-M1..QĐ-M6`)**: Ghi rõ khuyến nghị cuối cùng của Tổ Chuyên Gia sau phản biện cho từng quyết định (`DM-10`).
7. **Mục 6 (`TEST-L18..TEST-L22`)**: Cập nhật `TEST-L19` (kiểm chứng tham số `source` và diff có `customAlias`), `TEST-L20` (4 ứng viên theo công thức phân tầng `DM-06`), `TEST-L21` (thêm kiểm chứng `Stale Entry Guard` `DM-08`), và `TEST-L22` Ca 2 (kiểm chứng tính thuần khiết khi gọi `detectChartDuplicateInLibrary` 2 lần liên tiếp lúc `'hydrating'` theo `DM-01`).
8. **Mục 8**: Chuyển 5 câu hỏi mở của V1 thành **Mục 8 — Bảng Giải Đáp & Quy Tắc Đã Chốt Từ 5 Câu Hỏi Mở Của V1** (`DM-13`).
