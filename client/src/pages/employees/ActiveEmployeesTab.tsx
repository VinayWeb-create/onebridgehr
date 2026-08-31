import { useDialog } from '../../context/DialogContext';
import { useAuth } from '../../context/AuthContext';
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  Search, Plus, UserPlus, Eye, Edit2, Upload, FileText, X, Check, Trash2, CalendarDays,
  Lock, Key, Shield, DollarSign, Mail, Phone, UserCheck, AlertCircle, Building2, MapPin
} from 'lucide-react';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { saveAs } from 'file-saver';

interface Employee {
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  role?: string;
  phone: string;
  department: string;
  designation: string;
  bloodGroup: string;
  validity: string;
  currentAddress?: string;
  permanentAddress?: string;
  qrCodeUrl?: string;
  profileImageUrl?: string;
  signatureUrl?: string;
  personalInfo?: {
    dob?: string;
    gender?: string;
    panCard?: string;
    aadharCard?: string;
  };
  professionalInfo?: {
    dateOfJoining?: string;
  };
  rating?: number | { overallScore?: number; [key: string]: any };
}

export const Employees: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isHr = user?.role === 'HR';
  const isPrivileged = isSuperAdmin || isHr;
  const { alert, confirm } = useDialog();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal / Drawer control
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [createdEmp, setCreatedEmp] = useState<any>(null);

  // Edit Employee State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editEmp, setEditEmp] = useState<any>(null);

  // Profile Drawer State
  const [activeProfileTab, setActiveProfileTab] = useState('details');
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [employeeDocs, setEmployeeDocs] = useState<any[]>([]);

  useEffect(() => {
    if (selectedEmp) {
      setActiveProfileTab('details');
      api.get(`/hr-docs/timeline/${selectedEmp.employeeId}`).then((res: any) => {
        setTimelineEvents(res.data.data);
      }).catch(console.error);
      
      api.get(`/hr-docs/documents?employeeId=${selectedEmp.employeeId}`).then((res: any) => {
        setEmployeeDocs(res.data.data);
      }).catch(console.error);
    }
  }, [selectedEmp]);

  // New Employee Form State
  const [newEmp, setNewEmp] = useState({
    employeeId: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    department: 'Engineering',
    designation: 'Software Engineer',
    bloodGroup: 'O+',
    validity: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0], // 1 year default validity
    role: 'EMPLOYEE',
    dob: '1995-01-01',
    gender: 'Male',
    panCard: '',
    aadharCard: '',
    currentAddress: '',
    permanentAddress: '',
    dateOfJoining: new Date().toISOString().split('T')[0],
    emergencyName: '',
    emergencyRelationship: '',
    emergencyPhone: '',
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async (query = '') => {
    setLoading(true);
    try {
      const url = query ? `/reports/search?query=${query}` : '/employees';
      const res = await api.get(url);
      const rawData = query ? res.data.data.employees : res.data.data;
      const filtered = (rawData || []).filter((e: any) => !['OBI0001', 'OBI1117'].includes(e.employeeId));
      setEmployees(filtered);
    } catch (err) {
      console.error('Failed to load employee records:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEmployees(searchQuery);
  };

  const handleOpenAddModal = () => {
    let nextNum = 6;
    if (employees.length > 0) {
      const maxNum = Math.max(
        0,
        ...employees
          .map(e => parseInt(e.employeeId.replace('OBI', ''), 10))
          .filter(n => !isNaN(n) && n >= 6 && n < 1000)
      );
      if (maxNum >= 6) {
        nextNum = maxNum + 1;
      }
    }
    setNewEmp(prev => ({ ...prev, employeeId: `OBI${String(nextNum).padStart(4, '0')}` }));
    setShowAddModal(true);
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        employeeId: newEmp.employeeId,
        firstName: newEmp.firstName,
        lastName: newEmp.lastName,
        email: newEmp.email,
        phone: newEmp.phone,
        department: newEmp.department,
        designation: newEmp.designation,
        bloodGroup: newEmp.bloodGroup,
        validity: new Date(newEmp.validity),
        role: newEmp.role,
        currentAddress: newEmp.currentAddress || undefined,
        permanentAddress: newEmp.permanentAddress || undefined,
        personalInfo: {
          dob: new Date(newEmp.dob),
          gender: newEmp.gender,
          panCard: newEmp.panCard || undefined,
          aadharCard: newEmp.aadharCard || undefined,
        },
        professionalInfo: {
          dateOfJoining: new Date(newEmp.dateOfJoining),
        },
      };

      if (newEmp.emergencyName.trim() && newEmp.emergencyPhone.trim() && newEmp.emergencyRelationship.trim()) {
        payload.emergencyContact = {
          name: newEmp.emergencyName,
          relationship: newEmp.emergencyRelationship,
          phone: newEmp.emergencyPhone,
        };
      }

      await api.post('/employees', payload);
      setCreatedEmp({
        ...payload,
        firstName: newEmp.firstName,
        lastName: newEmp.lastName,
        designation: newEmp.designation,
        dateOfJoining: newEmp.dateOfJoining,
      });
      setShowAddModal(false);
      setShowSuccessPopup(true);
      // Reset form
      setNewEmp({
        employeeId: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        department: 'Engineering',
        designation: 'Software Engineer',
        bloodGroup: 'O+',
        validity: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
        role: 'EMPLOYEE',
        dob: '1995-01-01',
        gender: 'Male',
        panCard: '',
        aadharCard: '',
        currentAddress: '',
        permanentAddress: '',
        dateOfJoining: new Date().toISOString().split('T')[0],
        emergencyName: '',
        emergencyRelationship: '',
        emergencyPhone: '',
      });
      fetchEmployees();
    } catch (err: any) {
      alert({ title: 'Error', message: err.response?.data?.message || 'Failed to register employee', variant: 'error' });
    }
  };

  const openEditModal = (emp: any) => {
    setEditEmp({
      employeeId: emp.employeeId,
      firstName: emp.firstName || '',
      lastName: emp.lastName || '',
      email: emp.email || '',
      password: '',
      role: emp.role || 'EMPLOYEE',
      phone: emp.phone || '',
      department: emp.department || '',
      designation: emp.designation || '',
      bloodGroup: emp.bloodGroup || 'O+',
      validity: emp.validity ? new Date(emp.validity).toISOString().split('T')[0] : '',
      gender: emp.personalInfo?.gender || 'Male',
      dob: emp.personalInfo?.dob ? new Date(emp.personalInfo.dob).toISOString().split('T')[0] : '1995-01-01',
      panCard: emp.personalInfo?.panCard || '',
      aadharCard: emp.personalInfo?.aadharCard || '',
      currentAddress: emp.currentAddress || '',
      permanentAddress: emp.permanentAddress || '',
      dateOfJoining: emp.professionalInfo?.dateOfJoining ? new Date(emp.professionalInfo.dateOfJoining).toISOString().split('T')[0] : '',
      emergencyName: emp.emergencyContact?.name || '',
      emergencyRelationship: emp.emergencyContact?.relationship || '',
      emergencyPhone: emp.emergencyContact?.phone || '',
      basicSalary: emp.salaryStructure?.basic || 0,
      hra: emp.salaryStructure?.hra || 0,
      allowance: emp.salaryStructure?.allowance || 0,
    });
    setShowEditModal(true);
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        firstName: editEmp.firstName,
        lastName: editEmp.lastName,
        email: editEmp.email,
        phone: editEmp.phone,
        department: editEmp.department,
        designation: editEmp.designation,
        bloodGroup: editEmp.bloodGroup,
        validity: editEmp.validity ? new Date(editEmp.validity) : undefined,
        currentAddress: editEmp.currentAddress,
        permanentAddress: editEmp.permanentAddress,
        personalInfo: {
          dob: editEmp.dob ? new Date(editEmp.dob) : new Date('1995-01-01'),
          gender: editEmp.gender,
          panCard: editEmp.panCard,
          aadharCard: editEmp.aadharCard,
        },
        professionalInfo: {
          dateOfJoining: editEmp.dateOfJoining ? new Date(editEmp.dateOfJoining) : new Date(),
        },
        emergencyContact: {
          name: editEmp.emergencyName || 'N/A',
          relationship: editEmp.emergencyRelationship || 'Family',
          phone: editEmp.emergencyPhone || editEmp.phone || '0000000000',
        },
      };

      if (editEmp.role) {
        payload.role = editEmp.role;
      }
      if (editEmp.password && editEmp.password.trim() !== '') {
        payload.password = editEmp.password.trim();
      }
      if (editEmp.basicSalary || editEmp.hra || editEmp.allowance) {
        payload.salaryStructure = {
          basic: Number(editEmp.basicSalary) || 0,
          hra: Number(editEmp.hra) || 0,
          da: 0,
          allowance: Number(editEmp.allowance) || 0,
          bonus: 0,
          pf: 0,
          esi: 0,
          professionalTax: 0,
          incomeTax: 0,
        };
      }

      await api.put(`/employees/${editEmp.employeeId}`, payload);
      setShowEditModal(false);
      setEditEmp(null);
      await fetchEmployees();
      alert({ title: 'Success', message: `Full profile and credentials updated successfully for ${editEmp.firstName} ${editEmp.lastName}`, variant: 'info' });
    } catch (err: any) {
      alert({ title: 'Error', message: err.response?.data?.message || 'Failed to update employee', variant: 'error' });
    }
  };

  const handleGenerateOfferLetter = async () => {
    if (!createdEmp) return;
    try {
      const response = await fetch('/Onebridge-Internship-Offer-Letter.docx');
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as ArrayBuffer;
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
        });

        doc.render({
          firstName: createdEmp.firstName,
          lastName: createdEmp.lastName,
          designation: createdEmp.designation,
          dateOfJoining: new Date(createdEmp.dateOfJoining).toLocaleDateString(),
          name: `${createdEmp.firstName} ${createdEmp.lastName}`,
          date: new Date().toLocaleDateString(),
        });

        const out = doc.getZip().generate({
          type: 'blob',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        saveAs(out, `Offer_Letter_${createdEmp.firstName}_${createdEmp.lastName}.docx`);
      };
      reader.readAsArrayBuffer(blob);
    } catch (error) {
      console.error('Error generating document:', error);
      alert({ title: 'Notification', message: 'Failed to generate offer letter.', variant: 'info' });
    }
  };

  const handleDeleteEmployee = async (employeeId: string) => {
    if (!window.confirm('Are you sure you want to delete this employee? This action cannot be undone.')) {
      return;
    }
    try {
      await api.delete(`/employees/${employeeId}`);
      alert({ title: 'Notification', message: 'Employee deleted successfully', variant: 'info' });
      fetchEmployees();
    } catch (err: any) {
      alert({ title: 'Error', message: err.response?.data?.message || 'Failed to delete employee', variant: 'error' });
    }
  };

  // Profile Image / Signature upload triggers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'profile-image' | 'signature') => {
    if (!selectedEmp || !e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append(type === 'signature' ? 'signature' : 'profileImage', file);

    try {
      const res = await api.post(`/employees/${selectedEmp.employeeId}/${type}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      alert({ title: 'Notification', message: 'Upload completed successfully!', variant: 'info' });
      // Update selected state
      if (type === 'signature') {
        setSelectedEmp({ ...selectedEmp, signatureUrl: res.data.data.signatureUrl });
      } else {
        setSelectedEmp({ ...selectedEmp, profileImageUrl: res.data.data.profileImageUrl });
      }
      fetchEmployees();
    } catch (err: any) {
      alert({ title: 'Error', message: err.response?.data?.message || 'File upload failed', variant: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-extrabold text-2xl tracking-tight text-brand-950 dark:text-white">Employees Directory</h1>
          <p className="text-xs text-brand-500 mt-1 font-semibold">Organize, onboard, and audit staff profiles</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl px-5 py-3 font-bold text-xs tracking-wider uppercase transition-all flex items-center space-x-2 shadow-lg shadow-indigo-600/20"
        >
          <UserPlus size={16} />
          <span>Onboard Employee</span>
        </button>
      </div>

      {/* Search and Filters */}
      <form onSubmit={handleSearch} className="flex space-x-4 max-w-lg">
        <div className="relative flex-1">
          <Search className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-brand-400 my-auto" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, email, name, skill..."
            className="w-full bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-2xl py-3 pl-11 pr-4 text-sm font-semibold outline-none focus:border-indigo-600 transition-all text-brand-950 dark:text-white shadow-sm"
          />
        </div>
        <button type="submit" className="bg-brand-900 text-white dark:bg-brand-200 dark:text-brand-950 rounded-2xl px-6 font-bold text-xs uppercase tracking-wider">
          Query
        </button>
      </form>

      {/* Directory Table */}
      <div className="glass rounded-3xl overflow-hidden border border-brand-200 dark:border-brand-900 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-brand-100/50 dark:bg-brand-900/50 text-[10px] font-bold text-brand-500 uppercase border-b border-brand-200 dark:border-brand-900">
                <th className="px-6 py-4">Employee ID</th>
                <th className="px-6 py-4">Full Name</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Designation</th>
                <th className="px-6 py-4">Blood Group</th>
                <th className="px-6 py-4">Validity</th>
                <th className="px-6 py-4">Rating</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100 dark:divide-brand-900 text-xs font-semibold">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-10">
                    <span className="w-6 h-6 rounded-full border-2 border-indigo-600/30 border-t-indigo-600 animate-spin inline-block" />
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-brand-500">No records found.</td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-brand-100/30 dark:hover:bg-brand-900/30 transition-all">
                    <td className="px-6 py-4 font-bold text-indigo-600 font-mono">{emp.employeeId}</td>
                    <td className="px-6 py-4 flex items-center space-x-3">
                      <div className="w-7 h-7 rounded-lg overflow-hidden bg-brand-200 dark:bg-brand-950 flex items-center justify-center border border-indigo-600/20">
                        {emp.profileImageUrl ? (
                          <img src={emp.profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <span className="uppercase text-[9px] font-bold text-indigo-600">{emp.firstName[0]}{emp.lastName[0]}</span>
                        )}
                      </div>
                      <span className="text-brand-950 dark:text-white font-bold">{emp.firstName} {emp.lastName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wider border ${
                        emp.role === 'SUPER_ADMIN'
                          ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                          : emp.role === 'HR'
                          ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                          : emp.role === 'TEAM_LEAD'
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                          : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      }`}>
                        {emp.role || 'EMPLOYEE'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-brand-600 dark:text-brand-400 font-semibold">{emp.department}</td>
                    <td className="px-6 py-4 font-medium">{emp.designation}</td>
                    <td className="px-6 py-4 font-bold text-brand-600">{emp.bloodGroup}</td>
                    <td className="px-6 py-4 text-brand-500">{new Date(emp.validity).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-1">
                        <span className="text-amber-500 font-extrabold text-xs">★</span>
                        <span className="text-brand-950 dark:text-white font-bold">{typeof emp.rating === 'number' ? emp.rating.toFixed(1) : (emp.rating && typeof emp.rating === 'object' && typeof emp.rating.overallScore === 'number' ? (emp.rating.overallScore / 20).toFixed(1) : '3.5')}/5.0</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setSelectedEmp(emp)}
                          className="p-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900 text-indigo-600 rounded-xl transition-all"
                          title="View Profile Details"
                        >
                          <Eye size={14} />
                        </button>

                        {/* Edit Button: Super Admins & HR can edit all staff; Team Leads can edit their department staff */}
                        {(() => {
                          const isRootAdmin = ['OBI0001', 'OBI1117'].includes(emp.employeeId);
                          if (isRootAdmin) return null;

                          const canEdit = isSuperAdmin || user?.role === 'HR' || 
                            (user?.role === 'TEAM_LEAD' && (
                              emp.department?.toLowerCase() === (employees.find(e => e.employeeId === user?.employeeId)?.department || '').toLowerCase() ||
                              emp.employeeId === user?.employeeId
                            ));

                          if (!canEdit) return null;

                          return (
                            <button
                              onClick={() => openEditModal(emp)}
                              className="p-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900 text-amber-600 rounded-xl transition-all"
                              title="Edit Employee Information"
                            >
                              <Edit2 size={14} />
                            </button>
                          );
                        })()}

                        {/* Delete Button: ONLY Super Admin and HR (Never Team Leads or Employees) */}
                        {(isSuperAdmin || user?.role === 'HR') && !['OBI0001', 'OBI1117'].includes(emp.employeeId) && (
                          <button
                            onClick={() => handleDeleteEmployee(emp.employeeId)}
                            className="p-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900 text-red-600 rounded-xl transition-all"
                            title="Delete Employee"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- ADD NEW EMPLOYEE MODAL (Onboarding Wizard) --- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-brand-950/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-2xl glass rounded-3xl border border-brand-200 dark:border-brand-900 shadow-2xl p-6 md:p-8 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-brand-200 dark:border-brand-900">
              <h2 className="font-extrabold text-lg">Onboard New Employee</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="mt-6 space-y-6 text-left">
              {/* Profile Block */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">1. Basic Info</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Employee ID</label>
                    <input
                      type="text"
                      required
                      placeholder="OBI0006"
                      value={newEmp.employeeId}
                      onChange={(e) => setNewEmp({ ...newEmp, employeeId: e.target.value.toUpperCase() })}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600 font-bold text-indigo-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="name@onebridge.com"
                      value={newEmp.email}
                      onChange={(e) => setNewEmp({ ...newEmp, email: e.target.value })}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">First Name</label>
                    <input
                      type="text"
                      required
                      value={newEmp.firstName}
                      onChange={(e) => setNewEmp({ ...newEmp, firstName: e.target.value })}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Last Name</label>
                    <input
                      type="text"
                      required
                      value={newEmp.lastName}
                      onChange={(e) => setNewEmp({ ...newEmp, lastName: e.target.value })}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Phone Number</label>
                    <input
                      type="text"
                      required
                      value={newEmp.phone}
                      onChange={(e) => setNewEmp({ ...newEmp, phone: e.target.value })}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Role Type</label>
                    <select
                      value={newEmp.role}
                      onChange={(e) => setNewEmp({ ...newEmp, role: e.target.value })}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600 text-brand-950 dark:text-white"
                    >
                      <option value="EMPLOYEE">Employee</option>
                      <option value="TEAM_LEAD">Team Lead</option>
                      <option value="HR">HR Manager</option>
                      <option value="SUPER_ADMIN">Super Admin</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Department Block */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">2. Corporate Placement</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Department</label>
                    <input
                      type="text"
                      required
                      value={newEmp.department}
                      onChange={(e) => setNewEmp({ ...newEmp, department: e.target.value })}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Designation</label>
                    <input
                      type="text"
                      required
                      value={newEmp.designation}
                      onChange={(e) => setNewEmp({ ...newEmp, designation: e.target.value })}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Date of Joining</label>
                    <input
                      type="date"
                      required
                      value={newEmp.dateOfJoining}
                      onChange={(e) => setNewEmp({ ...newEmp, dateOfJoining: e.target.value })}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">ID Card Validity</label>
                    <input
                      type="date"
                      required
                      value={newEmp.validity}
                      onChange={(e) => setNewEmp({ ...newEmp, validity: e.target.value })}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>
              </div>

              {/* Personal Block */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">3. Personal & Compliance</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Date of Birth</label>
                    <input
                      type="date"
                      required
                      value={newEmp.dob}
                      onChange={(e) => setNewEmp({ ...newEmp, dob: e.target.value })}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Gender</label>
                    <select
                      value={newEmp.gender}
                      onChange={(e) => setNewEmp({ ...newEmp, gender: e.target.value })}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600 text-brand-950 dark:text-white"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Blood Group</label>
                    <input
                      type="text"
                      required
                      placeholder="O+"
                      value={newEmp.bloodGroup}
                      onChange={(e) => setNewEmp({ ...newEmp, bloodGroup: e.target.value })}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">PAN Card</label>
                    <input
                      type="text"
                      placeholder="ABCDE1234F"
                      value={newEmp.panCard}
                      onChange={(e) => setNewEmp({ ...newEmp, panCard: e.target.value })}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Aadhar Card</label>
                    <input
                      type="text"
                      placeholder="12-digit number"
                      value={newEmp.aadharCard}
                      onChange={(e) => setNewEmp({ ...newEmp, aadharCard: e.target.value })}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Current Address</label>
                    <input
                      type="text"
                      placeholder="Street, area, city, state, PIN"
                      value={newEmp.currentAddress}
                      onChange={(e) => setNewEmp({ ...newEmp, currentAddress: e.target.value })}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Permanent Address</label>
                    <input
                      type="text"
                      placeholder="Street, area, city, state, PIN"
                      value={newEmp.permanentAddress}
                      onChange={(e) => setNewEmp({ ...newEmp, permanentAddress: e.target.value })}
                      className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-brand-200 dark:border-brand-900 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="bg-brand-200 text-brand-850 dark:bg-brand-900 dark:text-white rounded-xl px-5 py-2.5 font-bold text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6 py-2.5 font-bold text-xs uppercase shadow-md shadow-indigo-600/10"
                >
                  Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EMPLOYEE PROFILE DETAILS VIEW DRAWER --- */}
      {selectedEmp && (
        <div className="fixed inset-0 z-50 bg-brand-950/40 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-white dark:bg-brand-950 border-l border-brand-200 dark:border-brand-900 h-full p-6 shadow-2xl overflow-y-auto flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center pb-4 border-b border-brand-200 dark:border-brand-900">
                <h2 className="font-extrabold text-md">Employee File: {selectedEmp.employeeId}</h2>
                <button onClick={() => setSelectedEmp(null)} className="p-1 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900">
                  <X size={18} />
                </button>
              </div>

              {/* Profile Card Header */}
              <div className="text-center py-6 border-b border-brand-200 dark:border-brand-900">
                <div className="relative w-20 h-20 mx-auto group">
                  <div className="w-full h-full rounded-2xl overflow-hidden bg-brand-100 dark:bg-brand-900 flex items-center justify-center border-2 border-indigo-600 shadow-md">
                    {selectedEmp.profileImageUrl ? (
                      <img src={selectedEmp.profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-bold text-indigo-600 uppercase">
                        {selectedEmp.firstName[0]}{selectedEmp.lastName[0]}
                      </span>
                    )}
                  </div>
                  {/* Photo upload trigger */}
                  <label className="absolute -bottom-1.5 -right-1.5 p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer shadow-md">
                    <Upload size={12} />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'profile-image')}
                      className="hidden"
                    />
                  </label>
                </div>
                <h3 className="font-extrabold text-sm text-brand-950 dark:text-white mt-3">
                  {selectedEmp.firstName} {selectedEmp.lastName}
                </h3>
                <p className="text-[10px] font-bold text-brand-500 uppercase tracking-wider">{selectedEmp.designation} | {selectedEmp.department}</p>
              </div>

              <div className="flex border-b border-brand-200 dark:border-brand-900">
                <button
                  onClick={() => setActiveProfileTab('details')}
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeProfileTab === 'details' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-brand-500 hover:text-brand-700'}`}
                >
                  Details
                </button>
                <button
                  onClick={() => setActiveProfileTab('timeline')}
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeProfileTab === 'timeline' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-brand-500 hover:text-brand-700'}`}
                >
                  Timeline
                </button>
                <button
                  onClick={() => setActiveProfileTab('documents')}
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeProfileTab === 'documents' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-brand-500 hover:text-brand-700'}`}
                >
                  Documents
                </button>
              </div>

              {activeProfileTab === 'details' ? (
              <div className="py-6 space-y-4 text-xs font-semibold">
                <div className="flex justify-between py-1 border-b border-brand-100 dark:border-brand-900">
                  <span className="text-brand-500">Email Address</span>
                  <span className="text-brand-950 dark:text-white font-bold">{selectedEmp.email}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-brand-100 dark:border-brand-900">
                  <span className="text-brand-500">Phone Number</span>
                  <span className="text-brand-950 dark:text-white">{selectedEmp.phone}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-brand-100 dark:border-brand-900">
                  <span className="text-brand-500">Gender</span>
                  <span className="text-brand-950 dark:text-white">{selectedEmp.personalInfo?.gender || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-brand-100 dark:border-brand-900">
                  <span className="text-brand-500">Blood Group</span>
                  <span className="text-brand-950 dark:text-white font-bold">{selectedEmp.bloodGroup}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-brand-100 dark:border-brand-900">
                  <span className="text-brand-500">PAN Card No.</span>
                  <span className="text-brand-950 dark:text-white uppercase font-bold">{selectedEmp.personalInfo?.panCard || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-brand-100 dark:border-brand-900">
                  <span className="text-brand-500">Aadhar Number</span>
                  <span className="text-brand-950 dark:text-white font-bold">{selectedEmp.personalInfo?.aadharCard || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-brand-100 dark:border-brand-900">
                  <span className="text-brand-500">Current Address</span>
                  <span className="text-brand-950 dark:text-white text-right">{selectedEmp.currentAddress || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-brand-100 dark:border-brand-900">
                  <span className="text-brand-500">Permanent Address</span>
                  <span className="text-brand-950 dark:text-white text-right">{selectedEmp.permanentAddress || 'N/A'}</span>
                </div>

                {/* Digital Signature upload section */}
                <div className="pt-4 space-y-2">
                  <h4 className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Digital Signature (Transparent PNG, max 2MB)</h4>
                  <div className="p-4 bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-2xl flex flex-col items-center justify-center space-y-3 relative group">
                    {selectedEmp.signatureUrl ? (
                      <img src={selectedEmp.signatureUrl} alt="Digital Signature" className="h-12 object-contain" />
                    ) : (
                      <p className="text-[10px] text-brand-400 font-bold">No Signature Uploaded</p>
                    )}
                    <label className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer text-[10px] font-bold tracking-wide uppercase transition-all shadow-md">
                      <Upload size={10} />
                      <span>{selectedEmp.signatureUrl ? 'Re-upload signature' : 'Upload signature'}</span>
                      <input
                        type="file"
                        accept="image/png"
                        onChange={(e) => handleFileUpload(e, 'signature')}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Profile QR verification preview */}
                {selectedEmp.qrCodeUrl && (
                  <div className="pt-4 space-y-2 flex flex-col items-center">
                    <h4 className="text-[10px] font-bold text-brand-500 uppercase tracking-wider self-start pl-1">Employee Profile QR</h4>
                    <div className="p-3 bg-white border border-brand-200 dark:border-brand-800 rounded-2xl w-32 h-32 flex items-center justify-center shadow-md">
                      <img src={selectedEmp.qrCodeUrl} alt="Employee Profile QR" className="w-full h-full object-contain" />
                    </div>
                    <a
                      href={selectedEmp.qrCodeUrl}
                      download={`QR-${selectedEmp.employeeId}.png`}
                      className="text-[10px] text-indigo-600 font-bold hover:underline mt-2 flex items-center space-x-1"
                    >
                      <Plus size={10} />
                      <span>Download QR PNG</span>
                    </a>
                  </div>
                )}
              </div>
              ) : activeProfileTab === 'timeline' ? (
                <div className="py-6 space-y-6">
                  {timelineEvents.length === 0 ? (
                    <p className="text-center text-xs text-brand-500">No timeline events found.</p>
                  ) : (
                    <div className="relative border-l-2 border-indigo-200 dark:border-indigo-900/50 ml-3 space-y-6">
                      {timelineEvents.map((event, idx) => (
                        <div key={idx} className="relative pl-6">
                          <span className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-indigo-600 border-4 border-white dark:border-brand-950" />
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                              {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <h4 className="text-sm font-extrabold text-brand-950 dark:text-white mt-0.5">{event.title}</h4>
                            <p className="text-xs text-brand-600 dark:text-brand-400 mt-1 leading-relaxed">{event.description}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {event.eventType === 'JOINED' && (
                                <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[9px] font-bold uppercase">Onboarded</span>
                              )}
                              {event.eventType === 'PROMOTION' && (
                                <span className="inline-block px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-[9px] font-bold uppercase">Promotion</span>
                              )}
                              {event.eventType === 'SALARY_UPDATE' && (
                                <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-[9px] font-bold uppercase">Salary Update</span>
                              )}
                              {event.eventType === 'LEAVE' && (
                                <span className="inline-block px-2 py-0.5 rounded bg-orange-100 text-orange-700 text-[9px] font-bold uppercase">Leave</span>
                              )}
                              {event.eventType === 'WARNING' && (
                                <span className="inline-block px-2 py-0.5 rounded bg-red-100 text-red-700 text-[9px] font-bold uppercase">Warning Issued</span>
                              )}
                              {event.eventType === 'PERFORMANCE_REVIEW' && (
                                <span className="inline-block px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[9px] font-bold uppercase">Performance Review</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-6 space-y-4">
                  {employeeDocs.length === 0 ? (
                    <p className="text-center text-xs text-brand-500">No documents found.</p>
                  ) : (
                    employeeDocs.map((doc, idx) => (
                      <div key={idx} className="p-4 bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-2xl flex items-center justify-between group hover:shadow-md transition-all">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600">
                            <FileText size={18} />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-brand-950 dark:text-white">{doc.title}</h4>
                            <p className="text-[10px] text-brand-500 uppercase font-semibold tracking-wider mt-0.5">
                              {doc.documentType.replace(/_/g, ' ')} • {new Date(doc.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {doc.fileUrl && (
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-white dark:bg-brand-800 border border-brand-200 dark:border-brand-700 rounded-lg text-brand-500 hover:text-indigo-600 hover:border-indigo-600 transition-colors shadow-sm">
                            <Eye size={14} />
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-brand-200 dark:border-brand-900">
              <button
                onClick={() => setSelectedEmp(null)}
                className="w-full bg-brand-900 text-white dark:bg-brand-200 dark:text-brand-950 py-3 rounded-xl font-bold uppercase tracking-wider text-xs"
              >
                Close File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- EDIT EMPLOYEE MODAL (FULL EDIT FOR SUPER ADMINS, LOCKED EMPLOYEE ID) --- */}
      {showEditModal && editEmp && (
        <div className="fixed inset-0 z-50 bg-brand-950/60 backdrop-blur-md flex items-center justify-center p-4 md:p-6">
          <div className="w-full max-w-3xl glass rounded-3xl border border-brand-200 dark:border-brand-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-brand-200 dark:border-brand-800 flex justify-between items-center bg-brand-50/50 dark:bg-brand-900/30">
              <div>
                <h2 className="font-extrabold text-base text-brand-950 dark:text-white flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-md">
                    <Edit2 size={14} />
                  </div>
                  Edit Employee Information
                </h2>
                <p className="text-xs text-brand-500 font-medium mt-1">
                  Update credentials, roles, profile, job specifications, and compensation details
                </p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-2 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-900 text-brand-500 transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateEmployee} className="p-6 space-y-6 text-left text-xs font-semibold overflow-y-auto flex-1">
              
              {/* IMMUTABLE EMPLOYEE ID BANNER */}
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Lock size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">Employee ID:</span>
                      <span className="px-2.5 py-0.5 rounded-lg bg-white dark:bg-brand-900 border border-amber-300 dark:border-amber-700 text-xs font-black text-brand-950 dark:text-white font-mono">
                        {editEmp.employeeId}
                      </span>
                    </div>
                    <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                      🔒 Permanent System Identifier (Immutable — Cannot be changed by anyone, including Super Admins)
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-[10px] font-extrabold uppercase shrink-0">
                  Locked
                </span>
              </div>

              {/* 1. LOGIN CREDENTIALS & SYSTEM ROLE */}
              <div className="space-y-3 bg-brand-50/40 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-2xl p-4">
                <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Key size={13} /> Account Login Credentials & Role
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1 flex items-center gap-1">
                      <Mail size={10} /> Login Email / Username *
                    </label>
                    <input
                      type="email"
                      required
                      value={editEmp.email}
                      onChange={e => setEditEmp({ ...editEmp, email: e.target.value })}
                      className="w-full bg-white dark:bg-brand-900/70 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 text-xs outline-none focus:border-indigo-500 text-brand-950 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1 flex items-center gap-1">
                      <Shield size={10} /> Change Password
                    </label>
                    <input
                      type="password"
                      placeholder="Leave blank to keep same"
                      value={editEmp.password}
                      onChange={e => setEditEmp({ ...editEmp, password: e.target.value })}
                      className="w-full bg-white dark:bg-brand-900/70 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 text-xs outline-none focus:border-indigo-500 text-brand-950 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1 flex items-center gap-1">
                      <UserCheck size={10} /> System Role
                    </label>
                    <select
                      value={editEmp.role}
                      onChange={e => setEditEmp({ ...editEmp, role: e.target.value })}
                      className="w-full bg-white dark:bg-brand-900/70 border border-brand-200 dark:border-brand-800 rounded-xl py-2.5 px-3 text-xs outline-none focus:border-indigo-500 text-brand-950 dark:text-white font-bold"
                    >
                      <option value="EMPLOYEE">EMPLOYEE</option>
                      <option value="TEAM_LEAD">TEAM LEAD</option>
                      <option value="HR">HR</option>
                      <option value="SUPER_ADMIN">SUPER ADMIN</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. PERSONAL DETAILS */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-brand-700 dark:text-brand-300 uppercase tracking-wider flex items-center gap-1.5">
                  <UserPlus size={13} className="text-indigo-500" /> Personal Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">First Name *</label>
                    <input
                      type="text"
                      required
                      value={editEmp.firstName}
                      onChange={e => setEditEmp({ ...editEmp, firstName: e.target.value })}
                      className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 text-brand-950 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Last Name *</label>
                    <input
                      type="text"
                      required
                      value={editEmp.lastName}
                      onChange={e => setEditEmp({ ...editEmp, lastName: e.target.value })}
                      className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 text-brand-950 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Phone Number *</label>
                    <input
                      type="text"
                      required
                      value={editEmp.phone}
                      onChange={e => setEditEmp({ ...editEmp, phone: e.target.value })}
                      className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 text-brand-950 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Gender</label>
                    <select
                      value={editEmp.gender}
                      onChange={e => setEditEmp({ ...editEmp, gender: e.target.value })}
                      className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 text-brand-950 dark:text-white font-bold"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Date of Birth</label>
                    <input
                      type="date"
                      value={editEmp.dob}
                      onChange={e => setEditEmp({ ...editEmp, dob: e.target.value })}
                      className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 text-brand-950 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Blood Group</label>
                    <select
                      value={editEmp.bloodGroup}
                      onChange={e => setEditEmp({ ...editEmp, bloodGroup: e.target.value })}
                      className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 text-brand-950 dark:text-white font-bold"
                    >
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">PAN Number</label>
                    <input
                      type="text"
                      placeholder="ABCDE1234F"
                      value={editEmp.panCard}
                      onChange={e => setEditEmp({ ...editEmp, panCard: e.target.value.toUpperCase() })}
                      className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 text-brand-950 dark:text-white uppercase font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Aadhaar Number</label>
                    <input
                      type="text"
                      placeholder="12-digit number"
                      value={editEmp.aadharCard}
                      onChange={e => setEditEmp({ ...editEmp, aadharCard: e.target.value })}
                      className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 text-brand-950 dark:text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 3. JOB & ORGANIZATION */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-brand-700 dark:text-brand-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 size={13} className="text-indigo-500" /> Job & Organization
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Department *</label>
                    <input
                      type="text"
                      required
                      value={editEmp.department}
                      onChange={e => setEditEmp({ ...editEmp, department: e.target.value })}
                      className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 text-brand-950 dark:text-white font-bold"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Designation *</label>
                    <input
                      type="text"
                      required
                      value={editEmp.designation}
                      onChange={e => setEditEmp({ ...editEmp, designation: e.target.value })}
                      className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 text-brand-950 dark:text-white font-bold"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Date of Joining</label>
                    <input
                      type="date"
                      value={editEmp.dateOfJoining}
                      onChange={e => setEditEmp({ ...editEmp, dateOfJoining: e.target.value })}
                      className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 text-brand-950 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">ID Card Validity</label>
                    <input
                      type="date"
                      value={editEmp.validity}
                      onChange={e => setEditEmp({ ...editEmp, validity: e.target.value })}
                      className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 text-brand-950 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* 4. ADDRESS & EMERGENCY CONTACT */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-brand-700 dark:text-brand-300 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin size={13} className="text-indigo-500" /> Address & Emergency Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Current Address</label>
                    <textarea
                      rows={2}
                      value={editEmp.currentAddress || ''}
                      onChange={e => setEditEmp({ ...editEmp, currentAddress: e.target.value })}
                      className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 text-brand-950 dark:text-white resize-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Permanent Address</label>
                    <textarea
                      rows={2}
                      value={editEmp.permanentAddress || ''}
                      onChange={e => setEditEmp({ ...editEmp, permanentAddress: e.target.value })}
                      className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 text-brand-950 dark:text-white resize-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Emergency Contact Person</label>
                    <input
                      type="text"
                      placeholder="e.g. Parent / Spouse"
                      value={editEmp.emergencyName}
                      onChange={e => setEditEmp({ ...editEmp, emergencyName: e.target.value })}
                      className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 text-brand-950 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Emergency Phone Number</label>
                    <input
                      type="text"
                      value={editEmp.emergencyPhone}
                      onChange={e => setEditEmp({ ...editEmp, emergencyPhone: e.target.value })}
                      className="w-full bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 text-brand-950 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* 5. COMPENSATION & SALARY STRUCTURE */}
              {isSuperAdmin && (
                <div className="space-y-3 bg-brand-50/40 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-2xl p-4">
                  <h3 className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign size={13} /> Compensation Structure (₹ Monthly)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Basic Monthly (₹)</label>
                      <input
                        type="number"
                        value={editEmp.basicSalary}
                        onChange={e => setEditEmp({ ...editEmp, basicSalary: e.target.value })}
                        className="w-full bg-white dark:bg-brand-900/70 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 text-brand-950 dark:text-white font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">HRA (₹)</label>
                      <input
                        type="number"
                        value={editEmp.hra}
                        onChange={e => setEditEmp({ ...editEmp, hra: e.target.value })}
                        className="w-full bg-white dark:bg-brand-900/70 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 text-brand-950 dark:text-white font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-brand-500 uppercase tracking-wider pl-1">Allowances (₹)</label>
                      <input
                        type="number"
                        value={editEmp.allowance}
                        onChange={e => setEditEmp({ ...editEmp, allowance: e.target.value })}
                        className="w-full bg-white dark:bg-brand-900/70 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-500 text-brand-950 dark:text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-brand-200 dark:border-brand-800 flex justify-end gap-3 sticky bottom-0 bg-white/90 dark:bg-brand-950/90 backdrop-blur-sm -mb-2 pb-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 rounded-xl px-5 py-2.5 font-bold text-xs uppercase hover:bg-brand-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl px-6 py-2.5 font-bold text-xs uppercase shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5"
                >
                  <Check size={14} /> Save Employee Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUCCESS POPUP */}
      {showSuccessPopup && (
        <div className="fixed inset-0 z-[60] bg-brand-950/40 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-brand-950 border border-emerald-500/30 rounded-3xl p-8 max-w-sm w-full shadow-2xl shadow-emerald-500/10 flex flex-col items-center text-center scale-100 transition-transform">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center mb-4 shadow-inner">
              <Check size={32} className="text-emerald-500" />
            </div>
            <h2 className="text-xl font-extrabold text-brand-950 dark:text-white mb-2">Registration Complete!</h2>
            <p className="text-sm font-semibold text-brand-500 mb-6">Employee has been successfully added to the directory.</p>
            <div className="w-full flex flex-col space-y-3">
              <button 
                onClick={handleGenerateOfferLetter}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold uppercase tracking-wider text-xs transition-colors shadow-lg shadow-indigo-600/20 flex items-center justify-center space-x-2"
              >
                <FileText size={16} />
                <span>Generate Offer Letter</span>
              </button>
              <button 
                onClick={() => setShowSuccessPopup(false)}
                className="w-full bg-brand-100 hover:bg-brand-200 text-brand-800 dark:bg-brand-800 dark:hover:bg-brand-700 dark:text-white py-3 rounded-xl font-bold uppercase tracking-wider text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Employees;
