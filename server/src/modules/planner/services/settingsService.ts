import { prisma } from '../../../config/db';
import type { PlannerAdminConfig, PlannerNotificationPreference } from '@prisma/client';
import { DeliveryPolicy } from '../domain/reminders';
import { formatDateKey, safeTimezone } from '../domain/timezone';

const CACHE_TTL_MS = 60_000;
let adminCache: { value: PlannerAdminConfig; at: number } | null = null;
let holidayCache: { keys: Date[]; at: number } | null = null;

export async function getAdminConfig(): Promise<PlannerAdminConfig> {
  if (adminCache && Date.now() - adminCache.at < CACHE_TTL_MS) return adminCache.value;
  const value = await prisma.plannerAdminConfig.upsert({
    where: { key: 'DEFAULT' },
    create: { key: 'DEFAULT' },
    update: {},
  });
  adminCache = { value, at: Date.now() };
  return value;
}

export async function updateAdminConfig(data: Partial<PlannerAdminConfig>, updatedBy: string) {
  const value = await prisma.plannerAdminConfig.upsert({
    where: { key: 'DEFAULT' },
    create: { key: 'DEFAULT', ...(data as any), updatedBy },
    update: { ...(data as any), updatedBy },
  });
  adminCache = { value, at: Date.now() };
  return value;
}

/** Defaults inherit from the company config the first time an employee opens the planner. */
export async function getPreferences(employeeId: string): Promise<PlannerNotificationPreference> {
  const existing = await prisma.plannerNotificationPreference.findUnique({ where: { employeeId } });
  if (existing) return existing;
  const admin = await getAdminConfig();
  try {
    return await prisma.plannerNotificationPreference.create({
      data: {
        employeeId,
        timezone: admin.companyTimezone,
        sound: admin.notificationSound,
        defaultReminderOffsets: admin.defaultReminderOffsets,
        workingHoursStart: admin.workingHoursStart,
        workingHoursEnd: admin.workingHoursEnd,
        workingDays: admin.workingDays,
        weekendReminders: admin.weekendReminders,
      },
    });
  } catch {
    // Concurrent first access — another request created it.
    return prisma.plannerNotificationPreference.findUniqueOrThrow({ where: { employeeId } });
  }
}

export async function updatePreferences(employeeId: string, data: Partial<PlannerNotificationPreference>) {
  await getPreferences(employeeId);
  return prisma.plannerNotificationPreference.update({ where: { employeeId }, data: data as any });
}

export async function getPreferencesMap(employeeIds: string[]): Promise<Map<string, PlannerNotificationPreference>> {
  const unique = Array.from(new Set(employeeIds));
  const rows = await prisma.plannerNotificationPreference.findMany({ where: { employeeId: { in: unique } } });
  const map = new Map(rows.map((r) => [r.employeeId, r]));
  for (const id of unique) {
    if (!map.has(id)) map.set(id, await getPreferences(id));
  }
  return map;
}

/** Holidays within ±60 days, cached for a minute. */
export async function getHolidayDates(): Promise<Date[]> {
  if (holidayCache && Date.now() - holidayCache.at < CACHE_TTL_MS) return holidayCache.keys;
  const now = Date.now();
  const rows = await prisma.holiday
    .findMany({
      where: { date: { gte: new Date(now - 60 * 86_400_000), lte: new Date(now + 60 * 86_400_000) } },
      select: { date: true },
    })
    .catch(() => [] as Array<{ date: Date }>);
  holidayCache = { keys: rows.map((r) => r.date), at: Date.now() };
  return holidayCache.keys;
}

export function buildDeliveryPolicy(
  prefs: PlannerNotificationPreference,
  admin: PlannerAdminConfig,
  holidays: Date[]
): DeliveryPolicy {
  const tz = safeTimezone(prefs.timezone || admin.companyTimezone);
  // Holidays are stored as dates at company midnight; key them in the company timezone.
  const holidayDateKeys = admin.respectHolidays
    ? new Set(holidays.map((d) => formatDateKey(d, safeTimezone(admin.companyTimezone))))
    : undefined;
  return {
    timezone: tz,
    dndEnabled: prefs.dndEnabled,
    dndUntil: prefs.dndUntil,
    quietHoursEnabled: prefs.quietHoursEnabled,
    quietHoursStart: prefs.quietHoursStart,
    quietHoursEnd: prefs.quietHoursEnd,
    weekendReminders: prefs.weekendReminders,
    workingDays: prefs.workingDays,
    workingHoursStart: prefs.workingHoursStart,
    workingHoursEnd: prefs.workingHoursEnd,
    onlyDuringWorkingHours: prefs.onlyDuringWorkingHours,
    companyQuietHoursEnabled: admin.quietHoursEnabled,
    companyQuietHoursStart: admin.quietHoursStart,
    companyQuietHoursEnd: admin.quietHoursEnd,
    companyWeekendReminders: admin.weekendReminders,
    holidayDateKeys,
  };
}

/** Test hook */
export function __resetSettingsCache() {
  adminCache = null;
  holidayCache = null;
}
