/**
 * Local (on-device) reminder fallback used only while the device is offline,
 * so reminders still fire without the server. When online, the server engine
 * is the single source of truth (prevents duplicate alerts).
 */

import type { PlannerTask } from '../types.ts';
import type { KeyValueStorage } from './offlineQueue.ts';

const FIRED_KEY = 'obi_planner_local_fired_v1';
const OPEN = new Set(['PENDING', 'IN_PROGRESS', 'REVIEW']);

export interface LocalReminder {
  key: string;
  taskId: string;
  title: string;
  fireAt: number;
  dueAt: string | null;
  priority: string;
}

/** All reminder instants of open tasks (offsets before due + custom times). */
export function localReminderSlots(tasks: PlannerTask[]): LocalReminder[] {
  const out: LocalReminder[] = [];
  for (const t of tasks) {
    if (!OPEN.has(t.status)) continue;
    const times = new Set<number>();
    if (t.dueAt) {
      const due = new Date(t.dueAt).getTime();
      for (const off of t.reminderOffsets || []) times.add(due - off * 60_000);
    }
    for (const c of t.customReminderAts || []) times.add(new Date(c).getTime());
    for (const fireAt of times) {
      if (Number.isNaN(fireAt)) continue;
      out.push({ key: `${t.id}:${fireAt}`, taskId: t.id, title: t.title, fireAt, dueAt: t.dueAt ?? null, priority: t.priority });
    }
  }
  return out.sort((a, b) => a.fireAt - b.fireAt);
}

/**
 * Returns reminders that became due in (since, now] and haven't fired on this
 * device yet, marking them fired. A window cap avoids a burst of stale alerts
 * when the app was closed for a long time.
 */
export function collectDueLocalReminders(
  tasks: PlannerTask[],
  storage: KeyValueStorage,
  now: number,
  since: number,
  maxLookbackMs = 30 * 60_000
): LocalReminder[] {
  let fired: Record<string, number> = {};
  try {
    fired = JSON.parse(storage.getItem(FIRED_KEY) || '{}') || {};
  } catch {
    fired = {};
  }
  const from = Math.max(since, now - maxLookbackMs);
  const due = localReminderSlots(tasks).filter((r) => r.fireAt > from && r.fireAt <= now && !fired[r.key]);
  if (due.length) {
    for (const r of due) fired[r.key] = now;
    // prune entries older than 3 days
    for (const [k, at] of Object.entries(fired)) if (now - at > 3 * 86_400_000) delete fired[k];
    try {
      storage.setItem(FIRED_KEY, JSON.stringify(fired));
    } catch {
      /* ignore */
    }
  }
  return due;
}
