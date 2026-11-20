# PHẢN BIỆN VÒNG 2 CỦA MUSE: NỀN TRI THỨC AI — ĐỢT PILOT 1A (`docs/knowledge-base-claude-review-v2.md`)

- **Loại tài liệu**: `[Biên bản Kiểm chứng Độc lập & Chốt Triển Khai — Phản biện Vòng 2]`
- **Ngày ghi nhận**: `19/11/2026`
- **Tài liệu đối chiếu**: `docs/knowledge-base-design-plan.md` (`POST-PANEL V2`) & `docs/knowledge-base-expert-panel-review.md` (`NK-01..NK-12`, `ĐN-1..ĐN-10`)
- **Phiên bản mục tiêu**: `1.4.0-rc.1` (`package.json`: `"1.4.0"`)

---

Phản biện vòng 2 của Muse (19/11/2026): Bản `POST-PANEL V2` ĐẠT chuẩn thi công Đợt Pilot 1A. Kiểm chứng đối chiếu trực tiếp với mã nguồn hiện hành xác nhận: (1) giữ nguyên `systemInstruction` không chèn tên cung ngoại lai cho `palaces_core` và đặt `[TƯ LIỆU HỌC THUẬT ĐỐI CHIẾU]` trong `prompt` bảo toàn 100% assertion của `scripts/verify-dossier-context.ts`; (2) `verifier.ts` thực thi 3 lớp `V1/V2/V3` trên ngữ cảnh đoạn văn/bullet hoàn chỉnh ở cuối luồng (`!wasInterrupted`, sau `verifyAndEnsureCompletePeriodSiHua` trên `/api/interpret-period`), phát JSON `{ citationAudit }` để client chạy `scrubInvalidCitationTags` (`ĐN-6`) trước khi ghi bền vững mà không dùng regex viết lại câu văn; (3) `checkEffectiveStarInPalace` (`ĐN-8`) xét đủ Bản cung + Sao mượn Vô Chính Diệu + Tam Phương Tứ Chính (`+4/+8/+6`); (4) giữ nguyên `express.json({ limit: '512kb' })` và chưa đụng `/api/interpret` + `/api/heming` (hoãn sang Đợt 1B theo `QĐ-N8`). Chủ dự án đã duyệt cả 8 quyết định `QĐ-N1..QĐ-N8` theo khuyến nghị panel và lệnh triển khai Đợt Pilot 1A ngày `19/11/2026`.
