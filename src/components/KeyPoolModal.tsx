import React, { useState, useEffect, useCallback, useRef } from 'react';
import { resolveNextModelSelection } from '../lib/key-pool-ui';
import {
  X,
  KeyRound,
  Plus,
  Trash2,
  RefreshCw,
  Activity,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Ban,
  Lock,
  Unlock,
  Server,
  Sparkles,
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
  AUTH_INVALID_KEY: 'Key không hợp lệ (401/403)',
  NETWORK_OR_5XX: 'Lỗi mạng / Máy chủ (5xx)',
  MODEL_UNAVAILABLE: 'Model không khả dụng',
  UNKNOWN: 'Lỗi khác',
};

export default function KeyPoolModal({ open, onClose, onPoolUpdated }: KeyPoolModalProps) {
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
  const [fallbackModel, setFallbackModel] = useState('gemini-3.8-flash');
  const [customModelInput, setCustomModelInput] = useState('');
  const [savingModels, setSavingModels] = useState(false);

  // Row operations & feedback
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showLogs, setShowLogs] = useState(false);

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

  const fetchSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/key-pool', {
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

  useEffect(() => {
    if (!open) return;
    modelDirtyRef.current = false;
    fetchSnapshot();
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [open, fetchSnapshot]);

  if (!open) return null;

  const estimatedServerNow = nowTick + serverClockOffsetMs;
  const isReadOnly = snapshot?.isReadOnly ?? false;

  const handleUnlockWithPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pinInput.trim();
    if (!clean) return;
    try {
      const res = await fetch('/api/key-pool', {
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

  const handleTestKey = async (id: string) => {
    setTestingKeyId(id);
    setNotice(null);
    try {
      const res = await fetch(`/api/key-pool/${encodeURIComponent(id)}/test`, {
        method: 'POST',
        headers: authHeaders(),
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
          text: `Khóa hoạt động tốt trên ${data.modelUsed} (độ trễ kiểm tra: ${data.latencyMs}ms).`,
        });
      } else {
        setNotice({
          type: 'err',
          text: `Khóa gặp lỗi [${ERROR_LABELS[data.errorCategory] || data.errorCategory}]: ${data.sanitizedMessage}`,
        });
      }
    } catch {
      setNotice({ type: 'err', text: 'Lỗi kết nối khi kiểm tra thử khóa.' });
    } finally {
      setTestingKeyId(null);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-sm">
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
              onClick={onClose}
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
              Dán một hoặc nhiều Gemini API key cùng lúc. Hệ thống tự tách theo dấu phẩy (<code>,</code>), khoảng trắng, tab, chấm phẩy (<code>;</code>), mỗi key một hàng, dòng <code>.env</code>, nhãn <code>Ten: AIza...</code> hoặc JSON. Khóa chỉ lưu ở máy chủ và luôn hiển thị dạng che sau khi lưu.
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

          {/* Section 3: Keys Dashboard Table */}
          <div className="rounded-xl border border-[var(--t-border)] bg-[var(--t-card)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--t-border)] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[var(--t-gold)]" />
                <h3 className="text-xs sm:text-sm font-bold text-[var(--t-text)]">
                  Bảng Theo Dõi Sức Khỏe Từng Khóa ({snapshot?.keys.length ?? 0})
                </h3>
              </div>
              <span className="text-[11px] text-[var(--t-faint)]">
                Ưu tiên điểm sức khỏe cao nhất · Xoay vòng chia tải
              </span>
            </div>

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
                          <button
                            type="button"
                            onClick={() => handleTestKey(key.id)}
                            disabled={isReadOnly || testingKeyId === key.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-[var(--t-border)] bg-[var(--t-surface)] text-[var(--t-text)] hover:border-[var(--t-gold)] disabled:opacity-40 cursor-pointer"
                          >
                            <RefreshCw
                              className={`w-3 h-3 ${testingKeyId === key.id ? 'animate-spin' : ''}`}
                            />
                            <span>
                              {testingKeyId === key.id ? 'Đang thử...' : 'Kiểm tra thử'}
                            </span>
                          </button>

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
