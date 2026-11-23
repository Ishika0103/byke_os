import type { Request, Response } from 'express';
import { hotelListQuerySchema } from '@byke-os/shared';
import { requireAuth } from '../../middlewares/authenticate';
import { getQuery } from '../../middlewares/validate';
import { ok } from '../../utils/respond';
import { hotelService } from './hotel.service';

type IdParams = { id: string };

export const hotelController = {
  async list(req: Request, res: Response) {
    const query = getQuery<typeof hotelListQuerySchema>(res);
    ok(res, await hotelService.list(query, requireAuth(req).hotelIds));
  },

  async getById(req: Request<IdParams>, res: Response) {
    ok(res, await hotelService.getById(req.params.id, requireAuth(req).hotelIds));
  },

  async create(req: Request, res: Response) {
    ok(res, await hotelService.create(req.body, requireAuth(req).userId), 201);
  },

  async update(req: Request<IdParams>, res: Response) {
    const { userId, hotelIds } = requireAuth(req);
    ok(res, await hotelService.update(req.params.id, req.body, userId, hotelIds));
  },

  async remove(req: Request<IdParams>, res: Response) {
    const { userId, hotelIds } = requireAuth(req);
    await hotelService.remove(req.params.id, userId, hotelIds);
    res.status(204).send();
  },
};
