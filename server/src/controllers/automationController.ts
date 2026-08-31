import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';

const db = prisma as any;

const DEFAULT_TEMPLATES = [
  {
    name: 'Quotation Email Notification',
    channel: 'EMAIL',
    triggerEvent: 'QUOTATION_CREATED',
    subject: 'Proposal & Estimate #{{quotationNumber}} - OneBridge Infotech',
    content: '<p>Dear {{clientName}},</p><p>Please find attached our quotation for your project.</p>',
    isActive: true,
  },
  {
    name: 'Official Tax Invoice Email',
    channel: 'EMAIL',
    triggerEvent: 'INVOICE_SENT',
    subject: 'Tax Invoice #{{invoiceNumber}} - OneBridge Infotech',
    content: '<p>Dear {{clientName}},</p><p>Your invoice for ₹{{totalAmount}} is ready. Due date: {{dueDate}}.</p>',
    isActive: true,
  },
  {
    name: 'Invoice WhatsApp Alert',
    channel: 'WHATSAPP',
    triggerEvent: 'INVOICE_SENT',
    content: 'Hello {{clientName}}, your invoice #{{invoiceNumber}} for ₹{{totalAmount}} from OneBridge Infotech is ready. Due Date: {{dueDate}}.',
    isActive: true,
  },
  {
    name: 'Payment Reminder WhatsApp',
    channel: 'WHATSAPP',
    triggerEvent: 'PAYMENT_REMINDER',
    content: 'Dear {{clientName}}, gentle reminder that Invoice #{{invoiceNumber}} has a pending balance of ₹{{balanceDue}}. Kindly clear it at your earliest convenience.',
    isActive: true,
  },
];

export const getTemplates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let templates = await db.automationTemplate.findMany({ orderBy: { createdAt: 'asc' } });
    if (templates.length === 0) {
      for (const t of DEFAULT_TEMPLATES) {
        await db.automationTemplate.create({ data: t });
      }
      templates = await db.automationTemplate.findMany({ orderBy: { createdAt: 'asc' } });
    }
    res.status(200).json({ status: 'success', data: templates });
  } catch (error) {
    next(error);
  }
};

export const updateTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { subject, content, isActive } = req.body;
    const template = await db.automationTemplate.update({
      where: { id },
      data: { subject, content, isActive },
    });
    res.status(200).json({ status: 'success', data: template });
  } catch (error) {
    next(error);
  }
};

export const getCommunicationLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { channel } = req.query;
    const filter: any = {};
    if (channel && channel !== 'ALL') {
      filter.channel = channel;
    }

    const logs = await db.communicationLog.findMany({
      where: filter,
      orderBy: { sentAt: 'desc' },
      take: 50,
    });

    res.status(200).json({ status: 'success', data: logs });
  } catch (error) {
    next(error);
  }
};
