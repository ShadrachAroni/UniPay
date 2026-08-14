import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { aiService, listAIInteractions } from '../services/aiService';
import { rootLogger } from '../utils/logger';

export const aiRouter = Router();

const aiQuerySchema = z.object({
  query: z.string().min(1, 'Query string is required').max(1000, 'Query string is too long'),
  profile_id: z.string().uuid().optional(),
});

/**
 * POST /api/v1/ai/query
 * §15 & §18 Natural-Language Financial Dashboard Queries (Priority-0 #2)
 * Profile-scoped, allow-list validated server-side query execution.
 */
aiRouter.post(
  '/query',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parseResult = aiQuerySchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation Error',
          message: parseResult.error.errors[0]?.message || 'Invalid AI query request',
          details: parseResult.error.errors,
        });
        return;
      }

      // Profile resolution (§19: Scoped per-profile)
      const profileId =
        parseResult.data.profile_id ||
        (req.headers['x-profile-id'] as string) ||
        '00000000-0000-0000-0000-000000000001';

      const query = parseResult.data.query;

      const answer = await aiService.answerDashboardQuery(profileId, query, req.traceId);

      req.logger.info('Executed AI dashboard query', {
        profileId,
        query: query.slice(0, 100),
        aggregation: answer.aggregation,
        trace_id: req.traceId,
      });

      res.status(200).json(answer);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/ai/interactions
 * §11 & §19 Audit Trail of AI Interactions
 */
aiRouter.get(
  '/interactions',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const profileId = req.query.profile_id as string | undefined;
      const type = req.query.type as any;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const interactions = await listAIInteractions({
        profile_id: profileId,
        interaction_type: type,
        limit,
      });

      res.status(200).json({
        interactions,
        total: interactions.length,
      });
    } catch (err) {
      next(err);
    }
  }
);
