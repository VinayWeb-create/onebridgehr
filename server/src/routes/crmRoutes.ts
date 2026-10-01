import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getLeads,
  createLead,
  updateLead,
  deleteLead,
  sendLeadEmail,
  submitWebsiteInquiry,
  submitProposalRequest,
  submitDemoBooking,
} from '../controllers/crmController';
import {
  getQuotations,
  getQuotationById,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  recordPayment,
  cancelInvoice,
  deleteInvoice,
} from '../controllers/quotationInvoiceController';
import {
  downloadDocumentPdf,
  getSendPreview,
  sendDocumentEmail,
  sendDocumentWhatsApp,
  getShareLink,
  getDocumentActivity,
  convertQuotation,
  adminAcceptQuotation,
  getPublicDocument,
  getPublicDocumentPdf,
  publicAcceptQuotation,
} from '../controllers/billingDocumentController';
import {
  getBillingCompanies,
  createBillingCompany,
  updateBillingCompany,
  setDefaultBillingCompany,
  deleteBillingCompany,
  getBillingClients,
  createBillingClient,
  updateBillingClient,
  deleteBillingClient,
} from '../controllers/billingController';
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

// Client share links (/p/:token) — no login; the token is a random, revocable secret.
const publicDocLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
router.get('/public/doc/:token', publicDocLimiter, getPublicDocument);
router.get('/public/doc/:token/pdf', publicDocLimiter, getPublicDocumentPdf);
router.post('/public/doc/:token/accept', publicDocLimiter, publicAcceptQuotation);

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

// Quotations
router.get('/quotations', getQuotations);
router.get('/quotations/:id', getQuotationById);
router.post('/quotations', createQuotation);
router.put('/quotations/:id', updateQuotation);
router.delete('/quotations/:id', deleteQuotation);
router.post('/quotations/:id/accept', adminAcceptQuotation);
router.post('/quotations/:id/convert', convertQuotation);

// Invoices
router.get('/invoices', getInvoices);
router.get('/invoices/:id', getInvoiceById);
router.post('/invoices', createInvoice);
router.put('/invoices/:id', updateInvoice);
router.post('/invoices/:id/record-payment', recordPayment);
router.post('/invoices/:id/cancel', cancelInvoice);
router.delete('/invoices/:id', deleteInvoice);

// Shared document actions: PDF, send, share link, activity (type = quotations | invoices)
router.get('/:type(quotations|invoices)/:id/pdf', downloadDocumentPdf);
router.get('/:type(quotations|invoices)/:id/send-preview', getSendPreview);
router.post('/:type(quotations|invoices)/:id/send-email', sendDocumentEmail);
router.post('/:type(quotations|invoices)/:id/send-whatsapp', sendDocumentWhatsApp);
router.post('/:type(quotations|invoices)/:id/share-link', getShareLink);
router.get('/:type(quotations|invoices)/:id/activity', getDocumentActivity);

// Billing Settings: issuing companies ("Billed By") and saved clients ("Billed To")
router.get('/billing/companies', getBillingCompanies);
router.post('/billing/companies', createBillingCompany);
router.put('/billing/companies/:id', updateBillingCompany);
router.post('/billing/companies/:id/set-default', setDefaultBillingCompany);
router.delete('/billing/companies/:id', deleteBillingCompany);

router.get('/billing/clients', getBillingClients);
router.post('/billing/clients', createBillingClient);
router.put('/billing/clients/:id', updateBillingClient);
router.delete('/billing/clients/:id', deleteBillingClient);

export default router;
