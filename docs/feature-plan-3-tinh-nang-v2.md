# KẾ HOẠCH THIẾT KẾ CHI TIẾT (BẢN v2 — HẬU PHẢN BIỆN CHUYÊN GIA): 3 TÍNH NĂNG MỚI CHO TỬ VI THIÊN KỶ

**Phiên bản:** v2.0 (Hậu phản biện Panel 4 Chuyên gia & 8 điểm hiệu chỉnh của Chủ dự án)  
**Tác giả:** Gemini 4 Argon (Kiến trúc sư trưởng & Điều phối viên Panel)  
**Ngày lập:** 2026-11-17 *(kế thừa và nâng cấp từ bản v1.0 lập ngày 2026-11-16 tại `docs/feature-plan-3-tinh-nang.md`)*  
**Biên bản phản biện đối chiếu:** `docs/feature-plan-panel-review.md`  
**Trạng thái:** **ĐÃ PHÊ DUYỆT BỘ QUYẾT ĐỊNH `F1–F7` (17/11/2026) — Sẵn sàng thi công Phần A & Phần B**

---

## QUYẾT ĐỊNH ĐÃ ĐƯỢC NGƯỜI DÙNG DUYỆT 17/11/2026

> **Văn bản chốt quyết định (nguyên văn từ Chủ dự án lúc 01:35 ngày 17/11/2026):**  
> F1 Định dạng xuất bản: cả 3 (HTML in độc lập + Markdown + sao chép/in trực tiếp). F2 Cấu trúc hồ sơ: 8 chương, sàn 250–350 từ/cung, gom nhóm cung theo v1 (như trên), nhịp nghỉ giữa chương 2,2 giây. F3 Probe: client-orchestrated như trên. F4 Lưu lịch sử chat: sessionStorage theo cặp (lá số + phần luận giải), tối đa 10 mạch, có LRU/dọn an toàn — KHÔNG dùng localStorage/IndexedDB như v2 §4.4 đã viết. F5 Nút chat tại: khối kỳ hạn InsightPanel, khối chủ đề/cung InsightPanel, modal hồ sơ, màn Hợp Bàn. F6 Mở modal hồ sơ: tự động chạy tuần tự 8 chương + nút tạm dừng + cho sinh lẻ từng chương. F7 Hàng rào quota chat: nghỉ tối thiểu 8 giây giữa 2 câu (đếm ngược trên nút Gửi), trần mềm 15 câu/phiên/lá số (nhắc ở câu 10, nút mở thêm 5 ở câu 15), khóa tuần tự phía client (không gửi chat khi đang stream sinh chương hồ sơ). Chốt cứng: giữ nguyên SI_HUA_TABLE; cấu hình kho key không đổi (model chính gemini-3.5-flash-lite, dự phòng gemini-3.8-flash, ngân sách failover 35 giây/5 key, QĐ-6 giữ nguyên).

### Nguyên tắc ràng buộc khi có điểm lệch giữa bản v2 và Bộ quyết định `F1–F7`
**KHI BẢN v2 VÀ BỘ QUYẾT ĐỊNH `F1–F7` LỆCH NHAU, BỘ QUYẾT ĐỊNH `F1–F7` LUÔN THẮNG.** Cụ thể 3 điểm lệch bắt buộc tuân theo `F1–F7`:
1. **`F3` thắng `v2 QĐ-F1` & `Mục 2.3`:** Cơ chế probe Tính năng 1 là **CLIENT-ORCHESTRATED** hoàn toàn trong `src/components/KeyPoolModal.tsx`, gọi tuần tự route sẵn có `POST /api/key-pool/:id/test`. **KHÔNG** tạo endpoint batch mới trên server (`POST /api/key-pool/test-cooldown`) và không tạo cờ `batchProbe`/`bypassDebounce`.
2. **`F4` thắng `v2 §4.4`:** Lịch sử chat Tính năng 3 lưu trong **`sessionStorage`** theo cặp `(lá số + phần luận giải)`, giữ tối đa **10 mạch hội thoại**, có cơ chế **LRU / dọn an toàn** — **KHÔNG** dùng `localStorage`/`IndexedDB` như v2 §4.4 đã viết trước đó.
3. **`F2` thắng `v2 §3.2`:** Gom nhóm 12 cung cho Chương 2–4 **THEO ĐÚNG 3 NHÓM CỦA BẢN v1** (`Nhóm 1 — core`: **Mệnh Cung, Quan Lộc, Tài Bạch, Thiên Di**; `Nhóm 2 — family`: **Phu Thê, Tử Nữ, Điền Trạch, Phúc Đức**; `Nhóm 3 — social_health`: **Phụ Mẫu, Huynh Đệ, Giao Hữu, Tật Ách**), **KHÔNG** theo cách chia lại của v2 §3.2 (vốn đưa Điền Trạch/Phúc Đức sang Chương 4 và Phụ Mẫu/Huynh Đệ sang Chương 3).

---

## TÓM TẮT CÁC THAY ĐỔI TRỌNG YẾU TỪ BẢN v1 (16/11/2026) SANG BẢN v2 (17/11/2026)

| Hạng mục | Bản v1 (`docs/feature-plan-3-tinh-nang.md`) | Bản v2 (`docs/feature-plan-3-tinh-nang-v2.md`) | Mã biên bản |
|---|---|---|---|
| **1. Đính chính nền tảng bảng Tứ Hóa (`SI_HUA_TABLE`) & Hạ mức rủi ro `R-1`** | Mục 1.3 và `R-1` (Cao) nhận định nhầm rằng câu văn hợp hôn *"Thái Dương Hóa Lộc, Vũ Khúc Hóa Quyền, Thái Âm Hóa Khoa"* gán sai nhãn cho Can Nhâm, do nhầm thứ tự cột và nhầm `['太阳', '武曲', '太阴', '天同']` là Can Giáp. | **Đính chính chính xác theo code thật (`src/lib/ziwei/constants.ts:47-58`):** Thứ tự mảng chuẩn là `[Hóa Lộc, Hóa Quyền, Hóa Khoa, Hóa Kỵ]`; Can Canh (`6`) = `['太阳', '武曲', '太阴', '天同']` (Lộc Thái Dương, Quyền Vũ Khúc, Khoa Thái Âm, Kỵ Thiên Đồng); Can Nhâm (`8`) = `['天梁', '紫微', '左辅', '武曲']` (Lộc Thiên Lương, Quyền Tử Vi, Khoa Tả Phù, Kỵ Vũ Khúc). Nhãn Tứ Hóa trong bài Hợp Hôn **HOÀN TOÀN ĐÚNG** với engine (`Thái Dương Hóa Lộc / Vũ Khúc Hóa Quyền / Thái Âm Hóa Khoa` là Tứ Hóa bản mệnh Can Canh 1990). **Khẳng định tuyệt đối KHÔNG sửa `SI_HUA_TABLE`.** Hạ `R-1` từ **Cao** xuống **Thấp (Rủi ro trình bày / phòng ngừa)** do `formatChartSummaryVi` (`vi-i18n.ts:1406`) chỉ in `(Hóa X)` chưa kèm tiền tố tầng. | `P4-01` (Critical) |
| **2. Đổi mã Quyết Định tránh đụng độ Kho Khóa** | Đặt tên `QĐ-1` → `QĐ-5`, trùng với `QĐ-1` → `QĐ-6` trong `docs/key-pool-design-plan.md`. | Đổi toàn bộ quyết định của 3 tính năng mới thành **`QĐ-F1` → `QĐ-F5`**. Mọi tham chiếu đến quyết định Kho Khóa giữ nguyên `QĐ-1` → `QĐ-6`. | `P1-04` (Medium) |
| **3. Ước lượng thời gian 3 kịch bản & Rủi ro `AbortError (code=20)` (`R-3`)** | Ước lượng lý tưởng hóa `~7.5s/chương`, tổng hồ sơ 8 chương `~70–80s`, chưa tính `503 UNAVAILABLE` và `AbortError (code=20)`. | Thay bằng **bảng ước lượng 3 kịch bản (Thuận lợi / Thực tế / Xấu)** dựa trên số đo thực nghiệm ngày `16–17/11/2026` (`docs/stream-interruption-diagnosis.md`), tăng nhịp nghỉ giữa các chương lên **`2,200ms`**, và bổ sung rủi ro **`R-3` (Mức Cao)**: đứt luồng `AbortError (code=20)` / `503 UNAVAILABLE` giữa chuỗi 8 chương, giảm thiểu bằng **Cache Từng Chương Độc Lập + Nút "Tiếp tục tạo các chương còn thiếu"**. | `P4-02` (High) |
| **4. Sàn số từ tối thiểu cho Chương 2–4 (4 cung/chương)** | Ghi tổng `700–1,000 từ/chương` (`~175–250 từ/cung`) nhưng lại yêu cầu phân tích sâu mọi cung + tam phương tứ chính + Tứ Hóa dẫn tới mâu thuẫn chiều sâu. | Đặt **sàn tối thiểu bắt buộc `250–350 từ/cung`**, nâng tổng độ dài Chương 2, 3, 4 lên **`1,000–1,400 từ/chương`** (`~1,500–2,100 output tokens`), đồng thời neo cứng quy tắc độ dài tối thiểu mỗi cung vào System Prompt. | `P1-02` (High) |
| **5. Chuẩn hóa trường tối thiểu Ma Trận Đa Năm (Chương 7 & 8)** | Chưa liệt kê tường minh các trường bắt buộc trên mỗi dòng năm của ma trận 5 năm và 10 năm; có nguy cơ lọt lưới Tứ Hóa Lưu Niên hoặc không biết năm đó thuộc Đại Vận nào. | Quy định rõ **tập trường tối thiểu bắt buộc** cho cả `YearlyForecastMatrixRowVi` (5 năm `2026–2030`) và `TenYearCompactMatrixRowVi` (10 năm `2026–2035`), bắt buộc có **đủ 4 sao Lưu Niên Tứ Hóa (`Lộc / Quyền / Khoa / Kỵ`) kèm cung tọa/xung** và **Đại Vận chủ quản (`governingDaXian`)**, cùng **luật cấm suy diễn ngoài trường ma trận**. | `P1-01` (Critical) |
| **6. Kỷ luật `Same-Project Short-Circuit` ở Tính năng 1** | Chưa tách biệt rõ lỗi cấp Project với lỗi mạng/model/key và trường hợp `detectedProjectNumber === null`; chưa cảnh báo việc probe thất bại làm tính lại thời gian nguội từ `now`. | Quy định **4 kỷ luật cứng**: (a) Chỉ nhảy cóc với 3 lỗi quota cấp Project (`QUOTA_PROJECT_ZERO`, `QUOTA_DAILY_EXHAUSTED`, `RATE_LIMIT_RPM`), **tuyệt đối KHÔNG** nhảy cóc với `NETWORK_OR_5XX`, `MODEL_UNAVAILABLE`, `AUTH_INVALID_KEY`; (b) Key có `detectedProjectNumber === null` không bao giờ bị nhảy cóc và không cộng vào `Skipped`; (c) Ghi rõ và cảnh báo UI rằng probe thất bại tính lại `cooldownUntil = now + cooldownMs` (reset 6h cho `QUOTA_PROJECT_ZERO`); (d) Xác nhận `bypassDebounce` chỉ mở sau `requireKeyPoolWriteAccess(req, res)` + sàn bảo hiểm `1,000ms/key`. | `P2-01` (High) |
| **7. Hàng rào Quota Mềm Kép cho Chat Hỏi Đáp (Tính năng 3)** | Không có giới hạn tần suất bấm hỏi liên tiếp hay trần số câu mỗi phiên; dễ làm cạn RPM của 3 key sống. | Thiết lập **Hàng Rào Quota Mềm Kép**: (1) Khoảng nghỉ tối thiểu **`8 giây`** (`CHAT_MIN_INTERVAL_SEC = 8`) giữa 2 câu hỏi; (2) Trần mềm **`15 câu hỏi / phiên / lá số`** (cảnh báo ở câu 10, nút xác nhận *"Mở thêm 5 lượt hỏi"* ở câu 15); (3) **Khóa tuần tự Client-side** không cho gửi câu hỏi Chat khi đang chạy tiến trình lập Hồ Sơ Toàn Diện. | `P4-03` (High) |
| **8. Ranh giới Prompt & Nguồn gốc Cache giữa Chương 1 và Chương 5–6** | Viết gộp rằng Chương 1, 5, 6 tái sử dụng cache từ `InsightPanel` mà quên rằng tab "Tổng Quan Bản Mệnh" của `InsightPanel` hiện chỉ dùng hàm tĩnh `generateLocalInterpretationVi(chart)` (không gọi AI). | Làm rõ: **Chương 1 (`chapter_overview`)** gọi `POST /api/interpret-dossier-section` với Fact Sheet riêng `buildNatalOverviewFactSheetVi(chart)` (tuyệt đối không lấy bài tĩnh làm bài AI). **Chương 5 (`2026`) và Chương 6 (`2027`)** dùng chung `POST /api/interpret-period` + `buildYunxianPeriodContext` và đồng bộ cache 2 chiều kèm **nhãn nguồn gốc (`sourceBadge`)** tường minh. | `P1-03` (High) |

---

## MỤC 1 — TỔNG QUAN KIẾN TRÚC & NGUYÊN TẮC BẤT BIẾN

### 1.1. Bức tranh hiện trạng hệ thống (Đã kiểm chứng trên codebase thật)
Hệ thống **Tử Vi Thiên Kỷ** hiện vận hành trên kiến trúc Full-Stack TypeScript (React 19 + Vite + Express `server.ts`) với 2 trụ cột lõi:

1. **Module Kho Khóa Gemini (`server/key-pool/*`)**:
   - Đã triển khai hoàn chỉnh theo `docs/key-pool-design-plan.md` (cập nhật ngày `16/11/2026`) và bản vá Pha B (`docs/stream-interruption-diagnosis.md`).
   - Hỗ trợ lưu trữ AES-256-GCM tại `.data/gemini-key-pool.enc.json` (`crypto-store.ts`), phân bổ khóa ưu tiên tier + điểm sức khỏe + nhảy cóc theo `detectedProjectNumber` (`allocator.ts`), thực thi luồng SSE kèm **Tự Động Tiếp Nối Luồng (Seamless Continuation)** khi đứt luồng giữa chừng và nhảy sang `fallbackModel` (`gemini-3.8-flash`) trên cùng key khi gặp `RATE_LIMIT_RPM` hoặc `MODEL_UNAVAILABLE` (`executor.ts`).
   - Hiện trạng kho khóa thực tế (đo ngày `16–17/11/2026`): tổng **23 key**, trong đó **3 key khỏe (`ready`, `free` tier)** đang gánh toàn bộ lưu lượng AI của ứng dụng, **20 key đang `cooldown` (`QUOTA_PROJECT_ZERO`)**, và **0 key vô hiệu (`disabled`)**. *(Lưu ý: `detectedProjectNumber` của nhiều key trong 20 key đang nguội hiện chưa biết trước cho đến khi được probe thực tế; số GCP Project khác nhau thực sự sẽ chỉ xác định được sau khi probe).*
2. **Engine Tử Vi Đẩu Số (`src/lib/ziwei/*`)**:
   - Tính toán 100% tất định (deterministic) trên trình duyệt không cần mạng: lập 12 cung, an Chính/Phụ/Tạp tinh (`algorithm.ts`), tính độ sáng sao, Các Cách Cục (`patterns.ts`), vận hạn Đại Vận / Lưu Niên / Lưu Nguyệt / Lưu Nhật (`yunxian-context.ts`, `sihua.ts`), và xuất hồ sơ ngữ cảnh tiếng Việt có cấu trúc (`vi-i18n.ts`: `formatChartSummaryVi`, `yunxian-context.ts`: `buildYunxianPeriodContext`).

### 1.2. Ba tính năng mới cần thiết kế và mối liên kết tổng thể
Ba tính năng mới tạo thành một chu trình khép kín giữa **Quản trị Hạ tầng Kho Khóa (Tính năng 1)** và **Trải nghiệm Luận Giải Chuyên Sâu Đa Tầng (Tính năng 2 & 3)**:
- **Tính năng 1 (Kiểm tra lại các khóa đang tạm nghỉ / Client-Orchestrated Cooldown Batch Re-check)**: Cung cấp công cụ kiểm chứng chủ động cho quản trị viên ngay trong `KeyPoolModal.tsx` để đánh thức sớm các khóa đã hồi phục hoặc xác nhận các khóa `QUOTA_PROJECT_ZERO` (như 20 key đang nguội hiện tại) thông qua vòng lặp client gọi route sẵn có `POST /api/key-pool/:id/test` kèm cơ chế **Nhảy cóc cùng Project có 4 kỷ luật (`Same-Project Short-Circuit`)**, tránh đốt thời gian và quota vô ích.
- **Tính năng 2 (Luận giải Lá Số Toàn Diện — "Hồ Sơ Mệnh Lý Toàn Diện" / Full Natal & Multi-Year Dossier)**: Mở rộng từ luận giải từng nhịp đơn lẻ (`InsightPanel.tsx`) sang bộ hồ sơ chuyên khảo **8 chương tuần tự** (bao phủ Tổng quan, 12 cung chia 3 nhóm theo bản v1 `Mệnh-Quan-Tài-Di`, `Phu-Tử-Điền-Phúc`, `Phụ-Huynh-Hữu-Tật`, chi tiết 2026, chi tiết 2027, tầm nhìn 5 năm `2026–2030`, và đại cục 10 năm `2026–2035`), điều phối nhịp độ an toàn trên nền tảng 3 khóa sống hiện có.
- **Tính năng 3 (Khung Chat Hỏi Đáp Chuyên Sâu — Contextual Ziwei Q&A Drawer)**: Cho phép người dùng đặt câu hỏi tương tác trực tiếp ngay sau khi xem lá số, xem luận giải vận hạn, xem Hồ Sơ Toàn Diện, hoặc xem Hợp Hôn (`HemingView.tsx`), nơi AI trả lời dựa trên **Ngữ Cảnh Ghim Chặt (Pinned Context Architecture)** thay vì suy diễn tự do, kết hợp **Hàng Rào Quota Mềm Kép** để bảo vệ kho khóa.

### 1.3. Nguyên tắc bất biến: "Engine Tính Toán Tất Định — AI Chỉ Diễn Giải Có Kiểm Soát" (Anti-Hallucination & SiHua Layer Attribution Guardrail)

**Đính chính nền tảng về bảng Tứ Hóa (`SI_HUA_TABLE`) trong code thật (`P4-01`):**
Qua đối chiếu trực tiếp `src/lib/ziwei/constants.ts` (dòng `47–58`) và `src/lib/ziwei/sihua.ts` (dòng `5–26`), bảng `SI_HUA_TABLE` của engine tuân theo quy ước mảng 4 phần tử `[Hóa Lộc, Hóa Quyền, Hóa Khoa, Hóa Kỵ]` (chỉ số `0 = Lộc`, `1 = Quyền`, `2 = Khoa`, `3 = Kỵ`):
- **Can Giáp (chỉ số `0`)**: `['廉贞', '破军', '武曲', '太阳']` → Liêm Trinh Hóa Lộc, Phá Quân Hóa Quyền, Vũ Khúc Hóa Khoa, Thái Dương Hóa Kỵ.
- **Can Canh (chỉ số `6`)**: `['太阳', '武曲', '太阴', '天同']` → **Thái Dương Hóa Lộc, Vũ Khúc Hóa Quyền, Thái Âm Hóa Khoa, Thiên Đồng Hóa Kỵ**.
- **Can Nhâm (chỉ số `8`)**: `['天梁', '紫微', '左辅', '武曲']` → **Thiên Lương Hóa Lộc, Tử Vi Hóa Quyền, Tả Phù Hóa Khoa, Vũ Khúc Hóa Kỵ**.

Do đó, trong bài luận giải Hợp Hôn thực tế của cặp **Nam Canh Ngọ 1990 (Can Canh — chỉ số `6`) & Nữ Nhâm Thân 1992 (Can Nhâm — chỉ số `8`)**:
- Các nhãn *"Thái Dương Hóa Lộc"*, *"Vũ Khúc Hóa Quyền"*, *"Thái Âm Hóa Khoa"* xuất hiện trong văn bản AI **HOÀN TOÀN ĐÚNG 100% theo quy tắc của engine** (đó chính là Hóa Lộc, Hóa Quyền, Hóa Khoa của tuổi **Canh Ngọ 1990**).
- Việc bản kế hoạch v1 (mục 1.3 cũ) nhận định rằng AI "gán nhầm Thái Dương Hóa Lộc, Vũ Khúc Hóa Quyền, Thái Âm Hóa Khoa cho Can Nhâm" là **sai lầm phân tích của bản v1** (do người viết v1 nhầm thứ tự cột trong `SI_HUA_TABLE` và nhầm dòng Can Canh thành Can Giáp).
- **Khẳng định kiến trúc bắt buộc trong bản v2:** Bảng `SI_HUA_TABLE` tại `src/lib/ziwei/constants.ts:47-58` (với dị bản Canh = Thái Dương Lộc, Vũ Khúc Quyền, Thái Âm Khoa, Thiên Đồng Kỵ; Nhâm = Thiên Lương Lộc, Tử Vi Quyền, Tả Phù Khoa, Vũ Khúc Kỵ) là **quy ước chuẩn của hệ thống Tử Vi Thiên Kỷ — TUYỆT ĐỐI KHÔNG THAY ĐỔI bảng `SI_HUA_TABLE` của engine**.

**Điểm có thể cải thiện về mặt trình bày ngữ cảnh đầu vào (mức độ Thấp — Phòng ngừa):**
1. Hiện tại, hàm `formatChartSummaryVi(chart)` (`src/lib/ziwei/vi-i18n.ts:1406`) chỉ in hậu tố ngắn gọn `s.sihua ? "(Hóa " + viSihua(s.sihua) + ")" : ""` (ví dụ: `Thái Dương (Miếu) (Hóa Lộc)`), chưa gắn nhãn tiền tố tầng `"[Bản mệnh Can Canh]"` ngay cạnh tên Hóa. Khi ghép 2 lá số trong `HemingView.tsx` hoặc ghép nhiều tầng vận hạn (Bản Mệnh + Đại Vận + Lưu Niên 5–10 năm), việc chỉ ghi `(Hóa Lộc)` có thể khiến văn phong AI diễn đạt thiếu chủ ngữ tầng (ví dụ: không nói rõ Hóa Lộc đó thuộc Bản Mệnh tuổi Canh hay thuộc Lưu Niên), dễ làm người đọc hiểu nhầm dù dữ liệu gốc không sai.
2. Khi mở rộng sang **Tính năng 2** (nhìn xuyên 12 cung + vận hạn 2026, 2027, 5 năm `2026–2030`, 10 năm `2026–2035`) và **Tính năng 3** (hỏi đáp tự do về mọi năm/cung/hợp hôn), để ngăn chặn triệt để nguy cơ AI tự tính nhẩm Can Chi, tự suy diễn sao lưu hoặc diễn đạt thiếu chủ ngữ tầng Tứ Hóa, bản v2 thiết lập **Hiến Pháp Chống Ảo Giác 3 Lớp (3-Layer Deterministic Fact-Sheet Architecture)**:
   - **Lớp 1 — Tiền tính toán Tất định (Pre-computed Fact Sheets)**: Mọi thông tin đưa vào Prompt của Tính năng 2 và Tính năng 3 đều phải được module mới `src/lib/ziwei/dossier-context.ts` tính sẵn từ `ZiweiChart` và `yunxian.ts`. AI **không bao giờ** được yêu cầu tự tìm xem cung nào có sao gì hay năm 2031 Can Tân có Tứ Hóa gì.
   - **Lớp 2 — Gắn nhãn Nguồn gốc Tứ Hóa Tường minh (Explicit SiHua Layer Prefixing)**: Trong mọi Fact Sheet mới (`dossier-context.ts` và ngữ cảnh Chat), mỗi sao có Tứ Hóa bắt buộc được in kèm nhãn tầng và Thiên Can sinh ra nó:
     - Tầng Bản Mệnh: `[Tứ Hóa Bản Mệnh - Can Canh: Thái Dương Hóa Lộc tại cung ...]`
     - Tầng Đại Vận: `[Tứ Hóa Đại Vận 34-43t - Can Nhâm: Thiên Lương Hóa Lộc tại cung ...]`
     - Tầng Lưu Niên: `[Tứ Hóa Lưu Niên 2026 Bính Ngọ - Can Bính: Thiên Đồng Hóa Lộc tại cung ...]`
     - Tầng Phi Tinh Cung: `[Phi Tinh từ Cung Mệnh (Can Giáp): Liêm Trinh Hóa Lộc nhập cung ...]`
   - **Lớp 3 — Ràng buộc Hệ thống (Hard System Prompt Guardrail)**: Mọi endpoint AI mới đều chèn khối luật cấm: *"TUYỆT ĐỐI CHỈ SỬ DỤNG danh sách sao, độ sáng, cung vị và bảng Tứ Hóa đã ghi tường minh trong khối [DỮ LIỆU LÁ SỐ TẤT ĐỊNH]. Nghiêm cấm tự suy diễn thêm Chính tinh, Phụ tinh, Tứ Hóa hoặc tự đổi Can Chi năm ngoài bảng dữ liệu được cấp. Khi nhắc đến bất kỳ sao Hóa Lộc/Quyền/Khoa/Kỵ nào, phải nêu rõ thuộc tầng nào (Bản Mệnh, Đại Vận hay Lưu Niên năm nào)."*

---

## MỤC 2 — THIẾT KẾ CHI TIẾT TÍNH NĂNG 1: KIỂM TRA LẠI CÁC KHÓA ĐANG TẠM NGHỈ (COOLDOWN BATCH RE-CHECK)

### 2.1. Phân tích hiện trạng trong Codebase
- Trong `server/key-pool/types.ts`: Mỗi `GeminiKeyRecord` có `status: 'active' | 'cooldown' | 'disabled_invalid'`, `cooldownUntil: number | null`, `lastErrorReason: FailureReason | null`, `detectedProjectNumber: string | null`, và `modelCooldowns?: Record<string, number>`.
- Trong `server/key-pool/allocator.ts`:
  - Ngoài các key có `record.status === 'cooldown'`, còn có các key đang có `record.status === 'active'` nhưng bị treo ở tầng cặp `(Key, Model)` trong `record.modelCooldowns[defaultModel] > now` (do cơ chế cooldown theo cặp `(Key, Model)` ở Pha B).
  - Hàm `testSingleKey(id)` trong `server/key-pool/index.ts` (dòng `199–282`) hiện kiểm tra chặn tần suất mỗi key 10 giây:
    ```ts
    if (record.lastProbedAt && Date.now() - record.lastProbedAt < 10_000) {
      throw new Error('Vui lòng đợi 10 giây giữa các lần kiểm tra cùng một khóa.');
    }
    ```
  - Khi probe 1 key qua `POST /api/key-pool/:id/test`:
    - Nếu thành công: gọi `allocator.markProbeSuccess(id, latencyMs)` → xóa `cooldownUntil`, xóa `modelCooldowns`, đặt `status = 'active'`, nâng `healthScore = Math.max(healthScore, 95 - latencyPenalty)`.
    - Nếu thất bại: gọi `allocator.markFailure(id, reason, message, retryAfterSec, projectNumber, targetModel)` → **cập nhật lại `cooldownUntil = now + cooldownMs` tính từ thời điểm vừa probe** (ví dụ: nếu vẫn bị `QUOTA_PROJECT_ZERO`, thời gian nguội 6 giờ sẽ bị tính lại từ thời điểm vừa kiểm tra).

### 2.2. Định nghĩa tập khóa mục tiêu ("Khóa đang tạm nghỉ / cần kiểm tra lại")
Để tránh bỏ sót các khóa bị nghẽn ngầm ở tầng model, tập khóa mục tiêu của tính năng **"Kiểm tra các khóa tạm nghỉ"** bao gồm:
1. **Nhóm A (Cooldown toàn khóa)**: Các khóa có `status === 'cooldown'` (bất kể `cooldownUntil` còn bao lâu).
2. **Nhóm B (Cooldown cấp Model mặc định)**: Các khóa có `status === 'active'` nhưng `activeModelCooldowns.includes(config.defaultModel)` (tức model mặc định đang bị phạt nguội trên khóa đó).
3. **Loại trừ mặc định**: Các khóa `status === 'disabled_invalid'` (`AUTH_INVALID_KEY` / `PERMISSION_DENIED`) không nằm trong lần chạy mặc định vì key sai/bị thu hồi không tự sống lại; tuy nhiên có thể bật tùy chọn phụ (checkbox `"Bao gồm cả khóa lỗi xác thực (disabled_invalid)"`) nếu người dùng vừa bật lại Billing/API trên Google Cloud Console.

### 2.3. Thiết kế Backend: Mở rộng `testSingleKey` & Endpoint `POST /api/key-pool/test-cooldown` (Kèm 4 Kỷ Luật Cứng)

#### Phương án kiến trúc Backend (Khuyến nghị trong `QĐ-F1`):
Kết hợp **cả hai đường** nhưng dùng chung 1 hàm lõi điều phối tại `server/key-pool/index.ts`:
1. **Nâng cấp `testSingleKey(id, options?: { bypassDebounce?: boolean; targetModel?: string })`**:
   - Khi `options?.bypassDebounce === true` (chỉ được truyền nội bộ từ bộ điều phối batch sau khi đã qua xác thực quản trị viên, hoặc khi `Date.now() - record.lastProbedAt >= 1_000`), cho phép vượt qua rào `10_000ms` nhưng vẫn giữ **sàn an toàn tối thiểu `1_000ms`** trên cùng 1 key để chống spam đúp chuột.
2. **Thêm phương thức `testCooldownKeys(options?: { includeDisabled?: boolean; keyIds?: string[]; respectProjectShortCircuit?: boolean })` trong `GeminiKeyPoolManager` (`server/key-pool/index.ts`)** và gắn vào route mới **`POST /api/key-pool/test-cooldown`** trong `server.ts`.

#### 4 Kỷ Luật Cứng của Thuật Toán `Same-Project Short-Circuit` (`P2-01` — Bắt buộc tuân thủ):
Trong thực tế, kho khóa của người dùng thường có nhiều key thuộc cùng một Google Cloud Project (ví dụ: 7 key lỗi hiện tại chỉ thuộc 4 `project_number`). Khi chạy `testCooldownKeys`:

1. **Kỷ luật (a) — Chỉ nhảy cóc trên lỗi Quota cấp Project (`PROJECT_SCOPED_QUOTA_REASONS`)**:
   - Định nghĩa hằng số bất biến:
     ```ts
     const PROJECT_SCOPED_QUOTA_REASONS: ReadonlySet<FailureReason> = new Set([
       'QUOTA_PROJECT_ZERO',
       'QUOTA_DAILY_EXHAUSTED',
       'RATE_LIMIT_RPM',
     ]);
     ```
   - **CHỈ KHI** một key thất bại với `reason` nằm trong `PROJECT_SCOPED_QUOTA_REASONS` và có `detectedProjectNumber` khác `null`, thuật toán mới ghi nhận `failedProjects.set(projectNumber, { reason, message, retryAfterSec, sourceKeyMasked: record.maskedKey })` để nhảy cóc các key còn lại cùng `projectNumber` trong lô đó.
   - **TUYỆT ĐỐI KHÔNG nhảy cóc** với:
     - `NETWORK_OR_5XX` (lỗi mạng thoáng qua hoặc 500/502/504 cục bộ).
     - `MODEL_UNAVAILABLE` (lỗi quá tải cụm GPU `503 UNAVAILABLE` tức thời của Google).
     - `AUTH_INVALID_KEY` / `PERMISSION_DENIED` (lỗi của riêng từng key cá biệt; 1 key bị xóa không có nghĩa các key khác trong cùng Project bị hỏng).
2. **Kỷ luật (b) — Xử lý an toàn đối với khóa chưa biết Project (`detectedProjectNumber === null`)**:
   - Mọi khóa có `detectedProjectNumber === null` (hoặc chuỗi rỗng) **LUÔN LUÔN phải được gọi `testSingleKey` độc lập**, không bao giờ bị khớp vào `failedProjects`.
   - Khóa có `detectedProjectNumber === null` **không bao giờ được tính vào bộ đếm `Skipped (Nhảy cóc cùng Project)`**.
   - Nếu trong lần probe này Google trả về lỗi có chứa chuỗi `project_number:...`, parser sẽ trích xuất và lưu `detectedProjectNumber` cho khóa đó để phục vụ các lần sau.
3. **Kỷ luật (c) — Minh bạch hóa hành vi tính lại thời gian nguội (`cooldownUntil = now + cooldownMs`) khi Probe thất bại**:
   - Khi một khóa đang `cooldown` được kiểm tra lại nhưng vẫn báo lỗi (hoặc bị đánh dấu dây chuyền qua `Same-Project Short-Circuit`), hàm `allocator.markFailure(...)` sẽ **cập nhật lại `cooldownUntil = Date.now() + cooldownMs` tính từ thời điểm vừa kiểm tra**.
   - Cụ thể:
     - Nếu lỗi vẫn là `QUOTA_PROJECT_ZERO`, thời gian tạm nghỉ sẽ đặt lại thành **`now + 6 giờ`** (360 phút).
     - Nếu lỗi vẫn là `QUOTA_DAILY_EXHAUSTED`, thời gian tạm nghỉ đặt lại thành **`now + 2 giờ`** (120 phút).
     - Nếu lỗi là `RATE_LIMIT_RPM`, thời gian tạm nghỉ đặt lại thành **`now + 10..30 giây`** (hoặc `5..60 giây` theo `RetryInfo`).
   - Hành vi này là đúng đắn về mặt kỹ thuật (vì vừa xác nhận tức thì rằng tại thời điểm `now`, Project/Key đó vẫn đang cạn quota hoặc `limit: 0`), nhưng **bắt buộc phải hiển thị dòng lưu ý rõ ràng trên UI** trước và sau khi bấm để người dùng không hiểu nhầm là lỗi hiển thị đồng hồ đếm ngược.
4. **Kỷ luật (d) — Bảo mật xác thực Admin PIN & Kiểm soát `bypassDebounce` (`P2-02`)**:
   - Route `POST /api/key-pool/test-cooldown` bắt buộc đặt sau chốt chặn `if (!requireKeyPoolWriteAccess(req, res)) return;` (kiểm tra header `x-admin-pin` khi biến môi trường `KEY_POOL_ADMIN_PIN` được cấu hình, giống hệt `POST /api/key-pool/:id/test` và `DELETE /api/key-pool/:id`).
   - Cờ `bypassDebounce` chỉ tồn tại trong hàm nội bộ `keyPool.testCooldownKeys(...)` ở tầng server (không mở thành query/body parameter tùy ý trên public API) và luôn áp sàn tối thiểu `1_000ms/key`, kèm nhịp nghỉ tuần tự `350ms` giữa 2 lần gọi mạng thật để tránh tạo burst request.

#### Cấu trúc Response của `POST /api/key-pool/test-cooldown`:
```ts
export interface CooldownBatchTestItemResult {
  id: string;
  label: string;
  maskedKey: string;            // Luôn ở dạng AIzaSy••••••xxxx, tuyệt đối không lộ raw key
  previousStatus: KeyStatus;
  newStatus: KeyStatus;
  outcome: 'recovered' | 'still_failing' | 'skipped_same_project';
  reason: FailureReason | null;
  message: string;
  latencyMs: number | null;
  detectedProjectNumber: string | null;
  newCooldownUntil: number | null; // Timestamp mới (now + cooldownMs nếu vẫn lỗi)
}

export interface CooldownBatchTestResponse {
  totalTargeted: number;
  probedCount: number;          // Số lần thực sự gọi mạng tới Gemini API
  recoveredCount: number;       // Số khóa sống lại -> active
  stillFailingCount: number;    // Số khóa gọi mạng thật nhưng vẫn lỗi
  skippedSameProjectCount: number; // Số khóa nhảy cóc nhờ phát hiện cùng Project bị lỗi Quota
  results: CooldownBatchTestItemResult[];
  snapshot: KeyPoolDashboardSnapshot; // Snapshot mới nhất để UI cập nhật trong 1 lượt
}
```

### 2.4. Thiết kế Giao diện & Trải nghiệm Người dùng trong `src/components/KeyPoolModal.tsx`
1. **Vị trí đặt nút điều khiển**:
   - Trên thanh công cụ của mục **"Danh Sách Khóa Trong Kho"** (cạnh bộ lọc và nút *"Đồng bộ lại biến môi trường"*), thêm nút nổi bật:
     - Nhãn: **`Kiểm tra lại các khóa tạm nghỉ (N)`** (trong đó `N` là tổng số khóa đang `cooldown` hoặc đang bị `activeModelCooldowns` trên `defaultModel`).
     - Khi `N === 0`: Nút chuyển sang trạng thái disabled với chú thích *"Tất cả khóa hợp lệ đều đang sẵn sàng"*.
   - Có một dòng lưu ý nhỏ ngay dưới nút (hoặc trong tooltip):
     - *"Lưu ý: Khóa vượt qua kiểm tra sẽ kích hoạt ngay (`active`). Khóa vẫn lỗi sẽ tính lại thời gian tạm nghỉ từ thời điểm kiểm tra (ví dụ: 6h với lỗi `limit: 0`)."*
2. **Hiển thị Tiến trình & Bảng Kết Quả Tóm Tắt (`CooldownBatchReportBanner`)**:
   - Để người dùng thấy tiến trình nhảy từng khóa thời gian thực và **có thể bấm nút `"Dừng kiểm tra"` giữa chừng**, UI tuần tự gọi `POST /api/key-pool/:id/test` cho từng khóa mục tiêu (với danh sách khóa đã được lọc nhảy cóc cùng Project ngay trên client dựa vào `detectedProjectNumber` trả về sau mỗi bước **CHỈ KHI** `reason` thuộc 3 lỗi quota cấp Project `QUOTA_PROJECT_ZERO | QUOTA_DAILY_EXHAUSTED | RATE_LIMIT_RPM`; các khóa có `detectedProjectNumber === null` luôn được kiểm tra độc lập), hoặc gọi `POST /api/key-pool/test-cooldown` khi muốn chạy gọn 1 lệnh từ server.
   - Hiển thị thanh trạng thái trực quan ngay đầu danh sách khóa với **4 con số thống kê chuẩn**:
     - **Đã thử mạng thật (`Probed`)**: ví dụ `4`
     - **Đã hồi phục (`Recovered`)**: ví dụ `0` (màu xanh ngọc `emerald`)
     - **Vẫn lỗi (`Still Failing`)**: ví dụ `4` (màu hổ phách/đỏ `amber`/`rose`)
     - **Nhảy cóc cùng Project (`Skipped`)**: ví dụ `3` (màu tím/xám kèm chú thích *"Tiết kiệm 3 lượt gọi API do trùng Project đang cạn quota"*)
   - Mỗi dòng kết quả liệt kê rõ: `maskedKey`, `label`, kết quả (`Đã kích hoạt lại` / `Vẫn lỗi: QUOTA_PROJECT_ZERO (đặt lại nguội 6h)` / `Bỏ qua do trùng Project #357517067785`), và độ trễ `latencyMs`.

---

## MỤC 3 — THIẾT KẾ CHI TIẾT TÍNH NĂNG 2: LUẬN GIẢI LÁ SỐ TOÀN DIỆN ("HỒ SƠ MỆNH LÝ TOÀN DIỆN" — 8 CHƯƠNG)

### 3.1. Tại sao bắt buộc phải Chia Chương Tuần Tự (Sequential Multi-Chapter Architecture) thay vì 1 Prompt Khổng Lồ?
1. **Trần Output Token & Suy giảm chất lượng (Attention Dilution)**:
   - Một bài luận giải toàn diện thực thụ (bao gồm Tổng quan cách cục, phân tích sâu từng cung trong 12 cung, vận hạn chi tiết 2026, 2027, lộ trình 5 năm `2026–2030` và đại cục 10 năm `2026–2035`) cần tổng độ dài khoảng **`7,400 – 10,300 từ` tiếng Việt** (tương đương **`~11,500 – 16,000 output tokens`**).
   - Nếu nhồi vào 1 lần gọi `generateContentStream`, model Flash/Flash-Lite sẽ tự rút gọn (viết lướt mỗi cung chỉ 2–3 câu sáo rỗng) hoặc chạm trần `maxOutputTokens` gây cụt bài.
2. **Bảo vệ luồng SSE trước lỗi `503 UNAVAILABLE` & `AbortError (code=20)`**:
   - Qua thực nghiệm trong `docs/stream-interruption-diagnosis.md`, một luồng stream kéo dài quá 45–60 giây có xác suất cao gặp `503 UNAVAILABLE` hoặc `AbortError (code=20)` từ phía Google/Node fetch. Chia thành **8 chương độc lập**, mỗi chương dài `800 – 1,400 từ` (`~1,200 – 2,100 output tokens`), giúp mỗi lần stream kết thúc gọn và kết hợp mượt mà với cơ chế **Seamless Continuation** sẵn có trong `executor.ts`.
3. **Lưu Cache Từng Chương Độc Lập (`Per-Chapter Incremental Cache`)**:
   - Ngay khi Chương $k$ hoàn tất (`!interrupted`), chương đó được lưu ngay vào `localStorage` + `IndexedDB`. Nếu người dùng bấm `"Tạm dừng"` ở Chương 5 hoặc mạng đứt hoàn toàn, **4 chương đầu đã nằm an toàn trong bộ nhớ đệm**; khi bấm `"Tiếp tục tạo các chương còn thiếu"`, hệ thống chỉ chạy tiếp từ Chương 5.

### 3.2. Cấu trúc Chuẩn 8 Chương của "Hồ Sơ Mệnh Lý Toàn Diện" & Sàn Số Từ Bắt Buộc (`P1-02`)

Để giải quyết triệt để mâu thuẫn giữa yêu cầu phân tích sâu từng cung và giới hạn số từ (đã chỉ ra tại `P1-02`), các Chương 2, 3, 4 (mỗi chương gồm 4 cung) áp dụng **sàn tối thiểu bắt buộc `250–350 từ/cung`**, nâng tổng độ dài mỗi chương nhóm cung lên **`1,000–1,400 từ/chương`**.

| Thứ tự | Mã chương (`sectionId`) | Tiêu đề chương hiển thị | Nội dung cốt lõi & Các cung / giai đoạn bao phủ | Sàn độ dài mỗi đơn vị | Độ dài mục tiêu toàn chương |
|---|---|---|---|---|---|
| **Chương 1** | `chapter_overview` | **Chương I — Tổng Quan Cốt Cách, Mệnh Cục & Tam Phương Cốt Lõi** | Âm Dương Thuận/Nghịch lý, Cục khắc/sinh Mệnh, Chủ Mệnh - Chủ Thân, Thế đứng Chính tinh המרכזי, Các Cách Cục lớn (Thượng/Trung/Phá cách) từ `patterns.ts`, Tứ Hóa Bản Mệnh (`natalSihua`) và điểm tựa cuộc đời. | Toàn chương | `800 – 1,100 từ` |
| **Chương 2** | `chapter_palaces_core` | **Chương II — Tam Hợp Mệnh · Tài Bạch · Quan Lộc & Cung Thiên Di** | Phân tích chuyên sâu 4 cung trụ cột sự nghiệp - tiền tài - xuất ngoại: **(1) Mệnh**, **(2) Thân** (lồng ghép tại cung cư Thân), **(3) Tài Bạch**, **(4) Quan Lộc**, **(5) Thiên Di**. Nêu rõ Chính/Phụ tinh, độ sáng, Tam Phương Tứ Chính và Phi Tinh Tứ Hóa giữa 4 cung này. | **Tối thiểu `250–350 từ / cung`** | **`1,000 – 1,400 từ`** |
| **Chương 3** | `chapter_palaces_relations` | **Chương III — Gia Đạo, Tình Duyên & Nhân Mạch (Phu Thê · Tử Nữ · Phụ Mẫu · Huynh Đệ · Nô Bộc)** | Phân tích chuyên sâu các cung nhân duyên & hậu phương: **(1) Phu Thê**, **(2) Tử Nữ**, **(3) Phụ Mẫu**, **(4) Huynh Đệ & Nô Bộc** (gộp đối xứng trục Huynh–Nô thành 2 tiểu mục rõ ràng). | **Tối thiểu `250–350 từ / tiểu mục cung`** | **`1,000 – 1,400 từ`** |
| **Chương 4** | `chapter_palaces_foundation` | **Chương IV — Nền Tảng Nội Tâm, Điền Sản & Sức Khỏe (Phúc Đức · Điền Trạch · Tật Ách)** | Phân tích chuyên sâu 3 cung gốc rễ + tổng kết liên kết 12 cung: **(1) Phúc Đức** (gốc phước báu, tinh thần), **(2) Điền Trạch** (bất động sản, tích lũy), **(3) Tật Ách** (cơ địa, bệnh lý tiềm ẩn), **(4) Tổng kết tương tác Phi Tinh 12 cung**. | **Tối thiểu `250–350 từ / tiểu mục`** | **`1,000 – 1,400 từ`** |
| **Chương 5** | `chapter_year_2026` | **Chương V — Luận Giải Chi Tiết Lưu Niên 2026 (Bính Ngọ)** | Tương tác Bản Mệnh ↔ Đại Vận hiện tại ↔ Lưu Niên 2026 (Bính Ngọ: Thiên Đồng Hóa Lộc, Thiên Cơ Hóa Quyền, Văn Xương Hóa Khoa, Liêm Trinh Hóa Kỵ). Phân tích Công danh, Tài chính, Tình cảm, Sức khỏe và các tháng trọng điểm trong năm 2026. *(Đồng bộ 2 chiều với cache `InsightPanel`)* | Toàn chương | `900 – 1,200 từ` |
| **Chương 6** | `chapter_year_2027` | **Chương VI — Luận Giải Chi Tiết Lưu Niên 2027 (Đinh Mùi)** | Tương tác Bản Mệnh ↔ Đại Vận ↔ Lưu Niên 2027 (Đinh Mùi: Thái Âm Hóa Lộc, Thiên Đồng Hóa Quyền, Thiên Cơ Hóa Khoa, Cự Môn Hóa Kỵ). So sánh nhịp chuyển giao từ 2026 sang 2027, cơ hội bứt phá và rủi ro cần phòng vệ. *(Đồng bộ 2 chiều với cache `InsightPanel`)* | Toàn chương | `900 – 1,200 từ` |
| **Chương 7** | `chapter_plan_5y_2026_2030` | **Chương VII — Chiến Lược & Dự Báo Chi Tiết 5 Năm (2026 – 2030)** | Phân tích bảng ma trận 5 năm liên tiếp (`2026 Bính Ngọ`, `2027 Đinh Mùi`, `2028 Mậu Thân`, `2029 Kỷ Dậu`, `2030 Canh Tuất`). Xác định năm đỉnh cao (Peak Year), năm trũng (Trough Year), nhịp chuyển Đại Vận (nếu có trong 5 năm) và lộ trình hành động từng năm. | Tối thiểu `150–200 từ / năm` + Tổng kết chiến lược | `900 – 1,200 từ` |
| **Chương 8** | `chapter_macro_10y_2026_2035` | **Chương VIII — Đại Cục 10 Năm (2026 – 2035) & Kim Chỉ Nam Hành Động** | Nhìn tổng thể thập kỷ `2026–2035` qua 2 giai đoạn 5 năm (`2026–2030` và `2031–2035`), sự chuyển giao giữa các Đại Vận 10 năm, chu kỳ vận khí tài lộc - sự nghiệp - gia đạo, và bảng tổng kết kim chỉ nam ứng xử cho mệnh chủ. | Toàn chương | `900 – 1,200 từ` |

### 3.3. Ranh giới Prompt & Đồng bộ Bộ Nhớ Đệm giữa Chương 1, Chương 5, Chương 6 và `InsightPanel.tsx` (`P1-03`)

Một phát hiện kỹ thuật quan trọng từ vòng phản biện (`P1-03`):
- Trong `src/components/InsightPanel.tsx` hiện tại, tab **"Tổng Quan Bản Mệnh"** (`activeTab === 'overview'`) đang hiển thị trực tiếp kết quả của hàm tĩnh `generateLocalInterpretationVi(chart)` (`src/lib/ziwei/vi-i18n.ts:742`) mà **chưa từng gọi AI**.
- Trong khi đó, tab **"Luận Giải Vận Hạn"** (`activeTab === 'period'`) gọi `POST /api/interpret-period` và lưu kết quả AI vào `localStorage` + `IndexedDB` theo khóa `ziwei_period_insight_${chartSig}_${daxianIdx}_${liunianYear}_all_all` (phiên bản `PERIOD_CACHE_VERSION = 'v5'`).

Do đó, bản v2 quy định ranh giới minh bạch tuyệt đối như sau:
1. **Đối với Chương 1 (`chapter_overview`)**:
   - **TUYỆT ĐỐI KHÔNG** lấy văn bản tĩnh từ `generateLocalInterpretationVi(chart)` để đóng giả làm Chương 1 của Hồ Sơ AI.
   - Chương 1 bắt buộc gọi `POST /api/interpret-dossier-section` với `sectionId: 'chapter_overview'` và sử dụng Fact Sheet chuyên biệt `buildNatalOverviewFactSheetVi(chart)` (nằm trong `src/lib/ziwei/dossier-context.ts`, bao gồm: thông tin Mệnh–Thân–Cục, Âm Dương thuận/nghịch lý, danh sách Cách Cục từ `patterns.ts`, bảng Tứ Hóa Bản Mệnh có tiền tố tầng `[Tứ Hóa Bản Mệnh - Can ...]`, và tóm tắt Tam Phương Tứ Chính của cung Mệnh/Thân).
2. **Đối với Chương 5 (`chapter_year_2026`) và Chương 6 (`chapter_year_2027`)**:
   - Hai chương này có bản chất nghiệp vụ trùng khớp 100% với bài luận giải Lưu Niên năm `2026` và `2027` (cấp độ Năm — `liuyueIndex = null`, `liuriIndex = null`) trong `InsightPanel.tsx`.
   - **Đồng bộ 2 chiều qua `buildYunxianPeriodContext` và `POST /api/interpret-period`**:
     - Trước khi tạo Chương 5 (`2026`) hoặc Chương 6 (`2027`), bộ điều phối `FullDossierModal` kiểm tra kho cache `ziwei_period_insight_${chartSig}_${daxianOf2026}_2026_all_all` (và tương tự cho `2027`).
     - Nếu trong cache đã có bản luận giải **hoàn chỉnh (`!interrupted`, độ dài `>= 1,500 ký tự`)**: hệ thống **tái sử dụng ngay lập tức (`0ms`, tốn `0 API request`)** và gắn huy hiệu nguồn gốc tường minh:
       - `sourceBadge: "Kế thừa từ bộ nhớ đệm Luận Giải Vận Hạn (tiết kiệm 1 lượt gọi AI)"`
       - Đồng thời cung cấp nút nhỏ **`"Tạo mới lại chương này"`** ngay trên tiêu đề Chương 5 / Chương 6 nếu người dùng muốn ép AI viết lại.
     - Ngược lại, nếu chưa có trong cache: `FullDossierModal` gọi `POST /api/interpret-period` (với `periodContext = buildYunxianPeriodContext(chart, daxianIdx, 2026)`), và khi stream hoàn tất sẽ **ghi vào cả 2 nơi** (kho Hồ Sơ Toàn Diện và kho `ziwei_period_insight_...`), kèm huy hiệu:
       - `sourceBadge: "Vừa phân tích mới bằng AI (đã đồng bộ sang tab Vận Hạn)"`

### 3.4. Thiết kế Module Ngữ Cảnh Tất Định Đa Năm `src/lib/ziwei/dossier-context.ts` & Chuẩn Hóa Ma Trận 5 Năm / 10 Năm (`P1-01`)

Để đảm bảo AI phân tích chính xác từng cung và từng năm trong giai đoạn `2026–2035` mà không bao giờ bịa sao hay sót Tứ Hóa Lưu Niên, ta thiết kế module thuần TypeScript `src/lib/ziwei/dossier-context.ts` với **tập trường tối thiểu bắt buộc** cho mọi dòng năm:

```ts
export interface SiHuaStarDetailVi {
  starNameVi: string;           // VD: "Thiên Đồng"
  transformTypeVi: 'Hóa Lộc' | 'Hóa Quyền' | 'Hóa Khoa' | 'Hóa Kỵ';
  targetPalaceNameVi: string;   // Cung có sao đó tọa thủ (VD: "Tài Bạch")
  targetBranchVi: string;       // Địa chi cung đó (VD: "Thân")
  clashedPalaceNameVi: string;  // Cung xung chiếu chịu ảnh hưởng trực tiếp (VD: "Phúc Đức")
  clashedBranchVi: string;      // Địa chi cung xung chiếu (VD: "Dần")
}

export interface GoverningDaXianSummaryVi {
  daxianIndex: number;
  ageRange: string;             // VD: "34 - 43 tuổi"
  yearRange: string;            // VD: "2023 - 2032"
  palaceNameVi: string;         // Cung Đại Vận (VD: "Điền Trạch")
  stemVi: string;               // Thiên Can Đại Vận (VD: "Nhâm")
  branchVi: string;             // Địa chi Đại Vận (VD: "Tý")
  majorStarsVi: string[];       // Chính tinh tại cung Đại Vận
  daxianSiHuaSummaryVi: string; // Đủ 4 Hóa của Can Đại Vận kèm tiền tố "[Tứ Hóa Đại Vận]"
}

/**
 * 1. Cấu trúc Ma Trận Chi Tiết 5 Năm (Chương 7: 2026 - 2030)
 * Bắt buộc đầy đủ cả 4 Hóa (Lộc/Quyền/Khoa/Kỵ) và Đại Vận chủ quản trên mỗi năm.
 */
export interface YearlyForecastMatrixRowVi {
  gregorianYear: number;        // VD: 2026
  lunarStemVi: string;          // VD: "Bính"
  lunarBranchVi: string;        // VD: "Ngọ"
  lunarGanZhiVi: string;        // VD: "Bính Ngọ"
  nominalAge: number;           // Tuổi âm lịch (hoặc tuổi theo quy ước lá số)
  isDaXianTransitionYear: boolean; // True nếu năm này là năm đầu tiên chuyển sang Đại Vận mới
  governingDaXian: GoverningDaXianSummaryVi; // Đại Vận chủ quản năm đó
  liuNianMingPalace: {
    branchVi: string;           // Địa chi cung Lưu Niên Mệnh (VD: "Ngọ")
    natalPalaceNameVi: string;  // Trùng với cung Bản Mệnh nào (VD: "Thiên Di")
    majorStarsVi: string[];     // Chính tinh + độ sáng tại cung Lưu Niên Mệnh
    minorStarsVi: string[];     // Phụ tinh quan trọng tại cung Lưu Niên Mệnh
  };
  liuNianQianYiPalace: {        // Cung Lưu Niên Thiên Di (xung chiếu Lưu Niên Mệnh)
    branchVi: string;
    natalPalaceNameVi: string;
    majorStarsVi: string[];
  };
  liuNianCaiBoPalace: {         // Cung Lưu Niên Tài Bạch
    branchVi: string;
    natalPalaceNameVi: string;
    majorStarsVi: string[];
  };
  liuNianGuanLuPalace: {        // Cung Lưu Niên Quan Lộc
    branchVi: string;
    natalPalaceNameVi: string;
    majorStarsVi: string[];
  };
  liuNianFuQiPalace: {          // Cung Lưu Niên Phu Thê
    branchVi: string;
    natalPalaceNameVi: string;
    majorStarsVi: string[];
  };
  liuNianSiHua: {               // BẮT BUỘC đủ 4 Hóa của Thiên Can năm đó
    loc: SiHuaStarDetailVi;
    quyen: SiHuaStarDetailVi;
    khoa: SiHuaStarDetailVi;
    ky: SiHuaStarDetailVi;
  };
  keyOverlaysVi: string[];      // Các điểm trùng điệp trọng yếu (VD: "Song Kỵ tại Quan Lộc (Dần)", "Song Lộc hội Tài Bạch")
}

/**
 * 2. Cấu trúc Ma Trận Rút Gọn 10 Năm (Chương 8: 2026 - 2035)
 * Vẫn BẮT BUỘC giữ đủ 4 sao Lưu Niên Tứ Hóa (Lộc/Quyền/Khoa/Kỵ) và Đại Vận chủ quản
 * dưới dạng chuỗi nén chuẩn hóa để tiết kiệm token mà không rơi rớt dữ liệu.
 */
export interface TenYearCompactMatrixRowVi {
  gregorianYear: number;        // 2026 .. 2035
  lunarGanZhiVi: string;        // VD: "Bính Ngọ"
  nominalAge: number;
  governingDaXianCompactVi: string; // VD: "ĐV 34-43t tại Điền Trạch (Nhâm Tý)"
  isDaXianTransitionYear: boolean;
  liuNianMingCompactVi: string; // VD: "LN Mệnh tại Ngọ (trùng Bản Mệnh Thiên Di: Tử Vi Miếu, Thiên Phủ Vượng)"
  liuNianCoreTrineCompactVi: string; // Tóm tắt Chính tinh tại LN Tài Bạch & LN Quan Lộc
  liuNianSiHuaCompactVi: {      // BẮT BUỘC đủ cả 4 Hóa kèm cung tọa & cung xung
    locVi: string;              // VD: "[LN 2026 Can Bính] Thiên Đồng Hóa Lộc tại Tài Bạch (Thân) -> chiếu Phúc Đức (Dần)"
    quyenVi: string;            // VD: "[LN 2026 Can Bính] Thiên Cơ Hóa Quyền tại Tử Nữ (Mùi) -> chiếu Điền Trạch (Sửu)"
    khoaVi: string;             // VD: "[LN 2026 Can Bính] Văn Xương Hóa Khoa tại Mệnh (Tý) -> chiếu Thiên Di (Ngọ)"
    kyVi: string;               // VD: "[LN 2026 Can Bính] Liêm Trinh Hóa Kỵ tại Quan Lộc (Thìn) -> xung Phu Thê (Tuất)"
  };
  criticalAlertsVi: string[];   // Cảnh báo ngắn: "Chuyển Đại Vận mới", "Kỵ trùng Kỵ tại Phu Thê", v.v.
}
```

**Luật Cấm Suy Diễn Ngoài Trường Ma Trận (Bắt buộc nhúng vào Prompt Chương 7 và Chương 8):**
> *"QUY TẮC TỐI THƯỢNG CHO PHÂN TÍCH ĐA NĂM (2026–2035): Với mỗi năm từ 2026 đến 2035, bạn CHỈ ĐƯỢC PHÉP trích dẫn Thiên Can Địa Chi, Đại Vận chủ quản, cung Lưu Niên Mệnh/Tài/Quan/Phu và 4 sao Lưu Niên Tứ Hóa (Lộc, Quyền, Khoa, Kỵ) có mặt trực tiếp trong dòng dữ liệu của năm đó tại bảng Ma Trận. TUYỆT ĐỐI CẤM tự tính nhẩm vị trí sao Lưu Thái Tuế, Lưu Lộc Tồn, Lưu Kình Đà hay bất kỳ sao nào không được in trong bảng Ma Trận."*

### 3.5. Thiết kế Endpoint `POST /api/interpret-dossier-section` & Cơ chế Điều Phối Tuần Tự, Tạm Dừng, Tiếp Tục

1. **Endpoint `POST /api/interpret-dossier-section` trong `server.ts`**:
   - **Body Request**:
     ```ts
     interface InterpretDossierSectionRequest {
       sectionId:
         | 'chapter_overview'
         | 'chapter_palaces_core'
         | 'chapter_palaces_relations'
         | 'chapter_palaces_foundation'
         | 'chapter_plan_5y_2026_2030'
         | 'chapter_macro_10y_2026_2035';
       chartSummaryVi: string;       // Tóm tắt lá số chuẩn có tiền tố tầng Tứ Hóa
       sectionFactSheetVi: string;   // Fact sheet chuyên biệt của chương đó từ dossier-context.ts
     }
     ```
     *(Lưu ý: Chương 5 `chapter_year_2026` và Chương 6 `chapter_year_2027` gọi trực tiếp `POST /api/interpret-period` để dùng chung logic và cache với `InsightPanel`).*
   - **Luồng thực thi & Bảo vệ SSE**:
     - Đi qua `keyPool.executeStream(...)` tương tự `/api/interpret-period`, thừa hưởng toàn bộ cơ chế:
       - Heartbeat SSE `: keepalive\n\n` mỗi 15 giây.
       - Tự động thử `fallbackModel` (`gemini-3.8-flash`) trên cùng key khi gặp `RATE_LIMIT_RPM` hoặc `MODEL_UNAVAILABLE`.
       - Tự động Tiếp Nối Luồng (`Seamless Continuation`) nếu đứt kết nối giữa chương khi `streamedChars > 100`.
       - Sự kiện `data: {"interrupted": true, "reason": ...}` nếu mọi nỗ lực tiếp nối đều thất bại, đảm bảo client **không bao giờ lưu bản cụt vào cache**.

2. **Điều phối Tuần Tự trên Client (`src/components/FullDossierModal.tsx`)**:
   - **Chế độ tạo**:
     - **Chế độ 1 (Tạo trọn bộ 8 chương tự động)**: Chạy tuần tự từ Chương 1 đến Chương 8. Giữa lúc kết thúc chương $k$ (có gọi API thật) và bắt đầu chương $k+1$, bộ điều phối nghỉ **`2,200ms` (`DOSSIER_INTER_CHAPTER_PACING_MS = 2200`)** để giảm áp lực burst RPM lên 3 key sống và cho phép kết nối TCP/TLS trước đó đóng sạch.
     - **Chế độ 2 (Tạo / Tạo lại từng chương theo yêu cầu)**: Người dùng có thể bấm vào bất kỳ chương nào trong Mục lục để chỉ tạo riêng chương đó hoặc bấm `"Tiếp tục tạo các chương còn thiếu"`.
   - **Kiểm soát Tạm dừng / Hủy / Tiếp tục**:
     - Sử dụng `AbortController` gắn với chương đang chạy.
     - Nút **`"Tạm dừng sau chương này"`** (mặc định an toàn: chờ chương đang stream chạy nốt vài giây cuối rồi dừng lại để không lãng phí token vừa sinh) và nút **`"Hủy ngay lập tức"`** (gọi `abortController.abort()`).
   - **In ấn / Xuất báo cáo (`Print / PDF` & `Markdown`)**:
     - Cho phép xuất ngay cả khi mới tạo xong một phần (ví dụ: 4/8 chương) kèm nhãn trạng thái chương, hoặc xuất trọn bộ 8 chương với bảng mục lục và định dạng `@media print` chuẩn.

### 3.6. Ước Lượng Thời Gian Thực Tế 3 Kịch Bản & Quản Trị Rủi Ro Đứt Luồng (`P4-02`)

Thay thế ước lượng lý tưởng hóa của bản v1 bằng **Bảng Ước Lượng Thời Gian Thực Tế 3 Kịch Bản** dựa trên số đo thực nghiệm ngày `16–17/11/2026` trong `docs/stream-interruption-diagnosis.md`:

| Kịch bản vận hành | Giả định hạ tầng & Cache | Thời gian trung bình / chương (gọi AI) | Tổng thời gian hoàn tất Hồ sơ 8 chương | Trải nghiệm người dùng & Cơ chế bảo vệ |
|---|---|---|---|---|
| **1. Kịch bản Thuận Lợi (Optimistic)** | Đã có sẵn cache Chương 5 (`2026`) và Chương 6 (`2027`) từ tab Vận Hạn; chỉ cần gọi AI 6 chương còn lại; `gemini-3.5-flash-lite` phản hồi mượt ngay key đầu tiên, không gặp `503`. | `~14 – 18 giây / chương` (+ `2.2s` nghỉ giữa chương) | **`~95 – 120 giây` (`1.5 – 2.0 phút`)** | Người dùng đọc ngay Chương 1 chỉ sau **~15 giây đầu tiên**; trong lúc đọc Chương 1–2 thì các chương sau tự động hoàn tất ở hậu cảnh. |
| **2. Kịch bản Thực Tế Điển Hình (Realistic Baseline)** | Tạo mới toàn bộ 8 chương (hoặc 7 chương); có 1–2 chương gặp `503 UNAVAILABLE` hoặc `RATE_LIMIT_RPM` phải chuyển sang `gemini-3.8-flash` hoặc kích hoạt `Seamless Continuation` 1 nhịp. | `~18 – 25 giây / chương` ở chương thường; `~35 – 45 giây` ở chương có failover/nối tiếp | **`~160 – 220 giây` (`2.5 – 3.7 phút`)** | Thanh tiến trình hiển thị rõ `"Chương k/8 — Đang phân tích..."` (hoặc `"Đang tự động nối tiếp luồng..."`); các chương đã xong được khóa an toàn vào cache ngay lập tức. |
| **3. Kịch bản Xấu / Cao Điểm Mạng (Worst-Case High Contention)** | Cụm máy chủ Google `503 UNAVAILABLE` diện rộng hoặc đứt socket `AbortError (code=20)` liên hoàn trên nhiều chương (như lần đo `60.2s` trong báo cáo chẩn đoán). | `~35 – 60 giây / chương` có sự cố; có khả năng 1 chương bị `interrupted: true` sau khi thử hết 3 key sống | **`~270 – 360 giây` (`4.5 – 6.0 phút`)** hoặc tạm dừng ở chương bị ngắt | Mọi chương hoàn tất trước đó (`1 .. k-1`) **không bao giờ bị mất**. Tại chương bị ngắt, hiện nút **`"Thử lại chương này & Tiếp tục các chương còn thiếu"`** để chạy tiếp chỉ phần còn thiếu. |

---

## MỤC 4 — THIẾT KẾ CHI TIẾT TÍNH NĂNG 3: KHUNG CHAT HỎI ĐÁP CHUYÊN SÂU (CONTEXTUAL ZIWEI Q&A DRAWER)

### 4.1. Kiến trúc Ngữ Cảnh Ghim Chặt (Pinned Context Architecture) & Tối Ưu Token Đa Lượt (`P4-04`)

Khác với chatbot thông thường, Khung Chat Hỏi Đáp của **Tử Vi Thiên Kỷ** hoạt động theo nguyên lý **Ghim Ngữ Cảnh Mệnh Lý Tường Minh (Pinned Context)**:
1. **3 Chế độ Ngữ Cảnh (`contextMode`)**:
   - `'natal'` (Lá số Bản Mệnh & 12 cung): Ghim toàn bộ cấu trúc 12 cung, Cách Cục, Tứ Hóa Bản Mệnh (có tiền tố tầng `[Tứ Hóa Bản Mệnh]`) và bài luận giải chương đang mở (nếu có).
   - `'period'` (Vận Hạn Đang Chọn): Ghim cấu trúc lá số + `buildYunxianPeriodContext` của đúng Đại Vận / Lưu Niên / Lưu Nguyệt / Lưu Nhật đang chọn trên `InsightPanel` + bài luận giải vận hạn tương ứng.
   - `'heming'` (Hợp Hôn Đôi Lứa): Ghim tóm tắt lá số Người A (kèm nhãn tầng `[Bản Mệnh Người A - Can ...]`) + lá số Người B (`[Bản Mệnh Người B - Can ...]`) + chỉ số tương hợp ngũ hành và bài luận giải Hợp Hôn hiện tại.
2. **Nén Ngữ Cảnh & Cắt Tỉa Lịch Sử Hội Thoại (`Context Compression & Sliding Window` — Giải quyết `P4-04`)**:
   - **Cắt tỉa lịch sử (`MAX_HISTORY_TURNS = 6`)**: Mỗi request gửi lên `POST /api/chat-ziwei` chỉ đính kèm tối đa **6 cặp hỏi–đáp gần nhất** (12 messages), mỗi message giới hạn tối đa `2,500 ký tự`.
   - **Trích xuất đoạn luận giải liên quan (`Relevant Section Excerpt` tối đa `1,800 ký tự`)**: Thay vì đính kèm nguyên văn cả 8 chương Hồ Sơ Toàn Diện (`~10,000 từ`) vào mọi lượt chat, client chỉ gửi:
     - Bản tóm tắt lá số chuẩn + Ma trận rút gọn 10 năm (`TenYearCompactMatrixRowVi`, chỉ tốn `~900 tokens` nhưng giúp AI trả lời chính xác mọi câu hỏi về bất kỳ năm nào trong giai đoạn `2026–2035`).
     - Đoạn trích của chương đang mở hoặc cung/năm mà câu hỏi nhắc tới (tối đa `1,800 ký tự`).
   - Nhờ đó, tổng Input Prompt của mỗi lượt hỏi đáp luôn giữ ổn định ở mức **`~2,200 – 3,500 input tokens`**, vừa cực kỳ tiết kiệm TPM vừa giúp AI phản hồi nhanh (`TTFB ~1.5 – 3.0s`).

### 4.2. Thiết kế Endpoint `POST /api/chat-ziwei`
- **Body Request**:
  ```ts
  export interface ZiweiChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    interrupted?: boolean;
  }

  export interface ZiweiChatRequest {
    contextMode: 'natal' | 'period' | 'heming';
    pinnedFactSheetVi: string;      // Dữ liệu lá số + Ma trận rút gọn + Tứ Hóa có tiền tố tầng
    activeAnalysisExcerptVi?: string; // Tối đa 1,800 ký tự từ bài luận giải đang xem
    history: ZiweiChatMessage[];    // Tối đa 6 cặp hỏi-đáp gần nhất (12 messages)
    question: string;               // Câu hỏi mới của người dùng (tối đa 600 ký tự)
  }
  ```
- **System Instruction của `POST /api/chat-ziwei`**:
  - Đóng vai Đại Sư Tử Vi Đẩu Số giải đáp trực tiếp, đi thẳng vào câu hỏi của người dùng (tránh viết lại bài tổng quan dài dòng).
  - Độ dài mục tiêu mỗi câu trả lời: **`250 – 500 từ`** (`~400 – 800 output tokens`), có cấu trúc gạch đầu dòng rõ ràng: *(1) Căn cứ tinh đẩu & Tứ Hóa trực tiếp từ lá số → (2) Luận giải trực diện câu hỏi → (3) Lời khuyên ứng xử thực tế*.
  - Nhúng cứng **Hiến Pháp Chống Ảo Giác 3 Lớp**: Nếu người dùng hỏi về một năm ngoài phạm vi dữ liệu đã truyền hoặc hỏi thông tin không có trong lá số, AI phải trả lời trung thực dựa trên nguyên lý cung Bản Mệnh/Đại Vận sẵn có chứ không tự bịa sao lưu niên.

### 4.3. Hàng Rào Quota Mềm Kép (`Dual Soft Quota Guard`) & Khóa Tuần Tự Client-Side (`P4-03`)

Để bảo vệ 3 khóa sống (`active`, `free` tier) khỏi bị cạn kiệt RPM/RPD khi người dùng bấm hỏi liên tiếp hoặc vừa chạy Hồ Sơ Toàn Diện vừa bấm Chat, bản v2 thiết lập **3 chốt bảo vệ bắt buộc**:

1. **Chốt 1 — Khoảng nghỉ tối thiểu giữa 2 câu hỏi (`CHAT_MIN_INTERVAL_SEC = 8`)**:
   - Sau khi một câu trả lời hoàn tất (hoặc ngay sau khi gửi 1 câu hỏi), nút `"Gửi câu hỏi"` và các chip câu hỏi gợi ý sẽ hiển thị bộ đếm ngược nhẹ nhàng **`"Có thể hỏi tiếp sau 8s..."`** (`8s → 0s`).
   - Điều này đảm bảo một người dùng đơn lẻ không bao giờ bắn quá `6–7 requests/phút` từ khung Chat.
2. **Chốt 2 — Trần mềm số câu hỏi mỗi phiên (`CHAT_SOFT_CAP_PER_SESSION = 15`)**:
   - Hiển thị bộ đếm nhỏ trên thanh tiêu đề Drawer: **`"Lượt hỏi phiên này: k/15"`**.
   - Khi đạt **10 câu hỏi**: hiển thị dải nhắc nhẹ màu hổ phách *"Bạn đã sử dụng 10/15 lượt hỏi khuyến nghị trong phiên này để tiết kiệm hạn ngạch khóa API."*
   - Khi chạm mốc **15 câu hỏi**: tạm khóa ô nhập và hiển thị nút xác nhận chủ động **`"Mở thêm 5 lượt hỏi (Bảo vệ Quota Kho Khóa)"`**. Người dùng thực sự có nhu cầu chỉ cần bấm 1 lần để cộng thêm 5 lượt, nhưng ngăn chặn hoàn toàn hành vi bấm liên hoàn vô thức.
3. **Chốt 3 — Khóa Tuần Tự Client-Side giữa Hồ Sơ Toàn Diện và Chat (`Client-Side Stream Serialization`)**:
   - Khi `FullDossierModal` đang ở trạng thái `isGeneratingSection === true` (đang gọi stream tạo chương), khung Chat hiển thị thông báo: **`"Hệ thống đang tập trung tạo chương Hồ Sơ Toàn Diện. Vui lòng đợi chương hiện tại hoàn tất (~10–15 giây) hoặc bấm Tạm dừng hồ sơ để đặt câu hỏi."`** và tạm khóa nút Gửi.

### 4.4. Thiết kế Giao Diện Ngăn Kéo Trượt (`src/components/ZiweiChatDrawer.tsx`) & Lưu Trữ Lịch Sử
- **Nút mở nhanh từ 3 điểm chạm**:
  1. Trên thanh tiêu đề `InsightPanel.tsx`: Nút **`"Hỏi đáp sâu về vận hạn này"`**.
  2. Trên thanh tiêu đề `FullDossierModal.tsx`: Nút **`"Hỏi đáp cùng Hồ sơ"`**.
  3. Trên màn hình kết quả `HemingView.tsx`: Nút **`"Hỏi đáp sâu về cặp đôi này"`**.
- **Chip Câu Hỏi Gợi Ý Thông Minh (Dynamic Starter Chips)**:
  - Tự động sinh 4 câu hỏi gợi ý sát với lá số hiện tại (ví dụ: *"Vì sao cung Tài Bạch của tôi có Hóa Kỵ cần lưu ý gì năm 2026?"*, *"Trong giai đoạn 2026–2030 năm nào thuận lợi nhất để thay đổi công việc?"*, *"Cách hóa giải xung khắc ở cung Phu Thê?"*).
- **Lưu trữ lịch sử hội thoại theo quyết định `F4` (thắng v2 §4.4)**:
  - Lưu lịch sử hội thoại **hoàn toàn phía client trong `sessionStorage`** theo cặp `(Lá số + Phần luận giải đang xem)`, giữ **tối đa `10` mạch hội thoại** kèm cơ chế **LRU / dọn an toàn** khi vượt giới hạn dung lượng hoặc quá 10 mạch (kèm nút `"Xóa lịch sử trò chuyện"`).
  - **KHÔNG** dùng `localStorage`/`IndexedDB` và **KHÔNG** lưu lịch sử hội thoại phía server.

---

## MỤC 5 — PHÂN TÍCH TÁC ĐỘNG QUOTA, HIỆU NĂNG & MA TRẬN RỦI RO (ĐÃ CẬP NHẬT v2)

### 5.1. Định lượng chi phí Request & Token trên 3 Khóa Sống (`free` tier)

Giả định mỗi khóa `free` tier của Gemini có hạn mức `5 – 15 RPM` (tổng 3 khóa thuộc 3 Project khác nhau cung cấp khoảng **`15 – 45 RPM`** và **`750 – 4,500 RPD`**):

| Tác vụ người dùng | Số lượng API Calls thực tế | Ước lượng Input Tokens / call | Ước lượng Output Tokens / call | Tốc độ tiêu thụ RPM tối đa (có nhịp nghỉ) | Đánh giá độ an toàn cho 3 khóa sống |
|---|---|---|---|---|---|
| **1. Kiểm tra lại toàn bộ 20 key đang nguội (Tính năng 1)** | **Tối đa `20 calls`** nếu cả 20 key thuộc 20 Project khác nhau; nếu nhiều key dùng chung Project thì giảm xuống còn **$P$ calls** (bằng số Project khác nhau nhờ `Same-Project Short-Circuit`). *(Lưu ý: số Project khác nhau thực tế chỉ xác định được sau khi probe vì `detectedProjectNumber` của nhiều key trong 20 key nguội hiện chưa biết).* | `~10 tokens` (`"Trả lời đúng 1 từ: OK"`) | `~2 – 5 tokens` | `~1 call / ~2 giây` (tuần tự `concurrency = 1`, giãn cách `1,2s` giữa 2 key qua `POST /api/key-pool/:id/test`; **0 tác động** lên 3 key `ready`) | **Tuyệt đối an toàn** (chỉ gọi trên 20 key `cooldown`, không chạm vào quota của 3 key `ready`). |
| **2. Lập Hồ Sơ Mệnh Lý Toàn Diện 8 chương (Tính năng 2)** | **`6 – 8 calls`** (chỉ `6 calls` nếu đã có cache năm 2026 & 2027; tối đa `8 calls` nếu tạo mới hoàn toàn; cộng thêm `1–2 calls` nếu có chương phải `Seamless Continuation`) | `~1,800 – 2,800 tokens` / chương | `~1,300 – 2,100 tokens` / chương (`1,000 – 1,400 từ` cho chương nhóm cung; `750 – 1,100 từ` cho tổng quan & thời gian) | **Tối đa `2.5 – 3.5 RPM`** (do mỗi chương stream mất `15–25s` + nghỉ `2.2s` giữa 2 chương) | **Rất an toàn**: Bộ điều phối xoay vòng (`Round-Robin` theo điểm sức khỏe + `lastUsedAt`) tự động rải 8 chương đều qua 3 khóa sống (~2–3 chương/khóa trong 2–3 phút). |
| **3. Chat Hỏi Đáp Chuyên Sâu (Tính năng 3)** | `1 call / câu hỏi` (tối đa `15 calls / phiên` trước chốt xác nhận mềm) | `~2,200 – 3,500 tokens` / lượt | `~250 – 600 tokens` / lượt (`150 – 350 từ`) | **Tối đa `4 – 5 RPM`** (nhờ thời gian stream `~4–7s` + khoảng nghỉ bắt buộc `8s` giữa 2 câu hỏi) | **Rất an toàn**: Kể cả khi hỏi đủ 15 câu liên tiếp trong 3–4 phút, mỗi khóa sống chỉ chịu trung bình `5 requests`. |

### 5.2. Bảng Ma Trận Rủi Ro & Biện Pháp Giảm Thiểu (Cập nhật v2 — Đã hạ `R-1` xuống Thấp & Bổ sung `R-3` Mức Cao)

| Mã rủi ro | Mô tả rủi ro | Mức độ nghiêm trọng (v2) | Biện pháp giảm thiểu kỹ thuật bắt buộc trong thiết kế v2 |
|---|---|---|---|
| **`R-1`** | **Diễn đạt Tứ Hóa thiếu chủ ngữ tầng khi trộn nhiều lá số / nhiều năm** *(Đính chính từ v1: Bảng `SI_HUA_TABLE` của engine là ĐÚNG 100%; rủi ro chỉ nằm ở việc `formatChartSummaryVi` hiện chỉ in `(Hóa X)` chưa kèm tiền tố tầng nên văn phong AI có thể viết tắt khiến người đọc hiểu nhầm tầng).* | **THẤP** *(Đã hạ từ Cao xuống Thấp — Phòng ngừa trình bày)* | 1. **Tuyệt đối giữ nguyên `SI_HUA_TABLE`** trong `src/lib/ziwei/constants.ts`.<br>2. Trong `dossier-context.ts` và ngữ cảnh Chat, gắn tiền tố tầng tường minh `[Tứ Hóa Bản Mệnh - Can ...]`, `[Tứ Hóa Đại Vận - Can ...]`, `[Tứ Hóa Lưu Niên 202X - Can ...]` cho mọi sao Hóa. |
| **`R-2`** | **Bịa sao / Sót Tứ Hóa Lưu Niên trong dự báo dài hạn 5 năm (`2026–2030`) và 10 năm (`2026–2035`)** nếu để AI tự tính nhẩm Can Chi năm xa. | **NGHIÊM TRỌNG (Critical)** *(Đã khóa bằng `P1-01`)* | Tiền tính toán 100% bằng `buildMultiYearForecastMatrixVi(chart, 2026, 2030)` và `buildTenYearCompactMatrixVi(chart, 2026, 2035)` với **đủ 4 Hóa (`Lộc/Quyền/Khoa/Kỵ`) + Đại Vận chủ quản (`governingDaXian`)** trên mọi dòng năm; cấm AI trích dẫn bất kỳ sao lưu niên nào nằm ngoài bảng ma trận. |
| **`R-3`** | **Đứt luồng giữa chừng (`AbortError code=20` / `503 UNAVAILABLE` diện rộng) khi chạy chuỗi 8 chương liên tiếp** *(Bổ sung mới theo `P4-02` từ dữ liệu chẩn đoán ngày 16–17/11)*. | **CAO (High)** | 1. Mỗi chương đi qua `keyPool.executeStream` có sẵn **Seamless Continuation** (tự động nối tiếp phần dở trên model dự phòng/key tiếp theo) + Heartbeat SSE 15s.<br>2. **Cache Từng Chương Độc Lập (`Per-Chapter Incremental Cache`)**: Chương nào xong lưu ngay chương đó; nếu Chương $k$ vẫn đứt hẳn (`interrupted: true`), giữ nguyên các chương `1 .. k-1` và hiện nút **`"Thử lại chương này & Tiếp tục các chương còn thiếu"`**. |
| **`R-4`** | **Làm cạn kiệt RPM của 3 khóa sống nếu người dùng vừa chạy Hồ Sơ 8 chương vừa bấm hỏi Chat liên tục** hoặc spam nút kiểm tra khóa. | **CAO (High)** | 1. Áp dụng **Khóa Tuần Tự Client-Side** (không cho chạy đồng thời stream Hồ Sơ và stream Chat).<br>2. Áp dụng **Hàng Rào Quota Mềm Kép** cho Chat (`8s` nghỉ giữa 2 câu + trần mềm `15 câu/phiên`).<br>3. Nhịp nghỉ `2,200ms` giữa các chương Hồ Sơ. |
| **`R-5`** | **Nhảy cóc nhầm khóa sống trong Batch Probe hoặc gây hiểu nhầm khi `cooldownUntil` bị tính lại từ `now`** (`P2-01`). | **TRUNG BÌNH (Medium)** | 1. Chỉ nhảy cóc trên đúng 3 lỗi quota cấp Project (`QUOTA_PROJECT_ZERO`, `QUOTA_DAILY_EXHAUSTED`, `RATE_LIMIT_RPM`) và khi `detectedProjectNumber !== null`.<br>2. Hiển thị cảnh báo rõ ràng trên UI rằng khóa kiểm tra lại mà vẫn lỗi sẽ tính lại thời gian nghỉ từ thời điểm kiểm tra (`now + cooldownMs`). |

---

## MỤC 6 — LỘ TRÌNH TRIỂN KHAI THEO PHA & DANH SÁCH FILE DỰ KIẾN

### 6.1. Nguyên tắc phân pha
Triển khai tuần tự qua **3 Pha độc lập**, mỗi pha đều có thể kiểm chứng biên dịch (`compile_applet` + `lint_applet`) và kiểm thử giao diện riêng biệt trước khi sang pha tiếp theo.

### 6.2. Chi tiết từng Pha & Danh sách File

#### **PHA 1 — Nâng cấp Kho Khóa: Kiểm Tra Lại Các Khóa Đang Tạm Nghỉ (Tính năng 1)**
- **File cập nhật**:
  1. `server/key-pool/types.ts`: Thêm kiểu `CooldownBatchTestItemResult`, `CooldownBatchTestResponse` và hằng số `PROJECT_SCOPED_QUOTA_REASONS`.
  2. `server/key-pool/index.ts`: Nâng cấp `testSingleKey(id, options)` (hỗ trợ `bypassDebounce` nội bộ với sàn `1,000ms/key`) và thêm phương thức `testCooldownKeys(...)` tuân thủ 4 kỷ luật `Same-Project Short-Circuit`.
  3. `server.ts`: Thêm route `POST /api/key-pool/test-cooldown` bảo vệ bởi `requireKeyPoolWriteAccess(req, res)`.
  4. `src/components/KeyPoolModal.tsx`: Thêm nút `"Kiểm tra lại các khóa tạm nghỉ (N)"`, dòng lưu ý reset `cooldownUntil`, nút `"Dừng kiểm tra"` và bảng kết quả 4 chỉ số (`Probed / Recovered / Still Failing / Skipped`).

#### **PHA 2 — Engine Ngữ Cảnh Tất Định Đa Năm & Hồ Sơ Mệnh Lý Toàn Diện 8 Chương (Tính năng 2)**
- **File tạo mới**:
  1. `src/lib/ziwei/dossier-context.ts`:
     - Cài đặt `buildNatalOverviewFactSheetVi(chart)` (cho Chương 1).
     - Cài đặt `buildPalaceGroupFactSheetVi(chart, groupType)` (cho Chương 2, 3, 4 — kèm Phi Tinh và tiền tố tầng Tứ Hóa).
     - Cài đặt `buildMultiYearForecastMatrixVi(chart, 2026, 2030)` (cho Chương 7 — đầy đủ 4 Hóa + `governingDaXian`).
     - Cài đặt `buildTenYearCompactMatrixVi(chart, 2026, 2035)` (cho Chương 8 — đầy đủ 4 Hóa + `governingDaXian`).
  2. `src/components/FullDossierModal.tsx`:
     - Giao diện Hồ Sơ Chuyên Khảo 8 chương có Mục lục bên trái, thanh tiến trình tổng & từng chương, huy hiệu nguồn gốc (`sourceBadge`), nút `"Tạm dừng sau chương này"` / `"Tiếp tục các chương còn thiếu"`, xuất Markdown và In/PDF.
- **File cập nhật**:
  3. `server.ts`: Thêm endpoint `POST /api/interpret-dossier-section` (stream SSE qua `keyPool.executeStream`, tích hợp System Prompt có sàn `250–350 từ/cung` cho Chương 2–4 và luật cấm suy diễn ngoài ma trận cho Chương 7–8).
  4. `src/components/InsightPanel.tsx` & `src/App.tsx`: Thêm nút mở `"Hồ Sơ Mệnh Lý Toàn Diện (8 Chương)"` và kết nối kho cache dùng chung cho Chương 5 (`2026`) & Chương 6 (`2027`).

#### **PHA 3 — Khung Chat Hỏi Đáp Chuyên Sâu Có Ghim Ngữ Cảnh & Hàng Rào Quota Mềm Kép (Tính năng 3)**
- **File tạo mới**:
  1. `src/components/ZiweiChatDrawer.tsx`: Ngăn kéo trượt hỏi đáp tương tác, hỗ trợ 3 chế độ ngữ cảnh (`natal`, `period`, `heming`), chip câu hỏi gợi ý thông minh, Hàng Rào Quota Mềm Kép (`8s` cooldown + trần mềm `15 câu/phiên`), khóa tuần tự khi đang chạy Hồ Sơ, và lưu trữ lịch sử theo `chartSignature`.
- **File cập nhật**:
  2. `server.ts`: Thêm endpoint `POST /api/chat-ziwei` (stream SSE qua `keyPool.executeStream`).
  3. `src/components/InsightPanel.tsx`, `src/components/FullDossierModal.tsx`, `src/components/HemingView.tsx`: Gắn nút mở nhanh `ZiweiChatDrawer` kèm truyền ngữ cảnh ghim tương ứng.

---

## MỤC 7 — DANH MỤC CÁC QUYẾT ĐỊNH THIẾT KẾ CẦN CHỐT (`QĐ-F1` → `QĐ-F5`)

> **Lưu ý quy ước đánh số (`P1-04`):** Toàn bộ quyết định thuộc bản kế hoạch 3 tính năng mới được đánh mã **`QĐ-F1` → `QĐ-F5`** (`F` = Feature Plan) để phân biệt tuyệt đối với các quyết định `QĐ-1` → `QĐ-6` của Module Kho Khóa trong `docs/key-pool-design-plan.md`.

### **Quyết định `QĐ-F1`: Kiến trúc điều phối Kiểm tra lại các khóa tạm nghỉ (Tính năng 1)**
- **Lựa chọn A (Client-orchestrated)**: Client lặp qua danh sách khóa `cooldown` và gọi tuần tự `POST /api/key-pool/:id/test`.
- **Lựa chọn B (Server-orchestrated)**: Tạo 1 endpoint duy nhất `POST /api/key-pool/test-cooldown` chạy trọn gói trên server rồi trả về bảng tổng hợp cuối cùng.
- **Lựa chọn C — KHUYẾN NGHỊ CỦA PANEL (Hybrid — Kết hợp A + B)**:
  - Triển khai endpoint `POST /api/key-pool/test-cooldown` trên server (kèm nâng cấp `testSingleKey` cho phép `bypassDebounce` có kiểm soát sau `requireKeyPoolWriteAccess` với sàn `1,000ms/key`), đồng thời trên UI `KeyPoolModal.tsx` cho phép điều phối theo từng khóa có áp dụng **4 kỷ luật `Same-Project Short-Circuit`** để thanh tiến trình nhảy trực quan từng khóa và người dùng có thể bấm **`"Dừng kiểm tra"`** bất kỳ lúc nào.

### **Quyết định `QĐ-F2`: Cấu trúc chia chương & Sàn độ dài của "Hồ Sơ Mệnh Lý Toàn Diện" (Tính năng 2)**
- **Lựa chọn A (1 Prompt gộp)**: Gọi 1 lần duy nhất cho toàn bộ lá số + 10 năm (Rủi ro rất cao bị cắt cụt, viết hời hợt mỗi cung 2 câu và đứt luồng `AbortError code=20`).
- **Lựa chọn B (15 Chương rời)**: Tách mỗi cung trong 12 cung thành 1 lần gọi API riêng + các chương năm (Tốn `15–17 requests/lá số`, quá nặng cho 3 key miễn phí).
- **Lựa chọn C — KHUYẾN NGHỊ CỦA PANEL (8 Chương Chuẩn + Sàn `250–350 từ/cung`)**:
  - Chia đúng **8 chương chuẩn** như Mục 3.2 (Chương 1: Tổng quan; Chương 2–4: 12 cung chia 3 nhóm Tam Hợp/Chức năng với **sàn bắt buộc `250–350 từ/cung` = `1,000–1,400 từ/chương`**; Chương 5: Lưu Niên 2026; Chương 6: Lưu Niên 2027; Chương 7: Chiến lược 5 năm `2026–2030`; Chương 8: Đại cục 10 năm `2026–2035`), kết hợp tái sử dụng cache 2 chiều cho Chương 5 & 6 (chỉ tốn **6 lượt gọi AI mới** nếu đã xem năm 2026 & 2027) và nhịp nghỉ `2,200ms` giữa các chương.

### **Quyết định `QĐ-F3`: Chế độ khởi chạy mặc định khi người dùng mở "Hồ Sơ Mệnh Lý Toàn Diện"**
- **Lựa chọn A — KHUYẾN NGHỊ CỦA PANEL (Hai nút hành động rõ ràng — Ưu tiên Tự động tuần tự có nút Tạm dừng)**:
  - Cung cấp nút chính **`"Lập Trọn Bộ Hồ Sơ Toàn Diện (8 Chương)"`** (tự động chạy tuần tự từ Chương 1 → 8, người dùng đọc ngay Chương 1 sau ~15s trong khi các chương sau chạy tiếp ở hậu cảnh, có nút **`"Tạm dừng sau chương này"`** bất cứ lúc nào) **VÀ** cho phép bấm chọn tạo lẻ từng chương ngay trong Mục lục bên trái.
- **Lựa chọn B (Chỉ tạo từng chương thủ công)**: Người dùng phải tự bấm nút tạo ở từng chương một từ Chương 1 đến Chương 8.

### **Quyết định `QĐ-F4`: Chính sách giữ nguyên bảng `SI_HUA_TABLE` & Tiền tố tầng Tứ Hóa trong Fact Sheet**
- **Khuyến nghị chốt cứng của Panel (theo chỉ đạo của Chủ dự án tại Điểm 1)**:
  1. **Giữ nguyên 100% bảng `SI_HUA_TABLE`** tại `src/lib/ziwei/constants.ts:47-58` (Canh = Thái Dương Lộc, Vũ Khúc Quyền, Thái Âm Khoa, Thiên Đồng Kỵ; Nhâm = Thiên Lương Lộc, Tử Vi Quyền, Tả Phù Khoa, Vũ Khúc Kỵ).
  2. Bổ sung tiền tố tầng tường minh (`[Tứ Hóa Bản Mệnh - Can ...]`, `[Tứ Hóa Đại Vận - Can ...]`, `[Tứ Hóa Lưu Niên 202X - Can ...]`) vào các hàm sinh Fact Sheet mới (`dossier-context.ts` và ngữ cảnh Chat) cùng ma trận đủ 4 Hóa + `governingDaXian` cho mọi năm từ `2026` đến `2035`.

### **Quyết định `QĐ-F5`: Cơ chế Hàng Rào Quota Mềm Kép cho Khung Chat Hỏi Đáp (Tính năng 3)**
- **Lựa chọn A (Không giới hạn)**: Cho phép bấm hỏi liên tục không có thời gian nghỉ và không giới hạn số câu (Nguy cơ làm cạn RPM của 3 khóa sống).
- **Lựa chọn B (Giới hạn cứng khóa chặt)**: Khóa cứng tối đa 5 câu hỏi/ngày không cho mở thêm.
- **Lựa chọn C — KHUYẾN NGHỊ CỦA PANEL (Hàng Rào Quota Mềm Kép + Khóa Tuần Tự)**:
  - Áp dụng khoảng nghỉ tối thiểu **`8 giây`** giữa 2 câu hỏi liên tiếp + trần mềm **`15 câu hỏi / phiên / lá số`** (nhắc nhẹ ở câu 10, hiện nút xác nhận **`"Mở thêm 5 lượt hỏi"`** ở câu 15) + **Khóa tuần tự Client-side** không cho gửi Chat đồng thời khi đang chạy stream tạo chương Hồ Sơ Toàn Diện.

---

## MỤC 8 — KẾ HOẠCH KIỂM CHỨNG (VERIFICATION MATRIX)

*(Theo mẫu §5 của v1 và cập nhật đầy đủ theo Bộ quyết định `F1–F7`)*

### 8.1. Kiểm chứng Tính năng 1 (Client-Orchestrated Batch Probe trong `KeyPoolModal.tsx`)
1. **Kịch bản 1.1 — Thứ tự ưu tiên & 4 kỷ luật `Same-Project Short-Circuit`**:
   - Chỉ lấy các key `status === 'cooldown'` (loại trừ `disabled`), sắp xếp đúng thứ tự ưu tiên lý do nguội: `NETWORK_OR_5XX` → `RATE_LIMIT_RPM` → `QUOTA_DAILY_EXHAUSTED` → `QUOTA_PROJECT_ZERO`.
   - **Kỷ luật (a):** Chỉ nhảy cóc khi key đại diện vừa probe lỗi thuộc 3 mã cấp Project (`QUOTA_PROJECT_ZERO`, `QUOTA_DAILY_EXHAUSTED`, `RATE_LIMIT_RPM`); **tuyệt đối không** nhảy cóc nếu lỗi là `NETWORK_OR_5XX`, `MODEL_UNAVAILABLE`, `AUTH_INVALID_KEY`.
   - **Kỷ luật (b):** Key có `detectedProjectNumber === null` hoặc `undefined` luôn được gọi probe độc lập và không tính vào bộ đếm `Bỏ qua trùng Project`.
   - **Kỷ luật (c):** Key bị nhảy cóc được đồng bộ `cooldownUntil` theo key đại diện vừa probe, và tổng kết phân biệt rõ `Probe thật` với `Đồng bộ theo key đại diện`.
   - **Kỷ luật (d) & Debounce:** Gọi qua route sẵn có `POST /api/key-pool/:id/test` (không tạo `batchProbe`/`bypassDebounce`); nếu bị debounce 5–10s từ server (`429`), ghi nhận `Chưa thử (đang chờ)` và tiếp tục vòng lặp, không tính vào bộ đếm lỗi.
2. **Kịch bản 1.2 — Trạng thái UI, Khóa nút & Hủy giữa chừng**:
   - Nút `"Test lại toàn bộ key đang nguội (N)"` bị khóa khi `isReadOnly === true` hoặc `N === 0` (hiển thị chú thích khi `N === 0`).
   - Hiển thị cảnh báo trước khi chạy về việc probe thất bại sẽ tính lại thời gian nguội từ thời điểm probe (`QUOTA_PROJECT_ZERO → +6 giờ`).
   - Bấm `"Dừng kiểm tra"` hoặc đóng modal hủy vòng lặp ngay sau key đang chạy, giữ nguyên kết quả đã có.

### 8.2. Kiểm chứng Tính năng 2 (`dossier-context.ts` & `POST /api/interpret-dossier-section`)
1. **Kịch bản 2.1 — Độ phủ 12 cung theo 3 nhóm v1 (`F2`)**:
   - `buildPalaceGroupFactSheetVi(chart, 'core' | 'family' | 'social_health')` phải phủ đủ 12 cung (`core`: Mệnh, Quan Lộc, Tài Bạch, Thiên Di; `family`: Phu Thê, Tử Nữ, Điền Trạch, Phúc Đức; `social_health`: Phụ Mẫu, Huynh Đệ, Giao Hữu, Tật Ách), mỗi nhóm đúng 4 cung, không trùng, không sót, có tiền tố tầng Tứ Hóa tường minh.
2. **Kịch bản 2.2 — Ma trận 8 nhóm trường/năm & Trường hợp trẻ em chưa vào Đại Hạn**:
   - `buildMultiYearHorizonContext(chart, 2026, 2030)` trả về đúng 5 dòng năm; `buildMultiYearHorizonContext(chart, 2026, 2035)` trả về đúng 10 dòng năm.
   - Mỗi dòng năm đủ cả **8 nhóm trường**: (1) năm + can chi; (2) tuổi danh nghĩa; (3) Đại Hạn chủ quản; (4) quan hệ Đại Hạn–Lưu Niên; (5) cung bản mệnh kích hoạt; (6) bộ Lưu Tứ Hóa đủ cả 4 (`Lộc/Quyền/Khoa/Kỵ`) kèm sao, cung tọa thủ, cung xung chiếu; (7) sao lưu động chính; (8) cờ xung hợp nổi bật khi dữ kiện xác định có.
   - Với lá số trẻ em có năm chưa vào Đại Hạn (`effDxIdx === -1`), hàm xử lý an toàn không lỗi và ghi rõ `"chưa vào Đại Hạn"` ở dòng năm đó.
3. **Kịch bản 2.3 — Cache 2 chiều, Nhãn nguồn & Đầu vào Endpoint**:
   - Chương 5 (`2026`) và Chương 6 (`2027`) tái sử dụng `POST /api/interpret-period` và đồng bộ cache 2 chiều kèm `sourceBadge` tường minh.
   - `POST /api/interpret-dossier-section` từ chối gọn (HTTP `400`, không gọi AI) khi `sectionId` không hợp lệ hoặc thiếu `chart`.

### 8.3. Kiểm chứng Tính năng 3 (`POST /api/interpret-chat` & Hàng rào `F4`/`F7`)
1. **Kịch bản 3.1 — Kiểm tra đầu vào & Ràng buộc Server**:
   - `POST /api/interpret-chat` từ chối gọn (HTTP `400`, không gọi AI) khi `question` rỗng hoặc vượt quá `400 ký tự`; cắt an toàn `excerpt` (`6.000 ký tự`) và `history` (tối đa `6` tin nhắn gần nhất, mỗi tin `1.200 ký tự`); prompt có rào chống bịa chỉ dựa trên dữ kiện xác định + văn bản đã có.
2. **Kịch bản 3.2 — Hàng rào Quota `F7` & Giới hạn `sessionStorage` `F4` (Phần B)**:
   - Nghỉ tối thiểu `8 giây` giữa 2 câu hỏi (đếm ngược trên nút Gửi); trần mềm `15` câu/phiên/lá số (nhắc ở câu 10, nút mở thêm 5 ở câu 15); khóa tuần tự khi đang stream sinh chương hồ sơ.
   - Lưu tối đa `10` mạch hội thoại trong `sessionStorage` theo cặp `(lá số + phần luận giải)`, có LRU/dọn an toàn.

### 8.4. Kiểm chứng Tổng thể & Bảo mật
- Chạy `npx tsc --noEmit` đạt `0` lỗi; `npm run build` (`vite build`) thành công.
- Chạy `npx tsx scripts/verify-key-pool.ts` và kiểm chứng xác định `dossier-context` đạt `100%`.
- Quét toàn bộ thư mục `dist/` bảo đảm `0` chuỗi khóa API nguyên văn (`AIza...`).
