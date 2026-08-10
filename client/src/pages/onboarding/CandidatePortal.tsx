import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { renderAsync } from 'docx-preview';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import {
  Bold,
  Italic,
  Underline,
  Undo2,
  Redo2,
  Type,
  Save,
  CheckCircle,
  UploadCloud,
  FileText,
  PenTool,
  Image as ImageIcon,
  AlertTriangle,
  Loader,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Check,
  ShieldCheck,
  Clock,
  PartyPopper,
  ExternalLink,
  ListChecks,
  Lock,
  Download,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List as ListIcon,
  ListOrdered,
  Table2,
  ZoomIn,
  ZoomOut,
  Printer,
  GripVertical,
  RotateCcw,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : 'http://localhost:5000/api';

const EDITABLE_TOKENS = [
  'date',
  'dateOfBirth',
  'phone',
  'currentAddress',
  'permanentAddress',
  'emergencyName',
  'emergencyRelationship',
  'emergencyPhone',
  'bankAccountNumber',
  'ifscCode',
];

// Candidate-owned fields that become read-only once a value exists (pre-filled
// from the database) but stay editable while they are still blank.
const BLANK_EDITABLE_TOKENS = ['pan', 'aadhaar'];

type DocKey =
  | 'aadhaar'
  | 'pan'
  | 'resume'
  | 'passportPhoto'
  | 'nda'
  | 'otherDocuments';

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

type FlowStepStatus = 'pending' | 'active' | 'done' | 'error';
interface FlowStep {
  key: string;
  label: string;
  status: FlowStepStatus;
}

const buildFlowSteps = (): FlowStep[] => [
  { key: 'render', label: 'Saving Joining Letter...', status: 'active' },
  { key: 'docx', label: 'DOCX Generated', status: 'pending' },
  { key: 'pdf', label: 'PDF Generated', status: 'pending' },
  { key: 'upload', label: 'Uploading to Google Drive...', status: 'pending' },
  { key: 'complete', label: 'Completed Successfully', status: 'pending' },
];

const FONT_SIZES = [
  { label: 'XS', value: '1' },
  { label: 'S', value: '2' },
  { label: 'Normal', value: '3' },
  { label: 'M', value: '4' },
  { label: 'L', value: '5' },
  { label: 'XL', value: '6' },
  { label: 'XXL', value: '7' },
];

const FONT_FAMILIES = ['Arial', 'Times New Roman', 'Georgia', 'Courier New', 'Verdana', 'Trebuchet MS'];

const SIGNATURE_FONTS = [
  { label: 'Classic Cursive', value: "'Brush Script MT', cursive" },
  { label: 'Elegant Script', value: "'Segoe Script', cursive" },
  { label: 'Handwritten', value: "'Lucida Handwriting', cursive" },
  { label: 'Flowing Script', value: "'Great Vibes', 'Dancing Script', cursive" },
  { label: 'Modern Cursive', value: "'Dancing Script', cursive" },
];

const TIMELINE_STEPS: { key: string; label: string }[] = [
  { key: 'OFFER_SENT', label: 'Offer Sent' },
  { key: 'OPENED', label: 'Opened' },
  { key: 'INFO_FILLED', label: 'Information Filled' },
  { key: 'SIGNATURE', label: 'Signature Added' },
  { key: 'DOCUMENTS', label: 'Documents Uploaded' },
  { key: 'SAVED', label: 'Saved' },
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'HR_REVIEW', label: 'HR Review' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'JOINED', label: 'Joined' },
];

const INITIAL_FILES: { [key in DocKey]: File | File[] | null } = {
  aadhaar: null,
  pan: null,
  resume: null,
  passportPhoto: null,
  nda: null,
  otherDocuments: [] as File[],
};

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file
const ALLOWED_DOC_EXT = ['pdf', 'png', 'jpg', 'jpeg'];

const validateFile = (file: File): string | null => {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_DOC_EXT.includes(ext)) {
    return `"${file.name}" is not supported. Allowed formats: PDF, PNG, JPG, JPEG.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `"${file.name}" exceeds the 10 MB limit.`;
  }
  return null;
};

const readPngSize = (buf: Uint8Array): { w: number; h: number } => {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (buf.length > 24 && dv.getUint32(0) === 0x89504e47) {
    return { w: dv.getUint32(16), h: dv.getUint32(20) };
  }
  return { w: 400, h: 150 };
};

const insertSignatureIntoDocx = (docxBytes: Uint8Array, signatureDataUrl: string): Uint8Array => {
  const zip = new PizZip(docxBytes);
  const docXml = zip.file('word/document.xml');
  const relsXml = zip.file('word/_rels/document.xml.rels');
  if (!docXml || !relsXml) return docxBytes;

  let xml = docXml.asText();
  let rels = relsXml.asText();

  const existingIds = Array.from(rels.matchAll(/rId(\d+)/g)).map((m) => parseInt(m[1], 10));
  const nextId = (existingIds.length ? Math.max(...existingIds) : 0) + 1;
  const rId = `rId${nextId}`;

  rels = rels.replace('</Relationships>', `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/signature.png"/></Relationships>`);

  const b64 = signatureDataUrl.split(',')[1];
  const img = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const { w, h } = readPngSize(img);
  const targetHeightEmu = Math.round(0.8 * 914400);
  const cy = targetHeightEmu;
  const cx = Math.min(Math.round(targetHeightEmu * (w / h)), Math.round(2.6 * 914400));

  const drawingXml = (docId: number) => `
    <w:drawing>
      <wp:inline xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" distT="0" distB="0" distL="0" distR="0">
        <wp:extent cx="${cx}" cy="${cy}"/>
        <wp:effectExtent l="0" t="0" r="0" b="0"/>
        <wp:docPr id="${docId}" name="Candidate Signature ${docId}"/>
        <wp:cNvGraphicFramePr>
          <a:graphicFrameLocks noChangeAspect="1"/>
        </wp:cNvGraphicFramePr>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:nvPicPr>
                <pic:cNvPr id="0" name="Signature.png"/>
                <pic:cNvPicPr/>
              </pic:nvPicPr>
              <pic:blipFill>
                <a:blip r:embed="${rId}"/>
                <a:stretch><a:fillRect/></a:stretch>
              </pic:blipFill>
              <pic:spPr>
                <a:xfrm>
                  <a:off x="0" y="0"/>
                  <a:ext cx="${cx}" cy="${cy}"/>
                </a:xfrm>
                <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
              </pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing>`;

  let docId = 5000;
  xml = xml.replace(/(<w:r>)(<w:rPr>[\s\S]*?<\/w:rPr>)?(<w:t[^>]*>)(_{3,})(<\/w:t><\/w:r>)/g, (match, open, rpr, _wt, _underscores, close) => {
    docId += 1;
    return `${open}${rpr || ''}${drawingXml(docId)}</w:r>`;
  });

  zip.file('word/document.xml', xml);
  zip.file('word/_rels/document.xml.rels', rels);
  zip.file('word/media/signature.png', img, { binary: true });
  return zip.generate({ type: 'uint8array', compression: 'DEFLATE' });
};

export const CandidatePortal: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [onboarding, setOnboarding] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [docLoading, setDocLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savedInfo, setSavedInfo] = useState<{ docx?: string; pdf?: string } | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [uploadProgress, setUploadProgress] = useState<{
    inProgress: boolean;
    percent: number;
    current: string | null;
    perFile: { [key: string]: { done: boolean; percent: number } };
  } | null>(null);
  const [flow, setFlow] = useState<{ mode: 'save' | 'submit'; steps: FlowStep[]; error?: string; files: string[] } | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [declaration, setDeclaration] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'Male',
    bloodGroup: '',
    maritalStatus: '',
    nationality: '',
    phone: '',
    alternatePhone: '',
    email: '',
    currentAddress: '',
    permanentAddress: '',
    city: '',
    state: '',
    pincode: '',
    aadhaar: '',
    pan: '',
    passportNumber: '',
    drivingLicenseNumber: '',
    bankAccountName: '',
    bankName: '',
    bankBranch: '',
    bankAccountNumber: '',
    ifscCode: '',
    upiId: '',
    emergencyName: '',
    emergencyRelationship: '',
    emergencyPhone: '',
    emergencyAlternatePhone: '',
    emergencyAddress: '',
    employeeType: '',
    reportingManager: '',
    workLocation: '',
    shift: '',
    joiningDate: '',
    probationPeriod: '',
    position: '',
    department: '',
    date: '',
    signatureData: '',
    signatureType: 'DRAW' as 'DRAW' | 'UPLOAD' | 'TYPE',
    signatureText: '',
    signatureStyle: SIGNATURE_FONTS[0].value,
    signatureSize: 44,
  });

  const [files, setFiles] = useState<{ [key in DocKey]: File | File[] | null }>(INITIAL_FILES);

  const sigCanvas = useRef<HTMLCanvasElement>(null);
  const docContainer = useRef<HTMLDivElement>(null);
  const docTemplateRef = useRef<Uint8Array | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const formatDate = (d: Date | string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const tokenValue = useCallback(
    (token: string, rawForInput = false): string => {
      const ol = onboarding?.offerLetter || {};
      switch (token) {
        case 'candidateName':
          return formData.fullName || ol.candidateName || '';
        case 'date': {
          const d = formData.date || new Date().toISOString().split('T')[0];
          return rawForInput ? d : formatDate(d);
        }
        case 'referenceNumber':
          return `OBI/HR/OL/${new Date().getFullYear()}/${String(ol.id || '').slice(-4).toUpperCase()}`;
        case 'place':
          return 'Hyderabad';
        case 'position':
          return formData.position || ol.role || 'Intern';
        case 'department':
          return formData.department || ol.department || '';
        case 'joiningDate': {
          const raw = formData.joiningDate || (ol.joiningDate ? new Date(ol.joiningDate).toISOString().split('T')[0] : '');
          if (!raw) return '';
          return rawForInput ? raw : formatDate(raw);
        }
        case 'email':
          return formData.email || ol.candidateEmail || '';
        case 'dateOfBirth': {
          const raw = formData.dateOfBirth;
          if (!raw) return '';
          return rawForInput ? raw : formatDate(raw);
        }
        default:
          return (formData as any)[token] || '';
      }
    },
    [formData, onboarding]
  );

  useEffect(() => {
    fetchPortalData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchPortalData = async () => {
    try {
      const res = await axios.get(`${API_BASE}/onboarding/portal/${token}`);
      if (res.data.expired) {
        setError('This link has expired. Please contact HR.');
      } else if (!res.data.data?.onboarding) {
        setError('Candidate information could not be loaded. Please contact the HR team.');
      } else {
        const ob = res.data.data.onboarding;
        const prefill = res.data.data.prefill || {};
        setOnboarding(ob);
        const prev = ob.candidateData || {};
        if (prev.lastSavedAt) setLastSavedAt(prev.lastSavedAt);
        setFormData((prevForm) => ({
          ...prevForm,
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
          signatureStyle: ob.candidateData?.signatureStyle || SIGNATURE_FONTS[0].value,
          signatureSize: ob.candidateData?.signatureSize || 44,
        }));
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load portal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (['ACCEPTED', 'CHANGES_REQUESTED', 'JOINED', 'EMPLOYEE_CREATED', 'CREDENTIALS_SENT', 'ACTIVE'].includes(onboarding?.status)) {
      setStep(2);
    }
  }, [onboarding?.status]);

  const loadDocument = useCallback(async () => {
    if (!token || !docContainer.current) return;
    setDocLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/onboarding/portal/${token}/template`, {
        responseType: 'arraybuffer',
      });
      docTemplateRef.current = new Uint8Array(res.data);
      const container = docContainer.current;
      container.innerHTML = '';
      await renderAsync(res.data, container, undefined, {
        inWrapper: true,
        breakPages: true,
        ignoreWidth: false,
        renderHeaders: true,
        renderFooters: true,
        renderFootnotes: true,
        renderEndnotes: true,
      });
      applyPlaceholders();
      applySignature();
    } catch (err) {
      console.error('Failed to render offer letter DOCX:', err);
    } finally {
      setDocLoading(false);
    }
  }, [token, onboarding]);

  const applyPlaceholders = useCallback(() => {
    const container = docContainer.current;
    if (!container) return;
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      nodes.push(node as Text);
      node = walker.nextNode();
    }
    const replaceInNode = (n: Text) => {
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
          const editable =
            EDITABLE_TOKENS.includes(tokenName) ||
            (BLANK_EDITABLE_TOKENS.includes(tokenName) && !tokenValue(tokenName));
          if (editable) {
            const input = document.createElement('input');
            input.setAttribute('data-token', tokenName);
            const isDateToken = ['date', 'dateOfBirth', 'joiningDate'].includes(tokenName);
            input.type = isDateToken ? 'date' : 'text';
            input.className = 'portal-editable-input';
            input.value = tokenValue(tokenName, isDateToken);
            input.oninput = (e) => {
              const val = (e.target as HTMLInputElement).value;
              setFormData((prev) => ({
                ...prev,
                [tokenName === 'candidateName' ? 'fullName' : tokenName]: val
              }));
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
    };
    nodes.forEach(replaceInNode);
  }, [tokenValue]);

  const applySignature = useCallback(() => {
    const container = docContainer.current;
    if (!container || !formData.signatureData) return;
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      nodes.push(node as Text);
      node = walker.nextNode();
    }
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
    if (onboarding && !submitted && showWorkspaceFor(onboarding.status)) loadDocument();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboarding, loadDocument, submitted]);

  useEffect(() => {
    applySignature();
  }, [formData.signatureData, applySignature]);

  const handleDocInput = (e: React.FormEvent<HTMLDivElement>) => {
      // Replaced by controlled inputs
    };

    useEffect(() => {
      if (!onboarding || submitted || saving || submitting || !showWorkspaceFor(onboarding.status)) return;
      const interval = setInterval(() => {
        // Auto-save logic
        const payload = new FormData();
        payload.append('candidateData', JSON.stringify(buildCandidateData()));
        // Note: files are not autosaved in this simplistic version, only candidateData
        axios.post(`${API_BASE}/onboarding/portal/${token}/save`, { autoSave: true, candidateData: buildCandidateData() })
          .then(res => setLastSavedAt(res.data.data.lastSavedAt))
          .catch(e => console.error('Autosave failed:', e));
      }, 30000);
      return () => clearInterval(interval);
    }, [onboarding, submitted, saving, submitting, formData, token]);

  // ---------- Word toolbar ----------
  const exec = (command: string, value?: string) => {
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, value);
    docContainer.current?.focus();
  };

  const formatLastSaved = (iso?: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const insertTable = () => {
    const rows = parseInt(prompt('Number of rows:', '3') || '0', 10);
    const cols = parseInt(prompt('Number of columns:', '3') || '0', 10);
    if (!rows || !cols || rows < 1 || cols < 1 || rows > 20 || cols > 10) return;
    let table = '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; width:100%; margin:8px 0;">';
    for (let r = 0; r < rows; r++) {
      table += '<tr>';
      for (let c = 0; c < cols; c++) {
        table += '<td style="border:1px solid #9ca3af; padding:6px; min-height:18px;">&nbsp;</td>';
      }
      table += '</tr>';
    }
    table += '</table><p>&nbsp;</p>';
    exec('insertHTML', table);
  };

  const insertImageIntoDoc = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png, image/jpeg';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_FILE_SIZE) return alert('Image exceeds the 10 MB limit.');
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) exec('insertImage', e.target.result as string);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const insertPageBreak = () => {
    exec('insertHTML', '<div style="page-break-after:always; clear:both;">&nbsp;</div>');
  };

  const printDocument = () => {
    window.print();
  };

  const zoomBy = (delta: number) => {
    setZoom((z) => Math.min(150, Math.max(60, z + delta)));
  };

  // ---------- Signature ----------
  const handleSignatureImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > MAX_FILE_SIZE) {
        return alert('Signature image exceeds the 10 MB limit.');
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setFormData((prev) => ({ ...prev, signatureData: makeWhiteTransparent(dataUrl) }));
      };
      reader.readAsDataURL(file);
    }
  };

  const makeWhiteTransparent = (dataUrl: string): string => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const threshold = 240;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] >= threshold && data[i + 1] >= threshold && data[i + 2] >= threshold) {
          data[i + 3] = 0;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      setFormData((prev) => ({ ...prev, signatureData: canvas.toDataURL('image/png') }));
    };
    img.src = dataUrl;
    return dataUrl;
  };

  const renderTypedSignature = (text: string, font: string, sizePx: number) => {
    setFormData((prev) => ({
      ...prev,
      signatureText: text,
      signatureStyle: font,
      signatureSize: sizePx,
      signatureData: '',
    }));
    if (!text.trim()) return;
    requestAnimationFrame(() => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const fontStr = `${sizePx}px ${font}`;
      ctx.font = fontStr;
      const metrics = ctx.measureText(text.trim());
      const pad = 24;
      canvas.width = Math.max(240, Math.ceil(metrics.width) + pad * 2);
      canvas.height = Math.ceil(sizePx * 1.6) + pad * 2;
      const c2 = canvas.getContext('2d');
      if (!c2) return;
      c2.clearRect(0, 0, canvas.width, canvas.height);
      c2.font = fontStr;
      c2.fillStyle = '#1e1b4b';
      c2.textBaseline = 'middle';
      c2.fillText(text.trim(), pad, canvas.height / 2);
      setFormData((prev) => ({ ...prev, signatureData: canvas.toDataURL('image/png') }));
    });
  };

  const startDrawing = (e: any) => {
    setIsDrawing(true);
    const canvas = sigCanvas.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const canvas = sigCanvas.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = sigCanvas.current;
    if (canvas) {
      setFormData((prev) => ({ ...prev, signatureData: canvas.toDataURL('image/png') }));
    }
  };

  const clearCanvas = () => {
    const canvas = sigCanvas.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setFormData((prev) => ({ ...prev, signatureData: '' }));
  };

  // ---------- Files ----------
  const getFilesFor = (key: DocKey): File[] => {
    const v = files[key];
    if (Array.isArray(v)) return v;
    return v ? [v] : [];
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, def: DocDef) => {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    addFiles(Array.from(list), def);
    e.target.value = '';
  };

  const addFiles = (incoming: File[], def: DocDef) => {
    const rejected: string[] = [];
    const accepted: File[] = [];
    for (const f of incoming) {
      const err = validateFile(f);
      if (err) rejected.push(err);
      else accepted.push(f);
    }
    if (rejected.length > 0) {
      alert(rejected.join('\n'));
    }
    if (accepted.length === 0) return;

    setFiles((prev) => {
      const current = getFilesFor(def.key);
      if (def.multiple) {
        return { ...prev, [def.key]: [...current, ...accepted].slice(0, 5) };
      }
      return { ...prev, [def.key]: accepted[0] };
    });
  };

  const handleDrop = (e: React.DragEvent, def: DocDef) => {
    e.preventDefault();
    e.stopPropagation();
    const dropped = Array.from(e.dataTransfer?.files || []);
    if (dropped.length > 0) addFiles(dropped, def);
  };

  const removeFile = (key: DocKey, index?: number) => {
    setFiles((prev) => {
      const cur = prev[key];
      if (Array.isArray(cur)) {
        const next = cur.filter((_, i) => i !== index);
        return { ...prev, [key]: next };
      }
      return { ...prev, [key]: null };
    });
  };

  const fileUrl = (file: File) => URL.createObjectURL(file);
  const isImage = (file: File) => file.type.startsWith('image/');

  const requiredMissing = REQUIRED_DOCS.filter((k) => getFilesFor(k).length === 0);

  const infoRequiredFields = ['fullName', 'email', 'phone', 'dateOfBirth', 'gender', 'currentAddress', 'permanentAddress', 'city', 'state', 'pincode', 'aadhaar', 'pan', 'bankAccountName', 'bankName', 'bankBranch', 'bankAccountNumber', 'ifscCode', 'emergencyName', 'emergencyRelationship', 'emergencyPhone', 'joiningDate'];
  const infoFilledCount = infoRequiredFields.filter((f) => !!(formData as any)[f]).length;
  const emergencyFilled = !!(formData.emergencyName && formData.emergencyPhone && formData.emergencyRelationship);
  const infoComplete = infoFilledCount === infoRequiredFields.length && emergencyFilled;

  const hasSignature = !!formData.signatureData;

  const completionItems: { label: string; ok: boolean }[] = [
    { label: 'Information', ok: infoComplete },
    { label: 'Signature', ok: hasSignature },
    { label: 'Aadhaar', ok: getFilesFor('aadhaar').length > 0 },
    { label: 'PAN', ok: getFilesFor('pan').length > 0 },
    { label: 'Resume', ok: getFilesFor('resume').length > 0 },
    { label: 'Photo', ok: getFilesFor('passportPhoto').length > 0 },
  ];
  const completionPercent = Math.round((completionItems.filter((i) => i.ok).length / completionItems.length) * 100);

  // ---------- Payload ----------
  const buildCandidateData = () => {
    const ol = onboarding?.offerLetter || {};
    const fullName = formData.fullName || ol.candidateName || '';
    const email = formData.email || ol.candidateEmail || '';
    return {
      fullName,
      firstName: formData.firstName,
      lastName: formData.lastName,
      email,
      phone: formData.phone,
      dateOfBirth: formData.dateOfBirth,
      gender: formData.gender,
      permanentAddress: formData.permanentAddress,
      currentAddress: formData.currentAddress,
      aadhaar: formData.aadhaar,
      pan: formData.pan,
      position: formData.position,
      department: formData.department,
      joiningDate: formData.joiningDate,
      bankAccountNumber: formData.bankAccountNumber,
      ifscCode: formData.ifscCode,
      date: formData.date,
      emergencyContact: {
        name: formData.emergencyName,
        phone: formData.emergencyPhone,
        relationship: formData.emergencyRelationship,
      },
      signatureType: formData.signatureType,
      signatureData: formData.signatureData,
      signatureText: formData.signatureText,
      signatureStyle: formData.signatureStyle,
      signatureSize: formData.signatureSize,
    };
  };

  const handleSave = async () => {
    if (!hasSignature && formData.signatureType !== 'TYPE') {
      return alert('Please provide your digital signature before saving.');
    }
    setSaving(true);
    setSavedInfo(null);
    setFlow({ mode: 'save', steps: buildFlowSteps(), files: [] });

    // Simulate the render/PDF stages while the server generates the documents.
    const phaseTimer = window.setTimeout(() => {
      setFlow((prev) =>
        prev
          ? {
              ...prev,
              steps: prev.steps.map((s) =>
                s.key === 'render' || s.key === 'docx' || s.key === 'pdf'
                  ? { ...s, status: 'done' }
                  : s.key === 'upload'
                    ? { ...s, status: 'active' }
                    : s
              ),
            }
          : prev
      );
    }, 600);

    try {
      const res = await axios.post(`${API_BASE}/onboarding/portal/${token}/save`, {
        candidateData: buildCandidateData(),
      });
      setSavedInfo({
        docx: res.data.data.docx?.url,
        pdf: res.data.data.pdf?.url,
      });
      setLastSavedAt(res.data.data.lastSavedAt || new Date().toISOString());
      setOnboarding(res.data.data.onboarding);
      setFlow((prev) =>
        prev
          ? {
              mode: 'save',
              steps: prev.steps.map((s) => ({ ...s, status: 'done' })),
              files: ['Internship Offer Letter.docx', 'Internship Offer Letter.pdf', 'Candidate Signature.png'],
            }
          : prev
      );
      alert('Changes saved. Updated DOCX, PDF and signature uploaded successfully.');
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || 'Failed to save changes';
      setFlow((prev) =>
        prev
          ? {
              ...prev,
              error: msg,
              steps: prev.steps.map((s) => (s.status === 'active' ? { ...s, status: 'error' } : s)),
            }
          : prev
      );
      alert(msg);
    } finally {
      window.clearTimeout(phaseTimer);
      setSaving(false);
    }
  };

  const handleAcceptOffer = async () => {
    if (!hasSignature && formData.signatureType !== 'TYPE') {
      return alert('Please provide your digital signature before accepting.');
    }
    setSubmitting(true);
    try {
      // 1. Save changes (this embeds the signature and creates the signed PDF)
      await axios.post(`${API_BASE}/onboarding/portal/${token}/save`, {
        candidateData: buildCandidateData(),
      });
      // 2. Accept offer (this creates the employee and sends credentials)
      const res = await axios.post(`${API_BASE}/onboarding/portal/${token}/accept`);
      setOnboarding(res.data.data.onboarding);
      setStep(2);
      alert('Offer accepted successfully! Your credentials have been emailed to you. Please proceed to upload your documents.');
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to accept offer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!hasSignature) {
      return alert('Please provide your digital signature before submitting.');
    }
    if (requiredMissing.length > 0) {
      return alert(`Please upload: ${requiredMissing.join(', ')}`);
    }
    if (!declaration) {
      return alert('Please accept the declaration to proceed.');
    }

    setSubmitting(true);
    setUploadProgress({ inProgress: true, percent: 0, current: null, perFile: {} });
    setFlow({ mode: 'submit', steps: buildFlowSteps(), files: [] });

    // Simulate the render/PDF stages while the server generates the documents.
    const phaseTimer = window.setTimeout(() => {
      setFlow((prev) =>
        prev
          ? {
              ...prev,
              steps: prev.steps.map((s) =>
                s.key === 'render' || s.key === 'docx' || s.key === 'pdf'
                  ? { ...s, status: 'done' }
                  : s.key === 'upload'
                    ? { ...s, status: 'active' }
                    : s
              ),
            }
          : prev
      );
    }, 600);

    try {
      const payload = new FormData();
      payload.append('candidateData', JSON.stringify(buildCandidateData()));
      const progressMap: { key: string; size: number }[] = [];
      for (const def of DOC_DEFS) {
        const fs = getFilesFor(def.key);
        for (const f of fs) {
          payload.append(def.key, f);
          progressMap.push({ key: def.key, size: f.size });
        }
      }
      const totalSize = progressMap.reduce((sum, p) => sum + p.size, 0);
      const perFileAt = (loaded: number) => {
        const per: { [key: string]: { done: boolean; percent: number } } = {};
        let acc = 0;
        for (const p of progressMap) {
          const start = acc;
          acc += p.size;
          const fLoaded = totalSize > 0 ? Math.max(0, Math.min(p.size, loaded - start)) : 0;
          per[p.key] = { done: fLoaded >= p.size, percent: p.size > 0 ? Math.min(100, Math.round((fLoaded / p.size) * 100)) : 100 };
        }
        return per;
      };

      const res = await axios.post(`${API_BASE}/onboarding/portal/${token}/submit`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          const total = e.total && e.total > 0 ? e.total : totalSize;
          const loaded = e.loaded || 0;
          const percent = total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : 0;
          let current: string | null = null;
          let acc = 0;
          for (const p of progressMap) {
            acc += p.size;
            if (loaded <= acc) {
              current = p.key;
              break;
            }
          }
          setUploadProgress({ inProgress: true, percent, current, perFile: perFileAt(loaded) });
        },
      });
      setUploadProgress((prev) => (prev ? { ...prev, percent: 100 } : prev));
      setOnboarding(res.data.data.onboarding);
      setSubmitted(true);
      setFlow((prev) =>
        prev
          ? {
              mode: 'submit',
              steps: prev.steps.map((s) => ({ ...s, status: 'done' })),
              files: (res.data.data.documents || []).map((d: any) => d.fileName || ''),
            }
          : prev
      );
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || 'Failed to submit documents';
      setFlow((prev) =>
        prev
          ? {
              ...prev,
              error: msg,
              steps: prev.steps.map((s) => (s.status === 'active' ? { ...s, status: 'error' } : s)),
            }
          : prev
      );
      alert(msg);
    } finally {
      window.clearTimeout(phaseTimer);
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const downloadDocx = useCallback(async () => {
    if (!token) return;
    try {
      if (!docTemplateRef.current) {
        const res = await axios.get(`${API_BASE}/onboarding/portal/${token}/template`, {
          responseType: 'arraybuffer',
        });
        docTemplateRef.current = new Uint8Array(res.data);
      }
      const zip = new PizZip(docTemplateRef.current);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      doc.render({
        referenceNumber: tokenValue('referenceNumber'),
        date: tokenValue('date'),
        candidateName: tokenValue('candidateName'),
        currentAddress: tokenValue('currentAddress'),
        permanentAddress: tokenValue('permanentAddress'),
        joiningDate: tokenValue('joiningDate'),
        place: tokenValue('place'),
        dateOfBirth: tokenValue('dateOfBirth'),
        phone: tokenValue('phone'),
        email: tokenValue('email'),
        position: tokenValue('position'),
        department: tokenValue('department'),
        pan: tokenValue('pan'),
        aadhaar: tokenValue('aadhaar'),
        emergencyName: tokenValue('emergencyName'),
        emergencyRelationship: tokenValue('emergencyRelationship'),
        emergencyPhone: tokenValue('emergencyPhone'),
      });
      let out = doc.getZip().generate({ type: 'uint8array', compression: 'DEFLATE' });
      if (formData.signatureData) {
        out = insertSignatureIntoDocx(out, formData.signatureData);
      }
      const blob = new Blob([new Uint8Array(out)], { type: DOCX_MIME });
      saveAs(blob, 'Acceptance Letter.docx');
    } catch (err) {
      console.error('Failed to download DOCX:', err);
      alert('Failed to generate the DOCX download. Please try again.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, formData.signatureData, tokenValue]);

  const downloadFileFromUrl = useCallback(async (url: string, filename: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      saveAs(blob, filename);
    } catch (err) {
      console.error('Download failed:', err);
      window.open(url, '_blank');
    }
  }, []);

  const goNext = () => {
    if (step === 1) {
      if (!hasSignature) {
        return alert('Please provide your digital signature before continuing.');
      }
      setStep(2);
    } else if (step === 2) {
      if (requiredMissing.length > 0) {
        return alert(`Please upload required documents: ${requiredMissing.join(', ')}`);
      }
      setStep(3);
    }
  };

  const goBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  // ---------- Timeline ----------
  const completedSteps = (): { key: string; label: string; done: boolean }[] => {
    const data = onboarding?.candidateData || {};
    const status = onboarding?.status || '';
    const submittedStates = ['DOCUMENTS_PENDING', 'DOCUMENTS_SUBMITTED', 'HR_VERIFICATION', 'DOCUMENTS_VERIFIED', 'APPROVED', 'JOINING_LETTER_SENT', 'READY_TO_JOIN', 'JOINED', 'EMPLOYEE_CREATED', 'CREDENTIALS_SENT', 'ACTIVE', 'COMPLETED'];
    const reviewStates = ['HR_VERIFICATION', 'DOCUMENTS_VERIFIED', 'APPROVED', 'JOINING_LETTER_SENT', 'READY_TO_JOIN', 'JOINED', 'EMPLOYEE_CREATED', 'CREDENTIALS_SENT', 'ACTIVE', 'COMPLETED'];
    const approvedStates = ['APPROVED', 'JOINING_LETTER_SENT', 'READY_TO_JOIN', 'JOINED', 'EMPLOYEE_CREATED', 'CREDENTIALS_SENT', 'ACTIVE', 'COMPLETED'];
    const joinedStates = ['JOINED', 'EMPLOYEE_CREATED', 'CREDENTIALS_SENT', 'ACTIVE', 'COMPLETED'];

    const infoRequired = ['fullName', 'email', 'phone', 'dateOfBirth', 'currentAddress', 'permanentAddress', 'aadhaar', 'pan'];
    const infoFilled =
      infoRequired.every((f) => !!(data as any)[f]) &&
      !!(data.emergencyContact?.name && data.emergencyContact?.phone && data.emergencyContact?.relationship);
    const docCount = (onboarding?.documents || []).length;

    const steps: { key: string; label: string; done: boolean }[] = TIMELINE_STEPS.map((s) => ({ ...s, done: false }));
    steps[0].done = true; // Offer Sent
    if (data.portalOpenedAt) steps[1].done = true; // Opened
    if (infoFilled) steps[2].done = true; // Information Filled
    if (onboarding.signatureData) steps[3].done = true; // Signature Added
    if (docCount > 0 || submittedStates.includes(status)) steps[4].done = true; // Documents Uploaded
    if (data.lastSavedAt) steps[5].done = true; // Saved
    if (submittedStates.includes(status)) steps[6].done = true; // Submitted
    if (reviewStates.includes(status)) steps[7].done = true; // HR Review
    if (approvedStates.includes(status)) steps[8].done = true; // Approved
    if (joinedStates.includes(status)) steps[9].done = true; // Joined
    return steps;
  };

  const isRejected = onboarding?.status === 'REJECTED';
  const isExpired = onboarding?.status === 'EXPIRED';

  // ---------- Render ----------
  if (loading && !onboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader size={28} className="animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <AlertTriangle className="text-rose-500 mx-auto mb-4" size={48} />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const stepMeta = [
    { n: 1, label: 'Review & Edit' },
    { n: 2, label: 'Upload Documents' },
    { n: 3, label: 'Review & Submit' },
  ];

  return (
    <div className="min-h-screen bg-brand-50 pb-20">
      <style>{`
        .docx-workspace-wrap {
          background: #e5e7eb;
          border-radius: 1rem;
          padding: 1.5rem;
        }
        .docx-workspace-wrap .docx-wrapper {
          margin: 0 auto;
          background: #fff;
          box-shadow: 0 10px 30px rgba(0,0,0,.12);
        }
        .portal-editable {
          display: inline;
          outline: none;
          border-bottom: 2px dashed #6366f1;
          background: rgba(99,102,241,.08);
          border-radius: 2px;
          padding: 0 2px;
          min-width: 40px;
          cursor: text;
          color: #1e1b4b;
        }
        .portal-editable:hover { background: rgba(99,102,241,.14); }
        .portal-editable:focus { background: rgba(99,102,241,.18); box-shadow: 0 0 0 2px rgba(99,102,241,.35); }
        .portal-editable-input {
          display: inline-block;
          outline: none;
          border: 1px solid #6366f1;
          background: rgba(99,102,241,.05);
          border-radius: 4px;
          padding: 2px 6px;
          min-width: 80px;
          color: #1e1b4b;
          font-family: inherit;
          font-size: inherit;
          transition: all 0.2s;
        }
        .portal-editable-input:focus {
          background: #fff;
          box-shadow: 0 0 0 2px rgba(99,102,241,.35);
        }
        .portal-locked { color: inherit; }
        .portal-signature-img { height: 28px; vertical-align: middle; }
        .signature-swatch {
          font-family: var(--sig-font, 'cursive');
          font-size: var(--sig-size, 40px);
          line-height: 1.2;
          color: #1e1b4b;
        }
        @media print {
          body * { visibility: hidden !important; }
          .docx-workspace-wrap, .docx-workspace-wrap * { visibility: visible !important; }
          .docx-workspace-wrap { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; background: #fff !important; border-radius: 0 !important; }
          .docx-workspace-wrap .docx-wrapper { box-shadow: none !important; margin: 0 auto !important; }
          .docx-workspace-wrap .docx, .docx-workspace-wrap .docx-page { margin: 0 !important; box-shadow: none !important; }
        }
      `}</style>

      <header className="bg-white border-b border-gray-200 py-4 px-6 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-3">
            <img src="/image.png" className="w-8 h-8 object-contain" alt="Logo" />
            <h1 className="font-extrabold text-lg text-brand-950 tracking-tight">OneBridge Onboarding</h1>
          </div>
          <div className="flex items-center gap-3">
            {!submitted && showWorkspaceFor(onboarding.status) && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const url = savedInfo?.pdf || onboarding.signedOfferUrl;
                    if (url) downloadFileFromUrl(url, 'Internship Offer Letter.pdf');
                    else alert('Please save your changes first, then download the PDF.');
                  }}
                  className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-4 py-2 rounded-full"
                >
                  <FileText size={14} />
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={downloadDocx}
                  className="flex items-center gap-2 text-xs font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-4 py-2 rounded-full"
                >
                  <Download size={14} />
                  Download DOCX
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || submitting}
                  className="flex items-center gap-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-4 py-2 rounded-full"
                >
                  <Save size={14} />
                  {saving ? 'Saving...' : 'Save Draft'}
                </button>
              </>
            )}
            <div className="text-xs font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">
              {onboarding.status.replace(/_/g, ' ')}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto mt-8 px-4">
        {showWorkspaceFor(onboarding.status) && !submitted ? (
          <div className="space-y-8">
            {/* Stepper */}
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-5">
              <div className="flex items-center justify-between max-w-2xl mx-auto">
                {stepMeta.map((s, i) => (
                  <React.Fragment key={s.n}>
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                          step === s.n
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                            : step > s.n
                              ? 'bg-emerald-500 text-white'
                              : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {step > s.n ? <Check size={16} /> : s.n}
                      </div>
                      <span
                        className={`hidden sm:block text-xs font-bold ${
                          step === s.n ? 'text-gray-900' : 'text-gray-400'
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                    {i < stepMeta.length - 1 && (
                      <div className={`h-0.5 flex-1 rounded ${step > s.n ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Profile completion */}
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-2">
                  <ListChecks size={14} /> Profile Completion
                </h3>
                <span className="text-sm font-extrabold text-indigo-600">{completionPercent}%</span>
              </div>
              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mb-4">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${completionPercent === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {completionItems.map((item) => (
                  <div
                    key={item.label}
                    className={`flex items-center gap-2 text-xs font-semibold rounded-lg px-3 py-2 ${
                      item.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-400'
                    }`}
                  >
                    {item.ok ? <Check size={13} className="text-emerald-500" /> : <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />}
                    {item.label}
                  </div>
                ))}
              </div>
              {completionPercent < 100 && (
                <p className="mt-3 text-[11px] text-amber-600 font-bold">
                  {completionItems.filter((i) => !i.ok).map((i) => `${i.label} missing`).join(' • ')}
                </p>
              )}
            </div>

            {flow && (
              <div className="bg-white rounded-3xl shadow-xl border border-indigo-100 p-5">
                <p className="text-xs font-extrabold text-indigo-700 mb-3 uppercase tracking-widest">
                  {flow.mode === 'save' ? 'Saving Acceptance Documents' : 'Submitting Acceptance'}
                </p>
                <ul className="space-y-2">
                  {flow.steps.map((s) => (
                    <li key={s.key} className="flex items-center gap-2 text-sm">
                      {s.status === 'done' ? (
                        <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                      ) : s.status === 'active' ? (
                        <Loader size={16} className="animate-spin text-indigo-600 shrink-0" />
                      ) : s.status === 'error' ? (
                        <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                      ) : (
                        <span className="w-4 h-4 rounded-full border-2 border-gray-200 shrink-0" />
                      )}
                      <span
                        className={
                          s.status === 'error'
                            ? 'text-rose-700 font-bold'
                            : s.status === 'pending'
                              ? 'text-gray-400'
                              : 'text-gray-800 font-semibold'
                        }
                      >
                        {s.label}
                      </span>
                    </li>
                  ))}
                </ul>

                {flow.error && (
                  <div className="mt-4 bg-rose-50 border border-rose-200 rounded-2xl p-4 text-sm text-rose-800">
                    <p className="font-bold mb-1">Failed to upload:</p>
                    <p className="text-rose-700">{flow.error}</p>
                    <button
                      type="button"
                      onClick={() => (flow.mode === 'save' ? handleSave() : handleSubmit())}
                      className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 px-4 py-2 rounded-full"
                    >
                      <RotateCcw size={13} /> Retry
                    </button>
                  </div>
                )}

                {flow.files.length > 0 && !flow.error && (
                  <div className="mt-4 space-y-1">
                    <p className="text-xs font-bold text-emerald-700 mb-1">Uploaded to Google Drive:</p>
                    {flow.files.map((name) => (
                      <p key={name} className="flex items-center gap-2 text-xs text-gray-700">
                        <Check size={13} className="text-emerald-600" /> {name}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {uploadProgress?.inProgress && (
              <div className="bg-white rounded-3xl shadow-xl border border-indigo-100 p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-indigo-700 flex items-center gap-2">
                    <Loader size={14} className="animate-spin" />
                    {uploadProgress.percent < 100
                      ? uploadProgress.current
                        ? `Uploading ${DOC_DEFS.find((d) => d.key === uploadProgress.current)?.label || ''}...`
                        : 'Preparing upload...'
                      : 'Processing submission...'}
                  </p>
                  <span className="text-xs font-extrabold text-indigo-600">{uploadProgress.percent}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress.percent}%` }} />
                </div>
              </div>
            )}

            {step === 1 && (
              <>
                <div className="text-center">
                  <h2 className="text-2xl font-extrabold text-gray-900">Accept & Complete Your Offer Letter</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Edit the highlighted fields directly in the document. All company clauses are locked.
                  </p>
                </div>

                {/* Word toolbar */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-3 sticky top-[72px] z-40">
                  <div className="flex items-center gap-1 flex-wrap">
                    <button type="button" onClick={() => exec('undo')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-700" title="Undo">
                      <Undo2 size={16} />
                    </button>
                    <button type="button" onClick={() => exec('redo')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-700" title="Redo">
                      <Redo2 size={16} />
                    </button>
                    <div className="w-px h-6 bg-gray-200 mx-1" />
                    <button type="button" onClick={() => exec('bold')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-800 font-extrabold" title="Bold">
                      <Bold size={16} />
                    </button>
                    <button type="button" onClick={() => exec('italic')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-800 italic" title="Italic">
                      <Italic size={16} />
                    </button>
                    <button type="button" onClick={() => exec('underline')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-800 underline" title="Underline">
                      <Underline size={16} />
                    </button>
                    <div className="w-px h-6 bg-gray-200 mx-1" />
                    <button type="button" onClick={() => exec('justifyLeft')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-700" title="Align left">
                      <AlignLeft size={16} />
                    </button>
                    <button type="button" onClick={() => exec('justifyCenter')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-700" title="Align center">
                      <AlignCenter size={16} />
                    </button>
                    <button type="button" onClick={() => exec('justifyRight')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-700" title="Align right">
                      <AlignRight size={16} />
                    </button>
                    <button type="button" onClick={() => exec('justifyFull')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-700" title="Justify">
                      <AlignJustify size={16} />
                    </button>
                    <div className="w-px h-6 bg-gray-200 mx-1" />
                    <button type="button" onClick={() => exec('insertUnorderedList')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-700" title="Bulleted list">
                      <ListIcon size={16} />
                    </button>
                    <button type="button" onClick={() => exec('insertOrderedList')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-700" title="Numbered list">
                      <ListOrdered size={16} />
                    </button>
                    <div className="w-px h-6 bg-gray-200 mx-1" />
                    <button type="button" onClick={insertTable} className="p-2 rounded-lg hover:bg-gray-100 text-gray-700" title="Insert table">
                      <Table2 size={16} />
                    </button>
                    <button type="button" onClick={insertImageIntoDoc} className="p-2 rounded-lg hover:bg-gray-100 text-gray-700" title="Insert image">
                      <ImageIcon size={16} />
                    </button>
                    <button type="button" onClick={insertPageBreak} className="p-2 rounded-lg hover:bg-gray-100 text-gray-700" title="Insert page break">
                      <GripVertical size={16} />
                    </button>
                    <div className="w-px h-6 bg-gray-200 mx-1" />
                    <select
                      className="text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 outline-none focus:border-indigo-500 max-w-[150px]"
                      title="Font family"
                      onChange={(e) => exec('fontName', e.target.value)}
                      defaultValue="Arial"
                    >
                      {FONT_FAMILIES.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                    <select
                      className="text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 outline-none focus:border-indigo-500"
                      title="Font size"
                      onChange={(e) => exec('fontSize', e.target.value)}
                      defaultValue="3"
                    >
                      {FONT_SIZES.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <div className="w-px h-6 bg-gray-200 mx-1" />
                    <button type="button" onClick={() => zoomBy(-10)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-700" title="Zoom out">
                      <ZoomOut size={16} />
                    </button>
                    <span className="text-[10px] font-bold text-gray-500 w-10 text-center select-none">{zoom}%</span>
                    <button type="button" onClick={() => zoomBy(10)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-700" title="Zoom in">
                      <ZoomIn size={16} />
                    </button>
                    <div className="w-px h-6 bg-gray-200 mx-1" />
                    <button type="button" onClick={printDocument} className="p-2 rounded-lg hover:bg-gray-100 text-gray-700" title="Print layout">
                      <Printer size={16} />
                    </button>
                    <span className="ml-auto hidden md:flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      <Eye size={13} /> Live Preview
                    </span>
                  </div>
                </div>

                {/* DOCX Workspace */}
                <div className="docx-workspace-wrap">
                  {docLoading && (
                    <div className="flex items-center justify-center py-20 text-indigo-600">
                      <Loader size={28} className="animate-spin mr-3" /> Loading document...
                    </div>
                  )}
                  <div ref={docContainer} className="max-w-[820px] mx-auto overflow-x-auto" style={{ zoom: zoom / 100 }} />
                </div>
                {(savedInfo || lastSavedAt) && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm text-emerald-900">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-bold">
                        <CheckCircle size={16} className="text-emerald-600" />
                        Saved Successfully
                        {lastSavedAt && (
                          <span className="text-xs font-semibold text-emerald-700 bg-white/70 border border-emerald-200 rounded-full px-3 py-1">
                            Last Saved: {formatLastSaved(lastSavedAt)}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-4 flex-wrap">
                        {savedInfo?.pdf && (
                          <>
                            <a href={savedInfo.pdf} target="_blank" rel="noreferrer" className="underline font-semibold flex items-center gap-1">
                              <ExternalLink size={13} /> Open Offer Letter PDF
                            </a>
                            <button
                              type="button"
                              onClick={() => downloadFileFromUrl(savedInfo.pdf as string, 'Internship Offer Letter.pdf')}
                              className="font-semibold flex items-center gap-1 hover:underline"
                            >
                              <Download size={13} /> Download PDF
                            </button>
                          </>
                        )}
                        {savedInfo?.docx && (
                          <>
                            <a href={savedInfo.docx} target="_blank" rel="noreferrer" className="underline font-semibold flex items-center gap-1">
                              <ExternalLink size={13} /> Open Offer Letter DOCX
                            </a>
                            <button
                              type="button"
                              onClick={() => downloadFileFromUrl(savedInfo.docx as string, 'Internship Offer Letter.docx')}
                              className="font-semibold flex items-center gap-1 hover:underline"
                            >
                              <Download size={13} /> Download DOCX
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
                  <Lock size={12} /> Company clauses are locked. Only highlighted fields are editable.
                </p>

                {/* Digital Signature */}
                <section className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
                  <h3 className="text-sm font-bold text-indigo-600 uppercase mb-4 border-b pb-2 flex items-center gap-2">
                    <PenTool size={16} /> Digital Signature
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">
                    Your signature will be embedded into the <strong>Candidate Signature</strong> placeholder inside the DOCX.
                  </p>
                  <div className="flex bg-gray-100 p-1 rounded-xl mb-4 max-w-md mx-auto">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, signatureType: 'DRAW' })}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${
                        formData.signatureType === 'DRAW' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <PenTool size={14} /> Draw
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, signatureType: 'UPLOAD' })}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${
                        formData.signatureType === 'UPLOAD' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <ImageIcon size={14} /> Upload
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, signatureType: 'TYPE' })}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${
                        formData.signatureType === 'TYPE' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Type size={14} /> Type
                    </button>
                  </div>

                  <div className="border rounded-xl p-4 bg-gray-50 flex flex-col items-center min-h-[200px] justify-center">
                    {formData.signatureType === 'DRAW' && (
                      <>
                        <p className="text-xs text-gray-500 mb-4">Draw your signature below using mouse or touch</p>
                        <canvas
                          ref={sigCanvas}
                          width={400}
                          height={150}
                          className="border-2 border-dashed border-gray-300 bg-white rounded-lg cursor-crosshair touch-none"
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseOut={stopDrawing}
                        ></canvas>
                        <button type="button" onClick={clearCanvas} className="mt-4 text-xs text-rose-600 font-bold hover:underline">
                          Clear Canvas
                        </button>
                      </>
                    )}

                    {formData.signatureType === 'UPLOAD' && (
                      <>
                        <p className="text-xs text-gray-500 mb-4">Upload a transparent PNG of your signature</p>
                        <label className="flex items-center gap-2 bg-white border border-gray-300 px-6 py-3 rounded-xl cursor-pointer hover:bg-gray-50 shadow-sm text-sm font-bold text-gray-700">
                          <UploadCloud size={18} />
                          {formData.signatureData ? 'Replace Image' : 'Select Image'}
                          <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleSignatureImageUpload} />
                        </label>
                      </>
                    )}

                    {formData.signatureType === 'TYPE' && (
                      <>
                        <p className="text-xs text-gray-500 mb-4">Type your full name to generate a signature</p>
                        <input
                          type="text"
                          value={formData.signatureText}
                          onChange={(e) => renderTypedSignature(e.target.value, formData.signatureStyle, formData.signatureSize)}
                          placeholder="e.g. John Doe"
                          className="border border-gray-300 rounded-xl px-4 py-3 w-80 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-center text-xl font-semibold"
                        />
                        <div className="flex flex-col sm:flex-row items-center gap-4 mt-4">
                          <select
                            value={formData.signatureStyle}
                            onChange={(e) => renderTypedSignature(formData.signatureText, e.target.value, formData.signatureSize)}
                            className="text-xs font-bold bg-white border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
                          >
                            {SIGNATURE_FONTS.map((f) => (
                              <option key={f.label} value={f.value}>
                                {f.label}
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-500 uppercase">Size</span>
                            <input
                              type="range"
                              min={28}
                              max={72}
                              value={formData.signatureSize}
                              onChange={(e) => renderTypedSignature(formData.signatureText, formData.signatureStyle, Number(e.target.value))}
                              className="w-32"
                            />
                          </div>
                        </div>
                        {formData.signatureText && (
                          <div className="mt-4 flex flex-col items-center">
                            <span className="text-[10px] font-bold text-gray-400 uppercase mb-1">Preview</span>
                            <div
                              className="signature-swatch"
                              style={{ ['--sig-font' as any]: formData.signatureStyle, ['--sig-size' as any]: `${formData.signatureSize}px` }}
                            >
                              {formData.signatureText}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {hasSignature && (
                    <div className="mt-4 flex items-center justify-center gap-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                      <ShieldCheck size={16} />
                      Signature captured. It will be embedded into the signed offer letter with a verification timestamp.
                    </div>
                  )}
                </section>

                <div className="flex justify-center gap-4">
                  {onboarding?.status === 'OFFER_SENT' ? (
                    <button
                      type="button"
                      onClick={handleAcceptOffer}
                      disabled={!hasSignature || submitting}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-full font-bold shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? 'Accepting...' : 'Accept Offer'} <CheckCircle size={20} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={goNext}
                      disabled={!hasSignature}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-full font-bold shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Continue to Documents <ChevronRight size={20} />
                    </button>
                  )}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="text-center">
                  <h2 className="text-2xl font-extrabold text-gray-900">Upload Verification Documents</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Upload the required documents below. PDF, JPG and PNG are accepted. You can preview, replace or remove files anytime.
                  </p>
                </div>

                {onboarding.documents?.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-800">
                    <p className="font-bold mb-2 flex items-center gap-2">
                      <FileText size={14} /> Previously uploaded documents
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {onboarding.documents.map((d: any) => (
                        <a
                          key={d.id}
                          href={d.driveUrl || d.localUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 bg-white border border-blue-200 rounded-lg px-3 py-1.5 font-semibold hover:bg-blue-100"
                        >
                          <ExternalLink size={12} /> {d.fileName}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {DOC_DEFS.map((def) => {
                    const current = getFilesFor(def.key);
                    const isReq = def.required;
                    const ok = current.length > 0;
                    return (
                      <div
                        key={def.key}
                        className={`bg-white rounded-3xl shadow-xl border p-5 transition-colors ${
                          isReq && !ok ? 'border-gray-200' : ok ? 'border-emerald-200' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-bold text-gray-900 text-sm">{def.label}</h4>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {isReq ? 'Required' : 'Optional'}
                              {def.hint ? ` • ${def.hint}` : ''}
                            </p>
                          </div>
                          {ok ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                              <Check size={11} /> {current.length} Uploaded
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Pending</span>
                          )}
                        </div>

                        {current.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {current.map((file, i) => {
                              const prog = uploadProgress?.perFile?.[def.key];
                              return (
                                <div key={i} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                                  {isImage(file) ? (
                                    <img src={fileUrl(file)} alt={file.name} className="w-10 h-10 object-cover rounded-lg border border-gray-200" />
                                  ) : (
                                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                                      <FileText size={18} className="text-indigo-600" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-xs font-bold text-gray-800 truncate">{file.name}</p>
                                      {prog && !prog.done && (
                                        <span className="text-[10px] font-bold text-indigo-600 shrink-0">{prog.percent}%</span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                                    {prog && !prog.done && (
                                      <div className="w-full h-1 bg-gray-200 rounded-full mt-1.5 overflow-hidden">
                                        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${prog.percent}%` }} />
                                      </div>
                                    )}
                                  </div>
                                  {file.type === 'application/pdf' ? (
                                    <a href={fileUrl(file)} target="_blank" rel="noreferrer" className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Open PDF">
                                      <Eye size={15} />
                                    </a>
                                  ) : null}
                                  <button type="button" onClick={() => removeFile(def.key, i)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg" title="Remove">
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <label
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOver(def.key);
                          }}
                          onDragLeave={() => setDragOver((d) => (d === def.key ? null : d))}
                          onDrop={(e) => {
                            setDragOver(null);
                            handleDrop(e, def);
                          }}
                          className={`flex items-center justify-center gap-2 w-full border-2 border-dashed rounded-xl py-4 cursor-pointer text-xs font-bold transition-colors ${
                            dragOver === def.key
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                              : ok
                                ? 'border-gray-200 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50'
                                : isReq
                                  ? 'border-indigo-300 text-indigo-600 hover:bg-indigo-50'
                                  : 'border-gray-200 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50'
                          }`}
                        >
                          <UploadCloud size={16} />
                          {dragOver === def.key
                            ? 'Drop file to upload'
                            : ok
                              ? def.multiple
                                ? 'Add More (or drag & drop)'
                                : 'Replace (or drag & drop)'
                              : `Upload ${def.label} (or drag & drop)`}
                          <input type="file" accept={def.accept} multiple={def.multiple} className="hidden" onChange={(e) => handleFileChange(e, def)} />
                        </label>
                      </div>
                    );
                  })}
                </div>

                {requiredMissing.length > 0 && (
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                    <AlertTriangle size={15} />
                    Missing required documents: {requiredMissing.map((k) => DOC_DEFS.find((d) => d.key === k)?.label).join(', ')}
                  </div>
                )}

                <div className="flex justify-center gap-4">
                  <button
                    type="button"
                    onClick={goBack}
                    className="bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50 px-8 py-4 rounded-full font-bold shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <ChevronLeft size={20} /> Back to Document
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={requiredMissing.length > 0}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-full font-bold shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Review & Submit <ChevronRight size={20} />
                  </button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="text-center">
                  <h2 className="text-2xl font-extrabold text-gray-900">Final Review</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Please review all details and documents before submitting your final offer acceptance.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Candidate details */}
                  <section className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6">
                    <h3 className="text-xs font-bold text-indigo-600 uppercase mb-4 flex items-center gap-2 border-b pb-2">
                      <ListChecks size={14} /> Candidate Details
                    </h3>
                    <dl className="space-y-2 text-sm">
                      {[
                        ['Full Name', formData.fullName],
                        ['Email', formData.email],
                        ['Phone', formData.phone],
                        ['Date of Birth', formData.dateOfBirth],
                        ['Gender', formData.gender],
                        ['Current Address', formData.currentAddress],
                        ['Permanent Address', formData.permanentAddress],
                        ['Aadhaar Number', formData.aadhaar],
                        ['PAN Number', formData.pan],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4">
                          <dt className="text-gray-400 font-semibold shrink-0">{k}</dt>
                          <dd className="text-gray-900 font-bold text-right">{v || '—'}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Emergency Contact</p>
                      <dl className="space-y-1.5 text-sm">
                        {[
                          ['Name', formData.emergencyName],
                          ['Relationship', formData.emergencyRelationship],
                          ['Phone', formData.emergencyPhone],
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-4">
                            <dt className="text-gray-400 font-semibold">{k}</dt>
                            <dd className="text-gray-900 font-bold text-right">{v || '—'}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </section>

                  {/* Signature + documents */}
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
                          <AlertTriangle size={15} /> Signature not provided yet.
                        </p>
                      )}
                    </div>

                    <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6">
                      <h3 className="text-xs font-bold text-indigo-600 uppercase mb-4 flex items-center gap-2 border-b pb-2">
                        <FileText size={14} /> Document Checklist
                      </h3>
                      <ul className="space-y-2">
                        {DOC_DEFS.map((def) => {
                          const count = getFilesFor(def.key).length;
                          const ok = count > 0;
                          return (
                            <li key={def.key} className="flex items-center gap-3 text-sm">
                              <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                                  ok ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-300'
                                }`}
                              >
                                {ok ? <Check size={12} /> : <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />}
                              </span>
                              <span className={`flex-1 font-semibold ${ok ? 'text-gray-900' : 'text-gray-400'}`}>{def.label}</span>
                              {ok && (
                                <span className="text-[10px] font-bold text-emerald-600">
                                  {count} file{count > 1 ? 's' : ''}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </section>
                </div>

                {/* Declaration */}
                <label className="flex items-start gap-3 bg-white rounded-3xl shadow-xl border border-gray-100 p-6 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={declaration}
                    onChange={(e) => setDeclaration(e.target.checked)}
                    className="mt-0.5 w-5 h-5 rounded accent-indigo-600"
                  />
                  <div>
                    <p className="font-bold text-gray-900 text-sm">Declaration</p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      I hereby declare that the information provided and the documents uploaded are genuine and complete to the
                      best of my knowledge. I understand that any misrepresentation or false information may lead to the
                      termination of my employment/engagement at any stage.
                    </p>
                  </div>
                </label>

                <div className="flex justify-center gap-4">
                  <button
                    type="button"
                    onClick={goBack}
                    className="bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50 px-8 py-4 rounded-full font-bold shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <ChevronLeft size={20} /> Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || !declaration}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-12 py-4 rounded-full font-bold shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <UploadCloud size={24} />
                    {submitting ? 'Submitting...' : 'Sign & Submit Documents'}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <StatusView
            status={onboarding.status}
            rejected={isRejected}
            expired={isExpired}
            steps={completedSteps()}
            onboarding={onboarding}
            justSubmitted={submitted}
            formatDate={formatDate}
          />
        )}
      </main>
    </div>
  );
};

const showWorkspaceFor = (status: string) =>
  ['OFFER_SENT', 'ACCEPTED', 'CHANGES_REQUESTED', 'JOINED', 'EMPLOYEE_CREATED', 'CREDENTIALS_SENT', 'ACTIVE'].includes(status);

const StatusView: React.FC<{
  status: string;
  rejected: boolean;
  expired: boolean;
  steps: { key: string; label: string; done: boolean }[];
  onboarding: any;
  justSubmitted: boolean;
  formatDate: (d: Date | string) => string;
}> = ({ status, rejected, expired, steps, onboarding, justSubmitted, formatDate }) => {
  const submittedAt = onboarding?.acceptedAt || onboarding?.updatedAt;
  const doneCount = steps.filter((s) => s.done).length;
  const timelineIndex = Math.max(0, steps.reduce((max, s, i) => (s.done ? i : max), -1));

  return (
    <div className="bg-white p-8 sm:p-12 rounded-3xl shadow-xl border border-gray-100 max-w-2xl mx-auto">
      {rejected ? (
        <div className="text-center">
          <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle size={40} className="text-rose-500" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Application Not Approved</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            We regret to inform you that your application could not be approved at this time.
          </p>
          {onboarding?.reviewReason && (
            <div className="mt-4 bg-rose-50 border border-rose-200 rounded-2xl p-4 text-sm text-rose-700">
              <span className="font-bold">Reason:</span> {onboarding.reviewReason}
            </div>
          )}
        </div>
      ) : expired ? (
        <div className="text-center">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock size={40} className="text-amber-500" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Link Expired</h2>
          <p className="text-gray-600 text-sm">
            This acceptance link has expired. Please contact the HR team to resend a fresh link.
          </p>
        </div>
      ) : (
        <>
          <div className="text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              {justSubmitted ? <PartyPopper size={40} className="text-emerald-500" /> : <CheckCircle size={40} className="text-emerald-500" />}
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">
              {justSubmitted ? 'Submission Successful!' : 'Onboarding In Progress'}
            </h2>
            <p className="text-gray-600 text-sm">
              {justSubmitted
                ? 'Your onboarding documents and signed offer letter have been uploaded securely. A confirmation email has been sent to you. You will be notified once the HR verification is complete.'
                : 'Your onboarding is currently being processed by the HR team. Track the progress below.'}
            </p>
            {onboarding?.candidateData?.referenceNumber && (
              <p className="mt-3 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-4 py-1.5 inline-block">
                Ref No: {onboarding.candidateData.referenceNumber}
              </p>
            )}
          </div>

          {submittedAt && (
            <p className="text-center text-[11px] text-gray-400 mt-3">
              Submitted on {formatDate(submittedAt)}
            </p>
          )}

          {onboarding?.candidateData?.signatureHash && (
            <div className="mt-4 flex items-center justify-center gap-2 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <ShieldCheck size={14} />
              Signed electronically • verified timestamp & IP recorded
            </div>
          )}

          {onboarding?.candidateData?.folderUrl && (
            <div className="mt-3 text-center">
              <a
                href={onboarding.candidateData.folderUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 hover:underline"
              >
                <ExternalLink size={13} /> Open your documents folder
              </a>
            </div>
          )}

          {/* Timeline */}
          <div className="mt-8">
            <div className="flex items-start justify-between relative">
              <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200" />
              <div
                className="absolute top-4 left-4 right-4 h-0.5 bg-emerald-400 transition-all"
                style={{ width: `${(timelineIndex / (TIMELINE_STEPS.length - 1)) * 100}%` }}
              />
              {TIMELINE_STEPS.map((s, i) => {
                const done = i <= timelineIndex;
                const active = i === timelineIndex;
                return (
                  <div key={s.key} className="relative flex flex-col items-center w-1/6">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 transition-colors ${
                        done
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'bg-white border-gray-200 text-gray-300'
                      } ${active && !done ? 'animate-pulse' : ''}`}
                    >
                      {done ? <Check size={14} /> : <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />}
                    </div>
                    <span
                      className={`mt-2 text-[10px] font-bold text-center leading-tight ${
                        done ? 'text-gray-900' : 'text-gray-400'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {status && !justSubmitted && (
            <p className="mt-6 text-center text-xs font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1.5 rounded-full inline-block w-full">
              Status: {status.replace(/_/g, ' ')}
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default CandidatePortal;
