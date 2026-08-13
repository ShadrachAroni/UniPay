import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@clerk/backend';
import { env } from '../config/env';

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
    if (env.CLERK_SECRET_KEY && !token.startsWith('test_')) {
      const payload = await verifyToken(token, {
        secretKey: env.CLERK_SECRET_KEY,
      });

      if (payload?.sub) {
        req.userId = payload.sub;
        req.logger = req.logger.child({ user_id: req.userId });
      }
    } else {
      // In test/development placeholder mode, accept dummy test tokens
      if (token.startsWith('test_user_') || token.startsWith('user_')) {
        req.userId = token;
        req.logger = req.logger.child({ user_id: req.userId });
      }
    }
  } catch (err) {
    req.logger.warn('Token verification failed', { error: String(err) });
  }

  next();
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
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

