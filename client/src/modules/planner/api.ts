import api from '../../services/api';
import { matchesFilter, sortTasks } from './lib/filters';
import { OfflineQueue, TaskCache, isTempId, optimisticTask } from './lib/offlineQueue';
import type { OpType, QueuedOp, SyncResult } from './lib/offlineQueue';
import type {
  AdminConfig,
  CalendarEvent,
  ChecklistItem,
  CompanyReminder,
  DashboardData,
  ListParams,
  Person,
  PlannerTask,
  Preferences,
  ReportData,
  TaskAttachment,
  TaskComment,
  TaskDetail,
  TaskInput,
} from './types';

const storage: Storage | null = typeof window !== 'undefined' ? window.localStorage : null;
const memory = new Map<string, string>();
const safeStorage = {
  getItem: (k: string) => (storage ? storage.getItem(k) : memory.get(k) ?? null),
  setItem: (k: string, v: string) => (storage ? storage.setItem(k, v) : void memory.set(k, v)),
  removeItem: (k: string) => (storage ? storage.removeItem(k) : void memory.delete(k)),
};
export const offlineQueue = new OfflineQueue(safeStorage);
export const taskCache = new TaskCache(safeStorage);

const unwrap = <T>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

function myEmployeeId(): string {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}').employeeId || '';
  } catch {
    return '';
  }
}

/** True for "can't reach the server" (offline / DNS / CORS / SW 503 offline) — not for 4xx/5xx app errors. */
export function isNetworkError(err: any): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!err?.response) return true;
  return err.response.status === 503 && err.response.data?.offline === true;
}

export const OFFLINE_EVENT = 'planner:offline-changed';
function emitQueueChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(OFFLINE_EVENT, { detail: { pending: offlineQueue.size() } }));
}

function queue(type: OpType, taskId: string | undefined, payload: Record<string, unknown>) {
  offlineQueue.enqueue({ type, taskId, payload });
  emitQueueChanged();
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then((reg: any) => reg.sync?.register('sync-planner').catch(() => undefined)).catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Tasks (offline-capable)
// ---------------------------------------------------------------------------

export async function fetchTasks(params: ListParams): Promise<PlannerTask[]> {
  try {
    const tasks = await unwrap<PlannerTask[]>(api.get('/planner/tasks', { params: { ...params, limit: 300 } }));
    if (!params.scope || params.scope === 'MINE') taskCache.merge(tasks);
    return tasks;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const me = myEmployeeId();
    return sortTasks(taskCache.read().filter((t) => matchesFilter(t, params, me)));
  }
}

export async function createTask(input: TaskInput): Promise<PlannerTask> {
  try {
    const task = await unwrap<PlannerTask>(api.post('/planner/tasks', input));
    taskCache.upsert(task);
    return task;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const task = optimisticTask(input, myEmployeeId(), tempId);
    taskCache.upsert(task);
    queue('CREATE', tempId, input as unknown as Record<string, unknown>);
    return task;
  }
}

export async function quickAdd(input: { title: string; dueAt?: string | null; priority?: string; category?: string }): Promise<PlannerTask> {
  try {
    const task = await unwrap<PlannerTask>(api.post('/planner/tasks/quick', input));
    taskCache.upsert(task);
    return task;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    return createTask(input as TaskInput);
  }
}

function patchCache(id: string, patch: Partial<PlannerTask>) {
  const current = taskCache.read().find((t) => t.id === id);
  if (current) taskCache.upsert({ ...current, ...patch, _pending: true, updatedAt: new Date().toISOString() });
}

export async function updateTask(id: string, input: Partial<TaskInput> & { position?: number }): Promise<PlannerTask | null> {
  if (isTempId(id)) {
    patchCache(id, input as Partial<PlannerTask>);
    queue('UPDATE', id, input as Record<string, unknown>);
    return null;
  }
  try {
    const task = await unwrap<PlannerTask>(api.patch(`/planner/tasks/${id}`, input));
    taskCache.upsert(task);
    return task;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    patchCache(id, input as Partial<PlannerTask>);
    queue('UPDATE', id, input as Record<string, unknown>);
    return null;
  }
}

export async function moveTask(id: string, status: string, position?: number): Promise<PlannerTask | null> {
  const payload = { status, ...(position !== undefined ? { position } : {}) };
  if (isTempId(id)) {
    patchCache(id, payload as Partial<PlannerTask>);
    queue('UPDATE', id, payload);
    return null;
  }
  try {
    const task = await unwrap<PlannerTask>(api.patch(`/planner/tasks/${id}/move`, payload));
    taskCache.upsert(task);
    return task;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    patchCache(id, payload as Partial<PlannerTask>);
    queue('MOVE', id, payload);
    return null;
  }
}

export const completeTask = (id: string) => moveTask(id, 'COMPLETED');
export const reopenTask = (id: string) => moveTask(id, 'PENDING');
export const archiveTask = (id: string) => moveTask(id, 'ARCHIVED');

export async function deleteTask(id: string): Promise<void> {
  taskCache.remove(id);
  if (isTempId(id)) {
    queue('DELETE', id, {});
    return;
  }
  try {
    await api.delete(`/planner/tasks/${id}`);
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    queue('DELETE', id, {});
  }
}

export async function toggleChecklist(taskId: string, itemId: string, isCompleted: boolean): Promise<ChecklistItem | null> {
  try {
    return await unwrap<ChecklistItem>(api.patch(`/planner/tasks/${taskId}/checklist/${itemId}`, { isCompleted }));
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    queue('CHECKLIST_TOGGLE', taskId, { itemId, isCompleted });
    return null;
  }
}

/** Replays the offline queue. Safe to call often; no-ops when empty or offline. */
let syncing: Promise<unknown> | null = null;
export async function syncOfflineQueue(): Promise<{ synced: number; remaining: number }> {
  if (syncing || offlineQueue.size() === 0 || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return { synced: 0, remaining: offlineQueue.size() };
  }
  const run = offlineQueue.flush(async (ops: QueuedOp[]) => {
    const res = await api.post('/planner/sync', {
      operations: ops.map((o) => ({ opId: o.opId, type: o.type, taskId: o.taskId, payload: o.payload, clientTimestamp: o.clientTimestamp })),
    });
    return res.data.data.results as SyncResult[];
  });
  syncing = run;
  try {
    const result = await run;
    taskCache.replaceIds(result.idMap);
    emitQueueChanged();
    return { synced: result.synced, remaining: result.remaining };
  } finally {
    syncing = null;
  }
}

// ---------------------------------------------------------------------------
// Online-only endpoints
// ---------------------------------------------------------------------------

export const fetchTask = (id: string) => unwrap<TaskDetail>(api.get(`/planner/tasks/${id}`));
export const fetchDashboard = () => unwrap<DashboardData>(api.get('/planner/dashboard'));
export const fetchCalendar = (from: Date, to: Date) =>
  unwrap<CalendarEvent[]>(api.get('/planner/calendar', { params: { from: from.toISOString(), to: to.toISOString() } }));
export const fetchReports = (params: { from?: string; to?: string; scope?: string; employeeId?: string }) =>
  unwrap<ReportData>(api.get('/planner/reports', { params }));
export const downloadReportCsv = async (params: { from?: string; to?: string; scope?: string }) => {
  const res = await api.get('/planner/reports/export.csv', { params, responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `planner-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

export const snoozeTask = (id: string, option: string, reminderId?: string) =>
  unwrap<{ until: string }>(api.post(`/planner/tasks/${id}/snooze`, { option, ...(reminderId ? { reminderId } : {}) }));
export const reminderAction = (reminderId: string, action: 'COMPLETE' | 'SNOOZE' | 'DISMISS' | 'OPEN', snooze?: string) =>
  unwrap<any>(api.post(`/planner/reminders/${reminderId}/action`, { action, snooze }));
export const sendTestReminder = () => unwrap<any>(api.post('/planner/reminders/test'));
export const fetchNotificationHistory = () => unwrap<any[]>(api.get('/planner/notifications'));
export const fetchUpcomingReminders = () => unwrap<any[]>(api.get('/planner/reminders/upcoming'));

export const addChecklistItem = (taskId: string, title: string) => unwrap<ChecklistItem>(api.post(`/planner/tasks/${taskId}/checklist`, { title }));
export const deleteChecklistItem = (taskId: string, itemId: string) => api.delete(`/planner/tasks/${taskId}/checklist/${itemId}`);
export const addComment = (taskId: string, content: string) => unwrap<TaskComment>(api.post(`/planner/tasks/${taskId}/comments`, { content }));
export const deleteComment = (taskId: string, commentId: string) => api.delete(`/planner/tasks/${taskId}/comments/${commentId}`);
export const uploadAttachment = (taskId: string, file: File) => {
  const fd = new FormData();
  fd.append('attachment', file);
  return unwrap<TaskAttachment>(api.post(`/planner/tasks/${taskId}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }));
};
export const addAttachmentLink = (taskId: string, fileName: string, fileUrl: string) =>
  unwrap<TaskAttachment>(api.post(`/planner/tasks/${taskId}/attachments`, { fileName, fileUrl }));
export const deleteAttachment = (taskId: string, attachmentId: string) => api.delete(`/planner/tasks/${taskId}/attachments/${attachmentId}`);

export const fetchPeople = (q?: string) => unwrap<Person[]>(api.get('/planner/people', { params: q ? { q } : {} }));
export const fetchProjects = () => unwrap<string[]>(api.get('/planner/projects'));
export const fetchTags = () => unwrap<Array<{ name: string; count: number }>>(api.get('/planner/tags'));

export const fetchPreferences = () => unwrap<{ preferences: Preferences; company: AdminConfig }>(api.get('/planner/preferences'));
export const savePreferences = (p: Partial<Preferences>) => unwrap<Preferences>(api.put('/planner/preferences', p));

export const fetchAdminSettings = () =>
  unwrap<{ config: AdminConfig; companyReminders: CompanyReminder[]; scheduler: { at: string; result: Record<string, unknown> } | null }>(
    api.get('/planner/admin/settings')
  );
export const saveAdminSettings = (c: Partial<AdminConfig>) => unwrap<AdminConfig>(api.put('/planner/admin/settings', c));
export const createCompanyReminder = (r: Omit<CompanyReminder, 'id'>) => unwrap<CompanyReminder>(api.post('/planner/admin/company-reminders', r));
export const updateCompanyReminder = (id: string, r: Partial<CompanyReminder>) =>
  unwrap<CompanyReminder>(api.patch(`/planner/admin/company-reminders/${id}`, r));
export const deleteCompanyReminder = (id: string) => api.delete(`/planner/admin/company-reminders/${id}`);
export const runScheduler = () => unwrap<any>(api.post('/planner/admin/scheduler/run'));

/** Extracts a readable error message from an axios error. */
export function errorMessage(err: any, fallback = 'Something went wrong'): string {
  const data = err?.response?.data;
  if (data?.errors?.length) return data.errors.map((e: any) => `${e.field ? `${e.field}: ` : ''}${e.message}`).join(' · ');
  return data?.message || err?.message || fallback;
}
