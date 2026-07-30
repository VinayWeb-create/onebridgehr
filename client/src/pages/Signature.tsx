import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Mail, Phone, Globe, MapPin, Copy, Download, RefreshCw, AlertCircle, Search } from 'lucide-react';
import html2canvas from 'html2canvas';

interface EmployeeDetails {
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  validity: string;
  qrCodeUrl?: string;
  profileImageUrl?: string;
}

export const Signature: React.FC = () => {
  const { user } = useAuth();
  const [employeeIdInput, setEmployeeIdInput] = useState('');
  const [employee, setEmployee] = useState<EmployeeDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<'onebridge' | 'golive'>('onebridge');

  useEffect(() => {
    if (user && user.role === 'EMPLOYEE') {
      fetchEmployee(user.employeeId);
    } else {
      // Default to loading active user profile if they have OBI ID
      fetchEmployee(user?.employeeId || 'OBI0001');
    }
  }, [user]);

  const fetchEmployee = async (id: string) => {
    setLoading(true);
    setEmployee(null);
    try {
      const res = await api.get(`/employees/${id}`);
      setEmployee(res.data.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Employee not found');
    } finally {
      setLoading(false);
    }
  };

  const handleQuery = (e: React.FormEvent) => {
    e.preventDefault();
    if (employeeIdInput.trim()) {
      fetchEmployee(employeeIdInput.trim());
    }
  };

  const copySignatureToClipboard = () => {
    const el = document.getElementById(selectedBrand === 'onebridge' ? 'obCardWrapper' : 'glCardWrapper');
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
    const el = document.getElementById(selectedBrand === 'onebridge' ? 'obCardWrapper' : 'glCardWrapper');
    if (!el) return;

    html2canvas(el, {
      useCORS: true,
      scale: 2, // high precision scale
      backgroundColor: null,
    }).then((canvas) => {
      const link = document.createElement('a');
      link.download = `Signature-${employee?.firstName || 'Staff'}-${selectedBrand}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  };

  const obAddress = '#202, Sathyabama Complex, Bhagyanagar Colony, KPHB, Hyderabad, Telangana 500072';
  const glAddress = '3rd Floor, GoLive Plaza, Hitech City, Hyderabad - 500081';

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-extrabold text-2xl tracking-tight text-brand-950 dark:text-white">Email Signature Generator</h1>
          <p className="text-xs text-brand-500 mt-1 font-semibold">Generate responsive, premium corporate HTML email signatures</p>
        </div>
      </div>

      {/* Query panel (for HR / Admins) */}
      {user?.role && ['HR', 'SUPER_ADMIN', 'TEAM_LEAD'].includes(user.role) && (
        <form onSubmit={handleQuery} className="flex space-x-4 max-w-sm">
          <input
            type="text"
            required
            placeholder="Search Employee ID (e.g. OBI0002)"
            value={employeeIdInput}
            onChange={(e) => setEmployeeIdInput(e.target.value)}
            className="w-full bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-2xl py-3 px-4 text-xs font-semibold outline-none focus:border-indigo-600 transition-all text-brand-950 dark:text-white shadow-sm"
          />
          <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl px-6 font-bold text-xs uppercase tracking-wider shadow-md shrink-0">
            Query
          </button>
        </form>
      )}

      {/* Brand Selection Tabs */}
      {employee && (
        <div className="flex space-x-3 border-b border-brand-100 dark:border-brand-900 pb-4">
          <button
            onClick={() => setSelectedBrand('onebridge')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
              selectedBrand === 'onebridge'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-brand-100 text-brand-600 dark:bg-brand-900 dark:text-brand-300 hover:bg-brand-200'
            }`}
          >
            OneBridge Infotech
          </button>
          <button
            onClick={() => setSelectedBrand('golive')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
              selectedBrand === 'golive'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-brand-100 text-brand-600 dark:bg-brand-900 dark:text-brand-300 hover:bg-brand-200'
            }`}
          >
            GoLive Classes
          </button>
        </div>
      )}

      {/* Signature Preview Panel */}
      <div className="flex flex-col items-center justify-center py-10 space-y-6">
        {loading ? (
          <span className="w-8 h-8 rounded-full border-2 border-indigo-600/30 border-t-indigo-600 animate-spin" />
        ) : !employee ? (
          <div className="p-8 text-center text-xs text-brand-400 font-semibold border-2 border-dashed border-brand-200 dark:border-brand-800 rounded-3xl max-w-sm">
            <AlertCircle className="mx-auto text-brand-400 mb-3" size={24} />
            <p>Please query an employee ID to load and preview their email signature templates.</p>
          </div>
        ) : (
          <div className="space-y-8 w-full max-w-4xl flex flex-col items-center">
            
            {/* Visual HTML Wrapper (This is what copies directly to clipboard) */}
            <div className="border border-brand-200 dark:border-brand-800 p-4 sm:p-8 rounded-3xl bg-brand-50/50 dark:bg-brand-950/20 max-w-full overflow-x-auto">
              
              {/* BRAND 1: ONEBRIDGE TEMPLATE */}
              {selectedBrand === 'onebridge' && (
                <div id="obCardWrapper" className="select-all">
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
                      {/* Top Accent Orange Bar */}
                      <tr>
                        <td colSpan={3} style={{
                          height: '5px',
                          background: '#f37021',
                          borderRadius: '12px 12px 0 0',
                          padding: 0
                        }}></td>
                      </tr>

                      {/* Spacer */}
                      <tr><td colSpan={3} style={{ height: '24px' }}></td></tr>

                      {/* Main Layout Grid */}
                      <tr>
                        {/* Column 1: OneBridge Branding Column */}
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

                        {/* Column 2: Details Column (Separated by border) */}
                        <td style={{
                          borderLeft: '1px solid #cbd5e1',
                          paddingLeft: '24px',
                          paddingRight: '20px',
                          verticalAlign: 'middle',
                          width: '310px'
                        }}>
                          <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.02em', fontFamily: "'Outfit', sans-serif" }}>
                            {employee.firstName} {employee.lastName}
                          </h3>
                          <p style={{ fontSize: '13px', fontWeight: 700, color: '#f37021', margin: '4px 0 0 0', fontFamily: "'Outfit', sans-serif" }}>
                            {employee.designation}
                          </p>
                          <div style={{ width: '70px', height: '2px', background: '#f37021', borderRadius: '9999px', marginTop: '6px', marginBottom: '14px' }}></div>
                          
                          {/* Contacts Info Table */}
                          <table cellPadding="0" cellSpacing="0" style={{ width: '100%' }}>
                            <tbody>
                              <tr>
                                <td style={{ width: '28px', paddingBottom: '8px' }}>
                                  <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: '#FFF3EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f37021', fontSize: '10px' }}>
                                    ✉
                                  </div>
                                </td>
                                <td style={{ fontSize: '11px', paddingBottom: '8px' }}>
                                  <a href={`mailto:${employee.email}`} style={{ color: '#334155', fontWeight: 500, textDecoration: 'none' }}>
                                    {employee.email}
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
                                  <a href={`tel:${employee.phone}`} style={{ color: '#334155', fontWeight: 500, textDecoration: 'none' }}>
                                    {employee.phone}
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

                        {/* Column 3: Check-in validation QR */}
                        <td style={{
                          borderLeft: '1px solid #cbd5e1',
                          paddingLeft: '20px',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          width: '140px'
                        }}>
                          <div style={{ padding: '6px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#ffffff', display: 'inline-block', boxShadow: '0 4px 8px rgba(0,0,0,0.06)', marginBottom: '8px' }}>
                            <img src={employee.qrCodeUrl || '/image copy.png'} style={{ width: '85px', height: '85px', objectFit: 'contain' }} alt="Check-in QR" />
                          </div>
                          <span style={{ fontSize: '10px', fontWeight: 600, color: '#475569', display: 'block', lineHeight: 1.3 }}>
                            Scan to Visit<br /><span style={{ fontWeight: 800, color: '#0f172a' }}>Our Website</span>
                          </span>
                          <div style={{ width: '22px', height: '2.5px', background: '#f37021', borderRadius: '9999px', margin: '6px auto 0 auto' }}></div>
                        </td>
                      </tr>

                      {/* Divider line */}
                      <tr><td colSpan={3} style={{ height: '20px' }}></td></tr>
                      <tr>
                        <td colSpan={3} style={{ borderBottom: '1px solid #cbd5e1', height: '1px', padding: 0 }}></td>
                      </tr>
                      <tr><td colSpan={3} style={{ height: '16px' }}></td></tr>

                      {/* Legal Footer Notice */}
                      <tr>
                        <td colSpan={3}>
                          <table cellPadding="0" cellSpacing="0" style={{ width: '100%' }}>
                            <tbody>
                              <tr>
                                <td style={{ width: '190px', verticalAlign: 'middle', borderRight: '1px solid #cbd5e1', paddingRight: '12px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1.5px solid #f37021', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
                                      <img src={`${window.location.origin}/shield.png`} style={{ width: '20px', height: '20px', objectFit: 'contain' }} alt="Shield" />
                                    </div>
                                    <span style={{ fontSize: '9.5px', fontWeight: 800, color: '#f37021', letterSpacing: '0.04em' }}>CONFIDENTIALITY NOTICE</span>
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

              {/* BRAND 2: GOLIVE TEMPLATE */}
              {selectedBrand === 'golive' && (
                <div id="glCardWrapper" className="select-all">
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
                      {/* Premium Top Blue-Gold Accent Line */}
                      <tr>
                        <td colSpan={3} style={{
                          height: '4px',
                          background: 'linear-gradient(90deg, #1e40af 0%, #3b82f6 45%, #eab308 75%, #facc15 100%)',
                          borderRadius: '12px 12px 0 0',
                          padding: 0
                        }}></td>
                      </tr>

                      {/* Spacer */}
                      <tr><td colSpan={3} style={{ height: '16px' }}></td></tr>

                      {/* Main Grid */}
                      <tr>
                        {/* Column 1: GoLive Branding (gradient panel box style) */}
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

                        {/* Column 2: GoLive Details */}
                        <td style={{
                          borderLeft: '2px solid #bfdbfe',
                          paddingLeft: '24px',
                          paddingRight: '16px',
                          verticalAlign: 'middle',
                          width: '280px'
                        }}>
                          <h3 style={{ fontSize: '21px', fontWeight: 800, color: '#0f172a', margin: 0, fontFamily: "'Outfit', sans-serif" }}>
                            {employee.firstName} {employee.lastName}
                          </h3>
                          <p style={{ fontSize: '12px', fontWeight: 700, color: '#1e40af', margin: '2px 0 0 0' }}>
                            {employee.designation}
                          </p>
                          <div style={{ width: '40px', height: '2.5px', background: 'linear-gradient(90deg, #1e40af 0%, #eab308 100%)', borderRadius: '9999px', margin: '8px 0 12px 0' }}></div>
                          
                          {/* Contacts Info Table */}
                          <table cellPadding="0" cellSpacing="0" style={{ width: '100%' }}>
                            <tbody>
                              <tr>
                                <td style={{ width: '28px', paddingBottom: '8px' }}>
                                  <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24', fontSize: '9px' }}>
                                    ✉
                                  </div>
                                </td>
                                <td style={{ fontSize: '11px', color: '#334155', fontWeight: 500, paddingBottom: '8px' }}>
                                  {employee.email}
                                </td>
                              </tr>
                              <tr>
                                <td style={{ width: '28px', paddingBottom: '8px' }}>
                                  <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24', fontSize: '9px' }}>
                                    ☎
                                  </div>
                                </td>
                                <td style={{ fontSize: '11px', color: '#334155', fontWeight: 500, paddingBottom: '8px' }}>
                                  {employee.phone}
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

                        {/* Column 3: GoLive QR section */}
                        <td style={{
                          borderLeft: '2px solid #bfdbfe',
                          paddingLeft: '20px',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          width: '140px'
                        }}>
                          <div style={{ padding: '6px', border: '2px solid #0052cc', borderRadius: '12px', background: 'linear-gradient(135deg, #f0f4ff, #e8eeff)', display: 'inline-block', boxShadow: '0 4px 14px rgba(0, 82, 204, 0.15)', marginBottom: '8px' }}>
                            <img src={employee.qrCodeUrl || '/GoLiveClasses_QR_Code.png'} style={{ width: '85px', height: '85px', objectFit: 'contain' }} alt="GoLive QR" />
                          </div>
                          <span style={{ fontSize: '9px', fontWeight: 605, color: '#475569', display: 'block', lineHeight: 1.2 }}>
                            Scan to check<br /><span style={{ fontWeight: 800, color: '#00173d' }}>Live Profile</span>
                          </span>
                          <div style={{ width: '20px', height: '2px', background: '#0052cc', borderRadius: '9999px', margin: '6px auto 0 auto' }}></div>
                        </td>
                      </tr>

                      {/* Divider line */}
                      <tr><td colSpan={3} style={{ height: '16px' }}></td></tr>
                      <tr>
                        <td colSpan={3} style={{ borderBottom: '1px solid #bfdbfe', height: '1px', padding: 0 }}></td>
                      </tr>
                      <tr><td colSpan={3} style={{ height: '12px' }}></td></tr>

                      {/* Legal Footer Notice */}
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

            {/* Controls Panel */}
            <div className="flex flex-wrap gap-4 justify-center">
              <button
                onClick={copySignatureToClipboard}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl px-6 py-3 font-bold text-xs uppercase tracking-wider shadow-lg flex items-center space-x-2"
              >
                <Copy size={16} />
                <span>Copy HTML to Clipboard</span>
              </button>
              <button
                onClick={downloadSignaturePng}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl px-6 py-3 font-bold text-xs uppercase tracking-wider shadow-lg flex items-center space-x-2"
              >
                <Download size={16} />
                <span>Download Signature PNG</span>
              </button>
            </div>

          </div>
        )}
      </div>

    </div>
  );
};

export default Signature;
