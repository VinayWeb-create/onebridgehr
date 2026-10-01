/**
 * Single source of truth for quotation/invoice totals.
 * Copy of server/src/services/billingCalc.ts — keep the two in sync.
 *
 * Rules:
 *  - Line amount = quantity × rate. GST rate is per line (falls back to the document rate).
 *  - Discount reduces the taxable value (spread across lines in proportion to their amount).
 *  - Same state (supplier vs place of supply) → CGST + SGST (half each); different state or export → IGST.
 *  - Additional charges are added after tax and are not taxed.
 */

export interface BillingLineInput {
  description?: string;
  details?: string;
  hsnSac?: string;
  quantity?: number | string;
  unit?: string;
  unitPrice?: number | string;
  taxPercent?: number | string | null;
  amount?: number | string;
}

export interface BillingLine {
  description: string;
  details?: string;
  hsnSac?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  taxPercent: number;
  amount: number; // quantity × rate, before discount
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface BillingInput {
  items: BillingLineInput[];
  taxPercent?: number | string | null; // default GST rate for lines without one
  discountAmount?: number | string | null;
  additionalCharges?: number | string | null;
  placeOfSupplyCode?: string | null;
  clientGst?: string | null;
  supplierStateCode?: string | null;
}

export interface BillingTotals {
  items: BillingLine[];
  subTotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxType: 'CGST_SGST' | 'IGST';
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxAmount: number;
  additionalCharges: number;
  totalAmount: number;
  amountInWords: string;
  placeOfSupplyCode: string | null;
  placeOfSupply: string | null;
}

export const GST_STATES: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '96': 'Other Country (Export)',
  '97': 'Other Territory',
};

export const EXPORT_STATE_CODE = '96';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const resolvePlaceOfSupplyCode = (
  explicitCode?: string | null,
  clientGst?: string | null,
  supplierStateCode?: string | null
): string | null => {
  if (explicitCode && GST_STATES[explicitCode]) return explicitCode;
  const fromGst = (clientGst || '').trim().slice(0, 2);
  if (/^\d{2}$/.test(fromGst) && GST_STATES[fromGst]) return fromGst;
  return supplierStateCode && GST_STATES[supplierStateCode] ? supplierStateCode : null;
};

export function calculateBilling(input: BillingInput): BillingTotals {
  const defaultRate = Math.max(0, num(input.taxPercent, 0));
  const placeOfSupplyCode = resolvePlaceOfSupplyCode(input.placeOfSupplyCode, input.clientGst, input.supplierStateCode);
  const isInterState =
    placeOfSupplyCode === EXPORT_STATE_CODE ||
    (!!input.supplierStateCode && !!placeOfSupplyCode && placeOfSupplyCode !== input.supplierStateCode);
  const taxType: 'CGST_SGST' | 'IGST' = isInterState ? 'IGST' : 'CGST_SGST';

  const base = (Array.isArray(input.items) ? input.items : [])
    .filter((it) => it && (String(it.description || '').trim() || num(it.unitPrice) || num(it.amount)))
    .map((it) => {
      const quantity = Math.max(0, num(it.quantity, 1));
      // Older records may only have `amount`; derive a rate from it.
      const unitPrice = it.unitPrice !== undefined && it.unitPrice !== '' ? num(it.unitPrice) : quantity ? num(it.amount) / quantity : 0;
      const rawRate = it.taxPercent === undefined || it.taxPercent === null || it.taxPercent === '' ? defaultRate : num(it.taxPercent);
      return {
        description: String(it.description || '').trim(),
        details: it.details ? String(it.details) : undefined,
        hsnSac: it.hsnSac ? String(it.hsnSac).trim() : undefined,
        unit: it.unit ? String(it.unit).trim() : undefined,
        quantity,
        unitPrice: round2(unitPrice),
        taxPercent: Math.max(0, rawRate),
        amount: round2(quantity * unitPrice),
      };
    });

  const subTotal = round2(base.reduce((s, it) => s + it.amount, 0));
  const discountAmount = round2(Math.min(Math.max(0, num(input.discountAmount)), subTotal));

  let remainingDiscount = discountAmount;
  const items: BillingLine[] = base.map((it, idx) => {
    // Last line absorbs rounding so line discounts add up exactly.
    const lineDiscount =
      idx === base.length - 1 ? remainingDiscount : subTotal ? round2((discountAmount * it.amount) / subTotal) : 0;
    remainingDiscount = round2(remainingDiscount - lineDiscount);
    const taxableAmount = round2(it.amount - lineDiscount);
    const tax = round2((taxableAmount * it.taxPercent) / 100);
    const cgst = taxType === 'CGST_SGST' ? round2(tax / 2) : 0;
    const sgst = taxType === 'CGST_SGST' ? round2(tax - cgst) : 0;
    const igst = taxType === 'IGST' ? tax : 0;
    return { ...it, taxableAmount, cgst, sgst, igst, total: round2(taxableAmount + cgst + sgst + igst) };
  });

  const cgstAmount = round2(items.reduce((s, it) => s + it.cgst, 0));
  const sgstAmount = round2(items.reduce((s, it) => s + it.sgst, 0));
  const igstAmount = round2(items.reduce((s, it) => s + it.igst, 0));
  const taxAmount = round2(cgstAmount + sgstAmount + igstAmount);
  const taxableAmount = round2(subTotal - discountAmount);
  const additionalCharges = round2(Math.max(0, num(input.additionalCharges)));
  const totalAmount = round2(taxableAmount + taxAmount + additionalCharges);

  return {
    items,
    subTotal,
    discountAmount,
    taxableAmount,
    taxType,
    cgstAmount,
    sgstAmount,
    igstAmount,
    taxAmount,
    additionalCharges,
    totalAmount,
    amountInWords: amountToWordsINR(totalAmount),
    placeOfSupplyCode,
    placeOfSupply: placeOfSupplyCode ? GST_STATES[placeOfSupplyCode] : null,
  };
}

// ---------- Amount in words (Indian numbering: thousand, lakh, crore) ----------

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const twoDigits = (n: number): string => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`);

const threeDigits = (n: number): string => {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', rest ? twoDigits(rest) : ''].filter(Boolean).join(' ');
};

export function integerToWordsIndian(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${crore > 99 ? integerToWordsIndian(crore) : twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  return parts.join(' ');
}

export function amountToWordsINR(amount: number): string {
  const rounded = round2(Math.abs(amount));
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);
  const rupeeWords = `${integerToWordsIndian(rupees)} Rupee${rupees === 1 ? '' : 's'}`;
  return paise ? `${rupeeWords} and ${twoDigits(paise)} Paise Only` : `${rupeeWords} Only`;
}
