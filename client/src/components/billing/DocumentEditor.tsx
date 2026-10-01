import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, X, Search, UserCheck, Sparkles, Loader2, Copy } from 'lucide-react';
import {
  crmService,
  bankAccountLabel,
  companyBankAccounts,
  NO_BANK,
  type BillingClient,
  type BillingCompany,
  type Invoice,
  type LineItem,
  type Quotation,
} from '../../services/crmService';
import { CompanySelect } from './CompanySelect';
import { calculateBilling, GST_STATES } from '../../utils/billingCalc';
import { errorMessage, formatINR, localDateInput } from '../../utils/documentActions';

export type EditorKind = 'quotation' | 'invoice';
export type SaveAction = 'save' | 'draft' | 'send' | 'new';

interface ItemRow {
  key: string;
  description: string;
  details: string;
  hsnSac: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  taxPercent: string;
}

interface DocForm {
  companyId: string;
  clientId: string;
  poNumber: string;
  bankAccountId: string; // '' = company default, NO_BANK = hide bank details
  title: string;
  leadId: string;
  quotationId: string;
  clientName: string;
  clientCompany: string;
  clientEmail: string;
  clientPhone: string;
  clientGst: string;
  address: string;
  placeOfSupplyCode: string;
  validUntil: string;
  issueDate: string;
  dueDate: string;
  items: ItemRow[];
  discountAmount: string;
  additionalCharges: string;
  additionalChargesLabel: string;
  termsAndConditions: string;
  notes: string;
  amountPaid: string;
  paymentMethod: string;
  paymentReference: string;
  saveClient: boolean;
}

export type EditorInitial = Partial<Quotation & Invoice> & { id?: string };

interface Props {
  kind: EditorKind;
  initial?: EditorInitial | null; // existing document (has id) or a prefill (no id)
  onClose: () => void;
  onSaved: (doc: Quotation | Invoice, action: SaveAction) => void;
}

const GST_RATES = ['0', '5', '12', '18', '28'];
const UNITS = ['Nos', 'Pcs', 'Hrs', 'Days', 'Months', 'Years', 'Project', 'Lot', 'Kg', 'Users', 'Licence'];
const PAYMENT_METHODS = ['BANK_TRANSFER', 'UPI', 'CHEQUE', 'CASH', 'CARD', 'OTHER'];

const SEVEN_PHASE_PRESET = {
  title: 'Digital Business Management Platform Proposal',
  items: [
    ['Phase 1 – CRM & Lead Management', 45000],
    ['Phase 2 – Quotation, Invoice & Finance Workflow', 40000],
    ['Phase 3 – Basic Inventory Management', 45000],
    ['Phase 4 – Ecommerce & Online Orders', 60000],
    ['Phase 5 – Order & Delivery Tracking', 25000],
    ['Phase 6 – Service & AMC Management', 35000],
    ['Phase 7 – Mobile-Friendly PWA / Business App', 40000],
  ] as [string, number][],
  terms: `1. 30% advance at project commencement.
2. 40% payable on milestone completion.
3. 20% payable after UAT / pre-production acceptance.
4. Remaining 10% payable on production deployment.
5. Third-party services (hosting, WhatsApp API, SMS, Email, Payment Gateway, etc.) will be charged separately.
6. Any additional features beyond the approved scope will be quoted separately.`,
};

const inputClass =
  'w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm text-slate-900 dark:text-white';
const cellInput =
  'w-full px-2 py-1.5 bg-white dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-md text-sm text-slate-900 dark:text-white';
const labelClass = 'block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1';
// Same look as cellInput but sized by the caller (w-full would override the width in flex rows).
const inlineInput =
  'px-2 py-1.5 bg-white dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-md text-sm text-slate-900 dark:text-white';

let keySeq = 0;
const newKey = () => `row-${Date.now()}-${keySeq++}`;
// Saved dates come back as ISO strings at UTC midnight of the chosen day, so the first 10 characters are that day.
const dateInput = (d?: string | Date | null) => (!d ? '' : typeof d === 'string' ? d.slice(0, 10) : localDateInput(d));
const addDays = (days: number) => localDateInput(new Date(Date.now() + days * 24 * 60 * 60 * 1000));

const emptyRow = (taxPercent = '18'): ItemRow => ({
  key: newKey(),
  description: '',
  details: '',
  hsnSac: '',
  quantity: '1',
  unit: '',
  unitPrice: '',
  taxPercent,
});

const rowFromItem = (it: LineItem, docTax?: number): ItemRow => ({
  key: newKey(),
  description: it.description || '',
  details: it.details || '',
  hsnSac: it.hsnSac || '',
  quantity: String(it.quantity ?? 1),
  unit: it.unit || '',
  unitPrice: String(it.unitPrice ?? (it.amount && it.quantity ? Number(it.amount) / Number(it.quantity) : '')),
  taxPercent: String(it.taxPercent ?? docTax ?? 18),
});

const formFrom = (kind: EditorKind, d: EditorInitial | null | undefined): DocForm => ({
  companyId: d?.companyId || '',
  clientId: d?.clientId || '',
  poNumber: d?.poNumber || '',
  bankAccountId: d?.bankAccountId || '',
  title: d?.title || '',
  leadId: d?.leadId || '',
  quotationId: d?.quotationId || '',
  clientName: d?.clientName || '',
  clientCompany: d?.clientCompany || '',
  clientEmail: d?.clientEmail || '',
  clientPhone: d?.clientPhone || '',
  clientGst: d?.clientGst || '',
  address: (kind === 'invoice' ? d?.billingAddress : d?.clientAddress) || d?.clientAddress || d?.billingAddress || '',
  placeOfSupplyCode: d?.placeOfSupplyCode || '',
  validUntil: d?.id ? dateInput(d?.validUntil) : dateInput(d?.validUntil) || addDays(15),
  issueDate: dateInput(d?.issueDate) || dateInput(new Date()),
  dueDate: dateInput(d?.dueDate) || addDays(15),
  items: Array.isArray(d?.items) && d!.items!.length ? d!.items!.map((it) => rowFromItem(it, d?.taxPercent)) : [emptyRow()],
  discountAmount: d?.discountAmount ? String(d.discountAmount) : '',
  additionalCharges: d?.additionalCharges ? String(d.additionalCharges) : '',
  additionalChargesLabel: d?.additionalChargesLabel || '',
  termsAndConditions: d?.termsAndConditions || '',
  notes: d?.notes || '',
  amountPaid: '',
  paymentMethod: 'BANK_TRANSFER',
  paymentReference: '',
  saveClient: false,
});

export const DocumentEditor: React.FC<Props> = ({ kind, initial, onClose, onSaved }) => {
  const isEdit = !!initial?.id;
  const isInvoice = kind === 'invoice';
  const [form, setForm] = useState<DocForm>(() => formFrom(kind, initial));
  const [company, setCompany] = useState<BillingCompany | null>(null);
  const [saving, setSaving] = useState<SaveAction | null>(null);
  const [error, setError] = useState('');
  const termsFilled = useRef(!!initial?.termsAndConditions);

  // Client picker
  const [clientQuery, setClientQuery] = useState('');
  const [clientResults, setClientResults] = useState<BillingClient[]>([]);
  const [showClientResults, setShowClientResults] = useState(false);

  const set = <K extends keyof DocForm>(key: K, value: DocForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const bankAccounts = companyBankAccounts(company);
  useEffect(() => {
    if (!company || !form.bankAccountId || form.bankAccountId === NO_BANK) return;
    const match = companyBankAccounts(company).find((a) => a.id === form.bankAccountId);
    // Unknown account (other company) or the default itself → use the "default" option.
    if (!match || match.isDefault) set('bankAccountId', '');
  }, [company]);

  // Default terms/notes from the selected company for new documents.
  useEffect(() => {
    if (!company || isEdit || termsFilled.current) return;
    const terms = isInvoice ? company.invoiceTerms : company.quotationTerms;
    if (terms || company.defaultNotes) {
      setForm((f) => ({ ...f, termsAndConditions: f.termsAndConditions || terms || '', notes: f.notes || company.defaultNotes || '' }));
      termsFilled.current = true;
    }
  }, [company, isEdit, isInvoice]);

  useEffect(() => {
    if (!clientQuery.trim()) {
      setClientResults([]);
      return;
    }
    const t = setTimeout(() => {
      crmService.getBillingClients(clientQuery).then(setClientResults).catch(() => setClientResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [clientQuery]);

  const pickClient = (c: BillingClient) => {
    setForm((f) => ({
      ...f,
      clientId: c.id,
      clientName: c.name,
      clientCompany: c.company || '',
      clientEmail: c.email || '',
      clientPhone: c.phone || '',
      clientGst: c.gstin || '',
      address: c.billingAddress || '',
      placeOfSupplyCode: c.stateCode || '',
      saveClient: false,
    }));
    setClientQuery('');
    setShowClientResults(false);
  };

  const totals = useMemo(
    () =>
      calculateBilling({
        items: form.items.map((r) => ({ ...r, taxPercent: r.taxPercent })),
        taxPercent: 18,
        discountAmount: form.discountAmount,
        additionalCharges: form.additionalCharges,
        placeOfSupplyCode: form.placeOfSupplyCode || null,
        clientGst: form.clientGst,
        supplierStateCode: company?.stateCode || null,
      }),
    [form.items, form.discountAmount, form.additionalCharges, form.placeOfSupplyCode, form.clientGst, company]
  );

  const updateRow = (key: string, field: keyof ItemRow, value: string) =>
    setForm((f) => ({ ...f, items: f.items.map((r) => (r.key === key ? { ...r, [field]: value } : r)) }));
  const addRow = () => setForm((f) => ({ ...f, items: [...f.items, emptyRow(f.items[f.items.length - 1]?.taxPercent || '18')] }));
  const duplicateRow = (key: string) =>
    setForm((f) => {
      const idx = f.items.findIndex((r) => r.key === key);
      const copy = { ...f.items[idx], key: newKey() };
      return { ...f, items: [...f.items.slice(0, idx + 1), copy, ...f.items.slice(idx + 1)] };
    });
  const removeRow = (key: string) =>
    setForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((r) => r.key !== key) : [emptyRow()] }));

  const loadPreset = () =>
    setForm((f) => ({
      ...f,
      title: SEVEN_PHASE_PRESET.title,
      items: SEVEN_PHASE_PRESET.items.map(([description, price]) => ({
        ...emptyRow('18'),
        description,
        unitPrice: String(price),
        hsnSac: '998314',
      })),
      termsAndConditions: SEVEN_PHASE_PRESET.terms,
    }));

  const lineAmount = (r: ItemRow) => (parseFloat(r.quantity) || 0) * (parseFloat(r.unitPrice) || 0);

  const handleSave = async (action: SaveAction) => {
    setError('');
    const items = form.items.filter((r) => r.description.trim() || parseFloat(r.unitPrice));
    if (!form.clientName.trim()) return setError('Enter the client name.');
    if (!form.clientEmail.trim()) return setError('Enter the client email.');
    if (!items.length) return setError('Add at least one item.');
    if (items.some((r) => !r.description.trim())) return setError('Every item needs a name.');
    if (isInvoice && form.dueDate && form.issueDate && form.dueDate < form.issueDate) {
      return setError('Due date cannot be before the invoice date.');
    }

    setSaving(action);
    try {
      let clientId = form.clientId;
      if (form.saveClient && !clientId) {
        const client = await crmService.createBillingClient({
          name: form.clientName,
          company: form.clientCompany,
          email: form.clientEmail,
          phone: form.clientPhone,
          gstin: form.clientGst,
          billingAddress: form.address,
          stateCode: totals.placeOfSupplyCode,
          state: totals.placeOfSupply,
        });
        clientId = client.id;
      }

      const common = {
        companyId: form.companyId || null,
        clientId: clientId || null,
        poNumber: form.poNumber,
        bankAccountId: form.bankAccountId || null,
        clientName: form.clientName,
        clientCompany: form.clientCompany,
        clientEmail: form.clientEmail,
        clientPhone: form.clientPhone,
        clientGst: form.clientGst,
        placeOfSupplyCode: form.placeOfSupplyCode || null,
        items: items.map((r) => ({
          description: r.description,
          details: r.details,
          hsnSac: r.hsnSac,
          quantity: parseFloat(r.quantity) || 0,
          unit: r.unit,
          unitPrice: parseFloat(r.unitPrice) || 0,
          taxPercent: parseFloat(r.taxPercent) || 0,
        })),
        taxPercent: 18,
        discountAmount: parseFloat(form.discountAmount) || 0,
        additionalCharges: parseFloat(form.additionalCharges) || 0,
        additionalChargesLabel: form.additionalChargesLabel,
        termsAndConditions: form.termsAndConditions,
        notes: form.notes,
      };

      let saved: Quotation | Invoice;
      if (isInvoice) {
        const payload = {
          ...common,
          billingAddress: form.address,
          issueDate: form.issueDate || null,
          dueDate: form.dueDate || null,
          isDraft: action === 'draft',
          quotationId: form.quotationId || null,
          ...(isEdit
            ? {}
            : {
                amountPaid: parseFloat(form.amountPaid) || 0,
                paymentMethod: form.paymentMethod,
                paymentReference: form.paymentReference,
              }),
        };
        saved = isEdit ? await crmService.updateInvoice(initial!.id!, payload) : await crmService.createInvoice(payload);
      } else {
        const payload = {
          ...common,
          title: form.title,
          clientAddress: form.address,
          validUntil: form.validUntil || null,
          leadId: form.leadId || null,
        };
        saved = isEdit ? await crmService.updateQuotation(initial!.id!, payload) : await crmService.createQuotation(payload);
      }

      onSaved(saved, action);
      if (action === 'new') {
        setForm((f) => ({ ...formFrom(kind, null), companyId: f.companyId, termsAndConditions: f.termsAndConditions }));
      }
    } catch (err) {
      setError(errorMessage(err, 'Could not save. Please check the details.'));
    } finally {
      setSaving(null);
    }
  };

  const numberLabel = isInvoice ? (initial as Invoice)?.invoiceNumber : (initial as Quotation)?.quotationNumber;
  const isIgst = totals.taxType === 'IGST';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white dark:bg-brand-900 rounded-2xl shadow-xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[96vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-brand-900 to-indigo-950 text-white flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-lg">
              {isEdit ? `Edit ${isInvoice ? 'Invoice' : 'Quotation'} ${numberLabel || ''}` : `New ${isInvoice ? 'Invoice' : 'Quotation'}`}
            </h3>
            <p className="text-xs text-indigo-200/80">Number is assigned automatically when you save.</p>
          </div>
          <div className="flex items-center gap-2">
            {!isInvoice && (
              <button
                type="button"
                onClick={loadPreset}
                className="px-3 py-1.5 bg-indigo-600/60 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg border border-indigo-400/40 flex items-center gap-1.5"
                title="Fill items and terms with the 7-phase platform proposal"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" /> 7-Phase preset
              </button>
            )}
            <button onClick={onClose} className="text-slate-300 hover:text-white p-1" title="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-6 overflow-y-auto">
          {/* Document details */}
          <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <CompanySelect value={form.companyId} onChange={(id) => set('companyId', id)} onCompanyChange={setCompany} />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Bank account shown to the client</label>
              <select value={form.bankAccountId} onChange={(e) => set('bankAccountId', e.target.value)} className={inputClass}>
                {bankAccounts.length === 0 ? (
                  <option value="">No bank account in Billing Settings</option>
                ) : (
                  <>
                    {bankAccounts.map((a) => (
                      <option key={a.id} value={a.isDefault ? '' : a.id}>
                        {bankAccountLabel(a)}
                        {a.isDefault ? ' (default)' : ''}
                      </option>
                    ))}
                  </>
                )}
                <option value={NO_BANK}>Don't show bank details</option>
              </select>
            </div>
            {isInvoice ? (
              <>
                <div>
                  <label className={labelClass}>Invoice date *</label>
                  <input type="date" required value={form.issueDate} onChange={(e) => set('issueDate', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Due date *</label>
                  <input type="date" required value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} className={inputClass} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className={labelClass}>Valid until</label>
                  <input type="date" value={form.validUntil} onChange={(e) => set('validUntil', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Client PO / Ref No.</label>
                  <input value={form.poNumber} onChange={(e) => set('poNumber', e.target.value)} className={inputClass} placeholder="Optional" />
                </div>
                <div className="md:col-span-4">
                  <label className={labelClass}>Quotation title (printed at the top)</label>
                  <input
                    value={form.title}
                    onChange={(e) => set('title', e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Website Development Proposal (leave empty for “Quotation”)"
                  />
                </div>
              </>
            )}
            {isInvoice && (
              <div>
                <label className={labelClass}>Client PO / Ref No.</label>
                <input value={form.poNumber} onChange={(e) => set('poNumber', e.target.value)} className={inputClass} placeholder="Optional" />
              </div>
            )}
          </section>

          {/* Billed To */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Billed To (client)</h4>
              {form.clientId ? (
                <span className="text-xs flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                  <UserCheck className="w-3.5 h-3.5" /> Saved client
                  <button type="button" className="underline text-slate-500" onClick={() => set('clientId', '')}>
                    unlink
                  </button>
                </span>
              ) : null}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={clientQuery}
                onChange={(e) => {
                  setClientQuery(e.target.value);
                  setShowClientResults(true);
                }}
                onFocus={() => setShowClientResults(true)}
                onBlur={() => setTimeout(() => setShowClientResults(false), 150)}
                className={`${inputClass} pl-9`}
                placeholder="Search saved clients by name, company, email, phone or GSTIN…"
              />
              {showClientResults && clientQuery.trim() && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {clientResults.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-500">No saved client found — fill in the details below.</div>
                  ) : (
                    clientResults.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickClient(c)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-brand-800 text-sm"
                      >
                        <div className="font-semibold text-slate-900 dark:text-white">{c.company || c.name}</div>
                        <div className="text-xs text-slate-500">
                          {[c.company ? c.name : '', c.email, c.gstin].filter(Boolean).join(' · ')}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Contact person *</label>
                <input value={form.clientName} onChange={(e) => set('clientName', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Company / business name</label>
                <input value={form.clientCompany} onChange={(e) => set('clientCompany', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>GSTIN</label>
                <input
                  value={form.clientGst}
                  onChange={(e) => set('clientGst', e.target.value.toUpperCase())}
                  className={inputClass}
                  placeholder="Leave empty if unregistered"
                />
              </div>
              <div>
                <label className={labelClass}>Email *</label>
                <input type="email" value={form.clientEmail} onChange={(e) => set('clientEmail', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Phone / WhatsApp</label>
                <input value={form.clientPhone} onChange={(e) => set('clientPhone', e.target.value)} className={inputClass} placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className={labelClass}>Place of supply</label>
                <select value={form.placeOfSupplyCode} onChange={(e) => set('placeOfSupplyCode', e.target.value)} className={inputClass}>
                  <option value="">
                    Auto{totals.placeOfSupply ? ` – ${totals.placeOfSupply}` : ' (from client GSTIN / company state)'}
                  </option>
                  {Object.entries(GST_STATES).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name} ({code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className={labelClass}>{isInvoice ? 'Billing address' : 'Client address'}</label>
                <textarea rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} className={inputClass} />
              </div>
            </div>
            {!form.clientId && (
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={form.saveClient} onChange={(e) => set('saveClient', e.target.checked)} />
                Save this client for next time
              </label>
            )}
          </section>

          {/* Items */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Items</h4>
              <span className="text-xs text-slate-500">
                Tax: <strong>{isIgst ? 'IGST' : 'CGST + SGST'}</strong>
                {company?.stateCode ? '' : ' (set your company state in Billing Settings)'}
              </span>
            </div>
            <div className="overflow-x-auto border border-slate-200 dark:border-brand-800 rounded-xl">
              <table className="w-full text-sm min-w-[860px]">
                <thead className="bg-indigo-600 text-white text-xs">
                  <tr>
                    <th className="text-left px-2 py-2 w-8">#</th>
                    <th className="text-left px-2 py-2">Item / service *</th>
                    <th className="text-left px-2 py-2 w-24">HSN/SAC</th>
                    <th className="text-left px-2 py-2 w-20">GST %</th>
                    <th className="text-left px-2 py-2 w-20">Qty</th>
                    <th className="text-left px-2 py-2 w-24">Unit</th>
                    <th className="text-left px-2 py-2 w-28">Rate (₹)</th>
                    <th className="text-right px-2 py-2 w-28">Amount</th>
                    <th className="w-16" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-brand-800">
                  {form.items.map((r, idx) => (
                    <tr key={r.key} className="align-top">
                      <td className="px-2 py-2 text-slate-400 text-xs pt-3.5">{idx + 1}</td>
                      <td className="px-2 py-2 space-y-1">
                        <input value={r.description} onChange={(e) => updateRow(r.key, 'description', e.target.value)} className={cellInput} placeholder="Item name" />
                        <input
                          value={r.details}
                          onChange={(e) => updateRow(r.key, 'details', e.target.value)}
                          className={`${cellInput} text-xs`}
                          placeholder="Description (optional)"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input value={r.hsnSac} onChange={(e) => updateRow(r.key, 'hsnSac', e.target.value)} className={cellInput} placeholder="998314" />
                      </td>
                      <td className="px-2 py-2">
                        <select value={r.taxPercent} onChange={(e) => updateRow(r.key, 'taxPercent', e.target.value)} className={cellInput}>
                          {(GST_RATES.includes(r.taxPercent) ? GST_RATES : [...GST_RATES, r.taxPercent]).map((g) => (
                            <option key={g} value={g}>
                              {g}%
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" min="0" step="any" value={r.quantity} onChange={(e) => updateRow(r.key, 'quantity', e.target.value)} className={cellInput} />
                      </td>
                      <td className="px-2 py-2">
                        <input list="billing-units" value={r.unit} onChange={(e) => updateRow(r.key, 'unit', e.target.value)} className={cellInput} placeholder="Nos" />
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" min="0" step="any" value={r.unitPrice} onChange={(e) => updateRow(r.key, 'unitPrice', e.target.value)} className={cellInput} placeholder="0" />
                      </td>
                      <td className="px-2 py-2 text-right font-semibold pt-3.5 text-slate-900 dark:text-white">{formatINR(lineAmount(r))}</td>
                      <td className="px-2 py-2 pt-3">
                        <div className="flex gap-1 justify-end">
                          <button type="button" onClick={() => duplicateRow(r.key)} className="p-1 text-slate-400 hover:text-indigo-600" title="Duplicate line">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => removeRow(r.key)} className="p-1 text-slate-400 hover:text-rose-600" title="Remove line">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <datalist id="billing-units">
                {UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
            <button type="button" onClick={addRow} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Add line
            </button>
          </section>

          {/* Terms + totals */}
          <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 space-y-4">
              <div>
                <label className={labelClass}>Terms & conditions</label>
                <textarea rows={6} value={form.termsAndConditions} onChange={(e) => set('termsAndConditions', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Notes (printed on the document)</label>
                <textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} className={inputClass} />
              </div>
              {isInvoice && !isEdit && (
                <div className="p-3 rounded-xl border border-slate-200 dark:border-brand-800 space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Advance already received (optional)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input type="number" min="0" step="any" value={form.amountPaid} onChange={(e) => set('amountPaid', e.target.value)} className={inputClass} placeholder="Amount ₹" />
                    <select value={form.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)} className={inputClass}>
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                    <input value={form.paymentReference} onChange={(e) => set('paymentReference', e.target.value)} className={inputClass} placeholder="UTR / reference" />
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-2 bg-slate-50 dark:bg-brand-950 rounded-xl p-4 space-y-2 text-sm self-start">
              <Row label="Amount" value={formatINR(totals.subTotal)} />
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Discount (₹)</span>
                <input type="number" min="0" step="any" value={form.discountAmount} onChange={(e) => set('discountAmount', e.target.value)} className={`${inlineInput} w-32 shrink-0 text-right`} placeholder="0" />
              </div>
              {totals.discountAmount > 0 && <Row label="Taxable amount" value={formatINR(totals.taxableAmount)} />}
              {isIgst ? (
                <Row label="IGST" value={formatINR(totals.igstAmount)} />
              ) : (
                <>
                  <Row label="CGST" value={formatINR(totals.cgstAmount)} />
                  <Row label="SGST" value={formatINR(totals.sgstAmount)} />
                </>
              )}
              <div className="flex items-center justify-between gap-2">
                <input
                  value={form.additionalChargesLabel}
                  onChange={(e) => set('additionalChargesLabel', e.target.value)}
                  className={`${inlineInput} flex-1 min-w-0 text-xs`}
                  placeholder="Other charges (e.g. travel)"
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.additionalCharges}
                  onChange={(e) => set('additionalCharges', e.target.value)}
                  className={`${inlineInput} w-32 shrink-0 text-right`}
                  placeholder="0"
                />
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 dark:border-brand-800 pt-2 mt-2">
                <span className="font-bold text-slate-900 dark:text-white">Total (INR)</span>
                <span className="font-extrabold text-lg text-slate-900 dark:text-white">{formatINR(totals.totalAmount)}</span>
              </div>
              <p className="text-xs text-slate-500">{totals.amountInWords}</p>
              {isInvoice && isEdit && Number((initial as Invoice)?.amountPaid) > 0 && (
                <Row label="Already received" value={formatINR((initial as Invoice).amountPaid)} />
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-brand-800 bg-white dark:bg-brand-900 space-y-2">
          {error && <div className="text-sm text-rose-600 whitespace-pre-line">{error}</div>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-brand-800">
              Cancel
            </button>
            {isInvoice && (
              <FooterButton label="Save as draft" busy={saving === 'draft'} disabled={!!saving} onClick={() => handleSave('draft')} variant="ghost" />
            )}
            {!isEdit && (
              <FooterButton label="Save & new" busy={saving === 'new'} disabled={!!saving} onClick={() => handleSave('new')} variant="ghost" />
            )}
            <FooterButton label="Save" busy={saving === 'save'} disabled={!!saving} onClick={() => handleSave('save')} variant="secondary" />
            <FooterButton label="Save & send" busy={saving === 'send'} disabled={!!saving} onClick={() => handleSave('send')} variant="primary" />
          </div>
        </div>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between">
    <span className="text-slate-500">{label}</span>
    <span className="font-semibold text-slate-900 dark:text-white">{value}</span>
  </div>
);

const FooterButton: React.FC<{
  label: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
  variant: 'primary' | 'secondary' | 'ghost';
}> = ({ label, busy, disabled, onClick, variant }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`px-4 py-2 text-sm font-bold rounded-lg flex items-center gap-2 disabled:opacity-60 ${
      variant === 'primary'
        ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
        : variant === 'secondary'
          ? 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
          : 'border border-slate-300 dark:border-brand-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-brand-800'
    }`}
  >
    {busy && <Loader2 className="w-4 h-4 animate-spin" />}
    {label}
  </button>
);

export default DocumentEditor;
