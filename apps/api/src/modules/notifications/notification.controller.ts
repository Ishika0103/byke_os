import type { Request, Response } from 'express';
import { notificationListQuerySchema } from '@byke-os/shared';
import { requireAuth } from '../../middlewares/authenticate';
import { getQuery } from '../../middlewares/validate';
import { ok } from '../../utils/respond';
import { notificationService } from './notification.service';

export const notificationController = {
  async list(req: Request, res: Response) {
    const query = getQuery<typeof notificationListQuerySchema>(res);
    ok(res, await notificationService.list(requireAuth(req).userId, query));
  },

  async unreadCount(req: Request, res: Response) {
    ok(res, await notificationService.unreadCount(requireAuth(req).userId));
  },

  async markRead(req: Request<{ id: string }>, res: Response) {
    ok(res, await notificationService.markRead(requireAuth(req).userId, req.params.id));
  },

  async markAllRead(req: Request, res: Response) {
    ok(res, await notificationService.markAllRead(requireAuth(req).userId));
  },
};
