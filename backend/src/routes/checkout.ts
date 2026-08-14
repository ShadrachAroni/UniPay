import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getAliasByHandle } from '../services/aliasService';
import { getEnabledRailsFor } from '../services/paymentRailService';
import { defaultAdapterRegistry } from '../adapters/adapter-registry';
import { rootLogger } from '../utils/logger';

export const checkoutRouter = Router();

const paymentOptionsSchema = z.object({
  alias: z.string().min(1, 'Alias is required'),
  amount: z.number().positive('Amount must be greater than zero'),
  currency: z.string().default('KES'),
});

/**
 * POST /api/v1/checkout/payment-options
 * §18 Core Public Checkout Endpoint: Resolves recipient alias & queries available payment rail options
 */
checkoutRouter.post(
  '/payment-options',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = paymentOptionsSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation Error',
          message: parseResult.error.errors[0]?.message || 'Invalid payment options request',
          details: parseResult.error.errors,
        });
        return;
      }

      const { alias, amount, currency } = parseResult.data;

      // 1. Resolve recipient alias
      const recipient = await getAliasByHandle(alias);
      if (!recipient) {
        res.status(404).json({
          error: 'Not Found',
          message: `Recipient with alias '${alias}' not found or inactive`,
        });
        return;
      }

      const country = recipient.profile.country_code || 'KE';

      // 2. Query enabled rails for currency/country/amount
      const enabledRails = await getEnabledRailsFor(currency, country, amount);
      if (enabledRails.length === 0) {
        res.status(422).json({
          error: 'Unprocessable Entity',
          message: `No enabled payment rails available for ${currency} in ${country} for amount ${amount}`,
        });
        return;
      }

      // 3. Resolve primary adapter
      const primaryRail = enabledRails[0];
      const adapter = defaultAdapterRegistry.get(primaryRail.adapter_key);
      const capabilities = adapter.capabilities();

      const feeStructure = capabilities.feeStructure || { fixed: 0, percentage: 0.005 };
      const estimatedFee = Number(
        ((feeStructure.fixed || 0) + amount * (feeStructure.percentage || 0)).toFixed(2)
      );
      const estimatedRecipientAmount = Number((amount - estimatedFee).toFixed(2));
      const settlementEstimate = capabilities.settlementEstimate || 'instant';

      req.logger.info('Resolved checkout payment options', {
        alias: recipient.alias.alias,
        amount,
        currency,
        provider: adapter.name(),
        rail: primaryRail.adapter_key,
        trace_id: req.traceId,
      });

      res.status(200).json({
        provider: adapter.name(),
        rail: 'request_to_pay',
        amount,
        currency,
        estimated_fee: estimatedFee,
        estimated_recipient_amount: estimatedRecipientAmount,
        settlement_estimate: settlementEstimate,
        recipient: {
          display_name: recipient.profile.display_name,
          account_type: recipient.profile.account_type,
          alias: recipient.alias.alias,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);
