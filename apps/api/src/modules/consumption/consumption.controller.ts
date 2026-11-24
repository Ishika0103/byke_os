import type { Request, Response } from 'express';
import {
  consumptionListQuerySchema,
  consumptionSummaryQuerySchema,
  consumptionSyncQuerySchema,
} from '@byke-os/shared';
import { requireAuth } from '../../middlewares/authenticate';
import { getQuery } from '../../middlewares/validate';
import { ok } from '../../utils/respond';
import { consumptionService } from './consumption.service';

export const consumptionController = {
  async list(req: Request, res: Response) {
    const { hotelIds } = requireAuth(req);
    ok(
      res,
      await consumptionService.list(getQuery<typeof consumptionListQuerySchema>(res), hotelIds),
    );
  },

  async summary(req: Request, res: Response) {
    const { hotelIds } = requireAuth(req);
    const { date } = getQuery<typeof consumptionSummaryQuerySchema>(res);
    ok(res, await consumptionService.summary(date, hotelIds));
  },

  async sync(req: Request, res: Response) {
    const { userId, hotelIds } = requireAuth(req);
    const { preview } = getQuery<typeof consumptionSyncQuerySchema>(res);
    ok(res, await consumptionService.sync(preview, hotelIds, userId));
  },
};
