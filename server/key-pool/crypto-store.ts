import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  DEFAULT_MODEL,
  DEFAULT_MODEL_PROFILES,
  DEFAULT_SUPPORTED_MODELS,
  type EncryptedPayload,
  FALLBACK_MODEL,
  FIRST_CHUNK_TIMEOUT_MAX_MS,
  FIRST_CHUNK_TIMEOUT_MIN_MS,
  type GeminiKeyRecord,
  KEY_POOL_BACKUP_CIPHER,
  KEY_POOL_BACKUP_FORMAT,
  KEY_POOL_BACKUP_KDF,
  KEY_POOL_BACKUP_MAX_BYTES,
  KEY_POOL_BACKUP_MAX_ITERATIONS,
  KEY_POOL_BACKUP_MIN_PASSPHRASE_LEN,
  KEY_POOL_BACKUP_PBKDF2_ITERATIONS,
  KEY_POOL_BACKUP_SCHEMA_VERSION,
  type KeyPoolBackupEnvelope,
  type KeyPoolBackupHeader,
  type KeyPoolBackupPlaintextPayload,
  type KeyPoolState,
  MAX_RECENT_LOGS,
  type ModelProfileConfig,
} from './types.ts';
import {
  computeKeyFingerprint,
  isValidGeminiApiKey,
  maskApiKey,
  parseBatchKeys,
} from './parser.ts';

const DATA_DIR = path.join(process.cwd(), '.data');
const POOL_FILE_PATH = path.join(DATA_DIR, 'gemini-key-pool.enc.json');
const MASTER_KEY_FILE_PATH = path.join(DATA_DIR, '.pool-master.key');

export class SerializedWriteQueue {
  private tail: Promise<void> = Promise.resolve();

  enqueue(task: () => Promise<void>): Promise<void> {
    const next = this.tail.then(task, task);
    this.tail = next.catch(() => {});
    return next;
  }
}

export function normalizeProfileFirstChunkTimeoutMs(
  modelName: string,
  profile: ModelProfileConfig,
): ModelProfileConfig {
  if (profile.firstChunkTimeoutMs === undefined) {
    return profile;
  }
  const raw = profile.firstChunkTimeoutMs;
  if (
    typeof raw === 'number' &&
    Number.isFinite(raw) &&
    raw >= FIRST_CHUNK_TIMEOUT_MIN_MS &&
    raw <= FIRST_CHUNK_TIMEOUT_MAX_MS
  ) {
    return profile;
  }
  const modelDefault = DEFAULT_MODEL_PROFILES[modelName]?.firstChunkTimeoutMs;
  console.warn(
    `[KeyPoolProfile] Invalid firstChunkTimeoutMs=${String(raw)} for model="${modelName}" (allowed [${FIRST_CHUNK_TIMEOUT_MIN_MS}, ${FIRST_CHUNK_TIMEOUT_MAX_MS}]); falling back to model default (${modelDefault ?? 'global'}).`,
  );
  const next: ModelProfileConfig = { ...profile };
  if (modelDefault !== undefined) {
    next.firstChunkTimeoutMs = modelDefault;
  } else {
    delete next.firstChunkTimeoutMs;
  }
  return next;
}

export function mergeModelProfiles(
  base?: Record<string, ModelProfileConfig>,
  override?: Record<string, ModelProfileConfig>,
): Record<string, ModelProfileConfig> {
  const merged: Record<string, ModelProfileConfig> = {};
  for (const [k, v] of Object.entries(DEFAULT_MODEL_PROFILES)) {
    merged[k] = { ...v };
  }
  const applyLayer = (layer?: Record<string, ModelProfileConfig>) => {
    if (!layer || typeof layer !== 'object') return;
    for (const [k, v] of Object.entries(layer)) {
      if (!v || typeof v !== 'object') continue;
      const existingBase = merged[k] ?? DEFAULT_MODEL_PROFILES[k];
      if (typeof v.maxOutputTokens !== 'number' && !existingBase) continue;
      const cleanFields: Partial<ModelProfileConfig> = {};
      for (const [fk, fv] of Object.entries(v)) {
        if (fv !== undefined) {
          (cleanFields as Record<string, unknown>)[fk] = fv;
        }
      }
      const combined = {
        ...(existingBase ?? {}),
        ...cleanFields,
      } as ModelProfileConfig;
      merged[k] = normalizeProfileFirstChunkTimeoutMs(k, combined);
    }
  };
  applyLayer(base);
  applyLayer(override);
  return merged;
}

function cloneProfiles(
  profiles?: Record<string, ModelProfileConfig>,
): Record<string, ModelProfileConfig> {
  return mergeModelProfiles(profiles);
}

export class KeyPoolCryptoStore {
  private readonly dataDir: string;
  private readonly poolFilePath: string;
  private readonly masterKeyFilePath: string;
  private readonly writeQueue = new SerializedWriteQueue();
  private masterKey: Buffer | null = null;

  constructor(baseDir?: string) {
    this.dataDir = baseDir ?? DATA_DIR;
    this.poolFilePath = path.join(this.dataDir, 'gemini-key-pool.enc.json');
    this.masterKeyFilePath = path.join(this.dataDir, '.pool-master.key');
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Dẫn xuất khóa chủ AES-256-GCM độc lập hoàn toàn với process.env.GEMINI_API_KEY (E2-01).
   * Thứ tự:
   * 1. KEY_POOL_MASTER_SECRET (nếu có trong môi trường) -> HKDF-SHA256
   * 2. File ngẫu nhiên 32 byte .data/.pool-master.key (quyền 0600)
   */
  public resolveMasterKey(): Buffer {
    if (this.masterKey) return this.masterKey;

    const envMaster = process.env.KEY_POOL_MASTER_SECRET?.trim();
    if (envMaster && envMaster.length > 0) {
      const derived = crypto.hkdfSync(
        'sha256',
        Buffer.from(envMaster, 'utf8'),
        Buffer.from('ziwei-key-pool-salt-v2', 'utf8'),
        Buffer.from('aes-256-gcm-master-key', 'utf8'),
        32,
      );
      this.masterKey = Buffer.from(derived);
      return this.masterKey;
    }

    this.ensureDataDir();
    if (fs.existsSync(this.masterKeyFilePath)) {
      const hex = fs.readFileSync(this.masterKeyFilePath, 'utf8').trim();
      if (/^[0-9a-fA-F]{64}$/.test(hex)) {
        this.masterKey = Buffer.from(hex, 'hex');
        return this.masterKey;
      }
    }

    const generated = crypto.randomBytes(32);
    const tmpMaster = `${this.masterKeyFilePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmpMaster, generated.toString('hex'), { mode: 0o600, encoding: 'utf8' });
    fs.renameSync(tmpMaster, this.masterKeyFilePath);
    try {
      fs.chmodSync(this.masterKeyFilePath, 0o600);
    } catch {
      // ignore chmod failures on filesystems that don't support POSIX modes
    }
    this.masterKey = generated;
    return this.masterKey;
  }

  public encryptKey(rawKey: string): EncryptedPayload {
    const key = this.resolveMasterKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(rawKey, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };
  }

  public decryptKey(payload: EncryptedPayload): string {
    const key = this.resolveMasterKey();
    const iv = Buffer.from(payload.iv, 'base64');
    const authTag = Buffer.from(payload.authTag, 'base64');
    const ciphertext = Buffer.from(payload.ciphertext, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plain.toString('utf8');
  }

  public createEmptyState(): KeyPoolState {
    return {
      version: 2,
      modelConfig: {
        defaultModel: DEFAULT_MODEL,
        fallbackModel: FALLBACK_MODEL,
        supportedModels: [...DEFAULT_SUPPORTED_MODELS],
        profiles: cloneProfiles(),
      },
      keys: [],
      recentLogs: [],
      roundRobinCursor: 0,
      disabledEnvFingerprints: [],
    };
  }

  public loadState(): { state: KeyPoolState; rawKeysById: Map<string, string> } {
    this.resolveMasterKey();
    const rawKeysById = new Map<string, string>();

    if (!fs.existsSync(this.poolFilePath)) {
      return { state: this.createEmptyState(), rawKeysById };
    }

    try {
      const content = fs.readFileSync(this.poolFilePath, 'utf8');
      const parsed = JSON.parse(content) as Partial<KeyPoolState>;
      const empty = this.createEmptyState();

      const validKeys: GeminiKeyRecord[] = [];
      for (const rec of Array.isArray(parsed.keys) ? parsed.keys : []) {
        try {
          const rawKey = this.decryptKey(rec.encryptedKey);
          if (!isValidGeminiApiKey(rawKey)) {
            console.warn(
              `[KeyPoolStore] Skipped invalid key format record ${rec?.id ?? 'unknown'} (${rec?.maskedKey ?? 'masked'})`,
            );
            continue;
          }
          rawKeysById.set(rec.id, rawKey);
          validKeys.push({
            ...rec,
            consecutiveForbiddenErrors:
              typeof rec.consecutiveForbiddenErrors === 'number'
                ? rec.consecutiveForbiddenErrors
                : 0,
            modelCooldowns:
              rec.modelCooldowns && typeof rec.modelCooldowns === 'object'
                ? rec.modelCooldowns
                : {},
          });
        } catch {
          // Chỉ bỏ qua bản ghi lỗi giải mã lẻ, không làm sập cả store
          console.warn(`[KeyPoolStore] Skipped unreadable key record ${rec?.id ?? 'unknown'}`);
        }
      }

      const supportedSet = new Set(
        Array.isArray(parsed.modelConfig?.supportedModels) && parsed.modelConfig!.supportedModels.length > 0
          ? parsed.modelConfig!.supportedModels
          : DEFAULT_SUPPORTED_MODELS,
      );
      for (const m of DEFAULT_SUPPORTED_MODELS) supportedSet.add(m);

      const state: KeyPoolState = {
        version: 2,
        modelConfig: {
          defaultModel: parsed.modelConfig?.defaultModel || DEFAULT_MODEL,
          fallbackModel: parsed.modelConfig?.fallbackModel || FALLBACK_MODEL,
          supportedModels: Array.from(supportedSet),
          profiles: cloneProfiles(parsed.modelConfig?.profiles),
        },
        keys: validKeys,
        recentLogs: Array.isArray(parsed.recentLogs)
          ? parsed.recentLogs.slice(-MAX_RECENT_LOGS)
          : empty.recentLogs,
        roundRobinCursor: typeof parsed.roundRobinCursor === 'number' ? parsed.roundRobinCursor : 0,
        disabledEnvFingerprints: Array.isArray(parsed.disabledEnvFingerprints)
          ? parsed.disabledEnvFingerprints
          : [],
      };

      return { state, rawKeysById };
    } catch {
      console.warn('[KeyPoolStore] Could not parse existing store file; starting clean pool.');
      return { state: this.createEmptyState(), rawKeysById };
    }
  }

  public saveState(state: KeyPoolState): Promise<void> {
    const snapshot = JSON.stringify(
      {
        ...state,
        recentLogs: state.recentLogs.slice(-MAX_RECENT_LOGS),
      },
      null,
      2,
    );

    return this.writeQueue.enqueue(async () => {
      this.ensureDataDir();
      const tmpPath = `${this.poolFilePath}.${process.pid}.${Date.now()}.tmp`;
      await fs.promises.writeFile(tmpPath, snapshot, { encoding: 'utf8', mode: 0o600 });
      await fs.promises.rename(tmpPath, this.poolFilePath);
      try {
        await fs.promises.chmod(this.poolFilePath, 0o600);
      } catch {
        // ignore chmod issues
      }
    });
  }

  public createKeyRecord(params: {
    rawKey: string;
    label: string;
    source: 'user_import' | 'env_secret';
    now?: number;
  }): GeminiKeyRecord {
    const now = params.now ?? Date.now();
    const fingerprint = computeKeyFingerprint(params.rawKey);
    return {
      id: `k_${crypto.randomUUID().slice(0, 8)}`,
      label: params.label,
      source: params.source,
      fingerprint,
      maskedKey: maskApiKey(params.rawKey),
      encryptedKey: this.encryptKey(params.rawKey),
      detectedProjectNumber: null,
      status: 'ready',
      pendingProbe: false,
      healthScore: 100,
      lastScoreRecoveryAt: now,
      consecutiveErrors: 0,
      consecutiveForbiddenErrors: 0,
      cooldownUntil: null,
      cooldownReason: 'NONE',
      modelCooldowns: {},
      stats: {
        totalCalls: 0,
        successCalls: 0,
        errorCalls: 0,
        lastErrorType: 'NONE',
        lastErrorMessage: null,
        lastErrorAt: null,
        lastUsedAt: null,
        lastSuccessAt: null,
        avgLatencyMs: null,
        lastTestLatencyMs: null,
        lastTestedAt: null,
      },
      createdAt: now,
      updatedAt: now,
    };
  }

  public collectEnvSeedKeys(): Array<{ rawKey: string; label: string }> {
    const seeds: Array<{ rawKey: string; label: string }> = [];
    const seen = new Set<string>();

    const single = process.env.GEMINI_API_KEY?.trim();
    if (single && single !== 'MY_GEMINI_API_KEY' && isValidGeminiApiKey(single)) {
      const fp = computeKeyFingerprint(single);
      seen.add(fp);
      seeds.push({
        rawKey: single,
        label: 'Secret hệ thống (GEMINI_API_KEY)',
      });
    }

    const multi = process.env.GEMINI_API_KEYS?.trim();
    if (multi) {
      const parsed = parseBatchKeys(multi, seen, 'Secret hệ thống', seeds.length + 1);
      for (const entry of parsed.validEntries) {
        if (!seen.has(entry.fingerprint)) {
          seen.add(entry.fingerprint);
          seeds.push({
            rawKey: entry.rawKey,
            label: entry.label,
          });
        }
      }
    }

    return seeds;
  }
}

export function assertValidBackupPassphrase(passphrase: unknown): string {
  if (
    typeof passphrase !== 'string' ||
    passphrase.trim().length === 0 ||
    passphrase.length < KEY_POOL_BACKUP_MIN_PASSPHRASE_LEN
  ) {
    throw new Error(
      `Mật khẩu bảo vệ gói sao lưu phải có ít nhất ${KEY_POOL_BACKUP_MIN_PASSPHRASE_LEN} ký tự.`,
    );
  }
  return passphrase;
}

export function buildCanonicalBackupAad(header: KeyPoolBackupHeader): Buffer {
  const ordered: Record<string, unknown> = {};
  for (const key of Object.keys(header).sort()) {
    ordered[key] = (header as unknown as Record<string, unknown>)[key];
  }
  return Buffer.from(JSON.stringify(ordered), 'utf8');
}

export function encryptPoolBackup(
  payload: KeyPoolBackupPlaintextPayload,
  passphrase: string,
  nowMs = Date.now(),
): KeyPoolBackupEnvelope {
  const validPass = assertValidBackupPassphrase(passphrase);
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const derivedKey = crypto.pbkdf2Sync(
    validPass,
    salt,
    KEY_POOL_BACKUP_PBKDF2_ITERATIONS,
    32,
    'sha256',
  );

  const header: KeyPoolBackupHeader = {
    format: KEY_POOL_BACKUP_FORMAT,
    schemaVersion: KEY_POOL_BACKUP_SCHEMA_VERSION,
    kdf: KEY_POOL_BACKUP_KDF,
    iterations: KEY_POOL_BACKUP_PBKDF2_ITERATIONS,
    cipher: KEY_POOL_BACKUP_CIPHER,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    exportedAt: new Date(nowMs).toISOString(),
  };
  const aad = buildCanonicalBackupAad(header);

  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
  cipher.setAAD(aad);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ...header,
    authTag: authTag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

export function decryptPoolBackup(
  rawEnvelope: unknown,
  passphrase: string,
): KeyPoolBackupPlaintextPayload {
  const validPass = assertValidBackupPassphrase(passphrase);

  if (!rawEnvelope || typeof rawEnvelope !== 'object' || Array.isArray(rawEnvelope)) {
    throw new Error('Định dạng tệp sao lưu Kho Khóa không hợp lệ.');
  }

  const serializedBytes = Buffer.byteLength(JSON.stringify(rawEnvelope), 'utf8');
  if (serializedBytes > KEY_POOL_BACKUP_MAX_BYTES) {
    throw new Error('Gói sao lưu vượt quá giới hạn tối đa 256 KB.');
  }

  const env = rawEnvelope as Partial<KeyPoolBackupEnvelope>;
  if (
    env.format !== KEY_POOL_BACKUP_FORMAT ||
    env.schemaVersion !== KEY_POOL_BACKUP_SCHEMA_VERSION ||
    env.kdf !== KEY_POOL_BACKUP_KDF ||
    env.cipher !== KEY_POOL_BACKUP_CIPHER ||
    typeof env.iterations !== 'number' ||
    !Number.isInteger(env.iterations) ||
    env.iterations < KEY_POOL_BACKUP_PBKDF2_ITERATIONS ||
    env.iterations > KEY_POOL_BACKUP_MAX_ITERATIONS ||
    typeof env.salt !== 'string' ||
    typeof env.iv !== 'string' ||
    typeof env.authTag !== 'string' ||
    typeof env.ciphertext !== 'string' ||
    typeof env.exportedAt !== 'string' ||
    !env.exportedAt.trim()
  ) {
    throw new Error('Cấu trúc hoặc tham số mã hóa của gói sao lưu không hợp lệ.');
  }

  const saltBuf = Buffer.from(env.salt, 'base64');
  const ivBuf = Buffer.from(env.iv, 'base64');
  const authTagBuf = Buffer.from(env.authTag, 'base64');
  const cipherBuf = Buffer.from(env.ciphertext, 'base64');

  if (
    saltBuf.length !== 16 ||
    ivBuf.length !== 12 ||
    authTagBuf.length !== 16 ||
    cipherBuf.length === 0
  ) {
    throw new Error('Dữ liệu mật mã (salt/iv/authTag) trong gói sao lưu không hợp lệ.');
  }

  const header: KeyPoolBackupHeader = {
    format: env.format,
    schemaVersion: env.schemaVersion,
    kdf: env.kdf,
    iterations: env.iterations,
    cipher: env.cipher,
    salt: env.salt,
    iv: env.iv,
    exportedAt: env.exportedAt,
  };
  const aad = buildCanonicalBackupAad(header);
  const derivedKey = crypto.pbkdf2Sync(validPass, saltBuf, env.iterations, 32, 'sha256');

  let plaintextStr: string;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, ivBuf);
    decipher.setAAD(aad);
    decipher.setAuthTag(authTagBuf);
    const plain = Buffer.concat([decipher.update(cipherBuf), decipher.final()]);
    plaintextStr = plain.toString('utf8');
  } catch {
    throw new Error(
      'Không thể giải mã gói sao lưu: mật khẩu không đúng hoặc tệp sao lưu đã bị chỉnh sửa.',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintextStr);
  } catch {
    throw new Error('Nội dung giải mã của gói sao lưu không phải JSON hợp lệ.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Dữ liệu bên trong gói sao lưu không đúng cấu trúc.');
  }

  const obj = parsed as Partial<KeyPoolBackupPlaintextPayload>;
  if (!Array.isArray(obj.keys)) {
    throw new Error('Gói sao lưu thiếu danh sách khóa hợp lệ.');
  }

  return {
    keys: obj.keys,
    modelConfig: obj.modelConfig ?? {
      defaultModel: DEFAULT_MODEL,
      fallbackModel: FALLBACK_MODEL,
      supportedModels: [...DEFAULT_SUPPORTED_MODELS],
    },
  };
}

export { POOL_FILE_PATH, MASTER_KEY_FILE_PATH };
