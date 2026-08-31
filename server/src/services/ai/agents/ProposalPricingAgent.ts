import { prisma } from '../../../config/db';
import { aiEventBus, AiEventPayload } from '../aiEventBus';
import { BillingPdfService } from '../../billingPdfService';
import { CommunicationService } from '../../communicationService';

export class ProposalPricingAgent {
  public static readonly ROLE = 'PROPOSAL_ENGINEER';
  public static readonly NAME = 'Paige';
  public static readonly TITLE = 'AI Proposal & Pricing Architect';

  public static init(): void {
    aiEventBus.subscribe('PROPOSAL_REQUESTED', this.handleProposalRequested.bind(this));
    console.log(`🤖 [Paige] ${this.TITLE} registered on AiEventBus`);
  }

  private static async handleProposalRequested(event: AiEventPayload): Promise<void> {
    const startTime = Date.now();
    const data = event.data;
    if (!data || !data.leadId) return;

    console.log(`🤖 [Paige] Calculating Pricing Matrix & Generating Formal Proposal for #${data.leadNumber}...`);

    const baseAmount = Number(data.estimatedValue) > 0 ? Number(data.estimatedValue) : 350000;
    const serviceName = data.serviceCategory || 'Enterprise Software Engineering';

    // Formulate structured line items
    const lineItems = [
      {
        description: `Architecture Blueprint & Sprint 1 Setup for ${serviceName}`,
        quantity: 1,
        unitPrice: Math.round(baseAmount * 0.3),
        taxPercent: 18,
        amount: Math.round(baseAmount * 0.3),
      },
      {
        description: `Core Microservices, API Integrations & Frontend Portal Build`,
        quantity: 1,
        unitPrice: Math.round(baseAmount * 0.5),
        taxPercent: 18,
        amount: Math.round(baseAmount * 0.5),
      },
      {
        description: `DevOps Production Rollout, Security Hardening & 30-Day Hypercare`,
        quantity: 1,
        unitPrice: Math.round(baseAmount * 0.2),
        taxPercent: 18,
        amount: Math.round(baseAmount * 0.2),
      },
    ];

    const subTotal = lineItems.reduce((acc, it) => acc + it.amount, 0);
    const taxAmount = Math.round(subTotal * 0.18);
    const totalAmount = subTotal + taxAmount;

    const count = await prisma.quotation.count();
    const quotationNumber = `QUO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    try {
      const quotation = await prisma.quotation.create({
        data: {
          quotationNumber,
          leadId: data.leadId,
          clientName: data.clientName,
          clientCompany: data.clientCompany || null,
          clientEmail: data.clientEmail,
          items: lineItems,
          subTotal,
          taxPercent: 18,
          taxAmount,
          discountAmount: 0,
          totalAmount,
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          termsAndConditions: '1. Proposal valid for 30 days.\n2. 50% advance milestone before kickoff, 50% upon deployment.\n3. Includes 30 days post-launch warranty & SLA support.',
          notes: `Autonomous proposal assembled by AI Agent Paige based on Scott's Technical BRD.`,
          status: 'DRAFT',
          sentViaEmail: false,
        },
      });

      // Generate PDF file
      const pdfUrl = await BillingPdfService.generateQuotationPdf(quotation);
      await prisma.quotation.update({
        where: { id: quotation.id },
        data: { pdfUrl },
      });

      // Auto-dispatch email (Disabled per user request)
      // if (quotation.clientEmail) {
      //   await CommunicationService.sendQuotationEmail(quotation, pdfUrl);
      // }

      // Update lead status
      await prisma.lead.update({
        where: { id: data.leadId },
        data: { status: 'PROPOSAL_SENT' },
      }).catch(() => null);

      const executionTimeMs = Date.now() - startTime;

      await (prisma as any).aiDecisionLog.create({
        data: {
          agentRole: this.ROLE,
          agentName: this.NAME,
          eventType: 'PROPOSAL_GENERATED',
          entityId: quotation.id,
          entityType: 'QUOTATION',
          confidence: 0.96,
          reasoningChain: `Generated 3-stage itemized quotation #${quotationNumber} total ₹${totalAmount.toLocaleString('en-IN')}. Compiled formal PDF document. Email dispatch disabled.`,
          actionTaken: `Created Quotation #${quotationNumber} with 18% GST calculation.`,
          inputPayload: { leadId: data.leadId, baseAmount, serviceName },
          outputPayload: { quotationNumber, subTotal, totalAmount, pdfUrl },
          status: 'EXECUTED',
          executionTimeMs,
        },
      });

      await aiEventBus.publish('PROPOSAL_GENERATED', {
        actor: this.NAME,
        entityId: quotation.id,
        entityType: 'QUOTATION',
        data: {
          quotationId: quotation.id,
          quotationNumber,
          leadId: data.leadId,
          clientName: data.clientName,
          clientEmail: data.clientEmail,
          totalAmount,
          pdfUrl,
        },
      });
    } catch (err) {
      console.error('[Paige] Proposal generation error:', err);
    }
  }
}
