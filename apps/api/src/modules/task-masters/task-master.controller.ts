import type { Request, Response } from 'express';
import { ok } from '../../utils/respond';
import { taskMasterService } from './task-master.service';

export const taskMasterController = {
  async list(_req: Request, res: Response) {
    ok(res, await taskMasterService.list());
  },
};
