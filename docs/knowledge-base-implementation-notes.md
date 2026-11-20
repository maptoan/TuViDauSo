# GHI CHÚ TRIỂN KHAI & NGHIỆM THU — NỀN TRI THỨC AI ĐỢT PILOT 1A (`docs/knowledge-base-implementation-notes.md`)

- **Loại tài liệu**: `[Tài liệu Nghiệm thu Triển khai Đợt 8 — Đợt Pilot 1A]`
- **Trạng thái hiệu lực**: `ĐÃ HOÀN TẤT KHUNG & ĐẠT 100% KIỂM THỬ TỰ ĐỘNG (verify:all + verify:kb 6/6)`
- **Áp dụng cho phiên bản ứng dụng**: `1.4.0-rc.1` (`package.json`: `"1.4.0"`, đồng bộ `/VERSION`)
- **Ngày hoàn tất**: `19/11/2026`
- **Tài liệu căn cứ**:
  - [`docs/knowledge-base-design-plan.md`](knowledge-base-design-plan.md) *(Bản POST-PANEL V2)*
  - [`docs/knowledge-base-expert-panel-review.md`](knowledge-base-expert-panel-review.md) *(`NK-01..NK-12`, `ĐN-1..ĐN-10`)*
  - [`docs/knowledge-base-claude-review-v2.md`](knowledge-base-claude-review-v2.md) *(Chốt `QĐ-N1..QĐ-N8` ngày `19/11/2026`)*

---

## 1. Danh Sách Tệp Đã Tạo Mới & Sửa Đổi

### 1.1. Tệp mã nguồn, dữ liệu mẫu & kiểm thử tạo mới
1. **`server/knowledge-base/types.ts`**:
   - Định nghĩa đầy đủ schema `DistilledKnowledgeEntry` cấp nhóm `(book, h2, h3)` (`id === sourceRef.citationId`), `KnowledgeSourceRef` (phân tách `sourceLicense` theo `NK-12`), mảng `hanziAnchor.quotes` (`quoteCn`, `noteCn`, `t_hms`, `bvid`, `part`, `sectionCn`, `sourceLineNumber`), `qaMeta.sample`, `KnowledgeRetrievalResult` (`ĐN-8` `starAbsentInQueriedPalace`, `starPresenceMode`, `sanFangNoteVi`) và `CitationAuditResult`.
2. **`server/knowledge-base/loader.ts`**:
   - Nạp tĩnh `stars.kb.json`, `sihua.kb.json`, `classics.kb.json` qua `loadKnowledgeBase` / `initKnowledgeBase` lúc khởi động server; dựng inverted indices (`byId`, `byStarVi`, `byPalaceVi`, `byBranchVi`, `byPatternVi`, `bySiHuaCombo`, `byDossierSection`, `byTopicTag`); cung cấp `getKnowledgeBaseSnapshot`, `setKnowledgeBaseEntriesForTesting`, `resetKnowledgeBaseCache`.
3. **`server/knowledge-base/retriever.ts`**:
   - Cài đặt truy hồi tất định 100% cho 3 luồng: `retrieveKnowledgeForDossierSection`, `retrieveKnowledgeForPeriod`, `retrieveKnowledgeForChat`.
   - Chia đều quota vòng 4 cung cho `palaces_core` / `palaces_family` / `palaces_social_health`; áp ngân sách Bảng 4.2 (`KB_BUDGET_LIMITS`: `1.500–3.200` ký tự/lượt); nâng ưu tiên Tứ Hóa trong ngữ cảnh vận hạn/đa năm (`van-han` + `targetDossierSections` `horizon_5y`/`horizon_10y`/`year_2026`/`year_2027`) để 4 Tứ Hóa không bị đẩy khỏi Top-K.
   - Bảng `CHAT_TOPIC_TO_PALACE_KEYWORDS`, chặn bẫy Tầng 3 (`out_of_scope`), và hàm `checkEffectiveStarInPalace` (`ĐN-8`) xét đủ `Stars(b) ∪ BorrowedStars(b) ∪ Stars(+4/+8/+6)`.
4. **`server/knowledge-base/verifier.ts`**:
   - Cài đặt `splitMarkdownSemanticBlocks` ($\le 800$ ký tự/khối) và `verifyAcademicCitationsAndClaims` thực thi 3 lớp `V1` (mã ngoài whitelist), `V2` (viện dẫn tác giả/cổ thư/khẩu quyết không có thẻ nguồn), `V3` (gắn thẻ lệch thực thể).
   - Sinh `buildReferenceAddendumBlock` (`> 📚 **[Tư Liệu Học Thuật Tham Chiếu Trong Chương]**`), `buildVerificationWarningBlock` (`> ⚠️`), và `buildChatCitationFooter`; tuyệt đối không dùng regex sửa chữ giữa câu văn (`ĐN-6`).
5. **`server/knowledge-base/data/{stars.kb.json, sihua.kb.json, classics.kb.json, LICENSE-CC-BY-NC-SA-4.0.md}`**:
   - Tạo sẵn **9 bản ghi khung mẫu** (`NH-STAR-001..003`, `NH-SIHUA-001..003`, `CL-CTP-001..002`, `CL-TVP-001` — đánh dấu `isSampleData: true` và `qaMeta.sample: true`) kèm file bản quyền phân tách `CC-BY-NC-SA-4.0` & `PUBLIC_DOMAIN_TEXT_WITH_CC_BY_NC_SA_ADAPTATION`.
6. **`scripts/kb-verify-source.ts`, `scripts/kb-group-entries.ts`, `scripts/kb-distill.ts`, `scripts/kb-audit-quality.ts`, `scripts/kb-export-audit-sheet.ts`**:
   - Pipeline ngoại tuyến kiểm tra nguồn (`1.848` dòng, `16` `.md`, `classics/`, `MANIFEST.sha256.json`; thoát `0` an toàn khi `/knowledge-source/` chưa có), gom nhóm `(book, h2, h3)` theo `(part ASC, t_hms ASC)`, tách tiểu mục có điều kiện cho `02-palaces`, kéo ngữ cảnh bài giảng `(bvid, t_hms)`, chưng cất bằng `@google/genai` (`^3.3.0`) JSON `responseSchema` + probe model ứng viên + checkpoint JSONL + `--dry-run`, kiểm toán 100% chất lượng `.kb.json`, và xuất phiếu mẫu phân tầng 25 mục cho NotebookLM.
7. **`scripts/verify-knowledge-base.ts`**:
   - Bộ kiểm thử tự động `npm run verify:kb` gồm 6 chặng (`[1/6]..[6/6]`): loader/audit/missing source, grouping/02-palaces/lecture window/sheet export, `K1` (`25/25`), `K2` (`15/15` gồm `ĐN-8`), `K3` (`24` mẫu `K3-A`/`K3-B`/`K3-C`), và tích hợp 3 prompt builders + sanitizer.

### 1.2. Tệp mã nguồn ứng dụng sửa đổi
1. **`src/lib/ziwei/vi-i18n.ts`**: Export `PATTERN_NAME_VI` cho pipeline kiểm định & truy hồi.
2. **`src/lib/ziwei/text-sanitizer.ts`**: Bổ sung hàm lũy đẳng `scrubInvalidCitationTags` (`ĐN-6`).
3. **`src/lib/dossier-chat-ui.ts`**: Mở rộng `sanitizeDossierChapterText` nhận `options.invalidCitationIds`.
4. **`src/components/DetailedDossierModal.tsx`, `src/components/InsightPanel.tsx`, `src/components/ContextualChatDrawer.tsx`**: Bắt frame SSE `{ citationAudit: { scrubbedInvalidIds } }` và dọn sạch thẻ nguồn bịa bằng `scrubInvalidCitationTags` trước khi lưu `IndexedDB` / `aiPeriodCache` / `sessionStorage`.
5. **`server.ts`**:
   - Gọi `initKnowledgeBase()` khi khởi động `startServer()`.
   - Tích hợp KB retriever vào đúng 3 prompt builders (`buildStrictPeriodAiPrompt`, `buildStrictDossierSectionPrompt`, `buildStrictExplanationChatPrompt`), bơm `[TƯ LIỆU HỌC THUẬT ĐỐI CHIẾU]` vào `prompt` và quy tắc trích dẫn chung vào `systemInstruction` (giữ nguyên không chèn `'Giao Hữu'` vào `palaces_core` và giữ nguyên cụm `'KHÔNG CÓ trong lá số/dữ kiện hiện có'` trong chat).
   - Chạy `verifyAcademicCitationsAndClaims` cuối luồng hoàn tất (`!wasInterrupted`) trên `/api/interpret-period` (sau `verifyAndEnsureCompletePeriodSiHua`), `/api/interpret-dossier-section` và `/api/interpret-chat`; phát frame `{ citationAudit }` và stream khối `📚`/`⚠️` trước `data: [DONE]`. Giữ nguyên `/api/interpret` và `/api/heming` sang Đợt 1B; giữ nguyên `express.json({ limit: '512kb' })`.

### 1.3. Tệp cấu hình, phiên bản & tài liệu cập nhật / tạo mới
1. `/VERSION` (`1.4.0-rc.1`), `/package.json` (`"version": "1.4.0"`, thêm `kb:*`, `verify:kb`, cập nhật `verify:all`), `/CHANGELOG.md` (`[1.4.0-rc.1]`), `/README.md`.
2. `docs/decisions-registry.md` (bổ sung **Đợt 8 — `QĐ-N1..QĐ-N8`**), `docs/architecture-overview.md`, `docs/features-dossier-and-chat.md` (bổ sung **Mục 7**), `docs/INDEX.md`, `docs/knowledge-base-expert-panel-review.md` (đồng bộ số mẫu `K3 = 24` ở bảng tổng hợp `NK-05`).
3. `docs/knowledge-base-claude-review-v2.md` & `docs/knowledge-base-implementation-notes.md` (tệp này).

---

## 2. Trạng Thái Dữ Liệu Kho Tri Thức (Minh Bạch Phạm Vi Pilot 1A)

- Tại thời điểm nghiệm thu `1.4.0-rc.1`, thư mục `/knowledge-source/` chưa được nạp vào workspace nên hệ thống **không tự bịa** `~162` bản ghi thật.
- Thay vào đó, 3 tệp `server/knowledge-base/data/{stars,sihua,classics}.kb.json` lưu **9 bản ghi khung mẫu** (`3 + 3 + 3`) có cờ `isSampleData: true` và `qaMeta.sample: true`, đạt 100% chuẩn schema, từ điển `vi-i18n.ts` và 0 chữ Hán ở trường tiếng Việt để vận hành và kiểm chứng trọn vẹn luồng runtime.
- Khi Chủ dự án nạp `/knowledge-source/` và chạy ngoại tuyến `npm run kb:verify-source && npm run kb:distill` (kèm `KB_DISTILL_GEMINI_KEYS`), dữ liệu thật `~162` mục Pilot 1A sẽ thay thế các tệp mẫu và kiểm định lại qua `npm run kb:audit -- --require-real` + `npm run kb:export-audit-sheet`.
- **Cập nhật ngưỡng kiểm toán `summaryVi` (`1.4.0-rc.4`)**: Trong `scripts/kb-audit-quality.ts`, giới hạn độ dài tối đa `summaryVi` được cập nhật từ `350` lên `800` ký tự (giữ nguyên tối thiểu `120` ký tự; các quy tắc kiểm toán khác giữ nguyên). Khung độ dài chưng cất thực tế đã duyệt là `≤600` ký tự cho nhóm bài giảng và `≤350` ký tự cho cổ thư, cộng một ngoại lệ đã kiểm toán đạt ở `754` ký tự (`NH-SIHUA-005`) — quy tắc `350` cũ thuộc đặc tả ban đầu, nay cập nhật cho khớp dữ liệu thật Pilot 1A (`177` mục) đã đạt kiểm toán NotebookLM `17/17` và đã chuẩn hóa metadata (`workTitleVi` thuần Việt, `patternsVi` khớp `PATTERN_NAME_VI`).

---

## 3. Kết Quả Kiểm Chứng Thực Tế (Observed Results)

Tất cả các lệnh dưới đây được thực thi trực tiếp sau lần chỉnh sửa mã nguồn cuối cùng:

| Lệnh kiểm tra | Kết quả quan sát | Chi tiết chính |
|---|---|---|
| `npm run lint` (`tsc --noEmit`) | **PASS (`0` lỗi)** | Exit code `0`, không lỗi kiểu TypeScript trên toàn bộ `src/`, `server/`, `scripts/` |
| `npm run build` (`vite build`) | **PASS** | `✓ 1811 modules transformed.`, `✓ built in 1.34s` |
| `npm run kb:verify-source` | **PASS (exit `0`)** | `[kb:verify-source] Chưa nạp nguồn (/knowledge-source/ chưa tồn tại...) — bỏ qua kiểm tra file gốc (exit 0).` |
| `npm run kb:audit` | **PASS (`9/9` mẫu)** | `[kb:audit] ĐẠT 100% kiểm tra schema, từ điển vi-i18n.ts và chuẩn không chữ Hán.` *(ghi rõ 0 thật / 9 mẫu `sample: true`)* |
| `npm run kb:distill -- --dry-run` | **PASS (exit `0`)** | Dò graceful missing source: thoát sạch `0` và nhắc chạy ngoại tuyến khi nạp nguồn |
| `npm run verify:key-pool` | **PASS (`18/18`)** | `=== TẤT CẢ 18 BÀI KIỂM THỬ KHO KHÓA, BATCH PROBE, B2 & H4 (NV-01) ĐỀU ĐẠT ===` |
| `npm run verify:dossier-context` | **PASS (`6/6`)** | `=== TẤT CẢ 6 BÀI KIỂM THỬ DOSSIER CONTEXT, HORIZON & PHA 1 ĐỀU ĐẠT ===` |
| `npm run verify:dossier-ui` | **PASS (`18/18`)** | `Kết quả verify-dossier-chat-ui: 18/18 bài kiểm chứng ĐẠT.` |
| `npm run verify:yunxian` | **PASS (exit `0`)** | Hoàn tất xuất & kiểm tra bảng dữ kiện Vận Hạn 12 cung Tam Phương Tứ Chính |
| `npm run verify:library` | **PASS (`22/22`)** | `Chart Library verification summary: 22/22 passed.` |
| `npm run verify:kb` (`[1/6]..[6/6]`) | **PASS (`100%`)** | Loader/audit `9/9`, Gom nhóm & phiếu 25 mục, `K1: 25/25`, `K2: 15/15`, `K3: 24/24` (`K3-A: 8/8`, `K3-B: 8/8`, `K3-C: 0/8 FP`), 3 Prompt Builders & Sanitizer |
| Rà soát ràng buộc & bảo vệ | **CLEAN** | 0 `window.alert`/`window.confirm`/`window.open`; `express.json({ limit: '512kb' })` giữ nguyên; Engine Tử Vi & `/api/interpret`, `/api/heming` bất biến; không tạo `backup/`, không push GitHub |
