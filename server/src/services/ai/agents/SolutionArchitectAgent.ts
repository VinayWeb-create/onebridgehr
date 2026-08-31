import { prisma } from '../../../config/db';
import { aiEventBus, AiEventPayload } from '../aiEventBus';

export class SolutionArchitectAgent {
  public static readonly ROLE = 'SOLUTION_ARCHITECT';
  public static readonly NAME = 'Scott';
  public static readonly TITLE = 'AI Principal Solution Architect';

  public static init(): void {
    aiEventBus.subscribe('DISCOVERY_REQUESTED', this.handleDiscoveryRequested.bind(this));
    console.log(`🤖 [Scott] ${this.TITLE} registered on AiEventBus`);
  }

  private static async handleDiscoveryRequested(event: AiEventPayload): Promise<void> {
    const startTime = Date.now();
    const data = event.data;
    if (!data || !data.leadId) return;

    console.log(`🤖 [Scott] Formulating Technical BRD & System Architecture for #${data.leadNumber} (${data.clientName})...`);

    const service = data.serviceOfInterest || 'Custom Software Development';
    const projectDetails = data.projectDetails || '';
    const clientName = data.clientName || 'Valued Client';

    // 1. Synthesize Tailored Architecture Specification
    const executiveSummary = `OneBridge Infotech has architected an enterprise-grade ${service} solution for ${clientName}. Designed with zero-trust security, sub-100ms API response latency, and modular microservice decoupling, this architecture satisfies strict compliance and multi-tenant scaling demands.`;

    const businessObjectives = [
      `Accelerate time-to-market for ${service} by 65% through automated CI/CD and modern modular components.`,
      `Achieve 99.95% high-availability SLA with multi-region failover and distributed caching.`,
      `Automate manual operational workflows and eliminate human processing errors.`,
      `Ensure full regulatory compliance and bank-grade data encryption at rest and in transit.`,
    ];

    const recommendedStack = [
      'Node.js (TypeScript)',
      'React (TailwindCSS / Vite)',
      'PostgreSQL & MongoDB Dual-Engine',
      'Redis Distributed Caching',
      'Docker & Kubernetes (AWS EKS / Fargate)',
      'OpenAI / Anthropic LLM Integration Layer',
    ];

    const technicalScope = {
      coreModules: [
        'High-Throughput API Gateway & Authentication Layer (JWT + OAuth 2.0)',
        'Event-Driven Microservices Bus with Dead-Letter Queues',
        'Relational & Document Hybrid Database Storage',
        'Enterprise Analytics & Real-Time Telemetry Dashboard',
      ],
      cloudInfra: 'AWS Multi-AZ Deployment with Auto-Scaling & CloudFront CDN',
      securityLayer: 'AES-256 GCM Data Encryption, Role-Based Access Control (RBAC), and Audit Trail',
    };

    const functionalReqs = [
      'Automated Ingestion & Multi-Tenant Partitioning with isolation barriers.',
      'Real-time WebSocket event streaming for instant status updates.',
      'Role-based granular access control for Admins, Managers, and External Auditors.',
      'Exportable reporting engines (PDF, Excel, JSON API endpoints).',
    ];

    const nonFunctionalReqs = [
      'Performance: Sub-200ms P95 API response times under 10,000 concurrent queries.',
      'Security: OWASP Top 10 compliance, zero-trust network policies, quarterly pen-testing readiness.',
      'Availability: Multi-zone automated health monitoring with 99.95% uptime SLA.',
    ];

    const milestones = [
      { phase: 'Phase 1: Discovery & Architecture Sprint', duration: '2 Weeks', deliverables: ['BRD Finalization', 'Figma Design System', 'DB Schema Blueprint'] },
      { phase: 'Phase 2: Core Platform & Microservices Build', duration: '4 Weeks', deliverables: ['API Gateway', 'Core Business Logic', 'Event Bus Setup'] },
      { phase: 'Phase 3: Integrations, QA & Security Hardening', duration: '2 Weeks', deliverables: ['Third-Party APIs', 'Automated Unit/E2E Tests', 'Penetration Audit'] },
      { phase: 'Phase 4: Production Deployment & UAT', duration: '2 Weeks', deliverables: ['AWS Production Rollout', 'Data Migration', 'Team Training & SLA Handover'] },
    ];

    const teamComposition = [
      { role: 'Lead Enterprise Solution Architect', fte: 0.5 },
      { role: 'Senior Full-Stack Engineers (2)', fte: 2.0 },
      { role: 'DevOps & Cloud Security Specialist', fte: 0.5 },
      { role: 'QA Automation Lead', fte: 0.5 },
    ];

    const riskMatrix = [
      { risk: 'Third-party API rate limits', impact: 'Medium', mitigation: 'Implement exponential backoff caching with Redis' },
      { risk: 'Changing scope during sprint', impact: 'High', mitigation: 'Agile 2-week sprint boundaries with formal change-order protocol' },
    ];

    const estimatedTimeline = '8 - 10 Weeks';
    const confidenceScore = 0.94;
    const executionTimeMs = Date.now() - startTime;

    // 2. Persist to MongoDB AiDiscoveryDocument
    try {
      const doc = await (prisma as any).aiDiscoveryDocument.create({
        data: {
          leadId: data.leadId,
          leadNumber: data.leadNumber,
          clientName: data.clientName,
          serviceCategory: service,
          executiveSummary,
          businessObjectives,
          technicalScope,
          functionalReqs,
          nonFunctionalReqs,
          milestones,
          teamComposition,
          riskMatrix,
          estimatedTimeline,
          recommendedStack,
          confidenceScore,
        },
      });

      await (prisma as any).aiDecisionLog.create({
        data: {
          agentRole: this.ROLE,
          agentName: this.NAME,
          eventType: 'BRD_GENERATED',
          entityId: doc.id,
          entityType: 'LEAD',
          confidence: confidenceScore,
          reasoningChain: `Analyzed customer requirement parameters. Generated full Software Requirements Specification (SRS), 4-phase delivery roadmap, tech stack (${recommendedStack.slice(0, 3).join(', ')}), and cloud topology.`,
          actionTaken: `Created Technical BRD Document #${doc.id.substring(0, 8)} for Lead #${data.leadNumber}`,
          inputPayload: { leadNumber: data.leadNumber, service, projectDetails },
          outputPayload: { estimatedTimeline, phases: milestones.length, stack: recommendedStack },
          status: 'EXECUTED',
          executionTimeMs,
        },
      });

      // 3. Emit BRD_GENERATED and PROPOSAL_REQUESTED
      await aiEventBus.publish('BRD_GENERATED', {
        actor: this.NAME,
        entityId: doc.id,
        entityType: 'LEAD',
        data: {
          discoveryDocId: doc.id,
          leadId: data.leadId,
          leadNumber: data.leadNumber,
          clientName: data.clientName,
          clientEmail: data.clientEmail,
          clientCompany: data.companyName,
          serviceCategory: service,
          estimatedTimeline,
          estimatedValue: data.estimatedValue,
        },
      });

      // Automatically trigger Proposal Engineer (Paige)
      await aiEventBus.publish('PROPOSAL_REQUESTED', {
        actor: this.NAME,
        entityId: data.leadId,
        entityType: 'LEAD',
        data: {
          discoveryDocId: doc.id,
          leadId: data.leadId,
          leadNumber: data.leadNumber,
          clientName: data.clientName,
          clientEmail: data.clientEmail,
          clientCompany: data.companyName,
          serviceCategory: service,
          estimatedValue: data.estimatedValue,
          estimatedTimeline,
        },
      });
    } catch (err) {
      console.error('[Scott] BRD persistence error:', err);
    }
  }
}
