import { prisma } from '../../../config/db';
import { socketService } from '../../../services/socketService';
import { WebPushService } from '../../../services/webPushService';
import { ChannelName, ChannelResult, NotificationChannel, ReminderMessage } from './types';

export * from './types';

const PRIORITY_EMOJI: Record<string, string> = { CRITICAL: '🚨', HIGH: '🔴', MEDIUM: '🟠', LOW: '🟢' };

/** Stores the reminder in the existing Notification Center and pushes it over the socket. */
export class InAppChannel implements NotificationChannel {
  readonly name = 'IN_APP' as const;
  isConfigured() {
    return true;
  }
  async send(m: ReminderMessage): Promise<ChannelResult> {
    try {
      const record = await prisma.notification.create({
        data: {
          employeeId: m.employeeId,
          title: m.title,
          message: m.body,
          type: m.kind === 'COMPANY' ? 'PLANNER_COMPANY_REMINDER' : 'TASK_REMINDER',
          category: 'TASKS',
          status: 'DELIVERED',
          actionUrl: m.url,
          deliveredAt: new Date(),
          isRead: false,
        },
      });
      socketService.sendNotification(m.employeeId, 'planner:reminder', {
        notificationId: record.id,
        reminderId: m.reminderId,
        taskId: m.taskId,
        title: m.title,
        body: m.body,
        priority: m.priority,
        dueAt: m.dueAt,
        kind: m.kind,
        url: m.url,
        silent: m.silent,
      });
      return { ok: true };
    } catch (err: any) {
      // Foreign-key failures (unknown employee) will never succeed.
      const permanent = err?.code === 'P2003' || err?.code === 'P2014';
      return { ok: false, permanent, error: err?.message || String(err) };
    }
  }
}

/** Native Web Push (desktop tray, Android lock screen) through the existing VAPID service. */
export class PushChannel implements NotificationChannel {
  readonly name = 'PUSH' as const;
  isConfigured() {
    return true;
  }
  async send(m: ReminderMessage): Promise<ChannelResult> {
    const subs = await prisma.pushSubscription.count({ where: { employeeId: m.employeeId } });
    if (subs === 0) return { ok: true }; // nothing to deliver to — not a failure
    const isTask = !!m.taskId;
    const result = await WebPushService.sendPushToEmployee(m.employeeId, {
      title: `${PRIORITY_EMOJI[m.priority] || '🔔'} ${m.title}`,
      body: m.body,
      url: m.url,
      tag: `planner-${m.reminderId}`,
      type: isTask ? 'PLANNER_TASK_REMINDER' : 'PLANNER_COMPANY_REMINDER',
      requireInteraction: m.priority === 'HIGH' || m.priority === 'CRITICAL',
      actions: isTask
        ? [
            { action: 'planner-complete', title: '✓ Complete' },
            { action: 'planner-snooze', title: '⏰ Snooze 10m' },
          ]
        : [
            { action: 'open', title: 'Open' },
            { action: 'close', title: 'Dismiss' },
          ],
      silent: m.silent,
      badgeCount: m.badgeCount,
      data: {
        planner: true,
        reminderId: m.reminderId,
        taskId: m.taskId,
        actionToken: m.actionToken,
        priority: m.priority,
        dueAt: m.dueAt ? m.dueAt.toISOString() : null,
      },
    });
    if (result.sent === 0 && result.failed > 0) {
      return { ok: false, error: `Push failed for ${result.failed} device(s)` };
    }
    return { ok: true };
  }
}

/**
 * Placeholder for channels planned for later (email, WhatsApp, SMS, Teams).
 * They report `isConfigured() === false`, so the dispatcher skips them without
 * failing the reminder. Replace with a real provider implementation when ready.
 */
export class FutureChannel implements NotificationChannel {
  constructor(public readonly name: ChannelName) {}
  isConfigured() {
    return false;
  }
  async send(): Promise<ChannelResult> {
    return { ok: false, permanent: true, error: `${this.name} channel is not configured` };
  }
}

export function createDefaultChannels(): Map<ChannelName, NotificationChannel> {
  const list: NotificationChannel[] = [
    new InAppChannel(),
    new PushChannel(),
    new FutureChannel('EMAIL'),
    new FutureChannel('WHATSAPP'),
    new FutureChannel('SMS'),
    new FutureChannel('TEAMS'),
  ];
  return new Map(list.map((c) => [c.name, c]));
}
