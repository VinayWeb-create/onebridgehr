import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  Plus, Sparkles, TrendingUp, Target, CheckCircle2, AlertTriangle, CalendarClock,
  Trophy, Rocket, BarChart3, LayoutGrid, Filter, Search, X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { goalsService, type Goal, type GoalStatus, type GoalType } from '../../services/goalsService';
import {
  ProgressRing, StatCard, GoalCard, StatusBadge, EmptyState, Avatar,
  GOAL_TYPES, TYPE_META, fmtDate,
} from './GoalsShared';

const roleIsPrivileged = (role?: string) => ['SUPER_ADMIN', 'HR', 'TEAM_LEAD'].includes(role || '');

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 120, damping: 18 } },
};

const GoalStatusFilter = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const options = ['ALL', 'ACTIVE', 'COMPLETED', 'ATTENTION'];
  return (
    <div className="flex items-center gap-1 p-1 glass rounded-2xl border border-brand-200 dark:border-brand-900">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
            value === o
              ? 'bg-gradient-to-r from-orange-500 to-indigo-600 text-white shadow-md'
              : 'text-brand-500 hover:text-brand-700 dark:hover:text-brand-300'
          }`}
        >
          {o === 'ACTIVE' ? 'Active' : o === 'ALL' ? 'All' : o === 'ATTENTION' ? 'Attention' : 'Done'}
        </button>
      ))}
    </div>
  );
};

export const GoalsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState<GoalType | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [showWizardTip, setShowWizardTip] = useState(false);

  const { data: dash, isLoading: dashLoading } = useQuery({ queryKey: ['goals-dash'], queryFn: goalsService.getDashboard });
  const { data: myGoals, isLoading: goalsLoading } = useQuery({ queryKey: ['goals-mine'], queryFn: goalsService.getMyGoals });
  const { data: career } = useQuery({ queryKey: ['goals-career'], queryFn: () => goalsService.getCareer() });
  const { data: recognition } = useQuery({ queryKey: ['goals-recognition'], queryFn: goalsService.getRecognition });

  useEffect(() => {
    const t = setTimeout(() => setShowWizardTip(true), 1200);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    let list = myGoals || [];
    if (filter === 'ACTIVE') list = list.filter((g) => !['COMPLETED', 'CANCELLED'].includes(g.status));
    if (filter === 'COMPLETED') list = list.filter((g) => g.status === 'COMPLETED');
    if (filter === 'ATTENTION') list = list.filter((g) => ['AT_RISK', 'BLOCKED', 'BEHIND'].includes(g.status));
    if (typeFilter !== 'ALL') list = list.filter((g) => g.goalType === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((g) => g.title.toLowerCase().includes(q) || g.description.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const rank = (s: GoalStatus) => ['BLOCKED', 'AT_RISK', 'BEHIND'].includes(s) ? 0 : s === 'ON_TRACK' ? 1 : 2;
      return rank(a.status) - rank(b.status) || (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity);
    });
  }, [myGoals, filter, typeFilter, search]);

  const attention = (myGoals || []).filter((g) => ['AT_RISK', 'BLOCKED', 'BEHIND'].includes(g.status));
  const dueSoon = (myGoals || []).filter((g) => g.dueDate && g.status !== 'COMPLETED' && g.status !== 'CANCELLED' && (() => { const d = new Date(g.dueDate); const diff = (d.getTime() - Date.now()) / 86400000; return diff >= 0 && diff <= 14; })());

  const loading = dashLoading || goalsLoading;

  return (
    <div className="space-y-6 relative">
      {/* Floating Create Button for Mobile */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.3 }}
        onClick={() => navigate('/goals/new')}
        className="md:hidden fixed bottom-6 right-6 z-40 w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-indigo-600 text-white shadow-2xl shadow-indigo-600/30 flex items-center justify-center cursor-pointer"
      >
        <Plus size={26} />
      </motion.button>

      {/* Hero */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative overflow-hidden glass rounded-3xl border border-brand-200 dark:border-brand-900 shadow-xl p-6 md:p-8"
      >
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-gradient-to-br from-orange-500/20 to-indigo-600/20 blur-3xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10">
          <div className="flex items-center gap-5 lg:gap-8">
            <ProgressRing progress={dash?.overallProgress || 0} size={128} stroke={11} />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest bg-orange-500/10 border border-orange-500/30 px-3 py-1 rounded-full">
                  {dash?.quarter || 'Quarter'}
                </span>
                <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full ${
                  dash?.completionTier === 'HIGH' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30' :
                  dash?.completionTier === 'MEDIUM' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/30' :
                  'bg-brand-500/10 text-brand-500 border border-brand-500/30'
                }`}>
                  {dash?.completionTier || '—'} momentum
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-brand-950 dark:text-white">
                Goals & OKRs
              </h1>
              <p className="text-xs text-brand-500 font-semibold max-w-md">
                {roleIsPrivileged() ? `Track ${dash?.teamCount || 0} goals across your organisation. ` : 'Your personal performance engine. '}
                Promotion readiness {dash?.promotionReadiness?.toLowerCase() || '—'} · Manager feedback: {dash?.managerFeedback?.toLowerCase() || '—'}.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link to="/goals/new" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-indigo-600 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 hover:shadow-xl hover:-translate-y-0.5 transition-all">
                  <Plus size={14} /> New Goal
                </Link>
                <Link to="/goals/analytics" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl glass border border-brand-200 dark:border-brand-900 text-brand-700 dark:text-brand-300 text-xs font-bold hover:bg-brand-100 dark:hover:bg-brand-900 transition-all">
                  <BarChart3 size={14} /> Analytics
                </Link>
              </div>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard title="Active" value={dash?.activeGoals ?? 0} icon={<Target size={20} />} tint="from-orange-500 to-amber-500" sub={`${dash?.avgProgress || 0}% avg`} />
            <StatCard title="Completed" value={dash?.completedGoals ?? 0} icon={<CheckCircle2 size={20} />} tint="from-emerald-500 to-teal-600" sub="all time" />
            <StatCard title="Needs Attention" value={dash?.attentionGoals ?? 0} icon={<AlertTriangle size={20} />} tint="from-rose-500 to-red-600" sub={`${dash?.attentionGoals || 0} at risk/blocked`} />
            <StatCard title="Due This Month" value={dash?.dueThisMonth ?? 0} icon={<CalendarClock size={20} />} tint="from-indigo-500 to-violet-600" sub={`${dash?.overdue || 0} overdue`} />
          </div>
        </div>
      </motion.div>

      {/* Career Insights + Recognition strip */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="grid md:grid-cols-3 gap-4">
        <Link to="/goals/career" className="glass rounded-2xl border border-brand-200 dark:border-brand-900 shadow-md p-5 hover:shadow-xl hover:-translate-y-0.5 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-brand-500 flex items-center gap-1.5"><TrendingUp size={13} className="text-indigo-500" /> Career Projection</span>
            <span className="text-[9px] font-black text-indigo-500 group-hover:translate-x-0.5 transition-transform">→</span>
          </div>
          <div className="mt-3 flex items-end gap-3">
            <span className="text-3xl font-black text-brand-950 dark:text-white">{career?.promotionScore || 0}<span className="text-sm text-brand-400 font-bold">%</span></span>
            <div className="pb-1">
              <p className="text-xs font-bold text-brand-950 dark:text-white">{career?.promotionReady || '—'}</p>
              <p className="text-[9px] text-brand-500 font-semibold">{career?.readinessLevel || '—'} readiness</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="text-[9px] font-bold px-2 py-1 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">Rating {career?.expectedRating ?? '—'}/5</span>
            <span className="text-[9px] font-bold px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">+{career?.suggestedHike ?? 0}% hike</span>
            {career?.bonusEligible && <span className="text-[9px] font-bold px-2 py-1 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Bonus 🔥</span>}
          </div>
        </Link>

        <Link to="/goals/recognition" className="glass rounded-2xl border border-brand-200 dark:border-brand-900 shadow-md p-5 hover:shadow-xl hover:-translate-y-0.5 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-brand-500 flex items-center gap-1.5"><Trophy size={13} className="text-amber-500" /> Recognition</span>
            <span className="text-[9px] font-black text-indigo-500 group-hover:translate-x-0.5 transition-transform">→</span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex -space-x-2">
              {(recognition?.leaderboard || []).slice(0, 4).map((e) => (
                <Avatar key={e.ownerId} name={e.name} img={e.profileImageUrl} size="w-8 h-8" />
              ))}
            </div>
            <div>
              <p className="text-xs font-bold text-brand-950 dark:text-white">Rank {recognition?.myRank ? `#${recognition.myRank}` : '—'}</p>
              <p className="text-[9px] text-brand-500 font-semibold">★ {recognition?.myPoints || 0} pts earned</p>
            </div>
          </div>
          {(recognition?.myAchievements || []).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(recognition?.myAchievements || []).slice(0, 2).map((a) => (
                <span key={a} className="text-[9px] font-bold px-2 py-1 rounded-lg bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 dark:from-amber-900/40 dark:to-orange-900/40 dark:text-amber-300">{a}</span>
              ))}
            </div>
          )}
        </Link>

        <Link to="/goals/timeline" className="glass rounded-2xl border border-brand-200 dark:border-brand-900 shadow-md p-5 hover:shadow-xl hover:-translate-y-0.5 transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-brand-500 flex items-center gap-1.5"><Rocket size={13} className="text-orange-500" /> Momentum</span>
            <span className="text-[9px] font-black text-indigo-500 group-hover:translate-x-0.5 transition-transform">→</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-brand-100/60 dark:bg-brand-900/50 py-2.5">
              <p className="text-lg font-black text-brand-950 dark:text-white">{dash?.totalGoals ?? 0}</p>
              <p className="text-[8px] font-bold text-brand-500 uppercase">Goals</p>
            </div>
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 py-2.5">
              <p className="text-lg font-black text-emerald-600">{dash?.completedGoals ?? 0}</p>
              <p className="text-[8px] font-bold text-emerald-600/70 uppercase">Done</p>
            </div>
            <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 py-2.5">
              <p className="text-lg font-black text-indigo-600">{dash?.teamCount ?? 0}</p>
              <p className="text-[8px] font-bold text-indigo-600/70 uppercase">Visible</p>
            </div>
          </div>
          <p className="text-[9px] text-brand-500 font-semibold mt-3 flex items-center gap-1.5"><BarChart3 size={11} /> Performance rating {dash?.performanceRating ?? '—'}/5</p>
        </Link>
      </motion.div>

      {/* Goals grid header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LayoutGrid size={16} className="text-indigo-500" />
          <h2 className="text-lg font-black tracking-tight text-brand-950 dark:text-white">My Goals</h2>
          <span className="text-[10px] font-bold text-brand-500">({filtered.length})</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search goals…"
              className="pl-9 pr-8 py-2 rounded-xl glass border border-brand-200 dark:border-brand-900 text-xs font-semibold text-brand-700 dark:text-brand-300 placeholder:text-brand-400 focus:outline-none focus:border-indigo-500 w-44"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-400 hover:text-rose-500 cursor-pointer">
                <X size={12} />
              </button>
            )}
          </div>
          <div className="relative">
            <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as GoalType | 'ALL')}
              className="pl-9 pr-8 py-2 rounded-xl glass border border-brand-200 dark:border-brand-900 text-xs font-semibold text-brand-700 dark:text-brand-300 focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer"
            >
              <option value="ALL">All types</option>
              {GOAL_TYPES.map((t) => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
            </select>
          </div>
          <GoalStatusFilter value={filter} onChange={setFilter} />
        </div>
      </div>

      {attention.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl border border-rose-500/30 bg-gradient-to-r from-rose-500/5 to-orange-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-rose-500" />
            <h3 className="text-xs font-black text-brand-950 dark:text-white uppercase tracking-wide">Needs your attention</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-2">
            {attention.slice(0, 3).map((g) => (
              <Link key={g.id} to={`/goals/${g.id}`} className="flex items-center gap-3 rounded-xl bg-white/60 dark:bg-brand-900/40 p-3 hover:shadow-md transition-all">
                <StatusBadge status={g.status} />
                <span className="text-xs font-bold text-brand-700 dark:text-brand-200 truncate flex-1">{g.title}</span>
                <span className="text-[10px] text-brand-500 font-semibold shrink-0">{fmtDate(g.dueDate)}</span>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl border border-brand-200 dark:border-brand-900 shadow-sm p-5 animate-pulse space-y-3">
              <div className="h-4 bg-brand-200 dark:bg-brand-800 rounded w-3/4" />
              <div className="h-2 bg-brand-100 dark:bg-brand-900 rounded" />
              <div className="h-2 bg-brand-100 dark:bg-brand-900 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search || typeFilter !== 'ALL' || filter !== 'ALL' ? 'No goals match your filters' : 'Ready to set your first goal?'}
          message={search || typeFilter !== 'ALL' || filter !== 'ALL' ? 'Try clearing a filter or searching differently.' : 'Use the 10-step AI coach to draft a goal, align it to your KPIs and start tracking weekly momentum.'}
          action={
            <Link to="/goals/new" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-indigo-600 text-white text-xs font-bold shadow-lg">
              <Sparkles size={14} /> Create your first OKR
            </Link>
          }
        />
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((goal) => (
            <motion.div key={goal.id} variants={item}>
              <GoalCard goal={goal} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {dueSoon.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl border border-amber-500/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock size={14} className="text-amber-500" />
            <h3 className="text-xs font-black text-brand-950 dark:text-white uppercase tracking-wide">Due within 14 days</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {dueSoon.map((g) => (
              <Link key={g.id} to={`/goals/${g.id}`} className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 hover:bg-amber-500/20 transition-all">
                <span className="text-[11px] font-bold text-brand-700 dark:text-brand-200">{g.title}</span>
                <span className="text-[9px] font-black text-amber-600 uppercase">{fmtDate(g.dueDate)}</span>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {dash && Object.keys(dash.byType).length > 0 && (
          <div className="glass rounded-2xl border border-brand-200 dark:border-brand-900 shadow-md p-5">
            <h3 className="text-xs font-black text-brand-950 dark:text-white uppercase tracking-wide mb-4">Goal distribution by type</h3>
            <div className="space-y-2.5">
              {dash.byType.map(({ type, count }) => {
                const meta = TYPE_META[type as GoalType] || TYPE_META.PROJECT;
                const max = Math.max(1, ...dash.byType.map((t) => t.count));
                return (
                  <div key={type} className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-brand-500 w-28 truncate">{meta.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-brand-100 dark:bg-brand-900 overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(count / max) * 100}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} className="h-full rounded-full bg-gradient-to-r from-orange-500 to-indigo-600" />
                    </div>
                    <span className="text-[10px] font-black text-brand-700 dark:text-brand-200 w-6 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {dash && Object.keys(dash.statusBreakdown).length > 0 && (
          <div className="glass rounded-2xl border border-brand-200 dark:border-brand-900 shadow-md p-5">
            <h3 className="text-xs font-black text-brand-950 dark:text-white uppercase tracking-wide mb-4">Status breakdown</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(dash.statusBreakdown).map(([status, count]) => (
                <div key={status} className="flex items-center gap-2 rounded-xl bg-brand-100/70 dark:bg-brand-900/50 px-3 py-2">
                  <StatusBadge status={status as GoalStatus} />
                  <span className="text-sm font-black text-brand-950 dark:text-white">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Wizard tip toast */}
      <AnimatePresence>
        {showWizardTip && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 hidden md:block"
          >
            <div className="glass rounded-2xl border border-indigo-500/40 shadow-2xl px-5 py-3.5 flex items-center gap-3">
              <Sparkles size={16} className="text-indigo-500" />
              <p className="text-xs font-bold text-brand-700 dark:text-brand-200">Tip: Use the <Link to="/goals/new" className="text-indigo-600 dark:text-orange-400 underline">AI Goal Coach</Link> to draft OKRs from a sentence.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GoalsDashboard;