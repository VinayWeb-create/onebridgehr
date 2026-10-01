import React, { useEffect, useState } from 'react';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Star,
  Landmark,
  QrCode,
  Upload,
  X,
  AlertTriangle,
  Power,
} from 'lucide-react';
import { crmService, companyBankAccounts, type BankAccount, type BillingCompany } from '../../services/crmService';
import { useDialog } from '../../context/DialogContext';
import { CrmNavTabs } from '../../components/CrmNavTabs';
import { INDIAN_STATES, stateCodeFor } from '../../utils/indianStates';

type CompanyForm = Omit<BillingCompany, 'id' | 'isDefault' | 'isActive' | '_count'>;

const EMPTY_FORM: CompanyForm = {
  name: '',
  gstin: '',
  pan: '',
  email: '',
  phone: '',
  website: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  stateCode: '',
  pincode: '',
  country: 'India',
  logoDataUrl: null,
  signatureDataUrl: null,
  stampDataUrl: null,
  bankAccountName: '',
  bankName: '',
  bankAccountNumber: '',
  bankIfsc: '',
  bankBranch: '',
  bankSwift: '',
  upiId: '',
  bankAccounts: [],
  quotationTerms: '',
  invoiceTerms: '',
  defaultNotes: '',
  emailCc: '',
};

let bankKey = 0;
const newBankAccount = (isDefault = false): BankAccount => ({
  id: `new-${Date.now()}-${bankKey++}`,
  label: '',
  accountName: '',
  bankName: '',
  accountNumber: '',
  ifsc: '',
  branch: '',
  swift: '',
  isDefault,
});

// Details currently hard-coded in the quotation/invoice PDFs, offered as a starting point for the first company.
const CURRENT_PDF_DETAILS: CompanyForm = {
  ...EMPTY_FORM,
  name: 'Onebridge Infotech Pvt Ltd',
  gstin: '36AAGCG6536J2ZA',
  pan: 'AAGCG6536J',
  email: 'info@onebridgeinfotech.com',
  phone: '+91 40 4006 1641',
  addressLine1: 'Satyabhama complex, 202, Bhagya Nagar Colony',
  addressLine2: 'KPHB',
  city: 'Hyderabad',
  state: 'Telangana',
  stateCode: '36',
  pincode: '500072',
  bankAccountName: 'Onebridge Infotech Private Limited',
  bankName: 'Federal Bank',
  bankAccountNumber: '15690200004936',
  bankIfsc: 'FDRL0001569',
  bankSwift: 'FDRLINBBIBD',
  bankAccounts: [
    {
      id: 'primary',
      label: 'Current account',
      accountName: 'Onebridge Infotech Private Limited',
      bankName: 'Federal Bank',
      accountNumber: '15690200004936',
      ifsc: 'FDRL0001569',
      branch: '',
      swift: 'FDRLINBBIBD',
      isDefault: true,
    },
  ],
  quotationTerms: `1. 30% advance at project commencement.
2. 40% payable on milestone completion.
3. 20% payable after UAT / pre-production acceptance.
4. Remaining 10% payable on production deployment.
5. Third-party services (hosting, WhatsApp API, SMS, Email, Payment Gateway, etc.) will be charged separately.
6. Any additional features beyond the approved scope will be quoted separately.`,
  invoiceTerms: `1. Net 15 payment terms.
2. Please quote invoice number on bank remittance.
3. Taxes calculated as per GST regulations.`,
};

const MAX_IMAGE_BYTES = 500 * 1024;

const errorMessage = (err: any): string => {
  const data = err?.response?.data;
  if (data?.errors?.length) return data.errors.map((e: any) => `${e.field}: ${e.message}`).join('\n');
  return data?.message || err?.message || 'Something went wrong';
};

const inputClass =
  'w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm';
const labelClass = 'block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1';

const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
  <div>
    <label className={labelClass}>{label}</label>
    {children}
    {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
  </div>
);

const ImagePicker: React.FC<{
  label: string;
  value?: string | null;
  onChange: (value: string | null) => void;
  onError: (message: string) => void;
}> = ({ label, value, onChange, onError }) => {
  const handleFile = (file?: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      onError('Please choose a PNG or JPEG image.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      onError('Image must be smaller than 500 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="h-24 border border-dashed border-slate-300 dark:border-brand-700 rounded-lg flex items-center justify-center bg-slate-50 dark:bg-brand-950 relative overflow-hidden">
        {value ? (
          <>
            <img src={value} alt={label} className="max-h-20 max-w-full object-contain" />
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute top-1 right-1 p-1 rounded-full bg-white/90 dark:bg-brand-900 text-slate-500 hover:text-rose-600 shadow-sm"
              title={`Remove ${label.toLowerCase()}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <label className="flex flex-col items-center gap-1 text-xs text-slate-500 cursor-pointer px-3 text-center">
            <Upload className="w-4 h-4" />
            Upload PNG/JPEG (max 500 KB)
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
};

export const BillingSettingsPage: React.FC = () => {
  const { confirm, alert } = useDialog();
  const [companies, setCompanies] = useState<BillingCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<BillingCompany | null>(null);
  const [form, setForm] = useState<CompanyForm>(EMPTY_FORM);
  const [prefilledFromPdf, setPrefilledFromPdf] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setCompanies(await crmService.getBillingCompanies());
    } catch (err) {
      await alert({ title: 'Could not load companies', message: errorMessage(err), variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const set = <K extends keyof CompanyForm>(key: K, value: CompanyForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const openCreate = (fromPdf = false) => {
    setEditing(null);
    setForm(fromPdf ? CURRENT_PDF_DETAILS : EMPTY_FORM);
    setPrefilledFromPdf(fromPdf);
    setShowModal(true);
  };

  const openEdit = (company: BillingCompany) => {
    setEditing(company);
    const next = { ...EMPTY_FORM } as Record<string, unknown>;
    for (const key of Object.keys(EMPTY_FORM) as (keyof CompanyForm)[]) {
      next[key] = company[key] ?? EMPTY_FORM[key] ?? '';
    }
    next.bankAccounts = companyBankAccounts(company).map((a) => ({ ...a }));
    setForm(next as CompanyForm);
    setPrefilledFromPdf(false);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        logoDataUrl: form.logoDataUrl || null,
        signatureDataUrl: form.signatureDataUrl || null,
        stampDataUrl: form.stampDataUrl || null,
        // Temporary ids of new rows are replaced by the server.
        bankAccounts: (form.bankAccounts || []).map((a) => ({ ...a, id: a.id.startsWith('new-') ? undefined : a.id })) as BankAccount[],
      };
      if (editing) {
        await crmService.updateBillingCompany(editing.id, payload);
      } else {
        await crmService.createBillingCompany(payload);
      }
      setShowModal(false);
      await load();
    } catch (err) {
      await alert({ title: 'Could not save company', message: errorMessage(err), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (company: BillingCompany) => {
    try {
      await crmService.setDefaultBillingCompany(company.id);
      await load();
    } catch (err) {
      await alert({ title: 'Could not change default', message: errorMessage(err), variant: 'error' });
    }
  };

  const handleToggleActive = async (company: BillingCompany) => {
    try {
      // The server ignores id/isDefault/_count, so the whole record can be sent back.
      await crmService.updateBillingCompany(company.id, { ...company, isActive: !company.isActive });
      await load();
    } catch (err) {
      await alert({ title: 'Could not update company', message: errorMessage(err), variant: 'error' });
    }
  };

  const handleDelete = async (company: BillingCompany) => {
    const used = (company._count?.quotations || 0) + (company._count?.invoices || 0);
    const ok = await confirm({
      title: used ? 'Deactivate company' : 'Delete company',
      message: used
        ? `${company.name} is used on ${used} document(s), so it will be deactivated instead of deleted. Existing documents keep their details.`
        : `Delete ${company.name}? This cannot be undone.`,
      confirmText: used ? 'Deactivate' : 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await crmService.deleteBillingCompany(company.id);
      await load();
    } catch (err) {
      await alert({ title: 'Could not delete company', message: errorMessage(err), variant: 'error' });
    }
  };

  const addressLine = (c: BillingCompany) =>
    [c.addressLine1, c.addressLine2, c.city, c.state, c.pincode].filter(Boolean).join(', ');

  return (
    <div className="space-y-6">
      <CrmNavTabs />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-600" /> Billing Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Company details, bank/UPI and default terms used on quotations and invoices. The default company is picked
            automatically; add more if you bill from another entity.
          </p>
        </div>
        {companies.length > 0 && (
          <button
            onClick={() => openCreate(false)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg flex items-center gap-2 self-start"
          >
            <Plus className="w-4 h-4" /> Add Company
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-slate-500 py-12 text-center">Loading…</div>
      ) : companies.length === 0 ? (
        <div className="bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-xl p-8 text-center space-y-4">
          <Building2 className="w-10 h-10 text-indigo-500 mx-auto" />
          <div>
            <h2 className="font-bold text-lg text-slate-900 dark:text-white">Set up your company</h2>
            <p className="text-sm text-slate-500 mt-1 max-w-lg mx-auto">
              Quotations and invoices will use these details for "Billed By", bank/UPI payment details, logo and
              signature.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={() => openCreate(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg"
            >
              Start from current PDF details
            </button>
            <button
              onClick={() => openCreate(false)}
              className="px-4 py-2 border border-slate-300 dark:border-brand-700 text-sm font-bold rounded-lg text-slate-700 dark:text-slate-200"
            >
              Start blank
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {companies.map((c) => (
            <div
              key={c.id}
              className={`bg-white dark:bg-brand-900 border rounded-xl p-5 space-y-4 ${
                c.isDefault ? 'border-indigo-400 dark:border-indigo-600' : 'border-slate-200 dark:border-brand-800'
              } ${c.isActive ? '' : 'opacity-60'}`}
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-lg bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 flex items-center justify-center shrink-0 overflow-hidden">
                  {c.logoDataUrl ? (
                    <img src={c.logoDataUrl} alt="" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <Building2 className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-900 dark:text-white truncate">{c.name}</h3>
                    {c.isDefault && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600">
                        Default
                      </span>
                    )}
                    {!c.isActive && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{addressLine(c) || 'No address added'}</p>
                  <p className="text-xs text-slate-500">
                    GSTIN: {c.gstin || '—'} {c.stateCode ? `· State code ${c.stateCode}` : ''}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex gap-2 items-start">
                  <Landmark className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-700 dark:text-slate-200">{c.bankName || 'No bank added'}</div>
                    {c.bankAccountNumber && (
                      <div className="text-slate-500">
                        A/c {c.bankAccountNumber} · {c.bankIfsc}
                      </div>
                    )}
                    {companyBankAccounts(c).length > 1 && (
                      <div className="text-slate-400">+{companyBankAccounts(c).length - 1} more account(s)</div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 items-start">
                  <QrCode className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="font-semibold text-slate-700 dark:text-slate-200">{c.upiId || 'No UPI ID added'}</div>
                </div>
              </div>

              {(!c.bankAccountNumber && !c.upiId) || !c.gstin ? (
                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400 rounded-lg p-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    {!c.gstin && 'GSTIN is missing. '}
                    {!c.bankAccountNumber && !c.upiId && 'Add bank or UPI details so clients know how to pay.'}
                  </span>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-brand-800">
                <span className="text-[11px] text-slate-400 mr-auto pt-2">
                  Used on {c._count?.quotations || 0} quotation(s), {c._count?.invoices || 0} invoice(s)
                </span>
                <div className="flex gap-1 pt-2">
                  {!c.isDefault && c.isActive && (
                    <button
                      onClick={() => handleSetDefault(c)}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-brand-800 flex items-center gap-1"
                    >
                      <Star className="w-3.5 h-3.5" /> Make default
                    </button>
                  )}
                  {!c.isDefault && (
                    <button
                      onClick={() => handleToggleActive(c)}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-brand-800 flex items-center gap-1"
                    >
                      <Power className="w-3.5 h-3.5" /> {c.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(c)}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-brand-800 flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  {!c.isDefault && (
                    <button
                      onClick={() => handleDelete(c)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                      title="Delete company"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-brand-900 rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-lg">{editing ? `Edit ${editing.name}` : 'Add Company'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-lg px-2">
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {prefilledFromPdf && (
                <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-300 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    These are the details currently printed on your PDFs. Please check every field, especially the
                    bank account, before saving.
                  </span>
                </div>
              )}

              <section className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Company</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Company name *">
                    <input required value={form.name} onChange={(e) => set('name', e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="GSTIN">
                    <input
                      value={form.gstin || ''}
                      onChange={(e) => {
                        const gstin = e.target.value.toUpperCase();
                        const code = gstin.slice(0, 2);
                        const state = INDIAN_STATES.find((s) => s.code === code);
                        setForm((f) => ({
                          ...f,
                          gstin,
                          ...(state && !f.state ? { state: state.name, stateCode: state.code } : {}),
                        }));
                      }}
                      className={inputClass}
                      placeholder="e.g. 36AAGCG6536J2ZA"
                    />
                  </Field>
                  <Field label="PAN">
                    <input value={form.pan || ''} onChange={(e) => set('pan', e.target.value.toUpperCase())} className={inputClass} />
                  </Field>
                  <Field label="Email">
                    <input type="email" value={form.email || ''} onChange={(e) => set('email', e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Phone">
                    <input value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Website">
                    <input value={form.website || ''} onChange={(e) => set('website', e.target.value)} className={inputClass} />
                  </Field>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Address</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Address line 1">
                    <input value={form.addressLine1 || ''} onChange={(e) => set('addressLine1', e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Address line 2">
                    <input value={form.addressLine2 || ''} onChange={(e) => set('addressLine2', e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="City">
                    <input value={form.city || ''} onChange={(e) => set('city', e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="State" hint="Decides CGST+SGST (same state) or IGST (other state) on invoices.">
                    <select
                      value={form.state || ''}
                      onChange={(e) => setForm((f) => ({ ...f, state: e.target.value, stateCode: stateCodeFor(e.target.value) }))}
                      className={inputClass}
                    >
                      <option value="">Select state</option>
                      {INDIAN_STATES.map((s) => (
                        <option key={s.code} value={s.name}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Pincode">
                    <input value={form.pincode || ''} onChange={(e) => set('pincode', e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Country">
                    <input value={form.country} onChange={(e) => set('country', e.target.value)} className={inputClass} />
                  </Field>
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bank accounts</h4>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, bankAccounts: [...(f.bankAccounts || []), newBankAccount(!(f.bankAccounts || []).length)] }))}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add bank account
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  The default account is pre-selected on new quotations and invoices. You can pick another one, or none, on each document.
                </p>
                {(form.bankAccounts || []).length === 0 && (
                  <div className="text-xs text-slate-500 border border-dashed border-slate-300 dark:border-brand-700 rounded-lg p-3">
                    No bank account yet. Add one so clients know where to pay.
                  </div>
                )}
                {(form.bankAccounts || []).map((acct) => {
                  const update = (patch: Partial<BankAccount>) =>
                    setForm((f) => ({ ...f, bankAccounts: (f.bankAccounts || []).map((a) => (a.id === acct.id ? { ...a, ...patch } : a)) }));
                  return (
                    <div key={acct.id} className="border border-slate-200 dark:border-brand-800 rounded-xl p-3 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                          <input
                            type="radio"
                            name="default-bank"
                            checked={acct.isDefault}
                            onChange={() => setForm((f) => ({ ...f, bankAccounts: (f.bankAccounts || []).map((a) => ({ ...a, isDefault: a.id === acct.id })) }))}
                          />
                          Default account
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((f) => {
                              const rest = (f.bankAccounts || []).filter((a) => a.id !== acct.id);
                              if (acct.isDefault && rest.length) rest[0] = { ...rest[0], isDefault: true };
                              return { ...f, bankAccounts: rest };
                            })
                          }
                          className="p-1 text-slate-400 hover:text-rose-600"
                          title="Remove this account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Label (shown only to you)">
                          <input value={acct.label || ''} onChange={(e) => update({ label: e.target.value })} className={inputClass} placeholder="e.g. Current account, USD account" />
                        </Field>
                        <Field label="Account holder name">
                          <input value={acct.accountName || ''} onChange={(e) => update({ accountName: e.target.value })} className={inputClass} />
                        </Field>
                        <Field label="Bank name">
                          <input value={acct.bankName || ''} onChange={(e) => update({ bankName: e.target.value })} className={inputClass} />
                        </Field>
                        <Field label="Account number">
                          <input value={acct.accountNumber || ''} onChange={(e) => update({ accountNumber: e.target.value.replace(/\s/g, '') })} className={inputClass} />
                        </Field>
                        <Field label="IFSC">
                          <input value={acct.ifsc || ''} onChange={(e) => update({ ifsc: e.target.value.toUpperCase() })} className={inputClass} />
                        </Field>
                        <Field label="Branch">
                          <input value={acct.branch || ''} onChange={(e) => update({ branch: e.target.value })} className={inputClass} />
                        </Field>
                        <Field label="SWIFT code (international payments)">
                          <input value={acct.swift || ''} onChange={(e) => update({ swift: e.target.value.toUpperCase() })} className={inputClass} />
                        </Field>
                      </div>
                    </div>
                  );
                })}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="UPI ID" hint="Used for the UPI QR code on invoices.">
                    <input value={form.upiId || ''} onChange={(e) => set('upiId', e.target.value)} className={inputClass} placeholder="e.g. onebridge@okaxis" />
                  </Field>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Logo, signature & stamp</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {(
                    [
                      ['Logo', 'logoDataUrl'],
                      ['Signature', 'signatureDataUrl'],
                      ['Company stamp', 'stampDataUrl'],
                    ] as const
                  ).map(([label, key]) => (
                    <ImagePicker
                      key={key}
                      label={label}
                      value={form[key]}
                      onChange={(v) => set(key, v)}
                      onError={(message) => alert({ title: 'Image not accepted', message, variant: 'warning' })}
                    />
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Document defaults</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Default quotation terms">
                    <textarea rows={5} value={form.quotationTerms || ''} onChange={(e) => set('quotationTerms', e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Default invoice terms">
                    <textarea rows={5} value={form.invoiceTerms || ''} onChange={(e) => set('invoiceTerms', e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Default notes">
                    <textarea rows={3} value={form.defaultNotes || ''} onChange={(e) => set('defaultNotes', e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Always CC these emails" hint="Comma-separated. Added to every quotation/invoice email.">
                    <input value={form.emailCc || ''} onChange={(e) => set('emailCc', e.target.value)} className={inputClass} placeholder="accounts@onebridgeinfotech.com" />
                  </Field>
                </div>
              </section>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-brand-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-brand-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold rounded-lg"
                >
                  {saving ? 'Saving…' : editing ? 'Save changes' : 'Save company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingSettingsPage;
