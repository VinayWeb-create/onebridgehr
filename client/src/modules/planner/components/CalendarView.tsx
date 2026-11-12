import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Loader2, Plus, Video } from 'lucide-react';
import { fetchCalendar, errorMessage } from '../api';
import { plannerKeys } from '../hooks';
import { WEEKDAY_SHORT } from '../lib/constants';
import { addDays, formatTime, isSameDay, startOfDay } from '../lib/time';
import type { CalendarEvent } from '../types';

const TYPE_META: Record<CalendarEvent['type'], { label: string; cls: string }> = {
  TASK: { label: 'Tasks', cls: 'bg-indigo-500' },
  DEADLINE: { label: 'Deadlines', cls: 'bg-rose-500' },
  RECURRING: { label: 'Recurring', cls: 'bg-sky-500' },
  REMINDER: { label: 'Reminders', cls: 'bg-orange-500' },
  MEETING: { label: 'Meetings', cls: 'bg-violet-500' },
  LEAVE: { label: 'Leave', cls: 'bg-amber-500' },
  HOLIDAY: { label: 'Holidays', cls: 'bg-pink-500' },
  BIRTHDAY: { label: 'Birthdays', cls: 'bg-fuchsia-500' },
  ANNIVERSARY: { label: 'Anniversaries', cls: 'bg-purple-500' },
};
const TYPES = Object.keys(TYPE_META) as CalendarEvent['type'][];

interface Props {
  onOpenTask: (taskId: string) => void;
  onCreateOn: (date: Date) => void;
}

/** Month calendar merging tasks, recurring projections, reminders, meetings, leave, holidays, birthdays & anniversaries. */
export const CalendarView: React.FC<Props> = ({ onOpenTask, onCreateOn }) => {
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState<Date>(startOfDay(new Date()));
  const [hidden, setHidden] = useState<Set<string>>(new Set(['REMINDER']));

  const gridStart = useMemo(() => addDays(cursor, -((cursor.getDay() + 6) % 7)), [cursor]); // Monday first
  const gridEnd = addDays(gridStart, 42);
  const q = useQuery({
    queryKey: plannerKeys.calendar(gridStart.toISOString(), gridEnd.toISOString()),
    queryFn: () => fetchCalendar(gridStart, gridEnd),
    staleTime: 30_000,
  });

  const events = useMemo(() => (q.data || []).filter((e) => !hidden.has(e.type)), [q.data, hidden]);

  const eventsOn = (day: Date) =>
    events.filter((e) => {
      const s = startOfDay(new Date(e.start));
      const end = e.end && e.allDay ? startOfDay(new Date(e.end)) : s;
      return day >= s && day <= end;
    });

  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = new Date();
  const selectedEvents = eventsOn(selected).sort((a, b) => Number(b.allDay) - Number(a.allDay) || +new Date(a.start) - +new Date(b.start));

  const openEvent = (e: CalendarEvent) => {
    if (e.taskId) onOpenTask(e.taskId);
    else if (e.type === 'MEETING' && e.url && /^https?:/.test(e.url)) window.open(e.url, '_blank', 'noopener');
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4">
      <div className="glass rounded-3xl border border-brand-200 dark:border-brand-900 p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-black text-brand-950 dark:text-white">{cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
          <div className="flex items-center gap-1">
            {q.isFetching && <Loader2 size={14} className="animate-spin text-indigo-500 mr-1" />}
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="p-2 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-900 cursor-pointer" aria-label="Previous month">
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => {
                const n = new Date();
                setCursor(new Date(n.getFullYear(), n.getMonth(), 1));
                setSelected(startOfDay(n));
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-brand-100 dark:hover:bg-brand-900 cursor-pointer"
            >
              Today
            </button>
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="p-2 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-900 cursor-pointer" aria-label="Next month">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => {
                const next = new Set(hidden);
                if (next.has(t)) next.delete(t);
                else next.add(t);
                setHidden(next);
              }}
              aria-pressed={!hidden.has(t)}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                hidden.has(t) ? 'opacity-40 border-brand-200 dark:border-brand-800' : 'border-brand-200 dark:border-brand-800 bg-white/60 dark:bg-brand-950/40'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${TYPE_META[t].cls}`} />
              {TYPE_META[t].label}
            </button>
          ))}
        </div>

        {q.isError && <p className="text-xs text-rose-500 mb-2">{errorMessage(q.error, 'Calendar unavailable offline.')}</p>}

        <div className="grid grid-cols-7 text-center text-[10px] font-black uppercase tracking-wider text-brand-400 mb-1">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <span key={d}>{WEEKDAY_SHORT[d]}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const inMonth = day.getMonth() === cursor.getMonth();
            const list = eventsOn(day);
            const isSel = isSameDay(day, selected);
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelected(day)}
                onDoubleClick={() => onCreateOn(day)}
                className={`min-h-[56px] sm:min-h-[92px] rounded-xl p-1 sm:p-1.5 text-left align-top transition border cursor-pointer ${
                  isSel ? 'border-indigo-500 bg-indigo-500/5' : 'border-transparent hover:bg-brand-100/70 dark:hover:bg-brand-900/50'
                } ${inMonth ? '' : 'opacity-40'}`}
                aria-label={`${day.toDateString()}, ${list.length} events`}
              >
                <span
                  className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-[11px] font-black ${
                    isSameDay(day, today) ? 'bg-gradient-to-br from-orange-500 to-indigo-600 text-white' : 'text-brand-700 dark:text-brand-200'
                  }`}
                >
                  {day.getDate()}
                </span>
                <div className="hidden sm:block space-y-0.5 mt-0.5">
                  {list.slice(0, 3).map((e) => (
                    <p key={e.id} className="flex items-center gap-1 text-[10px] font-semibold text-brand-700 dark:text-brand-200 truncate">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TYPE_META[e.type].cls}`} />
                      <span className={`truncate ${e.status === 'COMPLETED' ? 'line-through opacity-60' : ''}`}>{e.title}</span>
                    </p>
                  ))}
                  {list.length > 3 && <p className="text-[9px] font-bold text-brand-400">+{list.length - 3} more</p>}
                </div>
                <div className="sm:hidden flex flex-wrap gap-0.5 mt-0.5">
                  {list.slice(0, 4).map((e) => (
                    <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${TYPE_META[e.type].cls}`} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <aside className="glass rounded-3xl border border-brand-200 dark:border-brand-900 p-4 space-y-3 self-start">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-brand-950 dark:text-white">{selected.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
          <button onClick={() => onCreateOn(selected)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-600 text-white text-[11px] font-black cursor-pointer">
            <Plus size={13} /> Task
          </button>
        </div>
        <AnimatePresence mode="popLayout">
          {selectedEvents.length === 0 && (
            <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-brand-400 py-6 text-center">
              Nothing scheduled. Double-click a day to add a task.
            </motion.p>
          )}
          {selectedEvents.map((e) => (
            <motion.button
              layout
              key={e.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              onClick={() => openEvent(e)}
              className="w-full flex items-start gap-2.5 p-2.5 rounded-2xl hover:bg-brand-100/70 dark:hover:bg-brand-900/50 text-left cursor-pointer"
            >
              <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${TYPE_META[e.type].cls}`} />
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-bold text-brand-900 dark:text-white truncate ${e.status === 'COMPLETED' ? 'line-through opacity-60' : ''}`}>{e.title}</span>
                <span className="block text-[11px] font-semibold text-brand-500">
                  {TYPE_META[e.type].label.replace(/s$/, '')} · {e.allDay ? 'All day' : `${formatTime(e.start)}${e.end ? ` – ${formatTime(e.end)}` : ''}`}
                  {e.status === 'OVERDUE' && <span className="text-rose-500 font-black"> · overdue</span>}
                </span>
              </span>
              {e.type === 'MEETING' && e.url && <Video size={14} className="text-violet-500 mt-1" />}
            </motion.button>
          ))}
        </AnimatePresence>
      </aside>
    </div>
  );
};

export default CalendarView;
