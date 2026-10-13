import React from 'react';
import { motion } from 'framer-motion';
import type { FaceBoundingBox } from '../utils/faceBiometrics';

interface BiometricFaceScannerHUDProps {
  faceBox?: FaceBoundingBox;
  videoWidth?: number;
  videoHeight?: number;
  livenessPassed: boolean;
  livenessScore: number;
  livenessStatus?: string;
  verifying: boolean;
  lightingQuality?: 'OPTIMAL' | 'LOW_LIGHT' | 'OVEREXPOSED';
  lightingBrightness?: number;
  faceAlignment?: 'PERFECT' | 'TOO_FAR' | 'TOO_CLOSE' | 'CENTER_NEEDED';
  multipleFaces?: boolean;
  noFace?: boolean;
}

export const BiometricFaceScannerHUD: React.FC<BiometricFaceScannerHUDProps> = ({
  faceBox,
  livenessPassed,
  verifying,
  multipleFaces = false,
  noFace = false,
}) => {
  const hasFace = faceBox && faceBox.width > 30 && !noFace && !multipleFaces;
  const isLocked = livenessPassed || verifying;

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden font-mono">
      {/* 1. Subtle Ambient Holographic Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0ea5e908_1px,transparent_1px),linear-gradient(to_bottom,#0ea5e908_1px,transparent_1px)] bg-[size:32px_32px] opacity-30" />

      {/* 2. Soft Laser Sweep that frames the view without blocking it */}
      <motion.div
        animate={{
          top: ['15%', '85%', '15%'],
          opacity: [0.3, 0.7, 0.3],
        }}
        transition={{
          duration: 3.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className={`absolute inset-x-12 h-[2px] shadow-[0_0_15px_3px] transition-colors pointer-events-none ${
          isLocked
            ? 'bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-emerald-400/60'
            : hasFace
            ? 'bg-gradient-to-r from-transparent via-orange-400 to-transparent shadow-orange-400/60'
            : 'bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-cyan-400/40'
        }`}
      />

      {/* 3. WIDE, SPACIOUS BIOMETRIC FACE SCAN OVAL & CORNER RETICLES */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4">
        <div
          className={`relative w-64 sm:w-72 md:w-80 h-80 sm:h-92 md:h-96 border-2 rounded-[46%] flex items-center justify-center transition-all duration-500 ${
            isLocked
              ? 'border-emerald-400 shadow-[0_0_35px_rgba(52,211,153,0.5)] bg-emerald-500/5'
              : hasFace
              ? 'border-orange-400/90 shadow-[0_0_30px_rgba(251,146,60,0.4)] border-dashed bg-orange-500/5'
              : 'border-white/30 border-dashed animate-pulse'
          }`}
        >
          {/* Glowing Cyber Corner Brackets framing the wide face scan area */}
          {/* Top-Left */}
          <div
            className={`absolute -top-3 -left-3 w-8 h-8 border-t-3 border-l-3 rounded-tl-xl transition-colors ${
              isLocked
                ? 'border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]'
                : hasFace
                ? 'border-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.8)]'
                : 'border-white/40'
            }`}
          />
          {/* Top-Right */}
          <div
            className={`absolute -top-3 -right-3 w-8 h-8 border-t-3 border-r-3 rounded-tr-xl transition-colors ${
              isLocked
                ? 'border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]'
                : hasFace
                ? 'border-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.8)]'
                : 'border-white/40'
            }`}
          />
          {/* Bottom-Left */}
          <div
            className={`absolute -bottom-3 -left-3 w-8 h-8 border-b-3 border-l-3 rounded-bl-xl transition-colors ${
              isLocked
                ? 'border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]'
                : hasFace
                ? 'border-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.8)]'
                : 'border-white/40'
            }`}
          />
          {/* Bottom-Right */}
          <div
            className={`absolute -bottom-3 -right-3 w-8 h-8 border-b-3 border-r-3 rounded-br-xl transition-colors ${
              isLocked
                ? 'border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]'
                : hasFace
                ? 'border-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.8)]'
                : 'border-white/40'
            }`}
          />

          {/* Subtle Outer Compass Ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
            className={`absolute inset-[-12px] rounded-[46%] border pointer-events-none transition-colors ${
              isLocked ? 'border-emerald-400/30 border-t-emerald-400' : 'border-white/10 border-t-orange-400/60'
            }`}
          />

          {/* Success Pulse Ring when face is locked */}
          {isLocked && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: [0.95, 1.05, 1], opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 rounded-[46%] border-4 border-emerald-400 shadow-[0_0_40px_rgba(52,211,153,0.8)]"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default BiometricFaceScannerHUD;
