import * as fs from 'fs';
import * as path from 'path';

const CJK_REGEX = /[\u3400-\u9FFF\uF900-\uFAFF]/;

export type Category = 'i_default_ui' | 'ii_hanzi_toggle' | 'iii_internal_key' | 'iv_comment';

export interface CjkItem {
  line: number;
  category: Category;
  snippet: string;
  reason: string;
}

export interface FileScanResult {
  file: string;
  totalLinesWithCjk: number;
  counts: {
    i_default_ui: number;
    ii_hanzi_toggle: number;
    iii_internal_key: number;
    iv_comment: number;
  };
  examples: {
    i_default_ui: string[];
    ii_hanzi_toggle: string[];
    iii_internal_key: string[];
    iv_comment: string[];
  };
  items: CjkItem[];
}

function getAllFiles(dir: string, acc: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(full, acc);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc.sort();
}

function classifyLine(relPath: string, lineText: string, lineNum: number, inBlockComment: boolean): { category: Category; reason: string } {
  const trimmed = lineText.trim();

  // (iv) Code comments
  if (inBlockComment || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
    return { category: 'iv_comment', reason: 'Code comment / JSDoc' };
  }

  const commentIdx = lineText.indexOf('//');
  if (commentIdx !== -1) {
    const codePart = lineText.slice(0, commentIdx);
    const commentPart = lineText.slice(commentIdx);
    if (!CJK_REGEX.test(codePart) && CJK_REGEX.test(commentPart)) {
      return { category: 'iv_comment', reason: 'Inline code comment' };
    }
  }

  // Component files in src/components/
  if (relPath.startsWith('src/components/')) {
    if (
      lineText.includes('showHanzi') ||
      lineText.includes('.hanzi') ||
      lineText.includes('hanziName') ||
      lineText.includes('rawNote') ||
      lineText.includes('rawSource')
    ) {
      return { category: 'ii_hanzi_toggle', reason: 'Conditional Hanzi display when showHanzi toggle is ON' };
    }
    // Internal lookup keys in components (e.g. '夫妻', '紫微', '庙': 'text-...', '禄': { ... })
    if (
      /\.includes\(['"][\u3400-\u9FFF]+['"]\)/.test(lineText) ||
      /useState<string>\(['"][\u3400-\u9FFF]+['"]\)/.test(lineText) ||
      /^\s*(['"][\u3400-\u9FFF]+['"]\s*,\s*)+$/.test(trimmed) ||
      /^\s*['"][\u3400-\u9FFF]+['"]\s*:\s*/.test(trimmed) ||
      /\['[\u3400-\u9FFF]+'\]/.test(lineText) ||
      /type:\s*['"][\u3400-\u9FFF]+['"]/.test(lineText) ||
      /===|!==|case\s+['"]|Record<|\bcn\b|PALACE_ORDER|SIHUA_BADGE|sihua\s*===|star\.name|p\.name/.test(lineText)
    ) {
      return { category: 'iii_internal_key', reason: 'Internal star/palace/sihua/brightness lookup key in component' };
    }
    return { category: 'i_default_ui', reason: 'Unconditional CJK string in component' };
  }

  // Localization dictionary: src/lib/ziwei/vi-i18n.ts
  if (relPath === 'src/lib/ziwei/vi-i18n.ts') {
    if (/\b(hanzi|hanziName|rawNote|rawCondition|rawSource)\b/.test(lineText)) {
      return { category: 'ii_hanzi_toggle', reason: 'Hanzi metadata shown only when showHanzi toggle is ON' };
    }
    // Check single key-value pair where RHS is a string literal: `'cn_key': 'vi_val',`
    const singleKv = trimmed.match(/^['"][^'"]+['"]\s*:\s*['"`]([^'"`]*)['"`]\s*,?$/);
    if (singleKv) {
      if (CJK_REGEX.test(singleKv[1])) {
        return { category: 'i_default_ui', reason: 'Target Vietnamese translation in vi-i18n.ts still contains CJK' };
      }
      return { category: 'iii_internal_key', reason: 'Chinese-to-Vietnamese dictionary lookup key' };
    }
    return { category: 'iii_internal_key', reason: 'Chinese source key / matcher in vi-i18n.ts' };
  }

  // Data file: src/lib/ziwei/db-analysis.ts
  if (relPath === 'src/lib/ziwei/db-analysis.ts') {
    if (lineNum >= 34 && lineNum <= 49 && /^\s*(overview|personality|love|career|wealth|health|family|children|move|friends|home|spirit|parents)\s*:\s*['"][^'"]*[\u3400-\u9FFF]/.test(lineText)) {
      return { category: 'i_default_ui', reason: 'Untranslated TOPIC_LABEL display string in db-analysis.ts' };
    }
    return { category: 'iii_internal_key', reason: 'Internal palace/star/sihua matching key in db-analysis.ts' };
  }

  // Data file: src/lib/ziwei/heming-knowledge.ts
  if (relPath === 'src/lib/ziwei/heming-knowledge.ts') {
    if (/^\s*['"][\u3400-\u9FFF]+['"]\s*:\s*\{/.test(lineText)) {
      return { category: 'iii_internal_key', reason: 'Star lookup key in heming-knowledge.ts' };
    }
    const kv = trimmed.match(/^['"][\u3400-\u9FFF]+['"]\s*:\s*['"`]([^'"`]*)['"`]\s*,?$/);
    if (kv && !CJK_REGEX.test(kv[1])) {
      return { category: 'iii_internal_key', reason: 'SiHua / star / score lookup key in heming-knowledge.ts' };
    }
    return { category: 'i_default_ui', reason: 'Untranslated Chinese display text in heming-knowledge.ts' };
  }

  // Data file: src/lib/ziwei/famous.ts
  if (relPath === 'src/lib/ziwei/famous.ts') {
    if (/shichenName\s*:/.test(lineText)) {
      return { category: 'iii_internal_key', reason: 'Internal shichen key in famous.ts' };
    }
    return { category: 'i_default_ui', reason: 'Untranslated Chinese display text in famous.ts' };
  }

  // Data file: src/lib/ziwei/school-config.ts
  if (relPath === 'src/lib/ziwei/school-config.ts') {
    if (
      /\b(label|desc)\s*:\s*['"][^'"]*[\u3400-\u9FFF]/.test(lineText) ||
      /^\s*(default|XD2|XD1|ZS|TG|LF|LS|ZB|TK|QF)\s*:\s*['"][^'"]*[\u3400-\u9FFF]/.test(lineText)
    ) {
      return { category: 'i_default_ui', reason: 'Untranslated school option label/desc in school-config.ts' };
    }
    return { category: 'iii_internal_key', reason: 'Internal school calculation table key in school-config.ts' };
  }

  // Data file: src/lib/ziwei/constants.ts
  if (relPath === 'src/lib/ziwei/constants.ts') {
    if (/\b(keywords|nature|element)\s*:\s*['"][^'"]*[\u3400-\u9FFF]/.test(lineText)) {
      return { category: 'i_default_ui', reason: 'Untranslated STAR_DESCRIPTIONS metadata in constants.ts' };
    }
    return { category: 'iii_internal_key', reason: 'Core engine constant key (STEMS/BRANCHES/PALACE_NAMES/JU/SI_HUA_TABLE)' };
  }

  // Data file: src/lib/ziwei/dst-cn.ts
  if (relPath === 'src/lib/ziwei/dst-cn.ts') {
    if (/start:|end:/.test(lineText) && CJK_REGEX.test(lineText)) {
      return { category: 'i_default_ui', reason: 'Untranslated date range display string in dst-cn.ts' };
    }
    return { category: 'iii_internal_key', reason: 'Internal logic in dst-cn.ts' };
  }

  // Pattern files: patterns.ts, patterns-dinggui.ts, patterns-dingfu.ts, patterns-dingpin.ts, patterns-dingza.ts
  if (
    relPath === 'src/lib/ziwei/patterns.ts' ||
    relPath === 'src/lib/ziwei/patterns-dinggui.ts' ||
    relPath === 'src/lib/ziwei/patterns-dingfu.ts' ||
    relPath === 'src/lib/ziwei/patterns-dingpin.ts' ||
    relPath === 'src/lib/ziwei/patterns-dingza.ts'
  ) {
    // Check if why / detail / getMingGongSummary maps are still in Chinese
    if (
      /\b(why|detail)\s*:\s*['"`][^'"`]*[\u3400-\u9FFF]/.test(lineText) ||
      (relPath === 'src/lib/ziwei/patterns.ts' && lineNum >= 1160 && lineNum <= 1190 && /:\s*(\[[^\]]*[\u3400-\u9FFF]|['"][^'"]*[\u3400-\u9FFF])/.test(lineText))
    ) {
      return { category: 'i_default_ui', reason: 'Untranslated pattern why/detail/summary text in patterns*.ts' };
    }
    // Check multi-line why string continuations in patterns-ding*.ts
    if (
      relPath.startsWith('src/lib/ziwei/patterns-ding') &&
      /^['"`][^'"`]*[\u3400-\u9FFF]/.test(trimmed)
    ) {
      return { category: 'i_default_ui', reason: 'Untranslated multi-line why explanation in patterns-ding*.ts' };
    }
    return { category: 'iii_internal_key', reason: 'Engine pattern identifier / condition token mapped via vi-i18n.ts' };
  }

  return { category: 'iii_internal_key', reason: 'Internal engine identifier / lookup table key' };
}

function scanAll(): FileScanResult[] {
  const rootDir = process.cwd();
  const srcDir = path.join(rootDir, 'src');
  const files = getAllFiles(srcDir);
  const results: FileScanResult[] = [];

  for (const fullPath of files) {
    const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split(/\r?\n/);

    const items: CjkItem[] = [];
    const counts = {
      i_default_ui: 0,
      ii_hanzi_toggle: 0,
      iii_internal_key: 0,
      iv_comment: 0,
    };
    const examples: FileScanResult['examples'] = {
      i_default_ui: [],
      ii_hanzi_toggle: [],
      iii_internal_key: [],
      iv_comment: [],
    };

    let inBlockComment = false;
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const lineNum = idx + 1;

      const trimmed = line.trim();
      if (trimmed.startsWith('/*')) {
        inBlockComment = true;
      }

      if (CJK_REGEX.test(line)) {
        const { category, reason } = classifyLine(relPath, line, lineNum, inBlockComment);
        counts[category]++;
        const snippet = `L${lineNum}: ${trimmed.slice(0, 88)}${trimmed.length > 88 ? '...' : ''}`;
        if (examples[category].length < 3) {
          examples[category].push(snippet);
        }
        items.push({ line: lineNum, category, snippet, reason });
      }

      if (inBlockComment && trimmed.includes('*/')) {
        inBlockComment = false;
      }
    }

    // Check pattern localization completeness in vi-i18n.ts and PatternsCard.tsx
    if (relPath === 'src/components/PatternsCard.tsx') {
      if (!content.includes('showHanzi')) {
        counts.i_default_ui++;
        const msg = 'PatternsCard.tsx: Missing showHanzi toggle guard for classical pattern Hanzi / notes';
        examples.i_default_ui.push(msg);
        items.push({ line: 1, category: 'i_default_ui', snippet: msg, reason: 'PatternsCard lacks Hanzi toggle' });
      }
    }
    if (relPath === 'src/lib/ziwei/vi-i18n.ts') {
      if (!content.includes('Tử Vi Đẩu Số Toàn Thư, phần ${tableVi}, điều ${no}')) {
        counts.i_default_ui++;
        const msg = 'vi-i18n.ts: Quanshu citation/condition format not standardized to "Tử Vi Đẩu Số Toàn Thư, phần ..., điều ..."';
        examples.i_default_ui.push(msg);
        items.push({ line: 992, category: 'i_default_ui', snippet: msg, reason: 'Unstandardized Quanshu citation format' });
      }
      if (!content.includes('身命虽弱二限逢禄马是也')) {
        counts.i_default_ui++;
        const msg = 'vi-i18n.ts: Missing DING_ZA_GE (Định Tạp Cục) classical notes in EXACT_CONDITION_VI';
        examples.i_default_ui.push(msg);
        items.push({ line: 954, category: 'i_default_ui', snippet: msg, reason: 'Missing Định Tạp Cục notes in vi-i18n.ts' });
      }
    }

    results.push({
      file: relPath,
      totalLinesWithCjk: items.filter((i) => i.line > 0).length,
      counts,
      examples,
      items,
    });
  }

  return results;
}

const phaseArg = process.argv.find((a) => a.startsWith('--phase='))?.split('=')[1] || 'current';
const scanResults = scanAll();

const totals = scanResults.reduce(
  (acc, r) => {
    acc.totalLinesWithCjk += r.totalLinesWithCjk;
    acc.i_default_ui += r.counts.i_default_ui;
    acc.ii_hanzi_toggle += r.counts.ii_hanzi_toggle;
    acc.iii_internal_key += r.counts.iii_internal_key;
    acc.iv_comment += r.counts.iv_comment;
    return acc;
  },
  { totalLinesWithCjk: 0, i_default_ui: 0, ii_hanzi_toggle: 0, iii_internal_key: 0, iv_comment: 0 }
);

console.log(`=== CJK SCAN REPORT (PHASE: ${phaseArg.toUpperCase()}) ===`);
console.log(`Total files scanned: ${scanResults.length}`);
console.log(`Total lines with CJK: ${totals.totalLinesWithCjk}`);
console.log(`  (i)   Default UI / Data Prose (MUST BE 0): ${totals.i_default_ui}`);
console.log(`  (ii)  Hanzi Toggle ON only               : ${totals.ii_hanzi_toggle}`);
console.log(`  (iii) Internal Lookup Keys               : ${totals.iii_internal_key}`);
console.log(`  (iv)  Code Comments                      : ${totals.iv_comment}`);
console.log('');

for (const r of scanResults) {
  if (r.totalLinesWithCjk > 0 || r.counts.i_default_ui > 0) {
    console.log(
      `${r.file.padEnd(42)} | total=${String(r.totalLinesWithCjk).padStart(4)} | (i)=${String(r.counts.i_default_ui).padStart(3)} | (ii)=${String(r.counts.ii_hanzi_toggle).padStart(3)} | (iii)=${String(r.counts.iii_internal_key).padStart(4)} | (iv)=${String(r.counts.iv_comment).padStart(3)}`
    );
    if (r.examples.i_default_ui.length > 0) {
      console.log(`    [i]: ${r.examples.i_default_ui.join(' || ')}`);
    }
  }
}

const outputPathTmp = `/tmp/scan-cjk-${phaseArg}.json`;
fs.writeFileSync(outputPathTmp, JSON.stringify({ phase: phaseArg, totals, files: scanResults }, null, 2), 'utf-8');
console.log(`\nSaved JSON report to ${outputPathTmp}`);
