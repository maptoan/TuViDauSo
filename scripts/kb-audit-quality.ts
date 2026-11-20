import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import {
  CN_TO_VI_PALACE,
  CN_TO_VI_STAR,
  PATTERN_NAME_VI,
  VI_BRANCHES,
} from '../src/lib/ziwei/vi-i18n.ts';
import { loadKnowledgeBase, DEFAULT_KB_DATA_DIR } from '../server/knowledge-base/loader.ts';
import type { DistilledKnowledgeEntry } from '../server/knowledge-base/types.ts';

export interface KbAuditReport {
  passed: boolean;
  dataDir: string;
  filesLoaded: string[];
  totalEntries: number;
  sampleEntries: number;
  realEntries: number;
  errors: string[];
  warnings: string[];
}

const VALID_STARS = new Set(Object.values(CN_TO_VI_STAR));
const VALID_PALACES = new Set(Object.values(CN_TO_VI_PALACE));
const VALID_PATTERNS = new Set(Object.values(PATTERN_NAME_VI));
const VALID_BRANCHES = new Set(VI_BRANCHES);
const VALID_MUTAGENS = new Set(['Hóa Lộc', 'Hóa Quyền', 'Hóa Khoa', 'Hóa Kỵ']);

// Danh sách ngoại lệ độ dài summaryVi đã kiểm toán đạt trong bộ dữ liệu Tầng 1 (giữ nguyên nội dung đã duyệt)
const SUMMARY_VI_AUDITED_EXCEPTIONS: Record<string, number> = {
  'NH-STAR-037': 475, // 2 quotes, 475 ký tự
  'NH-SIHUA-009': 511, // 4 quotes, 511 ký tự
};

// Ngoại lệ sàn độ dài fullTranslationVi: các mục có quote nguồn là mảnh đơn câu của ca quyết
// Tý Ngọ Lưu Chú (nguồn chỉ 5–6 ký tự) nên bản dịch toàn văn trung thành ngắn hơn sàn 20 ký tự.
// Nội dung đã kiểm toán đạt; summaryVi/conditionsVi mang đủ ngữ cảnh. Chỉ áp cho đúng 4 mục này.
const FULL_TRANSLATION_MIN_EXCEPTIONS = new Set([
  'NH-ILL-004', // quote 「寅时开肺。」— fullTranslationVi 17 ký tự
  'NH-ILL-007', // quote 「脾开巳时。」— fullTranslationVi 19 ký tự
  'NH-ILL-012', // quote 「这是心包。」— fullTranslationVi 15 ký tự
  'NH-ILL-013', // quote 「这是三焦。」— fullTranslationVi 16 ký tự
]);

function getSummaryViMaxLength(entry: DistilledKnowledgeEntry): { maxChars: number; tierLabel: string } {
  const exceptionMax = SUMMARY_VI_AUDITED_EXCEPTIONS[entry.id];
  if (typeof exceptionMax === 'number') {
    return { maxChars: exceptionMax, tierLabel: `ngoại lệ kiểm toán (${exceptionMax})` };
  }
  if (entry.corpusType === 'classic_verse') {
    return { maxChars: 350, tierLabel: 'classic_verse <= 350' };
  }
  const quoteCount = entry.hanziAnchor?.quotes?.length ?? 0;
  if (quoteCount <= 6) {
    return { maxChars: 450, tierLabel: 'nihai_entry <= 6 quotes -> 450' };
  }
  if (quoteCount <= 14) {
    return { maxChars: 800, tierLabel: 'nihai_entry 7–14 quotes -> 800' };
  }
  if (quoteCount <= 20) {
    return { maxChars: 1100, tierLabel: 'nihai_entry 15–20 quotes -> 1100' };
  }
  return { maxChars: 1500, tierLabel: 'nihai_entry > 20 quotes -> 1500' };
}

function hasHanzi(text?: string): boolean {
  return Boolean(text && /\p{Script=Han}/u.test(text));
}

function loadEntriesJsonlLines(sourceDir: string): string[] | null {
  const filePath = path.join(sourceDir, 'entries.jsonl');
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
}

export function auditKnowledgeBaseEntries(
  entries: readonly DistilledKnowledgeEntry[],
  options?: {
    dataDir?: string;
    filesLoaded?: string[];
    sourceDir?: string;
    requireReal?: boolean;
  },
): KbAuditReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seenIds = new Set<string>();
  const sourceDir = options?.sourceDir ?? path.resolve(process.cwd(), 'knowledge-source');
  const entriesLines = loadEntriesJsonlLines(sourceDir);

  let sampleEntries = 0;
  let realEntries = 0;

  for (const entry of entries) {
    if (entry.qaMeta?.sample) sampleEntries += 1;
    else realEntries += 1;

    if (seenIds.has(entry.id)) {
      errors.push(`[${entry.id}] Trùng lặp mã citationId.`);
    }
    seenIds.add(entry.id);

    if (entry.id !== entry.sourceRef.citationId) {
      errors.push(`[${entry.id}] id (${entry.id}) khác sourceRef.citationId (${entry.sourceRef.citationId}).`);
    }

    const expectedLicense =
      entry.corpusType === 'classic_verse'
        ? 'PUBLIC_DOMAIN_TEXT_WITH_CC_BY_NC_SA_ADAPTATION'
        : 'CC-BY-NC-SA-4.0';
    if (entry.sourceRef.sourceLicense !== expectedLicense) {
      errors.push(
        `[${entry.id}] Sai sourceLicense: kỳ vọng ${expectedLicense}, thực tế ${entry.sourceRef.sourceLicense}.`,
      );
    }

    for (const [field, value] of [
      ['sourceRef.workTitleVi', entry.sourceRef.workTitleVi],
      ['sourceRef.groupTitleVi', entry.sourceRef.groupTitleVi],
      ['summaryVi', entry.summaryVi],
      ['fullTranslationVi', entry.fullTranslationVi],
      ['conditionsVi', entry.conditionsVi],
    ] as const) {
      if (hasHanzi(value)) {
        errors.push(`[${entry.id}] Trường ${field} còn sót ký tự chữ Hán.`);
      }
    }

    // Trần độ dài summaryVi theo bậc số quote cho nihai_entry (<=6 -> 450, 7–14 -> 800, 15–20 -> 1100, >20 -> 1500)
    // và 350 ký tự cho classic_verse (tối thiểu 120 cho toàn bộ mục), cộng danh sách ngoại lệ đã kiểm toán ở SUMMARY_VI_AUDITED_EXCEPTIONS.
    const summaryLen = entry.summaryVi.trim().length;
    const { maxChars: summaryMax, tierLabel } = getSummaryViMaxLength(entry);
    if (summaryLen < 120 || summaryLen > summaryMax) {
      errors.push(
        `[${entry.id}] Độ dài summaryVi = ${summaryLen} ký tự (ngoài khung 120–${summaryMax} ký tự; bậc ${tierLabel}).`,
      );
    }

    if (
      !FULL_TRANSLATION_MIN_EXCEPTIONS.has(entry.id) &&
      (!entry.fullTranslationVi || entry.fullTranslationVi.trim().length < 20)
    ) {
      errors.push(`[${entry.id}] fullTranslationVi quá ngắn hoặc rỗng.`);
    }

    for (const s of entry.retrievalKeys.starsVi ?? []) {
      if (!VALID_STARS.has(s)) {
        errors.push(`[${entry.id}] Sao "${s}" không thuộc từ điển vi-i18n.ts.`);
      }
    }
    for (const p of entry.retrievalKeys.palacesVi ?? []) {
      if (!VALID_PALACES.has(p)) {
        errors.push(`[${entry.id}] Cung "${p}" không thuộc từ điển vi-i18n.ts.`);
      }
    }
    for (const pat of entry.retrievalKeys.patternsVi ?? []) {
      if (!VALID_PATTERNS.has(pat)) {
        errors.push(`[${entry.id}] Cách cục "${pat}" không thuộc PATTERN_NAME_VI trong vi-i18n.ts.`);
      }
    }
    for (const br of entry.retrievalKeys.branchesVi ?? []) {
      if (!VALID_BRANCHES.has(br)) {
        errors.push(`[${entry.id}] Địa chi "${br}" không thuộc VI_BRANCHES.`);
      }
    }
    for (const sh of entry.retrievalKeys.sihuaCombos ?? []) {
      if (!VALID_MUTAGENS.has(sh.mutagenVi)) {
        errors.push(`[${entry.id}] Tứ Hóa "${sh.mutagenVi}" không hợp lệ.`);
      }
      if (sh.starVi && !VALID_STARS.has(sh.starVi)) {
        errors.push(`[${entry.id}] Sao trong sihuaCombos "${sh.starVi}" không thuộc vi-i18n.ts.`);
      }
    }

    if (!entry.hanziAnchor?.quotes || entry.hanziAnchor.quotes.length === 0) {
      errors.push(`[${entry.id}] Thiếu hanziAnchor.quotes.`);
    } else {
      for (const q of entry.hanziAnchor.quotes) {
        if (!q.quoteCn || !q.quoteCn.trim()) {
          errors.push(`[${entry.id}] Có phần tử quoteCn rỗng trong hanziAnchor.`);
          continue;
        }
        if (!entry.hanziAnchor.combinedQuotesCn.includes(q.quoteCn)) {
          errors.push(`[${entry.id}] combinedQuotesCn không chứa nguyên văn quoteCn.`);
        }
        if (
          !entry.qaMeta?.sample &&
          entry.corpusType === 'nihai_entry' &&
          entriesLines &&
          typeof q.sourceLineNumber === 'number'
        ) {
          const lineRaw = entriesLines[q.sourceLineNumber - 1];
          if (!lineRaw) {
            errors.push(`[${entry.id}] Không tìm thấy dòng ${q.sourceLineNumber} trong entries.jsonl.`);
          } else {
            try {
              const row = JSON.parse(lineRaw) as { quote?: string };
              if (row.quote !== q.quoteCn) {
                errors.push(
                  `[${entry.id}] quoteCn tại dòng ${q.sourceLineNumber} không khớp nguyên văn entries.jsonl.`,
                );
              }
            } catch {
              errors.push(`[${entry.id}] Lỗi đọc JSON tại dòng ${q.sourceLineNumber} entries.jsonl.`);
            }
          }
        }
      }
    }
  }

  if (entries.length === 0) {
    errors.push('Kho .kb.json đang trống (0 mục).');
  } else if (realEntries === 0 && sampleEntries > 0) {
    warnings.push(
      `Hiện tại kho chỉ chứa ${sampleEntries} bản ghi MẪU KHỞI TẠO FRAMEWORK (sample: true). Cần chạy ngoại tuyến npm run kb:distill khi nạp /knowledge-source/ để thay bằng ~162 bản ghi thật của Pilot 1A.`,
    );
    if (options?.requireReal) {
      errors.push('Cờ --require-real được bật nhưng chưa có bản ghi chưng cất thật nào.');
    }
  }

  return {
    passed: errors.length === 0,
    dataDir: options?.dataDir ?? DEFAULT_KB_DATA_DIR,
    filesLoaded: options?.filesLoaded ?? [],
    totalEntries: entries.length,
    sampleEntries,
    realEntries,
    errors,
    warnings,
  };
}

export function auditKnowledgeBaseData(options?: {
  dataDir?: string;
  sourceDir?: string;
  requireReal?: boolean;
}): KbAuditReport {
  const snapshot = loadKnowledgeBase(options?.dataDir ?? DEFAULT_KB_DATA_DIR);
  return auditKnowledgeBaseEntries(snapshot.entries, {
    dataDir: snapshot.dataDir,
    filesLoaded: snapshot.filesLoaded,
    sourceDir: options?.sourceDir,
    requireReal: options?.requireReal,
  });
}

function main() {
  const args = process.argv.slice(2);
  const requireReal = args.includes('--require-real');
  const report = auditKnowledgeBaseData({ requireReal });

  console.log(
    `[kb:audit] Đã kiểm tra ${report.totalEntries} mục (${report.realEntries} thật / ${report.sampleEntries} mẫu) từ ${report.filesLoaded.join(', ') || '(không có file)'}`,
  );
  for (const w of report.warnings) {
    console.warn(`[kb:audit] CẢNH BÁO: ${w}`);
  }
  if (!report.passed) {
    console.error('[kb:audit] THẤT BẠI:');
    for (const e of report.errors) {
      console.error(`  - ${e}`);
    }
    process.exit(1);
  }
  console.log('[kb:audit] ĐẠT 100% kiểm tra schema, từ điển vi-i18n.ts và chuẩn không chữ Hán.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
