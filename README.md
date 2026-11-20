# TỬ VI THIÊN KỶ — HỆ THỐNG LẬP LÁ SỐ & LUẬN GIẢI TỬ VI ĐẨU SỐ

- **Loại tài liệu**: `[Tài liệu Sống — Cửa ngõ Tổng quan Dự án]`
- **Trạng thái hiệu lực**: `ĐANG HIỆU LỰC (ACTIVE)`
- **Áp dụng cho phiên bản ứng dụng**: `1.4.0-rc.1` *(đồng bộ với `/VERSION` và `/package.json`)*
- **Cập nhật lần cuối**: `19/11/2026` *(sau đợt thi công Đợt Pilot 1A `QĐ-N1..QĐ-N8` — Nền tri thức AI)*
- **Mã nguồn đối chiếu (Code SSOT)**: `metadata.json`, `package.json`, `server.ts`, `server/knowledge-base/*`, `src/App.tsx`
- **Quyết định liên quan**: `QĐ-1..QĐ-6`, `F1–F7`, `QĐ-G1..QĐ-G6`, `QĐ-H1..H7`, `QĐ-D1..QĐ-D6`, `QĐ-L1..QĐ-L9`, `ĐC-1..ĐC-6`, `QĐ-M1..QĐ-M6`, `QĐ-N1..QĐ-N8` *(chi tiết tại `docs/decisions-registry.md`)*

---

## Nguồn gốc & ghi nhận tác giả gốc

- **Repo gốc**: [`Renhuai123/ziwei-doushu`](https://github.com/Renhuai123/ziwei-doushu) *(GitHub Public)*.
- **Tác giả / chủ sở hữu gốc**: Chủ sở hữu repo trên GitHub là `Renhuai123`; README của repo gốc ghi nhận tác giả là `王多鱼AI` (`Wang Duoyu AI`, mục `"数据集归属"`), nền tảng trực tuyến `OURANIC` ([`https://www.ouranic.cn/`](https://www.ouranic.cn/)), đơn vị vận hành `北京王多鱼科技有限责任公司`.
- **Tên hệ thống gốc**: `"紫微斗数 · 开源排盘引擎"` — engine lập lá số Tử Vi Đẩu Số mã nguồn mở dựa trên hệ thống `《天纪》` của `倪海厦` (Nghê Hải Hạ); engine nằm ở `lib/ziwei/` trong repo gốc (tương ứng `src/lib/ziwei/` trong ứng dụng này).
- **Giấy phép** *(theo mục `"协议"` — Chương 9 trong README của repo gốc)*:
  - Mã nguồn: giấy phép `MIT` *(xem file `LICENSE` tại repo gốc)*.
  - Dữ liệu (`datasets`): `CC BY 4.0`.
  - Cổ thư (`古籍原文`): phạm vi công cộng (`Public Domain`).
  - Phần nguyên văn lời `倪师` (`docs/tianji-ziwei/` & tri thức `nihai_entry` / `nihai_lecture` trong `server/knowledge-base/data/`): `CC BY-NC-SA 4.0` *(chỉ dùng phi thương mại cho học tập/nghiên cứu — xem chi tiết tại [`server/knowledge-base/data/LICENSE-CC-BY-NC-SA-4.0.md`](server/knowledge-base/data/LICENSE-CC-BY-NC-SA-4.0.md))*.
- **Thư viện nền**: Thuật toán lập lá số dựa trên thư viện mã nguồn mở [`iztro`](https://github.com/SylarLong/iztro) (`https://github.com/SylarLong/iztro`) — được ghi nhận ở đầu file `src/lib/ziwei/algorithm.ts` (*`"紫微斗数排盘算法 — 基于 iztro 开源库"`*).
- **Phân biệt kế thừa & phần phát triển tiếp nối**: Ứng dụng này (*`"Tử Vi Đẩu Số — Hệ Thống Thiên Kỷ Nghê Hải Hạ"`* theo `metadata.json`) là bản phát triển tiếp nối từ mã nguồn của tác giả gốc; dự án trân trọng ghi nhận công lao và nền tảng thuật toán của tác giả gốc. Phần đóng góp của bản hiện tại tập trung vào: Việt hoá giao diện và nội dung, module kho key Gemini (quản lý nhiều API key, failover), tính năng hồ sơ luận giải & chat (`dossier & chat`), Thư Viện Lá Số & phát hiện lá số trùng, Nền Tri Thức AI tất định + hậu kiểm trích dẫn (`server/knowledge-base/`), và bộ hậu kiểm (`verify suite`) — chi tiết xem tại [`CHANGELOG.md`](CHANGELOG.md).

---

## 1. Giới thiệu & Định vị Kỹ thuật

**Tử Vi Thiên Kỷ** (*Tử Vi Đẩu Số — Hệ Thống Thiên Kỷ Nghê Hải Hạ*) là ứng dụng web full-stack (React + Vite + Express + TypeScript) chuyên về an sao lập lá số Tử Vi Đẩu Số theo hệ thống Thiên Kỷ, hiệu chỉnh **Chân Thái Dương Thời** theo kinh độ 63 tỉnh/thành Việt Nam, nhận diện cách cục cổ thư, **Hợp Bàn (Hợp Hôn)** hai lá số, **Hồ Sơ Toàn Diện 8 Chương** chuẩn xuất bản Giấy Cổ (`.html` / `@media print` / `.md` / PlainText), **Thư Viện Lá Số** (`IndexedDB` + Phát hiện lá số trùng), **Nền Tri Thức AI** có đối chiếu `[Nguồn: ...]` chống bịa khẩu quyết và **Hỏi Đáp Ngữ Cảnh** gắn bảng dữ kiện xác định.

> **Nguyên tắc Một Nguồn Sự Thật (SSOT)**: Tài liệu này đóng vai trò cửa ngõ điều hướng. Các hằng số cấu hình Kho Khóa được định nghĩa duy nhất tại [`docs/key-pool-operations.md`](docs/key-pool-operations.md); đặc tả 8 chương Hồ Sơ, Thư Viện, Nền Tri Thức AI, bộ lọc hậu kiểm và Chat tại [`docs/features-dossier-and-chat.md`](docs/features-dossier-and-chat.md); sơ đồ kiến trúc và vùng bất biến tại [`docs/architecture-overview.md`](docs/architecture-overview.md).

---

## 2. Kiến trúc 5 Tầng Tổng Quát

```text
[Tầng 1: Engine Tử Vi Bất Biến]      src/lib/ziwei/algorithm.ts · constants.ts (SI_HUA_TABLE) · true-solar-time.ts · sihua.ts · patterns.ts
          │ (dữ liệu thuần xác định, KHÔNG phụ thuộc AI)
          ▼
[Tầng 2: Dựng Ngữ Cảnh & Truy Hồi KB] src/lib/ziwei/yunxian-context.ts · dossier-context.ts · server/knowledge-base/{loader,retriever}.ts
          │ (bảng dữ kiện kỳ hạn, Tam Phương Tứ Chính +4/+8/+6, 4/4 Tứ Hóa, trích đoạn tri thức tất định cấp nhóm)
          ▼
[Tầng 3: Máy Chủ SSE & Kho Khóa]      server.ts · server/key-pool/* (AES-256-GCM, failover theo ngân sách, stream continuation)
          │ (SSE + heartbeat + citationAudit + bảo vệ PIN quản trị trên host chia sẻ)
          ▼
[Tầng 4: Hậu Kiểm Văn Bản & Trích Dẫn] src/lib/ziwei/text-sanitizer.ts · src/lib/dossier-chat-ui.ts · server/knowledge-base/verifier.ts
          │ (Lớp 3A xóa chữ ngoại lai, Lớp 3B tách từ dính tiếng Việt, 4/4 Tứ Hóa, hậu kiểm chống bịa V1/V2/V3 & scrubInvalidCitationTags)
          ▼
[Tầng 5: Giao Diện & Thư Viện]       DetailedDossierModal.tsx · InsightPanel.tsx · ContextualChatDrawer.tsx · ChartLibraryModal.tsx · HemingView.tsx · KeyPoolModal.tsx
```

Chi tiết đầy đủ từng tầng và danh sách endpoint xem tại [`docs/architecture-overview.md`](docs/architecture-overview.md).

---

## 3. Lệnh Chạy, Build & Bộ Kiểm Chứng Tự Động (Offline)

### Khởi chạy & Biên dịch
- **Chạy môi trường phát triển (cổng `3000`)**: `npm run dev` (`tsx server.ts`)
- **Kiểm tra kiểu TypeScript**: `npm run lint` (`tsc --noEmit`)
- **Biên dịch sản phẩm Frontend**: `npm run build` (`vite build`)
- **Chạy bản production**: `npm start` (`node server.ts`)

### Pipeline Nền Tri Thức AI (Chạy ngoại tuyến)
- **Kiểm tra toàn vẹn kho nguồn (`/knowledge-source/`)**: `npm run kb:verify-source` (`tsx scripts/kb-verify-source.ts`)
- **Gom nhóm tất định `(book, h2, h3)` & xem thử**: `npm run kb:group` (`tsx scripts/kb-group-entries.ts`)
- **Chưng cất tri thức ngoại tuyến (yêu cầu `KB_DISTILL_GEMINI_KEY` hoặc `--dry-run`)**: `npm run kb:distill` (`tsx scripts/kb-distill.ts`)
- **Kiểm toán 100% chất lượng `.kb.json`**: `npm run kb:audit` (`tsx scripts/kb-audit-quality.ts`)
- **Xuất phiếu kiểm định 25 mục cho NotebookLM**: `npm run kb:export-audit-sheet` (`tsx scripts/kb-export-audit-sheet.ts`)

### Bộ Kiểm Chứng Tự Động (0 tiêu tốn quota Gemini)
- **Kiểm chứng Engine Tử Vi**: `npm run verify:engine` (`tsx scripts/verify-engine.ts`)
- **Kiểm chứng Kho Khóa & Failover**: `npm run verify:key-pool` (`tsx scripts/verify-key-pool.ts`)
- **Kiểm chứng Ngữ cảnh Vận Hạn & Hồ Sơ**: `npm run verify:dossier-context` (`tsx scripts/verify-dossier-context.ts`)
- **Kiểm chứng UI Hồ Sơ, Chat, S5 Header, Hậu kiểm & Kết xuất**: `npm run verify:dossier-ui` (`tsx scripts/verify-dossier-chat-ui.ts`)
- **Kiểm chứng Tầng Dữ Kiện Vận Hạn**: `npm run verify:yunxian` (`tsx scripts/verify-yunxian.ts`)
- **Kiểm chứng Thư Viện Lá Số & Phát Hiện Trùng**: `npm run verify:library` (`tsx scripts/verify-chart-library.ts`)
- **Kiểm chứng Nền Tri Thức AI (`K1/K2/K3`)**: `npm run verify:kb` (`tsx scripts/verify-knowledge-base.ts`)
- **Chạy toàn bộ 6 bộ kiểm chứng cốt lõi**: `npm run verify:all`

> **Lưu ý về trạng thái Kho Khóa runtime**: Không ghi cứng số lượng khóa đang `ready` hay `cooldown` trong tài liệu. Để kiểm tra trạng thái thực tế của Kho Khóa đang chạy, dùng modal **Quản lý Kho Khóa Gemini** trên giao diện hoặc gọi `GET /api/key-pool` / `GET /api/ai-diagnostics`.

---

## 4. Bản Đồ Tài Liệu Hệ Thống (`docs/INDEX.md`)

| Tài liệu | Vai trò | Đường dẫn |
|---|---|---|
| **Mục lục Điều hướng Toàn bộ** | Phân loại Tài liệu Sống, Kiểm toán hiện hành & Lưu trữ | [`docs/INDEX.md`](docs/INDEX.md) |
| **Kiến trúc Tổng thể 5 Tầng** | Luồng dữ liệu, Endpoint Express, Vùng bất biến | [`docs/architecture-overview.md`](docs/architecture-overview.md) |
| **Đặc tả Vận hành Kho Khóa** | SSOT hằng số Kho Khóa, thuật toán chọn khóa, failover, `QĐ-H4` | [`docs/key-pool-operations.md`](docs/key-pool-operations.md) |
| **Đặc tả Hồ Sơ, Chat, Thư Viện & KB** | SSOT 8 chương Hồ Sơ, Thư Viện, Nền Tri Thức AI, `3A/3B` & `V1/V2/V3` | [`docs/features-dossier-and-chat.md`](docs/features-dossier-and-chat.md) |
| **Sổ cái Quyết định Kiến trúc** | Tra cứu đầy đủ `QĐ-1..6`, `F1–F7`, `QĐ-G1..G6`, `QĐ-H1..H7`, `QĐ-D1..D6`, `QĐ-L1..L9`, `QĐ-M1..M6`, `QĐ-N1..N8` | [`docs/decisions-registry.md`](docs/decisions-registry.md) |
| **Nhật ký Phiên bản** | Lịch sử thay đổi từ `1.0.0-stable` đến `1.4.0-rc.1` | [`CHANGELOG.md`](CHANGELOG.md) |
| **Số Phiên Bản Hiện Hành** | Nguồn sự thật định danh phiên bản & trạng thái kiểm chứng | [`VERSION`](VERSION) |

---

## 5. Vùng Bất Biến & Quy Định An Toàn

1. **Tuyệt đối không tự ý sửa Engine Tử Vi** (`src/lib/ziwei/algorithm.ts`, `SI_HUA_TABLE` trong `src/lib/ziwei/constants.ts:47`, `src/lib/ziwei/sihua.ts`, `src/lib/ziwei/lunar.ts`, `src/lib/ziwei/true-solar-time.ts`) nếu không có lệnh riêng kiểm chứng lại toàn bộ lá số đối chiếu.
2. **Tuyệt đối không sửa thư mục sao lưu lịch sử** (`backup/v1.0.0-stable/`).
3. **Tuyệt đối không in khóa API nguyên văn** (`AIzaSy...`) vào mã nguồn, nhật ký, hay bất kỳ tài liệu Markdown nào.
4. **Cấu hình model mặc định của ứng dụng**: Model chính và model dự phòng được định nghĩa tại một nơi duy nhất trong `server/key-pool/types.ts` (chi tiết tại [`docs/key-pool-operations.md`](docs/key-pool-operations.md)).
