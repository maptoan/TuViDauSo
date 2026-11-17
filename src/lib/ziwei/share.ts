import type { BirthInfo, BirthFormState } from './types';
import {
  calculateTrueSolarTime,
  isValidGregorianDate,
  resolveZiweiDayOffset,
  shiftGregorianDate,
} from './true-solar-time';

function isValidLongitude(longitude: number): boolean {
  return Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

function safeParseInt(raw: string | null | undefined, min: number, max: number): number | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  const num = Number(trimmed);
  if (!Number.isSafeInteger(num) || num < min || num > max) return null;
  return num;
}

/** 表单预览和提交共用：标准时区时间 + 经度修正 + 出生日期对应的均时差。 */
export function formToTrueSolarTime(form: Pick<BirthFormState, 'year' | 'month' | 'day' | 'clockHour' | 'clockMinute' | 'province' | 'longitude'>) {
  const isVietnam = form.province ? form.province.startsWith('Việt Nam') : true;
  return calculateTrueSolarTime({
    year: safeParseInt(form.year, 1, 9999) ?? 0,
    month: safeParseInt(form.month, 1, 12) ?? 0,
    day: safeParseInt(form.day, 1, 31) ?? 0,
    clockHour: safeParseInt(form.clockHour, 0, 23) ?? 0,
    clockMinute: safeParseInt(form.clockMinute, 0, 59) ?? 0,
    longitude: form.province ? form.longitude : undefined,
    utcOffsetMinutes: isVietnam ? 420 : 480,
  });
}

/** BirthFormState → BirthInfo
 *
 * 子时规则（倪海厦体系/三合派标准，以下均按真太阳时）：
 * · 23:00-23:59 = 晚子时，**按次日**排盘（日期 +1）
 * · 00:00-00:59 = 早子时，按本日排盘
 * 这与「时辰支同为子(0)」并不冲突——子时分早晚两段，需要在日期上区分。
 */
export function formToBirthInfo(form: BirthFormState): BirthInfo {
  const origYear = safeParseInt(form.year, 1, 9999) ?? 0;
  const origMonth = safeParseInt(form.month, 1, 12) ?? 0;
  const origDay = safeParseInt(form.day, 1, 31) ?? 0;
  let y = origYear;
  let m = origMonth;
  let d = origDay;
  let hour = 0;
  let origInput: BirthInfo['origInput'] = undefined;

  // 晚子时换日按真太阳时判定，与时辰支同一口径（见 true-solar-time.ts 的 resolveZiweiDayOffset）。
  if (!form.unknownTime) {
    const solar = formToTrueSolarTime(form);
    hour = solar.branch;
    const dayOffset = resolveZiweiDayOffset(solar);
    if (dayOffset !== 0 && solar.dateValid) {
      ({ year: y, month: m, day: d } = shiftGregorianDate({ year: y, month: m, day: d }, dayOffset));
    }
    origInput = {
      year: origYear,
      month: origMonth,
      day: origDay,
      clockHour: safeParseInt(form.clockHour, 0, 23) ?? 0,
      clockMinute: safeParseInt(form.clockMinute, 0, 59) ?? 0,
    };
  }

  return {
    year: y, month: m, day: d,
    hour,
    gender: form.gender,
    name: form.name || undefined,
    province: form.province || undefined,
    city: form.city || undefined,
    longitude: form.province ? form.longitude : undefined,
    origInput,
  };
}

/** BirthFormState → URLSearchParams（用于分享链接） */
export function formToSearchParams(form: BirthFormState): URLSearchParams {
  const p = new URLSearchParams();
  if (form.name) p.set('n', form.name);
  p.set('y', form.year);
  p.set('m', form.month);
  p.set('d', form.day);
  if (form.unknownTime) {
    p.set('u', '1');
  } else {
    p.set('h', form.clockHour);
    p.set('mi', form.clockMinute);
  }
  if (form.province) p.set('p', form.province);
  if (form.city) p.set('c', form.city);
  if (form.longitude !== 120 && isValidLongitude(form.longitude)) p.set('lo', String(form.longitude));
  p.set('g', form.gender === 'male' ? 'm' : 'f');
  return p;
}

/** URLSearchParams → Partial<BirthFormState>，không hợp lệ hoặc NaN trả về null */
export function searchParamsToForm(params: URLSearchParams): Partial<BirthFormState> | null {
  const yNum = safeParseInt(params.get('y'), 1900, 2100);
  const mNum = safeParseInt(params.get('m'), 1, 12);
  const dNum = safeParseInt(params.get('d'), 1, 31);
  if (yNum === null || mNum === null || dNum === null) return null;
  if (!isValidGregorianDate(yNum, mNum, dNum)) return null;

  const rawHour = params.get('h');
  const hNum = rawHour !== null && rawHour.trim() !== '' ? safeParseInt(rawHour, 0, 23) : 8;
  if (hNum === null) return null;

  const rawMin = params.get('mi');
  const miNum = rawMin !== null && rawMin.trim() !== '' ? safeParseInt(rawMin, 0, 59) : 0;
  if (miNum === null) return null;

  const rawLongitude = params.get('lo')?.trim();
  const parsedLon = rawLongitude ? Number(rawLongitude) : 120;
  const longitude = isValidLongitude(parsedLon) ? parsedLon : 120;

  return {
    name: params.get('n') || '',
    year: String(yNum),
    month: String(mNum),
    day: String(dNum),
    unknownTime: params.get('u') === '1',
    clockHour: String(hNum),
    clockMinute: String(miNum),
    province: params.get('p') || '',
    city: params.get('c') || '',
    longitude,
    gender: params.get('g') === 'f' ? 'female' : 'male',
  };
}
