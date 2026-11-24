import type { Request, Response } from 'express';
import { Router } from 'express';
import { authorize } from '../../middlewares/authorize';
import { ok } from '../../utils/respond';
import { consumptionModuleService } from './consumption-module.service';

/** Mounted at /consumption-modules behind `authenticate`. Read-only: seeded by migration. */
export const consumptionModuleRouter = Router();

consumptionModuleRouter.get(
  '/',
  authorize('view-consumption'),
  async (_req: Request, res: Response) => {
    ok(res, await consumptionModuleService.list());
  },
);
