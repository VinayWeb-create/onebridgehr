import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import api, { SOCKET_URL } from '../../services/api';
import {
  Eye,
  FileCheck,
  FileSignature,
  Mail,
  UserCheck,
  X,
  Download,
  RefreshCw,
  History,
  Search,
  CheckCircle2,
  Clock,
  Send,
  UserPlus,
} from 'lucide-react';

interface JoiningLettersTabProps {
  statusFilter?: string[];
}

const STATUS_META: Record<string, { label: string; dot: string; badge: string }> = {
  OFFER_SENT: { label: 'Offer Sent', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  ACCEPTED: { label: 'Offer Accepted', dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
  CHANGES_REQUESTED: { label: 'Changes Requested', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
  DOCUMENTS_PENDING: { label: 'Documents Pending', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
  DOCUMENTS_SUBMITTED: { label: 'Documents Pending', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
  HR_VERIFICATION: { label: 'HR Verification', dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' },
  APPROVED: { label: 'Documents Verified', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' },
  DOCUMENTS_VERIFIED: { label: 'Documents Verified', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' },
  JOINING_LETTER_SENT: { label: 'Joining Letter Sent', dot: 'bg-violet-500', badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300' },
  READY_TO_JOIN: { label: 'Ready to Join', dot: 'bg-violet-500', badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300' },
  JOINED: { label: 'Joined', dot: 'bg-sky-500', badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300' },
  EMPLOYEE_CREATED: { label: 'Employee Created', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' },
  CREDENTIALS_SENT: { label: 'Credentials Sent', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' },
  ACTIVE: { label: 'Active', dot: 'bg-green-500', badge: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' },
  COMPLETED: { label: 'Active', dot: 'bg-green-500', badge: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' },
  REJECTED: { label: 'Rejected', dot: 'bg-rose-500', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300' },
  EXPIRED: { label: 'Expired', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};

const PIPELINE: { key: string; label: string }[] = [
  { key: 'SELECTED', label: 'Selected' },
  { key: 'ACCEPTED', label: 'Offer Accepted' },
  { key: 'JOINING_LETTER_SENT', label: 'Joining Letter Sent' },
  { key: 'JOINING_LETTER_ACCEPTED', label: 'Joining Letter Accepted' },
  { key: 'DOCUMENTS_PENDING', label: 'Documents Pending' },
  { key: 'DOCUMENTS_VERIFIED', label: 'Documents Verified' },
  { key: 'JOINED', label: 'Joined' },
  { key: 'EMPLOYEE_CREATED', label: 'Employee Created' },
  { key: 'ACTIVE', label: 'Active' },
];

const PIPELINE_INDEX: Record<string, number> = {
  OFFER_SENT: 0,
  ACCEPTED: 1,
  CHANGES_REQUESTED: 1,
  JOINING_LETTER_SENT: 2,
  READY_TO_JOIN: 2,
  DOCUMENTS_PENDING: 4,
  DOCUMENTS_SUBMITTED: 4,
  HR_VERIFICATION: 4,
  APPROVED: 5,
  DOCUMENTS_VERIFIED: 5,
  JOINED: 6,
  EMPLOYEE_CREATED: 7,
  CREDENTIALS_SENT: 7,
  ACTIVE: 8,
  COMPLETED: 8,
  REJECTED: -1,
  EXPIRED: -1,
};

export const JoiningLettersTab: React.FC<JoiningLettersTabProps> = ({ statusFilter }) => {
  const [onboardings, setOnboardings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);

  const [selectedOnboarding, setSelectedOnboarding] = useState<any>(null);
  const [verifyModal, setVerifyModal] = useState(false);
  const [verifyNote, setVerifyNote] = useState('');

  const [trackModal, setTrackModal] = useState(false);
  const [trackDetail, setTrackDetail] = useState<any>(null);

  useEffect(() => {
    fetchOnboardings();
  }, []);

  // Real-time socket listener: update status when candidate accepts
  useEffect(() => {
    const socket = io(SOCKET_URL);
    socket.on('onboarding_status_update', (data: { id: string; status: string }) => {
      setOnboardings((prev: any[]) =>
        prev.map((ob: any) =>
          ob.id === data.id ? { ...ob, status: data.status } : ob
        )
      );
    });
    return () => { socket.disconnect(); };
  }, []);

  const fetchOnboardings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/onboarding');
      let data = res.data.data;
      if (statusFilter && statusFilter.length > 0) {
        data = data.filter((ob: any) => statusFilter.includes(ob.status));
      }
      setOnboardings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getDocUrl = (ob: any, type: string): string | null => {
    const doc = (ob.documents || []).find((d: any) => d.type === type);
    if (doc) return doc.driveUrl || doc.localUrl || null;
    if (type === 'JOINING_LETTER' && ob.joiningLetterUrl) return ob.joiningLetterUrl;
    return null;
  };

  const joiningLetterUrl = (ob: any) => getDocUrl(ob, 'JOINING_LETTER');
  const joiningLetterSent = (ob: any) =>
    ['JOINING_LETTER_SENT', 'READY_TO_JOIN', 'JOINED', 'EMPLOYEE_CREATED', 'CREDENTIALS_SENT', 'ACTIVE', 'COMPLETED'].includes(ob.status) || !!joiningLetterUrl(ob);

  const handleStartVerification = async (onboarding: any) => {
    if (onboarding.status === 'DOCUMENTS_PENDING' || onboarding.status === 'DOCUMENTS_SUBMITTED') {
      try {
        await api.post(`/onboarding/${onboarding.id}/start-verification`);
        onboarding.status = 'HR_VERIFICATION';
      } catch (err) {
        console.error(err);
      }
    }
    setSelectedOnboarding(onboarding);
    setVerifyModal(true);
  };

  const handleVerify = async (decision: 'APPROVE' | 'REJECT' | 'CHANGES') => {
    if (!selectedOnboarding) return;
    try {
      await api.post(`/onboarding/${selectedOnboarding.id}/verify`, {
        decision,
        note: verifyNote,
      });
      alert(`Submission ${decision.toLowerCase()}d successfully.`);
      setVerifyModal(false);
      setVerifyNote('');
      fetchOnboardings();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to verify');
    }
  };

  const runAction = async (fn: () => Promise<any>, successMsg: string) => {
    try {
      const res = await fn();
      alert(successMsg);
      fetchOnboardings();
      return res;
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Action failed');
      return null;
    }
  };

  const handleGenerateJoiningLetter = (id: string) =>
    runAction(
      () => api.post(`/onboarding/${id}/joining-letter`, { email: false }),
      'Joining letter generated and saved. Use Email to send it to the candidate.'
    );

  const handleEmailJoiningLetter = (id: string) =>
    runAction(
      () => api.post(`/onboarding/${id}/joining-letter`, { email: true }),
      'Joining letter emailed to the candidate.'
    );

  const handlePreviewJoiningLetter = (ob: any) => {
    const url = joiningLetterUrl(ob);
    if (url) {
      window.open(url, '_blank');
    } else {
      alert('No joining letter has been generated yet. Generate one first.');
    }
  };

  const handleMarkJoined = async (ob: any) => {
    const confirmed = window.confirm(
      `Mark ${ob.offerLetter.candidateName} as joined? This will automatically create the employee account, generate login credentials and send the welcome email.`
    );
    if (!confirmed) return;
    setActionId(ob.id);
    try {
      const res = await api.post(`/onboarding/${ob.id}/joined`, { email: true });
      const onboarding = res.data.data.onboarding;
      if (onboarding.status === 'JOINED') {
        alert('Candidate marked as joined. The employee account will be created automatically after the configured delay (process now if needed).');
      } else {
        const empId = res.data.data.employee?.employeeId || onboarding.employeeId || '';
        alert(`Employee ${empId} created and activated. Login credentials + welcome email were sent automatically.`);
      }
      fetchOnboardings();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to mark as joined');
    } finally {
      setActionId(null);
    }
  };

  const handleProcessNow = (id: string) =>
    runAction(() => api.post(`/onboarding/${id}/process`), 'Employee account created, activated, and welcome email sent.');

  const handleActivate = (id: string) =>
    runAction(() => api.post(`/onboarding/${id}/activate`), 'Employee account activated.');

  const handleSendCredentials = (id: string) =>
    runAction(() => api.post(`/onboarding/${id}/send-credentials`), 'Login credentials re-sent to the employee.');

  const handleTrack = async (ob: any) => {
    try {
      const res = await api.get(`/onboarding/${ob.id}`);
      setTrackDetail(res.data.data);
      setTrackModal(true);
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = onboardings.filter((ob) => {
    // Filter out candidates who are already onboarded as employees
    if (ob.employeeId || ['ACTIVE', 'EMPLOYEE_CREATED', 'CREDENTIALS_SENT', 'JOINED'].includes(ob.status)) {
      return false;
    }

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      ob.offerLetter?.candidateName?.toLowerCase().includes(q) ||
      ob.offerLetter?.candidateEmail?.toLowerCase().includes(q) ||
      ob.offerLetter?.role?.toLowerCase().includes(q) ||
      ob.employeeId?.toLowerCase().includes(q)
    );
  });

  const currentStep = (status: string) => (PIPELINE_INDEX[status] !== undefined ? PIPELINE_INDEX[status] : -1);

  return (
    <div className="space-y-4 animate-fade-in pt-4">
      {/* Search */}
      <div className="flex justify-between items-center">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidate, email, role..."
            className="pl-9 pr-4 py-2 bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl text-xs w-72 focus:outline-none focus:border-indigo-500"
          />
          <Search size={14} className="absolute left-3 top-2.5 text-brand-400" />
        </div>
        <div className="text-[11px] font-bold text-brand-500 uppercase tracking-wider">
          {filtered.length} workflow(s)
        </div>
      </div>

      <div className="glass rounded-3xl overflow-hidden border border-brand-200 dark:border-brand-900 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-brand-100/50 dark:bg-brand-900/30 text-[10px] font-bold text-brand-500 uppercase border-b border-brand-200 dark:border-brand-900">
                <th className="px-6 py-4">Candidate</th>
                <th className="px-6 py-4">Position</th>
                <th className="px-6 py-4">Joining Date</th>
                <th className="px-6 py-4">Current Status</th>
                
                
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100 dark:divide-brand-900 text-xs font-semibold">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-10">
                    <span className="w-6 h-6 rounded-full border-2 border-indigo-600/30 border-t-indigo-600 animate-spin inline-block" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-brand-500">No active joining workflows found.</td>
                </tr>
              ) : (
                filtered.map((ob) => {
                  const meta = STATUS_META[ob.status] || { label: ob.status.replace(/_/g, ' '), dot: 'bg-brand-400', badge: 'bg-brand-100 text-brand-600' };
                  const step = currentStep(ob.status);
                  const docs = ob.documents || [];
                  const joiningDocUrl = joiningLetterUrl(ob);
                  return (
                    <tr key={ob.id} className="hover:bg-brand-100/30 dark:hover:bg-brand-900/20">
                      <td className="px-6 py-4">
                        <div className="text-brand-950 dark:text-white font-bold">{ob.offerLetter.candidateName}</div>
                        <div className="text-[10px] text-brand-500">{ob.offerLetter.candidateEmail}</div>
                        {ob.employeeId && <div className="text-[10px] text-indigo-600 font-bold mt-0.5">{ob.employeeId}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-brand-950 dark:text-gray-200">{ob.offerLetter.role}</div>
                        <div className="text-[10px] text-brand-500">{ob.offerLetter.department}</div>
                      </td>
                      <td className="px-6 py-4 text-brand-600 font-semibold">
                        {new Date(ob.offerLetter.joiningDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${meta.badge}`}>
                          <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                          <span>{meta.label}</span>
                        </span>
                      </td>
                      
                      
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {['DOCUMENTS_PENDING', 'DOCUMENTS_SUBMITTED', 'HR_VERIFICATION'].includes(ob.status) && (
                            <button
                              onClick={() => handleStartVerification(ob)}
                              className="px-3 py-1.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 rounded-lg hover:bg-yellow-200 text-[10px] font-bold uppercase flex items-center gap-2"
                            >
                              <FileCheck size={14} /> Verify Docs
                            </button>
                          )}
                          
                          
                          {['ACCEPTED', 'JOINING_LETTER_SENT', 'READY_TO_JOIN', 'APPROVED', 'DOCUMENTS_VERIFIED'].includes(ob.status) && (
                            <button
                              onClick={() => handleMarkJoined(ob)}
                              disabled={actionId === ob.id}
                              className="px-5 py-2.5 bg-[#ea6d2a] text-white rounded-full hover:bg-[#ea6d2a]/90 text-[11px] font-bold uppercase tracking-wide flex items-center gap-2 disabled:opacity-50 shadow-md shadow-[#ea6d2a]/30 transition-all"
                              >
                                <UserPlus size={15} /> ONBOARD EMPLOYEE
                            </button>
                          )}
                          {ob.status === 'JOINED' && (
                            <button
                              onClick={() => handleProcessNow(ob.id)}
                              disabled={actionId === ob.id}
                              className="px-3 py-1.5 bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 rounded-lg hover:bg-sky-200 text-[10px] font-bold uppercase flex items-center gap-2 disabled:opacity-50"
                              title="Run delayed employee creation now"
                            >
                              <UserPlus size={14} /> Process Now
                            </button>
                          )}
                          {['EMPLOYEE_CREATED', 'CREDENTIALS_SENT'].includes(ob.status) && (
                            <button
                              onClick={() => handleActivate(ob.id)}
                              disabled={actionId === ob.id}
                              className="px-3 py-1.5 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 rounded-lg hover:bg-green-200 text-[10px] font-bold uppercase flex items-center gap-2 disabled:opacity-50"
                            >
                              <CheckCircle2 size={14} /> Activate
                            </button>
                          )}
                          {['ACTIVE', 'COMPLETED'].includes(ob.status) && (
                            <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 flex items-center gap-1">
                              <CheckCircle2 size={12} /> Onboarded
                            </span>
                          )}
                          <button
                            onClick={() => handleTrack(ob)}
                            className="p-2 bg-brand-50 dark:bg-brand-900 text-brand-600 dark:text-brand-400 rounded-lg hover:bg-brand-100"
                            title="Track Status"
                          >
                            <History size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VERIFY MODAL */}
      {verifyModal && selectedOnboarding && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-brand-950 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 border border-brand-200 dark:border-brand-800">
            <div className="flex justify-between items-center mb-6 border-b border-brand-100 dark:border-brand-900 pb-4">
              <div>
                <h3 className="font-bold text-lg text-brand-950 dark:text-white">Verify Onboarding Submission</h3>
                <p className="text-xs text-brand-500">{selectedOnboarding.offerLetter.candidateName}</p>
              </div>
              <button onClick={() => setVerifyModal(false)} className="p-2 hover:bg-brand-100 dark:hover:bg-brand-900 rounded-full text-brand-500">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="p-4 bg-brand-100/40 dark:bg-brand-900/40 rounded-xl">
                <h4 className="font-bold text-xs uppercase text-brand-500 mb-3">Submitted Documents</h4>
                <div className="grid grid-cols-2 gap-4">
                  {(selectedOnboarding.documents || []).map((doc: any) => (
                    <div key={doc.id} className="p-3 border border-brand-200 dark:border-brand-800 rounded-lg bg-white dark:bg-brand-950 flex items-center justify-between">
                      <span className="text-sm font-semibold text-brand-950 dark:text-white">{doc.type.replace(/_/g, ' ')}</span>
                      <a href={doc.driveUrl || doc.localUrl || '#'} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 font-bold hover:underline">
                        View
                      </a>
                    </div>
                  ))}
                  {(selectedOnboarding.documents || []).length === 0 && (
                    <p className="text-xs text-brand-500 col-span-2">No documents uploaded yet.</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-brand-600 dark:text-brand-300 uppercase">Verification Notes / Rejection Reason</label>
                <textarea
                  value={verifyNote}
                  onChange={(e) => setVerifyNote(e.target.value)}
                  className="w-full mt-2 border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900 rounded-xl p-3 text-sm text-brand-950 dark:text-white outline-none focus:border-indigo-500"
                  rows={3}
                  placeholder="Enter notes here..."
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-brand-100 dark:border-brand-900">
                <button onClick={() => handleVerify('REJECT')} className="px-4 py-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 font-bold rounded-xl text-xs hover:bg-rose-100">
                  Reject
                </button>
                <button onClick={() => handleVerify('CHANGES')} className="px-4 py-2 bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 font-bold rounded-xl text-xs hover:bg-yellow-100">
                  Request Changes
                </button>
                <button onClick={() => handleVerify('APPROVE')} className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs hover:bg-emerald-700">
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TRACK STATUS MODAL */}
      {trackModal && trackDetail && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-brand-950 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 border border-brand-200 dark:border-brand-800">
            <div className="flex justify-between items-center mb-6 border-b border-brand-100 dark:border-brand-900 pb-4">
              <div>
                <h3 className="font-bold text-lg text-brand-950 dark:text-white">Workflow Status — {trackDetail.offerLetter?.candidateName}</h3>
                <p className="text-xs text-brand-500">{trackDetail.offerLetter?.role} • {trackDetail.offerLetter?.department}</p>
              </div>
              <button onClick={() => setTrackModal(false)} className="p-2 hover:bg-brand-100 dark:hover:bg-brand-900 rounded-full text-brand-500">
                <X size={20} />
              </button>
            </div>

            {/* Pipeline */}
            <div className="mb-6">
              <h4 className="text-[10px] font-bold uppercase text-brand-500 mb-3 flex items-center gap-1.5">
                <Clock size={12} /> Joining Pipeline
              </h4>
              <div className="space-y-1">
                {PIPELINE.map((p, idx) => {
                  const step = currentStep(trackDetail.status);
                  const done = step >= 0 && idx <= step;
                  const current = idx === step;
                  const rejected = ['REJECTED', 'EXPIRED'].includes(trackDetail.status);
                  return (
                    <div key={p.key} className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0 ${
                          rejected ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300'
                          : done ? 'bg-emerald-500 text-white'
                          : 'bg-brand-100 dark:bg-brand-900 text-brand-400'
                        }`}
                      >
                        {done && !current ? '✓' : idx + 1}
                      </div>
                      <span
                        className={`text-xs font-bold ${
                          current ? 'text-indigo-600' : done ? 'text-brand-950 dark:text-white' : 'text-brand-400'
                        }`}
                      >
                        {p.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Audit Trail */}
            <div>
              <h4 className="text-[10px] font-bold uppercase text-brand-500 mb-3">Audit Trail</h4>
              {(trackDetail.auditTrail || []).length === 0 ? (
                <p className="text-xs text-brand-500">No activity recorded yet.</p>
              ) : (
                <div className="relative border-l-2 border-brand-200 dark:border-brand-900 ml-2 space-y-4">
                  {(trackDetail.auditTrail || []).map((log: any, idx: number) => (
                    <div key={idx} className="relative pl-5">
                      <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-indigo-600 border-2 border-white dark:border-brand-950" />
                      <div className="text-[10px] font-bold text-brand-400 uppercase">
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                      <div className="text-xs font-bold text-brand-950 dark:text-white mt-0.5">{log.action.replace(/_/g, ' ')}</div>
                      <div className="text-[11px] text-brand-500 mt-0.5">{log.details}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JoiningLettersTab;
