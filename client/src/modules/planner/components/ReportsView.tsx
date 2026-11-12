import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Loader2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { downloadReportCsv, errorMessage, fetchReports } from '../api';
import { plannerKeys } from '../hooks';
import { CATEGORY_META } from '../lib/constants';
import type { TaskCategory } from '../types';

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

const Kpi: React.FC<{ label: string; value: React.ReactNode; hint?: string; tone?: string }> = ({ label, value, hint, tone = 'text-brand-950 dark:text-white' }) => (
  <div className="glass rounded-2xl border border-brand-200 dark:border-brand-900 p-4">
    <p className="text-[10px] font-black uppercase tracking-wider text-brand-500">{label}</p>
    <p className={`mt-1 text-2xl font-black tabular-nums ${tone}`}>{value}</p>
    {hint && <p className="text-[10px] font-semibold text-brand-400 mt-0.5">{hint}</p>}
  </div>
);

export const ReportsView: React.FC<{ onOpenTask: (id: string) => void }> = ({ onOpenTask }) => {
  const { user } = useAuth();
  const isManager = user?.role === 'TEAM_LEAD' || user?.role === 'HR' || user?.role === 'SUPER_ADMIN';
  const isAdmin = user?.role === 'HR' || user?.role === 'SUPER_ADMIN';
  const [days, setDays] = useState(30);
  const [scope, setScope] = useState<'MINE' | 'TEAM' | 'ALL'>('MINE');
  const [exporting, setExporting] = useState(false);

  const params = { from: new Date(Date.now() - days * 86_400_000).toISOString(), to: new Date().toISOString(), scope };
  const q = useQuery({ queryKey: plannerKeys.reports({ days, scope }), queryFn: () => fetchReports(params), staleTime: 60_000 });
  const s = q.data?.summary;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 p-1 glass rounded-2xl border border-brand-200 dark:border-brand-900">
          {RANGES.map((r) => (
            <button key={r.days} onClick={() => setDays(r.days)} className={`px-3 py-1.5 rounded-xl text-[11px] font-black cursor-pointer ${days === r.days ? 'bg-indigo-600 text-white' : 'text-brand-500'}`}>
              {r.label}
            </button>
          ))}
        </div>
        {isManager && (
          <div className="flex gap-1 p-1 glass rounded-2xl border border-brand-200 dark:border-brand-900">
            {(['MINE', 'TEAM', ...(isAdmin ? (['ALL'] as const) : [])] as const).map((sc) => (
              <button key={sc} onClick={() => setScope(sc)} className={`px-3 py-1.5 rounded-xl text-[11px] font-black cursor-pointer ${scope === sc ? 'bg-orange-500 text-white' : 'text-brand-500'}`}>
                {sc === 'MINE' ? 'Me' : sc === 'TEAM' ? 'My team' : 'Company'}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={async () => {
            setExporting(true);
            try {
              await downloadReportCsv(params);
            } finally {
              setExporting(false);
            }
          }}
          className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl glass border border-brand-200 dark:border-brand-900 text-xs font-bold text-brand-700 dark:text-brand-200 cursor-pointer"
        >
          {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Export CSV
        </button>
      </div>

      {q.isLoading && (
        <div className="py-16 flex justify-center">
          <Loader2 className="animate-spin text-indigo-500" />
        </div>
      )}
      {q.isError && <p className="text-sm text-rose-500">{errorMessage(q.error, 'Reports are unavailable offline.')}</p>}

      {s && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <Kpi label="Pending" value={s.pending} hint={`${s.inProgress} in progress`} />
            <Kpi label="Completed" value={s.completed} tone="text-emerald-600 dark:text-emerald-400" />
            <Kpi label="Overdue" value={s.overdue} tone={s.overdue ? 'text-rose-500' : undefined} />
            <Kpi label="Completion rate" value={`${s.completionRate}%`} />
            <Kpi label="On-time rate" value={`${s.onTimeRate}%`} hint="of completed tasks" />
            <Kpi label="Avg completion" value={s.avgCompletionHours === null ? '—' : s.avgCompletionHours < 48 ? `${s.avgCompletionHours}h` : `${Math.round(s.avgCompletionHours / 24)}d`} hint="created → done" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="glass rounded-3xl border border-brand-200 dark:border-brand-900 p-4">
              <h3 className="text-xs font-black text-brand-950 dark:text-white mb-3">Productivity · created vs completed</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={s.daily} margin={{ left: -20, right: 8, top: 4 }}>
                    <defs>
                      <linearGradient id="pc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-brand-200 dark:text-brand-800" />
                    <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 10 }} minTickGap={16} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                    <Area type="monotone" dataKey="created" stroke="#6366f1" fill="transparent" strokeWidth={2} name="Created" />
                    <Area type="monotone" dataKey="completed" stroke="#10b981" fill="url(#pc)" strokeWidth={2} name="Completed" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="glass rounded-3xl border border-brand-200 dark:border-brand-900 p-4">
              <h3 className="text-xs font-black text-brand-950 dark:text-white mb-3">By category</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={s.byCategory.map((c) => ({ ...c, name: CATEGORY_META[c.category as TaskCategory]?.label || c.category }))} margin={{ left: -20, right: 8, top: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-brand-200 dark:text-brand-800" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={48} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                    <Bar dataKey="total" fill="#6366f1" radius={[6, 6, 0, 0]} name="Total" />
                    <Bar dataKey="completed" fill="#f97316" radius={[6, 6, 0, 0]} name="Completed" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {scope !== 'MINE' && (
              <div className="glass rounded-3xl border border-brand-200 dark:border-brand-900 p-4 overflow-x-auto">
                <h3 className="text-xs font-black text-brand-950 dark:text-white mb-3">By person</h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-brand-400">
                      <th className="py-1.5 font-black">Employee</th>
                      <th className="font-black text-right">Total</th>
                      <th className="font-black text-right">Done</th>
                      <th className="font-black text-right">Overdue</th>
                      <th className="font-black text-right">Avg</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-100 dark:divide-brand-900">
                    {s.perEmployee.slice(0, 25).map((p) => (
                      <tr key={p.employeeId}>
                        <td className="py-2 font-bold text-brand-800 dark:text-brand-100">{p.name}</td>
                        <td className="text-right tabular-nums">{p.total}</td>
                        <td className="text-right tabular-nums text-emerald-600">{p.completed}</td>
                        <td className={`text-right tabular-nums ${p.overdue ? 'text-rose-500 font-bold' : ''}`}>{p.overdue}</td>
                        <td className="text-right tabular-nums text-brand-500">{p.avgCompletionHours === null ? '—' : `${p.avgCompletionHours}h`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="glass rounded-3xl border border-brand-200 dark:border-brand-900 p-4">
              <h3 className="text-xs font-black text-brand-950 dark:text-white mb-3">Overdue tasks</h3>
              {q.data!.overdueTasks.length === 0 && <p className="text-xs text-brand-400">Nothing overdue — great work! 🎉</p>}
              <ul className="space-y-1.5">
                {q.data!.overdueTasks.slice(0, 12).map((t) => (
                  <li key={t.id}>
                    <button onClick={() => onOpenTask(t.id)} className="w-full flex justify-between gap-2 text-left text-xs hover:text-indigo-600 cursor-pointer">
                      <span className="font-bold truncate">{t.title}</span>
                      <span className="text-rose-500 font-semibold shrink-0">{new Date(t.dueAt).toLocaleDateString()}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="glass rounded-3xl border border-brand-200 dark:border-brand-900 p-4">
              <h3 className="text-xs font-black text-brand-950 dark:text-white mb-3">Task history</h3>
              <ul className="space-y-2 max-h-72 overflow-y-auto">
                {q.data!.history.map((h) => (
                  <li key={h.id} className="text-xs text-brand-600 dark:text-brand-300">
                    <span className="font-black text-brand-800 dark:text-brand-100">{h.actorName}</span> {h.action.replace(/_/g, ' ').toLowerCase()}{' '}
                    <button onClick={() => onOpenTask(h.taskId)} className="font-bold text-indigo-600 dark:text-indigo-300 hover:underline cursor-pointer">
                      {h.taskTitle || 'a task'}
                    </button>
                    <span className="block text-[10px] text-brand-400">{new Date(h.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportsView;
