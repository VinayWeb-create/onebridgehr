import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Video, 
  MapPin, 
  Calendar, 
  Clock, 
  Globe, 
  Users, 
  Target,
  Send,
  Building
} from 'lucide-react';
import { api } from '../../services/api';
import { useDialog } from '../../context/DialogContext';

const BookDemoPage: React.FC = () => {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const { alert } = useDialog();
  const [loading, setLoading] = useState(false);
  const [demoType, setDemoType] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');

  const [formData, setFormData] = useState({
    date: '',
    time: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    participants: '1',
    purpose: '',
    officeLocation: 'OneBridge Head Office, Hyderabad',
    customerAddress: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadId) return;

    setLoading(true);
    try {
      await api.post(`/crm/contact/${leadId}/demo`, { type: demoType, ...formData });
      alert({ 
        title: 'Success', 
        message: 'Demo booked successfully! Please check your email for the calendar invite and details.', 
        variant: 'success' 
      });
      navigate('/');
    } catch (error: any) {
      console.error(error);
      alert({ 
        title: 'Error', 
        message: error.response?.data?.error || 'Failed to book demo. Please try again later.', 
        variant: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-indigo-600 py-8 px-8">
          <h2 className="text-3xl font-extrabold text-white">Book a Live Demo</h2>
          <p className="mt-2 text-orange-100">Schedule a 1-on-1 technical discovery session with our experts.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          
          {/* Demo Type Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">Select Demo Format</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label 
                className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${
                  demoType === 'ONLINE' 
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500' 
                    : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                }`}
              >
                <input 
                  type="radio" 
                  name="demoType" 
                  value="ONLINE" 
                  checked={demoType === 'ONLINE'}
                  onChange={() => setDemoType('ONLINE')}
                  className="sr-only"
                />
                <Video className={`w-8 h-8 mr-4 ${demoType === 'ONLINE' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                <div>
                  <div className={`font-semibold ${demoType === 'ONLINE' ? 'text-indigo-900 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>Online Demo</div>
                  <div className="text-sm text-slate-500">Google Meet / Zoom</div>
                </div>
              </label>

              <label 
                className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${
                  demoType === 'OFFLINE' 
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 ring-1 ring-orange-500' 
                    : 'border-slate-200 dark:border-slate-700 hover:border-orange-300'
                }`}
              >
                <input 
                  type="radio" 
                  name="demoType" 
                  value="OFFLINE" 
                  checked={demoType === 'OFFLINE'}
                  onChange={() => setDemoType('OFFLINE')}
                  className="sr-only"
                />
                <MapPin className={`w-8 h-8 mr-4 ${demoType === 'OFFLINE' ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400'}`} />
                <div>
                  <div className={`font-semibold ${demoType === 'OFFLINE' ? 'text-orange-900 dark:text-orange-300' : 'text-slate-700 dark:text-slate-300'}`}>Offline Meeting</div>
                  <div className="text-sm text-slate-500">In-person meeting</div>
                </div>
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">Date & Time</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <Calendar className="w-4 h-4 mr-2 text-indigo-500" /> Date
                </label>
                <input 
                  type="date"
                  name="date"
                  required
                  value={formData.date}
                  onChange={handleChange}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-3"
                />
              </div>
              
              <div>
                <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <Clock className="w-4 h-4 mr-2 text-indigo-500" /> Time
                </label>
                <input 
                  type="time"
                  name="time"
                  required
                  value={formData.time}
                  onChange={handleChange}
                  className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-3"
                />
              </div>
            </div>

            {demoType === 'ONLINE' && (
              <div>
                <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <Globe className="w-4 h-4 mr-2 text-indigo-500" /> Timezone
                </label>
                <input 
                  type="text"
                  name="timezone"
                  value={formData.timezone}
                  readOnly
                  className="w-full rounded-lg border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shadow-sm sm:text-sm p-3 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-slate-500">Auto-detected timezone</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">Meeting Details</h3>

            {demoType === 'OFFLINE' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    <Building className="w-4 h-4 mr-2 text-orange-500" /> Office Location
                  </label>
                  <select
                    name="officeLocation"
                    value={formData.officeLocation}
                    onChange={handleChange}
                    className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm p-3"
                  >
                    <option value="OneBridge Head Office, Hyderabad">OneBridge Head Office, Hyderabad</option>
                    <option value="Client Location">Your Office / Client Location</option>
                  </select>
                </div>
                {formData.officeLocation === 'Client Location' && (
                  <div>
                    <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      <MapPin className="w-4 h-4 mr-2 text-orange-500" /> Your Address
                    </label>
                    <input 
                      type="text"
                      name="customerAddress"
                      required
                      value={formData.customerAddress}
                      onChange={handleChange}
                      placeholder="Full Office Address"
                      className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm p-3"
                    />
                  </div>
                )}
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <Users className="w-4 h-4 mr-2 text-indigo-500" /> Number of Participants
                </label>
                <select
                  name="participants"
                  value={formData.participants}
                  onChange={handleChange}
                  className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-3"
                >
                  <option value="1">1 Person (Just me)</option>
                  <option value="2-3">2-3 People</option>
                  <option value="4+">4+ People (Full Team)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                <Target className="w-4 h-4 mr-2 text-indigo-500" /> Purpose / Key Topics
              </label>
              <textarea 
                name="purpose"
                required
                value={formData.purpose}
                onChange={handleChange}
                className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-3"
                rows={3}
                placeholder="What specific features or solutions do you want to see?"
              />
            </div>
          </div>

          <div className="pt-6">
            <button
              type="submit"
              disabled={loading}
              className={`w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-xl shadow-sm text-lg font-medium text-white transition-all transform hover:scale-[1.01] disabled:opacity-70 disabled:cursor-not-allowed ${
                demoType === 'ONLINE' 
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:ring-indigo-500'
                  : 'bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 focus:ring-orange-500'
              } focus:outline-none focus:ring-2 focus:ring-offset-2`}
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Confirming Booking...
                </span>
              ) : (
                <span className="flex items-center">
                  <Send className="w-5 h-5 mr-2" />
                  Confirm Demo Booking
                </span>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default BookDemoPage;
