import { z } from 'zod';
import {
  COMPANY_REMINDER_KINDS,
  REPEAT_FREQUENCIES,
  REPEAT_UNITS,
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from './constants';
import { isValidTimezone } from './timezone';

const hhmm = z.string().regex(/^([01]?\d|2[0-3]):([0-5]\d)$/, 'Expected HH:mm');
const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), 'Invalid date')
  .transform((v) => new Date(v));
const timezone = z.string().refine((v) => isValidTimezone(v), 'Unknown timezone');
const offsets = z.array(z.number().int().min(0).max(60 * 24 * 30)).max(10);
const weekdays = z.array(z.number().int().min(0).max(6)).max(7);

export const repeatSchema = z
  .object({
    frequency: z.enum(REPEAT_FREQUENCIES),
    interval: z.number().int().min(1).max(365).default(1),
    unit: z.enum(REPEAT_UNITS).default('DAY'),
    daysOfWeek: weekdays.default([]),
    endsAt: isoDate.nullable().optional(),
    maxOccurrences: z.number().int().min(1).max(1000).nullable().optional(),
  })
  .strict();

const checklistItemInput = z.object({ title: z.string().trim().min(1).max(300), isCompleted: z.boolean().optional() });

const taskFields = {
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().max(10_000).nullable().optional(),
  category: z.enum(TASK_CATEGORIES).default('WORK'),
  priority: z.enum(TASK_PRIORITIES).default('MEDIUM'),
  status: z.enum(TASK_STATUSES).optional(),
  projectName: z.string().trim().max(150).nullable().optional(),
  assigneeIds: z.array(z.string().trim().min(1).max(50)).max(50).default([]),
  dueAt: isoDate.nullable().optional(),
  allDay: z.boolean().default(false),
  timezone: timezone.optional(),
  reminderOffsets: offsets.optional(),
  customReminderAts: z.array(isoDate).max(10).default([]),
  repeat: repeatSchema.nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  labelIds: z.array(z.string()).max(20).default([]),
  checklist: z.array(checklistItemInput).max(100).default([]),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  estimatedMinutes: z.number().int().min(1).max(60 * 24 * 30).nullable().optional(),
  location: z.string().trim().max(300).nullable().optional(),
  clientRequestId: z.string().max(100).optional(),
  source: z.enum(['MANUAL', 'QUICK_ADD']).default('MANUAL'),
};

export const createTaskSchema = z.object(taskFields).strict();
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z
  .object({
    ...taskFields,
    category: taskFields.category.optional(),
    priority: taskFields.priority.optional(),
    assigneeIds: taskFields.assigneeIds.optional(),
    allDay: taskFields.allDay.optional(),
    customReminderAts: taskFields.customReminderAts.optional(),
    tags: taskFields.tags.optional(),
    labelIds: taskFields.labelIds.optional(),
    checklist: z.undefined().optional(),
    source: z.undefined().optional(),
    position: z.number().optional(),
    title: taskFields.title.optional(),
  })
  .strict();
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const moveTaskSchema = z.object({ status: z.enum(TASK_STATUSES), position: z.number().optional() }).strict();

export const quickAddSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    dueAt: isoDate.nullable().optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    category: z.enum(TASK_CATEGORIES).optional(),
    clientRequestId: z.string().max(100).optional(),
  })
  .strict();

export const listQuerySchema = z.object({
  filter: z
    .enum([
      'ALL',
      'TODAY',
      'TOMORROW',
      'THIS_WEEK',
      'THIS_MONTH',
      'HIGH_PRIORITY',
      'OVERDUE',
      'COMPLETED',
      'ASSIGNED_TO_ME',
      'PROJECT',
      'MEETING',
      'UPCOMING',
    ])
    .default('ALL'),
  q: z.string().max(200).optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  category: z.string().optional(),
  tag: z.string().max(40).optional(),
  project: z.string().max(150).optional(),
  assignee: z.string().max(50).optional(),
  scope: z.enum(['MINE', 'TEAM', 'ALL']).default('MINE'),
  includeArchived: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export const checklistCreateSchema = checklistItemInput.strict();
export const checklistUpdateSchema = z
  .object({ title: z.string().trim().min(1).max(300).optional(), isCompleted: z.boolean().optional(), position: z.number().int().optional() })
  .strict();
export const commentSchema = z.object({ content: z.string().trim().min(1).max(5000) }).strict();
export const attachmentLinkSchema = z
  .object({ fileName: z.string().trim().min(1).max(255), fileUrl: z.string().url().max(2000), mimeType: z.string().max(100).optional() })
  .strict();

export const snoozeSchema = z
  .object({
    option: z.union([z.enum(['5', '10', '15', '30', '60', 'TOMORROW']), z.string().datetime({ offset: true }), z.number().int().min(1).max(43200)]),
    reminderId: z.string().optional(),
  })
  .strict();

export const reminderActionSchema = z
  .object({
    token: z.string().min(10),
    action: z.enum(['COMPLETE', 'SNOOZE', 'DISMISS', 'OPEN']),
    snooze: z.union([z.string(), z.number()]).optional(),
  })
  .strict();

export const preferencesSchema = z
  .object({
    timezone: timezone.optional(),
    soundEnabled: z.boolean().optional(),
    sound: z.string().max(40).optional(),
    defaultReminderOffsets: offsets.optional(),
    workingHoursStart: hhmm.optional(),
    workingHoursEnd: hhmm.optional(),
    workingDays: weekdays.optional(),
    onlyDuringWorkingHours: z.boolean().optional(),
    dndEnabled: z.boolean().optional(),
    dndUntil: isoDate.nullable().optional(),
    quietHoursEnabled: z.boolean().optional(),
    quietHoursStart: hhmm.optional(),
    quietHoursEnd: hhmm.optional(),
    weekendReminders: z.boolean().optional(),
    channelInApp: z.boolean().optional(),
    channelPush: z.boolean().optional(),
    channelBrowser: z.boolean().optional(),
    channelEmail: z.boolean().optional(),
    channelWhatsapp: z.boolean().optional(),
    channelSms: z.boolean().optional(),
    defaultSnoozeMinutes: z.number().int().min(1).max(1440).optional(),
  })
  .strict();

export const adminConfigSchema = z
  .object({
    companyTimezone: timezone.optional(),
    defaultReminderOffsets: offsets.optional(),
    workingHoursStart: hhmm.optional(),
    workingHoursEnd: hhmm.optional(),
    workingDays: weekdays.optional(),
    notificationSound: z.string().max(40).optional(),
    quietHoursEnabled: z.boolean().optional(),
    quietHoursStart: hhmm.optional(),
    quietHoursEnd: hhmm.optional(),
    weekendReminders: z.boolean().optional(),
    respectHolidays: z.boolean().optional(),
    meetingReminderOffsets: offsets.optional(),
    mandatoryCategories: z.array(z.enum(TASK_CATEGORIES)).optional(),
    maxDeliveryAttempts: z.number().int().min(1).max(10).optional(),
  })
  .strict();

export const companyReminderSchema = z
  .object({
    title: z.string().trim().min(1).max(150),
    message: z.string().trim().min(1).max(500),
    kind: z.enum(COMPANY_REMINDER_KINDS).default('CUSTOM'),
    time: hhmm,
    daysOfWeek: weekdays.default([1, 2, 3, 4, 5, 6]),
    targetRoles: z.array(z.enum(['SUPER_ADMIN', 'HR', 'TEAM_LEAD', 'EMPLOYEE'])).default([]),
    departments: z.array(z.string().max(100)).default([]),
    mandatory: z.boolean().default(false),
    isActive: z.boolean().default(true),
    actionUrl: z.string().max(300).nullable().optional(),
  })
  .strict();

export const labelSchema = z
  .object({ name: z.string().trim().min(1).max(40), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() })
  .strict();

export const rangeQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  scope: z.enum(['MINE', 'TEAM', 'ALL']).default('MINE'),
  employeeId: z.string().max(50).optional(),
});

export const syncBatchSchema = z
  .object({
    operations: z
      .array(
        z.object({
          opId: z.string().min(1).max(100),
          type: z.enum(['CREATE', 'UPDATE', 'MOVE', 'DELETE', 'CHECKLIST_TOGGLE', 'COMPLETE']),
          taskId: z.string().optional(),
          payload: z.record(z.any()).default({}),
          clientTimestamp: z.number().optional(),
        })
      )
      .max(200),
  })
  .strict();
