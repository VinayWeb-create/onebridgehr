import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import api from '../../services/api';
import { getClientDeviceInfo } from '../../utils/deviceFingerprint';
import { extractFaceEmbeddingFromCanvas, detectFacesInCanvas } from '../../utils/faceBiometrics';
import { getResilientPosition, getFriendlyGpsErrorMessage } from '../../utils/geolocation';
import {
  UserCheck,
  Camera,
  MapPin,
  Bell,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Sparkles,
  Building2,
  Lock,
  Layers,
  Check,
  Crosshair,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface OfficeInfo {
  id: string;
  name: string;
  branch: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export const AttendanceEnrollment: React.FC = () => {
  const { user, updateUserCache } = useAuth();
  const { alert } = useDialog();
  const navigate = useNavigate();

  // Wizard Steps (1 to 6)
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Enrollment Data
  const [office, setOffice] = useState<OfficeInfo | null>(null);
  const [isAlreadyEnrolled, setIsAlreadyEnrolled] = useState<boolean>(false);

  // Step 2: Permissions State
  const [cameraPermission, setCameraPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [gpsPermission, setGpsPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [notificationPermission, setNotificationPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');

  // Step 3: Face Enrollment (3 Angles: Front, Left, Right)
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [currentAngleIndex, setCurrentAngleIndex] = useState<number>(0);
  const [angleCaptures, setAngleCaptures] = useState<{
    front?: { preview: string; embedding: number[] };
    left?: { preview: string; embedding: number[] };
    right?: { preview: string; embedding: number[] };
  }>({});
  const [cameraActive, setCameraActive] = useState<boolean>(false);

  // Step 4: Device Registration
  const [deviceInfo, setDeviceInfo] = useState(getClientDeviceInfo());

  // Step 5: Office Geofence Verification
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);
  const [distanceToOffice, setDistanceToOffice] = useState<number | null>(null);
  const [geofencePassed, setGeofencePassed] = useState<boolean>(false);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string>('');

  // Step 6: Final Submission
  const [enrollmentDone, setEnrollmentDone] = useState<boolean>(false);

  // Angles config
  const ANGLES = [
    { key: 'front', label: '1. Frontal View', desc: 'Look directly at camera with neutral expression' },
    { key: 'left', label: '2. Slight Left Angle', desc: 'Turn head slightly (15°) to your left' },
    { key: 'right', label: '3. Slight Right Angle', desc: 'Turn head slightly (15°) to your right' },
  ] as const;

  useEffect(() => {
    fetchInitialStatus();
    checkPermissionsStatus();

    return () => {
      stopCamera();
    };
  }, []);

  // Haversine formula calculation for client display
  const computeDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  const fetchInitialStatus = async () => {
    try {
      setLoading(true);
      const res = await api.get('/attendance/enrollment/status');
      if (res.data.status === 'success') {
        const { isEnrolled, office: assignedOffice } = res.data.data;
        setOffice(assignedOffice);
        setIsAlreadyEnrolled(isEnrolled);

        if (isEnrolled && user?.attendanceEnrollmentPending === false) {
          // Already enrolled, offer return or re-view
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch enrollment status:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkPermissionsStatus = async () => {
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const geoStatus = await navigator.permissions.query({ name: 'geolocation' as any });
        setGpsPermission(geoStatus.state as any);
        geoStatus.onchange = () => setGpsPermission(geoStatus.state as any);
      } catch (e) {}

      if ('Notification' in window) {
        setNotificationPermission(Notification.permission as any);
      }
    }
  };

  /* -------------------------------------------------------------
     PERMISSION HANDLERS
  ------------------------------------------------------------- */
  const requestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      setCameraPermission('granted');
      stream.getTracks().forEach((track) => track.stop());
    } catch (e) {
      setCameraPermission('denied');
      alert({
        title: 'Camera Access Required',
        message: 'Please allow camera access in your browser settings to proceed with biometric enrollment.',
        variant: 'error',
      });
    }
  };

  const requestGps = () => {
    setGpsLoading(true);
    setGpsError('');
    getResilientPosition(
      (pos) => {
        setGpsPermission('granted');
        setCurrentCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setGpsLoading(false);
      },
      (err) => {
        setGpsPermission('denied');
        setGpsLoading(false);
        setGpsError(getFriendlyGpsErrorMessage(err));
      }
    );
  };

  const requestNotification = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm as any);
    } else {
      setNotificationPermission('granted');
    }
  };

  /* -------------------------------------------------------------
     CAMERA & FACE CAPTURE
  ------------------------------------------------------------- */
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (e) {
      console.error('Camera start error:', e);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (step === 3) {
      startCamera();
    } else {
      stopCamera();
    }
  }, [step]);

  const captureAngle = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const preview = canvas.toDataURL('image/jpeg', 0.85);

    const faceCheck = detectFacesInCanvas(canvas);
    if (faceCheck.multipleFaces || faceCheck.faceCount > 1) {
      alert({
        title: 'Multiple Faces Detected',
        message: 'Only one employee should be visible.',
        variant: 'warning',
      });
      return;
    }
    if (faceCheck.noFace || faceCheck.faceCount === 0) {
      alert({
        title: 'No Face Detected',
        message: 'No face detected. Please ensure your face is clearly visible in the camera.',
        variant: 'warning',
      });
      return;
    }
    if (faceCheck.maskDetected) {
      alert({
        title: 'Face Mask Detected',
        message: 'Please remove your face mask to complete enrollment.',
        variant: 'warning',
      });
      return;
    }
    if (faceCheck.spoofDetected) {
      alert({
        title: 'Anti-Spoofing Alert',
        message: faceCheck.spoofReason || 'Spoof attempt detected. Please face the camera directly.',
        variant: 'warning',
      });
      return;
    }

    // Generate 128-dim mathematical embedding
    const embedding = extractFaceEmbeddingFromCanvas(canvas, faceCheck.primaryFaceBox);

    const angleKey = ANGLES[currentAngleIndex].key;
    setAngleCaptures((prev) => ({
      ...prev,
      [angleKey]: { preview, embedding },
    }));

    if (currentAngleIndex < 2) {
      setCurrentAngleIndex((prev) => prev + 1);
    }
  };

  /* -------------------------------------------------------------
     STEP 5: GEOFENCE VERIFICATION
  ------------------------------------------------------------- */
  const verifyGeofenceLocation = () => {
    setGpsLoading(true);
    setGpsError('');

    getResilientPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        setCurrentCoords({
          latitude: userLat,
          longitude: userLng,
          accuracy: pos.coords.accuracy,
        });

        if (office) {
          const dist = computeDistance(userLat, userLng, office.latitude, office.longitude);
          setDistanceToOffice(dist);
          const passed = dist <= office.radiusMeters;
          setGeofencePassed(passed);

          if (!passed) {
            setGpsError(
              `You are ${dist}m away from ${office.name}. Maximum allowed enrollment radius is ${office.radiusMeters}m.`
            );
          }
        }
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        setGpsError(getFriendlyGpsErrorMessage(err));
      }
    );
  };

  useEffect(() => {
    if (step === 5) {
      verifyGeofenceLocation();
    }
  }, [step]);

  /* -------------------------------------------------------------
     STEP 6: COMPLETE ENROLLMENT SUBMISSION
  ------------------------------------------------------------- */
  const handleSubmitEnrollment = async () => {
    if (!angleCaptures.front || !angleCaptures.left || !angleCaptures.right) {
      alert({ title: 'Face Angles Missing', message: 'Please capture all 3 face angles before completing enrollment.', variant: 'error' });
      setStep(3);
      return;
    }

    if (!currentCoords) {
      alert({ title: 'GPS Required', message: 'Please verify your office geofence location.', variant: 'error' });
      setStep(5);
      return;
    }

    try {
      setSubmitting(true);

      // Average the 3 angle embeddings for an ultra-robust composite 128-dim template
      const fEmb = angleCaptures.front.embedding;
      const lEmb = angleCaptures.left.embedding;
      const rEmb = angleCaptures.right.embedding;

      const compositeTemplate: number[] = new Array(128).fill(0);
      let norm = 0;
      for (let i = 0; i < 128; i++) {
        const avg = (fEmb[i] + lEmb[i] + rEmb[i]) / 3;
        compositeTemplate[i] = avg;
        norm += avg * avg;
      }
      norm = Math.sqrt(norm);
      if (norm > 0) {
        for (let i = 0; i < 128; i++) {
          compositeTemplate[i] = Math.round((compositeTemplate[i] / norm) * 10000) / 10000;
        }
      }

      const payload = {
        faceTemplate: compositeTemplate,
        liveFaceImage: angleCaptures.front.preview,
        facePhotoThumbnails: [
          angleCaptures.front.preview,
          angleCaptures.left.preview,
          angleCaptures.right.preview,
        ],
        deviceId: deviceInfo.deviceId,
        deviceName: deviceInfo.deviceName,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        latitude: currentCoords.latitude,
        longitude: currentCoords.longitude,
        officeId: office?.id,
      };

      const res = await api.post('/attendance/enrollment/complete', payload);

      if (res.data.status === 'success') {
        setEnrollmentDone(true);
        updateUserCache({ attendanceEnrollmentPending: false });
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to complete enrollment. Please verify your geofence and camera.';
      alert({ title: 'Enrollment Error', message: msg, variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <span className="w-10 h-10 rounded-full border-3 border-indigo-600/30 border-t-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-brand-900 via-indigo-950 to-brand-950 p-8 rounded-3xl border border-brand-800 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-indigo-500/10 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2 border border-indigo-500/30">
              <ShieldCheck size={14} className="text-indigo-400" /> Smart Biometric Attendance
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              One-Time Attendance Enrollment
            </h1>
            <p className="text-xs md:text-sm text-brand-300 mt-1 max-w-xl">
              Register your facial biometric template and authorized workstation. Once verified inside office geofence, you will never need to repeat this setup.
            </p>
          </div>

          <div className="bg-white/10 dark:bg-brand-900/50 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-300">Employee ID</p>
            <p className="text-lg font-black text-white">{user?.employeeId}</p>
          </div>
        </div>

        {/* Step Progress Bar */}
        <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-6 gap-2">
          {[
            { num: 1, label: 'Verify' },
            { num: 2, label: 'Permissions' },
            { num: 3, label: 'Face Scan' },
            { num: 4, label: 'Device' },
            { num: 5, label: 'Geofence' },
            { num: 6, label: 'Complete' },
          ].map((s) => (
            <div key={s.num} className="space-y-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step >= s.num ? 'bg-indigo-500 shadow-sm shadow-indigo-500/50' : 'bg-brand-800'
                }`}
              />
              <p
                className={`text-[10px] font-bold text-center transition-colors ${
                  step === s.num ? 'text-white' : step > s.num ? 'text-indigo-400' : 'text-brand-500'
                }`}
              >
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* STEP CONTAINER */}
      <div className="glass rounded-3xl p-6 sm:p-10 border border-brand-200 dark:border-brand-900 shadow-xl bg-white dark:bg-brand-950/80">
        <AnimatePresence mode="wait">
          {/* ================= STEP 1: VERIFY EMPLOYEE ================= */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-brand-100 dark:border-brand-900 pb-4">
                <h2 className="text-lg font-bold text-brand-950 dark:text-white flex items-center gap-2">
                  <UserCheck className="text-indigo-500" size={20} />
                  Step 1: Verify Employee Identity
                </h2>
                <p className="text-xs text-brand-500 mt-1">
                  Confirm your official employment records before registering your biometric template.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-brand-50 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-800 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 font-black text-xl flex items-center justify-center border-2 border-indigo-500/20">
                    {user?.firstName?.[0]}
                    {user?.lastName?.[0]}
                  </div>
                  <div>
                    <p className="text-xs text-brand-500 font-semibold">Full Name</p>
                    <p className="text-sm font-bold text-brand-950 dark:text-white">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                      {user?.designation || 'Software Engineer'}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-brand-50 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-800 space-y-1">
                  <p className="text-xs text-brand-500 font-semibold">Department</p>
                  <p className="text-sm font-bold text-brand-950 dark:text-white">
                    {user?.department || 'Technology & Engineering'}
                  </p>
                  <p className="text-xs text-brand-400">Employee ID: {user?.employeeId}</p>
                </div>

                <div className="md:col-span-2 p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/50 dark:border-indigo-900/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">
                        Assigned Primary Office
                      </p>
                      <p className="text-base font-extrabold text-brand-950 dark:text-white">
                        {office?.name || 'Codabs HQ - Main Campus'}
                      </p>
                      <p className="text-xs text-brand-500">
                        {office?.branch || 'Headquarters'} • Geofence Radius: {office?.radiusMeters || 200}m
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-full">
                    Verified Active
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all"
                >
                  Confirm & Request Permissions <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ================= STEP 2: REQUEST PERMISSIONS ================= */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-brand-100 dark:border-brand-900 pb-4">
                <h2 className="text-lg font-bold text-brand-950 dark:text-white flex items-center gap-2">
                  <Lock className="text-indigo-500" size={20} />
                  Step 2: Security & Hardware Permissions
                </h2>
                <p className="text-xs text-brand-500 mt-1">
                  Smart attendance verifies your biometric presence and geographic location inside the designated office radius.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {/* Camera Permission Card */}
                <div className="p-5 rounded-2xl bg-brand-50 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-800 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                      <Camera size={22} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-brand-950 dark:text-white">Camera Access</p>
                      <p className="text-xs text-brand-500">Required for face enrollment & live anti-spoofing</p>
                    </div>
                  </div>
                  {cameraPermission === 'granted' ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-xl">
                      <Check size={14} /> Granted
                    </span>
                  ) : (
                    <button
                      onClick={requestCamera}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl uppercase tracking-wider"
                    >
                      Allow Camera
                    </button>
                  )}
                </div>

                {/* GPS Permission Card */}
                <div className="p-5 rounded-2xl bg-brand-50 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-800 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
                      <MapPin size={22} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-brand-950 dark:text-white">High-Accuracy GPS</p>
                      <p className="text-xs text-brand-500">Verifies physical location within allowed office geofence</p>
                    </div>
                  </div>
                  {gpsPermission === 'granted' ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-xl">
                      <Check size={14} /> Granted
                    </span>
                  ) : (
                    <button
                      onClick={requestGps}
                      disabled={gpsLoading}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl uppercase tracking-wider disabled:opacity-50"
                    >
                      {gpsLoading ? 'Detecting...' : 'Allow Location'}
                    </button>
                  )}
                </div>

                {/* Notification Permission Card */}
                <div className="p-5 rounded-2xl bg-brand-50 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-800 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 rounded-xl">
                      <Bell size={22} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-brand-950 dark:text-white">Notifications</p>
                      <p className="text-xs text-brand-500">Alerts for shift reminders, grace periods & check-outs</p>
                    </div>
                  </div>
                  {notificationPermission === 'granted' ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-xl">
                      <Check size={14} /> Granted
                    </span>
                  ) : (
                    <button
                      onClick={requestNotification}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl uppercase tracking-wider"
                    >
                      Allow Alerts
                    </button>
                  )}
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep(1)}
                  className="px-5 py-2.5 rounded-xl border border-brand-300 dark:border-brand-700 font-bold text-xs text-brand-600 dark:text-brand-300 flex items-center gap-1.5"
                >
                  <ChevronLeft size={16} /> Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={cameraPermission !== 'granted'}
                  className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-600/25 disabled:opacity-50 transition-all"
                >
                  Proceed to Face Scan <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ================= STEP 3: FACE ENROLLMENT (3 ANGLES) ================= */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-brand-100 dark:border-brand-900 pb-4">
                <h2 className="text-lg font-bold text-brand-950 dark:text-white flex items-center gap-2">
                  <Camera className="text-indigo-500" size={20} />
                  Step 3: Multi-Angle Face Biometric Enrollment
                </h2>
                <p className="text-xs text-brand-500 mt-1">
                  We generate an encrypted 128-dimensional mathematical template from multiple angles. Raw photos are not stored permanently.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                {/* Live Camera View with Biometric Overlay */}
                <div className="lg:col-span-2 relative bg-black rounded-3xl overflow-hidden aspect-[4/3] shadow-2xl flex items-center justify-center border-2 border-indigo-500/40">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />

                  {/* Biometric Oval Guide Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-56 h-72 border-2 border-dashed border-indigo-400/80 rounded-[50%] shadow-[0_0_40px_rgba(99,102,241,0.3)] animate-pulse flex items-center justify-center">
                      <Crosshair size={32} className="text-indigo-400/40" />
                    </div>
                  </div>

                  {/* Instruction Pill */}
                  <div className="absolute top-4 left-4 right-4 flex justify-between items-center bg-black/60 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-white">
                    <div>
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                        {ANGLES[currentAngleIndex].label}
                      </p>
                      <p className="text-xs font-semibold">{ANGLES[currentAngleIndex].desc}</p>
                    </div>
                    <span className="text-xs font-extrabold px-2.5 py-1 bg-indigo-600 rounded-lg">
                      {currentAngleIndex + 1} / 3
                    </span>
                  </div>

                  {/* Capture Button */}
                  <div className="absolute bottom-6 inset-x-0 flex justify-center">
                    <button
                      onClick={captureAngle}
                      className="px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-full font-extrabold text-xs uppercase tracking-wider shadow-2xl shadow-indigo-600/60 flex items-center gap-2 transform active:scale-95 transition-all"
                    >
                      <Camera size={18} /> Capture {ANGLES[currentAngleIndex].key.toUpperCase()} Angle
                    </button>
                  </div>
                </div>

                {/* 3 Angle Preview Cards */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-500">Captured Angles</h4>
                  {ANGLES.map((ang, idx) => {
                    const cap = (angleCaptures as any)[ang.key];
                    return (
                      <div
                        key={ang.key}
                        onClick={() => setCurrentAngleIndex(idx)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 ${
                          cap
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                            : currentAngleIndex === idx
                            ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-400 dark:border-indigo-700'
                            : 'bg-brand-50 dark:bg-brand-900/40 border-brand-200 dark:border-brand-800 opacity-60'
                        }`}
                      >
                        <div className="w-14 h-14 rounded-xl bg-black/40 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {cap ? (
                            <img src={cap.preview} alt={ang.label} className="w-full h-full object-cover" />
                          ) : (
                            <Camera size={18} className="text-brand-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-brand-950 dark:text-white truncate">{ang.label}</p>
                          <p className="text-[10px] text-brand-400">
                            {cap ? '✓ Template Generated (128-dim)' : 'Pending capture'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 rounded-xl border border-brand-300 dark:border-brand-700 font-bold text-xs text-brand-600 dark:text-brand-300 flex items-center gap-1.5"
                >
                  <ChevronLeft size={16} /> Back
                </button>
                <button
                  onClick={() => setStep(4)}
                  disabled={!angleCaptures.front || !angleCaptures.left || !angleCaptures.right}
                  className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-600/25 disabled:opacity-50 transition-all"
                >
                  Next: Device Registration <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ================= STEP 4: DEVICE REGISTRATION ================= */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-brand-100 dark:border-brand-900 pb-4">
                <h2 className="text-lg font-bold text-brand-950 dark:text-white flex items-center gap-2">
                  <Smartphone className="text-indigo-500" size={20} />
                  Step 4: Authorized Device Registration
                </h2>
                <p className="text-xs text-brand-500 mt-1">
                  Bind your attendance profile to this physical device to prevent buddy punching and unauthorized check-ins.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-gradient-to-br from-brand-50 to-indigo-50/30 dark:from-brand-900/50 dark:to-indigo-950/20 border border-brand-200 dark:border-brand-800 space-y-4">
                <div className="flex items-center gap-4 pb-4 border-b border-brand-200/60 dark:border-brand-800">
                  <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-600/30">
                    <Smartphone size={28} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Detected Client Device
                    </span>
                    <h3 className="text-lg font-extrabold text-brand-950 dark:text-white">{deviceInfo.deviceName}</h3>
                    <p className="text-xs text-brand-400">Unique fingerprint will be authorized on the server</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 rounded-2xl bg-white dark:bg-brand-950 border border-brand-200 dark:border-brand-800">
                    <p className="text-[10px] font-bold text-brand-400 uppercase">Device ID Fingerprint</p>
                    <p className="text-xs font-mono font-bold text-brand-950 dark:text-white truncate mt-1">
                      {deviceInfo.deviceId}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-brand-950 border border-brand-200 dark:border-brand-800">
                    <p className="text-[10px] font-bold text-brand-400 uppercase">Operating System</p>
                    <p className="text-xs font-bold text-brand-950 dark:text-white mt-1">{deviceInfo.os}</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-brand-950 border border-brand-200 dark:border-brand-800">
                    <p className="text-[10px] font-bold text-brand-400 uppercase">Web Browser</p>
                    <p className="text-xs font-bold text-brand-950 dark:text-white mt-1">{deviceInfo.browser}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep(3)}
                  className="px-5 py-2.5 rounded-xl border border-brand-300 dark:border-brand-700 font-bold text-xs text-brand-600 dark:text-brand-300 flex items-center gap-1.5"
                >
                  <ChevronLeft size={16} /> Back
                </button>
                <button
                  onClick={() => setStep(5)}
                  className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all"
                >
                  Register Device & Verify Office <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ================= STEP 5: OFFICE GEOFENCE VERIFICATION ================= */}
          {step === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="border-b border-brand-100 dark:border-brand-900 pb-4">
                <h2 className="text-lg font-bold text-brand-950 dark:text-white flex items-center gap-2">
                  <MapPin className="text-indigo-500" size={20} />
                  Step 5: Physical Office Geofence Verification
                </h2>
                <p className="text-xs text-brand-500 mt-1">
                  You must stand inside the assigned office geofence to finalize your enrollment.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                {/* Geofence Radar Card */}
                <div className="p-6 rounded-3xl bg-brand-50 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-brand-500">Target Geofence</p>
                      <h4 className="text-base font-extrabold text-brand-950 dark:text-white">{office?.name}</h4>
                    </div>
                    <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg">
                      Radius: {office?.radiusMeters || 200}m
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-brand-950 border border-brand-200 dark:border-brand-800 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-brand-500 font-semibold">Office Coordinates:</span>
                      <span className="font-mono font-bold text-brand-950 dark:text-white">
                        {office?.latitude.toFixed(4)}°, {office?.longitude.toFixed(4)}°
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-brand-500 font-semibold">Your Location:</span>
                      <span className="font-mono font-bold text-brand-950 dark:text-white">
                        {currentCoords ? `${currentCoords.latitude.toFixed(4)}°, ${currentCoords.longitude.toFixed(4)}°` : 'Acquiring GPS...'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs pt-2 border-t border-brand-100 dark:border-brand-900">
                      <span className="text-brand-500 font-semibold">Calculated Distance:</span>
                      <span className={`font-black text-sm ${distanceToOffice !== null && distanceToOffice <= (office?.radiusMeters || 200) ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {distanceToOffice !== null ? `${distanceToOffice} meters` : '--'}
                      </span>
                    </div>
                  </div>

                  {gpsError && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                      <AlertTriangle size={16} className="flex-shrink-0" />
                      <span>{gpsError}</span>
                    </div>
                  )}

                  <button
                    onClick={verifyGeofenceLocation}
                    disabled={gpsLoading}
                    className="w-full py-3 rounded-xl border border-indigo-300 dark:border-indigo-800 font-bold text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 flex items-center justify-center gap-2 transition-all"
                  >
                    <RotateCcw size={14} className={gpsLoading ? 'animate-spin' : ''} />
                    {gpsLoading ? 'Re-calculating distance...' : 'Refresh GPS Coordinates'}
                  </button>
                </div>

                {/* Status Indicator */}
                <div className="flex flex-col items-center justify-center p-8 rounded-3xl bg-gradient-to-b from-brand-50 to-brand-100/50 dark:from-brand-900/30 dark:to-brand-900/60 border border-brand-200 dark:border-brand-800 text-center space-y-4">
                  <div
                    className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl shadow-xl transition-all ${
                      gpsLoading
                        ? 'bg-amber-500 text-white shadow-amber-500/30'
                        : !currentCoords || gpsError
                        ? 'bg-amber-500 text-white shadow-amber-500/30'
                        : geofencePassed
                        ? 'bg-emerald-500 text-white shadow-emerald-500/30 animate-bounce'
                        : 'bg-rose-500 text-white shadow-rose-500/30'
                    }`}
                  >
                    {gpsLoading ? (
                      <RotateCcw size={36} className="animate-spin" />
                    ) : !currentCoords || gpsError ? (
                      <AlertTriangle size={38} />
                    ) : geofencePassed ? (
                      <CheckCircle2 size={40} />
                    ) : (
                      <AlertTriangle size={40} />
                    )}
                  </div>

                  <div>
                    <h3 className="text-base font-extrabold text-brand-950 dark:text-white">
                      {gpsLoading
                        ? 'Acquiring GPS Signal...'
                        : !currentCoords || gpsError
                        ? 'GPS Signal Pending'
                        : geofencePassed
                        ? 'Inside Office Geofence!'
                        : 'Outside Office Boundary'}
                    </h3>
                    <p className="text-xs text-brand-500 max-w-xs mt-1">
                      {gpsLoading
                        ? 'Connecting to satellites & Wi-Fi networks. Please wait...'
                        : !currentCoords || gpsError
                        ? 'Could not lock GPS signal yet. Please tap "Refresh GPS Coordinates" or check that phone Wi-Fi/location accuracy is enabled.'
                        : geofencePassed
                        ? `Coordinates verified. You are ${distanceToOffice}m from ${office?.name}, well within the allowed radius of ${office?.radiusMeters}m.`
                        : `Please move inside ${office?.name} boundary (within ${office?.radiusMeters}m radius) to finalize enrollment.`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep(4)}
                  className="px-5 py-2.5 rounded-xl border border-brand-300 dark:border-brand-700 font-bold text-xs text-brand-600 dark:text-brand-300 flex items-center gap-1.5"
                >
                  <ChevronLeft size={16} /> Back
                </button>
                <button
                  onClick={() => setStep(6)}
                  disabled={!geofencePassed}
                  className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-600/25 disabled:opacity-50 transition-all"
                >
                  Confirm & Review Enrollment <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ================= STEP 6: ENROLLMENT COMPLETE & SUBMISSION ================= */}
          {step === 6 && (
            <motion.div
              key="step6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {!enrollmentDone ? (
                <>
                  <div className="border-b border-brand-100 dark:border-brand-900 pb-4">
                    <h2 className="text-lg font-bold text-brand-950 dark:text-white flex items-center gap-2">
                      <ShieldCheck className="text-indigo-500" size={20} />
                      Step 6: Finalize Biometric Enrollment
                    </h2>
                    <p className="text-xs text-brand-500 mt-1">
                      Review all verified parameters before encrypting your biometric template.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-brand-50 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-800 space-y-1">
                      <p className="text-[10px] font-bold uppercase text-brand-500">Employee Identification</p>
                      <p className="text-sm font-bold text-brand-950 dark:text-white">
                        {user?.firstName} {user?.lastName} ({user?.employeeId})
                      </p>
                      <p className="text-xs text-brand-400">{user?.department}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-brand-50 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-800 space-y-1">
                      <p className="text-[10px] font-bold uppercase text-brand-500">Assigned Geofence</p>
                      <p className="text-sm font-bold text-brand-950 dark:text-white">{office?.name}</p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                        ✓ Verified ({distanceToOffice}m away, Allowed: {office?.radiusMeters}m)
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-brand-50 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-800 space-y-1">
                      <p className="text-[10px] font-bold uppercase text-brand-500">Registered Workstation</p>
                      <p className="text-sm font-bold text-brand-950 dark:text-white">{deviceInfo.deviceName}</p>
                      <p className="text-xs text-brand-400 font-mono truncate">{deviceInfo.deviceId}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-brand-50 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-800 space-y-1">
                      <p className="text-[10px] font-bold uppercase text-brand-500">Biometric Template</p>
                      <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                        ✓ 3 Angles Extracted (128-dim Vector)
                      </p>
                      <p className="text-xs text-brand-400">Encrypted via AES-256-GCM at rest</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 text-xs text-indigo-900 dark:text-indigo-300 flex items-center gap-3">
                    <Sparkles className="text-indigo-500 flex-shrink-0" size={20} />
                    <span>
                      Once saved, your Attendance Enrollment will be marked <strong>Completed</strong>. You will never need to repeat this procedure for daily attendance.
                    </span>
                  </div>

                  <div className="flex justify-between pt-4">
                    <button
                      onClick={() => setStep(5)}
                      className="px-5 py-2.5 rounded-xl border border-brand-300 dark:border-brand-700 font-bold text-xs text-brand-600 dark:text-brand-300 flex items-center gap-1.5"
                    >
                      <ChevronLeft size={16} /> Back
                    </button>
                    <button
                      onClick={handleSubmitEnrollment}
                      disabled={submitting}
                      className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 shadow-xl shadow-emerald-600/30 disabled:opacity-50 transition-all"
                    >
                      {submitting ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Encrypting & Saving...
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={18} /> Complete Attendance Enrollment
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                /* Celebration Complete Screen */
                <div className="py-8 text-center space-y-6">
                  <div className="w-24 h-24 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-2xl shadow-emerald-500/20 animate-bounce">
                    <CheckCircle2 size={52} />
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl font-black text-brand-950 dark:text-white">
                      Attendance Enrollment Completed!
                    </h2>
                    <p className="text-xs md:text-sm text-brand-500 max-w-md mx-auto">
                      Your biometric template and workstation are securely registered. From now on, simply open HRMS to automatically mark attendance.
                    </p>
                  </div>

                  <div className="flex justify-center gap-4 pt-4">
                    <button
                      onClick={() => navigate('/attendance')}
                      className="px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-xl shadow-indigo-600/30"
                    >
                      Go to Smart Attendance Console
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AttendanceEnrollment;
