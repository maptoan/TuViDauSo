export type KeyStatus = 'ready' | 'cooldown' | 'disabled';

export type KeyErrorCategory =
  | 'NONE'
  | 'RATE_LIMIT_RPM'
  | 'QUOTA_PROJECT_ZERO'
  | 'QUOTA_DAILY_EXHAUSTED'
  | 'AUTH_INVALID_KEY'
  | 'AUTH_FORBIDDEN_AMBIGUOUS'
  | 'AUTH_FORBIDDEN_REPEATED'
  | 'API_NOT_ENABLED'
  | 'TEST_TIMEOUT_INCONCLUSIVE'
  | 'NETWORK_OR_5XX'
  | 'MODEL_UNAVAILABLE'
  | 'UNKNOWN';

export interface EncryptedPayload {
  iv: string;
  authTag: string;
  ciphertext: string;
}

export interface GeminiKeyStats {
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  lastErrorType: KeyErrorCategory;
  lastErrorMessage: string | null;
  lastErrorAt: number | null;
  lastUsedAt: number | null;
  lastSuccessAt: number | null;
  avgLatencyMs: number | null;
  lastTestLatencyMs: number | null;
  lastTestedAt: number | null;
}

export interface GeminiKeyRecord {
  id: string;
  label: string;
  source: 'user_import' | 'env_secret';
  fingerprint: string;
  maskedKey: string;
  encryptedKey: EncryptedPayload;
  detectedProjectNumber: string | null;
  status: KeyStatus;
  pendingProbe: boolean;
  healthScore: number;
  lastScoreRecoveryAt: number;
  consecutiveErrors: number;
  consecutiveForbiddenErrors?: number;
  cooldownUntil: number | null;
  cooldownReason: KeyErrorCategory;
  modelCooldowns?: Record<string, number>;
  stats: GeminiKeyStats;
  createdAt: number;
  updatedAt: number;
}

export type ModelThinkingLevel =
  | 'THINKING_LEVEL_UNSPECIFIED'
  | 'MINIMAL'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'XHIGH';

export interface ModelProfileConfig {
  maxOutputTokens: number;
  thinkingLevel?: ModelThinkingLevel;
  estimatedOutputTokensForTpmGuard?: number;
  firstChunkTimeoutMs?: number;
}

export interface PoolModelConfig {
  defaultModel: string;
  fallbackModel: string;
  supportedModels: string[];
  profiles?: Record<string, ModelProfileConfig>;
}

export interface KeyPoolLogEntry {
  timestamp: number;
  keyId: string;
  maskedKey: string;
  fromStatus: KeyStatus;
  toStatus: KeyStatus;
  reason: string;
  cooldownSeconds?: number;
}

export interface KeyPoolState {
  version: number;
  modelConfig: PoolModelConfig;
  keys: GeminiKeyRecord[];
  recentLogs: KeyPoolLogEntry[];
  roundRobinCursor: number;
  disabledEnvFingerprints: string[];
}

export interface GeminiKeyPublicView {
  id: string;
  label: string;
  source: 'user_import' | 'env_secret';
  maskedKey: string;
  detectedProjectNumber: string | null;
  sameProjectKeyCount: number;
  status: KeyStatus;
  pendingProbe: boolean;
  healthScore: number;
  consecutiveErrors: number;
  cooldownUntil: number | null;
  remainingCooldownSec: number;
  cooldownReason: KeyErrorCategory;
  modelCooldowns?: Record<string, number>;
  stats: GeminiKeyStats;
  createdAt: number;
  updatedAt: number;
}

export interface KeyPoolPublicSnapshot {
  serverNow: number;
  isReadOnly: boolean;
  isSharedOrigin: boolean;
  adminPinRequired: boolean;
  hasAdminPinConfigured: boolean;
  envSecretPresent: boolean;
  envSecretActiveInPool: boolean;
  modelConfig: PoolModelConfig;
  summary: {
    total: number;
    ready: number;
    cooldown: number;
    disabled: number;
  };
  keys: GeminiKeyPublicView[];
  recentLogs: KeyPoolLogEntry[];
}

export type PreviewTokenStatus =
  | 'valid'
  | 'duplicate_in_batch'
  | 'duplicate_in_pool'
  | 'invalid_format';

export interface PreviewItem {
  maskedToken: string;
  status: PreviewTokenStatus;
  suggestedLabel?: string;
  reason?: string;
}

export interface PreviewSessionEntry {
  rawKey: string;
  fingerprint: string;
  maskedKey: string;
  label: string;
}

export interface PreviewResult {
  previewSessionId: string;
  expiresInSeconds: number;
  recognizedCount: number;
  duplicateCount: number;
  invalidCount: number;
  exceedsPoolLimit: boolean;
  message: string;
  items: PreviewItem[];
}

export interface KeyLease {
  keyId: string;
  maskedKey: string;
  label: string;
  rawKey: string;
  isProbe: boolean;
  detectedProjectNumber: string | null;
  heartbeat: () => void;
  release: () => void;
}

export interface StreamExecutionMeta {
  keyId: string;
  maskedKey: string;
  label: string;
  modelUsed: string;
  usedFallbackModel: boolean;
  failoverAttempts: number;
  latencyMs: number;
  continuedFromPartial?: boolean;
  continuationCount?: number;
  interrupted?: boolean;
  partialLength?: number;
  finishReason?: string;
  truncatedByMaxTokens?: boolean;
  fallbackLegUsed: boolean;
  fallbackLegLatencyMs?: number;
}

export interface StreamInterruptedEvent {
  reason: string;
  errorCategory: KeyErrorCategory;
  partialLength: number;
  minRemainingCooldownSec?: number | null;
}

export const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
export const FALLBACK_MODEL = 'gemma-4-31b-it';
export const DEFAULT_SUPPORTED_MODELS: string[] = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-4-hydrogen',
  'gemini-4-argon',
  'gemma-4-31b-it',
  'gemma-4-26b-a4b-it',
];

export const DEFAULT_MODEL_PROFILES: Record<string, ModelProfileConfig> = {
  'gemini-4-hydrogen': {
    maxOutputTokens: 32_768,
    thinkingLevel: 'LOW',
    firstChunkTimeoutMs: 30_000,
  },
  'gemma-4-31b-it': {
    maxOutputTokens: 32_768,
    thinkingLevel: 'MINIMAL',
    estimatedOutputTokensForTpmGuard: 3_000,
    firstChunkTimeoutMs: 60_000,
  },
  'gemma-4-26b-a4b-it': {
    maxOutputTokens: 32_768,
    thinkingLevel: 'MINIMAL',
    estimatedOutputTokensForTpmGuard: 3_000,
    firstChunkTimeoutMs: 60_000,
  },
};

/**
 * Cấu hình cổng TPM cho họ Gemma (ĐK-151-11, 12, 13):
 * - Trần free tier họ Gemma = 16.000 token/phút/project là ngân sách GỘP trượt theo phút.
 * - Cổng kiểm tra theo từng request chỉ là lớp bảo vệ chính chống vượt trần đơn lẻ,
 *   KHÔNG phải bảo đảm tuyệt đối khi nhiều lượt chạy dồn trong cùng 1 phút trên cùng project.
 * - Hệ số 2.4 ký tự/token hiệu chuẩn từ 6 luồng đo thật Pha 0 (sai lệch +1,6% đến +9,2%,
 *   luôn nghiêng về phía an toàn).
 */
export const GEMMA_TPM_GUARD_THRESHOLD = 15_000;
export const GEMMA_TPM_CHARS_PER_TOKEN_VI = 2.4;
export const GEMMA_TPM_DEFAULT_OUTPUT_ESTIMATE = 3_000;

export const MAX_RAW_INPUT_CHARS = 65_536;
export const MAX_KEYS_IN_POOL = 50;
export const MAX_KEY_ATTEMPTS = 5;
export const MAX_FALLBACK_KEY_ATTEMPTS = 5;
export const FIRST_CHUNK_TIMEOUT_MS = 12_000;
export const FIRST_CHUNK_TIMEOUT_MIN_MS = 5_000;
export const FIRST_CHUNK_TIMEOUT_MAX_MS = 120_000;
export const TOTAL_FAILOVER_TIME_BUDGET_MS = 35_000;
export const FALLBACK_LEG_TIME_BUDGET_MS = 150_000;
export const ABSOLUTE_REQUEST_BUDGET_MS = 200_000;
export const FALLBACK_COOLDOWN_WAIT_CAP_MS = 30_000;
export const SSE_KEEPALIVE_EARLY_TRIGGER_MS = 15_000;
export const TEST_KEY_TIMEOUT_MS = 20_000;
export const TEST_KEY_MAX_OUTPUT_TOKENS = 256;
export const TEST_KEY_DEBOUNCE_MS = 5_000;
export const LEASE_MAX_TTL_MS = 65_000;
export const LEASE_ABSOLUTE_MAX_TTL_MS = 210_000;
export const PREVIEW_SESSION_TTL_MS = 5 * 60_000;
export const MAX_PREVIEW_SESSIONS = 20;
export const MAX_RECENT_LOGS = 100;

export const KEY_POOL_BACKUP_FORMAT = 'ziwei-key-pool-backup';
export const KEY_POOL_BACKUP_SCHEMA_VERSION = 1;
export const KEY_POOL_BACKUP_KDF = 'PBKDF2-HMAC-SHA256';
export const KEY_POOL_BACKUP_CIPHER = 'AES-256-GCM';
export const KEY_POOL_BACKUP_PBKDF2_ITERATIONS = 210_000;
export const KEY_POOL_BACKUP_MAX_ITERATIONS = 2_000_000;
export const KEY_POOL_BACKUP_MIN_PASSPHRASE_LEN = 8;
export const KEY_POOL_BACKUP_MAX_BYTES = 256 * 1024;

export interface KeyPoolBackupHeader {
  format: typeof KEY_POOL_BACKUP_FORMAT;
  schemaVersion: typeof KEY_POOL_BACKUP_SCHEMA_VERSION;
  kdf: typeof KEY_POOL_BACKUP_KDF;
  iterations: number;
  cipher: typeof KEY_POOL_BACKUP_CIPHER;
  salt: string;
  iv: string;
  exportedAt: string;
}

export interface KeyPoolBackupEnvelope extends KeyPoolBackupHeader {
  authTag: string;
  ciphertext: string;
}

export interface KeyPoolBackupKeyEntry {
  rawKey: string;
  label: string;
  detectedProjectNumber: string | null;
}

export interface KeyPoolBackupPlaintextPayload {
  keys: KeyPoolBackupKeyEntry[];
  modelConfig: PoolModelConfig;
}

export interface KeyPoolBackupImportResult {
  importedCount: number;
  skippedDuplicate: number;
  invalid: number;
  truncated: number;
  totalAfter: number;
  modelConfigApplied: boolean;
}

