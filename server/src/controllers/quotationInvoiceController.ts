import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { invoiceDocumentSchema, quotationDocumentSchema, recordPaymentSchema } from '../models/validators';
import { BillingCompanyService } from '../services/billingCompanyService';
import { calculateBilling } from '../services/billingCalc';
import { DocumentNumberService } from '../services/documentNumberService';
import { aiEventBus } from '../services/ai/aiEventBus';

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const assertId = (id: string, label: string) => {
  if (!OBJECT_ID.test(id)) throw new AppError(`${label} not found`, 404);
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export const computePaymentStatus = (total: number, paid: number, dueDate: Date | null, isDraft: boolean): PaymentStatus => {
  const balance = round2(total - paid);
  if (total > 0 && balance <= 0) return 'PAID';
  if (!isDraft && dueDate && dueDate < startOfToday()) return 'OVERDUE';
  return paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
};

/** Totals + GST fields shared by quotation and invoice saves. */
const buildAmounts = async (body: any) => {
  const companyId = await BillingCompanyService.resolveCompanyId(body.companyId);
  const company = await BillingCompanyService.getForDocument(companyId);
  const totals = calculateBilling({
    items: body.items,
    taxPercent: body.taxPercent,
    discountAmount: body.discountAmount,
    additionalCharges: body.additionalCharges,
    placeOfSupplyCode: body.placeOfSupplyCode,
    clientGst: body.clientGst,
    supplierStateCode: company.stateCode,
  });
  if (!totals.items.length) throw new AppError('Add at least one item', 400);
  return {
    company,
    data: {
      companyId: companyId ?? undefined,
      items: totals.items as any,
      taxPercent: body.taxPercent,
      subTotal: totals.subTotal,
      discountAmount: totals.discountAmount,
      additionalCharges: totals.additionalCharges,
      additionalChargesLabel: body.additionalChargesLabel,
      taxType: totals.taxType,
      cgstAmount: totals.cgstAmount,
      sgstAmount: totals.sgstAmount,
      igstAmount: totals.igstAmount,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      amountInWords: totals.amountInWords,
      placeOfSupply: totals.placeOfSupply,
      placeOfSupplyCode: totals.placeOfSupplyCode,
    },
  };
};

const searchFilter = (numberField: string, search: unknown) =>
  search
    ? {
        OR: [
          { [numberField]: { contains: String(search), mode: 'insensitive' } },
          { clientName: { contains: String(search), mode: 'insensitive' } },
          { clientEmail: { contains: String(search), mode: 'insensitive' } },
          { clientCompany: { contains: String(search), mode: 'insensitive' } },
          { poNumber: { contains: String(search), mode: 'insensitive' } },
        ],
      }
    : {};

// -------------------------------------------------------------
// QUOTATIONS
// -------------------------------------------------------------

export const getQuotations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, search } = req.query;
    const where: any = { ...searchFilter('quotationNumber', search) };
    if (status && status !== 'ALL') where.status = status;

    // Expire quotations whose validity has passed (accepted/converted ones are kept as they are).
    await prisma.quotation.updateMany({
      where: { status: { in: ['SENT', 'VIEWED'] }, validUntil: { lt: startOfToday() } },
      data: { status: 'EXPIRED' },
    });

    const quotations = await prisma.quotation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        lead: { select: { id: true, leadNumber: true, clientName: true } },
        invoices: { select: { id: true, invoiceNumber: true, paymentStatus: true, totalAmount: true } },
      },
    });
    res.status(200).json({ status: 'success', data: quotations });
  } catch (error) {
    next(error);
  }
};

export const getQuotationById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertId(req.params.id, 'Quotation');
    const quotation = await prisma.quotation.findUnique({
      where: { id: req.params.id },
      include: { lead: true, invoices: true },
    });
    if (!quotation) throw new AppError('Quotation not found', 404);
    res.status(200).json({ status: 'success', data: quotation });
  } catch (error) {
    next(error);
  }
};

export const createQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = quotationDocumentSchema.parse(req.body);
    const { company, data } = await buildAmounts(body);

    const quotation = await prisma.quotation.create({
      data: {
        ...data,
        quotationNumber: await DocumentNumberService.next('QUO'),
        leadId: body.leadId || undefined,
        clientId: body.clientId || undefined,
        poNumber: body.poNumber,
        bankAccountId: body.bankAccountId,
        title: body.title,
        clientName: body.clientName,
        clientCompany: body.clientCompany,
        clientEmail: body.clientEmail,
        clientPhone: body.clientPhone,
        clientAddress: body.clientAddress,
        clientGst: body.clientGst,
        validUntil: body.validUntil,
        termsAndConditions: body.termsAndConditions ?? company.quotationTerms,
        notes: body.notes ?? company.defaultNotes,
        status: 'DRAFT',
      },
    });

    if (body.leadId) {
      await prisma.lead.update({ where: { id: body.leadId }, data: { status: 'PROPOSAL_SENT' } }).catch(() => null);
    }
    res.status(201).json({ status: 'success', data: quotation });
  } catch (error) {
    next(error);
  }
};

export const updateQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertId(req.params.id, 'Quotation');
    const existing = await prisma.quotation.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('Quotation not found', 404);
    if (existing.status === 'CONVERTED') {
      throw new AppError('This quotation has been converted to an invoice. Edit the invoice instead.', 400);
    }

    const body = quotationDocumentSchema.parse(req.body);
    const { data } = await buildAmounts(body);

    const quotation = await prisma.quotation.update({
      where: { id: existing.id },
      data: {
        ...data,
        leadId: body.leadId ?? existing.leadId,
        clientId: body.clientId,
        poNumber: body.poNumber,
        bankAccountId: body.bankAccountId,
        title: body.title,
        clientName: body.clientName,
        clientCompany: body.clientCompany,
        clientEmail: body.clientEmail,
        clientPhone: body.clientPhone,
        clientAddress: body.clientAddress,
        clientGst: body.clientGst,
        validUntil: body.validUntil,
        termsAndConditions: body.termsAndConditions,
        notes: body.notes,
        // Re-opening an expired quotation with a new validity date moves it back to SENT.
        status:
          body.status ??
          (existing.status === 'EXPIRED' && body.validUntil && body.validUntil >= startOfToday() ? 'SENT' : undefined),
      },
    });
    res.status(200).json({ status: 'success', data: quotation });
  } catch (error) {
    next(error);
  }
};

export const deleteQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertId(req.params.id, 'Quotation');
    await prisma.quotation.delete({ where: { id: req.params.id } });
    res.status(200).json({ status: 'success', message: 'Quotation deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// -------------------------------------------------------------
// INVOICES
// -------------------------------------------------------------

export const getInvoices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, search } = req.query;
    const where: any = { ...searchFilter('invoiceNumber', search) };
    if (status === 'DRAFT') where.isDraft = true;
    else if (status && status !== 'ALL') where.paymentStatus = status;

    // Keep OVERDUE up to date without a scheduler.
    await prisma.invoice.updateMany({
      where: { paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] }, isDraft: false, dueDate: { lt: startOfToday() } },
      data: { paymentStatus: 'OVERDUE' },
    });

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { quotation: { select: { id: true, quotationNumber: true } } },
    });
    res.status(200).json({ status: 'success', data: invoices });
  } catch (error) {
    next(error);
  }
};

export const getInvoiceById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertId(req.params.id, 'Invoice');
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: { quotation: true } });
    if (!invoice) throw new AppError('Invoice not found', 404);
    res.status(200).json({ status: 'success', data: invoice });
  } catch (error) {
    next(error);
  }
};

export const createInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = invoiceDocumentSchema.parse(req.body);
    const { company, data } = await buildAmounts(body);

    const issueDate = body.issueDate || new Date();
    const dueDate = body.dueDate || new Date(issueDate.getTime() + 15 * 24 * 60 * 60 * 1000);
    if (dueDate < issueDate) throw new AppError('Due date cannot be before the invoice date', 400);

    const paid = round2(Math.min(body.amountPaid, data.totalAmount));
    const payments = paid > 0
      ? [{ amount: paid, method: body.paymentMethod || 'BANK_TRANSFER', reference: body.paymentReference || null, date: issueDate, notes: 'Recorded when the invoice was created', recordedAt: new Date() }]
      : [];

    const invoice = await prisma.invoice.create({
      data: {
        ...data,
        invoiceNumber: await DocumentNumberService.next('INV'),
        quotationId: body.quotationId || undefined,
        clientId: body.clientId || undefined,
        poNumber: body.poNumber,
        bankAccountId: body.bankAccountId,
        clientName: body.clientName,
        clientCompany: body.clientCompany,
        clientEmail: body.clientEmail,
        clientPhone: body.clientPhone,
        clientGst: body.clientGst,
        billingAddress: body.billingAddress,
        issueDate,
        dueDate,
        isDraft: body.isDraft,
        amountPaid: paid,
        balanceDue: round2(data.totalAmount - paid),
        paymentStatus: computePaymentStatus(data.totalAmount, paid, dueDate, body.isDraft),
        paymentMethod: paid > 0 ? body.paymentMethod || 'BANK_TRANSFER' : undefined,
        paymentReference: paid > 0 ? body.paymentReference : undefined,
        payments: payments as any,
        termsAndConditions: body.termsAndConditions ?? company.invoiceTerms,
        notes: body.notes ?? company.defaultNotes,
      },
    });

    if (body.quotationId) {
      await prisma.quotation
        .updateMany({ where: { id: body.quotationId, status: { notIn: ['DECLINED', 'EXPIRED'] } }, data: { status: 'CONVERTED' } })
        .catch(() => null);
    }
    res.status(201).json({ status: 'success', data: invoice });
  } catch (error) {
    next(error);
  }
};

export const updateInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertId(req.params.id, 'Invoice');
    const existing = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('Invoice not found', 404);

    const body = invoiceDocumentSchema.parse(req.body);
    const { data } = await buildAmounts(body);
    const paid = Number(existing.amountPaid || 0);
    if (data.totalAmount + 0.005 < paid) {
      throw new AppError(`The new total is less than the ${paid.toLocaleString('en-IN')} already received.`, 400);
    }
    const issueDate = body.issueDate || existing.issueDate;
    const dueDate = body.dueDate || existing.dueDate;
    if (dueDate < issueDate) throw new AppError('Due date cannot be before the invoice date', 400);

    const invoice = await prisma.invoice.update({
      where: { id: existing.id },
      data: {
        ...data,
        clientId: body.clientId,
        poNumber: body.poNumber,
        bankAccountId: body.bankAccountId,
        clientName: body.clientName,
        clientCompany: body.clientCompany,
        clientEmail: body.clientEmail,
        clientPhone: body.clientPhone,
        clientGst: body.clientGst,
        billingAddress: body.billingAddress,
        issueDate,
        dueDate,
        isDraft: body.isDraft,
        balanceDue: round2(data.totalAmount - paid),
        paymentStatus:
          existing.paymentStatus === 'CANCELLED' ? 'CANCELLED' : computePaymentStatus(data.totalAmount, paid, dueDate, body.isDraft),
        termsAndConditions: body.termsAndConditions,
        notes: body.notes,
      },
    });
    res.status(200).json({ status: 'success', data: invoice });
  } catch (error) {
    next(error);
  }
};

export const recordPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertId(req.params.id, 'Invoice');
    const body = recordPaymentSchema.parse(req.body);
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!invoice) throw new AppError('Invoice not found', 404);
    if (invoice.paymentStatus === 'CANCELLED') throw new AppError('This invoice is cancelled', 400);

    const balance = round2(Number(invoice.totalAmount) - Number(invoice.amountPaid || 0));
    if (balance <= 0) throw new AppError('This invoice is already fully paid', 400);
    const amount = round2(body.paymentAmount);
    if (amount > balance + 0.005) {
      throw new AppError(`Payment is more than the balance due (${balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`, 400);
    }

    const newPaid = round2(Number(invoice.amountPaid || 0) + amount);
    const payments = [
      ...(Array.isArray(invoice.payments) ? (invoice.payments as any[]) : []),
      {
        amount,
        method: body.paymentMethod,
        reference: body.paymentReference,
        date: body.paymentDate || new Date(),
        notes: body.notes,
        recordedAt: new Date(),
        recordedBy: req.user?.email || null,
      },
    ];

    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        amountPaid: newPaid,
        balanceDue: round2(Number(invoice.totalAmount) - newPaid),
        paymentStatus: computePaymentStatus(Number(invoice.totalAmount), newPaid, invoice.dueDate, false),
        paymentMethod: body.paymentMethod,
        paymentReference: body.paymentReference ?? invoice.paymentReference,
        payments: payments as any,
        isDraft: false,
      },
    });

    // Finance module postings (unchanged behaviour)
    try {
      const bankLedger = await prisma.financeLedger.findFirst({ where: { name: 'HDFC Bank Current A/C' } });
      const receivableLedger = await prisma.financeLedger.findFirst({ where: { name: 'Client Accounts Receivable' } });
      if (bankLedger && receivableLedger) {
        const count = await prisma.financeVoucher.count();
        await prisma.financeVoucher.create({
          data: {
            voucherNumber: `VCH-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
            voucherType: 'RECEIPT',
            date: new Date(),
            debitLedgerId: bankLedger.id,
            creditLedgerId: receivableLedger.id,
            amount,
            narration: `Payment received for Invoice #${invoice.invoiceNumber} (${invoice.clientName}) via ${body.paymentMethod}`,
            referenceNo: body.paymentReference || invoice.invoiceNumber,
            invoiceId: invoice.id,
          },
        });
      }
    } catch (vErr) {
      console.warn('[CRM] Auto-voucher creation skipped:', vErr);
    }
    try {
      await (prisma as any).financeTransaction.create({
        data: {
          type: 'REVENUE',
          category: 'CLIENT_PAYMENT',
          amount,
          description: `Payment received for Tax Invoice #${invoice.invoiceNumber} (${invoice.clientName}) via ${body.paymentMethod}`,
          date: new Date(),
          reference: body.paymentReference || invoice.invoiceNumber,
          paidBy: invoice.clientName,
          status: 'COMPLETED',
        },
      });
    } catch (fErr) {
      console.warn('[CRM] FinanceTransaction recording skipped:', fErr);
    }
    aiEventBus
      .publish('PAYMENT_RECEIVED', {
        actor: 'Payment Ingestion Engine',
        entityId: updatedInvoice.id,
        entityType: 'INVOICE',
        data: {
          invoiceId: updatedInvoice.id,
          invoiceNumber: updatedInvoice.invoiceNumber,
          amount,
          paymentMethod: body.paymentMethod,
          paymentReference: body.paymentReference,
          clientName: updatedInvoice.clientName,
        },
      })
      .catch((err) => console.warn('[AiEventBus] Payment publish error:', err));

    res.status(200).json({ status: 'success', data: updatedInvoice });
  } catch (error) {
    next(error);
  }
};

export const cancelInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertId(req.params.id, 'Invoice');
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!invoice) throw new AppError('Invoice not found', 404);
    if (Number(invoice.amountPaid || 0) > 0) {
      throw new AppError('This invoice has payments recorded, so it cannot be cancelled.', 400);
    }
    const updated = await prisma.invoice.update({ where: { id: invoice.id }, data: { paymentStatus: 'CANCELLED' } });
    res.status(200).json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
};

export const deleteInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertId(req.params.id, 'Invoice');
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!invoice) throw new AppError('Invoice not found', 404);
    await prisma.invoice.delete({ where: { id: invoice.id } });
    // Let the quotation be converted again.
    if (invoice.quotationId) {
      const remaining = await prisma.invoice.count({ where: { quotationId: invoice.quotationId } });
      if (!remaining) {
        await prisma.quotation
          .updateMany({ where: { id: invoice.quotationId, status: 'CONVERTED' }, data: { status: 'ACCEPTED' } })
          .catch(() => null);
      }
    }
    res.status(200).json({ status: 'success', message: 'Invoice deleted successfully' });
  } catch (error) {
    next(error);
  }
};
