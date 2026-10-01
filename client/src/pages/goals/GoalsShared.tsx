import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Target, Rocket, Users, User as UserIcon, GraduationCap, Lightbulb, TrendingUp, HeartHandshake,
  ShieldCheck, Package, Crown, Gauge, Calendar, AlertTriangle, Flag, CheckCircle2, Ban, Play, Pause,
} from 'lucide-react';
import type { Goal, GoalStatus, GoalType, GoalKeyResult } from '../../services/goalsService';

export const STATUS_META: Record<GoalStatus, { label: string; badge: string; bar: string; dot: string; icon: React.ReactNode }> = {
  NOT_STARTED: { label: 'Not Started', badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', bar: 'bg-slate-400', dot: 'bg-slate-400', icon: <Play size={11} /> },
  ON_TRACK: { label: 'On Track', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', bar: 'bg-emerald-500', dot: 'bg-emerald-500', icon: <CheckCircle2 size={11} /> },
  BEHIND: { label: 'Behind', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', bar: 'bg-amber-500', dot: 'bg-amber-500', icon: <Pause size={11} /> },
  AT_RISK: { label: 'At Risk', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300', bar: 'bg-orange-500', dot: 'bg-orange-500', icon: <AlertTriangle size={11} /> },
  BLOCKED: { label: 'Blocked', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300', bar: 'bg-rose-500', dot: 'bg-rose-500', icon: <Ban size={11} /> },
  COMPLETED: { label: 'Completed', badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300', bar: 'bg-indigo-500', dot: 'bg-indigo-500', icon: <Flag size={11} /> },
  CANCELLED: { label: 'Cancelled', badge: 'bg-brand-100 text-brand-500 dark:bg-brand-900/40 dark:text-brand-400', bar: 'bg-brand-400', dot: 'bg-brand-400', icon: <Ban size={11} /> },
};

export const TYPE_META: Record<GoalType, { label: string; icon: React.ReactNode; tint: string }> = {
  COMPANY: { label: 'Company', icon: <Crown size={15} />, tint: 'from-indigo-500 to-violet-600' },
  DEPARTMENT: { label: 'Department', icon: <Users size={15} />, tint: 'from-sky-500 to-indigo-600' },
  TEAM: { label: 'Team', icon: <Target size={15} />, tint: 'from-emerald-500 to-teal-600' },
  INDIVIDUAL: { label: 'Individual', icon: <UserIcon size={15} />, tint: 'from-orange-500 to-amber-500' },
  LEARNING: { label: 'Learning', icon: <GraduationCap size={15} />, tint: 'from-violet-500 to-purple-600' },
  INNOVATION: { label: 'Innovation', icon: <Lightbulb size={15} />, tint: 'from-rose-500 to-pink-600' },
  REVENUE: { label: 'Revenue', icon: <TrendingUp size={15} />, tint: 'from-emerald-500 to-green-600' },
  CUSTOMER_SUCCESS: { label: 'Customer Success', icon: <HeartHandshake size={15} />, tint: 'from-pink-500 to-rose-600' },
  QUALITY: { label: 'Quality', icon: <ShieldCheck size={15} />, tint: 'from-cyan-500 to-sky-600' },
  PROJECT: { label: 'Project', icon: <Package size={15} />, tint: 'from-amber-500 to-orange-600' },
  LEADERSHIP: { label: 'Leadership', icon: <Gauge size={15} />, tint: 'from-fuchsia-500 to-purple-600' },
  STRETCH: { label: 'Stretch', icon: <Rocket size={15} />, tint: 'from-red-500 to-rose-600' },
};

export const GOAL_TYPES = Object.keys(TYPE_META) as GoalType[];

export const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export const timeAgo = (d: string) => {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString();
};

export const initials = (name?: string) =>
  (name || '?').split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

export const ProgressRing: React.FC<{ progress: number; size?: number; stroke?: number; className?: string }> = ({
  progress: p,
  size = 120,
  stroke = 10,
  className,
}) => {
  const progress = Math.max(0, Math.min(100, p));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (progress / 100) * c;
  const color = progress >= 100 ? '#6366f1' : progress >= 60 ? '#10b981' : progress >= 30 ? '#f59e0b' : '#ef4444';
  return (
    <div className={`relative inline-flex items-center justify-center ${className || ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-brand-200 dark:stroke-brand-800" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: off }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black tracking-tight text-brand-950 dark:text-white">{progress}%</span>
      </div>
    </div>
  );
};

export const ProgressBar: React.FC<{ progress: number; className?: string }> = ({ progress, className }) => {
  const p = Math.max(0, Math.min(100, progress));
  const color = p >= 100 ? 'bg-indigo-500' : p >= 60 ? 'bg-emerald-500' : p >= 30 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className={`h-2 w-full rounded-full bg-brand-100 dark:bg-brand-900 overflow-hidden ${className || ''}`}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${p}%` }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className={`h-full ${color}`}
      />
    </div>
  );
};

export const StatusBadge: React.FC<{ status: GoalStatus }> = ({ status }) => {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${meta.badge}`}>
      {meta.icon}
      {meta.label}
    </span>
  );
};

export const TypeIcon: React.FC<{ type: GoalType; size?: number }> = ({ type, size }) => {
  const meta = TYPE_META[type] || TYPE_META.PROJECT;
  return (
    <span className={`w-9 h-9 rounded-xl bg-gradient-to-br ${meta.tint} text-white flex items-center justify-center shadow-md shrink-0`}>
      {meta.icon}
    </span>
  );
};

export const GoalCard: React.FC<{ goal: Goal }> = ({ goal }) => {
  const status = STATUS_META[goal.status] || STATUS_META.NOT_STARTED;
  const type = TYPE_META[goal.goalType] || TYPE_META.PROJECT;
  const overdue = goal.dueDate && goal.status !== 'COMPLETED' && goal.status !== 'CANCELLED' && new Date(goal.dueDate) < new Date();
  return (
    <Link
      to={`/goals/${goal.id}`}
      className="group glass rounded-2xl border border-brand-200 dark:border-brand-900 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 p-5 block"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <TypeIcon type={goal.goalType} />
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-brand-950 dark:text-white leading-snug group-hover:text-indigo-600 dark:group-hover:text-orange-400 line-clamp-2">{goal.title}</h3>
            <p className="text-[10px] font-semibold text-brand-500 mt-1 uppercase tracking-wide">{type.label} · {goal.department}</p>
          </div>
        </div>
        <StatusBadge status={goal.status} />
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex justify-between text-[10px] font-bold text-brand-500">
          <span>{goal.keyResults?.length || 0} Key Results</span>
          <span>{goal.progress}%</span>
        </div>
        <ProgressBar progress={goal.progress} />
      </div>

      <div className="mt-4 flex items-center justify-between text-[10px] text-brand-500 font-semibold">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-indigo-600 text-white flex items-center justify-center text-[8px] font-black shrink-0">
            {initials(goal.owner?.firstName && goal.owner?.lastName ? `${goal.owner.firstName} ${goal.owner.lastName}` : goal.ownerId)}
          </div>
          <span className="truncate">{goal.owner ? `${goal.owner.firstName} ${goal.owner.lastName}` : goal.ownerId}</span>
        </div>
        <span className={`flex items-center gap-1 ${overdue ? 'text-rose-500' : ''}`}>
          <Calendar size={11} />
          {fmtDate(goal.dueDate)}
        </span>
      </div>

      {(goal.points > 0 || goal.approvalStatus === 'PENDING_APPROVAL') && (
        <div className="mt-3 pt-3 border-t border-brand-100 dark:border-brand-900 flex items-center justify-between">
          {goal.points > 0 && (
            <span className="text-[10px] font-black text-amber-600 dark:text-amber-400">★ {goal.points} pts</span>
          )}
          {goal.approvalStatus === 'PENDING_APPROVAL' && (
            <span className="text-[9px] font-bold uppercase tracking-wide text-orange-500 animate-pulse">Pending Approval</span>
          )}
        </div>
      )}
    </Link>
  );
};

export const StatCard: React.FC<{
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  tint: string;
  sub?: string;
}> = ({ title, value, icon, tint, sub }) => (
  <div className="glass rounded-2xl border border-brand-200 dark:border-brand-900 shadow-md p-5 flex items-center gap-4 hover:shadow-lg transition-all">
    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${tint} text-white flex items-center justify-center shadow-md shrink-0`}>
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-[10px] font-bold text-brand-500 uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-black text-brand-950 dark:text-white leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-brand-500 font-semibold truncate">{sub}</p>}
    </div>
  </div>
);

export const EmptyState: React.FC<{ title: string; message: string; action?: React.ReactNode }> = ({ title, message, action }) => (
  <div className="glass rounded-3xl border border-dashed border-brand-300 dark:border-brand-800 p-10 text-center">
    <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-100 dark:bg-brand-900 flex items-center justify-center text-brand-400 mb-4">
      <Target size={26} />
    </div>
    <h3 className="font-bold text-brand-950 dark:text-white">{title}</h3>
    <p className="text-xs text-brand-500 mt-1 max-w-sm mx-auto">{message}</p>
    {action && <div className="mt-5 flex justify-center">{action}</div>}
  </div>
);

export const Avatar: React.FC<{ name?: string | null; img?: string | null; size?: string }> = ({ name, img, size = 'w-8 h-8' }) => (
  <div className={`${size} rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-orange-500 to-indigo-600 text-white font-black text-[10px] shrink-0 border-2 border-white dark:border-brand-900 shadow`}>
    {img ? <img src={img} alt={name || ''} className="w-full h-full object-cover" /> : <span>{initials(name || '?')}</span>}
  </div>
);

export const krProgress = (kr: GoalKeyResult) =>
  kr.progress !== undefined && kr.progress !== null
    ? Math.max(0, Math.min(100, Math.round(kr.progress)))
    : kr.target > 0
      ? Math.max(0, Math.min(100, Math.round((kr.current / kr.target) * 100)))
      : 0;