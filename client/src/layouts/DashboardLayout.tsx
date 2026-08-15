import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../services/api';
import { useDialog } from '../context/DialogContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  CheckSquare,
  BadgeCent,
  UserCircle,
  LogOut,
  Bell,
  Sun,
  Moon,
  Menu,
  X,
  CreditCard,
  Search,
  Activity,
  FileCheck,
} from 'lucide-react';

interface NotificationToast {
  id: string;
  title: string;
  message: string;
}

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { confirm } = useDialog();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationToast[]>([]);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);

  // Socket Connection for Realtime Notifications
  useEffect(() => {
    if (!user) return;
    
    const socket: Socket = io(SOCKET_URL);
    
    socket.on('connect', () => {
      socket.emit('register', user.employeeId);
    });

    socket.on('notification', (data: { title: string; message: string }) => {
      const newToast: NotificationToast = {
        id: Math.random().toString(),
        title: data.title,
        message: data.message,
      };
      
      setNotifications((prev) => [newToast, ...prev]);

      // Remove after 6 seconds
      setTimeout(() => {
        setNotifications((prev) => prev.filter((t) => t.id !== newToast.id));
      }, 6000);
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  if (!user) return null;

  // Sidebar Links based on User Role
  const links = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      roles: ['SUPER_ADMIN', 'HR', 'TEAM_LEAD', 'EMPLOYEE'],
    },
    {
      name: 'Employees',
      path: '/employees',
      icon: Users,
      roles: ['SUPER_ADMIN', 'HR', 'TEAM_LEAD'],
    },
    {
      name: 'Attendance',
      path: '/attendance',
      icon: CalendarDays,
      roles: ['SUPER_ADMIN', 'HR', 'TEAM_LEAD', 'EMPLOYEE'],
    },
    {
      name: 'Leaves',
      path: '/leaves',
      icon: FileCheck,
      roles: ['SUPER_ADMIN', 'HR', 'TEAM_LEAD', 'EMPLOYEE'],
    },
    {
      name: 'Tasks',
      path: '/tasks',
      icon: CheckSquare,
      roles: ['SUPER_ADMIN', 'HR', 'TEAM_LEAD', 'EMPLOYEE'],
    },
    {
      name: 'Payroll',
      path: '/payroll',
      icon: BadgeCent,
      roles: ['SUPER_ADMIN', 'HR', 'EMPLOYEE'],
    },
    {
      name: 'Profile',
      path: '/profile',
      icon: UserCircle,
      roles: ['SUPER_ADMIN', 'HR', 'TEAM_LEAD', 'EMPLOYEE'],
    },
  ];

  const filteredLinks = links.filter((l) => l.roles.includes(user.role));

  const handleLogout = async () => {
    if (await confirm({ title: 'Sign Out', message: 'Are you sure you want to sign out of your session?', variant: 'warning', confirmText: 'Sign Out' })) {
      await logout();
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden bg-brand-50 dark:bg-brand-950 relative">
      
      {/* Visual layout background decorations */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-orange-500/5 blur-3xl pointer-events-none" />

      {/* --- Sidebar (Mobile Drawer & Desktop Fixed) --- */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 glass flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Header Branding */}
        <div className="p-6 flex items-center justify-between border-b border-brand-200 dark:border-brand-900">
          <Link to="/dashboard" className="flex items-center space-x-3.5">
            <img src="/image.png" className="w-12 h-12 object-contain animate-pulse" alt="OneBridge Logo" />
            <div>
              <h1 className="font-extrabold text-lg tracking-tight leading-none">
                <span className="text-orange-500">ONE</span>
                <span className="text-slate-900 dark:text-white">BRIDGE</span>
              </h1>
              <p className="text-[10px] text-brand-500 font-bold tracking-wider uppercase mt-1.5">HR PORTAL</p>
            </div>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-brand-600 dark:text-brand-400">
            <X size={20} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {filteredLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setSidebarOpen(false)}
                className={`group relative flex items-center space-x-3.5 px-5 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                  isActive
                    ? 'text-white shadow-md'
                    : 'text-brand-600 dark:text-brand-400 hover:text-indigo-600 dark:hover:text-orange-400 hover:bg-brand-100 dark:hover:bg-brand-900/40 hover:translate-x-1'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeSidebarLink"
                    className="absolute inset-0 bg-gradient-to-r from-orange-500 to-indigo-600 rounded-xl -z-10 shadow-lg shadow-indigo-600/20"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon size={18} className="relative z-10" />
                <span className="relative z-10">{link.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Log Out */}
        <div className="p-4 border-t border-brand-200 dark:border-brand-900">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLogout}
            className="group w-full flex items-center space-x-3.5 px-5 py-3.5 rounded-xl text-sm font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer"
          >
            <LogOut size={18} className="group-hover:rotate-12 transition-transform" />
            <span>Sign Out</span>
          </motion.button>
        </div>
      </aside>

      {/* --- Main Dashboard Container --- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto h-screen relative">
        
        {/* Top Header */}
        <header className="glass sticky top-0 z-30 px-4 md:px-6 py-4 flex items-center justify-between border-b border-brand-200 dark:border-brand-900">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-400"
            >
              <Menu size={20} />
            </button>
            <div className="hidden md:flex items-center space-x-2 text-xs font-semibold text-brand-500 dark:text-brand-400">
              <span>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <span className="text-brand-300 dark:text-brand-800">•</span>
              <span className="text-[10px] bg-brand-100 dark:bg-brand-900 px-2 py-0.5 rounded font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 border border-brand-200/50 dark:border-brand-800/50">OBI Node</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Theme Toggle */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-brand-100 dark:bg-brand-900 hover:bg-brand-200 dark:hover:bg-brand-800 transition-all text-brand-600 dark:text-brand-400 cursor-pointer"
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </motion.button>

            {/* Notification Bell */}
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowNotificationPanel(!showNotificationPanel)}
                className="p-2.5 rounded-xl bg-brand-100 dark:bg-brand-900 hover:bg-brand-200 dark:hover:bg-brand-800 transition-all text-brand-600 dark:text-brand-400 cursor-pointer"
              >
                <Bell size={18} />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                )}
              </motion.button>

              {/* In-app Notification Dropdown */}
              <AnimatePresence>
                {showNotificationPanel && (
                  <motion.div 
                    initial={{ opacity: 0, y: 15, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute right-0 mt-3 w-80 glass rounded-2xl shadow-xl border border-brand-200 dark:border-brand-900 py-3 z-50"
                  >
                    <div className="px-4 pb-2 border-b border-brand-200 dark:border-brand-900 flex justify-between items-center">
                      <h3 className="font-bold text-sm">Notifications</h3>
                      {notifications.length > 0 && (
                        <button onClick={() => setNotifications([])} className="text-[10px] text-indigo-600 font-bold hover:underline">
                          Clear all
                        </button>
                      )}
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="text-center py-6 text-xs text-brand-500">No new alerts</p>
                      ) : (
                        notifications.map((n) => (
                          <div key={n.id} className="p-3.5 border-b last:border-b-0 border-brand-100 dark:border-brand-900 hover:bg-brand-100 dark:hover:bg-brand-900 transition-all">
                            <p className="font-bold text-xs">{n.title}</p>
                            <p className="text-[11px] text-brand-600 dark:text-brand-400 mt-0.5">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile Brief */}
            <div className="flex items-center space-x-3 pl-2 border-l border-brand-200 dark:border-brand-900">
              <div className="w-9 h-9 rounded-xl bg-brand-200 dark:bg-brand-900 overflow-hidden flex items-center justify-center border border-indigo-600">
                {user.profileImageUrl ? (
                  <img src={user.profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-xs text-indigo-600 uppercase">{user.firstName[0]}{user.lastName[0]}</span>
                )}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-bold text-brand-950 dark:text-white leading-none">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-[10px] text-indigo-600 font-semibold tracking-wider mt-0.5 uppercase leading-none">
                  {user.role.replace('_', ' ')}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-4 md:p-8 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* --- Floating Realtime Toast Drawer (Bottom Right) --- */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col space-y-3 pointer-events-none">
        <AnimatePresence>
          {notifications.slice(0, 3).map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="w-80 bg-brand-900/95 text-white dark:bg-white dark:text-brand-950 pointer-events-auto rounded-2xl p-4 shadow-2xl flex items-start space-x-3 border border-indigo-600"
            >
              <Activity className="text-indigo-500 shrink-0 mt-0.5 animate-pulse" size={18} />
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-xs tracking-tight">{n.title}</h4>
                <p className="text-[11px] text-brand-300 dark:text-brand-600 mt-1 leading-relaxed">
                  {n.message}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default DashboardLayout;
