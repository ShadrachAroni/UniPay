/**
 * Exponential Backoff with Full Jitter (Handbook Module 3: Resilience)
 * Calculates exponential delay with pseudo-random jitter to avoid thundering herd.
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitter?: boolean;
}

export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs = 10,
  maxDelayMs = 500,
  jitter = true
): number {
  const exponential = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
  if (!jitter) return exponential;
  // Full jitter: random duration between 0 and exponential delay
  return Math.floor(Math.random() * exponential);
}

export async function retryWithJitter<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 5;
  const maxDelayMs = options.maxDelayMs ?? 200;
  const jitter = options.jitter ?? true;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = calculateBackoffDelay(attempt, baseDelayMs, maxDelayMs, jitter);
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  }

  throw lastError;
}
