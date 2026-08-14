import { Router, Request, Response, NextFunction } from 'express';
import { processProviderWebhook } from '../services/webhookService';
import { rootLogger } from '../utils/logger';

export const webhooksRouter = Router();

/**
 * POST /api/v1/webhooks/loop
 * §18 LOOP Asynchronous Payment Webhook Handler
 */
webhooksRouter.post(
  '/loop',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await processProviderWebhook('loop', {
        headers: req.headers as Record<string, string | string[] | undefined>,
        body: req.body,
        query: req.query as Record<string, unknown>,
      });

      req.logger.info('LOOP Webhook processed', {
        eventId: result.eventId,
        duplicate: result.duplicate,
        trace_id: req.traceId,
      });

      res.status(200).json({
        status: 'success',
        duplicate: result.duplicate,
        eventId: result.eventId,
        transaction_id: result.transaction?.id,
      });
    } catch (err: any) {
      if (err.message?.includes('Invalid webhook signature')) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid webhook signature',
        });
        return;
      }
      next(err);
    }
  }
);

/**
 * POST /api/v1/webhooks/:provider
 * Generic Webhook Router for any registered provider adapter (e.g. seeded, mpesa)
 */
webhooksRouter.post(
  '/:provider',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const providerParam = Array.isArray(req.params.provider) ? req.params.provider[0] : req.params.provider;
    const provider = String(providerParam || '').toLowerCase();
    try {
      const result = await processProviderWebhook(provider, {
        headers: req.headers as Record<string, string | string[] | undefined>,
        body: req.body,
        query: req.query as Record<string, unknown>,
      });

      res.status(200).json({
        status: 'success',
        duplicate: result.duplicate,
        eventId: result.eventId,
        transaction_id: result.transaction?.id,
      });
    } catch (err: any) {
      if (err.message?.includes('Invalid webhook signature')) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid webhook signature',
        });
        return;
      }
      next(err);
    }
  }
);
