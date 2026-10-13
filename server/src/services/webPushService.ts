import webpush from 'web-push';
import { prisma } from '../config/db';

const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  'BGg-yUnjTfp7wF09oSzBuOhUnYxXY0N7vBjHOb-vxVWI5Vt6BjK6-RKAU8NxkHPL0CDGEcH6UP5eHV_m--YAt4w';
const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || '2edR9JOQfA7lGhpppdoM10x6BCqVYJbQ95EkfLu7JIw';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:vinay@onebridgeinfotech.com';

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('[WebPush] VAPID details configured successfully');
} catch (err: any) {
  console.warn('[WebPush] Failed to initialize VAPID details:', err?.message || err);
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  type?: 'TASK_ASSIGNED' | 'CHECKOUT_REMINDER' | 'GENERAL';
  actions?: Array<{ action: string; title: string }>;
}

export class WebPushService {
  public static getPublicKey(): string {
    return VAPID_PUBLIC_KEY;
  }

  /**
   * Save or update an employee's PWA push subscription in MongoDB
   */
  public static async saveSubscription(
    employeeId: string,
    subscription: {
      endpoint: string;
      keys: {
        p256dh: string;
        auth: string;
      };
    },
    userAgent?: string
  ) {
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      throw new Error('Invalid push subscription payload');
    }

    return await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        employeeId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent || 'PWA Client',
      },
      update: {
        employeeId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent || 'PWA Client',
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Remove an employee's PWA push subscription
   */
  public static async removeSubscription(endpoint: string) {
    try {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint },
      });
    } catch (err) {
      console.warn('[WebPush] Could not delete subscription:', err);
    }
  }

  /**
   * Send a targeted Web Push notification to an employee across all their subscribed PWA devices
   */
  public static async sendPushToEmployee(
    employeeId: string,
    payload: PushNotificationPayload
  ): Promise<{ sent: number; failed: number }> {
    try {
      const subscriptions = await prisma.pushSubscription.findMany({
        where: { employeeId },
      });

      if (!subscriptions || subscriptions.length === 0) {
        return { sent: 0, failed: 0 };
      }

      const formattedPayload = JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/icons/icon-192x192.png',
        badge: payload.badge || '/icons/icon-96x96.png',
        url: payload.url || '/',
        tag: payload.tag || `onebridge-${Date.now()}`,
        type: payload.type || 'GENERAL',
        actions: payload.actions || [
          { action: 'open', title: 'Open HRMS' },
          { action: 'close', title: 'Dismiss' },
        ],
      });

      let sent = 0;
      let failed = 0;

      for (const sub of subscriptions) {
        const pushSub = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSub, formattedPayload, {
            TTL: 60 * 60 * 24, // 24 hours TTL
            urgency: 'high',
          });
          sent++;
        } catch (pushErr: any) {
          failed++;
          // If subscription has expired or is invalid (HTTP 410 or 404), clean it up
          if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
            console.log(`[WebPush] Subscription expired (${pushErr.statusCode}). Cleaning up: ${sub.id}`);
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          } else {
            console.warn(`[WebPush] Failed sending push to ${employeeId}:`, pushErr.message);
          }
        }
      }

      return { sent, failed };
    } catch (error: any) {
      console.error(`[WebPush] Unexpected error sending push to ${employeeId}:`, error?.message || error);
      return { sent: 0, failed: 0 };
    }
  }
}
