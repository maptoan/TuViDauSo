> ⚠️ **[TÀI LIỆU LỊCH SỬ ĐÃ LƯU TRỮ — KHÔNG DÙNG LÀM CĂN CỨ CODE HIỆN HÀNH]**
> - **Trạng thái**: Đã hoàn thành vai trò lịch sử / Đã bị thay thế bởi tài liệu sống **[`docs/decisions-registry.md`](../decisions-registry.md) & [`docs/features-dossier-and-chat.md`](../features-dossier-and-chat.md)** từ ngày `17/11/2026`.
> - **Cảnh báo cho Kỹ sư & AI Agent**: Các trích dẫn số dòng, tên biến, hằng số (như ngân sách 25s, nhịp nghỉ 2200ms, số lượng key 3/23) trong file này phản ánh thời điểm trước khi hợp nhất và **không còn khớp với mã nguồn hiện hành**. Tuyệt đối đọc tài liệu sống tại thư mục `docs/` gốc và đối chiếu code thật trước khi chẩn đoán hoặc sửa code!

---
# Biên Bản Họp Tổ Chuyên Gia Phản Biện & Chi Tiết Hóa Kế Hoạch 3 Tính Năng Mới (v1 → v2)

- **Ngày họp**: `2026-11-17`
- **Tài liệu đầu vào được rà soát**: `docs/feature-plan-3-tinh-nang.md` (Bản kế hoạch v1, lập ngày `2026-11-16`)
- **Tài liệu đầu ra**: `docs/feature-plan-3-tinh-nang-v2.md` (Bản kế hoạch chi tiết hóa v2, lập ngày `2026-11-17`, giữ nguyên không ghi đè bản v1)
- **Tài liệu kỹ thuật đối chiếu**:
  - `docs/key-pool-design-plan.md` (Bản kế hoạch Kho Khóa v2.0, chứa các quyết định nền tảng `QĐ-1` → `QĐ-6`)
  - `docs/stream-interruption-diagnosis.md` (Báo cáo chẩn đoán lỗi ngắt luồng `503 UNAVAILABLE` và Mục 6 `AbortError code=20`)
  - Mã nguồn thực tế: `src/lib/ziwei/constants.ts`, `src/lib/ziwei/vi-i18n.ts`, `src/lib/ziwei/yunxian-context.ts`, `src/lib/ziwei/sihua.ts`, `server.ts`, `server/key-pool/allocator.ts`, `server/key-pool/executor.ts`, `server/key-pool/index.ts`, `src/components/KeyPoolModal.tsx`, `src/components/InsightPanel.tsx`, `src/components/HemingView.tsx`
- **Hình thức họp Panel**: **Mô phỏng đa vai độc lập theo 2 vòng (Role-Based Multi-Expert Panel Simulation)** ngay trong phiên làm việc của Gemini 4 Argon. Do môi trường thực thi AI Studio vận hành trên một phiên tác nhân đơn lẻ, tổ chuyên gia được phân tách tường minh thành **1 Điều phối viên + 4 Chuyên gia độc lập**, ghi rõ ý kiến riêng của từng vai ở Vòng 1, tranh biện chéo ở Vòng 2 và phán quyết tổng hợp của Điều phối viên.
- **Giới hạn thực thi**: Chỉ thảo luận, phản biện và cập nhật tài liệu thiết kế — **tuyệt đối không viết hay sửa bất kỳ dòng code triển khai nào**.

---

## 1. Thành Phần Tổ Chuyên Gia (Panel Roster)

1. **Điều phối viên (Moderator — Principal Systems Architect)**: Chủ trì 2 vòng họp, kiểm tra chéo với mã nguồn thực tế và 8 điểm phản biện đầu vào của người dùng, phân xử các xung đột giữa độ sâu nội dung Tử Vi, an toàn hạn mức Free Tier (3 key khỏe / 20 key đang nguội) và trải nghiệm người dùng để chốt Bản kế hoạch v2.
2. **Chuyên gia 1 (CG1 — Kiến trúc sư Hệ thống)**: Phụ trách kiến trúc tổng thể, cấu trúc chia chương của Bản Luận Giải Chi Tiết (Tính năng 2), tính nhất quán dữ kiện xác định (`SI_HUA_TABLE`, `yunxian-context`, `dossier-context`), chiến lược cache liên thông giữa `InsightPanel` và Hồ sơ Xuất bản, và nguồn gốc prompt của Chương 1.
3. **Chuyên gia 2 (CG2 — Kỹ sư Backend & Kho Key)**: Phụ trách thiết kế endpoint mới, cơ chế thăm dò hàng loạt (`Batch Cooldown Probe` — Tính năng 1), kỷ luật "Nhảy cóc cùng Project" (`Same-Project Short-Circuit`), bảo vệ quyền ghi (`requireKeyPoolWriteAccess`) đối với cờ `batchProbe`/`bypassDebounce`, và tương tác với `allocator.ts` / `executor.ts`.
4. **Chuyên gia 3 (CG3 — Chuyên gia UX & Tương tác Người dùng)**: Phụ trách giao diện `KeyPoolModal`, `DetailedDossierModal`, `ContextualChatDrawer`, hiển thị cảnh báo đặt lại thời gian nguội 6h khi probe thất bại, thanh tiến trình thực tế, hủy giữa chừng, xuất bản dở dang và lưu trữ hội thoại.
5. **Chuyên gia 4 (CG4 — Người phản biện Rủi ro, Quota & Chống bịa)**: Phụ trách kiểm toán ước tính thời gian theo số đo chạy thật ngày `16–17/11`, rủi ro `503 UNAVAILABLE` và `AbortError (code=20)` khi chạy 8 chương liên tiếp, định mức số từ tối thiểu trên mỗi cung, trường dữ kiện tối thiểu cho ma trận 5/10 năm, và giới hạn mềm chống đốt quota cho khung Chat.

---

## 2. Thống Kê Tổng Quan Các Vấn Đề Phát Hiện & Bảng Đối Chiếu 8 Điểm Bắt Buộc

### 2.1. Tổng hợp số lượng vấn đề theo mức độ nghiêm trọng
Qua Vòng 1 (kết hợp 8 điểm phản biện của người dùng và 6 vấn đề mới do các chuyên gia phát hiện thêm khi đọc sâu mã nguồn & kế hoạch v1), Panel ghi nhận tổng cộng **14 vấn đề**:

| Mức độ nghiêm trọng | Số lượng | Mã định danh vấn đề |
| :--- | :---: | :--- |
| **Nghiêm trọng (Critical)** | **2** | `P1-01` *(Điểm #1 của người dùng — Đính chính nền tảng `SI_HUA_TABLE`)*, `P4-01` *(Điểm #3 của người dùng — Ước tính thời gian phi thực tế & thiếu rủi ro `AbortError code=20`)* |
| **Cao (High)** | **5** | `P4-02` *(Điểm #4 — Mâu thuẫn độ sâu 4 cung/chương)*, `P1-02` *(Điểm #5 — Ma trận 5/10 năm thiếu trường bắt buộc)*, `P2-01` *(Điểm #6 — Kỷ luật nhảy cóc Project & hệ quả reset 6h)*, `P4-03` *(Điểm #7 — Thiếu giới hạn mềm chống đốt quota cho Chat)*, `P1-03` *(Điểm #8 — Lệch chuẩn prompt/cache ở Chương 1)* |
| **Trung bình (Medium)** | **5** | `P1-04` *(Điểm #2 — Va chạm mã `QĐ-1..5` với kế hoạch Kho Khóa)*, `P2-02` *(Mới — Nguy cơ đụng độ tranh chấp 3 key khỏe nếu vừa chạy Batch Dossier vừa mở Chat hỏi AI cùng lúc)*, `P2-03` *(Mới — Rò rỉ kết nối hoặc tràn timeout khi 1 chương 4 cung dài 1.200–1.500 từ vượt ngưỡng `LEASE_MAX_TTL_MS` hoặc gặp 2 lần nối tiếp)*, `P3-01` *(Mới — Giới hạn dung lượng `sessionStorage` 5MB khi lưu đồng thời Hồ sơ 8 chương + 10 mạch Chat)*, `P4-04` *(Mới — Thiếu cơ chế phát hiện năm "Tiểu Hạn / Đồng Hạn" hoặc năm vượt ngoài khung 8 Đại Hạn trong ma trận 10 năm)* |
| **Thấp (Low)** | **2** | `P3-02` *(Mới — Trích dẫn đoạn văn bản `highlightedExcerpt` trên thiết bị di động khó thao tác bôi đen)*, `P3-03` *(Mới — Chế độ Sáng/Tối khi xuất file `.html` bản in độc lập cần khóa cứng bảng màu giấy sáng khi in)* |
| **Tổng cộng** | **14** | **14/14 vấn đề đã được thảo luận, phân xử và cập nhật đầy đủ vào Bản kế hoạch v2** |

---

### 2.2. Bảng xử lý 8 Điểm Phản Biện Bắt Buộc của Người Dùng

| Điểm phản biện của người dùng | Mã vấn đề trong Panel | Phán quyết của Panel | Tóm tắt lý do & Cách cập nhật vào `docs/feature-plan-3-tinh-nang-v2.md` |
| :--- | :---: | :---: | :--- |
| **Điểm 1: Đính chính nền tảng về `SI_HUA_TABLE` (`constants.ts:47-58`), sửa §1.3 và hạ mức rủi ro `R-1`** | `P1-01` *(Nghiêm trọng)* | **CHẤP NHẬN TOÀN BỘ (100%)** | Mã nguồn `src/lib/ziwei/constants.ts:47-58` quy định rõ `[化禄, 化权, 化科, 化忌]`, trong đó `SI_HUA_TABLE[6]` (Can Canh) = `['太阳', '武曲', '太阴', '天同']` (Lộc Thái Dương, Quyền Vũ Khúc, Khoa Thái Âm, Kỵ Thiên Đồng) và `SI_HUA_TABLE[8]` (Can Nhâm) = `['天梁', '紫微', '左辅', '武曲']` (Lộc Thiên Lương, Quyền Tử Vi, Khoa Tả Phù, Kỵ Vũ Khúc). Đây là bảng chuẩn phổ biến và nhất quán toàn hệ thống. Các nhãn trong bài Hợp Bàn trước đây thực chất **ĐÚNG theo engine**. Trong v2: (1) Sửa §1.3 ghi nhận rõ sự thật này; (2) Khẳng định **TUYỆT ĐỐI KHÔNG thay đổi `SI_HUA_TABLE` của engine**; (3) Hạ `R-1` từ **Cao** xuống **Thấp (Phòng ngừa trình bày)** — chỉ gắn nhãn tiền tố lớp Tứ Hóa (`Bản mệnh Can năm sinh`, `Đại hạn`, `Lưu niên`, `Tự hóa can cung`) trong các bảng dữ kiện mới để AI trình bày mạch lạc. |
| **Điểm 2: Đổi mã quyết định từ `QĐ-1→QĐ-5` sang `QĐ-F1→QĐ-F5` và rà soát mọi trích dẫn chéo** | `P1-04` *(Trung bình)* | **CHẤP NHẬN TOÀN BỘ (100%)** | Trong v1, `QĐ-1..5` của kế hoạch 3 tính năng bị trùng tên với `QĐ-1..6` của kế hoạch Kho Khóa (`docs/key-pool-design-plan.md`). Trong v2: giữ nguyên `QĐ-1..QĐ-6` khi dẫn chiếu tới quyết định Kho Khóa đã chốt, và đổi toàn bộ 5 quyết định của kế hoạch 3 tính năng mới thành **`QĐ-F1` → `QĐ-F5`** xuyên suốt mọi mục (§1, §2, §3, §6, §7). |
| **Điểm 3: Ước tính thời gian §3 quá lạc quan (`~7,5s`/chương); cần dải 3 kịch bản (Lạc quan / Thực tế / Xấu) + bổ sung rủi ro riêng `AbortError (code=20)`** | `P4-01` *(Nghiêm trọng)* | **CHẤP NHẬN TOÀN BỘ (100%)** | Số đo chạy thật ngày `16–17/11` (ghi tại `docs/stream-interruption-diagnosis.md`) cho thấy khi gặp `503 UNAVAILABLE` giữa luồng + tự động tiếp nối hoặc failover qua nhiều key, 1 bài kỳ hạn mất tới `~35–60 giây`, và có hiện tượng `AbortError (code=20)` chuỗi. Trong v2: (1) Thay ước tính đơn điểm bằng **Bảng 3 kịch bản (Lạc quan / Thực tế / Xấu)** cho cả Kịch bản Lạnh (8 chương) và Kịch bản Ấm (5–6 chương); (2) Tách **`R-3: Rủi ro đứt luồng do AbortError (code=20) & 503 UNAVAILABLE khi chạy 8 chương liên tiếp`** thành rủi ro mức **Cao** riêng biệt, giảm thiểu bằng lưu cache tức thì sau từng chương (`Incremental Chapter Commit`) + nút tiếp tục sinh phần còn thiếu. |
| **Điểm 4: Mâu thuẫn độ sâu (600–900 từ/chương cho 4 cung → chỉ 150–225 từ/cung); chốt sàn tối thiểu 250–350 từ/cung và cập nhật hệ quả thời gian** | `P4-02` *(Cao)* | **CHẤP NHẬN TOÀN BỘ (100%)** | `150–225 từ/cung` không đủ phân tích Chính tinh, Phụ/Sát tinh, Tam Phương Tứ Chính và lời khuyên cho mỗi cung. Trong v2: chốt cứng ngân sách từ tối thiểu **`250 – 350 từ / cung`** trong thiết kế prompt của Chương 2, 3, 4 $\Rightarrow$ mỗi chương nhóm 4 cung sẽ dài **`1.000 – 1.400 từ`** (`~1.800 – 2.500 output tokens`), đồng thời cập nhật lại thời gian stream mỗi chương nhóm cung trong §3 tăng lên tương ứng (`14–22s` ở kịch bản thuận lợi, `25–45s` khi có failover/nối tiếp). |
| **Điểm 5: Ma trận nhiều năm cho Chương 7/8 quá mỏng; chốt danh mục trường tối thiểu cho mỗi hàng năm + rào prompt cấm khẳng định ngoài trường đã cấp** | `P1-02` *(Cao)* | **CHẤP NHẬN TOÀN BỘ (100%)** | Trong v1 (§2.2.2), mô tả ma trận 10 năm của Chương 8 chỉ liệt kê Hóa Lộc & Hóa Kỵ, bỏ sót Hóa Quyền, Hóa Khoa và cung Đại Hạn chi phối. Trong v2: quy định **Danh mục 8 nhóm trường tối thiểu bắt buộc cho MỌI hàng năm** trong cả Chương 7 (5 năm) và Chương 8 (10 năm) (gồm: Năm Dương lịch & Can Chi, Tuổi âm lịch, Đại Hạn chi phối năm đó + quan hệ trùng/xung/tam hợp với Lưu Niên, Cung bản mệnh được Lưu Niên kích hoạt + Can Chi + Chính tinh/độ sáng/Tứ Hóa gốc, **đủ cả 4 sao Lưu Niên Tứ Hóa Lộc·Quyền·Khoa·Kỵ** kèm cung đóng & cung xung chiếu, và bộ Lưu Lộc Tồn · Lưu Thiên Mã · Lưu Kình Đà · Lưu Hồng Hỷ), đồng thời khóa prompt cấm AI suy diễn chi tiết từng năm ngoài 8 trường này. |
| **Điểm 6: Tính năng 1 — Kỷ luật nhảy cóc (a/b/c/d): chỉ nhảy cóc lỗi cấp Project, bỏ qua khi `detectedProjectNumber === null`, cảnh báo reset 6h khi probe thất bại, kiểm soát `batchProbe` qua `requireKeyPoolWriteAccess`** | `P2-01` *(Cao)* | **CHẤP NHẬN TOÀN BỘ (100%)** | Đưa đầy đủ 4 quy tắc kỷ luật `(a)`, `(b)`, `(c)`, `(d)` vào §2.1.2, §2.1.3 và §2.1.4 của v2: (a) Chỉ short-circuit với `QUOTA_PROJECT_ZERO`, `QUOTA_DAILY_EXHAUSTED`, `RATE_LIMIT_RPM`; cấm short-circuit với `NETWORK_OR_5XX` hay `MODEL_UNAVAILABLE`; (b) Key có `detectedProjectNumber === null` bắt buộc được gọi probe thật, không nhảy cóc; (c) Hiển thị hộp cảnh báo rõ trước khi bấm: *"Lưu ý: Khóa vẫn còn lỗi sau khi kiểm tra sẽ được tính lại thời gian nguội từ thời điểm hiện tại (ví dụ: lỗi Project Quota = 0 sẽ đặt lại chu kỳ nguội 6 giờ)"*; (d) Cờ `batchProbe` chỉ có hiệu lực bên trong route `POST /api/key-pool/:id/test` sau khi đã vượt qua `requireKeyPoolWriteAccess(req, res)`. |
| **Điểm 7: Tính năng 3 — Chống đốt quota cho Chat (giãn cách tối thiểu giữa 2 câu và/hoặc trần số câu mỗi phiên cho mỗi lá số)** | `P4-03` *(Cao)* | **CHẤP NHẬN TOÀN BỘ (100%)** | Để bảo vệ 3 key khỏe dùng chung cho toàn app, Panel thống nhất áp dụng **Cơ chế Giới hạn Mềm Kép (Dual Soft Quota Guard)** trong v2: (1) **Giãn cách tối thiểu `8 giây` (Cooldown 8s có đếm ngược trên nút Gửi)** giữa 2 câu hỏi liên tiếp trong khung Chat; (2) **Ngưỡng cảnh báo mềm ở câu thứ `10` và trần mềm `15 câu hỏi / phiên / lá số`** (khi chạm 15 câu, hiển thị thông báo nhắc tiết kiệm hạn mức Free Tier và yêu cầu người dùng bấm xác nhận `"Mở thêm 5 lượt hỏi"` nếu thực sự cần hỏi tiếp, đồng thời chặn gửi câu mới khi đang có một luồng luận giải kỳ hạn/hồ sơ khác đang chạy). |
| **Điểm 8: Chương 1 của hồ sơ xuất bản — làm rõ dùng prompt/dữ kiện nào và ghi nguồn gốc khi lấy từ cache** | `P1-03` *(Cao)* | **CHẤP NHẬN TOÀN BỘ (100%)** | Trong v1, việc lấy thẳng `cache['overall']` (vốn có thể là văn bản fallback tĩnh từ `generateLocalInterpretationVi` hoặc văn bản từ prompt mở `/api/interpret`) đưa vào Chương 1 của Hồ sơ sẽ làm hỏng chuẩn chống bịa đồng nhất của Hồ sơ. Trong v2: Chương 1 sử dụng **bảng dữ kiện xác định riêng `buildNatalOverviewFactSheetVi(chart)`** và chạy qua **`POST /api/interpret-dossier-section` (`sectionId: 'chapter_overview'`)** với rào chống bịa chuẩn. Nếu người dùng đã có bản AI từ tab `overall`, giao diện cho phép chọn tái dùng nhưng **bắt buộc đóng dấu nhãn nguồn gốc** (`[Nguồn: Tái sử dụng từ bản Luận giải Tổng quan nhanh]` so với `[Nguồn: Sinh theo chuẩn Hồ sơ Dữ kiện Xác định]`), và tuyệt đối không lấy văn bản mẫu fallback nội bộ (`generateLocalInterpretationVi`) giả làm kết quả AI của Chương 1. |

---

## 3. VÒNG 1 — Phản Biện Độc Lập Của Từng Chuyên Gia

### 3.1. Chuyên gia 1 — Kiến trúc sư Hệ thống (CG1)

#### `P1-01` [Mức độ: NGHIÊM TRỌNG] — Đính chính nền tảng về bảng `SI_HUA_TABLE` trong §1.3 và hạ mức rủi ro `R-1` *(Điểm phản biện #1 của người dùng)*
- **Phân tích sai sót trong bản v1**:
  - Tại §1.3 và bảng rủi ro `R-1`, bản v1 đã tiếp nhận một tiền đề sai từ vòng ghi nhận trước khi cho rằng bài Hợp Bàn gán `"Thái Dương Hóa Lộc"` cho nam mệnh Can Canh là lỗi AI bịa sai.
  - Kiểm tra trực tiếp mã nguồn `src/lib/ziwei/constants.ts:47-58`:
    ```ts
    // 四化表（年干 → [化禄, 化权, 化科, 化忌]）
    export const SI_HUA_TABLE: Record<number, [string, string, string, string]> = {
      ...
      6: ['太阳', '武曲', '太阴', '天同'],   // 庚 (Canh: Thái Dương Hóa Lộc, Vũ Khúc Hóa Quyền, Thái Âm Hóa Khoa, Thiên Đồng Hóa Kỵ)
      7: ['巨门', '太阳', '文曲', '文昌'],   // 辛
      8: ['天梁', '紫微', '左辅', '武曲'],   // 壬 (Nhâm: Thiên Lương Hóa Lộc, Tử Vi Hóa Quyền, Tả Phù Hóa Khoa, Vũ Khúc Hóa Kỵ)
      9: ['破军', '巨门', '太阴', '贪狼'],   // 癸
    };
    ```
  - Như vậy:
    1. Thứ tự 4 phần tử trong `SI_HUA_TABLE` là `[Hóa Lộc, Hóa Quyền, Hóa Khoa, Hóa Kỵ]`.
    2. Với Can Canh (`index = 6`), engine của app quy định chuẩn: **Thái Dương Hóa Lộc, Vũ Khúc Hóa Quyền, Thái Âm Hóa Khoa, Thiên Đồng Hóa Kỵ** (khẩu quyết Bắc phái / Toàn Thư phổ biến nhất: *Canh Dương Vũ Âm Đồng*). Với Can Nhâm (`index = 8`), engine quy định: **Thiên Lương Hóa Lộc, Tử Vi Hóa Quyền, Tả Phù Hóa Khoa, Vũ Khúc Hóa Kỵ** (*Nhâm Lương Vi Phụ Vũ*).
    3. Do đó, các nhãn `"Thái Dương Hóa Lộc"`, `"Vũ Khúc Hóa Quyền"`, `"Thái Âm Hóa Khoa"` xuất hiện trong bài luận giải Hợp Bàn trước đây **hoàn toàn chính xác 100% theo dữ liệu của engine**, không phải lỗi AI gán sai!
    4. Điểm duy nhất còn tồn tại ở tầng hiển thị văn bản tóm tắt là hàm `formatChartSummaryVi()` (`src/lib/ziwei/vi-i18n.ts:1406`) hiện in chuỗi `(Hóa Lộc)` / `(Hóa Quyền)` ngay sau tên sao mà chưa ghi tiền tố `(Bản mệnh Hóa ...)` như `yunxian-context.ts:253`, và khi `yunxian-context.ts:563` nối chuỗi có thể sinh cụm lặp chữ nếu không chuẩn hóa định dạng hiển thị.
- **Yêu cầu sửa trong v2**:
  1. Viết lại mục **§1.3 (i)** để đính chính rõ ràng: xác nhận bảng `SI_HUA_TABLE` tại `constants.ts:47-58` là chuẩn xác, đồng nhất trên toàn ứng dụng và **TUYỆT ĐỐI KHÔNG sửa đổi bảng Tứ Hóa của engine**.
  2. Hạ mức độ của rủi ro **`R-1`** từ **Cao** xuống **Thấp (Rủi ro trình bày / Phòng ngừa diễn đạt)**: giữ nguyên biện pháp gắn nhãn tiền tố lớp Tứ Hóa tường minh (`[Tứ Hóa Bản Mệnh - Can Năm Sinh]`, `[Tứ Hóa Đại Hạn]`, `[Tứ Hóa Lưu Niên]`, `[Tự Hóa Can Cung]`) trong các hàm tạo dữ kiện mới (`dossier-context.ts` và ngữ cảnh Chat) như một hàng rào phòng ngừa chuẩn mực.

#### `P1-02` [Mức độ: CAO] — Ma trận dữ kiện nhiều năm cho Chương 7 (5 năm) và Chương 8 (10 năm) thiếu trường bắt buộc *(Điểm phản biện #5 của người dùng)*
- **Phân tích điểm yếu trong bản v1**:
  - Tại §2.2.2, v1 mô tả ma trận 10 năm của Chương 8 chỉ rút gọn còn *"Can Chi từng năm, cung kích hoạt, sao Hóa Lộc & Hóa Kỵ từng năm"*.
  - Nếu thiếu **Hóa Quyền**, **Hóa Khoa** của Lưu Niên và thiếu **Cung Đại Hạn đang chi phối năm đó** (đặc biệt khi khoảng 5 năm hoặc 10 năm vắt qua mốc đổi Đại Hạn), AI khi viết luận giải tổng hợp 5 năm / 10 năm sẽ tự suy đoán cung Đại Hạn hoặc tự bịa sao Hóa Quyền / Hóa Khoa của từng năm!
- **Yêu cầu sửa trong v2**:
  - Chốt cứng **Danh mục 8 trường bắt buộc trên mỗi hàng năm (`YearlyMatrixRow`)** của hàm `buildMultiYearHorizonContext(chart, startYear, endYear)` cho cả Chương 7 (`2026–2030`) và Chương 8 (`2026–2035`):
    1. `year` & `ganZhiVi`: Năm Dương lịch và Thiên Can Địa Chi của năm Lưu Niên (vd: `2026 — Bính Ngọ`).
    2. `nominalAge`: Tuổi âm lịch (hư tuế) của đương số trong năm đó.
    3. `governingDaXian`: Đại Hạn chi phối năm đó (`khoảng tuổi`, `tên cung bản mệnh của Đại Hạn`, `Can Chi cung Đại Hạn`, `4 sao Tứ Hóa Đại Hạn`, và cờ `isDaXianTransitionYear = true` nếu năm đó là năm đầu tiên bước sang Đại Hạn mới).
    4. `daXianLiuNianRelationVi`: Quan hệ hình học giữa cung Lưu Niên và cung Đại Hạn (`Trùng phùng`, `Xung chiếu`, `Tam hợp`, hay `Cung phụ trợ`).
    5. `activatedNatalPalace`: Cung bản mệnh được Lưu Niên kích hoạt (`tên cung`, `Can Chi`, `chính tinh + độ sáng + Tứ Hóa bản mệnh`, `cát tinh`, `sát tinh`).
    6. `liuNianSiHuaFull`: **Đủ cả 4 sao Tứ Hóa Lưu Niên (`Hóa Lộc`, `Hóa Quyền`, `Hóa Khoa`, `Hóa Kỵ`)** — mỗi sao ghi rõ: tên sao, cung bản mệnh nơi sao tọa thủ, vai trò cung Lưu Niên, và cung đối bị xung chiếu (đặc biệt với Hóa Kỵ).
    7. `keyDynamicStars`: Vị trí cung bản mệnh của bộ sao lưu trọng yếu trong năm (`Lưu Lộc Tồn`, `Lưu Thiên Mã`, `Lưu Kình Dương`, `Lưu Đà La`, `Lưu Hồng Loan`, `Lưu Thiên Hỷ`).
    8. `clashAndResonanceFlags`: Các cảnh báo giao hội tự động (ví dụ: `Song Lộc trùng phùng`, `Song Kỵ xung chiếu`, `Lưu Niên trùng Đại Hạn`).
  - **Rào prompt bắt buộc cho Chương 7 & Chương 8**: Thêm điều khoản cấm tuyệt đối trong `buildStrictDossierSectionPrompt`: *"Khi nhận xét về bất kỳ năm cụ thể nào trong giai đoạn 5 năm / 10 năm, CHỈ ĐƯỢC trích dẫn đúng các thông tin có trong hàng dữ kiện của năm đó trong Bảng Ma Trận; TUYỆT ĐỐI CẤM tự suy diễn thêm sao lưu, hạn tháng/ngày hay biến cố ngoài 8 trường dữ kiện đã cấp."*

#### `P1-03` [Mức độ: CAO] — Bất nhất nguồn dữ kiện và chuẩn chống bịa ở Chương 1 (`chapter_overview`) khi tái dùng cache `overall` *(Điểm phản biện #8 của người dùng)*
- **Phân tích điểm yếu trong bản v1**:
  - Bản v1 (§2.2.2) đề xuất Chương 1 tái dùng thẳng `cache['overall']` của `InsightPanel.tsx`.
  - Tuy nhiên, kiểm tra `InsightPanel.tsx:467-484` và `336-367` cho thấy:
    1. Khi mới mở lá số hoặc khi bấm vào tab `Tổng Quan Mệnh Cách`, `InsightPanel.tsx:479-484` khởi tạo `cache['overall__...'] = getFallbackText('overall')` — tức là **văn bản mẫu nội bộ (deterministic local template)** từ `generateLocalInterpretationVi()`, **không phải văn bản do AI sinh**!
    2. Ngay cả khi `fetchInsight` được gọi tới `POST /api/interpret` (`server.ts:516-527`), prompt của `/api/interpret` chỉ nhận `chartSummary` tổng quát mà **không có bảng dữ kiện Cách Cục (`detectPatterns`) hay bảng Tứ Hóa Bản Mệnh tách lớp** và không có 6 quy tắc rào chống bịa nghiêm ngặt như `/api/interpret-period`.
- **Yêu cầu sửa trong v2**:
  1. Thiết kế Chương 1 (`chapter_overview`) đi qua `POST /api/interpret-dossier-section` với hàm tạo dữ kiện xác định riêng **`buildNatalOverviewFactSheetVi(chart)`** (gồm: Tứ trụ/Âm lịch, Cục số, Mệnh/Thân/Mệnh Chủ/Thân Chủ, Bảng 4 sao Tứ Hóa Bản Mệnh Can Năm Sinh kèm cung tọa & cung xung, Tam Phương Tứ Chính của Mệnh Cung, và danh sách Cách Cục cổ phú từ `detectPatterns(chart)`).
  2. Không bao giờ lấy văn bản mẫu tĩnh (`generateLocalInterpretationVi`) từ `InsightPanel` làm nội dung AI của Chương 1.
  3. Trường hợp người dùng muốn chèn/tham chiếu thêm nội dung đã sinh từ luồng Chủ đề/Kỳ hạn bên ngoài, mọi chương trong Hồ sơ Xuất bản đều gắn **Nhãn Nguồn Gốc Dữ Liệu (`sourceBadge`)** tường minh ngay dưới tiêu đề chương:
     - `[Nguồn: Sinh mới theo chuẩn Hồ sơ Dữ kiện Xác định — Model: ... · Khóa: AIzaSy••••••xxxx]`
     - hoặc `[Nguồn: Kế thừa từ bộ nhớ đệm Luận giải Kỳ hạn Xác định (Lưu Niên 2026 / 2027) — Model: ... · Khóa: AIzaSy••••••xxxx]` (vì Chương 5 và Chương 6 dùng chung 100% `buildStrictPeriodAiPrompt` và `buildYunxianPeriodContext`).

#### `P1-04` [Mức độ: TRUNG BÌNH] — Va chạm tên mã quyết định `QĐ-1..5` với `QĐ-1..6` của kế hoạch Kho Khóa *(Điểm phản biện #2 của người dùng)*
- **Phân tích**: Trong v1, §1.1 trích dẫn `QĐ-1`, `QĐ-3`, `QĐ-5`, `QĐ-6` của `docs/key-pool-design-plan.md`, nhưng đến §6 lại đặt tên 5 quyết định mới là `QĐ-1` → `QĐ-5`, gây nhầm lẫn nghiêm trọng khi trích dẫn chéo.
- **Yêu cầu sửa trong v2**: Đổi toàn bộ 5 quyết định của kế hoạch 3 tính năng mới thành **`QĐ-F1` → `QĐ-F5`** (`Feature Decision 1..5`), giữ nguyên `QĐ-1` → `QĐ-6` cho các quyết định Kho Khóa đã chốt, và rà soát toàn bộ các tham chiếu trong văn bản.

---

### 3.2. Chuyên gia 2 — Kỹ sư Backend & Kho Key (CG2)

#### `P2-01` [Mức độ: CAO] — Kỷ luật "Nhảy cóc cùng Project" (`Same-Project Short-Circuit`), hệ quả đặt lại Cooldown 6h và bảo mật cờ `batchProbe` *(Điểm phản biện #6 của người dùng)*
- **Phân tích 4 khía cạnh kỹ thuật trong bản v1**:
  1. **(a) Phạm vi loại lỗi được phép nhảy cóc**: Bản v1 đã nêu nhảy cóc cho `QUOTA_PROJECT_ZERO`, `QUOTA_DAILY_EXHAUSTED`, `RATE_LIMIT_RPM`, nhưng chưa ghi điều khoản **CẤM nhảy cóc** đối với các lỗi không mang tính chất khóa hạn mức toàn Project như `NETWORK_OR_5XX`, `MODEL_UNAVAILABLE`, `AUTH_INVALID_KEY` hay `UNKNOWN`. Ví dụ: nếu Key $A_1$ bị `NETWORK_OR_5XX` (timeout mạng nhất thời) hoặc `AUTH_INVALID_KEY` (riêng key $A_1$ bị thu hồi), thì Key $A_2$ cùng Project vẫn hoàn toàn có thể hoạt động tốt — tuyệt đối không được nhảy cóc!
  2. **(b) Xử lý khi `detectedProjectNumber === null`**: Một key có thể đang ở trạng thái `cooldown` vì `NETWORK_OR_5XX` hoặc lỗi `429` không trả kèm chuỗi `projects/...` nên `detectedProjectNumber` là `null`. Nếu code so sánh `peer.detectedProjectNumber === key.detectedProjectNumber` mà không kiểm tra `typeof projectNumber === 'string' && projectNumber.length > 0`, hai key cùng có `null === null` sẽ bị nhảy cóc oan! Hơn nữa, key có `detectedProjectNumber === null` bắt buộc phải được gọi probe thực tế và không bao giờ tính vào bộ đếm `Bỏ qua do trùng Project`.
  3. **(c) Hệ quả đặt lại thời gian nguội (`Cooldown Reset Effect`) khi probe thất bại**:
     - Trong `allocator.ts:880-882`, khi `recordManualTestResult` nhận `ok = false`, nó gọi `this.recordFailure(keyId, classified, now)`, hàm này tính `key.cooldownUntil = now + cooldownMs` (`allocator.ts:764`).
     - Điều này có nghĩa là: nếu một key đang bị `QUOTA_PROJECT_ZERO` và đã chờ được 4 giờ (chỉ còn 2 giờ nữa là hết hạn nguội 6 giờ), khi người dùng bấm `"Test lại toàn bộ key đang nguội"` mà Google vẫn trả về `429 quota_limit_value = "0"`, thời gian nguội của key đó (và các key cùng Project) sẽ bị **đặt lại thành 6 giờ tính từ thời điểm vừa bấm probe (`now + 6h`)**, đồng thời `consecutiveErrors` tăng thêm `1`. Đây là hành vi đúng về mặt kỹ thuật nhưng **bắt buộc phải minh bạch hóa trong tài liệu và trên giao diện** để người dùng biết trước khi bấm!
  4. **(d) Kiểm soát bảo mật phía server cho cờ `batchProbe` / `bypassDebounce`**:
     - Trong `server.ts:321-340`, route `POST /api/key-pool/:id/test` gọi `if (!requireKeyPoolWriteAccess(req, res)) return;` ngay dòng đầu tiên.
     - Cần quy định rõ trong v2: cờ `{ batchProbe: true }` trong body của `POST /api/key-pool/:id/test` **chỉ được xử lý sau khi `requireKeyPoolWriteAccess` đã trả về `true`** (tức đã xác thực PIN trên Shared URL hoặc đang ở Development URL hợp lệ), và ngay cả khi `batchProbe === true`, server vẫn áp ngưỡng bảo hiểm tối thiểu `MIN_BATCH_PROBE_INTERVAL_MS = 1_000ms` giữa 2 lần test trên cùng 1 `keyId` để không ai có thể dùng cờ này làm đường vòng spam một key đơn lẻ.

#### `P2-02` [Mức độ: TRUNG BÌNH] — Nguy cơ tranh chấp 3 Key khỏe khi người dùng vừa chạy sinh Hồ sơ 8 chương (Tính năng 2) vừa bấm Chat hỏi AI (Tính năng 3) hoặc chạy Batch Probe (Tính năng 1)
- **Phân tích phát hiện mới**:
  - Giả sử người dùng đang mở `DetailedDossierModal` để sinh tuần tự 8 chương (Tính năng 2). Mỗi chương đang chiếm 1 `KeyLease` trên 1 trong 3 key khỏe. Nếu ngay trong lúc Chương 3 đang stream, người dùng mở `ContextualChatDrawer` bấm gửi liên tiếp 2 câu hỏi (Tính năng 3), 2 câu hỏi đó sẽ chiếm nốt 2 key khỏe còn lại và làm tăng tốc độ đốt RPM gấp đôi trong cùng cửa sổ 60 giây.
- **Đề xuất xử lý trong v2**:
  - Thiết kế **Cơ chế Điều phối Ưu tiên Phía Client (`Client-Side AI Task Mutex / Queue Notice`)**:
    - Khi tiến trình sinh **Bản Luận Giải Chi Tiết** đang ở trạng thái chạy chủ động (`isGeneratingDossier === true`), nếu người dùng bấm gửi câu hỏi trong khung Chat của một chương đã sinh xong, hệ thống có 2 chế độ an toàn: (1) Tự động tạm hoãn khởi tạo chương kế tiếp của Hồ sơ cho tới khi câu trả lời Chat ngắn (`3–5s`) hoàn tất, rồi mới tiếp tục chương tiếp theo; (2) Không bao giờ cho phép chạy song song 2 request streaming cùng lúc từ cùng một trình duyệt của người dùng (`maxClientConcurrentStreams = 1`).

#### `P2-03` [Mức độ: TRUNG BÌNH] — Thời lượng stream của Chương nhóm 4 cung (1.000–1.400 từ) so với `TOTAL_FAILOVER_TIME_BUDGET_MS = 35_000ms` trong `executor.ts`
- **Phân tích phát hiện mới từ code `server/key-pool/executor.ts`**:
  - Đọc kỹ `executor.ts:169, 191, 356`:
    - `TOTAL_FAILOVER_TIME_BUDGET_MS = 35_000` (35 giây) được kiểm tra tại **thời điểm bắt đầu một lượt thử mới hoặc bắt đầu một lượt nối tiếp (`continuation`)** (`nowFn() - requestStartMs < TOTAL_FAILOVER_TIME_BUDGET_MS`).
    - Một khi stream đã bắt đầu nhận chunk và không bị ngắt, vòng `for await (const chunk of stream)` (`executor.ts:256-287`) chạy cho tới khi nhận hết bài (được bảo vệ bởi `lease.heartbeat()` trượt `45s`, trần bảo hiểm `120s`), **không bị cắt ở giây thứ 35**.
    - Tuy nhiên, nếu một chương nhóm 4 cung dài `1.200 từ` đã stream được `25 giây` (xong 3 cung đầu) rồi mới bị `503 UNAVAILABLE` ở giây thứ `26`: lúc đó `nowFn() - requestStartMs = 26_000ms < 35_000ms` nên lượt tiếp nối thứ nhất (`continuationCount = 1`) **vẫn được phép chạy**; nhưng nếu đến giây thứ `36` mới bị ngắt lần đầu (do model stream chậm), điều kiện `nowFn() - requestStartMs < TOTAL_FAILOVER_TIME_BUDGET_MS` (`36s < 35s` = `false`) tại `executor.ts:356` sẽ chặn không cho gọi nối tiếp!
- **Đề xuất xử lý trong v2**:
  - Ghi rõ phát hiện này vào §2.2.2 và §4 (Rủi ro): giữ nguyên hằng số `TOTAL_FAILOVER_TIME_BUDGET_MS = 35_000` của Kho Khóa theo đúng ràng buộc đề bài (không sửa `executor.ts`), nhưng trong prompt của Chương 2, 3, 4 quy định cấu trúc cô đọng súc tích (**250–350 từ/cung**, tổng chương **1.000–1.350 từ**, tránh viết lan man quá 1.500 từ) để thời gian stream của lượt đầu nằm gọn trong khoảng `14–24 giây` (luôn dưới ngưỡng `35s`, đảm bảo nếu đứt giữa chừng vẫn còn ngân sách thời gian để `Seamless Continuation` cứu luồng).

---

### 3.3. Chuyên gia 3 — Chuyên gia UX & Tương tác Người dùng (CG3)

#### `P3-01` [Mức độ: TRUNG BÌNH] — Quản lý dung lượng và vòng đời `sessionStorage` khi lưu đồng thời Hồ sơ 8 chương và 10 mạch hội thoại Chat
- **Phân tích phát hiện mới**:
  - Trình duyệt giới hạn `sessionStorage` khoảng `5 MB` cho mỗi origin. Một bản Hồ sơ 8 chương hoàn chỉnh (gồm cả `factSheetMarkdown` + văn bản AI 8 chương) chiếm khoảng `45 – 70 KB` JSON; 10 mạch hội thoại Chat chiếm khoảng `80 – 120 KB`. Nếu người dùng tra cứu liên tiếp 15–20 lá số danh nhân/người thân trong cùng một tab mà không có cơ chế cắt tỉa LRU (Least Recently Used), `sessionStorage.setItem` có thể quăng `QuotaExceededError`.
- **Đề xuất xử lý trong v2**:
  - Bọc mọi thao tác đọc/ghi `sessionStorage` trong helper an toàn `safeSessionStorage` có cơ chế **LRU Eviction**:
    - Giữ tối đa **`5` bản Hồ sơ Xuất bản gần nhất** (`ziwei_dossier_cache_v1`) và **`10` mạch hội thoại Chat gần nhất** (`ziwei_chat_sessions_v1`).
    - Nếu gặp `QuotaExceededError`, tự động xóa bản ghi cũ nhất rồi ghi lại, tuyệt đối không làm crash UI.

#### `P3-02` [Mức độ: THẤP] — Thao tác chọn đoạn trích (`highlightedExcerpt`) để hỏi Chat trên thiết bị di động (Mobile UX)
- **Phân tích phát hiện mới**:
  - Bản v1 (§2.3.1) nhắc tới việc bôi đen đoạn văn để hỏi. Trên màn hình cảm ứng iOS/Android, việc bôi đen văn bản rồi bấm nút nổi bên trong app rất dễ xung đột với menu `Copy / Look Up` mặc định của hệ điều hành.
- **Đề xuất xử lý trong v2**:
  - Thay vì phụ thuộc vào sự kiện bôi đen văn bản phức tạp, cung cấp **2 cơ chế chọn ngữ cảnh thân thiện với mọi thiết bị**:
    1. **Nút `"Hỏi rõ thêm về phần này"`** đặt cố định ở thanh tiêu đề của từng khối luận giải (Kỳ hạn, Chủ đề/Cung, hoặc từng Chương trong Hồ sơ).
    2. **Bộ chọn nhanh đề mục (`Section Pill Selector`) + Gợi ý câu hỏi nhanh (`Quick Question Chips`)** ngay đầu `ContextualChatDrawer`: ví dụ khi mở Chat từ bài Lưu Niên 2026, đầu khung Chat có sẵn các chip chọn nhanh: `[Toàn bộ bài]`, `[Mục 1: Chủ đề kỳ hạn]`, `[Mục 2: Điểm Cát]`, `[Mục 3: Điểm Hung & Xung chiếu]`, `[Mục 4: Lời khuyên]`. Người dùng chỉ cần chạm 1 lần vào chip `[Mục 3: Điểm Hung & Xung chiếu]` là hệ thống tự động trích xuất đoạn văn của Mục 3 làm `highlightedExcerpt`!

#### `P3-03` [Mức độ: THẤP] — Đảm bảo tương phản màu sắc khi xuất file `.html` bản in độc lập (Standalone Printable HTML)
- **Phân tích phát hiện mới**:
  - Giao diện web hiện có 2 chế độ: nền tối (`Huyền Không`) và nền sáng (`Giấy Cổ`). Nếu xuất HTML lấy theo biến CSS của nền tối, khi người dùng in ra giấy hoặc xuất PDF sẽ bị nền đen tốn mực và khó đọc.
- **Đề xuất xử lý trong v2**:
  - File `.html` bản in độc lập xuất ra từ Tính năng 2 luôn sử dụng **Bảng màu Giấy Cổ Sáng chuẩn in ấn (`#FAF6EE` trên màn hình, `#FFFFFF` trong `@media print`, chữ `#1E293B`, điểm nhấn đỏ son/vàng đồng đậm)** bất kể ứng dụng đang ở chế độ Sáng hay Tối.

---

### 3.4. Chuyên gia 4 — Người phản biện Rủi ro, Quota & Chống bịa (CG4)

#### `P4-01` [Mức độ: NGHIÊM TRỌNG] — Ước tính thời gian §3 trong v1 quá lạc quan so với dữ liệu chạy thật ngày 16–17/11 và bỏ sót rủi ro `AbortError (code=20)` *(Điểm phản biện #3 của người dùng)*
- **Phân tích bằng chứng thực nghiệm**:
  - Bản v1 (§3.2) ước tính mỗi chương chỉ mất `~7,5s` stream + `1,5s` nghỉ = `~70–80 giây` cho 8 chương.
  - Tuy nhiên, đối chiếu với `docs/stream-interruption-diagnosis.md` (số đo thực tế ngày `16–17/11/2026` trên cùng kho 23 key với 3 key khỏe `#21`, `#22`, `#23`):
    1. Một bài luận giải kỳ hạn hoàn chỉnh khi gặp `503 UNAVAILABLE (high demand)` giữa luồng và phải kích hoạt cơ chế Tự động Tiếp Nối (`Seamless Continuation`) hoặc xoay qua 2–4 key mất tới **`35 – 60 giây`**.
    2. Lỗi `503 UNAVAILABLE` trên model mặc định `gemini-3.5-flash-lite` xảy ra lặp đi lặp lại ở nhiều lần chạy.
    3. Đặc biệt, Mục 6 của `docs/stream-interruption-diagnosis.md` đã ghi nhận hiện tượng **`AbortError: This operation was aborted | code=20`** xuất hiện thành chuỗi sau sự kiện `MODEL_UNAVAILABLE` (4 lần liên tiếp ở *Đại Hạn 25–34 lần 1* và 2 lần liên tiếp ở *Steve Jobs lần 2*), khiến `allocator.ts` xếp vào `NETWORK_OR_5XX` và phạt nguội key `26–33 giây` (`-10` điểm).
  - Khi Tính năng 2 thực hiện **8 chương liên tiếp**, xác suất ít nhất 2–3 chương trong 8 chương gặp `503 UNAVAILABLE` hoặc `AbortError (code=20)` là rất thực tế! Nếu 2 key khỏe vô tình dính `AbortError` liên tiếp và bị nguội `30 giây`, tiến trình sinh 8 chương sẽ phải chờ key hết nguội hoặc tạm dừng giữa chừng.
- **Yêu cầu sửa trong v2**:
  1. Thiết lập **Bảng Ước Tính Thời Gian 3 Kịch Bản (Lạc quan / Thực tế / Xấu)** trong §3.2 cho Bản Luận Giải Chi Tiết 8 chương:
     - **Kịch bản 1 — Lạc quan (Mạng & Model thông suốt, 0 failover, 0 nối tiếp)**: `~12–16s`/chương + `1,5s` nghỉ $\Rightarrow$ **8 chương (Lạnh) mất `~110 – 140 giây` (~1,8 – 2,3 phút)**; **5 chương (Ấm, đã có cache 3 chương) mất `~68 – 88 giây` (~1,1 – 1,5 phút)**.
     - **Kịch bản 2 — Thực tế (Có 2–3 chương gặp `503 UNAVAILABLE` hoặc `429 RPM` phải chuyển `fallbackModel` / nối tiếp luồng 1 lần, mỗi chương đó mất `28–45s`)**: **8 chương (Lạnh) mất `~3,0 – 4,5 phút` (`180 – 270 giây`)**; **5 chương (Ấm) mất `~2,0 – 3,0 phút` (`120 – 180 giây`)**.
     - **Kịch bản 3 — Xấu (Nhiều chương gặp `503` + xuất hiện chuỗi `AbortError code=20` làm 2–3 key khỏe rơi vào `cooldown` 30s, có chương mất tới `55–60s` hoặc phải chờ nguội / bấm Tiếp tục 1 lần)**: **8 chương (Lạnh) mất `~5,5 – 8,0 phút` (`330 – 480 giây`)**, trong đó có thể dừng tạm thời ở chương thứ 5–6 chờ `~25–30s` cho key hồi phục rồi bấm `"Tiếp tục sinh phần còn thiếu"`.
  2. Bổ sung rủi ro **`R-3` (Mức độ: CAO)** riêng biệt cho **`AbortError (code=20)` và `503 UNAVAILABLE` dây chuyền khi chạy 8 luồng liên tiếp**, kèm cơ chế phòng vệ thực chiến: lưu kết quả tức thì sau mỗi chương hoàn tất (`Incremental Chapter Commit`), tự động chờ hồi phục ngắn nếu gặp `AI_POOL_EXHAUSTED` với `minRemainingCooldownSec <= 35s`, và cho phép xuất ngay các chương đã xong bất cứ lúc nào.

#### `P4-02` [Mức độ: CAO] — Mâu thuẫn giữa độ dài chương (`600–900 từ`) và yêu cầu phân tích sâu 4 cung/chương (`150–225 từ/cung`) *(Điểm phản biện #4 của người dùng)*
- **Phân tích**:
  - Với 1 cung Tử Vi, chỉ riêng việc nêu Chính tinh (kèm độ sáng Miếu/Vượng/Hãm), Phụ tinh / Sát tinh, Tứ Hóa (Bản mệnh + Tự hóa), phân tích mối liên hệ Tam Phương Tứ Chính và đưa ra lời khuyên ứng dụng theo tâm pháp Thiên Kỷ đã cần tối thiểu **`250 – 350 từ`**.
  - Nếu cả chương 4 cung chỉ viết `600–900 từ`, mỗi cung chỉ còn `150–225 từ` (khoảng 6–8 câu), nội dung sẽ trở nên hời hợt, không xứng đáng với tên gọi **"Bản Luận Giải Chi Tiết"**.
- **Yêu cầu sửa trong v2**:
  - Quy định rõ trong §2.2.2 và §3.1:
    - Với **Chương 2, Chương 3, Chương 4 (mỗi chương gồm 4 cung)**: đặt **ngân sách từ tối thiểu `250 – 350 từ / cung`** $\Rightarrow$ tổng độ dài mỗi chương nhóm cung đạt **`1.000 – 1.400 từ`** (`~1.800 – 2.500 output tokens`).
    - Trong `buildStrictDossierSectionPrompt`, bắt buộc AI trình bày mỗi cung thành một mục `###` riêng biệt, bên trong mỗi cung phải có đủ 3 ý: *(1) Cấu trúc Tinh hệ & Độ sáng tại Bản cung + Tam Phương Tứ Chính; (2) Động lực Tứ Hóa & Điểm mạnh/Thử thách thực tế; (3) Lời khuyên ứng xử & cải vận cho mảng cuộc sống đó (tối thiểu 250–350 từ/cung)*.
    - Với **Chương 1 (Tổng quan)** và **Chương 5, 6, 7, 8 (Thời gian)**: ngân sách từ chuẩn **`750 – 1.100 từ / chương`**.
    - Tổng độ dài toàn bộ **Bản Luận Giải Chi Tiết 8 chương** sẽ đạt khoảng **`7.000 – 9.500 từ` tiếng Việt** (tương đương một cuốn hồ sơ mệnh lý chuyên sâu 15–20 trang A4).

#### `P4-03` [Mức độ: CAO] — Thiếu cơ chế Giới hạn mềm (Soft Rate Limit / Quota Guard) cho khung Chat giải thích (Tính năng 3) *(Điểm phản biện #7 của người dùng)*
- **Phân tích**:
  - Khung Chat giải thích (Tính năng 3) có tốc độ phản hồi nhanh (`3–5s`) nên rất dễ kích thích người dùng hỏi dồn dập 10–15 câu liên tiếp trong vài phút. Vì cả ứng dụng chỉ có **3 key Free Tier khỏe**, việc hỏi dồn dập trong Chat sẽ làm cạn RPM hoặc đẩy các key vào `modelCooldowns`, khiến khi người dùng quay sang bấm Luận giải Kỳ hạn hoặc Xuất bản Hồ sơ chi tiết thì bị báo lỗi `429`.
- **Yêu cầu sửa trong v2**:
  - Thiết kế **Cơ chế Giới hạn Mềm Kép (`Dual Soft Quota Guard`)** cho Tính năng 3 tại §2.3.4:
    1. **Giãn cách tối thiểu giữa 2 câu hỏi liên tiếp (`CHAT_MIN_INTERVAL_SEC = 8 giây`)**: Sau khi một câu trả lời hoàn tất (hoặc tính từ lúc gửi câu trước), nút `"Gửi câu hỏi"` có bộ đếm ngược nhẹ nhàng `Chờ 8s...` để ngăn bấm dồn dập liên thanh.
    2. **Trần mềm theo phiên lá số (`CHAT_SOFT_CAP_PER_CHART = 15 câu hỏi / phiên`, cảnh báo nhẹ từ câu thứ `10`)**:
       - Hiển thị bộ đếm nhỏ trên thanh tiêu đề Chat: `Lượt hỏi đáp lá số này: k/15 (Tiết kiệm hạn mức Free Tier)`.
       - Khi đạt `10/15` câu: hiển thị dòng nhắc nhở màu vàng nhạt: *"Bạn đã sử dụng 10/15 lượt hỏi giải thích khuyến nghị cho lá số này để bảo vệ hạn mức 3 khóa Free Tier."*
       - Khi chạm `15/15` câu: tạm khóa nút Gửi và hiện nút xác nhận chủ động: **`"Mở thêm 5 lượt hỏi (Lưu ý: có thể làm chậm lượt luận giải kỳ hạn tiếp theo)"`**. Đây là **giới hạn mềm (soft cap)**: vừa ngăn việc vô tình đốt sạch quota, vừa không chặn cứng nếu người dùng thực sự cần hỏi thêm.

#### `P4-04` [Mức độ: TRUNG BÌNH] — Xử lý trường hợp năm Lưu Niên trong ma trận 10 năm rơi vào "Đồng Hạn" (trước Đại Hạn đầu tiên) hoặc vượt quá Đại Hạn thứ 12
- **Phân tích phát hiện mới từ `src/lib/ziwei/yunxian-context.ts:69-145`**:
  - Trong `yunxian-context.ts`, nếu đương số sinh năm gần hiện tại (ví dụ trẻ nhỏ 1–4 tuổi chưa vào Đại Hạn đầu tiên `startAge`), `getDaXianIndexForYear(chart, year)` trả về `-1` (thuộc Đồng Hạn — `isChildhoodYear`).
  - Hàm `buildMultiYearHorizonContext(chart, 2026, 2035)` cần kiểm tra an toàn trường hợp `effDxIdx === -1` bằng cách dùng `getChildhoodDaXianPalace(chart, year)` có sẵn tại `yunxian-context.ts:100` để không bao giờ bị lỗi truy xuất `chart.daXians[-1]`.

---

## 4. VÒNG 2 — Thảo Luận & Phản Biện Chéo Giữa Các Chuyên Gia (Cross-Examination)

### 4.1. Các điểm đạt Đồng thuận Tuyệt đối (4/4 Chuyên gia nhất trí)
1. **Đính chính §1.3 & Hạ mức `R-1` (`P1-01`)**: Cả 4 chuyên gia xác nhận mã nguồn `constants.ts:47-58` hoàn toàn chuẩn xác; việc giữ nguyên 100% `SI_HUA_TABLE` và chỉ bổ sung nhãn lớp Tứ Hóa tường minh trong các bảng dữ kiện mới là hướng xử lý chuẩn xác nhất.
2. **Đổi tiền tố quyết định sang `QĐ-F1` → `QĐ-F5` (`P1-04`)**: Triệt tiêu hoàn toàn sự nhập nhằng với `QĐ-1` → `QĐ-6` của kế hoạch Kho Khóa.
3. **Kỷ luật 4 quy tắc Nhảy cóc Project & Cảnh báo đặt lại 6h ở Tính năng 1 (`P2-01`)**: Đảm bảo không bao giờ nhảy cóc sai trên lỗi mạng/model hoặc trên key có `detectedProjectNumber === null`, đồng thời cảnh báo rõ cho người dùng về việc tính lại chu kỳ nguội từ thời điểm probe.
4. **Danh mục 8 trường bắt buộc cho mỗi hàng năm ở Chương 7 & Chương 8 (`P1-02` + `P4-04`)**: Bắt buộc có đủ 4 sao Tứ Hóa Lưu Niên (`Lộc · Quyền · Khoa · Kỵ`) và thông tin Đại Hạn chi phối từng năm, kèm rào prompt chống suy diễn ngoài bảng.
5. **Giới hạn mềm kép cho khung Chat (`P4-03` + `P2-02`)**: Giãn cách `8 giây` giữa 2 câu hỏi + trần mềm `15 câu / lá số` (có nút xác nhận mở thêm 5 câu) + chặn chạy song song với tiến trình sinh Hồ sơ chi tiết.

---

### 4.2. Các điểm Tranh luận Chéo & Phán quyết của Điều phối viên

#### Tranh luận 1: Tăng độ sâu lên `250–350 từ/cung` (tổng chương nhóm 4 cung `1.000–1.400 từ`) có làm tăng nguy cơ đứt luồng `503 UNAVAILABLE` / `AbortError` không? (`CG1` & `CG3` vs. `CG2` & `CG4`)
- **Luận điểm của `CG1` & `CG3`**:
  - Người dùng bấm nút **"Xuất bản luận giải chi tiết"** là để nhận một bản hồ sơ đầy đủ, đọc sâu được từng mảng trong 12 mảng cuộc sống. Nếu mỗi cung chỉ viết 150 từ thì không khác gì bản tóm tắt. Do đó sàn **`250 – 350 từ / cung`** (tức `1.000 – 1.350 từ / chương` cho Chương 2, 3, 4) là bắt buộc.
- **Phản biện của `CG2` & `CG4`**:
  - Đồng ý phải giữ sàn `250 – 350 từ / cung`, nhưng cần nhìn thẳng vào số liệu: một chương `1.200 từ` tiếng Việt tương đương `~2.000 – 2.400 output tokens`, thời gian giữ kết nối stream khoảng `15 – 24 giây`. Nếu giữ khoảng nghỉ giữa 2 chương chỉ `1.500ms` như v1, 3 chương nhóm cung liên tiếp sẽ giữ kết nối gần như thông suốt trong 1 phút.
  - Hơn nữa, nếu một chương đang viết ở cung thứ 3 (khoảng chữ thứ 800) mà gặp `503 UNAVAILABLE`, hàm `buildContinuationPrompt` trong `executor.ts:95` hiện lấy `partialTextSoFar.slice(-2600)` (2.600 ký tự cuối $\approx 500–600$ từ) làm điểm neo để model dự phòng `gemini-3.8-flash` viết tiếp — hoàn toàn đủ để nối tiếp mạch lạc!
  - Tuy nhiên, để giảm tải cho 3 key khỏe và tăng tỷ lệ thành công ngay từ lượt đầu, `CG4` đề xuất:
    1. Tăng nhẹ khoảng nghỉ điều tiết giữa 2 chương liên tiếp trong tiến trình sinh tự động từ `1.500ms` lên **`2.200ms` (2,2 giây)**.
    2. Trong prompt của Chương 2, 3, 4, đặt khung độ dài mục tiêu rõ ràng: **`250 – 350 từ cho mỗi cung` (tổng chương `1.000 – 1.400 từ`)** — đủ sâu cho cả 4 cung nhưng không để model viết tràn lan lên 3.000 từ gây nghẽn luồng.
- **Phán quyết của Điều phối viên**: **Chốt theo phương án đồng thuận kết hợp**:
  - Áp dụng sàn **`250 – 350 từ / cung`** cho Chương 2, 3, 4 (tổng mỗi chương nhóm cung `1.000 – 1.400 từ`).
  - Tăng khoảng nghỉ giữa 2 chương liên tiếp lên **`2,2 giây` (`2.200ms`)**.
  - Cập nhật toàn bộ bảng thời gian §3 theo **3 kịch bản (Lạc quan / Thực tế / Xấu)** phản ánh đúng độ dài mới này và dữ liệu thực nghiệm ngày 16–17/11.

#### Tranh luận 2: Chương 1 (`chapter_overview`) nên luôn gọi mới theo chuẩn Hồ sơ hay cho phép tái dùng cache từ ngoài `InsightPanel`? (`CG1` vs. `CG4`)
- **Luận điểm của `CG1`**:
  - Muốn toàn bộ 8 chương của Hồ sơ Xuất bản có cùng một tiêu chuẩn "Neo chặt vào Bảng dữ kiện xác định" (Grounded Dossier Standard), Chương 1 (`chapter_overview`) nên có hàm `buildNatalOverviewFactSheetVi(chart)` riêng và gọi `POST /api/interpret-dossier-section` thay vì dùng chung cache với tab `overall` của `InsightPanel` (vốn dùng `/api/interpret` hoặc fallback tĩnh).
- **Luận điểm của `CG4`**:
  - Đồng ý tuyệt đối **không được lấy văn bản fallback tĩnh (`generateLocalInterpretationVi`)** của tab `overall` đưa vào Chương 1. Nhưng nếu người dùng vừa mới bấm sinh Chương 1 trong Hồ sơ, thì kết quả Chương 1 đó phải được lưu vào `dossierCache[chartIdentityKey]['chapter_overview']` để lần sau mở lại Hồ sơ không tốn lại 1 lần gọi AI. Còn với Chương 5 (`Lưu Niên 2026`) và Chương 6 (`Lưu Niên 2027`), vì cả `InsightPanel` lẫn Hồ sơ Xuất bản đều dùng chung 100% `buildYunxianPeriodContext` và `POST /api/interpret-period`, nên việc tái dùng cache 2 chiều là hoàn toàn chuẩn xác, chỉ cần gắn nhãn nguồn gốc (`sourceBadge`) rõ ràng.
- **Phán quyết của Điều phối viên**: **Chốt chuẩn xác như sau**:
  1. **Chương 1 (`chapter_overview`)**: Dùng dữ kiện xác định `buildNatalOverviewFactSheetVi(chart)` + prompt chống bịa `buildStrictDossierSectionPrompt` qua `POST /api/interpret-dossier-section`. Cache của Chương 1 được lưu theo `dossierCache` của lá số (không lấy nhầm văn bản fallback tĩnh của `InsightPanel`).
  2. **Chương 5 (`year_2026`) & Chương 6 (`year_2027`)**: Dùng chung 100% `buildYunxianPeriodContext` + `POST /api/interpret-period` nên được phép **tái sử dụng cache 2 chiều với `aiPeriodCache` của `InsightPanel`** (tiết kiệm 2 lần gọi AI nếu người dùng đã xem trước Lưu Niên 2026/2027), đồng thời hiển thị rõ nhãn nguồn gốc:
     - `[Nguồn: Kế thừa từ bộ nhớ đệm Luận giải Kỳ hạn Xác định — Model: ... · Khóa: AIzaSy••••••xxxx]` (khi lấy từ `aiPeriodCache`)
     - hoặc `[Nguồn: Sinh trực tiếp trong Hồ sơ Xuất bản — Model: ... · Khóa: AIzaSy••••••xxxx]` (khi sinh mới trong modal).

---

## 5. Điểm Còn Mở Để Người Dùng Quyết Định (`QĐ-F1` → `QĐ-F5`)

Tổ chuyên gia đã thống nhất phương án khuyến nghị cho cả 5 quyết định thiết kế (được đánh mã **`QĐ-F1` → `QĐ-F5`** để tách biệt hoàn toàn với `QĐ-1` → `QĐ-6` của Kho Khóa):
- **`QĐ-F1`**: Định dạng xuất bản của Tính năng 2 (Khuyến nghị **Phương án A**: Kết hợp Tải file `.html` bản in độc lập chuẩn PDF + Tải file `.md` + Sao chép văn bản + In trực tiếp).
- **`QĐ-F2`**: Cấu trúc chia chương Phần (b) 12 cung của Tính năng 2 (Khuyến nghị **Phương án A**: **8 Chương Chuẩn** — 12 cung chia thành 3 chương nhóm Tam Hợp/Liên Đới × 4 cung, ép sàn **`250–350 từ/cung`** = `1.000–1.400 từ/chương`, tổng hồ sơ 8 lần gọi AI khi lạnh hoặc 6 lần khi đã cache Lưu Niên 2026/2027; so với Phương án B 17 chương rời).
- **`QĐ-F3`**: Cơ chế điều phối nút "Test lại toàn bộ key đang cooldown" của Tính năng 1 (Khuyến nghị **Phương án A**: Tuần tự `concurrency = 1`, giãn cách `1,2s` + Kỷ luật Nhảy cóc 4 quy tắc a/b/c/d + Cảnh báo đặt lại 6h trước khi bấm).
- **`QĐ-F4`**: Lưu trữ lịch sử hội thoại và Giới hạn mềm chống đốt quota của Tính năng 3 (Khuyến nghị **Phương án A**: Lưu `React state` + `sessionStorage` có LRU tối đa 10 mạch, kèm **Giới hạn mềm kép**: giãn cách `8 giây`/câu và trần mềm `15 câu/phiên/lá số`).
- **`QĐ-F5`**: Phạm vi đặt nút mở khung Chat giải thích của Tính năng 3 (Khuyến nghị **Phương án A**: Đặt tại cả 3 nơi — Khối Kỳ hạn trong `InsightPanel`, Khối Chủ đề/Cung trong `InsightPanel`, và từng Chương trong Modal Xuất bản chi tiết).
