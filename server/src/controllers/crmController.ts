import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
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

// Quotation & invoice handlers live in quotationInvoiceController.ts and billingDocumentController.ts.
