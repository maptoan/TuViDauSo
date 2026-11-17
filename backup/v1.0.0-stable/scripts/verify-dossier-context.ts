import assert from 'assert';
import express from 'express';
import type { AddressInfo } from 'net';

process.env.ZIWEI_DISABLE_AUTO_LISTEN = '1';

import { generateChart } from '../src/lib/ziwei/algorithm.ts';
import { PALACE_NAMES_ORDER } from '../src/lib/ziwei/constants.ts';
import { translatePalaceName } from '../src/lib/ziwei/vi-i18n.ts';
import { buildYunxianPeriodContext } from '../src/lib/ziwei/yunxian-context.ts';
import {
  DOSSIER_PALACE_GROUPS,
  VALID_DOSSIER_SECTION_IDS,
  buildDossierSectionFactSheetVi,
  buildMultiYearHorizonContext,
  buildNatalOverviewFactSheetVi,
  buildPalaceGroupFactSheetVi,
} from '../src/lib/ziwei/dossier-context.ts';
import {
  CHAT_MAX_EXCERPT_LEN,
  CHAT_MAX_HISTORY_MESSAGES,
  CHAT_MAX_HISTORY_MSG_LEN,
  CHAT_MAX_QUESTION_LEN,
  buildStrictDossierSectionPrompt,
  buildStrictExplanationChatPrompt,
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

    const combinedMarkdown = `${core.factSheetMarkdown}\n${family.factSheetMarkdown}\n${social.factSheetMarkdown}`;
    assert.ok(combinedMarkdown.includes('[Tứ Hóa Bản Mệnh - Can'));
    assert.ok(combinedMarkdown.includes('[Tự Hóa Can Cung') || combinedMarkdown.includes('[Phi Tinh Can Cung'));
    console.log('  -> Đạt: 3 nhóm F2 phủ đủ 12 cung (4+4+4 = 12) kèm tiền tố tầng Tứ Hóa tường minh.');
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

  console.log('\n=== TẤT CẢ 6 BÀI KIỂM THỬ DOSSIER CONTEXT, HORIZON & PHA 1 ĐỀU ĐẠT ===');
}

runTests().catch((err) => {
  console.error('KIỂM THỬ PHA 2 THẤT BẠI:', err);
  process.exit(1);
});
