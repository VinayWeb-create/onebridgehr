import { prisma } from '../config/db';
import { socketService } from './socketService';
import { WebPushService } from './webPushService';
import { checkAndSendScheduledGreetings } from './energeticGreetingService';

/**
 * Tracks sent reminders today so an employee is only alerted once per 10-minute slot.
 * Key format: `YYYY-MM-DD:empId:slot` (e.g., `2026-10-13:OBI0006:18:00`)
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
 * Check if the current time matches one of the 18:30 shift reminder intervals
 */
function getMatchingShiftSlot(hours: number, minutes: number): string | null {
  // Slot 1: 18:00 (18:00 - 18:05)
  if (hours === 18 && minutes >= 0 && minutes <= 5) {
    return '18:00';
  }
  // Slot 2: 18:10 (18:10 - 18:15)
  if (hours === 18 && minutes >= 10 && minutes <= 15) {
    return '18:10';
  }
  // Slot 3: 18:20 (18:20 - 18:25)
  if (hours === 18 && minutes >= 20 && minutes <= 25) {
    return '18:20';
  }
  // Shift End / Grace: 18:30 (18:30 - 18:35)
  if (hours === 18 && minutes >= 30 && minutes <= 35) {
    return '18:30';
  }

  return null;
}

/**
 * Trigger shift check-out reminders for employees who are currently checked in and not checked out yet.
 */
export async function triggerShiftCheckOutReminders(forceSlot?: string) {
  try {
    const { dateStr, hours, minutes, dayOfWeek } = getISTDateComponents();

    // Skip Sundays unless testing
    if (dayOfWeek === 0 && !forceSlot) {
      return;
    }

    const slot = forceSlot || getMatchingShiftSlot(hours, minutes);
    if (!slot) {
      return;
    }

    // Determine reminder message & details based on slot
    let title = '⏰ Shift Check-Out Reminder (18:30 Policy)';
    let message = 'Your standard working shift completes at 18:30. You can check out now.';

    if (slot === '18:00') {
      title = '⏰ Shift Ending Soon: 30 Mins to 18:30';
      message = 'Your shift completes at 18:30. Finish your current tasks and check out easily when ready.';
    } else if (slot === '18:10') {
      title = '⏰ Shift Reminder: 20 Mins to 18:30';
      message = '20 minutes remaining until 18:30 shift end. One-click check-out is ready (no GPS or face scan needed).';
    } else if (slot === '18:20') {
      title = '⏰ Shift Ending in 10 Mins (18:30 Policy)';
      message = '10 minutes left until 18:30. Click below to confirm check out and complete your attendance for today.';
    } else if (slot === '18:30') {
      title = '🏁 Shift Complete: 18:30 Policy Reached';
      message = 'Your 18:30 shift has completed! Please confirm your check-out to record today\'s work hours.';
    }

    // Find all employees checked in today who have not yet checked out
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const activeAttendanceRecords = await prisma.attendance.findMany({
      where: {
        date: todayStart,
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

    console.log(
      `[ShiftReminder] Processing ${slot} reminders for ${activeAttendanceRecords.length} active employees.`
    );

    for (const record of activeAttendanceRecords) {
      const trackingKey = `${dateStr}:${record.employeeId}:${slot}`;

      if (!forceSlot && sentRemindersToday.has(trackingKey)) {
        continue;
      }
      sentRemindersToday.add(trackingKey);

      // 1. In-App Notification
      try {
        await prisma.notification.create({
          data: {
            employeeId: record.employeeId,
            title,
            message,
          },
        });
      } catch (err) {
        // Ignore duplicate in-app notice
      }

      // 2. Real-time Socket Notification
      socketService.sendNotification(record.employeeId, 'notification', {
        title,
        message,
        actionUrl: '/attendance?action=checkout',
        actionLabel: 'Check Out Now',
        type: 'CHECKOUT_REMINDER',
      });

      // 3. Native PWA Push Notification (Works even if app is closed!)
      WebPushService.sendPushToEmployee(record.employeeId, {
        title,
        body: message,
        url: '/attendance?action=checkout',
        type: 'CHECKOUT_REMINDER',
        tag: `checkout-reminder-${slot}`,
        actions: [
          { action: 'checkout', title: 'Check Out Now' },
          { action: 'open', title: 'Open HRMS' },
        ],
      }).catch((pushErr) => {
        console.warn(`[ShiftReminder] Push failed for ${record.employeeId}:`, pushErr.message);
      });
    }
  } catch (error: any) {
    console.error('[ShiftReminder] Error running shift reminder checker:', error?.message || error);
  }
}

/**
 * Start the shift reminder background scheduler.
 * Runs every 60 seconds to check against 18:00, 18:10, 18:20, and 18:30 intervals.
 */
let reminderInterval: NodeJS.Timeout | null = null;

export function startShiftReminderScheduler() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
  }

  console.log('⏰ [ShiftReminder] Started 18:30 shift check-out reminder scheduler (running every 60s)');

  // Run initial checks
  triggerShiftCheckOutReminders().catch(() => {});
  checkAndSendScheduledGreetings().catch(() => {});

  // Run every 60 seconds
  reminderInterval = setInterval(() => {
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
