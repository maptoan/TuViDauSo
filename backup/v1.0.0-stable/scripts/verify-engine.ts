/**
 * scripts/verify-engine.ts
 *
 * Đối chiếu toàn diện thuật toán lập lá số Tử Vi của ứng dụng (src/lib/ziwei/*)
 * với bộ test hồi quy gốc từ repo https://github.com/Renhuai123/ziwei-doushu:
 *   1. scripts/regression/pan-integrity.test.ts (768 lá số × 7 thiết luật)
 *   2. Đối chiếu bảng Tứ Hóa 10 Thiên Can (sihua.ts & constants.ts)
 *   3. 6 bộ test hồi quy Cách Cục & Tứ Hóa:
 *      - patterns-dingfu.test.ts
 *      - patterns-dinggui.test.ts
 *      - patterns-dingpin.test.ts
 *      - patterns-dingza.test.ts
 *      - patterns-sihua-bonus.test.ts
 *      - natal-dual-sihua-same-palace.test.ts
 *   4. Xuất JSON đầy đủ của 3 lá số mẫu từ generateChart thô (không qua hiệu chỉnh Chân Thái Dương Thời):
 *      (i)   1960-01-05, giờ Tý (hour=0), male
 *      (ii)  1995-08-16, giờ Tỵ (hour=5), female
 *      (iii) 2010-10-25, giờ Thân (hour=8), male
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Import từ engine đã port trong dự án (chỉ đổi đường dẫn ../../lib/ziwei/* -> ../src/lib/ziwei/*) ──
import { generateChart } from '../src/lib/ziwei/algorithm';
import type { BirthInfo, ZiweiChart, SiHua } from '../src/lib/ziwei/types';
import { STEMS, BRANCHES, SI_HUA_TABLE } from '../src/lib/ziwei/constants';
import { getSiHuaByStem } from '../src/lib/ziwei/sihua';
import { SCHOOL_SIHUA_DEFAULT, SCHOOL_STAR_ID_TO_NAME } from '../src/lib/ziwei/school-data';
import { detectPatterns } from '../src/lib/ziwei/patterns';
import {
  DING_FU_GE,
  DING_FU_JUDGEABLE,
  DING_FU_UNREACHABLE,
  detectDingFu,
} from '../src/lib/ziwei/patterns-dingfu';
import {
  DING_GUI_GE,
  DING_GUI_JUDGEABLE,
  DING_GUI_UNREACHABLE,
  detectDingGui,
} from '../src/lib/ziwei/patterns-dinggui';
import {
  DING_PIN_GE,
  DING_PIN_JUDGEABLE,
  DING_PIN_UNREACHABLE,
  detectDingPin,
} from '../src/lib/ziwei/patterns-dingpin';
import {
  DING_ZA_GE,
  DING_ZA_JUDGEABLE,
  detectDingZa,
  getCurrentDingZa,
} from '../src/lib/ziwei/patterns-dingza';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// PHẦN 1: CHÉP NGUYÊN VĂN LOGIC scripts/regression/pan-integrity.test.ts
// Thay đổi duy nhất: đường dẫn import '../../lib/ziwei/...' -> '../src/lib/ziwei/...'
// Đồng thời ghi nhận bộ đếm pass/fail chi tiết cho từng Thiết Luật 1..7.
// ============================================================================
function runPanIntegrityTest() {
  console.log('================================================================================');
  console.log('PHẦN 1: KIỂM THỬ 7 THIẾT LUẬT AN SAO (scripts/regression/pan-integrity.test.ts)');
  console.log('================================================================================');

  const BR = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const PALACE_12 = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];

  let failures = 0;
  const failMessages: string[] = [];
  const fail = (msg: string) => {
    console.error(`  ✗ ${msg}`);
    failMessages.push(msg);
    failures++;
  };

  // Bộ đếm chi tiết cho từng thiết luật trên 768 lá số
  const ruleStats = {
    rule1_12Palaces: { pass: 0, fail: 0, evaluated: 0 },
    rule2_12UniquePalaceNames: { pass: 0, fail: 0, evaluated: 0 },
    rule3_12UniqueBranches0to11: { pass: 0, fail: 0, evaluated: 0 },
    rule4_UniqueMingGong: { pass: 0, fail: 0, evaluated: 0 },
    rule5_CounterClockwiseFromMing: { pass: 0, fail: 0, evaluated: 0 },
    rule6_TianJiTianLiangOnlyChenXu: { pass: 0, fail: 0, evaluated: 0, coPalaceCharts: 0 },
    rule7_ZiWeiTianFuYinShenAxisSymmetry: { pass: 0, fail: 0, evaluated: 0, ziFuCharts: 0 },
  };

  // ── 采样: 跨年代/月/时辰/性别, 覆盖足够多命盘形态 ──
  const samples: BirthInfo[] = [];
  for (let y = 1960; y <= 2010; y += 7)
    for (let m = 1; m <= 12; m += 3)
      for (let d = 5; d <= 26; d += 10)
        for (let h = 0; h < 12; h += 3)
          for (const g of ['male', 'female'] as const)
            samples.push({ year: y, month: m, day: d, hour: h, gender: g });

  console.log(`\n排盘完整性回归 — ${samples.length} 个采样命盘\n`);

  let jiliangCount = 0;
  let ziFuOppCount = 0;

  for (const bi of samples) {
    let chart: ZiweiChart;
    try {
      chart = generateChart(bi);
    } catch (e) {
      fail(`generateChart 抛错 @ ${JSON.stringify(bi)}: ${(e as Error).message}`);
      continue;
    }
    const tag = `${bi.year}-${bi.month}-${bi.day} h${bi.hour} ${bi.gender}`;

    // 铁律 1: 必须正好 12 宫
    ruleStats.rule1_12Palaces.evaluated++;
    if (chart.palaces.length !== 12) {
      ruleStats.rule1_12Palaces.fail++;
      fail(`${tag}: 宫数 ${chart.palaces.length} ≠ 12`);
      continue;
    }
    ruleStats.rule1_12Palaces.pass++;

    // 铁律 2: 12 宫名齐全且唯一(命宫/兄弟/.../父母)
    ruleStats.rule2_12UniquePalaceNames.evaluated++;
    const names = chart.palaces.map(p => p.name).sort();
    const expect = [...PALACE_12].sort();
    if (JSON.stringify(names) !== JSON.stringify(expect)) {
      ruleStats.rule2_12UniquePalaceNames.fail++;
      fail(`${tag}: 宫名集合不对 = ${names.join(',')}`);
      continue;
    }
    ruleStats.rule2_12UniquePalaceNames.pass++;

    // 铁律 3: 12 宫地支 0-11 各且仅一次
    ruleStats.rule3_12UniqueBranches0to11.evaluated++;
    const branches = chart.palaces.map(p => p.branch).sort((a, b) => a - b);
    if (JSON.stringify(branches) !== JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])) {
      ruleStats.rule3_12UniqueBranches0to11.fail++;
      fail(`${tag}: 地支不是 0-11 全覆盖 = ${branches.join(',')}`);
      continue;
    }
    ruleStats.rule3_12UniqueBranches0to11.pass++;

    // 铁律 4: 命宫唯一 + isMingGong 标记一致
    ruleStats.rule4_UniqueMingGong.evaluated++;
    const mingByName = chart.palaces.filter(p => p.name === '命宫');
    if (mingByName.length !== 1) {
      ruleStats.rule4_UniqueMingGong.fail++;
      fail(`${tag}: 命宫数量 ${mingByName.length}`);
      continue;
    }
    ruleStats.rule4_UniqueMingGong.pass++;

    // 铁律 5: 十二宫逆时针排布 — 从命宫地支起, 第 k 宫地支 = (命宫地支 - k + 12) % 12
    ruleStats.rule5_CounterClockwiseFromMing.evaluated++;
    const mingBranch = mingByName[0].branch;
    let rule5Failed = false;
    for (let k = 0; k < 12; k++) {
      const expectBranch = ((mingBranch - k) % 12 + 12) % 12;
      const pName = PALACE_12[k];
      const p = chart.palaces.find(x => x.name === pName)!;
      if (p.branch !== expectBranch) {
        fail(`${tag}: ${pName} 应在 ${BR[expectBranch]} 实际 ${BR[p.branch]}（逆时针排布坏）`);
        rule5Failed = true;
        break;
      }
    }
    if (rule5Failed) {
      ruleStats.rule5_CounterClockwiseFromMing.fail++;
    } else {
      ruleStats.rule5_CounterClockwiseFromMing.pass++;
    }

    // 铁律 6: 机梁同宫只可能在 辰 或 戌
    ruleStats.rule6_TianJiTianLiangOnlyChenXu.evaluated++;
    const jl = chart.palaces.find(p => {
      const ms = p.stars.filter(s => s.type === 'major').map(s => s.name);
      return ms.includes('天机') && ms.includes('天梁');
    });
    if (jl) {
      jiliangCount++;
      ruleStats.rule6_TianJiTianLiangOnlyChenXu.coPalaceCharts++;
      if (jl.branch !== 4 && jl.branch !== 10) {
        ruleStats.rule6_TianJiTianLiangOnlyChenXu.fail++;
        fail(`${tag}: 机梁同宫出现在 ${BR[jl.branch]}(只能辰/戌)`);
      } else {
        ruleStats.rule6_TianJiTianLiangOnlyChenXu.pass++;
      }
    } else {
      ruleStats.rule6_TianJiTianLiangOnlyChenXu.pass++;
    }

    // 铁律 7: 紫微 与 天府 永远是固定相对位置 — 同盘必同时存在, 且
    //   紫微地支 + 天府地支 关系符合"寅申线对称"(紫微+天府 地支和 ≡ 4 mod 12 是错的简化,
    //   正确铁律: 天府地支 = (4 - 紫微地支 + 12*N) → 即 紫府永远关于 寅(2)/申(8) 轴对称,
    //   等价: (紫微branch + 天府branch) % 12 === 4)
    ruleStats.rule7_ZiWeiTianFuYinShenAxisSymmetry.evaluated++;
    let ziB = -1,
      fuB = -1;
    for (const p of chart.palaces)
      for (const s of p.stars) {
        if (s.name === '紫微') ziB = p.branch;
        if (s.name === '天府') fuB = p.branch;
      }
    if (ziB >= 0 && fuB >= 0) {
      ziFuOppCount++;
      ruleStats.rule7_ZiWeiTianFuYinShenAxisSymmetry.ziFuCharts++;
      if ((ziB + fuB) % 12 !== 4) {
        ruleStats.rule7_ZiWeiTianFuYinShenAxisSymmetry.fail++;
        fail(`${tag}: 紫府对称铁律破 紫=${BR[ziB]} 府=${BR[fuB]} (和%12 应=4)`);
      } else {
        ruleStats.rule7_ZiWeiTianFuYinShenAxisSymmetry.pass++;
      }
    } else {
      ruleStats.rule7_ZiWeiTianFuYinShenAxisSymmetry.fail++;
      fail(`${tag}: 缺紫微或天府`);
    }
  }

  console.log(`采样统计: 机梁同宫盘 ${jiliangCount} 个(均验证辰/戌), 紫府盘 ${ziFuOppCount} 个(均验证对称)`);
  for (const [k, v] of Object.entries(ruleStats)) {
    console.log(`  - ${k}: pass=${v.pass}/${v.evaluated}, fail=${v.fail}`);
  }
  if (failures === 0) {
    console.log(`\n✅ 排盘完整性回归全过 (${samples.length} 盘 × 7 条紫微铁律)\n`);
  } else {
    console.error(`\n❌ 排盘完整性回归 ${failures} 处失败 — 排盘核心被改坏, 禁止上线\n`);
    process.exit(1);
  }

  return {
    totalSamples: samples.length,
    failures,
    failMessages,
    jiliangCoPalaceCount: jiliangCount,
    ziFuSymmetryCount: ziFuOppCount,
    ruleStats,
  };
}

// ============================================================================
// PHẦN 2: ĐỐI CHIẾU BẢNG TỨ HÓA 10 THIÊN CAN THEO REPO GỐC
// ============================================================================
function runSiHuaTableComparison() {
  console.log('================================================================================');
  console.log('PHẦN 2: ĐỐI CHIẾU BẢNG TỨ HÓA 10 THIÊN CAN (repo gốc vs app src/lib/ziwei/sihua.ts)');
  console.log('================================================================================');

  // Bảng Tứ Hóa nguyên bản từ repo gốc lib/ziwei/constants.ts:
  const REPO_SI_HUA_TABLE: Record<number, [string, string, string, string]> = {
    0: ['廉贞', '破军', '武曲', '太阳'], // 甲 (Giáp)
    1: ['天机', '天梁', '紫微', '太阴'], // 乙 (Ất)
    2: ['天同', '天机', '文昌', '廉贞'], // 丙 (Bính)
    3: ['太阴', '天同', '天机', '巨门'], // 丁 (Đinh)
    4: ['贪狼', '太阴', '右弼', '天机'], // 戊 (Mậu)
    5: ['武曲', '贪狼', '天梁', '文曲'], // 己 (Kỷ)
    6: ['太阳', '武曲', '太阴', '天同'], // 庚 (Canh)
    7: ['巨门', '太阳', '文曲', '文昌'], // 辛 (Tân)
    8: ['天梁', '紫微', '左辅', '武曲'], // 壬 (Nhâm)
    9: ['破军', '巨门', '太阴', '贪狼'], // 癸 (Quý)
  };

  const VI_STEM_NAMES = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
  const VI_STAR_NAMES: Record<string, string> = {
    '紫微': 'Tử Vi',
    '天机': 'Thiên Cơ',
    '太阳': 'Thái Dương',
    '武曲': 'Vũ Khúc',
    '天同': 'Thiên Đồng',
    '廉贞': 'Liêm Trinh',
    '天府': 'Thiên Phủ',
    '太阴': 'Thái Âm',
    '贪狼': 'Tham Lang',
    '巨门': 'Cự Môn',
    '天相': 'Thiên Tướng',
    '天梁': 'Thiên Lương',
    '七杀': 'Thất Sát',
    '破军': 'Phá Quân',
    '文昌': 'Văn Xương',
    '文曲': 'Văn Khúc',
    '左辅': 'Tả Phụ',
    '右弼': 'Hữu Bật',
  };

  const rows: Array<{
    stemIndex: number;
    stemZh: string;
    stemVi: string;
    repo: { 禄: string; 权: string; 科: string; 忌: string };
    app: { 禄: string; 权: string; 科: string; 忌: string };
    appVi: { Lộc: string; Quyền: string; Khoa: string; Kỵ: string };
    schoolTableMatch: boolean;
    matched: boolean;
    diffs: string[];
  }> = [];

  for (let i = 0; i < 10; i++) {
    const repoTuple = REPO_SI_HUA_TABLE[i];
    const repoObj = { 禄: repoTuple[0], 权: repoTuple[1], 科: repoTuple[2], 忌: repoTuple[3] };
    const appObj = getSiHuaByStem(i);
    const constTuple = SI_HUA_TABLE[i];

    // Kiểm tra thêm bảng SCHOOL_SIHUA_DEFAULT (hàng 1..10 ứng với Giáp..Quý)
    const schoolRow = SCHOOL_SIHUA_DEFAULT[i + 1];
    const schoolTuple = [
      SCHOOL_STAR_ID_TO_NAME[schoolRow[1]],
      SCHOOL_STAR_ID_TO_NAME[schoolRow[2]],
      SCHOOL_STAR_ID_TO_NAME[schoolRow[3]],
      SCHOOL_STAR_ID_TO_NAME[schoolRow[4]],
    ];
    const schoolTableMatch = JSON.stringify(schoolTuple) === JSON.stringify(repoTuple);

    const diffs: string[] = [];
    for (const k of ['禄', '权', '科', '忌'] as const) {
      if (repoObj[k] !== appObj[k]) {
        diffs.push(`Hóa ${k}: repo=${repoObj[k]} vs app=${appObj[k]}`);
      }
    }
    if (JSON.stringify(constTuple) !== JSON.stringify(repoTuple)) {
      diffs.push(`SI_HUA_TABLE[${i}] lệch`);
    }

    const matched = diffs.length === 0 && schoolTableMatch;
    assert.ok(matched, `Thiên Can ${STEMS[i]} bị lệch: ${diffs.join('; ')}`);

    const row = {
      stemIndex: i,
      stemZh: STEMS[i],
      stemVi: VI_STEM_NAMES[i],
      repo: repoObj,
      app: appObj,
      appVi: {
        Lộc: `${VI_STAR_NAMES[appObj.禄]} (${appObj.禄})`,
        Quyền: `${VI_STAR_NAMES[appObj.权]} (${appObj.权})`,
        Khoa: `${VI_STAR_NAMES[appObj.科]} (${appObj.科})`,
        Kỵ: `${VI_STAR_NAMES[appObj.忌]} (${appObj.忌})`,
      },
      schoolTableMatch,
      matched,
      diffs,
    };
    rows.push(row);

    console.log(
      `  [${i}] Can ${row.stemVi} (${row.stemZh}): ` +
        `Lộc=${row.appVi.Lộc} | Quyền=${row.appVi.Quyền} | Khoa=${row.appVi.Khoa} | Kỵ=${row.appVi.Kỵ} ` +
        `=> ${row.matched ? '✅ KHỚP 100%' : '❌ LỆCH: ' + row.diffs.join(', ')}`,
    );
  }

  console.log('\n✅ Bảng Tứ Hóa 10 Thiên Can khớp 10/10 tuyệt đối với repo gốc.\n');
  return rows;
}

// ============================================================================
// PHẦN 3: CHẠY NGUYÊN VĂN 6 BỘ TEST PATTERN & TỨ HÓA TỪ REPO GỐC
// ============================================================================

// Bộ nhớ đệm cho hàm helper chartOf(y, m, d, h) dùng chung giữa 3 test dingfu / dinggui / dingpin
// (cả 3 file test gốc đều định nghĩa cùng hàm chartOf(y, m, d, h) và quét cùng tập mẫu 1990..1993)
const _chartOfCache = new Map<string, ZiweiChart>();
const cachedChartOf = (y: number, m: number, d: number, h: number): ZiweiChart => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  assert.equal(dt.getUTCMonth(), m - 1, `${y}-${m}-${d} 不是合法日期`);
  const key = `${y}-${m}-${d}-${h}`;
  let c = _chartOfCache.get(key);
  if (!c) {
    c = generateChart({ year: y, month: m, day: d, hour: h, gender: 'male' });
    _chartOfCache.set(key, c);
  }
  return c;
};

// 3.1 patterns-dingfu.test.ts (Nguyên văn)
function runPatternsDingFuTest() {
  const chartOf = cachedChartOf;

  // ────────────────── 一、结构层 ──────────────────
  assert.equal(DING_FU_GE.length, 6, '〈定富局〉应为 6 条');
  assert.deepEqual(
    DING_FU_GE.map(g => g.no),
    [1, 2, 3, 4, 5, 6],
    '序号须为 1..6',
  );
  assert.equal(new Set(DING_FU_GE.map(g => g.name)).size, 6, '格名不得重复');
  for (const g of DING_FU_GE) {
    assert.ok(g.note.length > 0, `${g.name} 缺注文`);
  }

  assert.equal(DING_FU_JUDGEABLE, 4, '可判定条目应为 4 条（6 - 2 无解）');
  assert.equal(DING_FU_UNREACHABLE.length, 2, '安星无解的条目应为 2 条');
  assert.deepEqual(
    DING_FU_UNREACHABLE.map(g => g.name).sort(),
    ['财荫夹印', '荫印拱身'].sort(),
    '无解条目清单变动须同步更新文档与几何理由',
  );
  for (const g of DING_FU_UNREACHABLE) {
    assert.ok(g.why && g.why.length > 20, `${g.name} 标了 unreachable 却没写几何理由`);
    assert.equal(g.fn, undefined, `${g.name} 标了 unreachable 就不该带判定函数（死代码）`);
  }

  // ────────────────── 二、几何层 ──────────────────
  function deltas(a: string, b: string, charts: ZiweiChart[]): Set<number> {
    const out = new Set<number>();
    for (const c of charts) {
      const pa = c.palaces.find(p => p.stars.some(s => s.name === a))?.branch ?? -1;
      const pb = c.palaces.find(p => p.stars.some(s => s.name === b))?.branch ?? -1;
      if (pa < 0 || pb < 0) continue;
      out.add(((pb - pa) + 12) % 12);
    }
    return out;
  }

  const sample: ZiweiChart[] = [];
  for (let y = 1990; y <= 1993; y++) {
    for (let m = 1; m <= 12; m++) {
      for (const d of [5, 20]) {
        for (let h = 0; h < 12; h++) sample.push(chartOf(y, m, d, h));
      }
    }
  }

  assert.deepEqual(
    [...deltas('天相', '天梁', sample)].sort((x, y) => x - y),
    [1],
    '天梁相对天相的宫距应恒为 1（天梁恒居天相下一宫）——若失败，财荫夹印/荫印拱身需重新评估',
  );

  const wuXiang = [...deltas('武曲', '天相', sample)];
  assert.ok(
    wuXiang.every(d => d % 2 === 0),
    `武曲天相宫距应恒为偶数，实测出现奇数：${wuXiang.filter(d => d % 2 !== 0).join('、')}`,
  );
  assert.ok(!wuXiang.includes(1) && !wuXiang.includes(11), '武曲永不与天相邻——财荫夹印因此无解');

  assert.deepEqual(
    [...deltas('武曲', '太阳', sample)].sort((x, y) => x - y),
    [1],
    '太阳相对武曲的宫距应恒为 1（太阳恒居武曲后一宫）——日月夹财形态唯一性的根据',
  );

  assert.ok(
    !deltas('天马', '禄存', sample).has(11),
    '禄存不应出现在天马前一宫——若出现，财禄夹马「禄在前」读法需重估',
  );

  {
    const pos = (c: ZiweiChart, n: string) =>
      c.palaces.find(p => p.stars.some(s => s.name === n))?.branch ?? -1;
    let coFang = 0;
    for (const c of sample) {
      const tz = c.palaces.find(p => p.name === '田宅')?.branch ?? -1;
      if (tz < 0) continue;
      const fang = [tz, (tz + 4) % 12, (tz + 8) % 12, (tz + 6) % 12];
      if (fang.includes(pos(c, '天梁')) && fang.includes(pos(c, '天相'))) coFang++;
    }
    assert.equal(coFang, 0, '天梁天相不应同入田宅三方四正——荫印拱身「拱冲」读法无解的实测复证');
  }

  // ────────────────── 三、行为层：正例与触发率 ──────────────────
  const GOLDEN: Array<[number, number, number, number, string]> = [
    [1990, 1, 5, 0, '日月夹财'],
    [1993, 1, 25, 3, '财禄夹马'],
    [1990, 1, 15, 9, '日月照璧'],
    [1990, 2, 11, 8, '金灿光辉'],
  ];

  assert.deepEqual(
    GOLDEN.map(g => g[4]).sort(),
    DING_FU_GE.filter(g => g.fn).map(g => g.name).sort(),
    '黄金正例表与可实现条目清单不一致——新增条目须补正例',
  );

  for (const [y, m, d, h, name] of GOLDEN) {
    const hits = detectDingFu(chartOf(y, m, d, h));
    assert.ok(
      hits.some(x => x.name === name),
      `${y}-${m}-${d} 时${h} 应命中「${name}」，实际命中：${hits.map(x => x.name).join('、') || '无'}`,
    );
  }

  const RATE_SAMPLE: ZiweiChart[] = [];
  for (let y = 1990; y <= 1993; y++) {
    for (let m = 1; m <= 12; m++) {
      for (const d of [1, 10, 20]) {
        for (const h of [0, 6]) RATE_SAMPLE.push(chartOf(y, m, d, h));
      }
    }
  }

  const counts = new Map<string, number>();
  let total = 0;
  for (const c of RATE_SAMPLE) {
    const hits = detectDingFu(c);
    total += hits.length;
    for (const h of hits) counts.set(h.name, (counts.get(h.name) ?? 0) + 1);
  }

  const avg = total / RATE_SAMPLE.length;
  assert.ok(
    avg > 0.01 && avg < 0.12,
    `〈定富局〉平均命中 ${avg.toFixed(3)} 个/盘，超出 0.01–0.12 的预期区间`,
  );

  for (const [name, v] of counts) {
    const rate = v / RATE_SAMPLE.length;
    assert.ok(rate < 0.08, `「${name}」触发率 ${(rate * 100).toFixed(1)}% 超过 8% 上限——疑似放宽`);
  }

  const maxRate = (Math.max(...counts.values()) / RATE_SAMPLE.length) * 100;
  const msg =
    `patterns-dingfu: 6 条（可实现 4 / 无解 2），实测平均 ${avg.toFixed(2)} 个/盘，` +
    `单条最高 ${maxRate.toFixed(1)}%`;
  console.log(`  ✓ ${msg}`);
  return { status: 'PASS', summary: msg, avgPerChart: Number(avg.toFixed(4)), maxRatePct: Number(maxRate.toFixed(2)) };
}

// 3.2 patterns-dinggui.test.ts (Nguyên văn)
function runPatternsDingGuiTest() {
  const chartOf = cachedChartOf;

  // ────────────────── 一、结构层 ──────────────────
  assert.equal(DING_GUI_GE.length, 27, '〈定贵局〉应为 27 条');
  assert.deepEqual(
    DING_GUI_GE.map(g => g.no),
    Array.from({ length: 27 }, (_, i) => i + 1),
    '序号须为 1..27 连续',
  );
  assert.equal(new Set(DING_GUI_GE.map(g => g.name)).size, 27, '格名不得重复');

  for (const g of DING_GUI_GE) {
    assert.ok(g.note.length > 0, `${g.name} 缺注文`);
    assert.ok(!/^见前批注。?$/.test(g.note), `${g.name} 只写了「见前批注」，须补出所据赋句`);
  }

  assert.equal(DING_GUI_JUDGEABLE, 23, '可判定条目应为 23 条（27 - 4 无解）');
  assert.equal(DING_GUI_UNREACHABLE.length, 4, '安星无解的条目应为 4 条');
  assert.deepEqual(
    DING_GUI_UNREACHABLE.map(g => g.name).sort(),
    ['财印夹禄', '文星暗拱', '金舆扶驾', '马头带剑'].sort(),
    '无解条目清单变动须同步更新文档与理由',
  );
  for (const g of DING_GUI_UNREACHABLE) {
    assert.ok(g.why && g.why.length > 20, `${g.name} 标了 unreachable 却没写几何理由`);
    assert.equal(g.fn, undefined, `${g.name} 标了 unreachable 就不该带判定函数（死代码）`);
  }
  for (const g of DING_GUI_GE.filter(x => x.status === 'disputed')) {
    assert.ok(g.why && g.why.length > 10, `${g.name} 标了 disputed 却没写歧义所在`);
    assert.ok(g.fn, `${g.name} 标了 disputed 仍须给出通行解的实现`);
  }

  // ────────────────── 二、几何层：无解的三条 ──────────────────
  function deltas(a: string, b: string, charts: ZiweiChart[]): Set<number> {
    const out = new Set<number>();
    for (const c of charts) {
      const pa = c.palaces.find(p => p.stars.some(s => s.name === a))?.branch ?? -1;
      const pb = c.palaces.find(p => p.stars.some(s => s.name === b))?.branch ?? -1;
      if (pa < 0 || pb < 0) continue;
      out.add(((pb - pa) + 12) % 12);
    }
    return out;
  }

  const sample: ZiweiChart[] = [];
  for (let y = 1990; y <= 1993; y++) {
    for (let m = 1; m <= 12; m++) {
      for (const d of [5, 20]) {
        for (let h = 0; h < 12; h++) sample.push(chartOf(y, m, d, h));
      }
    }
  }

  assert.deepEqual(
    [...deltas('天相', '天梁', sample)].sort((x, y) => x - y),
    [1],
    '天梁相对天相的宫距应恒为 1（天梁恒居天相下一宫）——若此断言失败，说明安星表变了，财印夹禄需重新评估',
  );

  const changQu = [...deltas('文昌', '文曲', sample)];
  assert.ok(
    changQu.every(d => d % 2 === 0),
    `文昌文曲宫距应恒为偶数，实测出现奇数：${changQu.filter(d => d % 2 !== 0).join('、')}`,
  );
  assert.ok(!changQu.includes(1) && !changQu.includes(11), '昌曲永不相邻——昌曲夹命（文星暗拱）因此无解');

  assert.deepEqual(
    [...deltas('紫微', '太阳', sample)].sort((x, y) => x - y),
    [9],
    '太阳相对紫微的宫距应恒为 9——日永不在紫微前后一宫，金舆扶驾因此无解',
  );

  assert.ok(!deltas('天马', '擎羊', sample).has(0), '天马与擎羊不应出现同宫——若出现，马头带剑的「无解」判定需重估');

  // ────────────────── 三、行为层：正例与触发率 ──────────────────
  const GOLDEN: Array<[number, number, number, number, string]> = [
    [1990, 1, 5, 0, '日月夹命'],
    [1990, 1, 27, 3, '日出扶桑'],
    [1990, 1, 27, 3, '月落亥宫'],
    [1990, 1, 15, 4, '月生沧海'],
    [1990, 1, 9, 2, '辅弼拱主'],
    [1990, 11, 21, 10, '君臣庆会'],
    [1993, 2, 7, 3, '禄马佩印'],
    [1990, 1, 27, 1, '坐贵向贵'],
    [1990, 1, 3, 5, '七杀朝斗'],
    [1990, 1, 9, 8, '日月并明'],
    [1990, 1, 11, 6, '明珠出海'],
    [1990, 1, 3, 0, '日月同临'],
    [1990, 1, 11, 5, '刑囚夹印'],
    [1991, 2, 17, 3, '科权禄拱'],
    [1990, 7, 15, 9, '贪火相逢'],
    [1990, 2, 1, 11, '武曲守垣'],
    [1990, 1, 3, 11, '府相朝垣'],
    [1990, 1, 7, 11, '紫府朝垣'],
    [1990, 1, 5, 0, '权禄生逢'],
    [1990, 1, 1, 6, '羊刃入庙'],
    [1990, 1, 19, 10, '巨机居卯'],
    [1990, 1, 11, 7, '明禄暗禄'],
    [1990, 1, 13, 1, '科明暗禄'],
  ];

  assert.deepEqual(
    GOLDEN.map(g => g[4]).sort(),
    DING_GUI_GE.filter(g => g.fn).map(g => g.name).sort(),
    '黄金正例表与可实现条目清单不一致——新增条目须补正例',
  );

  for (const [y, m, d, h, name] of GOLDEN) {
    const hits = detectDingGui(chartOf(y, m, d, h));
    assert.ok(
      hits.some(x => x.name === name),
      `${y}-${m}-${d} 时${h} 应命中「${name}」，实际命中：${hits.map(x => x.name).join('、') || '无'}`,
    );
  }

  const RATE_SAMPLE: ZiweiChart[] = [];
  for (let y = 1990; y <= 1993; y++) {
    for (let m = 1; m <= 12; m++) {
      for (const d of [1, 10, 20]) {
        for (const h of [0, 6]) RATE_SAMPLE.push(chartOf(y, m, d, h));
      }
    }
  }

  const counts = new Map<string, number>();
  let total = 0;
  for (const c of RATE_SAMPLE) {
    for (const g of detectDingGui(c)) {
      counts.set(g.name, (counts.get(g.name) ?? 0) + 1);
      total++;
    }
  }

  for (const g of DING_GUI_GE) {
    if (!g.fn) continue;
    const rate = (counts.get(g.name) ?? 0) / RATE_SAMPLE.length;
    assert.ok(
      rate <= 0.08,
      `「${g.name}」触发率 ${(rate * 100).toFixed(1)}% 超过 8%——格本用于筛人，放宽到人人有份就不是格了`,
    );
  }

  const avg = total / RATE_SAMPLE.length;
  assert.ok(
    avg > 0.2 && avg < 1.5,
    `〈定贵局〉平均命中 ${avg.toFixed(2)} 个/盘，超出 0.2–1.5 的预期区间`,
  );

  const maxRate = counts.size
    ? Math.max(...[...counts.values()].map(v => v / RATE_SAMPLE.length)) * 100
    : 0;
  const msg =
    `patterns-dinggui: 27 条（可实现 ${DING_GUI_JUDGEABLE} / 无解 ${DING_GUI_UNREACHABLE.length} / 存疑 2），` +
    `实测平均 ${avg.toFixed(2)} 个/盘，单条最高 ${maxRate.toFixed(1)}%`;
  console.log(`  ✓ ${msg}`);
  return { status: 'PASS', summary: msg, avgPerChart: Number(avg.toFixed(4)), maxRatePct: Number(maxRate.toFixed(2)) };
}

// 3.3 patterns-dingpin.test.ts (Nguyên văn)
function runPatternsDingPinTest() {
  const chartOf = cachedChartOf;

  // ────────────────── 一、结构层 ──────────────────
  assert.equal(DING_PIN_GE.length, 8, '〈定贫贱局〉应为 8 条');
  assert.deepEqual(DING_PIN_GE.map(g => g.no), [1, 2, 3, 4, 5, 6, 7, 8], '序号须为 1..8');
  assert.equal(new Set(DING_PIN_GE.map(g => g.name)).size, 8, '格名不得重复');
  for (const g of DING_PIN_GE) {
    assert.ok(g.note.length > 0, `${g.name} 缺注文`);
  }

  assert.equal(DING_PIN_JUDGEABLE, 8, '八条全部可判（含存疑的通行解实现）');
  assert.equal(DING_PIN_UNREACHABLE.length, 0, '定贫贱局无安星结构性无解条目——若发现，须先给纯安星证明');

  const disputed = DING_PIN_GE.filter(g => g.status === 'disputed');
  assert.deepEqual(
    disputed.map(g => g.name).sort(),
    ['日月藏辉', '马落空亡', '君子在野'].sort(),
    '存疑条目清单变动须同步更新文档与宽严取舍理由',
  );
  for (const g of disputed) {
    assert.ok(g.why && g.why.length > 20, `${g.name} 标了 disputed 却没写宽严取舍理由`);
    assert.ok(g.fn, `${g.name} 标了 disputed 仍须给出通行解的实现`);
  }

  // ────────────────── 二、几何层 ──────────────────
  function deltas(a: string, b: string, charts: ZiweiChart[]): Set<number> {
    const out = new Set<number>();
    for (const c of charts) {
      const pa = c.palaces.find(p => p.stars.some(s => s.name === a))?.branch ?? -1;
      const pb = c.palaces.find(p => p.stars.some(s => s.name === b))?.branch ?? -1;
      if (pa < 0 || pb < 0) continue;
      out.add(((pb - pa) + 12) % 12);
    }
    return out;
  }

  const sample: ZiweiChart[] = [];
  for (let y = 1990; y <= 1993; y++) {
    for (let m = 1; m <= 12; m++) {
      for (const d of [5, 20]) {
        for (let h = 0; h < 12; h++) sample.push(chartOf(y, m, d, h));
      }
    }
  }

  assert.deepEqual(
    [...deltas('廉贞', '武曲', sample)].sort((x, y) => x - y),
    [4],
    '武曲相对廉贞的宫距应恒为 4——两星永不同宫，财与囚仇只能分守身命',
  );

  {
    let tongGong = 0;
    const hours = new Set<number>();
    for (let y = 1990; y <= 1991; y++) {
      for (const m of [1, 6]) {
        for (let h = 0; h < 12; h++) {
          const c = chartOf(y, m, 5, h);
          const kong = c.palaces.find(p => p.stars.some(s => s.name === '地空'))?.branch ?? -1;
          const jie = c.palaces.find(p => p.stars.some(s => s.name === '地劫'))?.branch ?? -1;
          if (kong >= 0 && kong === jie) {
            tongGong++;
            hours.add(h);
          }
        }
      }
    }
    assert.ok(tongGong > 0, '样本中应存在空劫同宫的盘');
    assert.deepEqual(
      [...hours].sort((x, y) => x - y),
      [0, 6],
      '空劫同宫只应出现在子时（h=0）与午时（h=6）——禄逢两杀「两杀」读法天然稀有的根据',
    );
  }

  assert.deepEqual(
    [...deltas('陀罗', '擎羊', sample)].sort((x, y) => x - y),
    [2],
    '擎羊相对陀罗的宫距应恒为 2（羊在禄前、陀在禄后）——四杀永不同宫，君子在野严读的几何根据',
  );

  {
    let poXian = 0;
    for (const c of sample) {
      const p = c.palaces.find(p => p.stars.some(s => s.name === '破军'));
      if (p?.stars.find(s => s.name === '破军')?.brightnessRaw === '陷') poXian++;
    }
    assert.ok(poXian > 0, '样本中应存在破军落陷的盘——一生孤贫可达的前提');
  }

  // ────────────────── 三、行为层：正例与触发率 ──────────────────
  const GOLDEN: Array<[number, number, number, number, string]> = [
    [1990, 1, 4, 2, '生不逢时'],
    [1990, 11, 25, 0, '禄逢两杀'],
    [1990, 1, 1, 2, '马落空亡'],
    [1990, 1, 1, 1, '日月藏辉'],
    [1990, 1, 4, 2, '财与囚仇'],
    [1990, 1, 28, 11, '一生孤贫'],
    [1990, 2, 25, 6, '君子在野'],
    [1990, 12, 7, 3, '两重华盖'],
  ];

  assert.deepEqual(
    GOLDEN.map(g => g[4]).sort(),
    DING_PIN_GE.filter(g => g.fn).map(g => g.name).sort(),
    '黄金正例表与可实现条目清单不一致——新增条目须补正例',
  );

  for (const [y, m, d, h, name] of GOLDEN) {
    const hits = detectDingPin(chartOf(y, m, d, h));
    assert.ok(
      hits.some(x => x.name === name),
      `${y}-${m}-${d} 时${h} 应命中「${name}」，实际命中：${hits.map(x => x.name).join('、') || '无'}`,
    );
  }

  const RATE_SAMPLE: ZiweiChart[] = [];
  for (let y = 1990; y <= 1993; y++) {
    for (let m = 1; m <= 12; m++) {
      for (const d of [1, 10, 20]) {
        for (const h of [0, 6]) RATE_SAMPLE.push(chartOf(y, m, d, h));
      }
    }
  }

  const counts = new Map<string, number>();
  let total = 0;
  for (const c of RATE_SAMPLE) {
    const hits = detectDingPin(c);
    total += hits.length;
    for (const h of hits) counts.set(h.name, (counts.get(h.name) ?? 0) + 1);
  }

  const avg = total / RATE_SAMPLE.length;
  assert.ok(
    avg > 0.05 && avg < 0.4,
    `〈定贫贱局〉平均命中 ${avg.toFixed(3)} 个/盘，超出 0.05–0.4 的预期区间`,
  );

  for (const [name, v] of counts) {
    const rate = v / RATE_SAMPLE.length;
    assert.ok(
      rate < 0.08,
      `「${name}」触发率 ${(rate * 100).toFixed(1)}% 超过 8% 上限——疑似放宽（马落空亡的年支波动例外，先查样本构成）`,
    );
  }

  const maxRate = (Math.max(...counts.values()) / RATE_SAMPLE.length) * 100;
  const msg =
    `patterns-dingpin: 8 条（可实现 5 / 存疑 3 / 无解 0），实测平均 ${avg.toFixed(2)} 个/盘，` +
    `单条最高 ${maxRate.toFixed(1)}%`;
  console.log(`  ✓ ${msg}`);
  return { status: 'PASS', summary: msg, avgPerChart: Number(avg.toFixed(4)), maxRatePct: Number(maxRate.toFixed(2)) };
}

// 3.4 patterns-dingza.test.ts (Nguyên văn)
async function runPatternsDingZaTest() {
  function testStructure() {
    assert.equal(DING_ZA_GE.length, 8, '定杂局应为 8 条');
    assert.equal(DING_ZA_JUDGEABLE, 8, '八条应全部带实现（本表无 unreachable）');
    DING_ZA_GE.forEach((g, i) => {
      assert.equal(g.no, i + 1, '序号应连续 1-8');
      assert.ok(g.note.length > 0, `第 ${g.no} 条缺注文`);
      assert.ok(g.judge, `第 ${g.no} 条缺判定函数`);
      assert.ok(g.unit === '大限' || g.unit === '流年', `第 ${g.no} 条 unit 非法`);
    });

    const statusByNo = new Map(DING_ZA_GE.map(g => [g.no, g.status]));
    assert.equal(statusByNo.get(1), 'derivable');
    assert.equal(statusByNo.get(2), 'derivable');
    assert.equal(statusByNo.get(3), 'derivable');
    assert.equal(statusByNo.get(4), 'disputed', '衣锦还乡前半不可判，应为 disputed');
    assert.equal(statusByNo.get(5), 'disputed');
    assert.equal(statusByNo.get(6), 'disputed');
    assert.equal(statusByNo.get(7), 'disputed');
    assert.equal(statusByNo.get(8), 'derivable');

    const notes = DING_ZA_GE.map(g => `${g.name} ${g.note}`).join('。');
    assert.ok(notes.includes('风云际会 身命虽弱二限逢禄马是也'));
    assert.ok(notes.includes('枯木逢春 谓命衰限好是也'));
  }

  function testDaXianArchitecture(chart: ZiweiChart) {
    const dxs = [...chart.daXians].sort((a, b) => a.startAge - b.startAge);
    assert.equal(dxs.length, 12, '大限应为 12 个');
    assert.equal(dxs[0].startAge, chart.wuxingJu, '首限起岁应等于五行局数');
    for (const dx of dxs) {
      assert.equal(dx.endAge - dx.startAge + 1, 10, '每个大限应整整十年');
    }
    const branches = new Set(dxs.map(dx => dx.palaceBranch));
    assert.equal(branches.size, 12, '十二限应各占一宫，宫支互异');
  }

  function testAgeFilter() {
    const chart = generateChart({ year: 1990, month: 1, day: 1, hour: 0, gender: 'male' });
    const all = detectDingZa(chart);

    const age = 45;
    const filtered = detectDingZa(chart, { age });
    for (const h of filtered) {
      assert.ok(h.startAge !== undefined && h.endAge !== undefined);
      if (h.unit === '大限') {
        assert.ok(age >= h.startAge! && age <= h.endAge!, `${h.name} 过滤后年龄区间不含 ${age}`);
      } else {
        assert.ok(age === h.startAge || age === h.endAge, `${h.name} 流年窗不含 ${age}`);
      }
    }

    const allDaxian = all.filter(x => x.unit === '大限');
    const filteredDaxian = filtered.filter(x => x.unit === '大限');
    assert.ok(filteredDaxian.length <= allDaxian.length);
    for (const h of filteredDaxian) {
      assert.ok(
        allDaxian.some(x => x.no === h.no && x.startAge === h.startAge),
        '过滤结果必须是全量结果的子集',
      );
    }

    const cur = getCurrentDingZa(chart);
    const manual = detectDingZa(chart, { age: chart.currentAge });
    assert.deepEqual(cur, manual, 'getCurrentDingZa 应等价于 age=currentAge 过滤');
  }

  const GOLDEN: Array<{
    birth: { year: number; month: number; day: number; hour: number };
    no: number;
    ages: [number, number];
  }> = [
    { birth: { year: 1990, month: 1, day: 29, hour: 9 }, no: 1, ages: [34, 43] }, // 风云际会
    { birth: { year: 1990, month: 3, day: 3, hour: 0 }, no: 1, ages: [15, 24] },
    { birth: { year: 1990, month: 1, day: 1, hour: 6 }, no: 2, ages: [5, 14] }, // 锦上添花
    { birth: { year: 1992, month: 3, day: 2, hour: 0 }, no: 3, ages: [4, 13] }, // 禄衰马困
    { birth: { year: 1990, month: 1, day: 1, hour: 0 }, no: 4, ages: [62, 71] }, // 衣锦还乡
    { birth: { year: 1990, month: 1, day: 1, hour: 0 }, no: 5, ages: [52, 61] }, // 步数无依
    { birth: { year: 1990, month: 1, day: 1, hour: 0 }, no: 6, ages: [5, 6] }, // 水上驾星
    { birth: { year: 1990, month: 1, day: 1, hour: 0 }, no: 7, ages: [72, 81] }, // 吉凶相伴
    { birth: { year: 1990, month: 1, day: 15, hour: 0 }, no: 8, ages: [12, 21] }, // 枯木逢春
  ];

  function testGolden() {
    for (const g of GOLDEN) {
      const chart = generateChart({ ...g.birth, gender: 'male' });
      const hits = detectDingZa(chart).filter(h => h.no === g.no);
      const ok = hits.some(h => h.startAge === g.ages[0] && h.endAge === g.ages[1]);
      assert.ok(
        ok,
        `${g.birth.year}-${g.birth.month}-${g.birth.day} ${g.birth.hour}时 应命中第 ${g.no} 条 ${g.ages[0]}-${g.ages[1]} 岁，实际：` +
          (hits.map(h => `${h.startAge}-${h.endAge}`).join('、') || '（无）'),
      );
    }
  }

  async function testRates() {
    const unitHit = new Map<number, number>();
    const chartHit = new Map<number, number>();
    const liunianPerChart: number[] = [];
    let totalUnits = 0;
    const totalCharts = 720;

    const start = Date.UTC(1990, 0, 1);
    for (let i = 0; i < totalCharts; i++) {
      const dt = new Date(start + Math.floor(i / 60) * 365 * 86_400_000 + (i % 60) * 6 * 86_400_000);
      const chart = generateChart({
        year: dt.getUTCFullYear(),
        month: dt.getUTCMonth() + 1,
        day: dt.getUTCDate(),
        hour: (i % 2) * 6,
        gender: i % 4 < 2 ? 'male' : 'female',
      });
      testDaXianArchitecture(chart);
      const dxs = [...chart.daXians].sort((a, b) => a.startAge - b.startAge);
      totalUnits += dxs.length;

      const hits = detectDingZa(chart);
      const seenNos = new Set<number>();
      for (const h of hits) {
        unitHit.set(h.no, (unitHit.get(h.no) ?? 0) + 1);
        if (!seenNos.has(h.no)) {
          seenNos.add(h.no);
          chartHit.set(h.no, (chartHit.get(h.no) ?? 0) + 1);
        }
      }
      liunianPerChart.push(hits.filter(h => h.no === 6).length);
    }

    const gates: Record<number, [number, number, number]> = {
      1: [1.5, 5, 25],
      2: [2, 6, 55],
      3: [3, 8.5, 30],
      4: [17, 28, 100],
      5: [2, 7, 55],
      6: [0, 9999, 100],
      7: [10, 21, 90],
      8: [2.5, 7.5, 40],
    };

    for (const [no, [lo, hi, chartCap]] of Object.entries(gates)) {
      const n = Number(no);
      const ge = DING_ZA_GE.find(g => g.no === n)!;
      const u = ((unitHit.get(n) ?? 0) / totalUnits) * 100;
      const ch = ((chartHit.get(n) ?? 0) / totalCharts) * 100;
      if (ge.unit === '大限') {
        assert.ok(
          u >= lo && u <= hi,
          `第 ${n} 条单位命中率 ${u.toFixed(2)}%/限 越界 [${lo}, ${hi}]——口径漂了，先解释再动闸门`,
        );
      }
      assert.ok(
        ch <= chartCap,
        `第 ${n} 条盘面命中率 ${ch.toFixed(1)}% 超上限 ${chartCap}%——口径漂了，先解释再动闸门`,
      );
    }

    const avg = liunianPerChart.reduce((a, b) => a + b, 0) / liunianPerChart.length;
    assert.ok(avg >= 10 && avg <= 60, `水上驾星均值 ${avg.toFixed(1)} 窗/盘 越界 [10, 60]`);
    assert.ok(liunianPerChart.every(n => n > 0), '水上驾星应每盘至少一个交替窗（描述格本性）');
    return { avg };
  }

  testStructure();
  const smoke = generateChart({ year: 1988, month: 10, day: 8, hour: 6, gender: 'male' });
  testDaXianArchitecture(smoke);
  testAgeFilter();
  testGolden();
  const { avg } = await testRates();
  const msg = `patterns-dingza: 结构 8 条 / 大限架构 720+ 盘 / 黄金正例 9 例全中 / 水上驾星均值 ${avg.toFixed(1)} 交替窗/盘`;
  console.log(`  ✓ ${msg}`);
  return { status: 'PASS', summary: msg, avgLiunianWindows: Number(avg.toFixed(1)) };
}

// 3.5 patterns-sihua-bonus.test.ts (Nguyên văn)
function runPatternsSiHuaBonusTest() {
  function sanFangHasSiHua(chart: ZiweiChart, hua: SiHua): boolean {
    const m = chart.mingGongBranch;
    const branches = [m, (m + 4) % 12, (m + 8) % 12, (m + 6) % 12];
    return chart.palaces.some(p => branches.includes(p.branch) && p.stars.some(s => s.siHua === hua));
  }

  // 盘上不存在名为「化X」的星
  const sample = generateChart({ year: 1988, month: 10, day: 8, hour: 7, gender: 'male' });
  assert.ok(sample.palaces.every(p => p.stars.every(s => !/^化[禄权科忌]$/.test(s.name))), '星名里出现了「化X」');

  // 逐日扫一年、固定午时，统计每个加分项「该出现」与「实际出现」的盘数
  const checks: { pattern: string; bonus: string; expect: (c: ZiweiChart) => boolean }[] = [
    {
      pattern: '府相朝垣',
      bonus: '命宫见禄',
      expect: c =>
        c.palaces.some(
          p => p.branch === c.mingGongBranch && p.stars.some(s => s.name === '禄存' || s.siHua === '禄'),
        ),
    },
    {
      pattern: '杀破狼',
      bonus: '三方有化禄或化权（动得有力）',
      expect: c => sanFangHasSiHua(c, '禄') || sanFangHasSiHua(c, '权'),
    },
    { pattern: '机月同梁', bonus: '再会化科', expect: c => sanFangHasSiHua(c, '科') },
    { pattern: '阳梁昌禄', bonus: '再会化科', expect: c => sanFangHasSiHua(c, '科') },
  ];

  const hits = new Map<string, number>();
  const start = Date.UTC(1990, 0, 1);
  for (let d = 0; d < 366; d++) {
    const dt = new Date(start + d * 86_400_000);
    const chart = cachedChartOf(
      dt.getUTCFullYear(),
      dt.getUTCMonth() + 1,
      dt.getUTCDate(),
      6,
    );
    const found = detectPatterns(chart);
    for (const { pattern, bonus, expect } of checks) {
      const p = found.find(x => x.name === pattern);
      if (!p) continue;
      const want = expect(chart);
      const got = p.conditions?.bonus?.includes(bonus) ?? false;
      assert.equal(got, want, `${dt.toISOString().slice(0, 10)} 午时 ${pattern}「${bonus}」应为 ${want}`);
      if (got) hits.set(pattern, (hits.get(pattern) ?? 0) + 1);
    }
  }

  for (const { pattern } of checks) {
    assert.ok((hits.get(pattern) ?? 0) > 0, `${pattern} 的四化加分项一次都没触发，样本覆盖不到或判断仍按星名`);
  }

  const hitObj = Object.fromEntries(hits.entries());
  const msg = `patterns-sihua-bonus: 格局四化加分项按 siHua 判定（触发盘数：${[...hits]
    .map(([k, v]) => `${k} ${v}`)
    .join('、')}）`;
  console.log(`  ✓ ${msg}`);
  return { status: 'PASS', summary: msg, hits: hitObj };
}

// 3.6 natal-dual-sihua-same-palace.test.ts (Nguyên văn)
function runNatalDualSiHuaSamePalaceTest() {
  // 戊 = index 5 in SCHOOL_SIHUA_DEFAULT rows (row0 pad, 甲..癸 = 1..10)
  const wu = SCHOOL_SIHUA_DEFAULT[5];
  assert.deepEqual(wu, [0, 9, 8, 18, 2], '默认戊年四化表被改动');
  assert.equal(SCHOOL_STAR_ID_TO_NAME[9], '贪狼');
  assert.equal(SCHOOL_STAR_ID_TO_NAME[8], '太阴');
  assert.equal(SCHOOL_STAR_ID_TO_NAME[18], '右弼');
  assert.equal(SCHOOL_STAR_ID_TO_NAME[2], '天机');

  const chart = generateChart({ year: 1988, month: 10, day: 8, hour: 7, gender: 'male' });
  const byPalace = new Map<string, string[]>();
  for (const p of chart.palaces) {
    const hits = p.stars.filter(s => s.siHua).map(s => `${s.name}:${s.siHua}`);
    if (hits.length) byPalace.set(p.name, hits);
  }

  assert.deepEqual(byPalace.get('命宫')?.sort(), ['天机:忌', '太阴:权'].sort());
  assert.deepEqual(byPalace.get('父母')?.sort(), ['贪狼:禄', '右弼:科'].sort());
  assert.equal(
    [...byPalace.values()].filter(v => v.length >= 2).length,
    2,
    '戊年此盘应有两宫各含两颗本命四化星',
  );

  const msg = 'natal-dual-sihua-same-palace: 戊年 1988-10-08 未时男 命宫[天机:忌, 太阴:权] & 父母[贪狼:禄, 右弼:科] 验证通过';
  console.log(`  ✓ ${msg}`);
  return {
    status: 'PASS',
    summary: msg,
    palaceSiHua: Object.fromEntries(byPalace.entries()),
  };
}

// ============================================================================
// PHẦN 4: XUẤT JSON ĐẦY ĐỦ CỦA 3 LÁ SỐ MẪU (generateChart THÔ)
// ============================================================================
function buildSampleChartsReport() {
  console.log('\n================================================================================');
  console.log('PHẦN 4: 3 LÁ SỐ MẪU (generateChart THÔ — KHÔNG QUA HIỆU CHỈNH GIỜ MẶT TRỜI THỰC)');
  console.log('================================================================================');

  const MAJOR_14 = [
    '紫微', '天机', '太阳', '武曲', '天同', '廉贞',
    '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军',
  ];

  const sampleInputs: Array<{ id: string; label: string; birthInfo: BirthInfo }> = [
    {
      id: 'sample_1',
      label: '(i) 1960-01-05, giờ Tý (hour=0), nam',
      birthInfo: { year: 1960, month: 1, day: 5, hour: 0, gender: 'male' },
    },
    {
      id: 'sample_2',
      label: '(ii) 1995-08-16, giờ Tỵ (hour=5), nữ',
      birthInfo: { year: 1995, month: 8, day: 16, hour: 5, gender: 'female' },
    },
    {
      id: 'sample_3',
      label: '(iii) 2010-10-25, giờ Thân (hour=8), nam',
      birthInfo: { year: 2010, month: 10, day: 25, hour: 8, gender: 'male' },
    },
  ];

  return sampleInputs.map(({ id, label, birthInfo }) => {
    const rawChart = generateChart(birthInfo);
    const mingPalace = rawChart.palaces.find(p => p.isMingGong)!;
    const shenPalace = rawChart.palaces.find(p => p.isShenGong)!;

    // 14 chính tinh
    const majorStarsLocations: Record<
      string,
      { palaceName: string; branchIndex: number; branchName: string; stemBranch: string; brightnessRaw?: string; siHua?: string }
    > = {};

    for (const starName of MAJOR_14) {
      for (const p of rawChart.palaces) {
        const st = p.stars.find(s => s.name === starName && s.type === 'major');
        if (st) {
          majorStarsLocations[starName] = {
            palaceName: p.name,
            branchIndex: p.branch,
            branchName: BRANCHES[p.branch],
            stemBranch: `${STEMS[p.stem]}${BRANCHES[p.branch]}`,
            brightnessRaw: st.brightnessRaw,
            siHua: st.siHua,
          };
        }
      }
    }

    // Tứ Hóa của lá số
    const natalSiHua: Record<string, { starName: string; palaceName: string; branchIndex: number; branchName: string }> = {};
    for (const p of rawChart.palaces) {
      for (const s of p.stars) {
        if (s.siHua) {
          natalSiHua[s.siHua] = {
            starName: s.name,
            palaceName: p.name,
            branchIndex: p.branch,
            branchName: BRANCHES[p.branch],
          };
        }
      }
    }

    const summary = {
      id,
      label,
      input: birthInfo,
      mingGong: {
        branchIndex: rawChart.mingGongBranch,
        branchName: BRANCHES[rawChart.mingGongBranch],
        stemBranch: `${STEMS[mingPalace.stem]}${BRANCHES[mingPalace.branch]}`,
        palaceName: mingPalace.name,
      },
      shenGong: {
        branchIndex: rawChart.shenGongBranch,
        branchName: BRANCHES[rawChart.shenGongBranch],
        palaceName: shenPalace.name,
      },
      wuxingJu: {
        number: rawChart.wuxingJu,
        name: rawChart.wuxingJuName,
      },
      major14Stars: majorStarsLocations,
      natalSiHua,
      rawChart,
    };

    console.log(`\n--- ${label} ---`);
    console.log(`  Cung Mệnh: chi ${summary.mingGong.branchName} (branch=${summary.mingGong.branchIndex}, can chi=${summary.mingGong.stemBranch})`);
    console.log(`  Cung Thân: chi ${summary.shenGong.branchName} (branch=${summary.shenGong.branchIndex}, tại cung ${summary.shenGong.palaceName})`);
    console.log(`  Ngũ Hành Cục: ${summary.wuxingJu.name} (${summary.wuxingJu.number})`);
    console.log(`  Tứ Hóa Bản Mệnh:`, JSON.stringify(summary.natalSiHua));
    console.log(`  14 Chính Tinh:`, JSON.stringify(summary.major14Stars));

    return summary;
  });
}

async function main() {
  const part1 = runPanIntegrityTest();
  const part2 = runSiHuaTableComparison();

  console.log('================================================================================');
  console.log('PHẦN 3: 6 BỘ TEST HỒI QUY CÁCH CỤC & TỨ HÓA TỪ REPO GỐC');
  console.log('================================================================================');
  const part3 = {
    'patterns-dingfu.test.ts': runPatternsDingFuTest(),
    'patterns-dinggui.test.ts': runPatternsDingGuiTest(),
    'patterns-dingpin.test.ts': runPatternsDingPinTest(),
    'patterns-dingza.test.ts': await runPatternsDingZaTest(),
    'patterns-sihua-bonus.test.ts': runPatternsSiHuaBonusTest(),
    'natal-dual-sihua-same-palace.test.ts': runNatalDualSiHuaSamePalaceTest(),
  };

  const part4 = buildSampleChartsReport();

  const fullReport = {
    verifiedAt: new Date().toISOString(),
    sourceRepo: 'https://github.com/Renhuai123/ziwei-doushu',
    part1_panIntegrity: part1,
    part2_siHuaTable: part2,
    part3_patternTests: part3,
    part4_sampleCharts: part4,
  };

  const outPath = path.resolve(__dirname, 'verify-engine-output.json');
  try {
    fs.writeFileSync(outPath, JSON.stringify(fullReport, null, 2), 'utf-8');
    console.log(`\n✅ Đã lưu toàn bộ kết quả kiểm chứng vào: ${outPath}`);
  } catch {
    const tmpPath = '/tmp/verify-engine-output.json';
    fs.writeFileSync(tmpPath, JSON.stringify(fullReport, null, 2), 'utf-8');
    console.log(`\n✅ Đã lưu toàn bộ kết quả kiểm chứng vào: ${tmpPath}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
