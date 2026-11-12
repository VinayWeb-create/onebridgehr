import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as plannerApi from './api';
import { OFFLINE_EVENT, offlineQueue } from './api';
import type { ListParams, PlannerTask, TaskInput } from './types';

export const plannerKeys = {
  all: ['planner'] as const,
  tasks: (p: ListParams) => ['planner', 'tasks', p] as const,
  task: (id: string) => ['planner', 'task', id] as const,
  dashboard: ['planner', 'dashboard'] as const,
  calendar: (from: string, to: string) => ['planner', 'calendar', from, to] as const,
  reports: (p: Record<string, unknown>) => ['planner', 'reports', p] as const,
  prefs: ['planner', 'prefs'] as const,
  admin: ['planner', 'admin'] as const,
};

export function useTasks(params: ListParams) {
  return useQuery({ queryKey: plannerKeys.tasks(params), queryFn: () => plannerApi.fetchTasks(params), staleTime: 15_000 });
}

export function useTaskDetail(id: string | null) {
  return useQuery({ queryKey: plannerKeys.task(id || ''), queryFn: () => plannerApi.fetchTask(id!), enabled: !!id && !id.startsWith('tmp-') });
}

export function useDashboard() {
  return useQuery({ queryKey: plannerKeys.dashboard, queryFn: plannerApi.fetchDashboard, staleTime: 30_000, refetchInterval: 60_000 });
}

export function usePreferences() {
  return useQuery({ queryKey: plannerKeys.prefs, queryFn: plannerApi.fetchPreferences, staleTime: 5 * 60_000 });
}

/** Invalidate every planner query (tasks, dashboard, calendar, detail). */
export function useInvalidatePlanner() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: plannerKeys.all });
}

/**
 * Task mutations with optimistic list updates: the board/list changes instantly,
 * and is reconciled with the server response (or the offline queue) afterwards.
 */
export function useTaskMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: plannerKeys.all });

  const patchLists = (id: string, patch: Partial<PlannerTask>) => {
    qc.setQueriesData<PlannerTask[]>({ queryKey: ['planner', 'tasks'] }, (old) =>
      Array.isArray(old) ? old.map((t) => (t.id === id ? { ...t, ...patch } : t)) : old
    );
  };

  const create = useMutation({ mutationFn: (input: TaskInput) => plannerApi.createTask(input), onSettled: invalidate });
  const quick = useMutation({ mutationFn: plannerApi.quickAdd, onSettled: invalidate });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<TaskInput> & { position?: number } }) => plannerApi.updateTask(id, input),
    onMutate: ({ id, input }) => patchLists(id, input as Partial<PlannerTask>),
    onSettled: invalidate,
  });
  const move = useMutation({
    mutationFn: ({ id, status, position }: { id: string; status: string; position?: number }) => plannerApi.moveTask(id, status, position),
    onMutate: ({ id, status, position }) =>
      patchLists(id, { status: status as PlannerTask['status'], effectiveStatus: status as PlannerTask['status'], ...(position !== undefined ? { position } : {}) }),
    onSettled: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => plannerApi.deleteTask(id),
    onMutate: (id) => {
      qc.setQueriesData<PlannerTask[]>({ queryKey: ['planner', 'tasks'] }, (old) => (Array.isArray(old) ? old.filter((t) => t.id !== id) : old));
    },
    onSettled: invalidate,
  });
  const snooze = useMutation({
    mutationFn: ({ id, option, reminderId }: { id: string; option: string; reminderId?: string }) => plannerApi.snoozeTask(id, option, reminderId),
    onSettled: invalidate,
  });
  return { create, quick, update, move, remove, snooze, invalidate };
}

/** Online status + number of operations waiting to sync. */
export function useOfflineStatus() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [pending, setPending] = useState(offlineQueue.size());
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    const changed = () => setPending(offlineQueue.size());
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    window.addEventListener(OFFLINE_EVENT, changed);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
      window.removeEventListener(OFFLINE_EVENT, changed);
    };
  }, []);
  return { online, pending };
}
