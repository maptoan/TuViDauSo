import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  AiExecutionMeta,
  CHAT_LRU_INDEX_KEY,
  CHAT_MAX_QUESTION_CHARS,
  ChatQuotaState,
  ContextualChatContextPayload,
  MAX_CHAT_THREADS_IN_SESSION,
  StoredChatMessage,
  StoredChatThread,
  buildChartIdentityKey,
  buildChatStorageKey,
  createInitialChatQuotaState,
  evaluateChatQuotaStatus,
  getBrowserSessionStorage,
  getSharedDossierGenerating,
  readLruSessionEntry,
  recordChatQuestionSent,
  removeLruSessionEntry,
  subscribeSharedDossierGenerating,
  trimChatExcerpt,
  trimChatHistoryForRequest,
  unlockExtraChatTurns,
  upsertLruSessionEntry,
} from '../lib/dossier-chat-ui';
import { sanitizeAiVietnameseOutput } from '../lib/ziwei/text-sanitizer';
import MarkdownContent from './MarkdownContent';
import {
  X,
  Send,
  MessageSquareText,
  Sparkles,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  Lock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';

interface ContextualChatDrawerProps {
  open: boolean;
  context: ContextualChatContextPayload | null;
  onClose: () => void;
  isDossierGenerating?: boolean;
}

function buildQuotaStorageKey(chartIdentityKey: string): string {
  return `ziwei_chat_quota_v1::${chartIdentityKey}`;
}

function readPersistedQuota(chartIdentityKey: string): ChatQuotaState {
  const storage = getBrowserSessionStorage();
  if (!storage) return createInitialChatQuotaState();
  try {
    const raw = storage.getItem(buildQuotaStorageKey(chartIdentityKey));
    if (!raw) return createInitialChatQuotaState();
    const parsed = JSON.parse(raw) as Partial<ChatQuotaState>;
    return createInitialChatQuotaState(
      typeof parsed.usedCount === 'number' ? parsed.usedCount : 0,
      typeof parsed.capLimit === 'number' ? parsed.capLimit : undefined,
      typeof parsed.lastSentAtMs === 'number' ? parsed.lastSentAtMs : null,
    );
  } catch {
    return createInitialChatQuotaState();
  }
}

function writePersistedQuota(chartIdentityKey: string, state: ChatQuotaState): void {
  const storage = getBrowserSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(buildQuotaStorageKey(chartIdentityKey), JSON.stringify(state));
  } catch {
    // ignore quota errors for small counter
  }
}

export default function ContextualChatDrawer({
  open,
  context,
  onClose,
  isDossierGenerating: propDossierGenerating,
}: ContextualChatDrawerProps) {
  const [messages, setMessages] = useState<StoredChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [showContextPreview, setShowContextPreview] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [sharedDossierBusy, setSharedDossierBusy] = useState(() =>
    getSharedDossierGenerating(),
  );
  const [quotaState, setQuotaState] = useState<ChatQuotaState>(() =>
    createInitialChatQuotaState(),
  );

  const abortRef = useRef<AbortController | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  const chartIdentityKey = useMemo(
    () => (context ? buildChartIdentityKey(context.chart) : ''),
    [context],
  );

  const storageKey = useMemo(
    () =>
      context && chartIdentityKey
        ? buildChatStorageKey(chartIdentityKey, context.contextKey)
        : '',
    [context, chartIdentityKey],
  );

  // Theo dõi khóa tuần tự toàn app (F7: chặn chat khi Hồ Sơ đang sinh)
  useEffect(() => {
    setSharedDossierBusy(getSharedDossierGenerating());
    return subscribeSharedDossierGenerating((busy) => {
      setSharedDossierBusy(busy);
    });
  }, []);

  const isDossierBlocked = Boolean(propDossierGenerating || sharedDossierBusy);

  // Nạp lịch sử hội thoại theo cặp (lá số + phần luận giải) & quota phiên từ sessionStorage
  useEffect(() => {
    if (!context || !chartIdentityKey || !storageKey) {
      setMessages([]);
      return;
    }

    setQuotaState(readPersistedQuota(chartIdentityKey));

    const storage = getBrowserSessionStorage();
    const saved = readLruSessionEntry<StoredChatThread>(
      storage,
      CHAT_LRU_INDEX_KEY,
      storageKey,
    );
    if (saved && Array.isArray(saved.messages)) {
      setMessages(
        saved.messages.map((m) =>
          m.role === 'assistant' && m.content
            ? { ...m, content: sanitizeAiVietnameseOutput(m.content) }
            : m,
        ),
      );
    } else {
      setMessages([]);
    }
    setNowMs(Date.now());
  }, [context, chartIdentityKey, storageKey]);

  // Hủy luồng nếu đóng drawer hoặc unmount
  useEffect(() => {
    if (!open && streaming) {
      abortRef.current?.abort();
      setStreaming(false);
    }
  }, [open, streaming]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Cuộn xuống tin nhắn mới nhất
  useEffect(() => {
    if (open) {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, open]);

  // Đếm ngược mỗi giây khi còn cooldown 8s
  const quotaEval = useMemo(
    () =>
      evaluateChatQuotaStatus(quotaState, {
        nowMs,
        isDossierGenerating: isDossierBlocked,
        isChatStreaming: streaming,
      }),
    [quotaState, nowMs, isDossierBlocked, streaming],
  );

  useEffect(() => {
    if (!open || quotaEval.cooldownRemainingSec <= 0) return;
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 500);
    return () => window.clearInterval(timer);
  }, [open, quotaEval.cooldownRemainingSec]);

  const persistThread = useCallback(
    (nextMessages: StoredChatMessage[]) => {
      if (!context || !chartIdentityKey || !storageKey) return;
      const storage = getBrowserSessionStorage();
      const thread: StoredChatThread = {
        storageKey,
        chartIdentityKey,
        contextKey: context.contextKey,
        sectionTitle: context.sectionTitle,
        messages: nextMessages,
        updatedAt: Date.now(),
      };
      upsertLruSessionEntry(
        storage,
        CHAT_LRU_INDEX_KEY,
        storageKey,
        thread,
        MAX_CHAT_THREADS_IN_SESSION,
      );
    },
    [context, chartIdentityKey, storageKey],
  );

  const handleClearThread = () => {
    if (streaming) {
      abortRef.current?.abort();
      setStreaming(false);
    }
    setMessages([]);
    if (storageKey) {
      removeLruSessionEntry(
        getBrowserSessionStorage(),
        CHAT_LRU_INDEX_KEY,
        storageKey,
      );
    }
  };

  const handleUnlockMoreTurns = () => {
    if (!chartIdentityKey) return;
    setQuotaState((prev) => {
      const next = unlockExtraChatTurns(prev);
      writePersistedQuota(chartIdentityKey, next);
      return next;
    });
  };

  const handleCopyAnswer = async (msgId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(msgId);
      window.setTimeout(() => {
        setCopiedId((curr) => (curr === msgId ? null : curr));
      }, 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const sendQuestion = async (rawQuestion: string) => {
    if (!context || !chartIdentityKey) return;
    const trimmedQ = rawQuestion.trim().slice(0, CHAT_MAX_QUESTION_CHARS);
    if (!trimmedQ) return;

    const currentNow = Date.now();
    const check = evaluateChatQuotaStatus(quotaState, {
      nowMs: currentNow,
      isDossierGenerating: isDossierBlocked,
      isChatStreaming: streaming,
    });
    if (!check.canSend) return;

    // Ghi nhận lượt gửi + khởi động cooldown 8s (F7)
    const nextQuota = recordChatQuestionSent(quotaState, currentNow);
    setQuotaState(nextQuota);
    setNowMs(currentNow);
    writePersistedQuota(chartIdentityKey, nextQuota);

    const userMsg: StoredChatMessage = {
      id: `u_${currentNow}`,
      role: 'user',
      content: trimmedQ,
      timestamp: currentNow,
    };
    const assistantId = `a_${currentNow}`;
    const assistantPlaceholder: StoredChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: currentNow,
    };

    const historyForApi = trimChatHistoryForRequest(messages);
    const updatedBase = [...messages, userMsg, assistantPlaceholder];
    setMessages(updatedBase);
    setInput('');
    setStreaming(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let accumulated = '';
    let receivedMeta: AiExecutionMeta | undefined;
    let wasInterrupted = false;
    let streamError = '';

    const updateAssistant = (patch: Partial<StoredChatMessage>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m)),
      );
    };

    try {
      const res = await fetch('/api/interpret-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chart: context.chart,
          chartB: context.chartB ?? null,
          contextMode: context.contextMode,
          sectionTitle: context.sectionTitle,
          periodContext: context.periodContext ?? null,
          excerpt: trimChatExcerpt(context.excerptVi),
          history: historyForApi,
          question: trimmedQ,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let msg = 'Không thể kết nối dịch vụ AI cho câu hỏi này.';
        try {
          const errJson = await res.json();
          if (errJson?.message) msg = errJson.message;
        } catch {
          // ignore
        }
        streamError = msg;
        const finalList = updatedBase.map((m) =>
          m.id === assistantId ? { ...m, content: '', error: msg } : m,
        );
        setMessages(finalList);
        persistThread(finalList);
        return;
      }

      if (!res.body) {
        const msg = 'Máy chủ không trả về luồng SSE.';
        const finalList = updatedBase.map((m) =>
          m.id === assistantId ? { ...m, error: msg } : m,
        );
        setMessages(finalList);
        persistThread(finalList);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';

      const processLine = (line: string): boolean => {
        if (!line.startsWith('data: ')) return false;
        const payloadStr = line.slice(6).trim();
        if (payloadStr === '[DONE]') return true;
        try {
          const parsed = JSON.parse(payloadStr);
          if (parsed?.meta) {
            receivedMeta = parsed.meta as AiExecutionMeta;
            updateAssistant({ meta: receivedMeta });
            return false;
          }
          if (parsed?.interrupted) {
            wasInterrupted = true;
            if (parsed.message) streamError = parsed.message;
            return false;
          }
          if (parsed?.error) {
            streamError = parsed.message || 'Lời gọi Gemini API gặp lỗi.';
            return false;
          }
          const deltaText = parsed?.delta?.text ?? '';
          if (deltaText) {
            accumulated = sanitizeAiVietnameseOutput(accumulated + deltaText);
            updateAssistant({ content: accumulated, meta: receivedMeta });
          }
        } catch {
          // ignore partial SSE JSON frame
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

      accumulated = sanitizeAiVietnameseOutput(accumulated);

      const finalAssistant: StoredChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: accumulated,
        timestamp: Date.now(),
        meta: receivedMeta
          ? {
              ...receivedMeta,
              interrupted: wasInterrupted || Boolean(streamError),
            }
          : undefined,
        interrupted: wasInterrupted,
        error:
          streamError ||
          (!accumulated.trim() && !wasInterrupted
            ? 'Phản hồi từ AI trống. Vui lòng thử đặt lại câu hỏi.'
            : undefined),
      };

      const finalMessages = updatedBase.map((m) =>
        m.id === assistantId ? finalAssistant : m,
      );
      setMessages(finalMessages);
      persistThread(finalMessages);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const cleanPartial = sanitizeAiVietnameseOutput(accumulated);
        const errMsg =
          'Kết nối bị gián đoạn trước khi nhận xong câu trả lời. Vui lòng thử lại.';
        const finalMessages = updatedBase.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: cleanPartial,
                error: errMsg,
                interrupted: Boolean(cleanPartial.trim()),
              }
            : m,
        );
        setMessages(finalMessages);
        persistThread(finalMessages);
      }
    } finally {
      setStreaming(false);
    }
  };

  if (!open || !context) return null;

  const remainingChars = CHAT_MAX_QUESTION_CHARS - input.length;

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-black/65 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Hỏi đáp chuyên sâu — ${context.sectionTitle}`}
    >
      {/* Click outside backdrop to close */}
      <div className="flex-1 hidden sm:block" onClick={onClose} />

      {/* Drawer panel */}
      <aside className="w-full sm:w-[480px] lg:w-[540px] h-full flex flex-col border-l border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text)] shadow-2xl">
        {/* Drawer Header */}
        <header className="px-4 py-3.5 border-b border-[var(--t-border)] bg-[var(--t-card)] flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--t-gold)]">
              <MessageSquareText className="w-4 h-4 shrink-0" />
              <span>Hỏi Đáp Chuyên Sâu Theo Ngữ Cảnh</span>
            </div>
            <h3 className="text-sm font-bold text-[var(--t-text)] truncate">
              {context.sectionTitle}
            </h3>
            <p className="text-[11px] text-[var(--t-text2)] leading-snug">
              Đã neo vào bảng dữ kiện + bài luận giải hiện tại · Lưu tối đa{' '}
              <span className="font-mono-tabular">10</span> mạch trong phiên
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClearThread}
                className="p-2 rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)] hover:text-rose-400 hover:border-rose-400/50 transition-colors cursor-pointer"
                title="Xóa mạch hội thoại này"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)] hover:text-[var(--t-gold)] transition-colors cursor-pointer"
              title="Đóng ngăn hỏi đáp"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Pinned context collapsible preview */}
        <div className="border-b border-[var(--t-border)] bg-[var(--t-surface)] px-4 py-2">
          <button
            type="button"
            onClick={() => setShowContextPreview((v) => !v)}
            className="w-full flex items-center justify-between text-[11px] font-medium text-[var(--t-text2)] hover:text-[var(--t-gold)] cursor-pointer"
          >
            <span>
              Xem bảng dữ kiện & đoạn trích đang ghim (
              <span className="font-mono-tabular">
                {trimChatExcerpt(context.excerptVi).length}
              </span>{' '}
              ký tự trích đoạn)
            </span>
            {showContextPreview ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
          {showContextPreview && (
            <div className="mt-2 max-h-44 overflow-y-auto rounded-lg p-2.5 border border-[var(--t-border)] bg-[var(--t-bg)] text-[11px] text-[var(--t-text2)] whitespace-pre-wrap leading-relaxed">
              {context.factSheetVi || context.excerptVi}
            </div>
          )}
        </div>

        {/* Starter questions bar */}
        {context.starterQuestions.length > 0 && (
          <div className="px-4 py-2.5 border-b border-[var(--t-border)] bg-[var(--t-card)]/60 space-y-1.5">
            <div className="text-[11px] font-semibold text-[var(--t-text2)] flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-[var(--t-gold)]" />
              <span>Gợi ý câu hỏi bám sát phần đang xem</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {context.starterQuestions.map((sq, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={!quotaEval.canSend}
                  onClick={() => sendQuestion(sq)}
                  className="text-left px-2.5 py-1.5 rounded-lg text-[11px] border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)] hover:border-[var(--t-gold)] hover:text-[var(--t-gold)] disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer leading-snug"
                >
                  {sq}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="rounded-xl p-4 border border-[var(--t-border)] bg-[var(--t-surface)] text-xs text-[var(--t-text2)] space-y-2 leading-relaxed">
              <p className="font-semibold text-[var(--t-gold)]">
                Hỏi đáp trực tiếp trên dữ kiện lá số thực tế
              </p>
              <p>
                Mọi câu trả lời đều bám sát 4 lớp ngữ cảnh gửi kèm máy chủ: Tóm tắt Bản Mệnh · Bảng Tứ Hóa phân tầng & Ma Trận 2026–2035 · Đoạn trích phần đang mở · Lịch sử 6 tin nhắn gần nhất.
              </p>
              <p className="text-[11px] text-[var(--t-faint)]">
                Lưu ý: Giới hạn bảo vệ quota gồm khoảng nghỉ 8 giây giữa 2 câu hỏi và mốc tham chiếu 15 lượt hỏi/phiên.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              if (msg.role === 'user') {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-xl rounded-tr-sm px-3.5 py-2.5 bg-[var(--t-gold)]/15 border border-[var(--t-gold)]/45 text-xs sm:text-sm text-[var(--t-text)] leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className="rounded-xl p-3.5 border border-[var(--t-border)] bg-[var(--t-surface)] space-y-2.5 text-xs sm:text-sm"
                >
                  {msg.content ? (
                    <MarkdownContent content={msg.content} />
                  ) : !msg.error ? (
                    <div className="flex items-center gap-2 text-xs text-[var(--t-gold)] py-1">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang đối chiếu tinh bàn và hồi đáp...</span>
                    </div>
                  ) : null}

                  {(msg.interrupted || msg.error) && (
                    <div className="rounded-lg p-2.5 border border-amber-500/40 bg-amber-950/25 text-[11px] text-amber-200 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        {msg.error ||
                          'Luồng trả lời bị gián đoạn giữa chừng. Bạn có thể hỏi tiếp để làm rõ phần còn thiếu.'}
                      </span>
                    </div>
                  )}

                  {/* Unboxed quiet metadata + Copy button */}
                  {(msg.meta || msg.content) && (
                    <div className="pt-2 border-t border-[var(--t-border)]/70 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--t-faint)]">
                      <div className="flex flex-wrap items-center gap-1.5 font-mono-tabular">
                        {msg.meta && (
                          <>
                            <span>
                              Model:{' '}
                              <strong className="text-[var(--t-gold)]">
                                {msg.meta.modelUsed}
                              </strong>
                            </span>
                            <span>·</span>
                            <span>Khóa: {msg.meta.maskedKey}</span>
                            {msg.meta.usedFallbackModel && (
                              <>
                                <span>·</span>
                                <span>dự phòng</span>
                              </>
                            )}
                          </>
                        )}
                      </div>

                      {msg.content && (
                        <button
                          type="button"
                          onClick={() => handleCopyAnswer(msg.id, msg.content)}
                          className="inline-flex items-center gap-1 text-[11px] text-[var(--t-text2)] hover:text-[var(--t-gold)] cursor-pointer whitespace-nowrap shrink-0"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Đã chép</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Sao chép</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={listEndRef} />
        </div>

        {/* Footer Quota Guard + Input Box */}
        <footer className="p-3.5 border-t border-[var(--t-border)] bg-[var(--t-card)] space-y-2.5">
          {/* Status / Lock Banners */}
          {isDossierBlocked && (
            <div className="rounded-lg px-3 py-2 border border-amber-500/45 bg-amber-950/25 text-xs text-amber-200 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Đang sinh chương hồ sơ, vui lòng đợi…</span>
            </div>
          )}

          {!isDossierBlocked && quotaEval.showAmberReminder && (
            <div className="rounded-lg px-3 py-1.5 border border-amber-500/35 bg-amber-950/20 text-[11px] text-amber-200 flex items-center justify-between gap-2">
              <span>
                Nhắc nhẹ: Bạn đã hỏi{' '}
                <strong className="font-mono-tabular">
                  {quotaEval.usedCount}/{quotaEval.capLimit}
                </strong>{' '}
                lượt trong phiên lá số này.
              </span>
            </div>
          )}

          {quotaEval.isCapReached && (
            <div className="rounded-lg px-3 py-2 border border-amber-500/45 bg-amber-950/30 text-xs text-amber-200 flex items-center justify-between gap-2">
              <span>
                Đã chạm mốc{' '}
                <strong className="font-mono-tabular">
                  {quotaEval.usedCount}/{quotaEval.capLimit}
                </strong>{' '}
                lượt hỏi để bảo vệ kho khóa.
              </span>
              <button
                type="button"
                onClick={handleUnlockMoreTurns}
                className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[var(--t-gold)] text-slate-950 hover:opacity-95 cursor-pointer whitespace-nowrap shrink-0"
              >
                Mở thêm 5 lượt hỏi
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendQuestion(input);
            }}
            className="space-y-2"
          >
            <textarea
              rows={2}
              value={input}
              onChange={(e) =>
                setInput(e.target.value.slice(0, CHAT_MAX_QUESTION_CHARS))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (quotaEval.canSend && input.trim()) {
                    sendQuestion(input);
                  }
                }
              }}
              disabled={isDossierBlocked || quotaEval.isCapReached}
              placeholder={
                isDossierBlocked
                  ? 'Đang sinh chương hồ sơ, vui lòng đợi…'
                  : quotaEval.isCapReached
                    ? 'Bấm "Mở thêm 5 lượt hỏi" phía trên để tiếp tục...'
                    : 'Đặt câu hỏi cụ thể về phần luận giải này (tối đa 400 ký tự)...'
              }
              className="w-full rounded-lg px-3 py-2 text-xs border bg-[var(--t-bg)] border-[var(--t-border)] text-[var(--t-text)] focus:outline-none focus:border-[var(--t-gold)] disabled:opacity-50 resize-none"
            />

            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] text-[var(--t-faint)] font-mono-tabular">
                Lượt phiên: {quotaEval.usedCount}/{quotaEval.capLimit} · Còn{' '}
                {remainingChars} ký tự
              </div>

              <button
                type="submit"
                disabled={!quotaEval.canSend || !input.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--t-gold)] text-slate-950 hover:opacity-95 disabled:opacity-45 disabled:cursor-not-allowed transition-all cursor-pointer whitespace-nowrap shrink-0 font-mono-tabular"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{quotaEval.sendButtonLabel}</span>
              </button>
            </div>
          </form>
        </footer>
      </aside>
    </div>
  );
}
