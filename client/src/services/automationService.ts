import { api } from './api';

export interface AutomationTemplate {
  id: string;
  name: string;
  channel: 'EMAIL' | 'WHATSAPP';
  triggerEvent: string;
  subject?: string;
  content: string;
  isActive: boolean;
}

export interface CommunicationLog {
  id: string;
  channel: 'EMAIL' | 'WHATSAPP';
  recipient: string;
  recipientName?: string;
  subject?: string;
  messageBody: string;
  status: 'SENT' | 'DELIVERED' | 'FAILED';
  errorMessage?: string;
  referenceId?: string;
  sentAt: string;
}

export const automationService = {
  getTemplates: async () => {
    const res = await api.get('/automations/templates');
    return res.data.data as AutomationTemplate[];
  },
  updateTemplate: async (id: string, data: Partial<AutomationTemplate>) => {
    const res = await api.put(`/automations/templates/${id}`, data);
    return res.data.data as AutomationTemplate;
  },
  getLogs: async (channel?: string) => {
    const res = await api.get('/automations/logs', { params: { channel } });
    return res.data.data as CommunicationLog[];
  },
};
