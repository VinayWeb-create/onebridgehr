/**
 * Dependency-free timezone helpers built on Intl.
 *
 * All instants are stored in UTC; calendar maths (recurrence, quiet hours,
 * working days) happens on the wall-clock of an IANA timezone so that DST
 * transitions and non-UTC offsets (e.g. IST +05:30) are handled correctly.
 */

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number;
  second: number;
  weekday: number; // 0 = Sunday
}

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

const formatterCache = new Map<string, Intl.DateTimeFormat>();

export function isValidTimezone(tz: string | undefined | null): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function safeTimezone(tz: string | undefined | null): string {
  return isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
}

function getFormatter(tz: string): Intl.DateTimeFormat {
  let f = formatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    formatterCache.set(tz, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function getZonedParts(date: Date, tz: string): ZonedParts {
  const parts = getFormatter(safeTimezone(tz)).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '0';
  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10),
    day: parseInt(get('day'), 10),
    hour: parseInt(get('hour'), 10) % 24,
    minute: parseInt(get('minute'), 10),
    second: parseInt(get('second'), 10),
    weekday: WEEKDAYS[get('weekday')] ?? 0,
  };
}

/** Offset of `tz` from UTC at the given instant, in minutes (IST => +330). */
export function getTimezoneOffsetMinutes(date: Date, tz: string): number {
  const p = getZonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const actual = Math.floor(date.getTime() / 1000) * 1000;
  return Math.round((asUtc - actual) / 60000);
}

/**
 * Converts a wall-clock time in `tz` to a UTC instant.
 * Month/day overflow is normalised (e.g. day 32 => next month), which the
 * recurrence engine relies on.
 */
export function zonedTimeToUtc(
  wall: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number },
  tz: string
): Date {
  const zone = safeTimezone(tz);
  const guess = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour ?? 0, wall.minute ?? 0, wall.second ?? 0);
  // Two passes converge across DST boundaries.
  let offset = getTimezoneOffsetMinutes(new Date(guess), zone);
  let result = guess - offset * 60000;
  const offset2 = getTimezoneOffsetMinutes(new Date(result), zone);
  if (offset2 !== offset) {
    offset = offset2;
    result = guess - offset * 60000;
  }
  return new Date(result);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** "HH:mm" -> minutes since midnight. Invalid input returns null. */
export function parseHHmm(value: string | undefined | null): number | null {
  if (!value) return null;
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

export function formatDateKey(date: Date, tz: string): string {
  const p = getZonedParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Start of the local day (00:00 in tz) that contains `date`, as a UTC instant. */
export function startOfZonedDay(date: Date, tz: string): Date {
  const p = getZonedParts(date, tz);
  return zonedTimeToUtc({ year: p.year, month: p.month, day: p.day }, tz);
}

export function addZonedDays(date: Date, days: number, tz: string): Date {
  const p = getZonedParts(date, tz);
  return zonedTimeToUtc(
    { year: p.year, month: p.month, day: p.day + days, hour: p.hour, minute: p.minute, second: p.second },
    tz
  );
}
