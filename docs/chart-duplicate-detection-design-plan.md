# KẾ HOẠCH THIẾT KẾ — PHÁT HIỆN LÁ SỐ TRÙNG KHI LẬP LÁ SỐ (`docs/chart-duplicate-detection-design-plan.md`)

- **Loại tài liệu**: `[Kế hoạch Thiết kế Kỹ thuật — BẢN POST-PANEL V2 (ĐÃ TÍCH HỢP KẾT LUẬN TỔ CHUYÊN GIA 5 VAI & AGENDA ĐP-1..ĐP-10)]`
- **Trạng thái hiệu lực**: `BẢN POST-PANEL V2 — ĐÃ THẨM ĐỊNH KỸ THUẬT (DM-01..DM-13), CHỜ CHỦ DỰ ÁN CHỐT QUYẾT ĐỊNH QĐ-M1..QĐ-M6 (CHƯA SỬA CODE)`
- **Biên bản phản biện đối ứng**: `docs/chart-duplicate-detection-expert-panel-review.md` (`DM-01..DM-13`, xử lý trọn vẹn `ĐP-1..ĐP-10`)
- **Phiên bản ứng dụng làm căn cứ đối chiếu**: `1.2.0-rc.2` (`package.json`: `"1.2.0"`, đồng bộ `/VERSION`)
- **Phiên bản đích khuyến nghị sau thi công (`QĐ-M6`)**: `1.3.0-rc.1` (`package.json`: `"1.3.0"`, đồng bộ theo tiền lệ bản `1.2.0-rc.1`)
- **Ngày lập kế hoạch V1**: `18/11/2026`
- **Ngày cập nhật POST-PANEL V2**: `18/11/2026`
- **Mã nguồn đối chiếu (Code SSOT)**:
  - `src/components/BirthForm.tsx` (`dòng 14–23, 35–63, 75–90, 152–204, 244–314, 516–543`)
  - `src/App.tsx` (`dòng 53–56, 98–166, 169–230, 244–264, 492–532, 570–601, 693–726`)
  - `src/lib/chart-library.ts` (`dòng 31–48, 59–113, 377–385, 467–540, 556–634, 666–699, 1026–1053, 1251–1466, 1474–1623, 1712–1809, 1916–2076, 2168–2200, 2558–2707`)
  - `src/lib/ziwei/yunxian-context.ts` (`dòng 292–310`)
  - `src/lib/ziwei/share.ts` (`dòng 23–80, 83–135`)
  - `src/lib/ziwei/types.ts` (`dòng 1–51`)
  - `src/components/ChartLibraryModal.tsx` (`dòng 711–948`)
  - `scripts/verify-chart-library.ts` (`dòng 1–1178`)
- **Quyết định & Điều chỉnh liên quan**: `QĐ-H2`, `QĐ-L1..QĐ-L9`, `ĐC-1..ĐC-6`, `LK-01..LK-10`, `DM-01..DM-13`, và `QĐ-M1..QĐ-M6`

---

## 0. Mục Tiêu Nghiệp Vụ & Ranh Giới An Toàn Bất Khả Xâm Phạm

### 0.1. Bài toán nghiệp vụ
Hiện tại trong bản `1.2.0-rc.2`, khi người dùng nhập dữ kiện khai sinh vào `BirthForm` và bấm **"An Sao Lập Lá Số"**, ứng dụng lập tức gọi `applyFormAndChart(c, f, true)` $\rightarrow$ `saveChart(form)` (`src/lib/chart-library.ts:2661–2663`) $\rightarrow$ `upsertChartToLibrary(form)` (`src/lib/chart-library.ts:1712–1795`) mà **không thông báo trước** xem lá số đó đã từng được lập trong Thư Viện hay chưa, hoặc có lá số nào gần giống (cùng ngày/giờ/giới tính nhưng gõ khác cách viết tên, lệch vài phút sinh, hay chọn khác tỉnh/thành) đang lưu kèm Hồ Sơ Luận Giải hay không. Hệ quả:
1. Người dùng lập lại đúng lá số cũ nhưng không nhận được phản hồi tường minh rằng hệ thống vừa nạp lại lá số đã lưu và đã khôi phục $X/8$ chương luận giải.
2. Người dùng lập lại lá số của cùng một người nhưng quên cách gõ dấu/viết tắt tên (hoặc chỉnh lệch 5 phút trong cùng canh giờ / quên chọn lại tỉnh thành / cập nhật giờ sinh mới cho đương số đã lưu) $\rightarrow$ hệ thống âm thầm tạo ra một **thẻ thư viện mới tinh có `0/8` chương**, khiến người dùng tưởng mất hồ sơ cũ hoặc sinh trùng lặp tốn quota AI.

### 0.2. Hai kịch bản phát hiện khi bấm lập lá số (Chủ dự án đã chốt cách hiểu)
1. **TRƯỜNG HỢP 1 — Khớp chính xác 100% (`Exact Identity Match`)**:
   - Dữ kiện vừa nhập tạo ra khóa định danh 9 thành phần `chartIdentityKey` trùng khớp tuyệt đối với một mục `ChartLibraryEntry` đang có trong Thư Viện (`ziwei_chart_library_v1`).
   - Đây chắc chắn là **cùng một lá số** và mọi chương luận giải đã lưu dưới khóa này chính là của nó.
   - **Hành vi (`[CẬP NHẬT SAU PANEL — DM-02, DM-07, DM-12]`)**: App **chỉ hiện thông báo xác nhận/banner rõ ràng** *"Lá số này đã từng lập"* kèm trạng thái luận giải (*"đã có X/8 chương hồ sơ"* hoặc *"chưa có chương luận giải nào"*), đồng thời **TỰ ĐỘNG NẠP (LOAD)** lại lá số (`savedChart = buildChartFromForm(existingEntry.form)`) và hồ sơ đã lưu (`existingEntry.form`), cập nhật `lastOpenedAt`, không hỏi chặn bước hai và không tạo mục trùng.
2. **TRƯỜNG HỢP 2 — Khớp một phần / Gần khớp (`Partial / Near Match`)**:
   - Dữ kiện vừa nhập **không** khớp chính xác `chartIdentityKey` với bất kỳ mục nào trong Thư Viện, nhưng **trùng tiền tố khóa 5 thành phần (`legacyFivePartKey`: `${year}_${month}_${day}_${hour}_${gender}`)** với $\ge 1$ mục đã lưu trong Thư Viện (hoặc khớp Nhánh 2 có điều kiện nghiêm ngặt theo `QĐ-M2` & `DM-05`).
   - **Hành vi (`[CẬP NHẬT SAU PANEL — DM-05, DM-08, DM-13]`)**: App tạm dừng trước khi lưu, hiển thị hộp thoại đối chiếu liệt kê **RÕ TỪNG ĐIỂM SAI KHÁC** theo định dạng `"Giá trị đã lưu ↔ Giá trị vừa nhập"` cho mọi trường tạo nên sự khác biệt khóa (đẩy các trường làm thay đổi cấu trúc 12 cung lên đầu bảng kèm cảnh báo Hổ phách), kèm danh tính lá số đã lưu (tên/biệt danh `customAlias`, ngày sinh, tiến độ hồ sơ $X/8$ chương, trích đoạn ghi chú nếu ẩn danh).
   - Người dùng chủ động chọn 1 trong 2 nhánh:
     - **`[Mở lá số đã lưu]`**: Kiểm tra lại sự tồn tại của mục trong store (`Stale Entry Guard` — `DM-08`), sau đó nạp đúng `freshEntry.form` của lá số đã lưu lên Thiên Bàn bằng đúng `freshEntry.chartIdentityKey` của nó.
     - **`[Lập lá số mới theo thông tin vừa nhập]`**: Đi theo luồng tạo mới bình thường với `normalizedForm` vừa nhập và khóa `incomingChartIdentityKey` mới.

### 0.3. Ranh giới an toàn tuyệt đối (Bài học từ bản vá rò dữ liệu chéo `1.2.0-rc.2`)
> **NGUYÊN TẮC SẮT ĐÁ (`ZERO CROSS-KEY CONTAMINATION`)**:
> 1. Chọn **"Mở lá số đã lưu"** nghĩa là tái tạo `savedChart = buildChartFromForm(freshEntry.form)`, nạp nguyên vẹn `freshEntry.form` và sử dụng `freshEntry.chartIdentityKey` làm lá số đang mở (`activeChartIdentityKey = freshEntry.chartIdentityKey`). **TUYỆT ĐỐI KHÔNG** lấy `incomingForm` gắn với hồ sơ của `freshEntry`, và **TUYỆT ĐỐI KHÔNG** sao chép/gộp (`mergeDossierRecords`) bất kỳ chương nào từ `freshEntry.chartIdentityKey` sang `incomingChartIdentityKey`.
> 2. Chọn **"Lập lá số mới theo thông tin vừa nhập"** nghĩa là tạo mục thư viện mới dưới khóa `incomingChartIdentityKey` với trạng thái hồ sơ độc lập (`0/8` chương nếu khóa mới chưa từng sinh chương nào), **không kế thừa hay mượn bất kỳ dữ liệu nào** từ lá số gần khớp.

---

## 1. Khảo Sát Code Hiện Tại (Dẫn Chiếu Chính Xác `file:dòng` Trên Bản `1.2.0-rc.2`)

### 1.1. Luồng nộp Form lập lá số hiện tại (`BirthForm` $\rightarrow$ `App.tsx` $\rightarrow$ `chart-library.ts`) (`[ĐÃ ĐÍNH CHÍNH THEO DM-03 & DM-04]`)
1. **Tại `src/components/BirthForm.tsx`**:
   - Giao diện nhận prop `onChartGenerated: (chart: ZiweiChart, form: BirthFormState) => void` (`dòng 15`).
   - Có **2 nơi** trong `BirthForm.tsx` gọi `onChartGenerated` (hiện đang dùng chung một prop, chưa có tham số phân biệt nguồn gọi — xem thiết kế tách nguồn gọi tại `DM-04` Mục 4.3):
     - **Luồng 1 (Nộp form chính — `handleSubmit`, `dòng 152–175`)**: Khi người dùng bấm nút submit *"An Sao Lập Lá Số"* (`dòng 536–543`), hàm tạo `normalizedForm = { ...form, longitude: currentCity.longitude }` (`dòng 157–160`), gọi `formToBirthInfo(normalizedForm)` (`dòng 161`), `generateChart(birthInfo)` (`dòng 162`), đồng bộ `lastSyncedInitialKeyRef` (`dòng 163`), rồi gọi `onChartGenerated(chart, normalizedForm)` (`dòng 165`).
     - **Luồng 2 (Chọn nhanh Danh nhân trong Form — `handleFamousLoad`, `dòng 177–204`)**: Khi bấm vào 1 trong 5 nút danh nhân gợi ý ở cuối form (`dòng 516–526`), hàm tạo `presetForm` (`dòng 182–194`), cập nhật `lastSyncedInitialKeyRef` (`dòng 195`) và gọi `onChartGenerated(chart, presetForm)` (`dòng 200`).
   - Ngược lại, khi người dùng bấm chọn một mục trong ngăn **"Gần đây"** (`dòng 268–275`), `BirthForm` gọi `onSelectHistory?.(item.form)` (`dòng 273`) chứ không gọi `onChartGenerated`.
2. **Tại `src/App.tsx`**:
   - `BirthForm` được render tại **2 vị trí** trong tab `'chart'`:
     - Ngăn kéo thu gọn (`showFormDrawer`, `dòng 510–532`): `onChartGenerated={(c, f) => { applyFormAndChart(c, f, true); setShowFormDrawer(false); }}` (`dòng 526–529`).
     - Cột phải 5 cột (`!showFormDrawer`, `dòng 570–583`): `onChartGenerated={(c, f) => applyFormAndChart(c, f, true)}` (`dòng 581`).
   - Hàm trung tâm `applyFormAndChart(newChart, form, saveToLibrary = true)` (`src/App.tsx:192–212`):
     - Cập nhật `setChart(newChart)`, `setCurrentForm(form)`, `setActiveSihua(...)`, xóa lựa chọn cung/sao/tứ hóa (`dòng 194–199`).
     - Nếu `saveToLibrary === true`: gọi `saveChart(form)` (`dòng 200–202`), tức wrapper (`src/lib/chart-library.ts:2661–2663`) gọi thẳng `upsertChartToLibrary(form)` (`src/lib/chart-library.ts:1712–1795`). *(Đã đính chính số dòng theo `DM-03`)*.
     - Gọi `hydratePeriodCacheFromLibrary(newChart)` (`dòng 203`) để bơm Chương 5/6 (nếu có) vào `aiPeriodCache` (`dòng 142–159`).
     - Cập nhật URL query string bằng `window.history.replaceState(null, '', \`?\${qs}\`)` (`dòng 204–209`).
   - Các điểm gọi `applyFormAndChart` khác trong `App.tsx`:
     - Khôi phục từ URL query params lúc mở trang (`dòng 215–230`): gọi `applyFormAndChart(restoredChart, merged, false)` (`saveToLibrary = false`).
     - Chọn Danh nhân từ tab `'famous'` (`handleFamousSelect`, `dòng 244–264`): gọi `applyFormAndChart(c, presetForm, true)`.
     - Chọn mục trong ngăn `Gần đây` của `BirthForm` (`dòng 515–520` và `574–578`): gọi `applyFormAndChart(c, form, false)` + `markLibraryEntryOpened(buildChartIdentityKey(c))` (`src/lib/chart-library.ts:1797–1809`).
     - Chọn mục từ `ChartLibraryModal` (`onSelectChart`, `dòng 701–710`): gọi `markLibraryEntryOpened(entry.chartIdentityKey)` + `applyFormAndChart(nextChart, entry.form, false)`.
     - Bấm *"Nạp dữ kiện lên Form để sửa & lập lá số mới"* từ `ChartLibraryModal` (`onLoadIntoFormToEditNew`, `dòng 711–716`): gọi `setCurrentForm(entry.form)` + `setShowFormDrawer(true)`.

### 1.2. Cấu trúc Khóa Định Danh 9 Thành Phần (`chartIdentityKey`) vs Khóa 5 Thành Phần (`legacyFivePartKey`)
1. **Khóa 9 thành phần (`buildChartIdentityKey` tại `src/lib/ziwei/yunxian-context.ts:292–310`)**:
   ```ts
   return `${b.year}_${b.month}_${b.day}_${b.hour}_${b.gender}__${nameSlug}__mg${chart.mingGongBranch}__${leapFlag}__${origSig}__${lonSig}`;
   ```
   Trong đó:
   - Thành phần 1–5 (`legacyFivePartKey`, dựng bởi `buildLegacyFivePartKey` tại `src/lib/chart-library.ts:471–474`): `${b.year}_${b.month}_${b.day}_${b.hour}_${b.gender}`.
     - **Lưu ý cực kỳ quan trọng về `b.year`, `b.month`, `b.day`, `b.hour` (`src/lib/ziwei/share.ts:43–79`)**:
       - Khi `form.unknownTime === false`, `formToBirthInfo` tính Chân Thái Dương Thời `solar = formToTrueSolarTime(form)` (`share.ts:55`), lấy `hour = solar.branch` (`0..11`), và nếu rơi vào **Giờ Dạ Tý (`23:00–23:59` theo Chân Thái Dương Thời)** thì `resolveZiweiDayOffset(solar)` dịch `year/month/day` sang ngày hôm sau (`share.ts:57–60`), đồng thời lưu ngày giờ đồng hồ gốc vào `b.origInput` (`share.ts:61–67`).
       - Khi `form.unknownTime === true`, `b.hour = 0` (tạm lấy Giờ Tý), `b.origInput = undefined` (`origSig = 'no_clock'`).
   - Thành phần 6 (`nameSlug`, `yunxian-context.ts:294–300` & `chart-library.ts:476–485`): tên đương số đã `trim()`, chuẩn hóa `NFC`, viết thường, thay ký tự không phải chữ/số bằng `'-'`, hoặc `'anon'` nếu để trống tên.
   - Thành phần 7 (`mg${chart.mingGongBranch}`, `yunxian-context.ts:309`): chi của cung Mệnh (`0..11`).
   - Thành phần 8 (`leapFlag`, `yunxian-context.ts:301`): `'leap1'` nếu `chart.lunarInfo?.isLeapMonth === true`, ngược lại `'leap0'`.
   - Thành phần 9 (`origSig`, `yunxian-context.ts:302–304`): `${origInput.year}-${origInput.month}-${origInput.day}@${origInput.clockHour}:${origInput.clockMinute}` hoặc `'no_clock'` khi `unknownTime === true`.
   - Thành phần 10 (`lonSig`, `yunxian-context.ts:305–308`): `b.longitude.toFixed(2)` (khi có `form.province`) hoặc `'no_lon'`.

### 1.3. Thời điểm Hydration của Thư Viện (`ĐC-1`) và Cấu trúc Chỉ mục (`[LÀM RÕ THEO DM-01]`)
1. **Đọc đồng bộ chỉ mục (`readLibraryIndexStore` tại `src/lib/chart-library.ts:666–699`)**:
   - Chỉ mục `ChartLibraryIndexStore` nằm trong `window.localStorage['ziwei_chart_library_v1']`, được đọc **đồng bộ tức thì (`0 ms`)** ngay từ lúc khởi tạo state `useState(() => readLibraryIndexStore().entries)` (`src/lib/chart-library.ts:2632–2634`).
   - Mỗi phần tử `ChartLibraryEntry` (`dòng 87–101`) trong `localStorage` **đã có sẵn**:
     - `chartIdentityKey` (khóa đầy đủ),
     - `legacyFivePartKey` (tiền tố 5 thành phần),
     - `form: Readonly<BirthFormState>` (đầy đủ 11 trường form gốc),
     - `customAlias`, `notes`, `pinned`, `deterministicBadge`, và `dossierSummary` (`completedCount`, `incompleteCount`, `completedChapterIds`, ...).
2. **Tiến trình Hydration bất đồng bộ (`initChartLibrary` tại `src/lib/chart-library.ts:1474–1615`)**:
   - Khi `useChartLibrary` mount (`dòng 2652–2659`), `initChartLibrary` mở `IndexedDB` (`ziwei_thien_ky_library_db_v1`), chuyển `hydrationStatus` từ `'idle'` $\rightarrow$ `'hydrating'` $\rightarrow$ `'ready'` (hoặc `'degraded'` nếu `IndexedDB` bị chặn).
   - **Điểm tinh chỉnh theo `DM-01` (`ĐP-1`)**: Hiện tại trong `initChartLibrary`, `migrateLegacyHistoryAndDossiers(currentForm)` chỉ được gọi tại `dòng 1591` (sau khi `await runtimeIdbAdapter.getAll()` xong) hoặc tại `dòng 1499` (nếu `IndexedDB` không khả dụng). Khi triển khai bản V2, ta gọi thêm `migrateLegacyHistoryAndDossiers(currentForm)` **đồng bộ ngay ở đầu `initChartLibrary` (`dòng 1483`, trước khi vào IIFE `async`)**. Nhờ bản vá `LK-05` (`1.2.0-rc.2`), hàm `migrateLegacyHistoryAndDossiers` đã lũy đẳng 100%, nên toàn bộ mục trong `ziwei_history` sẽ có mặt trong `ziwei_chart_library_v1` ngay từ mili-giây đầu tiên mà `detectChartDuplicateInLibrary` vẫn giữ được tính thuần khiết 100% (chỉ đọc).

### 1.4. Các hàm sẵn có trong `src/lib/chart-library.ts` có thể tái sử dụng trực tiếp
- `resolveChartAndIdentityFromForm(form)` (`dòng 617–634`): trả về `{ normalizedForm, chart, chartIdentityKey, legacyFivePartKey }`.
- `readLibraryIndexStore()` (`dòng 666–699`): trả về `{ entries, deletedTombstones, updatedAt }`.
- `getDossierReadState(chartIdentityKey, chart)` (`dòng 2019–2076`) & `computeDossierSummary(record)` (`dòng 556–615`): lấy trạng thái hồ sơ chuẩn xác theo `ĐC-1` và `ĐC-3`.
- `upsertChartToLibrary(form, options)` (`dòng 1712–1795`) & `markLibraryEntryOpened(chartIdentityKey)` (`dòng 1797–1809`).
- `foldVietnameseSearchText(input)` (`dòng 2558–2566`): chuẩn hóa bỏ dấu tiếng Việt để so sánh tên và biệt danh khi cần.

---

## 2. Thiết Kế Các Hàm Thuần (Đặt Tại `src/lib/chart-library.ts`) (`[CẬP NHẬT SAU PANEL — DM-01, DM-05, DM-06, DM-11, DM-13]`)

Để đảm bảo tách biệt hoàn toàn logic nghiệp vụ khỏi giao diện React và dễ dàng kiểm thử tự động trong `scripts/verify-chart-library.ts`, toàn bộ thuật toán phát hiện trùng và đối chiếu trường (`diff`) được thiết kế thành **các hàm thuần 100% chỉ đọc (pure/read-only deterministic functions — tuyệt đối không ghi xuống storage theo `DM-01`)** đặt tại **Mục 10B mới trong `src/lib/chart-library.ts`** (ngay trước `upsertChartToLibrary`).

### 2.1. Kiểu dữ liệu trả về (`Types & Interfaces`)

```ts
export type DuplicateDiffFieldKey =
  | 'name'
  | 'birthDateSolar'
  | 'clockTime'
  | 'unknownTime'
  | 'shichenBranch'
  | 'gender'
  | 'location'
  | 'longitude'
  | 'trueSolarTime'
  | 'mingGongBranch'
  | 'lunarLeapMonth';

export interface BirthFormFieldDiff {
  field: DuplicateDiffFieldKey;
  labelVi: string;
  savedValueVi: string;
  incomingValueVi: string;
  /** Đánh dấu trường trực tiếp làm thay đổi cấu trúc 12 cung / bàn sao (Cung Mệnh, Canh giờ, Ngày an sao, Tháng nhuận, Giới tính) */
  affectsChartStructure: boolean;
}

export interface NearMatchLibraryCandidate {
  entry: ChartLibraryEntry;
  /** Lý do khớp gần: trùng tiền tố 5 thành phần (cùng ngày/canh giờ/giới tính sau quy đổi) hoặc trùng tên/biệt danh + ngày sinh dương lịch + giới tính */
  matchReason: 'same_five_part_key' | 'same_name_and_solar_date';
  matchReasonLabelVi: string;
  diffs: BirthFormFieldDiff[];
  /** Cờ báo hiệu ứng viên này có cấu trúc 12 cung / Cung Mệnh khác với thông tin vừa nhập (DM-05) */
  hasStructuralChartDiff: boolean;
  /** Số chương hoàn tất thực tế đã đồng bộ qua resolveEffectiveDossierSummaryForEntry (DM-11) */
  effectiveCompletedCount: number;
  effectiveIncompleteCount: number;
  /** Điểm tương đồng phân tầng không chồng lấn để sắp xếp ưu tiên ứng viên gần nhất lên đầu (DM-06) */
  similarityScore: number;
}

export type ChartDuplicateDetectionResult =
  | {
      kind: 'none';
      incomingForm: BirthFormState;
      incomingChart: ZiweiChart;
      incomingChartIdentityKey: string;
      incomingFivePartKey: string;
      hydrationStatus: LibraryHydrationStatus;
    }
  | {
      kind: 'exact_match';
      incomingForm: BirthFormState;
      incomingChart: ZiweiChart;
      incomingChartIdentityKey: string;
      incomingFivePartKey: string;
      existingEntry: ChartLibraryEntry;
      /** Số chương hoàn tất mới nhất từ resolveEffectiveDossierSummaryForEntry (DM-11) */
      completedCount: number;
      incompleteCount: number;
      hydrationStatus: LibraryHydrationStatus;
    }
  | {
      kind: 'near_match';
      incomingForm: BirthFormState;
      incomingChart: ZiweiChart;
      incomingChartIdentityKey: string;
      incomingFivePartKey: string;
      candidates: NearMatchLibraryCandidate[];
      /** Tổng số ứng viên gần khớp tìm thấy trước khi cắt theo giới hạn hiển thị */
      totalCandidateCount: number;
      hydrationStatus: LibraryHydrationStatus;
    };
```

### 2.2. Hàm phụ trợ đọc số chương chuẩn xác (`resolveEffectiveDossierSummaryForEntry`) (`[MỚI TỪ DM-11]`)

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
- **Lý do kỹ thuật (`DM-11`)**: Khi `readState.record !== null` (đã đọc được từ `ram_ssot`, `hot_fallback`, hoặc `session_fallback`), `computeDossierSummary(readState.record)` phản ánh chính xác nhất số chương hiện tại (kể cả khi vừa xóa bớt 1 chương). Chỉ khi `readState.record === null` (ví dụ chương nằm trong `IndexedDB` chưa thuộc top-3 hot cache và đang `hydrating`), hệ thống mới dùng `entry.dossierSummary` đã lưu trong chỉ mục `localStorage`.

### 2.3. Hàm đối chiếu chi tiết từng trường: `diffBirthFormsForDuplicateModal` (`[CẬP NHẬT THEO DM-05 & DM-13]`)

#### Chữ ký hàm:
```ts
export function diffBirthFormsForDuplicateModal(
  savedForm: Readonly<BirthFormState>,
  incomingForm: Readonly<BirthFormState>,
  savedChart?: ZiweiChart,
  incomingChart?: ZiweiChart,
  savedEntryMeta?: { customAlias?: string; notes?: string },
): BirthFormFieldDiff[]
```

#### Danh mục đầy đủ 11 trường được đối chiếu (`giá trị đã lưu ↔ giá trị vừa nhập`):
Hàm dựng `sChart = savedChart ?? generateChart(formToBirthInfo(savedForm))` và `iChart = incomingChart ?? generateChart(formToBirthInfo(incomingForm))` để đối chiếu cả **dữ kiện nhập trên Form** lẫn **dữ kiện dẫn xuất tạo nên `chartIdentityKey`**:

| Thứ tự | Mã trường (`field`) | Nhãn hiển thị (`labelVi`) | Điều kiện phát sinh điểm khác biệt | Định dạng `savedValueVi` ↔ `incomingValueVi` | `affectsChartStructure` |
|:---:|---|---|---|---|---|
| 1 | `name` | `Họ tên đương số` | `(savedForm.name || '').trim() !== (incomingForm.name || '').trim()` (kể cả khi khác dấu mà cùng `nameSlug`, hoặc một bên để trống) | `"Nguyễn Văn An"` *(nếu có `savedEntryMeta.customAlias` thì hiển thị `"Nguyễn Văn An (Biệt danh: Anh An)"` — `DM-13`)* ↔ `"Nguyen Van An"` (nếu trống hiển thị `"(Để trống / Ẩn danh)"`) | `false` |
| 2 | `birthDateSolar` | `Ngày sinh Dương lịch` | Khác `year`, `month`, hoặc `day` trên form gốc (xảy ra khi một bên sinh 23:30 ngày 15 Dạ Tý quy sang ngày 16, còn bên kia sinh 00:15 ngày 16 Sớm Tý) | `"15/08/1995"` ↔ `"16/08/1995"` | `true` |
| 3 | `unknownTime` | `Chế độ giờ sinh` | `Boolean(savedForm.unknownTime) !== Boolean(incomingForm.unknownTime)` | `"Đã biết giờ sinh"` ↔ `"Chưa rõ giờ sinh (tạm lấy Giờ Tý 00:00)"` | `true` |
| 4 | `clockTime` | `Giờ · Phút đồng hồ` | Khi cả hai cùng `unknownTime === false` nhưng khác `Number(clockHour)` hoặc `Number(clockMinute)` | `"10:30"` ↔ `"10:45"` (luôn `padStart(2, '0')`) | `sChart.birthInfo.hour !== iChart.birthInfo.hour` |
| 5 | `location` | `Nơi sinh (Tỉnh/Thành)` | Khác `savedForm.province` hoặc `savedForm.city` (`DM-13` Câu hỏi 2: giữ tách riêng với `longitude`) | `"Hà Nội (Việt Nam — Miền Bắc)"` ↔ `"Đà Nẵng (Việt Nam — Miền Trung)"` | `false` |
| 6 | `longitude` | `Kinh độ hiệu chỉnh` | `Math.abs((savedForm.longitude ?? 0) - (incomingForm.longitude ?? 0)) >= 0.005` | `"105.85°Đ"` ↔ `"108.22°Đ"` | `false` |
| 7 | `trueSolarTime` | `Chân Thái Dương Thời` | Khi cả hai có giờ sinh nhưng giờ:phút Mặt Trời thực hoặc Canh giờ sau hiệu chỉnh kinh độ khác nhau | `"10:15 (Giờ Tỵ)"` ↔ `"10:39 (Giờ Tỵ)"` | `sChart.birthInfo.hour !== iChart.birthInfo.hour` |
| 8 | `shichenBranch` | `Canh giờ an sao` | `sChart.birthInfo.hour !== iChart.birthInfo.hour` (khi khớp Nhánh 2 theo `QĐ-M2`) | `"Giờ Tỵ (09:00–10:59)"` ↔ `"Giờ Ngọ (11:00–12:59)"` | `true` |
| 9 | `mingGongBranch` | `Cung Mệnh an tại` | `sChart.mingGongBranch !== iChart.mingGongBranch` | `"Cung Mệnh tại Tỵ"` ↔ `"Cung Mệnh tại Ngọ"` | `true` |
| 10 | `lunarLeapMonth` | `Tháng nhuận Âm lịch` | `Boolean(sChart.lunarInfo?.isLeapMonth) !== Boolean(iChart.lunarInfo?.isLeapMonth)` | `"Tháng thường (leap0)"` ↔ `"Tháng nhuận (leap1)"` | `true` |
| 11 | `gender` | `Giới tính` | `savedForm.gender !== incomingForm.gender` | `"Nam Mệnh"` ↔ `"Nữ Mệnh"` | `true` |

> **Quy tắc sắp xếp dòng diff (`DM-05`)**: Sau khi thu thập các trường khác biệt, hàm sắp xếp ổn định (`stable sort`) đẩy toàn bộ dòng có **`affectsChartStructure === true` lên đầu mảng `diffs`**, theo sau là các dòng chỉ khác siêu dữ liệu (`name`, `location`, `longitude`, `clockTime` cùng canh giờ). Nhờ vậy, khi hai lá số khác giờ an sao hoặc khác cung Mệnh, người dùng luôn nhìn thấy điểm khác biệt cốt tử đó ở ngay dòng đầu tiên.
>
> **Bảo hiểm không rỗng**: Nếu hai lá số có `chartIdentityKey` khác nhau nhưng mọi trường cơ bản phía trên trùng (trường hợp cực hiếm), hàm tự động phân rã các thành phần của `savedKey` và `incomingKey` để luôn trả về ít nhất 1 dòng diff tường minh.

### 2.4. Hàm phát hiện trùng chính: `detectChartDuplicateInLibrary` (`[CẬP NHẬT THEO DM-01, DM-05, DM-06, DM-11, DM-13]`)

#### Chữ ký hàm:
```ts
export const MAX_NEAR_MATCH_CANDIDATES = 5;

export function detectChartDuplicateInLibrary(
  incomingRawForm: BirthFormState,
  options?: {
    entries?: readonly ChartLibraryEntry[];
    maxCandidates?: number;
    /** Mặc định true theo khuyến nghị QĐ-M2 Phương án B (đã siết điều kiện theo DM-05) */
    includeSameNameAndDate?: boolean;
  },
): ChartDuplicateDetectionResult
```

#### Thuật toán xử lý từng bước (Thuần khiết 100% — Không tác dụng phụ ghi storage theo `DM-01`):
1. **Bước 1 — Chuẩn hóa & Tính khóa đầu vào**:
   - Gọi `const { normalizedForm, chart, chartIdentityKey, legacyFivePartKey } = resolveChartAndIdentityFromForm(incomingRawForm);` (`src/lib/chart-library.ts:617–634`).
   - Đọc danh sách mục thư viện hiện hành (chỉ đọc): `const entries = options?.entries ?? readLibraryIndexStore().entries;`.
   - Lấy trạng thái hydration hiện tại: `const currentHydration = getLibraryHydrationStatus();`.
2. **Bước 2 — Kiểm tra TRƯỜNG HỢP 1 (Khớp chính xác 100% `chartIdentityKey`)**:
   - Tìm `const exactEntry = entries.find((e) => e.chartIdentityKey === chartIdentityKey);`.
   - Nếu tìm thấy `exactEntry`:
     - Gọi `const effectiveSummary = resolveEffectiveDossierSummaryForEntry(exactEntry, chart);` (`DM-11`).
     - Trả về ngay `{ kind: 'exact_match', incomingForm: normalizedForm, incomingChart: chart, incomingChartIdentityKey: chartIdentityKey, incomingFivePartKey: legacyFivePartKey, existingEntry: exactEntry, completedCount: effectiveSummary.completedCount, incompleteCount: effectiveSummary.incompleteCount, hydrationStatus: currentHydration }`.
     - **Quan trọng**: Khi đã khớp chính xác (`exact_match`), thuật toán dừng ngay và **không** quét danh sách `near_match`.
3. **Bước 3 — Kiểm tra TRƯỜNG HỢP 2 (Khớp một phần / Gần khớp)**:
   - Chuẩn bị tên chuẩn hóa của dữ kiện vừa nhập: `const foldedIncomingName = foldVietnameseSearchText(normalizedForm.name || '');`.
   - Duyệt qua các mục `entry` trong `entries` (với `entry.chartIdentityKey !== chartIdentityKey`):
     - `const foldedSavedName = foldVietnameseSearchText(entry.form.name || '');`
     - `const foldedSavedAlias = foldVietnameseSearchText(entry.customAlias || '');`
     - **Nhánh 1 — Trùng tiền tố 5 thành phần (`same_five_part_key`)**:
       `const isSameFivePart = entry.legacyFivePartKey === legacyFivePartKey;` (cùng `year_month_day_hour_gender` sau quy đổi Chân Thái Dương Thời / Dạ Tý $\rightarrow$ cùng cấu trúc 12 cung).
     - **Nhánh 2 — Trùng Tên/Biệt danh + Ngày sinh Dương lịch + Giới tính nhưng lệch Canh giờ (`same_name_and_solar_date`, khi `options?.includeSameNameAndDate !== false` — đã siết 4 điều kiện theo `DM-05`)**:
       Chỉ khớp khi `!isSameFivePart` và thỏa mãn **đồng thời 4 điều kiện**:
       1. `foldedIncomingName.length >= 2 && foldedIncomingName !== 'anon'` và `(foldedIncomingName === foldedSavedName || (foldedSavedAlias.length >= 2 && foldedIncomingName === foldedSavedAlias))`.
       2. `Number(entry.form.year) === Number(normalizedForm.year) && Number(entry.form.month) === Number(normalizedForm.month) && Number(entry.form.day) === Number(normalizedForm.day)`.
       3. `entry.form.gender === normalizedForm.gender`.
       4. Có sự khác biệt về giờ/phút đồng hồ, `unknownTime`, hoặc kinh độ (`Boolean(entry.form.unknownTime) !== Boolean(normalizedForm.unknownTime) || Number(entry.form.clockHour) !== Number(normalizedForm.clockHour) || Number(entry.form.clockMinute) !== Number(normalizedForm.clockMinute) || Math.abs((entry.form.longitude ?? 0) - (normalizedForm.longitude ?? 0)) >= 0.005`).
   - Với mỗi `entry` thỏa mãn Nhánh 1 hoặc Nhánh 2:
     - Tính `const savedChart = generateChart(formToBirthInfo(entry.form));`.
     - Tính `const diffs = diffBirthFormsForDuplicateModal(entry.form, normalizedForm, savedChart, chart, { customAlias: entry.customAlias, notes: entry.notes });`.
     - Tính `const hasStructuralChartDiff = diffs.some((d) => d.affectsChartStructure);`.
     - Tính `const effectiveSummary = resolveEffectiveDossierSummaryForEntry(entry, savedChart);`.
     - **Tính điểm ưu tiên phân tầng không chồng lấn `similarityScore` (`DM-06` — sửa triệt để lỗi trọng số của V1)**:
       - **Tầng 1 (`Tier 1` — Cùng tiền tố 5 thành phần `legacyFivePartKey`)**: `+1000` nếu `isSameFivePart`, ngược lại `+0`.
       - **Tầng 2 (`Tier 2` — Khớp Tên hoặc Biệt danh)**:
         - `+300` nếu `foldedIncomingName !== '' && (foldedIncomingName === foldedSavedName || foldedIncomingName === foldedSavedAlias)`.
         - `+150` nếu cả hai đều ẩn danh (`foldedIncomingName === '' && foldedSavedName === '' && foldedSavedAlias === ''`).
         - `+0` nếu hai bên có tên khác nhau.
       - **Tầng 3 (`Tier 3` — Trạng thái Ghim)**: `+50` nếu `entry.pinned === true`, ngược lại `+0`.
       - **Tầng 4 (`Tier 4` — Số chương hoàn tất)**: `+ (effectiveSummary.completedCount * 5)` (tối đa `8 * 5 = 40` điểm $< 50$, đảm bảo **không bao giờ** một lá số khác tên có `8/8` chương vượt mặt lá số trùng tên có `0/8` chương!).
   - **Sắp xếp danh sách ứng viên (`Multi-Tier Deterministic Sort` — `DM-06`)**:
     - So sánh `b.similarityScore - a.similarityScore`.
     - Nếu bằng nhau: so sánh `b.entry.lastOpenedAt - a.entry.lastOpenedAt`.
     - Nếu vẫn bằng nhau: so sánh `a.entry.chartIdentityKey.localeCompare(b.entry.chartIdentityKey)`.
   - Cắt tối đa `maxCandidates = options?.maxCandidates ?? MAX_NEAR_MATCH_CANDIDATES` (`5` mục).
   - Nếu `candidates.length > 0`: trả về `{ kind: 'near_match', incomingForm: normalizedForm, incomingChart: chart, incomingChartIdentityKey: chartIdentityKey, incomingFivePartKey: legacyFivePartKey, candidates, totalCandidateCount, hydrationStatus: currentHydration }`.
4. **Bước 4 — Không trùng (`none`)**:
   - Trả về `{ kind: 'none', incomingForm: normalizedForm, incomingChart: chart, incomingChartIdentityKey: chartIdentityKey, incomingFivePartKey: legacyFivePartKey, hydrationStatus: currentHydration }`.

---

## 3. Thiết Kế Trải Nghiệm Người Dùng (UX) & Nội Dung Văn Bản Mẫu Tiếng Việt (`[CẬP NHẬT SAU PANEL — DM-02, DM-05, DM-07, DM-08, DM-12, DM-13]`)

Tuân thủ nghiêm ngặt quy tắc môi trường (`CLEAN UI`, **cấm dùng `window.alert` / `window.confirm` / `window.open`**), toàn bộ thông báo được thiết kế bằng component nội tuyến / hộp thoại chuẩn giao diện Cổ Phong của dự án (`bg-[var(--t-card)]`, viền `border-[var(--t-gold)]/50`, font số `tabular-nums`).

### 3.1. UX cho TRƯỜNG HỢP 1 — Khớp chính xác 100% (`exact_match`) (`[CẬP NHẬT THEO DM-02, DM-07, DM-12]`)

#### Vị trí, Hình thức hiển thị kép (`Dual Feedback`) & Quy tắc tự ẩn:
- Khi người dùng bấm **"An Sao Lập Lá Số"** (`source === 'user_form_submit'`) và kết quả là `kind === 'exact_match'`:
  1. **Không hiện modal chặn thao tác** (đúng yêu cầu: *"TỰ ĐỘNG LOAD lại lá số và hồ sơ đã lưu, không hỏi thêm, không tạo mục trùng"*).
  2. **Nhất quán tuyệt đối (`DM-02`)**: Tái tạo `const savedChart = buildChartFromForm(existingEntry.form)` và nạp `existingEntry.form` lên Thiên Bàn, đóng ngăn nhập `showFormDrawer` (nếu đang mở), cập nhật `lastOpenedAt` và đồng bộ `aiPeriodCache` từ hồ sơ đã lưu.
  3. **Hiển thị kép (`Dual Feedback` — `DM-12` & Câu hỏi mở 4)**:
     - **Vị trí A (Banner chính dưới Quick Summary Bar tại `src/App.tsx:502–506`)**: Hiển thị thanh thông báo nổi bật kèm nút tắt **`[Mở Hồ Sơ ({X}/8 Chương)]`** và nút **`[Đóng]`**. Nếu người dùng vừa bấm từ cuối trang trên màn hình nhỏ (`< 1280px`), tự động cuộn mượt lên vùng Quick Summary Bar để người dùng thấy ngay Thiên Bàn và Banner.
     - **Vị trí B (Phản hồi nội tuyến ngay trong `BirthForm.tsx`)**: Khi `BirthForm` ở cột phải Desktop đang hiển thị (`!showFormDrawer`), hiển thị đồng thời một hộp xác nhận gọn ngay phía trên nút submit *"An Sao Lập Lá Số"* để mắt người dùng đang nhìn vào nút bấm thấy phản hồi tức thì (`0 ms`).
  4. **Thời gian tự ẩn thông minh (`15 giây` — `DM-07`)**:
     - Tự ẩn sau **`15 giây` (`15_000 ms`)** kể từ khi hiển thị (hoặc kể từ khi `hydrationStatus` chuyển sang `'ready'`/`'degraded'` nếu ban đầu đang `'hydrating'`).
     - **Tạm dừng bộ đếm (`pause on hover / focus / touch`)** khi người dùng di chuột vào Banner hoặc chạm trên màn hình cảm ứng.
     - Tự đóng ngay lập tức khi bấm `[Mở Hồ Sơ]`, bấm `[Đóng]`, hoặc khi chuyển sang lá số khác.

#### Văn bản tiếng Việt mẫu — Trường hợp 1A (Đã có hồ sơ luận giải $X/8$ chương, với $X > 0$):
- **Nếu chuyển từ lá số khác sang (`isAlreadyActiveOnBoard === false`)**:
  > **Tiêu đề nhỏ**: `📌 Lá số này đã từng lập trong Thư Viện` `[Đã ghim]` *(nếu `existingEntry.pinned`)*
  > **Nội dung**: `Đã tự động nạp lại lá số của "{Tên hiển thị / Biệt danh}" ({Ngày/Tháng/Năm} · {Giờ sinh} · {Nơi sinh}) cùng Hồ sơ luận giải đã lưu ({X}/8 chương hoàn tất).` *(Nếu có thêm chương dở dang: `kèm {Y} chương đang lưu dở dang`).*
  > **Nút hành động nhanh trên Banner**: `[Mở Hồ Sơ ({X}/8 Chương)]` · `[Đóng]`
- **Nếu lá số vừa bấm lập chính là lá số đang mở sẵn trên Thiên Bàn (`isAlreadyActiveOnBoard === true` — `DM-12`)**:
  > **Tiêu đề nhỏ**: `📌 Lá số này đã từng lập và đang hiển thị trên Thiên Bàn`
  > **Nội dung**: `Đã làm mới lá số đã lưu của "{Tên hiển thị / Biệt danh}" ({Ngày/Tháng/Năm} · {Giờ sinh} · {Nơi sinh}). Trạng thái hồ sơ hiện tại: Đã luận giải {X}/8 chương hoàn tất.`
  > **Nút hành động nhanh trên Banner**: `[Mở Hồ Sơ ({X}/8 Chương)]` · `[Đóng]`

#### Văn bản tiếng Việt mẫu — Trường hợp 1B (Chưa luận giải chương nào, $0/8$ chương):
> **Tiêu đề nhỏ**: `📌 Lá số này đã từng lập trong Thư Viện`
> **Nội dung**: `Đã tự động nạp lại lá số đã lưu của "{Tên hiển thị / Biệt danh}" ({Ngày/Tháng/Năm} · {Giờ sinh} · {Nơi sinh}). Trạng thái hồ sơ: Chưa có chương luận giải nào (0/8 chương).` *(Nếu `hydrationStatus === 'hydrating'`: `Đang đồng bộ trạng thái Hồ sơ từ IndexedDB...` — tuân thủ `ĐC-1`).*
> **Nút hành động nhanh trên Banner**: `[Mở Hồ Sơ 8 Chương]` · `[Đóng]`

---

### 3.2. UX cho TRƯỜNG HỢP 2 — Khớp một phần / Gần khớp (`near_match`) (`[CẬP NHẬT THEO DM-05, DM-08, DM-13]`)

#### Vị trí & Hình thức hiển thị:
- Hiển thị **Hộp thoại xác nhận chuyên biệt (`DuplicateChartPromptModal.tsx`)** có lớp nền mờ `bg-black/75 backdrop-blur-sm z-50` (cùng chuẩn thiết kế với `ChartLibraryModal.tsx` và `DetailedDossierModal.tsx`).
- Hộp thoại khóa thao tác tạo mới cho đến khi người dùng chọn 1 trong 2 hành động chính (hoặc bấm `Quay lại sửa thông tin` để đóng modal giữ nguyên Form).

#### Văn bản tiếng Việt mẫu — Trường hợp 2A (Tìm thấy 1 lá số gần khớp):
- **Tiêu đề Hộp thoại**:
  `Phát Hiện Lá Số Gần Giống Trong Thư Viện`
- **Mô tả mở đầu**:
  `Thông tin khai sinh bạn vừa nhập gần giống với một lá số đã lưu trong Thư Viện, nhưng có các điểm khác biệt tạo nên mã định danh khác nhau:`
- **Khối Thông tin Lá số đã lưu (`DM-13` hỗ trợ đầy đủ Biệt danh, Ghi chú & Ẩn danh)**:
  - **Đương số đã lưu**:
    - Nếu có tên/biệt danh: `{entry.customAlias ? `${entry.customAlias} (${entry.form.name || 'Ẩn danh'})` : entry.form.name}`
    - Nếu cả tên và biệt danh đều trống (`nameSlug === 'anon'` — `DM-13` Câu hỏi 5): `Đương số chưa đặt tên · {entry.form.city || entry.form.province} · Sinh {clockTimeLabelVi} ({shichenLabelVi})`
    - Các huy hiệu đi kèm: `[Đã ghim]` *(nếu `entry.pinned`)* · `[Lá số gốc vừa nạp để chỉnh sửa]` *(nếu `entry.chartIdentityKey === editingSourceEntryKey` — `DM-13` Câu hỏi 3)*
  - **Dữ kiện gốc**: `{solarDateStr} · {clockTimeLabelVi} ({shichenLabelVi}) · {locationLabelVi} · {yinYangGenderVi}`
  - **Cung Mệnh & Cục**: `Mệnh tại {mingGongBranchVi} ({mingMajorStarsVi}) · {wuxingJuVi}`
  - **Ghi chú đã lưu** *(hiển thị nếu `entry.notes.trim() !== ''` — `DM-13` Câu hỏi 5)*: `📝 Ghi chú: "{trích 80 ký tự đầu của entry.notes}"`
  - **Trạng thái Hồ Sơ (`DM-11`)**:
    - Nếu `effectiveCompletedCount > 0`: Badge vàng `Đã luận giải {effectiveCompletedCount}/8 chương ({danh sách chương tóm tắt, VD: Ch.1, Ch.5, Ch.6})`
    - Nếu `effectiveCompletedCount === 0 && hydrationStatus === 'hydrating'`: Badge xanh `Đang đồng bộ hồ sơ từ IndexedDB...` (`ĐC-1`)
    - Nếu `effectiveCompletedCount === 0 && hydrationStatus !== 'hydrating'`: Badge xám `Chưa có chương luận giải (0/8 chương)`
- **Khối Cảnh báo Khác Cấu Trúc 12 Cung *(CHỈ HIỆN khi `candidate.hasStructuralChartDiff === true`, đặc biệt là ứng viên Nhánh 2 — `DM-05`)*:**
  > `⚠️ CẢNH BÁO KHÁC GIỜ AN SAO / KHÁC CẤU TRÚC 12 CUNG: Lá số đã lưu an Mệnh tại cung {savedMing} ({savedShichen}), còn thông tin vừa nhập an Mệnh tại cung {incomingMing} ({incomingShichen}). Hai lá số này có cấu trúc 12 cung KHÁC NHAU. Nếu bạn vừa tìm được giờ sinh mới chính xác hơn, hãy chọn "Lập lá số mới theo thông tin vừa nhập".`
- **Bảng Liệt kê từng điểm sai khác (`Giá trị đã lưu ↔ Giá trị vừa nhập`)**:
  Hiển thị từng dòng `diff` trong `candidate.diffs` (các dòng `affectsChartStructure === true` luôn đứng đầu kèm nhãn **`[Đổi cấu trúc 12 cung]`**):
  - Ví dụ dòng 1: **Họ tên đương số**: `Đã lưu: "Nguyễn Văn An" (Biệt danh: "Anh An")` $\leftrightarrow$ `Vừa nhập: "Nguyen Van An"`
  - Ví dụ dòng 2: **Giờ · Phút đồng hồ**: `Đã lưu: "10:30"` $\leftrightarrow$ `Vừa nhập: "10:15"`
  - Ví dụ dòng 3: **Nơi sinh (Tỉnh/Thành)**: `Đã lưu: "Hà Nội (Việt Nam — Miền Bắc)"` $\leftrightarrow$ `Vừa nhập: "Hải Phòng (Việt Nam — Miền Bắc)"`
  - Ví dụ dòng 4: **Kinh độ hiệu chỉnh**: `Đã lưu: "105.85°Đ"` $\leftrightarrow$ `Vừa nhập: "106.68°Đ"`
- **Ghi chú an toàn dưới bảng**:
  `Lưu ý bảo vệ dữ liệu: Nếu chọn "Mở lá số đã lưu", hệ thống sẽ nạp nguyên vẹn lá số đã lưu cùng hồ sơ của lá số đó. Nếu chọn "Lập lá số mới theo thông tin vừa nhập", hệ thống sẽ tạo một lá số độc lập mới (0/8 chương), tuyệt đối không trộn lẫn hồ sơ giữa hai lá số.`
- **Ba nút hành động**:
  1. Nút chính (Vàng kim nổi bật):
     - Nếu `hasStructuralChartDiff === false`: **`Mở lá số đã lưu`**
     - Nếu `hasStructuralChartDiff === true` (`DM-05`): **`Mở lá số cũ đã lưu ({savedShichen} · Mệnh {savedMing})`**
  2. Nút thứ hai (Viền sáng): **`Lập lá số mới theo thông tin vừa nhập`**
  3. Nút phụ góc trên / cuối: **`Quay lại sửa thông tin`** (đóng hộp thoại, giữ nguyên dữ liệu trên Form mà không lập lá số).

#### Văn bản tiếng Việt mẫu — Trường hợp 2B (Tìm thấy nhiều lá số gần khớp, $N \ge 2$):
- **Tiêu đề Hộp thoại**:
  `Phát Hiện {N} Lá Số Gần Giống Trong Thư Viện`
- **Mô tả mở đầu**:
  `Thông tin bạn vừa nhập gần giống với {N} lá số đã lưu trong Thư Viện. Vui lòng đối chiếu các điểm khác biệt bên dưới để chọn mở lại đúng lá số cũ hoặc lập lá số mới độc lập:` *(Nếu `totalCandidateCount > 5`: `Đang hiển thị 5/{totalCandidateCount} lá số gần giống nhất theo thứ tự ưu tiên`).*
- **Danh sách thẻ ứng viên (cuộn dọc nếu $> 2$ mục, tối đa hiển thị 5 mục gần nhất)**:
  Mỗi thẻ ứng viên thứ $i$ ($1..N$) hiển thị:
  - Header thẻ: `#{i} · {Tên/Biệt danh hoặc Định danh ẩn danh}` · `{Ngày sinh Dương lịch}` · Badge `Đã luận giải {X}/8 chương` (hoặc `0/8 chương`).
  - Khung cảnh báo Hổ phách nếu ứng viên $i$ có `hasStructuralChartDiff === true`.
  - Bảng điểm sai khác riêng của ứng viên $i$ so với thông tin vừa nhập (`Đã lưu ↔ Vừa nhập`).
  - Nút chọn riêng trên từng thẻ: **`[Mở lá số đã lưu này]`**.
- **Chân Hộp thoại cố định**:
  - Nút **`[Lập lá số mới theo thông tin vừa nhập]`** (tạo lá số mới hoàn toàn theo dữ kiện vừa nhập).
  - Nút **`[Quay lại sửa thông tin]`**.

### 3.3. Điều gì xảy ra chính xác sau mỗi lựa chọn? (`[ĐÃ CHUẨN HÓA THEO DM-02 & DM-08]`)

| Lựa chọn của người dùng | Thay đổi trên `chart` & `currentForm` (`App.tsx`) | Thay đổi trong Thư Viện (`chart-library.ts`) | Thay đổi đối với Hồ Sơ 8 Chương & `aiPeriodCache` |
|---|---|---|---|
| **Trường hợp 1 (Tự động nạp — `DM-02`)** | Tái tạo `const savedChart = buildChartFromForm(existingEntry.form);` $\rightarrow$ gọi `applyFormAndChart(savedChart, existingEntry.form, false)` + `upsertChartToLibrary(existingEntry.form)`, đóng `showFormDrawer`. (`chart` và `currentForm` khớp tuyệt đối 100%). | Nhánh `if (existing)` tại `chart-library.ts:1736–1755`: chỉ cập nhật `lastOpenedAt = now`, bảo toàn 100% `pinned`, `customAlias`, `notes`, `createdAt`, `dossierSummary`. | Giữ nguyên khóa `existingEntry.chartIdentityKey`; `hydratePeriodCacheFromLibrary(savedChart)` nạp chuẩn xác Chương 5/6 của đúng khóa đó. |
| **Trường hợp 2 $\rightarrow$ Chọn `[Mở lá số đã lưu]` (`DM-08`)** | Kiểm tra `const freshEntry = readLibraryIndexStore().entries.find(e => e.chartIdentityKey === chosenEntry.chartIdentityKey)`. Nếu còn tồn tại: tái tạo `savedChart = buildChartFromForm(freshEntry.form)` $\rightarrow$ gọi `applyFormAndChart(savedChart, freshEntry.form, false)` + `markLibraryEntryOpened(freshEntry.chartIdentityKey)`. Nếu đã bị xóa: đóng modal, giữ nguyên Form và báo trên Banner. | Chỉ cập nhật `lastOpenedAt` của `freshEntry`. **Không** tạo mục mới cho `incomingForm`. | Mọi truy vấn Hồ Sơ & Chat đều dùng `freshEntry.chartIdentityKey`. **Tuyệt đối không** đụng tới `incomingChartIdentityKey`. |
| **Trường hợp 2 $\rightarrow$ Chọn `[Lập lá số mới theo thông tin vừa nhập]`** | Gọi `applyFormAndChart(incomingChart, incomingForm, true)`, đóng `showFormDrawer`, xóa `editingSourceEntryKey`. | Gọi `upsertChartToLibrary(incomingForm)` tạo thẻ thư viện mới dưới khóa `incomingChartIdentityKey` (với `dossierSummary: 0/8`). | Khóa mới `incomingChartIdentityKey` có hồ sơ độc lập (`null` / `0/8`). **Tuyệt đối không** sao chép bất kỳ chương nào từ `chosenEntry`. |
| **Trường hợp 2 $\rightarrow$ Chọn `[Quay lại sửa thông tin]`** | Giữ nguyên `chart` cũ đang xem và giữ nguyên `form` người dùng đang gõ trên `BirthForm`. | Không ghi bất kỳ thay đổi nào vào Thư Viện. | Không thay đổi. |

---

## 4. Xử Lý Các Trường Hợp Cạnh (Edge Cases) (`[CẬP NHẬT THEO DM-01, DM-04, DM-08]`)

### 4.1. Nộp Form khi Thư Viện chưa Hydrated xong (`hydrationStatus === 'idle' | 'hydrating'`, Cổng `ĐC-1` & `DM-01`)
- **Giải pháp thiết kế đã chốt sau Panel (`DM-01` — Phương án (b) của Muse)**:
  1. **Di trú đồng bộ ngay tại tầng khởi tạo (`initChartLibrary`)**:
     - Tại `src/lib/chart-library.ts:1483` (ngay đầu `initChartLibrary(currentForm)`, trước khi vào khối `async` chờ `IndexedDB`), gọi đồng bộ `migrateLegacyHistoryAndDossiers(currentForm)`.
     - Vì `migrateLegacyHistoryAndDossiers` (`dòng 1251–1466`) là hàm đồng bộ 100% và lũy đẳng (`LK-05`), toàn bộ mục trong `localStorage['ziwei_history']` được đưa vào `localStorage['ziwei_chart_library_v1']` ngay ở mili-giây `0 ms` khi ứng dụng khởi chạy.
     - Nhờ đó, `detectChartDuplicateInLibrary` giữ được **tính thuần khiết 100% (chỉ đọc)** mà vẫn thấy đầy đủ mọi mục thư viện ngay cả khi `IndexedDB` đang mở chậm (`hydrationStatus === 'hydrating'`).
  2. **Hiển thị trạng thái Hồ sơ trung thực theo `ĐC-1` khi `hydrationStatus === 'hydrating'`**:
     - Với Trường hợp 1: Nếu `completedCount === 0` và `hydrationStatus === 'hydrating'`, văn bản Banner ghi rõ: *"Đã tự động nạp lại lá số đã lưu (Đang đồng bộ trạng thái Hồ sơ từ IndexedDB...)"* — không kết luận vội `0/8` trước khi `IndexedDB` nạp xong, và bộ đếm tự ẩn 15 giây chỉ bắt đầu chạy sau khi `hydrationStatus` chuyển sang `'ready'`/`'degraded'` (`DM-07`).
     - Với Trường hợp 2: Trên thẻ ứng viên gần khớp, nếu `effectiveCompletedCount === 0 && hydrationStatus === 'hydrating'`, hiển thị badge *"Đang kiểm tra hồ sơ trong IndexedDB..."* và tự động cập nhật lại con số `X/8` ngay khi `hydrationStatus` chuyển sang `'ready'` (`DM-08`).

### 4.2. Lá số khớp chính xác nhưng Đã Bị Ghim (`pinned === true`) hoặc Đã Xóa Vĩnh Viễn (`deletedTombstones`)
1. **Nếu mục khớp chính xác đang được Ghim (`existingEntry.pinned === true`)**:
   - `upsertChartToLibrary` (`dòng 1740–1746`) giữ nguyên `pinned: true` và `pinnedAt: existingEntry.pinnedAt`.
   - Thông báo Trường hợp 1 hiển thị thêm nhãn `[Đã ghim]`.
2. **Nếu lá số khớp chính xác đã từng bị người dùng xóa vĩnh viễn (`entry_and_dossier`) nên nằm trong `store.deletedTombstones` (`src/lib/chart-library.ts:103–106, 1937–1955`)**:
   - Vì mục đó đã bị xóa khỏi `store.entries` và hồ sơ của nó ở cả 4 tầng đã bị xóa sạch, nó **không còn trong Thư Viện**.
   - Do đó, `detectChartDuplicateInLibrary` trả về `kind: 'none'` (hoặc `near_match` nếu có một lá số *khác* còn sống trong Thư Viện gần giống nó).
   - Khi đi tiếp vào `upsertChartToLibrary` (`dòng 1727–1730`), hệ thống tự động gỡ `chartIdentityKey` đó khỏi `deletedTombstones` và tạo lại lá số mới bình thường.
3. **Nếu lá số khớp chính xác từng bị người dùng chọn *"Chỉ xóa Hồ Sơ (giữ Lá Số & Ghi chú)"* (`deleteMode: 'dossier_only'`)**:
   - Thẻ lá số vẫn còn trong `store.entries` (kèm `customAlias` và `notes` cũ) với `completedCount === 0`.
   - `detectChartDuplicateInLibrary` nhận diện là **Trường hợp 1 (`exact_match`)** với trạng thái *"Chưa có chương luận giải nào (0/8 chương)"*, tự động nạp lại thẻ đó (bảo toàn `customAlias` và `notes`).

### 4.3. Phân biệt Nguồn Kích Hoạt & Cơ chế truyền tham số `source` (`[ĐẶC TẢ CHI TIẾT THEO DM-04]`)

#### Thiết kế chữ ký prop `onChartGenerated` tại `src/components/BirthForm.tsx`:
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
- Trong `BirthForm.handleSubmit` (`src/components/BirthForm.tsx:165`): gọi `onChartGenerated(chart, normalizedForm, 'user_form_submit')`.
- Trong `BirthForm.handleFamousLoad` (`src/components/BirthForm.tsx:200`): gọi `onChartGenerated(chart, presetForm, 'famous_preset')`.

#### Bảng tổng hợp hành vi theo từng nguồn kích hoạt:

| Nguồn kích hoạt tạo/nạp lá số | Vị trí trong code (`1.2.0-rc.2`) | Giá trị `source` / Cách xử lý | Hành vi Kiểm tra Trùng |
|---|---|---|---|
| **1. Bấm nút submit *"An Sao Lập Lá Số"* trên `BirthForm`** (cả ở cột phải lẫn trong ngăn kéo `showFormDrawer`, bao gồm cả sau khi bấm *"Nạp dữ kiện lên Form để sửa & lập lá số mới"*) | `BirthForm.tsx:152–175` $\rightarrow$ `App.tsx:526, 581` | `source === 'user_form_submit'` | **CHẠY ĐẦY ĐỦ**:<br>- `exact_match` $\rightarrow$ Tự động nạp `existingEntry.form` + hiện Banner Trường hợp 1.<br>- `near_match` $\rightarrow$ Mở `DuplicateChartPromptModal` (Trường hợp 2).<br>- `none` $\rightarrow$ Tạo mới bình thường. |
| **2. Mở ứng dụng từ URL có query params (`?y=...&m=...&d=...`)** | `App.tsx:215–230` (`saveToLibrary = false`) | Gọi `applyFormAndChart(..., false)` | **KHÔNG CHẠY**: Link chia sẻ chỉ hiển thị lá số lên Thiên Bàn, không tự lưu vào Thư Viện và không hiện popup chặn. |
| **3. Bấm chọn một lá số từ ngăn *"Gần đây"* trong `BirthForm`** | `BirthForm.tsx:270–275` $\rightarrow$ `App.tsx:515–520, 574–578` | Gọi `onSelectHistory(item.form)` | **KHÔNG CHẠY**: Người dùng đang chủ động chọn mở một mục đã có trong Thư Viện. |
| **4. Bấm *"Mở Lá Số"* hoặc *"Mở Hồ Sơ"* từ `ChartLibraryModal`** | `App.tsx:701–710` (`onSelectChart`) | Gọi `onSelectChart(entry)` | **KHÔNG CHẠY**: Người dùng đang chọn trực tiếp mục thư viện cần mở. |
| **5. Bấm chọn *"Mẫu lá số kinh điển (Danh nhân)"* trong `BirthForm` hoặc từ tab *"Lá Số Danh Nhân"*** | `BirthForm.tsx:177–204` & `App.tsx:244–264` | `source === 'famous_preset'` (`QĐ-M4` Phương án A) | **CHỈ ÁP DỤNG TRƯỜNG HỢP 1 ÊM**: Nếu danh nhân đã có trong Thư Viện (`exact_match`) thì nạp lại `existingEntry.form` (bảo toàn ghim/ghi chú/hồ sơ); nếu `near_match` hoặc `none` thì nạp thẳng `presetForm`, **bỏ qua** hộp thoại chặn Trường hợp 2. |
| **6. Lập 2 lá số Nam/Nữ trong tab *"Hợp Bàn Đôi Lứa (`HemingView.tsx`)"*** | `src/components/HemingView.tsx` | Form đôi độc lập (`QĐ-L5`) | **KHÔNG CHẠY**: Theo `QĐ-L5`, `HemingView` không ghi vào `ziwei_chart_library_v1`. |

### 4.4. Giới hạn số lá số gần khớp hiển thị & Thứ tự ưu tiên phân tầng (`[ĐÃ SỬA THEO DM-06]`)
- **Giới hạn hiển thị (`MAX_NEAR_MATCH_CANDIDATES`)**: Tối đa **`5` lá số gần khớp** trong hộp thoại (nếu `totalCandidateCount > 5`, hiển thị dòng ghi chú: *"Đang hiển thị 5/{totalCandidateCount} lá số gần giống nhất trong Thư Viện"*).
- **Thứ tự ưu tiên phân tầng không chồng lấn (`similarityScore` — `DM-06`)**:
  1. **Tầng 1 (`+1000` điểm)**: Trùng tiền tố 5 thành phần `legacyFivePartKey` (cùng ngày/canh giờ/giới tính $\rightarrow$ cùng cấu trúc 12 cung) luôn xếp trên nhóm chỉ trùng tên + ngày sinh nhưng khác canh giờ (`+0` điểm).
  2. **Tầng 2 (`+300` / `+150` / `+0` điểm)**: Trong cùng Tầng 1, ứng viên **trùng họ tên hoặc biệt danh khác rỗng (`+300`)** luôn xếp trên ứng viên cùng ẩn danh (`+150`) và ứng viên khác tên (`+0`), bất kể ứng viên khác tên có bao nhiêu chương hồ sơ.
  3. **Tầng 3 (`+50` / `+0` điểm)**: Trong cùng Tầng 1 & Tầng 2, ứng viên đang được **Ghim (`pinned === true`, `+50`)** xếp trên ứng viên chưa ghim (`+0`).
  4. **Tầng 4 (`0..40` điểm, `effectiveCompletedCount * 5`)**: Trong cùng Tầng 1, 2, 3, ứng viên có **nhiều chương luận giải hoàn tất hơn** xếp lên trước.
  5. **Tầng 5 (`Tie-breaker`)**: Ưu tiên `lastOpenedAt` giảm dần, sau đó đến `chartIdentityKey` theo thứ tự từ điển.

---

## 5. Danh Sách Quyết Định Cần Chủ Dự Án Chốt (`QĐ-M1` .. `QĐ-M6`) — Kèm Khuyến Nghị Cuối Cùng Của Panel

### `QĐ-M1`: Trong Trường hợp 1 (Khớp chính xác 100% `chartIdentityKey`), có cần thêm nút/lối thoát *"Vẫn muốn lập lại từ đầu"* hay không?
- **Phân tích bản chất dữ liệu**:
  - `chartIdentityKey` là khóa chính duy nhất của Thư Viện, và thuật toán an sao Tử Vi (`generateChart(formToBirthInfo(form))`) là tất định 100%. Tính lại bàn sao trên cùng `BirthFormState` luôn ra đúng 12 cung đó.
  - Do đó, *"lập lại từ đầu"* trên cùng khóa thực chất là xóa bỏ Hồ sơ AI đã lưu (`deleteMode: 'dossier_only'`) để sinh lại từ `0/8` — rất dễ gây mất dữ liệu oan nếu đặt nút ngay trên thông báo lập lá số.
- **Các phương án**:
  - **Phương án A**: Chỉ hiện thông báo Banner xác nhận và tự động nạp lại lá số + hồ sơ đã lưu (`existingEntry.form`), **KHÔNG** đặt nút xóa hồ sơ trên Banner. (Nếu muốn tạo lại/xóa chương, người dùng đã có sẵn nút trong `DetailedDossierModal` và `ChartLibraryModal`).
  - **Phương án B**: Thêm liên kết phụ *"Xóa hồ sơ cũ để luận giải lại từ 0/8"* ngay trên Banner Trường hợp 1.
- **Khuyến nghị cuối cùng của Panel**: **CHỌN PHƯƠNG ÁN A** (Đồng thuận 5/5 — đúng yêu cầu *"TỰ ĐỘNG LOAD lại lá số và hồ sơ đã lưu, không hỏi thêm"* và bảo vệ an toàn dữ liệu).

---

### `QĐ-M2`: Tiêu chí phát hiện "Gần khớp" (Trường hợp 2)
- **Các phương án**:
  - **Phương án A (Thuần 5 thành phần)**: Chỉ coi là gần khớp khi `entry.legacyFivePartKey === incomingFivePartKey` (và `entry.chartIdentityKey !== incomingChartIdentityKey`).
  - **Phương án B (Kép có điều kiện nghiêm ngặt — đã siết theo `DM-05`)**:
    - **Nhánh 1**: Mọi mục có `entry.legacyFivePartKey === incomingFivePartKey` (cùng cấu trúc 12 cung, khác tên/phút sinh/tỉnh thành/kinh độ).
    - **Nhánh 2 (`DM-05`)**: Mọi mục thỏa mãn đồng thời 4 điều kiện: (1) trùng tên hoặc biệt danh chuẩn hóa khác `'anon'`, độ dài $\ge 2$; (2) trùng ngày/tháng/năm sinh Dương lịch gốc; (3) trùng giới tính; (4) có lệch giờ/phút đồng hồ, `unknownTime`, hoặc kinh độ làm đổi canh giờ. Kèm theo **Khung cảnh báo Hổ phách nổi bật** trên Modal báo rõ 2 lá số khác cung Mệnh / khác cấu trúc 12 cung.
- **Khuyến nghị cuối cùng của Panel**: **CHỌN PHƯƠNG ÁN B (đã tích hợp rào chắn `DM-05`)** — vừa giữ trọn vẹn tiêu chí tiền tố 5 thành phần, vừa bắt được trường hợp người dùng cập nhật giờ sinh cho đương số đã lưu mà không sợ bấm nhầm.

---

### `QĐ-M3`: Xử lý khi người dùng bấm nộp Form đúng vào lúc `hydrationStatus` đang là `'idle'` hoặc `'hydrating'` (`ĐC-1`)
- **Các phương án**:
  - **Phương án A (đã chuẩn hóa theo `DM-01` & `DM-11`)**:
    - `initChartLibrary` chạy `migrateLegacyHistoryAndDossiers` đồng bộ ngay từ mili-giây đầu tiên; `detectChartDuplicateInLibrary` giữ thuần khiết 100% (chỉ đọc chỉ mục đồng bộ, không chặn UI).
    - Nếu rơi vào Trường hợp 1 hoặc Trường hợp 2 lúc `hydrationStatus === 'hydrating'` và `completedCount === 0`, hiển thị nhãn *"Đang đồng bộ từ IndexedDB..."* (tuân thủ `ĐC-1`) và tự động cập nhật số chương `X/8` ngay khi `'ready'`.
  - **Phương án B**: Chặn nút submit chờ `initChartLibrary` với timeout `300 ms`.
- **Khuyến nghị cuối cùng của Panel**: **CHỌN PHƯƠNG ÁN A** (Đồng thuận 5/5 — phản hồi `0 ms`, hàm phát hiện thuần khiết 100%, tuân thủ tuyệt đối `ĐC-1`).

---

### `QĐ-M4`: Hành vi khi người dùng bấm nút *"Mẫu lá số kinh điển (Danh nhân)"* (`BirthForm.tsx:177` & `App.tsx:244`)
- **Các phương án**:
  - **Phương án A (đã đặc tả tham số `source` theo `DM-04`)**: Phân biệt qua tham số `source: 'user_form_submit' | 'famous_preset'`. Chỉ bật hộp thoại chặn Trường hợp 2 khi `source === 'user_form_submit'`. Khi `source === 'famous_preset'`, nếu danh nhân đã có trong Thư Viện (`exact_match`) thì nạp lại êm `existingEntry.form`, nếu không thì nạp thẳng `presetForm`.
  - **Phương án B**: Bật cả hộp thoại Trường hợp 2 cho nút Danh nhân.
- **Khuyến nghị cuối cùng của Panel**: **CHỌN PHƯƠNG ÁN A** (Đồng thuận 5/5).

---

### `QĐ-M5`: Trong Trường hợp 1 (`exact_match`), nếu lá số đang hiển thị sẵn trên Thiên Bàn chính là lá số vừa bấm lập (`activeChartIdentityKey === incomingChartIdentityKey`), xử lý thế nào?
- **Các phương án**:
  - **Phương án A (đã tinh chỉnh theo `DM-12`)**: Luôn hiển thị thông báo xác nhận rõ ràng (với câu chữ phân biệt *"đang hiển thị sẵn trên Thiên Bàn"* khi `isAlreadyActiveOnBoard === true`) ở cả Banner dưới Quick Summary Bar (tự ẩn sau 15 giây có tạm dừng khi hover — `DM-07`) và hộp xác nhận nội tuyến trong `BirthForm`, đồng thời đóng `showFormDrawer` (nếu đang mở).
  - **Phương án B**: Im lặng không hiện thông báo nếu trùng lá số đang mở.
- **Khuyến nghị cuối cùng của Panel**: **CHỌN PHƯƠNG ÁN A** (Đồng thuận 5/5 — luôn phản hồi tường minh cho thao tác bấm nút của người dùng).

---

### `QĐ-M6`: Số hiệu phiên bản đích sau khi triển khai tính năng này
- **Các phương án**:
  - **Phương án A (`DM-10`)**: Nâng `/VERSION` từ `1.2.0-rc.2` lên **`1.3.0-rc.1`** và nâng `package.json` `"version"` lên **`"1.3.0"`** (nhất quán tiền lệ khi ra mắt Thư Viện Lá Số `1.2.0-rc.1`).
  - **Phương án B**: Đặt `/VERSION` là `1.2.0-rc.3`, giữ `package.json` `"version": "1.2.0"`.
- **Khuyến nghị cuối cùng của Panel**: **CHỌN PHƯƠNG ÁN A (`/VERSION = 1.3.0-rc.1`, `package.json = "1.3.0"`)** (Đồng thuận 5/5).

---

## 6. Đặc Tả Kiểm Thử Dự Kiến (`TEST-L18` .. `TEST-L22` Trong `scripts/verify-chart-library.ts`) (`[ĐÃ CẬP NHẬT THEO DM-01, DM-04, DM-06, DM-08, DM-09]`)

Khi triển khai code ở lượt sau, giữ nguyên toàn bộ **17 bài kiểm thử hiện có (`TEST-L01..TEST-L17`)** và bổ sung **5 bài kiểm thử mới (`TEST-L18..TEST-L22`, nâng tổng số lên `22/22` bài trong `npm run verify:library`)**:

| Mã Test | Mục tiêu kiểm thử | Dữ kiện đầu vào (Fixtures) | Khẳng định bắt buộc (Assertions) |
|---|---|---|---|
| **`TEST-L18`** | **Phát hiện Trường hợp 1 (`exact_match`) — có hồ sơ ($X/8$), chưa có hồ sơ ($0/8$), và nhất quán `savedChart` (`DM-02`, `DM-11`)** | - Lưu `formA` (`"Nguyễn Văn An"`, `16/08/1995`, `10:30`, Hà Nội, Nam), ghim `pinned: true`, đặt `customAlias: "Anh An"`.<br>- Kịch bản 1A: Chưa sinh chương nào ($0/8$), gọi `detectChartDuplicateInLibrary(formA_lowerCaseName)` (`"nguyễn văn an"` — cùng `nameSlug`).<br>- Kịch bản 1B: Lưu 3 chương (`chapter_overview`, `year_2026`, `year_2027`) cho `chartA`, gọi lại `detectChartDuplicateInLibrary`.<br>- Kịch bản 1C: Xóa 1 chương bằng `removeSingleDossierChapterFromLibrary`, gọi lại `detectChartDuplicateInLibrary`. | - 1A: `res.kind === 'exact_match'`, `res.existingEntry.chartIdentityKey === keyA`, `res.completedCount === 0`, `res.existingEntry.form.name === 'Nguyễn Văn An'` (bảo toàn hoa/thường gốc theo `DM-02`).<br>- 1B: `res.kind === 'exact_match'`, `res.completedCount === 3`.<br>- 1C: `res.completedCount === 2` (phản ánh chính xác sau khi xóa chương theo `DM-11`, không bị kẹt ở 3).<br>- Khi nạp lại qua `upsertChartToLibrary(res.existingEntry.form)`, `store.entries.length === 1`, giữ nguyên `pinned: true`, `customAlias: "Anh An"`. |
| **`TEST-L19`** | **Phát hiện Trường hợp 2 (`near_match`) ở cả Nhánh 1 & Nhánh 2, kiểm tra `diffBirthFormsForDuplicateModal` (`customAlias`, `affectsChartStructure`) và phân nhánh nguồn gọi (`DM-04`, `DM-05`, `DM-13`)** | - Đã lưu `formSaved` (`"Nguyễn Văn An"`, `customAlias: "Anh An Đối Tác"`, `16/08/1995`, `10:15`, Hà Nội `105.85°Đ`, Nam).<br>- Ca 19A (Nhánh 1 — cùng tiền tố 5 thành phần): Nhập `formIncoming1` (`"Trần Văn An"`, `16/08/1995`, `10:45`, Đà Nẵng `108.22°Đ`, Nam).<br>- Ca 19B (Nhánh 2 — cùng tên/biệt danh + ngày sinh nhưng đổi từ `unknownTime: true` hoặc giờ khác sang `14:30` Giờ Mùi): Nhập `formIncoming2` (`"Anh An Đối Tác"`, `16/08/1995`, `14:30`, Hà Nội, Nam).<br>- Ca 19C (Chống báo nhiễu Nhánh 2 — `DM-05`): Nhập tên 1 ký tự hoặc khác ngày sinh. | - Ca 19A: `res.kind === 'near_match'`, `matchReason === 'same_five_part_key'`, `hasStructuralChartDiff === false`; `diffs` chứa đủ `'name'` (kèm `"Biệt danh: Anh An Đối Tác"`), `'clockTime'`, `'location'`, `'longitude'`.<br>- Ca 19B: `res.kind === 'near_match'`, `matchReason === 'same_name_and_solar_date'`, `hasStructuralChartDiff === true`; các dòng diff có `affectsChartStructure === true` (`shichenBranch`, `mingGongBranch`) nằm ở **đầu mảng `diffs`**.<br>- Ca 19C: Trả về `kind === 'none'`. |
| **`TEST-L20`** | **Sắp xếp nhiều ứng viên gần khớp theo Công thức Phân Tầng Không Chồng Lấn (`DM-06` & `ĐP-9`)** | - Lưu 4 lá số trong Thư Viện đối chiếu với `formIncoming` (`"Nguyễn Văn An"`, `16/08/1995`, `10:45`, Hà Nội, Nam — tiền tố `1995_8_16_5_male`):<br>  1. `entry1` (Cùng 5 phần + **Trùng tên `"Nguyễn Văn An"`** + `pinned: false` + **`0/8` chương** $\rightarrow$ `score = 1300`).<br>  2. `entry2` (Cùng 5 phần + **Khác tên `"Trần Quốc Bảo"`** + `pinned: true` + **`8/8` chương** $\rightarrow$ `score = 1090`).<br>  3. `entry3` (Cùng 5 phần + **Khác tên `"Lê Văn Hưu"`** + `pinned: false` + **`4/8` chương** $\rightarrow$ `score = 1020`).<br>  4. `entry4` (Nhánh 2 khác canh giờ `14:30` + **Trùng tên `"Nguyễn Văn An"`** + `pinned: true` + **`6/8` chương** $\rightarrow$ `score = 380`). | - `res.kind === 'near_match'`, `res.candidates.length === 4`.<br>- Thứ tự trả về bắt buộc: **`[entry1, entry2, entry3, entry4]`**.<br>- Chứng minh toán học: `entry1` (trùng tên dù `0/8` chương, `1300` điểm) luôn xếp trên `entry2` (khác tên dù `8/8` chương + đã ghim, `1090` điểm). |
| **`TEST-L21`** | **RANH GIỚI AN TOÀN TUYỆT ĐỐI (`Zero Cross-Chart Contamination`) & Chốt chặn `Stale Entry Guard` (`DM-08`)** | - `entrySaved` (`keySaved`) đã có Chương 5 (`year_2026`) và Chương 6 (`year_2027`) hoàn chỉnh.<br>- Nhập `formIncoming` (`keyIncoming !== keySaved`) bị phát hiện `near_match` với `entrySaved`.<br>- **Nhánh A (Chọn *"Mở lá số đã lưu"*)**: Mở `entrySaved`.<br>- **Nhánh B (Chọn *"Lập lá số mới theo thông tin vừa nhập"*)**: Gọi `upsertChartToLibrary(formIncoming)`.<br>- **Nhánh C (`Stale Entry Guard` — `DM-08`)**: Trong lúc đang giữ kết quả `near_match`, xóa `keySaved` khỏi store rồi kiểm tra lại trước khi mở. | - **Sau Nhánh A**: `store.entries` không tạo thêm `keyIncoming`; `getDossierReadState(keyIncoming, chartIncoming).record === null`; `keySaved` giữ nguyên 2 chương.<br>- **Sau Nhánh B**: `store.entries` có cả `keySaved` (`2/8` chương) và `keyIncoming` (**`0/8` chương**); `getDossierReadState(keyIncoming, chartIncoming).record === null`; `buildPeriodCachePatchesFromLibrary(chartIncoming)` trả về `{}`.<br>- **Sau Nhánh C**: Phát hiện `freshEntry === undefined`, không tạo mục rác và không trộn khóa. |
| **`TEST-L22`** | **Xử lý cạnh: Mục đã xóa vĩnh viễn (`deletedTombstones`), Mục xóa chỉ hồ sơ (`dossier_only`), và Tính thuần khiết khi `IndexedDB` đang `hydrating` (`ĐC-1`, `DM-01`, `ĐP-9`)** | - Ca 1: Lưu `formX` rồi gọi `removeLibraryEntry(keyX, { deleteMode: 'entry_and_dossier' })` $\rightarrow$ gọi `detectChartDuplicateInLibrary(formX)`.<br>- Ca 2: Đưa `formLegacy` vào `ziwei_history` + lưu 2 chương trong `IndexedDB`, bật cổng chặn `idb.enableSlowHydrationGate()`, gọi `initChartLibrary()` (đang ở trạng thái `'hydrating'`), đọc `updatedAtBefore = readLibraryIndexStore().updatedAt`, rồi gọi `detectChartDuplicateInLibrary(formLegacy)` **2 lần liên tiếp**. | - Ca 1: Trả về `kind === 'none'` (không báo trùng với mục đã xóa vĩnh viễn).<br>- Ca 2: Cả 2 lần gọi `detectChartDuplicateInLibrary` lúc `'hydrating'` đều trả về `kind === 'exact_match'` với `hydrationStatus === 'hydrating'`; `readLibraryIndexStore().updatedAt === updatedAtBefore` (chứng minh hàm phát hiện thuần khiết 100%, không ghi storage); sau khi `releaseHydrationGate()`, `getLibraryHydrationStatus() === 'ready'` và 2 chương trong `IndexedDB` nguyên vẹn 100%. |

---

## 7. Ước Lượng Phạm Vi File Sẽ Sửa Khi Triển Khai & Các Rủi Ro Chính

### 7.1. Danh sách các file dự kiến sửa đổi khi thi công (sau khi chủ dự án duyệt kế hoạch)
1. **`src/lib/chart-library.ts`** *(~190–230 dòng thêm/sửa)*:
   - Gọi đồng bộ `migrateLegacyHistoryAndDossiers(currentForm)` ngay ở đầu `initChartLibrary` (`dòng 1483`, trước khối `async` — `DM-01`).
   - Bổ sung các kiểu dữ liệu `DuplicateDiffFieldKey`, `BirthFormFieldDiff`, `NearMatchLibraryCandidate`, `ChartDuplicateDetectionResult`.
   - Bổ sung các hàm thuần `resolveEffectiveDossierSummaryForEntry`, `diffBirthFormsForDuplicateModal`, `computeNearMatchSimilarityScore`, và `detectChartDuplicateInLibrary`.
2. **`src/components/DuplicateChartPromptModal.tsx`** *(file component mới ~250–290 dòng)*:
   - Hiển thị hộp thoại đối chiếu cho **Trường hợp 2 (`near_match`)**: hỗ trợ 1 hoặc nhiều ứng viên, khung cảnh báo Hổ phách khi `hasStructuralChartDiff === true` (`DM-05`), bảng diff `Đã lưu ↔ Vừa nhập`, hiển thị `customAlias`/trích đoạn `notes`/nhãn `[Lá số gốc vừa nạp để chỉnh sửa]` (`DM-13`), đồng bộ trực tiếp với `libraryEntries` và `hydrationStatus` (`ĐC-1`, `DM-08`).
3. **`src/components/BirthForm.tsx`** *(~20–30 dòng thêm/sửa)*:
   - Thêm kiểu `ChartGenerationSource = 'user_form_submit' | 'famous_preset'` và truyền vào `onChartGenerated` tại `handleSubmit` (`'user_form_submit'`) và `handleFamousLoad` (`'famous_preset'`) (`DM-04`).
   - Nhận thêm prop tùy chọn `duplicateNotice?: { title: string; message: string; completedCount: number; onOpenDossier: () => void; onDismiss: () => void } | null` để hiển thị phản hồi nội tuyến ngay trên nút submit (`DM-12`).
4. **`src/App.tsx`** *(~90–120 dòng thêm/sửa)*:
   - Thêm hàm điều phối `handleBirthFormChartGenerated(newChart, normalizedForm, source = 'user_form_submit')`:
     - Nếu `source === 'famous_preset'`: chỉ kiểm tra `exact_match` để nạp lại êm `existingEntry.form`, nếu không thì gọi `applyFormAndChart(newChart, normalizedForm, true)`.
     - Nếu `source === 'user_form_submit'`: chạy `detectChartDuplicateInLibrary(normalizedForm)` và xử lý 3 nhánh `exact_match` (tái tạo `savedChart` từ `existingEntry.form` theo `DM-02`, hiện Banner 15 giây có pause-on-hover theo `DM-07`), `near_match` (mở `DuplicateChartPromptModal` kèm chốt chặn `Stale Entry Guard` theo `DM-08`), và `none`.
5. **`scripts/verify-chart-library.ts`** *(~250–300 dòng thêm mới)*:
   - Bổ sung 5 bài kiểm thử `TEST-L18..TEST-L22` (`22/22` bài).
6. **Hệ thống Tài liệu Sống & Phiên bản**:
   - `/VERSION` (`1.3.0-rc.1`), `package.json` (`"1.3.0"`), `/CHANGELOG.md`, `docs/INDEX.md`, `docs/features-dossier-and-chat.md`, `docs/decisions-registry.md` (cập nhật sau khi thi công xong).

### 7.2. Ma trận Rủi ro chính & Biện pháp phòng ngừa

| STT | Rủi ro kỹ thuật / UX | Mức độ | Biện pháp phòng ngừa trong thiết kế V2 |
|:---:|---|---|---|
| 1 | **Nguy cơ vô tình truyền `incomingForm` hoặc `incomingChart` khi nạp lá số đã lưu**, dẫn đến lệch tên hoa/thường hoặc tạo khóa mới (`DM-02`) | **NGHIÊM TRỌNG** | Ở cả Trường hợp 1 (`exact_match`) và Trường hợp 2 (`[Mở lá số đã lưu]`), luôn tái tạo `savedChart = buildChartFromForm(targetEntry.form)` từ chính `targetEntry.form` và gọi `applyFormAndChart(savedChart, targetEntry.form, false)`. |
| 2 | **Nguy cơ người dùng bấm nhầm `"Mở lá số đã lưu"` ở Nhánh 2 khi hai lá số khác giờ an sao / khác cung Mệnh (`DM-05`)** | **CAO** | Siết chặt 4 điều kiện kích hoạt Nhánh 2; đẩy các dòng diff `affectsChartStructure === true` lên đầu bảng; hiện khung cảnh báo Hổ phách nổi bật và đổi nhãn nút thành `"Mở lá số cũ đã lưu ({Giờ} · Mệnh {Cung})"`. |
| 3 | **Nguy cơ mục đã lưu bị xóa trong lúc Hộp thoại Trường hợp 2 đang mở (`DM-08`)** | **CAO** | Áp dụng `Stale Entry Guard`: kiểm tra lại `readLibraryIndexStore().entries` theo `chartIdentityKey` ngay trước khi thực thi mở lá số; nếu không còn tồn tại thì đóng modal, giữ nguyên Form và thông báo rõ. |
| 4 | **Nguy cơ `BirthForm` không cập nhật lại các ô input theo `chosenEntry.form`** | **CAO** | Nhờ `handleSubmit` (`BirthForm.tsx:163`) đã gán `lastSyncedInitialKeyRef.current = serializeBirthFormState(normalizedForm)`, khi `App.tsx` đặt `setCurrentForm(chosenEntry.form)`, `useEffect` tại `BirthForm.tsx:83–90` thấy chuỗi tuần tự hóa khác nhau nên tự động đồng bộ lại toàn bộ ô input về đúng `chosenEntry.form`. |
| 5 | **Hiển thị sai số chương `0/8` khi `IndexedDB` đang mở chậm (`ĐC-1`, `DM-11`)** | **CAO** | Dùng `resolveEffectiveDossierSummaryForEntry` kết hợp kiểm tra `hydrationStatus === 'hydrating'`; hiển thị *"Đang đồng bộ từ IndexedDB..."* và chỉ bắt đầu đếm ngược 15 giây sau khi hydration hoàn tất. |

---

## 8. Bảng Giải Đáp & Quy Tắc Đã Chốt Cho 5 Câu Hỏi Mở Của Bản V1 (`DM-13`)

Toàn bộ 5 câu hỏi mở ở Mục 8 của Bản V1 đã được Tổ Chuyên Gia 5 vai thảo luận và chốt thành quy tắc kỹ thuật chính thức trong Bản POST-PANEL V2:

| Câu hỏi mở trong V1 | Vấn đề cốt lõi | Quyết định kỹ thuật đã chốt trong Bản POST-PANEL V2 |
|:---:|---|---|
| **Câu hỏi 1** | Xử lý khi người dùng đặt `customAlias` (Tên gợi nhớ) trong Thư Viện rồi nhập lại vào `BirthForm` | - So khớp `foldVietnameseSearchText(incomingForm.name)` với **CẢ `foldVietnameseSearchText(entry.form.name)` LẪN `foldVietnameseSearchText(entry.customAlias)`** ở Tầng 2 của `similarityScore` và ở Nhánh 2 (`same_name_and_solar_date`).<br>- Trong `diffBirthFormsForDuplicateModal`, hiển thị rõ `customAlias` bên cạnh tên gốc: `"Nguyễn Văn An (Biệt danh: Anh An - Đối tác)"`. |
| **Câu hỏi 2** | Gộp hay tách dòng diff `Nơi sinh` và `Kinh độ`? | - **Giữ tách riêng 2 trường `location` (`Nơi sinh (Tỉnh/Thành)`) và `longitude` (`Kinh độ hiệu chỉnh`)** trong mảng `BirthFormFieldDiff[]` để phản ánh trung thực cả trường trên Form lẫn thành phần `lonSig` trong khóa 9 thành phần; đặt 2 dòng liền kề nhau trên bảng UI. |
| **Câu hỏi 3** | Luồng bấm *"Nạp dữ kiện lên Form để sửa & lập lá số mới"* từ `ChartLibraryModal` (`App.tsx:711–716`) | - Lưu state `editingSourceEntryKey = entry.chartIdentityKey` khi nạp lên Form.<br>- Khi người dùng sửa dữ kiện rồi bấm *"An Sao Lập Lá Số"*, vẫn hiện `DuplicateChartPromptModal` (Trường hợp 2) để đối chiếu điểm vừa sửa, kèm huy hiệu màu xanh ngọc **`[Lá số gốc vừa nạp để chỉnh sửa]`** trên thẻ của `entry` đó. |
| **Câu hỏi 4** | Vị trí hiển thị và thời gian tự ẩn của Banner thông báo Trường hợp 1 (`exact_match`) | - Áp dụng **Dual Feedback (`DM-12`)**: Hiện đồng thời trên Banner ngay dưới Quick Summary Bar (tự ẩn sau **`15 giây`**, có tạm dừng khi `hover`/`focus`/`touch` — `DM-07`) VÀ một hộp xác nhận nội tuyến ngay trên nút submit của `BirthForm`, kèm tự cuộn mượt lên đầu Thiên Bàn trên màn hình nhỏ. |
| **Câu hỏi 5** | Cách hiển thị danh tính khi cả 2 lá số đều để trống tên (`nameSlug === 'anon'`) | - Khi cả `entry.form.name` và `entry.customAlias` đều trống, tiêu đề thẻ ứng viên tự động hiển thị: **`Đương số chưa đặt tên · {Tỉnh/Thành} · Sinh {Giờ:Phút} ({Canh giờ})`**.<br>- Nếu `entry.notes` khác rỗng, hiển thị thêm dòng trích dẫn **`📝 Ghi chú: "{80 ký tự đầu}"`** ngay dưới tiêu đề thẻ ứng viên. |
