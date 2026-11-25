# BRIEF 1.5.5 v2 — Khắc phục 20 lỗi hồ sơ sinh lại toàn bộ (panel 2 vòng 25/11/2026)

- App: Tử vi đẩu số (AI Studio, app id `1764de0f-8db5-496a-9afb-431a89d02b47`).
- Nền: bản 1.5.4 (`~/workspace/ziwei-app-src-v23/`). Bản này nâng VERSION lên **1.5.5**.
- Căn cứ: `~/workspace/ziwei-kb-distill/work/PHAN-BIEN-VONG-2-HO-SO-MOI-1.5.4.md` (báo cáo vòng 2 đã kiểm chứng trên file hồ sơ thật + code src-v23) và hồ sơ lỗi `~/workspace/your_files/la-so-do-vu-toan/Ho-So-Tu-Vi-Do-Vu-Toan-8-8-sinh-lai-toan-bo-1.5.4.md`.
- Model thi công: **Gemini Hydrogen** (thi công theo kế hoạch đã duyệt).
- ⚠️ BÀI HỌC BẮT BUỘC: báo cáo vòng 1 trích số dòng code lệch hệ thống (2–20 dòng). Brief này **chỉ trích theo TÊN HÀM**, không trích số dòng. Assistant tự định vị hàm bằng tên trong code; nếu tên hàm không khớp, DỪNG và báo cáo, không đoán vị trí.

## Thay đổi so với v1 — điều kiện panel bắt buộc (ĐK-155-P1..P10, vòng 1 Argon + vòng 2 Muse kiểm chứng)
- **P1 (X2)**: khi parse nội dung thẻ `[Nguồn: ...]`, phải cắt hậu tố chú thích sau dấu `·` hoặc `|` TRƯỚC khi kiểm mẫu ID; dấu phẩy trong phần chú thích không tạo ứng viên ID mới. Xem X2 bên dưới.
- **P2 (X2)**: `scrubInvalidCitationTags` (text-sanitizer.ts, chạy độc lập phía Client) cũng phải tự parse thẻ đa ID như X2, chỉ loại ứng viên trong `invalidIds` hoặc không khớp mẫu ID, trả về các thẻ đơn hợp lệ còn sống.
- **P3 (X2)**: chuẩn hóa ứng viên bằng `.trim().toUpperCase()` trước khi so mẫu ID; thẻ rỗng hoặc chỉ chứa dấu phân cách → lỗi V1 + scrub sạch vỏ thẻ.
- **P4 (Y1)**: giữ nguyên biến `${layerTag} ${prefix}` (cả 'Lưu' và 'Đại Hạn') và dấu `*...*` quanh `*(trùng Bản Mệnh gốc: ...)*`; chỉ di chuyển phần `· [natalMutagen]` lên sau độ sáng của sao.
- **P5 (Y2)**: chỉ sửa `periodTitleVi` ở nhánh Lưu Niên (nhánh Đại Hạn giữ nguyên); dòng fact sheet chung dùng hậu tố `— nơi Cung ${prefix} Mệnh Cung tọa thủ`.
- **P6 (Y6)**: đổi sao lưu sang đủ Can Chi ở CẢ hai nơi: biến `dynamicStarsSummaryVi` KHÔNG đụng (giữ chi-only để bảo vệ trần chat, xem P7) — sửa `periodCtxLabelDynStars` (dòng (7) Sao lưu động chính, cả chương 7 và 8). Về đối cung xung chiếu chương 7: dòng (6) Bộ Lưu Tứ Hóa trong `detailLines` ĐÃ CÓ SẴN đối cung — lỗi là do model bỏ sót khi viết, nên Y6a chuyển thành quy tắc prompt (xem Y6).
- **P7 (Y6, quyết theo nhánh thay thế của panel)**: KHÔNG nới trần chat. Trần chat giữ nguyên **≤ 13.100 ký tự** (khóa cứng Saint chốt ở 1.5.4). Chú thích năm Lưu Mệnh trùng Mệnh gốc và nhãn Đại Hạn mới chỉ gắn trong `detailLines` (`horizon.factSheetMarkdown`), tuyệt đối không nhét vào `compactMatrixMarkdown`; `dynamicStarsSummaryVi` giữ nguyên dạng chi-only.
- **P8 (Z3)**: rào ngữ cảnh — `bảo ninh` chỉ khớp chữ thường (không đụng địa danh "Bảo Ninh" viết hoa); `HOÁ` chỉ thay khi đứng trước tên Tứ Hóa (Lộc/Quyền/Khoa/Kỵ); thứ tự alternation đặt dạng dài trước dạng ngắn (`secondNumber` trước `second`).
- **P9 (Z5)**: tách câu trên block THÔ trước khi xóa thẻ; regex tách câu không cắt dấu chấm của số thứ tự đầu dòng hay dấu chấm giữa hai chữ số; câu có M1/M2 hợp lệ nếu trong chính câu đó có ≥ 1 thẻ `[Nguồn: ID]` mà ID đã pass V1+V3 ở cấp khối.
- **P10 (Z2/Z5/C-06.3)**: Z2 viết tổng quát "giao thoa với Đại Hạn gốc chi phối hiện hành", KHÔNG hardcode dữ kiện lá số 1977 ("44–53 tuổi tại Tài Bạch · Can Canh") vào system prompt dùng chung; bổ sung quy tắc cấm lặp tiêu đề chương 7/8 + thống nhất `### 1.` (C-06.3 — v1 bỏ sót); đổi hướng dẫn vị trí gắn thẻ trong cả hai prompt từ "ở cuối đoạn hoặc mục bullet" thành "ngay cuối câu có viện dẫn hoặc trích dẫn đó".

## Phạm vi — 3 nhóm (X: trích dẫn · Y: định dạng gây hiểu sai · Z: prompt + sanitizer)

### Nhóm X — Chặn rò rỉ trích dẫn học thuật (B-01, B-02, B-03)

**X1 — Xóa tên file `.ts` khỏi prompt kỳ hạn (B-01).**
Trong `buildStrictPeriodAiPrompt` (server.ts), 3 tiêu đề mục trích đoạn đang chứa tên file: `[Cách cục nhận diện từ patterns.ts]:`, `[Tính chất tinh diệu từ school-data.ts / constants.ts]:`, `[Nguyên lý Tứ Hóa & Tinh hệ từ heming-knowledge.ts]:`. Đổi thành `[Cách cục nhận diện từ lá số]:`, `[Tính chất tinh diệu]:`, `[Nguyên lý Tứ Hóa & Tinh hệ]:`. Không đổi nội dung trích đoạn bên dưới.

**X2 — Regex quét thẻ `[Nguồn: ...]` bắt mọi nội dung + tách thẻ đa ID (B-01, B-02).**
Hai regex hiện tại (`CITATION_TAG_M3_REGEX` trong `server/knowledge-base/verifier.ts` và `CITATION_TAG_SCAN_RE` trong `src/lib/ziwei/text-sanitizer.ts`) chỉ capture 1 mã ID dạng `[A-Z0-9_-]{4,24}` và nuốt phần còn lại vào nhóm chú thích — hệ quả: thẻ `[Nguồn: school-data.ts / constants.ts]` lọt hoàn toàn (chứa `.` và `/`); thẻ `[Nguồn: CL-TT-015, CL-CTP-013]` chỉ kiểm tra ID đầu, ID thứ hai không bao giờ được kiểm V1/V3 và mất khỏi mục tài liệu tham chiếu.
- Đổi cả hai regex thành dạng bắt toàn bộ nội dung trong ngoặc: `\[Nguồn:\s*([^\]]*)\]` (dùng `*` để bắt luôn thẻ rỗng), rồi parse nội dung theo thuật toán chuẩn sau (áp dụng ĐỒNG NHẤT ở cả verifier.ts và text-sanitizer.ts — viết một hàm parser dùng chung hoặc đồng bộ logic hai nơi):
  1. Với mỗi match, lấy chuỗi trong ngoặc. Cắt hậu tố chú thích sau dấu `·` hoặc `|` TRƯỚC mọi bước khác: phần trước dấu `·`/`|` đầu tiên là phần ID; phần sau là chú thích (kể cả khi chú thích chứa dấu phẩy — dấu phẩy trong chú thích KHÔNG tạo ứng viên ID mới).
  2. Tách phần ID theo dấu `,` / `;` (và `/` — xem dưới) thành các ứng viên; mỗi ứng viên `.trim().toUpperCase()` rồi kiểm tra mẫu `^[A-Z0-9_-]{4,24}$` + tồn tại trong gói trích đoạn đã nạp.
  3. Thẻ rỗng hoặc chỉ chứa dấu phân cách (`[Nguồn: ]`, `[Nguồn: , ; ]`, `[Nguồn: ·]`) → lỗi V1 và scrub sạch vỏ thẻ.
  4. Dấu `/` cũng là dấu tách ứng viên: `[Nguồn: CL-TT-015 / CL-CTP-013]` tách thành 2 ID hợp lệ; `[Nguồn: school-data.ts / constants.ts]` tách thành 2 ứng viên đều chứa `.` → cả hai lỗi V1, scrub sạch.
- Ứng viên nào không khớp mẫu ID (ví dụ chứa `.`, `/`, khoảng trắng trong từ) → đánh lỗi V1 (mã không hợp lệ) và đưa vào danh sách scrub.
- Chuẩn hóa: trước khi kiểm V1/V3 và trước khi scrub, tách mọi thẻ đa ID thành các thẻ đơn `[Nguồn: ID1] [Nguồn: ID2]` (giữ nguyên thứ tự, giữ nguyên vị trí trong câu).
- Giữ nguyên hành vi với thẻ đơn ID hợp lệ và với hậu tố chú thích tiêu đề sau dấu `·` (ví dụ `[Nguồn: CL-TT-015 · Cách Cơ Nguyệt Đồng Lương]` vẫn hợp lệ, chỉ kiểm ID đầu; `[Nguồn: NH-WRONG-1 | video 2]` vẫn bị V1 như test K3-A[5] hiện tại).
- `scrubInvalidCitationTags` phải tự parse thẻ đa ID theo cùng thuật toán: quét theo cùng regex, tách từng ứng viên; ứng viên nào không khớp mẫu ID hoặc nằm trong `invalidIds` (hoặc ngoài `allowedIds` khi được truyền) thì loại bỏ; các ứng viên hợp lệ còn lại được xuất thành các thẻ đơn `[Nguồn: ID1] [Nguồn: ID2]` (giữ hậu tố `· ...` nếu là thẻ đơn hợp lệ).

**X3 — Đồng bộ danh mục tham chiếu với scrub (B-03).**
Trong `verifyAcademicCitationsAndClaims` (verifier.ts): hiện tại một ID có thể vừa nằm trong `validIdsInOrder` (nhờ 1 vị trí dùng đúng) vừa nằm trong `scrubbedInvalidIds` (nhờ 1 vị trí dùng sai chủ đề V3) — scrubber xóa toàn cục mọi thẻ mang ID đó khỏi thân bài nhưng mục tài liệu tham chiếu (dựng từ `validIdsInOrder`) vẫn in ID đó.
- Quy tắc mới: **nếu một ID nằm trong `scrubbedInvalidIds` thì LOẠI nó khỏi `validIdsInOrder`** (và khỏi `usedValidEntries` / `validCitationIds` trả về). Mục tài liệu tham chiếu chỉ liệt kê ID còn thẻ sống trong thân bài sau scrub. Không đổi logic chấm V3 theo khối.

### Nhóm Y — Sửa định dạng gây hiểu sai (A-01, A-02, A-05, C-03, C-06.1, D-03, D-04)

**Y1 — Đưa ghi chú `[Bản mệnh Hóa ...]` lên sát tên sao (A-02, D-01).**
Hàm `formatPeriodSiHuaFactLine` (yunxian-context.ts) hiện đặt phần `· [natalMutagen]` ở CUỐI dòng, sau cụm đối cung xung chiếu — model đọc nhầm thành sao/tứ hóa của đối cung. Đổi thứ tự thành: `• **${layerTag} ${prefix} ${mutagenVi} → Sao ${starNameVi} [${brightnessVi}]${natalNote}**: tọa thủ tại **Cung ${periodPalaceRoleVi}** *(trùng Bản Mệnh gốc: ${natalPalaceNameVi} - ${natalPalaceGanZhiVi})* — đối cung xung chiếu: **Cung ${oppositePeriodPalaceRoleVi}** *(trùng Bản Mệnh gốc: ${oppositePalaceNameVi} - ${oppositePalaceGanZhiVi})*.` Trong đó `${natalNote}` là ` · [Bản mệnh Hóa X]` (nếu có) gắn sát ngay sau độ sáng của sao, bên trong cụm in đậm. GIỮ NGUYÊN biến `${layerTag} ${prefix}` (hỗ trợ cả 'Lưu' và 'Đại Hạn' — KHÔNG hardcode chữ `[Tứ Hóa Lưu Niên] Lưu`) và giữ cặp dấu `*...*` quanh `*(trùng Bản Mệnh gốc: ...)*`. Không đổi nội dung các trường khác. Lưu ý: khối > 📌 cuối chương 5/6 dùng chính hàm này nên tự hết lỗi theo.

**Y2 — Ghi rõ cung Bản Mệnh gốc được kỳ hạn kích hoạt (A-01).**
- `periodTitleVi` trong yunxian-context.ts hiện sinh `… · Kích hoạt cung {Tên cung}` (mơ hồ: model đọc thành "Cung Lưu {Tên cung}"). Đổi thành `… · Kích hoạt cung Bản Mệnh gốc {Tên cung} ({Can Chi}) — nơi Cung Lưu Mệnh Cung tọa thủ`. CHỈ áp dụng cho nhánh Lưu Niên (nhánh Đại Hạn giữ nguyên mẫu tiêu đề hiện tại).
- Dòng fact sheet `• **Cung bản mệnh được kích hoạt**: Cung **{Tên} ({Can Chi})** — {vai trò}` (cùng file) giữ nguyên ý, bổ sung hậu tố `— nơi Cung ${prefix} Mệnh Cung tọa thủ` vào cuối dòng (khi prefix là 'Lưu' cho ra đúng chuỗi `— nơi Cung Lưu Mệnh Cung tọa thủ`; khi là 'Đại Hạn' cho ra `— nơi Cung Đại Hạn Mệnh Cung tọa thủ`).

**Y3 — Đổi nhãn tĩnh "Bộ Kình Đà" (A-05).**
Trong yunxian-context.ts, dòng fact sheet `• **Bộ Kình Đà (Dương Đà giáp Lộc)**: …` đổi thành `• **Bộ Kình Đà lưu niên (kẹp hai bên cung Lưu Lộc Tồn)**: …`. Chỉ đổi nhãn, không đổi dữ kiện sao lưu.

**Y4 — Dịch `pat.level` sang tiếng Việt (C-03).**
Trong `buildNatalOverviewFactSheetVi` (dossier-context.ts), dòng cách cục đang nối trực tiếp giá trị thô `pat.level` (`excellent`/`good`/`neutral`/`bad`) thành `[excellent]` trong fact sheet — model chép nguyên ra hồ sơ. Ánh xạ trước khi nối: `excellent → Thượng cách`, `good → Cát cách`, `neutral → Trung bình`, `bad → Hung cách`. Thêm rule scrub dự phòng trong `sanitizeAiVietnameseOutput` (xem Z3).

**Y5 — Sửa tiêu đề cung Mệnh (C-06.1).**
Hàm `formatCanonicalPalaceHeading` (dossier-context.ts) ghép cứng `### Cung {tên cung}`; riêng cung Mệnh có tên đã là `Mệnh Cung` nên thành `### Cung Mệnh Cung`. Sửa: nếu tên cung là `Mệnh Cung` thì tiêu đề là `### Cung Mệnh ({Can Chi}) {badges}`; các cung khác giữ nguyên.

**Y6 — Đồng bộ horizon (chương 7/8) sang chuẩn 1.5.4 (D-03, D-04).**
Hàm `buildMultiYearHorizonContext` (dossier-context.ts) vẫn dùng format cũ. Sửa như sau (CHỈ trong `detailLines` / `horizon.factSheetMarkdown`, tuyệt đối không đụng `compactMatrixMarkdown`):
- Nhãn Đại Hạn: đổi `[Tứ Hóa Đại Hạn - Can {Can}]` (biến `dxPrefix`, dùng trong `siHuaSummaryVi` ở dòng (3) Đại Hạn chủ quản) thành nhãn mới theo kỳ: kỳ hiện tại → `[Tứ Hóa Đại Hạn HIỆN TẠI ({tuổi} · Can {Can})]`; kỳ khác → `[Tứ Hóa Đại Hạn Kỳ {X–Y} (đóng tại {Cung} · Can {Can})]`. (Dùng đúng định dạng nhãn đã dùng ở nhóm cung chương 2/3/4.)
- Sao lưu: đổi `(${Tên cung} - {Chi})` thành `(${Tên cung} - {Can Chi})` đầy đủ (ví dụ `Điền Trạch - Tỵ` → `Điền Trạch - Ất Tỵ`) ở hàm helper `periodCtxLabelDynStars` (dòng (7) Sao lưu động chính, cả chương 7 và 8). KHÔNG đụng biến `dynamicStarsSummaryVi` (dùng cho `compactMatrixMarkdown`): giữ nguyên dạng chi-only để bảo vệ trần chat ≤ 13.100 (xem P7).
- Đối cung xung chiếu chương 7 (Y6a — QUY TẮC PROMPT, không phải sửa code): dòng (6) Bộ Lưu Tứ Hóa trong `detailLines` ĐÃ CÓ SẴN đối cung xung chiếu cho cả 4 hóa; lỗi là model bỏ sót khi viết chương 7 (chương 8 viết đủ vì được nạp thêm `compactMatrixMarkdown` làm mẫu). Bổ sung vào `buildStrictDossierSectionPrompt` (nhánh horizon): "Khi liệt kê 4 sao Lưu Tứ Hóa của từng năm, BẮT BUỘC theo đúng mẫu: `{Sao} Hóa {X} tại Cung Lưu {A} [trùng {B}] (xung Cung Lưu {C} [trùng {D}])` — không được lược đối cung xung chiếu."
- Khi Lưu Mệnh của năm trùng Mệnh Cung gốc (Chi Dần của lá số này — năm 2034; quy tắc chung theo `chart.mingGongBranch`): gắn chú thích ngay sau dòng năm trong `detailLines`: `*(Lưu Mệnh trùng Mệnh gốc tại {Chi} nên cả 12 cung Lưu Niên năm này trùng tên với 12 cung Bản Mệnh)*`. KHÔNG gắn chú thích này vào `compactMatrixMarkdown`.
- Trần kích thước mới cho fact sheet horizon (đo sau khi sửa, xem ĐK-155-04): horizon_5y ≤ 14.200 ký tự; horizon_10y ≤ 37.800 ký tự; chat giữ nguyên ≤ 13.100 ký tự. Nếu vượt trần thì DỪNG và báo cáo, không tự cắt nội dung.

### Nhóm Z — Prompt + sanitizer (A-06, D-02, C-01/C-02/C-04/C-05, A-04, B-04)

**Z1 — Bắt buộc luận dòng Tứ Hóa Đại Hạn kỳ riêng của từng cung (A-06).**
Trong `buildStrictDossierSectionPrompt` (server.ts), quy tắc hiện tại chỉ dặn dạng điều kiện ("Khi nhắc Tứ Hóa Đại Hạn của một kỳ tuổi, chỉ dùng Can và bộ sao của đúng kỳ đó…"). Bổ sung quy tắc bắt buộc: "Trong mỗi cung thuộc Chương 2, 3, 4, BẮT BUỘC phân tích dòng `[Tứ Hóa Đại Hạn Kỳ X–Y]` gắn với đại hạn đóng tại cung đó (nêu rõ kỳ tuổi, Thiên Can và đủ 4 hóa Lộc/Quyền/Khoa/Kỵ), bên cạnh `[Phi Tinh Can Cung ...]`." Không đổi các quy tắc khác.

**Z2 — Sàn độ dài + kỷ luật dòng Lưu Tứ Hóa cho chương 5/6 (D-02, A-03, C-06.2).**
Trong `buildStrictPeriodAiPrompt` (server.ts):
- Bổ sung sàn độ dài: thân bài chương Lưu Niên **900–1.300 từ**, phân tích đủ Tam Phương Tứ Chính của Lưu Mệnh (Lưu Mệnh – Lưu Tài – Lưu Quan – Lưu Di) và giao thoa với Đại Hạn gốc chi phối hiện hành. LƯU Ý BẮT BUỘC: viết quy tắc ở dạng TỔNG QUÁT ("giao thoa với Đại Hạn gốc chi phối hiện hành", đọc từ `periodContext.parentDaXian` / Bảng dữ kiện) — KHÔNG hardcode dữ kiện lá số mẫu 1977 ("44–53 tuổi tại Tài Bạch · Can Canh") vào system prompt dùng chung cho mọi lá số. (Chuỗi "44–53 tuổi tại Tài Bạch · Can Canh" trong brief này chỉ là giá trị mẫu của lá số 26/07/1977 để hiểu ngữ cảnh.)
- Bổ sung quy tắc: mỗi dòng Lưu Tứ Hóa BẮT BUỘC nêu đủ tên Hóa + tên sao + độ sáng (ví dụ "Lưu Hóa Khoa → Văn Xương [Miếu]"); mỗi lần nêu sao lưu (Lưu Lộc Tồn, Lưu Thiên Mã, Lưu Văn Xương, Lưu Văn Khúc…) BẮT BUỘC kèm tên cung Bản Mệnh gốc trong ngoặc.
- Bổ sung quy tắc: tuyệt đối không mở đầu chương bằng câu dẫn nhập kiểu "Dưới đây là phần luận giải chi tiết cho kỳ hạn …" — vào thẳng đề mục `### 1. …` như các chương khác.

**Z3 — Bộ lọc sanitizer cho lỗi trượt token/từ vựng (C-01, C-02, C-03, C-04, C-05, C-06).**
Bổ sung vào `sanitizeAiVietnameseOutput` (text-sanitizer.ts) các rule thay thế chính xác (chỉ thay khi khớp từ độc lập, dùng biên từ Unicode `(?<!\p{L})...(?!\p{L})`, không thay trong từ khác):
- Số thứ tự trượt: đặt dạng dài TRƯỚC dạng ngắn trong alternation (`firstNumber` trước `first`, `secondNumber` trước `second`, `thirdNumber` trước `third`) để không sót đuôi `Number`: `Thứ secondNumber` / `Thứ second` → `Thứ hai`; `Thứ firstNumber` / `Thứ first` → `Thứ nhất`; `Thứ thirdNumber` / `Thứ third` → `Thứ ba`.
- Lỗi bộ gõ Telex: `Thân Cuv` → `Thân Cư`; `Venh Khúc` → `Văn Khúc`; `Venh Xương` → `Văn Xương`.
- Nhãn enum lọt: `[excellent]` → `[Thượng cách]`; `[good]` → `[Cát cách]`; `[neutral]` → `[Trung bình]`; `[bad]` → `[Hung cách]`.
- Dính chữ thường gặp: `khiâm đau` → `khi ốm đau`.
- Từ sai ngữ cảnh: `đồng điệu mật khẩu` → `đồng điệu mật thiết`; `tránh dùng tôi tớ` → `tránh sự tự ái`; `hoa tụ` → `hội tụ`; `bề vững` → `bền vững`; `danh uy uy tín` → `danh tiếng và uy tín`.
- `bảo ninh` → `bảo toàn`: CHỈ khớp chữ thường `(?<!\p{L})bảo[ \t]+ninh(?!\p{L})` (không dùng cờ `i`) — tuyệt đối không sửa địa danh "Bảo Ninh" viết hoa.
- `HOÁ` → `Hóa`: CHỈ thay khi đứng trước tên Tứ Hóa: `(?<!\p{L})(?:HOÁ|Hoá|HÓA)[ \t]+(Lộc|Quyền|Khoa|Kỵ)(?!\p{L})` → `Hóa $1` — không thay mọi chữ HOÁ độc lập (tránh phá tiêu đề in hoa toàn bộ).
- Viết hoa: `thế Mạnh` (giữa câu, sau từ "trục") → `thế mạnh`.
- Tiêu đề lặp: `### Cung Mệnh Cung` → `### Cung Mệnh` (dự phòng cho Y5).
- CẤM regex tách âm tiết tổng quát; chỉ dùng danh sách cặp cố định trên. Không sửa các từ khác.

**Z4 — Quy tắc "Không Kiếp" (A-04).**
Bổ sung 1 dòng vào cả `buildStrictDossierSectionPrompt` và `buildStrictPeriodAiPrompt`: "Không tự gọi riêng lẻ Địa Không, hoặc cặp Địa Không + Thiên Không, là 'Không Kiếp' nếu Địa Kiếp không đồng cung hoặc không nằm trong Tam Phương Tứ Chính của cung đang luận — 'Không Kiếp' chỉ cặp Địa Không + Địa Kiếp."

**Z5 — Kỷ luật trích dẫn ở prompt chân trời + V2 theo câu (B-04).**
- Trong prompt chương 7/8 (buildStrictDossierSectionPrompt, phần horizon): bổ sung "Chỉ gắn thẻ `[Nguồn: ...]` vào đoạn bình giải lý thuyết tương ứng với chủ đề của thẻ; không gắn thẻ Tứ Hóa chuyên đề đơn lẻ vào câu liệt kê danh sách 4 sao Tứ Hóa Đại Hạn."
- Trong `verifyAcademicCitationsAndClaims`: đổi kiểm V2 từ mức khối sang mức câu — tách mỗi khối thành các câu; một câu có viện dẫn tác giả/trường phái/cổ thư hoặc trích khẩu quyết (M1/M2) mà trong chính câu đó không có thẻ `[Nguồn: ...]` hợp lệ thì đánh lỗi V2 cho câu đó, kể cả khi khối chứa câu đó có thẻ hợp lệ ở câu khác. Quy tắc tách câu an toàn (bắt buộc): tách trên block THÔ (chưa xóa thẻ) — KHÔNG tách trên `blockWithoutTags` (đã xóa sạch thẻ → 100% lỗi giả); chỉ tách theo xuống dòng, dấu `;`, hoặc dấu chấm câu `.` `!` `?` `…` mà KHÔNG phải dấu chấm của số thứ tự đầu dòng (`^\s*\d+\.`) và KHÔNG nằm giữa hai chữ số (`(?<!\d)\.(?!\d)`). Một câu được tính là có thẻ hợp lệ nếu trong chính câu đó có ít nhất 1 thẻ `[Nguồn: ID]` mà ID đã pass V1 và V3 ở cấp khối (V1/V3 vẫn chấm ở cấp khối như cũ). Giữ nguyên ngưỡng M2 (trích dẫn trong ngoặc kép 12–120 ký tự).
- Đồng bộ prompt với cơ chế mới: trong cả `buildStrictPeriodAiPrompt` và `buildStrictDossierSectionPrompt`, đổi hướng dẫn vị trí gắn thẻ từ "ở cuối đoạn hoặc mục bullet" / "vào cuối đoạn/bullet đó" thành "ngay cuối câu có viện dẫn hoặc trích dẫn đó".
- Trong `buildStrictDossierSectionPrompt` (nhánh horizon): bổ sung "Tuyệt đối không mở đầu bằng câu dẫn nhập và không lặp lại tên chương ở đầu bài; sử dụng thống nhất cấp tiêu đề `### 1.`, `### 2.`, `### 3.`, `### 4.` cho các phần chính." (C-06.3 — v1 bỏ sót.)

## Khóa cứng (giữ nguyên như 1.5.4)
- Không đụng: `SI_HUA_TABLE`, engine an sao, `retriever.ts`, allocator/phân loại lỗi, run-all/partial, dữ liệu CSDL (KB JSON), `buildMultiYearHorizonContext` ngoài Y6, UI mới.
- Không đổi tiêu đề `### Cung …`, badge `[Đại hạn …]`, nhãn `[Tứ Hóa Đại Hạn HIỆN TẠI …]` đã chốt ở 1.5.4.
- Trần kích thước fact sheet nhóm cung giữ nguyên 1.5.4: core ≤ 5.100; family ≤ 4.550; social ≤ 4.580; overview ≤ 3.650; chat ≤ 13.100 ký tự. Vượt trần → DỪNG và báo cáo, không tự cắt.
- `verify:all` phải giữ nguyên 100% assertion cũ, trừ DANH SÁCH TRẮNG sau (chỉ sửa phần chuỗi bị đổi bởi brief này):
  1. Assertion về nhãn horizon cũ `[Tứ Hóa Đại Hạn - Can ...]` → nhãn mới (Y6).
  2. Assertion về tiêu đề kỳ hạn `Kích hoạt cung …` → wording mới (Y2).
  3. Assertion về nhãn `Bộ Kình Đà (Dương Đà giáp Lộc)` → nhãn mới (Y3).
  4. Assertion về `pat.level` thô `[excellent]` trong fact sheet tổng quan → nhãn tiếng Việt (Y4).
  5. Assertion về tiêu đề `### Cung Mệnh Cung` → `### Cung Mệnh` (Y5).
  6. Assertion về hành vi regex trích dẫn cũ (1 ID/thẻ; thẻ `.ts` lọt) → hành vi mới (X2).
  7. Assertion về mục tham chiếu khi ID vừa hợp lệ vừa bị V3 (B-03) → ID bị loại khỏi danh mục (X3).
  8. Assertion về kiểm V2 theo khối trong verify-knowledge-base (K1/K2/K3) → chuyển sang mức câu theo Z5; các ca hiện tại có khối 2 câu với 1 thẻ cuối đoạn được phép cập nhật kỳ vọng cho đúng ngữ nghĩa mới — phải liệt kê rõ ca nào đổi và lý do trong báo cáo cuối đợt.
  9. Assertion về wording hướng dẫn vị trí gắn thẻ trong prompt ("ở cuối đoạn hoặc mục bullet" / "vào cuối đoạn/bullet đó") → wording mới "ngay cuối câu có viện dẫn hoặc trích dẫn đó" (Z5/P10); assertion về quy tắc lặp tiêu đề / cấp heading chương horizon → quy tắc mới (Y6a/C-06.3).
  10. Assertion về `dynamicStarsSummaryVi` (compact matrix) — KHÔNG đổi (giữ chi-only); assertion về `periodCtxLabelDynStars` → đủ Can Chi (Y6/P7).
- Mọi ca kiểm mới được THÊM (không sửa ca cũ ngoài danh sách trắng).

## Ca kiểm mới (bắt buộc, ghi vào verify suite tương ứng)
- X1: prompt kỳ hạn sinh ra không chứa chuỗi `.ts` trong tiêu đề mục trích đoạn.
- X2a: `[Nguồn: school-data.ts / constants.ts]` → V1, bị scrub sạch khỏi văn bản.
- X2b: `[Nguồn: CL-TT-015, CL-CTP-013]` → cả hai ID được kiểm V1/V3 riêng và cả hai xuất hiện trong mục tài liệu tham chiếu khi hợp lệ.
- X2c: `[Nguồn: CL-TT-015, FAKE-999]` → FAKE-999 bị V1 + scrub, CL-TT-015 giữ nguyên (cả ở server verify lẫn ở `scrubInvalidCitationTags` phía client).
- X2d: thẻ đơn `[Nguồn: CL-TT-015 · Cách Cơ Nguyệt Đồng Lương]` vẫn hợp lệ (hồi quy).
- X2e: `[Nguồn: ]`, `[Nguồn: , ; ]`, `[Nguồn: ·]` → V1 + scrub sạch vỏ thẻ.
- X2f: `[Nguồn: cl-tt-015]` (chữ thường) → chuẩn hóa thành CL-TT-015, hợp lệ.
- X2g: `[Nguồn: CL-TT-015 · Luận cung Mệnh, Thân]` → chỉ kiểm ID đầu, dấu phẩy trong chú thích không tạo ứng viên mới.
- X2h: `[Nguồn: CL-TT-015 / CL-CTP-013]` → cả hai ID hợp lệ được giữ.
- X3: văn bản có `[Nguồn: NH-PAL-014-GEN]` dùng đúng ở đoạn A và dùng sai chủ đề ở đoạn B → sau verify+scrub, thân bài không còn thẻ nào mang ID đó VÀ mục tài liệu tham chiếu không liệt kê ID đó.
- Y1: dòng fact `formatPeriodSiHuaFactLine` có dạng `Sao {Tên} [{Độ sáng}] · [Bản mệnh Hóa X]` đứng TRƯỚC cụm `— đối cung xung chiếu:`.
- Y2: `periodTitleVi` chứa `Kích hoạt cung Bản Mệnh gốc` và `nơi Cung Lưu Mệnh Cung tọa thủ`.
- Y3: fact sheet kỳ hạn chứa `Bộ Kình Đà lưu niên (kẹp hai bên cung Lưu Lộc Tồn)`, không chứa `(Dương Đà giáp Lộc)`.
- Y4: fact sheet tổng quan chứa `[Thượng cách]`, không chứa `[excellent]`.
- Y5: tiêu đề cung Mệnh là `### Cung Mệnh (Nhâm Dần)` (lá số mẫu 26/07/1977), không có `### Cung Mệnh Cung`.
- Y6a: prompt horizon chứa quy tắc bắt buộc mẫu `(xung Cung Lưu ...)` cho 4 sao Lưu Tứ Hóa từng năm; Y6b: `periodCtxLabelDynStars` cho ra `Điền Trạch - Ất Tỵ` (đủ Can Chi); Y6c: năm Lưu Mệnh trùng Mệnh gốc có chú thích giải thích trong `detailLines`; Y6d: `dynamicStarsSummaryVi` (compact matrix) VẪN dạng chi-only và bảng chat trên lá số mẫu ≤ 13.100 ký tự.
- Z1: prompt nhóm cung chứa quy tắc bắt buộc dòng `[Tứ Hóa Đại Hạn Kỳ X–Y]` cho từng cung.
- Z2: prompt kỳ hạn chứa sàn `900–1.300 từ` và quy tắc tên sao trên dòng Lưu Tứ Hóa; prompt KHÔNG chứa chuỗi hardcode "44–53 tuổi tại Tài Bạch · Can Canh".
- Z3: sanitizer: `Thứ secondNumber` → `Thứ hai`; `Thân Cuv` → `Thân Cư`; `Venh Khúc` → `Văn Khúc`; `[excellent]` → `[Thượng cách]`; `khiâm đau` → `khi ốm đau`; `đồng điệu mật khẩu` → `đồng điệu mật thiết`; `bảo ninh` → `bảo toàn`; `HOÁ Quyền` → `Hóa Quyền`; `Bảo Ninh` (viết hoa) KHÔNG bị sửa; `Thứ secondNumber` không thành `Thứ haiNumber`.
- Z4: cả hai prompt chứa quy tắc "Không Kiếp".
- Z5: kiểm V2 theo câu (nghiêm ngặt theo câu, sau khi P10 đã đổi hướng dẫn prompt sang "ngay cuối câu có viện dẫn hoặc trích dẫn đó"):
  - Z5a: khối có câu 1 chứa trích khẩu quyết không thẻ + câu 2 có thẻ hợp lệ cho luận điểm khác → V2 vẫn đánh lỗi cho câu 1 (đây chính là lỗ hổng B-04).
  - Z5b: câu chứa "mục 1.2", "1.000", "105.85" và có thẻ hợp lệ → KHÔNG lỗi V2 giả (bộ tách câu không cắt tại các dấu chấm đó).
  - Z5c: đoạn "Theo hệ thống Thiên Kỷ của Nghê Hải Hạ, sao Thiên Cơ tại Mệnh chủ về trí tuệ linh hoạt. Khi gặp Hóa Khoa đồng độ thì năng lực học thuật càng xuất sắc [Nguồn: NH-STAR-001]." → V2 đánh lỗi câu 1 (câu 1 viện dẫn M1 mà không có thẻ riêng); nếu gắn thêm thẻ vào cuối câu 1 thì hết lỗi. Đây là hành vi mới có chủ ý sau P10.
  - Z5d: khối 2 câu trong đó câu trích khẩu quyết CÓ thẻ ngay cuối câu đó → KHÔNG lỗi V2.

## Điều kiện nghiệm thu (ĐK-155)
- ĐK-155-01: `bun run verify:all` thoát 0 (key-pool, dossier-context, dossier-ui, yunxian, library, kb 100% + các ca mới trên đạt).
- ĐK-155-02: `bun run lint` thoát 0; `bun run build` đạt.
- ĐK-155-03: diff so với src-v23 chỉ gồm file trong phạm vi (server.ts, verifier.ts, text-sanitizer.ts, dossier-context.ts, yunxian-context.ts, verify scripts) + VERSION/CHANGELOG; không assertion cũ nào bị sửa ngoài DANH SÁCH TRẮNG.
- ĐK-155-04: bảng đo kích thước fact sheet trước/sau trên lá số mẫu 26/07/1977: nhóm cung + overview + chat trong trần 1.5.4 (chat giữ nguyên ≤ 13.100 ký tự — KHÔNG nới trần); horizon_5y ≤ 14.200; horizon_10y ≤ 37.800.
- ĐK-155-05: VERSION → 1.5.5; CHANGELOG ghi mục 1.5.5 liệt kê 3 nhóm X/Y/Z.
- ĐK-155-06 (nghiệm thu live, do Muse thực hiện sau thi công): sinh lại chương 1, chương 3 (Phu Thê), chương 5, chương 6 trên Preview bản 1.5.5 — 7 lỗi nghiêm trọng (A-01, A-02, B-01, B-02, C-01, C-02, D-01) không còn xuất hiện; chương 5/6 đạt ≥ 900 từ thân bài.

## Ngoài phạm vi
- Sửa trực tiếp file hồ sơ `.md`/`.html` đã xuất (chỉ làm khi có lệnh riêng).
- Retriever (thuộc 1.6.0), allocator, run-all/partial, dữ liệu CSDL, UI mới.
- Đổi model chính/dự phòng, đổi kho khóa, đổi cấu hình live.

---

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
