import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crosshair,
  ShieldCheck,
  Zap,
  Sun,
  Maximize2,
  CheckCircle2,
  Activity,
  AlertCircle,
  Eye,
  Scan,
} from 'lucide-react';
import type { FaceBoundingBox } from '../utils/faceBiometrics';

interface BiometricFaceScannerHUDProps {
  faceBox?: FaceBoundingBox;
  videoWidth?: number;
  videoHeight?: number;
  livenessPassed: boolean;
  livenessScore: number;
  livenessStatus: string;
  verifying: boolean;
  lightingQuality?: 'OPTIMAL' | 'LOW_LIGHT' | 'OVEREXPOSED';
  lightingBrightness?: number;
  faceAlignment?: 'PERFECT' | 'TOO_FAR' | 'TOO_CLOSE' | 'CENTER_NEEDED';
  multipleFaces?: boolean;
  noFace?: boolean;
}

export const BiometricFaceScannerHUD: React.FC<BiometricFaceScannerHUDProps> = ({
  faceBox,
  videoWidth = 640,
  videoHeight = 480,
  livenessPassed,
  livenessScore,
  livenessStatus,
  verifying,
  lightingQuality = 'OPTIMAL',
  lightingBrightness = 120,
  faceAlignment = 'PERFECT',
  multipleFaces = false,
  noFace = false,
}) => {
  // Compute normalized percentage coordinates for the tracking reticle
  const hasFace = faceBox && faceBox.width > 30 && !noFace && !multipleFaces;

  const boxLeft = hasFace ? Math.max(5, Math.min(85, (faceBox.x / videoWidth) * 100)) : 22;
  const boxTop = hasFace ? Math.max(5, Math.min(80, (faceBox.y / videoHeight) * 100)) : 15;
  const boxWidth = hasFace ? Math.max(25, Math.min(70, (faceBox.width / videoWidth) * 100)) : 56;
  const boxHeight = hasFace ? Math.max(30, Math.min(80, (faceBox.height / videoHeight) * 100)) : 70;

  const isLocked = livenessPassed || verifying;

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden font-mono">
      {/* 1. Futuristic Holographic Grid Matrix */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0ea5e90d_1px,transparent_1px),linear-gradient(to_bottom,#0ea5e90d_1px,transparent_1px)] bg-[size:24px_24px] opacity-40" />

      {/* 2. Top Edge Telemetry Bar */}
      <div className="absolute top-2 inset-x-3 flex justify-between items-center text-[10px] uppercase tracking-wider text-cyan-400/90 bg-black/60 backdrop-blur-md px-3 py-1 rounded-xl border border-cyan-500/30">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isLocked ? 'bg-emerald-400' : 'bg-cyan-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isLocked ? 'bg-emerald-500' : 'bg-cyan-500'
              }`}
            />
          </span>
          <span className="font-bold">
            {isLocked ? 'TARGET: LOCKED' : hasFace ? 'TRACKING: ENGAGED' : 'SEARCHING...'}
          </span>
          <span className="hidden sm:inline text-white/40">|</span>
          <span className="hidden sm:inline text-white/60">3D CRANIOFACIAL AI</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[9px] text-white/80">
            <Sun
              size={11}
              className={
                lightingQuality === 'OPTIMAL'
                  ? 'text-emerald-400'
                  : lightingQuality === 'LOW_LIGHT'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }
            />
            <span>
              {lightingQuality === 'OPTIMAL'
                ? 'LIGHT: OK'
                : lightingQuality === 'LOW_LIGHT'
                ? 'LOW LIGHT'
                : 'OVEREXPOSED'}
            </span>
          </div>
          <span
            className={`font-black px-2 py-0.5 rounded text-[10px] ${
              isLocked
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
            }`}
          >
            {Math.round(livenessScore * 100)}%
          </span>
        </div>
      </div>

      {/* 3. Sweeping High-Tech Laser Beam (Up & Down Sweep) */}
      <motion.div
        animate={{
          top: ['12%', '86%', '12%'],
          opacity: [0.6, 0.9, 0.6],
        }}
        transition={{
          duration: 3.2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className={`absolute inset-x-8 h-[2px] shadow-[0_0_20px_4px] transition-colors ${
          isLocked
            ? 'bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-emerald-400/80'
            : 'bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-cyan-400/80'
        }`}
      >
        <div className="absolute right-0 top-1/2 -translate-y-1/2 px-1 py-0.2 bg-black/80 text-[8px] text-cyan-300 border border-cyan-400/40 rounded">
          SCAN
        </div>
      </motion.div>

      {/* 4. Dynamic Face Tracking Reticle Box that follows the user's face! */}
      <AnimatePresence>
        {hasFace && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{
              opacity: 1,
              scale: 1,
              left: `${boxLeft}%`,
              top: `${boxTop}%`,
              width: `${boxWidth}%`,
              height: `${boxHeight}%`,
            }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="absolute rounded-2xl transition-all pointer-events-none"
          >
            {/* 4 Glowing Cyber Corner Brackets */}
            {/* Top-Left */}
            <div
              className={`absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 rounded-tl-lg transition-colors ${
                isLocked
                  ? 'border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)]'
                  : 'border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.7)]'
              }`}
            />
            {/* Top-Right */}
            <div
              className={`absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 rounded-tr-lg transition-colors ${
                isLocked
                  ? 'border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)]'
                  : 'border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.7)]'
              }`}
            />
            {/* Bottom-Left */}
            <div
              className={`absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 rounded-bl-lg transition-colors ${
                isLocked
                  ? 'border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)]'
                  : 'border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.7)]'
              }`}
            />
            {/* Bottom-Right */}
            <div
              className={`absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 rounded-br-lg transition-colors ${
                isLocked
                  ? 'border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)]'
                  : 'border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.7)]'
              }`}
            />

            {/* Target Reticle Tag (Top-Left) */}
            <div
              className={`absolute -top-5 left-0 px-2 py-0.5 rounded text-[9px] font-black tracking-widest flex items-center gap-1 border ${
                isLocked
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50'
                  : 'bg-cyan-950/90 text-cyan-300 border-cyan-500/50'
              }`}
            >
              <Crosshair size={10} className="animate-spin" />
              <span>{isLocked ? 'AUTHENTICATED' : 'SUBJECT_LOCKED'}</span>
            </div>

            {/* Target Reticle Telemetry (Bottom-Right) */}
            <div
              className={`absolute -bottom-5 right-0 px-2 py-0.5 rounded text-[8px] tracking-wider border ${
                isLocked
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40'
                  : 'bg-black/80 text-white/70 border-white/10'
              }`}
            >
              CONF: {Math.round((faceBox.confidence || 0.95) * 100)}%
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. Center Biometric Oval Guide with Cyber Reticle */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={`relative w-48 sm:w-56 h-64 sm:h-72 border-2 rounded-[50%] flex items-center justify-center transition-all duration-500 ${
            isLocked
              ? 'border-emerald-400 shadow-[0_0_40px_rgba(52,211,153,0.5)] bg-emerald-500/5'
              : hasFace
              ? 'border-cyan-400/90 shadow-[0_0_30px_rgba(34,211,238,0.35)] border-dashed bg-cyan-500/5'
              : 'border-indigo-400/50 border-dashed animate-pulse'
          }`}
        >
          {/* Rotating Compass Ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-[-14px] rounded-[50%] border border-cyan-400/20 border-t-cyan-400/60 pointer-events-none"
          />

          {/* Compass Ticks */}
          <span className="absolute top-1 text-[8px] font-bold text-cyan-400/60">00°</span>
          <span className="absolute bottom-1 text-[8px] font-bold text-cyan-400/60">180°</span>
          <span className="absolute left-1 text-[8px] font-bold text-cyan-400/60">270°</span>
          <span className="absolute right-1 text-[8px] font-bold text-cyan-400/60">90°</span>

          {/* Center Target Crosshair */}
          <Crosshair
            size={36}
            className={`transition-all duration-300 ${
              isLocked
                ? 'text-emerald-400 scale-110 drop-shadow-[0_0_12px_rgba(52,211,153,0.9)]'
                : hasFace
                ? 'text-cyan-400/80'
                : 'text-indigo-400/30'
            }`}
          />

          {/* Pulsing Lock Circle when liveness passes */}
          {isLocked && (
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: [0.9, 1.05, 1], opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 rounded-[50%] border-4 border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.8)]"
            />
          )}
        </div>
      </div>

      {/* 6. Dynamic Real-Time Alignment Advisor Pill */}
      <div className="absolute bottom-3 inset-x-3 flex justify-between items-center text-[10px] bg-black/80 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10 text-white">
        <div className="flex items-center gap-2 truncate max-w-[280px]">
          {isLocked ? (
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
          ) : multipleFaces ? (
            <AlertCircle size={14} className="text-rose-400 shrink-0" />
          ) : (
            <Activity size={14} className="text-cyan-400 shrink-0 animate-pulse" />
          )}
          <span className="font-semibold text-white/90 truncate">
            {livenessStatus || 'Align face inside oval frame'}
          </span>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {faceAlignment !== 'PERFECT' && !isLocked && hasFace && (
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 text-[9px]">
              {faceAlignment === 'TOO_FAR'
                ? 'MOVE CLOSER'
                : faceAlignment === 'TOO_CLOSE'
                ? 'MOVE BACK'
                : 'CENTER FACE'}
            </span>
          )}
          {isLocked && (
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/40 text-[9px] flex items-center gap-1">
              <ShieldCheck size={11} /> VERIFIED
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default BiometricFaceScannerHUD;
