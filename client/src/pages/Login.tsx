import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { KeyRound, Mail, AlertTriangle, ShieldCheck } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('hr@onebridge.com');
  const [password, setPassword] = useState('hr12345');
  const [rememberMe, setRememberMe] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.post('/auth/login', {
        email,
        password,
        rememberMe,
      });

      if (res.data.status === 'success') {
        const { token, refreshToken, user } = res.data.data;
        login(token, refreshToken, user);
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      const msg = err.response?.data?.message || 'Login failed. Please check connection.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-brand-50 dark:bg-brand-950">
      
      {/* Visual background decorations */}
      <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-orange-500/10 blur-3xl" />
      <div className="absolute bottom-20 right-20 w-72 h-72 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="w-full max-w-md glass rounded-3xl p-8 md:p-10 shadow-2xl relative z-10 border border-brand-200 dark:border-brand-900 transition-all">
        {/* Branding header */}
        <div className="text-center mb-8">
          <img src="/image.png" className="h-16 object-contain mx-auto" alt="OneBridge Logo" />
          <h2 className="font-black text-2xl tracking-tight text-brand-950 dark:text-white mt-4">OneBridge Infotech</h2>
          <p className="text-xs text-brand-500 dark:text-brand-400 mt-1.5 font-medium">Enterprise HR Management System</p>
        </div>

        {/* Warning notification banner */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 flex items-start space-x-3 text-rose-600 dark:text-rose-400 text-xs">
            <AlertTriangle className="shrink-0 mt-0.5" size={16} />
            <div>
              <p className="font-bold">Access Denied</p>
              <p className="mt-0.5 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* Form elements */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-brand-600 dark:text-brand-400 tracking-wide uppercase pl-1">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-brand-400">
                <Mail size={16} />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@onebridgeinfotech.com"
                className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-2xl py-3 pl-11 pr-4 text-sm font-semibold outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all text-brand-950 dark:text-white"
              />
            </div>
          </div>

          {/* Password field */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center px-1">
              <label className="text-xs font-bold text-brand-600 dark:text-brand-400 tracking-wide uppercase">
                Password
              </label>
              <span className="text-[11px] text-indigo-600 hover:underline cursor-pointer font-bold">
                Forgot password?
              </span>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-brand-400">
                <KeyRound size={16} />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-2xl py-3 pl-11 pr-4 text-sm font-semibold outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all text-brand-950 dark:text-white"
              />
            </div>
          </div>

          {/* Checkbox row */}
          <div className="flex items-center justify-between px-1 text-xs font-semibold text-brand-600 dark:text-brand-400">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-brand-300 dark:border-brand-800 text-indigo-600 focus:ring-indigo-600"
              />
              <span>Remember this session</span>
            </label>
          </div>

          {/* Action button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl py-3.5 font-bold text-sm tracking-wide shadow-lg shadow-indigo-600/25 flex items-center justify-center space-x-2 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? (
              <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <>
                <ShieldCheck size={18} />
                <span>Verify & Continue</span>
              </>
            )}
          </button>
        </form>
        
        {/* Quick Demo Login Credentials */}
        <div className="mt-6 pt-5 border-t border-brand-200 dark:border-brand-900 text-center">
          <p className="text-[10px] text-brand-500 font-bold uppercase tracking-wider mb-2.5">Quick Demo Logins</p>
          <div className="flex justify-center space-x-2">
            <button
              type="button"
              onClick={() => {
                setEmail('superadmin@onebridge.com');
                setPassword('admin123');
              }}
              className="bg-brand-100/50 hover:bg-brand-200/50 dark:bg-brand-900/50 dark:hover:bg-brand-800/50 text-[10px] text-brand-900 dark:text-white rounded-xl px-3 py-2 font-bold transition-all border border-brand-200/40 dark:border-brand-800/40"
            >
              👑 Super Admin
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail('hr@onebridge.com');
                setPassword('hr12345');
              }}
              className="bg-brand-100/50 hover:bg-brand-200/50 dark:bg-brand-900/50 dark:hover:bg-brand-800/50 text-[10px] text-brand-900 dark:text-white rounded-xl px-3 py-2 font-bold transition-all border border-brand-200/40 dark:border-brand-800/40"
            >
              💼 HR Manager
            </button>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[10px] text-brand-400 dark:text-brand-500 mt-8 leading-relaxed font-semibold uppercase">
          OneBridge Infotech Pvt. Ltd. | Secure RBAC Node
        </p>
      </div>
    </div>
  );
};

export default Login;
