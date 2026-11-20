# BIÊN BẢN PHẢN BIỆN TỔ CHUYÊN GIA: KẾ HOẠCH VÁ LỖI RÒ DỮ LIỆU CHÉO CHƯƠNG 5/6 (`docs/chart-library-cross-chart-leak-expert-panel-review.md`)

- **Loại tài liệu**: `[Biên bản Phản biện & Tối ưu hóa Kỹ thuật — Tổ Chuyên Gia 5 Vai]`
- **Hình thức thực hiện**: **Mô phỏng đa vai trong một phiên làm việc duy nhất (Single-Session Simulated Multi-Role Expert Panel)**
- **Ngày thực hiện**: `18/11/2026`
- **Tài liệu đầu vào được thẩm định**: `docs/chart-library-cross-chart-leak-fix-plan.md` (Bản V1)
- **Tài liệu đầu ra sau thẩm định**: `docs/chart-library-cross-chart-leak-fix-plan.md` (**Bản POST-PANEL V2**)
- **Phiên bản mã nguồn đối chiếu (Code SSOT)**: `1.2.0-rc.1` (chưa sửa code trong lượt này)
  - `src/lib/chart-library.ts` (`dòng 815–927, 1232–1558, 1616–1995, 2019–2051, 2482–2558`)
  - `src/lib/dossier-chat-ui.ts` (`dòng 65–86, 170–197, 257–378, 863–933`)
  - `src/lib/ziwei/text-sanitizer.ts` (`dòng 113–217`)
  - `src/components/DetailedDossierModal.tsx` (`dòng 134–310, 347–780, 842`)
  - `src/components/ChartLibraryModal.tsx` (`dòng 829–884`)
  - `src/App.tsx` (`dòng 77, 142–188, 488–507, 546–576, 652–702`)
  - `scripts/verify-chart-library.ts` (`dòng 203–786`)

---

## 1. Thành Phần Tổ Chuyên Gia Mô Phỏng (Trong Cùng Một Phiên)

1. **Vai 1 — Kiến trúc sư Lưu trữ Phía Client (`Client Storage Architect`)**: Phụ trách kiến trúc 4 tầng (`IndexedDB`, gương RAM `inMemoryDossierMirror`, `localStorage` chỉ mục + hot cache, `sessionStorage` write-through mirror), bất biến `ĐC-1..ĐC-5`, và đồng bộ `aiPeriodCache`.
2. **Vai 2 — Chuyên gia Chất lượng Dữ liệu & Di trú (`Data Quality & Migration Specialist`)**: Phụ trách logic di trú `migrateLegacyHistoryAndDossiers`, thuật toán hợp nhất `mergeDossierRecords`, hậu kiểm `sanitizeFullDossierRecord` / `verifyAndEnsureCompletePeriodSiHua`, và xử lý dữ liệu đã nhiễm.
3. **Vai 3 — Chuyên gia React State & Vòng đời Component (`React State & Lifecycle Specialist`)**: Phụ trách vòng đời state trong `DetailedDossierModal.tsx`, `App.tsx`, `ChartLibraryModal.tsx`, chống race condition khi hydration và khi đang stream SSE.
4. **Vai 4 — Chuyên gia Kiểm thử (`QA & Verification Engineer`)**: Phụ trách bộ kiểm thử tự động `scripts/verify-chart-library.ts` (`TEST-L01..L17`) và bảo đảm không lọt kịch bản hồi quy.
5. **Vai 5 — Luật sư An toàn Dữ liệu Người dùng (`User Data Safety Advocate`)**: Bảo vệ nguyên tắc bất khả xâm phạm dữ liệu người dùng (không xóa ngầm, không đoán mò khóa, có đường khôi phục rõ ràng).

---

## 2. Tổng Hợp Kết Quả Rà Soát По Mức Độ Nghiêm Trọng

| Mã phát hiện | Nguồn Agenda | Vai nêu chính | Mức độ | Tóm tắt phát hiện | Kết luận xử lý |
|---|---|---|---|---|---|
| **`LK-01`** | `ĐP-1` | Chuyên gia Kiểm thử | **CAO** | Bản V1 gộp 2 kịch bản di trú vào `TEST-L13` và đẩy lệch mã số `TEST-L14`/`TEST-L15` so với brief gốc. Cần tách thành 4 bài kiểm thử độc lập (`TEST-L13..TEST-L16`) + `TEST-L17` cho luồng xóa hồ sơ. | **CHẤP NHẬN & SỬA TRONG V2** |
| **`LK-02`** | `ĐP-2` | Chuyên gia Kiểm thử & Chuyên gia Di trú | **TRUNG BÌNH** | `TEST-L04` (`scripts/verify-chart-library.ts:359–366`) đang assert hành vi Bậc 2 (gắn khóa 5 thành phần vào khóa 9 thành phần). Rà toàn bộ `TEST-L01..L12` xác nhận chỉ `TEST-L04` bị ảnh hưởng. | **CHẤP NHẬN & SỬA TRONG V2** |
| **`LK-03`** | `ĐP-3` | Luật sư An toàn Dữ liệu & Chuyên gia Di trú | **NGHIÊM TRỌNG** | Phương án A/C3 của `QĐ-L8` (tự động gỡ chương trùng văn bản `>= 200` ký tự) là thao tác phá hủy dữ liệu có nguy cơ xóa nhầm dữ liệu hợp lệ và xóa nhầm chính chủ thật do `section.updatedAt` bằng nhau và `entry.createdAt` có thể đảo chiều. | **BÁC BỎ XÓA TỰ ĐỘNG NGẦM (`QĐ-L8` Phương án A); CHỐT PHƯƠNG ÁN B TĂNG CƯỜNG (`C1+`)** |
| **`LK-04`** | `ĐP-4` | Kiến trúc sư Lưu trữ | **CAO** | Bản V1 dùng lẫn thuật ngữ `'dossier_only'` giữa (1) hồ sơ mồ côi trong `sessionStorage` không có `BirthFormState` và (2) tham số `deleteMode: 'dossier_only'` đã có sẵn trong `removeLibraryEntry` & `ChartLibraryModal`. | **CHẤP NHẬN & LÀM RÕ TRONG V2** |
| **`LK-05`** | `ĐP-5` | Kiến trúc sư Lưu trữ & Chuyên gia Di trú | **CAO** | Trong `QĐ-L9`, `migrateLegacyHistoryAndDossiers` chạy mỗi lần mở app đang: (1) không kiểm tra `deletedTombstones` khiến lá số đã xóa nhưng còn trong `ziwei_history` bị hồi sinh; (2) ghi lại `persistDossierToTargets` và `writeLibraryIndexStore` ngay cả khi không có chương mới, làm trôi `updatedAt`. | **CHẤP NHẬN & SỬA TRONG V2 (Chốt `QĐ-L9` Phương án A có cổng bảo vệ)** |
| **`LK-06`** | `ĐP-6` | Chuyên gia React State & Vòng đời | **NGHIÊM TRỌNG** | Mục vá 3 trong `DetailedDossierModal.tsx` có nguy cơ race condition: khi `hydrationStatus` đổi sang `'ready'` hoặc prop `chart` tạo tham chiếu mới cùng khóa, `setLocalChapters(next)` hoặc `setLocalChapters({})` có thể xóa mất chương đang stream (`'loading'`) hoặc vừa sinh xong; đồng thời khi đổi lá số chưa gọi `stopAllGeneration()`. | **CHẤP NHẬN & SỬA THIẾT KẾ MỤC VÁ 3 TRONG V2** |
| **`LK-07`** | `ĐP-7` | Chuyên gia Chất lượng Dữ liệu | **TRUNG BÌNH** | Khẳng định trong V1 rằng `sanitizeFullDossierRecord` *luôn* gắn thêm bảng Lưu Niên Tứ Hóa của lá số mới vào cuối Chương 5/6 bị rò là chưa chính xác hoàn toàn: `verifyAndEnsureCompletePeriodSiHua` (`src/lib/ziwei/text-sanitizer.ts:192–200`) chỉ nối thêm khi thiếu $\ge 1$ sao Lưu Hóa trong văn bản. Nếu bản gốc của Người A đã có đủ 4 sao (hoặc đã có khối `> 📌` của Người A), khối cung vị của Người A được giữ nguyên bên trong bản ghi của Người B. | **CHẤP NHẬN & ĐÍNH CHÍNH TRONG V2** |
| **`LK-08`** | `ĐP-8` | Luật sư An toàn Dữ liệu | **CAO** | Cần cơ chế an toàn khôi phục rõ ràng khi dọn dữ liệu nhiễm: Không xóa tự động ngầm khi khởi động; khi người dùng chủ động bấm xóa chương hoặc xóa hồ sơ nhiễm trong UI, hỗ trợ hoàn tác trong phiên (`undo`) hoặc xuất `.JSON` trước khi xóa. | **CHẤP NHẬN & TÍCH HỢP VÀO V2** |
| **`LK-09`** | *Phát hiện mới của Panel* | Chuyên gia React State & Kiến trúc sư Lưu trữ | **CAO** | **Lỗi "Bóng ma Chương 5/6 sau khi xóa hồ sơ (`dossier_only`)"**: Khi người dùng xóa hồ sơ trong `ChartLibraryModal` (`src/App.tsx:695`), `removeLibraryEntry` xóa ở 4 tầng lưu trữ nhưng `App.tsx` **không xóa `aiPeriodCache`** của lá số đó, và `DetailedDossierModal.tsx` (luôn mount tại `App.tsx:652`, `if (!open) return null` ở `dòng 842`) không có `open` trong dependency array của `useEffect` (`dòng 257`), khiến mở lại modal vẫn hiện nguyên Chương 5/6 đã xóa! | **CHẤP NHẬN & BỔ SUNG MỤC VÁ 3B TRONG V2** |
| **`LK-10`** | *Phát hiện mới của Panel* | Kiến trúc sư Lưu trữ | **TRUNG BÌNH** | `getDossierReadState` (`src/lib/chart-library.ts:1891–1919`) và `readDossierCacheEntry` (`src/lib/dossier-chat-ui.ts:301–306`) khi đọc từ `hotCache` / `sessionStorage` chưa đối chiếu `parsed.chartIdentityKey === chartIdentityKey` trước khi gọi `sanitizeFullDossierRecord`, có thể hợp thức hóa bản ghi lệch khóa nội bộ. | **CHẤP NHẬN & BỔ SUNG CHỐT CHẶN TRONG V2** |

---

## 3. Chi Tiết Thảo Luận & Phản Biện Từng Phát Hiện (`LK-01` → `LK-10`)

### `LK-01` (`ĐP-1`): Tách Bạch Ma Trận Kiểm Thử Hồi Quy Đủ 4 Kịch Bản Cốt Lõi + 1 Kịch Bản Làm Sạch
- **Vai nêu**: Chuyên gia Kiểm thử (`Vai 4`).
- **Mức độ**: **CAO**.
- **Bằng chứng trên tài liệu V1**:
  - Tại Mục `5.2` của bản V1 (`dòng 553–583`), `TEST-L13` gộp chung cả kịch bản trùng 5 thành phần (`fivePartCount === 1`) lẫn kịch bản tên rỗng `'anon'`, rồi đặt `TEST-L14` cho `resolveDossierChapterFromCaches` và `TEST-L15` cho đổi lá số lúc chưa hydrated.
  - Cách gộp này khiến khi 1 trong 2 nhánh của `TEST-L13` lỗi thì khó định vị tức thì, và lệch thứ tự phân công ban đầu (`TEST-L13` = 5-part unique; `TEST-L14` = `nameSlug` / `'anon'`; `TEST-L15` = đổi lá số lúc chưa hydrated).
- **Kết luận xử lý (Đồng thuận 5/5 — CHẤP NHẬN & SỬA TRONG V2)**:
  - Thiết lập ma trận kiểm thử tách bạch hoàn toàn trong `scripts/verify-chart-library.ts` (nâng tổng số test từ `12` lên **`17` bài test** `TEST-L01..TEST-L17`):
    1. **`TEST-L13`**: Di trú trùng khóa 5 thành phần (`legacyFivePartKey`) với nhóm duy nhất trong `ziwei_history` (`fivePartCount === 1`, khi chủ thật của hồ sơ trong `sessionStorage` đã rơi khỏi top-10 `ziwei_history`) $\rightarrow$ tuyệt đối không gắn chéo.
    2. **`TEST-L14`**: Di trú trùng `nameSlug` (cùng tên tiếng Việt có/không dấu, chuỗi con `nameSlug`, và cả hai cùng để trống tên `'anon'`) nhưng khác phút sinh / kinh độ / `unknownTime` / cung Mệnh $\rightarrow$ tuyệt đối không gắn chéo.
    3. **`TEST-L15`**: Đổi lá số (`chartIdentityKey` thay đổi) trong lúc `IndexedDB` chưa hydrated (`hydrationStatus === 'hydrating'`, `isHydrated === false`) $\rightarrow$ không rò chương của lá số cũ sang lá số mới cả trước và sau khi nhả cổng `releaseIdbGate()`, đồng thời bảo toàn chương được ghi hợp lệ trong lúc hydrating.
    4. **`TEST-L16`**: Hàm `resolveDossierChapterFromCaches` bỏ qua hoàn toàn `localChapters` lệch `sectionCacheKey` ở **CẢ nhánh kỳ hạn (`year_2026`, `year_2027` ở mọi trạng thái `'completed'`, `'incomplete'`, `'loading'`) VÀ nhánh thường (`chapter_overview`, `palaces_core`, `palaces_family`, `palaces_social_health`, `horizon_5y`, `horizon_10y`)**.
    5. **`TEST-L17`** *(mới từ `LK-05` & `LK-09`)*: Xóa hồ sơ (`deleteMode: 'dossier_only'`) hoặc xóa 1 chương đơn lẻ (`removeSingleDossierChapterFromLibrary`) xóa sạch dữ liệu ở cả 4 tầng lưu trữ, và mục đã xóa vĩnh viễn (`entry_and_dossier`) còn nằm trong `ziwei_history` không bao giờ bị `migrateLegacyHistoryAndDossiers` hồi sinh.

---

### `LK-02` (`ĐP-2`): Giải Phẫu `TEST-L04` Và Rà Soát Toàn Bộ `TEST-L01..TEST-L12`
- **Vai nêu**: Chuyên gia Kiểm thử (`Vai 4`) & Chuyên gia Chất lượng Dữ liệu/Di trú (`Vai 2`).
- **Mức độ**: **TRUNG BÌNH**.
- **Bằng chứng trên code thật (`scripts/verify-chart-library.ts:203–786`)**:
  1. **Giải phẫu `TEST-L04` hiện tại (`scripts/verify-chart-library.ts:331–367`)**:
     ```ts
     // scripts/verify-chart-library.ts:358-366
     assert.equal(store.entries[0].chartIdentityKey, canonicalKey);
     assert.equal(store.entries[0].dossierSummary.completedCount, 2);
     assert.deepEqual(store.entries[0].dossierSummary.completedChapterIds, [
       'chapter_overview',
       'horizon_5y',
     ]);
     const idbRec = await idb.get(canonicalKey);
     assert.ok(idbRec);
     assert.equal(idbRec.chartIdentityKey, canonicalKey);
     ```
     - Trong `TEST-L04`, hồ sơ trong `sessionStorage` được lưu dưới khóa 5 thành phần `ziwei_dossier_v1::1988_7_19_7_male` (`fivePartKey`), trong khi lá số trong `ziwei_history` có khóa 9 thành phần `canonicalKey`.
     - Khi bỏ Bậc 2 (`orphanDossiers.has(legacyFivePartKey)`) và Bậc 3, **4 khẳng định tại dòng `359–366` sẽ lập tức FAIL** vì `legacy5PartDossier` không còn được phép gắn mù vào `canonicalKey`.
     - **Khẳng định mới bắt buộc cho `TEST-L04` trong bản V2**:
       - `assert.equal(store.entries[0].chartIdentityKey, canonicalKey);` (lá số trong `ziwei_history` vẫn được di trú thành thẻ thư viện).
       - `assert.equal(store.entries[0].dossierSummary.completedCount, 0);` (hồ sơ khóa 5 thành phần mơ hồ **không** bị gắn vào `canonicalKey`).
       - `assert.deepEqual(store.entries[0].dossierSummary.completedChapterIds, []);`
       - `assert.equal(await idb.get(canonicalKey), null);` (`IndexedDB` của `canonicalKey` hoàn toàn sạch).
       - `assert.ok(ss.getItem(buildDossierStorageKey(fivePartKey)));` (bản ghi 5 thành phần cũ trong `sessionStorage` vẫn được bảo toàn nguyên trạng tại chỗ, không bị xóa mất).
  2. **Rà soát toàn bộ 11 bài kiểm thử còn lại (`TEST-L01..L03`, `TEST-L05..L12`)**:
     - `TEST-L01` (`dòng 204–239`): Dùng `upsertChartToLibrary` với khóa 9 thành phần. Không dùng khóa 5 thành phần.
     - `TEST-L02` (`dòng 242–273`): Dùng `upsertChartToLibrary` + `saveDossierSectionToLibrary` (khóa 9 thành phần).
     - `TEST-L03` (`dòng 276–329`): Lưu hồ sơ vào `sessionStorage` bằng `key1 = buildChartIdentityKey(chart1)` (khóa 9 thành phần chính xác). Chỉ đi qua Bậc 1 (`orphanDossiers.has(chartIdentityKey)`). Giữ nguyên 100%.
     - `TEST-L05` (`dòng 370–412`): Dùng `key = buildChartIdentityKey(chart)` (khóa 9 thành phần).
     - `TEST-L06` (`dòng 415–459`): Dùng `keyX = buildChartIdentityKey(chartX)` (khóa 9 thành phần).
     - `TEST-L07` (`dòng 462–496`): Dùng `keyX` (khóa 9 thành phần).
     - `TEST-L08` (`dòng 499–583`): Dùng khóa 9 thành phần.
     - `TEST-L09` (`dòng 586–608`): Dùng khóa 9 thành phần.
     - `TEST-L10` (`dòng 611–690`): Phần tử `dirtyBundle.entries[0]` có `legacyFivePartKey: '1995_2_31_5_male'` nhưng ngày sinh là `31/02/1995` nên bị loại ngay tại `isReasonableBirthForm` (`src/lib/chart-library.ts:2235`). Phần tử hợp lệ `entries[1]` dùng `validKey = buildChartIdentityKey(validChart)` (khóa 9 thành phần).
     - `TEST-L11` (`dòng 693–755`): Dùng `key = buildChartIdentityKey(chart)` (khóa 9 thành phần).
     - `TEST-L12` (`dòng 758–785`): Dùng `key` 9 thành phần.
- **Kết luận xử lý (Đồng thuận 5/5 — CHẤP NHẬN & SỬA TRONG V2)**:
  - Chỉ cần cập nhật đúng `TEST-L04` theo đặc tả trên; 11 bài `TEST-L01..L03, L05..L12` giữ nguyên không đổi một dòng nào.

---

### `LK-03` (`ĐP-3`): Phản Biện & Bác Bỏ Phương Án Tự Động Gỡ Chương Trùng Văn Bản (`QĐ-L8` Phương án A/C3)
- **Vai nêu**: Luật sư An toàn Dữ liệu Người dùng (`Vai 5`) & Chuyên gia Chất lượng Dữ liệu/Di trú (`Vai 2`).
- **Mức độ**: **NGHIÊM TRỌNG (CRITICAL — Rủi ro phá hủy dữ liệu người dùng)**.
- **Phân tích 4 điểm chí mạng của Phương án A/C3 trong `QĐ-L8`**:
  1. **Kịch bản hợp lệ mà 2 bản ghi khác `chartIdentityKey` có cùng đoạn văn bản chương `>= 200` ký tự**:
     - Khóa 9 thành phần (`src/lib/ziwei/yunxian-context.ts:292–310`) có dạng:
       `${year}_${month}_${day}_${hour}_${gender}__${nameSlug}__mg${mingGongBranch}__${leapFlag}__${origSig}__${lonSig}`.
     - Nếu người dùng lập lá số cho chính mình lúc đầu để trống tên (`nameSlug = 'anon'`), sinh 8 chương, xuất `.JSON`, sau đó lập lại lá số có điền họ tên đầy đủ (`nameSlug = 'nguyen-van-an'`) hoặc chỉnh phút sinh từ `10:15` sang `10:20` (vẫn cùng canh giờ Tỵ, cùng 12 cung lá số Tử Vi nhưng khác `origSig = 10_15` vs `10_20`) và gộp/sao chép chương sang: cả hai bản ghi đều hoàn toàn hợp lệ nhưng có `chartIdentityKey` khác nhau và văn bản chương giống nhau `100%`.
     - Hoặc hai anh chị em sinh đôi cùng ngày giờ sinh và nơi sinh (chỉ khác `nameSlug`) mà người dùng chủ động tham khảo chung luận giải Lưu Niên.
  2. **Sự sụp đổ của tiêu chí "bản ghi tạo muộn hơn" (Timestamp Ambiguity)**:
     - Trong `src/lib/chart-library.ts:850` (`sanitizeFullDossierRecord`), trường `section.updatedAt` của chương bị gắn nhầm được giữ nguyên từ `val.updatedAt` của bản gốc:
       `updatedAt: val.updatedAt ?? record.updatedAt ?? Date.now()`.
       Nghĩa là `sectionA.updatedAt` và `sectionB.updatedAt` **bằng nhau tuyệt đối tới từng mili-giây**!
     - Nếu xét `record.updatedAt`: Khi `migrateLegacyHistoryAndDossiers` chạy (`src/lib/chart-library.ts:1309–1315`), `mergeDossierRecords` tính `maxUpdatedAt` từ các chương hoặc `Date.now()`, khiến `record.updatedAt` của bản nhiễm bị ghi đè bởi bước di trú.
     - Nếu xét `entry.createdAt` trong `ziwei_chart_library_v1`: Kịch bản rò chéo xảy ra chính khi **Người A (chủ thật) đã rơi khỏi top-10 `ziwei_history`** (tức Người A chưa có mặt trong `ziwei_chart_library_v1`, chỉ còn hồ sơ trong `sessionStorage`), còn Người B (bản nhiễm) được tạo trước trong `ziwei_chart_library_v1` (`entryB.createdAt = T1`). Nếu sau đó người dùng mới nhập lại lá số của Người A vào thư viện (`entryA.createdAt = T2 > T1`), thì **chủ thật (Người A) lại có `createdAt` muộn hơn Người B**! Thuật toán "gỡ chương khỏi bản ghi tạo muộn hơn" sẽ **xóa mất hồ sơ của chính chủ thật (Người A) và giữ lại hồ sơ ở Người B**!
  3. **Vi phạm nguyên tắc không xóa lặng (`ĐC-2`)**:
     - Mọi thao tác tự động xóa/gỡ chương khi khởi động mà không có xác nhận của người dùng đều tiềm ẩn rủi ro mất văn bản AI đã tốn thời gian và quota để sinh.
  4. **Đánh giá quy mô dữ liệu nhiễm thực tế**:
     - Phiên bản `1.2.0-rc.1` chỉ vừa tồn tại trong phiên thử nghiệm hiện tại của 1 người dùng cá nhân; số lượng lá số mới bị gắn nhầm chỉ là 1–2 lá số vừa lập thử.
- **Kết luận xử lý (Đồng thuận 5/5 — BÁC BỎ Phương án A/C3; CHỐT Phương án B tăng cường `C1+`)**:
  - **BÁC BỎ hoàn toàn** việc tự động quét và gỡ chương trùng văn bản khi khởi động app.
  - **CHỐT Phương án B tăng cường (`C1+` — Chủ động, Chính xác, Có Sao lưu Khôi phục trong Phiên)**:
    1. Người dùng có thể xóa toàn bộ hồ sơ bị nhiễm của lá số mới bằng nút sẵn có **"Xóa → Chỉ xóa Hồ Sơ (giữ Lá Số & Ghi chú)"** (`deleteMode: 'dossier_only'`) trong `ChartLibraryModal`.
    2. **Bổ sung thêm hàm và nút "Xóa chương này" (`removeSingleDossierChapterFromLibrary`) ngay trong `DetailedDossierModal`** (chỉ hiện trên chương đang có trạng thái `'completed'` hoặc `'incomplete'`) với xác nhận 2 bước nhẹ ngay tại chỗ, để nếu một lá số chỉ bị nhiễm Chương 5 và Chương 6 nhưng đã có Chương 1 hợp lệ, người dùng chỉ cần bấm xóa riêng Chương 5 và Chương 6 mà không mất Chương 1!
    3. Trước khi thực hiện xóa hồ sơ (`dossier_only`) hoặc xóa chương lẻ (`removeSingleDossierChapterFromLibrary`), hệ thống lưu bản chụp (snapshot) của hồ sơ vừa xóa vào bộ nhớ tạm trong phiên (`lastDeletedDossierSnapshot`) kèm thông báo cho phép bấm **"Hoàn tác"** ngay lập tức nếu bấm nhầm (đáp ứng trọn vẹn `ĐP-8` / `LK-08`).

---

### `LK-04` (`ĐP-4`): Làm Rõ Hai Khái Niệm `'dossier_only'` Bị Trộn Lẫn Trong Bản V1
- **Vai nêu**: Kiến trúc sư Lưu trữ Phía Client (`Vai 1`).
- **Mức độ**: **CAO**.
- **Bằng chứng trên code thật & tài liệu V1**:
  - Trong bản V1 và tóm tắt trước đó, cụm từ `'dossier_only'` bị dùng cho hai khái niệm khác nhau:
    1. **Hồ sơ mồ côi trong `sessionStorage` (`ziwei_dossier_v1::<key>`) không khớp khóa với bất kỳ lá số nào trong `ziwei_history` / `ziwei_chart_library_v1`**:
       - Trên code thật (`src/lib/dossier-chat-ui.ts:825–829`), `StoredDossierRecord` chỉ có `{ chartIdentityKey, updatedAt, sections }` — **không chứa `BirthFormState`**.
       - Trong khi đó, `ChartLibraryEntry` (`src/lib/chart-library.ts:87–101, 675–680`) bắt buộc phải có `form: Readonly<BirthFormState>` để tính lá số 12 cung và huy hiệu định danh.
       - Do đó, không có cái gọi là "thẻ thư viện `status: 'dossier_only'`" trong `ziwei_chart_library_v1`. Hồ sơ trong `sessionStorage` không khớp chính xác khóa 9 thành phần sẽ **nằm nguyên trong `sessionStorage` (`ziwei_dossier_v1::<key>`)**, không tạo ra mục thư viện mới, và tự động hết hạn khi đóng tab trình duyệt (hoặc được liên kết lại nếu trong cùng phiên người dùng lập lại đúng lá số có `chartIdentityKey` khớp 100%).
    2. **Chế độ xóa `deleteMode: 'dossier_only'` của hàm `removeLibraryEntry(chartIdentityKey, { deleteMode: 'dossier_only' })`**:
       - Tính năng này **đã có sẵn trong code `1.2.0-rc.1`** tại `src/lib/chart-library.ts:1818, 1838–1849` và giao diện `src/components/ChartLibraryModal.tsx:860–871` (nút *"Chỉ xóa Hồ Sơ (giữ Lá Số & Ghi chú)"*).
- **Kết luận xử lý (Đồng thuận 5/5 — CHẤP NHẬN & SỬA TRONG V2)**:
  - Sửa lại thuật ngữ trong bản V2:
    - Với hồ sơ `sessionStorage` không khớp khóa 9 thành phần: gọi chính xác là **"Hồ sơ phiên chưa liên kết (`Unlinked Session Dossier` trong `sessionStorage`)"** — giữ nguyên tại `sessionStorage`, không tạo thẻ thư viện, không cần nút xóa riêng trong `ChartLibraryModal`.
    - Với thao tác xóa hồ sơ của một thẻ thư viện: gọi chính xác là **`removeLibraryEntry(key, { deleteMode: 'dossier_only' })`** (đã có sẵn UI trong `ChartLibraryModal`, chỉ cần vá lỗi đồng bộ `aiPeriodCache` & `localChapters` theo `LK-09`).

---

### `LK-05` (`ĐP-5`): Phân Tích `QĐ-L9` (`migrateLegacyHistoryAndDossiers`) & Vá Lỗi Hồi Sinh Mục Đã Xóa + Trôi `updatedAt`
- **Vai nêu**: Kiến trúc sư Lưu trữ Phía Client (`Vai 1`) & Chuyên gia Chất lượng Dữ liệu/Di trú (`Vai 2`).
- **Mức độ**: **CAO**.
- **Bằng chứng trên code thật (`src/lib/chart-library.ts:1277–1407, 1616–1653, 1816–1869`)**:
  1. **So sánh Phương án A (Quét lũy đẳng chỉ-khớp-chính-xác mỗi lần khởi tạo) vs Phương án B (Cờ chạy 1 lần `LIBRARY_MIGRATED_FLAG_KEY`)**:
     - Nếu dùng **Phương án B (cờ cứng chạy 1 lần)**:
       - Những trình duyệt đã mở bản `1.2.0-rc.1` **đã có sẵn `localStorage['ziwei_chart_library_migrated_v1'] = '1'`** (`src/lib/chart-library.ts:1403`).
       - Ngoài ra, `TEST-L03` (`scripts/verify-chart-library.ts:323`) gọi trực tiếp `migrateLegacyHistoryAndDossiers()` lần 2 để kiểm tra tính lũy đẳng; nếu chặn bằng cờ cứng, các kịch bản cứu hộ hồ sơ `currentForm` hoặc tab cũ ghi vào `ziwei_history` sẽ bị bỏ qua.
     - Tuy nhiên, khi giữ **Phương án A (quét lũy đẳng exact-key)** trên code hiện tại (`1.2.0-rc.1`), Tổ chuyên gia phát hiện **2 lỗi tiềm ẩn trên code thật**:
       - **Lỗi 5A — Hồi sinh lá số đã xóa vĩnh viễn từ `ziwei_history`**:
         - Khi lập lá số, `upsertChartToLibrary` gọi `syncLegacyHistoryMirror(normalizedForm)` (`dòng 1695, 1735`) ghi lá số đó vào `localStorage['ziwei_history']`.
         - Khi người dùng xóa vĩnh viễn lá số đó (`removeLibraryEntry(key, { deleteMode: 'entry_and_dossier' })` tại `dòng 1816–1869`), hàm xóa khỏi `ziwei_chart_library_v1` và thêm vào `deletedTombstones`, **nhưng KHÔNG xóa khỏi `localStorage['ziwei_history']`**!
         - Ở lần tải trang kế tiếp, `migrateLegacyHistoryAndDossiers` (`dòng 1277–1338`) đọc `localStorage['ziwei_history']`, không kiểm tra `store.deletedTombstones`, thấy `!existing` nên **tự động tạo lại lá số vừa xóa vào `ziwei_chart_library_v1`**!
       - **Lỗi 5B — Ghi thừa `persistDossierToTargets` và `writeLibraryIndexStore` làm trôi `store.updatedAt` ở mỗi lần mở app**:
         - Vì `writeSessionMirrorDossier` (`dòng 794`) luôn ghi các chương hoàn tất xuống `sessionStorage['ziwei_dossier_v1::<key>']`, nên mỗi lần tải lại trang, `orphanDossiers.get(chartIdentityKey)` luôn tìm thấy bản ghi trong `sessionStorage` và gọi `persistDossierToTargets(mergedRecord, chart)` (`dòng 1314`) + `writeLibraryIndexStore(store)` (`dòng 1400`), dù `inMemoryDossierMirror` (nạp từ `IndexedDB`) đã có đủ dữ liệu y hệt!
- **Kết luận xử lý (Đồng thuận 5/5 — CHỐT `QĐ-L9` Phương án A có Cổng Bảo Vệ Lũy Đẳng Thực Sự)**:
  1. Trong `removeLibraryEntry(..., { deleteMode: 'entry_and_dossier' })`, đồng thời lọc bỏ mục có cùng `chartIdentityKey` khỏi `localStorage['ziwei_history']`.
  2. Trong `migrateLegacyHistoryAndDossiers`:
     - Xây dựng `tombstoneMap = new Map(store.deletedTombstones.map(t => [t.chartIdentityKey, t.deletedAt]))`. Nếu `tombstoneMap.get(chartIdentityKey) >= savedAt`, **bỏ qua ngay** mục đó trong `ziwei_history` (không hồi sinh).
     - Chỉ gọi `persistDossierToTargets(mergedRecord, chart)` và tăng `linkedDossiers` khi `exactOrphan` thực sự đóng góp chương mới hoặc có `updatedAt` mới hơn bản ghi đã có trong `inMemoryDossierMirror` / `hotCache`.
     - Chỉ gọi `writeLibraryIndexStore(store)` khi `migratedEntries > 0 || linkedDossiers > 0` (tránh làm trôi `store.updatedAt` khi không có thay đổi).

---

### `LK-06` (`ĐP-6`): Chống Đua (Race Condition) Giữa Hydration / Đổi Tham Chiếu `chart` Và Luồng Sinh Chương Trong `DetailedDossierModal.tsx` + Nhất Quán `ĐC-3`
- **Vai nêu**: Chuyên gia React State & Vòng đời Component (`Vai 3`).
- **Mức độ**: **NGHIÊM TRỌNG**.
- **Bằng chứng trên code thật (`src/components/DetailedDossierModal.tsx:165–257, 284–288, 347–690`)**:
  1. **Nguy cơ đua 1 — Đổi lá số (`chartIdentityKey` thay đổi) khi đang chạy SSE của lá số cũ**:
     - Hiện tại `DetailedDossierModal.tsx:284–288` chỉ gọi `stopAllGeneration()` khi `!open`. Nếu modal đang mở hoặc người dùng đổi lá số nhanh ngay khi vừa bấm sinh, `abortRef.current?.abort()` chưa được gọi trong `useEffect` theo dõi `chartIdentityKey`.
  2. **Nguy cơ đua 2 — `useEffect` chạy lại trên CÙNG `chartIdentityKey` (`isChartChanged === false`) làm mất chương đang `'loading'` hoặc vừa sinh**:
     - Dependency array của `useEffect` (`dòng 257`) gồm: `[chartIdentityKey, dossierStorageKey, chart, hydrationStatus, isHydrated, onAiPeriodCacheChange]`.
     - Nếu người dùng đang ở trên cùng 1 lá số (`isChartChanged === false`) nhưng `chart` prop đổi object reference (do `App.tsx` tạo `buildChartFromForm` mới cho cùng dữ kiện) hoặc `hydrationStatus` chuyển trạng thái:
       - Bản vá Mục 3 ở V1 viết: `setLocalChapters(next)` (trong đó `next` chỉ lấy `'completed'` và `'incomplete'` từ `stored`). Nếu lúc đó một chương đang ở trạng thái `'loading'` (đang stream SSE), `setLocalChapters(next)` sẽ **ghi đè làm biến mất trạng thái `'loading'` và phần văn bản đang stream**!
       - Hoặc nếu lá số mới chưa có chương nào trong `stored` (`stored === null`), `isHydrated === true`, và người dùng vừa bấm sinh Chương 1 (`localChapters['chapter_overview'].status === 'loading'`), một lần re-trigger `useEffect` (do `chart` đổi tham chiếu) sẽ rơi vào nhánh `else if (isChartChanged || isHydrated)` $\rightarrow$ gọi `setLocalChapters({})` xóa mất chương đang sinh!
  3. **Kiểm tra tính nhất quán với `ĐC-3` khi chuẩn hóa `sectionCacheKey`**:
     - Theo `ĐC-3`, `inMemoryDossierMirror` + `IndexedDB` là SSOT, và `sanitizeFullDossierRecord` đã gán `sectionCacheKey: "${canonicalKey}::${spec.id}"` (`src/lib/chart-library.ts:841`).
     - Tuy nhiên, nếu `DetailedDossierModal.tsx` ép gán `sectionCacheKey: expectedSectionKey` cho mọi `val` mà không kiểm tra `val.sectionCacheKey` trước, thì nếu `stored` vô tình chứa một chương có `val.sectionCacheKey` của lá số khác, việc ép gán sẽ **hợp thức hóa** chương ngoại lai đó và làm vô hiệu hóa chốt chặn ở Mục vá 2 (`resolveDossierChapterFromCaches`)!
     - Do đó, quy tắc chuẩn `ĐC-3` phải là:
       - Chỉ chấp nhận `stored` nếu `stored.chartIdentityKey === chartIdentityKey`.
       - Với từng chương `val` trong `stored.sections`, chỉ chấp nhận nếu `!val.sectionCacheKey || val.sectionCacheKey === expectedSectionKey` (nếu `val.sectionCacheKey` tồn tại mà thuộc về một `chartIdentityKey` khác thì **bỏ qua ngay** chương đó).
- **Kết luận xử lý (Đồng thuận 5/5 — CHẤP NHẬN & SỬA THIẾT KẾ MỤC VÁ 3 TRONG V2)**:
  - Trong `DetailedDossierModal.tsx`:
    1. Khi `isChartChanged === true` (`prevChartKeyRef.current !== chartIdentityKey`):
       - Nếu đang có tiến trình sinh (`autoRunning || activeGeneratingId !== null`), gọi `stopAllGeneration()` ngay lập tức để hủy `AbortController` của lá số cũ.
       - Đặt lại `localChapters` hoàn toàn từ `stored` của lá số mới (hoặc `{}` nếu lá số mới chưa có `stored`), tuyệt đối không giữ bất kỳ khóa nào của `prev` (lá số cũ).
    2. Khi `isChartChanged === false` (vẫn trên cùng `chartIdentityKey`):
       - Dùng cập nhật hàm `setLocalChapters((prev) => ...)`:
       - Giữ nguyên mọi chương trong `prev` có `sectionCacheKey === expectedSectionKey` đang ở trạng thái `'loading'`, hoặc có `updatedAt` mới hơn bản trong `stored` (bảo vệ tuyệt đối chương đang sinh / vừa sinh xong).
       - Chỉ khi `stored === null && isHydrated` **và modal vừa chuyển từ đóng sang mở (`justOpened`) hoặc hồ sơ vừa bị xóa (`dossierSummary.completedCount === 0` từ Thư Viện)** mới xóa các chương `'completed'`/`'incomplete'` cũ trong `prev`.

---

### `LK-07` (`ĐP-7`): Kiểm Chứng Trên Code Thật Khẳng Định Về Bảng 4/4 Lưu Niên Tứ Hóa Ở Cuối Chương 5 & 6
- **Vai nêu**: Chuyên gia Chất lượng Dữ liệu & Di trú (`Vai 2`).
- **Mức độ**: **TRUNG BÌNH**.
- **Bằng chứng trên code thật (`src/lib/chart-library.ts:842–844`, `src/lib/dossier-chat-ui.ts:170–197`, `src/lib/ziwei/text-sanitizer.ts:113–217`)**:
  - Chuỗi gọi hàm thực tế khi `migrateLegacyHistoryAndDossiers` gộp hồ sơ của Người A vào Người B (`chartB`):
    1. `mergeDossierRecords(keyB, existing, candA, chartB)` (`src/lib/chart-library.ts:1310`) $\rightarrow$ gọi `sanitizeFullDossierRecord(..., keyB, chartB)` (`dòng 869, 918`).
    2. `sanitizeFullDossierRecord` (`dòng 843`) gọi `sanitizeDossierChapterText(val.text, spec.id, chartB)`.
    3. Với `spec.id === 'year_2026'` hoặc `'year_2027'`, `sanitizeDossierChapterText` (`src/lib/dossier-chat-ui.ts:178–192`) dựng `periodCtx = buildYunxianPeriodContext(chartB, { mode: 'liunian', year: periodYear })` rồi gọi `verifyAndEnsureCompletePeriodSiHua(cleaned, periodCtx)`.
    4. Trong `verifyAndEnsureCompletePeriodSiHua` (`src/lib/ziwei/text-sanitizer.ts:191–200`):
       ```ts
       const normText = text.normalize('NFC').toLowerCase();
       const missingEntries = periodSiHuas.filter((sh) => !isPeriodSiHuaMentionedInText(normText, sh));
       if (missingEntries.length === 0) {
         return { isComplete: true, missingEntries: [], patchedText: text };
       }
       ```
    5. Hàm `isPeriodSiHuaMentionedInText(normText, sh)` (`dòng 113–158`) chỉ kiểm tra tên sao (`sh.starNameVi`) và loại hóa (`sh.mutagenVi`: Lộc/Quyền/Khoa/Kỵ) xuất hiện trong cùng câu (`±140` ký tự), **không kiểm tra tên cung (`sh.palaceNameVi`)**!
    6. Vì năm Lưu Niên cố định (`2026` Can Bính; `2027` Can Đinh) có cùng 4 sao Lưu Hóa cho mọi lá số, nên:
       - **Trường hợp 1**: Nếu văn bản Chương 5/6 của Người A trong `sessionStorage` đã nêu đủ 4 sao Lưu Hóa (hoặc đã được gắn sẵn khối `> 📌 **[Tổng Hợp Đầy Đủ Tứ Hóa Kỳ Hạn Theo Lá Số]**` của Người A khi Người A sinh chương đó), thì khi truyền `chartB` vào, `missingEntries.length === 0` $\rightarrow$ hàm trả về nguyên vẹn văn bản của Người A (kể cả bảng `> 📌` mang tên các cung của Người A) mà **không nối thêm bảng của Người B**!
       - **Trường hợp 2**: Chỉ khi văn bản Chương 5/6 của Người A thiếu $\ge 1$ sao Lưu Hóa và chưa có bảng `> 📌`, `verifyAndEnsureCompletePeriodSiHua` mới nối bảng `> 📌` tính theo `chartB` của Người B vào cuối văn bản của Người A.
- **Kết luận xử lý (Đồng thuận 5/5 — CHẤP NHẬN & ĐÍNH CHÍNH TRONG V2)**:
  - Đính chính lại Mục `2.1` và `4.1` trong bản kế hoạch V2 để phản ánh chính xác 2 trường hợp trên của `verifyAndEnsureCompletePeriodSiHua`. Phát hiện này càng củng cố quyết định `LK-03` (bác bỏ việc tách khối `> 📌` để tự động xóa chương).

---

### `LK-08` (`ĐP-8`): Cơ Chế An Toàn & Khôi Phục Khi Người Dùng Dọn Hồ Sơ Hoặc Chương Bị Nhiễm
- **Vai nêu**: Luật sư An toàn Dữ liệu Người dùng (`Vai 5`).
- **Mức độ**: **CAO**.
- **Phân tích**:
  - Sau khi bác bỏ cơ chế tự động xóa ngầm khi khởi động (`LK-03`), rủi ro duy nhất còn lại là người dùng tự bấm nút *"Chỉ xóa Hồ Sơ (giữ Lá Số & Ghi chú)"* trong `ChartLibraryModal` hoặc nút *"Xóa chương này"* trong `DetailedDossierModal` rồi muốn khôi phục lại.
- **Kết luận xử lý (Đồng thuận 5/5 — CHẤP NHẬN & TÍCH HỢP VÀO V2)**:
  1. Trong `ChartLibraryModal`: Đã có sẵn nút **"Xuất .JSON"** riêng cho từng lá số (`handleExportSingle` tại `src/components/ChartLibraryModal.tsx:191–215`) ngay cạnh nút **"Xóa"** (`dòng 918–940`). Ngoài ra, khi người dùng bấm *"Chỉ xóa Hồ Sơ (giữ Lá Số & Ghi chú)"* trên mục có $\ge 1$ chương hoàn tất, hệ thống lưu bản ghi hồ sơ vừa xóa vào biến bộ nhớ phiên `lastDeletedDossierBackup` (tương tự `lastEvictedBackupItem`) để người dùng có thể bấm **"Hoàn tác xóa Hồ Sơ"** ngay trên thanh thông báo `statusNotice` trong phiên nếu lỡ tay bấm nhầm!
  2. Trong `DetailedDossierModal`: Khi người dùng bấm **"Xóa chương này"** (thao tác mới chỉ xóa 1 chương đang chọn), hiển thị bước xác nhận tại chỗ (*"Xác nhận xóa nội dung Chương X? Bạn có thể hoàn tác ngay trong phiên"*) và cho phép bấm **"Hoàn tác"** để khôi phục lại chương vừa xóa từ state tạm trong phiên.

---

### `LK-09` *(Phát hiện mới từ kiểm tra code thật)*: Lỗi "Bóng Ma Chương 5/6" Do `aiPeriodCache` Trong `App.tsx` Và `DetailedDossierModal.tsx` Không Được Làm Sạch Khi Xóa Hồ Sơ (`dossier_only`)
- **Vai nêu**: Chuyên gia React State & Vòng đời Component (`Vai 3`) & Kiến trúc sư Lưu trữ (`Vai 1`).
- **Mức độ**: **CAO (Trực tiếp phá hỏng Phương án B của `QĐ-L8` nếu không vá)**.
- **Bằng chứng trên code thật (`src/App.tsx:77, 162–166, 652–702` và `src/components/DetailedDossierModal.tsx:165–257, 842`)**:
  1. Khi ứng dụng mở lá số `chartB` đã bị nhiễm Chương 5 (`year_2026`) và Chương 6 (`year_2027`), `useEffect` tại `src/App.tsx:162–166` gọi `hydratePeriodCacheFromLibrary(chart)` nạp `${keyB}__liunian__liunian_2026` và `${keyB}__liunian__liunian_2027` vào state `aiPeriodCache` của `App.tsx`.
  2. Giả sử người dùng làm đúng theo hướng dẫn của Phương án B (`QĐ-L8`): Mở `ChartLibraryModal` $\rightarrow$ bấm **"Xóa → Chỉ xóa Hồ Sơ (giữ Lá Số & Ghi chú)"** (`onRemoveEntry(keyB, 'dossier_only')` tại `src/App.tsx:695`).
  3. Hàm `removeLibraryEntry(keyB, { deleteMode: 'dossier_only' })` (`src/lib/chart-library.ts:1816–1849`) xóa sạch hồ sơ trong `inMemoryDossierMirror`, `localStorage`, `sessionStorage` và `IndexedDB`.
  4. **NHƯNG**:
     - Tại `src/App.tsx:695`, `onRemoveEntry={removeEntry}` **không hề xóa các khóa `${keyB}__liunian__liunian_2026` và `2027` khỏi state `aiPeriodCache`** của `App.tsx`!
     - Tại `src/App.tsx:652`, `<DetailedDossierModal open={showDossierModal} ... />` luôn được mount (vì dòng `if (!open) return null;` nằm ở cuối component tại `src/components/DetailedDossierModal.tsx:842`). Và `useEffect` nạp hồ sơ tại `DetailedDossierModal.tsx:165–257` **không có `open` trong dependency array**!
     - Hệ quả: Ngay sau khi người dùng xóa hồ sơ trong `ChartLibraryModal` rồi đóng `ChartLibraryModal` và bấm mở lại `DetailedDossierModal` cho `chartB`, **Chương 5 và Chương 6 VẪN HIỆN NGUYÊN VẸN** (vì `aiPeriodCache` trong `App.tsx` vẫn giữ bản cache Lưu Niên 2026/2027 của `keyB`, và `localChapters` trong `DetailedDossierModal` cũng chưa được làm mới khi `open` đổi từ `false` sang `true`)!
- **Kết luận xử lý (Đồng thuận 5/5 — CHẤP NHẬN & ĐƯA VÀO MỤC VÁ 3B TRONG V2)**:
  1. Trong `src/App.tsx`: Khi gọi `removeEntry(targetKey, deleteMode)` (ở cả `ChartLibraryModal` dòng `695` và `BirthForm` dòng `497, 555`), đồng thời gọi `setAiPeriodCache((prev) => ...)` để xóa mọi khóa bắt đầu bằng `${targetKey}__` khỏi `aiPeriodCache`.
  2. Trong `src/components/DetailedDossierModal.tsx`: Thêm `open` vào dependency array của `useEffect` nạp hồ sơ (`dòng 165–257`); khi `open` chuyển sang `true` mà `stored === null && isHydrated`, nếu không có chương nào đang `'loading'` thì đặt `setLocalChapters({})`.

---

### `LK-10` *(Phát hiện mới từ kiểm tra code thật)*: Chốt Chặn Khớp `parsed.chartIdentityKey === chartIdentityKey` Khi Đọc Fallback Từ `hotCache` / `sessionStorage`
- **Vai nêu**: Kiến trúc sư Lưu trữ Phía Client (`Vai 1`).
- **Mức độ**: **TRUNG BÌNH**.
- **Bằng chứng trên code thật (`src/lib/chart-library.ts:1891–1919` và `src/lib/dossier-chat-ui.ts:301–306`)**:
  - Trong `getDossierReadState(chartIdentityKey, chart)` (`src/lib/chart-library.ts:1891–1919`), khi đọc từ `fromHot` hoặc `sessionStorage`, hàm gọi thẳng `sanitizeFullDossierRecord(parsed, chartIdentityKey, chart)` mà chưa kiểm tra `parsed.chartIdentityKey === chartIdentityKey`.
  - Nếu một khóa lưu trữ trong `sessionStorage` hoặc `localStorage` từng chứa một object có `parsed.chartIdentityKey` nội bộ khác với `chartIdentityKey` đang tra cứu, `sanitizeFullDossierRecord` sẽ ghi đè `parsed.chartIdentityKey = chartIdentityKey` và hợp thức hóa bản ghi đó.
- **Kết luận xử lý (Đồng thuận 5/5 — CHẤP NHẬN & SỬA TRONG V2)**:
  - Tại `readHotDossierFromLocalStorage`, `getBestKnownDossierSync`, `getDossierReadState` (`src/lib/chart-library.ts`) và `readDossierCacheEntry` (`src/lib/dossier-chat-ui.ts`), bổ sung điều kiện kiểm tra: nếu `parsed.chartIdentityKey !== chartIdentityKey` thì bỏ qua (`return null`), tuyệt đối không dùng `sanitizeFullDossierRecord` để viết đè khóa của một bản ghi khác chủ.

---

## 4. Bảng Đồng Thuận & Khác Biệt Giữa 5 Vai Chuyên Gia

| Vấn đề / Quyết định | Kiến trúc sư Lưu trữ (Vai 1) | Chuyên gia Di trú & Dữ liệu (Vai 2) | Chuyên gia React State (Vai 3) | Chuyên gia Kiểm thử (Vai 4) | Luật sư An toàn Dữ liệu (Vai 5) | Kết luận chung của Tổ |
|---|---|---|---|---|---|---|
| **Mục vá 1**: Bỏ Bậc 2 & Bậc 3 trong `migrateLegacyHistoryAndDossiers`, chỉ khớp exact 9-part `chartIdentityKey` | Đồng thuận | Đồng thuận | Đồng thuận | Đồng thuận | Đồng thuận | **Đồng thuận 5/5** |
| **Mục vá 2**: `resolveDossierChapterFromCaches` bắt buộc `rawLocal.sectionCacheKey === sectionCacheKey` ở cả nhánh kỳ hạn & nhánh thường | Đồng thuận | Đồng thuận | Đồng thuận | Đồng thuận | Đồng thuận | **Đồng thuận 5/5** |
| **Mục vá 3 + `LK-06` + `LK-09`**: Reset `localChapters` khi đổi khóa + bảo vệ chương đang `'loading'` + đồng bộ `open` & xóa `aiPeriodCache` khi xóa hồ sơ | Đồng thuận | Đồng thuận | Đồng thuận (Đề xuất chính) | Đồng thuận | Đồng thuận | **Đồng thuận 5/5** |
| **`LK-01` & `LK-02`**: Cập nhật `TEST-L04` và tách bạch `TEST-L13..TEST-L17` (tổng 17 bài test) | Đồng thuận | Đồng thuận | Đồng thuận | Đồng thuận (Đề xuất chính) | Đồng thuận | **Đồng thuận 5/5** |
| **`QĐ-L8` (`LK-03` & `LK-08`)**: Bác bỏ tự động xóa văn bản trùng `>= 200` ký tự; dùng xóa chủ động cấp Hồ Sơ (`dossier_only`) + cấp từng Chương kèm Hoàn tác trong phiên | Đồng thuận | Ban đầu cân nhắc giữ chế độ cách ly tự động (quarantine), sau đồng thuận bác bỏ vì `entry.createdAt` / `section.updatedAt` không phân biệt được chủ thật với bản nhiễm | Đồng thuận | Đồng thuận | Đồng thuận (Phản biện chính) | **Đồng thuận 5/5 sau thảo luận** |
| **`QĐ-L9` (`LK-05`)**: Giữ quét lũy đẳng exact-key nhưng thêm chốt chặn `deletedTombstones` và chỉ ghi khi có chương mới (không làm trôi `updatedAt`) | Đồng thuận (Đề xuất chính) | Đồng thuận | Đồng thuận | Đồng thuận | Đồng thuận | **Đồng thuận 5/5** |

---

## 5. Khuyến Nghị Cuối Cùng Cho `QĐ-L8` Và `QĐ-L9`

1. **Khuyến nghị chốt `QĐ-L8` (Xử lý dữ liệu đã trót bị nhiễm trên trình duyệt của người dùng)**:
   - **CHỌN PHƯƠNG ÁN B TĂNG CƯỜNG (`C1+` — An toàn 100%, Không xóa tự động ngầm)**:
     - **Bác bỏ** việc tự động quét và gỡ chương trùng văn bản khi khởi động (tránh rủi ro xóa nhầm chủ thật do `section.updatedAt` giống hệt nhau và `entry.createdAt` có thể đảo chiều).
     - **Sử dụng nút sẵn có** *"Xóa → Chỉ xóa Hồ Sơ (giữ Lá Số & Ghi chú)"* (`deleteMode: 'dossier_only'`) trong `ChartLibraryModal` **kết hợp vá lỗi `LK-09`** (xóa đồng bộ cả `aiPeriodCache` trong `App.tsx` và làm mới `localChapters` trong `DetailedDossierModal.tsx` ngay lập tức).
     - **Bổ sung nút nhỏ *"Xóa chương này"*** (`removeSingleDossierChapterFromLibrary`) ngay trên thanh công cụ của từng chương đã sinh trong `DetailedDossierModal` + thanh **"Hoàn tác"** trong phiên (`LK-08`), giúp người dùng có thể gỡ riêng Chương 5 hoặc Chương 6 bị nhiễm chỉ bằng 1 cú nhấp chuột mà không ảnh hưởng tới các chương hợp lệ khác của lá số đó.
2. **Khuyến nghị chốt `QĐ-L9` (Cơ chế chạy `migrateLegacyHistoryAndDossiers`)**:
   - **CHỌN PHƯƠNG ÁN A CÓ CỔNG BẢO VỆ LŨY ĐẲNG (`Idempotent Exact-Key with Tombstone & Dirty Guard`)**:
     - Giữ quét lũy đẳng chỉ khớp exact 9-part `chartIdentityKey` để luôn cứu hộ được hồ sơ hợp lệ trong `sessionStorage` / `ziwei_history` (đảm bảo `TEST-L03` và mọi ca mở lại tab hoạt động trơn tru).
     - Bổ sung 3 cổng bảo vệ bắt buộc (`LK-05`):
       1. Kiểm tra `store.deletedTombstones` trước khi di trú mục từ `ziwei_history` (và xóa luôn mục tương ứng trong `ziwei_history` khi người dùng chọn `entry_and_dossier`), ngăn chặn triệt để lỗi hồi sinh lá số đã xóa.
       2. Chỉ gọi `persistDossierToTargets` khi bản ghi trong `sessionStorage` thực sự có chương mới hoặc `updatedAt` mới hơn bản ghi trong `inMemoryDossierMirror`.
       3. Chỉ gọi `writeLibraryIndexStore` khi `migratedEntries > 0 || linkedDossiers > 0`, bảo toàn nguyên vẹn `updatedAt` và thứ tự LRU.

---

## 6. Danh Sách Điểm Cần Con Người (Chủ Dự Án) Phê Duyệt Cuối Cùng Trước Khi Thi Công

Tổ chuyên gia đã giải quyết dứt điểm mọi điểm kỹ thuật và đạt đồng thuận 5/5. Chủ dự án chỉ cần xác nhận **1 điểm phạm vi nhỏ** trước khi bước vào lượt viết code `1.2.0-rc.2`:

1. **Xác nhận phạm vi `QĐ-L8` (`C1` thuần túy vs `C1+` có thêm nút *"Xóa chương này"* trong `DetailedDossierModal`)**:
   - **Lựa chọn 1 (`C1+` — Khuyến nghị của Tổ chuyên gia)**: Vá lỗi đồng bộ `aiPeriodCache`/`localChapters` khi bấm *"Chỉ xóa Hồ Sơ"* trong `ChartLibraryModal` (`LK-09`) **CỘNG VỚI** thêm hàm `removeSingleDossierChapterFromLibrary` và nút *"Xóa chương này"* (kèm Hoàn tác trong phiên) ngay trong `DetailedDossierModal` (~35 dòng code).
   - **Lựa chọn 2 (`C1` tối giản)**: Chỉ vá lỗi đồng bộ `aiPeriodCache`/`localChapters` khi bấm *"Chỉ xóa Hồ Sơ"* (`dossier_only`) trong `ChartLibraryModal` (`LK-09`), không thêm nút xóa từng chương lẻ trong `DetailedDossierModal`.
