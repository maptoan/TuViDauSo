import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

export interface EntryJsonlRow {
  book: string;
  h2: string;
  h3: string;
  quote: string;
  section?: string;
  t_hms?: string;
  note?: string;
  bvid?: string;
  part?: number;
}

export interface SourceVerificationReport {
  sourcePresent: boolean;
  sourceDir: string;
  passed: boolean;
  errors: string[];
  stats?: {
    entriesTotalLines: number;
    entriesTotalQuoteChars: number;
    entriesMedianQuoteChars: number;
    entriesMaxQuoteChars: number;
    bookCounts: Record<string, number>;
    uniqueH2Pairs: number;
    uniqueH3Groups: number;
    tier1H3Groups: number;
    lectureFileCount: number;
    lectureTotalBytes: number;
    lectureTotalChars: number;
    lectureTotalHanzi: number;
    classicsFileCount: number;
    classicsTotalBytes: number;
  };
  manifestFilesCount?: number;
}

const EXPECTED_BOOK_COUNTS: Record<string, number> = {
  '01-stars': 378,
  '02-palaces': 366,
  '03-patterns': 127,
  '04-sihua': 174,
  '05-illness': 80,
  '07-methodology': 673,
  '08-yili': 7,
  '10-divination': 24,
  '11-fengshui': 19,
};

const TIER1_BOOKS = new Set(['01-stars', '02-palaces', '03-patterns', '04-sihua']);

function countHanzi(text: string): number {
  const matches = text.match(/\p{Script=Han}/gu);
  return matches ? matches.length : 0;
}

function medianNumber(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function collectFilesRecursive(dir: string, baseDir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      out.push(...collectFilesRecursive(full, baseDir));
    } else if (stat.isFile()) {
      out.push(path.relative(baseDir, full).replace(/\\/g, '/'));
    }
  }
  return out.sort((a, b) => a.localeCompare(b, 'en'));
}

export function buildSourceManifest(sourceDir: string): {
  generatedAtIso: string;
  files: Array<{ path: string; bytes: number; sha256: string }>;
} {
  const relFiles = collectFilesRecursive(sourceDir, sourceDir).filter(
    (rel) => rel !== 'MANIFEST.sha256.json',
  );
  const files = relFiles.map((rel) => {
    const full = path.join(sourceDir, rel);
    const buf = fs.readFileSync(full);
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    return {
      path: rel,
      bytes: buf.byteLength,
      sha256,
    };
  });
  return {
    generatedAtIso: new Date().toISOString(),
    files,
  };
}

export function verifyKnowledgeSourceDir(
  sourceDir = path.resolve(process.cwd(), 'knowledge-source'),
  options?: { writeManifest?: boolean },
): SourceVerificationReport {
  const resolved = path.resolve(sourceDir);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    return {
      sourcePresent: false,
      sourceDir: resolved,
      passed: true,
      errors: [],
    };
  }

  const errors: string[] = [];
  const entriesPath = path.join(resolved, 'entries.jsonl');
  const lectureDir = path.join(resolved, 'tianji-ziwei');
  const classicsDir = path.join(resolved, 'classics');

  let entriesTotalLines = 0;
  let entriesTotalQuoteChars = 0;
  let entriesMedianQuoteChars = 0;
  let entriesMaxQuoteChars = 0;
  const bookCounts: Record<string, number> = {};
  const h2Pairs = new Set<string>();
  const h3Groups = new Set<string>();
  const tier1H3Groups = new Set<string>();

  if (!fs.existsSync(entriesPath)) {
    errors.push('Thiếu file bắt buộc entries.jsonl trong /knowledge-source/.');
  } else {
    const raw = fs.readFileSync(entriesPath, 'utf8');
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    entriesTotalLines = lines.length;
    const quoteLengths: number[] = [];

    for (let i = 0; i < lines.length; i++) {
      let row: Partial<EntryJsonlRow>;
      try {
        row = JSON.parse(lines[i]) as Partial<EntryJsonlRow>;
      } catch {
        errors.push(`entries.jsonl dòng ${i + 1}: JSON không hợp lệ.`);
        continue;
      }
      if (
        typeof row.book !== 'string' ||
        typeof row.h2 !== 'string' ||
        typeof row.h3 !== 'string' ||
        typeof row.quote !== 'string'
      ) {
        errors.push(`entries.jsonl dòng ${i + 1}: Thiếu trường book/h2/h3/quote.`);
        continue;
      }
      const qLen = row.quote.length;
      quoteLengths.push(qLen);
      entriesTotalQuoteChars += qLen;
      if (qLen > entriesMaxQuoteChars) entriesMaxQuoteChars = qLen;
      if (qLen < 1) {
        errors.push(`entries.jsonl dòng ${i + 1}: quote rỗng.`);
      }

      bookCounts[row.book] = (bookCounts[row.book] ?? 0) + 1;
      h2Pairs.add(`${row.book}::${row.h2}`);
      const h3Key = `${row.book}::${row.h2}::${row.h3}`;
      h3Groups.add(h3Key);
      if (TIER1_BOOKS.has(row.book)) {
        tier1H3Groups.add(h3Key);
      }
    }

    entriesMedianQuoteChars = medianNumber(quoteLengths);

    if (entriesTotalLines !== 1848) {
      errors.push(`entries.jsonl: kỳ vọng 1.848 dòng, thực tế ${entriesTotalLines}.`);
    }
    if (Math.abs(entriesTotalQuoteChars - 134435) > 50) {
      errors.push(
        `entries.jsonl: tổng ký tự quote kỳ vọng 134.435 (±50), thực tế ${entriesTotalQuoteChars}.`,
      );
    }
    if (entriesMedianQuoteChars !== 61) {
      errors.push(`entries.jsonl: trung vị quote kỳ vọng 61, thực tế ${entriesMedianQuoteChars}.`);
    }
    if (entriesMaxQuoteChars !== 353) {
      errors.push(`entries.jsonl: độ dài quote lớn nhất kỳ vọng 353, thực tế ${entriesMaxQuoteChars}.`);
    }
    for (const [book, expectedCount] of Object.entries(EXPECTED_BOOK_COUNTS)) {
      const actual = bookCounts[book] ?? 0;
      if (actual !== expectedCount) {
        errors.push(`entries.jsonl quyển ${book}: kỳ vọng ${expectedCount}, thực tế ${actual}.`);
      }
    }
    if (h2Pairs.size !== 68) {
      errors.push(`entries.jsonl: số cặp (book, h2) kỳ vọng 68, thực tế ${h2Pairs.size}.`);
    }
    if (h3Groups.size !== 208) {
      errors.push(`entries.jsonl: số nhóm (book, h2, h3) kỳ vọng 208, thực tế ${h3Groups.size}.`);
    }
    if (tier1H3Groups.size !== 138) {
      errors.push(`entries.jsonl: số nhóm (book, h2, h3) Tầng 1 kỳ vọng 138, thực tế ${tier1H3Groups.size}.`);
    }
  }

  let lectureFileCount = 0;
  let lectureTotalBytes = 0;
  let lectureTotalChars = 0;
  let lectureTotalHanzi = 0;

  if (!fs.existsSync(lectureDir) || !fs.statSync(lectureDir).isDirectory()) {
    errors.push('Thiếu thư mục bài giảng tianji-ziwei/ trong /knowledge-source/.');
  } else {
    const mdFiles = fs
      .readdirSync(lectureDir)
      .filter((f) => f.endsWith('.md'))
      .sort((a, b) => a.localeCompare(b, 'en'));
    lectureFileCount = mdFiles.length;
    for (const f of mdFiles) {
      const full = path.join(lectureDir, f);
      const buf = fs.readFileSync(full);
      const text = buf.toString('utf8');
      lectureTotalBytes += buf.byteLength;
      lectureTotalChars += text.length;
      lectureTotalHanzi += countHanzi(text);
    }

    if (lectureFileCount !== 16) {
      errors.push(`tianji-ziwei/: kỳ vọng đúng 16 file .md, thực tế ${lectureFileCount}.`);
    }
    if (lectureTotalBytes < 680_000 || lectureTotalBytes > 692_000) {
      errors.push(
        `tianji-ziwei/: dung lượng byte kỳ vọng 680.000–692.000 byte, thực tế ${lectureTotalBytes}.`,
      );
    }
    if (lectureTotalChars < 340_000 || lectureTotalChars > 346_000) {
      errors.push(
        `tianji-ziwei/: tổng ký tự kỳ vọng 340.000–346.000, thực tế ${lectureTotalChars}.`,
      );
    }
    if (lectureTotalHanzi < 149_500 || lectureTotalHanzi > 152_000) {
      errors.push(
        `tianji-ziwei/: tổng ký tự Hán kỳ vọng 149.500–152.000, thực tế ${lectureTotalHanzi}.`,
      );
    }
  }

  let classicsFileCount = 0;
  let classicsTotalBytes = 0;
  if (!fs.existsSync(classicsDir) || !fs.statSync(classicsDir).isDirectory()) {
    errors.push('Thiếu thư mục cổ thư classics/ trong /knowledge-source/.');
  } else {
    const cFiles = collectFilesRecursive(classicsDir, classicsDir);
    classicsFileCount = cFiles.length;
    for (const rel of cFiles) {
      classicsTotalBytes += fs.statSync(path.join(classicsDir, rel)).size;
    }
    if (classicsFileCount === 0) {
      errors.push('Thư mục classics/ không có file cổ thư nào.');
    }
  }

  let manifestFilesCount: number | undefined;
  const manifestPath = path.join(resolved, 'MANIFEST.sha256.json');
  if (options?.writeManifest && errors.length === 0) {
    const manifest = buildSourceManifest(resolved);
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    manifestFilesCount = manifest.files.length;
  } else if (fs.existsSync(manifestPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        files?: Array<{ path: string; sha256: string }>;
      };
      if (Array.isArray(existing.files)) {
        manifestFilesCount = existing.files.length;
        for (const item of existing.files) {
          const target = path.join(resolved, item.path);
          if (!fs.existsSync(target)) {
            errors.push(`MANIFEST.sha256.json: thiếu file ${item.path}.`);
            continue;
          }
          const actualSha = crypto
            .createHash('sha256')
            .update(fs.readFileSync(target))
            .digest('hex');
          if (actualSha !== item.sha256) {
            errors.push(`MANIFEST.sha256.json: sai lệch SHA-256 tại ${item.path}.`);
          }
        }
      }
    } catch {
      errors.push('MANIFEST.sha256.json không đọc được dưới dạng JSON hợp lệ.');
    }
  }

  return {
    sourcePresent: true,
    sourceDir: resolved,
    passed: errors.length === 0,
    errors,
    stats: {
      entriesTotalLines,
      entriesTotalQuoteChars,
      entriesMedianQuoteChars,
      entriesMaxQuoteChars,
      bookCounts,
      uniqueH2Pairs: h2Pairs.size,
      uniqueH3Groups: h3Groups.size,
      tier1H3Groups: tier1H3Groups.size,
      lectureFileCount,
      lectureTotalBytes,
      lectureTotalChars,
      lectureTotalHanzi,
      classicsFileCount,
      classicsTotalBytes,
    },
    manifestFilesCount,
  };
}

function main() {
  const args = process.argv.slice(2);
  const writeManifest = args.includes('--write-manifest');
  const dirArgIdx = args.indexOf('--dir');
  const sourceDir =
    dirArgIdx >= 0 && args[dirArgIdx + 1]
      ? args[dirArgIdx + 1]
      : path.resolve(process.cwd(), 'knowledge-source');

  const report = verifyKnowledgeSourceDir(sourceDir, { writeManifest });
  if (!report.sourcePresent) {
    console.log(
      `[kb:verify-source] Chưa nạp nguồn (/knowledge-source/ chưa tồn tại tại ${report.sourceDir}) — bỏ qua kiểm tra file gốc (exit 0).`,
    );
    return;
  }

  console.log('[kb:verify-source] Kết quả kiểm tra kho nguồn /knowledge-source/:');
  console.log(JSON.stringify(report.stats, null, 2));
  if (!report.passed) {
    console.error('[kb:verify-source] THẤT BẠI:');
    for (const err of report.errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }
  console.log('[kb:verify-source] ĐẠT 100% toàn bộ bất biến kho nguồn.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
