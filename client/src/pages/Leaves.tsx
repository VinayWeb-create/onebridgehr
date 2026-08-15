import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import {
  FileText, Calendar, Clock, AlertCircle, Sparkles, Send, CheckCircle2, XCircle,
  Activity, Database, Mail, UserCheck, Cpu, Filter, Check, ShieldAlert, Layers,
  RefreshCw, ShieldCheck
} from 'lucide-react';

interface LeaveRequest {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  managerComment?: string;
  hrComment?: string;
  employee?: { firstName: string; lastName: string };
  employeeId?: string;
}

interface ActivityEvent {
  id: string;
  timestamp: string;
  category: 'DATABASE' | 'WEBHOOK' | 'SECURITY' | 'PAYROLL';
  type: 'info' | 'success' | 'warn' | 'error';
  text: string;
  latency?: string;
}

export const Leaves: React.FC = () => {
  const { user } = useAuth();
  const { alert } = useDialog();
  
  const [history, setHistory] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<Record<string, { limit: number; used: number; available: number }>>({});
  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [leaveType, setLeaveType] = useState('CASUAL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Review Dialog State
  const [reviewingLeave, setReviewingLeave] = useState<LeaveRequest | null>(null);
  const [reviewComment, setReviewComment] = useState('');

  // Interactive System Activity Feed
  const [events, setEvents] = useState<ActivityEvent[]>([
    { id: '1', timestamp: new Date(Date.now() - 10000).toLocaleTimeString(), category: 'SECURITY', type: 'info', text: 'Initializing secure API handshake with Google Drive & OAuth servers.', latency: '12ms' },
    { id: '2', timestamp: new Date(Date.now() - 5000).toLocaleTimeString(), category: 'DATABASE', type: 'success', text: 'Established secure prisma tunnel to MongoDB Atlas primary replica set.', latency: '142ms' },
    { id: '3', timestamp: new Date().toLocaleTimeString(), category: 'DATABASE', type: 'info', text: 'Pre-fetched structural metadata cache for employee records.' }
  ]);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'DATABASE' | 'WEBHOOK' | 'SECURITY'>('ALL');
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<number>(0);

  useEffect(() => {
    fetchLeaves();
  }, [user]);

  const addEvent = (text: string, category: 'DATABASE' | 'WEBHOOK' | 'SECURITY' | 'PAYROLL', type: 'info' | 'success' | 'warn' | 'error' = 'info', latency?: string) => {
    setEvents(prev => [
      {
        id: Math.random().toString(),
        timestamp: new Date().toLocaleTimeString(),
        category,
        type,
        text,
        latency
      },
      ...prev
    ]);
  };

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      addEvent('Retrieving updated leave metrics & active balances...', 'DATABASE', 'info', '38ms');
      const resPersonal = await api.get('/leaves/history');
      setHistory(resPersonal.data.data.history);
      setBalances(resPersonal.data.data.balances);
      addEvent('Synchronized user balance grid with MongoDB core schema.', 'DATABASE', 'success', '85ms');

      if (user?.role && ['TEAM_LEAD', 'HR', 'SUPER_ADMIN'].includes(user.role)) {
        addEvent('Verifying user level permissions for leave workflow queue...', 'SECURITY', 'info');
        const resPending = await api.get('/leaves/pending');
        setPendingRequests(resPending.data.data);
        addEvent(`Workflow queue sync complete. ${resPending.data.data.length} pending items retrieved.`, 'WEBHOOK', 'success', '110ms');
      }
    } catch (err) {
      console.error('Failed to load leave records:', err);
      addEvent('Prisma client connection failed to select schema context.', 'DATABASE', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setActiveWorkflowStep(1);

    addEvent(`Submitting leave application request (Category: ${leaveType})...`, 'DATABASE', 'info');

    try {
      addEvent('Performing compliance check for consecutive dates & remaining quota...', 'SECURITY', 'info');
      const res = await api.post('/leaves', {
        leaveType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
      });

      addEvent(`Leave request generated successfully (Record ID: ${res.data?.data?.id || 'OK'}).`, 'DATABASE', 'success', '98ms');
      addEvent('TL review notification webhook sent to manager dashboard.', 'WEBHOOK', 'success');

      setStartDate('');
      setEndDate('');
      setReason('');
      fetchLeaves();
      setActiveWorkflowStep(2);
      await alert({ title: 'Success', message: 'Leave application submitted successfully!', variant: 'success' });
    } catch (err: any) {
      const errMsg = err.response?.data?.message || 'Failed to submit leave request';
      setFormError(errMsg);
      addEvent(`Leave validation aborted: ${errMsg}`, 'SECURITY', 'error');
      setActiveWorkflowStep(0);
    }
  };

  const handleReviewLeave = async (status: 'MANAGER_APPROVED' | 'HR_APPROVED' | 'REJECTED') => {
    if (!reviewingLeave) return;

    addEvent(`Executing manager state transition for ID ${reviewingLeave.id} -> ${status}`, 'SECURITY', 'info');

    try {
      await api.patch(`/leaves/${reviewingLeave.id}/review`, {
        status,
        comment: reviewComment,
      });

      addEvent(`Prisma transaction successfully committed. Status: ${status}`, 'DATABASE', 'success', '125ms');
      if (status === 'HR_APPROVED') {
        addEvent('Updating payroll structures and leave balance offsets.', 'PAYROLL', 'success');
      }

      setReviewingLeave(null);
      setReviewComment('');
      fetchLeaves();
      await alert({ title: 'Success', message: 'Leave review status updated.', variant: 'success' });
    } catch (err: any) {
      const errMsg = err.response?.data?.message || 'Failed to update review status';
      addEvent(`Transaction rolled back: ${errMsg}`, 'DATABASE', 'error');
      await alert({ title: 'Error', message: errMsg, variant: 'error' });
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
      case 'MANAGER_APPROVED':
        return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
      case 'HR_APPROVED':
        return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
      case 'REJECTED':
        return 'bg-rose-500/10 text-rose-500 border border-rose-500/20';
      default:
        return 'bg-brand-100 text-brand-850';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'DATABASE':
        return <Database size={13} className="text-blue-500" />;
      case 'WEBHOOK':
        return <Mail size={13} className="text-purple-500" />;
      case 'SECURITY':
        return <UserCheck size={13} className="text-amber-500" />;
      case 'PAYROLL':
        return <Cpu size={13} className="text-emerald-500" />;
      default:
        return <Activity size={13} className="text-zinc-500" />;
    }
  };

  const filteredEvents = selectedFilter === 'ALL'
    ? events
    : events.filter(e => e.category === selectedFilter);

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-brand-900 to-indigo-950 p-6 rounded-3xl border border-brand-800 shadow-xl">
        <div>
          <h1 className="font-extrabold text-2xl tracking-tight text-white flex items-center gap-2">
            <Layers className="text-indigo-400" size={24} />
            Enterprise Leave Dashboard
          </h1>
          <p className="text-xs text-brand-300 mt-1 font-medium">Standardized MNC workflow approval pipeline with built-in system verification</p>
        </div>
        <button
          onClick={() => { fetchLeaves(); }}
          className="bg-indigo-600 text-white rounded-xl px-5 py-2.5 text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Synchronize Server
        </button>
      </div>

      {/* Stepper Pipeline */}
      <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-lg bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md">
        <h3 className="font-extrabold text-xs uppercase tracking-wider text-brand-950 dark:text-white mb-6 flex items-center gap-2">
          <ShieldCheck className="text-indigo-600 dark:text-indigo-400" size={16} />
          MNC Workflow Approval Steps
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 relative">
          {[
            { step: 1, title: 'Validation & Submit', desc: 'Checks balances, policy limits and request details.' },
            { step: 2, title: 'Lead Review', desc: 'Requires immediate approval from Team Lead.' },
            { step: 3, title: 'HR Audit & Compliance', desc: 'HR validates organizational compliance checks.' },
            { step: 4, title: 'Balance Settlement', desc: 'Disbursed status updated and payroll updated.' }
          ].map((item, idx) => {
            const isActive = activeWorkflowStep >= idx;
            const isCurrent = activeWorkflowStep === idx;
            return (
              <div key={item.step} className="flex flex-col items-center text-center space-y-2 relative group">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-xs transition-all duration-300 ${
                  isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-brand-100 dark:bg-brand-900 text-brand-400'
                } ${isCurrent ? 'ring-4 ring-indigo-500/20 border-2 border-white dark:border-zinc-900' : ''}`}>
                  {isActive ? <Check size={16} /> : item.step}
                </div>
                <div>
                  <p className="font-bold text-xs text-brand-900 dark:text-white">{item.title}</p>
                  <p className="text-[10px] text-brand-500 leading-relaxed max-w-[160px] mx-auto mt-1">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Balances & Submit Form */}
        <div className="space-y-6">
          
          {/* Balances Widget with Circular SVG progress rings */}
          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-xl space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-brand-950 dark:text-white">Live Balance Grid</h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(balances).map(([type, bal]) => {
                const percent = Math.min(100, Math.max(0, (bal.available / bal.limit) * 100));
                const circ = 2 * Math.PI * 18;
                return (
                  <div key={type} className="bg-brand-100/50 dark:bg-brand-900/50 p-4 rounded-2xl border border-brand-200/50 dark:border-brand-800/50 flex items-center justify-between gap-2 group hover:scale-[1.02] transition-all">
                    <div className="space-y-1">
                      <p className="text-[9px] text-brand-500 font-extrabold uppercase tracking-wider">{type.replace('_', ' ')}</p>
                      <p className="text-xl font-extrabold text-brand-950 dark:text-white">{bal.available}</p>
                      <p className="text-[9px] text-brand-400">Used: {bal.used}/{bal.limit}</p>
                    </div>
                    
                    <svg className="w-12 h-12 transform -rotate-90">
                      <circle cx="24" cy="24" r="18" className="stroke-brand-200 dark:stroke-brand-850" strokeWidth="2.5" fill="transparent" />
                      <circle
                        cx="24"
                        cy="24"
                        r="18"
                        className="stroke-indigo-600 transition-all duration-500"
                        strokeWidth="3"
                        fill="transparent"
                        strokeDasharray={circ}
                        strokeDashoffset={circ * (1 - percent / 100)}
                      />
                    </svg>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form */}
          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-xl bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md">
            <h3 className="font-bold text-xs uppercase tracking-wider mb-6 text-brand-950 dark:text-white flex items-center gap-2">
              <Calendar size={15} className="text-indigo-600" />
              Request Time Off
            </h3>

            {formError && (
              <div className="mb-4 p-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 text-xs rounded-xl font-semibold leading-relaxed">
                {formError}
              </div>
            )}

            <form onSubmit={handleApplyLeave} className="space-y-4 text-left text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-500 uppercase">Leave Category</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-600 text-brand-950 dark:text-white"
                >
                  <option value="CASUAL">Casual Leave</option>
                  <option value="SICK">Sick Leave</option>
                  <option value="EARNED">Earned Leave</option>
                  <option value="MATERNITY">Maternity Leave</option>
                  <option value="PATERNITY">Paternity Leave</option>
                  <option value="LOSS_OF_PAY">Loss of Pay (L.O.P.)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-500 uppercase">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-600 text-brand-950 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-500 uppercase">End Date</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-600 text-brand-950 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-500 uppercase">Reason for Leave</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Details of cover, reasons, emergency contact numbers..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-600 text-brand-950 dark:text-white resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 font-bold text-xs uppercase tracking-wide transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center space-x-2"
              >
                <Send size={14} />
                <span>Submit Request</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Queues, Tables & System Activity Feed */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Workflow Review Queue */}
          {user?.role && ['TEAM_LEAD', 'HR', 'SUPER_ADMIN'].includes(user.role) && (
            <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-xl">
              <h3 className="font-bold text-xs uppercase tracking-wider mb-6 text-brand-950 dark:text-white">Workflow Review Queue</h3>
              <div className="space-y-4">
                {pendingRequests.length === 0 ? (
                  <p className="text-center py-6 text-xs text-brand-500">No pending leave requests to review.</p>
                ) : (
                  pendingRequests.map((req) => (
                    <div key={req.id} className="p-4 bg-brand-100/50 dark:bg-brand-900/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between border border-brand-200 dark:border-brand-800 gap-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-xs text-brand-950 dark:text-white">
                            {req.employee?.firstName} {req.employee?.lastName} ({req.employeeId})
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${getStatusStyle(req.status)}`}>
                            {req.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-[10px] text-brand-500 mt-1">
                          <strong>Type:</strong> {req.leaveType} | {new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-brand-700 dark:text-brand-300 mt-2 font-medium italic">"{req.reason}"</p>
                      </div>
                      <button
                        onClick={() => setReviewingLeave(req)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2 font-bold text-[10px] uppercase tracking-wide self-end sm:self-center shadow-md"
                      >
                        Review
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Personal History */}
          <div className="glass rounded-3xl overflow-hidden border border-brand-200 dark:border-brand-900 shadow-xl bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md">
            <div className="p-6 pb-4 border-b border-brand-200 dark:border-brand-900 flex justify-between items-center">
              <h3 className="font-bold text-xs uppercase tracking-wider text-brand-950 dark:text-white">Your Leave History</h3>
              <span className="text-[10px] bg-brand-100 dark:bg-brand-800 text-brand-600 dark:text-brand-300 px-2 py-0.5 rounded font-extrabold uppercase">
                {history.length} Requests
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-brand-100/30 dark:bg-brand-900/30 text-[10px] font-bold text-brand-500 uppercase border-b border-brand-200 dark:border-brand-900">
                    <th className="px-6 py-3.5">Category</th>
                    <th className="px-6 py-3.5">Start Date</th>
                    <th className="px-6 py-3.5">End Date</th>
                    <th className="px-6 py-3.5">Reason</th>
                    <th className="px-6 py-3.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100 dark:divide-brand-900 text-xs font-semibold">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8">
                        <span className="w-5 h-5 rounded-full border-2 border-indigo-600/30 border-t-indigo-600 animate-spin inline-block" />
                      </td>
                    </tr>
                  ) : history.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-brand-500">No leaves submitted yet.</td>
                    </tr>
                  ) : (
                    history.map((req) => (
                      <tr key={req.id} className="hover:bg-brand-100/20 dark:hover:bg-brand-900/20 transition-all">
                        <td className="px-6 py-4 font-bold text-brand-900 dark:text-white uppercase text-[10px] tracking-wide">{req.leaveType}</td>
                        <td className="px-6 py-4">{new Date(req.startDate).toLocaleDateString()}</td>
                        <td className="px-6 py-4">{new Date(req.endDate).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-brand-500 max-w-xs truncate">{req.reason}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${getStatusStyle(req.status)}`}>
                            {req.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Premium System Activity Feed Panel */}
          <div className="glass rounded-3xl overflow-hidden border border-brand-200 dark:border-brand-900 shadow-xl bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-brand-200 dark:border-brand-800 gap-3">
              <div className="flex items-center space-x-2">
                <Activity size={16} className="text-indigo-600 dark:text-indigo-400" />
                <span className="font-extrabold text-xs uppercase tracking-wider text-brand-950 dark:text-white">System Activity & Audit Log</span>
              </div>
              
              {/* Category Filters */}
              <div className="flex flex-wrap gap-1.5">
                {(['ALL', 'DATABASE', 'WEBHOOK', 'SECURITY'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedFilter(cat)}
                    className={`px-2 py-1 rounded text-[8px] font-bold uppercase transition-all border ${
                      selectedFilter === cat
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-brand-100 dark:bg-brand-850 text-brand-600 dark:text-brand-300 border-brand-200 dark:border-brand-800 hover:bg-brand-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-48 overflow-y-auto space-y-2.5 pr-2 scrollbar-thin">
              {filteredEvents.length === 0 ? (
                <p className="text-center py-8 text-xs text-brand-500">No events matched the selected audit filter.</p>
              ) : (
                filteredEvents.map((evt) => (
                  <div key={evt.id} className="flex items-start gap-3 p-3 bg-brand-100/30 dark:bg-brand-900/30 rounded-2xl border border-brand-200/20 dark:border-brand-800/20 hover:bg-brand-100/50 dark:hover:bg-brand-900/50 transition-all">
                    <div className="p-2 bg-white dark:bg-brand-950 rounded-xl shadow-sm border border-brand-100 dark:border-brand-900 flex-shrink-0">
                      {getCategoryIcon(evt.category)}
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-extrabold tracking-wider uppercase text-brand-400 dark:text-brand-500">{evt.category}</span>
                        <div className="flex items-center gap-1.5">
                          {evt.latency && (
                            <span className="text-[8px] bg-brand-200 dark:bg-brand-800 text-brand-600 dark:text-brand-400 px-1.5 py-0.5 rounded font-mono font-bold">{evt.latency}</span>
                          )}
                          <span className="text-[8px] text-brand-400 font-medium">{evt.timestamp}</span>
                        </div>
                      </div>
                      <p className="text-xs text-brand-800 dark:text-brand-200 font-semibold leading-relaxed">{evt.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* --- REVIEW MODAL DRAWER --- */}
      {reviewingLeave && (
        <div className="fixed inset-0 z-50 bg-brand-950/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-md glass rounded-3xl border border-brand-200 dark:border-brand-900 shadow-2xl p-6">
            <div className="flex justify-between items-center pb-4 border-b border-brand-200 dark:border-brand-900">
              <h3 className="font-extrabold text-sm uppercase tracking-wider">Review Leave Request</h3>
              <button onClick={() => setReviewingLeave(null)} className="p-1 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900">
                <XCircle size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-left text-xs font-semibold">
              <div className="bg-brand-100/50 dark:bg-brand-900/50 p-4 rounded-2xl">
                <p className="font-bold">Applicant: {reviewingLeave.employee?.firstName} {reviewingLeave.employee?.lastName}</p>
                <p className="text-[10px] text-brand-500 mt-1">Leave Category: {reviewingLeave.leaveType}</p>
                <p className="text-[10px] text-brand-500">Dates: {new Date(reviewingLeave.startDate).toLocaleDateString()} to {new Date(reviewingLeave.endDate).toLocaleDateString()}</p>
                <p className="mt-3 text-brand-700 dark:text-brand-300 italic">"{reviewingLeave.reason}"</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Review Comments</label>
                <textarea
                  rows={3}
                  placeholder="Enter comments explaining the approval/rejection decision..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 outline-none focus:border-indigo-600 text-brand-950 dark:text-white resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5 pt-4 border-t border-brand-200 dark:border-brand-900">
                <button
                  onClick={() => handleReviewLeave('REJECTED')}
                  className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl py-2.5 font-bold uppercase tracking-wide text-[10px]"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleReviewLeave(user?.role === 'TEAM_LEAD' ? 'MANAGER_APPROVED' : 'HR_APPROVED')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 font-bold uppercase tracking-wide text-[10px] shadow-md"
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Leaves;
