import { Router } from 'express';
import {
  bulkCreateRoomsSchema,
  createRoomSchema,
  roomListQuerySchema,
  updateRoomSchema,
} from '@byke-os/shared';
import { validateBody, validateObjectIdParam, validateQuery } from '../../middlewares/validate';
import { requireHotel } from '../hotels/hotel-param';
import { roomController } from './room.controller';

/** Mounted at /hotels/:hotelId/rooms behind `authenticate` in routes.ts. */
export const roomRouter = Router({ mergeParams: true });

roomRouter.use(requireHotel);
roomRouter.param('id', validateObjectIdParam);

roomRouter.get('/', validateQuery(roomListQuerySchema), roomController.list);
roomRouter.post('/', validateBody(createRoomSchema), roomController.create);
roomRouter.post('/bulk', validateBody(bulkCreateRoomsSchema), roomController.bulkCreate);
roomRouter.get('/:id', roomController.getById);
roomRouter.patch('/:id', validateBody(updateRoomSchema), roomController.update);
roomRouter.delete('/:id', roomController.remove);
