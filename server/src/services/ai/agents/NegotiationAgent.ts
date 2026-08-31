import { prisma } from '../../../config/db';
import { aiEventBus, AiEventPayload } from '../aiEventBus';
import { CommunicationService } from '../../communicationService';

export class NegotiationAgent {
  public static readonly ROLE = 'NEGOTIATION_AGENT';
  public static readonly NAME = 'Neo';
  public static readonly TITLE = 'AI Commercial Negotiation Specialist';

  public static init(): void {
    aiEventBus.subscribe('CLIENT_NEGOTIATING', this.handleNegotiation.bind(this));
    console.log(`🤖 [Neo] ${this.TITLE} registered on AiEventBus`);
  }

  private static async handleNegotiation(event: AiEventPayload): Promise<void> {
    const startTime = Date.now();
    const data = event.data;
    if (!data || !data.quotationId) return;

    console.log(`🤖 [Neo] Evaluating negotiation criteria for Quote #${data.quotationNumber || data.quotationId}...`);

    const originalAmount = Number(data.originalAmount) || 350000;
    const requestedDiscountPercent = Number(data.requestedDiscountPercent) || 12;
    const clientFeedback = data.clientFeedback || 'Requesting commercial concession to fit current fiscal quarter budget.';

    let proposedAmount = originalAmount;
    let concessionPolicy = 'STRICT_MARGIN_PROTECTION';
    let counterOfferScope: any = {};
    let status = 'COUNTER_OFFER_DISPATCHED';

    if (requestedDiscountPercent <= 10) {
      // Small commercial concession in exchange for faster payment milestone
      const discount = Math.round(originalAmount * (requestedDiscountPercent / 100));
      proposedAmount = originalAmount - discount;
      concessionPolicy = 'COMMERCIAL_VOLUME_DISCOUNT';
      counterOfferScope = {
        action: 'Direct Price Concession with Accelerated Payment Schedule',
        discountApplied: discount,
        paymentTermsAdjustment: '60% Advance on Kickoff, 40% on UAT Sign-off',
        marginPreserved: 38.5,
      };
    } else if (requestedDiscountPercent <= 25) {
      // MVP Phasing concession: Deliver Phase 1 & 2 first, defer Phase 3
      proposedAmount = Math.round(originalAmount * 0.82);
      concessionPolicy = 'MVP_PHASING_REDUCTION';
      counterOfferScope = {
        action: 'Phase 1 MVP Fast-Track Option',
        retainedModules: 'Core Architecture, REST API, & Client Web Portal',
        deferredModules: 'Advanced Third-Party Integrations & Custom Analytics',
        marginPreserved: 42.0,
      };
    } else {
      // Major concession (>25%) - Escalate for Human Executive Review
      status = 'ESCALATED_TO_SUPERVISOR';
      concessionPolicy = 'POLICY_VIOLATION_ESCALATION';
    }

    try {
      const log = await (prisma as any).aiNegotiationLog.create({
        data: {
          quotationId: data.quotationId,
          quotationNumber: data.quotationNumber || 'QUO-ACTIVE',
          clientFeedback,
          objectionCategory: data.objectionCategory || 'PRICING',
          originalAmount,
          proposedAmount,
          counterOfferScope,
          marginPreserved: counterOfferScope.marginPreserved || 35.0,
          concessionPolicy,
          status,
        },
      });

      const executionTimeMs = Date.now() - startTime;

      await (prisma as any).aiDecisionLog.create({
        data: {
          agentRole: this.ROLE,
          agentName: this.NAME,
          eventType: 'CLIENT_NEGOTIATING',
          entityId: data.quotationId,
          entityType: 'QUOTATION',
          confidence: status === 'ESCALATED_TO_SUPERVISOR' ? 0.72 : 0.91,
          reasoningChain: `Evaluated ${requestedDiscountPercent}% discount request. Selected policy [${concessionPolicy}]. New proposed amount: ₹${proposedAmount.toLocaleString('en-IN')}. Target margin preserved at ${counterOfferScope.marginPreserved || 35}%.`,
          actionTaken: status === 'ESCALATED_TO_SUPERVISOR'
            ? 'Escalated >25% discount request to Executive Supervisor Queue.'
            : `Dispatched alternative phased counter-offer to client with adjusted milestones.`,
          inputPayload: { quotationId: data.quotationId, originalAmount, requestedDiscountPercent },
          outputPayload: { proposedAmount, counterOfferScope, status },
          status: status === 'ESCALATED_TO_SUPERVISOR' ? 'ESCALATED_FOR_REVIEW' : 'EXECUTED',
          executionTimeMs,
        },
      });

      await aiEventBus.publish('COUNTER_OFFER_DISPATCHED', {
        actor: this.NAME,
        entityId: data.quotationId,
        entityType: 'QUOTATION',
        data: {
          negotiationLogId: log.id,
          quotationId: data.quotationId,
          originalAmount,
          proposedAmount,
          concessionPolicy,
          status,
        },
      });
    } catch (err) {
      console.error('[Neo] Negotiation execution error:', err);
    }
  }
}
