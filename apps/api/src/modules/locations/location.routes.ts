import { Router } from 'express';
import { locationListQuerySchema } from '@byke-os/shared';
import { validateQuery } from '../../middlewares/validate';
import { locationController } from './location.controller';

/** Mounted behind `authenticate`. Read-only: anyone signed in may list locations (hotel form). */
export const locationRouter = Router();

locationRouter.get('/', validateQuery(locationListQuerySchema), locationController.list);
