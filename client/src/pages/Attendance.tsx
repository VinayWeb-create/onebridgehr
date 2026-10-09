import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDialog } from '../context/DialogContext';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getClientDeviceInfo } from '../utils/deviceFingerprint';
import { extractFaceEmbeddingFromCanvas, LivenessDetector } from '../utils/faceBiometrics';
import { getResilientPosition, getFriendlyGpsErrorMessage } from '../utils/geolocation';
import {
  Calendar, CheckCircle, Clock, MapPin, AlertCircle, AlertTriangle, Coffee, Play, Download,
  FileText, Users, Code, Key, LogOut, Activity, ShieldCheck, Camera, Smartphone, Scan,
  RotateCcw, Sliders, ChevronRight, CheckCircle2, Crosshair, Sparkles, Filter, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  officeName?: string;
  distanceFromOffice?: number;
  faceMatchScore?: number;
  verificationStatus?: string;
  breaks?: BreakSession[];
}

export const Attendance: React.FC = () => {
  const { alert, confirm } = useDialog();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [history, setHistory] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayLog, setTodayLog] = useState<AttendanceLog | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locError, setLocError] = useState('');

  // Tab State
  const [activeTab, setActiveTab] = useState<'MY_ATTENDANCE' | 'ADMIN_DASHBOARD'>('MY_ATTENDANCE');
  const [checkInCode, setCheckInCode] = useState('');
  const [adminStats, setAdminStats] = useState<any>(null);
  const [dailyCode, setDailyCode] = useState<any>(null);

  // Enrollment & Office Status
  const [isEnrolled, setIsEnrolled] = useState<boolean>(true);
  const [enrollmentChecked, setEnrollmentChecked] = useState<boolean>(false);
  const [assignedOffice, setAssignedOffice] = useState<any>(null);

  // Smart Biometric Verification Modal State
  const [smartModalOpen, setSmartModalOpen] = useState<boolean>(false);
  const [verificationAction, setVerificationAction] = useState<'CHECK_IN' | 'CHECK_OUT'>('CHECK_IN');
  const [livenessStatus, setLivenessStatus] = useState<string>('Initializing camera...');
  const [livenessScore, setLivenessScore] = useState<number>(0);
  const [livenessPassed, setLivenessPassed] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);

  // Video and Liveness Detector Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const livenessDetectorRef = useRef<LivenessDetector>(new LivenessDetector());
  const animFrameRef = useRef<number | null>(null);

  // Admin Logs State
  const [verificationLogs, setVerificationLogs] = useState<any[]>([]);
  const [logFilterStatus, setLogFilterStatus] = useState<string>('ALL');

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'HR';

  useEffect(() => {
    fetchAttendance();
    fetchEnrollmentStatus();
    if (isAdmin) {
      fetchAdminStats();
      fetchDailyCode();
      fetchVerificationLogs();
    }
    getResilientPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setLocError(getFriendlyGpsErrorMessage(err))
    );
  }, [isAdmin]);

  const fetchEnrollmentStatus = async () => {
    try {
      const res = await api.get('/attendance/enrollment/status');
      if (res.data.status === 'success') {
        setIsEnrolled(res.data.data.isEnrolled);
        setAssignedOffice(res.data.data.office);
      }
    } catch (err) {
      console.error('Failed to check enrollment status:', err);
    } finally {
      setEnrollmentChecked(true);
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

  const fetchAdminStats = async () => {
    try {
      const res = await api.get('/attendance/smart/dashboard');
      if (res.data.status === 'success') {
        setAdminStats(res.data.data);
      }
    } catch (err) {
      // Fallback to legacy dashboard
      try {
        const resOld = await api.get('/attendance/dashboard');
        setAdminStats(resOld.data.data);
      } catch (e) {}
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

  const fetchVerificationLogs = async () => {
    try {
      const res = await api.get(`/attendance/smart/logs?status=${logFilterStatus}`);
      if (res.data.status === 'success') {
        setVerificationLogs(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch verification logs:', err);
    }
  };

  useEffect(() => {
    if (isAdmin && activeTab === 'ADMIN_DASHBOARD') {
      fetchVerificationLogs();
    }
  }, [logFilterStatus, activeTab]);

  /* -------------------------------------------------------------
     SMART BIOMETRIC AUTO-VERIFICATION WORKFLOW
  ------------------------------------------------------------- */
  const startSmartVerification = (action: 'CHECK_IN' | 'CHECK_OUT') => {
    setVerificationAction(action);
    setSmartModalOpen(true);
    setLivenessStatus('Starting biometric scanner...');
    setLivenessScore(0);
    setLivenessPassed(false);
    livenessDetectorRef.current.reset();

    // Start video stream
    setTimeout(() => {
      openCamera();
    }, 100);
  };

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      runLivenessLoop();
    } catch (err: any) {
      setLivenessStatus('Camera access denied or unavailable: ' + err.message);
    }
  };

  const closeSmartModal = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setSmartModalOpen(false);
    setVerifying(false);
  };

  const runLivenessLoop = () => {
    if (!videoRef.current || !streamRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');

    const checkFrame = () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

      if (ctx && videoRef.current.videoWidth) {
        ctx.drawImage(videoRef.current, 0, 0, 320, 240);
        const result = livenessDetectorRef.current.processFrame(canvas);

        setLivenessScore(result.score);
        setLivenessStatus(result.instruction);

        if (result.passed && !livenessPassed) {
          setLivenessPassed(true);
          // Automatically trigger server biometric match once liveness passes!
          triggerServerVerification();
          return;
        }
      }

      animFrameRef.current = requestAnimationFrame(checkFrame);
    };

    animFrameRef.current = requestAnimationFrame(checkFrame);
  };

  const triggerServerVerification = () => {
    if (!videoRef.current) return;
    setVerifying(true);
    setLivenessStatus('Liveness verified! Matching biometric embedding with server...');

    // 1. Capture snapshot and compute 128-dim embedding
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const liveEmbedding = extractFaceEmbeddingFromCanvas(canvas);

    // 2. Fetch current GPS coordinates
    if (!navigator.geolocation) {
      alert({ title: 'GPS Required', message: 'Geolocation is not supported by your device', variant: 'error' });
      closeSmartModal();
      return;
    }

    getResilientPosition(
      async (pos) => {
        try {
          const deviceInfo = getClientDeviceInfo();

          const payload = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            gpsAccuracy: pos.coords.accuracy,
            faceEmbedding: liveEmbedding,
            livenessScore: 0.95,
            livenessPassed: true,
            deviceId: deviceInfo.deviceId,
            deviceName: deviceInfo.deviceName,
            browser: deviceInfo.browser,
            os: deviceInfo.os,
            forcedAction: verificationAction,
          };

          const res = await api.post('/attendance/smart/verify-and-mark', payload);

          if (res.data.status === 'success') {
            closeSmartModal();
            alert({
              title: 'Verification Successful!',
              message: `${res.data.message} (Distance: ${res.data.data.verification.distanceMeters}m from ${res.data.data.verification.office})`,
              variant: 'info',
            });
            fetchAttendance();
          }
        } catch (err: any) {
          const data = err.response?.data;
          const msg = data?.message || 'Smart attendance verification failed';
          if (data?.markedAbsent || data?.isLockedAbsent || data?.warningCount >= 3) {
            alert({
              title: '⚠️ 3/3 Warnings Exceeded — Marked ABSENT',
              message: msg,
              variant: 'error',
            });
          } else if (data?.warningCount) {
            alert({
              title: `⚠️ Security Warning ${data.warningCount} of ${data.maxWarnings || 3}`,
              message: msg,
              variant: 'warning',
            });
          } else {
            alert({ title: 'Verification Failed', message: msg, variant: 'error' });
          }
          closeSmartModal();
          fetchAttendance();
        }
      },
      (geoErr) => {
        alert({ title: 'GPS Error', message: getFriendlyGpsErrorMessage(geoErr), variant: 'error' });
        closeSmartModal();
      }
    );
  };

  /* -------------------------------------------------------------
     LEGACY ATTENDANCE HANDLERS (PRESERVED)
  ------------------------------------------------------------- */
  const handleCheckInGPS = async () => {
    if (!location) {
      alert({ title: 'Notification', message: 'Location not available. Please allow location access.', variant: 'info' });
      return;
    }
    try {
      await api.post('/attendance/checkin/gps', {
        latitude: location.lat,
        longitude: location.lng,
        workFromHome: false,
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
      await api.post('/attendance/checkin/code', { code: checkInCode });
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-brand-900 via-indigo-950 to-brand-950 p-6 rounded-3xl border border-brand-800 shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2 border border-indigo-500/30">
            <ShieldCheck size={14} className="text-indigo-400" /> Smart Biometric Attendance
          </div>
          <h1 className="font-extrabold text-2xl tracking-tight text-white flex items-center gap-2">
            <Activity className="text-indigo-400" size={24} />
            Attendance Registry
          </h1>
          <p className="text-xs text-brand-300 mt-1 font-medium">
            Biometric facial verification, GPS geofencing compliance, and real-time attendance logs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <Link
              to="/attendance/setup"
              className="px-4 py-2 bg-indigo-600/40 hover:bg-indigo-600 border border-indigo-500/50 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-md"
            >
              <Sliders size={14} /> Attendance Setup
            </Link>
          )}

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
            {isAdmin && (
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
            )}
          </div>
        </div>
      </div>

      {/* ENROLLMENT PENDING WARNING BANNER */}
      {enrollmentChecked && !isEnrolled && (
        <div className="p-6 rounded-3xl bg-amber-500/10 border-2 border-amber-500/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-500/30 flex-shrink-0">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-amber-900 dark:text-amber-200">
                Attendance Setup is Required Before You Can Mark Attendance
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Please complete one-time facial biometric registration and workstation authorization to clock in.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/attendance/enrollment')}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold rounded-xl uppercase tracking-wider shadow-md shadow-amber-500/20 flex items-center gap-2 flex-shrink-0"
          >
            Complete Attendance Enrollment <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* =============================================================
         TAB 1: MY ATTENDANCE WORKFLOW
      ============================================================= */}
      {activeTab === 'MY_ATTENDANCE' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Smart Biometric Console */}
          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-xl h-fit space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-brand-100 dark:border-brand-900">
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wider text-brand-950 dark:text-white">
                  Biometric Clock-In Console
                </h3>
                <p className="text-[11px] text-brand-500">
                  {assignedOffice?.name || 'Assigned Office Geofence'}
                </p>
              </div>
              <span className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Scan size={18} />
              </span>
            </div>

            <div className="space-y-4">
              {/* If Locked ABSENT due to 3 warnings */}
              {((todayLog as any)?.isLockedAbsent || (todayLog?.status === 'ABSENT' && todayLog?.verificationStatus?.includes('FAILED_FRAUD_LOCKED'))) ? (
                <div className="p-5 rounded-2xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs space-y-3 text-center shadow-md">
                  <div className="w-14 h-14 rounded-full bg-rose-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-rose-950/50">
                    <AlertTriangle size={26} />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-rose-300 uppercase tracking-wider">
                      Locked: Automatically Marked ABSENT
                    </h4>
                    <p className="text-[11px] text-rose-200/90 leading-relaxed max-w-xs mx-auto mt-1">
                      You exceeded 3 failed verification attempts today. As per security policy, you have been automatically marked <strong>ABSENT</strong> for today and attendance check-in is disabled.
                    </p>
                  </div>
                  <div className="px-3 py-1.5 bg-rose-900/50 rounded-xl text-[10px] font-bold text-rose-300 border border-rose-500/30">
                    Status: ABSENT (Security Locked)
                  </div>
                </div>
              ) : (!todayLog?.checkIn || todayLog?.status === 'ABSENT') ? (
                <div className="space-y-4">
                  {/* Warning notice if 1 or 2 warnings */}
                  {(todayLog as any)?.warningCount > 0 && (
                    <div className="p-3 rounded-2xl bg-amber-950/50 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2.5 shadow-sm">
                      <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                      <p className="text-[11px] font-semibold leading-tight">
                        <strong>Warning {(todayLog as any).warningCount}/3:</strong>{' '}
                        {3 - (todayLog as any).warningCount} verification attempt(s) remaining before being automatically marked ABSENT.
                      </p>
                    </div>
                  )}

                  <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-brand-500/5 border border-indigo-500/20 text-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-xl shadow-indigo-600/30">
                      <Camera size={28} />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-brand-950 dark:text-white">
                        Smart Biometric Verification
                      </h4>
                      <p className="text-[11px] text-brand-500 mt-1 max-w-xs mx-auto">
                        Automated GPS Geofence & Facial Liveness verification. One click marks attendance instantly.
                      </p>
                    </div>

                    <button
                      onClick={() => startSmartVerification('CHECK_IN')}
                      disabled={!isEnrolled}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black text-xs uppercase tracking-wider shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                    >
                      <Scan size={16} /> Verify & Clock In (Smart)
                    </button>
                  </div>

                  {/* Fallback Check-in Methods Collapsible/Secondary */}
                  <details className="group rounded-2xl border border-brand-200 dark:border-brand-800 p-3 bg-brand-50/50 dark:bg-brand-900/20">
                    <summary className="text-[11px] font-bold text-brand-500 uppercase cursor-pointer list-none flex justify-between items-center">
                      <span>Alternative Check-In Methods</span>
                      <ChevronRight size={14} className="transform group-open:rotate-90 transition-transform" />
                    </summary>
                    <div className="mt-3 space-y-3 pt-3 border-t border-brand-100 dark:border-brand-900">
                      {/* GPS Check-in */}
                      <button
                        onClick={handleCheckInGPS}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                      >
                        Clock In (Standard GPS)
                      </button>

                      {/* Code Check-in */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Daily Code"
                          value={checkInCode}
                          onChange={(e) => setCheckInCode(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-950 uppercase"
                        />
                        <button
                          onClick={handleCheckInCode}
                          className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg"
                        >
                          Submit
                        </button>
                      </div>
                    </div>
                  </details>
                </div>
              ) : null}

              {/* Checked In & Active Shift */}
              {todayLog?.checkIn && !todayLog?.checkOut && (
                <div className="space-y-4">
                  <div className="p-5 bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900 flex flex-col items-center justify-center space-y-2 text-center">
                    <div className="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                      <Clock className="text-indigo-600 animate-pulse" size={26} />
                    </div>
                    <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                      Currently Clocked In
                    </p>
                    <p className="text-sm font-extrabold text-brand-950 dark:text-white">
                      Since {new Date(todayLog.checkIn).toLocaleTimeString()}
                    </p>
                    {todayLog.faceMatchScore && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        ✓ Biometrically Verified ({Math.round(todayLog.faceMatchScore * 100)}% match)
                      </span>
                    )}
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
                      onClick={() => startSmartVerification('CHECK_OUT')}
                      className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider text-xs transition-all bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 flex items-center justify-center gap-2"
                    >
                      <LogOut size={14} /> Clock Out (Smart)
                    </button>
                  </div>
                </div>
              )}

              {/* Checked Out */}
              {todayLog?.checkOut && (
                <div className="p-5 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900 flex flex-col items-center justify-center space-y-2 text-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                    <CheckCircle className="text-emerald-600" size={28} />
                  </div>
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                    Clocked Out
                  </p>
                  <p className="text-xs font-semibold text-brand-600 dark:text-brand-400">
                    Shift Completed for Today at {new Date(todayLog.checkOut).toLocaleTimeString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Attendance History */}
          <div className="lg:col-span-2 glass rounded-3xl overflow-hidden border border-brand-200 dark:border-brand-900 shadow-xl flex flex-col justify-between">
            <div className="p-6 pb-4 border-b border-brand-200 dark:border-brand-900 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wider text-brand-950 dark:text-white">
                  Attendance Logs
                </h3>
                <p className="text-xs text-brand-500">Biometric verification audit trail</p>
              </div>
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
                    <th className="px-6 py-3.5">Biometric Match</th>
                    <th className="px-6 py-3.5">Distance</th>
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
                      <td colSpan={7} className="text-center py-6 text-brand-500">
                        No attendance history logs found.
                      </td>
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
                        <td className="px-6 py-4">
                          {log.faceMatchScore ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              {Math.round(log.faceMatchScore * 100)}%
                            </span>
                          ) : (
                            <span className="text-brand-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-brand-500">
                          {log.distanceFromOffice !== undefined && log.distanceFromOffice !== null
                            ? `${log.distanceFromOffice}m`
                            : '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase ${getStatusBadge(
                              log.status
                            )}`}
                          >
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

      {/* =============================================================
         TAB 2: ADMIN ATTENDANCE DASHBOARD
      ============================================================= */}
      {activeTab === 'ADMIN_DASHBOARD' && isAdmin && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="glass p-5 rounded-2xl border border-brand-200 dark:border-brand-900 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-bold text-brand-500 uppercase tracking-wider">Present Today</h4>
                <CheckCircle size={14} className="text-emerald-500" />
              </div>
              <p className="text-2xl font-black text-brand-950 dark:text-white">
                {adminStats?.stats?.presentCount ?? adminStats?.today?.presentToday ?? 0}
              </p>
            </div>

            <div className="glass p-5 rounded-2xl border border-brand-200 dark:border-brand-900 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-bold text-brand-500 uppercase tracking-wider">Absent</h4>
                <AlertCircle size={14} className="text-rose-500" />
              </div>
              <p className="text-2xl font-black text-brand-950 dark:text-white">
                {adminStats?.stats?.absentCount ?? adminStats?.today?.absent ?? 0}
              </p>
            </div>

            <div className="glass p-5 rounded-2xl border border-brand-200 dark:border-brand-900 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-bold text-brand-500 uppercase tracking-wider">Late Arrivals</h4>
                <Clock size={14} className="text-amber-500" />
              </div>
              <p className="text-2xl font-black text-brand-950 dark:text-white">
                {adminStats?.stats?.lateCount ?? adminStats?.today?.late ?? 0}
              </p>
            </div>

            <div className="glass p-5 rounded-2xl border border-brand-200 dark:border-brand-900 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-bold text-brand-500 uppercase tracking-wider">Outside Geofence</h4>
                <MapPin size={14} className="text-rose-500" />
              </div>
              <p className="text-2xl font-black text-rose-600 dark:text-rose-400">
                {adminStats?.stats?.geofenceBreachesToday ?? 0}
              </p>
            </div>

            <div className="glass p-5 rounded-2xl border border-brand-200 dark:border-brand-900 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-bold text-brand-500 uppercase tracking-wider">Enrollment Pending</h4>
                <Users size={14} className="text-indigo-500" />
              </div>
              <p className="text-2xl font-black text-brand-950 dark:text-white">
                {adminStats?.stats?.pendingEnrollment ?? 0}
              </p>
            </div>

            <div className="glass p-5 rounded-2xl border border-brand-200 dark:border-brand-900 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-bold text-brand-500 uppercase tracking-wider">Failed Verifications</h4>
                <ShieldCheck size={14} className="text-amber-500" />
              </div>
              <p className="text-2xl font-black text-brand-950 dark:text-white">
                {adminStats?.stats?.failedAttemptsToday ?? 0}
              </p>
            </div>
          </div>

          {/* Real-time Verification Audit Logs Table */}
          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-xl bg-white dark:bg-brand-950 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-brand-950 dark:text-white flex items-center gap-2">
                  <Activity size={16} className="text-indigo-500" />
                  Live Attendance Check-Ins & Verification Logs
                </h3>
                <p className="text-xs text-brand-500">
                  Real-time audit stream of biometric and geographic verification events
                </p>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-brand-400" />
                <select
                  value={logFilterStatus}
                  onChange={(e) => setLogFilterStatus(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-brand-200 dark:border-brand-800 text-xs font-bold bg-brand-50 dark:bg-brand-900/40 text-brand-950 dark:text-white outline-none"
                >
                  <option value="ALL">All Events</option>
                  <option value="SUCCESS">Success Only</option>
                  <option value="OUTSIDE_GEOFENCE">Outside Geofence</option>
                  <option value="FACE_MISMATCH">Face Mismatch</option>
                  <option value="DEVICE_MISMATCH">Device Mismatch</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-brand-100/40 dark:bg-brand-900/40 text-[10px] uppercase font-bold text-brand-500 border-b border-brand-200 dark:border-brand-800">
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3">Employee</th>
                    <th className="px-5 py-3">Event</th>
                    <th className="px-5 py-3">Office</th>
                    <th className="px-5 py-3">Distance</th>
                    <th className="px-5 py-3">Face Match</th>
                    <th className="px-5 py-3 text-right">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100 dark:divide-brand-900 font-semibold">
                  {verificationLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-6 text-brand-500">
                        No verification logs found for this filter.
                      </td>
                    </tr>
                  ) : (
                    verificationLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-brand-100/20 dark:hover:bg-brand-900/20">
                        <td className="px-5 py-3 text-brand-500">
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="px-5 py-3">
                          <p className="font-bold text-brand-950 dark:text-white">
                            {log.employeeName || log.employeeId}
                          </p>
                          <p className="text-[10px] text-brand-400">{log.employeeId}</p>
                        </td>
                        <td className="px-5 py-3 text-indigo-600 dark:text-indigo-400 font-bold uppercase text-[10px]">
                          {log.eventType}
                        </td>
                        <td className="px-5 py-3 text-brand-600 dark:text-brand-300">
                          {log.officeName || 'HQ Campus'}
                        </td>
                        <td className="px-5 py-3 font-mono">
                          {log.distanceFromOffice !== null ? `${log.distanceFromOffice}m` : '-'}
                        </td>
                        <td className="px-5 py-3">
                          {log.faceMatchScore ? `${Math.round(log.faceMatchScore * 100)}%` : '-'}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                              log.status === 'SUCCESS'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                                : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                            }`}
                          >
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

          {/* Daily Code & Report Export Panels (Preserved) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-xl space-y-4">
              <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                <Code size={16} className="text-indigo-500" /> Daily Check-In Code
              </h3>
              <div className="p-6 bg-brand-100/50 dark:bg-brand-900/50 rounded-2xl border border-brand-200 dark:border-brand-800 flex flex-col items-center justify-center space-y-3">
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

            <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-xl space-y-4">
              <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                <FileText size={16} className="text-emerald-500" /> Export Monthly Reports
              </h3>
              <div className="p-6 bg-brand-100/50 dark:bg-brand-900/50 rounded-2xl border border-brand-200 dark:border-brand-800 flex flex-col justify-between space-y-4 h-[160px]">
                <p className="text-xs font-semibold text-brand-600 dark:text-brand-400">
                  Export complete verified logs, overtime calculations, late metrics, and device audit trail as CSV.
                </p>
                <button
                  onClick={handleExportCSV}
                  className="w-full py-3 rounded-xl font-bold uppercase tracking-wider text-xs transition-all bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
                >
                  <Download size={16} /> Export Attendance CSV Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================
         SMART BIOMETRIC SCANNER POPUP MODAL
      ============================================================= */}
      {smartModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-brand-950 text-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-indigo-500/40 shadow-2xl relative space-y-6"
          >
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-600 rounded-xl">
                  <Scan size={18} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold">
                    {verificationAction === 'CHECK_IN' ? 'Clock In Biometric Scan' : 'Clock Out Biometric Scan'}
                  </h3>
                  <p className="text-[11px] text-brand-400">{assignedOffice?.name || 'Office Geofence'}</p>
                </div>
              </div>
              <button onClick={closeSmartModal} className="text-brand-400 hover:text-white p-1">
                ✕
              </button>
            </div>

            {/* Live Camera View with Biometric Oval Guide */}
            <div className="relative bg-black rounded-2xl overflow-hidden aspect-[4/3] border-2 border-indigo-500/40 shadow-inner flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />

              {/* Biometric Oval Frame Guide */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div
                  className={`w-48 h-64 border-2 border-dashed rounded-[50%] flex items-center justify-center transition-all ${
                    livenessPassed
                      ? 'border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.5)]'
                      : 'border-indigo-400 animate-pulse shadow-[0_0_20px_rgba(99,102,241,0.3)]'
                  }`}
                >
                  <Crosshair
                    size={28}
                    className={livenessPassed ? 'text-emerald-400' : 'text-indigo-400/40'}
                  />
                </div>
              </div>

              {/* Liveness Result Pill */}
              <div className="absolute top-3 inset-x-3 flex justify-between items-center bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs">
                <span className="text-[11px] font-bold text-indigo-300 truncate max-w-[220px]">
                  {livenessStatus}
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 bg-indigo-600 rounded-md">
                  {Math.round(livenessScore * 100)}% Liveness
                </span>
              </div>
            </div>

            {/* Progress / Action Status */}
            <div className="space-y-3">
              <div className="h-1.5 w-full bg-brand-900 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    livenessPassed ? 'bg-emerald-500' : 'bg-indigo-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.round(livenessScore * 100))}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-xs text-brand-400">
                <span>Hold face steady in oval frame</span>
                {verifying && (
                  <span className="text-indigo-400 font-bold flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                    Validating GPS & Biometrics...
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={closeSmartModal}
              className="w-full py-2.5 rounded-xl border border-white/10 text-brand-400 hover:text-white text-xs font-bold"
            >
              Cancel Verification
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
