import { Router } from 'express';
import {
  getLeads,
  createLead,
  updateLead,
  deleteLead,
  sendLeadEmail,
  submitWebsiteInquiry,
  getQuotations,
  getQuotationById,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  acceptQuotation,
  sendQuotationEmail,
  sendQuotationWhatsApp,
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  recordPayment,
  deleteInvoice,
  sendInvoiceEmail,
  sendInvoiceWhatsApp,
  submitProposalRequest,
  submitDemoBooking,
  getPublicQuotation,
  publicProcessQuotationPayment
} from '../controllers/crmController';
import { protect, restrictTo } from '../middleware/auth';

const router = Router();

// ==========================================
// Public Endpoints (Website Contact Forms & Inquiries)
// https://www.onebridgeinfotech.com/contact
// ==========================================
router.post('/contact', submitWebsiteInquiry);
router.post('/leads/public', submitWebsiteInquiry);
router.post('/inquiry', submitWebsiteInquiry);
router.post('/contact/:leadId/proposal', submitProposalRequest);
router.post('/contact/:leadId/demo', submitDemoBooking);

router.get('/public/quotations/:id', getPublicQuotation);
router.post('/public/quotations/:id/pay', publicProcessQuotationPayment);

// ==========================================
// Strict Super Admin Access Only
// ==========================================
router.use(protect);
router.use(restrictTo('SUPER_ADMIN'));

// Leads Endpoints
router.get('/leads', getLeads);
router.post('/leads', createLead);
router.put('/leads/:id', updateLead);
router.delete('/leads/:id', deleteLead);
router.post('/leads/:id/send-email', sendLeadEmail);

// Quotations Endpoints
router.get('/quotations', getQuotations);
router.get('/quotations/:id', getQuotationById);
router.post('/quotations', createQuotation);
router.put('/quotations/:id', updateQuotation);
router.delete('/quotations/:id', deleteQuotation);
router.post('/quotations/:id/accept', acceptQuotation);
router.post('/quotations/:id/send-email', sendQuotationEmail);
router.post('/quotations/:id/send-whatsapp', sendQuotationWhatsApp);

// Invoices Endpoints
router.get('/invoices', getInvoices);
router.get('/invoices/:id', getInvoiceById);
router.post('/invoices', createInvoice);
router.put('/invoices/:id', updateInvoice);
router.post('/invoices/:id/record-payment', recordPayment);
router.delete('/invoices/:id', deleteInvoice);
router.post('/invoices/:id/send-email', sendInvoiceEmail);
router.post('/invoices/:id/send-whatsapp', sendInvoiceWhatsApp);

export default router;
