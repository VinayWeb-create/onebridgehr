import type { TaskPriority } from '../types.ts';

/**
 * Parses lightweight natural-language hints from a quick-add line:
 *   "Call client tomorrow 3pm !high"  -> due tomorrow 15:00, HIGH priority
 *   "Pay invoice today"               -> due today end of working day
 */
export function parseQuickAdd(text: string, now = new Date()): { title: string; dueAt: string | null; priority?: TaskPriority } {
  let title = ` ${text} `;
  let priority: TaskPriority | undefined;
  const pm = /\s!(low|medium|high|critical|urgent)\b/i.exec(title);
  if (pm) {
    const p = pm[1].toUpperCase();
    priority = (p === 'URGENT' ? 'CRITICAL' : p) as TaskPriority;
    title = title.replace(pm[0], ' ');
  }
  let day: Date | null = null;
  const dm = /\s(today|tonight|tomorrow|tmrw)\b/i.exec(title);
  if (dm) {
    day = new Date(now);
    if (/^tom|^tmrw/i.test(dm[1])) day.setDate(day.getDate() + 1);
    title = title.replace(dm[0], ' ');
  }
  let hh: number | null = null;
  let mm = 0;
  const tm = /\s(?:at\s)?(\d{1,2})(?::(\d{2}))?\s?(am|pm)\b/i.exec(title) || /\s(?:at\s)?([01]?\d|2[0-3]):([0-5]\d)\b/.exec(title);
  if (tm) {
    hh = Number(tm[1]) % 24;
    mm = tm[2] ? Number(tm[2]) : 0;
    const ap = tm[3]?.toLowerCase();
    if (ap === 'pm' && hh < 12) hh += 12;
    if (ap === 'am' && hh === 12) hh = 0;
    title = title.replace(tm[0], ' ');
    if (!day) {
      day = new Date(now);
      const candidate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hh, mm);
      if (candidate < now) day.setDate(day.getDate() + 1);
    }
  }
  let dueAt: string | null = null;
  if (day) {
    const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hh ?? (dm && /tonight/i.test(dm[1]) ? 20 : 18), hh !== null ? mm : 0);
    dueAt = d.toISOString();
  }
  return { title: title.replace(/\s+/g, ' ').trim() || text.trim(), dueAt, priority };
}
