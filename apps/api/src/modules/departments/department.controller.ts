import type { Request, Response } from 'express';
import { departmentListQuerySchema } from '@byke-os/shared';
import { requireAuth } from '../../middlewares/authenticate';
import { getQuery } from '../../middlewares/validate';
import { ok } from '../../utils/respond';
import { departmentService } from './department.service';

type IdParams = { id: string };

export const departmentController = {
  async list(_req: Request, res: Response) {
    ok(res, await departmentService.list(getQuery<typeof departmentListQuerySchema>(res)));
  },

  async getById(req: Request<IdParams>, res: Response) {
    ok(res, await departmentService.getById(req.params.id));
  },

  async create(req: Request, res: Response) {
    ok(res, await departmentService.create(req.body, requireAuth(req).userId), 201);
  },

  async update(req: Request<IdParams>, res: Response) {
    ok(res, await departmentService.update(req.params.id, req.body, requireAuth(req).userId));
  },

  async remove(req: Request<IdParams>, res: Response) {
    await departmentService.remove(req.params.id, requireAuth(req).userId);
    res.status(204).send();
  },
};
