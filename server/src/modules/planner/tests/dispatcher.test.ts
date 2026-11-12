import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChannelName, ChannelResult, NotificationChannel, ReminderMessage } from '../channels/types';
import { DispatcherStore, RecipientContext, ReminderDispatcher, ReminderRow, TaskSnapshot, formatDueText } from '../engine/dispatcher';
import { DeliveryPolicy } from '../domain/reminders';

// ---------------------------------------------------------------------------
// In-memory store that mimics the atomic semantics of the Prisma store
// ---------------------------------------------------------------------------

class MemoryStore implements DispatcherStore {
  rows = new Map<string, ReminderRow & { nextRetryAt?: Date | null; sentAt?: Date; lastError?: string; updatedAt: Date }>();
  tasks = new Map<string, TaskSnapshot>();
  ctx: RecipientContext;
  claimDelayMs = 0;

  constructor(policy: Partial<DeliveryPolicy> = {}) {
    this.ctx = {
      policy: {
        timezone: 'Asia/Kolkata',
        dndEnabled: false,
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        weekendReminders: true,
        workingDays: [1, 2, 3, 4, 5, 6],
        workingHoursStart: '09:00',
        workingHoursEnd: '18:30',
        onlyDuringWorkingHours: false,
        ...policy,
      },
      channels: { channelInApp: true, channelPush: true, channelEmail: false, channelWhatsapp: false, channelSms: false },
      mandatoryCategories: [],
      maxAttempts: 3,
    };
  }

  add(row: Partial<ReminderRow> & { id: string; fireAt: Date }) {
    this.rows.set(row.id, {
      taskId: 't1',
      employeeId: 'E1',
      kind: 'OFFSET',
      deliverAt: row.fireAt,
      status: 'SCHEDULED',
      attempts: 0,
      channels: [],
      updatedAt: new Date(0),
      ...row,
    } as any);
  }

  async findDue(now: Date) {
    return [...this.rows.values()]
      .filter((r) => (r.status === 'SCHEDULED' && r.deliverAt <= now) || (r.status === 'FAILED' && r.nextRetryAt && r.nextRetryAt <= now))
      .map((r) => ({ ...r, channels: [...r.channels] }));
  }
  async claim(id: string, from: string, now: Date) {
    if (this.claimDelayMs) await new Promise((r) => setTimeout(r, this.claimDelayMs));
    const r = this.rows.get(id);
    if (!r || r.status !== from) return false;
    r.status = 'SENDING';
    r.attempts++;
    r.updatedAt = now;
    return true;
  }
  async reschedule(id: string, deliverAt: Date) {
    const r = this.rows.get(id)!;
    Object.assign(r, { status: 'SCHEDULED', deliverAt, attempts: r.attempts - 1 });
  }
  async markSent(id: string, channels: string[], now: Date) {
    Object.assign(this.rows.get(id)!, { status: 'SENT', channels, sentAt: now });
  }
  async markFailed(id: string, channels: string[], error: string, retryAt: Date | null) {
    Object.assign(this.rows.get(id)!, { status: 'FAILED', channels, lastError: error, nextRetryAt: retryAt });
  }
  async markFinal(id: string, status: 'SKIPPED' | 'CANCELLED', reason: string) {
    Object.assign(this.rows.get(id)!, { status, lastError: reason });
  }
  async releaseStuck(olderThan: Date) {
    let n = 0;
    for (const r of this.rows.values()) {
      if (r.status === 'SENDING' && r.updatedAt < olderThan) {
        Object.assign(r, { status: 'FAILED', nextRetryAt: new Date(0) });
        n++;
      }
    }
    return n;
  }
  async getTask(id: string) {
    return this.tasks.get(id) ?? null;
  }
  async getRecipientContext() {
    return this.ctx;
  }
  async countUnread() {
    return 2;
  }
}

class FakeChannel implements NotificationChannel {
  sent: ReminderMessage[] = [];
  failuresLeft = 0;
  permanentFail = false;
  constructor(public readonly name: ChannelName, private configured = true) {}
  isConfigured() {
    return this.configured;
  }
  async send(m: ReminderMessage): Promise<ChannelResult> {
    if (this.permanentFail) return { ok: false, permanent: true, error: 'gone' };
    if (this.failuresLeft > 0) {
      this.failuresLeft--;
      return { ok: false, error: 'temporary outage' };
    }
    this.sent.push(m);
    return { ok: true };
  }
}

function setup(policy: Partial<DeliveryPolicy> = {}) {
  const store = new MemoryStore(policy);
  store.tasks.set('t1', { id: 't1', title: 'Deploy release', status: 'PENDING', priority: 'HIGH', category: 'WORK', dueAt: new Date('2026-11-11T10:00:00Z') });
  const inApp = new FakeChannel('IN_APP');
  const push = new FakeChannel('PUSH');
  const email = new FakeChannel('EMAIL', false);
  const dispatcher = new ReminderDispatcher({
    store,
    channels: new Map<ChannelName, NotificationChannel>([
      ['IN_APP', inApp],
      ['PUSH', push],
      ['EMAIL', email],
    ]),
    signToken: (c) => `token-for-${c.reminderId}`,
    logger: { log() {}, warn() {}, error() {} },
  });
  return { store, inApp, push, dispatcher };
}

const NOW = new Date('2026-11-11T09:45:00Z');

test('delivers a due reminder once through every enabled channel', async () => {
  const { store, inApp, push, dispatcher } = setup();
  store.add({ id: 'r1', fireAt: NOW });
  const res = await dispatcher.tick(NOW);
  assert.equal(res.sent, 1);
  assert.equal(inApp.sent.length, 1);
  assert.equal(push.sent.length, 1);
  assert.equal(push.sent[0].actionToken, 'token-for-r1');
  assert.equal(push.sent[0].url, '/planner?task=t1');
  assert.equal(push.sent[0].badgeCount, 3);
  assert.match(push.sent[0].body, /Due in 15 min/);
  assert.equal(store.rows.get('r1')!.status, 'SENT');

  await dispatcher.tick(new Date(NOW.getTime() + 60_000));
  assert.equal(inApp.sent.length, 1, 'second tick must not resend');
});

test('concurrent ticks (two server instances) never send duplicates', async () => {
  const { store, inApp, push, dispatcher } = setup();
  store.claimDelayMs = 5;
  for (let i = 0; i < 10; i++) store.add({ id: `r${i}`, fireAt: NOW });
  await Promise.all([dispatcher.tick(NOW), dispatcher.tick(NOW), dispatcher.tick(NOW)]);
  assert.equal(inApp.sent.length, 10);
  assert.equal(push.sent.length, 10);
  assert.equal(new Set(push.sent.map((m) => m.reminderId)).size, 10);
});

test('future reminders are not delivered early', async () => {
  const { store, inApp, dispatcher } = setup();
  store.add({ id: 'r1', fireAt: new Date(NOW.getTime() + 5 * 60_000) });
  await dispatcher.tick(NOW);
  assert.equal(inApp.sent.length, 0);
  assert.equal(store.rows.get('r1')!.status, 'SCHEDULED');
});

test('transient failure retries only the failed channel, then succeeds', async () => {
  const { store, inApp, push, dispatcher } = setup();
  push.failuresLeft = 1;
  store.add({ id: 'r1', fireAt: NOW });

  const first = await dispatcher.tick(NOW);
  assert.equal(first.failed, 1);
  const row = store.rows.get('r1')!;
  assert.equal(row.status, 'FAILED');
  assert.deepEqual(row.channels, ['IN_APP']);
  assert.ok(row.nextRetryAt && row.nextRetryAt > NOW);

  await dispatcher.tick(row.nextRetryAt!);
  assert.equal(store.rows.get('r1')!.status, 'SENT');
  assert.equal(inApp.sent.length, 1, 'in-app must not be duplicated by the retry');
  assert.equal(push.sent.length, 1);
});

test('gives up after max attempts', async () => {
  const { store, push, dispatcher } = setup();
  push.failuresLeft = 99;
  store.add({ id: 'r1', fireAt: NOW });
  let t = NOW;
  for (let i = 0; i < 5; i++) {
    await dispatcher.tick(t);
    const r = store.rows.get('r1')!;
    if (!r.nextRetryAt) break;
    t = r.nextRetryAt;
  }
  const r = store.rows.get('r1')!;
  assert.equal(r.status, 'FAILED');
  assert.equal(r.nextRetryAt, null);
  assert.equal(r.attempts, 3);
});

test('permanent channel failure does not block or retry', async () => {
  const { store, push, dispatcher } = setup();
  push.permanentFail = true;
  store.add({ id: 'r1', fireAt: NOW });
  await dispatcher.tick(NOW);
  assert.equal(store.rows.get('r1')!.status, 'SENT');
});

test('completed or deleted tasks cancel their pending reminders', async () => {
  const { store, inApp, dispatcher } = setup();
  store.tasks.get('t1')!.status = 'COMPLETED';
  store.add({ id: 'r1', fireAt: NOW });
  store.add({ id: 'r2', fireAt: NOW, taskId: 'missing' });
  const res = await dispatcher.tick(NOW);
  assert.equal(res.cancelled, 2);
  assert.equal(inApp.sent.length, 0);
});

test('quiet hours defer delivery and it fires when the window ends', async () => {
  const { store, inApp, dispatcher } = setup({ quietHoursEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '07:00' });
  store.tasks.get('t1')!.priority = 'MEDIUM';
  const night = new Date('2026-11-11T17:30:00Z'); // 23:00 IST
  store.add({ id: 'r1', fireAt: night });
  const res = await dispatcher.tick(night);
  assert.equal(res.deferred, 1);
  const row = store.rows.get('r1')!;
  assert.equal(row.status, 'SCHEDULED');
  assert.equal(row.deliverAt.toISOString(), '2026-11-12T01:30:00.000Z'); // 07:00 IST
  assert.equal(row.attempts, 0, 'deferral is not a delivery attempt');

  await dispatcher.tick(row.deliverAt);
  assert.equal(inApp.sent.length, 1);
});

test('mandatory reminders bypass quiet hours', async () => {
  const { store, inApp, dispatcher } = setup({ quietHoursEnabled: true });
  const night = new Date('2026-11-11T17:30:00Z');
  store.add({ id: 'c1', fireAt: night, taskId: null, kind: 'COMPANY', mandatory: true, title: 'Submit timesheet', message: 'Please submit' });
  await dispatcher.tick(night);
  assert.equal(inApp.sent.length, 1);
  assert.equal(inApp.sent[0].title, 'Submit timesheet');
  assert.equal(inApp.sent[0].url, '/planner');
});

test('indefinite DND: in-app only, no push', async () => {
  const { store, inApp, push, dispatcher } = setup({ dndEnabled: true, dndUntil: null });
  store.tasks.get('t1')!.priority = 'MEDIUM';
  store.add({ id: 'r1', fireAt: NOW });
  await dispatcher.tick(NOW);
  assert.equal(inApp.sent.length, 1);
  assert.equal(inApp.sent[0].silent, true);
  assert.equal(push.sent.length, 0);
});

test('stale reminders after long downtime are skipped, not spammed', async () => {
  const { store, inApp, dispatcher } = setup();
  store.add({ id: 'old', fireAt: new Date(NOW.getTime() - 24 * 3_600_000) });
  const res = await dispatcher.tick(NOW);
  assert.equal(res.skipped, 1);
  assert.equal(inApp.sent.length, 0);
});

test('all channels disabled => skipped', async () => {
  const { store, dispatcher } = setup();
  store.ctx.channels = { channelInApp: false, channelPush: false, channelEmail: false, channelWhatsapp: false, channelSms: false };
  store.add({ id: 'r1', fireAt: NOW });
  assert.equal((await dispatcher.tick(NOW)).skipped, 1);
});

test('stuck SENDING rows (crashed worker) are recovered and delivered', async () => {
  const { store, inApp, dispatcher } = setup();
  store.add({ id: 'r1', fireAt: NOW, status: 'SENDING', attempts: 1 });
  store.rows.get('r1')!.updatedAt = new Date(NOW.getTime() - 10 * 60_000);
  await dispatcher.tick(NOW);
  assert.equal(inApp.sent.length, 1);
  assert.equal(store.rows.get('r1')!.status, 'SENT');
});

test('due-text formatting', () => {
  const tz = 'Asia/Kolkata';
  const now = new Date('2026-11-11T09:00:00Z');
  assert.match(formatDueText(new Date('2026-11-11T09:10:00Z'), now, tz), /^Due in 10 min/);
  assert.match(formatDueText(new Date('2026-11-11T09:00:30Z'), now, tz), /^Due now/);
  assert.match(formatDueText(new Date('2026-11-11T12:00:00Z'), now, tz), /^Due today at/);
  assert.match(formatDueText(new Date('2026-11-11T08:00:00Z'), now, tz), /^Overdue/);
  assert.match(formatDueText(new Date('2026-11-13T08:00:00Z'), now, tz), /^Due Fri/);
});
