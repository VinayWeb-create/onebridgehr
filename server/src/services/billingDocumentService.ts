import crypto from 'crypto';
import QRCode from 'qrcode';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { emailService } from './emailService';
import { BillingPdfService, BillingDocKind, companyAddressLines, documentTotals, upiPaymentUri } from './billingPdfService';
import { BillingCompanyService, CompanyProfile, resolveBankAccount } from './billingCompanyService';
import { calculateBilling } from './billingCalc';
import { DocumentNumberService } from './documentNumberService';
import { escapeHtml, fmtDate, inr } from './billingFormat';

export type { BillingDocKind };

export const kindFromParam = (param: string): BillingDocKind => {
  if (param === 'quotations') return 'quotation';
  if (param === 'invoices') return 'invoice';
  throw new AppError('Unknown document type', 404);
};

const OBJECT_ID = /^[a-f0-9]{24}$/i;


export const frontendUrl = () =>
  (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

/** Normalise an Indian/international phone number for wa.me (digits only, with country code). */
export const normalizeWhatsAppNumber = (phone?: string | null): string | null => {
  let digits = (phone || '').replace(/[^0-9]/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? digits : null;
};

const numberOf = (kind: BillingDocKind, record: any): string =>
  kind === 'invoice' ? record.invoiceNumber : record.quotationNumber;

export class BillingDocumentService {
  // ---------------------------------------------------------------- loading

  public static async load(kind: BillingDocKind, id: string) {
    if (!OBJECT_ID.test(id)) throw new AppError(`${kind === 'invoice' ? 'Invoice' : 'Quotation'} not found`, 404);
    const record: any =
      kind === 'invoice'
        ? await prisma.invoice.findUnique({ where: { id } })
        : await prisma.quotation.findUnique({ where: { id }, include: { invoices: { select: { id: true, invoiceNumber: true } } } });
    if (!record) throw new AppError(`${kind === 'invoice' ? 'Invoice' : 'Quotation'} not found`, 404);
    const company = await BillingCompanyService.getForDocument(record.companyId);
    return { record, company, totals: documentTotals(record, company) };
  }

  public static async loadByToken(token: string) {
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new AppError('This link is invalid or has expired', 404);
    const quotation = await prisma.quotation.findFirst({ where: { shareToken: token } });
    if (quotation) {
      const company = await BillingCompanyService.getForDocument(quotation.companyId);
      return { kind: 'quotation' as const, record: quotation as any, company, totals: documentTotals(quotation, company) };
    }
    const invoice = await prisma.invoice.findFirst({ where: { shareToken: token } });
    if (invoice) {
      const company = await BillingCompanyService.getForDocument(invoice.companyId);
      return { kind: 'invoice' as const, record: invoice as any, company, totals: documentTotals(invoice, company) };
    }
    throw new AppError('This link is invalid or has expired', 404);
  }

  public static renderPdf(kind: BillingDocKind, record: any, company: CompanyProfile) {
    return BillingPdfService.render(kind, record, company);
  }

  // ---------------------------------------------------------------- share link

  public static async ensureShareToken(kind: BillingDocKind, record: any, rotate = false): Promise<string> {
    if (record.shareToken && !rotate) return record.shareToken;
    const shareToken = crypto.randomBytes(24).toString('base64url');
    if (kind === 'invoice') await prisma.invoice.update({ where: { id: record.id }, data: { shareToken } });
    else await prisma.quotation.update({ where: { id: record.id }, data: { shareToken } });
    record.shareToken = shareToken;
    return shareToken;
  }

  public static shareUrl(token: string) {
    return `${frontendUrl()}/p/${token}`;
  }

  // ---------------------------------------------------------------- drafts

  public static balanceDue(kind: BillingDocKind, record: any, total: number) {
    return kind === 'invoice' ? Math.max(0, Math.round((total - Number(record.amountPaid || 0)) * 100) / 100) : 0;
  }

  public static emailDraft(kind: BillingDocKind, record: any, company: CompanyProfile, total: number) {
    const number = numberOf(kind, record);
    const name = record.clientName || 'Sir/Madam';
    const cc = (company.emailCc || '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    if (kind === 'quotation') {
      return {
        to: record.clientEmail || '',
        cc,
        subject: `Quotation ${number} from ${company.name}`,
        message:
          `Dear ${name},\n\n` +
          `Thank you for your interest. Please find attached our quotation ${number} for ${inr(total)}` +
          (record.validUntil ? `, valid until ${fmtDate(record.validUntil)}` : '') +
          `.\n\nYou can view, download and accept it online using the button below.\n\n` +
          `Please let us know if you have any questions.\n\nRegards,\n${company.name}`,
      };
    }

    const balance = this.balanceDue(kind, record, total);
    const paid = balance <= 0 && total > 0;
    return {
      to: record.clientEmail || '',
      cc,
      subject: paid ? `Payment received – Invoice ${number} from ${company.name}` : `Invoice ${number} from ${company.name}`,
      message: paid
        ? `Dear ${name},\n\nThank you for your payment. Please find attached invoice ${number} for ${inr(total)}, marked as paid.\n\nRegards,\n${company.name}`
        : `Dear ${name},\n\nPlease find attached invoice ${number} dated ${fmtDate(record.issueDate)} for ${inr(total)}.\n` +
          `Amount due: ${inr(balance)}` +
          (record.dueDate ? ` by ${fmtDate(record.dueDate)}` : '') +
          `.\n\nYou can view the invoice and pay by UPI or bank transfer using the button below.\n\nRegards,\n${company.name}`,
    };
  }

  public static whatsappDraft(kind: BillingDocKind, record: any, company: CompanyProfile, total: number, link: string) {
    const number = numberOf(kind, record);
    const name = record.clientName || 'there';
    if (kind === 'quotation') {
      return (
        `Hello ${name},\n\nHere is quotation ${number} from ${company.name} for ${inr(total)}` +
        (record.validUntil ? ` (valid until ${fmtDate(record.validUntil)})` : '') +
        `.\n\nView, download or accept it here:\n${link}\n\nRegards,\n${company.name}`
      );
    }
    const balance = this.balanceDue(kind, record, total);
    if (balance <= 0 && total > 0) {
      return `Hello ${name},\n\nThank you for your payment! Invoice ${number} for ${inr(total)} is marked as paid.\n\nView or download it here:\n${link}\n\nRegards,\n${company.name}`;
    }
    return (
      `Hello ${name},\n\nInvoice ${number} from ${company.name} for ${inr(total)}.\n` +
      `Amount due: ${inr(balance)}${record.dueDate ? ` by ${fmtDate(record.dueDate)}` : ''}.\n\n` +
      `View, download or pay by UPI here:\n${link}\n` +
      (company.upiId ? `\nUPI ID: ${company.upiId}\n` : '') +
      `\nRegards,\n${company.name}`
    );
  }

  private static emailHtml(opts: {
    company: CompanyProfile;
    message: string;
    rows: [string, string][];
    link?: string;
    linkLabel: string;
  }) {
    const paragraphs = escapeHtml(opts.message)
      .split(/\n{2,}/)
      .map((p) => `<p style="margin:0 0 14px 0;">${p.replace(/\n/g, '<br/>')}</p>`)
      .join('');
    const rows = opts.rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:4px 12px 4px 0;color:#64748b;">${escapeHtml(k)}</td><td style="padding:4px 0;font-weight:bold;color:#0f172a;">${escapeHtml(v)}</td></tr>`
      )
      .join('');
    const button = opts.link
      ? `<div style="text-align:center;margin:22px 0;"><a href="${escapeHtml(opts.link)}" style="background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:6px;font-weight:bold;display:inline-block;">${escapeHtml(opts.linkLabel)}</a></div>`
      : '';
    return `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#334155;line-height:1.6;">
        <div style="background:#1e1b4b;padding:20px 24px;border-radius:8px 8px 0 0;">
          <div style="color:#ffffff;font-size:18px;font-weight:bold;">${escapeHtml(opts.company.name)}</div>
        </div>
        <div style="padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;background:#ffffff;">
          ${paragraphs}
          <table style="background:#f8fafc;border-radius:6px;padding:10px 14px;margin:6px 0 4px 0;font-size:14px;">${rows}</table>
          ${button}
          <p style="font-size:12px;color:#94a3b8;margin-top:24px;">${escapeHtml(
            [opts.company.email, opts.company.phone].filter(Boolean).join(' · ')
          )}</p>
        </div>
      </div>`;
  }

  // ---------------------------------------------------------------- email

  public static async sendEmail(
    kind: BillingDocKind,
    id: string,
    input: { to: string; cc?: string[]; subject: string; message: string; attachPdf?: boolean; includeLink?: boolean }
  ): Promise<{ sent: boolean; error?: string }> {
    const { record, company, totals } = await this.load(kind, id);
    const number = numberOf(kind, record);
    const link = input.includeLink !== false ? this.shareUrl(await this.ensureShareToken(kind, record)) : undefined;
    const balance = this.balanceDue(kind, record, totals.totalAmount);

    const rows: [string, string][] = [[kind === 'invoice' ? 'Invoice No' : 'Quotation No', number]];
    rows.push(['Total', inr(totals.totalAmount)]);
    if (kind === 'invoice') {
      rows.push(['Amount due', inr(balance)]);
      if (record.dueDate && balance > 0) rows.push(['Due date', fmtDate(record.dueDate)]);
    } else if (record.validUntil) {
      rows.push(['Valid until', fmtDate(record.validUntil)]);
    }

    const html = this.emailHtml({
      company,
      message: input.message,
      rows,
      link,
      linkLabel: kind === 'invoice' ? (balance > 0 ? 'View & Pay Invoice' : 'View Invoice') : 'View & Accept Quotation',
    });

    const attachments = input.attachPdf !== false
      ? [{ filename: BillingPdfService.fileName(kind, record), content: await BillingPdfService.render(kind, record, company), contentType: 'application/pdf' }]
      : [];

    let sent = false;
    let error: string | undefined;
    try {
      const result = await emailService.sendMail(input.to, input.subject, html, attachments, {
        cc: input.cc,
        fromName: company.name,
        replyTo: company.email || undefined,
      });
      if (result?.skipped) error = 'Email sending is turned off on this server (DISABLE_EMAILS). Nothing was sent.';
      else if (result?.success === false) error = result.error || 'Email could not be delivered';
      else sent = true;
    } catch (err: any) {
      error = err?.message || 'Email could not be delivered';
    }

    await prisma.communicationLog.create({
      data: {
        channel: 'EMAIL',
        recipient: [input.to, ...(input.cc || [])].join(', '),
        recipientName: record.clientName,
        subject: input.subject,
        messageBody: input.message,
        status: sent ? 'SENT' : 'FAILED',
        errorMessage: error,
        referenceId: record.id,
        metadata: { kind, number, attachPdf: input.attachPdf !== false, link: link || null },
      },
    });

    if (sent) {
      if (kind === 'invoice') {
        await prisma.invoice.update({ where: { id: record.id }, data: { sentViaEmail: true, isDraft: false } });
      } else {
        await prisma.quotation.update({
          where: { id: record.id },
          data: { sentViaEmail: true, lastSentAt: new Date(), status: record.status === 'DRAFT' ? 'SENT' : undefined },
        });
      }
    }
    return { sent, error };
  }

  // ---------------------------------------------------------------- WhatsApp

  public static async prepareWhatsApp(kind: BillingDocKind, id: string, input: { phone?: string; message?: string }) {
    const { record, company, totals } = await this.load(kind, id);
    const link = this.shareUrl(await this.ensureShareToken(kind, record));
    const phone = normalizeWhatsAppNumber(input.phone || record.clientPhone);
    if (!phone) throw new AppError('Enter a valid WhatsApp number (10-digit mobile or with country code)', 400);

    const message = (input.message || '').trim() || this.whatsappDraft(kind, record, company, totals.totalAmount, link);
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

    await prisma.communicationLog.create({
      data: {
        channel: 'WHATSAPP',
        recipient: `+${phone}`,
        recipientName: record.clientName,
        messageBody: message,
        status: 'QUEUED', // opened in WhatsApp; the admin presses send there
        referenceId: record.id,
        metadata: { kind, number: numberOf(kind, record), link },
      },
    });

    if (kind === 'invoice') {
      await prisma.invoice.update({ where: { id: record.id }, data: { sentViaWhatsApp: true, isDraft: false } });
    } else {
      await prisma.quotation.update({
        where: { id: record.id },
        data: { sentViaWhatsApp: true, lastSentAt: new Date(), status: record.status === 'DRAFT' ? 'SENT' : undefined },
      });
    }
    return { whatsappUrl, phone, message, link };
  }

  // ---------------------------------------------------------------- public view

  public static async publicView(kind: BillingDocKind, record: any, company: CompanyProfile, totals: ReturnType<typeof documentTotals>) {
    const balance = this.balanceDue(kind, record, totals.totalAmount);
    // UPI payment only on invoices: a quotation's total isn't necessarily what's payable now.
    const payable = kind === 'invoice' ? balance : 0;
    const bank = resolveBankAccount(company, record.bankAccountId);
    const upiUri = company.upiId && payable > 0 ? upiPaymentUri(company, payable, numberOf(kind, record)) : null;
    return {
      kind,
      number: numberOf(kind, record),
      title: kind === 'quotation' ? record.title || 'Quotation' : totals.taxAmount > 0 ? 'Tax Invoice' : 'Invoice',
      status: kind === 'quotation' ? record.status : record.paymentStatus,
      date: kind === 'invoice' ? record.issueDate : record.createdAt,
      dueDate: kind === 'invoice' ? record.dueDate : null,
      validUntil: kind === 'quotation' ? record.validUntil : null,
      poNumber: record.poNumber || null,
      acceptedAt: record.acceptedAt || null,
      acceptedBy: record.acceptedBy || null,
      canAccept:
        kind === 'quotation' &&
        ['DRAFT', 'SENT', 'VIEWED'].includes(record.status) &&
        (!record.validUntil || new Date(record.validUntil).getTime() >= new Date().setHours(0, 0, 0, 0)),
      client: {
        name: record.clientName,
        company: record.clientCompany || null,
        address: (kind === 'invoice' ? record.billingAddress : record.clientAddress) || null,
        gstin: record.clientGst || null,
      },
      company: {
        name: company.name,
        addressLines: companyAddressLines(company),
        gstin: company.gstin,
        email: company.email,
        phone: company.phone,
        logoDataUrl: company.logoDataUrl,
        bankAccountName: bank?.accountName ?? null,
        bankName: bank?.bankName ?? null,
        bankAccountNumber: bank?.accountNumber ?? null,
        bankIfsc: bank?.ifsc ?? null,
        bankBranch: bank?.branch ?? null,
        upiId: company.upiId,
      },
      items: totals.items,
      totals: {
        subTotal: totals.subTotal,
        discountAmount: totals.discountAmount,
        taxableAmount: totals.taxableAmount,
        taxType: totals.taxType,
        cgstAmount: totals.cgstAmount,
        sgstAmount: totals.sgstAmount,
        igstAmount: totals.igstAmount,
        additionalCharges: totals.additionalCharges,
        additionalChargesLabel: record.additionalChargesLabel || null,
        totalAmount: totals.totalAmount,
        amountInWords: totals.amountInWords,
        placeOfSupply: totals.placeOfSupply,
        amountPaid: kind === 'invoice' ? Number(record.amountPaid || 0) : 0,
        balanceDue: balance,
      },
      upiUri,
      upiQrDataUrl: upiUri ? await QRCode.toDataURL(upiUri, { margin: 1, width: 240 }) : null,
      termsAndConditions: record.termsAndConditions || (kind === 'invoice' ? company.invoiceTerms : company.quotationTerms) || null,
      notes: record.notes || null,
    };
  }

  public static async recordView(kind: BillingDocKind, record: any) {
    const now = new Date();
    if (kind === 'invoice') {
      await prisma.invoice.update({ where: { id: record.id }, data: { viewCount: { increment: 1 }, viewedAt: record.viewedAt || now } });
    } else {
      await prisma.quotation.update({
        where: { id: record.id },
        data: {
          viewCount: { increment: 1 },
          viewedAt: record.viewedAt || now,
          status: record.status === 'SENT' ? 'VIEWED' : undefined,
        },
      });
    }
  }

  // ---------------------------------------------------------------- accept & convert

  /** Mark a quotation accepted (by the client via the share link, or by an admin). */
  public static async acceptQuotation(record: any, acceptedBy: string) {
    if (['ACCEPTED', 'CONVERTED'].includes(record.status)) return record;
    if (!['DRAFT', 'SENT', 'VIEWED'].includes(record.status)) {
      throw new AppError(`This quotation is ${String(record.status).toLowerCase()} and can no longer be accepted`, 400);
    }
    const updated = await prisma.quotation.update({
      where: { id: record.id },
      data: { status: 'ACCEPTED', acceptedAt: new Date(), acceptedBy: acceptedBy.slice(0, 120) },
    });
    if (record.leadId) {
      await prisma.lead.update({ where: { id: record.leadId }, data: { status: 'WON' } }).catch(() => null);
    }
    return updated;
  }

  /**
   * Create an invoice from a quotation. Safe to call twice: the second call returns the existing invoice.
   */
  public static async convertQuotationToInvoice(quotationId: string, opts: { dueInDays?: number } = {}) {
    const { record: quotation, company } = await this.load('quotation', quotationId);

    const existing = await prisma.invoice.findFirst({ where: { quotationId }, orderBy: { createdAt: 'asc' } });
    if (existing) return { invoice: existing, created: false };
    if (['DECLINED', 'EXPIRED'].includes(quotation.status)) {
      throw new AppError(`A ${quotation.status.toLowerCase()} quotation cannot be converted`, 400);
    }

    // Claim the conversion so two simultaneous requests don't both create an invoice.
    const claim = await prisma.quotation.updateMany({
      where: { id: quotationId, status: { not: 'CONVERTED' } },
      data: { status: 'CONVERTED' },
    });
    if (claim.count === 0) {
      const again = await prisma.invoice.findFirst({ where: { quotationId } });
      if (again) return { invoice: again, created: false };
      // Another request claimed it a moment ago and is still creating the invoice.
      if (quotation.status !== 'CONVERTED') {
        throw new AppError('This quotation is already being converted. Refresh in a moment to see the invoice.', 409);
      }
      // Otherwise it was marked converted earlier but its invoice no longer exists: create it again.
    }

    try {
      const totals = calculateBilling({
        items: (quotation.items as any[]) || [],
        taxPercent: quotation.taxPercent,
        discountAmount: quotation.discountAmount,
        additionalCharges: quotation.additionalCharges,
        placeOfSupplyCode: quotation.placeOfSupplyCode,
        clientGst: quotation.clientGst,
        supplierStateCode: company.stateCode,
      });
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber: await DocumentNumberService.next('INV'),
          quotationId,
          companyId: quotation.companyId ?? company.id ?? undefined,
          clientId: quotation.clientId ?? undefined,
          poNumber: quotation.poNumber ?? undefined,
          bankAccountId: quotation.bankAccountId ?? undefined,
          clientName: quotation.clientName,
          clientCompany: quotation.clientCompany,
          clientEmail: quotation.clientEmail,
          clientPhone: quotation.clientPhone,
          clientGst: quotation.clientGst,
          billingAddress: quotation.clientAddress,
          items: totals.items as any,
          subTotal: totals.subTotal,
          taxPercent: quotation.taxPercent,
          taxAmount: totals.taxAmount,
          discountAmount: totals.discountAmount,
          additionalCharges: totals.additionalCharges,
          additionalChargesLabel: quotation.additionalChargesLabel,
          cgstAmount: totals.cgstAmount,
          sgstAmount: totals.sgstAmount,
          igstAmount: totals.igstAmount,
          taxType: totals.taxType,
          placeOfSupply: totals.placeOfSupply,
          placeOfSupplyCode: totals.placeOfSupplyCode,
          amountInWords: totals.amountInWords,
          totalAmount: totals.totalAmount,
          amountPaid: 0,
          balanceDue: totals.totalAmount,
          dueDate: new Date(Date.now() + (opts.dueInDays ?? 15) * 24 * 60 * 60 * 1000),
          paymentStatus: 'UNPAID',
          isDraft: false,
          notes: `Against Quotation ${quotation.quotationNumber}.`,
          termsAndConditions: company.invoiceTerms || undefined,
        },
      });
      return { invoice, created: true };
    } catch (err) {
      // Release the claim so the conversion can be retried.
      await prisma.quotation.update({ where: { id: quotationId }, data: { status: quotation.status } }).catch(() => null);
      throw err;
    }
  }

  /** In-app notification + email to super admins when a client accepts online. */
  public static async notifyAdminsOfAcceptance(record: any, company: CompanyProfile, acceptedBy: string) {
    const message = `${acceptedBy} accepted quotation ${record.quotationNumber} (${record.clientCompany || record.clientName}) online.`;
    try {
      const admins = await prisma.user.findMany({ where: { role: 'SUPER_ADMIN' }, select: { employeeId: true } });
      const employeeIds = admins.map((a: any) => a.employeeId).filter(Boolean);
      if (employeeIds.length) {
        await prisma.notification.createMany({
          data: employeeIds.map((employeeId: string) => ({ employeeId, title: 'Quotation accepted', message })),
        });
      }
    } catch (err) {
      console.warn('[Billing] Could not create acceptance notification:', err);
    }
    const to = process.env.ADMIN_NOTIFY_EMAIL || company.email;
    if (to) {
      // Not awaited: a slow mail server must not keep the client's Accept click waiting.
      void emailService
        .sendMail(to, `Quotation ${record.quotationNumber} accepted`, `<p>${escapeHtml(message)}</p><p>Open the CRM to convert it into an invoice.</p>`, [], {
          fromName: company.name,
        })
        .catch(() => null);
    }
  }
}
