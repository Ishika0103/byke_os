import { Router } from 'express';
import {
  createTaskSchema,
  taskActionSchema,
  taskListQuerySchema,
  updateTaskSchema,
} from '@byke-os/shared';
import { validateBody, validateObjectIdParam, validateQuery } from '../../middlewares/validate';
import { requireHotel } from '../hotels/hotel-param';
import { taskController } from './task.controller';

/** Mounted at /hotels/:hotelId/tasks behind `authenticate` in routes.ts. Tasks are never deleted. */
export const taskRouter = Router({ mergeParams: true });

taskRouter.use(requireHotel);
taskRouter.param('id', validateObjectIdParam);

taskRouter.get('/', validateQuery(taskListQuerySchema), taskController.list);
taskRouter.get('/summary', taskController.summary);
taskRouter.post('/', validateBody(createTaskSchema), taskController.create);
taskRouter.get('/:id', taskController.getById);
taskRouter.patch('/:id', validateBody(updateTaskSchema), taskController.update);
taskRouter.post('/:id/actions', validateBody(taskActionSchema), taskController.act);
