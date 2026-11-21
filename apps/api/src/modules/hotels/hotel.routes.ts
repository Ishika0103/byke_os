import { Router } from 'express';
import { createHotelSchema, hotelListQuerySchema, updateHotelSchema } from '@byke-os/shared';
import { validateBody, validateObjectIdParam, validateQuery } from '../../middlewares/validate';
import { hotelController } from './hotel.controller';

/** Mounted behind `authenticate` in routes.ts. */
export const hotelRouter = Router();

hotelRouter.param('id', validateObjectIdParam);

hotelRouter.get('/', validateQuery(hotelListQuerySchema), hotelController.list);
hotelRouter.post('/', validateBody(createHotelSchema), hotelController.create);
hotelRouter.get('/:id', hotelController.getById);
hotelRouter.patch('/:id', validateBody(updateHotelSchema), hotelController.update);
hotelRouter.delete('/:id', hotelController.remove);
