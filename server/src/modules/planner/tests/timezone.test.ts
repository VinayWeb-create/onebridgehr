import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addZonedDays,
  formatDateKey,
  getTimezoneOffsetMinutes,
  getZonedParts,
  isValidTimezone,
  parseHHmm,
  safeTimezone,
  startOfZonedDay,
  zonedTimeToUtc,
} from '../domain/timezone';

test('IST offset is +05:30 and wall time converts to the right UTC instant', () => {
  assert.equal(getTimezoneOffsetMinutes(new Date('2026-11-11T00:00:00Z'), 'Asia/Kolkata'), 330);
  const utc = zonedTimeToUtc({ year: 2026, month: 11, day: 11, hour: 9, minute: 30 }, 'Asia/Kolkata');
  assert.equal(utc.toISOString(), '2026-11-11T04:00:00.000Z');
});

test('getZonedParts reports local wall-clock and weekday', () => {
  const p = getZonedParts(new Date('2026-11-11T20:00:00Z'), 'Asia/Kolkata'); // 01:30 Thu 12 Nov IST
  assert.deepEqual([p.year, p.month, p.day, p.hour, p.minute, p.weekday], [2026, 11, 12, 1, 30, 4]);
});

test('DST: New York 09:00 is 14:00Z in winter and 13:00Z in summer', () => {
  assert.equal(zonedTimeToUtc({ year: 2026, month: 1, day: 15, hour: 9 }, 'America/New_York').toISOString(), '2026-01-15T14:00:00.000Z');
  assert.equal(zonedTimeToUtc({ year: 2026, month: 7, day: 15, hour: 9 }, 'America/New_York').toISOString(), '2026-07-15T13:00:00.000Z');
});

test('day overflow is normalised (Jan 32 -> Feb 1)', () => {
  const d = zonedTimeToUtc({ year: 2026, month: 1, day: 32, hour: 10 }, 'Asia/Kolkata');
  assert.equal(formatDateKey(d, 'Asia/Kolkata'), '2026-02-01');
});

test('start of local day and adding local days', () => {
  const now = new Date('2026-11-11T20:00:00Z'); // 12 Nov 01:30 IST
  assert.equal(startOfZonedDay(now, 'Asia/Kolkata').toISOString(), '2026-11-11T18:30:00.000Z');
  assert.equal(formatDateKey(addZonedDays(now, 1, 'Asia/Kolkata'), 'Asia/Kolkata'), '2026-11-13');
});

test('timezone validation and HH:mm parsing', () => {
  assert.equal(isValidTimezone('Asia/Kolkata'), true);
  assert.equal(isValidTimezone('Mars/Olympus'), false);
  assert.equal(safeTimezone('nope'), 'Asia/Kolkata');
  assert.equal(parseHHmm('09:05'), 545);
  assert.equal(parseHHmm('23:59'), 1439);
  assert.equal(parseHHmm('24:00'), null);
  assert.equal(parseHHmm('9am'), null);
});
