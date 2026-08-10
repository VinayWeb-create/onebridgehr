import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Calendar, CheckCircle, Clock, MapPin, AlertCircle, AlertTriangle, Coffee, Play, Pause, Download
} from 'lucide-react';

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
}

export const Attendance: React.FC = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayLog, setTodayLog] = useState<AttendanceLog | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locError, setLocError] = useState('');

  useEffect(() => {
    fetchAttendance();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => setLocError(err.message)
      );
    } else {
      setLocError('Geolocation not supported');
    }
  }, []);

  const handleCheckIn = async () => {
    if (!location) {
      alert('Location not available. Please allow location access.');
      return;
    }
    try {
      await api.post('/attendance/check-in/gps', {
        latitude: location.lat,
        longitude: location.lng,
        workFromHome: false
      });
      alert('Checked in successfully!');
      fetchAttendance();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to check in');
    }
  };

  const handleCheckOut = async () => {
    try {
      await api.post('/attendance/check-out');
      alert('Checked out successfully!');
      fetchAttendance();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to check out');
    }
  };

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

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="font-extrabold text-2xl tracking-tight text-brand-950 dark:text-white">Attendance Registry</h1>
        <p className="text-xs text-brand-500 mt-1 font-semibold">Track check-ins, break durations, and overtime metrics</p>
      </div>

      {/* Grid: Console and History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Geo Location / Check-in Console */}
        <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-xl h-fit space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-brand-100 dark:border-brand-900">
            <h3 className="font-bold text-sm uppercase tracking-wider">Secure Geo-Registry</h3>
            <span className="flex items-center text-[10px] text-emerald-500 font-bold bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md">
              <MapPin size={10} className="mr-1" />
              <span>GPS Enabled</span>
            </span>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-brand-100/50 dark:bg-brand-900/50 rounded-2xl border border-brand-200 dark:border-brand-800 space-y-3">
              <p className="text-[10px] font-bold text-brand-500 uppercase pl-1">Device Coordinates</p>
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
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleCheckIn}
                disabled={!!todayLog?.checkIn}
                className={`flex-1 py-3 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-md ${
                  todayLog?.checkIn 
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-400' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                }`}
              >
                Clock In
              </button>
              <button
                onClick={handleCheckOut}
                disabled={!todayLog?.checkIn || !!todayLog?.checkOut}
                className={`flex-1 py-3 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-md ${
                  !todayLog?.checkIn || todayLog?.checkOut
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-400'
                    : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                }`}
              >
                Clock Out
              </button>
            </div>

            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/10 rounded-2xl space-y-2 flex items-start space-x-2 text-[10px] text-indigo-600 font-semibold leading-normal">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <p>Checked-in sessions log coordinates dynamically to verify presence. Standard office start window is 9:30 AM - 10:00 AM.</p>
            </div>
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

    </div>
  );
};

export default Attendance;
