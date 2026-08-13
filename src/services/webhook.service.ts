import { AdapterRegistry } from './adapter-registry.js';
import { PaymentIntentService } from './payment-intent.service.js';
import { OutboxService } from './outbox.service.js';
import { NormalizedTransaction, WebhookRequestLike } from '../types/payment-provider.js';
import { logger } from '../utils/logger.js';

export interface ProcessedProviderEvent {
  id: string;
  provider: string;
  eventId: string;
  receivedAt: Date;
  processedAt: Date;
}

export class WebhookService {
  private processedEvents: Map<string, ProcessedProviderEvent> = new Map();
  private transactions: Map<string, NormalizedTransaction> = new Map(); // Maps internalReference -> NormalizedTransaction

  constructor(
    private readonly registry: AdapterRegistry,
    private readonly intentService: PaymentIntentService,
    private readonly outboxService: OutboxService
  ) {}

  async processWebhook(
    adapterKey: string,
    req: WebhookRequestLike
  ): Promise<{ success: boolean; duplicate?: boolean; transaction?: NormalizedTransaction }> {
    const adapter = this.registry.get(adapterKey);

    // 1. Verify Webhook Authenticity / Signature
    const isValid = adapter.verifyWebhook(req);
    if (!isValid) {
      logger.warn(`Webhook signature verification failed for adapter '${adapterKey}'`, {
        adapter_key: adapterKey,
      });
      throw new Error('Invalid webhook signature');
    }

    // 2. Extract Event ID & Deduplicate
    const body = req.body as any;
    const eventId =
      body?.eventId ||
      body?.data?.response?.transactionRef ||
      body?.data?.txnReference ||
      body?.txnReference ||
      `evt_${Date.now()}`;

    const dedupKey = `${adapterKey}_${eventId}`;
    if (this.processedEvents.has(dedupKey)) {
      logger.info(`Duplicate webhook event received for key '${dedupKey}'. Skipping processing.`, {
        adapter_key: adapterKey,
        event_id: eventId,
      });
      return { success: true, duplicate: true };
    }

    // 3. Normalize Payload
    const normalized = adapter.normalize(body);

    // 4. Atomic Transaction Persistence & Outbox Write
    const existingTx = this.transactions.get(normalized.internalReference);
    if (!existingTx) {
      this.transactions.set(normalized.internalReference, normalized);
    }

    // Record Event Processing
    const processedEvent: ProcessedProviderEvent = {
      id: `pe_${Date.now()}`,
      provider: adapterKey,
      eventId,
      receivedAt: new Date(),
      processedAt: new Date(),
    };
    this.processedEvents.set(dedupKey, processedEvent);

    // Update Payment Intent Status
    if (normalized.externalReference) {
      const intentStatus = normalized.paymentStatus === 'successful' ? 'completed' : 'failed';
      await this.intentService.updateIntentStatus(normalized.externalReference, intentStatus);
    }

    // Write Outbox Event for downstream reconciliation / notifications
    const eventType = normalized.paymentStatus === 'successful' ? 'payment.completed' : 'payment.failed';
    await this.outboxService.writeEvent(eventType, {
      internalReference: normalized.internalReference,
      externalReference: normalized.externalReference,
      amount: normalized.amount,
      currency: normalized.currency,
      paymentStatus: normalized.paymentStatus,
      settlementStatus: normalized.settlementStatus,
    });

    logger.info(`Processed webhook for '${adapterKey}': paymentStatus=${normalized.paymentStatus}, settlementStatus=${normalized.settlementStatus}`, {
      adapter_key: adapterKey,
      event_id: eventId,
    });

    return { success: true, duplicate: false, transaction: normalized };
  }

  getTransactionByInternalReference(ref: string): NormalizedTransaction | null {
    const tx = this.transactions.get(ref);
    return tx ? { ...tx } : null;
  }

  getAllTransactions(): NormalizedTransaction[] {
    return Array.from(this.transactions.values());
  }
}
