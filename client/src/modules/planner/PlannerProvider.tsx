import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { AlarmClock, CheckCircle2, ExternalLink, X } from 'lucide-react';
import { SOCKET_URL } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { reminderAction, snoozeTask, completeTask, syncOfflineQueue, taskCache } from './api';
import { plannerKeys, usePreferences } from './hooks';
import { PRIORITY_META, SNOOZE_OPTIONS } from './lib/constants';
import { collectDueLocalReminders } from './lib/localReminders';
import { playReminderSound } from './lib/sound';
import { formatDue } from './lib/time';
import type { ReminderEvent, TaskPriority } from './types';

/**
 * Global planner runtime, mounted once inside the authenticated layout:
 *  - listens for `planner:reminder` socket events and service-worker messages
 *    and shows rich reminder toasts (Complete / Snooze / Open / Dismiss)
 *  - replays the offline queue when connectivity returns
 *  - fires local reminders from cached tasks while offline
 *  - keeps planner queries fresh when collaborators change shared tasks
 *  - handles `?task=&action=` deep links coming from notification clicks
 */
export const PlannerProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const prefs = usePreferences();
  const [toasts, setToasts] = useState<ReminderEvent[]>([]);
  const seen = useRef(new Set<string>());
  const prefsRef = useRef(prefs.data?.preferences);
  prefsRef.current = prefs.data?.preferences;

  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: plannerKeys.all }), [qc]);

  const show = useCallback((ev: ReminderEvent) => {
    if (seen.current.has(ev.reminderId)) return; // socket + SW message dedupe
    seen.current.add(ev.reminderId);
    setToasts((prev) => [ev, ...prev].slice(0, 4));
    const p = prefsRef.current;
    if (!ev.silent && (p?.soundEnabled ?? true)) playReminderSound(p?.sound || 'chime');
    if (navigator.vibrate && !ev.silent) navigator.vibrate([120, 60, 120]);
    const ttl = ev.priority === 'CRITICAL' || ev.priority === 'HIGH' ? 30_000 : 12_000;
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.reminderId !== ev.reminderId)), ttl);
  }, []);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.reminderId !== id));

  // Socket: realtime reminders + collaborator changes
  useEffect(() => {
    if (!user) return;
    const socket = io(SOCKET_URL);
    socket.on('connect', () => socket.emit('register', user.employeeId));
    socket.on('planner:reminder', (ev: ReminderEvent) => {
      show(ev);
      refresh();
    });
    socket.on('planner:task', () => refresh());
    return () => {
      socket.disconnect();
    };
  }, [user, show, refresh]);

  // Service worker: push arrived while a tab is visible, or an action was taken in the OS notification
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (d?.type === 'PLANNER_REMINDER' && d.reminder) show(d.reminder as ReminderEvent);
      if (d?.type === 'PLANNER_ACTION_DONE' || d?.type === 'ONEBRIDGE_BG_SYNC') {
        if (d?.tag === 'sync-planner' || d?.type === 'ONEBRIDGE_BG_SYNC') void syncOfflineQueue().then(refresh);
        else refresh();
      }
    };
    navigator.serviceWorker.addEventListener('message', onMsg);
    // Tell the SW where the API lives so notification buttons work without opening the app.
    navigator.serviceWorker.ready
      .then((reg) => reg.active?.postMessage({ type: 'PLANNER_CONFIG', apiBase: `${SOCKET_URL}/api` }))
      .catch(() => undefined);
    return () => navigator.serviceWorker.removeEventListener('message', onMsg);
  }, [show, refresh]);

  // Offline queue replay
  useEffect(() => {
    if (!user) return;
    const sync = () =>
      void syncOfflineQueue().then((r) => {
        if (r.synced) void refresh();
      });
    sync();
    window.addEventListener('online', sync);
    const t = setInterval(sync, 60_000);
    return () => {
      window.removeEventListener('online', sync);
      clearInterval(t);
    };
  }, [user, refresh]);

  // Local reminders while offline (server is the source of truth when online)
  useEffect(() => {
    if (!user) return;
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      const since = last;
      last = now;
      if (navigator.onLine) return;
      if (prefsRef.current && prefsRef.current.channelBrowser === false) return;
      const due = collectDueLocalReminders(taskCache.read(), localStorage, now, since);
      for (const r of due) {
        const ev: ReminderEvent = {
          reminderId: `local-${r.key}`,
          taskId: r.taskId,
          title: r.title,
          body: `${formatDue(r.dueAt)} · offline reminder`,
          priority: r.priority,
          kind: 'LOCAL',
          url: `/planner?task=${r.taskId}`,
          local: true,
        };
        show(ev);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          navigator.serviceWorker?.ready
            .then((reg) =>
              reg.showNotification(`🔔 ${r.title}`, {
                body: ev.body,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-96x96.png',
                tag: ev.reminderId,
                data: { url: ev.url, planner: true, taskId: r.taskId },
              })
            )
            .catch(() => undefined);
        }
      }
    };
    const t = setInterval(tick, 20_000);
    return () => clearInterval(t);
  }, [user, show]);

  const act = async (ev: ReminderEvent, action: 'COMPLETE' | 'SNOOZE' | 'OPEN' | 'DISMISS', snooze?: string) => {
    dismiss(ev.reminderId);
    try {
      if (action === 'OPEN') {
        navigate(ev.url || '/planner');
        if (!ev.local) void reminderAction(ev.reminderId, 'OPEN').catch(() => undefined);
        return;
      }
      if (ev.local || !ev.reminderId) {
        if (action === 'COMPLETE' && ev.taskId) await completeTask(ev.taskId);
        if (action === 'SNOOZE' && ev.taskId) await snoozeTask(ev.taskId, snooze || '10').catch(() => undefined);
      } else {
        await reminderAction(ev.reminderId, action, snooze);
      }
    } finally {
      refresh();
    }
  };

  return (
    <>
      {children}
      <div className="fixed z-[80] top-[calc(env(safe-area-inset-top,0px)+4.5rem)] right-3 left-3 sm:left-auto sm:w-[380px] space-y-2.5 pointer-events-none" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <ReminderToast key={t.reminderId} ev={t} onAction={act} />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
};

const ReminderToast: React.FC<{ ev: ReminderEvent; onAction: (ev: ReminderEvent, a: 'COMPLETE' | 'SNOOZE' | 'OPEN' | 'DISMISS', s?: string) => void }> = ({ ev, onAction }) => {
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const pm = PRIORITY_META[(ev.priority as TaskPriority) || 'MEDIUM'] || PRIORITY_META.MEDIUM;
  const isTask = !!ev.taskId;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      role="alert"
      className="pointer-events-auto relative overflow-hidden rounded-2xl bg-white/95 dark:bg-brand-900/95 backdrop-blur-xl border border-brand-200 dark:border-brand-800 shadow-2xl shadow-indigo-900/20"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${pm.dot}`} />
      <div className="p-3.5 pl-4 flex gap-3">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-white dark:bg-brand-950 border border-brand-200 dark:border-brand-800 p-1 shadow-sm">
          <img src="/image.png" alt="OneBridge" className="w-full h-full object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">{isTask ? 'Task reminder' : 'Reminder'}</p>
            <button onClick={() => onAction(ev, 'DISMISS')} className="text-brand-400 hover:text-brand-700 dark:hover:text-white cursor-pointer -mt-0.5" aria-label="Dismiss">
              <X size={15} />
            </button>
          </div>
          <p className="text-sm font-black text-brand-950 dark:text-white leading-snug break-words">{ev.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-brand-500">{ev.body}</span>
            {isTask && <span className={`px-1.5 py-0.5 rounded-full border text-[9px] font-black uppercase ${pm.badge}`}>{pm.label}</span>}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {isTask && (
              <button onClick={() => onAction(ev, 'COMPLETE')} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 text-white text-[11px] font-black cursor-pointer hover:bg-emerald-600">
                <CheckCircle2 size={12} /> Complete
              </button>
            )}
            {isTask && (
              <button onClick={() => setSnoozeOpen(!snoozeOpen)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-800 text-brand-700 dark:text-brand-100 text-[11px] font-black cursor-pointer" aria-expanded={snoozeOpen}>
                <AlarmClock size={12} /> Snooze
              </button>
            )}
            <button onClick={() => onAction(ev, 'OPEN')} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-black cursor-pointer">
              <ExternalLink size={12} /> Open
            </button>
          </div>
          <AnimatePresence>
            {snoozeOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="pt-2 flex flex-wrap gap-1">
                  {SNOOZE_OPTIONS.map((o) => (
                    <button key={o.value} onClick={() => onAction(ev, 'SNOOZE', o.value)} className="px-2 py-1 rounded-md border border-brand-200 dark:border-brand-700 text-[10px] font-bold text-brand-600 dark:text-brand-200 hover:border-indigo-400 cursor-pointer">
                      {o.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default PlannerProvider;
