# KIẾN TRÚC TỔNG THỂ HỆ THỐNG TỬ VI THIÊN KỶ (`docs/architecture-overview.md`)

- **Loại tài liệu**: `[Tài liệu Sống — Kiến trúc Hệ thống 5 Tầng]`
- **Trạng thái hiệu lực**: `ĐANG HIỆU LỰC (ACTIVE)`
- **Áp dụng cho phiên bản ứng dụng**: `1.1.0-rc.1` *(đồng bộ với `/VERSION`)*
- **Cập nhật lần cuối**: `17/11/2026` *(sau đợt thi công `QĐ-H1..H7`)*
- **Mã nguồn đối chiếu (Code SSOT)**: `server.ts`, `src/App.tsx`, `src/lib/ziwei/*`, `server/key-pool/*`, `src/components/*`
- **Quyết định liên quan**: `QĐ-1..6`, `F1–F7`, `QĐ-G1..G6`, `QĐ-H1..H7`, `QĐ-D1..D6` *(xem `docs/decisions-registry.md`)*

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
│ TẦNG 2: XÂY DỰNG BẢNG DỮ KIỆN & NGỮ CẢNH (CONTEXT BUILDERS)               │
│ · yunxian-context.ts: buildChartIdentityKey (QĐ-H2), sanFangSiZheng       │
│   (+4/+8/+6 QĐ-H3), 4/4 Tứ Hóa, 12 cung ánh xạ kỳ hạn                    │
│ · dossier-context.ts: 8 chương & ma trận 5–10 năm, Tam Hợp Mệnh & Cách cục│
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │ Fact Sheets & Prompts
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ TẦNG 3: MÁY CHỦ EXPRESS + LUỒNG SSE + KHO KHÓA GEMINI                    │
│ · server.ts (express.json limit 512kb QĐ-H5, SSE heartbeat 18s,           │
│   PIN guard cho host chia sẻ ais-pre-, validation chat)                  │
│ · server/key-pool/* (AES-256-GCM, allocator, executor failover & nối tiếp)│
│   → Hằng số & cơ chế chi tiết xem SSOT tại docs/key-pool-operations.md    │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │ SSE frames: meta / delta / interrupted / error
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ TẦNG 4: PIPELINE HẬU KIỂM VĂN BẢN 2 LỚP (TEXT SANITIZATION)              │
│ · text-sanitizer.ts: Lớp 3A (trên server per-chunk & client) +            │
│   Lớp 3B (tách từ dính tiếng Việt, giới hạn câu cho 4/4 Tứ Hóa QĐ-H6,     │
│   chuẩn hóa tiêu đề cung)                                                 │
│ · dossier-chat-ui.ts: stripInternalExportMetaLines (QĐ-G6)                │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │ Văn bản sạch lũy đẳng f(f(x)) === f(x)
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ TẦNG 5: GIAO DIỆN REACT, BỘ NHỚ PHIÊN & KẾT XUẤT                          │
│ · DetailedDossierModal.tsx (8 chương, sessionStorage LRU, xuất HTML/MD/In)│
│ · InsightPanel.tsx (Tổng quan, 6 chủ đề, Đại Hạn/Lưu Niên)                │
│ · ContextualChatDrawer.tsx (Hỏi đáp ngữ cảnh với quota bảo vệ key)        │
│ · HemingView.tsx (Hợp Bàn SSE chuẩn hóa sseBuffer QĐ-H5)                  │
│ · KeyPoolModal.tsx (Quản trị Kho Khóa theo sự kiện)                       │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Chi Tiết Các Tầng & Ranh Giới Trách Nhiệm

### 2.1. Tầng 1 — Engine Tử Vi & Đầu Vào (`src/lib/ziwei/`)
- **`src/lib/ziwei/share.ts:43–135`**: `formToBirthInfo` chuyển đổi dữ liệu biểu mẫu thành `BirthInfo`, tính Giờ Mặt Trời Thật (`calculateTrueSolarTime`), xử lý đổi ngày giờ Tý muộn (`resolveZiweiDayOffset`) và **bắt buộc gán `origInput`** (`year`, `month`, `day`, `clockHour`, `clockMinute` tại `share.ts:61–67`, theo `QĐ-G5`) để tầng Header S5 có giờ đồng hồ gốc. Hàm `searchParamsToForm` (`share.ts:103–135`) dùng `safeParseInt` kiểm tra chặt biên trị để chống `NaN` từ URL (`QĐ-H2` / `A-05`).
- **`src/lib/ziwei/cities.ts:1–97`**: Chứa danh sách `PROVINCES` đã tinh gọn còn **63 tỉnh/thành Việt Nam** (`QĐ-H5` / `C-05`), loại bỏ phần dữ liệu nước ngoài không sử dụng khỏi client bundle.
- **`src/lib/ziwei/algorithm.ts`, `constants.ts`, `sihua.ts`, `lunar.ts`, `true-solar-time.ts`, `patterns.ts`**: Thực hiện an 12 cung, an 14 chính tinh và phụ tinh theo Thiên Kỷ, bảng Tứ Hóa `SI_HUA_TABLE` (`src/lib/ziwei/constants.ts:47`), tính Đại Hạn, Tiểu Hạn, Lưu Niên và nhận diện cách cục `detectPatterns`.

### 2.2. Tầng 2 — Dựng Dữ Kiện Xác Định (`yunxian-context.ts`, `dossier-context.ts`)
- **Khóa định danh lá số thống nhất (`buildChartIdentityKey`)**: Định nghĩa tập trung tại `src/lib/ziwei/yunxian-context.ts:292–310` và tái xuất tại `src/lib/dossier-chat-ui.ts:65–67`. Khóa kết hợp năm/tháng/ngày/giờ/giới tính, `nameSlug`, chi cung Mệnh `mingGongBranch`, cờ tháng nhuận `leapFlag`, chữ ký giờ đồng hồ gốc `origSig` và kinh độ `lonSig` (`QĐ-H2`). State `aiPeriodCache` trong `src/App.tsx:66` dùng `periodContext.cacheKey` (`yunxian-context.ts:699`) vốn nhúng trực tiếp `buildChartIdentityKey(chart)`, bảo đảm phân vùng triệt để giữa các lá số khác nhau.
- **Tam Phương Tứ Chính & Cách cục**: `yunxian-context.ts:235–240, 638–665` in sẵn 4 cung Tam Phương Tứ Chính kỳ hạn và bảng ánh xạ 12 cung; `dossier-context.ts:271–333` in sẵn Tam Phương Tứ Chính cung Mệnh và danh sách cách cục từ `detectPatterns(chart)` (`QĐ-H3`).

### 2.3. Tầng 3 — Express Server (`server.ts`) & Kho Khóa (`server/key-pool/`)
- **Cổng & Middleware**: Chạy tại cổng `3000` (gắn `vite.middlewares` trong dev qua `tsx server.ts`). `app.use(express.json({ limit: '512kb' }))` (`server.ts:460`, theo `QĐ-H5` / `E-03`).
- **Bảo mật truy cập quản trị (`server.ts:37–93`)**: Các đường dẫn bắt đầu bằng `/api/key-pool` kiểm tra `isSharedOrigin` (`ais-pre-`): trên host chia sẻ, nếu chưa cấu hình `KEY_POOL_ADMIN_PIN` thì tự động áp dụng chế độ Chỉ Đọc (chặn `POST`/`PUT`/`DELETE`); nếu đã cấu hình PIN, bắt buộc đối chiếu bằng hàm hằng thời gian `timingSafePinMatches` (`crypto.timingSafeEqual`).
- **Tài liệu SSOT của tầng Kho Khóa**: Toàn bộ hằng số, cơ chế chọn khóa, `modelCooldowns`, failover và bản vá `QĐ-H4` xem tại [`docs/key-pool-operations.md`](key-pool-operations.md).

#### Bảng Route API Hiện Hành (`server.ts`)

| Method & Path | Vị trí | Chức năng & Cơ chế phản hồi |
|---|---|---|
| `GET /api/ai-diagnostics` | `server.ts:463` | Chẩn đoán tóm tắt khả năng AI (chỉ số sẵn sàng không lộ khóa) |
| `GET /api/key-pool` | `server.ts:469` | Trả ảnh chụp Kho Khóa (đã che mặt nạ), lịch sử sự kiện và cấu hình model |
| `POST /api/key-pool/preview` | `server.ts:482` | Tạo phiên xem trước khóa nhập vào (`PREVIEW_SESSION_TTL_MS`) |
| `POST /api/key-pool/import` | `server.ts:503` | Xác nhận nhập khóa từ `previewToken` vào kho mã hóa |
| `POST /api/key-pool/sync-env` | `server.ts:530` | Đồng bộ biến môi trường `GEMINI_API_KEY` vào Kho Khóa |
| `DELETE /api/key-pool/:id` | `server.ts:545` | Xóa một khóa theo ID |
| `POST /api/key-pool/:id/reactivate` | `server.ts:564` | Kích hoạt lại khóa đang `disabled` |
| `POST /api/key-pool/:id/test` | `server.ts:583` | Kiểm thử kết nối thủ công 1 khóa (`TEST_KEY_TIMEOUT_MS`) |
| `PUT /api/key-pool/models` | `server.ts:604` | Cập nhật `defaultModel` / `fallbackModel` hợp lệ |
| `POST /api/interpret-period` | `server.ts:638` | SSE luận giải Đại Hạn / Lưu Niên (chạy 3A per-chunk + 3B ở cuối luồng) |
| `POST /api/interpret-dossier-section` | `server.ts:765` | SSE sinh từng chương trong 6 chương non-period của Hồ Sơ |
| `POST /api/interpret-chat` | `server.ts:856` | SSE Hỏi Đáp Ngữ Cảnh (kiểm tra biên câu hỏi/lịch sử, hủy khi `res.on('close')`) |
| `POST /api/interpret` | `server.ts:953` | SSE luận giải cung/chủ đề/câu hỏi nhanh tại `InsightPanel` |
| `POST /api/heming` | `server.ts:1066` | SSE luận giải Hợp Bàn (Hợp Hôn) giữa `chartA` và `chartB` |

### 2.4. Tầng 4 & Tầng 5 — Hậu Kiểm Văn Bản, Giao Diện & Kết Xuất
- Hậu kiểm Lớp 3A trên server chạy qua `sendSseText` (`server.ts:112`); Lớp 3B đầy đủ chạy tại `src/lib/ziwei/text-sanitizer.ts` và thống nhất cho Hồ Sơ qua `sanitizeDossierChapterText` (`src/lib/dossier-chat-ui.ts:170–197`).
- Cả 4 điểm tiêu thụ SSE trên Frontend (`DetailedDossierModal.tsx` sinh chương, `ContextualChatDrawer.tsx` chat, `InsightPanel.tsx` vận hạn, `HemingView.tsx` Hợp Bàn) đều áp dụng chuẩn giải mã dùng `sseBuffer`, xả phần dư khi kết thúc luồng, bắt `interrupted`/`error`/`meta` và kiểm tra điều kiện `errCode === 'AI_NOT_CONFIGURED'` (`QĐ-H5`).
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
