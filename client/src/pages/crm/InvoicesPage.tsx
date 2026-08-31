import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  FileCheck2,
  Plus,
  Search,
  Mail,
  Download,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Clock,
  DollarSign,
  MessageSquare,
  CreditCard,
  Building2,
  TrendingUp,
  Receipt,
  ArrowUpRight,
  Eye,
  Printer,
  Sparkles,
} from 'lucide-react';
import { crmService, type Invoice, type LineItem } from '../../services/crmService';
import { SOCKET_URL } from '../../services/api';
import { useDialog } from '../../context/DialogContext';
import { CrmNavTabs } from '../../components/CrmNavTabs';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  PAID: { label: 'Paid in Full', bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', text: '' },
  PARTIALLY_PAID: { label: 'Partially Paid', bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', text: '' },
  UNPAID: { label: 'Unpaid / Pending', bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', text: '' },
  OVERDUE: { label: 'Overdue', bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', text: '' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-slate-500/10 text-slate-500', text: '' },
};

export const InvoicesPage: React.FC = () => {
  const location = useLocation();
  const { confirm } = useDialog();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Create/Edit Invoice Modal
  const [showModal, setShowModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<any | null>(null);

  // Record Payment Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    paymentAmount: 0,
    paymentMethod: 'BANK_TRANSFER',
    paymentReference: '',
    notes: '',
  });

  const [formData, setFormData] = useState({
    quotationId: '',
    clientName: '',
    clientCompany: '',
    clientEmail: '',
    clientPhone: '',
    clientGst: '',
    billingAddress: '',
    items: [
      { description: 'Full-Stack Software Engineering Services', quantity: 1, unitPrice: 65000, taxPercent: 18, amount: 65000 },
    ] as LineItem[],
    taxPercent: 18,
    discountAmount: 0,
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    amountPaid: 0,
    paymentMethod: 'BANK_TRANSFER',
    notes: 'Thank you for your business. Please quote invoice number on remittances.',
    termsAndConditions: '1. Payment is due within 15 days of invoice date.\n2. Interest @ 18% p.a. charged on overdue bills.',
    autoSendEmail: true,
  });

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const data = await crmService.getInvoices(statusFilter, search);
      setInvoices(data);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [statusFilter, search]);

  // Check if routed from Quotation
  useEffect(() => {
    if (location.state?.createFromQuotation) {
      const fromQuote = location.state.createFromQuotation;
      setEditingInvoice(null);
      setFormData({
        quotationId: fromQuote.quotationId || '',
        clientName: fromQuote.clientName || '',
        clientCompany: fromQuote.clientCompany || '',
        clientEmail: fromQuote.clientEmail || '',
        clientPhone: fromQuote.clientPhone || '',
        clientGst: fromQuote.clientGst || '',
        billingAddress: fromQuote.billingAddress || '',
        items: Array.isArray(fromQuote.items) ? fromQuote.items : [],
        taxPercent: fromQuote.taxPercent || 18,
        discountAmount: fromQuote.discountAmount || 0,
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        amountPaid: 0,
        paymentMethod: 'BANK_TRANSFER',
        notes: fromQuote.notes || '',
        termsAndConditions: '1. Payment is due within 15 days of invoice date.\n2. Interest @ 18% p.a. charged on overdue bills.',
        autoSendEmail: true,
      });
      setShowModal(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleOpenModal = (inv?: Invoice) => {
    if (inv) {
      setEditingInvoice(inv);
      setFormData({
        quotationId: inv.quotationId || '',
        clientName: inv.clientName,
        clientCompany: inv.clientCompany || '',
        clientEmail: inv.clientEmail,
        clientPhone: inv.clientPhone || '',
        clientGst: inv.clientGst || '',
        billingAddress: inv.billingAddress || '',
        items: Array.isArray(inv.items) ? inv.items : [],
        taxPercent: inv.taxPercent || 18,
        discountAmount: inv.discountAmount || 0,
        issueDate: inv.issueDate ? inv.issueDate.split('T')[0] : '',
        dueDate: inv.dueDate ? inv.dueDate.split('T')[0] : '',
        amountPaid: inv.amountPaid || 0,
        paymentMethod: inv.paymentMethod || 'BANK_TRANSFER',
        notes: inv.notes || '',
        termsAndConditions: '1. Payment is due within 15 days of invoice date.\n2. Interest @ 18% p.a. charged on overdue bills.',
        autoSendEmail: (inv as any).autoSendEmail ?? false,
      });
    } else {
      setEditingInvoice(null);
      setFormData({
        quotationId: '',
        clientName: '',
        clientCompany: '',
        clientEmail: '',
        clientPhone: '',
        clientGst: '',
        billingAddress: '',
        items: [
          { description: 'Cloud Infrastructure Management & DevOps', quantity: 1, unitPrice: 40000, taxPercent: 18, amount: 40000 },
        ],
        taxPercent: 18,
        discountAmount: 0,
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        amountPaid: 0,
        paymentMethod: 'BANK_TRANSFER',
        notes: 'Thank you for your business. Please quote invoice number on remittances.',
        termsAndConditions: '1. Payment is due within 15 days of invoice date.\n2. Interest @ 18% p.a. charged on overdue bills.',
        autoSendEmail: true,
      });
    }
    setShowModal(true);
  };

  const handleItemChange = (index: number, field: keyof LineItem, val: any) => {
    const updated = [...formData.items];
    updated[index] = { ...updated[index], [field]: val };

    if (field === 'quantity' || field === 'unitPrice') {
      const q = Number(field === 'quantity' ? val : updated[index].quantity) || 0;
      const p = Number(field === 'unitPrice' ? val : updated[index].unitPrice) || 0;
      updated[index].amount = q * p;
    }

    setFormData({ ...formData, items: updated });
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { description: 'Monthly Maintenance & Bug Fixes', quantity: 1, unitPrice: 15000, taxPercent: 18, amount: 15000 },
      ],
    });
  };

  const handleRemoveItem = (index: number) => {
    if (formData.items.length <= 1) return;
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const subTotal = formData.items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  const taxAmount = (subTotal * Number(formData.taxPercent || 18)) / 100;
  const grandTotal = Math.max(0, subTotal + taxAmount - Number(formData.discountAmount || 0));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingInvoice) {
        await crmService.updateInvoice(editingInvoice.id, formData);
      } else {
        await crmService.createInvoice(formData);
      }
      setShowModal(false);
      loadInvoices();
    } catch (err) {
      console.error('Failed to save invoice:', err);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Delete Invoice',
      message: 'Are you sure you want to permanently delete this invoice?',
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (ok) {
      await crmService.deleteInvoice(id);
      loadInvoices();
    }
  };

  const handleOpenPaymentModal = (inv: Invoice) => {
    setSelectedInvoiceForPayment(inv);
    setPaymentForm({
      paymentAmount: inv.balanceDue,
      paymentMethod: 'BANK_TRANSFER',
      paymentReference: '',
      notes: `Payment for #${inv.invoiceNumber}`,
    });
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForPayment) return;
    try {
      await crmService.recordPayment(selectedInvoiceForPayment.id, paymentForm);
      setShowPaymentModal(false);
      loadInvoices();
    } catch (err) {
      console.error('Failed to record payment:', err);
    }
  };

  const handleSendEmail = async (id: string) => {
    try {
      const res = await crmService.sendInvoiceEmail(id);
      alert(res.message || 'Invoice emailed to client!');
      loadInvoices();
    } catch (err) {
      console.error('Failed to email invoice:', err);
    }
  };

  const handleSendWhatsApp = async (id: string) => {
    try {
      const res = await crmService.sendInvoiceWhatsApp(id);
      if (res.whatsappUrl) {
        window.open(res.whatsappUrl, '_blank');
      }
      loadInvoices();
    } catch (err) {
      console.error('Failed to whatsapp invoice:', err);
    }
  };

  // KPIs
  const totalBilled = invoices.reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0);
  const totalReceived = invoices.reduce((sum, inv) => sum + (Number(inv.amountPaid) || 0), 0);
  const totalOutstanding = invoices.reduce((sum, inv) => sum + (Number(inv.balanceDue) || 0), 0);
  const overdueCount = invoices.filter(
    (inv) => inv.paymentStatus !== 'PAID' && new Date(inv.dueDate) < new Date()
  ).length;

  return (
    <div className="space-y-6">
      {/* Sub-Page Navigation Tabs */}
      <CrmNavTabs />

      {/* Header Banner matching HRMS Module Theme */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-brand-900 to-indigo-950 p-6 rounded-3xl border border-brand-800 shadow-xl">
        <div>
          <h1 className="font-extrabold text-2xl tracking-tight text-white flex items-center gap-2">
            <Receipt className="text-orange-400" size={24} />
            Tax Invoices & Billing
          </h1>
          <p className="text-xs text-brand-300 mt-1 font-medium">
            Generate GST tax invoices, track collections, record client payments, and auto-sync with CA Ledgers
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-indigo-600 hover:from-orange-600 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all text-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create Tax Invoice
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-brand-900 rounded-xl border border-slate-200 dark:border-brand-800 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Invoiced</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">₹{totalBilled.toLocaleString('en-IN')}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 font-medium">Billed</span>
          </div>
        </div>
        <div className="p-5 bg-white dark:bg-brand-900 rounded-xl border border-slate-200 dark:border-brand-800 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Collections Received</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">₹{totalReceived.toLocaleString('en-IN')}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
        </div>
        <div className="p-5 bg-white dark:bg-brand-900 rounded-xl border border-slate-200 dark:border-brand-800 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Outstanding Receivables</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">₹{totalOutstanding.toLocaleString('en-IN')}</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
        </div>
        <div className="p-5 bg-white dark:bg-brand-900 rounded-xl border border-slate-200 dark:border-brand-800 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overdue Bills</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">{overdueCount}</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-brand-900 p-4 rounded-xl border border-slate-200 dark:border-brand-800">
        <div className="relative flex-1 sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by invoice #, client, GST..."
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
          <option value="ALL">All Payments</option>
          <option value="PAID">Paid in Full</option>
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="UNPAID">Unpaid</option>
          <option value="OVERDUE">Overdue</option>
        </select>
      </div>

      {/* Invoices Table */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <span className="w-8 h-8 rounded-full border-2 border-emerald-600/30 border-t-emerald-600 animate-spin" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-brand-900 rounded-xl border border-slate-200 dark:border-brand-800">
          <FileCheck2 className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No Invoices Found</h3>
          <p className="text-xs text-slate-400 mt-1">Create an invoice or convert one from an accepted quotation.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-brand-900 rounded-xl border border-slate-200 dark:border-brand-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-brand-950 text-slate-500 font-semibold border-b border-slate-200 dark:border-brand-800">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Paid / Balance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-brand-800 text-slate-800 dark:text-slate-200">
                {invoices.map((inv) => {
                  const cfg = STATUS_CONFIG[inv.paymentStatus] || STATUS_CONFIG.UNPAID;
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-brand-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{inv.clientName}</div>
                        <div className="text-xs text-slate-400">{inv.clientCompany || inv.clientEmail}</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        ₹{Number(inv.totalAmount).toLocaleString('en-IN')}
                        <span className="block text-[11px] font-normal text-slate-400">incl. {inv.taxPercent}% GST</span>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="text-emerald-600 font-semibold">
                          ₹{Number(inv.amountPaid).toLocaleString('en-IN')} paid
                        </div>
                        <div className="text-rose-500 font-semibold">
                          ₹{Number(inv.balanceDue).toLocaleString('en-IN')} due
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${cfg.bg}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {new Date(inv.dueDate).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {inv.pdfUrl && (
                            <a
                              href={`${SOCKET_URL}${inv.pdfUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-brand-800 rounded text-slate-600 dark:text-slate-300"
                              title="Download PDF"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}

                          {inv.paymentStatus !== 'PAID' && (
                            <button
                              onClick={() => handleOpenPaymentModal(inv)}
                              className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 rounded text-xs font-semibold"
                              title="Record Payment"
                            >
                              + Pay
                            </button>
                          )}

                          <button
                            onClick={() => handleSendEmail(inv.id)}
                            className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded text-blue-600 dark:text-blue-400"
                            title="Send via Email"
                          >
                            <Mail className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleSendWhatsApp(inv.id)}
                            className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded text-emerald-600 dark:text-emerald-400"
                            title="Send WhatsApp Alert"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleOpenModal(inv)}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-brand-800 rounded text-slate-500"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDelete(inv.id)}
                            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded text-rose-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Create / Edit Tax Invoice Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-brand-900 w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-brand-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 my-8">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">{editingInvoice ? 'Edit Tax Invoice' : 'Create Official Tax Invoice'}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Compliant GST tax invoice with auto PDF and bank remittances</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Client & Billing Info</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Client Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.clientName}
                      onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={formData.clientCompany}
                      onChange={(e) => setFormData({ ...formData, clientCompany: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Client GSTIN
                    </label>
                    <input
                      type="text"
                      value={formData.clientGst}
                      onChange={(e) => setFormData({ ...formData, clientGst: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Client Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.clientEmail}
                      onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Issue Date
                    </label>
                    <input
                      type="date"
                      value={formData.issueDate}
                      onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Payment Due Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-brand-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Line Items / Services</h4>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>

                <div className="space-y-2">
                  {formData.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 dark:bg-brand-950 rounded-xl border border-slate-200 dark:border-brand-800 grid grid-cols-12 gap-2 items-center"
                    >
                      <div className="col-span-12 sm:col-span-6">
                        <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Description</label>
                        <input
                          type="text"
                          required
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-lg text-xs"
                          placeholder="Service description"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Qty</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-lg text-xs"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Rate (₹)</label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(idx, 'unitPrice', Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-lg text-xs"
                        />
                      </div>
                      <div className="col-span-3 sm:col-span-1 text-right">
                        <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Total</label>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          ₹{Number(item.amount || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Taxes & Calculation Box */}
              <div className="p-4 bg-slate-50 dark:bg-brand-950 rounded-xl border border-slate-200 dark:border-brand-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        GST Rate (%)
                      </label>
                      <input
                        type="number"
                        value={formData.taxPercent}
                        onChange={(e) => setFormData({ ...formData, taxPercent: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Discount (₹)
                      </label>
                      <input
                        type="number"
                        value={formData.discountAmount}
                        onChange={(e) => setFormData({ ...formData, discountAmount: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Billing / Shipping Address
                    </label>
                    <textarea
                      rows={2}
                      value={formData.billingAddress}
                      onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-lg text-xs"
                      placeholder="plot no 1581,1582 ,102,pragathi nagar, Hyderabad, India - 500090"
                    />
                  </div>
                </div>

                <div className="p-4 bg-white dark:bg-brand-900 rounded-xl border border-slate-200 dark:border-brand-800 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Subtotal:</span>
                    <span>₹{subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>CGST ({formData.taxPercent / 2}%):</span>
                    <span>₹{(taxAmount / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>SGST ({formData.taxPercent / 2}%):</span>
                    <span>₹{(taxAmount / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {Number(formData.discountAmount) > 0 && (
                    <div className="flex justify-between text-rose-500">
                      <span>Discount:</span>
                      <span>- ₹{Number(formData.discountAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-100 dark:border-brand-800 flex justify-between font-bold text-sm text-slate-900 dark:text-white">
                    <span>Grand Total:</span>
                    <span className="text-emerald-600 dark:text-emerald-400">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Auto Email Toggle */}
              <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50/80 dark:bg-brand-950 rounded-xl border border-emerald-200/60 dark:border-emerald-900/60">
                <input
                  type="checkbox"
                  id="autoSendEmailInvoice"
                  checked={formData.autoSendEmail}
                  onChange={(e) => setFormData({ ...formData, autoSendEmail: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded cursor-pointer accent-emerald-500"
                />
                <label htmlFor="autoSendEmailInvoice" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                  ⚡ Auto-dispatch Tax Invoice PDF via Email to Client ({formData.clientEmail || 'client email'})
                </label>
              </div>

              {/* Submit */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-brand-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl text-sm shadow-md"
                >
                  {editingInvoice ? 'Update Invoice' : 'Save & Issue Tax Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && selectedInvoiceForPayment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-brand-900 w-full max-w-md rounded-2xl border border-slate-200 dark:border-brand-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Record Payment Receipt</h3>
                <p className="text-xs text-slate-400">
                  Invoice #{selectedInvoiceForPayment.invoiceNumber} • {selectedInvoiceForPayment.clientName}
                </p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 dark:bg-brand-950 rounded-lg text-xs space-y-1">
                <div className="flex justify-between text-slate-500">
                  <span>Total Bill Amount:</span>
                  <span>₹{Number(selectedInvoiceForPayment.totalAmount).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Already Received:</span>
                  <span className="text-emerald-600 font-semibold">
                    ₹{Number(selectedInvoiceForPayment.amountPaid || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200 pt-1 border-t border-slate-200 dark:border-brand-800">
                  <span>Balance Outstanding:</span>
                  <span className="text-rose-600">
                    ₹{Number(selectedInvoiceForPayment.balanceDue || selectedInvoiceForPayment.totalAmount).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Amount Received (₹) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={paymentForm.paymentAmount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentAmount: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Channel / Mode
                </label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm"
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Credit / Debit Card</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Transaction / UTR Reference No.
                </label>
                <input
                  type="text"
                  value={paymentForm.paymentReference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentReference: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm"
                  placeholder="e.g. UTR1298471982"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-brand-800">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-sm shadow-md"
                >
                  Confirm & Sync Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Refrens Invoice Preview Modal */}
      {previewInvoice && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-6 border border-slate-200 animate-in fade-in zoom-in-95">
            {/* Modal Control Bar */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck2 className="text-indigo-400 w-5 h-5" />
                <span className="font-bold text-sm">Refrens Tax Invoice Preview</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / Save
                </button>
                {previewInvoice.pdfUrl && (
                  <a
                    href={`${SOCKET_URL}${previewInvoice.pdfUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" /> Download PDF
                  </a>
                )}
                <button
                  onClick={() => setPreviewInvoice(null)}
                  className="text-slate-400 hover:text-white text-lg px-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Invoice Container matching Refrens PDF style */}
            <div className="p-8 sm:p-12 text-slate-800 bg-white space-y-8 max-h-[80vh] overflow-y-auto font-sans">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-indigo-700 tracking-tight">
                    Tax Invoice
                  </h1>
                </div>
                <div className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-md text-xs font-bold uppercase tracking-wider border border-emerald-200">
                  {previewInvoice.paymentStatus || 'UNPAID'}
                </div>
              </div>

              {/* Invoice Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Invoice No #</span>
                  <span className="font-bold text-slate-900">{previewInvoice.invoiceNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Invoice Date</span>
                  <span className="font-bold text-slate-900">
                    {previewInvoice.issueDate
                      ? new Date(previewInvoice.issueDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Today'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Payment Due Date</span>
                  <span className="font-bold text-slate-900">
                    {previewInvoice.dueDate
                      ? new Date(previewInvoice.dueDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '15 Days'}
                  </span>
                </div>
              </div>

              {/* Two Side-by-Side Cards: Invoice From & Invoice For */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Invoice From */}
                <div className="p-5 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-2 text-xs">
                  <h3 className="font-extrabold text-indigo-700 text-sm">Invoice From</h3>
                  <div className="font-bold text-slate-900 text-sm">Onebridge Infotech Pvt Ltd</div>
                  <div className="text-slate-600 leading-relaxed">
                    Satyabhama complex, 202, Bhagya Nagar Colony,<br />
                    KPHB, Hyderabad, Telangana 500072,<br />
                    Hyderabad, Telangana, India - 500090
                  </div>
                  <div className="pt-2 text-slate-700 space-y-0.5">
                    <div><span className="font-semibold text-slate-500">GSTIN:</span> 36AAGCG6536J2ZA</div>
                    <div><span className="font-semibold text-slate-500">PAN:</span> AAGCG6536J</div>
                    <div><span className="font-semibold text-slate-500">Email:</span> info@onebridgenfotech.com</div>
                    <div><span className="font-semibold text-slate-500">Phone:</span> +91 40 4006 1641</div>
                  </div>
                </div>

                {/* Invoice For */}
                <div className="p-5 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-2 text-xs">
                  <h3 className="font-extrabold text-indigo-700 text-sm">Invoice For</h3>
                  <div className="font-bold text-slate-900 text-sm">
                    {previewInvoice.clientCompany || previewInvoice.clientName || 'MetroTexmo Pumps / Texmo Motors'}
                  </div>
                  <div className="text-slate-600 leading-relaxed">
                    {previewInvoice.billingAddress || 'plot no 1581,1582 ,102,pragathi nagar, Hyderabad, India - 500090'}
                  </div>
                  <div className="pt-2 text-slate-700 space-y-0.5">
                    {previewInvoice.clientGst && (
                      <div><span className="font-semibold text-slate-500">GSTIN:</span> {previewInvoice.clientGst}</div>
                    )}
                    {previewInvoice.clientEmail && (
                      <div><span className="font-semibold text-slate-500">Email:</span> {previewInvoice.clientEmail}</div>
                    )}
                    {previewInvoice.clientPhone && (
                      <div><span className="font-semibold text-slate-500">Phone:</span> {previewInvoice.clientPhone}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="rounded-xl overflow-hidden border border-indigo-100 shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-indigo-600 text-white font-bold">
                    <tr>
                      <th className="py-3 px-3">Item</th>
                      <th className="py-3 px-2 text-center">GST Rate</th>
                      <th className="py-3 px-2 text-center">Quantity</th>
                      <th className="py-3 px-3 text-right">Rate</th>
                      <th className="py-3 px-3 text-right">Amount</th>
                      <th className="py-3 px-2 text-right">CGST</th>
                      <th className="py-3 px-2 text-right">SGST</th>
                      <th className="py-3 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {(Array.isArray(previewInvoice.items) ? previewInvoice.items : []).map(
                      (item: any, idx: number) => {
                        const q = Number(item.quantity) || 1;
                        const r = Number(item.unitPrice) || 0;
                        const amt = Number(item.amount || q * r);
                        const gstRate = item.taxPercent !== undefined ? Number(item.taxPercent) : Number(previewInvoice.taxPercent || 0);
                        const cgst = (amt * (gstRate / 2)) / 100;
                        const sgst = (amt * (gstRate / 2)) / 100;
                        const rowTotal = amt + cgst + sgst;

                        return (
                          <tr key={idx} className="hover:bg-indigo-50/20">
                            <td className="py-2.5 px-3 font-medium text-slate-900">
                              {idx + 1}. {item.description}
                            </td>
                            <td className="py-2.5 px-2 text-center text-slate-500">{gstRate}%</td>
                            <td className="py-2.5 px-2 text-center">{q}</td>
                            <td className="py-2.5 px-3 text-right font-medium">₹{r.toLocaleString('en-IN')}</td>
                            <td className="py-2.5 px-3 text-right font-medium">
                              ₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-2 text-right text-slate-500">
                              ₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-2 text-right text-slate-500">
                              ₹{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                              ₹{rowTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bank Details & Totals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start pt-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                  <h4 className="font-extrabold text-indigo-700 text-xs uppercase tracking-wider mb-2">Bank Details</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-slate-500 font-medium">Account Name</span>
                    <span className="col-span-2 font-bold text-slate-800">Onebridge infotech Private Limited</span>

                    <span className="text-slate-500 font-medium">Account Number</span>
                    <span className="col-span-2 font-bold text-slate-800">15690200004936</span>

                    <span className="text-slate-500 font-medium">IFSC</span>
                    <span className="col-span-2 font-bold text-slate-800">FDRL0001569</span>

                    <span className="text-slate-500 font-medium">SWIFT Code</span>
                    <span className="col-span-2 font-bold text-slate-800">FDRLINBBIBD</span>

                    <span className="text-slate-500 font-medium">Bank</span>
                    <span className="col-span-2 font-bold text-slate-800">Federal Bank</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Amount</span>
                    <span className="font-bold text-slate-800">
                      ₹{Number(previewInvoice.subTotal || previewInvoice.totalAmount).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>CGST</span>
                    <span className="text-slate-700">
                      ₹{(Number(previewInvoice.taxAmount || 0) / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>SGST</span>
                    <span className="text-slate-700">
                      ₹{(Number(previewInvoice.taxAmount || 0) / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {Number(previewInvoice.discountAmount) > 0 && (
                    <div className="flex justify-between text-rose-500">
                      <span>Discount</span>
                      <span>- ₹{Number(previewInvoice.discountAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  <div className="p-3 border-2 border-slate-900 rounded-xl flex justify-between items-center font-bold text-sm text-slate-900 mt-3">
                    <span>Total (INR)</span>
                    <span className="text-base font-extrabold">
                      ₹{Number(previewInvoice.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Terms */}
              <div className="pt-6 border-t border-slate-200 text-xs space-y-2">
                <h4 className="font-extrabold text-indigo-700 text-xs">Terms and Conditions</h4>
                <div className="whitespace-pre-line text-slate-600 leading-relaxed">
                  {previewInvoice.termsAndConditions ||
`1. Payment is due within 15 days of invoice date.
2. Please quote invoice number on remittances.
3. Third-party services (hosting, WhatsApp API, SMS, Email, Payment Gateway, etc.) will be charged separately.
4. Goods/services once delivered cannot be cancelled or refunded.`}
                </div>
              </div>

              {/* Document Footer */}
              <div className="pt-8 border-t border-dashed border-slate-300 text-[11px] text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-2">
                <div>
                  <span className="font-semibold text-slate-600">Invoice No:</span> {previewInvoice.invoiceNumber} |{' '}
                  <span className="font-semibold text-slate-600">Invoice Date:</span>{' '}
                  {previewInvoice.issueDate ? new Date(previewInvoice.issueDate).toLocaleDateString('en-IN') : 'Today'}
                </div>
                <div className="italic">Powered by Refrens.com Template Engine</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicesPage;
