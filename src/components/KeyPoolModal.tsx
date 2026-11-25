import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  applyBatchItemToSnapshot,
  BATCH_COOLDOWN_PROBE_DELAY_MS,
  BatchCooldownProgress,
  BatchSingleProbeResponse,
  canTriggerBatchCooldownProbe,
  evaluatePoolReadinessBanner,
  resolveNextModelSelection,
  runClientBatchCooldownProbe,
  shouldRefreshKeyPoolSnapshot,
} from '../lib/key-pool-ui';
import {
  X,
  KeyRound,
  Plus,
  Trash2,
  RefreshCw,
  Activity,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Ban,
  Lock,
  Unlock,
  Server,
  Sparkles,
  Square,
  Download,
  Upload,
} from 'lucide-react';

export interface KeyStatsView {
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  lastErrorType: string;
  lastErrorMessage: string | null;
  lastErrorAt: number | null;
  lastUsedAt: number | null;
  lastSuccessAt: number | null;
  avgLatencyMs: number | null;
  lastTestLatencyMs: number | null;
  lastTestedAt: number | null;
}

export interface GeminiKeyPublicView {
  id: string;
  label: string;
  source: 'user_import' | 'env_secret';
  maskedKey: string;
  detectedProjectNumber: string | null;
  sameProjectKeyCount: number;
  status: 'ready' | 'cooldown' | 'disabled';
  pendingProbe: boolean;
  healthScore: number;
  consecutiveErrors: number;
  cooldownUntil: number | null;
  remainingCooldownSec: number;
  cooldownReason: string;
  stats: KeyStatsView;
  createdAt: number;
  updatedAt: number;
}

export interface KeyPoolLogEntryView {
  timestamp: number;
  keyId: string;
  maskedKey: string;
  fromStatus: string;
  toStatus: string;
  reason: string;
  cooldownSeconds?: number;
}

export interface KeyPoolPublicSnapshot {
  serverNow: number;
  isReadOnly: boolean;
  isSharedOrigin: boolean;
  adminPinRequired: boolean;
  hasAdminPinConfigured: boolean;
  envSecretPresent: boolean;
  envSecretActiveInPool: boolean;
  modelConfig: {
    defaultModel: string;
    fallbackModel: string;
    supportedModels: string[];
  };
  summary: {
    total: number;
    ready: number;
    cooldown: number;
    disabled: number;
  };
  keys: GeminiKeyPublicView[];
  recentLogs: KeyPoolLogEntryView[];
}

interface PreviewItemView {
  maskedToken: string;
  status: 'valid' | 'duplicate_in_batch' | 'duplicate_in_pool' | 'invalid_format';
  suggestedLabel?: string;
  reason?: string;
}

interface PreviewResultView {
  previewSessionId: string;
  expiresInSeconds: number;
  recognizedCount: number;
  duplicateCount: number;
  invalidCount: number;
  exceedsPoolLimit: boolean;
  message: string;
  items: PreviewItemView[];
}

interface KeyPoolModalProps {
  open: boolean;
  onClose: () => void;
  onPoolUpdated?: (snapshot: KeyPoolPublicSnapshot) => void;
  hasOtherOverlayOpen?: boolean;
}

function formatDurationSec(totalSec: number): string {
  if (totalSec <= 0) return '0s';
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) return `${hrs}g ${mins}p`;
  if (mins > 0) return `${mins}p ${secs}s`;
  return `${secs}s`;
}

function formatTimeAgo(ts: number | null, serverNow: number): string {
  if (!ts) return 'Chưa dùng';
  const diffSec = Math.max(0, Math.floor((serverNow - ts) / 1000));
  if (diffSec < 60) return `${diffSec} giây trước`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
  return new Date(ts).toLocaleDateString('vi-VN');
}

const ERROR_LABELS: Record<string, string> = {
  NONE: 'Không có lỗi',
  RATE_LIMIT_RPM: 'Vượt RPM/phút (429)',
  QUOTA_PROJECT_ZERO: 'Hạn mức Project = 0 (429)',
  QUOTA_DAILY_EXHAUSTED: 'Hết quota ngày (429)',
  AUTH_INVALID_KEY: 'Key không hợp lệ (401/key invalid)',
  AUTH_FORBIDDEN_AMBIGUOUS: 'Từ chối tạm thời (403)',
  AUTH_FORBIDDEN_REPEATED: 'Vô hiệu do 403 lặp 5 lần',
  API_NOT_ENABLED: 'Project chưa bật API (403)',
  TEST_TIMEOUT_INCONCLUSIVE: 'Hết giờ thử (chưa kết luận)',
  NETWORK_OR_5XX: 'Lỗi mạng / Máy chủ (5xx)',
  MODEL_UNAVAILABLE: 'Model không khả dụng',
  UNKNOWN: 'Lỗi khác',
};

export default function KeyPoolModal({
  open,
  onClose,
  onPoolUpdated,
  hasOtherOverlayOpen = false,
}: KeyPoolModalProps) {
  const [snapshot, setSnapshot] = useState<KeyPoolPublicSnapshot | null>(null);
  const [serverClockOffsetMs, setServerClockOffsetMs] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [loading, setLoading] = useState(false);

  // Admin PIN state (kept in sessionStorage only during tab session)
  const [adminPin, setAdminPin] = useState(() => {
    try {
      return sessionStorage.getItem('ziwei_key_pool_pin') || '';
    } catch {
      return '';
    }
  });
  const [pinInput, setPinInput] = useState('');

  // Batch input & preview state
  const [rawInput, setRawInput] = useState('');
  const [labelPrefix, setLabelPrefix] = useState('Khóa');
  const [preview, setPreview] = useState<PreviewResultView | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);

  // Model config state
  const [defaultModel, setDefaultModel] = useState('gemini-3.5-flash-lite');
  const [fallbackModel, setFallbackModel] = useState('gemma-4-31b-it');
  const [customModelInput, setCustomModelInput] = useState('');
  const [savingModels, setSavingModels] = useState(false);

  // Row operations & feedback
  const [testingKeyTarget, setTestingKeyTarget] = useState<{ id: string; model: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err' | 'warn'; text: string } | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  // Encrypted backup export/import state (KP-7 Tier 2)
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const [backupExporting, setBackupExporting] = useState(false);
  const [backupImporting, setBackupImporting] = useState(false);
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);

  // Batch cooldown re-check state (F3: Client-orchestrated)
  const [batchProgress, setBatchProgress] = useState<BatchCooldownProgress | null>(null);
  const batchStopRequestedRef = useRef(false);
  const batchAbortRef = useRef<AbortController | null>(null);
  const batchSleepAbortRef = useRef<AbortController | null>(null);

  const onPoolUpdatedRef = useRef(onPoolUpdated);
  useEffect(() => {
    onPoolUpdatedRef.current = onPoolUpdated;
  }, [onPoolUpdated]);

  const modelDirtyRef = useRef(false);
  const modelSaveSeqRef = useRef(0);
  const currentModelsRef = useRef({ defaultModel, fallbackModel });
  currentModelsRef.current = { defaultModel, fallbackModel };

  const authHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminPin.trim()) {
      h['x-key-pool-pin'] = adminPin.trim();
    }
    return h;
  }, [adminPin]);

  const applySnapshot = useCallback(
    (data: KeyPoolPublicSnapshot, options?: { forceSyncFromSave?: boolean }) => {
      setSnapshot(data);
      setServerClockOffsetMs(data.serverNow - Date.now());
      const resolved = resolveNextModelSelection(currentModelsRef.current, data.modelConfig, {
        modelDirty: modelDirtyRef.current,
        forceSyncFromSave: options?.forceSyncFromSave,
      });
      setDefaultModel(resolved.defaultModel);
      setFallbackModel(resolved.fallbackModel);
      onPoolUpdatedRef.current?.(data);
    },
    [],
  );

  const wasOpenRef = useRef(false);
  const hadOtherOverlayRef = useRef(false);
  const isBatchProbingRef = useRef(false);
  isBatchProbingRef.current = Boolean(batchProgress?.running);

  const fetchSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/key-pool', {
        cache: 'no-store',
        headers: adminPin.trim() ? { 'x-key-pool-pin': adminPin.trim() } : {},
      });
      if (res.ok) {
        const data = (await res.json()) as KeyPoolPublicSnapshot;
        applySnapshot(data);
      }
    } catch {
      setNotice({ type: 'err', text: 'Không thể tải trạng thái Kho Khóa từ máy chủ.' });
    } finally {
      setLoading(false);
    }
  }, [adminPin, applySnapshot]);

  const abortBatchProbeImmediately = useCallback(() => {
    batchStopRequestedRef.current = true;
    batchSleepAbortRef.current?.abort();
    batchAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    const hadOtherOverlayOpen = hadOtherOverlayRef.current;
    wasOpenRef.current = open;
    hadOtherOverlayRef.current = hasOtherOverlayOpen;

    if (!open) {
      abortBatchProbeImmediately();
      setBackupPassphrase('');
      return;
    }

    if (!wasOpen) {
      modelDirtyRef.current = false;
    }

    if (
      shouldRefreshKeyPoolSnapshot({
        open,
        wasOpen,
        hadOtherOverlayOpen,
        hasOtherOverlayOpen,
        isBatchProbing: isBatchProbingRef.current,
      })
    ) {
      fetchSnapshot();
    }
  }, [open, hasOtherOverlayOpen, fetchSnapshot, abortBatchProbeImmediately]);

  useEffect(() => {
    if (!open) return;

    const timer = setInterval(() => setNowTick(Date.now()), 1000);

    const handleRevealRefresh = () => {
      if (document.visibilityState === 'hidden') return;
      if (
        shouldRefreshKeyPoolSnapshot({
          open: true,
          wasOpen: true,
          hadOtherOverlayOpen: false,
          hasOtherOverlayOpen,
          regainedWindowFocus: true,
          isBatchProbing: isBatchProbingRef.current,
        })
      ) {
        fetchSnapshot();
      }
    };

    window.addEventListener('focus', handleRevealRefresh);
    document.addEventListener('visibilitychange', handleRevealRefresh);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', handleRevealRefresh);
      document.removeEventListener('visibilitychange', handleRevealRefresh);
    };
  }, [open, hasOtherOverlayOpen, fetchSnapshot]);

  if (!open) return null;

  const estimatedServerNow = nowTick + serverClockOffsetMs;
  const isReadOnly = snapshot?.isReadOnly ?? false;

  const handleUnlockWithPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pinInput.trim();
    if (!clean) return;
    try {
      const res = await fetch('/api/key-pool', {
        cache: 'no-store',
        headers: { 'x-key-pool-pin': clean },
      });
      if (res.ok) {
        const data = (await res.json()) as KeyPoolPublicSnapshot;
        if (!data.isReadOnly) {
          setAdminPin(clean);
          try {
            sessionStorage.setItem('ziwei_key_pool_pin', clean);
          } catch {
            // ignore storage errors
          }
          setPinInput('');
          applySnapshot(data);
          setNotice({ type: 'ok', text: 'Đã mở khóa quyền quản trị Kho Khóa.' });
        } else {
          setNotice({ type: 'err', text: 'Mã PIN quản trị không chính xác.' });
        }
      }
    } catch {
      setNotice({ type: 'err', text: 'Lỗi kiểm tra mã PIN quản trị.' });
    }
  };

  const handlePreview = async () => {
    if (!rawInput.trim() || previewLoading) return;
    setPreviewLoading(true);
    setNotice(null);
    try {
      const res = await fetch('/api/key-pool/preview', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ rawInput, labelPrefix }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ type: 'err', text: data?.message || 'Không thể phân tích danh sách khóa.' });
        return;
      }
      setPreview(data as PreviewResultView);
    } catch {
      setNotice({ type: 'err', text: 'Lỗi kết nối khi phân tích danh sách khóa.' });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!preview || preview.recognizedCount === 0 || preview.exceedsPoolLimit || importLoading) {
      return;
    }
    setImportLoading(true);
    setNotice(null);
    try {
      const res = await fetch('/api/key-pool/import', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ previewSessionId: preview.previewSessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ type: 'err', text: data?.message || 'Lưu khóa thất bại.' });
        return;
      }
      if (data?.pool) {
        applySnapshot(data.pool);
      }
      setRawInput('');
      setPreview(null);
      setNotice({
        type: 'ok',
        text: `Đã lưu thành công ${data.importedCount} khóa ở trạng thái Sẵn sàng (100 điểm).`,
      });
    } catch {
      setNotice({ type: 'err', text: 'Lỗi kết nối khi lưu danh sách khóa.' });
    } finally {
      setImportLoading(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    setNotice(null);
    try {
      const res = await fetch(`/api/key-pool/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ type: 'err', text: data?.message || 'Không thể xóa khóa.' });
        return;
      }
      setConfirmDeleteId(null);
      if (data?.pool) applySnapshot(data.pool);
      setNotice({ type: 'ok', text: 'Đã xóa khóa khỏi Kho Khóa.' });
    } catch {
      setNotice({ type: 'err', text: 'Lỗi kết nối khi xóa khóa.' });
    }
  };

  const handleReactivateKey = async (id: string) => {
    setNotice(null);
    try {
      const res = await fetch(`/api/key-pool/${encodeURIComponent(id)}/reactivate`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ type: 'err', text: data?.message || 'Không thể kích hoạt lại khóa.' });
        return;
      }
      if (data?.pool) applySnapshot(data.pool);
      setNotice({ type: 'ok', text: 'Đã kích hoạt lại khóa về trạng thái Sẵn sàng (chờ thăm dò).' });
    } catch {
      setNotice({ type: 'err', text: 'Lỗi kết nối khi kích hoạt lại khóa.' });
    }
  };

  const handleTestKey = async (id: string, model?: string) => {
    const modelLabel = model || snapshot?.modelConfig.defaultModel || defaultModel;
    setTestingKeyTarget({ id, model: modelLabel });
    setNotice(null);
    try {
      const res = await fetch(`/api/key-pool/${encodeURIComponent(id)}/test`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(model ? { model } : {}),
      });
      const data = await res.json();
      if (data?.pool) applySnapshot(data.pool);
      if (!res.ok) {
        setNotice({ type: 'err', text: data?.message || 'Kiểm tra thử thất bại.' });
        return;
      }
      if (data.ok) {
        setNotice({
          type: 'ok',
          text: data.isDefaultModel === false
            ? `Khóa phản hồi tốt trên model phụ ${data.modelUsed} (độ trễ: ${data.latencyMs}ms · giữ nguyên trạng thái khóa).`
            : `Khóa hoạt động tốt trên ${data.modelUsed} (độ trễ kiểm tra: ${data.latencyMs}ms).`,
        });
      } else if (data.inconclusive || data.errorCategory === 'TEST_TIMEOUT_INCONCLUSIVE') {
        setNotice({
          type: 'warn',
          text: `Chưa kết luận trên ${data.modelUsed} [${ERROR_LABELS.TEST_TIMEOUT_INCONCLUSIVE}]: ${data.sanitizedMessage || 'Giữ nguyên trạng thái và điểm sức khỏe của khóa.'}`,
        });
      } else {
        setNotice({
          type: 'err',
          text: `Khóa gặp lỗi trên ${data.modelUsed || modelLabel} [${ERROR_LABELS[data.errorCategory] || data.errorCategory}]: ${data.sanitizedMessage}`,
        });
      }
    } catch {
      setNotice({ type: 'err', text: 'Lỗi kết nối khi kiểm tra thử khóa.' });
    } finally {
      setTestingKeyTarget(null);
    }
  };

  const handleStopBatchCooldownProbe = () => {
    batchStopRequestedRef.current = true;
    // Hủy nhịp nghỉ 1,2s nếu đang chờ; nếu một key đang probe dở thì để key đó hoàn tất rồi dừng cleanly
    batchSleepAbortRef.current?.abort();
    setNotice({
      type: 'ok',
      text: 'Đang dừng kiểm tra sau khi hoàn tất khóa hiện tại (giữ nguyên các kết quả đã có)...',
    });
  };

  const handleRunBatchCooldownProbe = async () => {
    if (!snapshot) return;
    const cooldownKeysCount = snapshot.keys.filter((k) => k.status === 'cooldown').length;
    if (!canTriggerBatchCooldownProbe(isReadOnly, cooldownKeysCount, Boolean(batchProgress?.running))) {
      return;
    }

    batchStopRequestedRef.current = false;
    const mainController = new AbortController();
    batchAbortRef.current = mainController;
    setNotice(null);

    try {
      const finalProgress = await runClientBatchCooldownProbe({
        keys: snapshot.keys,
        delayBetweenRealProbesMs: BATCH_COOLDOWN_PROBE_DELAY_MS,
        signal: mainController.signal,
        shouldStop: () => batchStopRequestedRef.current,
        sleep: (ms, signal) =>
          new Promise<void>((resolve) => {
            if (ms <= 0 || signal?.aborted || batchStopRequestedRef.current) {
              resolve();
              return;
            }
            const sleepCtrl = new AbortController();
            batchSleepAbortRef.current = sleepCtrl;
            const timer = setTimeout(() => {
              cleanup();
              resolve();
            }, ms);
            const onDone = () => {
              clearTimeout(timer);
              cleanup();
              resolve();
            };
            const cleanup = () => {
              signal?.removeEventListener('abort', onDone);
              sleepCtrl.signal.removeEventListener('abort', onDone);
              if (batchSleepAbortRef.current === sleepCtrl) {
                batchSleepAbortRef.current = null;
              }
            };
            signal?.addEventListener('abort', onDone, { once: true });
            sleepCtrl.signal.addEventListener('abort', onDone, { once: true });
          }),
        probeSingleKey: async (keyId, signal): Promise<BatchSingleProbeResponse> => {
          const res = await fetch(`/api/key-pool/${encodeURIComponent(keyId)}/test`, {
            method: 'POST',
            headers: authHeaders(),
            signal,
          });
          const data = await res.json().catch(() => ({}));
          if (res.status === 403) {
            return {
              kind: 'auth_blocked',
              message: data?.message || 'Cần mở khóa mã PIN quản trị để kiểm tra khóa.',
            };
          }
          if (res.status === 429) {
            return {
              kind: 'deferred_debounce',
              message: data?.message || 'Chưa thử (đang chờ hết khoảng đệm chống spam).',
            };
          }
          if (!res.ok) {
            return {
              kind: 'probed',
              ok: false,
              latencyMs: 0,
              modelUsed: snapshot.modelConfig.defaultModel,
              status: 'cooldown',
              healthScore: 0,
              errorCategory: 'NETWORK_OR_5XX',
              sanitizedMessage: data?.message || `HTTP ${res.status}`,
            };
          }
          return {
            kind: 'probed',
            ok: Boolean(data.ok),
            inconclusive: Boolean(data.inconclusive),
            latencyMs: typeof data.latencyMs === 'number' ? data.latencyMs : 0,
            modelUsed: data.modelUsed || snapshot.modelConfig.defaultModel,
            status: data.status || (data.ok ? 'ready' : 'cooldown'),
            healthScore: typeof data.healthScore === 'number' ? data.healthScore : 0,
            detectedProjectNumber:
              typeof data.detectedProjectNumber === 'string' || data.detectedProjectNumber === null
                ? data.detectedProjectNumber
                : undefined,
            errorCategory: data.errorCategory,
            sanitizedMessage: data.sanitizedMessage,
            cooldownUntil: typeof data.cooldownUntil === 'number' || data.cooldownUntil === null ? data.cooldownUntil : undefined,
          };
        },
        onProgress: (p) => {
          setBatchProgress(p);
        },
        onItemCompleted: (item) => {
          setSnapshot((prev) => {
            if (!prev) return prev;
            const next = applyBatchItemToSnapshot(prev, item, Date.now() + serverClockOffsetMs);
            onPoolUpdatedRef.current?.(next);
            return next;
          });
        },
      });

      setBatchProgress(finalProgress);
      if (finalProgress.abortReason) {
        setNotice({ type: 'err', text: finalProgress.abortReason });
      } else {
        const { counts } = finalProgress;
        setNotice({
          type: counts.recovered > 0 ? 'ok' : counts.inconclusive > 0 && counts.stillFailing === 0 ? 'warn' : 'err',
          text: `${
            finalProgress.stoppedEarly ? 'Đã dừng kiểm tra' : 'Hoàn tất kiểm tra'
          } ${finalProgress.processed}/${finalProgress.total} khóa đang nguội: Hồi phục ${counts.recovered} · Còn lỗi ${counts.stillFailing} (probe thật)${
            counts.inconclusive > 0 ? ` · Chưa kết luận (timeout) ${counts.inconclusive}` : ''
          } · Bỏ qua trùng Project ${counts.skippedSameProject} · Vô hiệu ${counts.disabled}${
            counts.deferred > 0 ? ` · Chưa thử (đang chờ) ${counts.deferred}` : ''
          }.`,
        });
      }
    } finally {
      if (batchAbortRef.current === mainController) {
        batchAbortRef.current = null;
      }
      batchSleepAbortRef.current = null;
    }
  };

  const handleSyncEnv = async () => {
    setNotice(null);
    try {
      const res = await fetch('/api/key-pool/sync-env', {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ type: 'err', text: data?.message || 'Không thể đồng bộ từ biến môi trường.' });
        return;
      }
      if (data?.pool) applySnapshot(data.pool);
      setNotice({
        type: 'ok',
        text:
          data.added > 0
            ? `Đã đồng bộ lại ${data.added} khóa từ Secret môi trường.`
            : 'Các khóa từ Secret môi trường đều đã có trong kho.',
      });
    } catch {
      setNotice({ type: 'err', text: 'Lỗi kết nối khi đồng bộ từ Secret.' });
    }
  };

  const persistModels = async (
    nextDefault: string,
    nextFallback: string,
    rawCustomInput = '',
  ) => {
    const seq = ++modelSaveSeqRef.current;
    modelDirtyRef.current = true;
    setSavingModels(true);
    setNotice(null);
    try {
      const customList = rawCustomInput
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch('/api/key-pool/models', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          defaultModel: nextDefault,
          fallbackModel: nextFallback,
          customSupportedModels: customList,
        }),
      });
      const data = await res.json();
      if (seq !== modelSaveSeqRef.current) return;
      if (!res.ok) {
        modelDirtyRef.current = false;
        if (snapshot?.modelConfig) {
          setDefaultModel(snapshot.modelConfig.defaultModel);
          setFallbackModel(snapshot.modelConfig.fallbackModel);
        }
        setNotice({ type: 'err', text: data?.message || 'Không thể cập nhật cấu hình model.' });
        return;
      }
      modelDirtyRef.current = false;
      if (rawCustomInput.trim()) {
        setCustomModelInput('');
      }
      if (data?.pool) {
        applySnapshot(data.pool, { forceSyncFromSave: true });
      }
      setNotice({
        type: 'ok',
        text: `Đã cập nhật Model mặc định: ${data.modelConfig.defaultModel} | Dự phòng: ${data.modelConfig.fallbackModel}`,
      });
    } catch {
      if (seq === modelSaveSeqRef.current) {
        modelDirtyRef.current = false;
        setNotice({ type: 'err', text: 'Lỗi kết nối khi lưu cấu hình model.' });
      }
    } finally {
      if (seq === modelSaveSeqRef.current) {
        setSavingModels(false);
      }
    }
  };

  const handleSaveModels = async () => {
    await persistModels(defaultModel, fallbackModel, customModelInput);
  };

  const handleExportBackup = async () => {
    if (isReadOnly || backupExporting) return;
    if (!backupPassphrase.trim() || backupPassphrase.length < 8) {
      setNotice({
        type: 'err',
        text: 'Mật khẩu bảo vệ gói sao lưu phải có ít nhất 8 ký tự.',
      });
      return;
    }
    setBackupExporting(true);
    setNotice(null);
    try {
      const res = await fetch('/api/key-pool/backup/export', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ passphrase: backupPassphrase }),
      });
      const data = await res.json();
      if (!res.ok || !data?.backup) {
        setNotice({ type: 'err', text: data?.message || 'Không thể xuất gói sao lưu Kho Khóa.' });
        return;
      }
      const dateStr = new Date().toISOString().slice(0, 10);
      const blob = new Blob([JSON.stringify(data.backup, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tuvi-key-pool-backup-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setBackupPassphrase('');
      setNotice({
        type: 'ok',
        text: 'Đã xuất tệp sao lưu Kho Khóa mã hóa AES-256-GCM thành công. Hãy cất giữ mật khẩu cẩn thận để khôi phục khi cần.',
      });
    } catch {
      setNotice({ type: 'err', text: 'Lỗi kết nối khi xuất gói sao lưu Kho Khóa.' });
    } finally {
      setBackupExporting(false);
    }
  };

  const handleImportBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || isReadOnly || backupImporting) return;
    if (!backupPassphrase.trim() || backupPassphrase.length < 8) {
      setNotice({
        type: 'err',
        text: 'Vui lòng nhập mật khẩu giải mã (tối thiểu 8 ký tự) trước khi chọn tệp sao lưu.',
      });
      return;
    }
    if (file.size > 256 * 1024) {
      setNotice({
        type: 'err',
        text: 'Tệp sao lưu vượt quá giới hạn tối đa 256 KB.',
      });
      return;
    }

    setBackupImporting(true);
    setNotice(null);
    try {
      const text = await file.text();
      let parsedBackup: unknown;
      try {
        parsedBackup = JSON.parse(text);
      } catch {
        setNotice({ type: 'err', text: 'Tệp đã chọn không phải định dạng JSON hợp lệ.' });
        return;
      }

      const res = await fetch('/api/key-pool/backup/import', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          backup: parsedBackup,
          passphrase: backupPassphrase,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ type: 'err', text: data?.message || 'Khôi phục gói sao lưu thất bại.' });
        return;
      }
      if (data?.pool) {
        modelDirtyRef.current = false;
        applySnapshot(data.pool, { forceSyncFromSave: true });
      }
      setBackupPassphrase('');
      const parts: string[] = [`Đã khôi phục ${data.importedCount ?? 0} khóa mới`];
      if (data.skippedDuplicate > 0) parts.push(`bỏ qua ${data.skippedDuplicate} khóa trùng`);
      if (data.invalid > 0) parts.push(`${data.invalid} khóa không hợp lệ`);
      if (data.truncated > 0) parts.push(`${data.truncated} khóa vượt trần kho`);
      if (data.modelConfigApplied) parts.push('đã đồng bộ cấu hình Model');
      setNotice({
        type: 'ok',
        text: `${parts.join(' · ')}. Tổng số khóa hiện tại: ${data.totalAfter ?? snapshot?.summary.total ?? 0}.`,
      });
    } catch {
      setNotice({ type: 'err', text: 'Lỗi kết nối hoặc đọc tệp khi khôi phục gói sao lưu.' });
    } finally {
      setBackupImporting(false);
    }
  };

  const readinessBanner = snapshot ? evaluatePoolReadinessBanner(snapshot.summary) : null;

  const modelChoices = Array.from(
    new Set([
      ...(snapshot?.modelConfig.supportedModels ?? [
        'gemini-3.5-flash-lite',
        'gemini-3.5-flash',
        'gemini-3.8-flash',
        'gemini-4-hydrogen',
        'gemini-4-argon',
      ]),
      defaultModel,
      fallbackModel,
    ]),
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-sm">
      <div className="w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-2xl border border-[var(--t-border-acc)] bg-[var(--t-bg)] text-[var(--t-text)] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--t-border)] bg-[var(--t-card)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[var(--t-gold)]/15 border border-[var(--t-gold)]/40 flex items-center justify-center text-[var(--t-gold)]">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[var(--t-text)]">
                Kho Khóa Gemini API & Điều Phối Model
              </h2>
              <p className="text-[11px] text-[var(--t-text2)]">
                Lưu trữ mã hóa AES-256-GCM phía máy chủ · Tự chọn khóa khỏe nhất & chuyển dự phòng khi quá tải
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchSnapshot}
              disabled={loading}
              className="p-2 rounded-lg border border-[var(--t-border)] bg-[var(--t-surface)] text-[var(--t-text2)] hover:text-[var(--t-gold)] cursor-pointer"
              title="Làm mới trạng thái"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => {
                abortBatchProbeImmediately();
                onClose();
              }}
              className="p-2 rounded-lg border border-[var(--t-border)] bg-[var(--t-surface)] text-[var(--t-text2)] hover:text-rose-400 cursor-pointer"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Read-Only / PIN Guard Banner (QĐ-1) */}
          {snapshot?.isReadOnly && (
            <div className="rounded-xl p-3.5 border border-amber-500/40 bg-amber-500/10 text-xs space-y-2.5">
              <div className="flex items-start gap-2 text-amber-300 font-semibold">
                <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {snapshot.isSharedOrigin && !snapshot.hasAdminPinConfigured
                    ? 'Chế độ Chỉ xem (Read-Only) trên Shared App URL: Chức năng thêm/sửa/xóa khóa bị khóa khi chưa cấu hình KEY_POOL_ADMIN_PIN trong Secrets.'
                    : 'Đang khóa thao tác chỉnh sửa: Vui lòng nhập mã PIN quản trị (KEY_POOL_ADMIN_PIN) để thêm, xóa hoặc kiểm tra khóa.'}
                </span>
              </div>

              {snapshot.adminPinRequired && (
                <form onSubmit={handleUnlockWithPin} className="flex items-center gap-2 max-w-sm">
                  <input
                    type="password"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="Nhập mã PIN quản trị..."
                    className="flex-1 rounded-lg px-3 py-1.5 text-xs border bg-[var(--t-bg)] border-[var(--t-border)] text-[var(--t-text)] focus:outline-none focus:border-[var(--t-gold)]"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--t-gold)] text-slate-950 cursor-pointer"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Mở khóa</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Feedback Notice */}
          {notice && (
            <div
              className={`rounded-xl p-3 border text-xs flex items-start gap-2 ${
                notice.type === 'ok'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : notice.type === 'warn'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                    : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
              }`}
            >
              {notice.type === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{notice.text}</span>
            </div>
          )}

          {/* Summary Strip */}
          {snapshot && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="rounded-xl p-3 border border-[var(--t-border)] bg-[var(--t-card)]">
                <div className="text-[11px] text-[var(--t-faint)]">Tổng số khóa</div>
                <div className="text-lg font-bold font-mono-tabular text-[var(--t-text)]">
                  {snapshot.summary.total}
                </div>
              </div>
              <div className="rounded-xl p-3 border border-emerald-500/30 bg-emerald-500/5">
                <div className="text-[11px] text-emerald-400">Sẵn sàng</div>
                <div className="text-lg font-bold font-mono-tabular text-emerald-400">
                  {snapshot.summary.ready}
                </div>
              </div>
              <div className="rounded-xl p-3 border border-amber-500/30 bg-amber-500/5">
                <div className="text-[11px] text-amber-400">Đang nguội (Cool down)</div>
                <div className="text-lg font-bold font-mono-tabular text-amber-400">
                  {snapshot.summary.cooldown}
                </div>
              </div>
              <div className="rounded-xl p-3 border border-rose-500/30 bg-rose-500/5">
                <div className="text-[11px] text-rose-400">Bị vô hiệu (401/403)</div>
                <div className="text-lg font-bold font-mono-tabular text-rose-400">
                  {snapshot.summary.disabled}
                </div>
              </div>
            </div>
          )}

          {/* Readiness Banner (KP-7 Tầng 2 · Y1) */}
          {readinessBanner && (
            <div
              data-readiness-code={readinessBanner.code}
              className={`rounded-xl p-3.5 border text-xs flex items-start gap-2.5 ${
                readinessBanner.severity === 'critical'
                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
              }`}
            >
              <ShieldAlert
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  readinessBanner.severity === 'critical' ? 'text-rose-400' : 'text-amber-400'
                }`}
              />
              <div className="space-y-0.5">
                <div className="font-bold">{readinessBanner.title}</div>
                <div className="text-[11px] leading-relaxed opacity-90">{readinessBanner.message}</div>
              </div>
            </div>
          )}

          {/* Section 1: Model Configuration (Gemini 3.5+) */}
          <div className="rounded-xl p-4 border border-[var(--t-border)] bg-[var(--t-card)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--t-gold)]" />
                <h3 className="text-xs sm:text-sm font-bold text-[var(--t-text)]">
                  Cấu Hình Model Gemini (Hỗ trợ Gemini 3.5 trở lên)
                </h3>
              </div>
              <span className="text-[11px] text-[var(--t-faint)]">
                Áp dụng chung cho Luận giải Vận hạn, Chủ đề & Hợp bàn
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-[var(--t-text2)] block">
                  Model mặc định
                </span>
                <select
                  value={defaultModel}
                  onChange={(e) => {
                    const nextDefault = e.target.value;
                    modelDirtyRef.current = true;
                    setDefaultModel(nextDefault);
                    if (!isReadOnly) {
                      void persistModels(nextDefault, fallbackModel, customModelInput);
                    }
                  }}
                  disabled={isReadOnly}
                  className="w-full rounded-lg px-2.5 py-2 border bg-[var(--t-bg)] border-[var(--t-border)] text-[var(--t-text)] focus:outline-none focus:border-[var(--t-gold)] disabled:opacity-60"
                >
                  {modelChoices.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-[var(--t-text2)] block">
                  Model dự phòng (Fallback)
                </span>
                <select
                  value={fallbackModel}
                  onChange={(e) => {
                    const nextFallback = e.target.value;
                    modelDirtyRef.current = true;
                    setFallbackModel(nextFallback);
                    if (!isReadOnly) {
                      void persistModels(defaultModel, nextFallback, customModelInput);
                    }
                  }}
                  disabled={isReadOnly}
                  className="w-full rounded-lg px-2.5 py-2 border bg-[var(--t-bg)] border-[var(--t-border)] text-[var(--t-text)] focus:outline-none focus:border-[var(--t-gold)] disabled:opacity-60"
                >
                  {modelChoices.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-[var(--t-text2)] block">
                  Thêm model mới (&gt;= 3.5, tùy chọn)
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customModelInput}
                    onChange={(e) => setCustomModelInput(e.target.value)}
                    disabled={isReadOnly}
                    placeholder="vd: gemini-3.9-pro"
                    className="flex-1 rounded-lg px-2.5 py-2 border bg-[var(--t-bg)] border-[var(--t-border)] text-[var(--t-text)] focus:outline-none focus:border-[var(--t-gold)] disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={handleSaveModels}
                    disabled={isReadOnly || savingModels}
                    className="px-3 py-2 rounded-lg font-semibold bg-[var(--t-gold)] text-slate-950 hover:opacity-95 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                  >
                    {savingModels ? 'Đang lưu...' : 'Lưu Model'}
                  </button>
                </div>
              </label>
            </div>
          </div>

          {/* Section 2: Batch Import + Preview */}
          <div className="rounded-xl p-4 border border-[var(--t-border)] bg-[var(--t-card)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-[var(--t-gold)]" />
                <h3 className="text-xs sm:text-sm font-bold text-[var(--t-text)]">
                  Thêm Nhiều Khóa API (Hỗ trợ đa định dạng)
                </h3>
              </div>
              {snapshot?.envSecretPresent && !snapshot.envSecretActiveInPool && !isReadOnly && (
                <button
                  type="button"
                  onClick={handleSyncEnv}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-[var(--t-gold)]/40 bg-[var(--t-gold)]/10 text-[var(--t-gold)] hover:bg-[var(--t-gold)]/20 cursor-pointer"
                >
                  <Server className="w-3.5 h-3.5" />
                  <span>Đồng bộ lại từ GEMINI_API_KEY</span>
                </button>
              )}
            </div>

            <p className="text-[11px] text-[var(--t-text2)] leading-relaxed">
              Dán một hoặc nhiều Gemini API key cùng lúc (hỗ trợ cả định dạng <code>AIza...</code> và <code>AQ....</code>). Hệ thống tự tách theo dấu phẩy (<code>,</code>), khoảng trắng, tab, chấm phẩy (<code>;</code>), mỗi key một hàng, dòng <code>.env</code>, nhãn <code>Ten: AIza.../AQ....</code> hoặc JSON. Khóa chỉ lưu ở máy chủ và luôn hiển thị dạng che sau khi lưu.
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-end">
              <div className="flex-1 space-y-1">
                <textarea
                  rows={3}
                  value={rawInput}
                  onChange={(e) => {
                    setRawInput(e.target.value);
                    if (preview) setPreview(null);
                  }}
                  disabled={isReadOnly}
                  placeholder="Dán danh sách Gemini API key tại đây (mỗi dòng 1 key hoặc cách nhau bởi dấu phẩy, khoảng trắng, tab, chấm phẩy)..."
                  className="w-full rounded-lg p-2.5 text-xs font-mono border bg-[var(--t-bg)] border-[var(--t-border)] text-[var(--t-text)] focus:outline-none focus:border-[var(--t-gold)] disabled:opacity-50"
                />
              </div>
              <div className="flex sm:flex-col gap-2 shrink-0">
                <input
                  type="text"
                  value={labelPrefix}
                  onChange={(e) => setLabelPrefix(e.target.value)}
                  disabled={isReadOnly}
                  placeholder="Tiền tố nhãn (vd: Project)"
                  className="rounded-lg px-2.5 py-2 text-xs border bg-[var(--t-bg)] border-[var(--t-border)] text-[var(--t-text)] focus:outline-none focus:border-[var(--t-gold)] disabled:opacity-50 sm:w-40"
                />
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={isReadOnly || !rawInput.trim() || previewLoading}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold border border-[var(--t-gold)] bg-[var(--t-gold)]/15 text-[var(--t-gold)] hover:bg-[var(--t-gold)] hover:text-slate-950 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                >
                  {previewLoading ? 'Đang phân tích...' : 'Phân tích & Xem trước'}
                </button>
              </div>
            </div>

            {/* Preview Confirmation Box */}
            {preview && (
              <div className="rounded-xl p-3.5 border border-[var(--t-border-acc)] bg-[var(--t-surface)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-[var(--t-gold)]">
                    {preview.message}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreview(null)}
                      className="px-2.5 py-1 rounded-lg text-xs border border-[var(--t-border)] text-[var(--t-text2)] hover:text-[var(--t-text)] cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmImport}
                      disabled={preview.recognizedCount === 0 || preview.exceedsPoolLimit || importLoading}
                      className="px-3 py-1 rounded-lg text-xs font-semibold bg-[var(--t-gold)] text-slate-950 hover:opacity-95 disabled:opacity-40 cursor-pointer"
                    >
                      {importLoading
                        ? 'Đang lưu...'
                        : `Xác nhận lưu ${preview.recognizedCount} key`}
                    </button>
                  </div>
                </div>

                {preview.items.length > 0 && (
                  <div className="max-h-40 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                    {preview.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)]"
                      >
                        <span className="font-mono text-[var(--t-text)]">{item.maskedToken}</span>
                        {item.status === 'valid' ? (
                          <span className="text-emerald-400 font-semibold">
                            Hợp lệ ({item.suggestedLabel})
                          </span>
                        ) : item.status === 'invalid_format' ? (
                          <span className="text-rose-400">Không hợp lệ</span>
                        ) : (
                          <span className="text-amber-400">Trùng lặp</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 2B: Encrypted Pool Backup & Restore (KP-7 Tầng 2 · Y2) */}
          <div className="rounded-xl p-4 border border-[var(--t-border)] bg-[var(--t-card)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[var(--t-gold)]" />
                <h3 className="text-xs sm:text-sm font-bold text-[var(--t-text)]">
                  Sao Lưu &amp; Khôi Phục Kho Khóa (Mã Hóa Mật Khẩu)
                </h3>
              </div>
              <span className="text-[11px] text-[var(--t-faint)]">
                PBKDF2-SHA256 + AES-256-GCM · Di chuyển sang container/môi trường mới
              </span>
            </div>

            <p className="text-[11px] text-[var(--t-text2)] leading-relaxed">
              Xuất toàn bộ khóa, nhãn, Project GCP và cấu hình Model thành tệp <code>.json</code> được mã hóa độc lập bằng mật khẩu của bạn (tối thiểu 8 ký tự). Khi nhập lại ở môi trường mới, chỉ cần chọn tệp và nhập đúng mật khẩu đã đặt.
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
              <input
                type="password"
                value={backupPassphrase}
                onChange={(e) => setBackupPassphrase(e.target.value)}
                disabled={isReadOnly || backupExporting || backupImporting}
                autoComplete="new-password"
                placeholder="Nhập mật khẩu sao lưu / giải mã (tối thiểu 8 ký tự)..."
                className="flex-1 rounded-lg px-3 py-2 text-xs border bg-[var(--t-bg)] border-[var(--t-border)] text-[var(--t-text)] focus:outline-none focus:border-[var(--t-gold)] disabled:opacity-50"
              />
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={handleExportBackup}
                  disabled={
                    isReadOnly ||
                    backupExporting ||
                    backupImporting ||
                    backupPassphrase.length < 8
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-[var(--t-gold)] bg-[var(--t-gold)]/15 text-[var(--t-gold)] hover:bg-[var(--t-gold)] hover:text-slate-950 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{backupExporting ? 'Đang mã hóa...' : 'Xuất gói sao lưu (.json)'}</span>
                </button>

                <input
                  ref={backupFileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportBackupFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => backupFileInputRef.current?.click()}
                  disabled={
                    isReadOnly ||
                    backupExporting ||
                    backupImporting ||
                    backupPassphrase.length < 8
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-emerald-500/45 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{backupImporting ? 'Đang khôi phục...' : 'Khôi phục từ tệp (.json)'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Keys Dashboard Table */}
          <div className="rounded-xl border border-[var(--t-border)] bg-[var(--t-card)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--t-border)] flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[var(--t-gold)]" />
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-[var(--t-text)]">
                    Bảng Theo Dõi Sức Khỏe Từng Khóa ({snapshot?.keys.length ?? 0})
                  </h3>
                  <span className="text-[11px] text-[var(--t-faint)]">
                    Ưu tiên điểm sức khỏe cao nhất · Xoay vòng chia tải · Thử khóa model thường tối đa 20s; riêng họ Gemma có thể mất tới ~60s cho phản hồi đầu
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {batchProgress?.running ? (
                  <button
                    type="button"
                    onClick={handleStopBatchCooldownProbe}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-rose-500/50 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Dừng kiểm tra</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRunBatchCooldownProbe}
                    disabled={
                      !canTriggerBatchCooldownProbe(
                        isReadOnly,
                        snapshot?.summary.cooldown ?? 0,
                        Boolean(batchProgress?.running),
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-500/45 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Test lại toàn bộ key đang nguội ({snapshot?.summary.cooldown ?? 0})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Chú thích khi N = 0 hoặc cảnh báo TRƯỚC khi chạy về reset cooldownUntil */}
            <div className="px-4 py-2 border-b border-[var(--t-border)] bg-[var(--t-surface)]/70 text-[11px] text-[var(--t-text2)] flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>
                {(snapshot?.summary.cooldown ?? 0) === 0
                  ? 'Không có khóa nào đang ở trạng thái tạm nghỉ (Cool down) để kiểm tra lại.'
                  : 'Lưu ý trước khi chạy: Khóa probe thất bại sẽ tính lại thời gian nguội từ thời điểm probe (ví dụ QUOTA_PROJECT_ZERO → +6 giờ). Các khóa đã biết cùng GCP Project bị lỗi hạn mức sẽ được nhảy cóc và đồng bộ cooldown theo key đại diện.'}
              </span>
            </div>

            {/* Thanh tiến trình trực tiếp & Bộ đếm 4 nhóm + Bảng tổng kết cuối lượt */}
            {batchProgress && (
              <div className="px-4 py-3 border-b border-[var(--t-border)] bg-[var(--t-bg)]/60 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-[var(--t-text)]">
                    {batchProgress.running
                      ? batchProgress.currentMaskedKey
                        ? `Đang kiểm tra ${Math.min(batchProgress.processed + 1, batchProgress.total)}/${batchProgress.total}: ${batchProgress.currentMaskedKey} (${batchProgress.currentLabel})`
                        : `Đang chuẩn bị nhịp kiểm tra ${batchProgress.processed}/${batchProgress.total}...`
                      : batchProgress.stoppedEarly
                        ? `Đã dừng kiểm tra ở mốc ${batchProgress.processed}/${batchProgress.total} khóa`
                        : `Hoàn tất kiểm tra ${batchProgress.processed}/${batchProgress.total} khóa đang nguội`}
                  </div>
                  <div className="font-mono-tabular text-[11px] text-[var(--t-text2)]">
                    {batchProgress.processed}/{batchProgress.total} khóa ({batchProgress.counts.probedReal} probe thật)
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 rounded-full bg-[var(--t-surface)] border border-[var(--t-border)] overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      batchProgress.running
                        ? 'bg-amber-400'
                        : batchProgress.counts.recovered > 0
                          ? 'bg-emerald-400'
                          : 'bg-sky-400'
                    }`}
                    style={{
                      width: `${
                        batchProgress.total > 0
                          ? Math.round((batchProgress.processed / batchProgress.total) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>

                {/* Live Counters */}
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="px-2 py-1 rounded border border-emerald-500/35 bg-emerald-500/10 text-emerald-300 font-semibold">
                    Hồi phục: {batchProgress.counts.recovered}
                  </span>
                  <span className="px-2 py-1 rounded border border-amber-500/35 bg-amber-500/10 text-amber-300 font-semibold">
                    Còn lỗi (probe thật): {batchProgress.counts.stillFailing}
                  </span>
                  <span className="px-2 py-1 rounded border border-sky-500/35 bg-sky-500/10 text-sky-300 font-semibold">
                    Bỏ qua trùng Project: {batchProgress.counts.skippedSameProject}
                  </span>
                  <span className="px-2 py-1 rounded border border-rose-500/35 bg-rose-500/10 text-rose-300 font-semibold">
                    Vô hiệu: {batchProgress.counts.disabled}
                  </span>
                  {batchProgress.counts.inconclusive > 0 && (
                    <span className="px-2 py-1 rounded border border-yellow-500/35 bg-yellow-500/10 text-yellow-300 font-semibold">
                      Chưa kết luận (timeout): {batchProgress.counts.inconclusive}
                    </span>
                  )}
                  {batchProgress.counts.deferred > 0 && (
                    <span className="px-2 py-1 rounded border border-slate-500/35 bg-slate-500/10 text-slate-300">
                      Chưa thử (đang chờ): {batchProgress.counts.deferred}
                    </span>
                  )}
                  {!batchProgress.running && (
                    <button
                      type="button"
                      onClick={() => setBatchProgress(null)}
                      className="ml-auto text-[11px] text-[var(--t-faint)] hover:text-[var(--t-text)] underline cursor-pointer"
                    >
                      Ẩn báo cáo
                    </button>
                  )}
                </div>

                {/* Chi tiết lỗi theo từng nhóm */}
                {Object.keys(batchProgress.counts.errorsByCategory).length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--t-text2)]">
                    <span className="text-[var(--t-faint)]">Phân loại còn lỗi:</span>
                    {Object.entries(batchProgress.counts.errorsByCategory).map(([cat, count]) => (
                      <span
                        key={cat}
                        className="px-1.5 py-0.5 rounded bg-[var(--t-surface)] border border-[var(--t-border)] font-mono"
                      >
                        {ERROR_LABELS[cat] || cat}: {count}
                      </span>
                    ))}
                  </div>
                )}

                {/* Bảng tổng kết từng key */}
                {batchProgress.results.length > 0 && (
                  <div className="max-h-52 overflow-y-auto rounded-lg border border-[var(--t-border)] bg-[var(--t-surface)] divide-y divide-[var(--t-border)] text-[11px]">
                    {batchProgress.results.map((item) => (
                      <div
                        key={item.id}
                        className="px-3 py-2 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-semibold text-[var(--t-text)]">
                            {item.maskedKey}
                          </span>
                          <span className="text-[var(--t-gold)]">{item.label}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] border ${
                              item.outcome === 'skipped_same_project'
                                ? 'border-sky-500/35 bg-sky-500/10 text-sky-300'
                                : item.outcome === 'deferred_debounce'
                                  ? 'border-slate-500/35 bg-slate-500/10 text-slate-300'
                                  : 'border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)]'
                            }`}
                          >
                            {item.outcome === 'skipped_same_project'
                              ? `Đồng bộ theo key đại diện ${item.representativeMaskedKey || ''}`
                              : item.outcome === 'deferred_debounce'
                                ? 'Chưa thử (đang chờ)'
                                : 'Probe thật'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-right">
                          {item.outcome === 'recovered' ? (
                            <span className="text-emerald-400 font-semibold">
                              Hồi phục (100đ{item.latencyMs ? ` · ${item.latencyMs}ms` : ''})
                            </span>
                          ) : item.outcome === 'disabled' ? (
                            <span className="text-rose-400 font-semibold">
                              Vô hiệu ({ERROR_LABELS[item.errorCategory || 'AUTH_INVALID_KEY'] || item.errorCategory})
                            </span>
                          ) : item.outcome === 'inconclusive' ? (
                            <span className="text-yellow-300 font-semibold">
                              Chưa kết luận (timeout · giữ nguyên trạng thái)
                            </span>
                          ) : item.outcome === 'skipped_same_project' ? (
                            <span className="text-sky-300">
                              Nhảy cóc · {ERROR_LABELS[item.errorCategory || ''] || item.errorCategory} (Project #{item.detectedProjectNumber})
                            </span>
                          ) : item.outcome === 'deferred_debounce' ? (
                            <span className="text-slate-300">Chưa thử (đang chờ hết đệm 5s)</span>
                          ) : (
                            <span className="text-amber-300">
                              Còn lỗi: {ERROR_LABELS[item.errorCategory || 'UNKNOWN'] || item.errorCategory}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!snapshot || snapshot.keys.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--t-faint)]">
                Kho khóa hiện đang trống. Hãy dán một hoặc nhiều Gemini API key ở khung phía trên để bắt đầu.
              </div>
            ) : (
              <div className="divide-y divide-[var(--t-border)]">
                {snapshot.keys.map((key) => {
                  const liveRemainingSec =
                    key.status === 'cooldown' && key.cooldownUntil !== null
                      ? Math.max(0, Math.ceil((key.cooldownUntil - estimatedServerNow) / 1000))
                      : 0;
                  const isDisabled = key.status === 'disabled';
                  const isCooldown = key.status === 'cooldown';

                  return (
                    <div key={key.id} className="p-3.5 sm:p-4 space-y-2.5 text-xs">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        {/* Left: Key identity & status */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-[var(--t-text)]">
                              {key.maskedKey}
                            </span>
                            <span className="font-semibold text-[var(--t-gold)]">{key.label}</span>
                            {key.source === 'env_secret' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                                Secret hệ thống
                              </span>
                            )}
                            {key.status === 'ready' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                <ShieldCheck className="w-3 h-3" />
                                <span>
                                  {key.pendingProbe ? 'Sẵn sàng (chờ thăm dò)' : 'Sẵn sàng'}
                                </span>
                              </span>
                            )}
                            {isCooldown && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono-tabular">
                                <Clock className="w-3 h-3" />
                                <span>Đang nguội · còn {formatDurationSec(liveRemainingSec)}</span>
                              </span>
                            )}
                            {isDisabled && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                <Ban className="w-3 h-3" />
                                <span>Bị vô hiệu</span>
                              </span>
                            )}
                          </div>

                          {key.detectedProjectNumber && (
                            <div className="flex items-center gap-2 flex-wrap text-[11px] text-[var(--t-text2)]">
                              <span>GCP Project: #{key.detectedProjectNumber}</span>
                              {key.sameProjectKeyCount > 1 && (
                                <span className="text-amber-400 font-medium">
                                  (Cảnh báo: {key.sameProjectKeyCount} khóa trong kho đang dùng chung Project này — dùng chung hạn mức Quota)
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(() => {
                            const activeDefaultModel =
                              snapshot?.modelConfig.defaultModel || defaultModel;
                            const activeFallbackModel =
                              snapshot?.modelConfig.fallbackModel || fallbackModel;
                            const isTestingDefault =
                              testingKeyTarget?.id === key.id &&
                              testingKeyTarget?.model === activeDefaultModel;
                            const isTestingFallback =
                              testingKeyTarget?.id === key.id &&
                              testingKeyTarget?.model === activeFallbackModel;
                            const anyTestingThisKey = testingKeyTarget?.id === key.id;
                            return (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleTestKey(key.id, activeDefaultModel)}
                                  disabled={
                                    isReadOnly ||
                                    anyTestingThisKey ||
                                    Boolean(batchProgress?.running)
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-[var(--t-border)] bg-[var(--t-surface)] text-[var(--t-text)] hover:border-[var(--t-gold)] disabled:opacity-40 cursor-pointer"
                                  title={`Kiểm tra thử trên model mặc định ${activeDefaultModel}`}
                                >
                                  <RefreshCw
                                    className={`w-3 h-3 ${isTestingDefault ? 'animate-spin' : ''}`}
                                  />
                                  <span>
                                    {isTestingDefault
                                      ? `Đang thử (${activeDefaultModel})...`
                                      : `Thử (${activeDefaultModel})`}
                                  </span>
                                </button>

                                {activeFallbackModel &&
                                  activeFallbackModel !== activeDefaultModel && (
                                    <button
                                      type="button"
                                      onClick={() => handleTestKey(key.id, activeFallbackModel)}
                                      disabled={
                                        isReadOnly ||
                                        anyTestingThisKey ||
                                        Boolean(batchProgress?.running)
                                      }
                                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)] hover:text-[var(--t-gold)] hover:border-[var(--t-gold)] disabled:opacity-40 cursor-pointer"
                                      title={`Kiểm tra thử trên model dự phòng ${activeFallbackModel} (không thay đổi trạng thái chung của khóa)`}
                                    >
                                      <RefreshCw
                                        className={`w-3 h-3 ${isTestingFallback ? 'animate-spin' : ''}`}
                                      />
                                      <span>
                                        {isTestingFallback
                                          ? `Đang thử (${activeFallbackModel})...`
                                          : `Thử dự phòng (${activeFallbackModel})`}
                                      </span>
                                    </button>
                                  )}
                              </>
                            );
                          })()}

                          {(isCooldown || isDisabled) && (
                            <button
                              type="button"
                              onClick={() => handleReactivateKey(key.id)}
                              disabled={isReadOnly}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 cursor-pointer"
                            >
                              <ShieldCheck className="w-3 h-3" />
                              <span>Kích hoạt lại</span>
                            </button>
                          )}

                          {confirmDeleteId === key.id ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDeleteKey(key.id)}
                                disabled={isReadOnly}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-rose-600 text-white cursor-pointer"
                              >
                                Xác nhận xóa
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1.5 rounded-lg text-[11px] border border-[var(--t-border)] text-[var(--t-text2)] cursor-pointer"
                              >
                                Hủy
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(key.id)}
                              disabled={isReadOnly}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 disabled:opacity-40 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Xóa</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Metrics Row */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] bg-[var(--t-surface)] rounded-lg p-2.5 border border-[var(--t-border)]">
                        <div className="space-y-1">
                          <div className="text-[var(--t-faint)]">Điểm sức khỏe</div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-[var(--t-bg)] overflow-hidden">
                              <div
                                className={`h-full ${
                                  key.healthScore >= 75
                                    ? 'bg-emerald-400'
                                    : key.healthScore >= 40
                                      ? 'bg-amber-400'
                                      : 'bg-rose-400'
                                }`}
                                style={{ width: `${key.healthScore}%` }}
                              />
                            </div>
                            <span className="font-mono-tabular font-bold">{key.healthScore}</span>
                          </div>
                        </div>

                        <div>
                          <div className="text-[var(--t-faint)]">Lượt gọi (OK / Lỗi)</div>
                          <div className="font-mono-tabular font-semibold text-[var(--t-text)]">
                            {key.stats.totalCalls}{' '}
                            <span className="text-emerald-400">({key.stats.successCalls}</span> /{' '}
                            <span className="text-rose-400">{key.stats.errorCalls})</span>
                          </div>
                        </div>

                        <div>
                          <div className="text-[var(--t-faint)]">Độ trễ TB (TTFB)</div>
                          <div className="font-mono-tabular font-semibold text-[var(--t-text)]">
                            {key.stats.avgLatencyMs !== null ? `${key.stats.avgLatencyMs} ms` : '—'}
                            {key.stats.lastTestLatencyMs !== null && (
                              <span className="text-[10px] text-[var(--t-faint)] ml-1">
                                (Test: {key.stats.lastTestLatencyMs}ms)
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="text-[var(--t-faint)]">Dùng gần nhất</div>
                          <div className="text-[var(--t-text2)]">
                            {formatTimeAgo(key.stats.lastUsedAt, estimatedServerNow)}
                          </div>
                        </div>

                        <div>
                          <div className="text-[var(--t-faint)]">Lỗi gần nhất</div>
                          <div
                            className={`truncate font-medium ${
                              key.stats.lastErrorType !== 'NONE'
                                ? 'text-amber-300'
                                : 'text-[var(--t-faint)]'
                            }`}
                            title={key.stats.lastErrorMessage || undefined}
                          >
                            {ERROR_LABELS[key.stats.lastErrorType] || key.stats.lastErrorType}
                          </div>
                        </div>
                      </div>

                      {key.stats.lastErrorMessage && (
                        <div className="text-[11px] font-mono text-[var(--t-faint)] break-words">
                          Chi tiết lỗi gần nhất: {key.stats.lastErrorMessage}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Audit Logs Toggle */}
          {snapshot && snapshot.recentLogs.length > 0 && (
            <div className="rounded-xl border border-[var(--t-border)] bg-[var(--t-card)] overflow-hidden">
              <button
                type="button"
                onClick={() => setShowLogs((v) => !v)}
                className="w-full px-4 py-2.5 text-left text-xs font-semibold text-[var(--t-text2)] hover:text-[var(--t-gold)] flex items-center justify-between cursor-pointer"
              >
                <span>Nhật ký chuyển trạng thái Kho Khóa ({snapshot.recentLogs.length} sự kiện gần nhất)</span>
                <span>{showLogs ? 'Thu gọn' : 'Xem chi tiết'}</span>
              </button>
              {showLogs && (
                <div className="max-h-48 overflow-y-auto px-4 pb-3 space-y-1 text-[11px] font-mono text-[var(--t-text2)] border-t border-[var(--t-border)] pt-2">
                  {snapshot.recentLogs.map((log, i) => (
                    <div key={i} className="break-words">
                      <span className="text-[var(--t-faint)]">
                        {new Date(log.timestamp).toLocaleTimeString('vi-VN')}
                      </span>{' '}
                      · <span className="text-[var(--t-gold)]">{log.maskedKey}</span> ·{' '}
                      <span>
                        {log.fromStatus} → {log.toStatus}
                      </span>{' '}
                      · <span className="text-[var(--t-text)]">{log.reason}</span>
                      {log.cooldownSeconds !== undefined && ` (${log.cooldownSeconds}s)`}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
