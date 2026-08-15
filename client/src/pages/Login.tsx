import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Shield,
  Clock,
  Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type MascotState = 'idle' | 'email' | 'password' | 'success';

const MASCOT_IMAGES: Record<MascotState, string> = {
  idle: '/mascot/idle.jpg',
  email: '/mascot/email.jpg',
  password: '/mascot/password.jpg',
  success: '/mascot/success.jpg',
};

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('hr@onebridge.com');
  const [password, setPassword] = useState('hr12345');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [mascotState, setMascotState] = useState<MascotState>('idle');
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
        setMascotState('success');
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
      setMascotState('idle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b0e] text-white flex items-center justify-center p-4 sm:p-8 font-sans relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Grid Container */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
        
        {/* LEFT COLUMN: Mascot & Branding */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-8 py-4">
          
          {/* Logo Header */}
          <div>
            <div className="flex items-center space-x-3 mb-6">
              <img src="/image.png" alt="OneBridge Logo" className="h-10 object-contain" />
              <div className="flex flex-col">
                <span className="font-extrabold text-xl tracking-wider">
                  <span className="text-[#ea6d2a]">ONE</span>
                  <span className="text-white">BRIDGE</span>
                </span>
                <span className="text-[9px] tracking-widest text-slate-400 font-bold uppercase">INFOTECH</span>
              </div>
            </div>

            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-2">
              Welcome <span className="text-[#ea6d2a]">Back!</span>
            </h1>
            <p className="text-sm text-slate-400 font-medium">
              Sign in to continue your HRMS experience
            </p>
          </div>

          {/* Interactive 3D Mascot Card */}
          <div className="relative flex flex-col items-center">
            
            {/* Tooltip Bubble */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={mascotState}
              className="absolute top-2 right-4 sm:right-12 z-20 bg-slate-900/90 border border-slate-700/80 px-4 py-2 rounded-2xl shadow-xl backdrop-blur-md max-w-xs"
            >
              <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                {mascotState === 'idle' && <>Hi there! 👋 <span className="text-slate-400 font-normal">Login to manage amazing things together.</span></>}
                {mascotState === 'email' && <>Looking good! 👀 <span className="text-slate-400 font-normal">Typing your email address...</span></>}
                {mascotState === 'password' && <>Privacy mode 🙈 <span className="text-slate-400 font-normal">Don't worry, I won't peek at your password!</span></>}
                {mascotState === 'success' && <>Access Granted! 🎉 <span className="text-slate-400 font-normal">Welcome back onboard!</span></>}
              </div>
            </motion.div>

            {/* Mascot Image Container */}
            <div className="w-full max-w-md aspect-square rounded-3xl overflow-hidden border border-slate-800/80 bg-slate-950/40 relative shadow-2xl flex items-center justify-center p-2">
              <AnimatePresence mode="wait">
                <motion.img
                  key={mascotState}
                  src={MASCOT_IMAGES[mascotState]}
                  alt="3D Puppy Mascot"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 0.3 }}
                  className="w-full h-full object-cover rounded-2xl"
                />
              </AnimatePresence>
            </div>
          </div>

          {/* Feature Badges */}
          <div>
            <p className="text-xs font-bold text-center text-[#ea6d2a] tracking-wider uppercase mb-4">
              Why OneBridge HRMS?
            </p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="flex flex-col items-center p-3 rounded-2xl bg-slate-900/40 border border-slate-800/60">
                <Shield size={20} className="text-[#ea6d2a] mb-1.5" />
                <span className="text-xs font-bold text-white">Secure</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Enterprise Grade Security</span>
              </div>

              <div className="flex flex-col items-center p-3 rounded-2xl bg-slate-900/40 border border-slate-800/60">
                <Clock size={20} className="text-[#ea6d2a] mb-1.5" />
                <span className="text-xs font-bold text-white">Smart</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Automate HR Processes</span>
              </div>

              <div className="flex flex-col items-center p-3 rounded-2xl bg-slate-900/40 border border-slate-800/60">
                <Users size={20} className="text-[#ea6d2a] mb-1.5" />
                <span className="text-xs font-bold text-white">Connected</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Empowering Teams</span>
              </div>
            </div>

            <p className="text-center text-[11px] text-slate-500 mt-6">
              © 2026 <span className="text-[#ea6d2a] font-semibold">OneBridge Infotech</span>. All rights reserved.
            </p>
          </div>

        </div>

        {/* RIGHT COLUMN: Sign In Form Card */}
        <div className="lg:col-span-6">
          <div className="bg-[#0f1015] border border-[#ea6d2a]/30 rounded-3xl p-6 sm:p-10 shadow-2xl relative">
            
            {/* Header + Language Switcher */}
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-3xl font-black text-white">
                  Sign <span className="text-[#ea6d2a]">In</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1 font-medium">
                  Welcome back! Please enter your details.
                </p>
              </div>

              <button className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-800/60 border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors">
                <Globe size={14} />
                <span>EN</span>
                <span className="text-[10px]">▼</span>
              </button>
            </div>

            {/* Error Banner */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-800/50 flex items-start space-x-3 text-rose-300 text-xs"
                >
                  <AlertTriangle className="shrink-0 mt-0.5 text-rose-400" size={16} />
                  <div>
                    <p className="font-bold">Authentication Error</p>
                    <p className="mt-0.5 text-slate-300 leading-relaxed">{error}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onFocus={() => setMascotState('email')}
                    onBlur={() => mascotState === 'email' && setMascotState('idle')}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full bg-[#161822] border border-slate-800 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-medium text-white placeholder-slate-500 outline-none focus:border-[#ea6d2a] focus:ring-1 focus:ring-[#ea6d2a] transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onFocus={() => setMascotState('password')}
                    onBlur={() => mascotState === 'password' && setMascotState('idle')}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full bg-[#161822] border border-slate-800 rounded-2xl py-3.5 pl-11 pr-11 text-sm font-medium text-white placeholder-slate-500 outline-none focus:border-[#ea6d2a] focus:ring-1 focus:ring-[#ea6d2a] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center space-x-2 cursor-pointer text-slate-300 font-medium">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-[#ea6d2a] focus:ring-[#ea6d2a] focus:ring-offset-0"
                  />
                  <span>Remember me</span>
                </label>

                <button
                  type="button"
                  className="text-[#ea6d2a] hover:underline font-semibold"
                >
                  Forgot Password?
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#ea6d2a] hover:bg-[#d65c1e] text-white font-bold py-4 rounded-2xl transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg shadow-[#ea6d2a]/20 disabled:opacity-50"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="text-base font-extrabold">Sign In</span>
                    <div className="w-7 h-7 rounded-full bg-black/20 flex items-center justify-center">
                      <ArrowRight size={16} />
                    </div>
                  </>
                )}
              </button>

            </form>

            {/* Divider */}
            <div className="relative my-8 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <span className="relative px-4 text-xs font-semibold text-slate-500 bg-[#0f1015]">
                or continue with
              </span>
            </div>

            {/* Social / SSO Buttons */}
            <div className="grid grid-cols-3 gap-3">
              <button className="flex items-center justify-center space-x-2 py-3 px-3 rounded-2xl bg-[#161822] border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-200 transition-all">
                <span className="text-base font-bold text-rose-500">G</span>
                <span>Google</span>
              </button>

              <button className="flex items-center justify-center space-x-2 py-3 px-3 rounded-2xl bg-[#161822] border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-200 transition-all">
                <span className="text-base font-bold text-blue-500">田</span>
                <span>Microsoft</span>
              </button>

              <button className="flex items-center justify-center space-x-2 py-3 px-3 rounded-2xl bg-[#161822] border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-200 transition-all">
                <span className="text-xs bg-slate-700 rounded-full w-5 h-5 flex items-center justify-center">A</span>
                <span>SSO Login</span>
              </button>
            </div>

            {/* Mascot Interactive State Guide (Matching Screenshot) */}
            <div className="mt-8 pt-6 border-t border-slate-800/80">
              <div className="grid grid-cols-4 gap-2 text-center">
                
                {/* State 1 */}
                <div
                  onClick={() => setMascotState('idle')}
                  className={`cursor-pointer p-2 rounded-xl border transition-all ${
                    mascotState === 'idle'
                      ? 'border-[#ea6d2a] bg-[#ea6d2a]/10'
                      : 'border-slate-800/60 bg-slate-900/30 hover:border-slate-700'
                  }`}
                >
                  <img src="/mascot/idle.jpg" alt="Idle" className="w-10 h-10 object-cover rounded-lg mx-auto mb-1" />
                  <p className="text-[10px] font-bold text-slate-300 truncate">Ready to work</p>
                  <p className="text-[8px] text-slate-500">(Idle)</p>
                </div>

                {/* State 2 */}
                <div
                  onClick={() => setMascotState('email')}
                  className={`cursor-pointer p-2 rounded-xl border transition-all ${
                    mascotState === 'email'
                      ? 'border-[#ea6d2a] bg-[#ea6d2a]/10'
                      : 'border-slate-800/60 bg-slate-900/30 hover:border-slate-700'
                  }`}
                >
                  <img src="/mascot/email.jpg" alt="Email" className="w-10 h-10 object-cover rounded-lg mx-auto mb-1" />
                  <p className="text-[10px] font-bold text-slate-300 truncate">Looking at you</p>
                  <p className="text-[8px] text-slate-500">(Email typed)</p>
                </div>

                {/* State 3 */}
                <div
                  onClick={() => setMascotState('password')}
                  className={`cursor-pointer p-2 rounded-xl border transition-all ${
                    mascotState === 'password'
                      ? 'border-[#ea6d2a] bg-[#ea6d2a]/10'
                      : 'border-slate-800/60 bg-slate-900/30 hover:border-slate-700'
                  }`}
                >
                  <img src="/mascot/password.jpg" alt="Password" className="w-10 h-10 object-cover rounded-lg mx-auto mb-1" />
                  <p className="text-[10px] font-bold text-slate-300 truncate">Privacy mode</p>
                  <p className="text-[8px] text-slate-500">(Typing password)</p>
                </div>

                {/* State 4 */}
                <div
                  onClick={() => setMascotState('success')}
                  className={`cursor-pointer p-2 rounded-xl border transition-all ${
                    mascotState === 'success'
                      ? 'border-[#ea6d2a] bg-[#ea6d2a]/10'
                      : 'border-slate-800/60 bg-slate-900/30 hover:border-slate-700'
                  }`}
                >
                  <img src="/mascot/success.jpg" alt="Success" className="w-10 h-10 object-cover rounded-lg mx-auto mb-1" />
                  <p className="text-[10px] font-bold text-slate-300 truncate">Access Granted!</p>
                  <p className="text-[8px] text-slate-500">(Login Success)</p>
                </div>

              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;
