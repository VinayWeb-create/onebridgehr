import React from 'react';
import { CATEGORY_META, PRIORITY_META, STATUS_META } from '../lib/constants';
import type { EffectiveStatus, TaskCategory, TaskPriority } from '../types';

const pill = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wider whitespace-nowrap';

export const PriorityBadge: React.FC<{ priority: TaskPriority; compact?: boolean }> = ({ priority, compact }) => {
  const m = PRIORITY_META[priority] || PRIORITY_META.MEDIUM;
  return (
    <span className={`${pill} ${m.badge}`} title={`${m.label} priority`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot} ${priority === 'CRITICAL' ? 'animate-pulse' : ''}`} />
      {!compact && m.label}
    </span>
  );
};

export const StatusBadge: React.FC<{ status: EffectiveStatus }> = ({ status }) => {
  const m = STATUS_META[status] || STATUS_META.PENDING;
  return <span className={`${pill} ${m.badge}`}>{m.label}</span>;
};

export const CategoryChip: React.FC<{ category: TaskCategory }> = ({ category }) => {
  const m = CATEGORY_META[category] || CATEGORY_META.CUSTOM;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-brand-100 dark:bg-brand-900/70 text-[10px] font-bold text-brand-600 dark:text-brand-300 whitespace-nowrap">
      <span aria-hidden>{m.emoji}</span>
      {m.label}
    </span>
  );
};

export const ProgressRing: React.FC<{ done: number; total: number; size?: number }> = ({ done, total, size = 22 }) => {
  if (!total) return null;
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  const pct = done / total;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-500" title={`${done}/${total} checklist items`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={3} className="stroke-brand-200 dark:stroke-brand-800" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={pct === 1 ? 'stroke-emerald-500' : 'stroke-indigo-500'}
        />
      </svg>
      {done}/{total}
    </span>
  );
};
