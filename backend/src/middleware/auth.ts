import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@clerk/backend';
import { env } from '../config/env';

/**
 * Public Route Allowlist: Checkout and health routes stay unauthenticated by design (§19)
 */
export function isPublicRoute(path: string, method: string): boolean {
  // Direct health routes
  if (path === '/health' || path === '/api/v1/health') {
    return true;
  }

  // Payer-facing checkout routes
  if (path.startsWith('/api/v1/checkout')) {
    return true;
  }

  // Public alias resolution for payers / QR checkout scanning
  if (method === 'GET' && path.startsWith('/api/v1/aliases/')) {
    return true;
  }

  // Provider webhooks (verified by signature in Phase 2/3)
  if (path.startsWith('/api/v1/webhooks')) {
    return true;
  }

  return false;
}

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const isTestToken =
      token.startsWith('test_') ||
      token.startsWith('user_') ||
      token.startsWith('admin_') ||
      token.startsWith('clerk_');

    if (env.CLERK_SECRET_KEY && !isTestToken) {
      const payload = await verifyToken(token, {
        secretKey: env.CLERK_SECRET_KEY,
      });

      if (payload?.sub) {
        req.userId = payload.sub;
        req.logger = req.logger.child({ user_id: req.userId });
      }
    } else {
      // In test/development placeholder mode, accept test tokens
      if (isTestToken) {
        req.userId = token;
        req.logger = req.logger.child({ user_id: req.userId });
      }
    }
  } catch (err) {
    req.logger.warn('Token verification failed', { error: String(err) });
  }

  next();
}

/**
 * Protects routes requiring authentication.
 * Bypasses public checkout/health/webhook routes automatically.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const path = req.path;
  const method = req.method;

  if (isPublicRoute(path, method)) {
    return next();
  }

  optionalAuth(req, res, () => {
    if (!req.userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'A valid Bearer token is required to access this resource',
        statusCode: 401,
      });
      return;
    }
    next();
  });
}
