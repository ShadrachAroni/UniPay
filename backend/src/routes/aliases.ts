import { Router, Request, Response, NextFunction } from 'express';
import { getAliasByHandle } from '../services/aliasService';

export const aliasesRouter = Router();

/**
 * GET /api/v1/aliases/:alias
 * Public recipient lookup by alias handle (e.g. @amina or amina)
 * Unauthenticated by design for checkout & QR scan resolution (§19)
 */
aliasesRouter.get(
  '/:alias',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const aliasParam = Array.isArray(req.params.alias)
        ? req.params.alias[0]
        : req.params.alias;
      const result = await getAliasByHandle(aliasParam);
      if (!result) {
        res.status(404).json({
          error: 'Not Found',
          message: `Alias '${aliasParam}' not found or inactive`,
          statusCode: 404,
        });
        return;
      }

      const { alias, profile } = result;

      res.status(200).json({
        alias,
        recipient: {
          profile_id: profile.id,
          display_name: profile.display_name,
          owner_name: profile.owner_name,
          account_type: profile.account_type,
          verification_status: profile.verification_status,
          currency: profile.currency,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);
