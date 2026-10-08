import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Scan,
  Crosshair,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  ShieldCheck,
  X,
  RefreshCw,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import api from '../services/api';
import { getClientDeviceInfo } from '../utils/deviceFingerprint';
import { extractFaceEmbeddingFromCanvas, LivenessDetector } from '../utils/faceBiometrics';

interface SmartBiometricModalProps {
  isOpen: boolean;
  onClose: () => void;
  action: 'CHECK_IN' | 'CHECK_OUT';
  officeName?: string;
  onSuccess: (data: any) => void;
  onViolationLocked?: () => void;
}

export const SmartBiometricModal: React.FC<SmartBiometricModalProps> = ({
  isOpen,
  onClose,
  action,
  officeName = 'OneBridge Infotech HQ',
  onSuccess,
  onViolationLocked,
}) => {
  const navigate = useNavigate();

  const [livenessStatus, setLivenessStatus] = useState<string>('Initializing camera...');
  const [livenessScore, setLivenessScore] = useState<number>(0);
  const [livenessPassed, setLivenessPassed] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);

  // Warning state from server
  const [warningData, setWarningData] = useState<{
    count: number;
    max: number;
    remaining: number;
    message: string;
    isLockedAbsent: boolean;
  } | null>(null);

  // Success state
  const [successData, setSuccessData] = useState<any | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const livenessDetectorRef = useRef<LivenessDetector>(new LivenessDetector());
  const animFrameRef = useRef<number | null>(null);
  const isVerifyingRef = useRef<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setWarningData(null);
      setSuccessData(null);
      setLivenessPassed(false);
      setLivenessScore(0);
      setVerifying(false);
      isVerifyingRef.current = false;
      livenessDetectorRef.current.reset();

      setTimeout(() => {
        openCamera();
      }, 100);
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const openCamera = async () => {
    try {
      setLivenessStatus('Connecting to camera...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      runLivenessLoop();
    } catch (err: any) {
      setLivenessStatus('Camera access denied or unavailable: ' + err.message);
    }
  };

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
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

        if (result.passed && !isVerifyingRef.current) {
          setLivenessPassed(true);
          isVerifyingRef.current = true;
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
    setLivenessStatus('Liveness verified! Capturing face embedding & GPS...');

    // 1. Capture 128-dim embedding
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const liveEmbedding = extractFaceEmbeddingFromCanvas(canvas);

    // 2. Fetch GPS
    if (!navigator.geolocation) {
      setWarningData({
        count: 1,
        max: 3,
        remaining: 2,
        message: 'Geolocation is not supported by your browser.',
        isLockedAbsent: false,
      });
      setVerifying(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
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
            forcedAction: action,
          };

          const res = await api.post('/attendance/smart/verify-and-mark', payload);

          if (res.data.status === 'success') {
            setSuccessData(res.data);
            setVerifying(false);
            setTimeout(() => {
              onSuccess(res.data);
              onClose();
            }, 1800);
          }
        } catch (err: any) {
          setVerifying(false);
          const data = err.response?.data;

          if (data?.enrollmentPending) {
            setWarningData({
              count: 0,
              max: 3,
              remaining: 3,
              message: data.message || 'First-time face enrollment required.',
              isLockedAbsent: false,
            });
            return;
          }

          if (data?.markedAbsent || data?.isLockedAbsent || data?.warningCount >= 3) {
            setWarningData({
              count: 3,
              max: 3,
              remaining: 0,
              message: data.message || 'Exceeded 3 warnings. You have been automatically marked ABSENT for today.',
              isLockedAbsent: true,
            });
            onViolationLocked?.();
            return;
          }

          if (data?.warningCount) {
            setWarningData({
              count: data.warningCount,
              max: data.maxWarnings || 3,
              remaining: data.remainingAttempts !== undefined ? data.remainingAttempts : Math.max(0, 3 - data.warningCount),
              message: data.message || 'Verification failed.',
              isLockedAbsent: false,
            });
            return;
          }

          // Generic error fallback
          setWarningData({
            count: 1,
            max: 3,
            remaining: 2,
            message: err.response?.data?.message || err.message || 'Verification failed. Please try again.',
            isLockedAbsent: false,
          });
        }
      },
      (geoErr) => {
        setVerifying(false);
        setWarningData({
          count: 1,
          max: 3,
          remaining: 2,
          message: `GPS error: ${geoErr.message}. Ensure location permissions are granted.`,
          isLockedAbsent: false,
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleRetry = () => {
    setWarningData(null);
    setLivenessPassed(false);
    setLivenessScore(0);
    setVerifying(false);
    isVerifyingRef.current = false;
    livenessDetectorRef.current.reset();
    runLivenessLoop();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-brand-950 text-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-indigo-500/30 shadow-2xl relative space-y-6"
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 rounded-2xl shadow-md shadow-indigo-600/30">
              <Scan size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-base font-extrabold flex items-center gap-2">
                {action === 'CHECK_IN' ? 'Clock In Biometric Verification' : 'Clock Out Biometric Verification'}
              </h3>
              <p className="text-xs text-brand-400 flex items-center gap-1">
                <MapPin size={12} className="text-emerald-400" />
                {officeName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-brand-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={18} />
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

          {/* Biometric Oval Guide */}
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
          <div className="absolute top-3 inset-x-3 flex justify-between items-center bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs">
            <span className="text-[11px] font-bold text-indigo-300 truncate max-w-[220px]">
              {livenessStatus}
            </span>
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                livenessPassed ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white'
              }`}
            >
              {Math.round(livenessScore * 100)}% Liveness
            </span>
          </div>

          {/* Success Overlay Animation */}
          <AnimatePresence>
            {successData && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-3"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 shadow-xl">
                  <CheckCircle2 size={36} />
                </div>
                <h4 className="text-lg font-black text-white">Verified Successfully!</h4>
                <p className="text-xs text-brand-300 font-medium">
                  {successData.message}
                </p>
                {successData.data?.verification && (
                  <div className="flex gap-4 text-[11px] text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
                    <span>Match: {successData.data.verification.faceMatchScore}%</span>
                    <span>•</span>
                    <span>Distance: {successData.data.verification.distanceMeters}m</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Liveness Progress Bar */}
        {!warningData && !successData && (
          <div className="space-y-2">
            <div className="h-1.5 w-full bg-brand-900 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  livenessPassed ? 'bg-emerald-500' : 'bg-indigo-500'
                }`}
                style={{ width: `${Math.min(100, Math.round(livenessScore * 100))}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-xs text-brand-400">
              <span>Align face inside oval frame</span>
              {verifying && (
                <span className="text-indigo-400 font-bold flex items-center gap-1.5">
                  <RefreshCw size={12} className="animate-spin" />
                  Verifying Face & Geofence...
                </span>
              )}
            </div>
          </div>
        )}

        {/* WARNING SYSTEM NOTIFICATION CARD */}
        <AnimatePresence>
          {warningData && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-2xl border text-xs space-y-3 ${
                warningData.isLockedAbsent
                  ? 'bg-rose-950/80 border-rose-500 text-rose-100 shadow-lg shadow-rose-950/50'
                  : 'bg-amber-950/80 border-amber-500 text-amber-100 shadow-lg shadow-amber-950/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    warningData.isLockedAbsent ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'
                  }`}
                >
                  {warningData.isLockedAbsent ? (
                    <AlertOctagon size={20} />
                  ) : (
                    <AlertTriangle size={20} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-extrabold uppercase tracking-wider text-[11px]">
                      {warningData.isLockedAbsent
                        ? '3 Warnings Exceeded — Automatically Marked ABSENT'
                        : `Security Warning ${warningData.count} of ${warningData.max}`}
                    </h4>
                    {!warningData.isLockedAbsent && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-black text-[10px]">
                        {warningData.remaining} attempt(s) left
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-90">{warningData.message}</p>
                </div>
              </div>

              {/* Action Buttons inside Warning Box */}
              <div className="flex gap-2 pt-2 border-t border-white/10">
                {warningData.message.includes('enrollment required') || warningData.count === 0 ? (
                  <button
                    onClick={() => {
                      onClose();
                      navigate('/attendance/enrollment');
                    }}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2"
                  >
                    <span>Go to Face Biometric Setup</span>
                    <ExternalLink size={14} />
                  </button>
                ) : warningData.isLockedAbsent ? (
                  <button
                    onClick={onClose}
                    className="w-full py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl font-bold"
                  >
                    Acknowledged (Marked Absent)
                  </button>
                ) : (
                  <button
                    onClick={handleRetry}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={14} />
                    <span>Retry Verification ({warningData.remaining} left)</span>
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Footer Controls */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-white/10 text-brand-400 hover:text-white text-xs font-bold transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default SmartBiometricModal;
