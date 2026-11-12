import { prisma } from '../../../config/db';

export interface HistoryEntry {
  taskId: string;
  actorId: string;
  action: string;
  field?: string;
  fromValue?: unknown;
  toValue?: unknown;
  meta?: Record<string, unknown>;
}

const toText = (v: unknown): string | undefined => {
  if (v === undefined) return undefined;
  if (v === null) return 'null';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 1000);
  return String(v).slice(0, 1000);
};

/** History writes are best-effort: a failed audit row must never fail the user's action. */
export async function recordHistory(entries: HistoryEntry | HistoryEntry[]) {
  const list = Array.isArray(entries) ? entries : [entries];
  if (!list.length) return;
  try {
    await prisma.plannerTaskHistory.createMany({
      data: list.map((e) => ({
        taskId: e.taskId,
        actorId: e.actorId,
        action: e.action,
        field: e.field,
        fromValue: toText(e.fromValue),
        toValue: toText(e.toValue),
        meta: (e.meta as any) ?? undefined,
      })),
    });
  } catch (err: any) {
    console.warn('[Planner:History] Failed to record history:', err?.message || err);
  }
}

const TRACKED_FIELDS = [
  'title',
  'description',
  'category',
  'priority',
  'status',
  'projectName',
  'assigneeIds',
  'dueAt',
  'reminderOffsets',
  'tags',
  'color',
  'estimatedMinutes',
  'location',
] as const;

export function diffForHistory(taskId: string, actorId: string, before: Record<string, any>, after: Record<string, any>): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  for (const field of TRACKED_FIELDS) {
    if (!(field in after)) continue;
    const a = toText(before[field] ?? null);
    const b = toText(after[field] ?? null);
    if (a === b) continue;
    out.push({
      taskId,
      actorId,
      action: field === 'status' ? 'STATUS_CHANGED' : field === 'assigneeIds' ? 'ASSIGNED' : 'UPDATED',
      field,
      fromValue: before[field] ?? null,
      toValue: after[field] ?? null,
    });
  }
  return out;
}
