export const TASK_CATEGORIES = [
  'PERSONAL',
  'WORK',
  'PROJECT',
  'CLIENT_FOLLOWUP',
  'MEETING_REMINDER',
  'CALL_REMINDER',
  'DOCUMENT_REMINDER',
  'TRAINING_REMINDER',
  'BIRTHDAY_REMINDER',
  'ANNIVERSARY_REMINDER',
  'CUSTOM',
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** Persisted statuses. OVERDUE is derived (see `isOverdue`) so Kanban columns stay stable. */
export const TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'CANCELLED', 'ARCHIVED'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const OPEN_STATUSES: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'REVIEW'];

export const REPEAT_FREQUENCIES = ['NEVER', 'DAILY', 'WEEKDAYS', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM'] as const;
export type RepeatFrequency = (typeof REPEAT_FREQUENCIES)[number];
export const REPEAT_UNITS = ['DAY', 'WEEK', 'MONTH', 'YEAR'] as const;
export type RepeatUnit = (typeof REPEAT_UNITS)[number];

/** Minutes before due time. 0 = at due time. */
export const REMINDER_PRESETS = [0, 5, 10, 15, 30, 60, 120, 1440] as const;

export const SNOOZE_PRESETS = ['5', '10', '15', '30', '60', 'TOMORROW'] as const;

export const NOTIFICATION_STATUSES = [
  'SCHEDULED',
  'SENDING',
  'SENT',
  'FAILED',
  'CANCELLED',
  'DISMISSED',
  'SKIPPED',
] as const;
export type ReminderStatus = (typeof NOTIFICATION_STATUSES)[number];

export const REMINDER_ACTIONS = ['COMPLETE', 'SNOOZE', 'OPEN', 'DISMISS'] as const;
export type ReminderAction = (typeof REMINDER_ACTIONS)[number];

export const COMPANY_REMINDER_KINDS = [
  'CHECK_IN',
  'LUNCH_START',
  'BREAK_END',
  'CHECK_OUT',
  'TIMESHEET',
  'DAILY_REPORT',
  'CUSTOM',
] as const;

export const PROJECT_REMINDER_TEMPLATES = [
  { key: 'CLIENT_CALL', title: 'Client Call', category: 'CALL_REMINDER', offsets: [15] },
  { key: 'WEEKLY_REVIEW', title: 'Weekly Review', category: 'PROJECT', offsets: [60], repeat: 'WEEKLY' },
  { key: 'DEPLOYMENT', title: 'Deployment', category: 'PROJECT', offsets: [1440, 60], priority: 'HIGH' },
  { key: 'CODE_REVIEW', title: 'Code Review', category: 'PROJECT', offsets: [30] },
  { key: 'TESTING', title: 'Testing', category: 'PROJECT', offsets: [60] },
  { key: 'INVOICE_FOLLOWUP', title: 'Invoice Follow-up', category: 'CLIENT_FOLLOWUP', offsets: [1440] },
] as const;

export const PRIORITY_WEIGHT: Record<TaskPriority, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

export type Role = 'SUPER_ADMIN' | 'HR' | 'TEAM_LEAD' | 'EMPLOYEE';

/** Delivery retry backoff (minutes) indexed by attempt number. */
export const RETRY_BACKOFF_MINUTES = [1, 2, 5, 15, 30];

/** Reminders older than this when the scheduler first sees them are marked SKIPPED, not spammed. */
export const STALE_REMINDER_GRACE_MINUTES = 60 * 6;
