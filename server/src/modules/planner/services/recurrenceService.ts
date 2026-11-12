import { prisma } from '../../../config/db';
import type { PlannerTask, PlannerTaskRecurrence } from '@prisma/client';
import { RecurrenceRule, nextOccurrence } from '../domain/recurrence';
import { syncTaskReminders } from './reminderService';

export interface RepeatInput {
  frequency: string;
  interval?: number;
  unit?: string;
  daysOfWeek?: number[];
  endsAt?: Date | null;
  maxOccurrences?: number | null;
}

/** How far ahead recurring instances are materialised (so reminders such as "1 day before" can fire). */
export const RECURRENCE_LOOKAHEAD_MS = 48 * 60 * 60 * 1000;

export function toRule(r: Pick<PlannerTaskRecurrence, 'frequency' | 'interval' | 'unit' | 'daysOfWeek' | 'timezone' | 'anchorAt' | 'endsAt' | 'maxOccurrences'>): RecurrenceRule {
  return {
    frequency: r.frequency as RecurrenceRule['frequency'],
    interval: r.interval,
    unit: r.unit as RecurrenceRule['unit'],
    daysOfWeek: r.daysOfWeek,
    timezone: r.timezone,
    anchorAt: r.anchorAt,
    endsAt: r.endsAt,
    maxOccurrences: r.maxOccurrences,
  };
}

/** Creates, replaces or removes the recurrence series attached to a template task. */
export async function upsertSeries(task: PlannerTask, repeat: RepeatInput | null | undefined) {
  const existing = await prisma.plannerTaskRecurrence.findFirst({ where: { templateTaskId: task.id } });
  if (!repeat || repeat.frequency === 'NEVER' || !task.dueAt) {
    if (existing) await prisma.plannerTaskRecurrence.update({ where: { id: existing.id }, data: { isActive: false } });
    return null;
  }
  const base = {
    ownerId: task.ownerId,
    frequency: repeat.frequency,
    interval: repeat.interval ?? 1,
    unit: repeat.unit ?? 'DAY',
    daysOfWeek: repeat.daysOfWeek ?? [],
    timezone: task.timezone,
    anchorAt: task.dueAt,
    endsAt: repeat.endsAt ?? null,
    maxOccurrences: repeat.maxOccurrences ?? null,
    isActive: true,
  };
  const generatedCount = existing?.generatedCount ?? 1;
  const after = existing?.lastOccurrenceAt && existing.lastOccurrenceAt > task.dueAt ? existing.lastOccurrenceAt : task.dueAt;
  const next = nextOccurrence(toRule(base as any), after, generatedCount);
  const data = { ...base, nextOccurrenceAt: next, isActive: !!next };

  const series = existing
    ? await prisma.plannerTaskRecurrence.update({ where: { id: existing.id }, data })
    : await prisma.plannerTaskRecurrence.create({ data: { ...data, templateTaskId: task.id, generatedCount: 1, lastOccurrenceAt: task.dueAt } });

  if (task.seriesId !== series.id) {
    await prisma.plannerTask.update({ where: { id: task.id }, data: { seriesId: series.id, occurrenceAt: task.dueAt } });
  }
  return series;
}

/**
 * Materialises every recurring instance due within the lookahead window.
 * Safe to run concurrently: a series is advanced with a compare-and-set on
 * `nextOccurrenceAt`, and instances are de-duplicated by (seriesId, occurrenceAt).
 */
export async function generateDueOccurrences(now = new Date()): Promise<number> {
  const horizon = new Date(now.getTime() + RECURRENCE_LOOKAHEAD_MS);
  const due = await prisma.plannerTaskRecurrence.findMany({
    where: { isActive: true, nextOccurrenceAt: { lte: horizon } },
    take: 200,
  });
  let created = 0;

  for (const series of due) {
    // A series may be behind by several occurrences (e.g. after downtime); catch up a bounded amount.
    let current: PlannerTaskRecurrence | null = series;
    for (let i = 0; i < 10 && current && current.nextOccurrenceAt && current.nextOccurrenceAt <= horizon; i++) {
      const occurrenceAt: Date = current.nextOccurrenceAt;
      const following = nextOccurrence(toRule(current), occurrenceAt, current.generatedCount + 1);

      const claim = await prisma.plannerTaskRecurrence.updateMany({
        where: { id: current.id, nextOccurrenceAt: occurrenceAt, isActive: true },
        data: {
          nextOccurrenceAt: following,
          lastOccurrenceAt: occurrenceAt,
          generatedCount: { increment: 1 },
          isActive: !!following,
        },
      });
      if (claim.count !== 1) break; // another worker advanced it

      // Skip occurrences that are already in the past by more than a day (downtime catch-up).
      if (occurrenceAt.getTime() >= now.getTime() - 24 * 60 * 60 * 1000) {
        const made = await createInstance(current, occurrenceAt);
        if (made) created++;
      }
      current = await prisma.plannerTaskRecurrence.findUnique({ where: { id: current.id } });
    }
  }
  return created;
}

async function createInstance(series: PlannerTaskRecurrence, occurrenceAt: Date) {
  const exists = await prisma.plannerTask.findFirst({ where: { seriesId: series.id, occurrenceAt }, select: { id: true } });
  if (exists) return null;
  const template = await prisma.plannerTask.findUnique({ where: { id: series.templateTaskId } });
  if (!template || template.status === 'ARCHIVED' || template.status === 'CANCELLED') {
    await prisma.plannerTaskRecurrence.update({ where: { id: series.id }, data: { isActive: false } });
    return null;
  }
  const shift = template.dueAt ? occurrenceAt.getTime() - template.dueAt.getTime() : 0;
  const instance = await prisma.plannerTask.create({
    data: {
      title: template.title,
      description: template.description,
      category: template.category,
      priority: template.priority,
      status: 'PENDING',
      ownerId: template.ownerId,
      assigneeIds: template.assigneeIds,
      projectName: template.projectName,
      tags: template.tags,
      labelIds: template.labelIds,
      color: template.color,
      dueAt: occurrenceAt,
      allDay: template.allDay,
      timezone: template.timezone,
      reminderOffsets: template.reminderOffsets,
      customReminderAts: template.customReminderAts.map((d) => new Date(d.getTime() + shift)),
      estimatedMinutes: template.estimatedMinutes,
      location: template.location,
      source: 'RECURRENCE',
      seriesId: series.id,
      occurrenceAt,
    },
  });
  const checklist = await prisma.plannerTaskChecklistItem.findMany({ where: { taskId: template.id }, orderBy: { position: 'asc' } });
  if (checklist.length) {
    await prisma.plannerTaskChecklistItem.createMany({
      data: checklist.map((c) => ({ taskId: instance.id, title: c.title, position: c.position, isCompleted: false })),
    });
  }
  await syncTaskReminders(instance);
  return instance;
}

export async function getSeriesForTasks(seriesIds: string[]) {
  if (!seriesIds.length) return new Map<string, PlannerTaskRecurrence>();
  const rows = await prisma.plannerTaskRecurrence.findMany({ where: { id: { in: seriesIds } } });
  return new Map(rows.map((r) => [r.id, r]));
}
