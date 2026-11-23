import type { Request, Response } from 'express';
import { locationListQuerySchema } from '@byke-os/shared';
import { getQuery } from '../../middlewares/validate';
import { ok } from '../../utils/respond';
import { locationService } from './location.service';

export const locationController = {
  async list(_req: Request, res: Response) {
    ok(res, await locationService.list(getQuery<typeof locationListQuerySchema>(res)));
  },
};
