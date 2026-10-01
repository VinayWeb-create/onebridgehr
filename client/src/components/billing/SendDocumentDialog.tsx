import React, { useEffect, useState } from 'react';
import { Mail, MessageSquare, Link2, Copy, RefreshCw, X, Paperclip, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { crmService, type DocType, type SendPreview } from '../../services/crmService';
import { copyToClipboard, errorMessage } from '../../utils/documentActions';

export type SendTab = 'email' | 'whatsapp' | 'link';

interface Props {
  type: DocType;
  id: string;
  label: string; // e.g. "Quotation QUO-2026-0001"
  initialTab?: SendTab;
  onClose: () => void;
  onSent?: () => void;
}

const inputClass =
  'w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm text-slate-900 dark:text-white';
const labelClass = 'block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1';

export const SendDocumentDialog: React.FC<Props> = ({ type, id, label, initialTab = 'email', onClose, onSent }) => {
  const [tab, setTab] = useState<SendTab>(initialTab);
  const [preview, setPreview] = useState<SendPreview | null>(null);
  const [loadError, setLoadError] = useState('');

  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachPdf, setAttachPdf] = useState(true);
  const [includeLink, setIncludeLink] = useState(true);

  const [phone, setPhone] = useState('');
  const [waMessage, setWaMessage] = useState('');

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    crmService
      .getSendPreview(type, id)
      .then((p) => {
        setPreview(p);
        setTo(p.email.to);
        setCc(p.email.cc.join(', '));
        setSubject(p.email.subject);
        setMessage(p.email.message);
        setPhone(p.whatsapp.phone);
        setWaMessage(p.whatsapp.message);
        setShareUrl(p.shareUrl);
      })
      .catch((err) => setLoadError(errorMessage(err, 'Could not prepare the message.')));
  }, [type, id]);

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await crmService.sendDocumentEmail(type, id, {
        to,
        cc: cc.split(',').map((s) => s.trim()).filter(Boolean),
        subject,
        message,
        attachPdf,
        includeLink,
      });
      setResult({ ok: true, text: res.message || 'Email sent' });
      onSent?.();
    } catch (err) {
      setResult({ ok: false, text: errorMessage(err, 'Email could not be sent') });
    } finally {
      setBusy(false);
    }
  };

  const handleWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    // Open the tab now (inside the click) so the popup blocker allows it.
    const waTab = window.open('', '_blank');
    setBusy(true);
    setResult(null);
    try {
      const res = await crmService.sendDocumentWhatsApp(type, id, { phone, message: waMessage });
      if (waTab) waTab.location.href = res.whatsappUrl;
      else window.open(res.whatsappUrl, '_blank');
      setResult({ ok: true, text: 'WhatsApp opened with the message. Press send in WhatsApp to deliver it.' });
      onSent?.();
    } catch (err) {
      waTab?.close();
      setResult({ ok: false, text: errorMessage(err, 'Could not prepare the WhatsApp message') });
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (await copyToClipboard(shareUrl)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleResetLink = async () => {
    setBusy(true);
    try {
      const url = await crmService.getShareLink(type, id, true);
      setShareUrl(url);
      setResult({ ok: true, text: 'New link created. The old link no longer works.' });
    } catch (err) {
      setResult({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const tabs: { id: SendTab; label: string; icon: React.ElementType }[] = [
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
    { id: 'link', label: 'Share link', icon: Link2 },
  ];

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-brand-900 rounded-2xl shadow-xl w-full max-w-xl overflow-hidden">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="font-bold">Send {label}</h3>
            {preview && <p className="text-xs text-slate-400">From {preview.companyName}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-200 dark:border-brand-800">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setResult(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold border-b-2 ${
                tab === t.id
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {loadError ? (
            <div className="text-sm text-rose-600">{loadError}</div>
          ) : !preview ? (
            <div className="py-10 flex justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : tab === 'email' ? (
            <form onSubmit={handleSendEmail} className="space-y-3">
              <div>
                <label className={labelClass}>To</label>
                <input type="email" required value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>CC (optional, comma-separated)</label>
                <input value={cc} onChange={(e) => setCc(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Subject</label>
                <input required value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Message</label>
                <textarea required rows={8} value={message} onChange={(e) => setMessage(e.target.value)} className={inputClass} />
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-slate-700 dark:text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={attachPdf} onChange={(e) => setAttachPdf(e.target.checked)} />
                  <Paperclip className="w-3.5 h-3.5" /> Attach PDF ({preview.fileName})
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={includeLink} onChange={(e) => setIncludeLink(e.target.checked)} />
                  <Link2 className="w-3.5 h-3.5" /> Include "view online" button
                </label>
              </div>
              <ResultBanner result={result} />
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-brand-800">
                  {result?.ok ? 'Done' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={busy || !!result?.ok}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold rounded-lg flex items-center gap-2"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  {result?.ok ? 'Sent' : 'Send email'}
                </button>
              </div>
            </form>
          ) : tab === 'whatsapp' ? (
            <form onSubmit={handleWhatsApp} className="space-y-3">
              <div>
                <label className={labelClass}>WhatsApp number</label>
                <input
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClass}
                  placeholder="10-digit mobile, or with country code e.g. +971…"
                />
              </div>
              <div>
                <label className={labelClass}>Message (includes the link to view & download the PDF)</label>
                <textarea required rows={9} value={waMessage} onChange={(e) => setWaMessage(e.target.value)} className={inputClass} />
              </div>
              <p className="text-xs text-slate-500">
                WhatsApp opens with this message ready. Press send in WhatsApp to deliver it.
              </p>
              <ResultBanner result={result} />
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-brand-800">
                  {result?.ok ? 'Done' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold rounded-lg flex items-center gap-2"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                  Open WhatsApp
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Anyone with this link can view and download this document{type === 'quotations' ? ' and accept it' : ''}.
                No login is needed.
              </p>
              <div className="flex gap-2">
                <input readOnly value={shareUrl} className={`${inputClass} font-mono text-xs`} onFocus={(e) => e.target.select()} />
                <button onClick={handleCopy} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg flex items-center gap-1.5 shrink-0">
                  {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <button
                onClick={handleResetLink}
                disabled={busy}
                className="text-xs font-semibold text-slate-500 hover:text-rose-600 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Create a new link (the current link stops working)
              </button>
              <ResultBanner result={result} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ResultBanner: React.FC<{ result: { ok: boolean; text: string } | null }> = ({ result }) =>
  result ? (
    <div
      className={`flex items-start gap-2 text-sm rounded-lg p-3 whitespace-pre-line ${
        result.ok
          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300'
          : 'bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-300'
      }`}
    >
      {result.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
      {result.text}
    </div>
  ) : null;

export default SendDocumentDialog;
