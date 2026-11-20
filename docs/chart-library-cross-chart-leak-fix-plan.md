# KẾ HOẠCH VÁ LỖI RÒ DỮ LIỆU CHÉO TRONG THƯ VIỆN LÁ SỐ — BẢN POST-PANEL V2 (`docs/chart-library-cross-chart-leak-fix-plan.md`)

- **Loại tài liệu**: `[Kế hoạch Chẩn đoán & Vá lỗi Nghiêm trọng — BẢN POST-PANEL V2 ĐÃ TỐI ƯU HÓA]`
- **Trạng thái hiệu lực**: `POST-PANEL V2 — SẴN SÀNG THI CÔNG SAU KHI CHỐT DUYỆT (CHƯA SỬA CODE TRONG LƯỢT NÀY)`
- **Phiên bản hiện hành bị ảnh hưởng**: `1.2.0-rc.1` (`package.json`: `"1.2.0"`, đồng bộ `/VERSION`)
- **Phiên bản đích đề xuất sau vá**: `1.2.0-rc.2` (`package.json`: `"1.2.0"`)
- **Ngày lập kế hoạch V1**: `18/11/2026`
- **Ngày cập nhật POST-PANEL V2**: `18/11/2026` *(Đã tích hợp toàn bộ kết luận `LK-01..LK-10` từ Biên bản Tổ Chuyên Gia Mô Phỏng 5 Vai tại `docs/chart-library-cross-chart-leak-expert-panel-review.md`)*
- **Mã nguồn đối chiếu (Code SSOT)**:
  - `src/lib/chart-library.ts` (`dòng 815–927, 1232–1558, 1616–1995, 2019–2051, 2482–2558`)
  - `src/lib/dossier-chat-ui.ts` (`dòng 65–86, 170–197, 257–378, 863–933`)
  - `src/lib/ziwei/text-sanitizer.ts` (`dòng 113–217`)
  - `src/components/DetailedDossierModal.tsx` (`dòng 134–310, 347–780, 842`)
  - `src/components/ChartLibraryModal.tsx` (`dòng 829–884`)
  - `src/App.tsx` (`dòng 77, 142–188, 488–507, 546–576, 652–702`)
  - `scripts/verify-chart-library.ts` (`dòng 203–786`)
- **Quyết định & Điều chỉnh liên quan**: `QĐ-L1..QĐ-L9`, `ĐC-1..ĐC-6`, `LK-01..LK-10`

---

## 0. Tóm Tắt Các Thay Đổi Lớn Trong Bản POST-PANEL V2 So Với Bản V1

1. **`[POST-PANEL V2 — LK-01]` Ma trận kiểm thử tách bạch 5 bài mới (`TEST-L13..TEST-L17`, tổng cộng `17/17` bài trong `verify:library`)**: Không gộp chung kịch bản di trú; tách riêng `TEST-L13` (trùng khóa 5 thành phần `fivePartCount === 1`), `TEST-L14` (trùng `nameSlug` / tên rỗng `'anon'`), `TEST-L15` (đổi lá số lúc chưa hydrated + bảo vệ chương đang sinh), `TEST-L16` (`resolveDossierChapterFromCaches` chặn `localChapters` lệch `sectionCacheKey` ở cả nhánh kỳ hạn và nhánh thường), và `TEST-L17` (xóa hồ sơ `dossier_only` / xóa chương lẻ & chống hồi sinh từ `ziwei_history`).
2. **`[POST-PANEL V2 — LK-02]` Giải phẫu chính xác `TEST-L04` và rà soát `TEST-L01..L12`**: Nêu rõ 4 khẳng định tại `scripts/verify-chart-library.ts:359–366` sẽ thay đổi khi bỏ Bậc 2/3, và chứng minh 11 bài test còn lại (`TEST-L01..L03, L05..L12`) hoàn toàn không phụ thuộc Bậc 2/3.
3. **`[POST-PANEL V2 — LK-03 & LK-08]` Bác bỏ cơ chế tự động gỡ chương trùng văn bản (`QĐ-L8` Phương án A/C3) — Chuyển sang Phương án B tăng cường (`C1+`)**: Chứng minh tự động gỡ chương trùng văn bản `>= 200` ký tự có nguy cơ xóa nhầm dữ liệu hợp lệ và xóa nhầm chính chủ thật (do `section.updatedAt` giữa bản gốc và bản nhiễm bằng nhau hệt tại `src/lib/chart-library.ts:850`, và `entry.createdAt` có thể đảo chiều khi chủ thật được lập lại sau). Thay bằng cơ chế xóa chủ động an toàn có hoàn tác trong phiên (`undo`).
4. **`[POST-PANEL V2 — LK-04]` Tách bạch thuật ngữ `'dossier_only'`**: Phân biệt rõ (a) hồ sơ phiên chưa liên kết trong `sessionStorage` (`Unlinked Session Dossier` — không có `BirthFormState`, giữ nguyên tại `sessionStorage`, không tạo thẻ thư viện) với (b) tham số `deleteMode: 'dossier_only'` của `removeLibraryEntry` đã có sẵn trong `ChartLibraryModal`.
5. **`[POST-PANEL V2 — LK-05]` Chốt `QĐ-L9` Phương án A có Cổng Bảo Vệ Lũy Đẳng**: Phát hiện và vá luôn lỗi `migrateLegacyHistoryAndDossiers` không kiểm tra `deletedTombstones` (khiến lá số đã xóa vĩnh viễn nhưng còn trong `ziwei_history` bị hồi sinh sau khi tải lại trang) và lỗi ghi thừa làm trôi `updatedAt` ở mỗi lần mở app.
6. **`[POST-PANEL V2 — LK-06 & LK-09]` Chống Race Condition trong `DetailedDossierModal.tsx` & Vá lỗi "Bóng ma Chương 5/6 sau khi xóa hồ sơ" trong `App.tsx`**:
   - Bảo vệ chương đang `'loading'` (đang stream SSE) hoặc vừa sinh xong không bị `useEffect` hydration xóa nhầm; đồng thời tự động `stopAllGeneration()` nếu đổi `chartIdentityKey` khi luồng SSE cũ đang chạy.
   - Không viết đè `sectionCacheKey` cho bản ghi ngoại lai mà bắt buộc kiểm tra khớp khóa theo chuẩn `ĐC-3` (`LK-10`).
   - Khi người dùng xóa hồ sơ (`dossier_only` hoặc `entry_and_dossier`), xóa đồng bộ các khóa `${chartIdentityKey}__` trong `aiPeriodCache` của `App.tsx` và thêm `open` vào dependency array của `useEffect` trong `DetailedDossierModal.tsx`.
7. **`[POST-PANEL V2 — LK-07]` Đính chính điều kiện nối bảng 4/4 Lưu Niên Tứ Hóa**: Kiểm chứng trên `src/lib/ziwei/text-sanitizer.ts:113–217` rằng `verifyAndEnsureCompletePeriodSiHua` chỉ nối bảng `> 📌` của lá số mới khi văn bản gốc thiếu $\ge 1$ sao Lưu Hóa; nếu văn bản của Người A đã nhắc đủ 4 sao Lưu Hóa (hoặc đã có bảng `> 📌` của Người A), bảng cung vị của Người A được giữ nguyên bên trong bản ghi của Người B.

---

## 1. Mô Tả Hiện Tượng & Phạm Vi Kiểm Chứng

### 1.1. Hiện tượng thực tế (Người dùng xác nhận 100%)
Khi người dùng lập một **lá số mới hoàn toàn** cho một đương số chưa từng chạy luận giải AI bao giờ, sau đó mở **Hồ Sơ Luận Giải Chi Tiết (8 Chương)**, giao diện hiển thị **Chương 5 (`year_2026` — Lưu Niên 2026)** và **Chương 6 (`year_2027` — Lưu Niên 2027)** đã có sẵn văn bản luận giải hoàn chỉnh của **một người khác**.

### 1.2. Xác nhận các đường đọc/ghi ở trạng thái ổn định
Qua đối chiếu trực tiếp mã nguồn `1.2.0-rc.1`, cấu trúc khóa định danh 9 thành phần (`buildChartIdentityKey` tại `src/lib/ziwei/yunxian-context.ts:292–310`, định dạng `${year}_${month}_${day}_${hour}_${gender}__${nameSlug}__mg${mingGongBranch}__${leapFlag}__${origSig}__${lonSig}`) là hoàn toàn phân biệt cho từng lá số. Tuy nhiên, dữ liệu bị rò chéo và lưu cứng do **3 mắt xích trong luồng di trú, resolver và vòng đời state React** (cộng với 2 lỗ hổng phụ trợ `LK-09`, `LK-10` được phát hiện trong vòng phản biện).

---

## 2. Phân Tích Nguyên Nhân Gốc (Mục a — Đã Kiểm Chứng Từng Dòng Code)

### 2.1. NGHI PHẠM 1 (Thủ phạm chính — Mức độ: NGHIÊM TRỌNG / GHI LƯU VĨNH VIỄN): Ánh xạ Bậc 2 & Bậc 3 trong `migrateLegacyHistoryAndDossiers`

#### Trích dẫn mã nguồn (`src/lib/chart-library.ts:1260–1316` và `1350–1390`):
```ts
// src/lib/chart-library.ts:1260-1270
  const fivePartCount = new Map<string, number>();
  const resolvedItems = legacyEntries.map((item) => {
    const resolved = resolveChartAndIdentityFromForm(item.form);
    fivePartCount.set(
      resolved.legacyFivePartKey,
      (fivePartCount.get(resolved.legacyFivePartKey) ?? 0) + 1,
    );
    return { item, resolved };
  });
```
Và tại vòng lặp duyệt từng mục lịch sử (`src/lib/chart-library.ts:1285–1316`):
```ts
// src/lib/chart-library.ts:1285-1316
    const candidateRecords: StoredDossierRecord[] = [];
    // Bậc 1: Khớp chính xác khóa 9 thành phần
    if (orphanDossiers.has(chartIdentityKey)) {
      candidateRecords.push(orphanDossiers.get(chartIdentityKey)!);
      matchedOrphanKeys.add(chartIdentityKey);
    }
    // Bậc 2: Khớp chính xác khóa 5 thành phần (1.0.0-stable)
    if (orphanDossiers.has(legacyFivePartKey)) {
      candidateRecords.push(orphanDossiers.get(legacyFivePartKey)!);
      matchedOrphanKeys.add(legacyFivePartKey);
    }
    // Bậc 3: Khớp tiền tố 5 thành phần + nameSlug (hoặc duy nhất trong nhóm 5 thành phần)
    for (const [k, rec] of orphanDossiers.entries()) {
      if (matchedOrphanKeys.has(k)) continue;
      if (!k.startsWith(`${legacyFivePartKey}__`)) continue;
      const matchesName = k.includes(`__${nameSlug}__`);
      const isUniqueFivePart = (fivePartCount.get(legacyFivePartKey) ?? 0) === 1;
      if (matchesName || isUniqueFivePart) {
        candidateRecords.push(rec);
        matchedOrphanKeys.add(k);
      }
    }

    let mergedRecord = getBestKnownDossierSync(chartIdentityKey);
    for (const cand of candidateRecords) {
      mergedRecord = mergeDossierRecords(chartIdentityKey, mergedRecord, cand, chart);
    }

    if (mergedRecord && candidateRecords.length > 0) {
      persistDossierToTargets(mergedRecord, chart);
      linkedDossiers += 1;
    }
```
Và tại nhánh cứu hộ `currentForm` (`src/lib/chart-library.ts:1350–1367`):
```ts
// src/lib/chart-library.ts:1354-1357
    const orphanCurrent =
      (!matchedOrphanKeys.has(chartIdentityKey) && orphanDossiers.get(chartIdentityKey)) ||
      (!matchedOrphanKeys.has(legacyFivePartKey) && orphanDossiers.get(legacyFivePartKey)) ||
      null;
```

#### Cơ chế rò rỉ từng bước:
1. **Bước 1**: Trong `sessionStorage` tồn tại bản ghi `ziwei_dossier_v1::<key_A>` của Người A (chứa Chương 5 `year_2026` và Chương 6 `year_2027`, vốn được tạo khi Người A xem luận giải Lưu Niên hoặc sinh trong Hồ Sơ).
2. **Bước 2**: Chủ thật (Người A) không còn nằm trong 10 mục của `localStorage['ziwei_history']` (do giới hạn `.slice(0, 10)` tại `src/lib/chart-library.ts:1649` hoặc do ở bản `1.0.0-stable` hàm `saveToHistory` khử trùng chỉ theo 5 trường ngày/giờ/giới tính mà bỏ qua tên và nơi sinh), hoặc Người A nằm ở vị trí sau Người B trong mảng `ziwei_history`.
3. **Bước 3**: Bản đồ `fivePartCount` (`dòng 1261–1269`) **chỉ đếm các mục có mặt trong `ziwei_history`**, hoàn toàn không đếm chủ thật của các hồ sơ trong `orphanDossiers`. Khi người dùng lập lá số mới cho Người B có cùng 5 thành phần đầu (`${year}_${month}_${day}_${hour}_${gender}`):
   - Nếu Người B là mục duy nhất trong `ziwei_history` có 5 thành phần đó $\rightarrow$ `isUniqueFivePart === true` (`dòng 1301`), Bậc 3 lập tức gắn hồ sơ của Người A sang Người B dù khác hẳn họ tên, nơi sinh, phút sinh!
   - Hoặc nếu cả hai để trống tên (`nameSlug === 'anon'`, `dòng 483`) hay có `nameSlug` là chuỗi con của nhau (`k.includes(\`__\${nameSlug}__\`)`, `dòng 1300`) $\rightarrow$ `matchesName === true`, Bậc 3 cũng gắn nhầm hồ sơ!
   - Hoặc nếu hồ sơ trong `sessionStorage` mang khóa 5 thành phần cũ (`1.0.0-stable`) $\rightarrow$ Bậc 2 (`dòng 1292, 1356`) gắn thẳng vào Người B.
4. **Bước 4 (`[POST-PANEL V2 — Đính chính theo LK-07]`)**:
   - Ngay khi Bậc 2/3 bắt nhầm hồ sơ của Người A, `mergeDossierRecords` $\rightarrow$ `sanitizeFullDossierRecord(record, keyB, chartB)` (`src/lib/chart-library.ts:824–859`) **ghi đè** `record.chartIdentityKey = keyB` và `sectionCacheKey = "${keyB}::${spec.id}"`, đồng thời giữ nguyên `section.updatedAt` của Người A (`dòng 850`).
   - Đối với văn bản Chương 5 (`year_2026`) và Chương 6 (`year_2027`), `sanitizeDossierChapterText` (`src/lib/dossier-chat-ui.ts:170–197`) gọi `verifyAndEnsureCompletePeriodSiHua(cleaned, periodCtxB)` (`src/lib/ziwei/text-sanitizer.ts:165–217`):
     - **Trường hợp 4a**: Nếu văn bản của Người A chưa nhắc đủ 4 sao Lưu Hóa trong câu (`missingEntries.length > 0` tại `text-sanitizer.ts:192`), hàm nối thêm khối `> 📌 **[Tổng Hợp Đầy Đủ Tứ Hóa Kỳ Hạn Theo Lá Số]**` tính theo cung vị của **Người B (`chartB`)** vào cuối bài luận giải của **Người A**.
     - **Trường hợp 4b**: Nếu văn bản của Người A đã nhắc đủ 4 sao Lưu Hóa (hoặc đã có sẵn khối `> 📌` của Người A từ trước), vì `isPeriodSiHuaMentionedInText` (`text-sanitizer.ts:113–158`) chỉ kiểm tra tên sao + tên hóa chứ không kiểm tra tên cung, nên `missingEntries.length === 0` và toàn bộ văn bản kèm bảng cung vị của **Người A** được giữ nguyên vẹn bên trong bản ghi mang khóa của **Người B**.
   - Cuối cùng, `persistDossierToTargets` (`dòng 1314`) ghi bản ghi đã bị đổi khóa này xuống cả 4 tầng (`inMemoryDossierMirror`, `localStorage` hot cache, `sessionStorage`, và `IndexedDB`), rồi `buildPeriodCachePatchesFromLibrary` (`dòng 2019–2051`) bơm thẳng Chương 5/6 vào `aiPeriodCache` của Người B.

---

### 2.2. NGHI PHẠM 2 (Thủ phạm đồng phạm ở tầng Resolver — Mức độ: CAO): `resolveDossierChapterFromCaches` không kiểm tra `sectionCacheKey`

#### Trích dẫn mã nguồn (`src/lib/dossier-chat-ui.ts:863–933`):
- Ở nhánh kỳ hạn (`spec.mode === 'period'`, `dòng 872–915`):
  - `dòng 875–879`: `const localExisting = localChapters[spec.id]; if (localExisting?.status === 'loading') return localExisting;` — không kiểm tra `localExisting.sectionCacheKey === sectionCacheKey`.
  - `dòng 888, 902`: Mượn `localExisting?.sourceBadge` mà không kiểm tra `sectionCacheKey`.
  - Khi lá số mới chưa có mục trong `aiPeriodCache[pKey]`, Chương 5 (`year_2026`) và Chương 6 (`year_2027`) rơi qua dòng `915` xuống thẳng nhánh thường ở dòng `917`.
- Ở nhánh thường cuối hàm (`dòng 917–926`):
  - `const stored = localChapters[spec.id]; if (stored) { return { ...stored, ... }; }` — hoàn toàn **không kiểm tra `stored.sectionCacheKey === sectionCacheKey`**.
  - Hệ quả: Bất cứ khi nào state `localChapters` trong `DetailedDossierModal` còn giữ dữ liệu của lá số trước (trong nhịp render đầu tiên khi vừa đổi prop `chart` hoặc khi chưa hydrated), `resolveDossierChapterFromCaches` sẽ trả về văn bản của lá số cũ cho lá số mới.

---

### 2.3. NGHI PHẠM 3 (Thủ phạm đồng phạm ở tầng React Lifecycle — Mức độ: CAO): `DetailedDossierModal.tsx` và `App.tsx`

1. **Giữ lại `localChapters` cũ khi đổi lá số lúc `!isHydrated` (`src/components/DetailedDossierModal.tsx:165–257`)**:
   - Khi chuyển sang lá số mới chưa có hồ sơ (`stored === null`) trong lúc `isHydrated === false` (`hydrationStatus` đang `'idle'` hoặc `'hydrating'`), nhánh `if (stored && stored.sections)` (`dòng 171`) sai và nhánh `else if (isHydrated)` (`dòng 249`) cũng sai; khối `if (prevChartKeyRef.current !== chartIdentityKey)` (`dòng 253–256`) chỉ đặt lại `selectedChapterId` chứ không gọi `setLocalChapters({})`.
2. **Độ trễ 1 nhịp render khi đổi prop `chart` (`DetailedDossierModal.tsx:299–310`)**:
   - `resolvedStatesMap` (`useMemo`) chạy trong pha render trước khi `useEffect` (`dòng 165`) chạy sau paint. Nếu không có chốt chặn `sectionCacheKey` ở Mục vá 2, khung hình đầu tiên sau khi đổi `chart` vẫn đọc `localChapters` của lá số trước.
3. **`[POST-PANEL V2 — LK-09]` Không xóa `aiPeriodCache` và không làm mới `localChapters` khi xóa hồ sơ (`src/App.tsx:695`, `DetailedDossierModal.tsx:165–257, 842`)**:
   - Khi người dùng bấm *"Xóa → Chỉ xóa Hồ Sơ"* (`deleteMode: 'dossier_only'`) trong `ChartLibraryModal`, `App.tsx` không xóa các khóa `${chartIdentityKey}__liunian__liunian_2026` / `2027` khỏi state `aiPeriodCache`, và `DetailedDossierModal` (vốn luôn mount tại `App.tsx:652` vì `if (!open) return null` đặt ở dòng `842`) không có `open` trong dependency array của `useEffect` (`dòng 257`), khiến mở lại modal vẫn thấy nguyên Chương 5/6 vừa xóa.

---

## 3. Thiết Kế Bản Vá Chi Tiết (Mục b — Đã Tích Hợp `LK-01..LK-10`)

### 3.1. Mục Vá 1 — Loại Bỏ Bậc 2 & Bậc 3, Chốt Chặn Khóa Kép & Cổng Lũy Đẳng Trong `src/lib/chart-library.ts` (`LK-04`, `LK-05`, `LK-10`)

#### A. Bỏ hoàn toàn Bậc 2 & Bậc 3 và thêm cổng `deletedTombstones` + `No-Op Guard` trong `migrateLegacyHistoryAndDossiers` (`src/lib/chart-library.ts:1232–1409`):
- **Nguyên tắc**:
  1. Chỉ gắn hồ sơ từ `orphanDossiers` (`sessionStorage['ziwei_dossier_v1::*']`) khi **khớp chính xác 100% khóa 9 thành phần (`chartIdentityKey`)** VÀ bản ghi trong `orphanDossiers` có `rec.chartIdentityKey === chartIdentityKey`.
  2. Mọi hồ sơ phiên chưa liên kết (`Unlinked Session Dossiers` — có khóa 5 thành phần cũ hoặc khóa 9 thành phần của người khác không nằm trong `ziwei_history`) được **giữ nguyên tại `sessionStorage`**, không tạo thẻ thư viện rác, không bao giờ gắn sang lá số khác (`LK-04`).
  3. Kiểm tra `store.deletedTombstones`: Nếu một mục trong `ziwei_history` có `chartIdentityKey` nằm trong `deletedTombstones` với `deletedAt >= savedAt`, bỏ qua không di trú lại (chống hồi sinh lá số đã xóa — `LK-05`).
  4. Chỉ gọi `persistDossierToTargets` và `writeLibraryIndexStore` khi thực sự có mục mới (`migratedEntries > 0`) hoặc có chương hồ sơ mới được hợp nhất (`linkedDossiers > 0`), không làm trôi `updatedAt` ở các lần tải lại trang (`LK-05`).

- **Code chuẩn sau vá (`src/lib/chart-library.ts:1260–1408`)**:
```ts
  const tombstoneMap = new Map<string, number>();
  for (const t of store.deletedTombstones) {
    if (t && typeof t.chartIdentityKey === 'string' && typeof t.deletedAt === 'number') {
      tombstoneMap.set(t.chartIdentityKey, t.deletedAt);
    }
  }

  const resolvedItems = legacyEntries.map((item) => ({
    item,
    resolved: resolveChartAndIdentityFromForm(item.form),
  }));

  let migratedEntries = 0;
  let linkedDossiers = 0;
  let summaryUpdatedCount = 0;
  const entryMap = new Map<string, ChartLibraryEntry>(
    store.entries.map((e) => [e.chartIdentityKey, e]),
  );

  for (const { item, resolved } of resolvedItems) {
    const { normalizedForm, chart, chartIdentityKey, legacyFivePartKey } = resolved;
    const savedAt =
      typeof item.savedAt === 'number' && Number.isFinite(item.savedAt)
        ? item.savedAt
        : Date.now();

    // LK-05: Không hồi sinh mục đã bị người dùng xóa vĩnh viễn nhưng còn sót trong ziwei_history
    const deletedAt = tombstoneMap.get(chartIdentityKey);
    if (deletedAt !== undefined && deletedAt >= savedAt && !entryMap.has(chartIdentityKey)) {
      continue;
    }

    // Mục vá 1: CHỈ khớp chính xác 100% khóa định danh 9 thành phần (chartIdentityKey).
    // Tuyệt đối không dùng Bậc 2 (5-part key) hay Bậc 3 (nameSlug / fivePartCount === 1).
    const rawOrphan = orphanDossiers.get(chartIdentityKey) ?? null;
    const exactOrphan =
      rawOrphan && (!rawOrphan.chartIdentityKey || rawOrphan.chartIdentityKey === chartIdentityKey)
        ? rawOrphan
        : null;
    if (exactOrphan) {
      matchedOrphanKeys.add(chartIdentityKey);
    }

    const existingRecord = getBestKnownDossierSync(chartIdentityKey);
    const mergedRecord = exactOrphan
      ? mergeDossierRecords(chartIdentityKey, existingRecord, exactOrphan, chart)
      : existingRecord;

    if (mergedRecord && exactOrphan) {
      const prevSummary = computeDossierSummary(existingRecord);
      const nextSummary = computeDossierSummary(mergedRecord);
      const hasNewerOrMoreContent =
        !existingRecord ||
        nextSummary.completedCount > prevSummary.completedCount ||
        nextSummary.incompleteCount > prevSummary.incompleteCount ||
        (mergedRecord.updatedAt ?? 0) > (existingRecord.updatedAt ?? 0);

      if (hasNewerOrMoreContent) {
        persistDossierToTargets(mergedRecord, chart);
        linkedDossiers += 1;
      }
    }

    const existing = entryMap.get(chartIdentityKey);
    const summary = computeDossierSummary(mergedRecord);
    if (!existing) {
      const nextEntry: ChartLibraryEntry = {
        chartIdentityKey,
        legacyFivePartKey,
        form: normalizedForm,
        customAlias: '',
        notes: '',
        pinned: false,
        pinnedAt: null,
        deterministicBadge: buildLibraryDeterministicBadge(chart),
        dossierSummary: summary,
        createdAt: savedAt,
        updatedAt: Math.max(savedAt, summary.lastGeneratedAt ?? 0),
        notesUpdatedAt: 0,
        lastOpenedAt: savedAt,
      };
      entryMap.set(chartIdentityKey, nextEntry);
      migratedEntries += 1;
    } else if (summary.completedCount > existing.dossierSummary.completedCount) {
      entryMap.set(chartIdentityKey, {
        ...existing,
        dossierSummary: summary,
      });
      summaryUpdatedCount += 1;
    }
  }

  // Nhánh cứu hộ currentForm: cũng CHỈ khớp chính xác khóa 9 thành phần (bỏ legacyFivePartKey)
  if (currentForm && isReasonableBirthForm(currentForm)) {
    const resolved = resolveChartAndIdentityFromForm(currentForm);
    const { chartIdentityKey, legacyFivePartKey, chart, normalizedForm } = resolved;
    const rawCurrentOrphan = !matchedOrphanKeys.has(chartIdentityKey)
      ? (orphanDossiers.get(chartIdentityKey) ?? null)
      : null;
    const orphanCurrent =
      rawCurrentOrphan &&
      (!rawCurrentOrphan.chartIdentityKey || rawCurrentOrphan.chartIdentityKey === chartIdentityKey)
        ? rawCurrentOrphan
        : null;

    if (orphanCurrent) {
      const existingRecord = getBestKnownDossierSync(chartIdentityKey);
      const merged = mergeDossierRecords(
        chartIdentityKey,
        existingRecord,
        orphanCurrent,
        chart,
      );
      if (merged) {
        const prevCount = computeDossierSummary(existingRecord).completedCount;
        const nextCount = computeDossierSummary(merged).completedCount;
        if (!existingRecord || nextCount > prevCount || (merged.updatedAt ?? 0) > (existingRecord.updatedAt ?? 0)) {
          persistDossierToTargets(merged, chart);
          linkedDossiers += 1;
        }
        if (!entryMap.has(chartIdentityKey)) {
          const now = Date.now();
          const summary = computeDossierSummary(merged);
          entryMap.set(chartIdentityKey, {
            chartIdentityKey,
            legacyFivePartKey,
            form: normalizedForm,
            customAlias: '',
            notes: '',
            pinned: false,
            pinnedAt: null,
            deterministicBadge: buildLibraryDeterministicBadge(chart),
            dossierSummary: summary,
            createdAt: now,
            updatedAt: now,
            notesUpdatedAt: 0,
            lastOpenedAt: now,
          });
          migratedEntries += 1;
        }
      }
    }
  }

  if (migratedEntries > 0 || linkedDossiers > 0 || summaryUpdatedCount > 0) {
    const combinedEntries = Array.from(entryMap.values())
      .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
      .slice(0, MAX_LIBRARY_ENTRIES);

    store = {
      ...store,
      entries: combinedEntries,
    };
    writeLibraryIndexStore(store);
  }
```

#### B. Chốt chặn khớp khóa nội bộ trong `readHotDossierFromLocalStorage`, `getBestKnownDossierSync`, `getDossierReadState` và dọn `ziwei_history` khi xóa vĩnh viễn (`LK-05`, `LK-10`):
1. Trong `readHotDossierFromLocalStorage(chartIdentityKey)` (`src/lib/chart-library.ts:769–780`) và nhánh `sessionStorage` của `getBestKnownDossierSync` (`dòng 1021–1032`) / `getDossierReadState` (`dòng 1901–1919`):
   - Kiểm tra `if (parsed.chartIdentityKey && parsed.chartIdentityKey !== chartIdentityKey) return null;` trước khi trả về hoặc truyền vào `sanitizeFullDossierRecord`.
2. Trong `sanitizeFullDossierRecord` (`src/lib/chart-library.ts:824–859`):
   - Với mỗi chương `val = record.sections?.[spec.id]`, nếu `val.sectionCacheKey` đã có dạng `${ownerKey}::${chId}` mà `ownerKey !== canonicalKey` **và** `record.chartIdentityKey === canonicalKey` (tức một chương lẻ ngoại lai bị lẫn vào record), bỏ qua chương ngoại lai đó.
3. Trong `removeLibraryEntry` (`src/lib/chart-library.ts:1851–1868`):
   - Khi `options.deleteMode === 'entry_and_dossier'`, đồng thời lọc bỏ các mục có `resolveChartAndIdentityFromForm(item.form).chartIdentityKey === chartIdentityKey` khỏi `localStorage['ziwei_history']` để gương lịch sử cũ luôn đồng bộ với thao tác xóa của người dùng.
4. **`[POST-PANEL V2 — LK-03 & LK-08]` Bổ sung hàm xóa 1 chương đơn lẻ & hoàn tác xóa hồ sơ trong phiên (`src/lib/chart-library.ts`)**:
   - Thêm `removeSingleDossierChapterFromLibrary(chart: ZiweiChart, chapterId: DossierChapterId): { ok: boolean; previousRecord: StoredDossierRecord | null }` để xóa riêng 1 chương (ví dụ Chương 5 hoặc Chương 6) khỏi `inMemoryDossierMirror`, `IndexedDB`, `localStorage` hot cache, `sessionStorage`, và cập nhật lại `dossierSummary` trong `ziwei_chart_library_v1`.

---

### 3.2. Mục Vá 2 — Khóa Chặt `sectionCacheKey` & `chartIdentityKey` Trong `src/lib/dossier-chat-ui.ts` (`LK-01`, `LK-10`)

#### A. Hàm `resolveDossierChapterFromCaches` (`src/lib/dossier-chat-ui.ts:863–933`):
- Chỉ chấp nhận `localChapters[spec.id]` khi `rawLocal.sectionCacheKey === sectionCacheKey` (`${chartIdentityKey}::${spec.id}`) ở **CẢ nhánh kỳ hạn (`spec.mode === 'period'`) lẫn nhánh thường**.
```ts
export function resolveDossierChapterFromCaches(
  chart: ZiweiChart,
  spec: DossierChapterSpec,
  aiPeriodCache: Record<string, AiPeriodEntry>,
  localChapters: Partial<Record<DossierChapterId, DossierChapterState>>,
): DossierChapterState {
  const chartIdentityKey = buildChartIdentityKey(chart);
  const sectionCacheKey = buildDossierChapterCacheKey(chartIdentityKey, spec.id);
  const rawLocal = localChapters[spec.id];
  // Chốt chặn rò dữ liệu chéo: Bỏ qua hoàn toàn mọi mục trong localChapters không khớp sectionCacheKey của lá số hiện tại
  const matchingLocal =
    rawLocal && rawLocal.sectionCacheKey === sectionCacheKey ? rawLocal : undefined;

  if (spec.mode === 'period' && typeof spec.year === 'number') {
    const pKey = buildPeriodCacheKeyForYear(chart, spec.year);
    const periodEntry = aiPeriodCache[pKey];

    if (matchingLocal?.status === 'loading') {
      return matchingLocal;
    }
    if (periodEntry && hasValidCachedPeriodEntry(periodEntry)) {
      return {
        chapterId: spec.id,
        sectionCacheKey,
        status: 'completed',
        text: sanitizeDossierChapterText(periodEntry.text, spec.id, chart),
        meta: periodEntry.meta,
        sourceBadge:
          matchingLocal?.sourceBadge ?? formatDossierSourceBadge('cache'),
      };
    }
    if (periodEntry?.incomplete) {
      return {
        chapterId: spec.id,
        sectionCacheKey,
        status: 'incomplete',
        incompleteText: sanitizeDossierChapterText(periodEntry.incompleteText, spec.id, chart, {
          skipPeriodSiHuaCheck: true,
        }),
        interruptedReason: periodEntry.interruptedReason || periodEntry.error,
        error: periodEntry.error,
        meta: periodEntry.meta,
        sourceBadge: matchingLocal?.sourceBadge,
      };
    }
    if (periodEntry?.error) {
      return {
        chapterId: spec.id,
        sectionCacheKey,
        status: 'error',
        error: periodEntry.error,
        errorCode: periodEntry.errorCode,
        meta: periodEntry.meta,
      };
    }
  }

  if (matchingLocal) {
    return {
      ...matchingLocal,
      text: sanitizeDossierChapterText(matchingLocal.text, spec.id, chart),
      incompleteText: sanitizeDossierChapterText(matchingLocal.incompleteText, spec.id, chart, {
        skipPeriodSiHuaCheck: true,
      }),
    };
  }

  return {
    chapterId: spec.id,
    sectionCacheKey,
    status: 'idle',
  };
}
```

#### B. Hàm `readDossierCacheEntry` (`src/lib/dossier-chat-ui.ts:286–307` — `LK-10`):
- Kiểm tra `if (stored && stored.chartIdentityKey && stored.chartIdentityKey !== chartIdentityKey) return null;` trước khi trả về bản ghi đọc từ `sessionStorage`.

---

### 3.3. Mục Vá 3 (3A & 3B) — Đặt Lại `localChapters` An Toàn Chống Đua Trong `DetailedDossierModal.tsx` & Xóa Đồng Bộ `aiPeriodCache` Trong `App.tsx` (`LK-06`, `LK-08`, `LK-09`)

#### A. Mục Vá 3A — `src/components/DetailedDossierModal.tsx` (`dòng 161–258`):
- **Giải quyết trọn vẹn `LK-06` & `LK-09`**:
  1. Thêm `open` vào dependency array của `useEffect` nạp hồ sơ (`[open, chartIdentityKey, dossierStorageKey, chart, hydrationStatus, isHydrated, onAiPeriodCacheChange]`).
  2. Khi `isChartChanged === true` (`prevChartKeyRef.current !== chartIdentityKey`):
     - Nếu đang có tiến trình sinh chương của lá số cũ (`autoRunning || activeGeneratingId !== null`), gọi ngay `stopAllGeneration()` để hủy `AbortController` của lá số cũ.
     - Nếu lá số mới chưa có `stored` (kể cả khi `!isHydrated`), lập tức gọi `setLocalChapters({})` — tuyệt đối không giữ `localChapters` của lá số trước trong lúc chờ `IndexedDB`.
  3. Khi `isChartChanged === false` (vẫn trên cùng `chartIdentityKey`, ví dụ `hydrationStatus` vừa chuyển sang `'ready'` hoặc `chart` đổi tham chiếu):
     - Dùng functional update `setLocalChapters((prev) => ...)`:
     - Bỏ qua mọi mục trong `stored.sections` nếu `val.sectionCacheKey` tồn tại nhưng khác `expectedSectionKey` (tuân thủ `ĐC-3`, không hợp thức hóa khóa ngoại lai).
     - Bảo toàn mọi chương trong `prev` có `prevCh.sectionCacheKey === expectedSectionKey` đang ở trạng thái `'loading'` (đang stream SSE) hoặc có `updatedAt` mới hơn `stored` — không bao giờ làm mất chương người dùng đang sinh hoặc vừa sinh xong!
     - Nếu `stored === null && isHydrated`: chỉ giữ lại các chương trong `prev` có `prevCh.sectionCacheKey === expectedSectionKey && prevCh.status === 'loading'` (nếu đang stream chương đầu tiên); toàn bộ các chương cũ đã bị xóa khỏi storage sẽ được dọn sạch về `{}`!

- **Code chuẩn sau vá (`src/components/DetailedDossierModal.tsx:161–258`)**:
```ts
  const prevChartKeyRef = useRef<string>(chartIdentityKey);

  useEffect(() => {
    const isChartChanged = prevChartKeyRef.current !== chartIdentityKey;
    if (isChartChanged) {
      prevChartKeyRef.current = chartIdentityKey;
      setSelectedChapterId('chapter_overview');
      if (autoRunning || activeGeneratingId !== null) {
        stopAllGeneration();
      }
    }

    const readState = getDossierReadState(chartIdentityKey, chart);
    const rawStored =
      readState.record ??
      readDossierCacheEntry(getBrowserSessionStorage(), dossierStorageKey, chart);
    const stored =
      rawStored && rawStored.chartIdentityKey === chartIdentityKey ? rawStored : null;

    if (stored && stored.sections) {
      const fromStorage: Partial<Record<DossierChapterId, DossierChapterState>> = {};
      const periodPatches: Array<{
        periodKey: string;
        text?: string;
        incomplete?: boolean;
        incompleteText?: string;
        interruptedReason?: string;
        error?: string;
        meta?: AiExecutionMeta;
      }> = [];

      for (const [k, val] of Object.entries(stored.sections)) {
        if (!val) continue;
        const chId = k as DossierChapterId;
        const expectedSectionKey = buildDossierChapterCacheKey(chartIdentityKey, chId);
        // LK-06 & ĐC-3: Từ chối mọi chương có sectionCacheKey thuộc về lá số khác
        if (val.sectionCacheKey && val.sectionCacheKey !== expectedSectionKey) {
          continue;
        }
        if (val.status === 'completed' && val.text?.trim()) {
          fromStorage[chId] = {
            ...val,
            sectionCacheKey: expectedSectionKey,
            sourceBadge: formatDossierSourceBadge('cache'),
          };
          if (chId === 'year_2026' || chId === 'year_2027') {
            const yr = chId === 'year_2026' ? 2026 : 2027;
            periodPatches.push({
              periodKey: buildPeriodCacheKeyForYear(chart, yr),
              text: val.text,
              meta: val.meta,
            });
          }
        } else if (val.status === 'incomplete' && val.incompleteText?.trim()) {
          fromStorage[chId] = {
            ...val,
            sectionCacheKey: expectedSectionKey,
            sourceBadge: formatDossierSourceBadge('cache'),
          };
          if (chId === 'year_2026' || chId === 'year_2027') {
            const yr = chId === 'year_2026' ? 2026 : 2027;
            periodPatches.push({
              periodKey: buildPeriodCacheKeyForYear(chart, yr),
              incomplete: true,
              incompleteText: val.incompleteText,
              interruptedReason: val.interruptedReason,
              error: val.error,
              meta: val.meta,
            });
          }
        }
      }

      setLocalChapters((prev) => {
        if (isChartChanged) {
          return fromStorage;
        }
        // LK-06: Khi trên cùng lá số, bảo vệ chương đang 'loading' hoặc chương vừa sinh mới hơn trong phiên
        const merged: Partial<Record<DossierChapterId, DossierChapterState>> = {
          ...fromStorage,
        };
        for (const spec of DOSSIER_CHAPTER_SPECS) {
          const chId = spec.id;
          const expectedKey = buildDossierChapterCacheKey(chartIdentityKey, chId);
          const prevCh = prev[chId];
          if (!prevCh || prevCh.sectionCacheKey !== expectedKey) continue;
          if (prevCh.status === 'loading') {
            merged[chId] = prevCh;
          } else if (
            prevCh.status === 'completed' &&
            prevCh.text?.trim() &&
            (!merged[chId] || (prevCh.updatedAt ?? 0) > (merged[chId]?.updatedAt ?? 0))
          ) {
            merged[chId] = prevCh;
          }
        }
        return merged;
      });

      if (periodPatches.length > 0) {
        onAiPeriodCacheChange((prev) => {
          let changed = false;
          const updated = { ...prev };
          for (const patch of periodPatches) {
            if (patch.text && !hasValidCachedPeriodEntry(updated[patch.periodKey])) {
              updated[patch.periodKey] = {
                text: patch.text,
                meta: patch.meta,
              };
              changed = true;
            } else if (
              patch.incomplete &&
              patch.incompleteText &&
              !hasValidCachedPeriodEntry(updated[patch.periodKey]) &&
              !updated[patch.periodKey]?.incomplete
            ) {
              updated[patch.periodKey] = {
                incomplete: true,
                incompleteText: patch.incompleteText,
                interruptedReason: patch.interruptedReason,
                error: patch.error,
                meta: patch.meta,
              };
              changed = true;
            }
          }
          return changed ? updated : prev;
        });
      }
    } else if (isChartChanged) {
      // Mục vá 3: Khi đổi sang lá số khác chưa có hồ sơ, xóa ngay localChapters của lá số cũ kể cả khi !isHydrated
      setLocalChapters({});
    } else if (isHydrated) {
      // LK-06 & LK-09: Khi đã hydrated trên cùng lá số mà storage rỗng (ví dụ vừa xóa dossier_only),
      // chỉ giữ lại chương đang 'loading' (nếu có) của đúng lá số hiện tại
      setLocalChapters((prev) => {
        const keptLoading: Partial<Record<DossierChapterId, DossierChapterState>> = {};
        for (const spec of DOSSIER_CHAPTER_SPECS) {
          const ch = prev[spec.id];
          const expectedKey = buildDossierChapterCacheKey(chartIdentityKey, spec.id);
          if (ch && ch.sectionCacheKey === expectedKey && ch.status === 'loading') {
            keptLoading[spec.id] = ch;
          }
        }
        return keptLoading;
      });
    }
  }, [
    open,
    chartIdentityKey,
    dossierStorageKey,
    chart,
    hydrationStatus,
    isHydrated,
    autoRunning,
    activeGeneratingId,
    stopAllGeneration,
    onAiPeriodCacheChange,
  ]);
```

#### B. Mục Vá 3B — Đồng bộ xóa `aiPeriodCache` trong `src/App.tsx` (`LK-09`):
- Trong `src/App.tsx`: Tạo hàm `handleRemoveLibraryEntry(targetKey: string, deleteMode: 'dossier_only' | 'entry_and_dossier')`:
  1. Gọi `removeEntry(targetKey, deleteMode)`.
  2. Gọi `setAiPeriodCache((prev) => ...)` xóa mọi khóa bắt đầu bằng `${targetKey}__` khỏi `aiPeriodCache`.
  3. Truyền `handleRemoveLibraryEntry` vào `ChartLibraryModal` (`onRemoveEntry`) và `BirthForm` (`onRemoveHistory`).

---

### 3.4. Mục Vá 4 — Cập Nhật `TEST-L04` & Bổ Sung 5 Bài Test Mới `TEST-L13..TEST-L17` (`scripts/verify-chart-library.ts`)
- Chi tiết đặc tả tại **Mục 5** bên dưới.

---

## 4. Phương Án Xử Lý Dữ Liệu Đã Nhiễm Trong Trình Duyệt Người Dùng (Mục c — Đã Tối Ưu Hóa Theo `LK-03`, `LK-07`, `LK-08`, `LK-09`)

### 4.1. Tại sao Tổ Chuyên Gia bác bỏ việc tự động xóa ngầm chương trùng văn bản (`LK-03`)?
1. Khi `migrateLegacyHistoryAndDossiers` gắn nhầm hồ sơ của Người A sang Người B ở bản `1.2.0-rc.1`, `sanitizeFullDossierRecord` (`src/lib/chart-library.ts:850`) giữ nguyên `section.updatedAt` của chương gốc (`sectionA.updatedAt === sectionB.updatedAt`).
2. Nếu Người A ban đầu đã rơi khỏi top-10 `ziwei_history` (nên chưa có mặt trong `ziwei_chart_library_v1`) và chỉ được người dùng lập lại sau khi đã lập lá số cho Người B, thì `entryA.createdAt > entryB.createdAt`. Mọi thuật toán tự động gỡ chương khỏi "bản ghi tạo muộn hơn" sẽ **xóa nhầm chính hồ sơ của chủ thật (Người A)**!
3. Ngoài ra, hai bản ghi hợp lệ (người dùng sửa lại cách gõ tên hoặc chỉnh vài phút sinh trong cùng 1 canh giờ rồi nhập/gộp `.JSON`) cũng có văn bản chương giống nhau `>= 200` ký tự.

### 4.2. Giải pháp Chủ động, Chính xác & Có Hoàn Tác (`Phương án B tăng cường — C1+`)
Thay vì tự động xóa ngầm có rủi ro mất dữ liệu thật, bản `1.2.0-rc.2` cung cấp **2 công cụ dọn sạch tức thì kèm Hoàn tác trong phiên (`LK-08`, `LK-09`)**:
1. **Dọn cấp Hồ Sơ (cho lá số mới chưa sinh chương nào nhưng bị dính Chương 5/6 của người khác)**:
   - Người dùng mở **Thư Viện** (`ChartLibraryModal`) $\rightarrow$ bấm **Xóa** ở lá số mới $\rightarrow$ chọn **"Chỉ xóa Hồ Sơ (giữ Lá Số & Ghi chú)"** (`deleteMode: 'dossier_only'`).
   - Với bản vá `LK-09`, thao tác này xóa sạch hồ sơ ở cả 4 tầng lưu trữ **VÀ xóa ngay `aiPeriodCache` + `localChapters`** của lá số đó mà không cần tải lại trang.
2. **Dọn cấp từng Chương lẻ (nếu lá số mới đã có Chương 1 hợp lệ nhưng bị dính Chương 5/6 của người khác)**:
   - Ngay trong `DetailedDossierModal`, trên thanh tiêu đề của chương đã có nội dung, người dùng có thể bấm **"Tạo lại chương này"** (sinh đè bằng luận giải đúng của lá số mới) hoặc bấm nút **"Xóa chương này"** (`removeSingleDossierChapterFromLibrary`) để xóa riêng Chương 5 hoặc Chương 6 về trạng thái `'idle'` kèm nút **"Hoàn tác"** trong phiên.

---

## 5. Kế Hoạch Kiểm Thử Hồi Quy (Mục d — Phủ Đủ `TEST-L01..TEST-L17` Theo `LK-01` & `LK-02`)

### 5.1. Cập nhật `TEST-L04` hiện có (`scripts/verify-chart-library.ts:331–367` — `LK-02`)
- **Lý do sửa**: `TEST-L04` cũ kiểm thử hành vi Bậc 2 (gắn hồ sơ khóa 5 thành phần `1988_7_19_7_male` vào lá số 9 thành phần `canonicalKey`). Khi bỏ Bậc 2 và Bậc 3, 4 khẳng định ở dòng `359–366` phải đổi sang kiểm chứng tính cô lập an toàn.
- **Đặc tả mới của `TEST-L04`**:
  - Đầu vào: Mục lịch sử `Đỗ Hoàng Nam` (`canonicalKey` 9 thành phần) trong `ziwei_history` + bản ghi `legacy5PartDossier` mang khóa 5 thành phần `fivePartKey = '1988_7_19_7_male'` trong `sessionStorage`.
  - Khẳng định sau `await initChartLibrary()`:
    1. `assert.equal(store.entries.length, 1);`
    2. `assert.equal(store.entries[0].chartIdentityKey, canonicalKey);`
    3. `assert.equal(store.entries[0].dossierSummary.completedCount, 0);` *(không gắn mù khóa 5 thành phần)*
    4. `assert.deepEqual(store.entries[0].dossierSummary.completedChapterIds, []);`
    5. `assert.equal(await idb.get(canonicalKey), null);`
    6. `assert.ok(ss.getItem(buildDossierStorageKey(fivePartKey)));` *(hồ sơ phiên chưa liên kết vẫn nằm nguyên trong `sessionStorage`, không bị xóa mất)*.

### 5.2. Đặc tả 5 bài kiểm thử hồi quy mới (`TEST-L13` → `TEST-L17` — `LK-01`)

| Mã Test | Kịch bản kiểm thử độc lập | Dữ kiện đầu vào (Fixtures) | Khẳng định bắt buộc (Assertions) |
|---|---|---|---|
| **`TEST-L13`** | **(i) Di trú trùng khóa 5 thành phần với nhóm duy nhất trong lịch sử (`fivePartCount === 1`)** | - Người A (`Nguyễn Văn A`, `16/08/1995`, `10:30`, Nam, Hà Nội) có hồ sơ Chương 5 (`year_2026`) và Chương 6 (`year_2027`) hoàn chỉnh trong `sessionStorage` dưới khóa 9 thành phần `keyA` (và một bản khóa 5 thành phần `1995_8_16_5_male`), nhưng Người A **đã rơi khỏi top-10 `ziwei_history`**.<br>- Người B (`Trần Văn B`, cùng sinh `16/08/1995`, `10:35`, Nam, TP.HCM — có cùng `legacyFivePartKey = '1995_8_16_5_male'`) là mục **duy nhất** trong `ziwei_history` (`fivePartCount === 1`). | - Sau `await initChartLibrary(formB)`: mục thư viện của Người B có `dossierSummary.completedCount === 0`.<br>- `getDossierReadState(keyB, chartB).record === null`.<br>- `buildPeriodCachePatchesFromLibrary(chartB)` trả về `{}`.<br>- Bản ghi gốc của Người A trong `sessionStorage` (`keyA`) còn nguyên vẹn, không bị đổi khóa sang `keyB`. |
| **`TEST-L14`** | **(ii) Di trú trùng `nameSlug` (kể cả chuỗi con và tên rỗng `'anon'`)** | - **Ca A (Trùng `nameSlug` / chuỗi con)**: Người C1 (`name: 'An'`, `nameSlug = 'an'`, sinh `20/10/1992`, `08:15`, Nữ, Hà Nội) và Người C2 (`name: 'An'`, cùng ngày/canh giờ/giới tính nhưng sinh `08:45` tại Đà Nẵng, `longitude: 108.22`). Hồ sơ Chương 5/6 của C1 nằm trong `sessionStorage` (`keyC1`), chỉ có C2 trong `ziwei_history`.<br>- **Ca B (Tên rỗng `'anon'`)**: Người D1 (`name: ''`, `nameSlug = 'anon'`, `08:15`, Hà Nội) có hồ sơ Chương 5/6 trong `sessionStorage` (`keyD1`); Người D2 (`name: ''`, `nameSlug = 'anon'`, `08:45`, Đà Nẵng) nằm trong `ziwei_history`. | - Sau `migrateLegacyHistoryAndDossiers(formD2)`: cả C2 và D2 đều có `dossierSummary.completedCount === 0`, `getDossierReadState(keyC2, chartC2).record === null`, `getDossierReadState(keyD2, chartD2).record === null`.<br>- Hồ sơ gốc `keyC1` và `keyD1` trong `sessionStorage` giữ nguyên khóa gốc. |
| **`TEST-L15`** | **(iii) Đổi lá số lúc `IndexedDB` chưa hydrated (`hydrating`) không rò chương cũ & không làm mất chương ghi mới** | - Cài `idb.gatePromise` giữ `getLibraryHydrationStatus() === 'hydrating'`.<br>- Lá số A (`chartA`, `keyA`) đã có Chương 5 & 6 trong phiên; người dùng lập và chuyển sang lá số mới B (`chartB`, `keyB`) ngay trong lúc `hydrationStatus === 'hydrating'`.<br>- Kiểm tra cả trạng thái trước khi nhả cổng `releaseIdbGate()` và sau khi nhả cổng. | - Trước khi nhả cổng: `getDossierReadState(keyB, chartB)` trả về `isHydrated === false`, `hydrationStatus === 'hydrating'`, `record === null`.<br>- `buildPeriodCachePatchesFromLibrary(chartB)` trả về `{}`.<br>- `resolveDossierChapterFromCaches(chartB, spec, {}, staleLocalChaptersOfA)` trả về `status: 'idle'` cho cả 8 chương.<br>- Sau khi nhả `releaseIdbGate()`: `chartB` vẫn `0/8` chương sạch sẽ, trong khi `chartA` giữ nguyên Chương 5 & 6. |
| **`TEST-L16`** | **(iv) `resolveDossierChapterFromCaches` bỏ qua `localChapters` lệch `sectionCacheKey` ở CẢ nhánh kỳ hạn VÀ nhánh thường** | - Tạo `chartA` (`keyA`) và `chartB` (`keyB`, `keyA !== keyB`).<br>- Tạo `foreignLocalChapters` chứa đủ các chương mang `sectionCacheKey: "${keyA}::${chapterId}"` ở cả 3 trạng thái `'completed'`, `'incomplete'`, và `'loading'` cho cả nhánh kỳ hạn (`year_2026`, `year_2027`) và nhánh thường (`chapter_overview`, `palaces_core`, `horizon_5y`). | - Khi gọi `resolveDossierChapterFromCaches(chartB, spec, {}, foreignLocalChapters)` cho cả 8 chương `DOSSIER_CHAPTER_SPECS`: toàn bộ 8/8 chương đều trả về `status === 'idle'`, `text === undefined`, `incompleteText === undefined`, `sectionCacheKey === "${keyB}::${spec.id}"`.<br>- Khi gọi với `chartA`: trả về đúng trạng thái `'completed'` / `'incomplete'` / `'loading'` của `chartA`. |
| **`TEST-L17`** | **(v) Xóa `dossier_only` / xóa chương lẻ & chống hồi sinh mục đã xóa từ `ziwei_history` (`LK-05`, `LK-08`, `LK-09`)** | - Tạo `chartX` có 3 chương (`chapter_overview`, `year_2026`, `year_2027`).<br>- B1: Gọi `removeSingleDossierChapterFromLibrary(chartX, 'year_2026')` $\rightarrow$ kiểm tra còn 2 chương.<br>- B2: Gọi `removeLibraryEntry(keyX, { deleteMode: 'dossier_only' })` $\rightarrow$ kiểm tra `completedCount === 0` và `buildPeriodCachePatchesFromLibrary(chartX)` rỗng.<br>- B3: Gọi `removeLibraryEntry(keyX, { deleteMode: 'entry_and_dossier' })` rồi gọi lại `migrateLegacyHistoryAndDossiers()` $\rightarrow$ kiểm tra `keyX` không bị hồi sinh từ `ziwei_history`. | - Sau B1: `year_2026` bị gỡ khỏi cả 4 tầng, `chapter_overview` và `year_2027` còn nguyên (`completedCount === 2`).<br>- Sau B2: Thẻ `keyX` vẫn còn trong thư viện nhưng `completedCount === 0`, `getDossierReadState(keyX, chartX).record === null`.<br>- Sau B3 + `migrateLegacyHistoryAndDossiers()`: `keyX` không xuất hiện lại trong `readLibraryIndexStore().entries`. |

---

## 6. Đối Chiếu Rủi Ro Hồi Quy Với `ĐC-1..ĐC-6` & `QĐ-L1..QĐ-L9` (Mục e)

| Mã quy định | Nội dung quy định gốc | Đánh giá nguy cơ & Biện pháp bảo vệ trong bản POST-PANEL V2 | Kiểm thử đối chứng |
|---|---|---|---|
| **`ĐC-1`** | Cổng nạp dữ liệu (`Hydration Gate`): Không kết luận `0/8` trước khi `IndexedDB` nạp xong; không sinh đè; xếp hàng ghi khi đang hydrating. | Khi đổi lá số (`isChartChanged`), xóa ngay `localChapters` của lá số cũ nhưng vẫn giữ nguyên cổng khóa nút sinh (`disabled={!isHydrated \|\| isAnyBusy}`) và thông báo *"Đang nạp từ IndexedDB..."*. Khi trên cùng lá số (`!isChartChanged`), giữ nguyên chương đang `'loading'` hoặc vừa sinh mới (`LK-06`). | `TEST-L11`, `TEST-L15` |
| **`ĐC-2`** | Thu hồi an toàn: Nấc 3–4 chỉ xóa sau khi tự động tải `.JSON` backup + hoàn tác trong phiên. Không đường nào xóa lặng mục có hồ sơ. | Bác bỏ hoàn toàn việc tự động xóa ngầm chương trùng văn bản (`LK-03`); chỉ xóa khi người dùng chủ động thao tác và có snapshot hoàn tác trong phiên (`LK-08`). | `TEST-L08`, `TEST-L17` |
| **`ĐC-3`** | Nguồn Sự Thật Duy Nhất (`SSOT`): `IndexedDB` + gương RAM thắng `sessionStorage`. | Ngăn `migrateLegacyHistoryAndDossiers` bơm hồ sơ lệch khóa từ `sessionStorage` vào `IndexedDB`/RAM; kiểm tra `parsed.chartIdentityKey === chartIdentityKey` trước khi `sanitizeFullDossierRecord` (`LK-10`); không ghi đè `sectionCacheKey` ngoại lai trong `DetailedDossierModal` (`LK-06`). | `TEST-L05`, `TEST-L13`, `TEST-L14`, `TEST-L16` |
| **`ĐC-4`** | Chế độ suy giảm khi `IndexedDB` bị chặn (`degraded_no_idb`). | Không thay đổi luồng feature-detect `IndexedDB`. | `TEST-L12` |
| **`ĐC-5`** | `normalizeBirthFormForLibrary` không cắt `form.name` và không làm lệch khóa. | Không chạm vào `normalizeBirthFormForLibrary` hay `buildChartIdentityKey`. | `TEST-L01` |
| **`QĐ-L1..L7`** | Kiến trúc 2 tầng client, trần 100/30, bất biến `form.name`, xóa 2 bước, giữ nguyên `server.ts`. | Tuân thủ 100%; cập nhật `QĐ-L2` trong sổ cái quyết định: di trú chỉ khớp exact 9-part `chartIdentityKey`. | `TEST-L01..L10` |
| **`QĐ-L8`** | Xử lý dữ liệu đã nhiễm trên trình duyệt người dùng. | Chốt Phương án B tăng cường (`C1+`): Không tự động xóa ngầm; dùng xóa chủ động cấp Hồ Sơ (`dossier_only` đã vá `LK-09`) + cấp từng Chương (`removeSingleDossierChapterFromLibrary`) kèm Hoàn tác trong phiên (`LK-08`). | `TEST-L17` |
| **`QĐ-L9`** | Cơ chế chạy `migrateLegacyHistoryAndDossiers`. | Chốt Phương án A có cổng bảo vệ lũy đẳng (`LK-05`): Chỉ khớp exact 9-part key, kiểm tra `deletedTombstones`, và chỉ ghi khi có mục/chương mới thực sự. | `TEST-L03`, `TEST-L04`, `TEST-L17` |

---

## 7. Đề Xuất Phiên Bản Mới & Danh Mục Tài Liệu Sống Cần Cập Nhật Khi Thi Công (Mục f)

Khi gói vá được duyệt và triển khai ở lượt tiếp theo:
1. **Phiên bản**:
   - `/VERSION`: nâng từ `1.2.0-rc.1` lên **`1.2.0-rc.2`**.
   - `/package.json`: giữ `"version": "1.2.0"` (theo chuẩn `ĐC-6`).
   - Không tạo thư mục `backup/` mới và không đẩy GitHub.
2. **Tài liệu sống cập nhật đồng bộ**:
   - `/CHANGELOG.md`: Thêm mục **`[1.2.0-rc.2]`** ghi nhận bản vá chống rò dữ liệu chéo Chương 5/6 (`LK-01..LK-10`) và bộ test `17/17`.
   - `docs/decisions-registry.md`: Cập nhật `QĐ-L2` và bổ sung `QĐ-L8`, `QĐ-L9`.
   - `docs/features-dossier-and-chat.md`: Cập nhật Mục `6.3` theo cơ chế di trú exact 9-part key, chốt chặn `sectionCacheKey`, và xóa chương lẻ / đồng bộ `aiPeriodCache`.
   - `docs/chart-library-implementation-notes.md`: Cập nhật lên `1.2.0-rc.2` kèm kết quả chạy thực tế `17/17` của `verify:library`.
   - `docs/INDEX.md`: Đồng bộ phiên bản `1.2.0-rc.2` và đăng ký 2 tài liệu `docs/chart-library-cross-chart-leak-fix-plan.md` (POST-PANEL V2) và `docs/chart-library-cross-chart-leak-expert-panel-review.md`.

---

## 8. Điểm Xác Nhận Cuối Cùng Trước Khi Thi Công (Mục g)

Sau vòng phản biện của Tổ Chuyên Gia 5 Vai, cả **`QĐ-L8`** (Phương án B tăng cường `C1+` — không tự động xóa ngầm, dọn chủ động cấp Hồ Sơ / cấp Chương có hoàn tác) và **`QĐ-L9`** (Phương án A có cổng bảo vệ `deletedTombstones` & `No-Op Guard`) đã đạt đồng thuận 5/5.

Chủ dự án chỉ cần chốt xác nhận 1 lựa chọn nhỏ về giao diện của `QĐ-L8`:
- **Lựa chọn 1 (`C1+` — Khuyến nghị của Tổ chuyên gia)**: Triển khai đầy đủ المục vá 1–4 (kèm vá `LK-09` xóa đồng bộ `aiPeriodCache` khi bấm *"Chỉ xóa Hồ Sơ"* trong `ChartLibraryModal`) **CỘNG VỚI** thêm nút nhỏ **"Xóa chương này"** (`removeSingleDossierChapterFromLibrary` kèm Hoàn tác trong phiên) ngay trong `DetailedDossierModal` để người dùng có thể xóa riêng Chương 5 hoặc Chương 6 bị nhiễm mà không mất các chương khác.
- **Lựa chọn 2 (`C1` tối giản)**: Triển khai đầy đủ Mục vá 1–4 (kèm vá `LK-09` cho nút *"Chỉ xóa Hồ Sơ"* sẵn có trong `ChartLibraryModal`), không thêm nút xóa từng chương lẻ trong `DetailedDossierModal`.
