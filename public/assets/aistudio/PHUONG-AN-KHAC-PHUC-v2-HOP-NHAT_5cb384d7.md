# PHƯƠNG ÁN KHẮC PHỤC v2 — BẢN HỢP NHẤT SAU PANEL 2 VÒNG (25/11/2026)

Nền: v1 (Muse) + phản biện vòng 1 Argon (đồng ý có điều kiện cả 7 gói; điều kiện M1–M4, ĐK-NT-1..7) + kiểm chứng vòng 2 phía Muse (8/8 khẳng định code của vòng 1 ĐÚNG) + phản biện vòng 2 (3 sửa đổi: tách đợt, KP-1 dạng lai, bổ sung ĐK-NT-8..11 và ĐK-V2-1..5). Tài liệu gốc: PHUONG-AN-KHAC-PHUC-v1.md, PHAN-BIEN-VONG-1-KHAC-PHUC.md, V2-kiem-chung-vong-1.md, PHAN-BIEN-VONG-2-KHAC-PHUC.md trong cùng thư mục.

## BƯỚC 0 — Thao tác cấu hình (0 code, làm ngay khi duyệt)
- Đặt secret GEMINI_API_KEYS trong AI Studio Secrets: 23 khóa sống, MỖI KHÓA MỘT DÒNG theo định dạng "Nhãn:Khóa" (parser chỉ giữ nhãn theo từng dòng — nhiều mục có nhãn trên cùng một dòng ngăn bằng dấu phẩy sẽ mất nhãn).
- Đặt secret KEY_POOL_MASTER_SECRET (chuỗi bí mật cố định) để khóa chủ không phụ thuộc file tạm.
- Kiểm sau restart (ĐK-NT-11): mở Kho Khóa xác nhận (i) đủ khóa sẵn sàng, (ii) cặp model vẫn là chính gemini-3.5-flash-lite / dự phòng gemma-4-31b-it (modelConfig sống trong file pool, không nằm trong secret khóa).
- Đánh đổi đã biết: sửa danh sách khóa qua Secrets; xóa/vô hiệu khóa môi trường qua UI không bền qua restart.

## BẢN 1.5.4 — Tầng nội dung: KP-1 (dạng lai) + KP-4 + KP-3-lite
### KP-1 dạng lai (ĐK-V2-2 — bảng chốt theo bề mặt là một phần của brief)
- Section nhóm cung: thêm DÒNG KỲ RIÊNG, đủ 4 hóa, dạng mũi tên, nhãn tường minh: "[Tứ Hóa Đại Hạn Kỳ 24–33 (đóng tại Phu Thê · Can Nhâm)] …". KHÔNG gộp vào block Phi Tinh Can Cung (block đó chỉ mang Lộc/Kỵ với ngữ nghĩa liên cung một chiều — dossier-context.ts:474; gộp sẽ tái tạo mơ hồ đã sinh L1). Chấp nhận trùng 2 dòng Lộc/Kỵ.
- Thẻ kỳ hiện tại ở MỌI bề mặt: đổi nhãn thành "[Tứ Hóa Đại Hạn HIỆN TẠI (44–53 · Can Canh)]".
- Fact sheet tổng quan + bảng chat/heming: chỉ đổi nhãn kỳ hiện tại, KHÔNG thêm dòng kỳ (tránh nổ kích thước bảng chat).
- Horizon builder: không đụng (đã tiền tính theo kỳ đúng).
- yunxian-context.ts:609: dòng sao lưu ghi cung gốc kèm can chi đầy đủ (bổ sung natalGanZhiVi vào PeriodDynamicStarItem).
- Mượn sao hai chiều: cung mượn giữ câu hiện tại; cung cho mượn thêm câu phủ định tường minh ("cung này KHÔNG mượn sao của đối cung").
- Giới tính: thêm trường giới tính/âm dương vào mọi fact sheet + quy tắc prompt luận Phu Thê theo giới tính đương số.
- Prompt chương cung thêm quy tắc: chỉ dùng can của đúng kỳ tuổi khi nhắc Tứ Hóa Đại Hạn; không gán can kỳ hiện tại cho kỳ khác.
- Khóa cứng: KP-1 KHÔNG đổi định dạng tiêu đề "### Cung …" và badge "[Đại hạn …]"; brief kèm mục rà soát mọi chuỗi nhãn bị đổi và mọi nơi khóa cứng chuỗi đó (builder, sanitizer, system instruction tại server.ts:203, 428, 486, các file verify).
- ĐK-NT-9: độ dài fact sheet từng section sau KP-1 ≤ +15% so với 1.5.3 (đo trên lá số mẫu, ghi số trước/sau); bảng chat không đổi kích thước.
### KP-4 (seam) — theo v1 + công thức vòng 1
- Hàm normalizeContinuationSeam duy nhất ở executor, áp cho chunk đầu của lượt continuation: chèn 1 khoảng trắng khi ký tự cuối của phần cũ không thuộc {khoảng trắng, xuống dòng, dấu mở ngoặc/trích} VÀ ký tự đầu của đoạn mới không thuộc {khoảng trắng, xuống dòng, dấu câu đóng}. Sửa chỉ thị prompt nối tiếp tương ứng. Sanitizer chỉ giữ mẫu từ ghép cố định, cấm regex tách âm tiết tổng quát.
- ĐK-NT-5 mở rộng: 4 ca dương tính (xung|quanh, hội|cùng, [Vượng]|và, từ|đối) + ca âm tính dấu phẩy ("Mệnh|,"), ca âm tính markdown/xuống dòng, ca âm tính trước "**".
### KP-3-lite — quy tắc 1 vào verifier.ts hiện hữu (ĐK-V2-3)
- Mở rộng server/knowledge-base/verifier.ts (nơi verifyAcademicCitationsAndClaims và verifyAndEnsureCompletePeriodSiHua đang chạy) — KHÔNG xây tầng mới song song.
- Quy tắc 1 tối thiểu: chỉ kiểm tra trong KHUNG CUNG — cụm "Cung X (Can Chi)" / "Cung X tại Can Chi" đối chiếu bản đồ cung đúng tầng (bản mệnh ↔ bản đồ bản mệnh; đại hạn/lưu niên ↔ bản đồ kỳ). Ca âm tính bắt buộc: "năm Canh Ngọ 1990" trong chương lưu niên KHÔNG bị gắn cờ.
- Đầu ra Đợt này: ghi vào kênh audit hiện hữu (khung meta/log); nếu kênh đó chưa tới UI thì ghi rõ trong báo cáo thi công — UI danh sách cờ đầy đủ để bản 1.5.6.
### Nghiệm thu riêng của bản (ngoài verify:all)
- ĐK-NT-8 (quan trọng nhất): chạy live giờ thấp điểm trên bản Preview mới — sinh lại chương 3 và chương 5 của lá số 26/07/1977, đối chiếu: (i) không câu nào gắn Can Canh/bộ tứ hóa Can Canh cho kỳ 24–33/34–43; (ii) Quan Lộc = Bính Ngọ; (iii) Phu Thê luận Thái Dương theo giới tính nam.

## BẢN 1.5.5 — Tầng plumbing: KP-2 gói lõi + KP-5 (mở rộng phạm vi)
### KP-2 gói lõi (sửa trọn L5)
- Wildcard phân tầng: mục 04-sihua/07-methodology giữ điểm nguyên lý (+700); wildcard starVi rỗng trên classics-fu/03-patterns hạ xuống +250; khớp đích danh sao+hóa giữ cao nhất.
- W_pattern (+850) chỉ cộng khi mục giao sao/cung với phạm vi truy vấn (section: nhóm cung đang luận; period: cung kỳ hạn). Chat: KHÔNG gating (phạm vi là toàn lá số). Heming: áp như chat — quyết định có ý thức, ghi trong brief (ĐK-V2-5).
- Đóng gói: mục hạng 1/chủ đề không bao giờ bị loại vì kích thước — rút gọn an toàn ở ranh giới câu trong NGUYÊN trần ngân sách Bảng 4.2 (period 2100 ký tự, không nới).
- ĐK-NT-1: verify:kb giữ K1 32/32, K2 15/15, K3 24/24 + ca vàng mới K1-33 (Đại Hạn 44–53 Tài Bạch: NH-SIHUA-001 nằm trong gói ≤2100 ký tự và điểm cao hơn CL-CTP-014).
- Phần retriever mở rộng còn lại (độ tới được, ngân sách tổng thể) vẫn thuộc 1.6.0/Bước 5.
### KP-5 (phân loại lỗi) — phạm vi đầy đủ (ĐK-V2-5)
- Tách FIRST_CHUNK_TIMEOUT thành mã/nhãn riêng NHƯNG bắt buộc ở lại nhánh recordModelIssue (15s model-cooldown, 0 phạt khóa) — điều kiện M1 + ĐK-NT-2 (ca kiểm: healthScore giữ 100, status ready).
- SSE: nhánh catch sau sseStarted=true phải giữ err.code (AI_POOL_EXHAUSTED/AI_NOT_CONFIGURED), errorCategory (bổ sung từ bộ phân loại — PoolExhaustedError hiện không có trường này) và minRemainingCooldownSec trong khung lỗi cuối — điều kiện M2.
- Phạm vi bề mặt: cả 4 endpoint sinh nội dung (period, dossier-section, chat, heming) + thư viện parser dùng chung src/lib/dossier-chat-ui.ts + 2 component DetailedDossierModal và InsightPanel. Client hiển thị thông điệp tiếng Việt theo mã; bỏ fallback "Phản hồi từ AI trống" vô định; token nội bộ không lộ nguyên văn.
- Cổng trước sinh tôn trọng H3 (M3): chỉ chặn ngay khi total==0, hoặc ready==0 && cooldown==0, hoặc ready==0 && minRemainingCooldownSec>30; ngoài ra cho request vào executeStream để H3 chờ.
- ĐK-NT-3 mở rộng: ca HTTP SSE thật giữ mã lỗi sau keepalive trên /api/interpret-dossier-section VÀ /api/interpret-chat. ĐK-NT-4: ca tương thích H3 (ready==0, cooldown ≤30 → không chặn, chạy thành công). ĐK-NT-10: ca parser client — khung lỗi mới hiển thị đúng ở cả 2 component; khung cũ AI_CALL_FAILED vẫn hiển thị thông điệp dự phòng.

## BẢN 1.5.6 — Tầng hành vi: KP-3 đầy đủ + KP-6 + KP-7 tầng 2
### KP-3 đầy đủ (mở rộng verifier.ts)
- Quy tắc 2 (tứ hóa đại hạn theo kỳ): phân đoạn theo block "### Cung …" SAU bước chuẩn hóa tiêu đề của text-sanitizer; khóa theo cặp (khoảng tuổi, can) cùng xuất hiện trong block — không khóa theo chuỗi thẻ (ngữ pháp nhãn đã đổi ở 1.5.4). Chương horizon: tập can hợp lệ = tập governingDaXian trong cửa sổ năm.
- Quy tắc 3 (trích dẫn khớp chủ đề): chỉ áp khi mục KB có neo thực thể cụ thể (starsVi/patternsVi/sihuaCombos có sao cụ thể); mục phương pháp luận tổng quát được miễn.
- Quy tắc 1 bản đầy đủ kế thừa KP-3-lite của 1.5.4. Đầu ra: gắn cờ + UI danh sách cờ theo chương.
- Nghiệm thu: chạy trên hồ sơ 8 chương có sẵn của lá số mẫu — bắt đủ 3 lỗi đã biết (Canh Ngọ ch.5; Can Canh ch.3; CL-CTP-014 ở luận Đại Hạn), 0 cờ giả trên các đường phi tinh đúng (danh sách ca đúng từ A0/A1).
### KP-6 (điều phối) — cầu chì kép
- Lỗi tạm thời (FIRST_CHUNK_TIMEOUT, NETWORK_OR_5XX, MODEL_UNAVAILABLE, RATE_LIMIT_RPM, TPM_GUARD_SKIP, AI_POOL_EXHAUSTED với minRemainingCooldownSec ≤60): bỏ qua, chạy tiếp, đưa vào hàng đợi thử lại đúng 1 vòng cuối lượt.
- Lỗi chết toàn cục (AI_NOT_CONFIGURED, mọi khóa disabled/AUTH_INVALID_KEY, AI_POOL_EXHAUSTED với minRemainingCooldownSec >60, người dùng bấm Dừng): dừng ngay toàn vòng.
- Partial: snapshot bestPartialSoFar trước khi sinh lại; chỉ ghi đè khi lượt mới hoàn tất hoặc partial mới dài hơn; thông báo nhỏ khi khôi phục bản dài hơn. Đổi nhãn nút thành "Sinh lại chương này".
- ĐK-NT-6: đủ 3 ca 6a (lỗi tạm thời → chạy tiếp + retry cuối), 6b (lỗi toàn cục → dừng ngay ở chương 1), 6c (partial 1500 ký tự được giữ khi lượt mới đứt ở 400).
- Nối tiếp xuyên request (gửi priorText): KHÔNG thuộc bản này — đánh giá riêng sau khi KP-4 đã ổn định.
### KP-7 tầng 2
- Banner Kho Khóa khi ready<3, phân biệt hai thông điệp: total<3 ("kho có ít hơn 3 khóa") vs total≥3 nhưng ready<3 ("chỉ còn X/Y khóa sẵn sàng").
- Xuất/nhập gói sao lưu pool mã hóa bằng PASSPHRASE do người dùng nhập (dẫn xuất khóa PBKDF2/HKDF + AES-256-GCM), gói đủ keys + labels + detectedProjectNumber + modelConfig — độc lập với .pool-master.key (phương án 2A của vòng 1; cấm xuất nguyên file .enc.json theo khóa chủ ngẫu nhiên).
- ĐK-NT-7: ca khôi phục xuyên container dirA→dirB đạt 100% khóa/nhãn/project/modelConfig.
- Firestore: không làm (chỉ xét lại nếu app ở lại AI Studio dài hạn thay vì lên máy chủ riêng).

## Kỷ luật thi công áp cho cả 3 bản (ĐK-V2-1)
- Mỗi brief kèm DANH SÁCH TRẮNG các assertion kiểm thử được phép sửa (rút kinh nghiệm 1.5.3: ngoài danh sách, assertion giữ nguyên hoặc báo lại, cấm tự ý sửa cho khớp).
- Cổng theo gói: thi công xong gói nào, chạy đúng bộ verify của gói đó và ghi kết quả vào báo cáo thi công trước khi sang gói tiếp theo.
- Quy trình như các bản 1.5.x: brief gắn KHỐI CHUẨN → Hydrogen thi công tại AI Studio → sync nguồn về workspace → kiểm chứng độc lập (verify:all + các ĐK riêng của bản) → nghiệm thu live trên lá số mẫu khi bản chạm tầng nội dung.
- Hoàn nguyên độc lập theo từng bản bằng gói nguồn src-vNN tương ứng.

## Việc KHÔNG làm trong phương án này
- Không sửa engine an sao (đã kiểm chứng đúng toàn bộ — A0).
- Không sửa 5 lỗi dữ kiện trong hồ sơ đã xuất của Saint (việc riêng, chờ lệnh).
- Không đổi học thuyết/quy ước luận giải hiện hành của app (KP-1.4 chỉ nối giới tính vào cách luận, không đổi hệ quy chiếu sao phối ngẫu).
