import { Types } from 'mongoose';
import type {
  BulkCreateRoomsInput,
  CreateRoomInput,
  Paginated,
  Room,
  RoomListQuery,
  RoomTypeSummary,
  UpdateRoomInput,
} from '@byke-os/shared';
import { type LeanBase, softDeleteUpdate, toBaseDto } from '../../db/lean-types';
import { AppError } from '../../utils/app-error';
import { escapeRegex, toSort } from '../../utils/query';
import { RoomTypeModel } from '../room-types/room-type.model';
import { NATURAL_ORDER, RoomModel } from './room.model';

type LeanRoom = LeanBase & {
  hotelId: Types.ObjectId;
  roomTypeId: Types.ObjectId;
  roomNumber: string;
  floor: number | null;
  isSellable: boolean;
  notes: string | null;
};

const toDto = (r: LeanRoom, type: RoomTypeSummary | null): Room => ({
  ...toBaseDto(r),
  hotelId: String(r.hotelId),
  roomNumber: r.roomNumber,
  roomType: type,
  floor: r.floor ?? null,
  isSellable: r.isSellable,
  notes: r.notes ?? null,
});

/** Room type summaries for a set of rooms, in one query. */
async function typesFor(rooms: LeanRoom[]): Promise<Map<string, RoomTypeSummary>> {
  const ids = [...new Set(rooms.map((r) => String(r.roomTypeId)))];
  const types = await RoomTypeModel.find({ _id: { $in: ids } })
    .select('name code')
    .lean<{ _id: Types.ObjectId; name: string; code: string }[]>();
  return new Map(
    types.map((t) => [String(t._id), { id: String(t._id), name: t.name, code: t.code }]),
  );
}

async function findOrThrow(hotelId: string, id: string): Promise<LeanRoom> {
  const room = await RoomModel.findOne({ _id: id, hotelId }).lean<LeanRoom>();
  if (!room) throw AppError.notFound('Room not found');
  return room;
}

/** The room type must be this hotel's, and active, to put rooms in it. */
async function assertUsableRoomType(hotelId: string, roomTypeId: string) {
  const type = await RoomTypeModel.findOne({ _id: roomTypeId, hotelId })
    .select('isActive')
    .lean<{ isActive: boolean }>();
  if (!type) throw AppError.field('roomTypeId', 'Room type not found in this hotel');
  if (!type.isActive) throw AppError.field('roomTypeId', 'Room type is inactive');
}

async function assertNumberFree(hotelId: string, roomNumber: string, exceptId?: string) {
  const clash = await RoomModel.exists({
    hotelId,
    roomNumber,
    ...(exceptId && { _id: { $ne: exceptId } }),
  });
  if (clash) {
    throw AppError.conflict('ROOM_NUMBER_TAKEN', `Room ${roomNumber} already exists in this hotel`);
  }
}

export const roomService = {
  async list(hotelId: string, query: RoomListQuery): Promise<Paginated<Room>> {
    const { page, limit, q, isActive, roomTypeId, floor, sort } = query;
    const filter: Record<string, unknown> = { hotelId };
    if (isActive !== undefined) filter.isActive = isActive;
    if (roomTypeId) filter.roomTypeId = roomTypeId;
    if (floor !== undefined) filter.floor = floor;
    if (q) filter.roomNumber = new RegExp(`^${escapeRegex(q)}`, 'i');

    const [items, total] = await Promise.all([
      RoomModel.find(filter)
        .collation(NATURAL_ORDER)
        .sort({ ...toSort(sort), roomNumber: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<LeanRoom[]>(),
      RoomModel.countDocuments(filter),
    ]);
    const types = await typesFor(items);
    return {
      items: items.map((r) => toDto(r, types.get(String(r.roomTypeId)) ?? null)),
      page,
      limit,
      total,
    };
  },

  async getById(hotelId: string, id: string): Promise<Room> {
    const room = await findOrThrow(hotelId, id);
    const types = await typesFor([room]);
    return toDto(room, types.get(String(room.roomTypeId)) ?? null);
  },

  async create(hotelId: string, input: CreateRoomInput, actorId: string): Promise<Room> {
    await assertUsableRoomType(hotelId, input.roomTypeId);
    await assertNumberFree(hotelId, input.roomNumber);
    const room = await RoomModel.create({
      ...input,
      hotelId,
      createdBy: actorId,
      updatedBy: actorId,
    });
    return this.getById(hotelId, String(room._id));
  },

  /** Rooms from…to in one go. All or nothing: fails if any of the numbers already exists. */
  async bulkCreate(
    hotelId: string,
    input: BulkCreateRoomsInput,
    actorId: string,
  ): Promise<{ created: number }> {
    await assertUsableRoomType(hotelId, input.roomTypeId);
    const numbers = Array.from({ length: input.to - input.from + 1 }, (_, i) =>
      String(input.from + i),
    );
    const existing = await RoomModel.find({ hotelId, roomNumber: { $in: numbers } })
      .collation(NATURAL_ORDER)
      .sort({ roomNumber: 1 })
      .select('roomNumber')
      .lean<{ roomNumber: string }[]>();
    if (existing.length > 0) {
      const shown = existing
        .slice(0, 5)
        .map((r) => r.roomNumber)
        .join(', ');
      const more = existing.length > 5 ? ` and ${existing.length - 5} more` : '';
      throw AppError.conflict('ROOM_NUMBER_TAKEN', `Already in this hotel: ${shown}${more}`);
    }

    await RoomModel.insertMany(
      numbers.map((roomNumber) => ({
        roomNumber,
        roomTypeId: input.roomTypeId,
        floor: input.floor ?? null,
        isSellable: input.isSellable ?? true,
        hotelId,
        createdBy: actorId,
        updatedBy: actorId,
      })),
    );
    return { created: numbers.length };
  },

  async update(
    hotelId: string,
    id: string,
    input: UpdateRoomInput,
    actorId: string,
  ): Promise<Room> {
    const room = await findOrThrow(hotelId, id);
    if (input.roomTypeId !== undefined && input.roomTypeId !== String(room.roomTypeId)) {
      await assertUsableRoomType(hotelId, input.roomTypeId);
    }
    if (input.roomNumber !== undefined && input.roomNumber !== room.roomNumber) {
      await assertNumberFree(hotelId, input.roomNumber, id);
    }
    await RoomModel.updateOne(
      { _id: id },
      { ...input, updatedBy: actorId },
      { runValidators: true },
    );
    return this.getById(hotelId, id);
  },

  async remove(hotelId: string, id: string, actorId: string): Promise<void> {
    await findOrThrow(hotelId, id);
    await RoomModel.updateOne({ _id: id }, softDeleteUpdate(actorId));
  },
};
