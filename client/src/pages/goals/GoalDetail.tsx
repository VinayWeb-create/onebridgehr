import React, { useState, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Target, Calendar, User as UserIcon, Flag, Star, Send, Plus, Rocket, Sparkles,
  AlertTriangle, Trash2, CheckCircle2, XCircle, Gauge, BookOpen, BrainCircuit, Loader2, TrendingUp,
  Pencil, KeyRound, MessagesSquare, History,
} from 'lucide-react';
import { goalsService, type Goal, type GoalKeyResult, type GoalStatus } from '../../services/goalsService';
import {
  ProgressRing, ProgressBar, StatusBadge, TypeIcon, Avatar, timeAgo, fmtDate,
  STATUS_META, krProgress,
} from './GoalsShared';

const isPriv = (r?: string) => ['SUPER_ADMIN', 'HR', 'TEAM_LEAD'].includes(r || '');

const KRSection: React.FC<{ goal: Goal; onRefresh: () => void; canEdit: boolean }> = ({ goal, onRefresh, canEdit }) => {
  const updating = useMutation({
    mutationFn: (krs: Partial<GoalKeyResult>[]) => goalsService.updateGoal(goal.id, { keyResults: krs as any }),
    onSuccess: onRefresh,
  });
  const [draft, setDraft] = useState<(Partial<GoalKeyResult> & { __new?: boolean })[]>(goal.keyResults || []);
  const [editing, setEditing] = useState(false);

  const setDraftAt = (i: number, patch: Partial<GoalKeyResult>) =>
    setDraft((d) => d.map((kr, idx) => (idx === i ? { ...kr, ...patch } : kr)));

  const pushDraft = () => setDraft((d) => [...d, { id: `new_${Date.now()}`, title: '', current: 0, target: 100, unit: '%', progress: 0, __new: true }]);
  const removeDraft = (i: number) => setDraft((d) => d.filter((_, idx) => idx !== i));

  const save = async () => {
    const clean = draft
      .filter((kr) => kr.title?.trim())
      .map((kr) => {
        const target = Number(kr.target) || 0;
        const current = Number(kr.current) || 0;
        return {
          title: kr.title?.trim(),
          current,
          target,
          unit: kr.unit || '%',
          progress: target > 0 ? Math.round((current / target) * 100) : 0,
          confidence: (kr as any).confidence ?? null,
        };
      });
    await updating.mutateAsync(clean as any);
    setEditing(false);
  };

  return (
    <div className="glass rounded-2xl border border-brand-200 dark:border-brand-900 shadow-md p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-black text-brand-950 dark:text-white uppercase tracking-wide flex items-center gap-2">
          <KeyRound size={14} className="text-indigo-500" /> Key Results
        </h3>
        {canEdit && !editing && (
          <button onClick={() => { setDraft(goal.keyResults || []); setEditing(true); }} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300 hover:bg-indigo-100 transition-all cursor-pointer">
            <Pencil size={11} /> Edit
          </button>
        )}
      </div>

      <div className="space-y-3">
        {(editing ? draft : goal.keyResults || []).map((kr, i) => (
          <div key={kr.id || i} className="rounded-xl bg-brand-100/50 dark:bg-brand-900/40 p-3.5 border border-brand-200/60 dark:border-brand-800/60">
            {editing ? (
              <div className="space-y-2">
                <input
                  value={kr.title || ''}
                  onChange={(e) => setDraftAt(i, { title: e.target.value })}
                  placeholder="Key result title"
                  className="w-full text-xs font-bold text-brand-800 dark:text-white bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
                />
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[9px] font-bold text-brand-500 uppercase">Current</label>
                    <input type="number" value={kr.current || 0} onChange={(e) => setDraftAt(i, { current: Number(e.target.value) })} className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-brand-500 uppercase">Target</label>
                    <input type="number" value={kr.target || 0} onChange={(e) => setDraftAt(i, { target: Number(e.target.value) })} className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-brand-500 uppercase">Unit</label>
                    <input value={kr.unit || '%'} onChange={(e) => setDraftAt(i, { unit: e.target.value })} className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  {(kr as any).__new && (
                    <button onClick={() => removeDraft(i)} className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer">Remove</button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold text-brand-800 dark:text-brand-200">{kr.title}</p>
                  <span className="text-[10px] font-black text-brand-700 dark:text-brand-200 shrink-0">
                    {kr.current} / {kr.target}{kr.unit ? ` ${kr.unit}` : ''}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <ProgressBar progress={krProgress(kr as GoalKeyResult)} className="flex-1" />
                  <span className="text-[10px] font-black text-brand-700 dark:text-brand-200 w-9 text-right">{krProgress(kr as GoalKeyResult)}%</span>
                </div>
              </div>
            )}
          </div>
        ))}
        {editing && (
          <div className="flex gap-2">
            <button onClick={pushDraft} className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-dashed border-brand-300 dark:border-brand-700 text-[10px] font-black uppercase text-brand-500 hover:text-indigo-600 hover:border-indigo-500 transition-all cursor-pointer">
              <Plus size={12} /> Add key result
            </button>
            <button onClick={save} disabled={updating.isPending} className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-indigo-600 text-white text-[10px] font-black uppercase shadow-lg disabled:opacity-50 cursor-pointer">
              {updating.isPending ? 'Saving…' : 'Save KRs'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const CheckInSection: React.FC<{ goal: Goal; onRefresh: () => void; canCheckIn: boolean }> = ({ goal, onRefresh, canCheckIn }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ progress: goal.progress, wins: '', problems: '', nextActions: '', status: goal.status });
  const mut = useMutation({
    mutationFn: () => goalsService.addCheckIn(goal.id, { progress: form.progress, wins: form.wins, problems: form.problems, nextActions: form.nextActions, status: form.status }),
    onSuccess: () => { setOpen(false); setForm({ progress: goal.progress, wins: '', problems: '', nextActions: '', status: goal.status }); onRefresh(); },
  });

  return (
    <div className="glass rounded-2xl border border-brand-200 dark:border-brand-900 shadow-md p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-black text-brand-950 dark:text-white uppercase tracking-wide flex items-center gap-2">
          <Gauge size={14} className="text-emerald-500" /> Weekly Check-ins
        </h3>
        {canCheckIn && (
          <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide bg-gradient-to-r from-orange-500 to-indigo-600 text-white shadow-md hover:shadow-lg transition-all cursor-pointer">
            <Plus size={11} /> {open ? 'Close' : 'Check in'}
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-b border-brand-100 dark:border-brand-900 pb-4 mb-4">
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[10px] font-bold text-brand-500 mb-1"><span>Progress</span><span>{form.progress}%</span></div>
                <input type="range" min={0} max={100} value={form.progress} onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })} className="w-full accent-orange-500 cursor-pointer" />
              </div>
              <input value={form.wins} onChange={(e) => setForm({ ...form, wins: e.target.value })} placeholder="Wins this week" className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500" />
              <input value={form.problems} onChange={(e) => setForm({ ...form, problems: e.target.value })} placeholder="Problems / blockers" className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500" />
              <input value={form.nextActions} onChange={(e) => setForm({ ...form, nextActions: e.target.value })} placeholder="Next actions" className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500" />
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as GoalStatus })} className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 cursor-pointer">
                {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <button onClick={() => mut.mutate()} disabled={mut.isPending} className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-black shadow-lg hover:shadow-xl disabled:opacity-50 transition-all cursor-pointer">
                {mut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} />} Submit Check-in
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {goal.checkIns.length === 0 ? (
        <p className="text-xs text-brand-500 font-semibold text-center py-6">No check-ins yet. Weekly momentum keeps goals alive.</p>
      ) : (
        <div className="space-y-3">
          {[...goal.checkIns].reverse().slice(0, 6).map((c) => (
            <div key={c.id} className="rounded-xl bg-brand-100/50 dark:bg-brand-900/40 p-3.5 border border-brand-200/60 dark:border-brand-800/60">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar name={c.authorName} size="w-6 h-6" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-brand-800 dark:text-brand-200 truncate">{c.authorName}</p>
                    <p className="text-[9px] text-brand-500 font-semibold">{c.weekLabel}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.status && <StatusBadge status={c.status as GoalStatus} />}
                  <span className="text-xs font-black text-indigo-600">{c.progress}%</span>
                </div>
              </div>
              <div className="mt-2">
                <ProgressBar progress={c.progress} />
              </div>
              {(c.wins || c.problems || c.nextActions) && (
                <div className="mt-2.5 space-y-1">
                  {c.wins && <p className="text-[10px] text-brand-600 dark:text-brand-400"><span className="font-black text-emerald-600">Wins: </span>{c.wins}</p>}
                  {c.problems && <p className="text-[10px] text-brand-600 dark:text-brand-400"><span className="font-black text-rose-500">Blockers: </span>{c.problems}</p>}
                  {c.nextActions && <p className="text-[10px] text-brand-600 dark:text-brand-400"><span className="font-black text-indigo-500">Next: </span>{c.nextActions}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const CommentsSection: React.FC<{ goal: Goal; onRefresh: () => void; me: { id?: string; name: string; role?: string } }> = ({ goal, onRefresh, me }) => {
  const [body, setBody] = useState('');
  const mut = useMutation({
    mutationFn: () => goalsService.addComment(goal.id, { content: body, isManager: isPriv(me.role) }),
    onSuccess: () => { setBody(''); onRefresh(); },
  });
  const canComment = me.id === goal.ownerId || me.id === goal.managerId || me.id === (goal.assignedById as string) || isPriv(me.role);

  return (
    <div className="glass rounded-2xl border border-brand-200 dark:border-brand-900 shadow-md p-5">
      <h3 className="text-xs font-black text-brand-950 dark:text-white uppercase tracking-wide mb-4 flex items-center gap-2">
        <MessagesSquare size={14} className="text-indigo-500" /> Discussion
      </h3>
      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {(goal.comments || []).length === 0 && <p className="text-xs text-brand-500 font-semibold text-center py-4">Start the conversation.</p>}
        {[...(goal.comments || [])].reverse().map((c) => (
          <div key={c.id} className="flex gap-2.5">
            <Avatar name={c.authorName} img={null} size="w-7 h-7" />
            <div className="flex-1 min-w-0 rounded-xl bg-brand-100/60 dark:bg-brand-900/40 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-black text-brand-900 dark:text-white flex items-center gap-1.5">
                  {c.authorName}
                  {c.isManager && <span className="text-[8px] font-black uppercase text-indigo-500 bg-indigo-500/10 border border-indigo-500/30 px-1.5 py-0.5 rounded">Manager</span>}
                </p>
                <span className="text-[9px] text-brand-500 font-semibold">{timeAgo(c.timestamp)}</span>
              </div>
              <p className="text-xs text-brand-700 dark:text-brand-300 mt-1">{c.content}</p>
            </div>
          </div>
        ))}
      </div>
      {canComment && (
        <div className="mt-3 flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && body.trim()) mut.mutate(); }}
            placeholder="Add a comment…"
            className="flex-1 text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500"
          />
          <button onClick={() => body.trim() && mut.mutate()} disabled={mut.isPending} className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-indigo-600 text-white disabled:opacity-50 cursor-pointer">
            <Send size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

const AiPanel: React.FC<{ goal: Goal; isPrivileged: boolean }> = ({ goal, isPrivileged }) => {
  const [tab, setTab] = useState<'predict' | 'flags' | 'milestones' | 'learning' | 'update' | 'wording'>('predict');
  const [text, setText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = async (action: string, payload: any = {}) => {
    setLoading(true);
    setResult(null);
    const allowedEmployee = ['predict_completion', 'detect_unrealistic', 'generate_weekly_update'];
    if (!isPrivileged && !allowedEmployee.includes(action)) return;
    try {
      const r = await goalsService.aiAssist(action, payload);
      setResult({ action, ...r });
    } catch (e: any) {
      setResult({ action, error: e?.response?.data?.message || 'AI assist failed' });
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { key: 'predict', label: 'Predict', icon: <TrendingUp size={12} /> },
    { key: 'flags', label: 'Risk Check', icon: <AlertTriangle size={12} /> },
    { key: 'milestones', label: 'Milestones', icon: <Flag size={12} /> },
    { key: 'learning', label: 'Learning', icon: <BookOpen size={12} /> },
    { key: 'update', label: 'Write-up', icon: <Send size={12} /> },
  ] as const;

  const renderBody = () => {
    if (loading) return <div className="py-10 flex justify-center"><Loader2 size={22} className="animate-spin text-indigo-500" /></div>;
    if (!result) {
      return (
        <div className="py-6 text-center space-y-3">
          <BrainCircuit size={28} className="text-indigo-500 mx-auto" />
          <p className="text-[11px] text-brand-500 font-semibold">I'll analyse this goal, predict completion, flag risks and suggest next moves.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button onClick={() => run('predict_completion', { goal })} className="text-[10px] font-black px-3 py-2 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300 cursor-pointer hover:bg-indigo-100 transition-all">Predict completion</button>
            <button onClick={() => run('detect_unrealistic', { goal })} className="text-[10px] font-black px-3 py-2 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300 cursor-pointer hover:bg-rose-100 transition-all">Check realism</button>
          </div>
        </div>
      );
    }
    if (result.error) return <p className="py-6 text-center text-xs text-rose-500 font-bold">{result.error}</p>;

    switch (result.action) {
      case 'predict_completion':
        return (
          <div className="space-y-3 py-2">
            <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/30 p-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-wider text-indigo-500">{result.status}</p>
              <p className="text-3xl font-black text-indigo-600 mt-1">{result.confidence}%</p>
              <p className="text-[10px] text-brand-500 font-semibold mt-1">{result.projectedCompletion}{result.daysLeft !== undefined ? ` · ${result.daysLeft}d left` : ''}</p>
            </div>
            <div className="rounded-xl bg-brand-100/60 dark:bg-brand-900/40 p-3">
              <p className="text-[9px] font-black text-brand-500 uppercase mb-1">Pace needed</p>
              <div className="flex items-baseline gap-2"><span className="text-xl font-black text-brand-950 dark:text-white">{result.paceNeededPerDay}%/day</span></div>
            </div>
            {result.suggestion && <p className="text-[11px] text-brand-600 dark:text-brand-300 font-semibold">💡 {result.suggestion}</p>}
          </div>
        );
      case 'detect_unrealistic':
        return (
          <div className="space-y-2 py-2">
            {(result.flags || []).map((f: string, i: number) => (
              <div key={i} className="flex gap-2 items-start rounded-xl bg-rose-50 dark:bg-rose-900/20 p-3">
                <AlertTriangle size={13} className="text-rose-500 mt-0.5 shrink-0" />
                <p className="text-[11px] font-semibold text-brand-700 dark:text-brand-300">{f}</p>
              </div>
            ))}
          </div>
        );
      case 'milestones':
        return (
          <div className="space-y-2 py-2">
            {(result.milestones || []).map((m: any, i: number) => (
              <div key={i} className="flex gap-3 rounded-xl bg-brand-100/60 dark:bg-brand-900/40 p-3">
                <span className="text-[9px] font-black text-indigo-500 bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-2 py-1 h-fit shrink-0">{m.week}</span>
                <p className="text-[11px] font-semibold text-brand-700 dark:text-brand-300">{m.focus}</p>
              </div>
            ))}
          </div>
        );
      case 'learning':
        return (
          <div className="space-y-2 py-2">
            {(result.recommendations || []).map((r: any, i: number) => (
              <div key={i} className="rounded-xl bg-brand-100/60 dark:bg-brand-900/40 p-3 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-black text-brand-900 dark:text-white">{r.course}</p>
                  <p className="text-[9px] text-brand-500 font-semibold">Skill: {r.skill} · {r.durationWeeks}w · {r.provider}</p>
                </div>
                <span className="text-[9px] font-black px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">{r.impact}</span>
              </div>
            ))}
          </div>
        );
      case 'update':
        return (
          <div className="py-2">
            {text && (
              <div className="rounded-xl bg-brand-100/60 dark:bg-brand-900/40 p-4 text-[11px] text-brand-700 dark:text-brand-300 font-semibold leading-relaxed">{result.update || ''}</div>
            )}
            {!text && (
              <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={'Wins / Blockers / Next actions…'} className="w-full min-h-[80px] text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl p-3 focus:outline-none focus:border-indigo-500" />
            )}
          </div>
        );
      default:
        return <p className="text-[11px] text-brand-500 font-semibold py-4 text-center">{JSON.stringify(result)}</p>;
    }
  };

  return (
    <div className="glass rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/[0.04] to-orange-500/[0.03] shadow-md p-5">
      <div className="flex items-center gap-2 mb-4">
        <BrainCircuit size={15} className="text-indigo-500" />
        <h3 className="text-xs font-black text-brand-950 dark:text-white uppercase tracking-wide">AI Goal Coach</h3>
        <span className="ml-auto text-[8px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-500 border border-indigo-500/30 px-2 py-0.5 rounded-full">BETA</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setResult(null); if (t.key === 'milestones') run('suggest_milestones', { goal }); }} className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all cursor-pointer ${tab === t.key ? 'bg-gradient-to-r from-orange-500 to-indigo-600 text-white shadow-md' : 'bg-brand-100 dark:bg-brand-900 text-brand-500 hover:text-indigo-600'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {tab === 'update' ? (
        <div className="space-y-2">
          {text && <button onClick={() => { run('generate_weekly_update', { goal: { ...goal, wins: text, problems: text, nextActions: text, progress: goal.progress } }); }} className="w-full text-[10px] font-black py-2 rounded-lg bg-gradient-to-r from-orange-500 to-indigo-600 text-white cursor-pointer">Generate manager-ready update</button>}
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={'Wins · Blockers · Next actions (one per line)'} className="w-full min-h-[70px] text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl p-3 focus:outline-none focus:border-indigo-500" />
        </div>
      ) : (
        renderBody()
      )}
    </div>
  );
};

export const GoalDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const userCache = JSON.parse(localStorage.getItem('user') || '{}');
  const me = { id: userCache.employeeId as string | undefined, name: `${userCache.firstName || ''} ${userCache.lastName || ''}`.trim(), role: userCache.role };

  const { data: goal, isLoading, refetch } = useQuery({
    queryKey: ['goal', id],
    queryFn: () => goalsService.getGoalById(id as string),
    enabled: !!id,
  });

  const refresh = () => { refetch(); };

  const quickProgress = useMutation({
    mutationFn: (p: number) => goalsService.updateProgress(goal!.id, { progress: p }),
    onSuccess: refresh,
  });

  const review = useMutation({
    mutationFn: (decision: 'APPROVED' | 'REJECTED') => goalsService.reviewGoal(goal!.id, { decision }),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: () => goalsService.deleteGoal(goal!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); navigate('/goals'); },
  });

  const canEdit = useMemo(() => !!goal && (goal.ownerId === me.id || goal.assignedById === me.id || isPriv(me.role)), [goal, me]);
  const canReview = useMemo(() => !!goal && goal.approvalStatus === 'PENDING_APPROVAL' && (goal.managerId === me.id || isPriv(me.role)), [goal, me.id, me.role]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 mx-auto rounded-2xl border-2 border-orange-500/30 border-t-orange-500 animate-spin" />
          <p className="text-xs font-bold text-brand-500">Loading goal…</p>
        </div>
      </div>
    );
  }
  if (!goal) return <p className="text-center py-16 text-sm font-bold text-brand-500">Goal not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/goals" className="inline-flex items-center gap-1.5 text-xs font-black text-brand-500 hover:text-indigo-600 transition-colors">
          <ArrowLeft size={14} /> All Goals
        </Link>
        <div className="flex items-center gap-2">
          {canEdit && goal.status !== 'COMPLETED' && goal.status !== 'CANCELLED' && (
            <div className="flex items-center gap-1">
              {[25, 50, 75, 100].map((p) => (
                <button key={p} onClick={() => quickProgress.mutate(p)} disabled={quickProgress.isPending} className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all cursor-pointer disabled:opacity-50 ${goal.progress === p || (p === 100 && goal.status === 'COMPLETED') ? 'bg-gradient-to-r from-orange-500 to-indigo-600 text-white shadow-md' : 'bg-brand-100 dark:bg-brand-900 text-brand-500 hover:bg-brand-200'}`}>
                  {p === 100 ? 'Done' : `${p}%`}
                </button>
              ))}
            </div>
          )}
          {canEdit && (
            <button onClick={() => remove.mutate()} disabled={remove.isPending} className="p-2 rounded-xl bg-rose-50 text-rose-500 dark:bg-rose-900/30 dark:text-rose-400 hover:bg-rose-100 transition-all cursor-pointer" title="Delete goal">
              <Trash2 size={14} />
            </button>
          )}
          {canReview && (
            <div className="flex gap-1.5">
              <button onClick={() => review.mutate('APPROVED')} disabled={review.isPending} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase shadow-lg cursor-pointer disabled:opacity-50"><CheckCircle2 size={12} /> Approve</button>
              <button onClick={() => review.mutate('REJECTED')} disabled={review.isPending} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-600 text-white text-[10px] font-black uppercase shadow-lg cursor-pointer disabled:opacity-50"><XCircle size={12} /> Reject</button>
            </div>
          )}
        </div>
      </div>

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden glass rounded-3xl border border-brand-200 dark:border-brand-900 shadow-xl p-6 md:p-8">
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-gradient-to-br from-orange-500/15 to-indigo-600/15 blur-3xl" />
        <div className="relative">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <TypeIcon type={goal.goalType} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <StatusBadge status={goal.status} />
                  <span className="text-[9px] font-black uppercase tracking-wider bg-brand-100 dark:bg-brand-900 text-brand-500 px-2 py-1 rounded-lg">{goal.priority}</span>
                  <span className="text-[9px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 px-2 py-1 rounded-lg">Weight ×{goal.weight}</span>
                  {goal.isCompanyGoal && <span className="text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-1 rounded-lg">Company-wide</span>}
                  <span className="text-[9px] font-black uppercase tracking-wider bg-brand-100 dark:bg-brand-900 text-brand-500 px-2 py-1 rounded-lg">{goal.visibility}</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-brand-950 dark:text-white leading-tight">{goal.title}</h1>
                {goal.description && <p className="text-xs text-brand-600 dark:text-brand-400 font-semibold mt-2 max-w-2xl">{goal.description}</p>}
              </div>
            </div>
            <div className="flex md:flex-col items-center md:items-end gap-4 shrink-0">
              <ProgressRing progress={goal.progress} size={92} stroke={9} />
              <div className="flex flex-wrap gap-2 md:justify-end justify-center">
                {goal.kpiName && <span className="text-[9px] font-bold px-2.5 py-1 rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">📊 {goal.kpiName}: {goal.kpiCurrent ?? 0} → {goal.kpiTarget}{goal.kpiUnit || ''}</span>}
                <span className="text-[9px] font-bold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">★ {goal.points} pts</span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl bg-white/50 dark:bg-brand-900/40 p-3">
              <p className="text-[9px] font-black text-brand-500 uppercase flex items-center gap-1"><Calendar size={10} /> Window</p>
              <p className="text-xs font-bold text-brand-900 dark:text-white mt-1">{fmtDate(goal.startDate)}{goal.dueDate ? ` → ${fmtDate(goal.dueDate)}` : ''}</p>
            </div>
            <div className="rounded-xl bg-white/50 dark:bg-brand-900/40 p-3">
              <p className="text-[9px] font-black text-brand-500 uppercase flex items-center gap-1"><UserIcon size={10} /> Owner</p>
              <div className="flex items-center gap-2 mt-1">
                <Avatar name={goal.owner ? `${goal.owner.firstName} ${goal.owner.lastName}` : goal.ownerId} img={goal.owner?.profileImageUrl} size="w-6 h-6" />
                <p className="text-xs font-bold text-brand-900 dark:text-white truncate">{goal.owner ? `${goal.owner.firstName} ${goal.owner.lastName}` : goal.ownerId}</p>
              </div>
            </div>
            <div className="rounded-xl bg-white/50 dark:bg-brand-900/40 p-3">
              <p className="text-[9px] font-black text-brand-500 uppercase flex items-center gap-1"><Star size={10} /> Manager</p>
              <p className="text-xs font-bold text-brand-900 dark:text-white mt-1 truncate">{goal.managerName || goal.managerId || 'Unassigned'}</p>
            </div>
            <div className="rounded-xl bg-white/50 dark:bg-brand-900/40 p-3">
              <p className="text-[9px] font-black text-brand-500 uppercase flex items-center gap-1"><Rocket size={10} /> Approval</p>
              <p className={`text-xs font-black mt-1 ${goal.approvalStatus === 'APPROVED' ? 'text-emerald-600' : goal.approvalStatus === 'REJECTED' ? 'text-rose-500' : 'text-orange-500'}`}>{goal.approvalStatus.replace('_', ' ')}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Body */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <KRSection goal={goal} onRefresh={refresh} canEdit={canEdit} />
          <CheckInSection goal={goal} onRefresh={refresh} canCheckIn={canEdit} />
          <CommentsSection goal={goal} onRefresh={refresh} me={me} />

          {/* Activity */}
          <div className="glass rounded-2xl border border-brand-200 dark:border-brand-900 shadow-md p-5">
            <h3 className="text-xs font-black text-brand-950 dark:text-white uppercase tracking-wide mb-4 flex items-center gap-2">
              <History size={14} className="text-brand-500" /> Activity Log
            </h3>
            <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
              {goal.activities.length === 0 && <p className="text-xs text-brand-500 font-semibold text-center py-4">No activity yet.</p>}
              {[...goal.activities].reverse().slice(0, 20).map((a, i) => (
                <div key={a.id || i} className="flex gap-3 relative pb-3">
                  {i < Math.min(goal.activities.length - 1, 19) && <span className="absolute left-[11px] top-6 bottom-0 w-px bg-brand-200 dark:bg-brand-800" />}
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 ${a.type === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40' : a.type === 'CHECKIN' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/40' : a.type === 'COMMENT' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40' : 'bg-brand-100 text-brand-500 dark:bg-brand-900'}`}>
                    {a.type === 'COMPLETED' ? <Flag size={11} /> : a.type === 'CHECKIN' ? <Gauge size={11} /> : a.type === 'COMMENT' ? <MessagesSquare size={11} /> : <Sparkles size={11} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-brand-700 dark:text-brand-300">{a.message}</p>
                    <p className="text-[9px] text-brand-500 font-semibold">{a.actorName} · {timeAgo(a.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <AiPanel goal={goal} isPrivileged={isPriv(me.role)} />

          {/* Details sidebar */}
          <div className="glass rounded-2xl border border-brand-200 dark:border-brand-900 shadow-md p-5 space-y-4">
            <h3 className="text-xs font-black text-brand-950 dark:text-white uppercase tracking-wide">Details</h3>
            {goal.businessObjective && (
              <div>
                <p className="text-[9px] font-black text-brand-500 uppercase mb-0.5">Business Objective</p>
                <p className="text-[11px] font-semibold text-brand-700 dark:text-brand-300">{goal.businessObjective}</p>
              </div>
            )}
            {goal.businessImpact && (
              <div>
                <p className="text-[9px] font-black text-brand-500 uppercase mb-0.5">Business Impact</p>
                <p className="text-[11px] font-semibold text-brand-700 dark:text-brand-300">{goal.businessImpact}</p>
              </div>
            )}
            {goal.departmentKpi && (
              <div>
                <p className="text-[9px] font-black text-brand-500 uppercase mb-0.5">Department KPI</p>
                <p className="text-[11px] font-semibold text-brand-700 dark:text-brand-300">{goal.departmentKpi}</p>
              </div>
            )}
            {goal.linkedProject && (
              <div>
                <p className="text-[9px] font-black text-brand-500 uppercase mb-0.5">Linked Project</p>
                <p className="text-[11px] font-semibold text-brand-700 dark:text-brand-300">{goal.linkedProject}</p>
              </div>
            )}
            {goal.successMetrics.length > 0 && (
              <div>
                <p className="text-[9px] font-black text-brand-500 uppercase mb-1.5">Success Metrics</p>
                <div className="flex flex-wrap gap-1.5">
                  {goal.successMetrics.map((s, i) => <span key={i} className="text-[9px] font-bold px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">{s}</span>)}
                </div>
              </div>
            )}
            {goal.skills.length > 0 && (
              <div>
                <p className="text-[9px] font-black text-brand-500 uppercase mb-1.5">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {goal.skills.map((s, i) => <span key={i} className="text-[9px] font-bold px-2 py-1 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">{s}</span>)}
                </div>
              </div>
            )}
            {goal.contributors.length > 0 && (
              <div>
                <p className="text-[9px] font-black text-brand-500 uppercase mb-1.5">Contributors</p>
                <div className="flex flex-wrap gap-1.5">
                  {goal.contributors.map((c, i) => <span key={i} className="text-[9px] font-bold px-2 py-1 rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-300">{c}</span>)}
                </div>
              </div>
            )}
            {goal.dependencies.length > 0 && (
              <div>
                <p className="text-[9px] font-black text-brand-500 uppercase mb-1.5">Dependent Goals</p>
                <div className="flex flex-wrap gap-1.5">
                  {goal.dependencies.map((d, i) => <span key={i} className="text-[9px] font-bold px-2 py-1 rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 flex items-center gap-1"><Target size={9} /> {d}</span>)}
                </div>
              </div>
            )}
            {goal.approvalNote && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3">
                <p className="text-[9px] font-black text-amber-600 uppercase mb-0.5">Review Note</p>
                <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">{goal.approvalNote}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoalDetail;