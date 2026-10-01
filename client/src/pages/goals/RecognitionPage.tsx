import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Award, Medal, Sparkles, Star, TrendingUp } from 'lucide-react';
import { goalsService } from '../../services/goalsService';
import { Avatar, GoalCard } from './GoalsShared';

const rankIcon = (rank: number) =>
  rank === 1 ? <Trophy size={18} className="text-amber-500" /> : rank === 2 ? <Medal size={18} className="text-slate-400" /> : rank === 3 ? <Medal size={18} className="text-orange-400" /> : null;

export const RecognitionPage: React.FC = () => {
  const { data, isLoading } = useQuery({ queryKey: ['goals-recognition'], queryFn: goalsService.getRecognition });

  if (isLoading) {
    return <div className="min-h-[50vh] flex items-center justify-center"><div className="text-center space-y-3"><div className="w-10 h-10 mx-auto rounded-2xl border-2 border-orange-500/30 border-t-orange-500 animate-spin" /><p className="text-xs font-bold text-brand-500">Loading the leaderboard…</p></div></div>;
  }
  if (!data) return <p className="text-center py-16 text-sm font-bold text-brand-500">No recognition data yet.</p>;

  const podium = data.leaderboard.slice(0, 3);
  const rest = data.leaderboard.slice(3);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black tracking-tight text-brand-950 dark:text-white flex items-center gap-2"><Trophy size={22} className="text-amber-500" /> Recognition & Leaderboard</h1>
        <p className="text-xs text-brand-500 font-semibold mt-1">Earn points by completing weighted OKRs. Top performers are celebrated every quarter.</p>
      </header>

      {/* My rank */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden glass rounded-3xl border border-brand-200 dark:border-brand-900 shadow-xl p-6">
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-lg">
              <Star size={30} />
            </div>
            <div>
              <p className="text-[10px] font-black text-brand-500 uppercase tracking-wider">My standing</p>
              <p className="text-2xl font-black text-brand-950 dark:text-white">{data.myRank ? `#${data.myRank}` : '—'}<span className="text-xs text-brand-400 font-bold"> / {data.leaderboard.length}</span></p>
              <p className="text-xs font-bold text-amber-600">★ {data.myPoints || 0} points earned</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 flex-1">
            {(data.myAchievements || []).map((a, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[10px] font-black px-3 py-2 rounded-xl bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 dark:from-amber-900/40 dark:to-orange-900/40 dark:text-amber-300 border border-amber-500/30"><Award size={12} /> {a}</span>
            ))}
          </div>
          <p className="text-[10px] font-bold text-brand-500">{data.totalCompleted || 0} goals completed organisation-wide</p>
        </div>
      </motion.div>

      {/* Podium */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="grid grid-cols-3 gap-3 items-end">
        {[podium[1], podium[0], podium[2]].filter(Boolean).map((p) => {
          const isFirst = p.rank === 1;
          return (
            <div key={p.ownerId} className={`glass rounded-3xl border shadow-xl p-5 text-center ${isFirst ? 'border-amber-500/50 bg-gradient-to-b from-amber-500/[0.08] to-transparent md:-translate-y-4' : 'border-brand-200 dark:border-brand-900'}`}>
              <div className="relative inline-block">
                <Avatar name={p.name} img={p.profileImageUrl} size="w-16 h-16" />
                <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center border-2 border-white dark:border-brand-950">{p.rank}</span>
              </div>
              <p className="text-sm font-black text-brand-950 dark:text-white mt-3 truncate">{p.name}</p>
              <p className="text-[9px] text-brand-500 font-semibold truncate">{p.designation}</p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="text-lg font-black text-amber-600">★ {p.points}</span>
                <span className="text-[9px] font-bold text-brand-500">{p.completed} done</span>
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-1">
                {(p.badges || []).slice(0, 2).map((b, i) => <span key={i} className="text-[8px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">{b}</span>)}
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* Rest of board */}
      <div className="glass rounded-3xl border border-brand-200 dark:border-brand-900 shadow-xl overflow-hidden">
        <div className="p-5 border-b border-brand-100 dark:border-brand-900">
          <h3 className="text-xs font-black text-brand-950 dark:text-white uppercase tracking-wide flex items-center gap-2"><TrendingUp size={14} className="text-orange-500" /> Full Leaderboard</h3>
        </div>
        <div className="divide-y divide-brand-100 dark:divide-brand-900">
          {rest.map((p, i) => (
            <div key={p.ownerId} className="px-5 py-3.5 flex items-center gap-3 hover:bg-brand-100/30 dark:hover:bg-brand-900/20 transition-colors">
              <span className="w-8 text-center text-xs font-black text-brand-500">{rankIcon(p.rank) || `#${p.rank}`}</span>
              <Avatar name={p.name} img={p.profileImageUrl} size="w-9 h-9" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-brand-900 dark:text-white truncate">{p.name}</p>
                <p className="text-[9px] text-brand-500 font-semibold">{p.designation}</p>
              </div>
              <div className="hidden sm:flex gap-1">
                {(p.badges || []).slice(0, 3).map((b, bi) => <span key={bi} className="text-[8px] font-black px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-300">{b}</span>)}
              </div>
              <div className="text-right shrink-0 w-24">
                <p className="text-sm font-black text-amber-600">★ {p.points}</p>
                <p className="text-[9px] text-brand-500 font-semibold">{p.completed} done</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent feed */}
      {(data.recentFeed || []).length > 0 && (
        <div>
          <h3 className="text-xs font-black text-brand-950 dark:text-white uppercase tracking-wide flex items-center gap-2 mb-4"><Sparkles size={14} className="text-indigo-500" /> Recent Achievements</h3>
          <div className="grid md:grid-cols-2 gap-3">
            {data.recentFeed.slice(0, 6).map((f) => (
              <Link key={f.id} to={`/goals/${f.goalId}`} className="glass rounded-2xl border border-brand-200 dark:border-brand-900 p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-start gap-3">
                <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shrink-0"><Trophy size={16} /></span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-brand-900 dark:text-white truncate">{f.actorName} · {f.title}</p>
                  <p className="text-[9px] text-brand-500 font-semibold mt-0.5 truncate">{new Date(f.timestamp).toLocaleDateString()}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {data.leaderboard.length === 0 && <p className="text-center py-10 text-sm font-bold text-brand-500">No ranked performers yet — complete goals to claim the top spot.</p>}
    </div>
  );
};

export default RecognitionPage;