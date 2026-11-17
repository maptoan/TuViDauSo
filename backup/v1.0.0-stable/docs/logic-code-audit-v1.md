# BÁO CÁO RÀ SOÁT TOÀN DIỆN LOGIC NGHIỆP VỤ & CHẤT LƯỢNG CODE (V1)

- **Dự án**: Tử Vi Thiên Kỷ — Hệ thống Lập Lá Số, Luận Giải AI & Hồ Sơ Tử Vi 8 Chương
- **Phiên bản tài liệu**: `v1.0` (`docs/logic-code-audit-v1.md`)
- **Ngày thực hiện**: `17/11/2026`
- **Model thực hiện rà soát**: **Gemini 4 Argon** (vai trò Chẩn đoán & Kiến trúc hệ thống — Bước 1, chỉ đọc code thật và lập báo cáo V1, tuyệt đối không sửa code ứng dụng)
- **Tài liệu nền đã đối chiếu**:
  - `docs/dossier-fix-plan-v1.md`, `docs/dossier-fix-plan-v2.md`, `docs/dossier-fix-panel-review.md` (Các quyết định `QĐ-G1..QĐ-G6` đã thi công xong và kiểm chứng đạt: `tsc` 0 lỗi, `verify-key-pool` 17/17, `verify-dossier-context` 6/6, `verify-dossier-chat-ui` 14/14 gồm `TEST-1..TEST-10`, quét `dist/` 0 key nguyên văn)
  - `docs/feature-plan-3-tinh-nang-v2.md`, `docs/feature-plan-panel-review.md` (Các quyết định `F1–F7`)
  - `docs/key-pool-design-plan.md`, `docs/key-pool-expert-panel-review.md` (Các quyết định `QĐ-1..QĐ-6`)
  - `docs/stream-interruption-diagnosis.md` (Chẩn đoán ngắt luồng `503 UNAVAILABLE` & điểm mở `AbortError code=20`)

---

## 0. NGUYÊN TẮC RÀ SOÁT & TÔN TRỌNG QUYẾT ĐỊNH ĐÃ CHỐT

1. **Bằng chứng xác thực từ code hiện hành**: Mọi phát hiện dưới đây đều trích dẫn trực tiếp `file:dòng` từ mã nguồn thực tế tại thời điểm rà soát.
2. **Phân biệt rạch ròi trạng thái xác minh**:
   - **`[Đã kiểm chứng bằng code]`**: Lỗi/khiếm khuyết/rủi ro đã có bằng chứng trực tiếp trong cấu trúc lệnh, luồng dữ liệu hoặc điều kiện rẽ nhánh của code.
   - **`[Nghi vấn cần kiểm chứng thêm]`**: Các góc khuất biên (edge cases) hoặc hành vi phụ thuộc thư viện ngoài (`iztro`, `lunar-javascript`, `@google/genai`, `undici`) cần viết thêm kịch bản kiểm thử chuyên biệt hoặc log thực nghiệm để kết luận.
3. **Không phủ nhận kết quả engine đã kiểm chứng & Không tự ý lật quyết định của chủ dự án**:
   - Tầng dữ kiện của engine trên hồ sơ mẫu Nguyễn Văn An (`16/08/1995`, Giờ Tỵ `10:30`) đã khớp `14/14` chính tinh, `100%` Tứ Hóa các tầng và `~35` phụ tinh. Báo cáo này **không khẳng định kết quả đã kiểm chứng là sai**, chỉ nêu các biên chưa có test tự động bao phủ và cách kiểm chứng.
   - Mọi điểm chạm tới các quyết định đã được chủ dự án phê duyệt (`F1–F7`, `QĐ-G1..QĐ-G6`, `QĐ-1..QĐ-6`, cấu hình model `gemini-3.5-flash-lite` / `gemini-3.8-flash`, ngân sách failover `35s` / `5 keys`) đều được gắn nhãn **`[Đề xuất MỞ LẠI quyết định ...]`** kèm phân tích đánh đổi để chủ dự án xem xét, tuyệt đối không tự ý thay đổi ngầm.

---

## 1. CHI TIẾT CÁC PHÁT HIỆN THEO 6 MẢNG (A → F)

---

### MẢNG (A) — TÍNH ĐÚNG ĐẮN LOGIC NGHIỆP VỤ (`algorithm.ts`, `yunxian-context.ts`, `dossier-context.ts`, Cache & Ngữ cảnh)

#### `A-01` — Khóa định danh lá số (`buildChartIdentityKey` & `periodContext.cacheKey`) bỏ sót chính sách Tháng Nhuận (`leapMonthPolicy`) và Kinh độ/Giờ gốc, gây nguy cơ đụng độ (collision) bộ nhớ đệm khi đổi cấu hình cùng ngày sinh
- **Mảng**: `(A)` Logic nghiệp vụ — Khóa bộ nhớ đệm (`Cache Key`) giữa các lá số / phiên
- **Trạng thái xác minh**: **`[Đã kiểm chứng bằng code]`**
- **Bằng chứng `file:dòng`**:
  - `src/lib/dossier-chat-ui.ts:63–66`:
    ```ts
    export function buildChartIdentityKey(chart: ZiweiChart): string {
      const b = chart.birthInfo;
      return `${b.year}_${b.month}_${b.day}_${b.hour}_${b.gender}`;
    }
    ```
  - `src/lib/ziwei/yunxian-context.ts:298`:
    ```ts
    const chartKey = `${chart.birthInfo.year}_${chart.birthInfo.month}_${chart.birthInfo.day}_${chart.birthInfo.hour}_${chart.birthInfo.gender}`;
    ```
  - `src/lib/ziwei/algorithm.ts:480–507`: Khi ngày dương lịch rơi vào **tháng nhuận âm lịch** (`chart.birthInfo.isLeapMonth === true`), người dùng đổi `leapMonth` (`'split'` vs `'current'` vs `'next'`) sẽ làm thay đổi `adjustedMonth` (`algorithm.ts:484–500`), kéo theo thay đổi vị trí 12 cung và toàn bộ sao trên lá số. Tuy nhiên `b.year`, `b.month`, `b.day`, `b.hour`, `b.gender` (dương lịch + chi giờ) vẫn **giữ nguyên hoàn toàn**.
  - `src/App.tsx:88–106`: Khi `applyFormAndChart` chạy để lập lá số mới, `aiPeriodCache` (`src/App.tsx:66`) **không được xóa/reset**, và `DetailedDossierModal.tsx:177–185` đọc lại từ `sessionStorage` theo `buildDossierStorageKey(chartIdentityKey)` (`ziwei_dossier_v1::${year}_${month}_${day}_${hour}_${gender}`).
- **Mức nghiêm trọng**: **Cao**
- **Phân tích tác động**:
  1. Đương số sinh vào tháng nhuận âm lịch thử đổi quy tắc tháng nhuận (`Chia đôi ngày 15` ↔ `Tính tháng chính` ↔ `Đẩy sang tháng sau`): Bàn Tử Vi trên màn hình thay đổi toàn bộ sao, nhưng khi mở **Hồ Sơ 8 Chương**, **Luận giải AI Kỳ Hạn (`InsightPanel`)** hoặc **Hỏi Đáp Ngữ Cảnh (`ContextualChatDrawer`)**, hệ thống lấy nhầm toàn bộ bài luận giải cũ của chính sách tháng nhuận trước đó vì `chartIdentityKey` và `periodContext.cacheKey` trùng khít 100%.
  2. Hai đương số khác tên (hoặc cùng ngày sinh dương lịch, cùng chi giờ sau quy đổi nhưng khác phút đồng hồ/kinh độ hoặc khác tên) khi lập nối tiếp trong cùng phiên tab sẽ dùng chung hồ sơ cache và chung mạch chat trong `sessionStorage`.
- **Hướng sửa / điều chỉnh đề xuất**:
  - Bổ sung hậu tố chính sách tháng nhuận và mã băm ngắn của `(name, leapMonthPolicy, isLeapMonth, wuxingJu, mingGongBranch)` vào `buildChartIdentityKey(chart)` tại `src/lib/dossier-chat-ui.ts:63–66` và đồng bộ hàm tạo `chartKey` tại `src/lib/ziwei/yunxian-context.ts:298` (ví dụ: `${b.year}_${b.month}_${b.day}_${b.hour}_${b.gender}_m${chart.mingGongBranch}_s${chart.shenGongBranch}_${b.leapMonthPolicy ?? 'split'}`).
- **Chi phí & Rủi ro**:
  - Chi phí: Rất thấp (~10 dòng code tại 2 file + 1 unit test).
  - Rủi ro: Không ảnh hưởng bất kỳ logic an sao nào; chỉ làm khóa cache phân biệt chính xác khi cấu trúc bàn thay đổi.
- **Cách kiểm chứng sau sửa**:
  - Thêm test trong `scripts/verify-dossier-chat-ui.ts`: tạo 2 `ZiweiChart` cùng ngày sinh tháng nhuận nhưng khác `leapMonth` (`'current'` vs `'next'`), khẳng định `buildChartIdentityKey(chart1) !== buildChartIdentityKey(chart2)` và `periodContext1.cacheKey !== periodContext2.cacheKey`.

---

#### `A-02` — Lệch nhẹ logic Chân Thái Dương Thời khi `province` rỗng (`longitude === undefined`) giữa lúc lập lá số (`share.ts`) và lúc hiển thị Header Hồ Sơ S5 (`dossier-chat-ui.ts`)
- **Mảng**: `(A)` Logic nghiệp vụ — Chân Thái Dương Thời (`True Solar Time`) & Header Hồ Sơ
- **Trạng thái xác minh**: **`[Đã kiểm chứng bằng code]`**
- **Bằng chứng `file:dòng`**:
  - `src/lib/ziwei/share.ts:10–25`:
    ```ts
    const tst = calculateTrueSolarTime({
      year: parseInt(form.year, 10),
      month: parseInt(form.month, 10),
      day: parseInt(form.day, 10),
      hour: clockHour,
      minute: clockMinute,
      longitude: form.longitude,
      utcOffsetMinutes: isVietnam ? 420 : 480,
    });
    ```
    Khi người dùng chọn tỉnh/thành `"Không rõ / Mặc định giờ chuẩn"` (`BirthForm.tsx` hoặc URL có `prov=` rỗng, `share.ts:52` gán `longitude = undefined`), hàm `calculateTrueSolarTime` tại `src/lib/ziwei/true-solar-time.ts:102–105` kiểm tra `if (longitude === undefined || isNaN(longitude))` và trả về `corrected: false, totalCorrectionMinutes: 0` (tức giữ nguyên giờ đồng hồ gốc, độ lệch = `0 phút`).
  - Ngược lại, tại `src/lib/dossier-chat-ui.ts:870` (`buildDossierHeaderMetadata`):
    ```ts
    const longitude = typeof b.longitude === 'number' && !isNaN(b.longitude) ? b.longitude : 105.0;
    ```
    Hàm này luôn ép `longitude` mặc định bằng `105.0` kể cả khi `b.longitude === undefined`, dẫn tới `tst.corrected === true` và hiển thị độ lệch phương trình thời gian `eotMinutes` khác `0` trên Header Hồ Sơ dù lúc lập lá số (`share.ts`) không hề cộng/trừ Chân Thái Dương Thời!
  - Ngoài ra, tại `src/lib/dossier-chat-ui.ts:885`:
    ```ts
    const isVietnam = b.city ? !/Bắc Kinh|Thượng Hải|Đài Bắc|Hồng Kông|Singapore/i.test(b.city) : true;
    ```
    Nếu người dùng chọn `Đài Loan`, `Trung Quốc`, `Singapore`, `Hàn Quốc`, `Nhật Bản` hoặc `Quốc tế` với các thành phố ngoài 5 tên trên (ví dụ: `Quảng Châu`, `Thâm Quyến`, `Cao Hùng`, `Tokyo`, `Seoul` trong `true-solar-time.ts:50–91`), `share.ts:9` nhận diện đúng `isVietnam = false` (`UTC+8 = 480`), nhưng `buildDossierHeaderMetadata` (`dossier-chat-ui.ts:885`) lại tưởng `isVietnam = true` (`UTC+7 = 420`), làm lệch `60 phút` (`15° kinh tuyến`) giữa giờ TST hiển thị trên Header Hồ Sơ và giờ TST thực tế đã dùng để an sao!
- **Mức nghiêm trọng**: **Trung bình**
- **Hướng sửa / điều chỉnh đề xuất**:
  1. Lưu trực tiếp kết quả `tst` (hoặc `utcOffsetMinutes` và `longitude` thực tế, giữ nguyên `undefined` khi không hiệu chỉnh kinh độ) vào `BirthInfo.origInput` trong `share.ts:27–38`, hoặc để `buildDossierHeaderMetadata` truyền nguyên `b.longitude` (không ép `?? 105.0` khi `b.longitude === undefined`) và xác định `utcOffsetMinutes` đồng nhất với `share.ts`.
- **Chi phí & Rủi ro**:
  - Chi phí: Thấp (~15 dòng code trong `types.ts`, `share.ts`, `dossier-chat-ui.ts`).
  - Rủi ro: Không đụng `algorithm.ts`; chỉ đồng bộ 100% phép tính giữa `share.ts` và `buildDossierHeaderMetadata`.
- **Cách kiểm chứng sau sửa**:
  - Viết test kiểm chứng với 2 trường hợp: (1) `longitude: undefined` (`province = ''`) và (2) thành phố ngoài Việt Nam như `Tokyo` / `Quảng Châu` (`utcOffsetMinutes = 480`), đảm bảo giờ Chân Thái Dương Thời trong `formToBirthInfo` và trong `buildDossierHeaderMetadata` trùng khớp từng phút.

---

#### `A-03` — Biến trạng thái toàn cục `currentBrightSchool` và bảng hằng `DEFAULT_BRIGHTNESS` thừa trong `algorithm.ts`
- **Mảng**: `(A)` Logic nghiệp vụ & `(C)` Chất lượng code trong `src/lib/ziwei/algorithm.ts`
- **Trạng thái xác minh**: **`[Đã kiểm chứng bằng code]`**
- **Bằng chứng `file:dòng`**:
  - `src/lib/ziwei/algorithm.ts:34–90`: Khai báo bảng `DEFAULT_BRIGHTNESS` (~57 dòng), nhưng không có bất kỳ dòng nào trong toàn project đọc bảng này.
  - `src/lib/ziwei/algorithm.ts:92–95`: Gọi `astro.config({ yearDivide: 'normal', horoscopeDivide: 'normal', algorithm: 'default' })` ngay ở cấp module khi nạp file.
  - `src/lib/ziwei/algorithm.ts:115–123`: Biến `let currentBrightSchool: BrightnessSchool = 'QS';` nằm ở phạm vi module (module-scoped mutable variable). Khi `generateChart(info)` chạy ở cả client lẫn server (`POST /api/interpret-dossier-section` hoặc `POST /api/interpret-chat`), độ sáng sao phụ thuộc vào biến toàn cục `currentBrightSchool` (`algorithm.ts:519, 531, 547`). Hiện tại không có UI nào gọi `setBrightnessSchool('TF')` trên server nên chưa gây lỗi race condition, nhưng về kiến trúc hàm thuần (pure function), trạng thái toàn cục và bảng `DEFAULT_BRIGHTNESS` thừa cần được ghi nhận.
- **Mức nghiêm trọng**: **Thấp** *(Lưu ý: `algorithm.ts` đang thuộc diện RÀNG BUỘC CỨNG không chạm vào nếu không có chỉ đạo mở lại từ chủ dự án)*
- **Hướng sửa / điều chỉnh đề xuất**:
  - Giữ nguyên không đụng vào `algorithm.ts` trong đợt sửa thường; nếu sau này chủ dự án cho phép dọn dẹp nhẹ, chỉ truyền `school` qua tham số tùy chọn của `generateChart(info, school = currentBrightSchool)` và xóa hằng chết `DEFAULT_BRIGHTNESS`.
- **Chi phí & Rủi ro**: Không cần sửa ngay (rủi ro vận hành hiện tại = 0 vì mặc định luôn là `'QS'`).
- **Cách kiểm chứng sau sửa**: Chạy bộ test so khớp 14 chính tinh và độ sáng Miếu/Vượng/Đắc/Bình/Hãm.

---

#### `A-04` — Góc khuất biên về Ranh giới Lập Xuân vs Tết Nguyên Đán giữa Tứ Trụ (`fourPillars`) và Tinh Bàn Tử Vi, cùng phép xấp xỉ `effHour = hour * 2`
- **Mảng**: `(A)` Logic nghiệp vụ — Ranh giới Lập Xuân, Tháng Nhuận & Tứ Trụ
- **Trạng thái xác minh**: **`[Nghi vấn cần kiểm chứng thêm]`** *(Cơ chế quy đổi trong code đã rõ, nhưng cần xác nhận chủ đích học thuật với các ca sinh sát giờ Lập Xuân)*
- **Bằng chứng `file:dòng`**:
  - `src/lib/ziwei/algorithm.ts:16–24` và `219–225`: Tinh bàn Tử Vi dùng ranh giới **Tết Nguyên Đán** (`yearDivide: 'normal'`), lấy Can Chi năm âm lịch từ `lunar.getYearGanByLiChun ? ... : lunar.getYearInGanZhi()` — thực tế tại `algorithm.ts:221–222`:
    ```ts
    const yearGZ = (lunar as any).getYearInGanZhiExact
      ? (lunar as any).getYearInGanZhi() // Standard Lunar Year (Spring Festival boundary)
      : lunar.getYearInGanZhi();
    ```
    (cả 2 nhánh ternary đều gọi `lunar.getYearInGanZhi()`, tức chuẩn Tết Nguyên Đán, đúng truyền thống Tử Vi Đẩu Số).
  - Trong khi đó, hàm `calcFourPillars(year, month, day, hour)` tại `src/lib/ziwei/algorithm.ts:234–259` tạo đối tượng `Solar.fromYmdHms(year, month, day, effHour, 0, 0)` với `effHour = hour === 0 || hour === 12 ? 23 : hour * 2` rồi lấy `eightChar.getYearGan() / getYearZhi()` (trong `lunar-javascript`, Bát Tự `EightChar` tính trụ Năm và trụ Tháng theo tiết khí **Lập Xuân**).
  - Hệ quả cần kiểm chứng:
    1. Với người sinh trong khoảng giữa **Lập Xuân** và **Tết Nguyên Đán** (ví dụ sinh ngày 05/02 dương lịch, đã qua Lập Xuân nhưng chưa tới Tết Âm lịch): Trụ Năm của Bát Tự (`fourPillars.year`) sẽ mang Can Chi năm mới, còn Năm Âm Lịch an Tứ Hóa Bản Mệnh Tử Vi (`yearStem`, `yearBranch`) mang Can Chi năm cũ. Đây là sự khác biệt học thuật kinh điển giữa Tử Vi (tính theo Tết Nguyên Đán) và Bát Tự Tử Bình (tính theo Lập Xuân), nhưng trên giao diện nếu người dùng so sánh ô "Tứ Trụ" và "Can Năm Bản Mệnh" có thể thắc mắc nếu không có chú thích.
    2. Tại `algorithm.ts:238`, `effHour = hour * 2` lấy mốc đầu giờ chẵn (`02:00`, `04:00`, `06:00`...) thay vì phút thực tế (`origInput.clockHour`, `origInput.clockMinute`). Nếu một người sinh đúng ngày giao tiết khí (Lập Xuân, Kinh Trập...) và thời khắc giao tiết rơi vào giữa cung giờ đó (ví dụ giao tiết lúc `02:35`, người sinh lúc `02:45` cùng Giờ Sửu), `Solar.fromYmdHms(..., 2, 0, 0)` sẽ lấy mốc `02:00` (trước tiết khí) thay vì `02:45` (sau tiết khí) cho Trụ Tháng Bát Tự.
- **Mức nghiêm trọng**: **Thấp**
- **Hướng sửa / điều chỉnh đề xuất**:
  - Không tự ý sửa `algorithm.ts` (ràng buộc cứng). Đề xuất bổ sung kịch bản kiểm thử biên và (nếu cần) chú thích rõ trên UI rằng "Tử Vi an sao theo năm/tháng Âm lịch (mốc Tết Nguyên Đán); Bát Tự Tứ Trụ tham chiếu theo tiết khí Lập Xuân".
- **Chi phí & Rủi ro**: 0 rủi ro nếu chỉ bổ sung chú thích minh bạch ở tầng hiển thị.
- **Cách kiểm chứng**:
  - Viết script đối chiếu 3 ca biên: (1) Sinh sau Lập Xuân nhưng trước Tết Nguyên Đán (ví dụ `06/02/1995`), (2) Sinh đúng ngày rằm tháng nhuận (`15` âm lịch tháng nhuận) với 3 chế độ `split` / `current` / `next`, (3) Sinh đúng giờ giao tiết Lập Xuân.

---

#### `A-05` — Kiểm chứng công thức Lưu Hồng Loan / Lưu Thiên Hỷ và Tứ Hóa Đại Hạn giữa `algorithm.ts` và `yunxian-context.ts` / `dossier-context.ts`
- **Mảng**: `(A)` Logic nghiệp vụ — Sao lưu niên & Tứ Hóa các tầng
- **Trạng thái xác minh**: **`[Đã kiểm chứng bằng code]`** *(Công thức toán học khớp chuẩn, nhưng có điểm khác biệt kiến trúc hiển thị giữa bàn chính và bảng dữ kiện)*
- **Bằng chứng `file:dòng`**:
  - Công thức Hồng Loan / Thiên Hỷ tại `src/lib/ziwei/yunxian-context.ts:448–449` và `src/lib/ziwei/dossier-context.ts:255–256`:
    ```ts
    const hongLuanBranch = ((3 - branchIndex) % 12 + 12) % 12;
    const tianXiBranch = (hongLuanBranch + 6) % 12;
    ```
    Khớp chính xác khẩu quyết *"Mão thượng khởi Tý nghịch số chi, số đến Lưu Niên an Hồng Loan, đối cung xung chiếu an Thiên Hỷ"* (Tý=0 → Mão=3; Sửu=1 → Dần=2; Dần=2 → Sửu=1; Mão=3 → Tý=0...).
  - Tuy nhiên, tại `src/lib/ziwei/algorithm.ts:629–641`:
    ```ts
    // Note: Following Ni Hai Xia (倪海厦) school — only Natal (本命) SiHua is used on the chart.
    // DaXian (大限) SiHua and Self-SiHua (自化) are NOT displayed on the base chart.
    ```
    Trong khi `ChartBoard` (`algorithm.ts`) chỉ gắn Tứ Hóa Bản Mệnh vào `palace.stars[i].siHua` và chỉ tính Tứ Hóa Đại Hạn / Lưu Niên khi người dùng bấm thanh `TimeNav`, thì `dossier-context.ts:458–480` còn tính thêm **Tự Hóa tại cung (`selfTransforms`)** và **Phi Tinh Can Cung (`palaceFlyTransforms`)** cho toàn bộ 12 cung trong các chương `palaces_core`, `palaces_relations`, `palaces_wealth_karma`.
- **Mức nghiêm trọng**: **Thấp**
- **Hướng sửa / điều chỉnh đề xuất**:
  - Đây là tính năng bổ sung hợp lý cho Hồ Sơ chuyên sâu, nhưng trong prompt của `palaces_*` (`server.ts:456–494`) nên nhắc rõ rằng Phi Tinh Can Cung / Tự Hóa chỉ dùng để tham khảo bổ trợ, không được đánh đồng với `[Tứ Hóa Bản Mệnh]` trên Thiên Bàn.
- **Chi phí & Rủi ro**: Rất thấp (chỉ làm rõ câu chữ chỉ dẫn nếu mở lại prompt).
- **Cách kiểm chứng**: Kiểm tra đầu ra `buildDossierSectionFactSheet` trên các chương `palaces_*`.

---

#### `A-06` — Rủi ro rò/lệch ngữ cảnh trong `ContextualChatDrawer` khi người dùng sinh lại chương Hồ Sơ hoặc đổi tab Chủ đề khi ngăn Chat đang mở
- **Mảng**: `(A)` Logic nghiệp vụ — Ngữ cảnh hỏi đáp (`ContextualChatDrawer.tsx`, `InsightPanel.tsx`, `DetailedDossierModal.tsx`)
- **Trạng thái xác minh**: **`[Đã kiểm chứng bằng code]`**
- **Bằng chứng `file:dòng`**:
  - `src/App.tsx:70–71, 503, 508–513`: `chatDrawerContext` là một snapshot tĩnh (`ContextualChatContextPayload | null`) được truyền vào `setChatDrawerContext(ctx)` tại thời điểm người dùng bấm nút `"Hỏi đáp chương này"` (`DetailedDossierModal.tsx:969–984`) hoặc `"Hỏi đáp phần này"` (`InsightPanel.tsx:745–761, 969–989`).
  - Nếu người dùng mở `ContextualChatDrawer` ở một chương Hồ Sơ khi chương đó **chưa sinh AI** (lúc đó `excerptVi` chỉ là `activeFactSheet`, `DetailedDossierModal.tsx:976`), sau đó sinh xong chương Hồ Sơ rồi mở lại hoặc giữ nguyên, hoặc trong `InsightPanel` khi `selectedPalace` / `activeTopic` vừa mới bắt đầu stream (`currentContent` đang là bản fallback cục bộ `InsightPanel.tsx:457, 982`), `chatDrawerContext.excerptVi` đã chụp cứng giá trị cũ trước khi stream hoàn tất.
  - Ngoài ra, tại `src/components/HemingView.tsx:274–280`:
    ```ts
    const bKey = `${chartB.birthInfo.year}_${chartB.birthInfo.month}_${chartB.birthInfo.day}_${chartB.birthInfo.hour}_${chartB.birthInfo.gender}`;
    onOpenContextualChat({
      chart: chartA,
      chartB,
      contextMode: 'heming',
      contextKey: `heming_${bKey}`,
    ```
    Trong `ContextualChatDrawer.tsx:133, 268–271`, bộ đếm hạn mức `15 câu/phiên` (`ziwei_chat_quota_v1::${chartIdentityKey}`) chỉ tính theo `chartA` (`context.chart`), còn ở `InsightPanel.tsx:978`:
    ```ts
    const currentKey = selectedMutagen ? ... : selectedPalace ? `palace_${selectedPalace.name}_${periodContext?.periodId ?? 'natal'}` : `${activeTopic}${periodSuffix}`;
    ```
    Khi người dùng đang chọn một Cung (`selectedPalace !== null`), biến `contextMode` vẫn gửi là `'natal'` (`InsightPanel.tsx:977`) dù `currentKey` có gắn `periodContext.periodId` và `periodContext` được truyền kèm xuống server (`server.ts:893–898`), làm cho prompt chat nhận cả `periodBlock` lẫn `contextMode = 'natal'`.
- **Mức nghiêm trọng**: **Thấp**
- **Hướng sửa / điều chỉnh đề xuất**:
  - Khi bấm mở Chat từ `InsightPanel` trong lúc `loading === true`, khóa nhẹ nút mở Chat (hoặc cập nhật `chatDrawerContext.excerptVi` khi bài luận hoàn tất) để tránh chụp nhầm văn bản fallback cục bộ trước khi AI trả lời xong.
- **Chi phí & Rủi ro**: Thấp (~10 dòng tại `InsightPanel.tsx`).
- **Cách kiểm chứng**: Mở Chat sau khi stream `InsightPanel` hoàn tất, kiểm tra độ dài `excerptVi` trên thanh ghim ngữ cảnh của `ContextualChatDrawer`.

---

### MẢNG (B) — LOGIC KHO KHÓA (`Key Pool`) & TẦNG AI (`server/key-pool/*`, `server.ts`, `text-sanitizer.ts`)

#### `B-01` — Khi luồng AI bị ngắt giữa chừng và không thể tiếp nối (`canContinue === false`), `executor.ts` bơm trực tiếp câu cảnh báo gián đoạn vào `options.onChunk`, làm câu cảnh báo bị trộn lẫn vào thân văn bản `incompleteText`
- **Mảng**: `(B)` Logic Kho Khóa & Tầng AI — Xử lý ngắt luồng (`server/key-pool/executor.ts`)
- **Trạng thái xác minh**: **`[Đã kiểm chứng bằng code]`**
- **Bằng chứng `file:dòng`**:
  - `server/key-pool/executor.ts:364–375` (và nhánh hết ngân sách/khóa tại `executor.ts:408–418`):
    ```ts
    options.onChunk(
      '\n\n*(Luồng kết nối bị gián đoạn giữa chừng — vui lòng bấm luận giải lại để nhận bản đầy đủ.)*',
    );
    options.onInterrupted?.({
      reason: classified.sanitizedSummary,
      errorCategory: classified.category,
      partialLength: streamedTextSoFar.length,
    });
    ```
  - Tại `server.ts:685–701` (`/api/interpret-period`), `server.ts:806–822` (`/api/interpret-dossier-section`), `server.ts:914–930` (`/api/interpret-chat`):
    - Khi `onChunk` được gọi với chuỗi `'*(Luồng kết nối bị gián đoạn giữa chừng...)*'`, server gửi nó như một gói `data: {"delta":{"text":"..."}}` thông thường và cộng dồn vào `accumulatedText`.
    - Ngay sau đó, `onInterrupted` lại gửi thêm gói `data: {"interrupted":true,"message":...}`.
    - Ở phía client (`DetailedDossierModal.tsx:508–520`, `InsightPanel.tsx:282–295`, `ContextualChatDrawer.tsx:367–379, 598–606`), giao diện **đã có sẵn hộp cảnh báo màu hổ phách (amber banner)** hiển thị lỗi gián đoạn, đồng thời lại hiển thị `incompleteText` có chứa thêm dòng chữ in nghiêng `*(Luồng kết nối bị gián đoạn giữa chừng...)*` ở cuối văn bản Markdown (bị lặp thông báo 2 lần).
    - Nghiêm trọng hơn: Tại `HemingView.tsx:128–138`, vòng đọc SSE **không hề kiểm tra `parsed.interrupted`**, nên khi luồng Hợp Bàn bị đứt giữa chừng, `HemingView` nối dòng chữ nghiêng đó vào `result` và coi như bài luận Hợp Bàn đã thành công!
- **Mức nghiêm trọng**: **Trung bình**
- **Hướng sửa / điều chỉnh đề xuất** *(Lưu ý: `server/key-pool/*` thuộc diện không tự ý chạm vào nếu chưa mở lại quyết định)*:
  - **`[Đề xuất MỞ LẠI phạm vi sửa nhỏ tại executor.ts / HemingView.tsx]`**:
    1. Bắt sự kiện `parsed.interrupted` và `parsed.meta` trong `HemingView.tsx:128–140` giống hệt `InsightPanel.tsx`.
    2. (Tùy chọn nếu cho phép sửa `executor.ts:364, 408`): Bỏ gọi `options.onChunk('\n\n*(Luồng kết nối bị gián đoạn...)*')` vì tất cả các endpoint hiện nay đã nhận sự kiện cấu trúc `options.onInterrupted` tách biệt.
- **Chi phí & Rủi ro**: Rất thấp (~15 dòng ở `HemingView.tsx`, 0 rủi ro cho Kho Khóa).
- **Cách kiểm chứng**: Giả lập sự kiện SSE `{"interrupted":true}` và kiểm tra UI không bị lặp cảnh báo kép và `HemingView` hiển thị đúng trạng thái gián đoạn.

---

#### `B-02` — Lỗ hổng phân tích ngữ cảnh trong bộ lọc hậu kiểm 3B (`isPeriodSiHuaMentionedInText` tại `text-sanitizer.ts`): Nguy cơ dương tính giả (False Positive) trong cửa sổ `±140 ký tự`
- **Mảng**: `(B)` Logic Tầng AI & Hậu kiểm (`src/lib/ziwei/text-sanitizer.ts`)
- **Trạng thái xác minh**: **`[Đã kiểm chứng bằng code]`**
- **Bằng chứng `file:dòng`**:
  - `src/lib/ziwei/text-sanitizer.ts:103–137`:
    ```ts
    export function isPeriodSiHuaMentionedInText(
      text: string,
      impact: PeriodSiHuaImpact,
    ): boolean {
      if (!text || !impact.starNameVi) return false;
      const lower = text.toLowerCase();
      const starLower = impact.starNameVi.toLowerCase();
      ...
      let searchFrom = 0;
      while (searchFrom < lower.length) {
        const idx = lower.indexOf(starLower, searchFrom);
        if (idx === -1) break;
        const winStart = Math.max(0, idx - 140);
        const winEnd = Math.min(lower.length, idx + starLower.length + 140);
        const windowText = lower.slice(winStart, winEnd);
        if (mutagenPatterns.some((p) => windowText.includes(p))) {
          return true;
        }
        searchFrom = idx + starLower.length;
      }
      return false;
    }
    ```
  - **Kịch bản Dương tính giả (False Positive — bỏ sót không vá dù AI thực chất quên)**:
    - Cửa sổ `±140 ký tự` (tổng cộng `~288 ký tự`, tương đương 2–3 câu văn xuôi tiếng Việt) là khá rộng.
    - Giả sử trong kỳ Lưu Niên, sao **Thiên Cơ** là **Lưu Hóa Lộc**, còn sao **Thái Âm** (cùng cung hoặc câu kế bên cách nhau 80 ký tự) có **[Tứ Hóa Bản Mệnh] Hóa Lộc** (hoặc Đại Hạn Hóa Lộc).
    - Nếu AI chỉ viết: *"Tại cung này có Thiên Cơ hội hợp cùng Thái Âm mang Hóa Lộc Bản Mệnh..."* mà **quên hoàn toàn Lưu Hóa Lộc của Thiên Cơ**, hàm `isPeriodSiHuaMentionedInText` tìm thấy chữ `"thiên cơ"` và quét `±140 ký tự` xung quanh sẽ bắt trúng chữ `"hóa lộc"` của **Thái Âm Bản Mệnh**, trả về `true`! Kết quả là hậu kiểm 3B tưởng AI đã nhắc Lưu Hóa Lộc của Thiên Cơ nên không chèn khối đính chính.
- **Mức nghiêm trọng**: **Trung bình**
- **Hướng sửa / điều chỉnh đề xuất**:
  - Thu hẹp cửa sổ kiểm tra xuống phạm vi **cùng một mệnh đề/câu** (hoặc `[-25, +75]` ký tự tính từ tên sao, không vượt qua dấu chấm câu `.` / `\n` / `;`) và loại trừ trường hợp cụm `"hóa lộc"` đứng ngay trước/sau cụm `"bản mệnh"` của một sao khác.
- **Chi phí & Rủi ro**:
  - Chi phí: Thấp (~20 dòng trong `src/lib/ziwei/text-sanitizer.ts`).
  - Rủi ro: Cần giữ tương thích 100% với `TEST-2` và `TEST-7` trong `verify-dossier-chat-ui.ts`.
- **Cách kiểm chứng sau sửa**:
  - Thêm test case vào `scripts/verify-dossier-chat-ui.ts`: câu văn có tên sao A (cần kiểm tra Lưu Hóa Lộc) đứng cách sao B có `"Hóa Lộc Bản Mệnh"` 60 ký tự qua dấu chấm câu, khẳng định `isPeriodSiHuaMentionedInText` trả về `false` và kích hoạt khối vá 3B đầy đủ.

---

#### `B-03` — Bộ lọc 3A (`sanitizeLayer3AOnly`) chỉ tách từ dính trước chữ `đ` thường, chưa xử lý các lỗi dính chữ phổ biến khác hoặc nhãn rò rỉ dạng ngoặc vuông tự chế của LLM
- **Mảng**: `(B)` Logic Tầng AI & Hậu kiểm (`src/lib/ziwei/text-sanitizer.ts`)
- **Trạng thái xác minh**: **`[Đã kiểm chứng bằng code]`**
- **Bằng chứng `file:dòng`**:
  - `src/lib/ziwei/text-sanitizer.ts:38–39, 63`:
    ```ts
    const VIET_SYLLABLE_END_BEFORE_D_RE =
      /([a-zA-ZÀ-ỹ]{2,})(đ[a-zà-ỹ]+)/g;
    ```
    Theo quyết định `QĐ-G1`, việc giới hạn regex chỉ tách trước chữ `đ` (`U+0111`) giúp **an toàn tuyệt đối 100% với từ tiếng Anh** (vì tiếng Anh không có chữ `đ`).
  - Tuy nhiên, qua kiểm tra đầu ra LLM tiếng Việt của dòng model `flash-lite`, ngoài chữ `đ`, LLM đôi khi dính chữ ở các âm tiết có dấu thanh đặc trưng tiếng Việt đứng liền sau phụ âm cuối (ví dụ: một âm tiết kết thúc bằng `ng`, `nh`, `ch`, `m`, `n`, `p`, `t` dính liền với từ bắt đầu bằng phụ âm khác có dấu thanh tiếng Việt như `"cungTài"`, `"MệnhCung"`, `"HóaLộc"`, tức lỗi dính `camelCase` tiếng Việt khi in đậm/viết hoa giữa câu).
  - Một chữ thường đứng ngay trước một chữ IN HOA có dấu tiếng Việt (ví dụ `([a-zà-ỹ])([A-ZÀ-Ỹ][a-zà-ỹ]+)`) cũng rất dễ xảy ra khi LLM quên khoảng trắng trước tên riêng/tên cung (`"tạicung Mệnh"`, `"vàoĐại Hạn"`).
- **Mức nghiêm trọng**: **Thấp**
- **Hướng sửa / điều chỉnh đề xuất**:
  - **`[Đề xuất MỞ LẠI bổ sung nhỏ cho QĐ-G1]`**: Giữ nguyên quy tắc chữ `đ`, và chỉ bổ sung thêm 1 quy tắc cực kỳ an toàn: tách khi một ký tự tiếng Việt có dấu (nằm ngoài bảng ASCII `a-zA-Z`, tức thuộc khối Unicode tiếng Việt `[\u00C0-\u1EF9]`) đứng sát ngay trước một chữ cái IN HOA (`([a-z\u00E0-\u1EF9])([A-Z\u00C0-\u1EF9][a-z\u00E0-\u1EF9]+)` với điều kiện ít nhất 1 trong 2 vế chứa ký tự có dấu tiếng Việt để không chạm tới từ tiếng Anh kiểu `iPhone`, `eBay`, `JavaScript`, `GitHub`).
- **Chi phí & Rủi ro**: Rất thấp (~5 dòng regex + test bảo vệ các từ `iPhone`, `JavaScript`, `McDonald`).
- **Cách kiểm chứng**: Chạy unit test với cả chuỗi lỗi dính chữ tiếng Việt (`"vàoĐại Hạn"`, `"củaThiên Cơ"`) và danh sách từ tiếng Anh `camelCase`.

---

#### `B-04` — Thiếu rào chắn hậu kiểm hoặc danh sách liệt kê tường minh quan hệ Tam Hợp / Nhị Hợp / Giáp Cung trong Prompt các chương Tổng quan, Nhóm cung và Tầm nhìn 5–10 năm
- **Mảng**: `(B)` Logic Tầng AI — Chống bịa đặt hình học cung vị (Anti-hallucination)
- **Trạng thái xác minh**: **`[Đã kiểm chứng bằng code]`**
- **Bằng chứng `file:dòng`**:
  - Trong `src/lib/ziwei/dossier-context.ts:481–513`, mỗi cung trong `chartData.palaces` đã tính sẵn đầy đủ:
    - `oppositePalaceNameVi` (cung Xung Chiếu)
    - `sanfangPalaceNamesVi` (2 cung Tam Hợp trong Tam Phương Tứ Chính)
  - Khi in bảng dữ kiện cho các chương `palaces_core`, `palaces_relations`, `palaces_wealth_karma` (`dossier-context.ts:756–774`), bảng dữ kiện có dòng:
    `- Tam phương tứ chính: Xung chiếu ..., Tam hợp ...`
  - **Tuy nhiên**:
    1. Trong chương `chapter_overview` (`dossier-context.ts:696–743`), bảng dữ kiện chỉ liệt kê danh sách 12 cung tóm tắt (`dòng 729–736`) mà **không in sẵn cặp Tam Hợp / Xung Chiếu của từng cung**.
    2. Trong chương `da_xian_current`, `liu_nian_current`, `liu_nian_next` (`yunxian-context.ts:132–245`), bảng dữ kiện chỉ in `xung <Cung đối>` cho 4 sao Tứ Hóa, **không in rõ 2 cung Tam Hợp của cung kích hoạt kỳ hạn** (`activatedPalace`). Do đó khi prompt yêu cầu phân tích *"Tam Phương Tứ Chính của kỳ hạn"*, LLM phải tự nhẩm địa chi tam hợp (`Thân–Tý–Thìn`, `Dần–Ngọ–Tuất`, `Tỵ–Dậu–Sửu`, `Hợi–Mão–Mùi`) và gán tên cung Bản Mệnh/Lưu Niên tương ứng — đây chính là nguyên nhân gốc dẫn tới lỗi `(S2)` trong hồ sơ Nguyễn Văn An (LLM tự suy diễn tam hợp của Lưu Niên tại Dậu là Mão rồi gọi nhầm vai trò Lưu Tài Bạch thành Tài Bạch Bản Mệnh).
    3. Tương tự, các chương `horizon_5y` và `horizon_10y` (`dossier-context.ts:878–1040`, `server.ts:496–556`) chứa ma trận 5 năm và 3 đại hạn nhưng không có hậu kiểm tự động nào kiểm tra xem LLM có bỏ sót năm/đại hạn hoặc gọi nhầm tên cung hay không.
- **Mức nghiêm trọng**: **Cao**
- **Hướng sửa / điều chỉnh đề xuất**:
  1. Tại `src/lib/ziwei/yunxian-context.ts` (`buildFactTableMarkdown`, dòng `150–195`): In sẵn 1 dòng tường minh dưới mục **1. Cung được kích hoạt**:
     `- Tam hợp kỳ hạn (Tam Phương Tứ Chính): Hội chiếu từ cung <Tên Bản Mệnh 1> (<Can Chi 1>) [đóng vai <Vai trò kỳ hạn 1>] và cung <Tên Bản Mệnh 2> (<Can Chi 2>) [đóng vai <Vai trò kỳ hạn 2>]; Xung chiếu từ cung <Tên Đối Cung> (<Can Chi Đối>) [đóng vai <Vai trò kỳ hạn Đối>].`
     Nhờ vậy, LLM **không bao giờ phải tự nhẩm Tam Hợp** hay tự đoán vai trò cung Lưu Niên của 2 cung tam hợp nữa!
  2. Tại `server.ts:358–378` (`buildStrictDossierSectionPrompt`): Thêm quy tắc cấm tự suy diễn quan hệ Nhị Hợp / Giáp Cung nếu không có trong bảng dữ kiện.
- **Chi phí & Rủi ro**:
  - Chi phí: Thấp (~25 dòng trong `yunxian-context.ts`), tiêu tốn 0 quota AI, tăng ~45 token cho prompt kỳ hạn nhưng triệt tiêu tận gốc lỗi LLM tự tính nhầm Tam Hợp của cung Lưu Niên / Đại Hạn.
  - Rủi ro: Rất thấp; hoàn toàn dựa trên dữ liệu `chart.palaces` đã có sẵn.
- **Cách kiểm chứng sau sửa**:
  - Thêm assertion vào `scripts/verify-dossier-context.ts`: kiểm tra `periodContext.factTableMarkdown` của Lưu Niên 2026 và 2027 có chứa tường minh cả tên cung Bản Mệnh lẫn `[đóng vai Lưu ...]` cho 2 cung Tam Hợp và 1 cung Xung Chiếu.

---

#### `B-05` — Điểm mở `AbortError: This operation was aborted | code=20` trong `executor.ts` / `@google/genai`
- **Mảng**: `(B)` Logic Kho Khóa & Tầng AI (`server/key-pool/executor.ts`, `server/key-pool/allocator.ts`)
- **Trạng thái xác minh**: **`[Nghi vấn cần kiểm chứng thêm]`** *(Đã ghi nhận trong `docs/stream-interruption-diagnosis.md:217–241`, chưa kết luận nguyên nhân gốc)*
- **Bằng chứng `file:dòng`**:
  - `server/key-pool/executor.ts:183–204`:
    ```ts
    const attemptAbort = new AbortController();
    const onCallerAbort = () => attemptAbort.abort(new Error('CLIENT_ABORTED'));
    options.signal?.addEventListener('abort', onCallerAbort, { once: true });

    let timedOutWaitingFirstChunk = false;
    const timeoutHandle = setTimeout(() => {
      timedOutWaitingFirstChunk = true;
      attemptAbort.abort(new Error('FIRST_CHUNK_TIMEOUT'));
    }, firstChunkTimeoutMs);
    ```
  - Qua đối chiếu chi tiết code `executor.ts:154–245`, phát hiện **3 manh mối kỹ thuật rất đáng chú ý** cần kiểm chứng:
    1. **Manh mối 1 — Thu hẹp `firstChunkTimeoutMs` ở cuối ngân sách `35s` (`executor.ts:176–181`)**:
       ```ts
       const remainingBudgetMs = TOTAL_FAILOVER_TIME_BUDGET_MS - (nowFn() - requestStartMs);
       if (remainingBudgetMs <= 500) {
         break;
       }
       const firstChunkTimeoutMs = Math.min(FIRST_CHUNK_TIMEOUT_MS, remainingBudgetMs);
       ```
       Khi lượt thử đầu tiên (ví dụ trên `gemini-3.5-flash-lite`) chạy được `22–28 giây` rồi bị ngắt giữa luồng (`503 UNAVAILABLE`), `remainingBudgetMs` chỉ còn lại **`7–13 giây`** (hoặc sau 1 lượt thử tiếp nối thất bại mất `5s`, lượt kế tiếp chỉ còn **`2–4 giây`**!).
       Lúc đó `firstChunkTimeoutMs` chỉ còn vài giây, trong khi prompt tiếp nối (`buildContinuationPrompt` tại `executor.ts:44–78`) dài gấp đôi prompt gốc (bao gồm cả prompt gốc + toàn bộ văn bản đã sinh), nên thời gian chờ token đầu tiên (TTFB) của model dự phòng `gemini-3.8-flash` thường mất `4–8 giây`.
       Khi `timeoutHandle` nổ ở giây thứ `3–6`, nó gọi `attemptAbort.abort(new Error('FIRST_CHUNK_TIMEOUT'))`.
    2. **Manh mối 2 — Tại sao thông báo lỗi lại là `"AbortError: This operation was aborted | code=20"` chứ không phải `"FIRST_CHUNK_TIMEOUT"`?**:
       Trong Node.js `undici` (được `@google/genai` gọi qua `fetch(..., { signal: attemptAbort.signal })`), tùy phiên bản `undici` / trình bọc stream của `@google/genai`, khi `signal` bị abort trong lúc đang đọc body stream hoặc thiết lập kết nối, `undici` có thể ném ra một đối tượng `DOMException('This operation was aborted', 'AbortError')` mới (với `err.name === 'AbortError'`, `err.code === 20`, `err.message === 'This operation was aborted'`) **thay vì** ném trực tiếp `attemptAbort.signal.reason` (`Error('FIRST_CHUNK_TIMEOUT')`)!
       Và hãy nhìn vào `executor.ts:249` và `allocator.ts:158`:
       - `executor.ts:249` không kiểm tra biến cờ `timedOutWaitingFirstChunk` khi phân loại lỗi hoặc ghi log!
       - `allocator.ts:158` khớp `/timeout|timed out|abort|econnreset...|503/` trên `err.message` (`"AbortError: This operation was aborted"`), nên xếp vào `NETWORK_OR_5XX`, phạt oan các khóa `#22`, `#23`, `#21` mỗi khóa `-10` điểm và nhốt `30s cooldown` dù thực chất có thể chỉ là **hết `remainingBudgetMs` (`firstChunkTimeoutMs` bị bóp nghẹt còn 2–5 giây sau khi lượt 1 đã ngốn 28 giây)**!
    3. **Manh mối 3 — Rò rỉ listener `abort` trên `options.signal` (`executor.ts:185, 240`)**:
       Nếu `generateContentStream` trả về thành công nhưng lỗi xảy ra bên trong vòng lặp `for await (const chunk of stream)` (`executor.ts:207–238`), khối `catch` của `for await` bắt lỗi bên ngoài `try/finally` của `clearTimeout(timeoutHandle)`? Không, `try` ở dòng `193` bọc cả `for await` và `finally` ở dòng `239–242` có gọi `options.signal?.removeEventListener('abort', onCallerAbort)`. Tuy nhiên, biến `timedOutWaitingFirstChunk` ở dòng `187` **hoàn toàn không được đọc ở bất kỳ đâu trong `executor.ts`** (biến thừa được gán `true` ở dòng `189` nhưng không bao giờ được sử dụng!).
- **Mức nghiêm trọng**: **Cao**
- **Hướng sửa / điều chỉnh đề xuất**:
  - **`[Đề xuất MỞ LẠI chẩn đoán & sửa tại executor.ts]`**:
    1. Đọc biến `timedOutWaitingFirstChunk` trong khối `catch (err)` tại `executor.ts:245`: ghi rõ vào thông tin lỗi `firstChunkTimeoutMs=${firstChunkTimeoutMs}ms, timedOutWaitingFirstChunk=${timedOutWaitingFirstChunk}, elapsedMs=${nowFn() - requestStartMs}ms`.
    2. Nếu `timedOutWaitingFirstChunk === true` khi `firstChunkTimeoutMs < FIRST_CHUNK_TIMEOUT_MS` (tức bị ép ngắn do cạn ngân sách tổng `35s` chứ không phải khóa đó phản hồi chậm quá `12s`), **không được phạt `-10` điểm và không nhốt khóa đó vào `cooldown` 30s**!
    3. Khi bước vào nhánh tiếp nối (`continuationCount > 0`), cấp riêng một khoảng thời gian tối thiểu cho TTFB của lượt tiếp nối (ví dụ `Math.max(8_000, remainingBudgetMs)` hoặc cho phép trần thời gian của luồng đã có chunk đầu tiên nới thêm `12s` cho lượt cứu hộ) để tránh bóp chết lượt tiếp nối khi lượt đầu đã chạy 28 giây.
- **Chi phí & Rủi ro**:
  - Chi phí: Thấp (~20 dòng trong `executor.ts` + 1 test trong `verify-key-pool.ts`).
  - Rủi ro: Cần chủ dự án phê duyệt vì chạm tới `executor.ts` và ngân sách thời gian failover `35s`.
- **Cách kiểm chứng**:
  - Viết test mô phỏng trong `scripts/verify-key-pool.ts`: Lượt 1 chạy 32 giây mới đứt luồng (`remainingBudgetMs = 3000ms`), Lượt 2 trên Key B cần `4500ms` để trả chunk đầu tiên → Kiểm chứng xem với code hiện tại Key B có bị `AbortError` do `timeoutHandle` (`3000ms`) và bị phạt oan `NETWORK_OR_5XX` hay không, và sau khi sửa thì Key B không bị phạt oan.

---

#### `B-06` — Thống kê `totalCalls` / `successCalls` trong `allocator.ts` khi một khóa gặp lỗi ở `defaultModel` nhưng thành công ngay ở `fallbackModel` trong cùng 1 lượt cấp phát (`KeyLease`)
- **Mảng**: `(B)` Logic Kho Khóa (`server/key-pool/allocator.ts`, `server/key-pool/executor.ts`)
- **Trạng thái xác minh**: **`[Đã kiểm chứng bằng code]`**
- **Bằng chứng `file:dòng`**:
  - Trong `server/key-pool/executor.ts:169–349`: Trên cùng 1 `lease` (ví dụ `Key #1`), nếu model chính `gemini-3.5-flash-lite` gặp `MODEL_UNAVAILABLE` (hoặc `RATE_LIMIT_RPM`), `executor.ts:320` gọi `this.allocator.recordModelIssue(...)`:
    - `allocator.ts:608–609` (hoặc `661–662`): Tăng `key.stats.totalCalls += 1` và `key.stats.errorCalls += 1`.
  - Ngay lập tức trong vòng lặp `for (let mIdx = 0; ...)` trên cùng `Key #1`, model dự phòng `gemini-3.8-flash` chạy và thành công:
    - `executor.ts:293` gọi `this.allocator.recordSuccess(lease.keyId, ttfbMs, nowFn())`.
    - `allocator.ts:575–576`: Tăng thêm `key.stats.totalCalls += 1` và `key.stats.successCalls += 1`, đồng thời đặt `key.consecutiveErrors = 0`.
  - Hành vi này là **nhất quán về toán học** (`totalCalls = successCalls + errorCalls`, phản ánh đúng 2 cuộc gọi HTTP thực tế tới Google API: 1 cuộc gọi lỗi ở model chính + 1 cuộc gọi thành công ở model phụ). Tuy nhiên, `key.stats.lastErrorType` vẫn giữ `'MODEL_UNAVAILABLE'` hoặc `'RATE_LIMIT_RPM'` ngay cả sau khi `recordSuccess` vừa chạy thành công (`allocator.ts:574–595` không xóa `lastErrorType` nhưng vẫn giữ lịch sử lỗi gần nhất để admin tra cứu).
- **Mức nghiêm trọng**: **Thấp** (Hoạt động đúng thiết kế, ghi nhận để minh bạch hóa tài liệu).
- **Hướng sửa / điều chỉnh đề xuất**: Không cần sửa logic đếm; có thể giữ nguyên vì trên UI Kho Khóa cột "Lỗi gần nhất" dùng để chẩn đoán lịch sử lỗi của khóa.
- **Chi phí & Rủi ro**: 0.
- **Cách kiểm chứng**: Đã được bảo vệ bởi bộ test `scripts/verify-key-pool.ts` (17/17).

---

### MẢNG (C) — CHẤT LƯỢNG CODE (Trùng lặp, Dead Code, Bắt lỗi sai bản chất, Type Safety, Render/Fetch thừa)

#### `C-01` — Trùng lặp logic lắp ghép 8 chương, khối đính chính Tứ Hóa 3B và làm sạch Markdown giữa 3 hàm xuất hồ sơ (`HTML`, `Markdown`, `PlainText`)
- **Mảng**: `(C)` Chất lượng code — Trùng lặp code (`src/lib/dossier-chat-ui.ts`)
- **Trạng thái xác minh**: **`[Đã kiểm chứng bằng code]`**
- **Bằng chứng `file:dòng`**:
  - Trong `src/lib/dossier-chat-ui.ts`:
    1. `buildDossierMarkdownExport` (`dòng 1044–1081`)
    2. `buildDossierPlainTextExport` (`dòng 1094–1139`)
    3. `buildDossierStandaloneHtmlExport` (`dòng 1317–1356`)
  - Cả 3 hàm đều lặp lại y hệt chuỗi xử lý cho từng chương trong `DOSSIER_SECTION_DEFS`:
    - Lấy `sec = sections[def.id]`, kiểm tra `rawContent = sec?.content?.trim() ? sec.content : ''`.
    - Gọi `stripInternalDossierMetaLines(sanitizeAiVietnameseOutput(rawContent))`.
    - Kiểm tra `def.id === 'da_xian_current' || def.id === 'liu_nian_current' || def.id === 'liu_nian_next'` để gọi `verifyAndEnsureCompletePeriodSiHua(...)` và `enforceCanonicalPalaceGroupHeadings(...)`.
- **Mức nghiêm trọng**: **Thấp**
- **Hướng sửa / điều chỉnh đề xuất**:
  - Trích xuất 1 hàm nội bộ dùng chung `resolveCleanExportSectionBody(def, sec, periodContexts)` trong `src/lib/dossier-chat-ui.ts` trả về chuỗi văn bản sạch đã qua `stripInternalDossierMetaLines` + `sanitizeAiVietnameseOutput` + `verifyAndEnsureCompletePeriodSiHua` + `enforceCanonicalPalaceGroupHeadings`, rồi gọi hàm này ở cả 3 bộ xuất `Markdown`, `PlainText`, `HTML`.
- **Chi phí & Rủi ro**:
  - Chi phí: Rất thấp (~25 dòng gom hàm trong `dossier-chat-ui.ts`).
  - Rủi ro: Bằng 0; đảm bảo sau này mọi thay đổi hậu kiểm kết xuất chỉ cần sửa ở 1 nơi duy nhất thay vì 3 nơi.
- **Cách kiểm chứng sau sửa**: Chạy lại `npx tsx scripts/verify-dossier-chat-ui.ts` (14/14 test, đặc biệt `TEST-3`, `TEST-4`, `TEST-8`, `TEST-10`).

---

#### `C-02` — Nuốt lỗi hoặc hiển thị thông báo sai bản chất khi API lỗi ở `InsightPanel` (6 tab chủ đề / Vấn đáp), `HemingView` và `DetailedDossierModal`
- **Mảng**: `(C)` Chất lượng code — Bắt lỗi & Thông báo trạng thái AI
- **Trạng thái xác minh**: **`[Đã kiểm chứng bằng code]`**
- **Bằng chứng `file:dòng`**:
  1. **Tại `src/components/DetailedDossierModal.tsx:396–415`**:
     ```ts
     if (!res.ok) {
       let errMsg = 'Chưa cấu hình AI (kho khóa chưa có Gemini API key khả dụng).';
       let errCode = '';
       try {
         const errJson = await res.json();
         if (errJson?.message) errMsg = errJson.message;
         if (errJson?.error) errCode = errJson.error;
       } catch {
         // ignore
       }
       updateSection(sectionId, {
         status: 'error',
         error: errMsg,
         errorCode: errCode,
         notConfigured: res.status === 503 && errCode !== 'AI_POOL_EXHAUSTED',
       });
       return false;
     }
     ```
     Nếu máy chủ gặp lỗi `502 Bad Gateway` / `504 Gateway Timeout` từ reverse proxy (body trả về là HTML chứ không phải JSON nên `res.json()` nhảy vào `catch`), biến `errMsg` giữ nguyên giá trị mặc định: **`"Chưa cấu hình AI (kho khóa chưa có Gemini API key khả dụng)."`** dù thực tế người dùng đã nạp đầy đủ 20 khóa trong Kho Khóa! Tương tự tại `src/components/InsightPanel.tsx:170–179`.
  2. **Tại `server.ts:1045–1048` (`POST /api/interpret`) và `server.ts:1132–1135` (`POST /api/heming`)**:
     ```ts
     } catch (err) {
       if (!anyChunkSent) {
         sendSseText(res, generateLocalInterpretationVi(chart, fallbackPrompt));
       }
     ```
     Khi toàn bộ khóa trong Kho Khóa đều đang `cooldown` (`PoolExhaustedError`) hoặc bị lỗi mạng trước chunk đầu tiên, hai endpoint `/api/interpret` (6 tab chủ đề + ô hỏi đáp cuối `InsightPanel`) và `/api/heming` (Hợp Bàn) **âm thầm nuốt sạch lỗi của Kho Khóa** và trả về văn bản mẫu tĩnh cục bộ (`generateLocalInterpretationVi` / `buildLocalHemingServerFallback`) như thể AI vừa trả lời thành công, không hề báo cho người dùng biết là Kho Khóa đang hết hạn mức/cooldown!
- **Mức nghiêm trọng**: **Trung bình**
- **Hướng sửa / điều chỉnh đề xuất**:
  1. Tại `DetailedDossierModal.tsx:397` và `InsightPanel.tsx:170`: Đổi chuỗi khởi tạo mặc định của `errMsg` khi `!res.ok` theo mã HTTP: chỉ khi `res.status === 503` mới mặc định câu `"Chưa cấu hình AI..."`, còn các mã HTTP khác (`400`, `500`, `502`, `504`) thì đặt mặc định `"Lỗi kết nối máy chủ AI (HTTP ${res.status}). Vui lòng thử lại."`.
  2. Tại `/api/interpret` và `/api/heming`: Gửi kèm cờ meta hoặc thông báo nhỏ để người dùng phân biệt được đâu là "Bản luận giải cơ sở cục bộ (do Kho Khóa đang bận/chưa có key)" và đâu là "Bản luận giải sinh bởi Gemini AI".
- **Chi phí & Rủi ro**: Thấp (~15 dòng code).
- **Cách kiểm chứng**: Giả lập response HTTP 502 không có JSON body, kiểm tra thông báo lỗi không còn báo nhầm là `"Chưa cấu hình AI"`.

---

#### `C-03` — Trùng lặp khai báo kiểu dữ liệu (`GeminiKeyPublicView`, `KeyPoolPublicSnapshot`, `buildLocalHemingFallback`) giữa Frontend và Backend
- **Mảng**: `(C)` Chất lượng code — Type Safety & Bảo trì
- **Trạng thái xác minh**: **`[Đã kiểm chứng bằng code]`**
- **Bằng chứng `file:dòng`**:
  - `src/components/KeyPoolModal.tsx:31–95` khai báo lại thủ công các interface `KeyStatsView`, `GeminiKeyPublicView`, `KeyPoolLogEntryView`, `KeyPoolPublicSnapshot` trùng với `server/key-pool/types.ts:19–116` (nhưng thiếu trường `modelCooldowns?: Record<string, number>` ở dòng `58` của `KeyPoolModal.tsx`).
  - Hàm `buildLocalHemingServerFallback` tại `server.ts:558–585` và `buildLocalHemingFallback` tại `src/components/HemingView.tsx:19–57` trùng lặp cùng một chức năng tạo văn bản Hợp Bàn dự phòng.
  - Trong `src/lib/ziwei/algorithm.ts:221, 521, 560, 561, 610` còn một số ép kiểu `as any` khi giao tiếp với thư viện `iztro` / `lunar-javascript`.
- **Mức nghiêm trọng**: **Thấp**
- **Hướng sửa / điều chỉnh đề xuất**:
  - Bổ sung trường `modelCooldowns?: Record<string, number>` vào `GeminiKeyPublicView` tại `src/components/KeyPoolModal.tsx:58` để đồng bộ kiểu dữ liệu với backend.
- **Chi phí & Rủi ro**: Rất thấp (1 dòng khai báo kiểu).
- **Cách kiểm chứng**: Chạy `npx tsc --noEmit`.

---

#### `C-04` — Khởi tạo `buildChartFromForm(DEFAULT_BIRTH_FORM)` bị gọi lặp 2 lần ngay trong lần render đầu tiên của `AppContent`
- **Mảng**: `(C)` Chất lượng code — Render / Khởi tạo thừa (`src/App.tsx`)
- **Trạng thái xác minh**: **`[Đã kiểm chứng bằng code]`**
- **Bằng chứng `file:dòng`**:
  - `src/App.tsx:51–54`:
    ```ts
    const [chart, setChart] = useState<ZiweiChart>(() => buildChartFromForm(DEFAULT_BIRTH_FORM));
    const [activeSihua, setActiveSihua] = useState<ActiveSihua>(() =>
      buildNatalActiveSihua(buildChartFromForm(DEFAULT_BIRTH_FORM))
    );
    ```
    Và nếu trên URL có query params (`?y=...`), `useEffect` tại `src/App.tsx:109–124` chạy ngay sau mount lại gọi `buildChartFromForm(merged)` lần thứ 3.
  - Tương tự, tại `src/components/InsightPanel.tsx:453–468` và `497–503`: Mỗi khi `chart` hoặc `periodSuffix` đổi, `useEffect` gọi `getFallbackText(activeTopic)` rồi ghi đè vào `setCache`, trong khi ở dòng `611` đã có sẵn `const currentContent = cache[currentKey] ?? getFallbackText(activeTopic);`. Việc ghi `getFallbackText(activeTopic)` vào `cache[topicCacheKey]` ở `InsightPanel.tsx:499–502` còn gây ra **1 lỗi logic phụ**:
    - Tại `InsightPanel.tsx:356`:
      ```ts
      if (cache[cacheKey] && !incompleteTopicKeys[cacheKey] && !customQuestion) return;
      ```
      Vì `useEffect` ở dòng `497–503` đã điền sẵn văn bản tĩnh `getFallbackText(activeTopic)` vào `cache[topicCacheKey]` ngay khi mount, nên `cache[topicCacheKey]` **luôn khác rỗng**! Hệ quả là 6 tab chủ đề (`Tổng Quan Mệnh Cách`, `Sự Nghiệp`, `Tài Bạch`, `Tình Duyên`, `Sức Khỏe`, `Tính Cách`) ở `InsightPanel.tsx:486–495` **chỉ hiển thị văn bản mẫu tĩnh cục bộ mà không bao giờ gọi `/api/interpret`**, trừ khi người dùng bấm vào một Cung trên bàn (`selectedPalace`) hoặc bấm vào một nhãn Tứ Hóa (`selectedMutagen`)!
- **Mức nghiêm trọng**: **Trung bình**
- **Hướng sửa / điều chỉnh đề xuất**:
  1. Tại `src/App.tsx:51–54`: Dùng chung kết quả khởi tạo `chart` cho `buildNatalActiveSihua(chart)`.
  2. Tại `src/components/InsightPanel.tsx`: Xác nhận với chủ dự án xem việc 6 tab chủ đề chỉ hiển thị văn bản tĩnh cục bộ (tránh tốn quota AI tự động khi vừa mở trang) là chủ đích tiết kiệm quota hay cần nút `"Phân tích sâu bằng AI"` theo yêu cầu (on-demand). Hiện tại nút `"Làm mới"` ở `InsightPanel.tsx:635–648` chỉ gọi `setCache(... getFallbackText(activeTopic))` (tính lại hàm tĩnh mất 0ms) chứ cũng không gọi AI!
- **Chi phí & Rủi ro**: Thấp.
- **Cách kiểm chứng**: Kiểm tra hành vi nút `"Làm mới"` và 6 tab chủ đề trên `InsightPanel`.

---

### MẢNG (D) — HIỆU NĂNG (Thời gian sinh Hồ Sơ 8 Chương, Kích thước Bundle, Độ dài Prompt & Token)

#### `D-01` — Sinh tuần tự 8 chương Hồ Sơ mất ~3 đến 9 phút khi mạng/model Google nghẽn tải: Phân tích đánh đổi giữa Tuần tự (QĐ-F1) và Song song có kiểm soát (Concurrency = 2)
- **Mảng**: `(D)` Hiệu năng — Thời gian sinh Hồ Sơ 8 Chương (`DetailedDossierModal.tsx`)
- **Trạng thái xác minh**: **`[Đã kiểm chứng bằng code]`** *(Hành vi tuần tự hiện tại là thiết kế chủ đích theo quyết định F1/F7 để bảo vệ quota)*
- **Bằng chứng `file:dòng`**:
  - `src/components/DetailedDossierModal.tsx:546–586`:
    ```ts
    for (let i = 0; i < targetIds.length; i++) {
      if (batchCancelRef.current) break;
      const secId = targetIds[i];
      ...
      await generateSingleSection(secId);
      if (i < targetIds.length - 1 && !batchCancelRef.current) {
        await sleepWithCancel(DOSSIER_INTER_SECTION_DELAY_MS); // 1200ms
      }
    }
    ```
  - Mỗi chương trong 8 chương yêu cầu sinh bài luận dài (`1.200–2.500` từ, mất trung bình `15–25 giây` khi model thông suốt, và lên tới `45–70 giây` khi gặp `503 UNAVAILABLE` phải failover/continuation). Cộng với `7 × 1,2s = 8,4s` nghỉ giữa các chương, tổng thời gian sinh đủ 8 chương mất từ **2,5 phút** (điều kiện lý tưởng) đến **8–9 phút** (khi Google quá tải cục bộ).
- **Mức nghiêm trọng**: **Trung bình**
- **Hướng sửa / điều chỉnh đề xuất**:
  - **`[Đề xuất MỞ LẠI quyết định F1/F7 — Tuần tự vs Song song 2 luồng khi Kho Khóa dồi dào]`**:
    - **Giữ nguyên tuần tự (`concurrency = 1`)** khi số khóa `ready` trong Kho Khóa `<= 3` (hoặc tất cả khóa đều chung 1 GCP Project) để tránh tự bắn hạ RPM của chính mình.
    - **Cho phép chạy song song tối đa `2 chương cùng lúc` (`concurrency = 2`, lệch pha khởi động `1.500ms`)** KHI VÀ CHỈ KHI Kho Khóa có từ **`>= 4` khóa `ready` thuộc ít nhất 2 GCP Project khác nhau** (hoặc khi người dùng bật tùy chọn `"Tăng tốc 2 luồng"`). Vì `KeyPoolAllocator.acquireLease` (`allocator.ts:345`) đã có sẵn `inFlightPenalty = inFlight * 6` và `roundRobinCursor`, 2 luồng đồng thời sẽ tự động được phân bổ vào 2 khóa khác nhau, giúp **giảm ~45% tổng thời gian chờ** (từ 8 phút xuống ~4,5 phút) mà không làm tăng tổng số token hay số cuộc gọi API.
- **Chi phí & Rủi ro**:
  - Chi phí: Trung bình (~35 dòng điều phối hàng đợi `concurrency = 1 | 2` trong `DetailedDossierModal.tsx`).
  - Rủi ro: Nếu các khóa trong kho chưa được nhận diện `detectedProjectNumber` mà thực chất nằm chung 1 GCP Project miễn phí (giới hạn 15 RPM), chạy 2 luồng song song có thể chạm ngưỡng RPM nhanh hơn một chút (nhưng `allocator` đã có sẵn cơ chế chuyển sang `fallbackModel` và khóa kế tiếp). Do đó cần chủ dự án quyết định có mở lại F1 hay giữ nguyên tuần tự an toàn.
- **Cách kiểm chứng**: Test hàng đợi với `concurrency = 1` và `concurrency = 2`, đảm bảo nút `"Dừng sau chương hiện tại"` (`batchCancelRef`) vẫn dừng sạch không rò rỉ request.

---

#### `D-02` — Độ dài Prompt và lặp lại quy tắc trong các cuộc gọi AI (`server.ts`, `dossier-context.ts`)
- **Mảng**: `(D)` Hiệu năng — Độ dài Prompt & Chi phí Token
- **Trạng thái xác minh**: **`[Đã kiểm chứng bằng code]`**
- **Bằng chứng `file:dòng`**:
  - Trong `server.ts:358–420` (`buildStrictDossierSectionPrompt`) và `server.ts:164–205` (`buildStrictPeriodAiPrompt`): Khối quy tắc chung ~35 dòng (~650 tokens) được ghép vào mỗi chương.
  - Đặc biệt, ở chương `horizon_10y` (`dossier-context.ts:914–1040`), bảng dữ kiện gửi kèm cả:
    - Tóm tắt Bản Mệnh + Bảng ánh xạ 12 cung
    - Toàn bộ 3 Đại Hạn liên tiếp (mỗi Đại Hạn gồm đầy đủ 4 Tứ Hóa + các cung xung/tam hợp)
    - Toàn bộ Ma Trận Lưu Niên 10 năm (`2026–2035`), mỗi năm liệt kê đủ 4 hóa + cung kích hoạt + sao lưu niên (`dossier-context.ts:1004–1025`).
    - Tổng độ dài input prompt của riêng chương `horizon_10y` lên tới ~`3.200–3.800 tokens`, hoàn toàn nằm trong giới hạn context window của Gemini (1M tokens) nhưng làm tăng nhẹ TTFB khoảng `0,5–1,2 giây`.
  - Trong `ContextualChatDrawer` (`server.ts:865–908`), khi hỏi đáp ở chế độ `natal` hoặc `period` (`contextMode !== 'dossier'`), hàm `buildCompactTenYearMatrixVi(chart, 2026, 10)` (`server.ts:870`) **luôn được tính và nhét toàn bộ ma trận 10 năm (`2026–2035`) vào mọi câu hỏi chat**, kể cả khi người dùng chỉ đang hỏi về tính cách cung Phúc Đức Bản Mệnh hoặc hỏi riêng về Lưu Niên 2026!
- **Mức nghiêm trọng**: **Thấp**
- **Hướng sửa / điều chỉnh đề xuất**:
  - **`[Đề xuất MỞ LẠI tối ưu nhẹ cho F2 (Ngữ cảnh 4 lớp của Chat)]`**: Trong `/api/interpret-chat` (`server.ts:870–898`), nếu `periodContext` đã được truyền vào (chế độ `'period'`), hoặc khi câu hỏi ở chế độ `'natal'` không nhắc tới năm `2026–2035`, có thể rút gọn ma trận 10 năm xuống 3 năm gần nhất (`2026–2028`) để tiết kiệm ~500 input tokens mỗi lượt hỏi và giảm độ trễ phản hồi chat.
- **Chi phí & Rủi ro**: Rất thấp (~10 dòng trong `server.ts`).
- **Cách kiểm chứng**: Đo độ dài ký tự prompt của `/api/interpret-chat` trước và sau khi tối ưu.

---

#### `D-03` — Kích thước Bundle & Code Splitting phía Client
- **Mảng**: `(D)` Hiệu năng — Tải trang & Bundle Size
- **Trạng thái xác minh**: **`[Đã kiểm chứng bằng code]`**
- **Bằng chứng `file:dòng`**:
  - `src/App.tsx:9–13`: Tất cả các modal và view lớn (`DetailedDossierModal` 1.314 dòng, `KeyPoolModal` 1.476 dòng, `KnowledgeView`, `HemingView`, `ContextualChatDrawer` 754 dòng) đều được `import` tĩnh ở đầu `src/App.tsx` thay vì `React.lazy()`.
  - Khi người dùng mới vào trang chính (chỉ xem Bàn Tử Vi), trình duyệt vẫn phải tải và parse ngay toàn bộ code của `KeyPoolModal`, `DetailedDossierModal`, `KnowledgeView` và `HemingView`.
- **Mức nghiêm trọng**: **Thấp**
- **Hướng sửa / điều chỉnh đề xuất**:
  - Chuyển `DetailedDossierModal`, `KeyPoolModal`, `KnowledgeView`, `HemingView` sang `React.lazy()` + `<Suspense>` (nếu cần tối ưu tốc độ tải lần đầu trên thiết bị di động mạng chậm).
- **Chi phí & Rủi ro**: Thấp (~15 dòng trong `src/App.tsx`).
- **Cách kiểm chứng**: Chạy `npm run build` (`compile_applet`) và kiểm tra các chunk được tách riêng trong `dist/assets/`.

---

### MẢNG (E) — BẢO MẬT (Lưu trữ Key mã hóa, PIN Gate, Read-Only Shared URL, Chống lộ Key, Kiểm tra đầu vào API)

#### `E-01` — Kiểm tra toàn diện cơ chế mã hóa AES-256-GCM (`crypto-store.ts`) và bộ lọc chống lộ API Key nguyên văn (`sanitizeErrorText`)
- **Mảng**: `(E)` Bảo mật — Lưu trữ khóa & Chống rò rỉ khóa
- **Trạng thái xác minh**: **`[Đã kiểm chứng bằng code — Đạt chuẩn an toàn]`** *(Kèm 1 lưu ý nhỏ về biến môi trường khi triển khai container)*
- **Bằng chứng `file:dòng`**:
  - `server/key-pool/crypto-store.ts:59–119`:
    - Sử dụng `AES-256-GCM` với `iv` ngẫu nhiên 12 bytes (`crypto.randomBytes(12)`) và `authTag` 16 bytes cho từng bản ghi khóa.
    - Khóa chủ (`masterKey`) được dẫn xuất qua `HKDF-SHA256` từ `KEY_POOL_MASTER_SECRET` hoặc sinh ngẫu nhiên 32 bytes lưu tại `.data/.pool-master.key` với quyền `0o600` và ghi nguyên tử qua file `.tmp` (`crypto-store.ts:85–90, 211–215`).
  - `server/key-pool/allocator.ts:31–44`:
    - `sanitizeErrorText` quét và che cả danh sách `knownRawKeys` lẫn regex tổng quát `/AIza[A-Za-z0-9_-]{20,60}/g` trước khi ghi vào `stats.lastErrorMessage`, `recentLogs` hoặc trả về client.
  - `server.ts:1174–1177`: Log khởi động chỉ in độ dài (`geminiApiKeyLength`) và số lượng khóa (`total`, `ready`), tuyệt đối không in key nguyên văn.
  - **Lưu ý nhỏ duy nhất**: Nếu triển khai lên môi trường Cloud Run / container không gắn ổ đĩa bền vững (ephemeral disk) mà chỉ mount file `gemini-key-pool.enc.json` mà quên đặt biến môi trường `KEY_POOL_MASTER_SECRET`, mỗi lần container khởi động lại sẽ sinh `.pool-master.key` mới và không giải mã được file `.enc.json` cũ (`crypto-store.ts:162–165`). Trong môi trường AI Studio hiện tại (`.data/` nằm cùng workspace bền vững), cả 2 file đi cùng nhau nên hoạt động ổn định.
- **Mức nghiêm trọng**: **Thấp**
- **Hướng sửa / điều chỉnh đề xuất**: Ghi chú rõ biến `KEY_POOL_MASTER_SECRET` trong `.env.example` (nếu triển khai đa container).
- **Chi phí & Rủi ro**: 0.
- **Cách kiểm chứng**: Đã kiểm chứng qua `scripts/verify-key-pool.ts` và quét `dist/` (`0` key nguyên văn).

---

#### `E-02` — Cơ chế `isSharedOriginRequest` (Read-Only trên URL `ais-pre-`) và PIN Gate (`KEY_POOL_ADMIN_PIN`) dựa vào HTTP Header có thể bị giả mạo nếu gọi trực tiếp API ngoài trình duyệt
- **Mảng**: `(E)` Bảo mật — Phân quyền quản trị Kho Khóa (`server/key-pool/index.ts`, `server.ts`)
- **Trạng thái xác minh**: **`[Đã kiểm chứng bằng code]`**
- **Bằng chứng `file:dòng`**:
  1. **Tại `server/key-pool/index.ts:27–38` (`isSharedOriginRequest`)**:
     ```ts
     export function isSharedOriginRequest(headers: Record<string, string | string[] | undefined>): boolean {
       const candidates = [
         headers['host'],
         headers['x-forwarded-host'],
         headers['origin'],
         headers['referer'],
       ];
       for (const raw of candidates) {
         const val = Array.isArray(raw) ? raw.join(' ') : raw ?? '';
         if (/https?:\/\/ais-pre-[a-z0-9-]+|^ais-pre-[a-z0-9-]+/i.test(val.trim())) {
           return true;
         }
       }
       return false;
     }
     ```
     Trong môi trường proxy của AI Studio, reverse proxy của Google luôn ghi đè `Host` / `X-Forwarded-Host` chuẩn theo tên miền thực tế (`ais-dev-...` cho chủ dự án và `ais-pre-...` cho người xem bản chia sẻ), nên cơ chế này chặn tốt trên trình duyệt và qua proxy chuẩn.
  2. **Tại `server/key-pool/index.ts:154–160` (`verifyAdminPin`)**:
     ```ts
     public verifyAdminPin(suppliedPin?: string): boolean {
       const expected = this.getAdminPin();
       if (!expected) return true;
       if (!suppliedPin) return false;
       return suppliedPin.trim() === expected;
     }
     ```
     - Phép so sánh `suppliedPin.trim() === expected` dùng toán tử `===` chuỗi thông thường thay vì `crypto.timingSafeEqual`, và không có bộ giới hạn số lần thử PIN sai liên tiếp (rate-limit brute-force PIN) trên các route `/api/key-pool/*` tại `server.ts:69–78`.
     - Ngoài ra, tại `src/components/KeyPoolModal.tsx:239–245`, khi `GET /api/key-pool` được gọi, kể cả khi `KEY_POOL_ADMIN_PIN` được bật (`adminPinRequired = true`), route `GET /api/key-pool` (`server.ts:593–596`) **không gọi `requirePoolMutationAccess`**, nên người xem chưa nhập PIN vẫn nhận được danh sách `maskedKey`, `label`, `detectedProjectNumber` và `recentLogs` trong `KeyPoolPublicSnapshot` (chỉ bị chặn các thao tác thêm/xóa/sửa/test).
- **Mức nghiêm trọng**: **Thấp** *(Vì không bao giờ trả `rawKey` trong `KeyPoolPublicSnapshot`, chỉ có `maskedKey`)*
- **Hướng sửa / điều chỉnh đề xuất**:
  1. Dùng `crypto.timingSafeEqual` trong `verifyAdminPin` (`server/key-pool/index.ts:159`) và thêm bộ đếm khóa tạm 30 giây nếu nhập sai PIN quá 5 lần liên tiếp từ cùng một IP/phiên.
- **Chi phí & Rủi ro**: Rất thấp (~15 dòng trong `server/key-pool/index.ts`).
- **Cách kiểm chứng**: Thêm unit test kiểm tra `verifyAdminPin` với chuỗi khác độ dài / cùng độ dài và kiểm tra khóa tạm sau 5 lần sai.

---

#### `E-03` — Giới hạn kích thước body (`express.json({ limit: '1mb' })`) và thiếu kiểm tra trần độ dài các trường văn bản trong payload `/api/interpret*`
- **Mảng**: `(E)` Bảo mật — Kiểm tra dữ liệu đầu vào (`Input Validation`) tại `server.ts`
- **Trạng thái xác minh**: **`[Đã kiểm chứng bằng code]`**
- **Bằng chứng `file:dòng`**:
  - `server.ts:590`: `app.use(express.json({ limit: '1mb' }));`
  - Trong `/api/interpret-chat` (`server.ts:865–868`), server có cắt gọt an toàn:
    - `safeQuestion = question.trim().slice(0, 400)` (`dòng 865`)
    - `safeExcerpt = typeof excerpt === 'string' ? excerpt.trim().slice(0, 1200) : ''` (`dòng 866`)
    - `safeHistory = Array.isArray(history) ? history.slice(-6) : []` (`dòng 867`), mỗi `content` cắt `.slice(0, 900)` (`dòng 888`).
  - **Tuy nhiên**:
    1. Tại `/api/interpret-period` (`server.ts:654–674`): `periodContext.factTableMarkdown` và `periodContext.deterministicInterpretationMarkdown` được nhận trực tiếp từ `req.body` của client và nối thẳng vào `buildStrictPeriodAiPrompt(chart, periodContext)` (`server.ts:187–190`) mà **không cắt giới hạn độ dài** và không tái tạo lại từ `chart` trên server (khác với `/api/interpret-dossier-section` ở `server.ts:785–798` vốn tự tính lại `periodContext` và `factSheetMarkdown` hoàn toàn trên server!).
    2. Tại `/api/interpret` (`server.ts:955–995`): Trường `question` từ `req.body` không bị giới hạn `.slice(0, 500)` trước khi đưa vào prompt.
- **Mức nghiêm trọng**: **Trung bình**
- **Hướng sửa / điều chỉnh đề xuất**:
  1. Tại `/api/interpret-period` (`server.ts:660–675`): Giới hạn độ dài `factTableMarkdown` (`<= 4.000` ký tự) và `deterministicInterpretationMarkdown` (`<= 4.000` ký tự) hoặc tái tạo trực tiếp `periodContext` trên server giống `/api/interpret-dossier-section` để chống prompt injection / làm phình token từ payload giả mạo.
  2. Tại `/api/interpret` (`server.ts:955`): Cắt `const safeQuestion = typeof question === 'string' ? question.trim().slice(0, 500) : undefined;`.
- **Chi phí & Rủi ro**: Rất thấp (~10 dòng trong `server.ts`).
- **Cách kiểm chứng**: Gửi payload thử nghiệm vào `/api/interpret-period` và `/api/interpret`, kiểm tra độ dài chuỗi được chặn đúng trần.

---

### MẢNG (F) — TRẢI NGHIỆM NGƯỜI DÙNG (UX) & ĐỘ TIN CẬY VẬN HÀNH

#### `F-01` — `HemingView.tsx` (Hợp Bàn Đôi Lứa) bỏ qua hoàn toàn sự kiện `meta`, `interrupted`, `sanitizeAiVietnameseOutput` và tách dòng SSE không có bộ đệm (`sseBuffer`)
- **Mảng**: `(F)` UX & Độ tin cậy vận hành — Giao diện Hợp Bàn (`src/components/HemingView.tsx`)
- **Trạng thái xác minh**: **`[Đã kiểm chứng bằng code]`**
- **Bằng chứng `file:dòng`**:
  - `src/components/HemingView.tsx:118–140`:
    ```ts
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let acc = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') break;
        try {
          const text = JSON.parse(data)?.delta?.text ?? '';
          if (text) {
            acc += text;
            setResult(acc);
          }
        } catch {
          // ignore
        }
      }
    }
    ```
  - Đoạn code trên tại `HemingView.tsx` có **4 khiếm khuyết rõ rệt** so với `InsightPanel.tsx`, `DetailedDossierModal.tsx` và `ContextualChatDrawer.tsx`:
    1. **Mất chunk khi gói TCP cắt ngang dòng JSON SSE (`chunk.split('\n')` không có `sseBuffer`)**: Nếu một frame SSE `data: {"delta":{"text":"..."}}` lớn bị chia làm 2 nửa qua 2 lần `reader.read()`, cả 2 nửa đều lỗi `JSON.parse(data)` và bị khối `catch { // ignore }` vứt bỏ hoàn toàn, làm **mất chữ ngay giữa câu** trong bài luận Hợp Bàn! (Trong khi 3 component kia đều dùng `sseBuffer += decoder.decode(...)` và `sseBuffer = lines.pop() ?? ''`).
    2. **Không hiển thị huy hiệu `meta` (`modelUsed`, `maskedKey`, `usedFallbackModel`, `continuedFromPartial`)**: Dù backend `/api/heming` (`server.ts:1115–1117`) có gửi đầy đủ `sendSseJson(res, { meta })`, `HemingView.tsx` hoàn toàn không đọc `parsed.meta` và không hiển thị dòng thông tin Model/Khóa đã thực thi.
    3. **Không xử lý sự kiện `parsed.interrupted`**: Khi luồng bị đứt giữa chừng, `HemingView` không hiển thị cảnh báo gián đoạn hay nút thử lại.
    4. **Không gọi `sanitizeAiVietnameseOutput(acc)`**: Văn bản Hợp Bàn không đi qua bộ lọc làm sạch lỗi dính chữ tiếng Việt / nhãn kỹ thuật rò rỉ (`text-sanitizer.ts`).
- **Mức nghiêm trọng**: **Cao**
- **Hướng sửa / điều chỉnh đề xuất**:
  - Nâng cấp vòng đọc SSE trong `src/components/HemingView.tsx:118–145` theo đúng chuẩn của `InsightPanel.tsx`:
    1. Dùng `sseBuffer` (`lines.pop()`) để không bao giờ đánh rơi gói JSON bị cắt đôi qua biên TCP chunk.
    2. Lưu `meta` (`AiExecutionMeta`) và hiển thị dòng huy hiệu `Model · Khóa` trên thẻ kết quả Hợp Bàn.
    3. Bắt `parsed.interrupted` để hiện cảnh báo màu hổ phách và nút `"Thử luận giải lại"`.
    4. Áp dụng `sanitizeAiVietnameseOutput` lên văn bản nhận được.
- **Chi phí & Rủi ro**:
  - Chi phí: Thấp (~45 dòng trong `src/components/HemingView.tsx`).
  - Rủi ro: Bằng 0; chỉ sửa lỗi mất chữ SSE và đồng bộ trải nghiệm của tab Hợp Bàn với toàn bộ ứng dụng.
- **Cách kiểm chứng sau sửa**:
  - Kiểm tra tab Hợp Bàn hiển thị đầy đủ `meta`, lọc qua `sanitizeAiVietnameseOutput`, và không mất chữ khi frame SSE bị chia nhỏ.

---

#### `F-02` — Hai luồng phụ trong `InsightPanel.tsx` (`fetchInsight` cho Cung/Tứ Hóa và `handleAsk` cho ô Hỏi nhanh) cũng bỏ qua `parsed.meta`
- **Mảng**: `(F)` UX & Độ tin cậy vận hành (`src/components/InsightPanel.tsx`)
- **Trạng thái xác minh**: **`[Đã kiểm chứng bằng code]`**
- **Bằng chứng `file:dòng`**:
  - Trong `src/components/InsightPanel.tsx`:
    - Luồng `requestPeriodAiInterpretation` (`dòng 217–227, 803–838`) đọc và hiển thị rất đầy đủ `parsed.meta` (`modelUsed`, `maskedKey`, huy hiệu nối tiếp luồng).
    - Tuy nhiên, 2 luồng gọi `/api/interpret` trong cùng file `InsightPanel.tsx` là `fetchInsight` (`dòng 390–409`, dùng khi bấm vào Cung hoặc bấm vào Sao Tứ Hóa) và `handleAsk` (`dòng 534–555`, ô đặt câu hỏi nhanh ở cuối `InsightPanel`) **đều bỏ qua gói `parsed.meta`** dù backend `/api/interpret` (`server.ts:1028–1030`) có gửi xuống.
- **Mức nghiêm trọng**: **Thấp**
- **Hướng sửa / điều chỉnh đề xuất**:
  - Lưu `meta` của lần gọi `fetchInsight` gần nhất để hiển thị dòng nhỏ `Model · Khóa` bên dưới khung luận giải Cung/Tứ Hóa (hoặc khuyến khích người dùng dùng nút `"Hỏi đáp phần này"` mở `ContextualChatDrawer` vốn đã có đầy đủ `meta` và bảo vệ quota 8s).
- **Chi phí & Rủi ro**: Thấp (~15 dòng trong `InsightPanel.tsx`).
- **Cách kiểm chứng**: Bấm chọn 1 cung trên bàn Tử Vi, kiểm tra hiển thị thông tin model/khóa.

---

#### `F-03` — Trải nghiệm đếm ngược Cooldown 8 giây trong `ContextualChatDrawer` và mất bộ nhớ đệm khi đóng/mở tab mới (`sessionStorage`)
- **Mảng**: `(F)` UX & Độ tin cậy vận hành (`src/components/ContextualChatDrawer.tsx`, `src/lib/dossier-chat-ui.ts`)
- **Trạng thái xác minh**: **`[Đã kiểm chứng bằng code]`**
- **Bằng chứng `file:dòng`**:
  1. **Về đếm ngược Cooldown 8 giây (`ContextualChatDrawer.tsx:176–193, 268–271, 739–746`)**:
     - Khi người dùng bấm gửi câu hỏi (`sendQuestion` tại `dòng 268`), `quotaState.lastSentAtMs` được ghi nhận ngay lúc **bắt đầu gửi** (`currentNow`).
     - Trong suốt thời gian câu trả lời đang stream (`streaming === true`, thường kéo dài `8–15 giây`), hàm `evaluateChatQuotaStatus` (`src/lib/dossier-chat-ui.ts:288–299`) ưu tiên nhánh `if (options.isChatStreaming)` trước nhánh `if (cooldownRemainingSec > 0)`, nên nút gửi hiển thị chữ **`"Đang trả lời..."`** thay vì `"Đợi 8s..."`.
     - Đến khi stream trả lời xong (sau 10–15 giây), khoảng thời gian `8 giây` tính từ lúc gửi (`lastSentAtMs`) **đã trôi qua hết trong lúc chờ stream**, nên người dùng hầu như không bao giờ nhìn thấy nút đếm ngược `"Đợi Xs"` trừ khi câu trả lời hoàn tất cực nhanh dưới 8 giây (hoặc bị lỗi ngay lập tức)!
     - Nếu mục đích của quyết định `F7` là tạo khoảng nghỉ **8 giây giữa lúc kết thúc câu trả lời trước và lúc gửi câu hỏi sau** (hoặc hiển thị rõ trạng thái nghỉ bảo vệ quota), việc đặt `lastSentAtMs` ở đầu hàm `sendQuestion` thay vì trong khối `finally` (khi stream kết thúc) làm cho khoảng nghỉ thực tế sau khi stream xong bằng `0 giây` mỗi khi stream kéo dài `>= 8 giây`.
  2. **Về việc lưu Hồ Sơ & Chat trong `sessionStorage` (`dossier-chat-ui.ts:154–163`)**:
     - Theo quyết định `F6`, việc dùng `sessionStorage` (giới hạn LRU 3 hồ sơ, 10 mạch chat) giúp tránh phình `localStorage` vĩnh viễn và tự dọn sạch khi đóng tab.
     - Tuy nhiên, nếu người dùng giữ cùng 1 tab và bấm `F5` (Reload), `sessionStorage` **vẫn còn nguyên**; chỉ khi người dùng **đóng tab hoặc mở link chia sẻ sang tab mới** thì dữ liệu Hồ Sơ 8 Chương vừa chờ 5–8 phút để sinh mới bị mất nếu họ quên bấm `"Tải .html"` / `"Tải .md"`.
- **Mức nghiêm trọng**: **Thấp**
- **Hướng sửa / điều chỉnh đề xuất**:
  - **`[Đề xuất MỞ LẠI chi tiết nhỏ của F7 & F6]`**:
    1. Trong `ContextualChatDrawer.tsx:449–451` (`finally` của `sendQuestion`), cập nhật lại `lastSentAtMs = Date.now()` khi luồng trả lời vừa kết thúc (hoặc đặt cooldown 5–8s tính từ lúc kết thúc câu trả lời) nếu chủ dự án muốn đảm bảo luôn có khoảng nghỉ thực sự giữa 2 cuộc gọi liên tiếp và luôn thấy bộ đếm ngược rõ ràng.
    2. Trong `DetailedDossierModal.tsx`: Thêm một dòng nhắc nhẹ trên thanh công cụ khi đã sinh xong `8/8` chương: *"Hồ sơ được lưu tạm trong phiên tab hiện tại — hãy bấm Tải .html hoặc Tải .md để lưu trữ lâu dài trên máy."*
- **Chi phí & Rủi ro**: Rất thấp (~10 dòng code).
- **Cách kiểm chứng**: Gửi câu hỏi mất 10s để stream, kiểm tra bộ đếm ngược cooldown sau khi stream xong.

---

## 2. BẢNG TỔNG HỢP TOÀN BỘ PHÁT HIỆN THEO MẢNG & MỨC ĐỘ NGHIÊM TRỌNG

### 2.1. Thống kê số lượng phát hiện theo Mảng × Mức độ nghiêm trọng

| Mảng rà soát | Nghiêm trọng | Cao | Trung bình | Thấp | Tổng cộng |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **(A) Tính đúng đắn logic nghiệp vụ** (`A-01`..`A-06`) | 0 | 1 (`A-01`) | 1 (`A-02`) | 4 (`A-03`..`A-06`) | **6** |
| **(B) Logic Kho Khóa & Tầng AI** (`B-01`..`B-06`) | 0 | 2 (`B-04`, `B-05`) | 2 (`B-01`, `B-02`) | 2 (`B-03`, `B-06`) | **6** |
| **(C) Chất lượng code** (`C-01`..`C-04`) | 0 | 0 | 2 (`C-02`, `C-04`) | 2 (`C-01`, `C-03`) | **4** |
| **(D) Hiệu năng** (`D-01`..`D-03`) | 0 | 0 | 1 (`D-01`) | 2 (`D-02`, `D-03`) | **3** |
| **(E) Bảo mật** (`E-01`..`E-03`) | 0 | 0 | 1 (`E-03`) | 2 (`E-01`, `E-02`) | **3** |
| **(F) UX & Độ tin cậy vận hành** (`F-01`..`F-03`) | 0 | 1 (`F-01`) | 0 | 2 (`F-02`, `F-03`) | **3** |
| **TỔNG CỘNG TOÀN HỆ THỐNG** | **0** | **4** | **7** | **14** | **25** |

---

### 2.2. Danh mục chi tiết 25 phát hiện (Sắp xếp theo Mức độ ưu tiên xử lý)

| Mã số | Mảng | Tóm tắt phát hiện | Trạng thái xác minh | Bằng chứng `file:dòng` chính | Mức độ | Có chạm QĐ cũ? |
| :---: | :---: | :--- | :---: | :--- | :---: | :---: |
| **`A-01`** | A | Khóa định danh `buildChartIdentityKey` & `periodContext.cacheKey` thiếu `leapMonthPolicy` / cấu trúc cung Mệnh, gây trùng cache khi đổi chính sách tháng nhuận | Đã kiểm chứng bằng code | `dossier-chat-ui.ts:63–66`, `yunxian-context.ts:298`, `algorithm.ts:480–507` | **Cao** | Không |
| **`B-04`** | B | Bảng dữ kiện kỳ hạn (`yunxian-context.ts`) và chương Tổng quan chưa in sẵn 2 cung Tam Hợp kèm vai trò Lưu/Đại Hạn, khiến AI phải tự nhẩm địa chi tam hợp | Đã kiểm chứng bằng code | `yunxian-context.ts:150–195`, `dossier-context.ts:696–743`, `server.ts:358–378` | **Cao** | Không (Bổ sung củng cố `QĐ-G2`) |
| **`B-05`** | B | `AbortError (code=20)` xảy ra liên tiếp sau khi lượt 1 ngốn gần hết `35s`: `firstChunkTimeoutMs` bị thu hẹp còn vài giây, biến `timedOutWaitingFirstChunk` bị bỏ quên không đọc, làm phạt oan key `-10` điểm & `30s` cooldown | Nghi vấn cần kiểm chứng thêm (Đã có manh mối code trực tiếp) | `executor.ts:176–190, 245–254`, `allocator.ts:158` | **Cao** | Đề xuất MỞ LẠI chi tiết ngân sách tiếp nối (`QĐ-3`) |
| **`F-01`** | F | `HemingView.tsx` tách dòng SSE bằng `chunk.split('\n')` không có `sseBuffer` (dễ mất chữ khi gói TCP cắt đôi), bỏ qua hoàn toàn `parsed.meta`, `parsed.interrupted` và `sanitizeAiVietnameseOutput` | Đã kiểm chứng bằng code | `HemingView.tsx:118–145`, `server.ts:1115–1130` | **Cao** | Không |
| **`A-02`** | A | Lệch tính toán Chân Thái Dương Thời giữa `share.ts` và `buildDossierHeaderMetadata` khi `longitude === undefined` (ép `105.0°E`) hoặc khi chọn thành phố quốc tế ngoài 5 tên cố định | Đã kiểm chứng bằng code | `share.ts:9–18, 52`, `dossier-chat-ui.ts:870, 885`, `true-solar-time.ts:50–105` | **Trung bình** | Không (Làm chuẩn thêm `QĐ-G5`) |
| **`B-01`** | B | Khi luồng bị ngắt và không thể tiếp nối, `executor.ts` vừa gọi `onChunk` chèn câu cảnh báo vào văn bản vừa gọi `onInterrupted`, gây lặp thông báo kép trên UI | Đã kiểm chứng bằng code | `executor.ts:364–375, 408–418`, `server.ts:688–701` | **Trung bình** | Đề xuất MỞ LẠI sửa nhỏ `executor.ts` |
| **`B-02`** | B | Cửa sổ `±140 ký tự` trong `isPeriodSiHuaMentionedInText` (`text-sanitizer.ts`) có nguy cơ dương tính giả khi câu kế bên nhắc Tứ Hóa Bản Mệnh cùng loại của sao khác | Đã kiểm chứng bằng code | `text-sanitizer.ts:103–137` | **Trung bình** | Không (Tinh chỉnh `QĐ-G1/G2`) |
| **`C-02`** | C | Mặc định thông báo `"Chưa cấu hình AI"` khi lỗi HTTP phi-JSON (`502`/`504`) ở `DetailedDossierModal`/`InsightPanel`; `/api/interpret` và `/api/heming` nuốt lỗi hết khóa sang fallback tĩnh không báo hiệu | Đã kiểm chứng bằng code | `DetailedDossierModal.tsx:396–415`, `InsightPanel.tsx:170–179`, `server.ts:1045–1048` | **Trung bình** | Không |
| **`C-04`** | C | `App.tsx` gọi `buildChartFromForm` 2 lần lúc mount; `InsightPanel.tsx` điền sẵn fallback tĩnh vào `cache` lúc mount khiến 6 tab chủ đề và nút `"Làm mới"` không bao giờ gọi AI | Đã kiểm chứng bằng code | `App.tsx:51–54`, `InsightPanel.tsx:356, 486–503, 635–648` | **Trung bình** | Không |
| **`D-01`** | D | Sinh tuần tự 8 chương Hồ Sơ mất 3–9 phút khi mạng nghẽn; đề xuất cân nhắc chế độ song song 2 luồng có điều kiện khi Kho Khóa có `>= 4` khóa khỏe khác project | Đã kiểm chứng bằng code | `DetailedDossierModal.tsx:546–586` | **Trung bình** | Đề xuất MỞ LẠI `F1 / F7` |
| **`E-03`** | E | `/api/interpret-period` nhận trực tiếp `factTableMarkdown` từ body mà chưa cắt trần độ dài hoặc tái tạo trên server; `/api/interpret` chưa cắt trần độ dài `question` | Đã kiểm chứng bằng code | `server.ts:654–674, 955–995` | **Trung bình** | Không |
| **`A-03`** | A | Biến toàn cục `currentBrightSchool` và bảng hằng thừa `DEFAULT_BRIGHTNESS` (57 dòng không dùng) trong `algorithm.ts` | Đã kiểm chứng bằng code | `algorithm.ts:34–95, 115–123` | **Thấp** | Ràng buộc cứng không chạm `algorithm.ts` |
| **`A-04`** | A | Khác biệt ranh giới Lập Xuân (Tứ Trụ Bát Tự) vs Tết Nguyên Đán (Tử Vi) và phép lấy `effHour = hour * 2` trong `calcFourPillars` khi sinh sát phút giao tiết | Nghi vấn cần kiểm chứng thêm | `algorithm.ts:16–24, 219–259` | **Thấp** | Ràng buộc cứng không chạm `algorithm.ts` |
| **`A-05`** | A | `dossier-context.ts` tính thêm Tự Hóa & Phi Tinh Can Cung cho 12 cung trong khi `algorithm.ts` chú thích chỉ hiển thị Tứ Hóa Bản Mệnh trên bàn chính | Đã kiểm chứng bằng code | `algorithm.ts:629–641`, `dossier-context.ts:458–480`, `yunxian-context.ts:448–449` | **Thấp** | Không |
| **`A-06`** | A | `chatDrawerContext` giữ bản chụp tĩnh `excerptVi` tại thời điểm bấm mở ngăn Chat; nếu mở khi `InsightPanel` đang stream có thể chụp nhầm văn bản fallback | Đã kiểm chứng bằng code | `App.tsx:70–71`, `InsightPanel.tsx:969–989`, `DetailedDossierModal.tsx:969–984` | **Thấp** | Không |
| **`B-03`** | B | `sanitizeLayer3AOnly` chỉ tách từ dính trước chữ `đ` thường; có thể bổ sung tách chữ thường có dấu tiếng Việt dính sát trước chữ IN HOA (`"vàoĐại"`, `"củaThiên"`) | Đã kiểm chứng bằng code | `text-sanitizer.ts:38–39, 63` | **Thấp** | Đề xuất MỞ LẠI bổ sung nhỏ `QĐ-G1` |
| **`B-06`** | B | Khi model chính lỗi nhưng model dự phòng thành công trên cùng 1 khóa, `lastErrorType` vẫn lưu tên lỗi của model chính sau khi `recordSuccess` chạy | Đã kiểm chứng bằng code | `allocator.ts:574–681`, `executor.ts:293, 320` | **Thấp** | Không |
| **`C-01`** | C | Ba hàm kết xuất Hồ Sơ (`Markdown`, `PlainText`, `HTML`) lặp lại cùng một khối xử lý hậu kiểm 3A/3B và tiêu đề chương | Đã kiểm chứng bằng code | `dossier-chat-ui.ts:1044–1081, 1094–1139, 1317–1356` | **Thấp** | Không |
| **`C-03`** | C | `KeyPoolModal.tsx` khai báo lại interface `GeminiKeyPublicView` thiếu trường `modelCooldowns`; trùng hàm fallback Hợp Bàn giữa client và server | Đã kiểm chứng bằng code | `KeyPoolModal.tsx:31–95`, `server.ts:558–585`, `HemingView.tsx:19–57` | **Thấp** | Không |
| **`D-02`** | D | `/api/interpret-chat` luôn ghép toàn bộ Ma Trận Lưu Niên 10 năm (`2026–2035`) vào prompt kể cả khi câu hỏi chỉ hỏi về Bản Mệnh hoặc 1 năm cụ thể | Đã kiểm chứng bằng code | `server.ts:870–898`, `dossier-context.ts:914–1040` | **Thấp** | Đề xuất MỞ LẠI tối ưu nhẹ `F2` |
| **`D-03`** | D | Tất cả modal và view lớn (`DetailedDossierModal`, `KeyPoolModal`, `HemingView`, `KnowledgeView`) đều import tĩnh trong `App.tsx` | Đã kiểm chứng bằng code | `App.tsx:9–13` | **Thấp** | Không |
| **`E-01`** | E | Lưu ý vận hành khi triển khai container không có ổ đĩa bền vững nếu thiếu biến `KEY_POOL_MASTER_SECRET` (cơ chế AES-256-GCM và che key hiện tại đã chuẩn) | Đã kiểm chứng bằng code | `crypto-store.ts:59–119`, `allocator.ts:31–44` | **Thấp** | Không |
| **`E-02`** | E | `verifyAdminPin` dùng `===` thay vì `timingSafeEqual` và chưa có giới hạn số lần nhập sai PIN liên tiếp (rate-limit brute-force PIN) | Đã kiểm chứng bằng code | `server/key-pool/index.ts:27–38, 154–160`, `server.ts:69–78` | **Thấp** | Không |
| **`F-02`** | F | Hai luồng phụ trong `InsightPanel.tsx` (`fetchInsight` khi chọn Cung/Tứ Hóa và `handleAsk`) bỏ qua gói `parsed.meta` từ `/api/interpret` | Đã kiểm chứng bằng code | `InsightPanel.tsx:390–409, 534–555`, `server.ts:1028–1030` | **Thấp** | Không |
| **`F-03`** | F | Cooldown 8s của Chat tính từ lúc *bắt đầu gửi* (`lastSentAtMs`) nên bị trôi hết trong lúc chờ stream trả lời (10–15s); nhắc người dùng tải file Hồ Sơ trước khi đóng tab (`sessionStorage`) | Đã kiểm chứng bằng code | `ContextualChatDrawer.tsx:176–193, 268–271`, `dossier-chat-ui.ts:288–299` | **Thấp** | Đề xuất MỞ LẠI tinh chỉnh nhỏ `F6 / F7` |

---

## 3. DANH SÁCH CÁC NGHI VẤN CHƯA KIỂM CHỨNG ĐẦY ĐỦ & KẾ HOẠCH XÁC MINH

| Mã nghi vấn | Nội dung nghi vấn | Manh mối hiện có trong code | Cách kiểm chứng / Kịch bản test cần chạy |
| :---: | :--- | :--- | :--- |
| **`NV-01`** *(Thuộc `B-05`)* | Nguyên nhân chính xác gây chuỗi lỗi `"AbortError: This operation was aborted \| code=20"` ở các lượt thử sau trong `executor.ts` là do `timeoutHandle` (`firstChunkTimeoutMs = Math.min(12000, remainingBudgetMs)` bị thu hẹp còn vài giây khi lượt 1 đã chạy ~28–32s) hay do `@google/genai` / `undici` tự hủy khi Google ngắt kết nối? | - `executor.ts:176–190` đặt `firstChunkTimeoutMs = Math.min(12_000, remainingBudgetMs)` và gán `timedOutWaitingFirstChunk = true` khi hết giờ, nhưng ở `catch (err)` (`dòng 245`) lại **không đọc biến `timedOutWaitingFirstChunk`**!<br>- Khi `attemptAbort.abort(...)` kích hoạt, `undici` ném `DOMException('This operation was aborted', 'AbortError')` (`code=20`), bị `allocator.ts:158` xếp vào `NETWORK_OR_5XX` và phạt oan key `-10` điểm + `30s` cooldown. | 1. Viết test mô phỏng trong `scripts/verify-key-pool.ts` với stream giả lập của `@google/genai` / `AbortController` khi `remainingBudgetMs = 2500ms` và TTFB = `3500ms`.<br>2. In kèm cờ `timedOutWaitingFirstChunk`, `firstChunkTimeoutMs` và `elapsedMs` vào thông điệp chẩn đoán khi bắt được `AbortError`. |
| **`NV-02`** *(Thuộc `A-04`)* | Hành vi của `iztro` và `lunar-javascript` đối với các ca sinh biên: (a) Sinh trong khoảng giữa tiết Lập Xuân và Tết Nguyên Đán; (b) Sinh đúng ngày 15 tháng nhuận âm lịch dưới 3 chính sách `split`, `current`, `next`; (c) Sinh đúng giờ giao tiết Lập Xuân khi `calcFourPillars` dùng `effHour = hour * 2`. | - `algorithm.ts:221–222` dùng năm âm lịch theo Tết Nguyên Đán cho Tử Vi, còn `algorithm.ts:234–247` dùng `eightChar` (mốc Lập Xuân) với `effHour = hour * 2` cho Bát Tự Tứ Trụ.<br>- `algorithm.ts:480–500` xử lý tháng nhuận bằng cách dịch `adjustedMonth`. | Viết bộ test offline không tốn quota chạy qua 3 bộ dữ liệu biên nói trên, xuất bảng so sánh Tứ Trụ, Cục, Mệnh/Thân và 14 chính tinh để đối chiếu học thuật. |
| **`NV-03`** *(Thuộc `B-02`)* | Tần suất xảy ra dương tính giả (False Positive) của `isPeriodSiHuaMentionedInText` với cửa sổ `±140 ký tự` trên các lá số có sao Lưu Hóa Lộc/Quyền/Khoa/Kỵ đồng cung với sao có Tứ Hóa Bản Mệnh cùng loại. | `text-sanitizer.ts:127–132` quét `windowText` dài tới `~288 ký tự` không chặn bởi dấu chấm câu `.` hay xuống dòng `\n`. | Chạy test kiểm thử với đoạn văn mẫu có 2 sao đồng cung (Sao A mang Lưu Hóa Lộc bị AI bỏ quên, Sao B mang Hóa Lộc Bản Mệnh được AI nhắc tới ở câu liền kề cách 70 ký tự) để đo chính xác hành vi trước và sau khi thu hẹp cửa sổ. |
| **`NV-04`** *(Thuộc `D-01`)* | Nếu bật chế độ sinh Hồ Sơ song song 2 chương (`concurrency = 2`) trên kho 20 khóa thực tế của chủ dự án, tỷ lệ chạm `429 RATE_LIMIT_RPM` do các khóa dùng chung GCP Project ẩn là bao nhiêu? | Khi khóa mới nhập vào kho, `detectedProjectNumber` ban đầu là `null` (`crypto-store.ts:237`) và chỉ được điền khi khóa đó gặp lỗi 429 lần đầu có chứa chuỗi `project_number` từ Google (`allocator.ts:56–70`). | Kiểm tra snapshot hiện tại của Kho Khóa xem có bao nhiêu khóa đã biết `detectedProjectNumber` và thử nghiệm mô phỏng phân bổ `acquireLease` với 2 luồng đồng thời. |
