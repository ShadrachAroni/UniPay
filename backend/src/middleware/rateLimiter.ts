import { Request, Response, NextFunction } from 'express';
import { rootLogger } from '../utils/logger';

/**
 * Token Bucket Rate Limiter (Handbook Module 8.3 & Module 7)
 * 
 * Implements token bucket algorithm allowing legitimate bursts while enforcing
 * sustained rate ceilings. Returns 429 Too Many Requests with standard headers.
 */

export interface RateLimiterOptions {
  windowMs?: number;       // Time window in ms (default: 60,000 ms / 1 min)
  max?: number;            // Capacity / max tokens allowed in the bucket
  refillRate?: number;     // Tokens added per second (or per window)
  keyGenerator?: (req: Request) => string;
  message?: string;
  skipFailedRequests?: boolean;
}

interface BucketState {
  tokens: number;
  lastRefill: number;
  resetAt: number;
}

// Global in-memory bucket registry for key -> BucketState
const buckets = new Map<string, BucketState>();

/**
 * Clears all rate limiter state (used in testing)
 */
export function resetRateLimiters(): void {
  buckets.clear();
}

/**
 * Default key generator using client IP or profile/user ID
 */
export function defaultKeyGenerator(req: Request): string {
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    '127.0.0.1';
  const auth = (req.headers['authorization'] as string) || '';
  const userId = req.userId || (req.headers['x-profile-id'] as string) || auth || '';
  const route = req.baseUrl || req.path || '';
  return `${ip}:${userId}:${route}`;
}

export function createRateLimiter(options: RateLimiterOptions = {}) {
  const windowMs = options.windowMs ?? 60_000;
  const capacity = options.max ?? 60; // max burst capacity
  const refillTokensPerMs = capacity / windowMs;
  const keyGen = options.keyGenerator || defaultKeyGenerator;
  const message = options.message || 'Too many requests, please try again later.';

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGen(req);
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        tokens: capacity,
        lastRefill: now,
        resetAt: now + windowMs,
      };
      buckets.set(key, bucket);
    } else {
      // Refill tokens based on elapsed time
      const elapsed = Math.max(0, now - bucket.lastRefill);
      const tokensToAdd = elapsed * refillTokensPerMs;
      bucket.tokens = Math.min(capacity, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;

      if (now >= bucket.resetAt) {
        bucket.resetAt = now + windowMs;
      }
    }

    const limit = capacity;
    const remaining = Math.max(0, Math.floor(bucket.tokens));
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    res.setHeader('X-RateLimit-Limit', limit.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining - 1).toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000).toString());

    if (bucket.tokens < 1) {
      res.setHeader('Retry-After', retryAfterSec.toString());
      
      const logger = req.logger || rootLogger;
      logger.warn('Rate limit exceeded — returning 429', {
        key,
        limit,
        remaining: 0,
        retryAfterSec,
        route: `${req.method} ${req.originalUrl || req.path}`,
      });

      res.status(429).json({
        error: 'Too Many Requests',
        message,
        statusCode: 429,
        retry_after_seconds: retryAfterSec,
      });
      return;
    }

    // Consume 1 token
    bucket.tokens -= 1;
    next();
  };
}

/**
 * Pre-configured rate limiters per route requirements:
 */

// 1. Checkout & Public endpoints: Allow reasonable burst for mobile retries
export const checkoutRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30, // allows bursts of up to 30 requests per minute
  message: 'Too many checkout requests. Please retry in a few moments.',
  keyGenerator: (req) => `checkout:${req.ip || 'ip'}:${req.baseUrl || req.path}`,
});

// 2. Auth-adjacent / Admin endpoints: Stricter rate limiting to mitigate brute-force
export const authRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 50, // 50 attempts per minute per actor / route
  message: 'Too many authentication attempts. Please wait before retrying.',
  keyGenerator: (req) => {
    const auth = (req.headers['authorization'] as string) || '';
    const actor = req.userId || auth || (req.headers['x-profile-id'] as string) || 'anon';
    return `auth:${req.ip || 'ip'}:${actor}:${req.baseUrl || req.path}`;
  },
});

// 3. AI Query endpoint: Strict rate limiting to prevent LLM API cost abuse
export const aiRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 10, // 10 queries per minute
  message: 'AI query rate limit reached. Please wait before asking more queries.',
  keyGenerator: (req) => `ai:${req.headers['x-profile-id'] || req.userId || req.ip || 'ip'}`,
});

// 4. Payouts write endpoint: Protection against rapid duplicate payout requests
export const payoutRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 20,
  message: 'Payout rate limit reached. Please wait before initiating another payout.',
  keyGenerator: (req) => `payout:${req.headers['x-profile-id'] || req.userId || req.ip || 'ip'}`,
});
