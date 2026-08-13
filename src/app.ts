import express, { Request, Response } from 'express';
import { PaymentRailsRepository, defaultSeededRail, defaultLoopRail } from './repository/payment-rails.repository.js';
import { AdapterRegistry } from './services/adapter-registry.js';
import { SeededPaymentAdapter } from './adapters/seeded.adapter.js';
import { LoopAdapter } from './adapters/loop.adapter.js';
import { ResilientPaymentAdapter } from './resilience/resilient-adapter.wrapper.js';
import { PaymentOptionsService } from './services/payment-options.service.js';

export function createApp() {
  const app = express();
  app.use(express.json());

  // Initialize Repositories & Adapters
  const railsRepo = new PaymentRailsRepository([defaultSeededRail, defaultLoopRail]);
  const registry = new AdapterRegistry();

  const seededAdapter = new SeededPaymentAdapter();
  const resilientSeeded = new ResilientPaymentAdapter(seededAdapter);

  const loopAdapter = new LoopAdapter();
  const resilientLoop = new ResilientPaymentAdapter(loopAdapter);

  registry.register('seeded', resilientSeeded);
  registry.register('loop', resilientLoop);

  const paymentOptionsService = new PaymentOptionsService(railsRepo, registry);

  // Health Check
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Checkout Payment Options
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

  // Stubs for Phase 0/1/3 endpoints returning 501
  const stubRoute = (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Endpoint stubbed - not implemented yet' });
  };

  app.post('/api/v1/checkout/intents', stubRoute);
  app.get('/api/v1/checkout/intents/:id', stubRoute);
  app.post('/api/v1/payouts', stubRoute);
  app.get('/api/v1/reconciliation/matches', stubRoute);

  return { app, railsRepo, registry, paymentOptionsService };
}
