# KIẾN TRÚC TỔNG THỂ HỆ THỐNG TỬ VI THIÊN KỶ (`docs/architecture-overview.md`)

- **Loại tài liệu**: `[Tài liệu Sống — Kiến trúc Hệ thống 5 Tầng]`
- **Trạng thái hiệu lực**: `ĐANG HIỆU LỰC (ACTIVE)`
- **Áp dụng cho phiên bản ứng dụng**: `1.4.0-rc.1` *(đồng bộ với `/VERSION`)*
- **Cập nhật lần cuối**: `19/11/2026` *(sau đợt thi công Đợt Pilot 1A `QĐ-N1..QĐ-N8` — Nền tri thức AI)*
- **Mã nguồn đối chiếu (Code SSOT)**: `server.ts`, `server/knowledge-base/*`, `server/key-pool/*`, `src/App.tsx`, `src/lib/ziwei/*`, `src/components/*`
- **Quyết định liên quan**: `QĐ-1..6`, `F1–F7`, `QĐ-G1..G6`, `QĐ-H1..H7`, `QĐ-D1..D6`, `QĐ-L1..L9`, `ĐC-1..ĐC-6`, `QĐ-M1..QĐ-M6`, `QĐ-N1..QĐ-N8` *(xem `docs/decisions-registry.md`)*

---

## 1. Sơ Đồ Luồng Dữ Liệu 5 Tầng (Từ Nhập Sinh Thần → Kết Xuất Hồ Sơ)

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ TẦNG 1: ENGINE TỬ VI ĐẨU SỐ XÁC ĐỊNH (DETERMINISTIC ENGINE — BẤT BIẾN)   │
│ · share.ts (formToBirthInfo + origInput + safeParseInt)                   │
│ · true-solar-time.ts (hiệu chỉnh Chân Thái Dương Thời theo kinh độ VN)    │
│ · cities.ts (63 tỉnh/thành Việt Nam — QĐ-H5 tinh gọn bundle)              │
│ · algorithm.ts + lunar.ts + sihua.ts (SI_HUA_TABLE) + patterns.ts        │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │ ZiweiChart (12 cung, Đại Hạn, Lưu Niên)
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ TẦNG 2: BẢNG DỮ KIỆN & TRUY HỒI NỀN TRI THỨC TẤT ĐỊNH                    │
│ · yunxian-context.ts: buildChartIdentityKey (QĐ-H2), sanFangSiZheng       │
│   (+4/+8/+6 QĐ-H3), 4/4 Tứ Hóa, 12 cung ánh xạ kỳ hạn                    │
│ · dossier-context.ts: 8 chương & ma trận 5–10 năm, Tam Hợp Mệnh & Cách cục│
│ · server/knowledge-base/loader.ts & retriever.ts (Đợt 1A — QĐ-N1..N8):    │
│   nạp *.kb.json, chỉ mục đảo theo sao/Tứ Hóa/cung/cách cục, lọc Tam Phương │
│   Tứ Chính (ĐN-8), cấp phát ngân sách Bảng 4.2 & nhãn [Nguồn: <ID>]       │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │ Fact Sheets + [TƯ LIỆU HỌC THUẬT ĐỐI CHIẾU]
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ TẦNG 3: MÁY CHỦ EXPRESS + LUỒNG SSE + KHO KHÓA GEMINI                    │
│ · server.ts (express.json limit 512kb QĐ-H5 giữ nguyên, SSE heartbeat 18s,│
│   PIN guard cho host chia sẻ ais-pre-, validation chat)                  │
│ · server/key-pool/* (AES-256-GCM, allocator, executor failover & nối tiếp)│
│   → Hằng số & cơ chế chi tiết xem SSOT tại docs/key-pool-operations.md    │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │ SSE frames: meta / delta / citationAudit / interrupted / error
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ TẦNG 4: PIPELINE HẬU KIỂM VĂN BẢN, 4/4 TỨ HÓA & TRÍCH DẪN CHỐNG BỊA     │
│ · text-sanitizer.ts: Lớp 3A (server per-chunk & client) + Lớp 3B (tách từ │
│   dính TV, 4/4 Tứ Hóa QĐ-H6, tiêu đề cung) + scrubInvalidCitationTags     │
│ · server/knowledge-base/verifier.ts (ĐN-4/ĐN-5/ĐN-6): hậu kiểm 3 lớp      │
│   V1 (thẻ ngoài whitelist) · V2 (mạo danh không nguồn) · V3 (khẩu quyết)  │
│   trên luồng không bị ngắt, gửi frame { citationAudit } & nối khối 📚/⚠️   │
│ · dossier-chat-ui.ts: sanitizeDossierChapterText & stripInternalExportMeta│
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │ Văn bản sạch lũy đẳng f(f(x)) === f(x)
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ TẦNG 5: GIAO DIỆN REACT, THƯ VIỆN LÁ SỐ, BỘ NHỚ BỀN VỮNG & KẾT XUẤT      │
│ · DetailedDossierModal.tsx (8 chương, IndexedDB SSOT, Xóa chương lẻ QĐ-L8)│
│ · ChartLibraryModal.tsx + DuplicateChartPromptModal.tsx (Phát hiện trùng) │
│ · InsightPanel.tsx (Tổng quan, 6 chủ đề, Đại Hạn/Lưu Niên + citationAudit)│
│ · ContextualChatDrawer.tsx (Hỏi đáp ngữ cảnh + quota + citationAudit)     │
│ · HemingView.tsx (Hợp Bàn SSE chuẩn hóa sseBuffer QĐ-H5)                  │
│ · KeyPoolModal.tsx (Quản trị Kho Khóa theo sự kiện)                       │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Chi Tiết Các Tầng & Ranh Giới Trách Nhiệm

### 2.1. Tầng 1 — Engine Tử Vi & Đầu Vào (`src/lib/ziwei/`)
- **`src/lib/ziwei/share.ts`**: `formToBirthInfo` chuyển đổi dữ liệu biểu mẫu thành `BirthInfo`, tính Giờ Mặt Trời Thật (`calculateTrueSolarTime`), xử lý đổi ngày giờ Tý muộn (`resolveZiweiDayOffset`) và **bắt buộc gán `origInput`** (`year`, `month`, `day`, `clockHour`, `clockMinute` theo `QĐ-G5`) để tầng Header S5 có giờ đồng hồ gốc. Hàm `searchParamsToForm` dùng `safeParseInt` kiểm tra chặt biên trị để chống `NaN` từ URL (`QĐ-H2` / `A-05`).
- **`src/lib/ziwei/cities.ts`**: Chứa danh sách `PROVINCES` đã tinh gọn còn **63 tỉnh/thành Việt Nam** (`QĐ-H5` / `C-05`), loại bỏ phần dữ liệu nước ngoài không sử dụng khỏi client bundle.
- **`src/lib/ziwei/algorithm.ts`, `constants.ts`, `sihua.ts`, `lunar.ts`, `true-solar-time.ts`, `patterns.ts`**: Thực hiện an 12 cung, an 14 chính tinh và phụ tinh theo Thiên Kỷ, bảng Tứ Hóa `SI_HUA_TABLE` (`src/lib/ziwei/constants.ts:47`), tính Đại Hạn, Tiểu Hạn, Lưu Niên và nhận diện cách cục `detectPatterns`.

### 2.2. Tầng 2 — Dựng Dữ Kiện Xác Định & Truy Hồi Tri Thức (`yunxian-context.ts`, `dossier-context.ts`, `server/knowledge-base/`)
- **Khóa định danh lá số thống nhất (`buildChartIdentityKey`)**: Định nghĩa tập trung tại `src/lib/ziwei/yunxian-context.ts` và tái xuất tại `src/lib/dossier-chat-ui.ts`. Khóa kết hợp 9 thành phần để phân vùng triệt để giữa các lá số khác nhau (`QĐ-H2`, `QĐ-L2`, `QĐ-L9`).
- **Tam Phương Tứ Chính & Cách cục**: `yunxian-context.ts` in sẵn 4 cung Tam Phương Tứ Chính kỳ hạn và bảng ánh xạ 12 cung; `dossier-context.ts` in sẵn Tam Phương Tứ Chính cung Mệnh và danh sách cách cục từ `detectPatterns(chart)` (`QĐ-H3`).
- **Nền Tri Thức AI (`server/knowledge-base/` — Đợt Pilot 1A, `QĐ-N1..QĐ-N8`)**:
  - `loader.ts`: `initKnowledgeBase()` nạp các tệp `data/*.kb.json` một lần lúc `startServer()` khởi động (`server.ts:1316`) và dựng chỉ mục đảo theo sao, Tứ Hóa, cung, cách cục, nguồn & chế độ.
  - `retriever.ts`: Truy hồi **100% tất định (0 gọi embedding API)** theo 3 luồng (`retrieveKnowledgeForDossierSection`, `retrieveKnowledgeForPeriod`, `retrieveKnowledgeForChat`), áp dụng quota phân bổ vòng 4 cung (`palaces_*`), loại trừ Tầng 3 (`QĐ-N7`), kiểm tra vắng mặt sao trên đủ Bản cung + Sao mượn Vô Chính Diệu + Tam Phương Tứ Chính (`ĐN-8`), và tôn trọng ngân sách Bảng 4.2 (`1.500–3.200` ký tự/lượt).
  - Trong Đợt Pilot 1A (`1.4.0-rc.1`), chỉ dẫn `[TƯ LIỆU HỌC THUẬT ĐỐI CHIẾU]` được đưa vào `prompt` (kèm quy tắc trích dẫn chung trong `systemInstruction`), bảo toàn cấu trúc bất biến của `systemInstruction` đối với các bài kiểm chứng ngữ cảnh sẵn có.

### 2.3. Tầng 3 — Express Server (`server.ts`) & Kho Khóa (`server/key-pool/`)
- **Cổng & Middleware**: Chạy tại cổng `3000` (gắn `vite.middlewares` trong dev qua `tsx server.ts`). `app.use(express.json({ limit: '512kb' }))` (`server.ts:526`, giữ nguyên theo `QĐ-H5` / `E-03`).
- **Bảo mật truy cập quản trị (`server.ts:45–101`)**: Các đường dẫn bắt đầu bằng `/api/key-pool` kiểm tra `isSharedOrigin` (`ais-pre-`): trên host chia sẻ, nếu chưa cấu hình `KEY_POOL_ADMIN_PIN` thì tự động áp dụng chế độ Chỉ Đọc (chặn `POST`/`PUT`/`DELETE`); nếu đã cấu hình PIN, bắt buộc đối chiếu bằng hàm hằng thời gian `timingSafePinMatches` (`crypto.timingSafeEqual`).
- **Tài liệu SSOT của tầng Kho Khóa**: Toàn bộ hằng số, cơ chế chọn khóa, `modelCooldowns`, failover và bản vá `QĐ-H4` xem tại [`docs/key-pool-operations.md`](key-pool-operations.md).

#### Bảng Route API Hiện Hành (`server.ts`)

| Method & Path | Vị trí | Chức năng & Cơ chế phản hồi |
|---|---|---|
| `GET /api/ai-diagnostics` | `server.ts:529` | Chẩn đoán tóm tắt khả năng AI (chỉ số sẵn sàng không lộ khóa) |
| `GET /api/key-pool` | `server.ts:535` | Trả ảnh chụp Kho Khóa (đã che mặt nạ), lịch sử sự kiện và cấu hình model |
| `POST /api/key-pool/preview` | `server.ts:548` | Tạo phiên xem trước khóa nhập vào (`PREVIEW_SESSION_TTL_MS`) |
| `POST /api/key-pool/import` | `server.ts:569` | Xác nhận nhập khóa từ `previewToken` vào kho mã hóa |
| `POST /api/key-pool/sync-env` | `server.ts:596` | Đồng bộ biến môi trường `GEMINI_API_KEY` vào Kho Khóa |
| `DELETE /api/key-pool/:id` | `server.ts:611` | Xóa một khóa theo ID |
| `POST /api/key-pool/:id/reactivate` | `server.ts:630` | Kích hoạt lại khóa đang `disabled` |
| `POST /api/key-pool/:id/test` | `server.ts:649` | Kiểm thử kết nối thủ công 1 khóa (`TEST_KEY_TIMEOUT_MS`) |
| `PUT /api/key-pool/models` | `server.ts:670` | Cập nhật `defaultModel` / `fallbackModel` hợp lệ |
| `POST /api/interpret-period` | `server.ts:704` | **Đã tích hợp KB (Đợt 1A)**: SSE luận giải Đại Hạn / Lưu Niên (chạy 3A per-chunk + 4/4 Tứ Hóa + `verifyAcademicCitationsAndClaims` + `{ citationAudit }` + khối `📚`/`⚠️`) |
| `POST /api/interpret-dossier-section` | `server.ts:863` | **Đã tích hợp KB (Đợt 1A)**: SSE sinh từng chương Hồ Sơ + `verifyAcademicCitationsAndClaims` + `{ citationAudit }` + khối `📚`/`⚠️` |
| `POST /api/interpret-chat` | `server.ts:989` | **Đã tích hợp KB (Đợt 1A)**: SSE Hỏi Đáp Ngữ Cảnh + `verifyAcademicCitationsAndClaims` + `{ citationAudit }` + chân trang nguồn gọn |
| `POST /api/interpret` | `server.ts:1115` | SSE luận giải cung/chủ đề/câu hỏi nhanh tại `InsightPanel` *(hoãn tích hợp KB sang Đợt 1B theo `QĐ-N8`)* |
| `POST /api/heming` | `server.ts:1228` | SSE luận giải Hợp Bàn giữa `chartA` và `chartB` *(hoãn tích hợp KB sang Đợt 1B theo `QĐ-N8`)* |

### 2.4. Tầng 4 & Tầng 5 — Hậu Kiểm Văn Bản, Trích Dẫn, Giao Diện & Kết Xuất
- Hậu kiểm Lớp 3A trên server chạy qua `sendSseText` (`server.ts:119`); Lớp 3B đầy đủ + `scrubInvalidCitationTags` (`ĐN-6`) chạy tại `src/lib/ziwei/text-sanitizer.ts` và thống nhất cho Hồ Sơ qua `sanitizeDossierChapterText` (`src/lib/dossier-chat-ui.ts`).
- Khi luồng SSE ở 3 route đã tích hợp KB kết thúc hoàn chỉnh (`!wasInterrupted`), server chạy `verifyAcademicCitationsAndClaims` (`server/knowledge-base/verifier.ts`) để kiểm tra `V1`/`V2`/`V3`, phát frame JSON `{ citationAudit: { validIds, scrubbedInvalidIds, hasUncitedClaims } }`, rồi stream khối `📚 [Tư Liệu Học Thuật Tham Chiếu]` / hộp `⚠️` trước `data: [DONE]`.
- Frontend (`DetailedDossierModal.tsx`, `InsightPanel.tsx`, `ContextualChatDrawer.tsx`) đọc frame `citationAudit` để gọi `scrubInvalidCitationTags` dọn sạch mọi thẻ `[Nguồn: ID_SAI]` khỏi văn bản trước khi lưu vào `IndexedDB` / `aiPeriodCache` / `sessionStorage` (`ĐN-6`).
- Chi tiết xem SSOT tại [`docs/features-dossier-and-chat.md`](features-dossier-and-chat.md).

---

## 3. Danh Sách Vùng Bất Biến (Bảo Vệ Nghiêm Ngặt)

| Vùng / File | Trạng thái bảo vệ | Lý do kỹ thuật |
|---|---|---|
| `src/lib/ziwei/algorithm.ts` | **Cấm đụng nếu không có lệnh riêng** | Engine an sao cốt lõi Thiên Kỷ; mọi thay đổi sai lệch sẽ phá toàn bộ 12 cung. |
| `SI_HUA_TABLE` (`src/lib/ziwei/constants.ts:47`) & `src/lib/ziwei/sihua.ts` | **Bất biến** | Bảng Tứ Hóa theo 10 Thiên Can chuẩn phái Nghê Hải Hạ. |
| `src/lib/ziwei/lunar.ts`, `true-solar-time.ts` | **Bất biến** | Chuẩn quy đổi Âm Dương lịch, Giờ Tý muộn và Chân Thái Dương Thời. |
| `backup/v1.0.0-stable/` (`87` file) | **Đóng băng tuyệt đối** | Bản sao lưu chuẩn `1.0.0-stable` dùng để đối chiếu hoặc khôi phục. |
| Cấu hình model mặc định (`server/key-pool/types.ts:179–180`) | **Không tự ý đổi** | Chủ dự án khóa cặp model chính/dự phòng cho toàn app. |
