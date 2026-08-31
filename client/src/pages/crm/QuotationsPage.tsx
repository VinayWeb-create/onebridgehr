import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Search,
  Mail,
  Send,
  Download,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  ExternalLink,
  MessageSquare,
  DollarSign,
  Eye,
  Printer,
  Copy,
} from 'lucide-react';
import { crmService, type Quotation, type LineItem } from '../../services/crmService';
import { SOCKET_URL } from '../../services/api';
import { useDialog } from '../../context/DialogContext';
import { CrmNavTabs } from '../../components/CrmNavTabs';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  DRAFT: { label: 'Draft', bg: 'bg-slate-500/10 text-slate-600 dark:text-slate-400', text: '' },
  SENT: { label: 'Sent to Client', bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', text: '' },
  ACCEPTED: { label: 'Accepted', bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', text: '' },
  DECLINED: { label: 'Declined', bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', text: '' },
  EXPIRED: { label: 'Expired', bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', text: '' },
};

export const QuotationsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { confirm, alert } = useDialog();

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [previewQuotation, setPreviewQuotation] = useState<any | null>(null);

  const [formData, setFormData] = useState({
    leadId: '',
    proposalTitle: 'Digital Business Management Platform Proposal',
    clientName: '',
    clientCompany: '',
    clientEmail: '',
    clientPhone: '',
    clientAddress: 'plot no 1581,1582 ,102,pragathi nagar, Hyderabad, India - 500090',
    clientGst: '',
    items: [
      { description: 'Phase 1 – CRM & Lead Management', quantity: 1, unitPrice: 45000, taxPercent: 0, amount: 45000 },
      { description: 'Phase 2 – Quotation, Invoice & Finance Workflow', quantity: 1, unitPrice: 40000, taxPercent: 0, amount: 40000 },
      { description: 'Phase 3 – Basic Inventory Management', quantity: 1, unitPrice: 45000, taxPercent: 0, amount: 45000 },
      { description: 'Phase 4 – Ecommerce & Online Orders', quantity: 1, unitPrice: 60000, taxPercent: 0, amount: 60000 },
      { description: 'Phase 5 – Order & Delivery Tracking', quantity: 1, unitPrice: 25000, taxPercent: 0, amount: 25000 },
      { description: 'Phase 6 – Service & AMC Management', quantity: 1, unitPrice: 35000, taxPercent: 0, amount: 35000 },
      { description: 'Phase 7 – Mobile-Friendly PWA / Business App', quantity: 1, unitPrice: 40000, taxPercent: 0, amount: 40000 },
    ] as LineItem[],
    taxPercent: 0,
    discountAmount: 0,
    validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    termsAndConditions: 
`1. 30% advance at project commencement.
2. 40% payable on milestone completion.
3. 20% payable after UAT / pre-production acceptance.
4. Remaining 10% payable on production deployment.
5. Third-party services (hosting, WhatsApp API, SMS, Email, Payment Gateway, etc.) will be charged separately.
6. Any additional features beyond the approved scope will be quoted separately.`,
    notes: 'Proposal for Digital Business Management Platform with end-to-end integration.',
    autoSendEmail: false,
  });

  // Preset Template loader
  const loadRefrens7PhaseTemplate = () => {
    setFormData((prev) => ({
      ...prev,
      proposalTitle: 'Digital Business Management Platform Proposal',
      items: [
        { description: 'Phase 1 – CRM & Lead Management', quantity: 1, unitPrice: 45000, taxPercent: 0, amount: 45000 },
        { description: 'Phase 2 – Quotation, Invoice & Finance Workflow', quantity: 1, unitPrice: 40000, taxPercent: 0, amount: 40000 },
        { description: 'Phase 3 – Basic Inventory Management', quantity: 1, unitPrice: 45000, taxPercent: 0, amount: 45000 },
        { description: 'Phase 4 – Ecommerce & Online Orders', quantity: 1, unitPrice: 60000, taxPercent: 0, amount: 60000 },
        { description: 'Phase 5 – Order & Delivery Tracking', quantity: 1, unitPrice: 25000, taxPercent: 0, amount: 25000 },
        { description: 'Phase 6 – Service & AMC Management', quantity: 1, unitPrice: 35000, taxPercent: 0, amount: 35000 },
        { description: 'Phase 7 – Mobile-Friendly PWA / Business App', quantity: 1, unitPrice: 40000, taxPercent: 0, amount: 40000 },
      ],
      termsAndConditions: 
`1. 30% advance at project commencement.
2. 40% payable on milestone completion.
3. 20% payable after UAT / pre-production acceptance.
4. Remaining 10% payable on production deployment.
5. Third-party services (hosting, WhatsApp API, SMS, Email, Payment Gateway, etc.) will be charged separately.
6. Any additional features beyond the approved scope will be quoted separately.`,
      taxPercent: 0,
    }));
  };

  const loadQuotations = async () => {
    try {
      setLoading(true);
      const data = await crmService.getQuotations(statusFilter, search);
      setQuotations(data);
    } catch (err) {
      console.error('Failed to load quotations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuotations();
  }, [statusFilter, search]);

  // Check if routed from Lead
  useEffect(() => {
    if (location.state?.createFromLead) {
      const fromLead = location.state.createFromLead;
      setEditingQuotation(null);
      setFormData({
        leadId: fromLead.leadId || '',
        proposalTitle: 'Digital Business Management Platform Proposal',
        clientName: fromLead.clientName || '',
        clientCompany: fromLead.clientCompany || '',
        clientEmail: fromLead.clientEmail || '',
        clientPhone: fromLead.clientPhone || '',
        clientAddress: 'Hyderabad, India - 500090',
        clientGst: '',
        items: [
          { description: 'Phase 1 – CRM & Lead Management', quantity: 1, unitPrice: 45000, taxPercent: 0, amount: 45000 },
          { description: 'Phase 2 – Quotation, Invoice & Finance Workflow', quantity: 1, unitPrice: 40000, taxPercent: 0, amount: 40000 },
          { description: 'Phase 3 – Basic Inventory Management', quantity: 1, unitPrice: 45000, taxPercent: 0, amount: 45000 },
          { description: 'Phase 4 – Ecommerce & Online Orders', quantity: 1, unitPrice: 60000, taxPercent: 0, amount: 60000 },
          { description: 'Phase 5 – Order & Delivery Tracking', quantity: 1, unitPrice: 25000, taxPercent: 0, amount: 25000 },
          { description: 'Phase 6 – Service & AMC Management', quantity: 1, unitPrice: 35000, taxPercent: 0, amount: 35000 },
          { description: 'Phase 7 – Mobile-Friendly PWA / Business App', quantity: 1, unitPrice: 40000, taxPercent: 0, amount: 40000 },
        ],
        taxPercent: 0,
        discountAmount: 0,
        validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        termsAndConditions: 
`1. 30% advance at project commencement.
2. 40% payable on milestone completion.
3. 20% payable after UAT / pre-production acceptance.
4. Remaining 10% payable on production deployment.
5. Third-party services (hosting, WhatsApp API, SMS, Email, Payment Gateway, etc.) will be charged separately.
6. Any additional features beyond the approved scope will be quoted separately.`,
        notes: `Quotation prepared for ${fromLead.clientName}`,
        autoSendEmail: false,
      });
      setShowModal(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleOpenModal = (quote?: Quotation) => {
    if (quote) {
      setEditingQuotation(quote);
      setFormData({
        leadId: quote.leadId || '',
        proposalTitle: (quote as any).proposalTitle || (quote as any).title || 'Digital Business Management Platform Proposal',
        clientName: quote.clientName,
        clientCompany: quote.clientCompany || '',
        clientEmail: quote.clientEmail,
        clientPhone: quote.clientPhone || '',
        clientAddress: quote.clientAddress || '',
        clientGst: quote.clientGst || '',
        items: Array.isArray(quote.items) ? quote.items : [],
        taxPercent: quote.taxPercent ?? 0,
        discountAmount: quote.discountAmount || 0,
        validUntil: quote.validUntil ? quote.validUntil.split('T')[0] : '',
        termsAndConditions: quote.termsAndConditions || 
`1. 30% advance at project commencement.
2. 40% payable on milestone completion.
3. 20% payable after UAT / pre-production acceptance.
4. Remaining 10% payable on production deployment.
5. Third-party services (hosting, WhatsApp API, SMS, Email, Payment Gateway, etc.) will be charged separately.
6. Any additional features beyond the approved scope will be quoted separately.`,
        notes: quote.notes || '',
        autoSendEmail: quote.autoSendEmail ?? false,
      });
    } else {
      setEditingQuotation(null);
      setFormData({
        leadId: '',
        proposalTitle: 'Digital Business Management Platform Proposal',
        clientName: '',
        clientCompany: '',
        clientEmail: '',
        clientPhone: '',
        clientAddress: 'plot no 1581,1582 ,102,pragathi nagar, Hyderabad, India - 500090',
        clientGst: '',
        items: [
          { description: 'Phase 1 – CRM & Lead Management', quantity: 1, unitPrice: 45000, taxPercent: 0, amount: 45000 },
          { description: 'Phase 2 – Quotation, Invoice & Finance Workflow', quantity: 1, unitPrice: 40000, taxPercent: 0, amount: 40000 },
          { description: 'Phase 3 – Basic Inventory Management', quantity: 1, unitPrice: 45000, taxPercent: 0, amount: 45000 },
          { description: 'Phase 4 – Ecommerce & Online Orders', quantity: 1, unitPrice: 60000, taxPercent: 0, amount: 60000 },
          { description: 'Phase 5 – Order & Delivery Tracking', quantity: 1, unitPrice: 25000, taxPercent: 0, amount: 25000 },
          { description: 'Phase 6 – Service & AMC Management', quantity: 1, unitPrice: 35000, taxPercent: 0, amount: 35000 },
          { description: 'Phase 7 – Mobile-Friendly PWA / Business App', quantity: 1, unitPrice: 40000, taxPercent: 0, amount: 40000 },
        ],
        taxPercent: 0,
        discountAmount: 0,
        validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        termsAndConditions: 
`1. 30% advance at project commencement.
2. 40% payable on milestone completion.
3. 20% payable after UAT / pre-production acceptance.
4. Remaining 10% payable on production deployment.
5. Third-party services (hosting, WhatsApp API, SMS, Email, Payment Gateway, etc.) will be charged separately.
6. Any additional features beyond the approved scope will be quoted separately.`,
        notes: '',
        autoSendEmail: false,
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
        { description: 'Cloud Setup & Maintenance Support', quantity: 1, unitPrice: 10000, taxPercent: 18, amount: 10000 },
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
      if (editingQuotation) {
        await crmService.updateQuotation(editingQuotation.id, formData);
      } else {
        await crmService.createQuotation(formData);
      }
      setShowModal(false);
      loadQuotations();
    } catch (err) {
      console.error('Failed to save quotation:', err);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Delete Quotation',
      message: 'Are you sure you want to permanently delete this quotation?',
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (ok) {
      await crmService.deleteQuotation(id);
      loadQuotations();
    }
  };

  const handleSendEmail = async (id: string) => {
    try {
      const res = await crmService.sendQuotationEmail(id);
      await alert({ title: 'Email Dispatched', message: res.message || 'Quotation emailed to client!' });
      loadQuotations();
    } catch (err) {
      console.error('Failed to email quote:', err);
    }
  };

  const handleSendWhatsApp = async (id: string) => {
    try {
      const res = await crmService.sendQuotationWhatsApp(id);
      if (res.whatsappUrl) {
        window.open(res.whatsappUrl, '_blank');
      }
      loadQuotations();
    } catch (err) {
      console.error('Failed to whatsapp quote:', err);
    }
  };

  const handleAcceptQuotation = async (quote: Quotation) => {
    const ok = await confirm({
      title: 'Accept Proposal & Issue Tax Invoice',
      message: `Accept Quotation #${quote.quotationNumber} for ${quote.clientName}? This will automatically generate the official Tax Invoice (with 18% GST and QR payment code) and email it directly to the client.`,
      confirmText: 'Accept & Generate Invoice',
    });
    if (ok) {
      try {
        const res = await crmService.acceptQuotation(quote.id);
        await alert({
          title: 'Quotation Accepted & Invoice Generated',
          message: res?.message || 'Quotation accepted! Tax Invoice generated and emailed with payment coordinates.',
        });
        loadQuotations();
      } catch (err: any) {
        await alert({
          title: 'Action Failed',
          message: err?.response?.data?.message || 'Failed to accept quotation.',
          variant: 'danger',
        });
      }
    }
  };

  const handleConvertToInvoice = (quote: Quotation) => {
    navigate('/invoices', {
      state: {
        createFromQuotation: {
          quotationId: quote.id,
          clientName: quote.clientName,
          clientCompany: quote.clientCompany,
          clientEmail: quote.clientEmail,
          clientPhone: quote.clientPhone,
          clientGst: quote.clientGst,
          billingAddress: quote.clientAddress,
          items: quote.items,
          taxPercent: quote.taxPercent,
          discountAmount: quote.discountAmount,
          notes: `Created from Quotation #${quote.quotationNumber}`,
        },
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Sub-Page Navigation Tabs */}
      <CrmNavTabs />

      {/* Header Banner matching HRMS Module Theme */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-brand-900 to-indigo-950 p-6 rounded-3xl border border-brand-800 shadow-xl">
        <div>
          <h1 className="font-extrabold text-2xl tracking-tight text-white flex items-center gap-2">
            <FileText className="text-orange-400" size={24} />
            Quotations & Estimates
          </h1>
          <p className="text-xs text-brand-300 mt-1 font-medium">
            Create professional proposals, auto-calculate GST, generate PDF estimates, and dispatch via Email & WhatsApp
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-indigo-600 hover:from-orange-600 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all text-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create Quotation
        </button>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-brand-900 p-4 rounded-xl border border-slate-200 dark:border-brand-800">
        <div className="relative flex-1 sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by quote #, client name, email..."
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
          <option value="ALL">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="DECLINED">Declined</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <span className="w-8 h-8 rounded-full border-2 border-blue-600/30 border-t-blue-600 animate-spin" />
        </div>
      ) : quotations.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-brand-900 rounded-xl border border-slate-200 dark:border-brand-800">
          <FileText className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No Quotations Found</h3>
          <p className="text-xs text-slate-400 mt-1">Create your first quotation or convert one directly from a lead.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-brand-900 rounded-xl border border-slate-200 dark:border-brand-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-brand-950 text-slate-500 font-semibold border-b border-slate-200 dark:border-brand-800">
                <tr>
                  <th className="py-3 px-4">Quote #</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Grand Total</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Dispatched</th>
                  <th className="py-3 px-4">Valid Until</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-brand-800 text-slate-800 dark:text-slate-200">
                {quotations.map((quote) => {
                  const cfg = STATUS_CONFIG[quote.status] || STATUS_CONFIG.DRAFT;
                  return (
                    <tr key={quote.id} className="hover:bg-slate-50 dark:hover:bg-brand-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                        {quote.quotationNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{quote.clientName}</div>
                        <div className="text-xs text-slate-400">{quote.clientCompany || quote.clientEmail}</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        ₹{Number(quote.totalAmount).toLocaleString('en-IN')}
                        <span className="block text-[11px] font-normal text-slate-400">incl. {quote.taxPercent}% GST</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${cfg.bg}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              quote.sentViaEmail ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            Email
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              quote.sentViaWhatsApp ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            WhatsApp
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setPreviewQuotation(quote)}
                            className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded text-indigo-600 dark:text-indigo-400 cursor-pointer"
                            title="Preview Refrens Quotation"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {quote.pdfUrl && (
                            <a
                              href={`${SOCKET_URL}${quote.pdfUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-brand-800 rounded text-slate-600 dark:text-slate-300"
                              title="Download PDF"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}

                          <button
                            onClick={() => handleSendEmail(quote.id)}
                            className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded text-blue-600 dark:text-blue-400"
                            title="Send via Email"
                          >
                            <Mail className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleSendWhatsApp(quote.id)}
                            className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded text-emerald-600 dark:text-emerald-400"
                            title="Send via WhatsApp"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>

                          {quote.status !== 'ACCEPTED' && (
                            <button
                              onClick={() => handleAcceptQuotation(quote)}
                              className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded text-xs font-bold shadow-xs cursor-pointer"
                              title="Accept Proposal & Auto-Issue Tax Invoice"
                            >
                              ✓ Accept
                            </button>
                          )}

                          <button
                            onClick={() => handleConvertToInvoice(quote)}
                            className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded text-xs font-semibold"
                            title="Convert to Tax Invoice"
                          >
                            + Invoice
                          </button>

                          <button
                            onClick={() => handleOpenModal(quote)}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-brand-800 rounded text-slate-500"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDelete(quote.id)}
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

      {/* Quotation Builder Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-brand-900 w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-brand-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 my-8">
            <div className="p-5 bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-950 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <FileText className="text-orange-400 w-5 h-5" />
                  {editingQuotation ? 'Edit Refrens Quotation' : 'Create Quotation (Refrens Template)'}
                </h3>
                <p className="text-xs text-indigo-200/80 mt-0.5">
                  Standard OneBridge Infotech quotation format with 7-phase breakdown & milestone terms
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadRefrens7PhaseTemplate}
                  className="px-3 py-1.5 bg-indigo-600/60 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg border border-indigo-400/40 flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Populate with the 7-Phase Proposal Preset"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Load 7-Phase Preset
                </button>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-lg px-2">
                  ✕
                </button>
              </div>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Proposal Header / Title */}
              <div className="p-4 bg-indigo-50/50 dark:bg-brand-950 rounded-xl border border-indigo-100 dark:border-brand-800">
                <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider mb-1">
                  Proposal Document Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.proposalTitle}
                  onChange={(e) => setFormData({ ...formData, proposalTitle: e.target.value })}
                  placeholder="e.g. Digital Business Management Platform Proposal"
                  className="w-full px-3 py-2 bg-white dark:bg-brand-900 border border-indigo-200 dark:border-brand-800 rounded-lg text-sm font-semibold text-indigo-950 dark:text-indigo-100"
                />
              </div>

              {/* Client Information */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Client & Quotation For Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Client Contact Person *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.clientName}
                      onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm"
                      placeholder="e.g. MetroTexmo Motors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Company Name (Quotation For)
                    </label>
                    <input
                      type="text"
                      value={formData.clientCompany}
                      onChange={(e) => setFormData({ ...formData, clientCompany: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm"
                      placeholder="e.g. MetroTexmo Pumps / Texmo Motors"
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
                      placeholder="e.g. 36AAGCG6536J2ZA"
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
                      placeholder="client@company.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Client Phone
                    </label>
                    <input
                      type="text"
                      value={formData.clientPhone}
                      onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Valid Till Date
                    </label>
                    <input
                      type="date"
                      value={formData.validUntil}
                      onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Client Full Address
                  </label>
                  <input
                    type="text"
                    value={formData.clientAddress}
                    onChange={(e) => setFormData({ ...formData, clientAddress: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm"
                    placeholder="plot no 1581,1582 ,102,pragathi nagar, Hyderabad, India - 500090"
                  />
                </div>
              </div>

              {/* Line Items Builder */}
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-brand-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Project Phases & Line Items
                  </h4>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={loadRefrens7PhaseTemplate}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Reset to 7-Phases
                    </button>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Phase / Item
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {formData.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 dark:bg-brand-950 rounded-xl border border-slate-200 dark:border-brand-800 grid grid-cols-12 gap-2 items-center"
                    >
                      <div className="col-span-12 sm:col-span-6">
                        <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
                          Phase / Item #{idx + 1} Description
                        </label>
                        <input
                          type="text"
                          required
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-lg text-xs"
                          placeholder="e.g. Phase 1 – CRM & Lead Management"
                        />
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">GST Rate (%)</label>
                        <input
                          type="number"
                          min="0"
                          value={item.taxPercent !== undefined ? item.taxPercent : formData.taxPercent}
                          onChange={(e) => handleItemChange(idx, 'taxPercent', Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-lg text-xs"
                          placeholder="0%"
                        />
                      </div>
                      <div className="col-span-3 sm:col-span-1">
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
                      <div className="col-span-3 sm:col-span-2">
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
                      <div className="col-span-2 sm:col-span-1 text-right">
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

              {/* Company Bank Details & Milestone Terms */}
              <div className="p-4 bg-slate-50 dark:bg-brand-950 rounded-xl border border-slate-200 dark:border-brand-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Milestone Payment Terms & Conditions
                    </label>
                    <textarea
                      rows={5}
                      value={formData.termsAndConditions}
                      onChange={(e) => setFormData({ ...formData, termsAndConditions: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-lg text-xs leading-relaxed"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Default GST Rate (%)
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
                </div>

                <div className="p-4 bg-white dark:bg-brand-900 rounded-xl border border-slate-200 dark:border-brand-800 space-y-2.5 text-xs">
                  <div className="font-bold text-slate-800 dark:text-slate-200 pb-1 border-b border-slate-100 dark:border-brand-800">
                    Summary & Tax Breakdown
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Subtotal (Amount):</span>
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
                  <div className="pt-2 border-t border-slate-100 dark:border-brand-800 flex justify-between font-bold text-base text-slate-900 dark:text-white">
                    <span>Total (INR):</span>
                    <span className="text-indigo-600 dark:text-indigo-400">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-dashed border-slate-200 dark:border-brand-800 text-[11px] text-slate-500">
                    <p className="font-bold text-slate-700 dark:text-slate-300 mb-0.5">Bank Remittance Info:</p>
                    <p>Federal Bank • A/C: 15690200004936</p>
                    <p>IFSC: FDRL0001569 • Onebridge Infotech Pvt Ltd</p>
                  </div>
                </div>
              </div>

              {/* Auto Email Toggle */}
              <div className="flex items-center gap-2.5 p-3.5 bg-indigo-50/80 dark:bg-brand-950 rounded-xl border border-indigo-200/60 dark:border-indigo-900/60">
                <input
                  type="checkbox"
                  id="autoSendEmailQuote"
                  checked={formData.autoSendEmail}
                  onChange={(e) => setFormData({ ...formData, autoSendEmail: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded cursor-pointer accent-orange-500"
                />
                <label htmlFor="autoSendEmailQuote" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                  ⚡ Auto-dispatch Quotation PDF via Email to Client ({formData.clientEmail || 'client email'})
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-brand-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-bold rounded-xl text-sm shadow-md cursor-pointer flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  {editingQuotation ? 'Update & Re-generate PDF' : 'Save & Generate Refrens PDF'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Refrens Template Preview & Print Modal */}
      {previewQuotation && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-6 border border-slate-200 animate-in fade-in zoom-in-95">
            {/* Modal Control Bar */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="text-indigo-400 w-5 h-5" />
                <span className="font-bold text-sm">Refrens Template Document Preview</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / Save
                </button>
                {previewQuotation.pdfUrl && (
                  <a
                    href={`${SOCKET_URL}${previewQuotation.pdfUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" /> Download PDF
                  </a>
                )}
                <button
                  onClick={() => setPreviewQuotation(null)}
                  className="text-slate-400 hover:text-white text-lg px-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Document Paper Container matching Refrens PDF style */}
            <div className="p-8 sm:p-12 text-slate-800 bg-white space-y-8 max-h-[80vh] overflow-y-auto font-sans">
              {/* Proposal Title & Status Badge */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-indigo-700 tracking-tight">
                    {previewQuotation.proposalTitle || 'Digital Business Management Platform Proposal'}
                  </h1>
                </div>
                <div className="px-3 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-bold uppercase tracking-wider border border-slate-200">
                  {previewQuotation.status || 'Draft'}
                </div>
              </div>

              {/* Quotation Metadata (Top Left) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Quotation No #</span>
                  <span className="font-bold text-slate-900">{previewQuotation.quotationNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Quotation Date</span>
                  <span className="font-bold text-slate-900">
                    {previewQuotation.createdAt
                      ? new Date(previewQuotation.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Valid Till Date</span>
                  <span className="font-bold text-slate-900">
                    {previewQuotation.validUntil
                      ? new Date(previewQuotation.validUntil).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Sep 15, 2026'}
                  </span>
                </div>
              </div>

              {/* Two Side-by-Side Cards: Quotation From & Quotation For */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Quotation From */}
                <div className="p-5 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-2 text-xs">
                  <h3 className="font-extrabold text-indigo-700 text-sm">Quotation From</h3>
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

                {/* Quotation For */}
                <div className="p-5 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-2 text-xs">
                  <h3 className="font-extrabold text-indigo-700 text-sm">Quotation For</h3>
                  <div className="font-bold text-slate-900 text-sm">
                    {previewQuotation.clientCompany || previewQuotation.clientName || 'MetroTexmo Pumps / Texmo Motors'}
                  </div>
                  <div className="text-slate-600 leading-relaxed">
                    {previewQuotation.clientAddress || 'plot no 1581,1582 ,102,pragathi nagar, Hyderabad, India - 500090'}
                  </div>
                  <div className="pt-2 text-slate-700 space-y-0.5">
                    {previewQuotation.clientGst && (
                      <div><span className="font-semibold text-slate-500">GSTIN:</span> {previewQuotation.clientGst}</div>
                    )}
                    {previewQuotation.clientEmail && (
                      <div><span className="font-semibold text-slate-500">Email:</span> {previewQuotation.clientEmail}</div>
                    )}
                    {previewQuotation.clientPhone && (
                      <div><span className="font-semibold text-slate-500">Phone:</span> {previewQuotation.clientPhone}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Items Table with Purple Header */}
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
                    {(Array.isArray(previewQuotation.items) ? previewQuotation.items : []).map(
                      (item: LineItem, idx: number) => {
                        const q = Number(item.quantity) || 1;
                        const r = Number(item.unitPrice) || 0;
                        const amt = Number(item.amount || q * r);
                        const gstRate = item.taxPercent !== undefined ? Number(item.taxPercent) : Number(previewQuotation.taxPercent || 0);
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

              {/* Bank Details & Totals Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start pt-4">
                {/* Bank Details */}
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

                {/* Calculations Box */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Amount</span>
                    <span className="font-bold text-slate-800">
                      ₹{Number(previewQuotation.subTotal || previewQuotation.totalAmount).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>CGST</span>
                    <span className="text-slate-700">
                      ₹{(Number(previewQuotation.taxAmount || 0) / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>SGST</span>
                    <span className="text-slate-700">
                      ₹{(Number(previewQuotation.taxAmount || 0) / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {Number(previewQuotation.discountAmount) > 0 && (
                    <div className="flex justify-between text-rose-500">
                      <span>Discount</span>
                      <span>- ₹{Number(previewQuotation.discountAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  <div className="p-3 border-2 border-slate-900 rounded-xl flex justify-between items-center font-bold text-sm text-slate-900 mt-3">
                    <span>Total (INR)</span>
                    <span className="text-base font-extrabold">
                      ₹{Number(previewQuotation.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Terms and Conditions Section */}
              <div className="pt-6 border-t border-slate-200 text-xs space-y-2">
                <h4 className="font-extrabold text-indigo-700 text-xs">Terms and Conditions</h4>
                <div className="whitespace-pre-line text-slate-600 leading-relaxed">
                  {previewQuotation.termsAndConditions ||
`1. 30% advance at project commencement.
2. 40% payable on milestone completion.
3. 20% payable after UAT / pre-production acceptance.
4. Remaining 10% payable on production deployment.
5. Third-party services (hosting, WhatsApp API, SMS, Email, Payment Gateway, etc.) will be charged separately.
6. Any additional features beyond the approved scope will be quoted separately.`}
                </div>
              </div>

              {/* Document Footer */}
              <div className="pt-8 border-t border-dashed border-slate-300 text-[11px] text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-2">
                <div>
                  <span className="font-semibold text-slate-600">Quotation No:</span> {previewQuotation.quotationNumber} |{' '}
                  <span className="font-semibold text-slate-600">Quotation Date:</span>{' '}
                  {previewQuotation.createdAt ? new Date(previewQuotation.createdAt).toLocaleDateString('en-IN') : 'Today'}
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

export default QuotationsPage;

