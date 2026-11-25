import { generateChart } from '../src/lib/ziwei/algorithm';
import { buildYunxianPeriodContext, YunxianPeriodContext } from '../src/lib/ziwei/yunxian-context';
import { VI_BRANCHES, VI_STEMS, translateWuxingJu, translatePalaceName } from '../src/lib/ziwei/vi-i18n';

// 1. Tạo cố định 1 lá số: Nguyễn Minh Tâm, sinh ngày 15/05/1990 Dương lịch, giờ Tý (0), Nam Mệnh
const fixedChart = generateChart({
  name: 'Nguyễn Minh Tâm',
  year: 1990,
  month: 5,
  day: 15,
  hour: 0,
  gender: 'male',
  longitude: 105.85,
  city: 'Hà Nội',
});

// 2. Gọi buildYunxianPeriodContext cho 2 Đại Hạn khác nhau và 2 Lưu Niên khác nhau
const dahan1 = buildYunxianPeriodContext(fixedChart, {
  mode: 'dahan',
  daXianIndex: 2, // Đại hạn thứ 3 (24–33 tuổi)
});

const dahan2 = buildYunxianPeriodContext(fixedChart, {
  mode: 'dahan',
  daXianIndex: 3, // Đại hạn thứ 4 (34–43 tuổi)
});

const liunian1 = buildYunxianPeriodContext(fixedChart, {
  mode: 'liunian',
  year: 2026, // Năm Bính Ngọ 2026
});

const liunian2 = buildYunxianPeriodContext(fixedChart, {
  mode: 'liunian',
  year: 2027, // Năm Đinh Mùi 2027
});

const allFour: { tag: string; ctx: YunxianPeriodContext }[] = [
  { tag: 'ĐẠI HẠN 1 (daXianIndex=2)', ctx: dahan1! },
  { tag: 'ĐẠI HẠN 2 (daXianIndex=3)', ctx: dahan2! },
  { tag: 'LƯU NIÊN 1 (Năm 2026)', ctx: liunian1! },
  { tag: 'LƯU NIÊN 2 (Năm 2027)', ctx: liunian2! },
];

const mingPalace = fixedChart.palaces.find((p) => p.branch === fixedChart.mingGongBranch);
const shenPalace = fixedChart.palaces.find((p) => p.branch === fixedChart.shenGongBranch);

console.log('====================================================================');
console.log('KIỂM CHỨNG TẦNG XÁC ĐỊNH (DETERMINISTIC) TRÊN 1 LÁ SỐ CỐ ĐỊNH');
console.log(`Đương số: ${fixedChart.birthInfo.name} | Dương lịch: 15/5/1990 Giờ Tý | Nam Mệnh`);
console.log(
  `Âm lịch: ${fixedChart.lunarInfo.lunarDay}/${fixedChart.lunarInfo.lunarMonth}/${fixedChart.lunarInfo.lunarYear} | Cục: ${translateWuxingJu(fixedChart.wuxingJuName)} | Mệnh tại: ${VI_BRANCHES[fixedChart.mingGongBranch]} (${translatePalaceName(mingPalace?.name || '')}) | Thân tại: ${VI_BRANCHES[fixedChart.shenGongBranch]} (${translatePalaceName(shenPalace?.name || '')})`
);
console.log('====================================================================\n');

for (const { tag, ctx } of allFour) {
  console.log(`### [${tag}] — ${ctx.periodTitleVi} (${ctx.ageRangeOrYearVi})`);
  console.log(`- Cache Key: ${ctx.cacheKey}`);
  console.log(
    `- Can Chi kỳ hạn: ${ctx.ganZhiVi} (Thiên Can: ${VI_STEMS[ctx.stemIndex]}, Địa Chi: ${VI_BRANCHES[ctx.branchIndex]})`
  );
  console.log(
    `- Cung bản mệnh kích hoạt: ${ctx.activatedPalace.natalPalaceNameVi} tại cung ${VI_BRANCHES[ctx.activatedPalace.branch]} (${ctx.activatedPalace.ganZhiVi})`
  );
  console.log(`- Chính tinh tọa thủ bản cung: ${ctx.activatedPalace.majorStarsSummaryVi}`);
  console.log(
    `- Tứ Hóa kỳ hạn (Can ${VI_STEMS[ctx.stemIndex]}): ` +
      ctx.periodSiHua
        .map((s) => `${s.mutagenVi}: ${s.starNameVi} → ${s.natalPalaceNameVi} (${s.natalPalaceGanZhiVi})`)
        .join(' | ')
  );
  console.log(
    `- Sao lưu kỳ hạn tiêu biểu: ` +
      ctx.dynamicStars
        .slice(0, 10)
        .map((d) => `${d.starLabelVi}→${d.branchVi}(${d.natalPalaceNameVi})`)
        .join(', ')
  );
  console.log(
    `- Tam Phương Tứ Chính & Xung Chiếu: ` +
      `Bản cung=${ctx.sanFangSiZheng.benGong.natalPalaceNameVi}(${ctx.sanFangSiZheng.benGong.ganZhiVi}), ` +
      `Xung chiếu=${ctx.sanFangSiZheng.xungChieu.natalPalaceNameVi}(${ctx.sanFangSiZheng.xungChieu.ganZhiVi}), ` +
      `Tam hợp Tài=${ctx.sanFangSiZheng.tamHopTai.natalPalaceNameVi}(${ctx.sanFangSiZheng.tamHopTai.ganZhiVi}), ` +
      `Tam hợp Quan=${ctx.sanFangSiZheng.tamHopQuan.natalPalaceNameVi}(${ctx.sanFangSiZheng.tamHopQuan.ganZhiVi})`
  );
  console.log('');
}

// Kiểm tra khẳng định tự động: 4 kết quả hoàn toàn phân biệt nhau
const uniqueFactTables = new Set(allFour.map((item) => item.ctx.factTableMarkdown));
const uniqueDetInterps = new Set(allFour.map((item) => item.ctx.deterministicInterpretationMarkdown));
const uniqueActivated = new Set(
  allFour.map((item) => `${item.ctx.mode}:${item.ctx.activatedPalace.natalPalaceNameVi}@${item.ctx.activatedPalace.branch}`)
);

if (uniqueFactTables.size !== 4 || uniqueDetInterps.size !== 4 || uniqueActivated.size !== 4) {
  console.error('LỖI: Kết quả 4 kỳ hạn không khác biệt hoàn toàn!');
  process.exit(1);
}

if (
  !liunian1!.dynamicStars.every((d) => Boolean(d.natalGanZhiVi)) ||
  !liunian1!.factTableMarkdown.includes('trùng cung Bản Mệnh gốc ')
) {
  console.error('LỖI: Sao lưu động thiếu Can Chi cung Bản Mệnh gốc (A4)!');
  process.exit(1);
}

console.log('✓ KHẲNG ĐỊNH ĐẠT: Cả 4 kỳ hạn (2 Đại Hạn + 2 Lưu Niên) sinh ra 4 Bảng dữ kiện kỳ hạn và 4 bản luận giải xác định hoàn toàn khác nhau.\n');

console.log('--- MẪU BẢNG DỮ KIỆN KỲ HẠN (ĐẠI HẠN 1: 24-33 TUỔI) ---');
console.log(dahan1!.factTableMarkdown);
console.log('\n--- MẪU BẢNG DỮ KIỆN KỲ HẠN (LƯU NIÊN 1: NĂM 2026) ---');
console.log(liunian1!.factTableMarkdown);
