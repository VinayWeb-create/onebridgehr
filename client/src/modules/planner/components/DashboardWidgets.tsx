import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlarmClock, ArrowRight, CalendarCheck, CheckCircle2, Flame, Handshake, ListTodo, Video } from 'lucide-react';
import { useDashboard, useTaskMutations } from '../hooks';
import { formatDue, formatTime } from '../lib/time';
import { PriorityBadge } from './Badges';
import type { PlannerTask } from '../types';

const Row: React.FC<{ t: PlannerTask; onToggle: (t: PlannerTask) => void }> = ({ t, onToggle }) => {
  const navigate = useNavigate();
  return (
    <li className="flex items-center gap-2.5 py-1.5">
      <button onClick={() => onToggle(t)} className="text-brand-400 hover:text-emerald-500 cursor-pointer shrink-0" aria-label={`Complete ${t.title}`}>
        <CheckCircle2 size={16} className={t.status === 'COMPLETED' ? 'text-emerald-500' : ''} />
      </button>
      <button onClick={() => navigate(`/planner?task=${t.id}`)} className="min-w-0 flex-1 text-left cursor-pointer">
        <span className={`block text-xs font-bold truncate text-brand-900 dark:text-white ${t.status === 'COMPLETED' ? 'line-through opacity-60' : ''}`}>{t.title}</span>
        <span className={`block text-[10px] font-semibold ${t.isOverdue ? 'text-rose-500' : 'text-brand-400'}`}>{formatDue(t.dueAt, t.allDay)}</span>
      </button>
      <PriorityBadge priority={t.priority} compact />
    </li>
  );
};

/** Planner widgets for the main dashboard: today, overdue, upcoming, completed, high-priority, meetings and follow-ups. */
export const PlannerDashboardWidgets: React.FC = () => {
  const q = useDashboard();
  const { move } = useTaskMutations();
  if (q.isError || !q.data) return null; // never break the existing dashboard
  const d = q.data;
  const toggle = (t: PlannerTask) => move.mutate({ id: t.id, status: t.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED' });

  const stats = [
    { label: "Today's tasks", value: d.counts.today, icon: ListTodo, tone: 'from-indigo-500 to-sky-500' },
    { label: 'Overdue', value: d.counts.overdue, icon: AlarmClock, tone: 'from-rose-500 to-orange-500' },
    { label: 'Upcoming (7d)', value: d.counts.upcoming, icon: CalendarCheck, tone: 'from-violet-500 to-fuchsia-500' },
    { label: 'Completed today', value: d.counts.completedToday, icon: CheckCircle2, tone: 'from-emerald-500 to-teal-500' },
    { label: 'High priority', value: d.counts.highPriority, icon: Flame, tone: 'from-orange-500 to-amber-500' },
    { label: "Today's meetings", value: d.counts.meetingsToday, icon: Video, tone: 'from-indigo-500 to-violet-500' },
    { label: "Today's follow-ups", value: d.counts.followUpsToday, icon: Handshake, tone: 'from-sky-500 to-cyan-500' },
  ];

  const lists: Array<{ title: string; items: PlannerTask[]; empty: string }> = [
    { title: "Today's tasks", items: d.today, empty: 'Nothing due today 🎉' },
    { title: 'Overdue', items: d.overdue, empty: 'No overdue tasks' },
    { title: 'High priority', items: d.highPriority, empty: 'No high-priority tasks' },
  ];

  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3" aria-label="My planner">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black text-brand-950 dark:text-white">📋 My Planner</h2>
        <Link to="/planner" className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:gap-2 transition-all">
          Open planner <ArrowRight size={13} />
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2.5">
        {stats.map((s) => (
          <Link key={s.label} to="/planner" className="glass rounded-2xl border border-brand-200 dark:border-brand-900 p-3 hover:-translate-y-0.5 hover:shadow-lg transition-all">
            <span className={`inline-flex w-7 h-7 rounded-lg bg-gradient-to-br ${s.tone} text-white items-center justify-center`}>
              <s.icon size={14} />
            </span>
            <p className="mt-2 text-xl font-black tabular-nums text-brand-950 dark:text-white">{s.value}</p>
            <p className="text-[10px] font-bold text-brand-500 leading-tight">{s.label}</p>
          </Link>
        ))}
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
        {lists.map((l) => (
          <div key={l.title} className="glass rounded-2xl border border-brand-200 dark:border-brand-900 p-4">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-brand-500 mb-1">{l.title}</h3>
            {l.items.length === 0 ? <p className="text-xs text-brand-400 py-3">{l.empty}</p> : <ul>{l.items.slice(0, 5).map((t) => <Row key={t.id} t={t} onToggle={toggle} />)}</ul>}
          </div>
        ))}
        <div className="glass rounded-2xl border border-brand-200 dark:border-brand-900 p-4">
          <h3 className="text-[11px] font-black uppercase tracking-wider text-brand-500 mb-1">Today's meetings & follow-ups</h3>
          {d.meetings.length === 0 && d.followUps.length === 0 && <p className="text-xs text-brand-400 py-3">No meetings or follow-ups today</p>}
          <ul>
            {d.meetings.slice(0, 4).map((m) => (
              <li key={m.id} className="flex items-center gap-2 py-1.5 text-xs">
                <Video size={14} className="text-violet-500 shrink-0" />
                <span className="flex-1 truncate font-bold text-brand-900 dark:text-white">{m.title}</span>
                {m.link && /^https?:/.test(m.link) ? (
                  <a href={m.link} target="_blank" rel="noreferrer noopener" className="text-[10px] font-black text-indigo-500">
                    {formatTime(m.startTime)} · Join
                  </a>
                ) : (
                  <span className="text-[10px] font-bold text-brand-400">{formatTime(m.startTime)}</span>
                )}
              </li>
            ))}
            {d.followUps.slice(0, 4).map((t) => (
              <Row key={t.id} t={t} onToggle={toggle} />
            ))}
          </ul>
        </div>
      </div>
    </motion.section>
  );
};

export default PlannerDashboardWidgets;
