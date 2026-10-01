import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Printer, CheckCircle2, AlertCircle, Loader2, Smartphone, Landmark } from 'lucide-react';
import { api, SOCKET_URL } from '../../services/api';

interface PublicDoc {
  kind: 'quotation' | 'invoice';
  number: string;
  title: string;
  status: string;
  date: string;
  dueDate: string | null;
  validUntil: string | null;
  poNumber: string | null;
  acceptedAt: string | null;
  acceptedBy: string | null;
  canAccept: boolean;
  client: { name: string; company: string | null; address: string | null; gstin: string | null };
  company: {
    name: string;
    addressLines: string[];
    gstin: string | null;
    email: string | null;
    phone: string | null;
    logoDataUrl: string | null;
    bankAccountName: string | null;
    bankName: string | null;
    bankAccountNumber: string | null;
    bankIfsc: string | null;
    bankBranch: string | null;
    upiId: string | null;
  };
  items: {
    description: string;
    details?: string;
    hsnSac?: string;
    quantity: number;
    unit?: string;
    unitPrice: number;
    taxPercent: number;
    amount: number;
    total: number;
  }[];
  totals: {
    subTotal: number;
    discountAmount: number;
    taxableAmount: number;
    taxType: 'CGST_SGST' | 'IGST';
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    additionalCharges: number;
    additionalChargesLabel: string | null;
    totalAmount: number;
    amountInWords: string;
    placeOfSupply: string | null;
    amountPaid: number;
    balanceDue: number;
  };
  upiUri: string | null;
  upiQrDataUrl: string | null;
  termsAndConditions: string | null;
  notes: string | null;
}

const inr = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Awaiting response', cls: 'bg-blue-50 text-blue-700' },
  SENT: { label: 'Awaiting response', cls: 'bg-blue-50 text-blue-700' },
  VIEWED: { label: 'Awaiting response', cls: 'bg-blue-50 text-blue-700' },
  ACCEPTED: { label: 'Accepted', cls: 'bg-emerald-50 text-emerald-700' },
  CONVERTED: { label: 'Accepted', cls: 'bg-emerald-50 text-emerald-700' },
  DECLINED: { label: 'Declined', cls: 'bg-rose-50 text-rose-700' },
  EXPIRED: { label: 'Expired', cls: 'bg-orange-50 text-orange-700' },
  UNPAID: { label: 'Payment due', cls: 'bg-amber-50 text-amber-700' },
  PARTIALLY_PAID: { label: 'Partly paid', cls: 'bg-blue-50 text-blue-700' },
  OVERDUE: { label: 'Overdue', cls: 'bg-rose-50 text-rose-700' },
  PAID: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500' },
};

export const SharedDocumentPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<PublicDoc | null>(null);
  const [error, setError] = useState('');
  const [acceptName, setAcceptName] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState('');

  useEffect(() => {
    api
      .get(`/crm/public/doc/${token}`)
      .then((res) => {
        setDoc(res.data.data);
        document.title = `${res.data.data.title} ${res.data.data.number} · ${res.data.data.company.name}`;
      })
      .catch((err) => setError(err?.response?.data?.message || 'This link is invalid or has expired.'));
  }, [token]);

  const pdfUrl = `${SOCKET_URL}/api/crm/public/doc/${token}/pdf`;

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccepting(true);
    setAcceptError('');
    try {
      const res = await api.post(`/crm/public/doc/${token}/accept`, { name: acceptName });
      setDoc(res.data.data);
    } catch (err: any) {
      const data = err?.response?.data;
      setAcceptError(data?.errors?.[0]?.message || data?.message || 'Could not accept. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-slate-900">Link not available</h1>
          <p className="text-sm text-slate-500 mt-2">{error} Please contact the sender for a new link.</p>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const isInvoice = doc.kind === 'invoice';
  const status = STATUS_LABEL[doc.status] || STATUS_LABEL.SENT;
  const t = doc.totals;
  const payable = isInvoice ? t.balanceDue : 0;
  const hasBank = !!(doc.company.bankAccountNumber || doc.company.bankName);

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-3 sm:px-6 text-slate-800">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Action bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-500">
            {isInvoice ? 'Invoice' : 'Quotation'} from <strong className="text-slate-800">{doc.company.name}</strong>
          </div>
          <div className="flex gap-2">
            <a href={`${pdfUrl}?download=1`} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg flex items-center gap-2">
              <Download className="w-4 h-4" /> Download PDF
            </a>
            <a href={pdfUrl} target="_blank" rel="noreferrer" className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-sm font-bold rounded-lg flex items-center gap-2">
              <Printer className="w-4 h-4" /> Print
            </a>
          </div>
        </div>

        {/* Accept / accepted banner */}
        {!isInvoice && doc.acceptedAt && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              <strong>Accepted</strong> by {doc.acceptedBy} on {fmtDate(doc.acceptedAt)}. Thank you — we will be in touch shortly.
            </div>
          </div>
        )}
        {doc.canAccept && (
          <form onSubmit={handleAccept} className="bg-white border border-indigo-200 rounded-xl p-4 space-y-3">
            <div className="font-bold text-slate-900">Happy with this quotation?</div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                required
                minLength={2}
                value={acceptName}
                onChange={(e) => setAcceptName(e.target.value)}
                placeholder="Your full name"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <button disabled={accepting} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2">
                {accepting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Accept quotation
              </button>
            </div>
            <p className="text-xs text-slate-500">By accepting you confirm the scope, price and terms below. No payment is taken here.</p>
            {acceptError && <p className="text-sm text-rose-600">{acceptError}</p>}
          </form>
        )}

        {/* Document */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-8 space-y-6">
          <div className="flex flex-col-reverse sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-indigo-700">{doc.title}</h1>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-slate-500">{isInvoice ? 'Invoice No' : 'Quotation No'}</dt>
                <dd className="font-semibold">{doc.number}</dd>
                <dt className="text-slate-500">Date</dt>
                <dd className="font-semibold">{fmtDate(doc.date)}</dd>
                {doc.dueDate && (
                  <>
                    <dt className="text-slate-500">Due date</dt>
                    <dd className="font-semibold">{fmtDate(doc.dueDate)}</dd>
                  </>
                )}
                {doc.validUntil && (
                  <>
                    <dt className="text-slate-500">Valid until</dt>
                    <dd className="font-semibold">{fmtDate(doc.validUntil)}</dd>
                  </>
                )}
                {doc.poNumber && (
                  <>
                    <dt className="text-slate-500">PO / Ref</dt>
                    <dd className="font-semibold">{doc.poNumber}</dd>
                  </>
                )}
              </dl>
              <span className={`inline-block mt-3 text-xs font-bold px-2.5 py-1 rounded-full ${status.cls}`}>{status.label}</span>
            </div>
            {doc.company.logoDataUrl && <img src={doc.company.logoDataUrl} alt={doc.company.name} className="max-h-16 max-w-[180px] object-contain" />}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-violet-50 rounded-xl p-4 text-sm">
              <div className="font-bold text-indigo-600 mb-1">{isInvoice ? 'Billed By' : 'From'}</div>
              <div className="font-bold text-slate-900">{doc.company.name}</div>
              {doc.company.addressLines.map((l) => (
                <div key={l} className="text-slate-600">
                  {l}
                </div>
              ))}
              {doc.company.gstin && <div className="text-slate-600">GSTIN: {doc.company.gstin}</div>}
              {doc.company.email && <div className="text-slate-600">{doc.company.email}</div>}
              {doc.company.phone && <div className="text-slate-600">{doc.company.phone}</div>}
            </div>
            <div className="bg-violet-50 rounded-xl p-4 text-sm">
              <div className="font-bold text-indigo-600 mb-1">{isInvoice ? 'Billed To' : 'For'}</div>
              <div className="font-bold text-slate-900">{doc.client.company || doc.client.name}</div>
              {doc.client.company && <div className="text-slate-600">Attn: {doc.client.name}</div>}
              {doc.client.address && <div className="text-slate-600 whitespace-pre-line">{doc.client.address}</div>}
              {doc.client.gstin && <div className="text-slate-600">GSTIN: {doc.client.gstin}</div>}
            </div>
          </div>
          {t.placeOfSupply && (
            <div className="text-xs text-slate-500">
              Place of supply: <strong className="text-slate-700">{t.placeOfSupply}</strong>
            </div>
          )}

          {/* Items: table on wide screens, cards on phones */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-indigo-600 text-white text-xs">
                  <th className="text-left px-3 py-2 rounded-l-lg">Item</th>
                  <th className="text-center px-2 py-2">HSN/SAC</th>
                  <th className="text-center px-2 py-2">GST</th>
                  <th className="text-center px-2 py-2">Qty</th>
                  <th className="text-right px-2 py-2">Rate</th>
                  <th className="text-right px-3 py-2 rounded-r-lg">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {doc.items.map((it, i) => (
                  <tr key={i} className="align-top">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-900">
                        {i + 1}. {it.description}
                      </div>
                      {it.details && <div className="text-xs text-slate-500">{it.details}</div>}
                    </td>
                    <td className="text-center px-2 py-2.5 text-slate-600">{it.hsnSac || '—'}</td>
                    <td className="text-center px-2 py-2.5 text-slate-600">{it.taxPercent}%</td>
                    <td className="text-center px-2 py-2.5 text-slate-600">
                      {it.quantity} {it.unit || ''}
                    </td>
                    <td className="text-right px-2 py-2.5 text-slate-600 whitespace-nowrap">{inr(it.unitPrice)}</td>
                    <td className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">{inr(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sm:hidden space-y-2">
            {doc.items.map((it, i) => (
              <div key={i} className="border border-slate-200 rounded-lg p-3 text-sm">
                <div className="font-semibold text-slate-900">
                  {i + 1}. {it.description}
                </div>
                {it.details && <div className="text-xs text-slate-500">{it.details}</div>}
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>
                    {it.quantity} {it.unit || ''} × {inr(it.unitPrice)} · GST {it.taxPercent}%
                  </span>
                  <span className="font-semibold text-slate-900">{inr(it.amount)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full sm:w-80 space-y-1.5 text-sm">
              <TotalRow label="Amount" value={inr(t.subTotal)} />
              {t.discountAmount > 0 && <TotalRow label="Discount" value={`- ${inr(t.discountAmount)}`} />}
              {t.taxType === 'IGST' ? (
                <TotalRow label="IGST" value={inr(t.igstAmount)} />
              ) : (
                <>
                  <TotalRow label="CGST" value={inr(t.cgstAmount)} />
                  <TotalRow label="SGST" value={inr(t.sgstAmount)} />
                </>
              )}
              {t.additionalCharges > 0 && <TotalRow label={t.additionalChargesLabel || 'Additional charges'} value={inr(t.additionalCharges)} />}
              <div className="flex justify-between border-t-2 border-slate-900 pt-2 mt-2 text-base font-extrabold text-slate-900">
                <span>Total (INR)</span>
                <span>{inr(t.totalAmount)}</span>
              </div>
              {isInvoice && t.amountPaid > 0 && <TotalRow label="Paid" value={inr(t.amountPaid)} />}
              {isInvoice && (
                <div className={`flex justify-between font-bold ${t.balanceDue > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  <span>Balance due</span>
                  <span>{inr(t.balanceDue)}</span>
                </div>
              )}
              <div className="text-xs text-slate-500 pt-1">{t.amountInWords}</div>
            </div>
          </div>

          {/* How to pay */}
          {(isInvoice ? payable > 0 : true) && doc.status !== 'CANCELLED' && (doc.upiUri || hasBank) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {doc.upiUri && (
                <div className="bg-slate-50 rounded-xl p-4 flex gap-4 items-center">
                  {doc.upiQrDataUrl && <img src={doc.upiQrDataUrl} alt="UPI QR code" className="w-28 h-28 shrink-0 rounded bg-white p-1" />}
                  <div className="text-sm space-y-1">
                    <div className="font-bold text-indigo-600">Pay using UPI</div>
                    <div className="text-slate-600">UPI ID: {doc.company.upiId}</div>
                    <div className="text-slate-600">Amount: {inr(payable)}</div>
                    <a href={doc.upiUri} className="sm:hidden inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold">
                      <Smartphone className="w-3.5 h-3.5" /> Open UPI app
                    </a>
                  </div>
                </div>
              )}
              {hasBank && (
                <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-0.5">
                  <div className="font-bold text-indigo-600 flex items-center gap-1.5 mb-1">
                    <Landmark className="w-4 h-4" /> Bank transfer
                  </div>
                  {doc.company.bankAccountName && <div>Account name: <strong>{doc.company.bankAccountName}</strong></div>}
                  {doc.company.bankAccountNumber && <div>Account no: <strong>{doc.company.bankAccountNumber}</strong></div>}
                  {doc.company.bankIfsc && <div>IFSC: <strong>{doc.company.bankIfsc}</strong></div>}
                  {doc.company.bankName && (
                    <div>
                      Bank: <strong>{[doc.company.bankName, doc.company.bankBranch].filter(Boolean).join(', ')}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {(doc.termsAndConditions || doc.notes) && (
            <div className="grid grid-cols-1 gap-4 text-sm">
              {doc.termsAndConditions && (
                <div>
                  <div className="font-bold text-indigo-600 mb-1">Terms and conditions</div>
                  <div className="text-slate-600 whitespace-pre-line">{doc.termsAndConditions}</div>
                </div>
              )}
              {doc.notes && (
                <div>
                  <div className="font-bold text-indigo-600 mb-1">Notes</div>
                  <div className="text-slate-600 whitespace-pre-line">{doc.notes}</div>
                </div>
              )}
            </div>
          )}
        </div>
        <p className="text-center text-xs text-slate-400">Questions? Contact {doc.company.name}{doc.company.email ? ` at ${doc.company.email}` : ''}.</p>
      </div>
    </div>
  );
};

const TotalRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between text-slate-600">
    <span>{label}</span>
    <span className="font-semibold text-slate-900">{value}</span>
  </div>
);

export default SharedDocumentPage;
