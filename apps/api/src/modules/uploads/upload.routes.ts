import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { AppError } from '../../utils/app-error';
import { requireHotel } from '../hotels/hotel-param';
import { uploadController } from './upload.controller';
import { MAX_UPLOAD_BYTES } from './upload.service';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 0 },
}).single('file');

/** Runs multer and turns its errors (too big, wrong field…) into our 400s. */
const parseFile: RequestHandler = (req, res, next) => {
  upload(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Photo must be 5 MB or smaller'
          : 'Send one photo as "file"';
      return next(AppError.field('file', message));
    }
    next(err);
  });
};

/** Mounted at /hotels/:hotelId/uploads behind `authenticate` in routes.ts. */
export const uploadRouter = Router({ mergeParams: true });

uploadRouter.use(requireHotel);
uploadRouter.post('/', parseFile, uploadController.create);
