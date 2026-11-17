/**
 * 《紫微斗数全书》卷一〈定富局〉六格 · 严格实现
 *
 * 底本：卷一〈定富局〉六条，各带注文。姊妹篇〈定贵局〉二十七格见
 *      `patterns-dinggui.ts`；判读纪律（照字面、不放宽、无解不写死代码）与彼处相同。
 *
 * 本表六条里两条安星无解（财荫夹印、荫印拱身），都是「梁相夹/拱」家族——
 * 天梁恒居天相后一宫（delta 恒 1），这对相邻星对永远无法分居一宫两侧，
 * 也无法同入一宫的三方四正（拱位集 {+4,+8} 与冲位 {+6} 之间最小差 2）。
 *
 * 另外两条可达格各被恒等式锁死成唯一形态：
 *  - 日月夹财：太阳恒在武曲后一宫（delta 恒 1，2,304 盘实测），
 *    故「日月夹武」唯一形态是太阴在前、太阳在后；
 *  - 财禄夹马：禄存永不在天马前一位（天马只在寅申巳亥，马前一位不在禄存
 *    十宫集内，结构性恒真），故「武禄夹马」唯一形态是禄在后、武在前。
 *
 * ⚠️ 盘对象陷阱：`ZiweiChart.palaces` 实际从寅宫（branch=2）起排，
 *    一律按 branch 查，禁止用下标。helper「夹」= 相邻 ±1，不是隔位 ±2。
 */

import type { ZiweiChart, Palace } from './types';
import type { GeStatus, ProjectVerdict } from './patterns-dinggui';

// ────────────────── 盘面读取 ──────────────────

const palaceAt = (c: ZiweiChart, branch: number): Palace =>
  c.palaces.find(p => p.branch === ((branch % 12) + 12) % 12)!;

const has = (c: ZiweiChart, branch: number, name: string): boolean =>
  palaceAt(c, branch).stars.some(s => s.name === name);

const starBranch = (c: ZiweiChart, name: string): number =>
  c.palaces.find(p => p.stars.some(s => s.name === name))?.branch ?? -1;

const palaceBranch = (c: ZiweiChart, name: string): number =>
  c.palaces.find(p => p.name === name)?.branch ?? -1;

/** 相邻前一宫 / 后一宫。「夹」指的是这两宫，不是 ±2 隔位。 */
const prevBranch = (b: number) => (b + 11) % 12;
const nextBranch = (b: number) => (b + 1) % 12;

const majorCount = (c: ZiweiChart, b: number): number =>
  palaceAt(c, b).stars.filter(s => s.type === 'major').length;

// ────────────────── 类型 ──────────────────

export interface DingFuGe {
  /** 原书序号 1-6 */
  no: number;
  name: string;
  /** 原文注文（含「田宅宫亦然」一类扩展条件） */
  note: string;
  status: GeStatus;
  /** status 为 unreachable 时的几何理由；derivable 但形态唯一时注明 */
  why?: string;
  /** 原项目是否已有对应识别器（定富局六条项目全部没有） */
  inProject: ProjectVerdict;
  /** 判定函数；status 为 unreachable 时缺省 */
  fn?: (c: ZiweiChart) => boolean;
}

// ────────────────── 六格 ──────────────────

export const DING_FU_GE: DingFuGe[] = [
  {
    no: 1,
    name: '财荫夹印',
    note: '相守命，武梁来夹是也，田宅宫亦然',
    status: 'unreachable',
    inProject: 'none',
    why:
      'Chú giải yêu cầu Vũ Khúc và Thiên Lương phân cư hai bên giáp Thiên Tướng. Thiên Lương luôn đứng liền sau Thiên Tướng 1 cung, ' +
      'nhưng khoảng cách giữa Vũ Khúc và Thiên Tướng luôn là số chẵn nên Vũ Khúc không bao giờ ở cung liền kề Thiên Tướng; do đó điều kiện giáp Ấn không thể xảy ra theo luật an sao.',
  },
  {
    no: 2,
    name: '日月夹财',
    note: '武守命，日月来夹是也，财帛宫亦然',
    status: 'derivable',
    inProject: 'none',
    // 形态唯一：太阳→武曲 delta 恒 1（太阳恒在武曲后一宫），「前日后月」的
    // 读法永不可能；「前月后日」实测可达（2,304 盘中 32 例，1.39%）。
    fn: c => {
      const wu = starBranch(c, '武曲');
      if (wu < 0) return false;
      const jia = (palace: number): boolean =>
        has(c, prevBranch(palace), '太阴') && has(c, nextBranch(palace), '太阳');
      // 主形态：武曲守命；扩展形态：武曲守财帛宫
      const mingFu = c.mingGongBranch === wu && jia(wu);
      const caiFu = palaceBranch(c, '财帛') === wu && jia(wu);
      return mingFu || caiFu;
    },
    why:
      'Có thể thành cách với hình thái duy nhất: Thái Dương luôn đứng sau Vũ Khúc 1 cung, nên Nhật Nguyệt giáp Tài chỉ xảy ra khi Thái Âm ở cung trước và Thái Dương ở cung sau Vũ Khúc (áp dụng cho cả Mệnh Cung và cung Tài Bạch).',
  },
  {
    no: 3,
    name: '财禄夹马',
    note: '马守命，武禄来夹是也，逢生旺尤妙',
    status: 'derivable',
    inProject: 'none',
    // 形态唯一：禄存永不在天马前一位（结构性恒真：天马只在寅申巳亥，
    // 马前一位与禄存十宫集无交集），故夹法只能是禄在后（b+1）、武曲在前（b-1）。
    fn: c => {
      const b = c.mingGongBranch;
      if (!has(c, b, '天马')) return false;
      return has(c, prevBranch(b), '武曲') && has(c, nextBranch(b), '禄存');
    },
    why:
      'Có thể thành cách nhưng hiếm gặp (khoảng 0.20% số lá số) với hình thái duy nhất: Lộc Tồn không bao giờ đứng trước Thiên Mã 1 cung, nên Vũ Lộc giáp Mã chỉ xảy ra khi Vũ Khúc ở cung trước và Lộc Tồn ở cung sau Thiên Mã.',
  },
  {
    no: 4,
    name: '荫印拱身',
    note: '身临田宅，梁相拱冲是也，勿坐空亡',
    status: 'unreachable',
    inProject: 'none',
    why:
      'Thiên Lương luôn đứng liền sau Thiên Tướng 1 cung (cặp sao liền kề), trong khi các vị trí tam hợp (+4/+8) và xung chiếu (+6) của cung Điền Trạch cách nhau ít nhất 2 cung, nên hai sao liền kề không thể đồng thời hội chiếu hoặc xung chiếu.',
  },
  {
    no: 5,
    name: '日月照璧',
    note: '日月临田宅宫是也，喜居墓库',
    status: 'derivable',
    inProject: 'none',
    // 日月同宫只在丑、未（墓库），注文「喜居墓库」由安星法自动满足。
    fn: c => {
      const tz = palaceBranch(c, '田宅');
      if (tz < 0) return false;
      return has(c, tz, '太阳') && has(c, tz, '太阴');
    },
    why:
      'Thái Dương và Thái Âm đồng cung chỉ xuất hiện tại hai cung Sửu và Mùi (thuộc Tứ Mộ khố), hoàn toàn tương hợp tự nhiên với điều kiện hỷ cư Mộ Khố trong cổ thư.',
  },
  {
    no: 6,
    name: '金灿光辉',
    note: '太阳单守，命在午宫是也',
    status: 'derivable',
    inProject: 'none',
    fn: c => c.mingGongBranch === 6 && has(c, 6, '太阳') && majorCount(c, 6) === 1,
  },
];

// ────────────────── 入口 ──────────────────

export interface DingFuHit {
  no: number;
  name: string;
  note: string;
  status: GeStatus;
}

/**
 * 判一张盘的〈定富局〉格。unreachable 条目跳过；返回顺序即原书序号。
 */
export function detectDingFu(chart: ZiweiChart): DingFuHit[] {
  const out: DingFuHit[] = [];
  for (const g of DING_FU_GE) {
    if (!g.fn) continue;
    if (g.fn(chart)) {
      out.push({ no: g.no, name: g.name, note: g.note, status: g.status });
    }
  }
  return out;
}

/** 可判定的条目数（不含 unreachable） */
export const DING_FU_JUDGEABLE = DING_FU_GE.filter(g => !!g.fn).length;

/** 安星无解的条目 */
export const DING_FU_UNREACHABLE = DING_FU_GE.filter(g => g.status === 'unreachable');
