# KẾ HOẠCH THỬ NGHIỆM MODEL MỚI CHO APP TỬ VI — GEMINI 4 HYDROGEN & GEMMA 4 31B

Soạn: Muse, tối 20/11/2026, theo lệnh của Saint kèm bảng rate limit free tier mới nhất.
Trạng thái: BẢN THẢO v2 — đã bổ sung 5 điểm tự rà soát theo lệnh duyệt của Saint lúc 23:10 20/11/2026 (kịch bản hạn mức gộp cho Hydrogen; vai trò kiến trúc cho Gemma; chấm tách section khó; kiểm tra cửa sổ ngữ cảnh; probe diễn đạt nguồn Hán). Chờ Saint quyết QĐ-M1..M3 ở Mục 7. Chưa chạy bất kỳ lượt dò/gọi nào theo kế hoạch này.

## 1. Dữ kiện đầu vào (đọc từ bảng rate limit Saint gửi, của "Gemini Project 3", free tier)

| Model | RPM | TPM | RPD | Ghi chú |
|---|---|---|---|---|
| gemini-3.5-flash-lite (đang là model chính của app) | 15 | 250K | 500 | Đối chứng |
| gemini-3.8-flash (đang là dự phòng) | 5 | 250K | 20 | Có hạn mức thật — lỗi 503 tối 20/11 là quá tải phía Google, không phải hết hạn mức |
| **gemini-4-hydrogen** | 5 | 250K | **20** | Ứng viên 1 — đã có sẵn trong danh sách model app hỗ trợ |
| **gemma-4-31b** | 30 | **16K** | **14.400** | Ứng viên 2 — RPD rất lớn, TPM rất nhỏ; chưa có trong danh sách model của app |
| gemma-4-26b | 30 | 16K | 14.400 | Dự bị nếu 31B không tương thích |
| gemini-4-argon / gemini-4-carbon | 0 | 0 | 0 | Không có quota API free — loại khỏi thử nghiệm |

Ba lưu ý nền bắt buộc phải xử lý trong kế hoạch:
1. **Bảng trên là số của đúng một project.** Quota tính theo project × model; kho project của Saint trạng thái rất không đồng đều (nhiều project hạn mức 0). Mọi kết luận phải dựa trên ma trận dò thật ở Pha 0, không dựa trên bảng này.
2. **Hydrogen chỉ có 20 RPD/project** — ngang 3.8-flash, kém xa 500 của 3.5-flash-lite. Nhưng KHÔNG mặc định kết luận nó chỉ làm được dự phòng: app là dùng cá nhân, một hồ sơ đầy đủ tốn khoảng 15–25 lượt gọi, nên tổng hạn mức gộp = 20 × (số project có quota) có thể đủ cho cả vai trò model chính. Pha 0 phải lập bảng kịch bản theo số project khả dụng (xem Mục 3) trước khi gán vai trò.
3. **Gemma 4 31B có TPM 16K** — prompt hồ sơ của app sau khi đóng gói tri thức dài vài nghìn ký tự, cộng phần sinh ra có thể áp sát hoặc vượt ngân sách token/phút này; phải đo token thực tế của prompt trước khi kết luận dùng được cho luồng nào (chat ngắn có thể vừa, hồ sơ dài có thể không). Hai điểm khác phải xác minh riêng: (i) cửa sổ ngữ cảnh tối đa của Gemma là thông số khác hẳn TPM và chưa biết; (ii) thế mạnh 14.400 RPD của Gemma là tài nguyên kiến trúc, không chỉ là "nhiều lượt gọi" — hai vai trò phải thử đúng thế mạnh này là model mặc định cho các luồng ngắn (giải phóng hạn mức model chính cho hồ sơ dài) và chân dự phòng KHÁC HỌ (khi dòng Gemini sập diện rộng như các lỗi 503 tối 20/11, một chân khác họ có cơ hội sống sót độc lập).

## 2. Câu hỏi thử nghiệm

- Q1: Gemini 4 Hydrogen có cho chất lượng luận giải tiếng Việt tốt hơn 3.5-flash-lite rõ rệt không (đúng dữ kiện, bám tri thức, không bịa, văn phong), và độ ổn định vận hành của nó ở free tier ra sao?
- Q2: Gemma 4 31B có chạy được các luồng của app không (tương thích streaming, system instruction, độ dài prompt), chất lượng ở mức nào, và TPM 16K giới hạn nó vào những luồng nào?
- Q3: Cấu hình model tối ưu cho app sau thử nghiệm là gì: giữ nguyên (chính 3.5-flash-lite / dự phòng 3.8-flash), thay dự phòng bằng Hydrogen, thêm Gemma cho luồng nhẹ, hay phương án khác — xét cả chất lượng lẫn tổng quota khả dụng của kho key hiện có?

## 3. Pha 0 — Dò khả dụng theo model (nửa buổi, không sửa app)

- Mở rộng script dò key hiện có (`work/probe_keys.py`): dò theo TỪNG model ứng viên (gemini-4-hydrogen, gemma-4-31b, gemma-4-26b; đối chứng gemini-3.8-flash và gemini-3.5-flash-lite) trên toàn bộ key còn sống, mỗi key × model đúng 1 lượt gọi tối thiểu, giãn cách an toàn. Tên model ID chính xác xác minh qua API liệt kê model trước khi dò (không đoán chuỗi ID, nhất là với Gemma).
- Sản phẩm: ma trận project × model (khả dụng / quota 0 / lỗi), tổng RPD khả dụng theo từng model, kèm metadata cửa sổ ngữ cảnh tối đa của từng model ứng viên lấy từ API liệt kê model.
- Bảng kịch bản hạn mức gộp cho Hydrogen (và đối chiếu cho Gemma): với N = số project khả dụng đo được, tổng RPD = 20 × N; quy đổi ra số hồ sơ đầy đủ/ngày theo chi phí 15–25 lượt gọi/hồ sơ ở các mốc N = 3 / 5 / 10 / toàn bộ kho khả dụng — căn cứ để Pha 3 quyết vai trò chính hay dự phòng bằng số, không bằng cảm tính.
- Cổng đi tiếp: mỗi model ứng viên phải có ≥ 3 project khả dụng mới đưa vào Pha 1; model nào dưới ngưỡng thì dừng ở pha này và ghi nhận.
- Lợi ích phụ: lượt dò 3.8-flash ở pha này đồng thời trả lời tình trạng của hạng mục C1 trong kế hoạch nợ kỹ thuật (nếu 3.8 đã phản hồi lại được thì chạy luôn kiểm chứng bổ sung ở đó).

## 4. Pha 1 — A/B chất lượng trên bộ tác vụ chuẩn (chạy cục bộ, không sửa app)

- Bộ tác vụ cố định (giữ nguyên như lượt kiểm chứng live 20/11 để so sánh được): lá số Nguyễn Văn An — section hồ sơ palaces_core, section horizon_5y, luận lưu niên 2026, cộng 2 câu chat (một câu sức khỏe, một câu vận hạn). Mỗi model chạy đúng bộ này qua chính pipeline của app (bản chạy cục bộ như live-test), để prompt và tầng kiểm toán trích dẫn giống hệt production.
- Thêm 1 tác vụ diễn đạt nguồn Hán: chọn lá số/section mà gói tri thức đóng gói chứa nhiều trích dẫn cổ thư nhất (đo được từ rig hiện có), chạy trên mọi model; chấm riêng mức trung thành khi diễn đạt lại nội dung nguồn Hán sang tiếng Việt (đúng ý nguyên văn, không thêm bớt) — đây là probe cho năng lực dịch/xử lý dữ liệu mà Saint nêu khi giao việc.
- Kiểm tra tương thích rẻ trước cho Gemma: 1 lượt gọi ngắn nhất để xác nhận streaming + system instruction + định dạng phản hồi, và 1 lượt gọi bằng prompt dài nhất của bộ tác vụ để xác nhận cửa sổ ngữ cảnh chứa đủ; không qua thì Gemma dừng tại đây, ghi rõ lỗi.
- Đo cơ học cho từng lượt: thành công/ngắt, độ trễ, độ dài, kết quả citationAudit (số khẳng định thiếu trích dẫn, số ID bịa bị hệ thống gạt), số token prompt (đối chiếu TPM của Gemma).
- Chấm chất lượng: Muse chấm theo rubric 6 tiêu chí (đúng dữ kiện lá số; bám nội dung tri thức được nạp; không thêm ý ngoài nguồn; mạch lạc/văn phong tiếng Việt; đúng định dạng section; trung thành khi diễn đạt nội dung nguồn Hán — chỉ áp cho tác vụ diễn đạt và các section có trích dẫn cổ thư) trên thang điểm ghi sẵn TRƯỚC khi xem kết quả. Báo cáo điểm PHẢI tách riêng hai section khó nhất (horizon_5y và luận lưu niên — nơi gói tri thức dày nhất và prompt dài nhất) bên cạnh điểm trung bình toàn bộ, vì giả thuyết đặt trước là lợi thế bám chỉ dẫn của Hydrogen lộ rõ nhất ở prompt khó; sau đó trình Saint đọc mù 2–3 cặp đối chứng (model hiện tại vs ứng viên) để chốt cảm quan — quyết định cuối về "tốt hơn" thuộc về cảm quan của Saint, rubric chỉ là lớp lọc đầu.
- Ngân sách quota: mỗi model tối đa ~8 lượt gọi/vòng, rải trên nhiều project để không chạm trần 20 RPD của Hydrogen; tổng thử nghiệm giữ trong một phần nhỏ hạn mức ngày.

## 5. Pha 2 — Tích hợp thử có kiểm soát (chỉ với model qua Pha 1)

- Thêm model vào cấu hình kho khóa trên bản cục bộ (Gemma cần bổ sung vào danh sách model hỗ trợ — việc này ở Pha 2 vẫn làm trên bản sao, chưa qua AI Studio): đặt thử vai trò dự kiến (dự phòng hoặc chính cho luồng được chọn), chạy verify:all bảo đảm không vỡ hành vi hiện có.
- Chạy bền: ~20 lượt gọi rải trong ngày trên đúng vai trò đó, ghi tỷ lệ thành công, độ trễ trung bình, số lần failover. Ngưỡng đạt đặt trước: tỷ lệ thành công ≥ 90% và không thấp hơn đối chứng 3.5-flash-lite đo cùng điều kiện.
- Riêng với Gemma ở vai trò dự phòng khác họ: trong cửa sổ chạy bền, ghi lại mọi thời điểm các model dòng Gemini lỗi đồng loạt (429/503) và Gemma có thành công ở cùng thời điểm đó không — bằng chứng về tính độc lập khi sập theo họ model. Không tạo được sự cố giả, nên tiêu chí này ghi nhận cơ hội quan sát được, không đặt ngưỡng cứng.
- Riêng với Gemma ở vai trò mặc định cho luồng ngắn: chạy chat bằng Gemma trọn cửa sổ bền và đối chiếu tỷ lệ lỗi 429 của luồng chat so với khi chat chạy trên model chính (kỳ vọng: biến mất nhờ hạn mức 14.400 RPD).

## 6. Pha 3 — Quyết định và triển khai

- Tiêu chí chốt (đặt trước, không nới sau khi thấy kết quả): ứng viên chỉ thay thế/bổ sung khi (i) điểm rubric trung bình cao hơn đối chứng và được Saint xác nhận ở vòng đọc mù, (ii) riêng ở hai section khó, ứng viên không thua đối chứng (điều kiện bổ sung cho Hydrogen, vì đó là nơi nó phải thắng), (iii) độ bền Pha 2 đạt ngưỡng, (iv) tổng RPD khả dụng của kho cho model đó đủ cho mức dùng cá nhân của app theo bảng kịch bản ở Pha 0 (ước lượng từ số lượt gọi thực tế của một hồ sơ đầy đủ × số hồ sơ/ngày Saint thường chạy).
- Nếu đạt: soạn brief AI Studio (Hydrogen thi công) cập nhật cấu hình model mặc định/danh sách hỗ trợ, phát hành bản vá 1.5.x; Muse kiểm chứng độc lập + live lại như thường lệ. Nếu không đạt: đóng thử nghiệm, ghi kết quả vào hồ sơ dự án, giữ nguyên 1.5.0.
- Quan hệ với kế hoạch nợ kỹ thuật: thử nghiệm này độc lập với Đợt 1 (kho khóa) và Đợt 2 (retriever); nhưng nếu Hydrogen thắng ở vai trò dự phòng, hạng mục C1 (kiểm chứng 3.8-flash) có thể đóng bằng cách thay thế thay vì kiểm chứng bổ sung — điểm này trình Saint quyết khi có kết quả Pha 1.

## 7. Điểm chờ Saint quyết

- **QĐ-M1**: Vai trò ứng viên — bản v2 đã thiết kế để MỞ theo thế mạnh từng model (Hydrogen thử cả chính lẫn dự phòng; Gemma thử cả mặc định-cho-luồng-ngắn lẫn dự phòng khác họ). Saint chỉ cần quyết nếu muốn THU HẸP phạm vi này.
- **QĐ-M2**: Pha 0 có chạy ngay trong đợt này không, hay gộp vào Đợt 1 của kế hoạch nợ kỹ thuật (vì cùng đụng tới kho key)?
- **QĐ-M3**: Ngưỡng tổng RPD tối thiểu để coi một model là "dùng được" cho app — theo mức dùng thực tế của Saint (số hồ sơ chạy một ngày điển hình) là bao nhiêu?
