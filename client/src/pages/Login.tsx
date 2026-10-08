import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertTriangle,
  ArrowRight,
  Globe,
  Users,
  Cog,
  BarChart3,
  ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AiMascotRobot, type RobotState } from '../components/AiMascotRobot';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('hr@onebridge.com');
  const [password, setPassword] = useState('hr12345');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [robotState, setRobotState] = useState<RobotState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setRobotState('loading');

    try {
      const res = await api.post('/auth/login', {
        email,
        password,
        rememberMe,
      });

      if (res.data.status === 'success') {
        setRobotState('success');
        const { token, refreshToken, user } = res.data.data;
        setTimeout(() => {
          login(token, refreshToken, user);
          navigate('/dashboard');
        }, 1200);
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      const msg = err.response?.data?.message || 'Login failed. Please check your credentials.';
      setError(msg);
      setRobotState('failed');
      setTimeout(() => {
        setRobotState('idle');
      }, 3500);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordFocus = () => {
    setRobotState(showPassword ? 'password_visible' : 'password_hidden');
  };

  const togglePasswordVisibility = () => {
    const nextVal = !showPassword;
    setShowPassword(nextVal);
    setRobotState(nextVal ? 'password_visible' : 'password_hidden');
  };

  const featurePills = [
    {
      title: 'Empower',
      sub: 'Your Team',
      icon: Users,
    },
    {
      title: 'Automate',
      sub: 'HR Operations',
      icon: Cog,
    },
    {
      title: 'Build a',
      sub: 'Better Workplace',
      icon: BarChart3,
    },
  ];

  return (
    <div className="min-h-screen bg-[#07080c] text-white flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans relative overflow-x-hidden pt-safe pb-safe selection:bg-orange-500 selection:text-white">
      {/* Background with Ambient Glowing Waves & Vignette */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Abstract Glowing Silk Ribbon Texture */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-screen scale-105"
          style={{ backgroundImage: 'url(/mascot/bg_waves.jpg)' }}
        />

        {/* Ambient Dark Gradient Vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#07080c] via-transparent to-[#07080c]/80" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#07080c]/90 via-transparent to-[#07080c]/90" />

        {/* Soft Glowing Orange Orbs */}
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-orange-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[140px]" />
      </div>

      {/* Top Header Bar */}
      <header className="relative z-20 w-full max-w-7xl mx-auto flex items-center justify-between pb-4">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white p-1.5 shadow-md border border-white/20 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
            <img src="/icons/icon-192x192.png" alt="Onebridge Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-white leading-none">
                Onebridge<span className="text-orange-500">®</span>
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase mt-0.5">
              Infotech Pvt Ltd — <span className="text-orange-400 font-bold">HRMS</span>
            </p>
          </div>
        </Link>

        {/* Language Selector Pill */}
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-slate-300 transition-colors shadow-sm"
        >
          <Globe size={13} className="text-orange-400" />
          <span>EN</span>
          <ChevronDown size={12} className="text-slate-400" />
        </button>
      </header>

      {/* Main Hero & Login Area */}
      <main className="relative z-10 w-full max-w-7xl mx-auto my-auto py-4 sm:py-8 lg:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* ========================================================= */}
          {/* LEFT SIDE: Brand Pillar Headlines & Features (Desktop)  */}
          {/* ========================================================= */}
          <div className="hidden lg:flex lg:col-span-6 flex-col justify-between space-y-8 pr-4">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-1"
              >
                <h1 className="text-5xl xl:text-6xl font-black tracking-tight text-white leading-none">
                  People
                </h1>
                <h1 className="text-5xl xl:text-6xl font-black tracking-tight text-white leading-none">
                  Process
                </h1>
                <h1 className="text-5xl xl:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-orange-500 to-amber-500 leading-tight">
                  Growth
                </h1>
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="text-sm text-slate-400 mt-4 max-w-md font-medium leading-relaxed"
              >
                A smarter HRMS for a more connected workplace.
              </motion.p>
            </div>

            {/* 3 Sleek Feature Pills */}
            <div className="space-y-3.5 max-w-md">
              {featurePills.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
                    whileHover={{ x: 4 }}
                    className="flex items-center gap-4 p-3 rounded-2xl bg-slate-900/40 border border-white/[0.08] backdrop-blur-md transition-all"
                  >
                    <div className="w-11 h-11 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0 shadow-sm shadow-orange-500/10">
                      <Icon size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{item.title}</h4>
                      <p className="text-sm font-bold text-white mt-0.5">{item.sub}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT SIDE: Floating Glass Card Login Form              */}
          {/* ========================================================= */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="w-full max-w-md rounded-[32px] p-6 sm:p-9 bg-slate-900/60 dark:bg-slate-900/70 border border-orange-500/30 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85),0_0_50px_rgba(243,112,33,0.18)] backdrop-blur-2xl relative"
            >
              {/* Top Mascot Robot Head with Glowing Halo & Speech Bubble */}
              <div className="flex justify-center items-center mb-5">
                <AiMascotRobot state={robotState} />
              </div>

              {/* Title & Subtitle */}
              <div className="text-center mb-6">
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Sign <span className="text-orange-500">In</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1 font-medium">
                  Welcome back! Please enter your details.
                </p>
              </div>

              {/* Error Alert Banner */}
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.96 }}
                    className="mb-5 p-3.5 rounded-2xl bg-rose-950/50 border border-rose-800/60 flex items-start gap-3 text-rose-300 text-xs shadow-lg"
                  >
                    <AlertTriangle className="shrink-0 mt-0.5 text-rose-400" size={16} />
                    <div className="min-w-0">
                      <p className="font-bold">Authentication Failed</p>
                      <p className="mt-0.5 text-slate-300 leading-relaxed text-[11px]">{error}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Sign In Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email Address */}
                <div className="space-y-1.5">
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-orange-400 transition-colors">
                      <Mail size={17} />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onFocus={() => setRobotState('email')}
                      onBlur={() => robotState === 'email' && setRobotState('idle')}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (robotState !== 'email') setRobotState('email');
                      }}
                      placeholder="hr@onebridge.com"
                      className="w-full bg-white/[0.04] border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-xs sm:text-sm font-medium text-white placeholder-slate-500 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all shadow-inner"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-orange-400 transition-colors">
                      <Lock size={17} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onFocus={handlePasswordFocus}
                      onBlur={() =>
                        ['password_hidden', 'password_visible'].includes(robotState) &&
                        setRobotState('idle')
                      }
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white/[0.04] border border-white/10 rounded-2xl py-3.5 pl-11 pr-11 text-xs sm:text-sm font-medium text-white placeholder-slate-500 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all shadow-inner tracking-wider"
                    />
                    <button
                      type="button"
                      onClick={togglePasswordVisibility}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300 font-medium select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-white/20 bg-white/10 text-orange-500 focus:ring-orange-500 focus:ring-offset-0 transition-colors cursor-pointer"
                    />
                    <span>Remember me</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      alert('Please contact your HR administrator at hr@onebridgeinfotech.com to reset your credentials.');
                    }}
                    className="text-orange-400 hover:text-orange-300 font-semibold transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>

                {/* Submit Sign In Button */}
                <motion.button
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  type="submit"
                  disabled={loading}
                  className="w-full mt-3 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 hover:from-orange-600 hover:to-orange-700 text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-xl shadow-orange-500/30 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight size={17} />
                    </>
                  )}
                </motion.button>
              </form>

              {/* Administrator Note */}
              <div className="mt-6 pt-4 border-t border-white/[0.06] text-center text-xs text-slate-400">
                <span>New to Onebridge HRMS? </span>
                <span className="text-slate-300 font-semibold">Contact your administrator.</span>
              </div>
            </motion.div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-20 w-full max-w-7xl mx-auto pt-4 pb-2 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <p>© 2026 Onebridge Infotech Pvt Ltd. All rights reserved.</p>
        <p className="flex items-center gap-4 text-[11px] text-slate-400">
          <span>Secure</span>
          <span>•</span>
          <span>Reliable</span>
          <span>•</span>
          <span>People First</span>
        </p>
      </footer>
    </div>
  );
};

export default Login;
