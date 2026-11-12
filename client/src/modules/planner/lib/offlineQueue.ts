/**
 * Offline support for the planner.
 *
 * - Mutations made while offline are queued (persisted) and replayed in order
 *   through POST /planner/sync when connectivity returns.
 * - CREATE operations use the opId as an idempotency key server-side, so a
 *   replay that partially succeeded before a network drop never duplicates.
 * - The last successful task list is cached so the planner (and local
 *   reminders) keep working offline.
 *
 * Storage is injectable so this module is unit-testable with node:test.
 */

import type { PlannerTask } from '../types.ts';

export type OpType = 'CREATE' | 'UPDATE' | 'MOVE' | 'DELETE' | 'CHECKLIST_TOGGLE' | 'COMPLETE';

export interface QueuedOp {
  opId: string;
  type: OpType;
  taskId?: string;
  payload: Record<string, unknown>;
  clientTimestamp: number;
  attempts: number;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SyncResult {
  opId: string;
  ok: boolean;
  taskId?: string;
  status?: number;
  error?: string;
}

const QUEUE_KEY = 'obi_planner_offline_queue_v1';
const CACHE_KEY = 'obi_planner_task_cache_v1';
const MAX_ATTEMPTS = 8;

export function newOpId(): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `op-${rnd}`;
}

export function isTempId(id?: string | null): boolean {
  return !!id && id.startsWith('tmp-');
}

export class OfflineQueue {
  private storage: KeyValueStorage;
  constructor(storage: KeyValueStorage) {
    this.storage = storage;
  }

  read(): QueuedOp[] {
    try {
      const raw = this.storage.getItem(QUEUE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private write(ops: QueuedOp[]) {
    try {
      if (ops.length) this.storage.setItem(QUEUE_KEY, JSON.stringify(ops));
      else this.storage.removeItem(QUEUE_KEY);
    } catch {
      /* storage full / unavailable: keep working in memory */
    }
  }

  size(): number {
    return this.read().length;
  }

  /**
   * Adds an operation, coalescing where it is safe:
   * - repeated UPDATE/MOVE of the same task merge into one
   * - DELETE of a task that was created offline drops both operations
   */
  enqueue(op: Omit<QueuedOp, 'opId' | 'clientTimestamp' | 'attempts'> & { opId?: string }): QueuedOp {
    const ops = this.read();
    const full: QueuedOp = { opId: op.opId || newOpId(), clientTimestamp: Date.now(), attempts: 0, ...op } as QueuedOp;

    if (full.type === 'DELETE' && isTempId(full.taskId)) {
      this.write(ops.filter((o) => o.taskId !== full.taskId));
      return full;
    }
    if (full.type === 'UPDATE' || full.type === 'MOVE') {
      const existing = ops.find((o) => o.taskId === full.taskId && o.type === full.type);
      if (existing) {
        existing.payload = { ...existing.payload, ...full.payload };
        existing.clientTimestamp = full.clientTimestamp;
        this.write(ops);
        return existing;
      }
      // Updating a task that only exists offline: fold the change into its CREATE.
      const create = ops.find((o) => o.type === 'CREATE' && o.taskId === full.taskId);
      if (create && full.type === 'UPDATE') {
        create.payload = { ...create.payload, ...full.payload };
        this.write(ops);
        return create;
      }
    }
    ops.push(full);
    this.write(ops);
    return full;
  }

  /**
   * Sends the queue in one batch. Successful and permanently-failed (4xx) ops are
   * removed; transient failures stay for the next attempt (up to MAX_ATTEMPTS).
   * Returns a map of temporary ids -> server ids for cache reconciliation.
   */
  async flush(send: (ops: QueuedOp[]) => Promise<SyncResult[]>): Promise<{ synced: number; dropped: number; remaining: number; idMap: Map<string, string> }> {
    const ops = this.read();
    const idMap = new Map<string, string>();
    if (!ops.length) return { synced: 0, dropped: 0, remaining: 0, idMap };

    let results: SyncResult[];
    try {
      results = await send(ops);
    } catch {
      this.write(ops.map((o) => ({ ...o, attempts: o.attempts + 1 })).filter((o) => o.attempts < MAX_ATTEMPTS));
      return { synced: 0, dropped: 0, remaining: this.size(), idMap };
    }

    const byId = new Map(results.map((r) => [r.opId, r]));
    let synced = 0;
    let dropped = 0;
    const remaining: QueuedOp[] = [];
    for (const op of ops) {
      const r = byId.get(op.opId);
      if (r?.ok) {
        synced++;
        if (op.type === 'CREATE' && op.taskId && r.taskId) idMap.set(op.taskId, r.taskId);
      } else if (r && r.status && r.status >= 400 && r.status < 500) {
        dropped++;
      } else if (op.attempts + 1 < MAX_ATTEMPTS) {
        remaining.push({ ...op, attempts: op.attempts + 1 });
      } else {
        dropped++;
      }
    }
    this.write(remaining);
    return { synced, dropped, remaining: remaining.length, idMap };
  }
}

export class TaskCache {
  private storage: KeyValueStorage;
  constructor(storage: KeyValueStorage) {
    this.storage = storage;
  }

  read(): PlannerTask[] {
    try {
      const raw = this.storage.getItem(CACHE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed?.tasks) ? parsed.tasks : [];
    } catch {
      return [];
    }
  }

  /** Merges server tasks into the cache (by id), keeping offline-only tasks. */
  merge(tasks: PlannerTask[]) {
    const map = new Map(this.read().map((t) => [t.id, t]));
    for (const t of tasks) map.set(t.id, { ...t, _pending: false });
    this.write(Array.from(map.values()));
  }

  upsert(task: PlannerTask) {
    const list = this.read().filter((t) => t.id !== task.id);
    list.push(task);
    this.write(list);
  }

  remove(id: string) {
    this.write(this.read().filter((t) => t.id !== id));
  }

  replaceIds(idMap: Map<string, string>) {
    if (!idMap.size) return;
    this.write(this.read().filter((t) => !idMap.has(t.id)));
  }

  private write(tasks: PlannerTask[]) {
    try {
      // Bounded: keep the most relevant 1000 tasks (upcoming first).
      const trimmed = tasks.slice(-1000);
      this.storage.setItem(CACHE_KEY, JSON.stringify({ tasks: trimmed, at: Date.now() }));
    } catch {
      /* ignore quota errors */
    }
  }
}

/** Builds an optimistic task for something created offline. */
export function optimisticTask(input: Record<string, any>, ownerId: string, tempId: string): PlannerTask {
  const now = new Date().toISOString();
  return {
    id: tempId,
    title: String(input.title || 'Untitled'),
    description: input.description ?? null,
    category: input.category || 'WORK',
    priority: input.priority || 'MEDIUM',
    status: input.status || 'PENDING',
    effectiveStatus: input.status || 'PENDING',
    isOverdue: false,
    ownerId,
    assigneeIds: input.assigneeIds || [],
    projectName: input.projectName ?? null,
    tags: input.tags || [],
    labelIds: [],
    color: input.color ?? null,
    dueAt: input.dueAt ?? null,
    allDay: !!input.allDay,
    timezone: input.timezone || 'Asia/Kolkata',
    reminderOffsets: input.reminderOffsets || [],
    customReminderAts: input.customReminderAts || [],
    estimatedMinutes: input.estimatedMinutes ?? null,
    location: input.location ?? null,
    position: Date.now(),
    source: 'MANUAL',
    createdAt: now,
    updatedAt: now,
    checklistTotal: (input.checklist || []).length,
    checklistDone: 0,
    repeat: input.repeat ?? null,
    permissions: ['view', 'edit', 'delete', 'collaborate'],
    _pending: true,
  };
}
