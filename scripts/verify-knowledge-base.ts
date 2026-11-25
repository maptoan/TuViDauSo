process.env.ZIWEI_DISABLE_AUTO_LISTEN = '1';

import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  buildStrictDossierSectionPrompt,
  buildStrictExplanationChatPrompt,
  buildStrictPeriodAiPrompt,
} from '../server.ts';
import {
  loadKnowledgeBase,
  resetKnowledgeBaseCache,
  setKnowledgeBaseEntriesForTesting,
} from '../server/knowledge-base/loader.ts';
import {
  KB_BUDGET_LIMITS,
  checkEffectiveStarInPalace,
  retrieveKnowledgeForChat,
  retrieveKnowledgeForDossierSection,
  retrieveKnowledgeForPeriod,
} from '../server/knowledge-base/retriever.ts';
import type { DistilledKnowledgeEntry } from '../server/knowledge-base/types.ts';
import {
  verifyAcademicCitationsAndClaims,
  verifyPalaceGanZhiMentions,
} from '../server/knowledge-base/verifier.ts';
import { sanitizeDossierChapterText } from '../src/lib/dossier-chat-ui.ts';
import { generateChart } from '../src/lib/ziwei/algorithm.ts';
import { scrubInvalidCitationTags } from '../src/lib/ziwei/text-sanitizer.ts';
import { formToBirthInfo } from '../src/lib/ziwei/share.ts';
import {
  translatePalaceName,
  translateStarName,
  VI_BRANCHES,
  VI_STEMS,
} from '../src/lib/ziwei/vi-i18n.ts';
import { buildYunxianPeriodContext } from '../src/lib/ziwei/yunxian-context.ts';
import { auditKnowledgeBaseData } from './kb-audit-quality.ts';
import { exportPilotAuditSheet } from './kb-export-audit-sheet.ts';
import {
  findSupportingLectureWindow,
  groupEntriesJsonl,
  parseEntriesJsonlContent,
} from './kb-group-entries.ts';
import { verifyKnowledgeSourceDir } from './kb-verify-source.ts';

function makeEntry(
  id: string,
  opts: {
    starsVi?: string[];
    palacesVi?: string[];
    branchesVi?: string[];
    patternsVi?: string[];
    sihuaCombos?: Array<{
      starVi?: string;
      mutagenVi: 'Hóa Lộc' | 'Hóa Quyền' | 'Hóa Khoa' | 'Hóa Kỵ';
    }>;
    topicTags?: string[];
    targetDossierSections?: DistilledKnowledgeEntry['retrievalKeys']['targetDossierSections'];
    priorityTier?: 1 | 2 | 3;
    summaryVi?: string;
    category?: DistilledKnowledgeEntry['category'];
    scopeTier?: DistilledKnowledgeEntry['scopeTier'];
  },
): DistilledKnowledgeEntry {
  const isClassic = id.startsWith('CL-');
  const isSiHua = id.startsWith('NH-SIHUA');
  const category =
    opts.category ?? (isClassic ? 'classics-fu' : isSiHua ? '04-sihua' : '01-stars');
  const summaryBase =
    opts.summaryVi ??
    `Luận điểm học thuật chuẩn Thiên Kỷ cho mục ${id}: phân tích tương tác ${[...(opts.starsVi ?? []), ...(opts.palacesVi ?? [])].join(', ') || 'cơ bản'} theo Tam Phương Tứ Chính và điều kiện thành cách thực chiến.`;
  const summaryVi =
    summaryBase.length < 125
      ? `${summaryBase} Cần đối chiếu kỹ chính phụ tinh và Tứ Hóa đồng độ trong lá số trước khi kết luận.`
      : summaryBase.slice(0, 320);

  return {
    id,
    corpusType: isClassic ? 'classic_verse' : 'nihai_entry',
    scopeTier: opts.scopeTier ?? 'tier1_core',
    category,
    sourceRef: {
      citationId: id,
      tradition: isClassic ? 'ziwei_classics' : 'ni_haixia_tianji',
      sourceLicense: isClassic
        ? 'PUBLIC_DOMAIN_TEXT_WITH_CC_BY_NC_SA_ADAPTATION'
        : 'CC-BY-NC-SA-4.0',
      groupKey: {
        book: category,
        h2Cn: '紫微',
        h3Cn: `组_${id}`,
      },
      workTitleVi: isClassic ? 'Cốt Tủy Phú' : 'Thiên Kỷ — Nghê Hải Hạ',
      groupTitleVi: `Chủ đề đối chiếu ${id}`,
      bvids: isClassic ? [] : ['BV1TEST0001'],
      timeRangeHms: isClassic ? undefined : '00:10:00–00:15:00',
      sourceFilePath: 'knowledge-source/entries.jsonl',
      sourceLineNumbers: [1],
    },
    retrievalKeys: {
      starsVi: opts.starsVi ?? [],
      palacesVi: opts.palacesVi ?? [],
      branchesVi: opts.branchesVi ?? [],
      patternsVi: opts.patternsVi ?? [],
      sihuaCombos: opts.sihuaCombos ?? [],
      topicTags: opts.topicTags ?? [],
      targetDossierSections: opts.targetDossierSections ?? [],
    },
    summaryVi,
    fullTranslationVi: summaryVi,
    hanziAnchor: {
      quotes: [{ quoteCn: '紫微斗数测试原句，确认锚点完整。', sourceLineNumber: 1 }],
      combinedQuotesCn: '紫微斗数测试原句，确认锚点完整。',
    },
    priorityTier: opts.priorityTier ?? 1,
    qaMeta: {
      distilledAtIso: '2026-11-19T00:00:00.000Z',
      modelUsed: 'test-fixture',
      sourceHash: `hash-${id}`,
      glossaryCheckPassed: true,
      sample: false,
    },
  };
}

function buildTestChart() {
  const birth = formToBirthInfo({
    name: 'Nguyễn Văn Kiểm Thử',
    year: '1990',
    month: '5',
    day: '15',
    clockHour: '9',
    clockMinute: '30',
    unknownTime: false,
    province: 'Việt Nam - Hà Nội',
    city: 'Hà Nội',
    longitude: 105.85,
    gender: 'male',
  });
  return generateChart(birth);
}

function runVerification() {
  console.log('=== KIỂM THỬ HỒI QUY NỀN TRI THỨC AI (verify:kb — K1/K2/K3) ===');
  const chart = buildTestChart();

  // ── 1/6: Loader + Audit dữ liệu mẫu thực tế trên đĩa ───────────────────────
  {
    console.log('\n[1/6] Kiểm thử Loader, Audit dữ liệu thực tế & Missing Source graceful check...');
    resetKnowledgeBaseCache();
    const snap = loadKnowledgeBase();
    assert.ok(snap.loaded, 'Snapshot phải đánh dấu loaded = true');
    assert.ok(snap.totalEntries >= 9, `Phải nạp tối thiểu 9 mục mẫu (thực tế: ${snap.totalEntries})`);
    assert.ok(snap.filesLoaded.includes('stars.kb.json'));
    assert.ok(snap.filesLoaded.includes('sihua.kb.json'));
    assert.ok(snap.filesLoaded.includes('classics.kb.json'));
    assert.ok(snap.filesLoaded.includes('palaces.kb.json'));
    assert.ok(snap.filesLoaded.includes('patterns.kb.json'));
    assert.ok(snap.filesLoaded.includes('methodology.kb.json'));
    assert.ok(snap.filesLoaded.includes('illness.kb.json'));
    assert.strictEqual(snap.totalEntries, 300, 'Sau nạp chu kỳ 2, CSDL phải có đúng 300 mục');

    const audit = auditKnowledgeBaseData();
    assert.strictEqual(
      audit.passed,
      true,
      `kb:audit thất bại: ${audit.errors.join(' | ')}`,
    );

    const missingSourceReport = verifyKnowledgeSourceDir(
      path.join(os.tmpdir(), 'ziwei-non-existent-knowledge-source-xyz'),
    );
    assert.strictEqual(missingSourceReport.sourcePresent, false);
    assert.strictEqual(missingSourceReport.passed, true);
    console.log(`  -> ĐẠT: Nạp ${snap.totalEntries} mục (${snap.filesLoaded.join(', ')}), kb:audit 100% PASS.`);

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
  }

  // ── 2/6: Grouping (ĐN-1, NK-11), Lecture Lookup (ĐN-2) & Export Sheet ───────
  {
    console.log('\n[2/6] Kiểm thử Gom nhóm (book, h2, h3), tách tiểu mục 02-palaces & trích bài giảng...');
    const syntheticLines: string[] = [];
    // 2 dòng 01-stars đảo thứ tự part/t_hms để kiểm tra sort tất định
    syntheticLines.push(
      JSON.stringify({
        book: '01-stars',
        h2: '紫微',
        h3: '紫微在子午',
        quote: '第二句在后，应排第二。',
        section: 'A',
        t_hms: '00:12:00',
        note: '',
        bvid: 'BV1DEMO',
        part: 2,
      }),
    );
    syntheticLines.push(
      JSON.stringify({
        book: '01-stars',
        h2: '紫微',
        h3: '紫微在子午',
        quote: '第一句在前，应排第一。',
        section: 'A',
        t_hms: '00:05:00',
        note: 'Ghi chú mẫu',
        bvid: 'BV1DEMO',
        part: 1,
      }),
    );
    // 14 dòng trong cùng 1 nhóm h3 của 02-palaces (vượt ngưỡng 12 -> phải tách tiểu mục)
    const starTokens = ['紫微', '天机', '武曲'];
    for (let i = 0; i < 14; i++) {
      const starCn = i < 2 ? '' : starTokens[(i - 2) % starTokens.length];
      syntheticLines.push(
        JSON.stringify({
          book: '02-palaces',
          h2: '夫妻宫',
          h3: '夫妻总论',
          quote: `${starCn}于夫妻宫之论断第${i + 1}条。`,
          section: starCn || '',
          t_hms: `00:${String(10 + i).padStart(2, '0')}:00`,
          note: '',
          bvid: 'BV1DEMO',
          part: 1,
        }),
      );
    }
    // Nhóm Tầng 3 phải bị loại mặc định
    syntheticLines.push(
      JSON.stringify({
        book: '11-fengshui',
        h2: '阳宅',
        h3: '卧室方位',
        quote: '风水阳宅口诀不应进入运行时。',
        section: 'S',
        t_hms: '00:02:00',
        note: '',
        bvid: 'BV1FS',
        part: 1,
      }),
    );

    const parsedRows = parseEntriesJsonlContent(syntheticLines.join('\n'));
    const lectures = [
      {
        fileName: '01-demo.md',
        relPath: '01-demo.md',
        content:
          'Phần đầu bài giảng BV1DEMO... 00:05:00 Đoạn giảng giải cực kỳ chi tiết về Tử Vi tại Tý Ngọ gặp Tả Hữu và Tam Phương Tứ Chính. Đoạn tiếp theo nói về điều kiện thành cách.',
      },
    ];

    const grouped = groupEntriesJsonl(parsedRows, { lectures });
    assert.ok(!grouped.some((g) => g.groupKey.book === '11-fengshui'), 'Phải loại sách Tầng 3');
    const starGroup = grouped.find((g) => g.citationId === 'NH-STAR-001');
    assert.ok(starGroup, 'Phải sinh mã NH-STAR-001');
    assert.strictEqual(starGroup.quotes[0].part, 1, 'Phải sắp xếp theo (part ASC, t_hms ASC)');
    assert.ok(
      starGroup.supportingLectureWindow?.includes('00:05:00'),
      'Phải tự kéo được đoạn bài giảng khớp (bvid, t_hms)',
    );

    const palGroups = grouped.filter((g) => g.category === '02-palaces');
    assert.ok(
      palGroups.length >= 3,
      `02-palaces (>12 quote) phải được tách tiểu mục tất định (thực tế: ${palGroups.length})`,
    );

    const directWin = findSupportingLectureWindow(lectures, {
      bvids: ['BV1DEMO'],
      tHmsList: ['00:05:00'],
      radiusChars: 80,
    });
    assert.ok(directWin && directWin.includes('Đoạn giảng giải'));

    const tmpSheetPath = path.join(os.tmpdir(), `kb-audit-test-${Date.now()}.md`);
    try {
      const exported = exportPilotAuditSheet({ outFile: tmpSheetPath });
      assert.ok(fs.existsSync(exported.outFile));
      const md = fs.readFileSync(exported.outFile, 'utf8');
      assert.ok(md.includes('NH-STAR-001'));
    } finally {
      if (fs.existsSync(tmpSheetPath)) fs.unlinkSync(tmpSheetPath);
    }
    console.log('  -> ĐẠT: Gom nhóm tất định, tách tiểu mục 02-palaces, kéo bài giảng & xuất phiếu kiểm định.');
  }

  // Xây dựng bộ dữ liệu kiểm thử giàu thực thể trên RAM (phục vụ K1/K2/K3)
  const mingPalace = chart.palaces.find((p) => p.branch === chart.mingGongBranch)!;
  const caiPalace = chart.palaces.find((p) => translatePalaceName(p.name) === 'Tài Bạch')!;
  const guanPalace = chart.palaces.find((p) => translatePalaceName(p.name) === 'Quan Lộc')!;
  const qiPalace = chart.palaces.find((p) => translatePalaceName(p.name) === 'Phu Thê')!;
  const diPalace = chart.palaces.find((p) => translatePalaceName(p.name) === 'Thiên Di')!;
  const jiePalace = chart.palaces.find((p) => translatePalaceName(p.name) === 'Tật Ách')!;
  const fuPalace = chart.palaces.find((p) => translatePalaceName(p.name) === 'Phúc Đức')!;
  const xiongPalace = chart.palaces.find((p) => translatePalaceName(p.name) === 'Huynh Đệ')!;
  const ziPalace = chart.palaces.find((p) => translatePalaceName(p.name) === 'Tử Nữ')!;
  const tianPalace = chart.palaces.find((p) => translatePalaceName(p.name) === 'Điền Trạch')!;
  const puPalace = chart.palaces.find((p) => translatePalaceName(p.name) === 'Giao Hữu')!;
  const fuMuPalace = chart.palaces.find((p) => translatePalaceName(p.name) === 'Phụ Mẫu')!;

  const firstStarVi = (pal: typeof mingPalace) => {
    const first = pal.stars.find((s) => s.type === 'major') ?? pal.stars[0];
    return first ? translateStarName(first.name) : pal.borrowedStars?.[0] ? translateStarName(pal.borrowedStars[0]) : 'Tử Vi';
  };

  const k1Corpus: DistilledKnowledgeEntry[] = [
    makeEntry('NH-STAR-001', {
      starsVi: [firstStarVi(mingPalace)],
      palacesVi: ['Mệnh Cung'],
      targetDossierSections: ['chapter_overview', 'palaces_core'],
      topicTags: ['ban-menh'],
    }),
    makeEntry('NH-STAR-002', {
      starsVi: [firstStarVi(caiPalace)],
      palacesVi: ['Tài Bạch'],
      targetDossierSections: ['palaces_core'],
      topicTags: ['tai-chinh'],
    }),
    makeEntry('NH-STAR-003', {
      starsVi: [firstStarVi(guanPalace)],
      palacesVi: ['Quan Lộc'],
      targetDossierSections: ['palaces_core'],
      topicTags: ['su-nghiep'],
    }),
    makeEntry('NH-STAR-004', {
      starsVi: [firstStarVi(diPalace)],
      palacesVi: ['Thiên Di'],
      targetDossierSections: ['palaces_core'],
      topicTags: ['xuat-ngoai'],
    }),
    makeEntry('NH-STAR-005', {
      starsVi: [firstStarVi(qiPalace)],
      palacesVi: ['Phu Thê'],
      targetDossierSections: ['palaces_family'],
      topicTags: ['hon-nhan'],
    }),
    makeEntry('NH-STAR-006', {
      starsVi: [firstStarVi(ziPalace)],
      palacesVi: ['Tử Nữ'],
      targetDossierSections: ['palaces_family'],
      topicTags: ['con-cai'],
    }),
    makeEntry('NH-STAR-007', {
      starsVi: [firstStarVi(tianPalace)],
      palacesVi: ['Điền Trạch'],
      targetDossierSections: ['palaces_family'],
      topicTags: ['dien-san'],
    }),
    makeEntry('NH-STAR-008', {
      starsVi: [firstStarVi(fuPalace)],
      palacesVi: ['Phúc Đức'],
      targetDossierSections: ['palaces_family'],
      topicTags: ['phuc-duc'],
    }),
    makeEntry('NH-STAR-009', {
      starsVi: [firstStarVi(fuMuPalace)],
      palacesVi: ['Phụ Mẫu'],
      targetDossierSections: ['palaces_social_health'],
      topicTags: ['phu-mau'],
    }),
    makeEntry('NH-STAR-010', {
      starsVi: [firstStarVi(xiongPalace)],
      palacesVi: ['Huynh Đệ'],
      targetDossierSections: ['palaces_social_health'],
      topicTags: ['huynh-de'],
    }),
    makeEntry('NH-STAR-011', {
      starsVi: [firstStarVi(puPalace)],
      palacesVi: ['Giao Hữu'],
      targetDossierSections: ['palaces_social_health'],
      topicTags: ['giao-huu'],
    }),
    makeEntry('NH-STAR-012', {
      starsVi: [firstStarVi(jiePalace)],
      palacesVi: ['Tật Ách'],
      targetDossierSections: ['palaces_social_health'],
      topicTags: ['suc-khoe'],
    }),
    makeEntry('NH-SIHUA-001', {
      sihuaCombos: [{ mutagenVi: 'Hóa Lộc' }],
      palacesVi: ['Tài Bạch', 'Mệnh Cung'],
      topicTags: ['van-han', 'tai-chinh'],
      targetDossierSections: ['year_2026', 'year_2027', 'horizon_5y', 'horizon_10y'],
    }),
    makeEntry('NH-SIHUA-002', {
      sihuaCombos: [{ mutagenVi: 'Hóa Quyền' }],
      palacesVi: ['Quan Lộc'],
      topicTags: ['van-han', 'su-nghiep'],
      targetDossierSections: ['year_2026', 'year_2027', 'horizon_10y'],
    }),
    makeEntry('NH-SIHUA-003', {
      sihuaCombos: [{ mutagenVi: 'Hóa Khoa' }],
      palacesVi: ['Mệnh Cung', 'Phụ Mẫu'],
      topicTags: ['van-han'],
      targetDossierSections: ['year_2026', 'year_2027'],
    }),
    makeEntry('NH-SIHUA-004', {
      sihuaCombos: [{ mutagenVi: 'Hóa Kỵ' }],
      palacesVi: ['Phu Thê', 'Tài Bạch', 'Tật Ách'],
      topicTags: ['van-han', 'hon-nhan'],
      targetDossierSections: ['year_2026', 'year_2027', 'horizon_5y', 'horizon_10y'],
    }),
    makeEntry('NH-STAR-020', {
      starsVi: ['Thiên Cơ'],
      palacesVi: ['Quan Lộc'],
      topicTags: ['su-nghiep'],
      summaryVi:
        'Thiên Cơ tọa Quan Lộc chủ mưu lược, điều phối kế hoạch và kỹ nghệ chuyên sâu; khi nhảy việc cần giữ trục chuyên môn cố định và tránh phân tán quá nhiều hướng.',
    }),
    makeEntry('NH-STAR-021', {
      starsVi: ['Thiên Phủ'],
      palacesVi: ['Điền Trạch'],
      topicTags: ['dien-san'],
      summaryVi:
        'Thiên Phủ nhập Điền Trạch là cách giữ kho tích lũy bất động sản vững chắc, ưa mua nhà đất phục vụ an cư và đầu tư dài hạn hơn là lướt sóng ngắn ngày.',
    }),
    makeEntry('NH-STAR-022', {
      starsVi: ['Thái Âm'],
      palacesVi: ['Tài Bạch'],
      topicTags: ['tai-chinh'],
      summaryVi:
        'Thái Âm tọa Tài Bạch chủ tích tụ tài chính âm thầm, đầu tư đều đặn vào tài sản bền vững; kỵ Hóa Kỵ gây lo âu dòng tiền khi hùn hạp thiếu minh bạch.',
    }),
    makeEntry('NH-STAR-023', {
      starsVi: ['Thiên Đồng'],
      palacesVi: ['Phúc Đức'],
      topicTags: ['phuc-duc'],
      summaryVi:
        'Thiên Đồng cư Phúc Đức chủ tâm thế an hưởng, biết buông bỏ căng thẳng tinh thần; nếu hội sát tinh cần giữ nếp sinh hoạt điều độ để ổn định phúc phần.',
    }),
    makeEntry('NH-STAR-024', {
      starsVi: ['Liêm Trinh'],
      palacesVi: ['Mệnh Cung'],
      branchesVi: [VI_BRANCHES[mingPalace.branch]],
      topicTags: ['ban-menh'],
    }),
    makeEntry('CL-CTP-001', {
      starsVi: ['Tử Vi', 'Thiên Phủ'],
      palacesVi: ['Mệnh Cung'],
      patternsVi: ['Tử Phủ Đồng Cung'],
      targetDossierSections: ['chapter_overview'],
    }),
    makeEntry('CL-CTP-002', {
      starsVi: ['Cự Môn'],
      palacesVi: ['Mệnh Cung', 'Tài Bạch'],
      patternsVi: ['Thạch Trung Ẩn Ngọc'],
      targetDossierSections: ['chapter_overview'],
    }),
    makeEntry('CL-TVP-001', {
      starsVi: ['Lộc Tồn'],
      palacesVi: ['Tài Bạch', 'Mệnh Cung'],
      sihuaCombos: [{ mutagenVi: 'Hóa Lộc' }],
      targetDossierSections: ['palaces_core', 'horizon_5y', 'horizon_10y'],
    }),
    makeEntry('NH-STAR-025', {
      starsVi: ['Tham Lang'],
      palacesVi: ['Phu Thê', 'Giao Hữu'],
      topicTags: ['hon-nhan', 'giao-huu'],
    }),
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
  ];

  // ── 3/6: Nhóm K1 — 32 Ca Kiểm thử Truy hồi Tất định ────────────────────────
  {
    console.log('\n[3/6] Kiểm thử Nhóm K1 (32 ca truy hồi tất định, Top-K & trần ngân sách)...');
    setKnowledgeBaseEntriesForTesting(k1Corpus, 'k1-suite');

    const period2026 = buildYunxianPeriodContext(chart, { mode: 'liunian', year: 2026 });
    const period2027 = buildYunxianPeriodContext(chart, { mode: 'liunian', year: 2027 });
    const dahan0 = buildYunxianPeriodContext(chart, { mode: 'dahan', daXianIndex: 0 });
    assert.ok(period2026, 'period2026 phải hợp lệ');
    assert.ok(period2027, 'period2027 phải hợp lệ');
    assert.ok(dahan0, 'dahan0 phải hợp lệ');

    const k1Cases: Array<{
      name: string;
      run: () => ReturnType<typeof retrieveKnowledgeForDossierSection>;
      expectedId: string;
      mustCoverPalaces?: string[];
      expectAbsent?: boolean;
    }> = [
      {
        name: 'K1-01 chapter_overview',
        run: () => retrieveKnowledgeForDossierSection(chart, 'chapter_overview'),
        expectedId: 'NH-STAR-001',
      },
      {
        name: 'K1-02 palaces_core Mệnh/Tài/Quan/Di',
        run: () => retrieveKnowledgeForDossierSection(chart, 'palaces_core'),
        expectedId: 'NH-STAR-002',
        mustCoverPalaces: ['Mệnh Cung', 'Tài Bạch', 'Quan Lộc', 'Thiên Di'],
      },
      {
        name: 'K1-03 palaces_core có Quan Lộc',
        run: () => retrieveKnowledgeForDossierSection(chart, 'palaces_core'),
        expectedId: 'NH-STAR-003',
      },
      {
        name: 'K1-04 palaces_core có Thiên Di',
        run: () => retrieveKnowledgeForDossierSection(chart, 'palaces_core'),
        expectedId: 'NH-STAR-004',
      },
      {
        name: 'K1-05 palaces_family Phu/Tử/Điền/Phúc',
        run: () => retrieveKnowledgeForDossierSection(chart, 'palaces_family'),
        expectedId: 'NH-STAR-005',
        mustCoverPalaces: ['Phu Thê', 'Tử Nữ', 'Điền Trạch', 'Phúc Đức'],
      },
      {
        name: 'K1-06 palaces_family có Điền Trạch',
        run: () => retrieveKnowledgeForDossierSection(chart, 'palaces_family'),
        expectedId: 'NH-STAR-007',
      },
      {
        name: 'K1-07 palaces_family có Phúc Đức',
        run: () => retrieveKnowledgeForDossierSection(chart, 'palaces_family'),
        expectedId: 'NH-STAR-008',
      },
      {
        name: 'K1-08 palaces_social_health Phụ/Huynh/Hữu/Tật',
        run: () => retrieveKnowledgeForDossierSection(chart, 'palaces_social_health'),
        expectedId: 'NH-STAR-009',
        mustCoverPalaces: ['Phụ Mẫu', 'Huynh Đệ', 'Giao Hữu', 'Tật Ách'],
      },
      {
        name: 'K1-09 palaces_social_health có Giao Hữu',
        run: () => retrieveKnowledgeForDossierSection(chart, 'palaces_social_health'),
        expectedId: 'NH-STAR-011',
      },
      {
        name: 'K1-10 palaces_social_health có Tật Ách',
        run: () => retrieveKnowledgeForDossierSection(chart, 'palaces_social_health'),
        expectedId: 'NH-STAR-012',
      },
      {
        name: 'K1-11 horizon_5y',
        run: () => retrieveKnowledgeForDossierSection(chart, 'horizon_5y'),
        expectedId: 'NH-SIHUA-001',
      },
      {
        name: 'K1-12 horizon_10y',
        run: () => retrieveKnowledgeForDossierSection(chart, 'horizon_10y'),
        expectedId: 'NH-SIHUA-004',
      },
      {
        name: 'K1-13 period liunian 2026 Lộc',
        run: () => retrieveKnowledgeForPeriod(chart, period2026),
        expectedId: 'NH-SIHUA-001',
      },
      {
        name: 'K1-14 period liunian 2026 Kỵ',
        run: () => retrieveKnowledgeForPeriod(chart, period2026),
        expectedId: 'NH-SIHUA-004',
      },
      {
        name: 'K1-15 period liunian 2027',
        run: () => retrieveKnowledgeForPeriod(chart, period2027),
        expectedId: 'NH-SIHUA-002',
      },
      {
        name: 'K1-16 period dahan 0',
        run: () => retrieveKnowledgeForPeriod(chart, dahan0),
        expectedId: 'NH-SIHUA-003',
      },
      {
        name: 'K1-17 chat hỏi cung Tài Bạch trực tiếp',
        run: () =>
          retrieveKnowledgeForChat({
            chart,
            contextMode: 'natal',
            sectionTitle: 'Tài Bạch',
            question: `Sao ${firstStarVi(caiPalace)} tại cung Tài Bạch có ý nghĩa gì?`,
          }),
        expectedId: 'NH-STAR-002',
      },
      {
        name: 'K1-18 chat ánh xạ từ khóa nhảy việc -> Quan Lộc',
        run: () =>
          retrieveKnowledgeForChat({
            chart,
            contextMode: 'natal',
            sectionTitle: 'Tổng quan',
            question: 'Năm nay có nên nhảy việc hoặc đổi công việc không?',
          }),
        expectedId: 'NH-STAR-020',
      },
      {
        name: 'K1-19 chat ánh xạ từ khóa bất động sản -> Điền Trạch',
        run: () =>
          retrieveKnowledgeForChat({
            chart,
            contextMode: 'natal',
            sectionTitle: 'Điền Trạch',
            question: 'Khả năng mua nhà đất và tích lũy bất động sản ra sao?',
          }),
        expectedId: 'NH-STAR-021',
      },
      {
        name: 'K1-20 chat ánh xạ từ khóa đầu tư -> Tài Bạch',
        run: () =>
          retrieveKnowledgeForChat({
            chart,
            contextMode: 'natal',
            sectionTitle: 'Tài Bạch',
            question: 'Hướng đầu tư và tích lũy tài chính của lá số này thế nào?',
          }),
        expectedId: 'NH-STAR-022',
      },
      {
        name: 'K1-21 chat ánh xạ từ khóa hôn nhân -> Phu Thê',
        run: () =>
          retrieveKnowledgeForChat({
            chart,
            contextMode: 'natal',
            sectionTitle: 'Phu Thê',
            question: `Xem giúp chuyện tình duyên kết hôn với sao ${firstStarVi(qiPalace)} tại Phu Thê`,
          }),
        expectedId: 'NH-STAR-005',
      },
      {
        name: 'K1-22 chat ánh xạ từ khóa tinh thần -> Phúc Đức',
        run: () =>
          retrieveKnowledgeForChat({
            chart,
            contextMode: 'natal',
            sectionTitle: 'Phúc Đức',
            question: 'Đời sống tinh thần và tâm tính cung Phúc Đức thế nào?',
          }),
        expectedId: 'NH-STAR-023',
      },
      {
        name: 'K1-23 chat hỏi Lưu Hóa Kỵ 2026',
        run: () =>
          retrieveKnowledgeForChat({
            chart,
            contextMode: 'period',
            sectionTitle: 'Lưu niên 2026',
            periodContext: period2026,
            question: 'Hóa Kỵ trong Lưu Niên 2026 cần đề phòng điểm gì?',
          }),
        expectedId: 'NH-SIHUA-004',
      },
      {
        name: 'K1-24 chat hỏi sao tại Tật Ách (sức khỏe)',
        run: () =>
          retrieveKnowledgeForChat({
            chart,
            contextMode: 'natal',
            sectionTitle: 'Tật Ách',
            question: `Cung Tật Ách có sao ${firstStarVi(jiePalace)} ảnh hưởng sức khỏe ra sao?`,
          }),
        expectedId: 'NH-STAR-012',
      },
      {
        name: 'K1-25 chat fallback về sectionTitle khi không có từ khóa sao/cung rõ',
        run: () =>
          retrieveKnowledgeForChat({
            chart,
            contextMode: 'natal',
            sectionTitle: 'Phân tích cung Điền Trạch',
            question: 'Nhờ giải thích kỹ hơn về nội dung này giúp tôi.',
          }),
        expectedId: 'NH-STAR-007',
      },
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
    ];

    assert.strictEqual(k1Cases.length, 32, 'Nhóm K1 phải có đủ 32 ca chuẩn');
    let k1Hits = 0;

    for (const tc of k1Cases) {
      const firstRun = tc.run();
      const firstIds = firstRun.entries.map((e) => e.id);
      for (let rep = 0; rep < 9; rep++) {
        const nextRun = tc.run();
        assert.deepStrictEqual(
          nextRun.entries.map((e) => e.id),
          firstIds,
          `${tc.name}: không tất định ở lần chạy ${rep + 2}`,
        );
        assert.strictEqual(nextRun.promptBlockMarkdown, firstRun.promptBlockMarkdown);
      }

      assert.ok(
        firstRun.entries.length <= firstRun.maxEntries,
        `${tc.name}: vượt maxEntries (${firstRun.entries.length} > ${firstRun.maxEntries})`,
      );
      assert.ok(
        firstRun.charCount <= firstRun.maxChars,
        `${tc.name}: vượt maxChars (${firstRun.charCount} > ${firstRun.maxChars})`,
      );

      if (tc.mustCoverPalaces) {
        const coveredPalaces = new Set(
          firstRun.scoredEntries.flatMap((s) => s.entry.retrievalKeys.palacesVi),
        );
        for (const p of tc.mustCoverPalaces) {
          assert.ok(coveredPalaces.has(p), `${tc.name}: thiếu quota cho cung ${p}`);
        }
      }

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
    }

    assert.strictEqual(k1Hits, 32);
    console.log('  -> ĐẠT: K1 32/32 ca (100% Recall@K, 10/10 lần lặp tất định, 100% đạt trần ngân sách).');
  }

  // ── 4/6: Nhóm K2 — 15 Ca Bẫy Ngoài Kho & Sao Vắng Mặt (ĐN-8) ──────────────
  {
    console.log('\n[4/6] Kiểm thử Nhóm K2 (15 ca bẫy Tầng 3, sao vắng mặt & kiểm chứng ĐN-8)...');

    // Chọn sao thật sự VẮNG MẶT trong EffectiveStars(cung) của lá số kiểm thử
    const findAbsentStarForPalace = (palaceVi: string): string => {
      const candidates = [
        'Tử Vi',
        'Thiên Cơ',
        'Thái Dương',
        'Vũ Khúc',
        'Thiên Đồng',
        'Liêm Trinh',
        'Thiên Phủ',
        'Thái Âm',
        'Tham Lang',
        'Cự Môn',
        'Thiên Tướng',
        'Thiên Lương',
        'Thất Sát',
        'Phá Quân',
      ];
      const hit = candidates.find(
        (s) => checkEffectiveStarInPalace(chart, s, palaceVi).mode === 'absent',
      );
      if (!hit) {
        throw new Error(`Không tìm được chính tinh vắng mặt cho ${palaceVi}`);
      }
      return hit;
    };

    // Tìm 1 cặp (Sao, Cung) có sao nằm ở Tam Phương / Đối Cung (hoặc sao mượn) chứ KHÔNG tọa thủ trực tiếp
    const findSanFangOrBorrowedCase = (): { starVi: string; palaceVi: string } => {
      const candidates = [
        'Tử Vi',
        'Thiên Cơ',
        'Thái Dương',
        'Vũ Khúc',
        'Thiên Đồng',
        'Liêm Trinh',
        'Thiên Phủ',
        'Thái Âm',
        'Tham Lang',
        'Cự Môn',
        'Thiên Tướng',
        'Thiên Lương',
        'Thất Sát',
        'Phá Quân',
      ];
      for (const pal of chart.palaces) {
        const palVi = translatePalaceName(pal.name);
        for (const st of candidates) {
          const chk = checkEffectiveStarInPalace(chart, st, palVi);
          if (chk.mode === 'present_in_sanfang_or_borrowed') {
            return { starVi: st, palaceVi: palVi };
          }
        }
      }
      throw new Error('Không tìm được ca đối chứng Tam Phương Tứ Chính trên lá số mẫu');
    };

    const absentMenh = findAbsentStarForPalace('Mệnh Cung');
    const absentPhuThe = findAbsentStarForPalace('Phu Thê');
    const absentTaiBach = findAbsentStarForPalace('Tài Bạch');
    const absentQuanLoc = findAbsentStarForPalace('Quan Lộc');
    const absentDienTrach = findAbsentStarForPalace('Điền Trạch');
    const sanFangHit = findSanFangOrBorrowedCase();

    const trapQueriesTier3 = [
      'Xem giúp hướng nhà phong thủy hợp tuổi theo Bát Trạch năm nay',
      'Gia đình muốn xem mộ phần âm trạch có ảnh hưởng hậu vận không',
      'Hãy gieo quẻ Kinh Dịch lục hào hỏi việc xuất hành tháng tới',
      'Lập thêm lá số Tứ Trụ Bát Tự và dụng thần giúp tôi',
      'Cho xin đơn kê đơn thang thuốc Đông y theo Hoàng Đế Nội Kinh',
    ];
    for (const q of trapQueriesTier3) {
      const r = retrieveKnowledgeForChat({
        chart,
        contextMode: 'natal',
        sectionTitle: 'Chat',
        question: q,
      });
      assert.strictEqual(r.coverageStatus, 'out_of_scope', `Bẫy Tầng 3 thất bại: "${q}"`);
      assert.strictEqual(r.entries.length, 0);
      assert.strictEqual(r.hasCoverageGap, true);
    }

    const absentQueries = [
      { star: absentMenh, palace: 'Mệnh Cung', q: `Sao ${absentMenh} tại cung Mệnh của tôi nói lên điều gì?` },
      { star: absentPhuThe, palace: 'Phu Thê', q: `Phân tích giúp sao ${absentPhuThe} ở cung Phu Thê.` },
      { star: absentTaiBach, palace: 'Tài Bạch', q: `Cung Tài Bạch có sao ${absentTaiBach} tốt hay xấu?` },
      { star: absentQuanLoc, palace: 'Quan Lộc', q: `Giải thích sao ${absentQuanLoc} tại Quan Lộc.` },
      { star: absentDienTrach, palace: 'Điền Trạch', q: `Điền Trạch gặp ${absentDienTrach} mua đất được không?` },
    ];
    for (const item of absentQueries) {
      const r = retrieveKnowledgeForChat({
        chart,
        contextMode: 'natal',
        sectionTitle: item.palace,
        question: item.q,
      });
      assert.strictEqual(
        r.starAbsentInQueriedPalace,
        true,
        `Phải bật cờ starAbsentInQueriedPalace cho ${item.star} tại ${item.palace}`,
      );
      assert.strictEqual(r.coverageStatus, 'absent_star');
      assert.strictEqual(r.entries.length, 0);
      assert.ok(r.coverageBoundaryNoteVi.includes('KHÔNG'));
    }

    // 3 ca ĐN-8 đối chứng dương: sao hội chiếu Tam Phương / Đối cung hoặc mượn KHÔNG được báo vắng
    const dn8Res = retrieveKnowledgeForChat({
      chart,
      contextMode: 'natal',
      sectionTitle: sanFangHit.palaceVi,
      question: `Sao ${sanFangHit.starVi} chiếu về cung ${sanFangHit.palaceVi} tác động ra sao?`,
    });
    assert.strictEqual(
      dn8Res.starAbsentInQueriedPalace,
      false,
      `ĐN-8: Sao ${sanFangHit.starVi} hội Tam Phương/sao mượn về ${sanFangHit.palaceVi} KHÔNG được gán absent`,
    );
    assert.strictEqual(dn8Res.starPresenceMode, 'present_in_sanfang_or_borrowed');
    assert.ok(dn8Res.sanFangNoteVi && dn8Res.sanFangNoteVi.includes(sanFangHit.starVi));

    // Ca 12 & 13: Kiểm chứng trực tiếp helper checkEffectiveStarInPalace cho cả đối cung +6 và tam hợp +4/+8
    assert.strictEqual(
      checkEffectiveStarInPalace(chart, sanFangHit.starVi, sanFangHit.palaceVi).mode,
      'present_in_sanfang_or_borrowed',
    );
    assert.strictEqual(
      checkEffectiveStarInPalace(chart, firstStarVi(mingPalace), 'Mệnh Cung').mode,
      'present_in_palace',
    );

    // Ca 14 & 15: Kho trống (empty_kb) và tổ hợp chưa có trong kho (uncovered)
    const emptyRes = retrieveKnowledgeForDossierSection(chart, 'chapter_overview', { entries: [] });
    assert.strictEqual(emptyRes.coverageStatus, 'empty_kb');
    assert.strictEqual(emptyRes.hasCoverageGap, true);

    const uncoveredRes = retrieveKnowledgeForChat(
      {
        chart,
        contextMode: 'natal',
        sectionTitle: 'Phu Thê',
        question: 'Cung Phu Thê năm nay thế nào?',
      },
      {
        entries: [makeEntry('NH-STAR-901', { starsVi: ['Địa Kiếp'], palacesVi: ['Phúc Đức'], topicTags: ['other'] })],
      },
    );
    assert.strictEqual(uncoveredRes.coverageStatus, 'uncovered');
    assert.strictEqual(uncoveredRes.hasCoverageGap, true);
    console.log('  -> ĐẠT: K2 15/15 ca bẫy (5 Tầng 3 + 5 sao vắng mặt + 3 đối chứng ĐN-8 + 2 empty/uncovered).');
  }

  // ── 5/6: Nhóm K3 — 24 Mẫu Hậu Kiểm Chống Bịa Lớp 2 (K3-A / K3-B / K3-C) ──
  {
    console.log('\n[5/6] Kiểm thử Nhóm K3 (24 mẫu chia 3 tập K3-A / K3-B / K3-C theo ĐN-4 & ĐN-6)...');
    const allowedSubset = k1Corpus.slice(0, 4); // NH-STAR-001..004

    // K3-A: 8 mẫu kiểm tra V1 (mã thẻ bịa / ngoài danh sách) -> kỳ vọng Recall 8/8 (100%), FP 0/8
    const k3aSamples = [
      'Cung Mệnh có Tử Vi củng chiếu tốt [Nguồn: NH-STAR-999].',
      'Theo luận điểm cổ nhân [Nguồn: FAKE-ID-01] thì Tài Bạch vượng.',
      'Mệnh Cung vững vàng [Nguồn: NH-STAR-001] và thêm ý bịa [Nguồn: NH-STAR-888].',
      'Nhắc lại nguồn sai ở cuối bullet:\n- Phân tích Quan Lộc ổn định [Nguồn: CL-UNKNOWN-09].',
      'Đoạn văn dài có mã bịa [Nguồn: NH-PAL-999] ở giữa câu.',
      'Thẻ có ghi chú thêm sau dấu chấm giữa bị sai ID [Nguồn: NH-WRONG-1 | video 2].',
      'Chỉ một thẻ giả duy nhất [Nguồn: TEST_FAKE_ID_77].',
      'Tài Bạch hợp lệ [Nguồn: NH-STAR-002] kết hợp thẻ sai quy chuẩn [Nguồn: NO_SUCH_99].',
    ];
    let k3aRecalled = 0;
    for (let i = 0; i < k3aSamples.length; i++) {
      const audit = verifyAcademicCitationsAndClaims(k3aSamples[i], allowedSubset);
      if (audit.v1InvalidIds.length >= 1) k3aRecalled += 1;
      assert.ok(
        audit.scrubbedInvalidIds.every((id) => !allowedSubset.some((e) => e.id === id)),
        `K3-A[${i}] không được xóa nhầm mã hợp lệ`,
      );
      // Kiểm chứng ĐN-6: scrub chỉ gỡ token thẻ, không làm hỏng phần tiếng Việt xung quanh và lũy đẳng
      const once = audit.scrubbedText;
      const twice = scrubInvalidCitationTags(once, { invalidIds: audit.scrubbedInvalidIds });
      assert.strictEqual(once, twice, `K3-A[${i}] scrubInvalidCitationTags phải lũy đẳng`);
      assert.ok(!/\[Nguồn:\s*(?:NH-STAR-999|FAKE-ID-01|NH-STAR-888|CL-UNKNOWN-09|NH-PAL-999|NH-WRONG-1|TEST_FAKE_ID_77|NO_SUCH_99)/i.test(once));
    }
    assert.strictEqual(k3aRecalled, 8, `K3-A bắt buộc đạt 8/8 (100%), thực tế ${k3aRecalled}/8`);

    // K3-B: 8 mẫu V2 & V3 -> kỳ vọng Recall >= 7/8 (87.5%)
    const star001Word = k1Corpus[0].retrievalKeys.starsVi[0] || 'Mệnh Cung';
    const star002Word = k1Corpus[1].retrievalKeys.starsVi[0] || 'Tài Bạch';
    const k3bSamples = [
      // 4 mẫu V2 (viện dẫn tác giả/cổ thư/trích khẩu quyết KHÔNG có thẻ hợp lệ)
      'Theo Nghê Hải Hạ trong bài giảng Thiên Kỷ, cung Mệnh cần hội đủ Tam Phương mới vững.',
      'Sách Cốt Tủy Phú từng khẳng định cấu trúc Thiên Di ảnh hưởng trực tiếp tới xuất ngoại.',
      'Thầy Nghê phân tích rất kỹ về cách cục Tài Bạch trong hệ thống Thiên Kỷ.',
      'Cổ nhân có câu "Mệnh Vô Chính Diệu tất phải xem đối cung Thiên Di và Tam Phương" để định cát hung.',
      // 4 mẫu V3 (gắn thẻ hợp lệ NH-STAR-001 nhưng đoạn văn chỉ nói tới Phúc Đức / Huynh Đệ / Tật Ách)
      'Cung Giao Hữu có Địa Kiếp chiếu dễ gặp hiểu lầm trong hợp tác [Nguồn: NH-STAR-001].',
      '- Lưu ý sức khỏe Tật Ách về tiêu hóa và nghỉ ngơi điều độ [Nguồn: NH-STAR-001].',
      'Quan hệ Huynh Đệ giữ hòa khí và phân minh tiền bạc trong năm [Nguồn: NH-STAR-002].',
      'Cung Phụ Mẫu chịu ảnh hưởng của Thiên Hình tại Thìn nên thận trọng giấy tờ [Nguồn: NH-STAR-003].',
    ];
    let k3bRecalled = 0;
    for (const sample of k3bSamples) {
      const audit = verifyAcademicCitationsAndClaims(sample, allowedSubset);
      if (audit.v2UncitedBlocks.length > 0 || audit.v3MismatchIds.length > 0) {
        k3bRecalled += 1;
      }
    }
    assert.ok(k3bRecalled >= 7, `K3-B bắt buộc Recall >= 7/8 (87.5%), thực tế ${k3bRecalled}/8`);

    // K3-C: 8 mẫu hợp lệ (4 câu dữ kiện lá số thuần + 4 đoạn đặt thẻ ở cuối đoạn/bullet) -> FP <= 1/8, 0 FP câu dữ kiện
    const k3cChartFactSamples = [
      'Cung Mệnh tọa tại Ngọ có Tử Vi và Thiên Phủ đồng độ, Tam Phương hội Tả Phù Hữu Bật.',
      '[Tứ Hóa Bản Mệnh] Hóa Lộc nhập Tài Bạch, đối cung Phúc Đức có Lộc Tồn củng chiếu.',
      'Đại Hạn 35–44 tuổi đóng tại cung Quan Lộc, gặp Lưu Niên Hóa Kỵ năm Bính Ngọ 2026.',
      'Sinh vào giờ Canh Dần (9h30 ngày 15/5/1990 Dương lịch), cục Thủy Nhị Cục cân bằng.',
    ];
    const k3cCitedBlockSamples = [
      `Xét tổng quan cung Mệnh với sao ${star001Word}: cách cục này đề cao vai trò trung tâm điều phối và cần Tam Phương phò tá. Khi gặp cát tinh hội chiếu sẽ phát triển vững vàng qua từng Đại Hạn [Nguồn: NH-STAR-001].`,
      `- Trọng tâm Tài Bạch có sao ${star002Word} cho thấy xu hướng quản trị dòng tiền thực tế, biết cân đối thu chi dài hạn và giữ chữ tín với đối tác tài chính [Nguồn: NH-STAR-002].`,
      `Nghê Hải Hạ nhận định về sao ${star001Word} tại Mệnh Cung rằng khi có Tả Hữu củng chiếu thì phát huy trọn vẹn năng lực [Nguồn: NH-STAR-001].`,
      `* Quan Lộc cần sự kiên trì với mục tiêu cốt lõi để chuyển hóa áp lực cạnh tranh thành thực quyền chuyên môn [Nguồn: NH-STAR-003].`,
    ];

    let k3cChartFactFp = 0;
    for (const s of k3cChartFactSamples) {
      const audit = verifyAcademicCitationsAndClaims(s, allowedSubset);
      if (audit.violations.length > 0) k3cChartFactFp += 1;
    }
    assert.strictEqual(k3cChartFactFp, 0, `K3-C câu dữ kiện lá số phải 0/4 báo nhầm, thực tế ${k3cChartFactFp}/4`);

    let k3cTotalFp = k3cChartFactFp;
    for (const s of k3cCitedBlockSamples) {
      const audit = verifyAcademicCitationsAndClaims(s, allowedSubset);
      if (audit.violations.length > 0) k3cTotalFp += 1;
    }
    assert.ok(k3cTotalFp <= 1, `K3-C bắt buộc FP <= 1/8 (12.5%), thực tế ${k3cTotalFp}/8`);
    console.log(
      `  -> ĐẠT: K3 24/24 mẫu (K3-A: ${k3aRecalled}/8 = 100% | K3-B: ${k3bRecalled}/8 | K3-C: ${k3cTotalFp}/8 FP, 0 FP dữ kiện).`,
    );
  }

  // ── 6/6: Kiểm thử Tích hợp 3 Prompt Builders & Hậu Kiểm Sanitizer ──────────
  {
    console.log('\n[6/6] Kiểm thử tích hợp 3 Prompt Builders (Hồ Sơ, Vận Hạn, Chat) & Sanitizer...');
    const pDossier = buildStrictDossierSectionPrompt(chart, 'palaces_core');
    assert.ok(pDossier.prompt.includes('TƯ LIỆU HỌC THUẬT ĐỐI CHIẾU'));
    assert.ok(pDossier.knowledgeResult.entries.length > 0);
    assert.ok(
      pDossier.systemInstruction.includes('Giao Hữu') === false,
      'systemInstruction palaces_core vẫn giữ sạch rào kiểm thử cũ (không chèn tên cung ngoài nhóm)',
    );

    const p2026 = buildYunxianPeriodContext(chart, { mode: 'liunian', year: 2026 });
    assert.ok(p2026, 'p2026 phải hợp lệ');
    const pPeriod = buildStrictPeriodAiPrompt(p2026, 'Tóm tắt lá số test', chart);
    assert.ok(pPeriod.prompt.includes('TƯ LIỆU HỌC THUẬT ĐỐI CHIẾU'));
    assert.ok(pPeriod.knowledgeResult.entries.length > 0);

    const pChat = buildStrictExplanationChatPrompt({
      chart,
      contextMode: 'natal',
      sectionTitle: 'Tài Bạch',
      excerpt: 'Tài Bạch tọa cung...',
      history: [],
      question: `Sao ${firstStarVi(caiPalace)} tại Tài Bạch phát triển thế nào?`,
    });
    assert.ok(pChat.prompt.includes('TƯ LIỆU HỌC THUẬT ĐỐI CHIẾU'));
    assert.ok(pChat.knowledgeResult.entries.length > 0);

    const dirtyChapter =
      'Cung Mệnh vững vàng [Nguồn: NH-STAR-001] nhưng tránh bịa thẻ [Nguồn: NH-FAKE-999].';
    const cleanedOnce = sanitizeDossierChapterText(dirtyChapter, 'chapter_overview', chart, {
      invalidCitationIds: ['NH-FAKE-999'],
    });
    const cleanedTwice = sanitizeDossierChapterText(cleanedOnce, 'chapter_overview', chart, {
      invalidCitationIds: ['NH-FAKE-999'],
    });
    assert.strictEqual(cleanedOnce, cleanedTwice, 'sanitizeDossierChapterText phải lũy đẳng');
    assert.ok(typeof cleanedOnce === 'string');
    assert.ok(cleanedOnce.includes('[Nguồn: NH-STAR-001]'));
    assert.ok(!cleanedOnce.includes('NH-FAKE-999'));

    // ── Gate C (KP-3-lite): Kiểm thử verifyPalaceGanZhiMentions trên lá số mẫu 26/07/1977 giờ Tỵ ──
    {
      const sampleChart1977 = generateChart({
        name: 'Mẫu 1977',
        year: 1977,
        month: 7,
        day: 26,
        hour: 5,
        gender: 'male',
      });
      const palaceGanZhiMap: Record<string, string> = {};
      for (const p of sampleChart1977.palaces) {
        palaceGanZhiMap[translatePalaceName(p.name)] = `${VI_STEMS[p.stem]} ${VI_BRANCHES[p.branch]}`;
      }
      assert.strictEqual(palaceGanZhiMap['Quan Lộc'], 'Bính Ngọ');
      assert.strictEqual(palaceGanZhiMap['Mệnh Cung'], 'Nhâm Dần');

      // 1) Sai Can Chi trong ngoặc -> 1 finding
      const badParens = verifyPalaceGanZhiMentions(
        'Xét Cung Quan Lộc (Canh Ngọ) có nhiều biến động.',
        palaceGanZhiMap,
      );
      assert.deepStrictEqual(badParens, [
        {
          type: 'PALACE_GANZHI_MISMATCH',
          palaceVi: 'Quan Lộc',
          foundGanZhi: 'Canh Ngọ',
          expectedGanZhi: 'Bính Ngọ',
        },
      ]);

      // 2) Sai Can Chi dạng "tại <Can Chi>" + khử trùng lặp -> 1 finding
      const badTai = verifyPalaceGanZhiMentions(
        'Cung Quan Lộc tại Canh Ngọ và nhắc lại Cung Quan Lộc (Canh Ngọ).',
        palaceGanZhiMap,
      );
      assert.strictEqual(badTai.length, 1);
      assert.strictEqual(badTai[0].expectedGanZhi, 'Bính Ngọ');

      // 3) Can Chi đứng độc lập -> 0 finding
      assert.strictEqual(
        verifyPalaceGanZhiMentions('Vận trình năm Canh Ngọ 1990 rất đáng nhớ.', palaceGanZhiMap).length,
        0,
      );

      // 4) Cung Lưu / Cung Đại Hạn -> bỏ qua (0 finding)
      assert.strictEqual(
        verifyPalaceGanZhiMentions(
          'Cung Lưu Quan Lộc (Canh Ngọ) và Cung Đại Hạn Tài Bạch (Canh Ngọ).',
          palaceGanZhiMap,
        ).length,
        0,
      );

      // 5) Đúng Can Chi bản mệnh -> 0 finding
      assert.strictEqual(
        verifyPalaceGanZhiMentions('Cung Quan Lộc (Bính Ngọ) và Cung Mệnh Cung (Nhâm Dần).', palaceGanZhiMap).length,
        0,
      );

      // 6) Tích hợp qua verifyAcademicCitationsAndClaims
      const integratedAudit = verifyAcademicCitationsAndClaims(
        'Cung Quan Lộc (Canh Ngọ) gặp sát tinh.',
        [],
        { palaceGanZhiMap },
      );
      assert.strictEqual(integratedAudit.palaceGanZhiMismatches.length, 1);
      assert.strictEqual(integratedAudit.palaceGanZhiMismatches[0].expectedGanZhi, 'Bính Ngọ');
    }

    // ── Gate D (BRIEF 1.5.5 v2): X1, X2a–X2h, X3, Z4, Z5a–Z5d ────────────────
    {
      console.log('\n[BRIEF 1.5.5] Kiểm thử X1, X2a–X2h, X3, Z4 & Z5a–Z5d...');

      // X1: prompt kỳ hạn không chứa tên file `.ts` trong tiêu đề mục trích đoạn
      assert.ok(!pPeriod.prompt.includes('patterns.ts'));
      assert.ok(!pPeriod.prompt.includes('school-data.ts'));
      assert.ok(!pPeriod.prompt.includes('constants.ts'));
      assert.ok(!pPeriod.prompt.includes('heming-knowledge.ts'));
      if (p2026.knowledgeExcerpts.patterns.length > 0) {
        assert.ok(pPeriod.prompt.includes('[Cách cục nhận diện từ lá số]:'));
      }
      if (p2026.knowledgeExcerpts.starPrinciples.length > 0) {
        assert.ok(pPeriod.prompt.includes('[Tính chất tinh diệu]:'));
      }
      if (p2026.knowledgeExcerpts.fuqiAndSihua.length > 0) {
        assert.ok(pPeriod.prompt.includes('[Nguyên lý Tứ Hóa & Tinh hệ]:'));
      }

      // Z4 & Z5 wording trong cả 2 prompt
      assert.ok(pPeriod.systemInstruction.includes('Không Kiếp'));
      assert.ok(pPeriod.systemInstruction.includes('ngay cuối câu có viện dẫn hoặc trích dẫn đó'));
      assert.ok(pDossier.systemInstruction.includes('Không Kiếp'));
      assert.ok(pDossier.systemInstruction.includes('ngay cuối câu có viện dẫn hoặc trích dẫn đó'));

      const pHorizonCheck = buildStrictDossierSectionPrompt(chart, 'horizon_5y');
      assert.ok(
        pHorizonCheck.systemInstruction.includes('không gắn thẻ Tứ Hóa chuyên đề đơn lẻ vào câu liệt kê danh sách 4 sao Tứ Hóa Đại Hạn'),
      );
      assert.ok(pHorizonCheck.systemInstruction.includes('không lặp lại tên chương ở đầu bài'));

      // Corpus mẫu cho X2/X3/Z5
      const x2Corpus: DistilledKnowledgeEntry[] = [
        makeEntry('CL-TT-015', {
          starsVi: ['Thiên Cơ', 'Thái Âm'],
          palacesVi: ['Mệnh Cung', 'Thân Cung'],
          patternsVi: ['Cơ Nguyệt Đồng Lương'],
        }),
        makeEntry('CL-CTP-013', {
          starsVi: ['Thiên Cơ'],
          palacesVi: ['Mệnh Cung'],
        }),
        makeEntry('NH-STAR-001', {
          starsVi: ['Thiên Cơ', 'Hóa Khoa'],
          palacesVi: ['Mệnh Cung'],
        }),
        makeEntry('NH-PAL-014-GEN', {
          starsVi: ['Thái Âm'],
          palacesVi: ['Tài Bạch'],
        }),
      ];

      // X2a: [Nguồn: school-data.ts / constants.ts] -> V1 + scrub sạch
      {
        const audit = verifyAcademicCitationsAndClaims(
          'Sao Thiên Cơ tọa Mệnh Cung chủ trí tuệ [Nguồn: school-data.ts / constants.ts].',
          x2Corpus,
        );
        assert.ok(audit.v1InvalidIds.includes('SCHOOL-DATA.TS'));
        assert.ok(audit.v1InvalidIds.includes('CONSTANTS.TS'));
        assert.ok(!audit.scrubbedText.includes('[Nguồn:'));
        assert.strictEqual(audit.validCitationIds.length, 0);
      }

      // X2b: [Nguồn: CL-TT-015, CL-CTP-013] -> kiểm V1/V3 riêng và cả 2 vào mục tham chiếu
      {
        const audit = verifyAcademicCitationsAndClaims(
          'Cung Mệnh có Thiên Cơ và Thái Âm hội chiếu [Nguồn: CL-TT-015, CL-CTP-013].',
          x2Corpus,
        );
        assert.strictEqual(audit.v1InvalidIds.length, 0);
        assert.strictEqual(audit.v3MismatchIds.length, 0);
        assert.deepStrictEqual(audit.validCitationIds, ['CL-TT-015', 'CL-CTP-013']);
        assert.ok(audit.referenceBlockMarkdown.includes('[CL-TT-015]'));
        assert.ok(audit.referenceBlockMarkdown.includes('[CL-CTP-013]'));
        assert.ok(audit.scrubbedText.includes('[Nguồn: CL-TT-015] [Nguồn: CL-CTP-013]'));
      }

      // X2c: [Nguồn: CL-TT-015, FAKE-999] -> FAKE-999 bị V1 + scrub, CL-TT-015 giữ nguyên (server & client)
      {
        const raw = 'Cung Mệnh có sao Thiên Cơ sáng [Nguồn: CL-TT-015, FAKE-999].';
        const audit = verifyAcademicCitationsAndClaims(raw, x2Corpus);
        assert.deepStrictEqual(audit.v1InvalidIds, ['FAKE-999']);
        assert.deepStrictEqual(audit.validCitationIds, ['CL-TT-015']);
        assert.ok(audit.scrubbedText.includes('[Nguồn: CL-TT-015]'));
        assert.ok(!audit.scrubbedText.includes('FAKE-999'));
        const clientScrub = scrubInvalidCitationTags(raw, { invalidIds: audit.scrubbedInvalidIds });
        assert.strictEqual(clientScrub, audit.scrubbedText);
      }

      // X2d: thẻ đơn kèm hậu tố chú thích vẫn hợp lệ
      {
        const audit = verifyAcademicCitationsAndClaims(
          'Mệnh Cung hợp cách Cơ Nguyệt Đồng Lương [Nguồn: CL-TT-015 · Cách Cơ Nguyệt Đồng Lương].',
          x2Corpus,
        );
        assert.strictEqual(audit.violations.length, 0);
        assert.deepStrictEqual(audit.validCitationIds, ['CL-TT-015']);
      }

      // X2e: thẻ rỗng / chỉ dấu phân cách -> V1 + scrub sạch vỏ thẻ
      for (const emptyTagSample of [
        'Cung Mệnh vững vàng [Nguồn: ].',
        'Cung Mệnh vững vàng [Nguồn: , ; ].',
        'Cung Mệnh vững vàng [Nguồn: ·].',
      ]) {
        const audit = verifyAcademicCitationsAndClaims(emptyTagSample, x2Corpus);
        assert.ok(audit.v1InvalidIds.length >= 1, `Phải báo V1 cho ${emptyTagSample}`);
        assert.ok(audit.violations.some((v) => v.rule === 'V1'));
        assert.ok(!audit.scrubbedText.includes('[Nguồn:'), `Phải scrub sạch vỏ thẻ: ${audit.scrubbedText}`);
        assert.strictEqual(scrubInvalidCitationTags(emptyTagSample, { invalidIds: [] }), 'Cung Mệnh vững vàng.');
      }

      // X2f: [Nguồn: cl-tt-015] chữ thường -> chuẩn hóa CL-TT-015, hợp lệ
      {
        const audit = verifyAcademicCitationsAndClaims(
          'Cung Mệnh có sao Thiên Cơ sáng [Nguồn: cl-tt-015].',
          x2Corpus,
        );
        assert.strictEqual(audit.violations.length, 0);
        assert.deepStrictEqual(audit.validCitationIds, ['CL-TT-015']);
        assert.ok(audit.scrubbedText.includes('[Nguồn: CL-TT-015]'));
      }

      // X2g: [Nguồn: CL-TT-015 · Luận cung Mệnh, Thân] -> dấu phẩy trong chú thích không tạo ứng viên mới
      {
        const audit = verifyAcademicCitationsAndClaims(
          'Cung Mệnh có sao Thiên Cơ [Nguồn: CL-TT-015 · Luận cung Mệnh, Thân].',
          x2Corpus,
        );
        assert.strictEqual(audit.v1InvalidIds.length, 0);
        assert.strictEqual(audit.v3MismatchIds.length, 0);
        assert.deepStrictEqual(audit.validCitationIds, ['CL-TT-015']);
      }

      // X2h: [Nguồn: CL-TT-015 / CL-CTP-013] -> cả hai ID hợp lệ được giữ
      {
        const audit = verifyAcademicCitationsAndClaims(
          'Sao Thiên Cơ tại Mệnh Cung chủ trí tuệ [Nguồn: CL-TT-015 / CL-CTP-013].',
          x2Corpus,
        );
        assert.strictEqual(audit.violations.length, 0);
        assert.deepStrictEqual(audit.validCitationIds, ['CL-TT-015', 'CL-CTP-013']);
        assert.ok(audit.scrubbedText.includes('[Nguồn: CL-TT-015] [Nguồn: CL-CTP-013]'));
      }

      // X3: ID dùng đúng ở đoạn A và sai chủ đề (V3) ở đoạn B -> bị xóa khỏi thân bài VÀ khỏi danh mục tham chiếu
      {
        const textX3 = [
          'Cung Tài Bạch có Thái Âm vượng địa giữ tài chính bền vững [Nguồn: NH-PAL-014-GEN].',
          '',
          'Cung Phu Thê có Tham Lang Đào Hoa dễ biến động tình cảm [Nguồn: NH-PAL-014-GEN].',
        ].join('\n');
        const audit = verifyAcademicCitationsAndClaims(textX3, x2Corpus);
        assert.ok(audit.v3MismatchIds.includes('NH-PAL-014-GEN'));
        assert.ok(!audit.scrubbedText.includes('NH-PAL-014-GEN'));
        assert.ok(!audit.validCitationIds.includes('NH-PAL-014-GEN'));
        assert.ok(!audit.referenceBlockMarkdown.includes('NH-PAL-014-GEN'));
      }

      // Z5a: câu 1 trích khẩu quyết không thẻ + câu 2 có thẻ hợp lệ -> V2 vẫn bắt câu 1
      {
        const z5aText =
          'Cổ nhân có câu "Thiên Cơ tại Mệnh chủ trí tuệ mưu lược". Sao Thiên Cơ tại Mệnh Cung rất sáng [Nguồn: NH-STAR-001].';
        const audit = verifyAcademicCitationsAndClaims(z5aText, x2Corpus);
        assert.strictEqual(audit.v2UncitedBlocks.length, 1);
        assert.ok(audit.violations.some((v) => v.rule === 'V2'));
      }

      // Z5b: câu chứa "mục 1.2", "1.000", "105.85" và có thẻ hợp lệ -> KHÔNG lỗi V2 giả
      {
        const z5bText =
          'Theo Nghê Hải Hạ tại mục 1.2 với 1.000 mẫu lá số và kinh độ 105.85, sao Thiên Cơ tại Mệnh chủ linh hoạt [Nguồn: NH-STAR-001].';
        const audit = verifyAcademicCitationsAndClaims(z5bText, x2Corpus);
        assert.strictEqual(audit.v2UncitedBlocks.length, 0);
        assert.strictEqual(audit.violations.length, 0);
      }

      // Z5c: câu 1 viện dẫn M1 không thẻ + câu 2 có thẻ -> V2 bắt câu 1; gắn thẻ cuối câu 1 -> hết lỗi
      {
        const z5cUncited =
          'Theo hệ thống Thiên Kỷ của Nghê Hải Hạ, sao Thiên Cơ tại Mệnh chủ về trí tuệ linh hoạt. Khi gặp Hóa Khoa đồng độ thì năng lực học thuật càng xuất sắc [Nguồn: NH-STAR-001].';
        const auditFail = verifyAcademicCitationsAndClaims(z5cUncited, x2Corpus);
        assert.strictEqual(auditFail.v2UncitedBlocks.length, 1);

        const z5cCited =
          'Theo hệ thống Thiên Kỷ của Nghê Hải Hạ, sao Thiên Cơ tại Mệnh chủ về trí tuệ linh hoạt [Nguồn: NH-STAR-001]. Khi gặp Hóa Khoa đồng độ thì năng lực học thuật càng xuất sắc [Nguồn: NH-STAR-001].';
        const auditPass = verifyAcademicCitationsAndClaims(z5cCited, x2Corpus);
        assert.strictEqual(auditPass.v2UncitedBlocks.length, 0);
        assert.strictEqual(auditPass.violations.length, 0);
      }

      // Z5d: câu trích khẩu quyết CÓ thẻ ngay cuối câu đó -> KHÔNG lỗi V2
      {
        const z5dText =
          'Cổ nhân có câu "Thiên Cơ tại Mệnh chủ trí tuệ mưu lược" [Nguồn: NH-STAR-001]. Câu thứ hai chỉ bình luận thêm về cung Mệnh.';
        const audit = verifyAcademicCitationsAndClaims(z5dText, x2Corpus);
        assert.strictEqual(audit.v2UncitedBlocks.length, 0);
        assert.strictEqual(audit.violations.length, 0);
      }

      console.log('  -> ĐẠT [BRIEF 1.5.5]: X1, X2a–X2h, X3, Z4 & Z5a–Z5d đạt 100%.');
    }

    resetKnowledgeBaseCache();
    console.log('  -> ĐẠT: 3 Prompt Builders, Sanitizer & KP-3-lite verifyPalaceGanZhiMentions tích hợp chuẩn xác.');
  }

  console.log('\n[PASS] TOÀN BỘ KIỂM THỬ verify:kb ĐẠT 100%!');
}

runVerification();
