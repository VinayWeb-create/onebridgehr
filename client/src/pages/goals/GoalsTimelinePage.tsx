import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  GitCommit, Flag, Gauge, MessageCircle, Sparkles, UserPlus, Pencil, Search, Activity,
} from 'lucide-react';
import { goalsService } from '../../services/goalsService';
import { Avatar, timeAgo } from './GoalsShared';

const typeMeta: Record<string, { icon: React.ReactNode; tint: string; label: string }> = {
  CREATED: { icon: <Pencil size={12} />, tint: 'text-indigo-500 bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300', label: 'Created' },
  UPDATED: { icon: <Pencil size={12} />, tint: 'text-sky-500 bg-sky-100 dark:bg-sky-900/40 dark:text-sky-300', label: 'Updated' },
  PROGRESS: { icon: <Gauge size={12} />, tint: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300', label: 'Progress' },
  CHECKIN: { icon: <Gauge size={12} />, tint: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300', label: 'Check-in' },
  COMMENT: { icon: <MessageCircle size={12} />, tint: 'text-orange-500 bg-orange-100 dark:bg-orange-900/40 dark:text-orange-300', label: 'Comment' },
  APPROVED: { icon: <Flag size={12} />, tint: 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300', label: 'Approved' },
  REJECTED: { icon: <Flag size={12} />, tint: 'text-rose-500 bg-rose-100 dark:bg-rose-900/40 dark:text-rose-300', label: 'Rejected' },
  COMPLETED: { icon: <Flag size={12} />, tint: 'text-indigo-500 bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300', label: 'Completed' },
  ASSIGNED: { icon: <UserPlus size={12} />, tint: 'text-violet-500 bg-violet-100 dark:bg-violet-900/40 dark:text-violet-300', label: 'Assigned' },
  AI: { icon: <Sparkles size={12} />, tint: 'text-fuchsia-500 bg-fuchsia-100 dark:bg-fuchsia-900/40 dark:text-fuchsia-300', label: 'AI' },
};

export const GoalsTimelinePage: React.FC = () => {
  const { data, isLoading } = useQuery({ queryKey: ['goals-timeline'], queryFn: goalsService.getTimeline });
  const [search, setSearch] = useState('');
  const [type, setType] = useState('ALL');

  const grouped = useMemo(() => {
    let list = data || [];
    const q = search.toLowerCase();
    if (q) list = list.filter((e) => e.goalTitle.toLowerCase().includes(q) || e.message.toLowerCase().includes(q) || e.actorName.toLowerCase().includes(q));
    if (type !== 'ALL') list = list.filter((e) => e.type === type);
    const byDay: Record<string, typeof list> = {};
    [...list].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).forEach((e) => {
      const day = new Date(e.timestamp).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      (byDay[day] = byDay[day] || []).push(e);
    });
    return { byDay, total: list.length };
  }, [data, search, type]);

  const typeOptions = Object.keys(typeMeta);

  if (isLoading) {
    return <div className="min-h-[50vh] flex items-center justify-center"><div className="text-center space-y-3"><div className="w-10 h-10 mx-auto rounded-2xl border-2 border-orange-500/30 border-t-orange-500 animate-spin" /><p className="text-xs font-bold text-brand-500">Loading the objective ledger…</p></div></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-brand-950 dark:text-white flex items-center gap-2"><GitCommit size={22} className="text-indigo-500" /> Objective Ledger</h1>
          <p className="text-xs text-brand-500 font-semibold mt-1">A Git-style history of every goal event across the organisation.</p>
        </div>
        <span className="text-[10px] font-black text-brand-500 bg-brand-100 dark:bg-brand-900 rounded-xl px-3 py-2 inline-flex items-center gap-1.5 w-fit"><Activity size={12} /> {grouped.total} events</span>
      </header>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search goals, people or messages…" className="w-full pl-9 pr-3 py-2.5 rounded-xl glass border border-brand-200 dark:border-brand-900 text-xs font-semibold text-brand-700 dark:text-brand-300 focus:outline-none focus:border-indigo-500" />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} className="px-3 py-2.5 rounded-xl glass border border-brand-200 dark:border-brand-900 text-xs font-semibold text-brand-700 dark:text-brand-300 focus:outline-none cursor-pointer">
          <option value="ALL">All event types</option>
          {typeOptions.map((t) => <option key={t} value={t}>{typeMeta[t].label}</option>)}
        </select>
      </div>

      {grouped.total === 0 ? (
        <div className="glass rounded-3xl border border-dashed border-brand-300 dark:border-brand-800 p-12 text-center">
          <GitCommit size={28} className="text-brand-400 mx-auto mb-3" />
          <h3 className="font-bold text-brand-950 dark:text-white">No events yet</h3>
          <p className="text-xs text-brand-500 mt-1">Goal activity will stream in here as the team works their OKRs.</p>
        </div>
      ) : (
        Object.entries(grouped.byDay).map(([day, events]) => (
          <div key={day}>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-brand-500 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gradient-to-r from-orange-500 to-indigo-600" /> {day}
            </h2>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative pl-6">
              <span className="absolute left-1.5 top-2 bottom-2 w-px bg-brand-200 dark:bg-brand-800" />
              <div className="space-y-3">
                {events.map((e) => {
                  const meta = typeMeta[e.type] || typeMeta.UPDATED;
                  return (
                    <div key={e.id} className="relative flex items-start gap-3">
                      <span className={`absolute -left-6 top-1 w-3 h-3 rounded-full ring-4 ring-white dark:ring-brand-950 ${meta.tint}`} />
                      <div className="flex-1 min-w-0 rounded-2xl glass border border-brand-200 dark:border-brand-900 p-3.5 hover:shadow-md transition-all">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Avatar name={e.actorName} size="w-6 h-6" />
                          <span className="text-[11px] font-black text-brand-900 dark:text-white">{e.actorName}</span>
                          <span className={`inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg ${meta.tint}`}>{meta.icon} {meta.label}</span>
                          <span className="ml-auto text-[9px] font-bold text-brand-500">{timeAgo(e.timestamp)}</span>
                        </div>
                        <p className="text-xs text-brand-700 dark:text-brand-300 mt-2 leading-relaxed">{e.message}</p>
                        <Link to={`/goals/${e.goalId}`} className="inline-flex items-center gap-1.5 mt-2 text-[10px] font-bold text-indigo-600 dark:text-orange-400 hover:underline">
                          <GitCommit size={11} /> {e.goalTitle}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        ))
      )}
    </div>
  );
};

export default GoalsTimelinePage;