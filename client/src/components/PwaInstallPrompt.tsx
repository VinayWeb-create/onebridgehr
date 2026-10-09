import React, { useState, useEffect } from 'react';
import { Download, X, WifiOff, CheckCircle2, Share2, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showOnlineToast, setShowOnlineToast] = useState(false);

  useEffect(() => {
    // Check if app is already running in standalone PWA mode or marked as installed
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://') ||
        localStorage.getItem('onebridge_pwa_installed') === 'true';
      setIsStandalone(isStandaloneMode);
      return isStandaloneMode;
    };

    // Standard browser event when user completes installation
    const handleAppInstalled = () => {
      localStorage.setItem('onebridge_pwa_installed', 'true');
      setIsStandalone(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
      window.dispatchEvent(new CustomEvent('onebridge-pwa-installed'));
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    if (checkStandalone()) {
      return () => {
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // Dismissal check: If dismissed within the last 7 days, don't show
    const dismissedAt = localStorage.getItem('onebridge_pwa_install_dismissed');
    const isDismissedRecently =
      dismissedAt && Date.now() - parseInt(dismissedAt, 10) < 7 * 24 * 60 * 60 * 1000;

    // Listen for Chrome/Edge/Android beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      if (!isDismissedRecently) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for manual install trigger from sidebar or user action
    const handleManualTrigger = () => {
      setShowPrompt(true);
      if (isIosDevice) setShowIosGuide(true);
    };
    window.addEventListener('onebridge-open-install', handleManualTrigger);

    // If iOS and not dismissed recently, show subtle prompt
    if (isIosDevice && !isDismissedRecently && !checkStandalone()) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('appinstalled', handleAppInstalled);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('onebridge-open-install', handleManualTrigger);
      };
    }

    return () => {
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('onebridge-open-install', handleManualTrigger);
    };
  }, []);

  // Offline / Online network status listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowOnlineToast(true);
      const timer = setTimeout(() => setShowOnlineToast(false), 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowOnlineToast(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosGuide(true);
      return;
    }

    if (!deferredPrompt) {
      // Fallback: reload or inform user
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setShowPrompt(false);
        setDeferredPrompt(null);
        setIsStandalone(true);
        localStorage.setItem('onebridge_pwa_installed', 'true');
        window.dispatchEvent(new CustomEvent('onebridge-pwa-installed'));
      } else {
        handleDismiss();
      }
    } catch (err) {
      console.warn('[Onebridge PWA] Install prompt error:', err);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIosGuide(false);
    localStorage.setItem('onebridge_pwa_install_dismissed', Date.now().toString());
  };

  return (
    <>
      {/* Offline Toast Banner */}
      {isOffline && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 text-white px-4 py-2.5 shadow-xl flex items-center justify-between transition-all duration-300"
        >
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between text-xs sm:text-sm font-medium">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              <WifiOff className="w-4 h-4 shrink-0 text-amber-200" />
              <span>
                <strong>You're Offline.</strong> Reconnect to continue syncing your HRMS data.
              </span>
            </div>
            <span className="hidden sm:inline text-xs text-orange-100 bg-white/20 px-2 py-0.5 rounded-full">
              Cached pages active
            </span>
          </div>
        </aside>
      )}

      {/* Online Restored Toast */}
      {showOnlineToast && !isOffline && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed top-0 left-0 right-0 z-[9999] bg-emerald-600 text-white px-4 py-2.5 shadow-xl flex items-center justify-between animate-in fade-in slide-in-from-top duration-300"
        >
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between text-xs sm:text-sm font-medium">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
              <span>
                <strong>Back Online!</strong> All pending HRMS operations and attendance are syncing.
              </span>
            </div>
            <button
              onClick={() => setShowOnlineToast(false)}
              className="text-white/80 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </aside>
      )}

      {/* Install HRMS Prompt (Bottom Floating Sheet/Card) */}
      {showPrompt && !isStandalone && (
        <aside
          aria-labelledby="pwa-install-title"
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-[9990] animate-in fade-in slide-in-from-bottom-4 duration-300"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-xl bg-opacity-95 dark:bg-opacity-95">
            <div className="flex items-start gap-3.5">
              {/* Official Onebridge Logo */}
              <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/60 p-1.5 flex items-center justify-center shrink-0 shadow-sm">
                <img
                  src="/icons/icon-192x192.png"
                  alt="Onebridge HRMS Logo"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 id="pwa-install-title" className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                    Install Onebridge HRMS
                  </h3>
                  <button
                    onClick={handleDismiss}
                    aria-label="Dismiss install prompt"
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg -mr-1 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  Install the HRMS on your device for a faster experience.
                </p>

                {/* iOS Instructions Modal/Accordion */}
                {showIosGuide && (
                  <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/50 rounded-xl text-xs text-slate-700 dark:text-slate-300 space-y-2">
                    <p className="font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4" /> iPhone Installation:
                    </p>
                    <ol className="list-decimal pl-4 space-y-1 text-[11px] leading-relaxed">
                      <li>
                        Tap the <strong className="text-orange-600 dark:text-orange-400">Share</strong> icon <Share2 className="w-3 h-3 inline mx-0.5 text-blue-500" /> in Safari’s bottom bar.
                      </li>
                      <li>
                        Scroll down and tap <strong className="text-slate-900 dark:text-white">Add to Home Screen</strong>.
                      </li>
                      <li>
                        Tap <strong className="text-orange-600 dark:text-orange-400">Add</strong> in the top-right corner.
                      </li>
                    </ol>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2.5 mt-3.5">
                  <button
                    onClick={handleInstallClick}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-md shadow-orange-500/25 transition-all transform active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Install
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                  >
                    Later
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>
      )}
    </>
  );
};

export function triggerPwaInstall() {
  window.dispatchEvent(new CustomEvent('onebridge-open-install'));
}

/**
 * Hook to reactively determine if Onebridge HRMS is already installed
 * (via display-mode: standalone, iOS navigator.standalone, getInstalledRelatedApps,
 * or localStorage marker set on installation).
 */
export function usePwaInstall() {
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');
    const isLocallyMarked = localStorage.getItem('onebridge_pwa_installed') === 'true';
    return isStandalone || isLocallyMarked;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkInstallStatus = async () => {
      // 1. Check standalone display mode
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');

      if (isStandalone) {
        setIsInstalled(true);
        localStorage.setItem('onebridge_pwa_installed', 'true');
        return;
      }

      // 2. Check Chromium getInstalledRelatedApps API
      if ('getInstalledRelatedApps' in navigator) {
        try {
          const relatedApps = await (navigator as any).getInstalledRelatedApps();
          if (Array.isArray(relatedApps) && relatedApps.length > 0) {
            setIsInstalled(true);
            localStorage.setItem('onebridge_pwa_installed', 'true');
            return;
          }
        } catch {
          // ignore
        }
      }

      // 3. Check persistent marker
      if (localStorage.getItem('onebridge_pwa_installed') === 'true') {
        setIsInstalled(true);
      }
    };

    checkInstallStatus();

    const handleAppInstalled = () => {
      setIsInstalled(true);
      localStorage.setItem('onebridge_pwa_installed', 'true');
    };

    const handleCustomInstalled = () => {
      setIsInstalled(true);
    };

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        localStorage.setItem('onebridge_pwa_installed', 'true');
      }
    };

    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('onebridge-pwa-installed', handleCustomInstalled);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    } else if ((mediaQuery as any).addListener) {
      (mediaQuery as any).addListener(handleMediaChange);
    }

    return () => {
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('onebridge-pwa-installed', handleCustomInstalled);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaChange);
      } else if ((mediaQuery as any).removeListener) {
        (mediaQuery as any).removeListener(handleMediaChange);
      }
    };
  }, []);

  return { isInstalled };
}

