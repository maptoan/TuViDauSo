import React, { useState, useRef } from 'react';
import BirthForm from './BirthForm';
import { ZiweiChart, BirthFormState } from '../lib/ziwei/types';
import {
  VI_STEMS,
  VI_BRANCHES,
  translateWuxingJu,
  translateStarName,
} from '../lib/ziwei/vi-i18n';
import MarkdownContent from './MarkdownContent';
import { HeartHandshake, Sparkles, RefreshCw, Users, CheckCircle2 } from 'lucide-react';

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

export default function HemingView() {
  const [chartA, setChartA] = useState<ZiweiChart | null>(null);
  const [chartB, setChartB] = useState<ZiweiChart | null>(null);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleAnalyze = async () => {
    if (!chartA || !chartB || loading) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setResult('');
    setLoading(true);

    try {
      const res = await fetch('/api/heming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chartA, chartB }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setResult(buildLocalHemingFallback(chartA, chartB));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const text = JSON.parse(data)?.delta?.text ?? '';
            if (text) {
              acc += text;
              setResult(acc);
            }
          } catch {
            // ignore
          }
        }
      }

      if (!acc.trim()) {
        setResult(buildLocalHemingFallback(chartA, chartB));
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
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
            initialState={{
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
            }}
            onChartGenerated={(c: ZiweiChart, _f: BirthFormState) => {
              setChartA(c);
              setResult('');
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
            initialState={{
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
            }}
            onChartGenerated={(c: ZiweiChart, _f: BirthFormState) => {
              setChartB(c);
              setResult('');
            }}
          />
          {chartB && renderMiniSummary(chartB, 'Lá Số B')}
        </div>
      </div>

      {/* Action Button */}
      <div className="flex justify-center">
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
      </div>

      {/* Result Card */}
      {(result || loading) && (
        <div className="rounded-xl p-5 sm:p-6 border bg-[var(--t-card)] border-[var(--t-gold)]/50 space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--t-border)] pb-2.5">
            <h3 className="text-sm font-bold text-[var(--t-gold)]">
              Bản Luận Giải Hợp Bàn ({chartA?.birthInfo.name || 'Bên A'} & {chartB?.birthInfo.name || 'Bên B'})
            </h3>
            {loading && <RefreshCw className="w-4 h-4 text-[var(--t-gold)] animate-spin" />}
          </div>
          <div className="text-xs sm:text-sm text-[var(--t-text)] leading-relaxed">
            <MarkdownContent content={result} />
          </div>
        </div>
      )}
    </div>
  );
}
