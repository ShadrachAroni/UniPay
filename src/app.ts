import express, { Request, Response } from 'express';
import { PaymentRailsRepository, defaultSeededRail, defaultLoopRail } from './repository/payment-rails.repository.js';
import { AdapterRegistry } from './services/adapter-registry.js';
import { SeededPaymentAdapter } from './adapters/seeded.adapter.js';
import { LoopAdapter } from './adapters/loop.adapter.js';
import { ResilientPaymentAdapter } from './resilience/resilient-adapter.wrapper.js';
import { PaymentOptionsService } from './services/payment-options.service.js';
import { PaymentIntentService } from './services/payment-intent.service.js';
import { BoundedPollingService } from './services/polling.service.js';
import { OutboxService, OutboxWorker } from './services/outbox.service.js';
import { WebhookService } from './services/webhook.service.js';

export function createApp() {
  const app = express();
  app.use(express.json());

  // Repositories & Adapters Setup
  const railsRepo = new PaymentRailsRepository([defaultSeededRail, defaultLoopRail]);
  const registry = new AdapterRegistry();

  const seededAdapter = new SeededPaymentAdapter();
  const resilientSeeded = new ResilientPaymentAdapter(seededAdapter);

  const loopAdapter = new LoopAdapter();
  const resilientLoop = new ResilientPaymentAdapter(loopAdapter);

  registry.register('seeded', resilientSeeded);
  registry.register('loop', resilientLoop);

  // Services Setup
  const paymentOptionsService = new PaymentOptionsService(railsRepo, registry);
  const paymentIntentService = new PaymentIntentService(registry, railsRepo);
  const pollingService = new BoundedPollingService(registry, paymentIntentService);
  const outboxService = new OutboxService();
  const outboxWorker = new OutboxWorker(outboxService);
  const webhookService = new WebhookService(registry, paymentIntentService, outboxService);

  // Health Check Endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Payment Options Endpoint
  app.post('/api/v1/checkout/payment-options', async (req: Request, res: Response) => {
    try {
      const { currency = 'KES', country = 'KE', amount = 100 } = req.body || {};
      const options = await paymentOptionsService.getAvailableOptions({
        currency,
        country,
        amount: Number(amount),
      });
      res.status(200).json({ options });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Payment Intent Creation (POST /api/v1/payment-intents)
  app.post('/api/v1/payment-intents', async (req: Request, res: Response) => {
    try {
      const {
        recipientProfileId = 'prof_001',
        amount,
        currency = 'KES',
        payerPhone,
        payerEmail,
        orderReference,
        railKey = 'loop',
        idempotencyKey,
      } = req.body || {};

      if (!amount || !idempotencyKey || !orderReference) {
        res.status(400).json({ error: 'amount, idempotencyKey, and orderReference are required' });
        return;
      }

      const result = await paymentIntentService.createPaymentIntent({
        recipientProfileId,
        amount: Number(amount),
        currency,
        payerPhone,
        payerEmail,
        orderReference,
        railKey,
        idempotencyKey,
      });

      res.status(200).json({
        payment_intent_id: result.intent.id,
        provider: result.intent.provider,
        rail: result.intent.rail,
        status: result.intent.status,
        provider_reference: result.intent.providerReference,
        raw_provider_response: result.providerResult.rawResponse,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Payment Intent Status Inquiry (GET /api/v1/payment-intents/:id)
  app.get('/api/v1/payment-intents/:id', async (req: Request, res: Response) => {
    try {
      const intent = await paymentIntentService.getIntentById(req.params.id);
      if (!intent) {
        res.status(404).json({ error: 'Payment intent not found' });
        return;
      }

      res.status(200).json({
        payment_intent_id: intent.id,
        status: intent.status,
        amount: intent.amount,
        currency: intent.currency,
        provider: intent.provider,
        rail: intent.rail,
        provider_reference: intent.providerReference,
        initiated_at: intent.initiatedAt,
        completed_at: intent.completedAt,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // LOOP Webhook Endpoint (POST /api/v1/webhooks/loop)
  app.post('/api/v1/webhooks/loop', async (req: Request, res: Response) => {
    try {
      const webhookReq = {
        headers: req.headers as Record<string, string | string[] | undefined>,
        body: req.body,
      };

      const result = await webhookService.processWebhook('loop', webhookReq);
      res.status(200).json({ received: true, ...result });
    } catch (err: any) {
      res.status(401).json({ error: err.message });
    }
  });

  return {
    app,
    railsRepo,
    registry,
    paymentOptionsService,
    paymentIntentService,
    pollingService,
    outboxService,
    outboxWorker,
    webhookService,
  };
}
