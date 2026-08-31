import api from './api';

export interface AiEmployee {
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

export interface AiEventItem {
  eventId: string;
  eventType: string;
  entityId?: string;
  entityType?: string;
  actor: string;
  timestamp: string;
  data: Record<string, any>;
}

export interface AiDecisionLogItem {
  id: string;
  agentRole: string;
  agentName: string;
  eventType: string;
  entityId?: string;
  entityType?: string;
  confidence: number;
  reasoningChain: string;
  actionTaken: string;
  inputPayload?: any;
  outputPayload?: any;
  status: 'EXECUTED' | 'ESCALATED_FOR_REVIEW' | 'APPROVED_BY_HUMAN' | 'REJECTED';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComments?: string;
  executionTimeMs: number;
  createdAt: string;
}

export interface AiDiscoveryDoc {
  id: string;
  leadId: string;
  leadNumber: string;
  clientName: string;
  serviceCategory: string;
  executiveSummary: string;
  businessObjectives: string[];
  technicalScope: {
    coreModules?: string[];
    cloudInfra?: string;
    securityLayer?: string;
  };
  functionalReqs: string[];
  nonFunctionalReqs: string[];
  milestones: Array<{ phase: string; duration: string; deliverables: string[] }>;
  teamComposition: Array<{ role: string; fte: number }>;
  riskMatrix: Array<{ risk: string; impact: string; mitigation: string }>;
  estimatedTimeline: string;
  recommendedStack: string[];
  confidenceScore: number;
  createdAt: string;
}

export interface CeoBriefingData {
  pipelineValue: number;
  weightedRevenueForecast: number;
  activeDealsCount: number;
  avgWinRate: number;
  cashRunwayMonths: number;
  riskAlerts: string[];
  dailyBriefingText: string;
}

export const aiService = {
  getWorkforceStatus: async () => {
    const res = await api.get('/ai/workforce');
    return res.data.data as AiEmployee[];
  },
  getEventStream: async () => {
    const res = await api.get('/ai/events');
    return res.data.data as AiEventItem[];
  },
  getDecisionLogs: async () => {
    const res = await api.get('/ai/decisions');
    return res.data.data as AiDecisionLogItem[];
  },
  getPendingEscalations: async () => {
    const res = await api.get('/ai/escalations');
    return res.data.data as AiDecisionLogItem[];
  },
  approveEscalation: async (id: string, comments?: string) => {
    const res = await api.post(`/ai/escalations/${id}/approve`, { comments });
    return res.data;
  },
  getDiscoveryDocuments: async (leadId?: string) => {
    const res = await api.get('/ai/discovery-documents', { params: { leadId } });
    return res.data.data as AiDiscoveryDoc[];
  },
  getCeoBriefing: async () => {
    const res = await api.get('/ai/ceo-briefing');
    return res.data.data as CeoBriefingData;
  },
  triggerSimulation: async (payload: {
    clientName: string;
    email: string;
    phone: string;
    companyName?: string;
    serviceOfInterest?: string;
    projectDetails?: string;
    estimatedValue?: number;
  }) => {
    const res = await api.post('/ai/simulate', payload);
    return res.data;
  },
};
