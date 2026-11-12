import { prisma } from '../../../config/db';
import { DispatcherStore, RecipientContext, ReminderRow, TaskSnapshot } from './dispatcher';
import { buildDeliveryPolicy, getAdminConfig, getHolidayDates, getPreferences } from '../services/settingsService';

/** Prisma/MongoDB implementation of the dispatcher storage port. */
export const prismaDispatcherStore: DispatcherStore = {
  async findDue(now, limit) {
    const rows = await prisma.plannerTaskNotification.findMany({
      where: {
        OR: [
          { status: 'SCHEDULED', deliverAt: { lte: now } },
          { status: 'FAILED', nextRetryAt: { lte: now } },
        ],
      },
      orderBy: { deliverAt: 'asc' },
      take: limit,
    });
    return rows as ReminderRow[];
  },

  async claim(id, fromStatus, now) {
    const res = await prisma.plannerTaskNotification.updateMany({
      where: { id, status: fromStatus },
      data: { status: 'SENDING', attempts: { increment: 1 }, updatedAt: now },
    });
    return res.count === 1;
  },

  async reschedule(id, deliverAt) {
    await prisma.plannerTaskNotification.update({
      where: { id },
      data: { status: 'SCHEDULED', deliverAt, attempts: { decrement: 1 } },
    });
  },

  async markSent(id, channels, now) {
    await prisma.plannerTaskNotification.update({
      where: { id },
      data: { status: 'SENT', channels, sentAt: now, lastError: null, nextRetryAt: null },
    });
  },

  async markFailed(id, channels, error, retryAt) {
    await prisma.plannerTaskNotification.update({
      where: { id },
      data: { status: 'FAILED', channels, lastError: error.slice(0, 500), nextRetryAt: retryAt },
    });
  },

  async markFinal(id, status, reason) {
    await prisma.plannerTaskNotification.update({ where: { id }, data: { status, lastError: reason } });
  },

  async releaseStuck(olderThan) {
    const res = await prisma.plannerTaskNotification.updateMany({
      where: { status: 'SENDING', updatedAt: { lt: olderThan } },
      data: { status: 'FAILED', nextRetryAt: new Date(), lastError: 'Recovered from interrupted delivery' },
    });
    return res.count;
  },

  async getTask(id): Promise<TaskSnapshot | null> {
    return prisma.plannerTask.findUnique({
      where: { id },
      select: { id: true, title: true, status: true, priority: true, category: true, dueAt: true, location: true },
    });
  },

  async getRecipientContext(employeeId): Promise<RecipientContext> {
    const [prefs, admin, holidays] = await Promise.all([getPreferences(employeeId), getAdminConfig(), getHolidayDates()]);
    return {
      policy: buildDeliveryPolicy(prefs, admin, holidays),
      channels: prefs,
      mandatoryCategories: admin.mandatoryCategories,
      maxAttempts: admin.maxDeliveryAttempts,
    };
  },

  async countUnread(employeeId) {
    return prisma.notification.count({ where: { employeeId, isRead: false } });
  },
};
