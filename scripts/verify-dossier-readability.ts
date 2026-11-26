import fs from 'node:fs';
import path from 'node:path';
import {
  computeReadingMinutes,
  countWordsUtf8,
} from '../src/lib/dossier-chat-ui';
import {
  CN_TO_VI_STAR,
  VI_BRANCHES,
  VI_STEMS,
} from '../src/lib/ziwei/vi-i18n';

interface GateResult {
  id: string;
  name: string;
  passed: boolean;
  detail: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildStarRegex(): RegExp {
  const starNames = Array.from(
    new Set(
      Object.values(CN_TO_VI_STAR)
        .map((s) => s.trim())
        .filter((s) => s.length >= 2),
    ),
  ).sort((a, b) => b.length - a.length);
  return new RegExp(
    `(?<![\\p{L}\\p{N}_])(${starNames.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}_])`,
    'giu',
  );
}

const STAR_RE = buildStarRegex();
const CAUSAL_RE = /(?<![\p{L}\p{N}_])(?:vì|nhờ|do|nên|khiến)(?![\p{L}\p{N}_])/iu;
const PALACE_MENTION_RE =
  /(?<![\p{L}\p{N}_])(?:Cung\s+(?:Lưu\s+|Đại\s+Hạn\s+)?(?:Mệnh|Thân|Huynh\s+Đệ|Phu\s+Thê|Tử\s+Nữ|Tài\s+Bạch|Tật\s+Ách|Thiên\s+Di|Giao\s+Hữu|Quan\s+Lộc|Điền\s+Trạch|Phúc\s+Đức|Phụ\s+Mẫu)|Mệnh|Huynh\s+Đệ|Phu\s+Thê|Tử\s+Nữ|Tài\s+Bạch|Tật\s+Ách|Thiên\s+Di|Giao\s+Hữu|Quan\s+Lộc|Điền\s+Trạch|Phúc\s+Đức|Phụ\s+Mẫu)(?![\p{L}\p{N}_])/iu;

function splitSentencesSafe(text: string): string[] {
  const cleaned = text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
  // Protect decimal numbers (e.g. 105.85), section numbers (e.g. A.1., 1.), and ellipses
  const protectedDots = cleaned
    .replace(/(\d)\.(\d)/g, '$1__DOT__$2')
    .replace(/\b([A-Z])\.(\d+)\./g, '$1__DOT__$2__DOT__')
    .replace(/(?:^|\s)(\d+)\.(?=\s)/g, (m) => m.replace('.', '__DOT__'));
  return protectedDots
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.replace(/__DOT__/g, '.').trim())
    .filter(Boolean);
}

function isNonProseLine(trimmed: string): boolean {
  if (!trimmed) return true;
  if (/^#{1,6}\s+/.test(trimmed)) return true;
  if (trimmed === '---' || /^\*{3,}$/.test(trimmed)) return true;
  if (trimmed.startsWith('|')) return true;
  if (trimmed.startsWith('>')) return true;
  if (/^Đọc trong \d+ phút$/i.test(trimmed)) return true;
  if (/^(?:[-*•]|\d+\.)\s+/.test(trimmed)) return true;
  return false;
}

function tokenizeVietnameseWords(text: string): Set<string> {
  const normalized = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .trim();
  if (!normalized) return new Set();
  return new Set(normalized.split(/\s+/).filter((w) => w.length >= 2));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const w of a) {
    if (b.has(w)) inter++;
  }
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function extractYearBlocks(chapterText: string): Map<number, string> {
  const lines = chapterText.split('\n');
  const yearBlocks = new Map<number, string>();
  let currentYear: number | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (currentYear !== null) {
      const prev = yearBlocks.get(currentYear) ?? '';
      yearBlocks.set(currentYear, (prev + '\n' + buffer.join('\n')).trim());
    }
    buffer = [];
  };

  for (const line of lines) {
    const headingMatch = line.match(
      /^(?:#{2,4}\s*(?:Năm\s*)?(20\d{2})\b|\*\*(?:Năm\s*)?(20\d{2})\b|-\s*\*\*(?:Năm\s*)?(20\d{2})\b)/i,
    );
    if (headingMatch) {
      flush();
      currentYear = Number(headingMatch[1] ?? headingMatch[2] ?? headingMatch[3]);
      buffer.push(line);
    } else if (currentYear !== null) {
      if (/^#{2,3}\s+(?!.*20\d{2}\b)/.test(line)) {
        flush();
        currentYear = null;
      } else {
        buffer.push(line);
      }
    }
  }
  flush();
  return yearBlocks;
}

function main(): void {
  const targetArg = process.argv[2];
  if (!targetArg) {
    console.error('Cách dùng: npx tsx scripts/verify-dossier-readability.ts <duong-dan-file-ho-so.md>');
    process.exit(1);
  }
  const resolvedPath = path.resolve(targetArg);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Không tìm thấy file: ${resolvedPath}`);
    process.exit(1);
  }

  const fullText = fs.readFileSync(resolvedPath, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const appendixMatch = /^## Phụ lục A\b/m.exec(fullText);
  const bodyOnly = appendixMatch ? fullText.slice(0, appendixMatch.index) : fullText;
  const appendicesText = appendixMatch ? fullText.slice(appendixMatch.index) : '';

  const firstChapterMatch = /^## Chương 1\b/m.exec(bodyOnly);
  const headerAndToc = firstChapterMatch ? bodyOnly.slice(0, firstChapterMatch.index) : '';
  const chaptersText = firstChapterMatch ? bodyOnly.slice(firstChapterMatch.index) : bodyOnly;

  const chapterSections = chaptersText
    .split(/(?=^## Chương \d+ )/m)
    .map((s) => s.replace(/\n---\s*$/m, '\n---').trimEnd())
    .filter((s) => /^## Chương \d+ /.test(s));

  const palaceSections: Array<{ heading: string; content: string }> = [];
  const palaceRegex = /^### (Cung [^\n]+)\n([\s\S]*?)(?=^### |^## |\n---(?:\n|$)|(?![\s\S]))/gm;
  let pm: RegExpExecArray | null;
  while ((pm = palaceRegex.exec(chaptersText)) !== null) {
    palaceSections.push({ heading: pm[1].trim(), content: pm[2] });
  }

  const results: GateResult[] = [];

  // STRUCT-CHAPTERS
  results.push({
    id: 'STRUCT-CHAPTERS',
    name: 'Đủ 8 chương chuẩn',
    passed: chapterSections.length === 8,
    detail: `${chapterSections.length}/8 chương`,
  });

  // STRUCT-PALACES
  results.push({
    id: 'STRUCT-PALACES',
    name: 'Đủ 12 cung bản mệnh (### Cung ...)',
    passed: palaceSections.length === 12,
    detail: `${palaceSections.length}/12 cung`,
  });

  // STRUCT-PALACE-WORDS
  const palaceWordIssues: string[] = [];
  for (const pal of palaceSections) {
    const palLines = pal.content.split('\n');
    let idx = 0;
    while (idx < palLines.length && !palLines[idx].trim()) idx++;
    if (idx < palLines.length && /^\*\*.*\*\*$/.test(palLines[idx].trim())) {
      idx++;
    }
    const bodyForWords = palLines.slice(idx).join('\n').trim();
    const wc = countWordsUtf8(bodyForWords);
    if (wc < 150 || wc > 250) {
      palaceWordIssues.push(`${pal.heading.split('(')[0].trim()}: ${wc} từ`);
    }
  }
  results.push({
    id: 'STRUCT-PALACE-WORDS',
    name: 'Thân bài mỗi cung 150–250 từ (trừ tiêu đề & câu chốt)',
    passed: palaceSections.length === 12 && palaceWordIssues.length === 0,
    detail:
      palaceWordIssues.length === 0
        ? '12/12 cung đạt 150–250 từ'
        : palaceWordIssues.slice(0, 4).join('; '),
  });

  // R-01: 8/8 chapter opening prose sentences <= 30 words; 0 "Xét về"/"Về mặt"/"Nhìn chung" in first 40 chars
  const r01Issues: string[] = [];
  for (let i = 0; i < chapterSections.length; i++) {
    const lines = chapterSections[i].split('\n');
    let startIdx = 1;
    if (lines[startIdx] && /^Đọc trong \d+ phút$/i.test(lines[startIdx].trim())) {
      startIdx++;
    }
    const contentLines = lines.slice(startIdx);
    const proseParagraphs: string[] = [];
    let curPara: string[] = [];
    let firstContentLine = '';
    for (const rawLine of contentLines) {
      const tr = rawLine.trim();
      if (!firstContentLine && tr && !/^#{1,6}\s+/.test(tr) && tr !== '---') {
        firstContentLine = tr;
      }
      if (isNonProseLine(tr) || /^\*\*.*\*\*$/.test(tr)) {
        if (curPara.length > 0) {
          proseParagraphs.push(curPara.join(' '));
          curPara = [];
        }
      } else {
        curPara.push(tr);
      }
    }
    if (curPara.length > 0) proseParagraphs.push(curPara.join(' '));

    const firstPara = proseParagraphs[0] ?? firstContentLine;
    const firstSentence = splitSentencesSafe(firstPara)[0] ?? '';
    const wc = countWordsUtf8(firstSentence);
    const head40FirstLine = firstContentLine.replace(/^\*\*|\*\*$/g, '').slice(0, 40);
    const head40FirstSentence = firstSentence.slice(0, 40);
    if (wc === 0 || wc > 30) {
      r01Issues.push(`Ch.${i + 1} câu mở ${wc} từ (>30)`);
    }
    if (
      /^(?:Xét về|Về mặt|Nhìn chung)\b/iu.test(head40FirstLine) ||
      /^(?:Xét về|Về mặt|Nhìn chung)\b/iu.test(head40FirstSentence)
    ) {
      r01Issues.push(`Ch.${i + 1} mở bài sáo rỗng`);
    }
  }
  results.push({
    id: 'R-01',
    name: 'Câu mở đầu 8/8 chương <= 30 từ & không sáo rỗng',
    passed: chapterSections.length === 8 && r01Issues.length === 0,
    detail: r01Issues.length === 0 ? '8/8 chương đạt' : r01Issues.join('; '),
  });

  // R-02: Prose sentences <= 60w, prose paragraphs <= 120w, bullets <= 100w
  let maxSentenceWords = 0;
  let maxParaWords = 0;
  let maxBulletWords = 0;
  const r02LongSentences: string[] = [];
  const r02LongParas: string[] = [];
  const r02LongBullets: string[] = [];

  const chapterBlocks = chaptersText.split(/\n\s*\n/);
  for (const block of chapterBlocks) {
    const rawLines = block.split('\n');
    const bulletLines = rawLines.filter((l) => /^\s*(?:[-*•]|\d+\.)\s+/.test(l));
    for (const b of bulletLines) {
      const bwc = countWordsUtf8(b);
      if (bwc > maxBulletWords) maxBulletWords = bwc;
      if (bwc > 100) r02LongBullets.push(`${bwc} từ`);
    }

    const proseLines = rawLines.filter((l) => !isNonProseLine(l.trim()));
    if (proseLines.length > 0 && proseLines.length === rawLines.filter((l) => l.trim()).length) {
      const paraText = proseLines.join(' ').trim();
      const pwc = countWordsUtf8(paraText);
      if (pwc > maxParaWords) maxParaWords = pwc;
      if (pwc > 120) r02LongParas.push(`${pwc} từ`);

      for (const sent of splitSentencesSafe(paraText)) {
        const swc = countWordsUtf8(sent);
        if (swc > maxSentenceWords) maxSentenceWords = swc;
        if (swc > 60) r02LongSentences.push(`${swc} từ`);
      }
    }
  }
  results.push({
    id: 'R-02',
    name: 'Câu <= 60 từ, đoạn <= 120 từ, gạch đầu dòng <= 100 từ',
    passed:
      r02LongSentences.length === 0 &&
      r02LongParas.length === 0 &&
      r02LongBullets.length === 0,
    detail: `max câu=${maxSentenceWords}, max đoạn=${maxParaWords}, max gạch=${maxBulletWords}`,
  });

  // R-03: 12/12 palaces immediately followed by bold conclusion <= 40 words
  const r03Issues: string[] = [];
  for (const pal of palaceSections) {
    const firstNonEmpty = pal.content
      .split('\n')
      .map((l) => l.trim())
      .find(Boolean);
    if (!firstNonEmpty || !/^\*\*.*\*\*$/.test(firstNonEmpty)) {
      r03Issues.push(`${pal.heading.split('(')[0].trim()}: thiếu dòng in đậm`);
      continue;
    }
    const wc = countWordsUtf8(firstNonEmpty);
    if (wc > 40) {
      r03Issues.push(`${pal.heading.split('(')[0].trim()}: ${wc} từ (>40)`);
    }
  }
  results.push({
    id: 'R-03',
    name: '12/12 cung có câu chốt in đậm ngay sau tiêu đề <= 40 từ',
    passed: palaceSections.length === 12 && r03Issues.length === 0,
    detail: r03Issues.length === 0 ? '12/12 cung đạt' : r03Issues.slice(0, 4).join('; '),
  });

  // R-04: Causal markers + star name in each palace, Ch.5, Ch.6; star + palace in Ch.7/8 §3/§4/Điểm đáng chú ý
  const r04Issues: string[] = [];
  const hasCausalPlusStar = (text: string): boolean => {
    for (const sent of splitSentencesSafe(text)) {
      STAR_RE.lastIndex = 0;
      if (CAUSAL_RE.test(sent) && STAR_RE.test(sent)) return true;
    }
    return false;
  };
  for (const pal of palaceSections) {
    if (!hasCausalPlusStar(pal.content)) {
      r04Issues.push(`Thiếu nhân-quả+sao ở ${pal.heading.split('(')[0].trim()}`);
    }
  }
  for (const chIdx of [4, 5]) {
    const ch = chapterSections[chIdx] ?? '';
    if (!hasCausalPlusStar(ch)) {
      r04Issues.push(`Thiếu nhân-quả+sao ở Ch.${chIdx + 1}`);
    }
  }
  for (const chIdx of [6, 7]) {
    const ch = chapterSections[chIdx] ?? '';
    const focusMatch = ch.match(
      /###\s*(?:3\.|4\.|.*Điểm đáng chú ý)[\s\S]*/i,
    );
    const focusText = focusMatch ? focusMatch[0] : ch;
    STAR_RE.lastIndex = 0;
    if (!STAR_RE.test(focusText) || !PALACE_MENTION_RE.test(focusText)) {
      r04Issues.push(`Ch.${chIdx + 1} §3/§4 thiếu sao+cung`);
    }
  }
  results.push({
    id: 'R-04',
    name: 'Liên kết nhân-quả + sao (12 cung, Ch.5–6) & sao+cung (Ch.7–8)',
    passed: palaceSections.length === 12 && chapterSections.length === 8 && r04Issues.length === 0,
    detail: r04Issues.length === 0 ? 'Đạt toàn bộ' : r04Issues.slice(0, 4).join('; '),
  });

  // R-05: 0 Phi Tinh, 0 [Tự Hóa, 0 cát tinh, 0 sát tinh in body
  const phiTinhCount = (bodyOnly.match(/Phi Tinh/giu) ?? []).length;
  const tuHoaTagCount = (bodyOnly.match(/\[Tự Hóa/gu) ?? []).length;
  const catTinhCount = (bodyOnly.match(/(?<![\p{L}\p{N}_])cát tinh(?![\p{L}\p{N}_])/giu) ?? []).length;
  const satTinhCount = (bodyOnly.match(/(?<![\p{L}\p{N}_])sát tinh(?![\p{L}\p{N}_])/giu) ?? []).length;
  results.push({
    id: 'R-05',
    name: 'Thân bài sạch biệt ngữ/nhãn (Phi Tinh, [Tự Hóa, cát tinh, sát tinh = 0)',
    passed: phiTinhCount === 0 && tuHoaTagCount === 0 && catTinhCount === 0 && satTinhCount === 0,
    detail: `PhiTinh=${phiTinhCount}, [Tự Hóa=${tuHoaTagCount}, cát tinh=${catTinhCount}, sát tinh=${satTinhCount}`,
  });

  // R-06: Bracket labels <= 120, 0 [Tứ Hóa/[Phi Tinh/[Tự Hóa, <= 1 brightness tag per star per chapter
  const bracketLabels = bodyOnly.match(/\[[^\]\n]+\]/g) ?? [];
  const forbiddenSiHuaBracket = (bodyOnly.match(/\[(?:Tứ Hóa|Phi Tinh|Tự Hóa)/gu) ?? []).length;
  const brightnessDupIssues: string[] = [];
  const starBrightRe = new RegExp(
    `(${Object.values(CN_TO_VI_STAR).map(escapeRegExp).sort((a, b) => b.length - a.length).join('|')})\\s*\\[(Miếu|Vượng|Đắc|Lợi|Bình|Bất|Nhàn|Hãm|Địa)\\]`,
    'giu',
  );
  for (let i = 0; i < chapterSections.length; i++) {
    const counts = new Map<string, number>();
    let m: RegExpExecArray | null;
    starBrightRe.lastIndex = 0;
    while ((m = starBrightRe.exec(chapterSections[i])) !== null) {
      const key = m[1].toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const [star, cnt] of counts.entries()) {
      if (cnt > 1) brightnessDupIssues.push(`Ch.${i + 1}:${star}(${cnt})`);
    }
  }
  results.push({
    id: 'R-06',
    name: 'Nhãn [...] <= 120, 0 nhãn Tứ/Phi/Tự Hóa, <= 1 độ sáng/sao/chương',
    passed:
      bracketLabels.length <= 120 &&
      forbiddenSiHuaBracket === 0 &&
      brightnessDupIssues.length === 0,
    detail: `nhãn=${bracketLabels.length}/120, nhãnHóa=${forbiddenSiHuaBracket}, lặpĐộSáng=${brightnessDupIssues.length}`,
  });

  // R-07: 0 generic template phrase + Ch.7 vs Ch.8 Jaccard <= 0.30
  const templateLeak = (bodyOnly.match(/Lưu Niên đi qua cung chức năng phụ trợ của Đại Hạn/giu) ?? []).length;
  const ch7Years = extractYearBlocks(chapterSections[6] ?? '');
  const ch8Years = extractYearBlocks(chapterSections[7] ?? '');
  const sharedYears = Array.from(ch7Years.keys())
    .filter((y) => ch8Years.has(y))
    .sort((a, b) => a - b)
    .slice(0, 5);
  let maxJaccard = 0;
  const highJaccardYears: string[] = [];
  for (const y of sharedYears) {
    const sim = jaccardSimilarity(
      tokenizeVietnameseWords(ch7Years.get(y)!),
      tokenizeVietnameseWords(ch8Years.get(y)!),
    );
    if (sim > maxJaccard) maxJaccard = sim;
    if (sim > 0.3) highJaccardYears.push(`${y}:${sim.toFixed(2)}`);
  }
  results.push({
    id: 'R-07',
    name: 'Không lặp văn mẫu Ch.7–8 (Jaccard <= 0.30 & 0 câu mẫu chung)',
    passed: templateLeak === 0 && sharedYears.length > 0 && highJaccardYears.length === 0,
    detail: `vănMẫu=${templateLeak}, nămChung=${sharedYears.length}, maxJaccard=${maxJaccard.toFixed(2)}`,
  });

  // R-09: Period/horizon chapters (6, 7, 8) contain "trùng" >= 1 and "cung gốc" >= 1
  const r09Issues: string[] = [];
  for (const chIdx of [5, 6, 7]) {
    const ch = chapterSections[chIdx] ?? '';
    const trungCount = (ch.match(/(?<![\p{L}\p{N}_])trùng(?![\p{L}\p{N}_])/giu) ?? []).length;
    const cungGocCount = (ch.match(/cung gốc/giu) ?? []).length;
    if (trungCount < 1 || cungGocCount < 1) {
      r09Issues.push(`Ch.${chIdx + 1}(trùng=${trungCount},cung gốc=${cungGocCount})`);
    }
  }
  results.push({
    id: 'R-09',
    name: 'Ch.6–8 có >= 1 "trùng" và >= 1 "cung gốc"',
    passed: chapterSections.length === 8 && r09Issues.length === 0,
    detail: r09Issues.length === 0 ? 'Ch.6–8 đạt' : r09Issues.join('; '),
  });

  // R-10: Can-Chi 60-Jiazi polarity & Phụ lục A.1 palace Can-Chi cross-check
  const stemSet = new Map(VI_STEMS.map((s, idx) => [s.toLowerCase(), idx]));
  const branchSet = new Map(VI_BRANCHES.map((b, idx) => [b.toLowerCase(), idx]));
  const ganZhiRe = new RegExp(
    `\\b(${VI_STEMS.join('|')})\\s+(${VI_BRANCHES.join('|')})\\b`,
    'giu',
  );
  const invalidPolarityPairs: string[] = [];
  let gzMatch: RegExpExecArray | null;
  while ((gzMatch = ganZhiRe.exec(bodyOnly)) !== null) {
    const si = stemSet.get(gzMatch[1].toLowerCase())!;
    const bi = branchSet.get(gzMatch[2].toLowerCase())!;
    if (si % 2 !== bi % 2) {
      invalidPolarityPairs.push(`${gzMatch[1]} ${gzMatch[2]}`);
    }
  }
  const appendixCanChi = new Map<string, string>();
  const a1RowRe = /^\|\s*\d+\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/gm;
  let rowM: RegExpExecArray | null;
  while ((rowM = a1RowRe.exec(appendicesText)) !== null) {
    appendixCanChi.set(rowM[1].trim().toLowerCase(), rowM[2].trim().toLowerCase());
  }
  const palaceCanChiMismatches: string[] = [];
  if (appendixCanChi.size > 0) {
    for (const pal of palaceSections) {
      const hm = pal.heading.match(/^Cung\s+([^(]+?)\s*\(([^)]+)\)/i);
      if (hm) {
        const expected = appendixCanChi.get(hm[1].trim().toLowerCase());
        if (expected && expected !== hm[2].trim().toLowerCase()) {
          palaceCanChiMismatches.push(`${hm[1]}: ${hm[2]} != ${expected}`);
        }
      }
    }
  }
  results.push({
    id: 'R-10',
    name: 'Can Chi hợp lệ 60 Hoa Giáp & khớp Phụ lục A.1',
    passed: invalidPolarityPairs.length === 0 && palaceCanChiMismatches.length === 0,
    detail:
      invalidPolarityPairs.length === 0 && palaceCanChiMismatches.length === 0
        ? '0 lỗi Can Chi'
        : [...invalidPolarityPairs, ...palaceCanChiMismatches].slice(0, 4).join('; '),
  });

  // R-11: "bạn" (excl. "bạn bè") = 0; "đương số" >= 1
  const bodyWithoutBanBe = bodyOnly.replace(/\bbạn\s+bè\b/giu, '');
  const banCount = (bodyWithoutBanBe.match(/(?<![\p{L}\p{N}_])bạn(?![\p{L}\p{N}_])/giu) ?? []).length;
  const duongSoCount = (bodyOnly.match(/đương số/giu) ?? []).length;
  results.push({
    id: 'R-11',
    name: 'Xưng hô chuẩn: "bạn" = 0, "đương số" >= 1',
    passed: banCount === 0 && duongSoCount >= 1,
    detail: `"bạn"=${banCount}, "đương số"=${duongSoCount}`,
  });

  // R-12: 8/8 chapters have "Đọc trong N phút" matching computeReadingMinutes(spanWords)
  const r12Issues: string[] = [];
  for (let i = 0; i < chapterSections.length; i++) {
    const chLines = chapterSections[i].split('\n');
    const titleLine = chLines[0] ?? '';
    const readLine = chLines[1] ?? '';
    const rm = readLine.match(/^Đọc trong (\d+) phút$/);
    if (!rm) {
      r12Issues.push(`Ch.${i + 1}: thiếu dòng Đọc trong N phút`);
      continue;
    }
    const spanWithoutRead = [titleLine, ...chLines.slice(2)].join('\n');
    const expected = computeReadingMinutes(countWordsUtf8(spanWithoutRead));
    if (Number(rm[1]) !== expected) {
      r12Issues.push(`Ch.${i + 1}: ghi ${rm[1]}p != tính ${expected}p`);
    }
  }
  results.push({
    id: 'R-12',
    name: '8/8 chương có "Đọc trong N phút" khớp span thật',
    passed: chapterSections.length === 8 && r12Issues.length === 0,
    detail: r12Issues.length === 0 ? '8/8 chương khớp' : r12Issues.join('; '),
  });

  // EXTRA-HYGIENE
  const headerAndApp = `${headerAndToc}\n${appendicesText}`;
  const chartHasCanhNgo = /Canh Ngọ/i.test(headerAndApp);
  const canhNgoBodyCount = chartHasCanhNgo ? 0 : (chaptersText.match(/Canh Ngọ/giu) ?? []).length;
  const verifyWarnCount = (bodyOnly.match(/Ghi Chú Kiểm Chứng/giu) ?? []).length;
  const bodyDisclaimerCount = (
    bodyOnly.match(/Nội dung tham khảo phục vụ nghiên cứu mệnh lý Tử Vi Đẩu Số/gu) ?? []
  ).length;
  const eofDisclaimerCount = (
    fullText.match(/\*Lưu ý: Hồ sơ phục vụ tham khảo nghiên cứu mệnh lý Tử Vi Đẩu Số theo hệ thống Thiên Kỷ\.\*/g) ?? []
  ).length;
  const nonIndentDoubleSpaces = bodyOnly
    .split('\n')
    .filter((l) => /[^\s] {2,}/.test(l)).length;
  const badPunctSpacing = (bodyOnly.match(/[^\s|]\s+[.,](?!\.)/g) ?? []).length;

  results.push({
    id: 'EXTRA-HYGIENE',
    name: 'Vệ sinh văn bản (0 Canh Ngọ lạc, 0 cảnh báo, 1 disclaimer EOF, 0 double-space/dấu cách lỗi)',
    passed:
      canhNgoBodyCount === 0 &&
      verifyWarnCount === 0 &&
      bodyDisclaimerCount === 0 &&
      eofDisclaimerCount === 1 &&
      nonIndentDoubleSpaces === 0 &&
      badPunctSpacing === 0,
    detail: `CanhNgọ=${canhNgoBodyCount}, cảnhBáo=${verifyWarnCount}, discBody=${bodyDisclaimerCount}, discEOF=${eofDisclaimerCount}, dblSpace=${nonIndentDoubleSpaces}, badPunct=${badPunctSpacing}`,
  });

  // Print table
  console.log(`\n=== KIỂM ĐỊNH ĐỘ DỄ ĐỌC HỒ SƠ (${path.basename(resolvedPath)}) ===\n`);
  let failedCount = 0;
  for (const r of results) {
    const tag = r.passed ? 'ĐẠT ' : 'LỖI ';
    if (!r.passed) failedCount++;
    console.log(`[${tag}] ${r.id.padEnd(18)} | ${r.name}`);
    console.log(`       ↳ ${r.detail}`);
  }
  console.log(`\nTổng kết: ${results.length - failedCount}/${results.length} cổng ĐẠT.`);
  if (failedCount > 0) {
    process.exit(1);
  }
}

main();
