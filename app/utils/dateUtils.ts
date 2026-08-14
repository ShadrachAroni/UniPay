/**
 * UniPay Date Utilities
 * Shared helpers for date range presets, UTC boundary conversion,
 * calendar grid computation, and localized formatting.
 */

// ─── Preset Types ────────────────────────────────────────────────
export type PresetKey = 'today' | 'last_7d' | 'last_30d' | 'this_month' | 'custom';

export interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
}

export interface UTCRange {
  from: string; // ISO 8601
  to: string;   // ISO 8601
}

export interface PresetOption {
  key: PresetKey;
  label: Record<'en' | 'sw', string>;
}

// ─── Default Presets ─────────────────────────────────────────────
export const DEFAULT_PRESETS: PresetOption[] = [
  { key: 'today',      label: { en: 'Today',        sw: 'Leo' } },
  { key: 'last_7d',    label: { en: 'Last 7 days',  sw: 'Siku 7 zilizopita' } },
  { key: 'last_30d',   label: { en: 'Last 30 days', sw: 'Siku 30 zilizopita' } },
  { key: 'this_month', label: { en: 'This month',   sw: 'Mwezi huu' } },
  { key: 'custom',     label: { en: 'Custom range', sw: 'Kipindi maalum' } },
];

// ─── Localized Labels ────────────────────────────────────────────
const MONTH_NAMES: Record<'en' | 'sw', string[]> = {
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  sw: ['Januari','Februari','Machi','Aprili','Mei','Juni','Julai','Agosti','Septemba','Oktoba','Novemba','Desemba'],
};

const MONTH_NAMES_SHORT: Record<'en' | 'sw', string[]> = {
  en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  sw: ['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ago','Sep','Okt','Nov','Des'],
};

const DAY_NAMES_SHORT: Record<'en' | 'sw', string[]> = {
  en: ['Su','Mo','Tu','We','Th','Fr','Sa'],
  sw: ['Jp','Jt','Jn','Jt','Al','Ij','Jm'],
};

export function getMonthName(month: number, locale: 'en' | 'sw' = 'en', short = false): string {
  return short ? MONTH_NAMES_SHORT[locale][month] : MONTH_NAMES[locale][month];
}

export function getDayNames(locale: 'en' | 'sw' = 'en'): string[] {
  return DAY_NAMES_SHORT[locale];
}

// ─── Preset Range Computation ────────────────────────────────────
export function getPresetRange(preset: PresetKey): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'today':
      return { startDate: today, endDate: today };

    case 'last_7d': {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { startDate: start, endDate: today };
    }

    case 'last_30d': {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      return { startDate: start, endDate: today };
    }

    case 'this_month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate: start, endDate: today };
    }

    case 'custom':
    default:
      return { startDate: null, endDate: null };
  }
}

// ─── UTC Boundary Conversion ─────────────────────────────────────
/**
 * Converts a local date range to UTC ISO boundaries.
 * "startDate" becomes start-of-day in the given timezone → UTC.
 * "endDate" becomes end-of-day (23:59:59.999) in the given timezone → UTC.
 *
 * For Africa/Nairobi (UTC+3):
 *   Local 2026-08-14 00:00 → UTC 2026-08-13T21:00:00.000Z
 *   Local 2026-08-14 23:59 → UTC 2026-08-14T20:59:59.999Z
 */
export function toUTCRange(startDate: Date, endDate: Date, timezoneOffsetHours = 3): UTCRange {
  const offsetMs = timezoneOffsetHours * 60 * 60 * 1000;
  const startUTC = new Date(
    Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0) - offsetMs,
  );
  const endUTC = new Date(
    Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999) - offsetMs,
  );

  return {
    from: startUTC.toISOString(),
    to: endUTC.toISOString(),
  };
}

/**
 * Detects the device timezone offset in hours from UTC.
 * Falls back to +3 (Africa/Nairobi) if detection fails.
 */
export function getDeviceTimezoneOffsetHours(): number {
  try {
    // getTimezoneOffset returns minutes, negative for east of UTC
    // e.g. Nairobi (UTC+3) returns -180
    return -(new Date().getTimezoneOffset() / 60);
  } catch {
    return 3; // Default: Africa/Nairobi
  }
}

// ─── Calendar Grid Helpers ───────────────────────────────────────
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Returns 0 (Sun) through 6 (Sat) for the first day of the given month.
 */
export function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/**
 * Generates a 6-row × 7-col grid of day numbers (or null for empty cells)
 * for rendering a calendar month view.
 */
export function getCalendarGrid(year: number, month: number): (number | null)[][] {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const grid: (number | null)[][] = [];
  let day = 1;

  for (let row = 0; row < 6; row++) {
    const week: (number | null)[] = [];
    for (let col = 0; col < 7; col++) {
      if (row === 0 && col < firstDay) {
        week.push(null);
      } else if (day > daysInMonth) {
        week.push(null);
      } else {
        week.push(day);
        day++;
      }
    }
    grid.push(week);
    if (day > daysInMonth) break;
  }

  return grid;
}

// ─── Display Formatting ──────────────────────────────────────────
export function formatDateRange(start: Date | null, end: Date | null, locale: 'en' | 'sw' = 'en'): string {
  if (!start && !end) return locale === 'sw' ? 'Chagua kipindi' : 'Select date range';
  if (start && !end) return `${getMonthName(start.getMonth(), locale, true)} ${start.getDate()}, ${start.getFullYear()}`;
  if (!start || !end) return '';

  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const sameDay = sameMonth && start.getDate() === end.getDate();

  if (sameDay) {
    return `${getMonthName(start.getMonth(), locale, true)} ${start.getDate()}, ${start.getFullYear()}`;
  }

  if (sameMonth) {
    return `${getMonthName(start.getMonth(), locale, true)} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
  }

  return `${getMonthName(start.getMonth(), locale, true)} ${start.getDate()} – ${getMonthName(end.getMonth(), locale, true)} ${end.getDate()}, ${end.getFullYear()}`;
}

// ─── Date Comparison Helpers ─────────────────────────────────────
export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isInRange(date: Date, start: Date | null, end: Date | null): boolean {
  if (!start || !end) return false;
  const d = date.getTime();
  return d >= start.getTime() && d <= end.getTime();
}

export function isAfterToday(date: Date): boolean {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return date.getTime() > today.getTime();
}
