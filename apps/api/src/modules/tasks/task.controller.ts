import type { Request, Response } from 'express';
import { taskListQuerySchema } from '@byke-os/shared';
import { requireAuth } from '../../middlewares/authenticate';
import { getQuery } from '../../middlewares/validate';
import { ok } from '../../utils/respond';
import { taskService } from './task.service';

type HotelParams = { hotelId: string };
type IdParams = HotelParams & { id: string };

export const taskController = {
  async list(req: Request<HotelParams>, res: Response) {
    const query = getQuery<typeof taskListQuerySchema>(res);
    ok(res, await taskService.list(req.params.hotelId, query, requireAuth(req).userId));
  },

  async summary(req: Request<HotelParams>, res: Response) {
    ok(res, await taskService.summary(req.params.hotelId));
  },

  async getById(req: Request<IdParams>, res: Response) {
    ok(res, await taskService.getById(req.params.hotelId, req.params.id, requireAuth(req).userId));
  },

  async create(req: Request<HotelParams>, res: Response) {
    ok(res, await taskService.create(req.params.hotelId, req.body, requireAuth(req).userId), 201);
  },

  async update(req: Request<IdParams>, res: Response) {
    const { hotelId, id } = req.params;
    ok(res, await taskService.update(hotelId, id, req.body, requireAuth(req).userId));
  },

  async act(req: Request<IdParams>, res: Response) {
    const { hotelId, id } = req.params;
    ok(res, await taskService.act(hotelId, id, req.body, requireAuth(req).userId));
  },
};
