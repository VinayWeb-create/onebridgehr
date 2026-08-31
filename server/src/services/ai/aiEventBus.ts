import { EventEmitter } from 'events';
import { prisma } from '../../config/db';

export type AiEventType =
  | 'LEAD_CREATED'
  | 'LEAD_QUALIFIED'
  | 'DISCOVERY_REQUESTED'
  | 'BRD_GENERATED'
  | 'PROPOSAL_REQUESTED'
  | 'PROPOSAL_GENERATED'
  | 'PROPOSAL_ACCEPTED'
  | 'CLIENT_NEGOTIATING'
  | 'COUNTER_OFFER_DISPATCHED'
  | 'INVOICE_GENERATED'
  | 'PAYMENT_RECEIVED'
  | 'CADENCE_TOUCHPOINT_DUE'
  | 'ESCALATION_TRIGGERED'
  | 'TELEMETRY_REFRESH';

export interface AiEventPayload {
  eventId: string;
  eventType: AiEventType;
  entityId?: string;
  entityType?: 'LEAD' | 'QUOTATION' | 'INVOICE' | 'VOUCHER' | 'COMMUNICATION' | 'TELEMETRY';
  actor: string; // e.g. "Ava", "Scott", "Paige", "System"
  timestamp: string;
  data: Record<string, any>;
}

export type AiEventHandler = (payload: AiEventPayload) => Promise<void> | void;

class AiEventBusEmitter extends EventEmitter {
  private inMemoryEventHistory: AiEventPayload[] = [];
  private readonly MAX_HISTORY = 100;

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  /**
   * Publish an autonomous business event
   */
  public async publish(eventType: AiEventType, payload: Omit<AiEventPayload, 'eventId' | 'eventType' | 'timestamp'>): Promise<AiEventPayload> {
    const fullEvent: AiEventPayload = {
      eventId: `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      eventType,
      timestamp: new Date().toISOString(),
      ...payload,
    };

    // Keep recent in-memory log for real-time dashboard visualizer
    this.inMemoryEventHistory.unshift(fullEvent);
    if (this.inMemoryEventHistory.length > this.MAX_HISTORY) {
      this.inMemoryEventHistory.pop();
    }

    console.log(`⚡ [AiEventBus] Dispatched [${eventType}] by [${fullEvent.actor}] for Entity [${fullEvent.entityId || 'GLOBAL'}]`);

    // Emit event asynchronously
    setImmediate(() => {
      this.emit(eventType, fullEvent);
      this.emit('*', fullEvent);
    });

    return fullEvent;
  }

  /**
   * Subscribe to specific event type
   */
  public subscribe(eventType: AiEventType, handler: AiEventHandler): void {
    this.on(eventType, async (payload: AiEventPayload) => {
      try {
        await handler(payload);
      } catch (err: any) {
        console.error(`❌ [AiEventBus] Handler failed for event ${eventType}:`, err?.message || err);
      }
    });
  }

  /**
   * Subscribe to all events (for audit & visualizer feed)
   */
  public subscribeAll(handler: AiEventHandler): void {
    this.on('*', async (payload: AiEventPayload) => {
      try {
        await handler(payload);
      } catch (err: any) {
        console.error(`❌ [AiEventBus] Wildcard handler failed:`, err?.message || err);
      }
    });
  }

  /**
   * Get recent event stream for UI live ticker
   */
  public getRecentEvents(limit = 30): AiEventPayload[] {
    return this.inMemoryEventHistory.slice(0, limit);
  }
}

export const aiEventBus = new AiEventBusEmitter();
