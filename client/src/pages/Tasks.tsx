import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Plus, CheckSquare, Clock, MessageSquare, AlertCircle, Calendar, Play, Tag, Send, X, Check, Eye
} from 'lucide-react';

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
  comments: Array<{ authorName: string; content: string; timestamp: string }>;
  subtasks: Array<{ title: string; isCompleted: boolean }>;
  timeLogs: Array<{ durationMinutes: number; loggedAt: string }>;
  employee?: { firstName: string; lastName: string; department?: string; designation?: string };
  assignedBy?: { firstName: string; lastName: string; designation?: string };
}

const STATUS_COLUMNS: Array<{ label: string; value: Task['status']; color: string }> = [
  { label: 'Pending', value: 'PENDING', color: 'border-t-brand-300 dark:border-t-brand-800' },
  { label: 'In Progress', value: 'IN_PROGRESS', color: 'border-t-indigo-600' },
  { label: 'Under Review', value: 'REVIEW', color: 'border-t-amber-500' },
  { label: 'Completed', value: 'COMPLETED', color: 'border-t-emerald-600' },
  { label: 'Rejected / Blocked', value: 'REJECTED', color: 'border-t-rose-600' },
];

export const Tasks: React.FC = () => {
  const { user } = useAuth();
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // New Task form state
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM' as Task['priority'],
    dueDate: '',
    employeeId: '',
    subtasksInput: '',
  });

  // Task Update states
  const [logTimeMinutes, setLogTimeMinutes] = useState<number>(0);
  const [commentText, setCommentText] = useState('');
  const [updatingTaskState, setUpdatingTaskState] = useState(false);

  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    fetchTasks();
    if (user?.role && ['TEAM_LEAD', 'HR', 'SUPER_ADMIN'].includes(user.role)) {
      fetchEmployees();
    }
  }, [user]);

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/employees');
      setEmployees(res.data.data);
    } catch (err) {
      console.error('Failed to load employee list:', err);
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const url = (user?.role === 'HR' || user?.role === 'SUPER_ADMIN') ? '/tasks/all' : '/tasks/my-tasks';
      const res = await api.get(url);
      setTasks(res.data.data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const subtasks = newTask.subtasksInput
        .split('\n')
        .filter((t) => t.trim() !== '')
        .map((title) => ({ title, isCompleted: false }));

      const payload = {
        title: newTask.title,
        description: newTask.description,
        priority: newTask.priority,
        dueDate: new Date(newTask.dueDate),
        employeeId: newTask.employeeId,
        subtasks,
      };

      await api.post('/tasks', payload);
      setShowAddModal(false);
      setNewTask({ title: '', description: '', priority: 'MEDIUM', dueDate: '', employeeId: '', subtasksInput: '' });
      fetchTasks();
      alert('Task assigned successfully!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create task');
    }
  };

  const handleTaskStatusTransition = async (taskId: string, newStatus: Task['status']) => {
    try {
      await api.put(`/tasks/${taskId}`, { status: newStatus });
      fetchTasks();
      if (selectedTask?.id === taskId) {
        setSelectedTask((prev) => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update task status');
    }
  };

  const handleUpdateTaskDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    setUpdatingTaskState(true);

    try {
      const payload: any = {
        subtasks: selectedTask.subtasks,
      };

      if (commentText.trim()) payload.comment = commentText;
      if (logTimeMinutes > 0) payload.timeLogMinutes = logTimeMinutes;

      // Deduce status based on progress
      const completedSubtasks = selectedTask.subtasks.filter((s) => s.isCompleted).length;
      const progress = selectedTask.subtasks.length > 0 
        ? Math.round((completedSubtasks / selectedTask.subtasks.length) * 100) 
        : selectedTask.progress;
      payload.progress = progress;

      const res = await api.put(`/tasks/${selectedTask.id}`, payload);
      
      setSelectedTask(res.data.data);
      setCommentText('');
      setLogTimeMinutes(0);
      fetchTasks();
      alert('Task updated successfully.');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update task');
    } finally {
      setUpdatingTaskState(false);
    }
  };

  const toggleSubtask = (index: number) => {
    if (!selectedTask) return;
    const subtasks = [...selectedTask.subtasks];
    subtasks[index].isCompleted = !subtasks[index].isCompleted;
    setSelectedTask({ ...selectedTask, subtasks });
  };

  const getPriorityColor = (p: Task['priority']) => {
    switch (p) {
      case 'CRITICAL': return 'bg-rose-500 text-white';
      case 'HIGH': return 'bg-orange-500 text-white';
      case 'MEDIUM': return 'bg-indigo-500 text-white';
      case 'LOW': return 'bg-brand-500 text-white';
      default: return 'bg-brand-300';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-extrabold text-2xl tracking-tight text-brand-950 dark:text-white">Task Kanban Board</h1>
          <p className="text-xs text-brand-500 mt-1 font-semibold">Organize deliverables, update checklists, and audit time logs</p>
        </div>
        {user?.role && ['TEAM_LEAD', 'HR', 'SUPER_ADMIN'].includes(user.role) && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl px-5 py-3 font-bold text-xs tracking-wider uppercase transition-all flex items-center space-x-2 shadow-lg shadow-indigo-600/20"
          >
            <Plus size={16} />
            <span>Create Deliverable</span>
          </button>
        )}
      </div>

      {/* Kanban Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 items-start">
        {STATUS_COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.value);
          return (
            <div key={col.value} className="bg-brand-100/40 dark:bg-brand-900/40 rounded-3xl p-4 border border-brand-200 dark:border-brand-900/60 min-h-[60vh] flex flex-col">
              {/* Column Header */}
              <div className={`pb-3 mb-4 border-t-4 ${col.color} flex justify-between items-center px-1`}>
                <span className="font-extrabold text-xs uppercase tracking-wider text-brand-950 dark:text-white">{col.label}</span>
                <span className="text-[10px] bg-brand-200 dark:bg-brand-850 px-2 py-0.5 rounded-md font-bold">{colTasks.length}</span>
              </div>

              {/* Tasks List */}
              <div className="space-y-3.5 flex-1 overflow-y-auto max-h-[70vh] pr-1">
                {colTasks.length === 0 ? (
                  <div className="text-center py-8 text-[10px] text-brand-400 font-semibold border-2 border-dashed border-brand-200 dark:border-brand-800 rounded-2xl">
                    No active tasks
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className="bg-white dark:bg-brand-950 p-4 rounded-2xl border border-brand-200 dark:border-brand-900 shadow-sm hover:shadow-md cursor-pointer transition-all hover:-translate-y-0.5"
                    >
                      <div className="flex justify-between items-start">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold tracking-wide uppercase ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                        <span className="text-[9px] text-indigo-600 font-bold">
                          {task.employee ? `${task.employee.firstName} ${task.employee.lastName}` : task.employeeId}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-xs text-brand-950 dark:text-white mt-3 line-clamp-1">{task.title}</h4>
                      <p className="text-[10px] text-brand-500 mt-1 line-clamp-2 leading-relaxed">{task.description}</p>
                      
                      {/* Subtask count & progress bar */}
                      {task.subtasks.length > 0 && (
                        <div className="mt-4 space-y-1.5">
                          <div className="flex justify-between text-[9px] font-bold text-brand-400">
                            <span>Checklist</span>
                            <span>{task.subtasks.filter((s) => s.isCompleted).length}/{task.subtasks.length}</span>
                          </div>
                          <div className="w-full h-1 bg-brand-100 dark:bg-brand-900 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-600 transition-all duration-300"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="mt-4 pt-3 border-t border-brand-100 dark:border-brand-900 flex justify-between items-center text-[9px] text-brand-400 font-bold">
                        <span className="flex items-center"><Calendar size={10} className="mr-1" />{new Date(task.dueDate).toLocaleDateString()}</span>
                        {task.comments.length > 0 && (
                          <span className="flex items-center"><MessageSquare size={10} className="mr-1" />{task.comments.length}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* --- TASK UPDATE DETAILS POPUP --- */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-brand-950/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-2xl glass rounded-3xl border border-brand-200 dark:border-brand-900 shadow-2xl p-6 md:p-8 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-brand-200 dark:border-brand-900">
              <div>
                <h3 className="font-extrabold text-sm text-indigo-600 uppercase tracking-wide">Update Task Details</h3>
                <span className="text-[10px] text-brand-500 font-semibold">Assigned employee: {selectedTask.employeeId}</span>
              </div>
              <button onClick={() => setSelectedTask(null)} className="p-1 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              {/* Left Details column */}
              <div className="md:col-span-2 space-y-5 text-left text-xs font-semibold">
                <div>
                  <h4 className="text-brand-950 dark:text-white font-extrabold text-sm">{selectedTask.title}</h4>
                  <p className="text-brand-600 dark:text-brand-400 mt-2 leading-relaxed font-medium">{selectedTask.description}</p>
                </div>

                {/* Subtask checklist */}
                {selectedTask.subtasks.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Subtask checklist</h5>
                    <div className="space-y-1.5">
                      {selectedTask.subtasks.map((sub, idx) => (
                        <label key={idx} className="flex items-center space-x-2.5 p-2 bg-brand-100/50 dark:bg-brand-900/50 rounded-xl cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sub.isCompleted}
                            onChange={() => toggleSubtask(idx)}
                            className="rounded border-brand-300 dark:border-brand-800 text-indigo-600 focus:ring-indigo-600"
                          />
                          <span className={sub.isCompleted ? 'line-through text-brand-400' : 'text-brand-950 dark:text-white'}>
                            {sub.title}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Comments feed */}
                <div className="space-y-3">
                  <h5 className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Task logs & comments</h5>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {selectedTask.comments.length === 0 ? (
                      <p className="text-[10px] text-brand-400 font-semibold italic text-center py-2">No logs written yet.</p>
                    ) : (
                      selectedTask.comments.map((c, i) => (
                        <div key={i} className="p-2.5 bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200/50 dark:border-brand-800/50 rounded-2xl">
                          <p className="font-bold text-[10px] text-indigo-600">{c.authorName}</p>
                          <p className="text-[11px] text-brand-700 dark:text-brand-300 mt-1 leading-normal">"{c.content}"</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Right Action column */}
              <div className="space-y-5 text-left border-l border-brand-100 dark:border-brand-900 pl-0 md:pl-6">
                
                {/* Column Move / Transitions */}
                <div className="space-y-2 text-xs font-semibold">
                  <label className="text-[10px] font-bold text-brand-500 uppercase">Transition Status</label>
                  <div className="flex flex-col space-y-1.5">
                    {STATUS_COLUMNS.map((col) => (
                      <button
                        key={col.value}
                        onClick={() => handleTaskStatusTransition(selectedTask.id, col.value)}
                        className={`w-full py-2 px-3 rounded-xl font-bold text-[10px] uppercase text-left transition-all border ${
                          selectedTask.status === col.value
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10'
                            : 'bg-brand-100 dark:bg-brand-900 text-brand-800 dark:text-white border-brand-200 dark:border-brand-850 hover:bg-brand-200'
                        }`}
                      >
                        {col.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Form changes fields */}
                <form onSubmit={handleUpdateTaskDetails} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase">Log work time (minutes)</label>
                    <input
                      type="number"
                      min={0}
                      value={logTimeMinutes}
                      onChange={(e) => setLogTimeMinutes(parseInt(e.target.value) || 0)}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase">Add log comment</label>
                    <textarea
                      rows={2}
                      placeholder="Comment text..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600 text-brand-950 dark:text-white resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={updatingTaskState}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 font-bold text-xs uppercase shadow-md flex items-center justify-center space-x-1.5"
                  >
                    <Check size={14} />
                    <span>{updatingTaskState ? 'Updating...' : 'Save progress'}</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- ASSIGN TASK MODAL --- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-brand-950/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-md glass rounded-3xl border border-brand-200 dark:border-brand-900 shadow-2xl p-6">
            <div className="flex justify-between items-center pb-4 border-b border-brand-200 dark:border-brand-900">
              <h3 className="font-extrabold text-sm uppercase tracking-wider">Assign Corporate Deliverable</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="mt-4 space-y-4 text-left text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Deliverable Title</label>
                <input
                  type="text"
                  required
                  placeholder="Task title"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Description</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Provide scope, attachments, or links..."
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-600 text-brand-950 dark:text-white resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as Task['priority'] })}
                    className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-600 text-brand-950 dark:text-white"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                    className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-600 text-brand-950 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Assignee Employee</label>
                <select
                  required
                  value={newTask.employeeId}
                  onChange={(e) => setNewTask({ ...newTask, employeeId: e.target.value })}
                  className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-600 text-brand-950 dark:text-white"
                >
                  <option value="">-- Select Employee --</option>
                  {employees.map((emp) => (
                    <option key={emp.employeeId} value={emp.employeeId}>
                      {emp.employeeId} - {emp.firstName} {emp.lastName} (★ {emp.rating ? emp.rating.toFixed(1) : '3.5'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Checklist Subtasks (one per line)</label>
                <textarea
                  rows={2}
                  placeholder="Subtask A&#10;Subtask B"
                  value={newTask.subtasksInput}
                  onChange={(e) => setNewTask({ ...newTask, subtasksInput: e.target.value })}
                  className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-600 text-brand-950 dark:text-white resize-none"
                />
              </div>

              <div className="pt-4 border-t border-brand-200 dark:border-brand-900 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="bg-brand-200 text-brand-850 dark:bg-brand-900 dark:text-white rounded-xl px-5 py-2.5 font-bold uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6 py-2.5 font-bold uppercase shadow-md shadow-indigo-600/10"
                >
                  Assign
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
