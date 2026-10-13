import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
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
