import type { Request, Response } from 'express';
import { ok } from '../../utils/respond';
import { uploadService } from './upload.service';

export const uploadController = {
  async create(req: Request, res: Response) {
    ok(res, await uploadService.saveImage(req.file?.buffer), 201);
  },
};
