import type { RequestHandler } from 'express';
import { objectIdSchema } from '@byke-os/shared';
import { AppError } from '../../utils/app-error';
import { HotelModel } from './hotel.model';

/**
 * For routes nested under /hotels/:hotelId (room types, rooms…): the id must be valid and the
 * hotel must exist (not deleted). Plan 01 Part B will add the "is this user mapped to it" check here.
 */
export const requireHotel: RequestHandler<{ hotelId: string }> = async (req, _res, next) => {
  const { hotelId } = req.params;
  if (!objectIdSchema.safeParse(hotelId).success) throw AppError.field('hotelId', 'Invalid id');
  if (!(await HotelModel.exists({ _id: hotelId }))) throw AppError.notFound('Hotel not found');
  next();
};
