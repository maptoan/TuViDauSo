import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PROVINCES } from '../lib/ziwei/cities';
import { formToTrueSolarTime, formToBirthInfo } from '../lib/ziwei/share';
import { generateChart } from '../lib/ziwei/algorithm';
import { ZiweiChart, BirthFormState } from '../lib/ziwei/types';
import { HistoryEntry } from '../lib/ziwei/history';
import type { LibraryHydrationStatus } from '../lib/chart-library';
import {
  translateProvinceName,
  VI_SHICHEN,
  VI_FAMOUS_PERSONS,
} from '../lib/ziwei/vi-i18n';
import { Compass, Clock, MapPin, Sparkles, History, Trash2, UserCheck, Pin, Library, BookOpen, X } from 'lucide-react';

export type ChartGenerationSource = 'user_form_submit' | 'famous_preset';

export interface BirthFormInlineDuplicateNotice {
  title: string;
  message: string;
  completedCount: number;
  hydrationStatus: LibraryHydrationStatus;
  onOpenDossier: () => void;
  onDismiss: () => void;
}

interface BirthFormProps {
  onChartGenerated: (
    chart: ZiweiChart,
    form: BirthFormState,
    source?: ChartGenerationSource,
  ) => void;
  initialState?: BirthFormState | null;
  historyItems?: HistoryEntry[];
  onSelectHistory?: (form: BirthFormState) => void;
  onRemoveHistory?: (id: string) => void;
  onOpenLibrary?: () => void;
  inlineDuplicateNotice?: BirthFormInlineDuplicateNotice | null;
  compact?: boolean;
  submitLabel?: string;
}

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 125 }, (_, i) => currentYear - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export const DEFAULT_BIRTH_FORM: BirthFormState = {
  name: 'Nguyễn Văn An',
  year: '1995',
  month: '8',
  day: '16',
  clockHour: '10',
  clockMinute: '30',
  unknownTime: false,
  province: 'Việt Nam — Miền Bắc',
  city: 'Hà Nội',
  longitude: 105.85,
  gender: 'male',
};

export function serializeBirthFormState(s: BirthFormState): string {
  return [
    s.name,
    s.year,
    s.month,
    s.day,
    s.clockHour,
    s.clockMinute,
    s.unknownTime ? '1' : '0',
    s.gender,
    s.province,
    s.city,
    String(s.longitude),
  ].join('|');
}

export default function BirthForm({
  onChartGenerated,
  initialState,
  historyItems = [],
  onSelectHistory,
  onRemoveHistory,
  onOpenLibrary,
  inlineDuplicateNotice = null,
  compact = false,
  submitLabel = 'An Sao Lập Lá Số',
}: BirthFormProps) {
  const [form, setForm] = useState<BirthFormState>(initialState ?? DEFAULT_BIRTH_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const lastSyncedInitialKeyRef = useRef<string>(
    serializeBirthFormState(initialState ?? DEFAULT_BIRTH_FORM),
  );

  useEffect(() => {
    if (!initialState) return;
    const nextKey = serializeBirthFormState(initialState);
    if (nextKey !== lastSyncedInitialKeyRef.current) {
      lastSyncedInitialKeyRef.current = nextKey;
      setForm(initialState);
    }
  }, [initialState]);

  const vnProvinces = useMemo(
    () => PROVINCES.filter((g) => g.name.startsWith('Việt Nam')),
    []
  );

  const currentProvince = useMemo(
    () => vnProvinces.find((g) => g.name === form.province) ?? vnProvinces[0] ?? PROVINCES[0],
    [form.province, vnProvinces]
  );

  const currentCity = useMemo(
    () => currentProvince.cities.find((c) => c.name === form.city) ?? currentProvince.cities[0],
    [currentProvince, form.city]
  );

  const numYear = parseInt(form.year) || 1995;
  const numMonth = parseInt(form.month) || 8;
  const daysInMonth = useMemo(
    () => getDaysInMonth(numYear, numMonth),
    [numYear, numMonth]
  );

  const trueSolarInfo = useMemo(() => {
    return formToTrueSolarTime({
      ...form,
      longitude: currentCity.longitude,
    });
  }, [form, currentCity]);

  const handleProvinceChange = (provinceName: string) => {
    const group = vnProvinces.find((g) => g.name === provinceName) ?? vnProvinces[0] ?? PROVINCES[0];
    const firstCity = group.cities[0];
    setForm((f) => ({
      ...f,
      province: provinceName,
      city: firstCity?.name ?? '',
      longitude: firstCity?.longitude ?? 105.85,
    }));
  };

  const handleCityChange = (cityName: string) => {
    const c = currentProvince.cities.find((item) => item.name === cityName);
    setForm((f) => ({
      ...f,
      city: cityName,
      longitude: c?.longitude ?? f.longitude,
    }));
  };

  const handleYearMonthChange = (key: 'year' | 'month', value: string) => {
    setForm((f) => {
      const updated = { ...f, [key]: value };
      const maxDay = getDaysInMonth(parseInt(updated.year) || 1995, parseInt(updated.month) || 1);
      if ((parseInt(updated.day) || 1) > maxDay) {
        updated.day = String(maxDay);
      }
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const normalizedForm: BirthFormState = {
        ...form,
        longitude: currentCity.longitude,
      };
      const birthInfo = formToBirthInfo(normalizedForm);
      const chart = generateChart(birthInfo);
      lastSyncedInitialKeyRef.current = serializeBirthFormState(normalizedForm);
      setForm(normalizedForm);
      onChartGenerated(chart, normalizedForm, 'user_form_submit');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể lập lá số, vui lòng kiểm tra lại ngày tháng.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFamousLoad = (personId: string) => {
    const p = VI_FAMOUS_PERSONS.find((item) => item.id === personId);
    if (!p) return;
    // Map branch index (0=Tý..11=Hợi) to clock hour
    const clockHour = p.hour === 0 ? 0 : p.hour * 2 - 1;
    const presetForm: BirthFormState = {
      name: p.name,
      year: String(p.year),
      month: String(p.month),
      day: String(p.day),
      clockHour: String(clockHour),
      clockMinute: '30',
      unknownTime: false,
      gender: p.gender,
      province: 'Việt Nam — Miền Bắc',
      city: 'Hà Nội',
      longitude: 105.85,
    };
    lastSyncedInitialKeyRef.current = serializeBirthFormState(presetForm);
    setForm(presetForm);
    try {
      const birthInfo = formToBirthInfo(presetForm);
      const chart = generateChart(birthInfo);
      onChartGenerated(chart, presetForm, 'famous_preset');
    } catch {
      // ignore
    }
  };

  const selectClass =
    'w-full rounded-lg px-2.5 py-2 text-sm border transition-colors focus:outline-none ' +
    'bg-[var(--t-bg)] border-[var(--t-border)] text-[var(--t-text)] focus:border-[var(--t-gold)]';

  const labelClass = 'block text-xs font-medium mb-1.5 text-[var(--t-text2)]';

  const shichenObj = VI_SHICHEN[trueSolarInfo.branch] ?? VI_SHICHEN[6];
  const solarTimeFormatted = `${String(trueSolarInfo.hour).padStart(2, '0')}:${String(
    trueSolarInfo.minute
  ).padStart(2, '0')}`;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl p-4 sm:p-5 space-y-4 border bg-[var(--t-card)] border-[var(--t-border)] shadow-sm"
    >
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--t-border)]">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-[var(--t-gold)] shrink-0" />
          <h2 className="text-sm font-semibold tracking-wide text-[var(--t-text)]">
            Thông Tin Khai Sinh (Dương Lịch)
          </h2>
        </div>

        {!compact && (historyItems.length > 0 || Boolean(onOpenLibrary)) && (
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-[var(--t-border)] text-[var(--t-text2)] hover:text-[var(--t-gold)] hover:border-[var(--t-gold)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            <span>Gần đây ({Math.min(historyItems.length, 10)})</span>
          </button>
        )}
      </div>

      {/* Saved Recent Drawer + Library Link */}
      {!compact && showHistory && (
        <div className="rounded-lg p-3 border border-[var(--t-border)] bg-[var(--t-surface)] space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--t-text2)]">
            <span className="font-medium">Lá số đã tra cứu gần đây</span>
            {onOpenLibrary && (
              <button
                type="button"
                onClick={() => {
                  setShowHistory(false);
                  onOpenLibrary();
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--t-gold)] hover:underline cursor-pointer"
              >
                <Library className="w-3 h-3" />
                <span>Mở Thư Viện ({historyItems.length})</span>
              </button>
            )}
          </div>
          <div className="max-h-44 overflow-y-auto space-y-1">
            {historyItems.slice(0, 10).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md hover:bg-[var(--t-card)] text-xs group"
              >
                <button
                  type="button"
                  onClick={() => {
                    lastSyncedInitialKeyRef.current = serializeBirthFormState(item.form);
                    setForm(item.form);
                    onSelectHistory?.(item.form);
                    setShowHistory(false);
                  }}
                  className="text-left flex-1 min-w-0 flex items-center gap-1.5 text-[var(--t-text)] group-hover:text-[var(--t-gold)] transition-colors cursor-pointer"
                >
                  {item.pinned && (
                    <Pin className="w-3 h-3 text-[var(--t-gold)] shrink-0" />
                  )}
                  <span className="truncate">{item.label}</span>
                  {(item.completedCount ?? 0) > 0 && (
                    <span className="shrink-0 font-mono-tabular text-[10px] px-1.5 py-0.5 rounded bg-[var(--t-gold)]/15 text-[var(--t-gold)]">
                      {item.completedCount}/8
                    </span>
                  )}
                </button>
                {onRemoveHistory && (
                  <button
                    type="button"
                    onClick={() => onRemoveHistory(item.id)}
                    className="text-[var(--t-faint)] hover:text-rose-400 p-1 cursor-pointer shrink-0"
                    title="Xóa"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {onOpenLibrary && (
            <button
              type="button"
              onClick={() => {
                setShowHistory(false);
                onOpenLibrary();
              }}
              className="w-full pt-2 border-t border-[var(--t-border)] text-center text-[11px] font-semibold text-[var(--t-gold)] hover:underline cursor-pointer"
            >
              Mở Toàn Bộ Thư Viện (Tìm kiếm · Ghi chú · Sao lưu)...
            </button>
          )}
        </div>
      )}

      {/* Name & Gender Row */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-7">
          <label className={labelClass}>Họ tên đương số</label>
          <input
            type="text"
            placeholder="Nhập họ tên (VD: Nguyễn Văn An)"
            value={form.name}
            maxLength={120}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={selectClass}
          />
        </div>
        <div className="sm:col-span-5">
          <label className={labelClass}>Giới tính (Âm Dương Thuận/Nghịch)</label>
          <div className="grid grid-cols-2 gap-2">
            {(['male', 'female'] as const).map((g) => {
              const active = form.gender === g;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, gender: g }))}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[var(--t-gold)]/15 border-[var(--t-gold)] text-[var(--t-gold)] font-semibold'
                      : 'bg-[var(--t-bg)] border-[var(--t-border)] text-[var(--t-text2)] hover:border-[var(--t-gold)]/40'
                  }`}
                >
                  {g === 'male' ? 'Nam Mệnh' : 'Nữ Mệnh'}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Solar Birth Date */}
      <div>
        <label className={labelClass}>Ngày sinh Dương lịch (Tự động quy đổi Âm lịch & Bát Tự)</label>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <select
              value={form.year}
              onChange={(e) => handleYearMonthChange('year', e.target.value)}
              className={`${selectClass} tabular-nums`}
            >
              {YEARS.map((y) => (
                <option key={y} value={String(y)}>
                  Năm {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={form.month}
              onChange={(e) => handleYearMonthChange('month', e.target.value)}
              className={`${selectClass} tabular-nums`}
            >
              {MONTHS.map((m) => (
                <option key={m} value={String(m)}>
                  Tháng {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={String(Math.min(parseInt(form.day) || 1, daysInMonth))}
              onChange={(e) => setForm((f) => ({ ...f, day: e.target.value }))}
              className={`${selectClass} tabular-nums`}
            >
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                <option key={d} value={String(d)}>
                  Ngày {d}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Birth Time */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-[var(--t-text2)] flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[var(--t-gold)]" />
            <span>Giờ sinh đồng hồ (24h)</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-[var(--t-text2)]">
            <input
              type="checkbox"
              checked={form.unknownTime}
              onChange={(e) => setForm((f) => ({ ...f, unknownTime: e.target.checked }))}
              className="rounded accent-amber-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span>Chưa rõ giờ sinh</span>
          </label>
        </div>

        {form.unknownTime ? (
          <div className="rounded-lg px-3 py-2 text-xs border border-amber-500/30 bg-amber-500/10 text-amber-400">
            Khi chưa rõ giờ sinh, hệ thống tạm lấy <strong>Giờ Tý (00:00)</strong> để tham khảo cấu trúc sao năm/tháng/ngày.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.clockHour}
              onChange={(e) => setForm((f) => ({ ...f, clockHour: e.target.value }))}
              className={`${selectClass} tabular-nums`}
            >
              {HOURS.map((h) => (
                <option key={h} value={String(h)}>
                  {String(h).padStart(2, '0')} giờ
                </option>
              ))}
            </select>
            <select
              value={form.clockMinute}
              onChange={(e) => setForm((f) => ({ ...f, clockMinute: e.target.value }))}
              className={`${selectClass} tabular-nums`}
            >
              {MINUTES.map((m) => (
                <option key={m} value={String(m)}>
                  {String(m).padStart(2, '0')} phút
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Birthplace for True Solar Time */}
      <div>
        <label className={`${labelClass} flex items-center gap-1.5`}>
          <MapPin className="w-3.5 h-3.5 text-[var(--t-gold)]" />
          <span>Nơi sinh (Hiệu chỉnh Giờ Mặt Trời Thực theo Kinh Độ)</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select
            value={form.province}
            onChange={(e) => handleProvinceChange(e.target.value)}
            className={selectClass}
          >
            {vnProvinces.map((g) => (
              <option key={g.name} value={g.name}>
                {translateProvinceName(g.name)}
              </option>
            ))}
          </select>
          <select
            value={form.city}
            onChange={(e) => handleCityChange(e.target.value)}
            className={selectClass}
          >
            {currentProvince.cities.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.longitude.toFixed(2)}°Đ)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* True Solar Time Calibration Box */}
      {!form.unknownTime && (
        <div className="rounded-lg px-3.5 py-2.5 text-xs space-y-1 border bg-[var(--t-surface)] border-[var(--t-border)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--t-text2)]">Giờ Mặt Trời Thực (Chân Thái Dương Thời):</span>
            <span className="font-mono font-semibold text-[var(--t-gold)] tabular-nums">
              {solarTimeFormatted} · {shichenObj.name} ({shichenObj.range})
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[var(--t-faint)] tabular-nums">
            <span>
              Kinh độ {currentCity.longitude.toFixed(2)}°Đ ({trueSolarInfo.longitudeCorrectionMinutes >= 0 ? '+' : ''}
              {trueSolarInfo.longitudeCorrectionMinutes.toFixed(1)} phút)
            </span>
            <span>
              Phương trình thời gian: {trueSolarInfo.equationOfTimeMinutes >= 0 ? '+' : ''}
              {trueSolarInfo.equationOfTimeMinutes.toFixed(1)} phút
            </span>
          </div>
          {trueSolarInfo.hour === 23 && (
            <div className="text-[11px] text-amber-400 pt-0.5">
              ⚡ Giờ Dạ Tý (23:00–23:59): Tự động quy sang ngày hôm sau để an Giờ Tý chuẩn xác theo Thiên Kỷ.
            </div>
          )}
        </div>
      )}

      {/* Famous Presets Quick Selector */}
      {!compact && (
        <div className="pt-1">
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--t-text2)] mb-1.5">
            <UserCheck className="w-3.5 h-3.5 text-[var(--t-gold)]" />
            <span>Mẫu lá số kinh điển (Nhấn để nạp nhanh):</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {VI_FAMOUS_PERSONS.slice(0, 5).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleFamousLoad(p.id)}
                className="px-2.5 py-1 rounded-md text-[11px] border border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)] hover:text-[var(--t-gold)] hover:border-[var(--t-gold)]/50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {p.name} ({p.year})
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-rose-950/60 border border-rose-700/60 px-3 py-2 text-xs text-rose-300">
          {error}
        </div>
      )}

      {inlineDuplicateNotice && (
        <div className="rounded-lg border border-[var(--t-gold)]/55 bg-[var(--t-gold)]/10 px-3 py-2.5 text-xs space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="font-semibold text-[var(--t-gold)]">
              {inlineDuplicateNotice.title}
            </div>
            <button
              type="button"
              onClick={inlineDuplicateNotice.onDismiss}
              className="p-0.5 text-[var(--t-faint)] hover:text-[var(--t-text)] cursor-pointer shrink-0"
              title="Đóng thông báo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[var(--t-text2)] leading-relaxed">
            {inlineDuplicateNotice.message}
          </p>
          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={inlineDuplicateNotice.onOpenDossier}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[var(--t-gold)] text-slate-950 hover:opacity-95 cursor-pointer"
            >
              <BookOpen className="w-3 h-3" />
              <span>
                {inlineDuplicateNotice.completedCount > 0
                  ? `Mở Hồ Sơ (${inlineDuplicateNotice.completedCount}/8 Chương)`
                  : inlineDuplicateNotice.hydrationStatus === 'hydrating' ||
                      inlineDuplicateNotice.hydrationStatus === 'idle'
                    ? 'Mở Hồ Sơ (Đang nạp...)'
                    : 'Mở Hồ Sơ 8 Chương'}
              </span>
            </button>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 px-4 rounded-lg font-semibold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 bg-[var(--t-gold)] hover:opacity-95 text-slate-950 shadow-sm disabled:opacity-50 whitespace-nowrap shrink-0"
      >
        <Sparkles className="w-4 h-4" />
        <span>{loading ? 'Đang an sao lập bàn...' : submitLabel}</span>
      </button>
    </form>
  );
}
