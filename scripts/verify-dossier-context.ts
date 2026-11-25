import assert from 'assert';
import express from 'express';
import type { AddressInfo } from 'net';

process.env.ZIWEI_DISABLE_AUTO_LISTEN = '1';

import { generateChart } from '../src/lib/ziwei/algorithm.ts';
import { PALACE_NAMES_ORDER } from '../src/lib/ziwei/constants.ts';
import { translatePalaceName, formatChartSummaryVi } from '../src/lib/ziwei/vi-i18n.ts';
import {
  buildYunxianPeriodContext,
  formatPeriodSiHuaFactLine,
} from '../src/lib/ziwei/yunxian-context.ts';
import {
  DOSSIER_PALACE_GROUPS,
  VALID_DOSSIER_SECTION_IDS,
  buildChatFactTableForContextVi,
  buildDossierSectionFactSheetVi,
  buildMultiYearHorizonContext,
  buildNatalOverviewFactSheetVi,
  buildPalaceGroupFactSheetVi,
  periodCtxLabelDynStars,
} from '../src/lib/ziwei/dossier-context.ts';
import {
  CHAT_MAX_EXCERPT_LEN,
  CHAT_MAX_HISTORY_MESSAGES,
  CHAT_MAX_HISTORY_MSG_LEN,
  CHAT_MAX_QUESTION_LEN,
  buildStrictDossierSectionPrompt,
  buildStrictExplanationChatPrompt,
  buildStrictPeriodAiPrompt,
  registerApiRoutes,
  sanitizeChatHistoryAndExcerpt,
} from '../server.ts';

async function runTests() {
  console.log('=== KIỂM THỬ XÁC ĐỊNH DOSSIER CONTEXT, HORIZON MATRIX & HTTP ROUTE GUARDS (PHA 2) ===');

  const adultChart = generateChart({
    name: 'Steve Jobs',
    year: 1955,
    month: 2,
    day: 24,
    hour: 6,
    gender: 'male',
  });

  const childChart = generateChart({
    name: 'Bé Mẫu 2024',
    year: 2024,
    month: 6,
    day: 15,
    hour: 4,
    gender: 'male',
  });

  // ── BÀI 1: Phủ đủ 12 cung qua 3 nhóm v1 (Quyết định F2) + Tiền tố tầng Tứ Hóa ─
  {
    console.log('\n[1/5] Kiểm thử 3 nhóm cung v1 (F2) phủ đủ 12 cung, 0 trùng, 0 sót & tiền tố tầng...');
    assert.deepStrictEqual(DOSSIER_PALACE_GROUPS.core.palaceKeys, ['命', '官禄', '财帛', '迁移']);
    assert.deepStrictEqual(DOSSIER_PALACE_GROUPS.family.palaceKeys, ['夫妻', '子女', '田宅', '福德']);
    assert.deepStrictEqual(DOSSIER_PALACE_GROUPS.social_health.palaceKeys, ['父母', '兄弟', '交友', '疾厄']);

    const core = buildPalaceGroupFactSheetVi(adultChart, 'core');
    const family = buildPalaceGroupFactSheetVi(adultChart, 'family');
    const social = buildPalaceGroupFactSheetVi(adultChart, 'social_health');

    assert.strictEqual(core.palaces.length, 4);
    assert.strictEqual(family.palaces.length, 4);
    assert.strictEqual(social.palaces.length, 4);

    assert.deepStrictEqual(
      core.palaces.map((p) => p.natalPalaceNameVi),
      ['Mệnh Cung', 'Quan Lộc', 'Tài Bạch', 'Thiên Di'],
    );
    assert.deepStrictEqual(
      family.palaces.map((p) => p.natalPalaceNameVi),
      ['Phu Thê', 'Tử Nữ', 'Điền Trạch', 'Phúc Đức'],
    );
    assert.deepStrictEqual(
      social.palaces.map((p) => p.natalPalaceNameVi),
      ['Phụ Mẫu', 'Huynh Đệ', 'Giao Hữu', 'Tật Ách'],
    );

    const allBranches = new Set([
      ...core.palaces.map((p) => p.branch),
      ...family.palaces.map((p) => p.branch),
      ...social.palaces.map((p) => p.branch),
    ]);
    assert.strictEqual(allBranches.size, 12, '3 nhóm cung phải phủ đủ cả 12 địa chi, 0 trùng, 0 sót');

    const overview = buildNatalOverviewFactSheetVi(adultChart);
    assert.ok(overview.factSheetMarkdown.includes('[Tứ Hóa Bản Mệnh - Can'));
    assert.strictEqual(overview.natalSiHuaTags.length, 4);
    assert.ok(overview.factSheetMarkdown.includes('[Bản cung]'));
    assert.ok(overview.factSheetMarkdown.includes('[Tam hợp (+4)]'));
    assert.ok(overview.factSheetMarkdown.includes('[Tam hợp (+8)]'));
    assert.ok(overview.factSheetMarkdown.includes('[Xung chiếu (+6)]'));
    const patternSectionCount = (overview.factSheetMarkdown.match(/\[CÁCH CỤC NHẬN DIỆN TỪ ENGINE/g) ?? []).length;
    assert.strictEqual(patternSectionCount, 1, 'Không trùng lặp mục cách cục patterns.ts');

    const combinedMarkdown = `${core.factSheetMarkdown}\n${family.factSheetMarkdown}\n${social.factSheetMarkdown}`;
    assert.ok(combinedMarkdown.includes('[Tứ Hóa Bản Mệnh - Can'));
    assert.ok(combinedMarkdown.includes('[Tự Hóa Can Cung') || combinedMarkdown.includes('[Phi Tinh Can Cung'));
    console.log('  -> Đạt: 3 nhóm F2 phủ đủ 12 cung (4+4+4 = 12), Tam Phương Tứ Chính tường minh & tiền tố tầng Tứ Hóa.');
  }

  // ── BÀI 2: Ma trận đa năm 2026–2030 (5 năm) & 2026–2035 (10 năm) đủ 8 nhóm trường ─
  {
    console.log('\n[2/5] Kiểm thử buildMultiYearHorizonContext 5 năm & 10 năm đủ 8 nhóm trường + 4 Lưu Hóa...');
    const h5 = buildMultiYearHorizonContext(adultChart, 2026, 2030);
    const h10 = buildMultiYearHorizonContext(adultChart, 2026, 2035);

    assert.strictEqual(h5.rows.length, 5, 'Khoảng 2026–2030 phải trả về đúng 5 dòng năm');
    assert.strictEqual(h10.rows.length, 10, 'Khoảng 2026–2035 phải trả về đúng 10 dòng năm');
    assert.ok(h10.daXianTransitions.length >= 1, 'Lá số sinh năm 1955 phải phát hiện mốc chuyển Đại Hạn trong 2026–2035');

    for (const row of h10.rows) {
      // (1) Năm + Can Chi
      assert.ok(row.year >= 2026 && row.year <= 2035);
      assert.ok(row.lunarGanZhiVi.length >= 4);
      // (2) Tuổi danh nghĩa
      assert.ok(Number.isInteger(row.nominalAge) && row.nominalAge > 0);
      // (3) Đại Hạn chủ quản
      assert.ok(row.governingDaXian.labelVi.length > 0);
      // (4) Quan hệ Đại Hạn – Lưu Niên
      assert.ok(row.daXianLiuNianRelationVi.length > 0);
      // (5) Cung Bản Mệnh kích hoạt
      assert.ok(row.activatedPalace.natalPalaceNameVi.length > 0);
      assert.ok(row.activatedPalace.majorStarsVi.length > 0);
      // (6) Đủ 4 Lưu Tứ Hóa (Lộc / Quyền / Khoa / Kỵ)
      assert.strictEqual(row.liuNianSiHua.allFour.length, 4, `Năm ${row.year} phải có đủ 4 Lưu Tứ Hóa`);
      assert.deepStrictEqual(
        row.liuNianSiHua.allFour.map((s) => s.mutagenKey),
        ['禄', '权', '科', '忌'],
      );
      for (const sh of row.liuNianSiHua.allFour) {
        assert.ok(sh.layerPrefix.includes(`[Tứ Hóa Lưu Niên ${row.year} - Can`));
        assert.ok(sh.starNameVi.length > 0);
        assert.ok(sh.natalPalaceNameVi.length > 0);
        assert.ok(sh.oppositePalaceNameVi.length > 0);
      }
      // (7) Sao lưu động chính
      assert.ok(row.dynamicStars.length >= 10, `Năm ${row.year} phải có các sao lưu động từ engine`);
      assert.ok(row.dynamicStarsSummaryVi.includes('Lộc Tồn'));
      // (8) Cờ xung hợp nổi bật (mảng xác định)
      assert.ok(Array.isArray(row.highlightFlags));
    }
    console.log('  -> Đạt: 2026–2030 (5 dòng) & 2026–2035 (10 dòng) đủ cả 8 nhóm trường + đủ 4 Lưu Hóa + mốc chuyển Đại Hạn.');
  }

  // ── BÀI 3: Lá số trẻ em chưa vào Đại Hạn (effDxIdx === -1) ─────────────────
  {
    console.log('\n[3/5] Kiểm thử an toàn cho lá số trẻ em (2024) chưa vào Đại Hạn ở giai đoạn 2026–2030...');
    const firstStartAge = childChart.daXians[0]?.startAge ?? 5;
    assert.ok(firstStartAge >= 3, `Lá số 2024 khởi Đại Hạn từ ${firstStartAge} tuổi`);

    const childHorizon = buildMultiYearHorizonContext(childChart, 2026, 2030);
    assert.strictEqual(childHorizon.rows.length, 5);
    const year2026 = childHorizon.rows[0];
    assert.strictEqual(year2026.year, 2026);
    assert.strictEqual(year2026.governingDaXian.daXianIndex, -1);
    assert.strictEqual(year2026.governingDaXian.isPreDaXian, true);
    assert.ok(
      year2026.governingDaXian.labelVi.includes('chưa vào Đại Hạn'),
      'Năm chưa vào Đại Hạn phải ghi rõ "chưa vào Đại Hạn"',
    );
    assert.ok(
      childHorizon.factSheetMarkdown.includes('chưa vào Đại Hạn'),
      'Fact sheet đa năm phải ghi rõ chưa vào Đại Hạn chứ không tự bịa cung Đại Hạn',
    );
    console.log('  -> Đạt: Lá số trẻ em chưa vào Đại Hạn chạy sạch không lỗi và ghi rõ "chưa vào Đại Hạn".');
  }

  // ── BÀI 4: Kiểm thử sàn độ dài & luật chống bịa trong Prompt Builders & Cắt tỉa Chat ─
  {
    console.log('\n[4/5] Kiểm thử prompt builders & quy tắc cắt tỉa chat (6 tin / 1200 ký tự / excerpt 6000)...');
    for (const sectionId of VALID_DOSSIER_SECTION_IDS) {
      const ctx = buildDossierSectionFactSheetVi(adultChart, sectionId);
      assert.ok(ctx.factSheetMarkdown.length > 200);
    }

    const corePrompt = buildStrictDossierSectionPrompt(adultChart, 'palaces_core');
    assert.ok(corePrompt.systemInstruction.includes('250–350 từ MỖI cung'));
    assert.ok(corePrompt.systemInstruction.includes('1,000–1,400 từ'));
    assert.ok(corePrompt.systemInstruction.includes('Mệnh Cung'));
    assert.ok(corePrompt.systemInstruction.includes('Giao Hữu') === false);

    const horizonPrompt = buildStrictDossierSectionPrompt(adultChart, 'horizon_10y');
    assert.ok(horizonPrompt.systemInstruction.includes('750–1,100 từ'));
    assert.ok(horizonPrompt.systemInstruction.includes('TUYỆT ĐỐI CẤM tự tính nhẩm'));

    const overLongExcerpt = 'A'.repeat(7_500);
    const overHistory = Array.from({ length: 10 }, (_, idx) => ({
      role: idx % 2 === 0 ? 'user' : 'assistant',
      content: `Tin ${idx}: ` + 'B'.repeat(1_500),
    }));
    const trimmed = sanitizeChatHistoryAndExcerpt({
      excerpt: overLongExcerpt,
      history: overHistory,
    });
    assert.strictEqual(trimmed.excerpt.length, CHAT_MAX_EXCERPT_LEN, 'Excerpt phải bị cắt tối đa 6000 ký tự');
    assert.strictEqual(trimmed.history.length, CHAT_MAX_HISTORY_MESSAGES, 'Lịch sử chỉ giữ tối đa 6 tin gần nhất');
    assert.ok(
      trimmed.history.every((m) => m.content.length <= CHAT_MAX_HISTORY_MSG_LEN),
      'Mỗi tin trong lịch sử phải <= 1200 ký tự',
    );

    const chatPrompt = buildStrictExplanationChatPrompt({
      chart: adultChart,
      contextMode: 'natal',
      sectionTitle: 'Nhóm 1 — Trục Cốt Lõi',
      excerpt: 'Cung Mệnh có Phá Quân cư Ngọ.',
      history: trimmed.history,
      question: 'Tài Bạch năm 2026 nên chú ý điều gì?',
    });
    assert.ok(chatPrompt.systemInstruction.includes('150–350 từ'));
    assert.ok(chatPrompt.systemInstruction.includes('KHÔNG CÓ CƠ SỞ'));
    console.log('  -> Đạt: Prompt chứa đủ sàn độ dài, rào chống bịa và cắt tỉa chat chuẩn xác.');
  }

  // ── BÀI 5: Kiểm thử HTTP Route Rejection (HTTP 400, 0 lượt gọi AI) ────────
  {
    console.log('\n[5/5] Kiểm thử HTTP 400 từ chối input sai trên /api/interpret-dossier-section & /api/interpret-chat...');
    const app = express();
    registerApiRoutes(app);

    const server = await new Promise<ReturnType<express.Express['listen']>>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });

    try {
      const port = (server.address() as AddressInfo).port;
      const baseUrl = `http://127.0.0.1:${port}`;

      // 1) sectionId không hợp lệ (ví dụ year_2026) -> 400
      const resBadSection = await fetch(`${baseUrl}/api/interpret-dossier-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chart: adultChart, sectionId: 'year_2026' }),
      });
      assert.strictEqual(resBadSection.status, 400, 'sectionId không hợp lệ phải trả về HTTP 400');
      const bodyBadSection = (await resBadSection.json()) as { error: string };
      assert.strictEqual(bodyBadSection.error, 'INVALID_INPUT');

      // 2) Thiếu chart -> 400
      const resNoChart = await fetch(`${baseUrl}/api/interpret-dossier-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId: 'chapter_overview' }),
      });
      assert.strictEqual(resNoChart.status, 400, 'Thiếu chart phải trả về HTTP 400');

      // 3) Chat câu hỏi rỗng -> 400
      const resEmptyQ = await fetch(`${baseUrl}/api/interpret-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chart: adultChart, question: '   ' }),
      });
      assert.strictEqual(resEmptyQ.status, 400, 'Câu hỏi rỗng phải trả về HTTP 400');

      // 4) Chat câu hỏi vượt quá 400 ký tự -> 400
      const resTooLongQ = await fetch(`${baseUrl}/api/interpret-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chart: adultChart,
          question: 'X'.repeat(CHAT_MAX_QUESTION_LEN + 1),
        }),
      });
      assert.strictEqual(resTooLongQ.status, 400, 'Câu hỏi > 400 ký tự phải trả về HTTP 400');
      const bodyTooLongQ = (await resTooLongQ.json()) as { error: string };
      assert.strictEqual(bodyTooLongQ.error, 'INVALID_INPUT');

      console.log('  -> Đạt: Cả 2 route mới đều trả HTTP 400 tức thì (0 call AI) khi input sai/vượt ngưỡng.');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  // ── BÀI 6 (PHA 1 — TEST-3): Bảng 12 cung Lưu Niên, oppositePeriodPalaceRoleVi & Ma trận Ch.7/8 (S2 / QĐ-G3) ─
  {
    console.log('\n[6/6] [TEST-3] Kiểm thử Nguyễn Văn An (16/08/1995): 12 cung Lưu năm 2027 & MultiYearSiHuaEntry Ch.7/8...');
    const anChart = generateChart({
      name: 'Nguyễn Văn An',
      year: 1995,
      month: 8,
      day: 16,
      hour: 5, // Giờ Tỵ (10:30 tại Hà Nội) -> Mệnh Cung tại Mão
      gender: 'male',
      longitude: 105.85,
    });

    const ctx2027 = buildYunxianPeriodContext(anChart, { mode: 'liunian', year: 2027 });
    assert.ok(ctx2027, 'Phải tạo được YunxianPeriodContext năm 2027');
    assert.ok(
      ctx2027.factTableMarkdown.includes('[Bảng Ánh Xạ Đầy Đủ 12 Cung Kỳ Hạn ↔ 12 Cung Bản Mệnh Gốc (Tra Cứu Bắt Buộc)]'),
      'factTableMarkdown phải có bảng ánh xạ đầy đủ 12 cung kỳ hạn',
    );
    assert.ok(
      ctx2027.factTableMarkdown.includes('[Tam Phương Tứ Chính & Điểm Xung Chiếu Của Kỳ Hạn'),
      'factTableMarkdown phải có mục Tam Phương Tứ Chính của kỳ hạn',
    );
    assert.ok(
      ctx2027.factTableMarkdown.includes('Cát tinh:') && ctx2027.factTableMarkdown.includes('Sát tinh:'),
      'QĐ-H3 B-04: Mục Tam Phương Tứ Chính kỳ hạn phải in sẵn Cát tinh và Sát tinh',
    );

    // Đủ 12 nhãn Cung Lưu ...
    for (const cnName of PALACE_NAMES_ORDER) {
      const expectedRole = `Cung Lưu ${translatePalaceName(cnName)}`;
      assert.ok(
        ctx2027.factTableMarkdown.includes(expectedRole),
        `Thiếu vai trò ${expectedRole} trong bảng ánh xạ 12 cung năm 2027`,
      );
    }

    // Cung Mão năm 2027 (Đinh Mùi) là Cung Lưu Tài Bạch trùng Bản Mệnh Mệnh Cung
    assert.ok(
      /Cung Lưu Tài Bạch\*\*\s+tại\s+\*\*[^*]*Mão\*\*\s+→\s+trùng cung Bản Mệnh gốc\s+\*\*Mệnh Cung\*\*/u.test(
        ctx2027.factTableMarkdown,
      ),
      'Cung Mão năm 2027 phải ánh xạ đúng Cung Lưu Tài Bạch -> Mệnh Cung',
    );

    // 4 Tứ Hóa đều có periodPalaceRoleVi + oppositePeriodPalaceRoleVi + xuất hiện trong factTableMarkdown
    assert.strictEqual(ctx2027.periodSiHua.length, 4);
    for (const sh of ctx2027.periodSiHua) {
      assert.ok(sh.periodPalaceRoleVi.startsWith('Lưu '), `Thiếu periodPalaceRoleVi trên ${sh.mutagenVi}`);
      assert.ok(
        sh.oppositePeriodPalaceRoleVi.startsWith('Lưu '),
        `Thiếu oppositePeriodPalaceRoleVi trên ${sh.mutagenVi}`,
      );
      assert.strictEqual(sh.periodStemVi, 'Đinh');
      assert.ok(ctx2027.factTableMarkdown.includes(`Cung ${sh.periodPalaceRoleVi}`));
      assert.ok(ctx2027.factTableMarkdown.includes(`Cung ${sh.oppositePeriodPalaceRoleVi}`));
    }

    // Sao Lưu động trong factTableMarkdown đều có nhãn Cung Lưu ...
    assert.ok(ctx2027.dynamicStars.length >= 10);
    for (const ds of ctx2027.dynamicStars) {
      assert.ok(ds.periodPalaceRoleVi.startsWith('Lưu '));
      assert.ok(
        ctx2027.factTableMarkdown.includes(`**${ds.starLabelVi}** tại **Cung ${ds.periodPalaceRoleVi}**`),
        `Sao lưu ${ds.starLabelVi} thiếu vai trò cung Lưu trong factTableMarkdown`,
      );
    }

    // Kiểm tra QĐ-H2 A-01: cacheKey tách biệt theo tên / kinh độ
    const anDiffName = generateChart({
      name: 'Trần Văn Bình',
      year: 1995,
      month: 8,
      day: 16,
      hour: 5,
      gender: 'male',
      longitude: 105.85,
    });
    const ctxDiffName = buildYunxianPeriodContext(anDiffName, { mode: 'liunian', year: 2027 });
    assert.ok(ctxDiffName);
    assert.notStrictEqual(ctx2027.cacheKey, ctxDiffName.cacheKey, 'Hai lá số khác tên phải khác periodContext.cacheKey');

    // Kiểm tra Chương 7 (2026–2030) & Chương 8 (2026–2035) giữ đủ toàn bộ trường PeriodSiHuaImpact
    for (const [label, horizon] of [
      ['Ch.7 (5 năm)', buildMultiYearHorizonContext(anChart, 2026, 2030)],
      ['Ch.8 (10 năm)', buildMultiYearHorizonContext(anChart, 2026, 2035)],
    ] as const) {
      for (const row of horizon.rows) {
        for (const sh of row.liuNianSiHua.allFour) {
          assert.ok(sh.periodPalaceRoleVi.startsWith('Lưu '), `${label} ${row.year} thiếu periodPalaceRoleVi`);
          assert.ok(
            sh.oppositePeriodPalaceRoleVi.startsWith('Lưu '),
            `${label} ${row.year} thiếu oppositePeriodPalaceRoleVi`,
          );
          assert.ok(Boolean(sh.periodStemVi), `${label} ${row.year} thiếu periodStemVi`);
          assert.ok(Boolean(sh.natalPalaceGanZhiVi), `${label} ${row.year} thiếu natalPalaceGanZhiVi`);
          assert.ok(Boolean(sh.oppositePalaceGanZhiVi), `${label} ${row.year} thiếu oppositePalaceGanZhiVi`);
          assert.ok(Boolean(sh.resonanceNoteVi), `${label} ${row.year} thiếu resonanceNoteVi`);

          assert.ok(
            horizon.compactMatrixMarkdown.includes(`Cung ${sh.periodPalaceRoleVi}`),
            `${label} compactMatrix thiếu tọa thủ Cung ${sh.periodPalaceRoleVi}`,
          );
          assert.ok(
            horizon.compactMatrixMarkdown.includes(`Cung ${sh.oppositePeriodPalaceRoleVi}`),
            `${label} compactMatrix thiếu đối cung Cung ${sh.oppositePeriodPalaceRoleVi}`,
          );
          assert.ok(
            horizon.factSheetMarkdown.includes(`Cung ${sh.periodPalaceRoleVi}`),
            `${label} factSheet thiếu tọa thủ Cung ${sh.periodPalaceRoleVi}`,
          );
          assert.ok(
            horizon.factSheetMarkdown.includes(`Cung ${sh.oppositePeriodPalaceRoleVi}`),
            `${label} factSheet thiếu đối cung Cung ${sh.oppositePeriodPalaceRoleVi}`,
          );
        }
      }
    }
    console.log('  -> Đạt [TEST-3]: Đủ 12 cung Lưu Niên năm 2027, Lưu Tài Bạch@Mão=Mệnh Cung, đối cung & Ch.7/8 giữ đủ trường PeriodSiHuaImpact.');
  }

  // ── BÀI 7 (BRIEF 1.5.4 · GÓI A — KP-1): Kiểm chứng lá số mẫu 26/07/1977 giờ Tỵ Hà Nội & trần A7 ─
  {
    console.log('\n[7/7] [BRIEF 1.5.4 · GÓI A] Kiểm thử A1–A7 trên lá số mẫu nam 26/07/1977 giờ Tỵ, Hà Nội...');
    const sample1977 = generateChart({
      name: '',
      year: 1977,
      month: 7,
      day: 26,
      hour: 5,
      gender: 'male',
      city: 'Hà Nội',
      longitude: 105.85,
    });
    const yangMale1990 = generateChart({
      name: 'Mẫu Dương Nam',
      year: 1990,
      month: 5,
      day: 15,
      hour: 0,
      gender: 'male',
      city: 'Hà Nội',
      longitude: 105.85,
    });

    const ov1977 = buildNatalOverviewFactSheetVi(sample1977).factSheetMarkdown;
    const core1977 = buildPalaceGroupFactSheetVi(sample1977, 'core').factSheetMarkdown;
    const fam1977 = buildPalaceGroupFactSheetVi(sample1977, 'family').factSheetMarkdown;
    const soc1977 = buildPalaceGroupFactSheetVi(sample1977, 'social_health').factSheetMarkdown;
    const chat1977 = buildChatFactTableForContextVi(sample1977, {
      contextMode: 'natal',
      includeHorizonStart: 2026,
      includeHorizonEnd: 2035,
    });

    // A1: Tứ Hóa Đại Hạn theo kỳ ở fact sheet nhóm cung
    assert.ok(
      fam1977.includes('[Tứ Hóa Đại Hạn Kỳ 24–33 (đóng tại Phu Thê · Can Nhâm)]'),
      'palaces_family phải có dòng Tứ Hóa Đại Hạn Kỳ 24–33 tại Phu Thê Can Nhâm',
    );
    assert.ok(fam1977.includes('Thiên Lương Hóa Lộc → Quan Lộc'));
    assert.ok(fam1977.includes('Tử Vi Hóa Quyền → Phụ Mẫu'));
    assert.ok(fam1977.includes('Tả Phù Hóa Khoa → Tật Ách'));
    assert.ok(fam1977.includes('Vũ Khúc Hóa Kỵ → Tử Nữ'));
    assert.ok(
      core1977.includes('[Tứ Hóa Đại Hạn Kỳ 44–53 (đóng tại Tài Bạch · Can Canh)]'),
      'palaces_core phải có dòng Tứ Hóa Đại Hạn Kỳ 44–53 tại Tài Bạch Can Canh',
    );
    assert.ok(!ov1977.includes('[Tứ Hóa Đại Hạn Kỳ '), 'chapter_overview không chèn dòng từng kỳ A1');
    assert.ok(!chat1977.includes('[Tứ Hóa Đại Hạn Kỳ '), 'bảng chat không chèn dòng từng kỳ A1');

    // A2: Thẻ hiện tại mang nhãn "HIỆN TẠI (44–53 · Can Canh)"
    assert.ok(core1977.includes('[Tứ Hóa Đại Hạn HIỆN TẠI (44–53 · Can Canh)]'));
    assert.ok(fam1977.includes('[Tứ Hóa Đại Hạn HIỆN TẠI (44–53 · Can Canh)]'));
    assert.ok(ov1977.includes('[Tứ Hóa Đại Hạn HIỆN TẠI (44–53 · Can Canh)]'));
    assert.ok(chat1977.includes('[Tứ Hóa Đại Hạn HIỆN TẠI (44–53 · Can Canh)]'));

    // A3 & A6 prompt rules
    const famPrompt1977 = buildStrictDossierSectionPrompt(sample1977, 'palaces_family');
    assert.ok(famPrompt1977.systemInstruction.includes('Thẻ [Tứ Hóa Đại Hạn HIỆN TẠI ...] chỉ áp dụng cho kỳ hiện tại'));
    assert.ok(famPrompt1977.systemInstruction.includes('đương số nam thì không dùng khuôn diễn đạt dành cho nữ'));

    // A4: Can Chi đầy đủ trên dòng sao lưu trong yunxian-context
    const ctx2026 = buildYunxianPeriodContext(sample1977, { mode: 'liunian', year: 2026 });
    assert.ok(ctx2026);
    assert.ok(
      ctx2026.dynamicStars.every((d) => Boolean(d.natalGanZhiVi)),
      'Mọi dynamicStar phải có natalGanZhiVi',
    );
    assert.ok(
      ctx2026.factTableMarkdown.includes('trùng cung Bản Mệnh gốc Quan Lộc - Bính Ngọ'),
      'Dòng sao lưu rơi vào Quan Lộc phải ghi rõ "trùng cung Bản Mệnh gốc Quan Lộc - Bính Ngọ"',
    );

    // A5: Mượn sao hai chiều chỉ trên dòng Chính tinh của cung cho mượn trong buildPalaceGroupFactSheetVi
    assert.ok(
      core1977.includes('Chính tinh tại cung này được đối cung Thiên Di vô chính diệu mượn để tham chiếu; cung này KHÔNG mượn sao của Thiên Di.'),
      'palaces_core phải có ghi chú hai chiều trên Mệnh Cung cho Thiên Di mượn',
    );
    assert.ok(
      soc1977.includes('Chính tinh tại cung này được đối cung Tật Ách vô chính diệu mượn để tham chiếu; cung này KHÔNG mượn sao của Tật Ách.'),
      'palaces_social_health phải có ghi chú hai chiều trên Phụ Mẫu cho Tật Ách mượn',
    );
    assert.ok(!ov1977.includes('KHÔNG mượn sao'), 'A5 không gắn vào chapter_overview');
    assert.ok(!chat1977.includes('KHÔNG mượn sao'), 'A5 không gắn vào bảng chat');
    const thienDiBlock = core1977.slice(core1977.indexOf('### Cung Thiên Di'));
    assert.ok(!thienDiBlock.includes('KHÔNG mượn sao của Thiên Di'), 'A5 không lặp lại trong Tam Phương Tứ Chính của đối cung');

    // A6: Dòng Đương số ở 3 fact sheet nhóm cung
    assert.ok(core1977.includes('Đương số: Âm Nam'));
    assert.ok(fam1977.includes('Đương số: Âm Nam'));
    assert.ok(soc1977.includes('Đương số: Âm Nam'));
    assert.ok(buildPalaceGroupFactSheetVi(yangMale1990, 'family').factSheetMarkdown.includes('Đương số: Dương Nam'));

    // A7: Trần ký tự đã duyệt (nới trần 3 nhóm cung)
    assert.ok(core1977.length <= 5_100, `palaces_core vượt trần 5100: ${core1977.length}`);
    assert.ok(fam1977.length <= 4_550, `palaces_family vượt trần 4550: ${fam1977.length}`);
    assert.ok(soc1977.length <= 4_580, `palaces_social_health vượt trần 4580: ${soc1977.length}`);
    assert.ok(ov1977.length <= 3_650, `chapter_overview vượt trần 3650: ${ov1977.length}`);
    assert.ok(chat1977.length <= 13_100, `chat vượt trần 13100: ${chat1977.length}`);
    console.log(
      `  -> Đạt [GÓI A]: A1–A7 hợp lệ (core=${core1977.length}/5100, family=${fam1977.length}/4550, social=${soc1977.length}/4580, overview=${ov1977.length}/3650, chat=${chat1977.length}/13100).`,
    );
  }

  // ── BÀI 8 (BRIEF 1.5.5 v2): Y1–Y6, Z1, Z2, Z4 & trần ĐK-155-04 trên lá số mẫu 26/07/1977 ──
  {
    console.log('\n[8/8] [BRIEF 1.5.5 v2] Kiểm thử Y1–Y6, Z1, Z2, Z4 & trần horizon/chat ĐK-155-04...');
    const sample1977 = generateChart({
      name: '',
      year: 1977,
      month: 7,
      day: 26,
      hour: 5,
      gender: 'male',
      city: 'Hà Nội',
      longitude: 105.85,
    });

    const ov1977 = buildNatalOverviewFactSheetVi(sample1977).factSheetMarkdown;
    const core1977 = buildPalaceGroupFactSheetVi(sample1977, 'core').factSheetMarkdown;
    const fam1977 = buildPalaceGroupFactSheetVi(sample1977, 'family').factSheetMarkdown;
    const soc1977 = buildPalaceGroupFactSheetVi(sample1977, 'social_health').factSheetMarkdown;
    const h5 = buildDossierSectionFactSheetVi(sample1977, 'horizon_5y');
    const h10 = buildDossierSectionFactSheetVi(sample1977, 'horizon_10y');
    const chat1977 = buildChatFactTableForContextVi(sample1977, {
      contextMode: 'natal',
      includeHorizonStart: 2026,
      includeHorizonEnd: 2035,
    });
    const ctx2026 = buildYunxianPeriodContext(sample1977, { mode: 'liunian', year: 2026 })!;
    const ctxDahan = buildYunxianPeriodContext(sample1977, { mode: 'dahan', daXianIndex: 4 })!;

    // Y1: formatPeriodSiHuaFactLine đưa [Bản mệnh Hóa X] lên sau [Độ sáng], trước cụm đối cung xung chiếu
    const shWithNatal = ctx2026.periodSiHua.find((s) => Boolean(s.natalMutagenVi))!;
    assert.ok(shWithNatal, 'Năm 2026 lá số 1977 phải có ít nhất 1 sao có natalMutagenVi');
    const lineY1 = formatPeriodSiHuaFactLine(shWithNatal, 'Lưu');
    const natalPos = lineY1.indexOf(`[${shWithNatal.natalMutagenVi}]`);
    const oppPos = lineY1.indexOf('— đối cung xung chiếu:');
    assert.ok(natalPos > 0 && oppPos > natalPos, `Y1: [Bản mệnh Hóa] phải đứng trước đối cung xung chiếu: ${lineY1}`);
    assert.ok(
      lineY1.includes(`[${shWithNatal.brightnessVi}] · [${shWithNatal.natalMutagenVi}]**`),
      `Y1: [Bản mệnh Hóa] phải nằm sát độ sáng bên trong cụm in đậm: ${lineY1}`,
    );
    const dahanLineY1 = formatPeriodSiHuaFactLine(shWithNatal, 'Đại Hạn');
    assert.ok(dahanLineY1.startsWith('• **[Tứ Hóa Đại Hạn] Đại Hạn '), 'Y1/P4 phải giữ ${layerTag} ${prefix} cho Đại Hạn');

    // Y2: periodTitleVi nhánh Lưu Niên & dòng Cung bản mệnh được kích hoạt
    assert.ok(ctx2026.periodTitleVi.includes('Kích hoạt cung Bản Mệnh gốc'));
    assert.ok(ctx2026.periodTitleVi.includes('nơi Cung Lưu Mệnh Cung tọa thủ'));
    assert.ok(!ctxDahan.periodTitleVi.includes('nơi Cung Lưu Mệnh Cung tọa thủ'), 'Y2/P5 không đụng periodTitleVi nhánh Đại Hạn');
    assert.ok(ctx2026.factTableMarkdown.includes('— nơi Cung Lưu Mệnh Cung tọa thủ'));
    assert.ok(ctxDahan.factTableMarkdown.includes('— nơi Cung Đại Hạn Mệnh Cung tọa thủ'));

    // Y3: Bộ Kình Đà lưu niên
    assert.ok(ctx2026.factTableMarkdown.includes('Bộ Kình Đà lưu niên (kẹp hai bên cung Lưu Lộc Tồn)'));
    assert.ok(!ctx2026.factTableMarkdown.includes('(Dương Đà giáp Lộc)'));

    // Y4: dịch pat.level sang tiếng Việt trong fact sheet tổng quan
    assert.ok(ov1977.includes('[Thượng cách]') || ov1977.includes('[Cát cách]'));
    for (const rawLevel of ['[excellent]', '[good]', '[neutral]', '[bad]', '[caution]']) {
      assert.ok(!ov1977.includes(rawLevel), `Y4: không được lọt nhãn thô ${rawLevel}`);
    }

    // Y5: ### Cung Mệnh (Nhâm Dần), không có ### Cung Mệnh Cung
    assert.ok(core1977.includes('### Cung Mệnh (Nhâm Dần)'));
    assert.ok(!core1977.includes('### Cung Mệnh Cung'));

    // Y6a: prompt horizon chứa quy tắc bắt buộc mẫu đối cung xung chiếu cho 4 Lưu Tứ Hóa
    const horizonPrompt = buildStrictDossierSectionPrompt(sample1977, 'horizon_5y');
    assert.ok(horizonPrompt.systemInstruction.includes('(xung Cung Lưu {C} [trùng {D}])'));

    // Y6b: periodCtxLabelDynStars xuất đầy đủ Can Chi trong detailLines, còn dynamicStarsSummaryVi giữ chi-only
    const row2026 = h5.horizon!.rows[0];
    const dynDetail2026 = periodCtxLabelDynStars(row2026.dynamicStars);
    const firstDyn = row2026.dynamicStars[0];
    assert.ok(dynDetail2026.includes(`(${firstDyn.natalPalaceNameVi} - ${firstDyn.natalGanZhiVi})`));
    assert.ok(
      row2026.dynamicStars.some((d) => dynDetail2026.includes(`(${d.natalPalaceNameVi} - ${d.natalGanZhiVi})`)),
    );
    // Tìm sao rơi vào Điền Trạch - Ất Tỵ trên lá số 1977 (năm 2026 Bính Ngọ: Kình Dương @ Ngọ, ... hay kiểm tra trực tiếp 1 sao ở Điền Trạch)
    assert.ok(
      periodCtxLabelDynStars([
        {
          starLabelVi: 'Lưu Thiên Mã',
          category: 'loc_ma',
          branch: 5,
          branchVi: 'Tỵ',
          natalPalaceNameVi: 'Điền Trạch',
          natalGanZhiVi: 'Ất Tỵ',
          periodPalaceRoleVi: 'Lưu Điền Trạch',
        },
      ]).includes('Điền Trạch - Ất Tỵ'),
    );

    // Y6c: Năm 2034 (Giáp Dần) Lưu Mệnh trùng Mệnh gốc tại Dần trên lá số 1977 có chú thích trong detailLines, KHÔNG có trong compactMatrixMarkdown
    const overlapNote =
      '*(Lưu Mệnh trùng Mệnh gốc tại Dần nên cả 12 cung Lưu Niên năm này trùng tên với 12 cung Bản Mệnh)*';
    assert.ok(h10.horizon!.factSheetMarkdown.includes(overlapNote), 'Y6c: năm 2034 phải có chú thích trùng Mệnh trong detailLines');
    assert.ok(!h10.horizon!.compactMatrixMarkdown.includes(overlapNote), 'Y6c/P7: không nhét chú thích vào compactMatrixMarkdown');
    assert.ok(h5.horizon!.factSheetMarkdown.includes('[Tứ Hóa Đại Hạn HIỆN TẠI (44–53 · Can Canh)]'));
    assert.ok(h5.horizon!.factSheetMarkdown.includes('[Tứ Hóa Đại Hạn Kỳ 54–63 (đóng tại Tật Ách · Can Kỷ)]'));

    // Y6d: dynamicStarsSummaryVi (compactMatrix) giữ chi-only & chat giữ <= 13.100
    assert.ok(
      row2026.dynamicStarsSummaryVi.includes(`(${firstDyn.natalPalaceNameVi} - ${firstDyn.branchVi})`),
      'Y6d/P7: dynamicStarsSummaryVi phải giữ nguyên dạng chi-only',
    );
    assert.ok(
      !row2026.dynamicStarsSummaryVi.includes(`(${firstDyn.natalPalaceNameVi} - ${firstDyn.natalGanZhiVi})`),
      'Y6d/P7: không chèn Can Chi vào dynamicStarsSummaryVi',
    );

    // Z1: prompt nhóm cung bắt buộc dòng [Tứ Hóa Đại Hạn Kỳ X–Y]
    const groupPrompt = buildStrictDossierSectionPrompt(sample1977, 'palaces_family');
    assert.ok(groupPrompt.systemInstruction.includes('[Tứ Hóa Đại Hạn Kỳ X–Y]'));
    assert.ok(groupPrompt.systemInstruction.includes('Không Kiếp'));

    // Z2 & Z4: prompt kỳ hạn chứa sàn 900–1.300 từ, tên sao+độ sáng, Không Kiếp, và KHÔNG hardcode 1977
    const periodPrompt = buildStrictPeriodAiPrompt(ctx2026, formatChartSummaryVi(sample1977), sample1977);
    assert.ok(periodPrompt.systemInstruction.includes('900–1.300 từ'));
    assert.ok(periodPrompt.systemInstruction.includes('tên Hóa + tên sao + độ sáng'));
    assert.ok(periodPrompt.systemInstruction.includes('Không Kiếp'));
    assert.ok(
      !periodPrompt.systemInstruction.includes('44–53 tuổi tại Tài Bạch · Can Canh'),
      'Z2/P10: không được hardcode dữ kiện lá số 1977 vào systemInstruction',
    );

    // ĐK-155-04: Trần kích thước trên lá số mẫu 26/07/1977
    assert.ok(core1977.length <= 5_100, `core vượt trần 5100: ${core1977.length}`);
    assert.ok(fam1977.length <= 4_550, `family vượt trần 4550: ${fam1977.length}`);
    assert.ok(soc1977.length <= 4_580, `social vượt trần 4580: ${soc1977.length}`);
    assert.ok(ov1977.length <= 3_650, `overview vượt trần 3650: ${ov1977.length}`);
    assert.ok(chat1977.length <= 13_100, `chat vượt trần 13100: ${chat1977.length}`);
    assert.ok(h5.factSheetMarkdown.length <= 14_200, `horizon_5y vượt trần 14200: ${h5.factSheetMarkdown.length}`);
    assert.ok(h10.factSheetMarkdown.length <= 37_800, `horizon_10y vượt trần 37800: ${h10.factSheetMarkdown.length}`);

    console.log(
      `  -> Đạt [BRIEF 1.5.5 v2]: Y1–Y6, Z1, Z2, Z4 hợp lệ (h5=${h5.factSheetMarkdown.length}/14200, h10=${h10.factSheetMarkdown.length}/37800, chat=${chat1977.length}/13100, ov=${ov1977.length}/3650).`,
    );
  }

  console.log('\n=== TẤT CẢ 8 BÀI KIỂM THỬ DOSSIER CONTEXT, HORIZON & BRIEF 1.5.5 ĐỀU ĐẠT ===');
}

runTests().catch((err) => {
  console.error('KIỂM THỬ PHA 2 THẤT BẠI:', err);
  process.exit(1);
});
