import { RepeatFrequency, RepeatUnit } from './constants';
import { daysInMonth, getZonedParts, safeTimezone, zonedTimeToUtc } from './timezone';

export interface RecurrenceRule {
  frequency: Exclude<RepeatFrequency, 'NEVER'>;
  interval: number;
  unit: RepeatUnit;
  daysOfWeek: number[];
  timezone: string;
  anchorAt: Date;
  endsAt?: Date | null;
  maxOccurrences?: number | null;
}

const DAY_MS = 86_400_000;

/** Calendar day number (days since epoch) of a local Y/M/D, independent of timezone. */
function dayNumber(y: number, m: number, d: number): number {
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

function fromDayNumber(n: number): { year: number; month: number; day: number; weekday: number } {
  const dt = new Date(n * DAY_MS);
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate(), weekday: dt.getUTCDay() };
}

/** Normalises user input into a rule the engine can evaluate. */
export function normaliseRule(rule: RecurrenceRule): RecurrenceRule {
  const interval = Math.max(1, Math.min(365, Math.floor(rule.interval || 1)));
  let frequency = rule.frequency;
  let unit = rule.unit || 'DAY';
  if (frequency === 'CUSTOM') {
    // CUSTOM is sugar for "every N <unit>".
    unit = unit || 'DAY';
  }
  const daysOfWeek = Array.from(new Set((rule.daysOfWeek || []).filter((d) => d >= 0 && d <= 6))).sort();
  return { ...rule, frequency, interval, unit, daysOfWeek, timezone: safeTimezone(rule.timezone) };
}

/**
 * Returns the first occurrence strictly after `after`, or null when the series has ended.
 * The anchor itself is occurrence #1 (it is the template task); `generatedCount`
 * is how many occurrences already exist and is checked against `maxOccurrences`.
 */
export function nextOccurrence(input: RecurrenceRule, after: Date, generatedCount = 1): Date | null {
  const rule = normaliseRule(input);
  if (rule.maxOccurrences && generatedCount >= rule.maxOccurrences) return null;

  const tz = rule.timezone;
  const anchor = getZonedParts(rule.anchorAt, tz);
  const anchorDay = dayNumber(anchor.year, anchor.month, anchor.day);
  const at = (y: number, m: number, d: number) =>
    zonedTimeToUtc({ year: y, month: m, day: d, hour: anchor.hour, minute: anchor.minute }, tz);

  const effectiveAfter = after.getTime() < rule.anchorAt.getTime() ? new Date(rule.anchorAt.getTime()) : after;
  const ap = getZonedParts(effectiveAfter, tz);
  const afterDay = dayNumber(ap.year, ap.month, ap.day);

  let result: Date | null = null;

  const freq = rule.frequency === 'CUSTOM' ? rule.unit : rule.frequency;

  switch (freq) {
    case 'DAILY':
    case 'DAY':
    case 'WEEK': {
      const step = freq === 'WEEK' ? rule.interval * 7 : rule.interval;
      let k = Math.max(0, Math.floor((afterDay - anchorDay) / step));
      for (let guard = 0; guard < 4 && !result; guard++, k++) {
        const d = fromDayNumber(anchorDay + k * step);
        const candidate = at(d.year, d.month, d.day);
        if (candidate.getTime() > effectiveAfter.getTime()) result = candidate;
      }
      break;
    }
    case 'WEEKDAYS': {
      for (let i = 0; i <= 8 && !result; i++) {
        const d = fromDayNumber(afterDay + i);
        if (d.weekday === 0 || d.weekday === 6) continue;
        const candidate = at(d.year, d.month, d.day);
        if (candidate.getTime() > effectiveAfter.getTime()) result = candidate;
      }
      break;
    }
    case 'WEEKLY': {
      const days = rule.daysOfWeek.length ? rule.daysOfWeek : [anchor.weekday];
      const anchorWeekStart = anchorDay - anchor.weekday;
      const horizon = rule.interval * 7 + 7;
      for (let i = 0; i <= horizon && !result; i++) {
        const n = afterDay + i;
        const d = fromDayNumber(n);
        if (!days.includes(d.weekday)) continue;
        const weekIndex = Math.floor((n - anchorWeekStart) / 7);
        if (weekIndex < 0 || weekIndex % rule.interval !== 0) continue;
        const candidate = at(d.year, d.month, d.day);
        if (candidate.getTime() > effectiveAfter.getTime()) result = candidate;
      }
      break;
    }
    case 'MONTHLY':
    case 'MONTH':
    case 'YEARLY':
    case 'YEAR': {
      const stepMonths = freq === 'YEARLY' || freq === 'YEAR' ? 12 * rule.interval : rule.interval;
      const anchorIdx = anchor.year * 12 + (anchor.month - 1);
      const afterIdx = ap.year * 12 + (ap.month - 1);
      let k = Math.max(0, Math.floor((afterIdx - anchorIdx) / stepMonths));
      for (let guard = 0; guard < 4 && !result; guard++, k++) {
        const idx = anchorIdx + k * stepMonths;
        const year = Math.floor(idx / 12);
        const month = (idx % 12) + 1;
        // Clamp e.g. Jan 31 -> Feb 28/29, Feb 29 -> Feb 28 in non-leap years.
        const day = Math.min(anchor.day, daysInMonth(year, month));
        const candidate = at(year, month, day);
        if (candidate.getTime() > effectiveAfter.getTime()) result = candidate;
      }
      break;
    }
    default:
      result = null;
  }

  if (result && rule.endsAt && result.getTime() > rule.endsAt.getTime()) return null;
  return result;
}

/** Lists up to `limit` occurrences in [from, to] — used by the calendar to project future instances. */
export function occurrencesBetween(rule: RecurrenceRule, from: Date, to: Date, limit = 200, generatedCount = 1): Date[] {
  const out: Date[] = [];
  let cursor = new Date(from.getTime() - 1);
  let count = generatedCount;
  if (rule.anchorAt.getTime() >= from.getTime() && rule.anchorAt.getTime() <= to.getTime()) {
    out.push(new Date(rule.anchorAt));
    cursor = new Date(rule.anchorAt);
  }
  while (out.length < limit) {
    const next = nextOccurrence(rule, cursor, count);
    if (!next || next.getTime() > to.getTime()) break;
    out.push(next);
    cursor = next;
    count++;
  }
  return out;
}
