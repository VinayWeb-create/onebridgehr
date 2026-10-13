import { prisma } from '../config/db';
import { socketService } from './socketService';
import { WebPushService } from './webPushService';
import { checkAndSendScheduledGreetings } from './energeticGreetingService';

/**
 * Tracks sent reminders today so an employee is only alerted once per 10-minute slot.
 * Key format: `YYYY-MM-DD:empId:type:slot` (e.g., `2026-10-13:OBI0006:checkin:09:00`)
 */
const sentRemindersToday = new Set<string>();

/**
 * Returns Indian Standard Time (IST, UTC+5:30) date components
 */
function getISTDateComponents() {
  const now = new Date();
  // IST offset is +330 minutes (+5:30)
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istTime = new Date(utc + 3600000 * 5.5);

  const year = istTime.getFullYear();
  const month = String(istTime.getMonth() + 1).padStart(2, '0');
  const day = String(istTime.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  const hours = istTime.getHours();
  const minutes = istTime.getMinutes();
  const dayOfWeek = istTime.getDay(); // 0 is Sunday

  return { dateStr, hours, minutes, dayOfWeek, istTime };
}

/**
 * Check if the current time matches one of the 09:30 morning check-in reminder intervals
 * Every 10 mins: 09:00, 09:10, 09:20, 09:30
 */
function getMatchingCheckInSlot(hours: number, minutes: number): string | null {
  if (hours === 9 && minutes >= 0 && minutes <= 5) {
    return '09:00';
  }
  if (hours === 9 && minutes >= 10 && minutes <= 15) {
    return '09:10';
  }
  if (hours === 9 && minutes >= 20 && minutes <= 25) {
    return '09:20';
  }
  if (hours === 9 && minutes >= 30 && minutes <= 35) {
    return '09:30';
  }
  return null;
}

/**
 * Check if the current time matches one of the 18:30 evening check-out reminder intervals
 * Every 10 mins: 18:00, 18:10, 18:20, 18:30
 */
function getMatchingCheckOutSlot(hours: number, minutes: number): string | null {
  if (hours === 18 && minutes >= 0 && minutes <= 5) {
    return '18:00';
  }
  if (hours === 18 && minutes >= 10 && minutes <= 15) {
    return '18:10';
  }
  if (hours === 18 && minutes >= 20 && minutes <= 25) {
    return '18:20';
  }
  if (hours === 18 && minutes >= 30 && minutes <= 35) {
    return '18:30';
  }
  return null;
}

/**
 * Professional, personalized copy for Check-In reminders
 */
function getCheckInReminderContent(slot: string, firstName: string) {
  const name = firstName || 'Team Member';
  switch (slot) {
    case '09:00':
      return {
        title: `⏰ Morning Check-In (30 Mins to 09:30 AM)`,
        message: `Good morning, ${name}! Standard shift starts at 09:30 AM. 30 minutes remaining to complete your morning attendance check-in.`,
      };
    case '09:10':
      return {
        title: `⏰ Check-In Reminder (20 Mins to 09:30 AM)`,
        message: `Good morning, ${name}! 20 minutes left before the 09:30 AM check-in deadline. Please open your HR portal to record your attendance.`,
      };
    case '09:20':
      return {
        title: `⏳ 10 Mins to Check-In (09:30 AM Policy)`,
        message: `Hi ${name}, only 10 minutes remaining! Please confirm your attendance before 09:30 AM to ensure on-time status.`,
      };
    case '09:30':
    default:
      return {
        title: `📍 Check-In Time: 09:30 AM Shift Start`,
        message: `Good morning, ${name}! It is 09:30 AM. Please verify and confirm your morning attendance check-in now.`,
      };
  }
}

/**
 * Professional, personalized copy for Check-Out reminders
 */
function getCheckOutReminderContent(slot: string, firstName: string) {
  const name = firstName || 'Team Member';
  switch (slot) {
    case '18:00':
      return {
        title: `⏰ Shift Ending Soon (30 Mins to 18:30)`,
        message: `Good evening, ${name}! Your standard shift completes in 30 minutes at 18:30. Please wrap up today's tasks and prepare for check-out.`,
      };
    case '18:10':
      return {
        title: `⏰ 20 Mins to Shift Check-Out (18:30 Policy)`,
        message: `Hi ${name}, 20 minutes left until 18:30 shift end. One-click check-out is ready when you finish your work.`,
      };
    case '18:20':
      return {
        title: `⏳ 10 Mins to Shift End (18:30 Policy)`,
        message: `Hi ${name}, 10 minutes remaining until 18:30! Please confirm your check-out to log today's working hours accurately.`,
      };
    case '18:30':
    default:
      return {
        title: `🏁 Shift Complete: 18:30 Check-Out`,
        message: `Great work today, ${name}! Standard shift hours are complete for today. Please confirm your check-out now.`,
      };
  }
}

/**
 * Trigger check-in reminders for all employees who have NOT checked in yet today.
 * Runs at 09:00, 09:10, 09:20, and 09:30 every 10 minutes.
 */
export async function triggerShiftCheckInReminders(forceSlot?: string) {
  try {
    const { dateStr, hours, minutes, dayOfWeek } = getISTDateComponents();

    // Skip Sundays unless manually tested
    if (dayOfWeek === 0 && !forceSlot) {
      return;
    }

    const slot = forceSlot || getMatchingCheckInSlot(hours, minutes);
    if (!slot) {
      return;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 1. Fetch all registered employees
    const allEmployees = await prisma.employee.findMany({
      select: {
        employeeId: true,
        firstName: true,
        lastName: true,
      },
    });

    if (allEmployees.length === 0) {
      return;
    }

    // 2. Fetch employees who have already checked in today
    const checkedInToday = await prisma.attendance.findMany({
      where: {
        date: { gte: todayStart, lte: todayEnd },
        checkIn: { not: null },
      },
      select: { employeeId: true },
    });

    const checkedInSet = new Set(checkedInToday.map((a) => a.employeeId));

    // 3. Filter employees pending check-in
    const pendingEmployees = allEmployees.filter((emp) => !checkedInSet.has(emp.employeeId));

    if (pendingEmployees.length === 0) {
      return;
    }

    console.log(
      `[ShiftReminder:CheckIn] Sending ${slot} reminder to ${pendingEmployees.length} pending employees.`
    );

    for (const emp of pendingEmployees) {
      const trackingKey = `${dateStr}:${emp.employeeId}:checkin:${slot}`;

      if (!forceSlot && sentRemindersToday.has(trackingKey)) {
        continue;
      }
      sentRemindersToday.add(trackingKey);

      const content = getCheckInReminderContent(slot, emp.firstName);

      // In-App Notification
      try {
        await prisma.notification.create({
          data: {
            employeeId: emp.employeeId,
            title: content.title,
            message: content.message,
          },
        });
      } catch {
        // Ignore duplicate key notice
      }

      // Realtime WebSocket Notification
      socketService.sendNotification(emp.employeeId, 'notification', {
        title: content.title,
        message: content.message,
        actionUrl: '/attendance?action=checkin',
        actionLabel: 'Check In Now',
        type: 'CHECKIN_REMINDER',
      });

      // Native Web Push Notification (Tray / Lock Screen)
      WebPushService.sendPushToEmployee(emp.employeeId, {
        title: content.title,
        body: content.message,
        url: '/attendance?action=checkin',
        type: 'GENERAL',
        tag: `checkin-reminder-${slot}`,
        actions: [
          { action: 'checkin', title: 'Check In Now' },
          { action: 'open', title: 'Open HRMS' },
        ],
      }).catch((pushErr) => {
        console.warn(`[ShiftReminder:CheckIn] Push note for ${emp.employeeId}:`, pushErr?.message);
      });
    }
  } catch (error: any) {
    console.error('[ShiftReminder:CheckIn] Error sending check-in reminders:', error?.message || error);
  }
}

/**
 * Trigger check-out reminders for employees who are checked in and have not checked out yet.
 * Runs at 18:00, 18:10, 18:20, and 18:30 every 10 minutes.
 */
export async function triggerShiftCheckOutReminders(forceSlot?: string) {
  try {
    const { dateStr, hours, minutes, dayOfWeek } = getISTDateComponents();

    // Skip Sundays unless manually tested
    if (dayOfWeek === 0 && !forceSlot) {
      return;
    }

    const slot = forceSlot || getMatchingCheckOutSlot(hours, minutes);
    if (!slot) {
      return;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Find all employees checked in today who have not yet checked out
    const activeAttendanceRecords = await prisma.attendance.findMany({
      where: {
        date: { gte: todayStart, lte: todayEnd },
        checkIn: { not: null },
        checkOut: null,
      },
      select: {
        id: true,
        employeeId: true,
      },
    });

    if (activeAttendanceRecords.length === 0) {
      return;
    }

    // Fetch employee names for personalization
    const employeeIds = activeAttendanceRecords.map((r) => r.employeeId);
    const employees = await prisma.employee.findMany({
      where: { employeeId: { in: employeeIds } },
      select: { employeeId: true, firstName: true },
    });
    const empNameMap = new Map(employees.map((e) => [e.employeeId, e.firstName]));

    console.log(
      `[ShiftReminder:CheckOut] Sending ${slot} reminder to ${activeAttendanceRecords.length} active employees.`
    );

    for (const record of activeAttendanceRecords) {
      const trackingKey = `${dateStr}:${record.employeeId}:checkout:${slot}`;

      if (!forceSlot && sentRemindersToday.has(trackingKey)) {
        continue;
      }
      sentRemindersToday.add(trackingKey);

      const fName = empNameMap.get(record.employeeId) || 'Champion';
      const content = getCheckOutReminderContent(slot, fName);

      // In-App Notification
      try {
        await prisma.notification.create({
          data: {
            employeeId: record.employeeId,
            title: content.title,
            message: content.message,
          },
        });
      } catch {
        // Ignore duplicate in-app notice
      }

      // Real-time Socket Notification
      socketService.sendNotification(record.employeeId, 'notification', {
        title: content.title,
        message: content.message,
        actionUrl: '/attendance?action=checkout',
        actionLabel: 'Check Out Now',
        type: 'CHECKOUT_REMINDER',
      });

      // Native PWA Push Notification (Works outside app / on phone screen)
      WebPushService.sendPushToEmployee(record.employeeId, {
        title: content.title,
        body: content.message,
        url: '/attendance?action=checkout',
        type: 'CHECKOUT_REMINDER',
        tag: `checkout-reminder-${slot}`,
        actions: [
          { action: 'checkout', title: 'Check Out Now' },
          { action: 'open', title: 'Open HRMS' },
        ],
      }).catch((pushErr) => {
        console.warn(`[ShiftReminder:CheckOut] Push failed for ${record.employeeId}:`, pushErr?.message);
      });
    }
  } catch (error: any) {
    console.error('[ShiftReminder:CheckOut] Error running shift reminder checker:', error?.message || error);
  }
}

/**
 * Start the shift reminder background scheduler.
 * Runs every 60 seconds to check against:
 *   - Morning check-in intervals: 09:00, 09:10, 09:20, 09:30 (every 10m)
 *   - Evening check-out intervals: 18:00, 18:10, 18:20, 18:30 (every 10m)
 */
let reminderInterval: NodeJS.Timeout | null = null;

export function startShiftReminderScheduler() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
  }

  console.log(
    '⏰ [ShiftReminder] Started 09:30 Check-In & 18:30 Check-Out schedulers (every 10 mins, evaluated every 60s)'
  );

  // Run initial checks on start
  triggerShiftCheckInReminders().catch(() => {});
  triggerShiftCheckOutReminders().catch(() => {});
  checkAndSendScheduledGreetings().catch(() => {});

  // Run checks every 60 seconds
  reminderInterval = setInterval(() => {
    triggerShiftCheckInReminders().catch(() => {});
    triggerShiftCheckOutReminders().catch(() => {});
    checkAndSendScheduledGreetings().catch(() => {});
  }, 60000);
}

export function stopShiftReminderScheduler() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
}
