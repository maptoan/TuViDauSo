# BIÊN BẢN PHẢN BIỆN TỔ CHUYÊN GIA: KẾ HOẠCH THIẾT KẾ NỀN TRI THỨC AI TỬ VI ĐẨU SỐ (`docs/knowledge-base-expert-panel-review.md`)

- **Loại tài liệu**: `[Biên bản Phản biện & Tối ưu hóa Kỹ thuật — Tổ Chuyên Gia 5 Vai]`
- **Hình thức thực hiện**: **Mô phỏng đa vai trong một phiên làm việc duy nhất (Single-Session Simulated Multi-Role Expert Panel)**
- **Ngày thực hiện**: `18/11/2026`
- **Tài liệu đầu vào được thẩm định**: `docs/knowledge-base-design-plan.md` (Bản V1) + Brief đính chính số liệu nguồn & Agenda `ĐN-1..ĐN-10` của Muse
- **Tài liệu đầu ra sau thẩm định**: `docs/knowledge-base-design-plan.md` (**Bản POST-PANEL V2**)
- **Phiên bản mã nguồn đối chiếu (Code SSOT)**: `1.3.0-rc.1` (`package.json`: `"1.3.0"`, tuyệt đối không sửa code trong lượt này)
  - `server.ts` (`dòng 158–213, 346–457, 460, 638–1150`)
  - `server/key-pool/types.ts` (`dòng 179–197`)
  - `src/lib/ziwei/dossier-context.ts` (`dòng 36–111, 259–346, 380–540, 623–1080`)
  - `src/lib/ziwei/yunxian-context.ts` (`dòng 206–248, 316–728`)
  - `src/lib/ziwei/vi-i18n.ts` (`dòng 5–695+`)
  - `src/lib/ziwei/text-sanitizer.ts` (`dòng 54–289`)
  - `src/lib/dossier-chat-ui.ts` (`dòng 170–225`)

---

## 1. Thành Phần Tổ Chuyên Gia Mô Phỏng & Nhận Định Độc Lập Ban Đầu

Phiên phản biện được tổ chức với **5 vai chuyên gia độc lập** đọc toàn bộ Bản V1 cùng Brief đính chính số liệu thật từ repo gốc (`github.com/Renhuai123/ziwei-doushu`):

1. **Vai 1 — Chuyên gia Tử Vi Đẩu Số & Hệ thống Thiên Kỷ (`Ziwei & Tianji Domain Expert`)**:
   - *Nhận định ban đầu*: Bản V1 nắm rất chắc cấu trúc code hiện tại của app và khóa từ điển `vi-i18n.ts`, nhưng mắc sai lầm nghiêm trọng về mặt cấu trúc tư liệu khi coi mỗi dòng trong `entries.jsonl` (1.848 dòng) là một mục tri thức độc lập. Thực tế trên repo gốc, mỗi dòng `quote` chỉ có trung vị **61 ký tự** (trung bình ~73 ký tự) — đó là các **mảnh câu / ý lẻ** được cắt ra dưới cùng một tiểu mục `(book, h2, h3)`. Nếu chưng cất rời từng dòng, kho tri thức sẽ vỡ vụn, mất điều kiện tiên quyết (*"tiền đề là tam phương phải hội..."*) nằm ở dòng `quote` liền trước hoặc liền sau. Đơn vị chưng cất bắt buộc phải gộp theo nhóm ngữ nghĩa `(book, h2, h3)`, kèm cơ chế chia tiểu mục theo sao đối với `02-palaces` (vốn chỉ có 16 nhóm `h3` cho 366 quote).
2. **Vai 2 — Kiến trúc sư Hệ thống AI & Truy hồi Tất định (`AI/RAG Systems Architect`)**:
   - *Nhận định ban đầu*: Khi chuyển đơn vị chưng cất sang nhóm `(book, h2, h3)`, toàn bộ `1.045` quote của Tầng 1 gom lại chỉ còn **`138` nhóm `(book, h2, h3)`** (hoặc ~175 mục nếu tách tiểu mục theo sao ở `02-palaces`). Đây là tin cực tốt cho kiến trúc: tổng số mục toàn kho Tầng 1 + Cổ thư + Bài giảng chỉ khoảng **280–340 mục cô đọng**, nạp vào RAM mất `< 5 ms`, không bao giờ lo trùng lặp mảnh vụn trong Top-K. Ngoài ra, vì trong `entries.jsonl` có sẵn `bvid` và `t_hms`, còn 16 file bài giảng `tianji-ziwei/*.md` cũng gắn `bvid`, bước chưng cất ngoại tuyến hoàn toàn có thể kéo thêm đoạn bài giảng bao quanh `(bvid, t_hms)` làm ngữ cảnh để bản tóm lược đầy đặn, trong khi `hanziAnchor` vẫn neo cứng vào chuỗi `quote` gốc.
3. **Vai 3 — Kỹ sư Kiểm chứng & An toàn AI (`AI Verification & Safety Engineer`)**:
   - *Nhận định ban đầu*: Khung chống bịa 3 lớp (`V1` mã thẻ bịa, `V2` viện dẫn không thẻ, `V3` gắn thẻ lệch thực thể sao/cung) và bộ kiểm thử `K1/K2/K3` ở V1 được thiết kế đúng hướng. Tuy nhiên có 3 lỗ hổng kỹ thuật phải bít: (i) cửa sổ V2 `"≤ 250 ký tự"` là con số tùy ý, dễ báo lỗi giả khi AI đặt thẻ `[Nguồn: ...]` ở cuối đoạn văn hoặc cuối bullet; (ii) cơ chế *"dùng regex tự động viết lại cụm từ mạo danh giữa câu văn"* trong `QĐ-N4-A` cực kỳ nguy hiểm với ngữ pháp tiếng Việt; (iii) V1 chưa phân tách rõ thời điểm chạy hậu kiểm giữa luồng Hồ Sơ (lưu vào SSOT sau khi stream xong) và luồng Chat (đã stream chữ ra màn hình theo thời gian thực).
4. **Vai 4 — Chuyên gia Vận hành, Môi trường & Quota (`Operations & Quota Specialist`)**:
   - *Nhận định ban đầu*: Số liệu đo đạc nguồn ở V1 (§0.1, §2.4, §3.1) bị sai do nhầm byte UTF-8 thành số ký tự Hán và đếm dư 1 file (số thật: **16 file `.md`**, **342.785 ký tự**, **150.726 ký tự Hán**, **~685.749 byte**). Nếu giữ cổng `kb:verify-source` như V1 (§2.4 yêu cầu 17 file và 680.000–705.000 ký tự Hán), script sẽ **FAIL 100%** ngay khi nạp dữ liệu thật! Thứ hai, tính bền của thư mục `checkpoints/` và biến môi trường `KB_DISTILL_GEMINI_KEYS` trong container AI Studio chưa được kiểm chứng; trong khi sau khi gộp theo `(book, h2, h3)`, số mục cần chưng cất chỉ còn hơn một trăm nhóm. Do đó nên chốt **chạy pipeline chưng cất ngoại tuyến trên máy cá nhân của Chủ dự án bằng model mạnh (`gemini-2.5-pro` hoặc `gemini-3.8-flash`) rồi commit file `.kb.json` hoàn chỉnh vào repo** làm phương án chính.
5. **Vai 5 — Luật sư & Chuyên gia Giấy phép Dữ liệu (`Data Licensing & Scope Specialist`)**:
   - *Nhận định ban đầu*: Phân tầng 3 lớp phạm vi (loại bỏ `08-yili`, `10-divination`, `11-fengshui` và phần phong thủy/y lý rời khỏi runtime Tử Vi) ở V1 là hoàn toàn chính xác. Về giấy phép `CC BY-NC-SA 4.0`, cần làm rõ thêm sự phân tách giữa các câu phú cổ thư thuộc phạm vi công cộng (*Cốt Tủy Phú*, *Thái Vi Phú*, *Toàn Thư* — nguyên bản Hán là `Public Domain`, bản dịch/chú giải mới theo giấy phép dự án) và phần bài giảng hiện đại của Nghê Hải Hạ (`CC BY-NC-SA 4.0`) ngay trên trường metadata của từng bản ghi.

---

## 2. Bảng Tổng Hợp Các Phát Hiện Phản Biện (`NK-01` .. `NK-12`)

| Mã phát hiện | Nguồn Brief / Agenda | Vai nêu chính | Mức độ | Tóm tắt phát hiện | Kết luận xử lý của Panel |
|---|---|---|---|---|---|
| **`NK-01`** | `ĐN-1` & `[B]` | Vai 1 & Vai 2 | **NGHIÊM TRỌNG** | V1 lấy từng dòng `entries.jsonl` (`1.848` dòng) làm đơn vị chưng cất độc lập, trong khi thực tế mỗi dòng `quote` chỉ là mảnh câu ngắn (trung vị `61` ký tự, trung bình `~73` ký tự). Chưng cất từng mảnh gây vụn nghĩa, mất điều kiện tiên quyết và trùng lặp Top-K. | **ĐỔI ĐƠN VỊ CHƯNG CẤT SANG NHÓM NGỮ NGHĨA `(book, h2, h3)`**: Gộp các `quote` + `note` cùng `(book, h2, h3)` theo thứ tự `part`/`t_hms` thành 1 mục hoàn chỉnh (`Tầng 1 = 138 nhóm gốc`, có chia tiểu mục theo sao cho `02-palaces` $\rightarrow$ `~175` mục). |
| **`NK-02`** | `[B]` & `ĐN-7` | Vai 4 & Vai 3 | **NGHIÊM TRỌNG** | Số liệu nguồn ở V1 §0.1, §2.4, §3.1 sai lệch so với repo gốc (`17 file, 691.000 ký tự Hán` và `250–400 ký tự/mục`), làm cổng `kb:verify-source` chắn chắn FAIL oan và làm sai toàn bộ phép tính số mục / số request / dung lượng. | **ĐÍNH CHÍNH TOÀN BỘ SỐ LIỆU THEO SỐ ĐO THẬT**: `16` file bài giảng `.md` (`342.785` ký tự, `150.726` ký tự Hán, `~685.749` byte); `entries.jsonl` `1.848` dòng (`134.435` ký tự `quote`, trung vị `61`, trung bình `~73`, max `353`; `208` nhóm `h3`, `68` cặp `h2`). Tính lại toàn bộ bảng số học. |
| **`NK-03`** | `ĐN-2` | Vai 1 & Vai 2 | **CAO** | Nếu chỉ chưng cất từ chuỗi `quote` rời (tổng `134.435` ký tự) sẽ thiếu mạch giảng giải liên kết của Nghê Sư; ngược lại nếu lấy bài giảng tự do làm neo thì khó kiểm chứng chuỗi con. | **CHỐT CƠ CHẾ HYBRID GROUNDED EXTRACTION**: Với `nihai_entry`, lấy toàn bộ `quote` + `note` của nhóm `(book, h2, h3)` làm khung bắt buộc + tự động kéo đoạn bài giảng trong `tianji-ziwei/*.md` khớp `(bvid, t_hms)` ($\pm 600$ ký tự) làm ngữ cảnh bổ trợ khi chưng cất, nhưng `hanziAnchor` vẫn neo cứng vào mảng `quote` gốc. |
| **`NK-04`** | `ĐN-3` | Vai 4 & Vai 2 | **CAO** | Biến môi trường `KB_DISTILL_GEMINI_KEYS` và tính bền của thư mục `checkpoints/` trong môi trường AI Studio chưa được kiểm chứng; V1 cũng chưa chỉ định model chạy chưng cất. | **CHỐT PHƯƠNG ÁN CHẠY NGOẠI TUYẾN TRÊN MÁY CÁ NHÂN & COMMIT `.kb.json` LÀM ĐƯỜNG CHÍNH**: Script `scripts/kb-distill.ts` vẫn nằm trong repo nhưng được Chủ dự án chạy trên máy local bằng khóa riêng với model mạnh (**`gemini-2.5-pro`** hoặc **`gemini-3.8-flash`**), chỉ commit file `.kb.json` hoàn chỉnh vào dự án. |
| **`NK-05`** | `ĐN-4` | Vai 3 | **CAO** | Cửa sổ kiểm tra V2 `"cùng câu/liền kề ≤ 250 ký tự"` tùy ý, dễ bắt nhầm khi thẻ `[Nguồn: ...]` đặt ở cuối đoạn/bullet; cổng `K3` đòi `Recall 100% + FP 0%` cho regex heuristic là quá tuyệt đối. | **ĐỔI ĐƠN VỊ KIỂM TRA V2 SANG ĐOẠN VĂN / BULLET (`Paragraph / Bullet Block`) & HIỆU CHỈNH CỔNG K3**: `V1` giữ `100% Recall / 0% FP` trên `8` mẫu (`K3-A`); `V2 & V3` trên `24` mẫu chuẩn chia 3 tập (`K3-A/B/C`) yêu cầu **`Recall ≥ 87,5% (≥ 7/8 mẫu K3-B)`** và **`False Positive ≤ 12,5% (≤ 1/8 mẫu K3-C, 0 báo nhầm trên câu dữ kiện lá số)`**. |
| **`NK-06`** | `ĐN-5` | Vai 2 & Vai 3 | **CAO** | V1 chưa tách rõ thời điểm chạy hậu kiểm Lớp 2 cho từng luồng (Hồ Sơ lưu SSOT vs Chat đã hiển thị trực tiếp từng chữ qua SSE vs Vận hạn). | **CHỐT CƠ CHẾ RIÊNG CHO TỪNG LUỒNG**: (1) Hồ Sơ & Vận hạn: hậu kiểm cuối luồng SSE trước khi đóng `[DONE]` và làm sạch V1 + nối khối tham chiếu/đính chính trước khi lưu vào SSOT `IndexedDB`; (2) Chat: giữ nguyên chữ đã stream, chỉ nối thêm dòng chú thích nguồn hoặc lưu ý kiểm chứng ở cuối bong bóng chat trước `[DONE]`. |
| **`NK-07`** | `ĐN-6` | Vai 3 & Vai 1 | **CAO** | Cơ chế "trung hòa cụm từ mạo danh bằng regex" (`QĐ-N4-A` ở V1) dễ cắt hỏng cấu trúc câu tiếng Việt đa dạng do AI sinh ra. | **BÁC BỎ VIẾT LẠI CÂU VĂN BẰNG REGEX TỰ ĐỘNG**: Chỉ xóa thẻ `[Nguồn: ID_SAI]` bất hợp lệ (`V1` hoặc `V3`); với câu vi phạm `V2/V3`, giữ nguyên văn câu để không vỡ ngữ pháp và tự động nối **Hộp Lưu Ý Kiểm Chứng Nguồn** ở cuối chương/bài. |
| **`NK-08`** | `ĐN-8` | Vai 1 & Vai 2 | **TRUNG BÌNH** | Từ điển ánh xạ chủ đề đời sống $\rightarrow$ cung trong Chat có độ phủ hạn chế; V1 chưa làm rõ `starAbsentInQueriedPalace` xét riêng bản cung hay cả Tam Phương Tứ Chính. | **CHỐT BEST-EFFORT CHO CHAT + XÉT ĐỦ TAM PHƯƠNG TỨ CHÍNH**: Chat ở Đợt Pilot khớp tên Sao/Cung/Cách cục/Tứ Hóa chuẩn `vi-i18n.ts` + từ điển ~40 từ khóa chủ đề (fallback về Mệnh + cung đang mở) kèm Lớp 3 trung thực; `starAbsentInQueriedPalace = true` chỉ khi sao vắng mặt ở **cả bản cung, sao mượn lẫn Tam Phương Tứ Chính (`+4, +8, +6`)**. |
| **`NK-09`** | `ĐN-9` | Vai 2 & Vai 4 | **TRUNG BÌNH** | V1 §4.2A.4 thiết kế truy hồi cho cả `/api/interpret` và `/api/heming`, trong khi Pilot §6.1 chỉ tích hợp 3 luồng chính và chưa chưng cất `02-palaces` (cung Phu Thê). | **CHỐT HOÃN `/api/interpret` VÀ `/api/heming` SANG ĐỢT 1B**: Đợt Pilot 1A chỉ tích hợp đúng 3 luồng chính (`/api/interpret-dossier-section`, `/api/interpret-period`, `/api/interpret-chat`). |
| **`NK-10`** | `ĐN-10` | Vai 3 & Vai 4 | **TRUNG BÌNH** | Quy trình vận hành cổng NotebookLM ở V1 chưa chỉ rõ ai thực thi, mẫu sinh thế nào, đơn vị tính `≥ 98%` là gì; mã thẻ `citationId` cần thiết kế lại theo nhóm `(book, h2, h3)`. | **CHUẨN HÓA QUY TRÌNH QA & MÃ THẺ CẤP NHÓM**: Đặt mã thẻ dạng `NH-STAR-001..083`, `NH-SIHUA-001..019`, `CL-CTP-001..`; script xuất phiếu kiểm định `25` mục mẫu ($\approx 16\%$ Pilot), Chủ dự án đối chiếu trên NotebookLM/neo Hán và ký duyệt với ngưỡng **$\ge 24/25$ mục đạt ($96\%+$, 0 lỗi đảo ngược cát/hung)**. |
| **`NK-11`** | *Mở rộng từ `ĐN-1`* | Vai 1 & Vai 2 | **TRUNG BÌNH** | Trong `entries.jsonl`, quyển `02-palaces` có `366` quote nhưng chỉ có `16` nhóm `(book, h2, h3)` (mỗi cung chỉ là 1 nhóm `h3` chứa ~23–30 quote của nhiều sao khác nhau). Nếu gộp cứng cả 30 quote vào 1 mục duy nhất sẽ quá dài và mất khóa truy hồi theo cặp `(Sao + Cung)`. | **BỔ SUNG QUY TẮC CHIA TIỂU MỤC CÓ ĐIỀU KIỆN (`Conditional Sub-Grouping`) CHO `02-palaces`**: Các nhóm `(book, h2, h3)` có $\le 12$ quote được giữ nguyên 1 nhóm = 1 mục; các nhóm trong `02-palaces` có $> 12$ quote và bàn về nhiều chính tinh được tách tất định theo `section` / chính tinh chủ đạo thành `~48` tiểu mục `(Cung + Nhóm Sao)`. |
| **`NK-12`** | *Bổ sung của Vai 5* | Vai 5 | **THẤP** | Cần phân biệt rõ trạng thái bản quyền giữa văn bản cổ thư (`Public Domain`) và bài giảng hiện đại của Nghê Hải Hạ (`CC BY-NC-SA 4.0`) trong schema. | **THÊM TRƯỜNG `sourceLicense` TRONG `KnowledgeSourceRef`**: Ghi rõ `'CC-BY-NC-SA-4.0'` cho tư liệu Thiên Kỷ Nghê Hải Hạ và `'PUBLIC_DOMAIN_TEXT_WITH_CC_BY_NC_SA_ADAPTATION'` cho cổ thư. |

---

## 3. Thảo Luận Chi Tiết & Kết Luận Của Panel Cho Từng Điểm Agenda (`ĐN-1` .. `ĐN-10`)

### 3.1. Giải quyết `ĐN-1` & `NK-11` — Đơn vị Chưng cất (`Distillation Unit`) & Tính lại Hệ thống Số học
- **Tranh luận giữa các vai**:
  - **Vai 1 (Chuyên gia Tử Vi)**: Trong `entries.jsonl`, mỗi dòng có 9 trường thật: `{ book, h2, h3, quote, section, t_hms, note, bvid, part }`. Với trung vị `quote` chỉ **61 ký tự** (chẳng hạn 1 câu ngắn *"Tử Vi ở Ngọ không có Tả Hữu thì là cô quân"* và dòng kế tiếp ở cùng `h3` là *"Nếu hội Khoa Quyền Lộc ở Tam Phương thì vẫn làm nên nghiệp lớn"*), nếu tách thành 2 mục độc lập thì khi truy hồi Top-K có thể chỉ bốc trúng câu 1 mà bỏ sót câu 2, làm AI luận giải phiến diện! Ngược lại, một nhóm `(book, h2, h3)` chính là **một đơn vị luận đề hoàn chỉnh** của Nghê Sư.
  - **Vai 2 (Kiến trúc sư RAG)**: Hoàn toàn đồng ý lấy nhóm `(book, h2, h3)` làm đơn vị chưng cất chuẩn. Tuy nhiên, hãy nhìn vào thống kê số nhóm `(book, h2, h3)` của Tầng 1:
    - `01-stars`: `378` quote $\rightarrow$ **`83` nhóm `(book, h2, h3)`** (trung bình `4,55` quote/nhóm, tổng ~330 ký tự Hán/nhóm — kích thước hoàn hảo cho 1 `DistilledKnowledgeEntry`!).
    - `03-patterns`: `127` quote $\rightarrow$ **`20` nhóm `(book, h2, h3)`** (trung bình `6,35` quote/nhóm, ~460 ký tự Hán/nhóm — rất vừa vặn!).
    - `04-sihua`: `174` quote $\rightarrow$ **`19` nhóm `(book, h2, h3)`** (trung bình `9,15` quote/nhóm, ~660 ký tự Hán/nhóm — vừa vặn!).
    - Riêng `02-palaces`: `366` quote nhưng chỉ có **`16` nhóm `(book, h2, h3)`** (vì mỗi cung trong 12 cung chỉ là 1 mục `h3`, chứa trung bình `22,9` quote bàn về đủ các sao khác nhau khi đóng vào cung đó). Nếu gộp cả 23 quote của cung Phu Thê hay Tài Bạch vào 1 mục duy nhất dài 1.700 ký tự Hán, khi đương số chỉ có *Vũ Khúc* tại Tài Bạch, ta lại phải nạp cả nhận định về *Thái Âm, Thiên Đồng, Cự Môn* tại Tài Bạch.
  - **Giải pháp đồng thuận của Panel cho `ĐN-1`**:
    1. **Quy tắc Gộp Chuẩn (`Canonical Grouping Rule`)**: Đơn vị chưng cất cơ sở của `entries.jsonl` là **nhóm `(book, h2, h3)`**, trong đó toàn bộ các dòng `quote` (kèm `note`, `t_hms`, `bvid`, `section`) thuộc cùng `(book, h2, h3)` được sắp xếp tăng dần theo `(part, t_hms)` và hợp nhất thành 1 `DistilledKnowledgeEntry`.
    2. **Quy tắc Tách Tiểu Mục Tất Định cho Nhóm Quá Lớn (`Deterministic Sub-Grouping Rule` cho `02-palaces`)**: Nếu một nhóm `(book, h2, h3)` có **$> 12$ quote** VÀ các quote bên trong có trường `section` hoặc tên Chính Tinh (`CN_TO_VI_STAR`) khác nhau (điển hình là 16 nhóm của `02-palaces`), script tiền xử lý `kb-group-entries.ts` tách tất định nhóm đó thành:
       - `1` tiểu mục nguyên lý chung của cung đó (`subKey: 'general'`), và
       - Các tiểu mục theo cụm Chính Tinh / `section` xuất hiện trong cung đó (mỗi tiểu mục gom 3–8 quote cùng sao/cùng `section`).
       - Với quy tắc này: `01-stars` giữ nguyên **`83` mục nhóm**; `03-patterns` giữ nguyên **`20` mục nhóm**; `04-sihua` giữ nguyên **`19` mục nhóm**; còn `16` nhóm lớn của `02-palaces` được chia thành khoảng **`52` tiểu mục `(Cung × Cụm Sao)`** (tổng cộng Tầng 1 từ `entries.jsonl` = `138` nhóm gốc / `~174` mục truy hồi).
    3. **Cấu trúc `hanziAnchor` theo nhóm**: Lưu mảng có cấu trúc `quotes: Array<{ quote: string; note?: string; t_hms?: string; bvid?: string; part?: number }>` cùng chuỗi gộp `combinedQuotesCn`, bảo đảm truy vết ngược từng câu quote về đúng dòng gốc trong `entries.jsonl`.

---

### 3.2. Giải quyết `ĐN-2` — Văn bản Nguồn đưa vào Chưng cất (`Hybrid Grounded Extraction`)
- **Phân tích của Vai 1 & Vai 2**:
  - Tổng lượng chữ trong `quote` của cả `1.848` dòng `entries.jsonl` là `134.435` ký tự, nhưng các `quote` là câu kết luận đã lược bỏ phần giải thích nhân quả xung quanh.
  - May mắn là trên dữ liệu thật, cả `entries.jsonl` lẫn `16` file bài giảng `tianji-ziwei/*.md` đều chứa mã video **`bvid`** và mốc thời gian **`t_hms`** (hoặc tiêu đề `section`).
- **Kết luận đồng thuận của Panel cho `ĐN-2`**:
  1. **Đối với `corpusType = 'nihai_entry'` (các nhóm `(book, h2, h3)` từ `entries.jsonl`)**:
     - Áp dụng **Chưng cất Neo Kép (`Quotes as Anchor + Lecture Window as Context`)**:
       - **Phần Neo Bắt Buộc (`Primary Quotes`)**: Toàn bộ danh sách `quote` + `note` của nhóm `(book, h2, h3)`.
       - **Phần Ngữ Cảnh Bài Giảng Bổ Trợ (`Supporting Lecture Context`)**: Script tiền xử lý tự động dò mã `bvid` và mốc `t_hms` (hoặc chuỗi `quote` đầu/cuối) trong `16` file `tianji-ziwei/*.md` để trích thêm đoạn văn bản bài giảng bao quanh ($\pm 500\text{–}600$ ký tự quanh vị trí khớp) đưa vào prompt chưng cất dưới nhãn `[NGỮ CẢNH BÀI GIẢNG GỐC ĐỂ HIỂU MẠCH LẬP LUẬN]`.
       - **Kỷ luật Neo Kiểm Chứng**: Gemini được dùng ngữ cảnh bài giảng để làm rõ điều kiện áp dụng (`conditionsVi`) và mạch nhân quả trong `summaryVi`, nhưng trường `hanziAnchor` lưu trong DB **vẫn chỉ chứa nguyên văn các `quote` gốc của nhóm đó** (kèm `bvid`, `t_hms`) để cổng kiểm định chuỗi con đạt chính xác tuyệt đối 100%.
  2. **Đối với `corpusType = 'classic_verse'` (`lib/classics/data/` ~40 KB: *Cốt Tủy Phú*, *Thái Vi Phú*, *Toàn Tập*, *Toàn Thư*)**:
     - Mỗi bài phú được tách theo từng câu/khổ phú có ý nghĩa độc lập (~60–80 mục cho Đợt 1A). Prompt chưng cất thực hiện **dịch trọn nghĩa câu phú (`fullTranslationVi`) + tóm lược cách ứng dụng thực tế trên lá số (`summaryVi`, `conditionsVi`)**, và giữ nguyên câu phú chữ Hán gốc làm `hanziAnchor`.
  3. **Đối với `corpusType = 'nihai_lecture'` (16 file `tianji-ziwei/*.md` & `lib/nihai/` ở Đợt 1B)**:
     - Chỉ trích xuất các mục bài giảng theo **12 Thế đứng của sao Tử Vi tại 12 địa chi** và các chuyên đề Tứ Hóa/Vận hạn **chưa được phủ hết** trong `138` nhóm của `entries.jsonl` (ước tính khoảng **`40–60` mục chuyên đề bài giảng** ở Đợt 1B, thay vì 180–240 mục như V1 ước tính khi chưa biết số đo thật 150.726 chữ Hán). Mỗi mục neo `hanziAnchor` bằng đoạn trích nguyên văn 150–350 ký tự Hán từ file bài giảng kèm `bvid` + mốc thời gian.

---

### 3.3. Giải quyết `ĐN-3` — Môi trường Chạy Chưng cất, Tính bền Dữ liệu & Lựa chọn Model Chưng cất
- **Phân tích của Vai 4 (Vận hành & Quota)**:
  - Trong môi trường container preview của AI Studio, việc cấu hình biến môi trường tùy chỉnh `KB_DISTILL_GEMINI_KEYS` và tính bền vững lâu dài của thư mục tạm `/server/knowledge-base/checkpoints/` qua các lần khởi động lại container **chưa được kiểm chứng**.
  - Quan trọng hơn: Sau khi áp dụng `ĐN-1` (gộp theo nhóm `(book, h2, h3)`), số lượng mục cần chưng cất đã giảm đi **hơn 7 lần**:
    - Đợt Pilot 1A: `83` nhóm `01-stars` + `19` nhóm `04-sihua` + `~70` mục cổ thư `classics` = **`~172` mục**!
    - Nếu gom lô `3–4` mục cùng nhóm vào 1 request chưng cất, toàn bộ **Đợt Pilot 1A chỉ cần `~45 – 55` request API**; cả **Đợt 1B (`~110` mục bổ sung) cũng chỉ cần `~30 – 40` request API**!
  - Với tổng số chỉ `~45–55` request chạy **một lần duy nhất** để tạo ra nền tri thức cố định cho toàn bộ vòng đời ứng dụng, việc dùng model `gemini-3.5-flash-lite` để chưng cất là không tối ưu về chiều sâu dịch thuật Hán–Việt cổ văn.
- **Kết luận đồng thuận của Panel cho `ĐN-3`**:
  1. **Phương thức thực thi chính (`Offline Local Build-and-Commit — Phương án C nâng cấp`)**:
     - Mã nguồn bộ công cụ (`scripts/kb-verify-source.ts`, `scripts/kb-group-entries.ts`, `scripts/kb-distill.ts`, `scripts/kb-audit-quality.ts`) vẫn được viết chuẩn mực và commit đầy đủ trong dự án.
     - **Ai thực thi & Chạy ở đâu**: Chủ dự án (hoặc kỹ sư vận hành) chạy pipeline chưng cất trên máy cá nhân (local Node.js/`tsx`) bằng API key riêng (`GEMINI_API_KEY` / `KB_DISTILL_GEMINI_KEY`), hoặc chạy qua CLI một lần khi nạp nguồn, sau đó **đưa trực tiếp các file kết quả tĩnh `/server/knowledge-base/data/*.kb.json` và `/server/knowledge-base/checkpoints/distill-progress.jsonl` vào cây mã nguồn dự án**.
     - **Lợi ích kép**: (i) Tuyệt đối **0 đụng chạm** vào Kho Khóa Runtime `.data/gemini-key-pool.enc.json` của app; (ii) File `.kb.json` nằm sẵn trong repo nên bền vững 100% qua mọi lần build/deploy trên AI Studio mà không cần chạy lại chưng cất ở runtime.
  2. **Chốt Model Chưng cất Ngoại tuyến (`KB_DISTILL_MODEL`)**:
     - Mặc định sử dụng model chất lượng cao **`gemini-2.5-pro`** (hoặc **`gemini-3.8-flash`** làm phương án tốc độ cao có `responseSchema` chặt, cấu hình qua biến `KB_DISTILL_MODEL`), **không dùng `gemini-3.5-flash-lite` cho khâu chưng cất kho nguồn** (trong khi runtime của app vẫn giữ nguyên `DEFAULT_MODEL = 'gemini-3.5-flash-lite'` và `FALLBACK_MODEL = 'gemini-3.8-flash'` theo `server/key-pool/types.ts:179–180`).

---

### 3.4. Giải quyết `ĐN-4` — Đơn vị Cửa sổ Kiểm tra `V2` & Hiệu chỉnh Ngưỡng Cổng Kiểm thử `K3`
- **Phân tích của Vai 3 (Kiểm chứng & An toàn AI)**:
  - Trong V1 §5.2, quy tắc `V2` yêu cầu: *"câu khớp mẫu M1/M2 phải có thẻ `[Nguồn: <ID>]` trong cùng câu hoặc câu liền kề $\le 250$ ký tự"*. Trên thực tế khi viết Markdown, Gemini rất hay viết một đoạn 3–4 câu hoặc một bullet dài 350–450 ký tự mở đầu bằng *"Theo hệ thống Thiên Kỷ của Nghê Hải Hạ, khi Vũ Khúc tọa Tài Bạch..."* rồi phân tích 2 câu và đặt thẻ **`[Nguồn: NH-STAR-018]` ở cuối đoạn văn / cuối bullet đó**. Nếu cắt cứng 250 ký tự, bộ hậu kiểm sẽ báo lỗi `V2` oan (False Positive)!
  - Tương tự, ở cổng `K3` (V1 §5.4), việc đòi hỏi `Recall 100%` và `False Positive 0%` tuyệt đối cho cả 3 quy tắc `V1, V2, V3` là không thực tế đối với `V2/V3` (vốn dựa trên heuristic tách câu và nhận diện mẫu ngôn ngữ tự nhiên).
- **Kết luận đồng thuận của Panel cho `ĐN-4`**:
  1. **Đổi Đơn vị Cửa sổ Kiểm tra `V2` và `V3` sang Khối Đoạn Văn / Bullet Markdown (`Markdown Paragraph / List-Item Block`)**:
     - Văn bản đầu ra của AI được tách thành các **Khối Ngữ Nghĩa (`Semantic Blocks`)** theo ranh giới dòng trống (`\n\n+`), dòng tiêu đề (`^#{1,6}\s`), hoặc từng mục danh sách (`^\s*(?:[-*•]|\d+[.)])\s+`).
     - Một câu có dấu hiệu viện dẫn học thuật `M1` (tên tác giả/trường phái/cổ thư) hoặc `M2` (khẩu quyết trong ngoặc kép) được coi là **Hợp lệ về mặt gắn nguồn (`Cited`)** nếu trong **cùng Khối Đoạn Văn / cùng Mục Bullet đó** (tối đa `800` ký tự cho 1 khối đơn) có chứa ít nhất một thẻ `[Nguồn: <ID>]` thuộc `allowedEntryIds`.
  2. **Hiệu chỉnh Ngưỡng Cổng Kiểm thử `K3` (Khả thi, Định lượng & Chặt chẽ)**:
     - Mở rộng bộ mẫu kiểm thử đơn vị `K3` lên **`24` mẫu chuẩn đã khóa (`Golden Verifier Benchmark`)** chia làm 3 tập tách biệt:
       - **Tập K3-A (`V1` — Kiểm tra mã thẻ nguồn hợp lệ vs mã thẻ bịa/ngoài danh sách, `8` mẫu)**: Bắt buộc đạt **`Recall = 100% (8/8)`** và **`False Positive = 0%`** (vì kiểm tra phần tử thuộc tập hợp `allowedEntryIds` là phép toán tập hợp tất định 100%).
       - **Tập K3-B (`V2 & V3` — Phát hiện câu viện dẫn học thuật quên gắn thẻ hoặc gắn thẻ lệch sao/cung, `8` mẫu vi phạm)**: Yêu cầu đạt **`Recall ≥ 87,5% (≥ 7/8 mẫu, mục tiêu thiết kế 8/8)`**.
       - **Tập K3-C (Kiểm tra Chống Báo Động Giả trên các đoạn mô tả dữ kiện lá số chuẩn & đoạn trích dẫn hợp lệ đặt thẻ ở cuối đoạn/bullet, `8` mẫu hợp lệ)**: Yêu cầu đạt **`False Positive ≤ 12,5% (tối đa ≤ 1/8 mẫu báo nhầm, mục tiêu thiết kế 0/8)`**.

---

### 3.5. Giải quyết `ĐN-5` — Thời điểm và Cơ chế Hậu kiểm Lớp 2 Tách biệt Theo Từng Luồng Runtime
- **Phân tích của Vai 2 & Vai 3**:
  - Cả 3 luồng chính của app đều dùng SSE (`text/event-stream`), nhưng vòng đời hiển thị và lưu trữ ở phía Client khác hẳn nhau:
    - Ở `DetailedDossierModal.tsx`, văn bản stream xong sẽ được chạy qua `sanitizeDossierChapterText` (`src/lib/dossier-chat-ui.ts:170–197`) rồi mới lưu bền vững vào `IndexedDB` + `inMemoryDossierMirror` + `sessionStorage`.
    - Ở `InsightPanel.tsx` / `TimeNav.tsx` (`/api/interpret-period`), server hiện đã có sẵn bước hậu kiểm cuối luồng `verifyAndEnsureCompletePeriodSiHua` tại `server.ts:705–730` để nối khối `> 📌 **[Tổng Hợp Đầy Đủ Tứ Hóa Kỳ Hạn Theo Lá Số]**` ngay trước `data: [DONE]`.
    - Ở `ContextualChatDrawer.tsx` (`/api/interpret-chat`), người dùng đọc từng chữ ngay khi đang stream và bong bóng chat giữ nguyên chuỗi `accumulatedText` đó.
- **Kết luận đồng thuận của Panel cho `ĐN-5`**:
  Chốt **3 cơ chế hậu kiểm vừa khít với từng luồng, không giữ buffer gây trễ TTFB**:

| Luồng thực thi | Cơ chế trong lúc đang Stream SSE | Cơ chế ngay khi kết thúc Stream (`before [DONE]`) & Khi lưu trữ |
|---|---|---|
| **1. Luồng Hồ Sơ 8 Chương** (`/api/interpret-dossier-section` + `DetailedDossierModal.tsx`) | Stream trực tiếp từng chunk qua `sanitizeLayer3AOnly(text)` (`server.ts:808–811`) để giữ TTFB $< 3\text{–}5\text{s}$. | **Tại Server (`server.ts` ngay sau `executeStream` dòng `821`)**: Chạy `verifyAcademicCitationsAndClaims(accumulatedText, allowedEntries)`.<br>• Tự động nối khối **`> 📚 [Tư Liệu Học Thuật Tham Chiếu Trong Chương]`** (liệt kê tên bài giảng, tiêu đề mục, `bvid`, `t_hms` của các mã thẻ hợp lệ đã được AI trích dẫn trong chương).<br>• Nếu phát hiện vi phạm `V1/V2/V3`, gửi kèm sự kiện SSE `{ citationAudit: { scrubbedInvalidIds, hasUncitedClaims } }` và nối dòng lưu ý kiểm chứng nguồn.<br>• **Trước khi lưu xuống SSOT `IndexedDB`**: Hàm `sanitizeDossierChapterText` gỡ sạch mọi thẻ `[Nguồn: ID_SAI]` (nếu có) để bản lưu và bản xuất `.html`/`.md` sạch 100%. |
| **2. Luồng Vận Hạn Đại Hạn / Lưu Niên** (`/api/interpret-period` — gồm cả Chương 5 `year_2026` & Chương 6 `year_2027`) | Stream trực tiếp từng chunk qua `sanitizeLayer3AOnly(text)` (`server.ts:686–693`). | **Tại Server (`server.ts:705–734`)**: Ngay sau khối `verifyAndEnsureCompletePeriodSiHua`, chạy tiếp `verifyAcademicCitationsAndClaims(accumulatedText, allowedEntries)` và stream khối `> 📚 **[Tư Liệu Học Thuật Tham Chiếu]**` (kèm dòng lưu ý kiểm chứng nếu có `V2/V3`) dưới dạng addendum chunk cuối cùng trước `data: [DONE]`. |
| **3. Luồng Hỏi Đáp Ngữ Cảnh** (`/api/interpret-chat` + `ContextualChatDrawer.tsx`) | Stream trực tiếp từng chunk qua `sanitizeLayer3AOnly(text)` (`server.ts:905–908`). **Không sửa ngược các chữ đã hiện trên màn hình.** | **Tại Server (`server.ts:918`)**: Khi stream vừa kết thúc, chạy `verifyAcademicCitationsAndClaims(accumulatedText, allowedEntries)`.<br>• Nếu các thẻ `[Nguồn: ...]` đều hợp lệ và không có `V2/V3`: stream nối thêm 1 dòng chân trang ngắn gọn giải nghĩa mã thẻ đã trích dẫn (VD: `\n\n---\n*📚 Nguồn đối chiếu: [NH-STAR-012] Thiên Kỷ Bài 04 (18:20) — Cự Môn Hóa Kỵ.*`).<br>• Nếu phát hiện thẻ bịa `V1` hoặc viện dẫn không thẻ `V2/V3`: stream nối thêm dòng đính chính minh bạch ở cuối bong bóng chat (`\n\n> *⚠️ Lưu ý kiểm chứng: Nhận định trên được tổng hợp từ cấu trúc tinh đẩu của lá số; kho trích đoạn nạp cho lượt hỏi này không chứa nguyên văn khẩu quyết cho chi tiết không gắn mã nguồn hợp lệ.*`). |

---

### 3.6. Giải quyết `ĐN-6` — Xử lý An toàn Vi phạm `V1/V2/V3` (Loại bỏ cơ chế viết lại câu bằng Regex)
- **Phân tích của Vai 3 & Vai 1**:
  - Trong V1 (`QĐ-N4` Phương án A), kế hoạch đề xuất dùng regex để tự động thay cụm *"Theo Nghê Hải Hạ, ..."* bằng *"Xét theo cấu trúc tinh đẩu trên lá số, ..."*.
  - Tuy nhiên trong tiếng Việt, AI có thể viết hàng chục biến thể ngữ pháp như: *"Điểm này từng được Nghê Hải Hạ nhấn mạnh khi giảng về cung Tài Bạch rằng..."*, *"Trong Cốt Tủy Phú, cổ nhân đã chỉ rõ..."*, *"Đúng như khẩu quyết Thiên Kỷ đã nêu..."*. Mọi nỗ lực dùng regex thay thế một vế trong câu tiếng Việt tự nhiên đều sẽ sinh ra các câu què cụt, sai ngữ pháp nghiêm trọng.
- **Kết luận đồng thuận của Panel cho `ĐN-6`**:
  1. **Cấm tuyệt đối việc dùng regex sửa/thay chữ bên trong câu văn tiếng Việt của AI.**
  2. **Quy tắc xử lý hậu kiểm an toàn 2 bậc (`Safe Scrub & Transparent Addendum`)**:
     - **Bậc 1 — Gỡ thẻ mã nguồn không hợp lệ (`Safe Tag Scrubbing` cho `V1` & `V3`)**: Thẻ `[Nguồn: <ID>]` là một token kỹ thuật nằm tách biệt trong dấu ngoặc vuông `[...]`. Nếu `<ID>` không nằm trong `allowedEntryIds` (`V1` — thẻ bịa) hoặc câu chứa thẻ đó có `0` thực thể giao với mục nguồn `<ID>` (`V3` — gắn nhầm thẻ của sao khác), bộ lọc Lớp 3B xóa sạch cụm `[Nguồn: <ID>]` (kèm khoảng trắng thừa ngay trước nó) khỏi văn bản trước khi lưu SSOT. Việc xóa `[Nguồn: ID]` hoàn toàn không ảnh hưởng tới cấu trúc ngữ pháp của câu văn.
     - **Bậc 2 — Đính kèm Hộp Lưu Ý Kiểm Chứng Nguồn ở cuối bài (`Transparent Verification Note` cho `V2` & `V3`)**: Khi phát hiện câu viện dẫn tác giả/cổ thư mà thiếu thẻ hợp lệ (`V2`) hoặc vừa bị gỡ thẻ lệch thực thể (`V3`), giữ nguyên câu văn nhưng tự động nối hộp thông báo minh bạch ở cuối chương/bài:
       ```markdown
       > ⚠️ **[Ghi Chú Kiểm Chứng Nguồn Học Thuật]**: Trong bài có một số nhận định mở rộng chưa gắn mã thẻ đối chiếu trực tiếp từ kho trích đoạn của lượt sinh này. Người đọc lưu ý: chỉ những luận điểm có gắn thẻ `[Nguồn: ...]` thuộc mục *Tư liệu học thuật tham chiếu* bên trên mới được truy vết nguyên văn từ bài giảng Thiên Kỷ / cổ thư đã nạp; các phần còn lại là phân tích suy diễn theo cấu trúc tinh đẩu trên lá số.
       ```

---

### 3.7. Giải quyết `ĐN-7` — Kiểm toán Số học Toàn Kế hoạch theo Số đo Thật ở `[B]`
Panel đã đối chiếu và tính toán lại toàn bộ bảng số học từ dữ liệu đo thật trên repo gốc:

#### A. Bảng số đo thật của Kho Nguồn (`/knowledge-source/`)
1. **Thư mục bài giảng `tianji-ziwei/`**:
   - Số lượng file thật: **`16` file `.md`** *(không phải 17 file)*.
   - Tổng dung lượng: **`685.749` byte** (~670 KB).
   - Tổng số ký tự (bao gồm tiêu đề Markdown, mốc thời gian, mã `bvid`, dấu câu): **`342.785` ký tự**.
   - Tổng số ký tự chữ Hán thực tế (`/\p{Script=Han}/gu`): **`150.726` ký tự Hán**.
2. **Tệp trích dẫn cấu trúc `entries.jsonl`**:
   - Tổng số dòng: **`1.848` dòng JSON hợp lệ** (~724 KB).
   - Danh sách 9 trường thật của mỗi bản ghi JSON: `book`, `h2`, `h3`, `quote`, `section`, `t_hms`, `note`, `bvid`, `part`.
   - Thống kê độ dài trường `quote`: tổng cộng **`134.435` ký tự**, trung vị **`61` ký tự**, trung bình **`~72,7` (`~73`) ký tự**, dài nhất **`353` ký tự**.
   - Thống kê đơn vị phân cấp ngữ nghĩa trên toàn bộ `1.848` dòng:
     - Tổng số cặp `(book, h2)`: **`68` chủ đề lớn**.
     - Tổng số nhóm `(book, h2, h3)` toàn kho: **`208` nhóm**.
     - Phân bổ **Tầng 1 (`1.045` dòng quote $\rightarrow$ `138` nhóm `(book, h2, h3)`)**:
       - `01-stars`: `378` dòng quote $\rightarrow$ **`83` nhóm `(book, h2, h3)`**
       - `02-palaces`: `366` dòng quote $\rightarrow$ **`16` nhóm `(book, h2, h3)`** *(khi áp dụng quy tắc tách tiểu mục `(Cung × Cụm Sao)` của `NK-11` sẽ tạo ra khoảng **`52` đơn vị mục truy hồi**)*
       - `03-patterns`: `127` dòng quote $\rightarrow$ **`20` nhóm `(book, h2, h3)`**
       - `04-sihua`: `174` dòng quote $\rightarrow$ **`19` nhóm `(book, h2, h3)`**
     - Phân bổ **Tầng 2 & Tầng 3 (`803` dòng quote còn lại $\rightarrow$ `70` nhóm `(book, h2, h3)`)**:
       - `05-illness` (`80` dòng quote), `07-methodology` (`673` dòng quote), `08-yili` (`7` dòng quote), `10-divination` (`24` dòng quote), `11-fengshui` (`19` dòng quote).
3. **Các thư mục phụ trợ**:
   - `lib/classics/data/` (~40 KB: *Cốt Tủy Phú*, *Thái Vi Phú*, *Toàn Tập*, *Toàn Thư*).
   - `lib/nihai/` (~112 KB) và `research/nishi-video-reading/` (~1,6 MB).

#### B. Bảng tính lại Số lượng Mục Tri thức, Số Request Chưng cất & Dung lượng `.kb.json` theo Từng Đợt

| Đợt triển khai | Thành phần dữ liệu đưa vào chưng cất | Số dòng `quote` gốc được gộp | Số mục `DistilledKnowledgeEntry` đầu ra | Số Request API Chưng cất (Gom lô 3 mục/req trên `gemini-2.5-pro` / `3.8-flash`) | Dung lượng file `.kb.json` ước tính |
|---|---|:---:|:---:|:---:|:---:|
| **Đợt 1A (Pilot)** | • `01-stars` (`83` nhóm `h3`)<br>• `04-sihua` (`19` nhóm `h3`)<br>• Cổ thư `classics` gắn với Chính Tinh & Tứ Hóa (*Cốt Tủy Phú*, *Thái Vi Phú* — `~60` mục) | `552` dòng `entries.jsonl` + `~60` câu phú | **`~162` mục** (`102` mục nhóm Thiên Kỷ + `~60` mục Cổ phú) | **~55 – 65 requests** | **~240 – 300 KB** |
| **Đợt 1B (Hoàn tất Tầng 1)** | • `02-palaces` (`16` nhóm `h3` tách thành `~52` tiểu mục `Cung × Sao`)<br>• `03-patterns` (`20` nhóm `h3`)<br>• Chuyên đề bổ sung từ `16` bài giảng `tianji-ziwei/*.md` & `lib/nihai/` chưa có trong `entries.jsonl` (`~45` mục) | `493` dòng `entries.jsonl` + `16` file bài giảng | **`+117` mục** *(Nâng tổng kho Tầng 1 lên **`~279` mục**)* | **~40 – 50 requests** | **+200 KB** *(Tổng Tầng 1: **~450 – 500 KB**)* |
| **Đợt 2 (Mở rộng Tầng 2)** | • `05-illness` (`80` dòng quote $\rightarrow$ `~18` nhóm `h3`)<br>• `07-methodology` chọn lọc phần Tử Vi (`~250` dòng quote $\rightarrow$ `~35` nhóm `h3`)<br>• Ca mệnh thực chiến từ `nishi-video-reading` (`~35` mục) | `~330` dòng `entries.jsonl` + ca mệnh chọn lọc | **`+88` mục** *(Nâng tổng kho toàn dự án lên **`~367` mục tinh hoa**)* | **~30 – 40 requests** | **+160 KB** *(Tổng toàn kho: **~620 – 660 KB**)* |

> **Nhận xét đột phá từ Kiểm toán Số học**: Nhờ gộp theo đơn vị ngữ nghĩa `(book, h2, h3)` (`ĐN-1`), toàn bộ `1.045` trích dẫn Tầng 1 + Cổ thư + 16 bài giảng kết tinh lại thành **`~279` mục tri thức hoàn chỉnh, sâu sắc, không trùng lặp** với tổng dung lượng chỉ **`~450–500 KB`** (nhẹ hơn 3 lần so với ước tính V1), và tổng số request để chưng cất cả Đợt 1A lẫn Đợt 1B cộng lại chỉ khoảng **`~100` request API**!

---

### 3.8. Giải quyết `ĐN-8` — Truy hồi cho Luồng Chat & Định nghĩa Chính xác `starAbsentInQueriedPalace`
- **Thảo luận của Vai 1 & Vai 2**:
  - Trong Tử Vi Đẩu Số, khi người dùng đang xem cung `Quan Lộc` và hỏi *"Sao Thái Dương ảnh hưởng thế nào đến công việc của tôi?"*, nếu `Thái Dương` không tọa thủ ở `Quan Lộc` nhưng lại tọa thủ ở `Mệnh Cung` hoặc `Tài Bạch` (tam hợp chiếu về `Quan Lộc`) hoặc ở `Phu Thê` (xung chiếu về `Quan Lộc`), hoặc `Quan Lộc` là cung Vô chính diệu mượn `Thái Dương` từ đối cung, thì `Thái Dương` **CÓ tác động trực tiếp** lên cung `Quan Lộc`! Nếu chỉ kiểm tra `palace.stars` (tọa thủ bản cung) mà kết luận `starAbsentInQueriedPalace = true` thì sẽ sai học thuật Tử Vi.
- **Kết luận đồng thuận của Panel cho `ĐN-8`**:
  1. **Định nghĩa toán học của `starAbsentInQueriedPalace` (Xét đủ Tam Phương Tứ Chính & Sao Mượn)**:
     - Với một cung đang xét $P$ tại địa chi $b \in \{0..11\}$, tập sao liên hệ hợp lệ của cung $P$ là hợp của 4 nguồn:
       $$\text{EffectiveStars}(P) = \text{Stars}(b) \cup \text{BorrowedStars}(b) \cup \text{Stars}((b+4)\bmod 12) \cup \text{Stars}((b+8)\bmod 12) \cup \text{Stars}((b+6)\bmod 12)$$
     - Khi câu hỏi người dùng nêu đích danh một sao $S$ gắn với một cung cụ thể $P$:
       - Nếu $S \in \text{Stars}(b)$: Trạng thái = `'present_in_palace'` (Tọa thủ trực tiếp).
       - Nếu $S \notin \text{Stars}(b)$ nhưng $S \in \text{EffectiveStars}(P)$: Trạng thái = `'present_in_sanfang_or_borrowed'` (Hội chiếu từ Tam Phương / Xung chiếu từ Đối cung / Mượn sao Vô chính diệu) $\rightarrow$ **Vẫn cho phép truy hồi tri thức** và ghi chú rõ vị trí hội chiếu cho AI.
       - Chỉ khi $S \notin \text{EffectiveStars}(P)$: mới bật cờ `starAbsentInQueriedPalace = true` để kích hoạt quy tắc từ chối suy diễn (`server.ts:425`).
  2. **Phạm vi truy hồi Chat ở Đợt Pilot (Best-Effort + Lớp 3 Trung thực)**:
     - Bước 1: Quét câu hỏi lấy các thực thể Tử Vi tường minh khớp từ điển `vi-i18n.ts` (Tên sao, Tên cung, Tên cách cục, Tứ Hóa).
     - Bước 2: Nếu người dùng hỏi bằng ngôn ngữ đời thường không nêu tên cung, đối chiếu qua bảng `CHAT_TOPIC_TO_PALACE_KEYWORDS` (~40 từ khóa phổ biến chia cho 12 cung).
     - Bước 3 (Fallback an toàn): Nếu câu hỏi hoàn toàn không khớp từ khóa nào trong Bước 1 và Bước 2, bộ truy hồi tự động lấy ngữ cảnh từ **`sectionTitle` đang mở** (hoặc `Mệnh Cung` + `Đại Hạn hiện tại` nếu ở chế độ `natal` chung) và gắn chỉ thị Lớp 3 để AI chỉ trả lời trong phạm vi dữ kiện lá số đang hiển thị.

---

### 3.9. Giải quyết `ĐN-9` — Phạm vi Tích hợp ở Đợt Pilot 1A
- **Kết luận đồng thuận của Panel cho `ĐN-9`**:
  - **Đợt Pilot 1A (`1.4.0-rc.1`)**: Chỉ tích hợp Nền tri thức AI vào **3 luồng cốt lõi**:
    1. `/api/interpret-dossier-section` (`buildStrictDossierSectionPrompt` tại `server.ts:346`)
    2. `/api/interpret-period` (`buildStrictPeriodAiPrompt` tại `server.ts:158`)
    3. `/api/interpret-chat` (`buildStrictExplanationChatPrompt` tại `server.ts:402`)
  - **Hoãn sang Đợt 1B (`1.4.0-rc.2`)**: Hai luồng `/api/interpret` (`server.ts:953`) và `/api/heming` (`server.ts:1066` — Hợp Bàn, vốn cần quyển `02-palaces` cung Phu Thê và `03-patterns` được chưng cất ở Đợt 1B).

---

### 3.10. Giải quyết `ĐN-10` — Thiết kế Mã thẻ `citationId` theo Nhóm & Quy trình Vận hành Cổng NotebookLM
- **Kết luận đồng thuận của Panel cho `ĐN-10`**:
  1. **Quy chuẩn mã thẻ `citationId` cấp nhóm (`Group-Level Semantic Citation ID`)**:
     - Ngắn gọn, tất định, nhìn vào biết ngay nguồn và quyển:
       - `NH-STAR-001` .. `NH-STAR-083`: 83 nhóm `(book, h2, h3)` của quyển `01-stars`.
       - `NH-SIHUA-001` .. `NH-SIHUA-019`: 19 nhóm `(book, h2, h3)` của quyển `04-sihua`.
       - `NH-PAL-001` .. `NH-PAL-052`: ~52 mục/tiểu mục của quyển `02-palaces` (Đợt 1B).
       - `NH-PAT-001` .. `NH-PAT-020`: 20 nhóm `(book, h2, h3)` của quyển `03-patterns` (Đợt 1B).
       - `NH-LEC-001` .. `NH-LEC-045`: ~45 chuyên đề bổ sung từ 16 bài giảng `tianji-ziwei/` (Đợt 1B).
       - `CL-CTP-001`.. (*Cốt Tủy Phú*), `CL-TVP-001`.. (*Thái Vi Phú*), `CL-TT-001`.. (*Toàn Thư*).
  2. **Quy trình vận hành thực tế của Cổng Kiểm định NotebookLM**:
     - **Bước 1 (Tự động sinh phiếu kiểm định)**: Chạy lệnh `npm run kb:export-audit-sheet` (`scripts/kb-export-audit-sheet.ts`). Script chọn ngẫu nhiên có phân tầng (theo seed cố định) **`25` mục trong tổng số `~162` mục của Đợt Pilot 1A** ($\approx 15,4\%$, bao gồm `10` mục `01-stars`, `10` mục `04-sihua` và `5` mục `classics`), xuất ra file `docs/kb-pilot-audit-sheet.md`.
     - **Bước 2 (Đối chiếu ngoại tuyến — Do Chủ dự án hoặc Kỹ sư kiểm định thực hiện)**:
       - Với mỗi mục trong `25` mục trên phiếu, phiếu in sẵn: (a) `citationId`, `bvid`, `t_hms`, `h2 / h3`; (b) toàn bộ các câu `quote` chữ Hán gốc (`hanziAnchor`); (c) bản chưng cất tiếng Việt (`summaryVi`, `conditionsVi`); và (d) câu prompt gợi ý để dán vào NotebookLM (nơi Chủ dự án đã nạp 16 file bài giảng gốc) nhằm kiểm tra chéo.
     - **Bước 3 (Đơn vị đo & Tiêu chí ký cổng)**:
       - Đơn vị chấm là **từng mục `DistilledKnowledgeEntry` trong 25 mục mẫu** (chấm ĐẠT nếu: không sai lệch ý nghĩa học thuật của Nghê Sư, không đảo ngược cát/hung, không gán nhầm điều kiện tam phương/tứ hóa, thuật ngữ chuẩn 100%).
       - **Ngưỡng qua cổng**: Đạt tối thiểu **`24/25` mục (`96%`) ngay ở lần chấm đầu** và **`0` lỗi nghiêm trọng (0 lỗi đảo ngược cát/hung)**; bất kỳ mục nào chưa đạt (nếu có) phải được sửa ngay trong file `.kb.json` để đạt `25/25 (100%)` trên tập mẫu trước khi Chủ dự án ký xác nhận qua cổng Pilot.

---

## 4. Kết Luận & Khuyến Nghị Cuối Cùng Của Panel Cho Danh Sách Quyết Định (`QĐ-N1` .. `QĐ-N8`)

Sau khi tích hợp toàn bộ kết luận từ `ĐN-1..ĐN-10`, Tổ Chuyên Gia thống nhất cập nhật bảng quyết định trình Chủ dự án phê duyệt (bổ sung **`QĐ-N8`** riêng cho Đơn vị Chưng cất & Văn bản nguồn theo `ĐN-1` + `ĐN-2`):

| Mã QĐ | Nội dung quyết định | Khuyến nghị đồng thuận của Panel (5/5 vai) |
|---|---|---|
| **`QĐ-N1`** | Phương thức nạp kho nguồn vào `/knowledge-source/` & Cổng kiểm tra toàn vẹn `kb:verify-source` | **Chọn Phương án B đã hiệu chỉnh số đo thật**: Nạp đủ `entries.jsonl` (`1.848` dòng, `134.435` ký tự `quote`, `208` nhóm `h3`), `tianji-ziwei/` (`16` file `.md`, `342.785` ký tự, `150.726` ký tự Hán, `~685.749` byte) và `classics/` (~40 KB) ngay từ đầu Đợt 1A để phục vụ cơ chế kéo ngữ cảnh bài giảng theo `(bvid, t_hms)` của `ĐN-2`. |
| **`QĐ-N2`** | Đơn vị chưng cất & Nguồn văn bản đầu vào (`ĐN-1`, `ĐN-2`, `NK-11`) | **Chọn Phương án A (Gộp theo nhóm `(book, h2, h3)` + Kéo ngữ cảnh bài giảng `(bvid, t_hms)` + Chia tiểu mục có điều kiện cho `02-palaces`)**: Gộp các `quote` cùng `(book, h2, h3)` theo thứ tự `part/t_hms` thành 1 mục hoàn chỉnh (`Tầng 1 = 138 nhóm gốc / ~174 mục sau tách tiểu mục 02-palaces`), dùng đoạn bài giảng khớp `(bvid, t_hms)` làm ngữ cảnh bổ trợ khi chưng cất nhưng giữ `hanziAnchor` neo cứng vào mảng `quote` gốc. |
| **`QĐ-N3`** | Môi trường, API Key & Model chạy pipeline chưng cất (`ĐN-3`) | **Chọn Phương án C nâng cấp (Offline Local Build-and-Commit bằng Model mạnh)**: Script `scripts/kb-distill.ts` nằm trong repo nhưng chạy ngoại tuyến trên máy cá nhân bằng API key riêng với model **`gemini-2.5-pro`** (hoặc **`gemini-3.8-flash`**), chỉ commit các file `.kb.json` hoàn chỉnh vào dự án (0 tốn quota Kho Khóa Runtime của app, bền vững 100% trong git/workspace). |
| **`QĐ-N4`** | Hiển thị thẻ nguồn `[Nguồn: ...]` cho người dùng cuối (`ĐN-10`) | **Chọn Phương án A**: Giữ mã thẻ cấp nhóm ngắn gọn trong thân bài (`[Nguồn: NH-STAR-012]`, `[Nguồn: CL-CTP-008]`) và tự động nối khối **`> 📚 [Tư Liệu Học Thuật Tham Chiếu]`** (in rõ tên bài giảng, tiêu đề mục, `bvid`, `t_hms`) ở cuối chương/bài. |
| **`QĐ-N5`** | Cơ chế hậu kiểm chống bịa Lớp 2, thời điểm chạy theo luồng & xử lý vi phạm (`ĐN-4`, `ĐN-5`, `ĐN-6`) | **Chọn Phương án A an toàn (Đã bỏ cơ chế viết lại câu bằng regex)**:<br>• Cửa sổ kiểm tra `V2/V3` tính theo **Khối Đoạn văn / Bullet Markdown**.<br>• Khi vi phạm: **Xóa thẻ mã nguồn sai (`V1/V3`)**, tuyệt đối **không dùng regex sửa chữ trong câu văn**, và tự động nối **Hộp Lưu Ý Kiểm Chứng Nguồn** ở cuối chương Hồ Sơ / Vận hạn / cuối bong bóng Chat.<br>• Cổng `K3` (`24` mẫu chuẩn): `V1` đạt `100% Recall / 0% FP`; `V2 & V3` đạt `Recall ≥ 87,5%` và `FP ≤ 12,5%` (`0` báo nhầm trên câu dữ kiện lá số). |
| **`QĐ-N6`** | Ngân sách ký tự tri thức nạp kèm & Xử lý truy hồi Chat (`ĐN-8`) | **Chọn Phương án A**: Giữ trần ngân sách gọn (`1.500 – 3.200` ký tự/lượt gọi theo từng luồng); truy hồi Chat ở Đợt Pilot hoạt động theo cơ chế **Best-Effort + Lớp 3 Trung thực**, và cờ `starAbsentInQueriedPalace` xét đầy đủ cả **Bản cung + Sao mượn + Tam Phương Tứ Chính (`+4, +8, +6`)**. |
| **`QĐ-N7`** | Phân tầng phạm vi tư liệu ngoài lá số & Ghi công giấy phép (`NK-12`) | **Chọn Phương án A**: Loại bỏ hoàn toàn Tầng 3 (`08-yili`, `10-divination`, `11-fengshui` và phần phong thủy/y lý rời) khỏi runtime; gắn nhãn `sourceLicense` rõ ràng cho từng mục (`CC-BY-NC-SA-4.0` cho Thiên Kỷ, phân biệt với văn bản gốc `Public Domain` của cổ thư). |
| **`QĐ-N8`** | Phạm vi Đợt Thí điểm (Pilot 1A), Hoãn 2 route phụ & Đánh số phiên bản (`ĐN-7`, `ĐN-9`, `ĐN-10`) | **Chọn Phương án A**:<br>• **Đợt Pilot 1A (`1.4.0-rc.1`)**: Chưng cất `83` nhóm `01-stars` + `19` nhóm `04-sihua` + `~60` mục cổ phú `classics` = **`~162` mục** (~55–65 requests); chỉ tích hợp vào **3 luồng chính** (`/api/interpret-dossier-section`, `/api/interpret-period`, `/api/interpret-chat`); qua cổng QA `25` mục mẫu ($\ge 24/25$ đạt, 0 lỗi ngược cát/hung).<br>• **Đợt 1B (`1.4.0-rc.2`)**: Bổ sung `02-palaces` (`~52` tiểu mục), `03-patterns` (`20` nhóm), chuyên đề 16 bài giảng (`~45` mục) $\rightarrow$ tổng Tầng 1 **`~279` mục**, đồng thời tích hợp nốt `/api/interpret` và `/api/heming`.<br>• **Đợt 2 (`1.5.0-rc.1`)**: Bổ sung `05-illness`, `07-methodology` chọn lọc & ca mệnh thực chiến (`+88` mục $\rightarrow$ tổng **`~367` mục**). |
