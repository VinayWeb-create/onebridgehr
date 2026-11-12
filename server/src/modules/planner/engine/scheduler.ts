import { createDefaultChannels } from '../channels';
import { signActionToken } from '../services/actionTokens';
import { enqueueCompanyReminders, syncMeetingReminders } from '../services/integrationService';
import { generateDueOccurrences } from '../services/recurrenceService';
import { ReminderDispatcher } from './dispatcher';
import { prismaDispatcherStore } from './prismaStore';

/**
 * Background reminder scheduler for Smart Tasks.
 *
 * Every tick (default 30 s):
 *   1. materialise recurring task instances inside the lookahead window
 *   2. enqueue admin-configured company reminders (check-in, timesheet, ...)
 *   3. reconcile meeting reminder tasks (every 5th tick)
 *   4. deliver every due / retryable reminder through the dispatcher
 *
 * Ticks never overlap, every step is isolated so one failure doesn't block the
 * others, and all writes are idempotent so several instances can run safely.
 * Set PLANNER_SCHEDULER_DISABLED=true to turn it off (e.g. on a worker-less replica).
 */
class PlannerScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private tickCount = 0;
  readonly dispatcher = new ReminderDispatcher({
    store: prismaDispatcherStore,
    channels: createDefaultChannels(),
    signToken: signActionToken,
  });
  lastRun: { at: Date; result: Record<string, unknown> } | null = null;

  start(intervalMs = Number(process.env.PLANNER_SCHEDULER_INTERVAL_MS) || 30_000) {
    if (process.env.PLANNER_SCHEDULER_DISABLED === 'true') {
      console.log('[Planner] Scheduler disabled by PLANNER_SCHEDULER_DISABLED');
      return;
    }
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => void this.tick(), intervalMs);
    // First run shortly after boot so the DB connection is warm.
    setTimeout(() => void this.tick(), 5_000);
    console.log(`[Planner] Smart Tasks reminder scheduler started (every ${Math.round(intervalMs / 1000)}s)`);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(now = new Date()) {
    if (this.running) return this.lastRun;
    this.running = true;
    const result: Record<string, unknown> = {};
    const step = async (name: string, fn: () => Promise<unknown>) => {
      try {
        result[name] = await fn();
      } catch (err: any) {
        result[name] = { error: err?.message || String(err) };
        console.error(`[Planner] Scheduler step "${name}" failed:`, err?.message || err);
      }
    };
    try {
      await step('recurrence', () => generateDueOccurrences(now));
      await step('company', () => enqueueCompanyReminders(now));
      if (this.tickCount % 5 === 0) await step('meetings', () => syncMeetingReminders(now));
      await step('delivery', () => this.dispatcher.tick(now));
      this.tickCount++;
      this.lastRun = { at: now, result };
      return this.lastRun;
    } finally {
      this.running = false;
    }
  }
}

export const plannerScheduler = new PlannerScheduler();
