import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  User, KeyRound, Upload, ShieldCheck, Mail, Phone, CalendarDays, Award
} from 'lucide-react';

interface FullProfile {
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  bloodGroup: string;
  validity: string;
  signatureUrl?: string;
  profileImageUrl?: string;
  personalInfo?: {
    dob?: string;
    gender?: string;
    panCard?: string;
    aadharCard?: string;
  };
  professionalInfo?: {
    dateOfJoining?: string;
  };
  skills: string[];
}

export const Profile: React.FC = () => {
  const { user, updateUserCache } = useAuth();
  
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/me');
      setProfile(res.data.data.employee);
    } catch (err) {
      console.error('Failed to load profile details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess(null);
    setPasswordError(null);

    try {
      await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setPasswordSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setPasswordError(err.response?.data?.message || 'Password update failed');
    }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!profile || !e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('signature', file);

    try {
      const res = await api.post(`/employees/${profile.employeeId}/signature`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProfile({ ...profile, signatureUrl: res.data.data.signatureUrl });
      alert('Transparent signature uploaded successfully!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Signature upload failed');
    }
  };

  if (loading) {
    return <span className="w-8 h-8 rounded-full border-2 border-indigo-600/30 border-t-indigo-600 animate-spin mx-auto block mt-10" />;
  }

  if (!profile) return <p>Failed to load profile data.</p>;

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="font-extrabold text-2xl tracking-tight text-brand-950 dark:text-white">Profile Control</h1>
        <p className="text-xs text-brand-500 mt-1 font-semibold">Audit security parameters, change credentials, and manage signature fields</p>
      </div>

      {/* Grid: Details on left, change passwords on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Details Panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-xl space-y-6 text-left">
            <div className="flex items-center space-x-4 pb-6 border-b border-brand-100 dark:border-brand-900">
              <div className="w-16 h-16 rounded-2xl bg-brand-100 dark:bg-brand-900 overflow-hidden flex items-center justify-center border-2 border-indigo-600 shadow-md">
                {profile.profileImageUrl ? (
                  <img src={profile.profileImageUrl} alt="Staff pic" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-extrabold text-indigo-600 uppercase">{profile.firstName[0]}{profile.lastName[0]}</span>
                )}
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-brand-950 dark:text-white">{profile.firstName} {profile.lastName}</h3>
                <p className="text-[10px] text-brand-500 font-bold uppercase tracking-wider mt-0.5">{profile.designation} | {profile.department}</p>
                <p className="text-[9px] text-indigo-600 font-extrabold mt-1">Staff ID: {profile.employeeId}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <span className="text-brand-500">Email Address</span>
                <p className="text-brand-950 dark:text-white font-bold">{profile.email}</p>
              </div>
              <div className="space-y-1">
                <span className="text-brand-500">Phone Number</span>
                <p className="text-brand-950 dark:text-white">{profile.phone}</p>
              </div>
              <div className="space-y-1">
                <span className="text-brand-500">Date of Birth</span>
                <p className="text-brand-950 dark:text-white">
                  {profile.personalInfo?.dob ? new Date(profile.personalInfo.dob).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-brand-500">Date of Joining</span>
                <p className="text-brand-950 dark:text-white">
                  {profile.professionalInfo?.dateOfJoining ? new Date(profile.professionalInfo.dateOfJoining).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-brand-500">Blood Group</span>
                <p className="text-brand-950 dark:text-white font-bold">{profile.bloodGroup}</p>
              </div>
              <div className="space-y-1">
                <span className="text-brand-500">ID Validity</span>
                <p className="text-brand-950 dark:text-white">{new Date(profile.validity).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Skills */}
            {profile.skills.length > 0 && (
              <div className="space-y-2 pt-4 border-t border-brand-100 dark:border-brand-900">
                <span className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Professional Skills</span>
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((skill) => (
                    <span key={skill} className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Change Credentials & Signature section */}
        <div className="space-y-6">
          
          {/* Signature widget */}
          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-xl space-y-4">
            <h3 className="font-bold text-sm uppercase tracking-wider">Digital Signature</h3>
            <div className="p-4 bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-850 rounded-2xl flex flex-col items-center justify-center space-y-4">
              {profile.signatureUrl ? (
                <img src={profile.signatureUrl} alt="Staff digital signature" className="h-12 object-contain" />
              ) : (
                <p className="text-[10px] text-brand-400 font-bold">No Signature Uploaded</p>
              )}
              <label className="flex items-center space-x-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl cursor-pointer text-[10px] font-bold tracking-wide uppercase transition-all shadow-md">
                <Upload size={12} />
                <span>Upload Signature</span>
                <input
                  type="file"
                  accept="image/png"
                  onChange={handleSignatureUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Change Password */}
          <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-xl">
            <h3 className="font-bold text-sm uppercase tracking-wider mb-6">Security Credentials</h3>

            {passwordSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl font-bold">
                {passwordSuccess}
              </div>
            )}
            {passwordError && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl font-bold">
                {passwordError}
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4 text-left text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Current Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">New Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-600"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 font-bold text-xs uppercase shadow-md flex items-center justify-center space-x-1.5"
              >
                <ShieldCheck size={14} />
                <span>Change Password</span>
              </button>
            </form>
          </div>
        </div>

      </div>

    </div>
  );
};

export default Profile;
