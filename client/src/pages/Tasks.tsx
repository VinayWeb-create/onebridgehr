import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import {
  Plus, CheckSquare, Clock, MessageSquare, AlertCircle, Calendar, Send,
  X, Check, Eye, Trash2, Search, Filter, ListChecks, Timer,
  Zap, Target, TrendingUp, AlertTriangle, User, ChevronDown, ArrowUpDown,
  ArrowUp, ArrowDown, LayoutList, Paperclip, RotateCcw, Sparkles, Building2, Flame,
  Edit2, Sliders, CheckCircle2
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

  // Tabs for Super Admin
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [taskViewTab, setTaskViewTab] = useState<'TEAM_PROGRESS' | 'ADMIN_TASKS'>('TEAM_PROGRESS');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [deadlineFilter, setDeadlineFilter] = useState<string>('ALL');
  const [quickPreset, setQuickPreset] = useState<string>('ALL');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('dueDate');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // New Task form
  const [newTask, setNewTask] = useState({
    title: '', description: '', priority: 'MEDIUM' as Task['priority'],
    dueDate: '', dueHour: '06', dueMinute: '00', duePeriod: 'PM' as 'AM' | 'PM',
    employeeId: '', subtasks: [''] as string[],
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

  // Edit Task State
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingEditTask, setSavingEditTask] = useState(false);
  const [editTask, setEditTask] = useState<{
    id: string;
    title: string;
    description: string;
    priority: Task['priority'];
    status: Task['status'];
    progress: number;
    employeeId: string;
    dueDate: string;
    dueHour: string;
    dueMinute: string;
    duePeriod: 'AM' | 'PM';
    expectedHours: number;
    subtasks: { title: string; isCompleted: boolean }[];
  } | null>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedTask(null);
        setShowAddModal(false);
        setShowEditModal(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const openEditModal = (task: Task) => {
    const d = new Date(task.dueDate);
    const dateStr = isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
    let hours = isNaN(d.getTime()) ? 18 : d.getHours();
    const period: 'AM' | 'PM' = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const hourStr = String(hours).padStart(2, '0');
    const minStr = isNaN(d.getTime()) ? '00' : String(d.getMinutes()).padStart(2, '0');

    const formattedSubtasks = (task.subtasks || []).map((s: any) =>
      typeof s === 'string' ? { title: s, isCompleted: false } : { title: s.title || '', isCompleted: !!s.isCompleted }
    );

    setEditTask({
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      progress: task.progress || 0,
      employeeId: task.employeeId,
      dueDate: dateStr,
      dueHour: hourStr,
      dueMinute: minStr,
      duePeriod: period,
      expectedHours: (task as any).expectedHours || 0,
      subtasks: formattedSubtasks.length > 0 ? formattedSubtasks : [{ title: '', isCompleted: false }],
    });
    setShowEditModal(true);
  };

  const handleEditSubtaskChange = (index: number, value: string) => {
    if (!editTask) return;
    const updated = [...editTask.subtasks];
    updated[index] = { ...updated[index], title: value };
    setEditTask({ ...editTask, subtasks: updated });
  };

  const handleEditSubtaskToggle = (index: number) => {
    if (!editTask) return;
    const updated = [...editTask.subtasks];
    updated[index] = { ...updated[index], isCompleted: !updated[index].isCompleted };
    const completedCount = updated.filter(s => s.isCompleted).length;
    const autoProgress = updated.length > 0 ? Math.round((completedCount / updated.length) * 100) : editTask.progress;
    setEditTask({ ...editTask, subtasks: updated, progress: autoProgress });
  };

  const handleEditSubtaskRemove = (index: number) => {
    if (!editTask) return;
    const updated = editTask.subtasks.filter((_, i) => i !== index);
    setEditTask({ ...editTask, subtasks: updated.length > 0 ? updated : [{ title: '', isCompleted: false }] });
  };

  const handleEditSubtaskAdd = () => {
    if (!editTask) return;
    const nextIdx = editTask.subtasks.length;
    setEditTask({ ...editTask, subtasks: [...editTask.subtasks, { title: '', isCompleted: false }] });
    setTimeout(() => {
      document.getElementById(`edit-subtask-input-${nextIdx}`)?.focus();
    }, 50);
  };

  const handleEditSubtaskKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!editTask) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEditSubtaskAdd();
    } else if (e.key === 'Backspace' && editTask.subtasks[index].title === '' && editTask.subtasks.length > 1) {
      e.preventDefault();
      handleEditSubtaskRemove(index);
      setTimeout(() => {
        document.getElementById(`edit-subtask-input-${Math.max(0, index - 1)}`)?.focus();
      }, 50);
    }
  };

  const handleSaveEditTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTask) return;
    setSavingEditTask(true);
    try {
      let hour24 = parseInt(editTask.dueHour, 10);
      if (editTask.duePeriod === 'PM' && hour24 < 12) hour24 += 12;
      if (editTask.duePeriod === 'AM' && hour24 === 12) hour24 = 0;
      const hourStr = hour24.toString().padStart(2, '0');
      const minuteStr = editTask.dueMinute.padStart(2, '0');
      const dueDateTimeStr = editTask.dueDate ? `${editTask.dueDate}T${hourStr}:${minuteStr}:00` : '';
      const dueDateObj = new Date(dueDateTimeStr);

      const validSubtasks = editTask.subtasks.filter(s => s.title && s.title.trim() !== '');

      const payload = {
        title: editTask.title,
        description: editTask.description,
        priority: editTask.priority,
        status: editTask.status,
        progress: Number(editTask.progress),
        employeeId: editTask.employeeId,
        dueDate: isNaN(dueDateObj.getTime()) ? new Date(editTask.dueDate) : dueDateObj,
        expectedHours: Number(editTask.expectedHours) || undefined,
        subtasks: validSubtasks,
      };

      const res = await api.put(`/tasks/${editTask.id}`, payload);
      setShowEditModal(false);
      setEditTask(null);
      if (selectedTask?.id === editTask.id) {
        setSelectedTask(res.data.data);
      }
      fetchTasks();
      fetchStats();
      showToast('success', 'Task updated successfully!');
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to update task');
    } finally {
      setSavingEditTask(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/employees');
      const filtered = (res.data.data || []).filter((e: any) => !['OBI0001', 'OBI1117'].includes(e.employeeId));
      setEmployees(filtered);
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
      const url = (user?.role === 'HR' || user?.role === 'SUPER_ADMIN' || user?.role === 'TEAM_LEAD') ? '/tasks/all' : '/tasks/my-tasks';
      const res = await api.get(url);
      setTasks(res.data.data);
    } catch (err) { console.error('Failed to load tasks:', err); }
    finally { setLoading(false); }
  };

  const handleSubtaskChange = (index: number, value: string) => {
    setNewTask(prev => {
      const updated = [...prev.subtasks];
      updated[index] = value;
      return { ...prev, subtasks: updated };
    });
  };

  const handleSubtaskKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setNewTask(prev => ({
        ...prev,
        subtasks: [...prev.subtasks, ''],
      }));
      setTimeout(() => {
        const nextInput = document.getElementById(`subtask-input-${index + 1}`);
        nextInput?.focus();
      }, 50);
    } else if (e.key === 'Backspace' && newTask.subtasks[index] === '' && newTask.subtasks.length > 1) {
      e.preventDefault();
      setNewTask(prev => ({
        ...prev,
        subtasks: prev.subtasks.filter((_, i) => i !== index),
      }));
      setTimeout(() => {
        const prevInput = document.getElementById(`subtask-input-${Math.max(0, index - 1)}`);
        prevInput?.focus();
      }, 50);
    }
  };

  const addSubtaskField = () => {
    const nextIdx = newTask.subtasks.length;
    setNewTask(prev => ({
      ...prev,
      subtasks: [...prev.subtasks, ''],
    }));
    setTimeout(() => {
      const nextInput = document.getElementById(`subtask-input-${nextIdx}`);
      nextInput?.focus();
    }, 50);
  };

  const removeSubtaskField = (index: number) => {
    setNewTask(prev => ({
      ...prev,
      subtasks: prev.subtasks.length > 1 ? prev.subtasks.filter((_, i) => i !== index) : [''],
    }));
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const subtasks = newTask.subtasks
        .filter(t => t.trim() !== '')
        .map(title => ({ title: title.trim(), isCompleted: false }));

      let hour24 = parseInt(newTask.dueHour, 10);
      if (newTask.duePeriod === 'PM' && hour24 < 12) hour24 += 12;
      if (newTask.duePeriod === 'AM' && hour24 === 12) hour24 = 0;
      const hourStr = hour24.toString().padStart(2, '0');
      const minuteStr = newTask.dueMinute.padStart(2, '0');
      const dueDateTimeStr = newTask.dueDate ? `${newTask.dueDate}T${hourStr}:${minuteStr}:00` : '';
      const dueDateObj = new Date(dueDateTimeStr);

      await api.post('/tasks', {
        title: newTask.title, description: newTask.description,
        priority: newTask.priority, dueDate: isNaN(dueDateObj.getTime()) ? new Date(newTask.dueDate) : dueDateObj,
        employeeId: newTask.employeeId, subtasks,
      });
      setShowAddModal(false);
      setNewTask({
        title: '', description: '', priority: 'MEDIUM',
        dueDate: '', dueHour: '06', dueMinute: '00', duePeriod: 'PM',
        employeeId: '', subtasks: [''],
      });
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
    const dueTime = new Date(dueDate).getTime();
    const diffMs = dueTime - Date.now();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs < 0) {
      const absHours = Math.abs(diffHours);
      if (absHours < 24 && absHours > 0) return { label: `${absHours}h overdue`, isOverdue: true };
      if (absHours === 0) return { label: 'Overdue', isOverdue: true };
      return { label: `${Math.abs(diffDays)}d overdue`, isOverdue: true };
    }

    if (diffHours < 24 && diffHours > 0) {
      return { label: `${diffHours}h left`, isOverdue: false };
    }
    if (diffHours === 0) {
      const diffMin = Math.max(1, Math.round(diffMs / (1000 * 60)));
      return { label: `${diffMin}m left`, isOverdue: false };
    }
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
  const teamEmployeeTasks = tasks.filter(t => !['OBI0001', 'OBI1117'].includes(t.employeeId));
  const superAdminTasks = tasks.filter(t => ['OBI0001', 'OBI1117'].includes(t.employeeId));

  const scopedTasks = isSuperAdmin
    ? (taskViewTab === 'ADMIN_TASKS' ? superAdminTasks : teamEmployeeTasks)
    : tasks;

  const now = new Date();

  // Unique departments for filter
  const departments = Array.from(
    new Set(teamEmployeeTasks.map(t => t.employee?.department).filter(Boolean))
  ) as string[];

  // Team Stats (Exclusively employee tasks, 0 superadmin tasks)
  const teamStats = {
    total: teamEmployeeTasks.length,
    pending: teamEmployeeTasks.filter(t => t.status === 'PENDING').length,
    inProgress: teamEmployeeTasks.filter(t => t.status === 'IN_PROGRESS').length,
    review: teamEmployeeTasks.filter(t => t.status === 'REVIEW').length,
    overdue: teamEmployeeTasks.filter(t => new Date(t.dueDate) < now && !['COMPLETED', 'REJECTED'].includes(t.status)).length,
    completed: teamEmployeeTasks.filter(t => t.status === 'COMPLETED').length,
  };

  // Super Admin Stats (Displayed inside the Super Admin tab view)
  const adminStats = {
    total: superAdminTasks.length,
    pending: superAdminTasks.filter(t => t.status === 'PENDING').length,
    inProgress: superAdminTasks.filter(t => t.status === 'IN_PROGRESS').length,
    review: superAdminTasks.filter(t => t.status === 'REVIEW').length,
    overdue: superAdminTasks.filter(t => new Date(t.dueDate) < now && !['COMPLETED', 'REJECTED'].includes(t.status)).length,
    completed: superAdminTasks.filter(t => t.status === 'COMPLETED').length,
  };

  const activeStats = taskViewTab === 'ADMIN_TASKS' ? adminStats : teamStats;

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const yesterdayEnd = todayStart - 1;
  const last7DaysStart = todayStart - 7 * 24 * 60 * 60 * 1000;
  const last30DaysStart = todayStart - 30 * 24 * 60 * 60 * 1000;

  const isTaskMatchingDate = (t: Task, filterKey: string) => {
    if (filterKey === 'ALL') return true;
    const dueMs = t.dueDate ? new Date(t.dueDate).getTime() : 0;
    const createdMs = t.createdAt ? new Date(t.createdAt).getTime() : dueMs;

    if (filterKey === 'TODAY') {
      return (dueMs >= todayStart && dueMs <= todayEnd) || (createdMs >= todayStart && createdMs <= todayEnd);
    }
    if (filterKey === 'YESTERDAY') {
      return (dueMs >= yesterdayStart && dueMs <= yesterdayEnd) || (createdMs >= yesterdayStart && createdMs <= yesterdayEnd);
    }
    if (filterKey === 'LAST_7_DAYS') {
      return (dueMs >= last7DaysStart && dueMs <= todayEnd) || (createdMs >= last7DaysStart && createdMs <= todayEnd);
    }
    if (filterKey === 'LAST_30_DAYS') {
      return (dueMs >= last30DaysStart && dueMs <= todayEnd) || (createdMs >= last30DaysStart && createdMs <= todayEnd);
    }
    if (filterKey === 'OVERDUE') {
      return dueMs < todayStart && !['COMPLETED', 'REJECTED'].includes(t.status);
    }
    if (filterKey === 'TOMORROW') {
      const tomStart = todayStart + 24 * 60 * 60 * 1000;
      const tomEnd = tomStart + 24 * 60 * 60 * 1000 - 1;
      return dueMs >= tomStart && dueMs <= tomEnd;
    }
    if (filterKey === 'THIS_WEEK') {
      const weekEnd = todayStart + 7 * 24 * 60 * 60 * 1000;
      return dueMs >= todayStart && dueMs <= weekEnd;
    }
    return true;
  };

  const presetCounts = {
    all: scopedTasks.length,
    today: scopedTasks.filter(t => isTaskMatchingDate(t, 'TODAY')).length,
    yesterday: scopedTasks.filter(t => isTaskMatchingDate(t, 'YESTERDAY')).length,
    last7Days: scopedTasks.filter(t => isTaskMatchingDate(t, 'LAST_7_DAYS')).length,
    last30Days: scopedTasks.filter(t => isTaskMatchingDate(t, 'LAST_30_DAYS')).length,
    overdue: scopedTasks.filter(t => new Date(t.dueDate) < now && !['COMPLETED', 'REJECTED'].includes(t.status)).length,
    inProgress: scopedTasks.filter(t => t.status === 'IN_PROGRESS').length,
    pending: scopedTasks.filter(t => t.status === 'PENDING').length,
    review: scopedTasks.filter(t => t.status === 'REVIEW').length,
    completed: scopedTasks.filter(t => t.status === 'COMPLETED').length,
    critical: scopedTasks.filter(t => t.priority === 'CRITICAL' && !['COMPLETED', 'REJECTED'].includes(t.status)).length,
  };

  const resetAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
    setDepartmentFilter('ALL');
    setDeadlineFilter('ALL');
    setQuickPreset('ALL');
  };

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'ALL' || priorityFilter !== 'ALL' || departmentFilter !== 'ALL' || deadlineFilter !== 'ALL' || quickPreset !== 'ALL';

  const filteredTasks = scopedTasks
    .filter(t => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = q === '' ||
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        getEmployeeName(t).toLowerCase().includes(q) ||
        (t.employee?.department && t.employee.department.toLowerCase().includes(q)) ||
        (t.employeeId && t.employeeId.toLowerCase().includes(q));

      const isOverdue = new Date(t.dueDate) < now && !['COMPLETED', 'REJECTED'].includes(t.status);

      // Quick preset filter
      let matchPreset = true;
      if (['TODAY', 'YESTERDAY', 'LAST_7_DAYS', 'LAST_30_DAYS'].includes(quickPreset)) {
        matchPreset = isTaskMatchingDate(t, quickPreset);
      } else if (quickPreset === 'OVERDUE') matchPreset = isOverdue;
      else if (quickPreset === 'CRITICAL') matchPreset = t.priority === 'CRITICAL';
      else if (quickPreset !== 'ALL') matchPreset = t.status === quickPreset;

      // Status dropdown filter
      const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;

      // Priority dropdown filter
      const matchPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;

      // Department filter
      const matchDept = departmentFilter === 'ALL' || (t.employee?.department === departmentFilter);

      // Date / Deadline filter
      const matchDeadline = isTaskMatchingDate(t, deadlineFilter);

      return matchSearch && matchPreset && matchStatus && matchPriority && matchDept && matchDeadline;
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
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={11} className="text-brand-300 dark:text-brand-700" />;
    return sortDir === 'asc'
      ? <ArrowUp size={11} className="text-indigo-600 dark:text-indigo-400 font-bold" />
      : <ArrowDown size={11} className="text-indigo-600 dark:text-indigo-400 font-bold" />;
  };

  const isAdmin = user?.role === 'HR' || user?.role === 'SUPER_ADMIN';
  const isPrivileged = !!user?.role && ['TEAM_LEAD', 'HR', 'SUPER_ADMIN'].includes(user.role);

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════
  return (
    <div className="space-y-5 animate-fade-in pb-16">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-brand-900 to-indigo-950 p-6 rounded-3xl border border-brand-800 shadow-xl">
        <div>
          <h1 className="font-extrabold text-2xl tracking-tight text-white flex items-center gap-2">
            <Target className="text-indigo-400" size={24} />
            {isSuperAdmin && taskViewTab === 'ADMIN_TASKS' ? 'Super Admin Tasks' : 'Team Tasks Progress'}
          </h1>
          <p className="text-xs text-brand-300 mt-1 font-medium">
            {isSuperAdmin && taskViewTab === 'ADMIN_TASKS'
              ? 'Personal administrative tasks & reminders (Separate from employee metrics & progress tracking)'
              : 'Track employee deliverables, manage workflow progress, and audit time logs'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {isSuperAdmin && (
            <div className="flex bg-brand-800/80 p-1 rounded-xl border border-brand-700">
              <button
                onClick={() => setTaskViewTab('TEAM_PROGRESS')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  taskViewTab === 'TEAM_PROGRESS'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-brand-300 hover:text-white'
                }`}
              >
                Team Progress ({teamEmployeeTasks.length})
              </button>
              <button
                onClick={() => setTaskViewTab('ADMIN_TASKS')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  taskViewTab === 'ADMIN_TASKS'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-brand-300 hover:text-white'
                }`}
              >
                Super Admin Tasks ({superAdminTasks.length})
              </button>
            </div>
          )}
          {user?.role && (
            <button
              onClick={() => {
                setNewTask(prev => ({
                  ...prev,
                  employeeId: isSuperAdmin && taskViewTab === 'ADMIN_TASKS' ? (user.employeeId || '') : (isPrivileged ? '' : (user.employeeId || ''))
                }));
                setShowAddModal(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 py-2.5 text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20 shrink-0"
            >
              <Plus size={16} />
              <span>{isSuperAdmin && taskViewTab === 'ADMIN_TASKS' ? 'New Admin Task' : 'Create Task'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Compact Stats Row (Interactive Click to Filter) ─── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
        {[
          { key: 'ALL', label: 'Total', value: activeStats.total, color: taskViewTab === 'ADMIN_TASKS' ? 'text-purple-600 dark:text-purple-400' : 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900/40', icon: <LayoutList size={13} /> },
          { key: 'PENDING', label: 'Pending', value: activeStats.pending, color: 'text-brand-600 dark:text-brand-400', bg: 'bg-brand-50 dark:bg-brand-900/40 border-brand-200 dark:border-brand-800/40', icon: <Clock size={13} /> },
          { key: 'IN_PROGRESS', label: 'In Progress', value: activeStats.inProgress, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/40', icon: <Zap size={13} /> },
          { key: 'REVIEW', label: 'Review', value: activeStats.review, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/40 border-violet-100 dark:border-violet-900/40', icon: <Eye size={13} /> },
          { key: 'OVERDUE', label: 'Overdue', value: activeStats.overdue, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-100 dark:border-rose-900/40', icon: <AlertTriangle size={13} /> },
          { key: 'COMPLETED', label: 'Completed', value: activeStats.completed, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/40', icon: <TrendingUp size={13} /> },
        ].map((s, i) => {
          const isSelected = quickPreset === s.key;
          return (
            <div
              key={s.label}
              onClick={() => setQuickPreset(prev => prev === s.key ? 'ALL' : s.key)}
              className={`${s.bg} border rounded-2xl px-3.5 py-3 animate-fade-in-up flex items-center gap-3 cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                isSelected ? 'ring-2 ring-indigo-500 shadow-md' : 'hover:shadow-sm'
              }`}
              style={{ animationDelay: `${i * 0.04}s` }}
              title={`Click to filter by ${s.label}`}
            >
              <span className={`${s.color} opacity-70 shrink-0`}>{s.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold text-brand-400 uppercase tracking-wider truncate">{s.label}</p>
                <p className={`text-lg font-black leading-tight ${s.color}`}>{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Quick Date & Status Filter Chips (Pills) ─── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {[
          { key: 'ALL', label: 'All Tasks', count: presetCounts.all, icon: <Sparkles size={11} /> },
          { key: 'TODAY', label: 'Today', count: presetCounts.today, icon: <Flame size={11} className="text-amber-500" /> },
          { key: 'YESTERDAY', label: 'Yesterday', count: presetCounts.yesterday, icon: <Clock size={11} className="text-indigo-400" /> },
          { key: 'LAST_7_DAYS', label: 'Last 7 Days', count: presetCounts.last7Days, icon: <Calendar size={11} className="text-emerald-400" /> },
          { key: 'LAST_30_DAYS', label: 'Last 30 Days', count: presetCounts.last30Days, icon: <Calendar size={11} className="text-cyan-400" /> },
          { key: 'OVERDUE', label: 'Overdue', count: presetCounts.overdue, icon: <AlertTriangle size={11} className="text-rose-500" /> },
          { key: 'IN_PROGRESS', label: 'In Progress', count: presetCounts.inProgress, icon: <Zap size={11} className="text-amber-500" /> },
          { key: 'PENDING', label: 'Pending', count: presetCounts.pending, icon: <Clock size={11} className="text-brand-400" /> },
          { key: 'REVIEW', label: 'Review', count: presetCounts.review, icon: <Eye size={11} className="text-violet-500" /> },
          { key: 'COMPLETED', label: 'Completed', count: presetCounts.completed, icon: <CheckSquare size={11} className="text-emerald-500" /> },
          { key: 'CRITICAL', label: 'Critical', count: presetCounts.critical, icon: <AlertCircle size={11} className="text-rose-500" /> },
        ].map((chip) => {
          const isActive = quickPreset === chip.key;
          return (
            <button
              key={chip.key}
              onClick={() => setQuickPreset(chip.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-800 border border-brand-200 dark:border-brand-800/60'
              }`}
            >
              {chip.icon}
              <span>{chip.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-extrabold ${
                isActive ? 'bg-white/20 text-white' : 'bg-brand-200/60 dark:bg-brand-800 text-brand-500 dark:text-brand-400'
              }`}>
                {chip.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─── Search & Advanced Dropdown Filters ─── */}
      <div className="glass rounded-2xl border border-brand-200 dark:border-brand-800 p-3.5 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
          <input
            type="text"
            placeholder="Search by title, assignee, department, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-2 bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl text-xs font-semibold text-brand-950 dark:text-white placeholder:text-brand-400 outline-none focus:border-indigo-500 transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-400 hover:text-brand-600">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Filters Group */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Department Filter (Only for Team Progress tab) */}
          {taskViewTab === 'TEAM_PROGRESS' && departments.length > 0 && (
            <div className="flex items-center gap-1 bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl px-2.5 py-1.5">
              <Building2 size={11} className="text-brand-400 shrink-0" />
              <select
                value={departmentFilter}
                onChange={e => setDepartmentFilter(e.target.value)}
                className="bg-transparent text-[11px] font-bold text-brand-800 dark:text-brand-200 outline-none cursor-pointer"
              >
                <option value="ALL" className="dark:bg-brand-900">All Depts</option>
                {departments.map(d => (
                  <option key={d} value={d} className="dark:bg-brand-900">{d}</option>
                ))}
              </select>
            </div>
          )}

          {/* Priority Filter */}
          <div className="flex items-center gap-1 bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl px-2.5 py-1.5">
            <span className="text-[9px] font-bold text-brand-400 uppercase">Priority:</span>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="bg-transparent text-[11px] font-bold text-brand-800 dark:text-brand-200 outline-none cursor-pointer"
            >
              {PRIORITY_OPTIONS.map(p => (
                <option key={p} value={p} className="dark:bg-brand-900">{p === 'ALL' ? 'All Priority' : p}</option>
              ))}
            </select>
          </div>

          {/* Date / Timeframe Filter */}
          <div className="flex items-center gap-1 bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl px-2.5 py-1.5">
            <Calendar size={11} className="text-brand-400 shrink-0" />
            <select
              value={deadlineFilter}
              onChange={e => setDeadlineFilter(e.target.value)}
              className="bg-transparent text-[11px] font-bold text-brand-800 dark:text-brand-200 outline-none cursor-pointer"
            >
              <option value="ALL" className="dark:bg-brand-900">All Dates</option>
              <option value="TODAY" className="dark:bg-brand-900">📅 Today</option>
              <option value="YESTERDAY" className="dark:bg-brand-900">⏳ Yesterday</option>
              <option value="LAST_7_DAYS" className="dark:bg-brand-900">🗓️ Last 7 Days</option>
              <option value="LAST_30_DAYS" className="dark:bg-brand-900">📆 Last 30 Days</option>
              <option value="TOMORROW" className="dark:bg-brand-900">⏰ Due Tomorrow</option>
              <option value="THIS_WEEK" className="dark:bg-brand-900">🚀 Next 7 Days</option>
              <option value="OVERDUE" className="dark:bg-brand-900">⚠️ Overdue</option>
            </select>
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 transition-all shadow-sm cursor-pointer"
              title="Reset all filters"
            >
              <RotateCcw size={11} /> Reset
            </button>
          )}

          <span className="text-[10px] font-bold text-brand-400 ml-auto pl-2">
            Showing <span className="text-indigo-600 font-extrabold">{filteredTasks.length}</span> of <span className="font-extrabold text-brand-700 dark:text-brand-300">{scopedTasks.length}</span>
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
                    ...(taskViewTab === 'TEAM_PROGRESS' ? [{ label: 'Assignee', field: null, width: 'min-w-[140px]' }] : []),
                    { label: 'Priority', field: 'priority' as SortField, width: 'min-w-[90px]' },
                    { label: 'Status', field: 'status' as SortField, width: 'min-w-[110px]' },
                    ...(taskViewTab === 'TEAM_PROGRESS' ? [{ label: 'Progress', field: 'progress' as SortField, width: 'min-w-[120px]' }] : []),
                    { label: 'Due Date', field: 'dueDate' as SortField, width: 'min-w-[110px]' },
                    { label: 'Time', field: null, width: 'min-w-[60px]' },
                    { label: 'Actions', field: null, width: 'w-24 text-right' },
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
                    <td colSpan={taskViewTab === 'TEAM_PROGRESS' ? 8 : 7} className="text-center py-16">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center">
                          <CheckSquare size={18} className="text-brand-400" />
                        </div>
                        <p className="text-xs font-bold text-brand-400">
                          {isSuperAdmin && taskViewTab === 'ADMIN_TASKS'
                            ? 'No Super Admin tasks found. Click "New Admin Task" to add your administrative notes.'
                            : 'No tasks match your filters'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task, idx) => {
                    const isSuperAdminTask = ['OBI0001', 'OBI1117'].includes(task.employeeId);
                    const dueInfo = getRelativeDueDate(task.dueDate);
                    const isOverdue = !isSuperAdminTask && dueInfo.isOverdue && !['COMPLETED', 'REJECTED'].includes(task.status);
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

                        {/* Assignee (Only for Team Progress view) */}
                        {taskViewTab === 'TEAM_PROGRESS' && (
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <AvatarInitials name={getEmployeeName(task)} size="w-6 h-6" />
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold text-brand-800 dark:text-brand-200 truncate flex items-center gap-1.5">
                                  {getEmployeeName(task)}
                                </p>
                                {task.employee?.department && (
                                  <p className="text-[9px] text-brand-400 font-medium truncate">{task.employee.department}</p>
                                )}
                              </div>
                            </div>
                          </td>
                        )}

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

                        {/* Progress Bar (Only for Team Progress view) */}
                        {taskViewTab === 'TEAM_PROGRESS' && (
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
                        )}

                        {/* Due Date & Time */}
                        <td className="px-4 py-3.5">
                          <div>
                            <p className="text-[10px] font-bold text-brand-700 dark:text-brand-300 flex items-center gap-1">
                              <span>{new Date(task.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                              <span className="text-[9px] font-semibold text-brand-400">
                                {new Date(task.dueDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                              </span>
                            </p>
                            <p className={`text-[9px] font-bold mt-0.5 ${dueInfo.isOverdue && !['COMPLETED', 'REJECTED'].includes(task.status) ? 'text-rose-500' : 'text-brand-400'}`}>
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

                        {/* Actions (Edit for ongoing/progress/overdue/pending + Delete for Admin/HR) */}
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Edit Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(task);
                              }}
                              title="Edit Task Details"
                              className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-indigo-600 hover:text-indigo-700 transition-colors inline-flex items-center justify-center"
                            >
                              <Edit2 size={13} />
                            </button>

                            {/* Direct Delete for Admin/HR */}
                            {isAdmin && (
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
                            )}
                          </div>
                        </td>
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
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      const t = selectedTask;
                      openEditModal(t);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 text-xs font-bold transition-all shadow-sm"
                  >
                    <Edit2 size={13} />
                    <span>Edit Task</span>
                  </button>
                  <button onClick={() => setSelectedTask(null)} className="p-2 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-900 transition-colors">
                    <X size={18} className="text-brand-500" />
                  </button>
                </div>
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
                      <p className="text-[8px] font-bold text-brand-400 uppercase">Deadline</p>
                      <p className={`text-[11px] font-extrabold mt-0.5 ${
                        getRelativeDueDate(selectedTask.dueDate).isOverdue && !['COMPLETED','REJECTED'].includes(selectedTask.status) ? 'text-rose-600' : 'text-brand-950 dark:text-white'
                      }`}>
                        {new Date(selectedTask.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} • {new Date(selectedTask.dueDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </p>
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
        <div className="fixed inset-0 z-50 bg-brand-950/60 backdrop-blur-md flex items-center justify-center p-4 md:p-6"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
          <div className="w-full max-w-2xl md:max-w-3xl animate-slide-in-scale glass rounded-3xl border border-brand-200 dark:border-brand-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-brand-200 dark:border-brand-800 flex justify-between items-center bg-brand-50/50 dark:bg-brand-900/30">
              <div>
                <h3 className="font-extrabold text-base text-brand-950 dark:text-white flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-md shadow-indigo-500/20"><Plus size={14} className="text-white" /></div>
                  Create New Task
                </h3>
                <p className="text-xs text-brand-500 font-medium mt-1">Assign deliverables, define timeline checkpoints, and structure subtasks</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-900 transition-colors"><X size={18} className="text-brand-500" /></button>
            </div>
            <form onSubmit={handleCreateTask} className="p-6 space-y-5 text-left text-xs font-semibold overflow-y-auto flex-1">
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Priority</label>
                  <select value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value as Task['priority'] })}
                    className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500 text-brand-950 dark:text-white transition-all text-xs">
                    <option value="LOW">🟢 Low</option><option value="MEDIUM">🟡 Medium</option><option value="HIGH">🟠 High</option><option value="CRITICAL">🔴 Critical</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1 flex items-center gap-1"><Calendar size={10} /> Due Date *</label>
                  <input type="date" required value={newTask.dueDate} onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })}
                    className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500 text-brand-950 dark:text-white transition-all text-xs" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1 flex items-center gap-1"><Clock size={10} /> End Time (12h) *</label>
                  <div className="flex items-center gap-1 bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl p-1">
                    <select
                      value={newTask.dueHour}
                      onChange={e => setNewTask({ ...newTask, dueHour: e.target.value })}
                      className="bg-transparent text-xs font-bold text-brand-950 dark:text-white outline-none cursor-pointer px-1 py-1.5"
                    >
                      {['01','02','03','04','05','06','07','08','09','10','11','12'].map(h => (
                        <option key={h} value={h} className="dark:bg-brand-900">{h}</option>
                      ))}
                    </select>
                    <span className="text-brand-400 font-bold text-xs">:</span>
                    <select
                      value={newTask.dueMinute}
                      onChange={e => setNewTask({ ...newTask, dueMinute: e.target.value })}
                      className="bg-transparent text-xs font-bold text-brand-950 dark:text-white outline-none cursor-pointer px-1 py-1.5"
                    >
                      {['00','05','10','15','20','25','30','35','40','45','50','55'].map(m => (
                        <option key={m} value={m} className="dark:bg-brand-900">{m}</option>
                      ))}
                    </select>
                    <select
                      value={newTask.duePeriod}
                      onChange={e => setNewTask({ ...newTask, duePeriod: e.target.value as 'AM' | 'PM' })}
                      className="bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 rounded-lg px-2 py-1 text-xs font-extrabold outline-none cursor-pointer ml-auto border border-indigo-200 dark:border-indigo-800"
                    >
                      <option value="AM" className="dark:bg-brand-900">AM</option>
                      <option value="PM" className="dark:bg-brand-900">PM</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1 flex items-center gap-1"><User size={10} /> Assign To *</label>
                <select required value={newTask.employeeId} disabled={!isPrivileged} onChange={e => setNewTask({ ...newTask, employeeId: e.target.value })}
                  className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500 text-brand-950 dark:text-white transition-all disabled:opacity-75">
                  {isPrivileged ? (
                    <>
                      <option value="">— Select Assignee —</option>
                      {user?.role === 'SUPER_ADMIN' && user?.employeeId && (
                        <option value={user.employeeId} className="font-bold text-indigo-600">
                          ★ Assign to Myself ({user.firstName || 'Super Admin'} {user.lastName || ''} - {user.employeeId})
                        </option>
                      )}
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
              <div className="space-y-2">
                <div className="flex items-center justify-between pl-1">
                  <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider flex items-center gap-1">
                    <ListChecks size={10} /> Subtasks Checklist
                  </label>
                  <span className="text-[9px] text-brand-400 font-medium">Press <kbd className="px-1.5 py-0.5 rounded bg-brand-200 dark:bg-brand-800 text-[8px] font-bold text-brand-700 dark:text-brand-300">Enter ↵</kbd> for next box</span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {newTask.subtasks.map((st, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-1.5 bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl focus-within:border-indigo-500 transition-all">
                      <span className="w-5 h-5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[9px] font-extrabold flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/50">
                        {idx + 1}
                      </span>
                      <input
                        id={`subtask-input-${idx}`}
                        type="text"
                        placeholder={`Subtask ${idx + 1} item...`}
                        value={st}
                        onChange={e => handleSubtaskChange(idx, e.target.value)}
                        onKeyDown={e => handleSubtaskKeyDown(idx, e)}
                        className="flex-1 bg-transparent text-xs text-brand-950 dark:text-white placeholder:text-brand-400 outline-none font-medium"
                      />
                      {newTask.subtasks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSubtaskField(idx)}
                          className="p-1 rounded-lg text-brand-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Remove subtask"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addSubtaskField}
                  className="w-full py-2 bg-indigo-50/60 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl text-[10px] font-bold border border-dashed border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center gap-1.5 transition-all"
                >
                  <Plus size={12} /> Add Another Subtask Box
                </button>
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
      {/* ═══════════════════════════════════════ */}
      {/* ─── EDIT TASK MODAL ─── */}
      {/* ═══════════════════════════════════════ */}
      {showEditModal && editTask && (
        <div className="fixed inset-0 z-50 bg-brand-950/60 backdrop-blur-md flex items-center justify-center p-4 md:p-6"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowEditModal(false); setEditTask(null); } }}>
          <div className="w-full max-w-2xl md:max-w-3xl animate-slide-in-scale glass rounded-3xl border border-brand-200 dark:border-brand-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-6 border-b border-brand-200 dark:border-brand-800 flex justify-between items-center bg-brand-50/50 dark:bg-brand-900/30">
              <div>
                <h3 className="font-extrabold text-base text-brand-950 dark:text-white flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-md shadow-indigo-500/20">
                    <Edit2 size={14} className="text-white" />
                  </div>
                  <span>Edit Task Deliverable</span>
                </h3>
                <p className="text-xs text-brand-500 font-medium mt-1">Modify task scope, status, progress, deadline, and checklist items</p>
              </div>
              <button onClick={() => { setShowEditModal(false); setEditTask(null); }} className="p-2 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-900 transition-colors">
                <X size={18} className="text-brand-500" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEditTask} className="p-6 space-y-5 text-left text-xs font-semibold overflow-y-auto flex-1">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="Task title..."
                  value={editTask.title}
                  onChange={e => setEditTask({ ...editTask, title: e.target.value })}
                  className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500 text-brand-950 dark:text-white transition-all"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe scope, objectives and deliverables..."
                  value={editTask.description}
                  onChange={e => setEditTask({ ...editTask, description: e.target.value })}
                  className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500 text-brand-950 dark:text-white resize-none transition-all"
                />
              </div>

              {/* 3-Column Attributes Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Priority */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Priority</label>
                  <select
                    value={editTask.priority}
                    onChange={e => setEditTask({ ...editTask, priority: e.target.value as Task['priority'] })}
                    className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500 text-brand-950 dark:text-white transition-all text-xs"
                  >
                    <option value="LOW">🟢 Low</option>
                    <option value="MEDIUM">🟡 Medium</option>
                    <option value="HIGH">🟠 High</option>
                    <option value="CRITICAL">🔴 Critical</option>
                  </select>
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Status</label>
                  <select
                    value={editTask.status}
                    onChange={e => {
                      const newStat = e.target.value as Task['status'];
                      const newProg = newStat === 'COMPLETED' ? 100 : editTask.progress;
                      setEditTask({ ...editTask, status: newStat, progress: newProg });
                    }}
                    className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500 text-brand-950 dark:text-white transition-all text-xs"
                  >
                    <option value="PENDING">⏳ Pending / Not Started</option>
                    <option value="IN_PROGRESS">⚡ In Progress / Ongoing</option>
                    <option value="REVIEW">🔍 In Review</option>
                    <option value="OVERDUE">⚠️ Overdue</option>
                    <option value="COMPLETED">✅ Completed</option>
                  </select>
                </div>

                {/* Expected Hours */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1 flex items-center gap-1">
                    <Timer size={10} /> Expected Hours
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder="e.g. 8"
                    value={editTask.expectedHours || ''}
                    onChange={e => setEditTask({ ...editTask, expectedHours: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500 text-brand-950 dark:text-white transition-all text-xs"
                  />
                </div>
              </div>

              {/* Progress Slider */}
              <div className="space-y-2 bg-brand-50 dark:bg-brand-900/40 p-3.5 rounded-2xl border border-brand-200 dark:border-brand-800/60">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider flex items-center gap-1">
                    <Sliders size={11} /> Task Completion Progress
                  </label>
                  <span className={`text-xs font-extrabold px-2 py-0.5 rounded-md ${
                    editTask.progress >= 100 ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600' : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600'
                  }`}>
                    {editTask.progress}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={editTask.progress}
                  onChange={e => {
                    const val = parseInt(e.target.value, 10);
                    const newStat = val >= 100 ? 'COMPLETED' : (val > 0 && editTask.status === 'PENDING' ? 'IN_PROGRESS' : editTask.status);
                    setEditTask({ ...editTask, progress: val, status: newStat });
                  }}
                  className="w-full h-2 bg-brand-200 dark:bg-brand-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              {/* Deadline (Due Date & Time) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1 flex items-center gap-1">
                    <Calendar size={10} /> Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={editTask.dueDate}
                    onChange={e => setEditTask({ ...editTask, dueDate: e.target.value })}
                    className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500 text-brand-950 dark:text-white transition-all text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1 flex items-center gap-1">
                    <Clock size={10} /> Due Time (12h) *
                  </label>
                  <div className="flex items-center gap-1 bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl p-1">
                    <select
                      value={editTask.dueHour}
                      onChange={e => setEditTask({ ...editTask, dueHour: e.target.value })}
                      className="bg-transparent text-xs font-bold text-brand-950 dark:text-white outline-none cursor-pointer px-1 py-1.5"
                    >
                      {['01','02','03','04','05','06','07','08','09','10','11','12'].map(h => (
                        <option key={h} value={h} className="dark:bg-brand-900">{h}</option>
                      ))}
                    </select>
                    <span className="text-brand-400 font-bold text-xs">:</span>
                    <select
                      value={editTask.dueMinute}
                      onChange={e => setEditTask({ ...editTask, dueMinute: e.target.value })}
                      className="bg-transparent text-xs font-bold text-brand-950 dark:text-white outline-none cursor-pointer px-1 py-1.5"
                    >
                      {['00','05','10','15','20','25','30','35','40','45','50','55'].map(m => (
                        <option key={m} value={m} className="dark:bg-brand-900">{m}</option>
                      ))}
                    </select>
                    <select
                      value={editTask.duePeriod}
                      onChange={e => setEditTask({ ...editTask, duePeriod: e.target.value as 'AM' | 'PM' })}
                      className="bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 rounded-lg px-2 py-1 text-xs font-extrabold outline-none cursor-pointer ml-auto border border-indigo-200 dark:border-indigo-800"
                    >
                      <option value="AM" className="dark:bg-brand-900">AM</option>
                      <option value="PM" className="dark:bg-brand-900">PM</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Assignee (Editable for Privileged roles) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1 flex items-center gap-1">
                  <User size={10} /> Assignee
                </label>
                <select
                  required
                  value={editTask.employeeId}
                  disabled={!isPrivileged}
                  onChange={e => setEditTask({ ...editTask, employeeId: e.target.value })}
                  className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-500 text-brand-950 dark:text-white transition-all disabled:opacity-75"
                >
                  {isPrivileged ? (
                    <>
                      <option value="">— Select Assignee —</option>
                      {user?.role === 'SUPER_ADMIN' && user?.employeeId && (
                        <option value={user.employeeId} className="font-bold text-indigo-600">
                          ★ Assign to Myself ({user.firstName || 'Super Admin'} {user.lastName || ''} - {user.employeeId})
                        </option>
                      )}
                      {employees.map(emp => (
                        <option key={emp.employeeId} value={emp.employeeId}>
                          {emp.firstName} {emp.lastName} ({emp.employeeId}) — {emp.designation} {emp.department ? `[${emp.department}]` : ''}
                        </option>
                      ))}
                    </>
                  ) : (
                    <option value={editTask.employeeId}>
                      {editTask.employeeId}
                    </option>
                  )}
                </select>
              </div>

              {/* Subtasks Checklist */}
              <div className="space-y-2">
                <div className="flex items-center justify-between pl-1">
                  <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider flex items-center gap-1">
                    <ListChecks size={10} /> Subtasks Checklist
                  </label>
                  <span className="text-[9px] text-brand-400 font-medium">
                    Press <kbd className="px-1.5 py-0.5 rounded bg-brand-200 dark:bg-brand-800 text-[8px] font-bold text-brand-700 dark:text-brand-300">Enter ↵</kbd> for next box
                  </span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {editTask.subtasks.map((st, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-1.5 bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl focus-within:border-indigo-500 transition-all">
                      <button
                        type="button"
                        onClick={() => handleEditSubtaskToggle(idx)}
                        className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                          st.isCompleted
                            ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                            : 'bg-brand-100 dark:bg-brand-800 border-brand-300 dark:border-brand-700 text-transparent hover:text-brand-400'
                        }`}
                        title={st.isCompleted ? 'Mark pending' : 'Mark completed'}
                      >
                        <Check size={11} className={st.isCompleted ? 'opacity-100' : 'opacity-0 hover:opacity-50'} />
                      </button>
                      <input
                        id={`edit-subtask-input-${idx}`}
                        type="text"
                        placeholder={`Subtask ${idx + 1} item...`}
                        value={st.title}
                        onChange={e => handleEditSubtaskChange(idx, e.target.value)}
                        onKeyDown={e => handleEditSubtaskKeyDown(idx, e)}
                        className={`flex-1 bg-transparent text-xs outline-none font-medium ${
                          st.isCompleted ? 'line-through text-brand-400 dark:text-brand-500' : 'text-brand-950 dark:text-white'
                        }`}
                      />
                      {editTask.subtasks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleEditSubtaskRemove(idx)}
                          className="p-1 rounded-lg text-brand-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Remove subtask"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleEditSubtaskAdd}
                  className="w-full py-2 bg-indigo-50/60 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl text-[10px] font-bold border border-dashed border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center gap-1.5 transition-all"
                >
                  <Plus size={12} /> Add Another Subtask Box
                </button>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-brand-200 dark:border-brand-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditTask(null); }}
                  className="bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 rounded-xl px-5 py-2.5 font-bold text-[10px] uppercase hover:bg-brand-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEditTask}
                  className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl px-6 py-2.5 font-bold text-[10px] uppercase shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingEditTask ? (
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 size={13} />
                  )}
                  <span>Save Changes</span>
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
