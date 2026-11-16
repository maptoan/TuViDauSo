export type KeyStatus = 'ready' | 'cooldown' | 'disabled';

export type KeyErrorCategory =
  | 'NONE'
  | 'RATE_LIMIT_RPM'
  | 'QUOTA_PROJECT_ZERO'
  | 'QUOTA_DAILY_EXHAUSTED'
  | 'AUTH_INVALID_KEY'
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
  cooldownUntil: number | null;
  cooldownReason: KeyErrorCategory;
  modelCooldowns?: Record<string, number>;
  stats: GeminiKeyStats;
  createdAt: number;
  updatedAt: number;
}

export interface PoolModelConfig {
  defaultModel: string;
  fallbackModel: string;
  supportedModels: string[];
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
}

export interface StreamInterruptedEvent {
  reason: string;
  errorCategory: KeyErrorCategory;
  partialLength: number;
}

export const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
export const FALLBACK_MODEL = 'gemini-3.8-flash';
export const DEFAULT_SUPPORTED_MODELS: string[] = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-4-hydrogen',
  'gemini-4-argon',
];

export const MAX_RAW_INPUT_CHARS = 65_536;
export const MAX_KEYS_IN_POOL = 50;
export const MAX_KEY_ATTEMPTS = 5;
export const FIRST_CHUNK_TIMEOUT_MS = 12_000;
export const TOTAL_FAILOVER_TIME_BUDGET_MS = 35_000;
export const TEST_KEY_TIMEOUT_MS = 8_000;
export const TEST_KEY_DEBOUNCE_MS = 5_000;
export const LEASE_MAX_TTL_MS = 45_000;
export const LEASE_ABSOLUTE_MAX_TTL_MS = 120_000;
export const PREVIEW_SESSION_TTL_MS = 5 * 60_000;
export const MAX_PREVIEW_SESSIONS = 20;
export const MAX_RECENT_LOGS = 100;
