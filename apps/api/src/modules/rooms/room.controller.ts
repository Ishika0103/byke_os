import type { Request, Response } from 'express';
import { roomListQuerySchema } from '@byke-os/shared';
import { requireAuth } from '../../middlewares/authenticate';
import { getQuery } from '../../middlewares/validate';
import { ok } from '../../utils/respond';
import { hasPermission } from '@byke-os/shared';
import { roomImportService } from './room-import.service';
import { roomService } from './room.service';

type HotelParams = { hotelId: string };
type IdParams = HotelParams & { id: string };

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Sends an .xlsx as a download. */
function sendFile(res: Response, name: string, data: Buffer) {
  res.setHeader('Content-Type', XLSX);
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send(data);
}

const canEditRooms = (req: Request) => hasPermission(requireAuth(req).permissions, 'edit-room');

export const roomController = {
  async importSample(req: Request<HotelParams>, res: Response) {
    const typeId = typeof req.query.roomTypeId === 'string' ? req.query.roomTypeId : undefined;
    sendFile(res, 'rooms-sample.xlsx', await roomImportService.sample(req.params.hotelId, typeId));
  },

  async exportRooms(req: Request<HotelParams>, res: Response) {
    const typeId = typeof req.query.roomTypeId === 'string' ? req.query.roomTypeId : undefined;
    const date = new Date().toISOString().slice(0, 10);
    sendFile(res, `rooms-${date}.xlsx`, await roomImportService.export(req.params.hotelId, typeId));
  },

  async importPreview(req: Request<HotelParams>, res: Response) {
    ok(
      res,
      await roomImportService.preview(req.params.hotelId, req.file?.buffer, canEditRooms(req)),
    );
  },

  async importCommit(req: Request<HotelParams>, res: Response) {
    const result = await roomImportService.commit(
      req.params.hotelId,
      req.file?.buffer,
      requireAuth(req).userId,
      canEditRooms(req),
    );
    ok(res, result);
  },

  async importRejected(req: Request<HotelParams>, res: Response) {
    const data = await roomImportService.rejected(
      req.params.hotelId,
      req.file?.buffer,
      canEditRooms(req),
    );
    sendFile(res, 'rooms-rejected.xlsx', data);
  },

  async list(req: Request<HotelParams>, res: Response) {
    ok(res, await roomService.list(req.params.hotelId, getQuery<typeof roomListQuerySchema>(res)));
  },

  async getById(req: Request<IdParams>, res: Response) {
    ok(res, await roomService.getById(req.params.hotelId, req.params.id));
  },

  async create(req: Request<HotelParams>, res: Response) {
    ok(res, await roomService.create(req.params.hotelId, req.body, requireAuth(req).userId), 201);
  },

  async bulkCreate(req: Request<HotelParams>, res: Response) {
    const result = await roomService.bulkCreate(
      req.params.hotelId,
      req.body,
      requireAuth(req).userId,
    );
    ok(res, result, 201);
  },

  async update(req: Request<IdParams>, res: Response) {
    const { hotelId, id } = req.params;
    ok(res, await roomService.update(hotelId, id, req.body, requireAuth(req).userId));
  },

  async remove(req: Request<IdParams>, res: Response) {
    await roomService.remove(req.params.hotelId, req.params.id, requireAuth(req).userId);
    res.status(204).send();
  },
};
