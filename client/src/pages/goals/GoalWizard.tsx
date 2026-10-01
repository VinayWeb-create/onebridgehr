import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Check, Sparkles, Target, Rocket, Loader2, Plus, Trash2,
  ChevronLeft, ChevronRight, Wand2, AlertTriangle, Crown, Send, Star,
} from 'lucide-react';
import { goalsService, type GoalPriority, type GoalType, type GoalVisibility, type GoalKeyResult } from '../../services/goalsService';
import { GOAL_TYPES, TYPE_META } from './GoalsShared';

const emptyForm = {
  goalType: 'INDIVIDUAL' as GoalType,
  title: '',
  description: '',
  businessObjective: '',
  businessImpact: '',
  kpiName: '',
  kpiCurrent: 0 as number | '',
  kpiTarget: 100 as number | '',
  kpiUnit: '%',
  departmentKpi: '',
  successMetrics: [] as string[],
  keyResults: [] as { title: string; current: number | ''; target: number | ''; unit: string }[],
  skills: [] as string[],
  contributors: [] as string[],
  startDate: new Date().toISOString().slice(0, 10),
  dueDate: '',
  priority: 'MEDIUM' as GoalPriority,
  weight: 1,
  visibility: 'TEAM' as GoalVisibility,
  department: '',
  linkedProject: '',
  parentGoalId: '',
  dependencies: [] as string[],
  isCompanyGoal: false,
  ownerId: '',
  managerId: '',
  managerName: '',
};

const STEPS = [
  { key: 'type', label: 'Type', icon: <Target size={14} /> },
  { key: 'basics', label: 'Basics', icon: <Sparkles size={14} /> },
  { key: 'impact', label: 'Impact', icon: <Sparkles size={14} /> },
  { key: 'kpi', label: 'KPIs', icon: <Rocket size={14} /> },
  { key: 'krs', label: 'Key Results', icon: <Check size={14} /> },
  { key: 'skills', label: 'Skills', icon: <Star size={14} /> },
  { key: 'timeline', label: 'Timeline', icon: <Star size={14} /> },
  { key: 'align', label: 'Alignment', icon: <Target size={14} /> },
  { key: 'review', label: 'AI Review', icon: <Wand2 size={14} /> },
  { key: 'create', label: 'Create', icon: <Rocket size={14} /> },
];

const STEPS_ORDER = STEPS.map((s) => s.key);

const ChipInput: React.FC<{ value: string[]; onChange: (v: string[]) => void; placeholder: string; suggester?: string[] }> = ({ value, onChange, placeholder, suggester }) => {
  const [input, setInput] = useState('');
  const add = () => { const v = input.trim(); if (v && !value.includes(v)) onChange([...value, v]); setInput(''); };
  return (
    <div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500"
        />
        <button onClick={add} className="px-3.5 rounded-xl bg-indigo-600 text-white text-xs font-black cursor-pointer hover:bg-indigo-700 transition-all">Add</button>
      </div>
      {suggester && suggester.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {suggester.map((s) => (
            <button key={s} disabled={value.includes(s)} onClick={() => !value.includes(s) && onChange([...value, s])} className="text-[9px] font-bold px-2 py-1 rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-300 disabled:opacity-40 cursor-pointer hover:bg-indigo-100 transition-all">
              + {s}
            </button>
          ))}
        </div>
      )}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {value.map((v, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500/10 to-orange-500/10 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300">
              {v}
              <button onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-brand-400 hover:text-rose-500 cursor-pointer"><Trash2 size={10} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const SUGGESTED_SKILLS = ['Problem Solving', 'Communication', 'Leadership', 'Cloud & AI', 'Negotiation', 'Data Analysis', 'Agile', 'Automation'];
const KPI_SUGGESTIONS: Partial<Record<GoalType, string[]>> = {
  REVENUE: ['Monthly Recurring Revenue', 'Deals Closed', 'Average Deal Size', 'Win Rate'],
  CUSTOMER_SUCCESS: ['Net Promoter Score', 'Support Response Time', 'Customer Retention', 'CSAT Score'],
  QUALITY: ['Defect Rate', 'Code Review Coverage', 'Test Coverage'],
  LEARNING: ['Certifications Completed', 'Courses Completed', 'Skill Assessments'],
  LEADERSHIP: ['Mentorship Sessions', 'Team Enablement', '360 Feedback Score'],
  INNOVATION: ['Ideas Shipped', 'Automation Time Saved', 'Process Improvements'],
};

export const GoalWizard: React.FC = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isPriv = ['SUPER_ADMIN', 'HR', 'TEAM_LEAD'].includes(user.role);

  const [stepIdx, setStepIdx] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResult, setAiResult] = useState<any>(null);

  const { data: employees } = useQuery({ queryKey: ['goal-employees'], queryFn: goalsService.getEmployeeOptions, enabled: isPriv });
  const { data: templates } = useQuery({ queryKey: ['goal-templates'], queryFn: goalsService.getTemplates });

  const set = (patch: Partial<typeof emptyForm>) => setForm((f) => ({ ...f, ...patch }));

  const aiRun = async (action: string, extra: any = {}) => {
    setAiLoading(true);
    setAiError('');
    setAiResult(null);
    try {
      const r = await goalsService.aiAssist(action, extra);
      setAiResult({ action, ...r });
      return r;
    } catch (e: any) {
      setAiError(e?.response?.data?.message || 'AI assistant could not process your request. Try the Core plan actions.');
    } finally {
      setAiLoading(false);
    }
  };

  const draftFromText = async (text: string) => {
    const r = await aiRun('draft_from_text', { text, goalType: form.goalType });
    if (r) {
      set({ title: r.title || form.title, description: r.description || form.description, skills: r.skills?.length ? r.skills : form.skills });
    }
  };

  const improveWording = async () => {
    const r = await aiRun('improve_wording', { text: form.title || 'Increase performance' });
    if (r?.improved) set({ title: r.improved });
  };

  const suggestKpis = async () => {
    const r = await aiRun('suggest_kpis', { goalType: form.goalType });
    if (r?.suggestions?.length) set({ kpiName: r.suggestions[0].kpi, kpiUnit: r.suggestions[0].unit === 'count' ? 'count' : r.suggestions[0].unit });
  };

  const canNext = useMemo(() => {
    if (form.goalType === 'INDIVIDUAL') return true;
    if (stepIdx === 0) return true;
    if (stepIdx === 1) return form.title.trim().length > 2;
    if (stepIdx === 4) return form.keyResults.length > 0;
    return true;
  }, [stepIdx, form]);

  const defaultTemplate = useMemo(() => (templates || []).find((t) => t.goalType === form.goalType), [templates, form.goalType]);

  const create = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        description: form.description,
        goalType: form.goalType,
        ownerId: isPriv && form.ownerId ? form.ownerId : undefined,
        managerId: form.managerId || undefined,
        managerName: form.managerName || undefined,
        priority: form.priority,
        weight: form.weight,
        startDate: form.startDate ? new Date(form.startDate) : undefined,
        dueDate: form.dueDate ? new Date(form.dueDate) : undefined,
        businessObjective: form.businessObjective || undefined,
        businessImpact: form.businessImpact || undefined,
        successMetrics: form.successMetrics,
        kpiName: form.kpiName || undefined,
        kpiCurrent: form.kpiCurrent === '' ? undefined : Number(form.kpiCurrent),
        kpiTarget: form.kpiTarget === '' ? undefined : Number(form.kpiTarget),
        kpiUnit: form.kpiUnit,
        departmentKpi: form.departmentKpi || undefined,
        linkedProject: form.linkedProject || undefined,
        skills: form.skills,
        contributors: form.contributors,
        keyResults: form.keyResults.map((kr) => ({
          title: kr.title,
          current: Number(kr.current) || 0,
          target: Number(kr.target) || 1,
          unit: kr.unit || '%',
        })),
        dependencies: form.dependencies,
        isCompanyGoal: form.isCompanyGoal,
        visibility: form.visibility,
      };
      return goalsService.createGoal(payload as any);
    },
    onSuccess: (goal) => navigate(`/goals/${goal.id}`),
  });

  const next = () => { if (canNext) setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)); };
  const prev = () => setStepIdx((i) => Math.max(i - 1, 0));
  const step = STEPS[stepIdx].key;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-brand-950 dark:text-white">Create a Goal</h1>
          <p className="text-xs text-brand-500 font-semibold mt-1">10-step guided wizard with built-in AI coaching · autosaved locally</p>
        </div>
        {defaultTemplate && (
          <div className="text-[10px] font-bold text-brand-500 bg-brand-100 dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-3 py-2 flex items-center gap-2">
            <Crown size={12} className="text-amber-500" /> Template: <span className="text-brand-800 dark:text-brand-200">{defaultTemplate.name}</span>
            <button onClick={() => {
              set({
                title: defaultTemplate.name,
                description: defaultTemplate.description,
                keyResults: (defaultTemplate.keyResults || []).map((kr) => ({ title: kr.title, current: kr.current || 0, target: kr.target || 1, unit: kr.unit || '%' })),
                skills: defaultTemplate.skills || [],
                successMetrics: defaultTemplate.successMetrics || [],
              });
            }} className="underline text-indigo-500 cursor-pointer">Apply</button>
          </div>
        )}
      </header>

      {/* Stepper */}
      <div className="glass rounded-2xl border border-brand-200 dark:border-brand-900 shadow-md p-4 overflow-x-auto">
        <div className="flex items-center min-w-max">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.key}>
              {i > 0 && <div className={`h-0.5 flex-1 mx-1 rounded ${i <= stepIdx ? 'bg-gradient-to-r from-orange-500 to-indigo-600' : 'bg-brand-200 dark:bg-brand-800'}`} />}
              <button
                onClick={() => i < stepIdx && setStepIdx(i)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                  i === stepIdx ? 'bg-gradient-to-r from-orange-500 to-indigo-600 text-white shadow-md'
                  : i < stepIdx ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 cursor-pointer'
                  : 'text-brand-400'
                }`}
              >
                {i < stepIdx ? <Check size={11} /> : s.icon}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step body */}
      <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="glass rounded-3xl border border-brand-200 dark:border-brand-900 shadow-xl p-6 md:p-8">
        {step === 'type' && (
          <div>
            <h2 className="text-lg font-black text-brand-950 dark:text-white">Choose your goal type</h2>
            <p className="text-xs text-brand-500 font-semibold mt-1 mb-5">12 enterprise types mapped to OneBridge's OKR engine.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {GOAL_TYPES.map((t) => {
                const meta = TYPE_META[t];
                const active = form.goalType === t;
                return (
                  <button key={t} onClick={() => set({ goalType: t })} className={`relative rounded-2xl border-2 p-4 text-left transition-all cursor-pointer ${active ? 'border-indigo-600 dark:border-orange-500 bg-indigo-50/70 dark:bg-brand-900/60 shadow-lg' : 'border-brand-200 dark:border-brand-800 hover:border-indigo-400 bg-white/40 dark:bg-brand-900/30'}`}>
                    {active && <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-gradient-to-r from-orange-500 to-indigo-600 text-white flex items-center justify-center"><Check size={11} /></span>}
                    <span className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.tint} text-white flex items-center justify-center shadow-md`}>{meta.icon}</span>
                    <p className="text-xs font-black text-brand-900 dark:text-white mt-3">{meta.label}</p>
                    <p className="text-[10px] text-brand-500 font-semibold mt-0.5">{t === 'COMPANY' ? 'Aligned to company metrics' : t === 'REVENUE' ? 'Direct revenue impact' : t === 'STRETCH' ? 'Out-of-band growth target' : `${meta.label} outcome goal`}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 'basics' && (
          <div className="space-y-5">
            <div>
              <label className="text-[10px] font-black text-brand-500 uppercase tracking-wider mb-1.5 block">Goal title</label>
              <textarea
                value={form.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder={`e.g. Increase ${TYPE_META[form.goalType].label.toLowerCase()} productivity by 30%`}
                className="w-full text-sm font-bold bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 text-brand-900 dark:text-white"
                rows={2}
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-brand-500 uppercase tracking-wider mb-1.5 block">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="What does success look like? Add measurable, outcome-first language."
                className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 text-brand-700 dark:text-brand-300 min-h-[90px]"
              />
            </div>
            <div className="rounded-2xl bg-indigo-500/[0.06] border border-indigo-500/30 p-4 space-y-2.5">
              <p className="text-[10px] font-black uppercase tracking-wide text-indigo-600 flex items-center gap-1.5"><Sparkles size={12} /> AI Goal Coach</p>
              <p className="text-[11px] text-brand-600 dark:text-brand-300 font-semibold">Paste a raw sentence — I'll turn it into a structured OKR with key results and skills.</p>
              <div className="flex gap-2">
                <input
                  id="aiDraft"
                  placeholder="e.g. Build a sales dashboard that helps reps close 20% faster"
                  className="flex-1 text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500"
                  onKeyDown={async (e) => { if (e.key === 'Enter') { e.preventDefault(); await draftFromText((e.target as HTMLInputElement).value); } }}
                />
                <button onClick={() => { const el = document.getElementById('aiDraft') as HTMLInputElement; if (el?.value) draftFromText(el.value); }} disabled={aiLoading} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-indigo-600 text-white text-xs font-black shadow-lg disabled:opacity-50 cursor-pointer inline-flex items-center gap-1.5">
                  {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} Draft
                </button>
              </div>
              <button onClick={() => form.title && improveWording()} disabled={aiLoading || !form.title} className="text-[10px] font-bold text-indigo-600 hover:underline disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer">
                <Wand2 size={11} /> Improve my wording
              </button>
            </div>
            {aiError && <p className="text-[11px] font-bold text-rose-500">{aiError}</p>}
          </div>
        )}

        {step === 'impact' && (
          <div className="space-y-5">
            <div>
              <label className="text-[10px] font-black text-brand-500 uppercase tracking-wider mb-1.5 block">Business Objective</label>
              <input value={form.businessObjective} onChange={(e) => set({ businessObjective: e.target.value })} placeholder={`Advance ${form.goalType.toLowerCase()} outcomes…`} className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 text-brand-700 dark:text-brand-300" />
            </div>
            <div>
              <label className="text-[10px] font-black text-brand-500 uppercase tracking-wider mb-1.5 block">Business Impact</label>
              <input value={form.businessImpact} onChange={(e) => set({ businessImpact: e.target.value })} placeholder="e.g. Unblocks 4 revenue deals / saves 12 engineering hours weekly" className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 text-brand-700 dark:text-brand-300" />
            </div>
            <div>
              <label className="text-[10px] font-black text-brand-500 uppercase tracking-wider mb-1.5 block">Success Metrics</label>
              <ChipInput value={form.successMetrics} onChange={(v) => set({ successMetrics: v })} placeholder="e.g. 95% customer retention" suggester={form.goalType === 'REVENUE' ? ['MRR +₹5L', 'Deals closed ≥ 3', 'Win rate ≥ 40%'] : ['Adoption ≥ 80%', 'Defect rate < 2%', 'NPS ≥ 60']} />
            </div>
          </div>
        )}

        {step === 'kpi' && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-brand-100/60 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-800 p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-brand-500 mb-3">Suggested KPIs for {TYPE_META[form.goalType].label}</p>
              <div className="flex flex-wrap gap-2">
                {(KPI_SUGGESTIONS[form.goalType] || []).map((k) => (
                  <button key={k} onClick={() => set({ kpiName: k })} className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${form.kpiName === k ? 'bg-gradient-to-r from-orange-500 to-indigo-600 text-white border-transparent shadow-md' : 'bg-white dark:bg-brand-900 border-brand-200 dark:border-brand-800 text-brand-600 dark:text-brand-300 hover:border-indigo-400'}`}>
                    {k}
                  </button>
                ))}
                <button onClick={suggestKpis} disabled={aiLoading} className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-indigo-500/40 text-indigo-600 dark:text-indigo-300 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50">
                  <Wand2 size={11} /> AI Suggest
                </button>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-black text-brand-500 uppercase tracking-wider mb-1.5 block">KPI Name</label>
                <input value={form.kpiName} onChange={(e) => set({ kpiName: e.target.value })} placeholder="e.g. Monthly Recurring Revenue" className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 text-brand-700 dark:text-brand-300" />
              </div>
              <div>
                <label className="text-[10px] font-black text-brand-500 uppercase tracking-wider mb-1.5 block">Current value</label>
                <input type="number" value={form.kpiCurrent} onChange={(e) => set({ kpiCurrent: e.target.value === '' ? '' : Number(e.target.value) })} className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 text-brand-700 dark:text-brand-300" />
              </div>
              <div className="grid grid-cols-[1fr_90px] gap-2">
                <div>
                  <label className="text-[10px] font-black text-brand-500 uppercase tracking-wider mb-1.5 block">Target</label>
                  <input type="number" value={form.kpiTarget} onChange={(e) => set({ kpiTarget: e.target.value === '' ? '' : Number(e.target.value) })} className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 text-brand-700 dark:text-brand-300" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-brand-500 uppercase tracking-wider mb-1.5 block">Unit</label>
                  <input value={form.kpiUnit} onChange={(e) => set({ kpiUnit: e.target.value })} className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 text-brand-700 dark:text-brand-300" />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-black text-brand-500 uppercase tracking-wider mb-1.5 block">Department KPI (optional)</label>
                <input value={form.departmentKpi} onChange={(e) => set({ departmentKpi: e.target.value })} placeholder="SALES · MARKETING · ENGINEERING · FINANCE · HR · OPERATIONS" className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 text-brand-700 dark:text-brand-300" />
              </div>
            </div>
          </div>
        )}

        {step === 'krs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-brand-950 dark:text-white">Key Results <span className="text-brand-400">(2-4 recommended)</span></h2>
                <p className="text-[11px] text-brand-500 font-semibold mt-0.5">Measure outcomes — not activities. Each KR auto-calculates progress.</p>
              </div>
              <div className="flex items-center gap-2">
                {form.keyResults.length <= 1 && (
                  <button onClick={() => aiRun('suggest_milestones', { goal: { goalType: form.goalType } })} disabled={aiLoading} className="text-[10px] font-bold px-3 py-2 rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-300 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50">
                    <Sparkles size={11} /> Suggest milestones
                  </button>
                )}
                <button onClick={() => set({ keyResults: [...form.keyResults, { title: '', current: 0, target: 100, unit: '%' }] })} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-indigo-600 text-white text-[10px] font-black cursor-pointer hover:bg-indigo-700 transition-all">
                  <Plus size={12} /> Add KR
                </button>
              </div>
            </div>
            {form.keyResults.length === 0 && (
              <div className="text-center py-8 rounded-2xl border border-dashed border-brand-300 dark:border-brand-700">
                <p className="text-xs text-brand-500 font-semibold">No key results yet. Add at least one measurable outcome.</p>
              </div>
            )}
            <div className="space-y-3">
              {form.keyResults.map((kr, i) => (
                <div key={i} className="rounded-2xl bg-brand-100/50 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-800 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <input value={kr.title} onChange={(e) => set({ keyResults: form.keyResults.map((k, j) => j === i ? { ...k, title: e.target.value } : k) })} placeholder={`Key result ${i + 1} — e.g. Ship ${TYPE_META[form.goalType].label.toLowerCase()} milestone`} className="w-full text-xs font-bold bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 text-brand-800 dark:text-white" />
                    </div>
                    <button onClick={() => set({ keyResults: form.keyResults.filter((_, j) => j !== i) })} className="p-2 rounded-lg bg-white dark:bg-brand-900 text-rose-400 hover:text-rose-500 cursor-pointer border border-brand-200 dark:border-brand-800"><Trash2 size={13} /></button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2.5">
                    <div><label className="text-[9px] font-bold text-brand-500 uppercase">Current</label><input type="number" value={kr.current} onChange={(e) => set({ keyResults: form.keyResults.map((k, j) => j === i ? { ...k, current: e.target.value === '' ? 0 : Number(e.target.value) } : k) })} className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-lg px-2.5 py-2 mt-1 focus:outline-none focus:border-indigo-500" /></div>
                    <div><label className="text-[9px] font-bold text-brand-500 uppercase">Target</label><input type="number" value={kr.target} onChange={(e) => set({ keyResults: form.keyResults.map((k, j) => j === i ? { ...k, target: e.target.value === '' ? 0 : Number(e.target.value) } : k) })} className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-lg px-2.5 py-2 mt-1 focus:outline-none focus:border-indigo-500" /></div>
                    <div><label className="text-[9px] font-bold text-brand-500 uppercase">Unit</label><input value={kr.unit} onChange={(e) => set({ keyResults: form.keyResults.map((k, j) => j === i ? { ...k, unit: e.target.value } : k) })} className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-lg px-2.5 py-2 mt-1 focus:outline-none focus:border-indigo-500" /></div>
                  </div>
                </div>
              ))}
            </div>
            <AnimatePresence>
              {aiResult?.action === 'suggest_milestones' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden rounded-2xl bg-indigo-500/5 border border-indigo-500/30 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wide text-indigo-600 mb-2 flex items-center gap-1.5"><Sparkles size={11} /> Suggested framework</p>
                  <div className="space-y-1.5">
                    {(aiResult.milestones || []).map((m: any, i: number) => (
                      <p key={i} className="text-[11px] font-semibold text-brand-700 dark:text-brand-300">• <span className="font-black text-indigo-500">{m.week}:</span> {m.focus}</p>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {step === 'skills' && (
          <div className="space-y-5">
            <div>
              <label className="text-[10px] font-black text-brand-500 uppercase tracking-wider mb-1.5 block">Skills developed</label>
              <ChipInput value={form.skills} onChange={(v) => set({ skills: v })} placeholder="Add a skill…" suggester={(KPI_SUGGESTIONS_LINKED[form.goalType] || []).concat(SUGGESTED_SKILLS.slice(0, 4))} />
            </div>
            <p className="text-[11px] text-brand-500 font-semibold">Skills feed the career-growth model, promotion readiness and competency matrix.</p>
            <button onClick={() => aiRun('recommend_learning', { goal: { skills: form.skills, goalType: form.goalType } })} disabled={aiLoading} className="text-[10px] font-bold px-4 py-2.5 rounded-xl bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-300 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
              <Sparkles size={12} /> AI Learning Recommendations
            </button>
            <AnimatePresence>
              {aiResult?.action === 'recommend_learning' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-2">
                  {(aiResult.recommendations || []).map((r: any, i: number) => (
                    <div key={i} className="rounded-2xl bg-white/50 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-800 p-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-brand-900 dark:text-white">{r.course}</p>
                        <p className="text-[9px] text-brand-500 font-semibold">Skill: {r.skill} · {r.durationWeeks}w · {r.provider}</p>
                      </div>
                      <span className="text-[9px] font-black px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">{r.impact}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            <div>
              <label className="text-[10px] font-black text-brand-500 uppercase tracking-wider mb-1.5 block">Contributors (optional)</label>
              <ChipInput value={form.contributors} onChange={(v) => set({ contributors: v })} placeholder="employeeId or name…" />
            </div>
          </div>
        )}

        {step === 'timeline' && (
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="text-[10px] font-black text-brand-500 uppercase tracking-wider mb-1.5 block">Start date</label>
              <input type="date" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 text-brand-700 dark:text-brand-300" />
            </div>
            <div>
              <label className="text-[10px] font-black text-brand-500 uppercase tracking-wider mb-1.5 block">Due date</label>
              <input type="date" value={form.dueDate} onChange={(e) => set({ dueDate: e.target.value })} className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 text-brand-700 dark:text-brand-300" />
            </div>
            <div>
              <label className="text-[10px] font-black text-brand-500 uppercase tracking-wider mb-1.5 block">Priority</label>
              <div className="flex gap-2">
                {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as GoalPriority[]).map((p) => (
                  <button key={p} onClick={() => set({ priority: p })} className={`flex-1 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all cursor-pointer ${form.priority === p ? 'bg-gradient-to-r from-orange-500 to-indigo-600 text-white shadow-md' : 'bg-brand-100 dark:bg-brand-900 text-brand-500 hover:text-indigo-600'}`}>{p}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-brand-500 uppercase tracking-wider mb-1.5 block">Weight (OKR multiplier)</label>
              <div className="flex gap-2">
                {[1, 2, 3, 5].map((w) => (
                  <button key={w} onClick={() => set({ weight: w })} className={`px-4 py-2.5 rounded-xl text-sm font-black transition-all cursor-pointer ${form.weight === w ? 'bg-gradient-to-r from-orange-500 to-indigo-600 text-white shadow-md' : 'bg-brand-100 dark:bg-brand-900 text-brand-500 hover:text-indigo-600'}`}>{w}×</button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-black text-brand-500 uppercase tracking-wider mb-1.5 block">Visibility</label>
              <div className="flex flex-wrap gap-2">
                {(['PRIVATE', 'TEAM', 'DEPARTMENT', 'COMPANY'] as GoalVisibility[]).map((v) => (
                  <button key={v} onClick={() => set({ visibility: v })} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all cursor-pointer ${form.visibility === v ? 'bg-gradient-to-r from-orange-500 to-indigo-600 text-white shadow-md' : 'bg-brand-100 dark:bg-brand-900 text-brand-500 hover:text-indigo-600'}`}>{v.replace('_', ' ')}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'align' && (
          <div className="space-y-5">
            {isPriv && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-brand-500 uppercase tracking-wider mb-1.5 block">Assign to (owner)</label>
                  <select value={form.ownerId} onChange={(e) => set({ ownerId: e.target.value })} className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 text-brand-700 dark:text-brand-300 cursor-pointer">
                    <option value="">Myself ({user.firstName} {user.lastName})</option>
                    {(employees || []).map((e) => <option key={e.employeeId} value={e.employeeId}>{e.firstName} {e.lastName} · {e.department}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-brand-500 uppercase tracking-wider mb-1.5 block">Manager approval</label>
                  <select value={form.managerId} onChange={(e) => set({ managerId: e.target.value })} className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 text-brand-700 dark:text-brand-300 cursor-pointer">
                    <option value="">No manager workflow</option>
                    {(employees || []).filter((e) => e.department === (employees || []).find((x) => x.employeeId === form.ownerId)?.department && e.employeeId !== form.ownerId).map((e) => <option key={e.employeeId} value={e.employeeId}>{e.firstName} {e.lastName}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div>
              <label className="text-[10px] font-black text-brand-500 uppercase tracking-wider mb-1.5 block">Linked project (optional)</label>
              <input value={form.linkedProject} onChange={(e) => set({ linkedProject: e.target.value })} placeholder="Project / initiative this goal powers" className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 text-brand-700 dark:text-brand-300" />
            </div>
            <div>
              <label className="text-[10px] font-black text-brand-500 uppercase tracking-wider mb-1.5 block">Dependency graph (goal ids / names)</label>
              <ChipInput value={form.dependencies} onChange={(v) => set({ dependencies: v })} placeholder="Add a dependent goal…" />
            </div>
            <label className="flex items-center gap-3 cursor-pointer p-4 rounded-2xl bg-brand-100/50 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-800">
              <input type="checkbox" checked={form.isCompanyGoal} onChange={(e) => set({ isCompanyGoal: e.target.checked })} className="accent-orange-500 w-4 h-4" />
              <div>
                <p className="text-xs font-black text-brand-900 dark:text-white">Company-wide goal</p>
                <p className="text-[10px] text-brand-500 font-semibold">Visible to the whole organisation and drives the company OKR tree.</p>
              </div>
              <Crown size={18} className="ml-auto text-amber-500" />
            </label>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-gradient-to-br from-indigo-500/[0.07] to-orange-500/[0.05] border border-indigo-500/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-indigo-600 mb-3 flex items-center gap-1.5"><Wand2 size={12} /> Final AI sanity check</p>
              <div className="grid sm:grid-cols-2 gap-2.5">
                <button onClick={() => aiRun('detect_unrealistic', { goal: { title: form.title, dueDate: form.dueDate || null, progress: 0, keyResults: form.keyResults.map((kr) => ({ title: kr.title, target: Number(kr.target) || 0, current: Number(kr.current) || 0 })) } })} disabled={aiLoading} className="px-4 py-3 rounded-xl bg-white/60 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 text-xs font-bold text-brand-700 dark:text-brand-300 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 hover:border-rose-300 transition-all">
                  <AlertTriangle size={14} className="text-rose-500" /> Check realism
                </button>
                <button onClick={() => aiRun('predict_completion', { goal: { progress: 0, startDate: form.startDate ? new Date(form.startDate) : null, dueDate: form.dueDate ? new Date(form.dueDate) : null } })} disabled={aiLoading} className="px-4 py-3 rounded-xl bg-white/60 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 text-xs font-bold text-brand-700 dark:text-brand-300 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 hover:border-indigo-300 transition-all">
                  <Rocket size={14} className="text-indigo-500" /> Predict completion
                </button>
                <button onClick={() => aiRun('identify_blockers', {})} disabled={aiLoading} className="px-4 py-3 rounded-xl bg-white/60 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 text-xs font-bold text-brand-700 dark:text-brand-300 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 hover:border-amber-300 transition-all">
                  <Target size={14} className="text-amber-500" /> Identify blockers
                </button>
                <button onClick={() => aiRun('generate_weekly_update', { goal: { wins: 'Planned kickoff', problems: 'None', nextActions: 'Start weekly check-ins', progress: form.keyResults.some((kr) => Number(kr.current) > 0) ? 25 : 0 } })} disabled={aiLoading} className="px-4 py-3 rounded-xl bg-white/60 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 text-xs font-bold text-brand-700 dark:text-brand-300 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 hover:border-emerald-300 transition-all">
                  <Send size={14} className="text-emerald-500" /> 1st check-in draft
                </button>
              </div>
            </div>
            {aiLoading && <div className="flex items-center gap-2 text-xs font-bold text-indigo-500"><Loader2 size={14} className="animate-spin" /> AI is analysing your goal…</div>}
            <AnimatePresence>
              {aiResult && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="rounded-2xl bg-white/60 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-800 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Wand2 size={13} className="text-indigo-500" />
                    <span className="text-[10px] font-black uppercase tracking-wide text-brand-500">{aiResult.action?.replace(/_/g, ' ')}</span>
                  </div>
                  {'flags' in aiResult && (
                    <div className="space-y-1.5">
                      {(aiResult.flags || []).map((f: string, i: number) => <p key={i} className="text-[11px] font-semibold text-brand-700 dark:text-brand-300 flex gap-2"><AlertTriangle size={12} className="text-rose-500 shrink-0 mt-0.5" />{f}</p>)}
                    </div>
                  )}
                  {'status' in aiResult && (
                    <div className="flex flex-wrap gap-2">
                      <span className="text-[10px] font-black px-2.5 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">{aiResult.status} (confidence {aiResult.confidence}%)</span>
                      <span className="text-[10px] font-black px-2.5 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-300">{aiResult.projectedCompletion}</span>
                      <span className="text-[10px] font-black px-2.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Need {aiResult.paceNeededPerDay}%/day</span>
                    </div>
                  )}
                  {'blockers' in aiResult && (
                    <div className="space-y-1.5">
                      {(aiResult.blockers || []).map((b: any, i: number) => (
                        <p key={i} className="text-[11px] font-semibold text-brand-700 dark:text-brand-300"><span className={`font-black ${b.severity === 'HIGH' ? 'text-rose-500' : b.severity === 'MEDIUM' ? 'text-amber-500' : 'text-emerald-500'}`}>{b.severity}</span> · {b.risk} — <span className="text-indigo-500">{b.mitigation}</span></p>
                      ))}
                    </div>
                  )}
                  {'update' in aiResult && <p className="text-[11px] font-semibold text-brand-700 dark:text-brand-300">{aiResult.update}</p>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {step === 'create' && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-gradient-to-br from-orange-500/[0.08] to-indigo-600/[0.08] border border-indigo-500/30 p-5">
              <div className="flex items-start gap-4">
                <span className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${TYPE_META[form.goalType].tint} text-white flex items-center justify-center shadow-md shrink-0`}>{TYPE_META[form.goalType].icon}</span>
                <div className="min-w-0">
                  <h2 className="text-xl font-black tracking-tight text-brand-950 dark:text-white">{form.title || 'Untitled goal'}</h2>
                  <p className="text-xs text-brand-500 font-semibold mt-1">{TYPE_META[form.goalType].label} · {form.priority} · {form.visibility.replace('_', ' ')} · ×{form.weight}</p>
                </div>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-2xl bg-brand-100/50 dark:bg-brand-900/40 p-4">
                <p className="text-[9px] font-black text-brand-500 uppercase mb-2">Key results ({form.keyResults.length})</p>
                {form.keyResults.filter((kr) => kr.title).slice(0, 3).map((kr, i) => <p key={i} className="text-[11px] font-semibold text-brand-700 dark:text-brand-300 py-1 border-b border-brand-200/60 dark:border-brand-800/60 last:border-0">• {kr.title} <span className="text-brand-400">({kr.current ?? 0} → {kr.target ?? 0} {kr.unit})</span></p>)}
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl bg-brand-100/50 dark:bg-brand-900/40 p-4">
                  <p className="text-[9px] font-black text-brand-500 uppercase mb-1.5">KPI</p>
                  {form.kpiName ? <p className="text-xs font-bold text-brand-900 dark:text-white">{form.kpiName}: {form.kpiCurrent ?? 0} → {form.kpiTarget ?? 0} {form.kpiUnit}</p> : <p className="text-[11px] text-brand-500 font-semibold">No KPI linked</p>}
                </div>
                <div className="rounded-2xl bg-brand-100/50 dark:bg-brand-900/40 p-4">
                  <p className="text-[9px] font-black text-brand-500 uppercase mb-1.5">Window</p>
                  <p className="text-xs font-bold text-brand-900 dark:text-white">{form.startDate}{form.dueDate ? ` → ${form.dueDate}` : ' — open ended'}</p>
                </div>
                <div className="rounded-2xl bg-brand-100/50 dark:bg-brand-900/40 p-4">
                  <p className="text-[9px] font-black text-brand-500 uppercase mb-1.5">Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(form.skills.length ? form.skills : ['To be defined']).map((s, i) => <span key={i} className="text-[9px] font-bold px-2 py-1 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">{s}</span>)}
                  </div>
                </div>
              </div>
            </div>
            {aiError && <p className="text-[11px] font-bold text-rose-500">{aiError}</p>}
            <button
              onClick={() => create.mutate()}
              disabled={create.isPending || !form.title.trim()}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-indigo-600 text-white text-sm font-black shadow-2xl shadow-indigo-600/30 hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              {create.isPending ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
              Create Goal · {form.keyResults.filter((kr) => kr.title).length} KRs
            </button>
          </div>
        )}

        {/* Nav */}
        <div className="mt-8 flex items-center justify-between">
          <button onClick={prev} disabled={stepIdx === 0} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-300 text-xs font-black disabled:opacity-30 cursor-pointer hover:bg-brand-200 transition-all">
            <ChevronLeft size={14} /> Back
          </button>
          <div className="text-[10px] font-black text-brand-500 uppercase tracking-wider">Step {stepIdx + 1} of {STEPS.length}</div>
          {stepIdx < STEPS.length - 1 ? (
            <button onClick={next} disabled={!canNext} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-indigo-600 text-white text-xs font-black shadow-lg disabled:opacity-30 cursor-pointer hover:shadow-xl transition-all">
              {step === 'krs' && form.keyResults.length === 0 ? 'Skip KRs' : 'Continue'} <ChevronRight size={14} />
            </button>
          ) : (
            <button onClick={() => create.mutate()} disabled={create.isPending || !form.title.trim()} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black shadow-lg disabled:opacity-30 cursor-pointer hover:shadow-xl transition-all">
              {create.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Create Goal
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const KPI_SUGGESTIONS_LINKED: Partial<Record<GoalType, string[]>> = {
  REVENUE: ['Negotiation', 'Sales', 'CRM'],
  LEADERSHIP: ['Leadership', 'Communication', 'Mentorship'],
  INNOVATION: ['Problem Solving', 'Creativity', 'AI'],
  LEARNING: ['Learning Agility'],
};

export default GoalWizard;