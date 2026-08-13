import { logger } from '../utils/logger.js';

export interface OutboxEvent {
  id: string;
  eventType: 'payment.completed' | 'payment.failed' | 'settlement.updated';
  payload: Record<string, unknown>;
  status: 'pending' | 'published';
  createdAt: Date;
  publishedAt?: Date;
}

export class OutboxService {
  private events: Map<string, OutboxEvent> = new Map();

  async writeEvent(eventType: OutboxEvent['eventType'], payload: Record<string, unknown>): Promise<OutboxEvent> {
    const id = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const event: OutboxEvent = {
      id,
      eventType,
      payload,
      status: 'pending',
      createdAt: new Date(),
    };
    this.events.set(id, event);
    logger.info(`Outbox event created: '${eventType}' (${id})`);
    return event;
  }

  async getPendingEvents(): Promise<OutboxEvent[]> {
    return Array.from(this.events.values()).filter((e) => e.status === 'pending');
  }

  async markPublished(id: string): Promise<void> {
    const event = this.events.get(id);
    if (event) {
      event.status = 'published';
      event.publishedAt = new Date();
      this.events.set(id, event);
      logger.info(`Outbox event published: (${id})`);
    }
  }

  async getAllEvents(): Promise<OutboxEvent[]> {
    return Array.from(this.events.values());
  }
}

export class OutboxWorker {
  constructor(private readonly outboxService: OutboxService) {}

  async processPendingEvents(handler?: (event: OutboxEvent) => Promise<void>): Promise<number> {
    const pending = await this.outboxService.getPendingEvents();
    let count = 0;
    for (const event of pending) {
      if (handler) {
        await handler(event);
      }
      await this.outboxService.markPublished(event.id);
      count++;
    }
    return count;
  }
}
