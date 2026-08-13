import { logger } from '../utils/logger.js';
import { ProviderTimeoutError, ProviderUnavailableError } from '../errors/payment.errors.js';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  adapterKey?: string;
  isTransientError?: (error: unknown) => boolean;
}

export function defaultIsTransientError(error: unknown): boolean {
  if (error instanceof ProviderUnavailableError || error instanceof ProviderTimeoutError) {
    return true;
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('timeout') || msg.includes('econnreset') || msg.includes('503') || msg.includes('502') || msg.includes('transient');
  }
  return false;
}

export async function retryWithBackoffAndJitter<T>(
  operationName: string,
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 100;
  const maxDelayMs = options.maxDelayMs ?? 2000;
  const adapterKey = options.adapterKey ?? 'unknown';
  const isTransient = options.isTransientError ?? defaultIsTransientError;

  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt++;
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxAttempts || !isTransient(err)) {
        throw err;
      }

      // Calculate exponential backoff with jitter
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * baseDelayMs;
      const delay = Math.min(maxDelayMs, Math.floor(exponentialDelay + jitter));

      logger.warn(`Retrying operation '${operationName}' on attempt ${attempt}/${maxAttempts} after ${delay}ms`, {
        adapter_key: adapterKey,
        operation: operationName,
        retry_attempt: attempt,
        outcome: 'retry',
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error(`Retry loop exhausted unexpectedly for operation '${operationName}'`);
}
