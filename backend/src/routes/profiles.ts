import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import {
  createProfile,
  getProfileById,
  getProfileByClerkId,
  submitIdentity,
  reviewIdentity,
} from '../services/profileService';
import { createAlias, getAliasesByProfileId } from '../services/aliasService';
import {
  getMoneyDirectionRules,
  setMoneyDirectionRules,
} from '../services/moneyDirectionService';
import { calculateProfileBalance } from '../services/payoutService';

export const profilesRouter = Router();

function getParamId(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

const createProfileSchema = z.object({
  account_type: z.enum(['individual', 'business']),
  display_name: z.string().min(2).max(100),
  owner_name: z.string().min(2).max(100),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  currency: z.string().length(3).default('KES').optional(),
  country_code: z.string().length(2).default('KE').optional(),
});

const createAliasSchema = z.object({
  alias: z.string().min(3).max(30),
  identifier_type: z.enum(['alias', 'qr', 'link']).default('alias').optional(),
});

const submitIdentitySchema = z.object({
  id_number: z.string().min(4).max(30),
  id_document_url: z.string().url(),
  id_selfie_url: z.string().url().optional().nullable(),
});

const reviewIdentitySchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reviewer_note: z.string().max(500).optional(),
});

// All profile write/read endpoints require authentication
profilesRouter.use(requireAuth);

/**
 * POST /api/v1/profiles
 * Create user or merchant profile (Single Account Model — flag, not a fork)
 */
profilesRouter.post(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = createProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Validation Error',
          message: parsed.error.issues[0]?.message || 'Invalid profile data',
          details: parsed.error.issues,
          statusCode: 400,
        });
        return;
      }

      const clerk_user_id = req.userId || (req.body.clerk_user_id as string);
      if (!clerk_user_id) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authenticated user ID is required to create a profile',
          statusCode: 401,
        });
        return;
      }

      const profile = await createProfile({
        clerk_user_id,
        ...parsed.data,
      });

      req.logger.info('Profile created successfully', {
        profile_id: profile.id,
        account_type: profile.account_type,
      });

      res.status(201).json({ profile });
    } catch (err: any) {
      if (err.message?.includes('already exists')) {
        res.status(409).json({
          error: 'Conflict',
          message: err.message,
          statusCode: 409,
        });
        return;
      }
      next(err);
    }
  }
);

/**
 * GET /api/v1/profiles/me
 * Fetch current authenticated user's profile and aliases
 */
profilesRouter.get(
  '/me',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User authentication required',
          statusCode: 401,
        });
        return;
      }

      const profile = await getProfileByClerkId(req.userId);
      if (!profile) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Profile not found for this user',
          statusCode: 404,
        });
        return;
      }

      const aliases = await getAliasesByProfileId(profile.id);
      res.status(200).json({ profile, aliases });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/profiles/:id
 * Fetch profile by ID
 */
profilesRouter.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = getParamId(req.params.id);
      const profile = await getProfileById(id);
      if (!profile) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Profile not found',
          statusCode: 404,
        });
        return;
      }

      const aliases = await getAliasesByProfileId(profile.id);
      res.status(200).json({ profile, aliases });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/profiles/:id/aliases
 * Generate new alias/QR for profile
 * Strictly gated on identity submission (§8)
 */
profilesRouter.post(
  '/:id/aliases',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = createAliasSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Validation Error',
          message: parsed.error.issues[0]?.message || 'Invalid alias format',
          details: parsed.error.issues,
          statusCode: 400,
        });
        return;
      }

      const id = getParamId(req.params.id);
      const alias = await createAlias({
        profile_id: id,
        alias: parsed.data.alias,
        identifier_type: parsed.data.identifier_type,
      });

      req.logger.info('Alias created successfully', {
        alias_id: alias.id,
        profile_id: alias.profile_id,
      });

      res.status(201).json({ alias });
    } catch (err: any) {
      if (err.statusCode) {
        res.status(err.statusCode).json({
          error: err.statusCode === 403 ? 'Forbidden' : 'Error',
          message: err.message,
          statusCode: err.statusCode,
        });
        return;
      }
      next(err);
    }
  }
);

/**
 * POST /api/v1/profiles/:id/identity
 * Submit KYC identity documents & selfie
 */
profilesRouter.post(
  '/:id/identity',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = submitIdentitySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Validation Error',
          message: parsed.error.issues[0]?.message || 'Invalid identity payload',
          details: parsed.error.issues,
          statusCode: 400,
        });
        return;
      }

      const id = getParamId(req.params.id);
      const updated = await submitIdentity(id, parsed.data);

      req.logger.info('Identity submitted for verification', {
        profile_id: updated.id,
        verification_status: updated.verification_status,
      });

      res.status(200).json({
        profile: updated,
        message: 'Identity documents submitted successfully. Verification status: submitted (under review)',
      });
    } catch (err: any) {
      if (err.message === 'Profile not found') {
        res.status(404).json({
          error: 'Not Found',
          message: err.message,
          statusCode: 404,
        });
        return;
      }
      next(err);
    }
  }
);

/**
 * GET /api/v1/profiles/:id/identity
 * Fetch KYC identity status
 */
profilesRouter.get(
  '/:id/identity',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = getParamId(req.params.id);
      const profile = await getProfileById(id);
      if (!profile) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Profile not found',
          statusCode: 404,
        });
        return;
      }

      res.status(200).json({
        verification_status: profile.verification_status,
        id_submitted_at: profile.id_submitted_at,
        id_reviewed_at: profile.id_reviewed_at,
        id_reviewer_note: profile.id_reviewer_note,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/profiles/:id/identity/review
 * Manual/Admin toggle to move profile between submitted -> approved / rejected
 */
profilesRouter.post(
  '/:id/identity/review',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = reviewIdentitySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Validation Error',
          message: parsed.error.issues[0]?.message || 'Invalid review payload',
          details: parsed.error.issues,
          statusCode: 400,
        });
        return;
      }

      const id = getParamId(req.params.id);
      const updated = await reviewIdentity(id, parsed.data);

      req.logger.info('Identity review recorded', {
        profile_id: updated.id,
        verification_status: updated.verification_status,
      });

      res.status(200).json({
        profile: updated,
        message: `Identity status updated to ${updated.verification_status}`,
      });
    } catch (err: any) {
      if (err.message === 'Profile not found') {
        res.status(404).json({
          error: 'Not Found',
          message: err.message,
          statusCode: 404,
        });
        return;
      }
      if (err.message?.includes('unsubmitted')) {
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

const moneyDirectionRuleItemSchema = z.object({
  id: z.string().optional(),
  destination_type: z.string().min(1),
  destination_reference: z.string().optional().nullable(),
  allocation_type: z.enum(['full', 'percentage', 'fixed_amount']),
  allocation_value: z.number().optional().nullable(),
  priority_order: z.number().int().positive().optional(),
  is_active: z.boolean().optional(),
});

const updateMoneyDirectionSchema = z.object({
  rules: z.array(moneyDirectionRuleItemSchema),
});

profilesRouter.get(
  ['/:id/money-direction', '/:id/money-direction/rules'],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = getParamId(req.params.id);
      const profile = await getProfileById(id);
      if (!profile) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Profile not found',
          statusCode: 404,
        });
        return;
      }

      // Ownership enforcement (§17, §18)
      if (profile.clerk_user_id !== req.userId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You are not authorized to view money direction rules for this profile',
          statusCode: 403,
        });
        return;
      }

      const rules = await getMoneyDirectionRules(id);
      res.status(200).json({ profile_id: id, rules });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/v1/profiles/:id/money-direction
 * Update money direction routing rules for profile (§17, §18)
 */
profilesRouter.put(
  ['/:id/money-direction', '/:id/money-direction/rules'],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = updateMoneyDirectionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Validation Error',
          message: parsed.error.issues[0]?.message || 'Invalid money direction rules payload',
          details: parsed.error.issues,
          statusCode: 400,
        });
        return;
      }

      const id = getParamId(req.params.id);
      const profile = await getProfileById(id);
      if (!profile) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Profile not found',
          statusCode: 404,
        });
        return;
      }

      // Ownership enforcement (§17, §18)
      if (profile.clerk_user_id !== req.userId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You are not authorized to edit money direction rules for this profile',
          statusCode: 403,
        });
        return;
      }

      const updatedRules = await setMoneyDirectionRules(id, parsed.data.rules as any);

      req.logger.info('Updated money direction rules', {
        profile_id: id,
        rule_count: updatedRules.length,
      });

      res.status(200).json({
        profile_id: id,
        rules: updatedRules,
        message: 'Money direction rules updated successfully',
      });
    } catch (err: any) {
      if (
        err.message?.includes('exceeds 100%') ||
        err.message?.includes('LOOP mobile number') ||
        err.message?.includes('Invalid') ||
        err.message?.includes('Unsupported')
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
 * GET /api/v1/profiles/:id/balance
 * Query profile available-to-withdraw and ledger balance (§18)
 */
profilesRouter.get(
  '/:id/balance',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = getParamId(req.params.id);
      const profile = await getProfileById(id);
      if (!profile) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Profile not found',
          statusCode: 404,
        });
        return;
      }

      // Authentication & Ownership enforcement (§18)
      if (!req.userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required to view profile balance',
          statusCode: 401,
        });
        return;
      }

      if (profile.clerk_user_id !== req.userId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You are not authorized to view balance for this profile',
          statusCode: 403,
        });
        return;
      }

      const balance = await calculateProfileBalance(id);
      res.status(200).json(balance);
    } catch (err) {
      next(err);
    }
  }
);

