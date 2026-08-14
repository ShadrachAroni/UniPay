import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  createPaymentIntent,
  getPaymentIntentById,
  updatePaymentIntentStatus,
} from '../services/paymentIntentService';
import { getAliasByHandle } from '../services/aliasService';
import { defaultAdapterRegistry } from '../adapters/adapter-registry';
import { rootLogger } from '../utils/logger';

export const paymentIntentsRouter = Router();

const createIntentSchema = z.object({
  recipient_profile_id: z.string().uuid().optional(),
  alias: z.string().optional(),
  order_reference: z.string().min(1, 'order_reference is required'),
  amount: z.number().positive('amount must be greater than zero'),
  currency: z.string().default('KES'),
  payer_phone: z.string().optional().nullable(),
  payer_email: z.string().email().optional().nullable(),
  payer_identifier: z.string().optional().nullable(),
  provider: z.string().optional(),
  rail: z.string().optional(),
  idempotency_key: z.string().min(1, 'idempotency_key is required').optional(),
});

/**
 * POST /api/v1/payment-intents
 * §18 Core Payment Intent Creation Endpoint (Initiates Request-to-Pay on resolved rail)
 */
paymentIntentsRouter.post(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = createIntentSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation Error',
          message: parseResult.error.errors[0]?.message || 'Invalid payment intent payload',
          details: parseResult.error.errors,
        });
        return;
      }

      const idempotencyKey =
        (req.headers['idempotency-key'] as string) ||
        parseResult.data.idempotency_key ||
        req.body.idempotency_key;

      if (!idempotencyKey) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'idempotency_key is required either in headers or request body',
        });
        return;
      }

      let recipientProfileId = parseResult.data.recipient_profile_id;

      // If alias handle is provided instead of profile ID, resolve it
      if (!recipientProfileId && parseResult.data.alias) {
        const aliasRecord = await getAliasByHandle(parseResult.data.alias);
        if (!aliasRecord) {
          res.status(404).json({
            error: 'Not Found',
            message: `Recipient with alias '${parseResult.data.alias}' not found`,
          });
          return;
        }
        recipientProfileId = aliasRecord.profile.id;
      }

      if (!recipientProfileId) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Either recipient_profile_id or alias must be provided',
        });
        return;
      }

      const intent = await createPaymentIntent({
        recipient_profile_id: recipientProfileId,
        order_reference: parseResult.data.order_reference,
        amount: parseResult.data.amount,
        currency: parseResult.data.currency,
        payer_phone: parseResult.data.payer_phone,
        payer_email: parseResult.data.payer_email,
        payer_identifier: parseResult.data.payer_identifier,
        provider: parseResult.data.provider,
        rail: parseResult.data.rail,
        idempotency_key: idempotencyKey,
      });

      req.logger.info('Payment intent created / returned', {
        id: intent.id,
        status: intent.status,
        provider: intent.provider,
        rail: intent.rail,
        trace_id: req.traceId,
      });

      res.status(201).json(intent);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/payment-intents/:id
 * §18 Query Payment Intent Status
 */
paymentIntentsRouter.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const intentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const intent = await getPaymentIntentById(intentId);
      if (!intent) {
        res.status(404).json({
          error: 'Not Found',
          message: `Payment intent '${intentId}' not found`,
        });
        return;
      }

      res.status(200).json(intent);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/payment-intents/:id/retry
 * §18 Retry / Poll Payment Intent
 */
paymentIntentsRouter.post(
  '/:id/retry',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const intentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const intent = await getPaymentIntentById(intentId);
      if (!intent) {
        res.status(404).json({
          error: 'Not Found',
          message: `Payment intent '${intentId}' not found`,
        });
        return;
      }

      // If pending or provider reference exists, query status from adapter
      if (intent.provider_reference) {
        try {
          const adapter = defaultAdapterRegistry.get(intent.rail || intent.provider);
          const statusResult = await adapter.getStatus(intent.provider_reference);
          if (statusResult.status === 'completed' || statusResult.status === 'failed') {
            await updatePaymentIntentStatus(intent.id, statusResult.status);
            intent.status = statusResult.status;
          }
        } catch (pollErr) {
          req.logger.warn('Failed to poll status during intent retry', {
            intent_id: intent.id,
            error: (pollErr as Error).message,
            trace_id: req.traceId,
          });
        }
      }

      res.status(200).json(intent);
    } catch (err) {
      next(err);
    }
  }
);
