import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Calendar, Award, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight,
  TrendingUp, Clock, ShieldCheck, Sparkles, HelpCircle, X, Info,
  Flame, CheckCircle, BarChart3, Users, Shield, CheckCheck
} from 'lucide-react';

interface DayDetail {
  day: number;
  date: string;
  dayOfWeek: number;
  isWorkingDay: boolean;
  isHoliday: boolean;
  isSunday: boolean;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  lateMinutes: number;
  faceMatchScore: number | null;
}

interface MonthData {
  monthNumber: number;
  monthName: string;
  monthShortName: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'UPCOMING' | 'PRE_JOINING';
  daysInMonth: number;
  totalWorkingDays: number;
  workingDaysEvaluated: number;
  effectiveAttendedDays: number;
  presentCount: number;
  lateCount: number;
  halfDayCount: number;
  absentCount: number;
  wfhCount: number;
  leaveCount: number;
  percentage: number | null;
  tier: string;
  tierLabel: string;
  badgeColor: string;
  dailyDetails: DayDetail[];
}

interface MatrixResponse {
  employee: {
    employeeId: string;
    firstName: string;
    lastName: string;
    fullName: string;
    department: string;
    designation: string;
    profileImageUrl?: string;
    dateOfJoining?: string;
    isBiometricEnrolled: boolean;
  };
  year: number;
  threshold: number;
  isAdministrativeExempt?: boolean;
  cumulativeYtd: {
    workingDays: number;
    attendedDays: number;
    absentDays: number;
    lateDays: number;
    halfDays: number;
    wfhDays: number;
    leaveDays: number;
    percentage: number;
    isEligible: boolean;
    tier: string;
    bufferDaysSafe: number;
    shortageDaysToRecover: number;
  };
  months: MonthData[];
}

interface MonthlyAttendanceMatrixProps {
  employeeId?: string;
  showTitle?: boolean;
}

export const MonthlyAttendanceMatrix: React.FC<MonthlyAttendanceMatrixProps> = ({
  employeeId,
  showTitle = true,
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [matrixData, setMatrixData] = useState<MatrixResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonthForModal, setSelectedMonthForModal] = useState<MonthData | null>(null);

  useEffect(() => {
    fetchMatrix();
  }, [selectedYear, employeeId]);

  const fetchMatrix = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { year: selectedYear };
      if (employeeId) params.employeeId = employeeId;
      const res = await api.get('/attendance/monthly-matrix', { params });
      if (res.data.status === 'success') {
        setMatrixData(res.data.data);
      }
    } catch (err: any) {
      console.error('Failed to load monthly attendance matrix', err);
      setError(err?.response?.data?.message || 'Failed to load month-by-month attendance data');
    } finally {
      setLoading(false);
    }
  };

  const getTierColorClasses = (tier: string) => {
    switch (tier) {
      case 'DISTINCTION':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/40',
          border: 'border-emerald-300 dark:border-emerald-800/60',
          text: 'text-emerald-700 dark:text-emerald-300',
          badge: 'bg-emerald-500 text-white',
          ring: 'text-emerald-500',
        };
      case 'ELIGIBLE':
        return {
          bg: 'bg-indigo-50 dark:bg-indigo-950/40',
          border: 'border-indigo-300 dark:border-indigo-800/60',
          text: 'text-indigo-700 dark:text-indigo-300',
          badge: 'bg-indigo-600 text-white',
          ring: 'text-indigo-500',
        };
      case 'SHORTAGE':
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/40',
          border: 'border-amber-300 dark:border-amber-800/60',
          text: 'text-amber-700 dark:text-amber-300',
          badge: 'bg-amber-500 text-white',
          ring: 'text-amber-500',
        };
      case 'CRITICAL':
        return {
          bg: 'bg-rose-50 dark:bg-rose-950/40',
          border: 'border-rose-300 dark:border-rose-800/60',
          text: 'text-rose-700 dark:text-rose-300',
          badge: 'bg-rose-600 text-white',
          ring: 'text-rose-500',
        };
      case 'PRE_JOINING':
        return {
          bg: 'bg-brand-50/20 dark:bg-brand-950/20',
          border: 'border-dashed border-brand-200 dark:border-brand-800',
          text: 'text-brand-400',
          badge: 'bg-brand-200/80 dark:bg-brand-800 text-brand-600 dark:text-brand-300',
          ring: 'text-brand-300',
        };
      default:
        return {
          bg: 'bg-brand-50/50 dark:bg-brand-900/20',
          border: 'border-brand-200 dark:border-brand-800',
          text: 'text-brand-500',
          badge: 'bg-brand-400 text-white',
          ring: 'text-brand-400',
        };
    }
  };

  const getDayStatusColor = (status: string) => {
    switch (status) {
      case 'PRE_JOINING':
        return 'bg-brand-100/50 dark:bg-brand-900/30 text-brand-400 border-dashed border-brand-200 dark:border-brand-800';
      case 'PRESENT':
        return 'bg-emerald-500 text-white border-emerald-600';
      case 'WORK_FROM_HOME':
      case 'REMOTE':
        return 'bg-sky-500 text-white border-sky-600';
      case 'LATE':
        return 'bg-amber-500 text-white border-amber-600';
      case 'HALF_DAY':
        return 'bg-indigo-400 text-white border-indigo-500';
      case 'ABSENT':
        return 'bg-rose-500 text-white border-rose-600';
      case 'ON_LEAVE':
        return 'bg-purple-500 text-white border-purple-600';
      case 'HOLIDAY':
        return 'bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300 border-pink-300 dark:border-pink-800';
      case 'WEEKEND':
        return 'bg-brand-100 dark:bg-brand-900/40 text-brand-400 border-brand-200 dark:border-brand-800';
      default:
        return 'bg-brand-50 dark:bg-brand-900/10 text-brand-400 border-dashed border-brand-200 dark:border-brand-800';
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      {/* Top Header & Year Controller */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-brand-50 to-indigo-50/30 dark:from-brand-950/60 dark:to-indigo-950/30 p-5 rounded-3xl border border-brand-200/80 dark:border-brand-900 shadow-sm">
        <div className="space-y-1">
          {showTitle && (
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-600/20">
                <BarChart3 size={18} />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-brand-950 dark:text-white flex items-center gap-2">
                  Monthly Attendance Performance
                  <span className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                    Month-By-Month %
                  </span>
                </h3>
                <p className="text-xs text-brand-500 dark:text-brand-400">
                  Total attendance percentage overview with organizational policy threshold (75% minimum)
                </p>
                {matrixData?.employee?.dateOfJoining && (
                  <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mt-1 flex items-center gap-1.5">
                    <span>Date of Joining:</span>
                    <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800">
                      {new Date(matrixData.employee.dateOfJoining).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="text-brand-400 text-[10px] font-medium">(Attendance countdown commences from joining date)</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Year Selector Control */}
        <div className="flex items-center gap-2 bg-white dark:bg-brand-900/60 p-1.5 rounded-2xl border border-brand-200 dark:border-brand-800 shadow-sm">
          <button
            onClick={() => setSelectedYear((y) => y - 1)}
            className="p-1.5 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-800 text-brand-600 dark:text-brand-300 transition-colors"
            title="Previous Year"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-1.5 px-3">
            <Calendar size={14} className="text-indigo-500" />
            <span className="text-sm font-extrabold text-brand-950 dark:text-white">
              {selectedYear}
            </span>
            {selectedYear === currentYear && (
              <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-md ml-1">
                Current
              </span>
            )}
          </div>
          <button
            onClick={() => setSelectedYear((y) => y + 1)}
            disabled={selectedYear >= currentYear + 1}
            className="p-1.5 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-800 text-brand-600 dark:text-brand-300 disabled:opacity-30 transition-colors"
            title="Next Year"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="glass rounded-3xl p-12 text-center space-y-3 border border-brand-200 dark:border-brand-900">
          <div className="w-10 h-10 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-brand-500">Calculating monthly percentage records...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-3xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-3">
          <AlertTriangle size={20} className="shrink-0 text-rose-500" />
          <p className="font-semibold">{error}</p>
        </div>
      ) : matrixData ? (
        <>
          {matrixData.isAdministrativeExempt && (
            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <Shield size={18} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h5 className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                    Executive & Administrative Exemption
                  </h5>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                    Attendance Not Enforced
                  </span>
                </div>
                <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 mt-0.5 leading-relaxed">
                  Super Admins and HR leaders manage organizational operations and are exempt from mandatory daily biometric punch-ins and attendance percentages.
                </p>
              </div>
            </div>
          )}

          {/* Key Overall Cumulative Metrics Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* 1. Grand Cumulative Percentage Ring */}
            <div className={`p-6 rounded-3xl border shadow-lg flex flex-col justify-between ${
              matrixData.cumulativeYtd.isEligible
                ? 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/30 dark:border-emerald-500/20'
                : 'bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border-rose-500/30 dark:border-rose-500/20'
            }`}>
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-brand-500">
                    Year-To-Date (YTD) Total
                  </span>
                  <h4 className="text-sm font-extrabold text-brand-950 dark:text-white mt-0.5">
                    Cumulative Attendance
                  </h4>
                </div>
                <span className={`p-2 rounded-xl text-xs font-bold ${
                  matrixData.cumulativeYtd.isEligible
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                }`}>
                  {matrixData.cumulativeYtd.isEligible ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                </span>
              </div>

              <div className="my-4 flex items-baseline gap-3">
                <span className={`text-4xl font-black tracking-tight ${
                  matrixData.cumulativeYtd.isEligible
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {matrixData.cumulativeYtd.percentage}%
                </span>
                <span className="text-xs font-bold text-brand-400">
                  / 100%
                </span>
              </div>

              {/* Threshold status pill */}
              <div className="space-y-2">
                <div className="w-full bg-brand-200 dark:bg-brand-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      matrixData.cumulativeYtd.isEligible
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : 'bg-gradient-to-r from-rose-500 to-amber-400'
                    }`}
                    style={{ width: `${Math.min(100, matrixData.cumulativeYtd.percentage)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-brand-500">
                    Policy Cutoff: <strong>{matrixData.threshold}%</strong>
                  </span>
                  <span className={matrixData.cumulativeYtd.isEligible ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                    {matrixData.cumulativeYtd.isEligible ? 'POLICY COMPLIANT' : 'ATTENDANCE SHORTAGE'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Safe Buffer / Recovery Deficit Card */}
            <div className="p-6 rounded-3xl bg-white dark:bg-brand-950 border border-brand-200 dark:border-brand-900 shadow-lg flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-brand-500">
                  Compliance Status
                </span>
                <h4 className="text-sm font-extrabold text-brand-950 dark:text-white mt-0.5 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-indigo-500" />
                  {matrixData.cumulativeYtd.isEligible ? 'Leave Buffer Available' : 'Recovery Days Required'}
                </h4>
              </div>

              <div className="my-3">
                {matrixData.cumulativeYtd.isEligible ? (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                        +{matrixData.cumulativeYtd.bufferDaysSafe} Days
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase px-1.5 py-0.5 rounded bg-emerald-200/50 dark:bg-emerald-900/50">
                        Buffer
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-200 mt-1 leading-snug">
                      Policy compliant! You can take up to <strong>{matrixData.cumulativeYtd.bufferDaysSafe} working days leave</strong> and remain above the 75% threshold.
                    </p>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                        {matrixData.cumulativeYtd.shortageDaysToRecover} Days
                      </span>
                      <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase px-1.5 py-0.5 rounded bg-rose-200/50 dark:bg-rose-900/50">
                        Required
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-rose-800 dark:text-rose-200 mt-1 leading-snug">
                      Attendance Shortage: You need <strong>{matrixData.cumulativeYtd.shortageDaysToRecover} consecutive working days</strong> to reach 75% compliance.
                    </p>
                  </div>
                )}
              </div>

              <div className="text-[10px] text-brand-400 flex items-center gap-1 font-medium">
                <Info size={11} /> Formula: (Attended Days / Total Working Days) &times; 100
              </div>
            </div>

            {/* 3. Days Count Breakdown */}
            <div className="p-6 rounded-3xl bg-white dark:bg-brand-950 border border-brand-200 dark:border-brand-900 shadow-lg flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-brand-500">
                  Yearly Tally
                </span>
                <h4 className="text-sm font-extrabold text-brand-950 dark:text-white mt-0.5">
                  Attended vs Working Days
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-2 my-2">
                <div className="p-2.5 rounded-xl bg-brand-50 dark:bg-brand-900/30">
                  <span className="text-[10px] font-bold text-brand-400 uppercase">Working Days</span>
                  <p className="text-lg font-black text-brand-950 dark:text-white">
                    {matrixData.cumulativeYtd.workingDays}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Attended</span>
                  <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                    {matrixData.cumulativeYtd.attendedDays}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30">
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase">Absent</span>
                  <p className="text-lg font-black text-rose-700 dark:text-rose-300">
                    {matrixData.cumulativeYtd.absentDays}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30">
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">Late Marks</span>
                  <p className="text-lg font-black text-amber-700 dark:text-amber-300">
                    {matrixData.cumulativeYtd.lateDays}
                  </p>
                </div>
              </div>

              <p className="text-[10px] text-brand-400 font-medium">
                Half-Days: {matrixData.cumulativeYtd.halfDays} &bull; WFH: {matrixData.cumulativeYtd.wfhDays} &bull; Leaves: {matrixData.cumulativeYtd.leaveDays}
              </p>
            </div>

            {/* 4. Policy Tiers Reference */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-50/50 to-brand-50/50 dark:from-brand-900/40 dark:to-indigo-950/30 border border-brand-200 dark:border-brand-900 shadow-lg flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <Shield size={12} /> Organizational Policy
                </span>
                <h4 className="text-sm font-extrabold text-brand-950 dark:text-white mt-0.5">
                  Attendance Policy Tiers
                </h4>
              </div>

              <div className="space-y-1.5 my-2 text-[11px] font-bold">
                <div className="flex justify-between items-center p-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                  <span>&ge; 85% Exemplary</span>
                  <span className="text-[10px] uppercase px-1.5 py-0.2 bg-emerald-500 text-white rounded">Safe</span>
                </div>
                <div className="flex justify-between items-center p-1.5 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                  <span>75% &ndash; 84.9% Compliant</span>
                  <span className="text-[10px] uppercase px-1.5 py-0.2 bg-indigo-600 text-white rounded">Standard</span>
                </div>
                <div className="flex justify-between items-center p-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300">
                  <span>65% &ndash; 74.9% Shortage</span>
                  <span className="text-[10px] uppercase px-1.5 py-0.2 bg-amber-500 text-white rounded">Warning</span>
                </div>
                <div className="flex justify-between items-center p-1.5 rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-300">
                  <span>&lt; 65% Critical</span>
                  <span className="text-[10px] uppercase px-1.5 py-0.2 bg-rose-600 text-white rounded">Action Req.</span>
                </div>
              </div>

              <div className="text-[10px] text-brand-500 font-semibold">
                Click any month card below to view day-by-day logs.
              </div>
            </div>
          </div>

          {/* =============================================================
              12 MONTH-BY-MONTH GRID CARDS (JANUARY - DECEMBER)
          ============================================================= */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-brand-950 dark:text-white flex items-center gap-2">
                <BarChart3 size={15} className="text-indigo-500" />
                12-Month Performance Matrix ({selectedYear})
              </h4>
              <span className="text-[11px] text-brand-500 font-medium">
                Month-by-month percentage tracking for {selectedYear}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {matrixData.months.map((month) => {
                const tierStyle = getTierColorClasses(month.tier);
                const isPreJoining = month.status === 'PRE_JOINING';
                const isUpcoming = month.status === 'UPCOMING';
                const isCurrent = month.status === 'IN_PROGRESS';

                return (
                  <div
                    key={month.monthNumber}
                    onClick={() => !isUpcoming && !isPreJoining && setSelectedMonthForModal(month)}
                    className={`rounded-3xl border p-5 transition-all duration-300 relative flex flex-col justify-between ${
                      isPreJoining
                        ? 'opacity-60 bg-brand-50/20 dark:bg-brand-950/20 border-dashed border-brand-200 dark:border-brand-800 cursor-default'
                        : isUpcoming
                        ? 'opacity-60 bg-brand-50/30 dark:bg-brand-950/20 border-brand-200/50 dark:border-brand-900/50 cursor-default'
                        : `${tierStyle.bg} ${tierStyle.border} hover:shadow-xl hover:-translate-y-1 cursor-pointer`
                    }`}
                  >
                    {/* Month Header */}
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-extrabold text-brand-400">
                              {String(month.monthNumber).padStart(2, '0')}.
                            </span>
                            <h5 className="text-base font-black text-brand-950 dark:text-white">
                              {month.monthName}
                            </h5>
                          </div>
                          <span className="text-[10px] font-semibold text-brand-500">
                            {isPreJoining
                              ? 'Prior to joining date'
                              : `${month.daysInMonth} days • ${month.totalWorkingDays} working`}
                          </span>
                        </div>

                        {/* Status Chip */}
                        {isPreJoining ? (
                          <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-brand-200/60 dark:bg-brand-800 text-brand-500 dark:text-brand-400">
                            Pre-Joining
                          </span>
                        ) : isUpcoming ? (
                          <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-brand-200/60 dark:bg-brand-800 text-brand-600 dark:text-brand-300">
                            Upcoming
                          </span>
                        ) : isCurrent ? (
                          <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-600 text-white animate-pulse">
                            Active Month
                          </span>
                        ) : (
                          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${tierStyle.badge}`}>
                            {month.tierLabel}
                          </span>
                        )}
                      </div>

                      {/* Percentage Ring / Big Percentage Stat */}
                      <div className="py-2 flex items-baseline justify-between border-y border-brand-200/40 dark:border-brand-800/40 my-2">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-brand-400">
                            Attendance Rate
                          </span>
                          <div className="flex items-baseline gap-1">
                            {month.percentage !== null ? (
                              <span className={`text-3xl font-black ${tierStyle.text}`}>
                                {month.percentage}%
                              </span>
                            ) : (
                              <span className="text-2xl font-bold text-brand-400">--%</span>
                            )}
                          </div>
                        </div>

                        {month.percentage !== null && (
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-brand-500 uppercase">
                              Attended
                            </span>
                            <p className="text-sm font-black text-brand-950 dark:text-white">
                              {month.effectiveAttendedDays} / {month.workingDaysEvaluated}
                            </p>
                            <span className="text-[9px] text-brand-400">Days</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar & Mini Stats */}
                    <div className="space-y-3 pt-1">
                      {month.percentage !== null && (
                        <div>
                          <div className="w-full bg-brand-200/60 dark:bg-brand-900 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                month.percentage >= 85
                                  ? 'bg-emerald-500'
                                  : month.percentage >= 75
                                  ? 'bg-indigo-600'
                                  : month.percentage >= 65
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(100, month.percentage)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Pill counters */}
                      {isPreJoining ? (
                        <div className="py-2 text-center text-[11px] text-brand-400 font-medium italic">
                          Prior to employee joining date
                        </div>
                      ) : !isUpcoming ? (
                        <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold">
                          <div className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 py-1 rounded-lg">
                            <div>{month.presentCount}</div>
                            <span className="text-[8px] uppercase opacity-80">Present</span>
                          </div>
                          <div className="bg-amber-500/10 text-amber-700 dark:text-amber-300 py-1 rounded-lg">
                            <div>{month.lateCount}</div>
                            <span className="text-[8px] uppercase opacity-80">Late</span>
                          </div>
                          <div className="bg-rose-500/10 text-rose-700 dark:text-rose-300 py-1 rounded-lg">
                            <div>{month.absentCount}</div>
                            <span className="text-[8px] uppercase opacity-80">Absent</span>
                          </div>
                        </div>
                      ) : (
                        <div className="py-2 text-center text-[11px] text-brand-400 font-semibold italic">
                          Month not started yet
                        </div>
                      )}

                      {/* Card Footer Hint */}
                      {!isUpcoming && !isPreJoining && (
                        <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-between pt-1">
                          <span>View Daily Logs</span>
                          <span>&rarr;</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}

      {/* =============================================================
          DRILL-DOWN MODAL: DAY-BY-DAY AUDIT CALENDAR FOR A MONTH
      ============================================================= */}
      {selectedMonthForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-950/70 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto glass rounded-3xl p-6 sm:p-8 border border-brand-200 dark:border-brand-800 shadow-2xl bg-white dark:bg-brand-950 space-y-6">
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-4 border-b border-brand-200 dark:border-brand-900">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-indigo-600 text-white rounded-xl">
                    <Calendar size={18} />
                  </span>
                  <div>
                    <h3 className="text-lg font-black text-brand-950 dark:text-white">
                      {selectedMonthForModal.monthName} {selectedYear} &mdash; Daily Breakdown
                    </h3>
                    <p className="text-xs text-brand-500">
                      Detailed attendance verification log for every calendar date
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedMonthForModal(null)}
                className="p-2 rounded-2xl bg-brand-100 hover:bg-brand-200 dark:bg-brand-900 dark:hover:bg-brand-800 text-brand-600 dark:text-brand-300 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Month Stats Summary Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 text-center">
                <span className="text-[10px] font-bold text-indigo-600 uppercase">Monthly Percentage</span>
                <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300">
                  {selectedMonthForModal.percentage !== null ? `${selectedMonthForModal.percentage}%` : '--'}
                </p>
                <span className="text-[9px] font-bold text-indigo-500 uppercase">{selectedMonthForModal.tierLabel}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-center">
                <span className="text-[10px] font-bold text-emerald-600 uppercase">Attended Days</span>
                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                  {selectedMonthForModal.effectiveAttendedDays}
                </p>
                <span className="text-[9px] text-emerald-500">/ {selectedMonthForModal.workingDaysEvaluated} evaluated</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-center">
                <span className="text-[10px] font-bold text-rose-600 uppercase">Absent Days</span>
                <p className="text-2xl font-black text-rose-700 dark:text-rose-300">
                  {selectedMonthForModal.absentCount}
                </p>
                <span className="text-[9px] text-rose-500">Days missed</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-center">
                <span className="text-[10px] font-bold text-amber-600 uppercase">Late Marks</span>
                <p className="text-2xl font-black text-amber-700 dark:text-amber-300">
                  {selectedMonthForModal.lateCount}
                </p>
                <span className="text-[9px] text-amber-500">Days late</span>
              </div>
            </div>

            {/* Daily Calendar Matrix Table */}
            <div className="overflow-x-auto rounded-2xl border border-brand-200 dark:border-brand-900">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-brand-100/50 dark:bg-brand-900/50 text-[10px] font-black uppercase text-brand-500 border-b border-brand-200 dark:border-brand-800">
                    <th className="px-4 py-3">Day / Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Check In</th>
                    <th className="px-4 py-3">Check Out</th>
                    <th className="px-4 py-3">Late (min)</th>
                    <th className="px-4 py-3 text-right">Face Match</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100 dark:divide-brand-900 text-xs font-semibold">
                  {selectedMonthForModal.dailyDetails.map((day) => {
                    const dayDate = new Date(day.date);
                    const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });

                    return (
                      <tr
                        key={day.day}
                        className={`hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-colors ${
                          day.isSunday ? 'bg-brand-50/30 dark:bg-brand-950/20' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-brand-200/50 dark:bg-brand-800 text-[11px] font-black text-brand-950 dark:text-white flex items-center justify-center">
                              {day.day}
                            </span>
                            <div>
                              <p className="font-extrabold text-brand-950 dark:text-white leading-tight">
                                {dayName}
                              </p>
                              <span className="text-[10px] text-brand-400">{day.date}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {day.status === 'PRE_JOINING' ? (
                            <span className="text-[10px] font-medium text-brand-400 italic">
                              Before Joining Date
                            </span>
                          ) : day.isHoliday ? (
                            <span className="text-[10px] font-bold text-pink-600 dark:text-pink-400">
                              Holiday
                            </span>
                          ) : day.isSunday ? (
                            <span className="text-[10px] font-bold text-brand-400">
                              Sunday
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                              Working Day
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase border ${getDayStatusColor(
                                day.status
                              )}`}
                            >
                              {day.status === 'NOT_RECORDED' ? 'LIVE PENDING' : day.status.replace(/_/g, ' ')}
                            </span>
                            {!day.checkIn && day.status === 'PRESENT' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                Physical Register
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-brand-950 dark:text-white font-mono">
                          {day.checkIn
                            ? new Date(day.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : day.status === 'PRESENT'
                            ? 'Physical Log'
                            : '--:--'}
                        </td>
                        <td className="px-4 py-3 text-brand-950 dark:text-white font-mono">
                          {day.checkOut
                            ? new Date(day.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : day.status === 'PRESENT'
                            ? 'Physical Log'
                            : '--:--'}
                        </td>
                        <td className={`px-4 py-3 ${day.lateMinutes > 0 ? 'text-amber-500 font-bold' : 'text-brand-400'}`}>
                          {day.lateMinutes > 0 ? `${day.lateMinutes}m` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {day.faceMatchScore ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-black">
                              {Math.round(day.faceMatchScore * 100)}%
                            </span>
                          ) : (
                            <span className="text-brand-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Modal Close Action */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedMonthForModal(null)}
                className="px-6 py-2.5 rounded-2xl bg-brand-950 dark:bg-white text-white dark:text-brand-950 font-black text-xs uppercase tracking-wider hover:opacity-90 transition-opacity"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
