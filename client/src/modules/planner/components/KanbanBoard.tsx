import React, { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { KANBAN_COLUMNS } from '../lib/constants';
import { positionBetween, sortByPosition } from '../lib/filters';
import TaskCard from './TaskCard';
import type { PlannerTask, TaskStatus } from '../types';

interface Props {
  tasks: PlannerTask[];
  onOpen: (t: PlannerTask) => void;
  onToggleComplete: (t: PlannerTask) => void;
  onMove: (t: PlannerTask, status: TaskStatus, position: number) => void;
  onAdd: (status: TaskStatus) => void;
}

/**
 * Drag & drop Kanban (native HTML5 DnD on desktop). On touch devices columns
 * scroll horizontally and cards are moved from the task drawer's status menu.
 * Drop position uses fractional indexing so only the moved card is updated.
 */
export const KanbanBoard: React.FC<Props> = ({ tasks, onOpen, onToggleComplete, onMove, onAdd }) => {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ status: TaskStatus; index: number } | null>(null);

  const columns = useMemo(() => {
    const map = new Map<TaskStatus, PlannerTask[]>(KANBAN_COLUMNS.map((c) => [c.status, []]));
    for (const t of tasks) map.get(t.status)?.push(t);
    for (const [k, v] of map) map.set(k, sortByPosition(v));
    return map;
  }, [tasks]);

  const handleDrop = (status: TaskStatus) => {
    const task = tasks.find((t) => t.id === dragId);
    setDragId(null);
    const target = over;
    setOver(null);
    if (!task || !target) return;
    const list = (columns.get(status) || []).filter((t) => t.id !== task.id);
    const index = Math.min(target.index, list.length);
    const position = positionBetween(list[index - 1]?.position, list[index]?.position);
    if (task.status === status && Math.abs(task.position - position) < 1e-9) return;
    onMove(task, status, position);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory -mx-1 px-1" role="list" aria-label="Kanban board">
      {KANBAN_COLUMNS.map((col) => {
        const list = columns.get(col.status) || [];
        const isOver = over?.status === col.status && !!dragId;
        return (
          <section
            key={col.status}
            role="listitem"
            aria-label={`${col.label} column`}
            className={`snap-start shrink-0 w-[85vw] sm:w-80 lg:flex-1 lg:min-w-[260px] rounded-3xl p-3 transition-colors ${
              isOver ? 'bg-indigo-500/10 ring-2 ring-indigo-500/40' : 'bg-brand-100/60 dark:bg-brand-900/30'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              // Compute insertion index from the cursor position over the cards.
              const cards = Array.from((e.currentTarget as HTMLElement).querySelectorAll('[data-card]'));
              let index = cards.length;
              for (let i = 0; i < cards.length; i++) {
                const r = cards[i].getBoundingClientRect();
                if (e.clientY < r.top + r.height / 2) {
                  index = i;
                  break;
                }
              }
              if (over?.status !== col.status || over.index !== index) setOver({ status: col.status, index });
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(col.status);
            }}
          >
            <header className="flex items-center justify-between px-1.5 pb-3">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${col.accent}`} />
                <h3 className="text-xs font-black uppercase tracking-wider text-brand-700 dark:text-brand-200">{col.label}</h3>
                <span className="text-[10px] font-black text-brand-400 bg-white/70 dark:bg-brand-900 px-1.5 py-0.5 rounded-md">{list.length}</span>
              </div>
              <button onClick={() => onAdd(col.status)} className="p-1.5 rounded-lg text-brand-500 hover:bg-white dark:hover:bg-brand-900 cursor-pointer" aria-label={`Add task to ${col.label}`}>
                <Plus size={15} />
              </button>
            </header>
            <div className="space-y-2.5 min-h-[120px]">
              <AnimatePresence initial={false}>
                {list.map((t, i) => (
                  <div key={t.id} data-card>
                    {isOver && over?.index === i && <div className="h-1 rounded-full bg-indigo-500 mb-2" />}
                    <div className={dragId === t.id ? 'opacity-40' : ''}>
                      <TaskCard
                        task={t}
                        onOpen={onOpen}
                        onToggleComplete={onToggleComplete}
                        draggable={!t.permissions || t.permissions.includes('collaborate')}
                        onDragStart={(e, task) => {
                          setDragId(task.id);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', task.id);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </AnimatePresence>
              {isOver && over?.index === list.length && <div className="h-1 rounded-full bg-indigo-500" />}
              {list.length === 0 && !isOver && (
                <p className="text-center text-[11px] font-semibold text-brand-400 py-8 border-2 border-dashed border-brand-200 dark:border-brand-800 rounded-2xl">Drop tasks here</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default KanbanBoard;
