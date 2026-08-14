import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireAdminRole } from '../middleware/adminAuth';
import {
  listAllProfiles,
  getProfileWithHistory,
  reviewIdentityAdmin,
  listPlatformTransactions,
  resolveException,
  listRailsWithHealth,
  updateRailConfig,
  intervenePayout,
  listDisputes,
  createDispute,
  resolveDispute,
  getPlatformMetrics,
  createOrUpdateAdminUser,
} from '../services/adminService';
import { queryAuditLogs } from '../services/auditLogService';
import { listReconciliationExceptions } from '../services/reconciliationService';
import { listPayouts } from '../services/payoutService';

export const adminRouter = Router();

// All admin routes require Bearer token authentication (§16, §19)
adminRouter.use(requireAuth);

function getParamId(param: string | string[] | undefined): string {
  if (!param) return '';
  return Array.isArray(param) ? param[0] : param;
}

// -------------------------------------------------------------
// Current Admin User Context
// -------------------------------------------------------------

adminRouter.get(
  '/me',
  requireAdminRole(['super_admin', 'support', 'compliance_reviewer']),
  async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ admin_user: req.adminUser });
  }
);

// -------------------------------------------------------------
// 1. User & Identity Management (§16)
// -------------------------------------------------------------

/**
 * GET /api/v1/admin/users
 * Search, filter, and list any profile across the platform
 */
adminRouter.get(
  '/users',
  requireAdminRole(['super_admin', 'support', 'compliance_reviewer']),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { search, account_type, verification_status, status, limit, offset } = req.query;

      const result = await listAllProfiles({
        search: search ? String(search) : undefined,
        account_type: account_type ? String(account_type) : undefined,
        verification_status: verification_status ? String(verification_status) : undefined,
        status: status ? String(status) : undefined,
        limit: limit ? parseInt(String(limit), 10) : 50,
        offset: offset ? parseInt(String(offset), 10) : 0,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/admin/users/:id
 * Retrieve profile with full transaction and payout ledger history
 */
adminRouter.get(
  '/users/:id',
  requireAdminRole(['super_admin', 'support', 'compliance_reviewer']),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = getParamId(req.params.id);
      const data = await getProfileWithHistory(id);
      if (!data) {
        res.status(404).json({
          error: 'Not Found',
          message: `User profile '${id}' not found`,
          statusCode: 404,
        });
        return;
      }

      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/admin/identity-queue
 * KYC review queue for submitted profiles
 */
adminRouter.get(
  '/identity-queue',
  requireAdminRole(['super_admin', 'compliance_reviewer']),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { limit, offset } = req.query;
      const result = await listAllProfiles({
        verification_status: 'submitted',
        limit: limit ? parseInt(String(limit), 10) : 50,
        offset: offset ? parseInt(String(offset), 10) : 0,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

const reviewIdentitySchema = z.object({
  decision: z.enum(['approved', 'rejected', 'suspended']),
  reviewer_note: z.string().max(500).optional(),
});

/**
 * POST /api/v1/admin/users/:id/identity/review
 * Approve/reject KYC or suspend user profile with mandatory audit logging
 * Restricted to super_admin and compliance_reviewer (§16, §19)
 */
adminRouter.post(
  '/users/:id/identity/review',
  requireAdminRole(['super_admin', 'compliance_reviewer']),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = reviewIdentitySchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation Error',
          message: parseResult.error.issues[0]?.message || 'Invalid review payload',
          details: parseResult.error.issues,
          statusCode: 400,
        });
        return;
      }

      const id = getParamId(req.params.id);
      const adminId = req.adminUser?.clerk_user_id || req.userId || 'admin';

      const updated = await reviewIdentityAdmin(
        id,
        parseResult.data.decision,
        parseResult.data.reviewer_note,
        adminId
      );

      res.status(200).json({
        profile: updated,
        message: `Profile status updated: verification_status=${updated.verification_status}, status=${updated.status}`,
      });
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        res.status(404).json({ error: 'Not Found', message: err.message, statusCode: 404 });
        return;
      }
      if (err.message?.includes('unsubmitted')) {
        res.status(400).json({ error: 'Bad Request', message: err.message, statusCode: 400 });
        return;
      }
      next(err);
    }
  }
);

// -------------------------------------------------------------
// 2. Transaction & Exception Oversight (§14, §16)
// -------------------------------------------------------------

/**
 * GET /api/v1/admin/transactions
 * Platform-wide transaction ledger with filters
 */
adminRouter.get(
  '/transactions',
  requireAdminRole(['super_admin', 'support', 'compliance_reviewer']),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, rail, date_from, date_to, min_confidence, limit, offset } = req.query;

      const result = await listPlatformTransactions({
        status: status ? String(status) : undefined,
        rail: rail ? String(rail) : undefined,
        date_from: date_from ? String(date_from) : undefined,
        date_to: date_to ? String(date_to) : undefined,
        min_confidence: min_confidence ? parseFloat(String(min_confidence)) : undefined,
        limit: limit ? parseInt(String(limit), 10) : 50,
        offset: offset ? parseInt(String(offset), 10) : 0,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/admin/exceptions
 * Surface system-wide reconciliation exception queue across all 7 categories
 */
adminRouter.get(
  '/exceptions',
  requireAdminRole(['super_admin', 'support', 'compliance_reviewer']),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { profile_id, category, status, limit, offset } = req.query;

      const result = await listReconciliationExceptions({
        profile_id: profile_id ? String(profile_id) : undefined,
        category: category ? (String(category) as any) : undefined,
        status: status ? (String(status) as any) : undefined,
        limit: limit ? parseInt(String(limit), 10) : 50,
        offset: offset ? parseInt(String(offset), 10) : 0,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

const exceptionActionSchema = z.object({
  action: z.enum(['resolve', 'escalate']),
  notes: z.string().max(500).optional(),
});

/**
 * POST /api/v1/admin/exceptions/:id/action
 * Resolve or escalate exception with audit logging
 */
adminRouter.post(
  '/exceptions/:id/action',
  requireAdminRole(['super_admin', 'support', 'compliance_reviewer']),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = exceptionActionSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation Error',
          message: parseResult.error.issues[0]?.message || 'Invalid exception action payload',
          details: parseResult.error.issues,
          statusCode: 400,
        });
        return;
      }

      const id = getParamId(req.params.id);
      const adminId = req.adminUser?.clerk_user_id || req.userId || 'admin';

      const result = await resolveException(
        id,
        parseResult.data.action,
        parseResult.data.notes,
        adminId
      );

      res.status(200).json({
        exception: result,
        message: `Exception ${id} ${parseResult.data.action === 'resolve' ? 'resolved' : 'escalated'} successfully`,
      });
    } catch (err) {
      next(err);
    }
  }
);

// -------------------------------------------------------------
// 3. Rail & Configuration Control (§9b, §16)
// -------------------------------------------------------------

/**
 * GET /api/v1/admin/payment-rails
 * List payment rails with live circuit breaker and error rate health indicators
 */
adminRouter.get(
  '/payment-rails',
  requireAdminRole(['super_admin', 'support', 'compliance_reviewer']),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rails = await listRailsWithHealth();
      res.status(200).json({ rails });
    } catch (err) {
      next(err);
    }
  }
);

const updateRailSchema = z.object({
  is_enabled: z.boolean().optional(),
  min_amount: z.number().positive().optional(),
  max_amount: z.number().positive().optional(),
  fee_fixed: z.number().min(0).optional(),
  fee_percentage: z.number().min(0).max(1).optional(),
});

/**
 * PUT /api/v1/admin/payment-rails/:id
 * Toggle rail or update fee config. Strictly restricted to super_admin (§16).
 */
adminRouter.put(
  '/payment-rails/:id',
  requireAdminRole(['super_admin']),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = updateRailSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation Error',
          message: parseResult.error.issues[0]?.message || 'Invalid rail config payload',
          details: parseResult.error.issues,
          statusCode: 400,
        });
        return;
      }

      const adapterKey = getParamId(req.params.id);
      const adminId = req.adminUser?.clerk_user_id || req.userId || 'admin';

      const updated = await updateRailConfig(adapterKey, parseResult.data, adminId);

      res.status(200).json({
        rail: updated,
        message: `Payment rail '${adapterKey}' updated successfully`,
      });
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        res.status(404).json({ error: 'Not Found', message: err.message, statusCode: 404 });
        return;
      }
      next(err);
    }
  }
);

// -------------------------------------------------------------
// 4. Payout & Dispute Interventions (§16)
// -------------------------------------------------------------

/**
 * GET /api/v1/admin/payouts
 * List platform-wide payouts
 */
adminRouter.get(
  '/payouts',
  requireAdminRole(['super_admin', 'support', 'compliance_reviewer']),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, profile_id, limit, offset } = req.query;

      const payouts = await listPayouts({
        status: status ? String(status) : undefined,
        profile_id: profile_id ? String(profile_id) : undefined,
        limit: limit ? parseInt(String(limit), 10) : 50,
        offset: offset ? parseInt(String(offset), 10) : 0,
      });

      res.status(200).json({
        payouts,
        total: payouts.length,
      });
    } catch (err) {
      next(err);
    }
  }
);

const payoutInterventionSchema = z.object({
  action: z.enum(['retry', 'cancel']),
  reason: z.string().min(3).max(500),
});

/**
 * POST /api/v1/admin/payouts/:id/intervene
 * Intervene on stuck/failed payout. Strictly restricted to super_admin (§16).
 */
adminRouter.post(
  '/payouts/:id/intervene',
  requireAdminRole(['super_admin']),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = payoutInterventionSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation Error',
          message: parseResult.error.issues[0]?.message || 'Invalid payout intervention payload',
          details: parseResult.error.issues,
          statusCode: 400,
        });
        return;
      }

      const id = getParamId(req.params.id);
      const adminId = req.adminUser?.clerk_user_id || req.userId || 'admin';

      const updated = await intervenePayout(id, parseResult.data.action, parseResult.data.reason, adminId);

      res.status(200).json({
        payout: updated,
        message: `Payout '${id}' intervention executed (${parseResult.data.action})`,
      });
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        res.status(404).json({ error: 'Not Found', message: err.message, statusCode: 404 });
        return;
      }
      next(err);
    }
  }
);

/**
 * GET /api/v1/admin/disputes
 * List disputes in operational queue
 */
adminRouter.get(
  '/disputes',
  requireAdminRole(['super_admin', 'support', 'compliance_reviewer']),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, profile_id, limit, offset } = req.query;

      const result = await listDisputes({
        status: status ? String(status) : undefined,
        profile_id: profile_id ? String(profile_id) : undefined,
        limit: limit ? parseInt(String(limit), 10) : 50,
        offset: offset ? parseInt(String(offset), 10) : 0,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

const createDisputeSchema = z.object({
  profile_id: z.string().uuid(),
  transaction_id: z.string().uuid().optional(),
  reason: z.string().min(3).max(500),
  amount: z.number().positive(),
  currency: z.string().default('KES').optional(),
});

/**
 * POST /api/v1/admin/disputes
 * Log a new dispute
 */
adminRouter.post(
  '/disputes',
  requireAdminRole(['super_admin', 'support', 'compliance_reviewer']),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = createDisputeSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation Error',
          message: parseResult.error.issues[0]?.message || 'Invalid dispute payload',
          details: parseResult.error.issues,
          statusCode: 400,
        });
        return;
      }

      const dispute = await createDispute(parseResult.data);
      res.status(201).json({ dispute });
    } catch (err) {
      next(err);
    }
  }
);

const resolveDisputeSchema = z.object({
  decision: z.enum(['resolved_refund', 'resolved_rejected']),
  resolution_notes: z.string().max(500).optional(),
});

/**
 * POST /api/v1/admin/disputes/:id/resolve
 * Resolve dispute. Restricted to super_admin and compliance_reviewer (§16).
 */
adminRouter.post(
  '/disputes/:id/resolve',
  requireAdminRole(['super_admin', 'compliance_reviewer']),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = resolveDisputeSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation Error',
          message: parseResult.error.issues[0]?.message || 'Invalid dispute resolution payload',
          details: parseResult.error.issues,
          statusCode: 400,
        });
        return;
      }

      const id = getParamId(req.params.id);
      const adminId = req.adminUser?.clerk_user_id || req.userId || 'admin';

      const dispute = await resolveDispute(id, parseResult.data.decision, parseResult.data.resolution_notes, adminId);

      res.status(200).json({
        dispute,
        message: `Dispute '${id}' resolved as ${parseResult.data.decision}`,
      });
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        res.status(404).json({ error: 'Not Found', message: err.message, statusCode: 404 });
        return;
      }
      next(err);
    }
  }
);

// -------------------------------------------------------------
// 5. Reporting, Metrics & Audit Logs (§16)
// -------------------------------------------------------------

/**
 * GET /api/v1/admin/metrics
 * Aggregate platform KPIs and health metrics
 */
adminRouter.get(
  '/metrics',
  requireAdminRole(['super_admin', 'support', 'compliance_reviewer']),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const metrics = await getPlatformMetrics();
      res.status(200).json({ metrics });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/admin/audit-logs
 * Search and list immutable security audit trail
 */
adminRouter.get(
  '/audit-logs',
  requireAdminRole(['super_admin', 'support', 'compliance_reviewer']),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { actor_id, action, target_type, target_id, date_from, date_to, limit, offset } = req.query;

      const result = await queryAuditLogs({
        actor_id: actor_id ? String(actor_id) : undefined,
        action: action ? String(action) : undefined,
        target_type: target_type ? String(target_type) : undefined,
        target_id: target_id ? String(target_id) : undefined,
        date_from: date_from ? String(date_from) : undefined,
        date_to: date_to ? String(date_to) : undefined,
        limit: limit ? parseInt(String(limit), 10) : 50,
        offset: offset ? parseInt(String(offset), 10) : 0,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

const createAdminUserSchema = z.object({
  clerk_user_id: z.string().min(1),
  role: z.enum(['super_admin', 'support', 'compliance_reviewer']),
  permissions_json: z.record(z.boolean()).optional(),
});

/**
 * POST /api/v1/admin/admins
 * Assign / update admin roles. Strictly restricted to super_admin (§16).
 */
adminRouter.post(
  '/admins',
  requireAdminRole(['super_admin']),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = createAdminUserSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation Error',
          message: parseResult.error.issues[0]?.message || 'Invalid admin user payload',
          details: parseResult.error.issues,
          statusCode: 400,
        });
        return;
      }

      const admin = await createOrUpdateAdminUser(parseResult.data);
      res.status(201).json({
        admin,
        message: `Admin role '${admin.role}' assigned to ${admin.clerk_user_id}`,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/admin/demo/reset
 * Cleanly reset and re-seed all demo personas, transactions, payouts, and rules.
 */
adminRouter.post(
  '/demo/reset',
  requireAdminRole(['super_admin', 'support', 'compliance_reviewer']),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { seedDemoData } = await import('../scripts/seed-demo-data');
      const result = await seedDemoData();
      res.status(200).json({
        success: true,
        message: 'Demo data successfully reset and re-seeded',
        result,
      });
    } catch (err) {
      next(err);
    }
  }
);


