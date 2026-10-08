import React, { useState, useEffect } from 'react';
import { useDialog } from '../../context/DialogContext';
import api from '../../services/api';
import {
  Building2,
  Sliders,
  Users,
  MapPin,
  Plus,
  Trash2,
  Edit,
  Save,
  CheckCircle,
  AlertCircle,
  Clock,
  ShieldCheck,
  Smartphone,
  Scan,
  RefreshCw,
  Search,
  ExternalLink,
  Info,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface OfficeLocation {
  id: string;
  name: string;
  branch: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  timeZone: string;
  status: string;
  _count?: {
    employees: number;
    enrollments: number;
  };
}

interface AttendancePolicy {
  id?: string;
  name: string;
  isDefault: boolean;
  gpsVerification: boolean;
  faceVerification: boolean;
  livenessDetection: boolean;
  deviceRegistration: boolean;
  graceTimeMinutes: number;
  lateThresholdMinutes: number;
  halfDayHours: number;
  fullDayHours: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  shifts?: { name: string; start: string; end: string }[];
  allowedOfficeIds: string[];
  department?: string | null;
  employeeIds: string[];
  status: string;
}

export const AttendanceSetup: React.FC = () => {
  const { alert, confirm } = useDialog();

  const [activeTab, setActiveTab] = useState<'OFFICES' | 'POLICY' | 'ENROLLMENT_ADMIN'>('OFFICES');
  const [loading, setLoading] = useState<boolean>(true);

  // Office Setup State
  const [offices, setOffices] = useState<OfficeLocation[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<OfficeLocation | null>(null);
  const [officeFormOpen, setOfficeFormOpen] = useState<boolean>(false);
  const [editingOfficeId, setEditingOfficeId] = useState<string | null>(null);
  const [officeFormData, setOfficeFormData] = useState({
    name: 'OneBridge Infotech - Hyderabad HQ',
    branch: 'Hyderabad Headquarters',
    latitude: 17.4944497,
    longitude: 78.4031731,
    radiusMeters: 250,
    timeZone: 'Asia/Kolkata',
    status: 'ACTIVE',
  });

  // Policy Setup State
  const [policy, setPolicy] = useState<AttendancePolicy>({
    name: 'Corporate Smart Attendance Policy',
    isDefault: true,
    gpsVerification: true,
    faceVerification: true,
    livenessDetection: true,
    deviceRegistration: true,
    graceTimeMinutes: 15,
    lateThresholdMinutes: 30,
    halfDayHours: 4.5,
    fullDayHours: 8.5,
    workingHoursStart: '09:30',
    workingHoursEnd: '18:30',
    shifts: [
      { name: 'General Shift', start: '09:30', end: '18:30' },
      { name: 'Morning Shift', start: '08:00', end: '17:00' },
      { name: 'Evening Shift', start: '13:00', end: '22:00' },
    ],
    allowedOfficeIds: [],
    employeeIds: [],
    status: 'ACTIVE',
  });
  const [savingPolicy, setSavingPolicy] = useState<boolean>(false);

  // Enrollment Status Admin Tab State
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState<string>('');
  const [resettingId, setResettingId] = useState<string | null>(null);

  useEffect(() => {
    fetchOffices();
    fetchPolicies();
    fetchEmployeesList();
  }, []);

  const fetchOffices = async () => {
    try {
      setLoading(true);
      const res = await api.get('/attendance/offices');
      if (res.data.status === 'success') {
        setOffices(res.data.data);
        if (res.data.data.length > 0 && !selectedOffice) {
          setSelectedOffice(res.data.data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load offices:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPolicies = async () => {
    try {
      const res = await api.get('/attendance/policy');
      if (res.data.status === 'success' && res.data.data.length > 0) {
        setPolicy(res.data.data[0]);
      }
    } catch (err) {
      console.error('Failed to load policy:', err);
    }
  };

  const fetchEmployeesList = async () => {
    try {
      const res = await api.get('/employees');
      if (res.data.status === 'success') {
        setEmployees(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load employees:', err);
    }
  };

  /* -------------------------------------------------------------
     OFFICE MANAGEMENT ACTIONS
  ------------------------------------------------------------- */
  const handleOpenCreateOffice = () => {
    setEditingOfficeId(null);
    setOfficeFormData({
      name: 'OneBridge Infotech - Hyderabad HQ',
      branch: 'Hyderabad Headquarters',
      latitude: 17.4944497,
      longitude: 78.4031731,
      radiusMeters: 250,
      timeZone: 'Asia/Kolkata',
      status: 'ACTIVE',
    });
    setOfficeFormOpen(true);
  };

  const handleOpenEditOffice = (off: OfficeLocation) => {
    setEditingOfficeId(off.id);
    setOfficeFormData({
      name: off.name,
      branch: off.branch,
      latitude: off.latitude,
      longitude: off.longitude,
      radiusMeters: off.radiusMeters,
      timeZone: off.timeZone,
      status: off.status,
    });
    setOfficeFormOpen(true);
  };

  const handleSaveOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingOfficeId) {
        await api.put(`/attendance/offices/${editingOfficeId}`, officeFormData);
        alert({ title: 'Success', message: 'Office updated successfully!', variant: 'info' });
      } else {
        await api.post('/attendance/offices', officeFormData);
        alert({ title: 'Success', message: 'Office location created successfully!', variant: 'info' });
      }
      setOfficeFormOpen(false);
      fetchOffices();
    } catch (err: any) {
      alert({ title: 'Error', message: err.response?.data?.message || 'Failed to save office', variant: 'error' });
    }
  };

  const handleDeleteOffice = async (id: string, name: string) => {
    const isConfirmed = await confirm({
      title: 'Delete Office Location',
      message: `Are you sure you want to delete ${name}? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    });

    if (!isConfirmed) return;

    try {
      await api.delete(`/attendance/offices/${id}`);
      alert({ title: 'Success', message: 'Office deleted successfully', variant: 'info' });
      fetchOffices();
    } catch (err: any) {
      alert({ title: 'Error', message: err.response?.data?.message || 'Failed to delete office', variant: 'error' });
    }
  };

  /* -------------------------------------------------------------
     POLICY SAVE ACTION
  ------------------------------------------------------------- */
  const handleSavePolicy = async () => {
    try {
      setSavingPolicy(true);
      await api.post('/attendance/policy', policy);
      alert({ title: 'Success', message: 'Attendance Policy saved successfully!', variant: 'info' });
      fetchPolicies();
    } catch (err: any) {
      alert({ title: 'Error', message: err.response?.data?.message || 'Failed to save policy', variant: 'error' });
    } finally {
      setSavingPolicy(false);
    }
  };

  /* -------------------------------------------------------------
     RESET ENROLLMENT ACTION
  ------------------------------------------------------------- */
  const handleResetEnrollment = async (empId: string, empName: string) => {
    const isConfirmed = await confirm({
      title: 'Reset Attendance Enrollment',
      message: `Reset smart attendance enrollment for ${empName} (${empId})? They will be required to re-enroll face biometrics and device upon next login.`,
      confirmText: 'Reset Enrollment',
      cancelText: 'Cancel',
      variant: 'warning',
    });

    if (!isConfirmed) return;

    try {
      setResettingId(empId);
      await api.post(`/attendance/enrollment/reset/${empId}`);
      alert({ title: 'Reset Complete', message: `Enrollment reset for ${empName}. Re-enrollment required on next login.`, variant: 'info' });
      fetchEmployeesList();
    } catch (err: any) {
      alert({ title: 'Error', message: err.response?.data?.message || 'Failed to reset enrollment', variant: 'error' });
    } finally {
      setResettingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-brand-900 via-indigo-950 to-brand-950 p-6 rounded-3xl border border-brand-800 shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2 border border-indigo-500/30">
            <Sliders size={14} className="text-indigo-400" /> Admin Controls
          </div>
          <h1 className="font-extrabold text-2xl tracking-tight text-white flex items-center gap-2">
            Attendance Setup & Policies
          </h1>
          <p className="text-xs text-brand-300 mt-1 font-medium">
            Configure physical office geofences, biometric parameters, shift rules, and manage employee enrollments
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-brand-800/60 p-1.5 rounded-2xl w-fit border border-brand-700/80">
          <button
            onClick={() => setActiveTab('OFFICES')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'OFFICES' ? 'bg-indigo-600 text-white shadow-md' : 'text-brand-300 hover:text-white'
            }`}
          >
            <Building2 size={14} /> Office Locations
          </button>
          <button
            onClick={() => setActiveTab('POLICY')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'POLICY' ? 'bg-indigo-600 text-white shadow-md' : 'text-brand-300 hover:text-white'
            }`}
          >
            <ShieldCheck size={14} /> Attendance Policy
          </button>
          <button
            onClick={() => setActiveTab('ENROLLMENT_ADMIN')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'ENROLLMENT_ADMIN' ? 'bg-indigo-600 text-white shadow-md' : 'text-brand-300 hover:text-white'
            }`}
          >
            <Users size={14} /> Employee Enrollments
          </button>
        </div>
      </div>

      {/* =============================================================
         TAB 1: OFFICE LOCATIONS & MAP SETUP
      ============================================================= */}
      {activeTab === 'OFFICES' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-brand-950 dark:text-white flex items-center gap-2">
                <MapPin className="text-indigo-500" size={20} />
                Physical Office Geofences
              </h2>
              <p className="text-xs text-brand-500">
                Define office coordinates and allowable circular geofence radii for attendance verification.
              </p>
            </div>
            <button
              onClick={handleOpenCreateOffice}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md shadow-indigo-600/20"
            >
              <Plus size={16} /> Add Office Location
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Office List Cards */}
            <div className="space-y-4">
              {offices.map((off) => (
                <div
                  key={off.id}
                  onClick={() => setSelectedOffice(off)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                    selectedOffice?.id === off.id
                      ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 shadow-md'
                      : 'bg-white dark:bg-brand-900/40 border-brand-200 dark:border-brand-800 hover:border-brand-300'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-extrabold text-sm text-brand-950 dark:text-white">{off.name}</h3>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">{off.branch}</p>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-full ${
                        off.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {off.status}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-brand-500">
                    <p className="flex justify-between">
                      <span>Coordinates:</span>
                      <span className="font-mono font-bold text-brand-950 dark:text-white">
                        {off.latitude.toFixed(4)}°, {off.longitude.toFixed(4)}°
                      </span>
                    </p>
                    <p className="flex justify-between">
                      <span>Geofence Radius:</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{off.radiusMeters}m</span>
                    </p>
                    <p className="flex justify-between">
                      <span>Timezone:</span>
                      <span>{off.timeZone}</span>
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-brand-100 dark:border-brand-800">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditOffice(off);
                      }}
                      className="p-1.5 rounded-lg text-brand-500 hover:text-indigo-600 hover:bg-brand-100 dark:hover:bg-brand-800"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteOffice(off.id, off.name);
                      }}
                      className="p-1.5 rounded-lg text-brand-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Interactive Map Visualizer */}
            <div className="lg:col-span-2 glass rounded-3xl p-6 border border-brand-200 dark:border-brand-900 shadow-xl bg-white dark:bg-brand-950 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-bold text-sm uppercase tracking-wider text-brand-950 dark:text-white flex items-center gap-2">
                    <MapPin className="text-emerald-500" size={16} />
                    {selectedOffice ? `${selectedOffice.name} Geofence Visualizer` : 'Select an Office'}
                  </h3>
                  <p className="text-xs text-brand-500">
                    Allowed attendance perimeter: {selectedOffice?.radiusMeters || 200} meters radius
                  </p>
                </div>
                {selectedOffice && (
                  <a
                    href={`https://www.google.com/maps?q=${selectedOffice.latitude},${selectedOffice.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    Open in Maps <ExternalLink size={12} />
                  </a>
                )}
              </div>

              {/* Embedded Interactive OpenStreetMap with Geofence Marker & Perimeter */}
              <div className="flex-1 min-h-[380px] rounded-2xl overflow-hidden relative border border-brand-200 dark:border-brand-800 shadow-inner bg-brand-100 dark:bg-brand-900/60 flex items-center justify-center">
                {selectedOffice ? (
                  <iframe
                    title="Office Map Location"
                    className="w-full h-full border-0"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedOffice.longitude - 0.005}%2C${selectedOffice.latitude - 0.003}%2C${selectedOffice.longitude + 0.005}%2C${selectedOffice.latitude + 0.003}&layer=mapnik&marker=${selectedOffice.latitude}%2C${selectedOffice.longitude}`}
                  />
                ) : (
                  <p className="text-xs text-brand-500">Select an office location to view on map</p>
                )}

                {/* Radar Overlay Badge */}
                {selectedOffice && (
                  <div className="absolute bottom-4 left-4 bg-brand-950/80 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 text-white text-xs flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                    <div>
                      <p className="font-extrabold">{selectedOffice.name}</p>
                      <p className="text-[10px] text-brand-300">
                        Lat: {selectedOffice.latitude.toFixed(4)}, Lng: {selectedOffice.longitude.toFixed(4)} (Radius: {selectedOffice.radiusMeters}m)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Modal / Office Form */}
          {officeFormOpen && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-brand-950 rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-brand-200 dark:border-brand-800 shadow-2xl space-y-4"
              >
                <div className="flex justify-between items-center pb-3 border-b border-brand-100 dark:border-brand-900">
                  <h3 className="text-base font-extrabold text-brand-950 dark:text-white">
                    {editingOfficeId ? 'Edit Office Location' : 'Create New Office Location'}
                  </h3>
                  <button onClick={() => setOfficeFormOpen(false)} className="text-brand-400 hover:text-brand-600">
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveOffice} className="space-y-4 text-xs font-semibold">
                  <div>
                    <label className="block text-brand-500 mb-1">Office Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Codabs Innovation Hub"
                      value={officeFormData.name}
                      onChange={(e) => setOfficeFormData({ ...officeFormData, name: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/40 text-brand-950 dark:text-white outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-brand-500 mb-1">Branch / City</label>
                      <input
                        type="text"
                        placeholder="e.g. Bangalore North"
                        value={officeFormData.branch}
                        onChange={(e) => setOfficeFormData({ ...officeFormData, branch: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/40 text-brand-950 dark:text-white outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-brand-500 mb-1">Status</label>
                      <select
                        value={officeFormData.status}
                        onChange={(e) => setOfficeFormData({ ...officeFormData, status: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/40 text-brand-950 dark:text-white outline-none focus:border-indigo-500"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="INACTIVE">INACTIVE</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-brand-500 mb-1">Latitude *</label>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="12.9716"
                        value={officeFormData.latitude}
                        onChange={(e) => setOfficeFormData({ ...officeFormData, latitude: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2.5 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/40 text-brand-950 dark:text-white outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-brand-500 mb-1">Longitude *</label>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="77.5946"
                        value={officeFormData.longitude}
                        onChange={(e) => setOfficeFormData({ ...officeFormData, longitude: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2.5 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/40 text-brand-950 dark:text-white outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-brand-500 mb-1">Allowed Radius (Meters) *</label>
                      <input
                        type="number"
                        required
                        min="50"
                        max="5000"
                        value={officeFormData.radiusMeters}
                        onChange={(e) => setOfficeFormData({ ...officeFormData, radiusMeters: parseInt(e.target.value) })}
                        className="w-full px-3 py-2.5 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/40 text-brand-950 dark:text-white outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-brand-500 mb-1">Time Zone</label>
                      <input
                        type="text"
                        value={officeFormData.timeZone}
                        onChange={(e) => setOfficeFormData({ ...officeFormData, timeZone: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/40 text-brand-950 dark:text-white outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-brand-100 dark:border-brand-900">
                    <button
                      type="button"
                      onClick={() => setOfficeFormOpen(false)}
                      className="px-4 py-2 rounded-xl border border-brand-300 dark:border-brand-700 text-brand-600 dark:text-brand-300 font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-600/20"
                    >
                      {editingOfficeId ? 'Save Changes' : 'Create Office'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </div>
      )}

      {/* =============================================================
         TAB 2: ATTENDANCE POLICY SETUP
      ============================================================= */}
      {activeTab === 'POLICY' && (
        <div className="glass rounded-3xl p-6 sm:p-10 border border-brand-200 dark:border-brand-900 shadow-xl bg-white dark:bg-brand-950 space-y-8">
          <div className="flex justify-between items-center pb-4 border-b border-brand-100 dark:border-brand-900">
            <div>
              <h2 className="text-lg font-bold text-brand-950 dark:text-white flex items-center gap-2">
                <ShieldCheck className="text-indigo-500" size={20} />
                Smart Biometric Attendance Policy
              </h2>
              <p className="text-xs text-brand-500 mt-1">
                Configure verification gates, grace thresholds, working hours, and shift policies.
              </p>
            </div>
            <button
              onClick={handleSavePolicy}
              disabled={savingPolicy}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-600/25 disabled:opacity-50"
            >
              <Save size={16} /> {savingPolicy ? 'Saving...' : 'Save Policy'}
            </button>
          </div>

          {/* Section 1: Verification Gates Toggles */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500">Security Verification Gates</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* GPS Gate */}
              <div className="p-4 rounded-2xl bg-brand-50 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-brand-950 dark:text-white flex items-center gap-1.5">
                    <MapPin size={16} className="text-emerald-500" /> GPS Geofence
                  </span>
                  <input
                    type="checkbox"
                    checked={policy.gpsVerification}
                    onChange={(e) => setPolicy({ ...policy, gpsVerification: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                </div>
                <p className="text-[11px] text-brand-500">
                  Enforces that check-ins must be within the allowed office radius in meters.
                </p>
              </div>

              {/* Face Biometric Gate */}
              <div className="p-4 rounded-2xl bg-brand-50 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-brand-950 dark:text-white flex items-center gap-1.5">
                    <Scan size={16} className="text-indigo-500" /> Face Biometric
                  </span>
                  <input
                    type="checkbox"
                    checked={policy.faceVerification}
                    onChange={(e) => setPolicy({ ...policy, faceVerification: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                </div>
                <p className="text-[11px] text-brand-500">
                  Matches live camera embedding against stored encrypted template (75% match threshold).
                </p>
              </div>

              {/* Liveness Anti-Spoofing Gate */}
              <div className="p-4 rounded-2xl bg-brand-50 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-brand-950 dark:text-white flex items-center gap-1.5">
                    <ShieldCheck size={16} className="text-amber-500" /> Liveness Detection
                  </span>
                  <input
                    type="checkbox"
                    checked={policy.livenessDetection}
                    onChange={(e) => setPolicy({ ...policy, livenessDetection: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                </div>
                <p className="text-[11px] text-brand-500">
                  Prevents spoofing with printed photos, video replays, or digital screens.
                </p>
              </div>

              {/* Device Registration Gate */}
              <div className="p-4 rounded-2xl bg-brand-50 dark:bg-brand-900/40 border border-brand-200 dark:border-brand-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-brand-950 dark:text-white flex items-center gap-1.5">
                    <Smartphone size={16} className="text-purple-500" /> Device Registration
                  </span>
                  <input
                    type="checkbox"
                    checked={policy.deviceRegistration}
                    onChange={(e) => setPolicy({ ...policy, deviceRegistration: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                </div>
                <p className="text-[11px] text-brand-500">
                  Restricts attendance marking to the employee's registered hardware device.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Working Hours & Grace Periods */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500">
              Working Hours, Shifts & Late Penalty Rules
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-semibold">
              <div>
                <label className="block text-brand-500 mb-1">Standard Shift Start</label>
                <input
                  type="time"
                  value={policy.workingHoursStart}
                  onChange={(e) => setPolicy({ ...policy, workingHoursStart: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/40 text-brand-950 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-brand-500 mb-1">Standard Shift End</label>
                <input
                  type="time"
                  value={policy.workingHoursEnd}
                  onChange={(e) => setPolicy({ ...policy, workingHoursEnd: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/40 text-brand-950 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-brand-500 mb-1">Grace Time (Minutes)</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={policy.graceTimeMinutes}
                  onChange={(e) => setPolicy({ ...policy, graceTimeMinutes: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/40 text-brand-950 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-brand-500 mb-1">Late Threshold (Minutes)</label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={policy.lateThresholdMinutes}
                  onChange={(e) => setPolicy({ ...policy, lateThresholdMinutes: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/40 text-brand-950 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-brand-500 mb-1">Min Hours for Half Day</label>
                <input
                  type="number"
                  step="0.5"
                  min="2"
                  max="6"
                  value={policy.halfDayHours}
                  onChange={(e) => setPolicy({ ...policy, halfDayHours: parseFloat(e.target.value) || 4 })}
                  className="w-full px-3 py-2.5 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/40 text-brand-950 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-brand-500 mb-1">Min Hours for Full Day</label>
                <input
                  type="number"
                  step="0.5"
                  min="6"
                  max="12"
                  value={policy.fullDayHours}
                  onChange={(e) => setPolicy({ ...policy, fullDayHours: parseFloat(e.target.value) || 8 })}
                  className="w-full px-3 py-2.5 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/40 text-brand-950 dark:text-white outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Supported Shifts */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500">Configured Shifts</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(policy.shifts || []).map((sh, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800">
                  <p className="font-bold text-sm text-brand-950 dark:text-white">{sh.name}</p>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
                    {sh.start} - {sh.end}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =============================================================
         TAB 3: EMPLOYEE ENROLLMENT STATUS & RESET
      ============================================================= */}
      {activeTab === 'ENROLLMENT_ADMIN' && (
        <div className="glass rounded-3xl p-6 sm:p-10 border border-brand-200 dark:border-brand-900 shadow-xl bg-white dark:bg-brand-950 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-brand-100 dark:border-brand-900">
            <div>
              <h2 className="text-lg font-bold text-brand-950 dark:text-white flex items-center gap-2">
                <Users className="text-indigo-500" size={20} />
                Employee Biometric Enrollments
              </h2>
              <p className="text-xs text-brand-500 mt-1">
                Monitor enrollment status and reset employee biometrics when a device or facial profile changes.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 text-brand-400" size={14} />
              <input
                type="text"
                placeholder="Search employee..."
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/40 text-brand-950 dark:text-white outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-brand-100/40 dark:bg-brand-900/40 text-[10px] uppercase font-bold text-brand-500 border-b border-brand-200 dark:border-brand-800">
                  <th className="px-5 py-3.5">Employee</th>
                  <th className="px-5 py-3.5">Department</th>
                  <th className="px-5 py-3.5">Office</th>
                  <th className="px-5 py-3.5 text-center">Enrollment Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100 dark:divide-brand-900 font-semibold">
                {employees
                  .filter((emp) =>
                    !employeeSearch ||
                    emp.firstName.toLowerCase().includes(employeeSearch.toLowerCase()) ||
                    emp.lastName.toLowerCase().includes(employeeSearch.toLowerCase()) ||
                    emp.employeeId.toLowerCase().includes(employeeSearch.toLowerCase())
                  )
                  .map((emp) => {
                    const isEnrolled = emp.attendanceEnrollment?.status === 'COMPLETED';
                    return (
                      <tr key={emp.employeeId} className="hover:bg-brand-100/20 dark:hover:bg-brand-900/20">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs">
                              {emp.firstName?.[0]}
                              {emp.lastName?.[0]}
                            </div>
                            <div>
                              <p className="font-bold text-brand-950 dark:text-white">
                                {emp.firstName} {emp.lastName}
                              </p>
                              <p className="text-[10px] text-brand-400">{emp.employeeId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-brand-600 dark:text-brand-300">{emp.department}</td>
                        <td className="px-5 py-4 text-brand-600 dark:text-brand-300">{emp.office?.name || 'HQ Campus'}</td>
                        <td className="px-5 py-4 text-center">
                          <span
                            className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                              isEnrolled
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                                : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {isEnrolled ? '✓ Enrolled' : 'Pending Setup'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => handleResetEnrollment(emp.employeeId, `${emp.firstName} ${emp.lastName}`)}
                            disabled={resettingId === emp.employeeId}
                            className="px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-[11px] font-bold flex items-center gap-1.5 ml-auto"
                          >
                            <RefreshCw size={12} className={resettingId === emp.employeeId ? 'animate-spin' : ''} />
                            Reset Attendance
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceSetup;
