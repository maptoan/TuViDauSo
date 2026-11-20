# BIÊN BẢN HỌP TỔ CHUYÊN GIA MÔ PHỎNG PHẢN BIỆN & TỐI ƯU HÓA KẾ HOẠCH THƯ VIỆN LÁ SỐ (`docs/chart-library-expert-panel-review.md`)

- **Loại tài liệu**: `[Tài liệu Kiểm toán & Biên bản Phản biện Thiết kế (Expert Panel Review)]`
- **Trạng thái hiệu lực**: `ĐANG HIỆU LỰC (ACTIVE — CĂN CỨ CẬP NHẬT BẢN KẾ HOẠCH V2 SAU PANEL)`
- **Áp dụng cho phiên bản ứng dụng**: `1.1.0-rc.1`
- **Ngày họp & cập nhật**: `17/11/2026`
- **Tài liệu đầu vào được rà soát**: `docs/chart-library-design-plan.md` *(Bản dự thảo V1 trước Panel)*
- **Tài liệu đầu ra đã cập nhật**: `docs/chart-library-design-plan.md` *(Bản V2 đã chi tiết hóa sau Panel)*
- **Mã nguồn đối chiếu (Code SSOT)**: `src/lib/ziwei/history.ts`, `src/lib/dossier-chat-ui.ts`, `src/lib/ziwei/yunxian-context.ts`, `src/lib/ziwei/share.ts`, `src/lib/ziwei/types.ts`, `src/App.tsx`, `src/components/BirthForm.tsx`, `src/components/DetailedDossierModal.tsx`, `server/key-pool/crypto-store.ts`, `server.ts`
- **Quyết định liên quan**: `QĐ-L1` .. `QĐ-L7` *(đã tinh chỉnh sau Panel)*

---

## 0. Tuyên Bố Minh Bạch Về Phương Pháp Mô Phỏng & Thành Phần Tổ Chuyên Gia

1. **Bản chất mô phỏng trong một phiên**:
   - Biên bản này là **MÔ PHỎNG thảo luận và phản biện đa vai trong MỘT phiên làm việc duy nhất** của mô hình AI, không phải 5 con người độc lập ngoài đời thực.
   - Mục đích của mô hình 5 vai đối kháng là bắt buộc kiểm tra chéo mọi giả định trong bản thiết kế V1 trước các bằng chứng vận hành thực tế (như sự cố lệch trạng thái `.data/` tối `17/11/2026`), giới hạn bộ nhớ trình duyệt (`5 MB` của `localStorage`), tính toàn vẹn khóa định danh lá số và an toàn dữ liệu cá nhân.

2. **Danh sách 5 Vai Chuyên Gia trong Tổ (Panel Roster)**:
   - **[Vai 1 — Kiến trúc sư Dữ liệu (`Data Architect`)]**: Chịu trách nhiệm về mô hình thực thể `ChartLibraryEntry`, tính bất biến của khóa định danh `buildChartIdentityKey`, ánh xạ di trú dữ liệu cũ, thuật toán hợp nhất (`Merge`) và cơ chế chống hồi sinh bản ghi đã xóa (`Tombstone`).
   - **[Vai 2 — Kỹ sư Lưu trữ Phía Trình duyệt (`Browser Storage Engineer`)]**: Chịu trách nhiệm về toán dung lượng byte (`Byte Budget`), phân tầng lưu trữ giữa `window.localStorage` (đồng bộ), `window.indexedDB` (bất đồng bộ dung lượng lớn) và `window.sessionStorage`, cơ chế gương RAM (`In-Memory Mirror`) và thuật toán thu hồi LRU không kẹt cứng (`Deadlock-Free Eviction`).
   - **[Vai 3 — Kỹ sư Backend & Bảo mật (`Backend & Security Engineer`)]**: Chịu trách nhiệm đánh giá độ tin cậy thực tế của thư mục `.data/` trên container AI Studio, bề mặt tấn công lộ dữ liệu cá nhân (PII) qua link chia sẻ `ais-pre-`, hiệu quả thực tế của mã hóa `AES-256-GCM` khi khóa chủ nằm chung trong `.data/`, và giới hạn payload Express.
   - **[Vai 4 — Chuyên gia Trải nghiệm Người dùng (`UX Specialist`)]**: Chịu trách nhiệm kiểm soát phạm vi tính năng (chống phình giao diện), luồng Xuất/Nhập file `.json` khi đổi máy, cơ chế đặt tên gợi nhớ (`customAlias`) so với sửa tên khai sinh (`form.name`), và hộp thoại cảnh báo xóa 2 bước.
   - **[Vai 5 — Kỹ sư Kiểm định (`QA & Verification Engineer`)]**: Chịu trách nhiệm đối chiếu từng dòng code thật trong repo, vạch trần các lỗ hổng di trú dữ liệu cũ hoặc xung đột khóa cache, và thiết kế đặc tả kiểm thử tự động `scripts/verify-chart-library.ts` (`TEST-L01` .. `TEST-L10`).

---

## 1. Bảng Tổng Hợp 12 Vấn Đề Phản Biện (`PL-01` .. `PL-12`)

Tổ chuyên gia đã rà soát toàn bộ **10 điểm trong Agenda bắt buộc** (tương ứng `PL-01` đến `PL-10`) và phát hiện thêm **2 vấn đề kỹ thuật bổ sung** (`PL-11`, `PL-12`) khi đối chiếu mã nguồn `src/App.tsx` và `src/components/DetailedDossierModal.tsx`:

| Mã vấn đề | Điểm Agenda | Tiêu đề vấn đề phản biện | Vai nêu chính | Mức độ | Trạng thái Panel |
|:---:|:---:|---|---|:---:|:---:|
| **`PL-01`** | Agenda #1 | `.data/` phía Server AI Studio không bền vững & không đồng nhất giữa các phiên (`1/1` vs `22/22` tối `17/11/2026`); đồng bộ 2 chiều tự động sẽ gây phân kỳ lặng lẽ (`Split-Brain`). | Vai 3, Vai 1 | **Nghiêm trọng** | **ĐỒNG THUẬN** *(Bác bỏ Auto 2-Way Sync; còn tranh cãi nhẹ giữa cắt hẳn Server vs giữ Trạm trung chuyển 1 chiều ở Pha sau → trình `QĐ-L1`)* |
| **`PL-02`** | Agenda #2 | Xung đột đồng bộ: `Last-Write-Wins` làm mất chương hồ sơ; xóa ở Máy A bị Máy B đẩy ngược làm "hồi sinh" bản đã xóa. | Vai 1, Vai 5 | **Nghiêm trọng** | **ĐỒNG THUẬN** *(Bỏ đồng bộ 2 chiều ngầm; dùng Hợp nhất đơn điệu từng chương `Per-Chapter Merge` + `deletedTombstones` khi nhập/gộp)* |
| **`PL-03`** | Agenda #3 | Phạm vi bản V1 bị phình (`Over-engineered`): 4 pha + Server Sync + Mã hóa + Modal đồ sộ cho app 1 người dùng; cần cắt lát MVP dùng được ngay. | Vai 4, Vai 1 | **Cao** | **ĐỒNG THUẬN** *(Rút gọn còn 2 Pha cốt lõi MVP: Thư viện Local `IndexedDB + localStorage` + Di trú + Xuất/Nhập `.JSON` + Modal UI)* |
| **`PL-04`** | Agenda #4 | Lịch sử tiến hóa của `buildChartIdentityKey` (5 thành phần ở `1.0.0-stable` → 9 thành phần ở `1.1.0-rc.1`) làm mồ côi hồ sơ cũ nếu chỉ khớp khóa mới; rủi ro đứt liên kết khi sửa `form.name` (`QĐ-L4`). | Vai 5, Vai 1 | **Nghiêm trọng** | **ĐỒNG THUẬN** *(Thiết kế Ánh xạ 3 bậc `V2 Exact → V1 5-part → Prefix` khi di trú; khóa cứng `form.name` trong Thư Viện, chỉ đổi `customAlias`)* |
| **`PL-05`** | Agenda #5 | Ghép chung `KEY_POOL_ADMIN_PIN` và mở `10mb` payload cho `/api/library` trên `ais-pre-` gây lộ dữ liệu cá nhân (PII) qua `GET` và mở bề mặt DoS. | Vai 3 | **Cao** | **ĐỒNG THUẬN** *(Cắt bỏ API `/api/library` trong MVP để bề mặt tấn công trên `ais-pre-` = 0; giữ nguyên limit `512kb` của `server.ts`)* |
| **`PL-06`** | Agenda #6 | Mã hóa `AES-256-GCM` phía Server vô tác dụng thực tế khi `.pool-master.key` và dữ liệu cùng nằm trong `.data/` (mất là mất cả hai, lộ `.data/` là lộ cả hai). | Vai 3, Vai 2 | **Trung bình** | **ĐỒNG THUẬN** *(Bác bỏ việc tái dùng `KeyPoolCryptoStore` cho Thư Viện; không mã hóa giả tạo trên Server)* |
| **`PL-07`** | Agenda #7 | Hồ sơ hiện nằm ở `sessionStorage` (`ziwei_dossier_v1::*`) đóng tab là mất; bản V1 chưa chốt rõ việc chuyển nơi lưu hồ sơ sang bền vững nằm ở pha nào và đồng bộ thế nào với `DetailedDossierModal.tsx`. | Vai 2, Vai 5 | **Nghiêm trọng** | **ĐỒNG THUẬN** *(Đưa việc chuyển kho lưu `StoredDossierRecord` sang bền vững `IndexedDB` + Gương RAM đồng bộ vào ngay **Pha 1 MVP**)* |
| **`PL-08`** | Agenda #8 | Toán dung lượng V1 sai lệch: 1 hồ sơ 8 chương dài `15.000–20.000` từ (`~110–180 KB`); lưu 30–100 hồ sơ trong `localStorage` sẽ nổ trần `5 MB` (`QuotaExceededError`). | Vai 2 | **Nghiêm trọng** | **ĐỒNG THUẬN** *(Lập Bảng Ngân Sách Byte chi tiết: `localStorage` chỉ giữ chỉ mục `<= 450 KB` + 3 hồ sơ nóng `<= 540 KB`; văn bản 100 hồ sơ nằm ở `IndexedDB`)* |
| **`PL-09`** | Agenda #9 | Quy tắc LRU trong V1 bảo vệ tuyệt đối cả mục Đã ghim lẫn mục Có hồ sơ/ghi chú → kẹt cứng (`Deadlock`) khi cả 100 mục đều có hồ sơ hoặc được ghim. | Vai 2, Vai 5 | **Cao** | **ĐỒNG THUẬN** *(Đặt trần `MAX_PINNED_ENTRIES = 30` và Thang thu hồi tất định 4 nấc trên 70 mục không ghim)* |
| **`PL-10`** | Agenda #10 | Đặc tả kiểm thử `TEST-L01..L10` trong V1 còn thiếu ca di trú từ đúng hình dạng dữ liệu cũ thật (khóa 5 thành phần + khóa 9 thành phần) và ca kẹt đầy dung lượng. | Vai 5 | **Cao** | **ĐỒNG THUẬN** *(Viết lại đặc tả 10 bài test tự động trong `scripts/verify-chart-library.ts` với đầu vào/đầu ra định lượng)* |
| **`PL-11`** | Phát hiện thêm | Nạp lá số từ Thư Viện hoặc đổi lá số trong `src/App.tsx:88–106` (`applyFormAndChart`) hiện không đồng bộ/làm mới các chương Lưu Niên 2026/2027 từ kho hồ sơ bền vững vào `aiPeriodCache`. | Vai 1, Vai 5 | **Trung bình** | **ĐỒNG THUẬN** *(Khi mở lá số từ Thư Viện, nạp kèm Chương 5/6 từ `StoredDossierRecord` bền vững vào `aiPeriodCache` nếu có)* |
| **`PL-12`** | Phát hiện thêm | Xuất/Nhập file `.JSON` trên trình duyệt chưa có cơ chế kiểm tra tính hợp lệ (`Schema Validation`) và lọc hậu kiểm văn bản (`sanitizeDossierChapterText`) khi nhập file từ nguồn ngoài. | Vai 3, Vai 5 | **Thấp** | **ĐỒNG THUẬN** *(Khi nhập file `.json`, chạy kiểm tra kiểu nghiêm ngặt cho `BirthFormState` qua `safeParseInt` và chạy `sanitizeDossierChapterText` cho mọi chương)* |

**Thống kê theo mức độ nghiêm trọng**:
- **Nghiêm trọng (`Critical`)**: **5** vấn đề (`PL-01`, `PL-02`, `PL-04`, `PL-07`, `PL-08`)
- **Cao (`High`)**: **4** vấn đề (`PL-03`, `PL-05`, `PL-09`, `PL-10`)
- **Trung bình (`Medium`)**: **2** vấn đề (`PL-06`, `PL-11`)
- **Thấp (`Low`)**: **1** vấn đề (`PL-12`)
- **Tổng cộng**: **12 vấn đề** (100% đã được phân tích và cập nhật vào `docs/chart-library-design-plan.md`).

---

## 2. Biên Bản Thảo Luận & Phản Biện Chi Tiết Từng Vấn Đề (`PL-01` .. `PL-12`)

### `PL-01` [Mức độ: NGHIÊM TRỌNG] — Độ tin cậy của Server `.data/` & Nguy cơ Phân kỳ Lặng lẽ (`Split-Brain`) *(Agenda #1)*
- **Bằng chứng thực nghiệm**:
  - Tối `17/11/2026`, trên chính ứng dụng này: một phiên chạy lúc `21:28` chỉ nhìn thấy Kho Khóa `1/1` (chỉ có 1 key hạt giống từ biến môi trường), trong khi một phiên khác lúc `22:18` nhìn thấy `22/22` key.
  - Điều này chứng minh thực nghiệm rằng trong hạ tầng container của Google AI Studio (Cloud Run dev/preview):
    1. Hệ thống có thể định tuyến các phiên truy cập vào **nhiều container instance khác nhau** đang chạy song song, hoặc một container mới vừa cold-start chỉ có trạng thái khởi tạo mặc định trong khi container cũ giữ trạng thái đầy đủ trên ổ đĩa cục bộ `.data/` của riêng nó.
    2. Thư mục `.data/` trên server **KHÔNG PHẢI** là một cơ sở dữ liệu tập trung nhất quán (Single Consistent Shared Storage).
- **Ý kiến phản biện của các vai**:
  - **[Vai 3 — Kỹ sư Backend & Bảo mật]**: Trong bản kế hoạch V1, cơ chế *"Đồng bộ 2 chiều tự chữa lành (`Self-Healing Two-Way Merge`) qua `.data/chart-library.enc.json`"* dựa trên một giả định sai lầm là mọi client đều nói chuyện với **cùng một thư mục `.data/` duy nhất**. Thực tế, nếu Máy A lúc `21:28` gặp Container #2 (trống) và đẩy 5 lá số lên đó, còn Máy B lúc `22:18` gặp Container #1 (đang có 12 lá số khác), hai phía server sẽ mang 2 file `.data/chart-library.enc.json` hoàn toàn khác nhau! Tệ hơn, khi Máy A ở lần request sau được cân bằng tải nhảy sang Container #1, nó sẽ trộn lẫn hoặc ghi đè trạng thái giữa các container mà người dùng không hề hay biết.
  - **[Vai 1 — Kiến trúc sư Dữ liệu]**: Câu hỏi cốt tử của Agenda #1 là: *"Client làm sao biết đang nói chuyện với đúng một thực thể server? Xử lý sao khi hai phía server có hai thư viện khác nhau?"*
    - Về mặt kỹ thuật phân tán, muốn Client nhận biết thực thể server thì mỗi khi container khởi tạo file trong `.data/`, nó phải sinh một `serverInstanceId: string` (UUID ngẫu nhiên lưu trong `.data/.instance-id`) và trả về trong mọi response. Nếu Client thấy `serverInstanceId` đổi khác so với lần đồng bộ trước, Client biết ngay mình vừa bị chuyển sang một container khác!
    - **Tuy nhiên**, ngay cả khi phát hiện được `serverInstanceId` đã đổi, việc bắt một ứng dụng cá nhân giải quyết bài toán đồng thuận phân tán giữa nhiều container ephemeral là **sai kiến trúc (anti-pattern)**.
  - **[Vai 2 — Kỹ sư Lưu trữ Trình duyệt]** & **[Vai 4 — Chuyên gia UX]**: Nơi duy nhất bền vững 100% qua mọi lần container AI Studio restart chính là **Bộ nhớ trình duyệt trên máy của người dùng (`IndexedDB` + `localStorage`)** kết hợp với **File `.JSON` Xuất/Nhập (`Portable Backup File`)** lưu trên máy/Google Drive/Zalo cá nhân của người dùng.
- **Tranh cãi trong Panel & Kết luận xử lý**:
  - **Điểm đồng thuận tuyệt đối (5/5 vai)**: **BÁC BỎ hoàn toàn cơ chế "Đồng bộ 2 chiều tự động ngầm (`Auto Two-Way Server Sync`)" trong bản V1**. Không bao giờ cho phép Client tự động đẩy/kéo ngầm với `.data/` khi mở trang.
  - **Điểm còn 2 luồng ý kiến (trình Chủ dự án chốt tại `QĐ-L1` cập nhật)**:
    - *Luồng 1 (4/5 vai ủng hộ — Đề xuất chính `Phương án A`)*: **Cắt bỏ hoàn toàn lưu trữ Thư Viện trong `.data/` phía Server**. Thư Viện Lá Số & Hồ Sơ 8 Chương lưu 100% bền vững ở trình duyệt (`IndexedDB` + `localStorage`) và dùng **Xuất / Nhập File `.JSON` 1-Click** (hoặc Sao chép/Dán Mã Gói Thư Viện nén Base64/JSON) để mang sang máy khác. Cách này đơn giản, bền vững 100%, không bao giờ bị lỗi `1/1 vs 22/22` của `.data/` và không lộ dữ liệu cá nhân trên server.
    - *Luồng 2 (1/5 vai nêu làm phương án dự phòng `Phương án B`)*: Nếu Chủ dự án vẫn muốn có tính năng truyền nhanh qua Server giữa 2 máy đang mở cùng lúc mà không cần tải file `.json`, chỉ làm **"Trạm Trung Chuyển Tạm Thời Có Mã Phiên (`Ephemeral Transfer Slot`)"** ở Pha sau: Máy A bấm *"Đẩy lên Trạm Trung Chuyển"* → Server trả về mã phiên `serverInstanceId` (ví dụ `S-8F2A · 18 lá số`); Máy B bấm *"Nhận từ Trạm Trung Chuyển"* nếu khớp mã `S-8F2A` thì gộp 1 chiều về Máy B.

---

### `PL-02` [Mức độ: NGHIÊM TRỌNG] — Giải quyết Xung đột Đồng bộ/Gộp & Chống Hồi Sinh Bản Đã Xóa *(Agenda #2)*
- **Ý kiến phản biện của các vai**:
  - **[Vai 1 — Kiến trúc sư Dữ liệu]**: Dù chúng ta dùng **Nhập/Gộp File `.JSON`** giữa Máy A và Máy B (hay kéo 1 chiều từ trạm trung chuyển), bài toán xung đột dữ liệu vẫn tồn tại y nguyên:
    1. *Nguy cơ mất chương hồ sơ do Last-Write-Wins (LWW)*: Giả sử Máy A đã lập lá số Nguyễn Văn An và sinh xong Chương 1, 2, 3, 4 (`updatedAt = 10:00`), xuất ra file `.json`. Sang Máy B, người dùng cũng lập lá số Nguyễn Văn An và mới chỉ sinh Chương 5 (`year_2026`) lúc `11:00` (`updatedAt = 11:00`). Nếu khi nhập file `.json` từ Máy A vào Máy B mà so sánh `updatedAt` ở cấp độ cả lá số (`11:00 > 10:00`), Máy B sẽ giữ bản `11:00` (chỉ có Chương 5) và **vứt bỏ mất Chương 1, 2, 3, 4** trong file nhập! Ngược lại nếu lấy file đè lên máy thì mất Chương 5!
    2. *Nguy cơ hồi sinh bản ghi đã xóa (`Tombstone Resurrection`)*: Máy A xuất file `.json` (có Lá số X) sang Máy B. Sau đó trên Máy B người dùng xóa Lá số X. Ít hôm sau, người dùng nhập lại một file `.json` cũ hơn từ Máy A vào Máy B: nếu không có sổ cái ghi nhận Lá số X đã bị xóa lúc `deletedAt`, Lá số X sẽ tự động "sống lại"!
  - **[Vai 5 — Kỹ sư Kiểm định]**: Cần một thuật toán gộp **tất định, đơn điệu theo từng chương (`Monotonic Per-Chapter Merge`)** kèm **`deletedTombstones`**.
- **Kết luận xử lý (Đồng thuận 5/5 — Đưa vào Mục 3.4 của Bản Kế Hoạch V2)**:
  1. **Bỏ đồng bộ 2 chiều tự động**; chỉ giữ **Gộp 1 Chiều Chủ Động (`One-Way Explicit Merge`)** khi người dùng Nhập file `.JSON` (với 2 chế độ rõ ràng trên UI: **"Gộp thông minh (Khuyên dùng)"** và **"Khôi phục toàn phần (Kể cả mục đã xóa)"**).
  2. **Cấu trúc `deletedTombstones` `[MỚI]`**: Lưu mảng tối đa `200` mục `{ chartIdentityKey: string; deletedAt: number }` trong chỉ mục thư viện và trong file `.json` xuất ra.
     - Ở chế độ *"Gộp thông minh"*: Nếu một `chartIdentityKey` có mặt trong `deletedTombstones` (của máy đích hoặc của file nhập) với `deletedAt > entry.updatedAt`, bản ghi đó bị chặn không cho hồi sinh.
     - Ở chế độ *"Khôi phục toàn phần"*: Bỏ qua `deletedTombstones` của máy đích để khôi phục lại lá số trong file.
  3. **Thuật toán Gộp Đơn Điệu Từng Chương (`mergeDossierRecords`) `[MỚI]`**:
     - Duyệt qua từng chương `chId` trong 8 chương `DOSSIER_CHAPTER_SPECS`:
       - Nếu chỉ 1 bên có chương `chId` → lấy chương đó.
       - Nếu cả 2 bên đều có chương `chId`:
         - Bên nào có `status === 'completed'` và `text.trim().length > 0` luôn thắng bên có `status !== 'completed'`.
         - Nếu cả 2 bên đều `status === 'completed'`, lấy bên có `(section.updatedAt ?? record.updatedAt)` lớn hơn (nếu bằng nhau thì lấy bên có `text.length` dài hơn).
     - Nhờ đó, số chương hoàn tất sau khi gộp chỉ có **tăng hoặc giữ nguyên (`completedCount_merged >= max(completedCount_A, completedCount_B)`)**, tuyệt đối không bao giờ mất chương!

---

### `PL-03` [Mức độ: CAO] — Kiểm soát Phạm vi (`Scope Creep`) & Cắt Lát Tối Thiểu Dùng Được Ngay (`MVP`) *(Agenda #3)*
- **Ý kiến phản biện của các vai**:
  - **[Vai 4 — Chuyên gia UX]**: Bản V1 ôm đồm tới 4 pha gồm cả Server Crypto Store, REST API `/api/library/sync`, PIN guard trên `ais-pre-`, di chuyển khóa khi đổi `form.name`, chọn lá số trong `HemingView`... Với một người dùng cá nhân duy nhất, nỗi đau cấp bách nhất hiện nay là:
    1. Lập quá 10 lá số là mất lá số cũ; hai người trùng ngày giờ sinh là đè mất nhau.
    2. Sinh Hồ Sơ 8 Chương xong đóng tab là mất sạch (vì đang lưu ở `sessionStorage`).
    3. Mở danh sách lịch sử không biết lá số nào đã có hồ sơ, không tìm kiếm/ghim/ghi chú được.
    4. Đổi sang máy khác không mang theo được thư viện lá số + hồ sơ.
  - **[Vai 1 — Kiến trúc sư Dữ liệu]**: Cả 4 nỗi đau này đều được giải quyết **trọn vẹn 100% ngay ở phía Client (`IndexedDB` + `localStorage`) kết hợp Xuất/Nhập File `.JSON`**, hoàn toàn không cần xây tầng Server `.data/` phức tạp!
- **Kết luận xử lý (Đồng thuận 5/5)**:
  - Thu gọn lộ trình triển khai từ 4 pha xuống còn **2 Pha MVP gọn sắc (triển khai ngay)** và **1 Pha Mở rộng Tùy chọn (lùi lại sau khi MVP chạy thực tế)**:
    - **Pha 1 (MVP Lõi Dữ Liệu & Lưu Trữ Bền Vững)**:
      1. Chuyển lưu trữ Hồ Sơ 8 Chương từ `sessionStorage` sang bền vững (`IndexedDB` + gương RAM + hot cache `localStorage`).
      2. Thay thế `history.ts` bằng lõi `chart-library.ts` (tối đa `100` lá số, khóa chống trùng đúng, tự động di trú `'ziwei_history'` + `'ziwei_dossier_v1::*'`).
      3. Xuất / Nhập file `.json` kèm thuật toán gộp từng chương & `deletedTombstones`.
      4. Kiểm thử tự động `scripts/verify-chart-library.ts` (`TEST-L01..L10`).
    - **Pha 2 (MVP Giao Diện `ChartLibraryModal` & Nối Dây Trực Tiếp)**:
      1. Giao diện `ChartLibraryModal.tsx` (Tìm kiếm, Lọc, Sắp xếp, Ghim, `customAlias`, Ghi chú, Tiến độ 8 chương + thời điểm sinh + model, Mở nhanh Lá số / Mở thẳng Hồ sơ, Xóa có cảnh báo 2 bước, Xuất/Nhập `.JSON`).
      2. Điểm chạm trên `App.tsx`, `BirthForm.tsx` và `DetailedDossierModal.tsx` + cập nhật Tài liệu Sống.
    - **Lùi sang Pha sau (Out-of-MVP / Deferred)**:
      - Đồng bộ qua Server `.data/` (bỏ khỏi MVP vì `.data/` không đồng nhất theo `PL-01`).
      - Tích hợp bộ chọn lá số từ thư viện vào trong `HemingView.tsx` (lùi sau MVP để giữ `HemingView.tsx` ổn định tuyệt đối).
      - Hệ thống nhãn `tags[]` nhiều màu phức tạp (trong MVP chỉ cần `pinned`, `customAlias` và `notes` có thể tìm kiếm toàn văn là đã đáp ứng 100% nhu cầu phân loại).

---

### `PL-04` [Mức độ: NGHIÊM TRỌNG] — Di trú Khóa Định Danh Lá Số (`buildChartIdentityKey`) & Bài toán Đổi Tên `QĐ-L4` *(Agenda #4)*
- **Kiểm chứng mã nguồn thực tế (`[Vai 5 — Kỹ sư Kiểm định]`)**:
  - Đối chiếu giữa bản `backup/v1.0.0-stable/src/lib/ziwei/yunxian-context.ts` và bản hiện hành `src/lib/ziwei/yunxian-context.ts:292–310`:
    1. Ở bản `1.0.0-stable`, `buildChartIdentityKey(chart)` sinh khóa ngắn **5 thành phần**:
       `${b.year}_${b.month}_${b.day}_${b.hour}_${b.gender}` (ví dụ: `1995_8_16_5_male`).
    2. Ở bản `1.1.0-rc.1` (sau `QĐ-H2`), `buildChartIdentityKey(chart)` đã được mở rộng thành khóa đầy đủ **9 thành phần** phân tách bằng `__`:
       `${b.year}_${b.month}_${b.day}_${b.hour}_${b.gender}__${nameSlug}__mg${chart.mingGongBranch}__${leapFlag}__${origSig}__${lonSig}`
       (ví dụ: `1995_8_16_5_male__nguyen-van-an__mg2__leap0__1995-8-16@10:30__105.85`).
  - **Hai lỗ hổng lớn mà Agenda #4 chỉ ra**:
    - **Lỗ hổng 4A (Mồ côi hồ sơ khi di trú hoặc khi lệch khóa cũ/mới)**:
      - Nếu trong trình duyệt của người dùng đang có các bản ghi hồ sơ `ziwei_dossier_v1::1995_8_16_5_male` (định dạng 5 thành phần trước `QĐ-H2`), hoặc bản ghi `HistoryEntry` trong `localStorage['ziwei_history']` được lưu từ thời chưa có `longitude` chuẩn (hoặc `name` rỗng), khi chạy `buildChartIdentityKey(generateChart(formToBirthInfo(entry.form)))` sẽ ra khóa mới 9 thành phần. Nếu hàm di trú chỉ tìm khớp tuyệt đối `ziwei_dossier_v1::<9-part-key>`, **toàn bộ hồ sơ lưu dưới khóa 5 thành phần cũ sẽ bị bỏ sót (mồ côi)**!
    - **Lỗ hổng 4B (Rủi ro đứt gãy toàn hệ thống nếu cho sửa `form.name` theo `QĐ-L4` của bản V1)**:
      - Vì `buildChartIdentityKey` hiện tại nhúng trực tiếp `nameSlug` (chuẩn hóa từ `b.name`), nếu cho phép người dùng sửa `form.name` của một lá số đã lưu trong Thư Viện, `chartIdentityKey` sẽ thay đổi.
      - Khi `chartIdentityKey` thay đổi, không chỉ `ziwei_dossier_v1::<key>` bị đổi, mà toàn bộ các khóa phụ thuộc gồm: `aiPeriodCache` (`<key>__liunian__liunian_2026`), tối đa 10 mạch chat `ziwei_chat_v1::<key>::<contextKey>`, và định danh khi gộp file `.json` giữa 2 máy đều bị lệch! Nếu Máy A đổi `form.name` rồi xuất `.json` sang Máy B, Máy B sẽ tưởng đó là một người hoàn toàn mới và tạo bản ghi trùng lặp!
- **Kết luận xử lý dứt điểm (Đồng thuận 5/5)**:
  1. **Thuật toán Ánh xạ Khóa Kép 3 Bậc (`3-Tier Legacy Key Resolution`) khi Di trú**:
     - Với mỗi `HistoryEntry` trong `localStorage['ziwei_history']`, hàm di trú tính cả:
       - `canonicalKey` (9 thành phần từ `buildChartIdentityKey(chart)` hiện hành).
       - `legacyFivePartKey` = `${b.year}_${b.month}_${b.day}_${b.hour}_${b.gender}` (5 thành phần).
     - Quét toàn bộ các khóa `ziwei_dossier_v1::*` trong `sessionStorage` (và `localStorage`):
       - **Bậc 1 (Khớp chính xác 9 thành phần)**: Tìm `ziwei_dossier_v1::${canonicalKey}`.
       - **Bậc 2 (Khớp khóa cũ 5 thành phần)**: Tìm `ziwei_dossier_v1::${legacyFivePartKey}`.
       - **Bậc 3 (Khớp tiền tố 5 thành phần)**: Tìm mọi khóa `ziwei_dossier_v1::${legacyFivePartKey}__*` mà phần `nameSlug` khớp với `entry.form.name` (hoặc `anon`), hoặc khi chỉ có duy nhất 1 mục lịch sử mang cùng `legacyFivePartKey`.
       - Nếu tìm thấy ở Bậc 2 hoặc Bậc 3, tự động hợp nhất các chương (`mergeDossierRecords`) và nâng cấp khóa lưu trữ của `StoredDossierRecord` sang `canonicalKey` mới, đảm bảo **0% hồ sơ cũ bị mồ côi**!
  2. **Sửa quyết định `QĐ-L4` — Bất biến hóa `form` (kể cả `form.name`) sau khi lập lá số; chỉ cho phép đổi `customAlias`**:
     - Trong Thư Viện Lá Số, bộ dữ kiện gốc `form: BirthFormState` (bao gồm cả `form.name`) được giữ **bất biến (`read-only`)** để `chartIdentityKey` không bao giờ thay đổi suốt vòng đời bản ghi.
     - Người dùng muốn đặt lại tên hiển thị, sửa tên cho dễ nhớ hoặc ghi chú phân biệt sẽ sửa trường **`customAlias` (Tên hiển thị gợi nhớ)** — trường này được ưu tiên hiển thị to rõ nhất trên Thẻ Thư Viện, trên Thanh Tóm Tắt và trong Tìm kiếm, nhưng **không tác động vào `buildChartIdentityKey`**.
     - Nếu người dùng thực sự muốn lập lại lá số với một `form.name` khai sinh khác để in trang bìa mới, nút *"Nạp lên Form để sửa & lập mới"* sẽ điền dữ kiện vào `BirthForm` như một lá số mới rõ ràng.

---

### `PL-05` [Mức độ: CAO] — Vấn đề Bảo mật `KEY_POOL_ADMIN_PIN` & Giới hạn Payload `10mb` trên `ais-pre-` *(Agenda #5)*
- **Ý kiến phản biện của `[Vai 3 — Kỹ sư Backend & Bảo mật]`**:
  - Kiểm tra `server.ts:37–93` hiện hành:
    - Middleware của `/api/key-pool` hiện cho phép các lệnh đọc `GET /api/key-pool` đi qua tự do trên mọi host (kể cả `ais-pre-`) vì response của `/api/key-pool` đã che mặt nạ khóa (`AIzaSy••••••xxxx`).
    - Ngược lại, **Thư Viện Lá Số chứa Dữ liệu Cá nhân Nhạy cảm (`PII`)**: họ tên đầy đủ, ngày tháng năm giờ phút sinh, nơi sinh, ghi chú đời tư và toàn văn luận giải vận hạn.
    - Nếu dùng chung mô hình `/api/key-pool` cho `/api/library`, bất kỳ người nào mở link chia sẻ `ais-pre-` đều có thể đọc trộm toàn bộ Thư Viện Lá Số của chủ dự án qua `GET /api/library`!
    - Ngay cả khi chặn cả `GET` bằng `KEY_POOL_ADMIN_PIN`, việc dùng chung một mã PIN vừa cho quản trị hệ thống API Key vừa cho truy cập dữ liệu cá nhân, cộng với việc mở `express.json({ limit: '10mb' })` trên server Express công khai, làm tăng đáng kể bề mặt tấn công (Brute-force PIN & Memory DoS 10MB).
- **Kết luận xử lý (Đồng thuận 5/5 — Cập nhật `QĐ-L7`)**:
  - Do đã chốt tại `PL-01` và `PL-03` là **không lưu/đồng bộ Thư Viện trên Server `.data/` trong phạm vi thiết kế chuẩn**, chúng ta **KHÔNG mở bất kỳ endpoint `/api/library/*` nào trên `server.ts`** và **GIỮ NGUYÊN `express.json({ limit: '512kb' })`** (`server.ts:460`).
  - Hệ quả bảo mật:
    - Bề mặt tấn công lộ PII qua link chia sẻ `ais-pre-` = **`0%` tuyệt đối** (vì dữ liệu Thư Viện của chủ dự án chỉ nằm trên trình duyệt máy chủ dự án và trong file `.json` cá nhân của chủ dự án; người mở link `ais-pre-` chỉ thấy lá số được chia sẻ qua URL query params hoặc thư viện cục bộ trên trình duyệt của chính họ).
    - Không cần dùng chung hay làm phức tạp hóa `KEY_POOL_ADMIN_PIN`.

---

### `PL-06` [Mức độ: TRUNG BÌNH] — Đánh giá Thực chất Việc Mã Hóa Phía Server `.data/` *(Agenda #6)*
- **Ý kiến phản biện của `[Vai 3 — Kỹ sư Backend & Bảo mật]` & `[Vai 2 — Kỹ sư Lưu trữ Trình duyệt]`**:
  - Trong `server/key-pool/crypto-store.ts:20–22, 59–95`, khi không có biến môi trường `KEY_POOL_MASTER_SECRET`, khóa chủ AES-256-GCM được lưu ngay tại `.data/.pool-master.key` cạnh file `.data/gemini-key-pool.enc.json`.
  - Do đó:
    1. Nếu thư mục `.data/` bị xóa khi container reset → cả khóa lẫn dữ liệu mất cùng lúc.
    2. Nếu một tiến trình đọc được thư mục `.data/` → tiến trình đó đọc được luôn `.data/.pool-master.key` để giải mã.
    3. Với Kho Khóa Gemini (`~5 KB`), mã hóa giúp tránh lộ chuỗi `AIzaSy...` dạng rõ khi grep đĩa. Nhưng với Thư Viện Lá Số (`5–15 MB` văn bản tiếng Việt), việc mã hóa/giải mã AES-256-GCM toàn bộ khối văn bản lớn không mang lại giá trị bảo mật thực chất nào mà chỉ làm tăng độ trễ và độ phức tạp.
- **Kết luận xử lý (Đồng thuận 5/5)**:
  - **Loại bỏ hoàn toàn** thiết kế mã hóa `AES-256-GCM` cho Thư Viện Lá Số và **không đụng chạm hay tái sử dụng `KeyPoolCryptoStore` (`server/key-pool/crypto-store.ts`)**. Giữ `KeyPoolCryptoStore` chuyên biệt 100% cho Kho Khóa Gemini.

---

### `PL-07` [Mức độ: NGHIÊM TRỌNG] — Chuyển Nơi Lưu Hồ Sơ 8 Chương từ `sessionStorage` sang Bền Vững ở Pha Nào? *(Agenda #7)*
- **Ý kiến phản biện của `[Vai 2 — Kỹ sư Lưu trữ Trình duyệt]` & `[Vai 5 — Kỹ sư Kiểm định]`**:
  - Hiện tại, toàn bộ văn bản 8 chương Hồ Sơ (`StoredDossierRecord`) được lưu trong `window.sessionStorage` qua `saveDossierSectionToCache` (`src/lib/dossier-chat-ui.ts:264–303`) với khóa `'ziwei_dossier_v1::' + chartIdentityKey` và giới hạn `MAX_DOSSIERS_IN_SESSION = 5` (`dossier-chat-ui.ts:91`).
  - `window.sessionStorage` sẽ **bị xóa trắng ngay khi người dùng đóng tab trình duyệt**.
  - Nếu Thư Viện Lá Số lưu bền vững trong `localStorage` mà `StoredDossierRecord` vẫn nằm ở `sessionStorage`, thì sau khi đóng tab mở lại, mục Thư Viện vẫn hiện *"Đã có 8/8 chương"* nhưng khi bấm mở `DetailedDossierModal.tsx`, cả 8 chương đều trống rỗng!
- **Kết luận xử lý (Đồng thuận 5/5)**:
  - Việc chuyển nơi lưu trữ `StoredDossierRecord` từ `sessionStorage` sang **Kho Bền Vững Phía Trình Duyệt (`IndexedDB` kết hợp Gương RAM đồng bộ + Hot Cache `localStorage`)** là **hạng mục bắt buộc của ngay PHA 1 (MVP Lõi Lưu Trữ)**:
    1. Xây dựng kho `IndexedDB` (`dbName = 'ziwei_thien_ky_library_v1'`, object store `'dossier_records'`) để lưu bền vững tới `100` bộ `StoredDossierRecord` qua mọi lần đóng/mở tab và tắt/mở máy.
    2. Duy trì một `Map<string, StoredDossierRecord>` trên bộ nhớ RAM (`inMemoryDossierStore`) được nạp ngay khi khởi động app, giúp các hàm đọc hiện có như `readDossierCacheEntry` (`src/lib/dossier-chat-ui.ts:230`) và `saveDossierSectionToCache` (`src/lib/dossier-chat-ui.ts:264`) **giữ nguyên chữ ký hàm đồng bộ (synchronous)**, không làm gãy bất kỳ luồng render nào của `DetailedDossierModal.tsx`, đồng thời tự động ghi xuyên thấu (`write-through`) xuống `IndexedDB`!

---

### `PL-08` [Mức độ: NGHIÊM TRỌNG] — Toán Dung Lượng Byte (`Byte Budget`) & Phân Tầng Lưu Trữ Phía Client *(Agenda #8)*
- **Phân tích định lượng của `[Vai 2 — Kỹ sư Lưu trữ Trình duyệt]`**:
  - Bản dự thảo V1 ước tính 1 bộ Hồ Sơ 8 Chương chỉ khoảng `35–65 KB` là **đánh giá thấp thực tế**!
  - Hãy tính toán chính xác theo số đo thực tế của ứng dụng:
    - Mỗi chương trong 8 chương (`DOSSIER_CHAPTER_SPECS`), đặc biệt Chương 2, 3, 4 (mỗi chương phân tích 4 cung, `250–350 từ/cung` ≈ `1.200–1.500 từ`) và Chương 7, 8 (ma trận 5 năm / 10 năm), có độ dài trung bình `1.800 – 2.500 từ` tiếng Việt.
    - Tổng cộng 1 bộ Hồ Sơ 8 Chương hoàn chỉnh dài **`15.000 – 20.000 từ` tiếng Việt**, tương đương **`85.000 – 115.000 ký tự Unicode`**.
    - Khi tuần tự hóa ra JSON (kèm `incompleteText`, `meta`, `sectionCacheKey`):
      - Tính theo **UTF-8 bytes** (trên đĩa / file JSON): tiếng Việt có dấu chiếm trung bình `~1.35 bytes/ký tự` $\Rightarrow$ 1 bộ Hồ Sơ 8 Chương = **`115.000 – 160.000 bytes` (`~115 KB – 160 KB`)**.
      - Tính theo **UTF-16 code units trong `localStorage` của trình duyệt** (`2 bytes/ký tự`): 1 bộ Hồ Sơ 8 Chương chiếm **`170.000 – 230.000 bytes` (`~170 KB – 230 KB`)** hạn mức `localStorage`!
    - Trong khi đó, trần cứng của `window.localStorage` trên hầu hết trình duyệt là **`5.242.880 bytes` (`5 MB` ≈ `2.621.440` ký tự UTF-16)**.
    - Nếu lưu 100 lá số kèm 100 hồ sơ vào `localStorage`: `100 × 200 KB = 20 MB` (**vượt 400% trần 5 MB**). Ngay cả lưu 30 hồ sơ như bản V1 đề xuất (`30 × 200 KB = 6 MB`) cũng **chắc chắn gây lỗi `QuotaExceededError`**!
- **Kết luận xử lý (Đồng thuận 5/5 — Lập Bảng Ngân Sách Byte Nghiêm Ngặt tại Mục 3.2 của Kế hoạch V2)**:
  - Tách bạch tuyệt đối nhiệm vụ của `localStorage` và `IndexedDB`:
    1. **`window.localStorage` (Tổng ngân sách cấp phát cho toàn app: `<= 1.500.000 bytes` / `~1.5 MB` UTF-16, tức `< 30%` trần 5 MB)**:
       - `ziwei_chart_library_v1` **`[MỚI]`**: Chỉ lưu mảng tối đa `100` đối tượng `ChartLibraryEntry` (gồm `BirthFormState`, `deterministicBadge`, `dossierSummary` chỉ chứa con số/mảng ID chương, `customAlias` <= 80 ký tự, `notes` <= 2.000 ký tự) + tối đa `200` `deletedTombstones`. **Tuyệt đối không chứa trường `text` của bất kỳ chương hồ sơ nào**.
         - Dung lượng 1 mục: trung bình `1.800 bytes`, tối đa (khi viết kín 2.000 ký tự ghi chú) `5.500 bytes` UTF-16.
         - Ngân sách tối đa cho 100 mục + 200 tombstones: **`<= 580.000 bytes` (`~580 KB`)**.
       - `ziwei_dossier_hot_v1::<chartIdentityKey>` **`[MỚI]`** (Hot Fallback Cache trong `localStorage`): Chỉ lưu tối đa **`MAX_HOT_DOSSIERS_IN_LOCALSTORAGE = 3` bộ hồ sơ gần nhất** (`3 × 220 KB <= 660.000 bytes` / `~660 KB`) để đảm bảo lá số đang mở trên màn hình có sẵn ngay ở `localStorage` trong `0ms` ngay cả trước khi `IndexedDB` kịp khởi tạo xong.
       - `ziwei_history` (khóa cũ giữ nguyên tương thích): `~15.000 bytes` (`15 KB`).
    2. **`window.indexedDB` (Database `'ziwei_thien_ky_db_v1'`, Object Store `'dossiers'`)**:
       - Lưu toàn bộ tối đa **`100` bộ `StoredDossierRecord` đầy đủ** (1-1 với 100 lá số trong Thư Viện).
       - Ngân sách: `100 × 160 KB (UTF-8) ≈ 16.000.000 bytes` (**`~16 MB`**) — hoàn toàn nhỏ gọn so với hạn mức hàng trăm MB / hàng GB của `IndexedDB`.
    3. **Hành vi khi `localStorage` hoặc `IndexedDB` báo đầy (`QuotaExceededError`)**:
       - Với `localStorage`: Thu hồi ngay các khóa `ziwei_dossier_hot_v1::*` xuống 1 hoặc 0 mục (vì bản gốc đã nằm an toàn trong `IndexedDB` và `inMemoryDossierStore`), ưu tiên giữ 100% dung lượng `localStorage` cho chỉ mục `ziwei_chart_library_v1`.
       - Với `IndexedDB`: Chạy Thang thu hồi 4 nấc (`PL-09`) và hiển thị thanh nhắc người dùng bấm *"Xuất Thư Viện (.JSON)"*.

---

### `PL-09` [Mức độ: CAO] — Giải quyết Kẹt Cứng (`Deadlock`) trong Quy tắc Thu hồi LRU *(Agenda #9)*
- **Ý kiến phản biện của `[Vai 2 — Kỹ sư Lưu trữ Trình duyệt]` & `[Vai 5 — Kỹ sư Kiểm định]`**:
  - Bản V1 viết: *"Các lá số có `pinned === true` không bao giờ bị xóa... Nếu tất cả 100 lá số đều đã có hồ sơ hoặc ghi chú hoặc đã ghim, hiển thị thông báo mời người dùng xóa bớt thủ công"*.
  - Điều gì xảy ra khi người dùng đang ở ngoài màn hình chính (`BirthForm.tsx`), nhập ngày giờ sinh cho lá số thứ 101 và bấm *"An Sao Lập Lá Số"*? Lúc đó hàm `save` chạy ngầm; nếu nó từ chối lưu lá số thứ 101 thì lá số vừa lập không vào được Thư Viện và nếu người dùng sinh Hồ Sơ cho lá số thứ 101 đó thì hồ sơ cũng không gắn vào đâu được!
- **Kết luận xử lý (Đồng thuận 5/5)**:
  - Thiết lập **Trần Ghim Cố Định (`MAX_PINNED_ENTRIES = 30`)** kết hợp **Thang Thu Hồi Tất Định 4 Nấc (`4-Tier Deterministic Eviction Ladder`)** trên `70` vị trí không ghim:
    1. **Trần Ghim `30 / 100`**: Người dùng được ghim tối đa `30` lá số quan trọng nhất. Các mục `pinned === true` được **bảo vệ tuyệt đối 100%** (không bao giờ bị thu hồi tự động ở bất kỳ nấc nào).
    2. **Khi tổng số mục vượt `MAX_LIBRARY_ENTRIES = 100`, hệ thống luôn tìm được mục cần thu hồi trong tập `70` mục không ghim (`!pinned`) theo đúng thứ tự ưu tiên từ ít giá trị nhất đến nhiều hơn**:
       - **Nấc 1**: Mục `!pinned`, chưa có chương hồ sơ nào (`completedCount === 0 && incompleteCount === 0`), và không có ghi chú (`!notes.trim()`), chọn mục có `lastOpenedAt` nhỏ nhất (cũ nhất).
       - **Nấc 2**: Nếu Nấc 1 rỗng → Mục `!pinned`, chưa có chương hồ sơ nào (`completedCount === 0 && incompleteCount === 0`), có ghi chú, chọn mục có `lastOpenedAt` nhỏ nhất.
       - **Nấc 3**: Nếu Nấc 2 rỗng → Mục `!pinned`, có ít chương hồ sơ hoàn tất nhất (`completedCount` nhỏ nhất, ưu tiên `1..3` chương), chọn mục có `lastOpenedAt` nhỏ nhất.
       - **Nấc 4**: Nếu tất cả 70 mục `!pinned` đều đủ `8/8` chương → Chọn mục `!pinned` có `lastOpenedAt` nhỏ nhất.
    3. **Bảo vệ an toàn trước khi Nấc 2/3/4 thu hồi mục có ghi chú hoặc hồ sơ**:
       - Lưu bản ghi vừa bị đẩy ra vào một biến đệm trong phiên (`lastEvictedBackupItem` trên RAM) và hiển thị cảnh báo trên đầu Thư Viện: *"Thư viện đã đạt trần 100/100 lá số nên đã tự động dọn 1 lá số cũ chưa ghim ([Tên]). Bạn có thể bấm [Tải file .JSON sao lưu lá số vừa dọn] hoặc [Hoàn tác] ngay trong phiên này."*
       - Nhờ đó: **0% kẹt cứng (Zero Deadlock)** và **0% mất dữ liệu đột ngột**!

---

### `PL-10` [Mức độ: CAO] — Chuẩn Hóa Bộ Kiểm Thử Tự Động `TEST-L01..L10` Bám Sát Dữ Liệu Thật *(Agenda #10)*
- **Ý kiến của `[Vai 5 — Kỹ sư Kiểm định]`**:
  - Bộ test trong `scripts/verify-chart-library.ts` **`[MỚI]`** phải kiểm tra trực tiếp bằng dữ liệu thật giống hệt trong trình duyệt hiện hành, không dùng mock giả tạo sai cấu trúc.
- **Kết luận xử lý (Đồng thuận 5/5)**:
  - Đặc tả chi tiết 10 bài test bắt buộc trong Mục 6.2 của `docs/chart-library-design-plan.md`, trong đó bao phủ đầy đủ 4 kịch bản trọng tâm của Agenda #10:
    1. **Di trú từ đúng hình dạng dữ liệu cũ thật (`TEST-L03` & `TEST-L04`)**: Tạo đúng mảng `HistoryEntry` (`{ id, label, form, savedAt }`) trong khóa `'ziwei_history'` kết hợp với cả khóa hồ sơ cũ 5 thành phần (`ziwei_dossier_v1::1995_8_16_5_male`) lẫn khóa hồ sơ 9 thành phần (`ziwei_dossier_v1::1995_8_16_5_male__nguyen-van-an__...`). Kiểm chứng di trú thành công 100%, không mồ côi hồ sơ nào, trích đúng `completedChapterIds`, `lastGeneratedAt`, `modelsUsed`.
    2. **Hai người trùng ngày giờ sinh khác tên hoặc khác nơi sinh (`TEST-L01`)**: Cùng sinh `16/08/1995`, `10:30`, `male`, nhưng người 1 tên `"Nguyễn Văn An"` và người 2 tên `"Trần Bình Minh"` (hoặc người 1 ở `"Hà Nội"` `105.85` và người 2 ở `"Điện Biên Phủ"` `103.02`) → phải tạo ra 2 bản ghi độc lập, không đè nhau.
    3. **Xóa tạo Tombstone rồi đồng bộ/nhập JSON không bị hồi sinh (`TEST-L07`)**: Xóa 1 lá số (ghi nhận `deletedTombstone`), sau đó nhập file `.json` cũ có chứa lá số đó ở chế độ Gộp thông minh → lá số đã xóa tuyệt đối không sống lại; các lá số khác vẫn được gộp đủ chương hồ sơ theo từng chương (`TEST-L06`).
    4. **Đầy dung lượng 100 mục & Bảo vệ 30 mục Ghim + Mô phỏng `QuotaExceededError` (`TEST-L08` & `TEST-L09`)**: Nạp đầy 100 mục (30 mục `pinned: true` + 70 mục có hồ sơ/ghi chú), thêm mục thứ 101 → Thang thu hồi 4 nấc chạy chính xác, giữ nguyên 30 mục `pinned: true` và giữ `lastEvictedBackupItem`; mô phỏng `localStorage` ném `QuotaExceededError` khi ghi hot dossier → tự động thu hồi hot dossier trong `localStorage` mà giữ nguyên chỉ mục 100 lá số và bản lưu trong `IndexedDB`.

---

### `PL-11` [Mức độ: TRUNG BÌNH] — Đồng bộ 2 Chiều giữa Hồ Sơ Bền Vững trong Thư Viện và `aiPeriodCache` khi Đổi Lá Số
- **Vai nêu**: `[Vai 1 — Kiến trúc sư Dữ liệu]` & `[Vai 5 — Kỹ sư Kiểm định]`.
- **Phân tích trên code thật**:
  - Tại `src/App.tsx:66`, state `aiPeriodCache` lưu kết quả luận giải Lưu Niên (bao gồm năm 2026 và 2027).
  - Khi người dùng mở một lá số từ Thư Viện (hoặc khi vừa khởi động lại trình duyệt), nếu lá số đó đã có Chương 5 (`year_2026`) và Chương 6 (`year_2027`) lưu bền vững trong Thư Viện (`IndexedDB`), cần tự động nạp 2 chương này vào `aiPeriodCache` (theo khóa `buildPeriodCacheKeyForYear(chart, 2026)` và `2027` tại `src/lib/dossier-chat-ui.ts:69–71`) để cả tab Vận Hạn ở `InsightPanel.tsx` lẫn `DetailedDossierModal.tsx` đều thấy ngay kết quả đã lưu mà không phải gọi lại AI!
- **Kết luận xử lý**: Bổ sung hàm `hydratePeriodCacheFromLibraryDossier(chart, dossierRecord)` **`[MỚI]`** vào luồng mở lá số và mở Modal.

---

### `PL-12` [Mức độ: THẤP] — Kiểm tra Schema & Làm sạch Hậu kiểm (`Sanitizer 3A + 3B`) khi Nhập File `.JSON`
- **Vai nêu**: `[Vai 3 — Kỹ sư Backend & Bảo mật]` & `[Vai 5 — Kỹ sư Kiểm định]`.
- **Phân tích**: Khi người dùng nhập một file `.json` từ bên ngoài, file có thể bị sửa tay hoặc chứa văn bản chương từ phiên bản cũ chưa qua bộ lọc hậu kiểm mới.
- **Kết luận xử lý**: Hàm `importLibraryFromJsonWithMerge` **`[MỚI]`** bắt buộc kiểm tra hợp lệ từng trường `BirthFormState` (năm `1900..2100`, tháng `1..12`, ngày hợp lệ theo lịch Gregorius qua `isValidGregorianDate`, giờ `0..23`, phút `0..59`, kinh độ `-180..180`), cắt trần `notes` ở `2.000` ký tự, và chạy `sanitizeDossierChapterText` (`src/lib/dossier-chat-ui.ts:170`) trên toàn bộ các chương được nhập vào.

---

## 3. Tóm Tắt Biến Động Các Quyết Định `QĐ-L` Sau Phản Biện Panel

| Mã QĐ | Trạng thái sau Panel | Tóm tắt thay đổi so với bản V1 trước Panel |
|:---:|:---:|---|
| **`QĐ-L1`** | **SỬA LỚN** *(Còn 2 phương án trình Chủ dự án chốt)* | **Bác bỏ đồng bộ 2 chiều tự động qua `.data/` phía Server** (do sự cố `.data/` `1/1 vs 22/22` gây phân kỳ `Split-Brain`). Chuyển **Phương án A (Đề xuất)** thành: **Lưu trữ bền vững 2 tầng phía Client (`localStorage` cho chỉ mục 100 lá số + `IndexedDB` & Gương RAM cho 100 Hồ Sơ 8 Chương) kết hợp Xuất / Nhập File `.JSON` Di Động 1-Click** (kèm Gộp đơn điệu từng chương & `deletedTombstones`). Phương án B (nếu muốn): giữ thêm Trạm trung chuyển 1 chiều chủ động có gắn `serverInstanceId` ở Pha sau. |
| **`QĐ-L2`** | **SỬA BỔ SUNG** | Giữ nguyên khóa chống trùng chuẩn theo `buildChartIdentityKey` (phân biệt tên, nơi sinh/kinh độ, `unknownTime`), **bổ sung Thuật toán Ánh xạ Khóa Kép 3 Bậc (`V2 9-part → V1 5-part → Prefix`)** khi di trú để không làm mồ côi bất kỳ hồ sơ cũ nào trong `sessionStorage`. |
| **`QĐ-L3`** | **SỬA LỚN** | Giữ trần `100` lá số và `2.000` ký tự ghi chú, nhưng **bổ sung Bảng Ngân Sách Byte (`localStorage <= 1.5 MB`, văn bản 100 hồ sơ nằm ở `IndexedDB`)**, đặt trần **tối đa `30` mục Ghim (`MAX_PINNED_ENTRIES = 30`)** và **Thang thu hồi tất định 4 nấc** trên 70 mục không ghim để triệt tiêu 100% lỗi kẹt cứng (`Deadlock`) và lỗi tràn `5 MB`. |
| **`QĐ-L4`** | **ĐẢO CHIỀU PHƯƠNG ÁN ĐỀ XUẤT** | Thay vì cho sửa trực tiếp `form.name` của bản ghi đã lưu (gây đổi `chartIdentityKey` và đứt liên kết Chat/`aiPeriodCache`/JSON sync), chốt đề xuất: **Giữ `form` (gồm `form.name`) bất biến sau khi lập; chỉ đổi Tên hiển thị gợi nhớ (`customAlias`)** trong Thư Viện (kèm nút *"Nạp lên Form để sửa & lập lá số mới"* nếu muốn đổi tên khai sinh). |
| **`QĐ-L5`** | **TINH GỌN (THU HẸP MVP)** | Giữ nút `Thư Viện (N)` trên Header + `ChartLibraryModal` + tiến độ `X/8` trên `App.tsx` + danh sách rút gọn trong `BirthForm.tsx`; **lùi tính năng chọn đương số từ thư viện trong `HemingView.tsx` và hệ thống `tags` phức tạp sang Pha sau** để MVP gọn nhẹ. |
| **`QĐ-L6`** | **GIỮ NGUYÊN** | Giữ nguyên hộp xác nhận xóa 2 bước (hiển thị rõ tiến độ `X/8` chương, thời gian sinh, model) với 2 chế độ: *Chỉ xóa Hồ Sơ (giữ Lá Số & Ghi chú)* hoặc *Xóa vĩnh viễn cả Lá Số & Hồ Sơ* (kèm ghi `deletedTombstone`). |
| **`QĐ-L7`** | **THAY THẾ HOÀN TOÀN** | **Bác bỏ việc dùng chung `KEY_POOL_ADMIN_PIN`, bác bỏ mã hóa `AES-256-GCM` giả tạo cho thư viện và bác bỏ mở limit `10mb` trên `server.ts`**. Giữ dữ liệu cá nhân (PII) của Thư Viện 100% ở Client + File `.JSON` cá nhân để bề mặt lộ lọt qua link chia sẻ `ais-pre-` bằng **0 tuyệt đối**, giữ nguyên `express.json({ limit: '512kb' })` tại `server.ts:460`. |
