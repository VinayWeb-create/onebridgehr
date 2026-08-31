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
  quantity: number;
  unitPrice: number;
  taxPercent?: number;
  amount: number;
}

export interface Quotation {
  id: string;
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
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  validUntil?: string;
  pdfUrl?: string;
  sentViaEmail: boolean;
  autoSendEmail?: boolean;
  sentViaWhatsApp: boolean;
  createdAt: string;
}

export interface Invoice {
  id: string;
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
    return res.data;
  },
  sendQuotationEmail: async (id: string) => {
    const res = await api.post(`/crm/quotations/${id}/send-email`);
    return res.data;
  },
  sendQuotationWhatsApp: async (id: string) => {
    const res = await api.post(`/crm/quotations/${id}/send-whatsapp`);
    return res.data;
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
  recordPayment: async (id: string, data: { paymentAmount: number; paymentMethod?: string; paymentReference?: string; notes?: string }) => {
    const res = await api.post(`/crm/invoices/${id}/record-payment`, data);
    return res.data.data as Invoice;
  },
  deleteInvoice: async (id: string) => {
    const res = await api.delete(`/crm/invoices/${id}`);
    return res.data;
  },
  sendInvoiceEmail: async (id: string) => {
    const res = await api.post(`/crm/invoices/${id}/send-email`);
    return res.data;
  },
  sendInvoiceWhatsApp: async (id: string) => {
    const res = await api.post(`/crm/invoices/${id}/send-whatsapp`);
    return res.data;
  },
};
