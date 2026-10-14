import { prisma } from '../config/db';
import { socketService } from './socketService';
import { WebPushService } from './webPushService';

export type NotificationCategory =
  | 'ATTENDANCE'
  | 'MEETINGS'
  | 'CHAT'
  | 'FILES'
  | 'HR_UPDATES'
  | 'ANNOUNCEMENTS'
  | 'GENERAL';

export type NotificationType =
  | 'SHIFT_START_REMINDER'
  | 'MISSED_CHECKIN_REMINDER'
  | 'LUNCH_START_REMINDER'
  | 'LUNCH_NOT_STARTED_REMINDER'
  | 'LUNCH_END_WARNING'
  | 'CHECKOUT_REMINDER'
  | 'MISSED_CHECKOUT_REMINDER'
  | 'MEETING_CREATED'
  | 'MEETING_UPDATED'
  | 'MEETING_15M_REMINDER'
  | 'MEETING_5M_REMINDER'
  | 'MEETING_STARTED'
  | 'MEETING_CANCELLED'
  | 'CHAT_MESSAGE'
  | 'CHAT_MENTION'
  | 'CHAT_REPLY'
  | 'CHAT_FILE'
  | 'CHAT_MISSED_CALL'
  | 'CHAT_HUDDLE_STARTED'
  | 'LEAVE_APPROVED'
  | 'LEAVE_REJECTED'
  | 'HOLIDAY_TOMORROW'
  | 'COMPANY_ANNOUNCEMENT'
  | 'PAYROLL_PROCESSED'
  | 'DOCUMENT_SHARED'
  | 'GENERAL';

interface DispatchOptions {
  employeeId: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  actionUrl?: string;
  tag?: string;
  pushActions?: Array<{ action: string; title: string }>;
  force?: boolean;
}

export interface AdminNotificationConfig {
  shiftStartBeforeMinutes: number; // default: 10
  shiftStartAfterMinutes: number;  // default: 5
  lunchTime: string;               // default: "13:00"
  lunchDurationMinutes: number;   // default: 60
  lunchReminderBeforeEnd: number; // default: 15
  checkoutBeforeMinutes: number;  // default: 15
  checkoutAfterMinutes: number;   // default: 5
  meetingReminders: number[];     // default: [15, 5]
  announcementPriority: string;   // default: "MEDIUM"
  templates: Record<string, string>;
}

export const DEFAULT_ADMIN_CONFIG: AdminNotificationConfig = {
  shiftStartBeforeMinutes: 10,
  shiftStartAfterMinutes: 5,
  lunchTime: '13:00',
  lunchDurationMinutes: 60,
  lunchReminderBeforeEnd: 15,
  checkoutBeforeMinutes: 15,
  checkoutAfterMinutes: 5,
  meetingReminders: [15, 5],
  announcementPriority: 'MEDIUM',
  templates: {
    shiftStart: 'Your shift starts in {minutes} minutes.',
    missedCheckIn: "You haven't checked in yet. Please mark your attendance.",
    lunchStart: "It's time for your lunch break.",
    lunchNotStarted: "You haven't started your lunch break yet.",
    lunchEndWarning: 'Your lunch break will end in {minutes} minutes.',
    checkoutWarning: 'Your shift ends in {minutes} minutes.',
    missedCheckout: 'You forgot to check out.',
    meeting15m: 'Meeting starts in 15 minutes: {title}',
    meeting5m: 'Meeting starts in 5 minutes: {title}',
    meetingStarted: 'Meeting started: {title}',
    meetingCancelled: 'Meeting cancelled: {title}',
    leaveApproved: 'Your leave application ({leaveType}) has been approved.',
    leaveRejected: 'Your leave application ({leaveType}) has been rejected.',
    holidayTomorrow: 'Tomorrow is a holiday: {name}. Enjoy your time off!',
    payrollProcessed: 'Your payslip for {period} has been generated.',
    documentShared: 'A new document has been shared with you: {name}',
  },
};

class NotificationEngine {
  // In-memory set for fast idempotency check within current server run
  // Key format: YYYY-MM-DD:employeeId:tag
  private sentKeysToday = new Set<string>();

  // Tracks active actions to immediately suppress future reminders
  private checkedInEmployeesToday = new Set<string>();
  private checkedOutEmployeesToday = new Set<string>();
  private lunchStartedEmployeesToday = new Set<string>();
  private lunchEndedEmployeesToday = new Set<string>();
  private cancelledMeetingIds = new Set<string>();

  private schedulerInterval: NodeJS.Timeout | null = null;
  private cachedAdminConfig: AdminNotificationConfig | null = null;

  constructor() {
    this.resetDailyCacheAtMidnight();
  }

  /**
   * Resets daily tracker sets at midnight IST
   */
  private resetDailyCacheAtMidnight() {
    const checkMidnight = () => {
      const now = this.getISTDateComponents();
      if (now.hours === 0 && now.minutes === 0) {
        this.sentKeysToday.clear();
        this.checkedInEmployeesToday.clear();
        this.checkedOutEmployeesToday.clear();
        this.lunchStartedEmployeesToday.clear();
        this.lunchEndedEmployeesToday.clear();
      }
    };
    setInterval(checkMidnight, 60000);
  }

  /**
   * Returns current Indian Standard Time (IST, UTC+5:30) date components
   */
  public getISTDateComponents(dateInput?: Date) {
    const base = dateInput || new Date();
    const utc = base.getTime() + base.getTimezoneOffset() * 60000;
    const istTime = new Date(utc + 3600000 * 5.5);

    const year = istTime.getFullYear();
    const month = String(istTime.getMonth() + 1).padStart(2, '0');
    const day = String(istTime.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    const dayOfWeek = istTime.getDay(); // 0 is Sunday

    return { dateStr, hours, minutes, totalMinutes, dayOfWeek, istTime };
  }

  /**
   * Parse "HH:MM" string to minutes from midnight
   */
  public timeStringToMinutes(timeStr: string): number {
    const [h, m] = timeStr.split(':').map((x) => parseInt(x, 10));
    return (h || 0) * 60 + (m || 0);
  }

  /**
   * Get Admin Notification Configuration
   */
  public async getAdminConfig(): Promise<AdminNotificationConfig> {
    if (this.cachedAdminConfig) {
      return this.cachedAdminConfig;
    }
    try {
      const record = await prisma.notificationAdminConfig.findUnique({
        where: { key: 'DEFAULT' },
      });
      if (record) {
        this.cachedAdminConfig = {
          shiftStartBeforeMinutes: record.shiftStartBeforeMinutes,
          shiftStartAfterMinutes: record.shiftStartAfterMinutes,
          lunchTime: record.lunchTime,
          lunchDurationMinutes: record.lunchDurationMinutes,
          lunchReminderBeforeEnd: record.lunchReminderBeforeEnd,
          checkoutBeforeMinutes: record.checkoutBeforeMinutes,
          checkoutAfterMinutes: record.checkoutAfterMinutes,
          meetingReminders: record.meetingReminders,
          announcementPriority: record.announcementPriority,
          templates: (record.templates as Record<string, string>) || DEFAULT_ADMIN_CONFIG.templates,
        };
        return this.cachedAdminConfig;
      }
    } catch (err) {
      console.warn('[NotificationEngine] Error fetching admin config from DB, using defaults:', err);
    }
    this.cachedAdminConfig = { ...DEFAULT_ADMIN_CONFIG };
    return this.cachedAdminConfig;
  }

  /**
   * Update Admin Notification Configuration
   */
  public async updateAdminConfig(
    data: Partial<AdminNotificationConfig>,
    updatedBy?: string
  ): Promise<AdminNotificationConfig> {
    const current = await this.getAdminConfig();
    const merged: AdminNotificationConfig = {
      ...current,
      ...data,
      templates: { ...current.templates, ...(data.templates || {}) },
    };

    await prisma.notificationAdminConfig.upsert({
      where: { key: 'DEFAULT' },
      create: {
        key: 'DEFAULT',
        shiftStartBeforeMinutes: merged.shiftStartBeforeMinutes,
        shiftStartAfterMinutes: merged.shiftStartAfterMinutes,
        lunchTime: merged.lunchTime,
        lunchDurationMinutes: merged.lunchDurationMinutes,
        lunchReminderBeforeEnd: merged.lunchReminderBeforeEnd,
        checkoutBeforeMinutes: merged.checkoutBeforeMinutes,
        checkoutAfterMinutes: merged.checkoutAfterMinutes,
        meetingReminders: merged.meetingReminders,
        announcementPriority: merged.announcementPriority,
        templates: merged.templates,
        updatedBy: updatedBy || null,
      },
      update: {
        shiftStartBeforeMinutes: merged.shiftStartBeforeMinutes,
        shiftStartAfterMinutes: merged.shiftStartAfterMinutes,
        lunchTime: merged.lunchTime,
        lunchDurationMinutes: merged.lunchDurationMinutes,
        lunchReminderBeforeEnd: merged.lunchReminderBeforeEnd,
        checkoutBeforeMinutes: merged.checkoutBeforeMinutes,
        checkoutAfterMinutes: merged.checkoutAfterMinutes,
        meetingReminders: merged.meetingReminders,
        announcementPriority: merged.announcementPriority,
        templates: merged.templates,
        updatedBy: updatedBy || null,
        updatedAt: new Date(),
      },
    });

    this.cachedAdminConfig = merged;
    return merged;
  }

  /**
   * Get User Notification Preferences
   */
  public async getUserPreferences(employeeId: string) {
    try {
      const pref = await prisma.notificationPreference.findUnique({
        where: { employeeId },
      });
      if (pref) return pref;

      return await prisma.notificationPreference.create({
        data: {
          employeeId,
          attendance: true,
          meetings: true,
          chat: true,
          files: true,
          hrUpdates: true,
          announcements: true,
        },
      });
    } catch {
      return {
        employeeId,
        attendance: true,
        meetings: true,
        chat: true,
        files: true,
        hrUpdates: true,
        announcements: true,
      };
    }
  }

  /**
   * Update User Notification Preferences
   */
  public async updateUserPreferences(
    employeeId: string,
    updates: {
      attendance?: boolean;
      meetings?: boolean;
      chat?: boolean;
      files?: boolean;
      hrUpdates?: boolean;
      announcements?: boolean;
    }
  ) {
    return await prisma.notificationPreference.upsert({
      where: { employeeId },
      create: {
        employeeId,
        attendance: updates.attendance ?? true,
        meetings: updates.meetings ?? true,
        chat: updates.chat ?? true,
        files: updates.files ?? true,
        hrUpdates: updates.hrUpdates ?? true,
        announcements: updates.announcements ?? true,
      },
      update: {
        ...updates,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Checks if an employee has enabled notifications for a specific category
   */
  private async isCategoryEnabledForUser(
    employeeId: string,
    category: NotificationCategory
  ): Promise<boolean> {
    const prefs = await this.getUserPreferences(employeeId);
    switch (category) {
      case 'ATTENDANCE':
        return prefs.attendance !== false;
      case 'MEETINGS':
        return prefs.meetings !== false;
      case 'CHAT':
        return prefs.chat !== false;
      case 'FILES':
        return prefs.files !== false;
      case 'HR_UPDATES':
        return prefs.hrUpdates !== false;
      case 'ANNOUNCEMENTS':
        return prefs.announcements !== false;
      default:
        return true;
    }
  }

  /**
   * Centralized Dispatcher & Logger
   * - Respects user preferences
   * - Enforces idempotency & deduplication
   * - Logs to MongoDB Notification collection
   * - Sends via real-time WebSocket
   * - Sends via Native WebPush
   */
  public async dispatchNotification(options: DispatchOptions) {
    const {
      employeeId,
      type,
      category,
      title,
      message,
      actionUrl = '/dashboard',
      tag,
      pushActions = [
        { action: 'open', title: 'Open HRMS' },
        { action: 'close', title: 'Dismiss' },
      ],
      force = false,
    } = options;

    try {
      // 1. User Preference Check
      const allowed = await this.isCategoryEnabledForUser(employeeId, category);
      if (!allowed) {
        return null;
      }

      // 2. Idempotency & Deduplication
      const { dateStr } = this.getISTDateComponents();
      const dedupeKey = tag ? `${dateStr}:${employeeId}:${tag}` : `${dateStr}:${employeeId}:${type}`;

      if (!force && this.sentKeysToday.has(dedupeKey)) {
        return null;
      }
      this.sentKeysToday.add(dedupeKey);

      // 3. Database Logging (Notification model)
      const notificationLog = await prisma.notification.create({
        data: {
          employeeId,
          title,
          message,
          type,
          category,
          status: 'DELIVERED',
          actionUrl,
          deliveredAt: new Date(),
          isRead: false,
        },
      });

      // 4. Real-time WebSocket Notification
      socketService.sendNotification(employeeId, 'notification', {
        id: notificationLog.id,
        title,
        message,
        type,
        category,
        actionUrl,
        deliveredAt: notificationLog.deliveredAt,
        isRead: false,
      });

      // 5. Native Web Push Notification (Desktop Tray / Mobile Lock Screen)
      WebPushService.sendPushToEmployee(employeeId, {
        title,
        body: message,
        url: actionUrl,
        tag: tag || `obi-${type.toLowerCase()}-${dateStr}`,
        actions: pushActions,
        requireInteraction: true,
      }).catch((pushErr) => {
        console.warn(`[NotificationEngine:Push] WebPush notice for ${employeeId}:`, pushErr?.message || pushErr);
      });

      return notificationLog;
    } catch (error: any) {
      console.error(`[NotificationEngine] Error dispatching to ${employeeId}:`, error?.message || error);
      return null;
    }
  }

  // =========================================================================
  // ACTION COMPLETION HOOKS (Strict System Rules)
  // =========================================================================

  /**
   * Called immediately when an employee checks in.
   * Cancels remaining Check-In reminders for today.
   */
  public onAttendanceCheckIn(employeeId: string) {
    this.checkedInEmployeesToday.add(employeeId);
    console.log(`[NotificationEngine] Check-in logged for ${employeeId}. Suppressing further check-in reminders.`);
  }

  /**
   * Called immediately when an employee starts lunch break.
   */
  public onLunchStart(employeeId: string) {
    this.lunchStartedEmployeesToday.add(employeeId);
    console.log(`[NotificationEngine] Lunch started for ${employeeId}. Suppressing lunch start reminders.`);
  }

  /**
   * Called immediately when an employee ends lunch break.
   */
  public onLunchEnd(employeeId: string) {
    this.lunchEndedEmployeesToday.add(employeeId);
    console.log(`[NotificationEngine] Lunch ended for ${employeeId}. Suppressing all lunch reminders.`);
  }

  /**
   * Called immediately when an employee checks out.
   * Cancels remaining Check-Out reminders for today.
   */
  public onAttendanceCheckOut(employeeId: string) {
    this.checkedOutEmployeesToday.add(employeeId);
    console.log(`[NotificationEngine] Check-out logged for ${employeeId}. Suppressing further check-out reminders.`);
  }

  /**
   * Called when a meeting is cancelled.
   */
  public onMeetingCancelled(meetingId: string) {
    this.cancelledMeetingIds.add(meetingId);
    console.log(`[NotificationEngine] Meeting ${meetingId} cancelled. Suppressing meeting reminders.`);
  }

  // =========================================================================
  // AUTOMATED SCHEDULERS & PERIODIC EVALUATORS
  // =========================================================================

  /**
   * Evaluates Attendance & Shift Reminders across all active employees
   */
  public async evaluateAttendanceReminders() {
    try {
      const { dateStr, totalMinutes, dayOfWeek } = this.getISTDateComponents();
      // Skip Sundays
      if (dayOfWeek === 0) return;

      const config = await this.getAdminConfig();

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // 1. Fetch attendance policies or fallback defaults
      const policies = await prisma.attendancePolicy.findMany({
        where: { status: 'ACTIVE' },
      });
      const defaultPolicy = policies.find((p) => p.isDefault) || policies[0];

      const shiftStartStr = defaultPolicy?.workingHoursStart || '09:30';
      const shiftEndStr = defaultPolicy?.workingHoursEnd || '18:30';

      const shiftStartMinutes = this.timeStringToMinutes(shiftStartStr);
      const shiftEndMinutes = this.timeStringToMinutes(shiftEndStr);

      const lunchStartMinutes = this.timeStringToMinutes(config.lunchTime || '13:00');
      const lunchEndMinutes = lunchStartMinutes + (config.lunchDurationMinutes || 60);

      // Fetch all registered employees
      const employees = await prisma.employee.findMany({
        select: { employeeId: true, firstName: true },
      });
      if (employees.length === 0) return;

      // Fetch today's attendance records
      const attendances = await prisma.attendance.findMany({
        where: {
          date: { gte: todayStart, lte: todayEnd },
        },
      });

      const attendanceMap = new Map(attendances.map((a) => [a.employeeId, a]));

      for (const emp of employees) {
        const empId = emp.employeeId;
        const att = attendanceMap.get(empId);
        const name = emp.firstName || 'Team Member';

        // Update in-memory trackers from DB record state
        if (att?.checkIn) this.checkedInEmployeesToday.add(empId);
        if (att?.checkOut) this.checkedOutEmployeesToday.add(empId);
        if (att?.breaks && att.breaks.some((b) => !b.end)) this.lunchStartedEmployeesToday.add(empId);
        if (att?.breaks && att.breaks.length > 0 && att.breaks.every((b) => b.end)) {
          this.lunchEndedEmployeesToday.add(empId);
        }

        const isCheckedIn = this.checkedInEmployeesToday.has(empId);
        const isCheckedOut = this.checkedOutEmployeesToday.has(empId);
        const hasStartedLunch = this.lunchStartedEmployeesToday.has(empId);
        const hasEndedLunch = this.lunchEndedEmployeesToday.has(empId);

        // --- 1. SHIFT START REMINDERS ---
        // (A) 10 Minutes (configurable) before shift starts
        const startWarningMinute = shiftStartMinutes - config.shiftStartBeforeMinutes;
        if (totalMinutes >= startWarningMinute && totalMinutes < shiftStartMinutes) {
          if (!isCheckedIn) {
            const rawTemplate = config.templates.shiftStart || DEFAULT_ADMIN_CONFIG.templates.shiftStart;
            const message = rawTemplate.replace('{minutes}', String(config.shiftStartBeforeMinutes));
            await this.dispatchNotification({
              employeeId: empId,
              type: 'SHIFT_START_REMINDER',
              category: 'ATTENDANCE',
              title: `⏰ Shift Starts in ${config.shiftStartBeforeMinutes} Mins`,
              message: `Hi ${name}, ${message}`,
              actionUrl: '/attendance?action=checkin',
              tag: `shift-start-warning-${dateStr}`,
              pushActions: [
                { action: 'checkin', title: 'Check In' },
                { action: 'open', title: 'Open HRMS' },
              ],
            });
          }
        }

        // (B) 5 Minutes (configurable) after shift start: Employee has not checked in
        const missedCheckInMinute = shiftStartMinutes + config.shiftStartAfterMinutes;
        if (totalMinutes >= missedCheckInMinute && totalMinutes < missedCheckInMinute + 30) {
          if (!isCheckedIn) {
            const message = config.templates.missedCheckIn || DEFAULT_ADMIN_CONFIG.templates.missedCheckIn;
            await this.dispatchNotification({
              employeeId: empId,
              type: 'MISSED_CHECKIN_REMINDER',
              category: 'ATTENDANCE',
              title: `📍 Check-In Required`,
              message: `Hi ${name}, ${message}`,
              actionUrl: '/attendance?action=checkin',
              tag: `missed-checkin-${dateStr}`,
              pushActions: [
                { action: 'checkin', title: 'Check In Now' },
                { action: 'open', title: 'Open HRMS' },
              ],
            });
          }
        }

        // --- 2. LUNCH BREAK REMINDERS (Only for checked-in employees who haven't checked out) ---
        if (isCheckedIn && !isCheckedOut) {
          // (A) Lunch Time Arrived (e.g. 01:00 PM)
          if (totalMinutes >= lunchStartMinutes && totalMinutes < lunchStartMinutes + 10) {
            if (!hasStartedLunch) {
              const message = config.templates.lunchStart || DEFAULT_ADMIN_CONFIG.templates.lunchStart;
              await this.dispatchNotification({
                employeeId: empId,
                type: 'LUNCH_START_REMINDER',
                category: 'ATTENDANCE',
                title: `🍱 Lunch Break Time`,
                message: `Hi ${name}, ${message}`,
                actionUrl: '/attendance?action=break',
                tag: `lunch-start-${dateStr}`,
                pushActions: [
                  { action: 'break', title: 'Start Lunch' },
                  { action: 'open', title: 'Open HRMS' },
                ],
              });
            }
          }

          // (B) Lunch Not Started Reminder (15 mins after lunch start)
          if (totalMinutes >= lunchStartMinutes + 15 && totalMinutes < lunchStartMinutes + 25) {
            if (!hasStartedLunch) {
              const message = config.templates.lunchNotStarted || DEFAULT_ADMIN_CONFIG.templates.lunchNotStarted;
              await this.dispatchNotification({
                employeeId: empId,
                type: 'LUNCH_NOT_STARTED_REMINDER',
                category: 'ATTENDANCE',
                title: `🍱 Lunch Reminder`,
                message: `Hi ${name}, ${message}`,
                actionUrl: '/attendance?action=break',
                tag: `lunch-not-started-${dateStr}`,
              });
            }
          }

          // (C) 15 Minutes Before Lunch Ends
          const lunchEndWarningMinute = lunchEndMinutes - config.lunchReminderBeforeEnd;
          if (totalMinutes >= lunchEndWarningMinute && totalMinutes < lunchEndMinutes) {
            if (hasStartedLunch && !hasEndedLunch) {
              const rawTemplate =
                config.templates.lunchEndWarning || DEFAULT_ADMIN_CONFIG.templates.lunchEndWarning;
              const message = rawTemplate.replace('{minutes}', String(config.lunchReminderBeforeEnd));
              await this.dispatchNotification({
                employeeId: empId,
                type: 'LUNCH_END_WARNING',
                category: 'ATTENDANCE',
                title: `⏳ Lunch Break Ending Soon`,
                message: `Hi ${name}, ${message}`,
                actionUrl: '/attendance?action=break',
                tag: `lunch-end-warning-${dateStr}`,
              });
            }
          }
        }

        // --- 3. CHECK OUT REMINDERS ---
        if (isCheckedIn && !isCheckedOut) {
          // (A) Warning before shift ends (e.g. 15 minutes before 18:30)
          const checkoutWarningMinute = shiftEndMinutes - config.checkoutBeforeMinutes;
          if (totalMinutes >= checkoutWarningMinute && totalMinutes < shiftEndMinutes) {
            const rawTemplate =
              config.templates.checkoutWarning || DEFAULT_ADMIN_CONFIG.templates.checkoutWarning;
            const message = rawTemplate.replace('{minutes}', String(config.checkoutBeforeMinutes));
            await this.dispatchNotification({
              employeeId: empId,
              type: 'CHECKOUT_REMINDER',
              category: 'ATTENDANCE',
              title: `⏰ Shift Ending in ${config.checkoutBeforeMinutes} Mins`,
              message: `Hi ${name}, ${message}`,
              actionUrl: '/attendance?action=checkout',
              tag: `checkout-warning-${dateStr}`,
              pushActions: [
                { action: 'checkout', title: 'Check Out' },
                { action: 'open', title: 'Open HRMS' },
              ],
            });
          }

          // (B) Exact shift end (18:30): Shift completed, immediate quick reminder
          if (totalMinutes >= shiftEndMinutes && totalMinutes < shiftEndMinutes + 5) {
            await this.dispatchNotification({
              employeeId: empId,
              type: 'CHECKOUT_REMINDER',
              category: 'ATTENDANCE',
              title: `🏁 Shift Complete (${shiftEndStr}): Check-Out Time`,
              message: `Great work today, ${name}! Your standard shift ended at ${shiftEndStr}. Tap here for quick 1-click check-out.`,
              actionUrl: '/attendance?action=checkout',
              tag: `checkout-exact-${dateStr}`,
              pushActions: [
                { action: 'checkout', title: 'Check Out Now' },
                { action: 'open', title: 'Open HRMS' },
              ],
            });
          }

          // (C) Post-18:30 Overdue Checkouts (+10m, +20m, +30m, +45m, +60m, +90m past shift end)
          const overdueCheckpoints = [
            { offset: 10, title: `⚡ Quick Reminder: Check Out (${shiftEndStr} Shift Ended)`, msg: `Hi ${name}, your shift completed 10 minutes ago at ${shiftEndStr}. 1-click check-out is ready.` },
            { offset: 20, title: `⏰ Check-Out Reminder: 20 Mins Past Shift`, msg: `Hi ${name}, you are still clocked in past ${shiftEndStr}. Please take a second to confirm your check-out.` },
            { offset: 30, title: `📍 Pending Check-Out (30 Mins Past ${shiftEndStr})`, msg: `Good evening ${name}! It is 30 mins after shift end. Tap now to confirm your check-out.` },
            { offset: 45, title: `⏳ Overdue Check-Out: ${shiftEndStr} Shift End`, msg: `Hi ${name}, please remember to check out of today's shift! Quick 1-click check-out is available.` },
            { offset: 60, title: `🌙 Evening Check-Out Notice (1 Hr Past ${shiftEndStr})`, msg: `Hi ${name}, 1 hour has elapsed since shift end. Please tap to finalize today's working hours.` },
            { offset: 90, title: `🚨 Action Required: Check Out of Today's Shift`, msg: `Hi ${name}, your shift attendance for today is still active. Please confirm check-out now so your record is finalized.` },
          ];

          for (const cp of overdueCheckpoints) {
            const checkpointMinute = shiftEndMinutes + cp.offset;
            if (totalMinutes >= checkpointMinute && totalMinutes < checkpointMinute + 5) {
              await this.dispatchNotification({
                employeeId: empId,
                type: 'MISSED_CHECKOUT_REMINDER',
                category: 'ATTENDANCE',
                title: cp.title,
                message: cp.msg,
                actionUrl: '/attendance?action=checkout',
                tag: `checkout-overdue-${cp.offset}m-${dateStr}`,
                pushActions: [
                  { action: 'checkout', title: 'Check Out Now' },
                  { action: 'open', title: 'Open HRMS' },
                ],
              });
            }
          }
        }
      }
    } catch (err: any) {
      console.error('[NotificationEngine:Attendance] Error evaluating attendance reminders:', err?.message || err);
    }
  }

  /**
   * Evaluates Upcoming Meeting Reminders (15m before, 5m before, meeting started)
   */
  public async evaluateMeetingReminders() {
    try {
      const now = new Date();
      const in20Minutes = new Date(now.getTime() + 20 * 60000);

      const upcomingMeetings = await prisma.meeting.findMany({
        where: {
          startTime: { gte: new Date(now.getTime() - 5 * 60000), lte: in20Minutes },
          status: { in: ['SCHEDULED', 'STARTED'] },
        },
      });

      for (const meeting of upcomingMeetings) {
        if (this.cancelledMeetingIds.has(meeting.id)) continue;

        const diffMinutes = Math.round((meeting.startTime.getTime() - now.getTime()) / 60000);

        // 15 Minutes Before Reminder (between 13 and 16 minutes)
        if (diffMinutes >= 13 && diffMinutes <= 16) {
          for (const empId of meeting.participantIds) {
            await this.dispatchNotification({
              employeeId: empId,
              type: 'MEETING_15M_REMINDER',
              category: 'MEETINGS',
              title: `📅 Meeting in 15 Mins: ${meeting.title}`,
              message: `Your meeting "${meeting.title}" starts in 15 minutes.`,
              actionUrl: meeting.link || '/dashboard',
              tag: `meeting-15m-${meeting.id}`,
            });
          }
        }

        // 5 Minutes Before Reminder (between 3 and 6 minutes)
        if (diffMinutes >= 3 && diffMinutes <= 6) {
          for (const empId of meeting.participantIds) {
            await this.dispatchNotification({
              employeeId: empId,
              type: 'MEETING_5M_REMINDER',
              category: 'MEETINGS',
              title: `📅 Meeting in 5 Mins: ${meeting.title}`,
              message: `Your meeting "${meeting.title}" starts in 5 minutes. Get ready!`,
              actionUrl: meeting.link || '/dashboard',
              tag: `meeting-5m-${meeting.id}`,
            });
          }
        }

        // Meeting Started Reminder (between -2 and 1 minute)
        if (diffMinutes >= -2 && diffMinutes <= 1) {
          for (const empId of meeting.participantIds) {
            await this.dispatchNotification({
              employeeId: empId,
              type: 'MEETING_STARTED',
              category: 'MEETINGS',
              title: `🔴 Meeting Starting Now: ${meeting.title}`,
              message: `The meeting "${meeting.title}" is starting now. Click to join.`,
              actionUrl: meeting.link || '/dashboard',
              tag: `meeting-started-${meeting.id}`,
            });
          }
        }
      }
    } catch (err: any) {
      console.error('[NotificationEngine:Meetings] Error evaluating meeting reminders:', err?.message || err);
    }
  }

  /**
   * Evaluates Tomorrow's Holiday (Runs once daily in the evening, e.g. 18:00 IST)
   */
  public async evaluateHolidayTomorrow() {
    try {
      const { hours, minutes, dateStr } = this.getISTDateComponents();
      // Run once around 18:00 - 18:05 IST
      if (hours !== 18 || minutes > 5) return;

      const dedupeTag = `holiday-tomorrow-check-${dateStr}`;
      if (this.sentKeysToday.has(dedupeTag)) return;
      this.sentKeysToday.add(dedupeTag);

      // Tomorrow's date in IST
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const holiday = await prisma.holiday.findFirst({
        where: {
          date: {
            gte: tomorrow,
            lt: new Date(tomorrow.getTime() + 24 * 3600 * 1000),
          },
        },
      });

      if (!holiday) return;

      console.log(`[NotificationEngine:Holiday] Tomorrow is a holiday: ${holiday.name}. Notifying all employees.`);

      const allEmployees = await prisma.employee.findMany({
        select: { employeeId: true },
      });

      for (const emp of allEmployees) {
        await this.dispatchNotification({
          employeeId: emp.employeeId,
          type: 'HOLIDAY_TOMORROW',
          category: 'HR_UPDATES',
          title: `🎉 Tomorrow is a Holiday: ${holiday.name}`,
          message: `OneBridge Infotech offices will be closed tomorrow for ${holiday.name}. Wishing you a wonderful time off!`,
          actionUrl: '/dashboard',
          tag: `holiday-tomorrow-${holiday.id}`,
        });
      }
    } catch (err: any) {
      console.error('[NotificationEngine:Holiday] Error evaluating tomorrow holiday:', err?.message || err);
    }
  }

  // =========================================================================
  // EVENT-DRIVEN DISPATCH METHODS
  // =========================================================================

  /**
   * Meeting Created Event
   */
  public async notifyMeetingCreated(meeting: {
    id: string;
    title: string;
    startTime: Date;
    participantIds: string[];
    link?: string | null;
  }) {
    for (const empId of meeting.participantIds) {
      const istTime = this.getISTDateComponents(meeting.startTime);
      const timeStr = `${String(istTime.hours).padStart(2, '0')}:${String(istTime.minutes).padStart(2, '0')}`;
      await this.dispatchNotification({
        employeeId: empId,
        type: 'MEETING_CREATED',
        category: 'MEETINGS',
        title: `📅 New Meeting: ${meeting.title}`,
        message: `You are invited to "${meeting.title}" on ${istTime.dateStr} at ${timeStr}.`,
        actionUrl: meeting.link || '/dashboard',
        tag: `meeting-created-${meeting.id}`,
      });
    }
  }

  /**
   * Meeting Updated Event
   */
  public async notifyMeetingUpdated(meeting: {
    id: string;
    title: string;
    startTime: Date;
    participantIds: string[];
    link?: string | null;
  }) {
    for (const empId of meeting.participantIds) {
      await this.dispatchNotification({
        employeeId: empId,
        type: 'MEETING_UPDATED',
        category: 'MEETINGS',
        title: `📝 Meeting Updated: ${meeting.title}`,
        message: `Details for meeting "${meeting.title}" have been updated.`,
        actionUrl: meeting.link || '/dashboard',
        tag: `meeting-updated-${meeting.id}-${Date.now()}`,
      });
    }
  }

  /**
   * Meeting Cancelled Event
   */
  public async notifyMeetingCancelled(meetingId: string, title: string, participantIds: string[]) {
    this.onMeetingCancelled(meetingId);
    for (const empId of participantIds) {
      await this.dispatchNotification({
        employeeId: empId,
        type: 'MEETING_CANCELLED',
        category: 'MEETINGS',
        title: `❌ Meeting Cancelled: ${title}`,
        message: `The meeting "${title}" has been cancelled.`,
        actionUrl: '/dashboard',
        tag: `meeting-cancelled-${meetingId}`,
      });
    }
  }

  /**
   * Chat Events Dispatcher
   */
  public async notifyChatEvent(params: {
    eventType: 'MESSAGE' | 'MENTION' | 'REPLY' | 'FILE' | 'MISSED_CALL' | 'HUDDLE';
    senderName: string;
    recipientIds: string[];
    snippet?: string;
    fileName?: string;
    huddleTitle?: string;
    channelName?: string;
    chatUrl?: string;
  }) {
    const {
      eventType,
      senderName,
      recipientIds,
      snippet,
      fileName,
      huddleTitle,
      channelName,
      chatUrl = '/dashboard',
    } = params;

    for (const recipientId of recipientIds) {
      switch (eventType) {
        case 'MESSAGE':
          await this.dispatchNotification({
            employeeId: recipientId,
            type: 'CHAT_MESSAGE',
            category: 'CHAT',
            title: channelName ? `💬 ${senderName} in #${channelName}` : `💬 New Message from ${senderName}`,
            message: snippet || 'Sent you a new message.',
            actionUrl: chatUrl,
            tag: `chat-msg-${Date.now()}`,
          });
          break;
        case 'MENTION':
          await this.dispatchNotification({
            employeeId: recipientId,
            type: 'CHAT_MENTION',
            category: 'CHAT',
            title: `🔔 ${senderName} mentioned you`,
            message: snippet || `${senderName} mentioned you in a conversation.`,
            actionUrl: chatUrl,
            tag: `chat-mention-${Date.now()}`,
          });
          break;
        case 'REPLY':
          await this.dispatchNotification({
            employeeId: recipientId,
            type: 'CHAT_REPLY',
            category: 'CHAT',
            title: `↩️ ${senderName} replied to your message`,
            message: snippet || 'Sent a reply to your message.',
            actionUrl: chatUrl,
            tag: `chat-reply-${Date.now()}`,
          });
          break;
        case 'FILE':
          await this.dispatchNotification({
            employeeId: recipientId,
            type: 'CHAT_FILE',
            category: 'FILES',
            title: `📁 New File from ${senderName}`,
            message: fileName ? `Shared a file: ${fileName}` : 'Shared a file with you.',
            actionUrl: chatUrl,
            tag: `chat-file-${Date.now()}`,
          });
          break;
        case 'MISSED_CALL':
          await this.dispatchNotification({
            employeeId: recipientId,
            type: 'CHAT_MISSED_CALL',
            category: 'CHAT',
            title: `📞 Missed Call from ${senderName}`,
            message: `You missed a call from ${senderName}.`,
            actionUrl: chatUrl,
            tag: `chat-call-${Date.now()}`,
          });
          break;
        case 'HUDDLE':
          await this.dispatchNotification({
            employeeId: recipientId,
            type: 'CHAT_HUDDLE_STARTED',
            category: 'CHAT',
            title: `🎧 Team Huddle Started`,
            message: `${senderName} started a team huddle: ${huddleTitle || 'Quick Sync'}. Click to join!`,
            actionUrl: chatUrl,
            tag: `chat-huddle-${Date.now()}`,
          });
          break;
      }
    }
  }

  /**
   * Leave Approved Event
   */
  public async notifyLeaveApproved(leave: {
    id: string;
    employeeId: string;
    leaveType: string;
    startDate: Date;
    endDate: Date;
  }) {
    await this.dispatchNotification({
      employeeId: leave.employeeId,
      type: 'LEAVE_APPROVED',
      category: 'HR_UPDATES',
      title: `✅ Leave Request Approved`,
      message: `Your ${leave.leaveType} leave request from ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()} has been approved.`,
      actionUrl: '/leaves',
      tag: `leave-approved-${leave.id}`,
    });
  }

  /**
   * Leave Rejected Event
   */
  public async notifyLeaveRejected(leave: {
    id: string;
    employeeId: string;
    leaveType: string;
    startDate: Date;
    endDate: Date;
    comment?: string | null;
  }) {
    const reasonText = leave.comment ? ` Reason: ${leave.comment}` : '';
    await this.dispatchNotification({
      employeeId: leave.employeeId,
      type: 'LEAVE_REJECTED',
      category: 'HR_UPDATES',
      title: `❌ Leave Request Rejected`,
      message: `Your ${leave.leaveType} leave request from ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()} was not approved.${reasonText}`,
      actionUrl: '/leaves',
      tag: `leave-rejected-${leave.id}`,
    });
  }

  /**
   * Payroll Processed Event
   */
  public async notifyPayrollProcessed(payroll: {
    id: string;
    employeeId: string;
    month: number;
    financialYear: string;
    payslipNumber: string;
  }) {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[payroll.month - 1] || `Month ${payroll.month}`;
    await this.dispatchNotification({
      employeeId: payroll.employeeId,
      type: 'PAYROLL_PROCESSED',
      category: 'HR_UPDATES',
      title: `💳 Payslip Available: ${monthName} ${payroll.financialYear}`,
      message: `Your salary payslip (${payroll.payslipNumber}) for ${monthName} ${payroll.financialYear} is ready for download.`,
      actionUrl: '/payroll',
      tag: `payroll-${payroll.id}`,
    });
  }

  /**
   * Document Shared Event
   */
  public async notifyDocumentShared(document: {
    id: string;
    employeeId: string;
    name: string;
    category: string;
    fileUrl?: string;
  }) {
    await this.dispatchNotification({
      employeeId: document.employeeId,
      type: 'DOCUMENT_SHARED',
      category: 'FILES',
      title: `📄 Document Shared: ${document.name}`,
      message: `A new document (${document.category}) has been uploaded to your employee records.`,
      actionUrl: '/profile',
      tag: `document-shared-${document.id}`,
    });
  }

  /**
   * Company Announcement Event
   */
  public async notifyCompanyAnnouncement(announcement: {
    id: string;
    title: string;
    content: string;
    priority?: string;
    targetRoles?: string[];
    department?: string | null;
  }) {
    const whereClause: any = {};
    if (announcement.department) {
      whereClause.department = announcement.department;
    }

    const employees = await prisma.employee.findMany({
      where: whereClause,
      select: { employeeId: true },
    });

    const priorityBadge = announcement.priority === 'URGENT' ? '🚨 URGENT: ' : '📢 ';

    for (const emp of employees) {
      await this.dispatchNotification({
        employeeId: emp.employeeId,
        type: 'COMPANY_ANNOUNCEMENT',
        category: 'ANNOUNCEMENTS',
        title: `${priorityBadge}${announcement.title}`,
        message: announcement.content.substring(0, 150) + (announcement.content.length > 150 ? '...' : ''),
        actionUrl: '/dashboard',
        tag: `announcement-${announcement.id}`,
      });
    }
  }

  // =========================================================================
  // SCHEDULER LIFECYCLE
  // =========================================================================

  public startScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }

    console.log('🚀 [NotificationEngine] Background Notification Engine activated (Evaluation cycle: 60s)');

    // Immediate run on startup
    this.evaluateAttendanceReminders().catch(() => {});
    this.evaluateMeetingReminders().catch(() => {});
    this.evaluateHolidayTomorrow().catch(() => {});

    // Periodic evaluation every 60 seconds
    this.schedulerInterval = setInterval(() => {
      this.evaluateAttendanceReminders().catch(() => {});
      this.evaluateMeetingReminders().catch(() => {});
      this.evaluateHolidayTomorrow().catch(() => {});
    }, 60000);
  }

  public stopScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }
}

export const notificationEngine = new NotificationEngine();
