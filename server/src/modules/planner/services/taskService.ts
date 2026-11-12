import type { Prisma, PlannerTask } from '@prisma/client';
import { prisma } from '../../../config/db';
import { AppError } from '../../../middleware/errorHandler';
import { socketService } from '../../../services/socketService';
import { OPEN_STATUSES, PRIORITY_WEIGHT } from '../domain/constants';
import { TaskPermission, Viewer, can, canAssignTo, getTaskPermissions, isAdminRole, isManagerRole } from '../domain/access';
import { addZonedDays, getZonedParts, safeTimezone, startOfZonedDay, zonedTimeToUtc } from '../domain/timezone';
import { CreateTaskInput, UpdateTaskInput, listQuerySchema } from '../domain/validators';
import { diffForHistory, recordHistory } from './historyService';
import { RepeatInput, getSeriesForTasks, upsertSeries } from './recurrenceService';
import { cancelTaskReminders, syncTaskReminders, taskRecipients } from './reminderService';
import { getAdminConfig, getPreferences } from './settingsService';
import { z } from 'zod';

export type ListQuery = z.infer<typeof listQuerySchema>;

// ---------------------------------------------------------------------------
// Viewer & access helpers
// ---------------------------------------------------------------------------

export async function resolveViewer(user: { employeeId: string; role: string }): Promise<Viewer & { name: string; timezone: string }> {
  const [emp, prefs] = await Promise.all([
    prisma.employee.findUnique({
      where: { employeeId: user.employeeId },
      select: { department: true, firstName: true, lastName: true },
    }),
    getPreferences(user.employeeId),
  ]);
  return {
    employeeId: user.employeeId,
    role: user.role,
    department: emp?.department ?? null,
    name: emp ? `${emp.firstName} ${emp.lastName}`.trim() : user.employeeId,
    timezone: safeTimezone(prefs.timezone),
  };
}

async function departmentsOf(employeeIds: string[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(employeeIds.filter(Boolean)));
  if (!ids.length) return new Map();
  const rows = await prisma.employee.findMany({ where: { employeeId: { in: ids } }, select: { employeeId: true, department: true } });
  return new Map(rows.map((r) => [r.employeeId, r.department]));
}

async function accessSubject(task: PlannerTask) {
  const depts = await departmentsOf(taskRecipients(task));
  return { ownerId: task.ownerId, assigneeIds: task.assigneeIds, category: task.category, departments: Array.from(depts.values()) };
}

export async function loadTask(id: string, viewer: Viewer, perm: TaskPermission): Promise<PlannerTask> {
  if (!/^[a-f0-9]{24}$/i.test(id)) throw new AppError('Task not found', 404);
  const task = await prisma.plannerTask.findUnique({ where: { id } });
  if (!task) throw new AppError('Task not found', 404);
  const perms = getTaskPermissions(viewer, await accessSubject(task));
  if (!perms.has('view')) throw new AppError('Task not found', 404); // don't leak existence
  if (!perms.has(perm)) throw new AppError('You do not have permission to perform this action on this task', 403);
  return task;
}

async function assertAssignable(viewer: Viewer, assigneeIds: string[]) {
  const ids = Array.from(new Set(assigneeIds)).filter((id) => id !== viewer.employeeId);
  if (!ids.length) return;
  const depts = await departmentsOf(ids);
  for (const id of ids) {
    if (!depts.has(id)) throw new AppError(`Employee ${id} not found`, 404);
    if (!canAssignTo(viewer, { employeeId: id, department: depts.get(id) })) {
      throw new AppError(`You can only share tasks with colleagues in your department (${id})`, 403);
    }
  }
}

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

export function isOverdue(task: Pick<PlannerTask, 'dueAt' | 'status'>, now = new Date()): boolean {
  return !!task.dueAt && task.dueAt.getTime() < now.getTime() && OPEN_STATUSES.includes(task.status as any);
}

export function serializeTask(
  task: PlannerTask,
  extra: { checklistTotal?: number; checklistDone?: number; repeat?: any; viewer?: Viewer; departments?: string[] } = {}
) {
  const overdue = isOverdue(task);
  return {
    ...task,
    isOverdue: overdue,
    effectiveStatus: overdue ? 'OVERDUE' : task.status,
    checklistTotal: extra.checklistTotal ?? 0,
    checklistDone: extra.checklistDone ?? 0,
    repeat: extra.repeat ?? null,
    permissions: extra.viewer
      ? Array.from(
          getTaskPermissions(extra.viewer, {
            ownerId: task.ownerId,
            assigneeIds: task.assigneeIds,
            category: task.category,
            departments: extra.departments,
          })
        )
      : undefined,
  };
}

function serializeRepeat(r: any) {
  if (!r || !r.isActive) return r ? { frequency: 'NEVER' } : null;
  return {
    id: r.id,
    frequency: r.frequency,
    interval: r.interval,
    unit: r.unit,
    daysOfWeek: r.daysOfWeek,
    endsAt: r.endsAt,
    maxOccurrences: r.maxOccurrences,
    nextOccurrenceAt: r.nextOccurrenceAt,
    isTemplate: undefined as boolean | undefined,
  };
}

async function decorate(tasks: PlannerTask[], viewer: Viewer) {
  if (!tasks.length) return [];
  const ids = tasks.map((t) => t.id);
  const [items, seriesMap, depts] = await Promise.all([
    prisma.plannerTaskChecklistItem.findMany({ where: { taskId: { in: ids } }, select: { taskId: true, isCompleted: true } }),
    getSeriesForTasks(Array.from(new Set(tasks.map((t) => t.seriesId).filter(Boolean) as string[]))),
    departmentsOf(tasks.flatMap((t) => taskRecipients(t))),
  ]);
  const totals = new Map<string, { total: number; done: number }>();
  for (const i of items) {
    const t = totals.get(i.taskId) || { total: 0, done: 0 };
    t.total++;
    if (i.isCompleted) t.done++;
    totals.set(i.taskId, t);
  }
  return tasks.map((t) => {
    const series = t.seriesId ? seriesMap.get(t.seriesId) : undefined;
    const repeat = series ? { ...serializeRepeat(series), isTemplate: series.templateTaskId === t.id } : null;
    return serializeTask(t, {
      checklistTotal: totals.get(t.id)?.total,
      checklistDone: totals.get(t.id)?.done,
      repeat,
      viewer,
      departments: taskRecipients(t).map((id) => depts.get(id) || ''),
    });
  });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

function dayRange(now: Date, tz: string, offsetDays: number, lengthDays = 1) {
  const start = startOfZonedDay(addZonedDays(now, offsetDays, tz), tz);
  const end = startOfZonedDay(addZonedDays(now, offsetDays + lengthDays, tz), tz);
  return { gte: start, lt: end };
}

function weekRange(now: Date, tz: string) {
  const p = getZonedParts(now, tz);
  const mondayOffset = p.weekday === 0 ? -6 : 1 - p.weekday;
  return dayRange(now, tz, mondayOffset, 7);
}

function monthRange(now: Date, tz: string) {
  const p = getZonedParts(now, tz);
  return {
    gte: zonedTimeToUtc({ year: p.year, month: p.month, day: 1 }, tz),
    lt: zonedTimeToUtc({ year: p.year, month: p.month + 1, day: 1 }, tz),
  };
}

async function scopeWhere(viewer: Viewer, scope: ListQuery['scope']): Promise<Prisma.PlannerTaskWhereInput> {
  const mine: Prisma.PlannerTaskWhereInput = { OR: [{ ownerId: viewer.employeeId }, { assigneeIds: { has: viewer.employeeId } }] };
  if (scope === 'MINE' || !isManagerRole(viewer.role)) return mine;
  if (scope === 'ALL' && isAdminRole(viewer.role)) {
    return { OR: [...(mine.OR as any[]), { category: { not: 'PERSONAL' } }] };
  }
  // TEAM: non-personal tasks owned by / shared with members of the viewer's department
  const team = viewer.department
    ? await prisma.employee.findMany({
        where: { department: { equals: viewer.department, mode: 'insensitive' } },
        select: { employeeId: true },
      })
    : [];
  const ids = team.map((t) => t.employeeId);
  return {
    OR: [
      ...(mine.OR as any[]),
      { AND: [{ category: { not: 'PERSONAL' } }, { OR: [{ ownerId: { in: ids } }, { assigneeIds: { hasSome: ids } }] }] },
    ],
  };
}

export async function listTasks(viewer: Viewer & { timezone: string }, query: ListQuery, now = new Date()) {
  const tz = viewer.timezone;
  const and: Prisma.PlannerTaskWhereInput[] = [await scopeWhere(viewer, query.scope)];

  if (query.includeArchived !== 'true' && query.filter !== 'COMPLETED') and.push({ status: { not: 'ARCHIVED' } });

  switch (query.filter) {
    case 'TODAY':
      and.push({ dueAt: dayRange(now, tz, 0) });
      break;
    case 'TOMORROW':
      and.push({ dueAt: dayRange(now, tz, 1) });
      break;
    case 'THIS_WEEK':
      and.push({ dueAt: weekRange(now, tz) });
      break;
    case 'THIS_MONTH':
      and.push({ dueAt: monthRange(now, tz) });
      break;
    case 'UPCOMING':
      and.push({ dueAt: { gte: now, lt: new Date(now.getTime() + 7 * 86_400_000) }, status: { in: [...OPEN_STATUSES] } });
      break;
    case 'HIGH_PRIORITY':
      and.push({ priority: { in: ['HIGH', 'CRITICAL'] }, status: { in: [...OPEN_STATUSES] } });
      break;
    case 'OVERDUE':
      and.push({ dueAt: { lt: now }, status: { in: [...OPEN_STATUSES] } });
      break;
    case 'COMPLETED':
      and.push({ status: 'COMPLETED' });
      break;
    case 'ASSIGNED_TO_ME':
      and.push({ assigneeIds: { has: viewer.employeeId }, ownerId: { not: viewer.employeeId } });
      break;
    case 'PROJECT':
      and.push({ OR: [{ category: 'PROJECT' }, { projectName: { not: null } }] });
      break;
    case 'MEETING':
      and.push({ category: 'MEETING_REMINDER' });
      break;
    default:
      break;
  }

  const csv = (v?: string) => (v ? v.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : []);
  if (query.status) {
    const statuses = csv(query.status);
    const wantsOverdue = statuses.includes('OVERDUE');
    const persisted = statuses.filter((s) => s !== 'OVERDUE');
    const ors: Prisma.PlannerTaskWhereInput[] = [];
    if (persisted.length) ors.push({ status: { in: persisted } });
    if (wantsOverdue) ors.push({ dueAt: { lt: now }, status: { in: [...OPEN_STATUSES] } });
    if (ors.length) and.push({ OR: ors });
  }
  if (query.priority) and.push({ priority: { in: csv(query.priority) } });
  if (query.category) and.push({ category: { in: csv(query.category) } });
  if (query.tag) and.push({ tags: { has: query.tag } });
  if (query.project) and.push({ projectName: { equals: query.project, mode: 'insensitive' } });
  if (query.assignee) and.push({ OR: [{ assigneeIds: { has: query.assignee } }, { ownerId: query.assignee }] });

  if (query.q && query.q.trim()) {
    const q = query.q.trim();
    const upper = q.toUpperCase().replace(/[\s-]+/g, '_');
    const people = await prisma.employee.findMany({
      where: {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { employeeId: { equals: q, mode: 'insensitive' } },
        ],
      },
      select: { employeeId: true },
      take: 50,
    });
    const peopleIds = people.map((p) => p.employeeId);
    and.push({
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { projectName: { contains: q, mode: 'insensitive' } },
        { location: { contains: q, mode: 'insensitive' } },
        { tags: { has: q } },
        { tags: { has: q.toLowerCase() } },
        { category: { contains: upper } },
        { priority: upper },
        { status: upper },
        ...(peopleIds.length ? [{ assigneeIds: { hasSome: peopleIds } }, { ownerId: { in: peopleIds } }] : []),
      ],
    });
  }

  const tasks = await prisma.plannerTask.findMany({
    where: { AND: and },
    orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
    take: query.limit,
  });
  // Tasks without a due date sort last; within equal due dates higher priority first.
  tasks.sort((a, b) => {
    const ad = a.dueAt ? a.dueAt.getTime() : Number.MAX_SAFE_INTEGER;
    const bd = b.dueAt ? b.dueAt.getTime() : Number.MAX_SAFE_INTEGER;
    if (ad !== bd) return ad - bd;
    return (PRIORITY_WEIGHT[b.priority as keyof typeof PRIORITY_WEIGHT] ?? 0) - (PRIORITY_WEIGHT[a.priority as keyof typeof PRIORITY_WEIGHT] ?? 0);
  });
  return decorate(tasks, viewer);
}

export async function getTaskDetail(id: string, viewer: Viewer) {
  const task = await loadTask(id, viewer, 'view');
  const [decorated] = await decorate([task], viewer);
  const [checklist, comments, attachments, history, reminders] = await Promise.all([
    prisma.plannerTaskChecklistItem.findMany({ where: { taskId: id }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
    prisma.plannerTaskComment.findMany({ where: { taskId: id }, orderBy: { createdAt: 'asc' } }),
    prisma.plannerTaskAttachment.findMany({ where: { taskId: id }, orderBy: { createdAt: 'desc' } }),
    prisma.plannerTaskHistory.findMany({ where: { taskId: id }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.plannerTaskNotification.findMany({
      where: { taskId: id, employeeId: viewer.employeeId },
      orderBy: { fireAt: 'asc' },
      select: { id: true, kind: true, offsetMinutes: true, fireAt: true, deliverAt: true, status: true, sentAt: true, action: true },
    }),
  ]);
  const people = await prisma.employee.findMany({
    where: { employeeId: { in: taskRecipients(task) } },
    select: { employeeId: true, firstName: true, lastName: true, profileImageUrl: true, department: true },
  });
  return { ...decorated, checklist, comments, attachments, history, reminders, people };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

function notifyChange(task: PlannerTask, event: 'created' | 'updated' | 'deleted', actorId: string) {
  for (const id of taskRecipients(task)) {
    if (id === actorId) continue;
    socketService.sendNotification(id, 'planner:task', { event, taskId: task.id, title: task.title });
  }
}

export async function createTask(viewer: Viewer & { timezone: string; name: string }, input: CreateTaskInput & { repeat?: RepeatInput | null }) {
  // Idempotent replay of offline-created tasks
  if (input.clientRequestId) {
    const dup = await prisma.plannerTask.findFirst({ where: { ownerId: viewer.employeeId, clientRequestId: input.clientRequestId } });
    if (dup) return (await decorate([dup], viewer))[0];
  }
  await assertAssignable(viewer, input.assigneeIds);

  const prefs = await getPreferences(viewer.employeeId);
  const admin = await getAdminConfig();
  const reminderOffsets =
    input.reminderOffsets ?? (input.dueAt ? (prefs.defaultReminderOffsets.length ? prefs.defaultReminderOffsets : admin.defaultReminderOffsets) : []);

  const last = await prisma.plannerTask.findFirst({
    where: { ownerId: viewer.employeeId, status: input.status ?? 'PENDING' },
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  const task = await prisma.plannerTask.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      category: input.category,
      priority: input.priority,
      status: input.status && input.status !== 'ARCHIVED' ? input.status : 'PENDING',
      ownerId: viewer.employeeId,
      assigneeIds: Array.from(new Set(input.assigneeIds.filter((id) => id !== viewer.employeeId))),
      projectName: input.projectName || null,
      tags: Array.from(new Set(input.tags.map((t) => t.toLowerCase()))),
      labelIds: input.labelIds,
      color: input.color ?? null,
      dueAt: input.dueAt ?? null,
      allDay: input.allDay,
      timezone: safeTimezone(input.timezone || viewer.timezone),
      reminderOffsets: Array.from(new Set(reminderOffsets)),
      customReminderAts: input.customReminderAts,
      estimatedMinutes: input.estimatedMinutes ?? null,
      location: input.location ?? null,
      position: (last?.position ?? 0) + 1000,
      source: input.source,
      clientRequestId: input.clientRequestId,
      completedAt: input.status === 'COMPLETED' ? new Date() : null,
    },
  });

  if (input.checklist.length) {
    await prisma.plannerTaskChecklistItem.createMany({
      data: input.checklist.map((c, i) => ({ taskId: task.id, title: c.title, isCompleted: !!c.isCompleted, position: i })),
    });
  }
  if (input.repeat && input.repeat.frequency !== 'NEVER') await upsertSeries(task, input.repeat);
  await syncTaskReminders(task);
  await recordHistory({ taskId: task.id, actorId: viewer.employeeId, action: 'CREATED', toValue: task.title });
  notifyChange(task, 'created', viewer.employeeId);
  const fresh = await prisma.plannerTask.findUniqueOrThrow({ where: { id: task.id } });
  return (await decorate([fresh], viewer))[0];
}

export async function updateTask(viewer: Viewer, id: string, input: UpdateTaskInput & { repeat?: RepeatInput | null }) {
  const before = await loadTask(id, viewer, 'collaborate');
  const canEdit = can(viewer, await accessSubject(before), 'edit');
  const keys = Object.keys(input).filter((k) => (input as any)[k] !== undefined);
  if (!canEdit) {
    const disallowed = keys.filter((k) => !['status', 'position'].includes(k));
    if (disallowed.length) throw new AppError(`Only the task owner can change: ${disallowed.join(', ')}`, 403);
  }
  if (input.assigneeIds) await assertAssignable(viewer, input.assigneeIds);

  const data: Prisma.PlannerTaskUpdateInput = {};
  const set = <K extends keyof UpdateTaskInput>(k: K, v: any = input[k]) => {
    if (input[k] !== undefined) (data as any)[k] = v;
  };
  set('title');
  set('description');
  set('category');
  set('priority');
  set('projectName', input.projectName || null);
  set('assigneeIds', input.assigneeIds ? Array.from(new Set(input.assigneeIds.filter((a) => a !== before.ownerId))) : undefined);
  set('dueAt');
  set('allDay');
  set('timezone');
  set('reminderOffsets', input.reminderOffsets ? Array.from(new Set(input.reminderOffsets)) : undefined);
  set('customReminderAts');
  set('tags', input.tags ? Array.from(new Set(input.tags.map((t) => t.toLowerCase()))) : undefined);
  set('labelIds');
  set('color');
  set('estimatedMinutes');
  set('location');
  set('position');
  if (input.status !== undefined && input.status !== before.status) {
    Object.assign(data, statusSideEffects(input.status));
  }

  const task = await prisma.plannerTask.update({ where: { id }, data });
  if (input.repeat !== undefined && canEdit) await upsertSeries(task, input.repeat);
  else if (input.dueAt !== undefined && task.seriesId) {
    const series = await prisma.plannerTaskRecurrence.findUnique({ where: { id: task.seriesId } });
    if (series?.templateTaskId === task.id && series.isActive) await upsertSeries(task, series as any);
  }
  await syncTaskReminders(task);
  await recordHistory(diffForHistory(id, viewer.employeeId, before, task));
  notifyChange(task, 'updated', viewer.employeeId);
  const fresh = await prisma.plannerTask.findUniqueOrThrow({ where: { id } });
  return (await decorate([fresh], viewer))[0];
}

function statusSideEffects(status: string): Prisma.PlannerTaskUpdateInput {
  const now = new Date();
  return {
    status,
    completedAt: status === 'COMPLETED' ? now : null,
    archivedAt: status === 'ARCHIVED' ? now : null,
    cancelledAt: status === 'CANCELLED' ? now : null,
  };
}

export async function setStatus(viewer: Viewer, id: string, status: string, position?: number) {
  return updateTask(viewer, id, { status: status as any, ...(position !== undefined ? { position } : {}) });
}

export async function deleteTask(viewer: Viewer, id: string) {
  const task = await loadTask(id, viewer, 'delete');
  await cancelTaskReminders(id, 'Task deleted');
  if (task.seriesId) {
    const series = await prisma.plannerTaskRecurrence.findUnique({ where: { id: task.seriesId } });
    if (series?.templateTaskId === id) {
      // Keep the series alive by promoting the latest open instance, otherwise stop it.
      const heir = await prisma.plannerTask.findFirst({
        where: { seriesId: series.id, id: { not: id }, status: { in: [...OPEN_STATUSES] } },
        orderBy: { occurrenceAt: 'desc' },
      });
      await prisma.plannerTaskRecurrence.update({
        where: { id: series.id },
        data: heir ? { templateTaskId: heir.id } : { isActive: false },
      });
    }
  }
  await prisma.$transaction([
    prisma.plannerTaskChecklistItem.deleteMany({ where: { taskId: id } }),
    prisma.plannerTaskComment.deleteMany({ where: { taskId: id } }),
    prisma.plannerTaskAttachment.deleteMany({ where: { taskId: id } }),
    prisma.plannerTask.delete({ where: { id } }),
  ]);
  await recordHistory({ taskId: id, actorId: viewer.employeeId, action: 'DELETED', fromValue: task.title });
  notifyChange(task, 'deleted', viewer.employeeId);
  return { id };
}

// Checklist -----------------------------------------------------------------

export async function addChecklistItem(viewer: Viewer, taskId: string, title: string) {
  await loadTask(taskId, viewer, 'collaborate');
  const last = await prisma.plannerTaskChecklistItem.findFirst({ where: { taskId }, orderBy: { position: 'desc' } });
  const item = await prisma.plannerTaskChecklistItem.create({ data: { taskId, title, position: (last?.position ?? -1) + 1 } });
  await recordHistory({ taskId, actorId: viewer.employeeId, action: 'CHECKLIST', field: 'added', toValue: title });
  return item;
}

export async function updateChecklistItem(
  viewer: Viewer,
  taskId: string,
  itemId: string,
  input: { title?: string; isCompleted?: boolean; position?: number }
) {
  await loadTask(taskId, viewer, 'collaborate');
  const item = await prisma.plannerTaskChecklistItem.findFirst({ where: { id: itemId, taskId } });
  if (!item) throw new AppError('Checklist item not found', 404);
  const updated = await prisma.plannerTaskChecklistItem.update({
    where: { id: itemId },
    data: {
      ...input,
      ...(input.isCompleted !== undefined
        ? { completedAt: input.isCompleted ? new Date() : null, completedBy: input.isCompleted ? viewer.employeeId : null }
        : {}),
    },
  });
  if (input.isCompleted !== undefined && input.isCompleted !== item.isCompleted) {
    await recordHistory({ taskId, actorId: viewer.employeeId, action: 'CHECKLIST', field: input.isCompleted ? 'checked' : 'unchecked', toValue: item.title });
  }
  return updated;
}

export async function deleteChecklistItem(viewer: Viewer, taskId: string, itemId: string) {
  await loadTask(taskId, viewer, 'collaborate');
  const res = await prisma.plannerTaskChecklistItem.deleteMany({ where: { id: itemId, taskId } });
  if (!res.count) throw new AppError('Checklist item not found', 404);
  await recordHistory({ taskId, actorId: viewer.employeeId, action: 'CHECKLIST', field: 'removed' });
  return { id: itemId };
}

// Comments & attachments ------------------------------------------------------

export async function addComment(viewer: Viewer & { name: string }, taskId: string, content: string) {
  const task = await loadTask(taskId, viewer, 'collaborate');
  const comment = await prisma.plannerTaskComment.create({ data: { taskId, authorId: viewer.employeeId, authorName: viewer.name, content } });
  await recordHistory({ taskId, actorId: viewer.employeeId, action: 'COMMENTED' });
  notifyChange(task, 'updated', viewer.employeeId);
  return comment;
}

export async function deleteComment(viewer: Viewer, taskId: string, commentId: string) {
  const task = await loadTask(taskId, viewer, 'view');
  const comment = await prisma.plannerTaskComment.findFirst({ where: { id: commentId, taskId } });
  if (!comment) throw new AppError('Comment not found', 404);
  if (comment.authorId !== viewer.employeeId && task.ownerId !== viewer.employeeId) {
    throw new AppError('You can only delete your own comments', 403);
  }
  await prisma.plannerTaskComment.delete({ where: { id: commentId } });
  return { id: commentId };
}

export async function addAttachment(
  viewer: Viewer,
  taskId: string,
  file: { fileName: string; fileUrl: string; mimeType?: string; sizeBytes?: number }
) {
  await loadTask(taskId, viewer, 'collaborate');
  const att = await prisma.plannerTaskAttachment.create({ data: { taskId, uploadedBy: viewer.employeeId, ...file } });
  await recordHistory({ taskId, actorId: viewer.employeeId, action: 'ATTACHMENT', toValue: file.fileName });
  return att;
}

export async function deleteAttachment(viewer: Viewer, taskId: string, attachmentId: string) {
  const task = await loadTask(taskId, viewer, 'collaborate');
  const att = await prisma.plannerTaskAttachment.findFirst({ where: { id: attachmentId, taskId } });
  if (!att) throw new AppError('Attachment not found', 404);
  if (att.uploadedBy !== viewer.employeeId && task.ownerId !== viewer.employeeId) {
    throw new AppError('You can only remove your own attachments', 403);
  }
  await prisma.plannerTaskAttachment.delete({ where: { id: attachmentId } });
  return { id: attachmentId };
}

// Dashboard -----------------------------------------------------------------

export async function getDashboard(viewer: Viewer & { timezone: string }, now = new Date()) {
  const tz = viewer.timezone;
  const mine = await scopeWhere(viewer, 'MINE');
  const today = dayRange(now, tz, 0);
  const open = { status: { in: [...OPEN_STATUSES] } };

  const [todayTasks, overdue, upcoming, completedToday, highPriority, followUps, meetings] = await Promise.all([
    prisma.plannerTask.findMany({ where: { AND: [mine, { dueAt: today, status: { notIn: ['ARCHIVED', 'CANCELLED'] } }] }, orderBy: { dueAt: 'asc' }, take: 50 }),
    prisma.plannerTask.findMany({ where: { AND: [mine, open, { dueAt: { lt: now } }] }, orderBy: { dueAt: 'asc' }, take: 50 }),
    prisma.plannerTask.findMany({
      where: { AND: [mine, open, { dueAt: { gte: today.lt, lt: new Date(today.lt.getTime() + 7 * 86_400_000) } }] },
      orderBy: { dueAt: 'asc' },
      take: 20,
    }),
    prisma.plannerTask.count({ where: { AND: [mine, { status: 'COMPLETED', completedAt: today }] } }),
    prisma.plannerTask.findMany({ where: { AND: [mine, open, { priority: { in: ['HIGH', 'CRITICAL'] } }] }, orderBy: { dueAt: 'asc' }, take: 20 }),
    prisma.plannerTask.findMany({
      where: { AND: [mine, open, { dueAt: today }, { category: { in: ['CLIENT_FOLLOWUP', 'CALL_REMINDER'] } }] },
      orderBy: { dueAt: 'asc' },
      take: 20,
    }),
    prisma.meeting.findMany({
      where: { participantIds: { has: viewer.employeeId }, startTime: today, status: { in: ['SCHEDULED', 'STARTED'] } },
      orderBy: { startTime: 'asc' },
      take: 20,
    }),
  ]);

  const [t, o, u, h, f] = await Promise.all([
    decorate(todayTasks, viewer),
    decorate(overdue, viewer),
    decorate(upcoming, viewer),
    decorate(highPriority, viewer),
    decorate(followUps, viewer),
  ]);
  return {
    counts: {
      today: todayTasks.filter((x) => OPEN_STATUSES.includes(x.status as any)).length,
      overdue: overdue.length,
      upcoming: upcoming.length,
      completedToday,
      highPriority: highPriority.length,
      meetingsToday: meetings.length,
      followUpsToday: followUps.length,
    },
    today: t,
    overdue: o,
    upcoming: u,
    highPriority: h,
    followUps: f,
    meetings: meetings.map((m) => ({ id: m.id, title: m.title, startTime: m.startTime, endTime: m.endTime, link: m.link, status: m.status })),
  };
}

// Lookups -------------------------------------------------------------------

export async function searchAssignableEmployees(viewer: Viewer, q?: string) {
  const where: Prisma.EmployeeWhereInput = {};
  if (!isAdminRole(viewer.role)) {
    where.department = viewer.department ? { equals: viewer.department, mode: 'insensitive' } : '__none__';
  }
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { employeeId: { contains: q, mode: 'insensitive' } },
    ];
  }
  const rows = await prisma.employee.findMany({
    where,
    select: { employeeId: true, firstName: true, lastName: true, department: true, designation: true, profileImageUrl: true },
    orderBy: { firstName: 'asc' },
    take: 50,
  });
  return rows;
}

/** Projects the employee is involved in: from legacy Task assignments and planner tasks. */
export async function listProjects(viewer: Viewer) {
  const [legacy, planner] = await Promise.all([
    prisma.task
      .findMany({ where: { employeeId: viewer.employeeId, projectName: { not: null } }, select: { projectName: true }, take: 500 })
      .catch(() => [] as Array<{ projectName: string | null }>),
    prisma.plannerTask.findMany({
      where: { OR: [{ ownerId: viewer.employeeId }, { assigneeIds: { has: viewer.employeeId } }], projectName: { not: null } },
      select: { projectName: true },
      take: 500,
    }),
  ]);
  const names = new Set<string>();
  for (const r of [...legacy, ...planner]) if (r.projectName) names.add(r.projectName.trim());
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

export async function listTags(viewer: Viewer) {
  const rows = await prisma.plannerTask.findMany({
    where: { OR: [{ ownerId: viewer.employeeId }, { assigneeIds: { has: viewer.employeeId } }] },
    select: { tags: true },
    take: 1000,
  });
  const counts = new Map<string, number>();
  for (const r of rows) for (const t of r.tags) counts.set(t, (counts.get(t) || 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}
