import { useDialog } from '../context/DialogContext';
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Calendar, CheckCircle, Clock, MapPin, AlertCircle, AlertTriangle, Coffee, Play, Pause, Download,
  QrCode, FileText, Users, Code, Key, LogOut, Activity
} from 'lucide-react';

interface BreakSession {
  start: string;
  end?: string;
}

interface AttendanceLog {
  id: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: string;
  overtimeMinutes: number;
  lateMinutes: number;
  workFromHome: boolean;
  latitude?: number;
  longitude?: number;
  breaks?: BreakSession[];
}

export const Attendance: React.FC = () => {
  const { alert, confirm } = useDialog();
  const { user } = useAuth();
  const [history, setHistory] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayLog, setTodayLog] = useState<AttendanceLog | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locError, setLocError] = useState('');
  
  // New State
  const [activeTab, setActiveTab] = useState<'MY_ATTENDANCE' | 'ADMIN_DASHBOARD'>('MY_ATTENDANCE');
  const [checkInCode, setCheckInCode] = useState('');
  const [adminStats, setAdminStats] = useState<any>(null);
  const [dailyCode, setDailyCode] = useState<any>(null);

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'HR';

  useEffect(() => {
    fetchAttendance();
    if (isAdmin) {
      fetchAdminStats();
      fetchDailyCode();
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => setLocError(err.message)
      );
    } else {
      setLocError('Geolocation not supported');
    }
  }, [isAdmin]);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const resToday = await api.get('/attendance/today');
      setTodayLog(resToday.data.data);

      const resHist = await api.get('/attendance/history');
      setHistory(resHist.data.data);
    } catch (err) {
      console.error('Failed to load attendance logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminStats = async () => {
    try {
      const res = await api.get('/attendance/dashboard');
      setAdminStats(res.data.data);
    } catch (err) {
      console.error('Failed to fetch admin stats:', err);
    }
  };

  const fetchDailyCode = async () => {
    try {
      const res = await api.get('/attendance/code/today');
      setDailyCode(res.data.data);
    } catch (err) {
      console.error('Failed to fetch daily code:', err);
    }
  };

  const handleCheckInGPS = async () => {
    if (!location) {
      alert({ title: 'Notification', message: 'Location not available. Please allow location access.', variant: 'info' });
      return;
    }
    try {
      await api.post('/attendance/checkin/gps', {
        latitude: location.lat,
        longitude: location.lng,
        workFromHome: false
      });
      alert({ title: 'Notification', message: 'Checked in via GPS successfully!', variant: 'info' });
      fetchAttendance();
    } catch (err: any) {
      alert({ title: 'Error', message: err.response?.data?.message || 'Failed to check in via GPS', variant: 'error' });
    }
  };

  const handleCheckInCode = async () => {
    if (!checkInCode) {
      alert({ title: 'Notification', message: 'Please enter a code', variant: 'info' });
      return;
    }
    try {
      await api.post('/attendance/checkin/code', {
        code: checkInCode
      });
      alert({ title: 'Notification', message: 'Checked in with Code successfully!', variant: 'info' });
      setCheckInCode('');
      fetchAttendance();
    } catch (err: any) {
      alert({ title: 'Error', message: err.response?.data?.message || 'Failed to check in with Code', variant: 'error' });
    }
  };

  const handleCheckOut = async () => {
    try {
      await api.post('/attendance/check-out');
      alert({ title: 'Notification', message: 'Checked out successfully!', variant: 'info' });
      fetchAttendance();
    } catch (err: any) {
      alert({ title: 'Error', message: err.response?.data?.message || 'Failed to check out', variant: 'error' });
    }
  };

  const handleStartBreak = async () => {
    try {
      await api.post('/attendance/break/start');
      alert({ title: 'Notification', message: 'Break started', variant: 'info' });
      fetchAttendance();
    } catch (err: any) {
      alert({ title: 'Error', message: err.response?.data?.message || 'Failed to start break', variant: 'error' });
    }
  };

  const handleEndBreak = async () => {
    try {
      await api.post('/attendance/break/end');
      alert({ title: 'Notification', message: 'Break ended', variant: 'info' });
      fetchAttendance();
    } catch (err: any) {
      alert({ title: 'Error', message: err.response?.data?.message || 'Failed to end break', variant: 'error' });
    }
  };

  const handleGenerateCode = async () => {
    try {
      const res = await api.post('/attendance/code/generate');
      setDailyCode(res.data.data);
      alert({ title: 'Notification', message: 'Code generated successfully', variant: 'info' });
    } catch (err: any) {
      alert({ title: 'Error', message: err.response?.data?.message || 'Failed to generate code', variant: 'error' });
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await api.get('/attendance/report/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert({ title: 'Notification', message: 'Failed to export CSV', variant: 'info' });
    }
  };

  const getStatusBadge = (status: string) => {
    const maps: Record<string, string> = {
      PRESENT: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400',
      LATE: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400',
      ABSENT: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400',
      WORK_FROM_HOME: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400',
      HALF_DAY: 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-400',
      HOLIDAY: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-400',
    };
    return maps[status] || 'bg-brand-100 text-brand-800';
  };

  const activeBreak = todayLog?.breaks?.find((b) => !b.end);

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-brand-900 to-indigo-950 p-6 rounded-3xl border border-brand-800 shadow-xl">
        <div>
          <h1 className="font-extrabold text-2xl tracking-tight text-white flex items-center gap-2">
            <Activity className="text-indigo-400" size={24} />
            Attendance Registry
          </h1>
          <p className="text-xs text-brand-300 mt-1 font-medium">Track check-ins, active break durations, and overtime compliance metrics</p>
        </div>
        {isAdmin && (
          <div className="flex bg-brand-800/60 p-1 rounded-xl w-fit border border-brand-700">
            <button
              onClick={() => setActiveTab('MY_ATTENDANCE')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'MY_ATTENDANCE'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-brand-300 hover:text-white'
              }`}
            >
              My Attendance
            </button>
            <button
              onClick={() => setActiveTab('ADMIN_DASHBOARD')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
                activeTab === 'ADMIN_DASHBOARD'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-brand-300 hover:text-white'
              }`}
            >
              <Users size={14} /> Admin Dashboard
            </button>
          </div>
        )}
      </div>

      {activeTab === 'MY_ATTENDANCE' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Geo Location / Check-in Console */}
          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-xl h-fit space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-brand-100 dark:border-brand-900">
              <h3 className="font-bold text-sm uppercase tracking-wider">Clock-In Console</h3>
            </div>

            <div className="space-y-4">
              
              {!todayLog?.checkIn && (
                <div className="space-y-4">
                  {/* GPS Check-in */}
                  <div className="p-4 bg-brand-100/50 dark:bg-brand-900/50 rounded-2xl border border-brand-200 dark:border-brand-800 space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-bold text-brand-500 uppercase">Device Coordinates</p>
                      <MapPin size={12} className="text-emerald-500" />
                    </div>
                    <div className="text-xs font-semibold space-y-1.5">
                      {locError ? (
                        <div className="text-red-500">{locError}</div>
                      ) : location ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-brand-400">Latitude</span>
                            <span className="text-brand-950 dark:text-white">{location.lat.toFixed(4)}°</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-brand-400">Longitude</span>
                            <span className="text-brand-950 dark:text-white">{location.lng.toFixed(4)}°</span>
                          </div>
                        </>
                      ) : (
                        <div className="text-brand-500">Fetching location...</div>
                      )}
                    </div>
                    <button
                      onClick={handleCheckInGPS}
                      disabled={!!todayLog?.checkIn}
                      className="w-full py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs transition-all bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                    >
                      Clock In (GPS)
                    </button>
                  </div>

                  {/* Code Check-in */}
                  <div className="p-4 bg-brand-100/50 dark:bg-brand-900/50 rounded-2xl border border-brand-200 dark:border-brand-800 space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-bold text-brand-500 uppercase">Office Code</p>
                      <Key size={12} className="text-indigo-500" />
                    </div>
                    <input
                      type="text"
                      placeholder="Enter daily code"
                      value={checkInCode}
                      onChange={(e) => setCheckInCode(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950 outline-none focus:border-indigo-500 uppercase"
                    />
                    <button
                      onClick={handleCheckInCode}
                      disabled={!!todayLog?.checkIn || !checkInCode}
                      className="w-full py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs transition-all bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 disabled:opacity-50"
                    >
                      Clock In (Code)
                    </button>
                  </div>
                </div>
              )}

              {todayLog?.checkIn && !todayLog?.checkOut && (
                <div className="space-y-4">
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900 flex flex-col items-center justify-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                      <Clock className="text-indigo-600 animate-pulse" size={24} />
                    </div>
                    <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                      Currently Clocked In
                    </p>
                    <p className="text-xs font-semibold text-brand-600 dark:text-brand-400">
                      Since {new Date(todayLog.checkIn).toLocaleTimeString()}
                    </p>
                  </div>

                  <div className="flex space-x-3">
                    {!activeBreak ? (
                      <button
                        onClick={handleStartBreak}
                        className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider text-xs transition-all bg-amber-500 hover:bg-amber-600 text-white shadow-md flex items-center justify-center gap-2"
                      >
                        <Coffee size={14} /> Start Break
                      </button>
                    ) : (
                      <button
                        onClick={handleEndBreak}
                        className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider text-xs transition-all bg-emerald-500 hover:bg-emerald-600 text-white shadow-md flex items-center justify-center gap-2"
                      >
                        <Play size={14} /> End Break
                      </button>
                    )}
                    
                    <button
                      onClick={handleCheckOut}
                      className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider text-xs transition-all bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 flex items-center justify-center gap-2"
                    >
                      <LogOut size={14} /> Clock Out
                    </button>
                  </div>
                </div>
              )}

              {todayLog?.checkOut && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900 flex flex-col items-center justify-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                    <CheckCircle className="text-emerald-600" size={24} />
                  </div>
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                    Clocked Out
                  </p>
                  <p className="text-xs font-semibold text-brand-600 dark:text-brand-400">
                    Shift Completed for Today
                  </p>
                </div>
              )}

            </div>
          </div>

          {/* Attendance History */}
          <div className="lg:col-span-2 glass rounded-3xl overflow-hidden border border-brand-200 dark:border-brand-900 shadow-xl flex flex-col justify-between">
            <div className="p-6 pb-4 border-b border-brand-200 dark:border-brand-900 flex justify-between items-center">
              <h3 className="font-bold text-sm uppercase tracking-wider">Attendance Logs</h3>
              <span className="text-xs text-brand-500 font-semibold">Previous 31 days</span>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-brand-100/30 dark:bg-brand-900/30 text-[10px] font-bold text-brand-500 uppercase border-b border-brand-200 dark:border-brand-900">
                    <th className="px-6 py-3.5">Log Date</th>
                    <th className="px-6 py-3.5">Check In</th>
                    <th className="px-6 py-3.5">Check Out</th>
                    <th className="px-6 py-3.5">Late (min)</th>
                    <th className="px-6 py-3.5">Overtime</th>
                    <th className="px-6 py-3.5">Work Type</th>
                    <th className="px-6 py-3.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100 dark:divide-brand-900 text-xs font-semibold">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-6">
                        <span className="w-5 h-5 rounded-full border-2 border-indigo-600/30 border-t-indigo-600 animate-spin inline-block" />
                      </td>
                    </tr>
                  ) : history.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-6 text-brand-500">No attendance history logs found.</td>
                    </tr>
                  ) : (
                    history.map((log) => (
                      <tr key={log.id} className="hover:bg-brand-100/20 dark:hover:bg-brand-900/20 transition-all">
                        <td className="px-6 py-4 font-bold">{new Date(log.date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-brand-950 dark:text-white">
                          {log.checkIn ? new Date(log.checkIn).toLocaleTimeString() : '--:--'}
                        </td>
                        <td className="px-6 py-4 text-brand-950 dark:text-white">
                          {log.checkOut ? new Date(log.checkOut).toLocaleTimeString() : '--:--'}
                        </td>
                        <td className={`px-6 py-4 ${log.lateMinutes > 0 ? 'text-amber-500' : 'text-brand-400'}`}>
                          {log.lateMinutes > 0 ? `${log.lateMinutes} min` : '-'}
                        </td>
                        <td className={`px-6 py-4 ${log.overtimeMinutes > 0 ? 'text-emerald-500' : 'text-brand-400'}`}>
                          {log.overtimeMinutes > 0 ? `${log.overtimeMinutes} min` : '-'}
                        </td>
                        <td className="px-6 py-4 text-brand-500 font-semibold uppercase text-[10px]">
                          {log.workFromHome ? 'WFH' : 'Office'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase ${getStatusBadge(log.status)}`}>
                            {log.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {activeTab === 'ADMIN_DASHBOARD' && isAdmin && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass p-5 rounded-2xl border border-brand-200 dark:border-brand-900 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-brand-500 uppercase tracking-wider">Present Today</h4>
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 rounded-lg">
                  <CheckCircle size={16} />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-brand-950 dark:text-white">
                {adminStats?.today?.presentToday || 0} <span className="text-sm text-brand-400 font-semibold">/ {adminStats?.today?.totalEmployees || 0}</span>
              </p>
            </div>
            
            <div className="glass p-5 rounded-2xl border border-brand-200 dark:border-brand-900 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-brand-500 uppercase tracking-wider">On Leave / Absent</h4>
                <div className="p-2 bg-rose-100 dark:bg-rose-900/40 text-rose-600 rounded-lg">
                  <AlertCircle size={16} />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-brand-950 dark:text-white">
                {(adminStats?.today?.absent || 0) + (adminStats?.today?.onLeave || 0)}
              </p>
            </div>

            <div className="glass p-5 rounded-2xl border border-brand-200 dark:border-brand-900 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-brand-500 uppercase tracking-wider">Late Arrivals</h4>
                <div className="p-2 bg-amber-100 dark:bg-amber-900/40 text-amber-600 rounded-lg">
                  <Clock size={16} />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-brand-950 dark:text-white">
                {adminStats?.today?.late || 0}
              </p>
            </div>

            <div className="glass p-5 rounded-2xl border border-brand-200 dark:border-brand-900 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-brand-500 uppercase tracking-wider">30-Day Avg</h4>
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 rounded-lg">
                  <Activity size={16} />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-brand-950 dark:text-white">
                {adminStats?.last30Days?.attendancePercentage || 0}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-xl space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                  <Code size={16} className="text-indigo-500" /> Daily Check-In Code
                </h3>
              </div>
              
              <div className="p-6 bg-brand-100/50 dark:bg-brand-900/50 rounded-2xl border border-brand-200 dark:border-brand-800 flex flex-col items-center justify-center space-y-4">
                {dailyCode ? (
                  <>
                    <p className="text-xs font-bold text-brand-500 uppercase tracking-wider">Today's Code</p>
                    <div className="text-4xl font-extrabold text-indigo-600 tracking-[0.2em]">
                      {dailyCode.code}
                    </div>
                    <p className="text-xs text-brand-400">Expires at 11:59 PM</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-brand-500 text-center">No code generated for today yet.</p>
                    <button
                      onClick={handleGenerateCode}
                      className="px-6 py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs transition-all bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20"
                    >
                      Generate New Code
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-xl space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                  <FileText size={16} className="text-emerald-500" /> Reports & Exports
                </h3>
              </div>
              
              <div className="p-6 bg-brand-100/50 dark:bg-brand-900/50 rounded-2xl border border-brand-200 dark:border-brand-800 flex flex-col justify-center space-y-4 h-full">
                <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                  Export detailed attendance logs for payroll processing and compliance. The report includes check-in/out times, late minutes, overtime, and work types for all employees.
                </p>
                <button
                  onClick={handleExportCSV}
                  className="w-full py-3 rounded-xl font-bold uppercase tracking-wider text-xs transition-all bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 mt-auto"
                >
                  <Download size={16} /> Export CSV Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Attendance;
