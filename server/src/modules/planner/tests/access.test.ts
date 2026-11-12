import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can, canAssignTo, getTaskPermissions } from '../domain/access';

const task = (over: Partial<Parameters<typeof can>[1]> = {}) => ({
  ownerId: 'E1',
  assigneeIds: ['E2'],
  category: 'WORK',
  departments: ['Engineering', 'Engineering'],
  ...over,
});

test('owner has full control', () => {
  assert.deepEqual([...getTaskPermissions({ employeeId: 'E1', role: 'EMPLOYEE' }, task())].sort(), ['collaborate', 'delete', 'edit', 'view']);
});

test('assignee can view and collaborate but not edit or delete', () => {
  const v = { employeeId: 'E2', role: 'EMPLOYEE' };
  assert.equal(can(v, task(), 'view'), true);
  assert.equal(can(v, task(), 'collaborate'), true);
  assert.equal(can(v, task(), 'edit'), false);
  assert.equal(can(v, task(), 'delete'), false);
});

test('unrelated employee sees nothing', () => {
  assert.equal(getTaskPermissions({ employeeId: 'E9', role: 'EMPLOYEE', department: 'Engineering' }, task()).size, 0);
});

test('team lead can view team tasks in own department only (read-only)', () => {
  const lead = { employeeId: 'L1', role: 'TEAM_LEAD', department: ' engineering ' };
  assert.equal(can(lead, task(), 'view'), true);
  assert.equal(can(lead, task(), 'edit'), false);
  assert.equal(can({ ...lead, department: 'Sales' }, task(), 'view'), false);
});

test('HR / Super Admin can view all non-personal tasks', () => {
  assert.equal(can({ employeeId: 'H1', role: 'HR' }, task({ departments: ['Sales'] }), 'view'), true);
  assert.equal(can({ employeeId: 'A1', role: 'SUPER_ADMIN' }, task(), 'edit'), false);
});

test('personal tasks stay private even from admins and leads', () => {
  const personal = task({ category: 'PERSONAL' });
  assert.equal(can({ employeeId: 'A1', role: 'SUPER_ADMIN' }, personal, 'view'), false);
  assert.equal(can({ employeeId: 'L1', role: 'TEAM_LEAD', department: 'Engineering' }, personal, 'view'), false);
  assert.equal(can({ employeeId: 'E2', role: 'EMPLOYEE' }, personal, 'view'), true); // shared explicitly
});

test('assignment rules', () => {
  const emp = { employeeId: 'E1', role: 'EMPLOYEE', department: 'Engineering' };
  assert.equal(canAssignTo(emp, { employeeId: 'E1' }), true);
  assert.equal(canAssignTo(emp, { employeeId: 'E2', department: 'engineering' }), true);
  assert.equal(canAssignTo(emp, { employeeId: 'E3', department: 'Sales' }), false);
  assert.equal(canAssignTo({ employeeId: 'H1', role: 'HR', department: 'HR' }, { employeeId: 'E3', department: 'Sales' }), true);
  assert.equal(canAssignTo({ employeeId: 'X', role: 'EMPLOYEE', department: null }, { employeeId: 'E3', department: null }), false);
});
