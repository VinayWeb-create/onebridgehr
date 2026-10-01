import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Receipt,
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
  IndianRupee,
  Ban,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { crmService, type Invoice } from '../../services/crmService';
import { useDialog } from '../../context/DialogContext';
import { CrmNavTabs } from '../../components/CrmNavTabs';
import { DocumentEditor, type EditorInitial, type SaveAction } from '../../components/billing/DocumentEditor';
import { SendDocumentDialog, type SendTab } from '../../components/billing/SendDocumentDialog';
import { DocumentActivityDialog } from '../../components/billing/DocumentActivityDialog';
import { RecordPaymentDialog } from '../../components/billing/RecordPaymentDialog';
import { RowMenu } from '../../components/billing/RowMenu';
import { IconButton } from '../../components/billing/IconButton';
import { copyToClipboard, downloadPdf, errorMessage, formatINR, openPdf, printPdf } from '../../utils/documentActions';

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Draft', cls: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' },
  UNPAID: { label: 'Unpaid', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  PARTIALLY_PAID: { label: 'Partly paid', cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  OVERDUE: { label: 'Overdue', cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  PAID: { label: 'Paid', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-slate-500/10 text-slate-500 line-through' },
};

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const InvoicesPage: React.FC = () => {
  const location = useLocation();
  const { confirm, alert } = useDialog();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [highlightId, setHighlightId] = useState<string | null>(location.state?.highlightInvoiceId || null);

  const [editor, setEditor] = useState<{ initial: EditorInitial | null } | null>(null);
  const [sendDialog, setSendDialog] = useState<{ id: string; label: string; tab: SendTab } | null>(null);
  const [activity, setActivity] = useState<{ id: string; label: string } | null>(null);
  const [paymentFor, setPaymentFor] = useState<Invoice | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setInvoices(await crmService.getInvoices(statusFilter, search || undefined));
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    const state = location.state;
    if (state?.highlightInvoiceId) {
      setHighlightId(state.highlightInvoiceId);
      setTimeout(() => setHighlightId(null), 6000);
    }
    if (state?.createFromQuotation) {
      const q = state.createFromQuotation;
      setEditor({ initial: { ...q, billingAddress: q.billingAddress || q.clientAddress, id: undefined } });
    }
    if (state) window.history.replaceState({}, document.title);
  }, [location.state]);

  const label = (inv: Invoice) => `Invoice ${inv.invoiceNumber}`;
  const balanceOf = (inv: Invoice) => Math.max(0, Number(inv.totalAmount) - Number(inv.amountPaid || 0));

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

  const handleCopyLink = (inv: Invoice) =>
    run(async () => {
      const url = await crmService.getShareLink('invoices', inv.id);
      await copyToClipboard(url);
      await alert({ title: 'Link copied', message: `Client link for ${inv.invoiceNumber} copied:\n${url}`, variant: 'success' });
    }, 'Could not get the link');

  const handleCancel = async (inv: Invoice) => {
    const ok = await confirm({
      title: 'Cancel invoice',
      message: `Cancel ${inv.invoiceNumber}? It stays in the list (numbering is kept) but is marked cancelled.`,
      confirmText: 'Cancel invoice',
      variant: 'warning',
    });
    if (ok)
      await run(async () => {
        await crmService.cancelInvoice(inv.id);
        load();
      }, 'Could not cancel');
  };

  const handleDelete = async (inv: Invoice) => {
    const ok = await confirm({
      title: 'Delete invoice',
      message: `Permanently delete ${inv.invoiceNumber}? For GST records it is usually better to cancel an invoice instead.`,
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (ok)
      await run(async () => {
        await crmService.deleteInvoice(inv.id);
        load();
      }, 'Could not delete');
  };

  const active = invoices.filter((i) => i.paymentStatus !== 'CANCELLED' && !i.isDraft);
  const totalBilled = active.reduce((s, i) => s + Number(i.totalAmount || 0), 0);
  const totalReceived = active.reduce((s, i) => s + Number(i.amountPaid || 0), 0);
  const totalOutstanding = active.reduce((s, i) => s + balanceOf(i), 0);
  const overdue = active.filter((i) => i.paymentStatus === 'OVERDUE');

  return (
    <div className="space-y-6">
      <CrmNavTabs />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-brand-900 to-indigo-950 p-6 rounded-3xl border border-brand-800 shadow-xl">
        <div>
          <h1 className="font-extrabold text-2xl tracking-tight text-white flex items-center gap-2">
            <Receipt className="text-orange-400" size={24} />
            Tax Invoices & Billing
          </h1>
          <p className="text-xs text-brand-300 mt-1 font-medium">
            GST invoices with UPI QR, email and WhatsApp sending, client payment links and payment tracking.
          </p>
        </div>
        <button
          onClick={() => setEditor({ initial: null })}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-indigo-600 hover:from-orange-600 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all text-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Create Invoice
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Total invoiced" value={formatINR(totalBilled)} icon={Receipt} color="text-slate-900 dark:text-white" />
        <Kpi label="Received" value={formatINR(totalReceived)} icon={CheckCircle2} color="text-emerald-600 dark:text-emerald-400" />
        <Kpi label="Outstanding" value={formatINR(totalOutstanding)} icon={Clock} color="text-amber-600 dark:text-amber-400" />
        <Kpi
          label="Overdue"
          value={`${overdue.length} · ${formatINR(overdue.reduce((s, i) => s + balanceOf(i), 0))}`}
          icon={AlertCircle}
          color="text-rose-600 dark:text-rose-400"
        />
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-brand-900 p-4 rounded-xl border border-slate-200 dark:border-brand-800">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by invoice #, client, email, company or PO…"
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
          <option value="ALL">All invoices</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      {loading && invoices.length === 0 ? (
        <div className="py-20 flex justify-center">
          <span className="w-8 h-8 rounded-full border-2 border-blue-600/30 border-t-blue-600 animate-spin" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-brand-900 rounded-xl border border-slate-200 dark:border-brand-800">
          <Receipt className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No invoices found</h3>
          <p className="text-xs text-slate-400 mt-1">Create an invoice, or convert an accepted quotation.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-brand-900 rounded-xl border border-slate-200 dark:border-brand-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-brand-950 text-slate-500 font-semibold border-b border-slate-200 dark:border-brand-800">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Balance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Due</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-brand-800 text-slate-800 dark:text-slate-200">
                {invoices.map((inv) => {
                  const statusKey = inv.isDraft ? 'DRAFT' : inv.paymentStatus;
                  const cfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.UNPAID;
                  const balance = balanceOf(inv);
                  const cancelled = inv.paymentStatus === 'CANCELLED';
                  return (
                    <tr
                      key={inv.id}
                      className={`transition-colors ${highlightId === inv.id ? 'bg-indigo-50 dark:bg-indigo-950/40' : 'hover:bg-slate-50 dark:hover:bg-brand-800/40'}`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 whitespace-nowrap">{inv.invoiceNumber}</div>
                        <div className="text-[11px] text-slate-400">
                          {fmtDate(inv.issueDate)}
                          {inv.quotation ? ` · ${inv.quotation.quotationNumber}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-[240px]">
                        <div className="font-semibold text-slate-900 dark:text-white truncate">{inv.clientCompany || inv.clientName}</div>
                        <div className="text-xs text-slate-400 truncate">{inv.clientCompany ? inv.clientName : inv.clientEmail}</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatINR(inv.totalAmount)}
                        <span className="block text-[11px] font-normal text-slate-400">
                          incl. {formatINR(inv.taxAmount)} {inv.taxType === 'IGST' ? 'IGST' : 'GST'}
                        </span>
                      </td>
                      <td className={`py-3 px-4 font-semibold whitespace-nowrap ${balance > 0 && !cancelled ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {cancelled ? '—' : formatINR(balance)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${cfg.cls}`}>{cfg.label}</span>
                        {inv.viewedAt && <div className="text-[11px] text-amber-600 mt-1">Viewed {fmtDate(inv.viewedAt)}</div>}
                      </td>
                      <td className="py-3 px-4 text-xs whitespace-nowrap">{fmtDate(inv.dueDate)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton title="View PDF" icon={Eye} onClick={() => run(() => openPdf('invoices', inv.id), 'Could not open the PDF')} />
                          <IconButton
                            title="Download PDF"
                            icon={Download}
                            onClick={() => run(() => downloadPdf('invoices', inv.id, `Invoice_${inv.invoiceNumber}`), 'Could not download the PDF')}
                          />
                          <IconButton title="Send by email" icon={Mail} className="text-blue-600" onClick={() => setSendDialog({ id: inv.id, label: label(inv), tab: 'email' })} />
                          <IconButton
                            title="Send on WhatsApp"
                            icon={MessageSquare}
                            className="text-emerald-600"
                            onClick={() => setSendDialog({ id: inv.id, label: label(inv), tab: 'whatsapp' })}
                          />
                          {balance > 0 && !cancelled && (
                            <button
                              onClick={() => setPaymentFor(inv)}
                              className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 rounded text-xs font-semibold whitespace-nowrap"
                              title="Record a payment received"
                            >
                              + Payment
                            </button>
                          )}
                          <RowMenu
                            items={[
                              { label: 'Print', icon: Printer, onClick: () => run(() => printPdf('invoices', inv.id), 'Could not print') },
                              { label: 'Copy client link', icon: Link2, onClick: () => handleCopyLink(inv) },
                              { label: 'History & payments', icon: History, onClick: () => setActivity({ id: inv.id, label: inv.invoiceNumber }) },
                              { label: 'Record payment', icon: IndianRupee, onClick: () => setPaymentFor(inv), hidden: balance <= 0 || cancelled },
                              { label: 'Edit', icon: Edit2, onClick: () => setEditor({ initial: inv }), hidden: cancelled },
                              { label: 'Cancel invoice', icon: Ban, onClick: () => handleCancel(inv), hidden: cancelled || Number(inv.amountPaid) > 0 },
                              { label: 'Delete', icon: Trash2, onClick: () => handleDelete(inv), danger: true },
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

      {editor && <DocumentEditor kind="invoice" initial={editor.initial} onClose={() => setEditor(null)} onSaved={handleSaved} />}
      {sendDialog && (
        <SendDocumentDialog
          type="invoices"
          id={sendDialog.id}
          label={sendDialog.label}
          initialTab={sendDialog.tab}
          onClose={() => setSendDialog(null)}
          onSent={load}
        />
      )}
      {activity && <DocumentActivityDialog type="invoices" id={activity.id} label={activity.label} onClose={() => setActivity(null)} />}
      {paymentFor && (
        <RecordPaymentDialog
          invoice={paymentFor}
          onClose={() => setPaymentFor(null)}
          onRecorded={(updated, sendReceipt) => {
            setPaymentFor(null);
            load();
            if (sendReceipt) setSendDialog({ id: updated.id, label: label(updated), tab: 'email' });
          }}
        />
      )}
    </div>
  );
};

const Kpi: React.FC<{ label: string; value: string; icon: React.ElementType; color: string }> = ({ label, value, icon: Icon, color }) => (
  <div className="p-4 bg-white dark:bg-brand-900 rounded-xl border border-slate-200 dark:border-brand-800 shadow-sm">
    <div className="flex items-center justify-between">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <Icon className={`w-4 h-4 ${color}`} />
    </div>
    <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
  </div>
);

export default InvoicesPage;
