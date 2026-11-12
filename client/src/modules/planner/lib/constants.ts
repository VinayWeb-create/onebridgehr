import type { SmartFilter, TaskCategory, TaskPriority, TaskStatus } from '../types.ts';

export const CATEGORY_META: Record<TaskCategory, { label: string; emoji: string }> = {
  PERSONAL: { label: 'Personal', emoji: '🏠' },
  WORK: { label: 'Work', emoji: '💼' },
  PROJECT: { label: 'Project', emoji: '🚀' },
  CLIENT_FOLLOWUP: { label: 'Client Follow-up', emoji: '🤝' },
  MEETING_REMINDER: { label: 'Meeting', emoji: '📅' },
  CALL_REMINDER: { label: 'Call', emoji: '📞' },
  DOCUMENT_REMINDER: { label: 'Document', emoji: '📄' },
  TRAINING_REMINDER: { label: 'Training', emoji: '🎓' },
  BIRTHDAY_REMINDER: { label: 'Birthday', emoji: '🎂' },
  ANNIVERSARY_REMINDER: { label: 'Anniversary', emoji: '🎉' },
  CUSTOM: { label: 'Custom', emoji: '✨' },
};
export const CATEGORIES = Object.keys(CATEGORY_META) as TaskCategory[];

export const PRIORITY_META: Record<TaskPriority, { label: string; badge: string; dot: string; weight: number }> = {
  LOW: { label: 'Low', badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-500', weight: 0 },
  MEDIUM: { label: 'Medium', badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25', dot: 'bg-sky-500', weight: 1 },
  HIGH: { label: 'High', badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25', dot: 'bg-orange-500', weight: 2 },
  CRITICAL: { label: 'Critical', badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30', dot: 'bg-rose-500', weight: 3 },
};
export const PRIORITIES = Object.keys(PRIORITY_META) as TaskPriority[];

export const STATUS_META: Record<TaskStatus | 'OVERDUE', { label: string; badge: string }> = {
  PENDING: { label: 'Pending', badge: 'bg-brand-500/10 text-brand-600 dark:text-brand-300 border-brand-500/20' },
  IN_PROGRESS: { label: 'In Progress', badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/25' },
  REVIEW: { label: 'Review', badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/25' },
  COMPLETED: { label: 'Completed', badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25' },
  CANCELLED: { label: 'Cancelled', badge: 'bg-brand-500/10 text-brand-400 border-brand-500/20 line-through' },
  ARCHIVED: { label: 'Archived', badge: 'bg-brand-500/10 text-brand-400 border-brand-500/20' },
  OVERDUE: { label: 'Overdue', badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30' },
};

export const KANBAN_COLUMNS: Array<{ status: TaskStatus; label: string; accent: string }> = [
  { status: 'PENDING', label: 'Pending', accent: 'from-slate-400 to-slate-500' },
  { status: 'IN_PROGRESS', label: 'In Progress', accent: 'from-indigo-500 to-sky-500' },
  { status: 'REVIEW', label: 'Review', accent: 'from-purple-500 to-fuchsia-500' },
  { status: 'COMPLETED', label: 'Completed', accent: 'from-emerald-500 to-teal-500' },
];

export const SMART_FILTERS: Array<{ key: SmartFilter; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'TODAY', label: 'Today' },
  { key: 'TOMORROW', label: 'Tomorrow' },
  { key: 'THIS_WEEK', label: 'This Week' },
  { key: 'THIS_MONTH', label: 'This Month' },
  { key: 'HIGH_PRIORITY', label: 'High Priority' },
  { key: 'OVERDUE', label: 'Overdue' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'ASSIGNED_TO_ME', label: 'Assigned to me' },
  { key: 'PROJECT', label: 'Project Tasks' },
  { key: 'MEETING', label: 'Meeting Tasks' },
];

export const REMINDER_OPTIONS: Array<{ minutes: number; label: string }> = [
  { minutes: 0, label: 'At due time' },
  { minutes: 5, label: '5 min before' },
  { minutes: 10, label: '10 min before' },
  { minutes: 15, label: '15 min before' },
  { minutes: 30, label: '30 min before' },
  { minutes: 60, label: '1 hour before' },
  { minutes: 120, label: '2 hours before' },
  { minutes: 1440, label: '1 day before' },
];

export const SNOOZE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '5', label: '5 min' },
  { value: '10', label: '10 min' },
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
  { value: '60', label: '1 hour' },
  { value: 'TOMORROW', label: 'Tomorrow' },
];

export const REPEAT_OPTIONS = [
  { value: 'NEVER', label: 'Never' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKDAYS', label: 'Weekdays (Mon–Fri)' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly' },
  { value: 'CUSTOM', label: 'Custom interval' },
] as const;

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const TASK_COLORS = ['#6366f1', '#f97316', '#10b981', '#0ea5e9', '#ec4899', '#8b5cf6', '#f43f5e', '#eab308', '#64748b'];

export const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Australia/Sydney',
  'UTC',
];

export function reminderLabel(minutes: number): string {
  const preset = REMINDER_OPTIONS.find((o) => o.minutes === minutes);
  if (preset) return preset.label;
  if (minutes % 1440 === 0) return `${minutes / 1440} days before`;
  if (minutes % 60 === 0) return `${minutes / 60} hours before`;
  return `${minutes} min before`;
}
