import { prisma } from '../../config/db';
import { aiEventBus } from './aiEventBus';
import { LeadQualificationAgent } from './agents/LeadQualificationAgent';
import { SolutionArchitectAgent } from './agents/SolutionArchitectAgent';
import { ProposalPricingAgent } from './agents/ProposalPricingAgent';
import { NegotiationAgent } from './agents/NegotiationAgent';
import { FinanceLedgerAgent } from './agents/FinanceLedgerAgent';
import { FollowupCadenceAgent } from './agents/FollowupCadenceAgent';
import { CeoAnalyticsAgent } from './agents/CeoAnalyticsAgent';

export interface AiEmployeeSummary {
  role: string;
  name: string;
  title: string;
  avatar: string;
  autonomyMode: 'FULLY_AUTONOMOUS' | 'SUPERVISED' | 'MANUAL_APPROVAL_ONLY';
  minConfidence: number;
  isActive: boolean;
  totalActionsTaken: number;
  averageLatencyMs: number;
  capabilities: string[];
}

export class AiAgentOrchestrator {
  private static initialized = false;

  public static async init(): Promise<void> {
    if (this.initialized) return;

    // Register all AI Agents on the EventBus
    LeadQualificationAgent.init();
    SolutionArchitectAgent.init();
    ProposalPricingAgent.init();
    NegotiationAgent.init();
    FinanceLedgerAgent.init();
    FollowupCadenceAgent.init();
    CeoAnalyticsAgent.init();

    this.initialized = true;
    console.log('✨ [AiAgentOrchestrator] AI-First Autonomous Business Operating System (BOS) initialized successfully!');
  }

  /**
   * Return workforce status roster for UI
   */
  public static async getWorkforceStatus(): Promise<AiEmployeeSummary[]> {
    const defaultRoster: AiEmployeeSummary[] = [
      {
        role: 'LEAD_QUALIFIER',
        name: 'Ava',
        title: 'Lead Intake & ICP Qualification Specialist',
        avatar: '👩‍💼',
        autonomyMode: 'FULLY_AUTONOMOUS',
        minConfidence: 0.85,
        isActive: true,
        totalActionsTaken: 142,
        averageLatencyMs: 380,
        capabilities: ['Lead Metadata Extraction', 'ICP Match Scoring', 'Deal Probability Calculation', 'Pain Point Extraction'],
      },
      {
        role: 'SOLUTION_ARCHITECT',
        name: 'Scott',
        title: 'Principal Enterprise Solution Architect',
        avatar: '👨‍💻',
        autonomyMode: 'FULLY_AUTONOMOUS',
        minConfidence: 0.90,
        isActive: true,
        totalActionsTaken: 118,
        averageLatencyMs: 650,
        capabilities: ['BRD & SRS Synthesis', 'Cloud Architecture Blueprinting', 'WBS Milestones Generation', 'Tech Stack Advisory'],
      },
      {
        role: 'PROPOSAL_ENGINEER',
        name: 'Paige',
        title: 'Commercial Proposal & Pricing Architect',
        avatar: '📊',
        autonomyMode: 'FULLY_AUTONOMOUS',
        minConfidence: 0.88,
        isActive: true,
        totalActionsTaken: 94,
        averageLatencyMs: 520,
        capabilities: ['3-Tier Proposal Modeling', 'Automated GST Calculations', 'PDF Proposal Assembly', 'Omnichannel Email Dispatch'],
      },
      {
        role: 'NEGOTIATION_AGENT',
        name: 'Neo',
        title: 'Commercial Negotiation & Concession Strategist',
        avatar: '🤝',
        autonomyMode: 'SUPERVISED',
        minConfidence: 0.92,
        isActive: true,
        totalActionsTaken: 67,
        averageLatencyMs: 430,
        capabilities: ['Margin Protection Rules', 'Phased MVP Scoping', 'Payment Term Adjustments', 'Executive Escalation Guardrails'],
      },
      {
        role: 'FINANCE_OFFICER',
        name: 'Fiona',
        title: 'Chief Financial & Ledger Automation Officer',
        avatar: '🏛️',
        autonomyMode: 'FULLY_AUTONOMOUS',
        minConfidence: 0.95,
        isActive: true,
        totalActionsTaken: 215,
        averageLatencyMs: 310,
        capabilities: ['Official Tax Invoice Issuance', 'Dynamic Payment QR Codes', 'Double-Entry CA Ledger Sync', 'Bank Remittance Matching'],
      },
      {
        role: 'FOLLOWUP_MANAGER',
        name: 'Chase',
        title: 'Omnichannel Nurture & Cadence Manager',
        avatar: '⚡',
        autonomyMode: 'FULLY_AUTONOMOUS',
        minConfidence: 0.85,
        isActive: true,
        totalActionsTaken: 380,
        averageLatencyMs: 290,
        capabilities: ['Multi-Touch Cadence Execution', 'Auto-Pause upon Client Reply', 'Buying Signal Recognition', 'WhatsApp & Email Relay'],
      },
      {
        role: 'EXECUTIVE_ANALYST',
        name: 'Orion',
        title: 'Chief Executive Strategic Intelligence Analyst',
        avatar: '🔮',
        autonomyMode: 'FULLY_AUTONOMOUS',
        minConfidence: 0.96,
        isActive: true,
        totalActionsTaken: 89,
        averageLatencyMs: 780,
        capabilities: ['Pipeline ARR Forecasting', 'Cash Runway Modeling', 'Margin Leak Detection', 'Daily Executive Briefings'],
      },
    ];

    return defaultRoster;
  }

  /**
   * Fetch recent audit decision logs
   */
  public static async getDecisionLogs(limit = 40): Promise<any[]> {
    try {
      return await (prisma as any).aiDecisionLog.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
    } catch (err) {
      return [];
    }
  }

  /**
   * Fetch pending supervisor escalations
   */
  public static async getPendingEscalations(): Promise<any[]> {
    try {
      return await (prisma as any).aiDecisionLog.findMany({
        where: { status: 'ESCALATED_FOR_REVIEW' },
        orderBy: { createdAt: 'desc' },
      });
    } catch (err) {
      return [];
    }
  }

  /**
   * Supervisor Approve Escalation
   */
  public static async approveEscalation(logId: string, supervisorId: string, comments?: string): Promise<any> {
    try {
      return await (prisma as any).aiDecisionLog.update({
        where: { id: logId },
        data: {
          status: 'APPROVED_BY_HUMAN',
          reviewedBy: supervisorId,
          reviewedAt: new Date(),
          reviewComments: comments || 'Approved by Executive Supervisor',
        },
      });
    } catch (err) {
      return null;
    }
  }
}
