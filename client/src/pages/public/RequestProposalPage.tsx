import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Building, 
  Target, 
  AlertTriangle, 
  Lightbulb, 
  Calendar, 
  DollarSign, 
  Cpu, 
  FileText,
  Send
} from 'lucide-react';
import { api } from '../../services/api'; 
import { useDialog } from '../../context/DialogContext';

const RequestProposalPage: React.FC = () => {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const { alert } = useDialog();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    companyDetails: '',
    businessGoals: '',
    currentProblems: '',
    expectedSolution: '',
    expectedTimeline: '',
    budget: '',
    preferredTechnology: '',
    additionalNotes: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadId) return;

    setLoading(true);
    try {
      await api.post(`/crm/contact/${leadId}/proposal`, formData);
      alert({ title: 'Success', message: 'Your proposal request has been submitted successfully. Our team will get back to you shortly.', variant: 'success' });
      navigate('/'); 
    } catch (error: any) {
      console.error(error);
      alert({ title: 'Error', message: error.response?.data?.error || 'Failed to submit proposal request. Please try again later.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 py-8 px-8">
          <h2 className="text-3xl font-extrabold text-white">Request a Business Proposal</h2>
          <p className="mt-2 text-blue-100">Tell us about your project requirements to receive a customized proposal.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">Company & Objectives</h3>
            
            <div>
              <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                <Building className="w-4 h-4 mr-2 text-indigo-500" /> Company Details
              </label>
              <textarea 
                name="companyDetails"
                required
                value={formData.companyDetails}
                onChange={handleChange}
                className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-3"
                rows={2}
                placeholder="Briefly describe your company and industry"
              />
            </div>

            <div>
              <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                <Target className="w-4 h-4 mr-2 text-indigo-500" /> Business Goals
              </label>
              <textarea 
                name="businessGoals"
                required
                value={formData.businessGoals}
                onChange={handleChange}
                className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-3"
                rows={2}
                placeholder="What are the main objectives of this project?"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2 mt-8">Challenges & Solutions</h3>
            
            <div>
              <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" /> Current Problems
              </label>
              <textarea 
                name="currentProblems"
                required
                value={formData.currentProblems}
                onChange={handleChange}
                className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm focus:ring-amber-500 focus:border-amber-500 sm:text-sm p-3"
                rows={2}
                placeholder="What pain points are you facing?"
              />
            </div>

            <div>
              <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                <Lightbulb className="w-4 h-4 mr-2 text-indigo-500" /> Expected Solution
              </label>
              <textarea 
                name="expectedSolution"
                required
                value={formData.expectedSolution}
                onChange={handleChange}
                className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-3"
                rows={2}
                placeholder="Describe your ideal solution"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2 mt-8">Project Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <Calendar className="w-4 h-4 mr-2 text-indigo-500" /> Expected Timeline
                </label>
                <select
                  name="expectedTimeline"
                  required
                  value={formData.expectedTimeline}
                  onChange={handleChange}
                  className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-3"
                >
                  <option value="">Select Timeline</option>
                  <option value="Immediate (< 1 month)">Immediate (&lt; 1 month)</option>
                  <option value="1-3 Months">1-3 Months</option>
                  <option value="3-6 Months">3-6 Months</option>
                  <option value="Flexible">Flexible</option>
                </select>
              </div>
              
              <div>
                <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <DollarSign className="w-4 h-4 mr-2 text-green-500" /> Budget Range
                </label>
                <select
                  name="budget"
                  required
                  value={formData.budget}
                  onChange={handleChange}
                  className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-3"
                >
                  <option value="">Select Budget</option>
                  <option value="< $5,000">&lt; $5,000</option>
                  <option value="$5,000 - $15,000">$5,000 - $15,000</option>
                  <option value="$15,000 - $50,000">$15,000 - $50,000</option>
                  <option value="$50,000+">$50,000+</option>
                  <option value="Not Sure Yet">Not Sure Yet</option>
                </select>
              </div>
            </div>

            <div>
              <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                <Cpu className="w-4 h-4 mr-2 text-indigo-500" /> Preferred Technology (Optional)
              </label>
              <input 
                type="text"
                name="preferredTechnology"
                value={formData.preferredTechnology}
                onChange={handleChange}
                className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-3"
                placeholder="e.g. React, Node.js, AWS, etc."
              />
            </div>
            
            <div>
              <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                <FileText className="w-4 h-4 mr-2 text-indigo-500" /> Additional Notes (Optional)
              </label>
              <textarea 
                name="additionalNotes"
                value={formData.additionalNotes}
                onChange={handleChange}
                className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-3"
                rows={3}
                placeholder="Any other details you'd like to share?"
              />
            </div>
          </div>

          <div className="pt-6">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-xl shadow-sm text-lg font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all transform hover:scale-[1.01] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Submitting Request...
                </span>
              ) : (
                <span className="flex items-center">
                  <Send className="w-5 h-5 mr-2" />
                  Submit Proposal Request
                </span>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default RequestProposalPage;
