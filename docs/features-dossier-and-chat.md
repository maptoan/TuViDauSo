# ĐẶC TẢ HỒ SƠ 8 CHƯƠNG, HỎI ĐÁP NGỮ CẢNH, HỢP BÀN & HẬU KIỂM (`docs/features-dossier-and-chat.md`)

- **Loại tài liệu**: `[Tài liệu Sống — SSOT Tính năng Nghiệp vụ & Giao diện AI]`
- **Trạng thái hiệu lực**: `ĐANG HIỆU LỰC (ACTIVE)`
- **Áp dụng cho phiên bản ứng dụng**: `1.1.0-rc.1` *(đồng bộ với `/VERSION`)*
- **Cập nhật lần cuối**: `17/11/2026` *(đồng bộ toàn bộ `F1–F7`, `QĐ-G1..G6`, `QĐ-H1..H3`, `QĐ-H5..H7`)*
- **Mã nguồn đối chiếu (Code SSOT)**: `src/lib/dossier-chat-ui.ts`, `src/lib/ziwei/text-sanitizer.ts`, `src/lib/ziwei/yunxian-context.ts`, `src/lib/ziwei/dossier-context.ts`, `src/lib/ziwei/share.ts`, `src/components/DetailedDossierModal.tsx`, `src/components/ContextualChatDrawer.tsx`, `src/components/InsightPanel.tsx`, `src/components/HemingView.tsx`
- **Quyết định liên quan**: `F1–F7`, `QĐ-G1..QĐ-G6`, `QĐ-H1..H3`, `QĐ-H5..H7` *(chi tiết tại `docs/decisions-registry.md`)*

---

## 1. Hồ Sơ Toàn Diện 8 Chương (`DetailedDossierModal.tsx` & `dossier-chat-ui.ts`)

### 1.1. Danh sách chính thức 8 chương (`DOSSIER_CHAPTER_SPECS`)
Định nghĩa chuẩn tại `src/lib/dossier-chat-ui.ts:654–727`:

| STT | Mã chương (`DossierChapterId`) | Tên chương (`titleVi`) | Nguồn dữ kiện & Chế độ |
|:---:|---|---|---|
| 1 | `chapter_overview` | Chương 1 — Tổng Quan Mệnh Cục & Cách Cục Tiên Thiên | `dossier-context.ts` (`dossier_section`) — gồm Tam Phương Tứ Chính Mệnh & `detectPatterns` (`QĐ-H3`) |
| 2 | `palaces_core` | Chương 2 — Nhóm Cung Cốt Lõi: Mệnh · Quan Lộc · Tài Bạch · Thiên Di | `dossier-context.ts` (`dossier_section`) |
| 3 | `palaces_family` | Chương 3 — Nhóm Cung Gia Đạo & Nội Lực: Phu Thê · Tử Nữ · Điền Trạch · Phúc Đức | `dossier-context.ts` (`dossier_section`) |
| 4 | `palaces_social_health` | Chương 4 — Nhóm Cung Quan Hệ & Thể Chất: Phụ Mẫu · Huynh Đệ · Giao Hữu · Tật Ách | `dossier-context.ts` (`dossier_section`) |
| 5 | `year_2026` | Chương 5 — Vận Hạn Lưu Niên Năm Hiện Tại (2026) | `yunxian-context.ts` (`period`, `year: 2026`) — đồng bộ 2 chiều với `aiPeriodCache` |
| 6 | `year_2027` | Chương 6 — Vận Hạn Lưu Niên Năm Sau (2027) | `yunxian-context.ts` (`period`, `year: 2027`) — đồng bộ 2 chiều với `aiPeriodCache` |
| 7 | `horizon_5y` | Chương 7 — Chiến Lược Trung Hạn 5 Năm (2026–2030) | `dossier-context.ts` (`dossier_section`, `buildMultiYearHorizonContext`) |
| 8 | `horizon_10y` | Chương 8 — Đại Cục Tầm Nhìn 10 Năm (2026–2035) | `dossier-context.ts` (`dossier_section`, `compactMatrixMarkdown` + chi tiết 10 năm) |

### 1.2. Cơ chế sinh tuần tự & Nhịp nghỉ bảo vệ Kho Khóa (`QĐ-H7`)
- **`concurrency = 1`**: `handleRunAllSequential` (`src/components/DetailedDossierModal.tsx:651–713`) chạy tuần tự từng chương chưa hoàn tất để không xung đột `abortRef` đơn lẻ và tránh chạm trần RPM.
- **`DOSSIER_INTER_CHAPTER_PACING_MS = 1_200`** (`src/lib/dossier-chat-ui.ts:652`): Nghỉ **`1.200 ms` (`1.2 giây`)** giữa 2 chương liên tiếp (cập nhật từ `QĐ-H7`), tự động bỏ qua nếu người dùng bấm Dừng hoặc Tạm dừng sau chương hiện tại.
- Nếu API trả về `res.status === 503 && errCode === 'AI_NOT_CONFIGURED'` (`DetailedDossierModal.tsx:367`, `InsightPanel.tsx:183` — sửa theo `QĐ-H5`), vòng chạy dừng sớm với thông báo kho chưa cấu hình khóa.

### 1.3. Lưu trữ phiên `window.sessionStorage` & Đồng bộ 8/8 Chương (`QĐ-H1` + `QĐ-H2`)
- **Khóa định danh lá số (`buildChartIdentityKey`)**: Định nghĩa duy nhất tại `src/lib/ziwei/yunxian-context.ts:292–310` (`${year}_${month}_${day}_${hour}_${gender}__${nameSlug}__mg${mingGongBranch}__${leapFlag}__${origSig}__${lonSig}`). Chống hoàn toàn lỗi nạp nhầm văn bản cũ khi đổi tên đương số, đổi phút sinh trong cùng canh giờ hoặc đổi kinh độ nơi sinh.
- **Lưu đủ 8 chương vào `sessionStorage` (`QĐ-H1`)**:
  - `StoredDossierRecord` (`src/lib/dossier-chat-ui.ts:750–754`) cho phép `sections` lưu `Partial<Record<DossierChapterId, DossierChapterState>>` — **bao gồm cả `year_2026` và `year_2027`**.
  - Lưu bằng khóa `ziwei_dossier_v1::<chartIdentityKey>` với chính sách **LRU tối đa `MAX_DOSSIERS_IN_SESSION = 5` hồ sơ** (`dossier-chat-ui.ts:91, 264–303`).
  - `DetailedDossierModal.tsx` đồng bộ 2 chiều giữa `sessionStorage` và state `aiPeriodCache` khi mở Modal và sau khi hoàn tất Chương 5, 6 (`DetailedDossierModal.tsx:583–597`), bảo đảm **bấm `F5` (tải lại trang trong cùng tab) không mất bất kỳ chương nào trong 8 chương**.
  - Khi đọc cache cũ (`readDossierCacheEntry`, `dossier-chat-ui.ts:230–259`), hệ thống tự động chạy `sanitizeDossierChapterText` làm sạch không tốn quota AI.

---

## 2. Kết Xuất Hồ Sơ, Header S5 & Lọc Dòng Meta Nội Bộ

### 2.1. Header S5 Nguồn Duy Nhất (`buildDossierHeaderMetadata` — `QĐ-G5` & `QĐ-H5`)
- Định nghĩa tại `src/lib/dossier-chat-ui.ts:969–1090`, dùng chung cho Modal UI, trang 1 `.html`, bản in trực tiếp, `.md` và PlainText.
- **Nối dây `origInput` (`QĐ-G5`)**: `formToBirthInfo` trong `src/lib/ziwei/share.ts:61–67` luôn lưu giờ phút đồng hồ gốc khi không chọn *"Không rõ giờ sinh"*.
- **Khớp điều kiện Chân Thái Dương Thời (`QĐ-H5` / `A-02`)**: `buildDossierHeaderMetadata` (`dossier-chat-ui.ts:984–1047`) chỉ tính và hiển thị hiệu chỉnh Chân Thái Dương Thời khi **`b.origInput && hasValidLongitude`** (khớp 100% với `algorithm.ts`), tránh tự áp mặc định `105.0°Đ` khi mở từ link chia sẻ thiếu tham số tỉnh/thành (`p`).

### 2.2. Định dạng Kết Xuất & Lọc Meta (`QĐ-G3`, `QĐ-G4`, `QĐ-G6`)
- **`buildDossierStandaloneHtmlExport` (`dossier-chat-ui.ts:1897–1997`) & In trực tiếp**: Phong cách biên tập **Giấy Cổ** (`#FBF8F1` / `#FFFDF8`) + `@media print` (`DOSSIER_EDITORIAL_PRINT_CSS`, `dossier-chat-ui.ts:1410–1799`); Trang 1 gồm Header S5 (`B1`), 5 dòng Cốt Tủy Xác Định (`B6`), lá số lưới **4×4 HTML (`B2`)**; Chương 7 & 8 nhúng bảng ma trận 5 cột xác định (**`B3`**).
- **`buildDossierMarkdownExport` & `buildDossierPlainTextExport` (`dossier-chat-ui.ts:1805–1892`)**: Xuất Header S5, 5 dòng Cốt Tủy và văn bản 8 chương thuần túy (không chèn lưới HTML 4×4 hay bảng ma trận vào file `.md`/text).
- **Loại bỏ dòng meta vận hành nội bộ (`stripInternalExportMetaLines` — `QĐ-G6`, `dossier-chat-ui.ts:204–225`)**: Tự động lọc sạch các dòng mở đầu bằng `Nguồn:` và chứa cả `Model:` lẫn `Khóa:` (ví dụ nguồn sinh, tên model, mã khóa che mặt nạ) khỏi **toàn bộ** bản kết xuất `.html`, `.md`, PlainText, sao chép và in trực tiếp, chỉ giữ dòng meta vận hành bên trong giao diện Modal khi đang soạn.

---

## 3. Pipeline Hậu Kiểm Văn Bản 2 Lớp (`text-sanitizer.ts` & `dossier-chat-ui.ts`)

Mọi đầu ra văn bản AI đều phải đảm bảo tính lũy đẳng **`f(f(x)) === f(x)`**:

1. **Lớp 3A (`sanitizeLayer3AOnly` — `src/lib/ziwei/text-sanitizer.ts:54–58`)**:
   - Chạy an toàn trên từng mảnh chunk SSE ngay ở server (`sendSseText` tại `server.ts:112`) và trên client.
   - Khi `allowHan = false` (mặc định tắt song ngữ), xóa ký tự Hán (`\p{Script=Han}`) và toàn bộ hệ chữ ngoại lai không hợp lệ (`Greek`, `Cyrillic`, `Arabic`, `Hangul`, `Kana`, ký tự lỗi `\uFFFD`, ký tự rỗng độ rộng); dọn cặp ngoặc `()` / `[]` rỗng còn sót sau khi xóa chữ ngoại lai.
2. **Lớp 3B (`sanitizeAiVietnameseOutput` — `text-sanitizer.ts:65–101`, `QĐ-H6`)**:
   - Chỉ chạy trên văn bản tích lũy đầy đủ hoặc khi đọc cache/kết xuất (tránh cắt nhầm qua biên chunk).
   - Chuẩn hóa Unicode `NFC`; chạy `VIET_SYLLABLE_END_BEFORE_D_RE` tách chữ `'đ'` thường bị dính; bổ sung `VIET_DIACRITIC_LOWER_BEFORE_UPPER_RE` (`text-sanitizer.ts:46–47`) tách nguyên âm có dấu tiếng Việt hoặc `'đ'` đứng liền trước chữ IN HOA (ví dụ *"nhưThiên Cơ"* → *"như Thiên Cơ"*) mà **tuyệt đối không đụng các từ CamelCase ASCII tiếng Anh** (`iPhone`, `iPad`, `JavaScript`, `TypeScript`, `eBay`, `macOS`, `YouTube`, `McDonald`).
   - Sửa tập từ điển siêu hẹp biên chữ Unicode (`kho lứa` → `kho lúa`, `bảo Thủ` → `bảo thủ`), không chạm tới tên Can Chi hay danh từ Tử Vi; thu gọn khoảng trắng ngang đúp mà giữ nguyên thụt đầu dòng và bảng Markdown.
3. **Hậu kiểm đủ 4/4 Tứ Hóa Kỳ Hạn (`verifyAndEnsureCompletePeriodSiHua` — `text-sanitizer.ts:113–217`, `QĐ-H6`)**:
   - Hàm `isPeriodSiHuaMentionedInText` tách theo đề mục Markdown và **giới hạn cửa sổ quét trong ranh giới câu/dòng (`/[.!?\n;|]/`)** (`text-sanitizer.ts:130–150`) — chấm dứt dương tính giả khi câu trước nhắc sao Bản Mệnh và câu sau nhắc từ khóa *"Lưu Niên"*.
   - Nếu văn bản kỳ hạn thiếu bất kỳ hóa nào trong 4 hóa (Lộc, Quyền, Khoa, Kỵ), nối khối tổng hợp đủ `4/4 Tứ Hóa` theo formatter chuẩn ở cuối bài (0 tốn quota).
4. **Chuẩn hóa Tiêu đề Nhóm Cung (`enforceCanonicalPalaceGroupHeadings` — `text-sanitizer.ts:224–289`)**:
   - Áp dụng cho Chương 2, 3, 4; chuẩn hóa tiêu đề `### Cung ...` kèm `[AN MỆNH]`, `[AN THÂN]`, `[Đại hạn X–Y tuổi]`; bỏ qua tiêu đề gộp nhiều cung.
5. **Hợp nhất qua `sanitizeDossierChapterText` (`src/lib/dossier-chat-ui.ts:170–197`, `QĐ-H1`)**:
   - Thực thi thống nhất Lớp 3A + Lớp 3B + kiểm tra 4/4 Tứ Hóa cho `year_2026`/`year_2027` + chuẩn hóa tiêu đề cho `palaces_*`.

---

## 4. Tầng Dữ Kiện Kỳ Hạn (`yunxian-context.ts`) & Tam Phương Tứ Chính (`QĐ-H3`)

- **`sanFangSiZheng` (`src/lib/ziwei/yunxian-context.ts:235–240, 638–652`)**: Bảng dữ kiện `factTableMarkdown` luôn in sẵn chính xác 4 điểm: **Cung Mệnh kỳ hạn** (`benGong`), **Xung chiếu** (`+6`), **Hội chiếu Tam Hợp 1** (`+4`) và **Hội chiếu Tam Hợp 2** (`+8`), kèm vai trò kỳ hạn ↔ cung Bản Mệnh gốc, chính/cát/sát tinh, Tứ Hóa và Tuế/Tướng Tiền, plus bảng ánh xạ đủ 12 cung (`yunxian-context.ts:654–664`), triệt tiêu việc AI tự nhẩm địa chi.
- **Tổng quan Chương 1 (`src/lib/ziwei/dossier-context.ts:271–333`)**: Bổ sung Tam Phương Tứ Chính Bản Mệnh và tối đa 10 Cách cục nhận diện từ `detectPatterns(chart)`.

---

## 5. Hỏi Đáp Ngữ Cảnh (`ContextualChatDrawer.tsx`) & Hợp Bàn SSE (`HemingView.tsx`)

### 5.1. Hỏi Đáp Ngữ Cảnh (`F4`, `F7`, `QĐ-H2`, `QĐ-H5`)
- **3 điểm mở**: Từ `InsightPanel` (Tổng quan / Cung / Vận hạn), `HemingView` (Hợp Bàn 2 lá số), và từng chương trong `DetailedDossierModal`.
- **Hàng rào Quota Client (`src/lib/dossier-chat-ui.ts:429–548`)**:
  - `CHAT_COOLDOWN_SECONDS = 8` (`8 giây` chờ giữa 2 câu hỏi).
  - `CHAT_SOFT_CAP_BASE = 15`, nhắc màu hổ phách từ lượt `CHAT_SOFT_CAP_AMBER_AT = 10`, bấm mở khóa thêm từng nấc `CHAT_SOFT_CAP_UNLOCK_STEP = 5` lượt.
  - Tự động khóa gửi khi Hồ Sơ 8 Chương đang chạy (`isBlockedByDossier`).
- **Giới hạn payload Client ↔ Server (`dossier-chat-ui.ts:433–436` & `server.ts:215–218`)**:
  - `CHAT_MAX_QUESTION_LEN = 400` ký tự; `CHAT_MAX_EXCERPT_LEN = 6_000` ký tự; `CHAT_MAX_HISTORY_MESSAGES = 6` tin nhắn; `CHAT_MAX_HISTORY_MSG_LEN = 1_200` ký tự.
- **Lưu trữ LRU**: Tối đa `MAX_CHAT_THREADS_IN_SESSION = 10` mạch chat trong `sessionStorage` (`ziwei_chat_v1::<chartIdentityKey>::<contextKey>`). Hàm `filterPersistableChatMessages` (`dossier-chat-ui.ts:569–587`) lọc bỏ cặp hỏi-đáp có `error` thuần túy trước khi ghi lưu (`QĐ-H2` / `A-04`).

### 5.2. Luồng Hợp Bàn / Hợp Hôn SSE (`src/components/HemingView.tsx:101–212`, `QĐ-H5`)
- Chuẩn hóa toàn bộ vòng đọc SSE theo đúng mẫu 3 bước chung:
  1. Tích lũy qua `sseBuffer`, tách dòng bằng `\n` và giữ lại phần chưa hoàn chỉnh sang lần `reader.read()` tiếp theo (`HemingView.tsx:164–176`).
  2. Xả nốt `sseBuffer.trim()` nếu stream đóng mà không có dòng mới cuối (`HemingView.tsx:177–179`).
  3. Xử lý `parsed.meta`, `parsed.interrupted`, `parsed.error`, chạy `sanitizeAiVietnameseOutput` trên nội dung tích lũy và fallback về `buildLocalHemingFallback` kèm `streamNotice` nếu kết nối đứt hoàn toàn mà chưa có chữ nào.
