import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, ComposedChart,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend
} from 'recharts';
import {
  Users, UserCheck, CalendarX, AlertCircle, FileSpreadsheet, Hourglass, Play,
  Pause, CheckCircle2, ChevronRight, Download, Eye, MapPin, Clock, Coffee,
  TrendingUp, TrendingDown, Award, Zap, Target, Crown, Medal, Trophy, Star,
  BarChart3, PieChart as PieChartIcon, LineChart as LineChartIcon, DollarSign,
  ShoppingBag, Wallet, PiggyBank, Briefcase, CalendarCheck, UserMinus, UserPlus,
  Activity, PieChart as PieIcon, Gauge, Rocket, Flame, CheckSquare, Bell
} from 'lucide-react';
import GoogleDriveCard from '../components/GoogleDriveCard';

const COLORS = ['#f97316', '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444'];
const CHART_COLORS = {
  primary: '#f97316',
  secondary: '#6366f1',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
  dark: '#1e293b',
};

interface WeightedRating {
  attendanceScore: number;
  taskScore: number;
  deadlineAccuracy: number;
  leaveBalanceScore: number;
  behaviorBonus: number;
  overallScore: number;
  tier: string;
  achievements: string[];
}

interface HRStats {
  counters: {
    totalEmployees: number;
    present: number;
    absent: number;
    late: number;
    wfh: number;
    remote: number;
    halfDay: number;
    onLeave: number;
    attendancePercentage: number;
    pendingLeaves: number;
    pendingTasks: number;
    payrollBudget: number;
  };
  todayTasks: {
    totalAssigned: number;
    totalCompleted: number;
    remaining: number;
    assignedList: any[];
    completedList: any[];
  };
  dailyProgress: {
    last7Days: Array<{ day: string; assigned: number; completed: number; completionPct: number }>;
    weeklyTrend: number;
    monthlyTrend: Array<{ month: string; completionPct: number; total: number }>;
  };
  employeeProductivity: {
    topPerformerToday: any;
    mostActiveEmployee: any;
    fastestTaskCompletion: any;
  };
  bestEmployee: any;
  leaderboard: any[];
  charts: {
    departmentData: Array<{ name: string; value: number }>;
    priorityData: Array<{ name: string; value: number }>;
    taskStatusData: Array<{ name: string; value: number }>;
    attendanceTrend: Array<{ date: string; present: number; late: number; wfh: number; absent: number; onLeave: number }>;
    taskTrend: Array<{ week: string; assigned: number; completed: number; inProgress: number }>;
    departmentPerformance: Array<{ name: string; headcount: number; completionRate: number; avgProgress: number; totalTasks: number }>;
    leaveTypeDistribution: Array<{ name: string; value: number }>;
    monthlyHiring: Array<{ month: string; hires: number }>;
    employeeGrowth: Array<{ month: string; total: number }>;
    payrollSummary: Array<{ month: string; salary: number; bonus: number; deductions: number; net: number }>;
  };
  financeOverview: {
    monthlyRevenue: number;
    monthlyExpenses: number;
    profit: number;
    pendingSalary: number;
    officeExpenses: number;
    netIncome: number;
    revenueVsExpenses: Array<{ month: string; revenue: number; expenses: number; profit: number }>;
    expenseBreakdown: Array<{ name: string; value: number }>;
  };
  recentActivity: any[];
  employeesList: any[];
  period: string;
}

interface EmployeeStats {
  todayAttendance: any;
  tasks: any;
  todayTasks: any;
  productivity: any;
  leaveBalances: any;
  salaries: any[];
  notifications: any[];
  rating: WeightedRating;
  timelineEvents: any[];
  charts: {
    taskTrend: Array<{ week: string; assigned: number; completed: number }>;
    last7Days: Array<{ day: string; attendance: string; assigned: number; completed: number; lateMinutes: number; overtimeMinutes: number }>;
  };
  period: string;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

const tierBadge = (tier: string) => {
  const colors: Record<string, string> = {
    GOLD: 'bg-amber-500/20 text-amber-600 border-amber-500/30',
    SILVER: 'bg-slate-300/30 text-slate-600 border-slate-400/30',
    BRONZE: 'bg-orange-600/20 text-orange-700 border-orange-600/30',
    NEEDS_IMPROVEMENT: 'bg-rose-500/15 text-rose-600 border-rose-500/30',
  };
  return colors[tier] || colors.BRONZE;
};

const ProgressRing: React.FC<{ value: number; size?: number; stroke?: number; color?: string; label?: string }> = ({
  value,
  size = 120,
  stroke = 10,
  color = CHART_COLORS.primary,
  label,
}) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(value, 100) / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          className="text-brand-200 dark:text-brand-800"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-extrabold text-brand-950 dark:text-white">{value}%</span>
        {label && <span className="text-[9px] font-bold text-brand-500 uppercase tracking-wider mt-0.5">{label}</span>}
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  trend?: { value: number; label?: string };
  badge?: { text: string; className: string };
  children?: React.ReactNode;
}> = ({ title, value, subtitle, icon, iconBg, iconColor, trend, badge, children }) => (
  <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md hover:shadow-lg transition-all duration-300">
    <div className="flex items-start justify-between mb-4">
      <div>
        <span className="text-[11px] font-bold text-brand-500 uppercase tracking-wider">{title}</span>
        {badge && (
          <div className={`mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${badge.className}`}>
            {badge.text}
          </div>
        )}
      </div>
      <div className={`p-3 rounded-2xl ${iconBg} ${iconColor}`}>{icon}</div>
    </div>
    <div className="space-y-1">
      <p className="text-3xl font-extrabold text-brand-950 dark:text-white tracking-tight">{value}</p>
      {subtitle && <p className="text-[10px] text-brand-500 font-bold">{subtitle}</p>}
      {trend && (
        <div className={`flex items-center space-x-1 mt-2 ${trend.value >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {trend.value >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span className="text-[10px] font-bold">
            {trend.value >= 0 ? '+' : ''}{trend.value}{trend.label || ' vs last period'}
          </span>
        </div>
      )}
    </div>
    {children}
  </div>
);

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [hrData, setHrData] = useState<HRStats | null>(null);
  const [empData, setEmpData] = useState<EmployeeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [breakTimer, setBreakTimer] = useState<string>('00:00');

  useEffect(() => {
    fetchStats();
  }, [user]);

  useEffect(() => {
    if (!empData?.todayAttendance?.breaks) return;
    const activeBreak = empData.todayAttendance.breaks.find((b: any) => !b.end);
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
      if (user?.role === 'SUPER_ADMIN' || user?.role === 'HR' || user?.role === 'TEAM_LEAD') {
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

  const handleCheckIn = async (wfh = false) => {
    try {
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

  // ========== HR / ADMIN INTERFACE ==========
  if (user?.role === 'SUPER_ADMIN' || user?.role === 'HR' || user?.role === 'TEAM_LEAD') {
    if (!hrData) return <p className="text-center py-12 text-brand-500">Failed to load administrative analytics.</p>;
    const c = hrData.counters;
    const t = hrData.todayTasks;
    const d = hrData.dailyProgress;
    const p = hrData.employeeProductivity;
    const ch = hrData.charts;
    const f = hrData.financeOverview;

    return (
      <div className="space-y-8 pb-8">
        {/* Top KPI Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Employees"
            value={c.totalEmployees}
            subtitle="OBI Infotech Node"
            icon={<Users size={20} />}
            iconBg="bg-indigo-50 dark:bg-indigo-950/40"
            iconColor="text-indigo-600"
            badge={{ text: 'ACTIVE', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-500/20' }}
          />
          <StatCard
            title="Present Today"
            value={c.present}
            subtitle={`WFH: ${c.wfh} | Remote: ${c.remote} | Late: ${c.late}`}
            icon={<UserCheck size={20} />}
            iconBg="bg-emerald-50 dark:bg-emerald-950/40"
            iconColor="text-emerald-600"
            badge={{ text: `${c.attendancePercentage}%`, className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-500/20' }}
          />
          <StatCard
            title="Pending Leaves"
            value={c.pendingLeaves}
            subtitle="Requires Approval"
            icon={<CalendarX size={20} />}
            iconBg="bg-amber-50 dark:bg-amber-950/40"
            iconColor="text-amber-600"
            badge={{ text: 'URGENT', className: c.pendingLeaves > 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-500/20' : 'bg-brand-100 text-brand-600 border-brand-300' }}
          />
          <StatCard
            title="Pending Tasks"
            value={c.pendingTasks}
            subtitle="In progress or review"
            icon={<AlertCircle size={20} />}
            iconBg="bg-rose-50 dark:bg-rose-950/40"
            iconColor="text-rose-600"
          />
        </div>

        {/* Best Employee Banner + Today's Tasks + Employee Productivity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Best Employee of the Month - Dynamic Banner */}
          {hrData.bestEmployee && (
            <div className="glass rounded-3xl p-6 border border-amber-400/30 shadow-xl lg:col-span-2 relative overflow-hidden bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent dark:from-orange-500/20 dark:via-amber-500/10">
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-400/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-orange-500/10 rounded-full blur-3xl" />

              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center space-x-5">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-amber-300 to-orange-500 p-0.5 shadow-lg">
                      <div className="w-full h-full rounded-[14px] overflow-hidden bg-white dark:bg-brand-950 flex items-center justify-center">
                        {hrData.bestEmployee.profileImageUrl ? (
                          <img src={hrData.bestEmployee.profileImageUrl} alt="Best" className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-black text-3xl bg-gradient-to-br from-amber-500 to-orange-600 bg-clip-text text-transparent">
                            {hrData.bestEmployee.firstName[0]}{hrData.bestEmployee.lastName[0]}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="absolute -top-2 -right-2 p-1.5 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl shadow-lg">
                      <Crown size={18} className="text-white" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-[10px] bg-gradient-to-r from-amber-400 to-orange-500 text-white px-3 py-1 rounded-full font-black tracking-wider uppercase shadow-md">
                        ★ Best Employee of the Month
                      </span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-extrabold uppercase border ${tierBadge(hrData.bestEmployee.tier)}`}>
                        {hrData.bestEmployee.tier.replace('_', ' ')}
                      </span>
                    </div>
                    <h3 className="text-2xl font-black text-brand-950 dark:text-white tracking-tight">
                      {hrData.bestEmployee.firstName} {hrData.bestEmployee.lastName}
                    </h3>
                    <p className="text-sm font-bold text-brand-600 dark:text-brand-400 mt-0.5">
                      {hrData.bestEmployee.designation} • {hrData.bestEmployee.department}
                      <span className="ml-2 text-amber-600">#{hrData.bestEmployee.rank}</span>
                    </p>
                    {hrData.bestEmployee.achievements?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {hrData.bestEmployee.achievements.slice(0, 4).map((a: string) => (
                          <span key={a} className="text-[9px] bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-400 px-2 py-0.5 rounded-lg font-bold border border-brand-200 dark:border-brand-800">
                            🏆 {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right md:text-left">
                  <div className="space-y-2">
                    <div>
                      <p className="text-[10px] font-bold text-brand-500 uppercase tracking-wider">Overall Score</p>
                      <p className="text-4xl font-black bg-gradient-to-br from-amber-500 to-orange-600 bg-clip-text text-transparent">
                        {hrData.bestEmployee.rating}/100
                      </p>
                    </div>
                    <div className="grid grid-cols-5 gap-1 max-w-[240px]">
                      {[
                        { label: 'ATT', val: hrData.bestEmployee.attendanceScore, max: 35 },
                        { label: 'TSK', val: hrData.bestEmployee.taskScore, max: 40 },
                        { label: 'DLN', val: hrData.bestEmployee.deadlineAccuracy, max: 10 },
                        { label: 'LEV', val: hrData.bestEmployee.leaveBalanceScore, max: 10 },
                        { label: 'BHV', val: hrData.bestEmployee.behaviorBonus, max: 5 },
                      ].map((s) => (
                        <div key={s.label} className="text-center">
                          <div className="w-full h-16 bg-brand-100 dark:bg-brand-900 rounded-lg relative overflow-hidden mb-1">
                            <div
                              className="absolute bottom-0 w-full bg-gradient-to-t from-amber-500 to-orange-400 rounded-t transition-all duration-500"
                              style={{ height: `${(s.val / s.max) * 100}%` }}
                            />
                          </div>
                          <p className="text-[8px] font-black text-brand-500 uppercase">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Today's Tasks Card */}
          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wider text-brand-950 dark:text-white">Today's Tasks</h3>
                <p className="text-[10px] text-brand-500 font-semibold mt-0.5">Deliverables Status</p>
              </div>
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl">
                <CheckSquare size={18} className="text-indigo-600" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-indigo-50 dark:bg-indigo-950/30 p-3 rounded-2xl text-center border border-indigo-500/20">
                <p className="text-2xl font-black text-indigo-600">{t.totalAssigned}</p>
                <p className="text-[9px] font-bold text-indigo-500 uppercase mt-0.5">Assigned</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-2xl text-center border border-emerald-500/20">
                <p className="text-2xl font-black text-emerald-600">{t.totalCompleted}</p>
                <p className="text-[9px] font-bold text-emerald-500 uppercase mt-0.5">Done</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-2xl text-center border border-amber-500/20">
                <p className="text-2xl font-black text-amber-600">{t.remaining}</p>
                <p className="text-[9px] font-bold text-amber-500 uppercase mt-0.5">Left</p>
              </div>
            </div>

            <div className="space-y-4 max-h-48 overflow-y-auto">
              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-wider flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  <span>Assigned ({t.assignedList.length})</span>
                </h4>
                {t.assignedList.slice(0, 3).map((task: any) => (
                  <div key={task.id} className="p-2.5 bg-brand-50 dark:bg-brand-900/60 rounded-xl border border-brand-200 dark:border-brand-800">
                    <p className="font-bold text-[11px] text-brand-950 dark:text-white line-clamp-1">{task.title}</p>
                    <p className="text-[9px] text-brand-500 mt-0.5 font-semibold">
                      {task.employee?.firstName} • {task.priority}
                    </p>
                  </div>
                ))}
                {t.assignedList.length === 0 && (
                  <p className="text-[10px] text-brand-400 italic pl-1">No assignments</p>
                )}
              </div>
              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-wider flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Completed ({t.completedList.length})</span>
                </h4>
                {t.completedList.slice(0, 3).map((task: any) => (
                  <div key={task.id} className="p-2.5 bg-emerald-500/10 dark:bg-emerald-950/20 rounded-xl border border-emerald-500/20 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="font-bold text-[11px] text-brand-950 dark:text-white line-clamp-1">{task.title}</p>
                      <p className="text-[9px] text-brand-500 mt-0.5 font-semibold">{task.employee?.firstName}</p>
                    </div>
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0 ml-2" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Daily Progress + Employee Productivity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Daily Progress with Charts */}
          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 lg:col-span-2 shadow-md">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wider text-brand-950 dark:text-white flex items-center space-x-2">
                  <Gauge size={16} className="text-orange-500" />
                  <span>Daily Progress</span>
                </h3>
                <p className="text-[10px] text-brand-500 font-semibold mt-0.5">Completion metrics & trends</p>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`flex items-center space-x-1 px-2.5 py-1 rounded-xl text-[10px] font-black border ${
                  d.weeklyTrend >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border-emerald-500/20' : 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 border-rose-500/20'
                }`}>
                  {d.weeklyTrend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  <span>Week: {d.weeklyTrend >= 0 ? '+' : ''}{d.weeklyTrend}%</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Weekly 7-day Area Chart */}
              <div>
                <h4 className="text-[11px] font-black text-brand-600 dark:text-brand-400 uppercase tracking-wider mb-3">Last 7 Days</h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={d.last7Days}>
                      <defs>
                        <linearGradient id="colorAssigned" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.secondary} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={CHART_COLORS.secondary} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                      <XAxis dataKey="day" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip
                        cursor={{ fill: 'rgba(249, 115, 22, 0.05)' }}
                        contentStyle={{
                          background: theme === 'dark' ? '#0f172a' : '#ffffff',
                          borderRadius: '12px',
                          border: 'none',
                          boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                          fontSize: '11px',
                        }}
                      />
                      <Area type="monotone" dataKey="assigned" stroke={CHART_COLORS.secondary} fillOpacity={1} fill="url(#colorAssigned)" strokeWidth={2} />
                      <Area type="monotone" dataKey="completed" stroke={CHART_COLORS.primary} fillOpacity={1} fill="url(#colorCompleted)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Monthly Line Chart with Progress Ring */}
              <div className="flex flex-col space-y-4">
                <h4 className="text-[11px] font-black text-brand-600 dark:text-brand-400 uppercase tracking-wider mb-0">Monthly Trend</h4>
                <div className="flex items-center space-x-4">
                  <ProgressRing
                    value={d.monthlyTrend[d.monthlyTrend.length - 1]?.completionPct || 0}
                    label="This Month"
                    size={100}
                    color={CHART_COLORS.primary}
                  />
                  <div className="flex-1 h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={d.monthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} vertical={false} />
                        <XAxis dataKey="month" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{
                            background: theme === 'dark' ? '#0f172a' : '#ffffff',
                            borderRadius: '12px',
                            border: 'none',
                            fontSize: '10px',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="completionPct"
                          stroke={CHART_COLORS.primary}
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: CHART_COLORS.primary }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                {/* Weekly Completion % bars */}
                <div className="space-y-1.5">
                  {d.last7Days.map((x: any) => (
                    <div key={x.day} className="flex items-center space-x-2">
                      <span className="text-[9px] font-bold text-brand-500 w-8 uppercase">{x.day}</span>
                      <div className="flex-1 h-2 bg-brand-100 dark:bg-brand-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-500"
                          style={{ width: `${x.completionPct}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-black text-brand-600 dark:text-brand-400 w-8 text-right">{x.completionPct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Employee Productivity */}
          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wider text-brand-950 dark:text-white flex items-center space-x-2">
                  <Rocket size={16} className="text-orange-500" />
                  <span>Employee Productivity</span>
                </h3>
              </div>
            </div>

            <div className="space-y-3.5">
              {/* Top Performer Today */}
              <div className="p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 rounded-2xl border border-amber-500/30">
                <div className="flex items-center space-x-1 mb-2">
                  <Trophy size={13} className="text-amber-500" />
                  <span className="text-[9px] font-black text-amber-600 uppercase tracking-wider">Top Performer Today</span>
                </div>
                {p.topPerformerToday ? (
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-300 to-orange-500 p-0.5">
                      <div className="w-full h-full rounded-[10px] overflow-hidden bg-white dark:bg-brand-950 flex items-center justify-center">
                        <span className="font-black text-xs">{p.topPerformerToday.firstName[0]}{p.topPerformerToday.lastName[0]}</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs text-brand-950 dark:text-white truncate">
                        {p.topPerformerToday.firstName} {p.topPerformerToday.lastName}
                      </p>
                      <p className="text-[9px] text-brand-500 font-semibold truncate">{p.topPerformerToday.department}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-amber-600">{p.topPerformerToday.completed}</p>
                      <p className="text-[8px] font-bold text-brand-500 uppercase">tasks</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-brand-400 italic">No completed tasks yet</p>
                )}
              </div>

              {/* Most Active Employee */}
              <div className="p-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20 rounded-2xl border border-emerald-500/30">
                <div className="flex items-center space-x-1 mb-2">
                  <Flame size={13} className="text-emerald-500" />
                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Most Active (Week)</span>
                </div>
                {p.mostActiveEmployee ? (
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-300 to-teal-500 p-0.5">
                      <div className="w-full h-full rounded-[10px] overflow-hidden bg-white dark:bg-brand-950 flex items-center justify-center">
                        <span className="font-black text-xs">{p.mostActiveEmployee.firstName[0]}{p.mostActiveEmployee.lastName[0]}</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs text-brand-950 dark:text-white truncate">
                        {p.mostActiveEmployee.firstName} {p.mostActiveEmployee.lastName}
                      </p>
                      <p className="text-[9px] text-brand-500 font-semibold truncate">{p.mostActiveEmployee.department}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-emerald-600">{p.mostActiveEmployee.daysActive}</p>
                      <p className="text-[8px] font-bold text-brand-500 uppercase">days</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-brand-400 italic">No data yet</p>
                )}
              </div>

              {/* Fastest Task Completion */}
              <div className="p-4 bg-gradient-to-r from-indigo-500/10 to-violet-500/10 dark:from-indigo-500/20 dark:to-violet-500/20 rounded-2xl border border-indigo-500/30">
                <div className="flex items-center space-x-1 mb-2">
                  <Zap size={13} className="text-indigo-500" />
                  <span className="text-[9px] font-black text-indigo-600 uppercase tracking-wider">Fastest Completion</span>
                </div>
                {p.fastestTaskCompletion ? (
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-300 to-violet-500 p-0.5">
                      <div className="w-full h-full rounded-[10px] overflow-hidden bg-white dark:bg-brand-950 flex items-center justify-center">
                        <span className="font-black text-xs">{p.fastestTaskCompletion.firstName[0]}{p.fastestTaskCompletion.lastName[0]}</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs text-brand-950 dark:text-white truncate">
                        {p.fastestTaskCompletion.firstName} {p.fastestTaskCompletion.lastName}
                      </p>
                      <p className="text-[9px] text-brand-500 font-semibold truncate">{p.fastestTaskCompletion.department}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-indigo-600">{p.fastestTaskCompletion.avgHours}<span className="text-xs font-bold">h</span></p>
                      <p className="text-[8px] font-bold text-brand-500 uppercase">avg</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-brand-400 italic">No data yet</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Leaderboard + Onboarded Directory */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Onboarded Staff Directory */}
          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 lg:col-span-2 space-y-5 shadow-md">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wider text-brand-950 dark:text-white">Onboarded Staff Directory</h3>
                <p className="text-[10px] text-brand-500 font-semibold mt-0.5">Active list with ratings</p>
              </div>
              <button
                onClick={() => navigate('/employees')}
                className="text-[10px] text-indigo-600 hover:underline font-black flex items-center space-x-1"
              >
                <span>View All</span>
                <ChevronRight size={12} />
              </button>
            </div>
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="text-[10px] font-black text-brand-500 uppercase border-b border-brand-200 dark:border-brand-800">
                    <th className="px-3 py-2.5 whitespace-nowrap">Rank</th>
                    <th className="px-3 py-2.5 whitespace-nowrap">Employee</th>
                    <th className="px-3 py-2.5 whitespace-nowrap">Department</th>
                    <th className="px-3 py-2.5 whitespace-nowrap">Tier</th>
                    <th className="px-3 py-2.5 whitespace-nowrap text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100 dark:divide-brand-800">
                  {hrData.leaderboard.slice(0, 8).map((emp: any, idx: number) => (
                    <tr key={emp.employeeId} className="hover:bg-brand-50 dark:hover:bg-brand-900/50 transition-all">
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-[10px] ${
                          idx === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white' :
                          idx === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' :
                          idx === 2 ? 'bg-gradient-to-br from-orange-600 to-amber-700 text-white' :
                          'bg-brand-100 dark:bg-brand-800 text-brand-600 dark:text-brand-400'
                        }`}>
                          {idx === 0 ? '👑' : idx + 1}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-950 dark:to-violet-950 flex items-center justify-center border border-indigo-500/20">
                            <span className="font-black text-[10px] text-indigo-600">{emp.firstName[0]}{emp.lastName[0]}</span>
                          </div>
                          <div>
                            <p className="font-bold text-brand-950 dark:text-white text-[11px]">{emp.firstName} {emp.lastName}</p>
                            <p className="text-[9px] text-brand-500 font-semibold">{emp.designation}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-[11px] text-brand-600 dark:text-brand-400 font-semibold">{emp.department}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase border ${tierBadge(emp.tier)}`}>
                          {emp.tier.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <Star size={10} className="text-amber-500 fill-amber-500" />
                          <span className="font-black text-brand-950 dark:text-white text-sm">{emp.rating}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Company Tasks Pie + Priority Bar */}
          <div className="space-y-6">
            <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md">
              <h3 className="font-bold text-sm text-brand-950 dark:text-white mb-4 uppercase tracking-wider">Company Tasks</h3>
              <div className="h-48 flex flex-col justify-center items-center">
                <ResponsiveContainer width="100%" height="85%">
                  <PieChart>
                    <Pie
                      data={ch.taskStatusData.filter(d => d.value > 0)}
                      cx="50%" cy="50%" innerRadius={45} outerRadius={65}
                      paddingAngle={4} dataKey="value"
                    >
                      {ch.taskStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{
                      background: theme === 'dark' ? '#0f172a' : '#ffffff',
                      borderRadius: '12px', border: 'none', fontSize: '11px',
                    }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-1">
                  {ch.taskStatusData.slice(0, 4).map((d, i) => (
                    <div key={d.name} className="flex items-center space-x-1 text-[9px] font-black">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-brand-500 uppercase">{d.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md">
              <h3 className="font-bold text-sm text-brand-950 dark:text-white mb-4 uppercase tracking-wider">Priority Distribution</h3>
              <div className="space-y-3">
                {ch.priorityData.map((p: any) => {
                  const total = ch.priorityData.reduce((s: number, x: any) => s + x.value, 0) || 1;
                  const pct = Math.round((p.value / total) * 100);
                  const colors: Record<string, string> = {
                    LOW: 'bg-emerald-500',
                    MEDIUM: 'bg-amber-500',
                    HIGH: 'bg-orange-500',
                    CRITICAL: 'bg-rose-600',
                  };
                  return (
                    <div key={p.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase">{p.name}</span>
                        <span className="text-[10px] font-black text-brand-950 dark:text-white">{p.value} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-brand-100 dark:bg-brand-900 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${colors[p.name] || 'bg-indigo-500'} transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section: Attendance Trend, Task Completion Trend */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-sm uppercase tracking-wider text-brand-950 dark:text-white flex items-center space-x-2">
                <BarChart3 size={16} className="text-orange-500" />
                <span>Attendance Trend (30 Days)</span>
              </h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ch.attendanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} interval={3} />
                  <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: theme === 'dark' ? '#0f172a' : '#ffffff',
                      borderRadius: '12px', border: 'none', fontSize: '11px',
                      boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Bar dataKey="present" name="Present" stackId="a" fill={CHART_COLORS.success} radius={[4, 4, 0, 0]} barSize={16} />
                  <Bar dataKey="late" name="Late" stackId="a" fill={CHART_COLORS.warning} barSize={16} />
                  <Bar dataKey="wfh" name="WFH/Remote" stackId="a" fill={CHART_COLORS.info} barSize={16} />
                  <Bar dataKey="absent" name="Absent" stackId="b" fill={CHART_COLORS.danger} radius={[4, 4, 0, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-sm uppercase tracking-wider text-brand-950 dark:text-white flex items-center space-x-2">
                <LineChartIcon size={16} className="text-orange-500" />
                <span>Task Completion Trend (12 Weeks)</span>
              </h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={ch.taskTrend}>
                  <defs>
                    <linearGradient id="colorDone" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                  <XAxis dataKey="week" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: theme === 'dark' ? '#0f172a' : '#ffffff', borderRadius: '12px', border: 'none', fontSize: '11px' }} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Area type="monotone" dataKey="completed" name="Completed" fill="url(#colorDone)" stroke={CHART_COLORS.primary} strokeWidth={2} />
                  <Bar dataKey="assigned" name="Assigned" fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} barSize={18} opacity={0.7} />
                  <Line type="monotone" dataKey="inProgress" name="In Progress" stroke={CHART_COLORS.warning} strokeWidth={2.5} dot={{ r: 2.5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Department Performance + Leave Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md">
            <h3 className="font-bold text-sm uppercase tracking-wider text-brand-950 dark:text-white mb-5 flex items-center space-x-2">
              <Briefcase size={16} className="text-orange-500" />
              <span>Department Performance</span>
            </h3>
            <div className="space-y-4">
              {ch.departmentPerformance.map((dept: any) => (
                <div key={dept.name} className="p-3 bg-brand-50 dark:bg-brand-900/40 rounded-2xl border border-brand-200 dark:border-brand-800">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-xs text-brand-950 dark:text-white">{dept.name}</p>
                      <p className="text-[9px] text-brand-500 font-semibold">{dept.headcount} people • {dept.totalTasks} tasks</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-sm text-brand-950 dark:text-white">{dept.completionRate}%</p>
                      <p className="text-[9px] text-emerald-600 font-bold">Complete</p>
                    </div>
                  </div>
                  <div className="h-2 bg-brand-100 dark:bg-brand-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-amber-300 rounded-full transition-all"
                      style={{ width: `${dept.completionRate}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-[9px] font-bold text-brand-500">Avg Progress: <span className="text-brand-700 dark:text-brand-300">{dept.avgProgress}%</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md">
            <h3 className="font-bold text-sm uppercase tracking-wider text-brand-950 dark:text-white mb-5 flex items-center space-x-2">
              <PieIcon size={16} className="text-orange-500" />
              <span>Leave Distribution</span>
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ch.leaveTypeDistribution}
                      cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                      paddingAngle={3} dataKey="value"
                    >
                      {ch.leaveTypeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: theme === 'dark' ? '#0f172a' : '#ffffff', borderRadius: '12px', border: 'none', fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col justify-center space-y-2">
                {ch.leaveTypeDistribution.map((d: any, i: number) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400">{d.name}</span>
                    </div>
                    <span className="text-[10px] font-black text-brand-950 dark:text-white">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Hiring + Employee Growth */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-sm uppercase tracking-wider text-brand-950 dark:text-white flex items-center space-x-2">
                <UserPlus size={16} className="text-orange-500" />
                <span>Monthly Hiring</span>
              </h3>
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 px-3 py-1 rounded-full font-black border border-emerald-500/20">
                +{ch.monthlyHiring.reduce((s, m) => s + m.hires, 0)} this year
              </span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ch.monthlyHiring}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: theme === 'dark' ? '#0f172a' : '#ffffff', borderRadius: '12px', border: 'none', fontSize: '11px' }} />
                  <Bar dataKey="hires" name="Hires" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} barSize={28}>
                    {ch.monthlyHiring.map((entry, index) => (
                      <Cell key={`c-${index}`} fill={entry.hires > 0 ? CHART_COLORS.primary : '#cbd5e1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-sm uppercase tracking-wider text-brand-950 dark:text-white flex items-center space-x-2">
                <Users size={16} className="text-orange-500" />
                <span>Employee Growth</span>
              </h3>
              <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950/30 text-indigo-600 px-3 py-1 rounded-full font-black border border-indigo-500/20">
                Total: {c.totalEmployees}
              </span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ch.employeeGrowth}>
                  <defs>
                    <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: theme === 'dark' ? '#0f172a' : '#ffffff', borderRadius: '12px', border: 'none', fontSize: '11px' }} />
                  <Area type="monotone" dataKey="total" name="Total Headcount" stroke={CHART_COLORS.primary} strokeWidth={3} fill="url(#colorGrowth)" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Finance Overview */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-xl text-brand-950 dark:text-white uppercase tracking-tight flex items-center space-x-3">
              <div className="w-1.5 h-8 rounded-full bg-gradient-to-b from-orange-500 to-amber-400" />
              <span>Finance Overview</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard
              title="Monthly Revenue"
              value={formatCurrency(f.monthlyRevenue)}
              subtitle="Projected income"
              icon={<DollarSign size={20} />}
              iconBg="bg-emerald-50 dark:bg-emerald-950/40"
              iconColor="text-emerald-600"
              trend={{ value: 12.5 }}
            />
            <StatCard
              title="Monthly Expenses"
              value={formatCurrency(f.monthlyExpenses)}
              subtitle="All costs combined"
              icon={<ShoppingBag size={20} />}
              iconBg="bg-rose-50 dark:bg-rose-950/40"
              iconColor="text-rose-600"
              trend={{ value: -3.2 }}
            />
            <StatCard
              title="Net Profit"
              value={formatCurrency(f.profit)}
              subtitle="Revenue minus costs"
              icon={<PiggyBank size={20} />}
              iconBg="bg-amber-50 dark:bg-amber-950/40"
              iconColor="text-amber-600"
              badge={{ text: `${Math.round((f.profit / f.monthlyRevenue) * 100)}% margin`, className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-500/20' }}
            />
            <StatCard
              title="Pending Salary"
              value={formatCurrency(f.pendingSalary)}
              subtitle="Yet to be disbursed"
              icon={<Wallet size={20} />}
              iconBg="bg-violet-50 dark:bg-violet-950/40"
              iconColor="text-violet-600"
            />
            <StatCard
              title="Office Expenses"
              value={formatCurrency(f.officeExpenses)}
              subtitle="Rent, utilities, ops"
              icon={<Briefcase size={20} />}
              iconBg="bg-cyan-50 dark:bg-cyan-950/40"
              iconColor="text-cyan-600"
            />
            <StatCard
              title="Net Income"
              value={formatCurrency(f.netIncome)}
              subtitle="After deductions"
              icon={<DollarSign size={20} />}
              iconBg="bg-teal-50 dark:bg-teal-950/40"
              iconColor="text-teal-600"
              badge={{ text: 'TAX ADJUSTED', className: 'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400 border-teal-500/20' }}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue vs Expenses */}
            <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 lg:col-span-2 shadow-md">
              <h3 className="font-bold text-sm uppercase tracking-wider text-brand-950 dark:text-white mb-5">Revenue vs Expenses (6 Months)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={f.revenueVsExpenses}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.success} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_COLORS.success} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`} />
                    <Tooltip
                      formatter={(val: any) => formatCurrency(val)}
                      contentStyle={{ background: theme === 'dark' ? '#0f172a' : '#ffffff', borderRadius: '12px', border: 'none', fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS.success} radius={[6, 6, 0, 0]} barSize={22} />
                    <Bar dataKey="expenses" name="Expenses" fill={CHART_COLORS.danger} radius={[6, 6, 0, 0]} barSize={22} />
                    <Line type="monotone" dataKey="profit" name="Profit" stroke={CHART_COLORS.primary} strokeWidth={3} dot={{ r: 4, fill: CHART_COLORS.primary }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Expense Breakdown */}
            <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md">
              <h3 className="font-bold text-sm uppercase tracking-wider text-brand-950 dark:text-white mb-5">Expense Breakdown</h3>
              <div className="h-52 mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={f.expenseBreakdown}
                      cx="50%" cy="50%" innerRadius={40} outerRadius={72}
                      paddingAngle={3} dataKey="value"
                    >
                      {f.expenseBreakdown.map((entry, index) => (
                        <Cell key={`ec-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => formatCurrency(val)}
                      contentStyle={{ background: theme === 'dark' ? '#0f172a' : '#ffffff', borderRadius: '12px', border: 'none', fontSize: '10px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5">
                {f.expenseBreakdown.map((e: any, i: number) => (
                  <div key={e.name} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="font-bold text-brand-600 dark:text-brand-400">{e.name}</span>
                    </div>
                    <span className="font-black text-brand-950 dark:text-white">{formatCurrency(e.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Payroll Summary */}
          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md">
            <h3 className="font-bold text-sm uppercase tracking-wider text-brand-950 dark:text-white mb-5 flex items-center space-x-2">
              <FileSpreadsheet size={16} className="text-orange-500" />
              <span>Payroll Summary (6 Months)</span>
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ch.payrollSummary}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`} />
                  <Tooltip
                    formatter={(val: any) => formatCurrency(val)}
                    contentStyle={{ background: theme === 'dark' ? '#0f172a' : '#ffffff', borderRadius: '12px', border: 'none', fontSize: '11px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Bar dataKey="salary" name="Base Salary" stackId="a" fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} barSize={32} />
                  <Bar dataKey="bonus" name="Bonus" stackId="a" fill={CHART_COLORS.warning} barSize={32} />
                  <Bar dataKey="deductions" name="Deductions" stackId="b" fill={CHART_COLORS.danger} radius={[4, 4, 0, 0]} barSize={32} />
                  <Bar dataKey="net" name="Net Pay" stackId="c" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Activity Log */}
        <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md">
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-bold text-sm text-brand-950 dark:text-white uppercase tracking-wider flex items-center space-x-2">
              <Activity size={16} className="text-orange-500" />
              <span>System Activity Logs</span>
            </h3>
            <span className="text-[10px] bg-brand-100 dark:bg-brand-900 px-3 py-1 rounded-full font-black uppercase text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
              Live Feed
            </span>
          </div>
          <div className="space-y-2">
            {hrData.recentActivity.map((log: any) => (
              <div key={log.id} className="flex items-center justify-between p-4 rounded-2xl hover:bg-brand-50 dark:hover:bg-brand-900/50 transition-all border-b border-brand-100 last:border-0 dark:border-brand-800">
                <div className="flex items-center space-x-4">
                  <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-orange-500 to-amber-400 shadow-md shadow-orange-500/30" />
                  <div>
                    <p className="font-bold text-xs text-brand-950 dark:text-white">{log.action}</p>
                    <p className="text-[11px] text-brand-500 mt-0.5 font-semibold">{log.details}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-indigo-600">
                    {log.employee ? `${log.employee.firstName} ${log.employee.lastName}` : 'System'}
                  </p>
                  <p className="text-[9px] text-brand-400 mt-0.5 font-semibold">{new Date(log.timestamp).toLocaleTimeString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ========== EMPLOYEE INTERFACE ==========
  if (!empData) return <p className="text-center py-12 text-brand-500">Failed to load employee metrics.</p>;
  const att = empData.todayAttendance;
  const tasks = empData.tasks;
  const rating = empData.rating;
  const isBreakActive = att?.breaks ? att.breaks.some((b: any) => !b.end) : false;

  return (
    <div className="space-y-8 pb-8">
      {/* Attendance Console + Tasks Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Console */}
        <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md flex flex-col">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-sm uppercase tracking-wider text-brand-950 dark:text-white flex items-center space-x-2">
                <CalendarCheck size={16} className="text-orange-500" />
                <span>Attendance Console</span>
              </h3>
              <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase border ${
                att ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-500/30' :
                'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-500/30'
              }`}>
                {att ? (att.workFromHome ? 'WFH ACTIVE' : 'CHECKED IN') : 'NOT CHECKED IN'}
              </span>
            </div>

            <div className="space-y-3 text-xs text-brand-600 dark:text-brand-400">
              <div className="flex items-center space-x-2.5 p-3 bg-brand-50 dark:bg-brand-900/50 rounded-xl border border-brand-100 dark:border-brand-800">
                <Clock size={16} className="text-indigo-600 shrink-0" />
                <span className="font-bold shrink-0">Check In:</span>
                <span className="font-black text-brand-950 dark:text-white">
                  {att?.checkIn ? new Date(att.checkIn).toLocaleTimeString() : '--:--'}
                </span>
              </div>
              <div className="flex items-center space-x-2.5 p-3 bg-brand-50 dark:bg-brand-900/50 rounded-xl border border-brand-100 dark:border-brand-800">
                <Clock size={16} className="text-indigo-600 shrink-0" />
                <span className="font-bold shrink-0">Check Out:</span>
                <span className="font-black text-brand-950 dark:text-white">
                  {att?.checkOut ? new Date(att.checkOut).toLocaleTimeString() : '--:--'}
                </span>
              </div>
              {isBreakActive && (
                <div className="flex items-center space-x-2.5 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-500/30 text-amber-600">
                  <Coffee size={16} className="shrink-0 animate-bounce" />
                  <span className="font-bold shrink-0">On Break:</span>
                  <span className="font-black text-xl animate-pulse">{breakTimer}</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-auto grid grid-cols-2 gap-3">
            {!att ? (
              <>
                <button onClick={() => handleCheckIn(false)} className="bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-2xl py-3.5 font-black text-[11px] tracking-wider uppercase transition-all shadow-lg shadow-orange-500/30">
                  Office Check In
                </button>
                <button onClick={() => handleCheckIn(true)} className="bg-brand-200 hover:bg-brand-300 dark:bg-brand-800 dark:hover:bg-brand-700 text-brand-900 dark:text-white rounded-2xl py-3.5 font-black text-[11px] tracking-wider uppercase transition-all border border-brand-300 dark:border-brand-700">
                  WFH Check In
                </button>
              </>
            ) : (
              <>
                {!att.checkOut && (
                  <button onClick={handleCheckOut} className="col-span-2 bg-gradient-to-br from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white rounded-2xl py-3.5 font-black text-[11px] tracking-wider uppercase transition-all shadow-lg shadow-rose-500/30">
                    Check Out
                  </button>
                )}
                {att.checkIn && !att.checkOut && (
                  <button
                    onClick={isBreakActive ? handleEndBreak : handleStartBreak}
                    className={`col-span-2 rounded-2xl py-3 font-black text-[11px] tracking-wider uppercase transition-all flex items-center justify-center space-x-2 shadow-md ${
                      isBreakActive
                        ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white'
                        : 'bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white'
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

        {/* Tasks Overview */}
        <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 lg:col-span-2 shadow-md">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="font-bold text-sm uppercase tracking-wider text-brand-950 dark:text-white flex items-center space-x-2">
                <Target size={16} className="text-orange-500" />
                <span>Assigned Tasks Overview</span>
              </h3>
              <p className="text-[10px] text-brand-500 font-semibold mt-1">
                Completion: <span className="font-black text-orange-500">{empData.productivity.completionPct}%</span>
              </p>
            </div>
            <ProgressRing value={empData.productivity.completionPct} size={80} stroke={8} label="Done" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
            <div className="bg-brand-100/50 dark:bg-brand-900/50 p-3.5 rounded-2xl text-center border border-brand-200 dark:border-brand-800">
              <p className="text-2xl font-black text-brand-950 dark:text-white">{tasks.pending}</p>
              <p className="text-[9px] text-brand-500 font-black uppercase mt-0.5">Pending</p>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-950/30 p-3.5 rounded-2xl text-center border border-indigo-500/20">
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{tasks.inProgress}</p>
              <p className="text-[9px] text-indigo-600 font-black uppercase mt-0.5">In Progress</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/30 p-3.5 rounded-2xl text-center border border-amber-500/20">
              <p className="text-2xl font-black text-amber-500">{tasks.review}</p>
              <p className="text-[9px] text-amber-500 font-black uppercase mt-0.5">In Review</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3.5 rounded-2xl text-center border border-emerald-500/20">
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{tasks.completed}</p>
              <p className="text-[9px] text-emerald-600 font-black uppercase mt-0.5">Completed</p>
            </div>
            <div className="bg-rose-50 dark:bg-rose-950/30 p-3.5 rounded-2xl text-center border border-rose-500/20 col-span-2 sm:col-span-1">
              <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{tasks.overdue}</p>
              <p className="text-[9px] text-rose-600 font-black uppercase mt-0.5">Overdue</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-2xl border border-amber-500/20">
              <div className="flex items-center space-x-1.5 mb-2">
                <Flame size={12} className="text-orange-500" />
                <span className="text-[9px] font-black text-orange-600 uppercase">High/Critical Priority</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <div className="text-center">
                    <p className="text-xl font-black text-rose-600">{tasks.critical}</p>
                    <p className="text-[8px] font-bold text-brand-500 uppercase">Critical</p>
                  </div>
                  <div className="w-px h-8 bg-amber-400/30" />
                  <div className="text-center">
                    <p className="text-xl font-black text-orange-600">{tasks.high}</p>
                    <p className="text-[8px] font-bold text-brand-500 uppercase">High</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 rounded-2xl border border-emerald-500/20">
              <div className="flex items-center space-x-1.5 mb-2">
                <Zap size={12} className="text-emerald-500" />
                <span className="text-[9px] font-black text-emerald-600 uppercase">Today's Progress</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-black text-lg text-brand-950 dark:text-white">
                    {empData.todayTasks.completedCount}/{empData.todayTasks.assignedCount}
                  </p>
                  <p className="text-[8px] font-bold text-brand-500 uppercase">Completed / Assigned</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-emerald-600">{empData.todayTasks.remaining}</p>
                  <p className="text-[8px] font-bold text-brand-500 uppercase">Remaining</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex justify-between items-center text-xs">
            <span className="text-brand-500 font-semibold">Total assigned tasks to you: <span className="font-black text-brand-950 dark:text-white">{tasks.total}</span></span>
            <button onClick={() => navigate('/tasks')} className="text-orange-600 hover:underline font-black flex items-center space-x-1">
              <span>Go to Taskboard</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Google Drive Storage (admin only) */}
      {['SUPER_ADMIN', 'HR'].includes(user?.role || '') && <GoogleDriveCard />}

      {/* Rating Card + Weekly Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Personal Rating Card */}
        <div className="glass rounded-3xl p-6 border border-amber-400/30 shadow-lg relative overflow-hidden bg-gradient-to-br from-orange-50/50 via-amber-50/30 to-transparent dark:from-orange-950/20 dark:via-amber-950/10">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-gradient-to-br from-amber-400/20 to-orange-500/20 rounded-full blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm uppercase tracking-wider text-brand-950 dark:text-white">Your Performance</h3>
              <span className={`text-[9px] px-2.5 py-1 rounded-full font-black uppercase border ${tierBadge(rating.tier)}`}>
                {rating.tier.replace('_', ' ')}
              </span>
            </div>

            <div className="flex items-center justify-center my-5">
              <div className="relative">
                <ProgressRing value={rating.overallScore} size={140} stroke={12} color={CHART_COLORS.primary} label="Overall" />
              </div>
            </div>

            <div className="grid grid-cols-5 gap-1 mb-4">
              {[
                { label: 'ATT', val: rating.attendanceScore, max: 35, color: 'from-emerald-400 to-emerald-600' },
                { label: 'TSK', val: rating.taskScore, max: 40, color: 'from-indigo-400 to-indigo-600' },
                { label: 'DLN', val: rating.deadlineAccuracy, max: 10, color: 'from-cyan-400 to-cyan-600' },
                { label: 'LEV', val: rating.leaveBalanceScore, max: 10, color: 'from-violet-400 to-violet-600' },
                { label: 'BHV', val: rating.behaviorBonus, max: 5, color: 'from-amber-400 to-amber-600' },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className="w-full h-20 bg-brand-100 dark:bg-brand-900 rounded-xl relative overflow-hidden mb-1">
                    <div
                      className={`absolute bottom-0 w-full bg-gradient-to-t ${s.color} rounded-t transition-all duration-500`}
                      style={{ height: `${(s.val / s.max) * 100}%` }}
                    />
                  </div>
                  <p className="text-[8px] font-black text-brand-500 uppercase">{s.label}</p>
                  <p className="text-[9px] font-black text-brand-950 dark:text-white">{s.val}</p>
                </div>
              ))}
            </div>

            {rating.achievements?.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-brand-500 uppercase mb-2 tracking-wider">Achievements</p>
                <div className="flex flex-wrap gap-1.5">
                  {rating.achievements.map((a: string) => (
                    <span key={a} className="text-[9px] bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-950/40 dark:to-orange-950/40 text-brand-800 dark:text-brand-300 px-2 py-0.5 rounded-lg font-black border border-amber-500/30 flex items-center space-x-0.5">
                      <Award size={9} className="text-amber-500" />
                      <span>{a}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Weekly Task Trend + Daily Activity */}
        <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 lg:col-span-2 shadow-md">
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-bold text-sm uppercase tracking-wider text-brand-950 dark:text-white flex items-center space-x-2">
              <TrendingUp size={16} className="text-orange-500" />
              <span>Weekly Performance</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-[10px] font-black text-brand-600 dark:text-brand-400 uppercase tracking-wider mb-3">6-Week Trend</h4>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={empData.charts.taskTrend}>
                    <defs>
                      <linearGradient id="empComp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} vertical={false} />
                    <XAxis dataKey="week" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: theme === 'dark' ? '#0f172a' : '#ffffff', borderRadius: '12px', border: 'none', fontSize: '10px' }} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Bar dataKey="assigned" name="Assigned" fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} barSize={18} opacity={0.8} />
                    <Area type="monotone" dataKey="completed" name="Completed" fill="url(#empComp)" stroke={CHART_COLORS.primary} strokeWidth={2.5} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h4 className="text-[10px] font-black text-brand-600 dark:text-brand-400 uppercase tracking-wider mb-3">Last 7 Days Activity</h4>
              <div className="space-y-1.5">
                {empData.charts.last7Days.map((d: any) => (
                  <div key={d.day} className="flex items-center space-x-2 p-1.5 rounded-xl hover:bg-brand-50 dark:hover:bg-brand-900/50 transition-all">
                    <span className={`text-[9px] font-black w-7 uppercase ${
                      d.attendance === 'PRESENT' || d.attendance === 'WORK_FROM_HOME' ? 'text-emerald-600' :
                      d.attendance === 'LATE' ? 'text-amber-600' :
                      d.attendance === 'ABSENT' ? 'text-rose-600' : 'text-brand-500'
                    }`}>{d.day}</span>
                    <div className="flex-1 h-2 bg-brand-100 dark:bg-brand-900 rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-indigo-500 transition-all"
                        style={{ width: `${Math.min(100, (d.assigned / Math.max(d.assigned, 1)) * 100)}%` }}
                      />
                      <div
                        className="h-full bg-emerald-500 -ml-full transition-all"
                        style={{ width: `${Math.min(100, (d.completed / Math.max(d.assigned, 1)) * 100)}%` }}
                      />
                    </div>
                    <div className="text-right w-10 shrink-0">
                      <p className="text-[8px] font-black text-emerald-600">{d.completed}/{d.assigned}</p>
                      {(d.lateMinutes > 0 || d.overtimeMinutes > 0) && (
                        <p className={`text-[7px] font-bold ${d.lateMinutes > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {d.lateMinutes > 0 ? `${d.lateMinutes}m late` : `+${d.overtimeMinutes}m OT`}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Upcoming deadlines */}
          {empData.productivity.upcomingDeadlines?.length > 0 && (
            <div className="mt-5 p-4 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 rounded-2xl border border-indigo-500/20">
              <div className="flex items-center space-x-1.5 mb-3">
                <Hourglass size={13} className="text-indigo-500" />
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">Upcoming Deadlines</span>
              </div>
              <div className="space-y-2">
                {empData.productivity.upcomingDeadlines.slice(0, 3).map((t: any, i: number) => {
                  const daysLeft = Math.ceil((new Date(t.dueDate).getTime() - Date.now()) / (1000 * 3600 * 24));
                  return (
                    <div key={i} className="flex items-center justify-between p-2 bg-white dark:bg-brand-950 rounded-xl border border-brand-100 dark:border-brand-800">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-[11px] text-brand-950 dark:text-white truncate">{t.title}</p>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                            t.priority === 'CRITICAL' ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400' :
                            t.priority === 'HIGH' ? 'bg-orange-100 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400' :
                            t.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400' :
                            'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400'
                          }`}>{t.priority}</span>
                          <span className="text-[8px] font-bold text-brand-500">Progress {t.progress}%</span>
                        </div>
                      </div>
                      <div className="text-right ml-3 shrink-0">
                        <p className={`text-lg font-black ${daysLeft <= 1 ? 'text-rose-600 animate-pulse' : daysLeft <= 3 ? 'text-amber-600' : 'text-brand-950 dark:text-white'}`}>
                          {daysLeft <= 0 ? 'DUE' : daysLeft}
                        </p>
                        <p className="text-[7px] font-bold text-brand-500 uppercase">{daysLeft <= 0 ? 'TODAY' : daysLeft === 1 ? 'DAY' : 'DAYS'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Leave Balances + Payslips */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md">
          <h3 className="font-bold text-sm uppercase tracking-wider text-brand-950 dark:text-white mb-5 flex items-center space-x-2">
            <CalendarX size={16} className="text-orange-500" />
            <span>Leave Balances</span>
          </h3>
          <div className="space-y-3">
            {Object.entries(empData.leaveBalances).map(([type, bal]: [string, any]) => {
              const pct = bal.limit > 0 ? Math.round(((bal.limit - bal.available) / bal.limit) * 100) : 0;
              const leaveColors: Record<string, string> = {
                CASUAL: 'from-indigo-400 to-indigo-600',
                SICK: 'from-rose-400 to-rose-600',
                EARNED: 'from-emerald-400 to-emerald-600',
                MATERNITY: 'from-pink-400 to-pink-600',
                PATERNITY: 'from-blue-400 to-blue-600',
                MEDICAL: 'from-teal-400 to-teal-600',
                COMP_OFF: 'from-violet-400 to-violet-600',
                EMERGENCY: 'from-amber-400 to-amber-600',
              };
              return (
                <div key={type} className="p-3.5 bg-brand-50 dark:bg-brand-900/40 rounded-2xl border border-brand-100 dark:border-brand-800">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center space-x-2">
                      <span className={`w-2 h-2 rounded-full bg-gradient-to-br ${leaveColors[type] || 'from-indigo-400 to-indigo-600'}`} />
                      <p className="font-bold text-[11px] text-brand-950 dark:text-white uppercase tracking-wide">{type.replace(/_/g, ' ')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-brand-950 dark:text-white">{bal.available}</p>
                      <p className="text-[8px] font-bold text-brand-500 uppercase tracking-wider">Available</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 h-1.5 bg-brand-100 dark:bg-brand-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r rounded-full transition-all duration-500 ${leaveColors[type] || 'from-indigo-400 to-indigo-600'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-bold text-brand-500 whitespace-nowrap">{bal.used} / {bal.limit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md">
          <h3 className="font-bold text-sm uppercase tracking-wider text-brand-950 dark:text-white mb-5 flex items-center space-x-2">
            <FileSpreadsheet size={16} className="text-orange-500" />
            <span>Recent Payslips</span>
          </h3>
          <div className="space-y-3">
            {empData.salaries.length === 0 ? (
              <p className="text-center py-10 text-xs text-brand-500">No payslips generated yet</p>
            ) : (
              empData.salaries.map((sal: any) => (
                <div key={sal.id} className="p-4 bg-brand-50 dark:bg-brand-900/40 rounded-2xl border border-brand-100 dark:border-brand-800 hover:border-orange-500/30 transition-all group">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-black text-sm text-brand-950 dark:text-white">{sal.payslipNumber}</p>
                      <p className="text-[9px] text-brand-500 font-bold mt-0.5 uppercase">
                        Month: {sal.month} | {sal.financialYear}
                      </p>
                      <span className={`inline-block mt-2 text-[9px] px-2 py-0.5 rounded-full font-black uppercase border ${
                        sal.status === 'GENERATED'
                          ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-brand-100 text-brand-600 dark:bg-brand-800 dark:text-brand-400 border-brand-300'
                      }`}>
                        {sal.status}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-lg bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                        {formatCurrency(sal.netSalary)}
                      </p>
                      <div className="flex items-center space-x-2 mt-2">
                        {sal.payslipPdfUrl && (
                          <a
                            href={sal.payslipPdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 bg-orange-100 dark:bg-orange-950/40 text-orange-600 rounded-xl hover:bg-orange-200 dark:hover:bg-orange-950/60 transition-all border border-orange-500/20"
                            title="View / Download PDF"
                          >
                            <Eye size={13} />
                          </a>
                        )}
                        {sal.payslipPdfUrl && (
                          <a
                            href={sal.payslipPdfUrl}
                            download
                            className="p-2 bg-brand-100 dark:bg-brand-800 text-brand-600 dark:text-brand-400 rounded-xl hover:bg-brand-200 dark:hover:bg-brand-700 transition-all border border-brand-200 dark:border-brand-700"
                            title="Download"
                          >
                            <Download size={13} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Timeline Events + Notifications */}
      {(empData.timelineEvents?.length > 0 || empData.notifications?.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md">
            <h3 className="font-bold text-sm uppercase tracking-wider text-brand-950 dark:text-white mb-5 flex items-center space-x-2">
              <Activity size={16} className="text-orange-500" />
              <span>Timeline</span>
            </h3>
            <div className="relative pl-6 space-y-5">
              <div className="absolute left-1.5 top-1 bottom-1 w-0.5 bg-gradient-to-b from-orange-500 via-amber-400 to-transparent" />
              {empData.timelineEvents.slice(0, 6).map((e: any) => {
                const eventIcons: Record<string, React.ReactNode> = {
                  JOINED: <UserPlus size={11} />,
                  PROMOTION: <Trophy size={11} />,
                  SALARY_UPDATE: <DollarSign size={11} />,
                  LEAVE: <CalendarX size={11} />,
                  PERFORMANCE_REVIEW: <Star size={11} />,
                  DOCUMENT: <FileSpreadsheet size={11} />,
                  AWARD: <Award size={11} />,
                  TRAINING_COMPLETED: <CheckCircle2 size={11} />,
                };
                return (
                  <div key={e.id} className="relative">
                    <div className="absolute -left-5 w-5 h-5 rounded-full bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center text-white shadow-md shadow-orange-500/30">
                      {eventIcons[e.eventType] || <Star size={10} />}
                    </div>
                    <div className="p-3 bg-brand-50 dark:bg-brand-900/40 rounded-xl border border-brand-100 dark:border-brand-800 ml-2">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-bold text-[11px] text-brand-950 dark:text-white">{e.title}</p>
                        <span className="text-[8px] font-bold text-brand-500 uppercase">{new Date(e.date).toLocaleDateString()}</span>
                      </div>
                      <p className="text-[9px] text-brand-600 dark:text-brand-400 font-semibold">
                        {e.eventType.replace(/_/g, ' ')}
                      </p>
                      {e.description && <p className="text-[9px] text-brand-500 mt-1">{e.description}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md">
            <h3 className="font-bold text-sm uppercase tracking-wider text-brand-950 dark:text-white mb-5 flex items-center space-x-2">
              <Bell size={16} className="text-orange-500" />
              <span>Notifications</span>
            </h3>
            <div className="space-y-3">
              {empData.notifications.length === 0 ? (
                <p className="text-center py-10 text-xs text-brand-500">All caught up! No new notifications 🎉</p>
              ) : (
                empData.notifications.map((n: any) => (
                  <div key={n.id} className="p-3.5 bg-gradient-to-r from-indigo-50 to-transparent dark:from-indigo-950/30 dark:to-transparent rounded-xl border border-indigo-500/10 hover:border-orange-500/20 transition-all">
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 mt-1.5 rounded-full bg-orange-500 shrink-0 animate-pulse" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs text-brand-950 dark:text-white">{n.title}</p>
                        <p className="text-[10px] text-brand-600 dark:text-brand-400 mt-0.5 font-semibold leading-relaxed">{n.message}</p>
                        <p className="text-[8px] text-brand-400 mt-1 font-bold uppercase">{new Date(n.createdAt).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
