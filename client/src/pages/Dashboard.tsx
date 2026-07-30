import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import {
  Users, UserCheck, CalendarX, AlertCircle, FileSpreadsheet, Hourglass, Play,
  Pause, CheckCircle2, ChevronRight, Download, Eye, MapPin, Clock, Coffee
} from 'lucide-react';

interface HRStats {
  counters: {
    totalEmployees: number;
    present: number;
    absent: number;
    late: number;
    wfh: number;
    pendingLeaves: number;
    pendingTasks: number;
    payrollBudget: number;
  };
  charts: {
    departmentData: Array<{ name: string; value: number }>;
    priorityData: Array<{ name: string; value: number }>;
    taskStatusData: Array<{ name: string; value: number }>;
  };
  recentActivity: Array<{
    id: string;
    action: string;
    details: string;
    timestamp: string;
    employee?: { firstName: string; lastName: string };
  }>;
  employeesList: Array<{
    employeeId: string;
    firstName: string;
    lastName: string;
    department: string;
    designation: string;
    profileImageUrl?: string;
    rating: number;
  }>;
  bestEmployee: {
    employeeId: string;
    firstName: string;
    lastName: string;
    department: string;
    designation: string;
    profileImageUrl?: string;
    rating: number;
  } | null;
  todayTasksAssigned: Array<{
    id: string;
    title: string;
    priority: string;
    status: string;
    employee: { firstName: string; lastName: string };
  }>;
  todayTasksCompleted: Array<{
    id: string;
    title: string;
    priority: string;
    status: string;
    employee: { firstName: string; lastName: string };
  }>;
}

interface EmployeeStats {
  todayAttendance: {
    id: string;
    checkIn?: string;
    checkOut?: string;
    status: string;
    breaks: Array<{ start: string; end?: string }>;
    workFromHome: boolean;
  } | null;
  tasks: {
    pending: number;
    inProgress: number;
    review: number;
    completed: number;
    overdue: number;
    total: number;
  };
  leaveBalances: Record<string, { limit: number; used: number; available: number }>;
  salaries: Array<{
    id: string;
    month: number;
    financialYear: string;
    payslipNumber: string;
    netSalary: number;
    payslipPdfUrl: string;
    status: string;
  }>;
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    createdAt: string;
  }>;
}

const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [hrData, setHrData] = useState<HRStats | null>(null);
  const [empData, setEmpData] = useState<EmployeeStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Time Tracker for Break Session
  const [breakTimer, setBreakTimer] = useState<string>('00:00');

  useEffect(() => {
    fetchStats();
  }, [user]);

  // Break timer update interval
  useEffect(() => {
    if (!empData?.todayAttendance?.breaks) return;
    const activeBreak = empData.todayAttendance.breaks.find((b) => !b.end);
    if (!activeBreak) {
      setBreakTimer('00:00');
      return;
    }

    const interval = setInterval(() => {
      const start = new Date(activeBreak.start).getTime();
      const diff = Date.now() - start;
      const minutes = Math.floor(diff / 60000).toString().padStart(2, '0');
      const seconds = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setBreakTimer(`${minutes}:${seconds}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [empData]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      if (user?.role === 'SUPER_ADMIN' || user?.role === 'HR') {
        const res = await api.get('/reports/hr');
        setHrData(res.data.data);
      } else {
        const res = await api.get('/reports/employee');
        setEmpData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  // --- Attendance Action Handlers ---
  const handleCheckIn = async (wfh = false) => {
    try {
      // Mock geocoordinates (Bangalore office region)
      const latitude = 12.9716;
      const longitude = 77.5946;
      await api.post('/attendance/check-in', { latitude, longitude, workFromHome: wfh });
      fetchStats();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Check-in failed');
    }
  };

  const handleCheckOut = async () => {
    try {
      await api.post('/attendance/check-out');
      fetchStats();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Check-out failed');
    }
  };

  const handleStartBreak = async () => {
    try {
      await api.post('/attendance/break/start');
      fetchStats();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Start break failed');
    }
  };

  const handleEndBreak = async () => {
    try {
      await api.post('/attendance/break/end');
      fetchStats();
    } catch (err: any) {
      alert(err.response?.data?.message || 'End break failed');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 bg-brand-200 dark:bg-brand-900 rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-48 bg-brand-200 dark:bg-brand-900 rounded-3xl col-span-2" />
          <div className="h-48 bg-brand-200 dark:bg-brand-900 rounded-3xl" />
        </div>
      </div>
    );
  }

  // --- HR / ADMIN INTERFACE ---
  if (user?.role === 'SUPER_ADMIN' || user?.role === 'HR') {
    if (!hrData) return <p>Failed to load administrative analytics.</p>;
    const c = hrData.counters;

    return (
      <div className="space-y-8">
        
        {/* KPI Counter Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-brand-500 uppercase">Total Employees</span>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-2xl"><Users size={20} /></div>
            </div>
            <p className="text-3xl font-extrabold text-brand-950 dark:text-white mt-4">{c.totalEmployees}</p>
            <p className="text-[10px] text-emerald-500 font-bold mt-1">OBI Infotech Node</p>
          </div>

          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-brand-500 uppercase">Present Today</span>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-2xl"><UserCheck size={20} /></div>
            </div>
            <p className="text-3xl font-extrabold text-brand-950 dark:text-white mt-4">{c.present}</p>
            <p className="text-[10px] text-brand-500 font-bold mt-1">WFH: {c.wfh} | Late: {c.late}</p>
          </div>

          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-brand-500 uppercase">Pending Review Leaves</span>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-2xl"><CalendarX size={20} /></div>
            </div>
            <p className="text-3xl font-extrabold text-brand-950 dark:text-white mt-4">{c.pendingLeaves}</p>
            <p className="text-[10px] text-rose-500 font-bold mt-1">Requires Approval</p>
          </div>

          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-brand-500 uppercase">Pending Tasks</span>
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-2xl"><AlertCircle size={20} /></div>
            </div>
            <p className="text-3xl font-extrabold text-brand-950 dark:text-white mt-4">{c.pendingTasks}</p>
            <p className="text-[10px] text-brand-500 font-bold mt-1">In progress or review</p>
          </div>
        </div>

        {/* Extended Directory and Daily Tasks Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Onboarded Employees List */}
          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 lg:col-span-2 space-y-6">
            
            {/* MVP / Best Employee Spotlight */}
            {hrData.bestEmployee && (
              <div className="p-5 bg-gradient-to-r from-indigo-600/90 to-indigo-800 text-white rounded-2xl flex items-center justify-between shadow-lg relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-xl" />
                <div className="flex items-center space-x-4 relative z-10">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/20 flex items-center justify-center border-2 border-amber-400">
                    {hrData.bestEmployee.profileImageUrl ? (
                      <img src={hrData.bestEmployee.profileImageUrl} alt="MVP" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-extrabold text-sm text-amber-400">{hrData.bestEmployee.firstName[0]}{hrData.bestEmployee.lastName[0]}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[8px] bg-amber-400 text-brand-950 px-2 py-0.5 rounded-full font-extrabold tracking-wider uppercase">Best Employee of the Month</span>
                    <h4 className="font-bold text-sm mt-1">{hrData.bestEmployee.firstName} {hrData.bestEmployee.lastName}</h4>
                    <p className="text-[10px] text-brand-200 font-semibold">{hrData.bestEmployee.designation} | {hrData.bestEmployee.department}</p>
                  </div>
                </div>
                <div className="text-right relative z-10">
                  <p className="text-2xl font-extrabold text-amber-400">★ {hrData.bestEmployee.rating.toFixed(1)}</p>
                  <p className="text-[9px] text-brand-200 font-bold uppercase tracking-wider">Overall Rating</p>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm uppercase tracking-wider">Onboarded Staff Directory</h3>
              <span className="text-xs text-brand-500 font-bold uppercase">Active list</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-brand-100/30 dark:bg-brand-900/30 text-[9px] font-bold text-brand-500 uppercase border-b border-brand-200 dark:border-brand-900">
                    <th className="px-4 py-2.5">Employee ID</th>
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Department</th>
                    <th className="px-4 py-2.5 text-right">Rating Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100 dark:divide-brand-900 font-semibold">
                  {(hrData.employeesList || []).slice(0, 5).map((emp) => (
                    <tr key={emp.employeeId} className="hover:bg-brand-100/20 dark:hover:bg-brand-900/20 transition-all">
                      <td className="px-4 py-3 text-indigo-600 font-bold">{emp.employeeId}</td>
                      <td className="px-4 py-3 text-brand-950 dark:text-white">{emp.firstName} {emp.lastName}</td>
                      <td className="px-4 py-3 text-brand-500">{emp.department}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-amber-500 font-extrabold mr-1">★</span>
                        <span className="text-brand-950 dark:text-white font-bold">{emp.rating.toFixed(1)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Today's Tasks Column */}
          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 space-y-6">
            <div>
              <h3 className="font-bold text-sm uppercase tracking-wider">Today's Tasks Dashboard</h3>
              <p className="text-[10px] text-brand-500 font-semibold mt-1">Deliverables status checks</p>
            </div>

            <div className="space-y-4">
              {/* Assigned Today */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Assigned Today ({(hrData.todayTasksAssigned || []).length})</h4>
                {(hrData.todayTasksAssigned || []).length === 0 ? (
                  <p className="text-[10px] text-brand-400 font-semibold italic pl-1">No tasks assigned today.</p>
                ) : (
                  (hrData.todayTasksAssigned || []).slice(0, 3).map((task) => (
                    <div key={task.id} className="p-3 bg-brand-100/50 dark:bg-brand-900/50 rounded-xl border border-brand-200 dark:border-brand-850">
                      <p className="font-bold text-xs text-brand-950 dark:text-white line-clamp-1">{task.title}</p>
                      <p className="text-[9px] text-brand-500 mt-1">Assignee: {task.employee?.firstName} {task.employee?.lastName} | Priority: {task.priority}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Completed Today */}
              <div className="space-y-2 pt-3 border-t border-brand-100 dark:border-brand-900">
                <h4 className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Completed Today ({(hrData.todayTasksCompleted || []).length})</h4>
                {(hrData.todayTasksCompleted || []).length === 0 ? (
                  <p className="text-[10px] text-brand-400 font-semibold italic pl-1">No tasks completed today.</p>
                ) : (
                  (hrData.todayTasksCompleted || []).slice(0, 3).map((task) => (
                    <div key={task.id} className="p-3 bg-emerald-500/10 dark:bg-emerald-950/20 rounded-xl border border-emerald-500/20 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-xs text-brand-950 dark:text-white line-clamp-1">{task.title}</p>
                        <p className="text-[9px] text-brand-500 mt-1">Completed by: {task.employee?.firstName} {task.employee?.lastName}</p>
                      </div>
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0 ml-2" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Charts & Graphs Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Department distribution */}
          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 lg:col-span-2">
            <h3 className="font-bold text-sm text-brand-950 dark:text-white mb-6 uppercase tracking-wider">Department Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hrData.charts.departmentData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} contentStyle={{ background: theme === 'dark' ? '#0f172a' : '#ffffff', borderRadius: '12px', border: 'none' }} />
                  <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Task Status Share */}
          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900">
            <h3 className="font-bold text-sm text-brand-950 dark:text-white mb-6 uppercase tracking-wider">Company Tasks</h3>
            <div className="h-64 flex flex-col justify-center items-center">
              <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                  <Pie
                    data={hrData.charts.taskStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {hrData.charts.taskStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: theme === 'dark' ? '#0f172a' : '#ffffff', borderRadius: '12px', border: 'none' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
                {hrData.charts.taskStatusData.map((d, i) => (
                  <div key={d.name} className="flex items-center space-x-1.5 text-[10px] font-bold">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-brand-500 uppercase">{d.name}: {d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Audit Log / Activity */}
        <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-sm text-brand-950 dark:text-white uppercase tracking-wider">System Activity Logs</h3>
            <span className="text-[10px] bg-brand-200 dark:bg-brand-900 px-3 py-1 rounded-full font-bold uppercase">System Feed</span>
          </div>
          <div className="space-y-4">
            {hrData.recentActivity.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-3.5 rounded-2xl hover:bg-brand-100/50 dark:hover:bg-brand-900/50 transition-all border-b border-brand-100 last:border-0 dark:border-brand-900">
                <div className="flex items-center space-x-3.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <div>
                    <p className="font-bold text-xs">{log.action}</p>
                    <p className="text-[11px] text-brand-500 mt-0.5">{log.details}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-indigo-600">
                    {log.employee ? `${log.employee.firstName} ${log.employee.lastName}` : 'System'}
                  </p>
                  <p className="text-[9px] text-brand-400 mt-0.5">{new Date(log.timestamp).toLocaleTimeString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    );
  }

  // --- EMPLOYEE / TL INTERFACE ---
  if (!empData) return <p>Failed to load employee metrics.</p>;
  const att = empData.todayAttendance;
  const isBreakActive = att?.breaks ? att.breaks.some((b) => !b.end) : false;

  return (
    <div className="space-y-8">
      
      {/* Attendance Check in/out panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Live Attendance Module */}
        <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-sm uppercase tracking-wider">Attendance Console</h3>
              <span className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase ${
                att ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
              }`}>
                {att ? (att.workFromHome ? 'WFH ACTIVE' : 'CHECKED IN') : 'NOT CHECKED IN'}
              </span>
            </div>
            
            <div className="space-y-3.5 mb-6 text-xs text-brand-600 dark:text-brand-400">
              <div className="flex items-center space-x-2.5">
                <Clock size={16} className="text-indigo-600" />
                <span className="font-semibold">Check In:</span>
                <span className="font-bold text-brand-900 dark:text-white">
                  {att?.checkIn ? new Date(att.checkIn).toLocaleTimeString() : '--:--'}
                </span>
              </div>
              <div className="flex items-center space-x-2.5">
                <Clock size={16} className="text-indigo-600" />
                <span className="font-semibold">Check Out:</span>
                <span className="font-bold text-brand-900 dark:text-white">
                  {att?.checkOut ? new Date(att.checkOut).toLocaleTimeString() : '--:--'}
                </span>
              </div>
              {isBreakActive && (
                <div className="flex items-center space-x-2.5 text-amber-500">
                  <Coffee size={16} />
                  <span className="font-semibold">On Break:</span>
                  <span className="font-extrabold animate-pulse">{breakTimer}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            {!att ? (
              <>
                <button
                  onClick={() => handleCheckIn(false)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl py-3 font-bold text-xs tracking-wider uppercase transition-all shadow-md"
                >
                  Office Check In
                </button>
                <button
                  onClick={() => handleCheckIn(true)}
                  className="bg-brand-200 hover:bg-brand-300 dark:bg-brand-900 dark:hover:bg-brand-800 text-brand-900 dark:text-white rounded-2xl py-3 font-bold text-xs tracking-wider uppercase transition-all"
                >
                  WFH Check In
                </button>
              </>
            ) : (
              <>
                {!att.checkOut && (
                  <button
                    onClick={handleCheckOut}
                    className="col-span-2 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl py-3 font-bold text-xs tracking-wider uppercase transition-all shadow-md"
                  >
                    Check Out
                  </button>
                )}
                {att.checkIn && !att.checkOut && (
                  <button
                    onClick={isBreakActive ? handleEndBreak : handleStartBreak}
                    className={`col-span-2 rounded-2xl py-2.5 font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center space-x-2 ${
                      isBreakActive
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-amber-500 hover:bg-amber-600 text-white'
                    }`}
                  >
                    {isBreakActive ? <Play size={14} /> : <Pause size={14} />}
                    <span>{isBreakActive ? 'End Break (Resume)' : 'Take Break'}</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Task summary */}
        <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md lg:col-span-2">
          <h3 className="font-bold text-sm uppercase tracking-wider mb-6">Assigned Tasks Overview</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-brand-100/50 dark:bg-brand-900/50 p-4 rounded-2xl text-center">
              <p className="text-2xl font-extrabold text-brand-950 dark:text-white">{empData.tasks.pending}</p>
              <p className="text-[10px] text-brand-500 font-bold uppercase mt-1">Pending</p>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-950/20 p-4 rounded-2xl text-center">
              <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">{empData.tasks.inProgress}</p>
              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase mt-1">In Progress</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-2xl text-center">
              <p className="text-2xl font-extrabold text-amber-500">{empData.tasks.review}</p>
              <p className="text-[10px] text-amber-500 font-bold uppercase mt-1">In Review</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-2xl text-center">
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{empData.tasks.completed}</p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase mt-1">Completed</p>
            </div>
          </div>
          <div className="mt-6 flex justify-between items-center text-xs">
            <span className="text-brand-500 font-semibold">Total assigned tasks to you: {empData.tasks.total}</span>
            <button onClick={() => navigate('/tasks')} className="text-indigo-600 hover:underline font-bold flex items-center space-x-1">
              <span>Go to Taskboard</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

      </div>

      {/* Leave balance grid & Recent payslips */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Leave balance */}
        <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md">
          <h3 className="font-bold text-sm uppercase tracking-wider mb-6">Leave Balances</h3>
          <div className="space-y-4">
            {Object.entries(empData.leaveBalances).map(([type, bal]) => (
              <div key={type} className="flex justify-between items-center p-3.5 bg-brand-100/50 dark:bg-brand-900/50 rounded-2xl">
                <div>
                  <p className="font-bold text-xs uppercase tracking-wide">{type}</p>
                  <p className="text-[10px] text-brand-500 font-semibold mt-0.5">Used: {bal.used} / {bal.limit} days</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400">{bal.available}</p>
                  <p className="text-[9px] text-brand-500 font-bold uppercase tracking-wider">Days Available</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payslips */}
        <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md">
          <h3 className="font-bold text-sm uppercase tracking-wider mb-6">Recent Payslips</h3>
          <div className="space-y-4">
            {empData.salaries.length === 0 ? (
              <p className="text-center py-8 text-xs text-brand-500">No payslips generated yet</p>
            ) : (
              empData.salaries.map((sal) => (
                <div key={sal.id} className="flex justify-between items-center p-3.5 bg-brand-100/50 dark:bg-brand-900/50 rounded-2xl">
                  <div>
                    <p className="font-bold text-xs">{sal.payslipNumber}</p>
                    <p className="text-[10px] text-brand-500 font-semibold mt-0.5">Month ID: {sal.month} | {sal.financialYear}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-bold text-emerald-600">INR {sal.netSalary.toFixed(2)}</span>
                    {sal.payslipPdfUrl && (
                      <a
                        href={sal.payslipPdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 bg-brand-200 hover:bg-brand-300 dark:bg-brand-800 dark:hover:bg-brand-700 text-brand-600 dark:text-white rounded-xl transition-all"
                        title="Download PDF"
                      >
                        <Download size={14} />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default Dashboard;
