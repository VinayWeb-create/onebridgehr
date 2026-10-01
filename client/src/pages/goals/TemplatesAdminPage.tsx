import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LayoutTemplate, Plus, Trash2, Crown, Check, X, Target, Loader2, RefreshCcw,
} from 'lucide-react';
import { goalsService, type GoalType, type GoalTemplate } from '../../services/goalsService';
import { TYPE_META } from './GoalsShared';

const templateForm = { name: '', goalType: 'TEAM' as GoalType, description: '', keyResults: '', successMetrics: '', skills: '' };

export const TemplatesAdminPage: React.FC = () => {
  const qc = useQueryClient();
  const [form, setForm] = useState(templateForm);
  const [open, setOpen] = useState(false);
  const [filterType, setFilterType] = useState<GoalType | 'ALL'>('ALL');

  const { data, isLoading } = useQuery({ queryKey: ['goal-templates-admin'], queryFn: goalsService.getTemplates });

  const create = useMutation({
    mutationFn: () => goalsService.createTemplate({
      name: form.name,
      goalType: form.goalType,
      description: form.description,
      keyResults: form.keyResults.split('\n').filter(Boolean).map((t) => ({ id: crypto.randomUUID(), title: t.trim(), current: 0, target: 1, unit: '%', progress: 0 })),
      successMetrics: form.successMetrics.split(',').map((s) => s.trim()).filter(Boolean),
      skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
      isActive: true,
    } as any),
    onSuccess: () => { setOpen(false); setForm(templateForm); qc.invalidateQueries({ queryKey: ['goal-templates-admin'] }); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => goalsService.deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goal-templates-admin'] }),
  });

  const filtered = (data || []).filter((t) => filterType === 'ALL' || t.goalType === filterType);

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-brand-950 dark:text-white flex items-center gap-2"><LayoutTemplate size={22} className="text-indigo-500" /> Goal Templates</h1>
          <p className="text-xs text-brand-500 font-semibold mt-1">Reusable OKR frameworks the AI wizard and managers can apply in one click.</p>
        </div>
        <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-indigo-600 text-white text-xs font-black shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer">
          {open ? <X size={14} /> : <Plus size={14} />} {open ? 'Close' : 'New Template'}
        </button>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="glass rounded-3xl border border-brand-200 dark:border-brand-900 shadow-xl p-6 space-y-4">
              <h3 className="text-xs font-black text-brand-950 dark:text-white uppercase tracking-wide">Create goal template</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-brand-500 uppercase tracking-wider mb-1.5 block">Template name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Quarterly Revenue Sprint" className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-brand-500 uppercase tracking-wider mb-1.5 block">Goal type</label>
                  <select value={form.goalType} onChange={(e) => setForm({ ...form, goalType: e.target.value as GoalType })} className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 cursor-pointer">
                    {Object.keys(TYPE_META).map((t) => <option key={t} value={t}>{TYPE_META[t as GoalType].label}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-brand-500 uppercase tracking-wider mb-1.5 block">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What this framework is for…" className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 min-h-[60px]" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-brand-500 uppercase tracking-wider mb-1.5 block">Key results <span className="text-brand-400">(one per line)</span></label>
                  <textarea value={form.keyResults} onChange={(e) => setForm({ ...form, keyResults: e.target.value })} placeholder={`Close 3 enterprise deals\nRaise ACV 25%\nShip onboarding v2`} className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 min-h-[80px]" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-brand-500 uppercase tracking-wider mb-1.5 block">Success metrics <span className="text-brand-400">(comma separated)</span></label>
                  <input value={form.successMetrics} onChange={(e) => setForm({ ...form, successMetrics: e.target.value })} placeholder="NPS ≥ 60, Churn < 3%" className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-brand-500 uppercase tracking-wider mb-1.5 block">Skills <span className="text-brand-400">(comma separated)</span></label>
                  <input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="Negotiation, Sales, CRM" className="w-full text-xs bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500" />
                </div>
              </div>
              <button onClick={() => create.mutate()} disabled={create.isPending || !form.name.trim()} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-indigo-600 text-white text-xs font-black shadow-lg disabled:opacity-50 cursor-pointer">
                {create.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save template
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilterType('ALL')} className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all cursor-pointer ${filterType === 'ALL' ? 'bg-gradient-to-r from-orange-500 to-indigo-600 text-white shadow-md' : 'bg-brand-100 dark:bg-brand-900 text-brand-500'}`}>All</button>
        {Object.keys(TYPE_META).map((t) => (
          <button key={t} onClick={() => setFilterType(t as GoalType)} className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all cursor-pointer ${filterType === t ? 'bg-gradient-to-r from-orange-500 to-indigo-600 text-white shadow-md' : 'bg-brand-100 dark:bg-brand-900 text-brand-500'}`}>{TYPE_META[t as GoalType].label}</button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <p className="text-xs font-bold text-brand-500 col-span-full text-center py-10">Loading templates…</p>}
        {!isLoading && filtered.length === 0 && <p className="text-xs font-bold text-brand-500 col-span-full text-center py-10">No templates yet — create one above.</p>}
        {filtered.map((t: GoalTemplate, i) => (
          <motion.div key={t.id || i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="glass rounded-2xl border border-brand-200 dark:border-brand-900 shadow-md p-5 hover:shadow-xl transition-all group">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3 min-w-0">
                <span className={`w-10 h-10 rounded-xl bg-gradient-to-br ${TYPE_META[t.goalType].tint} text-white flex items-center justify-center shadow-md shrink-0`}>{TYPE_META[t.goalType].icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-black text-brand-950 dark:text-white leading-snug">{t.name}</p>
                  <p className="text-[9px] font-bold text-brand-500 uppercase tracking-wide mt-0.5">{TYPE_META[t.goalType].label}{t.usageCount > 0 ? ` · used ${t.usageCount}×` : ''}</p>
                </div>
              </div>
              <button onClick={() => remove.mutate(t.id)} className="opacity-0 group-hover:opacity-100 p-2 rounded-lg bg-rose-50 text-rose-500 dark:bg-rose-900/30 dark:text-rose-400 hover:bg-rose-100 transition-all cursor-pointer" title="Delete"><Trash2 size={13} /></button>
            </div>
            {t.description && <p className="text-[11px] text-brand-600 dark:text-brand-400 font-semibold mt-3 line-clamp-2">{t.description}</p>}
            {(t.keyResults || []).length > 0 && (
              <div className="mt-3 space-y-1.5">
                {(t.keyResults || []).slice(0, 3).map((kr, ki) => (
                  <p key={ki} className="text-[10px] font-semibold text-brand-700 dark:text-brand-300 flex items-center gap-1.5"><Target size={10} className="text-indigo-400 shrink-0" /> {kr.title}</p>
                ))}
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-brand-100 dark:border-brand-900 flex items-center justify-between">
              <div className="flex gap-1.5">
                {(t.skills || []).slice(0, 3).map((s, si) => <span key={si} className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">{s}</span>)}
              </div>
              <span className="text-[9px] font-bold text-brand-500">{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex items-center gap-2 glass rounded-2xl border border-brand-200 dark:border-brand-900 p-4 text-xs text-brand-500 font-semibold">
        <Crown size={14} className="text-amber-500 shrink-0" />
        Templates appear inline in the Goal Wizard so employees can bootstrap a framework in one click — perfect for company-wide alignment.
        {(data || []).length > 0 && <button onClick={() => qc.invalidateQueries({ queryKey: ['goal-templates-admin'] })} className="ml-auto inline-flex items-center gap-1 text-[10px] font-black text-indigo-500 cursor-pointer"><RefreshCcw size={11} /> Refresh</button>}
      </div>
    </div>
  );
};

export default TemplatesAdminPage;