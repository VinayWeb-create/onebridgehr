import { Role } from './constants';

/**
 * Planner RBAC policy (pure, unit-tested).
 *
 * - Owners have full control of their tasks.
 * - Assignees (tasks shared with them) can view, change status, tick the
 *   checklist, comment, attach and snooze their own reminders.
 * - TEAM_LEAD can *view* non-personal tasks of employees in their department.
 * - HR / SUPER_ADMIN can *view* every non-personal task and manage company config.
 * - PERSONAL tasks are never visible to anyone but the owner and assignees.
 */

export interface Viewer {
  employeeId: string;
  role: Role | string;
  department?: string | null;
}

export interface TaskAccessSubject {
  ownerId: string;
  assigneeIds: string[];
  category: string;
  /** Departments of the owner and assignees (lower-cased by the caller or here). */
  departments?: Array<string | null | undefined>;
}

export type TaskPermission = 'view' | 'edit' | 'delete' | 'collaborate';

const norm = (s?: string | null) => (s || '').trim().toLowerCase();

export function isAdminRole(role: string): boolean {
  return role === 'SUPER_ADMIN' || role === 'HR';
}

export function isManagerRole(role: string): boolean {
  return isAdminRole(role) || role === 'TEAM_LEAD';
}

export function getTaskPermissions(viewer: Viewer, task: TaskAccessSubject): Set<TaskPermission> {
  const perms = new Set<TaskPermission>();
  const isOwner = task.ownerId === viewer.employeeId;
  const isAssignee = task.assigneeIds.includes(viewer.employeeId);

  if (isOwner) {
    perms.add('view').add('edit').add('delete').add('collaborate');
    return perms;
  }
  if (isAssignee) {
    perms.add('view').add('collaborate');
    return perms;
  }
  if (task.category === 'PERSONAL') return perms;

  if (isAdminRole(viewer.role)) {
    perms.add('view');
  } else if (viewer.role === 'TEAM_LEAD' && viewer.department) {
    const dept = norm(viewer.department);
    if ((task.departments || []).some((d) => norm(d) === dept)) perms.add('view');
  }
  return perms;
}

export function can(viewer: Viewer, task: TaskAccessSubject, perm: TaskPermission): boolean {
  return getTaskPermissions(viewer, task).has(perm);
}

/**
 * Who may a viewer assign/share a task with?
 * - HR / SUPER_ADMIN: anyone
 * - TEAM_LEAD / EMPLOYEE: themselves and colleagues in their own department
 */
export function canAssignTo(
  viewer: Viewer,
  target: { employeeId: string; department?: string | null }
): boolean {
  if (target.employeeId === viewer.employeeId) return true;
  if (isAdminRole(viewer.role)) return true;
  return !!viewer.department && norm(viewer.department) === norm(target.department);
}

/** Which fields an assignee (collaborator without edit rights) may change. */
export const COLLABORATOR_FIELDS = new Set(['status', 'position']);
