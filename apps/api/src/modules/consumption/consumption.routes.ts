import { Router } from 'express';
import {
  consumptionListQuerySchema,
  consumptionSummaryQuerySchema,
  consumptionSyncQuerySchema,
} from '@byke-os/shared';
import { authorize } from '../../middlewares/authorize';
import { validateQuery } from '../../middlewares/validate';
import { consumptionController } from './consumption.controller';

/** Mounted at /consumption behind `authenticate`. Rows are limited to the user's hotels. */
export const consumptionRouter = Router();

// Reads the hardcoded Google Sheet; `?preview=true` saves nothing.
consumptionRouter.post(
  '/sync',
  authorize('add-consumption'),
  validateQuery(consumptionSyncQuerySchema),
  consumptionController.sync,
);
consumptionRouter.get(
  '/summary',
  authorize('view-consumption'),
  validateQuery(consumptionSummaryQuerySchema),
  consumptionController.summary,
);
consumptionRouter.get(
  '/',
  authorize('view-consumption'),
  validateQuery(consumptionListQuerySchema),
  consumptionController.list,
);
