import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { BillingDocumentService, kindFromParam, normalizeWhatsAppNumber } from '../services/billingDocumentService';
import { BillingPdfService } from '../services/billingPdfService';

const sendPdf = (res: Response, pdf: Buffer, fileName: string, download: boolean) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', pdf.length);
  res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${fileName}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.end(pdf);
};

const emailList = z
  .union([z.array(z.string()), z.string()])
  .optional()
  .transform((v) => (Array.isArray(v) ? v : (v || '').split(',')).map((e) => e.trim()).filter(Boolean))
  .refine((list) => list.every((e) => z.string().email().safeParse(e).success), 'Enter valid CC email addresses')
  .refine((list) => list.length <= 10, 'At most 10 CC addresses');

const sendEmailSchema = z.object({
  to: z.string().trim().email('Enter a valid recipient email').optional(),
  cc: emailList,
  subject: z.string().trim().min(1).max(200).optional(),
  message: z.string().trim().min(1).max(5000).optional(),
  attachPdf: z.boolean().optional().default(true),
  includeLink: z.boolean().optional().default(true),
});

const whatsappSchema = z.object({
  phone: z.string().trim().max(20).optional(),
  message: z.string().trim().max(4000).optional(),
});

/** True when the request carries a valid staff login (e.g. an admin checking a link before sending it). */
const isStaffPreview = (req: Request): boolean => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return false;
  try {
    jwt.verify(header.slice(7), process.env.JWT_SECRET || 'onebridge_secret_key_123456_super_secure');
    return true;
  } catch {
    return false;
  }
};

// ------------------------------------------------------------------ admin (SUPER_ADMIN)

export const downloadDocumentPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const kind = kindFromParam(req.params.type);
    const { record, company } = await BillingDocumentService.load(kind, req.params.id);
    const pdf = await BillingDocumentService.renderPdf(kind, record, company);
    sendPdf(res, pdf, BillingPdfService.fileName(kind, record), req.query.download === '1');
  } catch (error) {
    next(error);
  }
};

export const getSendPreview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const kind = kindFromParam(req.params.type);
    const { record, company, totals } = await BillingDocumentService.load(kind, req.params.id);
    const shareUrl = BillingDocumentService.shareUrl(await BillingDocumentService.ensureShareToken(kind, record));
    res.status(200).json({
      status: 'success',
      data: {
        email: BillingDocumentService.emailDraft(kind, record, company, totals.totalAmount),
        whatsapp: {
          phone: normalizeWhatsAppNumber(record.clientPhone) ? record.clientPhone : '',
          message: BillingDocumentService.whatsappDraft(kind, record, company, totals.totalAmount, shareUrl),
        },
        shareUrl,
        companyName: company.name,
        fileName: BillingPdfService.fileName(kind, record),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const sendDocumentEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const kind = kindFromParam(req.params.type);
    const body = sendEmailSchema.parse(req.body || {});

    // Missing fields fall back to the prepared draft, so a bare POST is a one-click send.
    const { record, company, totals } = await BillingDocumentService.load(kind, req.params.id);
    const draft = BillingDocumentService.emailDraft(kind, record, company, totals.totalAmount);
    const to = body.to || draft.to;
    if (!to || !z.string().email().safeParse(to).success) {
      throw new AppError('The client has no valid email address. Add one and try again.', 400);
    }

    const result = await BillingDocumentService.sendEmail(kind, record.id, {
      to,
      cc: req.body?.cc === undefined ? draft.cc : body.cc,
      subject: body.subject || draft.subject,
      message: body.message || draft.message,
      attachPdf: body.attachPdf,
      includeLink: body.includeLink,
    });

    if (!result.sent) {
      res.status(502).json({ status: 'fail', message: result.error || 'Email could not be sent' });
      return;
    }
    res.status(200).json({ status: 'success', message: `Email sent to ${to}` });
  } catch (error) {
    next(error);
  }
};

export const sendDocumentWhatsApp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const kind = kindFromParam(req.params.type);
    const body = whatsappSchema.parse(req.body || {});
    const result = await BillingDocumentService.prepareWhatsApp(kind, req.params.id, body);
    res.status(200).json({ status: 'success', whatsappUrl: result.whatsappUrl, data: result });
  } catch (error) {
    next(error);
  }
};

export const getShareLink = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const kind = kindFromParam(req.params.type);
    const { record } = await BillingDocumentService.load(kind, req.params.id);
    const token = await BillingDocumentService.ensureShareToken(kind, record, req.body?.rotate === true);
    res.status(200).json({ status: 'success', data: { url: BillingDocumentService.shareUrl(token) } });
  } catch (error) {
    next(error);
  }
};

export const getDocumentActivity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const kind = kindFromParam(req.params.type);
    const { record } = await BillingDocumentService.load(kind, req.params.id);
    const logs = await prisma.communicationLog.findMany({
      where: { referenceId: record.id },
      orderBy: { sentAt: 'desc' },
      take: 50,
      select: { id: true, channel: true, recipient: true, subject: true, status: true, errorMessage: true, sentAt: true },
    });
    res.status(200).json({
      status: 'success',
      data: {
        logs,
        viewedAt: record.viewedAt || null,
        viewCount: record.viewCount || 0,
        acceptedAt: record.acceptedAt || null,
        acceptedBy: record.acceptedBy || null,
        payments: kind === 'invoice' ? record.payments || [] : [],
      },
    });
  } catch (error) {
    next(error);
  }
};

export const convertQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { invoice, created } = await BillingDocumentService.convertQuotationToInvoice(req.params.id);
    res.status(created ? 201 : 200).json({
      status: 'success',
      message: created
        ? `Invoice ${invoice.invoiceNumber} created`
        : `This quotation was already converted to invoice ${invoice.invoiceNumber}`,
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

export const adminAcceptQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { record } = await BillingDocumentService.load('quotation', req.params.id);
    const acceptedBy = `Marked by admin (${req.user?.email || 'CRM'})`;
    const updated = await BillingDocumentService.acceptQuotation(record, acceptedBy);
    res.status(200).json({ status: 'success', message: 'Quotation marked as accepted', data: updated });
  } catch (error) {
    next(error);
  }
};

// ------------------------------------------------------------------ public (share link, no login)

export const getPublicDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { kind, record, company, totals } = await BillingDocumentService.loadByToken(req.params.token);
    if (!isStaffPreview(req)) await BillingDocumentService.recordView(kind, record);
    res.status(200).json({ status: 'success', data: await BillingDocumentService.publicView(kind, record, company, totals) });
  } catch (error) {
    next(error);
  }
};

export const getPublicDocumentPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { kind, record, company } = await BillingDocumentService.loadByToken(req.params.token);
    const pdf = await BillingDocumentService.renderPdf(kind, record, company);
    sendPdf(res, pdf, BillingPdfService.fileName(kind, record), req.query.download === '1');
  } catch (error) {
    next(error);
  }
};

export const publicAcceptQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name } = z
      .object({ name: z.string().trim().min(2, 'Please enter your name').max(120) })
      .parse(req.body || {});
    const { kind, record, company, totals } = await BillingDocumentService.loadByToken(req.params.token);
    if (kind !== 'quotation') throw new AppError('Only quotations can be accepted', 400);
    if (record.validUntil && new Date(record.validUntil).getTime() < new Date().setHours(0, 0, 0, 0)) {
      throw new AppError('This quotation has expired. Please contact us for an updated quotation.', 400);
    }

    const alreadyAccepted = ['ACCEPTED', 'CONVERTED'].includes(record.status);
    const updated = await BillingDocumentService.acceptQuotation(record, name);

    // Admins are notified and convert to an invoice themselves (milestone/advance terms vary per deal).
    if (!alreadyAccepted) {
      await BillingDocumentService.notifyAdminsOfAcceptance(updated, company, name);
    }

    res.status(200).json({ status: 'success', data: await BillingDocumentService.publicView(kind, updated, company, totals) });
  } catch (error) {
    next(error);
  }
};
