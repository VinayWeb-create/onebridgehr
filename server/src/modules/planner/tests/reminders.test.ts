import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DeliveryPolicy,
  computeReminderSlots,
  nextRetryAt,
  reminderDedupeKey,
  resolveDeliveryTime,
  resolveSnoozeUntil,
} from '../domain/reminders';
import { getZonedParts } from '../domain/timezone';

const TZ = 'Asia/Kolkata';
const ist = (iso: string) => new Date(`${iso}+05:30`);
const basePolicy: DeliveryPolicy = {
  timezone: TZ,
  dndEnabled: false,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  weekendReminders: true,
  workingDays: [1, 2, 3, 4, 5],
  workingHoursStart: '09:00',
  workingHoursEnd: '18:00',
  onlyDuringWorkingHours: false,
};

test('reminder slots: multiple offsets, custom time, past ones dropped, duplicates collapsed', () => {
  const now = ist('2026-11-11T10:00:00');
  const dueAt = ist('2026-11-11T15:00:00');
  const slots = computeReminderSlots(
    { dueAt, reminderOffsets: [0, 15, 60, 15, 600], customReminderAts: [ist('2026-11-11T14:45:00'), ist('2026-11-11T12:00:00')] },
    now
  );
  assert.deepEqual(
    slots.map((s) => [s.kind, s.offsetMinutes, s.fireAt.toISOString()]),
    [
      ['CUSTOM', null, ist('2026-11-11T12:00:00').toISOString()],
      ['OFFSET', 60, ist('2026-11-11T14:00:00').toISOString()],
      ['OFFSET', 15, ist('2026-11-11T14:45:00').toISOString()],
      ['OFFSET', 0, dueAt.toISOString()],
    ]
  );
});

test('no due date => only custom reminders', () => {
  const now = ist('2026-11-11T10:00:00');
  assert.equal(computeReminderSlots({ dueAt: null, reminderOffsets: [15] }, now).length, 0);
});

test('quiet hours defer a 23:00 reminder to 07:00 next morning', () => {
  const d = resolveDeliveryTime(ist('2026-11-11T23:00:00'), { ...basePolicy, quietHoursEnabled: true });
  assert.equal(d.deliverAt.toISOString(), ist('2026-11-12T07:00:00').toISOString());
  assert.deepEqual(d.reasons, ['QUIET_HOURS']);
});

test('company quiet hours apply even if the employee has none', () => {
  const d = resolveDeliveryTime(ist('2026-11-11T21:30:00'), {
    ...basePolicy,
    companyQuietHoursEnabled: true,
    companyQuietHoursStart: '21:00',
    companyQuietHoursEnd: '08:00',
  });
  assert.equal(d.deliverAt.toISOString(), ist('2026-11-12T08:00:00').toISOString());
});

test('weekend reminders disabled: Saturday -> Monday at working start', () => {
  const d = resolveDeliveryTime(ist('2026-11-14T11:00:00'), { ...basePolicy, weekendReminders: false }); // Sat
  assert.equal(d.deliverAt.toISOString(), ist('2026-11-16T09:00:00').toISOString());
  assert.equal(getZonedParts(d.deliverAt, TZ).weekday, 1);
});

test('holiday defers to the next working day', () => {
  const d = resolveDeliveryTime(ist('2026-11-12T10:00:00'), { ...basePolicy, holidayDateKeys: new Set(['2026-11-12']) });
  assert.equal(d.deliverAt.toISOString(), ist('2026-11-13T09:00:00').toISOString());
  assert.ok(d.reasons.includes('HOLIDAY'));
});

test('DND with an end time defers; indefinite DND delivers silently', () => {
  const until = ist('2026-11-11T13:00:00');
  const a = resolveDeliveryTime(ist('2026-11-11T12:00:00'), { ...basePolicy, dndEnabled: true, dndUntil: until });
  assert.equal(a.deliverAt.toISOString(), until.toISOString());
  const b = resolveDeliveryTime(ist('2026-11-11T12:00:00'), { ...basePolicy, dndEnabled: true, dndUntil: null });
  assert.equal(b.deferred, false);
  assert.equal(b.silent, true);
});

test('only-during-working-hours moves an evening reminder to next morning', () => {
  const d = resolveDeliveryTime(ist('2026-11-11T19:30:00'), { ...basePolicy, onlyDuringWorkingHours: true });
  assert.equal(d.deliverAt.toISOString(), ist('2026-11-12T09:00:00').toISOString());
});

test('mandatory and CRITICAL reminders bypass every rule', () => {
  const policy = { ...basePolicy, quietHoursEnabled: true, dndEnabled: true, weekendReminders: false };
  const at = ist('2026-11-14T23:30:00');
  assert.equal(resolveDeliveryTime(at, policy, { mandatory: true }).deliverAt.toISOString(), at.toISOString());
  assert.equal(resolveDeliveryTime(at, policy, { priority: 'CRITICAL' }).deferred, false);
});

test('combined rules converge: Friday 23:00 with quiet hours + no weekends -> Monday 09:00', () => {
  const d = resolveDeliveryTime(ist('2026-11-13T23:00:00'), { ...basePolicy, quietHoursEnabled: true, weekendReminders: false });
  assert.equal(d.deliverAt.toISOString(), ist('2026-11-16T09:00:00').toISOString());
});

test('snooze options', () => {
  const now = ist('2026-11-11T16:20:00');
  assert.equal(resolveSnoozeUntil('10', now, TZ).getTime() - now.getTime(), 10 * 60_000);
  assert.equal(resolveSnoozeUntil(60, now, TZ).getTime() - now.getTime(), 3_600_000);
  assert.equal(resolveSnoozeUntil('TOMORROW', now, TZ, '09:30').toISOString(), ist('2026-11-12T09:30:00').toISOString());
  const custom = ist('2026-11-11T18:00:00');
  assert.equal(resolveSnoozeUntil(custom.toISOString(), now, TZ).toISOString(), custom.toISOString());
  assert.throws(() => resolveSnoozeUntil(ist('2026-11-11T08:00:00').toISOString(), now, TZ));
});

test('dedupe keys are stable and distinguish recipients and times', () => {
  const fireAt = new Date('2026-11-11T10:00:00Z');
  const a = reminderDedupeKey({ taskId: 't1', employeeId: 'E1', kind: 'OFFSET', fireAt });
  assert.equal(a, reminderDedupeKey({ taskId: 't1', employeeId: 'E1', kind: 'OFFSET', fireAt: new Date(fireAt) }));
  assert.notEqual(a, reminderDedupeKey({ taskId: 't1', employeeId: 'E2', kind: 'OFFSET', fireAt }));
  assert.notEqual(a, reminderDedupeKey({ taskId: 't1', employeeId: 'E1', kind: 'OFFSET', fireAt: new Date(fireAt.getTime() + 1) }));
});

test('retry backoff grows then stops at max attempts', () => {
  const now = new Date('2026-11-11T10:00:00Z');
  const backoff = [1, 2, 5];
  assert.equal(nextRetryAt(1, now, 4, backoff)!.getTime() - now.getTime(), 60_000);
  assert.equal(nextRetryAt(3, now, 4, backoff)!.getTime() - now.getTime(), 5 * 60_000);
  assert.equal(nextRetryAt(4, now, 4, backoff), null);
});
