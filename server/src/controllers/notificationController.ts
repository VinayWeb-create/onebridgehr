import { Request, Response, NextFunction } from 'express';
import { WebPushService } from '../services/webPushService';
import { triggerShiftCheckOutReminders } from '../services/shiftReminderScheduler';
import { AppError } from '../middleware/errorHandler';

export const getVapidPublicKey = async (req: Request, res: Response) => {
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

    const result = await WebPushService.sendPushToEmployee(employeeId, {
      title: '✅ OneBridge PWA Notification Active',
      body: 'PWA native background push notifications are configured and active!',
      url: '/attendance',
      actions: [
        { action: 'open', title: 'Open HRMS' },
        { action: 'close', title: 'Dismiss' },
      ],
    });

    res.status(200).json({
      status: 'success',
      message: 'Test notification triggered',
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
