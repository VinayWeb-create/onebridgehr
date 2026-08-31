import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { BillingPdfService } from '../services/billingPdfService';
import { CommunicationService } from '../services/communicationService';
import { aiEventBus } from '../services/ai/aiEventBus';

// -------------------------------------------------------------
// LEADS CONTROLLERS
// -------------------------------------------------------------

export const getLeads = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, service, search } = req.query;
    const filter: any = {};

    if (status && status !== 'ALL') {
      if (status === 'PIPELINE') {
        filter.status = { in: ['NEW', 'CONTACTED'] };
      } else if (status === 'PROPOSALS') {
        filter.status = { in: ['PROPOSAL_REQUESTED', 'PROPOSAL_SENT', 'PROPOSAL_ACCEPTED'] };
      } else if (status === 'CONSULTATIONS') {
        filter.status = { in: ['DEMO_SCHEDULED', 'DEMO_COMPLETED'] };
      } else {
        filter.status = status;
      }
    }

    if (service && service !== 'ALL') {
      filter.serviceOfInterest = String(service);
    }

    if (search) {
      filter.OR = [
        { clientName: { contains: String(search), mode: 'insensitive' } },
        { companyName: { contains: String(search), mode: 'insensitive' } },
        { email: { contains: String(search), mode: 'insensitive' } },
        { phone: { contains: String(search), mode: 'insensitive' } },
        { serviceOfInterest: { contains: String(search), mode: 'insensitive' } },
        { projectDetails: { contains: String(search), mode: 'insensitive' } },
        { notes: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const leads = await (prisma as any).lead.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' },
      include: {
        quotations: {
          select: {
            id: true,
            quotationNumber: true,
            totalAmount: true,
            status: true,
          },
        },
      },
    });

    res.status(200).json({ status: 'success', data: leads });
  } catch (error) {
    next(error);
  }
};

export const createLead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      clientName,
      companyName,
      email,
      phone,
      serviceOfInterest,
      projectDetails,
      timeline,
      source,
      status,
      estimatedValue,
      notes,
      followUpDate,
    } = req.body;

    const count = await (prisma as any).lead.count();
    const leadNumber = `LED-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const lead = await (prisma as any).lead.create({
      data: {
        leadNumber,
        clientName,
        companyName,
        email,
        phone,
        serviceOfInterest: serviceOfInterest || null,
        projectDetails: projectDetails || null,
        timeline: timeline || null,
        source: source || 'WEBSITE',
        status: status || 'NEW',
        estimatedValue: Number(estimatedValue || 0),
        notes,
        followUpDate: followUpDate ? new Date(followUpDate) : null,
      },
    });

    // Auto-send welcome & discovery email if requested (default true)
    if (req.body.autoSendEmail !== false && lead.email) {
      CommunicationService.sendLeadWelcomeEmail(lead).catch((err) =>
        console.warn('[CRM] Auto-welcome email for lead failed:', err)
      );
    }

    // Trigger Autonomous Multi-Agent Workforce Pipeline (Ava -> Scott -> Paige -> Fiona -> Chase)
    aiEventBus.publish('LEAD_CREATED', {
      actor: 'Inbound CRM',
      entityId: lead.id,
      entityType: 'LEAD',
      data: { lead },
    }).catch((err) => console.warn('[AiEventBus] Publish error:', err));

    res.status(201).json({ status: 'success', data: lead });
  } catch (error) {
    next(error);
  }
};

/**
 * Public endpoint for website contact form submissions (https://www.onebridgeinfotech.com/contact)
 */
export const submitWebsiteInquiry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      clientName,
      fullName,
      name,
      email,
      businessEmail,
      companyName,
      company,
      phone,
      serviceOfInterest,
      service,
      projectDetails,
      message,
      notes,
      timeline,
      estimatedValue,
      source,
    } = req.body;

    const finalName = clientName || fullName || name;
    const finalEmail = email || businessEmail;
    const finalPhone = phone;
    const finalCompany = companyName || company || '';
    const finalService = serviceOfInterest || service || 'General Inquiry';
    const finalDetails = projectDetails || message || notes || '';
    const finalTimeline = timeline || 'Flexible';

    if (!finalName || !finalEmail || !finalPhone) {
      res.status(400).json({
        status: 'error',
        message: 'Full Name, Business Email, and Phone number are required to submit an inquiry.',
      });
      return;
    }

    const count = await (prisma as any).lead.count();
    const leadNumber = `LED-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const lead = await (prisma as any).lead.create({
      data: {
        leadNumber,
        clientName: finalName.trim(),
        companyName: finalCompany.trim() || null,
        email: finalEmail.trim().toLowerCase(),
        phone: String(finalPhone).trim(),
        serviceOfInterest: finalService,
        projectDetails: finalDetails,
        timeline: finalTimeline,
        source: source || 'WEBSITE',
        status: 'NEW',
        estimatedValue: Number(estimatedValue || 0),
        notes: `Website Contact Inquiry for [${finalService}] | Timeline: ${finalTimeline}${finalCompany ? ` | Company: ${finalCompany}` : ''}`,
      },
    });

    // Create system notification for Super Admins
    try {
      const superAdmins = await prisma.user.findMany({
        where: { role: 'SUPER_ADMIN' },
        select: { employeeId: true },
      });

      for (const admin of superAdmins) {
        if (admin.employeeId) {
          await prisma.notification.create({
            data: {
              employeeId: admin.employeeId,
              title: `New Website Lead: ${finalName} (${finalService})`,
              message: `${finalName}${finalCompany ? ` from ${finalCompany}` : ''} requested info on ${finalService}. Phone: ${finalPhone}`,
            },
          });
        }
      }
    } catch (notifErr) {
      console.warn('Could not create notification for lead:', notifErr);
    }

    // Auto-send personalized welcome & discovery email to prospective client
    CommunicationService.sendLeadWelcomeEmail(lead).catch((err) =>
      console.warn('[CRM] Website inquiry welcome email failed:', err)
    );

    // Auto-alert admins about high priority lead
    CommunicationService.sendLeadAdminAlertEmail(lead).catch((err) =>
      console.warn('[CRM] Website inquiry admin alert email failed:', err)
    );

    // Trigger Autonomous Multi-Agent Workforce Pipeline (Ava -> Scott -> Paige -> Fiona -> Chase)
    aiEventBus.publish('LEAD_CREATED', {
      actor: 'Website Ingestion (onebridgeinfotech.com/contact)',
      entityId: lead.id,
      entityType: 'LEAD',
      data: { lead },
    }).catch((err) => console.warn('[AiEventBus] Publish error:', err));

    res.status(201).json({
      status: 'success',
      message: "Thank you for reaching out! We'll respond within one business day with next steps.",
      data: {
        leadNumber: lead.leadNumber,
        clientName: lead.clientName,
        email: lead.email,
        serviceOfInterest: lead.serviceOfInterest,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const submitProposalRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { leadId } = req.params;
    const formData = req.body;

    const existingLead = await (prisma as any).lead.findUnique({ where: { id: leadId } });
    if (!existingLead) {
      res.status(404).json({ error: 'Lead not found or invalid link.' });
      return;
    }

    const lead = await (prisma as any).lead.update({
      where: { id: leadId },
      data: {
        status: 'PROPOSAL_REQUESTED',
        projectDetails: `Business Goals: ${formData.businessGoals}\nChallenges: ${formData.currentProblems}\nExpected Solution: ${formData.expectedSolution}\nBudget: ${formData.budget}\nTimeline: ${formData.expectedTimeline}\nTech: ${formData.preferredTechnology}\nNotes: ${formData.additionalNotes}`,
      },
    });

    CommunicationService.sendProposalRequestConfirmation(lead).catch((err) =>
      console.warn('[CRM] Proposal confirmation email failed:', err)
    );

    res.status(200).json({ status: 'success', data: lead });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Lead not found or invalid link.' });
      return;
    }
    next(error);
  }
};

export const submitDemoBooking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { leadId } = req.params;
    const formData = req.body;

    const lead = await (prisma as any).lead.update({
      where: { id: leadId },
      data: {
        status: 'DEMO_SCHEDULED',
        notes: `Demo Type: ${formData.type}\nDate: ${formData.date}\nTime: ${formData.time}\nParticipants: ${formData.participants}\nPurpose: ${formData.purpose}\nLocation: ${formData.officeLocation || 'Online'}`,
      },
    });

    CommunicationService.sendDemoConfirmation(lead, formData).catch((err) =>
      console.warn('[CRM] Demo confirmation email failed:', err)
    );

    res.status(200).json({ status: 'success', data: lead });
  } catch (error) {
    next(error);
  }
};

export const sendLeadEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const lead = await (prisma as any).lead.findUnique({ where: { id } });
    if (!lead) {
      res.status(404).json({ status: 'fail', message: 'Lead not found' });
      return;
    }

    const sent = await CommunicationService.sendLeadWelcomeEmail(lead);
    res.status(200).json({
      status: 'success',
      message: sent ? `Email dispatched to ${lead.email}` : `Email logged/queued for ${lead.email}`,
    });
  } catch (error) {
    next(error);
  }
};

export const updateLead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      clientName,
      companyName,
      email,
      phone,
      serviceOfInterest,
      projectDetails,
      timeline,
      source,
      status,
      estimatedValue,
      notes,
      followUpDate,
    } = req.body;

    const lead = await (prisma as any).lead.update({
      where: { id },
      data: {
        clientName,
        companyName,
        email,
        phone,
        serviceOfInterest,
        projectDetails,
        timeline,
        source,
        status,
        estimatedValue: estimatedValue !== undefined ? Number(estimatedValue) : undefined,
        notes,
        followUpDate: followUpDate ? new Date(followUpDate) : undefined,
      },
    });

    res.status(200).json({ status: 'success', data: lead });
  } catch (error) {
    next(error);
  }
};

export const deleteLead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    await (prisma as any).lead.delete({ where: { id } });
    res.status(200).json({ status: 'success', message: 'Lead deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// -------------------------------------------------------------
// QUOTATIONS CONTROLLERS
// -------------------------------------------------------------

export const getQuotations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, search } = req.query;
    const filter: any = {};

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    if (search) {
      filter.OR = [
        { quotationNumber: { contains: String(search), mode: 'insensitive' } },
        { clientName: { contains: String(search), mode: 'insensitive' } },
        { clientEmail: { contains: String(search), mode: 'insensitive' } },
        { clientCompany: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const quotations = await prisma.quotation.findMany({
      where: filter,
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
    const { id } = req.params;
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: { lead: true, invoices: true },
    });

    if (!quotation) {
      res.status(404).json({ status: 'fail', message: 'Quotation not found' });
      return;
    }

    res.status(200).json({ status: 'success', data: quotation });
  } catch (error) {
    next(error);
  }
};

export const createQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      leadId,
      clientName,
      clientCompany,
      clientEmail,
      clientPhone,
      clientAddress,
      clientGst,
      items,
      taxPercent = 18,
      discountAmount = 0,
      validUntil,
      termsAndConditions,
      notes,
    } = req.body;

    const count = await prisma.quotation.count();
    const quotationNumber = `QUO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const lineItems = Array.isArray(items) ? items : [];
    const subTotal = lineItems.reduce((sum: number, it: any) => sum + (Number(it.amount) || Number(it.quantity) * Number(it.unitPrice) || 0), 0);
    const taxRate = Number(taxPercent) || 0;
    const taxAmount = (subTotal * taxRate) / 100;
    const discount = Number(discountAmount) || 0;
    const totalAmount = Math.max(0, subTotal + taxAmount - discount);

    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber,
        leadId: leadId || undefined,
        clientName,
        clientCompany,
        clientEmail,
        clientPhone,
        clientAddress,
        clientGst,
        items: lineItems,
        subTotal,
        taxPercent: taxRate,
        taxAmount,
        discountAmount: discount,
        totalAmount,
        validUntil: validUntil ? new Date(validUntil) : null,
        termsAndConditions,
        notes,
        status: 'DRAFT',
      },
    });

    const pdfUrl = await BillingPdfService.generateQuotationPdf(quotation);
    const updatedQuotation = await prisma.quotation.update({
      where: { id: quotation.id },
      data: { pdfUrl },
    });

    if (leadId) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { status: 'PROPOSAL_SENT' },
      }).catch(() => null);
    }

    res.status(201).json({ status: 'success', data: updatedQuotation });
  } catch (error) {
    next(error);
  }
};

export const updateQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      clientName,
      clientCompany,
      clientEmail,
      clientPhone,
      clientAddress,
      clientGst,
      items,
      taxPercent,
      discountAmount,
      validUntil,
      termsAndConditions,
      notes,
      status,
    } = req.body;

    const lineItems = Array.isArray(items) ? items : [];
    const subTotal = lineItems.reduce((sum: number, it: any) => sum + (Number(it.amount) || Number(it.quantity) * Number(it.unitPrice) || 0), 0);
    const taxRate = Number(taxPercent ?? 18);
    const taxAmount = (subTotal * taxRate) / 100;
    const discount = Number(discountAmount ?? 0);
    const totalAmount = Math.max(0, subTotal + taxAmount - discount);

    const quotation = await prisma.quotation.update({
      where: { id },
      data: {
        clientName,
        clientCompany,
        clientEmail,
        clientPhone,
        clientAddress,
        clientGst,
        items: lineItems.length > 0 ? lineItems : undefined,
        subTotal: lineItems.length > 0 ? subTotal : undefined,
        taxPercent: taxRate,
        taxAmount: lineItems.length > 0 ? taxAmount : undefined,
        discountAmount: discount,
        totalAmount: lineItems.length > 0 ? totalAmount : undefined,
        validUntil: validUntil ? new Date(validUntil) : undefined,
        termsAndConditions,
        notes,
        status,
      },
    });

    const pdfUrl = await BillingPdfService.generateQuotationPdf(quotation);
    const finalQuotation = await prisma.quotation.update({
      where: { id },
      data: { pdfUrl },
    });

    res.status(200).json({ status: 'success', data: finalQuotation });
  } catch (error) {
    next(error);
  }
};

export const acceptQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const quotation = await prisma.quotation.findUnique({ where: { id } });
    if (!quotation) {
      res.status(404).json({ status: 'fail', message: 'Quotation not found' });
      return;
    }

    // 1. Mark Quotation as ACCEPTED
    await prisma.quotation.update({
      where: { id },
      data: { status: 'ACCEPTED' },
    });

    if (quotation.leadId) {
      await prisma.lead.update({
        where: { id: quotation.leadId },
        data: { status: 'WON' },
      }).catch(() => null);
    }

    // 2. Automatically generate the official Tax Invoice
    const count = await prisma.invoice.count();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    const dueDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        quotationId: quotation.id,
        clientName: quotation.clientName,
        clientCompany: quotation.clientCompany,
        clientEmail: quotation.clientEmail,
        clientPhone: quotation.clientPhone,
        clientGst: quotation.clientGst,
        billingAddress: quotation.clientAddress,
        items: (quotation.items as any) || [],
        subTotal: quotation.subTotal,
        taxPercent: quotation.taxPercent,
        taxAmount: quotation.taxAmount,
        discountAmount: quotation.discountAmount,
        totalAmount: quotation.totalAmount,
        amountPaid: 0,
        balanceDue: quotation.totalAmount,
        dueDate,
        paymentStatus: 'UNPAID',
        notes: `Official Tax Invoice auto-generated upon acceptance of Quotation #${quotation.quotationNumber}.`,
        termsAndConditions: '1. Net 15 payment terms.\n2. Please quote invoice number on bank remittance.\n3. Taxes calculated as per GST regulations.',
        sentViaEmail: true,
      },
    });

    const pdfUrl = await BillingPdfService.generateInvoicePdf(invoice);
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { pdfUrl },
    });

    // 3. Auto-send Invoice & Payment coordinates to client
    if (invoice.clientEmail) {
      await CommunicationService.sendInvoiceEmail(invoice, pdfUrl);
    }

    // 4. Emit PROPOSAL_ACCEPTED on AI Event Bus
    aiEventBus.publish('PROPOSAL_ACCEPTED', {
      actor: 'Quotation Acceptance Automation',
      entityId: quotation.id,
      entityType: 'QUOTATION',
      data: {
        quotationId: quotation.id,
        quotationNumber: quotation.quotationNumber,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: invoice.totalAmount,
        clientName: invoice.clientName,
      },
    }).catch(console.warn);

    res.status(200).json({
      status: 'success',
      message: `Quotation accepted! Tax Invoice #${invoice.invoiceNumber} generated and emailed with payment coordinates.`,
      data: { quotation, invoice },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.quotation.delete({ where: { id } });
    res.status(200).json({ status: 'success', message: 'Quotation deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const sendQuotationEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const quotation = await prisma.quotation.findUnique({ where: { id } });
    if (!quotation) {
      res.status(404).json({ status: 'fail', message: 'Quotation not found' });
      return;
    }

    let pdfUrl = quotation.pdfUrl;
    if (!pdfUrl) {
      pdfUrl = await BillingPdfService.generateQuotationPdf(quotation);
    }

    const success = await CommunicationService.sendQuotationEmail(quotation, pdfUrl);

    await prisma.quotation.update({
      where: { id },
      data: {
        sentViaEmail: true,
        lastSentAt: new Date(),
        status: quotation.status === 'DRAFT' ? 'SENT' : quotation.status,
      },
    });

    res.status(200).json({
      status: success ? 'success' : 'partial',
      message: success ? 'Quotation emailed to client successfully' : 'Email dispatch queued or simulated',
    });
  } catch (error) {
    next(error);
  }
};

export const sendQuotationWhatsApp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const quotation = await prisma.quotation.findUnique({ where: { id } });
    if (!quotation) {
      res.status(404).json({ status: 'fail', message: 'Quotation not found' });
      return;
    }

    if (!quotation.clientPhone) {
      res.status(400).json({ status: 'fail', message: 'Client phone number is missing' });
      return;
    }

    const text = `Hello ${quotation.clientName},\n\nWe have prepared your quotation #${quotation.quotationNumber} from OneBridge Infotech for ₹${Number(quotation.totalAmount).toLocaleString('en-IN')}.\n\nPlease review it and let us know if you have any questions.\n\nBest regards,\nOneBridge Infotech`;
    const result = await CommunicationService.sendWhatsAppNotification(quotation.clientPhone, text, quotation.id, quotation.clientName);

    await prisma.quotation.update({
      where: { id },
      data: {
        sentViaWhatsApp: true,
        lastSentAt: new Date(),
        status: quotation.status === 'DRAFT' ? 'SENT' : quotation.status,
      },
    });

    res.status(200).json({
      status: 'success',
      message: 'WhatsApp notification prepared',
      whatsappUrl: result.whatsappUrl,
    });
  } catch (error) {
    next(error);
  }
};

// -------------------------------------------------------------
// INVOICES CONTROLLERS
// -------------------------------------------------------------

export const getInvoices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, search } = req.query;
    const filter: any = {};

    if (status && status !== 'ALL') {
      filter.paymentStatus = status;
    }

    if (search) {
      filter.OR = [
        { invoiceNumber: { contains: String(search), mode: 'insensitive' } },
        { clientName: { contains: String(search), mode: 'insensitive' } },
        { clientEmail: { contains: String(search), mode: 'insensitive' } },
        { clientCompany: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const invoices = await prisma.invoice.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' },
      include: {
        quotation: { select: { id: true, quotationNumber: true } },
      },
    });

    res.status(200).json({ status: 'success', data: invoices });
  } catch (error) {
    next(error);
  }
};

export const getInvoiceById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { quotation: true },
    });

    if (!invoice) {
      res.status(404).json({ status: 'fail', message: 'Invoice not found' });
      return;
    }

    res.status(200).json({ status: 'success', data: invoice });
  } catch (error) {
    next(error);
  }
};

export const createInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      quotationId,
      clientName,
      clientCompany,
      clientEmail,
      clientPhone,
      clientGst,
      billingAddress,
      items,
      taxPercent = 18,
      discountAmount = 0,
      issueDate,
      dueDate,
      notes,
      termsAndConditions,
      amountPaid = 0,
      paymentMethod,
    } = req.body;

    const count = await prisma.invoice.count();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const lineItems = Array.isArray(items) ? items : [];
    const subTotal = lineItems.reduce((sum: number, it: any) => sum + (Number(it.amount) || Number(it.quantity) * Number(it.unitPrice) || 0), 0);
    const taxRate = Number(taxPercent) || 0;
    const taxAmount = (subTotal * taxRate) / 100;
    const discount = Number(discountAmount) || 0;
    const totalAmount = Math.max(0, subTotal + taxAmount - discount);
    const paid = Number(amountPaid) || 0;
    const balanceDue = Math.max(0, totalAmount - paid);

    let paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' = 'UNPAID';
    if (paid >= totalAmount && totalAmount > 0) {
      paymentStatus = 'PAID';
    } else if (paid > 0) {
      paymentStatus = 'PARTIALLY_PAID';
    }

    const calculatedDueDate = dueDate ? new Date(dueDate) : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        quotationId: quotationId || undefined,
        clientName,
        clientCompany,
        clientEmail,
        clientPhone,
        clientGst,
        billingAddress,
        items: lineItems,
        subTotal,
        taxPercent: taxRate,
        taxAmount,
        discountAmount: discount,
        totalAmount,
        amountPaid: paid,
        balanceDue,
        issueDate: issueDate ? new Date(issueDate) : new Date(),
        dueDate: calculatedDueDate,
        paymentStatus,
        paymentMethod,
        notes,
        termsAndConditions,
      },
    });

    const pdfUrl = await BillingPdfService.generateInvoicePdf(invoice);
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { pdfUrl },
    });

    if (quotationId) {
      await prisma.quotation.update({
        where: { id: quotationId },
        data: { status: 'ACCEPTED' },
      }).catch(() => null);
    }

    res.status(201).json({ status: 'success', data: updatedInvoice });
  } catch (error) {
    next(error);
  }
};

export const updateInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      clientName,
      clientCompany,
      clientEmail,
      clientPhone,
      clientGst,
      billingAddress,
      items,
      taxPercent,
      discountAmount,
      dueDate,
      notes,
      termsAndConditions,
    } = req.body;

    const lineItems = Array.isArray(items) ? items : [];
    const subTotal = lineItems.reduce((sum: number, it: any) => sum + (Number(it.amount) || Number(it.quantity) * Number(it.unitPrice) || 0), 0);
    const taxRate = Number(taxPercent ?? 18);
    const taxAmount = (subTotal * taxRate) / 100;
    const discount = Number(discountAmount ?? 0);
    const totalAmount = Math.max(0, subTotal + taxAmount - discount);

    const existing = await prisma.invoice.findUnique({ where: { id } });
    const paid = Number(existing?.amountPaid || 0);
    const balanceDue = Math.max(0, totalAmount - paid);

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        clientName,
        clientCompany,
        clientEmail,
        clientPhone,
        clientGst,
        billingAddress,
        items: lineItems.length > 0 ? lineItems : undefined,
        subTotal: lineItems.length > 0 ? subTotal : undefined,
        taxPercent: taxRate,
        taxAmount: lineItems.length > 0 ? taxAmount : undefined,
        discountAmount: discount,
        totalAmount: lineItems.length > 0 ? totalAmount : undefined,
        balanceDue: lineItems.length > 0 ? balanceDue : undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        notes,
        termsAndConditions,
      },
    });

    const pdfUrl = await BillingPdfService.generateInvoicePdf(invoice);
    const finalInvoice = await prisma.invoice.update({
      where: { id },
      data: { pdfUrl },
    });

    res.status(200).json({ status: 'success', data: finalInvoice });
  } catch (error) {
    next(error);
  }
};

export const recordPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { paymentAmount, paymentMethod, paymentReference, notes } = req.body;

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      res.status(404).json({ status: 'fail', message: 'Invoice not found' });
      return;
    }

    const newAmountPaid = Number(invoice.amountPaid || 0) + Number(paymentAmount);
    const newBalanceDue = Math.max(0, Number(invoice.totalAmount) - newAmountPaid);
    const newStatus = newBalanceDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';

    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: {
        amountPaid: newAmountPaid,
        balanceDue: newBalanceDue,
        paymentStatus: newStatus,
        paymentMethod: paymentMethod || invoice.paymentMethod,
        paymentReference: paymentReference || invoice.paymentReference,
      },
    });

    try {
      const bankLedger = await prisma.financeLedger.findFirst({ where: { name: 'HDFC Bank Current A/C' } });
      const receivableLedger = await prisma.financeLedger.findFirst({ where: { name: 'Client Accounts Receivable' } });
      if (bankLedger && receivableLedger) {
        const count = await prisma.financeVoucher.count();
        const voucherNumber = `VCH-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
        await prisma.financeVoucher.create({
          data: {
            voucherNumber,
            voucherType: 'RECEIPT',
            date: new Date(),
            debitLedgerId: bankLedger.id,
            creditLedgerId: receivableLedger.id,
            amount: Number(paymentAmount),
            narration: `Payment received for Invoice #${invoice.invoiceNumber} (${invoice.clientName}) via ${paymentMethod || 'Bank'}`,
            referenceNo: paymentReference || invoice.invoiceNumber,
            invoiceId: invoice.id,
          },
        });
      }
    } catch (vErr) {
      console.warn('[CRM] Auto-voucher creation skipped:', vErr);
    }

    // Auto-record in Finance General Transactions
    try {
      await (prisma as any).financeTransaction.create({
        data: {
          type: 'REVENUE',
          category: 'CLIENT_PAYMENT',
          amount: Number(paymentAmount),
          description: `Payment received for Tax Invoice #${invoice.invoiceNumber} (${invoice.clientName}) via ${paymentMethod || 'Bank'}`,
          date: new Date(),
          reference: paymentReference || invoice.invoiceNumber,
          paidBy: invoice.clientName,
          status: 'COMPLETED',
        },
      });
    } catch (fErr) {
      console.warn('[CRM] FinanceTransaction recording skipped:', fErr);
    }

    // Trigger Autonomous Double-Entry Ledger Posting & Reconciliations (Fiona)
    aiEventBus.publish('PAYMENT_RECEIVED', {
      actor: 'Payment Ingestion Engine',
      entityId: updatedInvoice.id,
      entityType: 'INVOICE',
      data: {
        invoiceId: updatedInvoice.id,
        invoiceNumber: updatedInvoice.invoiceNumber,
        amount: Number(paymentAmount),
        paymentMethod: paymentMethod || updatedInvoice.paymentMethod,
        paymentReference: paymentReference || updatedInvoice.paymentReference,
        clientName: updatedInvoice.clientName,
      },
    }).catch((err) => console.warn('[AiEventBus] Payment publish error:', err));

    const pdfUrl = await BillingPdfService.generateInvoicePdf(updatedInvoice);
    await prisma.invoice.update({ where: { id }, data: { pdfUrl } });

    res.status(200).json({ status: 'success', data: updatedInvoice });
  } catch (error) {
    next(error);
  }
};

export const deleteInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.invoice.delete({ where: { id } });
    res.status(200).json({ status: 'success', message: 'Invoice deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const sendInvoiceEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      res.status(404).json({ status: 'fail', message: 'Invoice not found' });
      return;
    }

    let pdfUrl = invoice.pdfUrl;
    if (!pdfUrl) {
      pdfUrl = await BillingPdfService.generateInvoicePdf(invoice);
    }

    const success = await CommunicationService.sendInvoiceEmail(invoice, pdfUrl);

    await prisma.invoice.update({
      where: { id },
      data: {
        sentViaEmail: true,
      },
    });

    res.status(200).json({
      status: success ? 'success' : 'partial',
      message: success ? 'Tax Invoice emailed to client successfully' : 'Email dispatch queued or simulated',
    });
  } catch (error) {
    next(error);
  }
};

export const sendInvoiceWhatsApp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      res.status(404).json({ status: 'fail', message: 'Invoice not found' });
      return;
    }

    if (!invoice.clientPhone) {
      res.status(400).json({ status: 'fail', message: 'Client phone number is missing' });
      return;
    }

    const isPaid = invoice.paymentStatus === 'PAID';
    const text = isPaid
      ? `Hello ${invoice.clientName},\n\nThank you for your payment! Here is your official Tax Invoice #${invoice.invoiceNumber} from OneBridge Infotech for ₹${Number(invoice.totalAmount).toLocaleString('en-IN')}.\n\nStatus: PAID\n\nBest regards,\nOneBridge Infotech`
      : `Hello ${invoice.clientName},\n\nYour Tax Invoice #${invoice.invoiceNumber} for ₹${Number(invoice.totalAmount).toLocaleString('en-IN')} has been generated. Due Date: ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}.\n\nBalance Due: ₹${Number(invoice.balanceDue).toLocaleString('en-IN')}\n\nBank Transfer / UPI Details:\nAccount: OneBridge Infotech Pvt Ltd | HDFC Bank: 50200012345678 | IFSC: HDFC0001234 | UPI: onebridge@hdfcbank\n\nBest regards,\nOneBridge Infotech`;

    const result = await CommunicationService.sendWhatsAppNotification(invoice.clientPhone, text, invoice.id, invoice.clientName);

    await prisma.invoice.update({
      where: { id },
      data: {
        sentViaWhatsApp: true,
      },
    });

    res.status(200).json({
      status: 'success',
      message: 'WhatsApp invoice message generated',
      whatsappUrl: result.whatsappUrl,
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const quotation = await prisma.quotation.findUnique({ where: { id } });
    if (!quotation) {
      res.status(404).json({ status: 'fail', message: 'Quotation not found' });
      return;
    }
    res.status(200).json({ status: 'success', data: quotation });
  } catch (error) {
    next(error);
  }
};

export const publicProcessQuotationPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const quotation = await prisma.quotation.findUnique({ where: { id } });
    if (!quotation) { res.status(404).json({ status: 'fail', message: 'Quotation not found' }); return; }

    await prisma.quotation.update({ where: { id }, data: { status: 'ACCEPTED' } });

    if (quotation.leadId) {
      await prisma.lead.update({ where: { id: quotation.leadId }, data: { status: 'WON' } }).catch(() => null);
    }

    const count = await prisma.invoice.count();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    const dueDate = new Date();

    let invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        quotationId: quotation.id,
        clientName: quotation.clientName,
        clientCompany: quotation.clientCompany,
        clientEmail: quotation.clientEmail,
        clientPhone: quotation.clientPhone,
        clientGst: quotation.clientGst,
        billingAddress: quotation.clientAddress,
        items: (quotation.items as any) || [],
        subTotal: quotation.subTotal,
        taxPercent: quotation.taxPercent,
        taxAmount: quotation.taxAmount,
        discountAmount: quotation.discountAmount,
        totalAmount: quotation.totalAmount,
        amountPaid: quotation.totalAmount,
        balanceDue: 0,
        dueDate,
        paymentStatus: 'PAID',
        paymentMethod: 'ONLINE_GATEWAY',
        notes: `Auto-generated and paid upon acceptance of Quotation #${quotation.quotationNumber}.`,
        sentViaEmail: true,
      },
    });

    const pdfUrl = await BillingPdfService.generateInvoicePdf(invoice);
    invoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { pdfUrl },
    });

    await CommunicationService.sendInvoiceEmail(invoice, pdfUrl).catch(() => null);

    try {
      const bankLedger = await prisma.financeLedger.findFirst({ where: { name: 'HDFC Bank Current A/C' } });
      const salesLedger = await prisma.financeLedger.findFirst({ where: { name: 'Software Development Services (Sales)' } });
      if (bankLedger && salesLedger) {
        const vCount = await prisma.financeVoucher.count();
        const voucherNumber = `VCH-${new Date().getFullYear()}-${String(vCount + 1).padStart(4, '0')}`;
        await prisma.financeVoucher.create({
          data: {
            voucherNumber,
            voucherType: 'RECEIPT',
            date: new Date(),
            debitLedgerId: bankLedger.id,
            creditLedgerId: salesLedger.id,
            amount: invoice.totalAmount,
            narration: `Payment received for Invoice ${invoice.invoiceNumber} (Quotation ${quotation.quotationNumber})`,
            referenceNo: `ONLINE-${Date.now()}`,
          },
        });
      }
    } catch (e) {
      console.error('Failed to log to finance module', e);
    }

    res.status(200).json({ status: 'success', data: { invoice } });
  } catch (error) {
    next(error);
  }
};
