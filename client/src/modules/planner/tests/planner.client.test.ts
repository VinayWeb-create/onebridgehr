// Client unit tests — run with: npm run test:planner   (node:test with native TS type-stripping)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTaskOverdue, matchesFilter, positionBetween, sortByPosition, sortTasks } from '../lib/filters.ts';
import { OfflineQueue, TaskCache, optimisticTask } from '../lib/offlineQueue.ts';
import type { KeyValueStorage, QueuedOp } from '../lib/offlineQueue.ts';
import { collectDueLocalReminders, localReminderSlots } from '../lib/localReminders.ts';
import { parseQuickAdd } from '../lib/quickAddParser.ts';
import type { PlannerTask } from '../types.ts';

class MemStorage implements KeyValueStorage {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const NOW = new Date(2026, 10, 11, 10, 0, 0); // Wed 11 Nov 2026 10:00 local
const task = (over: Partial<PlannerTask> = {}): PlannerTask => ({
  ...optimisticTask({ title: 'Task' }, 'E1', 't' + Math.random().toString(36).slice(2, 6)),
  _pending: false,
  ...over,
});

// ---------------------------------------------------------------- filters

test('smart filters: today / tomorrow / overdue / high priority / completed', () => {
  const today = task({ dueAt: new Date(2026, 10, 11, 15).toISOString() });
  const tomorrow = task({ dueAt: new Date(2026, 10, 12, 9).toISOString() });
  const overdue = task({ dueAt: new Date(2026, 10, 10, 9).toISOString() });
  const high = task({ priority: 'CRITICAL' });
  const done = task({ status: 'COMPLETED', dueAt: new Date(2026, 10, 11, 8).toISOString() });
  const all = [today, tomorrow, overdue, high, done];
  const ids = (f: any) => all.filter((t) => matchesFilter(t, { filter: f }, 'E1', NOW)).map((t) => t.id);

  assert.deepEqual(ids('TODAY'), [today.id, done.id]);
  assert.deepEqual(ids('TOMORROW'), [tomorrow.id]);
  assert.deepEqual(ids('OVERDUE'), [overdue.id]);
  assert.deepEqual(ids('HIGH_PRIORITY'), [high.id]);
  assert.deepEqual(ids('COMPLETED'), [done.id]);
  assert.equal(isTaskOverdue(done, NOW), false, 'completed tasks are never overdue');
});

test('this week runs Monday–Sunday', () => {
  const sun = task({ dueAt: new Date(2026, 10, 15, 12).toISOString() });
  const nextMon = task({ dueAt: new Date(2026, 10, 16, 9).toISOString() });
  const lastMon = task({ dueAt: new Date(2026, 10, 9, 9).toISOString() });
  const f = (t: PlannerTask) => matchesFilter(t, { filter: 'THIS_WEEK' }, 'E1', NOW);
  assert.equal(f(sun), true);
  assert.equal(f(nextMon), false);
  assert.equal(f(lastMon), true);
});

test('assigned-to-me, project and meeting filters', () => {
  const shared = task({ ownerId: 'E9', assigneeIds: ['E1'] });
  const mine = task({ projectName: 'Website' });
  const meeting = task({ category: 'MEETING_REMINDER' });
  assert.equal(matchesFilter(shared, { filter: 'ASSIGNED_TO_ME' }, 'E1', NOW), true);
  assert.equal(matchesFilter(mine, { filter: 'ASSIGNED_TO_ME' }, 'E1', NOW), false);
  assert.equal(matchesFilter(mine, { filter: 'PROJECT' }, 'E1', NOW), true);
  assert.equal(matchesFilter(meeting, { filter: 'MEETING' }, 'E1', NOW), true);
});

test('search covers title, tags, category, priority, project, people and status', () => {
  const t = task({ title: 'Launch website', tags: ['release'], category: 'CLIENT_FOLLOWUP', projectName: 'Acme', assigneeIds: ['OBI0042'], priority: 'HIGH' });
  for (const q of ['launch', 'release', 'client followup', 'high', 'acme', 'obi0042', 'pending']) {
    assert.equal(matchesFilter(t, { q }, 'E1', NOW), true, q);
  }
  assert.equal(matchesFilter(t, { q: 'payroll' }, 'E1', NOW), false);
  assert.equal(matchesFilter(t, { status: 'OVERDUE' }, 'E1', NOW), false);
  assert.equal(matchesFilter(t, { priority: 'HIGH,CRITICAL', category: 'CLIENT_FOLLOWUP' }, 'E1', NOW), true);
});

test('archived tasks are hidden except under Completed', () => {
  const a = task({ status: 'ARCHIVED' });
  assert.equal(matchesFilter(a, { filter: 'ALL' }, 'E1', NOW), false);
});

test('sorting: due date first, then priority; undated last; kanban by position', () => {
  const a = task({ dueAt: new Date(2026, 10, 12).toISOString(), priority: 'LOW' });
  const b = task({ dueAt: new Date(2026, 10, 12).toISOString(), priority: 'CRITICAL' });
  const c = task({ dueAt: null });
  const d = task({ dueAt: new Date(2026, 10, 11).toISOString() });
  assert.deepEqual(sortTasks([c, a, b, d]).map((t) => t.id), [d.id, b.id, a.id, c.id]);
  assert.deepEqual(sortByPosition([task({ position: 3, id: 'x' }), task({ position: 1, id: 'y' })]).map((t) => t.id), ['y', 'x']);
  assert.equal(positionBetween(1000, 2000), 1500);
  assert.equal(positionBetween(undefined, 1000), 0);
  assert.equal(positionBetween(1000, undefined), 2000);
  assert.equal(positionBetween(), 1000);
});

// ---------------------------------------------------------------- offline queue

test('offline queue persists and replays in order; successes removed', async () => {
  const storage = new MemStorage();
  const q = new OfflineQueue(storage);
  q.enqueue({ type: 'CREATE', taskId: 'tmp-1', payload: { title: 'A' } });
  q.enqueue({ type: 'COMPLETE', taskId: 'srv-2', payload: {} });
  assert.equal(new OfflineQueue(storage).size(), 2, 'survives reload');

  let sent: QueuedOp[] = [];
  const r = await q.flush(async (ops) => {
    sent = ops;
    return ops.map((o) => ({ opId: o.opId, ok: true, taskId: o.type === 'CREATE' ? 'srv-1' : o.taskId }));
  });
  assert.deepEqual(sent.map((o) => o.type), ['CREATE', 'COMPLETE']);
  assert.equal(r.synced, 2);
  assert.equal(r.idMap.get('tmp-1'), 'srv-1');
  assert.equal(q.size(), 0);
});

test('offline queue coalesces updates and folds them into offline creates', () => {
  const q = new OfflineQueue(new MemStorage());
  q.enqueue({ type: 'UPDATE', taskId: 'srv-1', payload: { title: 'x' } });
  q.enqueue({ type: 'UPDATE', taskId: 'srv-1', payload: { priority: 'HIGH' } });
  q.enqueue({ type: 'CREATE', taskId: 'tmp-9', payload: { title: 'new' } });
  q.enqueue({ type: 'UPDATE', taskId: 'tmp-9', payload: { title: 'renamed' } });
  const ops = q.read();
  assert.equal(ops.length, 2);
  assert.deepEqual(ops[0].payload, { title: 'x', priority: 'HIGH' });
  assert.deepEqual(ops[1].payload, { title: 'renamed' });
});

test('deleting an offline-only task drops its queued operations', () => {
  const q = new OfflineQueue(new MemStorage());
  q.enqueue({ type: 'CREATE', taskId: 'tmp-5', payload: { title: 'oops' } });
  q.enqueue({ type: 'DELETE', taskId: 'tmp-5', payload: {} });
  assert.equal(q.size(), 0);
});

test('network failure keeps ops; 4xx drops them; 5xx retries', async () => {
  const q = new OfflineQueue(new MemStorage());
  q.enqueue({ type: 'UPDATE', taskId: 'a', payload: { title: 'a' } });
  q.enqueue({ type: 'UPDATE', taskId: 'b', payload: { title: 'b' } });
  q.enqueue({ type: 'UPDATE', taskId: 'c', payload: { title: 'c' } });

  const offline = await q.flush(async () => {
    throw new Error('Network Error');
  });
  assert.equal(offline.remaining, 3);
  assert.equal(q.read()[0].attempts, 1);

  const ops = q.read();
  const r = await q.flush(async () => [
    { opId: ops[0].opId, ok: true },
    { opId: ops[1].opId, ok: false, status: 403, error: 'Forbidden' },
    { opId: ops[2].opId, ok: false, status: 500, error: 'boom' },
  ]);
  assert.deepEqual([r.synced, r.dropped, r.remaining], [1, 1, 1]);
  assert.equal(q.read()[0].taskId, 'c');
});

test('task cache merges server data and keeps offline-only tasks', () => {
  const cache = new TaskCache(new MemStorage());
  cache.upsert(optimisticTask({ title: 'offline' }, 'E1', 'tmp-1'));
  cache.merge([task({ id: 'srv-1', title: 'server' })]);
  assert.deepEqual(cache.read().map((t) => t.id).sort(), ['srv-1', 'tmp-1']);
  cache.replaceIds(new Map([['tmp-1', 'srv-2']]));
  assert.deepEqual(cache.read().map((t) => t.id), ['srv-1']);
});

// ---------------------------------------------------------------- local reminders

test('local reminders fire once per device, only within the window', () => {
  const storage = new MemStorage();
  const due = new Date(NOW.getTime() + 15 * 60_000).toISOString();
  const t = task({ id: 'L1', dueAt: due, reminderOffsets: [15, 60], customReminderAts: [new Date(NOW.getTime() - 2 * 3_600_000).toISOString()] });
  assert.equal(localReminderSlots([t]).length, 3);

  const first = collectDueLocalReminders([t], storage, NOW.getTime(), NOW.getTime() - 60_000);
  assert.equal(first.length, 1, 'the 15-min reminder fires; the 1h one was 45 min ago; custom is beyond lookback');
  assert.equal(first[0].taskId, 'L1');

  const again = collectDueLocalReminders([t], storage, NOW.getTime() + 1000, NOW.getTime() - 60_000);
  assert.equal(again.length, 0, 'never fires twice on the same device');

  const doneTask = { ...t, id: 'L2', status: 'COMPLETED' as const };
  assert.equal(collectDueLocalReminders([doneTask], new MemStorage(), NOW.getTime(), NOW.getTime() - 60_000).length, 0);
});

// ---------------------------------------------------------------- quick add

test('quick add parses dates, times and priority', () => {
  const now = new Date(2026, 10, 11, 10, 0);
  const a = parseQuickAdd('Call Acme tomorrow 3pm !high', now);
  assert.equal(a.title, 'Call Acme');
  assert.equal(a.priority, 'HIGH');
  const d = new Date(a.dueAt!);
  assert.deepEqual([d.getDate(), d.getHours(), d.getMinutes()], [12, 15, 0]);

  const b = parseQuickAdd('Standup at 09:30', now); // 09:30 already passed today -> tomorrow
  assert.deepEqual([new Date(b.dueAt!).getDate(), new Date(b.dueAt!).getHours()], [12, 9]);

  const c = parseQuickAdd('Pay invoice today !urgent', now);
  assert.equal(c.priority, 'CRITICAL');
  assert.equal(new Date(c.dueAt!).getHours(), 18);

  const plain = parseQuickAdd('Buy milk', now);
  assert.equal(plain.dueAt, null);
  assert.equal(plain.title, 'Buy milk');
});
