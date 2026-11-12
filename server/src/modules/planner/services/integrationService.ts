import { prisma } from '../../../config/db';
import { reminderDedupeKey } from '../domain/reminders';
import { formatDateKey, getZonedParts, parseHHmm, safeTimezone, zonedTimeToUtc } from '../domain/timezone';
import { cancelTaskReminders, syncTaskReminders } from './reminderService';
import { getAdminConfig, getHolidayDates } from './settingsService';

/** Meetings starting within this window get a planner reminder task per participant. */
const MEETING_WINDOW_MS = 26 * 60 * 60 * 1000;

/**
 * Meeting integration: every participant of an upcoming meeting gets a
 * "Meeting Reminder" planner task with the company's meeting reminder offsets
 * (default 1 day + 1 hour before). The existing notification engine already
 * sends the 15-minute and "starting now" alerts, so those are not duplicated here.
 * Reschedules and cancellations are reconciled on every pass.
 */
export async function syncMeetingReminders(now = new Date()): Promise<{ created: number; updated: number; cancelled: number }> {
  const admin = await getAdminConfig();
  const stats = { created: 0, updated: 0, cancelled: 0 };

  const meetings = await prisma.meeting.findMany({
    where: { startTime: { gte: now, lte: new Date(now.getTime() + MEETING_WINDOW_MS) } },
    take: 500,
  });

  for (const meeting of meetings) {
    const participants = Array.from(new Set([meeting.organizerId, ...meeting.participantIds].filter(Boolean)));
    const existing = await prisma.plannerTask.findMany({ where: { source: 'MEETING', sourceRefId: meeting.id } });
    const byOwner = new Map(existing.map((t) => [t.ownerId, t]));

    if (meeting.status === 'CANCELLED') {
      for (const t of existing) {
        if (t.status === 'CANCELLED') continue;
        await prisma.plannerTask.update({ where: { id: t.id }, data: { status: 'CANCELLED', cancelledAt: now } });
        await cancelTaskReminders(t.id, 'Meeting cancelled');
        stats.cancelled++;
      }
      continue;
    }

    for (const employeeId of participants) {
      const current = byOwner.get(employeeId);
      if (!current) {
        try {
          const task = await prisma.plannerTask.create({
            data: {
              title: meeting.title,
              description: meeting.description || null,
              category: 'MEETING_REMINDER',
              priority: 'HIGH',
              status: 'PENDING',
              ownerId: employeeId,
              dueAt: meeting.startTime,
              timezone: admin.companyTimezone,
              reminderOffsets: admin.meetingReminderOffsets,
              estimatedMinutes: Math.max(1, Math.round((meeting.endTime.getTime() - meeting.startTime.getTime()) / 60000)),
              location: meeting.link || null,
              source: 'MEETING',
              sourceRefId: meeting.id,
              color: '#6366f1',
            },
          });
          await syncTaskReminders(task, now);
          stats.created++;
        } catch (err: any) {
          console.warn('[Planner:Meetings] Could not create meeting task:', err?.message || err);
        }
      } else if (
        current.status !== 'COMPLETED' &&
        (current.dueAt?.getTime() !== meeting.startTime.getTime() || current.title !== meeting.title || current.status === 'CANCELLED')
      ) {
        const task = await prisma.plannerTask.update({
          where: { id: current.id },
          data: { dueAt: meeting.startTime, title: meeting.title, location: meeting.link || null, status: 'PENDING', cancelledAt: null },
        });
        await syncTaskReminders(task, now);
        stats.updated++;
      }
    }

    // Participants removed from the meeting
    for (const t of existing) {
      if (!participants.includes(t.ownerId) && t.status !== 'CANCELLED') {
        await prisma.plannerTask.update({ where: { id: t.id }, data: { status: 'CANCELLED', cancelledAt: now } });
        await cancelTaskReminders(t.id, 'Removed from meeting');
        stats.cancelled++;
      }
    }
  }
  return stats;
}

/** Company reminders fire if the scheduler sees them within this many minutes after their time. */
const COMPANY_FIRE_WINDOW_MIN = 20;

/**
 * Attendance / company reminders configured by admins (check-in, lunch, timesheet...).
 * Each (reminder, employee, local date) gets exactly one delivery row thanks to the
 * unique dedupe key, so restarts or multiple instances never re-send.
 */
export async function enqueueCompanyReminders(now = new Date()): Promise<number> {
  const reminders = await prisma.plannerCompanyReminder.findMany({ where: { isActive: true } });
  if (!reminders.length) return 0;
  const admin = await getAdminConfig();
  const tz = safeTimezone(admin.companyTimezone);
  const local = getZonedParts(now, tz);
  const nowMinute = local.hour * 60 + local.minute;
  const dateKey = formatDateKey(now, tz);

  if (admin.respectHolidays) {
    const holidays = await getHolidayDates();
    if (holidays.some((d) => formatDateKey(d, tz) === dateKey)) return 0;
  }

  const due = reminders.filter((r) => {
    const m = parseHHmm(r.time);
    if (m === null) return false;
    if (r.daysOfWeek.length && !r.daysOfWeek.includes(local.weekday)) return false;
    return nowMinute >= m && nowMinute < m + COMPANY_FIRE_WINDOW_MIN;
  });
  if (!due.length) return 0;

  const [employees, users] = await Promise.all([
    prisma.employee.findMany({ select: { employeeId: true, department: true } }),
    prisma.user.findMany({ select: { employeeId: true, role: true } }),
  ]);
  const roleOf = new Map(users.map((u) => [u.employeeId, u.role as string]));

  let queued = 0;
  for (const r of due) {
    const m = parseHHmm(r.time)!;
    const fireAt = zonedTimeToUtc({ year: local.year, month: local.month, day: local.day, hour: Math.floor(m / 60), minute: m % 60 }, tz);
    const depts = r.departments.map((d) => d.trim().toLowerCase());
    const targets = employees.filter((e) => {
      const role = roleOf.get(e.employeeId);
      if (!role) return false; // no login account
      if (r.targetRoles.length && !r.targetRoles.includes(role)) return false;
      if (depts.length && !depts.includes((e.department || '').trim().toLowerCase())) return false;
      return true;
    });

    const rows = targets.map((e) => ({
      dedupeKey: reminderDedupeKey({ scope: `company-${r.id}-${dateKey}`, employeeId: e.employeeId, kind: 'COMPANY', fireAt }),
      taskId: null,
      employeeId: e.employeeId,
      kind: 'COMPANY',
      fireAt,
      deliverAt: fireAt,
      status: 'SCHEDULED',
      title: r.title,
      message: r.message,
      mandatory: r.mandatory,
    }));
    if (!rows.length) continue;

    const existing = await prisma.plannerTaskNotification.findMany({
      where: { dedupeKey: { in: rows.map((x) => x.dedupeKey) } },
      select: { dedupeKey: true },
    });
    const have = new Set(existing.map((e) => e.dedupeKey));
    for (const row of rows) {
      if (have.has(row.dedupeKey)) continue;
      try {
        await prisma.plannerTaskNotification.create({ data: row });
        queued++;
      } catch (err: any) {
        if (err?.code !== 'P2002') console.warn('[Planner:Company] enqueue failed:', err?.message || err);
      }
    }
  }
  return queued;
}
