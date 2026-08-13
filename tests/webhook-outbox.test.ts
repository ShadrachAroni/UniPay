import { describe, it, expect, beforeEach } from 'vitest';
import { AdapterRegistry } from '../src/services/adapter-registry.js';
import { SeededPaymentAdapter } from '../src/adapters/seeded.adapter.js';
import { ResilientPaymentAdapter } from '../src/resilience/resilient-adapter.wrapper.js';
import { PaymentRailsRepository, defaultSeededRail } from '../src/repository/payment-rails.repository.js';
import { PaymentIntentService } from '../src/services/payment-intent.service.js';
import { OutboxService, OutboxWorker } from '../src/services/outbox.service.js';
import { WebhookService } from '../src/services/webhook.service.js';

describe('Webhook Processing, Deduplication & Outbox Pattern', () => {
  let registry: AdapterRegistry;
  let intentService: PaymentIntentService;
  let outboxService: OutboxService;
  let outboxWorker: OutboxWorker;
  let webhookService: WebhookService;

  beforeEach(() => {
    const railsRepo = new PaymentRailsRepository([defaultSeededRail]);
    registry = new AdapterRegistry();

    const seeded = new SeededPaymentAdapter();
    const resilientSeeded = new ResilientPaymentAdapter(seeded);
    registry.register('seeded', resilientSeeded);

    intentService = new PaymentIntentService(registry, railsRepo);
    outboxService = new OutboxService();
    outboxWorker = new OutboxWorker(outboxService);
    webhookService = new WebhookService(registry, intentService, outboxService);
  });

  it('verifies signature and rejects invalid webhook request', async () => {
    const invalidReq = {
      headers: { 'x-seeded-signature': 'invalid_sig' },
      body: {},
    };

    await expect(webhookService.processWebhook('seeded', invalidReq)).rejects.toThrow('Invalid webhook signature');
  });

  it('deduplicates incoming webhooks by event ID: repeated event is skipped', async () => {
    const rawPayload = {
      eventId: 'evt_seeded_1001',
      seeded_tx_id: 'SEEDED_PAY_001',
      order_ref: 'ORD_100',
      amount_kes: 1000,
      fee_kes: 10,
      status: 'SUCCESS',
      created_at: new Date().toISOString(),
    };

    const req = {
      headers: { 'x-seeded-signature': 'valid-seeded-signature' },
      body: rawPayload,
    };

    // First delivery -> processed
    const res1 = await webhookService.processWebhook('seeded', req);
    expect(res1.success).toBe(true);
    expect(res1.duplicate).toBe(false);

    // Second delivery of same event -> duplicate detected
    const res2 = await webhookService.processWebhook('seeded', req);
    expect(res2.success).toBe(true);
    expect(res2.duplicate).toBe(true);
  });

  it('writes outbox event in same transaction and OutboxWorker processes it', async () => {
    const rawPayload = {
      eventId: 'evt_seeded_2002',
      seeded_tx_id: 'SEEDED_PAY_002',
      order_ref: 'ORD_200',
      amount_kes: 2500,
      fee_kes: 25,
      status: 'SUCCESS',
      created_at: new Date().toISOString(),
    };

    const req = {
      headers: { 'x-seeded-signature': 'valid-seeded-signature' },
      body: rawPayload,
    };

    await webhookService.processWebhook('seeded', req);

    // Check pending outbox events
    const pendingBefore = await outboxService.getPendingEvents();
    expect(pendingBefore).toHaveLength(1);
    expect(pendingBefore[0].eventType).toBe('payment.completed');

    // Run OutboxWorker
    const processedCount = await outboxWorker.processPendingEvents();
    expect(processedCount).toBe(1);

    // Confirm no pending events remain
    const pendingAfter = await outboxService.getPendingEvents();
    expect(pendingAfter).toHaveLength(0);
  });
});
