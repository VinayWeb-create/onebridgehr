import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BellRing, Check, Sparkles, Clock, Smartphone, X } from 'lucide-react';
import { subscribeToPushNotifications } from '../registerServiceWorker';

export const NotificationPermissionModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If browser doesn't support Notifications, don't show
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    // If notifications are ALREADY enabled, NEVER ask again
    if (Notification.permission === 'granted') {
      return;
    }

    // Check if dismissed in the current login session
    const dismissedThisSession = sessionStorage.getItem('obi_push_dismissed_session');
    if (dismissedThisSession) {
      return;
    }

    // Show prompt 1.2s after landing on dashboard
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const granted = await subscribeToPushNotifications();
      if (granted || (typeof window !== 'undefined' && Notification.permission === 'granted')) {
        // Once enabled, it will never show again
        setIsOpen(false);
      } else {
        // Permission was denied or dismissed; close for this session, ask again next login
        sessionStorage.setItem('obi_push_dismissed_session', 'true');
        setIsOpen(false);
      }
    } catch {
      sessionStorage.setItem('obi_push_dismissed_session', 'true');
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    // Dismiss only for the current login attempt; will ask again next login
    sessionStorage.setItem('obi_push_dismissed_session', 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleDismiss}
          className="fixed inset-0 bg-brand-950/60 backdrop-blur-sm"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-md bg-white dark:bg-brand-900 rounded-3xl shadow-2xl border border-brand-200 dark:border-brand-800 p-6 overflow-hidden z-10"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-16 -right-16 w-36 h-36 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Close Icon */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-2 rounded-xl text-brand-400 hover:text-brand-700 dark:hover:text-white hover:bg-brand-100 dark:hover:bg-brand-800 transition-all cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          {/* Header Icon */}
          <div className="flex items-center space-x-3.5 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/25 shrink-0">
              <BellRing size={22} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-brand-950 dark:text-white leading-tight">
                Enable Notifications
              </h3>
              <p className="text-xs text-brand-500 dark:text-brand-400 font-medium mt-0.5">
                Stay updated with attendance & shift alerts
              </p>
            </div>
          </div>

          {/* Feature List */}
          <div className="space-y-2.5 my-5">
            <div className="flex items-start space-x-3 p-2.5 rounded-xl bg-brand-50 dark:bg-brand-800/50 border border-brand-100 dark:border-brand-800">
              <div className="p-1 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5">
                <Sparkles size={14} />
              </div>
              <div>
                <p className="text-xs font-bold text-brand-900 dark:text-brand-100">Daily Energetic Boosts</p>
                <p className="text-[11px] text-brand-500 dark:text-brand-400">
                  Morning, afternoon & evening uplifting reminders to keep you motivated.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-2.5 rounded-xl bg-brand-50 dark:bg-brand-800/50 border border-brand-100 dark:border-brand-800">
              <div className="p-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                <Clock size={14} />
              </div>
              <div>
                <p className="text-xs font-bold text-brand-900 dark:text-brand-100">Shift Check-Out Reminders</p>
                <p className="text-[11px] text-brand-500 dark:text-brand-400">
                  Timely alerts so you never miss verifying your daily attendance.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-2.5 rounded-xl bg-brand-50 dark:bg-brand-800/50 border border-brand-100 dark:border-brand-800">
              <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                <Smartphone size={14} />
              </div>
              <div>
                <p className="text-xs font-bold text-brand-900 dark:text-brand-100">Works Outside the App</p>
                <p className="text-[11px] text-brand-500 dark:text-brand-400">
                  Instant lock screen notifications even when the app is closed.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3 pt-2">
            <button
              type="button"
              onClick={handleDismiss}
              disabled={loading}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-brand-600 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-800 transition-all cursor-pointer text-center"
            >
              Maybe Later
            </button>
            <button
              type="button"
              onClick={handleEnable}
              disabled={loading}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 transition-all shadow-md shadow-orange-500/25 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Enabling...</span>
              ) : (
                <>
                  <Check size={14} />
                  <span>Enable Now</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
