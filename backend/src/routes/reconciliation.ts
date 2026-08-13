import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  runReconciliation,
  listReconciliationExceptions,
  getDashboardReconciliationMetrics,
} from '../services/reconciliationService';
import { rootLogger } from '../utils/logger';

export const reconciliationRouter = Router();

const runReconSchema = z.object({
  profile_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  rail: z.string().optional(),
});

/**
 * POST /api/v1/reconciliation/run
 * §18 Core Reconciliation Execution Endpoint (Runs deterministic rule engine)
 */
reconciliationRouter.post(
  '/run',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = runReconSchema.safeParse(req.body || {});
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation Error',
          message: parseResult.error.errors[0]?.message || 'Invalid reconciliation request parameters',
          details: parseResult.error.errors,
        });
        return;
      }

      const result = await runReconciliation({
        profile_id: parseResult.data.profile_id,
        date_from: parseResult.data.date_from,
        date_to: parseResult.data.date_to,
        rail: parseResult.data.rail,
      });

      rootLogger.info('Triggered on-demand reconciliation run', {
        job_id: result.job_id,
        matched: result.matched_count,
        exceptions: result.exception_count,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/reconciliation/exceptions
 * §18 Open & Historical Reconciliation Exceptions List
 */
reconciliationRouter.get(
  '/exceptions',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        profile_id,
        category,
        status,
        date_from,
        date_to,
        limit,
        offset,
      } = req.query;

      const result = await listReconciliationExceptions({
        profile_id: profile_id ? String(profile_id) : undefined,
        category: category ? (String(category) as any) : undefined,
        status: status ? (String(status) as any) : undefined,
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

/**
 * GET /api/v1/reconciliation/metrics
 * §14 Aggregate Dashboard Reconciliation & Financial Summary Queries
 */
reconciliationRouter.get(
  '/metrics',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { profile_id, date_from, date_to, rail } = req.query;

      const metrics = await getDashboardReconciliationMetrics({
        profile_id: profile_id ? String(profile_id) : undefined,
        date_from: date_from ? String(date_from) : undefined,
        date_to: date_to ? String(date_to) : undefined,
        rail: rail ? String(rail) : undefined,
      });

      res.status(200).json(metrics);
    } catch (err) {
      next(err);
    }
  }
);
