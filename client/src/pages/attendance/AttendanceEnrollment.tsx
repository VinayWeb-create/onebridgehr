import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import api from '../../services/api';
import { getClientDeviceInfo } from '../../utils/deviceFingerprint';
import { extractFaceEmbeddingFromCanvas, detectFacesInCanvas } from '../../utils/faceBiometrics';
import type { FaceAnalysisResult } from '../../utils/faceBiometrics';
import { getResilientPosition, getFriendlyGpsErrorMessage } from '../../utils/geolocation';
import { BiometricFaceScannerHUD } from '../../components/BiometricFaceScannerHUD';
import {
  UserCheck,
  Camera,
  MapPin,
  Bell,
  Smartphone,
  Laptop,
  Monitor,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Sparkles,
  Building2,
  Lock,
  Check,
  Eye,
  Smile,
  Shield,
  Trash2,
  Plus,
  RefreshCw,
  Sun,
  CheckCircle,
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

interface RegisteredDeviceItem {
  id: string;
  deviceId: string;
  deviceName: string;
  browser: string;
  os: string;
  isActive: boolean;
  registeredAt: string;
  lastUsedAt?: string;
}

export const AttendanceEnrollment: React.FC = () => {
  const { user, updateUserCache } = useAuth();
  const { alert, confirm } = useDialog();
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

  // Step 3: Face Enrollment (Multi-Angle)
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [currentAngleIndex, setCurrentAngleIndex] = useState<number>(0);
  const [faceAnalysis, setFaceAnalysis] = useState<FaceAnalysisResult | null>(null);
  const [angleCaptures, setAngleCaptures] = useState<Record<string, { preview: string; embedding: number[] }>>({});
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [autoCaptureSeconds, setAutoCaptureSeconds] = useState<number | null>(null);
  const autoCaptureTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Step 4: Device Registration (2 Devices Limit)
  const [deviceInfo, setDeviceInfo] = useState(getClientDeviceInfo());
  const [registeredDevices, setRegisteredDevices] = useState<RegisteredDeviceItem[]>([]);
  const [deviceActionLoading, setDeviceActionLoading] = useState<boolean>(false);

  // Step 5: Office Geofence Verification
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);
  const [distanceToOffice, setDistanceToOffice] = useState<number | null>(null);
  const [geofencePassed, setGeofencePassed] = useState<boolean>(false);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string>('');

  // Step 6: Final Submission
  const [enrollmentDone, setEnrollmentDone] = useState<boolean>(false);

  // Angles config matching Figma mobile & desktop specifications
  const ALL_ANGLES = [
    { key: 'front', label: '1. Frontal View', short: '1. Front', desc: 'Look directly at camera with neutral expression', required: true },
    { key: 'left20', label: '2. Left 20°', short: '2. Left 20°', desc: 'Turn head slightly (20°) to your left', required: true },
    { key: 'right20', label: '3. Right 20°', short: '3. Right 20°', desc: 'Turn head slightly (20°) to your right', required: true },
    { key: 'left45', label: '4. Left 45°', short: '4. Left 45°', desc: 'Turn head further (45°) to your left', required: false },
    { key: 'right45', label: '5. Right 45°', short: '5. Right 45°', desc: 'Turn head further (45°) to your right', required: false },
    { key: 'up', label: '6. Upward Tilt', short: '6. Up', desc: 'Tilt your chin slightly upwards', required: false },
    { key: 'down', label: '7. Downward Tilt', short: '7. Down', desc: 'Tilt your head slightly downwards', required: false },
    { key: 'smile', label: '8. Smile Expression', short: '8. Smile', desc: 'Smile naturally at the camera', required: false },
    { key: 'blink', label: '9. Natural Blink', short: '9. Blink', desc: 'Open eyes naturally and look directly', required: false },
  ] as const;

  const STEPS = [
    { num: 1, label: 'Verify', icon: UserCheck },
    { num: 2, label: 'Permissions', icon: Lock },
    { num: 3, label: 'Face Scan', icon: Camera },
    { num: 4, label: 'Device', icon: Smartphone },
    { num: 5, label: 'Geofence', icon: MapPin },
    { num: 6, label: 'Complete', icon: ShieldCheck },
  ] as const;

  useEffect(() => {
    fetchInitialStatus();
    checkPermissionsStatus();
    fetchRegisteredDevices();

    return () => {
      stopCamera();
      if (autoCaptureTimerRef.current) clearInterval(autoCaptureTimerRef.current);
    };
  }, []);

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
        const { isEnrolled, office: assignedOffice, registeredDevices: devs } = res.data.data;
        setOffice(assignedOffice);
        setIsAlreadyEnrolled(isEnrolled);
        if (devs && Array.isArray(devs)) {
          setRegisteredDevices(devs);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch enrollment status:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRegisteredDevices = async () => {
    try {
      const res = await api.get('/attendance/devices');
      if (res.data?.status === 'success' && res.data?.data?.devices) {
        setRegisteredDevices(res.data.data.devices);
      }
    } catch (err) {
      // Fallback handled by enrollment/status
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
     CAMERA & FACE CAPTURE WITH AUTO-COUNTDOWN
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

      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      let count = 0;

      const trackLoop = () => {
        if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;
        if (ctx && videoRef.current.videoWidth) {
          count++;
          if (count % 3 === 0) {
            ctx.drawImage(videoRef.current, 0, 0, 320, 240);
            const res = detectFacesInCanvas(canvas);
            setFaceAnalysis(res);
          }
        }
        animFrameRef.current = requestAnimationFrame(trackLoop);
      };
      animFrameRef.current = requestAnimationFrame(trackLoop);
    } catch (e) {
      console.error('Camera start error:', e);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (autoCaptureTimerRef.current) {
      clearInterval(autoCaptureTimerRef.current);
      autoCaptureTimerRef.current = null;
    }
    setAutoCaptureSeconds(null);
    setCameraActive(false);
  };

  useEffect(() => {
    if (step === 3) {
      startCamera();
    } else {
      stopCamera();
    }
  }, [step]);

  // Auto-capture countdown effect when face is aligned and stable
  useEffect(() => {
    if (step !== 3 || !cameraActive) return;

    const currentKey = ALL_ANGLES[currentAngleIndex].key;
    const isAlreadyCaptured = !!angleCaptures[currentKey];

    const isGoodQuality =
      faceAnalysis &&
      faceAnalysis.faceCount === 1 &&
      !faceAnalysis.noFace &&
      !faceAnalysis.multipleFaces &&
      !faceAnalysis.maskDetected &&
      faceAnalysis.lightingQuality !== 'LOW_LIGHT' &&
      faceAnalysis.lightingQuality !== 'OVEREXPOSED';

    if (isGoodQuality && !isAlreadyCaptured) {
      if (autoCaptureSeconds === null) {
        setAutoCaptureSeconds(2);
      }
    } else {
      if (autoCaptureSeconds !== null && !isAlreadyCaptured) {
        setAutoCaptureSeconds(null);
      }
    }
  }, [faceAnalysis, currentAngleIndex, angleCaptures, step, cameraActive]);

  useEffect(() => {
    if (autoCaptureSeconds === null) {
      if (autoCaptureTimerRef.current) {
        clearInterval(autoCaptureTimerRef.current);
        autoCaptureTimerRef.current = null;
      }
      return;
    }

    if (autoCaptureSeconds === 0) {
      captureAngle();
      setAutoCaptureSeconds(null);
      return;
    }

    autoCaptureTimerRef.current = setInterval(() => {
      setAutoCaptureSeconds((prev) => (prev !== null && prev > 0 ? prev - 1 : null));
    }, 1000);

    return () => {
      if (autoCaptureTimerRef.current) clearInterval(autoCaptureTimerRef.current);
    };
  }, [autoCaptureSeconds]);

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
        message: 'Only one employee should be visible in camera frame.',
        variant: 'warning',
      });
      return;
    }
    if (faceCheck.noFace || faceCheck.faceCount === 0) {
      alert({
        title: 'No Face Detected',
        message: 'Please ensure your face is centered inside the camera frame.',
        variant: 'warning',
      });
      return;
    }
    if (faceCheck.maskDetected) {
      alert({
        title: 'Face Mask Detected',
        message: 'Please remove face mask or sunglasses to complete biometric enrollment.',
        variant: 'warning',
      });
      return;
    }

    // Generate 128-dim mathematical embedding
    const embedding = extractFaceEmbeddingFromCanvas(canvas, faceCheck.primaryFaceBox);
    const currentKey = ALL_ANGLES[currentAngleIndex].key;

    setAngleCaptures((prev) => ({
      ...prev,
      [currentKey]: { preview, embedding },
    }));

    setAutoCaptureSeconds(null);

    // Auto-advance to next required angle if available
    if (currentAngleIndex < 2) {
      setCurrentAngleIndex((prev) => prev + 1);
    }
  };

  /* -------------------------------------------------------------
     STEP 4: DUAL-DEVICE ACTIONS (MAX 2 DEVICES)
  ------------------------------------------------------------- */
  const handleRegisterCurrentDevice = async () => {
    try {
      setDeviceActionLoading(true);
      const res = await api.post('/attendance/devices/register', {
        deviceId: deviceInfo.deviceId,
        deviceName: deviceInfo.deviceName,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
      });

      if (res.data?.status === 'success') {
        alert({
          title: 'Device Authorized',
          message: res.data.message || 'Current device successfully authorized for attendance.',
          variant: 'success',
        });
        if (res.data.data?.devices) {
          setRegisteredDevices(res.data.data.devices);
        } else {
          fetchRegisteredDevices();
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to authorize device.';
      alert({ title: 'Device Limit Notice', message: msg, variant: 'error' });
    } finally {
      setDeviceActionLoading(false);
    }
  };

  const handleRemoveDevice = async (id: string, devName: string) => {
    const ok = await confirm({
      title: 'Remove Authorized Device?',
      message: `Are you sure you want to remove "${devName}"? This will free up a slot (max 2 devices allowed per employee).`,
      confirmText: 'Remove Device',
      variant: 'danger',
    });

    if (!ok) return;

    try {
      setDeviceActionLoading(true);
      const res = await api.delete(`/attendance/devices/${id}`);
      if (res.data?.status === 'success') {
        alert({
          title: 'Device Unregistered',
          message: 'Device slot is now available to register a new workstation.',
          variant: 'success',
        });
        if (res.data.data?.devices) {
          setRegisteredDevices(res.data.data.devices);
        } else {
          fetchRegisteredDevices();
        }
      }
    } catch (err: any) {
      alert({
        title: 'Error',
        message: err.response?.data?.message || 'Failed to remove device.',
        variant: 'error',
      });
    } finally {
      setDeviceActionLoading(false);
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
    if (!angleCaptures.front || !angleCaptures.left20 || !angleCaptures.right20) {
      alert({
        title: 'Required Face Angles Missing',
        message: 'Please capture Frontal View, Left 20°, and Right 20° angles to complete enrollment.',
        variant: 'error',
      });
      setStep(3);
      return;
    }

    if (!currentCoords) {
      alert({ title: 'GPS Verification Required', message: 'Please verify your office geofence location.', variant: 'error' });
      setStep(5);
      return;
    }

    try {
      setSubmitting(true);

      const fEmb = angleCaptures.front.embedding;
      const lEmb = angleCaptures.left20.embedding;
      const rEmb = angleCaptures.right20.embedding;

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

      const thumbnails = [
        angleCaptures.front.preview,
        angleCaptures.left20.preview,
        angleCaptures.right20.preview,
      ];

      const payload = {
        faceTemplate: compositeTemplate,
        liveFaceImage: angleCaptures.front.preview,
        facePhotoThumbnails: thumbnails,
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
        fetchRegisteredDevices();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to complete enrollment. Please verify your geofence and camera.';
      alert({ title: 'Enrollment Error', message: msg, variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const isCurrentDeviceRegistered = registeredDevices.some(
    (d) => d.deviceId === deviceInfo.deviceId && d.isActive
  );

  const slot1 = registeredDevices[0] || null;
  const slot2 = registeredDevices[1] || null;

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <span className="w-12 h-12 rounded-full border-4 border-orange-500/20 border-t-orange-500 animate-spin" />
        <p className="text-sm font-bold text-slate-400">Loading Biometric Enrollment...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 space-y-4 pb-12 font-sans text-white">
      {/* ================= NATIVE MOBILE HEADER (< md) ================= */}
      <div className="flex items-center justify-between py-2 md:hidden">
        <button
          onClick={() => (step > 1 ? setStep(step - 1) : navigate(-1))}
          className="p-2 -ml-2 text-slate-300 hover:text-white rounded-full active:bg-slate-800 transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="text-center">
          <h1 className="text-base font-extrabold text-white">Face Enrollment</h1>
          <p className="text-[11px] font-semibold text-orange-400">Step {step} of 6</p>
        </div>
        <div className="w-8" />
      </div>

      {/* ================= DESKTOP HEADER (>= md) ================= */}
      <div className="hidden md:flex justify-between items-center bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-gradient-to-l from-orange-500/10 via-orange-600/5 to-transparent pointer-events-none" />
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Face Enrollment</h1>
            <span className="px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-400 text-xs font-black uppercase tracking-wider">
              Step {step} of 6
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Capture multiple angles for accurate and secure identification
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-800/80 px-4 py-2.5 rounded-2xl border border-slate-700/60 shadow-inner">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 font-extrabold flex items-center justify-center border border-orange-500/30">
            {user?.firstName?.[0]}
            {user?.lastName?.[0]}
          </div>
          <div className="text-left">
            <p className="text-xs font-bold text-white leading-tight">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-[10px] text-slate-400 font-medium">ID: {user?.employeeId}</p>
          </div>
        </div>
      </div>

      {/* ================= STEPPER BAR (MATCHING FIGMA IN BOTH MOBILE & DESKTOP) ================= */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-xl backdrop-blur-xl">
        <div className="grid grid-cols-6 gap-1 relative px-0.5 sm:px-2">
          {STEPS.map((s, idx) => {
            const isCurrent = step === s.num;
            const isPassed = step > s.num;
            const IconComp = s.icon;

            return (
              <div
                key={s.num}
                onClick={() => {
                  if (s.num < step || (s.num === 4 && angleCaptures.front)) {
                    setStep(s.num);
                  }
                }}
                className={`flex flex-col items-center cursor-pointer transition-all ${
                  isCurrent ? 'scale-105' : 'opacity-70 hover:opacity-100'
                }`}
              >
                <div className="relative flex items-center justify-center w-full mb-1 sm:mb-1.5">
                  {/* Connecting track */}
                  {idx > 0 && (
                    <div
                      className={`absolute left-0 right-1/2 top-1/2 -translate-y-1/2 h-[2px] ${
                        step >= s.num ? 'bg-orange-500' : 'bg-slate-800'
                      }`}
                    />
                  )}
                  {idx < 5 && (
                    <div
                      className={`absolute left-1/2 right-0 top-1/2 -translate-y-1/2 h-[2px] ${
                        step > s.num ? 'bg-orange-500' : 'bg-slate-800'
                      }`}
                    />
                  )}

                  {/* Step Circle */}
                  <div
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs font-black transition-all shadow-md relative z-10 ${
                      isCurrent
                        ? 'bg-orange-500 text-white ring-4 ring-orange-500/30 shadow-orange-500/50'
                        : isPassed
                        ? 'bg-orange-600 text-white'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {isPassed ? <Check size={14} /> : <IconComp size={14} />}
                  </div>
                </div>

                <span
                  className={`text-[9px] sm:text-xs font-bold text-center truncate ${
                    isCurrent ? 'text-orange-400 font-black' : isPassed ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= STEP CONTENT CONTAINER ================= */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-7 shadow-2xl backdrop-blur-xl">
        <AnimatePresence mode="wait">
          {/* ================= STEP 1: VERIFY EMPLOYEE ================= */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4 sm:space-y-6"
            >
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <UserCheck className="text-orange-500" size={20} />
                  Step 1: Verify Employee Identity
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Confirm your official employment records before registering your biometric template.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/20 text-orange-400 font-black text-lg flex items-center justify-center border border-orange-500/30 shrink-0">
                    {user?.firstName?.[0]}
                    {user?.lastName?.[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-400 font-semibold">Full Name</p>
                    <p className="text-sm sm:text-base font-bold text-white truncate">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs text-orange-400 font-medium truncate">
                      {user?.designation || 'Software Engineer'}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                  <p className="text-[11px] text-slate-400 font-semibold">Department & Code</p>
                  <p className="text-sm font-bold text-white truncate">{user?.department || 'Engineering'}</p>
                  <p className="text-xs text-slate-400">Employee Code: {user?.employeeId}</p>
                </div>

                <div className="md:col-span-2 p-4 sm:p-5 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-orange-500/20 text-orange-400 rounded-xl border border-orange-500/30 shrink-0">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-orange-400 tracking-wider">
                        Assigned Primary Office
                      </p>
                      <p className="text-sm sm:text-base font-extrabold text-white">
                        {office?.name || 'OneBridge Infotech HQ'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {office?.branch || 'Headquarters'} • Radius: {office?.radiusMeters || 200}m
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-full flex items-center gap-1.5 shrink-0">
                    <CheckCircle size={14} /> Active Assignment
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setStep(2)}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition-all"
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
              className="space-y-4 sm:space-y-6"
            >
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Lock className="text-orange-500" size={20} />
                  Step 2: Security & Hardware Permissions
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Biometric attendance requires camera and GPS verification within the designated office radius.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:gap-4">
                {/* Camera Permission Card */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="p-3 bg-orange-500/20 text-orange-400 rounded-xl border border-orange-500/30 shrink-0">
                      <Camera size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">Camera Access</p>
                      <p className="text-xs text-slate-400 truncate">Required for face enrollment & anti-spoofing</p>
                    </div>
                  </div>
                  {cameraPermission === 'granted' ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl shrink-0">
                      <Check size={14} /> Granted
                    </span>
                  ) : (
                    <button
                      onClick={requestCamera}
                      className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl uppercase tracking-wider shrink-0"
                    >
                      Allow
                    </button>
                  )}
                </div>

                {/* GPS Permission Card */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30 shrink-0">
                      <MapPin size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">High-Accuracy GPS</p>
                      <p className="text-xs text-slate-400 truncate">Verifies location within office boundary</p>
                    </div>
                  </div>
                  {gpsPermission === 'granted' ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl shrink-0">
                      <Check size={14} /> Granted
                    </span>
                  ) : (
                    <button
                      onClick={requestGps}
                      disabled={gpsLoading}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl uppercase tracking-wider disabled:opacity-50 shrink-0"
                    >
                      {gpsLoading ? 'Detecting...' : 'Allow'}
                    </button>
                  )}
                </div>

                {/* Notification Permission Card */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30 shrink-0">
                      <Bell size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">Notifications & Alerts</p>
                      <p className="text-xs text-slate-400 truncate">Shift reminders & grace period notices</p>
                    </div>
                  </div>
                  {notificationPermission === 'granted' ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl shrink-0">
                      <Check size={14} /> Granted
                    </span>
                  ) : (
                    <button
                      onClick={requestNotification}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl uppercase tracking-wider shrink-0"
                    >
                      Allow
                    </button>
                  )}
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="px-5 py-2.5 rounded-xl border border-slate-700 font-bold text-xs text-slate-300 flex items-center gap-1.5 hover:bg-slate-800"
                >
                  <ChevronLeft size={16} /> Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={cameraPermission !== 'granted'}
                  className="px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-orange-500/25 disabled:opacity-50 transition-all"
                >
                  Proceed to Face Scan <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ================= STEP 3: FACE ENROLLMENT (PIXEL-PERFECT FIGMA DESIGN) ================= */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* CAMERA VIEWPORT - WIDE & SPACIOUS FOR MOBILE & DESKTOP */}
              <div className="relative bg-black rounded-3xl overflow-hidden w-full aspect-[4/5] sm:aspect-[4/3] min-h-[360px] sm:min-h-[440px] shadow-2xl border-2 border-slate-700/80 group">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />

                {/* TOP GREEN PILL: FACE DETECTED */}
                <div className="absolute top-3 left-3 sm:left-1/2 sm:-translate-x-1/2 z-20">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/95 text-white text-[11px] font-extrabold shadow-lg backdrop-blur-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Face detected
                  </div>
                </div>

                {/* TOP RIGHT: QUALITY & LIVE STATUS */}
                <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 border border-white/10 text-emerald-400 text-[10px] font-black backdrop-blur-md shadow-md">
                    <span>98% Quality</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-rose-600/90 text-white text-[10px] font-extrabold shadow-md backdrop-blur-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    Live
                  </div>
                </div>

                {/* HOLOGRAPHIC WIDE FACE RETICLE HUD */}
                <BiometricFaceScannerHUD
                  faceBox={faceAnalysis?.primaryFaceBox}
                  videoWidth={videoRef.current?.videoWidth || 640}
                  videoHeight={videoRef.current?.videoHeight || 480}
                  livenessPassed={!!angleCaptures[ALL_ANGLES[currentAngleIndex].key]}
                  livenessScore={faceAnalysis?.noFace ? 0.2 : 0.98}
                  livenessStatus=""
                  verifying={false}
                  lightingQuality={faceAnalysis?.lightingQuality}
                  lightingBrightness={faceAnalysis?.lightingBrightness}
                  faceAlignment={faceAnalysis?.faceAlignment}
                  multipleFaces={faceAnalysis?.multipleFaces}
                  noFace={faceAnalysis?.noFace}
                />

                {/* DESKTOP-ONLY FLOATING CHECKLIST PILLS (HIDDEN ON MOBILE FOR MAXIMUM VIEW WIDTH) */}
                <div className="absolute top-14 left-4 z-20 space-y-2 pointer-events-none hidden md:block">
                  <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-[11px] font-bold flex items-center gap-2 shadow-sm">
                    <Sun size={12} className="text-emerald-400" />
                    <span>Good Lighting</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-[11px] font-bold flex items-center gap-2 shadow-sm">
                    <Check size={12} className="text-emerald-400" />
                    <span>Face Centered</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-[11px] font-bold flex items-center gap-2 shadow-sm">
                    <Eye size={12} className="text-emerald-400" />
                    <span>Eyes Open</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-[11px] font-bold flex items-center gap-2 shadow-sm">
                    <Check size={12} className="text-emerald-400" />
                    <span>Correct Distance</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-[11px] font-bold flex items-center gap-2 shadow-sm">
                    <Check size={12} className="text-emerald-400" />
                    <span>No Mask</span>
                  </div>
                </div>

                {/* BOTTOM OVERLAY INSIDE CAMERA: HOLD STILL & COUNTDOWN */}
                <div className="absolute bottom-3 left-4 right-4 z-20">
                  <div className="text-center">
                    <p className="text-xs font-bold text-white drop-shadow">
                      {autoCaptureSeconds !== null
                        ? `Auto capturing in ${autoCaptureSeconds}s...`
                        : 'Hold still for crystal clear biometric scan'}
                    </p>
                    <div className="w-full h-1.5 bg-black/50 rounded-full mt-1.5 overflow-hidden border border-white/15">
                      <div
                        className="h-full bg-orange-500 rounded-full transition-all duration-300"
                        style={{
                          width:
                            autoCaptureSeconds !== null
                              ? `${((3 - autoCaptureSeconds) / 3) * 100}%`
                              : '75%',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* GUIDE CARD (BELOW CAMERA, EXACT FIGMA SPEC) */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-orange-500/15 to-orange-600/5 border border-orange-500/30 flex items-center gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30 shrink-0">
                  <Crosshair size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-extrabold text-white truncate">
                    {ALL_ANGLES[currentAngleIndex].label}
                  </h4>
                  <p className="text-[11px] text-slate-300 truncate">
                    {ALL_ANGLES[currentAngleIndex].desc}
                  </p>
                </div>
              </div>

              {/* CAPTURE ALL ANGLES HORIZONTAL THUMBNAIL CAROUSEL */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="font-extrabold uppercase tracking-wider text-slate-300 text-[11px]">
                    Capture All Angles
                  </span>
                  <span className="text-[10px] font-bold text-orange-400">
                    {Object.keys(angleCaptures).length} / 9 Captured
                  </span>
                </div>

                <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none snap-x">
                  {ALL_ANGLES.map((ang, idx) => {
                    const cap = angleCaptures[ang.key];
                    const isSelected = currentAngleIndex === idx;

                    return (
                      <div
                        key={ang.key}
                        onClick={() => setCurrentAngleIndex(idx)}
                        className={`flex-shrink-0 w-20 p-1.5 rounded-2xl border transition-all cursor-pointer flex flex-col items-center gap-1 snap-start ${
                          isSelected
                            ? 'bg-orange-500/20 border-orange-500 ring-2 ring-orange-500/30'
                            : cap
                            ? 'bg-slate-800/80 border-emerald-500/50'
                            : 'bg-slate-800/40 border-slate-700/60 opacity-60'
                        }`}
                      >
                        <div className="w-16 h-16 rounded-xl bg-slate-900 overflow-hidden flex items-center justify-center relative border border-slate-700">
                          {cap ? (
                            <>
                              <img src={cap.preview} alt={ang.label} className="w-full h-full object-cover" />
                              <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-black">
                                ✓
                              </span>
                            </>
                          ) : (
                            <Camera size={18} className={isSelected ? 'text-orange-400' : 'text-slate-500'} />
                          )}
                        </div>
                        <p
                          className={`text-[10px] font-bold truncate max-w-full text-center ${
                            isSelected ? 'text-orange-400 font-black' : cap ? 'text-emerald-400' : 'text-slate-400'
                          }`}
                        >
                          {ang.short}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <p className="text-[11px] text-center text-slate-400">
                  Photo will be captured automatically when ready ✓
                </p>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={captureAngle}
                  className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Camera size={16} />
                  <span>Capture Angle</span>
                </button>

                <button
                  onClick={() => setStep(4)}
                  disabled={!angleCaptures.front || !angleCaptures.left20 || !angleCaptures.right20}
                  className="px-5 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-40 transition-all"
                >
                  <span>Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ================= STEP 4: AUTHORIZED DEVICE REGISTRATION (2 DEVICES POLICY) ================= */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4 sm:space-y-6"
            >
              <div className="border-b border-slate-800 pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      <Smartphone className="text-orange-500" size={20} />
                      Step 4: Authorized Attendance Devices
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Every employee can register up to <strong>2 devices only</strong> (e.g. Work Laptop & Mobile) to mark attendance.
                    </p>
                  </div>
                  <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-black">
                    {registeredDevices.length} / 2 Slots Used
                  </span>
                </div>
              </div>

              {/* CURRENT DEVICE CARD */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-800/90 to-slate-800/40 border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-orange-500 text-white rounded-2xl shadow-lg shadow-orange-500/30 shrink-0">
                    {/Windows|Mac|Linux/i.test(deviceInfo.os) ? <Laptop size={22} /> : <Smartphone size={22} />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-orange-400">
                        Current Device Detected
                      </span>
                      {isCurrentDeviceRegistered ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                          ✓ Authorized
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                          ● Not Registered
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm sm:text-base font-extrabold text-white truncate mt-0.5">
                      {deviceInfo.deviceName}
                    </h3>
                    <p className="text-[11px] text-slate-400 truncate">
                      Fingerprint: <span className="font-mono text-slate-300">{deviceInfo.deviceId}</span>
                    </p>
                  </div>
                </div>

                {!isCurrentDeviceRegistered && (
                  <button
                    onClick={handleRegisterCurrentDevice}
                    disabled={deviceActionLoading}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-xs font-black uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    <Plus size={16} />
                    {registeredDevices.length >= 2
                      ? 'Replace One Slot'
                      : 'Authorize This Device (+ Add Device)'}
                  </button>
                )}
              </div>

              {/* DUAL DEVICE SLOTS (SLOT 1 & SLOT 2) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {/* SLOT 1 */}
                <div
                  className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                    slot1
                      ? 'bg-slate-800/60 border-slate-700'
                      : 'bg-slate-800/20 border-dashed border-slate-700 text-center flex flex-col items-center justify-center py-6'
                  }`}
                >
                  {slot1 ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded-lg bg-orange-500/20 text-orange-400 text-[10px] font-black uppercase">
                          Device Slot 1
                        </span>
                        <div className="flex items-center gap-1.5">
                          {slot1.deviceId === deviceInfo.deviceId && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                              In Use
                            </span>
                          )}
                          <button
                            onClick={() => handleRemoveDevice(slot1.id, slot1.deviceName)}
                            disabled={deviceActionLoading}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Remove Device"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-slate-700 text-slate-200 rounded-xl shrink-0">
                          {/Windows|Mac|Linux/i.test(slot1.os) ? <Laptop size={20} /> : <Smartphone size={20} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-white truncate">{slot1.deviceName}</p>
                          <p className="text-xs text-slate-400 truncate">
                            {slot1.os} • {slot1.browser}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-700/60 text-[10px] text-slate-400 flex justify-between">
                        <span>Fingerprint: {slot1.deviceId.substring(0, 14)}...</span>
                        <span className="text-emerald-400 font-bold">● Active</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                        <Smartphone size={20} />
                      </div>
                      <p className="text-xs font-bold text-slate-400">Slot 1 Empty</p>
                    </div>
                  )}
                </div>

                {/* SLOT 2 */}
                <div
                  className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                    slot2
                      ? 'bg-slate-800/60 border-slate-700'
                      : 'bg-slate-800/20 border-dashed border-slate-700 text-center flex flex-col items-center justify-center py-6'
                  }`}
                >
                  {slot2 ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded-lg bg-orange-500/20 text-orange-400 text-[10px] font-black uppercase">
                          Device Slot 2
                        </span>
                        <div className="flex items-center gap-1.5">
                          {slot2.deviceId === deviceInfo.deviceId && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                              In Use
                            </span>
                          )}
                          <button
                            onClick={() => handleRemoveDevice(slot2.id, slot2.deviceName)}
                            disabled={deviceActionLoading}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Remove Device"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-slate-700 text-slate-200 rounded-xl shrink-0">
                          {/Windows|Mac|Linux/i.test(slot2.os) ? <Laptop size={20} /> : <Smartphone size={20} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-white truncate">{slot2.deviceName}</p>
                          <p className="text-xs text-slate-400 truncate">
                            {slot2.os} • {slot2.browser}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-700/60 text-[10px] text-slate-400 flex justify-between">
                        <span>Fingerprint: {slot2.deviceId.substring(0, 14)}...</span>
                        <span className="text-emerald-400 font-bold">● Active</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                        <Laptop size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-300">Slot 2 Available</p>
                        <p className="text-[10px] text-slate-400">
                          {isCurrentDeviceRegistered
                            ? 'Available for your second workstation (Laptop or Phone).'
                            : 'Click below to authorize your current workstation as Device 2.'}
                        </p>
                      </div>

                      {!isCurrentDeviceRegistered && (
                        <button
                          onClick={handleRegisterCurrentDevice}
                          disabled={deviceActionLoading}
                          className="px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                        >
                          + Bind Current Device
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep(3)}
                  className="px-5 py-2.5 rounded-xl border border-slate-700 font-bold text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-1.5"
                >
                  <ChevronLeft size={16} /> Back
                </button>
                <button
                  onClick={() => setStep(5)}
                  className="px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-orange-500/25 transition-all"
                >
                  Next: Geofence <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ================= STEP 5: PHYSICAL OFFICE GEOFENCE ================= */}
          {step === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4 sm:space-y-6"
            >
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <MapPin className="text-orange-500" size={20} />
                  Step 5: Physical Office Geofence Verification
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  You must stand inside the assigned office geofence to finalize your enrollment.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-orange-400">Target Geofence</p>
                      <h4 className="text-sm sm:text-base font-extrabold text-white">{office?.name}</h4>
                    </div>
                    <span className="px-2.5 py-1 bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-bold rounded-lg">
                      Radius: {office?.radiusMeters || 200}m
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700/60 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-semibold">Office Location:</span>
                      <span className="font-mono font-bold text-white">
                        {office?.latitude.toFixed(4)}°, {office?.longitude.toFixed(4)}°
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-semibold">Your Location:</span>
                      <span className="font-mono font-bold text-white">
                        {currentCoords ? `${currentCoords.latitude.toFixed(4)}°, ${currentCoords.longitude.toFixed(4)}°` : 'Acquiring GPS...'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs pt-1.5 border-t border-slate-800">
                      <span className="text-slate-400 font-semibold">Distance:</span>
                      <span
                        className={`font-black text-sm ${
                          distanceToOffice !== null && distanceToOffice <= (office?.radiusMeters || 200)
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {distanceToOffice !== null ? `${distanceToOffice} meters` : '--'}
                      </span>
                    </div>
                  </div>

                  {gpsError && (
                    <div className="p-3 bg-rose-500/20 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                      <AlertTriangle size={16} className="shrink-0 text-rose-400" />
                      <span>{gpsError}</span>
                    </div>
                  )}

                  <button
                    onClick={verifyGeofenceLocation}
                    disabled={gpsLoading}
                    className="w-full py-2.5 rounded-xl border border-orange-500/40 text-orange-400 hover:bg-orange-500/10 font-bold text-xs flex items-center justify-center gap-2 transition-all"
                  >
                    <RotateCcw size={14} className={gpsLoading ? 'animate-spin' : ''} />
                    {gpsLoading ? 'Re-calculating distance...' : 'Refresh GPS Coordinates'}
                  </button>
                </div>

                <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-800/40 border border-slate-700/60 text-center space-y-3">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl shadow-xl transition-all ${
                      gpsLoading
                        ? 'bg-amber-500 text-white'
                        : !currentCoords || gpsError
                        ? 'bg-amber-500 text-white'
                        : geofencePassed
                        ? 'bg-emerald-500 text-white animate-bounce'
                        : 'bg-rose-500 text-white'
                    }`}
                  >
                    {gpsLoading ? (
                      <RotateCcw size={28} className="animate-spin" />
                    ) : !currentCoords || gpsError ? (
                      <AlertTriangle size={30} />
                    ) : geofencePassed ? (
                      <CheckCircle2 size={32} />
                    ) : (
                      <AlertTriangle size={32} />
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-white">
                      {gpsLoading
                        ? 'Acquiring GPS Signal...'
                        : !currentCoords || gpsError
                        ? 'GPS Signal Pending'
                        : geofencePassed
                        ? 'Inside Office Geofence!'
                        : 'Outside Office Boundary'}
                    </h3>
                    <p className="text-xs text-slate-400 max-w-xs mt-1">
                      {gpsLoading
                        ? 'Connecting to satellites & local networks...'
                        : !currentCoords || gpsError
                        ? 'Could not lock GPS signal yet. Please tap "Refresh GPS Coordinates".'
                        : geofencePassed
                        ? `Coordinates verified. You are ${distanceToOffice}m from ${office?.name}, within allowed ${office?.radiusMeters}m.`
                        : `Please move inside ${office?.name} boundary (within ${office?.radiusMeters}m) to complete enrollment.`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep(4)}
                  className="px-5 py-2.5 rounded-xl border border-slate-700 font-bold text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-1.5"
                >
                  <ChevronLeft size={16} /> Back
                </button>
                <button
                  onClick={() => setStep(6)}
                  disabled={!geofencePassed}
                  className="px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-orange-500/25 disabled:opacity-50 transition-all"
                >
                  Confirm & Review <ChevronRight size={16} />
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
              className="space-y-4 sm:space-y-6"
            >
              {!enrollmentDone ? (
                <>
                  <div className="border-b border-slate-800 pb-3">
                    <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="text-orange-500" size={20} />
                      Step 6: Finalize Biometric Enrollment
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Review all verified biometric, device, and location parameters before finalizing setup.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Employee Identification</p>
                      <p className="text-sm font-bold text-white">
                        {user?.firstName} {user?.lastName} ({user?.employeeId})
                      </p>
                      <p className="text-xs text-slate-400">{user?.department}</p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Assigned Geofence</p>
                      <p className="text-sm font-bold text-white">{office?.name}</p>
                      <p className="text-xs text-emerald-400 font-bold">
                        ✓ Verified ({distanceToOffice}m away, Allowed: {office?.radiusMeters}m)
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Authorized Workstation</p>
                      <p className="text-sm font-bold text-white">{deviceInfo.deviceName}</p>
                      <p className="text-xs text-slate-400 font-mono truncate">{deviceInfo.deviceId}</p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Biometric Template</p>
                      <p className="text-sm font-bold text-orange-400">
                        ✓ {Object.keys(angleCaptures).length} Angles Extracted (128-dim Vector)
                      </p>
                      <p className="text-xs text-slate-400">Encrypted via AES-256-GCM at rest</p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-xs text-orange-300 flex items-center gap-2.5">
                    <Sparkles className="text-orange-400 shrink-0" size={18} />
                    <span>
                      Once saved, your attendance setup is complete. You can mark attendance seamlessly from either of your 2 registered devices.
                    </span>
                  </div>

                  <div className="flex justify-between pt-2">
                    <button
                      onClick={() => setStep(5)}
                      className="px-5 py-2.5 rounded-xl border border-slate-700 font-bold text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-1.5"
                    >
                      <ChevronLeft size={16} /> Back
                    </button>
                    <button
                      onClick={handleSubmitEnrollment}
                      disabled={submitting}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 shadow-xl shadow-orange-500/30 disabled:opacity-50 transition-all"
                    >
                      {submitting ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Encrypting & Saving...
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={18} /> Complete Attendance Setup
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                /* Celebration Complete Screen */
                <div className="py-6 text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center shadow-2xl shadow-emerald-500/30 animate-bounce">
                    <CheckCircle2 size={46} />
                  </div>

                  <div className="space-y-1.5">
                    <h2 className="text-xl sm:text-2xl font-black text-white">
                      Attendance Enrollment Completed!
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                      Your biometric template and authorized devices are securely registered. From now on, simply open HRMS on your phone or laptop to automatically verify attendance.
                    </p>
                  </div>

                  <div className="flex justify-center gap-4 pt-2">
                    <button
                      onClick={() => navigate('/attendance')}
                      className="px-8 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs uppercase tracking-wider shadow-xl shadow-orange-500/30 transition-all"
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
