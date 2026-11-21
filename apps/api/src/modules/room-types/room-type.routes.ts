import { Router } from 'express';
import {
  createRoomTypeSchema,
  roomTypeListQuerySchema,
  updateRoomTypeSchema,
} from '@byke-os/shared';
import { validateBody, validateObjectIdParam, validateQuery } from '../../middlewares/validate';
import { requireHotel } from '../hotels/hotel-param';
import { roomTypeController } from './room-type.controller';

/** Mounted at /hotels/:hotelId/room-types behind `authenticate` in routes.ts. */
export const roomTypeRouter = Router({ mergeParams: true });

roomTypeRouter.use(requireHotel);
roomTypeRouter.param('id', validateObjectIdParam);

roomTypeRouter.get('/', validateQuery(roomTypeListQuerySchema), roomTypeController.list);
roomTypeRouter.post('/', validateBody(createRoomTypeSchema), roomTypeController.create);
roomTypeRouter.get('/:id', roomTypeController.getById);
roomTypeRouter.patch('/:id', validateBody(updateRoomTypeSchema), roomTypeController.update);
roomTypeRouter.delete('/:id', roomTypeController.remove);
