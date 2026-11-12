import type { ListParams, PlannerTask } from '../types.ts';

/**
 * Client-side mirror of the server's smart filters. Used to answer queries from
 * the offline cache and to apply optimistic updates instantly. Kept pure so it
 * can be unit-tested with node:test.
 */

const OPEN = new Set(['PENDING', 'IN_PROGRESS', 'REVIEW']);

function dayStart(d: Date, offsetDays = 0): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offsetDays);
}

export function isTaskOverdue(t: Pick<PlannerTask, 'dueAt' | 'status'>, now = new Date()): boolean {
  return !!t.dueAt && new Date(t.dueAt).getTime() < now.getTime() && OPEN.has(t.status);
}

export function matchesFilter(t: PlannerTask, params: ListParams, me: string, now = new Date()): boolean {
  const due = t.dueAt ? new Date(t.dueAt) : null;
  const inRange = (from: Date, to: Date) => !!due && due >= from && due < to;
  const filter = params.filter || 'ALL';

  if (t.status === 'ARCHIVED' && filter !== 'COMPLETED') return false;

  switch (filter) {
    case 'TODAY':
      if (!inRange(dayStart(now), dayStart(now, 1))) return false;
      break;
    case 'TOMORROW':
      if (!inRange(dayStart(now, 1), dayStart(now, 2))) return false;
      break;
    case 'THIS_WEEK': {
      const dow = now.getDay();
      const monday = dayStart(now, dow === 0 ? -6 : 1 - dow);
      if (!inRange(monday, new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7))) return false;
      break;
    }
    case 'THIS_MONTH':
      if (!inRange(new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1))) return false;
      break;
    case 'UPCOMING':
      if (!due || due < now || due.getTime() > now.getTime() + 7 * 86_400_000 || !OPEN.has(t.status)) return false;
      break;
    case 'HIGH_PRIORITY':
      if (!(t.priority === 'HIGH' || t.priority === 'CRITICAL') || !OPEN.has(t.status)) return false;
      break;
    case 'OVERDUE':
      if (!isTaskOverdue(t, now)) return false;
      break;
    case 'COMPLETED':
      if (t.status !== 'COMPLETED') return false;
      break;
    case 'ASSIGNED_TO_ME':
      if (!t.assigneeIds.includes(me) || t.ownerId === me) return false;
      break;
    case 'PROJECT':
      if (!(t.category === 'PROJECT' || t.projectName)) return false;
      break;
    case 'MEETING':
      if (t.category !== 'MEETING_REMINDER') return false;
      break;
    default:
      break;
  }

  const csv = (v?: string) => (v ? v.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : []);
  const statuses = csv(params.status);
  if (statuses.length) {
    const eff = isTaskOverdue(t, now) ? 'OVERDUE' : t.status;
    if (!statuses.includes(eff) && !statuses.includes(t.status)) return false;
  }
  const priorities = csv(params.priority);
  if (priorities.length && !priorities.includes(t.priority)) return false;
  const categories = csv(params.category);
  if (categories.length && !categories.includes(t.category)) return false;
  if (params.tag && !t.tags.includes(params.tag)) return false;
  if (params.project && (t.projectName || '').toLowerCase() !== params.project.toLowerCase()) return false;
  if (params.assignee && !(t.assigneeIds.includes(params.assignee) || t.ownerId === params.assignee)) return false;

  if (params.q && params.q.trim()) {
    const q = params.q.trim().toLowerCase();
    const hay = [t.title, t.description, t.projectName, t.location, t.category, t.priority, t.status, ...t.tags, ...t.assigneeIds, t.ownerId]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .replace(/_/g, ' ');
    if (!hay.includes(q.replace(/_/g, ' '))) return false;
  }
  return true;
}

const PRIORITY_WEIGHT: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

export function sortTasks(tasks: PlannerTask[]): PlannerTask[] {
  return [...tasks].sort((a, b) => {
    const ad = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bd = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    if (ad !== bd) return ad - bd;
    return (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0);
  });
}

/** Kanban ordering: by `position`, then due date. */
export function sortByPosition(tasks: PlannerTask[]): PlannerTask[] {
  return [...tasks].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return sortTasks([a, b])[0] === a ? -1 : 1;
  });
}

/** Position for a card dropped between `before` and `after` (fractional indexing). */
export function positionBetween(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return 1000;
  if (before === undefined) return after! - 1000;
  if (after === undefined) return before + 1000;
  return (before + after) / 2;
}
