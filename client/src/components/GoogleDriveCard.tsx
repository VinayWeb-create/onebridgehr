import React, { useCallback, useEffect, useState } from 'react';
import {
  Cloud,
  CheckCircle2,
  AlertCircle,
  Link2,
  Unplug,
  Loader2,
} from 'lucide-react';
import api from '../services/api';
import { useDialog } from '../context/DialogContext';

interface DriveStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
  expiresAt: string | null;
}

interface Banner {
  type: 'success' | 'error';
  message: string;
}

const GoogleDriveCard: React.FC = () => {
  const { confirm, alert } = useDialog();
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/drive/status');
      setStatus(res.data.data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();

    const params = new URLSearchParams(window.location.search);
    if (params.get('drive') === 'connected') {
      const email = params.get('email');
      setBanner({
        type: 'success',
        message: email
          ? `Google Drive connected as ${email}.`
          : 'Google Drive connected successfully.',
      });
    } else if (params.get('drive') === 'error') {
      setBanner({
        type: 'error',
        message: `Google Drive connection failed: ${params.get('message') || 'unknown error'}`,
      });
    }
    if (params.has('drive')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [loadStatus]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 6000);
    return () => clearTimeout(t);
  }, [banner]);

  const handleConnect = async () => {
    setBusy(true);
    try {
      const res = await api.get('/drive/auth');
      window.location.href = res.data.data.authUrl;
    } catch (err: any) {
      setBanner({
        type: 'error',
        message: err.response?.data?.message || 'Failed to start Google Drive connection.',
      });
      setBusy(false);
    }
  };

  const handleMockConnect = async () => {
    setBusy(true);
    try {
      await api.post('/drive/mock-connect');
      setBanner({ type: 'success', message: 'Mock connection established. Using Local Storage fallback.' });
      loadStatus();
    } catch (err: any) {
      setBanner({
        type: 'error',
        message: err.response?.data?.message || 'Failed to establish mock connection.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!(await confirm({ title: 'Confirmation', message: 'Disconnect the company Google account from Drive uploads?' }))) return;
    setBusy(true);
    try {
      await api.post('/drive/disconnect');
      setBanner({ type: 'success', message: 'Google Drive disconnected.' });
      setStatus((s) => (s ? { ...s, connected: false, email: null } : s));
    } catch (err: any) {
      setBanner({ type: 'error', message: err.response?.data?.message || 'Failed to disconnect.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-md">
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-bold text-sm uppercase tracking-wider text-brand-950 dark:text-white flex items-center space-x-2">
          <Cloud size={16} className="text-orange-500" />
          <span>Google Drive Storage</span>
        </h3>
        {!loading && status?.connected && (
          <span className="text-[10px] px-3 py-1 rounded-full font-black uppercase border bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-500/30">
            Connected
          </span>
        )}
        {!loading && status && !status.connected && status.configured && (
          <span className="text-[10px] px-3 py-1 rounded-full font-black uppercase border bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-500/30">
            Not Connected
          </span>
        )}
      </div>

      {banner && (
        <div
          className={`mb-4 flex items-start space-x-2 p-3 rounded-xl border text-xs font-bold ${
            banner.type === 'success'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-500/30'
              : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-500/30'
          }`}
        >
          {banner.type === 'success' ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <AlertCircle size={14} className="shrink-0 mt-0.5" />}
          <span className="break-all">{banner.message}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center space-x-2 text-xs text-brand-500 font-semibold py-4">
          <Loader2 size={14} className="animate-spin text-orange-500" />
          <span>Checking connection...</span>
        </div>
      ) : status && !status.configured && !status.connected ? (
        <div className="space-y-4">
          <p className="flex items-start space-x-2 p-3 bg-brand-50 dark:bg-brand-900/50 rounded-xl border border-brand-100 dark:border-brand-800 text-xs text-brand-600 dark:text-brand-400">
            <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <span>
              Google OAuth is not configured. Set <code className="font-black">GOOGLE_CLIENT_ID</code>,{' '}
              <code className="font-black">GOOGLE_CLIENT_SECRET</code> and{' '}
              <code className="font-black">GOOGLE_REDIRECT_URI</code> in the server .env, then restart the
              server.
            </span>
          </p>
          <button
            onClick={handleMockConnect}
            disabled={busy}
            className="inline-flex items-center space-x-1.5 bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-xl px-4 py-2.5 font-black text-[11px] tracking-wider uppercase transition-all shadow-lg shadow-indigo-500/30 disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
            <span>Direct Connect (Local Storage)</span>
          </button>
        </div>
      ) : status?.connected ? (
        <div className="space-y-4 text-xs text-brand-600 dark:text-brand-400">
          <div className="flex items-center space-x-2.5 p-3 bg-brand-50 dark:bg-brand-900/50 rounded-xl border border-brand-100 dark:border-brand-800">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            <div>
              <p className="font-black text-brand-950 dark:text-white break-all">
                {status.email || 'Company Google account'}
              </p>
              <p className="text-[10px] text-brand-500 font-semibold">
                Uploads go to the My Drive of this account.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleConnect}
              disabled={busy}
              className="inline-flex items-center space-x-1.5 bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl px-4 py-2.5 font-black text-[11px] tracking-wider uppercase transition-all shadow-lg shadow-orange-500/30 disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
              <span>Reconnect</span>
            </button>
            <button
              onClick={handleDisconnect}
              disabled={busy}
              className="inline-flex items-center space-x-1.5 bg-brand-200 hover:bg-rose-100 hover:text-rose-700 dark:bg-brand-800 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 text-brand-900 dark:text-white rounded-xl px-4 py-2.5 font-black text-[11px] tracking-wider uppercase transition-all border border-brand-300 dark:border-brand-700 disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Unplug size={14} />}
              <span>Disconnect</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-brand-600 dark:text-brand-400 flex items-start space-x-2 p-3 bg-brand-50 dark:bg-brand-900/50 rounded-xl border border-brand-100 dark:border-brand-800">
            <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <span>
              Connect the company Google account so onboarding documents and offer letters are uploaded to
              its My Drive automatically.
            </span>
          </p>
          <button
            onClick={handleConnect}
            className="inline-flex items-center space-x-1.5 bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl px-4 py-2.5 font-black text-[11px] tracking-wider uppercase transition-all shadow-lg shadow-orange-500/30"
          >
            <Link2 size={14} />
            <span>Connect Google Drive</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default GoogleDriveCard;
