import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart3,
  CalendarDays,
  CloudOff,
  Columns3,
  Filter,
  List,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard, useOfflineStatus, useTaskMutations, useTasks } from './hooks';
import { errorMessage, reminderAction, syncOfflineQueue } from './api';
import { CATEGORIES, CATEGORY_META, PRIORITIES, PRIORITY_META, SMART_FILTERS } from './lib/constants';
import { addDays } from './lib/time';
import KanbanBoard from './components/KanbanBoard';
import TaskList from './components/TaskList';
import TaskEditor from './components/TaskEditor';
import TaskDrawer from './components/TaskDrawer';
import CalendarView from './components/CalendarView';
import ReportsView from './components/ReportsView';
import SettingsView from './components/SettingsView';
import AdminView from './components/AdminView';
import QuickAddFab from './components/QuickAdd';
import type { ListParams, PlannerTask, SmartFilter, TaskInput, TaskStatus } from './types';

type Tab = 'board' | 'list' | 'calendar' | 'reports' | 'settings' | 'admin';

const VIEW_KEY = 'obi_planner_view';

export const PlannerPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const isManager = user?.role === 'TEAM_LEAD' || user?.role === 'HR' || user?.role === 'SUPER_ADMIN';
  const isAdmin = user?.role === 'HR' || user?.role === 'SUPER_ADMIN';

  const initialTab = (): Tab => {
    if (location.pathname.endsWith('/calendar')) return 'calendar';
    const fromQuery = params.get('view') as Tab | null;
    if (fromQuery) return fromQuery;
    try {
      return (localStorage.getItem(VIEW_KEY) as Tab) || 'board';
    } catch {
      return 'board';
    }
  };
  const [tab, setTab] = useState<Tab>(initialTab);
  const [filter, setFilter] = useState<SmartFilter>('ALL');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const [scope, setScope] = useState<'MINE' | 'TEAM' | 'ALL'>('MINE');
  const [editor, setEditor] = useState<{ open: boolean; task?: PlannerTask | null; defaults?: Partial<TaskInput> }>({ open: false });
  const [banner, setBanner] = useState<string | null>(null);
  const { online, pending } = useOfflineStatus();
  const dash = useDashboard();
  const { move } = useTaskMutations();

  const openTaskId = params.get('task');

  useEffect(() => {
    if (location.pathname.endsWith('/calendar')) setTab('calendar');
  }, [location.pathname]);

  useEffect(() => {
    try {
      if (tab === 'board' || tab === 'list') localStorage.setItem(VIEW_KEY, tab);
    } catch {
      /* ignore */
    }
  }, [tab]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Deep links from notification clicks: /planner?task=ID&action=complete|snooze&reminder=RID
  useEffect(() => {
    const action = params.get('action');
    const taskId = params.get('task');
    const reminderId = params.get('reminder');
    if (!action || !taskId) return;
    const next = new URLSearchParams(params);
    next.delete('action');
    next.delete('reminder');
    setParams(next, { replace: true });
    (async () => {
      try {
        if (reminderId) await reminderAction(reminderId, action === 'complete' ? 'COMPLETE' : 'SNOOZE');
        else if (action === 'complete') await move.mutateAsync({ id: taskId, status: 'COMPLETED' });
        setBanner(action === 'complete' ? 'Task marked complete ✓' : 'Reminder snoozed ⏰');
      } catch (err) {
        setBanner(errorMessage(err));
      }
      setTimeout(() => setBanner(null), 3500);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const listParams: ListParams = useMemo(
    () => ({
      filter,
      q: debounced || undefined,
      priority: priority || undefined,
      category: category || undefined,
      scope,
    }),
    [filter, debounced, priority, category, scope]
  );
  const tasksQ = useTasks(listParams);
  const tasks = useMemo(() => tasksQ.data || [], [tasksQ.data]);

  const boardTasks = useMemo(() => tasks.filter((t) => ['PENDING', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'].includes(t.status)), [tasks]);

  const openTask = (t: PlannerTask | string) => {
    const id = typeof t === 'string' ? t : t.id;
    const next = new URLSearchParams(params);
    next.set('task', id);
    setParams(next);
  };
  const closeTask = () => {
    const next = new URLSearchParams(params);
    next.delete('task');
    setParams(next);
  };
  const toggleComplete = (t: PlannerTask) => move.mutate({ id: t.id, status: t.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED' });

  const tabs: Array<{ key: Tab; label: string; icon: React.ElementType; show: boolean }> = [
    { key: 'board', label: 'Board', icon: Columns3, show: true },
    { key: 'list', label: 'List', icon: List, show: true },
    { key: 'calendar', label: 'Calendar', icon: CalendarDays, show: true },
    { key: 'reports', label: 'Reports', icon: BarChart3, show: true },
    { key: 'settings', label: 'Settings', icon: Settings2, show: true },
    { key: 'admin', label: 'Admin', icon: ShieldCheck, show: isAdmin },
  ];

  const counts = dash.data?.counts;
  const activeFilters = [priority, category, scope !== 'MINE' ? scope : ''].filter(Boolean).length;

  return (
    <div className="space-y-5 pb-24">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden glass rounded-3xl border border-brand-200 dark:border-brand-900 shadow-xl p-5 md:p-7">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gradient-to-br from-orange-500/20 to-indigo-600/20 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-end gap-5 justify-between">
          <div className="space-y-2">
            <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest bg-orange-500/10 border border-orange-500/30 px-3 py-1 rounded-full">Smart Tasks & Reminders</span>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-brand-950 dark:text-white">My Planner</h1>
            <p className="text-xs text-brand-500 font-semibold max-w-md">Organise your day, get reminded at the right moment, and never miss a meeting or deadline.</p>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {[
              { label: 'Today', value: counts?.today, tone: 'text-indigo-600 dark:text-indigo-300', f: 'TODAY' as SmartFilter },
              { label: 'Overdue', value: counts?.overdue, tone: 'text-rose-500', f: 'OVERDUE' as SmartFilter },
              { label: 'Upcoming', value: counts?.upcoming, tone: 'text-violet-500', f: 'UPCOMING' as SmartFilter },
              { label: 'Done today', value: counts?.completedToday, tone: 'text-emerald-500', f: 'COMPLETED' as SmartFilter },
            ].map((s) => (
              <button
                key={s.label}
                onClick={() => {
                  setFilter(s.f);
                  if (tab !== 'board' && tab !== 'list') setTab('list');
                }}
                className="glass rounded-2xl border border-brand-200 dark:border-brand-900 px-3 py-2.5 text-left hover:-translate-y-0.5 transition cursor-pointer"
              >
                <p className={`text-xl sm:text-2xl font-black tabular-nums ${s.tone}`}>{s.value ?? '–'}</p>
                <p className="text-[10px] font-bold text-brand-500">{s.label}</p>
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {(!online || pending > 0) && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-bold text-amber-700 dark:text-amber-400" role="status">
          <CloudOff size={15} />
          {online ? `${pending} change${pending === 1 ? '' : 's'} waiting to sync` : `You're offline — changes are saved on this device${pending ? ` (${pending} pending)` : ''} and reminders still fire locally.`}
          {online && pending > 0 && (
            <button onClick={() => void syncOfflineQueue().then(() => tasksQ.refetch())} className="ml-auto inline-flex items-center gap-1 underline cursor-pointer">
              <RefreshCw size={12} /> Sync now
            </button>
          )}
        </div>
      )}
      {banner && <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">{banner}</div>}

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <div className="flex gap-1 p-1 glass rounded-2xl border border-brand-200 dark:border-brand-900 shrink-0" role="tablist">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => {
                  setTab(t.key);
                  if (location.pathname !== '/planner') navigate(`/planner${params.toString() ? `?${params}` : ''}`);
                }}
                className={`relative inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                  tab === t.key ? 'text-white' : 'text-brand-500 hover:text-brand-800 dark:hover:text-white'
                }`}
              >
                {tab === t.key && <motion.span layoutId="plannerTab" className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-500 to-indigo-600 -z-0" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                <t.icon size={14} className="relative" />
                <span className="relative hidden sm:inline">{t.label}</span>
              </button>
            ))}
        </div>
        <button
          onClick={() => setEditor({ open: true, task: null })}
          className="ml-auto shrink-0 hidden sm:inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-indigo-600 text-white text-xs font-black shadow-lg shadow-indigo-600/20 hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer"
        >
          <Plus size={14} /> New task
        </button>
      </div>

      {(tab === 'board' || tab === 'list') && (
        <>
          {/* Search & filters */}
          <div className="space-y-2.5">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search title, tags, category, priority, project, person, status…"
                  className="w-full glass rounded-2xl border border-brand-200 dark:border-brand-900 pl-10 pr-9 py-2.5 text-sm text-brand-950 dark:text-white placeholder:text-brand-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  aria-label="Search tasks"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-400 cursor-pointer" aria-label="Clear search">
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                aria-expanded={showFilters}
                className={`relative inline-flex items-center gap-1.5 px-3.5 rounded-2xl border text-xs font-bold cursor-pointer ${
                  showFilters || activeFilters ? 'border-indigo-500 text-indigo-600 dark:text-indigo-300 bg-indigo-500/5' : 'glass border-brand-200 dark:border-brand-900 text-brand-600 dark:text-brand-300'
                }`}
              >
                <Filter size={14} /> <span className="hidden sm:inline">Filters</span>
                {activeFilters > 0 && <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] flex items-center justify-center">{activeFilters}</span>}
              </button>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {SMART_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition cursor-pointer ${
                    filter === f.key ? 'bg-brand-950 dark:bg-white text-white dark:text-brand-950 border-transparent' : 'border-brand-200 dark:border-brand-800 text-brand-600 dark:text-brand-300 hover:border-indigo-400'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {showFilters && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl border border-brand-200 dark:border-brand-900 p-3 flex flex-wrap gap-2 items-center">
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950 px-3 py-2 text-xs font-bold" aria-label="Priority filter">
                  <option value="">Any priority</option>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_META[p].label}
                    </option>
                  ))}
                </select>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950 px-3 py-2 text-xs font-bold" aria-label="Category filter">
                  <option value="">Any category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
                    </option>
                  ))}
                </select>
                {isManager && (
                  <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className="rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950 px-3 py-2 text-xs font-bold" aria-label="Scope">
                    <option value="MINE">My tasks</option>
                    <option value="TEAM">My team</option>
                    {isAdmin && <option value="ALL">Company (non-personal)</option>}
                  </select>
                )}
                {activeFilters > 0 && (
                  <button
                    onClick={() => {
                      setPriority('');
                      setCategory('');
                      setScope('MINE');
                    }}
                    className="text-xs font-bold text-brand-500 hover:text-rose-500 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </motion.div>
            )}
          </div>

          {tasksQ.isLoading && (
            <div className="py-20 flex justify-center">
              <Loader2 className="animate-spin text-indigo-500" />
            </div>
          )}
          {tasksQ.isError && <p className="text-sm text-rose-500">{errorMessage(tasksQ.error, 'Could not load tasks')}</p>}
          {!tasksQ.isLoading && tasks.length === 0 && (
            <div className="glass rounded-3xl border border-dashed border-brand-300 dark:border-brand-800 py-16 text-center space-y-3">
              <p className="text-4xl">🗂️</p>
              <p className="text-sm font-black text-brand-900 dark:text-white">{filter === 'ALL' && !debounced ? 'Your planner is empty' : 'No tasks match these filters'}</p>
              <p className="text-xs text-brand-500">Press <kbd className="px-1.5 py-0.5 rounded bg-brand-100 dark:bg-brand-900 font-mono">N</kbd> or tap + to add one in seconds.</p>
              <button onClick={() => setEditor({ open: true, task: null })} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black cursor-pointer">
                <Plus size={13} /> Create task
              </button>
            </div>
          )}
          {tasks.length > 0 && tab === 'board' && (
            <KanbanBoard
              tasks={boardTasks}
              onOpen={openTask}
              onToggleComplete={toggleComplete}
              onMove={(t, status, position) => move.mutate({ id: t.id, status, position })}
              onAdd={(status: TaskStatus) => setEditor({ open: true, task: null, defaults: { status } })}
            />
          )}
          {tasks.length > 0 && tab === 'list' && <TaskList tasks={tasks} onOpen={openTask} onToggleComplete={toggleComplete} />}
        </>
      )}

      {tab === 'calendar' && (
        <CalendarView
          onOpenTask={openTask}
          onCreateOn={(d) => {
            const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 10, 0);
            setEditor({ open: true, task: null, defaults: { dueAt: (at < new Date() ? addDays(at, 0) : at).toISOString() } });
          }}
        />
      )}
      {tab === 'reports' && <ReportsView onOpenTask={openTask} />}
      {tab === 'settings' && <SettingsView />}
      {tab === 'admin' && isAdmin && <AdminView />}

      <QuickAddFab onOpenFull={(title) => setEditor({ open: true, task: null, defaults: { title } })} />
      <TaskEditor open={editor.open} task={editor.task} defaults={editor.defaults} onClose={() => setEditor({ open: false })} />
      <TaskDrawer
        taskId={openTaskId}
        onClose={closeTask}
        onEdit={(t) => {
          setEditor({ open: true, task: t });
        }}
      />
    </div>
  );
};

export default PlannerPage;
