import type { Prisma, PlannerTask } from '@prisma/client';
import { prisma } from '../../../config/db';
import { AppError } from '../../../middleware/errorHandler';
import { Viewer, isAdminRole, isManagerRole } from '../domain/access';
import { OPEN_STATUSES, TASK_CATEGORIES } from '../domain/constants';
import { formatDateKey, safeTimezone } from '../domain/timezone';

export interface ReportSummary {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  cancelled: number;
  completionRate: number; // %
  onTimeRate: number; // % of completed tasks finished before due
  avgCompletionHours: number | null;
  byCategory: Array<{ category: string; total: number; completed: number }>;
  byPriority: Array<{ priority: string; total: number; completed: number }>;
  daily: Array<{ date: string; created: number; completed: number }>;
  perEmployee: Array<{ employeeId: string; name: string; total: number; completed: number; overdue: number; avgCompletionHours: number | null }>;
}

/** Pure aggregation (unit-tested). */
export function aggregateReport(tasks: PlannerTask[], opts: { from: Date; to: Date; tz: string; now?: Date; names?: Map<string, string> }): ReportSummary {
  const now = opts.now ?? new Date();
  const tz = safeTimezone(opts.tz);
  const isOver = (t: PlannerTask) => !!t.dueAt && t.dueAt < now && OPEN_STATUSES.includes(t.status as any);
  const completed = tasks.filter((t) => t.status === 'COMPLETED');
  const durations = completed.filter((t) => t.completedAt).map((t) => (t.completedAt!.getTime() - t.createdAt.getTime()) / 3_600_000);
  const onTime = completed.filter((t) => !t.dueAt || (t.completedAt && t.completedAt <= t.dueAt));
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);

  const dailyMap = new Map<string, { created: number; completed: number }>();
  for (let d = new Date(opts.from); d <= opts.to && dailyMap.size < 120; d = new Date(d.getTime() + 86_400_000)) {
    dailyMap.set(formatDateKey(d, tz), { created: 0, completed: 0 });
  }
  for (const t of tasks) {
    const c = dailyMap.get(formatDateKey(t.createdAt, tz));
    if (c) c.created++;
    if (t.completedAt) {
      const k = dailyMap.get(formatDateKey(t.completedAt, tz));
      if (k) k.completed++;
    }
  }

  const group = <K extends string>(key: (t: PlannerTask) => K) => {
    const m = new Map<K, { total: number; completed: number }>();
    for (const t of tasks) {
      const g = m.get(key(t)) || { total: 0, completed: 0 };
      g.total++;
      if (t.status === 'COMPLETED') g.completed++;
      m.set(key(t), g);
    }
    return m;
  };

  const people = new Map<string, PlannerTask[]>();
  for (const t of tasks) {
    for (const id of new Set([t.ownerId, ...t.assigneeIds])) {
      const list = people.get(id) || [];
      list.push(t);
      people.set(id, list);
    }
  }

  return {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'PENDING').length,
    inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'REVIEW').length,
    completed: completed.length,
    overdue: tasks.filter(isOver).length,
    cancelled: tasks.filter((t) => t.status === 'CANCELLED').length,
    completionRate: pct(completed.length, tasks.filter((t) => t.status !== 'CANCELLED').length),
    onTimeRate: pct(onTime.length, completed.length),
    avgCompletionHours: avg(durations),
    byCategory: Array.from(group((t) => t.category as string).entries())
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => TASK_CATEGORIES.indexOf(a.category as any) - TASK_CATEGORIES.indexOf(b.category as any)),
    byPriority: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => ({ priority: p, ...(group((t) => t.priority as string).get(p) || { total: 0, completed: 0 }) })),
    daily: Array.from(dailyMap.entries()).map(([date, v]) => ({ date, ...v })),
    perEmployee: Array.from(people.entries())
      .map(([employeeId, list]) => {
        const done = list.filter((t) => t.status === 'COMPLETED');
        return {
          employeeId,
          name: opts.names?.get(employeeId) || employeeId,
          total: list.length,
          completed: done.length,
          overdue: list.filter(isOver).length,
          avgCompletionHours: avg(done.filter((t) => t.completedAt).map((t) => (t.completedAt!.getTime() - t.createdAt.getTime()) / 3_600_000)),
        };
      })
      .sort((a, b) => b.total - a.total),
  };
}

export async function getReport(
  viewer: Viewer & { timezone: string },
  q: { from?: Date; to?: Date; scope: 'MINE' | 'TEAM' | 'ALL'; employeeId?: string }
) {
  const to = q.to ?? new Date();
  const from = q.from ?? new Date(to.getTime() - 30 * 86_400_000);
  if (to.getTime() - from.getTime() > 366 * 86_400_000) throw new AppError('Report range is limited to one year', 400);

  let people: string[] = [viewer.employeeId];
  let scope = q.scope;
  if (scope !== 'MINE' && !isManagerRole(viewer.role)) scope = 'MINE';
  if (scope === 'ALL' && !isAdminRole(viewer.role)) scope = 'TEAM';

  if (scope === 'TEAM') {
    const team = viewer.department
      ? await prisma.employee.findMany({ where: { department: { equals: viewer.department, mode: 'insensitive' } }, select: { employeeId: true } })
      : [];
    people = Array.from(new Set([viewer.employeeId, ...team.map((t) => t.employeeId)]));
  }
  if (q.employeeId) {
    if (scope === 'MINE' && q.employeeId !== viewer.employeeId) throw new AppError('Not allowed to view this employee report', 403);
    if (scope === 'TEAM' && !people.includes(q.employeeId)) throw new AppError('Employee is not in your team', 403);
    people = [q.employeeId];
    if (scope === 'ALL') scope = 'TEAM'; // narrowed to a person
  }

  const range: Prisma.PlannerTaskWhereInput = {
    OR: [{ createdAt: { gte: from, lte: to } }, { dueAt: { gte: from, lte: to } }, { completedAt: { gte: from, lte: to } }],
  };
  const who: Prisma.PlannerTaskWhereInput =
    scope === 'ALL'
      ? { category: { not: 'PERSONAL' } }
      : {
          OR: [
            { ownerId: { in: people } },
            { assigneeIds: { hasSome: people } },
          ],
          ...(people.length === 1 && people[0] === viewer.employeeId ? {} : { category: { not: 'PERSONAL' } }),
        };

  const tasks = await prisma.plannerTask.findMany({ where: { AND: [range, who, { status: { not: 'ARCHIVED' } }] }, take: 5000 });
  const ids = Array.from(new Set(tasks.flatMap((t) => [t.ownerId, ...t.assigneeIds])));
  const emps = await prisma.employee.findMany({ where: { employeeId: { in: ids } }, select: { employeeId: true, firstName: true, lastName: true } });
  const names = new Map(emps.map((e) => [e.employeeId, `${e.firstName} ${e.lastName}`.trim()]));

  const summary = aggregateReport(tasks, { from, to, tz: viewer.timezone, names });
  const recent = await prisma.plannerTaskHistory.findMany({
    where: { taskId: { in: tasks.map((t) => t.id).slice(0, 1000) } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const titles = new Map(tasks.map((t) => [t.id, t.title]));
  return {
    range: { from, to, scope },
    summary,
    overdueTasks: tasks
      .filter((t) => t.dueAt && t.dueAt < new Date() && OPEN_STATUSES.includes(t.status as any))
      .sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime())
      .slice(0, 50)
      .map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt, priority: t.priority, ownerId: t.ownerId, ownerName: names.get(t.ownerId) })),
    history: recent.map((h) => ({ ...h, taskTitle: titles.get(h.taskId), actorName: names.get(h.actorId) || h.actorId })),
  };
}

/** CSV export of the task rows behind a report. */
export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v instanceof Date ? v.toISOString() : v === null || v === undefined ? '' : String(v);
    // Neutralise spreadsheet formula injection.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}
