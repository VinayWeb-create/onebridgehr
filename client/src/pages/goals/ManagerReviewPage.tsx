import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, CheckCircle2, AlertTriangle, Ban, Clock, Star, Search, UserCheck, Activity, ArrowRight,
} from 'lucide-react';
import { goalsService } from '../../services/goalsService';
import { Avatar, StatusBadge, ProgressBar, StatCard, GoalCard, EmptyState } from './GoalsShared';

export const ManagerReviewPage: React.FC = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['goals-manager-review'], queryFn: goalsService.getManagerReview });

  const review = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'APPROVED' | 'REJECTED' }) => goalsService.reviewGoal(id, { decision }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals-manager-review'] }),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (data?.employees || []).filter((e) => !q || e.ownerName.toLowerCase().includes(q) || e.department.toLowerCase().includes(q));
  }, [data, search]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black tracking-tight text-brand-950 dark:text-white">Manager Review</h1>
        <p className="text-xs text-brand-500 font-semibold mt-1">Approve goal submissions, track your team's momentum and jump in where support is needed.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Team Members" value={data?.summary.totalEmployees ?? 0} icon={<Users size={20} />} tint="from-indigo-500 to-violet-600" sub={`${data?.summary.totalGoals || 0} goals`} />
        <StatCard title="Completed (week)" value={data?.summary.completedThisWeek ?? 0} icon={<CheckCircle2 size={20} />} tint="from-emerald-500 to-teal-600" />
        <StatCard title="Needs Support" value={data?.summary.supportNeeded ?? 0} icon={<AlertTriangle size={20} />} tint="from-rose-500 to-red-600" sub={`${data?.summary.blockedGoals || 0} blocked`} />
        <StatCard title="Pending Approvals" value={data?.summary.pendingApprovals ?? 0} icon={<Clock size={20} />} tint="from-orange-500 to-amber-500" />
      </div>

      {/* Approval queue */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl border border-brand-200 dark:border-brand-900 shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black text-brand-950 dark:text-white uppercase tracking-wide flex items-center gap-2">
            <UserCheck size={15} className="text-indigo-500" /> Approval Queue
            <span className="text-[10px] font-bold text-brand-400">({data?.approvalQueue.length || 0})</span>
          </h2>
        </div>
        {!data?.approvalQueue.length ? (
          <EmptyState title="Queue clear" message="No goals are waiting for your approval right now." />
        ) : (
          <div className="space-y-3">
            {data.approvalQueue.map((g) => (
              <div key={g.id} className="rounded-2xl bg-brand-100/40 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-800 p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Avatar name={g.owner ? `${g.owner.firstName} ${g.owner.lastName}` : g.ownerId} img={g.owner?.profileImageUrl} size="w-9 h-9" />
                  <div className="min-w-0">
                    <Link to={`/goals/${g.id}`} className="text-xs font-bold text-brand-900 dark:text-white hover:text-indigo-600 transition-colors line-clamp-1">{g.title}</Link>
                    <p className="text-[10px] text-brand-500 font-semibold">{g.owner ? `${g.owner.firstName} ${g.owner.lastName}` : g.ownerId} · {g.priority} · {g.department}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-24">
                    <ProgressBar progress={g.progress} />
                    <p className="text-[9px] font-bold text-brand-500 mt-1 text-right">{g.progress}%</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => review.mutate({ id: g.id, decision: 'APPROVED' })} disabled={review.isPending} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase shadow-lg cursor-pointer disabled:opacity-50 transition-all hover:bg-emerald-700"><CheckCircle2 size={12} /> Approve</button>
                    <button onClick={() => review.mutate({ id: g.id, decision: 'REJECTED' })} disabled={review.isPending} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-600 text-white text-[10px] font-black uppercase shadow-lg cursor-pointer disabled:opacity-50 transition-all hover:bg-rose-700"><Ban size={12} /> Reject</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Team roster */}
      <div className="glass rounded-3xl border border-brand-200 dark:border-brand-900 shadow-xl overflow-hidden">
        <div className="p-6 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h2 className="text-sm font-black text-brand-950 dark:text-white uppercase tracking-wide flex items-center gap-2">
            <Users size={15} className="text-orange-500" /> Team Roster
          </h2>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search team…" className="pl-9 pr-3 py-2 rounded-xl glass border border-brand-200 dark:border-brand-900 text-xs font-semibold text-brand-700 dark:text-brand-300 placeholder:text-brand-400 focus:outline-none focus:border-indigo-500 w-52" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-y border-brand-200/70 dark:border-brand-800/70 bg-brand-100/40 dark:bg-brand-900/30">
                {['Employee', 'Goals', 'Avg Progress', 'Blocked', 'At Risk', 'Behind', 'Due Soon', 'Support', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-[9px] font-black uppercase tracking-wider text-brand-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-xs font-bold text-brand-500">Loading roster…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-xs font-bold text-brand-500">No team members found.</td></tr>
              ) : (
                filtered.map((e) => (
                  <tr key={e.ownerId} className="border-b border-brand-100 dark:border-brand-900/60 hover:bg-brand-100/30 dark:hover:bg-brand-900/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={e.ownerName} img={e.profileImageUrl} size="w-8 h-8" />
                        <div>
                          <p className="text-xs font-bold text-brand-900 dark:text-white">{e.ownerName}</p>
                          <p className="text-[9px] text-brand-500 font-semibold">{e.designation} · {e.department}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-black text-brand-900 dark:text-white">{e.total}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16"><ProgressBar progress={e.avgProgress} /></div>
                        <span className="text-[10px] font-bold text-brand-700 dark:text-brand-300">{e.avgProgress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className={`text-[10px] font-black ${e.blocked > 0 ? 'text-rose-500' : 'text-brand-300'}`}>{e.blocked}</span></td>
                    <td className="px-4 py-3"><span className={`text-[10px] font-black ${e.atRisk > 0 ? 'text-orange-500' : 'text-brand-300'}`}>{e.atRisk}</span></td>
                    <td className="px-4 py-3"><span className={`text-[10px] font-black ${e.behind > 0 ? 'text-amber-500' : 'text-brand-300'}`}>{e.behind}</span></td>
                    <td className="px-4 py-3"><span className={`text-[10px] font-black ${e.dueSoon > 0 ? 'text-amber-600' : 'text-brand-300'}`}>{e.dueSoon}</span></td>
                    <td className="px-4 py-3">
                      {e.needsSupport > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"><AlertTriangle size={10} /> {e.needsSupport}</span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><Link to={`/goals?owner=${e.ownerId}`} className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-500 hover:text-indigo-600"><Star size={11} /> View</Link></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upcoming deadlines */}
      {(data?.upComing || []).length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data?.upComing || []).slice(0, 6).map((g) => <GoalCard key={g.id} goal={g} />)}
        </motion.div>
      )}

      {/* Recent activity */}
      <div className="glass rounded-2xl border border-brand-200 dark:border-brand-900 shadow-md p-5">
        <h3 className="text-xs font-black text-brand-950 dark:text-white uppercase tracking-wide flex items-center gap-2 mb-4"><Activity size={14} className="text-brand-500" /> Activity Events <span className="text-brand-400">{data?.summary.activityEvents || 0}</span></h3>
        <p className="text-xs text-brand-500 font-semibold">Check the <Link to="/goals/timeline" className="text-indigo-500 inline-flex items-center gap-1 hover:underline">timeline <ArrowRight size={11} /></Link> for the full org activity feed.</p>
      </div>
    </div>
  );
};

export default ManagerReviewPage;