import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Check, Clock, Loader2, Play, Plus, Trash2 } from 'lucide-react';
import { useDialog } from '../../../context/DialogContext';
import {
  createCompanyReminder,
  deleteCompanyReminder,
  errorMessage,
  fetchAdminSettings,
  runScheduler,
  saveAdminSettings,
  updateCompanyReminder,
} from '../api';
import { plannerKeys } from '../hooks';
import { CATEGORIES, CATEGORY_META, REMINDER_OPTIONS, TIMEZONES, WEEKDAY_SHORT } from '../lib/constants';
import { SOUNDS } from '../lib/sound';
import { Toggle } from './SettingsView';
import { card, chip, input } from './formStyles';
import type { AdminConfig, CompanyReminder } from '../types';

/** Ready-made attendance / work-routine reminders admins can enable in one click. */
const PRESETS: Array<Omit<CompanyReminder, 'id' | 'isActive'>> = [
  { title: '⏰ Time to Check-In', message: 'Good morning! Please mark your attendance.', kind: 'CHECK_IN', time: '09:25', daysOfWeek: [1, 2, 3, 4, 5, 6], targetRoles: [], departments: [], mandatory: false, actionUrl: '/attendance?action=checkin' },
  { title: '🍱 Lunch break', message: "It's lunch time — take a break.", kind: 'LUNCH_START', time: '13:00', daysOfWeek: [1, 2, 3, 4, 5, 6], targetRoles: [], departments: [], mandatory: false, actionUrl: '/attendance' },
  { title: '☕ Break ending', message: 'Your break ends in 5 minutes.', kind: 'BREAK_END', time: '13:55', daysOfWeek: [1, 2, 3, 4, 5, 6], targetRoles: [], departments: [], mandatory: false, actionUrl: '/attendance' },
  { title: '🏁 Time to Check-Out', message: "Wrap up for the day and don't forget to check out.", kind: 'CHECK_OUT', time: '18:30', daysOfWeek: [1, 2, 3, 4, 5, 6], targetRoles: [], departments: [], mandatory: false, actionUrl: '/attendance?action=checkout' },
  { title: '🧾 Submit Timesheet', message: 'Please submit your timesheet for today.', kind: 'TIMESHEET', time: '18:00', daysOfWeek: [1, 2, 3, 4, 5], targetRoles: [], departments: [], mandatory: true, actionUrl: '/tasks' },
  { title: '📝 Complete Daily Report', message: 'Share your daily report before you log off.', kind: 'DAILY_REPORT', time: '18:15', daysOfWeek: [1, 2, 3, 4, 5], targetRoles: [], departments: [], mandatory: false, actionUrl: '/planner' },
];

const ROLES = ['EMPLOYEE', 'TEAM_LEAD', 'HR', 'SUPER_ADMIN'];

export const AdminView: React.FC = () => {
  const qc = useQueryClient();
  const { confirm } = useDialog();
  const q = useQuery({ queryKey: plannerKeys.admin, queryFn: fetchAdminSettings });
  const [cfg, setCfg] = useState<AdminConfig | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Omit<CompanyReminder, 'id'> | null>(null);

  useEffect(() => {
    if (q.data && !cfg) setCfg(q.data.config);
  }, [q.data, cfg]);

  if (q.isLoading || !cfg) {
    return (
      <div className="py-16 flex justify-center">
        {q.isError ? <p className="text-sm text-rose-500">{errorMessage(q.error)}</p> : <Loader2 className="animate-spin text-indigo-500" />}
      </div>
    );
  }
  const set = <K extends keyof AdminConfig>(k: K, v: AdminConfig[K]) => setCfg({ ...cfg, [k]: v });
  const toggleNum = (k: 'defaultReminderOffsets' | 'meetingReminderOffsets' | 'workingDays', v: number) =>
    set(k, cfg[k].includes(v) ? cfg[k].filter((x) => x !== v) : [...cfg[k], v].sort((a, b) => a - b));
  const refresh = () => qc.invalidateQueries({ queryKey: plannerKeys.admin });

  const save = async () => {
    setSaving(true);
    try {
      const { companyTimezone, defaultReminderOffsets, workingHoursStart, workingHoursEnd, workingDays, notificationSound, quietHoursEnabled, quietHoursStart, quietHoursEnd, weekendReminders, respectHolidays, meetingReminderOffsets, mandatoryCategories, maxDeliveryAttempts } = cfg;
      await saveAdminSettings({ companyTimezone, defaultReminderOffsets, workingHoursStart, workingHoursEnd, workingDays, notificationSound, quietHoursEnabled, quietHoursStart, quietHoursEnd, weekendReminders, respectHolidays, meetingReminderOffsets, mandatoryCategories, maxDeliveryAttempts });
      setStatus('Company settings saved ✓');
      refresh();
    } catch (err) {
      setStatus(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    if (!draft) return;
    try {
      await createCompanyReminder(draft);
      setDraft(null);
      refresh();
    } catch (err) {
      setStatus(errorMessage(err));
    }
  };

  const reminders = q.data!.companyReminders;

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <section className={card}>
        <h3 className="flex items-center gap-2 text-sm font-black text-brand-950 dark:text-white">
          <Building2 size={16} className="text-indigo-500" /> Company defaults
        </h3>
        <label className="block text-xs font-bold text-brand-600 dark:text-brand-300">
          Company timezone{' '}
          <select value={cfg.companyTimezone} onChange={(e) => set('companyTimezone', e.target.value)} className={input}>
            {Array.from(new Set([cfg.companyTimezone, ...TIMEZONES])).map((tz) => (
              <option key={tz}>{tz}</option>
            ))}
          </select>
        </label>
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-brand-500 mb-1.5">Default reminder time</p>
          <div className="flex flex-wrap gap-1.5">
            {REMINDER_OPTIONS.map((o) => (
              <button key={o.minutes} onClick={() => toggleNum('defaultReminderOffsets', o.minutes)} className={chip(cfg.defaultReminderOffsets.includes(o.minutes))}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-brand-500 mb-1.5">Meeting reminders (15-min and start alerts are always sent)</p>
          <div className="flex flex-wrap gap-1.5">
            {[1440, 120, 60, 30].map((m) => (
              <button key={m} onClick={() => toggleNum('meetingReminderOffsets', m)} className={chip(cfg.meetingReminderOffsets.includes(m))}>
                {REMINDER_OPTIONS.find((o) => o.minutes === m)?.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-brand-600 dark:text-brand-300">
          Working hours
          <input type="time" value={cfg.workingHoursStart} onChange={(e) => set('workingHoursStart', e.target.value)} className={input} aria-label="Working hours start" /> –
          <input type="time" value={cfg.workingHoursEnd} onChange={(e) => set('workingHoursEnd', e.target.value)} className={input} aria-label="Working hours end" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAY_SHORT.map((d, i) => (
            <button key={d} onClick={() => toggleNum('workingDays', i)} className={chip(cfg.workingDays.includes(i))}>
              {d}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] font-black uppercase tracking-wider text-brand-500 mr-1">Sound</span>
          {SOUNDS.map((s) => (
            <button key={s.key} onClick={() => set('notificationSound', s.key)} className={chip(cfg.notificationSound === s.key)}>
              {s.label}
            </button>
          ))}
        </div>
      </section>

      <section className={card}>
        <h3 className="text-sm font-black text-brand-950 dark:text-white">🛡 Policies</h3>
        <Toggle checked={cfg.quietHoursEnabled} onChange={(v) => set('quietHoursEnabled', v)} label="Company quiet hours" hint="Applies to everyone (non-mandatory reminders)" />
        {cfg.quietHoursEnabled && (
          <div className="flex items-center gap-2 text-xs font-bold text-brand-600 dark:text-brand-300">
            <input type="time" value={cfg.quietHoursStart} onChange={(e) => set('quietHoursStart', e.target.value)} className={input} aria-label="Quiet start" /> to
            <input type="time" value={cfg.quietHoursEnd} onChange={(e) => set('quietHoursEnd', e.target.value)} className={input} aria-label="Quiet end" />
          </div>
        )}
        <Toggle checked={cfg.weekendReminders} onChange={(v) => set('weekendReminders', v)} label="Allow weekend reminders" />
        <Toggle checked={cfg.respectHolidays} onChange={(v) => set('respectHolidays', v)} label="Respect company holidays" hint="Defers reminders and skips company reminders on holidays" />
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-brand-500 mb-1.5">Mandatory categories (bypass DND & quiet hours)</p>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => set('mandatoryCategories', cfg.mandatoryCategories.includes(c) ? cfg.mandatoryCategories.filter((x) => x !== c) : [...cfg.mandatoryCategories, c])}
                className={chip(cfg.mandatoryCategories.includes(c))}
              >
                {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
              </button>
            ))}
          </div>
        </div>
        <label className="block text-xs font-bold text-brand-600 dark:text-brand-300">
          Delivery retries{' '}
          <input type="number" min={1} max={10} value={cfg.maxDeliveryAttempts} onChange={(e) => set('maxDeliveryAttempts', Math.min(10, Math.max(1, Number(e.target.value) || 1)))} className={`${input} w-20`} />
        </label>
        <div className="flex items-center justify-end gap-3 pt-2">
          {status && <p className="text-xs font-bold text-brand-600 dark:text-brand-300" role="status">{status}</p>}
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-indigo-600 text-white text-xs font-black shadow-lg disabled:opacity-60 cursor-pointer">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
          </button>
        </div>
      </section>

      <section className={`${card} lg:col-span-2`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-black text-brand-950 dark:text-white">
            <Clock size={16} className="text-orange-500" /> Company reminders (attendance & routines)
          </h3>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                const r = await runScheduler();
                setStatus(`Scheduler ran: ${JSON.stringify(r?.result?.delivery ?? {})}`);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-brand-200 dark:border-brand-800 text-xs font-bold cursor-pointer"
            >
              <Play size={13} /> Run scheduler now
            </button>
            <button
              onClick={() => setDraft({ title: '', message: '', kind: 'CUSTOM', time: '10:00', daysOfWeek: [1, 2, 3, 4, 5], targetRoles: [], departments: [], mandatory: false, isActive: true, actionUrl: null })}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black cursor-pointer"
            >
              <Plus size={13} /> New reminder
            </button>
          </div>
        </div>
        {q.data!.scheduler && <p className="text-[11px] text-brand-400">Last scheduler run: {new Date(q.data!.scheduler.at).toLocaleString()}</p>}

        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-brand-400 self-center mr-1">Quick add</span>
          {PRESETS.filter((p) => !reminders.some((r) => r.kind === p.kind && r.time === p.time)).map((p) => (
            <button key={p.kind} onClick={() => setDraft({ ...p, isActive: true })} className={chip(false)}>
              {p.title}
            </button>
          ))}
        </div>

        {draft && (
          <div className="rounded-2xl border border-indigo-500/40 bg-indigo-500/5 p-4 grid sm:grid-cols-2 gap-3">
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Title" className={input} aria-label="Reminder title" />
            <input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} className={input} aria-label="Reminder time" />
            <input value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} placeholder="Message" className={`${input} sm:col-span-2`} aria-label="Reminder message" />
            <div className="flex flex-wrap gap-1.5 sm:col-span-2">
              {WEEKDAY_SHORT.map((d, i) => (
                <button key={d} onClick={() => setDraft({ ...draft, daysOfWeek: draft.daysOfWeek.includes(i) ? draft.daysOfWeek.filter((x) => x !== i) : [...draft.daysOfWeek, i] })} className={chip(draft.daysOfWeek.includes(i))}>
                  {d}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 sm:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-brand-400 self-center mr-1">Roles (none = all)</span>
              {ROLES.map((r) => (
                <button key={r} onClick={() => setDraft({ ...draft, targetRoles: draft.targetRoles.includes(r) ? draft.targetRoles.filter((x) => x !== r) : [...draft.targetRoles, r] })} className={chip(draft.targetRoles.includes(r))}>
                  {r.replace('_', ' ').toLowerCase()}
                </button>
              ))}
            </div>
            <input
              value={draft.departments.join(', ')}
              onChange={(e) => setDraft({ ...draft, departments: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
              placeholder="Departments (comma separated, empty = all)"
              className={input}
            />
            <input value={draft.actionUrl || ''} onChange={(e) => setDraft({ ...draft, actionUrl: e.target.value || null })} placeholder="Open link (e.g. /attendance)" className={input} />
            <div className="sm:col-span-2">
              <Toggle checked={draft.mandatory} onChange={(v) => setDraft({ ...draft, mandatory: v })} label="Mandatory" hint="Bypasses employee DND, quiet hours and channel opt-outs" />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button onClick={() => setDraft(null)} className="px-3 py-2 rounded-xl text-xs font-bold cursor-pointer">
                Cancel
              </button>
              <button disabled={!draft.title || !draft.message} onClick={saveDraft} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black disabled:opacity-50 cursor-pointer">
                Save reminder
              </button>
            </div>
          </div>
        )}

        {reminders.length === 0 && !draft && <p className="text-xs text-brand-400">No company reminders yet. Existing shift check-in/check-out alerts keep running as before.</p>}
        <ul className="divide-y divide-brand-100 dark:divide-brand-900">
          {reminders.map((r) => (
            <li key={r.id} className="py-3 flex flex-wrap items-center gap-3">
              <span className="text-lg font-black tabular-nums text-brand-900 dark:text-white w-14">{r.time}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-brand-900 dark:text-white truncate">
                  {r.title} {r.mandatory && <span className="ml-1 text-[9px] font-black uppercase text-rose-500">mandatory</span>}
                </span>
                <span className="block text-[11px] text-brand-500 truncate">
                  {r.daysOfWeek.map((d) => WEEKDAY_SHORT[d]).join(' ')} · {r.targetRoles.length ? r.targetRoles.join(', ').toLowerCase() : 'everyone'}
                  {r.departments.length ? ` · ${r.departments.join(', ')}` : ''}
                </span>
              </span>
              <Toggle checked={r.isActive} onChange={async (v) => { await updateCompanyReminder(r.id, { isActive: v }); refresh(); }} label={r.isActive ? 'Active' : 'Paused'} />
              <button
                onClick={async () => {
                  if (await confirm({ title: 'Delete reminder', message: `Delete “${r.title}”?`, variant: 'danger', confirmText: 'Delete' })) {
                    await deleteCompanyReminder(r.id);
                    refresh();
                  }
                }}
                className="p-2 rounded-xl text-brand-400 hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                aria-label={`Delete ${r.title}`}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default AdminView;
