import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import {
  Plus, CheckSquare, Clock, MessageSquare, AlertCircle, Calendar, Send,
  X, Check, Eye, Trash2, Search, Filter, ListChecks, Timer,
  Zap, Target, TrendingUp, AlertTriangle, User, ChevronDown, ArrowUpDown,
  ArrowUp, ArrowDown, LayoutList, Paperclip
} from 'lucide-react';

// ═══════════════════════════════════════
// Types
// ═══════════════════════════════════════
interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'PENDING' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED' | 'REJECTED' | 'OVERDUE';
  dueDate: string;
  progress: number;
  employeeId: string;
  assignedById: string;
  comments: Array<{ authorName: string; content: string; timestamp: string; attachments?: string[] }>;
  subtasks: Array<{ title: string; isCompleted: boolean }>;
  timeLogs: Array<{ durationMinutes: number; loggedAt: string }>;
  employee?: { firstName: string; lastName: string; department?: string; designation?: string };
  assignedBy?: { firstName: string; lastName: string; designation?: string };
  createdAt?: string;
}

interface TaskStats {
  total: number;
  pending: number;
  inProgress: number;
  review: number;
  completed: number;
  rejected: number;
  overdue: number;
  totalTimeLogged: number;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

// ═══════════════════════════════════════
// Constants
// ═══════════════════════════════════════
const STATUS_COLUMNS: Array<{ label: string; value: Task['status']; color: string }> = [
  { label: 'Pending', value: 'PENDING', color: 'bg-brand-400' },
  { label: 'In Progress', value: 'IN_PROGRESS', color: 'bg-indigo-500' },
  { label: 'Under Review', value: 'REVIEW', color: 'bg-amber-500' },
  { label: 'Completed', value: 'COMPLETED', color: 'bg-emerald-500' },
  { label: 'Rejected', value: 'REJECTED', color: 'bg-rose-500' },
];

const STATUS_OPTIONS = ['ALL', 'PENDING', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'REJECTED'] as const;
const PRIORITY_OPTIONS = ['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

type SortField = 'title' | 'priority' | 'status' | 'dueDate' | 'progress';
type SortDir = 'asc' | 'desc';

const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
const STATUS_ORDER: Record<string, number> = { PENDING: 1, IN_PROGRESS: 2, REVIEW: 3, COMPLETED: 4, REJECTED: 5 };

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

const AvatarInitials: React.FC<{ name: string; size?: string }> = ({ name, size = 'w-7 h-7' }) => {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const colors = [
    'bg-indigo-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
    'bg-rose-500', 'bg-cyan-500', 'bg-pink-500', 'bg-teal-500',
  ];
  const colorIdx = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
  return (
    <div className={`${size} ${colors[colorIdx]} rounded-full flex items-center justify-center text-white text-[8px] font-extrabold shrink-0 ring-2 ring-white dark:ring-brand-950`}>
      {initials}
    </div>
  );
};

const ToastContainer: React.FC<{ toasts: Toast[]; onDismiss: (id: string) => void }> = ({ toasts, onDismiss }) => (
  <div className="fixed top-6 right-6 z-[100] space-y-3 pointer-events-none">
    {toasts.map((toast) => (
      <div key={toast.id}
        className={`pointer-events-auto animate-toast-slide-in min-w-[300px] rounded-2xl p-4 shadow-2xl border backdrop-blur-xl flex items-start gap-3 ${
          toast.type === 'success'
            ? 'bg-emerald-50/95 dark:bg-emerald-950/95 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
            : toast.type === 'error'
            ? 'bg-rose-50/95 dark:bg-rose-950/95 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
            : 'bg-indigo-50/95 dark:bg-indigo-950/95 border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200'
        }`}>
        <div className={`mt-0.5 rounded-full p-1 ${
          toast.type === 'success' ? 'bg-emerald-500' : toast.type === 'error' ? 'bg-rose-500' : 'bg-indigo-500'
        }`}>
          {toast.type === 'success' ? <Check size={12} className="text-white" /> : toast.type === 'error' ? <X size={12} className="text-white" /> : <AlertCircle size={12} className="text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold">{toast.type === 'success' ? 'Success' : toast.type === 'error' ? 'Error' : 'Info'}</p>
          <p className="text-[11px] mt-0.5 opacity-80 font-medium">{toast.message}</p>
          <div className="mt-2 h-0.5 rounded-full overflow-hidden bg-current/10">
            <div className="h-full bg-current/40 rounded-full" style={{ animation: 'toastProgress 3s linear forwards' }} />
          </div>
        </div>
        <button onClick={() => onDismiss(toast.id)} className="text-current/50 hover:text-current/80 mt-0.5"><X size={14} /></button>
      </div>
    ))}
  </div>
);

// ═══════════════════════════════════════
// Main Component
// ═══════════════════════════════════════
export const Tasks: React.FC = () => {
  const { user } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const { confirm } = useDialog();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('dueDate');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // New Task form
  const [newTask, setNewTask] = useState({
    title: '', description: '', priority: 'MEDIUM' as Task['priority'],
    dueDate: '', employeeId: '', subtasksInput: '',
  });

  // Task Update states
  const [logTimeMinutes, setLogTimeMinutes] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [commentAttachments, setCommentAttachments] = useState<string[]>([]);
  const [updatingTaskState, setUpdatingTaskState] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const showToast = useCallback((type: Toast['type'], message: string) => {
    const id = Math.random().toString(36).substring(2);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }, []);
  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchStats();
    if (user?.role && ['TEAM_LEAD', 'HR', 'SUPER_ADMIN'].includes(user.role)) {
      fetchEmployees();
    }
  }, [user]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedTask(null);
        setShowAddModal(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/employees');
      setEmployees(res.data.data);
    } catch (err) { console.error('Failed to load employee list:', err); }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get('/tasks/stats');
      setStats(res.data.data);
    } catch (err) { console.error('Failed to load task stats:', err); }
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const url = (user?.role === 'HR' || user?.role === 'SUPER_ADMIN') ? '/tasks/all' : '/tasks/my-tasks';
      const res = await api.get(url);
      setTasks(res.data.data);
    } catch (err) { console.error('Failed to load tasks:', err); }
    finally { setLoading(false); }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const subtasks = newTask.subtasksInput.split('\n').filter(t => t.trim() !== '').map(title => ({ title: title.trim(), isCompleted: false }));
      await api.post('/tasks', {
        title: newTask.title, description: newTask.description,
        priority: newTask.priority, dueDate: new Date(newTask.dueDate),
        employeeId: newTask.employeeId, subtasks,
      });
      setShowAddModal(false);
      setNewTask({ title: '', description: '', priority: 'MEDIUM', dueDate: '', employeeId: '', subtasksInput: '' });
      fetchTasks(); fetchStats();
      showToast('success', 'Task assigned successfully!');
    } catch (err: any) { showToast('error', err.response?.data?.message || 'Failed to create task'); }
  };

  const handleTaskStatusTransition = async (taskId: string, newStatus: Task['status']) => {
    try {
      await api.put(`/tasks/${taskId}`, { status: newStatus });
      fetchTasks(); fetchStats();
      if (selectedTask?.id === taskId) setSelectedTask(prev => prev ? { ...prev, status: newStatus } : null);
      showToast('success', `Task moved to "${STATUS_COLUMNS.find(c => c.value === newStatus)?.label}"`);
    } catch (err: any) { showToast('error', err.response?.data?.message || 'Failed to update'); }
  };

  const handleUpdateTaskDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    setUpdatingTaskState(true);
    try {
      const payload: any = { 
        subtasks: selectedTask.subtasks,
        comment: commentText,
        attachments: commentAttachments,
        timeLogMinutes: logTimeMinutes
      };
      const completedSubtasks = selectedTask.subtasks.filter(s => s.isCompleted).length;
      payload.progress = selectedTask.subtasks.length > 0
        ? Math.round((completedSubtasks / selectedTask.subtasks.length) * 100)
        : selectedTask.progress;
      const res = await api.put(`/tasks/${selectedTask.id}`, payload);
      setSelectedTask(res.data.data);
      setCommentText(''); setLogTimeMinutes(0);
      fetchTasks(); fetchStats();
      showToast('success', 'Task updated successfully!');
    } catch (err: any) { showToast('error', err.response?.data?.message || 'Failed to update'); }
    finally { setUpdatingTaskState(false); }
  };

  const handleDeleteTask = async () => {
    if (!selectedTask) return;
    if (!(await confirm({ title: 'Delete Task', message: `Are you sure you want to delete task "${selectedTask.title}"?`, variant: 'danger', confirmText: 'Delete' }))) return;
    try {
      await api.delete(`/tasks/${selectedTask.id}`);
      setSelectedTask(null);
      fetchTasks(); fetchStats();
      showToast('success', 'Task deleted successfully!');
    } catch (err: any) { showToast('error', err.response?.data?.message || 'Failed to delete'); }
  };

  const toggleSubtask = (index: number) => {
    if (!selectedTask) return;
    const subtasks = [...selectedTask.subtasks];
    subtasks[index].isCompleted = !subtasks[index].isCompleted;
    setSelectedTask({ ...selectedTask, subtasks });
  };

  // ─── Helpers ───
  const getPriorityConfig = (p: string) => {
    switch (p) {
      case 'CRITICAL': return { bg: 'bg-gradient-to-r from-rose-500 to-red-600 text-white', text: 'text-rose-600', dot: 'bg-rose-500' };
      case 'HIGH': return { bg: 'bg-gradient-to-r from-orange-500 to-amber-600 text-white', text: 'text-orange-600', dot: 'bg-orange-500' };
      case 'MEDIUM': return { bg: 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white', text: 'text-indigo-600', dot: 'bg-indigo-500' };
      case 'LOW': return { bg: 'bg-gradient-to-r from-brand-400 to-brand-500 text-white', text: 'text-brand-500', dot: 'bg-brand-400' };
      default: return { bg: 'bg-brand-300 text-brand-800', text: 'text-brand-500', dot: 'bg-brand-300' };
    }
  };

  const getStatusConfig = (s: string) => {
    switch (s) {
      case 'COMPLETED': return { bg: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' };
      case 'IN_PROGRESS': return { bg: 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400', dot: 'bg-indigo-500' };
      case 'REVIEW': return { bg: 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' };
      case 'REJECTED': return { bg: 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400', dot: 'bg-rose-500' };
      default: return { bg: 'bg-brand-100 dark:bg-brand-900/50 text-brand-600 dark:text-brand-400', dot: 'bg-brand-400' };
    }
  };

  const getRelativeDueDate = (dueDate: string) => {
    const diffDays = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, isOverdue: true };
    if (diffDays === 0) return { label: 'Due today', isOverdue: false };
    if (diffDays === 1) return { label: 'Tomorrow', isOverdue: false };
    return { label: `${diffDays}d left`, isOverdue: false };
  };

  const getTotalTimeLogged = (timeLogs: Task['timeLogs']) => {
    const totalMin = timeLogs.reduce((sum, l) => sum + l.durationMinutes, 0);
    if (totalMin >= 60) { const h = Math.floor(totalMin / 60); const m = totalMin % 60; return `${h}h${m > 0 ? ` ${m}m` : ''}`; }
    return `${totalMin}m`;
  };

  const getEmployeeName = (task: Task) =>
    task.employee ? `${task.employee.firstName} ${task.employee.lastName}` : task.employeeId;
  const getAssignedByName = (task: Task) =>
    task.assignedBy ? `${task.assignedBy.firstName} ${task.assignedBy.lastName}` : task.assignedById;
  const getStatusLabel = (s: string) => STATUS_COLUMNS.find(c => c.value === s)?.label || s;

  // ─── Filtering & Sorting ───
  const filteredTasks = tasks
    .filter(t => {
      const matchSearch = searchQuery === '' || t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase()) || getEmployeeName(t).toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
      const matchPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;
      return matchSearch && matchStatus && matchPriority;
    })
    .sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'title': cmp = a.title.localeCompare(b.title); break;
        case 'priority': cmp = (PRIORITY_ORDER[a.priority] || 0) - (PRIORITY_ORDER[b.priority] || 0); break;
        case 'status': cmp = (STATUS_ORDER[a.status] || 0) - (STATUS_ORDER[b.status] || 0); break;
        case 'dueDate': cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(); break;
        case 'progress': cmp = a.progress - b.progress; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown size={10} className="opacity-30" />;
    return sortDir === 'asc' ? <ArrowUp size={10} className="text-indigo-600" /> : <ArrowDown size={10} className="text-indigo-600" />;
  };

  const isAdmin = user?.role === 'HR' || user?.role === 'SUPER_ADMIN';
  const isPrivileged = !!user?.role && ['TEAM_LEAD', 'HR', 'SUPER_ADMIN'].includes(user.role);

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════
  return (
    <div className="space-y-5">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-brand-900 to-indigo-950 p-6 rounded-3xl border border-brand-800 shadow-xl">
        <div>
          <h1 className="font-extrabold text-2xl tracking-tight text-white flex items-center gap-2">
            <Target className="text-indigo-400" size={24} />
            Task Management
          </h1>
          <p className="text-xs text-brand-300 mt-1 font-medium">Track deliverables, manage workflow progress, and audit time logs</p>
        </div>
        {user?.role && (
          <button
            onClick={() => {
              setNewTask(prev => ({
                ...prev,
                employeeId: isPrivileged ? '' : (user.employeeId || '')
              }));
              setShowAddModal(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 py-2.5 text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20 shrink-0"
          >
            <Plus size={16} />
            <span>Create Task</span>
          </button>
        )}
      </div>

      {/* ─── Compact Stats Row ─── */}
      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
          {[
            { label: 'Total', value: stats.total, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900/40', icon: <LayoutList size={13} /> },
            { label: 'Pending', value: stats.pending, color: 'text-brand-600 dark:text-brand-400', bg: 'bg-brand-50 dark:bg-brand-900/40 border-brand-200 dark:border-brand-800/40', icon: <Clock size={13} /> },
            { label: 'In Progress', value: stats.inProgress, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/40', icon: <Zap size={13} /> },
            { label: 'Review', value: stats.review, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/40 border-violet-100 dark:border-violet-900/40', icon: <Eye size={13} /> },
            { label: 'Overdue', value: stats.overdue, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-100 dark:border-rose-900/40', icon: <AlertTriangle size={13} /> },
            { label: 'Completed', value: stats.completed, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/40', icon: <TrendingUp size={13} /> },
          ].map((s, i) => (
            <div key={s.label} className={`${s.bg} border rounded-xl px-3 py-2.5 animate-fade-in-up flex items-center gap-2.5`} style={{ animationDelay: `${i * 0.05}s` }}>
              <span className={`${s.color} opacity-50`}>{s.icon}</span>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-brand-400 uppercase tracking-wider truncate">{s.label}</p>
                <p className={`text-lg font-extrabold leading-tight ${s.color}`}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Search & Filters ─── */}
      <div className="glass rounded-2xl border border-brand-200 dark:border-brand-800 p-3 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
          <input type="text" placeholder="Search tasks, employees..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl text-xs font-semibold text-brand-950 dark:text-white placeholder:text-brand-400 outline-none focus:border-indigo-500 transition-all" />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[9px] font-bold text-brand-400 uppercase">Status:</span>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-brand-800 dark:text-brand-200 outline-none focus:border-indigo-500">
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s === 'ALL' ? 'All Status' : getStatusLabel(s)}</option>)}
          </select>
          <span className="text-[9px] font-bold text-brand-400 uppercase ml-1">Priority:</span>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
            className="bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-brand-800 dark:text-brand-200 outline-none focus:border-indigo-500">
            {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p === 'ALL' ? 'All Priority' : p}</option>)}
          </select>
          <span className="text-[10px] font-bold text-brand-400 ml-auto sm:ml-2">
            Showing <span className="text-indigo-600 font-extrabold">{filteredTasks.length}</span> of <span className="font-extrabold text-brand-700 dark:text-brand-300">{tasks.length}</span>
          </span>
        </div>
      </div>

      {/* ─── Records Table ─── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <span className="w-8 h-8 rounded-full border-2 border-indigo-600/30 border-t-indigo-600 animate-spin" />
        </div>
      ) : (
        <div className="glass rounded-2xl border border-brand-200 dark:border-brand-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-brand-200 dark:border-brand-800 bg-brand-50/60 dark:bg-brand-900/40">
                  {[
                    { label: 'Task', field: 'title' as SortField, width: 'min-w-[260px]' },
                    { label: 'Assignee', field: null, width: 'min-w-[140px]' },
                    { label: 'Priority', field: 'priority' as SortField, width: 'min-w-[90px]' },
                    { label: 'Status', field: 'status' as SortField, width: 'min-w-[110px]' },
                    { label: 'Progress', field: 'progress' as SortField, width: 'min-w-[120px]' },
                    { label: 'Due Date', field: 'dueDate' as SortField, width: 'min-w-[110px]' },
                    { label: 'Time', field: null, width: 'min-w-[60px]' },
                    ...(isAdmin ? [{ label: 'Actions', field: null, width: 'w-20 text-right' }] : []),
                  ].map(col => (
                    <th key={col.label}
                      className={`px-4 py-3 text-[9px] font-extrabold text-brand-500 uppercase tracking-wider ${col.width} ${col.field ? 'cursor-pointer hover:text-indigo-600 select-none' : ''}`}
                      onClick={() => col.field && handleSort(col.field)}>
                      <span className="flex items-center gap-1">
                        {col.label}
                        {col.field && <SortIcon field={col.field} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 7} className="text-center py-16">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center">
                          <CheckSquare size={18} className="text-brand-400" />
                        </div>
                        <p className="text-xs font-bold text-brand-400">No tasks match your filters</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task, idx) => {
                    const dueInfo = getRelativeDueDate(task.dueDate);
                    const isOverdue = dueInfo.isOverdue && !['COMPLETED', 'REJECTED'].includes(task.status);
                    const priorityConfig = getPriorityConfig(task.priority);
                    const statusConfig = getStatusConfig(task.status);

                    return (
                      <tr key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className={`animate-fade-in-up border-b border-brand-100 dark:border-brand-800/40 cursor-pointer transition-all hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 group ${
                          isOverdue ? 'bg-rose-50/30 dark:bg-rose-950/10' : ''
                        }`}
                        style={{ animationDelay: `${idx * 0.03}s` }}>

                        {/* Task Title + Description */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-start gap-2">
                            {isOverdue && <span className="mt-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />}
                            <div className="min-w-0">
                              <p className="text-xs font-extrabold text-brand-950 dark:text-white truncate max-w-[240px] group-hover:text-indigo-600 transition-colors">{task.title}</p>
                              <p className="text-[10px] text-brand-400 font-medium truncate max-w-[240px] mt-0.5">{task.description}</p>
                            </div>
                          </div>
                        </td>

                        {/* Assignee */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <AvatarInitials name={getEmployeeName(task)} size="w-6 h-6" />
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-brand-800 dark:text-brand-200 truncate">{getEmployeeName(task)}</p>
                              {task.employee?.department && (
                                <p className="text-[9px] text-brand-400 font-medium truncate">{task.employee.department}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Priority */}
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-extrabold uppercase tracking-wider ${priorityConfig.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${task.priority === 'CRITICAL' ? 'bg-white/60 animate-pulse' : 'bg-white/40'}`} />
                            {task.priority}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wider ${statusConfig.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                            {getStatusLabel(task.status)}
                          </span>
                        </td>

                        {/* Progress Bar */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-brand-100 dark:bg-brand-800 rounded-full overflow-hidden max-w-[70px]">
                              <div className={`h-full rounded-full transition-all duration-500 ${
                                task.progress >= 100 ? 'bg-emerald-500' : task.progress >= 60 ? 'bg-indigo-500' : 'bg-brand-400'
                              }`} style={{ width: `${task.progress}%` }} />
                            </div>
                            <span className="text-[10px] font-extrabold text-brand-600 dark:text-brand-400 w-8">{task.progress}%</span>
                          </div>
                          {task.subtasks.length > 0 && (
                            <p className="text-[8px] text-brand-400 font-bold mt-0.5">
                              {task.subtasks.filter(s => s.isCompleted).length}/{task.subtasks.length} subtasks
                            </p>
                          )}
                        </td>

                        {/* Due Date */}
                        <td className="px-4 py-3.5">
                          <div>
                            <p className="text-[10px] font-bold text-brand-700 dark:text-brand-300">
                              {new Date(task.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </p>
                            <p className={`text-[9px] font-bold mt-0.5 ${isOverdue ? 'text-rose-500' : 'text-brand-400'}`}>
                              {dueInfo.label}
                            </p>
                          </div>
                        </td>

                        {/* Time + Comments */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2 text-brand-400">
                            {task.timeLogs.length > 0 && (
                              <span className="flex items-center gap-0.5 text-[9px] font-bold"><Timer size={9} />{getTotalTimeLogged(task.timeLogs)}</span>
                            )}
                            {task.comments.length > 0 && (
                              <span className="flex items-center gap-0.5 text-[9px] font-bold"><MessageSquare size={9} />{task.comments.length}</span>
                            )}
                          </div>
                        </td>

                        {/* Direct Delete for Admin/HR */}
                        {isAdmin && (
                          <td className="px-4 py-3.5 text-right">
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (await confirm({ title: 'Delete Task', message: `Are you sure you want to delete task "${task.title}"?`, variant: 'danger', confirmText: 'Delete' })) {
                                  try {
                                    await api.delete(`/tasks/${task.id}`);
                                    fetchTasks(); fetchStats();
                                    showToast('success', 'Task deleted successfully!');
                                  } catch (err: any) {
                                    showToast('error', err.response?.data?.message || 'Failed to delete task');
                                  }
                                }
                              }}
                              title="Delete Task"
                              className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500 hover:text-rose-600 transition-colors inline-flex items-center justify-center"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* ─── TASK DETAIL MODAL ─── */}
      {/* ═══════════════════════════════════════ */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-brand-950/50 backdrop-blur-sm flex items-center justify-center p-4 md:p-6"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedTask(null); }}>
          <div className="w-full max-w-3xl animate-slide-in-scale glass rounded-3xl border border-brand-200 dark:border-brand-800 shadow-2xl max-h-[88vh] overflow-hidden flex flex-col">

            {/* Modal Header */}
            <div className="p-5 md:p-6 border-b border-brand-200 dark:border-brand-800 shrink-0">
              <div className="flex justify-between items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className={`px-2.5 py-0.5 rounded-lg text-[8px] font-extrabold tracking-widest uppercase ${getPriorityConfig(selectedTask.priority).bg}`}>
                      {selectedTask.priority}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[8px] font-extrabold tracking-wider uppercase ${getStatusConfig(selectedTask.status).bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${getStatusConfig(selectedTask.status).dot}`} />
                      {getStatusLabel(selectedTask.status)}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-base md:text-lg text-brand-950 dark:text-white leading-snug">{selectedTask.title}</h3>
                </div>
                <button onClick={() => setSelectedTask(null)} className="p-2 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-900 transition-colors shrink-0">
                  <X size={18} className="text-brand-500" />
                </button>
              </div>

              {/* People info */}
              <div className="mt-4 flex flex-wrap gap-3">
                <div className="flex items-center gap-2.5 bg-brand-50 dark:bg-brand-900/50 rounded-xl px-3 py-2 border border-brand-100 dark:border-brand-800/50">
                  <AvatarInitials name={getEmployeeName(selectedTask)} />
                  <div>
                    <p className="text-[9px] font-bold text-brand-400 uppercase tracking-wider">Assignee</p>
                    <p className="text-[11px] font-extrabold text-brand-950 dark:text-white">{getEmployeeName(selectedTask)}</p>
                    {selectedTask.employee?.designation && <p className="text-[9px] text-brand-500 font-medium">{selectedTask.employee.designation} • {selectedTask.employee.department}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2.5 bg-brand-50 dark:bg-brand-900/50 rounded-xl px-3 py-2 border border-brand-100 dark:border-brand-800/50">
                  <AvatarInitials name={getAssignedByName(selectedTask)} />
                  <div>
                    <p className="text-[9px] font-bold text-brand-400 uppercase tracking-wider">Assigned By</p>
                    <p className="text-[11px] font-extrabold text-brand-950 dark:text-white">{getAssignedByName(selectedTask)}</p>
                    {selectedTask.assignedBy?.designation && <p className="text-[9px] text-brand-500 font-medium">{selectedTask.assignedBy.designation}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 md:p-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">

                {/* Left (3/5) */}
                <div className="md:col-span-3 space-y-5 text-left text-xs font-semibold">
                  <div>
                    <h5 className="text-[10px] font-bold text-brand-400 uppercase tracking-wider mb-2">Description</h5>
                    <p className="text-brand-600 dark:text-brand-400 leading-relaxed font-medium text-[11px]">{selectedTask.description}</p>
                  </div>

                  {/* Quick Stats Row */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-brand-50 dark:bg-brand-900/40 rounded-xl p-2.5 text-center border border-brand-100 dark:border-brand-800/40">
                      <p className="text-[8px] font-bold text-brand-400 uppercase">Due Date</p>
                      <p className={`text-[11px] font-extrabold mt-0.5 ${
                        getRelativeDueDate(selectedTask.dueDate).isOverdue && !['COMPLETED','REJECTED'].includes(selectedTask.status) ? 'text-rose-600' : 'text-brand-950 dark:text-white'
                      }`}>{new Date(selectedTask.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <div className="bg-brand-50 dark:bg-brand-900/40 rounded-xl p-2.5 text-center border border-brand-100 dark:border-brand-800/40">
                      <p className="text-[8px] font-bold text-brand-400 uppercase">Time Logged</p>
                      <p className="text-[11px] font-extrabold mt-0.5 text-brand-950 dark:text-white">{selectedTask.timeLogs.length > 0 ? getTotalTimeLogged(selectedTask.timeLogs) : '—'}</p>
                    </div>
                    <div className="bg-brand-50 dark:bg-brand-900/40 rounded-xl p-2.5 text-center border border-brand-100 dark:border-brand-800/40">
                      <p className="text-[8px] font-bold text-brand-400 uppercase">Progress</p>
                      <p className="text-[11px] font-extrabold mt-0.5 text-indigo-600">{selectedTask.progress}%</p>
                    </div>
                  </div>

                  {/* Subtask checklist */}
                  {selectedTask.subtasks.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-[10px] font-bold text-brand-400 uppercase tracking-wider flex items-center gap-1.5">
                        <ListChecks size={12} /> Subtasks
                        <span className="ml-auto text-indigo-600">{selectedTask.subtasks.filter(s => s.isCompleted).length}/{selectedTask.subtasks.length}</span>
                      </h5>
                      <div className="space-y-1.5">
                        {selectedTask.subtasks.map((sub, idx) => (
                          <label key={idx} className="flex items-center gap-2.5 p-2.5 bg-brand-50 dark:bg-brand-900/40 rounded-xl cursor-pointer border border-transparent hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all">
                            <input type="checkbox" checked={sub.isCompleted} onChange={() => toggleSubtask(idx)}
                              className="rounded border-brand-300 dark:border-brand-700 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5" />
                            <span className={`text-[11px] transition-all ${sub.isCompleted ? 'line-through text-brand-400 opacity-60' : 'text-brand-800 dark:text-white'}`}>{sub.title}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Comments */}
                  <div className="space-y-2">
                    <h5 className="text-[10px] font-bold text-brand-400 uppercase tracking-wider flex items-center gap-1.5"><MessageSquare size={12} /> Comments</h5>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {selectedTask.comments.length === 0 ? (
                        <p className="text-[10px] text-brand-400 italic text-center py-3 border border-dashed border-brand-200 dark:border-brand-800 rounded-xl">No comments yet</p>
                      ) : (
                        selectedTask.comments.map((c, i) => (
                          <div key={i} className="flex items-start gap-2.5 p-3 bg-brand-50 dark:bg-brand-900/40 border border-brand-100/50 dark:border-brand-800/30 rounded-xl">
                            <AvatarInitials name={c.authorName} size="w-6 h-6" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline justify-between gap-2">
                                <p className="font-extrabold text-[10px] text-indigo-600">{c.authorName}</p>
                                <p className="text-[8px] text-brand-400 shrink-0">{new Date(c.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                              </div>
                              <p className="text-[11px] text-brand-700 dark:text-brand-300 mt-0.5 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                              {c.attachments && c.attachments.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {c.attachments.map((att: string, idx: number) => (
                                    <a key={idx} href={att} target="_blank" rel="noopener noreferrer"
                                       className="inline-flex items-center gap-1 bg-white dark:bg-brand-950 border border-brand-200 dark:border-brand-800 rounded px-2 py-1 text-[9px] font-bold text-indigo-600 hover:underline">
                                      <Paperclip size={10} /> Attachment {idx + 1}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Right (2/5) */}
                <div className="md:col-span-2 space-y-5 text-left md:border-l md:border-brand-100 md:dark:border-brand-800/40 md:pl-6">
                  {/* Status Transitions */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-brand-400 uppercase tracking-wider">Move to</label>
                    <div className="flex flex-wrap gap-1.5">
                      {STATUS_COLUMNS.map(col => (
                        <button key={col.value} onClick={() => handleTaskStatusTransition(selectedTask.id, col.value)}
                          className={`px-3 py-1.5 rounded-xl font-bold text-[9px] uppercase tracking-wide transition-all border ${
                            selectedTask.status === col.value
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-105'
                              : 'bg-brand-50 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800 hover:border-indigo-300 hover:text-indigo-600'
                          }`}>{col.label}</button>
                      ))}
                    </div>
                  </div>

                  {/* Update Form */}
                  <form onSubmit={handleUpdateTaskDetails} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-brand-400 uppercase flex items-center gap-1"><Timer size={10} /> Log time (min)</label>
                      <input type="number" min={0} value={logTimeMinutes} onChange={e => setLogTimeMinutes(parseInt(e.target.value) || 0)}
                        className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs font-semibold outline-none focus:border-indigo-500 text-brand-950 dark:text-white transition-all" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-brand-400 uppercase flex items-center gap-1"><MessageSquare size={10} /> Add comment</label>
                      <textarea rows={2} placeholder="Write a comment..." value={commentText} onChange={e => setCommentText(e.target.value)}
                        className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs font-semibold outline-none focus:border-indigo-500 text-brand-950 dark:text-white resize-none transition-all" />
                      
                      <label className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 rounded-lg cursor-pointer text-[9px] font-bold uppercase hover:bg-brand-200 dark:hover:bg-brand-800 transition-colors w-fit">
                        <Paperclip size={10} /> Attach File
                        <input type="file" multiple className="hidden" onChange={(e) => {
                          if (e.target.files) {
                            const files = Array.from(e.target.files);
                            const promises = files.map(file => {
                              return new Promise<string>((resolve) => {
                                const reader = new FileReader();
                                reader.onload = () => resolve(reader.result as string);
                                reader.readAsDataURL(file);
                              });
                            });
                            Promise.all(promises).then(urls => setCommentAttachments(prev => [...prev, ...urls]));
                          }
                        }} />
                      </label>
                      {commentAttachments.length > 0 && (
                        <p className="text-[9px] text-indigo-600 font-bold">{commentAttachments.length} file(s) attached</p>
                      )}
                    </div>
                    <button type="submit" disabled={updatingTaskState}
                      className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl py-2.5 font-bold text-[10px] uppercase tracking-wider shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50">
                      <Check size={13} />{updatingTaskState ? 'Saving...' : 'Save Progress'}
                    </button>
                  </form>

                  {/* Delete (Admin) */}
                  {isAdmin && (
                    <div className="pt-3 border-t border-brand-100 dark:border-brand-800/40">
                      <button onClick={handleDeleteTask}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-bold uppercase text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 transition-all">
                        <Trash2 size={12} /> Delete Task
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* ─── CREATE TASK MODAL ─── */}
      {/* ═══════════════════════════════════════ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-brand-950/50 backdrop-blur-sm flex items-center justify-center p-4 md:p-6"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
          <div className="w-full max-w-md animate-slide-in-scale glass rounded-3xl border border-brand-200 dark:border-brand-800 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-brand-200 dark:border-brand-800 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-sm text-brand-950 dark:text-white flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center"><Plus size={12} className="text-white" /></div>
                  Create New Task
                </h3>
                <p className="text-[10px] text-brand-500 font-medium mt-1">Assign a deliverable to a team member</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-900 transition-colors"><X size={18} className="text-brand-500" /></button>
            </div>
            <form onSubmit={handleCreateTask} className="p-5 space-y-4 text-left text-xs font-semibold max-h-[65vh] overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Task Title *</label>
                <input type="text" required placeholder="e.g. Build user authentication module"
                  value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500 text-brand-950 dark:text-white transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Description *</label>
                <textarea required rows={3} placeholder="Describe scope and requirements..."
                  value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                  className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500 text-brand-950 dark:text-white resize-none transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Priority</label>
                  <select value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value as Task['priority'] })}
                    className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500 text-brand-950 dark:text-white transition-all">
                    <option value="LOW">🟢 Low</option><option value="MEDIUM">🟡 Medium</option><option value="HIGH">🟠 High</option><option value="CRITICAL">🔴 Critical</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Due Date *</label>
                  <input type="date" required value={newTask.dueDate} onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })}
                    className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500 text-brand-950 dark:text-white transition-all" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1 flex items-center gap-1"><User size={10} /> Assign To *</label>
                <select required value={newTask.employeeId} disabled={!isPrivileged} onChange={e => setNewTask({ ...newTask, employeeId: e.target.value })}
                  className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500 text-brand-950 dark:text-white transition-all disabled:opacity-75">
                  {isPrivileged ? (
                    <>
                      <option value="">— Select Employee —</option>
                      {employees.map(emp => (
                        <option key={emp.employeeId} value={emp.employeeId}>{emp.firstName} {emp.lastName} ({emp.employeeId}) — {emp.designation}</option>
                      ))}
                    </>
                  ) : (
                    <option value={user?.employeeId || ''}>
                      {user?.firstName} {user?.lastName} ({user?.employeeId})
                    </option>
                  )}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1 flex items-center gap-1"><ListChecks size={10} /> Subtasks (one per line)</label>
                <textarea rows={3} placeholder={"Research requirements\nDesign wireframes\nImplement core logic"}
                  value={newTask.subtasksInput} onChange={e => setNewTask({ ...newTask, subtasksInput: e.target.value })}
                  className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500 text-brand-950 dark:text-white resize-none transition-all font-mono text-[10px]" />
              </div>
              <div className="pt-3 border-t border-brand-200 dark:border-brand-800 flex justify-end gap-2.5">
                <button type="button" onClick={() => setShowAddModal(false)}
                  className="bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 rounded-xl px-5 py-2.5 font-bold text-[10px] uppercase hover:bg-brand-200 transition-all">Cancel</button>
                <button type="submit"
                  className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl px-6 py-2.5 font-bold text-[10px] uppercase shadow-md transition-all flex items-center gap-1.5">
                  <Send size={12} /> Assign Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
