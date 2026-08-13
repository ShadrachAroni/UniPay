/**
 * Circuit Breaker Pattern (Handbook Module 3: Circuit Breakers & Resilience)
 * Three states:
 * - CLOSED: All requests pass through. Consecutive failures increment error counter.
 * - OPEN: Requests fail fast without calling provider. Trips after failureThreshold.
 * - HALF_OPEN: Cooldown duration elapsed. Allows limited test requests to probe recovery.
 */

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreakerOpenError extends Error {
  constructor(message = 'Circuit breaker is OPEN — provider requests failed fast') {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  cooldownMs?: number;
  timeoutMs?: number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private failureCount = 0;
  private openedAt = 0;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly timeoutMs: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.cooldownMs = options.cooldownMs ?? 1000;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  getState(): CircuitBreakerState {
    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now - this.openedAt >= this.cooldownMs) {
        this.state = 'HALF_OPEN';
      }
    }
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.openedAt = 0;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      throw new CircuitBreakerOpenError(
        `Circuit breaker is OPEN. Cooldown remaining: ${Math.max(0, this.cooldownMs - (Date.now() - this.openedAt))}ms`
      );
    }

    try {
      let result: T;
      if (this.timeoutMs > 0) {
        result = await Promise.race([
          fn(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Operation timed out after ${this.timeoutMs}ms`)), this.timeoutMs)
          ),
        ]);
      } else {
        result = await fn();
      }

      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount++;
    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }
}
