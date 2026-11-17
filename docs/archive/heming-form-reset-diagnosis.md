> ⚠️ **[TÀI LIỆU LỊCH SỬ ĐÃ LƯU TRỮ — KHÔNG DÙNG LÀM CĂN CỨ CODE HIỆN HÀNH]**
> - **Trạng thái**: Đã hoàn thành vai trò lịch sử / Đã bị thay thế bởi tài liệu sống **[`docs/features-dossier-and-chat.md`](../features-dossier-and-chat.md)** từ ngày `17/11/2026`.
> - **Cảnh báo cho Kỹ sư & AI Agent**: Các trích dẫn số dòng, tên biến, hằng số (như ngân sách 25s, nhịp nghỉ 2200ms, số lượng key 3/23) trong file này phản ánh thời điểm trước khi hợp nhất và **không còn khớp với mã nguồn hiện hành**. Tuyệt đối đọc tài liệu sống tại thư mục `docs/` gốc và đối chiếu code thật trước khi chẩn đoán hoặc sửa code!

---
# CHẨN ĐOÁN BẰNG CODE — LỖI TỰ ĐẶT LẠI DỮ KIỆN KHAI SINH Ở MÀN "HỢP BÀN ĐÔI LỨA"

- **Ngày thực hiện:** 17/11/2026
- **Vai trò:** Gemini 4 Argon (Chẩn đoán bằng code thực tế, tuyệt đối không sửa code triển khai trong lượt này)
- **Phạm vi kiểm tra:**
  - `src/components/BirthForm.tsx` (dòng `1–485`)
  - `src/components/HemingView.tsx` (dòng `1–337`)
  - `src/App.tsx` (dòng `1–540`)

---

## 1. NGUYÊN NHÂN GỐC RỄ (KÈM FILE & DÒNG CODE CỤ THỂ)

Hiện tượng thông tin khai sinh của Bên A và Bên B lập tức quay về dữ kiện mặc định (**Nguyễn Minh Quân — 12/05/1993 — Hà Nội** và **Trần Ngọc Lan — 24/10/1996 — TP. Hồ Chí Minh**) ngay khi bấm **"Xác Nhận Lá Số A"** hoặc **"Xác Nhận Lá Số B"** xuất phát từ **tổ hợp 3 cơ chế trực tiếp trong code**:

### (1.1) `HemingView.tsx` truyền inline object literal mới cho `initialState` ở mỗi lần render và bỏ qua tham số `_f: BirthFormState` khi xác nhận

Tại `src/components/HemingView.tsx`, dòng `60–64` và `186–235`:

```tsx
// src/components/HemingView.tsx:60-63
const [chartA, setChartA] = useState<ZiweiChart | null>(null);
const [chartB, setChartB] = useState<ZiweiChart | null>(null);
const [result, setResult] = useState('');
const [loading, setLoading] = useState(false);
```

Và tại JSX của 2 cột Bên A (`dòng 186–206`) & Bên B (`dòng 215–235`):

```tsx
// src/components/HemingView.tsx:186-206 (Bên A)
<BirthForm
  compact
  submitLabel="Xác Nhận Lá Số A"
  initialState={{
    name: 'Nguyễn Minh Quân',
    year: '1993',
    month: '5',
    day: '12',
    clockHour: '9',
    clockMinute: '30',
    unknownTime: false,
    gender: 'male',
    province: 'Việt Nam — Miền Bắc',
    city: 'Hà Nội',
    longitude: 105.85,
  }}
  onChartGenerated={(c: ZiweiChart, _f: BirthFormState) => {
    setChartA(c);
    setResult('');
  }}
/>

// src/components/HemingView.tsx:215-235 (Bên B)
<BirthForm
  compact
  submitLabel="Xác Nhận Lá Số B"
  initialState={{
    name: 'Trần Ngọc Lan',
    year: '1996',
    month: '10',
    day: '24',
    clockHour: '14',
    clockMinute: '15',
    unknownTime: false,
    gender: 'female',
    province: 'Việt Nam — Miền Nam & ĐBSCL',
    city: 'TP. Hồ Chí Minh (Sài Gòn)',
    longitude: 106.7,
  }}
  onChartGenerated={(c: ZiweiChart, _f: BirthFormState) => {
    setChartB(c);
    setResult('');
  }}
/>
```

- **Lỗi thiết kế state tại `HemingView.tsx`:**
  1. `HemingView` chỉ lưu `chartA` và `chartB`, **không lưu `formA` và `formB`** (`BirthFormState`). Trong `onChartGenerated`, tham số thứ hai `_f: BirthFormState` (chứa dữ kiện người dùng vừa nhập và xác nhận) bị **bỏ qua hoàn toàn** (`_f`).
  2. Prop `initialState` của cả hai `<BirthForm>` được viết dưới dạng **object literal nội tuyến (`inline object literal`)** chứa cứng thông tin mặc định (`Nguyễn Minh Quân` và `Trần Ngọc Lan`). Do đó, **mỗi lần `HemingView` render lại**, JavaScript cấp phát **2 vùng nhớ (reference) object mới tinh** cho `initialState` của Bên A và Bên B.

### (1.2) `BirthForm.tsx` có `useEffect([initialState])` tự động ghi đè `form` mỗi khi `initialState` đổi tham chiếu

Tại `src/components/BirthForm.tsx`, dòng `57–66`:

```tsx
// src/components/BirthForm.tsx:57-66
const [form, setForm] = useState<BirthFormState>(initialState ?? DEFAULT_BIRTH_FORM);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [showHistory, setShowHistory] = useState(false);

useEffect(() => {
  if (initialState) {
    setForm(initialState);
  }
}, [initialState]);
```

- Khi người dùng đang gõ họ tên, chọn ngày/tháng/năm/giờ/nơi sinh trong `<BirthForm>`, chỉ có state cục bộ `form` của `<BirthForm>` thay đổi (`HemingView` chưa render lại nên `initialState` chưa đổi reference).
- Nhưng **ngay khoảnh khắc người dùng bấm nút submit** (`"Xác Nhận Lá Số A"` hoặc `"Xác Nhận Lá Số B"`):
  1. `handleSubmit` (`BirthForm.tsx:128-149`) gọi `onChartGenerated(chart, normalizedForm)` tại dòng `139`.
  2. `onChartGenerated` trong `HemingView.tsx` (`dòng 202–205` hoặc `231–234`) gọi `setChartA(c); setResult('');` (hoặc `setChartB(c); setResult('');`).
  3. `HemingView` render lại để hiển thị thẻ tóm tắt `renderMiniSummary`.
  4. Trong lần render lại này, cả hai biểu thức `initialState={{ name: 'Nguyễn Minh Quân', ... }}` và `initialState={{ name: 'Trần Ngọc Lan', ... }}` tạo ra **2 object reference mới** (`prevInitialState !== nextInitialState`).
  5. React kích hoạt `useEffect([initialState])` (`BirthForm.tsx:62-66`) ở **CẢ HAI** `<BirthForm>` (Bên A và Bên B), gọi `setForm(initialState)` và **ghi đè toàn bộ các ô input của cả Bên A lẫn Bên B quay về `Nguyễn Minh Quân` và `Trần Ngọc Lan`**!

### (1.3) Kiểm tra và phân loại các cơ chế liên quan khác (Xác nhận / Loại trừ)

| Cơ chế kiểm tra | Kết quả kiểm chứng bằng code | Giải thích chi tiết |
| :--- | :--- | :--- |
| **1. `useEffect([initialState])` + inline object literal mặc định** (`BirthForm.tsx:62-66` & `HemingView.tsx:189-201, 218-230`) | **XÁC NHẬN — Nguyên nhân trực tiếp số 1** | Mỗi lần `HemingView` re-render đều tạo reference mới cho object mặc định, ép `setForm(initialState)` ghi đè dữ liệu vừa nhập ở cả 2 form. |
| **2. Không nâng/lưu `formA`, `formB` lên `HemingView`** (`HemingView.tsx:60-63, 202, 231`) | **XÁC NHẬN — Nguyên nhân trực tiếp số 2** | `onChartGenerated` bỏ qua `_f: BirthFormState`, khiến `HemingView` không giữ trạng thái form đã xác nhận của từng bên. |
| **3. Re-render từ `App.tsx` hoặc trong lúc stream `/api/heming`** (`App.tsx:79, 427`, `HemingView.tsx:73, 104, 120`) | **XÁC NHẬN — Cơ chế kích hoạt phụ** | Bất kỳ khi nào `App.tsx` re-render (mở/đóng `KeyPoolModal`, `ContextualChatDrawer`, đổi giao diện Sáng/Tối, cập nhật `poolSummary`) hoặc `HemingView` gọi `setLoading` / `setResult(acc)` theo từng chunk SSE, `HemingView` đều render lại và tạo reference mới cho 2 inline `initialState`, làm reset cả 2 form nếu người dùng đang sửa dở. |
| **4. Remount do đổi `key` trên `<BirthForm>` trong `HemingView`** | **LOẠI TRỪ** | Hai thẻ `<BirthForm>` tại `HemingView.tsx:186` và `215` nằm ở vị trí cây DOM cố định, không truyền `key` động nên không bị unmount/remount khi bấm xác nhận. |
| **5. Unmount/Remount `<HemingView>` khi chuyển tab trên thanh điều hướng** (`App.tsx:426-428`) | **XÁC NHẬN (Khi đổi tab)** | Tại `App.tsx:426-428`: `{activeTab === 'heming' && <HemingView ... />}`. Nếu người dùng chuyển sang tab khác (`Lá Số Tử Vi`, `Tinh Diệu`, `Danh Nhân`) rồi quay lại `Hợp Bàn Đôi Lứa`, `<HemingView>` bị unmount và mount lại từ đầu, mất cả `chartA`, `chartB`, `formA`, `formB` và `result` nếu state chỉ nằm cục bộ trong `HemingView`. |

---

## 2. LUỒNG DỮ LIỆU CHI TIẾT KHI BẤM XÁC NHẬN TỪNG BÊN

### Kịch bản 1: Người dùng nhập Bên A & Bên B trước, rồi bấm "Xác Nhận Lá Số A" trước → "Xác Nhận Lá Số B" sau

1. **Bước 1 (Nhập liệu trên UI):**
   - Người dùng sửa các ô của Form A thành dữ kiện thực của Bên A (ví dụ: *Lê Hoàng Nam, 1991...*) → state cục bộ `form` trong `<BirthForm A>` cập nhật.
   - Người dùng sửa tiếp các ô của Form B thành dữ kiện thực của Bên B (ví dụ: *Phạm Thu Hà, 1994...*) → state cục bộ `form` trong `<BirthForm B>` cập nhật.
   - Lúc này `HemingView` chưa re-render lần nào nên cả 2 form vẫn hiển thị đúng những gì người dùng vừa gõ.
2. **Bước 2 (Bấm nút `"Xác Nhận Lá Số A"`):**
   - `BirthForm A` chạy `handleSubmit` (`BirthForm.tsx:128-149`), lập `chart` từ `form` (*Lê Hoàng Nam*) và gọi `onChartGenerated(chart, normalizedForm)`.
   - `HemingView` nhận callback (`HemingView.tsx:202-205`), gọi `setChartA(c)` (lưu lá số *Lê Hoàng Nam* vào `chartA`), bỏ qua `_f`, và gọi `setResult('')`.
   - `HemingView` **re-render**:
     - Khung tóm tắt nhỏ màu xanh dưới Form A (`renderMiniSummary(chartA, 'Lá Số A')`) xuất hiện với tên *Lê Hoàng Nam*.
     - **NHƯNG** trong cùng lượt render đó, `HemingView` truyền 2 object literal mới vào `initialState` của `<BirthForm A>` (`Nguyễn Minh Quân`) và `<BirthForm B>` (`Trần Ngọc Lan`).
     - `useEffect([initialState])` tại `BirthForm.tsx:62-66` chạy trên **cả `<BirthForm A>` lẫn `<BirthForm B>`**:
       - Toàn bộ các ô input của **Form A** lập tức quay về **Nguyễn Minh Quân (12/05/1993, Hà Nội)**!
       - Toàn bộ các ô input của **Form B** (vốn đã nhập *Phạm Thu Hà, 1994* nhưng chưa bấm xác nhận!) cũng bị xóa sạch và quay về **Trần Ngọc Lan (24/10/1996, TP.HCM)**!
3. **Bước 3 (Bấm tiếp nút `"Xác Nhận Lá Số B"`):**
   - Vì ở cuối Bước 2, `form` bên trong `<BirthForm B>` đã bị ghi đè về **Trần Ngọc Lan (24/10/1996, TP.HCM)**, nên khi bấm `"Xác Nhận Lá Số B"`, `handleSubmit` của `<BirthForm B>` lấy chính state `form` đã bị reset đó để gọi `generateChart`!
   - Kết quả: Cả Form B lẫn `chartB` (và thẻ xanh `Đã nạp Lá Số B`) đều nạp thành **Trần Ngọc Lan (24/10/1996, TP.HCM)** thay vì dữ kiện người dùng đã nhập!
   - Và nếu người dùng bấm lại `"Xác Nhận Lá Số A"` một lần nữa, `chartA` cũng bị ghi đè thành **Nguyễn Minh Quân**!

### Kịch bản 2: Người dùng bấm "Xác Nhận Lá Số B" trước → "Xác Nhận Lá Số A" sau

1. **Bước 1:** Người dùng nhập dữ kiện cho Bên B (và/hoặc cả Bên A).
2. **Bước 2 (Bấm `"Xác Nhận Lá Số B"` trước):**
   - `setChartB(c)` chạy → `HemingView` re-render → truyền 2 object `initialState` mới vào cả `<BirthForm A>` và `<BirthForm B>`.
   - `useEffect([initialState])` (`BirthForm.tsx:62-66`) lập tức reset các ô input của `<BirthForm B>` về **Trần Ngọc Lan** và reset luôn các ô input của `<BirthForm A>` về **Nguyễn Minh Quân**!
3. **Bước 3 (Bấm `"Xác Nhận Lá Số A"` sau):**
   - Do các ô của `<BirthForm A>` vừa bị reset về **Nguyễn Minh Quân** ở Bước 2, cú bấm `"Xác Nhận Lá Số A"` sẽ lập lá số từ dữ kiện mặc định **Nguyễn Minh Quân (12/05/1993, Hà Nội)** và lưu vào `chartA`!

---

## 3. MỨC ĐỘ CHẮC CHẮN & BẰNG CHỨNG CODE

- **Mức độ chắc chắn:** **Chắc chắn 100%** (Đã xác minh trực tiếp trên mã nguồn thực tế, không có bất kỳ giả định mơ hồ nào).
- **Bằng chứng đối chiếu trực tiếp:**
  1. `src/components/BirthForm.tsx:62-66`: `useEffect(() => { if (initialState) { setForm(initialState); } }, [initialState]);` — phụ thuộc theo tham chiếu (`reference equality`) của object `initialState`.
  2. `src/components/HemingView.tsx:189-201` và `218-230`: `initialState={{ name: 'Nguyễn Minh Quân', ... }}` và `initialState={{ name: 'Trần Ngọc Lan', ... }}` — khởi tạo object literal mới ở mỗi lần `HemingView` render.
  3. `src/components/HemingView.tsx:202-205` và `231-234`: `onChartGenerated={(c: ZiweiChart, _f: BirthFormState) => { setChartA(c); setResult(''); }}` — không lưu `_f` vào state cha.
  4. So sánh đối chứng với tab chính `Lá Số Tử Vi` trong `src/App.tsx` (`dòng 50, 88-90, 341, 395`): ở `App.tsx`, `initialState={currentForm}` là một biến state ổn định (`useState<BirthFormState>(DEFAULT_BIRTH_FORM)`) và khi `onChartGenerated` chạy, `applyFormAndChart` gọi `setCurrentForm(form)` (`dòng 90`) nên tab chính không bị quay về mặc định. Ngược lại, `HemingView.tsx` vừa không có state `formA`/`formB`, vừa truyền object literal mặc định mới mỗi lần render.

---

## 4. HƯỚNG SỬA ĐỀ XUẤT CHO LƯỢT THI CÔNG TIẾP THEO

Giải pháp phải giải quyết triệt để và **phân biệt rõ 2 nhu cầu**:
- **Nhu cầu (i):** Form **TUYỆT ĐỐI KHÔNG** tự đặt lại về mặc định (hay mất dữ liệu đang gõ ở bên còn lại) khi bấm xác nhận Bên A / Bên B, khi đang stream luận giải Hợp Bàn, hoặc khi component cha re-render.
- **Nhu cầu (ii):** Khi người dùng **chủ động nạp một lá số khác từ bên ngoài** (ví dụ: chọn một mục trong **Lịch sử tra cứu**, bấm **Mẫu lá số kinh điển / Danh nhân**, khôi phục từ **URL chia sẻ**, hoặc ở màn Hợp Bàn bấm nạp nhanh từ lá số đang xem / lịch sử), `<BirthForm>` **VẪN PHẢI cập nhật ngay lập tức** để hiển thị đúng dữ kiện mới đó.

### Đề xuất kỹ thuật cụ thể (3 điểm phối hợp, gọn và an toàn 100%):

1. **Tại `src/components/HemingView.tsx` — Tách hằng số mặc định ra ngoài component & quản lý state `formA`, `formB` rõ ràng:**
   - Khai báo 2 hằng số tĩnh cấp module (`DEFAULT_HEMING_FORM_A` và `DEFAULT_HEMING_FORM_B`) ở ngoài hàm `HemingView` (tuyệt đối không viết inline object literal trong JSX).
   - Lưu state `formA` và `formB` (hoặc nâng/lưu qua `App.tsx` để giữ nguyên khi chuyển tab qua lại giữa `Lá Số Tử Vi` và `Hợp Bàn Đôi Lứa`):
     ```ts
     const [formA, setFormA] = useState<BirthFormState>(DEFAULT_HEMING_FORM_A);
     const [formB, setFormB] = useState<BirthFormState>(DEFAULT_HEMING_FORM_B);
     ```
   - Trong `onChartGenerated` của Bên A và Bên B, **cập nhật cả `formA`/`formB` lẫn `chartA`/`chartB`**:
     ```ts
     onChartGenerated={(c: ZiweiChart, f: BirthFormState) => {
       setFormA(f);
       setChartA(c);
       setResult('');
     }}
     ```
     (và tương tự `setFormB(f); setChartB(c);` cho Bên B).
   - **Quan trọng để bảo vệ form bên kia khi chưa bấm xác nhận:** Khi người dùng đã gõ sửa Bên B (chưa bấm xác nhận B) mà bấm `"Xác Nhận Lá Số A"`, `formB` ở `HemingView` vẫn giữ tham chiếu cũ `DEFAULT_HEMING_FORM_B` (nên không đổi reference), kết hợp với cơ chế so sánh giá trị/phiên bản nạp ở mục (2) dưới đây sẽ bảo đảm các ô đang gõ dở ở Bên B **không bao giờ bị ghi đè**!

2. **Tại `src/components/BirthForm.tsx` — Thay `useEffect([initialState])` so sánh tham chiếu thô bằng kiểm tra chữ ký nội dung (`serializeBirthFormKey`) hoặc `externalSyncVersion`:**
   - Tạo hàm thuần `serializeBirthFormState(s: BirthFormState): string` (nối toàn bộ các trường `name|year|month|day|clockHour|clockMinute|unknownTime|gender|province|city|longitude`).
   - Lưu `lastSyncedInitialKeyRef = useRef<string>(serializeBirthFormState(initialState ?? DEFAULT_BIRTH_FORM))` trong `BirthForm`:
     ```ts
     useEffect(() => {
       if (!initialState) return;
       const nextKey = serializeBirthFormState(initialState);
       if (nextKey !== lastSyncedInitialKeyRef.current) {
         lastSyncedInitialKeyRef.current = nextKey;
         setForm(initialState);
       }
     }, [initialState]);
     ```
   - Đồng thời, trong `handleSubmit` (`BirthForm.tsx:128-149`) và `handleFamousLoad` (`BirthForm.tsx:151-177`), cập nhật `lastSyncedInitialKeyRef.current = serializeBirthFormState(normalizedForm)` và `setForm(normalizedForm)` trước khi gọi `onChartGenerated(chart, normalizedForm)`.
   - **Tác dụng kép của cơ chế này:**
     - **Đáp ứng hoàn hảo Nhu cầu (i):**
       - Nếu cha re-render và vô tình tạo object `initialState` mới nhưng có cùng nội dung với lần đồng bộ trước (`nextKey === lastSyncedInitialKeyRef.current`), `BirthForm` **bỏ qua hoàn toàn**, giữ nguyên mọi ký tự người dùng đang gõ dở trong `form`!
       - Khi chính form đó bấm `"Xác Nhận"`, `lastSyncedInitialKeyRef.current` đã khớp với `normalizedForm` vừa submit nên khi cha cập nhật `setFormA(normalizedForm)` sẽ không gây render thừa.
     - **Đáp ứng hoàn hảo Nhu cầu (ii):**
       - Khi người dùng chủ động chọn một **Lá số trong Lịch sử** (`onSelectHistory`), bấm **Nạp Lá Số Danh Nhân** (`handleFamousSelect`), hoặc nạp từ **URL chia sẻ**, `initialState` được cha truyền xuống mang dữ kiện của lá số mới (`nextKey !== lastSyncedInitialKeyRef.current`) → `BirthForm` nhận diện nội dung `initialState` thực sự thay đổi sang lá số mới và cập nhật `setForm(initialState)` ngay lập tức!
       - Trường hợp đặc biệt: nếu người dùng đang sửa dở các ô trong `BirthForm`, sau đó lại bấm chọn lại **đúng** mục lịch sử/danh nhân trùng với `initialState` ban đầu, callback `onSelectHistory` trong `BirthForm.tsx:230-233` chỉ cần gọi trực tiếp `setForm(item.form)` trước `onSelectHistory?.(item.form)` để đảm bảo 100% mọi thao tác nạp chủ động đều hiển thị ngay dữ kiện vừa chọn.
