import { Request, Response, NextFunction } from 'express';
import { AiAgentOrchestrator } from '../services/ai/aiAgentOrchestrator';
import { aiEventBus } from '../services/ai/aiEventBus';
import { CeoAnalyticsAgent } from '../services/ai/agents/CeoAnalyticsAgent';
import { prisma } from '../config/db';

export const getAiWorkforceStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const workforce = await AiAgentOrchestrator.getWorkforceStatus();
    res.status(200).json({ status: 'success', data: workforce });
  } catch (error) {
    next(error);
  }
};

export const getAiEventStream = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const events = aiEventBus.getRecentEvents(30);
    res.status(200).json({ status: 'success', data: events });
  } catch (error) {
    next(error);
  }
};

export const getAiDecisionLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const logs = await AiAgentOrchestrator.getDecisionLogs(50);
    res.status(200).json({ status: 'success', data: logs });
  } catch (error) {
    next(error);
  }
};

export const getPendingEscalations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const escalations = await AiAgentOrchestrator.getPendingEscalations();
    res.status(200).json({ status: 'success', data: escalations });
  } catch (error) {
    next(error);
  }
};

export const approveEscalation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const supervisorId = (req as any).user?.employeeId || (req as any).user?.id || 'SUPER_ADMIN';
    const result = await AiAgentOrchestrator.approveEscalation(id, supervisorId, comments);
    res.status(200).json({ status: 'success', message: 'Escalation approved successfully', data: result });
  } catch (error) {
    next(error);
  }
};

export const getDiscoveryDocuments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { leadId } = req.query;
    const filter: any = {};
    if (leadId) filter.leadId = String(leadId);

    const docs = await (prisma as any).aiDiscoveryDocument.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ status: 'success', data: docs });
  } catch (error) {
    next(error);
  }
};

export const getCeoBriefing = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const briefing = await CeoAnalyticsAgent.generateExecutiveBriefing();
    res.status(200).json({ status: 'success', data: briefing });
  } catch (error) {
    next(error);
  }
};

export const triggerAutonomousSimulation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { clientName, email, phone, companyName, serviceOfInterest, projectDetails, estimatedValue } = req.body;

    const count = await (prisma as any).lead.count();
    const leadNumber = `LED-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const lead = await (prisma as any).lead.create({
      data: {
        leadNumber,
        clientName: clientName || 'Enterprise Prospect',
        companyName: companyName || 'Global Innovators Corp',
        email: email || 'prospect@globalinnovators.com',
        phone: phone || '+91 98765 43210',
        serviceOfInterest: serviceOfInterest || 'AI Agents',
        projectDetails: projectDetails || 'Require an autonomous multi-agent system to streamline customer operations and CRM processing.',
        timeline: '1-3 Months',
        source: 'WEBSITE',
        status: 'NEW',
        estimatedValue: Number(estimatedValue || 450000),
        notes: 'Autonomous multi-agent simulation run.',
      },
    });

    // Fire autonomous event through the event bus
    await aiEventBus.publish('LEAD_CREATED', {
      actor: 'System Ingestion',
      entityId: lead.id,
      entityType: 'LEAD',
      data: { lead },
    });

    res.status(201).json({
      status: 'success',
      message: 'Autonomous event stream triggered across Ava, Scott, Paige, Fiona, and Chase.',
      data: { leadId: lead.id, leadNumber: lead.leadNumber },
    });
  } catch (error) {
    next(error);
  }
};
