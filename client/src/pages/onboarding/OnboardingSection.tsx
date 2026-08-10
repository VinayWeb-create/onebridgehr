import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { renderAsync } from 'docx-preview';
import {
  CheckCircle, UploadCloud, FileText, PenTool, Image as ImageIcon,
  AlertTriangle, Loader, Trash2, Check, ShieldCheck, PartyPopper,
  ExternalLink, ListChecks, Lock, Download, Type, Save,
  ChevronLeft, ChevronRight, Clock,
} from 'lucide-react';

const EDITABLE_TOKENS = [
  'date', 'dateOfBirth', 'phone', 'currentAddress', 'permanentAddress',
  'emergencyName', 'emergencyRelationship', 'emergencyPhone',
  'bankAccountNumber', 'ifscCode',
];
const BLANK_EDITABLE_TOKENS = ['pan', 'aadhaar'];

type DocKey = 'aadhaar' | 'pan' | 'resume' | 'passportPhoto' | 'nda' | 'otherDocuments';

interface DocDef {
  key: DocKey;
  label: string;
  required: boolean;
  multiple?: boolean;
  accept: string;
  hint?: string;
}

const DOC_DEFS: DocDef[] = [
  { key: 'aadhaar', label: 'Aadhaar Card', required: true, accept: 'application/pdf, image/jpeg, image/png' },
  { key: 'pan', label: 'PAN Card', required: true, accept: 'application/pdf, image/jpeg, image/png' },
  { key: 'resume', label: 'Resume', required: true, accept: 'application/pdf', hint: 'PDF only' },
  { key: 'passportPhoto', label: 'Passport Size Photo', required: true, accept: 'image/jpeg, image/png', hint: 'JPG / PNG' },
  { key: 'nda', label: 'Signed NDA', required: false, accept: 'application/pdf, image/jpeg, image/png' },
  { key: 'otherDocuments', label: 'Other Documents', required: false, multiple: true, accept: 'application/pdf, image/jpeg, image/png', hint: 'Up to 5 files' },
];

const REQUIRED_DOCS = DOC_DEFS.filter((d) => d.required).map((d) => d.key);

const SIGNATURE_FONTS = [
  { label: 'Classic Cursive', value: "'Brush Script MT', cursive" },
  { label: 'Elegant Script', value: "'Segoe Script', cursive" },
  { label: 'Handwritten', value: "'Lucida Handwriting', cursive" },
  { label: 'Flowing Script', value: "'Great Vibes', 'Dancing Script', cursive" },
  { label: 'Modern Cursive', value: "'Dancing Script', cursive" },
];

const INITIAL_FILES: { [key in DocKey]: File | File[] | null } = {
  aadhaar: null, pan: null, resume: null, passportPhoto: null, nda: null, otherDocuments: [],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_DOC_EXT = ['pdf', 'png', 'jpg', 'jpeg'];

const validateFile = (file: File): string | null => {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_DOC_EXT.includes(ext)) return `"${file.name}" is not supported. Allowed: PDF, PNG, JPG.`;
  if (file.size > MAX_FILE_SIZE) return `"${file.name}" exceeds 10 MB.`;
  return null;
};

export const OnboardingSection: React.FC = () => {
  const navigate = useNavigate();
  const { updateUserCache } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [onboarding, setOnboarding] = useState<any>(null);
  const [step, setStep] = useState(1);
  const [docLoading, setDocLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [declaration, setDeclaration] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [savedInfo, setSavedInfo] = useState<any>(null);

  const [formData, setFormData] = useState<any>({
    fullName: '', firstName: '', lastName: '', email: '', phone: '',
    dateOfBirth: '', gender: 'Male', currentAddress: '', permanentAddress: '',
    aadhaar: '', pan: '', bankAccountNumber: '', ifscCode: '',
    emergencyName: '', emergencyRelationship: '', emergencyPhone: '',
    position: '', department: '', joiningDate: '', date: '',
    signatureData: '', signatureType: 'DRAW' as 'DRAW' | 'UPLOAD' | 'TYPE',
    signatureText: '', signatureStyle: SIGNATURE_FONTS[0].value, signatureSize: 44,
  });

  const [files, setFiles] = useState<{ [key in DocKey]: File | File[] | null }>(INITIAL_FILES);

  const sigCanvas = useRef<HTMLCanvasElement>(null);
  const docContainer = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const formatDate = (d: Date | string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const tokenValue = useCallback(
    (token: string, rawForInput = false): string => {
      const ol = onboarding?.offerLetter || {};
      switch (token) {
        case 'candidateName': return formData.fullName || ol.candidateName || '';
        case 'date': { const d = formData.date || new Date().toISOString().split('T')[0]; return rawForInput ? d : formatDate(d); }
        case 'position': return formData.position || ol.role || '';
        case 'department': return formData.department || ol.department || '';
        case 'joiningDate': { const r = formData.joiningDate || (ol.joiningDate ? new Date(ol.joiningDate).toISOString().split('T')[0] : ''); return !r ? '' : rawForInput ? r : formatDate(r); }
        case 'email': return formData.email || ol.candidateEmail || '';
        case 'dateOfBirth': { const r = formData.dateOfBirth; return !r ? '' : rawForInput ? r : formatDate(r); }
        default: return (formData as any)[token] || '';
      }
    }, [formData, onboarding]
  );

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await api.get('/onboarding/my-onboarding');
      const ob = res.data.data?.onboarding;
      if (!ob) {
        setError('No onboarding record found. You may have already completed onboarding.');
        return;
      }
      setOnboarding(ob);
      const prefill = res.data.data.prefill || {};
      const prev = ob.candidateData || {};
      if (prev.lastSavedAt) setLastSavedAt(prev.lastSavedAt);

      // Check if already submitted
      if (['DOCUMENTS_SUBMITTED', 'HR_VERIFICATION', 'DOCUMENTS_VERIFIED', 'APPROVED', 'COMPLETED'].includes(ob.status)) {
        setSubmitted(true);
      }

      setFormData((p: any) => ({
        ...p,
        fullName: prev.fullName || prefill.fullName || ob.offerLetter?.candidateName || '',
        firstName: prev.firstName || prefill.firstName || '',
        lastName: prev.lastName || prefill.lastName || '',
        email: prev.email || ob.offerLetter?.candidateEmail || prefill.email || '',
        phone: prev.phone || prefill.phone || '',
        dateOfBirth: prev.dateOfBirth || prefill.dateOfBirth || '',
        gender: prev.gender || prefill.gender || 'Male',
        currentAddress: prev.currentAddress || prefill.currentAddress || '',
        permanentAddress: prev.permanentAddress || prefill.permanentAddress || '',
        aadhaar: prev.aadhaar || prefill.aadhaar || '',
        pan: prev.pan || prefill.pan || '',
        emergencyName: prev.emergencyContact?.name || prefill.emergencyName || '',
        emergencyPhone: prev.emergencyContact?.phone || prefill.emergencyPhone || '',
        emergencyRelationship: prev.emergencyContact?.relationship || prefill.emergencyRelationship || '',
        position: prev.position || prefill.position || ob.offerLetter?.role || '',
        department: prev.department || prefill.department || ob.offerLetter?.department || '',
        joiningDate: prev.joiningDate || prefill.joiningDate || (ob.offerLetter?.joiningDate ? new Date(ob.offerLetter.joiningDate).toISOString().split('T')[0] : ''),
        bankAccountNumber: prev.bankAccountNumber || prefill.bankAccountNumber || '',
        ifscCode: prev.ifscCode || prefill.ifscCode || '',
        signatureType: ob.signatureType || 'DRAW',
        signatureData: ob.signatureData || '',
        signatureText: ob.signatureText || '',
      }));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load onboarding data.');
    } finally {
      setLoading(false);
    }
  };

  const loadDocument = useCallback(async () => {
    if (!docContainer.current) return;
    setDocLoading(true);
    try {
      const res = await api.get('/onboarding/my-onboarding/template', { responseType: 'arraybuffer' });
      const container = docContainer.current;
      container.innerHTML = '';
      await renderAsync(res.data, container, undefined, {
        inWrapper: true, breakPages: true, ignoreWidth: false,
        renderHeaders: true, renderFooters: true, renderFootnotes: true, renderEndnotes: true,
      });
      applyPlaceholders();
      applySignature();
    } catch (err) {
      console.error('Failed to load DOCX:', err);
    } finally {
      setDocLoading(false);
    }
  }, [onboarding]);

  const applyPlaceholders = useCallback(() => {
    const container = docContainer.current;
    if (!container) return;
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) { nodes.push(node as Text); node = walker.nextNode(); }
    nodes.forEach((n) => {
      const text = n.nodeValue || '';
      if (!text.includes('{')) return;
      const parts = text.split(/(\{[a-zA-Z]+\})/);
      if (parts.length === 1) return;
      const frag = document.createDocumentFragment();
      parts.forEach((part) => {
        if (!part) return;
        const m = part.match(/^\{([a-zA-Z]+)\}$/);
        if (m) {
          const tokenName = m[1];
          const editable = EDITABLE_TOKENS.includes(tokenName) || (BLANK_EDITABLE_TOKENS.includes(tokenName) && !tokenValue(tokenName));
          if (editable) {
            const input = document.createElement('input');
            input.setAttribute('data-token', tokenName);
            const isDateToken = ['date', 'dateOfBirth', 'joiningDate'].includes(tokenName);
            input.type = isDateToken ? 'date' : 'text';
            input.className = 'portal-editable-input';
            input.value = tokenValue(tokenName, isDateToken);
            input.oninput = (e) => {
              const val = (e.target as HTMLInputElement).value;
              setFormData((prev: any) => ({ ...prev, [tokenName === 'candidateName' ? 'fullName' : tokenName]: val }));
            };
            frag.appendChild(input);
          } else {
            const span = document.createElement('span');
            span.setAttribute('data-token', tokenName);
            span.className = 'portal-locked';
            span.textContent = tokenValue(tokenName);
            frag.appendChild(span);
          }
        } else {
          frag.appendChild(document.createTextNode(part));
        }
      });
      n.parentNode?.replaceChild(frag, n);
    });
  }, [tokenValue]);

  const applySignature = useCallback(() => {
    const container = docContainer.current;
    if (!container || !formData.signatureData) return;
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) { nodes.push(node as Text); node = walker.nextNode(); }
    nodes.forEach((n) => {
      const text = n.nodeValue || '';
      if (!/^_{3,}$/.test(text.trim())) return;
      const img = document.createElement('img');
      img.src = formData.signatureData;
      img.className = 'portal-signature-img';
      n.parentNode?.replaceChild(img, n);
    });
  }, [formData.signatureData]);

  useEffect(() => {
    if (onboarding && !submitted) loadDocument();
  }, [onboarding, loadDocument, submitted]);

  useEffect(() => { applySignature(); }, [formData.signatureData, applySignature]);

  // Signature drawing
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const ctx = sigCanvas.current?.getContext('2d');
    if (!ctx) return;
    const rect = sigCanvas.current!.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = sigCanvas.current?.getContext('2d');
    if (!ctx) return;
    const rect = sigCanvas.current!.getBoundingClientRect();
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e293b';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };
  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const dataUrl = sigCanvas.current?.toDataURL('image/png');
    if (dataUrl) setFormData((p: any) => ({ ...p, signatureData: dataUrl }));
  };
  const clearCanvas = () => {
    const ctx = sigCanvas.current?.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, 400, 150);
    setFormData((p: any) => ({ ...p, signatureData: '' }));
  };

  const handleSignatureImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) setFormData((p: any) => ({ ...p, signatureData: ev.target!.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const generateTypeSignature = useCallback(() => {
    if (!formData.signatureText || formData.signatureType !== 'TYPE') return;
    const canvas = document.createElement('canvas');
    canvas.width = 400; canvas.height = 150;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 400, 150);
    ctx.font = `${formData.signatureSize}px ${formData.signatureStyle}`;
    ctx.fillStyle = '#1e293b';
    ctx.textBaseline = 'middle';
    ctx.fillText(formData.signatureText, 20, 75);
    setFormData((p: any) => ({ ...p, signatureData: canvas.toDataURL('image/png') }));
  }, [formData.signatureText, formData.signatureType, formData.signatureStyle, formData.signatureSize]);

  useEffect(() => { generateTypeSignature(); }, [generateTypeSignature]);

  const buildCandidateData = () => ({
    ...formData,
    emergencyContact: { name: formData.emergencyName, phone: formData.emergencyPhone, relationship: formData.emergencyRelationship },
    lastSavedAt: new Date().toISOString(),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.post('/onboarding/my-onboarding/save', { candidateData: buildCandidateData() });
      const data = res.data.data;
      setLastSavedAt(data.lastSavedAt || new Date().toISOString());
      if (data.pdf || data.docx) setSavedInfo({ pdf: data.pdf?.url, docx: data.docx?.url });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!declaration) return alert('Please check the declaration box.');
    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append('candidateData', JSON.stringify(buildCandidateData()));
      for (const def of DOC_DEFS) {
        const f = files[def.key];
        if (!f) continue;
        if (Array.isArray(f)) { f.forEach((file) => payload.append(def.key, file)); }
        else { payload.append(def.key, f); }
      }
      await api.post('/onboarding/my-onboarding/submit', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSubmitted(true);
      updateUserCache({ onboardingPending: false });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getFilesFor = (key: DocKey): File[] => {
    const f = files[key];
    if (!f) return [];
    return Array.isArray(f) ? f : [f];
  };

  const handleFileChange = (key: DocKey, e: React.ChangeEvent<HTMLInputElement>, multiple = false) => {
    const selectedFiles = Array.from(e.target.files || []);
    for (const f of selectedFiles) { const err = validateFile(f); if (err) { alert(err); return; } }
    setFiles((prev) => ({ ...prev, [key]: multiple ? [...(prev[key] as File[] || []), ...selectedFiles].slice(0, 5) : selectedFiles[0] }));
  };

  const removeFile = (key: DocKey, index?: number) => {
    setFiles((prev) => {
      if (index !== undefined && Array.isArray(prev[key])) {
        const arr = [...(prev[key] as File[])];
        arr.splice(index, 1);
        return { ...prev, [key]: arr };
      }
      return { ...prev, [key]: null };
    });
  };

  const hasSignature = !!formData.signatureData;
  const allRequiredDocs = REQUIRED_DOCS.every((k) => getFilesFor(k).length > 0);

  const stepMeta = [
    { n: 1, label: 'Review & Sign' },
    { n: 2, label: 'Upload Docs' },
    { n: 3, label: 'Review & Submit' },
  ];

  const goNext = () => setStep((s) => Math.min(s + 1, 3));
  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader size={32} className="animate-spin text-indigo-600" />
    </div>
  );

  if (error) return (
    <div className="max-w-xl mx-auto mt-12 bg-white rounded-3xl shadow-xl border border-gray-100 p-10 text-center">
      <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertTriangle size={32} className="text-amber-500" />
      </div>
      <h2 className="text-xl font-extrabold text-gray-900 mb-2">Onboarding Not Available</h2>
      <p className="text-sm text-gray-500">{error}</p>
      <button onClick={() => navigate('/dashboard')} className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-full font-bold text-sm">
        Go to Dashboard
      </button>
    </div>
  );

  if (submitted) return (
    <div className="max-w-xl mx-auto mt-12 bg-white rounded-3xl shadow-xl border border-gray-100 p-10 text-center">
      <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <PartyPopper size={40} className="text-emerald-500" />
      </div>
      <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Documents Submitted Successfully!</h2>
      <p className="text-sm text-gray-500 mb-4">
        Your onboarding documents and signed acceptance letter have been uploaded securely.
        You will be notified once HR completes the verification.
      </p>
      {onboarding?.candidateData?.referenceNumber && (
        <p className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-4 py-1.5 inline-block mb-4">
          Ref No: {onboarding.candidateData.referenceNumber}
        </p>
      )}
      {onboarding?.candidateData?.folderUrl && (
        <a href={onboarding.candidateData.folderUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 hover:underline">
          <ExternalLink size={13} /> Open Documents Folder
        </a>
      )}
      <div className="mt-6">
        <button onClick={() => navigate('/dashboard')} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-full font-bold text-sm">
          Back to Dashboard
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Complete Your Onboarding</h1>
          <p className="text-xs text-gray-500 mt-1">Review, sign the acceptance document, and upload your personal documents.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={saving || submitting} className="flex items-center gap-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-4 py-2 rounded-full">
            <Save size={14} /> {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <span className="text-xs font-bold text-indigo-600 uppercase bg-indigo-50 px-3 py-1 rounded-full">
            {onboarding?.status?.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Stepper */}
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {stepMeta.map((s, i) => (
            <React.Fragment key={s.n}>
              <div className="flex items-center gap-3 flex-1">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                  step === s.n ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : step > s.n ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {step > s.n ? <Check size={16} /> : s.n}
                </div>
                <span className={`hidden sm:block text-xs font-bold ${step === s.n ? 'text-gray-900' : 'text-gray-400'}`}>{s.label}</span>
              </div>
              {i < stepMeta.length - 1 && <div className={`h-0.5 flex-1 rounded ${step > s.n ? 'bg-emerald-400' : 'bg-gray-200'}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step 1: Document Editor + Signature */}
      {step === 1 && (
        <>
          <div className="text-center">
            <h2 className="text-xl font-extrabold text-gray-900">Review & Sign Your Acceptance Letter</h2>
            <p className="text-sm text-gray-500 mt-1">Edit highlighted fields. Company clauses are locked.</p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            {docLoading && (
              <div className="flex items-center justify-center py-20 text-indigo-600">
                <Loader size={28} className="animate-spin mr-3" /> Loading document...
              </div>
            )}
            <div ref={docContainer} className="max-w-[820px] mx-auto overflow-x-auto p-6" />
          </div>

          <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
            <Lock size={12} /> Company clauses are locked. Only highlighted fields are editable.
          </p>

          {/* Digital Signature */}
          <section className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
            <h3 className="text-sm font-bold text-indigo-600 uppercase mb-4 border-b pb-2 flex items-center gap-2">
              <PenTool size={16} /> Digital Signature
            </h3>
            <div className="flex bg-gray-100 p-1 rounded-xl mb-4 max-w-md mx-auto">
              {(['DRAW', 'UPLOAD', 'TYPE'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setFormData((p: any) => ({ ...p, signatureType: t }))}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${
                    formData.signatureType === t ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  {t === 'DRAW' ? <><PenTool size={14} /> Draw</> : t === 'UPLOAD' ? <><ImageIcon size={14} /> Upload</> : <><Type size={14} /> Type</>}
                </button>
              ))}
            </div>
            <div className="border rounded-xl p-4 bg-gray-50 flex flex-col items-center min-h-[200px] justify-center">
              {formData.signatureType === 'DRAW' && (
                <>
                  <p className="text-xs text-gray-500 mb-4">Draw your signature below</p>
                  <canvas ref={sigCanvas} width={400} height={150}
                    className="border-2 border-dashed border-gray-300 bg-white rounded-lg cursor-crosshair touch-none"
                    onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseOut={stopDrawing} />
                  <button type="button" onClick={clearCanvas} className="mt-4 text-xs text-rose-600 font-bold hover:underline">Clear Canvas</button>
                </>
              )}
              {formData.signatureType === 'UPLOAD' && (
                <>
                  <p className="text-xs text-gray-500 mb-4">Upload a transparent PNG of your signature</p>
                  <label className="flex items-center gap-2 bg-white border border-gray-300 px-6 py-3 rounded-xl cursor-pointer hover:bg-gray-50 shadow-sm text-sm font-bold text-gray-700">
                    <UploadCloud size={18} /> {formData.signatureData ? 'Replace Image' : 'Select Image'}
                    <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleSignatureImageUpload} />
                  </label>
                </>
              )}
              {formData.signatureType === 'TYPE' && (
                <>
                  <p className="text-xs text-gray-500 mb-4">Type your full name</p>
                  <input type="text" value={formData.signatureText} onChange={(e) => setFormData((p: any) => ({ ...p, signatureText: e.target.value }))}
                    placeholder="Your full name" className="w-full max-w-sm text-center border border-gray-300 rounded-xl px-4 py-3 text-lg focus:outline-none focus:border-indigo-500 mb-3" />
                  <select value={formData.signatureStyle} onChange={(e) => setFormData((p: any) => ({ ...p, signatureStyle: e.target.value }))}
                    className="text-xs border border-gray-300 rounded-lg px-3 py-2 mb-3">
                    {SIGNATURE_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </>
              )}
              {formData.signatureData && (
                <div className="mt-4 border border-gray-200 rounded-xl bg-white p-3">
                  <img src={formData.signatureData} alt="Signature Preview" className="max-h-16" />
                </div>
              )}
            </div>
          </section>

          <div className="flex justify-center">
            <button type="button" onClick={goNext} disabled={!hasSignature}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-3 rounded-full font-bold shadow-xl shadow-indigo-600/30 transition-all flex items-center gap-2 disabled:opacity-50">
              Continue to Upload Documents <ChevronRight size={18} />
            </button>
          </div>
        </>
      )}

      {/* Step 2: Document Upload */}
      {step === 2 && (
        <>
          <div className="text-center">
            <h2 className="text-xl font-extrabold text-gray-900">Upload Your Documents</h2>
            <p className="text-sm text-gray-500 mt-1">Upload required personal documents in PDF/JPG/PNG format.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {DOC_DEFS.map((def) => (
              <div key={def.key} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <FileText size={14} className="text-indigo-600" /> {def.label}
                    {def.required && <span className="text-[10px] text-rose-500 font-bold">*</span>}
                  </h4>
                  {def.hint && <span className="text-[10px] text-gray-400 font-bold">{def.hint}</span>}
                </div>
                {getFilesFor(def.key).length > 0 ? (
                  <div className="space-y-2 mb-3">
                    {getFilesFor(def.key).map((f, i) => (
                      <div key={i} className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                        <span className="text-xs font-semibold text-emerald-800 truncate flex-1">{f.name}</span>
                        <button type="button" onClick={() => removeFile(def.key, def.multiple ? i : undefined)}
                          className="text-rose-500 hover:text-rose-700 ml-2"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <label className="flex items-center gap-2 border-2 border-dashed border-gray-200 rounded-xl px-4 py-3 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors">
                  <UploadCloud size={18} className="text-gray-400" />
                  <span className="text-xs font-semibold text-gray-500">{getFilesFor(def.key).length > 0 ? 'Replace' : 'Choose file'}</span>
                  <input type="file" accept={def.accept} multiple={def.multiple} className="hidden"
                    onChange={(e) => handleFileChange(def.key, e, def.multiple)} />
                </label>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-4">
            <button type="button" onClick={goBack} className="bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50 px-8 py-3 rounded-full font-bold shadow-lg flex items-center gap-2">
              <ChevronLeft size={18} /> Back
            </button>
            <button type="button" onClick={goNext} disabled={!allRequiredDocs}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-3 rounded-full font-bold shadow-xl shadow-indigo-600/30 flex items-center gap-2 disabled:opacity-50">
              Review & Submit <ChevronRight size={18} />
            </button>
          </div>
        </>
      )}

      {/* Step 3: Review & Submit */}
      {step === 3 && (
        <>
          <div className="text-center">
            <h2 className="text-xl font-extrabold text-gray-900">Review & Submit</h2>
            <p className="text-sm text-gray-500 mt-1">Review your details and submit everything.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6">
              <h3 className="text-xs font-bold text-indigo-600 uppercase mb-4 flex items-center gap-2 border-b pb-2">
                <ListChecks size={14} /> Your Details
              </h3>
              <dl className="space-y-2 text-sm">
                {[['Name', formData.fullName], ['Email', formData.email], ['Phone', formData.phone],
                  ['Date of Birth', formData.dateOfBirth], ['Gender', formData.gender],
                  ['Aadhaar', formData.aadhaar], ['PAN', formData.pan]].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-gray-400 font-semibold shrink-0">{k}</dt>
                    <dd className="text-gray-900 font-bold text-right">{v || '—'}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="space-y-6">
              <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6">
                <h3 className="text-xs font-bold text-indigo-600 uppercase mb-4 flex items-center gap-2 border-b pb-2">
                  <PenTool size={14} /> Signature
                </h3>
                {hasSignature ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="border border-gray-200 rounded-xl bg-gray-50 p-4">
                      <img src={formData.signatureData} alt="Signature" className="max-h-16" />
                    </div>
                    <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-1.5">
                      <ShieldCheck size={13} /> Captured • type: {formData.signatureType}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-amber-600 font-bold flex items-center gap-2">
                    <AlertTriangle size={15} /> Signature not provided.
                  </p>
                )}
              </div>

              <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6">
                <h3 className="text-xs font-bold text-indigo-600 uppercase mb-4 flex items-center gap-2 border-b pb-2">
                  <FileText size={14} /> Documents
                </h3>
                <ul className="space-y-2">
                  {DOC_DEFS.map((def) => {
                    const count = getFilesFor(def.key).length;
                    const ok = count > 0;
                    return (
                      <li key={def.key} className="flex items-center gap-3 text-sm">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${ok ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-300'}`}>
                          {ok ? <Check size={12} /> : <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />}
                        </span>
                        <span className={`flex-1 font-semibold ${ok ? 'text-gray-900' : 'text-gray-400'}`}>{def.label}</span>
                        {ok && <span className="text-[10px] font-bold text-emerald-600">{count} file{count > 1 ? 's' : ''}</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          </div>

          {/* Declaration */}
          <label className="flex items-start gap-3 bg-white rounded-3xl shadow-xl border border-gray-100 p-6 cursor-pointer">
            <input type="checkbox" checked={declaration} onChange={(e) => setDeclaration(e.target.checked)} className="mt-0.5 w-5 h-5 rounded accent-indigo-600" />
            <div>
              <p className="font-bold text-gray-900 text-sm">Declaration</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                I hereby declare that the information provided and the documents uploaded are genuine and complete to the best of my knowledge.
                I understand that any misrepresentation may lead to termination at any stage.
              </p>
            </div>
          </label>

          <div className="flex justify-center gap-4">
            <button type="button" onClick={goBack} className="bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50 px-8 py-3 rounded-full font-bold shadow-lg flex items-center gap-2">
              <ChevronLeft size={18} /> Back
            </button>
            <button type="button" onClick={handleSubmit} disabled={submitting || !declaration}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-12 py-3 rounded-full font-bold shadow-xl shadow-emerald-600/30 flex items-center gap-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed">
              <UploadCloud size={22} /> {submitting ? 'Submitting...' : 'Sign & Submit Documents'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default OnboardingSection;
