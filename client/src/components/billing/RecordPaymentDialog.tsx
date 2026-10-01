import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { crmService, type Invoice } from '../../services/crmService';
import { errorMessage, formatINR, localDateInput } from '../../utils/documentActions';

interface Props {
  invoice: Invoice;
  onClose: () => void;
  onRecorded: (invoice: Invoice, sendReceipt: boolean) => void;
}

const inputClass =
  'w-full px-3 py-2 bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-800 rounded-lg text-sm text-slate-900 dark:text-white';
const labelClass = 'block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1';

export const RecordPaymentDialog: React.FC<Props> = ({ invoice, onClose, onRecorded }) => {
  const balance = Math.max(0, Number(invoice.totalAmount) - Number(invoice.amountPaid || 0));
  const [amount, setAmount] = useState(String(Math.round(balance * 100) / 100));
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(localDateInput());
  const [notes, setNotes] = useState('');
  const [sendReceipt, setSendReceipt] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!(value > 0)) return setError('Enter an amount greater than 0.');
    if (value > balance + 0.005) return setError(`Amount is more than the balance due (${formatINR(balance)}).`);
    setSaving(true);
    setError('');
    try {
      const updated = await crmService.recordPayment(invoice.id, {
        paymentAmount: value,
        paymentMethod: method,
        paymentReference: reference,
        paymentDate: date,
        notes,
      });
      onRecorded(updated, sendReceipt);
    } catch (err) {
      setError(errorMessage(err, 'Could not record the payment'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white dark:bg-brand-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="font-bold">Record payment</h3>
            <p className="text-xs text-slate-400">
              {invoice.invoiceNumber} · Balance due {formatINR(balance)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Amount received (₹)</label>
              <input type="number" min="0" step="any" required value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Date</label>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
                {['BANK_TRANSFER', 'UPI', 'CHEQUE', 'CASH', 'CARD', 'OTHER'].map((m) => (
                  <option key={m} value={m}>
                    {m.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>UTR / reference</label>
              <input value={reference} onChange={(e) => setReference(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" checked={sendReceipt} onChange={(e) => setSendReceipt(e.target.checked)} />
            Send the updated invoice to the client afterwards
          </label>
          {error && <div className="text-sm text-rose-600">{error}</div>}
        </div>
        <div className="px-5 py-3 border-t border-slate-200 dark:border-brand-800 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-brand-800">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold rounded-lg flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Record payment
          </button>
        </div>
      </form>
    </div>
  );
};

export default RecordPaymentDialog;
