import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  CN_TO_VI_BRANCH,
  CN_TO_VI_BRIGHTNESS,
  CN_TO_VI_PALACE,
  CN_TO_VI_SIHUA,
  CN_TO_VI_STAR,
  CN_TO_VI_STEM,
  CN_TO_VI_WUXING_JU,
  PATTERN_NAME_VI,
} from '../src/lib/ziwei/vi-i18n.ts';
import type {
  DistilledKnowledgeEntry,
  KnowledgeCategory,
  KnowledgeDossierTargetSection,
  KnowledgeFileEnvelope,
  KnowledgeSiHuaMutagenVi,
} from '../server/knowledge-base/types.ts';
import {
  extractClassicsVerses,
  groupEntriesJsonl,
  loadSourceMaterialsForGrouping,
  type GroupedDistillationUnit,
} from './kb-group-entries.ts';

const BATCH_SIZE = 3;
const CHECKPOINT_PATH = path.resolve(
  process.cwd(),
  'server/knowledge-base/checkpoints/distill-progress.jsonl',
);
const KB_DATA_DIR = path.resolve(process.cwd(), 'server/knowledge-base/data');

const DEFAULT_CANDIDATE_MODELS = [
  'gemini-2.5-pro',
  'gemini-3.8-flash',
  'gemini-4-hydrogen',
  'gemini-4-neon',
];

const CANONICAL_STARS_SET = new Set(Object.values(CN_TO_VI_STAR));
const CANONICAL_PALACES_SET = new Set(Object.values(CN_TO_VI_PALACE));
const CANONICAL_PATTERNS_SET = new Set(Object.values(PATTERN_NAME_VI));
const CANONICAL_MUTAGENS: readonly KnowledgeSiHuaMutagenVi[] = [
  'Hóa Lộc',
  'Hóa Quyền',
  'Hóa Khoa',
  'Hóa Kỵ',
];

interface DistillModelItemOutput {
  id: string;
  workTitleVi: string;
  groupTitleVi: string;
  summaryVi: string;
  fullTranslationVi: string;
  conditionsVi?: string;
  priorityTier: 1 | 2 | 3;
  retrievalKeys: {
    starsVi: string[];
    palacesVi: string[];
    branchesVi: string[];
    patternsVi: string[];
    sihuaCombos: Array<{ starVi?: string; mutagenVi: string }>;
    topicTags: string[];
    targetDossierSections: string[];
  };
}

export function extractMandatoryGlossaryForText(hanziText: string): string {
  const dicts: Array<[string, Record<string, string>]> = [
    ['Sao (vi-i18n.ts)', CN_TO_VI_STAR],
    ['Cung (vi-i18n.ts)', CN_TO_VI_PALACE],
    ['Tứ Hóa', CN_TO_VI_SIHUA],
    ['Độ sáng', CN_TO_VI_BRIGHTNESS],
    ['Ngũ Hành Cục', CN_TO_VI_WUXING_JU],
    ['Cách cục', PATTERN_NAME_VI],
    ['Thiên Can', CN_TO_VI_STEM],
    ['Địa Chi', CN_TO_VI_BRANCH],
  ];

  const lines: string[] = [];
  for (const [label, table] of dicts) {
    const matched = Object.entries(table)
      .filter(([cn]) => hanziText.includes(cn))
      .map(([cn, vi]) => `${cn} → ${vi}`);
    if (matched.length > 0) {
      lines.push(`- ${label}: ${matched.join('; ')}`);
    }
  }
  return lines.join('\n');
}

export function buildDistillationPrompt(batch: readonly GroupedDistillationUnit[]): string {
  const combinedSource = batch
    .map(
      (u) =>
        `${u.groupKey.h2Cn} ${u.groupKey.h3Cn}\n${u.combinedQuotesCn}\n${u.notesCn.join('\n')}\n${u.supportingLectureWindow ?? ''}`,
    )
    .join('\n');

  const glossaryBlock = extractMandatoryGlossaryForText(combinedSource);

  const itemsText = batch
    .map((u, idx) => {
      const quotesText = u.quotes
        .map(
          (q, qIdx) =>
            `  ${qIdx + 1}. [${q.t_hms ?? 'N/A'} · ${q.bvid ?? 'classic'}] "${q.quoteCn}"${q.noteCn ? ` (Ghi chú: ${q.noteCn})` : ''}`,
        )
        .join('\n');
      return `=== NHÓM ${idx + 1}: ID = ${u.citationId} ===
- Loại: ${u.corpusType} | Quyển: ${u.category}
- Tiêu đề gốc: ${u.groupKey.h2Cn} / ${u.groupKey.h3Cn}${u.groupKey.subGroupKey ? ` (${u.groupKey.subGroupKey})` : ''}
- Các câu nguồn Hán ngữ bắt buộc dịch sát:
${quotesText}
${u.supportingLectureWindow ? `- Ngữ cảnh bài giảng Thiên Kỷ bổ trợ (±550 ký tự quanh mốc thời gian):\n  """\n  ${u.supportingLectureWindow}\n  """` : ''}`;
    })
    .join('\n\n');

  return `Bạn là chuyên gia dịch thuật và chưng cất học thuật Tử Vi Đẩu Số (hệ thống Thiên Kỷ của Nghê Hải Hạ và cổ thư Tử Vi).
Hãy chưng cất và dịch ${batch.length} nhóm tri thức dưới đây thành JSON chuẩn tiếng Việt:

[TỪ ĐIỂN THUẬT NGỮ BẮT BUỘC — KHÓA CỨNG THEO src/lib/ziwei/vi-i18n.ts]:
${glossaryBlock || '(Áp dụng đúng thuật ngữ Hán-Việt chuẩn Tử Vi Đẩu Số)'}

[QUY TẮC BẮT BUỘC 100%]:
1. KHÔNG để sót bất kỳ 1 ký tự chữ Hán nào trong toàn bộ các trường tiếng Việt (workTitleVi, groupTitleVi, summaryVi, fullTranslationVi, conditionsVi).
2. Độ dài summaryVi BẮT BUỘC nằm trong khoảng 120–350 ký tự tiếng Việt cô đọng, nêu trúng bản chất cát/hung và điểm cốt lõi để bơm vào prompt AI.
3. fullTranslationVi phải dịch sát và đầy đủ ý của TẤT CẢ các câu nguồn trong nhóm; tuyệt đối không thêm thắt kiến thức ngoài đoạn trích.
4. retrievalKeys chỉ dùng đúng tên chuẩn từ vi-i18n.ts (VD: starsVi: ["Tử Vi"], palacesVi: ["Mệnh Cung", "Tử Nữ", "Giao Hữu"], sihuaCombos mutagenVi thuộc ["Hóa Lộc", "Hóa Quyền", "Hóa Khoa", "Hóa Kỵ"]).
5. targetDossierSections chỉ lấy từ: ["chapter_overview", "palaces_core", "palaces_family", "palaces_social_health", "year_2026", "year_2027", "horizon_5y", "horizon_10y"].

${itemsText}`;
}

const DISTILL_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          workTitleVi: { type: Type.STRING },
          groupTitleVi: { type: Type.STRING },
          summaryVi: { type: Type.STRING },
          fullTranslationVi: { type: Type.STRING },
          conditionsVi: { type: Type.STRING },
          priorityTier: { type: Type.INTEGER },
          retrievalKeys: {
            type: Type.OBJECT,
            properties: {
              starsVi: { type: Type.ARRAY, items: { type: Type.STRING } },
              palacesVi: { type: Type.ARRAY, items: { type: Type.STRING } },
              branchesVi: { type: Type.ARRAY, items: { type: Type.STRING } },
              patternsVi: { type: Type.ARRAY, items: { type: Type.STRING } },
              sihuaCombos: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    starVi: { type: Type.STRING },
                    mutagenVi: { type: Type.STRING },
                  },
                  required: ['mutagenVi'],
                },
              },
              topicTags: { type: Type.ARRAY, items: { type: Type.STRING } },
              targetDossierSections: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: [
              'starsVi',
              'palacesVi',
              'branchesVi',
              'patternsVi',
              'sihuaCombos',
              'topicTags',
              'targetDossierSections',
            ],
          },
        },
        required: [
          'id',
          'workTitleVi',
          'groupTitleVi',
          'summaryVi',
          'fullTranslationVi',
          'priorityTier',
          'retrievalKeys',
        ],
      },
    },
  },
  required: ['items'],
};

function hasHanzi(text?: string): boolean {
  return Boolean(text && /\p{Script=Han}/u.test(text));
}

function validateAndBuildDistilledEntry(
  unit: GroupedDistillationUnit,
  raw: DistillModelItemOutput,
  modelUsed: string,
  candidateModelsProbed: string[],
): { ok: true; entry: DistilledKnowledgeEntry } | { ok: false; reasons: string[] } {
  const reasons: string[] = [];

  for (const [field, val] of [
    ['workTitleVi', raw.workTitleVi],
    ['groupTitleVi', raw.groupTitleVi],
    ['summaryVi', raw.summaryVi],
    ['fullTranslationVi', raw.fullTranslationVi],
    ['conditionsVi', raw.conditionsVi],
  ] as const) {
    if (hasHanzi(val)) {
      reasons.push(`${field} còn sót chữ Hán.`);
    }
  }

  const summary = (raw.summaryVi || '').trim();
  if (summary.length < 120 || summary.length > 350) {
    reasons.push(`summaryVi dài ${summary.length} ký tự (yêu cầu 120–350).`);
  }

  const starsVi = (raw.retrievalKeys.starsVi ?? []).filter((s) => CANONICAL_STARS_SET.has(s));
  const palacesVi = (raw.retrievalKeys.palacesVi ?? []).filter((p) =>
    CANONICAL_PALACES_SET.has(p),
  );
  const patternsVi = (raw.retrievalKeys.patternsVi ?? []).filter((p) =>
    CANONICAL_PATTERNS_SET.has(p),
  );
  const sihuaCombos = (raw.retrievalKeys.sihuaCombos ?? [])
    .filter((c): c is { starVi?: string; mutagenVi: KnowledgeSiHuaMutagenVi } =>
      CANONICAL_MUTAGENS.includes(c.mutagenVi as KnowledgeSiHuaMutagenVi),
    )
    .map((c) => ({
      ...(c.starVi && CANONICAL_STARS_SET.has(c.starVi) ? { starVi: c.starVi } : {}),
      mutagenVi: c.mutagenVi,
    }));

  const validSections = new Set<KnowledgeDossierTargetSection>([
    'chapter_overview',
    'palaces_core',
    'palaces_family',
    'palaces_social_health',
    'year_2026',
    'year_2027',
    'horizon_5y',
    'horizon_10y',
  ]);

  const targetDossierSections = (raw.retrievalKeys.targetDossierSections ?? []).filter(
    (s): s is KnowledgeDossierTargetSection =>
      validSections.has(s as KnowledgeDossierTargetSection),
  );

  if (reasons.length > 0) {
    return { ok: false, reasons };
  }

  const tier: 1 | 2 | 3 =
    raw.priorityTier === 1 || raw.priorityTier === 2 || raw.priorityTier === 3
      ? raw.priorityTier
      : 1;

  const entry: DistilledKnowledgeEntry = {
    id: unit.citationId,
    corpusType: unit.corpusType,
    scopeTier: unit.scopeTier,
    category: unit.category,
    sourceRef: {
      citationId: unit.citationId,
      tradition: unit.corpusType === 'classic_verse' ? 'ziwei_classics' : 'ni_haixia_tianji',
      sourceLicense: unit.sourceLicense,
      groupKey: unit.groupKey,
      workTitleVi: raw.workTitleVi.trim(),
      groupTitleVi: raw.groupTitleVi.trim(),
      bvids: unit.bvids,
      ...(unit.timeRangeHms ? { timeRangeHms: unit.timeRangeHms } : {}),
      sourceFilePath: unit.sourceFilePath,
      sourceLineNumbers: unit.sourceLineNumbers,
    },
    retrievalKeys: {
      starsVi,
      palacesVi,
      branchesVi: raw.retrievalKeys.branchesVi ?? [],
      patternsVi,
      sihuaCombos,
      topicTags: raw.retrievalKeys.topicTags ?? [],
      targetDossierSections,
    },
    summaryVi: summary,
    fullTranslationVi: raw.fullTranslationVi.trim(),
    ...(raw.conditionsVi && raw.conditionsVi.trim()
      ? { conditionsVi: raw.conditionsVi.trim() }
      : {}),
    hanziAnchor: {
      quotes: unit.quotes,
      combinedQuotesCn: unit.combinedQuotesCn,
    },
    priorityTier: tier,
    qaMeta: {
      distilledAtIso: new Date().toISOString(),
      modelUsed,
      sourceHash: unit.sourceHash,
      glossaryCheckPassed: true,
      auditSampleChecked: false,
      sample: false,
      candidateModelsProbed,
    },
  };

  return { ok: true, entry };
}

function readCheckpoints(): Map<string, DistilledKnowledgeEntry> {
  const map = new Map<string, DistilledKnowledgeEntry>();
  if (!fs.existsSync(CHECKPOINT_PATH)) return map;
  const lines = fs.readFileSync(CHECKPOINT_PATH, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as DistilledKnowledgeEntry;
      if (parsed.id && parsed.qaMeta?.sourceHash) {
        map.set(`${parsed.id}::${parsed.qaMeta.sourceHash}`, parsed);
      }
    } catch {
      // skip corrupt checkpoint line
    }
  }
  return map;
}

function appendCheckpoint(entry: DistilledKnowledgeEntry) {
  fs.mkdirSync(path.dirname(CHECKPOINT_PATH), { recursive: true });
  fs.appendFileSync(CHECKPOINT_PATH, `${JSON.stringify(entry)}\n`, 'utf8');
}

async function probeCandidateModels(
  ai: GoogleGenAI,
  candidates: readonly string[],
): Promise<{ selectedModel: string; probed: string[] }> {
  const probed: string[] = [];
  for (const model of candidates) {
    probed.push(model);
    try {
      const resp = await ai.models.generateContent({
        model,
        contents: 'Trả lời đúng 1 chữ: OK',
      });
      if (resp.text && resp.text.trim().length > 0) {
        return { selectedModel: model, probed };
      }
    } catch (err) {
      console.warn(
        `[kb:distill] Model ứng viên ${model} không khả dụng trên key hiện tại: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  throw new Error(
    `Không tìm thấy model khả dụng trong danh sách đã dò: ${probed.join(', ')}`,
  );
}

function writeCategoryKbFile(
  fileName: string,
  category: KnowledgeCategory,
  entries: DistilledKnowledgeEntry[],
) {
  fs.mkdirSync(KB_DATA_DIR, { recursive: true });
  const sorted = [...entries].sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const envelope: KnowledgeFileEnvelope = {
    schemaVersion: '1.4.0',
    generatedAtIso: new Date().toISOString(),
    category,
    sourceLicense:
      category === 'classics-fu'
        ? 'PUBLIC_DOMAIN_TEXT_WITH_CC_BY_NC_SA_ADAPTATION'
        : 'CC-BY-NC-SA-4.0',
    isSampleData: false,
    entries: sorted,
  };
  fs.writeFileSync(
    path.join(KB_DATA_DIR, fileName),
    `${JSON.stringify(envelope, null, 2)}\n`,
    'utf8',
  );
}

async function main() {
  // Khóa cứng theo quyết định ngừng dùng pipeline Gemini (19/11/2026): mọi lời gọi kb:distill
  // đều dừng ngay tại đây. Thân pipeline cũ giữ nguyên ở mainDisabled() chỉ để tham khảo,
  // tuyệt đối không được nối lại vào main() khi chưa có lệnh khôi phục rõ ràng.
  throw new Error(
    'kb:distill đã NGỪNG DÙNG từ 19/11/2026: dữ liệu Nền Tri Thức do quy trình chưng cất ' +
      'Muse hai lượt + kiểm toán NotebookLM + assembler tất định ở workspace ziwei-kb-distill sản xuất. ' +
      'Không chạy script này để nạp dữ liệu thật.',
  );
}

async function mainDisabled() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const loaded = loadSourceMaterialsForGrouping();

  if (!loaded.sourcePresent) {
    console.log(
      '[kb:distill] Chưa nạp kho nguồn (/knowledge-source/ chưa tồn tại). Khi có nguồn, hãy chạy lại lệnh này ngoại tuyến kèm KB_DISTILL_GEMINI_KEYS.',
    );
    return;
  }

  const pilotEntries = groupEntriesJsonl(loaded.rows, {
    books: ['01-stars', '04-sihua'],
    lectures: loaded.lectures,
  });
  const classicsEntries = extractClassicsVerses(loaded.classics);
  const allUnits = [...pilotEntries, ...classicsEntries];
  const checkpoints = readCheckpoints();
  const pendingUnits = allUnits.filter(
    (u) => !checkpoints.has(`${u.citationId}::${u.sourceHash}`),
  );

  console.log(
    `[kb:distill] Tổng đơn vị Pilot 1A: ${allUnits.length} | Đã checkpoint: ${allUnits.length - pendingUnits.length} | Cần chưng cất: ${pendingUnits.length} (~${Math.ceil(pendingUnits.length / BATCH_SIZE)} batch requests).`,
  );

  if (dryRun) {
    console.log('[kb:distill] Chế độ --dry-run hoàn tất (không gọi Gemini API).');
    return;
  }

  const rawKeys =
    process.env.KB_DISTILL_GEMINI_KEYS || process.env.KB_DISTILL_GEMINI_KEY || '';
  const keys = rawKeys
    .split(/[\s,;]+/)
    .map((k) => k.trim())
    .filter(Boolean);
  if (keys.length === 0) {
    console.error(
      '[kb:distill] Thiếu biến môi trường KB_DISTILL_GEMINI_KEYS (hoặc KB_DISTILL_GEMINI_KEY).',
    );
    process.exit(1);
  }

  const envModel = process.env.KB_DISTILL_MODEL?.trim();
  const candidates = envModel
    ? [envModel, ...DEFAULT_CANDIDATE_MODELS.filter((m) => m !== envModel)]
    : DEFAULT_CANDIDATE_MODELS;

  const ai = new GoogleGenAI({
    apiKey: keys[0],
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
  const { selectedModel, probed } = await probeCandidateModels(ai, candidates);
  console.log(`[kb:distill] Chốt model chưng cất ngoại tuyến: ${selectedModel} (đã dò: ${probed.join(' → ')})`);

  let keyIdx = 0;
  for (let i = 0; i < pendingUnits.length; i += BATCH_SIZE) {
    const batch = pendingUnits.slice(i, i + BATCH_SIZE);
    const activeKey = keys[keyIdx % keys.length];
    keyIdx += 1;

    const batchAi = new GoogleGenAI({
      apiKey: activeKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const prompt = buildDistillationPrompt(batch);
    const response = await batchAi.models.generateContent({
      model: selectedModel,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: DISTILL_RESPONSE_SCHEMA,
      },
    });

    const text = response.text ?? '';
    const parsed = JSON.parse(text) as { items?: DistillModelItemOutput[] };
    for (const unit of batch) {
      const item = parsed.items?.find((x) => x.id === unit.citationId);
      if (!item) {
        console.warn(`[kb:distill] Bỏ qua ${unit.citationId}: model không trả về đúng ID.`);
        continue;
      }
      const checked = validateAndBuildDistilledEntry(unit, item, selectedModel, probed);
      if (!checked.ok) {
        console.warn(
          `[kb:distill] Mục ${unit.citationId} không qua hậu kiểm từ điển (${checked.reasons.join('; ')})`,
        );
        continue;
      }
      checkpoints.set(`${unit.citationId}::${unit.sourceHash}`, checked.entry);
      appendCheckpoint(checked.entry);
    }
  }

  const completedAll = allUnits
    .map((u) => checkpoints.get(`${u.citationId}::${u.sourceHash}`))
    .filter((e): e is DistilledKnowledgeEntry => Boolean(e));

  writeCategoryKbFile(
    'stars.kb.json',
    '01-stars',
    completedAll.filter((e) => e.category === '01-stars'),
  );
  writeCategoryKbFile(
    'sihua.kb.json',
    '04-sihua',
    completedAll.filter((e) => e.category === '04-sihua'),
  );
  writeCategoryKbFile(
    'classics.kb.json',
    'classics-fu',
    completedAll.filter((e) => e.category === 'classics-fu'),
  );

  console.log(
    `[kb:distill] Hoàn tất ghi ${completedAll.length}/${allUnits.length} mục vào /server/knowledge-base/data/*.kb.json.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error('[kb:distill] Lỗi thực thi:', err);
    process.exit(1);
  });
}
