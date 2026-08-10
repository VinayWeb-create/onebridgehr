import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Mail, Search, Edit, Eye, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const SelectedCandidatesTab: React.FC = () => {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  
  // Add Candidate Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    department: '',
    salary: '',
    joiningDate: '',
    remarks: 'Excellent'
  });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const res = await api.get('/onboarding/candidates');
      setCandidates(res.data.data.offers || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendAcceptanceEmail = async (offerLetterId: string) => {
    if (!window.confirm('Generate 11-page Internship Offer Letter and send Acceptance Email via secure portal link?')) return;
    
    try {
      setSending(offerLetterId);
      await api.post('/onboarding/send', { offerLetterId });
      alert('Acceptance email sent successfully! The candidate has been moved to the onboarding workflow.');
      fetchCandidates();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to send acceptance email');
    } finally {
      setSending(null);
    }
  };

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAdding(true);
      await api.post('/onboarding/candidates', formData);
      alert('Candidate added successfully!');
      setShowAddModal(false);
      setFormData({ name: '', email: '', role: '', department: '', salary: '', joiningDate: '', remarks: 'Excellent' });
      fetchCandidates();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to add candidate');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in pt-4">
      <div className="flex justify-between items-center mb-4">
        <div className="relative">
          <input type="text" placeholder="Search candidates..." className="pl-9 pr-4 py-2 bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-xl text-xs w-64 focus:outline-none focus:border-indigo-500" />
          <Search size={14} className="absolute left-3 top-2.5 text-brand-400" />
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-colors"
        >
          <Plus size={16} /> Add Selected Candidate
        </button>
      </div>

      <div className="glass rounded-3xl overflow-hidden border border-brand-200 dark:border-brand-900 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-brand-100/50 dark:bg-brand-900/30 text-[10px] font-bold text-brand-500 uppercase border-b border-brand-200 dark:border-brand-900">
                <th className="px-6 py-4">Candidate</th>
                <th className="px-6 py-4">Position & Dept</th>
                <th className="px-6 py-4">Interview Details</th>
                <th className="px-6 py-4">Offer Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100 dark:divide-brand-900 text-xs font-semibold">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-10">Loading...</td></tr>
              ) : candidates.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-brand-500">No selected candidates found. Add a candidate to get started.</td></tr>
              ) : (
                candidates.map(candidate => (
                  <tr key={candidate.id} className="hover:bg-brand-100/30 dark:hover:bg-brand-900/20">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 font-bold uppercase text-[10px]">
                          {candidate.candidateName.substring(0, 2)}
                        </div>
                        <div>
                          <div className="text-brand-950 dark:text-white font-bold">{candidate.candidateName}</div>
                          <div className="text-[10px] text-brand-500">{candidate.candidateEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-brand-900 dark:text-brand-100">{candidate.role}</div>
                      <div className="text-[10px] text-brand-500">{candidate.department}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-[10px] text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-md inline-block mb-1">Cleared</div>
                      <div className="text-[10px] text-brand-500">Remarks: Excellent</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                        candidate.status === 'DRAFT' ? 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400' :
                        candidate.status === 'APPROVED' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' :
                        'bg-brand-100 text-brand-600'
                      }`}>
                        {candidate.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button className="p-2 bg-brand-50 dark:bg-brand-900 text-brand-600 dark:text-brand-400 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-800" title="View Candidate">
                          <Eye size={14} />
                        </button>
                        <button className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50" title="Edit Candidate">
                          <Edit size={14} />
                        </button>
                        <button 
                          onClick={() => handleSendAcceptanceEmail(candidate.id)}
                          disabled={sending === candidate.id}
                          className="px-3 py-1.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 text-[10px] font-bold uppercase flex items-center gap-2"
                        >
                          <Mail size={14} />
                          {sending === candidate.id ? 'Sending...' : 'Send Acceptance Email'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Candidate Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-brand-950/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-brand-950 border border-brand-200 dark:border-brand-800 rounded-3xl w-full max-w-lg shadow-2xl p-6">
            <div className="flex justify-between items-center mb-6 border-b border-brand-100 dark:border-brand-900 pb-4">
              <div>
                <h3 className="font-bold text-lg text-brand-950 dark:text-white">Add Selected Candidate</h3>
                <p className="text-xs text-brand-500">Record a candidate who has cleared interviews</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-brand-50 dark:hover:bg-brand-900 rounded-full text-brand-500"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleAddCandidate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-brand-500 uppercase">Full Name</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full mt-1 border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-brand-500 uppercase">Email Address</label>
                  <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full mt-1 border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-brand-500 uppercase">Role / Position</label>
                  <input required type="text" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full mt-1 border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-brand-500 uppercase">Department</label>
                  <input required type="text" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} className="w-full mt-1 border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-brand-500 uppercase">Salary / Stipend</label>
                  <input required type="number" value={formData.salary} onChange={e => setFormData({...formData, salary: e.target.value})} className="w-full mt-1 border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-brand-500 uppercase">Joining Date</label>
                  <input required type="date" value={formData.joiningDate} onChange={e => setFormData({...formData, joiningDate: e.target.value})} className="w-full mt-1 border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-brand-500 uppercase">Interview Remarks</label>
                  <input type="text" value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} className="w-full mt-1 border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div className="pt-4 border-t border-brand-100 dark:border-brand-900 flex justify-end gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-5 py-2.5 rounded-xl text-xs font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 dark:bg-brand-900 dark:text-brand-300">Cancel</button>
                <button type="submit" disabled={adding} className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 disabled:opacity-50">
                  {adding ? 'Saving...' : 'Save Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SelectedCandidatesTab;
