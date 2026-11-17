import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  DEFAULT_MODEL,
  DEFAULT_SUPPORTED_MODELS,
  EncryptedPayload,
  FALLBACK_MODEL,
  GeminiKeyRecord,
  KeyPoolState,
  MAX_RECENT_LOGS,
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
          if (!isValidGeminiApiKey(rawKey)) continue;
          rawKeysById.set(rec.id, rawKey);
          validKeys.push({
            ...rec,
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

export { POOL_FILE_PATH, MASTER_KEY_FILE_PATH };
