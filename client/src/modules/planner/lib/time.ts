/** Date helpers for the planner UI (browser-local timezone). */

const pad = (n: number) => String(n).padStart(2, '0');

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

/** ISO instant -> { date: 'YYYY-MM-DD', time: 'HH:mm' } in the browser timezone. */
export function splitLocal(iso?: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

/** Local date + time inputs -> ISO instant (with the browser's offset applied). */
export function joinLocal(date: string, time: string, allDay = false): string | null {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (allDay || !time ? '23:59' : time).split(':').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function formatTime(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Friendly due label: "Today 3:30 PM", "Tomorrow", "Mon 12 Nov", "2h overdue". */
export function formatDue(iso?: string | null, allDay = false, now = new Date()): string {
  if (!iso) return 'No due date';
  const d = new Date(iso);
  const time = allDay ? '' : ` ${formatTime(d)}`;
  if (isSameDay(d, now)) return `Today${time}`;
  if (isSameDay(d, addDays(now, 1))) return `Tomorrow${time}`;
  if (isSameDay(d, addDays(now, -1))) return `Yesterday${time}`;
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) }) + time;
}

export function relativeFromNow(iso: string | Date, now = new Date()): string {
  const diff = new Date(iso).getTime() - now.getTime();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const label =
    mins < 1 ? 'now' : mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`;
  if (label === 'now') return 'now';
  return diff >= 0 ? `in ${label}` : `${label} ago`;
}

export function formatDuration(minutes?: number | null): string {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
