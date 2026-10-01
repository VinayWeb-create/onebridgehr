import { api } from './api';

export interface Lead {
  id: string;
  leadNumber: string;
  clientName: string;
  companyName?: string;
  email: string;
  phone: string;
  serviceOfInterest?: string;
  projectDetails?: string;
  timeline?: string;
  source: string;
  status: 'NEW' | 'CONTACTED' | 'PROPOSAL_SENT' | 'NEGOTIATING' | 'WON' | 'LOST';
  estimatedValue: number;
  currency: string;
  notes?: string;
  assignedTo?: string;
  followUpDate?: string;
  quotations?: { id: string; quotationNumber: string; totalAmount: number; status: string }[];
  createdAt: string;
}

export interface LineItem {
  description: string;
  details?: string;
  hsnSac?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  taxPercent?: number;
  amount?: number;
  taxableAmount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  total?: number;
}

/** Fields shared by quotations and invoices (GST breakdown, share link, tracking). */
export interface BillingDocFields {
  companyId?: string | null;
  clientId?: string | null;
  poNumber?: string | null;
  bankAccountId?: string | null;
  placeOfSupply?: string | null;
  placeOfSupplyCode?: string | null;
  taxType?: 'CGST_SGST' | 'IGST' | null;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  additionalCharges?: number;
  additionalChargesLabel?: string | null;
  amountInWords?: string | null;
  viewedAt?: string | null;
  viewCount?: number;
}

export type DocType = 'quotations' | 'invoices';

export interface SendPreview {
  email: { to: string; cc: string[]; subject: string; message: string };
  whatsapp: { phone: string; message: string };
  shareUrl: string;
  companyName: string;
  fileName: string;
}

export interface DocumentActivity {
  logs: { id: string; channel: string; recipient: string; subject?: string; status: string; errorMessage?: string; sentAt: string }[];
  viewedAt: string | null;
  viewCount: number;
  acceptedAt: string | null;
  acceptedBy: string | null;
  payments: { amount: number; method?: string; reference?: string; date: string; notes?: string }[];
}

export interface Quotation extends BillingDocFields {
  id: string;
  title?: string | null;
  acceptedAt?: string | null;
  acceptedBy?: string | null;
  invoices?: { id: string; invoiceNumber: string; paymentStatus: string; totalAmount: number }[];
  quotationNumber: string;
  leadId?: string;
  clientName: string;
  clientCompany?: string;
  clientEmail: string;
  clientPhone?: string;
  clientAddress?: string;
  clientGst?: string;
  items: LineItem[];
  subTotal: number;
  taxPercent: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  termsAndConditions?: string;
  notes?: string;
  status: 'DRAFT' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'CONVERTED' | 'DECLINED' | 'EXPIRED';
  validUntil?: string;
  pdfUrl?: string;
  sentViaEmail: boolean;
  autoSendEmail?: boolean;
  sentViaWhatsApp: boolean;
  createdAt: string;
}

export interface Invoice extends BillingDocFields {
  id: string;
  isDraft?: boolean;
  payments?: DocumentActivity['payments'];
  quotation?: { id: string; quotationNumber: string } | null;
  invoiceNumber: string;
  quotationId?: string;
  clientName: string;
  clientCompany?: string;
  clientEmail: string;
  clientPhone?: string;
  clientGst?: string;
  billingAddress?: string;
  items: LineItem[];
  subTotal: number;
  taxPercent: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  issueDate: string;
  dueDate: string;
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  paymentMethod?: string;
  paymentReference?: string;
  pdfUrl?: string;
  notes?: string;
  sentViaEmail: boolean;
  sentViaWhatsApp: boolean;
  createdAt: string;
}

export interface BankAccount {
  id: string;
  label?: string | null;
  accountName?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  ifsc?: string | null;
  branch?: string | null;
  swift?: string | null;
  isDefault: boolean;
}

/** Document bankAccountId value that hides bank details. */
export const NO_BANK = 'NONE';

/** A company's bank accounts (companies saved before multi-account support expose their single account). */
export const companyBankAccounts = (c?: BillingCompany | null): BankAccount[] => {
  if (!c) return [];
  if (Array.isArray(c.bankAccounts) && c.bankAccounts.length) return c.bankAccounts;
  if (!c.bankAccountNumber && !c.bankName) return [];
  return [
    {
      id: 'primary',
      accountName: c.bankAccountName,
      bankName: c.bankName,
      accountNumber: c.bankAccountNumber,
      ifsc: c.bankIfsc,
      branch: c.bankBranch,
      swift: c.bankSwift,
      isDefault: true,
    },
  ];
};

export const bankAccountLabel = (a: BankAccount) =>
  [a.label || a.bankName || 'Bank account', a.accountNumber ? `••${a.accountNumber.slice(-4)}` : ''].filter(Boolean).join(' ');

export interface BillingCompany {
  id: string;
  name: string;
  gstin?: string | null;
  pan?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  stateCode?: string | null;
  pincode?: string | null;
  country: string;
  logoDataUrl?: string | null;
  signatureDataUrl?: string | null;
  stampDataUrl?: string | null;
  bankAccountName?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
  bankBranch?: string | null;
  bankSwift?: string | null;
  upiId?: string | null;
  bankAccounts?: BankAccount[] | null;
  quotationTerms?: string | null;
  invoiceTerms?: string | null;
  defaultNotes?: string | null;
  emailCc?: string | null;
  isDefault: boolean;
  isActive: boolean;
  _count?: { quotations: number; invoices: number };
}

export interface BillingClient {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  gstin?: string | null;
  billingAddress?: string | null;
  state?: string | null;
  stateCode?: string | null;
  leadId?: string | null;
}

export const crmService = {
  // Leads
  getLeads: async (status?: string, service?: string, search?: string) => {
    const res = await api.get('/crm/leads', { params: { status, service, search } });
    return res.data.data as Lead[];
  },
  createLead: async (data: Partial<Lead>) => {
    const res = await api.post('/crm/leads', data);
    return res.data.data as Lead;
  },
  updateLead: async (id: string, data: Partial<Lead>) => {
    const res = await api.put(`/crm/leads/${id}`, data);
    return res.data.data as Lead;
  },
  deleteLead: async (id: string) => {
    const res = await api.delete(`/crm/leads/${id}`);
    return res.data;
  },
  sendLeadEmail: async (id: string) => {
    const res = await api.post(`/crm/leads/${id}/send-email`);
    return res.data;
  },
  submitPublicInquiry: async (data: {
    clientName: string;
    email: string;
    phone: string;
    companyName?: string;
    serviceOfInterest?: string;
    projectDetails?: string;
    timeline?: string;
  }) => {
    const res = await api.post('/crm/contact', data);
    return res.data;
  },

  // Quotations
  getQuotations: async (status?: string, search?: string) => {
    const res = await api.get('/crm/quotations', { params: { status, search } });
    return res.data.data as Quotation[];
  },
  getQuotationById: async (id: string) => {
    const res = await api.get(`/crm/quotations/${id}`);
    return res.data.data as Quotation;
  },
  createQuotation: async (data: any) => {
    const res = await api.post('/crm/quotations', data);
    return res.data.data as Quotation;
  },
  updateQuotation: async (id: string, data: any) => {
    const res = await api.put(`/crm/quotations/${id}`, data);
    return res.data.data as Quotation;
  },
  deleteQuotation: async (id: string) => {
    const res = await api.delete(`/crm/quotations/${id}`);
    return res.data;
  },
  acceptQuotation: async (id: string) => {
    const res = await api.post(`/crm/quotations/${id}/accept`);
    return res.data as { message: string; data: Quotation };
  },
  convertQuotation: async (id: string) => {
    const res = await api.post(`/crm/quotations/${id}/convert`);
    return res.data as { message: string; data: Invoice };
  },

  // Invoices
  getInvoices: async (status?: string, search?: string) => {
    const res = await api.get('/crm/invoices', { params: { status, search } });
    return res.data.data as Invoice[];
  },
  getInvoiceById: async (id: string) => {
    const res = await api.get(`/crm/invoices/${id}`);
    return res.data.data as Invoice;
  },
  createInvoice: async (data: any) => {
    const res = await api.post('/crm/invoices', data);
    return res.data.data as Invoice;
  },
  updateInvoice: async (id: string, data: any) => {
    const res = await api.put(`/crm/invoices/${id}`, data);
    return res.data.data as Invoice;
  },
  cancelInvoice: async (id: string) => {
    const res = await api.post(`/crm/invoices/${id}/cancel`);
    return res.data.data as Invoice;
  },
  recordPayment: async (
    id: string,
    data: { paymentAmount: number; paymentMethod?: string; paymentReference?: string; paymentDate?: string; notes?: string }
  ) => {
    const res = await api.post(`/crm/invoices/${id}/record-payment`, data);
    return res.data.data as Invoice;
  },
  deleteInvoice: async (id: string) => {
    const res = await api.delete(`/crm/invoices/${id}`);
    return res.data;
  },

  // Shared document actions (quotations & invoices)
  getDocumentPdfBlob: async (type: DocType, id: string) => {
    const res = await api.get(`/crm/${type}/${id}/pdf`, { responseType: 'blob' });
    return res.data as Blob;
  },
  getSendPreview: async (type: DocType, id: string) => {
    const res = await api.get(`/crm/${type}/${id}/send-preview`);
    return res.data.data as SendPreview;
  },
  sendDocumentEmail: async (
    type: DocType,
    id: string,
    data?: { to?: string; cc?: string[]; subject?: string; message?: string; attachPdf?: boolean; includeLink?: boolean }
  ) => {
    const res = await api.post(`/crm/${type}/${id}/send-email`, data || {});
    return res.data as { message: string };
  },
  sendDocumentWhatsApp: async (type: DocType, id: string, data?: { phone?: string; message?: string }) => {
    const res = await api.post(`/crm/${type}/${id}/send-whatsapp`, data || {});
    return res.data as { whatsappUrl: string };
  },
  getShareLink: async (type: DocType, id: string, rotate = false) => {
    const res = await api.post(`/crm/${type}/${id}/share-link`, { rotate });
    return res.data.data.url as string;
  },
  getDocumentActivity: async (type: DocType, id: string) => {
    const res = await api.get(`/crm/${type}/${id}/activity`);
    return res.data.data as DocumentActivity;
  },

  // Billing companies ("Billed By")
  getBillingCompanies: async () => {
    const res = await api.get('/crm/billing/companies');
    return res.data.data as BillingCompany[];
  },
  createBillingCompany: async (data: Partial<BillingCompany> & { isDefault?: boolean }) => {
    const res = await api.post('/crm/billing/companies', data);
    return res.data.data as BillingCompany;
  },
  updateBillingCompany: async (id: string, data: Partial<BillingCompany>) => {
    const res = await api.put(`/crm/billing/companies/${id}`, data);
    return res.data.data as BillingCompany;
  },
  setDefaultBillingCompany: async (id: string) => {
    const res = await api.post(`/crm/billing/companies/${id}/set-default`);
    return res.data.data as BillingCompany;
  },
  getBankHistory: async (id: string) => {
    const res = await api.get(`/crm/billing/companies/${id}/bank-history`);
    return res.data.data as { id: string; at: string; changedBy: string; changes: string[]; ipAddress?: string | null }[];
  },
  deleteBillingCompany: async (id: string) => {
    const res = await api.delete(`/crm/billing/companies/${id}`);
    return res.data as { status: string; message: string };
  },

  // Billing clients ("Billed To")
  getBillingClients: async (search?: string) => {
    const res = await api.get('/crm/billing/clients', { params: { search } });
    return res.data.data as BillingClient[];
  },
  createBillingClient: async (data: Partial<BillingClient>) => {
    const res = await api.post('/crm/billing/clients', data);
    return res.data.data as BillingClient;
  },
  updateBillingClient: async (id: string, data: Partial<BillingClient>) => {
    const res = await api.put(`/crm/billing/clients/${id}`, data);
    return res.data.data as BillingClient;
  },
  deleteBillingClient: async (id: string) => {
    const res = await api.delete(`/crm/billing/clients/${id}`);
    return res.data;
  },
};
