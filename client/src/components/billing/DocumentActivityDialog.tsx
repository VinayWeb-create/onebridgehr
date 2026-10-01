import React, { useEffect, useState } from 'react';
import { X, Mail, MessageSquare, Eye, CheckCircle2, IndianRupee, Loader2 } from 'lucide-react';
import { crmService, type DocType, type DocumentActivity } from '../../services/crmService';
import { errorMessage, formatINR } from '../../utils/documentActions';

interface Props {
  type: DocType;
  id: string;
  label: string;
  onClose: () => void;
}

const when = (d: string) =>
  new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const DocumentActivityDialog: React.FC<Props> = ({ type, id, label, onClose }) => {
  const [data, setData] = useState<DocumentActivity | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    crmService.getDocumentActivity(type, id).then(setData).catch((err) => setError(errorMessage(err)));
  }, [type, id]);

  const events: { at: string; icon: React.ElementType; color: string; title: string; detail?: string }[] = [];
  if (data) {
    for (const log of data.logs) {
      const isEmail = log.channel === 'EMAIL';
      events.push({
        at: log.sentAt,
        icon: isEmail ? Mail : MessageSquare,
        color: log.status === 'FAILED' ? 'text-rose-600' : isEmail ? 'text-indigo-600' : 'text-emerald-600',
        title: isEmail
          ? log.status === 'FAILED'
            ? `Email failed to ${log.recipient}`
            : `Emailed to ${log.recipient}`
          : `WhatsApp opened for ${log.recipient}`,
        detail: log.errorMessage || log.subject,
      });
    }
    if (data.viewedAt) {
      events.push({
        at: data.viewedAt,
        icon: Eye,
        color: 'text-amber-600',
        title: `First viewed by client`,
        detail: `${data.viewCount} view${data.viewCount === 1 ? '' : 's'} in total`,
      });
    }
    if (data.acceptedAt) {
      events.push({ at: data.acceptedAt, icon: CheckCircle2, color: 'text-emerald-600', title: 'Accepted', detail: data.acceptedBy || undefined });
    }
    for (const p of data.payments) {
      events.push({
        at: p.date,
        icon: IndianRupee,
        color: 'text-emerald-600',
        title: `Payment ${formatINR(p.amount)} received`,
        detail: [p.method?.replace('_', ' '), p.reference, p.notes].filter(Boolean).join(' · '),
      });
    }
    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-brand-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <h3 className="font-bold">History · {label}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {error ? (
            <div className="text-sm text-rose-600">{error}</div>
          ) : !data ? (
            <div className="py-8 flex justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-6">Not sent or viewed yet.</div>
          ) : (
            <ol className="space-y-4">
              {events.map((e, i) => (
                <li key={i} className="flex gap-3">
                  <e.icon className={`w-4 h-4 mt-0.5 shrink-0 ${e.color}`} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white break-words">{e.title}</div>
                    {e.detail && <div className="text-xs text-slate-500 break-words">{e.detail}</div>}
                    <div className="text-[11px] text-slate-400">{when(e.at)}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentActivityDialog;
