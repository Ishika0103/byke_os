import { Router } from 'express';
import {
  createDepartmentSchema,
  departmentListQuerySchema,
  updateDepartmentSchema,
} from '@byke-os/shared';
import { authorize } from '../../middlewares/authorize';
import { validateBody, validateObjectIdParam, validateQuery } from '../../middlewares/validate';
import { departmentController } from './department.controller';

/** Mounted at /departments behind `authenticate` in routes.ts. */
export const departmentRouter = Router();

departmentRouter.param('id', validateObjectIdParam);

// The user and task forms need the list for their pickers.
const canRead = authorize(
  'view-department',
  'view-user',
  'add-user',
  'edit-user',
  'view-task',
  'add-task',
  'edit-task',
);

departmentRouter.get(
  '/',
  canRead,
  validateQuery(departmentListQuerySchema),
  departmentController.list,
);
departmentRouter.post(
  '/',
  authorize('add-department'),
  validateBody(createDepartmentSchema),
  departmentController.create,
);
departmentRouter.get('/:id', canRead, departmentController.getById);
departmentRouter.patch(
  '/:id',
  authorize('edit-department'),
  validateBody(updateDepartmentSchema),
  departmentController.update,
);
departmentRouter.delete('/:id', authorize('delete-department'), departmentController.remove);
