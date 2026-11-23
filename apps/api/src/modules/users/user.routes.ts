import { Router } from 'express';
import {
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
  userListQuerySchema,
} from '@byke-os/shared';
import { authorize } from '../../middlewares/authorize';
import { validateBody, validateObjectIdParam, validateQuery } from '../../middlewares/validate';
import { userController } from './user.controller';

/** Mounted behind `authenticate` in routes.ts. */
export const userRouter = Router();

userRouter.param('id', validateObjectIdParam);

userRouter.get(
  '/',
  authorize('view-user'),
  validateQuery(userListQuerySchema),
  userController.list,
);
userRouter.post('/', authorize('add-user'), validateBody(createUserSchema), userController.create);
userRouter.get('/:id', authorize('view-user'), userController.getById);
userRouter.patch(
  '/:id',
  authorize('edit-user'),
  validateBody(updateUserSchema),
  userController.update,
);
userRouter.delete('/:id', authorize('delete-user'), userController.remove);
userRouter.post(
  '/:id/reset-password',
  authorize('edit-user'),
  validateBody(resetPasswordSchema),
  userController.resetPassword,
);
