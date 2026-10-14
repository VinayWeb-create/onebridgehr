import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { WebPushService } from '../services/webPushService';
import { triggerShiftCheckOutReminders, triggerShiftCheckInReminders } from '../services/shiftReminderScheduler';
import { notificationEngine } from '../services/notificationEngine';
import { AppError } from '../middleware/errorHandler';

// =========================================================================
// NOTIFICATION CENTER: FEED, COUNTS, READ/DELETE
// =========================================================================

/**
 * Get paginated & categorized notifications for logged in employee
 */
export const getNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const category = req.query.category as string | undefined;
    const unreadOnly = req.query.unreadOnly === 'true';
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '30', 10)));
    const skip = (page - 1) * limit;

    const where: any = { employeeId };

    if (category && category !== 'ALL') {
      where.category = category;
    }

    if (unreadOnly) {
      where.isRead = false;
    }

    const [items, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { employeeId, isRead: false },
      }),
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        notifications: items,
        total,
        unreadCount,
        page,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get quick unread count for badge indicators
 */
export const getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const unreadCount = await prisma.notification.count({
      where: { employeeId, isRead: false },
    });

    res.status(200).json({
      status: 'success',
      data: { unreadCount },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a single notification as read
 */
export const markAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    const { id } = req.params;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const updated = await prisma.notification.updateMany({
      where: { id, employeeId },
      data: {
        isRead: true,
        status: 'READ',
        readAt: new Date(),
      },
    });

    if (updated.count === 0) {
      return next(new AppError('Notification not found', 404));
    }

    res.status(200).json({
      status: 'success',
      message: 'Notification marked as read',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read for current employee
 */
export const markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const result = await prisma.notification.updateMany({
      where: { employeeId, isRead: false },
      data: {
        isRead: true,
        status: 'READ',
        readAt: new Date(),
      },
    });

    res.status(200).json({
      status: 'success',
      message: `Marked ${result.count} notifications as read`,
      data: { count: result.count },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a single notification from history
 */
export const deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    const { id } = req.params;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    await prisma.notification.deleteMany({
      where: { id, employeeId },
    });

    res.status(200).json({
      status: 'success',
      message: 'Notification deleted',
    });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// USER SETTINGS: NOTIFICATION PREFERENCES
// =========================================================================

export const getUserNotificationPreferences = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const prefs = await notificationEngine.getUserPreferences(employeeId);
    res.status(200).json({
      status: 'success',
      data: prefs,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserNotificationPreferences = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const updated = await notificationEngine.updateUserPreferences(employeeId, req.body);
    res.status(200).json({
      status: 'success',
      message: 'Notification preferences updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// ADMIN SETTINGS: CONFIGURATION & TEMPLATES
// =========================================================================

export const getAdminNotificationConfig = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await notificationEngine.getAdminConfig();
    res.status(200).json({
      status: 'success',
      data: config,
    });
  } catch (error) {
    next(error);
  }
};

export const updateAdminNotificationConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await notificationEngine.updateAdminConfig(req.body, req.user?.employeeId);
    res.status(200).json({
      status: 'success',
      message: 'Admin notification configuration updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// MEETINGS MODULE & NOTIFICATIONS
// =========================================================================

export const createMeeting = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizerId = req.user?.employeeId;
    if (!organizerId) return next(new AppError('Unauthorized', 401));

    const { title, description, startTime, endTime, participantIds = [], link } = req.body;
    if (!title || !startTime || !endTime) {
      return next(new AppError('Title, startTime, and endTime are required', 400));
    }

    // Ensure organizer is in participants
    const finalParticipants = Array.from(new Set([organizerId, ...participantIds]));

    const meeting = await prisma.meeting.create({
      data: {
        title,
        description,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        organizerId,
        participantIds: finalParticipants,
        link,
        status: 'SCHEDULED',
      },
    });

    // Notify participants
    await notificationEngine.notifyMeetingCreated({
      id: meeting.id,
      title: meeting.title,
      startTime: meeting.startTime,
      participantIds: finalParticipants.filter((id) => id !== organizerId),
      link: meeting.link,
    });

    res.status(201).json({
      status: 'success',
      message: 'Meeting scheduled successfully',
      data: meeting,
    });
  } catch (error) {
    next(error);
  }
};

export const getMeetings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const meetings = await prisma.meeting.findMany({
      where: {
        participantIds: { has: employeeId },
      },
      orderBy: { startTime: 'asc' },
      take: 50,
    });

    res.status(200).json({
      status: 'success',
      data: meetings,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMeeting = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) return next(new AppError('Meeting not found', 404));

    const updated = await prisma.meeting.update({
      where: { id },
      data: {
        title: req.body.title ?? meeting.title,
        description: req.body.description ?? meeting.description,
        startTime: req.body.startTime ? new Date(req.body.startTime) : meeting.startTime,
        endTime: req.body.endTime ? new Date(req.body.endTime) : meeting.endTime,
        participantIds: req.body.participantIds ?? meeting.participantIds,
        link: req.body.link ?? meeting.link,
      },
    });

    await notificationEngine.notifyMeetingUpdated({
      id: updated.id,
      title: updated.title,
      startTime: updated.startTime,
      participantIds: updated.participantIds,
      link: updated.link,
    });

    res.status(200).json({
      status: 'success',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const cancelMeeting = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) return next(new AppError('Meeting not found', 404));

    const updated = await prisma.meeting.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    await notificationEngine.notifyMeetingCancelled(
      meeting.id,
      meeting.title,
      meeting.participantIds
    );

    res.status(200).json({
      status: 'success',
      message: 'Meeting cancelled and reminders cleared',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// COMPANY ANNOUNCEMENTS & HR NOTIFICATIONS
// =========================================================================

export const createAnnouncement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const createdBy = req.user?.employeeId;
    if (!createdBy) return next(new AppError('Unauthorized', 401));

    const { title, content, priority = 'MEDIUM', targetRoles = [], department = null } = req.body;
    if (!title || !content) {
      return next(new AppError('Title and content are required', 400));
    }

    const announcement = await prisma.companyAnnouncement.create({
      data: {
        title,
        content,
        priority,
        createdBy,
        targetRoles,
        department,
      },
    });

    await notificationEngine.notifyCompanyAnnouncement(announcement);

    res.status(201).json({
      status: 'success',
      message: 'Announcement published successfully',
      data: announcement,
    });
  } catch (error) {
    next(error);
  }
};

export const getAnnouncements = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const announcements = await prisma.companyAnnouncement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.status(200).json({
      status: 'success',
      data: announcements,
    });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// CHAT NOTIFICATIONS EVENT TRIGGER
// =========================================================================

export const triggerChatEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const senderId = req.user?.employeeId || 'SYSTEM';
    const employee = await prisma.employee.findUnique({
      where: { employeeId: senderId },
      select: { firstName: true, lastName: true },
    });
    const senderName = employee ? `${employee.firstName} ${employee.lastName}` : 'Colleague';

    const {
      eventType, // MESSAGE, MENTION, REPLY, FILE, MISSED_CALL, HUDDLE
      recipientIds = [],
      snippet,
      fileName,
      huddleTitle,
      channelName,
      chatUrl,
    } = req.body;

    if (!eventType || !recipientIds.length) {
      return next(new AppError('eventType and recipientIds are required', 400));
    }

    await notificationEngine.notifyChatEvent({
      eventType,
      senderName,
      recipientIds,
      snippet,
      fileName,
      huddleTitle,
      channelName,
      chatUrl,
    });

    res.status(200).json({
      status: 'success',
      message: 'Chat event notifications dispatched successfully',
    });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// EXISTING PUSH NOTIFICATION & MANUAL TEST ENDPOINTS (PRESERVED)
// =========================================================================

export const getVapidPublicKey = async (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    data: {
      publicKey: WebPushService.getPublicKey(),
    },
  });
};

export const subscribePush = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return next(new AppError('Invalid subscription object', 400));
    }

    const userAgent = req.headers['user-agent'] || 'PWA Browser';
    const saved = await WebPushService.saveSubscription(employeeId, subscription, userAgent);

    res.status(200).json({
      status: 'success',
      message: 'Push notification subscription registered successfully',
      data: saved,
    });
  } catch (error) {
    next(error);
  }
};

export const unsubscribePush = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      await WebPushService.removeSubscription(endpoint);
    }
    res.status(200).json({
      status: 'success',
      message: 'Push notification subscription removed',
    });
  } catch (error) {
    next(error);
  }
};

export const testPushNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const employee = await prisma.employee.findUnique({
      where: { employeeId },
      select: { firstName: true },
    });
    const name = employee?.firstName || 'Champion';

    const result = await WebPushService.sendPushToEmployee(employeeId, {
      title: `Hi, ${name}! Welcome to Onebridge HRMS`,
      body: `Welcome to your employee portal. Have a productive and great day ahead! 👋`,
      url: '/dashboard',
      actions: [
        { action: 'open', title: 'Open HRMS' },
        { action: 'close', title: 'Dismiss' },
      ],
    });

    res.status(200).json({
      status: 'success',
      message: `Welcome notification sent successfully!`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const triggerCheckoutRemindersManual = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const slot = req.body.slot || '18:20';
    await triggerShiftCheckOutReminders(slot);

    res.status(200).json({
      status: 'success',
      message: `Shift check-out reminders triggered for slot ${slot}`,
    });
  } catch (error) {
    next(error);
  }
};

export const triggerCheckInRemindersManual = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const slot = req.body.slot || '09:20';
    await triggerShiftCheckInReminders(slot);

    res.status(200).json({
      status: 'success',
      message: `Shift check-in reminders triggered for slot ${slot}`,
    });
  } catch (error) {
    next(error);
  }
};

export const triggerGreetingManual = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slot = (req.body.slot || 'MORNING').toUpperCase() as 'MORNING' | 'AFTERNOON' | 'EVENING';
    const { dispatchEnergeticGreeting } = await import('../services/energeticGreetingService');
    const result = await dispatchEnergeticGreeting(slot);

    res.status(200).json({
      status: 'success',
      message: `Energetic ${slot} greeting dispatched!`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
