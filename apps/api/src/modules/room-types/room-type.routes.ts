import { Router } from 'express';
import {
  createRoomTypeSchema,
  roomTypeListQuerySchema,
  updateRoomTypeSchema,
} from '@byke-os/shared';
import { authorize } from '../../middlewares/authorize';
import { validateBody, validateObjectIdParam, validateQuery } from '../../middlewares/validate';
import { requireHotel } from '../hotels/hotel-param';
import { roomTypeController } from './room-type.controller';

/** Mounted at /hotels/:hotelId/room-types behind `authenticate` in routes.ts. */
export const roomTypeRouter = Router({ mergeParams: true });

roomTypeRouter.use(requireHotel);
roomTypeRouter.param('id', validateObjectIdParam);

roomTypeRouter.get(
  '/',
  authorize('view-room-type'),
  validateQuery(roomTypeListQuerySchema),
  roomTypeController.list,
);
roomTypeRouter.post(
  '/',
  authorize('add-room-type'),
  validateBody(createRoomTypeSchema),
  roomTypeController.create,
);
roomTypeRouter.get('/:id', authorize('view-room-type'), roomTypeController.getById);
roomTypeRouter.patch(
  '/:id',
  authorize('edit-room-type'),
  validateBody(updateRoomTypeSchema),
  roomTypeController.update,
);
roomTypeRouter.delete('/:id', authorize('delete-room-type'), roomTypeController.remove);
