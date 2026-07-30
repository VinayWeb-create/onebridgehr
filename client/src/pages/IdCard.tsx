import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  CreditCard, Printer, Download, FlipHorizontal, RefreshCw, AlertCircle, PhoneCall
} from 'lucide-react';
import html2canvas from 'html2canvas';

interface EmployeeCard {
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
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
}

export const IdCard: React.FC = () => {
  const { user } = useAuth();
  
  const [employeeIdInput, setEmployeeIdInput] = useState('');
  const [cardData, setCardData] = useState<EmployeeCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    // Standard employees load their own details immediately
    if (user && user.role === 'EMPLOYEE') {
      fetchCard(user.employeeId);
    }
  }, [user]);

  const fetchCard = async (id: string) => {
    setLoading(true);
    setCardData(null);
    try {
      const res = await api.get(`/employees/${id}`);
      setCardData(res.data.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Employee not found');
    } finally {
      setLoading(false);
    }
  };

  const handleQuery = (e: React.FormEvent) => {
    e.preventDefault();
    if (employeeIdInput.trim()) {
      fetchCard(employeeIdInput.trim());
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPng = () => {
    const el = document.getElementById(isFlipped ? 'idCardBack' : 'idCardFront');
    if (!el) return;

    html2canvas(el, {
      useCORS: true,
      scale: 3,
    }).then((canvas) => {
      const link = document.createElement('a');
      link.download = `IDCard-${cardData?.firstName || 'Staff'}-${isFlipped ? 'Back' : 'Front'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-extrabold text-2xl tracking-tight text-brand-950 dark:text-white">Corporate ID Cards</h1>
          <p className="text-xs text-brand-500 mt-1 font-semibold">Generate corporate cards with animated flips and security QR codes</p>
        </div>
        {cardData && (
          <div className="flex space-x-3">
            <button
              onClick={handleDownloadPng}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl px-5 py-3 font-bold text-xs tracking-wider uppercase transition-all flex items-center space-x-2 shadow-md"
            >
              <Download size={16} />
              <span>Download PNG</span>
            </button>
            <button
              onClick={handlePrint}
              className="bg-brand-900 text-white dark:bg-brand-200 dark:text-brand-950 rounded-2xl px-5 py-3 font-bold text-xs tracking-wider uppercase transition-all flex items-center space-x-2 shadow-md"
            >
              <Printer size={16} />
              <span>Print ID Card</span>
            </button>
          </div>
        )}
      </div>

      {/* Query panel (for HR / Admins) */}
      {user?.role && ['HR', 'SUPER_ADMIN'].includes(user.role) && (
        <form onSubmit={handleQuery} className="flex space-x-4 max-w-sm">
          <input
            type="text"
            required
            placeholder="Search Employee ID (e.g. OBI0004)"
            value={employeeIdInput}
            onChange={(e) => setEmployeeIdInput(e.target.value)}
            className="w-full bg-white dark:bg-brand-900 border border-brand-200 dark:border-brand-800 rounded-2xl py-3 px-4 text-xs font-semibold outline-none focus:border-indigo-600 transition-all text-brand-950 dark:text-white shadow-sm"
          />
          <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl px-6 font-bold text-xs uppercase tracking-wider shadow-md">
            Query
          </button>
        </form>
      )}

      {/* Card Preview Frame */}
      <div className="flex flex-col items-center justify-center py-10 space-y-6">
        {loading ? (
          <span className="w-8 h-8 rounded-full border-2 border-indigo-600/30 border-t-indigo-600 animate-spin" />
        ) : !cardData ? (
          <div className="p-8 text-center text-xs text-brand-400 font-semibold border-2 border-dashed border-brand-200 dark:border-brand-800 rounded-3xl max-w-sm">
            <AlertCircle className="mx-auto text-brand-400 mb-3" size={24} />
            <p>Please query an employee ID to preview and print their corporate identity card.</p>
          </div>
        ) : (
          <>
            {/* Flip Card Stage */}
            <div className="print-area flex flex-col items-center space-y-4 max-w-full overflow-x-auto px-4 py-2">
              
              {/* Card Container (Vertical Credit Card standard dimensions) */}
              <div 
                onClick={() => setIsFlipped(!isFlipped)}
                className="w-[336px] h-[528px] cursor-pointer relative transition-all duration-700 ease-in-out select-none shadow-2xl border border-brand-200 dark:border-brand-850"
                style={{
                  perspective: '1000px',
                  transformStyle: 'preserve-3d',
                  transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                }}
              >
                
                {/* --- FRONT SIDE --- */}
                <div 
                  id="idCardFront"
                  className="absolute inset-0 bg-white text-slate-800 flex flex-col justify-between overflow-hidden backface-hidden"
                  style={{ 
                    backfaceVisibility: 'hidden',
                    width: '336px',
                    height: '528px',
                    fontFamily: "'Inter', sans-serif",
                    position: 'absolute'
                  }}
                >
                  {/* High-Precision SVG Layer */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 640 1010" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <pattern id="dotPattern" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
                        <circle cx="6" cy="6" r="2.8" fill="#f97316" opacity="0.75" />
                      </pattern>
                      <linearGradient id="skylineFade" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
                        <stop offset="1" stopColor="#ffffff" stopOpacity="0.03" />
                      </linearGradient>
                    </defs>
                    <rect x="0" y="0" width="640" height="1010" fill="#ffffff" />
                    <rect x="15" y="20" width="160" height="140" fill="url(#dotPattern)" />
                    <g fill="none" stroke="#f97316" strokeWidth="2" opacity="0.20">
                      <circle cx="720" cy="-40" r="260" />
                      <circle cx="720" cy="-40" r="200" />
                      <circle cx="720" cy="-40" r="140" />
                      <circle cx="720" cy="-40" r="80" />
                    </g>
                    <path d="M 0,280 L 75,370 L 75,640 L 150,830 L 150,950 L 0,950 Z" fill="#334155" />
                    <path d="M 640,280 L 565,370 L 565,640 L 490,830 L 490,950 L 640,950 Z" fill="#334155" />
                    <g stroke="url(#skylineFade)" strokeWidth="2" fill="none">
                      <path d="M 10,950 V 710 H 25 V 950 M 30,950 V 680 H 45 V 950 M 50,950 V 740 H 65 V 950 M 70,950 V 780 H 80 V 950" />
                      <path d="M 15,720 H 22 M 15,740 H 22 M 35,695 H 42 M 35,715 H 42 M 35,735 H 42 M 35,755 H 42" />
                      <path d="M 560,950 V 780 H 570 V 950 M 575,950 V 740 H 590 V 950 M 595,950 V 680 H 610 V 950 M 615,950 V 710 H 630 V 950" />
                      <path d="M 578,695 H 587 M 578,715 H 587 M 578,735 H 587 M 598,720 H 607" />
                    </g>
                    <path d="M 0,280 L 75,370 L 60,430 L 0,350 Z" fill="#f97316" />
                    <path d="M 0,350 L 60,430 L 0,660 Z" fill="#f97316" opacity="0.85" />
                    <path d="M 640,280 L 565,370 L 580,430 L 640,350 Z" fill="#f97316" />
                    <path d="M 640,350 L 580,430 L 640,660 Z" fill="#f97316" opacity="0.85" />
                    <path d="M 0,280 L 75,370 L 75,640 L 150,830 L 150,950 L 490,950 L 490,830 L 565,640 L 565,370 L 640,280" fill="none" stroke="#f97316" strokeWidth="12" strokeLinejoin="round" strokeLinecap="round" />
                    <rect x="0" y="942" width="640" height="68" fill="#f97316" />
                  </svg>

                  {/* Header Branding Container */}
                  <div style={{ position: 'relative', zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '30px 18px 0', height: 'calc(100% - 60px)', boxSizing: 'border-box' }}>
                    <div style={{ height: '90px', width: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', background: 'transparent', position: 'relative', zIndex: 20 }}>
                      <img src="/image.png" style={{ maxHeight: '75px', maxWidth: '100%', objectFit: 'contain' }} alt="OneBridge Logo" />
                    </div>
                    <div className="font-brand" style={{ fontWeight: 800, fontSize: '20px', letterSpacing: '-0.02em', whiteSpace: 'nowrap', marginTop: '4px', marginBottom: '12px' }}>
                      <span style={{ color: '#f97316' }}>Onebridge</span> <span style={{ color: '#111827' }}>Infotech</span>
                    </div>

                    {/* Circular profile image card */}
                    <div style={{ width: '136px', height: '136px', margin: '0 auto 6px', padding: '4px', border: '5px solid #f97316', borderRadius: '50%', background: '#ffffff', position: 'relative', overflow: 'hidden', flexShrink: 0, boxShadow: '0 12px 24px rgba(0,0,0,0.15)', zIndex: 20 }}>
                      {cardData.profileImageUrl ? (
                        <img src={cardData.profileImageUrl} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt="ID Photo" />
                      ) : (
                        <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-extrabold text-3xl uppercase">
                          {cardData.firstName[0]}{cardData.lastName[0]}
                        </div>
                      )}
                    </div>

                    {/* Employee Profile Metadata */}
                    <h3 className="font-brand" style={{ marginTop: '6px', fontWeight: 800, fontSize: '22px', lineHeight: '1.1', marginBottom: '2px', color: '#0f172a', zIndex: 20, position: 'relative' }}>
                      {cardData.firstName} {cardData.lastName}
                    </h3>
                    <div style={{ width: '50px', height: '3px', borderRadius: '2px', background: '#f97316', margin: '6px auto', zIndex: 20, position: 'relative' }}></div>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: '#334155', lineHeight: '1.2', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 auto 2px', zIndex: 20, position: 'relative' }}>
                      {cardData.designation}
                    </p>
                    <p style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', margin: '0 auto 10px', zIndex: 20, position: 'relative' }}>
                      {cardData.department}
                    </p>

                    {/* Validation QR Code Box */}
                    <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', zIndex: 20 }}>
                      <div style={{ width: '80px', height: '80px', padding: '4px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 8px 16px rgba(0,0,0,0.08)' }}>
                        {cardData.qrCodeUrl ? (
                          <img src={cardData.qrCodeUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="QR Code" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold text-xs">QR</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer tagline */}
                  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30, paddingBottom: '24px' }}>
                    <span style={{ color: '#ffffff', fontSize: '9px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      INNOVATE &nbsp; | &nbsp; AUTOMATE &nbsp; | &nbsp; TRANSFORM
                    </span>
                  </div>
                </div>

                {/* --- BACK SIDE --- */}
                <div 
                  id="idCardBack"
                  className="absolute inset-0 bg-slate-800 text-white flex flex-col justify-between overflow-hidden border border-slate-900"
                  style={{
                    transform: 'rotateY(180deg)',
                    backfaceVisibility: 'hidden',
                    width: '336px',
                    height: '528px',
                    position: 'absolute'
                  }}
                >
                  {/* High-Precision SVG Layer for Back Side */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 640 1010" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="0" y="0" width="640" height="1010" fill="#1e293b" />
                    <g fill="none" stroke="#f97316" strokeWidth="2" opacity="0.10">
                      <circle cx="-80" cy="1050" r="300" />
                      <circle cx="-80" cy="1050" r="220" />
                      <circle cx="-80" cy="1050" r="140" />
                    </g>
                    <path d="M 0,0 L 640,0 L 640,80 L 400,240 L 0,160 Z" fill="#334155" opacity="0.4" />
                    <path d="M 0,0 L 640,0 L 640,20 L 0,20 Z" fill="#f97316" />
                    <rect x="0" y="942" width="640" height="68" fill="#f97316" />
                  </svg>

                  <div style={{ position: 'relative', zIndex: 10, padding: '36px 24px 0', display: 'flex', flexDirection: 'column', height: 'calc(100% - 60px)' }}>
                    {/* Header title */}
                    <div className="pb-3 border-b border-white/10" style={{ marginTop: '12px' }}>
                      <h4 className="font-extrabold text-[11px] tracking-wide text-orange-400 uppercase">OneBridge Guidelines</h4>
                    </div>

                    {/* Content guidelines text block */}
                    <div className="space-y-4 text-[10px] leading-relaxed text-slate-300" style={{ marginTop: '24px' }}>
                      <p>
                        <strong>Instructions:</strong> This identity card is property of OneBridge Infotech Pvt. Ltd. It must be worn prominently at all times on company premises.
                      </p>
                      <p>
                        In case of loss or theft, report immediately to the Human Resources department. Any misuse is subject to corporate disciplinary actions.
                      </p>
                      <p>
                        <strong>Address:</strong> Floor 5, Block B, Tech Hub, Bangalore - 560001
                      </p>
                      <p>
                        <strong>Website:</strong> www.onebridgeinfotech.com
                      </p>
                    </div>

                    {/* Spacer to push emergency card to bottom */}
                    <div className="flex-grow"></div>

                    {/* Emergency details */}
                    {cardData.emergencyContact && (
                      <div className="flex items-start space-x-3 text-[10px] font-semibold text-slate-200 bg-slate-900/60 p-4 rounded-xl border border-slate-700/50 mb-6">
                        <PhoneCall size={12} className="text-rose-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-white uppercase text-[9px] tracking-wider">Emergency Contact:</p>
                          <p className="mt-1 text-slate-100">{cardData.emergencyContact.name} ({cardData.emergencyContact.relationship})</p>
                          <p className="text-orange-400 font-extrabold mt-0.5">{cardData.emergencyContact.phone}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer metadata details */}
                  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 30, padding: '0 24px 24px 24px', boxSizing: 'border-box' }}>
                    <span style={{ color: '#ffffff', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase' }}>
                      Valid: {new Date(cardData.validity).toLocaleDateString()}
                    </span>
                    <span style={{ color: '#ffffff', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase' }}>
                      OBI STAFF
                    </span>
                  </div>
                </div>

              </div>

              {/* Tips / controls */}
              <div className="flex items-center space-x-2.5 text-xs text-brand-500 font-bold tracking-wide uppercase bg-brand-100/50 dark:bg-brand-900/50 px-4 py-2.5 rounded-full">
                <RefreshCw size={12} className="animate-spin" />
                <span>Click Card to Flip / Preview details</span>
              </div>
            </div>
          </>
        )}
      </div>

    </div>
  );
};

export default IdCard;
