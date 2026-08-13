import { describe, it, expect, vi } from 'vitest';
import { retryWithBackoffAndJitter } from '../src/resilience/retry.js';
import { ProviderUnavailableError } from '../src/errors/payment.errors.js';

describe('retryWithBackoffAndJitter', () => {
  it('succeeds on first try if no error', async () => {
    const fn = vi.fn().mockResolvedValue('result');

    const res = await retryWithBackoffAndJitter('testOp', fn);
    expect(res).toBe('result');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on transient failure and succeeds on subsequent try', async () => {
    vi.useFakeTimers();
    try {
      let attempts = 0;
      const fn = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts === 1) {
          throw new ProviderUnavailableError('test_adapter', 'Transient 503');
        }
        return 'success';
      });

      const promise = retryWithBackoffAndJitter('testOp', fn, {
        maxAttempts: 3,
        baseDelayMs: 100,
        maxDelayMs: 1000,
      });

      await vi.runAllTimersAsync();
      const res = await promise;

      expect(res).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('enforces max attempts and fails after exhausting retries', async () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn().mockRejectedValue(new ProviderUnavailableError('test_adapter', 'Timeout'));

      const promise = retryWithBackoffAndJitter('testOp', fn, {
        maxAttempts: 3,
        baseDelayMs: 50,
      });

      // Attach catch handler early so unhandled rejection warning doesn't occur during timer advance
      let caughtErr: unknown = null;
      promise.catch((err) => { caughtErr = err; });

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow(ProviderUnavailableError);
      expect(fn).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails immediately without retry on non-transient error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Invalid credit card number'));

    await expect(
      retryWithBackoffAndJitter('testOp', fn, {
        maxAttempts: 3,
        baseDelayMs: 50,
      })
    ).rejects.toThrow('Invalid credit card number');

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
