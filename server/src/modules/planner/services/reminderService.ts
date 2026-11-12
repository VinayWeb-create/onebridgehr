import { prisma } from '../../../config/db';
import type { PlannerTask } from '@prisma/client';
import { OPEN_STATUSES } from '../domain/constants';
import { computeReminderSlots, reminderDedupeKey, resolveSnoozeUntil } from '../domain/reminders';
import { getPreferences } from './settingsService';

const ACTIVE = ['SCHEDULED', 'FAILED'];

export function taskRecipients(task: Pick<PlannerTask, 'ownerId' | 'assigneeIds'>): string[] {
  return Array.from(new Set([task.ownerId, ...(task.assigneeIds || [])].filter(Boolean)));
}

/**
 * Reconciles the reminder rows of a task with its current settings.
 * - creates missing rows (unique dedupeKey => never duplicated)
 * - revives rows that were cancelled by an earlier edit
 * - cancels rows that no longer match (time changed, recipient removed, task closed)
 * Already-SENT reminders are left untouched so editing a task never re-sends them.
 */
export async function syncTaskReminders(task: PlannerTask, now = new Date()): Promise<{ scheduled: number; cancelled: number }> {
  const isOpen = OPEN_STATUSES.includes(task.status as any);
  const wanted = new Map<string, { employeeId: string; fireAt: Date; kind: string; offsetMinutes: number | null }>();

  if (isOpen) {
    const slots = computeReminderSlots(task, now);
    const kind = task.source === 'MEETING' ? 'MEETING' : undefined;
    for (const employeeId of taskRecipients(task)) {
      for (const slot of slots) {
        const k = kind || slot.kind;
        wanted.set(reminderDedupeKey({ taskId: task.id, employeeId, kind: k, fireAt: slot.fireAt }), {
          employeeId,
          fireAt: slot.fireAt,
          kind: k,
          offsetMinutes: slot.offsetMinutes,
        });
      }
    }
  }

  const existing = await prisma.plannerTaskNotification.findMany({
    where: { taskId: task.id, kind: { not: 'SNOOZE' } },
    select: { id: true, dedupeKey: true, status: true },
  });
  const existingByKey = new Map(existing.map((e) => [e.dedupeKey, e]));

  const toCancel = existing.filter((e) => ACTIVE.includes(e.status) && !wanted.has(e.dedupeKey)).map((e) => e.id);
  if (toCancel.length) {
    await prisma.plannerTaskNotification.updateMany({
      where: { id: { in: toCancel }, status: { in: ACTIVE } },
      data: { status: 'CANCELLED', lastError: 'Superseded by task update' },
    });
  }
  if (!isOpen) {
    await cancelSnoozes(task.id);
  }

  let scheduled = 0;
  for (const [dedupeKey, w] of wanted) {
    const prev = existingByKey.get(dedupeKey);
    if (prev) {
      if (prev.status === 'CANCELLED') {
        await prisma.plannerTaskNotification.update({
          where: { id: prev.id },
          data: { status: 'SCHEDULED', deliverAt: w.fireAt, attempts: 0, lastError: null, nextRetryAt: null },
        });
        scheduled++;
      }
      continue;
    }
    try {
      await prisma.plannerTaskNotification.create({
        data: {
          dedupeKey,
          taskId: task.id,
          employeeId: w.employeeId,
          kind: w.kind,
          offsetMinutes: w.offsetMinutes,
          fireAt: w.fireAt,
          deliverAt: w.fireAt,
          status: 'SCHEDULED',
        },
      });
      scheduled++;
    } catch (err: any) {
      if (err?.code !== 'P2002') throw err; // P2002 = created concurrently: fine, dedupe worked
    }
  }
  return { scheduled, cancelled: toCancel.length };
}

export async function cancelTaskReminders(taskId: string, reason = 'Task closed') {
  await prisma.plannerTaskNotification.updateMany({
    where: { taskId, status: { in: ACTIVE } },
    data: { status: 'CANCELLED', lastError: reason },
  });
}

async function cancelSnoozes(taskId: string) {
  await prisma.plannerTaskNotification.updateMany({
    where: { taskId, kind: 'SNOOZE', status: { in: ACTIVE } },
    data: { status: 'CANCELLED', lastError: 'Task closed' },
  });
}

/** Snoozes a task's reminders for one employee. Replaces any previous pending snooze. */
export async function snoozeTask(
  task: PlannerTask,
  employeeId: string,
  option: string | number,
  reminderId?: string,
  now = new Date()
) {
  const prefs = await getPreferences(employeeId);
  const until = resolveSnoozeUntil(option, now, prefs.timezone || task.timezone, prefs.workingHoursStart);

  await prisma.plannerTaskNotification.updateMany({
    where: { taskId: task.id, employeeId, kind: 'SNOOZE', status: { in: ACTIVE } },
    data: { status: 'CANCELLED', lastError: 'Replaced by a newer snooze' },
  });
  if (reminderId) {
    await prisma.plannerTaskNotification
      .updateMany({ where: { id: reminderId, employeeId }, data: { action: 'SNOOZE', actedAt: now } })
      .catch(() => undefined);
  }
  const reminder = await prisma.plannerTaskNotification.create({
    data: {
      dedupeKey: reminderDedupeKey({ taskId: task.id, employeeId, kind: 'SNOOZE', fireAt: until, scope: `snooze-${now.getTime()}` }),
      taskId: task.id,
      employeeId,
      kind: 'SNOOZE',
      fireAt: until,
      deliverAt: until,
      status: 'SCHEDULED',
      title: `⏰ ${task.title}`,
    },
  });
  return { until, reminder };
}

export async function markReminderAction(reminderId: string, employeeId: string, action: string) {
  await prisma.plannerTaskNotification.updateMany({
    where: { id: reminderId, employeeId },
    data: { action, actedAt: new Date(), ...(action === 'DISMISS' ? { status: 'DISMISSED' } : {}) },
  });
}
