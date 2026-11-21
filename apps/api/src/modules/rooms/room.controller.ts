import type { Request, Response } from 'express';
import { roomListQuerySchema } from '@byke-os/shared';
import { requireAuth } from '../../middlewares/authenticate';
import { getQuery } from '../../middlewares/validate';
import { ok } from '../../utils/respond';
import { roomService } from './room.service';

type HotelParams = { hotelId: string };
type IdParams = HotelParams & { id: string };

export const roomController = {
  async list(req: Request<HotelParams>, res: Response) {
    ok(res, await roomService.list(req.params.hotelId, getQuery<typeof roomListQuerySchema>(res)));
  },

  async getById(req: Request<IdParams>, res: Response) {
    ok(res, await roomService.getById(req.params.hotelId, req.params.id));
  },

  async create(req: Request<HotelParams>, res: Response) {
    ok(res, await roomService.create(req.params.hotelId, req.body, requireAuth(req).userId), 201);
  },

  async bulkCreate(req: Request<HotelParams>, res: Response) {
    const result = await roomService.bulkCreate(
      req.params.hotelId,
      req.body,
      requireAuth(req).userId,
    );
    ok(res, result, 201);
  },

  async update(req: Request<IdParams>, res: Response) {
    const { hotelId, id } = req.params;
    ok(res, await roomService.update(hotelId, id, req.body, requireAuth(req).userId));
  },

  async remove(req: Request<IdParams>, res: Response) {
    await roomService.remove(req.params.hotelId, req.params.id, requireAuth(req).userId);
    res.status(204).send();
  },
};
