import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  FileText, Calendar, Clock, AlertCircle, Sparkles, Send, CheckCircle2, XCircle
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

export const Leaves: React.FC = () => {
  const { user } = useAuth();
  
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

  useEffect(() => {
    fetchLeaves();
  }, [user]);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      // Fetch personal leaves and balances
      const resPersonal = await api.get('/leaves/history');
      setHistory(resPersonal.data.data.history);
      setBalances(resPersonal.data.data.balances);

      // Fetch pending review items for Team Leads or HR/Admins
      if (user?.role && ['TEAM_LEAD', 'HR', 'SUPER_ADMIN'].includes(user.role)) {
        const resPending = await api.get('/leaves/pending');
        setPendingRequests(resPending.data.data);
      }
    } catch (err) {
      console.error('Failed to load leave records:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      await api.post('/leaves', {
        leaveType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
      });

      // Reset form
      setStartDate('');
      setEndDate('');
      setReason('');
      fetchLeaves();
      alert('Leave application submitted successfully!');
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to submit leave request');
    }
  };

  const handleReviewLeave = async (status: 'MANAGER_APPROVED' | 'HR_APPROVED' | 'REJECTED') => {
    if (!reviewingLeave) return;

    try {
      await api.patch(`/leaves/${reviewingLeave.id}/review`, {
        status,
        comment: reviewComment,
      });

      setReviewingLeave(null);
      setReviewComment('');
      fetchLeaves();
      alert('Leave review status updated.');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update review status');
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400';
      case 'MANAGER_APPROVED':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400';
      case 'HR_APPROVED':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400';
      case 'REJECTED':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400';
      default:
        return 'bg-brand-100 text-brand-850';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="font-extrabold text-2xl tracking-tight text-brand-950 dark:text-white">Leaves Management</h1>
        <p className="text-xs text-brand-500 mt-1 font-semibold">Track balances, request times off, and review organization approvals</p>
      </div>

      {/* Grid structure */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Balances & Form */}
        <div className="space-y-6">
          {/* Balances Widget */}
          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-xl space-y-4">
            <h3 className="font-bold text-sm uppercase tracking-wider">Leave Balance Grid</h3>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(balances).slice(0, 3).map(([type, bal]) => (
                <div key={type} className="bg-brand-100/50 dark:bg-brand-900/50 p-3 rounded-2xl text-center border border-brand-200/50 dark:border-brand-800/50">
                  <p className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400">{bal.available}</p>
                  <p className="text-[9px] text-brand-500 font-extrabold uppercase mt-1 tracking-wider">{type}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-xl">
            <h3 className="font-bold text-sm uppercase tracking-wider mb-6">Request Time Off</h3>

            {formError && (
              <div className="mb-4 p-3.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl font-semibold leading-relaxed">
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
                    className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-500 uppercase">End Date</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-600"
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

        {/* List Personal Requests & Manager Review Queue */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Manager Review Panel */}
          {user?.role && ['TEAM_LEAD', 'HR', 'SUPER_ADMIN'].includes(user.role) && (
            <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-xl">
              <h3 className="font-bold text-sm uppercase tracking-wider mb-6">Workflow Review Queue</h3>
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
                        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2 font-bold text-[10px] uppercase tracking-wide self-end sm:self-center shadow-md shadow-indigo-600/10"
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
          <div className="glass rounded-3xl overflow-hidden border border-brand-200 dark:border-brand-900 shadow-xl">
            <div className="p-6 pb-4 border-b border-brand-200 dark:border-brand-900">
              <h3 className="font-bold text-sm uppercase tracking-wider">Your Leave History</h3>
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
                      <td colSpan={5} className="text-center py-6">
                        <span className="w-5 h-5 rounded-full border-2 border-indigo-600/30 border-t-indigo-600 animate-spin inline-block" />
                      </td>
                    </tr>
                  ) : history.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-brand-500">No leaves submitted yet.</td>
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
