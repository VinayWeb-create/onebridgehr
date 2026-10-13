import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BellRing, Check, Sparkles, Clock, Smartphone, X, AlertTriangle, RefreshCw } from 'lucide-react';
import { subscribeToPushNotifications, sendTestPushNotification } from '../registerServiceWorker';

export const NotificationPermissionModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDenied, setIsDenied] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    // If browser doesn't support Notifications, don't show
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    // If notifications are ALREADY enabled, sync subscription and do not disturb
    if (Notification.permission === 'granted') {
      subscribeToPushNotifications().catch(() => {});
      return;
    }

    if (Notification.permission === 'denied') {
      setIsDenied(true);
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
      const currentPerm = typeof window !== 'undefined' ? Notification.permission : 'default';

      if (granted || currentPerm === 'granted') {
        setSuccessMessage('Notifications enabled! A welcome notification has been sent.');
        // Trigger test push to ensure the user device receives it immediately
        sendTestPushNotification().catch(() => {});
        setTimeout(() => {
          setIsOpen(false);
        }, 1800);
      } else if (currentPerm === 'denied') {
        setIsDenied(true);
      } else {
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

          {/* Success Banner */}
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center space-x-2 text-emerald-700 dark:text-emerald-300 text-xs font-semibold"
            >
              <Check size={16} className="text-emerald-500 shrink-0" />
              <span>{successMessage}</span>
            </motion.div>
          )}

          {/* Blocked / Denied Banner */}
          {isDenied && !successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs space-y-1.5"
            >
              <div className="flex items-center space-x-2 font-bold text-amber-900 dark:text-amber-100">
                <AlertTriangle size={15} className="text-amber-500 shrink-0" />
                <span>Notifications Blocked in Browser</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
                To enable: Click the site settings icon (🔒 or ⚙️) beside the browser address bar, set <b>Notifications</b> to <b>Allow</b>, then click below.
              </p>
            </motion.div>
          )}

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
              disabled={loading || Boolean(successMessage)}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 transition-all shadow-md shadow-orange-500/25 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Enabling...</span>
              ) : isDenied ? (
                <>
                  <RefreshCw size={14} />
                  <span>Check Permission Again</span>
                </>
              ) : successMessage ? (
                <>
                  <Check size={14} />
                  <span>Enabled!</span>
                </>
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
