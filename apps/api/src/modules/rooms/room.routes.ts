import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import {
  bulkCreateRoomsSchema,
  createRoomSchema,
  roomListQuerySchema,
  updateRoomSchema,
} from '@byke-os/shared';
import { authorize } from '../../middlewares/authorize';
import { AppError } from '../../utils/app-error';
import { validateBody, validateObjectIdParam, validateQuery } from '../../middlewares/validate';
import { requireHotel } from '../hotels/hotel-param';
import { roomController } from './room.controller';

const excel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
}).single('file');

/** Runs multer and turns its errors (too big, wrong field…) into our 400s. */
const parseExcel: RequestHandler = (req, res, next) => {
  excel(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'File must be 5 MB or smaller'
          : 'Send one Excel file as "file"';
      return next(AppError.field('file', message));
    }
    next(err);
  });
};

/** Mounted at /hotels/:hotelId/rooms behind `authenticate` in routes.ts. */
export const roomRouter = Router({ mergeParams: true });

roomRouter.use(requireHotel);
roomRouter.param('id', validateObjectIdParam);

// Excel import / export (Plan 07). Before '/:id' so these aren't read as room ids.
roomRouter.get('/import/sample', authorize('add-room'), roomController.importSample);
roomRouter.post('/import/preview', authorize('add-room'), parseExcel, roomController.importPreview);
roomRouter.post('/import/commit', authorize('add-room'), parseExcel, roomController.importCommit);
roomRouter.post(
  '/import/rejected',
  authorize('add-room'),
  parseExcel,
  roomController.importRejected,
);
roomRouter.get('/export', authorize('view-room'), roomController.exportRooms);

roomRouter.get(
  '/',
  authorize('view-room'),
  validateQuery(roomListQuerySchema),
  roomController.list,
);
roomRouter.post('/', authorize('add-room'), validateBody(createRoomSchema), roomController.create);
roomRouter.post(
  '/bulk',
  authorize('add-room'),
  validateBody(bulkCreateRoomsSchema),
  roomController.bulkCreate,
);
roomRouter.get('/:id', authorize('view-room'), roomController.getById);
roomRouter.patch(
  '/:id',
  authorize('edit-room'),
  validateBody(updateRoomSchema),
  roomController.update,
);
roomRouter.delete('/:id', authorize('delete-room'), roomController.remove);
