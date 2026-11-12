import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Clock, CloudOff, MapPin, Repeat, Users, FolderKanban } from 'lucide-react';
import { CategoryChip, PriorityBadge, ProgressRing, StatusBadge } from './Badges';
import { formatDue, formatDuration } from '../lib/time';
import type { PlannerTask } from '../types';

interface Props {
  task: PlannerTask;
  onOpen: (task: PlannerTask) => void;
  onToggleComplete: (task: PlannerTask) => void;
  compact?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, task: PlannerTask) => void;
}

export const TaskCard: React.FC<Props> = ({ task, onOpen, onToggleComplete, compact, draggable, onDragStart }) => {
  const done = task.status === 'COMPLETED';
  const canToggle = !task.permissions || task.permissions.includes('collaborate');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
    >
    <div
      draggable={draggable}
      onDragStart={(e) => onDragStart?.(e, task)}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen(task);
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open task ${task.title}`}
      className={`group relative glass rounded-2xl border border-brand-200 dark:border-brand-900 p-3.5 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        done ? 'opacity-70' : ''
      } ${draggable ? 'active:cursor-grabbing' : ''}`}
    >
      {task.color && <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full" style={{ background: task.color }} />}
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          disabled={!canToggle}
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete(task);
          }}
          className="mt-0.5 shrink-0 text-brand-400 hover:text-emerald-500 transition-colors disabled:opacity-40 cursor-pointer"
          aria-label={done ? 'Mark as not done' : 'Mark complete'}
        >
          {done ? <CheckCircle2 size={19} className="text-emerald-500" /> : <Circle size={19} />}
        </button>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-bold leading-snug text-brand-950 dark:text-white break-words ${done ? 'line-through' : ''}`}>{task.title}</p>
            <PriorityBadge priority={task.priority} compact={compact} />
          </div>
          {!compact && task.description && <p className="text-xs text-brand-500 line-clamp-2">{task.description}</p>}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-brand-500">
            <span className={`inline-flex items-center gap-1 ${task.isOverdue ? 'text-rose-500 font-bold' : ''}`}>
              <Clock size={12} />
              {formatDue(task.dueAt, task.allDay)}
            </span>
            {task.isOverdue && <StatusBadge status="OVERDUE" />}
            {!compact && task.status !== 'PENDING' && !task.isOverdue && <StatusBadge status={task.status} />}
            {task.repeat && task.repeat.frequency !== 'NEVER' && (
              <span className="inline-flex items-center gap-0.5 text-indigo-500" title={`Repeats ${task.repeat.frequency.toLowerCase()}`}>
                <Repeat size={12} />
              </span>
            )}
            {task.estimatedMinutes ? <span>· {formatDuration(task.estimatedMinutes)}</span> : null}
          </div>
          {!compact && (
            <div className="flex flex-wrap items-center gap-1.5">
              <CategoryChip category={task.category} />
              {task.projectName && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-300">
                  <FolderKanban size={11} />
                  {task.projectName}
                </span>
              )}
              {task.location && (
                <span className="inline-flex items-center gap-1 text-[10px] text-brand-500 max-w-[140px] truncate">
                  <MapPin size={11} />
                  {task.location}
                </span>
              )}
              {task.tags.slice(0, 3).map((t) => (
                <span key={t} className="text-[10px] font-bold text-orange-600 dark:text-orange-400">
                  #{t}
                </span>
              ))}
              <span className="ml-auto flex items-center gap-2">
                {task.assigneeIds.length > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-brand-500" title="Shared with">
                    <Users size={11} /> {task.assigneeIds.length}
                  </span>
                )}
                <ProgressRing done={task.checklistDone} total={task.checklistTotal} />
                {task._pending && (
                  <span title="Waiting to sync" className="text-amber-500">
                    <CloudOff size={13} />
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
    </motion.div>
  );
};

export default TaskCard;
