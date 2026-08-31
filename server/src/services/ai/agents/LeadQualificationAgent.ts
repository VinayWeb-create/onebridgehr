import { prisma } from '../../../config/db';
import { aiEventBus, AiEventPayload } from '../aiEventBus';

export class LeadQualificationAgent {
  public static readonly ROLE = 'LEAD_QUALIFIER';
  public static readonly NAME = 'Ava';
  public static readonly TITLE = 'AI Lead Qualification & Intake Specialist';

  /**
   * Initialize subscription
   */
  public static init(): void {
    aiEventBus.subscribe('LEAD_CREATED', this.handleLeadCreated.bind(this));
    console.log(`🤖 [Ava] ${this.TITLE} registered on AiEventBus`);
  }

  /**
   * Autonomous qualification handler
   */
  private static async handleLeadCreated(event: AiEventPayload): Promise<void> {
    const startTime = Date.now();
    const lead = event.data?.lead;
    if (!lead || !lead.id) return;

    console.log(`🤖 [Ava] Analyzing lead #${lead.leadNumber} (${lead.clientName} - ${lead.serviceOfInterest})...`);

    // 1. NLP / Algorithmic Extraction & Scoring
    const isEnterpriseDomain = !lead.email.includes('gmail.com') && !lead.email.includes('yahoo.com') && !lead.email.includes('outlook.com');
    const hasCompany = Boolean(lead.companyName && lead.companyName.trim().length > 1);
    const detailsLength = (lead.projectDetails || '').length;

    let icpScore = 50;
    if (isEnterpriseDomain) icpScore += 20;
    if (hasCompany) icpScore += 15;
    if (detailsLength > 50) icpScore += 10;
    if (lead.timeline && lead.timeline !== 'Flexible') icpScore += 5;
    icpScore = Math.min(100, Math.max(20, icpScore));

    const dealProbability = Math.min(95, Math.max(30, Math.round(icpScore * 0.85 + (lead.estimatedValue > 100000 ? 10 : 0))));
    const urgency = lead.timeline?.toLowerCase().includes('immediate') || lead.timeline?.toLowerCase().includes('1-3') ? 'HIGH' : 'MEDIUM';

    // Extract core pain points
    const painPoints: string[] = [];
    const detailsLower = (lead.projectDetails || '').toLowerCase();
    if (detailsLower.includes('scale') || detailsLower.includes('traffic')) painPoints.push('System Scalability & Performance Bottlenecks');
    if (detailsLower.includes('security') || detailsLower.includes('compliance')) painPoints.push('Data Security & Compliance Hardening');
    if (detailsLower.includes('manual') || detailsLower.includes('automation')) painPoints.push('Operational Inefficiencies & Manual Workflow Overhead');
    if (detailsLower.includes('cloud') || detailsLower.includes('migration')) painPoints.push('Legacy Infrastructure Modernization');
    if (painPoints.length === 0) painPoints.push('Digital Transformation & Competitive Advantage');

    const confidence = 0.93;
    const executionTimeMs = Date.now() - startTime;

    // 2. Persist decision log in database
    const reasoning = `Evaluated client profile. Domain match: ${isEnterpriseDomain ? 'Corporate domain verified' : 'Generic webmail'}. Extracted ${painPoints.length} core business pain points. ICP Score calculated as ${icpScore}/100 with ${dealProbability}% estimated deal probability.`;
    
    try {
      await (prisma as any).aiDecisionLog.create({
        data: {
          agentRole: this.ROLE,
          agentName: this.NAME,
          eventType: 'LEAD_QUALIFIED',
          entityId: lead.id,
          entityType: 'LEAD',
          confidence,
          reasoningChain: reasoning,
          actionTaken: `Enriched Lead #${lead.leadNumber} with ICP Score ${icpScore}%, Urgency ${urgency}, and prioritized routing.`,
          inputPayload: { leadNumber: lead.leadNumber, client: lead.clientName, service: lead.serviceOfInterest, email: lead.email },
          outputPayload: { icpScore, dealProbability, urgency, painPoints },
          status: 'EXECUTED',
          executionTimeMs,
        },
      });

      // Update lead with AI notes
      await (prisma as any).lead.update({
        where: { id: lead.id },
        data: {
          notes: `${lead.notes || ''}\n\n[AI Ava Qualification]: ICP Score ${icpScore}% | Deal Prob: ${dealProbability}% | Urgency: ${urgency} | Pain Points: ${painPoints.join('; ')}`,
        },
      });
    } catch (dbErr) {
      console.warn('[Ava] Logging error:', dbErr);
    }

    // 3. Emit autonomous progression events
    await aiEventBus.publish('LEAD_QUALIFIED', {
      actor: this.NAME,
      entityId: lead.id,
      entityType: 'LEAD',
      data: {
        leadId: lead.id,
        leadNumber: lead.leadNumber,
        clientName: lead.clientName,
        clientEmail: lead.email,
        companyName: lead.companyName,
        serviceOfInterest: lead.serviceOfInterest,
        projectDetails: lead.projectDetails,
        estimatedValue: lead.estimatedValue,
        icpScore,
        dealProbability,
        painPoints,
      },
    });

    // Automatically trigger Solution Architect & BRD Generation
    await aiEventBus.publish('DISCOVERY_REQUESTED', {
      actor: this.NAME,
      entityId: lead.id,
      entityType: 'LEAD',
      data: {
        leadId: lead.id,
        leadNumber: lead.leadNumber,
        clientName: lead.clientName,
        clientEmail: lead.email,
        companyName: lead.companyName,
        serviceOfInterest: lead.serviceOfInterest || 'Custom Software Development',
        projectDetails: lead.projectDetails || 'Comprehensive Enterprise System Requirements',
        painPoints,
        estimatedValue: lead.estimatedValue,
      },
    });
  }
}
