import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RecurrenceRule, nextOccurrence, occurrencesBetween } from '../domain/recurrence';
import { formatDateKey, getZonedParts } from '../domain/timezone';

const TZ = 'Asia/Kolkata';
const rule = (over: Partial<RecurrenceRule>): RecurrenceRule => ({
  frequency: 'DAILY',
  interval: 1,
  unit: 'DAY',
  daysOfWeek: [],
  timezone: TZ,
  anchorAt: new Date('2026-11-11T04:00:00Z'), // Wed 11 Nov 09:30 IST
  ...over,
});
const keys = (ds: Date[]) => ds.map((d) => formatDateKey(d, TZ));

test('daily standup repeats every day at the same local time', () => {
  const r = rule({});
  const next = nextOccurrence(r, r.anchorAt)!;
  assert.equal(next.toISOString(), '2026-11-12T04:00:00.000Z');
  const list = occurrencesBetween(r, r.anchorAt, new Date('2026-11-14T23:00:00Z'));
  assert.deepEqual(keys(list), ['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14']);
});

test('every 3 days (custom interval)', () => {
  const r = rule({ frequency: 'CUSTOM', unit: 'DAY', interval: 3 });
  assert.deepEqual(keys(occurrencesBetween(r, r.anchorAt, new Date('2026-11-20T23:00:00Z'))), ['2026-11-11', '2026-11-14', '2026-11-17', '2026-11-20']);
});

test('weekdays skips Saturday and Sunday', () => {
  const r = rule({ frequency: 'WEEKDAYS', anchorAt: new Date('2026-11-13T04:00:00Z') }); // Friday
  const next = nextOccurrence(r, r.anchorAt)!;
  assert.equal(formatDateKey(next, TZ), '2026-11-16'); // Monday
  assert.equal(getZonedParts(next, TZ).hour, 9);
});

test('weekly report on Mon & Thu, every 2 weeks', () => {
  const r = rule({ frequency: 'WEEKLY', interval: 2, daysOfWeek: [1, 4], anchorAt: new Date('2026-11-09T04:00:00Z') }); // Mon 9 Nov
  const list = occurrencesBetween(r, r.anchorAt, new Date('2026-12-08T00:00:00Z'));
  assert.deepEqual(keys(list), ['2026-11-09', '2026-11-12', '2026-11-23', '2026-11-26', '2026-12-07']);
});

test('weekly with no days defaults to the anchor weekday', () => {
  const r = rule({ frequency: 'WEEKLY' });
  assert.equal(formatDateKey(nextOccurrence(r, r.anchorAt)!, TZ), '2026-11-18');
});

test('monthly salary review clamps the 31st to the end of shorter months', () => {
  const r = rule({ frequency: 'MONTHLY', anchorAt: new Date('2026-01-31T04:00:00Z') });
  const list = occurrencesBetween(r, r.anchorAt, new Date('2026-05-01T00:00:00Z'));
  assert.deepEqual(keys(list), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
});

test('yearly appraisal on Feb 29 falls back to Feb 28', () => {
  const r = rule({ frequency: 'YEARLY', anchorAt: new Date('2028-02-29T04:00:00Z') });
  assert.equal(formatDateKey(nextOccurrence(r, r.anchorAt)!, TZ), '2029-02-28');
});

test('series stops at endsAt and maxOccurrences', () => {
  const r = rule({ endsAt: new Date('2026-11-13T05:00:00Z') });
  assert.equal(keys(occurrencesBetween(r, r.anchorAt, new Date('2026-12-01T00:00:00Z'))).length, 3);
  const capped = rule({ maxOccurrences: 2 });
  assert.ok(nextOccurrence(capped, capped.anchorAt, 1));
  assert.equal(nextOccurrence(capped, capped.anchorAt, 2), null);
});

test('catch-up: next occurrence after a long gap is the first future one', () => {
  const r = rule({});
  const after = new Date('2026-12-25T10:00:00Z'); // 15:30 IST, today's 09:30 already passed
  assert.equal(formatDateKey(nextOccurrence(r, after)!, TZ), '2026-12-26');
});

test('DST-aware: 09:00 New York stays 09:00 local across the March change', () => {
  const r = rule({ timezone: 'America/New_York', anchorAt: new Date('2026-03-06T14:00:00Z') }); // Fri 09:00 EST
  const list = occurrencesBetween(r, r.anchorAt, new Date('2026-03-10T00:00:00Z'));
  for (const d of list) assert.equal(getZonedParts(d, 'America/New_York').hour, 9);
  assert.equal(list[list.length - 1].toISOString(), '2026-03-09T13:00:00.000Z'); // EDT
});
