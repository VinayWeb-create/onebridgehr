import { NextFunction, Request, Response } from 'express';
import { prisma } from '../../../config/db';
import { AppError } from '../../../middleware/errorHandler';
import { isAdminRole } from '../domain/access';
import {
  COMPANY_REMINDER_KINDS,
  PROJECT_REMINDER_TEMPLATES,
  REMINDER_PRESETS,
  REPEAT_FREQUENCIES,
  SNOOZE_PRESETS,
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from '../domain/constants';
import {
  adminConfigSchema,
  attachmentLinkSchema,
  checklistCreateSchema,
  checklistUpdateSchema,
  commentSchema,
  companyReminderSchema,
  createTaskSchema,
  labelSchema,
  listQuerySchema,
  moveTaskSchema,
  preferencesSchema,
  quickAddSchema,
  rangeQuerySchema,
  reminderActionSchema,
  snoozeSchema,
  syncBatchSchema,
  updateTaskSchema,
} from '../domain/validators';
import { plannerScheduler } from '../engine/scheduler';
import { verifyActionToken } from '../services/actionTokens';
import { getCalendar } from '../services/calendarService';
import { recordHistory } from '../services/historyService';
import { markReminderAction, snoozeTask } from '../services/reminderService';
import { getReport, toCsv } from '../services/reportService';
import { getAdminConfig, getPreferences, updateAdminConfig, updatePreferences } from '../services/settingsService';
import * as tasks from '../services/taskService';

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;
const h = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => {
  fn(req, res, next).catch(next);
};
const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ status: 'success', data });

async function viewerOf(req: Request) {
  if (!req.user?.employeeId) throw new AppError('Unauthorized', 401);
  return tasks.resolveViewer(req.user);
}

// Meta ----------------------------------------------------------------------

export const getMeta = h(async (_req, res) => {
  ok(res, {
    categories: TASK_CATEGORIES,
    priorities: TASK_PRIORITIES,
    statuses: [...TASK_STATUSES, 'OVERDUE'],
    repeatFrequencies: REPEAT_FREQUENCIES,
    reminderPresets: REMINDER_PRESETS,
    snoozePresets: SNOOZE_PRESETS,
    projectTemplates: PROJECT_REMINDER_TEMPLATES,
    companyReminderKinds: COMPANY_REMINDER_KINDS,
    channels: [
      { key: 'IN_APP', available: true },
      { key: 'PUSH', available: true },
      { key: 'BROWSER', available: true },
      { key: 'EMAIL', available: false },
      { key: 'WHATSAPP', available: false },
      { key: 'SMS', available: false },
    ],
  });
});

// Tasks ---------------------------------------------------------------------

export const getDashboard = h(async (req, res) => ok(res, await tasks.getDashboard(await viewerOf(req))));

export const listTasks = h(async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  ok(res, await tasks.listTasks(await viewerOf(req), query));
});

export const createTask = h(async (req, res) => {
  const input = createTaskSchema.parse(req.body);
  ok(res, await tasks.createTask(await viewerOf(req), input as any), 201);
});

export const quickAdd = h(async (req, res) => {
  const input = quickAddSchema.parse(req.body);
  const full = createTaskSchema.parse({ ...input, source: 'QUICK_ADD' });
  ok(res, await tasks.createTask(await viewerOf(req), full as any), 201);
});

export const getTask = h(async (req, res) => ok(res, await tasks.getTaskDetail(req.params.id, await viewerOf(req))));

export const updateTask = h(async (req, res) => {
  const input = updateTaskSchema.parse(req.body);
  ok(res, await tasks.updateTask(await viewerOf(req), req.params.id, input as any));
});

export const moveTask = h(async (req, res) => {
  const { status, position } = moveTaskSchema.parse(req.body);
  ok(res, await tasks.setStatus(await viewerOf(req), req.params.id, status, position));
});

export const completeTask = h(async (req, res) => ok(res, await tasks.setStatus(await viewerOf(req), req.params.id, 'COMPLETED')));
export const reopenTask = h(async (req, res) => ok(res, await tasks.setStatus(await viewerOf(req), req.params.id, 'PENDING')));
export const archiveTask = h(async (req, res) => ok(res, await tasks.setStatus(await viewerOf(req), req.params.id, 'ARCHIVED')));
export const deleteTask = h(async (req, res) => ok(res, await tasks.deleteTask(await viewerOf(req), req.params.id)));

export const snooze = h(async (req, res) => {
  const viewer = await viewerOf(req);
  const { option, reminderId } = snoozeSchema.parse(req.body);
  const task = await tasks.loadTask(req.params.id, viewer, 'collaborate');
  const result = await snoozeTask(task, viewer.employeeId, option, reminderId);
  await recordHistory({ taskId: task.id, actorId: viewer.employeeId, action: 'SNOOZED', toValue: result.until });
  ok(res, { until: result.until, reminderId: result.reminder.id });
});

// Checklist / comments / attachments -------------------------------------

export const addChecklistItem = h(async (req, res) => {
  const { title } = checklistCreateSchema.parse(req.body);
  ok(res, await tasks.addChecklistItem(await viewerOf(req), req.params.id, title), 201);
});
export const updateChecklistItem = h(async (req, res) => {
  const input = checklistUpdateSchema.parse(req.body);
  ok(res, await tasks.updateChecklistItem(await viewerOf(req), req.params.id, req.params.itemId, input));
});
export const deleteChecklistItem = h(async (req, res) =>
  ok(res, await tasks.deleteChecklistItem(await viewerOf(req), req.params.id, req.params.itemId))
);

export const addComment = h(async (req, res) => {
  const { content } = commentSchema.parse(req.body);
  ok(res, await tasks.addComment(await viewerOf(req), req.params.id, content), 201);
});
export const deleteComment = h(async (req, res) => ok(res, await tasks.deleteComment(await viewerOf(req), req.params.id, req.params.commentId)));

export const addAttachment = h(async (req, res) => {
  const viewer = await viewerOf(req);
  const file = (req as any).file as Express.Multer.File | undefined;
  if (file) {
    ok(
      res,
      await tasks.addAttachment(viewer, req.params.id, {
        fileName: file.originalname.slice(0, 255),
        fileUrl: `/uploads/${file.filename}`,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      }),
      201
    );
    return;
  }
  const link = attachmentLinkSchema.parse(req.body);
  ok(res, await tasks.addAttachment(viewer, req.params.id, link), 201);
});
export const deleteAttachment = h(async (req, res) =>
  ok(res, await tasks.deleteAttachment(await viewerOf(req), req.params.id, req.params.attachmentId))
);

export const getHistory = h(async (req, res) => {
  const viewer = await viewerOf(req);
  await tasks.loadTask(req.params.id, viewer, 'view');
  ok(res, await prisma.plannerTaskHistory.findMany({ where: { taskId: req.params.id }, orderBy: { createdAt: 'desc' }, take: 200 }));
});

// Offline sync --------------------------------------------------------------

/**
 * Replays operations queued while the client was offline. Operations are applied
 * in order; CREATE uses the opId as an idempotency key so retries never duplicate.
 * Conflict policy: last write wins (server timestamps are returned so the client
 * can refresh its cache).
 */
export const syncBatch = h(async (req, res) => {
  const viewer = await viewerOf(req);
  const { operations } = syncBatchSchema.parse(req.body);
  const results: Array<{ opId: string; ok: boolean; taskId?: string; error?: string; status?: number }> = [];
  const idMap = new Map<string, string>(); // client temp id -> server id

  for (const op of operations) {
    try {
      const taskId = op.taskId ? idMap.get(op.taskId) || op.taskId : undefined;
      switch (op.type) {
        case 'CREATE': {
          const input = createTaskSchema.parse({ ...op.payload, clientRequestId: op.opId });
          const task = await tasks.createTask(viewer, input as any);
          if (op.taskId) idMap.set(op.taskId, task.id);
          results.push({ opId: op.opId, ok: true, taskId: task.id });
          break;
        }
        case 'UPDATE': {
          const input = updateTaskSchema.parse(op.payload);
          const task = await tasks.updateTask(viewer, taskId!, input as any);
          results.push({ opId: op.opId, ok: true, taskId: task.id });
          break;
        }
        case 'MOVE': {
          const { status, position } = moveTaskSchema.parse(op.payload);
          await tasks.setStatus(viewer, taskId!, status, position);
          results.push({ opId: op.opId, ok: true, taskId });
          break;
        }
        case 'COMPLETE':
          await tasks.setStatus(viewer, taskId!, 'COMPLETED');
          results.push({ opId: op.opId, ok: true, taskId });
          break;
        case 'CHECKLIST_TOGGLE': {
          const itemId = String(op.payload.itemId || '');
          await tasks.updateChecklistItem(viewer, taskId!, itemId, { isCompleted: !!op.payload.isCompleted });
          results.push({ opId: op.opId, ok: true, taskId });
          break;
        }
        case 'DELETE':
          await tasks.deleteTask(viewer, taskId!);
          results.push({ opId: op.opId, ok: true, taskId });
          break;
      }
    } catch (err: any) {
      const status = err?.statusCode || (err?.name === 'ZodError' ? 400 : 500);
      // 4xx errors are permanent: report them so the client drops the operation.
      results.push({ opId: op.opId, ok: false, status, error: err?.message || 'Failed' });
    }
  }
  ok(res, { results, serverTime: new Date() });
});

// Calendar & reports ------------------------------------------------------

export const getCalendarFeed = h(async (req, res) => {
  const q = rangeQuerySchema.parse(req.query);
  ok(res, await getCalendar(await viewerOf(req), q.from, q.to));
});

export const getReports = h(async (req, res) => {
  const q = rangeQuerySchema.parse(req.query);
  ok(res, await getReport(await viewerOf(req), q));
});

export const exportReportCsv = h(async (req, res) => {
  const viewer = await viewerOf(req);
  const q = rangeQuerySchema.parse(req.query);
  const report = await getReport(viewer, q);
  const list = await tasks.listTasks(viewer, listQuerySchema.parse({ scope: report.range.scope, limit: 500, includeArchived: 'true' }));
  const csv = toCsv(
    list.map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      priority: t.priority,
      status: t.effectiveStatus,
      owner: t.ownerId,
      assignees: t.assigneeIds.join(' '),
      project: t.projectName,
      dueAt: t.dueAt,
      completedAt: t.completedAt,
      createdAt: t.createdAt,
      tags: t.tags.join(' '),
    }))
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="planner-report-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

// Preferences & notification history -----------------------------------------

export const getMyPreferences = h(async (req, res) => {
  const viewer = await viewerOf(req);
  const [prefs, admin] = await Promise.all([getPreferences(viewer.employeeId), getAdminConfig()]);
  ok(res, { preferences: prefs, company: admin });
});

export const updateMyPreferences = h(async (req, res) => {
  const viewer = await viewerOf(req);
  const data = preferencesSchema.parse(req.body);
  ok(res, await updatePreferences(viewer.employeeId, data as any));
});

export const getNotificationHistory = h(async (req, res) => {
  const viewer = await viewerOf(req);
  const limit = Math.min(200, Number(req.query.limit) || 50);
  const rows = await prisma.plannerTaskNotification.findMany({
    where: { employeeId: viewer.employeeId, status: { in: ['SENT', 'FAILED', 'DISMISSED', 'SKIPPED'] } },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });
  const taskIds = Array.from(new Set(rows.map((r) => r.taskId).filter(Boolean) as string[]));
  const ts = await prisma.plannerTask.findMany({ where: { id: { in: taskIds } }, select: { id: true, title: true, priority: true, dueAt: true, status: true } });
  const byId = new Map(ts.map((t) => [t.id, t]));
  ok(res, rows.map((r) => ({ ...r, task: r.taskId ? byId.get(r.taskId) || null : null })));
});

export const getUpcomingReminders = h(async (req, res) => {
  const viewer = await viewerOf(req);
  const hours = Math.min(24 * 14, Number(req.query.hours) || 48);
  const rows = await prisma.plannerTaskNotification.findMany({
    where: {
      employeeId: viewer.employeeId,
      status: { in: ['SCHEDULED', 'FAILED'] },
      deliverAt: { lte: new Date(Date.now() + hours * 3_600_000) },
    },
    orderBy: { deliverAt: 'asc' },
    take: 200,
    select: { id: true, taskId: true, kind: true, fireAt: true, deliverAt: true, title: true, message: true, mandatory: true },
  });
  ok(res, rows);
});

async function applyReminderAction(employeeId: string, reminderId: string, taskId: string | null, action: string, snoozeOpt?: string | number) {
  const reminder = await prisma.plannerTaskNotification.findFirst({ where: { id: reminderId, employeeId } });
  if (!reminder) throw new AppError('Reminder not found', 404);
  const viewer = await tasks.resolveViewer({ employeeId, role: (await prisma.user.findUnique({ where: { employeeId } }))?.role || 'EMPLOYEE' });
  const effectiveTaskId = taskId || reminder.taskId;

  switch (action) {
    case 'COMPLETE': {
      if (!effectiveTaskId) throw new AppError('This reminder has no task', 400);
      await tasks.setStatus(viewer, effectiveTaskId, 'COMPLETED');
      await markReminderAction(reminderId, employeeId, 'COMPLETE');
      return { completed: true };
    }
    case 'SNOOZE': {
      if (!effectiveTaskId) throw new AppError('Company reminders cannot be snoozed', 400);
      const task = await tasks.loadTask(effectiveTaskId, viewer, 'collaborate');
      const prefs = await getPreferences(employeeId);
      const r = await snoozeTask(task, employeeId, snoozeOpt ?? prefs.defaultSnoozeMinutes, reminderId);
      await recordHistory({ taskId: task.id, actorId: employeeId, action: 'SNOOZED', toValue: r.until });
      return { snoozedUntil: r.until };
    }
    case 'DISMISS':
    case 'OPEN':
      await markReminderAction(reminderId, employeeId, action);
      return { ok: true };
    default:
      throw new AppError('Unknown action', 400);
  }
}

/** Authenticated action from the in-app toast. */
export const reminderAction = h(async (req, res) => {
  const viewer = await viewerOf(req);
  const action = String(req.body?.action || '').toUpperCase();
  ok(res, await applyReminderAction(viewer.employeeId, req.params.reminderId, null, action, req.body?.snooze));
});

/** Unauthenticated (token-scoped) action from the service worker notification buttons. */
export const reminderActionByToken = h(async (req, res) => {
  const { token, action, snooze: snoozeOpt } = reminderActionSchema.parse(req.body);
  let claims;
  try {
    claims = verifyActionToken(token);
  } catch {
    throw new AppError('This notification action has expired. Open the app to continue.', 401);
  }
  ok(res, await applyReminderAction(claims.employeeId, claims.reminderId, claims.taskId, action, snoozeOpt));
});

export const sendTestReminder = h(async (req, res) => {
  const viewer = await viewerOf(req);
  const fireAt = new Date();
  const row = await prisma.plannerTaskNotification.create({
    data: {
      dedupeKey: `test:${viewer.employeeId}:${fireAt.getTime()}`,
      employeeId: viewer.employeeId,
      kind: 'COMPANY',
      fireAt,
      deliverAt: fireAt,
      status: 'SCHEDULED',
      title: '🔔 Smart Tasks test reminder',
      message: 'Notifications are working. You will be reminded about tasks like this.',
      mandatory: true,
    },
  });
  const result = await plannerScheduler.dispatcher.tick(new Date());
  ok(res, { reminderId: row.id, result });
});

// Lookups -------------------------------------------------------------------

export const getPeople = h(async (req, res) => ok(res, await tasks.searchAssignableEmployees(await viewerOf(req), String(req.query.q || '').slice(0, 50) || undefined)));
export const getProjects = h(async (req, res) => ok(res, await tasks.listProjects(await viewerOf(req))));
export const getTags = h(async (req, res) => ok(res, await tasks.listTags(await viewerOf(req))));

export const listLabels = h(async (req, res) => {
  const viewer = await viewerOf(req);
  ok(res, await prisma.plannerTaskLabel.findMany({ where: { ownerId: viewer.employeeId }, orderBy: { name: 'asc' } }));
});
export const createLabel = h(async (req, res) => {
  const viewer = await viewerOf(req);
  const input = labelSchema.parse(req.body);
  ok(res, await prisma.plannerTaskLabel.create({ data: { ownerId: viewer.employeeId, ...input } }), 201);
});
export const deleteLabel = h(async (req, res) => {
  const viewer = await viewerOf(req);
  await prisma.plannerTaskLabel.deleteMany({ where: { id: req.params.labelId, ownerId: viewer.employeeId } });
  ok(res, { id: req.params.labelId });
});

// Admin ---------------------------------------------------------------------

export const getAdminSettings = h(async (_req, res) => {
  const [config, reminders] = await Promise.all([getAdminConfig(), prisma.plannerCompanyReminder.findMany({ orderBy: { time: 'asc' } })]);
  ok(res, { config, companyReminders: reminders, scheduler: plannerScheduler.lastRun });
});

export const updateAdminSettings = h(async (req, res) => {
  const data = adminConfigSchema.parse(req.body);
  ok(res, await updateAdminConfig(data as any, req.user!.employeeId));
});

export const createCompanyReminder = h(async (req, res) => {
  const data = companyReminderSchema.parse(req.body);
  ok(res, await prisma.plannerCompanyReminder.create({ data: { ...data, createdBy: req.user!.employeeId } }), 201);
});

export const updateCompanyReminder = h(async (req, res) => {
  const data = companyReminderSchema.partial().parse(req.body);
  const exists = await prisma.plannerCompanyReminder.findUnique({ where: { id: req.params.reminderId } });
  if (!exists) throw new AppError('Company reminder not found', 404);
  ok(res, await prisma.plannerCompanyReminder.update({ where: { id: req.params.reminderId }, data }));
});

export const deleteCompanyReminder = h(async (req, res) => {
  await prisma.plannerCompanyReminder.deleteMany({ where: { id: req.params.reminderId } });
  ok(res, { id: req.params.reminderId });
});

export const runSchedulerNow = h(async (req, res) => {
  if (!isAdminRole(req.user!.role)) throw new AppError('Forbidden', 403);
  ok(res, await plannerScheduler.tick(new Date()));
});
