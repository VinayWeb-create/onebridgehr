import { ChannelName, ChannelPreferences, NotificationChannel, ReminderMessage, enabledChannelNames } from '../channels/types';
import { OPEN_STATUSES, RETRY_BACKOFF_MINUTES, STALE_REMINDER_GRACE_MINUTES } from '../domain/constants';
import { DeliveryPolicy, nextRetryAt, resolveDeliveryTime } from '../domain/reminders';
import { getZonedParts, safeTimezone } from '../domain/timezone';

/**
 * Reminder delivery engine.
 *
 * Guarantees:
 *  - **No duplicates**: each row is claimed atomically (SCHEDULED/FAILED -> SENDING)
 *    before delivery, so concurrent ticks or multiple server instances can't both
 *    send it. Channels that already succeeded are remembered and never re-sent on retry.
 *  - **Retries**: transient channel failures move the row to FAILED with a backoff
 *    `nextRetryAt`, up to `maxAttempts`.
 *  - **Respectful timing**: DND / quiet hours / weekends / holidays are evaluated at
 *    delivery time (so preference changes apply to already-scheduled reminders).
 *  - **No spam after downtime**: reminders older than the stale grace are SKIPPED.
 *
 * Storage is injected (`DispatcherStore`) so the engine is unit-testable.
 */

export interface ReminderRow {
  id: string;
  taskId: string | null;
  employeeId: string;
  kind: string;
  fireAt: Date;
  deliverAt: Date;
  status: string;
  attempts: number;
  channels: string[];
  title?: string | null;
  message?: string | null;
  mandatory?: boolean;
}

export interface TaskSnapshot {
  id: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  dueAt: Date | null;
  location?: string | null;
}

export interface RecipientContext {
  policy: DeliveryPolicy;
  channels: ChannelPreferences;
  mandatoryCategories: string[];
  maxAttempts: number;
}

export interface DispatcherStore {
  findDue(now: Date, limit: number): Promise<ReminderRow[]>;
  /** Atomically move a row from `fromStatus` to SENDING (incrementing attempts). Returns false if another worker won. */
  claim(id: string, fromStatus: string, now: Date): Promise<boolean>;
  reschedule(id: string, deliverAt: Date): Promise<void>;
  markSent(id: string, channels: string[], now: Date): Promise<void>;
  markFailed(id: string, channels: string[], error: string, retryAt: Date | null): Promise<void>;
  markFinal(id: string, status: 'SKIPPED' | 'CANCELLED', reason: string): Promise<void>;
  /** Rows stuck in SENDING (crashed worker) are returned to FAILED for retry. */
  releaseStuck(olderThan: Date): Promise<number>;
  getTask(id: string): Promise<TaskSnapshot | null>;
  getRecipientContext(employeeId: string): Promise<RecipientContext>;
  countUnread(employeeId: string): Promise<number>;
}

export interface DispatcherOptions {
  store: DispatcherStore;
  channels: Map<ChannelName, NotificationChannel>;
  signToken?: (claims: { reminderId: string; taskId: string | null; employeeId: string }) => string;
  batchSize?: number;
  logger?: Pick<Console, 'warn' | 'error' | 'log'>;
}

export interface TickResult {
  processed: number;
  sent: number;
  failed: number;
  deferred: number;
  skipped: number;
  cancelled: number;
}

export function formatDueText(dueAt: Date | null, now: Date, tz: string): string {
  if (!dueAt) return 'Reminder';
  const zone = safeTimezone(tz);
  const time = new Intl.DateTimeFormat('en-IN', { timeZone: zone, hour: 'numeric', minute: '2-digit' }).format(dueAt);
  const diffMin = Math.round((dueAt.getTime() - now.getTime()) / 60_000);
  const d = getZonedParts(dueAt, zone);
  const n = getZonedParts(now, zone);
  const sameDay = d.year === n.year && d.month === n.month && d.day === n.day;
  if (diffMin < -1) return `Overdue · was due ${sameDay ? `at ${time}` : new Intl.DateTimeFormat('en-IN', { timeZone: zone, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(dueAt)}`;
  if (diffMin <= 1) return `Due now · ${time}`;
  if (diffMin < 60) return `Due in ${diffMin} min · ${time}`;
  if (sameDay) return `Due today at ${time}`;
  const date = new Intl.DateTimeFormat('en-IN', { timeZone: zone, weekday: 'short', day: 'numeric', month: 'short' }).format(dueAt);
  return `Due ${date} at ${time}`;
}

export class ReminderDispatcher {
  private readonly store: DispatcherStore;
  private readonly channels: Map<ChannelName, NotificationChannel>;
  private readonly batchSize: number;
  private readonly logger: Pick<Console, 'warn' | 'error' | 'log'>;
  private readonly signToken?: DispatcherOptions['signToken'];

  constructor(opts: DispatcherOptions) {
    this.store = opts.store;
    this.channels = opts.channels;
    this.batchSize = opts.batchSize ?? 200;
    this.logger = opts.logger ?? console;
    this.signToken = opts.signToken;
  }

  async tick(now: Date = new Date()): Promise<TickResult> {
    const result: TickResult = { processed: 0, sent: 0, failed: 0, deferred: 0, skipped: 0, cancelled: 0 };
    await this.store.releaseStuck(new Date(now.getTime() - 5 * 60_000)).catch(() => 0);
    const due = await this.store.findDue(now, this.batchSize);

    for (const row of due) {
      const claimed = await this.store.claim(row.id, row.status, now).catch(() => false);
      if (!claimed) continue;
      result.processed++;
      try {
        const outcome = await this.process(row, now);
        result[outcome]++;
      } catch (err: any) {
        result.failed++;
        this.logger.error('[Planner:Dispatcher] Unexpected error for reminder', row.id, err?.message || err);
        await this.store
          .markFailed(row.id, row.channels, err?.message || 'Unexpected error', nextRetryAt(row.attempts + 1, now, 5, RETRY_BACKOFF_MINUTES))
          .catch(() => undefined);
      }
    }
    return result;
  }

  private async process(row: ReminderRow, now: Date): Promise<keyof Omit<TickResult, 'processed'>> {
    let task: TaskSnapshot | null = null;
    if (row.taskId) {
      task = await this.store.getTask(row.taskId);
      if (!task || !OPEN_STATUSES.includes(task.status as any)) {
        await this.store.markFinal(row.id, 'CANCELLED', task ? `Task is ${task.status}` : 'Task deleted');
        return 'cancelled';
      }
    }

    if (now.getTime() - row.deliverAt.getTime() > STALE_REMINDER_GRACE_MINUTES * 60_000 && row.attempts === 0) {
      await this.store.markFinal(row.id, 'SKIPPED', 'Stale reminder (server was unavailable)');
      return 'skipped';
    }

    const ctx = await this.store.getRecipientContext(row.employeeId);
    const mandatory = !!row.mandatory || (!!task && ctx.mandatoryCategories.includes(task.category));
    const decision = resolveDeliveryTime(row.fireAt, ctx.policy, { mandatory, priority: task?.priority });
    if (decision.deliverAt.getTime() > now.getTime() + 30_000) {
      await this.store.reschedule(row.id, decision.deliverAt);
      return 'deferred';
    }

    const channelNames = enabledChannelNames(ctx.channels, mandatory).filter((n) => !(decision.silent && n === 'PUSH'));
    const delivered = new Set(row.channels);
    const pending = channelNames.filter((n) => !delivered.has(n) && this.channels.get(n)?.isConfigured());

    if (pending.length === 0 && delivered.size === 0) {
      await this.store.markFinal(row.id, 'SKIPPED', 'All channels disabled by preferences');
      return 'skipped';
    }

    const message: ReminderMessage = {
      reminderId: row.id,
      employeeId: row.employeeId,
      taskId: row.taskId,
      title: row.title || task?.title || 'Reminder',
      body: row.message || formatDueText(task?.dueAt ?? null, now, ctx.policy.timezone) + (task?.location ? ` · ${task.location}` : ''),
      priority: task?.priority || (mandatory ? 'HIGH' : 'MEDIUM'),
      dueAt: task?.dueAt ?? null,
      kind: row.kind,
      url: row.taskId ? `/planner?task=${row.taskId}` : '/planner',
      silent: decision.silent,
      actionToken: this.signToken?.({ reminderId: row.id, taskId: row.taskId, employeeId: row.employeeId }),
    };
    if (pending.includes('PUSH')) {
      message.badgeCount = (await this.store.countUnread(row.employeeId).catch(() => 0)) + (pending.includes('IN_APP') ? 1 : 0);
    }

    let transientError: string | null = null;
    // IN_APP first so the Notification Center record exists before the push arrives.
    const ordered = [...pending].sort((a, b) => (a === 'IN_APP' ? 0 : 1) - (b === 'IN_APP' ? 0 : 1));
    for (const name of ordered) {
      const channel = this.channels.get(name)!;
      const res = await channel.send(message).catch((e: any) => ({ ok: false, error: e?.message || String(e) } as const));
      if (res.ok || (res as any).permanent) {
        delivered.add(name);
        if (!res.ok) this.logger.warn(`[Planner:Dispatcher] ${name} permanently failed for ${row.id}: ${res.error}`);
      } else {
        transientError = `${name}: ${res.error || 'failed'}`;
      }
    }

    if (!transientError) {
      await this.store.markSent(row.id, Array.from(delivered), now);
      return 'sent';
    }
    const retryAt = nextRetryAt(row.attempts + 1, now, ctx.maxAttempts, RETRY_BACKOFF_MINUTES);
    await this.store.markFailed(row.id, Array.from(delivered), transientError, retryAt);
    return 'failed';
  }
}
