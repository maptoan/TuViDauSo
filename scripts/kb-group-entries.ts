import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { CN_TO_VI_PALACE, CN_TO_VI_STAR } from '../src/lib/ziwei/vi-i18n.ts';
import type {
  KnowledgeAnchorQuoteItem,
  KnowledgeCategory,
  KnowledgeCorpusType,
  KnowledgeScopeTier,
  KnowledgeSourceLicense,
} from '../server/knowledge-base/types.ts';
import type { EntryJsonlRow } from './kb-verify-source.ts';

export interface IndexedEntryRow extends EntryJsonlRow {
  lineNumber: number;
}

export interface GroupedDistillationUnit {
  citationId: string;
  corpusType: KnowledgeCorpusType;
  scopeTier: KnowledgeScopeTier;
  category: KnowledgeCategory;
  sourceLicense: KnowledgeSourceLicense;
  groupKey: {
    book: string;
    h2Cn: string;
    h3Cn: string;
    subGroupKey?: string;
  };
  quotes: KnowledgeAnchorQuoteItem[];
  combinedQuotesCn: string;
  notesCn: string[];
  bvids: string[];
  timeRangeHms?: string;
  sourceFilePath: string;
  sourceLineNumbers: number[];
  supportingLectureWindow?: string;
  sourceHash: string;
}

export interface LectureFileContent {
  fileName: string;
  relPath: string;
  content: string;
}

export interface ClassicsFileContent {
  fileName: string;
  relPath: string;
  content: string;
}

const MAJOR_STAR_CN_LIST = [
  '紫微',
  '天机',
  '太阳',
  '武曲',
  '天同',
  '廉贞',
  '天府',
  '太阴',
  '贪狼',
  '巨门',
  '天相',
  '天梁',
  '七杀',
  '破军',
];

const TIER3_BOOKS = new Set(['08-yili', '10-divination', '11-fengshui']);

function compareHms(a?: string, b?: string): number {
  const norm = (v?: string) => (v && v.trim() ? v.trim() : '99:99:99');
  return norm(a).localeCompare(norm(b), 'en');
}

function sortRowsDeterministically(rows: readonly IndexedEntryRow[]): IndexedEntryRow[] {
  return [...rows].sort((a, b) => {
    const partA = typeof a.part === 'number' ? a.part : Number.MAX_SAFE_INTEGER;
    const partB = typeof b.part === 'number' ? b.part : Number.MAX_SAFE_INTEGER;
    if (partA !== partB) return partA - partB;
    const hmsCmp = compareHms(a.t_hms, b.t_hms);
    if (hmsCmp !== 0) return hmsCmp;
    return a.lineNumber - b.lineNumber;
  });
}

function mapBookToCategoryAndPrefix(book: string): {
  category: KnowledgeCategory;
  prefix: string;
  scopeTier: KnowledgeScopeTier;
} | null {
  switch (book) {
    case '01-stars':
      return { category: '01-stars', prefix: 'NH-STAR', scopeTier: 'tier1_core' };
    case '02-palaces':
      return { category: '02-palaces', prefix: 'NH-PAL', scopeTier: 'tier1_core' };
    case '03-patterns':
      return { category: '03-patterns', prefix: 'NH-PAT', scopeTier: 'tier1_core' };
    case '04-sihua':
      return { category: '04-sihua', prefix: 'NH-SIHUA', scopeTier: 'tier1_core' };
    case '05-illness':
      return { category: '05-illness', prefix: 'NH-ILL', scopeTier: 'tier2_extended' };
    case '07-methodology':
      return { category: '07-methodology', prefix: 'NH-METH', scopeTier: 'tier2_extended' };
    default:
      return null;
  }
}

function detectMajorStarSubKey(row: IndexedEntryRow): string {
  const haystack = `${row.section ?? ''} ${row.quote} ${row.note ?? ''}`;
  const found: string[] = [];
  for (const cn of MAJOR_STAR_CN_LIST) {
    if (haystack.includes(cn)) {
      found.push(CN_TO_VI_STAR[cn] ?? cn);
    }
  }
  if (found.length > 0) {
    return found.slice(0, 2).join('+');
  }
  if (row.section && row.section.trim()) {
    return row.section.trim();
  }
  return 'general';
}

function buildTimeRange(quotes: readonly KnowledgeAnchorQuoteItem[]): string | undefined {
  const times = quotes
    .map((q) => q.t_hms?.trim())
    .filter((v): v is string => Boolean(v && /^\d{2}:\d{2}(:\d{2})?$/.test(v)))
    .sort((a, b) => a.localeCompare(b, 'en'));
  if (times.length === 0) return undefined;
  if (times.length === 1) return times[0];
  return `${times[0]}–${times[times.length - 1]}`;
}

function computeUnitSourceHash(
  citationId: string,
  combinedQuotesCn: string,
  lectureWindow?: string,
): string {
  return crypto
    .createHash('sha256')
    .update(`${citationId}\n${combinedQuotesCn}\n${lectureWindow ?? ''}`, 'utf8')
    .digest('hex')
    .slice(0, 16);
}

export function parseEntriesJsonlContent(
  jsonlContent: string,
  _sourceFilePath = 'knowledge-source/entries.jsonl',
): IndexedEntryRow[] {
  const lines = jsonlContent.split(/\r?\n/);
  const rows: IndexedEntryRow[] = [];
  for (let idx = 0; idx < lines.length; idx++) {
    const trimmed = lines[idx].trim();
    if (!trimmed) continue;
    const parsed = JSON.parse(trimmed) as EntryJsonlRow;
    rows.push({
      ...parsed,
      lineNumber: idx + 1,
    });
  }
  return rows;
}

export function findSupportingLectureWindow(
  lectures: readonly LectureFileContent[],
  params: {
    bvids?: readonly string[];
    tHmsList?: readonly string[];
    quoteCn?: string;
    radiusChars?: number;
  },
): string | undefined {
  if (lectures.length === 0) return undefined;
  const radius = params.radiusChars ?? 550;

  let matchedLecture: LectureFileContent | undefined;
  for (const bvid of params.bvids ?? []) {
    if (!bvid) continue;
    matchedLecture = lectures.find((l) => l.content.includes(bvid));
    if (matchedLecture) break;
  }
  if (!matchedLecture && params.quoteCn) {
    const probe = params.quoteCn.slice(0, Math.min(12, params.quoteCn.length)).trim();
    if (probe.length >= 6) {
      matchedLecture = lectures.find((l) => l.content.includes(probe));
    }
  }
  if (!matchedLecture) return undefined;

  const text = matchedLecture.content;
  let anchorPos = -1;
  for (const t of params.tHmsList ?? []) {
    if (!t) continue;
    const shortT = t.startsWith('00:') ? t.slice(3) : t;
    const idx = text.indexOf(t);
    if (idx >= 0) {
      anchorPos = idx;
      break;
    }
    const idxShort = text.indexOf(shortT);
    if (idxShort >= 0) {
      anchorPos = idxShort;
      break;
    }
  }
  if (anchorPos < 0 && params.quoteCn) {
    const probe = params.quoteCn.slice(0, Math.min(12, params.quoteCn.length)).trim();
    if (probe.length >= 6) {
      anchorPos = text.indexOf(probe);
    }
  }
  if (anchorPos < 0) return undefined;

  const start = Math.max(0, anchorPos - radius);
  const end = Math.min(text.length, anchorPos + radius);
  return text.slice(start, end).trim();
}

export function groupEntriesJsonl(
  rows: readonly IndexedEntryRow[],
  options?: {
    books?: readonly string[];
    includeTier3?: boolean;
    lectures?: readonly LectureFileContent[];
    sourceFilePath?: string;
    subGroupThreshold?: number;
  },
): GroupedDistillationUnit[] {
  const sourceFilePath = options?.sourceFilePath ?? 'knowledge-source/entries.jsonl';
  const subGroupThreshold = options?.subGroupThreshold ?? 12;
  const bookFilter = options?.books ? new Set(options.books) : null;
  const lectures = options?.lectures ?? [];

  const groupedByKey = new Map<string, IndexedEntryRow[]>();
  const orderedKeys: string[] = [];

  for (const row of rows) {
    if (!options?.includeTier3 && TIER3_BOOKS.has(row.book)) continue;
    if (bookFilter && !bookFilter.has(row.book)) continue;
    const meta = mapBookToCategoryAndPrefix(row.book);
    if (!meta) continue;

    const k = `${row.book}\u0000${row.h2}\u0000${row.h3}`;
    let list = groupedByKey.get(k);
    if (!list) {
      list = [];
      groupedByKey.set(k, list);
      orderedKeys.push(k);
    }
    list.push(row);
  }

  const counterByBook = new Map<string, number>();
  const units: GroupedDistillationUnit[] = [];

  for (const key of orderedKeys) {
    const rawList = groupedByKey.get(key) ?? [];
    const sortedRows = sortRowsDeterministically(rawList);
    const first = sortedRows[0];
    if (!first) continue;

    const meta = mapBookToCategoryAndPrefix(first.book)!;
    const nextNum = (counterByBook.get(first.book) ?? 0) + 1;
    counterByBook.set(first.book, nextNum);
    const baseCitationId = `${meta.prefix}-${String(nextNum).padStart(3, '0')}`;

    const shouldSplitPalaceSubGroups =
      first.book === '02-palaces' && sortedRows.length > subGroupThreshold;

    const subGroups: Array<{ subGroupKey?: string; suffix?: string; rows: IndexedEntryRow[] }> = [];

    if (shouldSplitPalaceSubGroups) {
      const buckets = new Map<string, IndexedEntryRow[]>();
      const bucketOrder: string[] = [];
      for (const r of sortedRows) {
        const subKey = detectMajorStarSubKey(r);
        let b = buckets.get(subKey);
        if (!b) {
          b = [];
          buckets.set(subKey, b);
          bucketOrder.push(subKey);
        }
        b.push(r);
      }

      if (bucketOrder.length > 1) {
        let subIdx = 0;
        for (const subKey of bucketOrder) {
          const bRows = buckets.get(subKey) ?? [];
          if (subKey === 'general') {
            subGroups.push({ subGroupKey: 'general', suffix: 'GEN', rows: bRows });
          } else {
            subIdx += 1;
            subGroups.push({
              subGroupKey: subKey,
              suffix: String(subIdx).padStart(2, '0'),
              rows: bRows,
            });
          }
        }
      } else {
        subGroups.push({ rows: sortedRows });
      }
    } else {
      subGroups.push({ rows: sortedRows });
    }

    for (const sg of subGroups) {
      const citationId = sg.suffix ? `${baseCitationId}-${sg.suffix}` : baseCitationId;
      const quotes: KnowledgeAnchorQuoteItem[] = sg.rows.map((r) => ({
        quoteCn: r.quote,
        ...(r.note && r.note.trim() ? { noteCn: r.note.trim() } : {}),
        ...(r.t_hms && r.t_hms.trim() ? { t_hms: r.t_hms.trim() } : {}),
        ...(r.bvid && r.bvid.trim() ? { bvid: r.bvid.trim() } : {}),
        ...(typeof r.part === 'number' ? { part: r.part } : {}),
        ...(r.section && r.section.trim() ? { sectionCn: r.section.trim() } : {}),
        sourceLineNumber: r.lineNumber,
      }));
      const combinedQuotesCn = quotes.map((q) => q.quoteCn).join('\n');
      const bvids = Array.from(
        new Set(quotes.map((q) => q.bvid).filter((b): b is string => Boolean(b))),
      );
      const notesCn = Array.from(
        new Set(quotes.map((q) => q.noteCn).filter((n): n is string => Boolean(n))),
      );
      const tHmsList = quotes
        .map((q) => q.t_hms)
        .filter((t): t is string => Boolean(t));

      const lectureWindow = findSupportingLectureWindow(lectures, {
        bvids,
        tHmsList,
        quoteCn: quotes[0]?.quoteCn,
      });

      units.push({
        citationId,
        corpusType: 'nihai_entry',
        scopeTier: meta.scopeTier,
        category: meta.category,
        sourceLicense: 'CC-BY-NC-SA-4.0',
        groupKey: {
          book: first.book,
          h2Cn: first.h2,
          h3Cn: first.h3,
          ...(sg.subGroupKey ? { subGroupKey: sg.subGroupKey } : {}),
        },
        quotes,
        combinedQuotesCn,
        notesCn,
        bvids,
        timeRangeHms: buildTimeRange(quotes),
        sourceFilePath,
        sourceLineNumbers: sg.rows.map((r) => r.lineNumber),
        ...(lectureWindow ? { supportingLectureWindow: lectureWindow } : {}),
        sourceHash: computeUnitSourceHash(citationId, combinedQuotesCn, lectureWindow),
      });
    }
  }

  return units;
}

function classifyClassicPrefix(relPath: string): { prefix: string; h2Cn: string } {
  const lower = relPath.toLowerCase();
  if (lower.includes('gu-sui') || lower.includes('gusui') || lower.includes('cot-tuy')) {
    return { prefix: 'CL-CTP', h2Cn: '骨髓赋' };
  }
  if (lower.includes('tai-wei') || lower.includes('taiwei') || lower.includes('thai-vi')) {
    return { prefix: 'CL-TVP', h2Cn: '太微赋' };
  }
  return { prefix: 'CL-TT', h2Cn: '紫微斗数全书' };
}

export function extractClassicsVerses(
  files: readonly ClassicsFileContent[],
): GroupedDistillationUnit[] {
  const counters = new Map<string, number>();
  const units: GroupedDistillationUnit[] = [];

  for (const file of files) {
    const cls = classifyClassicPrefix(file.relPath);
    const lines = file.content.split(/\r?\n/);
    let currentH3 = cls.h2Cn;

    for (let idx = 0; idx < lines.length; idx++) {
      const trimmed = lines[idx].trim();
      if (!trimmed) continue;
      if (/^#{1,6}\s+/.test(trimmed)) {
        currentH3 = trimmed.replace(/^#{1,6}\s+/, '').trim();
        continue;
      }
      // Bỏ qua các dòng không phải câu chữ Hán (ví dụ comment code hoặc link)
      const hanMatches = trimmed.match(/\p{Script=Han}/gu);
      if (!hanMatches || hanMatches.length < 6) continue;

      const cleanCn = trimmed.replace(/^[-*•>\d.)\s]+/, '').trim();
      const nextNum = (counters.get(cls.prefix) ?? 0) + 1;
      counters.set(cls.prefix, nextNum);
      const citationId = `${cls.prefix}-${String(nextNum).padStart(3, '0')}`;

      units.push({
        citationId,
        corpusType: 'classic_verse',
        scopeTier: 'tier1_core',
        category: 'classics-fu',
        sourceLicense: 'PUBLIC_DOMAIN_TEXT_WITH_CC_BY_NC_SA_ADAPTATION',
        groupKey: {
          book: 'classics-fu',
          h2Cn: cls.h2Cn,
          h3Cn: currentH3,
        },
        quotes: [
          {
            quoteCn: cleanCn,
            sectionCn: currentH3,
            sourceLineNumber: idx + 1,
          },
        ],
        combinedQuotesCn: cleanCn,
        notesCn: [],
        bvids: [],
        sourceFilePath: `knowledge-source/classics/${file.relPath}`,
        sourceLineNumbers: [idx + 1],
        sourceHash: computeUnitSourceHash(citationId, cleanCn),
      });
    }
  }

  return units;
}

export function loadSourceMaterialsForGrouping(
  sourceDir = path.resolve(process.cwd(), 'knowledge-source'),
): {
  sourcePresent: boolean;
  rows: IndexedEntryRow[];
  lectures: LectureFileContent[];
  classics: ClassicsFileContent[];
} {
  const resolved = path.resolve(sourceDir);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    return { sourcePresent: false, rows: [], lectures: [], classics: [] };
  }

  const entriesPath = path.join(resolved, 'entries.jsonl');
  const rows = fs.existsSync(entriesPath)
    ? parseEntriesJsonlContent(fs.readFileSync(entriesPath, 'utf8'))
    : [];

  const lectures: LectureFileContent[] = [];
  const lectureDir = path.join(resolved, 'tianji-ziwei');
  if (fs.existsSync(lectureDir) && fs.statSync(lectureDir).isDirectory()) {
    for (const fileName of fs
      .readdirSync(lectureDir)
      .filter((f) => f.endsWith('.md'))
      .sort((a, b) => a.localeCompare(b, 'en'))) {
      lectures.push({
        fileName,
        relPath: fileName,
        content: fs.readFileSync(path.join(lectureDir, fileName), 'utf8'),
      });
    }
  }

  const classics: ClassicsFileContent[] = [];
  const classicsDir = path.join(resolved, 'classics');
  if (fs.existsSync(classicsDir) && fs.statSync(classicsDir).isDirectory()) {
    for (const fileName of fs
      .readdirSync(classicsDir)
      .filter((f) => /\.(md|txt)$/i.test(f))
      .sort((a, b) => a.localeCompare(b, 'en'))) {
      classics.push({
        fileName,
        relPath: fileName,
        content: fs.readFileSync(path.join(classicsDir, fileName), 'utf8'),
      });
    }
  }

  return { sourcePresent: true, rows, lectures, classics };
}

export function translateKnownTermsForGroup(unit: GroupedDistillationUnit): {
  stars: Array<{ cn: string; vi: string }>;
  palaces: Array<{ cn: string; vi: string }>;
} {
  const haystack = `${unit.groupKey.h2Cn} ${unit.groupKey.h3Cn} ${unit.combinedQuotesCn} ${unit.supportingLectureWindow ?? ''}`;
  const stars = Object.entries(CN_TO_VI_STAR)
    .filter(([cn]) => haystack.includes(cn))
    .map(([cn, vi]) => ({ cn, vi }));
  const palaces = Object.entries(CN_TO_VI_PALACE)
    .filter(([cn]) => haystack.includes(cn))
    .map(([cn, vi]) => ({ cn, vi }));
  return { stars, palaces };
}

function main() {
  const args = process.argv.slice(2);
  const pilotOnly = !args.includes('--all');
  const loaded = loadSourceMaterialsForGrouping();
  if (!loaded.sourcePresent) {
    console.log('[kb:group] Chưa nạp kho nguồn (/knowledge-source/ chưa có) — bỏ qua gom nhóm (exit 0).');
    return;
  }

  const entryUnits = groupEntriesJsonl(loaded.rows, {
    books: pilotOnly ? ['01-stars', '04-sihua'] : undefined,
    lectures: loaded.lectures,
  });
  const classicUnits = extractClassicsVerses(loaded.classics);
  console.log(
    `[kb:group] Đã gom ${entryUnits.length} nhóm từ entries.jsonl (${pilotOnly ? 'Pilot 1A: 01-stars + 04-sihua' : 'Tất cả'}) và ${classicUnits.length} câu phú từ classics/.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
