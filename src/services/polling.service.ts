import { AdapterRegistry } from './adapter-registry.js';
import { PaymentIntentService } from './payment-intent.service.js';
import { logger } from '../utils/logger.js';

export interface PollingOptions {
  providerReference: string;
  idempotencyKey: string;
  adapterKey: string;
  maxPolls?: number;
  pollIntervalMs?: number;
}

export class BoundedPollingService {
  constructor(
    private readonly registry: AdapterRegistry,
    private readonly intentService: PaymentIntentService
  ) {}

  async pollUntilTerminal(options: PollingOptions): Promise<string> {
    const maxPolls = options.maxPolls ?? 5;
    const pollIntervalMs = options.pollIntervalMs ?? 100;
    const adapter = this.registry.get(options.adapterKey);

    let pollCount = 0;
    while (pollCount < maxPolls) {
      pollCount++;
      try {
        const statusResult = await adapter.getStatus(options.providerReference);
        logger.info(`Poll attempt ${pollCount}/${maxPolls} for '${options.providerReference}': status = ${statusResult.status}`, {
          adapter_key: options.adapterKey,
          provider_reference: options.providerReference,
          status: statusResult.status,
        });

        if (statusResult.status === 'completed') {
          await this.intentService.updateIntentStatus(options.idempotencyKey, 'completed', options.providerReference);
          return 'completed';
        } else if (statusResult.status === 'failed' || statusResult.status === 'expired') {
          await this.intentService.updateIntentStatus(options.idempotencyKey, 'failed', options.providerReference);
          return 'failed';
        }

        // Still pending -> wait interval before next poll
        if (pollCount < maxPolls) {
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }
      } catch (err) {
        logger.warn(`Polling error on attempt ${pollCount}: ${(err as Error).message}`, {
          adapter_key: options.adapterKey,
        });
      }
    }

    logger.warn(`Polling exhausted after ${maxPolls} attempts for '${options.providerReference}'`, {
      adapter_key: options.adapterKey,
    });
    return 'pending';
  }
}
