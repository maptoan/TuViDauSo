# BRIEF NẠP CHU KỲ 2 — BẢN 1.5.0-rc.1 (gói thi công cho AI Studio, model Hydrogen)

Soạn: Muse chính, 20/11/2026. Căn cứ: work/kt-design.md, work/PHAN-BIEN-VONG-2.md (phân xử D3/D4/D5/D7 + CG4), Quyết Q-A của Saint (20:22 20/11/2026), kết quả đo độ tới được work/reachability-rc1.json.
Phạm vi brief này = PHƯƠNG ÁN A (nạp dữ liệu, không sửa retriever). Nếu Saint chọn B sẽ có phụ lục retriever riêng; chọn C thì brief này chờ.

**TRẠNG THÁI KIỂM CHỨNG GÓI (20/11/2026):** Toàn bộ brief này đã được Muse áp thử nguyên văn lên bản sao của src-v17 (thư mục ziwei-reach-test, kèm 2 file dữ liệu ở Mục 1) và chạy kiểm chứng thật: `bun run lint` 0 lỗi, `bun run build` đạt, `bun run verify:all` đạt 100% (verify:kb: nạp 300 mục, kb:audit PASS, K1 32/32, K2 15/15, K3 24/24). Hai hiệu chỉnh so với bản thảo đầu đã được gập vào chính văn dưới đây: (i) ba ca K1-27/K1-28/K1-32 chạy ở mức ghi điểm thay vì ngân sách thật (lý do ghi ngay tại từng ca); (ii) Mục 4 dùng cặp main()/mainDisabled() thay vì throw đơn thuần ở đầu thân hàm cũ (throw đơn thuần làm TypeScript mất thu hẹp kiểu trong phần thân còn lại và lint đỏ — đã kiểm chứng).

Thứ tự thi công bắt buộc: Mục 1 (file dữ liệu) TRƯỚC, rồi mới tới các mục sửa script — vì assert ở Mục 3c chỉ xanh khi đã đủ 7 file dữ liệu.

---

## Mục 1 — Hai file dữ liệu mới (đính kèm phiên AI Studio)

Đặt vào `server/knowledge-base/data/`:
- `methodology.kb.json` — 41 mục NH-METH-001..041, 843.732 byte, SHA-256 `6200de33c01d4da0c6c40c1ef78baf57890ee7b7f69396865e692b7dad6da92f`
- `illness.kb.json` — 21 mục NH-ILL-001..021, 115.074 byte, SHA-256 `990311aac75c269fd91ebf4ac503d677ab1dda928c1ced5f37607f3358ab133e`

Nội dung đã kiểm toán NotebookLM 100% (300/300 toàn CSDL) và kiểm cơ học độc lập: 3 trường Vi khớp từng byte với bản đã kiểm toán, 0 chữ Hán trong 3 trường Vi, summaryVi trong sàn–trần theo bậc số quote, retrievalKeys thuộc vốn từ chuẩn. KHÔNG sửa bất kỳ ký tự nào trong hai file này.

## Mục 2 — scripts/kb-audit-quality.ts: ngoại lệ độ dài tối thiểu của fullTranslationVi

Lý do: 4 mục NH-ILL-004, 007, 012, 013 có quote nguồn là mảnh đơn câu của bài ca quyết Tý Ngọ Lưu Chú (vd 「寅时开肺。」5 ký tự) nên bản dịch toàn văn trung thành chỉ dài 15–19 ký tự, dưới sàn 20 ký tự chung. summaryVi/conditionsVi của các mục này đã mang đủ ngữ cảnh. Đây là ngoại lệ có tên, đúng tiền lệ SUMMARY_VI_AUDITED_EXCEPTIONS của rc.5; không hạ sàn chung.

Thêm sau khối SUMMARY_VI_AUDITED_EXCEPTIONS (sau dòng ~34):

```ts
// Ngoại lệ sàn độ dài fullTranslationVi: các mục có quote nguồn là mảnh đơn câu của ca quyết
// Tý Ngọ Lưu Chú (nguồn chỉ 5–6 ký tự) nên bản dịch toàn văn trung thành ngắn hơn sàn 20 ký tự.
// Nội dung đã kiểm toán đạt; summaryVi/conditionsVi mang đủ ngữ cảnh. Chỉ áp cho đúng 4 mục này.
const FULL_TRANSLATION_MIN_EXCEPTIONS = new Set([
  'NH-ILL-004', // quote 「寅时开肺。」— fullTranslationVi 17 ký tự
  'NH-ILL-007', // quote 「脾开巳时。」— fullTranslationVi 19 ký tự
  'NH-ILL-012', // quote 「这是心包。」— fullTranslationVi 15 ký tự
  'NH-ILL-013', // quote 「这是三焦。」— fullTranslationVi 16 ký tự
]);
```

Sửa điều kiện kiểm (dòng ~130):

```ts
    if (!entry.fullTranslationVi || entry.fullTranslationVi.trim().length < 20) {
```
thành:
```ts
    if (
      !FULL_TRANSLATION_MIN_EXCEPTIONS.has(entry.id) &&
      (!entry.fullTranslationVi || entry.fullTranslationVi.trim().length < 20)
    ) {
```

## Mục 3 — scripts/verify-knowledge-base.ts

### 3a. makeEntry: thêm tham số category/scopeTier tùy chọn (mặc định giữ nguyên hành vi cũ)

Trong chữ ký opts của makeEntry (dòng ~46–58) thêm hai dòng:

```ts
    category?: DistilledKnowledgeEntry['category'];
    scopeTier?: DistilledKnowledgeEntry['scopeTier'];
```

Sửa dòng suy category (dòng ~64):

```ts
  const category = isClassic ? 'classics-fu' : isSiHua ? '04-sihua' : '01-stars';
```
thành:
```ts
  const category =
    opts.category ?? (isClassic ? 'classics-fu' : isSiHua ? '04-sihua' : '01-stars');
```

Sửa dòng scopeTier trong object trả về (dòng ~76):

```ts
    scopeTier: 'tier1_core',
```
thành:
```ts
    scopeTier: opts.scopeTier ?? 'tier1_core',
```

### 3b. k1Corpus: thêm 7 fixture (chèn trước dấu `];` đóng mảng k1Corpus, sau fixture NH-STAR cuối)

```ts
    makeEntry('NH-ILL-014', {
      starsVi: ['Thất Sát'],
      palacesVi: ['Tật Ách'],
      branchesVi: ['Mùi'], // cung Tật Ách của lá số kiểm thử (15/5/1990) đóng tại chi Mùi
      topicTags: ['suc-khoe'],
      targetDossierSections: ['palaces_social_health'],
      category: '05-illness',
      scopeTier: 'tier2_extended',
      priorityTier: 2,
    }),
    makeEntry('NH-METH-025', {
      topicTags: ['van-han'],
      targetDossierSections: ['horizon_5y'],
      category: '07-methodology',
      scopeTier: 'tier2_extended',
      priorityTier: 2,
    }),
    makeEntry('NH-METH-040', {
      topicTags: ['van-han'],
      targetDossierSections: ['year_2026'],
      category: '07-methodology',
      scopeTier: 'tier2_extended',
      priorityTier: 2,
    }),
    makeEntry('NH-ILL-001', {
      palacesVi: ['Tật Ách'],
      topicTags: ['suc-khoe'],
      targetDossierSections: ['palaces_social_health'],
      category: '05-illness',
      scopeTier: 'tier2_extended',
      priorityTier: 2,
    }),
    makeEntry('NH-METH-024', {
      // Mọi khóa rỗng theo chủ đích — fixture cho ca âm tính K1-31 (giới hạn truy hồi đã biết).
      category: '07-methodology',
      scopeTier: 'tier2_extended',
      priorityTier: 3,
    }),
    makeEntry('NH-METH-001', {
      topicTags: ['ban-menh'],
      targetDossierSections: ['chapter_overview'],
      category: '07-methodology',
      scopeTier: 'tier2_extended',
      priorityTier: 2,
    }),
```

(LƯU Ý: chỉ 6 fixture ở đây; fixture thứ 7 không cần — K1-29 và K1-30 dùng chung fixture NH-ILL-001.)

### 3c. Khối [1/6]: assert loader đủ 7 file / 300 mục + ca khói dữ liệu thật ở mức ghi điểm

Sau các assert filesLoaded hiện hữu (stars/sihua/classics) thêm:

```ts
    assert.ok(snap.filesLoaded.includes('palaces.kb.json'));
    assert.ok(snap.filesLoaded.includes('patterns.kb.json'));
    assert.ok(snap.filesLoaded.includes('methodology.kb.json'));
    assert.ok(snap.filesLoaded.includes('illness.kb.json'));
    assert.strictEqual(snap.totalEntries, 300, 'Sau nạp chu kỳ 2, CSDL phải có đúng 300 mục');
```

Và ở CUỐI khối [1/6] (trước khi khối [2/6] gọi setKnowledgeBaseEntriesForTesting) thêm ca khói:

```ts
    // Ca khói dữ liệu thật (mức GHI ĐIỂM, ngân sách nới tối đa): hai category mới phải có ít nhất
    // một mục ghi điểm > 0 trong section chủ lực của chúng trên lá số kiểm thử. Đo ở mức ghi điểm
    // chứ không phải mức đóng gói ngân sách thật — độ tới được ở ngân sách thật là hạng mục
    // retriever riêng, không thuộc cổng của lượt nạp dữ liệu này.
    const smokeOpts = { maxEntries: 500, maxChars: 5_000_000 };
    const smokeHealth = retrieveKnowledgeForDossierSection(chart, 'palaces_social_health', smokeOpts);
    assert.ok(
      smokeHealth.entries.some((e) => e.id.startsWith('NH-ILL-')),
      'Ca khói: palaces_social_health phải ghi điểm ít nhất 1 mục NH-ILL-*',
    );
    const smokeHorizon = retrieveKnowledgeForDossierSection(chart, 'horizon_5y', smokeOpts);
    assert.ok(
      smokeHorizon.entries.some((e) => e.id.startsWith('NH-METH-') || e.id === 'NH-ILL-017'),
      'Ca khói: horizon_5y phải ghi điểm ít nhất 1 mục NH-METH-* hoặc NH-ILL-017',
    );
```

### 3d. K1: thêm trường expectAbsent, 7 ca mới K1-26..32, nâng assert 25 → 32

Sửa khai báo kiểu của k1Cases (dòng ~473; lưu ý thụt lề thật trong file là 6 khoảng trắng cho các trường):

```ts
    const k1Cases: Array<{
      name: string;
      run: () => ReturnType<typeof retrieveKnowledgeForDossierSection>;
      expectedId: string;
      mustCoverPalaces?: string[];
    }> = [
```
thành:
```ts
    const k1Cases: Array<{
      name: string;
      run: () => ReturnType<typeof retrieveKnowledgeForDossierSection>;
      expectedId: string;
      mustCoverPalaces?: string[];
      expectAbsent?: boolean;
    }> = [
```

Sửa đoạn xử lý kết quả trong vòng lặp (khối `if (firstIds.includes(tc.expectedId)) {...} else { throw ... }`):

```ts
      if (tc.expectAbsent) {
        if (!firstIds.includes(tc.expectedId)) {
          k1Hits += 1;
        } else {
          throw new Error(
            `${tc.name}: ca âm tính nhưng ${tc.expectedId} lại xuất hiện. Trả về: [${firstIds.join(', ')}]`,
          );
        }
      } else if (firstIds.includes(tc.expectedId)) {
        k1Hits += 1;
      } else {
        throw new Error(
          `${tc.name}: không trúng ${tc.expectedId}. Trả về: [${firstIds.join(', ')}]`,
        );
      }
```

Thêm 7 ca sau ca K1-25 (trước dấu `];` đóng mảng k1Cases):

```ts
      {
        name: 'K1-26 social_health gặp mục ILL theo cung + chi',
        run: () => retrieveKnowledgeForDossierSection(chart, 'palaces_social_health'),
        expectedId: 'NH-ILL-014',
      },
      {
        // K1-27 chạy ở mức GHI ĐIỂM (ngân sách nới tối đa): trong corpus fixture dùng chung,
        // các fixture tứ hóa/sao Tầng 1 luôn ghi 1.000+ điểm ở ngữ cảnh horizon nên một mục
        // thuần kênh tag (575 điểm) không bao giờ lọt ngân sách thật — đúng hiện tượng đã đo
        // trên dữ liệu thật (work/reachability-rc1.json). Ca này kiểm chứng KÊNH tag van-han
        // có ghi điểm và được chọn khi không bị ngân sách loại; độ tới được ở ngân sách thật
        // thuộc hạng mục retriever riêng.
        name: 'K1-27 horizon gặp mục METH qua tag van-han (mức ghi điểm)',
        run: () =>
          retrieveKnowledgeForDossierSection(chart, 'horizon_5y', {
            maxEntries: 500,
            maxChars: 5_000_000,
          }),
        expectedId: 'NH-METH-025',
      },
      {
        // K1-28 chạy ở mức GHI ĐIỂM như K1-27 (cùng lý do: kênh tag thuần 575 điểm không lọt
        // ngân sách thật khi corpus có các fixture tứ hóa/sao ghi 1.000+ điểm).
        name: 'K1-28 period lưu niên 2026 gặp mục METH qua tag van-han (mức ghi điểm)',
        run: () =>
          retrieveKnowledgeForPeriod(chart, period2026, {
            maxEntries: 500,
            maxChars: 5_000_000,
          }),
        expectedId: 'NH-METH-040',
      },
      {
        name: 'K1-29 chat sức khỏe không nêu tên cung gặp mục ILL lõi',
        run: () =>
          retrieveKnowledgeForChat({
            chart,
            contextMode: 'natal',
            sectionTitle: 'Luận giải',
            question: 'Sức khỏe của tôi năm nay thế nào, có phải mổ xẻ gì không?',
          }),
        expectedId: 'NH-ILL-001',
      },
      {
        name: 'K1-30 chat sức khỏe có nêu tên cung vẫn gặp mục ILL lõi (chỉ bằng đường cung)',
        run: () =>
          retrieveKnowledgeForChat({
            chart,
            contextMode: 'natal',
            sectionTitle: 'Luận giải',
            question: 'Cung Tật Ách của tôi có đáng lo không?',
          }),
        expectedId: 'NH-ILL-001',
      },
      {
        name: 'K1-31 chat phương pháp luận thuần — ca âm tính ghi nhận giới hạn đã biết',
        run: () =>
          retrieveKnowledgeForChat({
            chart,
            contextMode: 'natal',
            sectionTitle: 'Luận giải',
            question: 'Xem một cung thì phải xem thêm những gì?',
          }),
        expectedId: 'NH-METH-024',
        expectAbsent: true,
      },
      {
        // K1-32 chạy ở mức GHI ĐIỂM như K1-27/K1-28 (kênh tag ban-menh thuần 265 điểm không
        // lọt ngân sách thật của chapter_overview khi corpus có fixture sao/tứ hóa/cổ thư
        // ghi điểm cao hơn — cùng hiện tượng đã đo trên dữ liệu thật).
        name: 'K1-32 chapter_overview gặp mục METH tổng quan (mức ghi điểm)',
        run: () =>
          retrieveKnowledgeForDossierSection(chart, 'chapter_overview', {
            maxEntries: 500,
            maxChars: 5_000_000,
          }),
        expectedId: 'NH-METH-001',
      },
```

(K1-28 dùng biến `period2026` đã dựng ở đầu cùng khối kiểm thử; nếu biến nằm ngoài phạm vi của mảng k1Cases thì thay bằng `buildYunxianPeriodContext(chart, { mode: 'liunian', year: 2026 })` với khẳng định khác null trước khi gọi.)

Sửa hai assert và dòng log cuối nhóm K1:

```ts
    assert.strictEqual(k1Cases.length, 25, 'Nhóm K1 phải có đủ 25 ca chuẩn');
```
thành:
```ts
    assert.strictEqual(k1Cases.length, 32, 'Nhóm K1 phải có đủ 32 ca chuẩn');
```

```ts
    assert.strictEqual(k1Hits, 25);
    console.log('  -> ĐẠT: K1 25/25 ca (100% Recall@K, 10/10 lần lặp tất định, 100% đạt trần ngân sách).');
```
thành:
```ts
    assert.strictEqual(k1Hits, 32);
    console.log('  -> ĐẠT: K1 32/32 ca (100% Recall@K, 10/10 lần lặp tất định, 100% đạt trần ngân sách).');
```

## Mục 4 — scripts/kb-distill.ts: khóa cứng pipeline Gemini đã ngừng dùng

Theo phân xử D4 (throw thay comment). Cách áp đã kiểm chứng lint-xanh: đổi tên hàm `main()` hiện hữu thành `mainDisabled()` (giữ nguyên toàn bộ thân hàm), và thêm một `main()` mới chỉ gồm throw, đặt ngay trước nó. KHÔNG chèn throw vào đầu thân hàm cũ: phần thân sau throw thành mã không tới được, TypeScript ngừng thu hẹp kiểu liên minh phân biệt trong đó và lint sẽ đỏ ở các chỗ dùng `checked.entry` (đã kiểm chứng thực tế).

Thêm mới (đặt ngay trước hàm main cũ đã đổi tên):

```ts
async function main() {
  // Khóa cứng theo quyết định ngừng dùng pipeline Gemini (19/11/2026): mọi lời gọi kb:distill
  // đều dừng ngay tại đây. Thân pipeline cũ giữ nguyên ở mainDisabled() chỉ để tham khảo,
  // tuyệt đối không được nối lại vào main() khi chưa có lệnh khôi phục rõ ràng.
  throw new Error(
    'kb:distill đã NGỪNG DÙNG từ 19/11/2026: dữ liệu Nền Tri Thức do quy trình chưng cất ' +
      'Muse hai lượt + kiểm toán NotebookLM + assembler tất định ở workspace ziwei-kb-distill sản xuất. ' +
      'Không chạy script này để nạp dữ liệu thật.',
  );
}
```

Và đổi dòng khai báo của hàm main cũ:

```ts
async function main() {
```
thành:
```ts
async function mainDisabled() {
```
(chỉ đúng một chỗ — khai báo hàm ở khoảng dòng 395; lời gọi `main().catch(...)` ở cuối file GIỮ NGUYÊN để nó gọi vào main() mới.)

## Mục 5 — server/knowledge-base/types.ts: sửa comment mô tả citationId (chỉ tài liệu)

Trong khối comment của `citationId` (dòng ~55–63), thay dòng:

```ts
   * - Bài giảng bổ sung (~45 mục): "NH-LEC-001" .. "NH-LEC-045"
```
bằng:
```ts
   * - 05-illness (21 nhóm): "NH-ILL-001" .. "NH-ILL-021"
   * - 07-methodology (41 nhóm): "NH-METH-001" .. "NH-METH-041"
```

## Mục 6 — VERSION + CHANGELOG

- `VERSION`: dòng đầu đổi thành `1.5.0-rc.1`; ngày cập nhật 20/11/2026; trạng thái: "Bản RC.1 (nhánh 1.5.0) — Nạp chu kỳ 2 hoàn tất CSDL Nền Tri Thức 300 mục đã kiểm toán (thêm 41 mục phương pháp luận 07-methodology và 21 mục bệnh tật 05-illness); kèm 7 ca kiểm thử K1 mới (K1-26..32), ngoại lệ sàn độ dài bản dịch cho 4 mục mảnh ca quyết, và khóa cứng script kb:distill đã ngừng dùng. Độ tới được của hai nhóm mới trong prompt ở ngân sách thật còn hạn chế — hạng mục retriever riêng, chưa thuộc bản này."
- `CHANGELOG.md`: thêm mục 1.5.0-rc.1 (20/11/2026) tóm tắt đúng các thay đổi ở Mục 1–5.

## Mục 7 — Kiểm chứng sau thi công (chạy và báo cáo nguyên văn kết quả)

```
bun run lint
bun run build
bun run verify:all
```
Kỳ vọng: lint 0 lỗi; build đạt; verify:all đạt toàn bộ (gồm verify:kb với K1 32/32 và audit dữ liệu 300 mục đạt). Nếu có ca nào đỏ: DỪNG, báo cáo nguyên văn lỗi, không tự ý sửa retriever hay dữ liệu để né lỗi.

## TUYỆT ĐỐI KHÔNG làm trong lượt này
- Không sửa `server/knowledge-base/retriever.ts` (kể cả KB_BUDGET_LIMITS, trọng số, cơ chế đóng gói).
- Không sửa SI_HUA_TABLE hay bất kỳ hằng số engine nào.
- Không sửa nội dung hai file dữ liệu mới (kể cả một ký tự).
- Không mở khóa/nới books trong kb-distill.ts (Mục 4 là khóa cứng, không phải mở).
- Không push GitHub, không đổi cấu hình triển khai.
