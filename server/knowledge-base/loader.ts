import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  DistilledKnowledgeEntry,
  KnowledgeBaseSnapshot,
  KnowledgeFileEnvelope,
  KnowledgeInvertedIndices,
} from './types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_KB_DATA_DIR = path.join(__dirname, 'data');

export function normalizeLookupKey(raw: string): string {
  return raw.normalize('NFC').trim().toLowerCase();
}

function addToIndexMap(
  map: Map<string, Set<string>>,
  rawKey: string | undefined,
  entryId: string,
) {
  if (!rawKey) return;
  const key = normalizeLookupKey(rawKey);
  if (!key) return;
  let set = map.get(key);
  if (!set) {
    set = new Set<string>();
    map.set(key, set);
  }
  set.add(entryId);
}

export function buildKnowledgeIndices(
  entries: readonly DistilledKnowledgeEntry[],
): KnowledgeInvertedIndices {
  const byId = new Map<string, DistilledKnowledgeEntry>();
  const byStarVi = new Map<string, Set<string>>();
  const byPalaceVi = new Map<string, Set<string>>();
  const byBranchVi = new Map<string, Set<string>>();
  const byPatternVi = new Map<string, Set<string>>();
  const bySiHuaCombo = new Map<string, Set<string>>();
  const byDossierSection = new Map<string, Set<string>>();
  const byTopicTag = new Map<string, Set<string>>();

  for (const entry of entries) {
    if (!entry || !entry.id || !entry.summaryVi) continue;
    byId.set(entry.id, entry);

    const keys = entry.retrievalKeys;
    if (!keys) continue;

    for (const s of keys.starsVi ?? []) {
      addToIndexMap(byStarVi, s, entry.id);
    }
    for (const p of keys.palacesVi ?? []) {
      addToIndexMap(byPalaceVi, p, entry.id);
    }
    for (const b of keys.branchesVi ?? []) {
      addToIndexMap(byBranchVi, b, entry.id);
    }
    for (const pat of keys.patternsVi ?? []) {
      addToIndexMap(byPatternVi, pat, entry.id);
    }
    for (const sh of keys.sihuaCombos ?? []) {
      if (sh.starVi) {
        addToIndexMap(bySiHuaCombo, `${sh.starVi}::${sh.mutagenVi}`, entry.id);
      }
      addToIndexMap(bySiHuaCombo, `*::${sh.mutagenVi}`, entry.id);
    }
    for (const sec of keys.targetDossierSections ?? []) {
      addToIndexMap(byDossierSection, sec, entry.id);
    }
    for (const tag of keys.topicTags ?? []) {
      addToIndexMap(byTopicTag, tag, entry.id);
    }
  }

  return {
    byId,
    byStarVi,
    byPalaceVi,
    byBranchVi,
    byPatternVi,
    bySiHuaCombo,
    byDossierSection,
    byTopicTag,
  };
}

function isValidEntryCandidate(item: unknown): item is DistilledKnowledgeEntry {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Partial<DistilledKnowledgeEntry>;
  return (
    typeof obj.id === 'string' &&
    obj.id.trim().length > 0 &&
    typeof obj.summaryVi === 'string' &&
    obj.summaryVi.trim().length > 0 &&
    Boolean(obj.sourceRef) &&
    typeof obj.sourceRef?.citationId === 'string' &&
    Boolean(obj.retrievalKeys) &&
    Boolean(obj.hanziAnchor) &&
    Array.isArray(obj.hanziAnchor?.quotes)
  );
}

function parseEntriesFromJsonPayload(parsed: unknown): DistilledKnowledgeEntry[] {
  if (Array.isArray(parsed)) {
    return parsed.filter(isValidEntryCandidate);
  }
  if (parsed && typeof parsed === 'object') {
    const env = parsed as Partial<KnowledgeFileEnvelope>;
    if (Array.isArray(env.entries)) {
      return env.entries.filter(isValidEntryCandidate);
    }
  }
  return [];
}

let cachedSnapshot: KnowledgeBaseSnapshot | null = null;

export function loadKnowledgeBase(dataDir = DEFAULT_KB_DATA_DIR): KnowledgeBaseSnapshot {
  const resolvedDir = path.resolve(dataDir);
  const filesLoaded: string[] = [];
  const entriesById = new Map<string, DistilledKnowledgeEntry>();

  try {
    if (fs.existsSync(resolvedDir) && fs.statSync(resolvedDir).isDirectory()) {
      const fileNames = fs
        .readdirSync(resolvedDir)
        .filter((f) => f.endsWith('.kb.json'))
        .sort((a, b) => a.localeCompare(b, 'en'));

      for (const fileName of fileNames) {
        const fullPath = path.join(resolvedDir, fileName);
        try {
          const raw = fs.readFileSync(fullPath, 'utf8');
          if (!raw.trim()) continue;
          const parsed = JSON.parse(raw);
          const fileEntries = parseEntriesFromJsonPayload(parsed);
          for (const entry of fileEntries) {
            entriesById.set(entry.id, entry);
          }
          filesLoaded.push(fileName);
        } catch (err) {
          console.warn(
            `[knowledge-base] Không thể đọc file ${fileName}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
  } catch (err) {
    console.warn(
      `[knowledge-base] Bỏ qua nạp thư mục dữ liệu (${resolvedDir}): ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const entries = Array.from(entriesById.values()).sort((a, b) =>
    a.id.localeCompare(b.id, 'en'),
  );
  const sampleEntries = entries.filter((e) => e.qaMeta?.sample === true).length;
  const realEntries = entries.length - sampleEntries;

  const snapshot: KnowledgeBaseSnapshot = {
    loaded: true,
    loadedAtIso: new Date().toISOString(),
    dataDir: resolvedDir,
    filesLoaded,
    totalEntries: entries.length,
    sampleEntries,
    realEntries,
    entries,
    indices: buildKnowledgeIndices(entries),
  };

  cachedSnapshot = snapshot;
  return snapshot;
}

export function getKnowledgeBaseSnapshot(): KnowledgeBaseSnapshot {
  if (!cachedSnapshot) {
    return loadKnowledgeBase(DEFAULT_KB_DATA_DIR);
  }
  return cachedSnapshot;
}

export function initKnowledgeBase(dataDir = DEFAULT_KB_DATA_DIR): KnowledgeBaseSnapshot {
  return loadKnowledgeBase(dataDir);
}

export function setKnowledgeBaseEntriesForTesting(
  entries: readonly DistilledKnowledgeEntry[],
  label = 'test-memory',
): KnowledgeBaseSnapshot {
  const deduped = Array.from(
    new Map(entries.map((e) => [e.id, e])).values(),
  ).sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const sampleEntries = deduped.filter((e) => e.qaMeta?.sample === true).length;
  const snapshot: KnowledgeBaseSnapshot = {
    loaded: true,
    loadedAtIso: new Date().toISOString(),
    dataDir: label,
    filesLoaded: [label],
    totalEntries: deduped.length,
    sampleEntries,
    realEntries: deduped.length - sampleEntries,
    entries: deduped,
    indices: buildKnowledgeIndices(deduped),
  };
  cachedSnapshot = snapshot;
  return snapshot;
}

export function resetKnowledgeBaseCache(): void {
  cachedSnapshot = null;
}
