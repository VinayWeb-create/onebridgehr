import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlarmClock,
  Archive,
  Bell,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  History,
  Loader2,
  MapPin,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useDialog } from '../../../context/DialogContext';
import { useAuth } from '../../../context/AuthContext';
import { resolveImageUrl } from '../../../services/api';
import * as plannerApi from '../api';
import { plannerKeys, useTaskDetail, useTaskMutations } from '../hooks';
import { KANBAN_COLUMNS, SNOOZE_OPTIONS, reminderLabel } from '../lib/constants';
import { formatDue, formatDuration, relativeFromNow } from '../lib/time';
import { CategoryChip, PriorityBadge, ProgressRing, StatusBadge } from './Badges';
import type { PlannerTask, TaskDetail } from '../types';

interface Props {
  taskId: string | null;
  onClose: () => void;
  onEdit: (task: PlannerTask) => void;
}

const section = 'rounded-2xl border border-brand-200 dark:border-brand-900 p-4 space-y-3';
const h3 = 'flex items-center gap-2 text-xs font-black text-brand-950 dark:text-white';

const HISTORY_LABEL: Record<string, string> = {
  CREATED: 'created the task',
  UPDATED: 'updated',
  STATUS_CHANGED: 'changed status',
  ASSIGNED: 'changed assignees',
  CHECKLIST: 'updated checklist',
  COMMENTED: 'commented',
  ATTACHMENT: 'attached a file',
  SNOOZED: 'snoozed reminders',
  DELETED: 'deleted the task',
};

export const TaskDrawer: React.FC<Props> = ({ taskId, onClose, onEdit }) => {
  const { user } = useAuth();
  const { confirm } = useDialog();
  const qc = useQueryClient();
  const detail = useTaskDetail(taskId);
  const { move, remove, snooze } = useTaskMutations();
  const [newItem, setNewItem] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [customSnooze, setCustomSnooze] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const task = detail.data as TaskDetail | undefined;
  const perms = task?.permissions || [];
  const canCollab = perms.includes('collaborate');
  const canEdit = perms.includes('edit');
  const canDelete = perms.includes('delete');

  useEffect(() => {
    if (!taskId) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [taskId, onClose]);

  const refresh = () => qc.invalidateQueries({ queryKey: plannerKeys.all });
  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };
  const run = async (key: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    try {
      await fn();
      await refresh();
      if (done) flash(done);
    } catch (err) {
      flash(plannerApi.errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const setStatus = (status: string) => run(`status-${status}`, () => move.mutateAsync({ id: task!.id, status }));

  const doSnooze = (option: string) =>
    run('snooze', async () => {
      const r = await snooze.mutateAsync({ id: task!.id, option });
      setSnoozeOpen(false);
      flash(`Snoozed until ${new Date(r.until).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`);
    });

  const doDelete = async () => {
    const ok = await confirm({
      title: 'Delete task',
      message: `Delete “${task!.title}”? Its checklist, comments, attachments and reminders will be removed. This can't be undone.`,
      variant: 'danger',
      confirmText: 'Delete',
    });
    if (!ok) return;
    await remove.mutateAsync(task!.id);
    onClose();
  };

  return (
    <AnimatePresence>
      {taskId && (
        <motion.div className="fixed inset-0 z-[65] flex justify-end bg-brand-950/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Task details"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 36 }}
            className="w-full sm:max-w-xl h-full bg-white dark:bg-brand-950 border-l border-brand-200 dark:border-brand-900 shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-brand-200 dark:border-brand-900" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
              <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">Task details</p>
              <div className="flex items-center gap-1">
                {canEdit && task && (
                  <button onClick={() => onEdit(task)} className="p-2 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-900 text-brand-500 cursor-pointer" aria-label="Edit task">
                    <Pencil size={16} />
                  </button>
                )}
                {canDelete && (
                  <button onClick={doDelete} className="p-2 rounded-xl hover:bg-rose-500/10 text-brand-500 hover:text-rose-500 cursor-pointer" aria-label="Delete task">
                    <Trash2 size={16} />
                  </button>
                )}
                <button onClick={onClose} className="p-2 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-900 text-brand-500 cursor-pointer" aria-label="Close">
                  <X size={18} />
                </button>
              </div>
            </div>

            {detail.isLoading && (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="animate-spin text-indigo-500" />
              </div>
            )}
            {detail.isError && <p className="p-6 text-sm text-rose-500">{plannerApi.errorMessage(detail.error, 'Could not load this task.')}</p>}

            {task && (
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <PriorityBadge priority={task.priority} />
                    <StatusBadge status={task.effectiveStatus} />
                    <CategoryChip category={task.category} />
                    {task.repeat && task.repeat.frequency !== 'NEVER' && (
                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500">↻ {task.repeat.frequency.toLowerCase()}</span>
                    )}
                  </div>
                  <h2 className={`text-xl font-black text-brand-950 dark:text-white break-words ${task.status === 'COMPLETED' ? 'line-through opacity-70' : ''}`}>{task.title}</h2>
                  {task.description && <p className="text-sm text-brand-600 dark:text-brand-300 whitespace-pre-wrap">{task.description}</p>}
                  <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-brand-600 dark:text-brand-300">
                    <span className={`flex items-center gap-1.5 ${task.isOverdue ? 'text-rose-500' : ''}`}>
                      <Clock size={13} /> {formatDue(task.dueAt, task.allDay)}
                    </span>
                    {task.estimatedMinutes ? <span>⏱ {formatDuration(task.estimatedMinutes)}</span> : <span />}
                    {task.projectName && <span>📁 {task.projectName}</span>}
                    {task.location && (
                      <span className="flex items-center gap-1.5 truncate">
                        <MapPin size={13} />
                        {/^https?:\/\//.test(task.location) ? (
                          <a href={task.location} target="_blank" rel="noreferrer noopener" className="text-indigo-500 underline truncate">
                            {task.location}
                          </a>
                        ) : (
                          task.location
                        )}
                      </span>
                    )}
                  </div>
                  {task.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {task.tags.map((t) => (
                        <span key={t} className="text-[11px] font-bold text-orange-600 dark:text-orange-400">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                  {task.people.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {task.people.map((p) => (
                        <span key={p.employeeId} className="inline-flex items-center gap-1.5 pl-0.5 pr-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900 text-[11px] font-bold text-brand-700 dark:text-brand-200">
                          {p.profileImageUrl ? (
                            <img src={resolveImageUrl(p.profileImageUrl)} alt="" className="w-5 h-5 rounded-full object-cover" />
                          ) : (
                            <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[9px] flex items-center justify-center">
                              {p.firstName[0]}
                              {p.lastName?.[0]}
                            </span>
                          )}
                          {p.firstName} {p.employeeId === task.ownerId ? '(owner)' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {canCollab && (
                  <div className="flex flex-wrap gap-2">
                    {task.status !== 'COMPLETED' ? (
                      <button onClick={() => setStatus('COMPLETED')} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 text-white text-xs font-black shadow-sm hover:bg-emerald-600 disabled:opacity-60 cursor-pointer">
                        <CheckCircle2 size={14} /> Mark complete
                      </button>
                    ) : (
                      <button onClick={() => setStatus('PENDING')} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-200 text-xs font-black cursor-pointer">
                        <RotateCcw size={14} /> Reopen
                      </button>
                    )}
                    <select
                      value={task.status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950 px-3 py-2 text-xs font-bold text-brand-700 dark:text-brand-200"
                      aria-label="Status"
                    >
                      {KANBAN_COLUMNS.map((c) => (
                        <option key={c.status} value={c.status}>
                          {c.label}
                        </option>
                      ))}
                      <option value="CANCELLED">Cancelled</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                    {task.status !== 'COMPLETED' && (
                      <div className="relative">
                        <button onClick={() => setSnoozeOpen(!snoozeOpen)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-brand-200 dark:border-brand-800 text-xs font-black text-brand-700 dark:text-brand-200 cursor-pointer" aria-expanded={snoozeOpen}>
                          <AlarmClock size={14} /> Snooze
                        </button>
                        <AnimatePresence>
                          {snoozeOpen && (
                            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="absolute z-10 mt-1 w-56 p-2 rounded-2xl bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 shadow-xl space-y-1">
                              <div className="grid grid-cols-3 gap-1">
                                {SNOOZE_OPTIONS.map((o) => (
                                  <button key={o.value} onClick={() => doSnooze(o.value)} className="px-2 py-1.5 rounded-lg text-[11px] font-bold hover:bg-indigo-500/10 text-brand-700 dark:text-brand-200 cursor-pointer">
                                    {o.label}
                                  </button>
                                ))}
                              </div>
                              <div className="flex gap-1">
                                <input type="datetime-local" value={customSnooze} onChange={(e) => setCustomSnooze(e.target.value)} className="flex-1 min-w-0 rounded-lg border border-brand-200 dark:border-brand-700 bg-transparent px-2 py-1 text-[11px]" aria-label="Custom snooze time" />
                                <button disabled={!customSnooze} onClick={() => doSnooze(new Date(customSnooze).toISOString())} className="px-2 rounded-lg bg-indigo-600 text-white text-[11px] font-bold disabled:opacity-40 cursor-pointer">
                                  Set
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                    {canEdit && task.status !== 'ARCHIVED' && (
                      <button onClick={() => setStatus('ARCHIVED')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-brand-500 hover:bg-brand-100 dark:hover:bg-brand-900 cursor-pointer">
                        <Archive size={14} /> Archive
                      </button>
                    )}
                  </div>
                )}

                {/* Checklist */}
                <section className={section}>
                  <div className="flex items-center justify-between">
                    <h3 className={h3}>✅ Checklist</h3>
                    <ProgressRing done={task.checklist.filter((c) => c.isCompleted).length} total={task.checklist.length} />
                  </div>
                  {task.checklist.length > 0 && (
                    <div className="h-1.5 rounded-full bg-brand-100 dark:bg-brand-900 overflow-hidden">
                      <motion.div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500" animate={{ width: `${(task.checklist.filter((c) => c.isCompleted).length / task.checklist.length) * 100}%` }} />
                    </div>
                  )}
                  <ul className="space-y-1">
                    {task.checklist.map((item) => (
                      <li key={item.id} className="group flex items-center gap-2.5 py-1">
                        <button
                          disabled={!canCollab}
                          onClick={() => run(`c-${item.id}`, () => plannerApi.toggleChecklist(task.id, item.id, !item.isCompleted))}
                          className="shrink-0 cursor-pointer disabled:cursor-default"
                          aria-label={item.isCompleted ? `Uncheck ${item.title}` : `Check ${item.title}`}
                        >
                          {item.isCompleted ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Circle size={18} className="text-brand-400" />}
                        </button>
                        <span className={`flex-1 text-sm ${item.isCompleted ? 'line-through text-brand-400' : 'text-brand-800 dark:text-brand-100'}`}>{item.title}</span>
                        {canCollab && (
                          <button onClick={() => run(`d-${item.id}`, () => plannerApi.deleteChecklistItem(task.id, item.id))} className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-brand-400 hover:text-rose-500 cursor-pointer" aria-label={`Remove ${item.title}`}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {canCollab && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!newItem.trim()) return;
                        const title = newItem.trim();
                        setNewItem('');
                        run('add-item', () => plannerApi.addChecklistItem(task.id, title));
                      }}
                      className="flex gap-2"
                    >
                      <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add a subtask" className="flex-1 rounded-xl border border-brand-200 dark:border-brand-800 bg-transparent px-3 py-2 text-sm" aria-label="New subtask" />
                      <button type="submit" className="px-3 rounded-xl bg-indigo-600 text-white cursor-pointer" aria-label="Add subtask">
                        <Plus size={15} />
                      </button>
                    </form>
                  )}
                </section>

                {/* Reminders */}
                <section className={section}>
                  <h3 className={h3}>
                    <Bell size={14} className="text-orange-500" /> My reminders
                  </h3>
                  {task.reminders.length === 0 && <p className="text-xs text-brand-400">No reminders for you on this task.</p>}
                  <ul className="space-y-1.5">
                    {task.reminders.map((r) => (
                      <li key={r.id} className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-brand-700 dark:text-brand-200">
                          {r.kind === 'SNOOZE' ? '⏰ Snoozed' : r.offsetMinutes !== null && r.offsetMinutes !== undefined ? reminderLabel(r.offsetMinutes) : '🔔 Custom'} ·{' '}
                          {new Date(r.deliverAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase ${
                            r.status === 'SENT' ? 'text-emerald-500' : r.status === 'FAILED' ? 'text-rose-500' : r.status === 'SCHEDULED' ? 'text-indigo-500' : 'text-brand-400'
                          }`}
                        >
                          {r.status.toLowerCase()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>

                {/* Attachments */}
                <section className={section}>
                  <h3 className={h3}>
                    <Paperclip size={14} /> Attachments
                  </h3>
                  {task.attachments.length === 0 && <p className="text-xs text-brand-400">No attachments yet.</p>}
                  <ul className="space-y-1.5">
                    {task.attachments.map((a) => (
                      <li key={a.id} className="flex items-center gap-2 text-sm">
                        <FileText size={14} className="text-brand-400 shrink-0" />
                        <a href={resolveImageUrl(a.fileUrl)} target="_blank" rel="noreferrer noopener" className="flex-1 truncate font-semibold text-indigo-600 dark:text-indigo-300 hover:underline">
                          {a.fileName}
                        </a>
                        {(a.uploadedBy === user?.employeeId || canEdit) && (
                          <button onClick={() => run(`a-${a.id}`, () => plannerApi.deleteAttachment(task.id, a.id))} className="text-brand-400 hover:text-rose-500 cursor-pointer" aria-label={`Remove ${a.fileName}`}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {canCollab && (
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-brand-300 dark:border-brand-700 text-xs font-bold text-brand-600 dark:text-brand-300 hover:border-indigo-400 cursor-pointer">
                      {busy === 'upload' ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Upload file
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (!f) return;
                          if (f.size > 5 * 1024 * 1024) return flash('Files must be 5 MB or smaller');
                          run('upload', () => plannerApi.uploadAttachment(task.id, f), 'File attached');
                        }}
                      />
                    </label>
                  )}
                </section>

                {/* Comments */}
                <section className={section}>
                  <h3 className={h3}>
                    <MessageSquare size={14} /> Comments
                  </h3>
                  <ul className="space-y-2.5">
                    {task.comments.map((c) => (
                      <li key={c.id} className="group">
                        <p className="text-[11px] font-black text-brand-700 dark:text-brand-200">
                          {c.authorName} <span className="font-semibold text-brand-400">· {relativeFromNow(c.createdAt)}</span>
                          {(c.authorId === user?.employeeId || canEdit) && (
                            <button onClick={() => run(`cm-${c.id}`, () => plannerApi.deleteComment(task.id, c.id))} className="ml-2 opacity-0 group-hover:opacity-100 focus:opacity-100 text-brand-400 hover:text-rose-500 cursor-pointer" aria-label="Delete comment">
                              <Trash2 size={11} />
                            </button>
                          )}
                        </p>
                        <p className="text-sm text-brand-700 dark:text-brand-200 whitespace-pre-wrap">{c.content}</p>
                      </li>
                    ))}
                  </ul>
                  {canCollab && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!comment.trim()) return;
                        const content = comment.trim();
                        setComment('');
                        run('comment', () => plannerApi.addComment(task.id, content));
                      }}
                      className="flex gap-2"
                    >
                      <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write a comment…" className="flex-1 rounded-xl border border-brand-200 dark:border-brand-800 bg-transparent px-3 py-2 text-sm" aria-label="Comment" />
                      <button type="submit" className="px-3 rounded-xl bg-indigo-600 text-white cursor-pointer" aria-label="Send comment">
                        <Send size={14} />
                      </button>
                    </form>
                  )}
                </section>

                {/* History */}
                <section className={section}>
                  <h3 className={h3}>
                    <History size={14} /> Activity
                  </h3>
                  <ol className="relative border-l border-brand-200 dark:border-brand-800 ml-1.5 space-y-2.5">
                    {task.history.slice(0, 30).map((h) => (
                      <li key={h.id} className="pl-4 relative">
                        <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-indigo-400" />
                        <p className="text-xs text-brand-600 dark:text-brand-300">
                          <span className="font-black text-brand-800 dark:text-brand-100">{h.actorId === user?.employeeId ? 'You' : h.actorId}</span> {HISTORY_LABEL[h.action] || h.action.toLowerCase()}
                          {h.field && h.action !== 'CHECKLIST' ? ` ${h.field}` : ''}
                          {h.action === 'STATUS_CHANGED' && h.toValue ? ` → ${h.toValue.replace(/_/g, ' ').toLowerCase()}` : ''}
                          {h.action === 'CHECKLIST' && h.toValue ? ` (${h.field}: ${h.toValue})` : ''}
                        </p>
                        <p className="text-[10px] text-brand-400">{new Date(h.createdAt).toLocaleString()}</p>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>
            )}

            <AnimatePresence>
              {toast && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute bottom-5 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-brand-950 text-white text-xs font-bold shadow-xl" role="status">
                  {toast}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TaskDrawer;
