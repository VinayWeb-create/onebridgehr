import { TaskPriority } from './constants';
import { formatDateKey, getZonedParts, parseHHmm, safeTimezone, zonedTimeToUtc } from './timezone';

export interface ReminderSlot {
  fireAt: Date;
  kind: 'OFFSET' | 'CUSTOM';
  offsetMinutes: number | null;
}

/**
 * Expands a task's reminder settings into concrete instants.
 * - offsets are minutes before `dueAt` (0 = at due time)
 * - custom reminder instants are used as-is
 * Past instants (older than `graceMs`) are dropped and duplicates collapsed.
 */
export function computeReminderSlots(
  input: { dueAt?: Date | null; reminderOffsets?: number[]; customReminderAts?: Date[] },
  now: Date,
  graceMs = 60_000
): ReminderSlot[] {
  const slots: ReminderSlot[] = [];
  const seen = new Set<number>();
  const push = (slot: ReminderSlot) => {
    const t = slot.fireAt.getTime();
    if (Number.isNaN(t) || t < now.getTime() - graceMs || seen.has(t)) return;
    seen.add(t);
    slots.push(slot);
  };

  if (input.dueAt) {
    for (const raw of input.reminderOffsets || []) {
      const offset = Math.max(0, Math.floor(raw));
      push({ fireAt: new Date(input.dueAt.getTime() - offset * 60_000), kind: 'OFFSET', offsetMinutes: offset });
    }
  }
  for (const custom of input.customReminderAts || []) {
    push({ fireAt: new Date(custom), kind: 'CUSTOM', offsetMinutes: null });
  }
  return slots.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}

export interface DeliveryPolicy {
  timezone: string;
  // Employee preferences
  dndEnabled: boolean;
  dndUntil?: Date | null;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  weekendReminders: boolean;
  workingDays: number[];
  workingHoursStart: string;
  workingHoursEnd: string;
  onlyDuringWorkingHours: boolean;
  // Company configuration
  companyQuietHoursEnabled?: boolean;
  companyQuietHoursStart?: string;
  companyQuietHoursEnd?: string;
  companyWeekendReminders?: boolean;
  holidayDateKeys?: Set<string>; // YYYY-MM-DD in the employee timezone
}

export interface DeliveryDecision {
  deliverAt: Date;
  deferred: boolean;
  reasons: string[];
  /** Deliver in-app only (no push / sound) — e.g. indefinite Do-Not-Disturb. */
  silent: boolean;
}

function minutesOfDay(date: Date, tz: string): number {
  const p = getZonedParts(date, tz);
  return p.hour * 60 + p.minute;
}

function inWindow(minute: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

/** Next instant (>= date) whose local time is `targetMinute`. */
function nextLocalTime(date: Date, targetMinute: number, tz: string): Date {
  const p = getZonedParts(date, tz);
  let candidate = zonedTimeToUtc(
    { year: p.year, month: p.month, day: p.day, hour: Math.floor(targetMinute / 60), minute: targetMinute % 60 },
    tz
  );
  if (candidate.getTime() < date.getTime()) {
    candidate = zonedTimeToUtc(
      { year: p.year, month: p.month, day: p.day + 1, hour: Math.floor(targetMinute / 60), minute: targetMinute % 60 },
      tz
    );
  }
  return candidate;
}

/**
 * Decides *when* a reminder may actually be delivered, honouring DND, quiet
 * hours, weekend/working-day and holiday rules. Mandatory reminders and
 * CRITICAL tasks bypass every rule.
 */
export function resolveDeliveryTime(
  fireAt: Date,
  policy: DeliveryPolicy,
  opts: { mandatory?: boolean; priority?: TaskPriority | string } = {}
): DeliveryDecision {
  const tz = safeTimezone(policy.timezone);
  if (opts.mandatory || opts.priority === 'CRITICAL') {
    return { deliverAt: fireAt, deferred: false, reasons: [], silent: false };
  }

  const reasons: string[] = [];
  let at = new Date(fireAt);
  let silent = false;

  if (policy.dndEnabled) {
    if (policy.dndUntil && policy.dndUntil.getTime() > at.getTime()) {
      at = new Date(policy.dndUntil);
      reasons.push('DND');
    } else if (!policy.dndUntil) {
      silent = true;
      reasons.push('DND_SILENT');
    }
  }

  const workStart = parseHHmm(policy.workingHoursStart) ?? 9 * 60;
  const workEnd = parseHHmm(policy.workingHoursEnd) ?? 18 * 60;
  const workingDays = policy.workingDays?.length ? policy.workingDays : [1, 2, 3, 4, 5];
  const weekendAllowed = policy.weekendReminders && policy.companyWeekendReminders !== false;

  const quietWindows: Array<[number, number]> = [];
  if (policy.quietHoursEnabled) {
    const s = parseHHmm(policy.quietHoursStart);
    const e = parseHHmm(policy.quietHoursEnd);
    if (s !== null && e !== null) quietWindows.push([s, e]);
  }
  if (policy.companyQuietHoursEnabled) {
    const s = parseHHmm(policy.companyQuietHoursStart);
    const e = parseHHmm(policy.companyQuietHoursEnd);
    if (s !== null && e !== null) quietWindows.push([s, e]);
  }

  // Apply rules until the instant is stable (each rule only ever moves time forward).
  for (let i = 0; i < 30; i++) {
    let moved = false;
    const minute = minutesOfDay(at, tz);

    for (const [s, e] of quietWindows) {
      if (inWindow(minute, s, e)) {
        at = nextLocalTime(at, e, tz);
        reasons.push('QUIET_HOURS');
        moved = true;
        break;
      }
    }
    if (moved) continue;

    const dateKey = formatDateKey(at, tz);
    const weekday = getZonedParts(at, tz).weekday;
    const isHoliday = policy.holidayDateKeys?.has(dateKey) ?? false;
    const isNonWorkingDay = !workingDays.includes(weekday);
    if (isHoliday || (!weekendAllowed && isNonWorkingDay)) {
      const p = getZonedParts(at, tz);
      at = zonedTimeToUtc(
        { year: p.year, month: p.month, day: p.day + 1, hour: Math.floor(workStart / 60), minute: workStart % 60 },
        tz
      );
      reasons.push(isHoliday ? 'HOLIDAY' : 'NON_WORKING_DAY');
      continue;
    }

    if (policy.onlyDuringWorkingHours && !(minute >= workStart && minute < workEnd)) {
      at = nextLocalTime(at, workStart, tz);
      reasons.push('OUTSIDE_WORKING_HOURS');
      continue;
    }
    break;
  }

  return { deliverAt: at, deferred: at.getTime() !== fireAt.getTime(), reasons: Array.from(new Set(reasons)), silent };
}

/** Resolves a snooze option ("5", "60", "TOMORROW" or an ISO instant) to an instant. */
export function resolveSnoozeUntil(
  option: string | number,
  now: Date,
  tz: string,
  workingHoursStart = '09:00'
): Date {
  if (typeof option === 'number' || /^\d+$/.test(String(option))) {
    const minutes = Math.max(1, Math.min(60 * 24 * 30, Number(option)));
    return new Date(now.getTime() + minutes * 60_000);
  }
  if (String(option).toUpperCase() === 'TOMORROW') {
    const start = parseHHmm(workingHoursStart) ?? 9 * 60;
    const p = getZonedParts(now, safeTimezone(tz));
    return zonedTimeToUtc(
      { year: p.year, month: p.month, day: p.day + 1, hour: Math.floor(start / 60), minute: start % 60 },
      safeTimezone(tz)
    );
  }
  const custom = new Date(String(option));
  if (Number.isNaN(custom.getTime()) || custom.getTime() <= now.getTime()) {
    throw new Error('Snooze time must be a future instant');
  }
  return custom;
}

export function reminderDedupeKey(parts: {
  taskId?: string | null;
  employeeId: string;
  kind: string;
  fireAt: Date;
  scope?: string;
}): string {
  return [parts.scope || 'task', parts.taskId || '-', parts.employeeId, parts.kind, parts.fireAt.toISOString()].join(':');
}

/** Exponential-ish backoff; returns null once attempts are exhausted. */
export function nextRetryAt(attempts: number, now: Date, maxAttempts: number, backoff: number[]): Date | null {
  if (attempts >= maxAttempts) return null;
  const minutes = backoff[Math.min(attempts - 1, backoff.length - 1)] ?? backoff[backoff.length - 1];
  return new Date(now.getTime() + Math.max(0, minutes) * 60_000);
}
