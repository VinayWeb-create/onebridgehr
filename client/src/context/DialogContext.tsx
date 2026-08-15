import React, { createContext, useContext, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export type DialogVariant = 'success' | 'error' | 'warning' | 'info' | 'danger';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
}

export interface AlertOptions {
  title?: string;
  message: string;
  variant?: DialogVariant;
}

interface DialogContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  alert: (options: AlertOptions | string) => Promise<void>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions | null;
    resolve: (value: boolean) => void;
  }>({
    isOpen: false,
    options: null,
    resolve: () => {},
  });

  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    options: AlertOptions | null;
    resolve: () => void;
  }>({
    isOpen: false,
    options: null,
    resolve: () => {},
  });

  const confirm = (options: ConfirmOptions | string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        options: typeof options === 'string' ? { message: options } : options,
        resolve,
      });
    });
  };

  const alert = (options: AlertOptions | string): Promise<void> => {
    return new Promise((resolve) => {
      setAlertState({
        isOpen: true,
        options: typeof options === 'string' ? { message: options } : options,
        resolve,
      });
    });
  };

  const closeConfirm = (result: boolean) => {
    confirmState.resolve(result);
    setConfirmState((prev) => ({ ...prev, isOpen: false }));
  };

  const closeAlert = () => {
    alertState.resolve();
    setAlertState((prev) => ({ ...prev, isOpen: false }));
  };

  const getVariantStyles = (variant: DialogVariant = 'info') => {
    switch (variant) {
      case 'success':
        return {
          icon: <CheckCircle2 className="w-6 h-6 text-emerald-500" />,
          bg: 'bg-emerald-50 dark:bg-emerald-500/10',
          button: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20',
        };
      case 'error':
      case 'danger':
        return {
          icon: <AlertCircle className="w-6 h-6 text-rose-500" />,
          bg: 'bg-rose-50 dark:bg-rose-500/10',
          button: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-amber-500" />,
          bg: 'bg-amber-50 dark:bg-amber-500/10',
          button: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20',
        };
      case 'info':
      default:
        return {
          icon: <Info className="w-6 h-6 text-brand-500" />,
          bg: 'bg-brand-50 dark:bg-brand-500/10',
          button: 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand-500/20',
        };
    }
  };

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      
      <AnimatePresence>
        {confirmState.isOpen && confirmState.options && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 400 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-full ${getVariantStyles(confirmState.options.variant || 'warning').bg} shrink-0`}>
                    {getVariantStyles(confirmState.options.variant || 'warning').icon}
                  </div>
                  <div className="flex-1 pt-1">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                      {confirmState.options.title || 'Please Confirm'}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                      {confirmState.options.message}
                    </p>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  onClick={() => closeConfirm(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  {confirmState.options.cancelText || 'Cancel'}
                </button>
                <button
                  onClick={() => closeConfirm(true)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 ${getVariantStyles(confirmState.options.variant || 'warning').button}`}
                >
                  {confirmState.options.confirmText || 'Confirm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {alertState.isOpen && alertState.options && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 400 }}
              className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800 relative"
            >
              <div className="p-6 text-center">
                <div className={`mx-auto w-16 h-16 mb-4 rounded-full flex items-center justify-center ${getVariantStyles(alertState.options.variant || 'info').bg}`}>
                  {React.cloneElement(getVariantStyles(alertState.options.variant || 'info').icon as React.ReactElement<any>, { className: 'w-8 h-8' })}
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  {alertState.options.title || (alertState.options.variant === 'error' ? 'Error' : 'Notification')}
                </h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6">
                  {alertState.options.message}
                </p>
                <button
                  onClick={closeAlert}
                  className={`w-full py-3 rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 ${getVariantStyles(alertState.options.variant || 'info').button}`}
                >
                  OK
                </button>
              </div>
              <button 
                onClick={closeAlert}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X size={20} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DialogContext.Provider>
  );
};
