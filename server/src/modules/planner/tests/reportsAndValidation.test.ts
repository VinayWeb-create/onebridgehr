import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateReport, toCsv } from '../services/reportService';
import { createTaskSchema, listQuerySchema, preferencesSchema, snoozeSchema, updateTaskSchema } from '../domain/validators';
import { enabledChannelNames } from '../channels/types';

const base = {
  description: null,
  category: 'WORK',
  priority: 'MEDIUM',
  status: 'PENDING',
  ownerId: 'E1',
  assigneeIds: [] as string[],
  projectName: null,
  tags: [],
  labelIds: [],
  color: null,
  dueAt: null as Date | null,
  allDay: false,
  timezone: 'Asia/Kolkata',
  reminderOffsets: [],
  customReminderAts: [],
  estimatedMinutes: null,
  location: null,
  position: 0,
  source: 'MANUAL',
  sourceRefId: null,
  seriesId: null,
  occurrenceAt: null,
  clientRequestId: null,
  completedAt: null as Date | null,
  archivedAt: null,
  cancelledAt: null,
  updatedAt: new Date(),
};
const t = (id: string, over: Partial<typeof base> & { createdAt: Date }) => ({ id, title: id, ...base, ...over }) as any;

test('report aggregation: counts, completion and on-time rates, average completion time', () => {
  const now = new Date('2026-11-11T12:00:00Z');
  const tasks = [
    t('a', { createdAt: new Date('2026-11-10T08:00:00Z'), status: 'COMPLETED', completedAt: new Date('2026-11-10T12:00:00Z'), dueAt: new Date('2026-11-10T18:00:00Z') }),
    t('b', { createdAt: new Date('2026-11-10T08:00:00Z'), status: 'COMPLETED', completedAt: new Date('2026-11-11T10:00:00Z'), dueAt: new Date('2026-11-10T18:00:00Z'), priority: 'HIGH' }),
    t('c', { createdAt: new Date('2026-11-09T08:00:00Z'), status: 'PENDING', dueAt: new Date('2026-11-10T08:00:00Z'), assigneeIds: ['E2'] }),
    t('d', { createdAt: new Date('2026-11-11T08:00:00Z'), status: 'IN_PROGRESS', category: 'PROJECT' }),
    t('e', { createdAt: new Date('2026-11-11T08:00:00Z'), status: 'CANCELLED' }),
  ];
  const r = aggregateReport(tasks, { from: new Date('2026-11-09T00:00:00Z'), to: now, tz: 'Asia/Kolkata', now, names: new Map([['E1', 'Asha']]) });
  assert.equal(r.total, 5);
  assert.equal(r.completed, 2);
  assert.equal(r.pending, 1);
  assert.equal(r.inProgress, 1);
  assert.equal(r.overdue, 1);
  assert.equal(r.cancelled, 1);
  assert.equal(r.completionRate, 50); // 2 of 4 non-cancelled
  assert.equal(r.onTimeRate, 50);
  assert.equal(r.avgCompletionHours, 15); // (4h + 26h) / 2
  assert.equal(r.byPriority.find((p) => p.priority === 'HIGH')!.completed, 1);
  assert.equal(r.byCategory[0].category, 'WORK');
  const e1 = r.perEmployee.find((p) => p.employeeId === 'E1')!;
  assert.equal(e1.name, 'Asha');
  assert.equal(e1.total, 5);
  assert.equal(r.perEmployee.find((p) => p.employeeId === 'E2')!.overdue, 1);
  assert.ok(r.daily.find((d) => d.date === '2026-11-10')!.completed === 1);
});

test('CSV export escapes quotes/commas and neutralises formula injection', () => {
  const csv = toCsv([{ title: 'Hello, "world"', note: '=HYPERLINK("x")', n: 3 }]);
  assert.equal(csv.split('\n')[1], '"Hello, ""world""","\'=HYPERLINK(""x"")",3');
});

test('create task validation: defaults, trimming and rejection of bad input', () => {
  const parsed = createTaskSchema.parse({ title: '  Launch website  ', dueAt: '2026-11-12T10:00:00+05:30', reminderOffsets: [15, 60] });
  assert.equal(parsed.title, 'Launch website');
  assert.equal(parsed.category, 'WORK');
  assert.equal(parsed.priority, 'MEDIUM');
  assert.ok(parsed.dueAt instanceof Date);
  assert.equal(parsed.dueAt!.toISOString(), '2026-11-12T04:30:00.000Z');

  assert.throws(() => createTaskSchema.parse({ title: '' }));
  assert.throws(() => createTaskSchema.parse({ title: 'x', priority: 'URGENT' }));
  assert.throws(() => createTaskSchema.parse({ title: 'x', timezone: 'Mars/Base' }));
  assert.throws(() => createTaskSchema.parse({ title: 'x', ownerId: 'someone-else' }), 'unknown keys (e.g. ownerId) are rejected');
  assert.throws(() => createTaskSchema.parse({ title: 'x', color: 'red' }));
});

test('repeat validation', () => {
  const p = createTaskSchema.parse({ title: 'Standup', repeat: { frequency: 'WEEKLY', daysOfWeek: [1, 3] } });
  assert.equal(p.repeat!.interval, 1);
  assert.throws(() => createTaskSchema.parse({ title: 'x', repeat: { frequency: 'HOURLY' } }));
  assert.throws(() => createTaskSchema.parse({ title: 'x', repeat: { frequency: 'WEEKLY', daysOfWeek: [7] } }));
});

test('update schema forbids server-owned fields', () => {
  assert.doesNotThrow(() => updateTaskSchema.parse({ status: 'IN_PROGRESS', position: 2 }));
  assert.throws(() => updateTaskSchema.parse({ ownerId: 'E9' }));
  assert.throws(() => updateTaskSchema.parse({ source: 'MEETING' }));
});

test('list query, snooze and preference validation', () => {
  assert.equal(listQuerySchema.parse({}).filter, 'ALL');
  assert.equal(listQuerySchema.parse({ limit: '20' }).limit, 20);
  assert.throws(() => listQuerySchema.parse({ filter: 'YESTERDAY' }));
  assert.doesNotThrow(() => snoozeSchema.parse({ option: 'TOMORROW' }));
  assert.doesNotThrow(() => snoozeSchema.parse({ option: '2026-11-12T10:00:00+05:30' }));
  assert.throws(() => snoozeSchema.parse({ option: 'soon' }));
  assert.throws(() => preferencesSchema.parse({ quietHoursStart: '25:00' }));
});

test('channel selection honours preferences; mandatory forces in-app + push', () => {
  const prefs = { channelInApp: false, channelPush: false, channelEmail: true, channelWhatsapp: false, channelSms: false };
  assert.deepEqual(enabledChannelNames(prefs, false), ['EMAIL']);
  assert.deepEqual(enabledChannelNames(prefs, true), ['IN_APP', 'PUSH', 'EMAIL']);
});
