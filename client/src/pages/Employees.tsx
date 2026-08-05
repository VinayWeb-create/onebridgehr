import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Search, Plus, UserPlus, Eye, Edit2, Upload, FileText, X, Check, Trash2, CalendarDays
} from 'lucide-react';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { saveAs } from 'file-saver';

interface Employee {
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  bloodGroup: string;
  validity: string;
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
  rating?: number;
}

export const Employees: React.FC = () => {
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
      if (query) {
        setEmployees(res.data.data.employees);
      } else {
        setEmployees(res.data.data);
      }
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
    let nextNum = 1;
    if (employees.length > 0) {
      const maxNum = Math.max(
        0,
        ...employees
          .map(e => parseInt(e.employeeId.replace('OBI', ''), 10))
          .filter(n => !isNaN(n) && n < 1000)
      );
      if (maxNum >= 1) {
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
        dateOfJoining: new Date().toISOString().split('T')[0],
        emergencyName: '',
        emergencyRelationship: '',
        emergencyPhone: '',
      });
      fetchEmployees();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to register employee');
    }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put(`/employees/${editEmp.employeeId}`, {
        firstName: editEmp.firstName,
        lastName: editEmp.lastName,
        phone: editEmp.phone,
        department: editEmp.department,
        designation: editEmp.designation,
        bloodGroup: editEmp.bloodGroup,
      });
      setShowEditModal(false);
      setEditEmp(null);
      fetchEmployees();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update employee');
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
      alert('Failed to generate offer letter.');
    }
  };

  const handleDeleteEmployee = async (employeeId: string) => {
    if (!window.confirm('Are you sure you want to delete this employee? This action cannot be undone.')) {
      return;
    }
    try {
      await api.delete(`/employees/${employeeId}`);
      alert('Employee deleted successfully');
      fetchEmployees();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete employee');
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
      alert('Upload completed successfully!');
      // Update selected state
      if (type === 'signature') {
        setSelectedEmp({ ...selectedEmp, signatureUrl: res.data.data.signatureUrl });
      } else {
        setSelectedEmp({ ...selectedEmp, profileImageUrl: res.data.data.profileImageUrl });
      }
      fetchEmployees();
    } catch (err: any) {
      alert(err.response?.data?.message || 'File upload failed');
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
                  <td colSpan={7} className="text-center py-10">
                    <span className="w-6 h-6 rounded-full border-2 border-indigo-600/30 border-t-indigo-600 animate-spin inline-block" />
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-brand-500">No records found.</td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-brand-100/30 dark:hover:bg-brand-900/30 transition-all">
                    <td className="px-6 py-4 font-bold text-indigo-600">{emp.employeeId}</td>
                    <td className="px-6 py-4 flex items-center space-x-3">
                      <div className="w-7 h-7 rounded-lg overflow-hidden bg-brand-200 dark:bg-brand-950 flex items-center justify-center border border-indigo-600/20">
                        {emp.profileImageUrl ? (
                          <img src={emp.profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <span className="uppercase text-[9px] font-bold text-indigo-600">{emp.firstName[0]}{emp.lastName[0]}</span>
                        )}
                      </div>
                      <span className="text-brand-950 dark:text-white">{emp.firstName} {emp.lastName}</span>
                    </td>
                    <td className="px-6 py-4 text-brand-600 dark:text-brand-400">{emp.department}</td>
                    <td className="px-6 py-4 font-medium">{emp.designation}</td>
                    <td className="px-6 py-4">{emp.bloodGroup}</td>
                    <td className="px-6 py-4 text-brand-500">{new Date(emp.validity).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-1">
                        <span className="text-amber-500 font-extrabold text-xs">★</span>
                        <span className="text-brand-950 dark:text-white font-bold">{emp.rating ? emp.rating.toFixed(1) : '3.5'}/5.0</span>
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
                        { !['OBI0001', 'OBI1117'].includes(emp.employeeId) && (
                          <button
                            onClick={() => { setEditEmp(emp); setShowEditModal(true); }}
                            className="p-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900 text-amber-600 rounded-xl transition-all"
                            title="Edit Employee"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                        { !['OBI0001', 'OBI1117'].includes(emp.employeeId) && (
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

              {/* Details Sections */}
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

      {/* --- EDIT EMPLOYEE MODAL --- */}
      {showEditModal && editEmp && (
        <div className="fixed inset-0 z-50 bg-brand-950/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-2xl glass rounded-3xl border border-brand-200 dark:border-brand-900 shadow-2xl p-6 md:p-8 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-brand-200 dark:border-brand-900">
              <h2 className="font-extrabold text-lg">Edit Employee Profile</h2>
              <button onClick={() => setShowEditModal(false)} className="p-1 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateEmployee} className="mt-6 space-y-6 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">First Name</label>
                  <input type="text" required value={editEmp.firstName} onChange={e => setEditEmp({...editEmp, firstName: e.target.value})} className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Last Name</label>
                  <input type="text" required value={editEmp.lastName} onChange={e => setEditEmp({...editEmp, lastName: e.target.value})} className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Phone Number</label>
                  <input type="text" required value={editEmp.phone} onChange={e => setEditEmp({...editEmp, phone: e.target.value})} className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Blood Group</label>
                  <input type="text" required value={editEmp.bloodGroup} onChange={e => setEditEmp({...editEmp, bloodGroup: e.target.value})} className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Department</label>
                  <input type="text" required value={editEmp.department} onChange={e => setEditEmp({...editEmp, department: e.target.value})} className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-500 uppercase pl-1">Designation</label>
                  <input type="text" required value={editEmp.designation} onChange={e => setEditEmp({...editEmp, designation: e.target.value})} className="w-full bg-brand-100/50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-indigo-600" />
                </div>
              </div>
              <div className="pt-4 border-t border-brand-200 dark:border-brand-900 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowEditModal(false)} className="bg-brand-200 text-brand-850 dark:bg-brand-900 dark:text-white rounded-xl px-5 py-2.5 font-bold text-xs uppercase">Cancel</button>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6 py-2.5 font-bold text-xs uppercase shadow-md shadow-indigo-600/10">Save Changes</button>
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
