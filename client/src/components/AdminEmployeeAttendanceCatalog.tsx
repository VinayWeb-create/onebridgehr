import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Calendar,
  Filter,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Home,
  ShieldCheck,
  ChevronRight,
  Download,
  RotateCcw,
  Sparkles,
  BarChart3,
  X,
  ExternalLink,
  Award,
  AlertTriangle,
  MapPin,
  Scan,
} from 'lucide-react';
import api from '../services/api';

export interface DailyAttendanceRecord {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  lateMinutes: number;
  overtimeMinutes: number;
  workFromHome: boolean;
  faceMatchScore: number | null;
  officeName: string;
  distanceFromOffice: number | null;
  verificationStatus?: string | null;
}

export interface EmployeeAttendanceSummary {
  employeeId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  department: string;
  designation: string;
  profileImageUrl?: string | null;
  isBiometricEnrolled: boolean;
  dateOfJoining?: string;
  hasJoinedInPeriod?: boolean;
  totalWorkingDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  wfhDays: number;
  onLeaveDays: number;
  attendancePercentage: number;
  totalOvertimeMinutes: number;
  totalWorkHours: number;
  dailyBreakdown: DailyAttendanceRecord[];
}

export const AdminEmployeeAttendanceCatalog: React.FC = () => {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [attendanceFilter, setAttendanceFilter] = useState<'ALL' | 'HIGH' | 'MODERATE' | 'LOW' | 'PENDING_BIO'>('ALL');

  const [loading, setLoading] = useState<boolean>(true);
  const [departments, setDepartments] = useState<string[]>([]);
  const [periodData, setPeriodData] = useState<any>(null);
  const [summaryStats, setSummaryStats] = useState<any>(null);
  const [employees, setEmployees] = useState<EmployeeAttendanceSummary[]>([]);

  // Selected Employee for Detailed Drill-Down Modal
  const [selectedEmp, setSelectedEmp] = useState<EmployeeAttendanceSummary | null>(null);

  useEffect(() => {
    fetchEmployeeAttendanceSummary();
  }, [selectedMonth, selectedYear, selectedDept]);

  const fetchEmployeeAttendanceSummary = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        month: String(selectedMonth),
        year: String(selectedYear),
      });

      if (selectedDept !== 'ALL') {
        params.append('department', selectedDept);
      }

      const res = await api.get(`/attendance/admin/employee-summary?${params.toString()}`);
      if (res.data.status === 'success') {
        setPeriodData(res.data.data.period);
        setSummaryStats(res.data.data.summary);
        setDepartments(res.data.data.departments || []);
        setEmployees(res.data.data.employees || []);
      }
    } catch (err) {
      console.error('Failed to load employee attendance catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  // Client-Side Search & Tier Filtering
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.designation.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (attendanceFilter === 'HIGH') return emp.attendancePercentage >= 85;
    if (attendanceFilter === 'MODERATE') return emp.attendancePercentage >= 70 && emp.attendancePercentage < 85;
    if (attendanceFilter === 'LOW') return emp.attendancePercentage < 70;
    if (attendanceFilter === 'PENDING_BIO') return !emp.isBiometricEnrolled;

    return true;
  });

  // Export Summary CSV
  const handleExportSummaryCSV = () => {
    if (filteredEmployees.length === 0) return;

    const headers = [
      'Employee ID',
      'Employee Name',
      'Department',
      'Designation',
      'Total Working Days',
      'Present Days',
      'Absent Days',
      'Late Days',
      'Half Days',
      'WFH Days',
      'Attendance Percentage (%)',
      'Total Work Hours',
      'Biometric Enrolled',
    ];

    const rows = filteredEmployees.map((e) => [
      `"${e.employeeId}"`,
      `"${e.fullName}"`,
      `"${e.department}"`,
      `"${e.designation}"`,
      e.totalWorkingDays,
      e.presentDays,
      e.absentDays,
      e.lateDays,
      e.halfDays,
      e.wfhDays,
      `${e.attendancePercentage}%`,
      e.totalWorkHours,
      e.isBiometricEnrolled ? 'Yes' : 'No',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Employee_Attendance_Summary_${selectedMonth}_${selectedYear}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const MONTHS = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  return (
    <div className="space-y-6">
      {/* =============================================================
         CATALOG HEADER & FILTER CONTROLS TOOLBAR
      ============================================================= */}
      <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-xl bg-white/80 dark:bg-brand-950/80 backdrop-blur-md space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-cyan-600 rounded-2xl text-white shadow-md shadow-indigo-600/30">
                <Users size={20} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-brand-950 dark:text-white flex items-center gap-2">
                  Employee Attendance Catalog & Summary
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800">
                    Super Admin View
                  </span>
                </h3>
                <p className="text-xs text-brand-500">
                  Full detailed breakdown of total days present, absent, late, and biometric status per employee
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportSummaryCSV}
              disabled={filteredEmployees.length === 0}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all"
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              onClick={fetchEmployeeAttendanceSummary}
              className="p-2 rounded-xl border border-brand-200 dark:border-brand-800 hover:bg-brand-100/40 dark:hover:bg-brand-900/40 text-brand-600 dark:text-brand-300 transition-colors"
              title="Refresh attendance records"
            >
              <RotateCcw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-4 border-t border-brand-100 dark:border-brand-900">
          {/* Month Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider flex items-center gap-1">
              <Calendar size={12} className="text-indigo-500" /> Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-900/40 text-xs font-bold text-brand-950 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Year Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider flex items-center gap-1">
              <Calendar size={12} className="text-indigo-500" /> Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-900/40 text-xs font-bold text-brand-950 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider flex items-center gap-1">
              <Filter size={12} className="text-indigo-500" /> Department
            </label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-900/40 text-xs font-bold text-brand-950 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Attendance Tier Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider flex items-center gap-1">
              <BarChart3 size={12} className="text-indigo-500" /> Attendance Tier
            </label>
            <select
              value={attendanceFilter}
              onChange={(e) => setAttendanceFilter(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-900/40 text-xs font-bold text-brand-950 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Employees</option>
              <option value="HIGH">High Attendance (≥ 85%)</option>
              <option value="MODERATE">Moderate (70% - 84%)</option>
              <option value="LOW">Low Attendance (&lt; 70%)</option>
              <option value="PENDING_BIO">Pending Face Enrollment</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider flex items-center gap-1">
              <Search size={12} className="text-indigo-500" /> Search Employee
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
              <input
                type="text"
                placeholder="Name or ID (e.g. OBI...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-900/40 text-xs font-bold text-brand-950 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 placeholder:font-normal placeholder:text-brand-400"
              />
            </div>
          </div>
        </div>

        {/* Overview KPI Chips */}
        {summaryStats && periodData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900/50">
              <p className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400">Total Employees</p>
              <p className="text-xl font-black text-brand-950 dark:text-white">{summaryStats.totalEmployees}</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-cyan-50/60 dark:bg-cyan-950/40 border border-cyan-200/60 dark:border-cyan-900/50">
              <p className="text-[10px] uppercase font-bold text-cyan-600 dark:text-cyan-400">Total Working Days</p>
              <p className="text-xl font-black text-brand-950 dark:text-white">{periodData.totalWorkingDays} Days</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/50">
              <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Avg Attendance</p>
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{summaryStats.avgAttendance}%</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/50">
              <p className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">Perfect (≥95%)</p>
              <p className="text-xl font-black text-amber-600 dark:text-amber-400">{summaryStats.perfectCount}</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/50 col-span-2 sm:col-span-1">
              <p className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400">Low (&lt;75%) Attention</p>
              <p className="text-xl font-black text-rose-600 dark:text-rose-400">{summaryStats.lowCount}</p>
            </div>
          </div>
        )}
      </div>

      {/* =============================================================
         EMPLOYEE-BY-EMPLOYEE ATTENDANCE TABLE CATALOG
      ============================================================= */}
      <div className="glass rounded-3xl overflow-hidden border border-brand-200 dark:border-brand-900 shadow-xl bg-white dark:bg-brand-950">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-brand-100/60 dark:bg-brand-900/60 text-[10px] uppercase font-bold text-brand-500 border-b border-brand-200 dark:border-brand-800">
                <th className="px-5 py-4">Employee</th>
                <th className="px-4 py-4">Department</th>
                <th className="px-4 py-4 text-center">Working Days</th>
                <th className="px-4 py-4 text-center">Days Present</th>
                <th className="px-4 py-4 text-center">Days Absent</th>
                <th className="px-4 py-4 text-center">Late / WFH</th>
                <th className="px-5 py-4">Attendance Rate</th>
                <th className="px-4 py-4 text-center">Extra Hours (OT)</th>
                <th className="px-4 py-4 text-center">Biometrics</th>
                <th className="px-5 py-4 text-right">Detailed Log</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100 dark:divide-brand-900 font-semibold">
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-brand-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs font-bold">Calculating employee attendance catalog...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-brand-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users size={32} className="text-brand-300 dark:text-brand-700" />
                      <p className="text-sm font-bold text-brand-950 dark:text-white">No employee records found</p>
                      <p className="text-xs text-brand-400">Try adjusting your department, search, or tier filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const rateColor =
                    emp.attendancePercentage >= 85
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : emp.attendancePercentage >= 70
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-rose-600 dark:text-rose-400';

                  const barBg =
                    emp.attendancePercentage >= 85
                      ? 'bg-emerald-500'
                      : emp.attendancePercentage >= 70
                      ? 'bg-amber-500'
                      : 'bg-rose-500';

                  return (
                    <tr
                      key={emp.employeeId}
                      className="hover:bg-indigo-50/30 dark:hover:bg-brand-900/30 transition-colors cursor-pointer group"
                      onClick={() => setSelectedEmp(emp)}
                    >
                      {/* Employee Info */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-900/60 overflow-hidden shrink-0 flex items-center justify-center font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800">
                            {emp.profileImageUrl ? (
                              <img
                                src={emp.profileImageUrl}
                                alt={emp.fullName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              `${emp.firstName[0]}${emp.lastName[0]}`
                            )}
                          </div>
                          <div>
                            <p className="font-extrabold text-brand-950 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {emp.fullName}
                            </p>
                            <p className="text-[10px] text-brand-400 font-mono">{emp.employeeId}</p>
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="px-4 py-3.5">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-brand-100/60 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300 border border-brand-200/60 dark:border-brand-800">
                          {emp.department}
                        </span>
                      </td>

                      {/* Total Working Days */}
                      <td className="px-4 py-3.5 text-center font-mono text-brand-600 dark:text-brand-300 font-bold">
                        {emp.totalWorkingDays}
                      </td>

                      {/* Days Present (Prominent Highlight) */}
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-black text-xs border border-emerald-300 dark:border-emerald-800/60 shadow-sm shadow-emerald-500/10">
                          <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                          {emp.presentDays} Days
                        </span>
                      </td>

                      {/* Days Absent */}
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-black ${
                            emp.absentDays > 0
                              ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-900/60'
                              : 'text-brand-400'
                          }`}
                        >
                          {emp.absentDays > 0 ? `${emp.absentDays} Days` : '0'}
                        </span>
                      </td>

                      {/* Late & WFH */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-[10px]">
                          {emp.lateDays > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-bold">
                              {emp.lateDays} Late
                            </span>
                          )}
                          {emp.wfhDays > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-bold">
                              {emp.wfhDays} WFH
                            </span>
                          )}
                          {emp.lateDays === 0 && emp.wfhDays === 0 && (
                            <span className="text-brand-400 font-normal">-</span>
                          )}
                        </div>
                      </td>

                      {/* Attendance Percentage & Progress Bar */}
                      <td className="px-5 py-3.5">
                        <div className="space-y-1.5 min-w-[120px]">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className={`font-black ${rateColor}`}>{emp.attendancePercentage}%</span>
                            <span className="text-brand-400 font-medium">
                              {emp.presentDays}/{emp.totalWorkingDays}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-brand-100 dark:bg-brand-900 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${barBg}`}
                              style={{ width: `${Math.min(100, emp.attendancePercentage)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Extra Hours / Overtime (Admin Exclusive) */}
                      <td className="px-4 py-3.5 text-center">
                        {emp.totalOvertimeMinutes > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 font-extrabold text-xs border border-purple-200 dark:border-purple-800/60 shadow-sm shadow-purple-500/10">
                            <Clock size={11} className="text-purple-600 dark:text-purple-400" />
                            +{(emp.totalOvertimeMinutes / 60).toFixed(1)}h OT
                          </span>
                        ) : (
                          <span className="text-brand-400 font-normal">-</span>
                        )}
                      </td>

                      {/* Biometric Status */}
                      <td className="px-4 py-3.5 text-center">
                        {emp.isBiometricEnrolled ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                            <ShieldCheck size={11} /> 512-D
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEmp(emp);
                          }}
                          className="px-3 py-1.5 rounded-xl border border-brand-200 dark:border-brand-800 text-brand-600 dark:text-brand-300 hover:text-white hover:bg-indigo-600 dark:hover:bg-indigo-600 hover:border-indigo-600 transition-all font-bold text-[10px] uppercase tracking-wider inline-flex items-center gap-1"
                        >
                          <span>Breakdown</span>
                          <ChevronRight size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =============================================================
         FULL DETAILED EMPLOYEE BREAKDOWN MODAL (DRILL-DOWN)
      ============================================================= */}
      <AnimatePresence>
        {selectedEmp && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-brand-950 text-white rounded-3xl p-6 sm:p-8 max-w-3xl w-full border border-indigo-500/40 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-start pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 overflow-hidden flex items-center justify-center text-white font-bold text-lg border border-indigo-400/40 shadow-md">
                    {selectedEmp.profileImageUrl ? (
                      <img
                        src={selectedEmp.profileImageUrl}
                        alt={selectedEmp.fullName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      `${selectedEmp.firstName[0]}${selectedEmp.lastName[0]}`
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      {selectedEmp.fullName}
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-600 font-mono">
                        {selectedEmp.employeeId}
                      </span>
                    </h3>
                    <p className="text-xs text-brand-400">
                      {selectedEmp.designation} • {selectedEmp.department}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedEmp(null)}
                  className="p-1.5 rounded-xl hover:bg-white/10 text-brand-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Month KPI Badges for this Employee */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/30">
                  <p className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Days Present
                  </p>
                  <p className="text-2xl font-black text-emerald-300">
                    {selectedEmp.presentDays} <span className="text-xs font-normal text-brand-400">/ {selectedEmp.totalWorkingDays}</span>
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/30">
                  <p className="text-[10px] uppercase font-bold text-rose-400 flex items-center gap-1">
                    <AlertCircle size={12} /> Days Absent
                  </p>
                  <p className="text-2xl font-black text-rose-300">
                    {selectedEmp.absentDays} <span className="text-xs font-normal text-brand-400">Days</span>
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-950/60 border border-amber-500/30">
                  <p className="text-[10px] uppercase font-bold text-amber-400 flex items-center gap-1">
                    <Clock size={12} /> Late Arrivals
                  </p>
                  <p className="text-2xl font-black text-amber-300">
                    {selectedEmp.lateDays} <span className="text-xs font-normal text-brand-400">Times</span>
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-purple-950/60 border border-purple-500/30">
                  <p className="text-[10px] uppercase font-bold text-purple-400 flex items-center gap-1">
                    <Clock size={12} /> Extra Hours (OT)
                  </p>
                  <p className="text-2xl font-black text-purple-300">
                    +{(selectedEmp.totalOvertimeMinutes / 60).toFixed(1)} <span className="text-xs font-normal text-brand-400">hrs</span>
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-indigo-950/60 border border-indigo-500/30 col-span-2 sm:col-span-1">
                  <p className="text-[10px] uppercase font-bold text-indigo-400 flex items-center gap-1">
                    <BarChart3 size={12} /> Attendance Rate
                  </p>
                  <p className="text-2xl font-black text-indigo-300">
                    {selectedEmp.attendancePercentage}%
                  </p>
                </div>
              </div>

              {/* Day-by-Day Daily Log Table */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-brand-400 flex items-center gap-1.5">
                    <Calendar size={14} className="text-indigo-400" />
                    Day-By-Day Attendance Records ({MONTHS.find((m) => m.value === selectedMonth)?.label} {selectedYear})
                  </h4>
                  <span className="text-[10px] text-brand-400 font-mono">
                    {selectedEmp.dailyBreakdown.length} Recorded Log(s)
                  </span>
                </div>

                <div className="rounded-2xl border border-white/10 overflow-hidden bg-black/40">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-white/5 text-[10px] uppercase font-bold text-brand-400 border-b border-white/10">
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5">Clock In</th>
                        <th className="px-4 py-2.5">Clock Out</th>
                        <th className="px-4 py-2.5">Late / Overtime</th>
                        <th className="px-4 py-2.5 text-right">Biometric Match</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-medium">
                      {selectedEmp.dailyBreakdown.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-brand-400">
                            No attendance records logged for this employee in the selected period.
                          </td>
                        </tr>
                      ) : (
                        selectedEmp.dailyBreakdown.map((log) => {
                          const isPresent = ['PRESENT', 'LATE', 'WORK_FROM_HOME', 'REMOTE'].includes(log.status);

                          return (
                            <tr key={log.id} className="hover:bg-white/5">
                              <td className="px-4 py-2.5 font-mono text-white/90">
                                {log.date}
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                      log.status === 'PRESENT'
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                        : log.status === 'LATE'
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                        : log.status === 'WORK_FROM_HOME'
                                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                        : log.status === 'NOT_RECORDED'
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                    }`}
                                  >
                                    {log.status === 'NOT_RECORDED' ? 'LIVE PENDING' : log.status.replace(/_/g, ' ')}
                                  </span>
                                  {log.verificationStatus === 'PHYSICAL_REGISTER' && (
                                    <span className="text-[9px] font-semibold text-emerald-400/90">
                                      (Physical Register)
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-2.5 font-mono text-white/80">
                                {log.checkIn || '-'}
                              </td>
                              <td className="px-4 py-2.5 font-mono text-white/80">
                                {log.checkOut || '-'}
                              </td>
                              <td className="px-4 py-2.5 text-[10px]">
                                {log.lateMinutes > 0 && (
                                  <span className="text-amber-400 font-bold mr-2">
                                    +{log.lateMinutes}m Late
                                  </span>
                                )}
                                {log.overtimeMinutes > 0 && (
                                  <span className="text-emerald-400 font-bold">
                                    +{log.overtimeMinutes}m OT
                                  </span>
                                )}
                                {!log.lateMinutes && !log.overtimeMinutes && (
                                  <span className="text-brand-500">-</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono">
                                {log.faceMatchScore ? (
                                  <span className="text-emerald-400 font-bold">
                                    {log.faceMatchScore}% Match
                                  </span>
                                ) : (
                                  <span className="text-brand-500">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Close Button */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedEmp(null)}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider transition-colors"
                >
                  Close Detailed View
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminEmployeeAttendanceCatalog;
