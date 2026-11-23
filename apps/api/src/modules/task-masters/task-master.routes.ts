import { Router } from 'express';
import { authorize } from '../../middlewares/authorize';
import { taskMasterController } from './task-master.controller';

/** Mounted at /task-masters behind `authenticate`. Read-only: the list is seeded by migration. */
export const taskMasterRouter = Router();

taskMasterRouter.get(
  '/',
  authorize('view-task', 'add-task', 'edit-task'),
  taskMasterController.list,
);
