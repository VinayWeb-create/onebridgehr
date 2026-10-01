import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Search,
  Mail,
  MessageSquare,
  Download,
  Printer,
  Eye,
  Edit2,
  Trash2,
  Link2,
  History,
  CheckCircle2,
  ArrowRightLeft,
  Ban,
  Receipt,
} from 'lucide-react';
import { crmService, type Quotation } from '../../services/crmService';
import { useDialog } from '../../context/DialogContext';
import { CrmNavTabs } from '../../components/CrmNavTabs';
import { DocumentEditor, type EditorInitial, type SaveAction } from '../../components/billing/DocumentEditor';
import { SendDocumentDialog, type SendTab } from '../../components/billing/SendDocumentDialog';
import { DocumentActivityDialog } from '../../components/billing/DocumentActivityDialog';
import { RowMenu } from '../../components/billing/RowMenu';
import { IconButton } from '../../components/billing/IconButton';
import { copyToClipboard, downloadPdf, errorMessage, formatINR, openPdf, printPdf } from '../../utils/documentActions';

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Draft', cls: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' },
  SENT: { label: 'Sent', cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  VIEWED: { label: 'Viewed', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  ACCEPTED: { label: 'Accepted', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  CONVERTED: { label: 'Invoiced', cls: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
  DECLINED: { label: 'Declined', cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  EXPIRED: { label: 'Expired', cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
};

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const QuotationsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { confirm, alert } = useDialog();

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [editor, setEditor] = useState<{ initial: EditorInitial | null } | null>(null);
  const [sendDialog, setSendDialog] = useState<{ id: string; label: string; tab: SendTab } | null>(null);
  const [activity, setActivity] = useState<{ id: string; label: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setQuotations(await crmService.getQuotations(statusFilter, search || undefined));
    } catch (err) {
      console.error('Failed to load quotations:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  // Opened from a lead ("Create quotation")
  useEffect(() => {
    const fromLead = location.state?.createFromLead;
    if (!fromLead) return;
    setEditor({
      initial: {
        leadId: fromLead.leadId,
        clientName: fromLead.clientName || '',
        clientCompany: fromLead.clientCompany || '',
        clientEmail: fromLead.clientEmail || '',
        clientPhone: fromLead.clientPhone || '',
        title: fromLead.serviceOfInterest ? `${fromLead.serviceOfInterest} Proposal` : '',
      },
    });
    window.history.replaceState({}, document.title);
  }, [location.state]);

  const label = (q: Quotation) => `Quotation ${q.quotationNumber}`;

  const run = async (fn: () => Promise<unknown>, failTitle: string) => {
    try {
      await fn();
    } catch (err) {
      await alert({ title: failTitle, message: errorMessage(err), variant: 'error' });
    }
  };

  const handleSaved = (doc: any, action: SaveAction) => {
    load();
    if (action === 'new') return;
    setEditor(null);
    if (action === 'send') setSendDialog({ id: doc.id, label: label(doc), tab: 'email' });
  };

  const handleCopyLink = (q: Quotation) =>
    run(async () => {
      const url = await crmService.getShareLink('quotations', q.id);
      await copyToClipboard(url);
      await alert({ title: 'Link copied', message: `Client link for ${q.quotationNumber} copied:\n${url}`, variant: 'success' });
    }, 'Could not get the link');

  const handleAccept = async (q: Quotation) => {
    const ok = await confirm({
      title: 'Mark as accepted',
      message: `Mark ${q.quotationNumber} for ${q.clientCompany || q.clientName} as accepted by the client?`,
      confirmText: 'Mark accepted',
      variant: 'info',
    });
    if (ok)
      await run(async () => {
        await crmService.acceptQuotation(q.id);
        load();
      }, 'Could not update the quotation');
  };

  const handleConvert = async (q: Quotation) => {
    const ok = await confirm({
      title: 'Create invoice',
      message: `Create an invoice from ${q.quotationNumber} (${formatINR(q.totalAmount)})? Items, client details and GST are copied, and you can edit it before sending.`,
      confirmText: 'Create invoice',
      variant: 'info',
    });
    if (!ok) return;
    await run(async () => {
      const res = await crmService.convertQuotation(q.id);
      load();
      const goThere = await confirm({
        title: 'Invoice ready',
        message: `${res.message}. Open Invoices now?`,
        confirmText: 'Open invoices',
        variant: 'success',
      });
      if (goThere) navigate('/crm/invoices', { state: { highlightInvoiceId: res.data.id } });
    }, 'Could not create the invoice');
  };

  const handleDecline = async (q: Quotation) => {
    const ok = await confirm({
      title: 'Mark as declined',
      message: `Mark ${q.quotationNumber} as declined by the client?`,
      confirmText: 'Mark declined',
      variant: 'warning',
    });
    if (ok)
      await run(async () => {
        await crmService.updateQuotation(q.id, { ...q, status: 'DECLINED' });
        load();
      }, 'Could not update the quotation');
  };

  const handleDelete = async (q: Quotation) => {
    const ok = await confirm({
      title: 'Delete quotation',
      message: `Permanently delete ${q.quotationNumber}? Links already shared with the client will stop working.`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (ok)
      await run(async () => {
        await crmService.deleteQuotation(q.id);
        load();
      }, 'Could not delete');
  };

  const openList = quotations.filter((q) => ['DRAFT', 'SENT', 'VIEWED'].includes(q.status));
  const won = quotations.filter((q) => ['ACCEPTED', 'CONVERTED'].includes(q.status));
  const sum = (list: Quotation[]) => list.reduce((s, q) => s + Number(q.totalAmount || 0), 0);
  const stats = [
    { label: 'Open quotations', value: String(openList.length), sub: formatINR(sum(openList)) },
    { label: 'Viewed by client', value: String(quotations.filter((q) => q.viewedAt).length), sub: 'opened the link' },
    { label: 'Accepted / invoiced', value: String(won.length), sub: formatINR(sum(won)) },
    { label: 'Win rate', value: `${quotations.length ? Math.round((won.length / quotations.length) * 100) : 0}%`, sub: `of ${quotations.length} shown` },
  ];

  return (
    <div className="space-y-6">
      <CrmNavTabs />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-brand-900 to-indigo-950 p-6 rounded-3xl border border-brand-800 shadow-xl">
        <div>
          <h1 className="font-extrabold text-2xl tracking-tight text-white flex items-center gap-2">
            <FileText className="text-orange-400" size={24} />
            Quotations & Estimates
          </h1>
          <p className="text-xs text-brand-300 mt-1 font-medium">
            Create GST quotations, send them by email or WhatsApp, see when clients view and accept them, and convert them to invoices.
          </p>
        </div>
        <button
          onClick={() => setEditor({ initial: null })}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-indigo-600 hover:from-orange-600 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all text-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Create Quotation
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="p-4 bg-white dark:bg-brand-900 rounded-xl border border-slate-200 dark:border-brand-800 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{s.label}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{s.value}</p>
            <p className="text-xs text-slate-500">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-brand-900 p-4 rounded-xl border border-slate-200 dark:border-brand-800">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by quote #, client, email, company or PO…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none"
        >
          <option value="ALL">All statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      {loading && quotations.length === 0 ? (
        <div className="py-20 flex justify-center">
          <span className="w-8 h-8 rounded-full border-2 border-blue-600/30 border-t-blue-600 animate-spin" />
        </div>
      ) : quotations.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-brand-900 rounded-xl border border-slate-200 dark:border-brand-800">
          <FileText className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No quotations found</h3>
          <p className="text-xs text-slate-400 mt-1">Create your first quotation, or start one from a lead.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-brand-900 rounded-xl border border-slate-200 dark:border-brand-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-brand-950 text-slate-500 font-semibold border-b border-slate-200 dark:border-brand-800">
                <tr>
                  <th className="py-3 px-4">Quote #</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Sent / viewed</th>
                  <th className="py-3 px-4">Valid until</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-brand-800 text-slate-800 dark:text-slate-200">
                {quotations.map((q) => {
                  const cfg = STATUS_CONFIG[q.status] || STATUS_CONFIG.DRAFT;
                  const invoice = q.invoices?.[0];
                  const canAccept = ['DRAFT', 'SENT', 'VIEWED'].includes(q.status);
                  const canConvert = !['CONVERTED', 'DECLINED', 'EXPIRED'].includes(q.status) && !invoice;
                  return (
                    <tr key={q.id} className="hover:bg-slate-50 dark:hover:bg-brand-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 whitespace-nowrap">{q.quotationNumber}</div>
                        <div className="text-[11px] text-slate-400">{fmtDate(q.createdAt)}</div>
                      </td>
                      <td className="py-3 px-4 max-w-[240px]">
                        <div className="font-semibold text-slate-900 dark:text-white truncate">{q.clientCompany || q.clientName}</div>
                        <div className="text-xs text-slate-400 truncate">{q.title || (q.clientCompany ? q.clientName : q.clientEmail)}</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatINR(q.totalAmount)}
                        <span className="block text-[11px] font-normal text-slate-400">
                          incl. {formatINR(q.taxAmount)} {q.taxType === 'IGST' ? 'IGST' : 'GST'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${cfg.cls}`}>{cfg.label}</span>
                        {invoice && <div className="text-[11px] text-indigo-500 mt-1">{invoice.invoiceNumber}</div>}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${q.sentViaEmail ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 dark:bg-brand-800 text-slate-400'}`}>
                            Email
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${q.sentViaWhatsApp ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 dark:bg-brand-800 text-slate-400'}`}>
                            WhatsApp
                          </span>
                        </div>
                        {q.viewedAt && (
                          <div className="text-[11px] text-amber-600 mt-1">
                            Viewed {q.viewCount && q.viewCount > 1 ? `${q.viewCount}× · ` : ''}first {fmtDate(q.viewedAt)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs whitespace-nowrap">{fmtDate(q.validUntil)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton title="View PDF" icon={Eye} onClick={() => run(() => openPdf('quotations', q.id), 'Could not open the PDF')} />
                          <IconButton
                            title="Download PDF"
                            icon={Download}
                            onClick={() => run(() => downloadPdf('quotations', q.id, `Quotation_${q.quotationNumber}`), 'Could not download the PDF')}
                          />
                          <IconButton title="Send by email" icon={Mail} className="text-blue-600" onClick={() => setSendDialog({ id: q.id, label: label(q), tab: 'email' })} />
                          <IconButton
                            title="Send on WhatsApp"
                            icon={MessageSquare}
                            className="text-emerald-600"
                            onClick={() => setSendDialog({ id: q.id, label: label(q), tab: 'whatsapp' })}
                          />
                          {canConvert && (
                            <button
                              onClick={() => handleConvert(q)}
                              className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded text-xs font-semibold whitespace-nowrap"
                              title="Create an invoice from this quotation"
                            >
                              → Invoice
                            </button>
                          )}
                          <RowMenu
                            items={[
                              { label: 'Print', icon: Printer, onClick: () => run(() => printPdf('quotations', q.id), 'Could not print') },
                              { label: 'Copy client link', icon: Link2, onClick: () => handleCopyLink(q) },
                              { label: 'History', icon: History, onClick: () => setActivity({ id: q.id, label: q.quotationNumber }) },
                              { label: 'Edit', icon: Edit2, onClick: () => setEditor({ initial: q }), hidden: q.status === 'CONVERTED' },
                              { label: 'Mark accepted', icon: CheckCircle2, onClick: () => handleAccept(q), hidden: !canAccept },
                              { label: 'Create invoice', icon: ArrowRightLeft, onClick: () => handleConvert(q), hidden: !canConvert },
                              {
                                label: 'Open invoice',
                                icon: Receipt,
                                onClick: () => navigate('/crm/invoices', { state: { highlightInvoiceId: invoice?.id } }),
                                hidden: !invoice,
                              },
                              { label: 'Mark declined', icon: Ban, onClick: () => handleDecline(q), hidden: !canAccept },
                              { label: 'Delete', icon: Trash2, onClick: () => handleDelete(q), danger: true },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editor && <DocumentEditor kind="quotation" initial={editor.initial} onClose={() => setEditor(null)} onSaved={handleSaved} />}
      {sendDialog && (
        <SendDocumentDialog
          type="quotations"
          id={sendDialog.id}
          label={sendDialog.label}
          initialTab={sendDialog.tab}
          onClose={() => setSendDialog(null)}
          onSent={load}
        />
      )}
      {activity && <DocumentActivityDialog type="quotations" id={activity.id} label={activity.label} onClose={() => setActivity(null)} />}
    </div>
  );
};

export default QuotationsPage;
