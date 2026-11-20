# KẾ HOẠCH THIẾT KẾ CHI TIẾT (SAU PHẢN BIỆN PANEL): THƯ VIỆN LÁ SỐ & LƯU TRỮ BỀN VỮNG HỒ SƠ (`docs/chart-library-design-plan.md`)

- **Loại tài liệu**: `[Tài liệu Sống — Kế hoạch Thiết kế Kiến trúc & Đặc tả Kỹ thuật Chi tiết (Post-Panel Design Plan V2)]`
- **Trạng thái hiệu lực**: `BẢN ĐÃ CHI TIẾT HÓA SAU PANEL (POST-PANEL V2 — CHỜ CHỐT QĐ-L1..QĐ-L7)`
- **Áp dụng cho phiên bản ứng dụng**: `1.1.0-rc.1` *(hướng tới `1.2.0` sau khi phê duyệt)*
- **Cập nhật lần cuối**: `17/11/2026` *(Bản V2 sau phiên họp Tổ Chuyên Gia Mô Phỏng 5 Vai — đối chiếu [`docs/chart-library-expert-panel-review.md`](chart-library-expert-panel-review.md))*
- **Mã nguồn đối chiếu (Code SSOT)**: `src/lib/ziwei/history.ts`, `src/lib/dossier-chat-ui.ts`, `src/lib/ziwei/yunxian-context.ts`, `src/lib/ziwei/share.ts`, `src/lib/ziwei/types.ts`, `src/App.tsx`, `src/components/BirthForm.tsx`, `src/components/DetailedDossierModal.tsx`, `server/key-pool/crypto-store.ts`, `server.ts`
- **Quyết định & Biên bản liên quan**:
  - Đã hiệu lực (nền tảng): `QĐ-1`, `QĐ-2`, `F1`, `F4`, `QĐ-G2`, `QĐ-G5`, `QĐ-H1`, `QĐ-H2` *(xem `docs/decisions-registry.md`)*
  - Biên bản phản biện Panel: `PL-01` .. `PL-12` tại [`docs/chart-library-expert-panel-review.md`](chart-library-expert-panel-review.md)
  - Quyết định trình Chủ dự án chốt (`[MỚI]`): `QĐ-L1`, `QĐ-L2`, `QĐ-L3`, `QĐ-L4`, `QĐ-L5`, `QĐ-L6`, `QĐ-L7`

> **Tóm tắt các thay đổi lớn trong Bản V2 sau Phản biện Panel (`PL-01` .. `PL-12`)**:
> 1. **`[CẬP NHẬT LỚN SAU PANEL PL-01, PL-05, PL-06]` — Bác bỏ Đồng bộ 2 Chiều Tự động qua Server `.data/` & Mã hóa giả tạo**: Bằng chứng thực nghiệm tối `17/11/2026` (phiên `21:28` thấy `1/1` key trong khi phiên `22:18` thấy `22/22` key) chứng minh `.data/` phía server AI Studio không đồng nhất giữa các phiên/instance. Đồng bộ 2 chiều tự động dựa trên `.data/` sẽ gây phân kỳ lặng lẽ (`Split-Brain`) và mở bề mặt lộ dữ liệu cá nhân (PII) qua link chia sẻ `ais-pre-`. Bản V2 chuyển sang kiến trúc **Client-First Bền Vững 2 Tầng (`localStorage` + `IndexedDB` kèm Gương RAM đồng bộ) + Xuất/Nhập File `.JSON` Di Động 1-Click** (kèm tùy chọn Trạm trung chuyển 1 chiều có gắn `serverInstanceId` nếu Chủ dự án yêu cầu).
> 2. **`[CẬP NHẬT LỚN SAU PANEL PL-07, PL-08]` — Chuyển Hồ Sơ 8 Chương sang `IndexedDB` ngay ở Pha 1 & Lập Bảng Ngân Sách Byte chính xác**: Một bộ Hồ Sơ 8 Chương dài `15.000–20.000` từ (`~115–160 KB` UTF-8, tức `~170–230 KB` UTF-16 trong `localStorage`). Lưu 30–100 hồ sơ trong `localStorage` sẽ nổ trần `5 MB`. Bản V2 quy định `localStorage` chỉ giữ chỉ mục 100 lá số (`<= 580 KB`) + tối đa 3 hồ sơ nóng (`<= 660 KB`), còn toàn văn 100 bộ `StoredDossierRecord` nằm bền vững trong `IndexedDB` (`~16 MB`) kèm Gương RAM (`inMemoryDossierMirror`).
> 3. **`[CẬP NHẬT LỚN SAU PANEL PL-02, PL-04]` — Ánh xạ Khóa Kép 3 Bậc khi Di trú (`V2 9-part → V1 5-part → Prefix`), Bất biến hóa `form.name` (`QĐ-L4`) & Gộp Đơn Điệu Từng Chương + `deletedTombstones`**: Đảm bảo 0% hồ sơ cũ bị mồ côi, đổi tên hiển thị qua `customAlias` không làm đứt khóa cache, và xóa ở máy A không bị hồi sinh khi gộp file JSON.
> 4. **`[CẬP NHẬT LỚN SAU PANEL PL-03, PL-09, PL-10]` — Tinh gọn Lộ trình còn 2 Pha MVP, Thang Thu hồi 4 Nấc chống kẹt (`MAX_PINNED_ENTRIES = 30`) & Đặc tả 10 Bài Test Tự Động bám sát dữ liệu thật**.

---

## 0. Căn Cứ Hiện Trạng Đã Kiểm Chứng Trên Codebase

Toàn bộ hiện trạng lưu trữ lịch sử lá số, hồ sơ luận giải và hành vi hạ tầng đã được đối chiếu trực tiếp trên mã nguồn hiện hành (`1.1.0-rc.1`):

### 0.1. Hiện trạng Lịch sử Lá số (`src/lib/ziwei/history.ts:1–65`)
1. **Vị trí & Giới hạn lưu trữ**:
   - Lưu trong `window.localStorage` tại khóa cứng `STORAGE_KEY = 'ziwei_history'` (`src/lib/ziwei/history.ts:4`), giới hạn cứng `MAX_ENTRIES = 10` mục (`src/lib/ziwei/history.ts:5`).
2. **Cấu trúc bản ghi `HistoryEntry` (`src/lib/ziwei/history.ts:7–12`)**:
   - Chỉ gồm 4 trường: `id: string` (`Date.now().toString()`), `label: string`, `form: BirthFormState` (`src/lib/ziwei/types.ts:1–13`), `savedAt: number` (`Date.now()`).
3. **Thao tác & Lỗi chống trùng ghi đè**:
   - Hook `useHistory()` (`src/lib/ziwei/history.ts:14–64`) chỉ có `save(form: BirthFormState)` và `remove(id: string)`.
   - Khối chống trùng tại `src/lib/ziwei/history.ts:41–48` chỉ xét `year`, `month`, `day`, `gender`, `clockHour`, `clockMinute` — **bỏ qua hoàn toàn `form.name`, `form.unknownTime`, `form.province`, `form.city` và `form.longitude`**. Hai người khác nhau trùng ngày giờ sinh và giới tính (hoặc cùng ngày giờ nhưng sinh ở hai tỉnh khác kinh độ dẫn tới Chân Thái Dương Thời khác canh giờ) sẽ **ghi đè mất nhau**.
   - Hoàn toàn không có: tìm kiếm, lọc, sắp xếp, đổi tên gợi nhớ, ghi chú, ghim cố định, hay xuất/nhập.

### 0.2. Hiện trạng Lưu trữ Hồ sơ Luận giải 8 Chương (`src/lib/dossier-chat-ui.ts`) & Lịch sử Khóa Định Danh
1. **Kho lưu trữ Hồ sơ 8 Chương (`DOSSIER_CHAPTER_SPECS` tại `src/lib/dossier-chat-ui.ts:654–727`)**:
   - Lưu trong `window.sessionStorage` (`getBrowserSessionStorage()` tại `dossier-chat-ui.ts:106–115`) dưới kiểu `StoredDossierRecord` (`dossier-chat-ui.ts:750–754`):
     ```ts
     export interface StoredDossierRecord {
       chartIdentityKey: string;
       updatedAt: number;
       sections: Partial<Record<DossierChapterId, DossierChapterState>>;
     }
     ```
   - Khóa lưu trữ: `buildDossierStorageKey(chartIdentityKey)` = `'ziwei_dossier_v1::' + chartIdentityKey` (`dossier-chat-ui.ts:84–86`), chỉ mục LRU `DOSSIER_LRU_INDEX_KEY = 'ziwei_dossier_lru_index_v1'` (`dossier-chat-ui.ts:93`), tối đa `MAX_DOSSIERS_IN_SESSION = 5` hồ sơ (`dossier-chat-ui.ts:91`).
   - Mạch chat lưu ở `window.sessionStorage` theo khóa `buildChatStorageKey(chartIdentityKey, contextKey)` = `'ziwei_chat_v1::' + chartIdentityKey + '::' + contextKey` (`dossier-chat-ui.ts:80–82`), LRU `MAX_CHAT_THREADS_IN_SESSION = 10` (`dossier-chat-ui.ts:90`).
2. **Hai thế hệ định dạng của `buildChartIdentityKey(chart)` trên thực tế (`[KIỂM CHỨNG TẠI PL-04]`)**:
   - Ở bản `1.0.0-stable` (`backup/v1.0.0-stable/src/lib/ziwei/yunxian-context.ts`), hàm `buildChartIdentityKey` chỉ ghép **5 thành phần**:
     `${b.year}_${b.month}_${b.day}_${b.hour}_${b.gender}` (ví dụ: `1995_8_16_5_male`).
   - Ở bản `1.1.0-rc.1` hiện hành (`src/lib/ziwei/yunxian-context.ts:292–310`, sau `QĐ-H2`), hàm `buildChartIdentityKey` ghép **9 thành phần**:
     `${b.year}_${b.month}_${b.day}_${b.hour}_${b.gender}__${nameSlug}__mg${chart.mingGongBranch}__${leapFlag}__${origSig}__${lonSig}`.
   - Do đó, các hồ sơ tồn tại trong trình duyệt có thể mang khóa 5 thành phần cũ hoặc khóa 9 thành phần mới; thuật toán di trú bắt buộc phải ánh xạ được cả hai.
3. **Đứt gãy hiển thị & Mất trắng khi đóng tab**:
   - Lịch sử (`localStorage['ziwei_history']`) và Hồ sơ (`sessionStorage['ziwei_dossier_v1::*']`) không liên kết hiển thị với nhau: mở mục lịch sử ở `src/components/BirthForm.tsx:248–276` chỉ nạp lại `form` sinh, không cho biết lá số đó đã có chương nào, sinh lúc nào (`updatedAt`), bằng model nào (`meta.modelUsed`).
   - Vì `StoredDossierRecord` nằm ở `sessionStorage`, **đóng tab trình duyệt là mất trắng toàn bộ 8 chương hồ sơ**.

### 0.3. Bằng chứng Thực nghiệm về Sự Bất Ổn của `.data/` Phía Server AI Studio (`[KIỂM CHỨNG TẠI PL-01]`)
- Kho key Gemini hiện lưu phía server tại `.data/gemini-key-pool.enc.json` kèm `.data/.pool-master.key` (`server/key-pool/crypto-store.ts:20–22`, mã hóa `AES-256-GCM`).
- **Bằng chứng thật tối `17/11/2026`**: Một phiên truy cập lúc `21:28` chỉ thấy Kho Khóa `1/1` (chỉ có 1 key hạt giống từ biến môi trường), trong khi một phiên khác lúc `22:18` lại thấy `22/22` key.
- Điều này chứng minh thư mục `.data/` phía server của AI Studio **không bền vững và không đồng nhất giữa các phiên/máy** (do cơ chế phân bổ nhiều container instance hoặc container cold-start độc lập của Cloud Run).

---

## 1. Mục Tiêu, Phạm Vi Đã Tinh Gọn Sau Panel (`MVP`) & Chân Dung Người Dùng

### 1.1. Chân dung người dùng chính
- **Một người dùng cá nhân duy nhất** (Chủ dự án / nhà nghiên cứu Tử Vi) sử dụng ứng dụng trên nhiều máy tính / trình duyệt khác nhau để lập, tra cứu, ghi chú nghiệm lý và lưu trữ lâu dài các lá số cùng **Hồ Sơ Luận Giải 8 Chương** đi kèm.

### 1.2. Phạm vi Đã Tinh Gọn Sau Panel (`[CẬP NHẬT SAU PANEL PL-03]`)

Để tránh phình phạm vi (`over-engineering`) và tập trung giải quyết dứt điểm 100% nỗi đau thực tế bằng giải pháp đáng tin cậy nhất, phạm vi tính năng được phân định rõ:

| Hạng mục thuộc Lát Cắt Cốt Lõi Dùng Được Ngay (MVP — Pha 1 & Pha 2) | Hạng mục Cắt Bỏ hoặc Lùi Pha Sau (Out-of-MVP / Deferred) |
|---|---|
| 1. **Chuyển nơi lưu Hồ Sơ 8 Chương (`StoredDossierRecord`) từ `sessionStorage` sang Bền Vững (`IndexedDB` + Gương RAM đồng bộ + Hot Cache `localStorage`)** ngay từ Pha 1: đóng tab hay tắt máy mở lại không mất bất kỳ chương nào.<br>2. **Thư Viện Lá Số bền vững (tối đa `100` lá số)** thay thế giới hạn 10 mục của `history.ts`: liên kết 1-1 giữa `BirthFormState`, `chartIdentityKey` và `StoredDossierRecord`.<br>3. **Khóa chống trùng chuẩn xác**: Phân biệt hai người trùng ngày giờ sinh nhưng khác tên, khác nơi sinh/kinh độ hoặc khác cờ `unknownTime`.<br>4. **Tự động di trú dữ liệu cũ (`3-Tier Legacy Key Matcher`)**: Nâng cấp `'ziwei_history'` và liên kết ngược với cả khóa hồ sơ 5 thành phần cũ lẫn 9 thành phần mới trong `'ziwei_dossier_v1::*'`.<br>5. **Xuất / Nhập Thư Viện dạng File `.JSON` Di Động 1-Click** kèm thuật toán **Gộp Đơn Điệu Từng Chương (`Per-Chapter Merge`)** và **Sổ cái Xóa (`deletedTombstones`)** để mang sang máy khác không mất một chữ.<br>6. **Giao diện `ChartLibraryModal.tsx` đầy đủ thao tác**: Tìm kiếm, Lọc, Sắp xếp, Ghim (`pinned`, tối đa 30), Đổi tên gợi nhớ (`customAlias`), Ghi chú (`notes`, tối đa 2.000 ký tự), Xem tiến độ 8 ô chương hồ sơ + thời điểm sinh + model đã dùng, Mở nhanh Lá số / Mở thẳng Hồ sơ, Xóa có cảnh báo 2 bước. | 1. **BÁC BỎ đồng bộ 2 chiều tự động ngầm qua `.data/` phía Server** (`PL-01`): Tránh lỗi phân kỳ `Split-Brain` giữa các container (`1/1` vs `22/22`) và tránh lộ dữ liệu cá nhân (PII) trên `ais-pre-` (`PL-05`). *(Nếu Chủ dự án muốn có kênh truyền qua Server trong cùng phiên, chỉ làm Trạm Trung Chuyển 1 Chiều có `serverInstanceId` ở Pha 3 tùy chọn)*.<br>2. **BÁC BỎ mã hóa `AES-256-GCM` cho Thư Viện trên Server** (`PL-06`): Giữ `KeyPoolCryptoStore` độc quyền cho Kho Khóa Gemini.<br>3. **BÁC BỎ việc sửa trực tiếp `form.name` của bản ghi đã lưu trong Thư Viện** (`PL-04`): Giữ `form` khai sinh bất biến để không làm đổi `chartIdentityKey`; dùng `customAlias` để đổi tên hiển thị.<br>4. **Lùi sang Pha sau**: Tích hợp bộ chọn lá số từ thư viện vào `HemingView.tsx` và hệ thống quản lý mảng `tags[]` phức tạp (trong MVP dùng `pinned`, `customAlias` và tìm kiếm toàn văn trên `notes`). |

---

## 2. Thiết Kế Dữ Liệu Đầy Đủ Từng Trường (`[CẬP NHẬT SAU PANEL PL-02, PL-04, PL-08, PL-09]`)

Toàn bộ kiểu dữ liệu và hàm quản lý của Thư Viện Lá Số được đặt tại file mới **`src/lib/chart-library.ts` `[MỚI]`**. Dưới đây là đặc tả đầy đủ từng trường dữ liệu tới mức triển khai trực tiếp:

### 2.1. Hằng số Cấu hình & Giới hạn Ngân sách (`src/lib/chart-library.ts` `[MỚI]`)

```ts
// [MỚI] Phiên bản schema lưu trữ & xuất bản
export const CHART_LIBRARY_SCHEMA_VERSION = 1 as const;

// [MỚI] Khóa lưu trữ trong window.localStorage
export const LIBRARY_INDEX_STORAGE_KEY = 'ziwei_chart_library_v1';
export const LIBRARY_MIGRATED_FLAG_KEY = 'ziwei_chart_library_migrated_v1';
export const HOT_DOSSIER_STORAGE_PREFIX = 'ziwei_dossier_hot_v1::';
export const HOT_DOSSIER_LRU_INDEX_KEY = 'ziwei_dossier_hot_lru_v1';

// [MỚI] Cấu hình IndexedDB cho kho Hồ Sơ 8 Chương bền vững
export const LIBRARY_IDB_NAME = 'ziwei_thien_ky_library_db_v1';
export const LIBRARY_IDB_VERSION = 1;
export const LIBRARY_IDB_DOSSIER_STORE = 'dossier_records';

// [MỚI] Hằng số giới hạn số lượng & kích thước
export const MAX_LIBRARY_ENTRIES = 100;             // Tối đa 100 lá số trong Thư Viện
export const MAX_PINNED_ENTRIES = 30;               // [PL-09] Tối đa 30 lá số được ghim (đảm bảo luôn còn >= 70 slot cho LRU)
export const MAX_DELETED_TOMBSTONES = 200;          // [PL-02] Tối đa 200 dấu vết xóa để chống hồi sinh khi gộp JSON
export const TOMBSTONE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // Giữ tombstone 90 ngày
export const MAX_HOT_DOSSIERS_LOCALSTORAGE = 3;     // [PL-08] Tối đa 3 bộ hồ sơ nóng trong localStorage (~500–660 KB)
export const LIBRARY_MAX_ALIAS_CHARS = 80;          // Độ dài tối đa tên gợi nhớ customAlias
export const LIBRARY_MAX_NOTE_CHARS = 2_000;        // Độ dài tối đa ghi chú cá nhân notes
```

### 2.2. Cấu trúc Thực thể Thư Viện (`ChartLibraryEntry` & `ChartLibraryStorePayload` `[MỚI]`)

```ts
import type { BirthFormState, ZiweiChart } from './ziwei/types';
import type {
  DossierChapterId,
  DossierChapterState,
  StoredDossierRecord,
} from './dossier-chat-ui';

/**
 * [MỚI] Tóm tắt trạng thái của 1 chương trong Hồ Sơ 8 Chương (chỉ lưu meta siêu nhẹ, KHÔNG lưu text)
 * Kích thước JSON: ~140 - 180 bytes / chương
 */
export interface LibraryChapterStatusMeta {
  chapterId: DossierChapterId;                      // Một trong 8 mã DOSSIER_CHAPTER_SPECS
  status: 'completed' | 'incomplete';               // Chỉ lưu bền vững chương đã hoàn tất hoặc dở dang có chữ
  updatedAt: number;                                // Epoch ms lúc sinh/cập nhật chương
  modelUsed: string | null;                         // Lấy từ DossierChapterState.meta?.modelUsed ?? null
  charCount: number;                                // Độ dài chuỗi văn bản (số ký tự Unicode)
}

/**
 * [MỚI] Tổng hợp trạng thái Hồ Sơ 8 Chương gắn vào ChartLibraryEntry
 * Kích thước JSON: ~350 - 1.400 bytes / lá số
 */
export interface LibraryDossierSummary {
  totalChapters: 8;                                 // Hằng số 8 chương
  completedCount: number;                           // Số chương có status === 'completed' (0..8)
  incompleteCount: number;                          // Số chương có status === 'incomplete' (0..8)
  completedChapterIds: DossierChapterId[];          // Mảng theo đúng thứ tự 1..8 của DOSSIER_CHAPTER_SPECS
  incompleteChapterIds: DossierChapterId[];         // Mảng chương đang dở
  lastGeneratedAt: number | null;                   // max(updatedAt) của các chương đã có, hoặc null nếu 0/8
  modelsUsed: string[];                             // Danh sách model duy nhất đã dùng (VD: ['gemini-3.5-flash-lite'])
  totalCharCount: number;                           // Tổng số ký tự của toàn bộ các chương hiện có
  chapterMetaMap: Partial<Record<DossierChapterId, LibraryChapterStatusMeta>>;
}

/**
 * [MỚI] Tóm tắt mệnh bàn xác định (tính 1 lần từ generateChart(formToBirthInfo(form)))
 * Giúp hiển thị thẻ lá số & tìm kiếm theo chính tinh/cục/âm lịch trong 0ms mà không phải chạy lại engine.
 * Kích thước JSON: ~320 - 450 bytes / lá số
 */
export interface LibraryDeterministicBadge {
  solarDateStr: string;                             // VD: "16/08/1995"
  lunarDateStr: string;                             // VD: "20/07/1995 (Ất Hợi)"
  yearCanZhiVi: string;                             // VD: "Ất Hợi"
  shichenLabelVi: string;                           // VD: "Giờ Tỵ" hoặc "Chưa rõ giờ (mặc định Giờ Tý)"
  clockTimeLabelVi: string;                         // VD: "10:30" hoặc "Chưa rõ giờ"
  trueSolarTimeLabelVi: string | null;              // VD: "10:13 (-17p)" hoặc null khi unknownTime
  locationLabelVi: string;                          // VD: "Hà Nội (105.85°Đ)"
  yinYangGenderVi: string;                          // VD: "Âm Nam"
  wuxingJuVi: string;                               // VD: "Hỏa Lục Cục"
  mingGongBranchVi: string;                         // VD: "Dần"
  mingMajorStarsVi: string;                         // VD: "Cự Môn, Thái Dương" hoặc "Vô chính diệu"
  mingZhuVi: string;                                // VD: "Lộc Tồn"
  shenZhuVi: string;                                // VD: "Hỏa Tinh"
}

/**
 * [MỚI] Thực thể đại diện cho 1 Lá Số trong chỉ mục Thư Viện
 * Lưu ý quan trọng (PL-04): Trường `form` và `chartIdentityKey` là BẤT BIẾN sau khi tạo.
 * Kích thước JSON: trung bình ~1.8 KB, tối đa ~5.5 KB (khi notes dài đủ 2.000 ký tự).
 */
export interface ChartLibraryEntry {
  chartIdentityKey: string;                         // Khóa chính chuẩn (9 thành phần từ buildChartIdentityKey)
  legacyFivePartKey: string;                        // [PL-04] Khóa 5 thành phần "${year}_${month}_${day}_${hour}_${gender}" để đối sánh di trú
  form: Readonly<BirthFormState>;                   // [PL-04] Dữ kiện sinh gốc BẤT BIẾN (src/lib/ziwei/types.ts:1–13)
  customAlias: string;                              // [MỚI] Tên gợi nhớ tùy chỉnh (<= 80 ký tự); rỗng "" thì hiển thị form.name
  notes: string;                                    // [MỚI] Ghi chú nghiệm lý cá nhân (<= 2.000 ký tự)
  pinned: boolean;                                  // [MỚI] Cờ ghim cố định lên đầu (tối đa 30 mục ghim)
  pinnedAt: number | null;                          // [MỚI] Epoch ms lúc ghim (dùng để sắp xếp các mục cùng ghim)
  deterministicBadge: LibraryDeterministicBadge;    // [MỚI] Tóm tắt mệnh bàn xác định
  dossierSummary: LibraryDossierSummary;            // [MỚI] Tóm tắt trạng thái Hồ Sơ 8 Chương
  createdAt: number;                                // Epoch ms lúc lưu lá số lần đầu (kế thừa HistoryEntry.savedAt khi di trú)
  updatedAt: number;                                // Epoch ms lúc sửa alias/notes/pin hoặc cập nhật hồ sơ gần nhất
   notesUpdatedAt: number;                          // [PL-02] Epoch ms lúc sửa riêng customAlias/notes (để gộp ghi chú chính xác)
  lastOpenedAt: number;                             // Epoch ms lúc người dùng mở lá số lên Thiên Bàn gần nhất
}

/**
 * [MỚI - PL-02] Bản ghi đánh dấu xóa (Tombstone) để chống "hồi sinh" khi gộp file JSON cũ
 */
export interface DeletedChartTombstone {
  chartIdentityKey: string;
  deletedAt: number;                                // Epoch ms lúc người dùng xác nhận xóa vĩnh viễn lá số
}

/**
 * [MỚI] Cấu trúc lưu trong localStorage tại khóa 'ziwei_chart_library_v1'
 */
export interface ChartLibraryIndexStore {
  schemaVersion: 1;
  updatedAt: number;
  entries: ChartLibraryEntry[];                     // Tối đa 100 mục
  deletedTombstones: DeletedChartTombstone[];       // Tối đa 200 mục trong 90 ngày
}

/**
 * [MỚI] Cấu trúc gói File .JSON Xuất / Nhập Di Động (Portable Library Bundle)
 */
export interface ChartLibraryExportBundle {
  bundleType: 'tu-vi-thien-ky-chart-library';
  schemaVersion: 1;
  appVersion: string;                               // VD: "1.1.0-rc.1"
  exportedAt: number;                               // Epoch ms lúc kết xuất file
  exportedAtIso: string;                            // Chuỗi ISO-8601 dễ đọc
  entries: ChartLibraryEntry[];
  dossiers: Record<string, StoredDossierRecord>;    // Map từ chartIdentityKey -> StoredDossierRecord (8 chương)
  deletedTombstones: DeletedChartTombstone[];
}
```

### 2.3. Thiết kế Khóa Chống Trùng Đúng & Quy tắc Bất Biến `form` (`[CẬP NHẬT SAU PANEL PL-04]`)

1. **Hàm chuẩn hóa dữ kiện sinh trước khi tính khóa (`normalizeBirthFormForLibrary` `[MỚI]`)**:
   - Cắt khoảng trắng thừa đầu/cuối của `form.name.trim().slice(0, 32)`.
   - Khi `form.unknownTime === true`: ép cứng `clockHour = '0'`, `clockMinute = '0'` để hai lần lập lá số cùng tích *"Chưa rõ giờ sinh"* luôn sinh ra cùng một khóa, không bị ảnh hưởng bởi giờ/phút cũ ẩn dưới giao diện.
   - Chạy `const birthInfo = formToBirthInfo(normalizedForm)` (`src/lib/ziwei/share.ts:43`) và `const chart = generateChart(birthInfo)` (`src/lib/ziwei/algorithm.ts`).
2. **Khóa định danh & Chống trùng chuẩn**:
   - Dùng trực tiếp `chartIdentityKey = buildChartIdentityKey(chart)` (`src/lib/ziwei/yunxian-context.ts:292–310`):
     `${b.year}_${b.month}_${b.day}_${b.hour}_${b.gender}__${nameSlug}__mg${chart.mingGongBranch}__${leapFlag}__${origSig}__${lonSig}`.
   - **Phân biệt chính xác**:
     - Hai người trùng ngày/tháng/năm/giờ/phút và giới tính nhưng **khác `form.name`** $\rightarrow$ khác `nameSlug` $\rightarrow$ tạo **2 bản ghi độc lập**, không ghi đè nhau.
     - Hai người trùng tên và ngày giờ đồng hồ nhưng **khác tỉnh/thành (`longitude`)** $\rightarrow$ khác `lonSig` (và có thể khác luôn `b.hour` / `mingGongBranch` do Chân Thái Dương Thời) $\rightarrow$ tạo **2 bản ghi độc lập**.
     - Cùng một người nhưng một lần chọn giờ đồng hồ cụ thể, một lần tích *"Chưa rõ giờ sinh"* (`unknownTime = true`) $\rightarrow$ khác `origSig` (`1995-8-16@10:30` vs `no_clock`) $\rightarrow$ tạo **2 bản ghi độc lập**.
   - **Cập nhật Bảo toàn (`Safe Upsert`) khi trùng khít `chartIdentityKey`**:
     - Khi người dùng bấm lập lại đúng lá số đã có trong Thư Viện (`existing.chartIdentityKey === chartIdentityKey`), hệ thống **không tạo bản ghi rác mới** mà chỉ cập nhật `lastOpenedAt = nowMs`, **giữ nguyên 100%** `createdAt`, `customAlias`, `notes`, `pinned`, `pinnedAt`, `dossierSummary` và `StoredDossierRecord`.

---

## 3. Phân Tích 4 Phương Án Lưu Trữ, Bảng Ngân Sách Byte & Giải Pháp Cho Bài Toán Đổi Máy (`[CẬP NHẬT LỚN SAU PANEL PL-01, PL-02, PL-08, PL-09]`)

### 3.1. Phân tích 4 phương án lưu trữ (a, b, c, d) và câu trả lời thẳng cho bài toán Đổi Máy

| Phương án | Cơ chế kỹ thuật | Đổi máy thì dữ liệu CÒN hay MẤT? (Trong giới hạn hạ tầng AI Studio thật) | Đánh giá & Quyết định của Panel |
|---|---|---|---|
| **(a) Mở rộng `localStorage` hiện tại** | Lưu chỉ mục thư viện và văn bản 8 chương vào `window.localStorage`. | **MẤT TRẮNG 100% khi đổi máy / đổi trình duyệt** vì `localStorage` bị khóa cứng theo thiết bị vật lý. Hơn nữa, trần `localStorage` chỉ có `5 MB` (`~2.62 triệu` ký tự UTF-16), trong khi 1 hồ sơ 8 chương dài `15.000–20.000` từ chiếm `~170–230 KB` UTF-16 $\rightarrow$ chỉ lưu được tối đa ~20 hồ sơ là nổ lỗi `QuotaExceededError`. | **CHỈ DÙNG CHO CHỈ MỤC NHẸ (`<= 580 KB`) & HOT CACHE 3 HỒ SƠ (`<= 660 KB`)** để đọc đồng bộ `0ms` khi mở trang. Không dùng để chứa toàn bộ 100 bộ hồ sơ. |
| **(b) `IndexedDB` phía Client** | Lưu văn bản `StoredDossierRecord` trong `window.indexedDB` (`ziwei_thien_ky_library_db_v1`). | **MẤT TRẮNG 100% khi đổi máy / đổi trình duyệt** (nếu đứng một mình). Nhưng trên cùng một máy, `IndexedDB` giữ bền vững qua đóng/mở tab, khởi động lại máy và chịu được dung lượng hàng trăm MB (100 bộ hồ sơ 8 chương `~16 MB` chạy cực nhẹ). | **CHỌN LÀM KHO LƯU TRỮ BỀN VỮNG CHÍNH CHO VĂN BẢN 8 CHƯƠNG TRÊN TRÌNH DUYỆT** (đi kèm Gương RAM `inMemoryDossierMirror` để giữ nguyên đọc đồng bộ `0ms`). |
| **(c) Lưu phía Server như Kho Khóa (`.data/` mã hóa + API)** | Lưu vào `.data/chart-library.enc.json` trên container Server kèm REST API. | **KHÔNG ĐÁNG TIN CẬY & GÂY PHÂN KỲ (`SPLIT-BRAIN`)**: Bằng chứng thật tối `17/11/2026` (`21:28` thấy `1/1` key, `22:18` thấy `22/22` key) chứng minh các phiên/máy khác nhau có thể rơi vào các container instance khác nhau có `.data/` khác nhau. Đồng bộ 2 chiều tự động sẽ ghi đè nhầm giữa các phiên. Ngoài ra còn làm lộ thông tin cá nhân (PII) qua link chia sẻ `ais-pre-` (`PL-05`) và mã hóa `AES-256-GCM` không có tác dụng bảo vệ thực chất khi `.pool-master.key` nằm chung trong `.data/` (`PL-06`). | **BÁC BỎ ĐỒNG BỘ 2 CHIỀU TỰ ĐỘNG & BÁC BỎ MÃ HÓA SERVER TRONG MVP (`PL-01, PL-05, PL-06`)**. *(Nếu Chủ dự án muốn có kênh truyền nhanh qua Server trong cùng phiên, chỉ thiết kế Trạm trung chuyển 1 chiều có gắn `serverInstanceId` ở Pha 3 tùy chọn)*. |
| **(d) Xuất / Nhập Thư Viện dạng File `.JSON` để tự mang theo** | Xuất toàn bộ `entries` + `dossiers` + `deletedTombstones` ra file `.json` tải về máy; nhập lại trên máy mới với thuật toán Gộp từng chương. | **CÒN DỮ LIỆU BỀN VỮNG 100% QUA MỌI MÁY, MỌI TRÌNH DUYỆT & BẤT CHẤP CONTAINER SERVER RESET**, kể cả khi chuyển giữa URL `ais-dev-` và `ais-pre-`. | **CHỌN LÀM PHƯƠNG ÁN ĐỒNG BỘ DI ĐỘNG CHUẨN (KẾT HỢP TRỰC TIẾP VỚI (a)+(b) NGAY TRONG PHA 1 MVP)**. |

---

### 3.2. Bảng Phân Bổ Dữ Liệu Theo Lớp Lưu Trữ & Ngân Sách Dung Lượng Bằng Byte (`Byte Budget Table`) (`[MỚI — SAU PANEL PL-08]`)

Để kỹ sư triển khai kiểm soát chính xác tuyệt đối bộ nhớ trình duyệt, dưới đây là bảng phân bổ từng thực thể vào từng lớp lưu trữ kèm ngân sách tính bằng **Byte**:

| Lớp lưu trữ | Khóa / Bảng lưu trữ | Dữ liệu được phép lưu | Kích thước 1 đơn vị | Số lượng tối đa | Ngân sách tối đa (Bytes) | Hành vi khi chạm ngưỡng / đầy |
|---|---|---|---:|---:|---:|---|
| **Lớp 0: Bộ nhớ RAM (`In-Memory Mirror`)** | Biến module `inMemoryDossierMirror: Map<string, StoredDossierRecord>` **`[MỚI]`** | Bản gương các `StoredDossierRecord` đã nạp từ `IndexedDB` để `DetailedDossierModal.tsx` đọc đồng bộ `0ms`. | `~115.000 – 160.000 bytes` (`~160 KB` UTF-8) | `100` hồ sơ | **`<= 16.000.000 bytes` (`~16 MB` RAM)** | Tự động giải phóng theo đúng tập `entries` hiện có trong Thư Viện. |
| **Lớp 1A: `window.localStorage` (Chỉ mục Thư Viện)** | Khóa `'ziwei_chart_library_v1'` **`[MỚI]`** (`ChartLibraryIndexStore`) | Mảng `ChartLibraryEntry[]` (gồm `form`, `deterministicBadge`, `dossierSummary` chỉ chứa ID/số đếm, `customAlias <= 80`, `notes <= 2000`) + mảng `deletedTombstones`. **CẤM lưu `text` chương hồ sơ tại đây**. | Trung bình `1.800 bytes`; tối đa `5.500 bytes` UTF-16 (khi `notes` đủ 2.000 ký tự) | `100` lá số + `200` tombstones | **`<= 580.000 bytes` (`~580 KB` UTF-16, tức `~11%` trần 5 MB)** | Chạy **Thang thu hồi tất định 4 nấc** (Mục 3.3) trên 70 slot không ghim; giữ nguyên 30 slot `pinned: true`. |
| **Lớp 1B: `window.localStorage` (Hot Dossier Fallback)** | Khóa `'ziwei_dossier_hot_v1::<chartIdentityKey>'` + chỉ mục `'ziwei_dossier_hot_lru_v1'` **`[MỚI]`** | Bản sao `StoredDossierRecord` của các lá số vừa mở/sinh gần nhất để sẵn sàng trong `0ms` ngay cả trước khi `IndexedDB` mở xong hoặc trong môi trường test không có `IndexedDB`. | `~170.000 – 220.000 bytes` UTF-16 (`~220 KB`) | **`3` hồ sơ** (`MAX_HOT_DOSSIERS_LOCALSTORAGE = 3`) | **`<= 660.000 bytes` (`~660 KB` UTF-16)** | Thu hồi LRU nghiêm ngặt ở mức `3` hồ sơ. Nếu `localStorage.setItem` ném `QuotaExceededError`, xóa ngay toàn bộ khóa `'ziwei_dossier_hot_v1::*'` để nhường 100% chỗ cho Chỉ mục Lớp 1A (dữ liệu hồ sơ vẫn an toàn ở Lớp 0 RAM và Lớp 2 `IndexedDB`). |
| **Lớp 1C: `window.localStorage` (Tương thích ngược)** | Khóa `'ziwei_history'` *(hiện có tại `history.ts:4`)* | Giữ nguyên tối đa 10 `HistoryEntry` cũ không xóa khi di trú. | `~1.200 bytes` UTF-16 | `10` mục | **`<= 15.000 bytes` (`~15 KB`)** | Giữ tĩnh hoặc cập nhật song song tối đa 10 mục. |
| **Lớp 2: `window.indexedDB` (Kho Bền Vững Hồ Sơ 8 Chương)** | DB `'ziwei_thien_ky_library_db_v1'` $\rightarrow$ Store `'dossier_records'` (keyPath: `'chartIdentityKey'`) **`[MỚI]`** | Toàn văn 8 chương `StoredDossierRecord` (`sections` đã qua `sanitizeDossierChapterText`) của mọi lá số trong Thư Viện. | `~115.000 – 160.000 bytes` UTF-8 | **`100` hồ sơ** (1-1 với 100 lá số trong Lớp 1A) | **`<= 16.000.000 bytes` (`~16 MB` trên đĩa, `< 1%` quota `IndexedDB`)** | Khi 1 lá số bị xóa khỏi Lớp 1A (hoặc bị đẩy ra bởi Thang thu hồi 4 nấc), bản ghi `StoredDossierRecord` tương ứng trong `IndexedDB` được xóa đồng bộ qua `store.delete(chartIdentityKey)`. |
| **Lớp 3: `window.sessionStorage` (Phiên hiện hành)** | `'ziwei_chat_v1::*'` (`MAX_CHAT_THREADS_IN_SESSION = 10`) & `'ziwei_dossier_v1::*'` (`MAX_DOSSIERS_IN_SESSION = 5`) *(hiện có tại `dossier-chat-ui.ts:80–94`)* | Giữ nguyên mạch chat theo phiên và bản gương hồ sơ phiên hiện tại để tương thích ngược 100%. | `~20 KB` / mạch chat; `~160 KB` / hồ sơ | `10` chat + `5` hồ sơ | **`<= 1.200.000 bytes` (`~1.2 MB` trong `sessionStorage` riêng biệt)** | Tự thu hồi LRU theo `upsertLruSessionEntry` hiện hành (`dossier-chat-ui.ts:305`). |
| **Lớp 4: File `.JSON` Di Động (`Portable File`)** | File tải về máy người dùng: `tu-vi-thien-ky-library-YYYY-MM-DD.json` **`[MỚI]`** | Toàn bộ `ChartLibraryExportBundle` (100 `entries` + 100 `dossiers` + 200 `deletedTombstones`). | `~160 KB` / lá số có đủ 8 chương | `100` lá số + `100` hồ sơ | **`~200 KB` (10 lá số thường) đến tối đa `~16.500.000 bytes` (`~16.5 MB` nếu cả 100 lá số đều đủ 8/8 chương)** | Lưu trực tiếp xuống ổ đĩa người dùng qua `Blob` + `URL.createObjectURL`; khi nhập lại kiểm tra kích thước file `<= 25 MB`. |

> **Tổng kiểm toán hạn mức `window.localStorage`**: Lớp 1A (`<= 580 KB`) + Lớp 1B (`<= 660 KB`) + Lớp 1C (`<= 15 KB`) = **Tối đa `1.255.000 bytes` (`~1.25 MB`)**, chỉ chiếm **`24%`** giới hạn `5 MB` của trình duyệt — **triệt tiêu hoàn toàn nguy cơ tràn `localStorage`!**

---

### 3.3. Thang Thu Hồi Tất Định 4 Nấc Chống Kẹt Cứng (`4-Tier Deterministic Eviction Ladder`) (`[MỚI — SAU PANEL PL-09]`)

Để không bao giờ xảy ra tình trạng kẹt cứng (`Deadlock`) khi Thư Viện đã đủ `MAX_LIBRARY_ENTRIES = 100` lá số và người dùng lập lá số thứ `101`:

1. **Quy tắc Trần Ghim Cố Định (`MAX_PINNED_ENTRIES = 30`)**:
   - Hàm `togglePinLibraryEntry(chartIdentityKey)` kiểm tra: nếu người dùng muốn ghim lá số thứ 31, trả về `{ ok: false, reason: 'MAX_PINNED_REACHED' }` và hiển thị thông báo trên UI: *"Thư viện cho phép ghim cố định tối đa 30 lá số quan trọng nhất. Vui lòng bỏ ghim một lá số cũ trước khi ghim thêm."*
   - Nhờ quy tắc này, trong 100 mục luôn có **ít nhất 70 mục không ghim (`pinned === false`)**. Toàn bộ các mục `pinned === true` được **miễn trừ thu hồi 100% ở mọi nấc**.

2. **Thuật toán chọn ứng viên thu hồi `selectEvictionCandidate(entries: ChartLibraryEntry[])` trên tập `unpinned = entries.filter(e => !e.pinned)`**:
   - **Nấc 1 (Ưu tiên thu hồi đầu tiên — Mục rỗng)**: Lọc các mục có `dossierSummary.completedCount === 0 && dossierSummary.incompleteCount === 0 && notes.trim().length === 0`. Nếu có $\rightarrow$ chọn mục có `lastOpenedAt` nhỏ nhất (nếu bằng nhau thì chọn `createdAt` nhỏ nhất).
   - **Nấc 2 (Mục chưa có hồ sơ, chỉ có ghi chú)**: Nếu Nấc 1 rỗng $\rightarrow$ lọc các mục có `dossierSummary.completedCount === 0 && dossierSummary.incompleteCount === 0`. Nếu có $\rightarrow$ chọn mục có `lastOpenedAt` nhỏ nhất.
   - **Nấc 3 (Mục có ít chương hồ sơ hoàn tất nhất)**: Nếu Nấc 2 rỗng $\rightarrow$ sắp xếp tập `unpinned` theo `dossierSummary.completedCount` tăng dần, sau đó theo `dossierSummary.incompleteCount` tăng dần, sau đó theo `lastOpenedAt` tăng dần $\rightarrow$ chọn phần tử đầu tiên (mục ít chương nhất và lâu không mở nhất).
   - **Nấc 4 (Dự phòng tất định cuối)**: Nếu mọi mục không ghim đều có `completedCount === 8` $\rightarrow$ chọn mục không ghim có `lastOpenedAt` nhỏ nhất.

3. **Cơ chế Đệm Hoàn Tác Trong Phiên (`lastEvictedBackupItem` `[MỚI]`)**:
   - Nếu mục bị thu hồi thuộc Nấc 2, Nấc 3 hoặc Nấc 4 (tức là có ghi chú hoặc có ít nhất 1 chương hồ sơ), trước khi xóa khỏi `localStorage` và `IndexedDB`, hệ thống giữ bản sao đầy đủ `{ entry, dossier }` của mục đó trong biến RAM `lastEvictedBackupItem` và bật cảnh báo trên thanh đầu Thư Viện:
     *"Thư viện đã đầy (100/100) nên vừa tự động thu hồi lá số cũ chưa ghim: [Tên]. Bạn có thể bấm [Tải file .JSON sao lưu mục vừa dọn] hoặc [Hoàn tác] ngay trong phiên này."*

---

### 3.4. Thuật Toán Hợp Nhất Đơn Điệu Từng Chương & Xử Lý Tombstone Khi Nhập File `.JSON` (`[MỚI — SAU PANEL PL-02, PL-12]`)

Khi người dùng bấm **"Nhập Thư Viện (.JSON)"** trên Máy B để nạp file `.json` xuất từ Máy A, hàm `importLibraryBundleWithMerge(currentStore, incomingBundle, options: { mode: 'smart_merge' | 'force_restore_all' })` **`[MỚI]`** thực thi chính xác 5 bước sau:

#### Bước 1: Kiểm tra Schema & Làm sạch dữ liệu đầu vào (`PL-12`)
- Kiểm tra `incomingBundle.bundleType === 'tu-vi-thien-ky-chart-library'` và `Array.isArray(incomingBundle.entries)`.
- Với mỗi `rawEntry` trong `incomingBundle.entries`:
  - Kiểm tra `rawEntry.form` có năm (`1900..2100`), tháng (`1..12`), ngày hợp lệ theo lịch Gregorius (`isValidGregorianDate`), giờ (`0..23`), phút (`0..59`), giới tính (`'male' | 'female'`). Nếu không hợp lệ $\rightarrow$ bỏ qua bản ghi lỗi, tăng bộ đếm `skippedInvalidCount`.
  - Tính lại `chart = generateChart(formToBirthInfo(rawEntry.form))` và `canonicalKey = buildChartIdentityKey(chart)`.
  - Nếu trong `incomingBundle.dossiers[rawEntry.chartIdentityKey]` có hồ sơ, chạy `sanitizeDossierChapterText(sec.text, chapterId, chart)` (`src/lib/dossier-chat-ui.ts:170`) trên từng chương để đảm bảo văn bản nhập vào sạch chuẩn Lớp 3A + 3B.

#### Bước 2: Hợp nhất Sổ cái Xóa (`deletedTombstones`)
- Nếu `options.mode === 'smart_merge'`:
  - Gộp `currentStore.deletedTombstones` và `incomingBundle.deletedTombstones` theo `chartIdentityKey`: nếu trùng khóa thì giữ `deletedAt = Math.max(localTomb.deletedAt, remoteTomb.deletedAt)`.
  - Lọc bỏ các tombstone quá hạn `90` ngày (`nowMs - deletedAt > TOMBSTONE_RETENTION_MS`) và giữ tối đa `MAX_DELETED_TOMBSTONES = 200` mục mới nhất.
- Nếu `options.mode === 'force_restore_all'` (Khôi phục cưỡng bức cả các mục từng xóa):
  - Xóa khỏi `deletedTombstones` tất cả các `chartIdentityKey` có mặt trong `incomingBundle.entries`.

#### Bước 3: Kiểm tra Chặn Hồi Sinh (`Tombstone Guard`)
- Với mỗi mục `incomingEntry` (đã chuẩn hóa `canonicalKey`):
  - Tra cứu `tomb = mergedTombstones.get(canonicalKey)`.
  - Nếu `options.mode === 'smart_merge'` VÀ `tomb` tồn tại VÀ `tomb.deletedAt >= incomingEntry.updatedAt`:
    - **Chặn không cho bản ghi đã xóa hồi sinh** (tăng bộ đếm `skippedTombstonedCount`), đồng thời nếu trong máy hiện tại vẫn còn bản ghi đó với `localEntry.updatedAt <= tomb.deletedAt` thì xóa luôn khỏi máy hiện tại.

#### Bước 4: Hợp nhất Đơn điệu Từng Chương Hồ Sơ (`mergeDossierRecords(localDossier, incomingDossier, chart)` `[MỚI]`)
Khi cả máy đích (`localDossier`) và file nhập (`incomingDossier`) đều có hồ sơ cho cùng `canonicalKey`, tuyệt đối không ghi đè cả cục mà duyệt qua từng `spec` trong 8 chương `DOSSIER_CHAPTER_SPECS`:
```ts
// [MỚI] Hợp nhất đơn điệu từng chương (Per-Chapter Monotonic Merge)
export function mergeDossierRecords(
  chartIdentityKey: string,
  localRecord: StoredDossierRecord | null | undefined,
  incomingRecord: StoredDossierRecord | null | undefined,
  chart?: ZiweiChart,
): StoredDossierRecord | null {
  if (!localRecord && !incomingRecord) return null;
  if (!localRecord) return incomingRecord ? sanitizeFullDossierRecord(incomingRecord, chartIdentityKey, chart) : null;
  if (!incomingRecord) return sanitizeFullDossierRecord(localRecord, chartIdentityKey, chart);

  const mergedSections: Partial<Record<DossierChapterId, DossierChapterState>> = {};
  let maxUpdatedAt = Math.max(localRecord.updatedAt || 0, incomingRecord.updatedAt || 0);

  for (const spec of DOSSIER_CHAPTER_SPECS) {
    const chId = spec.id;
    const locSec = localRecord.sections?.[chId];
    const incSec = incomingRecord.sections?.[chId];

    if (!locSec && !incSec) continue;
    if (!locSec) {
      mergedSections[chId] = incSec;
      continue;
    }
    if (!incSec) {
      mergedSections[chId] = locSec;
      continue;
    }

    const locCompleted = locSec.status === 'completed' && Boolean(locSec.text?.trim());
    const incCompleted = incSec.status === 'completed' && Boolean(incSec.text?.trim());

    // Quy tắc 1: Chương 'completed' luôn thắng chương chưa 'completed' bất kể timestamp
    if (locCompleted && !incCompleted) {
      mergedSections[chId] = locSec;
    } else if (!locCompleted && incCompleted) {
      mergedSections[chId] = incSec;
    } else {
      // Quy tắc 2: Cùng trạng thái -> lấy bản có updatedAt mới hơn (nếu bằng nhau lấy bản dài hơn)
      const locTime = locSec.updatedAt ?? localRecord.updatedAt ?? 0;
      const incTime = incSec.updatedAt ?? incomingRecord.updatedAt ?? 0;
      if (incTime > locTime) {
        mergedSections[chId] = incSec;
      } else if (locTime > incTime) {
        mergedSections[chId] = locSec;
      } else {
        const locLen = (locSec.text || locSec.incompleteText || '').length;
        const incLen = (incSec.text || incSec.incompleteText || '').length;
        mergedSections[chId] = incLen >= locLen ? incSec : locSec;
      }
    }

    const chosenTime = mergedSections[chId]?.updatedAt ?? 0;
    if (chosenTime > maxUpdatedAt) maxUpdatedAt = chosenTime;
  }

  return sanitizeFullDossierRecord(
    {
      chartIdentityKey,
      updatedAt: maxUpdatedAt,
      sections: mergedSections,
    },
    chartIdentityKey,
    chart,
  );
}
```

#### Bước 5: Hợp nhất Siêu dữ liệu Thẻ Lá Số (`mergeChartLibraryEntries(localEntry, incomingEntry, mergedDossier)`)
- `createdAt = Math.min(localEntry.createdAt, incomingEntry.createdAt)`
- `lastOpenedAt = Math.max(localEntry.lastOpenedAt, incomingEntry.lastOpenedAt)`
- `pinned = localEntry.pinned || incomingEntry.pinned` (ưu tiên giữ ghim nếu bất kỳ bên nào đã ghim, tuân thủ trần `MAX_PINNED_ENTRIES = 30`).
- `customAlias`: lấy của bên có `notesUpdatedAt` lớn hơn (nếu bên mới hơn để rỗng thì lấy bên có chữ).
- `notes`:
  - Nếu `localEntry.notes.trim() === incomingEntry.notes.trim()` $\rightarrow$ giữ nguyên.
  - Nếu một bên rỗng $\rightarrow$ lấy bên có chữ.
  - Nếu cả hai bên đều có chữ khác nhau $\rightarrow$ lấy bản có `notesUpdatedAt` mới hơn; nếu `notesUpdatedAt` bằng nhau thì nối bảo toàn `local + "\n---\n" + incoming` (cắt ở `LIBRARY_MAX_NOTE_CHARS = 2_000`).
- `dossierSummary`: tính lại chính xác 100% từ `mergedDossier` vừa hợp nhất ở Bước 4 thông qua hàm `computeDossierSummary(mergedDossier)`.

---

## 4. Thuật Toán Di Trú Dữ Liệu Cũ & Ánh Xạ Khóa Kép 3 Bậc (`[CẬP NHẬT LỚN SAU PANEL PL-04, PL-07]`)

Khi khởi động ứng dụng, hàm `runChartLibraryMigrationIfNeeded()` **`[MỚI]`** sẽ nâng cấp toàn bộ lịch sử cũ và hồ sơ cũ sang cấu trúc Thư Viện mới mà **không làm mồ côi bất kỳ hồ sơ nào** (dù hồ sơ đó được lưu dưới khóa 5 thành phần của `1.0.0-stable` hay khóa 9 thành phần của `1.1.0-rc.1`):

### 4.1. Thuật toán Ánh xạ Khóa Kép 3 Bậc (`3-Tier Legacy Key Resolution`)

1. **Thu thập toàn bộ dữ liệu hiện có trên trình duyệt**:
   - Đọc mảng `legacyHistory: HistoryEntry[]` từ `localStorage.getItem('ziwei_history')` (`src/lib/ziwei/history.ts:4`).
   - Quét toàn bộ các khóa bắt đầu bằng `'ziwei_dossier_v1::'` trong `window.sessionStorage` (và trong `window.localStorage` nếu có) để thu được danh sách `orphanDossierMap = new Map<string, StoredDossierRecord>()` (key là phần sau `'ziwei_dossier_v1::'`).

2. **Chuẩn hóa từng mục `HistoryEntry` và tìm Hồ Sơ khớp theo 3 Bậc**:
   - Với mỗi `item` trong `legacyHistory`:
     - Chạy `birthInfo = formToBirthInfo(item.form)` (`src/lib/ziwei/share.ts:43`) và `chart = generateChart(birthInfo)`.
     - Tính **Khóa Đầy Đủ 9 Thành Phần (`canonicalKey`)**:
       `canonicalKey = buildChartIdentityKey(chart)` (`src/lib/ziwei/yunxian-context.ts:292`).
     - Tính **Khóa Ngắn 5 Thành Phần (`legacyFivePartKey`)**:
       `legacyFivePartKey = "${chart.birthInfo.year}_${chart.birthInfo.month}_${chart.birthInfo.day}_${chart.birthInfo.hour}_${chart.birthInfo.gender}"`.
     - **Tìm kiếm và gom hồ sơ trong `orphanDossierMap` theo 3 bậc**:
       - **Bậc 1 (Khớp chính xác 9 thành phần)**: Nếu `orphanDossierMap.has(canonicalKey)` $\rightarrow$ lấy `record` đó và đánh dấu đã khớp.
       - **Bậc 2 (Khớp chính xác khóa 5 thành phần của `1.0.0-stable`)**: Nếu `orphanDossierMap.has(legacyFivePartKey)` $\rightarrow$ hợp nhất (`mergeDossierRecords`) `record` đó vào `canonicalKey` và đánh dấu đã khớp.
       - **Bậc 3 (Khớp tiền tố 5 thành phần + `nameSlug`)**: Quét các khóa `k` còn lại trong `orphanDossierMap` bắt đầu bằng `${legacyFivePartKey}__`:
         - Nếu `k` chứa cùng `__${nameSlug}__` với `canonicalKey`, HOẶC trong toàn bộ `legacyHistory` chỉ có duy nhất 1 mục mang `legacyFivePartKey` này $\rightarrow$ hợp nhất `record` đó vào `canonicalKey` và đánh dấu đã khớp!

3. **Cứu hộ Hồ Sơ Mồ Côi trong Phiên Hiện Tại (`Current-Chart Rescue`)**:
   - Nếu sau khi duyệt hết `legacyHistory` mà trong `orphanDossierMap` vẫn còn một `StoredDossierRecord` khớp với `currentForm` đang mở trên màn hình (ví dụ lá số vừa lập đã trôi khỏi top 10 hoặc mở từ URL query params), hệ thống tự động tạo luôn `ChartLibraryEntry` từ `currentForm` và gắn hồ sơ đó vào Thư Viện!

4. **Lưu Bền Vững & Bảo Toàn Khóa Cũ**:
   - Ghi toàn bộ `ChartLibraryEntry[]` vào `localStorage['ziwei_chart_library_v1']`.
   - Ghi toàn bộ `StoredDossierRecord` đã khớp (với `chartIdentityKey` đã chuẩn hóa thành `canonicalKey`) vào `inMemoryDossierMirror`, `IndexedDB` (`'dossier_records'`) và top 3 vào `localStorage` hot cache (`'ziwei_dossier_hot_v1::*'`), đồng thời cập nhật lại khóa chuẩn trong `sessionStorage` để `DetailedDossierModal.tsx` đọc mượt mà.
   - **Tuyệt đối không xóa `localStorage['ziwei_history']`**, đặt cờ `localStorage.setItem('ziwei_chart_library_migrated_v1', '1')`.

---

## 5. Thiết Kế Giao Diện (`UI/UX Design`) & Điểm Chạm Hệ Thống (`[CẬP NHẬT SAU PANEL PL-03, PL-04, PL-11]`)

### 5.1. Các Điểm Chạm (`Touchpoints`) trong Giao Diện Hiện Tại (Phạm vi MVP)

| Điểm chạm | File & Dòng hiện tại | Thay đổi cụ thể trong MVP |
|---|---|---|
| **1. Thanh Header chính (Zone 3)** | `src/App.tsx:218–264` | Thêm nút **`Thư Viện`** (biểu tượng `FolderHeart` hoặc `Library` từ `lucide-react`, hiển thị huy hiệu số lượng lá số đang lưu: `Thư Viện (12)`) đặt ngay bên trái nút `Kho Khóa`. Bấm vào mở `ChartLibraryModal`. |
| **2. Thanh Tóm Tắt Nhanh (`Quick Summary Bar`)** | `src/App.tsx:301–335` | • Hiển thị tên gợi nhớ `customAlias` (nếu có) bên cạnh `chart.birthInfo.name`.<br>• Thêm nút bấm nhanh **Ghim / Đã ghim (`Pin`)** cho lá số đang mở.<br>• Nâng cấp nút `Hồ Sơ Chi Tiết (8 Chương)` (`src/App.tsx:320–325`): nếu lá số hiện tại đã có `X > 0` chương hoàn tất trong Thư Viện, hiển thị **`Hồ Sơ Chi Tiết (X/8 Chương)`** kèm chấm tròn màu ngọc lục bảo. |
| **3. Đồng bộ `aiPeriodCache` khi nạp lá số (`PL-11`)** | `src/App.tsx:87–106` (`applyFormAndChart`) | Khi người dùng chọn mở một lá số từ Thư Viện (hoặc khi khởi tạo trang), gọi `hydratePeriodCacheFromLibraryDossier(newChart)` **`[MỚI]`**: nếu trong kho hồ sơ bền vững của lá số đó đã có Chương 5 (`year_2026`) hoặc Chương 6 (`year_2027`), tự động điền vào `aiPeriodCache` theo khóa `buildPeriodCacheKeyForYear(newChart, 2026/2027)` để tab Vận Hạn ở `InsightPanel.tsx` có sẵn ngay lập tức. |
| **4. Khung Nhập Sinh Thần (`BirthForm.tsx`)** | `src/components/BirthForm.tsx:229–279` | • Nút `Lịch sử (X)` (`BirthForm.tsx:236`) đổi nhãn thành **`Gần đây (X)`**.<br>• Ngăn xổ xuống hiển thị tối đa 5 lá số (ưu tiên mục `pinned` và mới mở nhất), mỗi dòng hiện kèm huy hiệu `[📌]` và `[X/8 chương]`, cộng thêm nút **"Mở Thư Viện Đầy Đủ (Tìm kiếm / Ghi chú / Sao lưu)..."** ở cuối ngăn. |
| **5. Modal Hồ Sơ 8 Chương (`DetailedDossierModal.tsx`)** | `src/components/DetailedDossierModal.tsx:573–598` | • Hàm `saveDossierSectionToCache` (`src/lib/dossier-chat-ui.ts:264`) và `readDossierCacheEntry` (`dossier-chat-ui.ts:230`) được nối trực tiếp với `inMemoryDossierMirror` + `IndexedDB` + cập nhật `dossierSummary` trong `ziwei_chart_library_v1`.<br>• Mỗi khi sinh xong 1 chương (hoặc khi dừng giữa chừng có `incompleteText`), tiến độ `completedCount/8`, `lastGeneratedAt` và `modelsUsed` trong Thư Viện được cập nhật tức thì. |

---

### 5.2. Thiết kế Chi Tiết `src/components/ChartLibraryModal.tsx` (`[MỚI]`)

1. **Thanh Đầu Hộp Thoại (`Modal Header & Portable Backup Bar`)**:
   - Bên trái: Tiêu đề **"Thư Viện Lá Số & Hồ Sơ Luận Giải"** + dòng tóm tắt định lượng:
     `Đang lưu: 14/100 lá số · Đã ghim: 4/30 · Hồ sơ đã lập: 7 bộ (38 chương)`.
   - Bên phải:
     - Nút **`[⬇ Xuất Thư Viện (.JSON)]`**: Tải về file `tu-vi-thien-ky-library-YYYY-MM-DD.json`.
     - Nút **`[⬆ Nhập Thư Viện (.JSON)]`**: Mở hộp chọn file `.json` (cho phép chọn *"Gộp thông minh"* hoặc *"Khôi phục toàn phần"*, sau khi nhập xong hiển thị thông báo kết quả: *"Đã gộp thành công: +3 lá số mới, cập nhật thêm 5 chương hồ sơ, bỏ qua 1 mục đã xóa"*).

2. **Thanh Tìm Kiếm, Bộ Lọc & Sắp Xếp (`Search, Filter & Sort`)**:
   - **Ô tìm kiếm (`Search Input`)**: Chuẩn hóa bỏ dấu tiếng Việt (`normalize('NFD').replace(/[\u0300-\u036f]/g, '')`) để người dùng gõ có dấu hay không dấu đều tìm khớp trên: `form.name`, `customAlias`, `notes`, `form.year`, `form.city`, `form.province`, `deterministicBadge.mingMajorStarsVi`, `deterministicBadge.yearCanZhiVi`.
   - **Bộ lọc nhanh (`Filter Chips`)**:
     - `Tất cả` | `📌 Đã ghim` | `📖 Đã có Hồ Sơ (1–8 chương)` | `✅ Hoàn tất (8/8 chương)` | `📝 Có ghi chú`.
   - **Sắp xếp (`Sort Dropdown`)**:
     - Mặc định các mục `pinned: true` luôn nằm ở nhóm đầu; bên trong từng nhóm sắp xếp theo:
       1. `Mở xem gần nhất` (`lastOpenedAt` giảm dần)
       2. `Sinh Hồ Sơ gần nhất` (`dossierSummary.lastGeneratedAt` giảm dần)
       3. `Mới tạo gần nhất` (`createdAt` giảm dần)
       4. `Tên A → Z` (`(customAlias || form.name)` theo `localeCompare('vi')`)

3. **Hiển thị Trạng thái Hồ Sơ 8 Chương trên từng Thẻ Lá Số**:
   - Thanh 8 ô vuông nhỏ đại diện cho Chương 1 → Chương 8 (`DOSSIER_CHAPTER_SPECS`):
     - Ô màu **Ngọc Lục Bảo (`emerald`)**: Chương đã hoàn tất (`completed`).
     - Ô màu **Hổ Phách (`amber`)**: Chương đang dở dang (`incomplete`).
     - Ô màu **Xám mờ (`border`)**: Chương chưa sinh (`idle`).
   - Di chuột (hover) hoặc nhìn dòng tóm tắt ngay dưới thanh 8 ô:
     - Khi `completedCount > 0`: *"Đã có **6/8 chương** (Ch.1, 2, 3, 4, 5, 6) · Sinh lần cuối: `17/11/2026 08:15` · Model: `gemini-3.5-flash-lite`"*.
     - Khi `completedCount === 0 && incompleteCount === 0`: *"Chưa sinh Hồ Sơ 8 Chương"*.

4. **Đổi Tên Gợi Nhớ (`customAlias`) & Ghi Chú (`notes`) Không Làm Đổi Khóa (`[CẬP NHẬT SAU PANEL PL-04]`)**:
   - Bấm nút `[✏️ Tên gợi nhớ / Ghi chú]` trên thẻ mở khung biên tập nội tuyến:
     - Trường **Tên hiển thị gợi nhớ (`customAlias`, tối đa 80 ký tự)**: Ví dụ nhập *"Anh An - Đối tác Hà Nội"*. Tên khai sinh gốc (`form.name`: *"Nguyễn Văn An"*) được hiển thị bên cạnh với nhãn `(Tên khai sinh trên lá số — cố định để giữ liên kết hồ sơ)`.
     - Trường **Ghi chú nghiệm lý (`notes`, tối đa 2.000 ký tự)**: Ô `textarea` rộng rãi kèm bộ đếm ký tự `X/2000`.
     - Kèm nút phụ *"Nạp dữ kiện lên Form nhập để sửa ngày giờ/tên khai sinh & lập lá số mới"* nếu người dùng muốn tạo bản lá số mới.

5. **Hành động Mở Nhanh & Cảnh Báo Xóa 2 Bước**:
   - **`[⚡ Mở Lá Số]`**: Nạp lá số lên Thiên Bàn và đóng Modal Thư Viện.
   - **`[📖 Mở Ла́ Số + Hồ Sơ (X/8)]`**: Nạp lá số lên Thiên Bàn, đóng Modal Thư Viện và **mở thẳng `DetailedDossierModal`** tới chương đầu tiên của lá số đó!
   - **`[⬇ Xuất Lẻ (.JSON)]`**: Xuất riêng 1 lá số này kèm Hồ Sơ 8 Chương của nó ra file `.json`.
   - **`[🗑 Xóa]`**: Mở khung xác nhận nội tuyến ngay trên thẻ (không dùng `window.confirm`):
     - Nếu lá số đã có chương hồ sơ (`completedCount > 0` hoặc `incompleteCount > 0`) hoặc có ghi chú:
       - Cảnh báo rõ: *"⚠️ Lá số **[Tên]** đang có **X/8 chương Hồ Sơ Luận Giải** (cập nhật lần cuối `...`, model `...`). Bạn muốn thực hiện thao tác nào?"*
       - Nút 1: **`[Hủy]`**
       - Nút 2: **`[Chỉ xóa Hồ Sơ (Giữ lại Lá Số & Ghi chú)]`** (xóa `StoredDossierRecord` trong `IndexedDB`/`localStorage`, đặt `dossierSummary` về `0/8`).
       - Nút 3: **`[Xóa vĩnh viễn cả Lá Số & Hồ Sơ]`** (xóa cả `ChartLibraryEntry` lẫn `StoredDossierRecord` và ghi `deletedTombstone`).

---

## 6. Lộ Trình 2 Pha MVP, Quản Trị Rủi Ro & Đặc Tả 10 Bài Test Tự Động (`[CẬP NHẬT SAU PANEL PL-03, PL-10]`)

### 6.1. Phân kỳ triển khai 2 Pha MVP (Gọn, Kiểm chứng được ngay)

#### Pha 1 — Lõi Lưu Trữ Bền Vững (`localStorage` + `IndexedDB` + Gương RAM), Di Trú 3 Bậc & Xuất/Nhập `.JSON`
- **Phạm vi file**:
  - Tạo mới `src/lib/chart-library.ts` **`[MỚI]`**.
  - Cập nhật `src/lib/dossier-chat-ui.ts` (nối `readDossierCacheEntry` và `saveDossierSectionToCache` vào kho bền vững của `chart-library.ts` trong khi giữ nguyên chữ ký hàm đồng bộ).
  - Cập nhật `src/lib/ziwei/history.ts` (nâng cấp `useHistory` thành wrapper/hook gọi trực tiếp `chart-library.ts` để tương thích ngược).
  - Tạo mới `scripts/verify-chart-library.ts` **`[MỚI]`**.
- **Tiêu chí nghiệm thu Pha 1**:
  - Chạy `npx tsx scripts/verify-chart-library.ts` đạt **10/10 bài test (`TEST-L01` .. `TEST-L10`)**.

#### Pha 2 — Giao Diện `ChartLibraryModal.tsx`, Nối Dây `App.tsx` / `BirthForm.tsx` / `DetailedDossierModal.tsx` & Cập Nhật Tài Liệu Sống
- **Phạm vi file**:
  - Tạo mới `src/components/ChartLibraryModal.tsx` **`[MỚI]`**.
  - Cập nhật `src/App.tsx`, `src/components/BirthForm.tsx`, `src/components/DetailedDossierModal.tsx`.
  - Cập nhật `package.json` (thêm `"verify:library": "tsx scripts/verify-chart-library.ts"` và nối vào `"verify:all"`), cập nhật `docs/INDEX.md`, `docs/features-dossier-and-chat.md`, `docs/decisions-registry.md`, `/CHANGELOG.md`, `/VERSION`.
- **Tiêu chí nghiệm thu Pha 2**:
  - `compile_applet` (`npm run build`) và `lint_applet` (`npm run lint`) đạt **0 lỗi**.
  - `npm run verify:all` (toàn bộ 6 suite kiểm thử tự động của dự án) PASS 100%.

---

### 6.2. Đặc tả Chi tiết 10 Bài Kiểm Thử Tự Động trong `scripts/verify-chart-library.ts` (`[MỚI — SAU PANEL PL-10]`)

Script `scripts/verify-chart-library.ts` **`[MỚI]`** chạy độc lập trên Node/tsx (với bộ giả lập `MockStorage` có giới hạn byte để test cả `QuotaExceededError`) kiểm chứng 10 ca bắt buộc sau:

| Mã Test | Tên bài kiểm thử | Đầu vào cụ thể (Input) | Kỳ vọng đầu ra đo được (Assertions) |
|:---:|---|---|---|
| **`TEST-L01`** | **Chống trùng đúng: Hai người trùng ngày giờ sinh khác tên hoặc khác nơi sinh** | • Người A: `name: "Nguyễn Văn An"`, `16/08/1995`, `10:30`, `male`, `Hà Nội (105.85)`<br>• Người B: `name: "Trần Quốc Bảo"`, `16/08/1995`, `10:30`, `male`, `Hà Nội (105.85)`<br>• Người C: `name: "Nguyễn Văn An"`, `16/08/1995`, `10:30`, `male`, `Điện Biên Phủ (103.02)`<br>• Người D: `name: "Nguyễn Văn An"`, `16/08/1995`, `unknownTime: true`, `male`, `Hà Nội (105.85)` | • Cả 4 lần gọi `upsertChartToLibrary` phải tạo ra đúng **4 bản ghi độc lập** (`entries.length === 4`) với 4 `chartIdentityKey` khác nhau.<br>• Không bản ghi nào bị ghi đè mất. |
| **`TEST-L02`** | **Upsert bảo toàn dữ liệu khi lập lại đúng 1 lá số** | Lập lá số Người A, ghim `pinned = true`, đặt `customAlias = "Anh An"`, `notes = "Ghi chú 1"`, lưu Chương 1 hoàn tất. Sau đó gọi lại `upsertChartToLibrary(formA)` lần thứ 2. | • Số lượng mục vẫn là `1`.<br>• `lastOpenedAt` được cập nhật mới hơn, nhưng `pinned === true`, `customAlias === "Anh An"`, `notes === "Ghi chú 1"` và `dossierSummary.completedCount === 1` được **bảo toàn 100%**. |
| **`TEST-L03`** | **Di trú từ hình dạng thật của `'ziwei_history'` + khóa hồ sơ 9 thành phần (`1.1.0-rc.1`)** | Nạp vào `localStorage['ziwei_history']` 2 mục `HistoryEntry` chuẩn (`{ id, label, form, savedAt }`) và nạp vào `sessionStorage` 1 `StoredDossierRecord` dưới khóa `ziwei_dossier_v1::<9-part-key>` có 3 chương (`chapter_overview`, `palaces_core`, `year_2026` với `meta.modelUsed = 'gemini-3.5-flash-lite'`). Chạy `runChartLibraryMigrationIfNeeded()`. | • Tạo đủ 2 mục trong `ziwei_chart_library_v1`.<br>• Mục có hồ sơ hiển thị đúng `completedCount === 3`, `completedChapterIds === ['chapter_overview', 'palaces_core', 'year_2026']`, `modelsUsed === ['gemini-3.5-flash-lite']`.<br>• Khóa cũ `localStorage['ziwei_history']` vẫn còn nguyên vẹn; chạy lại hàm di trú lần 2 không tạo bản sao trùng lặp (lũy đẳng). |
| **`TEST-L04`** | **Di trú ánh xạ khóa cũ 5 thành phần (`1.0.0-stable` `ziwei_dossier_v1::Y_M_D_H_G`) không mồ côi hồ sơ (`PL-04`)** | Nạp vào `localStorage['ziwei_history']` mục `HistoryEntry` sinh `16/08/1995 10:30 Nam` và nạp vào `sessionStorage` hồ sơ dưới **khóa ngắn 5 thành phần cũ** `ziwei_dossier_v1::1995_8_16_5_male` (gồm 2 chương hoàn tất). Chạy di trú. | • Thuật toán ánh xạ 3 bậc nhận diện đúng khóa 5 thành phần `1995_8_16_5_male`, gắn cả 2 chương vào mục `ChartLibraryEntry` mới và nâng cấp khóa lưu trữ hồ sơ lên `canonicalKey` 9 thành phần.<br>• `completedCount === 2` (**0 hồ sơ mồ côi**). |
| **`TEST-L05`** | **Đổi `customAlias` và `notes` giữ nguyên `chartIdentityKey` & liên kết Hồ Sơ (`PL-04`)** | Trên một lá số đã có `4/8` chương hồ sơ, gọi `updateLibraryEntryMeta(key, { customAlias: 'Biệt danh mới', notes: 'Nghiệm lý 2026' })`. | • `chartIdentityKey` và `form.name` không đổi.<br>• `readDossierCacheEntry` với `chartIdentityKey` đó vẫn trả về đủ `4/8` chương ngay lập tức. |
| **`TEST-L06`** | **Xuất / Nhập `.JSON` với Hợp nhất Đơn điệu Từng Chương (`Per-Chapter Merge` — `PL-02`)** | • Máy A có Lá số X với Chương 1, 2, 3 (`completed`) và Chương 4 (`incomplete`). Xuất ra JSON.<br>• Máy B có cùng Lá số X nhưng mới có Chương 1 (`completed` cũ hơn), Chương 4 (`completed` đầy đủ) và Chương 5 (`completed`).<br>• Nhập JSON của Máy A vào Máy B ở chế độ `'smart_merge'`. | • Kết quả trên Máy B cho Lá số X phải có đủ **5/8 chương `completed` (`1, 2, 3, 4, 5`)**: Chương 1 lấy bản mới hơn của Máy A, Chương 2 & 3 lấy từ Máy A, Chương 4 lấy bản `completed` của Máy B (thắng bản `incomplete` của Máy A), Chương 5 giữ của Máy B.<br>• Không mất bất kỳ chương nào của cả hai máy. |
| **`TEST-L07`** | **Chống Hồi Sinh Bản Đã Xóa qua `deletedTombstones` (`PL-02`)** | • Máy A xuất file JSON chứa Lá số X (`updatedAt = 1000`) và Lá số Y.<br>• Trên Máy A, người dùng xóa vĩnh viễn Lá số X lúc `deletedAt = 2000` (tạo tombstone).<br>• Nhập lại chính file JSON cũ (lúc `1000`) vào Máy A ở chế độ `'smart_merge'`, sau đó thử chế độ `'force_restore_all'`. | • Ở chế độ `'smart_merge'`: Lá số X bị chặn bởi tombstone (`2000 > 1000`), **không được hồi sinh**; Lá số Y vẫn giữ nguyên.<br>• Ở chế độ `'force_restore_all'`: Lá số X được khôi phục lại và tombstone của X được xóa. |
| **`TEST-L08`** | **Trần Ghim `30` mục & Thang Thu Hồi Tất Định 4 Nấc khi chạm trần `100` lá số (`PL-09`)** | • Tạo đầy `100` lá số: trong đó `30` lá số được ghim (`pinned: true`), `69` lá số không ghim nhưng có `2/8` chương hồ sơ, và `1` lá số không ghim chỉ có ghi chú ngắn (`0/8` chương, `lastOpenedAt` cũ nhất).<br>• Thử ghim lá số thứ 31.<br>• Thêm lá số mới thứ `101`. | • Lệnh ghim lá số thứ 31 bị từ chối với mã `'MAX_PINNED_REACHED'`.<br>• Khi thêm lá số thứ 101: tổng số lượng vẫn là `100`; toàn bộ `30` mục `pinned: true` và `69` mục có `2/8` chương được giữ nguyên; đúng `1` mục ở Nấc 2 (`0/8` chương, chỉ có ghi chú) bị thu hồi và được lưu vào `lastEvictedBackupItem`. |
| **`TEST-L09`** | **Xử lý tràn dung lượng `localStorage` (`QuotaExceededError` — `PL-08`)** | Cấu hình `MockStorage` ném lỗi `QuotaExceededError` khi tổng dung lượng vượt `1.2 MB`, sau đó lưu liên tiếp 6 bộ Hồ Sơ 8 Chương lớn (`~180 KB`/bộ) vào cache. | • Hệ thống chỉ giữ tối đa `3` bộ hồ sơ nóng trong `localStorage` (`MAX_HOT_DOSSIERS_LOCALSTORAGE = 3`), tự động dọn bớt khóa `'ziwei_dossier_hot_v1::*'` khi chạm ngưỡng byte mà **không làm mất chỉ mục `ziwei_chart_library_v1`** và vẫn giữ đủ cả 6 bộ hồ sơ trong `inMemoryDossierMirror` / `IndexedDB`. |
| **`TEST-L10`** | **Hậu kiểm văn bản & Kiểm tra Schema khi Nhập File `.JSON` bẩn (`PL-12`)** | Nhập một gói JSON chứa: 1 bản ghi có ngày tháng sai (`31/02/1995`), và 1 bản ghi hợp lệ nhưng văn bản Chương 1 trong JSON chứa chữ Hán/Cyrillic ngoại lai (`"Mệnh Thủy 命宫テスト"`). | • Bản ghi ngày `31/02/1995` bị loại bỏ an toàn (`skippedInvalidCount === 1`).<br>• Bản ghi hợp lệ được nhập và văn bản Chương 1 tự động được làm sạch qua `sanitizeDossierChapterText` (sạch 100% ký tự Hán/Kana). |

---

## 7. Danh Sách 7 Quyết Định Cần Chủ Dự Án Chốt (`QĐ-L1` .. `QĐ-L7` — Đã Cập Nhật Sau Panel)

Kính đề nghị Chủ dự án (**Toàn Đỗ**) phê duyệt danh sách 7 quyết định dưới đây (đã được Tổ Chuyên Gia 5 Vai tinh chỉnh dựa trên bằng chứng thực nghiệm):

### `QĐ-L1` *(Đã sửa lớn sau Panel `PL-01`)* — Kiến trúc Lưu trữ & Giải bài toán Đổi Máy
- **Bối cảnh thực nghiệm**: Tối `17/11/2026`, hai phiên chạy cách nhau 50 phút thấy hai trạng thái `.data/` khác nhau (`1/1` key vs `22/22` key). Do đó `.data/` phía server AI Studio không đồng nhất giữa các phiên/instance; nếu đồng bộ 2 chiều tự động ngầm dựa vào `.data/` sẽ gây phân kỳ lặng lẽ (`Split-Brain`).
- **Các phương án**:
  - **Phương án A *(Đề xuất đồng thuận của Panel)* — Lưu trữ Bền Vững 2 Tầng Phía Client (`localStorage` chỉ mục + `IndexedDB` & Gương RAM cho 100 Hồ Sơ 8 Chương) + Xuất/Nhập File `.JSON` Di Động 1-Click (Không dùng `.data/` phía Server)**:
    - Trên cùng một máy: Đóng tab, tắt trình duyệt hay khởi động lại máy đều giữ bền vững 100% cả 100 lá số lẫn 100 bộ Hồ Sơ 8 Chương.
    - Khi đổi máy (hoặc chuyển giữa `ais-dev-` và `ais-pre-`): Bấm 1 nút **Xuất Thư Viện (.JSON)** ở máy cũ và **Nhập Thư Viện (.JSON)** ở máy mới (hợp nhất đơn điệu từng chương hồ sơ và tôn trọng `deletedTombstones`). Bền vững 100% không phụ thuộc container AI Studio.
  - **Phương án B — Làm Phương án A ở Pha 1–2, và bổ sung thêm "Trạm Trung Chuyển 1 Chiều Có Mã Thực Thể `serverInstanceId`" ở Pha 3**:
    - Giữ nguyên nền tảng Client + `.JSON` của Phương án A, nhưng thêm nút tùy chọn *"Gửi tạm lên Trạm Trung Chuyển Server"* (hiển thị rõ mã phiên container `serverInstanceId` và số lá số) để truyền nhanh giữa 2 máy đang mở cùng một container mà không tự động ghi đè ngầm.
- **Đề xuất**: **Chọn Phương án A** (gọn, chắc chắn 100%, không rủi ro `Split-Brain`).

---

### `QĐ-L2` *(Đã bổ sung sau Panel `PL-04`)* — Khóa Chống Trùng Chuẩn & Ánh Xạ Di Trú Khóa Cũ 3 Bậc
- **Phương án đề xuất (Phương án A)**:
  - Chống trùng theo `buildChartIdentityKey(chart)` (9 thành phần: phân biệt rõ họ tên `nameSlug`, nơi sinh/kinh độ `lonSig`, giờ phút đồng hồ gốc `origSig` và cờ `unknownTime`). Nếu lập lại đúng lá số đã có thì `Upsert` cập nhật `lastOpenedAt` và bảo toàn nguyên vẹn `pinned`, `customAlias`, `notes`, `dossierSummary`.
  - Khi di trú từ `'ziwei_history'` và `'ziwei_dossier_v1::*'`, chạy **Thuật toán Ánh xạ Khóa Kép 3 Bậc** (`Khóa 9 thành phần V2` $\rightarrow$ `Khóa 5 thành phần V1 1.0.0-stable` $\rightarrow$ `Khớp tiền tố 5 thành phần`) để không làm mồ côi bất kỳ hồ sơ cũ nào.

---

### `QĐ-L3` *(Đã sửa lớn sau Panel `PL-08, PL-09`)* — Ngân sách Dung lượng Byte, Trần `100` Lá Số / `30` Ghim & Thang Thu Hồi 4 Nấc
- **Phương án đề xuất (Phương án A)**:
  - Giới hạn tối đa **`100` lá số** (`MAX_LIBRARY_ENTRIES = 100`), trong đó tối đa **`30` lá số được Ghim cố định** (`MAX_PINNED_ENTRIES = 30`), ghi chú tối đa **`2.000` ký tự/lá số**.
  - Phân bổ dung lượng nghiêm ngặt: `localStorage` chỉ lưu chỉ mục 100 lá số (`<= 580 KB`) + tối đa `3` hồ sơ nóng (`<= 660 KB`), tổng `< 1.3 MB / 5 MB`; toàn văn 100 bộ Hồ Sơ 8 Chương lưu trong `IndexedDB` (`~16 MB`) kèm Gương RAM đồng bộ.
  - Khi chạm trần 100 lá số, bảo vệ tuyệt đối 30 mục đã ghim và chạy **Thang thu hồi tất định 4 nấc** trên 70 mục không ghim (kèm giữ bản sao `lastEvictedBackupItem` trong phiên để người dùng có thể hoàn tác hoặc tải file `.json`).

---

### `QĐ-L4` *(Đảo chiều phương án sau Panel `PL-04`)* — Bất Biến Hóa `form.name` Đã Lưu, Đổi Tên Qua `customAlias`
- **Phương án đề xuất (Phương án A — Mới sau Panel)**:
  - Giữ bộ dữ kiện khai sinh `form` (gồm `form.name`, ngày/giờ/nơi sinh, giới tính) **bất biến** sau khi lá số đã lưu vào Thư Viện để `chartIdentityKey` không bao giờ bị thay đổi (tránh làm đứt liên kết với Hồ Sơ 8 Chương, Mạch Chat, `aiPeriodCache` và tránh tạo bản ghi trùng khi gộp file `.json` giữa nhiều máy).
  - Người dùng đổi tên hiển thị/phân biệt lá số thông qua trường **`customAlias` (Tên gợi nhớ, tối đa 80 ký tự)**. Nếu muốn sửa tên khai sinh gốc để lập lá số mới, cung cấp nút *"Nạp dữ kiện lên Form để sửa & lập mới"*.

---

### `QĐ-L5` *(Đã tinh gọn MVP sau Panel `PL-03`)* — Vị Trí Giao Diện Thư Viện & Phạm Vi Điểm Chạm MVP
- **Phương án đề xuất (Phương án A)**:
  - Triển khai nút **`Thư Viện (N)`** trên thanh Header chính mở `ChartLibraryModal.tsx`, hiển thị tiến độ **`Hồ Sơ Chi Tiết (X/8 Chương)`** + nút Ghim nhanh trên `Quick Summary Bar` (`src/App.tsx`), nâng cấp danh sách rút gọn trong `BirthForm.tsx` và tự động nạp Chương 5/6 từ Thư Viện vào `aiPeriodCache` khi mở lá số (`PL-11`).
  - Lùi tính năng chọn đương số từ Thư Viện trong `HemingView.tsx` và hệ thống mảng nhãn `tags[]` phức tạp sang Pha sau để giữ MVP gọn và ổn định.

---

### `QĐ-L6` *(Giữ nguyên)* — Cảnh Báo Xác Nhận Xóa 2 Bước & Sổ Cái `deletedTombstones`
- **Phương án đề xuất (Phương án A)**:
  - Khi bấm xóa một lá số trong Thư Viện có Hồ Sơ hoặc Ghi chú, hiển thị hộp xác nhận nội tuyến nêu rõ số chương đang có (`X/8`), thời điểm sinh và tên model, với 3 lựa chọn: **(1) Hủy**, **(2) Chỉ xóa Hồ Sơ (giữ lại Lá Số & Ghi chú)**, **(3) Xóa vĩnh viễn cả Lá Số & Hồ Sơ** (ghi nhận vào `deletedTombstones` để chống hồi sinh khi gộp file `.json` cũ).

---

### `QĐ-L7` *(Thay thế hoàn toàn sau Panel `PL-05, PL-06`)* — Bảo Vệ Dữ Liệu Cá Nhân (PII) Trên `ais-pre-` & Không Mở Rộng API Server
- **Phương án đề xuất (Phương án A — Mới sau Panel)**:
  - Không tạo API `/api/library/*` trên `server.ts`, không dùng chung `KEY_POOL_ADMIN_PIN`, không mã hóa giả tạo trong `.data/` và giữ nguyên `express.json({ limit: '512kb' })` tại `server.ts:460`.
  - Toàn bộ dữ liệu cá nhân (họ tên, ngày giờ sinh, ghi chú riêng, hồ sơ luận giải) nằm 100% ở trình duyệt máy người dùng và file `.json` cá nhân, đảm bảo **bề mặt lộ dữ liệu cá nhân qua link chia sẻ `ais-pre-` bằng 0 tuyệt đối**.
