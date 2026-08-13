import { describe, it, expect, vi } from 'vitest';
import { CircuitBreaker } from '../src/resilience/circuit-breaker.js';
import { CircuitOpenError } from '../src/errors/payment.errors.js';

describe('CircuitBreaker', () => {
  it('starts in CLOSED state and allows successful calls', async () => {
    const cb = new CircuitBreaker({ adapterKey: 'test_adapter', failureThreshold: 3 });
    expect(cb.getState()).toBe('CLOSED');

    const fn = vi.fn().mockResolvedValue('ok');
    const res = await cb.execute(fn);

    expect(res).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(cb.getState()).toBe('CLOSED');
  });

  it('transitions from CLOSED to OPEN after failure threshold is reached', async () => {
    const cb = new CircuitBreaker({ adapterKey: 'test_adapter', failureThreshold: 2 });
    const fn = vi.fn().mockRejectedValue(new Error('Provider failure'));

    // Attempt 1 failure
    await expect(cb.execute(fn)).rejects.toThrow('Provider failure');
    expect(cb.getState()).toBe('CLOSED');

    // Attempt 2 failure -> threshold reached -> OPEN
    await expect(cb.execute(fn)).rejects.toThrow('Provider failure');
    expect(cb.getState()).toBe('OPEN');
  });

  it('fails fast when OPEN without executing underlying function', async () => {
    const cb = new CircuitBreaker({ adapterKey: 'test_adapter', failureThreshold: 1 });
    const fn = vi.fn().mockRejectedValue(new Error('Provider failure'));

    // Trigger OPEN
    await expect(cb.execute(fn)).rejects.toThrow('Provider failure');
    expect(cb.getState()).toBe('OPEN');

    // Reset mock count
    fn.mockClear();

    // Call while OPEN -> must fail fast with CircuitOpenError
    await expect(cb.execute(fn)).rejects.toThrow(CircuitOpenError);
    expect(fn).not.toHaveBeenCalled();
  });

  it('transitions from OPEN to HALF_OPEN after resetTimeoutMs', async () => {
    vi.useFakeTimers();
    try {
      const cb = new CircuitBreaker({
        adapterKey: 'test_adapter',
        failureThreshold: 1,
        resetTimeoutMs: 5000,
      });
      const fn = vi.fn().mockRejectedValue(new Error('Fail'));

      await expect(cb.execute(fn)).rejects.toThrow('Fail');
      expect(cb.getState()).toBe('OPEN');

      // Fast-forward time past reset timeout
      vi.advanceTimersByTime(5001);

      expect(cb.getState()).toBe('HALF_OPEN');
    } finally {
      vi.useRealTimers();
    }
  });

  it('transitions HALF_OPEN -> CLOSED on successful probe', async () => {
    vi.useFakeTimers();
    try {
      const cb = new CircuitBreaker({
        adapterKey: 'test_adapter',
        failureThreshold: 1,
        resetTimeoutMs: 5000,
        successThreshold: 1,
      });

      let fail = true;
      const fn = vi.fn().mockImplementation(async () => {
        if (fail) throw new Error('Fail');
        return 'success';
      });

      await expect(cb.execute(fn)).rejects.toThrow();
      expect(cb.getState()).toBe('OPEN');

      vi.advanceTimersByTime(5001);
      expect(cb.getState()).toBe('HALF_OPEN');

      // Now set probe call to succeed
      fail = false;
      const result = await cb.execute(fn);

      expect(result).toBe('success');
      expect(cb.getState()).toBe('CLOSED');
    } finally {
      vi.useRealTimers();
    }
  });

  it('transitions HALF_OPEN -> OPEN on failed probe', async () => {
    vi.useFakeTimers();
    try {
      const cb = new CircuitBreaker({
        adapterKey: 'test_adapter',
        failureThreshold: 1,
        resetTimeoutMs: 5000,
      });

      const fn = vi.fn().mockRejectedValue(new Error('Persistent failure'));

      await expect(cb.execute(fn)).rejects.toThrow();
      expect(cb.getState()).toBe('OPEN');

      vi.advanceTimersByTime(5001);
      expect(cb.getState()).toBe('HALF_OPEN');

      // Probe execution fails again
      await expect(cb.execute(fn)).rejects.toThrow('Persistent failure');
      expect(cb.getState()).toBe('OPEN');
    } finally {
      vi.useRealTimers();
    }
  });
});
