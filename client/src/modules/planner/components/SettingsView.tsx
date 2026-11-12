import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BellRing, Check, Loader2, Moon, Send, Volume2 } from 'lucide-react';
import { requestNotificationPermission, subscribeToPushNotifications } from '../../../registerServiceWorker';
import { errorMessage, fetchNotificationHistory, savePreferences, sendTestReminder } from '../api';
import { plannerKeys, usePreferences } from '../hooks';
import { REMINDER_OPTIONS, SNOOZE_OPTIONS, TIMEZONES, WEEKDAY_SHORT } from '../lib/constants';
import { playReminderSound, SOUNDS } from '../lib/sound';
import type { Preferences } from '../types';
import { card, chip, input } from './formStyles';
import { useQuery } from '@tanstack/react-query';

export const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }> = ({ checked, onChange, label, hint, disabled }) => (
  <label className={`flex items-start justify-between gap-4 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
    <span>
      <span className="block text-sm font-bold text-brand-900 dark:text-white">{label}</span>
      {hint && <span className="block text-[11px] text-brand-500">{hint}</span>}
    </span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-brand-300 dark:bg-brand-700'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  </label>
);

export const SettingsView: React.FC = () => {
  const qc = useQueryClient();
  const prefs = usePreferences();
  const history = useQuery({ queryKey: ['planner', 'notif-history'], queryFn: fetchNotificationHistory, staleTime: 30_000 });
  const [form, setForm] = useState<Preferences | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

  useEffect(() => {
    if (prefs.data && !form) setForm(prefs.data.preferences);
  }, [prefs.data, form]);

  if (!form) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="animate-spin text-indigo-500" />
      </div>
    );
  }
  const set = <K extends keyof Preferences>(k: K, v: Preferences[K]) => setForm({ ...form, [k]: v });
  const toggleIn = (k: 'defaultReminderOffsets' | 'workingDays', v: number) => {
    const list = form[k];
    set(k, list.includes(v) ? list.filter((x) => x !== v) : [...list, v].sort((a, b) => a - b));
  };

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const { timezone, soundEnabled, sound, defaultReminderOffsets, workingHoursStart, workingHoursEnd, workingDays, onlyDuringWorkingHours, dndEnabled, dndUntil, quietHoursEnabled, quietHoursStart, quietHoursEnd, weekendReminders, channelInApp, channelPush, channelBrowser, defaultSnoozeMinutes } = form;
      const saved = await savePreferences({ timezone, soundEnabled, sound, defaultReminderOffsets, workingHoursStart, workingHoursEnd, workingDays, onlyDuringWorkingHours, dndEnabled, dndUntil: dndUntil || null, quietHoursEnabled, quietHoursStart, quietHoursEnd, weekendReminders, channelInApp, channelPush, channelBrowser, defaultSnoozeMinutes });
      setForm(saved);
      qc.invalidateQueries({ queryKey: plannerKeys.prefs });
      setStatus('Saved ✓');
    } catch (err) {
      setStatus(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const enablePush = async () => {
    const p = await requestNotificationPermission();
    setPermission(p);
    if (p === 'granted') {
      const ok = await subscribeToPushNotifications();
      setStatus(ok ? 'Push notifications enabled on this device ✓' : 'Permission granted, but push subscription failed.');
    }
  };

  const test = async () => {
    setStatus('Sending test reminder…');
    try {
      await sendTestReminder();
      setStatus('Test reminder sent — check the toast and your notification tray.');
    } catch (err) {
      setStatus(errorMessage(err));
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <section className={card}>
        <h3 className="flex items-center gap-2 text-sm font-black text-brand-950 dark:text-white">
          <BellRing size={16} className="text-orange-500" /> Notifications on this device
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
              permission === 'granted' ? 'bg-emerald-500/10 text-emerald-600' : permission === 'denied' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-600'
            }`}
          >
            {permission === 'unsupported' ? 'Not supported' : permission === 'default' ? 'Not enabled' : permission}
          </span>
          {permission !== 'granted' && permission !== 'unsupported' && (
            <button onClick={enablePush} className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black cursor-pointer">
              Enable notifications
            </button>
          )}
          <button onClick={test} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-brand-200 dark:border-brand-800 text-xs font-black text-brand-700 dark:text-brand-200 cursor-pointer">
            <Send size={13} /> Send test reminder
          </button>
        </div>
        {permission === 'denied' && <p className="text-[11px] text-brand-500">Notifications are blocked. Allow them in your browser's site settings, then reload.</p>}
        <Toggle checked={form.channelInApp} onChange={(v) => set('channelInApp', v)} label="In-app notifications" hint="Toast + Notification Center" />
        <Toggle checked={form.channelPush} onChange={(v) => set('channelPush', v)} label="Push notifications" hint="Desktop tray & mobile lock screen (PWA)" />
        <Toggle checked={form.channelBrowser} onChange={(v) => set('channelBrowser', v)} label="Browser notifications while offline" hint="Reminders fire locally from cached tasks when you're offline" />
        <div className="space-y-1.5 opacity-60">
          <Toggle checked={false} onChange={() => undefined} disabled label="Email" hint="Coming soon" />
          <Toggle checked={false} onChange={() => undefined} disabled label="WhatsApp" hint="Coming soon" />
          <Toggle checked={false} onChange={() => undefined} disabled label="SMS" hint="Coming soon" />
        </div>
      </section>

      <section className={card}>
        <h3 className="flex items-center gap-2 text-sm font-black text-brand-950 dark:text-white">
          <Volume2 size={16} className="text-indigo-500" /> Reminders & sound
        </h3>
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-brand-500 mb-1.5">Default reminders for new tasks</p>
          <div className="flex flex-wrap gap-1.5">
            {REMINDER_OPTIONS.map((o) => (
              <button key={o.minutes} type="button" onClick={() => toggleIn('defaultReminderOffsets', o.minutes)} className={chip(form.defaultReminderOffsets.includes(o.minutes))}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold text-brand-600 dark:text-brand-300">
            Default snooze{' '}
            <select value={String(form.defaultSnoozeMinutes)} onChange={(e) => set('defaultSnoozeMinutes', Number(e.target.value))} className={input}>
              {SNOOZE_OPTIONS.filter((o) => o.value !== 'TOMORROW').map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-brand-600 dark:text-brand-300">
            Timezone{' '}
            <select value={form.timezone} onChange={(e) => set('timezone', e.target.value)} className={input}>
              {Array.from(new Set([form.timezone, ...TIMEZONES])).map((tz) => (
                <option key={tz}>{tz}</option>
              ))}
            </select>
          </label>
        </div>
        <Toggle checked={form.soundEnabled} onChange={(v) => set('soundEnabled', v)} label="Notification sound" />
        <div className="flex flex-wrap gap-1.5">
          {SOUNDS.map((s) => (
            <button
              key={s.key}
              type="button"
              disabled={!form.soundEnabled}
              onClick={() => {
                set('sound', s.key);
                playReminderSound(s.key);
              }}
              className={`${chip(form.sound === s.key)} disabled:opacity-40`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>

      <section className={card}>
        <h3 className="flex items-center gap-2 text-sm font-black text-brand-950 dark:text-white">
          <Moon size={16} className="text-violet-500" /> Focus & quiet time
        </h3>
        <Toggle checked={form.dndEnabled} onChange={(v) => set('dndEnabled', v)} label="Do Not Disturb" hint="With an end time, reminders wait until it ends; without one, they arrive silently in-app only. Critical & mandatory reminders always come through." />
        {form.dndEnabled && (
          <label className="block text-xs font-bold text-brand-600 dark:text-brand-300">
            Until (optional){' '}
            <input
              type="datetime-local"
              value={form.dndUntil ? new Date(new Date(form.dndUntil).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
              onChange={(e) => set('dndUntil', e.target.value ? new Date(e.target.value).toISOString() : null)}
              className={input}
            />
          </label>
        )}
        <Toggle checked={form.quietHoursEnabled} onChange={(v) => set('quietHoursEnabled', v)} label="Quiet hours" hint="Reminders in this window are delivered when it ends" />
        {form.quietHoursEnabled && (
          <div className="flex items-center gap-2 text-xs font-bold text-brand-600 dark:text-brand-300">
            <input type="time" value={form.quietHoursStart} onChange={(e) => set('quietHoursStart', e.target.value)} className={input} aria-label="Quiet hours start" /> to
            <input type="time" value={form.quietHoursEnd} onChange={(e) => set('quietHoursEnd', e.target.value)} className={input} aria-label="Quiet hours end" />
          </div>
        )}
      </section>

      <section className={card}>
        <h3 className="text-sm font-black text-brand-950 dark:text-white">🗓 Working hours</h3>
        <div className="flex items-center gap-2 text-xs font-bold text-brand-600 dark:text-brand-300">
          <input type="time" value={form.workingHoursStart} onChange={(e) => set('workingHoursStart', e.target.value)} className={input} aria-label="Working hours start" /> to
          <input type="time" value={form.workingHoursEnd} onChange={(e) => set('workingHoursEnd', e.target.value)} className={input} aria-label="Working hours end" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAY_SHORT.map((d, i) => (
            <button key={d} type="button" onClick={() => toggleIn('workingDays', i)} className={chip(form.workingDays.includes(i))}>
              {d}
            </button>
          ))}
        </div>
        <Toggle checked={form.onlyDuringWorkingHours} onChange={(v) => set('onlyDuringWorkingHours', v)} label="Only notify during working hours" />
        <Toggle checked={form.weekendReminders} onChange={(v) => set('weekendReminders', v)} label="Weekend / non-working day reminders" />
      </section>

      <div className="lg:col-span-2 flex items-center justify-end gap-3 sticky bottom-3">
        {status && <p className="text-xs font-bold text-brand-600 dark:text-brand-300" role="status">{status}</p>}
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-indigo-600 text-white text-xs font-black shadow-lg disabled:opacity-60 cursor-pointer">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save settings
        </button>
      </div>

      <section className={`${card} lg:col-span-2`}>
        <h3 className="text-sm font-black text-brand-950 dark:text-white">Notification history</h3>
        {(history.data || []).length === 0 && <p className="text-xs text-brand-400">No reminders delivered yet.</p>}
        <ul className="divide-y divide-brand-100 dark:divide-brand-900">
          {(history.data || []).slice(0, 30).map((n: any) => (
            <li key={n.id} className="py-2 flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0">
                <span className="block font-bold text-brand-800 dark:text-brand-100 truncate">{n.title || n.task?.title || 'Reminder'}</span>
                <span className="text-brand-400">
                  {new Date(n.sentAt || n.updatedAt).toLocaleString()} · {(n.channels || []).join(', ').toLowerCase() || '—'}
                  {n.action ? ` · ${n.action.toLowerCase()}` : ''}
                </span>
              </span>
              <span className={`text-[10px] font-black uppercase ${n.status === 'SENT' ? 'text-emerald-500' : n.status === 'FAILED' ? 'text-rose-500' : 'text-brand-400'}`}>{n.status.toLowerCase()}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default SettingsView;
