# TỬ VI THIÊN KỶ — HỆ THỐNG LẬP LÁ SỐ & LUẬN GIẢI TỬ VI ĐẨU SỐ

- **Loại tài liệu**: `[Tài liệu Sống — Cửa ngõ Tổng quan Dự án]`
- **Trạng thái hiệu lực**: `ĐANG HIỆU LỰC (ACTIVE)`
- **Áp dụng cho phiên bản ứng dụng**: `1.1.0-rc.1` *(đồng bộ với `/VERSION` và `/package.json`)*
- **Cập nhật lần cuối**: `17/11/2026` *(sau đợt thi công `QĐ-H1..H7` và chuẩn hóa tài liệu `QĐ-D1..D6`)*
- **Mã nguồn đối chiếu (Code SSOT)**: `metadata.json`, `package.json`, `server.ts`, `src/App.tsx`
- **Quyết định liên quan**: `QĐ-1..QĐ-6`, `F1–F7`, `QĐ-G1..QĐ-G6`, `QĐ-H1..QĐ-H7`, `QĐ-D1..QĐ-D6` *(chi tiết tại `docs/decisions-registry.md`)*

---

## 1. Giới thiệu & Định vị Kỹ thuật

**Tử Vi Thiên Kỷ** (*Tử Vi Đẩu Số — Hệ Thống Thiên Kỷ Nghê Hải Hạ*) là ứng dụng web full-stack (React + Vite + Express + TypeScript) chuyên về an sao lập lá số Tử Vi Đẩu Số theo hệ thống Thiên Kỷ, hiệu chỉnh **Chân Thái Dương Thời** theo kinh độ 63 tỉnh/thành Việt Nam, nhận diện cách cục cổ thư, **Hợp Bàn (Hợp Hôn)** hai lá số, **Hồ Sơ Toàn Diện 8 Chương** chuẩn xuất bản Giấy Cổ (`.html` / `@media print` / `.md` / PlainText) và **Hỏi Đáp Ngữ Cảnh** gắn bảng dữ kiện xác định.

> **Nguyên tắc Một Nguồn Sự Thật (SSOT)**: Tài liệu này đóng vai trò cửa ngõ điều hướng. Các hằng số cấu hình Kho Khóa được định nghĩa duy nhất tại [`docs/key-pool-operations.md`](docs/key-pool-operations.md); đặc tả 8 chương Hồ Sơ, bộ lọc hậu kiểm và Chat tại [`docs/features-dossier-and-chat.md`](docs/features-dossier-and-chat.md); sơ đồ kiến trúc và vùng bất biến tại [`docs/architecture-overview.md`](docs/architecture-overview.md).

---

## 2. Kiến trúc 5 Tầng Tổng Quát

```text
[Tầng 1: Engine Tử Vi Bất Biến]      src/lib/ziwei/algorithm.ts · constants.ts (SI_HUA_TABLE) · true-solar-time.ts · sihua.ts · patterns.ts
          │ (dữ liệu thuần xác định, KHÔNG phụ thuộc AI)
          ▼
[Tầng 2: Dựng Ngữ Cảnh & Dữ Kiện]     src/lib/ziwei/yunxian-context.ts · dossier-context.ts
          │ (bảng dữ kiện kỳ hạn, Tam Phương Tứ Chính +4/+8/+6, 4/4 Tứ Hóa, cách cục, ma trận 5–10 năm)
          ▼
[Tầng 3: Máy Chủ SSE & Kho Khóa]      server.ts · server/key-pool/* (AES-256-GCM, failover theo ngân sách, stream continuation)
          │ (SSE + heartbeat + bảo vệ PIN quản trị trên host chia sẻ)
          ▼
[Tầng 4: Hậu Kiểm Văn Bản 2 Lớp]      src/lib/ziwei/text-sanitizer.ts · src/lib/dossier-chat-ui.ts
          │ (Lớp 3A xóa chữ ngoại lai + Lớp 3B tách từ dính tiếng Việt, hậu kiểm 4/4 Tứ Hóa, chuẩn hóa tiêu đề cung, lọc dòng meta xuất bản)
          ▼
[Tầng 5: Giao Diện & Kết Xuất]       DetailedDossierModal.tsx · InsightPanel.tsx · ContextualChatDrawer.tsx · HemingView.tsx · KeyPoolModal.tsx
```

Chi tiết đầy đủ từng tầng và danh sách endpoint xem tại [`docs/architecture-overview.md`](docs/architecture-overview.md).

---

## 3. Lệnh Chạy, Build & Bộ Kiểm Chứng Tự Động (Offline)

### Khởi chạy & Biên dịch
- **Chạy môi trường phát triển (cổng `3000`)**: `npm run dev` (`tsx server.ts`)
- **Kiểm tra kiểu TypeScript**: `npm run lint` (`tsc --noEmit`)
- **Biên dịch sản phẩm Frontend**: `npm run build` (`vite build`)
- **Chạy bản production**: `npm start` (`node server.ts`)

### Bộ Kiểm Chứng Tự Động (0 tiêu tốn quota Gemini)
- **Kiểm chứng Engine Tử Vi**: `npm run verify:engine` (`tsx scripts/verify-engine.ts`)
- **Kiểm chứng Kho Khóa & Failover**: `npm run verify:key-pool` (`tsx scripts/verify-key-pool.ts`)
- **Kiểm chứng Ngữ cảnh Vận Hạn & Hồ Sơ**: `npm run verify:dossier-context` (`tsx scripts/verify-dossier-context.ts`)
- **Kiểm chứng UI Hồ Sơ, Chat, S5 Header, Hậu kiểm & Kết xuất**: `npm run verify:dossier-ui` (`tsx scripts/verify-dossier-chat-ui.ts`)
- **Kiểm chứng Tầng Dữ Kiện Vận Hạn**: `npm run verify:yunxian` (`tsx scripts/verify-yunxian.ts`)
- **Chạy toàn bộ 4 bộ kiểm chứng cốt lõi**: `npm run verify:all`

> **Lưu ý về trạng thái Kho Khóa runtime**: Không ghi cứng số lượng khóa đang `ready` hay `cooldown` trong tài liệu. Để kiểm tra trạng thái thực tế của Kho Khóa đang chạy, dùng modal **Quản lý Kho Khóa Gemini** trên giao diện hoặc gọi `GET /api/key-pool` / `GET /api/ai-diagnostics`.

---

## 4. Bản Đồ Tài Liệu Hệ Thống (`docs/INDEX.md`)

| Tài liệu | Vai trò | Đường dẫn |
|---|---|---|
| **Mục lục Điều hướng Toàn bộ** | Phân loại Tài liệu Sống, Kiểm toán hiện hành & Lưu trữ | [`docs/INDEX.md`](docs/INDEX.md) |
| **Kiến trúc Tổng thể 5 Tầng** | Luồng dữ liệu, Endpoint Express, Vùng bất biến | [`docs/architecture-overview.md`](docs/architecture-overview.md) |
| **Đặc tả Vận hành Kho Khóa** | SSOT hằng số Kho Khóa, thuật toán chọn khóa, failover, `QĐ-H4` | [`docs/key-pool-operations.md`](docs/key-pool-operations.md) |
| **Đặc tả Hồ Sơ, Chat & Hợp Bàn** | SSOT 8 chương Hồ Sơ, `sessionStorage`, 3A/3B, S5 Header, Chat | [`docs/features-dossier-and-chat.md`](docs/features-dossier-and-chat.md) |
| **Sổ cái Quyết định Kiến trúc** | Tra cứu đầy đủ `QĐ-1..6`, `F1–F7`, `QĐ-G1..G6`, `QĐ-H1..H7`, `QĐ-D1..D6` | [`docs/decisions-registry.md`](docs/decisions-registry.md) |
| **Nhật ký Phiên bản** | Lịch sử thay đổi từ `1.0.0-stable` đến `1.1.0-rc.1` | [`CHANGELOG.md`](CHANGELOG.md) |
| **Số Phiên Bản Hiện Hành** | Nguồn sự thật định danh phiên bản & trạng thái kiểm chứng | [`VERSION`](VERSION) |

---

## 5. Vùng Bất Biến & Quy Định An Toàn

1. **Tuyệt đối không tự ý sửa Engine Tử Vi** (`src/lib/ziwei/algorithm.ts`, `SI_HUA_TABLE` trong `src/lib/ziwei/constants.ts:47`, `src/lib/ziwei/sihua.ts`, `src/lib/ziwei/lunar.ts`, `src/lib/ziwei/true-solar-time.ts`) nếu không có lệnh riêng kiểm chứng lại toàn bộ lá số đối chiếu.
2. **Tuyệt đối không sửa thư mục sao lưu lịch sử** (`backup/v1.0.0-stable/`).
3. **Tuyệt đối không in khóa API nguyên văn** (`AIzaSy...`) vào mã nguồn, nhật ký, hay bất kỳ tài liệu Markdown nào.
4. **Cấu hình model mặc định của ứng dụng**: Model chính và model dự phòng được định nghĩa tại một nơi duy nhất trong `server/key-pool/types.ts` (chi tiết tại [`docs/key-pool-operations.md`](docs/key-pool-operations.md)).
