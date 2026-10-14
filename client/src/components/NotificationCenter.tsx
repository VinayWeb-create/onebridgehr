import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  CheckCheck,
  Trash2,
  Settings,
  Calendar,
  Clock,
  MessageSquare,
  FileText,
  CheckCircle2,
  X,
  ExternalLink,
  Shield,
  Megaphone,
  Briefcase,
  AlertTriangle,
  RotateCcw,
  Save,
  Check,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { sendTestPushNotification, subscribeToPushNotifications } from '../registerServiceWorker';

export interface NotificationItem {
  id: string;
  employeeId: string;
  title: string;
  message: string;
  type?: string;
  category?: 'ATTENDANCE' | 'MEETINGS' | 'CHAT' | 'FILES' | 'HR_UPDATES' | 'ANNOUNCEMENTS' | 'GENERAL';
  status?: string;
  actionUrl?: string;
  deliveredAt?: string;
  readAt?: string;
  isRead: boolean;
  createdAt: string;
}

export interface UserPreferences {
  attendance: boolean;
  meetings: boolean;
  chat: boolean;
  files: boolean;
  hrUpdates: boolean;
  announcements: boolean;
}

export interface AdminConfig {
  shiftStartBeforeMinutes: number;
  shiftStartAfterMinutes: number;
  lunchTime: string;
  lunchDurationMinutes: number;
  lunchReminderBeforeEnd: number;
  checkoutBeforeMinutes: number;
  checkoutAfterMinutes: number;
  meetingReminders: number[];
  announcementPriority: string;
  templates: Record<string, string>;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
  onUnreadChange?: (count: number) => void;
}

const CATEGORIES = [
  { key: 'ALL', label: 'All' },
  { key: 'ATTENDANCE', label: 'Attendance', icon: Clock },
  { key: 'MEETINGS', label: 'Meetings', icon: Calendar },
  { key: 'CHAT', label: 'Chat', icon: MessageSquare },
  { key: 'FILES', label: 'Files', icon: FileText },
  { key: 'HR_UPDATES', label: 'HR Updates', icon: Briefcase },
  { key: 'ANNOUNCEMENTS', label: 'Announcements', icon: Megaphone },
];

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  userRole,
  onUnreadChange,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'notifications' | 'userSettings' | 'adminSettings'>('notifications');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);

  // User Settings state
  const [preferences, setPreferences] = useState<UserPreferences>({
    attendance: true,
    meetings: true,
    chat: true,
    files: true,
    hrUpdates: true,
    announcements: true,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsSavedMessage, setPrefsSavedMessage] = useState<string | null>(null);

  // Admin Settings state
  const [adminConfig, setAdminConfig] = useState<AdminConfig | null>(null);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [adminSavedMessage, setAdminSavedMessage] = useState<string | null>(null);

  // Device push status
  const [devicePushStatus, setDevicePushStatus] = useState<string>('default');
  const [testingPush, setTestingPush] = useState(false);
  const [pushStatusMessage, setPushStatusMessage] = useState<string | null>(null);

  const isAdminOrHr = userRole === 'SUPER_ADMIN' || userRole === 'HR';

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: 40 };
      if (selectedCategory !== 'ALL') params.category = selectedCategory;
      if (unreadOnly) params.unreadOnly = 'true';

      const res = await api.get('/notifications', { params });
      if (res.data?.data) {
        setNotifications(res.data.data.notifications || []);
        const count = res.data.data.unreadCount ?? 0;
        setUnreadCount(count);
        onUnreadChange?.(count);
      }
    } catch (err) {
      console.warn('[NotificationCenter] Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, unreadOnly, onUnreadChange]);

  // Fetch user preferences
  const fetchPreferences = useCallback(async () => {
    try {
      const res = await api.get('/notifications/preferences');
      if (res.data?.data) {
        setPreferences({
          attendance: res.data.data.attendance ?? true,
          meetings: res.data.data.meetings ?? true,
          chat: res.data.data.chat ?? true,
          files: res.data.data.files ?? true,
          hrUpdates: res.data.data.hrUpdates ?? true,
          announcements: res.data.data.announcements ?? true,
        });
      }
    } catch (err) {
      console.warn('[NotificationCenter] Error fetching preferences:', err);
    }
  }, []);

  // Fetch admin configs
  const fetchAdminConfig = useCallback(async () => {
    if (!isAdminOrHr) return;
    try {
      const res = await api.get('/notifications/admin/config');
      if (res.data?.data) {
        setAdminConfig(res.data.data);
      }
    } catch (err) {
      console.warn('[NotificationCenter] Error fetching admin config:', err);
    }
  }, [isAdminOrHr]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
      fetchPreferences();
      if (isAdminOrHr) fetchAdminConfig();
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setDevicePushStatus(Notification.permission);
      }
    }
  }, [isOpen, fetchNotifications, fetchPreferences, fetchAdminConfig, isAdminOrHr]);

  // Mark single notification as read
  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, status: 'READ' } : n))
      );
      setUnreadCount((prev) => {
        const next = Math.max(0, prev - 1);
        onUnreadChange?.(next);
        return next;
      });
    } catch (err) {
      console.warn('Failed to mark read', err);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, status: 'READ' })));
      setUnreadCount(0);
      onUnreadChange?.(0);
    } catch (err) {
      console.warn('Failed to mark all read', err);
    }
  };

  // Delete notification
  const handleDeleteNotification = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => {
        const item = prev.find((n) => n.id === id);
        if (item && !item.isRead) {
          setUnreadCount((c) => {
            const next = Math.max(0, c - 1);
            onUnreadChange?.(next);
            return next;
          });
        }
        return prev.filter((n) => n.id !== id);
      });
    } catch (err) {
      console.warn('Failed to delete notification', err);
    }
  };

  // Click notification to navigate
  const handleNotificationClick = (item: NotificationItem) => {
    if (!item.isRead) {
      handleMarkAsRead(item.id);
    }
    if (item.actionUrl) {
      onClose();
      if (item.actionUrl.startsWith('http')) {
        window.open(item.actionUrl, '_blank');
      } else {
        navigate(item.actionUrl);
      }
    }
  };

  // Save User Preferences
  const handleSavePreferences = async (updated: Partial<UserPreferences>) => {
    const nextPrefs = { ...preferences, ...updated };
    setPreferences(nextPrefs);
    setSavingPrefs(true);
    setPrefsSavedMessage(null);
    try {
      await api.put('/notifications/preferences', nextPrefs);
      setPrefsSavedMessage('Preferences saved!');
      setTimeout(() => setPrefsSavedMessage(null), 3000);
    } catch {
      setPrefsSavedMessage('Failed to save preferences.');
    } finally {
      setSavingPrefs(false);
    }
  };

  // Save Admin Configuration
  const handleSaveAdminConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminConfig) return;
    setSavingAdmin(true);
    setAdminSavedMessage(null);
    try {
      const res = await api.put('/notifications/admin/config', adminConfig);
      if (res.data?.data) {
        setAdminConfig(res.data.data);
      }
      setAdminSavedMessage('Admin settings updated successfully!');
      setTimeout(() => setAdminSavedMessage(null), 3000);
    } catch {
      setAdminSavedMessage('Failed to update admin settings.');
    } finally {
      setSavingAdmin(false);
    }
  };

  // Push Permission Handler
  const handleEnablePush = async () => {
    setPushStatusMessage(null);
    try {
      const ok = await subscribeToPushNotifications();
      const current = typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
      setDevicePushStatus(current);
      if (ok || current === 'granted') {
        setPushStatusMessage('Push notifications enabled for this device!');
        sendTestPushNotification().catch(() => {});
      } else if (current === 'denied') {
        setPushStatusMessage('Notifications are blocked in your browser settings.');
      }
    } catch {
      setPushStatusMessage('Could not enable notifications.');
    }
  };

  // Test Push
  const handleTestPush = async () => {
    setTestingPush(true);
    setPushStatusMessage(null);
    try {
      const res = await sendTestPushNotification();
      setPushStatusMessage(res.message || 'Test notification sent!');
    } catch {
      setPushStatusMessage('Failed to send test push.');
    } finally {
      setTestingPush(false);
      setTimeout(() => setPushStatusMessage(null), 4000);
    }
  };

  const getCategoryBadge = (cat?: string) => {
    switch (cat) {
      case 'ATTENDANCE':
        return { label: 'Attendance', bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
      case 'MEETINGS':
        return { label: 'Meeting', bg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' };
      case 'CHAT':
        return { label: 'Chat', bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' };
      case 'FILES':
        return { label: 'File', bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
      case 'HR_UPDATES':
        return { label: 'HR Update', bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' };
      case 'ANNOUNCEMENTS':
        return { label: 'Announcement', bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' };
      default:
        return { label: 'Alert', bg: 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20' };
    }
  };

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-end sm:p-4 p-0 pointer-events-none">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs pointer-events-auto"
          />

          {/* Drawer / Modal Container */}
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.98 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="pointer-events-auto relative w-full sm:w-[480px] h-full sm:h-[88vh] sm:max-h-[750px] bg-white dark:bg-slate-900 border-0 sm:border border-brand-200 dark:border-brand-800 sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden z-10"
          >
            {/* Header */}
            <div className="p-4 border-b border-brand-100 dark:border-brand-900 flex items-center justify-between bg-brand-50/50 dark:bg-brand-950/40">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
                  <Bell size={18} />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="font-bold text-sm text-brand-950 dark:text-white">Notification Center</h2>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-extrabold animate-pulse">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-brand-500">Attendance, Meetings, HR Updates & Alerts</p>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-800 text-brand-500 hover:text-brand-900 dark:hover:text-white transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-brand-100 dark:border-brand-900 bg-brand-50/20 dark:bg-brand-950/20 px-3 pt-2 gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('notifications')}
                className={`pb-2.5 px-3 border-b-2 flex items-center space-x-1.5 transition-all cursor-pointer ${
                  activeTab === 'notifications'
                    ? 'border-orange-500 text-orange-600 dark:text-orange-400 font-bold'
                    : 'border-transparent text-brand-500 hover:text-brand-800 dark:hover:text-brand-300'
                }`}
              >
                <Bell size={14} />
                <span>Inbox</span>
                {unreadCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('userSettings')}
                className={`pb-2.5 px-3 border-b-2 flex items-center space-x-1.5 transition-all cursor-pointer ${
                  activeTab === 'userSettings'
                    ? 'border-orange-500 text-orange-600 dark:text-orange-400 font-bold'
                    : 'border-transparent text-brand-500 hover:text-brand-800 dark:hover:text-brand-300'
                }`}
              >
                <Settings size={14} />
                <span>My Settings</span>
              </button>

              {isAdminOrHr && (
                <button
                  type="button"
                  onClick={() => setActiveTab('adminSettings')}
                  className={`pb-2.5 px-3 border-b-2 flex items-center space-x-1.5 transition-all cursor-pointer ${
                    activeTab === 'adminSettings'
                      ? 'border-orange-500 text-orange-600 dark:text-orange-400 font-bold'
                      : 'border-transparent text-brand-500 hover:text-brand-800 dark:hover:text-brand-300'
                  }`}
                >
                  <Shield size={14} />
                  <span>Admin Rules</span>
                </button>
              )}
            </div>

            {/* TAB 1: NOTIFICATIONS INBOX */}
            {activeTab === 'notifications' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Category Pills & Filters Bar */}
                <div className="p-3 border-b border-brand-100 dark:border-brand-900 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] text-brand-500 font-medium">Filter Category:</span>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setUnreadOnly(!unreadOnly)}
                        className={`text-[11px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer font-medium ${
                          unreadOnly
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'border-brand-200 dark:border-brand-800 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900'
                        }`}
                      >
                        {unreadOnly ? 'Showing Unread' : 'Show Unread Only'}
                      </button>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className="text-[11px] font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center space-x-1 cursor-pointer"
                        >
                          <CheckCheck size={12} />
                          <span>Mark all read</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Horizontal Scroll Categories */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = selectedCategory === cat.key;
                      return (
                        <button
                          key={cat.key}
                          type="button"
                          onClick={() => setSelectedCategory(cat.key)}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap flex items-center space-x-1 transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                              : 'bg-brand-50 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300 border-brand-200/60 dark:border-brand-800 hover:bg-brand-100 dark:hover:bg-brand-800'
                          }`}
                        >
                          {Icon && <Icon size={11} />}
                          <span>{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Notifications List */}
                <div className="flex-1 overflow-y-auto divide-y divide-brand-100 dark:divide-brand-900/70">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 space-y-2 text-brand-400">
                      <span className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs">Loading notifications...</p>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center text-brand-400">
                      <div className="p-3.5 rounded-2xl bg-brand-100 dark:bg-brand-800/40 text-brand-400 mb-2">
                        <CheckCircle2 size={28} />
                      </div>
                      <p className="font-bold text-xs text-brand-800 dark:text-brand-200">All caught up!</p>
                      <p className="text-[11px] text-brand-500 mt-1 max-w-xs">
                        {unreadOnly
                          ? 'No unread notifications in this category.'
                          : 'You have no notifications in this view right now.'}
                      </p>
                    </div>
                  ) : (
                    notifications.map((item) => {
                      const badge = getCategoryBadge(item.category);
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleNotificationClick(item)}
                          className={`p-3.5 transition-all cursor-pointer group flex items-start gap-3 ${
                            item.isRead
                              ? 'hover:bg-brand-50/60 dark:hover:bg-brand-950/40 opacity-80 hover:opacity-100'
                              : 'bg-orange-50/40 dark:bg-orange-950/20 hover:bg-orange-50/70 dark:hover:bg-orange-950/30'
                          }`}
                        >
                          {/* Unread dot or icon */}
                          <div className="pt-1 shrink-0">
                            {!item.isRead ? (
                              <span className="block w-2 h-2 rounded-full bg-orange-500 ring-4 ring-orange-500/20" />
                            ) : (
                              <span className="block w-2 h-2 rounded-full bg-brand-300 dark:bg-brand-700" />
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span
                                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md border ${badge.bg}`}
                              >
                                {badge.label}
                              </span>
                              <span className="text-[10px] text-brand-400 whitespace-nowrap">
                                {formatTimestamp(item.createdAt)}
                              </span>
                            </div>

                            <p
                              className={`text-xs ${
                                item.isRead
                                  ? 'font-medium text-brand-900 dark:text-brand-100'
                                  : 'font-bold text-brand-950 dark:text-white'
                              } leading-snug`}
                            >
                              {item.title}
                            </p>

                            <p className="text-[11px] text-brand-600 dark:text-brand-300 mt-0.5 leading-relaxed line-clamp-2">
                              {item.message}
                            </p>

                            {/* Direct Action Link if present */}
                            {item.actionUrl && (
                              <div className="mt-2 flex items-center space-x-1 text-[11px] text-orange-600 dark:text-orange-400 font-bold group-hover:underline">
                                <span>Take action</span>
                                <ExternalLink size={10} />
                              </div>
                            )}
                          </div>

                          {/* Hover action buttons */}
                          <div className="flex items-center space-x-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!item.isRead && (
                              <button
                                type="button"
                                title="Mark as read"
                                onClick={(e) => handleMarkAsRead(item.id, e)}
                                className="p-1 rounded-lg hover:bg-brand-200 dark:hover:bg-brand-800 text-brand-500 hover:text-emerald-600 transition-colors cursor-pointer"
                              >
                                <Check size={13} />
                              </button>
                            )}
                            <button
                              type="button"
                              title="Delete notification"
                              onClick={(e) => handleDeleteNotification(item.id, e)}
                              className="p-1 rounded-lg hover:bg-brand-200 dark:hover:bg-brand-800 text-brand-500 hover:text-rose-600 transition-colors cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer status bar */}
                <div className="p-2.5 border-t border-brand-100 dark:border-brand-900 bg-brand-50/50 dark:bg-brand-950/40 flex items-center justify-between text-[11px] text-brand-500 px-4">
                  <span>{notifications.length} notifications</span>
                  <button
                    type="button"
                    onClick={fetchNotifications}
                    className="flex items-center space-x-1 text-brand-600 dark:text-brand-300 hover:text-orange-600 cursor-pointer font-medium"
                  >
                    <RotateCcw size={11} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: USER PREFERENCES */}
            {activeTab === 'userSettings' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <h3 className="font-bold text-xs text-brand-950 dark:text-white uppercase tracking-wider">
                    My Notification Preferences
                  </h3>
                  <p className="text-[11px] text-brand-500 mt-0.5">
                    Customize which automated alerts and reminders you receive.
                  </p>
                </div>

                {/* Toggles */}
                <div className="space-y-2.5 bg-brand-50/60 dark:bg-brand-950/40 p-3 rounded-2xl border border-brand-200/60 dark:border-brand-800">
                  {[
                    {
                      key: 'attendance',
                      label: 'Attendance & Shift Reminders',
                      desc: 'Shift start, missed check-in, lunch time & checkout alerts.',
                      icon: Clock,
                    },
                    {
                      key: 'meetings',
                      label: 'Meeting Alerts',
                      desc: '15m & 5m before meeting, starts, schedules and updates.',
                      icon: Calendar,
                    },
                    {
                      key: 'chat',
                      label: 'Chat & Huddles',
                      desc: 'Direct messages, mentions, replies and live team huddles.',
                      icon: MessageSquare,
                    },
                    {
                      key: 'files',
                      label: 'File & Document Sharing',
                      desc: 'Alerts when company files or HR letters are shared.',
                      icon: FileText,
                    },
                    {
                      key: 'hrUpdates',
                      label: 'HR & Payroll Updates',
                      desc: 'Leave approvals, salary slips and upcoming holidays.',
                      icon: Briefcase,
                    },
                    {
                      key: 'announcements',
                      label: 'Company Announcements',
                      desc: 'Broadcasts from management & executive team.',
                      icon: Megaphone,
                    },
                  ].map((setting) => {
                    const Icon = setting.icon;
                    const isChecked = (preferences as any)[setting.key] !== false;
                    return (
                      <div
                        key={setting.key}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-brand-100 dark:border-brand-800"
                      >
                        <div className="flex items-start space-x-2.5">
                          <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 mt-0.5">
                            <Icon size={14} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-brand-900 dark:text-brand-100">
                              {setting.label}
                            </p>
                            <p className="text-[10px] text-brand-500 leading-tight mt-0.5">
                              {setting.desc}
                            </p>
                          </div>
                        </div>

                        <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) =>
                              handleSavePreferences({ [setting.key]: e.target.checked })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-brand-200 dark:bg-brand-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500" />
                        </label>
                      </div>
                    );
                  })}
                </div>

                {prefsSavedMessage && (
                  <p className="text-xs text-center text-emerald-600 dark:text-emerald-400 font-bold">
                    {prefsSavedMessage}
                  </p>
                )}

                {/* Device Push Notification Section */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-orange-500/10 to-indigo-500/10 border border-orange-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-950 dark:text-white flex items-center gap-1.5">
                      <Bell size={13} className="text-orange-600" />
                      <span>Device Push Notifications</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        devicePushStatus === 'granted'
                          ? 'bg-emerald-500/20 text-emerald-600'
                          : 'bg-amber-500/20 text-amber-600'
                      }`}
                    >
                      {devicePushStatus.toUpperCase()}
                    </span>
                  </div>

                  <p className="text-[11px] text-brand-600 dark:text-brand-300 leading-relaxed">
                    Receive shift reminders and HR alerts even when the browser is closed or your phone screen is locked.
                  </p>

                  <div className="pt-1 flex gap-2">
                    {devicePushStatus === 'granted' ? (
                      <button
                        type="button"
                        onClick={handleTestPush}
                        disabled={testingPush}
                        className="flex-1 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                      >
                        {testingPush ? 'Sending Test...' : 'Send Test Push Alert'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleEnablePush}
                        className="flex-1 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-indigo-600 hover:opacity-95 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                      >
                        Enable Push On This Device
                      </button>
                    )}
                  </div>

                  {pushStatusMessage && (
                    <p className="text-[10px] text-center text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                      {pushStatusMessage}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: ADMIN SETTINGS & TEMPLATES */}
            {activeTab === 'adminSettings' && isAdminOrHr && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <h3 className="font-bold text-xs text-brand-950 dark:text-white uppercase tracking-wider">
                    Company-Wide Reminder Engine Rules
                  </h3>
                  <p className="text-[11px] text-brand-500 mt-0.5">
                    Configure automated reminder intervals, lunch timings and notification templates.
                  </p>
                </div>

                {adminConfig ? (
                  <form onSubmit={handleSaveAdminConfig} className="space-y-4">
                    {/* Attendance Timers */}
                    <div className="p-3 rounded-2xl bg-brand-50/60 dark:bg-brand-950/40 border border-brand-200/60 dark:border-brand-800 space-y-3">
                      <p className="text-xs font-bold text-brand-900 dark:text-brand-100 flex items-center gap-1.5">
                        <Clock size={13} className="text-orange-500" />
                        <span>Shift Attendance Reminders</span>
                      </p>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-brand-500 font-bold block mb-1">
                            Shift Start Notice (Mins Before)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="60"
                            value={adminConfig.shiftStartBeforeMinutes}
                            onChange={(e) =>
                              setAdminConfig({
                                ...adminConfig,
                                shiftStartBeforeMinutes: parseInt(e.target.value, 10) || 10,
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-brand-200 dark:border-brand-800 focus:outline-hidden focus:border-orange-500 font-semibold"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-brand-500 font-bold block mb-1">
                            Missed Check-In Alert (Mins After)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="60"
                            value={adminConfig.shiftStartAfterMinutes}
                            onChange={(e) =>
                              setAdminConfig({
                                ...adminConfig,
                                shiftStartAfterMinutes: parseInt(e.target.value, 10) || 5,
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-brand-200 dark:border-brand-800 focus:outline-hidden focus:border-orange-500 font-semibold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="text-[10px] text-brand-500 font-bold block mb-1">
                            Checkout Notice (Mins Before)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="60"
                            value={adminConfig.checkoutBeforeMinutes}
                            onChange={(e) =>
                              setAdminConfig({
                                ...adminConfig,
                                checkoutBeforeMinutes: parseInt(e.target.value, 10) || 15,
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-brand-200 dark:border-brand-800 focus:outline-hidden focus:border-orange-500 font-semibold"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-brand-500 font-bold block mb-1">
                            Missed Checkout Alert (Mins After)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="60"
                            value={adminConfig.checkoutAfterMinutes}
                            onChange={(e) =>
                              setAdminConfig({
                                ...adminConfig,
                                checkoutAfterMinutes: parseInt(e.target.value, 10) || 5,
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-brand-200 dark:border-brand-800 focus:outline-hidden focus:border-orange-500 font-semibold"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Lunch Break Timers */}
                    <div className="p-3 rounded-2xl bg-brand-50/60 dark:bg-brand-950/40 border border-brand-200/60 dark:border-brand-800 space-y-3">
                      <p className="text-xs font-bold text-brand-900 dark:text-brand-100 flex items-center gap-1.5">
                        <Briefcase size={13} className="text-orange-500" />
                        <span>Lunch Break Timings</span>
                      </p>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-brand-500 font-bold block mb-1">
                            Lunch Time
                          </label>
                          <input
                            type="text"
                            placeholder="13:00"
                            value={adminConfig.lunchTime}
                            onChange={(e) =>
                              setAdminConfig({ ...adminConfig, lunchTime: e.target.value })
                            }
                            className="w-full px-2.5 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-brand-200 dark:border-brand-800 focus:outline-hidden focus:border-orange-500 font-semibold"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-brand-500 font-bold block mb-1">
                            Duration (Mins)
                          </label>
                          <input
                            type="number"
                            min="15"
                            max="120"
                            value={adminConfig.lunchDurationMinutes}
                            onChange={(e) =>
                              setAdminConfig({
                                ...adminConfig,
                                lunchDurationMinutes: parseInt(e.target.value, 10) || 60,
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-brand-200 dark:border-brand-800 focus:outline-hidden focus:border-orange-500 font-semibold"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-brand-500 font-bold block mb-1">
                            End Warning (Mins)
                          </label>
                          <input
                            type="number"
                            min="5"
                            max="30"
                            value={adminConfig.lunchReminderBeforeEnd}
                            onChange={(e) =>
                              setAdminConfig({
                                ...adminConfig,
                                lunchReminderBeforeEnd: parseInt(e.target.value, 10) || 15,
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-brand-200 dark:border-brand-800 focus:outline-hidden focus:border-orange-500 font-semibold"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Announcement Priority Default */}
                    <div className="p-3 rounded-2xl bg-brand-50/60 dark:bg-brand-950/40 border border-brand-200/60 dark:border-brand-800 space-y-2">
                      <p className="text-xs font-bold text-brand-900 dark:text-brand-100 flex items-center gap-1.5">
                        <Megaphone size={13} className="text-orange-500" />
                        <span>Announcement Default Priority</span>
                      </p>
                      <select
                        value={adminConfig.announcementPriority}
                        onChange={(e) =>
                          setAdminConfig({ ...adminConfig, announcementPriority: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-brand-200 dark:border-brand-800 font-semibold"
                      >
                        <option value="LOW">LOW</option>
                        <option value="MEDIUM">MEDIUM (Standard)</option>
                        <option value="HIGH">HIGH (Important)</option>
                        <option value="URGENT">URGENT (Top Priority)</option>
                      </select>
                    </div>

                    {/* Notification Copy Templates */}
                    <div className="p-3 rounded-2xl bg-brand-50/60 dark:bg-brand-950/40 border border-brand-200/60 dark:border-brand-800 space-y-2.5">
                      <p className="text-xs font-bold text-brand-900 dark:text-brand-100 flex items-center gap-1.5">
                        <FileText size={13} className="text-orange-500" />
                        <span>Customizable Notification Templates</span>
                      </p>

                      {[
                        { key: 'shiftStart', label: 'Shift Start Copy' },
                        { key: 'missedCheckIn', label: 'Missed Check-In Copy' },
                        { key: 'lunchStart', label: 'Lunch Start Copy' },
                        { key: 'lunchEndWarning', label: 'Lunch Ending Soon Copy' },
                        { key: 'checkoutWarning', label: 'Checkout Notice Copy' },
                        { key: 'missedCheckout', label: 'Missed Checkout Copy' },
                      ].map((t) => (
                        <div key={t.key}>
                          <label className="text-[10px] text-brand-500 font-bold block mb-0.5">
                            {t.label}
                          </label>
                          <input
                            type="text"
                            value={adminConfig.templates[t.key] || ''}
                            onChange={(e) =>
                              setAdminConfig({
                                ...adminConfig,
                                templates: { ...adminConfig.templates, [t.key]: e.target.value },
                              })
                            }
                            className="w-full px-2.5 py-1 rounded-lg text-[11px] bg-white dark:bg-slate-900 border border-brand-200 dark:border-brand-800 font-medium"
                          />
                        </div>
                      ))}
                    </div>

                    {adminSavedMessage && (
                      <p className="text-xs text-center text-emerald-600 dark:text-emerald-400 font-bold">
                        {adminSavedMessage}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={savingAdmin}
                      className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <Save size={13} />
                      <span>{savingAdmin ? 'Saving Settings...' : 'Save Engine Rules'}</span>
                    </button>
                  </form>
                ) : (
                  <div className="py-10 text-center text-brand-400 text-xs">
                    Loading admin configuration...
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default NotificationCenter;
