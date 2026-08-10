import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, Mail, LogIn, PartyPopper, Clock } from 'lucide-react';

export const OfferAccepted: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(15);

  const status = params.get('status');
  const name = params.get('name') || '';
  const email = params.get('email') || '';

  const isAlreadyAccepted = status === 'already_accepted' || status === 'already_joined';

  useEffect(() => {
    if (countdown <= 0) {
      navigate('/login');
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, navigate]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 40%, #fed7aa 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        padding: '24px',
      }}
    >
      {/* Animated background circles */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', top: '-80px', left: '-80px',
          width: '320px', height: '320px', borderRadius: '50%',
          background: 'rgba(234,88,12,0.08)',
          animation: 'pulse 4s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: '-60px', right: '-60px',
          width: '260px', height: '260px', borderRadius: '50%',
          background: 'rgba(234,88,12,0.06)',
          animation: 'pulse 6s ease-in-out infinite reverse',
        }} />
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounceIn { 0% { transform: scale(0); } 70% { transform: scale(1.1); } 100% { transform: scale(1); } }
        .card { animation: fadeInUp 0.6s ease-out both; }
        .check-icon { animation: bounceIn 0.8s cubic-bezier(0.36,0.07,0.19,0.97) 0.3s both; }
        .info-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: rgba(255,255,255,0.7); border-radius: 10px; margin-bottom: 10px; }
        .info-label { font-size: 13px; color: #78350f; font-weight: 500; min-width: 110px; }
        .info-value { font-size: 13px; color: #1c1917; font-weight: 600; }
        .btn-primary { background: linear-gradient(135deg, #ea580c, #c2410c); color: white; border: none; border-radius: 10px; padding: 14px 28px; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; box-shadow: 0 4px 12px rgba(234,88,12,0.3); }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(234,88,12,0.4); }
        .progress-bar { height: 4px; background: #fed7aa; border-radius: 4px; overflow: hidden; margin-top: 20px; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #ea580c, #f97316); border-radius: 4px; transition: width 1s linear; }
      `}</style>

      <div className="card" style={{
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        padding: '48px 40px',
        maxWidth: '520px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
        border: '1px solid rgba(255,255,255,0.6)',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Header Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10,
            background: 'linear-gradient(135deg, #ea580c, #c2410c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: 'white', fontSize: 20 }}>🏢</span>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#1c1917' }}>OneBridge Infotech</div>
            <div style={{ fontSize: 11, color: '#78350f' }}>Human Resources</div>
          </div>
        </div>

        {/* Success Icon */}
        <div className="check-icon" style={{ display: 'inline-flex', marginBottom: 24, position: 'relative' }}>
          <div style={{
            width: 90, height: 90, borderRadius: '50%',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(34,197,94,0.35)',
          }}>
            <CheckCircle2 size={44} color="white" strokeWidth={2.5} />
          </div>
          <div style={{ position: 'absolute', top: -6, right: -6, fontSize: 22 }}>🎉</div>
        </div>

        {/* Title */}
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1c1917', margin: '0 0 8px 0' }}>
          {isAlreadyAccepted ? 'Already Accepted!' : 'Offer Accepted!'}
        </h1>
        <p style={{ fontSize: 15, color: '#78350f', fontWeight: 600, margin: '0 0 24px 0' }}>
          {isAlreadyAccepted
            ? 'This offer has already been confirmed.'
            : `Welcome to OneBridge Infotech${name ? `, ${name}` : ''}! 🚀`}
        </p>

        {/* Info Cards */}
        {!isAlreadyAccepted && (
          <div style={{ textAlign: 'left', marginBottom: 28 }}>
            {email && (
              <div className="info-row">
                <Mail size={16} color="#ea580c" />
                <span className="info-label">Login Email:</span>
                <span className="info-value">{email}</span>
              </div>
            )}
            <div className="info-row">
              <PartyPopper size={16} color="#ea580c" />
              <span className="info-label">Credentials:</span>
              <span className="info-value">Sent to your email inbox</span>
            </div>
            <div className="info-row">
              <CheckCircle2 size={16} color="#22c55e" />
              <span className="info-label">HR Status:</span>
              <span className="info-value" style={{ color: '#16a34a' }}>✅ Updated to Active</span>
            </div>
          </div>
        )}

        {isAlreadyAccepted && (
          <div style={{ marginBottom: 28, padding: '16px', background: '#fef3c7', borderRadius: 12, border: '1px solid #fcd34d' }}>
            <p style={{ fontSize: 14, color: '#92400e', margin: 0 }}>
              Your offer was previously accepted. Please check your email for your login credentials.
            </p>
          </div>
        )}

        {/* CTA Button */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <button className="btn-primary" onClick={() => navigate('/login')}>
            <LogIn size={18} />
            Go to Login Portal
          </button>
        </div>

        {/* Auto redirect */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#a16207', fontSize: 12 }}>
          <Clock size={13} />
          <span>Redirecting to login in <strong>{countdown}s</strong>…</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(countdown / 15) * 100}%` }} />
        </div>

        {/* Footer */}
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #fed7aa' }}>
          <p style={{ fontSize: 12, color: '#a16207', margin: 0 }}>
            © 2026 OneBridge Infotech Pvt. Ltd. | hr@onebridgeinfotech.com
          </p>
        </div>
      </div>
    </div>
  );
};

export default OfferAccepted;
