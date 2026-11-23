import { Router } from 'express';
import { createHotelSchema, hotelListQuerySchema, updateHotelSchema } from '@byke-os/shared';
import { authorize } from '../../middlewares/authorize';
import { validateBody, validateObjectIdParam, validateQuery } from '../../middlewares/validate';
import { hotelController } from './hotel.controller';

/** Mounted behind `authenticate` in routes.ts. */
export const hotelRouter = Router();

hotelRouter.param('id', validateObjectIdParam);

// The hotels a user works at are listed for anyone signed in (they need them to use the app);
// the list is already limited to the user's own hotels (Plan 05).
hotelRouter.get('/', validateQuery(hotelListQuerySchema), hotelController.list);
hotelRouter.post(
  '/',
  authorize('add-hotel'),
  validateBody(createHotelSchema),
  hotelController.create,
);
hotelRouter.get('/:id', hotelController.getById);
hotelRouter.patch(
  '/:id',
  authorize('edit-hotel'),
  validateBody(updateHotelSchema),
  hotelController.update,
);
hotelRouter.delete('/:id', authorize('delete-hotel'), hotelController.remove);
