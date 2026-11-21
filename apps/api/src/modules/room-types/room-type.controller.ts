import type { Request, Response } from 'express';
import { roomTypeListQuerySchema } from '@byke-os/shared';
import { requireAuth } from '../../middlewares/authenticate';
import { getQuery } from '../../middlewares/validate';
import { ok } from '../../utils/respond';
import { roomTypeService } from './room-type.service';

type HotelParams = { hotelId: string };
type IdParams = HotelParams & { id: string };

export const roomTypeController = {
  async list(req: Request<HotelParams>, res: Response) {
    ok(
      res,
      await roomTypeService.list(req.params.hotelId, getQuery<typeof roomTypeListQuerySchema>(res)),
    );
  },

  async getById(req: Request<IdParams>, res: Response) {
    ok(res, await roomTypeService.getById(req.params.hotelId, req.params.id));
  },

  async create(req: Request<HotelParams>, res: Response) {
    const created = await roomTypeService.create(
      req.params.hotelId,
      req.body,
      requireAuth(req).userId,
    );
    ok(res, created, 201);
  },

  async update(req: Request<IdParams>, res: Response) {
    const { hotelId, id } = req.params;
    ok(res, await roomTypeService.update(hotelId, id, req.body, requireAuth(req).userId));
  },

  async remove(req: Request<IdParams>, res: Response) {
    await roomTypeService.remove(req.params.hotelId, req.params.id, requireAuth(req).userId);
    res.status(204).send();
  },
};
