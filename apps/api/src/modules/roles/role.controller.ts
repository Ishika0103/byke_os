import type { Request, Response } from 'express';
import { roleListQuerySchema } from '@byke-os/shared';
import { requireAuth } from '../../middlewares/authenticate';
import { getQuery } from '../../middlewares/validate';
import { ok } from '../../utils/respond';
import { roleService } from './role.service';

type IdParams = { id: string };

export const roleController = {
  async options(_req: Request, res: Response) {
    ok(res, await roleService.options());
  },

  async list(_req: Request, res: Response) {
    ok(res, await roleService.list(getQuery<typeof roleListQuerySchema>(res)));
  },

  async getById(req: Request<IdParams>, res: Response) {
    ok(res, await roleService.getById(req.params.id));
  },

  async create(req: Request, res: Response) {
    ok(res, await roleService.create(req.body, requireAuth(req).userId), 201);
  },

  async update(req: Request<IdParams>, res: Response) {
    ok(res, await roleService.update(req.params.id, req.body, requireAuth(req).userId));
  },

  async remove(req: Request<IdParams>, res: Response) {
    await roleService.remove(req.params.id, requireAuth(req).userId);
    res.status(204).send();
  },
};
