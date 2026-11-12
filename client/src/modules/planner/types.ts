export type TaskCategory =
  | 'PERSONAL'
  | 'WORK'
  | 'PROJECT'
  | 'CLIENT_FOLLOWUP'
  | 'MEETING_REMINDER'
  | 'CALL_REMINDER'
  | 'DOCUMENT_REMINDER'
  | 'TRAINING_REMINDER'
  | 'BIRTHDAY_REMINDER'
  | 'ANNIVERSARY_REMINDER'
  | 'CUSTOM';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
export type EffectiveStatus = TaskStatus | 'OVERDUE';
export type RepeatFrequency = 'NEVER' | 'DAILY' | 'WEEKDAYS' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM';
export type RepeatUnit = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

export interface RepeatRule {
  frequency: RepeatFrequency;
  interval?: number;
  unit?: RepeatUnit;
  daysOfWeek?: number[];
  endsAt?: string | null;
  maxOccurrences?: number | null;
  nextOccurrenceAt?: string | null;
  isTemplate?: boolean;
}

export interface PlannerTask {
  id: string;
  title: string;
  description?: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  effectiveStatus: EffectiveStatus;
  isOverdue: boolean;
  ownerId: string;
  assigneeIds: string[];
  projectName?: string | null;
  tags: string[];
  labelIds: string[];
  color?: string | null;
  dueAt?: string | null;
  allDay: boolean;
  timezone: string;
  reminderOffsets: number[];
  customReminderAts: string[];
  estimatedMinutes?: number | null;
  location?: string | null;
  position: number;
  source: string;
  sourceRefId?: string | null;
  seriesId?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  checklistTotal: number;
  checklistDone: number;
  repeat?: RepeatRule | null;
  permissions?: Array<'view' | 'edit' | 'delete' | 'collaborate'>;
  /** Client-only: created/changed while offline and not yet synced. */
  _pending?: boolean;
}

export interface ChecklistItem {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  position: number;
}

export interface TaskComment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface TaskAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  uploadedBy: string;
  createdAt: string;
}

export interface TaskHistory {
  id: string;
  actorId: string;
  action: string;
  field?: string | null;
  fromValue?: string | null;
  toValue?: string | null;
  createdAt: string;
}

export interface TaskReminder {
  id: string;
  kind: string;
  offsetMinutes?: number | null;
  fireAt: string;
  deliverAt: string;
  status: string;
  sentAt?: string | null;
  action?: string | null;
}

export interface Person {
  employeeId: string;
  firstName: string;
  lastName: string;
  department?: string;
  designation?: string;
  profileImageUrl?: string | null;
}

export interface TaskDetail extends PlannerTask {
  checklist: ChecklistItem[];
  comments: TaskComment[];
  attachments: TaskAttachment[];
  history: TaskHistory[];
  reminders: TaskReminder[];
  people: Person[];
}

export interface TaskInput {
  title: string;
  description?: string | null;
  category?: TaskCategory;
  priority?: TaskPriority;
  status?: TaskStatus;
  projectName?: string | null;
  assigneeIds?: string[];
  dueAt?: string | null;
  allDay?: boolean;
  timezone?: string;
  reminderOffsets?: number[];
  customReminderAts?: string[];
  repeat?: RepeatRule | null;
  tags?: string[];
  checklist?: Array<{ title: string; isCompleted?: boolean }>;
  color?: string | null;
  estimatedMinutes?: number | null;
  location?: string | null;
  clientRequestId?: string;
}

export type SmartFilter =
  | 'ALL'
  | 'TODAY'
  | 'TOMORROW'
  | 'THIS_WEEK'
  | 'THIS_MONTH'
  | 'HIGH_PRIORITY'
  | 'OVERDUE'
  | 'COMPLETED'
  | 'ASSIGNED_TO_ME'
  | 'PROJECT'
  | 'MEETING'
  | 'UPCOMING';

export interface ListParams {
  filter?: SmartFilter;
  q?: string;
  status?: string;
  priority?: string;
  category?: string;
  tag?: string;
  project?: string;
  assignee?: string;
  scope?: 'MINE' | 'TEAM' | 'ALL';
}

export interface DashboardData {
  counts: {
    today: number;
    overdue: number;
    upcoming: number;
    completedToday: number;
    highPriority: number;
    meetingsToday: number;
    followUpsToday: number;
  };
  today: PlannerTask[];
  overdue: PlannerTask[];
  upcoming: PlannerTask[];
  highPriority: PlannerTask[];
  followUps: PlannerTask[];
  meetings: Array<{ id: string; title: string; startTime: string; endTime: string; link?: string | null; status: string }>;
}

export interface CalendarEvent {
  id: string;
  type: 'TASK' | 'RECURRING' | 'REMINDER' | 'MEETING' | 'DEADLINE' | 'LEAVE' | 'HOLIDAY' | 'BIRTHDAY' | 'ANNIVERSARY';
  title: string;
  start: string;
  end?: string | null;
  allDay: boolean;
  color?: string | null;
  priority?: string;
  status?: string;
  taskId?: string;
  url?: string;
  meta?: Record<string, unknown>;
}

export interface Preferences {
  timezone: string;
  soundEnabled: boolean;
  sound: string;
  defaultReminderOffsets: number[];
  workingHoursStart: string;
  workingHoursEnd: string;
  workingDays: number[];
  onlyDuringWorkingHours: boolean;
  dndEnabled: boolean;
  dndUntil?: string | null;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  weekendReminders: boolean;
  channelInApp: boolean;
  channelPush: boolean;
  channelBrowser: boolean;
  channelEmail: boolean;
  channelWhatsapp: boolean;
  channelSms: boolean;
  defaultSnoozeMinutes: number;
}

export interface AdminConfig {
  companyTimezone: string;
  defaultReminderOffsets: number[];
  workingHoursStart: string;
  workingHoursEnd: string;
  workingDays: number[];
  notificationSound: string;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  weekendReminders: boolean;
  respectHolidays: boolean;
  meetingReminderOffsets: number[];
  mandatoryCategories: string[];
  maxDeliveryAttempts: number;
}

export interface CompanyReminder {
  id: string;
  title: string;
  message: string;
  kind: string;
  time: string;
  daysOfWeek: number[];
  targetRoles: string[];
  departments: string[];
  mandatory: boolean;
  isActive: boolean;
  actionUrl?: string | null;
}

export interface ReminderEvent {
  reminderId: string;
  notificationId?: string;
  taskId: string | null;
  title: string;
  body: string;
  priority: string;
  dueAt?: string | null;
  kind: string;
  url: string;
  silent?: boolean;
  local?: boolean;
}

export interface ReportData {
  range: { from: string; to: string; scope: string };
  summary: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    overdue: number;
    cancelled: number;
    completionRate: number;
    onTimeRate: number;
    avgCompletionHours: number | null;
    byCategory: Array<{ category: string; total: number; completed: number }>;
    byPriority: Array<{ priority: string; total: number; completed: number }>;
    daily: Array<{ date: string; created: number; completed: number }>;
    perEmployee: Array<{ employeeId: string; name: string; total: number; completed: number; overdue: number; avgCompletionHours: number | null }>;
  };
  overdueTasks: Array<{ id: string; title: string; dueAt: string; priority: string; ownerId: string; ownerName?: string }>;
  history: Array<TaskHistory & { taskId: string; taskTitle?: string; actorName?: string }>;
}
