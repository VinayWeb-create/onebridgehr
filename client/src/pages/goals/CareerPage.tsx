import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, GraduationCap, Award, Target, Crown, Sparkles, Compass, Briefcase, ShieldCheck, BookOpen,
} from 'lucide-react';
import { goalsService } from '../../services/goalsService';
import { ProgressRing, ProgressBar, StatusBadge, EmptyState } from './GoalsShared';

export const CareerPage: React.FC = () => {
  const { data, isLoading } = useQuery({ queryKey: ['goals-career'], queryFn: () => goalsService.getCareer() });

  if (isLoading) {
    return <div className="min-h-[50vh] flex items-center justify-center"><div className="text-center space-y-3"><div className="w-10 h-10 mx-auto rounded-2xl border-2 border-orange-500/30 border-t-orange-500 animate-spin" /><p className="text-xs font-bold text-brand-500">Projecting your career path…</p></div></div>;
  }
  if (!data) return <EmptyState title="No career data" message="Create and complete goals to unlock your promotion projection." />;

  const readinessColor = data.readinessLevel === 'HIGH' ? 'text-emerald-600' : data.readinessLevel === 'MEDIUM' ? 'text-amber-500' : 'text-rose-500';

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black tracking-tight text-brand-950 dark:text-white flex items-center gap-2"><Compass size={22} className="text-indigo-500" /> Career Growth Projection</h1>
        <p className="text-xs text-brand-500 font-semibold mt-1">Your goals, skills and leadership signals feed this promotion-readiness model.</p>
      </header>

      {/* Hero score */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden glass rounded-3xl border border-brand-200 dark:border-brand-900 shadow-xl p-6 md:p-8">
        <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full bg-gradient-to-br from-indigo-500/20 to-orange-500/20 blur-3xl" />
        <div className="relative flex flex-col md:flex-row items-center gap-8">
          <div className="relative">
            <ProgressRing progress={data.promotionScore} size={150} stroke={13} />
            <span className="absolute inset-0 flex items-center justify-center pt-8 text-[10px] font-black text-brand-500 uppercase tracking-widest">ready</span>
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-wrap justify-center md:justify-start items-center gap-2">
              <span className={`text-sm font-black uppercase tracking-wider ${readinessColor}`}>{data.readinessLevel} readiness</span>
              {data.promotionRecommended && <span className="inline-flex items-center gap-1 text-[9px] font-black px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 dark:from-amber-900/40 dark:to-orange-900/40 dark:text-amber-300"><Crown size={11} /> Promotion recommended</span>}
              {data.bonusEligible && <span className="inline-flex items-center gap-1 text-[9px] font-black px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40"><Award size={11} /> Bonus eligible</span>}
            </div>
            <h2 className="text-2xl font-black text-brand-950 dark:text-white mt-2">{data.promotionReady}</h2>
            <p className="text-xs text-brand-500 font-semibold mt-1">Leadership signal: {data.leadershipStrength}</p>
            <div className="mt-4 grid grid-cols-3 gap-3 max-w-md mx-auto md:mx-0">
              <div className="rounded-xl bg-white/60 dark:bg-brand-900/50 p-3"><p className="text-lg font-black text-brand-950 dark:text-white">{data.expectedRating}<span className="text-xs text-brand-400">/5</span></p><p className="text-[8px] font-bold text-brand-500 uppercase">Expected rating</p></div>
              <div className="rounded-xl bg-white/60 dark:bg-brand-900/50 p-3"><p className="text-lg font-black text-emerald-600">+{data.suggestedHike}%</p><p className="text-[8px] font-bold text-brand-500 uppercase">Hike</p></div>
              <div className="rounded-xl bg-white/60 dark:bg-brand-900/50 p-3"><p className="text-lg font-black text-indigo-600">{data.managerConfidence}%</p><p className="text-[8px] font-bold text-brand-500 uppercase">Mgr conf.</p></div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Future roles */}
      {(data.futureRoles || []).length > 0 && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-2xl border border-brand-200 dark:border-brand-900 shadow-md p-5">
          <h3 className="text-xs font-black text-brand-950 dark:text-white uppercase tracking-wide flex items-center gap-2 mb-3"><Briefcase size={14} className="text-indigo-500" /> Future Roles</h3>
          <div className="flex flex-wrap gap-2">
            {data.futureRoles.map((r, i) => <span key={i} className="text-[10px] font-black px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-500/10 to-orange-500/10 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300">{r}</span>)}
          </div>
        </motion.div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Skill coverage */}
        <div className="glass rounded-2xl border border-brand-200 dark:border-brand-900 shadow-md p-5">
          <h3 className="text-xs font-black text-brand-950 dark:text-white uppercase tracking-wide flex items-center gap-2 mb-3"><Target size={14} className="text-emerald-500" /> Skill Coverage</h3>
          <div className="flex items-center gap-4 mb-4">
            <ProgressRing progress={data.skillsMatched} size={80} stroke={8} />
            <p className="text-xs text-brand-600 dark:text-brand-400 font-semibold">of target skills matched through goals and learning.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(data.skills || []).map((s, i) => <span key={i} className="text-[9px] font-bold px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">{s}</span>)}
          </div>
        </div>

        {/* Goal completion */}
        <div className="glass rounded-2xl border border-brand-200 dark:border-brand-900 shadow-md p-5">
          <h3 className="text-xs font-black text-brand-950 dark:text-white uppercase tracking-wide flex items-center gap-2 mb-3"><ShieldCheck size={14} className="text-orange-500" /> Delivery Track Record</h3>
          <div className="flex items-center gap-4 mb-4">
            <ProgressRing progress={data.goalCompletion} size={80} stroke={8} />
            <div>
              <p className="text-xs font-bold text-brand-900 dark:text-white">{data.goalCompletion}% goals completed</p>
              <p className="text-[10px] text-brand-500 font-semibold mt-1">Career score now <span className="font-black text-indigo-600">{data.careerScore}</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent learning */}
      {(data.recentLearning || []).length > 0 && (
        <div>
          <h3 className="text-xs font-black text-brand-950 dark:text-white uppercase tracking-wide flex items-center gap-2 mb-4"><BookOpen size={14} className="text-indigo-500" /> Recent Learning Goals</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.recentLearning.map((l, i) => (
              <div key={i} className="glass rounded-2xl border border-brand-200 dark:border-brand-900 shadow-md p-5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <StatusBadge status={l.status} />
                  <GraduationCap size={16} className="text-indigo-400" />
                </div>
                <p className="text-xs font-bold text-brand-900 dark:text-white">{l.title}</p>
                <div className="mt-3"><ProgressBar progress={l.progress} /><p className="text-[9px] font-bold text-brand-500 mt-1">{l.progress}%</p></div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 glass rounded-2xl border border-brand-200 dark:border-brand-900 p-4 text-xs text-brand-500 font-semibold">
        <Sparkles size={14} className="text-indigo-500 shrink-0" />
        Keep your skills current and hit your OKRs to raise this projection.
        <Link to="/goals" className="ml-auto inline-flex items-center gap-1 text-[10px] font-black text-indigo-500 hover:underline">Your goals <TrendingUp size={11} /></Link>
      </div>
    </div>
  );
};

export default CareerPage;