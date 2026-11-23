import { Router } from 'express';
import {
  createTaskSchema,
  taskActionSchema,
  taskListQuerySchema,
  updateTaskSchema,
} from '@byke-os/shared';
import { authorize } from '../../middlewares/authorize';
import { validateBody, validateObjectIdParam, validateQuery } from '../../middlewares/validate';
import { requireHotel } from '../hotels/hotel-param';
import { taskController } from './task.controller';

/** Mounted at /hotels/:hotelId/tasks behind `authenticate` in routes.ts. Tasks are never deleted. */
export const taskRouter = Router({ mergeParams: true });

taskRouter.use(requireHotel);
taskRouter.param('id', validateObjectIdParam);

taskRouter.get(
  '/',
  authorize('view-task'),
  validateQuery(taskListQuerySchema),
  taskController.list,
);
taskRouter.get('/summary', authorize('view-task'), taskController.summary);
taskRouter.post('/', authorize('add-task'), validateBody(createTaskSchema), taskController.create);
taskRouter.get('/:id', authorize('view-task'), taskController.getById);
taskRouter.patch(
  '/:id',
  authorize('edit-task'),
  validateBody(updateTaskSchema),
  taskController.update,
);
// Start, block, done, verify, send back, cancel: all "edit-task" for now (Plan 06).
taskRouter.post(
  '/:id/actions',
  authorize('edit-task'),
  validateBody(taskActionSchema),
  taskController.act,
);
