import type { Request, Response } from 'express';
import { hotelListQuerySchema } from '@byke-os/shared';
import { requireAuth } from '../../middlewares/authenticate';
import { getQuery } from '../../middlewares/validate';
import { ok } from '../../utils/respond';
import { hotelService } from './hotel.service';

type IdParams = { id: string };

export const hotelController = {
  async list(_req: Request, res: Response) {
    ok(res, await hotelService.list(getQuery<typeof hotelListQuerySchema>(res)));
  },

  async getById(req: Request<IdParams>, res: Response) {
    ok(res, await hotelService.getById(req.params.id));
  },

  async create(req: Request, res: Response) {
    ok(res, await hotelService.create(req.body, requireAuth(req).userId), 201);
  },

  async update(req: Request<IdParams>, res: Response) {
    ok(res, await hotelService.update(req.params.id, req.body, requireAuth(req).userId));
  },

  async remove(req: Request<IdParams>, res: Response) {
    await hotelService.remove(req.params.id, requireAuth(req).userId);
    res.status(204).send();
  },
};
