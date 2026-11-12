import { prisma } from '../../../config/db';
import { Viewer, isAdminRole, isManagerRole } from '../domain/access';
import { OPEN_STATUSES } from '../domain/constants';
import { occurrencesBetween } from '../domain/recurrence';
import { getZonedParts, safeTimezone, zonedTimeToUtc } from '../domain/timezone';
import { toRule } from './recurrenceService';

export type CalendarEventType = 'TASK' | 'RECURRING' | 'REMINDER' | 'MEETING' | 'DEADLINE' | 'LEAVE' | 'HOLIDAY' | 'BIRTHDAY' | 'ANNIVERSARY';

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  start: Date;
  end?: Date | null;
  allDay: boolean;
  color?: string | null;
  priority?: string;
  status?: string;
  taskId?: string;
  url?: string;
  meta?: Record<string, unknown>;
}

const MAX_RANGE_DAYS = 100;

/** Unified calendar feed: tasks, projected recurrences, reminders, meetings, leave, holidays, birthdays & anniversaries. */
export async function getCalendar(viewer: Viewer & { timezone: string }, fromIn?: Date, toIn?: Date): Promise<CalendarEvent[]> {
  const tz = safeTimezone(viewer.timezone);
  const now = new Date();
  const from = fromIn ?? new Date(now.getTime() - 7 * 86_400_000);
  let to = toIn ?? new Date(now.getTime() + 35 * 86_400_000);
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) to = new Date(from.getTime() + MAX_RANGE_DAYS * 86_400_000);

  const mine = { OR: [{ ownerId: viewer.employeeId }, { assigneeIds: { has: viewer.employeeId } }] };
  const events: CalendarEvent[] = [];

  const [tasks, reminders, meetings, holidays] = await Promise.all([
    prisma.plannerTask.findMany({
      where: { AND: [mine, { dueAt: { gte: from, lte: to } }, { status: { notIn: ['ARCHIVED', 'CANCELLED'] } }] },
      take: 1000,
    }),
    prisma.plannerTaskNotification.findMany({
      where: { employeeId: viewer.employeeId, status: { in: ['SCHEDULED', 'FAILED'] }, deliverAt: { gte: from, lte: to } },
      take: 500,
    }),
    prisma.meeting.findMany({
      where: { participantIds: { has: viewer.employeeId }, startTime: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
      take: 500,
    }),
    prisma.holiday.findMany({ where: { date: { gte: from, lte: to } } }).catch(() => []),
  ]);

  const meetingTaskIds = new Set<string>();
  for (const t of tasks) {
    if (t.source === 'MEETING' && t.sourceRefId) meetingTaskIds.add(t.sourceRefId);
    if (t.source === 'MEETING') continue; // the meeting itself is shown below
    const overdue = !!t.dueAt && t.dueAt < now && OPEN_STATUSES.includes(t.status as any);
    events.push({
      id: `task-${t.id}`,
      type: t.priority === 'CRITICAL' || t.category === 'PROJECT' ? 'DEADLINE' : 'TASK',
      title: t.title,
      start: t.dueAt!,
      end: t.estimatedMinutes && !t.allDay ? new Date(t.dueAt!.getTime() + t.estimatedMinutes * 60_000) : null,
      allDay: t.allDay,
      color: t.color,
      priority: t.priority,
      status: overdue ? 'OVERDUE' : t.status,
      taskId: t.id,
      url: `/planner?task=${t.id}`,
      meta: { category: t.category, projectName: t.projectName },
    });
  }

  // Project future occurrences of active series that haven't been materialised yet.
  const series = await prisma.plannerTaskRecurrence.findMany({
    where: { isActive: true, ownerId: viewer.employeeId, nextOccurrenceAt: { lte: to } },
    take: 200,
  });
  const templateIds = series.map((s) => s.templateTaskId);
  const templates = new Map(
    (await prisma.plannerTask.findMany({ where: { id: { in: templateIds } } })).map((t) => [t.id, t])
  );
  const existingOccurrences = new Set(tasks.filter((t) => t.seriesId && t.occurrenceAt).map((t) => `${t.seriesId}:${t.occurrenceAt!.toISOString()}`));
  for (const s of series) {
    const template = templates.get(s.templateTaskId);
    if (!template || !s.nextOccurrenceAt) continue;
    const start = s.nextOccurrenceAt > from ? s.nextOccurrenceAt : from;
    const projected = occurrencesBetween(toRule(s), start, to, 100, s.generatedCount);
    for (const at of projected) {
      if (existingOccurrences.has(`${s.id}:${at.toISOString()}`)) continue;
      events.push({
        id: `series-${s.id}-${at.getTime()}`,
        type: 'RECURRING',
        title: template.title,
        start: at,
        allDay: template.allDay,
        color: template.color,
        priority: template.priority,
        status: 'SCHEDULED',
        taskId: template.id,
        url: `/planner?task=${template.id}`,
        meta: { frequency: s.frequency },
      });
    }
  }

  for (const r of reminders) {
    events.push({
      id: `reminder-${r.id}`,
      type: 'REMINDER',
      title: r.title || 'Reminder',
      start: r.deliverAt,
      allDay: false,
      status: r.status,
      taskId: r.taskId || undefined,
      meta: { kind: r.kind, offsetMinutes: r.offsetMinutes },
    });
  }

  for (const m of meetings) {
    events.push({
      id: `meeting-${m.id}`,
      type: 'MEETING',
      title: m.title,
      start: m.startTime,
      end: m.endTime,
      allDay: false,
      color: '#6366f1',
      status: m.status,
      url: m.link || undefined,
      meta: { link: m.link, hasPlannerTask: meetingTaskIds.has(m.id) },
    });
  }

  for (const h of holidays as Array<{ id: string; name: string; date: Date; type: string }>) {
    events.push({ id: `holiday-${h.id}`, type: 'HOLIDAY', title: h.name, start: h.date, allDay: true, color: '#f43f5e', meta: { type: h.type } });
  }

  // Leave: own leave for everyone; team leave for managers; everyone's for HR/Admin.
  let leaveWhere: any = { employeeId: viewer.employeeId };
  if (isAdminRole(viewer.role)) leaveWhere = {};
  else if (isManagerRole(viewer.role) && viewer.department) {
    const team = await prisma.employee.findMany({
      where: { department: { equals: viewer.department, mode: 'insensitive' } },
      select: { employeeId: true },
    });
    leaveWhere = { employeeId: { in: team.map((t) => t.employeeId) } };
  }
  const leaves = await prisma.leave.findMany({
    where: { ...leaveWhere, status: { not: 'REJECTED' }, startDate: { lte: to }, endDate: { gte: from } },
    include: { employee: { select: { firstName: true, lastName: true } } },
    take: 500,
  });
  for (const l of leaves) {
    const self = l.employeeId === viewer.employeeId;
    events.push({
      id: `leave-${l.id}`,
      type: 'LEAVE',
      title: self ? `My ${l.leaveType.replace(/_/g, ' ').toLowerCase()} leave` : `${l.employee.firstName} ${l.employee.lastName} · leave`,
      start: l.startDate,
      end: l.endDate,
      allDay: true,
      color: '#f59e0b',
      status: l.status,
      meta: { leaveType: l.leaveType, employeeId: l.employeeId },
    });
  }

  // Birthdays & work anniversaries (projected into the requested range, in the viewer's timezone).
  const people = await prisma.employee.findMany({
    select: { employeeId: true, firstName: true, lastName: true, personalInfo: true, professionalInfo: true },
  });
  const fromP = getZonedParts(from, tz);
  const toP = getZonedParts(to, tz);
  const years = Array.from(new Set([fromP.year, toP.year]));
  const project = (d: Date, year: number) => {
    const u = { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
    return zonedTimeToUtc({ year, month: u.month, day: u.day }, tz);
  };
  for (const p of people) {
    const name = `${p.firstName} ${p.lastName}`.trim();
    const dob = p.personalInfo?.dob ? new Date(p.personalInfo.dob) : null;
    const doj = p.professionalInfo?.dateOfJoining ? new Date(p.professionalInfo.dateOfJoining) : null;
    for (const year of years) {
      if (dob && !Number.isNaN(dob.getTime())) {
        const at = project(dob, year);
        if (at >= from && at <= to) {
          events.push({
            id: `bday-${p.employeeId}-${year}`,
            type: 'BIRTHDAY',
            title: p.employeeId === viewer.employeeId ? 'Your birthday 🎂' : `${name}'s birthday 🎂`,
            start: at,
            allDay: true,
            color: '#ec4899',
            meta: { employeeId: p.employeeId },
          });
        }
      }
      if (doj && !Number.isNaN(doj.getTime()) && year > doj.getUTCFullYear()) {
        const at = project(doj, year);
        if (at >= from && at <= to) {
          const yrs = year - doj.getUTCFullYear();
          events.push({
            id: `anniv-${p.employeeId}-${year}`,
            type: 'ANNIVERSARY',
            title: `${p.employeeId === viewer.employeeId ? 'Your' : `${name}'s`} ${yrs}-year work anniversary 🎉`,
            start: at,
            allDay: true,
            color: '#8b5cf6',
            meta: { employeeId: p.employeeId, years: yrs },
          });
        }
      }
    }
  }

  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}
