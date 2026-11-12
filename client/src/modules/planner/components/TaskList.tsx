import React, { useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import TaskCard from './TaskCard';
import { addDays, isSameDay, startOfDay } from '../lib/time';
import type { PlannerTask } from '../types';

interface Props {
  tasks: PlannerTask[];
  onOpen: (t: PlannerTask) => void;
  onToggleComplete: (t: PlannerTask) => void;
}

/** Agenda-style list grouped into Overdue / Today / Tomorrow / This week / Later / No date / Done. */
export const TaskList: React.FC<Props> = ({ tasks, onOpen, onToggleComplete }) => {
  const groups = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const weekEnd = addDays(today, 7);
    const buckets: Array<{ key: string; label: string; items: PlannerTask[] }> = [
      { key: 'overdue', label: '⚠️ Overdue', items: [] },
      { key: 'today', label: 'Today', items: [] },
      { key: 'tomorrow', label: 'Tomorrow', items: [] },
      { key: 'week', label: 'Next 7 days', items: [] },
      { key: 'later', label: 'Later', items: [] },
      { key: 'nodate', label: 'No due date', items: [] },
      { key: 'done', label: 'Completed & closed', items: [] },
    ];
    const get = (k: string) => buckets.find((b) => b.key === k)!.items;
    for (const t of tasks) {
      if (['COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(t.status)) get('done').push(t);
      else if (t.isOverdue) get('overdue').push(t);
      else if (!t.dueAt) get('nodate').push(t);
      else {
        const d = new Date(t.dueAt);
        if (isSameDay(d, today)) get('today').push(t);
        else if (isSameDay(d, addDays(today, 1))) get('tomorrow').push(t);
        else if (d < weekEnd) get('week').push(t);
        else get('later').push(t);
      }
    }
    return buckets.filter((b) => b.items.length);
  }, [tasks]);

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.key} aria-label={g.label}>
          <h3 className={`mb-2.5 text-[11px] font-black uppercase tracking-widest ${g.key === 'overdue' ? 'text-rose-500' : 'text-brand-500'}`}>
            {g.label} <span className="text-brand-400">· {g.items.length}</span>
          </h3>
          <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence initial={false}>
              {g.items.map((t) => (
                <TaskCard key={t.id} task={t} onOpen={onOpen} onToggleComplete={onToggleComplete} />
              ))}
            </AnimatePresence>
          </div>
        </section>
      ))}
    </div>
  );
};

export default TaskList;
