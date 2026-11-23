import type { Request, Response } from 'express';
import { userListQuerySchema } from '@byke-os/shared';
import { ALL_PERMISSIONS } from '@byke-os/shared';
import { requireAuth } from '../../middlewares/authenticate';
import { getQuery } from '../../middlewares/validate';
import { ok } from '../../utils/respond';
import { userService } from './user.service';

type IdParams = { id: string };

const isSuperAdmin = (req: Request) => requireAuth(req).permissions.includes(ALL_PERMISSIONS);

export const userController = {
  async list(_req: Request, res: Response) {
    ok(res, await userService.list(getQuery<typeof userListQuerySchema>(res)));
  },

  async getById(req: Request<IdParams>, res: Response) {
    ok(res, await userService.getById(req.params.id));
  },

  async create(req: Request, res: Response) {
    ok(res, await userService.create(req.body, requireAuth(req).userId, isSuperAdmin(req)), 201);
  },

  async update(req: Request<IdParams>, res: Response) {
    ok(
      res,
      await userService.update(req.params.id, req.body, requireAuth(req).userId, isSuperAdmin(req)),
    );
  },

  async remove(req: Request<IdParams>, res: Response) {
    await userService.remove(req.params.id, requireAuth(req).userId, isSuperAdmin(req));
    res.status(204).send();
  },

  async resetPassword(req: Request<IdParams>, res: Response) {
    await userService.resetPassword(
      req.params.id,
      req.body.newPassword,
      requireAuth(req).userId,
      isSuperAdmin(req),
    );
    res.status(204).send();
  },
};
