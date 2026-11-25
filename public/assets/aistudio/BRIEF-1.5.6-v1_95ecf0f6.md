# BRIEF 1.5.6 — v1 (25/11/2026)

Thi công trên nền 1.5.5 (src-v24). Bốn nhóm: W = KP-3 đầy đủ (verifier) + 2 quy tắc mới từ live 1.5.5; X = KP-6 (cầu chì kép + partial); Y = KP-7 tầng 2 (banner kho + xuất/nhập pool bằng passphrase); Z = khắc phục các lỗi mới phát hiện ở nghiệm thu live 1.5.5.

## Bối cảnh và cơ sở dữ kiện (đã kiểm chứng trên file thật)
- Kiểm chứng độc lập 1.5.5 ĐẠT ĐK-155-01..05 (`work/KIEM-CHUNG-1.5.5.md`). Nghiệm thu live ĐK-155-06 CHƯA ĐẠT TRỌN: 6/7 lỗi nghiêm trọng đã hết; **A-04 CÒN dạng biến thể** — hồ sơ 1.5.5 (`~/workspace/your_files/la-so-do-vu-toan/Ho-So-Tu-Vi-Do-Vu-Toan-4-8-sinh-lai-1.5.5.md`, dòng 211): "Sự hiện diện của bộ đôi Không - Kiếp/Không bộc lộ rõ tính chất biến động…" trong khi cung Lưu Mệnh chỉ có Địa Không + Thiên Không, không có Địa Kiếp.
- Nguyên nhân gốc của A-04 (đã soi code src-v24): Z4 ở 1.5.5 chỉ là **quy tắc prompt** trong `buildStrictPeriodAiPrompt` / `buildStrictDossierSectionPrompt` ("Không tự gọi riêng lẻ Địa Không, hoặc cặp Địa Không + Thiên Không, là 'Không Kiếp'…"), KHÔNG có bước nào kiểm tra đầu ra. Model lách bằng dạng biến thể có gạch ngang/gạch chéo ("Không - Kiếp/Không") mà quy tắc chuỗi chính xác không bắt được.
- Lỗi mới ở hồ sơ 1.5.5 (đã kiểm chứng trên file, đối chiếu bản 1.5.4 `Ho-So-Tu-Vi-Do-Vu-Toan-8-8-sinh-lai-toan-bo-1.5.4.md`):
  - Tiêu đề cung lặp 2 lần liên tiếp ở chương 3 (cả 4 cung; bản 1.5.4 mỗi cung chỉ 1 lần). Nguyên nhân: `enforceCanonicalPalaceGroupHeadings` trong `text-sanitizer.ts` chuẩn hóa từng dòng tiêu đề về dạng chuẩn nhưng KHÔNG gộp các dòng giống hệt nhau liên tiếp.
  - "sao Thiên Lương thủ mì" (ch.5); "Cung Lưu Mệnh Cung đóng nhờ trên cung Bản Mệnh gốc Giao Hữu" (ch.6); "trinhtrạng trì hoãn" — dính chữ, thiếu khoảng trắng (ch.6). Cả ba đều nằm ngoài từ điển Z3 hiện có trong `sanitizeAiVietnameseOutput`.
  - Chương 3 trích dẫn hoàn toàn dạng [ID] trần (8 thẻ: NH-STAR-054 ×4, NH-SIHUA-002 ×3, CL-TT-009 ×1), không còn dạng [Nguồn: ...], không có khối tham chiếu cuối chương (bản 1.5.4 ch.3 có 4 thẻ [Nguồn:] + khối tham chiếu). Nguyên nhân gốc: `formatEntryForPrompt` trong `retriever.ts` in mục tri thức dạng `- [ID] **...**` (trần) — model sao chép đúng dạng nó thấy trong fact sheet. Hệ quả: `validIdsInOrder` trong `verifyAcademicCitationsAndClaims` rỗng → không có khối tham chiếu.
  - Chương 6 hoàn toàn không có trích dẫn nào và không có khối tham chiếu. Lưu ý: bản 1.5.4 ch.6 cũng vậy (0 thẻ, không khối) — đây là hành vi có sẵn, KHÔNG phải hồi quy do 1.5.5.
  - Sàn từ ĐẠT (ch.5 ≈1.394 từ, ch.6 ≈1.419 từ) nhưng cả hai vượt trần mục tiêu 900–1.300 từ của prompt Z2.
- Nền: phương án hợp nhất v2 (`work/audit-2026-11-25/PHUONG-AN-KHAC-PHUC-v2-HOP-NHAT.md`) đã định sẵn phạm vi 1.5.6 là KP-3 đầy đủ + KP-6 + KP-7 tầng 2. Brief này giữ nguyên 3 nhóm đó và bổ sung nhóm Z từ live 1.5.5.

## Nhóm W — KP-3 đầy đủ (mở rộng `verifier.ts`, KHÔNG xây tầng mới song song)
- W1 (quy tắc 1, kế thừa KP-3-lite của 1.5.4): kiểm tra trong KHUNG CUNG — cụm "Cung X (Can Chi)" / "Cung X tại Can Chi" đối chiếu bản đồ cung đúng tầng (bản mệnh ↔ bản đồ bản mệnh; đại hạn/lưu niên ↔ bản đồ kỳ). Giữ nguyên ca âm tính "năm Canh Ngọ 1990" không bị gắn cờ.
- W2 (quy tắc 2, tứ hóa đại hạn theo kỳ): phân đoạn văn bản theo block "### Cung …" SAU bước chuẩn hóa tiêu đề của `text-sanitizer.ts`; khóa theo cặp (khoảng tuổi, can) cùng xuất hiện trong block — không khóa theo chuỗi thẻ (ngữ pháp nhãn đã đổi ở 1.5.4). Chương horizon: tập can hợp lệ = tập `governingDaXian` trong cửa sổ năm.
- W3 (quy tắc 3, trích dẫn khớp chủ đề): chỉ áp khi mục KB có neo thực thể cụ thể (trường sao/mẫu/tứ hóa có sao cụ thể); mục phương pháp luận tổng quát được miễn.
- **W4 (quy tắc 4 MỚI — A-04)**: kiểm tra mọi cách gọi họ "Không Kiếp" trong văn bản sinh. Chuẩn hóa trước khi khớp: bỏ khoảng trắng, gạch ngang, gạch chéo giữa "Không" và "Kiếp" (bắt cả "Không Kiếp", "Không - Kiếp", "Không-Kiếp", "Không/Kiếp", "Không - Kiếp/Không"). Đối chiếu dữ kiện sao thật của cung đang luận (lấy từ chart/khung cung như W1): chỉ hợp lệ khi Địa Kiếp đồng cung hoặc nằm trong Tam Phương Tứ Chính của cung đó; ngược lại gắn cờ nghiêm trọng. Ca kiểm: câu A-04 ở hồ sơ 1.5.5 ("bộ đôi Không - Kiếp/Không" tại cung chỉ có Địa Không + Thiên Không) → 1 cờ; câu viết đúng "Địa Không và Thiên Không" → 0 cờ; câu "Không Kiếp" tại cung có đủ Địa Không + Địa Kiếp → 0 cờ.
- **W5 (quy tắc 5 MỚI — trích dẫn tối thiểu)**: chương kỳ hạn hoặc nhóm cung có 0 thẻ [Nguồn: ...] hợp lệ trong toàn chương → gắn cờ mức trung bình "chương không có trích dẫn". Áp sau bước chuẩn hóa thẻ trần của Z3 (xem dưới) để không gắn cờ oan cho chương chỉ dùng dạng trần.
- W6 (đầu ra): gắn cờ vào kênh audit hiện hữu (như KP-3-lite) + **UI danh sách cờ theo chương** (hiển thị trong giao diện hồ sơ — đây là phần UI đã hoãn từ 1.5.4, nay làm). Không sinh lại nội dung khi có cờ; cờ chỉ để đối chiếu.
- Ca kiểm W (chạy trên hồ sơ 8 chương 1.5.4 của lá số mẫu 26/07/1977): bắt đủ 3 lỗi đã biết (Canh Ngọ ch.5; Can Canh gán sai kỳ ch.3; CL-CTP-014 gán sai chủ đề ở luận Đại Hạn), 0 cờ giả trên các đường phi tinh đúng (danh sách ca đúng từ A0/A1). Thêm ca trên hồ sơ 1.5.5: bắt được A-04 (dòng 211) và cờ "chương không có trích dẫn" ở ch.6.

## Nhóm X — KP-6 (cầu chì kép + snapshot partial)
- X1: lỗi tạm thời (FIRST_CHUNK_TIMEOUT, NETWORK_OR_5XX, MODEL_UNAVAILABLE, RATE_LIMIT_RPM, TPM_GUARD_SKIP, AI_POOL_EXHAUSTED với minRemainingCooldownSec ≤ 60): bỏ qua, chạy tiếp các chương sau, đưa chương lỗi vào hàng đợi thử lại đúng 1 vòng cuối lượt.
- X2: lỗi chết toàn cục (AI_NOT_CONFIGURED, mọi khóa disabled/AUTH_INVALID_KEY, AI_POOL_EXHAUSTED với minRemainingCooldownSec > 60, người dùng bấm Dừng): dừng ngay toàn vòng.
- X3 (partial): snapshot `bestPartialSoFar` trước khi sinh lại một chương; chỉ ghi đè khi lượt mới hoàn tất hoặc partial mới dài hơn; hiển thị thông báo nhỏ khi khôi phục bản dài hơn. Đổi nhãn nút thành "Sinh lại chương này".
- X4: nối tiếp xuyên request (gửi priorText) KHÔNG thuộc bản này — đánh giá riêng sau khi KP-4 đã ổn định.
- Ca kiểm ĐK-NT-6 (giữ nguyên từ phương án v2): 6a (lỗi tạm thời → chạy tiếp + retry cuối), 6b (lỗi toàn cục → dừng ngay ở chương 1), 6c (partial 1.500 ký tự được giữ khi lượt mới đứt ở 400 ký tự).

## Nhóm Y — KP-7 tầng 2 (Kho Khóa)
- Y1 (banner): khi số khóa sẵn sàng < 3, hiển thị banner phân biệt hai thông điệp: tổng số khóa < 3 ("kho có ít hơn 3 khóa") vs tổng ≥ 3 nhưng sẵn sàng < 3 ("chỉ còn X/Y khóa sẵn sàng").
- Y2 (xuất/nhập pool): xuất/nhập gói sao lưu pool mã hóa bằng PASSPHRASE do người dùng nhập (dẫn xuất khóa PBKDF2/HKDF + AES-256-GCM); gói chứa đủ keys + labels + detectedProjectNumber + modelConfig — độc lập với `.pool-master.key`. CẤM xuất nguyên file `.enc.json` theo khóa chủ ngẫu nhiên.
- Ca kiểm ĐK-NT-7 (giữ nguyên từ phương án v2): khôi phục xuyên container (thư mục A → thư mục B) đạt 100% khóa/nhãn/project/modelConfig.
- Firestore: không làm (chỉ xét lại nếu app ở lại AI Studio dài hạn thay vì lên máy chủ riêng).

## Nhóm Z — Khắc phục live 1.5.5
- **Z1 (tiêu đề cung lặp)**: trong `enforceCanonicalPalaceGroupHeadings`, sau bước chuẩn hóa từng dòng, gộp các dòng tiêu đề chuẩn GIỐNG HỆT NHAU VÀ LIÊN TIẾP thành một dòng. Chỉ gộp khi liên tiếp (an toàn); tiêu đề giống hệt nhưng cách nhau bởi nội dung khác thì giữ nguyên. Lũy đẳng. Ca kiểm: 2 dòng `### Cung Phu Thê (Nhâm Tý) [AN THÂN] [Đại hạn 24–33 tuổi]` liên tiếp → 1 dòng; 2 tiêu đề khác nhau liên tiếp giữ nguyên cả hai; tiêu đề lặp nhưng cách nhau 1 đoạn văn giữ nguyên.
- **Z2 (từ điển Z3 mở rộng)** — thêm vào `sanitizeAiVietnameseOutput`, đúng mẫu biên chữ Unicode hiện hữu (chỉ khớp chữ thường/trường hợp đã nêu, không đụng địa danh/tên riêng):
  - "thủ mì" → "thủ Mệnh" (ngữ cảnh: sao tọa thủ tại Lưu Mệnh; **panel xác nhận nghĩa này trước khi thi công** — nếu panel bác nghĩa thì đổi thành phương án panel chốt).
  - "đóng nhờ trên" → "đóng tại".
  - "trinhtrạng" → "tình trạng"; "trinh trạng" (dạng có khoảng trắng) → "tình trạng".
  - Ca âm tính bắt buộc: "trình trạng" không bị sửa; "thủ Mệnh" đã đúng giữ nguyên (lũy đẳng); "Bảo Ninh" (địa danh) không bị sửa (quy tắc Z3 cũ giữ nguyên).
- **Z3 (chuẩn hóa thẻ [ID] trần)** — chuẩn hóa thẻ trích dẫn dạng trần `[ID]` thành `[Nguồn: ID]` trong luồng kiểm tra của `verifyAcademicCitationsAndClaims` (nơi có tập mục KB để đối chiếu), TRƯỚC khi chạy các bước V1/V3 hiện hữu; phía client (`scrubInvalidCitationTags`) giữ hành vi hiện tại. Chỉ chuyển khi ID khớp `CITATION_ID_SYNTAX_RE` VÀ tồn tại trong KB đã nạp (tránh biến thẻ lạ thành trích dẫn). Giữ nguyên vị trí trong câu; lũy đẳng. Phương án thay thế — đổi `formatEntryForPrompt` trong `retriever.ts` sang dạng `- [Nguồn: ID] **...**` — CHỈ làm nếu đo lại kích thước fact sheet vẫn trong trần (lưu ý: overview 1.5.5 là 3.624/3.650, chỉ dư 26 ký tự; mỗi mục thêm ~9 ký tự nên phương án này nhiều khả năng vượt trần — panel cân nhắc, mặc định KHÔNG đổi `formatEntryForPrompt`).
  - Ca kiểm: "[NH-STAR-054]" → "[Nguồn: NH-STAR-054]"; "[FAKE-999]" không chuyển (không có trong KB) và xử lý theo luật scrub hiện hữu; "[Nguồn: CL-TT-015]" giữ nguyên; văn bản không chứa thẻ giữ nguyên.
- **Z4 (trần từ kỳ hạn)** — siết wording sàn trong `buildStrictPeriodAiPrompt`: từ "900–1.300 từ" thành chỉ thị cứng: "viết 900–1.300 từ cho thân bài (không tính tiêu đề, dòng dữ kiện Tứ Hóa, khối tham chiếu); dừng luận giải khi đủ ý, không kéo dài thêm". Chỉ kiểm bằng test prompt (assert wording có mặt); KHÔNG đặt cổng cứng ở nghiệm thu live (biến thiên model) — số từ live chỉ báo cáo.

## Trần kích thước (giữ nguyên 1.5.5, đo bằng cùng phương pháp trên lá số mẫu 26/07/1977)
chapter_overview ≤ 3.650; palaces_core ≤ 5.100; palaces_family ≤ 4.550; palaces_social_health ≤ 4.580; horizon_5y ≤ 14.200; horizon_10y ≤ 37.800; bảng chat ≤ 13.100. Vượt trần thì DỪNG và báo cáo, không tự cắt nội dung.

## Danh sách trắng assertion được phép sửa (ĐK-V2-1)
Ngoài danh sách này, assertion cũ giữ nguyên hoặc báo lại — cấm tự ý sửa cho khớp:
1. Ca kiểm mới của Nhóm W trong `verify-knowledge-base.ts` (Gate KP-3: W1–W5 + ca hồ sơ 1.5.4/1.5.5).
2. Ca kiểm mới của Nhóm X trong `verify-dossier-chat-ui.ts` (ĐK-NT-6a/6b/6c).
3. Ca kiểm mới của Nhóm Y trong `verify-key-pool.ts` (banner Y1 + khôi phục xuyên thư mục ĐK-NT-7).
4. Ca kiểm mới của Nhóm Z trong `verify-knowledge-base.ts` (Z3) và `verify-dossier-context.ts` (Z1, Z2, Z4 wording).
5. Wording prompt trong `server.ts` (quy tắc Z4) — chỉ sửa phần câu chữ về sàn từ, không đổi logic khác.
6. Số đếm tiêu đề/bài trong các file verify khi thêm ca mới (tương tự 1.5.4/1.5.5).

## Điều kiện nghiệm thu (ĐK-156)
- ĐK-156-01: `verify:all` exit 0 trên source 1.5.6 (key-pool, dossier-context, dossier-ui, yunxian, library, kb — gồm K1 32/32, K2 15/15, K3 24/24 + các Gate mới W/X/Y/Z).
- ĐK-156-02: `lint` 0 lỗi; `build` đạt.
- ĐK-156-03: bảng đo kích thước trước/sau (7 bề mặt) đều trong trần trên.
- ĐK-156-04: diff chỉ gồm file trong phạm vi 4 nhóm + danh sách trắng; không đụng engine an sao, `SI_HUA_TABLE`, retriever (trừ khi panel chốt phương án thay thế ở Z3), allocator/phân loại lỗi (trừ KP-6), dữ liệu KB JSON.
- ĐK-156-05: VERSION → 1.5.6 + CHANGELOG ghi đủ 4 nhóm.
- ĐK-156-06: ca ĐK-NT-6a/6b/6c và ĐK-NT-7 đạt.
- ĐK-156-07 (nghiệm thu live trên Preview, lá số mẫu 26/07/1977 — sinh lại ch.3, ch.5, ch.6): A-04 không còn dưới mọi dạng biến thể; không còn tiêu đề cung lặp liên tiếp; không còn "thủ mì" / "đóng nhờ trên" / "trinhtrạng"; ch.3 có thẻ [Nguồn: ...] + khối tham chiếu; ch.5/6 ≥ 900 từ thân bài (báo cáo số từ thực tế).

## Ngoài phạm vi
- Không sửa engine an sao (đã kiểm chứng đúng toàn bộ — A0).
- Không sửa 5 lỗi dữ kiện trong hồ sơ đã xuất của Saint (việc riêng, chờ lệnh).
- Không đổi học thuyết/quy ước luận giải hiện hành của app.
- Không sửa trực tiếp file hồ sơ đã xuất — hồ sơ sẽ sinh lại sau khi sửa code.

## KHỐI CHUẨN — gắn nguyên khối dưới đây vào brief

### A. Vai trò và phạm vi

1. Brief này đã qua panel phản biện 2 vòng và được chủ dự án phê duyệt. Thi công **đúng phạm vi đã duyệt**, không tự mở rộng, không đổi kiến trúc, không thêm tính năng ngoài brief.
2. Nếu phát hiện brief có điểm mâu thuẫn, thiếu căn cứ hoặc không khả thi: **dừng ở điểm đó, báo cáo rõ vấn đề**, không tự chế phương án thay thế.
3. Model cho lượt này: **Hydrogen — thi công theo kế hoạch đã duyệt/việc cơ học**. (Muse kiểm tra và chọn đúng model trong AI Studio trước khi chạy.)

### B. Ngôn ngữ và tài liệu

4. Mọi tài liệu hướng dẫn (file `.md`) viết bằng **tiếng Việt**. Nội dung giao diện người dùng theo ngôn ngữ của dự án. Code, tên biến, comment trong code: tiếng Anh.

### C. Kỷ luật thi công

5. **Read → Understand → Apply**: đọc kỹ các file liên quan trước khi sửa; hiểu lý do của quy tắc áp dụng rồi mới áp dụng.
6. **Ý thức phụ thuộc file**: trước khi sửa một file, xác định các file phụ thuộc/liên quan và cập nhật đồng bộ trong cùng lượt — không để trạng thái lệch giữa các file.
7. Việc nhiều file hoặc thay đổi cấu trúc: lập/tuân theo file kế hoạch của đợt trước khi viết code; việc đơn giản một file làm trực tiếp.
8. Không ghi khoá API/bí mật vào code. Khoá chỉ đi qua Secrets của AI Studio hoặc biến môi trường; phía client không giữ khoá bí mật.

### D. Chất lượng code

9. Clean Code: gọn, trực tiếp, tự giải thích; không over-engineering; không hardcode giá trị cấu hình (đi qua config/env).
10. **Testing bắt buộc** cho logic mới hoặc thay đổi: bổ sung/cập nhật test tương ứng (ưu tiên Unit > Integration > E2E, mẫu Arrange–Act–Assert).
11. Trước khi báo hoàn thành: tự chạy toàn bộ cổng kiểm tra của dự án (`bun run lint`, `bun run build`, `bun run verify:all`) và báo cáo **kết quả thật** — lỗi ở đâu nêu ở đó, không che giấu test hỏng, không bỏ qua cổng kiểm tra.

### E. Báo cáo cuối đợt (để Muse kiểm chứng độc lập)

12. Cuối đợt, xuất báo cáo gồm: (a) danh sách file đã tạo/sửa kèm tóm tắt thay đổi từng file; (b) kết quả từng cổng kiểm tra ở mục 11 (số test đạt/tổng, lỗi nếu có); (c) các điểm đã dừng theo mục 2 hoặc giả định đã buộc phải chọn, nếu có; (d) việc còn tồn đọng.
13. Cập nhật tài liệu dự án bị ảnh hưởng bởi thay đổi (README/docs/CHANGELOG nếu dự án có quy ước đó) trong cùng đợt.
14. Sau đợt này, Muse sẽ đồng bộ source về workspace riêng và kiểm chứng độc lập (chạy lại lint/test/build, soi diff). Mọi sai lệch giữa báo cáo và source thật sẽ phải sửa ở đợt kế tiếp — vì vậy báo cáo phải khớp source tuyệt đối.
