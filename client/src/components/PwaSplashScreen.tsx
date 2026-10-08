import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const PwaSplashScreen: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Only display splash screen on initial cold boot for ~1.4s
    const hasSeenSplashInSession = sessionStorage.getItem('onebridge_splash_shown');
    if (hasSeenSplashInSession) {
      setShowSplash(false);
      return;
    }

    sessionStorage.setItem('onebridge_splash_shown', 'true');
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {showSplash && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.45, ease: 'easeInOut' } }}
          className="fixed inset-0 z-[99999] bg-white flex flex-col items-center justify-between p-8 select-none"
        >
          {/* Top spacer for status bar */}
          <div className="h-10" />

          {/* Center Brand Identity */}
          <div className="flex flex-col items-center text-center max-w-xs w-full">
            {/* Logo Mark */}
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="w-28 h-28 mb-5 flex items-center justify-center"
            >
              <img
                src="/icons/icon-192x192.png"
                alt="Onebridge Infotech Logo"
                className="w-full h-full object-contain"
              />
            </motion.div>

            {/* Typography */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="space-y-1"
            >
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 leading-tight">
                Onebridge
              </h1>
              <h2 className="text-sm font-semibold tracking-wide text-slate-600">
                Infotech Pvt Ltd
              </h2>
              <div className="pt-1 flex items-center justify-center gap-2">
                <span className="h-0.5 w-6 bg-orange-500 rounded-full" />
                <span className="text-xs font-black tracking-widest text-orange-600 uppercase">
                  HRMS
                </span>
                <span className="h-0.5 w-6 bg-orange-500 rounded-full" />
              </div>
            </motion.div>

            {/* Animated Loading Bar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="w-36 h-1 bg-orange-100 rounded-full overflow-hidden mt-8"
            >
              <motion.div
                className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full"
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
              />
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-[11px] font-medium tracking-wide text-slate-400 mt-4"
            >
              People • Process • Growth
            </motion.p>
          </div>

          {/* Bottom Wave / Tagline */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            className="text-[10px] text-slate-400 tracking-wider uppercase font-semibold pb-4"
          >
            Autonomous HR Management Suite
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
