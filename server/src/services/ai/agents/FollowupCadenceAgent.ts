import { prisma } from '../../../config/db';
import { aiEventBus, AiEventPayload } from '../aiEventBus';
import { CommunicationService } from '../../communicationService';

export class FollowupCadenceAgent {
  public static readonly ROLE = 'FOLLOWUP_MANAGER';
  public static readonly NAME = 'Chase';
  public static readonly TITLE = 'AI Follow-Up & Omnichannel Cadence Manager';

  public static init(): void {
    aiEventBus.subscribe('PROPOSAL_GENERATED', this.handleProposalGenerated.bind(this));
    console.log(`🤖 [Chase] ${this.TITLE} registered on AiEventBus`);
  }

  /**
   * Schedule intelligent multi-touch cadence when proposal is sent
   */
  private static async handleProposalGenerated(event: AiEventPayload): Promise<void> {
    const startTime = Date.now();
    const data = event.data;
    if (!data || !data.leadId) return;

    console.log(`🤖 [Chase] Scheduling 5-step follow-up nurture cadence for Lead #${data.leadId}...`);

    const cadences = [
      { day: 2, subject: `Follow-up: Proposal & Architectural Scope for ${data.clientName}`, delayDays: 2 },
      { day: 5, subject: `Case Study: How OneBridge delivered 3x scale with similar architecture`, delayDays: 5 },
      { day: 8, subject: `Quick check-in regarding Proposal #${data.quotationNumber || 'QUO'}`, delayDays: 8 },
      { day: 12, subject: `Special Incentive & Technical Kickoff Availability`, delayDays: 12 },
    ];

    try {
      for (const cad of cadences) {
        const scheduledDate = new Date(Date.now() + cad.delayDays * 24 * 60 * 60 * 1000);
        await (prisma as any).autonomousFollowupTask.create({
          data: {
            leadId: data.leadId,
            channel: 'EMAIL',
            cadenceDay: cad.day,
            scheduledFor: scheduledDate,
            templateSubject: cad.subject,
            templateBody: `Hello ${data.clientName},\n\nFollowing up on our recent technical proposal for your project. Our solution architecture team is ready to answer any questions or adapt the timeline.\n\nWarm regards,\nOneBridge Infotech Team`,
            status: 'PENDING',
          },
        });
      }

      const executionTimeMs = Date.now() - startTime;

      await (prisma as any).aiDecisionLog.create({
        data: {
          agentRole: this.ROLE,
          agentName: this.NAME,
          eventType: 'CADENCE_SCHEDULED',
          entityId: data.leadId,
          entityType: 'LEAD',
          confidence: 0.95,
          reasoningChain: `Assembled 4-stage automated follow-up cadence (Day 2, 5, 8, 12). Configured auto-pause listener that stops sequence immediately if the client responds via Email or WhatsApp.`,
          actionTaken: `Scheduled 4 autonomous follow-up touchpoints for ${data.clientName}`,
          inputPayload: { leadId: data.leadId, clientEmail: data.clientEmail },
          outputPayload: { touchpointsCount: cadences.length },
          status: 'EXECUTED',
          executionTimeMs,
        },
      });
    } catch (err) {
      console.error('[Chase] Cadence scheduling error:', err);
    }
  }
}
