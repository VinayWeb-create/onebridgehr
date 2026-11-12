import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Bell, CalendarClock, Check, ListChecks, Loader2, Paperclip, Plus, Repeat, Search, Tag, Trash2, Users, X } from 'lucide-react';
import {
  CATEGORIES,
  CATEGORY_META,
  PRIORITIES,
  PRIORITY_META,
  REMINDER_OPTIONS,
  REPEAT_OPTIONS,
  TASK_COLORS,
  TIMEZONES,
  WEEKDAY_SHORT,
  reminderLabel,
} from '../lib/constants';
import { browserTimezone, joinLocal, splitLocal } from '../lib/time';
import * as plannerApi from '../api';
import { useTaskMutations, usePreferences } from '../hooks';
import type { PlannerTask, RepeatFrequency, RepeatUnit, TaskCategory, TaskInput, TaskPriority } from '../types';

const PROJECT_TEMPLATES: Array<{ title: string; category: TaskCategory; offsets: number[]; priority?: TaskPriority; repeat?: RepeatFrequency }> = [
  { title: 'Client Call', category: 'CALL_REMINDER', offsets: [15] },
  { title: 'Weekly Review', category: 'PROJECT', offsets: [60], repeat: 'WEEKLY' },
  { title: 'Deployment', category: 'PROJECT', offsets: [1440, 60], priority: 'HIGH' },
  { title: 'Code Review', category: 'PROJECT', offsets: [30] },
  { title: 'Testing', category: 'PROJECT', offsets: [60] },
  { title: 'Invoice Follow-up', category: 'CLIENT_FOLLOWUP', offsets: [1440] },
];

interface Props {
  open: boolean;
  onClose: () => void;
  task?: PlannerTask | null;
  /** Prefill for new tasks (e.g. a date clicked in the calendar). */
  defaults?: Partial<TaskInput>;
  onSaved?: (task: PlannerTask | null) => void;
}

const field =
  'w-full rounded-xl border border-brand-200 dark:border-brand-800 bg-white/80 dark:bg-brand-950/60 px-3 py-2.5 text-sm text-brand-950 dark:text-white placeholder:text-brand-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition';
const label = 'block text-[10px] font-black uppercase tracking-wider text-brand-500 mb-1.5';
const chip = (active: boolean) =>
  `px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
    active
      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
      : 'bg-white/60 dark:bg-brand-950/40 border-brand-200 dark:border-brand-800 text-brand-600 dark:text-brand-300 hover:border-indigo-400'
  }`;

export const TaskEditor: React.FC<Props> = ({ open, onClose, task, defaults, onSaved }) => {
  const isEdit = !!task;
  const canEdit = !task?.permissions || task.permissions.includes('edit');
  const { create, update } = useTaskMutations();
  const prefs = usePreferences();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('WORK');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [projectName, setProjectName] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [timezone, setTimezone] = useState(browserTimezone());
  const [offsets, setOffsets] = useState<number[]>([]);
  const [customOffset, setCustomOffset] = useState('');
  const [customAts, setCustomAts] = useState<string[]>([]);
  const [customAtInput, setCustomAtInput] = useState('');
  const [frequency, setFrequency] = useState<RepeatFrequency>('NEVER');
  const [interval, setIntervalN] = useState(1);
  const [unit, setUnit] = useState<RepeatUnit>('DAY');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [endsAt, setEndsAt] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [checklist, setChecklist] = useState<string[]>([]);
  const [checkInput, setCheckInput] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [estimated, setEstimated] = useState('');
  const [location, setLocation] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [peopleQuery, setPeopleQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const projects = useQuery({ queryKey: ['planner', 'projects'], queryFn: plannerApi.fetchProjects, enabled: open, staleTime: 60_000 });
  const people = useQuery({
    queryKey: ['planner', 'people', peopleQuery],
    queryFn: () => plannerApi.fetchPeople(peopleQuery || undefined),
    enabled: open,
    staleTime: 60_000,
  });

  // Reset form whenever the editor opens
  useEffect(() => {
    if (!open) return;
    const src: Partial<TaskInput> & Partial<PlannerTask> = task ?? defaults ?? {};
    const local = splitLocal(src.dueAt ?? null);
    setTitle(src.title ?? '');
    setDescription(src.description ?? '');
    setCategory((src.category as TaskCategory) ?? 'WORK');
    setPriority((src.priority as TaskPriority) ?? 'MEDIUM');
    setProjectName(src.projectName ?? '');
    setAssigneeIds(src.assigneeIds ?? []);
    setDate(local.date);
    setTime(local.time || (src.dueAt ? '' : ''));
    setAllDay(!!src.allDay);
    setTimezone(src.timezone || prefs.data?.preferences.timezone || browserTimezone());
    setOffsets(task ? task.reminderOffsets : src.reminderOffsets ?? prefs.data?.preferences.defaultReminderOffsets ?? [15]);
    setCustomAts((src.customReminderAts as string[]) ?? []);
    const rep = task?.repeat ?? (src.repeat as any) ?? null;
    setFrequency((rep?.frequency as RepeatFrequency) ?? 'NEVER');
    setIntervalN(rep?.interval ?? 1);
    setUnit((rep?.unit as RepeatUnit) ?? 'DAY');
    setDaysOfWeek(rep?.daysOfWeek ?? []);
    setEndsAt(rep?.endsAt ? splitLocal(rep.endsAt).date : '');
    setTags(src.tags ?? []);
    setChecklist([]);
    setColor(src.color ?? null);
    setEstimated(src.estimatedMinutes ? String(src.estimatedMinutes) : '');
    setLocation(src.location ?? '');
    setFiles([]);
    setError(null);
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const peopleById = useMemo(() => new Map((people.data || []).map((p) => [p.employeeId, p])), [people.data]);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '').toLowerCase();
    if (t && !tags.includes(t) && tags.length < 20) setTags([...tags, t]);
    setTagInput('');
  };

  const applyTemplate = (tpl: (typeof PROJECT_TEMPLATES)[number]) => {
    setTitle((t) => t || tpl.title);
    setCategory(tpl.category);
    setOffsets(tpl.offsets);
    if (tpl.priority) setPriority(tpl.priority);
    if (tpl.repeat) setFrequency(tpl.repeat);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please give the task a title.');
      return;
    }
    if (customOffset) {
      setError('Press "Add" to keep the custom reminder, or clear it.');
      return;
    }
    const dueAt = joinLocal(date, time, allDay);
    if (frequency !== 'NEVER' && !dueAt) {
      setError('Repeating tasks need a due date.');
      return;
    }
    const input: TaskInput = {
      title: title.trim(),
      description: description.trim() || null,
      category,
      priority,
      projectName: projectName.trim() || null,
      assigneeIds,
      dueAt,
      allDay,
      timezone,
      reminderOffsets: dueAt ? offsets : [],
      customReminderAts: customAts,
      repeat:
        frequency === 'NEVER'
          ? isEdit
            ? { frequency: 'NEVER' }
            : null
          : {
              frequency,
              interval,
              unit,
              daysOfWeek: frequency === 'WEEKLY' ? daysOfWeek : [],
              endsAt: endsAt ? joinLocal(endsAt, '23:59') : null,
            },
      tags,
      color,
      estimatedMinutes: estimated ? Math.max(1, Number(estimated)) : null,
      location: location.trim() || null,
    };
    if (!isEdit && checklist.length) input.checklist = checklist.map((t) => ({ title: t }));

    setSaving(true);
    setError(null);
    try {
      let saved: PlannerTask | null;
      if (isEdit) {
        saved = await update.mutateAsync({ id: task!.id, input });
      } else {
        saved = await create.mutateAsync(input);
      }
      if (saved && files.length && !saved.id.startsWith('tmp-')) {
        for (const f of files) await plannerApi.uploadAttachment(saved.id, f).catch(() => undefined);
      }
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(plannerApi.errorMessage(err, 'Could not save the task'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-brand-950/50 backdrop-blur-sm p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.form
            onSubmit={submit}
            role="dialog"
            aria-modal="true"
            aria-label={isEdit ? 'Edit task' : 'Create task'}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="w-full sm:max-w-3xl max-h-[94vh] sm:max-h-[90vh] flex flex-col bg-white dark:bg-brand-950 rounded-t-3xl sm:rounded-3xl border border-brand-200 dark:border-brand-900 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-brand-200 dark:border-brand-900">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">Smart Tasks</p>
                <h2 className="text-lg font-black text-brand-950 dark:text-white">{isEdit ? 'Edit task' : 'New task'}</h2>
              </div>
              <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-900 text-brand-500 cursor-pointer" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {!canEdit && (
                <p className="text-xs font-semibold text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                  This task is shared with you — only its owner can change these details.
                </p>
              )}
              <fieldset disabled={!canEdit} className="space-y-5">
                <div>
                  <input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="What needs to be done?"
                    maxLength={200}
                    className="w-full bg-transparent text-xl font-black text-brand-950 dark:text-white placeholder:text-brand-300 focus:outline-none"
                    aria-label="Title"
                  />
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add a description…"
                    rows={2}
                    className="mt-2 w-full bg-transparent text-sm text-brand-600 dark:text-brand-300 placeholder:text-brand-400 focus:outline-none resize-none"
                    aria-label="Description"
                  />
                </div>

                {!isEdit && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-brand-400 self-center mr-1">Templates</span>
                    {PROJECT_TEMPLATES.map((tpl) => (
                      <button key={tpl.title} type="button" onClick={() => applyTemplate(tpl)} className={chip(false)}>
                        {tpl.title}
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <span className={label}>Category</span>
                    <select value={category} onChange={(e) => setCategory(e.target.value as TaskCategory)} className={field} aria-label="Category">
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className={label}>Priority</span>
                    <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Priority">
                      {PRIORITIES.map((p) => (
                        <button
                          key={p}
                          type="button"
                          role="radio"
                          aria-checked={priority === p}
                          onClick={() => setPriority(p)}
                          className={`py-2 rounded-xl text-[11px] font-black border transition cursor-pointer ${
                            priority === p ? `${PRIORITY_META[p].badge} ring-2 ring-offset-1 ring-offset-white dark:ring-offset-brand-950 ring-current` : 'border-brand-200 dark:border-brand-800 text-brand-500'
                          }`}
                        >
                          {PRIORITY_META[p].label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Schedule */}
                <section className="rounded-2xl border border-brand-200 dark:border-brand-900 p-4 space-y-4">
                  <h3 className="flex items-center gap-2 text-xs font-black text-brand-950 dark:text-white">
                    <CalendarClock size={15} className="text-indigo-500" /> Schedule
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="col-span-1">
                      <span className={label}>Due date</span>
                      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} aria-label="Due date" />
                    </div>
                    <div className="col-span-1">
                      <span className={label}>Due time</span>
                      <input type="time" value={time} disabled={allDay} onChange={(e) => setTime(e.target.value)} className={field} aria-label="Due time" />
                    </div>
                    <div className="col-span-1">
                      <span className={label}>Duration (min)</span>
                      <input type="number" min={1} value={estimated} onChange={(e) => setEstimated(e.target.value)} placeholder="e.g. 45" className={field} />
                    </div>
                    <div className="col-span-1">
                      <span className={label}>Timezone</span>
                      <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={field} aria-label="Timezone">
                        {Array.from(new Set([timezone, ...TIMEZONES])).map((tz) => (
                          <option key={tz}>{tz}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-brand-600 dark:text-brand-300 cursor-pointer">
                    <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="accent-indigo-600" /> All-day
                  </label>

                  {/* Repeat */}
                  <div className="space-y-2">
                    <span className={`${label} flex items-center gap-1.5`}>
                      <Repeat size={12} /> Repeat
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {REPEAT_OPTIONS.map((o) => (
                        <button key={o.value} type="button" onClick={() => setFrequency(o.value)} className={chip(frequency === o.value)}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                    {frequency === 'CUSTOM' && (
                      <div className="flex items-center gap-2 text-xs font-bold text-brand-600 dark:text-brand-300">
                        Every
                        <input type="number" min={1} max={365} value={interval} onChange={(e) => setIntervalN(Math.max(1, Number(e.target.value) || 1))} className={`${field} w-20`} />
                        <select value={unit} onChange={(e) => setUnit(e.target.value as RepeatUnit)} className={`${field} w-32`}>
                          <option value="DAY">day(s)</option>
                          <option value="WEEK">week(s)</option>
                          <option value="MONTH">month(s)</option>
                          <option value="YEAR">year(s)</option>
                        </select>
                      </div>
                    )}
                    {frequency === 'WEEKLY' && (
                      <div className="flex flex-wrap gap-1.5" aria-label="Repeat on days">
                        {WEEKDAY_SHORT.map((d, i) => (
                          <button key={d} type="button" onClick={() => setDaysOfWeek(toggle(daysOfWeek, i))} className={chip(daysOfWeek.includes(i))}>
                            {d}
                          </button>
                        ))}
                      </div>
                    )}
                    {frequency !== 'NEVER' && (
                      <div className="flex items-center gap-2 text-xs font-bold text-brand-600 dark:text-brand-300">
                        Ends
                        <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={`${field} w-44`} aria-label="Repeat end date" />
                        <span className="text-brand-400 font-semibold">(optional)</span>
                      </div>
                    )}
                  </div>
                </section>

                {/* Reminders */}
                <section className="rounded-2xl border border-brand-200 dark:border-brand-900 p-4 space-y-3">
                  <h3 className="flex items-center gap-2 text-xs font-black text-brand-950 dark:text-white">
                    <Bell size={15} className="text-orange-500" /> Reminders
                    {!date && <span className="text-[10px] font-semibold text-brand-400">(set a due date to use “before” reminders)</span>}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {REMINDER_OPTIONS.map((o) => (
                      <button key={o.minutes} type="button" disabled={!date} onClick={() => setOffsets(toggle(offsets, o.minutes))} className={`${chip(offsets.includes(o.minutes))} disabled:opacity-40`}>
                        {o.label}
                      </button>
                    ))}
                    {offsets
                      .filter((m) => !REMINDER_OPTIONS.some((o) => o.minutes === m))
                      .map((m) => (
                        <button key={m} type="button" onClick={() => setOffsets(offsets.filter((x) => x !== m))} className={chip(true)}>
                          {reminderLabel(m)} ✕
                        </button>
                      ))}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        value={customOffset}
                        onChange={(e) => setCustomOffset(e.target.value)}
                        placeholder="Custom: minutes before"
                        className={field}
                        disabled={!date}
                        aria-label="Custom reminder minutes before"
                      />
                      <button
                        type="button"
                        disabled={!customOffset}
                        onClick={() => {
                          const m = Math.round(Number(customOffset));
                          if (m > 0 && !offsets.includes(m)) setOffsets([...offsets, m]);
                          setCustomOffset('');
                        }}
                        className="px-3 rounded-xl bg-brand-100 dark:bg-brand-900 text-xs font-bold text-brand-700 dark:text-brand-200 disabled:opacity-40 cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input type="datetime-local" value={customAtInput} onChange={(e) => setCustomAtInput(e.target.value)} className={field} aria-label="Custom reminder time" />
                      <button
                        type="button"
                        disabled={!customAtInput}
                        onClick={() => {
                          const iso = new Date(customAtInput).toISOString();
                          if (!customAts.includes(iso)) setCustomAts([...customAts, iso]);
                          setCustomAtInput('');
                        }}
                        className="px-3 rounded-xl bg-brand-100 dark:bg-brand-900 text-xs font-bold text-brand-700 dark:text-brand-200 disabled:opacity-40 cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  {customAts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {customAts.map((iso) => (
                        <button key={iso} type="button" onClick={() => setCustomAts(customAts.filter((x) => x !== iso))} className={chip(true)}>
                          {new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} ✕
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                {/* People & project */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <span className={label}>Workspace / Project (optional)</span>
                    <input list="planner-projects" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Website Revamp" className={field} />
                    <datalist id="planner-projects">
                      {(projects.data || []).map((p) => (
                        <option key={p} value={p} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <span className={label}>Location (optional)</span>
                    <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Room, address or meeting link" className={field} />
                  </div>
                </div>

                <div>
                  <span className={`${label} flex items-center gap-1.5`}>
                    <Users size={12} /> Assign / share with
                  </span>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {assigneeIds.map((id) => {
                      const p = peopleById.get(id);
                      return (
                        <button key={id} type="button" onClick={() => setAssigneeIds(assigneeIds.filter((x) => x !== id))} className={chip(true)}>
                          {p ? `${p.firstName} ${p.lastName}` : id} ✕
                        </button>
                      );
                    })}
                  </div>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
                    <input value={peopleQuery} onChange={(e) => setPeopleQuery(e.target.value)} placeholder="Search colleagues…" className={`${field} pl-9`} aria-label="Search colleagues" />
                  </div>
                  {peopleQuery && (
                    <div className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-brand-200 dark:border-brand-800 divide-y divide-brand-100 dark:divide-brand-900">
                      {(people.data || []).length === 0 && <p className="p-3 text-xs text-brand-400">No colleagues found.</p>}
                      {(people.data || []).map((p) => (
                        <button
                          key={p.employeeId}
                          type="button"
                          onClick={() => {
                            setAssigneeIds(toggle(assigneeIds, p.employeeId));
                            setPeopleQuery('');
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 text-left text-xs hover:bg-brand-50 dark:hover:bg-brand-900/60 cursor-pointer"
                        >
                          <span className="font-bold text-brand-900 dark:text-white">
                            {p.firstName} {p.lastName} <span className="text-brand-400 font-semibold">· {p.designation || p.department}</span>
                          </span>
                          {assigneeIds.includes(p.employeeId) && <Check size={14} className="text-indigo-500" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tags & color */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <span className={`${label} flex items-center gap-1.5`}>
                      <Tag size={12} /> Tags
                    </span>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {tags.map((t) => (
                        <button key={t} type="button" onClick={() => setTags(tags.filter((x) => x !== t))} className="px-2 py-1 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[11px] font-bold cursor-pointer">
                          #{t} ✕
                        </button>
                      ))}
                    </div>
                    <input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      onBlur={addTag}
                      placeholder="Type a tag and press Enter"
                      className={field}
                    />
                  </div>
                  <div>
                    <span className={label}>Color</span>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setColor(null)} className={`w-7 h-7 rounded-full border-2 ${color === null ? 'border-indigo-500' : 'border-brand-200 dark:border-brand-800'} cursor-pointer`} aria-label="No color" />
                      {TASK_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setColor(c)}
                          className={`w-7 h-7 rounded-full cursor-pointer transition ${color === c ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-brand-950 ring-indigo-500 scale-110' : ''}`}
                          style={{ background: c }}
                          aria-label={`Color ${c}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* Checklist & attachments (create only; edit in the task drawer) */}
              {!isEdit && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <span className={`${label} flex items-center gap-1.5`}>
                      <ListChecks size={12} /> Checklist
                    </span>
                    <div className="space-y-1.5 mb-2">
                      {checklist.map((c, i) => (
                        <div key={`${c}-${i}`} className="flex items-center gap-2 text-sm text-brand-700 dark:text-brand-200">
                          <span className="w-4 h-4 rounded border border-brand-300 dark:border-brand-700" />
                          <span className="flex-1 truncate">{c}</span>
                          <button type="button" onClick={() => setChecklist(checklist.filter((_, j) => j !== i))} className="text-brand-400 hover:text-rose-500 cursor-pointer" aria-label="Remove item">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={checkInput}
                        onChange={(e) => setCheckInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (checkInput.trim()) setChecklist([...checklist, checkInput.trim()]);
                            setCheckInput('');
                          }
                        }}
                        placeholder="Add a subtask"
                        className={field}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (checkInput.trim()) setChecklist([...checklist, checkInput.trim()]);
                          setCheckInput('');
                        }}
                        className="px-3 rounded-xl bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-200 cursor-pointer"
                        aria-label="Add subtask"
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className={`${label} flex items-center gap-1.5`}>
                      <Paperclip size={12} /> Attachments
                    </span>
                    <label className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-brand-200 dark:border-brand-800 py-4 text-xs font-bold text-brand-500 hover:border-indigo-400 cursor-pointer">
                      <Paperclip size={16} />
                      Choose files (max 5 MB each)
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => setFiles([...files, ...Array.from(e.target.files || []).filter((f) => f.size <= 5 * 1024 * 1024)])}
                      />
                    </label>
                    {files.map((f, i) => (
                      <p key={`${f.name}-${i}`} className="mt-1 flex items-center justify-between text-xs text-brand-600 dark:text-brand-300">
                        <span className="truncate">{f.name}</span>
                        <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-brand-400 hover:text-rose-500 cursor-pointer" aria-label="Remove file">
                          <X size={13} />
                        </button>
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-brand-200 dark:border-brand-900 flex items-center justify-between gap-3 bg-brand-50/60 dark:bg-brand-950" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.875rem)' }}>
              <p className="text-xs font-semibold text-rose-500 min-h-[1rem]" role="alert">
                {error}
              </p>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-bold text-brand-600 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900 cursor-pointer">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !canEdit}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-indigo-600 text-white text-xs font-black shadow-lg shadow-indigo-600/20 hover:shadow-xl disabled:opacity-60 cursor-pointer"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {isEdit ? 'Save changes' : 'Create task'}
                </button>
              </div>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TaskEditor;
