# KẾ HOẠCH THIẾT KẾ — NỀN TRI THỨC AI TỬ VI ĐẨU SỐ (`docs/knowledge-base-design-plan.md`)

- **Loại tài liệu**: `[Kế hoạch Thiết kế Kỹ thuật — BẢN POST-PANEL V2 (ĐÃ TÍCH HỢP KẾT LUẬN TỔ CHUYÊN GIA 5 VAI & AGENDA ĐN-1..ĐN-10)]`
- **Trạng thái hiệu lực**: `BẢN POST-PANEL V2 — ĐÃ THẨM ĐỊNH KỸ THUẬT (NK-01..NK-12), CHỜ CHỦ DỰ ÁN CHỐT QUYẾT ĐỊNH QĐ-N1..QĐ-N8 (CHƯA VIẾT CODE TRIỂN KHAI)`
- **Biên bản phản biện đối ứng**: `docs/knowledge-base-expert-panel-review.md` (`NK-01..NK-12`, xử lý trọn vẹn `ĐN-1..ĐN-10` & đính chính số liệu nguồn `[B]`)
- **Phiên bản ứng dụng làm căn cứ đối chiếu**: `1.3.0-rc.1` (`package.json`: `"1.3.0"`, đồng bộ `/VERSION`)
- **Phiên bản đích đề xuất theo lộ trình (`QĐ-N8`)**:
  - Đợt Pilot (Đợt 1A — `~162` mục cốt lõi, 3 luồng chính): `1.4.0-rc.1` (`package.json`: `"1.4.0"`)
  - Đợt Mở rộng Hoàn tất Tầng 1 (Đợt 1B — tổng `~279` mục, mở rộng nốt 2 luồng phụ): `1.4.0-rc.2` (`package.json`: `"1.4.0"`)
  - Đợt Mở rộng Chuyên đề Tầng 2 (Đợt 2 — tổng `~367` mục tinh hoa): `1.5.0-rc.1` (`package.json`: `"1.5.0"`)
- **Ngày lập kế hoạch V1**: `18/11/2026`
- **Ngày cập nhật POST-PANEL V2**: `18/11/2026`
- **Mã nguồn đối chiếu (Code SSOT — Đã kiểm chứng trực tiếp trên dự án)**:
  - `server.ts` (`dòng 158–213` `buildStrictPeriodAiPrompt`, `dòng 346–400` `buildStrictDossierSectionPrompt`, `dòng 402–457` `buildStrictExplanationChatPrompt`, `dòng 460` `express.json({ limit: '512kb' })`, `dòng 638–762` `/api/interpret-period`, `dòng 765–853` `/api/interpret-dossier-section`, `dòng 856–950` `/api/interpret-chat`, `dòng 953–1063` `/api/interpret`, `dòng 1066–1150` `/api/heming`)
  - `server/key-pool/types.ts` (`dòng 179–197`: `DEFAULT_MODEL = 'gemini-3.5-flash-lite'`, `FALLBACK_MODEL = 'gemini-3.8-flash'`, `FIRST_CHUNK_TIMEOUT_MS = 12_000`, `TOTAL_FAILOVER_TIME_BUDGET_MS = 35_000`)
  - `src/lib/ziwei/dossier-context.ts` (`dòng 36–111` `DossierSectionId` & `DOSSIER_PALACE_GROUPS`, `dòng 259–346` `buildNatalOverviewFactSheetVi`, `dòng 380–540` `buildPalaceGroupFactSheetVi`, `dòng 623–947` `buildMultiYearHorizonContext`, `dòng 965–1036` `buildDossierSectionFactSheetVi`, `dòng 1038–1080` `buildChatFactTableForContextVi`)
  - `src/lib/ziwei/yunxian-context.ts` (`dòng 206–248` `YunxianPeriodContext` & `knowledgeExcerpts`, `dòng 316–728` `buildYunxianPeriodContext`, đặc biệt `dòng 551–584` trích đoạn tri thức hiện tại)
  - `src/lib/ziwei/vi-i18n.ts` (`dòng 5–167` Can Chi/12 Cung/Ngũ Hành Cục/Tứ Hóa/Độ sáng, `dòng 170–302` `CN_TO_VI_STAR` 90+ tinh diệu, `dòng 347–621` `VI_STAR_DETAILS` & `VI_SIHUA_DETAILS`, `dòng 624–695+` `PATTERN_NAME_VI`)
  - `src/lib/ziwei/text-sanitizer.ts` (`dòng 54–101` `sanitizeLayer3AOnly` & `sanitizeAiVietnameseOutput`, `dòng 165–217` `verifyAndEnsureCompletePeriodSiHua`, `dòng 224–289` `enforceCanonicalPalaceGroupHeadings`)
  - `src/lib/ziwei/constants.ts`, `src/lib/ziwei/sihua.ts`, `src/lib/ziwei/patterns.ts`, `src/lib/ziwei/patterns-dinggui.ts`, `src/lib/ziwei/patterns-dingfu.ts`, `src/lib/ziwei/patterns-dingpin.ts`, `src/lib/ziwei/patterns-dingza.ts`, `src/lib/ziwei/heming-knowledge.ts`, `src/lib/ziwei/db-analysis.ts`
  - `src/lib/dossier-chat-ui.ts` (`dòng 170–197` `sanitizeDossierChapterText`, `dòng 204–225` `stripInternalExportMetaLines`)
- **Quyết định & Phát hiện phản biện liên quan**: `QĐ-1..QĐ-6`, `F1–F7`, `QĐ-G1..QĐ-G6`, `QĐ-H1..QĐ-H7`, `QĐ-L1..QĐ-L9`, `QĐ-M1..QĐ-M6`, `NK-01..NK-12`, `ĐN-1..ĐN-10`, và bộ quyết định **`QĐ-N1..QĐ-N8`**

---

## 0. Tóm Tắt Điều Hành, Hiện Trạng Đã Kiểm Chứng & Ràng Buộc Thiết Kế Cố Định

### 0.1. Hiện trạng tri thức trong mã nguồn hiện tại (`1.3.0-rc.1` — Đã kiểm chứng trên code thật)
Qua rà soát trực tiếp cây thư mục dự án hiện hành (`/` và `/src/lib/ziwei/`):
1. **Những gì ĐÃ CÓ trong app**:
   - Engine an sao, lịch âm dương, Chân Thái Dương Thời, Tứ Hóa và vận hạn (`algorithm.ts`, `sihua.ts`, `school-data.ts`, `school-tables.generated.ts`, `shier-shen.ts`, `yunxian-context.ts`).
   - Các bảng mô tả tĩnh quy mô nhỏ nhúng trực tiếp trong TypeScript:
     - `STAR_DESCRIPTIONS` trong `src/lib/ziwei/constants.ts` (mô tả rất ngắn theo từ khóa).
     - `VI_STAR_DETAILS` (14 chính tinh, mỗi sao ~6–8 dòng tóm tắt `niHaixia` + `classical`) và `VI_SIHUA_DETAILS` (4 hóa) trong `src/lib/ziwei/vi-i18n.ts:347–621`.
     - Bộ nhận diện cách cục `patterns.ts` (41 cách cục) + `patterns-dinggui.ts` (27 Định Quý Cục), `patterns-dingfu.ts`, `patterns-dingpin.ts`, `patterns-dingza.ts` và bản dịch tên/mô tả ngắn trong `vi-i18n.ts:624+`.
     - `STAR_IN_FUQI_GU` và `SIHUA_IN_FUQI_GU` trong `src/lib/ziwei/heming-knowledge.ts:8–177` (~17 KB, chỉ chuyên về cung Phu Thê & Hợp Bàn).
     - `src/lib/ziwei/db-analysis.ts` (luận giải mẫu tĩnh cấp cơ bản theo sao/cung).
   - Hiện tại, khi sinh Hồ Sơ 8 Chương (`buildStrictDossierSectionPrompt` tại `server.ts:346–400`) hoặc trả lời Chat (`buildStrictExplanationChatPrompt` tại `server.ts:402–457`), prompt **chỉ gửi bảng dữ kiện tinh đẩu xác định** (`factSheetMarkdown` / `factTable`) chứ **chưa nạp kèm các mục lý thuyết chuyên sâu theo bài giảng Thiên Kỷ hay cổ thư**. Riêng `buildYunxianPeriodContext` (`src/lib/ziwei/yunxian-context.ts:551–584`) mới chỉ trích 3 mảng ngắn (`patterns`, `starPrinciples` từ `STAR_DESCRIPTIONS`, `fuqiAndSihua` từ `heming-knowledge.ts`).
2. **Những gì CHƯA CÓ trong dự án AI Studio này (`[CẬP NHẬT SAU PANEL — NK-02 & ĐN-7: Đính chính theo số đo thực tế trên repo gốc github.com/Renhuai123/ziwei-doushu]`)**:
   - `docs/tianji-ziwei/`: **`16` file `.md`** bài giảng Thiên Kỷ của Nghê Hải Hạ (tổng dung lượng **`~685.749` byte**, tổng cộng **`342.785` ký tự**, trong đó có **`150.726` ký tự Hán**; tổ chức theo các thế đứng sao Tử Vi, mỗi đoạn có tiêu đề mục, mốc thời gian video và mã `bvid`). *(Đính chính V1: con số "17 file, ~691.000 ký tự Hán" ở V1 là nhầm số byte UTF-8 thành số ký tự Hán và đếm dư 1 file).*
   - `entries.jsonl`: ~724 KB gồm **`1.848` dòng JSON hợp lệ**, mỗi dòng gồm **9 trường thật**: `{ book, h2, h3, quote, section, t_hms, note, bvid, part }`.
     - Thống kê độ dài trường `quote`: tổng cộng **`134.435` ký tự**, trung vị 1 `quote` = **`61` ký tự**, trung bình **`~73` ký tự**, dài nhất **`353` ký tự** (mỗi dòng `quote` là một mảnh câu/ý ngắn, không phải một bài viết dài).
     - Thống kê theo `book` (9 quyển): `01-stars` (`378` dòng), `02-palaces` (`366` dòng), `03-patterns` (`127` dòng), `04-sihua` (`174` dòng), `05-illness` (`80` dòng), `07-methodology` (`673` dòng), `08-yili` (`7` dòng), `10-divination` (`24` dòng), `11-fengshui` (`19` dòng).
     - Thống kê theo **Đơn vị Ngữ nghĩa Phân cấp**: toàn kho có **`68` cặp `(book, h2)`** và **`208` nhóm `(book, h2, h3)`**; riêng **Tầng 1 (4 quyển Tử Vi cốt lõi) có đúng `138` nhóm `(book, h2, h3)`** (`01-stars`: **`83`** nhóm `h3`; `02-palaces`: **`16`** nhóm `h3`; `03-patterns`: **`20`** nhóm `h3`; `04-sihua`: **`19`** nhóm `h3`).
   - `lib/nihai/`: ~112 KB (Thiên Kỷ / Nhân Kỷ / Địa Kỷ dạng TypeScript).
   - `lib/classics/data/`: ~40 KB (*Cốt Tủy Phú*, *Thái Vi Phú*, *Toàn Tập*, *Toàn Thư*).
   - `research/nishi-video-reading/`: ~1,6 MB ghi chép đọc video.

### 0.2. Mục tiêu cốt lõi & 7 ràng buộc kiến trúc bất biến (Đã chốt ngày `18/11/2026`)
1. **Phục vụ chiều sâu luận giải của AI (không làm giao diện tra cứu nguyên văn cho người dùng)**: Giúp Gemini khai thác chiều sâu lý pháp Thiên Kỷ (Nghê Hải Hạ) và cổ thư khi sinh Hồ Sơ 8 Chương, Luận giải Vận hạn và Hỏi đáp Ngữ cảnh, đồng thời **cấm tuyệt đối AI bịa khẳng định học thuật**.
2. **Chưng cất ngoại tuyến MỘT LẦN theo Đơn vị Ngữ nghĩa Nhóm — Truy hồi runtime TẤT ĐỊNH 100% (`[CẬP NHẬT SAU PANEL — NK-01 / ĐN-1]`)**:
   - Đầu ra chưng cất là kho tri thức tiếng Việt có cấu trúc sống phía server (`/server/knowledge-base/data/*.kb.json`).
   - Đơn vị chưng cất của `entries.jsonl` là **nhóm ngữ nghĩa `(book, h2, h3)`** (có tách tiểu mục `(Cung × Sao)` cho `02-palaces`), hợp nhất các mảnh `quote` + `note` theo thứ tự `(part, t_hms)` kèm ngữ cảnh bài giảng `(bvid, t_hms)`.
   - **KHÔNG** nhồi toàn bộ kho vào prompt; **KHÔNG** dùng Gemini File API (vì `server/key-pool/` xoay vòng nhiều API key thuộc nhiều Google Cloud project khác nhau); **KHÔNG** dùng embedding / vector search ở runtime.
3. **Cơ chế chống bịa 3 lớp (Three-Layer Anti-Hallucination)**:
   - **Lớp 1 (Prompt Grounding)**: Chỉ cho phép viện dẫn học thuật từ danh sách mục tri thức đã nạp trong prompt và bắt buộc gắn thẻ nguồn cấp nhóm `[Nguồn: <Mã-Thẻ>]`.
   - **Lớp 2 (Hậu kiểm tất định — Deterministic Post-Verification theo Khối Đoạn văn / Bullet)**: Quét các đoạn/bullet có khẳng định học thuật trong đầu ra AI, đối chiếu với tập thẻ nguồn đã cấp; gỡ sạch mã thẻ bịa/gắn sai (`V1/V3`) mà không sửa hỏng ngữ pháp câu văn, đồng thời đính kèm khối tư liệu tham chiếu & lưu ý kiểm chứng nguồn (`ĐN-4`, `ĐN-5`, `ĐN-6`).
   - **Lớp 3 (Vùng không phủ — Coverage Boundary Honesty)**: Khi lá số/câu hỏi rơi vào vùng kho tri thức chưa phủ tới, AI phải tuyên bố rõ nguồn dữ liệu hiện nạp không đề cập trực tiếp, chỉ phân tích trên dữ kiện tinh đẩu xác định của lá số.
4. **Dịch thuật lồng trong chưng cất (Distillation-Coupled Translation)**:
   - Cấm dịch máy thô toàn bộ kho rồi lấy bản dịch thô làm database.
   - Ngoại lệ được dịch trọn vẹn kèm nguyên văn Hán đối chiếu: các `quote` trong nhóm `(book, h2, h3)` của `entries.jsonl` và các cổ thư ngắn dạng phú/thơ (`lib/classics/data/` như *Cốt Tủy Phú*).
   - Toàn bộ thuật ngữ Sao, Cung, Can Chi, Cục, Độ sáng, Tứ Hóa, Cách cục bắt buộc khóa cứng 2 chiều theo từ điển `src/lib/ziwei/vi-i18n.ts`.
5. **Vai trò NotebookLM**: Chỉ dùng ngoại tuyến để đối chiếu, kiểm toán chéo (QA) chất lượng bản chưng cất theo phiếu lấy mẫu (`ĐN-10`); tuyệt đối không nằm trong runtime.
6. **Tương thích điều kiện vận hành thực tế**:
   - Runtime của app giữ nguyên model chính `gemini-3.5-flash-lite`, dự phòng `gemini-3.8-flash` (`server/key-pool/types.ts:179–180`), kho key phần lớn là free tier.
   - Khâu chưng cất ngoại tuyến chạy một lần trên máy cá nhân bằng model mạnh (`gemini-2.5-pro` hoặc `gemini-3.8-flash`) rồi commit file `.kb.json` vào repo (`ĐN-3`).
   - Giữ nguyên `express.json({ limit: '512kb' })` (`server.ts:460`), không đụng tới engine lập lá số (`algorithm.ts`) và `SI_HUA_TABLE` (`constants.ts`).
7. **Tuân thủ giấy phép CC BY-NC-SA 4.0 & Phân tầng phạm vi**:
   - Ghi công đầy đủ, phân biệt rõ trạng thái bản quyền giữa bài giảng Nghê Hải Hạ (`CC-BY-NC-SA-4.0`) và văn bản cổ thư gốc (`Public Domain` kèm bản dịch `CC-BY-NC-SA-4.0`), và tách bạch 3 tầng phạm vi tư liệu.

---

## 1. Phân Tầng Phạm Vi Nguồn Tư Liệu & Kiểm Toán Số Học (`[CẬP NHẬT SAU PANEL — NK-01, NK-02, NK-11, ĐN-1, ĐN-7]`)

Toàn bộ kho tư liệu gốc được phân thành **3 Tầng Phạm Vi** và tính toán lại chính xác theo đơn vị nhóm `(book, h2, h3)`:

| Tầng phạm vi | Nguồn tư liệu & Số đo thực tế | Số dòng `quote` gốc | Số nhóm `(book, h2, h3)` gốc | Số mục `DistilledKnowledgeEntry` sau chuẩn hóa | Quyết định xử lý |
|---|---|:---:|:---:|:---:|---|
| **TẦNG 1 — TRONG PHẠM VI CỐT LÕI ĐỢT 1 (Core Ziwei Chart & Fate Interpretation)** | 1. **`entries.jsonl` (4 quyển cốt lõi)**:<br>• `01-stars`: `378` dòng quote $\rightarrow$ **`83` nhóm `h3`**<br>• `04-sihua`: `174` dòng quote $\rightarrow$ **`19` nhóm `h3`**<br>• `03-patterns`: `127` dòng quote $\rightarrow$ **`20` nhóm `h3`**<br>• `02-palaces`: `366` dòng quote $\rightarrow$ **`16` nhóm `h3`** *(tách tất định theo `Cung × Cụm Sao` thành **`~52` tiểu mục** theo `NK-11`)*<br>2. **`lib/classics/data/`** (~40 KB: *Cốt Tủy Phú*, *Thái Vi Phú*, *Toàn Thư* gắn với sao/cung/cách cục).<br>3. **Chuyên đề bổ sung từ `16` file `tianji-ziwei/*.md`** (`150.726` chữ Hán) & `lib/nihai/` (chỉ lấy các đoạn giảng về 12 Thế đứng Tử Vi / Vận hạn chưa nằm trong 138 nhóm `entries.jsonl`). | `1.045` dòng `entries.jsonl` + `~60` câu phú + `16` bài giảng | **`138` nhóm `h3`** từ `entries.jsonl` | **`~279` mục** gồm:<br>• **Đợt 1A (Pilot)**: `83` (`01-stars`) + `19` (`04-sihua`) + `~60` (`classics`) = **`~162` mục**<br>• **Đợt 1B**: `~52` (`02-palaces` tiểu mục) + `20` (`03-patterns`) + `~45` (bài giảng bổ sung) = **`+117` mục** | **Nạp & Chưng cất trong Đợt 1 (Pilot 1A + Mở rộng 1B)** |
| **TẦNG 2 — PHẠM VI MỞ RỘNG ĐỢT 2 (Extended Ziwei: Tật Ách & Phương pháp luận chọn lọc)** | 1. `entries.jsonl` quyển `05-illness` (`80` dòng quote $\rightarrow$ `~18` nhóm `h3` gắn với cung Tật Ách / tinh đẩu).<br>2. Phần lọc từ `07-methodology` (chỉ giữ `~250 / 673` dòng quote bàn trực tiếp về phương pháp xem bàn Tử Vi, Tứ Hóa, Đại Hạn/Lưu Niên $\rightarrow$ `~35` nhóm `h3`).<br>3. Ca mệnh thực chiến có tọa độ sao/cung rõ ràng từ `research/nishi-video-reading/` (`~35` mục). | `~330` dòng `entries.jsonl` + `~35` ca mệnh | `~53` nhóm `h3` chọn lọc | **`+88` mục** *(Nâng tổng toàn kho lên **`~367` mục tinh hoa**)* | **Đưa vào Đợt 2 (`1.5.0-rc.1`) sau khi Đợt 1 hoàn tất** |
| **TẦNG 3 — NGOÀI PHẠM VI LUẬN GIẢI LÁ SỐ (Out-of-Scope / Excluded)** | 1. `entries.jsonl` thuộc các quyển:<br>• `08-yili` (`7` dòng — Dịch lý)<br>• `10-divination` (`24` dòng — Bói Dịch / Tiền xu)<br>• `11-fengshui` (`19` dòng — Phong thủy Dương/Âm trạch)<br>2. Phần còn lại của `07-methodology` (`~423` dòng bàn về tướng mặt, phong thủy nhà ở, đơn thuốc Đông y rời).<br>3. Các đoạn giảng Quẻ Dịch / Phong Thủy / Hoàng Đế Nội Kinh trong `tianji-ziwei/`, `lib/nihai/`, `nishi-video-reading/`. | `~473` dòng `entries.jsonl` + phần ngoài Tử Vi | `~17` nhóm `h3` chuyên biệt + phần loại của `07` | **`0` mục Runtime** | **LOẠI KHỎI RUNTIME LUẬN GIẢI LÁ SỐ** *(Chỉ lưu ở kho nguồn ngoại tuyến, không nạp vào DB runtime)* |

---

## 2. Giải Quyết Điểm A — Đường Nạp Kho Nguồn Vào Dự Án & Cổng Kiểm Tra Toàn Vẹn (`[CẬP NHẬT SAU PANEL — NK-02 & ĐN-7]`)

### 2.1. Cấu trúc thư mục kho nguồn (`/knowledge-source/`)
Đặt toàn bộ dữ liệu gốc nguyên bản (read-only) tại thư mục `/knowledge-source/` ở gốc dự án (tách biệt hoàn toàn khỏi `/src/` để Vite không bao giờ quét hay đóng gói vào client bundle `dist/`):

```text
/knowledge-source/                        # Kho tư liệu Hán ngữ gốc (Read-Only, 0 byte vào client bundle)
├── MANIFEST.sha256.json                  # Bản kê số lượng file, số dòng entries.jsonl, SHA-256 từng file
├── LICENSE-CC-BY-NC-SA-4.0.md            # Giấy phép và ghi công nguồn repo gốc & bài giảng Nghê Hải Hạ
├── entries.jsonl                         # ~724 KB — 1.848 dòng (9 trường: book, h2, h3, quote, section, t_hms, note, bvid, part)
├── tianji-ziwei/                         # ~685.749 byte — 16 file .md bài giảng Thiên Kỷ (342.785 ký tự, 150.726 ký tự Hán)
│   ├── 01-*.md ... 16-*.md
├── classics/                             # ~40 KB — Cốt Tủy Phú, Thái Vi Phú, Toàn Tập, Toàn Thư
├── nihai/                                # ~112 KB — Thiên/Nhân/Địa Kỷ dạng TypeScript/Markdown gốc (dùng cho Đợt 1B)
└── nishi-video-reading/                  # ~1,6 MB — Ghi chú đọc video (dùng cho Đợt 2)
```

### 2.2. Lý do nạp ngay cả `entries.jsonl`, `tianji-ziwei/` (16 file) và `classics/` từ Đợt 1A (`QĐ-N1`)
- Nhờ phát hiện ở `[B]` và `ĐN-2`, các file bài giảng trong `tianji-ziwei/` chứa sẵn mã `bvid` khớp với trường `bvid` và mốc thời gian `t_hms` trong `entries.jsonl`.
- Tổng dung lượng của `entries.jsonl` (~724 KB) + `16` file `tianji-ziwei/*.md` (~685 KB) + `classics/` (~40 KB) chỉ là **`~1,45 MB`** — rất nhẹ để nạp ngay từ đầu Đợt 1A, giúp script chưng cất `entries.jsonl` tự động tra cứu đoạn bài giảng gốc quanh `(bvid, t_hms)` làm ngữ cảnh bổ trợ.

### 2.3. Đặc tả Cổng Kiểm tra Toàn vẹn Nguồn đã Đính chính Số đo Thật (`scripts/kb-verify-source.ts`)
Lệnh `npm run kb:verify-source` kiểm tra tự động các bất biến định lượng sau đây (fail-fast nếu sai lệch):
1. **Kiểm tra `entries.jsonl`**:
   - Đọc đúng **`1.848` dòng JSON hợp lệ** (UTF-8).
   - Mỗi dòng phải có mặt các trường cấu trúc thật: `book`, `h2`, `h3`, `quote`, `section`, `t_hms`, `note`, `bvid`, `part`.
   - Tổng số ký tự của trường `quote` trên `1.848` dòng đạt **`134.435` ký tự** (cho phép sai số chuẩn hóa dòng `\r\n` $\pm 50$ ký tự); độ dài `quote` ngắn nhất $\ge 1$, trung vị **`61`**, dài nhất **`353`**.
   - Kiểm tra phân bố số dòng theo 9 quyển (`book`):
     - `01-stars`: `378` | `02-palaces`: `366` | `03-patterns`: `127` | `04-sihua`: `174` | `05-illness`: `80` | `07-methodology`: `673` | `08-yili`: `7` | `10-divination`: `24` | `11-fengshui`: `19` (Tổng = `1.848`).
   - Kiểm tra phân bố đơn vị ngữ nghĩa:
     - Tổng số cặp `(book, h2)` duy nhất = **`68`**.
     - Tổng số nhóm `(book, h2, h3)` duy nhất toàn kho = **`208`**.
     - Số nhóm `(book, h2, h3)` của Tầng 1 = **`138`** (`01-stars`: **`83`**, `02-palaces`: **`16`**, `03-patterns`: **`20`**, `04-sihua`: **`19`**).
2. **Kiểm tra `tianji-ziwei/` (`[ĐÃ SỬA THEO NK-02]`)**:
   - Đúng **`16` file `.md`** *(không phải 17 file)*.
   - Tổng dung lượng byte nằm trong khoảng **`680.000 – 692.000` byte** (chuẩn `~685.749` byte).
   - Tổng số ký tự toàn văn nằm trong khoảng **`340.000 – 346.000` ký tự** (chuẩn `342.785` ký tự).
   - Tổng số ký tự chữ Hán (`/\p{Script=Han}/gu`) nằm trong khoảng **`149.500 – 152.000` ký tự Hán** (chuẩn `150.726` ký tự Hán).
3. **Kiểm tra `classics/`**: Xác nhận tồn tại đầy đủ dữ liệu cổ thư (~40 KB) và xuất bảng băm SHA-256 ra `/knowledge-source/MANIFEST.sha256.json`.

---

## 3. Giải Quyết Điểm B — Đơn Vị Chưng Cất Cấp Nhóm, Văn Bản Nguồn Neo Kép, Môi Trường Chạy & Schema (`[CẬP NHẬT SAU PANEL — ĐN-1, ĐN-2, ĐN-3, ĐN-10, NK-11, NK-12]`)

### 3.1. Đơn vị Chưng cất (`Distillation Unit`) & Quy tắc Tách Tiểu mục cho `02-palaces` (`ĐN-1` & `NK-11`)
1. **Gộp theo nhóm ngữ nghĩa `(book, h2, h3)`**:
   - Script tiền xử lý `scripts/kb-group-entries.ts` gom toàn bộ các dòng trong `entries.jsonl` có cùng bộ ba `(book, h2, h3)` lại với nhau, sắp xếp các dòng thành viên theo thứ tự `(part ASC, t_hms ASC)`.
   - Với `01-stars` (`378` dòng $\rightarrow$ `83` nhóm), `03-patterns` (`127` dòng $\rightarrow$ `20` nhóm), `04-sihua` (`174` dòng $\rightarrow$ `19` nhóm): **mỗi nhóm `(book, h2, h3)` ánh xạ 1–1 thành đúng `1` mục `DistilledKnowledgeEntry`** (trung bình mỗi nhóm gồm 4–9 câu `quote` liên hoàn, tổng 300–650 ký tự Hán — đủ trọn vẹn cả mệnh đề chính lẫn điều kiện ngoại lệ).
2. **Chia tiểu mục tất định cho `02-palaces` (`Conditional Sub-Grouping — NK-11`)**:
   - Quyển `02-palaces` có `366` dòng nhưng chỉ có `16` nhóm `(book, h2, h3)` (mỗi cung là 1 nhóm `h3` chứa trung bình ~23 dòng `quote` bàn về nhiều sao khác nhau đóng tại cung đó).
   - Quy tắc tách tất định trong `kb-group-entries.ts`: Với bất kỳ nhóm `(book, h2, h3)` nào thuộc `02-palaces` có $> 12$ dòng `quote`:
     - Gom các dòng `quote` trong nhóm đó theo trường `section` hoặc theo tập Chính Tinh (`CN_TO_VI_STAR`) xuất hiện trong `quote`/`note`:
       - Tiểu mục 0 (`NH-PAL-xx-GEN`): Các câu nguyên lý tổng quát của cung đó (không gắn riêng 1 chính tinh cụ thể).
       - Các tiểu mục con (`NH-PAL-xx-A`, `NH-PAL-xx-B`...): Mỗi tiểu mục gom các `quote` bàn về cùng một Chính Tinh (hoặc cặp Song Tinh) tại cung đó (tối đa 4–10 quote/tiểu mục).
     - Kết quả: `16` nhóm `h3` của `02-palaces` tách thành **`~52` mục `DistilledKnowledgeEntry`** sắc gọn, giúp bộ truy hồi khớp chính xác cặp `(Chính tinh + Cung vị)` với trọng số `W_combo = +1000`.

### 3.2. Nguồn Văn bản Đưa vào Prompt Chưng cất theo Từng `corpusType` (`ĐN-2`)
1. **Với `corpusType = 'nihai_entry'` (Từ `entries.jsonl` + đối chiếu `16` file `tianji-ziwei/*.md`)**:
   - **Khung Xương Sống Bắt Buộc (`Primary Quotes & Notes`)**: Danh sách toàn bộ các cặp `(quote, note, t_hms, bvid, section)` thuộc nhóm `(book, h2, h3)` (hoặc tiểu mục).
   - **Ngữ Cảnh Bài Giảng Bổ Trợ (`Lecture Window Context`)**: Script tự động dùng `(bvid, t_hms)` (và chuỗi con của `quote`) dò vào file bài giảng `.md` tương ứng trong `/knowledge-source/tianji-ziwei/` để trích đoạn văn bản bài giảng bao quanh ($\pm 500\text{–}600$ ký tự quanh mốc `t_hms`).
   - **Quy tắc Chưng cất Neo Kép**: Prompt chưng cất yêu cầu model tổng hợp `summaryVi` và `conditionsVi` dựa trên các `quote` chính và dùng đoạn bài giảng bao quanh để giải thích rõ mạch nhân quả / điều kiện thành bại cách cục; **NHƯNG trường `hanziAnchor` trong bản ghi đầu ra vẫn chỉ lưu nguyên văn mảng `quote` gốc từ `entries.jsonl`** để kiểm chứng chuỗi con 100%.
2. **Với `corpusType = 'classic_verse'` (Từ `/knowledge-source/classics/`)**:
   - Tách từng câu/khổ phú (*Cốt Tủy Phú*, *Thái Vi Phú*, *Toàn Thư* — `~60` mục ở Đợt 1A). Dịch trọn câu phú sang tiếng Việt chuẩn thuật ngữ (`fullTranslationVi`), tóm lược ý nghĩa ứng dụng thực tế (`summaryVi`) + điều kiện thành/phá cách (`conditionsVi`), và giữ nguyên câu phú Hán làm `hanziAnchor`.
3. **Với `corpusType = 'nihai_lecture'` (Từ `16` file `tianji-ziwei/*.md` & `lib/nihai/` ở Đợt 1B)**:
   - Chỉ chưng cất các mục bài giảng về 12 Thế đứng Tử Vi và luận giải vận hạn không trùng lặp với `138` nhóm của `entries.jsonl` (`~45` mục ở Đợt 1B). `hanziAnchor` lưu đoạn trích nguyên văn Hán 150–350 ký tự từ file `.md` bài giảng kèm `bvid` và mốc thời gian.

### 3.3. Môi trường Chạy Chưng cất, Model Chưng cất & Chiến lược API Key (`[CẬP NHẬT SAU PANEL — ĐN-3]`)
1. **Phương thức vận hành chính (`Offline Local Build-and-Commit — QĐ-N3`)**:
   - Do tính bền của thư mục tạm và biến môi trường tùy chỉnh trên container AI Studio chưa được kiểm chứng, trong khi tổng số mục chưng cất sau `ĐN-1` rất gọn (`~162` mục ở Đợt 1A $\approx$ **55–65 requests**; `~117` mục ở Đợt 1B $\approx$ **40–50 requests**):
   - Toàn bộ script (`scripts/kb-verify-source.ts`, `scripts/kb-group-entries.ts`, `scripts/kb-distill.ts`, `scripts/kb-audit-quality.ts`, `scripts/kb-export-audit-sheet.ts`) được viết và lưu trong repo dự án.
   - **Thực thi**: Chủ dự án (hoặc kỹ sư triển khai) chạy `npm run kb:distill` trên môi trường máy cá nhân (hoặc CLI ngoại tuyến có khóa `KB_DISTILL_GEMINI_KEY` riêng), hoàn tất kiểm định `kb:audit` và **commit trực tiếp các file kết quả tĩnh `/server/knowledge-base/data/*.kb.json`** vào dự án.
   - **Hệ quả an toàn**: Không tốn một giọt quota nào của Kho Khóa Runtime `.data/gemini-key-pool.enc.json`, và dữ liệu `.kb.json` bền vững vĩnh viễn cùng mã nguồn ứng dụng.
2. **Chốt Model Chưng cất Ngoại tuyến (`KB_DISTILL_MODEL`)**:
   - Sử dụng **`gemini-2.5-pro`** làm model chưng cất mặc định (hoặc **`gemini-3.8-flash`** làm tùy chọn tốc độ cao) với `responseMimeType: 'application/json'` và `responseSchema` chặt chẽ.
   - Không dùng `gemini-3.5-flash-lite` cho việc dịch cổ văn và chưng cất học thuật ngoại tuyến (trong khi runtime của app vẫn giữ nguyên `DEFAULT_MODEL = 'gemini-3.5-flash-lite'` và `FALLBACK_MODEL = 'gemini-3.8-flash'`).

### 3.4. Khóa cứng Từ điển Thuật ngữ 2 chiều theo `src/lib/ziwei/vi-i18n.ts`
1. **Tiền xử lý (`Pre-Distillation Glossary Injection`)**: Trước khi gửi một nhóm `(book, h2, h3)` cho model chưng cất, script quét toàn bộ chữ Hán trong các `quote` + `h2` + `h3` qua các bảng `CN_TO_VI_STAR`, `CN_TO_VI_PALACE`, `CN_TO_VI_SIHUA`, `CN_TO_VI_BRIGHTNESS`, `CN_TO_VI_WUXING_JU`, `PATTERN_NAME_VI`, `CN_TO_VI_STEM`, `CN_TO_VI_BRANCH` của `src/lib/ziwei/vi-i18n.ts` để bơm danh sách `[TỪ ĐIỂN THUẬT NGỮ BẮT BUỘC]` vào prompt.
2. **Hậu kiểm từ điển (`Post-Distillation Terminology Validator`)**: Kiểm tra tự động bản JSON trả về:
   - `0` ký tự chữ Hán (`/\p{Script=Han}/u`) xuất hiện trong `summaryVi`, `fullTranslationVi`, `conditionsVi`.
   - Mọi tên Sao, Cung, Tứ Hóa, Cách cục trong `retrievalKeys` phải nằm trong danh mục chuẩn của `vi-i18n.ts` và xuất hiện khớp chính xác trong văn bản tiếng Việt.

### 3.5. Schema Bản ghi Tri thức Chưng cất (`DistilledKnowledgeEntry` — Đã cập nhật theo `ĐN-1`, `ĐN-10`, `NK-12`)

```typescript
export type KnowledgeCorpusType =
  | 'nihai_entry'        // Nhóm ngữ nghĩa (book, h2, h3) từ entries.jsonl (+ ngữ cảnh bài giảng)
  | 'nihai_lecture'      // Chuyên đề bổ sung từ 16 bài giảng docs/tianji-ziwei/ & lib/nihai/
  | 'classic_verse';     // Cổ thư / Phú (lib/classics/data/: Cốt Tủy Phú, Thái Vi Phú, Toàn Thư)

export type KnowledgeScopeTier = 'tier1_core' | 'tier2_extended';

export type KnowledgeCategory =
  | '01-stars'
  | '02-palaces'
  | '03-patterns'
  | '04-sihua'
  | '05-illness'
  | '07-methodology'
  | 'classics-fu';

export type KnowledgeSourceLicense =
  | 'CC-BY-NC-SA-4.0'
  | 'PUBLIC_DOMAIN_TEXT_WITH_CC_BY_NC_SA_ADAPTATION';

export interface KnowledgeAnchorQuoteItem {
  /** Nguyên văn câu quote chữ Hán trong entries.jsonl hoặc câu phú cổ thư */
  quoteCn: string;
  /** Ghi chú nguyên bản đi kèm trong entries.jsonl (nếu có) */
  noteCn?: string;
  /** Mốc thời gian video gốc (trường t_hms trong entries.jsonl): VD "00:14:25" */
  t_hms?: string;
  /** Mã video Bilibili (trường bvid trong entries.jsonl): VD "BV1..." */
  bvid?: string;
  /** Số thứ tự phần (trường part trong entries.jsonl) */
  part?: number;
  /** Tiểu mục con (trường section trong entries.jsonl) */
  sectionCn?: string;
}

export interface KnowledgeSourceRef {
  /**
   * Mã thẻ nguồn cấp nhóm ngắn gọn, tất định để AI trích dẫn:
   * - 01-stars (83 nhóm): "NH-STAR-001" .. "NH-STAR-083"
   * - 04-sihua (19 nhóm): "NH-SIHUA-001" .. "NH-SIHUA-019"
   * - 02-palaces (~52 tiểu mục): "NH-PAL-001" .. "NH-PAL-052"
   * - 03-patterns (20 nhóm): "NH-PAT-001" .. "NH-PAT-020"
   * - Bài giảng bổ sung (~45 mục): "NH-LEC-001" .. "NH-LEC-045"
   * - Cổ thư (~60 mục): "CL-CTP-001".., "CL-TVP-001".., "CL-TT-001"..
   */
  citationId: string;
  tradition: 'ni_haixia_tianji' | 'ziwei_classics';
  sourceLicense: KnowledgeSourceLicense;
  /** Bộ khóa nhóm gốc từ entries.jsonl: book / h2 / h3 (+ subGroupKey nếu tách từ 02-palaces) */
  groupKey: {
    book: string;
    h2Cn: string;
    h3Cn: string;
    subGroupKey?: string;
  };
  /** Tên tài liệu / quyển tiếng Việt: VD "Thiên Kỷ — Quyển Tinh Diệu (01-stars)" hoặc "Cốt Tủy Phú" */
  workTitleVi: string;
  /** Tiêu đề nhóm đã dịch chuẩn Hán-Việt: VD "Tử Vi · Tử Vi Thất Sát đồng cung tại Tỵ Hợi" */
  groupTitleVi: string;
  /** Danh sách mã bvid & khoảng thời gian t_hms đại diện của nhóm */
  bvids: string[];
  timeRangeHms?: string;
  /** Đường dẫn file gốc và danh sách chỉ số dòng (1-based line numbers) trong entries.jsonl */
  sourceFilePath: string;
  sourceLineNumbers: number[];
}

export interface KnowledgeRetrievalKeys {
  /** Tên sao tiếng Việt chuẩn vi-i18n.ts: VD ["Tử Vi", "Thất Sát"] */
  starsVi: string[];
  /** Tên cung chuẩn vi-i18n.ts: VD ["Mệnh Cung", "Quan Lộc", "Phu Thê"] */
  palacesVi: string[];
  /** Địa chi cung vị (nếu mục tri thức chỉ định địa chi): VD ["Tỵ", "Hợi"] */
  branchesVi: string[];
  /** Cách cục chuẩn PATTERN_NAME_VI: VD ["Tử Phủ Đồng Cung", "Thạch Trung Ẩn Ngọc"] */
  patternsVi: string[];
  /** Tổ hợp Tứ Hóa: VD [{ starVi: "Cự Môn", mutagenVi: "Hóa Kỵ" }] */
  sihuaCombos: Array<{
    starVi?: string;
    mutagenVi: 'Hóa Lộc' | 'Hóa Quyền' | 'Hóa Khoa' | 'Hóa Kỵ';
  }>;
  /** Khóa chủ đề phục vụ khớp câu hỏi Chat & chương Hồ Sơ */
  topicTags: string[];
  /** Các chương Hồ Sơ 8 Chương mà mục này ưu tiên nạp */
  targetDossierSections: Array<
    | 'chapter_overview'
    | 'palaces_core'
    | 'palaces_family'
    | 'palaces_social_health'
    | 'year_2026'
    | 'year_2027'
    | 'horizon_5y'
    | 'horizon_10y'
  >;
}

export interface DistilledKnowledgeEntry {
  /** Khóa chính định danh: trùng với sourceRef.citationId (VD: "NH-STAR-012") */
  id: string;
  corpusType: KnowledgeCorpusType;
  scopeTier: KnowledgeScopeTier;
  category: KnowledgeCategory;
  sourceRef: KnowledgeSourceRef;
  retrievalKeys: KnowledgeRetrievalKeys;
  /**
   * Luận điểm học thuật tóm lược tiếng Việt mạch lạc cho cả nhóm (h2, h3) (150–320 ký tự),
   * dùng để nạp trực tiếp vào Prompt cho Gemini.
   */
  summaryVi: string;
  /**
   * Bản dịch tiếng Việt sát nghĩa toàn bộ các câu quote trong nhóm hoặc câu phú cổ thư.
   */
  fullTranslationVi: string;
  /**
   * Điều kiện thành cách / phá cách / ngoại lệ Tam Phương Tứ Chính (80–220 ký tự).
   */
  conditionsVi?: string;
  /**
   * Neo nguyên văn chữ Hán gồm mảng các quote gốc thuộc nhóm (kèm t_hms, bvid)
   * và chuỗi gộp để kiểm chứng substring 100%. KHÔNG gửi trường này vào prompt AI runtime.
   */
  hanziAnchor: {
    quotes: KnowledgeAnchorQuoteItem[];
    combinedQuotesCn: string;
  };
  /** Độ ưu tiên học thuật (1 = nguyên lý cốt lõi / cổ quyết gốc, 2 = luận giải tổ hợp, 3 = ví dụ tình huống) */
  priorityTier: 1 | 2 | 3;
  qaMeta: {
    distilledAtIso: string;
    modelUsed: string;
    sourceHash: string;
    glossaryCheckPassed: boolean;
    auditSampleChecked?: boolean;
  };
}
```

### 3.6. Quy trình Kiểm chứng Chất lượng (QA) & Vận hành Cổng NotebookLM (`[CẬP NHẬT SAU PANEL — ĐN-10]`)
1. **Cổng kiểm định tự động 100% (`npm run kb:audit` — `scripts/kb-audit-quality.ts`)**:
   - Kiểm tra 100% mục trong `.kb.json`: (i) mọi phần tử `q.quoteCn` trong `hanziAnchor.quotes` phải khớp chính xác 100% với dòng gốc tại `sourceLineNumbers` của `entries.jsonl` (hoặc file cổ thư/bài giảng); (ii) `0` ký tự chữ Hán sót trong `summaryVi`, `fullTranslationVi`, `conditionsVi`; (iii) 100% phần tử trong `retrievalKeys` khớp danh mục chuẩn của `src/lib/ziwei/vi-i18n.ts`; (iv) độ dài `summaryVi` nằm trong khung `120–350` ký tự.
2. **Quy trình vận hành Cổng Kiểm định Mẫu qua NotebookLM (`scripts/kb-export-audit-sheet.ts`)**:
   - **Cách sinh mẫu**: Lệnh `npm run kb:export-audit-sheet` chọn ngẫu nhiên phân tầng theo seed cố định **`25` mục trong tổng số `~162` mục của Đợt Pilot 1A** ($\approx 15,4\%$, gồm `10` mục `01-stars`, `10` mục `04-sihua`, `5` mục `classics`), xuất ra file `docs/kb-pilot-audit-sheet.md`.
   - **Ai thao tác**: Chủ dự án (hoặc người kiểm định) nạp `16` file bài giảng `tianji-ziwei/*.md` + `entries.jsonl` vào Google NotebookLM ngoại tuyến, dùng câu hỏi kiểm chứng in sẵn trên phiếu (kèm `bvid`, `t_hms`, `hanziAnchor`) để đối chiếu với `summaryVi` và `conditionsVi`.
   - **Đơn vị đo & Tiêu chí ký cổng**: Chấm ĐẠT/KHÔNG ĐẠT trên từng mục trong `25` mục mẫu. Yêu cầu đạt tối thiểu **`24/25` mục (`96%`) ngay lần chấm đầu** và **`0` lỗi nghiêm trọng (0 lỗi đảo ngược cát/hung, 0 lỗi gán sai sao/cung)**; mục nào có sai sót phải được chỉnh sửa trực tiếp trong `.kb.json` lên `25/25 (100%)` trước khi Chủ dự án ký duyệt mở sang Đợt 1B.

---

## 4. Giải Quyết Điểm C — Thiết Kế Truy Hồi Tất Định Ở Runtime & Điểm Tích Hợp Trong Code Thật (`[CẬP NHẬT SAU PANEL — ĐN-8, ĐN-9]`)

### 4.1. Thuật toán Truy hồi & Chấm điểm Tất định (`server/knowledge-base/retriever.ts`)
Việc chọn mục tri thức cho một chương Hồ Sơ, một kỳ hạn hay một câu hỏi Chat là hàm thuần tất định $f(\text{Chart}, \text{Context}) \rightarrow \text{Top-}K \text{ Entries}$:

#### A. Trích xuất Khóa Truy hồi từ Lá số & Ngữ cảnh (`extractDeterministicQueryKeys`)
1. **Luồng Hồ Sơ 8 Chương (`/api/interpret-dossier-section` — `server.ts:346, 765`)**:
   - `chapter_overview`: Chính tinh cung Mệnh + cung Thân (kèm địa chi), các sao có `[Tứ Hóa Bản Mệnh]` & `[Tứ Hóa Đại Hạn]` hiện tại (`dossier-context.ts:162–249`), và danh sách cách cục từ `detectPatterns(chart)` (`dossier-context.ts:265`).
   - `palaces_core`, `palaces_family`, `palaces_social_health`: Với từng cung trong 4 cung của chương (`DOSSIER_PALACE_GROUPS` tại `dossier-context.ts:71–111`), trích cặp `(Tên Cung, Chính tinh tọa thủ hoặc sao mượn Vô chính diệu + Địa chi, Tứ Hóa tọa thủ/xung chiếu, Tự Hóa Can Cung)`.
   - `horizon_5y` / `horizon_10y`: Cung Đại Hạn chủ quản, các mốc chuyển Đại Hạn (`daXianTransitions`), và các cờ xung hợp nổi bật (`Song Lộc`, `Song Kỵ`, `Lộc Mã giao trì`, `Lưu Niên trùng/xung Đại Hạn` tại `dossier-context.ts:795–847`).
2. **Luồng Luận giải Kỳ hạn (`/api/interpret-period` — `server.ts:158, 638`, gồm cả Chương 5 `year_2026` & Chương 6 `year_2027`)**:
   - Cung Bản Mệnh kích hoạt (`periodContext.activatedPalace`), 4 sao `periodSiHua` (đặc biệt `Hóa Lộc`, `Hóa Kỵ` và giao hội `Song Lộc` / `Song Kỵ` tại `yunxian-context.ts:432–441`), và bộ sao lưu động.
3. **Luồng Hỏi đáp Ngữ cảnh (`/api/interpret-chat` — `server.ts:402, 856`) (`[ĐÃ CẬP NHẬT THEO ĐN-8]`)**:
   - **Cơ chế Best-Effort Keyword Matching**:
     - Bước 1: Quét `question` + `sectionTitle` bắt tất cả tên Sao, tên Cung, tên Cách cục, tên Tứ Hóa khớp từ điển `src/lib/ziwei/vi-i18n.ts`.
     - Bước 2: Nếu câu hỏi không nêu trực tiếp tên cung, ánh xạ qua bảng từ khóa chủ đề đời sống gọn (`CHAT_TOPIC_TO_PALACE_KEYWORDS`, ~40 từ khóa phổ biến cho 12 cung).
     - Bước 3 (Fallback an toàn): Nếu không khớp từ khóa nào ở Bước 1 & 2, lấy cung tương ứng với `sectionTitle` đang mở (hoặc `Mệnh Cung` + `Đại Hạn hiện tại`) và kích hoạt Lớp 3 trung thực.
   - **Quy tắc Kiểm tra Sao Vắng mặt Xét Đủ Tam Phương Tứ Chính (`starAbsentInQueriedPalace` — `ĐN-8`)**:
     - Với cung được hỏi $P$ tại địa chi $b \in \{0..11\}$, tập sao tác động hợp lệ lên cung $P$ là:
       $$\text{EffectiveStars}(P) = \text{Stars}(b) \cup \text{BorrowedStars}(b) \cup \text{Stars}((b+4)\bmod 12) \cup \text{Stars}((b+8)\bmod 12) \cup \text{Stars}((b+6)\bmod 12)$$
     - Chỉ khi người dùng hỏi đích danh một sao $S$ tại cung $P$ mà $S \notin \text{EffectiveStars}(P)$ (tức không tọa thủ, không phải sao mượn Vô chính diệu, và không hội chiếu/xung chiếu từ Tam Phương Tứ Chính), hệ thống mới gán `starAbsentInQueriedPalace = true` để kích hoạt quy tắc từ chối suy diễn (`server.ts:425`). Nếu $S$ nằm ở cung tam hợp/đối cung chiếu về, hệ thống truy hồi bình thường và gắn nhãn rõ *"Sao $S$ hội chiếu/xung chiếu từ cung..."*.

#### B. Công thức Chấm điểm Xếp hạng Tất định (`scoreKnowledgeEntry`)
$$\text{Score} = W_{\text{combo}} + W_{\text{pattern}} + W_{\text{sihua}} + W_{\text{branch}} + W_{\text{single}} + W_{\text{tier}}$$
- `W_combo = +1000`: Khớp đồng thời cả `Chính tinh` + `Tên Cung`.
- `W_pattern = +850`: Khớp đúng tên Cách cục có trong `detectPatterns(chart)`.
- `W_sihua = +700`: Khớp đúng cặp `(Sao, Hóa Lộc/Quyền/Khoa/Kỵ)` đang kích hoạt trên cung/kỳ hạn.
- `W_branch = +300`: Khớp thêm Địa chi cung vị (VD: *Tử Vi Thất Sát tại Tỵ/Hợi*).
- `W_single = +250` (khớp đơn lẻ Chính tinh tại cung đang xét) hoặc `+200` (khớp chủ đề câu hỏi Chat).
- `W_tier`: `priorityTier === 1` cộng `+50`, `priorityTier === 2` cộng `+25`.
- **Phá hòa tất định (Tie-breaker)**: Sắp xếp theo `id` (`citationId`) tăng dần từ điển (`localeCompare`).
- **Chia đều Quota theo Cung (Per-Palace Quota ở Chương 2/3/4)**: Với các chương nhóm 4 cung (`palaces_core`, `palaces_family`, `palaces_social_health`), mỗi cung trong 4 cung được bảo đảm riêng `2–3` mục điểm cao nhất của cung đó trước khi lấp đầy phần dư.

### 4.2. Ngân sách Ký tự & Số mục Nạp kèm Mỗi Lượt Gọi AI

| Luồng API trong `server.ts` | Đợt tích hợp (`ĐN-9`) | Số mục tối đa (`maxEntries`) | Trần ký tự tối đa (`maxChars`) | Ước tính Token tăng thêm | Ghi chú phân bổ |
|---|:---:|:---:|:---:|:---:|---|
| **`/api/interpret-dossier-section`** (`chapter_overview`) | **Đợt Pilot 1A** | **8 mục** | **2.400 ký tự** | ~650 tokens | 3 mục Mệnh/Thân + 3 mục Cách cục + 2 mục Tứ Hóa Bản Mệnh/Đại Hạn |
| **`/api/interpret-dossier-section`** (`palaces_core`, `palaces_family`, `palaces_social_health`) | **Đợt Pilot 1A** | **10–12 mục** *(2–3 mục / cung × 4 cung)* | **3.200 ký tự** | ~850 tokens | Chia đều quota cho 4 cung trong nhóm |
| **`/api/interpret-dossier-section`** (`horizon_5y`, `horizon_10y`) | **Đợt Pilot 1A** | **6 mục** | **1.800 ký tự** | ~480 tokens | Tập trung vào chuyển Đại Hạn, Song Lộc/Song Kỵ, Lưu Niên xung/trùng Đại Hạn |
| **`/api/interpret-period`** (Đại Hạn & Lưu Niên — gồm cả Chương 5 `year_2026`, Chương 6 `year_2027`) | **Đợt Pilot 1A** | **7 mục** | **2.100 ký tự** | ~560 tokens | 2 mục cung kích hoạt + 4 mục cho 4 sao Tứ Hóa kỳ hạn + 1 mục cách cục/sao lưu |
| **`/api/interpret-chat`** (Hỏi đáp Ngữ cảnh) | **Đợt Pilot 1A** | **5 mục** | **1.500 ký tự** | ~400 tokens | Giữ prompt chat gọn nhanh cho câu trả lời 150–350 từ |
| **`/api/interpret` & `/api/heming`** (Luận giải nhanh & Hợp Bàn) | **Hoãn sang Đợt 1B (`ĐN-9`)** | **6 mục** | **1.800 ký tự** | ~480 tokens | Tích hợp ở Đợt 1B sau khi đã chưng cất xong `02-palaces` (cung Phu Thê) và `03-patterns` |

### 4.3. Điểm Tích Hợp Cụ Thể Trong Mã Nguồn Hiện Tại
1. **Mô-đun mới phía Server (`/server/knowledge-base/`)**:
   - `types.ts`, `loader.ts`, `retriever.ts`, `verifier.ts` và thư mục dữ liệu tĩnh `/server/knowledge-base/data/*.kb.json`.
2. **Tích hợp tại `server.ts` (Đợt Pilot 1A chỉ chạm 3 hàm prompt builder & 3 route chính theo `ĐN-9`)**:
   - `buildStrictPeriodAiPrompt` (`dòng 158–213`) & route `POST /api/interpret-period` (`dòng 638–762`).
   - `buildStrictDossierSectionPrompt` (`dòng 346–400`) & route `POST /api/interpret-dossier-section` (`dòng 765–853`).
   - `buildStrictExplanationChatPrompt` (`dòng 402–457`) & route `POST /api/interpret-chat` (`dòng 856–950`).
3. **Tích hợp tại `src/lib/ziwei/text-sanitizer.ts` & `src/lib/dossier-chat-ui.ts`**:
   - Bổ sung helper `scrubInvalidCitationTags(text, allowedIds)` vào `sanitizeDossierChapterText` (`src/lib/dossier-chat-ui.ts:170–197`); giữ nguyên `stripInternalExportMetaLines` (`dòng 204–225` — vốn chỉ lọc dòng chứa đồng thời `"Nguồn:"`, `"Model:"`, `"Khóa:"`, nên bảo toàn 100% thẻ `[Nguồn: NH-...]`).

---

## 5. Giải Quyết Điểm D — Đặc Tả Hậu Kiểm Chống Bịa 3 Lớp, Thời Điểm Chạy Theo Luồng & Cổng Kiểm Thử `K1/K2/K3` (`[CẬP NHẬT SAU PANEL — ĐN-4, ĐN-5, ĐN-6]`)

### 5.1. Ba Nhóm Mẫu Nhận Diện Khẳng Định Học Thuật (`M1`, `M2`, `M3`)
1. **Nhóm M1 — Viện dẫn đích danh Tác giả / Trường phái / Cổ thư (`Explicit Authority Attribution`)**:
   ```regex
   /(?<!\p{L})(?:nghê\s+hải\s+hạ|nghê\s+sư|thầy\s+nghê|ni\s+haixia|hệ\s+thống\s+thiên\s+kỷ|bài\s+giảng\s+thiên\s+kỷ|tử\s+vi\s+đẩu\s+số\s+toàn\s+thư|tử\s+vi\s+toàn\s+tập|cốt\s+tủy\s+phú|thái\s+vi\s+phú|cổ\s+quyết|cổ\s+phú|cổ\s+nhân\s+dạy|sách\s+xưa\s+chép|khẩu\s+quyết\s+thiên\s+kỷ)(?!\p{L})/giu
   ```
2. **Nhóm M2 — Trích dẫn câu phú / khẩu quyết trong ngoặc kép (`Quoted Formula / Aphorism Claim`)**:
   - Câu có cụm dẫn nhập học thuật (*"có câu"*, *"quyết viết"*, *"phú viết"*, *"khẩu quyết"*, *"luận rằng"*) đi kèm chuỗi ngoặc kép `"..."` hoặc `“...”` dài từ `12` đến `120` ký tự chứa ít nhất 1 tên Sao hoặc tên Cung chuẩn trong `vi-i18n.ts`.
3. **Nhóm M3 — Thẻ nguồn tường minh (`Explicit Citation Tag`)**:
   ```regex
   /\[Nguồn:\s*([A-Z0-9_-]{4,24})(?:\s*[·,|]\s*[^\]]+)?\]/gu
   ```
   - Ví dụ hợp lệ theo chuẩn nhóm `ĐN-10`: `[Nguồn: NH-STAR-012]`, `[Nguồn: NH-SIHUA-005]`, `[Nguồn: CL-CTP-008]`.

### 5.2. Đơn vị Cửa sổ Kiểm tra theo Khối Đoạn văn / Bullet & Quy tắc `V1/V2/V3` (`[ĐÃ SỬA THEO ĐN-4]`)
Thay vì dùng cửa sổ ký tự cứng `"≤ 250 ký tự"`, bộ hậu kiểm `verifyAcademicCitationsAndClaims(text, allowedEntries)` tách văn bản Markdown thành các **Khối Ngữ Nghĩa (`Semantic Blocks`)**: mỗi đoạn văn (ngăn cách bởi `\n\n+`), mỗi dòng tiêu đề (`^#{1,6}\s`), hoặc mỗi mục danh sách bullet/số (`^\s*(?:[-*•]|\d+[.)])\s+`).

1. **Quy tắc `V1` — Thẻ nguồn bịa hoặc nằm ngoài danh sách đã nạp (`Unauthorized Citation ID`)**:
   - Mọi thẻ `[Nguồn: <ID>]` khớp `M3` mà `<ID>` **không thuộc** `allowedEntryIds = new Set(allowedEntries.map(e => e.id))` đều bị đánh dấu là vi phạm `V1`.
2. **Quy tắc `V2` — Khối đoạn văn / bullet có viện dẫn học thuật `M1/M2` nhưng không có thẻ nguồn hợp lệ (`Uncited Authority Block`)**:
   - Nếu một Khối Đoạn văn / Bullet chứa mẫu `M1` hoặc `M2` nhưng **trong toàn bộ khối đoạn văn / bullet đó** (tối đa `800` ký tự) không có bất kỳ thẻ `[Nguồn: <ID>]` hợp lệ nào thuộc `allowedEntryIds` $\rightarrow$ đánh dấu khối đó vi phạm `V2`.
3. **Quy tắc `V3` — Gán thẻ nguồn lệch thực thể Sao / Cung (`Entity-Citation Mismatch`)**:
   - Với mỗi thẻ `[Nguồn: <ID>]` hợp lệ xuất hiện trong một Khối Đoạn văn / Bullet, lấy `entry = allowedEntriesById.get(ID)`.
   - Nếu trong Khối Đoạn văn / Bullet đó không xuất hiện bất kỳ tên Sao, tên Cung, Tứ Hóa hay Cách cục nào thuộc `entry.retrievalKeys` $\rightarrow$ đánh dấu thẻ đó vi phạm `V3`.

### 5.3. Xử lý Vi phạm An toàn Không Sửa Ngữ Pháp & Thời điểm Hậu kiểm Theo Luồng (`[ĐÃ SỬA THEO ĐN-5 & ĐN-6]`)
1. **Tuyệt đối không dùng regex viết lại chữ bên trong câu văn tiếng Việt của AI (`ĐN-6`)**:
   - **Xử lý `V1` và thẻ gắn sai `V3`**: Chỉ gỡ bỏ cụm token `[Nguồn: <ID_SAI>]` khỏi văn bản (an toàn 100% về ngữ pháp vì thẻ nằm độc lập trong ngoặc vuông).
   - **Xử lý `V2` và `V3`**: Giữ nguyên văn câu chữ của AI để không làm đứt mạch văn, đồng thời tự động nối **Hộp Lưu Ý Kiểm Chứng Nguồn** ở cuối chương/bài.
   - **Khi có $\ge 1$ thẻ `[Nguồn: <ID>]` hợp lệ**: Tự động nối khối **`> 📚 [Tư Liệu Học Thuật Tham Chiếu]`** ở cuối chương/bài, in rõ tên bài giảng, tiêu đề nhóm `groupTitleVi`, mã video `bvid` và mốc thời gian `timeRangeHms` của các thẻ đã được AI sử dụng.
2. **Thời điểm chạy hậu kiểm theo từng luồng (`ĐN-5`)**:
   - **Luồng Hồ Sơ 8 Chương (`/api/interpret-dossier-section` + `DetailedDossierModal.tsx`)**: Trong lúc stream SSE vẫn gửi trực tiếp từng chunk qua `sanitizeLayer3AOnly` để không ảnh hưởng `FIRST_CHUNK_TIMEOUT_MS = 12_000 ms`. Ngay khi `executeStream` hoàn tất (`!wasInterrupted`), server chạy `verifyAcademicCitationsAndClaims`, stream khối `> 📚 [Tư Liệu Học Thuật Tham Chiếu]` (và hộp lưu ý `⚠️` nếu có `V2/V3`) làm chunk cuối cùng trước `data: [DONE]`, đồng thời gửi event `{ citationAudit }`. Ở phía client trước khi lưu vào `IndexedDB` SSOT, `sanitizeDossierChapterText` gỡ sạch mọi thẻ `[Nguồn: ID_SAI]` bị gắn cờ `V1/V3`.
   - **Luồng Vận hạn (`/api/interpret-period`)**: Chạy `verifyAcademicCitationsAndClaims` ngay sau khối `verifyAndEnsureCompletePeriodSiHua` (`server.ts:705–730`) và stream khối tham chiếu / lưu ý kiểm chứng ngay trước `data: [DONE]`.
   - **Luồng Hỏi đáp Ngữ cảnh (`/api/interpret-chat`)**: Không sửa ngược các chữ đã stream ra bong bóng chat; ngay khi kết thúc stream (`before [DONE]`), server stream nối tiếp dòng chú thích nguồn đối chiếu (nếu hợp lệ) hoặc dòng lưu ý kiểm chứng ngắn gọn (nếu phát hiện `V1/V2/V3`) ở cuối bong bóng chat.

### 5.4. Bộ Kiểm thử Nghiệm thu Định lượng (`scripts/verify-knowledge-base.ts` — `npm run verify:kb`) (`[ĐÃ HIỆU CHỈNH THEO ĐN-4]`)
1. **Nhóm K1 — Kiểm thử Truy hồi Tất định trên `25` Ca Chuẩn (`Golden Retrieval Suite`)**:
   - Tính tất định 10 lần gọi liên tiếp: **`100%`**.
   - Độ chính xác Top-K (mục tri thức nhóm `(book, h2, h3)` mục tiêu nằm trong `allowedEntries`): **`100% (25/25 ca)`**.
   - Tuân thủ trần ngân sách ký tự `maxChars`: **`100% (25/25 ca)`**.
2. **Nhóm K2 — Kiểm thử `15` Ca Bẫy Ngoài Kho & Sao Vắng Mặt (`Out-of-Scope & Absence Trap Suite`)**:
   - Nhận diện đúng câu hỏi thuộc Tầng 3 (phong thủy, bói dịch, đơn thuốc Đông y), tổ hợp ngoài kho, hoặc sao vắng mặt trên cả Bản cung + Sao mượn + Tam Phương Tứ Chính (`starAbsentInQueriedPalace = true`), bơm đúng chỉ thị Lớp 3: **`100% (15/15 ca)`**.
3. **Nhóm K3 — Kiểm thử Bộ Hậu kiểm Lớp 2 trên `24` Mẫu Văn bản Chuẩn (`Verifier Benchmark Suite` — `ĐN-4`)**:
   - **Tập K3-A (`8` mẫu kiểm tra `V1` mã thẻ hợp lệ vs mã thẻ bịa)**: Yêu cầu **`Recall = 100% (8/8)`** và **`False Positive = 0% (0/8)`**.
   - **Tập K3-B (`8` mẫu kiểm tra `V2 & V3` viện dẫn quên gắn thẻ hoặc gắn thẻ lệch sao/cung)**: Yêu cầu **`Recall ≥ 87,5% (≥ 7/8 mẫu, mục tiêu thiết kế 8/8)`**.
   - **Tập K3-C (`8` mẫu hợp lệ gồm câu mô tả dữ kiện lá số chuẩn & đoạn văn đặt thẻ ở cuối đoạn/bullet)**: Yêu cầu **`False Positive ≤ 12,5% (tối đa ≤ 1/8 mẫu báo nhầm, mục tiêu thiết kế 0/8)`**.

---

## 6. Giải Quyết Điểm E — Lộ Trình Phân Đợt Đã Tính Lại Theo Số Đo Thật (`[CẬP NHẬT SAU PANEL — ĐN-1, ĐN-7, ĐN-9, ĐN-10]`)

### 6.1. Đợt 1A — Đợt Thí Điểm (Pilot, Phiên bản đích `1.4.0-rc.1`): "Trục Tinh Diệu, Tứ Hóa & Cổ Phú Nền Tảng"
- **Phạm vi dữ liệu Pilot (`~162` mục chưng cất cấp nhóm)**:
  1. Toàn bộ **`83` nhóm `(book, h2, h3)` của quyển `01-stars`** (gộp từ `378` dòng `quote` trong `entries.jsonl` + ngữ cảnh bài giảng `(bvid, t_hms)`).
  2. Toàn bộ **`19` nhóm `(book, h2, h3)` của quyển `04-sihua`** (gộp từ `174` dòng `quote` trong `entries.jsonl` + ngữ cảnh bài giảng `(bvid, t_hms)`).
  3. Các câu phú kinh điển trong **`lib/classics/data/`** gắn với 14 Chính Tinh & Tứ Hóa (*Cốt Tủy Phú*, *Thái Vi Phú* — khoảng **`~60` mục**).
  - **Khối lượng & Chi phí chưng cất thực tế**: Tổng cộng **`~162` mục `DistilledKnowledgeEntry`**, chạy ngoại tuyến bằng `gemini-2.5-pro` / `gemini-3.8-flash` (gom lô 3 nhóm/request) chỉ tốn **`~55 – 65` lượt gọi API một lần duy nhất**; dung lượng `.kb.json` đầu ra chỉ khoảng **`~240 – 300 KB`**.
- **Phạm vi tích hợp Runtime ở Đợt Pilot 1A (`ĐN-9`)**:
  - Xây dựng đầy đủ `/server/knowledge-base/` (`types.ts`, `loader.ts`, `retriever.ts`, `verifier.ts`) và bộ công cụ `scripts/kb-*.ts`.
  - Chỉ tích hợp vào **3 luồng cốt lõi**: `/api/interpret-dossier-section`, `/api/interpret-period`, và `/api/interpret-chat` (hoãn `/api/interpret` và `/api/heming` sang Đợt 1B).
- **4 Tiêu chí Qua Cổng Pilot (`Pilot Exit Gate`)**:
  1. `kb:verify-source` và `kb:audit` đạt **`100% PASS`** trên toàn bộ `~162` mục (`0` chữ Hán sót ở trường tiếng Việt, `100%` thuật ngữ khớp `vi-i18n.ts`, `100%` `quoteCn` khớp dòng gốc `entries.jsonl`).
  2. Phiếu kiểm định mẫu `docs/kb-pilot-audit-sheet.md` (`25` mục mẫu đối chiếu qua NotebookLM / neo Hán) đạt **`≥ 24/25 (96%+)`** ngay lần đầu (`0` lỗi đảo ngược cát/hung), sửa hết lỗi trên mẫu lên `25/25` và được Chủ dự án ký duyệt (`ĐN-10`).
  3. Bộ kiểm thử tự động `npm run verify:kb` (`K1` 25 ca + `K2` 15 ca + `K3` 24 mẫu) và `npm run verify:all` đạt **`100% PASS`**.
  4. Kiểm chứng thực tế trên `gemini-3.5-flash-lite`: TTFB $< 12\text{ giây}$, cuối chương hiển thị đúng khối `📚 [Tư Liệu Học Thuật Tham Chiếu]`.

### 6.2. Đợt 1B — Mở Rộng Hoàn Tất Tầng 1 (Phiên bản đích `1.4.0-rc.2`): "12 Cung Vị, Cách Cục & 16 Bài Giảng Thiên Kỷ"
- **Phạm vi dữ liệu bổ sung (`+117` mục $\rightarrow$ Tổng Tầng 1 = `~279` mục, dung lượng `~450–500 KB`)**:
  1. Quyển **`02-palaces`** (`366` dòng `quote` trong `16` nhóm `h3`, tách tất định theo `Cung × Cụm Sao` thành **`~52` tiểu mục** theo `NK-11`).
  2. Quyển **`03-patterns`** (`127` dòng `quote` $\rightarrow$ **`20` nhóm `h3`**).
  3. Chuyên đề bổ sung từ **`16` file bài giảng `tianji-ziwei/*.md`** (`150.726` chữ Hán) & `lib/nihai/` cho các thế đứng Tử Vi chưa nằm trong `entries.jsonl` (**`~45` mục**).
  - **Chi phí chưng cất Đợt 1B**: Chỉ khoảng **`~40 – 50` lượt gọi API**.
- **Phạm vi tích hợp bổ sung**: Tích hợp nốt vào 2 luồng `/api/interpret` và `/api/heming` (`server.ts:953, 1066`).

### 6.3. Đợt 2 — Mở Rộng Tầng 2 (Phiên bản đích `1.5.0-rc.1`): "Tật Ách Chuyên Sâu, Phương Pháp Luận Chọn Lọc & Ca Mệnh Thực Chiến"
- **Phạm vi dữ liệu bổ sung (`+88` mục $\rightarrow$ Tổng toàn kho = `~367` mục tinh hoa, dung lượng `~620–660 KB`)**:
  1. Quyển **`05-illness`** (`80` dòng `quote` $\rightarrow$ **`~18` nhóm `h3`**).
  2. Bộ lọc chọn lọc từ **`07-methodology`** (`~250` dòng `quote` gắn trực tiếp với phương pháp luận bàn Tử Vi $\rightarrow$ **`~35` nhóm `h3`**).
  3. Các ca mệnh thực chiến có tọa độ cung/sao rõ ràng từ `research/nishi-video-reading/` (**`~35` mục**).

---

## 7. Giải Quyết Điểm F — Giấy Phép CC BY-NC-SA 4.0 & Danh Sách Quyết Định Trình Chủ Dự Án Chốt (`QĐ-N1..QĐ-N8`)

### 7.1. Ghi công & Phân tách Bản quyền theo Từng Nguồn (`[CẬP NHẬT SAU PANEL — NK-12]`)
1. **Phân biệt bản quyền trong Schema (`sourceLicense`)**:
   - Với `nihai_entry` và `nihai_lecture` (bài giảng Thiên Kỷ của Nghê Hải Hạ và `entries.jsonl` từ `github.com/Renhuai123/ziwei-doushu`): gắn `sourceLicense: 'CC-BY-NC-SA-4.0'`. Các file `.kb.json` chứa nhóm này được cấp phép theo **CC BY-NC-SA 4.0** (phi thương mại, chia sẻ tương tự, kèm file `LICENSE-CC-BY-NC-SA-4.0.md` tại `/knowledge-source/` và `/server/knowledge-base/data/`).
   - Với `classic_verse` (*Cốt Tủy Phú*, *Thái Vi Phú*, *Tử Vi Đẩu Số Toàn Thư*): văn bản chữ Hán cổ đại thuộc phạm vi công cộng (`Public Domain`), bản dịch và chú giải tiếng Việt gắn `sourceLicense: 'PUBLIC_DOMAIN_TEXT_WITH_CC_BY_NC_SA_ADAPTATION'`.
2. **Hiển thị Ghi công (Attribution)**:
   - Ghi công trang trọng trong `/README.md`, `docs/features-dossier-and-chat.md`, chân trang học thuật của `KnowledgeView.tsx`, và trong khối `📚 [Tư Liệu Học Thuật Tham Chiếu]` cuối các chương Hồ Sơ.

---

### 7.2. Danh sách Quyết định Kiến trúc sau Panel trình Chủ dự án chốt (`QĐ-N1` .. `QĐ-N8`)

#### `QĐ-N1` — Phương thức nạp kho nguồn vào `/knowledge-source/` & Cổng kiểm tra toàn vẹn `kb:verify-source`
- **Phương án A (Khuyến nghị của Panel — Nạp đủ `entries.jsonl` + `16` file `tianji-ziwei/*.md` + `classics/` ngay từ Đợt 1A và kiểm tra theo số đo thật `[B]`)**:
  - Đưa `entries.jsonl` (`1.848` dòng, `134.435` ký tự `quote`, `208` nhóm `h3`, `138` nhóm Tầng 1), `tianji-ziwei/` (`16` file `.md`, `342.785` ký tự, `150.726` ký tự Hán, `~685.749` byte) và `classics/` (~40 KB) vào `/knowledge-source/` (tổng cộng chỉ `~1,45 MB`) ngay từ Đợt 1A để script chưng cất tra cứu được đoạn bài giảng quanh `(bvid, t_hms)`.
- **Phương án B (Chỉ nạp `entries.jsonl` + `classics/` ở Đợt 1A, hoãn `16` file bài giảng sang Đợt 1B)**: Không kéo được ngữ cảnh bài giảng `(bvid, t_hms)` ở Đợt 1A.
- **Khuyến nghị của Tổ Chuyên Gia**: **Chọn Phương án A**.

#### `QĐ-N2` — Đơn vị Chưng cất & Văn bản Nguồn đầu vào (`ĐN-1`, `ĐN-2`, `NK-11`)
- **Phương án A (Khuyến nghị của Panel — Gộp theo nhóm `(book, h2, h3)` + Kéo ngữ cảnh bài giảng quanh `(bvid, t_hms)` + Chia tiểu mục có điều kiện cho `02-palaces`)**:
  - Gộp các `quote` + `note` cùng `(book, h2, h3)` theo thứ tự `(part, t_hms)` thành 1 mục tri thức hoàn chỉnh (`01-stars`: `83` mục, `04-sihua`: `19` mục, `03-patterns`: `20` mục; riêng `16` nhóm lớn của `02-palaces` tách tất định theo `Cung × Cụm Sao` thành `~52` tiểu mục).
  - Khi chưng cất `nihai_entry`, tự động kéo đoạn bài giảng trong `16` file `.md` khớp `(bvid, t_hms)` ($\pm 500\text{–}600$ ký tự) làm ngữ cảnh bổ trợ, nhưng `hanziAnchor` vẫn neo cứng vào mảng `quote` gốc của `entries.jsonl`.
- **Phương án B (Chưng cất từng dòng `entries.jsonl` rời rạc như V1)**: Sinh ra 1.045 mảnh vụn (trung vị 61 ký tự), mất mạch điều kiện và trùng lặp Top-K.
- **Khuyến nghị của Tổ Chuyên Gia**: **Chọn Phương án A**.

#### `QĐ-N3` — Môi trường, API Key & Model chạy Pipeline Chưng cất (`ĐN-3`)
- **Phương án A (Khuyến nghị của Panel — Offline Local Build-and-Commit bằng Model mạnh `gemini-2.5-pro` / `gemini-3.8-flash`)**:
  - Toàn bộ script `scripts/kb-*.ts` được viết và lưu trong repo; Chủ dự án (hoặc kỹ sư) chạy chưng cất ngoại tuyến bằng key riêng với model **`gemini-2.5-pro`** (hoặc **`gemini-3.8-flash`**) — Đợt Pilot 1A chỉ tốn `~55–65` requests — rồi commit các file kết quả tĩnh `/server/knowledge-base/data/*.kb.json` vào dự án. Không đụng tới Kho Khóa Runtime của app và không phụ thuộc tính bền thư mục tạm của AI Studio.
- **Phương án B (Chạy trực tiếp trong container AI Studio và mượn Kho Khóa Runtime của app)**: Tiềm ẩn rủi ro mất checkpoint khi container khởi động lại và chia sẻ hạn mức với người dùng.
- **Khuyến nghị của Tổ Chuyên Gia**: **Chọn Phương án A** (vẫn hỗ trợ chạy CLI với biến môi trường `KB_DISTILL_GEMINI_KEY` nếu Chủ dự án muốn kích hoạt trên terminal).

#### `QĐ-N4` — Cách hiển thị Thẻ Nguồn (`[Nguồn: ...]`) cho Người dùng Cuối (`ĐN-10`)
- **Phương án A (Khuyến nghị của Panel — Thẻ mã nhóm ngắn gọn trong bài + Khối `📚 Tư Liệu Học Thuật Tham Chiếu` ở cuối chương/bài)**:
  - Trong thân bài, AI gắn mã thẻ cấp nhóm ngắn gọn (`[Nguồn: NH-STAR-012]`, `[Nguồn: CL-CTP-008]`); khi kết thúc chương/bài, hệ thống tự động nối mục `> 📚 **[Tư Liệu Học Thuật Tham Chiếu]**` giải nghĩa đầy đủ tên bài giảng, tiêu đề mục, mã video `bvid` và mốc thời gian `t_hms`.
- **Phương án B (Thay mã thẻ bằng chuỗi chú thích dài ngay giữa dòng văn bản)**.
- **Phương án C (Ẩn hoàn toàn thẻ nguồn khỏi giao diện người dùng)**.
- **Khuyến nghị của Tổ Chuyên Gia**: **Chọn Phương án A**.

#### `QĐ-N5` — Cơ chế Hậu kiểm Lớp 2, Thời điểm chạy theo luồng & Xử lý Vi phạm An toàn (`ĐN-4`, `ĐN-5`, `ĐN-6`)
- **Phương án A (Khuyến nghị của Panel — Cửa sổ Khối Đoạn văn/Bullet + Gỡ thẻ sai `V1/V3` + Nối Hộp Lưu Ý Kiểm Chứng Cuối Bài, KHÔNG dùng regex sửa chữ trong câu văn)**:
  - Cửa sổ kiểm tra `V2/V3` tính theo **Khối Đoạn văn / Mục Bullet Markdown**.
  - Tuyệt đối không dùng regex viết lại chữ giữa câu văn tiếng Việt; chỉ gỡ bỏ token thẻ `[Nguồn: ID_SAI]` bất hợp lệ (`V1/V3`) và tự động nối **Hộp Lưu Ý Kiểm Chứng Nguồn (`⚠️`)** ở cuối chương Hồ Sơ / Vận hạn / cuối bong bóng Chat.
  - Cổng kiểm thử `K3` (`24` mẫu chuẩn): `V1` đạt `100% Recall / 0% FP`; `V2 & V3` đạt `Recall ≥ 87,5% (≥ 7/8)` và `False Positive ≤ 12,5% (≤ 1/8, 0 báo nhầm trên câu dữ kiện lá số)`.
- **Phương án B (Dùng regex tự động viết lại cụm từ mạo danh giữa câu văn như V1)**: Nguy cơ cao làm hỏng ngữ pháp tiếng Việt.
- **Phương án C (Cắt bỏ hoàn toàn đoạn văn có `V2/V3`)**: Nguy cơ làm hụt sàn số từ bắt buộc của Hồ Sơ 8 Chương.
- **Khuyến nghị của Tổ Chuyên Gia**: **Chọn Phương án A**.

#### `QĐ-N6` — Ngân sách Ký tự Tri thức Runtime & Quy tắc Truy hồi Chat (`ĐN-8`)
- **Phương án A (Khuyến nghị của Panel — Ngân sách cân bằng `1.500 – 3.200` ký tự/lượt + Chat Best-Effort + `starAbsentInQueriedPalace` xét đủ Tam Phương Tứ Chính)**:
  - Áp dụng ngân sách Bảng 4.2 (`chapter_overview`: 8 mục / 2.400 ký tự; Nhóm 4 cung: 10–12 mục / 3.200 ký tự; Vận hạn: 7 mục / 2.100 ký tự; Tầm nhìn 5/10 năm: 6 mục / 1.800 ký tự; Chat: 5 mục / 1.500 ký tự).
  - Trong Chat, `starAbsentInQueriedPalace = true` chỉ khi sao được hỏi vắng mặt trên **cả Bản cung, Sao mượn Vô chính diệu lẫn Tam Phương Tứ Chính (`+4, +8, +6`)**.
- **Phương án B (Chỉ xét sao tọa thủ bản cung khi kiểm tra `starAbsentInQueriedPalace`)**: Sai lệch học thuật Tử Vi khi sao hội chiếu từ Tam Phương / Đối cung.
- **Khuyến nghị của Tổ Chuyên Gia**: **Chọn Phương án A**.

#### `QĐ-N7` — Phân tầng Phạm vi Tư liệu Ngoài Lá Số & Ghi công Bản quyền (`NK-12`)
- **Phương án A (Khuyến nghị của Panel — Loại hoàn toàn Tầng 3 khỏi runtime Tử Vi; gắn `sourceLicense` tách biệt cho Thiên Kỷ `CC-BY-NC-SA-4.0` và Cổ thư `Public Domain`)**:
  - Không nạp `08-yili`, `10-divination`, `11-fengshui` và phần phong thủy/tướng pháp/y lý rời của `07-methodology` vào kho runtime.
- **Phương án B (Nạp cả Tầng 3 vào runtime cho luồng Chat)**.
- **Khuyến nghị của Tổ Chuyên Gia**: **Chọn Phương án A**.

#### `QĐ-N8` — Phân đợt Triển khai, Hoãn 2 Route Phụ ở Pilot & Lộ trình Phiên bản (`ĐN-7`, `ĐN-9`, `ĐN-10`)
- **Phương án A (Khuyến nghị của Panel — Chia 3 đợt rõ ràng kèm cổng QA 25 mục mẫu)**:
  - **Đợt Pilot 1A (`1.4.0-rc.1`)**: Chưng cất `83` nhóm `01-stars` + `19` nhóm `04-sihua` + `~60` mục cổ phú `classics` = **`~162` mục** (`~55–65` requests, `~240–300 KB`); tích hợp vào **3 luồng chính** (`/api/interpret-dossier-section`, `/api/interpret-period`, `/api/interpret-chat`); nghiệm thu qua cổng `verify:kb` + phiếu kiểm định mẫu `25` mục trên NotebookLM ($\ge 24/25$ đạt, 0 lỗi ngược cát/hung, Chủ dự án ký cổng).
  - **Đợt 1B (`1.4.0-rc.2`)**: Bổ sung `02-palaces` (`~52` tiểu mục), `03-patterns` (`20` nhóm), chuyên đề 16 bài giảng (`~45` mục) $\rightarrow$ tổng Tầng 1 = **`~279` mục** (`~450–500 KB`), tích hợp nốt `/api/interpret` và `/api/heming`.
  - **Đợt 2 (`1.5.0-rc.1`)**: Bổ sung `05-illness` (`~18` nhóm), `07-methodology` chọn lọc (`~35` nhóm) và ca mệnh thực chiến (`~35` mục) $\rightarrow$ tổng toàn kho = **`~367` mục**.
- **Phương án B (Tích hợp cả 5 route và gộp toàn bộ Tầng 1 ngay trong 1 đợt duy nhất)**.
- **Khuyến nghị của Tổ Chuyên Gia**: **Chọn Phương án A**.

---

## 8. Giải Quyết Điểm G — Lộ Trình Phiên Bản Đích & Danh Mục Tài Liệu Sống Phải Cập Nhật Khi Triển Khai

1. **Lộ trình phiên bản theo từng đợt**:
   - **Lượt lập kế hoạch & phản biện Panel (Hiện tại)**: Giữ nguyên `/VERSION = 1.3.0-rc.1` và `package.json = "1.3.0"`.
   - **Đợt 1A (`1.4.0-rc.1`, `package.json`: `"1.4.0"`)**: Thi công khung `/server/knowledge-base/`, bộ script `kb:*`, kho Pilot `~162` mục, tích hợp 3 luồng chính và bộ test `verify:kb`.
   - **Đợt 1B (`1.4.0-rc.2`, `package.json`: `"1.4.0"`)**: Hoàn tất 100% Tầng 1 (`~279` mục) và tích hợp nốt `/api/interpret` + `/api/heming`.
   - **Đợt 2 (`1.5.0-rc.1`, `package.json`: `"1.5.0"`)**: Mở rộng Tầng 2 (`~367` mục).
2. **Danh mục Tài liệu Sống phải cập nhật đồng bộ khi thi công Đợt 1A**:
   - `/VERSION`, `/package.json`, `/CHANGELOG.md` (bổ sung mục `[1.4.0-rc.1]`).
   - `docs/architecture-overview.md` (cập nhật Tầng 2 `Context & Deterministic Knowledge Retrieval` và Tầng 4 `Sanitizer & Citation Verifier`, cùng `/knowledge-source/` & `/server/knowledge-base/`).
   - `docs/features-dossier-and-chat.md` (bổ sung đặc tả Truy hồi Tri thức Tất định cấp nhóm `(book, h2, h3)`, Ngân sách ký tự Bảng 4.2, và Hậu kiểm Chống bịa 3 lớp).
   - `docs/decisions-registry.md` (bổ sung **Đợt 8 — `QĐ-N1..QĐ-N8`**).
   - `docs/INDEX.md` (đăng ký `docs/knowledge-base-design-plan.md`, `docs/knowledge-base-expert-panel-review.md` và ghi chú nghiệm thu).
   - `/README.md` (cập nhật ghi công CC BY-NC-SA 4.0 và danh sách lệnh `npm run kb:*`, `npm run verify:kb`).
