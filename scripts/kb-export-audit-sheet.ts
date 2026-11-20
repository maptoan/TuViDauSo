import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { loadKnowledgeBase, DEFAULT_KB_DATA_DIR } from '../server/knowledge-base/loader.ts';
import type { DistilledKnowledgeEntry } from '../server/knowledge-base/types.ts';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deterministicShuffle<T>(items: readonly T[], seedNum: number): T[] {
  const arr = [...items];
  const rand = mulberry32(seedNum);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function selectStratifiedAuditSample(
  entries: readonly DistilledKnowledgeEntry[],
  seed = 20261119,
): DistilledKnowledgeEntry[] {
  const stars = entries.filter((e) => e.category === '01-stars');
  const sihua = entries.filter((e) => e.category === '04-sihua');
  const classics = entries.filter((e) => e.category === 'classics-fu');

  const pickedStars = deterministicShuffle(stars, seed + 1).slice(0, 10);
  const pickedSihua = deterministicShuffle(sihua, seed + 2).slice(0, 10);
  const pickedClassics = deterministicShuffle(classics, seed + 3).slice(0, 5);

  return [...pickedStars, ...pickedSihua, ...pickedClassics];
}

export function renderPilotAuditSheetMarkdown(
  sampledEntries: readonly DistilledKnowledgeEntry[],
  totalEntriesCount: number,
): string {
  const sampleModeCount = sampledEntries.filter((e) => e.qaMeta?.sample).length;
  const isFullPilotCorpus = totalEntriesCount >= 100 && sampleModeCount === 0;

  const lines: string[] = [
    '# PHIẾU KIỂM ĐỊNH CHẤT LƯỢNG MẪU — ĐỢT PILOT 1A (`docs/kb-pilot-audit-sheet.md`)',
    '',
    `- **Ngày xuất phiếu**: \`${new Date().toISOString()}\``,
    `- **Trạng thái kho dữ liệu tại thời điểm xuất**: ${isFullPilotCorpus ? `Kho Pilot 1A đầy đủ (${totalEntriesCount} mục thật)` : `Kho mẫu khởi tạo framework (${totalEntriesCount} mục, gồm ${sampleModeCount} mục mẫu \`sample: true\`) — chạy lại lệnh này sau khi hoàn tất \`npm run kb:distill\` để lấy đủ 25/162 mục thật`}`,
    `- **Số mục trên phiếu**: **${sampledEntries.length} mục** (Mục tiêu phân tầng Pilot 1A: 10 \`01-stars\` + 10 \`04-sihua\` + 5 \`classics-fu\`)`,
    '- **Cổng nghiệm thu (`ĐN-10`)**: Chấm ĐẠT tối thiểu **24/25 (`96%+`)** ngay lần đầu và **0 lỗi nghiêm trọng** (0 lỗi đảo ngược cát/hung, 0 lỗi gán sai sao/cung); chỉnh sửa mọi lỗi về **25/25 (100%)** trước khi ký duyệt sang Đợt 1B.',
    '',
    '---',
    '',
    '| STT | Mã thẻ (`citationId`) | Quyển | Nguồn video (`bvid · t_hms`) | Kết quả chấm | Ghi chú lỗi (nếu có) |',
    '|:---:|---|---|---|---|---|',
  ];

  sampledEntries.forEach((entry, idx) => {
    const srcMeta =
      entry.sourceRef.bvids.length > 0
        ? `${entry.sourceRef.bvids[0]} · ${entry.sourceRef.timeRangeHms ?? 'N/A'}`
        : `Cổ thư · Dòng ${(entry.sourceRef.sourceLineNumbers ?? []).join(',')}`;
    lines.push(
      `| ${idx + 1} | \`${entry.id}\` | \`${entry.category}\` | ${srcMeta} | [ ] ĐẠT / [ ] KHÔNG ĐẠT | |`,
    );
  });

  lines.push('', '---', '', '## Chi Tiết Đối Chiếu Từng Mục (Dùng với Google NotebookLM)');

  sampledEntries.forEach((entry, idx) => {
    const quotesFormatted = entry.hanziAnchor.quotes
      .map(
        (q, qIdx) =>
          `  - Quote ${qIdx + 1} (${q.t_hms ?? 'N/A'} · dòng ${q.sourceLineNumber ?? '?'}): \`${q.quoteCn}\``,
      )
      .join('\n');

    lines.push(
      '',
      `### ${idx + 1}. \`[${entry.id}]\` — ${entry.sourceRef.groupTitleVi}${entry.qaMeta?.sample ? ' *(MẪU KHỞI TẠO)*' : ''}`,
      `- **Tài liệu**: ${entry.sourceRef.workTitleVi} (${entry.sourceRef.sourceLicense})`,
      `- **Khóa truy hồi**: Sao: \`${entry.retrievalKeys.starsVi.join(', ') || '—'}\` | Cung: \`${entry.retrievalKeys.palacesVi.join(', ') || '—'}\` | Tứ Hóa: \`${entry.retrievalKeys.sihuaCombos.map((c) => `${c.starVi ? `${c.starVi} ` : ''}${c.mutagenVi}`).join(', ') || '—'}\``,
      `- **Tóm lược nạp prompt (\`summaryVi\` — ${entry.summaryVi.length} ký tự)**:`,
      `  > ${entry.summaryVi}`,
      `- **Điều kiện cách cục (\`conditionsVi\`)**:`,
      `  > ${entry.conditionsVi || '(Không có điều kiện riêng)'}`,
      `- **Nguyên văn Hán neo kiểm chứng (\`hanziAnchor\`)**:`,
      quotesFormatted,
      `- **Câu hỏi kiểm định gợi ý cho NotebookLM**: *"Trong bài giảng ${entry.sourceRef.groupKey.h2Cn} / ${entry.sourceRef.groupKey.h3Cn} (video ${entry.sourceRef.bvids[0] ?? 'cổ thư'}, mốc ${entry.sourceRef.timeRangeHms ?? 'tương ứng'}), Nghê Hải Hạ hoặc nguyên văn cổ thư luận về tính chất cát/hung và điều kiện hội sao ra sao? Bản tóm lược trên có đảo ngược cát/hung hay sai sao/cung không?"*`,
    );
  });

  lines.push('');
  return lines.join('\n');
}

export function exportPilotAuditSheet(options?: {
  dataDir?: string;
  outFile?: string;
  seed?: number;
}): { outFile: string; sampledCount: number; totalEntries: number } {
  const snapshot = loadKnowledgeBase(options?.dataDir ?? DEFAULT_KB_DATA_DIR);
  const sampled = selectStratifiedAuditSample(snapshot.entries, options?.seed ?? 20261119);
  const outFile = path.resolve(
    options?.outFile ?? path.resolve(process.cwd(), 'docs/kb-pilot-audit-sheet.md'),
  );
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const md = renderPilotAuditSheetMarkdown(sampled, snapshot.totalEntries);
  fs.writeFileSync(outFile, md, 'utf8');
  return {
    outFile,
    sampledCount: sampled.length,
    totalEntries: snapshot.totalEntries,
  };
}

function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const outFile =
    outIdx >= 0 && args[outIdx + 1]
      ? args[outIdx + 1]
      : path.resolve(process.cwd(), 'docs/kb-pilot-audit-sheet.md');

  const res = exportPilotAuditSheet({ outFile });
  console.log(
    `[kb:export-audit-sheet] Đã xuất phiếu kiểm định ${res.sampledCount} mục (trên tổng ${res.totalEntries} mục) tại: ${res.outFile}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
