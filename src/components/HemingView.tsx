import React, { useState, useRef } from 'react';
import BirthForm from './BirthForm';
import { ZiweiChart, BirthFormState } from '../lib/ziwei/types';
import {
  VI_STEMS,
  VI_BRANCHES,
  formatChartSummaryVi,
  translateWuxingJu,
  translateStarName,
} from '../lib/ziwei/vi-i18n';
import {
  buildChartIdentityKey,
  classifyDossierFailure,
  type ContextualChatContextPayload,
} from '../lib/dossier-chat-ui';
import { sanitizeAiVietnameseOutput } from '../lib/ziwei/text-sanitizer';
import MarkdownContent from './MarkdownContent';
import { HeartHandshake, Sparkles, RefreshCw, Users, CheckCircle2, MessageSquareText, AlertTriangle } from 'lucide-react';

interface HemingViewProps {
  onOpenContextualChat?: (context: ContextualChatContextPayload) => void;
}

function buildLocalHemingFallback(chartA: ZiweiChart, chartB: ZiweiChart): string {
  const mingA = chartA.palaces.find((p) => p.isMingGong);
  const mingB = chartB.palaces.find((p) => p.isMingGong);
  const fuqiA = chartA.palaces.find((p) => p.name.includes('夫妻'));
  const fuqiB = chartB.palaces.find((p) => p.name.includes('夫妻'));

  const getMajorsText = (p?: typeof mingA) => {
    const majors = p?.stars.filter((s) => s.type === 'major') ?? [];
    if (majors.length > 0) return majors.map((s) => translateStarName(s.name)).join(', ');
    if (p?.borrowedStars && p.borrowedStars.length > 0) {
      return `Vô chính diệu (mượn ${p.borrowedStars.map((s) => translateStarName(s)).join(', ')})`;
    }
    return 'Vô chính diệu';
  };

  const starsMingA = getMajorsText(mingA);
  const starsMingB = getMajorsText(mingB);
  const starsFuqiA = getMajorsText(fuqiA);
  const starsFuqiB = getMajorsText(fuqiB);

  return `## Luận Giải Hợp Bàn Tử Vi — Pháp Môn Thiên Kỷ Nghê Hải Hạ

### 1. Tương Hợp Bản Mệnh & Ngũ Hành Cục
- **Đương số A (${chartA.birthInfo.name || 'Người thứ nhất'}):** ${translateWuxingJu(chartA.wuxingJuName)}, Mệnh tọa tại cung **${VI_BRANCHES[mingA?.branch ?? 0]}** có chính tinh **${starsMingA}**.
- **Đương số B (${chartB.birthInfo.name || 'Người thứ hai'}):** ${translateWuxingJu(chartB.wuxingJuName)}, Mệnh tọa tại cung **${VI_BRANCHES[mingB?.branch ?? 0]}** có chính tinh **${starsMingB}**.
- **Đánh giá khí chất:** Khi đối chiếu chính tinh Mệnh cung của hai người, ${starsMingA} và ${starsMingB} tạo nên sự bổ khuyết rõ rệt giữa tính chủ động quyết đoán và chiều sâu nội tâm.

### 2. Đối Chiếu Cung Phu Thê (Hình Mẫu Nhân Duyên)
- **Cung Phu Thê của A:** Có chính tinh **${starsFuqiA}** — phản ánh kỳ vọng tự nhiên của A về người bạn đời/đối tác.
- **Cung Phu Thê của B:** Có chính tinh **${starsFuqiB}** — phản ánh chuẩn mực gắn kết của B.
- Theo nguyên lý Hợp Bàn của Nghê Hải Hạ: Nếu chính tinh tại Mệnh Cung của người này đồng nhóm hoặc tam hợp với cung Phu Thê của người kia thì nhân duyên tiền định rất sâu dày, dễ thấu hiểu mà không cần nhiều lời.

### 3. Cung Phúc Đức & Quan Điểm Sống
- Sự bền vững lâu dài của hôn nhân và hợp tác kinh doanh nằm ở **Cung Phúc Đức** và **Cung Tài Bạch**. Hai lá số cần tôn trọng nhịp sinh hoạt và khoảng không gian riêng của nhau, lấy sự minh bạch về tài chính làm nền tảng.

### 4. Lời Khuyên Hóa Giải & Đồng Hành (Dịch Lý Bền Vững)
1. **Nguyên tắc Giao Tiếp:** Khi gặp năm Lưu Niên có Hóa Kỵ xung chiếu cung Phu Thê hoặc Quan Lộc, hai bên nên lấy nhu thắng cương, tránh tranh luận thắng thua nhất thời.
2. **Phân Công Vai Trò:** Người có nhóm sao Đế Tinh / Khai Sáng (Tử Vi, Thiên Phủ, Vũ Khúc, Thất Sát) nên đảm nhận hoạch định chiến lược; người có nhóm sao Trí Tuệ / Hòa Hợp (Thiên Cơ, Thái Âm, Thiên Lương, Thiên Đồng) nên nắm giữ hậu phương và quản trị rủi ro.`;
}

const DEFAULT_HEMING_FORM_A: BirthFormState = {
  name: 'Nguyễn Minh Quân',
  year: '1993',
  month: '5',
  day: '12',
  clockHour: '9',
  clockMinute: '30',
  unknownTime: false,
  gender: 'male',
  province: 'Việt Nam — Miền Bắc',
  city: 'Hà Nội',
  longitude: 105.85,
};

const DEFAULT_HEMING_FORM_B: BirthFormState = {
  name: 'Trần Ngọc Lan',
  year: '1996',
  month: '10',
  day: '24',
  clockHour: '14',
  clockMinute: '15',
  unknownTime: false,
  gender: 'female',
  province: 'Việt Nam — Miền Nam & ĐBSCL',
  city: 'TP. Hồ Chí Minh (Sài Gòn)',
  longitude: 106.7,
};

export default function HemingView({ onOpenContextualChat }: HemingViewProps) {
  const [formA, setFormA] = useState<BirthFormState>(DEFAULT_HEMING_FORM_A);
  const [formB, setFormB] = useState<BirthFormState>(DEFAULT_HEMING_FORM_B);
  const [chartA, setChartA] = useState<ZiweiChart | null>(null);
  const [chartB, setChartB] = useState<ZiweiChart | null>(null);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamNotice, setStreamNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleAnalyze = async () => {
    if (!chartA || !chartB || loading) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setResult('');
    setStreamNotice(null);
    setLoading(true);

    try {
      const res = await fetch('/api/heming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chartA, chartB }),
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
          // ignore
        }
        const failure = classifyDossierFailure({
          httpStatus: res.status,
          error: errJson?.error,
          errorCategory: errJson?.errorCategory,
          minRemainingCooldownSec: errJson?.minRemainingCooldownSec ?? null,
          message: errJson?.message,
        });
        setStreamNotice(
          `${failure.userMessageVi} Đang hiển thị bản phân tích xác định tại chỗ.`,
        );
        setResult(buildLocalHemingFallback(chartA, chartB));
        return;
      }

      if (!res.body) {
        setStreamNotice(
          'Không kết nối được luồng AI Hợp Bàn — đang hiển thị bản phân tích xác định tại chỗ.',
        );
        setResult(buildLocalHemingFallback(chartA, chartB));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';
      let acc = '';
      let wasInterrupted = false;
      let streamError = '';
      let streamErrorCode: string | null = null;
      let streamErrorCategory: string | null = null;
      let streamCooldownSec: number | null = null;
      let interruptedCategory: string | null = null;
      let interruptedCooldownSec: number | null = null;

      const processLine = (line: string): boolean => {
        if (!line.startsWith('data: ')) return false;
        const data = line.slice(6).trim();
        if (data === '[DONE]') return true;
        try {
          const parsed = JSON.parse(data);
          if (parsed?.meta) {
            return false;
          }
          if (parsed?.interrupted) {
            wasInterrupted = true;
            if (parsed.message) streamError = parsed.message;
            if (typeof parsed.errorCategory === 'string') {
              interruptedCategory = parsed.errorCategory;
            }
            if (typeof parsed.minRemainingCooldownSec === 'number') {
              interruptedCooldownSec = parsed.minRemainingCooldownSec;
            }
            return false;
          }
          if (parsed?.error) {
            streamError = parsed.message || 'Luồng AI Hợp Bàn gặp lỗi.';
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
            acc = sanitizeAiVietnameseOutput(acc + text);
            setResult(acc);
          }
        } catch {
          // ignore partial JSON frame
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

      acc = sanitizeAiVietnameseOutput(acc);
      if (acc.trim()) {
        setResult(acc);
      }

      if (wasInterrupted || streamError) {
        const failure = classifyDossierFailure({
          error: streamErrorCode,
          errorCategory: streamErrorCategory ?? interruptedCategory,
          minRemainingCooldownSec: streamCooldownSec ?? interruptedCooldownSec,
          message: streamError,
          interrupted: wasInterrupted,
        });
        if (acc.trim()) {
          setStreamNotice(
            `${failure.userMessageVi} Đang giữ phần nội dung đã nhận.`,
          );
        } else {
          setStreamNotice(
            `${failure.userMessageVi} Đang hiển thị bản phân tích xác định tại chỗ.`,
          );
          setResult(buildLocalHemingFallback(chartA, chartB));
        }
      } else if (!acc.trim()) {
        setResult(buildLocalHemingFallback(chartA, chartB));
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setStreamNotice(
          'Mất kết nối luồng AI Hợp Bàn — đang hiển thị bản phân tích xác định tại chỗ.',
        );
        setResult(buildLocalHemingFallback(chartA, chartB));
      }
    } finally {
      setLoading(false);
    }
  };

  const renderMiniSummary = (chart: ZiweiChart, title: string) => {
    const ming = chart.palaces.find((p) => p.isMingGong);
    const fuqi = chart.palaces.find((p) => p.name.includes('夫妻'));
    const mingMajors =
      ming?.stars
        .filter((s) => s.type === 'major')
        .map((s) => translateStarName(s.name))
        .join(', ') || 'Vô chính diệu';
    const fuqiMajors =
      fuqi?.stars
        .filter((s) => s.type === 'major')
        .map((s) => translateStarName(s.name))
        .join(', ') || 'Vô chính diệu';

    return (
      <div className="rounded-lg p-3 border border-emerald-500/30 bg-emerald-500/5 text-xs space-y-1">
        <div className="flex items-center justify-between font-semibold text-emerald-400">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              Đã nạp {title}: {chart.birthInfo.name || 'Đương số'}
            </span>
          </span>
          <span className="font-mono">{translateWuxingJu(chart.wuxingJuName)}</span>
        </div>
        <div className="text-[var(--t-text2)] flex flex-wrap gap-x-4 gap-y-1">
          <span>
            <strong>
              Mệnh Cung ({VI_STEMS[ming?.stem ?? 0]} {VI_BRANCHES[ming?.branch ?? 0]}):
            </strong>{' '}
            {mingMajors}
          </span>
          <span>
            <strong>Cung Phu Thê:</strong> {fuqiMajors}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="rounded-xl p-4 sm:p-5 border bg-[var(--t-card)] border-[var(--t-border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[var(--t-gold)] font-semibold text-sm">
            <HeartHandshake className="w-4 h-4" />
            <span>Hợp Bàn Tử Vi Đẩu Số — Luận Giải Nhân Duyên & Hợp Tác</span>
          </div>
          <p className="text-xs text-[var(--t-text2)] leading-relaxed max-w-3xl">
            Đối chiếu song hành 2 lá số dựa trên 5 trụ cột của Hệ Thống Thiên Kỷ: <strong>Khí chất Mệnh Cung</strong>, <strong>Giao thoa Cung Phu Thê</strong>, <strong>Đồng điệu Cung Phúc Đức</strong>, <strong>Tứ Hóa Phi Tinh tương tác</strong> và <strong>Đồng bộ Vận Hạn 10 năm</strong>.
          </p>
        </div>
      </div>

      {/* Dual Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--t-gold)] px-1">
            <Users className="w-4 h-4" />
            <span>Đương Số Thứ Nhất (Bên A)</span>
          </div>
          <BirthForm
            compact
            submitLabel="Xác Nhận Lá Số A"
            initialState={formA}
            onChartGenerated={(c: ZiweiChart, f: BirthFormState) => {
              setFormA(f);
              setChartA(c);
              setResult('');
              setStreamNotice(null);
            }}
          />
          {chartA && renderMiniSummary(chartA, 'Lá Số A')}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 px-1">
            <Users className="w-4 h-4" />
            <span>Đương Số Thứ Hai (Bên B)</span>
          </div>
          <BirthForm
            compact
            submitLabel="Xác Nhận Lá Số B"
            initialState={formB}
            onChartGenerated={(c: ZiweiChart, f: BirthFormState) => {
              setFormB(f);
              setChartB(c);
              setResult('');
              setStreamNotice(null);
            }}
          />
          {chartB && renderMiniSummary(chartB, 'Lá Số B')}
        </div>
      </div>

      {/* Action Button */}
      <div className="flex flex-wrap justify-center items-center gap-3">
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!chartA || !chartB || loading}
          className="px-8 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer flex items-center gap-2 bg-[var(--t-gold)] text-slate-950 hover:opacity-95 disabled:opacity-40 shadow-md whitespace-nowrap shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          <span>
            {loading
              ? 'Đang đối chiếu Tam Phương Tứ Chính hai lá số...'
              : !chartA || !chartB
              ? 'Vui lòng xác nhận đủ Lá Số A và Lá Số B'
              : 'Khởi Động Luận Giải Hợp Bàn'}
          </span>
        </button>

        {onOpenContextualChat && chartA && chartB && (
          <button
            type="button"
            onClick={() => {
              const nameA = chartA.birthInfo.name || 'Bên A';
              const nameB = chartB.birthInfo.name || 'Bên B';
              const factSheetVi = `=== LÁ SỐ BÊN A (${nameA}) ===\n${formatChartSummaryVi(chartA)}\n\n=== LÁ SỐ BÊN B (${nameB}) ===\n${formatChartSummaryVi(chartB)}`;
              const excerptVi = result.trim() || buildLocalHemingFallback(chartA, chartB);
              const bKey = buildChartIdentityKey(chartB);
              onOpenContextualChat({
                chart: chartA,
                chartB,
                contextMode: 'heming',
                contextKey: `heming_${bKey}`,
                sectionTitle: `Hợp Bàn: ${nameA} & ${nameB}`,
                factSheetVi,
                excerptVi,
                starterQuestions: [
                  `Điểm bổ khuyết lớn nhất giữa Mệnh của ${nameA} và ${nameB} là gì?`,
                  `Cung Phu Thê và Tứ Hóa hai lá số có xung khắc nào cần hóa giải?`,
                  `Hai người nên phân công vai trò tài chính và gia đạo thế nào cho bền vững?`,
                ],
              });
            }}
            className="px-4 py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all cursor-pointer inline-flex items-center gap-2 border border-[var(--t-gold)]/50 bg-[var(--t-gold)]/10 text-[var(--t-gold)] hover:bg-[var(--t-gold)]/20 whitespace-nowrap shrink-0"
          >
            <MessageSquareText className="w-4 h-4" />
            <span>Hỏi đáp sâu về cặp đôi này</span>
          </button>
        )}
      </div>

      {/* Result Card */}
      {(result || loading) && (
        <div className="rounded-xl p-5 sm:p-6 border bg-[var(--t-card)] border-[var(--t-gold)]/50 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--t-border)] pb-2.5">
            <h3 className="text-sm font-bold text-[var(--t-gold)]">
              Bản Luận Giải Hợp Bàn ({chartA?.birthInfo.name || 'Bên A'} & {chartB?.birthInfo.name || 'Bên B'})
            </h3>
            <div className="flex items-center gap-2">
              {loading && <RefreshCw className="w-4 h-4 text-[var(--t-gold)] animate-spin" />}
              {onOpenContextualChat && chartA && chartB && !loading && (
                <button
                  type="button"
                  onClick={() => {
                    const nameA = chartA.birthInfo.name || 'Bên A';
                    const nameB = chartB.birthInfo.name || 'Bên B';
                    const factSheetVi = `=== LÁ SỐ BÊN A (${nameA}) ===\n${formatChartSummaryVi(chartA)}\n\n=== LÁ SỐ BÊN B (${nameB}) ===\n${formatChartSummaryVi(chartB)}`;
                    const bKey = buildChartIdentityKey(chartB);
                    onOpenContextualChat({
                      chart: chartA,
                      chartB,
                      contextMode: 'heming',
                      contextKey: `heming_${bKey}`,
                      sectionTitle: `Hợp Bàn: ${nameA} & ${nameB}`,
                      factSheetVi,
                      excerptVi: result.trim() || buildLocalHemingFallback(chartA, chartB),
                      starterQuestions: [
                        `Tương tác Tứ Hóa giữa ${nameA} và ${nameB} thuận hay nghịch ở điểm nào?`,
                        `Khi gặp năm xung cung Phu Thê, cặp đôi cần lưu ý điều gì?`,
                      ],
                    });
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-[var(--t-gold)]/50 bg-[var(--t-gold)]/10 text-[var(--t-gold)] hover:bg-[var(--t-gold)]/20 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <MessageSquareText className="w-3.5 h-3.5" />
                  <span>Hỏi đáp Hợp Bàn</span>
                </button>
              )}
            </div>
          </div>
          {streamNotice && (
            <div className="rounded-lg px-3 py-2 border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{streamNotice}</span>
            </div>
          )}
          <div className="text-xs sm:text-sm text-[var(--t-text)] leading-relaxed">
            <MarkdownContent content={result} />
          </div>
        </div>
      )}
    </div>
  );
}
