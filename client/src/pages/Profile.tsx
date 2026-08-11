import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import {
  User, KeyRound, Upload, ShieldCheck, Mail, Phone, CalendarDays, Award, Edit3, X, Save, Copy, Download
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

const THEMES = [
  { id: 'orange', name: 'Sunset Flare', gradient: 'from-orange-500 to-rose-500', color: 'bg-orange-500' },
  { id: 'blue', name: 'Ocean Wave', gradient: 'from-cyan-500 to-indigo-600', color: 'bg-indigo-500' },
  { id: 'green', name: 'Aurora Forest', gradient: 'from-emerald-500 to-teal-600', color: 'bg-emerald-500' },
  { id: 'purple', name: 'Cosmic Dusk', gradient: 'from-purple-600 to-pink-500', color: 'bg-purple-600' },
  { id: 'dark', name: 'Midnight Metal', gradient: 'from-slate-700 to-brand-900', color: 'bg-slate-700' },
];

export const Profile: React.FC = () => {
  const { user, updateUserCache } = useAuth();
  
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Brand selection for signature
  const [selectedBrand, setSelectedBrand] = useState<'onebridge' | 'golive'>('onebridge');

  // Edit fields
  const [isEditing, setIsEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBloodGroup, setEditBloodGroup] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editDepartment, setEditDepartment] = useState('');

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Profile theme
  const [profileTheme, setProfileTheme] = useState<string>(() => {
    return localStorage.getItem('profileTheme') || 'orange';
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/me');
      if (res.data.data.employee) {
        setProfile(res.data.data.employee);
      } else {
        const u = res.data.data.user;
        setProfile({
          employeeId: u.employeeId || 'SA-001',
          firstName: u.firstName || 'Super',
          lastName: u.lastName || 'Admin',
          email: u.email,
          phone: 'N/A',
          department: u.department || 'Administration',
          designation: u.designation || 'Super Administrator',
          bloodGroup: 'N/A',
          validity: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 5).toISOString(),
          signatureUrl: undefined,
          profileImageUrl: undefined,
          personalInfo: {
            dob: undefined,
            gender: 'N/A',
          },
          professionalInfo: {
            dateOfJoining: undefined,
          },
          skills: ['SYSTEM SECURITY', 'DATABASE MANAGEMENT', 'USER ROLES & PERMISSIONS'],
        });
      }
    } catch (err) {
      console.error('Failed to load profile details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = () => {
    if (!profile) return;
    setEditFirstName(profile.firstName);
    setEditLastName(profile.lastName);
    setEditPhone(profile.phone || '');
    setEditBloodGroup(profile.bloodGroup || '');
    setEditDesignation(profile.designation || '');
    setEditDepartment(profile.department || '');
    setIsEditing(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      await api.put(`/employees/${profile.employeeId}`, {
        firstName: editFirstName,
        lastName: editLastName,
        phone: editPhone,
        bloodGroup: editBloodGroup,
        designation: editDesignation,
        department: editDepartment,
      });

      setProfile({
        ...profile,
        firstName: editFirstName,
        lastName: editLastName,
        phone: editPhone,
        bloodGroup: editBloodGroup,
        designation: editDesignation,
        department: editDepartment,
      });

      updateUserCache({
        firstName: editFirstName,
        lastName: editLastName,
        designation: editDesignation,
        department: editDepartment,
      } as any);

      setIsEditing(false);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Profile update failed');
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

  const handleThemeSelect = (themeId: string) => {
    setProfileTheme(themeId);
    localStorage.setItem('profileTheme', themeId);
  };

  const copySignatureToClipboard = () => {
    const el = document.getElementById(selectedBrand === 'onebridge' ? 'profObCardWrapper' : 'profGlCardWrapper');
    if (!el) return;

    const range = document.createRange();
    range.selectNode(el);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    
    try {
      document.execCommand('copy');
      alert('Email signature copied to clipboard! You can now paste it directly into Outlook, Gmail, or Apple Mail.');
    } catch (err) {
      alert('Failed to copy signature automatically. Please select it manually.');
    }
    window.getSelection()?.removeAllRanges();
  };

  const downloadSignaturePng = () => {
    const el = document.getElementById(selectedBrand === 'onebridge' ? 'profObCardWrapper' : 'profGlCardWrapper');
    if (!el) return;

    html2canvas(el, {
      useCORS: true,
      scale: 2,
      backgroundColor: null,
    }).then((canvas) => {
      const link = document.createElement('a');
      link.download = `Signature-${profile?.firstName || 'Staff'}-${selectedBrand}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  };

  if (loading) {
    return <span className="w-8 h-8 rounded-full border-2 border-indigo-600/30 border-t-indigo-600 animate-spin mx-auto block mt-10" />;
  }

  if (!profile) return <p>Failed to load profile data.</p>;

  const activeTheme = THEMES.find(t => t.id === profileTheme) || THEMES[0];
  const obAddress = '#202, Sathyabama Complex, Bhagyanagar Colony, KPHB, Hyderabad, Telangana 500072';
  const glAddress = '3rd Floor, GoLive Plaza, Hitech City, Hyderabad - 500081';

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-extrabold text-2xl tracking-tight text-brand-950 dark:text-white">Profile Settings</h1>
          <p className="text-xs text-brand-500 mt-1 font-semibold">Customize profile attributes, security details, and signature configurations</p>
        </div>
        
        {/* Profile Theme Select widget */}
        <div className="flex items-center space-x-2 bg-brand-100/60 dark:bg-brand-900/60 p-2 rounded-2xl border border-brand-200 dark:border-brand-850">
          <span className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1 pr-1.5">Theme:</span>
          <div className="flex space-x-1.5">
            {THEMES.map((themeOption) => (
              <motion.button
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                key={themeOption.id}
                onClick={() => handleThemeSelect(themeOption.id)}
                className={`w-6 h-6 rounded-full cursor-pointer flex items-center justify-center border-2 ${themeOption.color} ${
                  profileTheme === themeOption.id ? 'border-indigo-600 dark:border-white scale-110 shadow-sm' : 'border-transparent opacity-80'
                }`}
                title={themeOption.name}
              >
                {profileTheme === themeOption.id && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid: Details on left, change passwords on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Details Panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-3xl overflow-hidden border border-brand-200 dark:border-brand-900 shadow-xl text-left relative">
            
            {/* Header Theme Banner */}
            <div className={`h-28 bg-gradient-to-r ${activeTheme.gradient} relative transition-all duration-500`}>
              <div className="absolute inset-0 bg-black/10" />
            </div>

            <div className="px-6 pb-6 -mt-10 relative z-10 space-y-6">
              <div className="flex items-end justify-between">
                <div className="flex items-end space-x-4">
                  <div className="w-20 h-20 rounded-2xl bg-brand-100 dark:bg-brand-950 overflow-hidden flex items-center justify-center border-4 border-white dark:border-brand-900 shadow-md">
                    {profile.profileImageUrl ? (
                      <img src={profile.profileImageUrl} alt="Staff pic" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-extrabold text-indigo-600 uppercase">{profile.firstName[0]}{profile.lastName[0]}</span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg text-brand-950 dark:text-white leading-tight">
                      {profile.firstName} {profile.lastName}
                    </h3>
                    <p className="text-[10px] text-brand-500 font-bold uppercase tracking-wider mt-1">{profile.designation} | {profile.department}</p>
                  </div>
                </div>

                {/* Edit Button */}
                {!isEditing && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleStartEdit}
                    className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-wide cursor-pointer transition-all shadow-md"
                  >
                    <Edit3 size={12} />
                    <span>Edit Profile</span>
                  </motion.button>
                )}
              </div>

              {/* Editable or Standard details */}
              <AnimatePresence mode="wait">
                {isEditing ? (
                  <motion.form 
                    key="edit-form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    onSubmit={handleSaveProfile} 
                    className="space-y-4 pt-4 border-t border-brand-100 dark:border-brand-900"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">First Name</label>
                        <input
                          type="text"
                          required
                          value={editFirstName}
                          onChange={(e) => setEditFirstName(e.target.value)}
                          className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 outline-none focus:border-indigo-600 text-brand-950 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Last Name</label>
                        <input
                          type="text"
                          required
                          value={editLastName}
                          onChange={(e) => setEditLastName(e.target.value)}
                          className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 outline-none focus:border-indigo-600 text-brand-950 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Designation</label>
                        <input
                          type="text"
                          required
                          value={editDesignation}
                          onChange={(e) => setEditDesignation(e.target.value)}
                          className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 outline-none focus:border-indigo-600 text-brand-950 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Department</label>
                        <input
                          type="text"
                          required
                          value={editDepartment}
                          onChange={(e) => setEditDepartment(e.target.value)}
                          className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 outline-none focus:border-indigo-600 text-brand-950 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Phone Number</label>
                        <input
                          type="text"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 outline-none focus:border-indigo-600 text-brand-950 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Blood Group</label>
                        <input
                          type="text"
                          value={editBloodGroup}
                          onChange={(e) => setEditBloodGroup(e.target.value)}
                          className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 outline-none focus:border-indigo-600 text-brand-950 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end space-x-2 pt-2">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="flex items-center space-x-1 px-3 py-2 bg-brand-100 hover:bg-brand-200 dark:bg-brand-900 dark:hover:bg-brand-800 text-brand-800 dark:text-brand-200 rounded-xl text-[10px] font-bold uppercase cursor-pointer"
                      >
                        <X size={12} />
                        <span>Cancel</span>
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        type="submit"
                        className="flex items-center space-x-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-bold uppercase cursor-pointer shadow-md"
                      >
                        <Save size={12} />
                        <span>Save Changes</span>
                      </motion.button>
                    </div>
                  </motion.form>
                ) : (
                  <motion.div 
                    key="detail-view"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-xs font-semibold pt-4 border-t border-brand-100 dark:border-brand-900"
                  >
                    <div className="space-y-1">
                      <span className="text-brand-500">Email Address</span>
                      <p className="text-brand-950 dark:text-white font-bold">{profile.email}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-brand-500">Phone Number</span>
                      <p className="text-brand-950 dark:text-white">{profile.phone || 'N/A'}</p>
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
                      <p className="text-brand-950 dark:text-white font-bold">{profile.bloodGroup || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-brand-500">ID Validity</span>
                      <p className="text-brand-950 dark:text-white">{new Date(profile.validity).toLocaleDateString()}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

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
                  className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-600 text-brand-950 dark:text-white"
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
                  className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 outline-none focus:border-indigo-600 text-brand-950 dark:text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 font-bold text-xs uppercase shadow-md flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <ShieldCheck size={14} />
                <span>Change Password</span>
              </button>
            </form>
          </div>
        </div>

      </div>

      {/* Corporate Email Signature section */}
      <div className="glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-brand-100 dark:border-brand-900 pb-4 gap-4">
          <div className="text-left">
            <h3 className="font-bold text-sm uppercase tracking-wider">Corporate Email Signature</h3>
            <p className="text-[10px] text-brand-500 font-semibold mt-0.5">Your email signature is automatically generated below. Copy or download it for your mail client.</p>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={() => setSelectedBrand('onebridge')}
              className={`px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
                selectedBrand === 'onebridge'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-brand-100 text-brand-600 dark:bg-brand-900 dark:text-brand-300 hover:bg-brand-200'
              }`}
            >
              OneBridge
            </button>
            <button
              onClick={() => setSelectedBrand('golive')}
              className={`px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
                selectedBrand === 'golive'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-brand-100 text-brand-600 dark:bg-brand-900 dark:text-brand-300 hover:bg-brand-200'
              }`}
            >
              GoLive
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center space-y-6">
          <div className="border border-brand-200 dark:border-brand-800 p-4 sm:p-8 rounded-3xl bg-brand-50/50 dark:bg-brand-950/20 max-w-full overflow-x-auto">
            {selectedBrand === 'onebridge' && (
              <div id="profObCardWrapper" className="select-all">
                <table cellPadding="0" cellSpacing="0" style={{
                  fontFamily: "'Inter', sans-serif",
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '28px 24px',
                  width: '660px',
                  minWidth: '640px',
                  position: 'relative',
                  textAlign: 'left',
                  boxShadow: '0 4px 10px rgba(0, 0, 0, 0.04)'
                }}>
                  <tbody>
                    <tr>
                      <td colSpan={3} style={{
                        height: '5px',
                        background: '#f37021',
                        borderRadius: '12px 12px 0 0',
                        padding: 0
                      }}></td>
                    </tr>
                    <tr><td colSpan={3} style={{ height: '24px' }}></td></tr>
                    <tr>
                      <td style={{
                        width: '190px',
                        verticalAlign: 'middle',
                        textAlign: 'center',
                        paddingRight: '16px'
                      }}>
                        <div style={{ height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                          <img src="/image.png" style={{ maxHeight: '100px', maxWidth: '170px', objectFit: 'contain' }} alt="OneBridge Logo" />
                        </div>
                        <div style={{ fontWeight: 900, fontSize: '20px', color: '#f37021', letterSpacing: '-0.01em', textTransform: 'uppercase', lineHeight: 1, fontFamily: "'Outfit', sans-serif" }}>
                          ONE<span style={{ color: '#202020' }}>BRIDGE</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '6px', marginBottom: '6px' }}>
                          <div style={{ height: '1.5px', width: '20px', background: '#f37021' }}></div>
                          <span style={{ fontSize: '8px', fontWeight: 800, color: '#202020', letterSpacing: '0.08em' }}>INFOTECH PVT. LTD.</span>
                          <div style={{ height: '1.5px', width: '20px', background: '#f37021' }}></div>
                        </div>
                        <div style={{ width: '120px', height: '1px', background: '#f37021', margin: '8px auto 10px auto' }}></div>
                        <p style={{ fontSize: '10px', fontWeight: 650, color: '#475569', margin: 0, fontFamily: "'Inter', sans-serif" }}>
                          Your Success. <span style={{ color: '#f37021' }}>Our Passion.</span>
                        </p>
                      </td>
                      <td style={{
                        borderLeft: '1px solid #cbd5e1',
                        paddingLeft: '24px',
                        paddingRight: '20px',
                        verticalAlign: 'middle',
                        width: '310px'
                      }}>
                        <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.02em', fontFamily: "'Outfit', sans-serif" }}>
                          {profile.firstName} {profile.lastName}
                        </h3>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#f37021', margin: '4px 0 0 0', fontFamily: "'Outfit', sans-serif" }}>
                          {profile.designation}
                        </p>
                        <div style={{ width: '70px', height: '2px', background: '#f37021', borderRadius: '9999px', marginTop: '6px', marginBottom: '14px' }}></div>
                        
                        <table cellPadding="0" cellSpacing="0" style={{ width: '100%' }}>
                          <tbody>
                            <tr>
                              <td style={{ width: '28px', paddingBottom: '8px' }}>
                                <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: '#FFF3EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f37021', fontSize: '10px' }}>
                                  ✉
                                </div>
                              </td>
                              <td style={{ fontSize: '11px', paddingBottom: '8px' }}>
                                <a href={`mailto:${profile.email}`} style={{ color: '#334155', fontWeight: 500, textDecoration: 'none' }}>
                                  {profile.email}
                                </a>
                              </td>
                            </tr>
                            <tr>
                              <td style={{ width: '28px', paddingBottom: '8px' }}>
                                <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: '#FFF3EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f37021', fontSize: '10px' }}>
                                  ☎
                                </div>
                              </td>
                              <td style={{ fontSize: '11px', paddingBottom: '8px' }}>
                                <a href={`tel:${profile.phone}`} style={{ color: '#334155', fontWeight: 500, textDecoration: 'none' }}>
                                  {profile.phone}
                                </a>
                              </td>
                            </tr>
                            <tr>
                              <td style={{ width: '28px', paddingBottom: '8px' }}>
                                <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: '#FFF3EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f37021', fontSize: '10px' }}>
                                  🌐
                                </div>
                              </td>
                              <td style={{ fontSize: '11px', paddingBottom: '8px' }}>
                                <a href="https://www.onebridgeinfotech.com" target="_blank" rel="noopener noreferrer" style={{ color: '#334155', fontWeight: 500, textDecoration: 'none' }}>
                                  www.onebridgeinfotech.com
                                </a>
                              </td>
                            </tr>
                            <tr>
                              <td style={{ width: '28px', verticalAlign: 'top' }}>
                                <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: '#FFF3EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f37021', fontSize: '10px', marginTop: '2px' }}>
                                  📍
                                </div>
                              </td>
                              <td style={{ fontSize: '10.5px', lineHeight: 1.35 }}>
                                <a href="https://maps.google.com/?q=202,+Sathyabama+Complex,+Bhagyanagar+Colony,+KPHB,+Hyderabad,+Telangana+500072" target="_blank" rel="noopener noreferrer" style={{ color: '#334155', fontWeight: 500, textDecoration: 'none' }}>
                                  {obAddress}
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                      <td style={{
                        borderLeft: '1px solid #cbd5e1',
                        paddingLeft: '20px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        width: '140px'
                      }}>
                        <div style={{ padding: '6px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#ffffff', display: 'inline-block', boxShadow: '0 4px 8px rgba(0,0,0,0.06)', marginBottom: '8px' }}>
                          <img src="/image copy.png" style={{ width: '85px', height: '85px', objectFit: 'contain' }} alt="Check-in QR" />
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: 600, color: '#475569', display: 'block', lineHeight: 1.3 }}>
                          Scan to Visit<br /><span style={{ fontWeight: 800, color: '#0f172a' }}>Our Website</span>
                        </span>
                        <div style={{ width: '22px', height: '2.5px', background: '#f37021', borderRadius: '9999px', margin: '6px auto 0 auto' }}></div>
                      </td>
                    </tr>
                    <tr><td colSpan={3} style={{ height: '20px' }}></td></tr>
                    <tr>
                      <td colSpan={3} style={{ borderBottom: '1px solid #cbd5e1', height: '1px', padding: 0 }}></td>
                    </tr>
                    <tr><td colSpan={3} style={{ height: '16px' }}></td></tr>
                    <tr>
                      <td colSpan={3}>
                        <table cellPadding="0" cellSpacing="0" style={{ width: '100%' }}>
                          <tbody>
                            <tr>
                              <td style={{ width: '190px', verticalAlign: 'middle', borderRight: '1px solid #cbd5e1', paddingRight: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1.5px solid #f37021', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
                                    <span style={{ color: '#f37021', fontSize: '16px', fontWeight: 'bold' }}>🛡</span>
                                  </div>
                                  <span style={{ fontSize: '9.5px', fontWeight: 800, color: '#f37021', letterSpacing: '0.04em' }}>CONFIDENTIALITY</span>
                                </div>
                              </td>
                              <td style={{ paddingLeft: '16px', fontSize: '9.5px', color: '#64748b', lineHeight: 1.4 }}>
                                This email and any attachments are confidential and intended solely for the named recipient. If you received this email in error, please notify the sender and delete it.
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {selectedBrand === 'golive' && (
              <div id="profGlCardWrapper" className="select-all">
                <table cellPadding="0" cellSpacing="0" style={{
                  fontFamily: "'Inter', sans-serif",
                  background: '#ffffff',
                  border: '1.5px solid #c7d7f8',
                  borderRadius: '12px',
                  padding: '24px',
                  width: '620px',
                  minWidth: '600px',
                  position: 'relative',
                  textAlign: 'left',
                  boxShadow: '0 12px 40px -8px rgba(0,82,204,0.12)'
                }}>
                  <tbody>
                    <tr>
                      <td colSpan={3} style={{
                        height: '4px',
                        background: 'linear-gradient(90deg, #1e40af 0%, #3b82f6 45%, #eab308 75%, #facc15 100%)',
                        borderRadius: '12px 12px 0 0',
                        padding: 0
                      }}></td>
                    </tr>
                    <tr><td colSpan={3} style={{ height: '16px' }}></td></tr>
                    <tr>
                      <td style={{
                        width: '180px',
                        verticalAlign: 'middle',
                        textAlign: 'center',
                        background: 'linear-gradient(160deg, #dbeafe 0%, #eff6ff 60%, #f0f9ff 100%)',
                        border: '1.5px solid #bfdbfe',
                        borderRadius: '12px',
                        padding: '16px 12px',
                        position: 'relative'
                      }}>
                        <div style={{ background: '#ffffff', border: '1.5px solid #dbeafe', borderRadius: '10px', padding: '6px', boxShadow: '0 2px 12px rgba(30,64,175,0.06)', marginBottom: '10px' }}>
                          <img src="/image-1784886273966.png" style={{ maxHeight: '80px', maxWidth: '130px', objectFit: 'contain' }} alt="GoLive Classes Logo" />
                        </div>
                        <div style={{ fontWeight: 900, fontSize: '18px', color: '#1e3a8a', fontFamily: "'Outfit', sans-serif", lineHeight: '1.1' }}>
                          GoLive <span style={{ color: '#d97706' }}>Classes</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '6px', marginBottom: '6px' }}>
                          <span style={{ fontSize: '8px', fontWeight: 800, color: '#1e40af', letterSpacing: '0.04em' }}>ACCELERATE LEARNING</span>
                        </div>
                        <div style={{ width: '80px', height: '1.5px', background: 'linear-gradient(90deg, #1e40af 0%, #eab308 100%)', margin: '8px auto' }}></div>
                      </td>
                      <td style={{
                        borderLeft: '2px solid #bfdbfe',
                        paddingLeft: '24px',
                        paddingRight: '16px',
                        verticalAlign: 'middle',
                        width: '280px'
                      }}>
                        <h3 style={{ fontSize: '21px', fontWeight: 800, color: '#0f172a', margin: 0, fontFamily: "'Outfit', sans-serif" }}>
                          {profile.firstName} {profile.lastName}
                        </h3>
                        <p style={{ fontSize: '12px', fontWeight: 700, color: '#1e40af', margin: '2px 0 0 0' }}>
                          {profile.designation}
                        </p>
                        <div style={{ width: '40px', height: '2.5px', background: 'linear-gradient(90deg, #1e40af 0%, #eab308 100%)', borderRadius: '9999px', margin: '8px 0 12px 0' }}></div>
                        
                        <table cellPadding="0" cellSpacing="0" style={{ width: '100%' }}>
                          <tbody>
                            <tr>
                              <td style={{ width: '28px', paddingBottom: '8px' }}>
                                <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24', fontSize: '9px' }}>
                                  ✉
                                </div>
                              </td>
                              <td style={{ fontSize: '11px', color: '#334155', fontWeight: 500, paddingBottom: '8px' }}>
                                {profile.email}
                              </td>
                            </tr>
                            <tr>
                              <td style={{ width: '28px', paddingBottom: '8px' }}>
                                <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24', fontSize: '9px' }}>
                                  ☎
                                </div>
                              </td>
                              <td style={{ fontSize: '11px', color: '#334155', fontWeight: 500, paddingBottom: '8px' }}>
                                {profile.phone}
                              </td>
                            </tr>
                            <tr>
                              <td style={{ width: '28px', paddingBottom: '8px' }}>
                                <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24', fontSize: '9px' }}>
                                  🌐
                                </div>
                              </td>
                              <td style={{ fontSize: '11px', color: '#334155', fontWeight: 500, paddingBottom: '8px' }}>
                                www.goliveclasses.co
                              </td>
                            </tr>
                            <tr>
                              <td style={{ width: '28px', verticalAlign: 'top' }}>
                                <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24', fontSize: '9px', marginTop: '2px' }}>
                                  📍
                                </div>
                              </td>
                              <td style={{ fontSize: '10.5px', color: '#334155', fontWeight: 500, lineHeight: 1.3 }}>
                                {glAddress}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                      <td style={{
                        borderLeft: '2px solid #bfdbfe',
                        paddingLeft: '20px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        width: '140px'
                      }}>
                        <div style={{ padding: '6px', border: '2px solid #0052cc', borderRadius: '12px', background: 'linear-gradient(135deg, #f0f4ff, #e8eeff)', display: 'inline-block', boxShadow: '0 4px 14px rgba(0, 82, 204, 0.15)', marginBottom: '8px' }}>
                          <img src="/GoLiveClasses_QR_Code.png" style={{ width: '85px', height: '85px', objectFit: 'contain' }} alt="GoLive QR" />
                        </div>
                        <span style={{ fontSize: '9px', fontWeight: 605, color: '#475569', display: 'block', lineHeight: 1.2 }}>
                          Scan to check<br /><span style={{ fontWeight: 800, color: '#00173d' }}>Live Profile</span>
                        </span>
                        <div style={{ width: '20px', height: '2px', background: '#0052cc', borderRadius: '9999px', margin: '6px auto 0 auto' }}></div>
                      </td>
                    </tr>
                    <tr><td colSpan={3} style={{ height: '16px' }}></td></tr>
                    <tr>
                      <td colSpan={3} style={{ borderBottom: '1px solid #bfdbfe', height: '1px', padding: 0 }}></td>
                    </tr>
                    <tr><td colSpan={3} style={{ height: '12px' }}></td></tr>
                    <tr>
                      <td colSpan={3}>
                        <table cellPadding="0" cellSpacing="0" style={{ width: '100%' }}>
                          <tbody>
                            <tr>
                              <td style={{ width: '160px', verticalAlign: 'middle', borderRight: '1px solid #bfdbfe', paddingRight: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: 'linear-gradient(135deg, #00173d, #0052cc)', color: '#facc15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 'bold' }}>
                                    🛡
                                  </div>
                                  <span style={{ fontSize: '9px', fontWeight: 800, color: '#0052cc', letterSpacing: '0.04em' }}>CONFIDENTIAL</span>
                                </div>
                              </td>
                              <td style={{ paddingLeft: '16px', fontSize: '9px', color: '#64748b', lineHeight: 1.4 }}>
                                This email and any attachments are confidential and intended solely for the named recipient. If you received this email in error, please notify the sender and delete it.
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-4 justify-center">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={copySignatureToClipboard}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl px-6 py-3 font-bold text-xs uppercase tracking-wider shadow-lg flex items-center space-x-2 cursor-pointer"
            >
              <Copy size={16} />
              <span>Copy HTML Signature</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={downloadSignaturePng}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl px-6 py-3 font-bold text-xs uppercase tracking-wider shadow-lg flex items-center space-x-2 cursor-pointer"
            >
              <Download size={16} />
              <span>Download PNG Signature</span>
            </motion.button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Profile;
