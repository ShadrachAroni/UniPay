import { Request, Response, NextFunction } from 'express';
import { AdminRole, AdminUser } from '@unipay/shared';
import { getAdminUserByClerkId } from '../services/adminService';
import { requireAuth } from './auth';

declare global {
  namespace Express {
    interface Request {
      adminUser?: AdminUser;
    }
  }
}

/**
 * Server-side Admin Role Access Control (§16, §19)
 * Enforces role gating on admin endpoints. Hiding a button is never access control.
 * A support-role token hitting a super_admin endpoint MUST receive 403.
 */
export function requireAdminRole(allowedRoles: AdminRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // 1. Ensure authenticated
    if (!req.userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'A valid Bearer token is required to access admin operations',
        statusCode: 401,
      });
      return;
    }

    try {
      // 2. Fetch admin user role
      const adminUser = await getAdminUserByClerkId(req.userId);

      if (!adminUser) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied: user is not registered as an administrator',
          statusCode: 403,
        });
        return;
      }

      // 3. Check role authorization
      if (!allowedRoles.includes(adminUser.role)) {
        res.status(403).json({
          error: 'Forbidden',
          message: `Access denied: role '${adminUser.role}' lacks permission for this action (required: ${allowedRoles.join(', ')})`,
          required_roles: allowedRoles,
          current_role: adminUser.role,
          statusCode: 403,
        });
        return;
      }

      // 4. Attach admin context & continue
      req.adminUser = adminUser;
      next();
    } catch (err) {
      req.logger.error('Admin role verification failed', { error: String(err) });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to verify admin permissions',
        statusCode: 500,
      });
    }
  };
}
