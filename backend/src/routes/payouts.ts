import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  createPayout,
  getPayoutById,
  listPayouts,
} from '../services/payoutService';
import { getProfileById, getProfileByClerkId } from '../services/profileService';
import { rootLogger } from '../utils/logger';

export const payoutsRouter = Router();

function getParamId(param: string | string[] | undefined): string {
  if (!param) return '';
  return Array.isArray(param) ? param[0] : param;
}

const createPayoutSchema = z.object({
  profile_id: z.string().uuid().optional(),
  amount: z.number().positive('amount must be greater than zero'),
  currency: z.string().default('KES'),
  destination_type: z.string().optional(),
  destination_reference: z.string().optional().nullable(),
  idempotency_key: z.string().min(1, 'idempotency_key is required').optional(),
  remarks: z.string().optional(),
});

/**
 * POST /api/v1/payouts
 * §18 Manual payout / withdraw endpoint with balance ceiling & idempotency enforcement
 */
payoutsRouter.post(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = createPayoutSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation Error',
          message: parseResult.error.issues[0]?.message || 'Invalid payout payload',
          details: parseResult.error.issues,
          statusCode: 400,
        });
        return;
      }

      const idempotencyKey =
        (req.headers['idempotency-key'] as string) ||
        parseResult.data.idempotency_key ||
        req.body.idempotency_key;

      if (!idempotencyKey) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'idempotency_key is required either in headers or request body',
          statusCode: 400,
        });
        return;
      }

      let profileId = parseResult.data.profile_id;

      // Unauthenticated check
      if (!req.userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required to initiate payouts',
          statusCode: 401,
        });
        return;
      }

      // If profile_id is not explicitly given, resolve from authenticated user
      if (!profileId && req.userId) {
        const userProfile = await getProfileByClerkId(req.userId);
        if (userProfile) {
          profileId = userProfile.id;
        }
      }

      if (!profileId) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'profile_id is required',
          statusCode: 400,
        });
        return;
      }

      const profile = await getProfileById(profileId);
      if (!profile) {
        res.status(404).json({
          error: 'Not Found',
          message: `Profile '${profileId}' not found`,
          statusCode: 404,
        });
        return;
      }

      // Ownership enforcement (§17, §18)
      if (profile.clerk_user_id !== req.userId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You are not authorized to initiate payouts for this profile',
          statusCode: 403,
        });
        return;
      }

      const payout = await createPayout({
        profile_id: profileId,
        amount: parseResult.data.amount,
        currency: parseResult.data.currency,
        destination_type: parseResult.data.destination_type,
        destination_reference: parseResult.data.destination_reference,
        idempotency_key: idempotencyKey,
        remarks: parseResult.data.remarks,
      });

      req.logger.info('Manual payout processed', {
        payout_id: payout.id,
        profile_id: profileId,
        amount: payout.requested_amount,
        status: payout.status,
        trace_id: req.traceId,
      });

      res.status(201).json({ payout });
    } catch (err: any) {
      if (
        err.message?.includes('exceeds available balance') ||
        err.message?.includes('must be greater than zero')
      ) {
        res.status(400).json({
          error: 'Bad Request',
          message: err.message,
          statusCode: 400,
        });
        return;
      }
      next(err);
    }
  }
);

/**
 * GET /api/v1/payouts/:id
 * §18 Query specific payout status
 */
payoutsRouter.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required to view payout',
          statusCode: 401,
        });
        return;
      }

      const id = getParamId(req.params.id);
      const payout = await getPayoutById(id);
      if (!payout) {
        res.status(404).json({
          error: 'Not Found',
          message: `Payout '${id}' not found`,
          statusCode: 404,
        });
        return;
      }

      // Ownership enforcement (§18)
      const profile = await getProfileById(payout.profile_id);
      if (profile && profile.clerk_user_id !== req.userId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You are not authorized to view this payout',
          statusCode: 403,
        });
        return;
      }

      res.status(200).json({ payout });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/payouts
 * §18 List payouts for profile with pagination
 */
payoutsRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required to list payouts',
          statusCode: 401,
        });
        return;
      }

      const profileId = req.query.profile_id as string | undefined;
      const status = req.query.status as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      let targetProfileId = profileId;

      if (!targetProfileId && req.userId) {
        const userProfile = await getProfileByClerkId(req.userId);
        if (userProfile) {
          targetProfileId = userProfile.id;
        }
      }

      if (targetProfileId) {
        const profile = await getProfileById(targetProfileId);
        if (profile && profile.clerk_user_id !== req.userId) {
          res.status(403).json({
            error: 'Forbidden',
            message: 'You are not authorized to view payouts for this profile',
            statusCode: 403,
          });
          return;
        }
      }

      const payouts = await listPayouts({
        profile_id: targetProfileId,
        status,
        limit,
        offset,
      });

      res.status(200).json({
        payouts,
        total: payouts.length,
        limit,
        offset,
      });
    } catch (err) {
      next(err);
    }
  }
);
