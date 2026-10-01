import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';
import { Link } from 'react-router-dom';
import { TrendingUp, Award, AlertTriangle, Activity, Building2, CalendarClock } from 'lucide-react';
import { goalsService } from '../../services/goalsService';
import { StatCard, GoalCard, EmptyState, StatusBadge, TYPE_META } from './GoalsShared';

const COLORS = ['#6366f1', '#f97316', '#10b981', '#8b5cf6', '#ef4444', '#f59e0b', '#06b6d4', '#ec4899'];

const tooltipStyle = {
  borderRadius: 14,
  border: '1px solid rgba(99,102,241,0.25)',
  background: 'rgba(255,255,255,0.9)',
  fontSize: 11,
  fontWeight: 700,
  boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
};
const axisProps = { fontSize: 10, stroke: '#94a3b8' };

export const GoalsAnalyticsPage: React.FC = () => {
  const { data, isLoading } = useQuery({ queryKey: ['goals-analytics'], queryFn: goalsService.getAnalytics });

  const totalCompleted = data?.completionTrend.reduce((s, q) => s + (q.completed || 0), 0) || 0;
  const avgRate = data?.completionTrend.length
    ? Math.round((data.completionTrend.reduce((s, q) => s + (q.rate || 0), 0) / data.completionTrend.length) * 10) / 10
    : 0;

  if (isLoading) {
    return <div className="min-h-[50vh] flex items-center justify-center"><div className="text-center space-y-3"><div className="w-10 h-10 mx-auto rounded-2xl border-2 border-orange-500/30 border-t-orange-500 animate-spin" /><p className="text-xs font-bold text-brand-500">Crunching OKR analytics…</p></div></div>;
  }
  if (!data) return <EmptyState title="No analytics" message="Create some goals and they will appear here." />;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black tracking-tight text-brand-950 dark:text-white">Goals Analytics</h1>
        <p className="text-xs text-brand-500 font-semibold mt-1">Organisation-wide OKR performance, velocity and risk intelligence.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Completed" value={totalCompleted} icon={<Award size={20} />} tint="from-emerald-500 to-teal-600" />
        <StatCard title="Avg Completion Rate" value={`${avgRate}%`} icon={<TrendingUp size={20} />} tint="from-indigo-500 to-violet-600" />
        <StatCard title="Risk Goals" value={data.riskGoals.length} icon={<AlertTriangle size={20} />} tint="from-rose-500 to-red-600" />
        <StatCard title="Depts Tracked" value={Object.keys(data.departmentComparison || {}).length} icon={<Building2 size={20} />} tint="from-orange-500 to-amber-500" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Completion trend */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl border border-brand-200 dark:border-brand-900 shadow-xl p-6">
          <h3 className="text-sm font-black text-brand-950 dark:text-white uppercase tracking-wide mb-1">Completion Trend</h3>
          <p className="text-[10px] text-brand-500 font-semibold mb-4">Quarterly goal completion rate vs average progress</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.completionTrend}>
                <defs>
                  <linearGradient id="rate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="avg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="quarter" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 10, fontWeight: 700 }} />
                <Area type="monotone" dataKey="rate" name="Completion %" stroke="#6366f1" strokeWidth={2.5} fill="url(#rate)" />
                <Area type="monotone" dataKey="avgProgress" name="Avg progress %" stroke="#f97316" strokeWidth={2} fill="url(#avg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Department comparison */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-3xl border border-brand-200 dark:border-brand-900 shadow-xl p-6">
          <h3 className="text-sm font-black text-brand-950 dark:text-white uppercase tracking-wide mb-1">Department Comparison</h3>
          <p className="text-[10px] text-brand-500 font-semibold mb-4">Goals tracked vs completed per department</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.departmentComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="department" {...axisProps} tick={{ fontSize: 9 }} interval={0} angle={-12} textAnchor="end" height={44} />
                <YAxis {...axisProps} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
                <Legend wrapperStyle={{ fontSize: 10, fontWeight: 700 }} />
                <Bar dataKey="total" name="Total" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Top performers */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-3xl border border-brand-200 dark:border-brand-900 shadow-xl p-6">
          <h3 className="text-sm font-black text-brand-950 dark:text-white uppercase tracking-wide mb-1">Top Performers</h3>
          <p className="text-[10px] text-brand-500 font-semibold mb-4">Scored on completion, progress and weighted points</p>
          <div className="space-y-3">
            {data.topPerformers.slice(0, 6).map((p, i) => (
              <div key={p.ownerId} className="flex items-center gap-3 rounded-xl bg-brand-100/40 dark:bg-brand-900/40 p-3">
                <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${i === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md' : 'bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-300'}`}>
                  {i === 0 ? <Award size={15} /> : `#${i + 1}`}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-brand-900 dark:text-white truncate">{p.ownerName}</p>
                  <p className="text-[9px] text-brand-500 font-semibold">{p.completed}/{p.total} completed · ${p.points || 0} pts</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-indigo-600">{p.score || p.avgProgress}%</p>
                  <p className="text-[9px] font-bold text-brand-500 uppercase">score</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Completion by type */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass rounded-3xl border border-brand-200 dark:border-brand-900 shadow-xl p-6">
          <h3 className="text-sm font-black text-brand-950 dark:text-white uppercase tracking-wide mb-1">Goals by Type</h3>
          <p className="text-[10px] text-brand-500 font-semibold mb-4">Portfolio distribution across goal types</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.completionByType.map((d) => ({ ...d, name: TYPE_META[d.type as keyof typeof TYPE_META]?.label || d.type }))} dataKey="count" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {(data.completionByType || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 10, fontWeight: 700 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Ageing + heatmap */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass rounded-3xl border border-brand-200 dark:border-brand-900 shadow-xl p-6">
          <h3 className="text-sm font-black text-brand-950 dark:text-white uppercase tracking-wide flex items-center gap-2 mb-1"><CalendarClock size={15} className="text-amber-500" /> Goal Ageing</h3>
          <p className="text-[10px] text-brand-500 font-semibold mb-4">How long goals have been in-flight without completion</p>
          <div className="flex items-end gap-2 h-40">
            {(data.aging || []).map((a, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-black text-brand-700 dark:text-brand-200">{a.count}</span>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(6, Math.min(100, (a.count / Math.max(1, ...(data.aging || []).map((x) => x.count))) * 100))}%` }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: i * 0.06 }}
                  className={`w-full rounded-t-xl ${i >= (data.aging || []).length - 2 ? 'bg-gradient-to-t from-orange-500 to-rose-500' : 'bg-gradient-to-t from-indigo-500 to-violet-500'}`}
                />
                <span className="text-[8px] font-bold text-brand-500 uppercase text-center">{a.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-3xl border border-brand-200 dark:border-brand-900 shadow-xl p-6">
          <h3 className="text-sm font-black text-brand-950 dark:text-white uppercase tracking-wide flex items-center gap-2 mb-1"><Activity size={15} className="text-emerald-500" /> Progress Heatmap</h3>
          <p className="text-[10px] text-brand-500 font-semibold mb-4">Weekly progress momentum across the org</p>
          <div className="flex flex-wrap gap-1.5">
            {(data.heatmap || []).map((h: any, i: number) => {
              const p = Number(h.progress) || 0;
              const bg = p >= 75 ? 'bg-emerald-500' : p >= 50 ? 'bg-emerald-400' : p >= 25 ? 'bg-amber-400' : p > 0 ? 'bg-orange-400' : 'bg-brand-200 dark:bg-brand-800';
              return (
                <div key={i} className="flex-1 min-w-12 text-center">
                  <div className={`h-10 rounded-lg ${bg} flex items-center justify-center text-[10px] font-black text-white shadow-sm`}>{h.count || 0}</div>
                  <p className="text-[7px] font-bold text-brand-400 uppercase mt-1">{h.week}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Risk goals */}
      {(data.riskGoals || []).length > 0 && (
        <div>
          <h3 className="text-sm font-black text-brand-950 dark:text-white uppercase tracking-wide flex items-center gap-2 mb-4"><AlertTriangle size={15} className="text-rose-500" /> Risk Flags</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.riskGoals.map((g) => (
              <div key={g.id} className="glass rounded-2xl border border-rose-500/30 p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <StatusBadge status={g.status} />
                  <Link to={`/goals/${g.id}`} className="text-[10px] font-black text-indigo-500 hover:underline">Open →</Link>
                </div>
                <Link to={`/goals/${g.id}`} className="text-xs font-bold text-brand-900 dark:text-white hover:text-indigo-600 transition-colors line-clamp-2">{g.title}</Link>
                <p className="text-[10px] text-brand-500 font-semibold mt-2">{g.owner ? `${g.owner.firstName} ${g.owner.lastName}` : g.ownerId} · {g.department}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(data.riskGoals || []).length === 0 && (data.topPerformers || []).length === 0 && (
        <EmptyState title="Not enough data yet" message="Goals need check-ins and progress updates to power these analytics." />
      )}
    </div>
  );
};

export default GoalsAnalyticsPage;