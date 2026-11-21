import { Router } from 'express';
import {
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
  userListQuerySchema,
} from '@byke-os/shared';
import { validateBody, validateObjectIdParam, validateQuery } from '../../middlewares/validate';
import { userController } from './user.controller';

/** Mounted behind `authenticate` in routes.ts. */
export const userRouter = Router();

userRouter.param('id', validateObjectIdParam);

userRouter.get('/', validateQuery(userListQuerySchema), userController.list);
userRouter.post('/', validateBody(createUserSchema), userController.create);
userRouter.get('/:id', userController.getById);
userRouter.patch('/:id', validateBody(updateUserSchema), userController.update);
userRouter.delete('/:id', userController.remove);
userRouter.post(
  '/:id/reset-password',
  validateBody(resetPasswordSchema),
  userController.resetPassword,
);
