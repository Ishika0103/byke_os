import { Router } from 'express';
import { notificationListQuerySchema } from '@byke-os/shared';
import { validateObjectIdParam, validateQuery } from '../../middlewares/validate';
import { notificationController } from './notification.controller';

/** Mounted at /notifications behind `authenticate`. Every user only sees their own. */
export const notificationRouter = Router();

notificationRouter.param('id', validateObjectIdParam);

notificationRouter.get(
  '/',
  validateQuery(notificationListQuerySchema),
  notificationController.list,
);
notificationRouter.get('/unread-count', notificationController.unreadCount);
notificationRouter.post('/read-all', notificationController.markAllRead);
notificationRouter.patch('/:id/read', notificationController.markRead);
