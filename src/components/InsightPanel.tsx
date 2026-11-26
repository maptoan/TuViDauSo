import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ZiweiChart, Palace } from '../lib/ziwei/types';
import {
  VI_BRANCHES,
  VI_STEMS,
  formatChartSummaryVi,
  translatePalaceName,
  translateStarName,
  translateSiHua,
  generateLocalInterpretationVi,
} from '../lib/ziwei/vi-i18n';
import {
  buildYunxianPeriodContext,
  YunxianPeriodContext,
} from '../lib/ziwei/yunxian-context';
import {
  sanitizeAiVietnameseOutput,
  scrubInvalidCitationTags,
  verifyAndEnsureCompletePeriodSiHua,
} from '../lib/ziwei/text-sanitizer';
import {
  hasValidCachedPeriodEntry,
  shouldShowCompletedContinuationBadge,
  shouldShowInterruptedContinuationBadge,
} from '../lib/key-pool-ui';
import {
  APP_VERSION,
  classifyDossierFailure,
  formatReauditTimestampVi,
  normalizeKnownBareCitationTags,
  type AiExecutionMeta,
  type AiPeriodEntry,
  type ContextualChatContextPayload,
  type DeterministicRepairRecord,
  type Kp3AuditFlag,
} from '../lib/dossier-chat-ui';
import type { ActiveSihua } from './TimeNav';
import MarkdownContent from './MarkdownContent';
import {
  Sparkles,
  Send,
  RefreshCw,
  Compass,
  MessageSquare,
  MessageSquareText,
  Layers,
  AlertTriangle,
  Bot,
  CheckCircle2,
  KeyRound,
  BookOpen,
  ShieldCheck,
} from 'lucide-react';

const TOPICS = [
  { key: 'overall', label: 'Tổng Quan Mệnh Cách', icon: '☯', promptHint: 'Tổng quan mệnh cục' },
  { key: 'career', label: 'Sự Nghiệp & Quan Lộc', icon: '🏛', promptHint: 'sự nghiệp Quan Lộc' },
  { key: 'wealth', label: 'Tài Bạch & Cơ Nghiệp', icon: '🪙', promptHint: 'tài lộc Tài Bạch' },
  { key: 'love', label: 'Tình Duyên & Gia Đạo', icon: '🌸', promptHint: 'tình duyên Phu Thê' },
  { key: 'health', label: 'Sức Khỏe & Tật Ách', icon: '🌿', promptHint: 'sức khỏe Tật Ách' },
  { key: 'character', label: 'Tính Cách & Thiên Hướng', icon: '📜', promptHint: 'tính cách Phúc Đức' },
] as const;

type TopicKey = (typeof TOPICS)[number]['key'];

interface InsightPanelProps {
  chart: ZiweiChart;
  activeSihua: ActiveSihua;
  selectedPalace: Palace | null;
  selectedMutagen?: { starName: string; mutagen: string; palaceName: string } | null;
  externalAiRequestTick?: number;
  onAiLoadingChange?: (loading: boolean) => void;
  onOpenKeyPool?: () => void;
  aiPeriodCache?: Record<string, AiPeriodEntry>;
  onAiPeriodCacheChange?: React.Dispatch<React.SetStateAction<Record<string, AiPeriodEntry>>>;
  onOpenDossierModal?: () => void;
  onOpenContextualChat?: (context: ContextualChatContextPayload) => void;
}

export default function InsightPanel({
  chart,
  activeSihua,
  selectedPalace,
  selectedMutagen,
  externalAiRequestTick = 0,
  onAiLoadingChange,
  onOpenKeyPool,
  aiPeriodCache: propAiPeriodCache,
  onAiPeriodCacheChange: propOnAiPeriodCacheChange,
  onOpenDossierModal,
  onOpenContextualChat,
}: InsightPanelProps) {
  const [activeTopic, setActiveTopic] = useState<TopicKey>('overall');
  const [cache, setCache] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState('');
  const [qaList, setQaList] = useState<{ q: string; a: string }[]>([]);
  const [qaLoading, setQaLoading] = useState(false);

  // Bộ nhớ đệm kết quả AI theo (lá số + loại kỳ + kỳ): periodContext.cacheKey (đồng bộ 2 chiều với Hồ Sơ 8 Chương nếu được truyền từ App)
  const [localAiPeriodCache, setLocalAiPeriodCache] = useState<Record<string, AiPeriodEntry>>({});
  const aiPeriodCache = propAiPeriodCache ?? localAiPeriodCache;
  const setAiPeriodCache = propOnAiPeriodCacheChange ?? setLocalAiPeriodCache;
  const [incompleteTopicKeys, setIncompleteTopicKeys] = useState<Record<string, boolean>>({});
  const [aiPeriodLoading, setAiPeriodLoading] = useState(false);
  const [aiRetryingNoticeVi, setAiRetryingNoticeVi] = useState<string | null>(null);
  const [aiPeriodReauditing, setAiPeriodReauditing] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const aiPeriodAbortRef = useRef<AbortController | null>(null);
  const aiSectionRef = useRef<HTMLDivElement | null>(null);
  const periodReauditInFlightRef = useRef<Set<string>>(new Set());
  const periodAutoReauditAttemptedRef = useRef<Set<string>>(new Set());
  const currentPeriodCacheKeyRef = useRef<string>('');

  // Tầng khung xác định (Deterministic Layer) — tính ngay lập tức từ yunxian-context.ts + engine
  const periodContext: YunxianPeriodContext | null = useMemo(
    () =>
      buildYunxianPeriodContext(chart, {
        mode: activeSihua.mode,
        daXianIndex: activeSihua.daXianIndex,
        activeBranch: activeSihua.activeBranch,
        mingBranch: activeSihua.mingBranch,
        year: activeSihua.year,
      }),
    [chart, activeSihua]
  );
  currentPeriodCacheKeyRef.current = periodContext?.cacheKey ?? '';

  useEffect(() => {
    setCache({});
    setQaList([]);
  }, [chart]);

  const setAiLoadingState = useCallback(
    (isLoading: boolean) => {
      setAiPeriodLoading(isLoading);
      onAiLoadingChange?.(isLoading);
    },
    [onAiLoadingChange]
  );

  const getFallbackText = useCallback(
    (topic: string, customQuestion?: string) => {
      const topicObj = TOPICS.find((t) => t.key === topic);
      const hint = customQuestion || topicObj?.promptHint || topic;
      return generateLocalInterpretationVi(chart, hint, periodContext);
    },
    [chart, periodContext]
  );

  // Gọi AI diễn giải riêng cho kỳ hạn đang chọn (Đại Hạn hoặc Lưu Niên)
  const requestPeriodAiInterpretation = useCallback(
    async (forceRefresh = false) => {
      if (!periodContext) return;
      const pKey = periodContext.cacheKey;

      // Nếu đã có kết quả AI hoàn chỉnh trong bộ nhớ đệm và không ép làm mới -> dùng ngay cache
      if (!forceRefresh && hasValidCachedPeriodEntry(aiPeriodCache[pKey])) {
        aiSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }

      aiPeriodAbortRef.current?.abort();
      const controller = new AbortController();
      aiPeriodAbortRef.current = controller;

      setAiLoadingState(true);
      setAiRetryingNoticeVi(null);
      setAiPeriodCache((prev) => {
        const next = { ...prev };
        delete next[pKey];
        return next;
      });

      try {
        const res = await fetch('/api/interpret-period', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chart, periodContext }),
          signal: controller.signal,
        });

        if (!res.ok) {
          let errJson: {
            error?: string;
            errorCategory?: string;
            minRemainingCooldownSec?: number | null;
            message?: string;
          } | null = null;
          try {
            errJson = await res.json();
          } catch {
            // ignore JSON parse error
          }
          const failure = classifyDossierFailure({
            httpStatus: res.status,
            error: errJson?.error,
            errorCategory: errJson?.errorCategory,
            minRemainingCooldownSec: errJson?.minRemainingCooldownSec ?? null,
            message:
              errJson?.message ||
              'Chưa thể kết nối dịch vụ AI cho kỳ hạn này. Hệ thống giữ nguyên Khung dữ kiện xác định ở trên.',
          });
          setAiPeriodCache((prev) => ({
            ...prev,
            [pKey]: {
              notConfigured: failure.notConfigured,
              errorCode: failure.errorCode,
              errorCategory: failure.errorCategory,
              minRemainingCooldownSec: failure.minRemainingCooldownSec,
              error: failure.userMessageVi,
            },
          }));
          return;
        }

        if (!res.body) {
          setAiPeriodCache((prev) => ({
            ...prev,
            [pKey]: {
              notConfigured: false,
              errorCode: 'AI_CALL_FAILED',
              errorCategory: 'NETWORK_OR_5XX',
              error: 'Không nhận được luồng phản hồi từ máy chủ.',
            },
          }));
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '';
        let accumulated = '';
        let receivedMeta: AiExecutionMeta | undefined;
        let streamError: string | null = null;
        let streamErrorCode: string | null = null;
        let streamErrorCategory: string | null = null;
        let streamCooldownSec: number | null = null;
        let wasInterrupted = false;
        let interruptedMsg = '';
        let interruptedCategory: string | null = null;
        let interruptedCooldownSec: number | null = null;
        let scrubbedInvalidIds: string[] = [];
        let normalizedBareIds: string[] = [];
        let receivedAuditFlags: Kp3AuditFlag[] = [];
        let receivedDeterministicRepairs: DeterministicRepairRecord[] = [];

        const parseRepairRecords = (raw: unknown): DeterministicRepairRecord[] =>
          Array.isArray(raw)
            ? raw.filter(
                (r): r is DeterministicRepairRecord =>
                  Boolean(r) &&
                  typeof r === 'object' &&
                  typeof (r as DeterministicRepairRecord).code === 'string' &&
                  typeof (r as DeterministicRepairRecord).beforeSentence === 'string' &&
                  typeof (r as DeterministicRepairRecord).afterSentence === 'string',
              )
            : [];

        const processLine = (line: string) => {
          if (!line.startsWith('data: ')) return false;
          const data = line.slice(6).trim();
          if (data === '[DONE]') return true;
          try {
            const parsed = JSON.parse(data);
            if (
              typeof parsed?.retryingForCitations === 'boolean' ||
              typeof parsed?.retryingForFlags === 'boolean'
            ) {
              const isRetrying = Boolean(
                parsed?.retryingForCitations || parsed?.retryingForFlags,
              );
              setAiRetryingNoticeVi(
                isRetrying
                  ? typeof parsed.message === 'string' && parsed.message
                    ? parsed.message
                    : parsed?.retryingForFlags
                      ? 'Đang sinh lại để sửa lỗi nghiêm trọng theo dữ kiện lá số...'
                      : 'Đang sinh lại 1 lần để bổ sung trích dẫn học thuật...'
                  : null,
              );
              if (typeof parsed?.replaceChapterText !== 'string') {
                return false;
              }
            }
            if (typeof parsed?.replaceChapterText === 'string') {
              accumulated = sanitizeAiVietnameseOutput(parsed.replaceChapterText);
              if (parsed.meta) {
                receivedMeta = parsed.meta as AiExecutionMeta;
              }
              if (Array.isArray(parsed.deterministicRepairs)) {
                receivedDeterministicRepairs = parseRepairRecords(
                  parsed.deterministicRepairs,
                );
              }
              setAiRetryingNoticeVi(null);
              setAiPeriodCache((prev) => ({
                ...prev,
                [pKey]: {
                  text: accumulated,
                  meta: receivedMeta,
                  ...(receivedDeterministicRepairs.length > 0
                    ? { deterministicRepairs: receivedDeterministicRepairs }
                    : {}),
                },
              }));
              return false;
            }
            if (parsed?.meta) {
              receivedMeta = parsed.meta as AiExecutionMeta;
              setAiPeriodCache((prev) => ({
                ...prev,
                [pKey]: {
                  ...(prev[pKey] || {}),
                  meta: receivedMeta,
                },
              }));
              return false;
            }
            if (parsed?.citationAudit) {
              if (Array.isArray(parsed.citationAudit.scrubbedInvalidIds)) {
                scrubbedInvalidIds = parsed.citationAudit.scrubbedInvalidIds.filter(
                  (id: unknown): id is string => typeof id === 'string',
                );
              }
              if (Array.isArray(parsed.citationAudit.normalizedBareIds)) {
                normalizedBareIds = parsed.citationAudit.normalizedBareIds.filter(
                  (id: unknown): id is string => typeof id === 'string',
                );
              }
              if (Array.isArray(parsed.citationAudit.auditFlags)) {
                receivedAuditFlags = parsed.citationAudit.auditFlags.filter(
                  (f: unknown): f is Kp3AuditFlag =>
                    Boolean(f) &&
                    typeof f === 'object' &&
                    typeof (f as Kp3AuditFlag).code === 'string' &&
                    typeof (f as Kp3AuditFlag).messageVi === 'string',
                );
              }
              if (
                Array.isArray(parsed.citationAudit.deterministicRepairs) &&
                parsed.citationAudit.deterministicRepairs.length > 0
              ) {
                receivedDeterministicRepairs = parseRepairRecords(
                  parsed.citationAudit.deterministicRepairs,
                );
              }
              return false;
            }
            if (parsed?.interrupted) {
              wasInterrupted = true;
              interruptedMsg =
                parsed.message || 'Luồng kết nối Gemini bị gián đoạn giữa chừng.';
              if (typeof parsed.errorCategory === 'string') {
                interruptedCategory = parsed.errorCategory;
              }
              if (typeof parsed.minRemainingCooldownSec === 'number') {
                interruptedCooldownSec = parsed.minRemainingCooldownSec;
              }
              return false;
            }
            if (parsed?.error) {
              streamError = parsed.message || 'Lời gọi Gemini API gặp lỗi.';
              if (typeof parsed.error === 'string') {
                streamErrorCode = parsed.error;
              }
              if (typeof parsed.errorCategory === 'string') {
                streamErrorCategory = parsed.errorCategory;
              }
              if (typeof parsed.minRemainingCooldownSec === 'number') {
                streamCooldownSec = parsed.minRemainingCooldownSec;
              }
              return false;
            }
            const text = parsed?.delta?.text ?? '';
            if (text) {
              accumulated = sanitizeAiVietnameseOutput(accumulated + text);
              setAiPeriodCache((prev) => ({
                ...prev,
                [pKey]: {
                  text: accumulated,
                  meta: receivedMeta,
                },
              }));
            }
          } catch {
            // ignore partial JSON
          }
          return false;
        };

        let doneSignal = false;
        while (!doneSignal) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split('\n');
          sseBuffer = lines.pop() ?? '';
          for (const line of lines) {
            if (processLine(line)) {
              doneSignal = true;
              break;
            }
          }
        }
        if (!doneSignal && sseBuffer.trim()) {
          processLine(sseBuffer.trim());
        }

        // Chốt lớp 2 (idempotent): sanitizeAiVietnameseOutput -> Z3 normalizeKnownBareCitationTags -> scrubInvalidCitationTags -> verifyAndEnsureCompletePeriodSiHua trước khi ghi cache/state
        accumulated = sanitizeAiVietnameseOutput(accumulated);
        if (normalizedBareIds.length > 0 && accumulated) {
          accumulated = normalizeKnownBareCitationTags(accumulated, normalizedBareIds);
        }
        if (scrubbedInvalidIds.length > 0 && accumulated) {
          accumulated = scrubInvalidCitationTags(accumulated, {
            invalidIds: scrubbedInvalidIds,
          });
        }
        if (!wasInterrupted && !streamError && accumulated.trim()) {
          accumulated = verifyAndEnsureCompletePeriodSiHua(
            accumulated,
            periodContext,
          ).patchedText;
        }

        const persistedAuditFlags = receivedAuditFlags;

        if (wasInterrupted) {
          const failure = classifyDossierFailure({
            error: streamErrorCode,
            errorCategory: streamErrorCategory ?? interruptedCategory,
            minRemainingCooldownSec: streamCooldownSec ?? interruptedCooldownSec,
            message: interruptedMsg || streamError,
            interrupted: true,
          });
          setAiPeriodCache((prev) => ({
            ...prev,
            [pKey]: {
              notConfigured: failure.notConfigured,
              incomplete: true,
              incompleteText: accumulated.trim() ? accumulated : undefined,
              interruptedReason: failure.userMessageVi,
              errorCode: failure.errorCode,
              errorCategory: failure.errorCategory,
              minRemainingCooldownSec: failure.minRemainingCooldownSec,
              meta: receivedMeta ? { ...receivedMeta, interrupted: true } : undefined,
              error: failure.userMessageVi,
              auditFlags: persistedAuditFlags,
              ...(receivedDeterministicRepairs.length > 0
                ? { deterministicRepairs: receivedDeterministicRepairs }
                : {}),
            },
          }));
        } else if (streamError) {
          const failure = classifyDossierFailure({
            error: streamErrorCode,
            errorCategory: streamErrorCategory,
            minRemainingCooldownSec: streamCooldownSec,
            message: streamError,
          });
          setAiPeriodCache((prev) => ({
            ...prev,
            [pKey]: {
              notConfigured: failure.notConfigured,
              incomplete: Boolean(accumulated.trim()),
              incompleteText: accumulated.trim() ? accumulated : undefined,
              errorCode: failure.errorCode,
              errorCategory: failure.errorCategory,
              minRemainingCooldownSec: failure.minRemainingCooldownSec,
              meta: receivedMeta ? { ...receivedMeta, interrupted: true } : undefined,
              error: failure.userMessageVi,
              auditFlags: persistedAuditFlags,
              ...(receivedDeterministicRepairs.length > 0
                ? { deterministicRepairs: receivedDeterministicRepairs }
                : {}),
            },
          }));
        } else if (!accumulated.trim()) {
          setAiPeriodCache((prev) => ({
            ...prev,
            [pKey]: {
              notConfigured: false,
              errorCode: 'AI_CALL_FAILED',
              errorCategory: 'NETWORK_OR_5XX',
              error:
                'Phản hồi từ Gemini API trống. Hệ thống chỉ hiển thị Khung dữ kiện xác định.',
            },
          }));
        } else {
          setAiPeriodCache((prev) => ({
            ...prev,
            [pKey]: {
              text: accumulated,
              meta: receivedMeta,
              auditFlags: persistedAuditFlags,
              ...(receivedDeterministicRepairs.length > 0
                ? { deterministicRepairs: receivedDeterministicRepairs }
                : {}),
              reauditedForVersion: APP_VERSION,
              reauditedAt: Date.now(),
            },
          }));
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setAiPeriodCache((prev) => ({
            ...prev,
            [pKey]: {
              notConfigured: false,
              errorCode: 'AI_CALL_FAILED',
              errorCategory: 'NETWORK_OR_5XX',
              error:
                'Không thể kết nối tới dịch vụ AI. Hệ thống chỉ hiển thị Khung dữ kiện xác định.',
            },
          }));
        }
      } finally {
        setAiRetryingNoticeVi(null);
        setAiLoadingState(false);
      }
    },
    [chart, periodContext, aiPeriodCache, setAiPeriodCache, setAiLoadingState]
  );

  const handleReauditPeriodEntry = useCallback(
    async (entry: AiPeriodEntry, forceManual = false) => {
      if (!periodContext) return;
      const targetText = entry.text?.trim() ? entry.text : entry.incompleteText;
      if (!targetText?.trim()) return;
      if (!forceManual && entry.reauditedForVersion === APP_VERSION) return;

      const pKey = periodContext.cacheKey;
      const inflightKey = `${pKey}::${APP_VERSION}`;
      if (periodReauditInFlightRef.current.has(inflightKey)) return;

      periodReauditInFlightRef.current.add(inflightKey);
      setAiPeriodReauditing(true);
      try {
        const res = await fetch('/api/audit-dossier-section', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chart,
            periodContext,
            text: targetText,
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          auditFlags?: Kp3AuditFlag[];
          reauditedForVersion?: string;
          reauditedAt?: number;
        };
        const nextFlags: Kp3AuditFlag[] = Array.isArray(data.auditFlags)
          ? data.auditFlags.filter(
              (f): f is Kp3AuditFlag =>
                Boolean(f) &&
                typeof f === 'object' &&
                typeof f.code === 'string' &&
                typeof f.messageVi === 'string',
            )
          : [];
        const nextVersion =
          typeof data.reauditedForVersion === 'string' && data.reauditedForVersion
            ? data.reauditedForVersion
            : APP_VERSION;
        const nextAt =
          typeof data.reauditedAt === 'number' && Number.isFinite(data.reauditedAt)
            ? data.reauditedAt
            : Date.now();

        setAiPeriodCache((prev) => {
          const existing = prev[pKey];
          if (!existing) return prev;
          return {
            ...prev,
            [pKey]: {
              ...existing,
              auditFlags: nextFlags,
              reauditedForVersion: nextVersion,
              reauditedAt: nextAt,
            },
          };
        });
      } catch {
        // Bỏ qua lỗi mạng khi kiểm chứng lại âm thầm
      } finally {
        periodReauditInFlightRef.current.delete(inflightKey);
        setAiPeriodReauditing(false);
      }
    },
    [chart, periodContext, setAiPeriodCache]
  );

  // B4: Tự động kiểm chứng lại đúng 1 lần theo APP_VERSION cho kỳ hạn đang mở (nếu lưu đệm ở bản cũ)
  useEffect(() => {
    if (!periodContext || aiPeriodLoading) return;
    const entry = aiPeriodCache[periodContext.cacheKey];
    if (!hasValidCachedPeriodEntry(entry)) return;
    if (entry.reauditedForVersion === APP_VERSION) return;

    const attemptKey = `${periodContext.cacheKey}::${APP_VERSION}`;
    if (
      periodAutoReauditAttemptedRef.current.has(attemptKey) ||
      periodReauditInFlightRef.current.has(attemptKey)
    ) {
      return;
    }
    periodAutoReauditAttemptedRef.current.add(attemptKey);
    void handleReauditPeriodEntry(entry, false);
  }, [periodContext, aiPeriodLoading, aiPeriodCache, handleReauditPeriodEntry]);

  // Nhận tín hiệu bấm nút "Luận giải AI cho kỳ này" từ thanh TimeNav
  useEffect(() => {
    if (externalAiRequestTick > 0 && periodContext) {
      aiSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      requestPeriodAiInterpretation(false);
    }
  }, [externalAiRequestTick]);

  const fetchInsight = async (
    cacheKey: string,
    topic: string,
    customQuestion?: string
  ) => {
    if (cache[cacheKey] && !incompleteTopicKeys[cacheKey] && !customQuestion) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setIncompleteTopicKeys((prev) => {
      if (!prev[cacheKey]) return prev;
      const next = { ...prev };
      delete next[cacheKey];
      return next;
    });

    try {
      const res = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chart, topic, question: customQuestion }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const localFallback = getFallbackText(topic, customQuestion);
        setCache((prev) => ({ ...prev, [cacheKey]: localFallback }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';
      let accumulated = '';
      let wasInterrupted = false;

      const handleLine = (line: string) => {
        if (!line.startsWith('data: ')) return false;
        const data = line.slice(6).trim();
        if (data === '[DONE]') return true;
        try {
          const parsed = JSON.parse(data);
          if (parsed?.interrupted) {
            wasInterrupted = true;
            return false;
          }
          const text = parsed?.delta?.text ?? '';
          if (text) {
            accumulated = sanitizeAiVietnameseOutput(accumulated + text);
            setCache((prev) => ({ ...prev, [cacheKey]: accumulated }));
          }
        } catch {
          // ignore partial JSON
        }
        return false;
      };

      let doneSignal = false;
      while (!doneSignal) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() ?? '';
        for (const line of lines) {
          if (handleLine(line)) {
            doneSignal = true;
            break;
          }
        }
      }
      if (!doneSignal && sseBuffer.trim()) {
        handleLine(sseBuffer.trim());
      }

      accumulated = sanitizeAiVietnameseOutput(accumulated);

      if (wasInterrupted) {
        setIncompleteTopicKeys((prev) => ({ ...prev, [cacheKey]: true }));
        setCache((prev) => ({
          ...prev,
          [cacheKey]: `${accumulated}\n\n> *Lưu ý: Luồng phản hồi AI bị gián đoạn giữa chừng (chưa lưu bộ nhớ đệm hoàn chỉnh). Bấm "Làm mới" hoặc chọn lại cung để tải lại.*`,
        }));
      } else if (!accumulated.trim()) {
        const localFallback = getFallbackText(topic, customQuestion);
        setCache((prev) => ({ ...prev, [cacheKey]: localFallback }));
      } else {
        setCache((prev) => ({ ...prev, [cacheKey]: accumulated }));
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const localFallback = getFallbackText(topic, customQuestion);
        setCache((prev) => ({ ...prev, [cacheKey]: localFallback }));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPalace) {
      const key = `palace_${selectedPalace.name}_${periodContext?.periodId ?? 'natal'}`;
      const localText = getFallbackText('overall');
      setCache((prev) => ({ ...prev, [key]: localText }));
      const viPalace = translatePalaceName(selectedPalace.name);
      const majorStars = selectedPalace.stars.filter((s) => s.type === 'major');
      const stars =
        majorStars.map((s) => translateStarName(s.name)).join(', ') || 'Vô chính diệu';
      fetchInsight(
        key,
        'overall',
        `Hãy luận giải chuyên sâu về ${viPalace} (tọa tại chi ${VI_BRANCHES[selectedPalace.branch]}, có chính tinh: ${stars}) theo phương pháp Tam Phương Tứ Chính và tâm pháp Thiên Kỷ của Nghê Hải Hạ.`
      );
    }
  }, [selectedPalace, periodContext?.periodId]);

  useEffect(() => {
    if (!selectedMutagen) return;
    const { starName, mutagen, palaceName } = selectedMutagen;
    const key = `mutagen_${starName}_${mutagen}_${palaceName}`;
    const viStar = translateStarName(starName);
    const viMut = translateSiHua(mutagen);
    const viPal = translatePalaceName(palaceName);
    fetchInsight(
      key,
      'overall',
      `Hãy luận giải ý nghĩa sao ${viStar} Hóa ${viMut} tại ${viPal} trong lá số này: cơ hội, thách thức và lời khuyên hành động thực tế.`
    );
  }, [selectedMutagen]);

  const periodSuffix = periodContext ? `__${periodContext.periodId}` : '__natal';

  const handleTopicClick = (key: TopicKey) => {
    setActiveTopic(key);
    const topicCacheKey = `${key}${periodSuffix}`;
    if (!cache[topicCacheKey]) {
      setCache((prev) => ({
        ...prev,
        [topicCacheKey]: getFallbackText(key),
      }));
    }
  };

  useEffect(() => {
    const topicCacheKey = `${activeTopic}${periodSuffix}`;
    setCache((prev) => ({
      ...prev,
      [topicCacheKey]: getFallbackText(activeTopic),
    }));
  }, [chart, activeTopic, periodSuffix, getFallbackText]);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || qaLoading) return;
    const q = question.trim();
    setQuestion('');
    setQaLoading(true);
    const idx = qaList.length;
    setQaList((prev) => [...prev, { q, a: '' }]);

    try {
      const res = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chart, topic: 'overall', question: q }),
      });

      if (!res.ok || !res.body) {
        const fallback = generateLocalInterpretationVi(chart, q, periodContext);
        setQaList((prev) =>
          prev.map((item, i) => (i === idx ? { q, a: fallback } : item))
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';
      let acc = '';
      let wasInterrupted = false;
      const handleAskLine = (line: string) => {
        if (!line.startsWith('data: ')) return false;
        const data = line.slice(6).trim();
        if (data === '[DONE]') return true;
        try {
          const parsed = JSON.parse(data);
          if (parsed?.interrupted) {
            wasInterrupted = true;
            return false;
          }
          const text = parsed?.delta?.text ?? '';
          if (text) {
            acc = sanitizeAiVietnameseOutput(acc + text);
            setQaList((prev) =>
              prev.map((item, i) => (i === idx ? { q, a: acc } : item))
            );
          }
        } catch {
          // ignore
        }
        return false;
      };

      let doneSignal = false;
      while (!doneSignal) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() ?? '';
        for (const line of lines) {
          if (handleAskLine(line)) {
            doneSignal = true;
            break;
          }
        }
      }
      if (!doneSignal && sseBuffer.trim()) {
        handleAskLine(sseBuffer.trim());
      }

      acc = sanitizeAiVietnameseOutput(acc);

      if (wasInterrupted && acc.trim()) {
        setQaList((prev) =>
          prev.map((item, i) =>
            i === idx
              ? { q, a: `${acc}\n\n> *(Kết nối bị gián đoạn giữa chừng — vui lòng hỏi lại nếu cần xem đầy đủ)*` }
              : item
          )
        );
      } else if (!acc.trim()) {
        const fallback = generateLocalInterpretationVi(chart, q, periodContext);
        setQaList((prev) =>
          prev.map((item, i) => (i === idx ? { q, a: fallback } : item))
        );
      } else {
        setQaList((prev) =>
          prev.map((item, i) => (i === idx ? { q, a: acc } : item))
        );
      }
    } catch {
      const fallback = generateLocalInterpretationVi(chart, q, periodContext);
      setQaList((prev) =>
        prev.map((item, i) => (i === idx ? { q, a: fallback } : item))
      );
    } finally {
      setQaLoading(false);
    }
  };

  const currentKey = selectedMutagen
    ? `mutagen_${selectedMutagen.starName}_${selectedMutagen.mutagen}_${selectedMutagen.palaceName}`
    : selectedPalace
    ? `palace_${selectedPalace.name}_${periodContext?.periodId ?? 'natal'}`
    : `${activeTopic}${periodSuffix}`;

  const currentContent = cache[currentKey] ?? getFallbackText(activeTopic);
  const currentAiEntry = periodContext ? aiPeriodCache[periodContext.cacheKey] : undefined;

  return (
    <div className="rounded-xl p-4 sm:p-5 border bg-[var(--t-card)] border-[var(--t-border)] flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[var(--t-border)]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--t-gold)] shrink-0" />
          <h3 className="text-sm font-semibold text-[var(--t-text)]">
            Luận Giải Chuyên Sâu — Tâm Pháp Thiên Kỷ Nghê Hải Hạ
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {onOpenDossierModal && (
            <button
              type="button"
              onClick={onOpenDossierModal}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border border-[var(--t-gold)]/50 bg-[var(--t-gold)]/10 text-[var(--t-gold)] hover:bg-[var(--t-gold)]/20 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Hồ Sơ 8 Chương</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setCache((prev) => ({
                ...prev,
                [currentKey]: getFallbackText(activeTopic),
              }));
            }}
            className="inline-flex items-center gap-1 text-xs text-[var(--t-text2)] hover:text-[var(--t-gold)] cursor-pointer whitespace-nowrap shrink-0"
            title="Phân tích lại"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* ─── TẦNG VẬN HẠN KẾT HỢP: KHUNG DỮ KIỆN XÁC ĐỊNH + AI DIỄN GIẢI ─── */}
      {periodContext && (
        <div className="space-y-4">
          {/* 1. KHUNG DỮ KIỆN XÁC ĐỊNH (Chạy ngay, không cần API key) */}
          <div className="rounded-xl p-3.5 sm:p-4 border border-sky-500/40 bg-sky-950/15 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-sky-500/25">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-400/40">
                  <Layers className="w-3 h-3" />
                  <span>Khung dữ kiện xác định</span>
                </span>
                <span className="text-xs sm:text-sm font-bold text-[var(--t-gold)]">
                  {periodContext.periodTitleVi}
                </span>
              </div>
              <span className="text-[11px] font-mono text-[var(--t-text2)]">
                Can Chi kỳ hạn: {periodContext.ganZhiVi}
              </span>
            </div>

            {/* Bảng dữ kiện kỳ hạn có cấu trúc */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-lg p-2.5 bg-[var(--t-bg)] border border-[var(--t-border)] space-y-1">
                <div className="text-[11px] font-semibold text-sky-300">
                  Cung Bản Mệnh Được Kích Hoạt
                </div>
                <div className="font-bold text-[var(--t-text)]">
                  Cung {periodContext.activatedPalace.natalPalaceNameVi} ({periodContext.activatedPalace.ganZhiVi})
                </div>
                <div className="text-[var(--t-text2)]">
                  Chính tinh: <strong className="text-amber-200">{periodContext.activatedPalace.majorStarsSummaryVi}</strong>
                </div>
                {periodContext.parentDaXian && (
                  <div className="text-[11px] text-emerald-300/90 pt-0.5">
                    Thuộc Đại Hạn {periodContext.parentDaXian.ageRangeVi} tại {periodContext.parentDaXian.natalPalaceNameVi} ({periodContext.parentDaXian.ganZhiVi})
                  </div>
                )}
              </div>

              <div className="rounded-lg p-2.5 bg-[var(--t-bg)] border border-[var(--t-border)] space-y-1">
                <div className="text-[11px] font-semibold text-sky-300">
                  Tứ Hóa Kỳ Hạn (Can {VI_STEMS[periodContext.stemIndex]})
                </div>
                <div className="space-y-1">
                  {periodContext.periodSiHua.map((sh) => (
                    <div key={sh.mutagenKey} className="flex items-start justify-between gap-1 text-[11px]">
                      <span className="font-semibold text-amber-200 shrink-0">
                        {sh.mutagenVi}: {sh.starNameVi} [{sh.brightnessVi}]
                      </span>
                      <span className="text-right text-[var(--t-text2)]">
                        tại {sh.natalPalaceNameVi} ({sh.periodPalaceRoleVi}) · xung {sh.oppositePalaceNameVi}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Chi tiết đầy đủ Bảng dữ kiện & Luận giải nền xác định */}
            <div className="rounded-lg p-3 bg-[var(--t-surface)] border border-[var(--t-border)] text-xs leading-relaxed space-y-3">
              <MarkdownContent content={periodContext.factTableMarkdown} />
              <hr className="border-[var(--t-border)] my-2" />
              <MarkdownContent content={periodContext.deterministicInterpretationMarkdown} />
            </div>
          </div>

          {/* 2. TẦNG AI DIỄN GIẢI (Tách bạch rõ với khung xác định) */}
          <div
            ref={aiSectionRef}
            className="rounded-xl p-3.5 sm:p-4 border border-amber-500/40 bg-amber-950/10 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-amber-500/25">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/40">
                  <Bot className="w-3 h-3" />
                  <span>AI diễn giải</span>
                </span>
                <span className="text-xs text-[var(--t-text2)]">
                  Tổng hợp từ Bảng dữ kiện kỳ hạn + Cổ phú Toàn Thư
                </span>
                {hasValidCachedPeriodEntry(currentAiEntry) && !aiPeriodLoading && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Đã lưu bộ nhớ đệm kỳ này</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {onOpenContextualChat && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenContextualChat({
                        chart,
                        contextMode: 'period',
                        contextKey: periodContext.cacheKey,
                        sectionTitle: periodContext.periodTitleVi,
                        periodContext,
                        factSheetVi: periodContext.factTableMarkdown,
                        excerptVi:
                          currentAiEntry?.text ||
                          currentAiEntry?.incompleteText ||
                          periodContext.deterministicInterpretationMarkdown,
                        starterQuestions: [
                          `Trong ${periodContext.periodTitleVi}, trọng tâm cát lợi và rủi ro lớn nhất nằm ở cung nào?`,
                          `Tứ Hóa kỳ hạn đang kích hoạt cung ${periodContext.activatedPalace.natalPalaceNameVi} tác động ra sao?`,
                          `Chiến lược hành động thực tế cho đương số trong kỳ hạn này?`,
                        ],
                      })
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[var(--t-gold)]/50 bg-[var(--t-gold)]/10 text-[var(--t-gold)] hover:bg-[var(--t-gold)]/20 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <MessageSquareText className="w-3.5 h-3.5" />
                    <span>Hỏi đáp kỳ hạn</span>
                  </button>
                )}
                {onOpenKeyPool && (
                  <button
                    type="button"
                    onClick={onOpenKeyPool}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)] hover:text-[var(--t-gold)] hover:border-[var(--t-gold)]/50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Kho Khóa AI</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    requestPeriodAiInterpretation(
                      Boolean(currentAiEntry?.text || currentAiEntry?.incomplete)
                    )
                  }
                  disabled={aiPeriodLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--t-gold)] text-slate-950 hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${aiPeriodLoading ? 'animate-spin' : ''}`} />
                  <span>
                    {aiPeriodLoading
                      ? 'Đang luận giải AI...'
                      : currentAiEntry?.incomplete
                      ? 'Thử luận giải AI lại'
                      : currentAiEntry?.text
                      ? 'Luận giải AI lại cho kỳ này'
                      : 'Luận giải AI cho kỳ này'}
                  </span>
                </button>
                {(currentAiEntry?.text?.trim() || currentAiEntry?.incompleteText?.trim()) && (
                  <button
                    type="button"
                    onClick={() => handleReauditPeriodEntry(currentAiEntry, true)}
                    disabled={aiPeriodLoading || aiPeriodReauditing}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-sky-500/45 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    title="Quét lại quy tắc KP-3 & trích dẫn nguồn (0 token AI)"
                  >
                    <ShieldCheck
                      className={`w-3.5 h-3.5 ${aiPeriodReauditing ? 'animate-pulse' : ''}`}
                    />
                    <span>{aiPeriodReauditing ? 'Đang kiểm tra lại...' : 'Kiểm tra lại'}</span>
                  </button>
                )}
              </div>
            </div>

            {currentAiEntry?.meta && (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--t-text2)] bg-[var(--t-bg)] px-2.5 py-1.5 rounded-lg border border-[var(--t-border)]">
                <span>
                  Model: <strong className="text-[var(--t-gold)]">{currentAiEntry.meta.modelUsed}</strong>
                  {currentAiEntry.meta.usedFallbackModel && ' (dự phòng)'}
                </span>
                <span>·</span>
                <span>
                  Khóa: <strong className="font-mono text-[var(--t-text)]">{currentAiEntry.meta.maskedKey}</strong> ({currentAiEntry.meta.label})
                </span>
                {shouldShowCompletedContinuationBadge(currentAiEntry, aiPeriodLoading) && (
                  <>
                    <span>·</span>
                    <span className="text-sky-300">
                      Đã tự động nối tiếp luồng hoàn chỉnh
                    </span>
                  </>
                )}
                {shouldShowInterruptedContinuationBadge(currentAiEntry, aiPeriodLoading) && (
                  <>
                    <span>·</span>
                    <span className="text-amber-300">
                      Đã thử tự động nối tiếp nhưng vẫn bị ngắt giữa chừng
                    </span>
                  </>
                )}
                {currentAiEntry.meta.failoverAttempts > 1 && (
                  <>
                    <span>·</span>
                    <span className="text-amber-300">
                      Đã tự chuyển qua {currentAiEntry.meta.failoverAttempts - 1} khóa lỗi
                    </span>
                  </>
                )}
              </div>
            )}

            {aiPeriodLoading && aiRetryingNoticeVi && (
              <div className="rounded-lg px-3 py-2 border border-sky-500/45 bg-sky-950/25 text-xs text-sky-200 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0 text-sky-300" />
                <span>{aiRetryingNoticeVi}</span>
              </div>
            )}

            {aiPeriodLoading && !currentAiEntry?.text && (
              <div className="flex items-center gap-2 text-[var(--t-gold)] py-4 justify-center text-xs">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Đang gửi Bảng dữ kiện kỳ hạn lên Gemini AI để diễn giải chuyên sâu...</span>
              </div>
            )}

            {currentAiEntry?.error && (
              <div className="rounded-lg p-3 border border-amber-500/40 bg-amber-950/30 text-xs text-amber-200 flex items-start justify-between gap-3 leading-relaxed">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-semibold text-amber-300">
                      {currentAiEntry.incomplete
                        ? 'Trạng thái AI: Kết nối bị ngắt giữa chừng (chưa lưu bộ nhớ đệm)'
                        : currentAiEntry.notConfigured
                        ? 'Trạng thái AI: Chưa cấu hình Kho Khóa AI'
                        : currentAiEntry.errorCategory === 'AUTH_INVALID_KEY' ||
                          currentAiEntry.errorCategory === 'AUTH_FORBIDDEN_REPEATED'
                        ? 'Trạng thái AI: Khóa API không hợp lệ hoặc bị từ chối quyền'
                        : currentAiEntry.errorCode === 'AI_POOL_EXHAUSTED'
                        ? 'Trạng thái AI: Toàn bộ khóa trong Kho đang nguội hoặc bị vô hiệu'
                        : currentAiEntry.errorCategory === 'TPM_GUARD_SKIP'
                        ? 'Trạng thái AI: Hàng rào bảo vệ hạn mức đang tạm hoãn'
                        : currentAiEntry.errorCategory === 'FIRST_CHUNK_TIMEOUT'
                        ? 'Trạng thái AI: Hết thời gian chờ tín hiệu đầu tiên'
                        : 'Trạng thái AI: Tạm thời gián đoạn kết nối Gemini API'}
                    </div>
                    <div className="break-words text-[11px] leading-relaxed">{currentAiEntry.error}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {currentAiEntry.incomplete && (
                    <button
                      type="button"
                      onClick={() => requestPeriodAiInterpretation(true)}
                      disabled={aiPeriodLoading}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-500/20 border border-amber-400/50 text-amber-200 hover:bg-amber-500/30 cursor-pointer"
                    >
                      Thử lại ngay
                    </button>
                  )}
                  {onOpenKeyPool && (
                    <button
                      type="button"
                      onClick={onOpenKeyPool}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--t-gold)] text-slate-950 hover:opacity-95 cursor-pointer"
                    >
                      Thêm / Kiểm tra Khóa
                    </button>
                  )}
                </div>
              </div>
            )}

            {currentAiEntry?.auditFlags &&
            currentAiEntry.auditFlags.length > 0 &&
            !aiPeriodLoading ? (
              <div className="rounded-lg p-3 border border-amber-500/45 bg-amber-950/20 text-xs space-y-1.5">
                <div className="font-semibold text-amber-300 flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Kiểm Chứng KP-3 ({currentAiEntry.auditFlags.length} cờ đối chiếu)</span>
                  </span>
                  {typeof currentAiEntry.reauditedAt === 'number' && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-amber-400/40 bg-amber-950/50 text-amber-200">
                      Kiểm chứng lại ngày {formatReauditTimestampVi(currentAiEntry.reauditedAt)} (v{currentAiEntry.reauditedForVersion || APP_VERSION})
                    </span>
                  )}
                </div>
                <ul className="space-y-1 text-[11px]">
                  {currentAiEntry.auditFlags.map((flag, idx) => (
                    <li
                      key={`${flag.code}-${idx}`}
                      className={
                        flag.severity === 'critical' ? 'text-rose-200' : 'text-amber-100'
                      }
                    >
                      <span className="font-mono font-bold mr-1">[{flag.code}]</span>
                      {flag.messageVi}
                    </li>
                  ))}
                </ul>
              </div>
            ) : !aiPeriodLoading && typeof currentAiEntry?.reauditedAt === 'number' ? (
              <div className="rounded-lg px-3 py-2 border border-emerald-500/40 bg-emerald-950/20 text-xs flex flex-wrap items-center justify-between gap-2 text-emerald-200">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    Đã kiểm chứng lại (v{currentAiEntry.reauditedForVersion || APP_VERSION}): 0 cờ cảnh báo
                  </span>
                </span>
                <span className="text-[11px] font-mono text-emerald-300/80">
                  {formatReauditTimestampVi(currentAiEntry.reauditedAt)}
                </span>
              </div>
            ) : null}

            {!aiPeriodLoading &&
              currentAiEntry?.deterministicRepairs &&
              currentAiEntry.deterministicRepairs.length > 0 && (
                <div className="rounded-lg px-3 py-2 border border-sky-500/40 bg-sky-950/20 text-xs flex flex-wrap items-center justify-between gap-2 text-sky-200">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                    <span>
                      Đã sửa tự động {currentAiEntry.deterministicRepairs.length} câu gọi nhầm &quot;Không Kiếp&quot; theo đúng Tam Phương Tứ Chính trước khi lưu.
                    </span>
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-sky-400/40 bg-sky-950/50 text-sky-200">
                    đã sửa tự động
                  </span>
                </div>
              )}

            {currentAiEntry?.text ? (
              <div className="rounded-lg p-3.5 bg-[var(--t-surface)] border border-[var(--t-border)] text-xs sm:text-sm leading-relaxed">
                <MarkdownContent content={currentAiEntry.text} />
                {aiPeriodLoading && (
                  <span className="inline-block w-1.5 h-4 bg-[var(--t-gold)] animate-pulse ml-1" />
                )}
              </div>
            ) : currentAiEntry?.incomplete && currentAiEntry?.incompleteText ? (
              <div className="rounded-lg p-3.5 bg-[var(--t-surface)] border border-amber-500/40 text-xs sm:text-sm leading-relaxed opacity-90 space-y-2">
                <div className="text-[11px] font-semibold text-amber-300">
                  Phần nội dung đã nhận trước khi đứt kết nối (không được lưu vào bộ nhớ đệm):
                </div>
                <MarkdownContent content={currentAiEntry.incompleteText} />
              </div>
            ) : (
              !aiPeriodLoading &&
              !currentAiEntry?.error && (
                <div className="text-xs text-[var(--t-faint)] leading-relaxed">
                  Nhấn nút <strong className="text-[var(--t-gold)]">"Luận giải AI cho kỳ này"</strong> để gửi Bảng dữ kiện kỳ hạn xác định ở trên tới Gemini AI diễn giải chuyên sâu (có bộ nhớ đệm theo từng kỳ hạn).
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Topic Selector Tabs */}
      {!selectedPalace && !selectedMutagen && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {TOPICS.map(({ key, label, icon }) => {
            const active = activeTopic === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleTopicClick(key)}
                className={`py-2 px-2.5 rounded-lg text-xs font-medium transition-all border text-left flex items-center gap-1.5 cursor-pointer ${
                  active
                    ? 'bg-[var(--t-gold)]/15 border-[var(--t-gold)] text-[var(--t-gold)] font-semibold'
                    : 'bg-[var(--t-bg)] border-[var(--t-border)] text-[var(--t-text2)] hover:border-[var(--t-gold)]/40'
                }`}
              >
                <span className="shrink-0">{icon}</span>
                <span className="leading-snug">{label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Selected Palace / Mutagen Banner */}
      {selectedMutagen ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-purple-950/30 border border-purple-500/40 text-xs">
          <span className="text-purple-300 font-medium">
            Đang luận giải Tứ Hóa: <strong>{translateStarName(selectedMutagen.starName)} Hóa {translateSiHua(selectedMutagen.mutagen)}</strong> tại {translatePalaceName(selectedMutagen.palaceName)}
          </span>
        </div>
      ) : selectedPalace ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--t-gold)]/10 border border-[var(--t-gold)]/40 text-xs">
          <span className="text-[var(--t-gold)] font-medium flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" />
            <span>
              Đang luận giải chuyên sâu: <strong>{translatePalaceName(selectedPalace.name)}</strong> (Nhấn lại vào cung trên bàn để quay về Tổng quan)
            </span>
          </span>
        </div>
      ) : null}

      {/* Topic / Palace Contextual Action Header + Main Content Display */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="text-xs font-semibold text-[var(--t-text2)]">
            {selectedMutagen
              ? `Luận giải Tứ Hóa: ${translateStarName(selectedMutagen.starName)} Hóa ${translateSiHua(selectedMutagen.mutagen)}`
              : selectedPalace
                ? `Chuyên sâu: ${translatePalaceName(selectedPalace.name)}`
                : `Chủ đề: ${TOPICS.find((t) => t.key === activeTopic)?.label ?? 'Tổng Quan'}`}
          </div>
          {onOpenContextualChat && (
            <button
              type="button"
              onClick={() => {
                const sectionTitle = selectedMutagen
                  ? `${translateStarName(selectedMutagen.starName)} Hóa ${translateSiHua(selectedMutagen.mutagen)} tại ${translatePalaceName(selectedMutagen.palaceName)}`
                  : selectedPalace
                    ? `Cung ${translatePalaceName(selectedPalace.name)} (${VI_BRANCHES[selectedPalace.branch]})`
                    : TOPICS.find((t) => t.key === activeTopic)?.label ?? 'Tổng Quan Mệnh Cách';
                onOpenContextualChat({
                  chart,
                  contextMode: 'natal',
                  contextKey: currentKey,
                  sectionTitle,
                  periodContext,
                  factSheetVi: formatChartSummaryVi(chart),
                  excerptVi: currentContent,
                  starterQuestions: [
                    `Điểm nổi bật và thế mạnh cốt lõi trong ${sectionTitle} là gì?`,
                    `Tam Phương Tứ Chính và Tứ Hóa ảnh hưởng tới phần này ra sao?`,
                    `Lời khuyên thực tế để đương số tối ưu hóa khía cạnh này?`,
                  ],
                });
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-[var(--t-gold)]/50 bg-[var(--t-gold)]/10 text-[var(--t-gold)] hover:bg-[var(--t-gold)]/20 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <MessageSquareText className="w-3.5 h-3.5" />
              <span>Hỏi đáp phần này</span>
            </button>
          )}
        </div>

        <div className="min-h-[210px] rounded-lg p-3.5 sm:p-4 border border-[var(--t-border)] bg-[var(--t-surface)] text-xs sm:text-sm leading-relaxed text-[var(--t-text)]">
          {loading && !currentContent && (
            <div className="flex items-center gap-2 text-[var(--t-gold)] py-8 justify-center">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Đang suy diễn tinh bàn & đối chiếu Cổ Phú Tử Vi...</span>
            </div>
          )}
          {currentContent ? (
            <div className="leading-relaxed">
              <MarkdownContent content={currentContent} />
              {loading && <span className="inline-block w-1.5 h-4 bg-[var(--t-gold)] animate-pulse ml-1" />}
            </div>
          ) : (
            !loading && (
              <span className="text-[var(--t-faint)]">
                Chọn một chủ đề phía trên hoặc nhấn trực tiếp vào từng Cung trên lá số để xem luận giải chi tiết.
              </span>
            )
          )}
        </div>
      </div>

      {/* Custom Question Input */}
      <div className="pt-2 border-t border-[var(--t-border)] space-y-3">
        <form onSubmit={handleAsk} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Đặt câu hỏi cụ thể về lá số (VD: Năm 2026 chuyển việc có thuận lợi không?)..."
              maxLength={150}
              className="w-full rounded-lg px-3 py-2 text-xs border bg-[var(--t-bg)] border-[var(--t-border)] text-[var(--t-text)] focus:outline-none focus:border-[var(--t-gold)]"
            />
          </div>
          <button
            type="submit"
            disabled={!question.trim() || qaLoading}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--t-gold)] text-slate-950 hover:opacity-95 disabled:opacity-40 transition-all cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{qaLoading ? 'Đang giải đáp...' : 'Vấn Đáp'}</span>
          </button>
        </form>

        {/* Q&A History */}
        {qaList.length > 0 && (
          <div className="space-y-2.5 max-h-80 overflow-y-auto">
            {qaList.map((item, i) => (
              <div
                key={i}
                className="rounded-lg p-3 border border-[var(--t-border)] bg-[var(--t-bg)] space-y-1.5 text-xs"
              >
                <div className="font-semibold text-[var(--t-gold)] flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                  <span>Hỏi: {item.q}</span>
                </div>
                <div className="text-[var(--t-text)] leading-relaxed pl-5">
                  {item.a ? (
                    <MarkdownContent content={item.a} />
                  ) : (
                    <span className="text-[var(--t-faint)] animate-pulse">Đang luận giải...</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
