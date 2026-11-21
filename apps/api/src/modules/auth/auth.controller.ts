import type { Request, Response } from 'express';
import { requireAuth } from '../../middlewares/authenticate';
import { ok } from '../../utils/respond';
import { authService } from './auth.service';

export const authController = {
  async login(req: Request, res: Response) {
    ok(res, await authService.login(req.body));
  },

  async refresh(req: Request, res: Response) {
    ok(res, await authService.refresh(req.body.refreshToken));
  },

  async me(req: Request, res: Response) {
    ok(res, await authService.me(requireAuth(req).userId));
  },

  async changePassword(req: Request, res: Response) {
    await authService.changePassword(requireAuth(req).userId, req.body);
    res.status(204).send();
  },
};
