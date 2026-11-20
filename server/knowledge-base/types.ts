export type KnowledgeCorpusType =
  | 'nihai_entry'
  | 'nihai_lecture'
  | 'classic_verse';

export type KnowledgeScopeTier = 'tier1_core' | 'tier2_extended';

export type KnowledgeCategory =
  | '01-stars'
  | '02-palaces'
  | '03-patterns'
  | '04-sihua'
  | '05-illness'
  | '07-methodology'
  | 'classics-fu';

export type KnowledgeSourceLicense =
  | 'CC-BY-NC-SA-4.0'
  | 'PUBLIC_DOMAIN_TEXT_WITH_CC_BY_NC_SA_ADAPTATION';

export type KnowledgeDossierTargetSection =
  | 'chapter_overview'
  | 'palaces_core'
  | 'palaces_family'
  | 'palaces_social_health'
  | 'year_2026'
  | 'year_2027'
  | 'horizon_5y'
  | 'horizon_10y';

export type KnowledgeSiHuaMutagenVi =
  | 'Hóa Lộc'
  | 'Hóa Quyền'
  | 'Hóa Khoa'
  | 'Hóa Kỵ';

export interface KnowledgeAnchorQuoteItem {
  /** Nguyên văn câu quote chữ Hán trong entries.jsonl hoặc câu phú cổ thư */
  quoteCn: string;
  /** Ghi chú nguyên bản đi kèm trong entries.jsonl (nếu có) */
  noteCn?: string;
  /** Mốc thời gian video gốc (trường t_hms trong entries.jsonl): VD "00:14:25" */
  t_hms?: string;
  /** Mã video Bilibili (trường bvid trong entries.jsonl) */
  bvid?: string;
  /** Số thứ tự phần (trường part trong entries.jsonl) */
  part?: number;
  /** Tiểu mục con (trường section trong entries.jsonl) */
  sectionCn?: string;
  /** Chỉ số dòng gốc 1-based trong entries.jsonl (nếu có) */
  sourceLineNumber?: number;
}

export interface KnowledgeSourceRef {
  /**
   * Mã thẻ nguồn cấp nhóm ngắn gọn, tất định:
   * - 01-stars (83 nhóm): "NH-STAR-001" .. "NH-STAR-083"
   * - 04-sihua (19 nhóm): "NH-SIHUA-001" .. "NH-SIHUA-019"
   * - 02-palaces (~52 tiểu mục): "NH-PAL-001" .. "NH-PAL-052"
   * - 03-patterns (20 nhóm): "NH-PAT-001" .. "NH-PAT-020"
   * - 05-illness (21 nhóm): "NH-ILL-001" .. "NH-ILL-021"
   * - 07-methodology (41 nhóm): "NH-METH-001" .. "NH-METH-041"
   * - Cổ thư (~60 mục): "CL-CTP-001".., "CL-TVP-001".., "CL-TT-001"..
   */
  citationId: string;
  tradition: 'ni_haixia_tianji' | 'ziwei_classics';
  sourceLicense: KnowledgeSourceLicense;
  groupKey: {
    book: string;
    h2Cn: string;
    h3Cn: string;
    subGroupKey?: string;
  };
  /** Tên tài liệu / quyển tiếng Việt */
  workTitleVi: string;
  /** Tiêu đề nhóm đã dịch chuẩn Hán-Việt */
  groupTitleVi: string;
  /** Danh sách mã bvid & khoảng thời gian t_hms đại diện của nhóm */
  bvids: string[];
  timeRangeHms?: string;
  /** Đường dẫn file gốc và danh sách chỉ số dòng (1-based) */
  sourceFilePath: string;
  sourceLineNumbers: number[];
}

export interface KnowledgeRetrievalKeys {
  starsVi: string[];
  palacesVi: string[];
  branchesVi: string[];
  patternsVi: string[];
  sihuaCombos: Array<{
    starVi?: string;
    mutagenVi: KnowledgeSiHuaMutagenVi;
  }>;
  topicTags: string[];
  targetDossierSections: KnowledgeDossierTargetSection[];
}

export interface KnowledgeQaMeta {
  distilledAtIso: string;
  modelUsed: string;
  sourceHash: string;
  glossaryCheckPassed: boolean;
  auditSampleChecked?: boolean;
  /** Đánh dấu rõ dữ liệu mẫu khởi tạo framework khi kho chưng cất thật chưa được nạp */
  sample?: boolean;
  candidateModelsProbed?: string[];
}

export interface DistilledKnowledgeEntry {
  /** Khóa chính định danh: trùng với sourceRef.citationId (VD: "NH-STAR-001") */
  id: string;
  corpusType: KnowledgeCorpusType;
  scopeTier: KnowledgeScopeTier;
  category: KnowledgeCategory;
  sourceRef: KnowledgeSourceRef;
  retrievalKeys: KnowledgeRetrievalKeys;
  /** Luận điểm học thuật tóm lược tiếng Việt mạch lạc (120–350 ký tự) dùng nạp prompt */
  summaryVi: string;
  /** Bản dịch tiếng Việt sát nghĩa toàn bộ các câu quote trong nhóm hoặc câu phú cổ thư */
  fullTranslationVi: string;
  /** Điều kiện thành cách / phá cách / ngoại lệ Tam Phương Tứ Chính */
  conditionsVi?: string;
  /** Neo nguyên văn chữ Hán (KHÔNG gửi vào prompt AI runtime) */
  hanziAnchor: {
    quotes: KnowledgeAnchorQuoteItem[];
    combinedQuotesCn: string;
  };
  /** Độ ưu tiên học thuật (1 = cốt lõi, 2 = tổ hợp, 3 = tình huống) */
  priorityTier: 1 | 2 | 3;
  qaMeta: KnowledgeQaMeta;
}

export interface KnowledgeFileEnvelope {
  schemaVersion: string;
  generatedAtIso: string;
  category: KnowledgeCategory;
  sourceLicense: KnowledgeSourceLicense;
  isSampleData?: boolean;
  entries: DistilledKnowledgeEntry[];
}

export interface KnowledgeInvertedIndices {
  byId: Map<string, DistilledKnowledgeEntry>;
  byStarVi: Map<string, Set<string>>;
  byPalaceVi: Map<string, Set<string>>;
  byBranchVi: Map<string, Set<string>>;
  byPatternVi: Map<string, Set<string>>;
  bySiHuaCombo: Map<string, Set<string>>;
  byDossierSection: Map<string, Set<string>>;
  byTopicTag: Map<string, Set<string>>;
}

export interface KnowledgeBaseSnapshot {
  loaded: boolean;
  loadedAtIso: string | null;
  dataDir: string;
  filesLoaded: string[];
  totalEntries: number;
  sampleEntries: number;
  realEntries: number;
  entries: DistilledKnowledgeEntry[];
  indices: KnowledgeInvertedIndices;
}

export interface KnowledgeScoredEntry {
  entry: DistilledKnowledgeEntry;
  score: number;
  matchedReasons: string[];
  matchedPalaceVi?: string;
}

export type KnowledgeCoverageStatus =
  | 'covered'
  | 'partial'
  | 'uncovered'
  | 'absent_star'
  | 'out_of_scope'
  | 'empty_kb';

export interface KnowledgeRetrievalResult {
  flow: 'dossier' | 'period' | 'chat';
  entries: DistilledKnowledgeEntry[];
  scoredEntries: KnowledgeScoredEntry[];
  promptBlockMarkdown: string;
  charCount: number;
  maxEntries: number;
  maxChars: number;
  coverageStatus: KnowledgeCoverageStatus;
  hasCoverageGap: boolean;
  coverageBoundaryNoteVi: string;
  /** Cờ chỉ bật khi sao được hỏi vắng mặt ở cả bản cung, sao mượn lẫn Tam Phương Tứ Chính (ĐN-8) */
  starAbsentInQueriedPalace: boolean;
  absentStarDetail?: {
    starVi: string;
    palaceVi: string;
  };
  starPresenceMode?: 'present_in_palace' | 'present_in_sanfang_or_borrowed' | 'absent';
  sanFangNoteVi?: string;
  outOfScopeTopicVi?: string;
  matchedEntities: {
    starsVi: string[];
    palacesVi: string[];
    branchesVi: string[];
    patternsVi: string[];
    sihuaCombos: Array<{ starVi?: string; mutagenVi: KnowledgeSiHuaMutagenVi }>;
    topicTags: string[];
  };
}

export interface CitationViolation {
  rule: 'V1' | 'V2' | 'V3';
  citationId?: string;
  blockIndex: number;
  blockExcerpt: string;
  reasonVi: string;
}

export interface CitationAuditResult {
  validCitationIds: string[];
  usedValidEntries: DistilledKnowledgeEntry[];
  v1InvalidIds: string[];
  v2UncitedBlocks: number[];
  v3MismatchIds: string[];
  scrubbedInvalidIds: string[];
  hasUncitedClaims: boolean;
  violations: CitationViolation[];
  scrubbedText: string;
  referenceBlockMarkdown: string;
  warningBlockMarkdown: string;
  chatFooterMarkdown: string;
}
