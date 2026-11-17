# HỒ SƠ SAO LƯU MÃ NGUỒN — `v1.0.0-stable` (`BACKUP-MANIFEST.md`)

---

## 1. Thông tin định danh bản sao lưu
- **Phiên bản**: `1.0.0-stable` (`"version": "1.0.0"` trong `package.json`)
- **Ngày giờ sao lưu**: `17/11/2026 12:10:55 +07` (múi giờ `Asia/Saigon`)
- **Đường dẫn thư mục sao lưu**: `backup/v1.0.0-stable/`
- **Trạng thái mốc phát hành**: Bản ổn định đầu tiên sau khi hoàn tất Kho Khóa Gemini (Key Pool AES-256-GCM), 3 tính năng lớn `F1–F7` (Hồ Sơ Mệnh Lý 8 Chương, Hỏi Đáp Chuyên Sâu, Bảng Trạng Thái Kho Khóa), bộ sửa lỗi hồ sơ `QĐ-G1..QĐ-G6` (Hậu kiểm 2 lớp `3A + 3B`, chuẩn hóa tiêu đề cung, nối dây `origInput`, gỡ dòng meta nội bộ khỏi bản kết xuất) và hoàn thành trọn bộ 3 tài liệu rà soát toàn diện logic & code (`docs/logic-code-audit-v1.md`, `docs/logic-code-audit-panel-review.md`, `docs/logic-code-audit-v2.md`).

---

## 2. Phạm vi đã sao lưu & Đối chiếu số lượng file
- **Tổng số file nguồn tại thư mục gốc (sau khi loại trừ các thư mục không thuộc mã nguồn)**: **86 file**.
- **Tổng số file mã nguồn đã sao chép vào `backup/v1.0.0-stable/`**: **86 file** (khớp tuyệt đối **86/86 file**, `diff -s` xác nhận danh sách đường dẫn tương đối giống hệt 100%).
- **Tổng số file trong `backup/v1.0.0-stable/` tính cả file manifest này (`BACKUP-MANIFEST.md`)**: **87 file**.
- **Phân bổ chi tiết 86 file nguồn đã sao lưu**:
  1. **Tập tin cấu hình & định danh ở thư mục gốc (10 file)**:
     - `.env.example`, `.gitignore`, `VERSION`, `bun.lock`, `index.html`, `metadata.json`, `package.json`, `server.ts`, `tsconfig.json`, `vite.config.ts`.
  2. **Mã nguồn Frontend & Thư viện Tử Vi `src/` (47 file)**:
     - `src/App.tsx`, `src/main.tsx`, `src/index.css`
     - `src/components/*` (12 component giao diện)
     - `src/lib/dossier-chat-ui.ts`, `src/lib/key-pool-ui.ts`
     - `src/lib/ziwei/*` (30 module thuật toán lịch pháp, Chân Thái Dương Thời, an sao, Tứ Hóa, bối cảnh vận hạn, bối cảnh hồ sơ, hậu kiểm văn bản `text-sanitizer.ts`...)
  3. **Mã nguồn Backend Kho Khóa `server/` (6 file)**:
     - `server/key-pool/allocator.ts`, `crypto-store.ts`, `executor.ts`, `index.ts`, `parser.ts`, `types.ts`.
  4. **Bộ kịch bản kiểm chứng tự động `scripts/` & `scripts_root/` (9 file)**:
     - `scripts/verify-key-pool.ts`, `scripts/verify-dossier-context.ts`, `scripts/verify-dossier-chat-ui.ts`, `scripts/verify-yunxian.ts`, `scripts/verify-engine.ts`, `scripts/verify-engine-output.json`, `scripts/scan-cjk.ts`, `scripts/scan-cjk-output.json`, `scripts_root/verify-engine.ts`.
  5. **Tài liệu thiết kế, chẩn đoán & rà soát `docs/` (14 file)**:
     - Gồm 11 tài liệu thiết kế/chẩn đoán trước đó và 3 tài liệu rà soát mới nhất (`docs/logic-code-audit-v1.md`, `docs/logic-code-audit-panel-review.md`, `docs/logic-code-audit-v2.md`).

---

## 3. Các mục đã loại trừ khỏi bản sao lưu & Lý do
| Mục loại trừ | Lý do loại trừ |
|---|---|
| `node_modules/` | Thư mục gói phụ thuộc bên thứ ba dung lượng lớn, có thể tái tạo chính xác bất kỳ lúc nào qua `npm install` từ `package.json`. |
| `dist/` | Thư mục chứa sản phẩm biên dịch tạm thời của Vite, được sinh tự động khi chạy `npm run build`. |
| `backup/` | Thư mục chứa chính bản sao lưu này, loại trừ để tránh đệ quy tự sao chép chính nó. |
| `.data/` | Thư mục dữ liệu vận hành runtime chứa file kho khóa đã mã hóa (`key-pool.enc.json`) — đây là dữ liệu bí mật của môi trường chạy, **không thuộc mã nguồn** và tuyệt đối không đưa vào bản sao lưu. |
| `.git/` | Siêu dữ liệu quản lý phiên bản nội bộ của container. |

---

## 4. Trạng thái kiểm chứng tại thời điểm chốt (`17/11/2026 12:10 +07`)
- **Kiểm tra kiểu tĩnh TypeScript (`npx tsc --noEmit`)**: **ĐẠT (0 lỗi)**.
- **Bộ kiểm thử Kho Khóa (`npx tsx scripts/verify-key-pool.ts`)**: **ĐẠT 17/17 bài**.
- **Bộ kiểm thử Bối cảnh Hồ Sơ & Vận Hạn (`npx tsx scripts/verify-dossier-context.ts`)**: **ĐẠT 6/6 bài** (bao gồm `TEST-3`).
- **Bộ kiểm thử Giao diện, Hậu kiểm 3A/3B & Kết xuất Hồ Sơ (`npx tsx scripts/verify-dossier-chat-ui.ts`)**: **ĐẠT 14/14 bài** (bao gồm `TEST-1..TEST-10`).
- **Kiểm tra an toàn khóa (`grep -rn "AIzaSy" backup/v1.0.0-stable/`)**:
  - Quét toàn bộ thư mục backup ghi nhận **54 dòng khớp** trên **10 file** (1 file test `scripts/verify-dossier-chat-ui.ts` và 9 file tài liệu trong `docs/`).
  - **100% các chuỗi khớp đều là chuỗi đã che mặt nạ (`AIzaSy••••••xxxx`), chuỗi viết tắt minh họa (`AIzaSyA111...`) hoặc khóa giả lập phục vụ unit test (`AIzaSyFakeLegacyTestKeyValue1234567890`)**.
  - **Xác nhận: 0 có bất kỳ Gemini API key thật nguyên văn nào trong bản sao lưu.**

---

## 5. Hướng dẫn khôi phục (Restore) về phiên bản `1.0.0-stable`
Khi cần khôi phục toàn bộ mã nguồn ở thư mục gốc của dự án về đúng trạng thái `1.0.0-stable` từ bản sao lưu này:

```bash
# Chạy tại thư mục gốc của dự án (/app/applet):
find backup/v1.0.0-stable -mindepth 1 -maxdepth 1 ! -name 'BACKUP-MANIFEST.md' -exec cp -r {} ./ \;

# Kiểm tra lại kiểu tĩnh và bộ test sau khi khôi phục:
npx tsc --noEmit
npx tsx scripts/verify-key-pool.ts
npx tsx scripts/verify-dossier-context.ts
npx tsx scripts/verify-dossier-chat-ui.ts
```
*(Lưu ý: Lệnh khôi phục trên chỉ ghi đè các file mã nguồn và cấu hình từ `backup/v1.0.0-stable/`, giữ nguyên không đụng tới `node_modules/` hay thư mục dữ liệu kho khóa `.data/` đang chạy).*
